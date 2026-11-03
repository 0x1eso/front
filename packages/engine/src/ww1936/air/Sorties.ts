// World War 1936 air overhaul (ww8), lane B: the sortie cycle, the zones'
// pulses and their daily close, wing_mission (design §3.3–§3.8). WwAir's
// tickWings and issueWingOrder call them in the wing model only.
//
// Cost (design §10.2). The wing loop compares `until` and works only on the
// wings whose phase ended. A pulse keeps one sum per side and per zone, not
// per plane, and builds no arrays or closures: its buffers live below and are
// reused. Every memo here is a pure function of the state it stamps, so a
// restored game (which starts with none) reads the same numbers.
import {
  AIR_MISSIONS,
  AIR_PULSE_TICKS,
  AIR_TYPES,
  PlaneStats,
  Wing,
  WING_AUTO_FERRY_DAYS,
  WING_GROUND_RECHECK_TICKS,
  WING_INTERCEPT_MIN_STATION,
  WING_NO_MISSION,
  WING_NOTICE_DAYS,
  WingOrder,
  WP_BACK,
  WP_FERRY,
  WP_GROUND,
  WP_OUT,
  WP_REARM,
  WP_STATION,
  WW_AIR_SCORE_DIV,
  WW_AIR_VIEW_BAND_PM,
  WW_BOMB_CLASSES,
  WW_NO_RADAR_SCRAMBLE_TICKS,
  WW_RADAR_DETECT_PM,
  WW_RADAR_RANGE_KM,
  WW_RADAR_WARN_TICKS,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  type BuildingId,
  RESOURCE_IDS,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { ROLE_ATTACK } from "@openfront/engine-api/ww1936/LandTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  aaLossPm,
  airSupPm,
  casPoolCenti,
  detectionPm,
  sortieEffPm,
  WEATHER_SORTIE_PM,
} from "@openfront/engine-lib/ww1936/AirRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { StrategicRegion } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  airLuckPm,
  bombClassHits,
  bombClassIndex,
  casTickCenti,
  escortKeepPm,
  legTicks,
  loadCenti,
  P_AIR_KILL,
  rearmTicks,
  sortieFuelMilli,
  stationCentiPerDay,
  WING_CYCLE,
  type WingMissionAsk,
  wingOrderBlock,
  wingStaggerTicks,
  wingUnderStrength,
  wingXpLoadPm,
  wingXpLossPm,
  wingXpStats,
  xpTier,
} from "@openfront/engine-lib/ww1936/WingRules";
import { nightMods } from "../depth/AirExtras";
import { planesLossBp } from "../depth/Designs";
import { effectiveLevel } from "../economy/Buildings";
import { noteFuelUse } from "../economy/Fuel";
import { navalPort } from "../navy/Ports";
import {
  duelSumsMilli,
  effWith,
  pruneAlerts,
  sidesAtWar,
  sortedMap,
  superiorityAlerts,
  W_INT_FIGHTER,
  W_INT_OTHER,
  W_SUP_FIGHTER,
  W_SUP_OTHER,
  zoneWeather,
} from "./AirCombat";
import { bombTableOf, tableWeight } from "./Bombing";
import {
  basesInRange,
  carrierWingDeck,
  carrierWingDeckD,
  isCarrierWing,
  takeOffDeck,
} from "./Deploy";
import { oldestFirst } from "./DesignPlanes";
import { hasMagnetron, MAGNETRON_RADAR_PM, withFuze } from "./ProjectEffects";
import { issueWingBase, rearmWing, wingBaseEffPm } from "./Wings";
import { accrueStation, deliverSortie, noteRaidLost } from "./WingStrikes";
import {
  noteWingCas,
  noteWingDelivery,
  noteWingFight,
  noteWingStation,
} from "./WingXp";
import {
  deploymentStats,
  wingPlanes,
  wingSide,
  type WwAir,
  type ZoneAirState,
  type ZoneToday,
} from "./WwAir";

const M_SUP = AIR_MISSIONS.indexOf("air_superiority");
const M_INT = AIR_MISSIONS.indexOf("interception");
const M_CAS = AIR_MISSIONS.indexOf("cas");
const M_BOMB = AIR_MISSIONS.indexOf("strategic_bombing");
const M_STRIKE = AIR_MISSIONS.indexOf("naval_strike");
const M_PORT = AIR_MISSIONS.indexOf("port_strike");
const M_PATROL = AIR_MISSIONS.indexOf("naval_patrol");
const M_SUPPLY = AIR_MISSIONS.indexOf("air_supply");
const M_RECON = AIR_MISSIONS.indexOf("recon");
const M_ESCORT = AIR_MISSIONS.indexOf("escort");
const OIL = RESOURCE_IDS.indexOf("oil");
const CLS_PORT = bombClassIndex("port");

/** ZoneToday.flown's key: owner × this + mission. */
const FLOWN_KEY = 16;
const N_MISSIONS = AIR_MISSIONS.length;
/** stationCentiPerDay by type × N_MISSIONS + mission: static, and read for every wing on station. */
const STATION_CENTI = AIR_TYPES.flatMap((t) =>
  AIR_MISSIONS.map((m) => stationCentiPerDay(t, m)),
);
const FIGHTER = AIR_TYPES.map(
  (t) => t === "fighter" || t === "heavy_fighter" || t === "cv_fighter",
);

const sortieOf = (w: Wing) => AIR_MISSIONS[w.flyMission];
const isBombing = (m: number) => m === M_BOMB || m === M_PORT;
const isShooter = (m: number) => m === M_SUP || m === M_INT || m === M_ESCORT;
const flying = (w: Wing) => w.phase === WP_OUT || w.phase === WP_STATION;
/** The bomb class of the sortie in the air: a port strike's report row is always the port class's. */
const raidCls = (w: Wing) => (w.flyMission === M_PORT ? CLS_PORT : w.cls);

/** What 2 ticks on station fly: WingRules.pulseMilli off the table. */
function pulseOf(w: Wing): number {
  const c = STATION_CENTI[w.type * N_MISSIONS + w.flyMission];
  return c <= 0 ? 0 : Math.floor((w.flyMilli * 200) / c);
}

// ---- Memos (pure functions of what they stamp) ----

interface StatsMemo {
  owner: number;
  statsVer: number;
  researched: unknown;
  tier: number;
  ace: boolean;
  counts: number[];
  stats: PlaneStats;
}
/** By wing id (ids only rise), per game; the last game's rows at hand. */
const statsMemos = new WeakMap<WwAir, (StatsMemo | undefined)[]>();
let statsAir: WwAir | null = null;
let statsRows: (StatsMemo | undefined)[] = [];

function statsRowsOf(air: WwAir): (StatsMemo | undefined)[] {
  if (statsAir === air) return statsRows;
  let rows = statsMemos.get(air);
  if (rows === undefined) statsMemos.set(air, (rows = []));
  statsAir = air;
  statsRows = rows;
  return rows;
}

