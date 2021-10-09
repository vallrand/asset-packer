import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'

import { hash } from '../utilities'
import { Bitmap } from './Bitmap'
import { Palette } from './Palette'
import { Exporter } from './Exporter'
import { quantize, QuantizerOptions } from './Quantizer' 
import { BinPacker, BinPackerOptions } from './BinPacker'

export interface SpritesheetOptions {
    prefix: string
    trim: boolean
    extrude: boolean
    downscale: number
    pack: Partial<BinPackerOptions>
    quantize: Partial<QuantizerOptions>
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
    spritesheetOptions: Partial<SpritesheetOptions>
){
    const options: SpritesheetOptions = {
        prefix: '[hash]',
        trim: true,
        extrude: false,
        downscale: 1,
        group: { colors: 4, threshold: 0.8, diminish: 0, opaque: 0 },
        quantize: {},
        pack: {},
        ...spritesheetOptions
    }
    console.log('\x1b[34m%s\x1b[0m', `Decoding images...`)
    const sprites: Bitmap[] = []
    for(let i = files.length - 1; i >= 0; i--){
        const { filename, buffer } = files[i]
        if(/\.jpe?g$/i.test(filename)){
            files.splice(i, 1)
            const { width, height, data } = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true })
            sprites.push(new Bitmap(filename, width, height, data))
        }else if(/\.png$/i.test(filename)){
            files.splice(i, 1)
            const { width, height, data } = PNG.sync.read(buffer)
            sprites.push(new Bitmap(filename, width, height, data))
        }
    }
    console.log('\x1b[34m%s\x1b[0m', `Processing ${sprites.length} images...`)
    for(let i = 0; i < sprites.length; i++){
        if(options.downscale < 1) sprites[i] = Bitmap.downsample(
            sprites[i],
            Math.floor(sprites[i].width * options.downscale),
            Math.floor(sprites[i].height * options.downscale)
        )
        if(options.trim) sprites[i] = Bitmap.trim(sprites[i], 0)
    }
    console.log('\x1b[34m%s\x1b[0m', `Packing sprites...`)
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
        console.log('\x1b[34m%s\x1b[0m', `Rendering spritesheet ${i+1}/${bins.length}...`)

        const bitmapData = new PNG({ ...bounds })
        const extension = filledNodes.some(node => !node.reference!.opaque) ? 'png' : 'jpg'
        const spritesheet = new Bitmap(`${options.prefix}.${extension}`, bounds.width, bounds.height, bitmapData.data)
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

        const imageData = extension === 'png'
        ? await quantize(PNG.sync.write(bitmapData), options.quantize)
        : jpeg.encode(bitmapData, options.quantize.quality || 100).data

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