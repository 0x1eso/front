// World War 1936 P4 (pre-flight ruling 3, plan decision 40): what the land
// screens read of the navy and the air war — the five P4 battle lines the
// engine's modInputOf fills (air, fuel, landing, coastal fort, shore
// bombardment), the paradrop's air conditions, the sea move's convoy
// conditions — from the screens' views, through the engine-lib rules the
// engine fights with. GameRenderer registers the views per land view
// (setLandSeaAir), like P2's setLandSides; without them every P4 line is 0
// and only the P2 checks apply.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import type {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  TPL_ENGINEER,
  TPL_MARINE_ANY,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  CONVOY_USES,
  CountryNavyDetail,
  FleetSummary,
  SHIP_CLASSES,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  WW_STAT_KEYS,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  airPenaltyBp,
  paradropBlockOf,
} from "@openfront/engine-lib/ww1936/AirRules";
import {
  divisionConvoys,
  seaTransferBlock,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import { fuelCombatBp } from "@openfront/engine-lib/ww1936/FuelRules";
import {
  coastalFortBp,
  landingBp,
  shoreBombardBp,
} from "@openfront/engine-lib/ww1936/InvasionRules";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  edgePassable,
  PassQuery,
  seaPath,
} from "@openfront/engine-lib/ww1936/SeaGraph";
import { shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import type { WwAirView } from "../../view/WwAirView";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwNavyView } from "../../view/WwNavyView";

/** The engine's WwLand.sameSide / isEnemy (LandModel.LandSides' shape). */
export interface SeaAirSides {
  sameSide(a: number, b: number): boolean;
  isEnemy(a: number, b: number): boolean;
}

/** The navy and air views and the politics facts the land cards read. */
export interface LandSeaAir {
  navy: WwNavyView;
  air: WwAirView;
  /** P2's side key of a country (a faction 100 000 + its index, else itself). */
  sideOf(smallID: number): number;
  /** The countries of a side key. */
  membersOf(side: number): readonly number[];
  /** My country's stats (P3's sum of every source). */
  stats(): WwStats;
  /** `smallID` is at war with anyone (the Bosporus rule, spec §3.3). */
  atWarAny(smallID: number): boolean;
  /** Turkey, in no faction (Montreux, spec §3.3). */
  neutralTurkey(smallID: number): boolean;
}

const byView = new WeakMap<object, LandSeaAir>();

/** GameRenderer: the navy and air facts the land model reads for this land view. */
export function setLandSeaAir(view: object, p: LandSeaAir): void {
  byView.set(view, p);
}

/** The registered navy and air facts of a land view; null: none (P2 rules only). */
export function landSeaAirOf(view: object): LandSeaAir | null {
  return byView.get(view) ?? null;
}

/** P3 stats from a politics detail's WW_STAT_KEYS array. */
export function statsFromArray(arr: readonly number[] | null): WwStats {
  const s = emptyStats();
  if (arr !== null) WW_STAT_KEYS.forEach((k, i) => (s[k] = arr[i] ?? 0));
  return s;
}

/** The side keys of the members of a faction key, or the country alone. */
export function sideMembersOf(
  side: number,
  factions: readonly { idx: number; members: readonly number[] }[],
): readonly number[] {
  if (side < 100_000) return [side];
  return factions.find((f) => f.idx === side - 100_000)?.members ?? [];
}

// ---- The air war's battle line (spec §14.6) ----

/** Spec §14.6: the highest air superiority over zone `sr` of a side at war with `owner`, ‰. */
export function enemyAirSupPm(
  p: LandSeaAir,
  sides: SeaAirSides,
  sr: number,
  owner: number,
): number {
  const zone = p.air.zones.get(sr);
  if (zone === undefined) return 0;
  const mine = p.sideOf(owner);
  let best = 0;
  for (const s of zone.sides) {
    if (s.side === mine) continue;
    if (!p.membersOf(s.side).some((m) => sides.isEnemy(owner, m))) continue;
    best = Math.max(best, s.supPm);
  }
  return best;
}

/** The engine's hooks.airPenaltyBp(region, side, divAirAtk) from the air view. */
export function airBpOf(
  p: LandSeaAir | null,
  sides: SeaAirSides,
  scenario: ScenarioIndex,
  region: number,
  owner: number,
  divAirAtk: number,
): number {
  if (p === null || owner <= 0) return 0;
  const sr = scenario.regionSr(region);
  if (sr === 0) return 0;
  return airPenaltyBp(enemyAirSupPm(p, sides, sr, owner), divAirAtk);
}

/** The engine's fuel line: yesterday's fuel ratio of the owner (spec §15.4). */
export function fuelBpOf(
  economy: WwEconomyView,
  owner: number,
  fuelWidthPm: number,
): number {
  if (fuelWidthPm <= 0) return 0;
  return fuelCombatBp(economy.summary(owner)?.fuelRatioPm ?? 1000, fuelWidthPm);
}

