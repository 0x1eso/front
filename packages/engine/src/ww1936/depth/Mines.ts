// P6 lane W2 (plan Task 8): naval mines (spec §15.1). Mines are kept per
// sea strategic region and side (P4's side: the faction, or the country
// alone) in milli-units, `d.sea.mines` = [sr, side, milli] sorted by
// (sr, side). A region's day (P4 dailySeaRegion, after the convoy war):
// yesterday's mines decay, the sides' lay_mines fleets lay, their
// sweep_mines fleets clear the enemy's, and every side's ships at sea there
// take the day's damage from the enemy's mines. Integer rules only (spec
// §21.3: no roll).
import {
  DS_MINE_LAYER,
  DS_MINESWEEP,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  MINE_LAY_PER_DAY,
  MINE_MAX,
  MINE_SWEEP_PER_DAY,
  mineConvoyLossPm,
  mineDamageMilli,
  mineDecay,
  mineInvasionCutPct,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import { FST, MISSION } from "../navy/Missions";
import { applyShipDamage } from "../navy/NavalBattles";
import type { Fleet } from "../navy/WwNavy";
import type { WwDepth } from "./WwDepth";

/**
 * 내 판단: below one spec unit a field does nothing (every effect floors
 * m / 1000) and its 0.5% decay floors to 0, so it goes.
 */
const MINE_MIN = 1_000;
/** The screens get the mines again when an entry appears, goes, or moves across a step of 10 spec units. */
const MINE_VIEW_STEP = 10_000;

/**
 * A side key from a side key or a smallID: smallIDs are below the depth
 * cap, P4's faction keys far above it (P2 WwLand: 100 000 + faction).
 */
export function sideKeyOf(d: WwDepth, x: number): number {
  return x > 0 && x < d.cap ? d.ww.land.sideOf(x) : x;
}

/** Some member of side `a` is at war with some member of side `b` now. */
export function sidesAtWar(d: WwDepth, a: number, b: number): boolean {
  if (a === b) return false;
  const land = d.ww.land;
  const mb = land.sideMembers(b);
  if (mb.length === 0) return false;
  for (const x of land.sideMembers(a)) {
    for (const y of mb) if (land.isEnemy(x, y)) return true;
  }
  return false;
}

/** The DS_* flags of a ship row's design (0: a ship of a static class and generation). */
export function shipDesignFlags(d: WwDepth, row: number): number {
  const t = d.ww.navy.ships;
  const slot = t.design[row];
  if (slot === 0) return 0;
  return d.designStatsOf(t.owner[row], "ship", slot)?.flags ?? 0;
}

/** Working its mission in place: at sea, on station, no path left (not moving, not in a battle). */
function working(f: Fleet): boolean {
  return f.docked === 0 && f.state === FST.onStation && f.path.length === 0;
}

/** Enemy mines (Σ over the sides at war with `side`, a side key or a smallID) in region `sr`, milli. */
export function enemyMinesMilli(d: WwDepth, sr: number, side: number): number {
  const at = d.mineIndex.get(sr);
  if (at === undefined || at.size === 0) return 0;
  const s = sideKeyOf(d, side);
  let m = 0;
  for (const [k, i] of at) {
    const v = d.sea.mines[i]?.[2] ?? 0;
    if (v > 0 && sidesAtWar(d, k, s)) m += v;
  }
  return m;
}

/** A side's own mines (a side key or a smallID) in region `sr`, milli. */
export function ownMinesMilli(d: WwDepth, sr: number, side: number): number {
  const i = d.mineAt(sr, sideKeyOf(d, side));
  return i < 0 ? 0 : (d.sea.mines[i]?.[2] ?? 0);
}

interface SideShips {
  /** Ship ids at sea in the region. */
  ships: number[];
  /** Today's laying and sweeping, milli. */
  lay: number;
  sweep: number;
  /** A minesweeper design ship works here (halves the damage, whatever its class sweeps). */
  sweeper: boolean;
}

const mineBoost = (v: number, mw2: boolean): number =>
  mw2 ? Math.floor((v * 3) / 2) : v;

/**
 * The sea region's day (after P4's convoy war): ① a country that joined a
 * faction brings its mines to the faction's key; a faction that is gone
 * leaves them to the side holding the most ports on the region (its former
 * members are not known any more); ② yesterday's mines decay 0.5%; ③ the sides'
 * lay_mines fleets lay (their mine-layer design ships); ④ their
 * sweep_mines fleets clear enemy mines (minesweeper design ships), side
 * key order; ⑤ each side's ships at sea in the region (on a mission,
 * moving or in a battle) take the enemy mines' damage.
 */
export function seaRegionDay(d: WwDepth, sr: number, day: number): void {
  void day;
  const ww = d.ww;
  const s = ww.scenario.sr(sr);
  if (s === undefined || s.kind !== "sea") return;
  const navy = ww.navy;
  const t = navy.ships;
  const land = ww.land;
  const before = regionEntries(d, sr);
  // No mines here and no layer at work: nothing to do (the usual day).
  if (before.size === 0 && !anyLayer(d, s.members)) return;
  const bySide = new Map<number, SideShips>();
  for (const z of s.members) {
    for (const id of navy.fleetsIn(z)) {
      const f = navy.fleets.get(id);
      if (f === undefined || f.docked !== 0 || f.ships.length === 0) continue;
      const side = land.sideOf(f.owner);
      let x = bySide.get(side);
      if (x === undefined) {
        bySide.set(side, (x = { ships: [], lay: 0, sweep: 0, sweeper: false }));
      }
      const lays = f.mission === MISSION.layMines && working(f);
      const sweeps = f.mission === MISSION.sweepMines && working(f);
      // Research overhaul (mine_warfare_2): magnetic mines, +50% laid and swept.
      const mw2 =
        (lays || sweeps) &&
        ww.economy.country(f.owner)?.researched.has("mine_warfare_2") === true;
      for (const sid of f.ships) {
        const r = t.rowOf(sid);
        if (r < 0) continue;
        x.ships.push(sid);
        if (!lays && !sweeps) continue;
        const flags = shipDesignFlags(d, r);
        const cls = SHIP_CLASSES[t.cls[r]];
        if (lays && (flags & DS_MINE_LAYER) !== 0) {
          x.lay += mineBoost(MINE_LAY_PER_DAY[cls] ?? 0, mw2);
        }
        if (sweeps && (flags & DS_MINESWEEP) !== 0) {
          x.sweep += mineBoost(MINE_SWEEP_PER_DAY[cls] ?? 0, mw2);
          x.sweeper = true;
        }
      }
    }
  }
  // ① Re-key, ② decay.
  const now = new Map<number, number>();
  for (const [k, v] of before) {
    let key = k;
    if (k < d.cap) key = land.sideOf(k);
    else if (land.sideMembers(k).length === 0) key = portSide(d, s.members);
    if (key <= 0) continue;
    now.set(key, Math.min(MINE_MAX, (now.get(key) ?? 0) + v));
  }
  for (const [k, v] of now) now.set(k, v - mineDecay(v));
  const sides = [...bySide.keys()].sort((a, b) => a - b);
  // ③ Laying.
  for (const side of sides) {
    const lay = bySide.get(side)!.lay;
    if (lay > 0) now.set(side, Math.min(MINE_MAX, (now.get(side) ?? 0) + lay));
  }
  // ④ Sweeping.
  for (const side of sides) {
    let left = bySide.get(side)!.sweep;
    for (const k of [...now.keys()].sort((a, b) => a - b)) {
      if (left <= 0) break;
      if (!sidesAtWar(d, side, k)) continue;
      const v = now.get(k)!;
      const take = Math.min(v, left);
      now.set(k, v - take);
      left -= take;
    }
  }
  writeRegion(d, sr, before, now);
  // ⑤ Damage.
  const tick = d.mg.ticks();
  const keys = [...now.keys()].sort((a, b) => a - b);
  for (const side of sides) {
    const x = bySide.get(side)!;
    let enemy = 0;
    let worstSide = 0;
    let worst = 0;
    for (const k of keys) {
      const v = now.get(k)!;
      if (v <= 0 || !sidesAtWar(d, k, side)) continue;
      enemy += v;
      if (v > worst) {
        worst = v;
        worstSide = k;
      }
    }
    if (enemy > 0) damageSide(d, x, enemy, x.sweeper, worstSide, tick);
  }
}

/**
 * Spec §15.1: the side's total HP × m / 1000 × 0.004 (half with our
 * sweepers at work here), split over its ships by visibility, ship id
 * order, the rest to the first ship. The sinking goes to the first member
 * of the mines' side at war with the ship's owner (P5 war score).
 */
function damageSide(
  d: WwDepth,
  x: SideShips,
  enemyMilli: number,
  sweepers: boolean,
  mineSide: number,
  tick: number,
): void {
  const navy = d.ww.navy;
  const t = navy.ships;
  const land = d.ww.land;
  const rows: { id: number; vis: number; owner: number }[] = [];
  let hp = 0;
  let visSum = 0;
  for (const id of [...x.ships].sort((a, b) => a - b)) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    const vis = Math.max(0, navy.shipStatsOf(r).vis);
    rows.push({ id, vis, owner: t.owner[r] });
    hp += t.hp[r];
    visSum += vis;
  }
  if (rows.length === 0) return;
  const dmg = mineDamageMilli(hp, enemyMilli, sweepers);
  if (dmg <= 0) return;
  const parts = rows.map((r) =>
    visSum <= 0 ? 0 : Math.floor((dmg * r.vis) / visSum),
  );
  parts[0] += dmg - parts.reduce((a, b) => a + b, 0);
  const layers = land.sideMembers(mineSide);
  rows.forEach((r, i) => {
    if (parts[i] <= 0) return;
    const by = layers.find((m) => land.isEnemy(m, r.owner)) ?? 0;
    applyShipDamage(navy, r.id, parts[i], 0, tick, by);
  });
}

