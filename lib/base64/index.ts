import path from 'path'
import { hash } from '../utilities'

const enum Type {
    TEXT,
    JSON,
    XML,
    IMAGE,
    AUDIO,
    VIDEO
}

const regex: { [key: string]: RegExp } = {
    [Type.JSON]: /\.json$/i,
    [Type.XML]: /\.(fnt|xml|html)$/i,
    [Type.IMAGE]: /\.(png|jpe?g|gif)$/i,
    [Type.AUDIO]: /\.(mp3|ogg|wav)$/i,
    [Type.VIDEO]: /\.(mp4|webm)$/i
}

function encodeBase64(buffer: Buffer, filename: string): string | object {
    const extension = path.extname(filename).slice(1)
    const type: Type = Object.keys(regex).find(type => regex[type].test(filename)) as any || Type.TEXT
    switch(+type){
        case Type.JSON: return JSON.parse(buffer.toString('utf8'))
        case Type.XML: return `data:text/xml;charset=utf-8,${buffer.toString('utf8')}`
        case Type.IMAGE: return `data:image/${extension.replace('jpg', 'jpeg')};base64,${buffer.toString('base64')}`
        case Type.AUDIO: return `data:audio/${extension.replace('mp3', 'mpeg')};base64,${buffer.toString('base64')}`
        case Type.VIDEO: return `data:video/${extension};base64,${buffer.toString('base64')}`
        case Type.TEXT: 
        default: return buffer.toString('utf8')
    }
}

export interface Base64Options {
    prefix: string
    filter(filepath: string): boolean
}

export async function packBase64(
    files: Array<{ filename: string, buffer: Buffer }>,
    base64Options: Partial<Base64Options>
){
    const options: Base64Options = {
        prefix: '[hash]',
        filter: (filepath: string) => true,
        ...base64Options
    }
    const assets: Record<string, string | object> = Object.create(null)
    console.log('\x1b[34m%s\x1b[0m', `Packing base64 assets...`)

    for(let i = files.length - 1; i >= 0; i--){
        const { filename, buffer } = files[i]
        if(!options.filter(filename)) continue
        files.splice(i, 1)

        assets[filename] = encodeBase64(buffer, filename)
    }

    const jsonData = Buffer.from(JSON.stringify(assets, null, 0), 'utf8')
    files.push({
        filename: `${options.prefix}.json`.replace('[hash]', hash(jsonData)),
        buffer: jsonData
    })
}