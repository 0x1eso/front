// World War 1936 P4: the air AI (P4 spec §17.1, §17.3). Every 5 days at
// war (10 at peace) an AI country sets its deployments' target counts:
// fighters over its fronts (by the enemy divisions and planes there) and
// where it was bombed, close support and tactical bombers over the fronts
// it attacks on, naval bombers over spotted enemy fleets and over its
// convoy lanes that lose ships, strategic bombers over the enemy industry
// it holds 300‰ of the sky above, transports over its encircled regions.
// Each type puts 90% of its planes on those demands in proportion; the
// fighters' other 10% intercept over the capital. A zone where planes
// fall fast and the sky is the enemy's (losses > 15% in 5 days, < 200‰)
// gets no bombers. aiAirPlan is pure; aiAir reads what a player's
// screens show and orders through air.issue. No randomness.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  AirMission,
  AirOrder,
  AirType,
  WW_MAX_DEPLOY_COUNT,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { TPL_PARA_ANY } from "@openfront/engine-api/ww1936/LandTypes";
import { paradropBlockOf } from "@openfront/engine-lib/ww1936/AirRules";
import { NAVAL_BEATS } from "@openfront/engine-lib/ww1936/NavalBeats";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import { effectiveBuildings, effectiveLevel } from "../economy/Buildings";
import { capitalRegion } from "../land/LandStartRun";
import { enemyDivisionsIn } from "../land/Movement";
import type { Army } from "../land/WwLand";
import {
  activeBeatTargets,
  AI_BEAT_FACTOR,
  aiAtWar,
  beatWindow,
} from "../navy/AiNavy";
import { paradropAskOf } from "./Paradrop";
import type { WwAir } from "./WwAir";

/** Spec §17.3-2: the share of each type's planes put on the demands. */
export const AI_AIR_USE_PCT = 90;
/**
 * Task 15 (내 판단): the share of its fighters a country keeps over its
 * capital (spec §17.3-2's 10% for the rest). Britain kept Fighter Command
 * at home (Dowding's line, May 1940: a dozen squadrons went to France):
 * at 10%, then 40%, its fighters over France gave the Allies the sky there
 * in every game and the Luftwaffe was gone by 1941.
 */
export const AI_FIGHTER_HOME_PCT: Readonly<
  Partial<Record<CountryTag, number>>
> = { GBR: 70 };
/** Spec §17.3-3: a zone losing more than this ‰ of its planes in 5 days… */
export const AI_AIR_LOSS_PM = 150;
/** …under this superiority loses its bombers. */
export const AI_AIR_LOSS_SUP_PM = 200;
/**
 * Task 15 (내 판단, spec §17.3-3 for fighters): after losses there (over
 * AI_FIGHTER_LOSS_PM of them in 5 days) under a sky below
 * AI_FIGHTER_HOLD_SUP_PM, fighters give up a zone — superiority and
 * interception — unless our army attacks there, it is the capital's or a
 * beat calls; they fight where the odds are better and are there for the
 * next offensive. Germany sent its whole fighter force over the Maginot
 * line in the Phoney War and lost it in a month, every game.
 */
export const AI_FIGHTER_LOSS_PM = 50;
export const AI_FIGHTER_HOLD_SUP_PM = 400;
/** Spec §17.3-1 ④: strategic bombing only where we hold this much of the sky. */
export const AI_STRAT_SUP_PM = 300;

/** The land-based types the AI deploys (the carriers' wings fly from decks). */
const FIGHTERS: readonly AirType[] = ["fighter", "heavy_fighter"];
const BOMBERS: readonly AirType[] = [
  "bomber",
  "cas",
  "naval_bomber",
  "strat_bomber",
];
/** Missions each type takes, in preference order (spec §14.1). */
const TYPE_MISSIONS: Readonly<Partial<Record<AirType, readonly AirMission[]>>> =
  {
    fighter: ["air_superiority", "interception"],
    heavy_fighter: ["air_superiority", "interception"],
    cas: ["cas"],
    bomber: ["cas", "strategic_bombing"],
    naval_bomber: ["naval_strike", "naval_patrol"],
    strat_bomber: ["strategic_bombing"],
    transport_plane: ["air_supply"],
  };

