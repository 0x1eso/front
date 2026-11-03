// World War 1936 ww8 (lane G, design §3.3, §3.4, §8): what the wing card,
// the air drawer and the map taps compute from the views, as plain data.
// Every judgement is engine-lib's wingOrderBlock (one function for the card
// and the engine), bombClassHits, legTicks and WING_CYCLE.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSION_TYPES,
  AIR_TYPES,
  AirMission,
  AirRaidReport,
  AirType,
  WING_MAX_PER_ORDER,
  WING_PHASES,
  WING_RTB_PCT,
  WingDetail,
  WP_FERRY,
  WP_GROUND,
  WP_REARM,
  WW_BOMB_CLASSES,
  WW_WING_MAX_PLANES,
  WwBombClass,
} from "@openfront/engine-api/ww1936/AirTypes";
import type {
  BuildingId,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  HUB_BUILT,
  HUB_CAPITAL,
  HUB_CITY,
  HUB_CITY_VP,
  hubCapacityMilli,
} from "@openfront/engine-lib/ww1936/SupplyRules";
import {
  bombClassHits,
  legTicks,
  RaidEffectLine,
  raidEffectLines,
  RaidEffectNow,
  WING_CYCLE,
  WingBaseAsk,
  WingMissionAsk,
  wingOrderBlock,
} from "@openfront/engine-lib/ww1936/WingRules";
import { translateText } from "../../Utils";
import { fogOfAir } from "./FogModel";
import { armyName, regionName } from "./LandModel";
import { airBpOf, landSeaAirOf } from "./LandSeaAir";
import { NavyCtx, srName, zoneName } from "./NavyModel";
import { WingGroup, WingUi } from "./WingUi";

const OIL = RESOURCE_IDS.indexOf("oil");

export const airTypeOf = (w: { type: number }): AirType => AIR_TYPES[w.type];

/** The mission groups of the card, in order (design §3.4). */
export const WING_GROUPS: readonly WingGroup[] = [
  "air",
  "ground",
  "bomb",
  "sea",
  "lift",
];

export const GROUP_ICONS: Readonly<Record<WingGroup, string>> = {
  air: "🛡",
  ground: "💥",
  bomb: "🏭",
  sea: "⚓",
  lift: "📦",
};

/** A chip: a mission, and for strategic bombing the target class. */
export interface WingChip {
  id: string;
  mission: AirMission;
  cls: number;
  key: string;
}

const GROUP_MISSIONS: Readonly<Record<WingGroup, readonly AirMission[]>> = {
  air: ["air_superiority", "interception", "escort", "recon"],
  ground: ["cas"],
  bomb: ["strategic_bombing", "port_strike"],
  sea: ["naval_strike", "naval_patrol"],
  lift: ["air_supply"],
};

/** The bomb classes with a chip of their own (the port is the port strike's). */
export const BOMB_CHIP_CLASSES: readonly WwBombClass[] = [
  "auto",
  "factories",
  "rail",
  "fuel",
  "city",
  "airfield",
];

/** The chips a group offers the chosen wings: only what some chosen type can fly. */
export function groupChips(
  group: WingGroup,
  wings: readonly WingDetail[],
): WingChip[] {
  const types = new Set(wings.map(airTypeOf));
  const out: WingChip[] = [];
  for (const m of GROUP_MISSIONS[group]) {
    if (!AIR_MISSION_TYPES[m].some((t) => types.has(t))) continue;
    if (m === "strategic_bombing") {
      for (const c of BOMB_CHIP_CLASSES) {
        out.push({
          id: `${m}:${c}`,
          mission: m,
          cls: WW_BOMB_CLASSES.indexOf(c),
          key: `ww1936.bomb.class_${c}`,
        });
      }
    } else {
      out.push({ id: m, mission: m, cls: 0, key: chipKey(group, m) });
    }
  }
  return out;
}

function chipKey(group: WingGroup, m: AirMission): string {
  if (group === "bomb" && m === "port_strike") return "ww1936.bomb.class_port";
  return `ww1936.wing.chip_${m}`;
}

/** The groups with at least one chip for the chosen wings. */
export function groupsFor(wings: readonly WingDetail[]): WingGroup[] {
  return WING_GROUPS.filter((g) => groupChips(g, wings).length > 0);
}

