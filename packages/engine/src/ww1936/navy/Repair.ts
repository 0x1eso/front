// World War 1936 P4: repairs, organisation, navy experience and admirals
// (P4 spec §5.4, §7.1, §7.4, §7.5), lane N2 (Task 4). All on the
// country's day (WwNavy.dailyCountry).
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_MISSIONS,
  FLEET_STATES,
  SHIP_CLASSES,
  SHIP_ROLE,
  WW_NAVY_XP_MAX_MILLI,
  WW_TITLED_ADMIRAL_BASE,
  WW_TITLED_ADMIRAL_XP_MILLI,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { effectiveLevel } from "../economy/Buildings";
import { lendDocks } from "../economy/NavalLines";
import type { AdmiralState, Fleet, WwNavy } from "./WwNavy";

const HOLD = FLEET_MISSIONS.indexOf("hold");
const ESCORT = FLEET_MISSIONS.indexOf("escort");
const ST_DOCKED = FLEET_STATES.indexOf("docked");
const ST_ON_STATION = FLEET_STATES.indexOf("on_station");
const ST_SORTIE = FLEET_STATES.indexOf("sortie");
const ST_BATTLE = FLEET_STATES.indexOf("battle");
const ST_REPAIRING = FLEET_STATES.indexOf("repairing");
const CV = SHIP_CLASSES.indexOf("cv");

/** Spec §7.1: organisation a day, % of the maximum (docked, at sea). */
const ORG_PORT_PCT = 10;
const ORG_SEA_PCT = 2;
/** Spec §7.5: navy experience a day, milli (majors double); a ship in a battle that day, capped. */
const NAVY_XP_DAY_MILLI = 100;
const NAVY_XP_DAY_MAJOR_MILLI = 200;
const NAVY_XP_BATTLE_SHIP_MILLI = 20;
const NAVY_XP_BATTLE_CAP_MILLI = 3_000;
/** Spec §7.4: admiral experience a battle day and a mission day, milli; 100 a level. */
const ADMIRAL_BATTLE_XP_MILLI = 2_000;
const ADMIRAL_MISSION_XP_MILLI = 200;
const ADMIRAL_LEVEL_XP_MILLI = 100_000;
const ADMIRAL_MAX_LEVEL = 5;
const ADMIRAL_MAX_SKILL = 5;
/** Titled admirals per country: ids 200_000 + smallID × 100 + 1..99 (plan decision 17). */
const MAX_TITLED = 99;

/** Capital ships and carriers take two repair places and two dockyards (spec §5.4, §7.1). */
function isBig(cls: number): boolean {
  const role = SHIP_ROLE[SHIP_CLASSES[cls]];
  return role === "capital" || role === "carrier";
}

/**
 * Spec §7.1: a day's repair, HP milli: (1% + 0.3% × level) of the maximum
 * × (100 + repairPct) / 100, slowed to the share of the dockyards lent.
 */
export function repairDayMilli(
  maxHpMilli: number,
  level: number,
  repairPct: number,
  docksLent: number,
  docksNeeded: number,
): number {
  if (docksNeeded <= 0 || docksLent <= 0) return 0;
  const base = Math.floor((maxHpMilli * (10 + 3 * level)) / 1000);
  const pct = Math.floor((base * Math.max(0, 100 + repairPct)) / 100);
  return Math.floor((pct * Math.min(docksLent, docksNeeded)) / docksNeeded);
}

/**
 * The country's day of repairs (spec §5.4, §7.1): in each naval base it
 * lies in (region id order; a base of its side), its docked ships short of
 * HP, the lowest HP ratio first (ties: ship id), take the base's level × 2
 * repair places (capital ships and carriers two) and borrow dockyards
 * (lane E's lendDocks; fewer lent → slower, none → no repair). Then
 * organisation: +10% a day docked, +2% at sea (not in a battle). A
 * repairing fleet whose every ship is whole is done: docked, and it
 * resumes the mission and region it came home from (controller ruling,
 * HOI4: the fleet goes back out; going home never clears them, and lane
 * N1's keepToOrders sails a docked mission fleet to its region).
 */