/** One air zone (strategic region), as the plan reads it. */
export interface AiAirZoneView {
  sr: number;
  kind: "land" | "sea";
  /** Our front runs through it: enemy divisions next to our regions here. */
  front: boolean;
  enemyDivisions: number;
  /** Enemy sorties over it yesterday (all types). */
  enemyPlanes: number;
  /** One of our divisions attacks in a battle here. */
  attacking: boolean;
  /** Enemy bombers flew over our regions here and we took bombs lately. */
  bombed: boolean;
  /** Sea: an enemy fleet here spotted by our side. */
  enemyFleet: boolean;
  /** Sea: our convoys lose ships here. */
  convoyLoss: boolean;
  /** Land: the enemy's industry here (civilian + military + dockyards, no no-strike region). */
  industry: number;
  /** Our side's air superiority yesterday ‰. */
  supPm: number;
  /** One of our regions here is encircled. */
  encircled: boolean;
  /** Our planes lost here over 5 days, ‰ of those deployed. */
  lossPm: number;
  /** Per AIR_TYPES index: one of our bases reaches it. */
  reach: readonly boolean[];
  /** An air campaign history beat's window covers it (×10, spec §17.6). */
  beat: boolean;
}

/** A current deployment group's target. */
export interface AiAirTarget {
  sr: number;
  type: AirType;
  mission: AirMission;
  count: number;
}

export interface AiAirInput {
  smallID: number;
  day: number;
  atWar: boolean;
  /** Per AIR_TYPES index: planes in stock and deployed (the ones the AI commands). */
  planes: readonly number[];
  zones: readonly AiAirZoneView[];
  /** The capital's air zone (0: none). */
  capitalSr: number;
  /** The targets now (a human's: its auto zones only). */
  current: readonly AiAirTarget[];
  /** Zones the plan may change (undefined: all; a human: its auto zones). */
  only?: readonly number[];
  /** Task 15: percent of the fighters kept over the capital (default 100 − AI_AIR_USE_PCT). */
  fighterHomePct?: number;
}
/** An order the AI gives through air.issue (the same as a player's). */
export type AiAirOrder = AirOrder;

interface Demand {
  sr: number;
  mission: AirMission;
  weight: number;
}

/** Spec §17.3-1: the day's demands of one type, zone order. */
function demandsOf(
  type: AirType,
  i: AiAirInput,
  ti: number,
  noBombers: ReadonlySet<number>,
  noFighters: ReadonlySet<number> = new Set(),
): Demand[] {
  const out: Demand[] = [];
  const missions = TYPE_MISSIONS[type] ?? [];
  const bomber = BOMBERS.includes(type);
  const casWanted = i.zones.some((z) => z.front && z.attacking);
  for (const z of i.zones) {
    if (!z.reach[ti]) continue;
    if (bomber && noBombers.has(z.sr)) continue;
    const beat = z.beat ? AI_BEAT_FACTOR : 1;
    for (const m of missions) {
      let w = 0;
      if (m === "air_superiority" && z.kind === "land") {
        if (z.front && !noFighters.has(z.sr)) {
          w = 1 + z.enemyDivisions + Math.floor(z.enemyPlanes / 10);
        }
        w *= beat;
        if (w === 0 && z.beat) w = AI_BEAT_FACTOR;
      } else if (m === "interception" && z.bombed && !noFighters.has(z.sr)) {
        w = 2 + Math.floor(z.enemyPlanes / 10);
      } else if (m === "cas" && z.front && z.attacking) {
        w = 1 + z.enemyDivisions;
      } else if (
        m === "strategic_bombing" &&
        z.kind === "land" &&
        z.industry > 0 &&
        z.supPm >= AI_STRAT_SUP_PM &&
        // A tactical bomber bombs industry only when no attack needs it.
        (type !== "bomber" || !casWanted)
      ) {
        w = z.industry * beat;
      } else if (m === "naval_strike" && z.kind === "sea" && z.enemyFleet) {
        w = 3;
      } else if (m === "naval_patrol" && z.kind === "sea" && z.convoyLoss) {
        w = 2;
      } else if (m === "air_supply" && z.encircled) {
        w = 1;
      }
      if (w > 0) out.push({ sr: z.sr, mission: m, weight: w });
    }
  }
  return out;
}

