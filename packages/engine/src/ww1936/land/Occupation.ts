// World War 1936 P2: occupation and the tile spread (P2 spec §7.7, §9.6,
// §9.7, §12). A region's control changes at once (with its victory-point
// tile, WwLand.setController); its other tiles follow by the spread, at
// most WW_SPREAD_TILES_PER_TICK a tick over all regions. Tile orders are
// derived (WwLand.spreadOrders), built from Spread.sources only when a
// spread gets budget (pre-flight C2).
import {
  MOVE_ADVANCE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  MOVE_WALK,
  WW_SPREAD_BATTLE_PM,
  WW_SPREAD_DAY_PM,
  WW_SPREAD_TILES_PER_TICK,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { Player } from "../../game/Game";
import { closeBattle, leaveBattle, refugeOf, retreatDivision } from "./Battles";
import { stopDivision } from "./Movement";
import { disbandDivision } from "./Sustain";
import {
  SPREAD_CAPITULATION,
  SPREAD_CAPTURE,
  type Spread,
  type WwLand,
} from "./WwLand";

/** Spec §7.7, §9.6, §9.7, §12.1: `by` takes `region` now. */
export function capture(
  land: WwLand,
  region: number,
  by: number,
  tick: number,
): void {
  const sources = land.scenario
    .edgesOf(region)
    .map((e) => e.to)
    .filter((n) => land.controller[n] === by);
  land.setController(region, by, tick); // the victory-point tile goes with it
  evict(land, region, by);
  closeBattle(land, region);
  const old = land.spreads.get(region);
  land.setSpread({
    region,
    by,
    kind: SPREAD_CAPTURE,
    sources: old !== undefined && old.by === by ? old.sources : sources,
    done: old !== undefined && old.by === by ? old.done : 0,
    dayBase: 0,
    dayNo: -1,
  });
  if (old !== undefined && old.by !== by) land.spreadOrders.delete(region);
}

/**
 * The divisions left in `region` as `by` takes it (a division at sea has
 * left its port already and sails on). Spec §9.6 overrun: an enemy of `by`
 * halfway or less through its retreat, broken (org under a tenth) and not
 * leaving R, or with nowhere to go is destroyed; one retreating or walking
 * out goes on, the rest retreat. Spec §9.1: one not at war with `by` is
 * pushed to its side's nearest region (or disbanded when it has none).
 */
function evict(land: WwLand, region: number, by: number): void {
  const t = land.divisions;
  const destroyed = new Map<number, number>();
  for (const r of [...land.rowsIn(region)]) {
    const o = t.owner[r];
    if (t.id[r] === 0 || land.sameSide(o, by)) continue;
    if (t.mode[r] === MOVE_SEA) continue;
    if (land.isEnemy(o, by)) {
      const m = t.mode[r];
      const retreating = m === MOVE_RETREAT;
      // "R을 떠나는 중": retreating, or walking, advancing or on a train
      // out of R (Task 11: a rail mover leaves like a walker).
      const leaving =
        retreating || m === MOVE_WALK || m === MOVE_ADVANCE || m === MOVE_RAIL;
      const halfway = retreating && t.prog[r] * 2 < t.need[r];
      const broken = !leaving && t.org[r] * 10 < land.orgMaxOf(r);
      if (halfway || broken || !hasRefuge(land, r)) {
        land.killDivision(r, true);
        destroyed.set(o, (destroyed.get(o) ?? 0) + 1);
      } else if (!leaving) {
        retreatDivision(land, r);
      }
    } else {
      const to = nearestOwnRegion(land, o, region);
      if (to === 0) {
        disbandDivision(land, r);
      } else {
        leaveBattle(land, r);
        stopDivision(land, r);
        land.setDivisionRegion(r, to);
        t.dest[r] = to;
      }
    }
  }
  for (const [o, n] of [...destroyed].sort((a, b) => a[0] - b[0])) {
    land.message(o, "events_display.ww1936_divisions_destroyed", {
      count: n,
      region,
    });
    land.message(by, "events_display.ww1936_divisions_destroyed", {
      count: n,
      region,
    });
  }
}

/** A neighbour of the division's region its side holds (encircled: inside the pocket). */
function hasRefuge(land: WwLand, row: number): boolean {
  return refugeOf(land, row) !== 0;
}

/** The first region (edges breadth-first, ascending) from `from` that `owner`'s side controls; 0 when none. */
function nearestOwnRegion(land: WwLand, owner: number, from: number): number {
  const sc = land.scenario;
  const seen = new Set<number>([from]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const r of frontier) {
      for (const e of sc.edgesOf(r)) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        if (land.sameSide(owner, land.controller[e.to])) return e.to;
        next.push(e.to);
      }
    }
    frontier = next;
  }
  return 0;
}

