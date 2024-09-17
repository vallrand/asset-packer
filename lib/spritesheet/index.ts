import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'

import { hash } from '../utilities'
import { Encoder, Decoder } from '../encoding'
import { Bitmap } from './Bitmap'
import { Palette } from './Palette'
import { Exporter } from './Exporter'
import { BinPacker, BinPackerOptions } from './BinPacker'

export interface SpritesheetOptions {
    prefix: string
    trim: boolean
    extrude: boolean
    downscale: number
    pack: Partial<BinPackerOptions>
    group: {
        colors: number
        threshold: number
        diminish: number
        opaque: number
        algorithm?: number
    }
}

export async function generateSpritesheet(
    files: Array<{ filename: string, buffer: Buffer }>,
    spritesheetOptions: Partial<SpritesheetOptions>,
    decoder: Decoder,
    encoder: Encoder,
    logger?: (message: string) => void
){
    const options: SpritesheetOptions = {
        prefix: '[hash]',
        trim: true,
        extrude: false,
        downscale: 1,
        group: { colors: 4, threshold: 0.8, diminish: 0, opaque: 0 },
        pack: {},
        ...spritesheetOptions
    }
    if(logger) logger(`Decoding images...`)
    const sprites: Bitmap[] = []
    for(let i = files.length - 1; i >= 0; i--){
        const { filename, buffer } = files[i]
        const decoded = await decoder({ buffer, filename })
        if(!decoded) continue
        files.splice(i, 1)
        sprites.push(new Bitmap(filename, decoded.width, decoded.height, decoded.data))
    }
    if(logger) logger(`Processing ${sprites.length} images...`)
    for(let i = 0; i < sprites.length; i++){
        if(options.downscale < 1) sprites[i] = Bitmap.downsample(
            sprites[i],
            Math.floor(sprites[i].width * options.downscale),
            Math.floor(sprites[i].height * options.downscale)
        )
        if(options.trim) sprites[i] = Bitmap.trim(sprites[i], 0)
    }
    if(logger) logger(`Packing sprites...`)
    const palettes: Palette[] = sprites.map(sprite => Palette.quantize(sprite.data, { colors: options.group.colors }))
    const distanceHeuristic = [Palette.wassersteinDistance, Palette.weightedIntersection][options.group.algorithm || 0]
    const bins: BinPacker<Bitmap>[] = BinPacker.pack(sprites, options.pack,
    function(item: Bitmap, index: number, group?: Bitmap[]): number {
        if(!group) return Math.max(1, options.group.diminish * index) * options.group.threshold || 0
        const opaque = group.some(node => node.opaque !== item.opaque) && options.group.opaque || 0
        const palette = palettes[sprites.indexOf(item)]
        const subpalettes = group.map(item => palettes[sprites.indexOf(item)])
        return opaque + subpalettes
        .map(subpalette => distanceHeuristic(palette, subpalette))
        .reduce((min, distance) => Math.min(min, distance), Infinity)
    })
    for(let i = 0; i < bins.length; i++){
        const { bounds, filledNodes } = bins[i]
        if(logger) logger(`Rendering spritesheet ${i+1}/${bins.length}...`)

        const bitmapData = new PNG({ ...bounds })
        const alpha = filledNodes.some(node => !node.reference!.opaque)
        const spritesheet = new Bitmap(`${options.prefix}.[format]`, bounds.width, bounds.height, bitmapData.data)
        const exporter = new Exporter(`${options.prefix}.json`, spritesheet)
        for(let { left, top, rotate, reference } of filledNodes){
            reference = rotate ? Bitmap.rotate(reference!) : reference!
            Bitmap.copy(reference, spritesheet, left, top, 0, 0, reference.width, reference.height)
            if(options.extrude) Bitmap.extrude(
                spritesheet, options.pack.padding || 0,
                left, top, reference.width, reference.height,
                reference!.trimmed
            )
            exporter.insert(reference, left, top, !!rotate)
        }
        
        const { buffer: imageData, format } = await encoder(Object.assign(bitmapData, { alpha }))
        spritesheet.filename = spritesheet.filename.replace('[format]', format)

        files.push({
            filename: spritesheet.filename = spritesheet.filename.replace('[hash]', hash(imageData)),
            buffer: imageData
        })
        const jsonData = exporter.write(options.downscale)
        files.push({
            filename: exporter.filename = exporter.filename.replace('[hash]', hash(jsonData)),
            buffer: jsonData
        })
    }
}