/** `n` over the weights: floors, then one more each to the biggest remainders (ties: list order). */
function share(n: number, weights: readonly number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || n <= 0) return weights.map(() => 0);
  const out = weights.map((w) => Math.floor((n * w) / total));
  let left = n - out.reduce((a, b) => a + b, 0);
  const rest = weights
    .map((w, k) => ({ k, r: (n * w) % total }))
    .sort((a, b) => b.r - a.r || a.k - b.k);
  for (const { k } of rest) {
    if (left <= 0) break;
    out[k]++;
    left--;
  }
  return out;
}

const keyOf = (sr: number, type: AirType, mission: AirMission) =>
  sr * 1000 + AIR_TYPES.indexOf(type) * 20 + AIR_MISSIONS.indexOf(mission);

/** Pure: the deployments of the day as target counts (spec §17.3). */
export function aiAirPlan(input: AiAirInput): AiAirOrder[] {
  const targets = new Map<number, AiAirTarget>();
  const set = (sr: number, type: AirType, mission: AirMission, n: number) => {
    if (n <= 0) return;
    const k = keyOf(sr, type, mission);
    const t = targets.get(k);
    if (t === undefined) targets.set(k, { sr, type, mission, count: n });
    else t.count += n;
  };
  // Spec §17.3-3: heavy losses under an enemy sky — no bombers there.
  const noBombers = new Set(
    input.zones
      .filter((z) => z.lossPm > AI_AIR_LOSS_PM && z.supPm < AI_AIR_LOSS_SUP_PM)
      .map((z) => z.sr),
  );
  // Task 15: the fighters' own rule (AI_FIGHTER_HOLD_SUP_PM).
  const noFighters = new Set(
    input.zones
      .filter(
        (z) =>
          z.lossPm > AI_FIGHTER_LOSS_PM &&
          z.supPm < AI_FIGHTER_HOLD_SUP_PM &&
          !z.attacking &&
          !z.beat &&
          z.sr !== input.capitalSr,
      )
      .map((z) => z.sr),
  );
  AIR_TYPES.forEach((type, ti) => {
    if (TYPE_MISSIONS[type] === undefined) return;
    const total = input.planes[ti] ?? 0;
    if (total <= 0) return;
    const fighter = FIGHTERS.includes(type);
    const usePct =
      fighter && input.fighterHomePct !== undefined
        ? 100 - input.fighterHomePct
        : AI_AIR_USE_PCT;
    const usable = Math.floor((total * usePct) / 100);
    let reserve = fighter ? total - usable : 0;
    if (input.atWar) {
      const demands = demandsOf(
        type,
        input,
        ti,
        noBombers,
        fighter ? noFighters : undefined,
      );
      const given = share(
        usable,
        demands.map((d) => d.weight),
      );
      demands.forEach((d, k) => set(d.sr, type, d.mission, given[k]));
      // Fighters with nothing to do guard the capital too.
      if (fighter && demands.length === 0) reserve += usable;
    }
    if (reserve > 0 && input.capitalSr !== 0) {
      const z = input.zones.find((x) => x.sr === input.capitalSr);
      if (z === undefined || z.reach[ti]) {
        set(input.capitalSr, type, "interception", reserve);
      }
    }
  });
  // The orders: every group whose target changes, zone, type, mission order.
  const only = input.only === undefined ? null : new Set(input.only);
  const keys = new Set<number>(targets.keys());
  const now = new Map<number, number>();
  for (const c of input.current) {
    const k = keyOf(c.sr, c.type, c.mission);
    now.set(k, (now.get(k) ?? 0) + c.count);
    keys.add(k);
  }
  const orders: AiAirOrder[] = [];
  for (const k of [...keys].sort((a, b) => a - b)) {
    const sr = Math.floor(k / 1000);
    if (only !== null && !only.has(sr)) continue;
    const type = AIR_TYPES[Math.floor((k % 1000) / 20)];
    const mission = AIR_MISSIONS[k % 20];
    const want = Math.min(WW_MAX_DEPLOY_COUNT, targets.get(k)?.count ?? 0);
    if (want === (now.get(k) ?? 0)) continue;
    orders.push({ kind: "air_deploy", sr, type, mission, count: want });
  }
  return orders;
}

