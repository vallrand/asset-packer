import { spawn } from 'child_process'
const pngquant = require('pngquant-bin')
import { streamToPromise } from '../utilities'

export interface QuantizerOptions {
    colors: number
    quality: number
    dithering: number | false
    speed: number
    posterize: number
}

export const quantize = (buffer: Buffer, options: Partial<QuantizerOptions>): Promise<Buffer> =>
new Promise((resolve, reject) => {
    const args: string[] = []
    args.push('--strip')
    args.push('--speed', String(options.speed || 1))
    if(options.quality) args.push('--quality', `${0}-${options.quality}`)
    if(options.dithering === false) args.push('--ordered')
    else if(options.dithering) args.push(`--floyd=${options.dithering}`)
    if(options.posterize) args.push('--posterize', String(options.posterize))
    args.push(String(options.colors || 256))
    //args.push('--verbose')
    args.push('-')

    const subprocess = spawn(pngquant, args, {
        windowsHide: true,
        detached: false
    })
    .once('error', reject)
    .once('exit', exitCode => exitCode! > 0 && reject(new Error(`Program terminated with code: ${exitCode}`)))

    function handleError(error: any){
        subprocess.kill()
        reject(error)
    }

    streamToPromise(subprocess.stdout)
    .then(resolve)
    .catch(handleError)
    streamToPromise(subprocess.stderr)
    .then(chunk => chunk.length && handleError(new Error(chunk.toString('ascii'))))
    .catch(handleError)
    streamToPromise(subprocess.stdin, buffer)
    .catch(handleError)
})