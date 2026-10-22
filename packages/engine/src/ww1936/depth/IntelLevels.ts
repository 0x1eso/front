// P6 lane I (plan Task 5): the intelligence levels of every country pair
// and domain (spec §8.8, plan decisions 16, 19). The engine computes them
// on the observer's turn and the screens filter by them (FogModel);
// spectators and the game's end are the screens' (fogOff). The AI reads
// true values (spec §8.1): an AI country's row is written on its AI rhythm
// (plan decision 39: daily at war, every 10 days at peace), a human's
// every day (performance, spec §22.1).
import { WW_RADAR_RANGE_KM } from "@openfront/engine-api/ww1936/AirTypes";
import {
  AgencyUpgrade,
  ID_AIR,
  ID_ARMY,
  ID_CIVIL,
  ID_NAVY,
  WwDepthDetail,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  IntelInput,
  intelLevel,
} from "@openfront/engine-lib/ww1936/IntelRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { effectiveLevel } from "../economy/Buildings";
import { reconCovers } from "./AirExtras";
import { isSkirmisherArmy } from "./Command";
import {
  cryptoDaysLeft,
  decryptedOwn,
  exploiting,
  intelSharers,
} from "./Crypto";
import { counterHalfOf, counterMissions, hasUp, statOf } from "./Operatives";
import type { WwDepth } from "./WwDepth";

const DOMAINS = [ID_CIVIL, ID_ARMY, ID_NAVY, ID_AIR] as const;
const DEPARTMENT: readonly AgencyUpgrade[] = [
  "ag_civil_dept",
  "ag_army_dept",
  "ag_navy_dept",
  "ag_air_dept",
];

// ---- derived, per tick (control and missions move during a war) ----

interface TickCache {
  tick: number;
  /** Plays its turns (P5 isActor). */
  actor: Uint8Array;
  /** counter_intelligence operatives at home. */
  counter: Uint8Array;
  /** Harbour zones by country, countries by harbour zone. */
  zonesOf: number[][];
  byZone: Map<number, number[]>;
  // Scratch of one observer's row (filled and cleared by the row).
  nb: Uint8Array;
  infil: Uint8Array;
  codes: Uint8Array;
  radar: Uint8Array;
  /**
   * Final perf lane: the regions the observer's skirmisher armies stand in
   * or next to (null until a target needs it; fillObserver clears it).
   */
  skirm: Set<number> | null;
  ins: IntelInput[];
}

const TICK = new WeakMap<WwDepth, TickCache>();

/**
 * The tick's cache, built by the tick's first row (a fixed point of the
 * tick, so a restored game builds it from the same state). A screen read
 * (`keep` false) never stores one: it would move that point.
 */
function tickCache(d: WwDepth, keep = true): TickCache {
  const tick = d.mg.ticks();
  let c = TICK.get(d);
  if (c !== undefined && c.tick === tick) return c;
  if (!keep || c === undefined || c.actor.length !== d.cap) {
    c = {
      tick,
      actor: new Uint8Array(d.cap),
      counter: new Uint8Array(d.cap),
      zonesOf: [],
      byZone: new Map(),
      nb: new Uint8Array(d.cap),
      infil: new Uint8Array(d.cap),
      codes: new Uint8Array(d.cap),
      radar: new Uint8Array(d.cap),
      skirm: null,
      ins: DOMAINS.map((domain) => ({
        domain,
        sameFaction: false,
        neighbour: false,
        atWar: false,
        networkMilliPm: 0,
        department: false,
        infiltrated: false,
        decrypted: false,
        exploiting: false,
        recon: false,
        skirmisher: false,
        radar: false,
        targetCounterMissions: 0,
        intelPct: 0,
      })),
    };
    if (keep) TICK.set(d, c);
  }
  c.tick = tick;
  for (let t = 1; t < d.cap; t++) {
    c.actor[t] = d.ww.isActor(t) ? 1 : 0;
    c.counter[t] = counterMissions(d, t);
  }
  const sc = d.ww.scenario;
  const econ = d.ww.economy;
  c.zonesOf = Array.from({ length: d.cap }, () => []);
  c.byZone = new Map();
  // The land regions with a harbour zone, in landRegions order.
  for (const [rid, z] of harbourRegions(sc)) {
    const owner = econ.controllerOf(rid);
    if (owner <= 0 || owner >= d.cap) continue;
    const zs = c.zonesOf[owner];
    if (!zs.includes(z)) zs.push(z);
    const cs = c.byZone.get(z);
    if (cs === undefined) c.byZone.set(z, [owner]);
    else if (!cs.includes(owner)) cs.push(owner);
  }
  return c;
}

