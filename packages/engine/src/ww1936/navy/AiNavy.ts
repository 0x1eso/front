// World War 1936 P4: the navy AI (P4 spec §17.1, §17.2, §17.6). The day
// of an AI country's fleets: new ships into role fleets, then (at war)
// carrier port strikes, invasion support, home defence, trade protection,
// commerce raiding and the carriers in the order the country's style puts
// them; at peace the fleets wait at home and one patrol trains.
// aiNavalPlan is a pure function of plain data (tested without a game);
// aiNavy gathers that data from what a player's screens show (fleet
// positions, the side's spotting and supremacy, the convoy routes; never
// another country's missions) and gives the orders through navy.issue, a
// player's path. No randomness: a per-game jitter (the seed's wwRoll, ±5%)
// only reorders close calls, so two games differ without a scripted date.
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ENGAGE_RULES,
  EngageRule,
  FLEET_MISSIONS,
  FLEET_STATES,
  FleetMission,
  FleetState,
  NavalCtx,
  NavalSideSum,
  SHIP_CLASSES,
  ShipStats,
  WW_INVASION_MAX_KM,
  WW_MAX_FLEET_SHIPS,
  WW_MAX_FLEETS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { invasionCapacity } from "@openfront/engine-lib/ww1936/InvasionRules";
