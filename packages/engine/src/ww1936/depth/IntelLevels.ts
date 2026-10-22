// P6 lane I (plan Task 5): the intelligence levels of every country pair
// and domain (spec §8.8, plan decisions 16, 19). The engine computes them
// on the observer's turn for every country (the AI's operations read them)
// and the screens filter by them (FogModel); spectators and the game's end
// are the screens' (fogOff).
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
import { skirmisherContact } from "./Command";
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

/** What an observer's row reads once (sets of countries, its departments). */
interface ObserverCtx {
  o: number;
  dept: boolean[];
  landNb: ReadonlySet<number>;
  seaNb: ReadonlySet<number>;
  sharers: number[];
  infiltrated: Map<number, number>;
  radar: ReadonlySet<number>;
  intelPct: number;
}

// ---- derived per tick: harbour zones by country (control moves every tick of a war) ----

const ZONES = new WeakMap<
  WwDepth,
  { tick: number; byZone: Map<number, number[]>; byCountry: number[][] }
>();

function harbourZones(d: WwDepth): {
  byZone: Map<number, number[]>;
  byCountry: number[][];
} {
  const tick = d.mg.ticks();
  const hit = ZONES.get(d);
  if (hit !== undefined && hit.tick === tick) return hit;
  const sc = d.ww.scenario;
  const econ = d.ww.economy;
  const byZone = new Map<number, number[]>();
  const byCountry: number[][] = Array.from({ length: d.cap }, () => []);
  for (const r of sc.landRegions) {
    const z = sc.harborOf(r.id);
    if (z === 0) continue;
    const c = econ.controllerOf(r.id);
    if (c <= 0 || c >= d.cap) continue;
    const zs = byCountry[c];
    if (!zs.includes(z)) zs.push(z);
    const cs = byZone.get(z);
    if (cs === undefined) byZone.set(z, [c]);
    else if (!cs.includes(c)) cs.push(c);
  }
  const v = { tick, byZone, byCountry };
  ZONES.set(d, v);
  return v;
}

// ---- static: a land strategic region's regions ----

const SR_LAND = new WeakMap<
  ScenarioIndex,
  { id: number; members: readonly number[] }[]
>();

function landSrs(
  sc: ScenarioIndex,
): { id: number; members: readonly number[] }[] {
  let v = SR_LAND.get(sc);
  if (v === undefined) {
    v = sc
      .strategicList()
      .filter((s) => s.kind === "land")
      .map((s) => ({ id: s.id, members: s.members }));
    SR_LAND.set(sc, v);
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
    for (const s of landSrs(sc)) {
      if (!out.has(s.id) && sc.srKm(r, s.id) <= WW_RADAR_RANGE_KM * lv) {
        out.add(s.id);
      }
    }
  }
  return [...out].sort((a, b) => a - b);
}

function radarTargets(d: WwDepth, o: number): Set<number> {
  const out = new Set<number>();
  const srs = radarSrOf(d, o);
  if (srs.length === 0) return out;
  const sc = d.ww.scenario;
  const econ = d.ww.economy;
  for (const id of srs) {
    for (const r of sc.sr(id)?.members ?? []) {
      const c = econ.controllerOf(r);
      if (c > 0 && c !== o) out.add(c);
    }
  }
  return out;
}

function observerCtx(d: WwDepth, o: number): ObserverCtx {
  const c = d.country(o);
  const zones = harbourZones(d);
  const seaNb = new Set<number>();
  for (const z of zones.byCountry[o] ?? []) {
    for (const x of zones.byZone.get(z) ?? []) if (x !== o) seaNb.add(x);
  }
  const infiltrated = new Map<number, number>();
  for (const [x, t, dom] of d.infiltrations) {
    if (x === o) infiltrated.set(t, (infiltrated.get(t) ?? 0) | (1 << dom));
  }
  return {
    o,
    dept: DEPARTMENT.map((u) => hasUp(c, u)),
    landNb: new Set(d.ww.economy.countryNeighbours(o)),
    seaNb,
    sharers: intelSharers(d, o),
    infiltrated,
    radar: radarTargets(d, o),
    intelPct: statOf(d, o, "intelPct"),
  };
}

/** Spec §8.8: the four inputs of `o` on `t` (domain-specific lines set per domain). */
function inputsOn(d: WwDepth, x: ObserverCtx, t: number): IntelInput[] {
  const o = x.o;
  let net = d.netMilli(o, t);
  let decrypted = decryptedOwn(d, o, t);
  for (const m of x.sharers) {
    net = Math.max(net, Math.floor(d.netMilli(m, t) / 2));
    if (!decrypted && decryptedOwn(d, m, t)) decrypted = true;
  }
  const base = {
    sameFaction: d.ww.sameFaction(o, t),
    neighbour: x.landNb.has(t) || x.seaNb.has(t),
    atWar: d.ww.isAtWar(o, t),
    networkMilliPm: net,
    decrypted,
    exploiting: exploiting(d, o, t),
    targetCounterMissions: counterMissions(d, t),
    intelPct: x.intelPct,
  };
  const mask = x.infiltrated.get(t) ?? 0;
  const recon = reconCovers(d, o, t);
  const skirmisher = skirmisherContact(d, o, t);
  return DOMAINS.map((dom) => ({
    ...base,
    domain: dom,
    department: x.dept[dom],
    infiltrated: (mask & (1 << dom)) !== 0,
    recon: dom === ID_ARMY && recon,
    skirmisher: dom === ID_ARMY && skirmisher,
    radar: dom === ID_AIR && x.radar.has(t),
  }));
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
  void day;
  const row = d.intelRow(observer);
  const x = observerCtx(d, observer);
  let changed = false;
  for (let t = 1; t < d.cap; t++) {
    const at = t * 4;
    if (t === observer) {
      for (let k = 0; k < 4; k++) {
        if (row[at + k] !== 100) {
          row[at + k] = 100;
          changed = true;
        }
      }
      continue;
    }
    if (!d.ww.isActor(t)) continue;
    const ins = inputsOn(d, x, t);
    for (let k = 0; k < 4; k++) {
      const v = intelLevel(ins[k]);
      if (row[at + k] !== v) {
        row[at + k] = v;
        changed = true;
      }
    }
  }
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
  const x = observerCtx(d, observer);
  const out: [number, number, string, number][] = [];
  for (let t = 1; t < d.cap; t++) {
    if (t === observer || !d.ww.isActor(t)) continue;
    const ins = inputsOn(d, x, t);
    for (let k = 0; k < 4; k++) {
      for (const [key, v] of levelLines(ins[k])) out.push([t, k, key, v]);
    }
  }
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