// ---- Wings ----

export function myWings(ctx: NavyCtx): WingDetail[] {
  return [...ctx.air.wings.values()]
    .filter((w) => w.owner === ctx.me)
    .sort((a, b) => a.id - b.id);
}

export function chosenWings(ctx: NavyCtx, ui: WingUi): WingDetail[] {
  const out: WingDetail[] = [];
  for (const id of ui.ids) {
    const w = ctx.air.wings.get(id);
    if (w !== undefined && w.owner === ctx.me) out.push(w);
  }
  return out;
}

export const wingPlanes = (w: WingDetail): number => w.planes;
export const wingMax = (w: WingDetail): number =>
  WW_WING_MAX_PLANES[airTypeOf(w)];

export function wingName(w: Pick<WingDetail, "type" | "nameNo">): string {
  return translateText("ww1936.wing.name", {
    no: w.nameNo,
    type: translateText(`ww1936.equip.${AIR_TYPES[w.type]}`),
  });
}

export function baseName(ctx: NavyCtx, base: number): string {
  if (base < 0) return translateText("ww1936.wing.on_carrier");
  return base === 0 ? "—" : regionName(ctx.scenario, base);
}

/** A target's name: a region, or a sea zone. */
export function targetName(ctx: NavyCtx, target: number): string {
  if (target === 0) return "—";
  return target > SEA_ZONE_BASE
    ? zoneName(ctx.scenario, target)
    : regionName(ctx.scenario, target);
}

/** The wing's standing order as a line: "Strike → Sedan", or idle. */
export function orderLine(ctx: NavyCtx, w: WingDetail): string {
  if (w.mission < 0) return translateText("ww1936.wing.idle");
  const m = missionOf(w.mission);
  const what =
    w.follow !== 0
      ? translateText("ww1936.wing.follow", { army: armyName(w.follow) })
      : w.escortOf !== 0
        ? translateText("ww1936.wing.escorting", {
            wing: ctx.air.wings.get(w.escortOf)?.nameNo ?? w.escortOf,
          })
        : targetName(ctx, w.target);
  const cls =
    m === "strategic_bombing" && w.cls > 0
      ? ` (${translateText(`ww1936.bomb.class_${WW_BOMB_CLASSES[w.cls]}`)})`
      : "";
  return translateText("ww1936.wing.order_line", {
    mission: translateText(`ww1936.air_mission.${m}`),
    target: what + cls,
  });
}

import { AIR_MISSIONS } from "@openfront/engine-api/ww1936/AirTypes";
export const missionOf = (i: number): AirMission => AIR_MISSIONS[i];

/** The state line's key for a phase (WING_PHASES order). */
export const stateKeyOf = (phase: number, planes: number): string =>
  planes <= 0
    ? "ww1936.wing.state_empty"
    : `ww1936.wing.state_${WING_PHASES[phase]}`;

/** The planes ‰ of full strength (below WING_RTB_PCT the wing skips its sortie). */
export const strengthPm = (w: WingDetail): number =>
  Math.floor((w.planes * 1000) / Math.max(1, wingMax(w)));
export const underRtb = (w: WingDetail): boolean =>
  strengthPm(w) < WING_RTB_PCT * 10;

/** The sortie efficiency ‰ of the flying sortie: flyMilli ÷ planes. */
export function efficiencyPm(w: WingDetail): number {
  return w.planes <= 0 || w.flyMilli <= 0
    ? 0
    : Math.min(1000, Math.floor(w.flyMilli / w.planes));
}

// ---- Asking wingOrderBlock ----

/** An order being judged: the standing order's fields. */
export interface OrderDraft {
  mission: AirMission;
  target: number;
  army: number;
  escort: number;
  cls: number;
  standDown?: boolean;
}

function regionSide(ctx: NavyCtx, region: number) {
  const c = ctx.economy.controller[region] ?? 0;
  return {
    own: c > 0 && ctx.sides.sameSide(ctx.me, c),
    enemy: c > 0 && ctx.sides.isEnemy(ctx.me, c),
  };
}

function hasOil(ctx: NavyCtx, region: number): boolean {
  return OIL >= 0 && (ctx.scenario.region(region)?.res[OIL] ?? 0) > 0;
}