import {
  NAVAL_BEATS,
  NavalBeatDef,
} from "@openfront/engine-lib/ww1936/NavalBeats";
import {
  fleetPower,
  fleetSupPowerMilli,
  predictNaval,
} from "@openfront/engine-lib/ww1936/NavalRules";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import { idHash, P_NAVALBEAT, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import { GEN_HP_PCT } from "@openfront/engine-lib/ww1936/ShipStats";
import { convoysOf, effectiveLevel } from "../economy/Buildings";
import { navalPort, navalPortsOf } from "./Ports";
import type { Fleet, WwNavy } from "./WwNavy";

// ---- Constants (spec §17.2; the (내 판단) ones are marked) ----

/** Spec §17.2-5: a battle fleet sorties at a predicted ratio of 0.9 or better. */
export const AI_MAIN_ENGAGE_PM = 900;
/** Spec §17.2-3 ①: the supremacy an invasion route's support aims at. */
export const AI_INVASION_SUP_PM = 600;
/**
 * Spec §17.2-5: return thresholds, 50%; the battle fleet's 60% is no
 * order value (0/30/50/70), so 70 (내 판단: capital ships come home early).
 */
export const AI_RETURN_PCT = 50;
export const AI_MAIN_RETURN_PCT = 70;
/** Spec §17.2-1: role fleets' sizes. */
export const AI_PATROL_MIN = 4;
export const AI_PATROL_MAX = 6;
export const AI_SUB_MIN = 6;
export const AI_SUB_MAX = 10;
export const AI_ESCORT_MIN = 6;
export const AI_ESCORT_MAX = 8;
/** Spec §9.3: screens to capital ships and carriers. */
export const AI_SCREEN_RATIO = 3;
/** Spec §17.2-7: a carrier port strike wants this many carriers and docked capital ships. */
export const AI_STRIKE_CARRIERS = 3;
export const AI_STRIKE_CAPITALS = 4;
/** Spec §17.6: a history beat multiplies its target's score by this. */
export const AI_BEAT_FACTOR = 10;
/** The navy AI's jitter purpose (per game, country and region). */
const P_AI_NAVY = idHash("ai_navy");

// ---- The pure plan's data ----

export type AiFleetRole = "main" | "patrol" | "sub" | "escort" | "mixed";

/** One of the country's fleets, as the plan reads it. */
export interface AiFleetView {
  id: number;
  /** Ship counts, SHIP_CLASSES order. */
  counts: readonly number[];
  /** Supremacy power at a full mission (fleetSupPowerMilli at 1000‰). */
  supPower: number;
  /** The battle sums predictNaval reads. */
  sum: NavalSideSum;
  home: number;
  /** Port region; 0 at sea. */
  docked: number;
  /** The sea region it is in now. */
  sr: number;
  state: FleetState;
  mission: FleetMission;
  missionSr: number;
  engage: EngageRule;
  returnAtPct: number;
  newShips: boolean;
  rangeKm: number;
  /** Sea km from its home harbor to each sea region (missing: no route); absent: the region's km. */
  km?: ReadonlyMap<number, number>;
}

/** One sea strategic region, as the plan reads it (spec §17.2-2). */
export interface AiSeaRegionView {
  sr: number;
  /** Sea km from the country's main base to the region; -1: no route. */
  km: number;
  /** A harbor zone of our core ports lies in it. */
  home: boolean;
  /** Our convoys routed through it (the routes' need). */
  traffic: number;
  /** Our convoy losses here (yesterday's sunk milli plus the loss rate ‰): any is a loss. */
  lossMilli: number;
  /** An enemy fleet that can raid (submarines, or no capital ship) is spotted here. */
  raiderSpotted: boolean;
  /** Enemy convoys routed through it. */
  enemyTraffic: number;
  /** fleetPower of the enemy's screen-only fleets here (their escorts). */
  enemyEscort: number;
  /** The enemy's supremacy power here (docked fleets at half). */
  enemySup: number;
  /** Every enemy ship here as one side; null when none. */
  enemySum: NavalSideSum | null;
  /** An enemy fleet here is spotted by our side. */
  enemySpotted: boolean;
  /** On the route of one of our invasions. */
  invasion: boolean;
}

/** An enemy port a carrier strike may hit (never a no-strike region). */
export interface AiPortView {
  port: number;
  sr: number;
  /** Enemy capital ships docked there. */
  capitals: number;
  /** A port-strike history beat's window covers it. */
  beat: boolean;
}

/** Spec §17.2-4: the order of ③–⑥ after invasion support, and the leanings. */
export interface AiNavyStyle {
  order: readonly ("home" | "trade" | "raid" | "carrier")[];
  /** Escorts also cover the busiest trade regions without losses (Britain). */
  tradeAlways: boolean;
  /** Patrols raid too once the submarines are out (a commerce-war navy). */
  surfaceRaid: boolean;
  /** Missions only in home regions (Italy: its own seas). */
  homeOnly: boolean;
}

export interface AiNavalInput {
  smallID: number;
  day: number;
  atWar: boolean;
  /** The country's fleets, by id (a human's auto ones only). */
  fleets: readonly AiFleetView[];
  /** Fleets the country has in all (WW_MAX_FLEETS caps the splits). */
  fleetCount: number;
  /** Every sea strategic region, srIdx order. */
  regions: readonly AiSeaRegionView[];
  ports: readonly AiPortView[];
  style: AiNavyStyle;
  /** The game's roll seed: ±5% jitter on the scores; 0 none. */
  seed: number;
}
/** An order the AI gives through navy.issue (the same as a player's). */
export type AiNavalOrder = WwOrder;

const STYLE_DEFAULT: AiNavyStyle = {
  order: ["home", "trade", "raid", "carrier"],
  tradeAlways: false,
  surfaceRaid: false,
  homeOnly: false,
};

/**
 * Spec §17.2-4 (내 판단): Britain trade protection first, Germany commerce
 * raiding first, Japan its carriers and the decisive battle, the United
 * States even, Italy its own seas, the Soviet Union home patrols and
 * submarines, France home and trade.
 */
export const AI_NAVY_STYLES: Readonly<
  Partial<Record<CountryTag, AiNavyStyle>>
> = {
  GBR: {
    ...STYLE_DEFAULT,
    order: ["trade", "home", "carrier", "raid"],
    tradeAlways: true,
  },
  DEU: {
    ...STYLE_DEFAULT,
    order: ["raid", "home", "trade", "carrier"],
    surfaceRaid: true,
  },
  JPN: { ...STYLE_DEFAULT, order: ["carrier", "home", "raid", "trade"] },
  USA: { ...STYLE_DEFAULT, order: ["home", "trade", "carrier", "raid"] },
  ITA: {
    ...STYLE_DEFAULT,
    order: ["home", "raid", "trade", "carrier"],
    homeOnly: true,
  },
  SUN: { ...STYLE_DEFAULT, order: ["home", "raid", "trade", "carrier"] },
  FRA: { ...STYLE_DEFAULT, order: ["home", "trade", "raid", "carrier"] },
};

export function aiNavyStyle(tag: CountryTag): AiNavyStyle {
  return AI_NAVY_STYLES[tag] ?? STYLE_DEFAULT;
}

// ---- Shared helpers (AiInvasion and AiLand use them too) ----

const CLS = (c: (typeof SHIP_CLASSES)[number]) => SHIP_CLASSES.indexOf(c);
const DD = CLS("dd");
const CL = CLS("cl");
const CA = CLS("ca");
const BC = CLS("bc");
const BB = CLS("bb");
const CV = CLS("cv");
const SS = CLS("ss");

/** Cruisers, battlecruisers and battleships. */
export const capitalsOf = (c: readonly number[]): number =>
  c[CA] + c[BC] + c[BB];
const sumOf = (c: readonly number[]) => c.reduce((a, b) => a + b, 0);

/** Spec §17.2-1: a fleet's role from what it is made of. */
export function fleetRole(counts: readonly number[]): AiFleetRole {
  const screens = counts[DD] + counts[CL];
  if (capitalsOf(counts) + counts[CV] > 0) return "main";
  if (counts[SS] > 0) return screens === 0 ? "sub" : "mixed";
  if (screens === 0) return "mixed";
  if (counts[CL] > 0 || counts[DD] < AI_ESCORT_MIN) return "patrol";
  return "escort";
}

/**
 * Spec §17.2-1: new ships into role fleets. A battle group takes the
 * carriers with as many capital ships (1:1; without carriers every
 * capital ship) and screens at 3:1, destroyers first; then submarine
 * flotillas of 6–10, patrols of 4–6 (light cruisers first) and destroyer
 * escorts of 6–8. What makes no group is the rest.
 */
export function aiOrganise(counts: readonly number[]): {
  groups: number[][];
  rest: number[];
} {
  const c = [...counts];
  const groups: number[][] = [];
  const take = (g: number[], i: number, n: number) => {
    const k = Math.max(0, Math.min(n, c[i]));
    g[i] += k;
    c[i] -= k;
    return k;
  };
  const zero = () => new Array<number>(SHIP_CLASSES.length).fill(0);
  // At most 15 big ships a group: with their screens a fleet stays within 60.
  const room = Math.floor(WW_MAX_FLEET_SHIPS / (AI_SCREEN_RATIO + 1));
  while (capitalsOf(c) + c[CV] > 0) {
    const g = zero();
    const cv = take(g, CV, room);
    let caps = cv > 0 ? Math.min(cv, room - cv) : room;
    for (const i of [BB, BC, CA]) caps -= take(g, i, caps);
    let screens = AI_SCREEN_RATIO * (capitalsOf(g) + g[CV]);
    screens -= take(g, DD, screens);
    take(g, CL, screens);
    groups.push(g);
  }
  while (c[SS] >= AI_SUB_MIN) {
    const g = zero();
    // 14 boats make 7 + 7, not 10 + 4.
    const n =
      c[SS] > AI_SUB_MAX && c[SS] < AI_SUB_MAX + AI_SUB_MIN
        ? Math.ceil(c[SS] / 2)
        : AI_SUB_MAX;
    take(g, SS, n);
    groups.push(g);
  }
  while (c[CL] > 0 && c[CL] + c[DD] >= AI_PATROL_MIN) {
    const g = zero();
    const k = take(g, CL, 2);
    take(g, DD, AI_PATROL_MAX - k);
    if (sumOf(g) < AI_PATROL_MIN) take(g, CL, AI_PATROL_MIN - sumOf(g));
    groups.push(g);
  }
  while (c[DD] >= AI_ESCORT_MIN) {
    const g = zero();
    // 10 destroyers make an escort of 6 and a patrol of 4.
    const n =
      c[DD] > AI_ESCORT_MAX && c[DD] < AI_ESCORT_MAX + AI_PATROL_MIN
        ? c[DD] - AI_PATROL_MIN
        : AI_ESCORT_MAX;
    take(g, DD, n);
    groups.push(g);
  }
  if (c[DD] >= AI_PATROL_MIN) {
    const g = zero();
    take(g, DD, AI_PATROL_MAX);
    groups.push(g);
  }
  return { groups, rest: c };
}

/** A ship as the battle sums read it. */
export interface AiShipRow {
  /** SHIP_CLASSES index. */
  cls: number;
  gen: number;
  stats: ShipStats;
  hpMilli: number;
  orgMilli: number;
}

/** Spec §9.9: one side's sums for predictNaval (carrier attack: deck × 60, as fleetPower counts it). */
export function navalSideSum(ships: readonly AiShipRow[]): NavalSideSum {
  const s: NavalSideSum = {
    count: new Array<number>(SHIP_CLASSES.length).fill(0),
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
    s.count[x.cls]++;
    s.hpMilli += x.hpMilli;
    s.maxHpMilli += t.hpMilli;
    s.orgMilli += x.orgMilli;
    s.light += t.light;
    s.heavy += t.heavy;
    s.torpedo += t.torpedo;
    s.depth += t.depth;
    s.carrierAttack += t.deck * 60;
    armor += t.armor;
    lp += t.light * t.lightPierce;
    hp += t.heavy * t.heavyPierce;
    if (x.cls !== SS) s.vis = Math.max(s.vis, t.vis);
    min = Math.min(min, t.speedCentiKn);
    s.maxSpeed = Math.max(s.maxSpeed, t.speedCentiKn);
  }
  const n = ships.length;
  s.armor = n === 0 ? 0 : Math.floor(armor / n);
  s.lightPierce = s.light === 0 ? 0 : Math.floor(lp / s.light);
  s.heavyPierce = s.heavy === 0 ? 0 : Math.floor(hp / s.heavy);
  s.minSpeed = min === Infinity ? 0 : min;
  return s;
}

/** Spec §8.5: supremacy power at a full mission (1000‰) and full fuel. */
export function aiSupPower(ships: readonly AiShipRow[]): number {
  return fleetSupPowerMilli(
    ships.map((x) => ({
      supWeight: x.stats.supWeight,
      genHpPct: GEN_HP_PCT[Math.max(0, Math.min(3, x.gen - 1))],
      hpMilli: x.hpMilli,
      maxHpMilli: x.stats.hpMilli,
    })),
    1000,
    1000,
  );
}

/** A neutral battle context for the AI's previews (no admirals, no doctrine). */
const PREVIEW_CTX: NavalCtx = {
  attackerPosPct: 0,
  defenderPosPct: 0,
  attackerScreenBonusPm: 0,
  defenderScreenBonusPm: 0,
  attackerCarrierEvery: 3,
  defenderCarrierEvery: 3,
};

/** Spec §17.2-5: predictNaval's ratio of `mine` against `theirs` (4000: no enemy). */
export function aiPredictPm(
  mine: NavalSideSum,
  theirs: NavalSideSum | null,
): number {
  if (theirs === null || sumOf(theirs.count) === 0) return 4000;
  return predictNaval(mine, theirs, PREVIEW_CTX).ratioPm;
}

/**
 * Dijkstra over the naval zones from `from` (0 km each): km to every zone
 * it reaches (spec §3.3 edge costs).
 */
export function seaDistances(
  sc: ScenarioIndex,
  from: readonly number[],
  passable: (edge: number) => boolean,
): Map<number, number> {
  const zones = sc.navalZones();
  const n = zones.length;
  const at = new Map<number, number>();
  zones.forEach((z, i) => at.set(z, i));
  const dist = new Float64Array(n).fill(Infinity);
  const done = new Uint8Array(n);
  for (const z of from) {
    const i = at.get(z);
    if (i !== undefined) dist[i] = 0;
  }
  for (;;) {
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (done[i] === 0 && dist[i] !== Infinity) {
        if (best < 0 || dist[i] < dist[best]) best = i;
      }
    }
    if (best < 0) break;
    done[best] = 1;
    for (const { to, edge } of sc.seaEdgesOf(zones[best])) {
      const j = at.get(to);
      if (j === undefined || done[j] === 1 || !passable(edge)) continue;
      const d = dist[best] + sc.seaEdge(edge).km;
      if (d < dist[j]) dist[j] = d;
    }
  }
  const out = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    if (dist[i] !== Infinity) out.set(zones[i], dist[i]);
  }
  return out;
}

