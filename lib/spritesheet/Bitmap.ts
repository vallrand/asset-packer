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
    //TODO: Use a different algorithm for better results if scale is not 1/2n
    static downsample(source: Bitmap, width: number, height: number): Bitmap {
        const target: Bitmap = new Bitmap(source.filename, width, height)
        const round = (value: number) => (value + 0.49) << 0
        const scaleX = source.width / target.width
        const scaleY = source.height / target.height
        const sampleWidth = round(scaleX)
        const sampleHeight = round(scaleY)
        const sampleArea = sampleWidth * sampleHeight

        for(let x = 0; x < target.width; x++)
        for(let y = 0; y < target.height; y++){
            const targetIndex = (target.width * y + x) * 4
            const sourceIndex = round(x * scaleX) + round(y * scaleY) * source.width
            let red = 0, green = 0, blue = 0, alpha = 0

            for(let sx = 0; sx < sampleWidth; sx++)
            for(let sy = 0; sy < sampleHeight; sy++){
                const index = (sourceIndex + x + y * source.width) * 4
                red += source.data[index+0]
                green += source.data[index+1]
                blue += source.data[index+2]
                alpha += source.data[index+3]
            }

            target.data[targetIndex+0] = round(red / sampleArea)
            target.data[targetIndex+1] = round(green / sampleArea)
            target.data[targetIndex+2] = round(blue / sampleArea)
            target.data[targetIndex+3] = round(alpha / sampleArea)
        }

        return target
    }
}