/** The target a draft aims at: a followed army is its region, an escorted wing its target. */
function aimOf(ctx: NavyCtx, d: OrderDraft): number {
  if (d.army !== 0) return ctx.land?.armies.get(d.army)?.region ?? 0;
  if (d.escort !== 0) return ctx.air.wings.get(d.escort)?.target ?? 0;
  return d.target;
}

export function missionAsk(
  ctx: NavyCtx,
  w: WingDetail,
  d: OrderDraft,
): WingMissionAsk {
  const aim = aimOf(ctx, d);
  const sea = aim > SEA_ZONE_BASE;
  const land = aim > 0 && !sea;
  const side = land ? regionSide(ctx, aim) : { own: false, enemy: false };
  const escortW = d.escort === 0 ? undefined : ctx.air.wings.get(d.escort);
  const bombing = (m: number) =>
    m >= 0 &&
    (missionOf(m) === "strategic_bombing" || missionOf(m) === "port_strike");
  const army = d.army === 0 ? undefined : ctx.land?.armies.get(d.army);
  const cls =
    d.mission === "port_strike"
      ? "port"
      : (WW_BOMB_CLASSES[d.cls] ?? ("auto" as WwBombClass));
  return {
    order: "mission",
    type: airTypeOf(w),
    mission: d.mission,
    carrier: w.base < 0,
    hasBase: w.base > 0,
    standDown: d.standDown === true,
    targetKind: sea ? "sea" : land ? "land" : "none",
    ownLand: side.own,
    enemyLand: side.enemy,
    armyOk: army !== undefined && army.owner === ctx.me,
    armyNamed: d.army !== 0,
    escortOk:
      escortW !== undefined &&
      escortW.owner === ctx.me &&
      bombing(escortW.mission),
    escortNamed: d.escort !== 0,
    bombable: land
      ? bombClassHits(
          cls,
          (b) => ctx.economy.effectiveBuildings(b, aim),
          hasOil(ctx, aim),
        )
      : false,
    km: w.base > 0 && aim !== 0 ? ctx.scenario.targetKm(w.base, aim) : 0,
    rangeKm: w.rangeKm,
  };
}

export function missionBlock(
  ctx: NavyCtx,
  w: WingDetail,
  d: OrderDraft,
): WwOrderBlock | null {
  return wingOrderBlock(missionAsk(ctx, w, d));
}

/**
 * The order for the chosen wings: only those the judge lets through (one
 * wing's refusal must not refuse the others). Null with none; `blocked`
 * says why when every wing was refused.
 */
export function missionOrder(
  ctx: NavyCtx,
  wings: readonly WingDetail[],
  d: OrderDraft,
): { order: WwOrder | null; blocked: WwOrderBlock | null } {
  const ok: number[] = [];
  let blocked: WwOrderBlock | null = null;
  for (const w of wings) {
    const b = missionBlock(ctx, w, d);
    if (b === null) ok.push(w.id);
    else blocked ??= b;
  }
  if (ok.length === 0) return { order: null, blocked };
  const order: WwOrder = {
    kind: "wing_mission",
    wings: ok.slice(0, WING_MAX_PER_ORDER),
    mission: d.mission,
    target:
      d.standDown === true || d.army !== 0 || d.escort !== 0 ? 0 : d.target,
    ...(d.army !== 0 ? { army: d.army } : {}),
    ...(d.escort !== 0 ? { escort: d.escort } : {}),
    ...(d.mission === "strategic_bombing"
      ? { cls: WW_BOMB_CLASSES[d.cls] }
      : {}),
  };
  return { order, blocked: null };
}

export function standDownOrder(wings: readonly WingDetail[]): WwOrder {
  return {
    kind: "wing_mission",
    wings: wings.map((w) => w.id).slice(0, WING_MAX_PER_ORDER),
    mission: "air_superiority",
    target: 0,
  };
}

// ---- Bases ----

export function baseAsk(
  ctx: NavyCtx,
  w: WingDetail,
  region: number,
): WingBaseAsk {
  const use = ctx.air.detail?.bases.find((b) => b.region === region);
  const side = regionSide(ctx, region);
  return {
    order: "base",
    carrier: w.base < 0,
    isBase: use !== undefined,
    ownSide: side.own,
    room: use === undefined ? 0 : use.cap - use.used,
    planes: w.base === region ? 0 : w.planes,
  };
}