/** The nearest zone of a sea strategic region in `dist` (km), or -1. */
export function srKmIn(
  sc: ScenarioIndex,
  dist: ReadonlyMap<number, number>,
  sr: number,
): number {
  let best = -1;
  for (const z of sc.sr(sr)?.members ?? []) {
    const d = dist.get(z);
    if (d !== undefined && (best < 0 || d < best)) best = d;
  }
  return best;
}

/**
 * The AI's main naval base: its highest working level, then the smaller
 * id; never a no-strike region (no bases or fleets placed in Korea or
 * Taiwan). 0 when none.
 */
export function aiMainBase(ww: WwNavy["ww"], smallID: number): number {
  let best = 0;
  let bestLevel = 0;
  for (const r of navalPortsOf(ww, smallID)) {
    if (isNoStrike(ww.scenario, r)) continue;
    const lv = effectiveLevel(ww.economy, r, "naval_base");
    if (lv > bestLevel) {
      best = r;
      bestLevel = lv;
    }
  }
  return best;
}

/** Score jitter 950..1050‰ per (game, country, key); 1000 without a seed. */
export function aiJitterPm(seed: number, smallID: number, key: number): number {
  if (seed === 0) return 1000;
  return 950 + (wwRoll(seed, P_AI_NAVY, smallID, key) % 101);
}

// ---- History beats (spec §17.6, pre-flight A14) ----

/** A beat's roll: [idHash, delay 0–20 days, skipped one in ten] (WwNavy.rollBeats rolls the same). */
export function navalBeatRoll(
  seed: number,
  id: string,
): [number, number, boolean] {
  const h = idHash(id);
  return [
    h,
    wwRoll(seed, P_NAVALBEAT, h, 2) % 21,
    wwRoll(seed, P_NAVALBEAT, h, 1) % 10 === 0,
  ];
}

/**
 * Spec §17.6 (NavalBeats.ts header): the days a beat raises its target's
 * score, its date moved by the delay. A landing: from date − preparation
 * − 30 to date + 120; a campaign: from its date to its end (moved too); a
 * port strike or paradrop, one day (내 판단): 30 days either side.
 */
export function beatWindow(
  def: Pick<NavalBeatDef, "from" | "to" | "kind">,
  delay: number,
  prepDays: number,
): [number, number] {
  const at = dayOfDate(def.from) + delay;
  if (def.kind === "invade") return [at - prepDays - 30, at + 120];
  if (def.to !== undefined) return [at, dayOfDate(def.to) + delay];
  return [at - 30, at + 30];
}

/** Spec §17.6: ×10 inside the window, ×1 outside it. */
export function beatFactor(
  window: readonly [number, number],
  day: number,
): number {
  return day >= window[0] && day <= window[1] ? AI_BEAT_FACTOR : 1;
}

