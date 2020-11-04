import { promises as fs } from 'fs'
import path from 'path'
import { listFiles } from './utilities'
import { processAssets } from './index'

module.exports = (async function(source?: string, destination?: string){
    const basepath = process.cwd() || __dirname
    const sourceDirectory = path.resolve(basepath, source || './')
    const destinationDirectory = path.resolve(basepath, destination || './')

    const filenames = await listFiles(sourceDirectory)
    const files = await Promise.all(filenames.map(async filename => {
        const buffer: Buffer = await fs.readFile(filename, null)
        return {
            buffer,
            filename: path.relative(sourceDirectory, filename).replace(/\\/g, '/')
        }
    }))
    console.log('\x1b[34m%s\x1b[0m', `Processing ${files.length} files...`)
    const outputFiles = await processAssets(files, {
        base64: {
            prefix: '[hash]',
            filter: (filename: string) => !/\.png$/i.test(filename)
        },
        spritesheet: {
            prefix: '[hash]',
            trim: true,
            extrude: 0,
            scale: 1,
            quality: [60, 80],
            pack: {
                maxWidth: 2048,
                maxHeight: 2048,
                padding: 0,
                border: 0,
                pow2: true,
                rotate: true
            }
        }
    })

    for(const { filename, buffer } of outputFiles){
        const filepath = path.resolve(destinationDirectory, filename)
        console.log('\x1b[34m%s\x1b[0m', `Writing ${filepath}`)
        await fs.writeFile(filepath, buffer)
    }

    console.log('\x1b[32m%s\x1b[0m', 'Done')
})(...process.argv.slice(2))