/** The map-sized scratch spreadOrder marks tiles in (derived; zero between calls). */
function scratch(land: WwLand): Uint8Array {
  const size = land.scenario.width * land.scenario.height;
  if (land.spreadScratch === null || land.spreadScratch.length !== size) {
    land.spreadScratch = new Uint8Array(size);
  }
  return land.spreadScratch;
}

/** Tiles a region's spread order holds: its land tiles but the victory-point tile. */
function orderLength(land: WwLand, region: number): number {
  const sc = land.scenario;
  const map = land.mg.map();
  const vp = sc.vpTile(sc.region(region)!);
  const vpIn =
    sc.regionAt(vp) === region && map.isLand(vp) && !map.isImpassable(vp);
  return sc.regionTiles(region).length - (vpIn ? 1 : 0);
}

/**
 * Spec §12.2: tiles of `region` from the `sources` side inward (a
 * breadth-first walk from the tiles 4-touching a source region,
 * neighbours up, right, down, left; no source tile: from the center), its
 * victory-point tile left out, parts the walk cannot reach after it in
 * tile order. No allocation per tile (pre-flight C2).
 */
export function spreadOrder(
  land: WwLand,
  region: number,
  sources: readonly number[],
): Uint32Array {
  const sc = land.scenario;
  const map = land.mg.map();
  const w = sc.width;
  const h = sc.height;
  const tiles = sc.regionTiles(region);
  const vp = sc.vpTile(sc.region(region)!);
  const seen = scratch(land);
  const inside = (t: number) =>
    sc.regionAt(t) === region && map.isLand(t) && !map.isImpassable(t);
  const isSource = (t: number) => {
    const id = sc.regionAt(t);
    for (let i = 0; i < sources.length; i++) if (sources[i] === id) return true;
    return false;
  };
  const queue = new Uint32Array(tiles.length);
  let qn = 0;
  if (sources.length > 0) {
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const x = t % w;
      if (
        (t >= w && isSource(t - w)) ||
        (x < w - 1 && isSource(t + 1)) ||
        (t < w * (h - 1) && isSource(t + w)) ||
        (x > 0 && isSource(t - 1))
      ) {
        seen[t] = 1;
        queue[qn++] = t;
      }
    }
  }
  if (qn === 0) {
    const c = sc.centerTile(region);
    if (inside(c)) {
      seen[c] = 1;
      queue[qn++] = c;
    }
  }
  const out = new Uint32Array(tiles.length);
  let k = 0;
  const visit = (n: number) => {
    if (seen[n] === 0 && inside(n)) {
      seen[n] = 1;
      queue[qn++] = n;
    }
  };
  for (let q = 0; q < qn; q++) {
    const t = queue[q];
    if (t !== vp) out[k++] = t;
    const x = t % w;
    if (t >= w) visit(t - w);
    if (x < w - 1) visit(t + 1);
    if (t < w * (h - 1)) visit(t + w);
    if (x > 0) visit(t - 1);
  }
  // Cut-off parts, in tile order.
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (seen[t] === 0 && t !== vp) out[k++] = t;
  }
  for (let i = 0; i < tiles.length; i++) seen[tiles[i]] = 0;
  return out.slice(0, k);
}

/** The spread's tile order: cached, or built from its sources (after a restore too: decision 21). */
function orderOf(land: WwLand, s: Spread): Uint32Array {
  let o = land.spreadOrders.get(s.region);
  if (o === undefined) {
    o = spreadOrder(land, s.region, s.sources);
    land.spreadOrders.set(s.region, o);
  }
  return o;
}

/** Advancing divisions by the region they advance into: [owner, progress ‰]. */
type Advances = Map<number, [number, number][]>;

function advancesOf(land: WwLand): Advances {
  const t = land.divisions;
  const out: Advances = new Map();
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0 || t.mode[r] !== MOVE_ADVANCE) continue;
    const pm =
      t.need[r] <= 0
        ? 1000
        : Math.min(1000, Math.floor((t.prog[r] * 1000) / t.need[r]));
    const list = out.get(t.next[r]) ?? [];
    list.push([t.owner[r], pm]);
    out.set(t.next[r], list);
  }
  return out;
}