/**
 * The target regions of `smallID`'s live beats of one kind on `day`,
 * resolved by name: an AI country under historical AI only, never a
 * skipped beat, never a no-strike region. The conditions (a war, the
 * supremacy) stay the plan's: a beat only raises the score (spec §17.7).
 */
export function activeBeatTargets(
  navy: WwNavy,
  smallID: number,
  day: number,
  kind: NavalBeatDef["kind"],
  prepDays = 0,
): Set<number> {
  const out = new Set<number>();
  const mg = navy.mg;
  if (mg.config().historicalAi() !== true) return out;
  const p = mg.playerBySmallID(smallID);
  if (!p.isPlayer() || p.type() === PlayerType.Human) return out;
  const sc = navy.scenario;
  const tag = sc.tagOfSmallId(smallID);
  NAVAL_BEATS.forEach((def, i) => {
    if (def.tag !== tag || def.kind !== kind) return;
    const roll = navy.beats[i];
    if (roll === undefined || roll[2]) return;
    if (beatFactor(beatWindow(def, roll[1], prepDays), day) === 1) return;
    for (const name of def.targets) {
      const id = regionByName(sc, name);
      if (id !== 0 && !isNoStrike(sc, id)) out.add(id);
    }
  });
  return out;
}

const regionNames = new WeakMap<ScenarioIndex, Map<string, number>>();

/** A land region's id by its scenario name (0: none). */
export function regionByName(sc: ScenarioIndex, name: string): number {
  let m = regionNames.get(sc);
  if (m === undefined) {
    m = new Map();
    for (const r of sc.landRegions) if (!m.has(r.name)) m.set(r.name, r.id);
    regionNames.set(sc, m);
  }
  return m.get(name) ?? 0;
}

// ---- The plan (pure) ----

interface Want {
  mission: FleetMission;
  sr: number;
  engage: EngageRule | null;
  returnAt: number | null;
  /** Go home and wait there (a fleet in being). */
  home: boolean;
}

const HOLD: Want = {
  mission: "hold",
  sr: 0,
  engage: null,
  returnAt: null,
  home: true,
};