// ---- static: the harbour regions, the land strategic regions a radar reaches ----

const HARBOURS = new WeakMap<ScenarioIndex, [number, number][]>();

/** [land region, its harbour zone] of every land region with one, in landRegions order. */
function harbourRegions(sc: ScenarioIndex): [number, number][] {
  let v = HARBOURS.get(sc);
  if (v === undefined) {
    v = [];
    for (const r of sc.landRegions) {
      const z = sc.harborOf(r.id);
      if (z !== 0) v.push([r.id, z]);
    }
    HARBOURS.set(sc, v);
  }
  return v;
}

const RADAR_REACH = new WeakMap<ScenarioIndex, Map<number, number[]>>();

/** The land strategic regions within 300 km × level of a radar's region (P4 radarPmAt's rule). */
function radarReach(
  sc: ScenarioIndex,
  region: number,
  level: number,
): number[] {
  let m = RADAR_REACH.get(sc);
  if (m === undefined) {
    m = new Map();
    RADAR_REACH.set(sc, m);
  }
  const key = region * 16 + Math.min(15, level);
  let v = m.get(key);
  if (v === undefined) {
    v = sc
      .strategicList()
      .filter(
        (s) =>
          s.kind === "land" &&
          sc.srKm(region, s.id) <= WW_RADAR_RANGE_KM * level,
      )
      .map((s) => s.id);
    m.set(key, v);
  }
  return v;
}

/**
 * Spec §8.8 (P4 §12.1): the land strategic regions `o`'s working radars
 * reach (300 km × level from the radar's region to the zone's centre, as
 * P4's radarPmAt), ascending.
 */
export function radarSrOf(d: WwDepth, o: number): number[] {
  const econ = d.ww.economy;
  const sc = d.ww.scenario;
  const levels = econ.buildingArray("radar");
  const out = new Set<number>();
  for (const r of econ.regionsOf(o)) {
    if ((levels[r] ?? 0) === 0) continue;
    const lv = effectiveLevel(econ, r, "radar");
    if (lv <= 0) continue;
    for (const s of radarReach(sc, r, lv)) out.add(s);
  }
  return [...out].sort((a, b) => a - b);
}

/** Fills the observer's scratch: neighbours, infiltrations, codes, radar. */
function fillObserver(
  d: WwDepth,
  c: TickCache,
  o: number,
  sharers: number[],
): void {
  c.nb.fill(0);
  c.infil.fill(0);
  c.codes.fill(0);
  c.radar.fill(0);
  c.skirm = null;
  for (const t of d.ww.economy.countryNeighbours(o)) {
    if (t < d.cap) c.nb[t] = 1;
  }
  for (const z of c.zonesOf[o] ?? []) {
    for (const t of c.byZone.get(z) ?? []) if (t !== o) c.nb[t] = 1;
  }
  for (const [x, t, dom] of d.infiltrations) {
    if (x === o && t < d.cap) c.infil[t] |= 1 << dom;
  }
  for (const r of d.decrypted) {
    if (r.t >= d.cap || (r.o !== o && !sharers.includes(r.o))) continue;
    if (decryptedOwn(d, r.o, r.t)) c.codes[r.t] |= 1;
    // Brief Step 5: decrypted and exploited, mine or faction-shared.
    if (exploiting(d, r.o, r.t)) c.codes[r.t] |= 2;
  }
  const econ = d.ww.economy;
  const sc = d.ww.scenario;
  for (const s of radarSrOf(d, o)) {
    for (const r of sc.sr(s)?.members ?? []) {
      const t = econ.controllerOf(r);
      if (t > 0 && t < d.cap && t !== o) c.radar[t] = 1;
    }
  }
}

/**
 * Command.skirmisherContact for one observer and every target (final perf
 * lane): the regions `o`'s skirmisher armies' divisions stand in, and their
 * neighbours. A target is in contact when one of its divisions stands in
 * one of them — the same test, the observer's half made once a row.
 */
function skirmisherReach(d: WwDepth, o: number): Set<number> {
  const out = new Set<number>();
  const land = d.ww.land;
  const cl = land.country(o);
  if (cl === null) return out;
  const t = land.divisions;
  const sc = d.ww.scenario;
  for (const a of land.armiesOf(o)) {
    if (!isSkirmisherArmy(cl, a)) continue;
    for (const div of a.divisions) {
      const r = t.rowOf(div);
      if (r < 0) continue;
      const at = t.region[r];
      out.add(at);
      for (const n of sc.regionNeighbours(at)) out.add(n);
    }
  }
  return out;
}