function sameCounts(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * A wing's numbers in the air: deploymentStats with its experience and ace
 * (WingRules.wingXpStats, which reads the tier only), kept per wing while its
 * mix, tier, ace and the owner's stats are the same. Design planes read their
 * slots' designs, which no version here stamps: those wings aren't kept.
 */
export function wingStats(air: WwAir, w: Wing): PlaneStats {
  const ace = w.ace !== 0;
  for (let i = 0; i < w.dcounts.length; i++) {
    if (w.dcounts[i] > 0) {
      return wingXpStats(deploymentStats(air, w), w.xpMilli, ace);
    }
  }
  const ce = air.econ.country(w.owner);
  const tier = xpTier(w.xpMilli);
  const rows = statsRowsOf(air);
  const hit = rows[w.id];
  if (
    hit !== undefined &&
    ce !== null &&
    hit.owner === w.owner &&
    hit.statsVer === ce.statsVer &&
    hit.researched === ce.researched &&
    hit.tier === tier &&
    hit.ace === ace &&
    sameCounts(hit.counts, w.counts)
  ) {
    return hit.stats;
  }
  const stats = wingXpStats(deploymentStats(air, w), w.xpMilli, ace);
  if (ce === null) return stats;
  if (hit === undefined) {
    rows[w.id] = {
      owner: w.owner,
      statsVer: ce.statsVer,
      researched: ce.researched,
      tier,
      ace,
      counts: [...w.counts],
      stats,
    };
    return stats;
  }
  // Losses change the counts often: the row is reused.
  hit.owner = w.owner;
  hit.statsVer = ce.statsVer;
  hit.researched = ce.researched;
  hit.tier = tier;
  hit.ace = ace;
  hit.counts.length = w.counts.length;
  for (let i = 0; i < w.counts.length; i++) hit.counts[i] = w.counts[i];
  hit.stats = stats;
  return stats;
}

/** Whom the sides fight, until a war or a side changes: −1 not asked yet, by side index. */
interface WarMemo {
  air: WwAir;
  warVer: number;
  epoch: number;
  prep: boolean;
  index: Map<number, number>;
  span: number;
  fight: Int8Array;
  enemies: Map<number, readonly { key: number }[]>;
}
let warNow: WarMemo | null = null;

/** The memo now: the air steps call this first, and nothing changes a war inside them. */
function refreshWar(air: WwAir): WarMemo {
  const warVer = air.ww.warVer;
  const epoch = air.land.derivedEpoch;
  const prep = air.ww.inPrep(air.mg.ticks());
  const m = warNow;
  if (
    m !== null &&
    m.air === air &&
    m.warVer === warVer &&
    m.epoch === epoch &&
    m.prep === prep
  ) {
    return m;
  }
  const sides = air.land.sideList();
  const span = sides.length + 1;
  const index = new Map<number, number>();
  sides.forEach((x, i) => index.set(x.key, i));
  warNow = {
    air,
    warVer,
    epoch,
    prep,
    index,
    span,
    fight: new Int8Array(span * span).fill(-1),
    enemies: new Map(),
  };
  return warNow;
}

function sidesFight(air: WwAir, a: number, b: number): boolean {
  if (a === b) return false;
  const m = warNow !== null && warNow.air === air ? warNow : refreshWar(air);
  const x = m.index.get(a);
  const y = m.index.get(b);
  if (x === undefined || y === undefined) return sidesAtWar(air, a, b);
  const at = x * m.span + y;
  let v = m.fight[at];
  if (v < 0) {
    v = sidesAtWar(air, a, b) ? 1 : 0;
    m.fight[at] = v;
    m.fight[y * m.span + x] = v;
  }
  return v === 1;
}

/** The sides at war with side `F`, in sideList order. */
function enemySides(air: WwAir, F: number): readonly { key: number }[] {
  const memo = refreshWar(air).enemies;
  let out = memo.get(F);
  if (out === undefined) {
    const land = air.land;
    const members = land.sideMembers(F);
    out = land
      .sideList()
      .filter(
        (S) =>
          S.key !== F &&
          S.members.some((c) => members.some((m) => land.isEnemy(c, m))),
      );
    memo.set(F, out);
  }
  return out;
}

function isEnemyOfSide(air: WwAir, side: number, c: number): boolean {
  if (c === 0) return false;
  const land = air.land;
  const members = land.sideMembers(side);
  for (let i = 0; i < members.length; i++) {
    if (land.isEnemy(members[i], c)) return true;
  }
  return members.length === 0 && land.isEnemy(side, c);
}

/** Per zone, the radars whose reach holds it: [region, level] pairs, until a radar changes. */
interface RadarMemo {
  ver: number;
  byZone: (number[] | null)[];
}
const radarMemos = new WeakMap<WwAir, RadarMemo>();

/**
 * radarPmAt, read per side and zone every pulse: levels and geometry are kept
 * until a radar's count or damage changes; the controllers, the sides and the
 * magnetron are read now, so they can't go stale.
 */
export function radarAt(air: WwAir, side: number, sr: number): number {
  const sc = air.ww.scenario;
  const idx = sc.srIdxOf(sr);
  if (idx < 0) return 0;
  const econ = air.econ;
  let memo = radarMemos.get(air);
  if (memo === undefined || memo.ver !== econ.radarVer) {
    memo = { ver: econ.radarVer, byZone: [] };
    radarMemos.set(air, memo);
  }
  let row = memo.byZone[idx];
  if (row === undefined || row === null) {
    row = [];
    const levels = econ.buildingArray("radar");
    for (let r = 1; r < levels.length; r++) {
      if (levels[r] === 0 || sc.region(r) === undefined) continue;
      const lv = effectiveLevel(econ, r, "radar");
      if (lv > 0 && sc.srKm(r, sr) <= WW_RADAR_RANGE_KM * lv) row.push(r, lv);
    }
    memo.byZone[idx] = row;
  }
  const land = air.land;
  let best = 0;
  for (let i = 0; i < row.length; i += 2) {
    const c = land.controller[row[i]] ?? 0;
    if (c === 0 || land.sideOf(c) !== side) continue;
    const pm =
      (WW_RADAR_DETECT_PM +
        (hasMagnetron(air.ww.depth, c) ? MAGNETRON_RADAR_PM : 0)) *
      row[i + 1];
    if (pm > best) best = pm;
  }
  return best;
}

/** The interceptors waiting on the ground this tick, by side. */
const guardSides: number[] = [];
const guardLists: Wing[][] = [];
let guardSideCount = 0;
let guardsTick = -1;
let guardsAir: WwAir | null = null;

function gatherGuards(air: WwAir, tick: number): void {
  if (guardsTick === tick && guardsAir === air) return;
  guardsTick = tick;
  guardsAir = air;
  for (let i = 0; i < guardSideCount; i++) guardLists[i].length = 0;
  guardSideCount = 0;
  const wings = air.wingArray();
  for (let i = 0; i < wings.length; i++) {
    const w = wings[i];
    if (w.mission !== M_INT || w.phase !== WP_GROUND || w.base <= 0) continue;
    const side = wingSide(air, w);
    let at = 0;
    while (at < guardSideCount && guardSides[at] !== side) at++;
    if (at === guardSideCount) {
      guardSides[at] = side;
      guardLists[at] ??= [];
      guardSideCount++;
    }
    guardLists[at].push(w);
  }
}

// ---- Where a sortie goes ----

/** A zone's center as a target: its center region or sea zone. */
function zoneTarget(air: WwAir, sr: number): number {
  const sc = air.ww.scenario;
  const s = sc.sr(sr);
  if (s === undefined || s.members.length === 0) return 0;
  const at = sc.regionAt(s.center);
  return s.members.includes(at) ? at : s.members[0];
}

/** The standing order's target; 0 means the whole zone, flown to its center. */
function orderedTarget(air: WwAir, w: Wing): number {
  return w.target !== 0 ? w.target : zoneTarget(air, w.sr);
}

function widthOfIds(air: WwAir, ids: readonly number[]): number {
  const land = air.land;
  let n = 0;
  for (let i = 0; i < ids.length; i++) {
    const r = land.divisions.rowOf(ids[i]);
    if (r >= 0) n += land.widthOf(r);
  }
  return n;
}

/** `side`'s frontage in the battle of region `r`; 0 when it doesn't fight there. */
function sideWidthIn(air: WwAir, r: number, side: number): number {
  const land = air.land;
  const b = land.battles.get(r);
  if (b === undefined) return 0;
  if (land.sideOf(b.attLead) === side) {
    return widthOfIds(air, b.attLine.length > 0 ? b.attLine : b.attackers);
  }
  if (land.sideOf(land.controller[r] ?? 0) === side) {
    return widthOfIds(air, b.defLine.length > 0 ? b.defLine : b.defenders);
  }
  return 0;
}

/** Close air support's battle (design §3.6): the named region's, else our widest in the zone; 0 none. */
function pickBattle(
  air: WwAir,
  side: number,
  sr: number,
  prefer: number,
): number {
  if (prefer !== 0 && sideWidthIn(air, prefer, side) > 0) return prefer;
  const s = air.ww.scenario.sr(sr);
  if (s === undefined || s.kind !== "land") return 0;
  let best = 0;
  let bestW = 0;
  for (let i = 0; i < s.members.length; i++) {
    const w = sideWidthIn(air, s.members[i], side);
    if (w > bestW) {
      best = s.members[i];
      bestW = w;
    }
  }
  return best;
}

/**
 * The battle of a followed army (design §4.1): its attack nearest the order's
 * goal, else the battle holding most of its divisions; 0 when it isn't fighting.
 */
function armyBattle(air: WwAir, army: number): number {
  const land = air.land;
  const a = land.armies.get(army);
  if (a === undefined) return 0;
  const t = land.divisions;
  const sc = air.ww.scenario;
  const goal = a.order.to !== 0 ? a.order.to : (a.order.targets[0] ?? 0);
  const count = new Map<number, number>();
  let attack = 0;
  let attackKm = Number.MAX_SAFE_INTEGER;
  for (const id of a.divisions) {
    const row = t.rowOf(id);
    if (row < 0 || t.battle[row] === 0) continue;
    const b = t.battle[row];
    count.set(b, (count.get(b) ?? 0) + 1);
    if (t.role[row] !== ROLE_ATTACK) continue;
    const km = goal === 0 ? 0 : sc.regionKm(b, goal);
    if (km < attackKm || (km === attackKm && b < attack)) {
      attack = b;
      attackKm = km;
    }
  }
  if (attack !== 0) return attack;
  let best = 0;
  let bestN = 0;
  for (const [b, n] of count) {
    if (n > bestN || (n === bestN && b < best)) {
      best = b;
      bestN = n;
    }
  }
  return best;
}

function bombTargetOk(air: WwAir, w: Wing, side: number, r: number): boolean {
  const ctl = air.land.controller[r] ?? 0;
  if (!isEnemyOfSide(air, side, ctl)) return false;
  if (w.mission === M_PORT) return navalPort(air.ww, r);
  const levels = (b: BuildingId) => air.econ.buildingArray(b)[r] ?? 0;
  return bombClassHits(
    WW_BOMB_CLASSES[w.cls] ?? "auto",
    levels,
    (air.ww.scenario.region(r)?.res[OIL] ?? 0) > 0,
  );
}

/**
 * Something of the class still works in the zone (the delivery spreads over the
 * zone's regions): with all of it bombed out, the wing has no work (design §3.5).
 */
function zoneStillBombable(air: WwAir, w: Wing, side: number): boolean {
  if (w.mission === M_PORT || WW_BOMB_CLASSES[w.cls] === "auto") return true;
  const land = air.land;
  const sc = air.ww.scenario;
  const s = sc.sr(w.target !== 0 ? sc.targetSr(w.target) : w.sr);
  if (s === undefined) return false;
  for (let i = 0; i < s.members.length; i++) {
    const r = s.members[i];
    if (!isEnemyOfSide(air, side, land.controller[r] ?? 0)) continue;
    const oil = (sc.region(r)?.res[OIL] ?? 0) > 0;
    if (
      tableWeight(air.econ, r, bombTableOf(WW_BOMB_CLASSES[w.cls], oil)) > 0
    ) {
      return true;
    }
  }
  return false;
}

/** The target of a bombing order, or for a whole-zone order its first region with something to hit. */
function bombTarget(air: WwAir, w: Wing, side: number): number {
  if (!zoneStillBombable(air, w, side)) return 0;
  if (w.target !== 0) {
    return bombTargetOk(air, w, side, w.target) ? w.target : 0;
  }
  const s = air.ww.scenario.sr(w.sr);
  if (s === undefined) return 0;
  for (let i = 0; i < s.members.length; i++) {
    if (bombTargetOk(air, w, side, s.members[i])) return s.members[i];
  }
  return 0;
}

/**
 * The sea zone of `s` (or just its `only`) where `side` may strike a fleet:
 * spotted, or in battle; 0 none. A whole-zone order flies to the first of
 * them: the delivery strikes the sea zone it was sent to (lane C's navalRun).
 */
function fleetZone(
  air: WwAir,
  s: StrategicRegion,
  side: number,
  only: number,
): number {
  const navy = air.navy;
  for (let i = 0; i < s.members.length; i++) {
    const zone = s.members[i];
    if (only !== 0 && zone !== only) continue;
    if (navy.battles.has(zone)) return zone;
    for (const id of navy.fleetsIn(zone)) {
      const f = navy.fleets.get(id);
      if (f === undefined || f.docked !== 0) continue;
      if (isEnemyOfSide(air, side, f.owner) && navy.spotted(side, id)) {
        return zone;
      }
    }
  }
  return 0;
}

/** One of the side's regions in the zone lacks supply (a band it is taking counts). */
function supplyWanted(air: WwAir, s: StrategicRegion, side: number): boolean {
  const land = air.land;
  const rows = air.zoneState[s.idx].airSupply;
  for (let i = 0; i < s.members.length; i++) {
    const r = s.members[i];
    const c = land.controller[r] ?? 0;
    const taker = land.bandTaker[r] ?? 0;
    if (
      !(c !== 0 && land.sideOf(c) === side) &&
      !(taker !== 0 && land.sideOf(taker) === side)
    ) {
      continue;
    }
    let had = 0;
    for (let k = 0; k < rows.length; k++) {
      if (rows[k][0] === r && rows[k][1] === side) had = rows[k][2];
    }
    if (land.useMilli[r] > Math.max(0, land.supplyMilli[r] - had)) return true;
  }
  return false;
}

/**
 * The sortie's target if the standing order has work now, else 0 (design
 * §3.5: a wing with no work stays on the ground and burns no fuel).
 */
function sortieTarget(air: WwAir, w: Wing, side: number): number {
  const sc = air.ww.scenario;
  switch (w.mission) {
    case M_SUP:
      return enemySides(air, side).length > 0 ? orderedTarget(air, w) : 0;
    case M_PATROL:
    case M_RECON:
      return orderedTarget(air, w);
    case M_CAS:
      return w.follow !== 0
        ? armyBattle(air, w.follow)
        : pickBattle(air, side, w.sr, w.target);
    case M_BOMB:
    case M_PORT:
      return bombTarget(air, w, side);
    case M_STRIKE: {
      const s = sc.sr(w.target !== 0 ? sc.targetSr(w.target) : w.sr);
      if (s === undefined || s.kind !== "sea") return 0;
      return fleetZone(air, s, side, w.target);
    }
    case M_SUPPLY: {
      const a = w.follow !== 0 ? air.land.armies.get(w.follow) : undefined;
      const t =
        a !== undefined ? air.land.armyRegion(a) : orderedTarget(air, w);
      const s = sc.sr(sc.targetSr(t));
      return s !== undefined && supplyWanted(air, s, side) ? t : 0;
    }
    case M_INT:
      return w.hit;
    default:
      return 0;
  }
}

/** A carrier wing's record mirrors its deck; false when its carrier doesn't fly today. */
function syncDeck(air: WwAir, w: Wing): boolean {
  const deck = carrierWingDeck(air, w);
  if (deck === null) return false;
  const deckD = carrierWingDeckD(air, w);
  let same = sameCounts(deck, w.counts);
  for (let s = 0; same && s < w.dcounts.length; s++) {
    if (w.dcounts[s] !== (deckD?.[s] ?? 0)) same = false;
  }
  if (!same) {
    w.counts = [...deck];
    if (deckD !== null) w.dcounts = [...deckD];
    else w.dcounts.fill(0);
    air.markWing(w.id);
  }
  return true;
}

// ---- The cycle (design §3.5) ----

/** Every tick: the wings whose `until` came, through their phases (design §3.5). */
export function stepWings(air: WwAir, tick: number): void {
  refreshWar(air);
  const sc = air.ww.scenario;
  const day = air.ww.day(tick);
  const parity = tick % AIR_PULSE_TICKS;
  clearRosters(air.zoneState.length);
  const wings = air.wingArray();
  for (let k = 0; k < wings.length; k++) {
    const w = wings[k];
    if (w.until <= tick && (w.phase !== WP_GROUND || w.mission >= 0)) {
      stepWing(air, w, tick, day);
    }
    if (w.phase !== WP_STATION) continue;
    if (w.flyMission === M_PATROL || w.flyMission === M_RECON) {
      accrueStation(air, w, tick);
    }
    // One walk over the wings a tick: the pulse right after reads these.
    if (w.flyMilli > 0) {
      const i = sc.srIdxOf(w.flySr);
      if (i >= 0 && i % AIR_PULSE_TICKS === parity) rosters[i].push(w);
    }
  }
  rosterTick = tick;
  rosterAir = air;
}

function stepWing(air: WwAir, w: Wing, tick: number, day: number): void {
  switch (w.phase) {
    case WP_GROUND:
      takeOff(air, w, tick, day);
      return;
    case WP_OUT:
      arrive(air, w, tick);
      return;
    case WP_STATION:
      leaveStation(air, w, tick, day);
      return;
    case WP_BACK:
      land(air, w, tick);
      return;
    case WP_FERRY:
      // A ferry's `until` already holds its rest (lane A's WING_FERRY_REST).
      w.hit = 0;
      w.phase = WP_GROUND;
      takeOff(air, w, tick, day);
      return;
    case WP_REARM:
      w.phase = WP_GROUND;
      takeOff(air, w, tick, day);
      return;
  }
}

/** On the ground with an order: flies if there's work, else looks again in a few ticks. */
function takeOff(air: WwAir, w: Wing, tick: number, day: number): void {
  const m = w.mission;
  if (m < 0) return;
  // An escort leaves with its bomber (launchEscorts); it only checks it's still there.
  if (m === M_ESCORT) {
    if (air.wings.has(w.escortOf)) w.until = tick + WING_GROUND_RECHECK_TICKS;
    else clearOrder(air, w);
    return;
  }
  // An interceptor waits for a scramble (alertGuards), no rechecks.
  if (m === M_INT && w.hit === 0) return;
  if (w.follow !== 0 && !air.land.armies.has(w.follow)) {
    air.message(w.owner, "events_display.ww1936_wing_army_gone", {
      wing: w.id,
    });
    clearOrder(air, w);
    return;
  }
  if (!launchSortie(air, w, tick, day)) {
    if (m === M_INT) w.hit = 0;
    w.until = tick + WING_GROUND_RECHECK_TICKS;
  }
}

function launchSortie(air: WwAir, w: Wing, tick: number, day: number): boolean {
  const carrier = isCarrierWing(w);
  if (carrier ? !syncDeck(air, w) : w.base <= 0) return false;
  const planes = wingPlanes(w);
  if (planes <= 0) return false;
  if (!carrier && wingUnderStrength(AIR_TYPES[w.type], planes)) {
    if (w.noticeDay < 0 || day - w.noticeDay >= WING_NOTICE_DAYS) {
      w.noticeDay = day;
      air.message(w.owner, "events_display.ww1936_wing_understrength", {
        wing: w.id,
        type: w.type,
      });
    }
    return false;
  }
  const side = wingSide(air, w);
  const hit = sortieTarget(air, w, side);
  if (hit === 0) return false;
  const sc = air.ww.scenario;
  const st = wingStats(air, w);
  let leg = 1;
  if (!carrier) {
    const km = sc.targetKm(w.base, hit);
    if (km > st.rangeKm) {
      // A followed army outran its wing: forward to a free base (design §4.1).
      if (w.follow !== 0) moveUpToArmy(air, w, side, hit, planes, tick, day);
      return false;
    }
    leg = legTicks(km, st.speedKmh);
  }
  const sr = sc.targetSr(hit);
  if (!launch(air, w, side, hit, sr, leg, tick + leg, tick, day)) return false;
  if (w.follow !== 0 && w.sr !== sr) air.setWingZone(w, sr);
  if (isBombing(w.mission)) launchEscorts(air, w, tick, day);
  alertGuards(air, side, sr, w.until, tick);
  return true;
}

/**
 * Puts the wing in the air on its standing order: flyMilli and the fuel at
 * take-off, a schedule row for the screens. False when nothing would fly
 * (no fuel, a base bombed out).
 */
function launch(
  air: WwAir,
  w: Wing,
  side: number,
  hit: number,
  sr: number,
  leg: number,
  arrival: number,
  tick: number,
  day: number,
): boolean {
  const ce = air.econ.country(w.owner);
  const idx = air.ww.scenario.srIdxOf(sr);
  if (ce === null || idx < 0) return false;
  const m = w.mission;
  const dmg = Math.min(1000, air.baseDamagePm(w.base));
  const sup = isShooter(m) ? null : (air.zoneState[idx].sup.get(side) ?? 0);
  const eff = effWith(
    ce.stats.sortieEffPct,
    sortieEffPm(
      WEATHER_SORTIE_PM[zoneWeather(air, sr, day)],
      ce.fuelRatioPm,
      1000,
      dmg,
      sup,
    ),
  );
  const planes = wingPlanes(w);
  const flyMilli = Math.floor((planes * eff * wingBaseEffPm(air, w)) / 1000);
  if (flyMilli <= 0) return false;
  const cycle = WING_CYCLE[AIR_MISSIONS[m]];
  w.phase = WP_OUT;
  w.until = arrival;
  w.flyMilli = flyMilli;
  w.leg = leg;
  w.hit = hit;
  w.flySr = sr;
  w.flyMission = m;
  noteFuelUse(
    ce,
    sortieFuelMilli(
      flyMilli,
      wingStats(air, w).fuelPerSortieMilli,
      leg,
      cycle.station,
    ),
    2,
  );
  air.noteFlight([
    w.id,
    WP_OUT,
    arrival,
    leg,
    cycle.station,
    rearmTicks(cycle.rearm, dmg),
    hit,
    planes,
  ]);
  return true;
}

/** The wings escorting `bomber` leave with it: the same target, the same arrival. */
function launchEscorts(
  air: WwAir,
  bomber: Wing,
  tick: number,
  day: number,
): void {
  const sc = air.ww.scenario;
  for (const e of air.wingsOf(bomber.owner)) {
    if (e.mission !== M_ESCORT || e.escortOf !== bomber.id) continue;
    const ready =
      e.phase === WP_GROUND || (e.phase === WP_REARM && e.until <= tick);
    if (!ready || e.base <= 0) continue;
    const planes = wingPlanes(e);
    if (planes <= 0 || wingUnderStrength(AIR_TYPES[e.type], planes)) continue;
    if (sc.targetKm(e.base, bomber.hit) > wingStats(air, e).rangeKm) continue;
    launch(
      air,
      e,
      wingSide(air, e),
      bomber.hit,
      bomber.flySr,
      bomber.leg,
      bomber.until,
      tick,
      day,
    );
  }
}

/** The followed army's battle is out of reach: the nearest base with room that reaches it. */
function moveUpToArmy(
  air: WwAir,
  w: Wing,
  side: number,
  hit: number,
  planes: number,
  tick: number,
  day: number,
): void {
  if (w.lastFerryDay >= 0 && day - w.lastFerryDay < WING_AUTO_FERRY_DAYS)
    return;
  const sc = air.ww.scenario;
  const range = wingStats(air, w).rangeKm;
  for (const { base } of basesInRange(air, side, sc.targetSr(hit), range)) {
    if (base === w.base || sc.targetKm(base, hit) > range) continue;
    if (air.baseCapacity(base) - air.baseUse(base) < planes) continue;
    issueWingBase(
      air,
      w.owner,
      [w],
      { kind: "wing_base", wings: [w.id], base },
      tick,
    );
    return;
  }
}

function arrive(air: WwAir, w: Wing, tick: number): void {
  w.phase = WP_STATION;
  w.until = tick + WING_CYCLE[sortieOf(w)].station;
  // Close air support picks its battle on arrival (design §3.6).
  if (w.flyMission === M_CAS && !air.land.battles.has(w.hit)) {
    w.hit = pickBattle(air, wingSide(air, w), w.flySr, 0);
  }
}

function leaveStation(air: WwAir, w: Wing, tick: number, day: number): void {
  const m = w.flyMission;
  if (m === M_BOMB || m === M_PORT || m === M_STRIKE || m === M_SUPPLY) {
    if (w.flyMilli > 0 && wingPlanes(w) > 0) {
      const load = loadCenti(AIR_TYPES[w.type], AIR_MISSIONS[m]);
      const had = wingPlanes(w);
      // Land guns on the bombers here; ships' anti-air is inside the delivery.
      if (isBombing(m)) dropAntiAir(air, w, load, day);
      // The victim as the bombs fall: the delivery can't change who holds it.
      const victim = air.land.controller[w.hit] ?? 0;
      noteFlown(air, w, Math.floor((w.flyMilli * load) / 100));
      deliverSortie(air, w, load, tick);
      if (isBombing(m)) {
        noteRaidLost(
          air,
          w.owner,
          victim,
          w.hit,
          raidCls(w),
          had - wingPlanes(w),
        );
      }
      noteWingDelivery(air, w);
    }
  } else if (m === M_PATROL || m === M_RECON) {
    noteWingStation(air, w);
  }
  w.phase = WP_BACK;
  w.until = tick + w.leg;
}

/** The sortie's R; an escort keeps its bomber's (design §3.5). */
function rearmOf(air: WwAir, w: Wing): number {
  if (w.flyMission === M_ESCORT) {
    const b = air.wings.get(w.escortOf);
    if (b !== undefined && isBombing(b.mission)) {
      return WING_CYCLE[AIR_MISSIONS[b.mission]].rearm;
    }
  }
  return WING_CYCLE[sortieOf(w) ?? "air_superiority"].rearm;
}

function land(air: WwAir, w: Wing, tick: number): void {
  const rearm = rearmOf(air, w);
  rearmWing(air, w, tick);
  w.phase = WP_REARM;
  w.until = tick + rearmTicks(rearm, Math.min(1000, air.baseDamagePm(w.base)));
  w.hit = 0;
  w.flySr = 0;
  w.flyMission = WING_NO_MISSION;
}

/** Sends a wing on station or on its way out home now: a stand-down, or nothing left to intercept. */
function recall(air: WwAir, w: Wing, tick: number): void {
  const back =
    w.phase === WP_OUT ? Math.max(1, w.leg - (w.until - tick)) : w.leg;
  const rearm = rearmOf(air, w);
  w.phase = WP_BACK;
  w.until = tick + back;
  air.noteFlight([
    w.id,
    WP_BACK,
    w.until,
    back,
    0,
    rearmTicks(rearm, Math.min(1000, air.baseDamagePm(w.base))),
    w.hit,
    wingPlanes(w),
  ]);
}

/** Back to no order. */
function clearOrder(air: WwAir, w: Wing): void {
  w.mission = WING_NO_MISSION;
  w.target = 0;
  w.follow = 0;
  w.escortOf = 0;
  w.cls = 0;
  if (w.phase === WP_GROUND) w.hit = 0;
  air.setWingZone(w, 0);
  air.markWing(w.id);
}

// ---- Interception (design §3.7) ----

/**
 * An enemy of side `flyer` reaches zone `sr` at `arrival`: the interceptors
 * that guard it get their scramble. Under our radar within their range they
 * leave WW_RADAR_WARN_TICKS before it arrives. Over the zone they were
 * ordered to with no radar, WW_NO_RADAR_SCRAMBLE_TICKS after.
 */
function alertGuards(
  air: WwAir,
  flyer: number,
  sr: number,
  arrival: number,
  tick: number,
): void {
  gatherGuards(air, tick);
  if (guardSideCount === 0) return;
  const sc = air.ww.scenario;
  let center = -1;
  for (let k = 0; k < guardSideCount; k++) {
    const side = guardSides[k];
    if (!sidesFight(air, side, flyer)) continue;
    const radar = radarAt(air, side, sr) > 0;
    const list = guardLists[k];
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      const named = g.sr === sr;
      if (!radar && !named) continue;
      if (g.phase !== WP_GROUND || g.hit !== 0 || g.mission !== M_INT) continue;
      let hit = g.target;
      if (!named || hit === 0) {
        if (center < 0) center = zoneTarget(air, sr);
        hit = center;
      }
      if (hit === 0 || sc.targetKm(g.base, hit) > wingStats(air, g).rangeKm) {
        continue;
      }
      g.hit = hit;
      g.until = radar
        ? Math.max(tick, arrival - WW_RADAR_WARN_TICKS)
        : arrival + WW_NO_RADAR_SCRAMBLE_TICKS;
    }
  }
}