/** Pure: the fleet orders of the day (spec §17.2). */
export function aiNavalPlan(input: AiNavalInput): AiNavalOrder[] {
  const orders: AiNavalOrder[] = [];
  const fleets = [...input.fleets].sort((a, b) => a.id - b.id);
  const jit = (key: number) => aiJitterPm(input.seed, input.smallID, key);
  // ① New ships into role fleets.
  let fleetCount = input.fleetCount;
  const busy = new Set<number>();
  for (const f of fleets) {
    if (!f.newShips || f.docked === 0 || f.state === "battle") continue;
    const { groups, rest } = aiOrganise(f.counts);
    const restEmpty = sumOf(rest) === 0;
    if (groups.length === 0) {
      const into = mergeTarget(f, fleets);
      if (into !== null)
        orders.push({ kind: "fleet_merge", fleet: f.id, into });
      busy.add(f.id);
      continue;
    }
    // The last group stays the fleet itself when nothing is left over.
    const splits = restEmpty ? groups.slice(0, -1) : groups;
    for (const g of splits) {
      if (fleetCount >= WW_MAX_FLEETS) break;
      orders.push({
        kind: "fleet_split",
        fleet: f.id,
        counts: SHIP_CLASSES.flatMap((cls, i) =>
          g[i] > 0 ? [[cls, g[i]] as [typeof cls, number]] : [],
        ),
        ships: [],
      });
      fleetCount++;
    }
    // A fleet that split today, or keeps a rest, waits a day.
    if (splits.length > 0 || !restEmpty) busy.add(f.id);
  }

  const free = fleets.filter((f) => !busy.has(f.id) && f.state !== "battle");
  const wants = new Map<number, Want>();
  const regions = new Map(input.regions.map((r) => [r.sr, r]));
  const kmOf = (f: AiFleetView, sr: number) =>
    f.km !== undefined ? (f.km.get(sr) ?? -1) : (regions.get(sr)?.km ?? -1);
  const inRange = (f: AiFleetView, sr: number) => {
    const km = kmOf(f, sr);
    return km >= 0 && km <= f.rangeKm;
  };
  const homeRegions = input.regions.filter((r) => r.home && r.km >= 0);
  const allowed = (sr: number) =>
    !input.style.homeOnly || regions.get(sr)?.home === true;
  const go = (
    mission: FleetMission,
    sr: number,
    engage: EngageRule | null,
    main = false,
  ): Want => ({
    mission,
    sr,
    engage,
    returnAt: main ? AI_MAIN_RETURN_PCT : AI_RETURN_PCT,
    home: false,
  });

  if (!input.atWar) {
    // Spec §17.2-6: home and waiting; one patrol trains in a home region.
    const patrols = free.filter((f) => fleetRole(f.counts) === "patrol");
    const trainer = patrols.find((f) => f.mission === "training") ?? patrols[0];
    for (const f of free) {
      const near =
        homeRegions.find((r) => kmOf(f, r.sr) === 0) ?? homeRegions[0];
      wants.set(
        f.id,
        f === trainer && near !== undefined
          ? go("training", near.sr, null)
          : HOLD,
      );
    }
    emit(orders, free, wants);
    return orders;
  }

  const byRole = (role: AiFleetRole) =>
    free.filter((f) => fleetRole(f.counts) === role && !wants.has(f.id));
  const want = (f: AiFleetView, w: Want) => wants.set(f.id, w);
  const isMain = (f: AiFleetView) => fleetRole(f.counts) === "main";

  // ⑦ Carrier port strikes (spec §17.2-7, §13.4): to the port's region,
  // then the strike once there.
  const ports = input.ports
    .filter((p) => p.beat || p.capitals >= AI_STRIKE_CAPITALS)
    .map((p) => ({
      p,
      score: Math.floor(
        (p.capitals * (p.beat ? AI_BEAT_FACTOR : 1) * jit(p.port)) / 1000,
      ),
    }))
    .sort((a, b) => b.score - a.score || a.p.port - b.p.port);
  for (const { p } of ports) {
    const carrier = free
      .filter(
        (f) =>
          !wants.has(f.id) &&
          f.counts[CV] >= (p.beat ? 1 : AI_STRIKE_CARRIERS) &&
          inRange(f, p.sr),
      )
      .sort((a, b) => b.counts[CV] - a.counts[CV] || a.id - b.id)[0];
    if (carrier === undefined) continue;
    if (carrier.docked === 0 && carrier.sr === p.sr) {
      orders.push({
        kind: "fleet_port_strike",
        fleet: carrier.id,
        port: p.port,
      });
    }
    want(carrier, go("patrol", p.sr, "always", true));
  }

  // ② Invasion support: each route region to 600‰ (ours ≥ 1.5 × theirs).
  for (const r of input.regions) {
    if (!r.invasion) continue;
    const need = Math.floor(
      (r.enemySup * AI_INVASION_SUP_PM) / (1000 - AI_INVASION_SUP_PM),
    );
    const pool = [...byRole("main"), ...byRole("patrol")]
      .filter((f) => inRange(f, r.sr))
      .sort((a, b) => b.supPower - a.supPower || a.id - b.id);
    let ours = 0;
    for (const f of pool) {
      if (ours > 0 && ours >= need) break;
      if (isMain(f) && aiPredictPm(f.sum, r.enemySum) < AI_MAIN_ENGAGE_PM) {
        continue;
      }
      want(f, go("invasion_support", r.sr, "always", isMain(f)));
      ours += f.supPower;
    }
  }

  const threat = (r: AiSeaRegionView) =>
    Math.floor((r.enemySup * jit(r.sr)) / 1000);
  const homes = [...homeRegions].sort(
    (a, b) => threat(b) - threat(a) || a.sr - b.sr,
  );
  for (const step of input.style.order) {
    if (step === "home") {
      // ③ A battle fleet strikes where the threat to home is greatest; a
      // weaker one waits in port (a fleet in being). A patrol for every
      // home region, the threatened first.
      for (const f of byRole("main")) {
        const target = homes.find((r) => inRange(f, r.sr));
        if (target === undefined) continue;
        want(
          f,
          aiPredictPm(f.sum, target.enemySum) >= AI_MAIN_ENGAGE_PM
            ? go("strike", target.sr, "always", true)
            : HOLD,
        );
      }
      for (const r of homes) {
        const p = byRole("patrol").find((f) => inRange(f, r.sr));
        if (p !== undefined) want(p, go("patrol", r.sr, "if_stronger"));
      }
    } else if (step === "trade") {
      // ④ Escorts where convoys were lost or a raider is seen, the worst
      // first; Britain also covers its busiest lanes.
      const hit = input.regions
        .filter(
          (r) =>
            r.traffic > 0 &&
            (r.lossMilli > 0 || r.raiderSpotted) &&
            allowed(r.sr),
        )
        .sort(
          (a, b) =>
            b.lossMilli - a.lossMilli ||
            Number(b.raiderSpotted) - Number(a.raiderSpotted) ||
            b.traffic - a.traffic ||
            a.sr - b.sr,
        );
      const busiest = input.style.tradeAlways
        ? input.regions
            .filter((r) => r.traffic > 0 && !hit.includes(r) && allowed(r.sr))
            .sort(
              (a, b) =>
                Math.floor((b.traffic * jit(b.sr)) / 1000) -
                  Math.floor((a.traffic * jit(a.sr)) / 1000) || a.sr - b.sr,
            )
        : [];
      for (const r of [...hit, ...busiest]) {
        const e = byRole("escort").find((f) => inRange(f, r.sr));
        if (e !== undefined) want(e, go("escort", r.sr, "always"));
      }
    } else if (step === "raid") {
      // ⑤ Submarines to the enemy's busy lanes, the weakest escorts first.
      const lanes = input.regions
        .filter((r) => r.enemyTraffic > 0 && allowed(r.sr))
        .sort(
          (a, b) =>
            a.enemyEscort - b.enemyEscort ||
            Math.floor((b.enemyTraffic * jit(b.sr)) / 1000) -
              Math.floor((a.enemyTraffic * jit(a.sr)) / 1000) ||
            a.sr - b.sr,
        );
      const raiders = [
        ...byRole("sub"),
        ...(input.style.surfaceRaid ? byRole("patrol") : []),
      ];
      for (let round = 0; round < 2; round++) {
        for (const r of lanes) {
          const f = raiders.find((x) => !wants.has(x.id) && inRange(x, r.sr));
          if (f !== undefined) want(f, go("raid", r.sr, "avoid"));
        }
      }
    } else {
      // ⑥ Carrier fleets after a spotted enemy fleet they can beat.
      const spotted = input.regions
        .filter((r) => r.enemySpotted && allowed(r.sr))
        .sort((a, b) => threat(b) - threat(a) || a.sr - b.sr);
      for (const f of byRole("main")) {
        if (f.counts[CV] === 0) continue;
        const r = spotted.find(
          (x) =>
            inRange(f, x.sr) &&
            aiPredictPm(f.sum, x.enemySum) >= AI_MAIN_ENGAGE_PM,
        );
        if (r !== undefined) want(f, go("strike", r.sr, "always", true));
      }
    }
  }

  // The rest: patrols where our convoys go (else at home), submarines
  // where the enemy sails; escorts with no loss to answer and battle
  // fleets wait in port (only Britain escorts its quiet lanes too).
  const lanes = input.regions
    .filter((r) => r.traffic > 0 && allowed(r.sr))
    .sort((a, b) => b.traffic - a.traffic || a.sr - b.sr);
  for (const f of free) {
    if (wants.has(f.id)) continue;
    const role = fleetRole(f.counts);
    if (role === "patrol") {
      const r =
        lanes.find((x) => inRange(f, x.sr)) ??
        homes.find((x) => inRange(f, x.sr));
      if (r !== undefined) {
        want(f, go("patrol", r.sr, "if_stronger"));
        continue;
      }
    } else if (role === "sub") {
      const r = input.regions.find(
        (x) =>
          (x.enemySup > 0 || x.enemyTraffic > 0) &&
          allowed(x.sr) &&
          inRange(f, x.sr),
      );
      if (r !== undefined) {
        want(f, go("raid", r.sr, "avoid"));
        continue;
      }
    }
    want(f, HOLD);
  }
  emit(orders, free, wants);
  return orders;
}

/** A role fleet docked in the same port that wants every ship of `f` (screens or boats short). */
function mergeTarget(
  f: AiFleetView,
  fleets: readonly AiFleetView[],
): number | null {
  const c = f.counts;
  const n = sumOf(c);
  if (n === 0) return null;
  for (const g of fleets) {
    if (
      g.id === f.id ||
      g.newShips ||
      g.docked !== f.docked ||
      g.state === "battle" ||
      sumOf(g.counts) + n > WW_MAX_FLEET_SHIPS
    ) {
      continue;
    }
    const role = fleetRole(g.counts);
    if (role === "main") {
      const screens = g.counts[DD] + g.counts[CL];
      const big = capitalsOf(g.counts) + g.counts[CV];
      if (c[DD] + c[CL] === n && screens + n <= AI_SCREEN_RATIO * big) {
        return g.id;
      }
    } else if (role === "sub") {
      if (c[SS] === n && g.counts[SS] + n <= AI_SUB_MAX) return g.id;
    }
  }
  return null;
}