// ---- The engine side ----

/** Spec §17.1: at war every 5 days, else every 10. */
export function aiAirDue(
  smallID: number,
  day: number,
  atWar: boolean,
): boolean {
  return atWar ? (day + smallID) % 5 === 0 : (day + smallID) % 10 === 0;
}

/** One zone as every country of a side with the same enemies sees it (a tick's memo). */
interface AirZoneShared {
  enemyPlanes: number;
  enemyBombers: number;
  /** An enemy region here borders our side. */
  front: boolean;
  enemyDivisions: number;
  /** Bombable enemy industry (civilian + military + dockyards). */
  industry: number;
  /** A spotted enemy fleet (sea). */
  enemyFleet: boolean;
  /** km from our side's nearest working air base; -1: none. */
  minKm: number;
}

/**
 * Derived, never state: km from the nearest of a set of air bases to each
 * zone (srIdx order), by the set itself (bases change rarely: built,
 * bombed, taken). Bounded (cleared at 512 sets).
 */
const reachByBases = new WeakMap<WwAir, Map<string, Int32Array>>();

function basesReach(air: WwAir, bases: readonly number[]): Int32Array {
  let m = reachByBases.get(air);
  if (m === undefined) {
    m = new Map();
    reachByBases.set(air, m);
  }
  const key = bases.join(",");
  const hit = m.get(key);
  if (hit !== undefined) return hit;
  const sc = air.ww.scenario;
  const list = sc.strategicList();
  const out = new Int32Array(list.length).fill(-1);
  for (const s of list) {
    for (const b of bases) {
      const km = sc.srKm(b, s.id);
      if (out[s.idx] < 0 || km < out[s.idx]) out[s.idx] = km;
    }
  }
  if (m.size >= 512) m.clear();
  m.set(key, out);
  return out;
}

/** Derived (one tick): the zones by (side, enemies), srIdx order. */
const airShared = new WeakMap<
  WwAir,
  { tick: number; m: Map<string, AirZoneShared[]> }
>();

function airSharedView(air: WwAir, me: number): AirZoneShared[] {
  const land = air.land;
  const ww = air.ww;
  const sc = ww.scenario;
  const econ = air.econ;
  const navy = air.navy;
  const side = land.sideOf(me);
  const enemies = ww
    .enemiesOf(me)
    .filter((e) => land.isEnemy(me, e))
    .sort((a, b) => a - b);
  const key = `${side}|${enemies.join(",")}`;
  const tick = air.mg.ticks();
  let memo = airShared.get(air);
  if (memo === undefined || memo.tick !== tick) {
    memo = { tick, m: new Map() };
    airShared.set(air, memo);
  }
  const hit = memo.m.get(key);
  if (hit !== undefined) return hit;
  const foes = new Set(enemies);
  const enemy = (c: number) => foes.has(c);
  // Our side's working air bases (its members' regions held by the side).
  const members = land.sideMembers(side);
  const bases: number[] = [];
  for (const m of members.length === 0 ? [me] : members) {
    for (const r of econ.regionsOf(m)) {
      if (!land.sameSide(me, land.controller[r])) continue;
      if (effectiveLevel(econ, r, "air_base") >= 1) bases.push(r);
    }
  }
  bases.sort((a, b) => a - b);
  const minKm = basesReach(air, bases);
  const enemySides = new Set<number>();
  for (const sd of land.sideList()) {
    if (sd.members.some((m) => enemy(m))) enemySides.add(sd.key);
  }
  const bomberTypes = [
    AIR_TYPES.indexOf("bomber"),
    AIR_TYPES.indexOf("strat_bomber"),
  ];
  const list = sc.strategicList();
  const out: AirZoneShared[] = list.map((s) => {
    const z = air.zoneState[s.idx];
    const v: AirZoneShared = {
      enemyPlanes: 0,
      enemyBombers: 0,
      front: false,
      enemyDivisions: 0,
      industry: 0,
      enemyFleet: false,
      minKm: minKm[s.idx],
    };
    for (const [k, sorties] of z.sorties) {
      if (k === side || !enemySides.has(k)) continue;
      for (const n of sorties) v.enemyPlanes += n;
      for (const t of bomberTypes) v.enemyBombers += sorties[t] ?? 0;
    }
    return v;
  });
  // The enemy's regions: its industry, its front with us (sums: any order).
  for (const e of enemies) {
    for (const r of econ.regionsOf(e)) {
      if (!enemy(land.controller[r] ?? 0)) continue;
      const i = sc.srIdxOf(sc.regionSr(r));
      if (i < 0) continue;
      const v = out[i];
      // bombableRegions' rule: never a no-strike region.
      if (!isNoStrike(sc, r)) {
        v.industry +=
          effectiveBuildings(econ, r, "civ") +
          effectiveBuildings(econ, r, "mil") +
          effectiveBuildings(econ, r, "dock");
      }
      if (sc.edgesOf(r).some((x) => land.sameSide(me, land.controller[x.to]))) {
        v.front = true;
        v.enemyDivisions += enemyDivisionsIn(land, me, r);
      }
    }
    // Its fleets our side has spotted.
    for (const f of navy.fleetsOf(e)) {
      const i = sc.srIdxOf(sc.zoneSr(f.zone));
      if (i >= 0 && navy.spotted(side, f.id)) out[i].enemyFleet = true;
    }
  }
  memo.m.set(key, out);
  return out;
}