// ---- Losses ----

/** Today's result row of a country: [shotDown, lost, casHits, bombPoints, navalDamage]. */
function resultRow(t: ZoneToday, owner: number): number[] {
  let row = t.result.get(owner);
  if (row === undefined) t.result.set(owner, (row = [0, 0, 0, 0, 0]));
  return row;
}

/**
 * `milli` planes lost: they join the wing's remainder, and whole planes go,
 * the oldest first, through WwAir.shootDown. Returns the planes taken.
 */
function takeLoss(
  air: WwAir,
  w: Wing,
  milli: number,
  by: number,
  t: ZoneToday,
  day: number,
): number {
  const depth = air.ww.depth;
  w.lossRest += Math.floor(
    (milli * planesLossBp(depth, w.owner, w.counts, w.dcounts)) / 10_000,
  );
  const whole = Math.floor(w.lossRest / 1000);
  if (whole <= 0) return 0;
  const out = oldestFirst(
    depth,
    w.owner,
    AIR_TYPES[w.type],
    w.counts,
    w.dcounts,
    whole,
  );
  const n = air.shootDown(
    w.id,
    out.slots === null ? out.gens : [...out.gens, ...out.slots],
    by,
  );
  if (n <= 0) return 0;
  w.lossRest -= n * 1000;
  if (wingPlanes(w) === 0) {
    w.lossRest = 0;
    w.flyMilli = 0;
  }
  if (isCarrierWing(w)) takeOffDeck(air, w, out.gens, out.slots);
  air.planesLostTotal += n;
  resultRow(t, w.owner)[1] += n;
  if (by > 0) resultRow(t, by)[0] += n;
  const slot = ((day % 30) + 30) % 30;
  const own = air.country(w.owner);
  if (own !== null) own.tally[1][slot] += n;
  const killer = by > 0 ? air.country(by) : null;
  if (killer !== null) killer.tally[0][slot] += n;
  return n;
}