/** The orders that turn each fleet's state into its want (only what differs). */
function emit(
  orders: AiNavalOrder[],
  fleets: readonly AiFleetView[],
  wants: ReadonlyMap<number, Want>,
): void {
  for (const f of fleets) {
    const w = wants.get(f.id);
    if (w === undefined) continue;
    if (w.home) {
      if (f.docked === 0 && f.state !== "returning") {
        orders.push({ kind: "fleet_return", fleet: f.id });
      } else if (f.docked !== 0 && f.mission !== "hold" && f.sr > 0) {
        orders.push({
          kind: "fleet_mission",
          fleet: f.id,
          mission: "hold",
          sr: f.sr,
        });
      }
      continue;
    }
    if (w.engage !== null && w.engage !== f.engage) {
      orders.push({ kind: "fleet_engage", fleet: f.id, rule: w.engage });
    }
    if (w.returnAt !== null && w.returnAt !== f.returnAtPct) {
      orders.push({
        kind: "fleet_return_at",
        fleet: f.id,
        pct: w.returnAt as 0 | 30 | 50 | 70,
      });
    }
    if (w.mission !== f.mission || w.sr !== f.missionSr) {
      orders.push({
        kind: "fleet_mission",
        fleet: f.id,
        mission: w.mission,
        sr: w.sr,
      });
    }
  }
}

// ---- The engine side ----

/** A fleet's ships as AiShipRows. */
export function fleetRows(navy: WwNavy, f: Fleet): AiShipRow[] {
  const t = navy.ships;
  const out: AiShipRow[] = [];
  for (const id of f.ships) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    out.push({
      cls: t.cls[r],
      gen: t.gen[r],
      stats: navy.shipStatsOf(r),
      hpMilli: t.hp[r],
      orgMilli: t.org[r],
    });
  }
  return out;
}

/** A fleet's class counts. */
export function fleetCounts(navy: WwNavy, f: Fleet): number[] {
  const c = new Array<number>(SHIP_CLASSES.length).fill(0);
  for (const id of f.ships) {
    const r = navy.ships.rowOf(id);
    if (r >= 0) c[navy.ships.cls[r]]++;
  }
  return c;
}

/** The sea strategic regions our invasions sail through (port to target). */
export function invasionRouteSrs(navy: WwNavy, smallID: number): Set<number> {
  const out = new Set<number>();
  const sc = navy.scenario;
  for (const inv of navy.invasions.values()) {
    if (inv.owner !== smallID) continue;
    const from = sc.harborOf(inv.from);
    const to = sc.harborOf(inv.target);
    if (from === 0 || to === 0) continue;
    const p = seaPath(sc, [from], [to], navy.passable(smallID, true));
    for (const z of p?.zones ?? []) {
      const sr = sc.zoneSr(z);
      if (sr !== 0) out.add(sr);
    }
  }
  return out;
}

const STATE_BATTLE = FLEET_STATES.indexOf("battle");

/** What the plan reads of `smallID`'s navy today (`fleets`: the ones it commands). */
export function aiNavalInput(
  navy: WwNavy,
  smallID: number,
  day: number,
  fleets: readonly Fleet[],
  atWar: boolean,
): AiNavalInput {
  const sc = navy.scenario;
  const ww = navy.ww;
  const land = navy.land;
  const side = navy.sideOf(smallID);
  const tag = sc.tagOfSmallId(smallID)!;
  const pass = navy.passable(smallID, true);
  const dists = new Map<number, Map<number, number>>();
  const distFrom = (port: number) => {
    let d = dists.get(port);
    if (d === undefined) {
      const z = port === 0 ? 0 : sc.harborOf(port);
      d = z === 0 ? new Map() : seaDistances(sc, [z], pass);
      dists.set(port, d);
    }
    return d;
  };
  const mainDist = distFrom(aiMainBase(ww, smallID));
  const enemy = (owner: number) =>
    owner !== smallID && land.isEnemy(smallID, owner);
  const invasion = atWar ? invasionRouteSrs(navy, smallID) : new Set<number>();
  // Home: the regions holding a harbor of one of our core ports.
  const homeSrs = new Set<number>();
  for (const r of sc.landRegions) {
    if (!r.core || r.owner !== tag || land.controller[r.id] !== smallID) {
      continue;
    }
    const z = sc.harborOf(r.id);
    if (z !== 0 && navalPort(ww, r.id) && sc.zoneSr(z) !== 0) {
      homeSrs.add(sc.zoneSr(z));
    }
  }
  // Convoy traffic by sea region: ours, the enemy's.
  const traffic = new Map<number, number>();
  const enemyTraffic = new Map<number, number>();
  for (const r of navy.routes.values()) {
    const into =
      r.owner === smallID ? traffic : enemy(r.owner) ? enemyTraffic : null;
    if (into === null) continue;
    for (const sr of r.srs) {
      into.set(sr, (into.get(sr) ?? 0) + Math.max(r.need, r.got));
    }
  }
  const regions: AiSeaRegionView[] = [];
  for (const s of sc.strategicList()) {
    if (s.kind !== "sea") continue;
    let enemySup = 0;
    let enemyEscort = 0;
    let spotted = false;
    let raider = false;
    const rows: AiShipRow[] = [];
    if (atWar) {
      for (const z of s.members) {
        for (const fid of navy.fleetsIn(z)) {
          const f = navy.fleets.get(fid);
          if (f === undefined || !enemy(f.owner)) continue;
          const fr = fleetRows(navy, f);
          rows.push(...fr);
          const sup = aiSupPower(fr);
          enemySup += f.docked !== 0 ? Math.floor(sup / 2) : sup;
          const counts = fleetCounts(navy, f);
          const role = fleetRole(counts);
          if (role === "patrol" || role === "escort") {
            enemyEscort += fleetPower(
              fr.map((x) => ({ stats: x.stats, hpMilli: x.hpMilli })),
            );
          }
          if (navy.spotted(side, fid)) {
            spotted = true;
            if (counts[SS] > 0 || capitalsOf(counts) === 0) raider = true;
          }
        }
      }
    }
    const st = navy.srState[s.idx];
    regions.push({
      sr: s.id,
      km: srKmIn(sc, mainDist, s.id),
      home: homeSrs.has(s.id),
      traffic: traffic.get(s.id) ?? 0,
      lossMilli:
        (st?.lossYesterday.get(smallID) ?? 0) + (st?.lossRate.get(side) ?? 0),
      raiderSpotted: raider,
      enemyTraffic: enemyTraffic.get(s.id) ?? 0,
      enemyEscort,
      enemySup,
      enemySum: rows.length === 0 ? null : navalSideSum(rows),
      enemySpotted: spotted,
      invasion: invasion.has(s.id),
    });
  }
  const views: AiFleetView[] = fleets.map((f) => {
    const rows = fleetRows(navy, f);
    const d = distFrom(f.home);
    const km = new Map<number, number>();
    for (const r of regions) {
      const k = srKmIn(sc, d, r.sr);
      if (k >= 0) km.set(r.sr, k);
    }
    return {
      id: f.id,
      counts: fleetCounts(navy, f),
      supPower: aiSupPower(rows),
      sum: navalSideSum(rows),
      home: f.home,
      docked: f.docked,
      sr: sc.zoneSr(f.zone),
      state: FLEET_STATES[f.state] ?? "docked",
      mission: FLEET_MISSIONS[f.mission] ?? "hold",
      missionSr: f.missionSr,
      engage: ENGAGE_RULES[f.engage] ?? "if_stronger",
      returnAtPct: f.returnAtPct,
      newShips: f.newShips,
      rangeKm: navy.fleetRangeKm(f),
      km,
    };
  });
  // Enemy ports for a carrier strike (never a no-strike region).
  const ports: AiPortView[] = [];
  if (atWar && views.some((v) => v.counts[CV] > 0)) {
    const beats = activeBeatTargets(navy, smallID, day, "port_strike");
    for (const r of sc.landRegions) {
      const c = land.controller[r.id];
      if (!enemy(c) || isNoStrike(sc, r.id) || !navalPort(ww, r.id)) continue;
      const z = sc.harborOf(r.id);
      const sr = z === 0 ? 0 : sc.zoneSr(z);
      if (sr === 0) continue;
      let capitals = 0;
      for (const fid of navy.fleetsIn(z)) {
        const f = navy.fleets.get(fid);
        if (f === undefined || f.docked !== r.id || !enemy(f.owner)) continue;
        capitals += capitalsOf(fleetCounts(navy, f));
      }
      const beat = beats.has(r.id);
      if (capitals >= AI_STRIKE_CAPITALS || (beat && capitals > 0)) {
        ports.push({ port: r.id, sr, capitals, beat });
      }
    }
  }
  return {
    smallID,
    day,
    atWar,
    fleets: views,
    fleetCount: navy.fleetsOf(smallID).length,
    regions,
    ports,
    style: aiNavyStyle(tag),
    seed: ww.politics.seed,
  };
}