const NO_SRS: ReadonlySet<number> = new Set();

/** Derived (one tick, Task 15's perf pass): the zones each country attacks in, from the land battles. */
const attackMemo = new WeakMap<
  WwAir,
  { tick: number; m: Map<number, Set<number>> }
>();

function attackingSrs(air: WwAir): ReadonlyMap<number, ReadonlySet<number>> {
  const tick = air.mg.ticks();
  const hit = attackMemo.get(air);
  if (hit !== undefined && hit.tick === tick) return hit.m;
  const land = air.land;
  const sc = air.ww.scenario;
  const t = land.divisions;
  const m = new Map<number, Set<number>>();
  for (const b of land.battles.values()) {
    const sr = sc.regionSr(b.region);
    for (const id of b.attackers) {
      const row = t.rowOf(id);
      if (row < 0) continue;
      const o = t.owner[row];
      let set = m.get(o);
      if (set === undefined) m.set(o, (set = new Set()));
      set.add(sr);
    }
  }
  attackMemo.set(air, { tick, m });
  return m;
}

/** What the plan reads of `smallID`'s air war today. */
export function aiAirInput(
  air: WwAir,
  smallID: number,
  day: number,
  atWar: boolean,
  human: boolean,
): AiAirInput {
  const ww = air.ww;
  const sc = ww.scenario;
  const land = air.land;
  const navy = air.navy;
  const econ = air.econ;
  const side = land.sideOf(smallID);
  const ce = econ.country(smallID)!;
  const ca = air.country(smallID)!;
  const only = human ? [...ca.autoZones] : undefined;
  const commanded = (sr: number) => only === undefined || only.includes(sr);
  // Planes: the stock and the deployments the AI commands.
  const planes = AIR_TYPES.map((type) => {
    let n = 0;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      n += ce.stock[equipKey(type, g)] ?? 0;
    }
    return n;
  });
  const current: AiAirTarget[] = [];
  const deployedIn = new Map<number, number>();
  for (const d of air.deploymentsOf(smallID)) {
    if (d.base < 0 || !commanded(d.sr)) continue;
    const n = d.counts.reduce((a, b) => a + b, 0);
    planes[d.type] += n;
    deployedIn.set(d.sr, (deployedIn.get(d.sr) ?? 0) + n);
    // Every record of a group carries the group's target: count it once.
    const type = AIR_TYPES[d.type];
    const mission = AIR_MISSIONS[d.mission];
    if (
      !current.some(
        (c) => c.sr === d.sr && c.type === type && c.mission === mission,
      )
    ) {
      current.push({ sr: d.sr, type, mission, count: d.target });
    }
  }
  // Lane A1's rule (Deploy.bestRange): generation 1's range, or the best
  // of the generations it has in the stock or out.
  const has = new Set<number>();
  for (const d of air.deploymentsOf(smallID)) {
    d.counts.forEach((c, g) => {
      if (c > 0) has.add(d.type * 8 + g + 1);
    });
  }
  const range = AIR_TYPES.map((type, ti) => {
    let km = air.planeStatsOf(smallID, type, 1).rangeKm;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      if ((ce.stock[equipKey(type, g)] ?? 0) > 0 || has.has(ti * 8 + g)) {
        km = Math.max(km, air.planeStatsOf(smallID, type, g).rangeKm);
      }
    }
    return km;
  });
  // Air campaigns, and the sky over a paradrop's target (70% needed).
  const beatRegions = new Set([
    ...activeBeatTargets(navy, smallID, day, "air_campaign"),
    ...activeBeatTargets(navy, smallID, day, "paradrop"),
  ]);
  const beatSrs = new Set([...beatRegions].map((r) => sc.regionSr(r)));
  const bombsTaken = ca.bombTaken.reduce((a, b) => a + b, 0) > 0;
  const shared = airSharedView(air, smallID);
  // Ours: regions held, encircled, attacked from.
  const mineSr = new Set<number>();
  const encircledSr = new Set<number>();
  for (const r of econ.regionsOf(smallID)) {
    if (land.controller[r] !== smallID) continue;
    const sr = sc.regionSr(r);
    mineSr.add(sr);
    if (land.encircled[r] === 1) encircledSr.add(sr);
  }
  const attackingSr = attackingSrs(air).get(smallID) ?? NO_SRS;
  const zones: AiAirZoneView[] = [];
  // One reach row per distance (most zones are out of reach: -1).
  const reachByKm = new Map<number, readonly boolean[]>();
  const reachOf = (minKm: number) => {
    let r = reachByKm.get(minKm);
    if (r === undefined) {
      r = range.map((km) => minKm >= 0 && minKm <= km);
      reachByKm.set(minKm, r);
    }
    return r;
  };
  for (const s of sc.strategicList()) {
    const z = air.zoneState[s.idx];
    const v = shared[s.idx];
    let convoyLoss = false;
    if (s.kind === "sea") {
      const st = navy.srState[s.idx];
      convoyLoss =
        (st?.lossYesterday.get(smallID) ?? 0) > 0 ||
        (st?.lossRate.get(side) ?? 0) > 0;
    }
    const enemyPlanes = v.enemyPlanes;
    const front = s.kind === "land" && v.front;
    const enemyDivisions = v.enemyDivisions;
    const attacking = s.kind === "land" && attackingSr.has(s.id);
    const industry = atWar ? v.industry : 0;
    const encircled = encircledSr.has(s.id);
    const mine = mineSr.has(s.id);
    const enemyFleet = v.enemyFleet;
    const enemyBombers = v.enemyBombers;
    const minKm = v.minKm;
    // Losses: yesterday's × 5 for the five days (the zone keeps one day).
    const lost = (z.result.get(smallID)?.[1] ?? 0) * 5;
    const deployed = deployedIn.get(s.id) ?? 0;
    zones.push({
      sr: s.id,
      kind: s.kind,
      front: atWar && front,
      enemyDivisions,
      enemyPlanes,
      attacking,
      bombed: mine && bombsTaken && enemyBombers > 0,
      enemyFleet,
      convoyLoss,
      industry,
      supPm: air.airSup(side, s.id),
      encircled,
      lossPm: deployed === 0 ? 0 : Math.floor((lost * 1000) / deployed),
      reach: reachOf(minKm),
      beat: beatSrs.has(s.id),
    });
  }
  const cap = capitalRegion(land, smallID);
  const home = human ? undefined : AI_FIGHTER_HOME_PCT[ce.tag];
  return {
    smallID,
    day,
    atWar,
    planes,
    zones,
    capitalSr: cap === 0 ? 0 : sc.regionSr(cap),
    current,
    ...(only === undefined ? {} : { only }),
    ...(home === undefined ? {} : { fighterHomePct: home }),
  };
}