/**
 * Spec §11.4: a landing division's two cuts — the landing (lane I's hook,
 * landingBp) and the coastal fort (the engine adds it from the working
 * level) — when my army is landing at `region` now; zeros otherwise.
 */
export function landingBpsOf(
  p: LandSeaAir | null,
  economy: WwEconomyView,
  me: number,
  army: number,
  region: number,
  flags: number,
  techs: ReadonlySet<WwTechId>,
): { landingBp: number; coastalFortBp: number } {
  const none = { landingBp: 0, coastalFortBp: 0 };
  const detail = p?.navy.detail ?? null;
  if (detail === null || detail.smallID !== me) return none;
  const inv = detail.invasions.find(
    (x) => x.army === army && x.target === region && x.state === "landing",
  );
  if (inv === undefined) return none;
  const lv = economy.effectiveBuildings("coastal_fort", region);
  return {
    landingBp: -landingBp((flags & TPL_MARINE_ANY) !== 0, techs),
    coastalFortBp:
      lv === 0 ? 0 : -coastalFortBp(lv, (flags & TPL_ENGINEER) !== 0),
  };
}

/** A fleet's ships as (class, generation) pairs; other countries' fleets: their counts at generation 1. */
export function fleetShipsOf(f: FleetSummary): [ShipClass, number, number][] {
  if (f.ships.length > 0) {
    return f.ships.map((s): [ShipClass, number, number] => [
      s.cls,
      s.gen,
      s.hpPm,
    ]);
  }
  const out: [ShipClass, number, number][] = [];
  SHIP_CLASSES.forEach((cls, i) => {
    for (let k = 0; k < (f.counts[i] ?? 0); k++) out.push([cls, 1, f.hpPm]);
  });
  return out;
}

/**
 * Spec §11.4 shore bombardment: the defenders of a coastal region lose
 * defense to the attacking side's fleets on invasion support or strike in
 * the sea region of the region's harbor zone, Σ(heavy + light / 2).
 */
export function shoreBpOf(
  p: LandSeaAir | null,
  sides: SeaAirSides,
  scenario: ScenarioIndex,
  me: number,
  techs: ReadonlySet<WwTechId>,
  region: number,
  attacker: number,
): number {
  if (p === null || attacker <= 0) return 0;
  const harbor = scenario.harborOf(region);
  const sr = harbor === 0 ? 0 : scenario.zoneSr(harbor);
  if (sr === 0) return 0;
  const mine = attacker === me || sides.sameSide(attacker, me);
  const stats = mine ? p.stats() : emptyStats();
  const tech = mine ? techs : NO_TECHS;
  let support = 0;
  for (const f of p.navy.fleets.values()) {
    if (f.missionSr !== sr || !sides.sameSide(f.owner, attacker)) continue;
    if (f.mission !== "invasion_support" && f.mission !== "strike") continue;
    for (const [cls, gen] of fleetShipsOf(f)) {
      const s = shipStats(cls, gen, stats, tech);
      support += s.heavy + Math.floor(s.light / 2);
    }
  }
  return support === 0 ? 0 : shoreBombardBp(support, stats);
}

const NO_TECHS: ReadonlySet<WwTechId> = new Set();

// ---- Sea routes and convoys (spec §3.3, §10) ----

/** The world edgePassable asks, from the screens' data. */
export function passQueryOf(
  p: LandSeaAir,
  economy: WwEconomyView,
  sides: SeaAirSides,
): PassQuery {
  return {
    controller: (r) => economy.controller[r] ?? 0,
    isEnemy: (a, b) => sides.isEnemy(a, b),
    neutralTurkey: (r) => p.neutralTurkey(economy.controller[r] ?? 0),
    isAtWarAny: (a) => p.atWarAny(a),
  };
}

/** Sea km from zone `from` to the nearest of `to` for `who` now; null: no way. */
export function seaKm(
  p: LandSeaAir,
  scenario: ScenarioIndex,
  economy: WwEconomyView,
  sides: SeaAirSides,
  who: number,
  warship: boolean,
  from: number,
  to: readonly number[],
): { zones: number[]; km: number } | null {
  if (from === 0 || to.length === 0) return null;
  const q = passQueryOf(p, economy, sides);
  return seaPath(scenario, [from], to, (e) =>
    edgePassable(scenario, e, who, warship, q),
  );
}

/**
 * Sea km from zone `from` to every zone reachable for `who` now (the
 * distances seaPath finds, one search for many targets: the candidate
 * zones of a mission, the coasts of a landing).
 */
