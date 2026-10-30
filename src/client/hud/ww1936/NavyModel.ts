// World War 1936 P4 (spec §18.3–§18.5, §18.11): what the fleet card, the
// navy drawer, the ⚓ dial and the army card's landing flow compute from
// the views, as plain data. No Lit here: the screens render it and the
// tests read it. Every judgement is engine-lib's (spec §18.4 "the same
// judging function's reason"): fleetMissionBlock, invasionBlock,
// launchDaysAt, fleetPower, predictNaval, seaPath/edgePassable,
// invasionCapacity, invasionPrepDays, divisionConvoys.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { ID_NAVY } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  type WwOrderBlock,
  type WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ADMIRAL_TRAITS,
  AdmiralTrait,
  admiralTraitBit,
  CONVOY_USES,
  ConvoyUse,
  ENGAGE_RULES,
  EngageRule,
  FLEET_FLAG_AUTO,
  FLEET_FLAG_LOW_FUEL,
  FLEET_FLAG_SPOTTED,
  FLEET_MISSIONS,
  FleetMission,
  FleetShipData,
  FleetSummary,
  NavalLineData,
  NavalSideSum,
  SHIP_CLASSES,
  ShipClass,
  ShipStats,
  WW_EASY_INVASION_SAFE_SUP_PM,
  WW_INVASION_ABORT_SUP_PM,
  WW_INVASION_MAX_KM,
  WW_MAX_DOCKS_PER_LINE,
  WW_MAX_FLEETS,
  WW_MAX_LINE_COUNT,
  WW_MAX_NAVAL_LINES,
  WW_TITLED_ADMIRAL_BASE,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { AdmiralDef, ADMIRALS } from "@openfront/engine-lib/ww1936/Admirals";
import {
  crossingDays,
  easyCrossingLossPm,
  easyInterceptLossPm,
  easyInvasionPrepDays,
  invasionCapacity,
  pickInvasionPort,
} from "@openfront/engine-lib/ww1936/InvasionRules";
import {
  edgeTicks,
  moveNeed,
  regionDistances,
} from "@openfront/engine-lib/ww1936/MoveRules";
import { launchDaysAt } from "@openfront/engine-lib/ww1936/NavalLineRules";
import {
  fleetMissionBlock,
  fleetPower,
  predictNaval,
  tickMilliKm,
} from "@openfront/engine-lib/ww1936/NavalRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  edgePassable,
  seaDistances,
} from "@openfront/engine-lib/ww1936/SeaGraph";
import {
  FLEET_NAMES,
  shipNameKey,
} from "@openfront/engine-lib/ww1936/ShipNames";
import { shipGenTech, shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { translateText } from "../../Utils";
import type { GameView } from "../../view/GameView";
import type { WwAirView } from "../../view/WwAirView";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwLandView } from "../../view/WwLandView";
import { sideKeyOf, type WwNavyView } from "../../view/WwNavyView";
import type { FogModel } from "./FogModel";
import {
  armyLift,
  invasionLandWorld,
  LandSides,
  landSidesOf,
  regionName,
} from "./LandModel";
import {
  convoysNeed,
  fleetShipsOf,
  idleConvoys,
  LandSeaAir,
  passQueryOf,
  seaDistancesFrom,
  seaKm,
  sideMembersOf,
  statsFromArray,
} from "./LandSeaAir";
import { isKoreanUi, today, type WwGame } from "./WorldWarModel";

/** A game the navy and air screens read (GameView satisfies it; tests fake it). */
export type NavyGame = WwGame & {
  wwLand(): WwLandView | null;
  wwEconomy?(): WwEconomyView | null;
  wwNavy?(): WwNavyView | null;
  wwAir?(): WwAirView | null;
};

/** One line of words: a translation key and its params. */
export interface Line {
  key: string;
  params: Record<string, string | number>;
}

/** Everything the navy screens read, built once per redraw. */
export interface NavyCtx {
  scenario: ScenarioIndex;
  navy: WwNavyView;
  air: WwAirView;
  economy: WwEconomyView;
  land: WwLandView | null;
  me: number;
  tag: CountryTag;
  stats: WwStats;
  techs: ReadonlySet<WwTechId>;
  sides: LandSides;
  day: number;
  p4: LandSeaAir;
  /** shipStats of my ships by `${cls}:${gen}` (stats and techs are fixed per ctx). */
  shipMemo: Map<string, ShipStats>;
}

/** The navy and air facts the land model reads (GameRenderer registers them). */
export function seaAirFacts(
  game: NavyGame,
  navy: WwNavyView,
  air: WwAirView,
): LandSeaAir {
  const pol = () => game.wwPolitics?.() ?? null;
  const factionIdx = (id: number) => pol()?.factionIdx(id) ?? -1;
  const atWarAny = (a: number) =>
    (game.worldWarData()?.wars ?? []).some((w) => w.a === a || w.b === a);
  return {
    navy,
    air,
    sideOf: (id) => sideKeyOf(id, factionIdx(id)),
    membersOf: (side) => sideMembersOf(side, pol()?.global?.factions ?? []),
    stats: () =>
      statsFromArray(
        pol()?.detail(game.myPlayer()?.smallID() ?? 0)?.stats ?? null,
      ),
    atWarAny,
    neutralTurkey: (id) =>
      id > 0 &&
      game.worldWarScenario()?.tagOfSmallId(id) === "TUR" &&
      factionIdx(id) < 0 &&
      !atWarAny(id),
  };
}

/** The navy screens' context; null for a spectator or before my data arrives. */
export function navyCtx(game: NavyGame): NavyCtx | null {
  const scenario = game.worldWarScenario();
  const navy = game.wwNavy?.() ?? null;
  const air = game.wwAir?.() ?? null;
  const economy = game.wwEconomy?.() ?? null;
  const me = game.myPlayer();
  if (
    scenario === null ||
    navy === null ||
    air === null ||
    economy === null ||
    me === null
  ) {
    return null;
  }
  const id = me.smallID();
  const tag = scenario.tagOfSmallId(id);
  if (tag === undefined) return null;
  const p4 = seaAirFacts(game, navy, air);
  return {
    scenario,
    navy,
    air,
    economy,
    land: game.wwLand(),
    me: id,
    tag,
    stats: p4.stats(),
    techs: new Set(economy.detail(id)?.researched ?? []),
    sides: landSidesOf(game),
    day: today(game),
    p4,
    shipMemo: new Map(),
  };
}

// ---- Names ----

/** A strategic region's name in the viewer's language (plan decision 38). */
export function srName(
  scenario: ScenarioIndex,
  sr: number,
  korean = isKoreanUi(),
): string {
  const s = scenario.sr(sr);
  return s === undefined ? "" : korean ? s.nameKo : s.name;
}

/** A sea zone's name in the viewer's language. */
export function zoneName(
  scenario: ScenarioIndex,
  zone: number,
  korean = isKoreanUi(),
): string {
  const z = scenario.seaZone(zone);
  return z === undefined ? "" : korean ? z.nameKo : z.name;
}

export const shipClassName = (cls: ShipClass) =>
  translateText(`ww1936.ship_class.${cls}`);