/** A division of `target` stands in one of `reach`'s regions. */
function touches(d: WwDepth, reach: Set<number>, target: number): boolean {
  if (reach.size === 0) return false;
  const land = d.ww.land;
  const t = land.divisions;
  for (const r of land.rowsOf(target)) if (reach.has(t.region[r])) return true;
  return false;
}

/** Spec §8.8: writes the four inputs of `o` on `t` into the scratch inputs. */
function fillInputs(
  d: WwDepth,
  c: TickCache,
  o: number,
  t: number,
  sharers: number[],
  dept: readonly boolean[],
  intelPct: number,
): IntelInput[] {
  let net = d.netMilli(o, t);
  for (const m of sharers) {
    net = Math.max(net, Math.floor(d.netMilli(m, t) / 2));
  }
  const atWar = d.ww.isAtWar(o, t);
  const neighbour = c.nb[t] === 1;
  const sameFaction = d.ww.sameFaction(o, t);
  const codes = c.codes[t];
  const mask = c.infil[t];
  const recon = reconCovers(d, o, t);
  // Contact needs armies side by side: a war or a border.
  const skirmisher =
    (atWar || neighbour) && touches(d, (c.skirm ??= skirmisherReach(d, o)), t);
  const radar = c.radar[t] === 1;
  const counter = c.counter[t];
  for (const i of c.ins) {
    const dom = i.domain;
    i.sameFaction = sameFaction;
    i.neighbour = neighbour;
    i.atWar = atWar;
    i.networkMilliPm = net;
    i.department = dept[dom];
    i.infiltrated = (mask & (1 << dom)) !== 0;
    i.decrypted = (codes & 1) !== 0;
    i.exploiting = (codes & 2) !== 0;
    i.recon = dom === ID_ARMY && recon;
    i.skirmisher = dom === ID_ARMY && skirmisher;
    i.radar = dom === ID_AIR && radar;
    i.targetCounterMissions = counter;
    i.intelPct = intelPct;
  }
  return c.ins;
}

/** Calls `each(t, inputs)` for every living target of `o` (the scratch inputs, valid during the call). */
function forTargets(
  d: WwDepth,
  o: number,
  each: (t: number, ins: IntelInput[]) => void,
  keep = true,
): void {
  const c = tickCache(d, keep);
  const sharers = intelSharers(d, o);
  fillObserver(d, c, o, sharers);
  const oc = d.country(o);
  const dept = DEPARTMENT.map((u) => hasUp(oc, u));
  const intelPct = statOf(d, o, "intelPct");
  for (let t = 1; t < d.cap; t++) {
    if (t === o || c.actor[t] === 0) continue;
    each(t, fillInputs(d, c, o, t, sharers, dept, intelPct));
  }
}

/** Plan decision 39's rhythm for an AI row: daily at war, else every 10 days. */
function rowDue(d: WwDepth, o: number, day: number): boolean {
  return d.ww.isHumanControlled(o) || d.ww.hasWar(o) || day % 10 === o % 10;
}

/**
 * Spec §8.8: the observer's row of intelLevels (state): every living
 * target's four domains; itself 100; a country out of the game keeps its
 * last values. markIntel when a value changed.
 */
export function computeIntelRow(
  d: WwDepth,
  observer: number,
  day: number,
): void {
  if (!rowDue(d, observer, day)) return;
  const row = d.intelRow(observer);
  let changed = false;
  const self = observer * 4;
  for (let k = 0; k < 4; k++) {
    if (row[self + k] !== 100) {
      row[self + k] = 100;
      changed = true;
    }
  }
  forTargets(d, observer, (t, ins) => {
    const at = t * 4;
    for (let k = 0; k < 4; k++) {
      const v = intelLevel(ins[k]);
      if (row[at + k] !== v) {
        row[at + k] = v;
        changed = true;
      }
    }
  });
  if (changed) d.markIntel(observer);
}

/**
 * The lines of a level (lane U3's ww1936.intel.src.<key>), non-zero only,
 * in intelLevel's order; the same-faction line carries the 80 floor and
 * "other" the 0..100 clamp, so they always add up to intelLevel.
 */
