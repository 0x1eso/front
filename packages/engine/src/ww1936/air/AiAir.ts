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
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  AirMission,
  AirOrder,
  AirType,
  WW_MAX_DEPLOY_COUNT,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { effectiveBuildings, effectiveLevel } from "../economy/Buildings";
import { capitalRegion } from "../land/LandStartRun";
import { enemyDivisionsIn } from "../land/Movement";
import { activeBeatTargets, AI_BEAT_FACTOR, aiAtWar } from "../navy/AiNavy";
import { bombableRegions } from "./Bombing";
import type { WwAir } from "./WwAir";

/** Spec §17.3-2: the share of each type's planes put on the demands. */
export const AI_AIR_USE_PCT = 90;
/** Spec §17.3-3: a zone losing more than this ‰ of its planes in 5 days… */
export const AI_AIR_LOSS_PM = 150;
/** …under this superiority loses its bombers. */
export const AI_AIR_LOSS_SUP_PM = 200;
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
        if (z.front) {
          w = 1 + z.enemyDivisions + Math.floor(z.enemyPlanes / 10);
        }
        w *= beat;
        if (w === 0 && z.beat) w = AI_BEAT_FACTOR;
      } else if (m === "interception" && z.bombed) {
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
  AIR_TYPES.forEach((type, ti) => {
    if (TYPE_MISSIONS[type] === undefined) return;
    const total = input.planes[ti] ?? 0;
    if (total <= 0) return;
    const usable = Math.floor((total * AI_AIR_USE_PCT) / 100);
    const fighter = FIGHTERS.includes(type);
    let reserve = fighter ? total - usable : 0;
    if (input.atWar) {
      const demands = demandsOf(type, input, ti, noBombers);
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
  const enemy = (c: number) =>
    c !== 0 && c !== smallID && land.isEnemy(smallID, c);
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
  // Our side's working air bases, for the reach.
  const bases: number[] = [];
  for (const r of sc.landRegions) {
    if (!land.sameSide(smallID, land.controller[r.id])) continue;
    if (effectiveLevel(econ, r.id, "air_base") >= 1) bases.push(r.id);
  }
  const range = AIR_TYPES.map((type) => {
    let km = 0;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      km = Math.max(km, air.planeStatsOf(smallID, type, g).rangeKm);
    }
    return km;
  });
  const beatRegions = activeBeatTargets(navy, smallID, day, "air_campaign");
  const beatSrs = new Set([...beatRegions].map((r) => sc.regionSr(r)));
  const bombsTaken = ca.bombTaken.reduce((a, b) => a + b, 0) > 0;
  const bomberTypes = [
    AIR_TYPES.indexOf("bomber"),
    AIR_TYPES.indexOf("strat_bomber"),
  ];
  const ours = (r: number) => land.controller[r] === smallID;
  const zones: AiAirZoneView[] = [];
  for (const s of sc.strategicList()) {
    const z = air.zoneState[s.idx];
    let enemyPlanes = 0;
    let enemyBombers = 0;
    for (const [k, sorties] of z.sorties) {
      if (k === side || !land.sideMembers(k).some((m) => enemy(m))) continue;
      for (const n of sorties) enemyPlanes += n;
      for (const t of bomberTypes) enemyBombers += sorties[t] ?? 0;
    }
    let front = false;
    let enemyDivisions = 0;
    let attacking = false;
    let industry = 0;
    let encircled = false;
    let mine = false;
    let convoyLoss = false;
    let enemyFleet = false;
    if (s.kind === "land") {
      const bombable = new Set(bombableRegions(air, s.id));
      for (const r of s.members) {
        const c = land.controller[r] ?? 0;
        if (ours(r)) {
          mine = true;
          if (land.encircled[r] === 1) encircled = true;
        } else if (enemy(c)) {
          if (atWar && bombable.has(r)) {
            industry +=
              effectiveBuildings(econ, r, "civ") +
              effectiveBuildings(econ, r, "mil") +
              effectiveBuildings(econ, r, "dock");
          }
          if (
            sc
              .edgesOf(r)
              .some((e) => land.sameSide(smallID, land.controller[e.to]))
          ) {
            front = true;
            enemyDivisions += enemyDivisionsIn(land, smallID, r);
          }
        }
        const b = land.battles.get(r);
        if (b !== undefined) {
          const t = land.divisions;
          attacking ||= b.attackers.some((id) => {
            const row = t.rowOf(id);
            return row >= 0 && t.owner[row] === smallID;
          });
        }
      }
    } else {
      const st = navy.srState[s.idx];
      convoyLoss =
        (st?.lossYesterday.get(smallID) ?? 0) > 0 ||
        (st?.lossRate.get(side) ?? 0) > 0;
      for (const zone of s.members) {
        for (const fid of navy.fleetsIn(zone)) {
          const f = navy.fleets.get(fid);
          if (f !== undefined && enemy(f.owner) && navy.spotted(side, fid)) {
            enemyFleet = true;
          }
        }
      }
    }
    // Losses: yesterday's × 5 for the five days (the zone keeps one day).
    const lost = (z.result.get(smallID)?.[1] ?? 0) * 5;
    const deployed = deployedIn.get(s.id) ?? 0;
    let minKm = -1;
    for (const b of bases) {
      const km = sc.srKm(b, s.id);
      if (minKm < 0 || km < minKm) minKm = km;
    }
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
      reach: range.map((km) => minKm >= 0 && minKm <= km),
      beat: beatSrs.has(s.id),
    });
  }
  const cap = capitalRegion(land, smallID);
  return {
    smallID,
    day,
    atWar,
    planes,
    zones,
    capitalSr: cap === 0 ? 0 : sc.regionSr(cap),
    current,
    ...(only === undefined ? {} : { only }),
  };
}

/** The country's AI day for its air force (an AI country's all, a human's auto zones). */
export function aiAir(air: WwAir, smallID: number, day: number): void {
  const p = air.mg.playerBySmallID(smallID);
  const ca = air.country(smallID);
  if (!p.isPlayer() || ca === null || air.econ.country(smallID) === null) {
    return;
  }
  const human = p.type() === PlayerType.Human;
  if (human && ca.autoZones.length === 0) return;
  const atWar = aiAtWar(air.navy, smallID);
  if (!aiAirDue(smallID, day, atWar)) return;
  const tick = air.mg.ticks();
  for (const o of aiAirPlan(aiAirInput(air, smallID, day, atWar, human))) {
    air.issue(smallID, o, tick);
  }
}
