// World War 1936 (ww88 lane X): who keeps what when a peace conference
// opens. Occupied land stays with its occupier and points only buy changes,
// but the map must come out in clean pieces, so a strategic region most of
// which one winner conquered goes to that winner whole, small enclaves go to
// whoever surrounds them, and land the capitulation merely handed to its
// victor is shared out after the conquered land. Pure and integer: the
// engine, the split script and the tests all run this.

/** A strategic region's share a winner needs to take it whole: 2 / 3. */
export const WW_PEACE_GROUP_NUM = 2;
export const WW_PEACE_GROUP_DEN = 3;
/** Victory points that make a region too big to fall as an enclave. */
export const WW_PEACE_BIG_CITY_VP = 10;
/** An enclave has at most this many regions. */
export const WW_PEACE_ENCLAVE_MAX_REGIONS = 3;
/** Bounded passes of the enclave step. */
export const WW_PEACE_ENCLAVE_PASSES = 4;
/** Under this percent of its stake's value a loser is gone. */
export const WW_PEACE_LOSER_MIN_PCT = 10;

export interface AssignRegion {
  readonly region: number;
  /** Its legal owner: one of the conference's losers. */
  readonly loser: number;
  /** The conference's region value. */
  readonly value: number;
  /** Its strategic region; 0: none (a group of its own). */
  readonly group: number;
  /** The winner that conquered it and holds it; 0: no winner did. */
  readonly holder: number;
  /** The victor a capitulation handed it to; 0: it did not come that way. */
  readonly handedTo: number;
  readonly port: boolean;
  /** A capital or a region of WW_PEACE_BIG_CITY_VP or more. */
  readonly keyCity: boolean;
}

export interface AssignWinner {
  readonly id: number;
  readonly wsMilli: number;
}

export interface AssignIn {
  /** The stake, regions ascending. */
  readonly regions: readonly AssignRegion[];
  readonly winners: readonly AssignWinner[];
  /** Land neighbours. */
  neighbours(region: number): readonly number[];
  /** A region's legal owner (the winners' home land). */
  legal(region: number): number;
  /** A loser's capital region while it is legally its own; 0: none. */
  capitalOf(loser: number): number;
}

export interface AssignOut {
  /** [region, winner], regions ascending. */
  assign: [number, number][];
  /** [winner, extra points], winners ascending. */
  comp: [number, number][];
  /** The losers left with nothing, ascending. */
  gone: number[];
}

/** Larger land first; ties: the key city, then war score, then the smaller id. */
function ranked(
  list: readonly AssignRegion[],
  winners: ReadonlyMap<number, AssignWinner>,
): { id: number; held: number }[] {
  const held = new Map<number, number>();
  const key = new Set<number>();
  for (const r of list) {
    if (r.holder === 0 || !winners.has(r.holder)) continue;
    held.set(r.holder, (held.get(r.holder) ?? 0) + r.value);
    if (r.keyCity) key.add(r.holder);
  }
  return [...held]
    .map(([id, h]) => ({ id, held: h }))
    .sort(
      (a, b) =>
        b.held - a.held ||
        Number(key.has(b.id)) - Number(key.has(a.id)) ||
        winners.get(b.id)!.wsMilli - winners.get(a.id)!.wsMilli ||
        a.id - b.id,
    );
}

interface Work {
  inp: AssignIn;
  byId: Map<number, AssignRegion>;
  winners: Map<number, AssignWinner>;
  /** Region → the winner it is assigned to. */
  assign: Map<number, number>;
}

/** Who owns `n` for a neighbour's purposes: assigned land, a winner's home land. */
function ownerOf(w: Work, n: number): number {
  const a = w.assign.get(n);
  if (a !== undefined) return a;
  if (w.byId.has(n)) return 0;
  const l = w.inp.legal(n);
  return w.winners.has(l) ? l : 0;
}

function touches(w: Work, id: number, list: readonly AssignRegion[]): boolean {
  for (const r of list) {
    if (r.port && r.holder === id) return true;
    for (const n of w.inp.neighbours(r.region)) {
      if (w.assign.get(n) === id) return true;
      if (!w.byId.has(n) && w.inp.legal(n) === id) return true;
    }
  }
  return false;
}

