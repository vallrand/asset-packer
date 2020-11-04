# Asset Packer

> **WARNING**: This project is under development. Current use is not recommended!

Asset packing and optimization tools.

### Dependencies

Requires [Node](https://nodejs.org) ver10.17.0

 - [pngjs](https://github.com/lukeapage/pngjs)
 - [jpeg-js](https://github.com/eugeneware/jpeg-js)
 - [pngquant](https://github.com/papandreou/node-pngquant)

## Installation

With [NPM](https://www.npmjs.com/)
```sh
$ npm install --save-dev
```

### API
```javascript
import { processAssets } from 'asset-packer'

processAssets([
    { filename: 'file.ext', buffer: Buffer.from() }
], {
    base64: {
        prefix: '[hash]',
        filter: filename => !/\.png$/i.test(filename)
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
.then(files => {
    //write files
})
```