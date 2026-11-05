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
  Wing,
  WING_AUTO_FERRY_DAYS,
  WP_BACK,
  WP_OUT,
  WP_STATION,
  WW_BOMB_CLASSES,
  WW_FIELD_STRIP_MAX,
  WW_FIELD_STRIP_PLANES,
  WW_MAX_DEPLOY_COUNT,
  WW_PARADROP_AIRSUP_PM,
  WW_WING_FORM_MIN,
  WW_WING_RESERVE_MIN,
  type WingOrder,
  type WwBombClass,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_GENS,
  RESOURCE_IDS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ROLE_ATTACK,
  TPL_PARA_ANY,
} from "@openfront/engine-api/ww1936/LandTypes";
import { paradropBlockOf } from "@openfront/engine-lib/ww1936/AirRules";
import { NAVAL_BEATS } from "@openfront/engine-lib/ww1936/NavalBeats";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import { historicalAiActive } from "@openfront/engine-lib/ww1936/Pace";
import {
  wingMaxPlanes,
  wingUnderStrength,
} from "@openfront/engine-lib/ww1936/WingRules";
import {
  AI_RECON_PCT,
  aiNightWings,
  homeSeaRegions,
  isDepthDeployment,
} from "../depth/AiSeaAir";
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
import { bombTableOf, tableWeight, type BombTable } from "./Bombing";
import { deckSlotOf, isCarrierWing, stockOf } from "./Deploy";
import { paradropAskOf } from "./Paradrop";
import { wingStats } from "./Sorties";
import { baseUsesOf } from "./Wings";
import { wingPlanes, type WwAir } from "./WwAir";

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
  /** ww8: one of our side's regions here borders an enemy region (the battles on our land). */
  homeFront: boolean;
  /** ww8: the most enemy divisions next to one of those regions. */
  homeDivisions: number;
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
      homeFront: false,
      homeDivisions: 0,
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
      let divisions = -1;
      for (const x of sc.edgesOf(r)) {
        if (!land.sameSide(me, land.controller[x.to])) continue;
        if (divisions < 0) {
          divisions = enemyDivisionsIn(land, me, r);
          v.front = true;
          v.enemyDivisions += divisions;
        }
        const j = sc.srIdxOf(sc.regionSr(x.to));
        if (j < 0) continue;
        out[j].homeFront = true;
        out[j].homeDivisions = Math.max(out[j].homeDivisions, divisions);
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
  for (const d of air.wingsOf(smallID)) {
    // P6 (spec §19.7): the recon groups are the depth AI's (AiSeaAir): no
    // recall, and their planes are not P4's to place.
    if (d.base < 0 || !commanded(d.sr) || isDepthDeployment(d)) continue;
    // P6 (lane E): a record's design planes fly with its static ones.
    const n = wingPlanes(d);
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
      current.push({ sr: d.sr, type, mission, count: d.goalCount });
    }
  }
  // Lane A1's rule (Deploy.bestRange): generation 1's range, or the best
  // of the generations it has in the stock or out.
  const has = new Set<number>();
  for (const d of air.wingsOf(smallID)) {
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
  return air.wingsOf(smallID).some((d) => d.counts.some((c) => c > 0));
}

/**
 * The country's AI day for its air force (an AI country's all, a human's
 * auto zones; automation: a human's all, as an AI country's, without the
 * paradrops, which raise and train paratroopers).
 */
