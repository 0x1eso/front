// P6 lane W2 (plan Task 8): the AI's mines, night bombing and recon (spec
// §15.1, §15.3, §15.4, §19.7), on an AI country's depth turn. At war,
// every day: mine-layer design ships lay mines in the two sea regions
// nearest the capital (Britain, Germany, the Soviet Union and Finland
// always — history as flavour; any other country when an enemy fleet is
// there), minesweepers clear the enemy's mines on the invasion routes and
// in mined home waters, strategic bombers go by night (Britain from
// September 1940; anyone under an enemy sky); every 5 days recon fighters
// (up to 10% of the fighters) go over the zones of our battles. At peace
// (every 10 days) the mine fleets come home and the recon groups land.
//
// P4's AI plans every fleet and deployment of an AI country: it leaves
// these alone once T1b adds isDepthFleet / isDepthDeployment to its input
// filters (lane W2 report).
//
// Automation (navy switch, a human's country): the mines only (aiSeaMines),
// on the same days; night bombing and recon are the air's, not the navy's.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DS_MINE_LAYER,
  DS_MINESWEEP,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { RECON_SORTIES } from "@openfront/engine-lib/ww1936/SeaAirRules";
import { isCarrierWing } from "../air/Deploy";
import type { Deployment } from "../air/WwAir";
import { capitalRegion } from "../land/LandStartRun";
import { aiAtWar, invasionBoundFleets, invasionRouteSrs } from "../navy/AiNavy";
import { FST, MISSION } from "../navy/Missions";
import type { Fleet } from "../navy/WwNavy";
import { fliesAtNight, issueSeaAir } from "./AirExtras";
import { enemyMinesMilli, shipDesignFlags, sidesAtWar } from "./Mines";
import type { WwDepth } from "./WwDepth";

/** Spec §15.1: the countries that mine their home waters whenever at war. */
export const AI_MINE_TAGS: readonly CountryTag[] = ["GBR", "DEU", "SUN", "FIN"];
/** Spec §15.1: the home waters — the sea regions nearest the capital. */
export const AI_MINE_HOME_REGIONS = 2;
/** Spec §15.3: Britain's strategic bombing goes by night from this date. */
export const AI_NIGHT_GBR_DATE = "1940-09-01";
/** 내 판단: by night under an enemy sky this strong over the zone, ‰; back by day below the second. */
export const AI_NIGHT_ON_PM = 500;
export const AI_NIGHT_OFF_PM = 300;
/** Spec §19.7: recon takes up to this share of the fighters, %. */
export const AI_RECON_PCT = 10;
/** 내 판단: a recon group's planes (≥ 20 sorties at a usual sortie rate). */
export const AI_RECON_PLANES = 24;
/** 내 판단: enemy mines in home waters worth sweeping, milli (50 spec units). */
export const AI_SWEEP_HOME_MILLI = 50_000;

const M_BOMB = AIR_MISSIONS.indexOf("strategic_bombing");
const M_RECON = AIR_MISSIONS.indexOf("recon");
const T_FIGHTER = AIR_TYPES.indexOf("fighter");
const GBR_NIGHT_DAY = dayOfDate(AI_NIGHT_GBR_DATE);

/** T1b (P4 AiNavy input): a fleet on a mine mission, the depth AI's to command. */
export function isDepthFleet(f: Fleet): boolean {
  return f.mission === MISSION.layMines || f.mission === MISSION.sweepMines;
}

/** T1b (P4 AiAir input): a recon deployment, the depth AI's to command. */
export function isDepthDeployment(dep: Deployment): boolean {
  return dep.mission === M_RECON;
}

export function aiSeaAirDay(d: WwDepth, id: number, day: number): void {
  const ww = d.ww;
  if (!d.mg.playerBySmallID(id).isPlayer()) return;
  if (!aiAtWar(ww.navy, id)) {
    if (day % 10 === id % 10) aiPeace(d, id);
    return;
  }
  aiMines(d, id);
  aiNight(d, id, day);
  if ((day + id) % 5 === 0) aiRecon(d, id);
}

/**
 * Automation (navy switch): the mine half of the depth AI for a human's
 * country, on the AI's days — lay and sweep at war, the mine fleets home at
 * peace. Never the fleets bound to its invasions (assignShips).
 */
export function aiSeaMines(d: WwDepth, id: number, day: number): void {
  if (!d.mg.playerBySmallID(id).isPlayer()) return;
  if (!aiAtWar(d.ww.navy, id)) {
    if (day % 10 === id % 10) minesHome(d, id);
    return;
  }
  aiMines(d, id);
}

/** The sea regions nearest the country's capital (km, then id). */
export function homeSeaRegions(d: WwDepth, id: number): number[] {
  const ww = d.ww;
  const cap = capitalRegion(ww.land, id);
  if (cap === 0) return [];
  const sc = ww.scenario;
  return sc
    .strategicList()
    .filter((s) => s.kind === "sea")
    .map((s) => ({ sr: s.id, km: sc.srKm(cap, s.id) }))
    .sort((a, b) => a.km - b.km || a.sr - b.sr)
    .slice(0, AI_MINE_HOME_REGIONS)
    .map((x) => x.sr);
}

