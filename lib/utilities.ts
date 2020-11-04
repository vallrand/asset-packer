import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Readable } from 'stream'

export const streamToPromise = (stream: NodeJS.WritableStream) =>
(buffer: Buffer): Promise<Buffer> => new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    Readable.from(buffer)
    .pipe(stream)
    .on('data', chunk => chunks.push(chunk))
    .on('error', reject)
    .on('end', () => resolve(Buffer.concat(chunks)))
})

export async function listFiles(directory: string): Promise<string[]> {
    const list: string[] = []
    const files = await fs.readdir(directory, { withFileTypes: true, encoding: 'utf8' })
    for(let file of files){
		const filepath = path.resolve(directory, file.name)
		if(!file.isDirectory())
			list.push(filepath)
		else{
			const sublist = await listFiles(filepath)
			list.push(...sublist)
		}
	}
    return list
}

export const hash = (data: Buffer): string =>
crypto.createHash('sha256')
.update(data)
.digest('hex')
.slice(0, 20)