/** Whether `smallID` has a plane of any type in its stock or deployed. */
function hasPlanes(air: WwAir, smallID: number): boolean {
  const ce = air.econ.country(smallID);
  if (ce === null) return false;
  for (const type of AIR_TYPES) {
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      if ((ce.stock[equipKey(type, g)] ?? 0) > 0) return true;
    }
  }
  return air.deploymentsOf(smallID).some((d) => d.counts.some((c) => c > 0));
}

/** The country's AI day for its air force (an AI country's all, a human's auto zones). */
export function aiAir(air: WwAir, smallID: number, day: number): void {
  const p = air.mg.playerBySmallID(smallID);
  const ca = air.country(smallID);
  if (!p.isPlayer() || ca === null || air.econ.country(smallID) === null) {
    return;
  }
  // P5 plan decision 7: a human controls it now.
  const human = air.ww.isHumanControlled(smallID);
  if (human && ca.autoZones.length === 0) return;
  const atWar = aiAtWar(air.navy, smallID);
  if (!aiAirDue(smallID, day, atWar)) return;
  const tick = air.mg.ticks();
  // Task 15's perf pass: no planes in the stock or out, nothing to plan
  // (most small countries; their input was built for nothing).
  if (hasPlanes(air, smallID)) {
    for (const o of aiAirPlan(aiAirInput(air, smallID, day, atWar, human))) {
      air.issue(smallID, o, tick);
    }
  }
  if (!human) aiParadrops(air, smallID, day, atWar);
}