export function seaDistancesFrom(
  p: LandSeaAir,
  scenario: ScenarioIndex,
  economy: WwEconomyView,
  sides: SeaAirSides,
  who: number,
  warship: boolean,
  from: number,
): Map<number, number> {
  const out = new Map<number, number>();
  if (from === 0) return out;
  const q = passQueryOf(p, economy, sides);
  const zones = scenario.navalZones();
  const at = new Map<number, number>();
  zones.forEach((z, i) => at.set(z, i));
  const dist = new Float64Array(zones.length).fill(Infinity);
  const done = new Uint8Array(zones.length);
  const start = at.get(from);
  if (start === undefined) return out;
  dist[start] = 0;
  for (;;) {
    let best = -1;
    for (let i = 0; i < zones.length; i++) {
      if (done[i] === 0 && dist[i] !== Infinity) {
        if (best < 0 || dist[i] < dist[best]) best = i;
      }
    }
    if (best < 0) return out;
    done[best] = 1;
    out.set(zones[best], dist[best]);
    for (const { to, edge } of scenario.seaEdgesOf(zones[best])) {
      const j = at.get(to);
      if (j === undefined || done[j] === 1) continue;
      if (!edgePassable(scenario, edge, who, warship, q)) continue;
      const d = dist[best] + scenario.seaEdge(edge).km;
      if (d < dist[j]) dist[j] = d;
    }
  }
}

/** Plan decision 20: idle convoys = stock − Σ bound − Σ route shares. */
export function idleConvoys(d: CountryNavyDetail | null): number {
  if (d === null) return 0;
  let used = 0;
  for (let i = 0; i < CONVOY_USES.length; i++) used += d.convoysByUse[i] ?? 0;
  return Math.max(0, d.convoys - used);
}

/** Spec §10.5: the convoys a group of divisions needs (each ceil(weight × 2)). */
export function convoysNeed(weightsCenti: readonly number[]): number {
  let n = 0;
  for (const w of weightsCenti) n += divisionConvoys(w);
  return n;
}

/** What the land model knows of an army for the sea and air checks. */
export interface ArmyLift {
  /** Its divisions' regions, ascending. */
  regions: number[];
  weightsCenti: number[];
  /** Every division's template has a marine battalion. */
  allMarines: boolean;
  inBattle: boolean;
}

/**
 * Spec §10.4: the sea move's convoy conditions (lane C's seaTransferBlock)
 * between the army's port and `to`; null when it may sail.
 */
export function seaMoveBlock(
  p: LandSeaAir | null,
  scenario: ScenarioIndex,
  economy: WwEconomyView,
  sides: SeaAirSides,
  me: number,
  lift: ArmyLift,
  to: number,
): WwOrderBlock | null {
  if (p === null) return null;
  const from = lift.regions.length === 1 ? lift.regions[0] : 0;
  const ours = (r: number) =>
    r !== 0 &&
    economy.navalPort(r) &&
    sides.sameSide(me, economy.controller[r]);
  const route = seaKm(
    p,
    scenario,
    economy,
    sides,
    me,
    false,
    scenario.harborOf(from),
    [scenario.harborOf(to)].filter((z) => z !== 0),
  );
  return seaTransferBlock({
    fromPort: ours(from),
    toPort: ours(to),
    anyInBattle: lift.inBattle,
    routeKm: route?.km ?? null,
    convoysFree: idleConvoys(p.navy.detail),
    convoysNeed: convoysNeed(lift.weightsCenti),
  });
}

// ---- Paradrops (spec §14.10) ----

/** Spec §14.10: transport planes a drop needs, Σ weight × 20. */
export function transportsNeed(weightsCenti: readonly number[]): number {
  let w = 0;
  for (const x of weightsCenti) w += x;
  return Math.ceil((w * 20) / 100);
}

/** The air war's conditions of a paradrop (lane A2's paradropBlockOf) from the views. */
export function paraBlockFor(
  p: LandSeaAir | null,
  scenario: ScenarioIndex,
  economy: WwEconomyView,
  me: number,
  lift: ArmyLift,
  target: number,
  techs: ReadonlySet<WwTechId>,
): WwOrderBlock | null {
  if (p === null) return null;
  const from = lift.regions[0] ?? 0;
  const t = AIR_TYPES.indexOf("transport_plane");
  const free = p.air.detail?.smallID === me ? (p.air.detail.stock[t] ?? 0) : 0;
  const sr = scenario.regionSr(target);
  return paradropBlockOf({
    fromAirBase:
      from !== 0 && economy.effectiveBuildings("air_base", from) >= 1,
    targetKm:
      from === 0 || scenario.region(target) === undefined
        ? 0
        : scenario.kmBetween(
            scenario.centerTile(from),
            scenario.centerTile(target),
          ),
    transportRangeKm: planeStats("transport_plane", 1, p.stats(), techs)
      .rangeKm,
    transportsFree: free,
    transportsNeed: transportsNeed(lift.weightsCenti),
    airSupPm: sr === 0 ? 0 : p.air.mySuperiority(sr),
  });
}