/** Spec §17.1: at war daily, else every 10 days. */
export function aiNavyDue(
  smallID: number,
  day: number,
  atWar: boolean,
): boolean {
  return atWar || day % 10 === smallID % 10;
}

/** Whether `smallID` fights a war now (an enemy past the preparation minute). */
export function aiAtWar(navy: WwNavy, smallID: number): boolean {
  return navy.ww.enemiesOf(smallID).some((e) => navy.land.isEnemy(smallID, e));
}

/** The country's AI day for its fleets (an AI country's all, a human's auto ones). */
export function aiNavy(navy: WwNavy, smallID: number, day: number): void {
  const p = navy.mg.playerBySmallID(smallID);
  if (!p.isPlayer()) return;
  const human = p.type() === PlayerType.Human;
  // A fleet in battle takes no orders today.
  const fleets = navy
    .fleetsOf(smallID)
    .filter((f) => (!human || f.auto) && f.state !== STATE_BATTLE);
  if (fleets.length === 0) return;
  const atWar = aiAtWar(navy, smallID);
  if (!aiNavyDue(smallID, day, atWar)) return;
  const tick = navy.mg.ticks();
  const plan = aiNavalPlan(aiNavalInput(navy, smallID, day, fleets, atWar));
  for (const o of plan) navy.issue(smallID, o, tick, "ai");
}

// ---- P3's war score: the sea in an overseas war (controller addition) ----

/** 내 판단: a land-based naval bomber in fleet power, centi (a carrier's deck plane counts 60). */
export const AI_NAVAL_BOMBER_CENTI = 30;
/** 내 판단: convoys a division needs at sea (about an infantry division's divisionConvoys). */
export const AI_CONVOYS_PER_DIVISION = 10;
/** An overseas war's score: the sea's eighths (the land keeps the rest). */
export const AI_SEA_SCORE_EIGHTHS = 7;
const SEA_SCORE_MAX = 1_000_000;

/** What the sea term of a war reads. */
export interface AiSeaWarInput {
  /** fleetPower (centi) in the theatre plus naval air: ours, the enemy side's. */
  ours: number;
  theirs: number;
  /** Divisions our convoys can carry, and our invasion capacity. */
  lift: number;
  capacity: number;
}

/**
 * Pure: the sea's war score ‰ — our power over theirs in the theatre ×
 * the invasion factor (500‰ with no convoys to land troops, 1000‰ when
 * they carry a full invasion): a navy that cannot land an army wins no
 * overseas war by itself.
 */
export function aiSeaWarPm(i: AiSeaWarInput): number {
  if (i.ours <= 0) return 0;
  const ratio =
    i.theirs <= 0
      ? SEA_SCORE_MAX
      : Math.min(SEA_SCORE_MAX, Math.floor((i.ours * 1000) / i.theirs));
  const cap = Math.max(1, i.capacity);
  const lift = Math.max(0, Math.min(cap, i.lift));
  const factor = 500 + Math.floor((500 * lift) / cap);
  return Math.floor((ratio * factor) / 1000);
}

/** Pure: an overseas war's score, the land's 1/8 and the sea's 7/8. */
export function aiOverseasBlend(landPm: number, seaPm: number): number {
  return Math.floor(
    (landPm * (8 - AI_SEA_SCORE_EIGHTHS) + seaPm * AI_SEA_SCORE_EIGHTHS) / 8,
  );
}

const seaWarMemo = new WeakMap<
  WwNavy,
  { tick: number; m: Map<string, number> }
>();