/** True while `s`'s region has a battle led by `s.by`'s side. */
function fightingFor(land: WwLand, s: Spread): boolean {
  const b = land.battles.get(s.region);
  return b !== undefined && land.sameSide(b.attLead, s.by);
}

/**
 * Spec §12.3: how many of the order's `n` tiles `s.by` should hold now.
 * All once it controls the region; in battle 40% × the defenders' lost
 * org share, moving at most 20% of the tiles a day; while its side
 * advances in 40% + 60% × the furthest advance; else none (they go back).
 */
function targetOf(
  land: WwLand,
  s: Spread,
  n: number,
  day: number,
  adv: Advances,
): number {
  const R = s.region;
  if (land.controller[R] === s.by) return n;
  const b = land.battles.get(R);
  if (b !== undefined && land.sameSide(b.attLead, s.by)) {
    const pm =
      b.startOrgMilli <= 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1000,
              Math.floor((b.lostOrgMilli * 1000) / b.startOrgMilli),
            ),
          );
    const want = Math.floor((n * WW_SPREAD_BATTLE_PM * pm) / 1_000_000);
    if (s.dayNo !== day) {
      s.dayNo = day;
      s.dayBase = s.done;
    }
    const cap = Math.floor((n * WW_SPREAD_DAY_PM) / 1000);
    return Math.max(s.dayBase - cap, Math.min(s.dayBase + cap, want));
  }
  let best = -1;
  for (const [owner, pm] of adv.get(R) ?? []) {
    if (land.sameSide(owner, s.by) && pm > best) best = pm;
  }
  if (best >= 0) {
    return Math.floor(
      (n * (WW_SPREAD_BATTLE_PM * 1000 + (1000 - WW_SPREAD_BATTLE_PM) * best)) /
        1_000_000,
    );
  }
  return 0;
}

/** Spec §12.4: finishing captures, then battles and advances, then reverts, then capitulations. */
function classOf(land: WwLand, s: Spread, target: number): number {
  if (land.controller[s.region] === s.by) {
    return s.kind === SPREAD_CAPITULATION ? 3 : 0;
  }
  if (target > s.done) return 1;
  if (target < s.done) return 2;
  return 3;
}

/**
 * Who settles the conquest of `smallID` (P0 spec §7.5: only the victor): a
 * capitulated country's victor, or that victor's own victor when it has
 * capitulated too; itself when it never capitulated, 0 for no victor.
 */
function heirOf(land: WwLand, smallID: number): number {
  const caps = land.ww.data().capitulated;
  let id = smallID;
  for (let i = 0; i <= caps.length; i++) {
    const c = caps.find((x) => x.smallID === id);
    if (c === undefined) return id;
    if (c.victor === 0) return 0;
    id = c.victor;
  }
  return 0;
}

/**
 * `loser` lost its last tile to `taker`: the conquest (gold, stats, the
 * conquest event) is settled once, as P0's transfer did, by the loser's
 * heir when it capitulated (whoever's region the last tile was in).
 */
function settle(land: WwLand, taker: Player, loser: Player): void {
  const h = heirOf(land, loser.smallID());
  const heir = h === 0 ? null : land.mg.playerBySmallID(h);
  const to =
    heir !== null && heir.isPlayer() && h !== loser.smallID() ? heir : taker;
  land.mg.conquerPlayer(to, loser);
}

/**
 * Moves the spread toward `target` within `budget` tiles. Forward, each
 * tile `by` does not own yet; back, each tile `by` still owns goes to the
 * controller. A player losing its last tile so is settled as a conquest.
 * Returns the budget left.
 */
function moveTowards(
  land: WwLand,
  s: Spread,
  target: number,
  budget: number,
): number {
  const mg = land.mg;
  const tiles = orderOf(land, s);
  const end = Math.min(target, tiles.length);
  if (end > s.done) {
    const p = mg.playerBySmallID(s.by);
    if (!p.isPlayer()) return budget;
    while (budget > 0 && s.done < end) {
      const tile = tiles[s.done++];
      const prev = mg.owner(tile);
      if (prev.isPlayer() && prev.smallID() === s.by) continue;
      p.conquer(tile);
      budget--;
      if (prev.isPlayer() && !prev.isAlive()) settle(land, p, prev);
    }
  } else {
    const c = mg.playerBySmallID(land.controller[s.region]);
    const prev = mg.playerBySmallID(s.by);
    if (!c.isPlayer()) return budget;
    while (budget > 0 && s.done > end) {
      const tile = tiles[--s.done];
      if (mg.ownerID(tile) !== s.by) continue;
      c.conquer(tile);
      budget--;
      if (prev.isPlayer() && !prev.isAlive()) settle(land, c, prev);
    }
  }
  return budget;
}