export const shipGenName = (gen: number) =>
  translateText(`ww1936.ship_gen.${gen}`);
export const missionName = (m: FleetMission) =>
  translateText(`ww1936.mission.${m}`);
export const engageName = (r: EngageRule) =>
  translateText(`ww1936.engage.${r}`);

/** A fleet's historical name, or "Fleet n" (plan decision 17). */
export function fleetName(f: Pick<FleetSummary, "nameIdx" | "num">): string {
  const key = f.nameIdx > 0 ? FLEET_NAMES[f.nameIdx - 1] : undefined;
  return key !== undefined
    ? translateText(`ww1936.fleet.${key}`)
    : translateText("ww1936.navy.fleet_name", { n: f.num });
}

/** A ship's name: its list name (ww1936.ship.<key>), or "Destroyer No. n". */
export function shipName(
  scenario: ScenarioIndex,
  s: Pick<FleetShipData, "cls" | "nameIdx" | "nameOwner">,
): string {
  const tag = scenario.tagOfSmallId(s.nameOwner);
  const key = tag === undefined ? null : shipNameKey(tag, s.cls, s.nameIdx);
  return key !== null
    ? translateText(`ww1936.ship.${key}`)
    : `${shipClassName(s.cls)} ${translateText("ww1936.navy.ship_numbered", {
        n: Math.abs(s.nameIdx),
      })}`;
}

/** A real admiral's table row (ADMIRALS index + 1); null for a titled one or none. */
export function admiralDef(id: number): AdmiralDef | null {
  return id > 0 && id < WW_TITLED_ADMIRAL_BASE
    ? (ADMIRALS[id - 1] ?? null)
    : null;
}

/** An admiral's name: the table's key, or "Admiral No. n" for a titled one (plan decision 17). */
export function admiralName(id: number): string {
  if (id <= 0) return translateText("ww1936.navy.admiral_none");
  const def = admiralDef(id);
  if (def !== null) return translateText(`ww1936.admiral.${def.id}`);
  return translateText("ww1936.navy.titled_admiral", { n: id % 100 });
}

export function admiralTraits(def: AdmiralDef | null): AdmiralTrait[] {
  return def === null
    ? []
    : ADMIRAL_TRAITS.filter((t) => def.traits.includes(t));
}

export const ADMIRAL_TRAIT_ICONS: Readonly<Record<AdmiralTrait, string>> = {
  superior_tactician: "♟",
  aviation_enthusiast: "✈",
  sea_wolf: "🐺",
  fleet_protector: "🛡",
  spotter: "🔭",
  amphibious_expert: "⚓",
  // P6 (spec §4.2).
  night_fighter: "🌙",
  convoy_master: "📦",
  fleet_tactician: "♞",
  blockade_runner: "💨",
};

export const SHIP_ICONS: Readonly<
  Record<ShipClass | "convoy" | "floating_harbor", string>
> = {
  dd: "⛴",
  cl: "🚤",
  ca: "🛥",
  bc: "🚢",
  bb: "🚢",
  cv: "🛳",
  ss: "🐟",
  convoy: "📦",
  floating_harbor: "⚓",
};

export const MISSION_ICONS: Readonly<Record<FleetMission, string>> = {
  hold: "⚓",
  patrol: "👁",
  strike: "🗡",
  raid: "🎯",
  escort: "🛡",
  invasion_support: "⛵",
  training: "🚩",
  // P6 (spec §14.1).
  lay_mines: "💣",
  sweep_mines: "🧹",
};

// ---- Fleet numbers ----

const NO_TECHS: ReadonlySet<WwTechId> = new Set();

function statsFor(ctx: NavyCtx, cls: ShipClass, gen: number): ShipStats {
  const key = `${cls}:${gen}`;
  let s = ctx.shipMemo.get(key);
  if (s === undefined) {
    s = shipStats(cls, gen, ctx.stats, ctx.techs);
    ctx.shipMemo.set(key, s);
  }
  return s;
}

/** A ship's numbers: mine with my stats and techs, another's plain. */
function shipOf(ctx: NavyCtx, f: FleetSummary, cls: ShipClass, gen: number) {
  return f.owner === ctx.me && f.ships.length > 0
    ? statsFor(ctx, cls, gen)
    : shipStats(cls, gen, statsFromArray(null), NO_TECHS);
}

/** What one fleet adds up to (spec §7.2, §8.3, §9.9, §15.3). */
export interface FleetNumbers {
  ships: number;
  /** Its shortest-ranged ship's range. */
  rangeKm: number;
  /** Its slowest ship. */
  speedCentiKn: number;
  fuelPerDayMilli: number;
  /** Spec §9.9 fleetPower. */
  power: number;
  hasCarrier: boolean;
}

/** My fleet from its own ships; another country's from its counts at generation 1. */
export function fleetNumbers(ctx: NavyCtx, f: FleetSummary): FleetNumbers {
  const list = fleetShipsOf(f);
  let range = Infinity;
  let speed = Infinity;
  let fuel = 0;
  const views = list.map(([cls, gen, hpPm]) => {
    const st = shipOf(ctx, f, cls, gen);
    range = Math.min(range, st.rangeKm);
    speed = Math.min(speed, st.speedCentiKn);
    fuel += st.fuelPerDayMilli;
    return { stats: st, hpMilli: Math.floor((st.hpMilli * hpPm) / 1000) };
  });
  return {
    ships: list.length,
    rangeKm: range === Infinity ? 0 : range,
    speedCentiKn: speed === Infinity ? 0 : speed,
    fuelPerDayMilli: fuel,
    power: fleetPower(views),
    hasCarrier: list.some(([cls]) => cls === "cv"),
  };
}

/** Km a day at a speed (spec §7.3: a tick's milli-km × 7.5 ticks). */
export function kmPerDay(speedCentiKn: number): number {
  return (tickMilliKm(speedCentiKn) * 15) / 2 / 1000;
}

function edgeKm(scenario: ScenarioIndex, a: number, b: number): number {
  const e = scenario.seaEdgesOf(a).find((x) => x.to === b);
  return e === undefined ? 0 : scenario.seaEdge(e.edge).km;
}

/** Km left on a fleet's path: the rest of this edge, then the edges ahead. */
export function pathKmLeft(scenario: ScenarioIndex, f: FleetSummary): number {
  if (f.path.length === 0) return 0;
  let km = (edgeKm(scenario, f.zone, f.path[0]) * (1000 - f.progPm)) / 1000;
  for (let i = 1; i < f.path.length; i++) {
    km += edgeKm(scenario, f.path[i - 1], f.path[i]);
  }
  return km;
}

/** Whole days for `km` at a speed (at least 1 while there is a way to go). */
export function daysFor(km: number, speedCentiKn: number): number {
  const v = kmPerDay(speedCentiKn);
  if (km <= 0 || v <= 0) return 0;
  return Math.max(1, Math.ceil(km / v));
}

/** Spec §7.1: days to repair at a base of `level`: (1% + 0.3% × level) of the HP a day. */
export function repairDays(hpPm: number, level: number): number {
  const rate = 10 + 3 * Math.max(0, level);
  return hpPm >= 1000 ? 0 : Math.ceil((1000 - hpPm) / rate);
}