/**
 * The land anti-air on a bombing run or port strike (design §3.6): the
 * target's guns on the whole load, at the moment of the drop. Ships' anti-air
 * stays in the strike itself (lane C).
 */
function dropAntiAir(air: WwAir, w: Wing, load: number, day: number): number {
  const r = w.hit;
  const sc = air.ww.scenario;
  if (sc.region(r) === undefined) return 0;
  const ctl = air.land.controller[r] ?? 0;
  if (!isEnemyOfSide(air, wingSide(air, w), ctl)) return 0;
  if (w.flyMission === M_PORT && !navalPort(air.ww, r)) return 0;
  const pm = withFuze(
    air.ww.depth,
    ctl,
    aaLossPm(
      effectiveLevel(air.econ, r, "anti_air"),
      0,
      air.econ.country(ctl)?.stats.aaPct ?? 0,
      false,
    ),
  );
  if (pm <= 0) return 0;
  let milli = Math.floor((Math.floor((w.flyMilli * load) / 100) * pm) / 1000);
  // P6 (spec §15.3): the guns hit night raiders half as often.
  if (w.night) {
    milli = Math.floor((milli * nightMods(air.ww.depth, w.id).lossBp) / 10_000);
  }
  const i = sc.srIdxOf(w.flySr);
  return i < 0 ? 0 : takeLoss(air, w, milli, ctl, air.zoneState[i].today, day);
}