interface Group {
  list: AssignRegion[];
  /** The winners by land, the one that may take it first. */
  rank: { id: number; held: number }[];
  /** The winner taking it (0: none). */
  taker: number;
}

function groupsOf(w: Work): Group[] {
  const by = new Map<string, AssignRegion[]>();
  for (const r of w.inp.regions) {
    const k = `${r.loser}:${r.group === 0 ? -r.region : r.group}`;
    const g = by.get(k);
    if (g === undefined) by.set(k, [r]);
    else g.push(r);
  }
  return [...by.values()]
    .sort((a, b) => a[0].region - b[0].region)
    .map((list) => ({
      list,
      rank: ranked(list, w.winners),
      taker: 0,
    }));
}

function dominated(g: Group): boolean {
  let total = 0;
  for (const r of g.list) total += r.value;
  const top = g.rank[0];
  return (
    top !== undefined &&
    top.held * WW_PEACE_GROUP_DEN >= total * WW_PEACE_GROUP_NUM
  );
}

function stayWithHolders(w: Work, g: Group): void {
  for (const r of g.list) {
    if (r.holder === 0 || !w.winners.has(r.holder)) continue;
    w.assign.set(r.region, r.holder);
  }
}

function takeGroup(w: Work, g: Group, id: number): void {
  g.taker = id;
  for (const r of g.list) {
    if (r.holder === 0 || !w.winners.has(r.holder)) continue;
    w.assign.set(r.region, id);
  }
}

/** Step 1: the strategic regions, the connection rule read over what is assigned so far. */
function assignGroups(w: Work, groups: readonly Group[]): void {
  const pending: Group[] = [];
  for (const g of groups) {
    if (dominated(g)) pending.push(g);
    else stayWithHolders(w, g);
  }
  for (let more = pending.length > 0; more; ) {
    more = false;
    // The first holder wherever it connects; only then the next in line.
    for (const g of [...pending]) {
      if (!touches(w, g.rank[0].id, g.list)) continue;
      takeGroup(w, g, g.rank[0].id);
      pending.splice(pending.indexOf(g), 1);
      more = true;
    }
    if (more) continue;
    for (const g of pending) {
      const next = g.rank.slice(1).find((x) => touches(w, x.id, g.list));
      if (next === undefined) continue;
      takeGroup(w, g, next.id);
      pending.splice(pending.indexOf(g), 1);
      more = true;
      break;
    }
  }
  for (const g of pending) stayWithHolders(w, g);
}

/** Who has most land next to `list`; 0: nobody. Ties: war score, then the smaller id. */
function bestNeighbour(w: Work, list: readonly AssignRegion[]): number {
  const inside = new Set(list.map((r) => r.region));
  const score = new Map<number, number>();
  for (const r of list) {
    for (const n of w.inp.neighbours(r.region)) {
      if (inside.has(n)) continue;
      const o = ownerOf(w, n);
      if (o !== 0) score.set(o, (score.get(o) ?? 0) + 1);
    }
  }
  let best = 0;
  let bestN = 0;
  for (const [id, n] of [...score].sort((a, b) => a[0] - b[0])) {
    const better =
      n > bestN ||
      (n === bestN &&
        w.winners.get(id)!.wsMilli > w.winners.get(best)!.wsMilli);
    if (better) {
      best = id;
      bestN = n;
    }
  }
  return best;
}

/**
 * Step 2 (coordinator's correction): hand-over land after the conquered
 * land, to the winner taking its group; else, group by group, spreading
 * from the conquered land, to the neighbour with most land next to it; the
 * victor it was handed to only as a last resort.
 */