/** An enemy side has naval supremacy power in the region (yesterday's). */
function enemyFleetNear(d: WwDepth, id: number, sr: number): boolean {
  const navy = d.ww.navy;
  const idx = d.ww.scenario.srIdxOf(sr);
  const st = idx < 0 ? undefined : navy.srState[idx];
  if (st === undefined) return false;
  const side = d.ww.land.sideOf(id);
  for (const [k, v] of st.sup) {
    if (v > 0 && sidesAtWar(d, side, k)) return true;
  }
  return false;
}

/** Which of the mine flags any of the country's ship designs carries. */
function mineDesignFlags(d: WwDepth, id: number): number {
  const c = d.country(id);
  if (c === null) return 0;
  let flags = 0;
  c.des.ship.forEach((s, i) => {
    if (s === null) return;
    flags |=
      (d.designStatsOf(id, "ship", i + 1)?.flags ?? 0) &
      (DS_MINE_LAYER | DS_MINESWEEP);
  });
  return flags;
}

function issueNavy(d: WwDepth, id: number, o: WwOrder): boolean {
  return d.ww.navy.issue(id, o, d.mg.ticks(), "ai") === null;
}

/**
 * Puts the country's ships with `flag` (from the fleet holding the most of
 * them, docked fleets first, ties the smaller id; never one in a battle or
 * already on a mine mission) on `mission` in `sr`, split off as a fleet of
 * their own when the fleet holds other ships too.
 */
function assignShips(
  d: WwDepth,
  id: number,
  flag: number,
  mission: "lay_mines" | "sweep_mines",
  sr: number,
): boolean {
  const navy = d.ww.navy;
  const t = navy.ships;
  // Automation: a human's invasion keeps its fleets (an AI country has none
  // to keep: the AI's own invasion support is the AI's).
  const bound = d.ww.isHumanControlled(id)
    ? invasionBoundFleets(navy, id)
    : null;
  let best: Fleet | null = null;
  let bestShips: number[] = [];
  for (const f of [...navy.fleetsOf(id)].sort((a, b) => a.id - b.id)) {
    if (f.state === FST.battle || isDepthFleet(f)) continue;
    if (bound?.has(f.id) === true) continue;
    const ships = f.ships.filter((sid) => {
      const r = t.rowOf(sid);
      return r >= 0 && (shipDesignFlags(d, r) & flag) !== 0;
    });
    if (ships.length === 0) continue;
    const better =
      best === null ||
      (f.docked !== 0 && best.docked === 0) ||
      ((f.docked !== 0) === (best.docked !== 0) &&
        ships.length > bestShips.length);
    if (better) {
      best = f;
      bestShips = ships;
    }
  }
  if (best === null) return false;
  let fleet = best.id;
  if (bestShips.length < best.ships.length) {
    const split = issueNavy(d, id, {
      kind: "fleet_split",
      fleet: best.id,
      counts: [],
      ships: bestShips,
    });
    if (!split) return false;
    fleet = t.fleet[t.rowOf(bestShips[0])];
  }
  return issueNavy(d, id, { kind: "fleet_mission", fleet, mission, sr });
}

/** Spec §15.1, §19.7: lay in the home waters, sweep the routes and mined home waters. */
function aiMines(d: WwDepth, id: number): void {
  const flags = mineDesignFlags(d, id);
  if (flags === 0) return;
  const ww = d.ww;
  const navy = ww.navy;
  const home = homeSeaRegions(d, id);
  // Where the mine fleets should be today.
  const lay = new Set<number>();
  if ((flags & DS_MINE_LAYER) !== 0) {
    const always = AI_MINE_TAGS.includes(ww.tagOf(id));
    for (const sr of home) {
      if (always || enemyFleetNear(d, id, sr)) lay.add(sr);
    }
  }
  const sweep = new Set<number>();
  if ((flags & DS_MINESWEEP) !== 0) {
    for (const sr of invasionRouteSrs(navy, id)) {
      if (enemyMinesMilli(d, sr, id) > 0) sweep.add(sr);
    }
    for (const sr of home) {
      if (enemyMinesMilli(d, sr, id) >= AI_SWEEP_HOME_MILLI) sweep.add(sr);
    }
  }
  // Fleets no longer wanted come home (P4's AI takes them again).
  for (const f of [...navy.fleetsOf(id)].sort((a, b) => a.id - b.id)) {
    if (!isDepthFleet(f) || f.state === FST.battle) continue;
    const want = f.mission === MISSION.layMines ? lay : sweep;
    if (!want.has(f.missionSr)) {
      issueNavy(d, id, { kind: "fleet_return", fleet: f.id });
    }
  }
  const has = (m: number, sr: number) =>
    navy.fleetsOf(id).some((f) => f.mission === m && f.missionSr === sr);
  for (const sr of [...lay].sort((a, b) => a - b)) {
    if (!has(MISSION.layMines, sr)) {
      assignShips(d, id, DS_MINE_LAYER, "lay_mines", sr);
    }
  }
  for (const sr of [...sweep].sort((a, b) => a - b)) {
    if (!has(MISSION.sweepMines, sr)) {
      assignShips(d, id, DS_MINESWEEP, "sweep_mines", sr);
    }
  }
}

