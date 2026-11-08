// P6 lane W2 (plan Task 8): the AI's mines (spec §15.1, §19.7), on an AI
// country's depth turn. At war, every day: mine-layer design ships lay
// mines in the two sea regions nearest the capital (Britain, Germany, the
// Soviet Union and Finland always — history as flavour; any other country
// when an enemy fleet is there), minesweepers clear the enemy's mines on the
// invasion routes and in mined home waters. At peace (every 10 days) the
// mine fleets come home. Night bombing and recon are the wing planner's
// (AiAir.aiWings, aiNightWings here).
//
// P4's AI plans every fleet of an AI country: it leaves the mine fleets
// alone (isDepthFleet).
//
// Automation (navy switch, a human's country): the mines only (aiSeaMines),
// on the same days; night bombing and recon are the air's, not the navy's.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { AIR_MISSIONS } from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DS_MINE_LAYER,
  DS_MINESWEEP,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { isCarrierWing } from "../air/Deploy";
import { wingPlanes, wingSide } from "../air/WwAir";
import { capitalRegion } from "../land/LandStartRun";
import { aiAtWar, invasionBoundFleets, invasionRouteSrs } from "../navy/AiNavy";
import { FST, MISSION } from "../navy/Missions";
import type { Fleet } from "../navy/WwNavy";
import { issueSeaAir } from "./AirExtras";
import { designerOn } from "./Hist";
import { enemyMinesMilli, shipMineFlags, sidesAtWar } from "./Mines";
import type { WwDepth } from "./WwDepth";

/** Spec §15.1: the countries that mine their home waters whenever at war. */
export const AI_MINE_TAGS: readonly CountryTag[] = ["GBR", "DEU", "SUN", "FIN"];
/** Spec §15.1: the home waters — the sea regions nearest the capital. */
export const AI_MINE_HOME_REGIONS = 2;
/** w77: the most ships the AI puts on one mine mission with the designer off. */
export const AI_MINE_SHIPS = 3;
/** 내 판단: by night under an enemy sky this strong over the zone, ‰; back by day below the second. */
export const AI_NIGHT_ON_PM = 500;
export const AI_NIGHT_OFF_PM = 300;
/** ww8 (내 판단): a bombing wing that lost this ‰ of its planes yesterday goes by night. */
export const AI_NIGHT_LOSS_PM = 50;
/** Spec §19.7: recon takes up to this share of the fighters, %. */
export const AI_RECON_PCT = 10;
/** 내 판단: enemy mines in home waters worth sweeping, milli (50 spec units). */
export const AI_SWEEP_HOME_MILLI = 50_000;

const M_BOMB = AIR_MISSIONS.indexOf("strategic_bombing");

/** T1b (P4 AiNavy input): a fleet on a mine mission, the depth AI's to command. */
export function isDepthFleet(f: Fleet): boolean {
  return f.mission === MISSION.layMines || f.mission === MISSION.sweepMines;
}

export function aiSeaAirDay(d: WwDepth, id: number, day: number): void {
  const ww = d.ww;
  if (!d.mg.playerBySmallID(id).isPlayer()) return;
  if (!aiAtWar(ww.navy, id)) {
    if (day % 10 === id % 10) aiPeace(d, id);
    return;
  }
  // ww8: night and recon are the wing planner's (aiWings), a human's [auto] too.
  aiMines(d, id);
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
  // w77: with the designer off no design carries the module: the owner's
  // ships decide (Mines' shipMineFlags: mine_warfare_1 and the class).
  if (!designerOn(d)) {
    const navy = d.ww.navy;
    let any = 0;
    for (const f of navy.fleetsOf(id)) {
      for (const sid of f.ships) {
        const r = navy.ships.rowOf(sid);
        if (r >= 0) any |= shipMineFlags(d, r);
      }
    }
    return any;
  }
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
  // w77: with the designer off every destroyer, light cruiser and submarine
  // can work mines, so the AI takes only the idle fleets' ships (a fleet on
  // a mission keeps it) and at most AI_MINE_SHIPS for one region.
  const picky = !designerOn(d);
  let best: Fleet | null = null;
  let bestShips: number[] = [];
  for (const f of [...navy.fleetsOf(id)].sort((a, b) => a.id - b.id)) {
    if (f.state === FST.battle || isDepthFleet(f)) continue;
    if (bound?.has(f.id) === true) continue;
    if (picky && f.mission !== MISSION.hold) continue;
    let ships = f.ships.filter((sid) => {
      const r = t.rowOf(sid);
      return r >= 0 && (shipMineFlags(d, r) & flag) !== 0;
    });
    if (picky) ships = ships.slice(0, AI_MINE_SHIPS);
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

/**
 * ww8 (design §7.9): each bombing wing by night or by day, wing by wing (a
 * human's pinned wing keeps its own): by night under an enemy sky, or when the
 * day's raids cost it dear. No date rule.
 */
export function aiNightWings(d: WwDepth, id: number, human: boolean): void {
  const air = d.ww.air;
  for (const w of air.wingsOf(id)) {
    if (w.mission !== M_BOMB || isCarrierWing(w) || (human && !w.auto)) {
      continue;
    }
    const idx = d.ww.scenario.srIdxOf(w.sr);
    if (idx < 0) continue;
    const enemySup = air.zoneState[idx].enemySup.get(wingSide(air, w)) ?? 0;
    const costly =
      w.prevLost > 0 && w.prevLost * 1000 >= wingPlanes(w) * AI_NIGHT_LOSS_PM;
    const want =
      enemySup >= AI_NIGHT_ON_PM || costly
        ? true
        : enemySup < AI_NIGHT_OFF_PM && w.prevLost === 0
          ? false
          : w.night;
    if (want !== w.night) {
      issueSeaAir(
        d,
        id,
        { kind: "air_night", deployment: w.id, on: want },
        d.mg.ticks(),
      );
    }
  }
}

/** At peace: the mine fleets come home. */
function aiPeace(d: WwDepth, id: number): void {
  minesHome(d, id);
}

/** At peace: the mine fleets come home. */
function minesHome(d: WwDepth, id: number): void {
  for (const f of [...d.ww.navy.fleetsOf(id)].sort((a, b) => a.id - b.id)) {
    if (isDepthFleet(f) && f.state !== FST.battle) {
      issueNavy(d, id, { kind: "fleet_return", fleet: f.id });
    }
  }
}