/** The fleet card's state line (spec §18.4). */
export function fleetStatus(ctx: NavyCtx, f: FleetSummary): Line {
  const sc = ctx.scenario;
  const missionSr = srName(sc, f.missionSr);
  const speed = () => fleetNumbers(ctx, f).speedCentiKn;
  switch (f.state) {
    case "battle":
      return { key: "ww1936.navy.state_battle", params: {} };
    case "repairing":
      return {
        key: "ww1936.navy.state_repairing",
        params: {
          // The engine's days left (lane N2's repair pace); else a guess.
          days:
            f.repairDays !== undefined && f.repairDays >= 0
              ? f.repairDays
              : repairDays(
                  f.hpPm,
                  ctx.economy.effectiveBuildings("naval_base", f.docked),
                ),
        },
      };
    case "returning":
      return {
        key: "ww1936.navy.state_returning",
        params: { days: daysFor(pathKmLeft(sc, f), speed()) },
      };
    case "on_station":
      return {
        key: "ww1936.navy.state_on_station",
        params: { sr: missionSr, mission: missionName(f.mission) },
      };
    case "sortie":
      return { key: "ww1936.navy.state_sortie", params: { sr: missionSr } };
    case "moving": {
      const last = f.path[f.path.length - 1] ?? f.zone;
      return {
        key: "ww1936.navy.state_moving",
        params: {
          sr: srName(sc, f.missionSr !== 0 ? f.missionSr : sc.zoneSr(last)),
          days: daysFor(pathKmLeft(sc, f), speed()),
        },
      };
    }
    case "docked":
      return {
        key: "ww1936.navy.state_docked",
        params: { port: regionName(sc, f.docked) },
      };
  }
}

// ---- Missions (spec §8.1, §8.3, §18.3-1) ----

/**
 * Where a fleet's range counts from (spec §8.3, the engine's missionKm):
 * its home port's harbor; without a home on the wire, the port it lies
 * in, else its zone.
 */
export function fleetFromZone(ctx: NavyCtx, f: FleetSummary): number {
  if (f.home !== undefined && f.home > 0) return ctx.scenario.harborOf(f.home);
  return f.docked !== 0 ? ctx.scenario.harborOf(f.docked) : f.zone;
}

/** Spec §8.1 training: the sea regions of my side's coasts (lane N1's homeWaterSrs). */
export function homeWaterSrs(ctx: NavyCtx): Set<number> {
  const sc = ctx.scenario;
  const out = new Set<number>();
  for (const r of sc.landRegions) {
    if (!ctx.sides.sameSide(ctx.me, ctx.economy.controller[r.id] ?? 0)) {
      continue;
    }
    const z = sc.harborOf(r.id);
    if (z !== 0) out.add(sc.zoneSr(z));
  }
  out.delete(0);
  return out;
}

export interface MissionTarget {
  sr: number;
  /** Sea km to the region's nearest zone; null: no way. */
  km: number | null;
  block: WwOrderBlock | null;
}

/** Every sea region with fleetMissionBlock's answer for this fleet and mission. */
export function missionTargets(
  ctx: NavyCtx,
  f: FleetSummary,
  mission: FleetMission,
): MissionTarget[] {
  const n = fleetNumbers(ctx, f);
  const dist = seaDistancesFrom(
    ctx.p4,
    ctx.scenario,
    ctx.economy,
    ctx.sides,
    f.owner,
    true,
    fleetFromZone(ctx, f),
  );
  const home = mission === "training" ? homeWaterSrs(ctx) : null;
  const out: MissionTarget[] = [];
  for (const s of ctx.scenario.strategicList()) {
    if (s.kind !== "sea") continue;
    let km: number | null = null;
    for (const z of s.members) {
      const d = dist.get(z);
      if (d !== undefined && (km === null || d < km)) km = d;
    }
    const block = fleetMissionBlock({
      mission,
      srKind: "sea",
      km,
      rangeKm: n.rangeKm,
      inBattle: f.state === "battle",
    });
    out.push({
      sr: s.id,
      km,
      // Lane N1's orderMission: training only in my side's home waters.
      block: block ?? (home !== null && !home.has(s.id) ? "bad_zone" : null),
    });
  }
  return out;
}

/** The sea regions that glow for a mission (spec §18.3-1): the judge allows them and a way reaches. */
export function missionCandidates(
  ctx: NavyCtx,
  f: FleetSummary,
  mission: FleetMission,
): number[] {
  return missionTargets(ctx, f, mission)
    .filter((t) => t.block === null && t.km !== null)
    .map((t) => t.sr);
}

/** Enemy fleets my side spotted in a sea region (spec §8.4: "known"). */
export function knownEnemies(ctx: NavyCtx, sr: number): FleetSummary[] {
  const s = ctx.scenario.sr(sr);
  if (s === undefined) return [];
  const zones = new Set(s.members);
  return [...ctx.navy.fleets.values()]
    .filter(
      (f) =>
        zones.has(f.zone) &&
        ctx.sides.isEnemy(ctx.me, f.owner) &&
        ((f.flags & FLEET_FLAG_SPOTTED) !== 0 || ctx.navy.spottedByMe(f.id)),
    )
    .sort((a, b) => a.id - b.id);
}

/** Spec §9.9: one side's sums for predictNaval. */
export function navalSideSum(
  ships: readonly { stats: ShipStats; hpMilli: number; cls: ShipClass }[],
): NavalSideSum {
  const count = SHIP_CLASSES.map(() => 0);
  const s: NavalSideSum = {
    count,
    hpMilli: 0,
    maxHpMilli: 0,
    orgMilli: 0,
    light: 0,
    heavy: 0,
    torpedo: 0,
    depth: 0,
    carrierAttack: 0,
    armor: 0,
    lightPierce: 0,
    heavyPierce: 0,
    vis: 0,
    minSpeed: 0,
    maxSpeed: 0,
    maneuver: 0,
    modsBp: 0,
  };
  let armor = 0;
  let lp = 0;
  let hp = 0;
  let min = Infinity;
  for (const x of ships) {
    const t = x.stats;
    count[SHIP_CLASSES.indexOf(x.cls)]++;
    s.hpMilli += x.hpMilli;
    s.maxHpMilli += t.hpMilli;
    s.orgMilli += t.orgMilli;
    s.light += t.light;
    s.heavy += t.heavy;
    s.torpedo += t.torpedo;
    s.depth += t.depth;
    s.carrierAttack += t.deck * 60;
    armor += t.armor;
    lp += t.lightPierce;
    hp += t.heavyPierce;
    s.vis = Math.max(s.vis, t.vis);
    min = Math.min(min, t.speedCentiKn);
    s.maxSpeed = Math.max(s.maxSpeed, t.speedCentiKn);
  }
  const n = ships.length;
  if (n > 0) {
    s.armor = Math.floor(armor / n);
    s.lightPierce = Math.floor(lp / n);
    s.heavyPierce = Math.floor(hp / n);
    s.minSpeed = min;
  }
  return s;
}

