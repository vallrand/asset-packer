const enum NodeState {
    UNDISCOVERED,
    DISCOVERED,
    COMPLETED
}

type BasisEntry = {
    row: number
    column: number
    flow: number
    adjacency?: AdjacentNode;
    current?: AdjacentNode;
    prev?: BasisEntry;
    state: NodeState
}

type AdjacentNode = {
    entry: BasisEntry;
    next?: AdjacentNode;
}

//compute the Earth Mover's Distance (or Wasserstein) metric.
export class EarthMoverDistance {
    private static EPSILON = 1e-12
    private basis: BasisEntry[] = Array(this.countU + this.countV)
    private dualU: number[] = Array(this.countU)
    private dualV: number[] = Array(this.countV)
    private visitedU: boolean[] = Array(this.countU)
    private visitedV: boolean[] = Array(this.countV)
    constructor(
        private countU: number, private countV: number,
        private measureDistance: (u: number, v: number) => number
    ){}
    public computeMetric(weightsU: number[], weightsV: number[], flows?: number[][]): number {
        this.dualV.fill(0)
        this.dualV.fill(0)
        this.initializeFlow(weightsU, weightsV)
        while(true){
            this.visitedU.fill(false)
            this.visitedV.fill(false)
            this.resetAdjacency(this.basis.length - 1)
            let adjacent, node = this.basis[0]
            this.dualU[node.row] = 0
            this.visitedU[node.row] = true
            while(true){
                node.state = NodeState.DISCOVERED
                if(this.visitedU[node.row]){
                    this.dualV[node.column] = this.measureDistance(node.row, node.column) - this.dualU[node.row]
                    this.visitedV[node.column] = true
                }else if(this.visitedV[node.column]){
                    this.dualU[node.row] = this.measureDistance(node.row, node.column) - this.dualV[node.column]
                    this.visitedU[node.row] = true
                }else throw new Error('Node not adjacent')
                for(adjacent = node.current; adjacent != null; adjacent = adjacent.next)
                    if(adjacent.entry.state == NodeState.UNDISCOVERED) break
                if(adjacent == null){
                    node.state = NodeState.COMPLETED
                    node = node.prev!!
                    if(node == null) break
                }else{
                    node.current = adjacent.next
                    adjacent.entry.prev = node
                    node = adjacent.entry
                }    
            }
            const root = this.validateOptimality()
            if(root == null) break
            this.resetAdjacency(this.basis.length)
            node = root
            cycles: while(true){
                node.state = NodeState.DISCOVERED
                for(adjacent = node.current; adjacent != null; adjacent = adjacent.next){
                    if(node.prev != null && (node.prev.row == adjacent.entry.row || node.prev.column == adjacent.entry.column))
                        continue
                    if(adjacent.entry == root) break
                    if(adjacent.entry.state == NodeState.UNDISCOVERED) break
                }
                if(adjacent == null){
                    node.state = NodeState.COMPLETED
                    node = node.prev!!
                    if(node == null) throw new Error('Cycle not found')
                }else if(adjacent.entry.state == NodeState.DISCOVERED){
                    root.prev = node
                    break
                }else{
                    node.current = adjacent.next
                    adjacent.entry.prev = node
                    node = adjacent.entry
                }
            }
            let remove = null, minFlow = 0
            for(let node = root.prev, sign=-1; node != root; sign^=-2, node = node.prev!!)
                if(sign < 0 && (remove == null || node.flow < minFlow)){
                    minFlow = node.flow
                    remove = node
                }
            root.flow = minFlow
            for(let node = root.prev, sign=-1; node != root; sign^=-2, node = node.prev!!)
                node.flow += sign * minFlow
            if(remove == null) throw new Error('Largest flow not found')
            this.remove(this.basis.length - 1, remove!!)
        }
        let distance = 0
        for(let i = this.basis.length - 2; i >= 0; i--)
        distance += this.basis[i].flow * this.measureDistance(this.basis[i].row, this.basis[i].column)
        if(flows != null){
            for(let u = 0; u < this.countU; u++) flows[u] = Array(this.countV).fill(0)
            for(let i = 0; i < this.basis.length - 1; i++) flows[this.basis[i].row][this.basis[i].column] = this.basis[i].flow
        }
        return distance
    }
    //Northwest Corner Rule
    private initializeFlow(weightsU: number[], weightsV: number[]){
        for(let u = 0, v = 0, i = 0; true;)
        if(u == this.countU - 1){
            for(; v < this.countV; v++) this.insert(i++, u, v, weightsV[v])
            break
        }else if(v == this.countV - 1){
            for(; u < this.countU; u++) this.insert(i++, u, v, weightsU[u])
            break
        }else if(weightsU[u] <= weightsV[v]){
            this.insert(i++, u, v, weightsU[u])
            weightsV[v] -= weightsU[u++]
        }else{
            this.insert(i++, u, v, weightsV[v])
            weightsU[u] -= weightsV[v++]
        }
    }
    private insert(index: number, row: number, column: number, flow: number): BasisEntry {
        const entry: BasisEntry = {
            row, column, flow,
            state: NodeState.UNDISCOVERED
        }
        for(let i = 0; i < index; i++)
        if(this.basis[i].row == row || this.basis[i].column == column){
            this.basis[i].adjacency = {
                entry: entry,
                next: this.basis[i].adjacency
            }
            entry.adjacency = {
                entry: this.basis[i],
                next: entry.adjacency
            }
        }
        return this.basis[index] = entry
    }
    private remove(index: number, entry: BasisEntry){
        for(let root = entry.adjacency; root != null; root = root.next)
            for(let last, next = root.entry.adjacency; next != null; last = next, next = next.next)
                if(next.entry == entry){
                    if(last == null) root.entry.adjacency = next.next
                    else last.next = next.next
                    break
                }
        const i = this.basis.indexOf(entry)
        this.basis[i] = this.basis[index]
    }
    private resetAdjacency(size: number){
        for(let i = 0; i < size; i++){
            this.basis[i].current = this.basis[i].adjacency
            this.basis[i].prev = undefined
            this.basis[i].state = NodeState.UNDISCOVERED
        }
    }
    private validateOptimality(): BasisEntry | null {
        let minColumn = -1, minRow = -1, minDelta = 0
        for(let u = 0; u < this.countU; u++)
        for(let v = 0; v < this.countV; v++){
            let delta = this.measureDistance(u, v) - this.dualU[u] - this.dualV[v]
            if(minColumn != -1 && minDelta >= delta) continue
            minDelta = delta
            minRow = u
            minColumn = v
        }
        for(let i = 0; i < this.basis.length - 1; i++)
        if(this.basis[i].column == minColumn && this.basis[i].row == minRow){
            minDelta = 0
            break
        }        
        return minDelta >= -EarthMoverDistance.EPSILON ? null : this.insert(this.basis.length - 1, minRow, minColumn, 0)
    }
}