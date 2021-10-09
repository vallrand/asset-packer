export class Bitmap {
    public frame: { x: number, y: number, width: number, height: number }
    public size: { width: number, height: number }
    public rotation: number = 0
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
    get trimmed(){
        const left = this.frame.x, top = this.frame.y
        const right = (this.rotation & 1 ? this.height : this.width) - this.frame.x - this.frame.width
        const bottom = (this.rotation & 1 ? this.width : this.height) - this.frame.y - this.frame.height
        switch(this.rotation){
            case 1: return { left: bottom, right: top, top: left, bottom: right }
            case 2: return { left: right, right: left, top: bottom, bottom: top }
            case 3: return { left: top, right: bottom, top: right, bottom: left }
            case 0: default: return { left, right, top, bottom }
        }
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
        target.rotation = source.rotation
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
    static extrude(
        source: Bitmap, padding: number,
        x: number, y: number, width: number, height: number,
        trimmed: { top: number, left: number, right: number, bottom: number }
    ): Bitmap {
        if(!padding) return source

        const offset = Math.floor(0.5 * padding)
        const left = Math.max(0, x - offset)
        const top = Math.max(0, y - offset)
        const right = Math.min(source.width, x + width + padding - offset)
        const bottom = Math.min(source.height, y + height + padding - offset)
        if(trimmed.left >= 0) for(let c = x - 1; c >= left; c--)
            Bitmap.copy(source, source, c, top, c + 1, top, 1, bottom - top)
        if(trimmed.right >= 0) for(let c = x + width; c < right; c++)
            Bitmap.copy(source, source, c, top, c - 1, top, 1, bottom - top)
        if(trimmed.top >= 0) for(let r = y - 1; r >= top; r--)
            Bitmap.copy(source, source, left, r, left, r + 1, right - left, 1)
        if(trimmed.bottom >= 0) for(let r = y + height; r < bottom; r++)
            Bitmap.copy(source, source, left, r, left, r - 1, right - left, 1)
        return source
    }
    static rotate(source: Bitmap, ccw: boolean = false): Bitmap {
        const target: Bitmap = new Bitmap(source.filename, source.height, source.width)
        target.rotation = (source.rotation + (ccw ? 3 : 1)) % 4
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