function sideShips(ctx: NavyCtx, fleets: readonly FleetSummary[]) {
  return fleets.flatMap((f) =>
    fleetShipsOf(f).map(([cls, gen, hpPm]) => {
      const st = shipOf(ctx, f, cls, gen);
      return {
        cls,
        stats: st,
        hpMilli: Math.floor((st.hpMilli * hpPm) / 1000),
      };
    }),
  );
}

/** The preview at a mission's first tap (spec §18.3-1). */
export interface MissionPreview {
  sr: number;
  /** My side's supremacy there now, ‰. */
  supPm: number;
  /** fleetPower of the enemy fleets my side spotted there. */
  enemyPower: number;
  /** predictNaval's ratio against them (‰, ≥ 1000: we hit harder); null: none known, or hidden. */
  ratioPm: number | null;
  /**
   * P6 (spec §8.9, final review C I6): enemies are known but the odds are
   * hidden — some known enemy's navy intel is below the exact band (their
   * ships' true counts would leak through the ratio).
   */
  oddsHidden: boolean;
  km: number | null;
  days: number;
  fuelPerDayMilli: number;
  block: WwOrderBlock | null;
}

export function missionPreview(
  ctx: NavyCtx,
  f: FleetSummary,
  mission: FleetMission,
  sr: number,
  fog?: Pick<FogModel, "bandOf">,
): MissionPreview {
  const n = fleetNumbers(ctx, f);
  const t = missionTargets(ctx, f, mission).find((x) => x.sr === sr);
  const km = t?.km ?? null;
  const enemies = knownEnemies(ctx, sr);
  const oddsHidden =
    fog !== undefined && enemies.some((e) => fog.bandOf(e.owner, ID_NAVY) < 3);
  const theirs = oddsHidden ? [] : sideShips(ctx, enemies);
  const ratio =
    theirs.length === 0
      ? null
      : predictNaval(navalSideSum(sideShips(ctx, [f])), navalSideSum(theirs), {
          attackerPosPct: 0,
          defenderPosPct: 0,
          attackerScreenBonusPm: 0,
          defenderScreenBonusPm: 0,
          attackerCarrierEvery: 3,
          defenderCarrierEvery: 3,
        }).ratioPm;
  return {
    sr,
    supPm: ctx.navy.mySupremacy(sr),
    enemyPower: enemies.reduce((s, e) => s + fleetNumbers(ctx, e).power, 0),
    ratioPm: ratio,
    oddsHidden,
    km,
    days: km === null ? 0 : daysFor(km, n.speedCentiKn),
    fuelPerDayMilli: n.fuelPerDayMilli,
    block:
      t === undefined
        ? "bad_zone"
        : (t.block ?? (km === null ? "no_sea_path" : null)),
  };
}

/** The preview of a move's first tap: the way there. */
export function moveTarget(
  ctx: NavyCtx,
  f: FleetSummary,
  zone: number,
): { zone: number; km: number | null; days: number } {
  const n = fleetNumbers(ctx, f);
  const km =
    seaDistancesFrom(
      ctx.p4,
      ctx.scenario,
      ctx.economy,
      ctx.sides,
      f.owner,
      true,
      fleetFromZone(ctx, f),
    ).get(zone) ?? null;
  return { zone, km, days: km === null ? 0 : daysFor(km, n.speedCentiKn) };
}

/** Spec §13.4: enemy ports a carrier fleet can strike — their harbor zone lies in the fleet's sea region. */
export function portStrikeTargets(ctx: NavyCtx, f: FleetSummary): number[] {
  const sc = ctx.scenario;
  const sr =
    f.missionSr !== 0 && sc.sr(f.missionSr)?.kind === "sea"
      ? f.missionSr
      : sc.zoneSr(f.zone);
  if (sr === 0) return [];
  return sc.landRegions
    .map((r) => r.id)
    .filter((r) => {
      const h = sc.harborOf(r);
      return (
        h !== 0 &&
        sc.zoneSr(h) === sr &&
        ctx.economy.navalPort(r) &&
        ctx.sides.isEnemy(ctx.me, ctx.economy.controller[r] ?? 0)
      );
    });
}

/** My other fleets in the same zone, or the same port (spec §7.2 merge). */
export function mergeTargets(ctx: NavyCtx, f: FleetSummary): number[] {
  return [...ctx.navy.fleets.values()]
    .filter(
      (g) =>
        g.id !== f.id &&
        g.owner === ctx.me &&
        (f.docked !== 0
          ? g.docked === f.docked
          : g.docked === 0 && g.zone === f.zone),
    )
    .map((g) => g.id)
    .sort((a, b) => a - b);
}

// ---- The fleet card (spec §18.4) ----

export const FLEET_BUTTONS = [
  "mission",
  "move",
  "return",
  "engage",
  "split",
  "merge",
  "port_strike",
  "auto",
  "more",
] as const;
export type FleetButton = (typeof FLEET_BUTTONS)[number];

/** Why a card button is greyed: an order judge's refusal, or a one-ship fleet's split. */
export type FleetBlock = WwOrderBlock | "split_single";

export function fleetBlockText(b: FleetBlock): string {
  return translateText(
    b === "split_single"
      ? "ww1936.navy.block_split_single"
      : `ww1936.econ.block.${b}`,
  );
}

export interface FleetCardData {
  fleet: FleetSummary;
  name: string;
  admiral: { id: number; name: string; now: AdmiralNow | null } | null;
  /** Ship counts by class, carriers and capital ships first: [class, n]. */
  counts: [ShipClass, number][];
  numbers: FleetNumbers;
  status: Line;
  lowFuel: boolean;
  auto: boolean;
  /** The card's buttons in order; [port strike] only with a carrier. */
  buttons: { id: FleetButton; block: FleetBlock | null }[];
  mergeWith: number[];
  ports: number[];
}

const CLASS_ORDER: readonly ShipClass[] = [
  "cv",
  "bb",
  "bc",
  "ca",
  "cl",
  "dd",
  "ss",
];

export function fleetCard(ctx: NavyCtx, id: number): FleetCardData | null {
  const f = ctx.navy.fleets.get(id);
  if (f === undefined || f.owner !== ctx.me) return null;
  const n = fleetNumbers(ctx, f);
  const counts = CLASS_ORDER.map((cls): [ShipClass, number] => [
    cls,
    f.counts[SHIP_CLASSES.indexOf(cls)] ?? 0,
  ]).filter(([, k]) => k > 0);
  const battle = f.state === "battle";
  const merge = mergeTargets(ctx, f);
  const ports = n.hasCarrier ? portStrikeTargets(ctx, f) : [];
  const busy: FleetBlock | null = battle ? "fleet_busy" : null;
  // The judge with a region in reach (km 0); then: is any region in reach?
  const mission =
    fleetMissionBlock({
      mission: "patrol",
      srKind: "sea",
      km: 0,
      rangeKm: n.rangeKm,
      inBattle: battle,
    }) ??
    (FLEET_MISSIONS.some((m) => missionCandidates(ctx, f, m).length > 0)
      ? null
      : "out_of_range");
  const mine = [...ctx.navy.fleets.values()].filter((g) => g.owner === ctx.me);
  const blocks: Record<FleetButton, FleetBlock | null> = {
    mission,
    move: busy,
    return: busy,
    engage: null,
    split:
      busy ??
      (n.ships < 2
        ? "split_single"
        : mine.length >= WW_MAX_FLEETS
          ? "too_many_fleets"
          : null),
    merge: busy ?? (merge.length === 0 ? "no_fleet" : null),
    port_strike: busy ?? (ports.length === 0 ? "bad_target" : null),
    auto: null,
    more: null,
  };
  return {
    fleet: f,
    name: fleetName(f),
    admiral:
      f.admiral > 0
        ? {
            id: f.admiral,
            name: admiralName(f.admiral),
            now: admiralNow(ctx, f.admiral),
          }
        : null,
    counts,
    numbers: n,
    status: fleetStatus(ctx, f),
    lowFuel: (f.flags & FLEET_FLAG_LOW_FUEL) !== 0,
    auto: (f.flags & FLEET_FLAG_AUTO) !== 0,
    buttons: FLEET_BUTTONS.filter(
      (b) => b !== "port_strike" || n.hasCarrier,
    ).map((b) => ({ id: b, block: blocks[b] })),
    mergeWith: merge,
    ports,
  };
}

