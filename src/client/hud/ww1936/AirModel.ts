// World War 1936 P4 (spec §13, §14, §18.1, §18.6, §18.7): what the air
// zone card, the air drawer and the ✈ dial compute from the views, as
// plain data. Every judgement is engine-lib's: planeStats (range),
// weatherAt.
import {
  AIR_TYPES,
  AirMission,
  AirType,
  AirZoneResult,
  WW_AIR_BASE_CAPACITY,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Weather } from "@openfront/engine-api/ww1936/LandTypes";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import { translateText } from "../../Utils";
import type { GameView } from "../../view/GameView";
import type { WwAirView } from "../../view/WwAirView";
import type { WwNavyView } from "../../view/WwNavyView";
import { borderRegions, regionName } from "./LandModel";
import { NavyCtx, navyCtx, NavyGame, srName } from "./NavyModel";
import { wwEpoch } from "./WwClientCalendar";

/** The air screens read the navy screens' context (the same views and facts). */
export type AirCtx = NavyCtx;
export const airCtx = navyCtx;

export const airTypeName = (t: AirType) => translateText(`ww1936.equip.${t}`);
export const airMissionName = (m: AirMission) =>
  translateText(`ww1936.air_mission.${m}`);

export const AIR_MISSION_ICONS: Readonly<Record<AirMission, string>> = {
  air_superiority: "🛡",
  interception: "🎯",
  cas: "💥",
  strategic_bombing: "🏭",
  naval_strike: "⚓",
  port_strike: "🏝",
  naval_patrol: "👁",
  paradrop: "🪂",
  air_supply: "📦",
  // P6 (spec §15.3).
  recon: "📷",
  // ww8 (design §3.4).
  escort: "🛩",
};

/** Spec §13.1: a zone's weather — a land zone's center region, a sea zone's center zone (flat). */
export function zoneWeather(
  scenario: ScenarioIndex,
  sr: number,
  day: number,
): Weather {
  const s = scenario.sr(sr);
  if (s === undefined) return "clear";
  const at = scenario.regionAt(s.center);
  if (s.kind === "land" && scenario.region(at) !== undefined) {
    return weatherAt(
      day,
      scenario.latC(at),
      scenario.landOf(at),
      scenario.wcell(at),
      wwEpoch(),
    );
  }
  const zone = scenario.seaZone(at) !== undefined ? at : (s.members[0] ?? 0);
  return weatherAt(
    day,
    scenario.zoneLatC(zone),
    "plains",
    scenario.zoneWcell(zone),
    wwEpoch(),
  );
}

/** My planes of a type flying a mission over a zone (every base), per generation. */
export function deployedGens(
  air: WwAirView,
  me: number,
  sr: number,
  type: AirType,
  mission: AirMission | null,
): number[] {
  const gens = new Array<number>(EQUIPMENT_GENS[type]).fill(0);
  for (const d of air.deployments.values()) {
    if (d.owner !== me || d.sr !== sr || d.type !== type) continue;
    if (mission !== null && d.mission !== mission) continue;
    d.counts.forEach((c, i) => (gens[i] = (gens[i] ?? 0) + c));
  }
  return gens;
}

export function deployedHere(
  air: WwAirView,
  me: number,
  sr: number,
  type: AirType,
  mission: AirMission | null,
): number {
  let n = deployedGens(air, me, sr, type, mission).reduce((a, b) => a + b, 0);
  // P6 T1b (lane E): the design planes flying as the type.
  for (const d of air.deployments.values()) {
    if (d.owner !== me || d.sr !== sr || d.type !== type) continue;
    if (mission !== null && d.mission !== mission) continue;
    for (const c of d.dcounts ?? []) n += c;
  }
  return n;
}

/** My idle planes of a type (the reserve: stock, plan Review Focus 3). */
export function idlePlanes(ctx: AirCtx, type: AirType): number {
  const d = ctx.air.detail;
  return d?.smallID === ctx.me ? (d.stock[AIR_TYPES.indexOf(type)] ?? 0) : 0;
}

