// World War 1936 P4: fleet orders and housekeeping (P4 spec §7.2, §8.1–
// §8.3). Lane N1 (Task 3). Orders change the fleet at once (its way
// included: SeaMove.startFleetMove); every tick applyFleetOrders keeps
// each fleet doing its mission (out to its station, home to wait or be
// repaired, back after a battle); once a day the country's housekeeping
// handles a lost home port, the return threshold and finished sorties.
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ENGAGE_RULES,
  FLEET_MISSIONS,
  FleetMission,
  FleetOrder,
  SHIP_CLASSES,
  WW_MAX_FLEET_SHIPS,
  WW_MAX_FLEETS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  admiralAvailable,
  ADMIRALS,
} from "@openfront/engine-lib/ww1936/Admirals";
import {
  dateOfDay,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { fleetMissionBlock } from "@openfront/engine-lib/ww1936/NavalRules";
import { ALL_EDGES, seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import { belowReturnAt, FST, MISSION, MISSION_ENGAGE } from "./Missions";
import {
  battleFleetIds,
  dockIfHome,
  holdFleet,
  homeUsable,
  homeWaterSrs,
  sendHome,
  startFleetMove,
} from "./SeaMove";
import type { AdmiralState, Fleet, WwNavy } from "./WwNavy";

/**
 * fleet_mission … fleet_auto (spec §7.2, §19.3). "no_fleet" unless the
 * fleet (and a merge's other fleet) is the sender's; "fleet_busy" in a
 * battle, except the rule, the return threshold, auto and the admiral.
 */
export function issueFleetOrder(
  navy: WwNavy,
  smallID: number,
  order: FleetOrder,
  tick: number,
): WwOrderBlock | null {
  const f = navy.fleets.get(order.fleet);
  if (f === undefined || f.owner !== smallID) return "no_fleet";
  switch (order.kind) {
    case "fleet_engage":
      f.engage = ENGAGE_RULES.indexOf(order.rule);
      navy.markFleet(f.id);
      return null;
    case "fleet_return_at":
      f.returnAtPct = order.pct;
      navy.markFleet(f.id);
      return null;
    case "fleet_auto":
      f.auto = order.on;
      navy.markFleet(f.id);
      return null;
    case "fleet_admiral":
      return assignAdmiral(navy, f, order.admiral, navy.day(tick));
    default:
      break;
  }
  let into: Fleet | undefined;
  if (order.kind === "fleet_merge") {
    into = navy.fleets.get(order.into);
    if (into === undefined || into.owner !== smallID) return "no_fleet";
  }
  const busy = battleFleetIds(navy);
  if (busy.has(f.id) || (into !== undefined && busy.has(into.id))) {
    return "fleet_busy";
  }
  switch (order.kind) {
    case "fleet_mission":
      return orderMission(navy, f, order.mission, order.sr, tick);
    case "fleet_move":
      return orderMove(navy, f, order.zone, tick);
    case "fleet_return":
      return orderReturn(navy, f, tick);
    case "fleet_base":
      return orderBase(navy, f, order.port, tick);
    case "fleet_split":
      return splitFleet(navy, f, order.counts, order.ships);
    case "fleet_merge":
      return mergeFleet(navy, f, into!);
  }
}

/** Spec §8.3: sea km from the fleet's home port's harbor zone to sea region `sr`'s nearest zone; null: none. */
export function missionKm(navy: WwNavy, f: Fleet, sr: number): number | null {
  const sc = navy.scenario;
  const s = sc.sr(sr);
  const home = sc.harborOf(f.home);
  if (s === undefined || s.kind !== "sea" || home === 0) return null;
  return (
    seaPath(sc, [home], s.members, navy.passable(f.owner, true))?.km ?? null
  );
}

function engageOf(m: FleetMission): number {
  return ENGAGE_RULES.indexOf(MISSION_ENGAGE[m]);
}

/**
 * Spec §8.1, §8.3: a mission in a sea region within range of the home
 * port (training: an own coastal region). A strike force waits in its
 * home port (dest 0); any other mission sails to the region's nearest
 * zone. The rule becomes the mission's (the screen may set another
 * right after).
 */
function orderMission(
  navy: WwNavy,
  f: Fleet,
  mission: FleetMission,
  sr: number,
  tick: number,
): WwOrderBlock | null {
  const sc = navy.scenario;
  if (mission === "hold") {
    holdFleet(navy, f);
    f.engage = engageOf("hold");
    f.resumeDay = -1;
    return null;
  }
  const s = sc.sr(sr);
  const block = fleetMissionBlock({
    mission,
    srKind: s?.kind ?? null,
    km: missionKm(navy, f, sr),
    rangeKm: navy.fleetRangeKm(f),
    inBattle: false,
  });
  if (block !== null) return block;
  if (mission === "training" && !homeWaterSrs(navy, f.owner).has(sr)) {
    return "bad_zone";
  }
  if (mission !== "strike" && navy.pathFor(f, s!.members) === null) {
    return "no_sea_path";
  }
  f.mission = FLEET_MISSIONS.indexOf(mission);
  f.missionSr = sr;
  f.engage = engageOf(mission);
  f.sortieTarget = 0;
  f.resumeDay = -1;
  if (mission === "strike") {
    f.dest = 0;
    if (f.docked === f.home) {
      f.path = [];
      f.edge = -1;
      f.prog = 0;
      f.need = 0;
      if (f.state !== FST.repairing) f.state = FST.docked;
    } else {
      sendHome(navy, f, tick);
    }
  } else {
    // Out of port (a repairing fleet too: the player's call) or on from where it is.
    f.state = f.docked !== 0 ? FST.docked : FST.moving;
    startFleetMove(navy, f, s!.members, tick);
  }
  navy.markFleet(f.id);
  return null;
}

/** Spec §7.2: to a sea zone, then hold there (a lake: "lake"; only closed straits or canals in the way: "canal_closed"). */
function orderMove(
  navy: WwNavy,
  f: Fleet,
  zone: number,
  tick: number,
): WwOrderBlock | null {
  const sc = navy.scenario;
  if (sc.seaZone(zone) === undefined) return "bad_zone";
  if (sc.isLake(zone)) return "lake";
  if (navy.pathFor(f, [zone]) === null) {
    const open = seaPath(sc, [f.zone], [zone], ALL_EDGES);
    return open === null ? "no_sea_path" : "canal_closed";
  }
  f.mission = MISSION.hold;
  f.missionSr = 0;
  f.sortieTarget = 0;
  f.resumeDay = -1;
  f.state = f.docked !== 0 ? FST.docked : FST.moving;
  startFleetMove(navy, f, [zone], tick);
  return null;
}

/** Spec §7.2: home, then docked and holding. */
function orderReturn(
  navy: WwNavy,
  f: Fleet,
  tick: number,
): WwOrderBlock | null {
  const z = navy.scenario.harborOf(f.home);
  if (z === 0 || navy.pathFor(f, [z]) === null) return "no_sea_path";
  f.mission = MISSION.hold;
  f.missionSr = 0;
  f.resumeDay = -1;
  return sendHome(navy, f, tick);
}

/**
 * Spec §7.1, §8.3: a working naval base its side controls becomes home;
 * a mission out of range of it becomes hold; a fleet in port elsewhere
 * sails there.
 */
function orderBase(
  navy: WwNavy,
  f: Fleet,
  port: number,
  tick: number,
): WwOrderBlock | null {
  if (!homeUsable(navy, f.owner, port)) return "no_naval_base";
  rehome(navy, f, port, tick);
  return null;
}

/** A new home port: the mission's range checked again, a docked fleet elsewhere sails there. */
function rehome(navy: WwNavy, f: Fleet, port: number, tick: number): void {
  f.home = port;
  navy.markFleet(f.id);
  if (f.mission !== MISSION.hold) {
    const km = missionKm(navy, f, f.missionSr);
    if (km === null || km > navy.fleetRangeKm(f)) holdFleet(navy, f);
  }
  if (f.docked !== 0 && f.docked !== port) sendHome(navy, f, tick);
  else if (f.state === FST.returning) sendHome(navy, f, tick);
}

/**
 * Spec §7.2: ships leave for a new fleet in the same place, same home,
 * holding. `counts`: per class, the lowest HP ratio first (ties: the
 * smaller ship id); else the listed `ships`. None or all: "bad_index".
 */
function splitFleet(
  navy: WwNavy,
  f: Fleet,
  counts: readonly (readonly [string, number])[],
  ships: readonly number[],
): WwOrderBlock | null {
  if (navy.fleetsOf(f.owner).length >= WW_MAX_FLEETS) return "too_many_fleets";
  const t = navy.ships;
  const take = new Set<number>();
  if (counts.length > 0) {
    const seen = new Set<string>();
    for (const [cls, n] of counts) {
      if (seen.has(cls)) return "bad_index";
      seen.add(cls);
      const ci = SHIP_CLASSES.indexOf(cls as (typeof SHIP_CLASSES)[number]);
      const of = f.ships
        .map((id) => {
          const r = t.rowOf(id);
          const max = r < 0 ? 0 : navy.shipStatsOf(r).hpMilli;
          return {
            id,
            ci: r < 0 ? -1 : t.cls[r],
            pm: max <= 0 ? 0 : Math.floor((t.hp[r] * 1000) / max),
          };
        })
        .filter((x) => x.ci === ci)
        .sort((a, b) => a.pm - b.pm || a.id - b.id);
      if (n > of.length) return "bad_index";
      for (let i = 0; i < n; i++) take.add(of[i].id);
    }
  } else {
    const mine = new Set(f.ships);
    for (const id of ships) {
      if (!mine.has(id) || take.has(id)) return "bad_index";
      take.add(id);
    }
  }
  if (take.size === 0 || take.size >= f.ships.length) return "bad_index";
  const nf = navy.newFleet(f.owner, f.docked !== 0 ? f.docked : f.home, 0);
  nf.home = f.home;
  nf.returnAtPct = f.returnAtPct;
  nf.mix = [...f.mix] as [number, number, number];
  if (f.docked === 0) {
    nf.docked = 0;
    navy.setFleetZone(nf, f.zone);
    nf.lastSr = navy.scenario.zoneSr(f.zone);
    nf.state = FST.onStation;
  }
  const moved = [...take].sort((a, b) => a - b);
  for (const id of moved) t.fleet[t.rowOf(id)] = nf.id;
  f.ships = f.ships.filter((id) => !take.has(id));
  nf.ships = moved;
  navy.markFleet(f.id);
  navy.markFleet(nf.id);
  return null;
}

/**
 * Spec §7.2: `f`'s ships join `into` (same zone at sea or same port), at
 * most 60; the merged fleet keeps `into`'s mission and name.
 */
function mergeFleet(navy: WwNavy, f: Fleet, into: Fleet): WwOrderBlock | null {
  if (into.id === f.id) return "bad_index";
  const together =
    f.docked !== 0
      ? f.docked === into.docked
      : into.docked === 0 && f.zone === into.zone;
  if (!together) return "not_adjacent";
  if (f.ships.length + into.ships.length > WW_MAX_FLEET_SHIPS) {
    return "fleet_full";
  }
  const t = navy.ships;
  for (const id of f.ships) t.fleet[t.rowOf(id)] = into.id;
  into.ships = [...into.ships, ...f.ships].sort((a, b) => a - b);
  f.ships = [];
  navy.markFleet(into.id);
  navy.removeFleetIfEmpty(f.id);
  return null;
}

/** Spec §7.4: a roster admiral serves by the dates and not while the same person is a navy chief. */
function admiralServes(navy: WwNavy, a: AdmiralState, day: number): boolean {
  const def = a.id >= 1 && a.id <= ADMIRALS.length ? ADMIRALS[a.id - 1] : null;
  if (def === null) return true; // a titled admiral
  if (!admiralAvailable(def, formatIsoDate(dateOfDay(day)))) return false;
  const person = def.alsoPerson;
  if (person === undefined) return true;
  return !navy.ww.politics.list().some((c) => c.advisors.includes(person));
}

/** Spec §7.4: `admiral` (0: none) takes the fleet; from another fleet, that one is left without. */
function assignAdmiral(
  navy: WwNavy,
  f: Fleet,
  admiral: number,
  day: number,
): WwOrderBlock | null {
  let a: AdmiralState | undefined;
  if (admiral !== 0) {
    a = navy.admirals.get(admiral);
    if (
      a === undefined ||
      a.owner !== f.owner ||
      !admiralServes(navy, a, day)
    ) {
      return "admiral_unavailable";
    }
  }
  if (f.admiral === admiral) return null;
  const old = navy.admirals.get(f.admiral);
  if (old !== undefined && old.fleet === f.id) old.fleet = 0;
  f.admiral = 0;
  if (a !== undefined) {
    const other = navy.fleets.get(a.fleet);
    if (other !== undefined && other.admiral === a.id) {
      other.admiral = 0;
      navy.markFleet(other.id);
    }
    a.fleet = f.id;
    f.admiral = a.id;
  }
  navy.markFleet(f.id);
  navy.markCountry(f.owner);
  return null;
}

/**
 * Every tick (spec §2.2-6 ③): each fleet out of battle keeps to its
 * orders — a battle over (after its resume day, spec §9.7) goes back to
 * its mission; a mission fleet sails to its region's nearest zone (in
 * port: once above its return threshold) and is on station there; a
 * strike force waits in its home port; a fleet sailing home with no way
 * left (a new home, a lost port) finds it again.
 */
export function applyFleetOrders(navy: WwNavy, tick: number): void {
  if (navy.fleets.size === 0) return;
  const day = navy.day(tick);
  const busy = battleFleetIds(navy);
  for (const f of [...navy.fleets.values()]) {
    if (!navy.fleets.has(f.id) || busy.has(f.id)) continue;
    if (f.state === FST.battle) {
      f.state = f.docked !== 0 ? FST.docked : FST.onStation;
      navy.markFleet(f.id);
    }
    if (f.resumeDay >= 0) {
      if (day < f.resumeDay) continue;
      f.resumeDay = -1;
      navy.markFleet(f.id);
    }
    if (f.path.length > 0) continue;
    keepToOrders(navy, f, tick);
  }
}

function keepToOrders(navy: WwNavy, f: Fleet, tick: number): void {
  const sc = navy.scenario;
  if (f.state === FST.returning) {
    if (dockIfHome(navy, f, tick)) return;
    const z = sc.harborOf(f.home);
    if (f.zone !== z) sendHome(navy, f, tick);
    return;
  }
  if (f.state === FST.repairing || f.mission === MISSION.hold) return;
  if (f.mission === MISSION.strike) {
    // A sortie comes home with the housekeeping (the battle over, the target gone).
    if (f.state === FST.sortie) return;
    if (f.docked !== f.home) sendHome(navy, f, tick);
    return;
  }
  if (f.docked === 0 && sc.zoneSr(f.zone) === f.missionSr) {
    if (f.state !== FST.onStation || f.dest !== f.zone) {
      f.state = FST.onStation;
      f.dest = f.zone;
      navy.markFleet(f.id);
    }
    return;
  }
  if (f.docked !== 0 && belowReturnAt(navy, f)) return; // repairs first
  const s = sc.sr(f.missionSr);
  if (s === undefined || startFleetMove(navy, f, s.members, tick) !== null) {
    holdFleet(navy, f);
  }
}

/**
 * The country's day (spec §2.2-6 ②, §8.3, §7.2): a fleet whose home port
 * is lost (not its side's, or no working base) takes its side's base
 * nearest by sea and holds when its mission is now out of range; a
 * mission fleet below its return threshold sails home to be repaired; a
 * strike force whose target is gone or whose battle is over sails home.
 * The AI's new-ships fleets are the AI's (untouched here).
 */
export function dailyFleetHousekeeping(
  navy: WwNavy,
  smallID: number,
  day: number,
): void {
  void day;
  const own = navy.fleetsOf(smallID);
  if (own.length === 0) return;
  const tick = navy.mg.ticks();
  const p = navy.mg.playerBySmallID(smallID);
  const ai = !p.isPlayer() || p.type() !== PlayerType.Human;
  const busy = battleFleetIds(navy);
  for (const f of own) {
    if (!navy.fleets.has(f.id) || busy.has(f.id)) continue;
    if (ai && f.newShips) continue;
    if (!homeUsable(navy, f.owner, f.home)) {
      const base = nearestBase(navy, f);
      if (base !== 0) rehome(navy, f, base, tick);
    }
    if (
      f.docked === 0 &&
      f.state !== FST.returning &&
      f.mission !== MISSION.hold &&
      belowReturnAt(navy, f)
    ) {
      sendHome(navy, f, tick);
      continue;
    }
    if (f.mission === MISSION.strike && f.state === FST.sortie) {
      const target = navy.fleets.get(f.sortieTarget);
      const gone = target === undefined || target.docked !== 0;
      if (gone || (f.path.length === 0 && !navy.battles.has(f.zone))) {
        sendHome(navy, f, tick);
      }
    }
  }
}

/** Spec §8.3: the working base of the fleet's side nearest by sea (ties: the smaller region id); 0 none. */
function nearestBase(navy: WwNavy, f: Fleet): number {
  const sc = navy.scenario;
  const byZone = new Map<number, number>();
  for (const r of sc.landRegions) {
    if (!homeUsable(navy, f.owner, r.id)) continue;
    const z = sc.harborOf(r.id);
    const had = byZone.get(z);
    if (had === undefined || r.id < had) byZone.set(z, r.id);
  }
  if (byZone.size === 0) return 0;
  const p = navy.pathFor(
    f,
    [...byZone.keys()].sort((a, b) => a - b),
  );
  return p === null ? 0 : (byZone.get(p.zones[p.zones.length - 1]) ?? 0);
}