export function levelLines(i: IntelInput): [string, number][] {
  const out: [string, number][] = [["base", 5]];
  const add = (k: string, v: number) => {
    if (v !== 0) out.push([k, v]);
  };
  add("neighbour", i.neighbour ? 10 : 0);
  add("at_war", i.atWar ? 15 : 0);
  add("network", Math.min(50, Math.floor(i.networkMilliPm / 20_000)));
  add("department", i.department ? 10 : 0);
  add("infiltrated", i.infiltrated && i.domain !== ID_CIVIL ? 30 : 0);
  if (i.exploiting) add("exploiting", i.domain === ID_CIVIL ? 15 : 30);
  else add("decrypted", i.decrypted ? 10 : 0);
  add("recon", i.domain === ID_ARMY && i.recon ? 20 : 0);
  add("skirmisher", i.domain === ID_ARMY && i.skirmisher ? 20 : 0);
  add("radar", i.domain === ID_AIR && i.radar ? 10 : 0);
  add("counter", -Math.min(30, 10 * i.targetCounterMissions));
  add("upgrades", Math.floor(i.intelPct / 10));
  let sum = out.reduce((s, l) => s + l[1], 0);
  if (i.sameFaction) sum += 10;
  const clamped = Math.max(0, Math.min(100, sum));
  add("other", clamped - sum);
  if (i.sameFaction) add("same_faction", 10 + Math.max(0, 80 - clamped));
  return out;
}

/**
 * Lane U3 (merge glue): the observer's level lines on every living target,
 * [target, domain, key, value] — what computeIntelRow sums today.
 */
export function levelPartsOf(
  d: WwDepth,
  observer: number,
): [number, number, string, number][] {
  const out: [number, number, string, number][] = [];
  forTargets(
    d,
    observer,
    (t, ins) => {
      for (let k = 0; k < 4; k++) {
        for (const [key, v] of levelLines(ins[k])) out.push([t, k, key, v]);
      }
    },
    false,
  );
  return out;
}

/**
 * Lane U3's view data (wave B notes; WwDepthDetail.intel, merge glue):
 * every finished decryption, infiltrations, level lines, the targets'
 * counter-intelligence, who read our codes, the days to break the current
 * target, my side's recon sorties and the zones my radar reaches.
 */
export function intelDetailOf(
  d: WwDepth,
  id: number,
): Pick<
  WwDepthDetail["intel"],
  | "decrypted"
  | "infiltrated"
  | "levelParts"
  | "targetCounter"
  | "decryptLog"
  | "cryptoDaysLeft"
  | "reconSorties"
  | "radarSr"
> {
  const decrypted: { target: number; activeUntil: number }[] = [];
  const seen = new Set<number>();
  for (const r of d.decrypted) {
    if (r.o !== id) continue;
    const active = exploiting(d, id, r.t);
    if (!active && !decryptedOwn(d, id, r.t)) continue;
    decrypted.push({ target: r.t, activeUntil: active ? r.activeUntil : -1 });
    seen.add(r.t);
  }
  for (const m of intelSharers(d, id)) {
    for (const r of d.decrypted) {
      if (r.o !== m || seen.has(r.t) || r.t === id) continue;
      if (!decryptedOwn(d, m, r.t)) continue;
      decrypted.push({ target: r.t, activeUntil: -1 });
      seen.add(r.t);
    }
  }
  decrypted.sort((a, b) => a.target - b.target);
  const infiltrated = new Map<number, number>();
  for (const [o, t, dom] of d.infiltrations) {
    if (o === id) infiltrated.set(t, (infiltrated.get(t) ?? 0) | (1 << dom));
  }
  const targetCounter: [number, number][] = [];
  for (let t = 1; t < d.cap; t++) {
    if (t === id || d.country(t) === null) continue;
    const h = counterHalfOf(d, t);
    if (h > 0) targetCounter.push([t, h]);
  }
  const side = d.ww.land.sideOf(id);
  return {
    decrypted,
    infiltrated: [...infiltrated.entries()].sort((a, b) => a[0] - b[0]),
    levelParts: levelPartsOf(d, id),
    targetCounter,
    decryptLog: d.decrypted
      .filter((r) => r.t === id && r.activeUntil <= -2)
      .map((r) => ({ target: r.o, day: -r.activeUntil - 2 }))
      .sort((a, b) => a.day - b.day || a.target - b.target),
    cryptoDaysLeft: cryptoDaysLeft(d, id),
    reconSorties: d.sea.reconBySide
      .filter(([s]) => s === side)
      .map(([s, sr, n]) => [sr, s, n] as [number, number, number]),
    radarSr: radarSrOf(d, id),
  };
}
