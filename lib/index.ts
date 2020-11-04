import { packBase64, Base64Options } from './base64'
import { generateSpritesheet, SpritesheetOptions } from './spritesheet'
import { listFiles, hash } from './utilities'

export async function processAssets(
    files: Array<{ filename: string, buffer: Buffer }>,
    options: { spritesheet: Partial<SpritesheetOptions>, base64: Partial<Base64Options> }
): Promise<Array<{ filename: string, buffer: Buffer }>>{
    files = files.slice()
    await generateSpritesheet(files, options.spritesheet)
    await packBase64(files, options.base64)
    return files
}