/** The split order (spec §7.2): half of each class (the engine sends the weakest). */
export function splitOrder(f: FleetSummary): WwOrder {
  const counts = SHIP_CLASSES.map((cls, i): [ShipClass, number] => [
    cls,
    Math.floor((f.counts[i] ?? 0) / 2),
  ]).filter(([, n]) => n > 0);
  if (counts.length === 0) {
    // One ship of each class: the first class splits off alone.
    const i = f.counts.findIndex((n) => n > 0);
    counts.push([SHIP_CLASSES[Math.max(0, i)], 1]);
  }
  return { kind: "fleet_split", fleet: f.id, counts, ships: [] };
}

/** The next engage rule (avoid → if stronger → always → avoid). */
export function nextEngage(rule: EngageRule): EngageRule {
  return ENGAGE_RULES[(ENGAGE_RULES.indexOf(rule) + 1) % ENGAGE_RULES.length];
}

/** My side's working naval bases (a fleet's home, fleet_base), by level then id. */
export function homePorts(ctx: NavyCtx): number[] {
  return ctx.scenario.landRegions
    .map((r) => r.id)
    .filter(
      (r) =>
        ctx.economy.navalPort(r) &&
        ctx.sides.sameSide(ctx.me, ctx.economy.controller[r] ?? 0),
    )
    .sort(
      (a, b) =>
        ctx.economy.effectiveBuildings("naval_base", b) -
          ctx.economy.effectiveBuildings("naval_base", a) || a - b,
    );
}

// ---- The navy drawer (spec §18.5) ----

export interface FleetRow {
  id: number;
  state: FleetSummary["state"];
  name: string;
  admiral: string;
  counts: [ShipClass, number][];
  ships: number;
  hpPm: number;
  where: string;
  status: Line;
}

export function fleetRows(ctx: NavyCtx): FleetRow[] {
  return [...ctx.navy.fleets.values()]
    .filter((f) => f.owner === ctx.me)
    .sort((a, b) => a.id - b.id)
    .map((f) => {
      const c = fleetCard(ctx, f.id)!;
      const sc = ctx.scenario;
      return {
        id: f.id,
        state: f.state,
        name: c.name,
        admiral: admiralName(f.admiral),
        counts: c.counts,
        ships: c.numbers.ships,
        hpPm: f.hpPm,
        where:
          f.mission !== "hold" && f.missionSr !== 0
            ? translateText("ww1936.navy.fleet_row_mission", {
                mission: missionName(f.mission),
                sr: srName(sc, f.missionSr),
              })
            : f.docked !== 0
              ? regionName(sc, f.docked)
              : srName(sc, sc.zoneSr(f.zone)),
        status: c.status,
      };
    });
}

/** "Dockyards 32 (repair 6, idle 2)". */
export function docksLine(ctx: NavyCtx): Line | null {
  const d = ctx.navy.detail;
  if (d === null) return null;
  return {
    key: "ww1936.navy.docks_line",
    params: { n: d.docks, r: d.docksLent, i: d.docksIdle },
  };
}

export interface LineCard {
  line: NavalLineData;
  index: number;
  /** Progress on the next unit, 0..1. */
  progress: number;
  /** launchDaysAt the view's unit cost: −1 when it makes nothing. */
  nextDays: number;
  nextName: string | null;
  portName: string;
  /** Its resources fall short (fill below 1000‰). */
  short: boolean;
}

export function lineCards(ctx: NavyCtx): LineCard[] {
  const d = ctx.navy.detail;
  if (d === null) return [];
  return d.lines.map((l, index) => {
    const key =
      l.cls === "convoy" || l.cls === "floating_harbor" || l.nextName <= 0
        ? null
        : shipNameKey(ctx.tag, l.cls, l.nextName);
    return {
      line: l,
      index,
      progress:
        l.costMilli <= 0 ? 0 : Math.min(1, l.progressMilli / l.costMilli),
      // P6 T1b (lane E): the line's own unit cost (a design's modules,
      // the naval MIO, a licence), as the engine launches it.
      nextDays: launchDaysAt(l.costMilli, l.progressMilli, l.outputMilli),
      nextName: key === null ? null : translateText(`ww1936.ship.${key}`),
      portName: regionName(ctx.scenario, l.port),
      short: l.fill < 1000,
    };
  });
}

/** What a new line can build (spec §5.2): the classes and the convoy. */
export const LINE_CLASSES: readonly (ShipClass | "convoy")[] = [
  ...SHIP_CLASSES,
  "convoy",
];

/** Generations of a line class (spec §4.2; the convoy has one, plan decision 14). */
export function lineGens(cls: ShipClass | "convoy"): number[] {
  if (cls === "convoy") return [1];
  return cls === "ca" || cls === "bc" ? [1, 2, 3] : [1, 2, 3, 4];
}

/** My own working naval bases: a new line's port (spec §5.2). */
export function linePorts(ctx: NavyCtx): number[] {
  return homePorts(ctx).filter(
    (r) => (ctx.economy.controller[r] ?? 0) === ctx.me,
  );
}

/**
 * Why a new line can't start (spec §5.2): the line limit, the
 * generation's tech, no port, no dockyard. The engine (lane E) judges the
 * order again.
 */
export function newLineBlock(
  ctx: NavyCtx,
  cls: ShipClass | "convoy",
  gen: number,
): WwOrderBlock | null {
  const d = ctx.navy.detail;
  if ((d?.lines.length ?? 0) >= WW_MAX_NAVAL_LINES) return "line_full";
  if (cls !== "convoy") {
    const tech = shipGenTech(cls, gen);
    if (tech !== null && !ctx.techs.has(tech)) return "no_tech";
  }
  if (linePorts(ctx).length === 0) return "no_naval_base";
  if ((d?.docks ?? 0) <= 0) return "no_dock";
  return null;
}

export function newLineOrder(
  cls: ShipClass | "convoy",
  gen: number,
  port: number,
  docks: number,
  count: number,
): WwOrder {
  return {
    kind: "naval_line_add",
    cls,
    gen,
    docks: Math.max(1, Math.min(WW_MAX_DOCKS_PER_LINE, docks)),
    count: Math.max(0, Math.min(WW_MAX_LINE_COUNT, count)),
    port,
  };
}