// ---- Paradrops (lane AI review; spec §14.10, §17.6: Crete) ----

/** 내 판단: the paratrooper force an AI raises for a paradrop beat. */
export const AI_PARA_DIVISIONS = 3;
export const AI_PARA_BATTALIONS = 4;
/** 내 판단: it starts this long before the beat (a paratrooper battalion trains 150 days). */
export const AI_PARA_LEAD_DAYS = 240;
/** Targets tried a day (each one a judge of the order). */
const AI_PARA_TRIES = 5;

/** Every division of `a` is a paratrooper's (P2's drop condition). */
export function isParaArmy(land: WwAir["land"], a: Army): boolean {
  if (a.divisions.length === 0) return false;
  const t = land.divisions;
  return a.divisions.every((id) => {
    const r = t.rowOf(id);
    return r >= 0 && (land.baseStatsOf(r).flags & TPL_PARA_ANY) !== 0;
  });
}

/** `me`'s paratrooper templates, by id. */
function paraTemplates(land: WwAir["land"], me: number): number[] {
  const out: number[] = [];
  for (const tpl of land.country(me)?.templates ?? []) {
    const st = land.templateStatsOf(me, tpl.id);
    if (st !== null && (st.flags & TPL_PARA_ANY) !== 0) out.push(tpl.id);
  }
  return out;
}

/** A paradrop beat of `me`'s from its lead time to its window's end (historical AI). */
function paraBeatAhead(air: WwAir, me: number, day: number): boolean {
  const mg = air.mg;
  if (mg.config().historicalAi() !== true) return false;
  const tag = air.ww.scenario.tagOfSmallId(me);
  return NAVAL_BEATS.some((b, i) => {
    if (b.tag !== tag || b.kind !== "paradrop") return false;
    const roll = air.navy.beats[i];
    if (roll === undefined || roll[2]) return false;
    const w = beatWindow(b, roll[1], 0);
    return day >= w[0] - AI_PARA_LEAD_DAYS && day <= w[1];
  });
}

/**
 * Pure: a paradrop target's score — (VP + 5) × 100 / (1 + enemy
 * divisions × 3), ×10 for a beat's target; an ordinary target must stand
 * empty (a drop is no assault but on a beat).
 */
export function aiParadropScore(i: {
  vp: number;
  divisions: number;
  beat: boolean;
}): number {
  if (!i.beat && i.divisions > 0) return 0;
  const s = Math.floor(((i.vp + 5) * 100) / (1 + i.divisions * 3));
  return i.beat ? s * AI_BEAT_FACTOR : s;
}