function assignHandedOver(w: Work, groups: readonly Group[]): void {
  const set = (r: AssignRegion, id: number) => {
    if (w.winners.has(id)) w.assign.set(r.region, id);
  };
  let open: AssignRegion[][] = [];
  for (const g of groups) {
    const handed = g.list.filter((r) => r.handedTo !== 0);
    if (handed.length === 0) continue;
    if (g.taker !== 0) for (const r of handed) set(r, g.taker);
    else open.push(handed);
  }
  for (let more = open.length > 0; more; ) {
    more = false;
    const picks = open.map((list) => bestNeighbour(w, list));
    const rest: AssignRegion[][] = [];
    open.forEach((list, i) => {
      if (picks[i] === 0) {
        rest.push(list);
        return;
      }
      for (const r of list) set(r, picks[i]);
      more = true;
    });
    open = rest;
  }
  for (const list of open) for (const r of list) set(r, r.handedTo);
}

/** The connected pieces of `id`'s assigned land, smallest value first (ties: smallest region). */
function piecesOf(w: Work): { id: number; regions: number[]; value: number }[] {
  const seen = new Set<number>();
  const out: { id: number; regions: number[]; value: number }[] = [];
  for (const start of [...w.assign.keys()].sort((a, b) => a - b)) {
    if (seen.has(start)) continue;
    const id = w.assign.get(start)!;
    seen.add(start);
    const q = [start];
    let value = 0;
    for (let h = 0; h < q.length; h++) {
      value += w.byId.get(q[h])?.value ?? 0;
      for (const n of w.inp.neighbours(q[h])) {
        if (seen.has(n) || w.assign.get(n) !== id) continue;
        seen.add(n);
        q.push(n);
      }
    }
    out.push({ id, regions: q.sort((a, b) => a - b), value });
  }
  return out.sort((a, b) => a.value - b.value || a.regions[0] - b.regions[0]);
}

/** The winner wholly around `regions`, with assigned land among it; 0: none. */
function surrounder(w: Work, id: number, regions: readonly number[]): number {
  const inside = new Set(regions);
  let by = 0;
  let assigned = false;
  for (const r of regions) {
    for (const n of w.inp.neighbours(r)) {
      if (inside.has(n)) continue;
      const a = w.assign.get(n);
      const o = a ?? (w.byId.has(n) ? 0 : w.inp.legal(n));
      if (o === 0 || o === id || !w.winners.has(o)) return 0;
      if (by !== 0 && o !== by) return 0;
      by = o;
      assigned ||= a !== undefined;
    }
  }
  return assigned ? by : 0;
}

/** Step 3: small pieces wholly inside another winner's land go to it. */
function dropEnclaves(w: Work): void {
  for (let pass = 0; pass < WW_PEACE_ENCLAVE_PASSES; pass++) {
    let moved = false;
    for (const p of piecesOf(w)) {
      if (p.regions.length > WW_PEACE_ENCLAVE_MAX_REGIONS) continue;
      if (p.regions.some((r) => w.byId.get(r)?.keyCity === true)) continue;
      if (p.regions.some((r) => w.assign.get(r) !== p.id)) continue;
      const by = surrounder(w, p.id, p.regions);
      if (by === 0) continue;
      for (const r of p.regions) w.assign.set(r, by);
      moved = true;
    }
    if (!moved) return;
  }
}

/** A list's connected pieces, by its smallest region. */
function connected(w: Work, list: readonly AssignRegion[]): AssignRegion[][] {
  const left = new Map(list.map((r) => [r.region, r]));
  const out: AssignRegion[][] = [];
  for (const r of list) {
    if (!left.has(r.region)) continue;
    left.delete(r.region);
    const q = [r];
    for (let h = 0; h < q.length; h++) {
      for (const n of w.inp.neighbours(q[h].region)) {
        const x = left.get(n);
        if (x === undefined) continue;
        left.delete(n);
        q.push(x);
      }
    }
    out.push(q);
  }
  return out;
}

/**
 * Who takes the last regions of a gone loser: the winner next to them holding
 * the most of it, else the winner holding the most of it; 0: no winner at all.
 */
