import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Stream, Readable, Writable } from 'stream'

export const streamToPromise = (stream: Stream | Writable, buffer?: Buffer): Promise<Buffer> => new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    if(buffer) stream = Readable.from(buffer).pipe(stream as Writable)
    stream
    .on('error', reject)
    .on('data', chunk => chunks.push(chunk))
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