// ---- Convoys (spec §18.5-3) ----

export interface ConvoySummary {
  all: number;
  used: number;
  byUse: Record<ConvoyUse, number>;
  idle: number;
}

export function convoySummary(ctx: NavyCtx): ConvoySummary | null {
  const d = ctx.navy.detail;
  if (d === null) return null;
  const byUse = Object.fromEntries(
    CONVOY_USES.map((u, i) => [u, d.convoysByUse[i] ?? 0]),
  ) as Record<ConvoyUse, number>;
  const idle = idleConvoys(d);
  return { all: d.convoys, used: d.convoys - idle, byUse, idle };
}

export interface RouteRow {
  id: number;
  use: ConvoyUse;
  from: string;
  to: string;
  need: number;
  got: number;
  effPct: number;
  via: string[];
}

export function routeRows(ctx: NavyCtx): RouteRow[] {
  const d = ctx.navy.detail;
  if (d === null) return [];
  const sc = ctx.scenario;
  return d.routes.map((r) => {
    const from = r.zones[0] ?? 0;
    const to = r.zones[r.zones.length - 1] ?? 0;
    return {
      id: r.id,
      use: r.use,
      from: zoneName(sc, from),
      to:
        r.use === "supply" && sc.region(r.ref) !== undefined
          ? regionName(sc, r.ref)
          : zoneName(sc, to),
      need: r.need,
      got: r.got,
      effPct:
        r.need <= 0
          ? 100
          : Math.floor((Math.min(r.got, r.need) * 100) / r.need),
      via: r.srs.map((s) => srName(sc, s)),
    };
  });
}

/** Convoys lost a day over the last 30 days (oldest first), and yesterday's by sea region. */
export function convoyLosses(ctx: NavyCtx): {
  days: number[];
  max: number;
  bySr: [string, number][];
} {
  const days = (ctx.navy.detail?.convoyLoss30 ?? []).map((m) => m / 1000);
  const max = days.reduce((a, b) => Math.max(a, b), 0);
  const bySr: [string, number][] = [];
  const srs = [...ctx.navy.seaRegions.values()].sort((a, b) => a.sr - b.sr);
  for (const s of srs) {
    const lost = s.convoyLoss.find(([id]) => id === ctx.me)?.[1] ?? 0;
    if (lost > 0) bySr.push([srName(ctx.scenario, s.sr), lost / 1000]);
  }
  return { days, max, bySr };
}

// ---- Admirals (spec §18.5-4) ----

/** An admiral as he is now: skills (attack, defense, maneuver, coordination), traits, level. */
export interface AdmiralNow {
  skills: [number, number, number, number];
  traits: AdmiralTrait[];
  level: number;
}

/** From my detail's admiralSkills (titled admirals too); else a real one's table row. */
export function admiralNow(ctx: NavyCtx, id: number): AdmiralNow | null {
  const row = ctx.navy.detail?.admiralSkills?.find((x) => x[0] === id);
  if (row !== undefined) {
    return {
      skills: [row[1], row[2], row[3], row[4]],
      traits: ADMIRAL_TRAITS.filter((t) => (row[5] & admiralTraitBit(t)) !== 0),
      level: row[6],
    };
  }
  const def = admiralDef(id);
  return def === null
    ? null
    : {
        skills: [def.atk, def.def, def.man, def.coord],
        traits: admiralTraits(def),
        level: 0,
      };
}

export interface AdmiralRow {
  id: number;
  name: string;
  now: AdmiralNow | null;
  fleet: number;
  fleetName: string | null;
}

export function admiralRows(ctx: NavyCtx): AdmiralRow[] {
  const d = ctx.navy.detail;
  if (d === null) return [];
  return d.admirals
    .map(([id, fleet]) => {
      const f = ctx.navy.fleets.get(fleet);
      return {
        id,
        name: admiralName(id),
        now: admiralNow(ctx, id),
        fleet,
        fleetName: f === undefined ? null : fleetName(f),
      };
    })
    .sort((a, b) => a.id - b.id);
}

/** Admirals without a fleet (the card's "change admiral" list). */
export function freeAdmirals(ctx: NavyCtx): number[] {
  return admiralRows(ctx)
    .filter((a) => a.fleet === 0 || !ctx.navy.fleets.has(a.fleet))
    .map((a) => a.id);
}

// ---- Landings (spec §11, §18.3-5; a human's are easy invasions) ----

/** A route sea region's light: green — no loss (≥ 50% or no enemy), amber — 40–50%, red — below. */
export type SupLight = "green" | "amber" | "red";

export function supLight(supPm: number, enemyPm: number): SupLight {
  if (enemyPm <= 0 || supPm >= WW_EASY_INVASION_SAFE_SUP_PM) return "green";
  return supPm >= WW_INVASION_ABORT_SUP_PM ? "amber" : "red";
}

/** The supremacy ‰ of the sides at war with me in a sea region (the engine's enemySupPm). */
export function enemySupremacy(ctx: NavyCtx, sr: number): number {
  const mine = ctx.p4.sideOf(ctx.me);
  let e = 0;
  for (const [k, pm] of ctx.navy.seaRegions.get(sr)?.sup ?? []) {
    if (k === mine) continue;
    if (ctx.p4.membersOf(k).some((m) => ctx.sides.isEnemy(ctx.me, m))) {
      e += pm;
    }
  }
  return Math.min(1000, e);
}

export interface InvasionPreview {
  army: number;
  target: number;
  /** The start port: the nearest by travel time with a sea route (0: none). */
  from: number;
  routeKm: number | null;
  /** The route's sea regions: my supremacy, the daily loss there, its light. */
  route: { sr: number; supPm: number; lossPm: number; light: SupLight }[];
  /** The crossing's expected losses ‰ (capped at half). */
  lossPm: number;
  convoysNeed: number;
  convoysIdle: number;
  prepDays: number;
  /** Days marching to the port, at sea, and the whole way to the landing. */
  marchDays: number;
  seaDays: number;
  etaDays: number;
  divisions: number;
  capacity: number;
  /** Divisions that land, and those that stay (split: stay > 0). */
  going: number;
  stay: number;
  block: WwOrderBlock | null;
}

/** The sea km a convoy of mine sails from zone to every zone it reaches, many sources at once. */
function seaDistMap(
  ctx: NavyCtx,
  from: readonly number[],
): Map<number, number> {
  const sc = ctx.scenario;
  const q = passQueryOf(ctx.p4, ctx.economy, ctx.sides);
  const dist = seaDistances(sc, from, (e) =>
    edgePassable(sc, e, ctx.me, false, q),
  );
  const out = new Map<number, number>();
  sc.navalZones().forEach((z, i) => {
    if (dist[i] !== Infinity) out.set(z, dist[i]);
  });
  return out;
}

/** The km of the shortest sea edge between neighbouring zones. */
function zoneEdgeKm(sc: ScenarioIndex, a: number, b: number): number {
  let km = -1;
  for (const e of sc.seaEdgesOf(a)) {
    if (e.to !== b) continue;
    const k = sc.seaEdge(e.edge).km;
    if (km < 0 || k < km) km = k;
  }
  return Math.max(0, km);
}