/** A lay_mines fleet works in one of the zones. */
function anyLayer(d: WwDepth, zones: readonly number[]): boolean {
  const navy = d.ww.navy;
  for (const z of zones) {
    for (const id of navy.fleetsIn(z)) {
      const f = navy.fleets.get(id);
      if (f !== undefined && f.mission === MISSION.layMines && working(f)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The side holding the most ports (land regions whose harbour zone is one
 * of `zones`; ties: the smaller key), 0 when none: the heir of a dissolved
 * faction's minefield.
 */
function portSide(d: WwDepth, zones: readonly number[]): number {
  const sc = d.ww.scenario;
  const land = d.ww.land;
  const inZones = new Set(zones);
  const n = new Map<number, number>();
  for (const r of sc.landRegions) {
    if (!inZones.has(sc.harborOf(r.id))) continue;
    const c = land.controller[r.id] ?? 0;
    if (c === 0) continue;
    const side = land.sideOf(c);
    n.set(side, (n.get(side) ?? 0) + 1);
  }
  let best = 0;
  let bestN = 0;
  for (const [side, k] of [...n].sort((a, b) => a[0] - b[0])) {
    if (k > bestN) {
      best = side;
      bestN = k;
    }
  }
  return best;
}

/** The region's entries: side → milli (WwDepth.mineIndex). */
function regionEntries(d: WwDepth, sr: number): Map<number, number> {
  const out = new Map<number, number>();
  const at = d.mineIndex.get(sr);
  if (at === undefined) return out;
  for (const [k, i] of [...at].sort((a, b) => a[0] - b[0])) {
    const v = d.sea.mines[i]?.[2] ?? 0;
    if (v > 0) out.set(k, v);
  }
  return out;
}

/**
 * Writes the region's entries back (zeros dropped, the list sorted by
 * (sr, side)); the screens' copy is marked when a visible amount changed.
 */
function writeRegion(
  d: WwDepth,
  sr: number,
  before: ReadonlyMap<number, number>,
  now: ReadonlyMap<number, number>,
): void {
  if (before.size === 0 && ![...now.values()].some((v) => v >= MINE_MIN)) {
    return;
  }
  const keep = d.sea.mines.filter((m) => m[0] !== sr);
  let seen = false;
  let n = 0;
  for (const [k, v] of now) {
    if (v < MINE_MIN) continue;
    n++;
    keep.push([sr, k, v]);
    const was = before.get(k);
    if (
      was === undefined ||
      Math.floor(was / MINE_VIEW_STEP) !== Math.floor(v / MINE_VIEW_STEP)
    ) {
      seen = true;
    }
  }
  if (n !== before.size) seen = true;
  keep.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  d.sea.mines = keep;
  d.reindexSparse();
  if (seen) d.markGlobal();
}

/** Extra convoy losses from `side`'s enemies' mines in the region, ‰ (P4 spec §10.6 adds it). */
export function minesConvoyLossPm(
  d: WwDepth,
  sr: number,
  side: number,
): number {
  return mineConvoyLossPm(enemyMinesMilli(d, sr, side));
}

/** The landing strength cut from enemy mines, percent. */
export function minesInvasionCutPct(
  d: WwDepth,
  sr: number,
  side: number,
): number {
  return mineInvasionCutPct(enemyMinesMilli(d, sr, side));
}