export function dailyRepair(navy: WwNavy, smallID: number, day: number): void {
  void day;
  const ce = navy.econ.country(smallID);
  if (ce === null) return;
  const t = navy.ships;
  const fleets = navy.fleetsOf(smallID);
  const byBase = new Map<number, number[]>();
  for (const f of fleets) {
    for (const id of f.ships) {
      const r = t.rowOf(id);
      if (r < 0) continue;
      t.docks[r] = 0;
      if (f.docked !== 0) {
        let l = byBase.get(f.docked);
        if (l === undefined) byBase.set(f.docked, (l = []));
        l.push(r);
      }
    }
  }
  for (const base of [...byBase.keys()].sort((a, b) => a - b)) {
    const level = effectiveLevel(navy.econ, base, "naval_base");
    if (
      level < 1 ||
      !navy.land.sameSide(smallID, navy.land.controller[base] ?? 0)
    ) {
      continue;
    }
    const damaged = byBase
      .get(base)!
      .map((r) => ({ r, max: navy.shipStatsOf(r).hpMilli }))
      .filter((x) => t.hp[x.r] < x.max)
      .sort(
        (a, b) =>
          t.hp[a.r] * b.max - t.hp[b.r] * a.max || t.id[a.r] - t.id[b.r],
      );
    let places = level * 2;
    for (const x of damaged) {
      const need = isBig(t.cls[x.r]) ? 2 : 1;
      if (need > places) continue;
      places -= need;
      const lent = Math.max(0, Math.min(need, lendDocks(ce, need)));
      t.docks[x.r] = lent;
      const add = repairDayMilli(x.max, level, ce.stats.repairPct, lent, need);
      if (add <= 0) continue;
      t.hp[x.r] = Math.min(x.max, t.hp[x.r] + add);
      navy.markFleet(t.fleet[x.r]);
    }
  }
  for (const f of fleets) {
    if (f.state === ST_BATTLE) continue;
    const pct = f.docked !== 0 ? ORG_PORT_PCT : ORG_SEA_PCT;
    let changed = false;
    for (const id of f.ships) {
      const r = t.rowOf(id);
      if (r < 0) continue;
      const max = navy.shipStatsOf(r).orgMilli;
      if (t.org[r] >= max) continue;
      t.org[r] = Math.min(max, t.org[r] + Math.floor((max * pct) / 100));
      changed = true;
    }
    if (changed) navy.markFleet(f.id);
  }
  for (const f of fleets) {
    if (f.state !== ST_REPAIRING || f.docked === 0) continue;
    const whole = f.ships.every((id) => {
      const r = t.rowOf(id);
      return r < 0 || t.hp[r] >= navy.shipStatsOf(r).hpMilli;
    });
    if (!whole) continue;
    f.state = ST_DOCKED;
    navy.markFleet(f.id);
  }
}

/** The fleets in a battle now (both sides of every battle). */
function fleetsInBattle(navy: WwNavy): Set<number> {
  const out = new Set<number>();
  for (const b of navy.battles.values()) {
    for (const fid of b.fleets[0]) out.add(fid);
    for (const fid of b.fleets[1]) out.add(fid);
  }
  return out;
}

function fleetHpPm(navy: WwNavy, f: Fleet): number {
  const t = navy.ships;
  let hp = 0;
  let max = 0;
  for (const id of f.ships) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    hp += t.hp[r];
    max += navy.shipStatsOf(r).hpMilli;
  }
  return max === 0 ? 1000 : Math.floor((hp * 1000) / max);
}

/**
 * Spec §7.4: past 100 × level experience an admiral goes up a level (at
 * most 5) and its most used skill (usage: battle days → attack, a battle
 * that cost half the fleet → defense, mission days → maneuver, carriers
 * and escorts → coordination; ties the first) gains a point (at most 5).
 */
