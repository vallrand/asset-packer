import { packBase64, Base64Options } from './base64'
import { generateSpritesheet, SpritesheetOptions } from './spritesheet'
import { encoder, decode, EncoderOptions } from './encoding'
import { listFiles, hash } from './utilities'

export async function processAssets(
    files: Array<{ filename: string, buffer: Buffer }>,
    options: {
        logger?: boolean | ((message: string) => void)
        spritesheet: Partial<SpritesheetOptions>
        encoder: Partial<EncoderOptions>
        base64: Partial<Base64Options>
    }
): Promise<Array<{ filename: string, buffer: Buffer }>>{
    files = files.slice()
    const logger = typeof options.logger === 'function'
        ? options.logger
        : options.logger && ((message: string) => console.log('\x1b[34m%s\x1b[0m', message)) || undefined
    const encode = encoder(options.encoder)
    await generateSpritesheet(files, options.spritesheet, decode, encode, logger)
    await packBase64(files, options.base64, logger)
    return files
}