function addTo(m: Map<number, number>, k: number, v: number): void {
  if (v !== 0) m.set(k, (m.get(k) ?? 0) + v);
}

/** Sorties flown over the zone today: by side and type for the screens, by owner and mission for the doctrine. */
function addFlown(t: ZoneToday, side: number, w: Wing, milli: number): void {
  if (milli <= 0) return;
  let row = t.sorties.get(side);
  if (row === undefined) t.sorties.set(side, (row = AIR_TYPES.map(() => 0)));
  row[w.type] += milli;
  addTo(t.flown, w.owner * FLOWN_KEY + w.flyMission, milli);
}

function noteFlown(air: WwAir, w: Wing, milli: number): void {
  const i = air.ww.scenario.srIdxOf(w.flySr);
  if (i >= 0) addFlown(air.zoneState[i].today, wingSide(air, w), w, milli);
}

// ---- The pulse (design §3.6, §3.8): reused buffers, one sum per side ----

interface Slot {
  key: number;
  /** Wings on station. */
  flyers: number;
  /** The superiority score's target this pulse. */
  now: number;
  score: number;
  supPm: number;
  // As shooters.
  atk: number;
  kp: number;
  agi: number;
  supMilli: number;
  intMilli: number;
  det: number;
  lead: number;
  leadKp: number;
  // As targets: fighters and the rest, sorties, × defense, × agility.
  xF: number;
  dF: number;
  aF: number;
  xO: number;
  dO: number;
  aO: number;
  /** Sweeping fighters, escorts and bombers on station, flyMilli. */
  cover: number;
  escorts: number;
  bombers: number;
  /** This pulse: its weighted sorties under the shooter being worked out. */
  mass: number;
  /** It met an enemy this pulse. */
  met: boolean;
  /** Planes it lost, and planes credited to its shooters. */
  lost: number;
  kills: number;
}

const slotPool: Slot[] = [];
/** The pulse's sides, ascending. */
const slots: Slot[] = [];

function freshSlot(key: number): Slot {
  const s = slotPool.pop();
  if (s === undefined) {
    return {
      key,
      flyers: 0,
      now: 0,
      score: 0,
      supPm: 0,
      atk: 0,
      kp: 0,
      agi: 0,
      supMilli: 0,
      intMilli: 0,
      det: 0,
      lead: 0,
      leadKp: -1,
      xF: 0,
      dF: 0,
      aF: 0,
      xO: 0,
      dO: 0,
      aO: 0,
      cover: 0,
      escorts: 0,
      bombers: 0,
      mass: 0,
      met: false,
      lost: 0,
      kills: 0,
    };
  }
  s.key = key;
  s.flyers = 0;
  s.now = 0;
  s.score = 0;
  s.supPm = 0;
  s.atk = 0;
  s.kp = 0;
  s.agi = 0;
  s.supMilli = 0;
  s.intMilli = 0;
  s.det = 0;
  s.lead = 0;
  s.leadKp = -1;
  s.xF = 0;
  s.dF = 0;
  s.aF = 0;
  s.xO = 0;
  s.dO = 0;
  s.aO = 0;
  s.cover = 0;
  s.escorts = 0;
  s.bombers = 0;
  s.mass = 0;
  s.met = false;
  s.lost = 0;
  s.kills = 0;
  return s;
}

function slotFor(key: number): Slot {
  let i = 0;
  for (; i < slots.length; i++) {
    const k = slots[i].key;
    if (k === key) return slots[i];
    if (k > key) break;
  }
  const s = freshSlot(key);
  slots.splice(i, 0, s);
  return s;
}

function releaseSlots(): void {
  for (let i = 0; i < slots.length; i++) slotPool.push(slots[i]);
  slots.length = 0;
}

/** The wings on station per zone this tick (only the zones that pulse). */
const rosters: Wing[][] = [];
/** What stepWings gathered for the pulse of that tick; −1 after it's read. */
let rosterTick = -1;
let rosterAir: WwAir | null = null;

function clearRosters(n: number): void {
  while (rosters.length < n) rosters.push([]);
  for (let i = 0; i < rosters.length; i++) rosters[i].length = 0;
}

// Per roster position.
let rCap = 128;
const rSlot: Slot[] = [];
const rCause: (Slot | null)[] = [];
let pMilli = new Float64Array(rCap);
let pKp = new Float64Array(rCap);
let pPend = new Float64Array(rCap);
let pTop = new Float64Array(rCap);
let pBy = new Int32Array(rCap);
let pKills = new Int32Array(rCap);
const shooterIds: number[] = [];

function growTo(n: number): void {
  if (n <= rCap) return;
  while (rCap < n) rCap *= 2;
  pMilli = new Float64Array(rCap);
  pKp = new Float64Array(rCap);
  pPend = new Float64Array(rCap);
  pTop = new Float64Array(rCap);
  pBy = new Int32Array(rCap);
  pKills = new Int32Array(rCap);
}

function addPend(i: number, milli: number, by: number, cause: Slot | null) {
  if (milli <= 0) return;
  pPend[i] += milli;
  if (milli > pTop[i]) {
    pTop[i] = milli;
    pBy[i] = by;
    rCause[i] = cause;
  }
}

/** Every tick: the zones whose idx % AIR_PULSE_TICKS matches (design §3.6, §3.8). */
export function pulseZones(air: WwAir, tick: number): void {
  refreshWar(air);
  const zones = air.zoneState;
  const n = zones.length;
  const parity = tick % AIR_PULSE_TICKS;
  const sc = air.ww.scenario;
  if (rosterTick !== tick || rosterAir !== air) {
    clearRosters(n);
    for (const w of air.wings.values()) {
      if (w.phase !== WP_STATION || w.flyMilli <= 0) continue;
      const i = sc.srIdxOf(w.flySr);
      if (i >= 0 && i % AIR_PULSE_TICKS === parity) rosters[i].push(w);
    }
  }
  rosterTick = -1;
  const list = sc.strategicList();
  const day = air.ww.day(tick);
  for (let i = parity; i < n; i += AIR_PULSE_TICKS) {
    const roster = rosters[i];
    const z = zones[i];
    if (roster.length === 0 && z.score.size === 0) continue;
    pulseZone(air, z, list[i], roster, tick, day);
    roster.length = 0;
  }
}