/** The best generation I have of a type (reserve or anywhere deployed); 1 with none. */
function bestGen(ctx: AirCtx, type: AirType): number {
  const stock = ctx.economy.detail(ctx.me)?.stock ?? [];
  for (let g = EQUIPMENT_GENS[type]; g >= 1; g--) {
    if ((stock[equipKey(type, g)] ?? 0) > 0) return g;
    for (const d of ctx.air.deployments.values()) {
      if (d.owner === ctx.me && d.type === type && (d.counts[g - 1] ?? 0) > 0) {
        return g;
      }
    }
  }
  return 1;
}

export interface AirBaseView {
  region: number;
  name: string;
  level: number;
  used: number;
  cap: number;
  damagePm: number;
  km: number;
}

/** My side's working air bases (spec §13.3), with my own bases' use. */
export function sideAirBases(ctx: AirCtx): AirBaseView[] {
  const mine = new Map(
    (ctx.air.detail?.smallID === ctx.me ? ctx.air.detail.bases : []).map(
      (b) => [b.region, b],
    ),
  );
  const out: AirBaseView[] = [];
  for (const r of ctx.scenario.landRegions) {
    const c = ctx.economy.controller[r.id] ?? 0;
    if (!ctx.sides.sameSide(ctx.me, c)) continue;
    const level = ctx.economy.effectiveBuildings("air_base", r.id);
    const b = mine.get(r.id);
    if (level < 1 && b === undefined) continue;
    out.push({
      region: r.id,
      name: regionName(ctx.scenario, r.id),
      level,
      used: b?.used ?? 0,
      cap: b?.cap ?? level * WW_AIR_BASE_CAPACITY,
      damagePm: b?.damagePm ?? 0,
      km: 0,
    });
  }
  return out;
}

/** Spec §13.3: my side's bases within a type's range of a zone (base center → zone center). */
export function basesInRange(
  ctx: AirCtx,
  sr: number,
  type: AirType,
): AirBaseView[] {
  const range = planeStats(
    type,
    bestGen(ctx, type),
    ctx.stats,
    ctx.techs,
  ).rangeKm;
  return sideAirBases(ctx)
    .map((b) => ({ ...b, km: ctx.scenario.srKm(b.region, sr) }))
    .filter((b) => b.km <= range)
    .sort((a, b) => a.km - b.km || a.region - b.region);
}

export interface ZoneCardData {
  sr: number;
  name: string;
  kind: "land" | "sea";
  weather: Weather;
  ours: number;
  theirs: number;
  /** Enemy sorties yesterday by type (everyone sees them until P6's fog). */
  enemySeen: [AirType, number][];
  bases: { used: number; cap: number; count: number };
  aa: number;
  radar: number;
  result: AirZoneResult | null;
}

export function zoneCard(ctx: AirCtx, sr: number): ZoneCardData | null {
  const s = ctx.scenario.sr(sr);
  if (s === undefined) return null;
  const zone = ctx.air.zones.get(sr);
  const mySide = ctx.p4.sideOf(ctx.me);
  let theirs = 0;
  const seen = AIR_TYPES.map(() => 0);
  for (const side of zone?.sides ?? []) {
    if (side.side === mySide) continue;
    const enemy = ctx.p4
      .membersOf(side.side)
      .some((m) => ctx.sides.isEnemy(ctx.me, m));
    if (!enemy) continue;
    theirs = Math.max(theirs, side.supPm);
    side.sorties.forEach((n, i) => (seen[i] += n));
  }
  // The bases any of my types could fly from.
  const types = AIR_TYPES.filter(
    (t) =>
      idlePlanes(ctx, t) > 0 || deployedHere(ctx.air, ctx.me, sr, t, null) > 0,
  );
  const baseSet = new Map<number, AirBaseView>();
  for (const t of types.length > 0 ? types : (["fighter"] as AirType[])) {
    for (const b of basesInRange(ctx, sr, t)) baseSet.set(b.region, b);
  }
  let aa = 0;
  let radar = 0;
  if (s.kind === "land") {
    for (const r of s.members) {
      if ((ctx.economy.controller[r] ?? 0) !== ctx.me) continue;
      aa = Math.max(aa, ctx.economy.effectiveBuildings("anti_air", r));
      radar = Math.max(radar, ctx.economy.effectiveBuildings("radar", r));
    }
  }
  const bases = [...baseSet.values()];
  return {
    sr,
    name: srName(ctx.scenario, sr),
    kind: s.kind,
    weather: zoneWeather(ctx.scenario, sr, ctx.day),
    ours: ctx.air.mySuperiority(sr),
    theirs,
    enemySeen: AIR_TYPES.map((t, i): [AirType, number] => [t, seen[i]]).filter(
      ([, n]) => n > 0,
    ),
    bases: {
      used: bases.reduce((a, b) => a + b.used, 0),
      cap: bases.reduce((a, b) => a + b.cap, 0),
      count: bases.length,
    },
    aa,
    radar,
    result: zone?.result.find(([side]) => side === mySide)?.[1] ?? null,
  };
}

