import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'
const PngQuant = require('pngquant')

import { streamToPromise, hash } from '../utilities'
import { Bitmap } from './Bitmap'
import { Exporter } from './Exporter'
import { BinPacker, BinPackerOptions } from './BinPacker'

export interface SpritesheetOptions {
    prefix: string
    trim: boolean
    extrude: boolean
    downscale: number
    pack: Partial<BinPackerOptions>
    quality: [number, number]
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
        pack: {},
        quality: [60, 80],
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
    const bins: BinPacker<Bitmap>[] = BinPacker.pack(sprites, options.pack)
    for(let i = 0; i < bins.length; i++){
        const { bounds, filledNodes } = bins[i]
        console.log('\x1b[34m%s\x1b[0m', `Rendering spritesheet ${i+1}/${bins.length}...`)

        const bitmapData = new PNG({ ...bounds })
        const spritesheet = new Bitmap(`${options.prefix}.png`, bounds.width, bounds.height, bitmapData.data)
        const exporter = new Exporter(`${options.prefix}.json`, spritesheet)
        for(let { left, top, rotate, reference } of filledNodes){
            reference = rotate ? Bitmap.rotate(reference as Bitmap) : reference as Bitmap
            Bitmap.copy(reference, spritesheet, left, top, 0, 0, reference.width, reference.height)
            if(options.extrude) Bitmap.extrude(spritesheet, options.pack.padding || 0, left, top, reference.width, reference.height)
            exporter.insert(reference, left, top, !!rotate)
        }

        const imageData = await streamToPromise(new PngQuant([
            256,
            '--quality', options.quality.join('-'),
            '--nofs',
            '--strip'
        ]))(PNG.sync.write(bitmapData))
        files.push({
            filename: spritesheet.filename = spritesheet.filename.replace('[hash]', hash(imageData)),
            buffer: imageData
        })
        const jsonData = exporter.write()
        files.push({
            filename: exporter.filename = exporter.filename.replace('[hash]', hash(jsonData)),
            buffer: jsonData
        })
    }
}