function levelUp(a: AdmiralState): void {
  while (
    a.level < ADMIRAL_MAX_LEVEL &&
    a.xpMilli >= ADMIRAL_LEVEL_XP_MILLI * a.level
  ) {
    a.level++;
    const order = [0, 1, 2, 3].sort((x, y) => a.usage[y] - a.usage[x] || x - y);
    const i = order.find((k) => a.skills[k] < ADMIRAL_MAX_SKILL);
    if (i !== undefined) a.skills[i]++;
  }
}

/**
 * The country's day of navy experience (spec §7.5): +0.1 a day (majors
 * +0.2) + stats.navyXpMilli + 0.02 per ship in a battle now (at most +3),
 * up to 500. Its admirals (spec §7.4): +2 for a fleet in a battle, +0.2
 * for one on its mission; then the level-up. "In a battle that day" is
 * read on the country's day tick (the battle records end with the battle).
 */
export function dailyNavyXp(navy: WwNavy, smallID: number, day: number): void {
  void day;
  const cn = navy.country(smallID);
  const ce = navy.econ.country(smallID);
  if (cn === null || ce === null) return;
  const t = navy.ships;
  const fighting = fleetsInBattle(navy);
  let ships = 0;
  for (const f of navy.fleetsOf(smallID)) {
    if (fighting.has(f.id)) ships += f.ships.length;
  }
  const gain =
    (ce.major ? NAVY_XP_DAY_MAJOR_MILLI : NAVY_XP_DAY_MILLI) +
    ce.stats.navyXpMilli +
    Math.min(NAVY_XP_BATTLE_CAP_MILLI, ships * NAVY_XP_BATTLE_SHIP_MILLI);
  cn.navyXpMilli = Math.max(
    0,
    Math.min(WW_NAVY_XP_MAX_MILLI, cn.navyXpMilli + gain),
  );
  navy.markCountry(smallID);
  for (const a of navy.admirals.values()) {
    if (a.owner !== smallID || a.fleet === 0) continue;
    const f = navy.fleets.get(a.fleet);
    if (f === undefined || f.admiral !== a.id) continue;
    if (fighting.has(f.id)) {
      a.xpMilli += ADMIRAL_BATTLE_XP_MILLI;
      a.usage[fleetHpPm(navy, f) < 500 ? 1 : 0]++;
    } else if (
      f.mission !== HOLD &&
      (f.state === ST_ON_STATION || f.state === ST_SORTIE)
    ) {
      a.xpMilli += ADMIRAL_MISSION_XP_MILLI;
      const carriers = f.ships.some((id) => t.cls[t.rowOf(id)] === CV);
      a.usage[carriers || f.mission === ESCORT ? 3 : 2]++;
    } else {
      continue;
    }
    levelUp(a);
  }
}

/**
 * appoint_admiral (spec §7.4): a titled admiral (every skill 1, no trait)
 * for 10 navy experience; its id 200_000 + smallID × 100 + n.
 */
export function appointAdmiral(
  navy: WwNavy,
  smallID: number,
): WwOrderBlock | null {
  const cn = navy.country(smallID);
  if (cn === null) return "dead";
  if (cn.navyXpMilli < WW_TITLED_ADMIRAL_XP_MILLI) return "no_xp";
  if (cn.titledAdmirals >= MAX_TITLED) return "admiral_unavailable";
  cn.navyXpMilli -= WW_TITLED_ADMIRAL_XP_MILLI;
  cn.titledAdmirals++;
  const id = WW_TITLED_ADMIRAL_BASE + smallID * 100 + cn.titledAdmirals;
  const m = navy.admirals;
  let last = -Infinity;
  for (const k of m.keys()) last = k;
  m.set(id, {
    id,
    owner: smallID,
    xpMilli: 0,
    level: 1,
    skills: [1, 1, 1, 1],
    traits: 0,
    fleet: 0,
    usage: [0, 0, 0, 0],
  });
  // Admirals iterate by id (Global Constraints).
  if (id < last) {
    const all = [...m].sort((x, y) => x[0] - y[0]);
    m.clear();
    for (const [k, v] of all) m.set(k, v);
  }
  navy.markCountry(smallID);
  return null;
}