export function baseBlock(
  ctx: NavyCtx,
  w: WingDetail,
  region: number,
): WwOrderBlock | null {
  return wingOrderBlock(baseAsk(ctx, w, region));
}

/** The bases a chosen wing set may ferry to: every base the side may use, minus its own. */
export function baseCandidates(
  ctx: NavyCtx,
  wings: readonly WingDetail[],
): number[] {
  const out: number[] = [];
  for (const b of ctx.air.detail?.bases ?? []) {
    if (
      wings.some(
        (w) => w.base !== b.region && baseBlock(ctx, w, b.region) === null,
      )
    ) {
      out.push(b.region);
    }
  }
  return out;
}

// ---- Targets ----

/** Land regions or sea strategic regions some chosen wing may aim at (the map's glow). */
export function targetCandidates(
  ctx: NavyCtx,
  wings: readonly WingDetail[],
  chip: { mission: AirMission; cls: number },
): { kind: "sea" | "land"; ids: number[] } {
  const sea =
    chip.mission === "naval_strike" || chip.mission === "naval_patrol";
  const base: OrderDraft = {
    mission: chip.mission,
    target: 0,
    army: 0,
    escort: 0,
    cls: chip.cls,
  };
  const pass = (target: number) =>
    wings.some((w) => missionBlock(ctx, w, { ...base, target }) === null);
  const ids: number[] = [];
  if (sea) {
    for (const s of ctx.scenario.strategicList()) {
      if (s.kind !== "sea") continue;
      if (s.members.some(pass)) ids.push(s.id);
    }
    return { kind: "sea", ids };
  }
  // Interception and air supply stay over our own land, the rest over any.
  for (const r of ctx.scenario.landRegions) if (pass(r.id)) ids.push(r.id);
  return { kind: "land", ids };
}

// ---- The card ----

export interface WingCardNumbers {
  planes: number;
  max: number;
  effPm: number;
  /** The round trip in days ×10, from the chosen target (null: no order). */
  roundDaysX10: number | null;
  sortiesPerDayX10: number | null;
  tier: number;
}

/** Days ×10 of a cycle in ticks (a day is 7.5 ticks). */
const toDaysX10 = (ticks: number) => Math.floor((ticks * 100) / 75);

export function cardNumbers(ctx: NavyCtx, w: WingDetail): WingCardNumbers {
  let cycle: number | null = null;
  if (w.mission >= 0 && w.base > 0) {
    const aim =
      w.follow !== 0
        ? (ctx.land?.armies.get(w.follow)?.region ?? 0)
        : w.escortOf !== 0
          ? (ctx.air.wings.get(w.escortOf)?.target ?? 0)
          : w.target;
    if (aim !== 0) {
      const leg = legTicks(ctx.scenario.targetKm(w.base, aim), w.speedKmh);
      const c = WING_CYCLE[missionOf(w.mission)];
      cycle = 2 * leg + c.station + c.rearm;
    }
  }
  return {
    planes: w.planes,
    max: wingMax(w),
    effPm: efficiencyPm(w),
    roundDaysX10: cycle === null ? null : toDaysX10(cycle),
    sortiesPerDayX10: cycle === null ? null : Math.floor(750 / cycle),
    tier: xpTierOf(w.xpMilli),
  };
}

import { xpTier } from "@openfront/engine-lib/ww1936/WingRules";
export const xpTierOf = xpTier;

export const fmtTenths = (x10: number): string =>
  `${Math.floor(x10 / 10)}.${x10 % 10}`;

// ---- The army card and the battle card ----

/** The wings giving close support to an army now (their standing order follows it). */
export function wingsFollowing(ctx: NavyCtx, army: number): number {
  let n = 0;
  for (const w of ctx.air.wings.values()) {
    if (w.owner === ctx.me && w.follow === army) n++;
  }
  return n;
}

export function armyPriority(ctx: NavyCtx, army: number): boolean {
  return (ctx.air.detail?.priorityArmies ?? []).includes(army);
}

// ---- Raid reports ----

export interface ReportRow {
  report: AirRaidReport;
  /** I was hit (true) or I raided (false). */
  hit: boolean;
  lines: RaidEffectLine[];
}

