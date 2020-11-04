interface Rectangle {
    width: number
    height: number
}

interface RegionNode<T> extends Rectangle {
    left: number
    top: number
    rotate?: boolean
    reference?: T
}

export interface BinPackerOptions {
    maxWidth: number
    maxHeight: number
    padding: number
    border: number
    pow2: boolean
    rotate: boolean
    heuristic: (a: Rectangle, b: Rectangle) => number
}

const contains = <T>(a: RegionNode<T>, b: RegionNode<T>): boolean => (
    a.left <= b.left &&
    a.top <= b.top &&
    a.left + a.width >= b.left + b.width &&
    a.top + a.height >= b.top + b.height
)
const overlap = <T>(a: RegionNode<T>, b: RegionNode<T>): boolean => (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
)

const nextPow2 = (value: number) => {
    if(--value <= 0) return 1
    let out = 2
    while(value >>>= 1) out <<= 1
    return out
}

export class BinPacker<T> {
    public static pack<T extends Rectangle>(items: T[], options: Partial<BinPackerOptions>): BinPacker<T>[] {
        items.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height))
        const bins: BinPacker<T>[] = []
        items: for(let i = 0; i < items.length; i++){
            const item = items[i]
            for(let max = bins.length, j = 0; j <= max; j++){
                if(j === max) bins.push(new BinPacker(options))
                if(bins[j].insert(item, item.width, item.height))
                    continue items
            }
            throw new Error(`Image ${item.width}x${item.height} exceeds spritesheet limits!`)
        }
        return bins
    }
    public static readonly area = (a: Rectangle, b: Rectangle) => a.width * a.height - b.width * b.height
    public static readonly side = (a: Rectangle, b: Rectangle) => Math.min(a.width - b.width, a.height - b.height)

    private readonly options: BinPackerOptions
    private readonly emptyNodes: RegionNode<T>[] = []
    public readonly filledNodes: RegionNode<T>[] = []
    public readonly bounds: Rectangle = { width: 0, height: 0 }
    constructor(options: Partial<BinPackerOptions>){
        this.options = {
            maxWidth: 4096, maxHeight: 4096,
            padding: 0, border: 0,
            pow2: false, rotate: false,
            heuristic: BinPacker.side,
            ...options
        }
        this.emptyNodes.push({
            width: this.options.maxWidth - 2 * this.options.border + this.options.padding,
            height: this.options.maxHeight - 2 * this.options.border + this.options.padding,
            left: this.options.border,
            top: this.options.border
        })
    }
    insert(item: T, width: number, height: number): RegionNode<T> | null {
        const node = this.findNode(width + this.options.padding, height + this.options.padding, this.options.rotate)
        if(!node) return null
        node.reference = item
        this.split(node)
        this.prune()
        this.filledNodes.push(node)
        this.bounds.width = Math.max(this.bounds.width, node.left + node.width + this.options.border)
        this.bounds.height = Math.max(this.bounds.height, node.top + node.height + this.options.border)
        if(this.options.pow2) this.bounds.width = nextPow2(this.bounds.width)
        if(this.options.pow2) this.bounds.height = nextPow2(this.bounds.height)
        return node
    }
    private findNode(width: number, height: number, rotate: boolean): RegionNode<T> | undefined {
        let out: RegionNode<T> | undefined, minScore: number = Infinity
        for(let i = 0; i < this.emptyNodes.length; i++){
            const emptyNode = this.emptyNodes[i]
            if(width <= emptyNode.width && height <= emptyNode.height){
                const node: RegionNode<T> = { width, height, left: emptyNode.left, top: emptyNode.top }
                const score: number = this.options.heuristic(emptyNode, node)
                if(score < minScore){
                    minScore = score
                    out = node
                }
            }
            if(rotate && height <= emptyNode.width && width <= emptyNode.height){
                const node: RegionNode<T> = { width: height, height: width, left: emptyNode.left, top: emptyNode.top, rotate: true }
                const score: number = this.options.heuristic(emptyNode, node)
                if(score < minScore){
                    minScore = score
                    out = node
                }
            }
        }
        return out
    }
    private split(node: RegionNode<T>): void {
        for(let i = this.emptyNodes.length - 1; i >= 0; i--){
            const emptyNode = this.emptyNodes[i]
            if(!overlap(emptyNode, node)) continue
            this.emptyNodes.splice(i, 1)

            if(node.top > emptyNode.top) this.emptyNodes.push({
                top: emptyNode.top,
                left: emptyNode.left,
                width: emptyNode.width,
                height: node.top - emptyNode.top
            })
            if(node.top + node.height < emptyNode.top + emptyNode.height) this.emptyNodes.push({
                top: node.top + node.height,
                left: emptyNode.left,
                width: emptyNode.width,
                height: emptyNode.top + emptyNode.height - (node.top + node.height)
            })
            if(node.left > emptyNode.left) this.emptyNodes.push({
                top: emptyNode.top,
                left: emptyNode.left,
                width: node.left - emptyNode.left,
                height: emptyNode.height
            })
            if(node.left + node.width < emptyNode.left + emptyNode.width) this.emptyNodes.push({
                top: emptyNode.top,
                left: node.left + node.width,
                width: emptyNode.left + emptyNode.width - (node.left + node.width),
                height: emptyNode.height
            })

        }
    }
    private prune(): void {
        for(let i = this.emptyNodes.length - 1; i > 0; i--)
        for(let j = i - 1; j >= 0; j--)
            if(contains(this.emptyNodes[j], this.emptyNodes[i])){
                this.emptyNodes.splice(i, 1)
                break
            }else if(contains(this.emptyNodes[i], this.emptyNodes[j])){
                this.emptyNodes.splice(j, 1)
                i--
            }
    }
}