// ---- The ✈ dial (spec §18.1) ----

export interface AirDialModel {
  /** My superiority over my capital's zone, 0..1. */
  progress: number;
  supPm: number;
  /** My front zones (land zones of my border regions) under 50%. */
  low: number;
}

export function airDial(ctx: AirCtx): AirDialModel {
  const sc = ctx.scenario;
  const capital = sc.regionAt(sc.capitalTile(ctx.tag));
  const capSr = sc.regionSr(capital);
  const supPm = capSr === 0 ? 0 : ctx.air.mySuperiority(capSr);
  const front = new Set<number>();
  if (ctx.land !== null) {
    for (const r of borderRegions(ctx.land, ctx.me, ctx.sides)) {
      const sr = sc.regionSr(r);
      if (sr !== 0) front.add(sr);
    }
  }
  let low = 0;
  for (const sr of front) if (ctx.air.mySuperiority(sr) < 500) low++;
  return { progress: supPm / 1000, supPm, low };
}

// ---- The air drawer (spec §18.7) ----

export interface PlaneStockRow {
  type: AirType;
  stock: number;
  deployed: number;
  decks: number;
  /** The reserve per generation (P1 stock). */
  gens: number[];
}

/** Tab 2: every type with any plane, reserve per generation. */
export function planeStockRows(ctx: AirCtx): PlaneStockRow[] {
  const d = ctx.air.detail?.smallID === ctx.me ? ctx.air.detail : null;
  const stock = ctx.economy.detail(ctx.me)?.stock ?? [];
  return AIR_TYPES.map((type, i) => ({
    type,
    stock: d?.stock[i] ?? 0,
    deployed: d?.deployed[i] ?? 0,
    decks: d?.decks[i] ?? 0,
    gens: Array.from(
      { length: EQUIPMENT_GENS[type] },
      (_, g) => stock[equipKey(type, g + 1)] ?? 0,
    ),
  })).filter((r) => r.stock + r.deployed + r.decks > 0);
}

export interface AirRecord {
  kills: number;
  lost: number;
  dealt: number;
  taken: number;
  ships: number;
  convoys: number;
}

/** Tab 4: the last 30 days (CountryAirDetail.tally30). */
export function airRecord(ctx: AirCtx): AirRecord | null {
  const d = ctx.air.detail;
  if (d === null || d.smallID !== ctx.me) return null;
  const t = d.tally30;
  return {
    kills: t[0] ?? 0,
    lost: t[1] ?? 0,
    dealt: t[2] ?? 0,
    taken: t[3] ?? 0,
    ships: t[4] ?? 0,
    convoys: t[5] ?? 0,
  };
}

/** Plan Task 1's handle: the air screens' context over its game. */
export class AirModel {
  constructor(
    readonly navy: WwNavyView,
    readonly air: WwAirView,
    readonly game: GameView | NavyGame,
  ) {}

  ctx(): AirCtx | null {
    return navyCtx(this.game as NavyGame);
  }
}