function pulseZone(
  air: WwAir,
  z: ZoneAirState,
  s: StrategicRegion,
  roster: readonly Wing[],
  tick: number,
  day: number,
): void {
  const n = roster.length;
  growTo(n);
  for (const k of z.score.keys()) slotFor(k);
  const t = z.today;
  for (let i = 0; i < n; i++) gatherWing(air, roster[i], i, t);
  fightAll(air, s, roster, day);
  casAndAntiAir(air, z, s, roster);
  settleLosses(air, roster, t, day);
  shareKills(air, s, roster, tick, day);
  skyOverZone(air, z, s, roster, day);
  if (n > 0) afterPulse(air, s, roster, tick);
  releaseSlots();
}

/** One wing into the pulse's sums. */
function gatherWing(air: WwAir, w: Wing, i: number, t: ZoneToday): void {
  const m = w.flyMission;
  const sl = slotFor(wingSide(air, w));
  const st = wingStats(air, w);
  const pm = pulseOf(w);
  rSlot[i] = sl;
  rCause[i] = null;
  pMilli[i] = pm;
  pKp[i] = 0;
  pPend[i] = 0;
  pTop[i] = 0;
  pBy[i] = 0;
  pKills[i] = 0;
  sl.flyers++;
  if (FIGHTER[w.type]) {
    sl.xF += pm;
    sl.dF += pm * st.airDef;
    sl.aF += pm * st.agility;
  } else {
    sl.xO += pm;
    sl.dO += pm * st.airDef;
    sl.aO += pm * st.agility;
  }
  let score = Math.floor((w.flyMilli * st.supWeightMilli) / 1000);
  if (isShooter(m)) {
    const ce = air.econ.country(w.owner);
    const kp = Math.floor((pm * st.airAtk) / 1000);
    pKp[i] = kp;
    sl.atk += pm;
    sl.kp += kp;
    sl.agi += pm * st.agility;
    sl.det = Math.max(sl.det, ce?.stats.airDetectPct ?? 0);
    if (kp > sl.leadKp) {
      sl.leadKp = kp;
      sl.lead = w.owner;
    }
    if (m === M_INT) {
      sl.intMilli += pm;
      // Spec §14.5: half its weight, + interceptShareBp, at most whole.
      const bp = Math.min(10_000, 5_000 + (ce?.stats.interceptShareBp ?? 0));
      score = Math.floor((score * bp) / 10_000);
    } else {
      sl.supMilli += pm;
      if (m === M_SUP) {
        sl.cover += w.flyMilli;
        addTo(t.fightersSup, w.owner, pm);
      } else {
        sl.escorts += w.flyMilli;
      }
    }
  } else if (isBombing(m)) {
    sl.bombers += w.flyMilli;
  }
  sl.now += score;
  // A delivery counts its sorties when it drops; a station as it flies.
  if (m !== M_BOMB && m !== M_PORT && m !== M_STRIKE && m !== M_SUPPLY) {
    addFlown(t, sl.key, w, pm);
  }
}

/** Every shooting side against every side at war with it there (design §3.6). */
function fightAll(
  air: WwAir,
  s: StrategicRegion,
  roster: readonly Wing[],
  day: number,
): void {
  let luck = -1;
  for (let a = 0; a < slots.length; a++) {
    const A = slots[a];
    if (A.atk <= 0) continue;
    // Spec §14.3: the target weights; a mix of the two missions mixes them.
    const supPct = Math.floor((A.supMilli * 100) / (A.supMilli + A.intMilli));
    const wF = Math.floor(
      (supPct * W_SUP_FIGHTER + (100 - supPct) * W_INT_FIGHTER) / 100,
    );
    const wO = Math.floor(
      (supPct * W_SUP_OTHER + (100 - supPct) * W_INT_OTHER) / 100,
    );
    let allMass = 0;
    let enemies = 0;
    for (let b = 0; b < slots.length; b++) {
      const B = slots[b];
      B.mass = 0;
      if (B === A || B.flyers === 0 || !sidesFight(air, A.key, B.key)) continue;
      B.mass = Math.floor((B.xF * wF + B.xO * wO) / 100);
      if (B.mass > 0) {
        allMass += B.mass;
        enemies++;
      }
    }
    if (allMass === 0) continue;
    A.met = true;
    const det = detectionPm(
      radarAt(air, A.key, s.id),
      ownLandIn(air, s, A.key),
      A.det,
      0,
    );
    if (luck < 0) luck = airLuckPm(air.ww.politics.seed, s.id, day);
    for (let b = 0; b < slots.length; b++) {
      const B = slots[b];
      if (B.mass <= 0) continue;
      let loss = duelSumsMilli(
        A.atk,
        A.kp,
        A.agi,
        B.xF * wF + B.xO * wO,
        B.dF * wF + B.dO * wO,
        B.aF * wF + B.aO * wO,
        det,
      );
      if (enemies > 1) {
        loss = Math.floor(
          (loss * Math.floor((B.mass * 1000) / allMass)) / 1000,
        );
      }
      loss = Math.floor((loss * luck) / 1000);
      if (loss > 0) spreadLoss(air, roster, A, B, wF, wO, loss);
    }
  }
}

function ownLandIn(air: WwAir, s: StrategicRegion, side: number): boolean {
  if (s.kind !== "land") return false;
  const land = air.land;
  for (let i = 0; i < s.members.length; i++) {
    const c = land.controller[s.members[i]] ?? 0;
    if (c !== 0 && land.sideOf(c) === side) return true;
  }
  return false;
}

/**
 * A duel's losses over the target side's wings by weight (a running share, so
 * no sort and no array, and the shares add up exactly), then each wing's own
 * cuts: airLossCutPct, the night, the escort, its experience.
 */
function spreadLoss(
  air: WwAir,
  roster: readonly Wing[],
  A: Slot,
  B: Slot,
  wF: number,
  wO: number,
  loss: number,
): void {
  const n = roster.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (rSlot[i] !== B) continue;
    total += Math.floor(
      (pMilli[i] * (FIGHTER[roster[i].type] ? wF : wO)) / 100,
    );
  }
  if (total <= 0) return;
  let cum = 0;
  let given = 0;
  for (let i = 0; i < n; i++) {
    if (rSlot[i] !== B) continue;
    const w = roster[i];
    cum += Math.floor((pMilli[i] * (FIGHTER[w.type] ? wF : wO)) / 100);
    const upto = Math.floor((loss * cum) / total);
    const part = upto - given;
    given = upto;
    if (part <= 0) continue;
    const cut = air.econ.country(w.owner)?.stats.airLossCutPct ?? 0;
    let milli = Math.floor((part * (100 - Math.min(100, cut))) / 100);
    const m = w.flyMission;
    if (m === M_BOMB && w.night) {
      milli = Math.floor(
        (milli * nightMods(air.ww.depth, w.id, shootersOf(roster, A)).lossBp) /
          10_000,
      );
    }
    if (isBombing(m)) {
      milli = Math.floor(
        (milli * escortKeepPm(B.cover, directEscort(roster, B, w), B.bombers)) /
          1000,
      );
    }
    milli = Math.floor((milli * wingXpLossPm(w.xpMilli)) / 1000);
    addPend(i, milli, A.lead, A);
  }
}

function shootersOf(roster: readonly Wing[], A: Slot): readonly number[] {
  shooterIds.length = 0;
  for (let i = 0; i < roster.length; i++) {
    if (rSlot[i] === A && pKp[i] > 0) shooterIds.push(roster[i].id);
  }
  return shooterIds;
}

function directEscort(roster: readonly Wing[], B: Slot, bomber: Wing): number {
  if (B.escorts <= 0) return 0;
  let milli = 0;
  for (let i = 0; i < roster.length; i++) {
    const e = roster[i];
    if (
      rSlot[i] === B &&
      e.flyMission === M_ESCORT &&
      e.escortOf === bomber.id
    ) {
      milli += e.flyMilli;
    }
  }
  return milli;
}

/**
 * Close air support: each wing's hits on its battle (the sum by battle and
 * side is the state the land war reads) and the battle's anti-air on it.
 */
