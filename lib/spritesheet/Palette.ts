import { EarthMoverDistance } from './emd'

export const rgb2hex = (r: number, g: number, b: number): string => 
`#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
export type vec3 = [number,number,number]

function euclideanDistanceSquared(a: vec3, b: vec3): number {
    const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2]
    return dx*dx + dy*dy + dz*dz
}

class Color3DBox {
    public readonly volume: number
    public readonly count: number
    public readonly average: vec3
    constructor(
        public readonly bits: number = 5,
        public readonly histogram: Uint32Array,
        public readonly min: vec3,
        public readonly max: vec3
    ){
        this.volume = (this.max[0] - this.min[0] + 1) * (this.max[1] - this.min[1] + 1) * (this.max[2] - this.min[2] + 1)
        this.count = 0
        const multiplier = 1 << 8 - bits
        let red = 0, green = 0, blue = 0
        for(let r = this.min[0]; r <= this.max[0]; r++)
        for(let g = this.min[1]; g <= this.max[1]; g++)
        for(let b = this.min[2]; b <= this.max[2]; b++){
            const index = r + (g << this.bits) + (b << (2 * this.bits))
            const count = this.histogram[index]
            this.count += count
            red += count * (r + 0.5) * multiplier
            green += count * (g + 0.5) * multiplier
            blue += count * (b + 0.5) * multiplier
        }
        this.average = this.count
        ? [red / this.count | 0, green / this.count | 0, blue / this.count | 0]
        : [
            multiplier * 0.5 * (this.min[0] + this.max[0] + 1) | 0,
            multiplier * 0.5 * (this.min[1] + this.max[1] + 1) | 0,
            multiplier * 0.5 * (this.min[2] + this.max[2] + 1) | 0
        ]
    }
    overlap(box: Color3DBox): number {
        const sizeX = Math.min(this.max[0] - this.min[0] + 1, box.max[0] - box.min[0] + 1)
        const sizeY = Math.min(this.max[1] - this.min[1] + 1, box.max[1] - box.min[1] + 1)
        const sizeZ = Math.min(this.max[2] - this.min[2] + 1, box.max[2] - box.min[2] + 1)
        const dx = Math.min(this.max[0], box.max[0]) - Math.max(this.min[0], box.min[0])
        const dy = Math.min(this.max[1], box.max[1]) - Math.max(this.min[1], box.min[1])
        const dz = Math.min(this.max[2], box.max[2]) - Math.max(this.min[2], box.min[2])
        return Math.max(
            1 - dx / sizeX,
            1 - dy / sizeY,
            1 - dz / sizeZ
        )
    }
    distance(red: number, green: number, blue: number): number {
        red >>= 8 - this.bits
        green >>= 8 - this.bits
        blue >>= 8 - this.bits
        return Math.max(
            Math.max(red - this.max[0], this.min[0] - red),
            Math.max(green - this.max[1], this.min[1] - green),
            Math.max(blue - this.max[2], this.min[2] - blue)
        )
    }
    /** modified median cut quantization */
    medianCut(): [Color3DBox, Color3DBox | void] {
        if(this.count <= 1) return [this, undefined]
        const dimensions = [
            this.max[0] - this.min[0] + 1,
            this.max[1] - this.min[1] + 1,
            this.max[2] - this.min[2] + 1
        ]
        const maxDimension = Math.max(...dimensions)
        const axisA = dimensions.indexOf(maxDimension)
        const axisB = (axisA + 1) % dimensions.length
        const axisC = (axisA + 2) % dimensions.length
        const lookbehind = new Uint32Array(this.max[axisA] + 1)
        let total = 0
        for(let a = this.min[axisA]; a <= this.max[axisA]; a++){
            let axisTotal = 0
            for(let b = this.min[axisB]; b <= this.max[axisB]; b++)
            for(let c = this.min[axisC]; c <= this.max[axisC]; c++)
                axisTotal += this.histogram[(a << axisA * this.bits) + (b << axisB * this.bits) + (c << axisC * this.bits)]
            lookbehind[a] = total += axisTotal
        }

        let split = -1
        const lookahead = new Uint32Array(lookbehind.length)
        for(let i = 0; i < lookahead.length; i++){
            lookahead[i] = total - lookbehind[i]
            if(split == -1 && lookbehind[i] > 0.5 * total) split = i
        }

        const left = split - this.min[axisA]
        const right = this.max[axisA] - split

        split = left <= right ?
        Math.max(0, Math.min(this.max[axisA] - 1, split + 0.5 * right | 0)) :
        Math.min(this.max[axisA], Math.max(this.min[axisA], split - 1 - 0.5 * left | 0))
        while(!lookbehind![split]) split++
        for(let count = lookahead[split]; !count && lookbehind![split - 1]; count = lookahead[--split]);

        const maxA = <vec3> this.max.slice()
        const minB = <vec3> this.min.slice()
        maxA[axisA] = split
        minB[axisA] = split + 1

        return [
            new Color3DBox(this.bits, this.histogram, this.min, maxA),
            new Color3DBox(this.bits, this.histogram, minB, this.max)
        ]
    }
    static fromRGBA(rgba: Uint8Array, options: { bits: number, alphaThreshold: number }): Color3DBox {
        const bitshift = 8 - options.bits
        const histogram = new Uint32Array(1 << 3 * options.bits)
        const lower: vec3 = [0xFF, 0xFF, 0xFF]
        const upper: vec3 = [0x00, 0x00, 0x00]
        for(let i = 0; i < rgba.length; i+=4){
            const r = rgba[i + 0] >> bitshift
            const g = rgba[i + 1] >> bitshift
            const b = rgba[i + 2] >> bitshift
            const a = rgba[i + 3]
            if(a <= options.alphaThreshold) continue
            const index = r + (g << options.bits) + (b << 2 * options.bits)
            histogram[index]++
            lower[0] = Math.min(lower[0], r)
            lower[1] = Math.min(lower[1], g)
            lower[2] = Math.min(lower[2], b)
            upper[0] = Math.max(upper[0], r)
            upper[1] = Math.max(upper[1], g)
            upper[2] = Math.max(upper[2], b)
        }
        return new Color3DBox(options.bits, histogram, lower, upper)
    }
}

export interface QuantizationOptions {
    colors: number
    quality: number
    alphaThreshold: number
}
export class Palette {
    static quantize(pixels: Uint8Array, {
        colors = 2,
        quality = 4,
        alphaThreshold = 0
    }: Partial<QuantizationOptions>): Palette {
        if(colors < 2 || colors > 256) throw new Error(`Invalid options.colors ${colors}`)

        const iterate = function(queue: Color3DBox[], targetLength: number, comparator: (a: Color3DBox, b: Color3DBox) => number){
            while(queue.length < targetLength){
                queue.sort(comparator)
                const box = queue.pop()
                if(!box || !box.count) break
                const [ boxA, boxB ] = box.medianCut()
                queue.push(boxA)
                if(boxB && boxB.count > 0) queue.push(boxB)
                else break
            }
        }
    
        const queue = [Color3DBox.fromRGBA(pixels, { bits: quality, alphaThreshold: alphaThreshold })]
        iterate(queue, 0.75 * colors, (a, b) => a.count - b.count)
        iterate(queue, colors, (a, b) => a.count * a.volume - b.count * b.volume)
        return new Palette(queue)
    }
    public readonly total: number
    constructor(private readonly boxes: Color3DBox[]){
        this.total = boxes.reduce((total, box) => total + box.count, 0)
    }
    get colors(){ return this.boxes.map(box => rgb2hex(...box.average)) }
    get histogram(){ return this.boxes[0].histogram }
    public static weightedIntersection(paletteU: Palette, paletteV: Palette): number {
        let out = 0
        for(let i = paletteU.boxes.length - 1; i >= 0; i--){
            const boxU = paletteU.boxes[i]
            for(let j = paletteV.boxes.length - 1; j >= 0; j--){
                const boxV = paletteV.boxes[j]
                out += Math.min(
                    boxU.distance(...boxV.average), boxV.distance(...boxU.average)
                ) * (boxV.count / paletteV.total) * (boxU.count / paletteU.total)
            }
        }
        return out
    }
    public static wassersteinDistance(paletteU: Palette, paletteV: Palette): number {
        return new EarthMoverDistance(
            paletteU.boxes.length, paletteV.boxes.length,
            (u, v) => 
            (0.5 + 0.5 * paletteU.boxes[u].overlap(paletteV.boxes[v])) *
            euclideanDistanceSquared(paletteU.boxes[u].average, paletteV.boxes[v].average) / 0xFE01
        ).computeMetric(
            paletteU.boxes.map(box => box.count / paletteU.total),
            paletteV.boxes.map(box => box.count / paletteV.total)
        )
    }
}