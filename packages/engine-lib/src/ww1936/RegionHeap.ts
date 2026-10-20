// World War 1936 P2 (pre-flight U15): a small binary min-heap of
// (distance, region) pairs for Dijkstra over the region graph. Pairs order
// by distance, then by the smaller region id, so every run settles the
// regions in the same order (determinism). The engine's paths and supply
// and the screens' previews share it.

export class RegionHeap {
  private dist: number[] = [];
  private id: number[] = [];

  get size(): number {
    return this.id.length;
  }

  clear(): void {
    this.dist.length = 0;
    this.id.length = 0;
  }

  push(dist: number, id: number): void {
    const d = this.dist;
    const v = this.id;
    let i = v.length;
    d.push(dist);
    v.push(id);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  /** The smallest pair's distance; Infinity when empty. */
  peekDist(): number {
    return this.id.length === 0 ? Infinity : this.dist[0];
  }

  /** Removes the smallest pair and returns its region (-1 when empty); `lastDist` holds its distance. */
  pop(): number {
    const v = this.id;
    const d = this.dist;
    if (v.length === 0) return -1;
    const top = v[0];
    this.lastDist = d[0];
    const lastD = d.pop()!;
    const lastV = v.pop()!;
    if (v.length > 0) {
      d[0] = lastD;
      v[0] = lastV;
      let i = 0;
      const n = v.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < n && this.less(l, m)) m = l;
        if (r < n && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  /** Distance of the pair the last pop() returned. */
  lastDist = 0;

  private less(a: number, b: number): boolean {
    const da = this.dist[a];
    const db = this.dist[b];
    return da < db || (da === db && this.id[a] < this.id[b]);
  }

  private swap(a: number, b: number): void {
    const d = this.dist;
    const v = this.id;
    const td = d[a];
    d[a] = d[b];
    d[b] = td;
    const tv = v[a];
    v[a] = v[b];
    v[b] = tv;
  }
}