/** Spec §15.3, §19.7: each strategic bombing group by night or by day. */
function aiNight(d: WwDepth, id: number, day: number): void {
  const ww = d.ww;
  const air = ww.air;
  // The deployments map is in id order (ids only rise).
  const bombers: Deployment[] = [];
  for (const x of air.deployments.values()) {
    if (x.owner === id && x.mission === M_BOMB && !isCarrierWing(x)) {
      bombers.push(x);
    }
  }
  if (bombers.length === 0) return;
  const gbr = ww.tagOf(id) === "GBR" && day >= GBR_NIGHT_DAY;
  const side = ww.land.sideOf(id);
  const seen = new Set<string>();
  for (const dep of bombers) {
    const key = `${dep.sr}:${dep.type}:${dep.volunteerFor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const idx = ww.scenario.srIdxOf(dep.sr);
    const enemySup = idx < 0 ? 0 : (air.zoneState[idx].enemySup.get(side) ?? 0);
    const night = fliesAtNight(d, dep);
    const want =
      gbr || enemySup >= AI_NIGHT_ON_PM
        ? true
        : enemySup < AI_NIGHT_OFF_PM
          ? false
          : night;
    if (want !== night) {
      issueSeaAir(
        d,
        id,
        { kind: "air_night", deployment: dep.id, on: want },
        d.mg.ticks(),
      );
    }
  }
}

/** The country's fighters: in the stock and deployed (carrier wings aside). */
function fightersOf(d: WwDepth, id: number): number {
  const ce = d.ww.economy.country(id);
  if (ce === null) return 0;
  let n = 0;
  for (let g = 1; g <= EQUIPMENT_GENS.fighter; g++) {
    n += ce.stock[equipKey("fighter", g)] ?? 0;
  }
  for (const dep of d.ww.air.deploymentsOf(id)) {
    if (dep.type !== T_FIGHTER || isCarrierWing(dep)) continue;
    for (const c of dep.counts) n += c;
  }
  return n;
}

/** The recon groups' targets by zone (fighters). */
function reconTargets(d: WwDepth, id: number): Map<number, number> {
  const now = new Map<number, number>();
  for (const dep of d.ww.air.deploymentsOf(id)) {
    if (dep.mission === M_RECON && dep.type === T_FIGHTER) {
      now.set(dep.sr, dep.target);
    }
  }
  return now;
}

function setRecon(
  d: WwDepth,
  id: number,
  want: ReadonlyMap<number, number>,
): void {
  const now = reconTargets(d, id);
  const zones = [...new Set([...now.keys(), ...want.keys()])].sort(
    (a, b) => a - b,
  );
  for (const sr of zones) {
    const w = want.get(sr) ?? 0;
    if (w === (now.get(sr) ?? 0)) continue;
    d.ww.air.issue(
      id,
      { kind: "air_deploy", sr, type: "fighter", mission: "recon", count: w },
      d.mg.ticks(),
    );
  }
}

/**
 * Spec §19.7: recon over the land zones where our side fights (the most
 * battles first, then the zone id), a group of AI_RECON_PLANES each while
 * 10% of the fighters lasts (a group needs at least 20).
 */
function aiRecon(d: WwDepth, id: number): void {
  const ww = d.ww;
  const land = ww.land;
  const zones = new Map<number, number>();
  for (const b of land.battles.values()) {
    if (!land.sameSide(id, b.attLead) && !land.sameSide(id, b.defLead)) {
      continue;
    }
    const sr = ww.scenario.regionSr(b.region);
    if (sr !== 0) zones.set(sr, (zones.get(sr) ?? 0) + 1);
  }
  let left = Math.floor((fightersOf(d, id) * AI_RECON_PCT) / 100);
  const want = new Map<number, number>();
  for (const [sr] of [...zones].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    if (left < RECON_SORTIES) break;
    const n = Math.min(AI_RECON_PLANES, left);
    want.set(sr, n);
    left -= n;
  }
  setRecon(d, id, want);
}

/** At peace: the mine fleets come home, the recon groups land. */
function aiPeace(d: WwDepth, id: number): void {
  minesHome(d, id);
  if (reconTargets(d, id).size > 0) setRecon(d, id, new Map());
}

/** At peace: the mine fleets come home. */
function minesHome(d: WwDepth, id: number): void {
  for (const f of [...d.ww.navy.fleetsOf(id)].sort((a, b) => a.id - b.id)) {
    if (isDepthFleet(f) && f.state !== FST.battle) {
      issueNavy(d, id, { kind: "fleet_return", fleet: f.id });
    }
  }
}