/**
 * The card of a landing's first tap (easy invasions, the engine's own
 * judges): the start port (InvasionRules.pickInvasionPort), the route and
 * each sea region's supremacy with its light, the expected losses, the
 * preparation, the days to the landing, the split; the refusal's reason.
 */
export function invasionPreview(
  ctx: NavyCtx,
  army: number,
  target: number,
): InvasionPreview | null {
  const land = ctx.land;
  const a = land?.armies.get(army);
  if (land === null || a === undefined || a.owner !== ctx.me) return null;
  const sc = ctx.scenario;
  const lift = armyLift(land, ctx.economy, ctx.me, army);
  const capacity = invasionCapacity(ctx.stats, ctx.techs);
  const going = Math.min(a.divisions, capacity);
  const out: InvasionPreview = {
    army,
    target,
    from: 0,
    routeKm: null,
    route: [],
    lossPm: 0,
    convoysNeed: convoysNeed(lift.weightsCenti.slice(0, going)),
    convoysIdle: idleConvoys(ctx.navy.detail),
    prepDays: 0,
    marchDays: 0,
    seaDays: 0,
    etaDays: 0,
    divisions: a.divisions,
    capacity,
    going,
    stay: a.divisions - going,
    block: null,
  };
  const harbor = sc.harborOf(target);
  const block = (b: WwOrderBlock) => ({ ...out, block: b });
  if (lift.inBattle) return block("army_busy");
  if (harbor === 0) return block("not_coastal");
  if (!ctx.sides.isEnemy(ctx.me, ctx.economy.controller[target] ?? 0)) {
    return block("not_at_war");
  }
  const world = invasionLandWorld(land, ctx.economy, ctx.me, army, ctx.sides);
  if (world === null) return null;
  const fromTarget = seaDistMap(ctx, [harbor]);
  const plan = pickInvasionPort({
    ...world,
    seaKm: (port) => fromTarget.get(sc.harborOf(port)) ?? null,
  });
  if (typeof plan === "string") return block(plan);
  const way = seaKm(
    ctx.p4,
    sc,
    ctx.economy,
    ctx.sides,
    ctx.me,
    false,
    sc.harborOf(plan.port),
    [harbor],
  );
  if (way === null) return block("no_sea_path");
  const route: InvasionPreview["route"] = [];
  const lossOf = new Map<number, number>();
  for (const z of way.zones) {
    const sr = sc.zoneSr(z);
    if (sr === 0 || lossOf.has(sr)) continue;
    const supPm = ctx.navy.mySupremacy(sr);
    const enemy = enemySupremacy(ctx, sr);
    const lossPm = easyInterceptLossPm(supPm, enemy, 0);
    lossOf.set(sr, lossPm);
    route.push({ sr, supPm, lossPm, light: supLight(supPm, enemy) });
  }
  const legs = way.zones.map((z, i) => ({
    km: i + 1 < way.zones.length ? zoneEdgeKm(sc, z, way.zones[i + 1]) : 0,
    lossPm: lossOf.get(sc.zoneSr(z)) ?? 0,
  }));
  const speed = ctx.stats.navalSpeedPct;
  const prepDays = easyInvasionPrepDays(
    ctx.stats,
    ctx.techs,
    lift.allMarines,
    false,
    way.km,
  );
  const marchDays = Math.ceil((plan.ticks * 2) / 15);
  const seaDays = crossingDays(way.km, speed);
  return {
    ...out,
    from: plan.port,
    routeKm: way.km,
    route,
    lossPm: easyCrossingLossPm(legs, speed),
    prepDays,
    marchDays,
    seaDays,
    etaDays: marchDays + prepDays + seaDays,
  };
}

/** What [Invade] can reach: my side's ports the army marches to, the enemy coasts their convoys reach. */
interface InvasionReach {
  ports: number[];
  targets: number[];
  enemyCoasts: number;
}

const reachMemo = new WeakMap<object, { key: string; reach: InvasionReach }>();

function invasionReach(ctx: NavyCtx, army: number): InvasionReach {
  const none = { ports: [], targets: [], enemyCoasts: 0 };
  const land = ctx.land;
  if (land === null) return none;
  const key = [
    army,
    land.version,
    ctx.economy.version,
    ctx.navy.version,
    ctx.sides.stamp?.() ?? "",
  ].join(":");
  const kept = reachMemo.get(land);
  if (kept !== undefined && kept.key === key) return kept.reach;
  const sc = ctx.scenario;
  const reach: InvasionReach = { ports: [], targets: [], enemyCoasts: 0 };
  const world = invasionLandWorld(land, ctx.economy, ctx.me, army, ctx.sides);
  if (world !== null) {
    const walk = regionDistances(sc, world.from, world.ours, (e, to) =>
      edgeTicks(moveNeed(sc.edge(e), sc.landOf(to)), world.walkStep),
    );
    for (const r of walk.keys()) if (world.isPort(r)) reach.ports.push(r);
    reach.ports.sort((x, y) => x - y);
    const dist = seaDistMap(
      ctx,
      reach.ports.map((r) => sc.harborOf(r)),
    );
    for (const r of sc.landRegions) {
      const h = sc.harborOf(r.id);
      if (h === 0) continue;
      if (!ctx.sides.isEnemy(ctx.me, ctx.economy.controller[r.id] ?? 0)) {
        continue;
      }
      reach.enemyCoasts++;
      const km = dist.get(h);
      if (km !== undefined && km <= WW_INVASION_MAX_KM)
        reach.targets.push(r.id);
    }
  }
  reachMemo.set(land, { key, reach });
  return reach;
}

/** Enemy coastal regions the army can land on — over land to a port, then by sea (they glow, spec §18.3-5). */
export function invasionTargets(ctx: NavyCtx, army: number): number[] {
  return invasionReach(ctx, army).targets;
}

/** My army's landing in progress, if any. */
export function invasionOf(ctx: NavyCtx, army: number) {
  return ctx.navy.detail?.invasions.find((x) => x.army === army) ?? null;
}

/** The army card's [Invade] button: why not (no target yet) — fighting, no port reached, no enemy coast in reach. */
export function invadeButtonBlock(
  ctx: NavyCtx,
  army: number,
): WwOrderBlock | null {
  const land = ctx.land;
  if (land === null) return "no_army";
  if (armyLift(land, ctx.economy, ctx.me, army).inBattle) return "army_busy";
  const reach = invasionReach(ctx, army);
  if (reach.enemyCoasts === 0) return "not_at_war";
  if (reach.ports.length === 0) return "no_invasion_port";
  return reach.targets.length === 0 ? "no_sea_path" : null;
}

// ---- The ⚓ dial (spec §18.1) ----

export interface NavyDialModel {
  /** The first naval line's progress, 0..1. */
  progress: number;
  /** My fleets in a battle now. */
  battle: number;
  /**
   * My ships sunk since today began: in battle (WwNavyView.mySunkTicks) or
   * by anything (air and port strikes too: the engine's lostToday, Task 15).
   */
  lost: number;
}

