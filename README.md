# Asset Packer

> **WARNING**: This project is under development. Current use is not recommended!

Asset packing and optimization tools.

### Dependencies

Requires [Node](https://nodejs.org) ver10.17.0

 - [pngjs](https://github.com/lukeapage/pngjs)
 - [jpeg-js](https://github.com/eugeneware/jpeg-js)
 - [pngquant-bin](https://github.com/imagemin/pngquant-bin)
 
Note: `pngquant-bin` might require additional [dependencies](https://github.com/nodejs/node-gyp#option-1)
Linux:
```sh
$ sudo apt-get install libpng-dev
```
Windows:
```sh
$ npm install --global --production windows-build-tools
```
or download [manually](https://support.microsoft.com/en-us/help/2977003/the-latest-supported-visual-c-downloads)

## Installation

With [NPM](https://www.npmjs.com/)
```sh
$ npm install --save-dev @wault/asset-packer
```

### API
```javascript
import { processAssets } from '@wault/asset-packer'

processAssets([
    { filename: 'file.ext', buffer: Buffer.from() }
], {
    base64: {
        prefix: '[hash]',
        filter: filename => !/\.(png|jpg)$/i.test(filename)
    },
    spritesheet: {
        prefix: '[hash]',
        trim: true,
        extrude: false,
        downscale: 1,
        quantize: {
            dithering: false,
            quality: 80,
        },
        group: {
            colors: 4,
            threshold: 4
        },
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