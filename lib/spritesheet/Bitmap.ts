export class Bitmap {
    public frame: { x: number, y: number, width: number, height: number }
    public size: { width: number, height: number }
    constructor(
        public filename: string,
        public readonly width: number,
        public readonly height: number,
        public readonly data: Uint8Array = new Uint8Array(width * height * 4),
    ){
        this.size = { width, height }
        this.frame = { x: 0, y: 0, width, height }
    }
    get opaque(): boolean {
        for(let i = 0; i < this.data.length; i+=4)
            if(this.data[i + 3] < 0xFF) return false
        return true
    }
    static copy(
        source: Bitmap, target: Bitmap,
        targetX: number, targetY: number,
        sourceX: number, sourceY: number,
        width: number, height: number
    ): Bitmap {
        width = Math.min(width, source.width - sourceX, target.width - targetX)
        height = Math.min(height, source.height - sourceY, target.height - targetY)
        for(let x = 0; x < width; x++)
        for(let y = 0; y < height; y++){
            const sourceIndex = (source.width * (y + sourceY) + x + sourceX) * 4
            const targetIndex = (target.width * (y + targetY) + x + targetX) * 4
            target.data[targetIndex+0] = source.data[sourceIndex+0]
            target.data[targetIndex+1] = source.data[sourceIndex+1]
            target.data[targetIndex+2] = source.data[sourceIndex+2]
            target.data[targetIndex+3] = source.data[sourceIndex+3]
        }
        return target
    }
    static trim(source: Bitmap, alphaThreshold: number = 0): Bitmap {
        alphaThreshold = alphaThreshold * 0xFF | 0

        let left = source.width - 1, right = 0
        let top = source.height - 1, bottom = 0

        for(let x = 0; x < source.width; x++)
        for(let y = 0; y < source.height; y++){
            const index = (y * source.width + x) * 4
            const alpha = source.data[index + 3]

            if(alpha <= alphaThreshold) continue

            left = Math.min(left, x)
            right = Math.max(right, x)
            top = Math.min(top, y)
            bottom = Math.max(bottom, y)
        }
        left = Math.min(left, right)
        top = Math.min(top, bottom)
        if(source.width === right - left + 1 && source.height === bottom - top + 1) return source

        const target: Bitmap = new Bitmap(
            source.filename,
            right - left + 1,
            bottom - top + 1
        )
        target.size = source.size
        target.frame = {
            x: source.frame.x - left,
            y: source.frame.y - top,
            width: source.frame.width,
            height: source.frame.height
        }

        return Bitmap.copy(
            source, target,
            0, 0, left, top, target.width, target.height
        )
    }
    static extrude(source: Bitmap, padding: number, x: number, y: number, width: number, height: number): Bitmap {
        if(!padding) return source

        const offset = Math.floor(0.5 * padding)
        const left = Math.max(0, x - offset)
        const top = Math.max(0, y - offset)
        const right = Math.min(source.width, x + width + padding - offset)
        const bottom = Math.min(source.height, y + height + padding - offset)
        for(let c = x - 1; c >= left; c--)
            Bitmap.copy(source, source, c + 1, top, c, top, 1, bottom - top)
        for(let c = x + width + 1; c <= right; c++)
            Bitmap.copy(source, source, c - 1, top, c, top, 1, bottom - top)
        for(let r = y - 1; r >= top; r--)
            Bitmap.copy(source, source, left, r + 1, left, r, right - left, 1)
        for(let r = y + 1; r <= bottom; r++)
            Bitmap.copy(source, source, left, r - 1, left, r, right - left, 1)
        return source
    }
    //TODO: remove deprecated method
    static pad(source: Bitmap, padding: number, extrude: boolean): Bitmap {
        if(!padding) return source

        const target: Bitmap = new Bitmap(
            source.filename,
            source.width + 2 * padding,
            source.height + 2 * padding
        )
        target.size = source.size
        target.frame = {
            x: source.frame.x + padding,
            y: source.frame.y + padding,
            width: source.frame.width,
            height: source.frame.height
        }
        Bitmap.copy(source, target, padding, padding, 0, 0, source.width, source.height)
        if(extrude){
            for(let x = padding - 1; x >= 0; x--){
                Bitmap.copy(target, target, x, 0, padding, 0, 1, target.height)
                Bitmap.copy(target, target, target.width - x - 1, 0, target.width - padding - 1, 0, 1, target.height)
            }
            for(let y = padding - 1; y >= 0; y--){
                Bitmap.copy(target, target, 0, y, 0, padding, target.width, 1)
                Bitmap.copy(target, target, 0, target.height - y - 1, 0, target.height - padding - 1, target.width, 1)
            }
        }
        return target
    }
    static rotate(source: Bitmap, ccw: boolean = false): Bitmap {
        const target: Bitmap = new Bitmap(source.filename, source.height, source.width)
        target.size = source.size
        target.frame = source.frame

        for(let x = 0; x < target.width; x++)
        for(let y = 0; y < target.height; y++){
            const sourceIndex = ccw
            ? (source.width * x + (source.width - 1 - y)) * 4
            : (source.width * (source.height - 1 - x) + y) * 4
            const targetIndex = (target.width * y + x) * 4
            target.data[targetIndex+0] = source.data[sourceIndex+0]
            target.data[targetIndex+1] = source.data[sourceIndex+1]
            target.data[targetIndex+2] = source.data[sourceIndex+2]
            target.data[targetIndex+3] = source.data[sourceIndex+3]
        }

        return target
    }
    static downsample(source: Bitmap, width: number, height: number): Bitmap {
        const target: Bitmap = new Bitmap(source.filename, width, height)
        const scaleX = source.width / target.width
        const scaleY = source.height / target.height

        for(let x = 0; x < target.width; x++)
        for(let y = 0; y < target.height; y++){
            const targetIndex = (target.width * y + x) * 4
            let red = 0, green = 0, blue = 0, alpha = 0

            const left = x * scaleX
            const right = (x + 1) * scaleX
            const top = y * scaleY
            const bottom = (y + 1) * scaleY
            const sampleArea = (right - left) * (bottom - top)

            for(let sx = left | 0; sx < right; sx++)
            for(let sy = top | 0; sy < bottom; sy++){
                const sourceIndex = (source.width * sy + sx) * 4
                const area = (Math.min(sx + 1, right) - Math.max(sx, left)) * (Math.min(sy + 1, bottom) - Math.max(sy, top))
                red += area * source.data[sourceIndex+0]
                green += area * source.data[sourceIndex+1]
                blue += area * source.data[sourceIndex+2]
                alpha += area * source.data[sourceIndex+3]
            }

            target.data[targetIndex+0] = Math.round(red / sampleArea)
            target.data[targetIndex+1] = Math.round(green / sampleArea)
            target.data[targetIndex+2] = Math.round(blue / sampleArea)
            target.data[targetIndex+3] = Math.round(alpha / sampleArea)
        }

        return target
    }
}