/** My reports, newest first. */
export function reportRows(ctx: NavyCtx): ReportRow[] {
  const rows = [...(ctx.air.detail?.reports ?? [])];
  rows.sort((a, b) => b.day - a.day);
  return rows.map((r) => ({
    report: r,
    hit: r.victim === ctx.me,
    lines: raidEffectLines(r, raidNowOf(ctx, r)),
  }));
}

/** The buildings a raid's "factories stopped" line counts (the engine's Bombing.FACTORIES). */
const RAID_FACTORIES: readonly BuildingId[] = [
  "civ",
  "mil",
  "dock",
  "synthetic_refinery",
  "alloy_plant",
  "smelter",
];

/**
 * What a report's card reads of the target now. The victim sees all of it
 * (design §5.2). The raider sees it when the fog shows the region's buildings
 * exactly; otherwise it keeps the raid's own numbers and these stay absent.
 */
export function raidNowOf(ctx: NavyCtx, r: AirRaidReport): RaidEffectNow {
  const e = ctx.economy;
  const at = r.region;
  if (e.scenario.region(at) === undefined) return {};
  if (r.victim !== ctx.me) {
    const seen = fogOfAir(ctx.air)?.regionView(at).buildings ?? "exact";
    if (seen !== "exact") return {};
  }
  let factoriesStopped = 0;
  for (const b of RAID_FACTORIES) {
    factoriesStopped += e.buildingCount(b, at) - e.effectiveBuildings(b, at);
  }
  const now: RaidEffectNow = { factoriesStopped };
  const rail = e.buildingCount("rail", at);
  if (rail > 0) {
    const eff = e.effectiveBuildings("rail", at);
    now.railLevel = rail;
    now.railEffLevel = eff;
    // Movement.stepOf: the railway into a region runs at this share.
    now.railMovePct = Math.floor((eff * 100) / rail);
    // The hub there, as Supply.ts sizes it: a capital's, a big city's or a built one.
    const sc = e.scenario;
    const tag = sc.countries[(ctx.land?.controller[at] ?? 0) - 1];
    const tile = tag === undefined ? null : sc.capitalTileOrNull(tag);
    const kind =
      tile !== null && sc.regionAt(tile) === at
        ? HUB_CAPITAL
        : (sc.region(at)?.vp ?? 0) >= HUB_CITY_VP
          ? HUB_CITY
          : HUB_BUILT;
    if (kind !== HUB_BUILT || e.buildingCount("supply_hub", at) > 0) {
      const whole = hubCapacityMilli(kind, rail);
      const working =
        kind !== HUB_BUILT || e.effectiveBuildings("supply_hub", at) > 0;
      now.hubCapacityPct = working
        ? Math.floor((hubCapacityMilli(kind, eff) * 100) / whole)
        : 0;
    }
  }
  return now;
}

export const reportPlace = (ctx: NavyCtx, r: AirRaidReport): string =>
  regionName(ctx.scenario, r.region) || srName(ctx.scenario, r.region);

export const idleOrStale = (w: WingDetail): boolean =>
  w.mission < 0 || w.phase === WP_GROUND;

// ---- The wing's phase now, from its latest schedule row ----

export interface PhaseNow {
  phase: number;
  /** Ticks left in it (0 on the ground). */
  left: number;
}

/**
 * The phase a wing is in at `ticks`: a brief only holds the phase it was
 * sent in, so the screen walks the schedule row (out → station → back →
 * rearm) as the render lane does.
 */
export function phaseNow(
  air: { flights: ReadonlyMap<number, readonly number[]> },
  w: Pick<WingDetail, "id" | "phase" | "until">,
  ticks: number,
): PhaseNow {
  const row = air.flights.get(w.id);
  if (row === undefined) {
    return { phase: w.phase, left: Math.max(0, w.until - ticks) };
  }
  const [, phase, until, leg, station, rearm] = row;
  if (phase === WP_FERRY || phase === WP_GROUND) {
    return ticks < until
      ? { phase, left: until - ticks }
      : { phase: WP_GROUND, left: 0 };
  }
  // phase is OUT here: until is the end of the way out.
  const stationEnd = until + station;
  const backEnd = stationEnd + leg;
  const rearmEnd = backEnd + rearm;
  if (ticks < until) return { phase: 1, left: until - ticks };
  if (ticks < stationEnd) return { phase: 2, left: stationEnd - ticks };
  if (ticks < backEnd) return { phase: 3, left: backEnd - ticks };
  if (ticks < rearmEnd) return { phase: WP_REARM, left: rearmEnd - ticks };
  return { phase: WP_GROUND, left: 0 };
}