/**
 * The sea term of `a`'s war on `side`: the theatre is the sea zones
 * within an invasion's reach (8,000 km) of one of `a`'s ports and of one
 * of the side's; the fleets there count (fleetPower: guns, torpedoes, HP,
 * carrier decks) with each country's naval bombers. -1 when neither side
 * has any (the sea decides nothing). Memoised for a tick.
 */
export function aiSeaWarPmOf(
  ww: WwNavy["ww"],
  a: number,
  side: readonly number[],
): number {
  const navy = ww.navy;
  const tick = navy.mg.ticks();
  let memo = seaWarMemo.get(navy);
  if (memo === undefined || memo.tick !== tick) {
    memo = { tick, m: new Map() };
    seaWarMemo.set(navy, memo);
  }
  const key = `${a}:${side.join(",")}`;
  const hit = memo.m.get(key);
  if (hit !== undefined) return hit;
  const sc = ww.scenario;
  const harbors = (owner: number) =>
    navalPortsOf(ww, owner)
      .map((r) => sc.harborOf(r))
      .filter((z) => z !== 0);
  const fromA = harbors(a);
  const fromT = side.flatMap(harbors);
  // The theatre (none when `a` has no port: its fleets cannot sail).
  const theatre = new Set<number>();
  if (fromA.length > 0) {
    const distA = seaDistances(sc, fromA, navy.passable(a, true));
    const distT =
      fromT.length === 0
        ? null
        : seaDistances(
            sc,
            [...new Set(fromT)].sort((x, y) => x - y),
            () => true,
          );
    for (const [z, km] of distA) {
      if (km > AI_INVASION_REACH_KM) continue;
      const kt = distT === null ? 0 : (distT.get(z) ?? Infinity);
      if (kt <= AI_INVASION_REACH_KM) theatre.add(z);
    }
  }
  const power = (owners: readonly number[]) => {
    let p = 0;
    for (const o of owners) {
      for (const f of navy.fleetsOf(o)) {
        if (!theatre.has(f.zone)) continue;
        p += fleetPower(
          fleetRows(navy, f).map((x) => ({
            stats: x.stats,
            hpMilli: x.hpMilli,
          })),
        );
      }
      const ce = ww.economy.country(o);
      if (ce === null) continue;
      for (let g = 1; g <= 3; g++) {
        const k = equipKey("naval_bomber", g);
        p +=
          ((ce.stock[k] ?? 0) + (ce.planesDeployed[k] ?? 0)) *
          AI_NAVAL_BOMBER_CENTI;
      }
    }
    return p;
  };
  const ours = theatre.size === 0 ? 0 : power([a]);
  const theirs = power(side);
  // No warship or naval bomber on either side: the sea decides nothing
  // (the land score stands: P2's frozen overseas war, a navy-less map).
  let pm = -1;
  if (ours > 0 || theirs > 0) {
    const ce = ww.economy.country(a);
    pm = aiSeaWarPm({
      ours,
      theirs,
      lift:
        ce === null ? 0 : Math.floor(convoysOf(ce) / AI_CONVOYS_PER_DIVISION),
      capacity: ce === null ? 0 : invasionCapacity(ce.stats, ce.researched),
    });
  }
  memo.m.set(key, pm);
  return pm;
}

const landMasses = new WeakMap<ScenarioIndex, Int32Array>();

/**
 * The land masses: regions joined by land edges (straits count, as the
 * land war walks them), whoever holds them; a region's mass number, by id.
 */
export function landMassOf(sc: ScenarioIndex): Int32Array {
  let m = landMasses.get(sc);
  if (m !== undefined) return m;
  m = new Int32Array(sc.maxRegionId() + 1).fill(-1);
  let n = 0;
  const queue: number[] = [];
  for (const r of sc.landRegions) {
    if (m[r.id] >= 0) continue;
    m[r.id] = n;
    queue.length = 0;
    queue.push(r.id);
    for (let i = 0; i < queue.length; i++) {
      for (const e of sc.edgesOf(queue[i])) {
        if (m[e.to] < 0) {
          m[e.to] = n;
          queue.push(e.to);
        }
      }
    }
    n++;
  }
  landMasses.set(sc, m);
  return m;
}

/**
 * Whether `a` (with its faction) and every member of `side` hold land on
 * no common land mass: the war can be carried only over the sea.
 */
export function aiOverseas(
  ww: WwNavy["ww"],
  a: number,
  side: readonly number[],
): boolean {
  const sc = ww.scenario;
  const mass = landMassOf(sc);
  const ctl = ww.land.controller;
  const f = ww.factionOf(a);
  const ours = new Set<number>(f === null ? [a] : [a, ...ww.factionMembers(f)]);
  const theirs = new Set(side);
  const mine = new Set<number>();
  const them = new Set<number>();
  for (const r of sc.landRegions) {
    const c = ctl[r.id] ?? 0;
    if (ours.has(c)) mine.add(mass[r.id]);
    else if (theirs.has(c)) them.add(mass[r.id]);
  }
  for (const x of them) if (mine.has(x)) return false;
  return true;
}

/**
 * Controller addition (P4 lane AI): P3's war score of `a` on `t` (with
 * `side`: `t` and the faction a declaration brings in). While an army of
 * `a`'s side can march to `t` (a land mass both hold land on) it is the
 * land score. When none can, the war is fought at sea too: with every
 * member of the side overseas the sea term (the whole side's ships in the
 * theatre) takes 7/8 (aiOverseasBlend); when some member can be reached
 * by land (its army is the land score's) the sea against `t` alone takes
 * half (내 판단: the way to `t` is the sea). So Japan with
 * the stronger Pacific fleet rates a war on the United States (and the
 * Allies) as P3's history beat needs, and a country without a navy rates
 * a war on one overseas low. When neither side has a warship or a naval
 * bomber the land score stands. Integer only.
 */
export function aiOverseasWarScore(
  ww: WwNavy["ww"],
  a: number,
  t: number,
  side: readonly number[],
  landPm: number,
): number {
  if (side.length === 0 || !aiOverseas(ww, a, [t])) return landPm;
  if (aiOverseas(ww, a, side)) {
    const sea = aiSeaWarPmOf(ww, a, side);
    return sea < 0 ? landPm : aiOverseasBlend(landPm, sea);
  }
  // Some of the side can be reached by land: their armies are the land
  // score's; the sea is the way to `t` itself.
  const sea = aiSeaWarPmOf(ww, a, [t]);
  return sea < 0 ? landPm : Math.floor((landPm + sea) / 2);
}

/** Spec §11.1: the reach of an invasion by sea. */
const AI_INVASION_REACH_KM = WW_INVASION_MAX_KM;