/**
 * The AI's paradrops: before a paradrop beat (from AI_PARA_LEAD_DAYS) it
 * raises a paratrooper template and three divisions; at war, an army all
 * of paratroopers drops on the best target the air war's judge allows
 * (paradropAskOf / paradropBlockOf: an air base, the transports' range
 * and number, 70% of the sky) — the beat's targets (×10, never a
 * no-strike region) or an empty enemy city of 5 victory points or more.
 * Out of range of a beat's target it first goes to our air base nearest
 * it. Orders only (land.issue), no memory.
 */
export function aiParadrops(
  air: WwAir,
  me: number,
  day: number,
  atWar: boolean,
): void {
  const land = air.land;
  const sc = air.ww.scenario;
  const ce = air.econ.country(me);
  const cl = land.country(me);
  if (ce === null || cl === null) return;
  const issue = (o: WwOrder) => land.issue(me, o, "ai") === null;
  if (ce.researched.has("paratroopers") && paraBeatAhead(air, me, day)) {
    const tpls = paraTemplates(land, me);
    if (tpls.length === 0) {
      issue({
        kind: "template_save",
        template: 0,
        base: cl.templates[0]?.id ?? 0,
        name: "",
        battalions: new Array(AI_PARA_BATTALIONS).fill("paratrooper"),
        support: [],
      });
    } else {
      const t = land.divisions;
      let n = 0;
      for (const a of land.armiesOf(me)) {
        for (const id of a.divisions) {
          const r = t.rowOf(id);
          if (r >= 0 && tpls.includes(t.template[r])) n++;
        }
      }
      for (const e of cl.training)
        if (tpls.includes(e.template)) n += e.remaining;
      for (const x of cl.trainees) if (tpls.includes(x.template)) n++;
      if (n < AI_PARA_DIVISIONS) {
        issue({
          kind: "train",
          template: tpls[0],
          count: AI_PARA_DIVISIONS - n,
          army: 0,
          region: 0,
        });
      }
    }
  }
  if (!atWar) return;
  const armies = land
    .armiesOf(me)
    .filter(
      (a) =>
        a.order.kind !== "paradrop" &&
        a.order.kind !== "invade" &&
        !(a.order.kind === "plan" && a.order.executing) &&
        isParaArmy(land, a),
    );
  if (armies.length === 0) return;
  const beats = activeBeatTargets(air.navy, me, day, "paradrop");
  const targets: { r: number; score: number; beat: boolean }[] = [];
  for (const reg of sc.landRegions) {
    const c = land.controller[reg.id] ?? 0;
    if (c === 0 || !land.isEnemy(me, c) || isNoStrike(sc, reg.id)) continue;
    const beat = beats.has(reg.id);
    if (!beat && reg.vp < 5) continue;
    const score = aiParadropScore({
      vp: reg.vp,
      divisions: enemyDivisionsIn(land, me, reg.id),
      beat,
    });
    if (score > 0) targets.push({ r: reg.id, score, beat });
  }
  targets.sort((a, b) => b.score - a.score || a.r - b.r);
  const top = targets.slice(0, AI_PARA_TRIES);
  for (const a of armies) {
    for (const t of top) {
      const block = paradropBlockOf(paradropAskOf(air, a, t.r));
      if (block === null) {
        if (issue({ kind: "paradrop", army: a.id, region: t.r })) return;
        continue;
      }
      if (!t.beat || (block !== "no_air_base" && block !== "out_of_range")) {
        continue;
      }
      // A beat's target out of reach: to our air base nearest it, in range.
      const range = air.planeStatsOf(me, "transport_plane", 1).rangeKm;
      const to = sc.centerTile(t.r);
      let best = 0;
      let bestKm = Infinity;
      for (const reg of sc.landRegions) {
        if (land.controller[reg.id] !== me) continue;
        if (effectiveLevel(air.econ, reg.id, "air_base") < 1) continue;
        const km = sc.kmBetween(sc.centerTile(reg.id), to);
        if (km <= range && km < bestKm) {
          best = reg.id;
          bestKm = km;
        }
      }
      if (best === 0 || land.armyRegion(a) === best) continue;
      if (a.order.kind === "move" && a.order.to === best) break;
      if (!issue({ kind: "army_rail", army: a.id, region: best })) {
        issue({ kind: "army_move", army: a.id, region: best });
      }
      break;
    }
  }
}
