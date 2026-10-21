// World War 1936 P4: missions and engagements (P4 spec §8.1, §8.2, §9.1).
// Lane N1 (Task 3). The mission table's factors, what a fleet adds to its
// side's search and supremacy, and the day's engagements: an enemy fleet a
// side spotted today (Spotting.ts hands the pairs over) meets the side's
// fleets whose engagement rule allows it and the region's strike forces.
import {
  ENGAGE_RULES,
  EngageRule,
  FLEET_MISSIONS,
  FLEET_STATES,
  FleetMission,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { fleetPower, ShipView } from "@openfront/engine-lib/ww1936/NavalRules";
import { startNavalBattle } from "./NavalBattles";
import { battleFleetIds, startFleetMove } from "./SeaMove";
import type { Fleet, WwNavy } from "./WwNavy";

/** Spec §8.1: [search ‰, supremacy ‰] on station (a strike force: sortied). */
const MISSION_PM: Readonly<Record<FleetMission, readonly [number, number]>> = {
  hold: [0, 0],
  patrol: [1000, 1000],
  strike: [1000, 1000],
  raid: [400, 250],
  escort: [500, 500],
  invasion_support: [500, 1000],
  training: [200, 0],
};
/** Spec §8.1: a strike force waiting in its home port. */
const STRIKE_DOCKED_PM = [300, 500] as const;
/** Spec §8.1: a fleet on its way (to its station, home, or a move order). */
const MOVING_PM = [200, 250] as const;

/** Spec §8.1: a mission's engagement rule; a mission order sets it. */
export const MISSION_ENGAGE: Readonly<Record<FleetMission, EngageRule>> = {
  hold: "if_stronger",
  patrol: "if_stronger",
  strike: "always",
  raid: "avoid",
  escort: "always",
  invasion_support: "always",
  training: "avoid",
};

/** Spec §15.4: a strike force with less fuel than this ‰ stays in port. */
export const STRIKE_MIN_FUEL_PM = 100;

/** FLEET_STATES indexes. */
export const FST = {
  docked: FLEET_STATES.indexOf("docked"),
  moving: FLEET_STATES.indexOf("moving"),
  onStation: FLEET_STATES.indexOf("on_station"),
  sortie: FLEET_STATES.indexOf("sortie"),
  battle: FLEET_STATES.indexOf("battle"),
  returning: FLEET_STATES.indexOf("returning"),
  repairing: FLEET_STATES.indexOf("repairing"),
} as const;

/** FLEET_MISSIONS indexes. */
export const MISSION = {
  hold: FLEET_MISSIONS.indexOf("hold"),
  patrol: FLEET_MISSIONS.indexOf("patrol"),
  strike: FLEET_MISSIONS.indexOf("strike"),
  raid: FLEET_MISSIONS.indexOf("raid"),
  escort: FLEET_MISSIONS.indexOf("escort"),
  invasionSupport: FLEET_MISSIONS.indexOf("invasion_support"),
  training: FLEET_MISSIONS.indexOf("training"),
} as const;

/** ENGAGE_RULES indexes. */
export const ENGAGE = {
  avoid: ENGAGE_RULES.indexOf("avoid"),
  ifStronger: ENGAGE_RULES.indexOf("if_stronger"),
  always: ENGAGE_RULES.indexOf("always"),
} as const;

/** A fleet on its way somewhere (a path left, or sailing home or out). */
export function isMoving(f: Fleet): boolean {
  return (
    f.path.length > 0 || f.state === FST.moving || f.state === FST.returning
  );
}

/**
 * Spec §8.1 "atStation": the fleet does its mission where it is — on its
 * station (or holding there), in a battle, or a strike force sortied.
 */
export function isAtStation(f: Fleet): boolean {
  return (
    f.state === FST.sortie ||
    f.state === FST.battle ||
    (f.state === FST.onStation && f.path.length === 0)
  );
}

/**
 * Spec §8.1: a fleet's search or supremacy factor ‰ by its mission (moving
 * fleets 200 / 250; atStation: on its station or, for a strike force,
 * sortied; a strike force in port 300 / 500). The fuel ratio (spec §15.4)
 * is not in it: a Fleet does not know its country's fuel, so the callers
 * multiply it in (fleetMissionPm).
 */
export function missionPm(
  f: Fleet,
  kind: "search" | "sup",
  atStation: boolean,
): number {
  const i = kind === "search" ? 0 : 1;
  const m = FLEET_MISSIONS[f.mission] ?? "hold";
  if (atStation) return MISSION_PM[m][i];
  if (f.docked !== 0) return m === "strike" ? STRIKE_DOCKED_PM[i] : 0;
  if (isMoving(f)) return MOVING_PM[i];
  return 0;
}

/** missionPm where the fleet is now × its country's fuel ratio (spec §15.4). */
export function fleetMissionPm(
  navy: WwNavy,
  f: Fleet,
  kind: "search" | "sup",
): number {
  const pm = missionPm(f, kind, isAtStation(f));
  return Math.floor((pm * fuelPmOf(navy, f.owner)) / 1000);
}

/** Yesterday's fuel ratio of a country, ‰ (1000 without an economy). */
export function fuelPmOf(navy: WwNavy, owner: number): number {
  return navy.econ.country(owner)?.fuelRatioPm ?? 1000;
}

/** The fleet's HP over its full HP, ‰ (0 for an empty fleet). */
export function fleetHpPm(navy: WwNavy, f: Fleet): number {
  let hp = 0;
  let max = 0;
  for (const id of f.ships) {
    const r = navy.ships.rowOf(id);
    if (r < 0) continue;
    hp += navy.ships.hp[r];
    max += navy.shipStatsOf(r).hpMilli;
  }
  return max === 0 ? 0 : Math.floor((hp * 1000) / max);
}

/** Spec §8.2, §9.9: the fleet's power now (fleetPower over its ships). */
export function fleetPowerOf(navy: WwNavy, f: Fleet): number {
  const views: ShipView[] = [];
  for (const id of f.ships) {
    const r = navy.ships.rowOf(id);
    if (r < 0) continue;
    views.push({ stats: navy.shipStatsOf(r), hpMilli: navy.ships.hp[r] });
  }
  return fleetPower(views);
}

/** Spec §7.2: below its return threshold (0%: never). */
export function belowReturnAt(navy: WwNavy, f: Fleet): boolean {
  return f.returnAtPct > 0 && fleetHpPm(navy, f) < f.returnAtPct * 10;
}

/** Some member of a side is at war with `owner` now. */
export function sideAtWarWith(
  navy: WwNavy,
  members: readonly number[],
  owner: number,
): boolean {
  for (const m of members) if (navy.isEnemy(m, owner)) return true;
  return false;
}

/** A side's members (none for a key that is no side now). */
export function sideMembers(navy: WwNavy, side: number): readonly number[] {
  for (const s of navy.sideList()) if (s.key === side) return s.members;
  return [];
}

// ---- Spotting → engagements, the same day (spec §9.1) ----

/**
 * The (side, fleet) pairs whose spotting reached 1000‰ today, per sea
 * region, for that region's engageRegion. dailySeaRegion calls the two
 * back to back inside one tick, so this never outlives a tick and needs
 * no snapshot; the day guards a spotRegion called on its own.
 */
const newlySpotted = new WeakMap<
  WwNavy,
  Map<number, { day: number; pairs: [number, number][] }>
>();

/** Spotting.ts: region `sr`'s newly spotted (side, fleet) pairs today, fleet order. */
export function noteNewlySpotted(
  navy: WwNavy,
  sr: number,
  day: number,
  pairs: [side: number, fleet: number][],
): void {
  let m = newlySpotted.get(navy);
  if (m === undefined) newlySpotted.set(navy, (m = new Map()));
  if (pairs.length === 0) m.delete(sr);
  else m.set(sr, { day, pairs });
}

function takeNewlySpotted(
  navy: WwNavy,
  sr: number,
  day: number,
): [number, number][] {
  const m = newlySpotted.get(navy);
  const e = m?.get(sr);
  if (m === undefined || e === undefined) return [];
  m.delete(sr);
  return e.day === day ? e.pairs : [];
}

/**
 * A sea region's engagements (after spotting, supremacy and the convoy
 * war): newly spotted enemy fleets → startNavalBattle (N2). Spec §9.1: for
 * each pair (side S, enemy fleet F) spotted today, in fleet order, S's
 * fleets in the region at war with F's owner whose rule allows it (avoid
 * never; if_stronger when F's power ≤ the power of all of S's fleets that
 * would fight; always) and S's strike forces of this region (in port, fuel
 * ≥ 100‰, above their return threshold) open a battle in F's zone. The
 * strike forces sortie there; the region's other engaging fleets on a
 * mission sail there and join on arrival (SeaMove).
 */
export function engageRegion(navy: WwNavy, sr: number, tick: number): void {
  const pairs = takeNewlySpotted(navy, sr, navy.day(tick));
  if (pairs.length === 0) return;
  const sc = navy.scenario;
  const s = sc.sr(sr);
  if (s === undefined || s.kind !== "sea") return;
  for (const [side, fid] of pairs) {
    const target = navy.fleets.get(fid);
    if (target === undefined || target.docked !== 0) continue;
    if (sc.zoneSr(target.zone) !== sr) continue;
    const busy = battleFleetIds(navy);
    const fights = (f: Fleet) =>
      navy.sideOf(f.owner) === side &&
      !busy.has(f.id) &&
      navy.isEnemy(f.owner, target.owner);
    // S's fleets at sea in the region, on a mission, holding or on their way.
    const here: Fleet[] = [];
    for (const z of s.members) {
      for (const id of navy.fleetsIn(z)) {
        const f = navy.fleets.get(id)!;
        if (f.docked !== 0 || !fights(f)) continue;
        if (f.state === FST.returning || f.state === FST.repairing) continue;
        if (f.state === FST.sortie) continue;
        here.push(f);
      }
    }
    // S's strike forces of this region, waiting in port.
    const strikes: Fleet[] = [];
    for (const m of sideMembers(navy, side)) {
      for (const f of navy.fleetsOf(m)) {
        if (f.mission !== MISSION.strike || f.missionSr !== sr) continue;
        if (f.docked === 0 || f.state === FST.repairing || !fights(f)) continue;
        if (fuelPmOf(navy, f.owner) < STRIKE_MIN_FUEL_PM) continue;
        if (belowReturnAt(navy, f)) continue;
        strikes.push(f);
      }
    }
    strikes.sort((a, b) => a.id - b.id);
    const willing = [...here, ...strikes].filter(
      (f) => f.engage !== ENGAGE.avoid,
    );
    if (willing.length === 0) continue;
    let ours = 0;
    for (const f of willing) ours += fleetPowerOf(navy, f);
    const strong = fleetPowerOf(navy, target) <= ours;
    const go = willing.filter((f) => f.engage === ENGAGE.always || strong);
    if (go.length === 0) continue;
    startNavalBattle(navy, target.zone, side, target.id, tick); // N2
    for (const f of go) {
      if (f.mission === MISSION.strike && f.docked !== 0) {
        f.state = FST.sortie;
        f.sortieTarget = target.id;
        if (startFleetMove(navy, f, [target.zone], tick) !== null) {
          f.state = FST.docked;
          f.sortieTarget = 0;
        }
        navy.markFleet(f.id);
      } else if (f.zone !== target.zone && f.mission !== MISSION.hold) {
        startFleetMove(navy, f, [target.zone], tick);
      }
    }
  }
}