function casAndAntiAir(
  air: WwAir,
  z: ZoneAirState,
  s: StrategicRegion,
  roster: readonly Wing[],
): void {
  const rows = z.casNow;
  for (let k = 0; k < rows.length; k++) rows[k][2] = 0;
  const land = air.land;
  let aaRegion = 0;
  let aaSide = 0;
  let aaPm = 0;
  let aaBy = 0;
  for (let i = 0; i < roster.length; i++) {
    const w = roster[i];
    if (w.flyMission !== M_CAS) continue;
    const side = rSlot[i].key;
    if (!land.battles.has(w.hit)) w.hit = pickBattle(air, side, s.id, 0);
    const b = land.battles.get(w.hit);
    if (b === undefined) continue;
    const weAttack = land.sideOf(b.attLead) === side;
    if (!weAttack && land.sideOf(b.defLead) !== side) continue;
    const ce = air.econ.country(w.owner);
    const st = wingStats(air, w);
    const pct = ce?.stats.casPct ?? 0;
    const hits = Math.floor(
      (casTickCenti(w.flyMilli, st.ground, pct, AIR_TYPES[w.type]) *
        wingXpLoadPm(w.xpMilli)) /
        1000,
    );
    if (hits > 0) addCasNow(rows, w.hit, side, hits);
    if (b.region !== aaRegion || side !== aaSide) {
      aaRegion = b.region;
      aaSide = side;
      aaBy = weAttack ? b.defLead : b.attLead;
      let enemyAa = 0;
      const t = land.divisions;
      const line = weAttack ? b.defLine : b.attLine;
      for (let k = 0; k < line.length; k++) {
        const row = t.rowOf(line[k]);
        if (row >= 0) enemyAa += land.baseStatsOf(row).airAtk;
      }
      // The region's guns fire on us where we attack (its controller defends).
      const guns = weAttack
        ? effectiveLevel(air.econ, b.region, "anti_air")
        : 0;
      aaPm = withFuze(
        air.ww.depth,
        aaBy,
        aaLossPm(guns, enemyAa, air.econ.country(aaBy)?.stats.aaPct ?? 0, true),
      );
    }
    addPend(i, Math.floor((pMilli[i] * aaPm) / 1000), aaBy, null);
    resultRow(z.today, w.owner)[2] += casPoolCenti(pMilli[i], st.ground, pct);
    noteWingCas(air, w);
  }
  for (let k = rows.length - 1; k >= 0; k--) {
    if (rows[k][2] === 0) rows.splice(k, 1);
  }
}

function addCasNow(
  rows: [number, number, number][],
  region: number,
  side: number,
  hits: number,
): void {
  let at = rows.length;
  for (let k = 0; k < rows.length; k++) {
    const e = rows[k];
    if (e[0] === region && e[1] === side) {
      e[2] += hits;
      return;
    }
    if (
      at === rows.length &&
      (e[0] > region || (e[0] === region && e[1] > side))
    ) {
      at = k;
    }
  }
  rows.splice(at, 0, [region, side, hits]);
}

/** The pulse's losses all at once (spec §14.3): flyMilli is fixed, so the order inside it can't matter. */
function settleLosses(
  air: WwAir,
  roster: readonly Wing[],
  t: ZoneToday,
  day: number,
): void {
  for (let i = 0; i < roster.length; i++) {
    if (pPend[i] <= 0) continue;
    const w = roster[i];
    const n = takeLoss(air, w, pPend[i], pBy[i], t, day);
    if (n <= 0) continue;
    rSlot[i].lost += n;
    const by = rCause[i];
    if (by !== null) by.kills += n;
    // A raid's losses on station go on its report.
    if (isBombing(w.flyMission)) {
      const victim = air.land.controller[w.hit] ?? 0;
      noteRaidLost(air, w.owner, victim, w.hit, raidCls(w), n);
    }
  }
}

/**
 * The side's kills to its shooting wings, each drawn by kill power (one
 * stateless roll a plane, so a small wing gets its share over time and the
 * wings' counts add up to the planes that fell). Then what they learned.
 */
function shareKills(
  air: WwAir,
  s: StrategicRegion,
  roster: readonly Wing[],
  tick: number,
  day: number,
): void {
  const seed = air.ww.politics.seed;
  for (let a = 0; a < slots.length; a++) {
    const A = slots[a];
    if (A.kills > 0 && A.kp > 0) {
      for (let k = 0; k < A.kills; k++) {
        let roll =
          wwRoll(seed, P_AIR_KILL, s.id, tick, A.key * 4096 + k) % A.kp;
        for (let i = 0; i < roster.length; i++) {
          if (rSlot[i] !== A || pKp[i] <= 0) continue;
          roll -= pKp[i];
          if (roll < 0) {
            pKills[i]++;
            break;
          }
        }
      }
    }
    if (A.lost > 0) air.noteFight(s.id, A.key, A.lost);
  }
  for (let i = 0; i < roster.length; i++) {
    if (pKp[i] <= 0 || !rSlot[i].met) continue;
    const w = roster[i];
    const k = pKills[i];
    if (k > 0) {
      w.kills += k;
      w.dayKills += k;
      air.markWing(w.id);
    }
    noteWingFight(air, w, k, day);
  }
}

// ---- The sky over a zone (design §3.8) ----

/** A key-ordered map write: an existing key in place, a new one rebuilds it. */
function setSorted(m: Map<number, number>, k: number, v: number): void {
  if (m.has(k)) {
    m.set(k, v);
    return;
  }
  const rows = [...m, [k, v] as [number, number]].sort((a, b) => a[0] - b[0]);
  m.clear();
  for (const [x, y] of rows) m.set(x, y);
}

// The enemy-superiority table being worked out, by side key.
const esKey: number[] = [];
const esVal: number[] = [];
const esPp: number[] = [];

/** Writes (keys ascending) into a key-ordered map, dropping zeros. True when its keys changed. */
function syncSorted(
  m: Map<number, number>,
  keys: readonly number[],
  vals: readonly number[],
  n: number,
): boolean {
  let live = 0;
  let same = true;
  for (let i = 0; i < n; i++) {
    if (vals[i] === 0) continue;
    live++;
    if (!m.has(keys[i])) same = false;
  }
  if (same && live === m.size) {
    for (let i = 0; i < n; i++) if (vals[i] !== 0) m.set(keys[i], vals[i]);
    return false;
  }
  m.clear();
  for (let i = 0; i < n; i++) if (vals[i] !== 0) m.set(keys[i], vals[i]);
  return true;
}

/** Spec §14.6: the battlefield support of a side: the best of its members' doctrines. */
function sidePenaltyPp(air: WwAir, side: number): number {
  const members = air.land.sideMembers(side);
  let best = 0;
  for (let i = 0; i < members.length; i++) {
    const st = air.econ.country(members[i])?.stats;
    if (st === undefined) continue;
    best = Math.max(best, st.supPenaltyPp + st.enemyAirPenaltyPp);
  }
  return best;
}

/**
 * The score closes on what's over the zone now, the superiority follows, and
 * the worst enemy superiority per side (the land war's penalty reads it). The
 * screens hear when a side crosses a WW_AIR_VIEW_BAND_PM band (the close
 * tells them the rest); crossing 50% is the alert.
 */
function skyOverZone(
  air: WwAir,
  z: ZoneAirState,
  s: StrategicRegion,
  roster: readonly Wing[],
  day: number,
): void {
  for (let a = 0; a < slots.length; a++) {
    const A = slots[a];
    const old = z.score.get(A.key) ?? 0;
    let next = old + Math.trunc((A.now - old) / WW_AIR_SCORE_DIV);
    // The truncation stalls below the divisor: a dying score reaches 0.
    if (A.now === 0 && next < WW_AIR_SCORE_DIV) next = 0;
    A.score = next;
    if (next === old) continue;
    if (next === 0) z.score.delete(A.key);
    else setSorted(z.score, A.key, next);
  }
  let band = false;
  let crossed = false;
  for (let a = 0; a < slots.length; a++) {
    const A = slots[a];
    let enemies = 0;
    for (let b = 0; b < slots.length; b++) {
      const B = slots[b];
      if (B.score > 0 && sidesFight(air, A.key, B.key)) enemies += B.score;
    }
    A.supPm = airSupPm(A.score, enemies);
    const was = z.sup.get(A.key) ?? 0;
    if (
      Math.floor(was / WW_AIR_VIEW_BAND_PM) !==
      Math.floor(A.supPm / WW_AIR_VIEW_BAND_PM)
    ) {
      band = true;
    }
    if (was > 500 !== A.supPm > 500) crossed = true;
  }
  const before = crossed ? new Map(z.sup) : null;
  for (let a = 0; a < slots.length; a++) {
    const A = slots[a];
    if (A.supPm === 0) z.sup.delete(A.key);
    else setSorted(z.sup, A.key, A.supPm);
  }
  // Worst enemy superiority by side, for every side at war with a side flying here.
  let es = 0;
  for (let f = 0; f < slots.length; f++) {
    const F = slots[f];
    if (F.supPm <= 0) continue;
    const fp = sidePenaltyPp(air, F.key);
    const list = enemySides(air, F.key);
    for (let j = 0; j < list.length; j++) {
      const key = list[j].key;
      let at = 0;
      while (at < es && esKey[at] !== key) at++;
      if (at === es) {
        // Keys ascending as they come in.
        let k = es++;
        while (k > 0 && esKey[k - 1] > key) {
          esKey[k] = esKey[k - 1];
          esVal[k] = esVal[k - 1];
          esPp[k] = esPp[k - 1];
          k--;
        }
        esKey[k] = key;
        esVal[k] = F.supPm;
        esPp[k] = fp;
      } else if (
        F.supPm > esVal[at] ||
        (F.supPm === esVal[at] && fp > esPp[at])
      ) {
        esVal[at] = F.supPm;
        esPp[at] = fp;
      }
    }
  }
  if (syncSorted(z.enemySup, esKey, esVal, es)) band = true;
  syncSorted(z.enemyPp, esKey, esPp, es);
  if (band) air.markZone(s.idx);
  if (before !== null) {
    superiorityAlerts(air, z, s.id, day, before, z.sup, roster);
  }
}