export function aiAir(air: WwAir, smallID: number, day: number): void {
  const p = air.mg.playerBySmallID(smallID);
  const ca = air.country(smallID);
  if (!p.isPlayer() || ca === null || air.econ.country(smallID) === null) {
    return;
  }
  // P5 plan decision 7: a human controls it now.
  const human = air.ww.isHumanControlled(smallID);
  // Automation (owner brief 2026-10-30): every zone, as the AI plans its own.
  const zonesOnly = human && !air.ww.autoOn(smallID, "air");
  if (zonesOnly && ca.autoZones.length === 0) return;
  const atWar = aiAtWar(air.navy, smallID);
  if (!aiAirDue(smallID, day, atWar)) return;
  const tick = air.mg.ticks();
  // Task 15's perf pass: no planes in the stock or out, nothing to plan
  // (most small countries; their input was built for nothing).
  if (hasPlanes(air, smallID)) {
    const input = aiAirInput(air, smallID, day, atWar, zonesOnly);
    for (const o of aiAirPlan(input)) air.issue(smallID, o, tick);
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
  if (!historicalAiActive(mg.config(), day)) return false;
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
  // ww8: history is the flavour: any war of a country with the troops, and a
  // beat's long lead besides.
  if (
    ce.researched.has("paratroopers") &&
    (atWar || paraBeatAhead(air, me, day))
  ) {
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
  const side = land.sideOf(me);
  const targets: { r: number; score: number; beat: boolean }[] = [];
  for (const reg of sc.landRegions) {
    const c = land.controller[reg.id] ?? 0;
    if (c === 0 || !land.isEnemy(me, c) || isNoStrike(sc, reg.id)) continue;
    const beat = beats.has(reg.id);
    if (!beat && reg.vp < 5) continue;
    // ww8: where the sky lets it drop (a beat's sky the fighters are sent to win).
    if (
      !beat &&
      air.wingsLive &&
      air.airSup(side, sc.regionSr(reg.id)) < WW_PARADROP_AIRSUP_PM
    ) {
      continue;
    }
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
      if (
        (!t.beat && !air.wingsLive) ||
        (block !== "no_air_base" && block !== "out_of_range")
      ) {
        continue;
      }
      // A target out of reach: to our air base nearest it, in range.
      const range = air.transportStatsOf(me).rangeKm;
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

// ---- ww8 air overhaul (design §7), lane E ----
//
// One planner for the AI and a human's [auto]: every 5 days at war (10 at
// peace, aiAirDue) it turns the country's air war into wing orders, given
// through air.issue (never applyWwOrder, which would pin the wings). A wing
// that already flies a mission still wanted keeps it; the planner moves as few
// wings as it can. aiWingPlan is pure.

/** Design §7.6: a base is good enough while the target lies within this share of the wing's range. */
export const AI_WING_BASE_RANGE_PCT = 70;
/** Design §7.2: the demand of an army with army_air_priority on, and of the zone it fights in. */
export const AI_WING_PRIORITY_FACTOR = 3;
/** 내 판단: a day's air fuel may take this share of the stock, 1/n (the rest of the budget is the income the land and the sea leave). */
export const AI_WING_FUEL_STOCK_DAYS = 120;
/** 내 판단: with the bases full, fighters keep this band of the planes in wings, %. */
export const AI_WING_FIGHTER_MIN_PCT = 40;
export const AI_WING_FIGHTER_MAX_PCT = 65;
/** 내 판단: the country's fighter wings an escort may take: one in this many. */
export const AI_WING_ESCORT_DIV = 4;
/** Design §7.5: a country with this many fighter wings keeps one over its capital however small its share. */
const AI_WING_HOME_MIN = 3;
/** 내 판단: the most demands a type's wings are shared over, besides one per wing. */
const AI_WING_MAX_DEMANDS = 8;

const WING_TYPE_FIGHTERS: readonly AirType[] = ["fighter", "heavy_fighter"];
const CAS_TYPES: readonly AirType[] = ["cas", "bomber"];
/** Lower flies first when the fuel budget doesn't cover everything (a land attack comes first). */
const RANK_CAS_ATTACK = 0;
const RANK_SUP_ATTACK = 1;
const RANK_CAS_DEFEND = 2;
const RANK_SUP = 3;
const RANK_STRIKE = 4;
const RANK_SUPPLY = 5;
const RANK_RECON = 6;
const RANK_PATROL = 7;
const RANK_PORT = 8;
const RANK_BOMB = 9;
const RANK_ESCORT = 10;

/** One of the wings the plan commands. */
export interface AiWingView {
  id: number;
  type: AirType;
  planes: number;
  /** Its base region (0 none). */
  base: number;
  rangeKm: number;
  /** The standing order; null: idle. */
  mission: AirMission | null;
  sr: number;
  target: number;
  follow: number;
  escortOf: number;
  cls: WwBombClass;
  lastFerryDay: number;
  /** Out, on station or coming back. */
  flying: boolean;
  /** Its fuel a day if it flies (one sortie a plane, the reference distance's rate). */
  fuelMilli: number;
}

/** w50: the free room the plan sees at every usable base. */
const AI_BASE_ROOM = 1_000_000;

/** A base of the side, with its free room. */
export interface AiWingBase {
  region: number;
  room: number;
}

/** A zone's bombing target: the best region and class to hit there. */
export interface AiBombPick {
  region: number;
  cls: WwBombClass;
  score: number;
}

export interface AiWingZone extends AiAirZoneView {
  /** What a whole-zone order can name: the zone's regions or sea zones. */
  members: readonly number[];
  /** Regions here under our side (interception may name these). */
  ownMembers: readonly number[];
  enemyFighters: number;
  bomb: AiBombPick | null;
  /** An enemy port here with ships in it. */
  port: { region: number; ships: number } | null;
  /** A sea zone here with a spotted enemy fleet (0 none). */
  fleetZone: number;
  /** Our region here short of supply the most. */
  supply: { region: number; milli: number } | null;
  /** Battles our side fights here, and the widest's region. */
  battles: number;
  battleRegion: number;
  homeWaters: boolean;
  /** An army with army_air_priority fights here. */
  priority: boolean;
  /** Our divisions next to the enemy's land here: the sky an attack from there needs. */
  ownDivisions: number;
}

/** An army of ours with divisions in a battle. */
export interface AiWingArmy {
  id: number;
  region: number;
  sr: number;
  attacking: number;
  defending: number;
  priority: boolean;
}

export interface AiWingInput {
  smallID: number;
  day: number;
  atWar: boolean;
  /** Only the zones with something to do, and the capital's. */
  zones: readonly AiWingZone[];
  /** Ascending id. */
  wings: readonly AiWingView[];
  /** Ascending region. */
  bases: readonly AiWingBase[];
  armies: readonly AiWingArmy[];
  capitalSr: number;
  /** Task 15: percent of the fighters kept over the capital (default 100 − AI_AIR_USE_PCT). */
  fighterHomePct?: number;
  /** Per AIR_TYPES index: planes in the stock. */
  stock: readonly number[];
  /** The fuel a day the air force may burn, milli. */
  fuelBudgetMilli: number;
  /** Where a field strip could go: ascending, our regions with an army of ours and no base. */
  stripSpots: readonly number[];
  km(base: number, target: number): number;
  /** Enemy divisions stand in the base's region or next to it. */
  threatened(region: number): boolean;
}

/** What a wing is wanted for. target 0: anywhere in the zone (the member nearest its base). */
interface WingDemand {
  mission: AirMission;
  zone: AiWingZone | null;
  sr: number;
  target: number;
  army: number;
  cls: WwBombClass;
  weight: number;
  rank: number;
}

interface WingJob {
  w: AiWingView;
  d: WingDemand;
  target: number;
  /** The base after the plan (its own when it stays). */
  base: number;
  escort: number;
}

const newDemand = (
  mission: AirMission,
  zone: AiWingZone | null,
  sr: number,
  target: number,
  weight: number,
  rank: number,
  army = 0,
  cls: WwBombClass = "auto",
): WingDemand => ({ mission, zone, sr, target, army, cls, weight, rank });

/** Design §7.1: a type's demands, heaviest first (ties: zone order). */
function wingDemandsOf(
  type: AirType,
  i: AiWingInput,
  ti: number,
  noBombers: ReadonlySet<number>,
  noFighters: ReadonlySet<number>,
): WingDemand[] {
  const out: WingDemand[] = [];
  const cas = CAS_TYPES.includes(type);
  const fighter = WING_TYPE_FIGHTERS.includes(type);
  const casWanted = cas && i.armies.some((a) => a.attacking > 0);
  if (cas) {
    for (const a of i.armies) {
      if (noBombers.has(a.sr)) continue;
      const w =
        (1 + 2 * a.attacking + a.defending) *
        (a.priority ? AI_WING_PRIORITY_FACTOR : 1);
      out.push(
        newDemand(
          "cas",
          null,
          a.sr,
          a.region,
          w,
          a.attacking > 0 ? RANK_CAS_ATTACK : RANK_CAS_DEFEND,
          a.id,
        ),
      );
    }
  }
  const followed = new Set(i.armies.map((a) => a.sr));
  for (const z of i.zones) {
    if (!z.reach[ti]) continue;
    const beat = z.beat ? AI_BEAT_FACTOR : 1;
    const pri = z.priority ? AI_WING_PRIORITY_FACTOR : 1;
    if (fighter) {
      if (z.kind === "land") {
        let w = 0;
        if (z.front && !noFighters.has(z.sr)) {
          w =
            (1 +
              z.enemyDivisions +
              z.ownDivisions +
              4 * z.battles +
              Math.floor(z.enemyPlanes / 10)) *
            beat *
            pri;
        } else if (z.beat) {
          w = AI_BEAT_FACTOR;
        }
        if (w > 0) {
          out.push(
            newDemand(
              "air_superiority",
              z,
              z.sr,
              0,
              w,
              z.attacking ? RANK_SUP_ATTACK : RANK_SUP,
            ),
          );
        }
      }
      if (z.bombed && !noFighters.has(z.sr) && z.ownMembers.length > 0) {
        out.push(
          newDemand(
            "interception",
            z,
            z.sr,
            0,
            2 + Math.floor(z.enemyPlanes / 10),
            RANK_SUP,
          ),
        );
      }
      continue;
    }
    if (type === "transport_plane") {
      if (z.supply !== null) {
        out.push(
          newDemand(
            "air_supply",
            z,
            z.sr,
            z.supply.region,
            1 + Math.floor(z.supply.milli / 1000),
            RANK_SUPPLY,
          ),
        );
      }
      continue;
    }
    if (noBombers.has(z.sr)) continue;
    // Close support of the side's battle where no army of ours fights.
    if (cas && z.battles > 0 && !followed.has(z.sr)) {
      out.push(
        newDemand("cas", z, z.sr, z.battleRegion, z.battles, RANK_CAS_DEFEND),
      );
    }
    if (casWanted) continue; // the attack needs them first
    const openSky = z.supPm >= AI_STRAT_SUP_PM || z.enemyPlanes === 0;
    if (
      z.bomb !== null &&
      openSky &&
      (type === "bomber" || type === "strat_bomber")
    ) {
      out.push(
        newDemand(
          "strategic_bombing",
          z,
          z.sr,
          z.bomb.region,
          z.bomb.score * beat,
          RANK_BOMB,
          0,
          z.bomb.cls,
        ),
      );
    }
    if (z.port !== null && openSky) {
      out.push(
        newDemand(
          "port_strike",
          z,
          z.sr,
          z.port.region,
          5 + 2 * z.port.ships,
          RANK_PORT,
        ),
      );
    }
    if (type !== "strat_bomber") {
      if (z.fleetZone !== 0) {
        out.push(
          newDemand("naval_strike", z, z.sr, z.fleetZone, 6, RANK_STRIKE),
        );
      }
      if (type === "naval_bomber" && z.kind === "sea") {
        if (z.convoyLoss) {
          out.push(newDemand("naval_patrol", z, z.sr, 0, 4, RANK_PATROL));
        } else if (z.homeWaters) {
          out.push(newDemand("naval_patrol", z, z.sr, 0, 2, RANK_PATROL));
        }
      }
    }
  }
  // Stable: Array.sort keeps the zones' order on equal weights.
  return out.sort((a, b) => b.weight - a.weight);
}

const standDown = (id: number): WingOrder => ({
  kind: "wing_mission",
  wings: [id],
  mission: "air_superiority",
  target: 0,
});

/** The wing already has this order: nothing to say. */
function holdsOrder(w: AiWingView, d: WingDemand): boolean {
  if (w.mission !== d.mission) return false;
  switch (d.mission) {
    case "cas":
      return d.army !== 0
        ? w.follow === d.army
        : w.follow === 0 && w.sr === d.sr;
    case "strategic_bombing":
      return w.target === d.target && w.cls === d.cls;
    case "port_strike":
    case "naval_strike":
    case "air_supply":
      return w.target === d.target;
    default:
      return w.sr === d.sr;
  }
}

/** Pure: the country's wing orders for this turn (design §7). */
export function aiWingPlan(i: AiWingInput): WingOrder[] {
  const orders: WingOrder[] = [];
  if (!i.atWar) {
    // Peace: nobody up. A wing with an order goes idle and is ready for the next war.
    for (const w of i.wings)
      if (w.mission !== null) orders.push(standDown(w.id));
    const swap = wingMixSwap(i);
    if (swap !== 0) orders.push({ kind: "wing_disband", wing: swap });
    return orders;
  }
  const noBombers = new Set(
    i.zones
      .filter((z) => z.lossPm > AI_AIR_LOSS_PM && z.supPm < AI_AIR_LOSS_SUP_PM)
      .map((z) => z.sr),
  );
  const noFighters = new Set(
    i.zones
      .filter(
        (z) =>
          z.lossPm > AI_FIGHTER_LOSS_PM &&
          z.supPm < AI_FIGHTER_HOLD_SUP_PM &&
          !z.attacking &&
          !z.beat &&
          z.sr !== i.capitalSr,
      )
      .map((z) => z.sr),
  );
  const room = new Map<number, number>();
  for (const b of i.bases) room.set(b.region, b.room);
  const canFerry = (w: AiWingView) =>
    w.lastFerryDay < 0 || i.day - w.lastFerryDay >= WING_AUTO_FERRY_DAYS;
  /** The base a wing flies to `target` from (design §7.6); 0: none reaches. */
  const placeFor = (w: AiWingView, target: number): number => {
    const good = Math.floor((w.rangeKm * AI_WING_BASE_RANGE_PCT) / 100);
    const now = w.base > 0 ? i.km(w.base, target) : Number.MAX_SAFE_INTEGER;
    if (now <= good && !i.threatened(w.base)) return w.base;
    if (canFerry(w)) {
      let best = 0;
      let bestKm = Number.MAX_SAFE_INTEGER;
      for (const b of i.bases) {
        if (b.region === w.base || (room.get(b.region) ?? 0) < w.planes) {
          continue;
        }
        const km = i.km(b.region, target);
        if (km < bestKm && km <= w.rangeKm && !i.threatened(b.region)) {
          best = b.region;
          bestKm = km;
        }
      }
      if (best !== 0 && (bestKm <= good || bestKm < now)) return best;
    }
    return now <= w.rangeKm ? w.base : 0;
  };
  /** A whole-zone order names the member nearest the wing's base. */
  const targetFor = (w: AiWingView, d: WingDemand): number => {
    if (d.target !== 0) return d.target;
    const list =
      d.mission === "interception" ? d.zone!.ownMembers : d.zone!.members;
    if (w.base <= 0) return list[0];
    let best = list[0];
    let bestKm = i.km(w.base, best);
    for (let k = 1; k < list.length; k++) {
      const km = i.km(w.base, list[k]);
      if (km < bestKm) {
        best = list[k];
        bestKm = km;
      }
    }
    return best;
  };
  const jobs = new Map<number, WingJob>();
  /** The first planes that found no base near the wanted target (a strip's reason). */
  let noBaseFor: { target: number; rangeKm: number } | null = null;
  const give = (w: AiWingView, d: WingDemand, target: number, base: number) => {
    if (base !== w.base) {
      room.set(base, (room.get(base) ?? 0) - w.planes);
      room.set(w.base, (room.get(w.base) ?? 0) + w.planes);
    }
    jobs.set(w.id, { w, d, target, base, escort: 0 });
  };
  /** Keeps the wings that hold a wanted order, then gives the free slots to the nearest free wings. */
  const assign = (
    pool: readonly AiWingView[],
    demands: readonly WingDemand[],
    slots: number[],
  ): AiWingView[] => {
    let free: AiWingView[] = [];
    for (const w of pool) {
      let kept = false;
      for (let k = 0; k < demands.length && !kept; k++) {
        const d = demands[k];
        if (slots[k] <= 0 || !holdsOrder(w, d)) continue;
        const t = targetFor(w, d);
        const base = placeFor(w, t);
        if (base === 0) continue;
        give(w, d, t, base);
        slots[k]--;
        kept = true;
      }
      if (!kept) free.push(w);
    }
    for (let k = 0; k < demands.length; k++) {
      const d = demands[k];
      while (slots[k] > 0 && free.length > 0) {
        const near = free
          .map((w) => ({ w, t: targetFor(w, d) }))
          .map((x) => ({ ...x, km: x.w.base > 0 ? i.km(x.w.base, x.t) : 0 }))
          .sort((a, b) => a.km - b.km || a.w.id - b.w.id);
        let done = false;
        for (const n of near) {
          const base = placeFor(n.w, n.t);
          if (base === 0) continue;
          give(n.w, d, n.t, base);
          free = free.filter((x) => x !== n.w);
          done = true;
          break;
        }
        if (!done) {
          const short = near.find((n) => n.w.planes <= WW_FIELD_STRIP_PLANES);
          if (short !== undefined && noBaseFor === null) {
            noBaseFor = { target: short.t, rangeKm: short.w.rangeKm };
          }
          break;
        }
        slots[k]--;
      }
    }
    return free;
  };
  // Who may fly: an under-strength wing waits on the ground for planes.
  const byType = new Map<AirType, AiWingView[]>();
  for (const w of i.wings) {
    if (wingUnderStrength(w.type, w.planes)) continue;
    let list = byType.get(w.type);
    if (list === undefined) byType.set(w.type, (list = []));
    list.push(w);
  }
  // Bombers and support first: an escort reads the bombers' orders.
  for (const type of AIR_TYPES) {
    if (WING_TYPE_FIGHTERS.includes(type)) continue;
    const pool = byType.get(type);
    if (pool === undefined) continue;
    const ti = AIR_TYPES.indexOf(type);
    const demands = wingDemandsOf(type, i, ti, noBombers, noFighters).slice(
      0,
      Math.max(AI_WING_MAX_DEMANDS, pool.length),
    );
    assign(
      pool,
      demands,
      share(
        pool.length,
        demands.map((d) => d.weight),
      ),
    );
  }
  // The bomber wings whose zone the enemy's fighters fly over, heaviest demand first.
  const toEscort = [...jobs.values()]
    .filter(
      (j) => j.d.mission === "strategic_bombing" && j.d.zone!.enemyFighters > 0,
    )
    .sort((a, b) => b.d.weight - a.d.weight || a.w.id - b.w.id);
  const capitalZone = i.zones.find((z) => z.sr === i.capitalSr);
  const fightersAll = WING_TYPE_FIGHTERS.flatMap((t) => byType.get(t) ?? []);
  let reconLeft =
    fightersAll.length >= AI_WING_HOME_MIN
      ? Math.max(1, Math.floor((fightersAll.length * AI_RECON_PCT) / 100))
      : 0;
  let escortsLeft = Math.floor(fightersAll.length / AI_WING_ESCORT_DIV);
  const battleZones = i.zones
    .filter((z) => z.kind === "land" && z.battles > 0)
    .sort((a, b) => b.battles - a.battles || a.sr - b.sr);
  for (const type of WING_TYPE_FIGHTERS) {
    const all = byType.get(type);
    if (all === undefined) continue;
    const ti = AIR_TYPES.indexOf(type);
    let pool = [...all];
    // Design §7.7: an escort stays with a bomber still bombing; else one goes along.
    for (const w of all) {
      if (w.mission !== "escort" || escortsLeft <= 0) continue;
      const b = toEscort.find((j) => j.w.id === w.escortOf);
      if (b === undefined) continue;
      if (placeFor(w, b.target) !== w.base) continue;
      const d = newDemand("escort", b.d.zone, b.d.sr, b.target, 1, RANK_ESCORT);
      jobs.set(w.id, { w, d, target: b.target, base: w.base, escort: b.w.id });
      toEscort.splice(toEscort.indexOf(b), 1);
      pool = pool.filter((x) => x !== w);
      escortsLeft--;
    }
    while (toEscort.length > 0 && escortsLeft > 0 && pool.length > 1) {
      const b = toEscort.shift()!;
      const e = pool.find((w) => {
        const km = w.base > 0 ? i.km(w.base, b.target) : Infinity;
        return km <= w.rangeKm && !i.threatened(w.base);
      });
      if (e === undefined) continue;
      const d = newDemand("escort", b.d.zone, b.d.sr, b.target, 1, RANK_ESCORT);
      jobs.set(e.id, {
        w: e,
        d,
        target: b.target,
        base: e.base,
        escort: b.w.id,
      });
      pool = pool.filter((x) => x !== e);
      escortsLeft--;
    }
    // Spec §19.7: recon over the zones where our side fights the most.
    if (type === "fighter") {
      for (const z of battleZones) {
        if (reconLeft <= 0 || pool.length <= 1) break;
        const d = newDemand("recon", z, z.sr, z.battleRegion, 1, RANK_RECON);
        const holder = pool.find((w) => holdsOrder(w, d));
        const e =
          holder ??
          pool.find(
            (w) => w.base > 0 && i.km(w.base, z.battleRegion) <= w.rangeKm,
          );
        if (e === undefined) continue;
        const base = placeFor(e, z.battleRegion);
        if (base === 0) continue;
        give(e, d, z.battleRegion, base);
        pool = pool.filter((x) => x !== e);
        reconLeft--;
      }
    }
    // Design §7.5: the home share over the capital.
    const homePct = i.fighterHomePct ?? 100 - AI_AIR_USE_PCT;
    let home = Math.floor((pool.length * homePct + 50) / 100);
    if (home === 0 && all.length >= AI_WING_HOME_MIN && homePct > 0) home = 1;
    const demands = wingDemandsOf(type, i, ti, noBombers, noFighters).slice(
      0,
      Math.max(AI_WING_MAX_DEMANDS, pool.length),
    );
    // With nothing else to do, every fighter guards the capital.
    if (demands.length === 0) home = pool.length;
    const guards = capitalZone === undefined ? [] : capitalZone.ownMembers;
    const homeDemand =
      guards.length > 0
        ? newDemand("interception", capitalZone!, i.capitalSr, 0, 1, RANK_SUP)
        : null;
    if (homeDemand !== null && home > 0) {
      // Who guards already stays; then wings that hold no other wanted order.
      const slot = [Math.min(home, pool.length)];
      const loose = pool.filter((w) => !demands.some((d) => holdsOrder(w, d)));
      const left = assign(loose, [homeDemand], slot);
      const holders = pool.filter((w) => !loose.includes(w));
      pool = [...left, ...assign(holders, [homeDemand], slot)];
    }
    const rest = assign(
      pool,
      demands,
      share(
        pool.length,
        demands.map((d) => d.weight),
      ),
    );
    // Fighters left with no slot in reach guard home too.
    if (homeDemand !== null && rest.length > 0) {
      assign(rest, [homeDemand], [rest.length]);
    }
  }
  // Design §7 (fuel): the land's fuel first. What the budget doesn't cover stays on the ground.
  const flyers = [...jobs.values()].sort(
    (a, b) => a.d.rank - b.d.rank || a.w.id - b.w.id,
  );
  let fuelLeft = i.fuelBudgetMilli;
  for (const j of flyers) {
    if (j.d.mission === "escort" && !jobs.has(j.escort)) {
      jobs.delete(j.w.id);
      continue;
    }
    // An interceptor flies only when the enemy comes: half a wing's fuel.
    const burn =
      j.d.mission === "interception" ? j.w.fuelMilli >> 1 : j.w.fuelMilli;
    if (burn <= fuelLeft) fuelLeft -= burn;
    else jobs.delete(j.w.id);
  }
  // The orders: the wings in id order, a base move before the mission.
  for (const w of i.wings) {
    const j = jobs.get(w.id);
    if (j === undefined) {
      if (w.mission !== null) orders.push(standDown(w.id));
      continue;
    }
    if (j.base !== w.base) {
      orders.push({ kind: "wing_base", wings: [w.id], base: j.base });
    }
    const same =
      j.d.mission === "escort"
        ? w.mission === "escort" && w.escortOf === j.escort
        : holdsOrder(w, j.d);
    // A whole-zone order holds while its named member is near enough from the
    // base it will fly from; else it names the nearest.
    if (
      same &&
      (j.d.target !== 0 ||
        (w.target !== 0 &&
          i.km(j.base, w.target) * 100 <= w.rangeKm * AI_WING_BASE_RANGE_PCT))
    ) {
      continue;
    }
    orders.push(missionOrder(j));
  }
  // Escorts name a bomber: its order has to stand first.
  orders.sort((a, b) => orderClass(a) - orderClass(b));
  // Design §7.6: enemy divisions next to the base of a wing the plan left there: out first.
  for (const w of i.wings) {
    if (w.base <= 0 || jobs.get(w.id)?.base !== undefined || !canFerry(w)) {
      continue;
    }
    if (!i.threatened(w.base)) continue;
    let best = 0;
    let bestKm = Number.MAX_SAFE_INTEGER;
    for (const b of i.bases) {
      if (b.region === w.base || (room.get(b.region) ?? 0) < w.planes) continue;
      const km = i.km(w.base, b.region);
      if (km < bestKm && !i.threatened(b.region)) {
        best = b.region;
        bestKm = km;
      }
    }
    if (best !== 0) {
      room.set(best, (room.get(best) ?? 0) - w.planes);
      orders.push({ kind: "wing_base", wings: [w.id], base: best });
    }
  }
  // Design §7.6: no base reaches: a field strip near the wanted target.
  const want = noBaseFor as { target: number; rangeKm: number } | null;
  if (want !== null) {
    const good = Math.floor((want.rangeKm * AI_WING_BASE_RANGE_PCT) / 100);
    let best = 0;
    let bestKm = Number.MAX_SAFE_INTEGER;
    for (const r of i.stripSpots) {
      const km = i.km(r, want.target);
      if (km < bestKm && km <= good && !i.threatened(r)) {
        best = r;
        bestKm = km;
      }
    }
    if (best !== 0) orders.push({ kind: "air_field", region: best });
  }
  // Design §7.4: a type's under-strength wings the stock can't fill: the weakest
  // on the ground gives its planes back, and they fill the others.
  for (const type of AIR_TYPES) {
    const ti = AIR_TYPES.indexOf(type);
    const mine = i.wings.filter((w) => w.type === type);
    if (mine.length < 2) continue;
    const weak = mine.filter((w) => wingUnderStrength(type, w.planes));
    if (weak.length === 0) continue;
    const full = Math.ceil((wingMaxPlanes(type) * 30) / 100);
    let need = 0;
    for (const w of weak) need += full - w.planes;
    if ((i.stock[ti] ?? 0) >= need) continue;
    const grounded = weak
      .filter((w) => !w.flying)
      .sort((a, b) => a.planes - b.planes || a.id - b.id);
    if (grounded.length > 0) {
      orders.push({ kind: "wing_disband", wing: grounded[0].id });
    }
  }
  const swap = wingMixSwap(i);
  if (swap !== 0) orders.push({ kind: "wing_disband", wing: swap });
  return orders;
}

/**
 * 내 판단 (every plane now takes base room, flying or not, and forming fills
 * the fighters first): the bases are full and a wing's worth of the other kind
 * waits in the stock, with the mix past its band: one wing of the kind over it
 * goes back to the stock, on the ground, the idle and weakest first. The
 * reform cooldown then gives its room to the kind that waits. 0: none.
 */
function wingMixSwap(i: AiWingInput): number {
  if (i.bases.some((b) => b.room >= WW_WING_FORM_MIN)) return 0;
  let fighters = 0;
  let others = 0;
  for (const w of i.wings) {
    if (WING_TYPE_FIGHTERS.includes(w.type)) fighters += w.planes;
    else if (w.type !== "transport_plane") others += w.planes;
  }
  const total = fighters + others;
  if (total === 0) return 0;
  const waits = (types: readonly AirType[]) =>
    types.some((t) => {
      const n = i.stock[AIR_TYPES.indexOf(t)] ?? 0;
      return (
        n - Math.max(WW_WING_RESERVE_MIN, Math.floor(n / 10)) >=
        wingMaxPlanes(t)
      );
    });
  let drop: readonly AirType[];
  if (fighters * 100 > total * AI_WING_FIGHTER_MAX_PCT && waits(BOMBERS)) {
    drop = WING_TYPE_FIGHTERS;
  } else if (
    fighters * 100 < total * AI_WING_FIGHTER_MIN_PCT &&
    waits(WING_TYPE_FIGHTERS)
  ) {
    drop = BOMBERS;
  } else {
    return 0;
  }
  let best: AiWingView | null = null;
  for (const w of i.wings) {
    if (w.flying || !drop.includes(w.type)) continue;
    if (
      best === null ||
      (w.mission === null && best.mission !== null) ||
      ((w.mission === null) === (best.mission === null) &&
        w.planes < best.planes)
    ) {
      best = w;
    }
  }
  return best === null ? 0 : best.id;
}

/** The wing_mission of a job. */
function missionOrder(j: WingJob): WingOrder {
  const base = {
    kind: "wing_mission" as const,
    wings: [j.w.id],
    mission: j.d.mission,
    target: j.d.army !== 0 || j.escort !== 0 ? 0 : j.target,
  };
  if (j.d.army !== 0) return { ...base, army: j.d.army };
  if (j.escort !== 0) return { ...base, escort: j.escort };
  if (j.d.mission === "strategic_bombing") return { ...base, cls: j.d.cls };
  return base;
}

/** Moves and bomber orders before the escorts that name those bombers. */
function orderClass(o: WingOrder): number {
  return o.kind === "wing_mission" && o.escort !== undefined ? 1 : 0;
}

// ---- What the plan reads ----

const AIRBORNE_PHASES: ReadonlySet<number> = new Set([
  WP_OUT,
  WP_STATION,
  WP_BACK,
]);
const FIGHTER_INDICES = WING_TYPE_FIGHTERS.map((t) => AIR_TYPES.indexOf(t));
const OIL = RESOURCE_IDS.indexOf("oil");
/** The bomb tables, once (bombTableOf builds one per call). Lazy: this module and Bombing load in a cycle. */
const bombTables = (() => {
  let t: {
    factories: BombTable;
    rail: BombTable;
    airfield: BombTable;
    city: BombTable;
    fuel: BombTable;
    fuelOil: BombTable;
  } | null = null;
  return () =>
    (t ??= {
      factories: bombTableOf("factories", false),
      rail: bombTableOf("rail", false),
      airfield: bombTableOf("airfield", false),
      city: bombTableOf("city", false),
      fuel: bombTableOf("fuel", false),
      fuelOil: bombTableOf("fuel", true),
    });
})();
const BOMB_PICKS: readonly WwBombClass[] = [
  "factories",
  "fuel",
  "rail",
  "airfield",
  "city",
];
const CLASS_ORDER = new Map(WW_BOMB_CLASSES.map((c, k) => [c, k]));

/** A region's bomb weights, per tick (allies plan over the same regions): factories, fuel, rail, airfield, city, guns. */
const bombRowMemo = new WeakMap<
  WwAir,
  { tick: number; rows: Map<number, readonly number[]> }
>();

function bombRowOf(air: WwAir, r: number): readonly number[] {
  const tick = air.mg.ticks();
  let memo = bombRowMemo.get(air);
  if (memo === undefined || memo.tick !== tick) {
    memo = { tick, rows: new Map() };
    bombRowMemo.set(air, memo);
  }
  let row = memo.rows.get(r);
  if (row === undefined) {
    const econ = air.econ;
    const tb = bombTables();
    const oil = (air.ww.scenario.region(r)?.res[OIL] ?? 0) > 0;
    row = [
      tableWeight(econ, r, tb.factories),
      tableWeight(econ, r, oil ? tb.fuelOil : tb.fuel),
      tableWeight(econ, r, tb.rail),
      tableWeight(econ, r, tb.airfield),
      tableWeight(econ, r, tb.city),
      effectiveLevel(econ, r, "anti_air"),
    ];
    memo.rows.set(r, row);
  }
  return row;
}

/** One side-and-enemies' targets a tick (several allies plan on one tick). */
interface WingTargets {
  bomb: (AiBombPick | null)[];
  port: ({ region: number; ships: number } | null)[];
  fleetZone: number[];
  enemyFighters: number[];
}
const wingTargetsMemo = new WeakMap<
  WwAir,
  { tick: number; m: Map<string, WingTargets> }
>();

/**
 * Design §7.8, no dates: the enemy's fuel when it runs short or the region
 * refines (a low enemy stock counts triple), its railways only behind a front
 * its divisions hold, its airfields with planes on them, its factories; its
 * cities only once it bombed ours (`bombsTaken`). Under guns the score falls.
 */
function wingTargetsOf(
  air: WwAir,
  me: number,
  shared: readonly AirZoneShared[],
  bombsTaken: boolean,
): WingTargets {
  const ww = air.ww;
  const land = air.land;
  const econ = air.econ;
  const sc = ww.scenario;
  const navy = air.navy;
  const side = land.sideOf(me);
  const enemies = ww
    .enemiesOf(me)
    .filter((e) => land.isEnemy(me, e))
    .sort((a, b) => a - b);
  const key = `${side}|${enemies.join(",")}|${bombsTaken ? 1 : 0}`;
  const tick = air.mg.ticks();
  let memo = wingTargetsMemo.get(air);
  if (memo === undefined || memo.tick !== tick) {
    memo = { tick, m: new Map() };
    wingTargetsMemo.set(air, memo);
  }
  const hit = memo.m.get(key);
  if (hit !== undefined) return hit;
  const list = sc.strategicList();
  const out: WingTargets = {
    bomb: new Array<AiBombPick | null>(list.length).fill(null),
    port: new Array<{ region: number; ships: number } | null>(list.length).fill(
      null,
    ),
    fleetZone: new Array<number>(list.length).fill(0),
    enemyFighters: new Array<number>(list.length).fill(0),
  };
  const foes = new Set(enemies);
  const enemySides = new Set<number>();
  for (const sd of land.sideList()) {
    if (sd.members.some((m) => foes.has(m))) enemySides.add(sd.key);
  }
  for (const s of list) {
    for (const [k, sorties] of air.zoneState[s.idx].sorties) {
      if (k === side || !enemySides.has(k)) continue;
      for (const t of FIGHTER_INDICES) {
        out.enemyFighters[s.idx] += sorties[t] ?? 0;
      }
    }
  }
  for (const e of enemies) {
    const ec = econ.country(e);
    const fuelLow =
      ec !== null &&
      (ec.fuelRatioPm < 1000 || ec.fuelMilli < 30 * ec.fuelGainMilli);
    for (const r of econ.regionsOf(e)) {
      if (!foes.has(land.controller[r] ?? 0) || isNoStrike(sc, r)) continue;
      const i = sc.srIdxOf(sc.regionSr(r));
      if (i < 0) continue;
      const row = bombRowOf(air, r);
      const aa = row[5];
      for (let c = 0; c < BOMB_PICKS.length; c++) {
        const cls = BOMB_PICKS[c];
        let raw = row[c];
        if (cls === "fuel" && fuelLow) raw *= 3;
        else if (cls === "rail")
          raw = shared[i].enemyDivisions > 0 ? raw * 2 : 0;
        else if (cls === "airfield") raw = air.baseUse(r) > 0 ? raw * 2 : 0;
        else if (cls === "city" && !bombsTaken) raw = 0;
        const score = Math.floor((raw * 4) / (4 + aa));
        if (score <= 0) continue;
        const b = out.bomb[i];
        if (
          b === null ||
          score > b.score ||
          (score === b.score &&
            (r < b.region ||
              (r === b.region &&
                CLASS_ORDER.get(cls)! < CLASS_ORDER.get(b.cls)!)))
        ) {
          out.bomb[i] = { region: r, cls, score };
        }
      }
    }
    for (const f of navy.fleetsOf(e)) {
      if (f.docked !== 0) {
        if (isNoStrike(sc, f.docked) || !foes.has(land.controller[f.docked])) {
          continue;
        }
        if (effectiveLevel(econ, f.docked, "naval_base") < 1) continue;
        const i = sc.srIdxOf(sc.regionSr(f.docked));
        if (i < 0) continue;
        const p = out.port[i];
        if (
          p === null ||
          f.ships.length > p.ships ||
          (f.ships.length === p.ships && f.docked < p.region)
        ) {
          out.port[i] = { region: f.docked, ships: f.ships.length };
        }
        continue;
      }
      const i = sc.srIdxOf(sc.zoneSr(f.zone));
      if (i >= 0 && navy.spotted(side, f.id)) {
        if (out.fleetZone[i] === 0 || f.zone < out.fleetZone[i]) {
          out.fleetZone[i] = f.zone;
        }
      }
    }
  }
  memo.m.set(key, out);
  return out;
}

/** Derived (one tick): the land battles by side: per zone, how many and the widest's region. */
const sideBattlesMemo = new WeakMap<
  WwAir,
  { tick: number; m: Map<number, Map<number, [number, number, number]>> }
>();

function sideBattlesOf(
  air: WwAir,
): ReadonlyMap<number, ReadonlyMap<number, [number, number, number]>> {
  const tick = air.mg.ticks();
  const hit = sideBattlesMemo.get(air);
  if (hit !== undefined && hit.tick === tick) return hit.m;
  const land = air.land;
  const sc = air.ww.scenario;
  const m = new Map<number, Map<number, [number, number, number]>>();
  const add = (side: number, sr: number, region: number, width: number) => {
    let z = m.get(side);
    if (z === undefined) m.set(side, (z = new Map()));
    const row = z.get(sr);
    if (row === undefined) z.set(sr, [1, region, width]);
    else {
      row[0]++;
      if (width > row[2] || (width === row[2] && region < row[1])) {
        row[1] = region;
        row[2] = width;
      }
    }
  };
  for (const b of land.battles.values()) {
    const sr = sc.regionSr(b.region);
    if (sr === 0) continue;
    const width = b.attackers.length + b.defenders.length;
    add(land.sideOf(b.attLead), sr, b.region, width);
    add(land.sideOf(b.defLead), sr, b.region, width);
  }
  sideBattlesMemo.set(air, { tick, m });
  return m;
}

/** Enemy divisions of `me` stand in the region or next to it. */
export function baseThreatened(
  air: WwAir,
  me: number,
  region: number,
): boolean {
  const land = air.land;
  if (enemyDivisionsIn(land, me, region) > 0) return true;
  for (const x of air.ww.scenario.edgesOf(region)) {
    if (enemyDivisionsIn(land, me, x.to) > 0) return true;
  }
  return false;
}

/** What the plan reads of the air war of `viewer` (the owner, or the host of volunteer wings). */
export function aiWingInput(
  air: WwAir,
  owner: number,
  viewer: number,
  wings: readonly Wing[],
  day: number,
): AiWingInput {
  const ww = air.ww;
  const sc = ww.scenario;
  const land = air.land;
  const navy = air.navy;
  const econ = air.econ;
  const side = land.sideOf(viewer);
  const atWar = aiAtWar(navy, viewer);
  const ce = econ.country(owner)!;
  const ca = air.country(viewer);
  const views: AiWingView[] = wings.map((w) => {
    const st = wingStats(air, w);
    const planes = wingPlanes(w);
    return {
      id: w.id,
      type: AIR_TYPES[w.type],
      planes,
      base: w.base,
      rangeKm: st.rangeKm,
      mission: w.mission < 0 ? null : AIR_MISSIONS[w.mission],
      sr: w.sr,
      target: w.target,
      follow: w.follow,
      escortOf: w.escortOf,
      cls: WW_BOMB_CLASSES[w.cls] ?? "auto",
      lastFerryDay: w.lastFerryDay,
      flying: AIRBORNE_PHASES.has(w.phase),
      fuelMilli: planes * st.fuelPerSortieMilli,
    };
  });
  const threat = new Map<number, boolean>();
  const threatened = (r: number) => {
    let t = threat.get(r);
    if (t === undefined) {
      t = baseThreatened(air, viewer, r);
      threat.set(r, t);
    }
    return t;
  };
  const km = (base: number, target: number) => sc.targetKm(base, target);
  const stock = AIR_TYPES.map((type) => {
    let n = 0;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      n += ce.stock[equipKey(type, g)] ?? 0;
    }
    return n;
  });
  const budget = Math.max(
    0,
    ce.fuelGainMilli -
      (ce.fuelUseMilli[0] ?? 0) -
      (ce.fuelUseMilli[1] ?? 0) +
      Math.floor(ce.fuelMilli / AI_WING_FUEL_STOCK_DAYS),
  );
  const base: AiWingInput = {
    smallID: owner,
    day,
    atWar,
    zones: [],
    wings: views,
    bases: [],
    armies: [],
    capitalSr: 0,
    stock,
    fuelBudgetMilli: budget,
    stripSpots: [],
    km,
    threatened,
  };
  // w50: a base holds any number of planes; the plan's room is unlimited.
  const roomy = baseUsesOf(air, viewer)
    .filter((b) => air.baseUsable(b.region))
    .map((b) => ({ region: b.region, room: AI_BASE_ROOM }));
  base.bases = roomy;
  if (!atWar) return base;
  // Our armies in battle (a volunteer wing can't follow a host's army).
  const priority = new Set(ca?.priorityArmies ?? []);
  const armies: AiWingArmy[] = [];
  const t = land.divisions;
  const spots = new Set<number>();
  const needs = new Map<number, { region: number; milli: number }>();
  const list = land.armiesOf(viewer);
  const standing = new Map<number, number>();
  for (const a of list) {
    let attacking = 0;
    let defending = 0;
    for (const id of a.divisions) {
      const row = t.rowOf(id);
      if (row < 0) continue;
      const at = t.region[row];
      standing.set(at, (standing.get(at) ?? 0) + 1);
      if (t.battle[row] === 0) continue;
      if (t.role[row] === ROLE_ATTACK) attacking++;
      else defending++;
    }
    const region = land.armyRegion(a);
    if (region === 0) continue;
    const sr = sc.regionSr(region);
    // An attack it is about to throw counts: the wing waits on the ground for its battle.
    if (a.order.kind === "plan" && a.order.executing && attacking === 0) {
      attacking = a.divisions.length >> 2;
    }
    if (viewer === owner && attacking + defending > 0) {
      armies.push({
        id: a.id,
        region,
        sr,
        attacking,
        defending,
        priority: priority.has(a.id),
      });
    }
    if (
      viewer === owner &&
      land.controller[region] === owner &&
      (econ.buildingArray("air_base")[region] ?? 0) === 0 &&
      !air.strips.has(region)
    ) {
      spots.add(region);
    }
    // What a sortie would bring (Sorties.supplyWanted's rule).
    if (a.divisions.length === 0) continue;
    const i = sc.srIdxOf(sr);
    if (i < 0) continue;
    let had = 0;
    for (const row of air.zoneState[i].airSupply) {
      if (row[0] === region && row[1] === side) had = row[2];
    }
    const milli =
      land.useMilli[region] - Math.max(0, land.supplyMilli[region] - had);
    if (milli <= 0) continue;
    const n = needs.get(i);
    if (
      n === undefined ||
      milli > n.milli ||
      (milli === n.milli && region < n.region)
    ) {
      needs.set(i, { region, milli });
    }
  }
  armies.sort((a, b) => a.id - b.id);
  // Our divisions by the enemy land they stand next to, a zone once per region.
  const massed = new Map<number, number>();
  for (const [at, n] of standing) {
    let last = 0;
    for (const x of sc.edgesOf(at)) {
      if (!land.isEnemy(viewer, land.controller[x.to] ?? 0)) continue;
      const sr = sc.regionSr(x.to);
      if (sr === last) continue;
      last = sr;
      massed.set(sr, (massed.get(sr) ?? 0) + n);
    }
  }
  const prioritySrs = new Set(
    armies.filter((a) => a.priority).map((a) => a.sr),
  );
  const shared = airSharedView(air, viewer);
  const bombsTaken = (ca?.bombTaken ?? []).reduce((x, y) => x + y, 0) > 0;
  // Only bombers and the like read the targets (most countries' wings don't).
  const targets = views.some((v) => BOMBERS.includes(v.type))
    ? wingTargetsOf(air, viewer, shared, bombsTaken)
    : null;
  const attacking = attackingSrs(air).get(viewer) ?? NO_SRS;
  const battles = sideBattlesOf(air).get(side);
  const beatSrs = new Set(
    [
      ...activeBeatTargets(navy, viewer, day, "air_campaign"),
      ...activeBeatTargets(navy, viewer, day, "paradrop"),
    ].map((r) => sc.regionSr(r)),
  );
  const mineSr = new Set<number>();
  for (const r of econ.regionsOf(viewer)) {
    if (land.controller[r] === viewer) mineSr.add(sc.regionSr(r));
  }
  const cap = viewer === owner ? capitalRegion(land, viewer) : 0;
  const capitalSr = cap === 0 ? 0 : sc.regionSr(cap);
  // Home waters: only naval bombers patrol them.
  const home = new Set<number>(
    views.some((v) => v.type === "naval_bomber")
      ? homeSeaRegions(ww.depth, viewer)
      : [],
  );
  const range = new Array<number>(AIR_TYPES.length).fill(0);
  const deployed = new Map<number, number>();
  for (const v of views) {
    const ti = AIR_TYPES.indexOf(v.type);
    if (v.rangeKm > range[ti]) range[ti] = v.rangeKm;
    if (v.sr !== 0) deployed.set(v.sr, (deployed.get(v.sr) ?? 0) + v.planes);
  }
  const zones: AiWingZone[] = [];
  for (const s of sc.strategicList()) {
    const v = shared[s.idx];
    const land_ = s.kind === "land";
    const front = land_ && (v.front || v.homeFront);
    const isAttacking = land_ && attacking.has(s.id);
    const bombed = mineSr.has(s.id) && bombsTaken && v.enemyBombers > 0;
    const fleetZone = targets?.fleetZone[s.idx] ?? 0;
    const bomb = targets?.bomb[s.idx] ?? null;
    const port = targets?.port[s.idx] ?? null;
    const row = battles?.get(s.id);
    const supply = needs.get(s.idx) ?? null;
    const st = s.kind === "sea" ? navy.srState[s.idx] : undefined;
    const convoyLoss =
      st !== undefined &&
      ((st.lossYesterday.get(viewer) ?? 0) > 0 ||
        (st.lossRate.get(side) ?? 0) > 0);
    const homeWaters = home.has(s.id);
    const beat = beatSrs.has(s.id);
    if (
      !front &&
      !isAttacking &&
      !bombed &&
      fleetZone === 0 &&
      bomb === null &&
      port === null &&
      row === undefined &&
      supply === null &&
      !convoyLoss &&
      !homeWaters &&
      !beat &&
      s.id !== capitalSr
    ) {
      continue;
    }
    const lost = (air.zoneState[s.idx].result.get(owner)?.[1] ?? 0) * 5;
    const planes = deployed.get(s.id) ?? 0;
    const reachKm = v.minKm;
    const ownMembers =
      land_ && (bombed || s.id === capitalSr)
        ? s.members.filter((r) => land.sameSide(viewer, land.controller[r]))
        : [];
    zones.push({
      sr: s.id,
      kind: s.kind,
      front,
      // The enemy next to our own land counts half: it has yet to come.
      enemyDivisions: v.enemyDivisions + (v.homeDivisions >> 1),
      enemyPlanes: v.enemyPlanes,
      attacking: isAttacking,
      bombed,
      enemyFleet: fleetZone !== 0,
      convoyLoss,
      industry: bomb?.score ?? 0,
      supPm: air.airSup(side, s.id),
      encircled: supply !== null,
      lossPm: planes === 0 ? 0 : Math.floor((lost * 1000) / planes),
      reach: range.map((km_) => reachKm >= 0 && reachKm <= km_),
      beat,
      members: s.members,
      ownMembers,
      enemyFighters: targets?.enemyFighters[s.idx] ?? 0,
      bomb,
      port,
      fleetZone,
      supply,
      battles: row?.[0] ?? 0,
      battleRegion: row?.[1] ?? 0,
      homeWaters,
      priority: prioritySrs.has(s.id),
      ownDivisions: massed.get(s.id) ?? 0,
    });
  }
  const strips = [...air.strips.keys()].filter(
    (r) => land.controller[r] === owner,
  ).length;
  const home_ =
    viewer === owner && !ww.isHumanControlled(owner)
      ? AI_FIGHTER_HOME_PCT[ce.tag]
      : undefined;
  return {
    ...base,
    zones,
    armies,
    capitalSr,
    ...(viewer !== owner
      ? { fighterHomePct: 0 }
      : home_ === undefined
        ? {}
        : { fighterHomePct: home_ }),
    stripSpots:
      strips >= WW_FIELD_STRIP_MAX ? [] : [...spots].sort((a, b) => a - b),
  };
}

/**
 * The AI's (and a human's [auto]) wings for the country's turn. A human's
 * pinned wings (auto off) and carrier wings stay out: a carrier's wing flies
 * its fleet's mission (carrierWings). Volunteer wings plan over their host's
 * war. Only the AI raises and drops paratroopers (land orders, not the air's).
 */
export function aiWings(air: WwAir, smallID: number, day: number): void {
  if (air.country(smallID) === null || air.econ.country(smallID) === null) {
    return;
  }
  const human = air.ww.isHumanControlled(smallID);
  const atWar = aiAtWar(air.navy, smallID);
  if (!aiAirDue(smallID, day, atWar)) return;
  const tick = air.mg.ticks();
  const own: Wing[] = [];
  let hosts: Map<number, Wing[]> | null = null;
  for (const w of air.wingsOf(smallID)) {
    if (isCarrierWing(w) || (human && !w.auto) || (w.group !== 0 && !w.auto)) {
      continue;
    }
    if (w.volunteerFor === 0) {
      own.push(w);
      continue;
    }
    hosts ??= new Map();
    const list = hosts.get(w.volunteerFor);
    if (list === undefined) hosts.set(w.volunteerFor, [w]);
    else list.push(w);
  }
  if (own.length > 0) {
    const plan = aiWingPlan(aiWingInput(air, smallID, smallID, own, day));
    for (const o of plan) air.issue(smallID, o, tick);
  }
  if (hosts !== null) {
    for (const host of [...hosts.keys()].sort((a, b) => a - b)) {
      const input = aiWingInput(air, smallID, host, hosts.get(host)!, day);
      for (const o of aiWingPlan(input)) air.issue(smallID, o, tick);
    }
  }
  if (atWar) aiNightWings(air.ww.depth, smallID, human);
  if (!human) aiParadrops(air, smallID, day, atWar);
}

/** wing_auto: the sender's own wings ([auto] takes them again, or a direct order's pin stays). */
export function issueWingAuto(
  air: WwAir,
  smallID: number,
  wings: readonly Wing[],
  on: boolean,
): WwOrderBlock | null {
  void smallID;
  if (wings.some(isCarrierWing)) return "bad_air_mission";
  for (const w of wings) {
    if (w.auto !== on) {
      w.auto = on;
      air.markWing(w.id);
    }
  }
  return null;
}

/**
 * army_air_priority (design §7.2): the weight of the army's air demand, ×3. The
 * army must be the sender's; the list stays ascending and loses the armies gone.
 */
export function issueArmyAirPriority(
  air: WwAir,
  smallID: number,
  army: number,
  on: boolean,
): WwOrderBlock | null {
  const c = air.country(smallID);
  if (c === null) return "dead";
  const land = air.land;
  if (land.armies.get(army)?.owner !== smallID) return "bad_index";
  const list = c.priorityArmies.filter(
    (id) => id !== army && land.armies.has(id),
  );
  if (on) list.push(army);
  c.priorityArmies = list.sort((a, b) => a - b);
  air.markCountry(smallID);
  return null;
}

/**
 * What AiEconomy reads in the wing model (design §7.6). `srs`: a wing whose
 * target lies past the good share of its range wants a base in the zone of our
 * region nearest the target (a few wings a turn are enough). `idle`: a wing's
 * worth of planes waits in the stock because the bases have no room to form it.
 */
export function wingBaseWants(
  air: WwAir,
  me: number,
): { srs: Set<number>; idle: boolean } {
  const srs = new Set<number>();
  const sc = air.ww.scenario;
  const land = air.land;
  const econ = air.econ;
  const own = econ.regionsOf(me).filter((r) => land.controller[r] === me);
  if (own.length === 0) return { srs, idle: false };
  let tried = 0;
  for (const w of air.wingsOf(me)) {
    if (tried >= 4) break;
    if (isCarrierWing(w) || w.volunteerFor !== 0 || w.mission < 0) continue;
    const a = w.follow !== 0 ? land.armies.get(w.follow) : undefined;
    const t = a !== undefined ? land.armyRegion(a) : w.target;
    if (t === 0 || w.base <= 0) continue;
    const range = wingStats(air, w).rangeKm;
    if (sc.targetKm(w.base, t) * 100 <= range * AI_WING_BASE_RANGE_PCT) {
      continue;
    }
    tried++;
    let best = own[0];
    let bestKm = sc.targetKm(best, t);
    for (const r of own) {
      const km = sc.targetKm(r, t);
      if (km < bestKm) {
        best = r;
        bestKm = km;
      }
    }
    srs.add(sc.regionSr(best));
  }
  let idle = false;
  const ce = econ.country(me);
  if (ce !== null) {
    for (let ti = 0; ti < AIR_TYPES.length && !idle; ti++) {
      if (deckSlotOf(ti) >= 0) continue;
      const stock = stockOf(air, ce, me, ti);
      const reserve = Math.max(WW_WING_RESERVE_MIN, Math.floor(stock / 10));
      idle = stock - reserve >= wingMaxPlanes(AIR_TYPES[ti]);
    }
  }
  return { srs, idle };
}

/**
 * w50: the planner's bomb pick for one strategic zone (the same table the AI's
 * bombers use), for an air group's bombers; null when nothing there is worth it.
 */
export function bombPickFor(
  air: WwAir,
  me: number,
  zoneIdx: number,
): AiBombPick | null {
  const ca = air.country(me);
  const bombsTaken = (ca?.bombTaken ?? []).reduce((x, y) => x + y, 0) > 0;
  return (
    wingTargetsOf(air, me, airSharedView(air, me), bombsTaken).bomb[zoneIdx] ??
    null
  );
}