/**
 * A capitulated country still holding tiles once every capitulation spread
 * is done (tiles in regions it lost without a spread, or handed to it
 * since): they go to their regions' controllers by the spread, as P0's
 * transfer listed such land again. Runs every tick without allocating
 * (no WorldWar.data()): a capitulated country that still controls a
 * region had no victor (nothing was handed over, P0 spec §7.5) and keeps
 * its land.
 */
function sweepLosers(land: WwLand): void {
  for (const s of land.spreads.values()) {
    if (s.kind === SPREAD_CAPITULATION) return;
  }
  const mg = land.mg;
  const sc = land.scenario;
  const n = sc.countries.length;
  for (let id = 1; id <= n; id++) {
    if (!land.ww.isCapitulated(id)) continue;
    const p = mg.playerBySmallID(id);
    if (!p.isPlayer() || !p.isAlive() || controlsAny(land, id)) continue;
    const regions = new Set<number>();
    for (const t of p.tiles()) {
      const r = sc.regionAt(t);
      if (sc.region(r) !== undefined && !land.spreads.has(r)) regions.add(r);
    }
    for (const r of [...regions].sort((a, b) => a - b)) {
      const by = land.controller[r];
      if (by === id || !mg.playerBySmallID(by).isPlayer()) continue;
      land.setSpread({
        region: r,
        by,
        kind: SPREAD_CAPITULATION,
        sources: [],
        done: 0,
        dayBase: 0,
        dayNo: -1,
      });
      land.spreadOrders.delete(r);
    }
  }
}

function controlsAny(land: WwLand, smallID: number): boolean {
  const c = land.controller;
  for (let r = 1; r < c.length; r++) if (c[r] === smallID) return true;
  return false;
}

/** Spec §12.4: 2,000 tiles a tick: finishing captures, then battles and advances, then reverts, then capitulations. */
export function stepSpread(land: WwLand): void {
  sweepLosers(land);
  if (land.spreads.size === 0) return;
  let budget = WW_SPREAD_TILES_PER_TICK;
  const day = land.day();
  const adv = advancesOf(land);
  const list: { s: Spread; n: number; target: number; cls: number }[] = [];
  for (const s of land.spreads.values()) {
    // Classified by size alone: an order is built only when it moves.
    const n = orderLength(land, s.region);
    const target = targetOf(land, s, n, day, adv);
    list.push({ s, n, target, cls: classOf(land, s, target) });
  }
  list.sort((a, b) => a.cls - b.cls || a.s.region - b.s.region);
  for (const { s, n, target } of list) {
    if (budget > 0 && target !== s.done) {
      budget = moveTowards(land, s, target, budget);
    }
    const finished = land.controller[s.region] === s.by && s.done >= n;
    if (finished || (s.done === 0 && target === 0 && !fightingFor(land, s))) {
      land.spreads.delete(s.region);
      land.spreadOrders.delete(s.region);
    }
  }
}

/**
 * Spec §12.5: every region the loser controls is the victor's this tick
 * (with its victory-point tile; no message each: P0 announces the
 * capitulation once), its battles end, and the other tiles follow by the
 * spread budget, last in line. Divisions of other countries there leave
 * as from a captured region (pre-flight C5). P0's transfer queue is no
 * longer used (plan decision 8); tiles the loser holds elsewhere go to
 * their regions' controllers once the transfer is done (sweepLosers).
 */
export function transferOnCapitulation(
  land: WwLand,
  loser: number,
  victor: number,
): void {
  const tick = land.mg.ticks();
  const sc = land.scenario;
  const taken = sc.landRegions
    .map((r) => r.id)
    .filter((id) => land.controller[id] === loser)
    .sort((a, b) => a - b);
  // Spread sources: the victor's regions at the capitulation.
  const sources = taken.map((id) =>
    sc
      .edgesOf(id)
      .map((e) => e.to)
      .filter((n) => land.controller[n] === victor),
  );
  taken.forEach((id, i) => {
    land.setController(id, victor, tick, false);
    closeBattle(land, id);
    evict(land, id, victor);
    land.setSpread({
      region: id,
      by: victor,
      kind: SPREAD_CAPITULATION,
      sources: sources[i],
      done: 0,
      dayBase: 0,
      dayNo: -1,
    });
    land.spreadOrders.delete(id);
  });
}