/**
 * Interceptors with no enemy left go home after their least station. Every
 * second pulse, the enemies over the zone wake the interceptors that have
 * landed and rearmed since (the 4 ticks a grounded wing looks again).
 */
function afterPulse(
  air: WwAir,
  s: StrategicRegion,
  roster: readonly Wing[],
  tick: number,
): void {
  const station = WING_CYCLE.interception.station;
  for (let i = 0; i < roster.length; i++) {
    const w = roster[i];
    if (w.flyMission !== M_INT || rSlot[i].met) continue;
    if (tick - (w.until - station) >= WING_INTERCEPT_MIN_STATION) {
      recall(air, w, tick);
    }
  }
  if (Math.floor(tick / AIR_PULSE_TICKS) % 2 !== 0) return;
  for (let a = 0; a < slots.length; a++) {
    if (slots[a].flyers > 0) alertGuards(air, slots[a].key, s.id, tick, tick);
  }
}

// ---- The zone's close (design §3.8) ----

function zoneDayQuiet(z: ZoneAirState): boolean {
  const t = z.today;
  return (
    t.sorties.size === 0 &&
    t.result.size === 0 &&
    t.navalSearch.size === 0 &&
    t.navalAsw.size === 0 &&
    t.navalStrike.size === 0 &&
    t.fightersSup.size === 0 &&
    t.airSupply.length === 0 &&
    t.flown.size === 0 &&
    z.sorties.size === 0 &&
    z.result.size === 0 &&
    z.navalSearch.size === 0 &&
    z.navalAsw.size === 0 &&
    z.navalStrike.size === 0 &&
    z.fightersSup.size === 0 &&
    z.airSupply.length === 0
  );
}

/**
 * A zone's daily close (design §3.8): today's sums move to the fields the
 * others read. Recon stays in `today`: depth.airZoneDay
 * reads and clears it right after. The superiority alerts go out from the
 * pulse that crosses 50% (no state to compare a whole day against).
 */
export function closeAirZone(
  air: WwAir,
  sr: number,
  day: number,
  tick: number,
): void {
  void tick;
  const idx = air.ww.scenario.srIdxOf(sr);
  if (idx < 0) return;
  const z = air.zoneState[idx];
  pruneAlerts(z, day);
  const quiet = zoneDayQuiet(z);
  if (!quiet) {
    const t = z.today;
    if (t.flown.size > 0) {
      t.flown = new Map();
    }
    const sorties = new Map<number, number[]>();
    for (const [k, row] of [...t.sorties].sort((a, b) => a[0] - b[0])) {
      sorties.set(
        k,
        row.map((m) => Math.floor(m / 1000)),
      );
    }
    z.sorties = sorties;
    t.sorties = new Map();
    const result = new Map<number, number[]>();
    for (const [k, row] of [...t.result].sort((a, b) => a[0] - b[0])) {
      result.set(k, row);
    }
    z.result = result;
    t.result = new Map();
    z.navalSearch = sortedMap(t.navalSearch);
    z.navalAsw = sortedMap(t.navalAsw);
    z.navalStrike = sortedMap(t.navalStrike);
    z.fightersSup = sortedMap(t.fightersSup);
    t.navalSearch = new Map();
    t.navalAsw = new Map();
    t.navalStrike = new Map();
    t.fightersSup = new Map();
    z.airSupply = [...t.airSupply].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    t.airSupply = [];
  }
  if (!quiet || z.sup.size > 0) air.markZone(idx);
  // A human's flying wings get their card numbers (efficiency, leg) once a day.
  for (const id of air.wingsIn(sr)) {
    const w = air.wings.get(id);
    if (w !== undefined && w.flySr !== 0 && air.ww.isHumanControlled(w.owner)) {
      air.markWing(id);
    }
  }
}

// ---- wing_mission (design §3.3) ----

type MissionOrder = Extract<WingOrder, { kind: "wing_mission" }>;

function targetKindOf(air: WwAir, t: number): "land" | "sea" | "none" {
  if (t > SEA_ZONE_BASE) {
    return air.ww.scenario.zoneSr(t) !== 0 ? "sea" : "none";
  }
  return air.ww.scenario.region(t) !== undefined ? "land" : "none";
}

/** What the order's target comes to for this wing: the named region or sea zone, the army's or the bomber's. */
function askTarget(air: WwAir, order: MissionOrder): number {
  if (order.mission === "escort" && order.escort !== undefined) {
    const b = air.wings.get(order.escort);
    return b === undefined
      ? 0
      : b.target !== 0
        ? b.target
        : zoneTarget(air, b.sr);
  }
  if (order.army !== undefined) {
    const a = air.land.armies.get(order.army);
    return a === undefined ? 0 : air.land.armyRegion(a);
  }
  return order.target;
}

/** The same questions the wing card asks (WingRules.wingOrderBlock). */
function missionAsk(
  air: WwAir,
  smallID: number,
  w: Wing,
  order: MissionOrder,
  target: number,
): WingMissionAsk {
  const land = air.land;
  const sc = air.ww.scenario;
  const kind = targetKindOf(air, target);
  const side = wingSide(air, w);
  const ctl = kind === "land" ? (land.controller[target] ?? 0) : 0;
  const armyNamed = order.army !== undefined;
  const a = armyNamed ? land.armies.get(order.army!) : undefined;
  const b =
    order.escort !== undefined ? air.wings.get(order.escort) : undefined;
  const hasBase = w.base > 0;
  const cls =
    order.mission === "port_strike" ? "port" : (order.cls ?? ("auto" as const));
  return {
    order: "mission",
    type: AIR_TYPES[w.type],
    mission: order.mission,
    carrier: isCarrierWing(w),
    hasBase,
    standDown: order.target === 0 && !armyNamed && order.escort === undefined,
    targetKind: kind,
    ownLand: ctl !== 0 && land.sideOf(ctl) === side,
    enemyLand: isEnemyOfSide(air, side, ctl),
    armyOk: a !== undefined && a.owner === smallID,
    armyNamed,
    escortOk:
      b !== undefined &&
      b.id !== w.id &&
      b.owner === smallID &&
      isBombing(b.mission),
    escortNamed: order.escort !== undefined,
    bombable:
      kind === "land" &&
      bombClassHits(
        cls,
        (x) => air.econ.buildingArray(x)[target] ?? 0,
        (sc.region(target)?.res[OIL] ?? 0) > 0,
      ),
    km: hasBase && kind !== "none" ? sc.targetKm(w.base, target) : 0,
    rangeKm: wingStats(air, w).rangeKm,
  };
}

/** wing_mission (the sender's own wings, ascending, already checked): all of them, or none. */
export function issueWingMission(
  air: WwAir,
  smallID: number,
  wings: readonly Wing[],
  order: MissionOrder,
  tick: number,
): WwOrderBlock | null {
  const target = askTarget(air, order);
  for (const w of wings) {
    const block = wingOrderBlock(missionAsk(air, smallID, w, order, target));
    if (block !== null) return block;
  }
  const standDown =
    order.target === 0 &&
    order.army === undefined &&
    order.escort === undefined;
  for (const w of wings) {
    if (standDown) standDownWing(air, w, tick);
    else giveMission(air, w, order, target, tick);
  }
  return null;
}

/** Target 0 with no army or escort: no order, and home at once if it's in the air. */
function standDownWing(air: WwAir, w: Wing, tick: number): void {
  if (flying(w)) {
    recall(air, w, tick);
    w.flyMilli = 0;
  }
  clearOrder(air, w);
}

function giveMission(
  air: WwAir,
  w: Wing,
  order: MissionOrder,
  target: number,
  tick: number,
): void {
  const sc = air.ww.scenario;
  const m = AIR_MISSIONS.indexOf(order.mission);
  // Close air support and air supply follow an army; another mission takes its region now.
  const follows = order.army !== undefined && (m === M_CAS || m === M_SUPPLY);
  w.mission = m;
  w.follow = follows ? order.army! : 0;
  w.escortOf = m === M_ESCORT ? (order.escort ?? 0) : 0;
  w.target = follows || m === M_ESCORT ? 0 : target;
  w.cls =
    m === M_PORT ? CLS_PORT : bombClassIndex(order.cls ?? ("auto" as const));
  air.setWingZone(w, sc.targetSr(target));
  air.markWing(w.id);
  if (w.phase !== WP_GROUND) return;
  // The sortie in the air keeps flying as it was; a wing on the ground starts
  // its first cycle staggered, and a new order never makes it wait longer.
  w.hit = 0;
  const first = tick + wingStaggerTicks(w.id, AIR_TYPES[w.type], order.mission);
  w.until = w.until <= tick ? first : Math.min(w.until, first);
}

// ---- What the battle card reads ----

/** The wings on station giving `side` close air support in the battle of `region`. */
export function casWingsAt(air: WwAir, region: number, side: number): number {
  const sr = air.ww.scenario.regionSr(region);
  const ids = air.wingsIn(sr);
  let n = 0;
  for (let i = 0; i < ids.length; i++) {
    const w = air.wings.get(ids[i]);
    if (
      w !== undefined &&
      w.phase === WP_STATION &&
      w.flyMission === M_CAS &&
      w.hit === region &&
      w.flyMilli > 0 &&
      wingSide(air, w) === side
    ) {
      n++;
    }
  }
  return n;
}
