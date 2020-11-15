import { Bitmap } from './Bitmap'

export class Exporter {
    private readonly spriteMap: Record<string, any> = Object.create(null)
    constructor(public filename: string, private spritesheet: Bitmap){}
    insert(sprite: Bitmap, x: number, y: number, rotate: boolean){
        const left = Math.max(0, sprite.frame.x)
        const top = Math.max(0, sprite.frame.y)
        const right = Math.min(sprite.frame.x + sprite.frame.width, rotate ? sprite.height : sprite.width)
        const bottom = Math.min(sprite.frame.y + sprite.frame.height, rotate ? sprite.width : sprite.height)

        this.spriteMap[sprite.filename] = {
            frame: {
                x: x + left,
                y: y + top,
                w: right - left,
                h: bottom - top
            },
            rotated: rotate,
            trimmed: true,
            spriteSourceSize: {
                x: left - sprite.frame.x,
                y: top - sprite.frame.y,
                width: right - left,
                height: bottom - top
            },
            sourceSize: {
                w: sprite.size.width,
                h: sprite.size.height
            },
            pivot: { x: 0.5, y: 0.5 }
        }
    }
    write(): Buffer {
        return Buffer.from(JSON.stringify({
            frames: this.spriteMap,
            meta: {
                image: this.spritesheet.filename,
                format: 'RGBA8888',
                size: { w: this.spritesheet.width, h: this.spritesheet.height },
                scale: 1
            }
        }, null, 0), 'utf8')
    }
}