/** `dayStart`: the first tick of today (Calendar.dayStartTick). */
export function navyDial(ctx: NavyCtx, dayStart: number): NavyDialModel {
  const line = ctx.navy.detail?.lines[0];
  const mine = [...ctx.navy.fleets.values()].filter((f) => f.owner === ctx.me);
  return {
    progress:
      line === undefined || line.costMilli <= 0
        ? 0
        : Math.min(1, line.progressMilli / line.costMilli),
    battle: mine.filter((f) => f.state === "battle").length,
    lost: Math.max(
      ctx.navy.mySunkTicks.filter((t) => t >= dayStart).length,
      ctx.navy.detail?.lostToday?.[0] === dayStart
        ? ctx.navy.detail.lostToday[1]
        : 0,
    ),
  };
}

/** The class that stands for a fleet: its biggest ship's (carriers first). */
export function mainClass(f: Pick<FleetSummary, "counts">): ShipClass {
  return (
    CLASS_ORDER.find((c) => (f.counts[SHIP_CLASSES.indexOf(c)] ?? 0) > 0) ??
    "dd"
  );
}

/** The foundation's handle (plan Task 1): the navy screens' context over its game. */
export class NavyModel {
  constructor(
    readonly navy: WwNavyView,
    readonly air: WwAirView,
    readonly game: GameView | NavyGame,
  ) {}

  ctx(): NavyCtx | null {
    return navyCtx(this.game as NavyGame);
  }
}

// ---- Notices (spec §18.10, plan decision 5) ----

/**
 * The P4 notices' params in the viewer's words: `sr` (and `zone`) → the
 * strategic region's name (scenario name/nameKo), `srs` → a list of them,
 * `port` → the region, `cls` → ww1936.ship_class.<cls> (the convoy: its
 * equipment name), `ship` → ww1936.ship.<key> or "No. n" (the text names
 * the class), `fleet` → the fleet's name, `gained` →
 * `dir` up | down (lane A1's air-control notice).
 */
export function navyNoticeParams(
  message: string,
  params: Record<string, string | number>,
  scenario: ScenarioIndex,
  navy: WwNavyView | null,
  korean = isKoreanUi(),
): Record<string, string | number> {
  const out: Record<string, string | number> = { ...params };
  const cls = typeof params.cls === "string" ? params.cls : null;
  const clsText =
    cls === null
      ? ""
      : cls === "convoy"
        ? translateText("ww1936.equip.convoy")
        : (SHIP_CLASSES as readonly string[]).includes(cls)
          ? shipClassName(cls as ShipClass)
          : cls;
  if (cls !== null) out.cls = clsText;
  if (typeof params.sr === "number")
    out.sr = srName(scenario, params.sr, korean);
  if (typeof params.zone === "number") {
    out.zone =
      params.zone > SEA_ZONE_BASE
        ? zoneName(scenario, params.zone, korean)
        : srName(scenario, params.zone, korean);
  }
  if (typeof params.port === "number") {
    out.port = regionName(scenario, params.port, korean);
  }
  if (typeof params.srs === "number") {
    out.srs = srName(scenario, params.srs, korean);
  } else if (typeof params.srs === "string" && /^[\d, ]+$/.test(params.srs)) {
    out.srs = params.srs
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => x > 0)
      .map((x) => srName(scenario, x, korean))
      .join(", ");
  }
  if (params.ship !== undefined) {
    // Lane E: a name key, or the n of a numbered name (the text names the class).
    const s = params.ship;
    out.ship =
      typeof s === "string"
        ? translateText(`ww1936.ship.${s}`)
        : translateText("ww1936.navy.ship_numbered", { n: Math.abs(s) });
  }
  // Lane N2's named sinking (world news): the name from its list index.
  if (
    params.ship === undefined &&
    typeof params.nameIdx === "number" &&
    typeof params.nameTag === "string" &&
    cls !== null &&
    (SHIP_CLASSES as readonly string[]).includes(cls)
  ) {
    out.ship = shipName(scenario, {
      cls: cls as ShipClass,
      nameIdx: params.nameIdx,
      nameOwner: scenario.smallIdOf(params.nameTag as CountryTag),
    });
  }
  if (typeof params.fleet === "number") {
    const f = navy?.fleets.get(params.fleet);
    out.fleet =
      f !== undefined
        ? fleetName(f)
        : translateText("ww1936.navy.fleet_name", { n: params.fleet });
  }
  if (params.gained !== undefined && params.dir === undefined) {
    out.dir = Number(params.gained) !== 0 ? "up" : "down";
  }
  if (
    message === "events_display.ww1936_air_superiority" &&
    params.zone === undefined &&
    out.sr !== undefined
  ) {
    out.zone = out.sr;
  }
  return out;
}

// ---- The region card (spec §18.9) ----

/** The P4 buildings the region card names, with their translation suffixes. */
const REGION_LEVELS = [
  ["naval_base", "naval_base"],
  ["air_base", "air_base"],
  ["anti_air", "anti_air"],
  ["radar", "radar"],
  ["coastal_fort", "coastal_fort"],
] as const;

/** Bomb damage that stops whole factories (spec §14.8): civilian, military, dockyards. */
const FACTORY_BUILDINGS = ["civ", "mil", "dock"] as const;

export interface RegionSeaAirLines {
  /** Working levels above 0: [building, level]. */
  levels: [(typeof REGION_LEVELS)[number][1], number][];
  /**
   * Factories bombed out of work, and the repair of the building being
   * mended (WwRegionData.repairPm, the engine's progress).
   */
  bombed: { stopped: number; repairPct: number } | null;
  docked: { name: string; ships: number }[];
  /** The harbor zone's name and its sea region's; null with no coast. */
  harbor: string | null;
  seaSr: string;
  airZone: string;
}

export function regionSeaAirLines(
  scenario: ScenarioIndex,
  economy: WwEconomyView,
  navy: WwNavyView | null,
  region: number,
  korean = isKoreanUi(),
): RegionSeaAirLines {
  const levels: RegionSeaAirLines["levels"] = [];
  for (const [b, key] of REGION_LEVELS) {
    const n = economy.effectiveBuildings(b, region);
    if (n > 0) levels.push([key, n]);
  }
  let stopped = 0;
  for (const b of FACTORY_BUILDINGS) {
    stopped +=
      economy.buildingCount(b, region) - economy.effectiveBuildings(b, region);
  }
  const data = economy.region(region);
  const damaged = data.damage.some((v) => v > 0);
  const docked = [...(navy?.fleets.values() ?? [])]
    .filter((f) => f.docked === region)
    .sort((a, b) => a.id - b.id)
    .map((f) => ({
      name: fleetName(f),
      ships: f.counts.reduce((a, b) => a + b, 0),
    }));
  const harbor = scenario.harborOf(region);
  return {
    levels,
    bombed: !damaged
      ? null
      : { stopped, repairPct: Math.floor((data.repairPm ?? 0) / 10) },
    docked,
    harbor: harbor === 0 ? null : zoneName(scenario, harbor, korean),
    seaSr:
      harbor === 0 ? "" : srName(scenario, scenario.zoneSr(harbor), korean),
    airZone: srName(scenario, scenario.regionSr(region), korean),
  };
}
