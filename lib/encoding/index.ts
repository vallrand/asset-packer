import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'
import { quantize, QuantizerOptions } from './Quantizer' 

export type Encoder = (input: PNG & {
    width: number
    height: number
    data: Buffer | Uint8Array | ArrayBuffer
    alpha: boolean
}) => Promise<{
    format: string
    buffer: Buffer
}>

export type Decoder = (input: {
    filename: string
    buffer: Buffer
}) => Promise<{
    width: number
    height: number
    data: Uint8Array
} | undefined>

export type EncoderOptions = QuantizerOptions | Encoder

export const encoder = (options: Partial<EncoderOptions>): Encoder => async function encode(input: Parameters<Encoder>[0]){
    if(typeof options === 'function')
        return (options as Encoder)(input)
    else if(!input.alpha){
        const buffer = jpeg.encode(input, (options as QuantizerOptions)?.quality || 100).data
        return { buffer, format: 'jpg' }
    }else{
        const buffer = await quantize(PNG.sync.write(input), options)
        return { buffer, format: 'png' }
    }
}

export const decode: Decoder = async function({ filename, buffer }: Parameters<Decoder>[0]){
    if(/\.jpe?g$/i.test(filename)){
        const { width, height, data } = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true })
        return { width, height, data }
    }else if(/\.png$/i.test(filename)){
        const { width, height, data } = PNG.sync.read(buffer)
        return { width, height, data }
    }
}