/** A wing in the air: its new order applies from the next sortie. */
export const inAir = (p: PhaseNow): boolean => p.phase >= 1 && p.phase <= 3;

// ---- The air drawer's live tabs ----

export interface LiveBase {
  region: number;
  name: string;
  used: number;
  cap: number;
  damagePm: number;
  strip: boolean;
  /** Ticks left before a field strip is ready (0: ready or not a strip). */
  readyIn: number;
  wings: number;
}

/** Every base my side may use (the wing model's CountryAirDetail.bases), with the wings on it. */
export function liveBases(ctx: NavyCtx, ticks: number): LiveBase[] {
  const d = ctx.air.detail?.smallID === ctx.me ? ctx.air.detail : null;
  if (d === null) return [];
  const ready = new Map(d.strips ?? []);
  const onBase = new Map<number, number>();
  for (const w of ctx.air.wings.values()) {
    if (w.owner === ctx.me) onBase.set(w.base, (onBase.get(w.base) ?? 0) + 1);
  }
  return d.bases
    .map((b) => ({
      region: b.region,
      name: regionName(ctx.scenario, b.region),
      used: b.used,
      cap: b.cap,
      damagePm: b.damagePm,
      strip: b.strip === true,
      readyIn: Math.max(0, (ready.get(b.region) ?? 0) - ticks),
      wings: onBase.get(b.region) ?? 0,
    }))
    .sort((a, b) => a.region - b.region);
}

/** Strips still being laid (not yet in `bases`): [region, ticks left]. */
export function stripsBuilding(
  ctx: NavyCtx,
  ticks: number,
): [number, number][] {
  const d = ctx.air.detail;
  if (d === null || d.smallID !== ctx.me) return [];
  const have = new Set(d.bases.map((b) => b.region));
  return (d.strips ?? [])
    .filter(([r, t]) => t > ticks && !have.has(r))
    .map(([r, t]): [number, number] => [r, t - ticks]);
}

/** [auto] counts: wings on auto of all. */
export function autoCounts(ctx: NavyCtx): { on: number; all: number } {
  let on = 0;
  let all = 0;
  for (const w of ctx.air.wings.values()) {
    if (w.owner !== ctx.me) continue;
    all++;
    if (w.auto) on++;
  }
  return { on, all };
}

/**
 * The battle card's air line: the enemy's superiority over the battle
 * and what it costs my side there, in percent. Null when they hold none.
 */
export function battleAirLine(
  ctx: NavyCtx,
  region: number,
): { supPm: number; penaltyPct: number } | null {
  const sr = ctx.scenario.regionSr(region);
  if (sr === 0 || ctx.land === null) return null;
  const side = ctx.p4.sideOf(ctx.me);
  const e = ctx.air.zones.get(sr)?.enemySky?.find((x) => x.side === side);
  if (e === undefined || e.enemySupPm <= 500) return null;
  const bp = airBpOf(landSeaAirOf(ctx.land), ctx.scenario, region, ctx.me, 0);
  return { supPm: e.enemySupPm, penaltyPct: Math.abs(Math.floor(bp / 100)) };
}

/**
 * The wing notices' params in the viewer's words: `wing` is a wing id (its
 * name from my wings), `type` an AIR_TYPES index or id.
 */
export function wingNoticeParams(
  message: string,
  params: Record<string, string | number>,
  wings: ReadonlyMap<number, WingDetail> | null,
): Record<string, string | number> {
  if (!message.startsWith("events_display.ww1936_wing_")) return params;
  const out = { ...params };
  if (typeof params.wing === "number") {
    const w = wings?.get(params.wing);
    out.wing =
      w === undefined ? translateText("ww1936.wing.unknown") : wingName(w);
  }
  const t = params.type;
  const id = typeof t === "number" ? AIR_TYPES[t] : t;
  if (typeof id === "string" && (AIR_TYPES as readonly string[]).includes(id)) {
    out.type = translateText(`ww1936.equip.${id}`);
  }
  return out;
}