function heir(w: Work, loser: number, piece: readonly AssignRegion[]): number {
  const inside = new Set(piece.map((r) => r.region));
  const holds = new Map<number, number>();
  for (const r of w.inp.regions) {
    if (r.loser !== loser) continue;
    const a = w.assign.get(r.region);
    if (a !== undefined) holds.set(a, (holds.get(a) ?? 0) + r.value);
  }
  const near = new Set<number>();
  for (const r of piece) {
    for (const n of w.inp.neighbours(r.region)) {
      if (inside.has(n)) continue;
      const o = w.assign.get(n) ?? (w.byId.has(n) ? 0 : w.inp.legal(n));
      if (w.winners.has(o)) near.add(o);
    }
  }
  const order = (ids: readonly number[]) =>
    [...ids].sort(
      (a, b) =>
        (holds.get(b) ?? 0) - (holds.get(a) ?? 0) ||
        w.winners.get(b)!.wsMilli - w.winners.get(a)!.wsMilli ||
        a - b,
    );
  return (
    order([...near])[0] ??
    order([...holds.keys()])[0] ??
    order([...w.winners.keys()])[0] ??
    0
  );
}

export interface LoserRules {
  /** Losers that stay whatever they keep (a puppet's, one a winner frees, one that asked for terms). */
  safe?: ReadonlySet<number>;
  /** Regions spoken for by a demand: they are neither left nor assigned. */
  bought?: ReadonlySet<number>;
}

/**
 * Step 4: a loser with no capital left, or under WW_PEACE_LOSER_MIN_PCT of
 * its stake's value, is gone; its last regions go to the adjacent winner
 * holding the most of it. `assign` gets the new rows; the gone come back,
 * ascending.
 */
export function settleLosers(
  inp: AssignIn,
  assign: Map<number, number>,
  rules: LoserRules = {},
): number[] {
  const winners = new Map(inp.winners.map((x) => [x.id, x]));
  const byId = new Map(inp.regions.map((r) => [r.region, r]));
  const w: Work = { inp, byId, winners, assign };
  const losers = [...new Set(inp.regions.map((r) => r.loser))].sort(
    (a, b) => a - b,
  );
  const gone: number[] = [];
  for (const L of losers) {
    if (rules.safe?.has(L) === true) continue;
    const mine = inp.regions.filter((r) => r.loser === L);
    const left = mine.filter(
      (r) => !assign.has(r.region) && rules.bought?.has(r.region) !== true,
    );
    let total = 0;
    for (const r of mine) total += r.value;
    let kept = 0;
    for (const r of left) kept += r.value;
    const cap = inp.capitalOf(L);
    const hasCapital = cap === 0 || left.some((r) => r.region === cap);
    if (
      left.length > 0 &&
      hasCapital &&
      kept * 100 >= total * WW_PEACE_LOSER_MIN_PCT
    ) {
      continue;
    }
    for (const piece of connected(w, left)) {
      const to = heir(w, L, piece);
      if (to === 0) continue;
      for (const r of piece) assign.set(r.region, to);
    }
    if (left.every((r) => assign.has(r.region))) gone.push(L);
  }
  return gone;
}

/** The whole assignment of a conference at its opening. */
export function peaceAssignment(
  inp: AssignIn,
  rules: LoserRules = {},
): AssignOut {
  const w: Work = {
    inp,
    byId: new Map(inp.regions.map((r) => [r.region, r])),
    winners: new Map(inp.winners.map((x) => [x.id, x])),
    assign: new Map(),
  };
  const groups = groupsOf(w);
  assignGroups(w, groups);
  assignHandedOver(w, groups);
  dropEnclaves(w);
  // Compensation: only for conquered land, and before the losers' last
  // regions, which no winner held.
  const comp = new Map<number, number>();
  for (const r of inp.regions) {
    const to = w.assign.get(r.region);
    if (to === undefined || r.holder === 0 || r.holder === to) continue;
    if (!w.winners.has(r.holder)) continue;
    comp.set(r.holder, (comp.get(r.holder) ?? 0) + r.value);
  }
  const gone = settleLosers(inp, w.assign, rules);
  return {
    assign: [...w.assign].sort((a, b) => a[0] - b[0]),
    comp: [...comp].sort((a, b) => a[0] - b[0]),
    gone,
  };
}
