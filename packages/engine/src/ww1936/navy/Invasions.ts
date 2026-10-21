// World War 1936 P4: naval invasions (P4 spec §11). The order and its
// preparation, the launch over a sea route the side holds, the abort at
// sea, the landing (an empty region is taken, a defended one is attacked
// from the sea), the evacuation of a failed landing, the beachhead.
// Lane C's voyages carry the divisions (SeaTransfer.startVoyage; its
// stepSeaVoyages calls landInvasion on arrival). Integer arithmetic, no
// randomness; invasions, landing marks and beachheads go in id order.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type CombatMods,
  idleOrder,
  type LandOrderSource,
  MOVE_ADVANCE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  MOVE_WALK,
  ROLE_ATTACK,
  TPL_MARINE_ANY,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  admiralTraitBit,
  CONVOY_USES,
  FLEET_MISSIONS,
  FLEET_STATES,
  INVASION_STATES,
  type InvasionOrder,
  WW_BEACHHEAD_CAPACITY_MILLI,
  WW_BEACHHEAD_DAYS,
  WW_CONVOY_SPEED_KN,
  WW_INVASION_ABORT_SUP_PM,
  WW_INVASION_LAUNCH_SUP_PM,
  WW_INVASION_MAX_KM,
  WW_SUPPLY_CONVOY_KM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  divisionConvoys,
  routeEffPm,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import {
  invasionBlock,
  invasionCapacity,
  invasionPrepDays,
  landingBp,
  shoreBombardBp,
} from "@openfront/engine-lib/ww1936/InvasionRules";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import { joinBattle } from "../land/Battles";
import { enemyDivisionsIn, stopDivision } from "../land/Movement";
import { capture } from "../land/Occupation";
import { armyRows } from "../land/Plans";
import {
  atSea,
  damageDivisions,
  divisionWeightCenti,
  landDivisions,
  liftDivisions,
} from "../land/SeaLift";
import type { Army } from "../land/WwLand";
import { freeConvoysOf, routeFor } from "./Convoys";
import { navalPort } from "./Ports";
import { startVoyage } from "./SeaTransfer";
import type { Invasion, SeaRoute, Voyage, WwNavy } from "./WwNavy";

const ST_PREPARING = INVASION_STATES.indexOf("preparing");
const ST_READY = INVASION_STATES.indexOf("ready");
const ST_SAILING = INVASION_STATES.indexOf("sailing");
const ST_LANDING = INVASION_STATES.indexOf("landing");
const ST_RETURNING = INVASION_STATES.indexOf("returning");
const USE_SUPPLY = CONVOY_USES.indexOf("supply");
const MISSION_SUPPORT = FLEET_MISSIONS.indexOf("invasion_support");
const MISSION_STRIKE = FLEET_MISSIONS.indexOf("strike");
const FLEET_IN_BATTLE = FLEET_STATES.indexOf("battle");
const FLEET_RETURNING = FLEET_STATES.indexOf("returning");
const AMPHIBIOUS_EXPERT = admiralTraitBit("amphibious_expert");

/** Spec §11.4: a landing division starts its battle with 70% of its max org. */
const LANDING_ORG_PCT = 70;
/** Spec §11.4: a failed landing loses 20% more men and equipment going back. */
const EVACUATION_LOSS_PM = 200;
/** Spec §18.10: a port of naval base 5 or more taken by a landing is news to both sides. */
const MAJOR_PORT_LEVEL = 5;

const MSG = {
  ready: "events_display.ww1936_invasion_ready",
  launched: "events_display.ww1936_invasion_launched",
  landed: "events_display.ww1936_invasion_landed",
  failed: "events_display.ww1936_invasion_failed",
  aborted: "events_display.ww1936_invasion_aborted",
  portCaptured: "events_display.ww1936_port_captured",
} as const;

// ---- Orders (spec §11.1, §11.3) ----

/** army_invade / invasion_execute / invasion_cancel of `smallID`'s army. */
export function issueInvasionOrder(
  navy: WwNavy,
  smallID: number,
  order: InvasionOrder,
  tick: number,
  by: LandOrderSource = "player",
): WwOrderBlock | null {
  const a = navy.land.armies.get(order.army);
  if (a === undefined || a.owner !== smallID) return "no_army";
  let block: WwOrderBlock | null;
  switch (order.kind) {
    case "army_invade":
      block = orderInvasion(navy, a, order.target);
      break;
    case "invasion_execute":
      block = launchInvasion(navy, a.id, tick);
      break;
    case "invasion_cancel":
      block = cancelOrder(navy, a);
      break;
  }
  // P2 issueArmyOrder (spec §8.5): a player's order turns the army's auto
  // off; the AI's does not.
  if (block === null && by === "player" && a.auto) {
    a.auto = false;
    navy.land.markArmy(a.id);
  }
  return block;
}

/** Where an army stands for an invasion: one port of its side, nobody busy. */
interface ArmyAtPort {
  /** The region every division stands in; 0 when they are not all in one. */
  from: number;
  /** `from` is a working naval base the army's side controls, with a harbor. */
  inPort: boolean;
  /** A division fights, retreats, advances, rides a train or sails. */
  busy: boolean;
  rows: number[];
}

function armyAtPort(navy: WwNavy, a: Army): ArmyAtPort {
  const land = navy.land;
  const t = land.divisions;
  const rows = armyRows(land, a);
  let from = rows.length === 0 ? 0 : t.region[rows[0]];
  let busy = false;
  for (const r of rows) {
    if (t.region[r] !== from) from = 0;
    const m = t.mode[r];
    if (
      t.battle[r] !== 0 ||
      m === MOVE_RETREAT ||
      m === MOVE_ADVANCE ||
      m === MOVE_RAIL ||
      m === MOVE_SEA
    ) {
      busy = true;
    }
  }
  const inPort =
    from !== 0 &&
    land.sameSide(a.owner, land.controller[from]) &&
    navalPort(navy.ww, from) &&
    navy.scenario.harborOf(from) !== 0;
  return { from, inPort, busy, rows };
}

/** The sea regions a zone path crosses, each once, in path order. */
function srsOf(sc: ScenarioIndex, zones: readonly number[]): number[] {
  const out: number[] = [];
  for (const z of zones) {
    const sr = sc.zoneSr(z);
    if (sr !== 0 && !out.includes(sr)) out.push(sr);
  }
  return out;
}

/** Spec §11.1: the convoys' sea route from port `from` to `target`'s harbor zone; null when none. */
function invasionRoute(
  navy: WwNavy,
  owner: number,
  from: number,
  target: number,
): { zones: number[]; km: number; srs: number[] } | null {
  const sc = navy.scenario;
  const a = sc.harborOf(from);
  const b = sc.harborOf(target);
  if (a === 0 || b === 0) return null;
  const p = seaPath(sc, [a], [b], navy.passable(owner, false));
  return p === null ? null : { ...p, srs: srsOf(sc, p.zones) };
}

/** Spec §10.5: the convoys the divisions (ids) need. */
function convoysNeeded(navy: WwNavy, divs: readonly number[]): number {
  let n = 0;
  for (const id of divs) {
    n += divisionConvoys(divisionWeightCenti(navy.land, id));
  }
  return n;
}

/** Spec §11.2: an amphibious expert admiral leads an invasion support fleet of `owner` on the route. */
function amphibiousAdmiral(
  navy: WwNavy,
  owner: number,
  srs: readonly number[],
): boolean {
  for (const f of navy.fleetsOf(owner)) {
    if (f.mission !== MISSION_SUPPORT || !srs.includes(f.missionSr)) continue;
    const adm = navy.admirals.get(f.admiral);
    if (adm !== undefined && (adm.traits & AMPHIBIOUS_EXPERT) !== 0) {
      return true;
    }
  }
  return false;
}

/** Spec §11.1: the order. Preparation starts; another invasion of the army is replaced. */
function orderInvasion(
  navy: WwNavy,
  a: Army,
  target: number,
): WwOrderBlock | null {
  const land = navy.land;
  const sc = navy.scenario;
  const owner = a.owner;
  const old = navy.invasions.get(a.id);
  if (old !== undefined && old.state >= ST_SAILING) return "army_busy";
  if (sc.region(target) === undefined) return "bad_target";
  const ce = navy.econ.country(owner);
  if (ce === null) return "dead";
  const at = armyAtPort(navy, a);
  const route = at.inPort ? invasionRoute(navy, owner, at.from, target) : null;
  const divs = at.rows.map((r) => land.divisions.id[r]);
  const block = invasionBlock({
    divisions: at.rows.length,
    capacity: invasionCapacity(ce.stats, ce.researched),
    allInOnePort: at.inPort,
    anyInBattle: at.busy,
    targetCoastal: sc.harborOf(target) !== 0,
    targetEnemy: land.isEnemy(owner, land.controller[target]),
    routeKm: route?.km ?? null,
    convoysFree: freeConvoysOf(navy, owner),
    convoysNeed: convoysNeeded(navy, divs),
  });
  if (block !== null || route === null) return block ?? "no_sea_path";
  const t = land.divisions;
  const allMarines = at.rows.every(
    (r) => (land.flagsOf(r) & TPL_MARINE_ANY) !== 0,
  );
  setSorted(navy.invasions, a.id, {
    army: a.id,
    owner,
    target,
    from: at.from,
    state: ST_PREPARING,
    prepDays: invasionPrepDays(
      ce.stats,
      ce.researched,
      allMarines,
      amphibiousAdmiral(navy, owner, route.srs),
    ),
    prepDone: 0,
    voyage: 0,
    readySent: false,
  });
  // The army waits in the port (spec §11.2: it rests there by P2's rules).
  for (const r of at.rows) {
    if (t.mode[r] === MOVE_WALK) stopDivision(land, r);
  }
  setArmyOrder(navy, a, target);
  navy.markCountry(owner);
  return null;
}

/** invasion_cancel: a prepared invasion goes; one at sea turns back (spec §11.3). */
function cancelOrder(navy: WwNavy, a: Army): WwOrderBlock | null {
  const inv = navy.invasions.get(a.id);
  if (inv === undefined) return "invasion_not_ready";
  if (inv.state === ST_PREPARING || inv.state === ST_READY) {
    dropInvasion(navy, inv);
    return null;
  }
  if (inv.state === ST_SAILING) {
    const v = navy.voyages.get(inv.voyage);
    if (v !== undefined && abortVoyage(navy, inv, v)) return null;
  }
  return "army_busy";
}

/** Spec §11.1: another order for the army drops its invasion (P2 issueArmyOrder calls it); at sea it turns back. */
export function cancelInvasion(navy: WwNavy, army: number): void {
  const inv = navy.invasions.get(army);
  if (inv === undefined) return;
  if (inv.state === ST_PREPARING || inv.state === ST_READY) {
    navy.invasions.delete(army);
    navy.markCountry(inv.owner);
  } else if (inv.state === ST_SAILING) {
    const v = navy.voyages.get(inv.voyage);
    if (v !== undefined) abortVoyage(navy, inv, v);
  }
  // Landing and returning: the landing resolves on its own (spec §11.4).
}

/**
 * Spec §11.3: why the army's prepared invasion cannot sail now; null when
 * it can. In order: preparation, the army still in its port, the
 * capacity, idle convoys, the sea route, our side's supremacy ≥ 50% in
 * every sea region of the route (each region's last value), the target
 * still an enemy's.
 */
export function invasionLaunchBlock(
  navy: WwNavy,
  army: number,
): WwOrderBlock | null {
  const land = navy.land;
  const inv = navy.invasions.get(army);
  if (inv === undefined || inv.state !== ST_READY) {
    return "invasion_not_ready";
  }
  const a = land.armies.get(army);
  const ce = navy.econ.country(inv.owner);
  if (a === undefined || ce === null) return "no_army";
  const at = armyAtPort(navy, a);
  if (at.busy) return "army_busy";
  if (!at.inPort || at.from !== inv.from) return "not_in_port";
  if (at.rows.length > invasionCapacity(ce.stats, ce.researched)) {
    return "invasion_too_large";
  }
  const divs = at.rows.map((r) => land.divisions.id[r]);
  if (freeConvoysOf(navy, inv.owner) < convoysNeeded(navy, divs)) {
    return "no_convoys";
  }
  const route = invasionRoute(navy, inv.owner, inv.from, inv.target);
  if (route === null || route.km > WW_INVASION_MAX_KM) return "no_sea_path";
  const side = navy.sideOf(inv.owner);
  for (const sr of route.srs) {
    if (navy.supremacy(side, sr) < WW_INVASION_LAUNCH_SUP_PM) {
      return "naval_supremacy_low";
    }
  }
  if (!land.isEnemy(inv.owner, land.controller[inv.target])) {
    return "not_at_war";
  }
  return null;
}

/** Spec §11.3: the launch of a prepared invasion: lane C's voyage carries the army. */
export function launchInvasion(
  navy: WwNavy,
  army: number,
  tick: number,
): WwOrderBlock | null {
  const block = invasionLaunchBlock(navy, army);
  if (block !== null) return block;
  const inv = navy.invasions.get(army)!;
  const a = navy.land.armies.get(army)!;
  const divs = armyRows(navy.land, a).map((r) => navy.land.divisions.id[r]);
  const id = startVoyage(
    navy,
    inv.owner,
    army,
    divs,
    inv.from,
    inv.target,
    true,
    tick,
  );
  // Lane C refused (its own convoy and route checks).
  if (id === 0) return "no_sea_path";
  inv.state = ST_SAILING;
  inv.voyage = id;
  navy.markCountry(inv.owner);
  navy.land.markArmy(army);
  navy.message(inv.owner, MSG.launched, { region: inv.target });
  return null;
}

// ---- The country's day (spec §11.2, §11.3, §11.4, §11.5) ----

/** The country's day of invasions: preparation, auto launch, aborts at sea, landings resolved, beachheads. */
export function dailyInvasions(
  navy: WwNavy,
  smallID: number,
  day: number,
  tick: number,
): void {
  const land = navy.land;
  const p = navy.mg.playerBySmallID(smallID);
  // P5 plan decision 7: a human controls it now.
  const ai = !p.isPlayer() || !navy.ww.isHumanControlled(smallID);
  const mine = [...navy.invasions.values()].filter((x) => x.owner === smallID);
  for (const inv of mine) {
    if (navy.invasions.get(inv.army) !== inv) continue;
    const a = land.armies.get(inv.army);
    if (a === undefined) {
      navy.invasions.delete(inv.army);
      navy.markCountry(smallID);
      continue;
    }
    if (inv.state === ST_PREPARING || inv.state === ST_READY) {
      const at = armyAtPort(navy, a);
      // Spec §11.1: the divisions left the port, or it is lost or wrecked.
      if (
        at.busy ||
        !at.inPort ||
        at.from !== inv.from ||
        a.order.kind !== "invade"
      ) {
        dropInvasion(navy, inv);
        continue;
      }
      if (inv.state === ST_PREPARING && ++inv.prepDone >= inv.prepDays) {
        inv.state = ST_READY;
      }
      if (inv.state === ST_READY) {
        if (!inv.readySent) {
          inv.readySent = true;
          navy.message(smallID, MSG.ready, { region: inv.target });
        }
        // Spec §11.2: auto armies and the AI sail as soon as they can.
        if (ai || a.auto) launchInvasion(navy, inv.army, tick);
      }
      navy.markCountry(smallID);
    } else if (inv.state === ST_SAILING) {
      const v = navy.voyages.get(inv.voyage);
      if (v === undefined) {
        // The voyage ended without a landing (every division lost at sea).
        dropInvasion(navy, inv);
        continue;
      }
      const zone = voyageZone(navy, v);
      const sr = zone === 0 ? 0 : navy.scenario.zoneSr(zone);
      if (
        sr !== 0 &&
        navy.supremacy(navy.sideOf(smallID), sr) < WW_INVASION_ABORT_SUP_PM
      ) {
        abortVoyage(navy, inv, v);
      }
    } else if (inv.state === ST_LANDING) {
      resolveLanding(navy, inv, a, day, tick);
    } else if (inv.state === ST_RETURNING) {
      if (inv.voyage !== 0) {
        if (!navy.voyages.has(inv.voyage)) dropInvasion(navy, inv);
      } else if (++inv.prepDone >= inv.prepDays) {
        homeFromSea(navy, inv, a, tick);
      }
    }
  }
  dailyBeachheads(navy, smallID, day);
  sweepLandingMarks(navy, tick);
}

/** The zone a voyage is in now (its route's zone at zoneIdx); 0 when unknown. */
function voyageZone(navy: WwNavy, v: Voyage): number {
  const route = routeOfVoyage(navy, v);
  if (route === null || route.zones.length === 0) return 0;
  const i = Math.max(0, Math.min(route.zones.length - 1, v.zoneIdx));
  return route.zones[i];
}

/** Lane C's route of a voyage (routeFor; else the voyage's route id as it stands). */
function routeOfVoyage(navy: WwNavy, v: Voyage): SeaRoute | null {
  return (
    routeFor(navy, "voyage", v.owner, v.id) ?? navy.routes.get(v.route) ?? null
  );
}

/**
 * The port an invasion falls back to from `zone`: its departure port while
 * the side still holds it and it works, else the side's nearest working
 * port by sea (ties: the smaller region); 0 when none is reachable.
 */
function returnPort(
  navy: WwNavy,
  owner: number,
  from: number,
  zone: number,
): number {
  const land = navy.land;
  const sc = navy.scenario;
  if (zone === 0) return 0;
  const pass = navy.passable(owner, false);
  const ok = (r: number) =>
    land.sameSide(owner, land.controller[r]) &&
    navalPort(navy.ww, r) &&
    sc.harborOf(r) !== 0;
  if (ok(from) && seaPath(sc, [zone], [sc.harborOf(from)], pass) !== null) {
    return from;
  }
  const ports: number[] = [];
  for (const r of sc.landRegions) if (ok(r.id)) ports.push(r.id);
  if (ports.length === 0) return 0;
  const p = seaPath(
    sc,
    [zone],
    ports.map((r) => sc.harborOf(r)),
    pass,
  );
  if (p === null) return 0;
  const end = p.zones[p.zones.length - 1];
  return ports.find((r) => sc.harborOf(r) === end) ?? 0;
}

/** The km of the sea edge between neighbouring zones a and b (the shortest). */
function edgeKm(sc: ScenarioIndex, a: number, b: number): number {
  let km = -1;
  for (const e of sc.seaEdgesOf(a)) {
    if (e.to !== b) continue;
    const k = sc.seaEdge(e.edge).km;
    if (km < 0 || k < km) km = k;
  }
  return Math.max(0, km);
}

/**
 * Spec §11.3: the voyage turns back toward its departure port (lost: the
 * side's nearest port) from the zone it is in. Its route is found again
 * from there (zoneIdx 0, the first edge's milli-km to go); the voyage goes
 * on with `aborting` set, and landInvasion then lands it like a sea move.
 * False when no port of the side is reachable (it sails on).
 */
function abortVoyage(navy: WwNavy, inv: Invasion, v: Voyage): boolean {
  const sc = navy.scenario;
  const zone = voyageZone(navy, v) || sc.harborOf(inv.from);
  const port = returnPort(navy, inv.owner, inv.from, zone);
  if (port === 0) return false;
  const path = seaPath(
    sc,
    [zone],
    [sc.harborOf(port)],
    navy.passable(inv.owner, false),
  );
  if (path === null) return false;
  const route = routeOfVoyage(navy, v);
  if (route !== null) {
    route.zones = path.zones;
    route.km = path.km;
    route.srs = srsOf(sc, path.zones);
  }
  v.zoneIdx = 0;
  v.prog = 0;
  v.need =
    path.zones.length > 1 ? edgeKm(sc, path.zones[0], path.zones[1]) * 1000 : 0;
  v.to = port;
  v.aborting = true;
  inv.state = ST_RETURNING;
  navy.markCountry(inv.owner);
  navy.land.markArmy(inv.army);
  navy.message(inv.owner, MSG.aborted, { region: inv.target });
  return true;
}

// ---- The landing (spec §11.4) ----

/**
 * Spec §11.4: an invasion voyage arrives (lane C's stepSeaVoyages calls
 * it). The voyage ends here and its convoys are free. An empty enemy
 * region is taken this tick (its victory-point tile with it); a defended
 * one is attacked from the sea: the divisions stand in it, one attack
 * direction, at 70% of their max org, marked as landing. An aborted or
 * evacuating voyage lands in its port like a sea move.
 */
export function landInvasion(navy: WwNavy, voyage: number, tick: number): void {
  const v = navy.voyages.get(voyage);
  if (v === undefined) return;
  const land = navy.land;
  const t = land.divisions;
  const inv = navy.invasions.get(v.army);
  navy.voyages.delete(v.id);
  navy.routes.delete(v.route);
  navy.markCountry(v.owner);
  const ids = v.divisions.filter((id) => t.rowOf(id) >= 0);
  if (
    inv === undefined ||
    inv.voyage !== v.id ||
    v.aborting ||
    inv.state !== ST_SAILING
  ) {
    if (ids.length > 0) landDivisions(land, ids, v.to, false, tick);
    if (inv !== undefined && inv.voyage === v.id) dropInvasion(navy, inv);
    return;
  }
  const owner = v.owner;
  const target = inv.target;
  const ctl = land.controller[target];
  if (ids.length === 0) {
    dropInvasion(navy, inv);
    return;
  }
  if (!land.isEnemy(owner, ctl)) {
    // Peace (or our side took it) while at sea: our region takes them in,
    // else they sail back to a port of the side (none: they disband).
    const a = land.armies.get(inv.army);
    const port = land.sameSide(owner, ctl)
      ? 0
      : returnPort(navy, owner, inv.from, navy.scenario.harborOf(target));
    if (land.sameSide(owner, ctl)) {
      landDivisions(land, ids, target, false, tick);
    } else if (port !== 0 && a !== undefined) {
      setArmyIdle(navy, a);
      sendHome(navy, inv, a, ids, target, port, tick);
      return;
    } else {
      for (const id of ids) land.killDivision(t.rowOf(id), false);
    }
    dropInvasion(navy, inv);
    return;
  }
  const defended = enemyDivisionsIn(land, owner, target) > 0;
  if (!defended) capture(land, target, owner, tick);
  landDivisions(land, ids, target, true, tick);
  for (const id of ids) {
    const r = t.rowOf(id);
    t.org[r] = Math.floor((land.orgMaxOf(r) * LANDING_ORG_PCT) / 100);
    land.touchDivision(r);
  }
  navy.message(owner, MSG.landed, { region: target });
  navy.message(ctl, MSG.landed, { region: target });
  if (!defended) {
    landingWon(navy, inv, ctl, navy.day(tick));
    return;
  }
  const until = dayStartTick(
    navy.day(tick) + WW_BEACHHEAD_DAYS,
    navy.ww.prepEndTick(),
  );
  for (const id of ids) {
    setSorted(navy.landing, id, until);
    joinBattle(land, id, target);
  }
  inv.state = ST_LANDING;
  // While landing, `voyage` keeps the defender, negated (the voyage is
  // over): the port-captured news goes to it when the landing wins.
  inv.voyage = -ctl;
  land.markArmy(inv.army);
}

/**
 * The owner's day of a landing battle (spec §11.4): our side holds the
 * target → won; every landing division out of the attack (org 0: the
 * battle let them go) → failed, they go back to sea.
 */
function resolveLanding(
  navy: WwNavy,
  inv: Invasion,
  a: Army,
  day: number,
  tick: number,
): void {
  const land = navy.land;
  const t = land.divisions;
  const target = inv.target;
  if (land.sameSide(inv.owner, land.controller[target])) {
    landingWon(navy, inv, -inv.voyage, day);
    return;
  }
  const rows = armyRows(land, a).filter((r) => navy.landing.has(t.id[r]));
  if (rows.length === 0) {
    // Every landing division is gone.
    navy.message(inv.owner, MSG.failed, { region: target });
    navy.message(land.controller[target], MSG.failed, { region: target });
    dropInvasion(navy, inv);
    return;
  }
  const attacking = rows.some(
    (r) => t.battle[r] === target && t.role[r] === ROLE_ATTACK && t.org[r] > 0,
  );
  if (!attacking) landingFailed(navy, inv, a, rows, tick);
}

/**
 * Spec §11.4: back to sea toward the departure port (lost: the nearest of
 * the side's), 20% more men and equipment lost (sendHome). With no port of
 * the side anywhere they stay where they are.
 */
function landingFailed(
  navy: WwNavy,
  inv: Invasion,
  a: Army,
  rows: readonly number[],
  tick: number,
): void {
  const land = navy.land;
  const t = land.divisions;
  const target = inv.target;
  const ids = rows.map((r) => t.id[r]);
  for (const id of ids) navy.landing.delete(id);
  navy.message(inv.owner, MSG.failed, { region: target });
  navy.message(land.controller[target], MSG.failed, { region: target });
  const zone = navy.scenario.harborOf(target);
  const port = returnPort(navy, inv.owner, inv.from, zone);
  if (port === 0) {
    dropInvasion(navy, inv);
    return;
  }
  damageDivisions(land, ids, EVACUATION_LOSS_PM);
  const alive = ids.filter((id) => t.rowOf(id) >= 0);
  if (alive.length === 0 || !land.armies.has(a.id)) {
    dropInvasion(navy, inv);
    return;
  }
  setArmyIdle(navy, a);
  sendHome(navy, inv, a, alive, target, port, tick);
}

/**
 * Divisions (ids) go back over the sea from region `at` to `port`: on lane
 * C's voyage (`aborting`: landInvasion lands them like a sea move); when C
 * refuses one (no idle convoys, no route) on the landing's own convoys —
 * lifted (org 0) and at sea for the trip's days at 12 knots (navalSpeedPct)
 * before they land in a port of the side. State `returning`; with no
 * voyage (`voyage` 0) `prepDone` / `prepDays` count those days and `from`
 * is the port.
 */
function sendHome(
  navy: WwNavy,
  inv: Invasion,
  a: Army,
  ids: readonly number[],
  at: number,
  port: number,
  tick: number,
): void {
  const land = navy.land;
  const sc = navy.scenario;
  inv.state = ST_RETURNING;
  navy.markCountry(inv.owner);
  land.markArmy(a.id);
  const id = startVoyage(navy, inv.owner, a.id, ids, at, port, true, tick);
  const v = id === 0 ? undefined : navy.voyages.get(id);
  if (v !== undefined) {
    v.aborting = true;
    inv.voyage = id;
    return;
  }
  liftDivisions(land, ids);
  const path = seaPath(
    sc,
    [sc.harborOf(at)],
    [sc.harborOf(port)],
    navy.passable(inv.owner, false),
  );
  inv.voyage = 0;
  inv.from = port;
  inv.prepDone = 0;
  inv.prepDays = tripDays(navy, inv.owner, path?.km ?? 0);
}

/** Days at sea for `km` at 12 knots × (100 + navalSpeedPct) / 100; at least one (spec §11.3). */
function tripDays(navy: WwNavy, owner: number, km: number): number {
  const pct = Math.max(
    10,
    100 + (navy.econ.country(owner)?.stats.navalSpeedPct ?? 0),
  );
  // Metres a day: knots × 1,852 m × 24 h.
  const perDay = Math.floor((WW_CONVOY_SPEED_KN * 1852 * 24 * pct) / 100);
  return Math.max(1, Math.ceil((km * 1000) / perDay));
}

/**
 * The owner's day a convoy-less return ends: the army's divisions at sea
 * land in its port (lost meanwhile: the side's nearest; none: they wait
 * at sea another day).
 */
function homeFromSea(navy: WwNavy, inv: Invasion, a: Army, tick: number): void {
  const land = navy.land;
  const t = land.divisions;
  const port = returnPort(
    navy,
    inv.owner,
    inv.from,
    navy.scenario.harborOf(inv.from),
  );
  if (port === 0) return;
  const ids = armyRows(land, a)
    .filter((r) => atSea(land, r))
    .map((r) => t.id[r]);
  if (ids.length > 0) landDivisions(land, ids, port, false, tick);
  dropInvasion(navy, inv);
}

/**
 * Spec §11.4, §11.5: the landing holds the target. Its marks go; a target
 * with no working naval base is a 30-day beachhead (a port is lane C's sea
 * hub already); a port of naval base 5 or more is news to both sides.
 */
function landingWon(
  navy: WwNavy,
  inv: Invasion,
  defender: number,
  day: number,
): void {
  const land = navy.land;
  const target = inv.target;
  const a = land.armies.get(inv.army);
  if (a !== undefined) {
    for (const id of a.divisions) navy.landing.delete(id);
  }
  if (!navalPort(navy.ww, target)) {
    setSorted(navy.beachhead, target, {
      side: navy.sideOf(inv.owner),
      until: day + WW_BEACHHEAD_DAYS,
    });
  }
  if (
    (navy.econ.buildingArray("naval_base")[target] ?? 0) >= MAJOR_PORT_LEVEL
  ) {
    navy.message(inv.owner, MSG.portCaptured, { region: target });
    if (defender > 0) {
      navy.message(defender, MSG.portCaptured, { region: target });
    }
  }
  dropInvasion(navy, inv);
}

/** An invasion ends: its record goes, an army still on its invade order stands idle. */
function dropInvasion(navy: WwNavy, inv: Invasion): void {
  navy.invasions.delete(inv.army);
  navy.markCountry(inv.owner);
  const a = navy.land.armies.get(inv.army);
  if (a !== undefined && a.order.kind === "invade") setArmyIdle(navy, a);
}

function setArmyOrder(navy: WwNavy, a: Army, target: number): void {
  a.order = { ...idleOrder(), kind: "invade", to: target };
  a.front = [];
  a.path = [];
  a.planBp = 0;
  a.pending = true;
  navy.land.markArmy(a.id);
}

function setArmyIdle(navy: WwNavy, a: Army): void {
  a.order = idleOrder();
  a.front = [];
  a.path = [];
  a.planBp = 0;
  a.pending = true;
  navy.land.markArmy(a.id);
}

/**
 * Landing marks of dead divisions go, and those past their end tick once
 * the division is out of its landing battle (a landing battle that outlasts
 * the 30 days keeps its marks until it ends). Any country's day.
 */
function sweepLandingMarks(navy: WwNavy, tick: number): void {
  const t = navy.land.divisions;
  for (const [id, until] of [...navy.landing]) {
    const r = t.rowOf(id);
    if (
      r < 0 ||
      (tick > until &&
        !(t.battle[r] === t.region[r] && t.role[r] === ROLE_ATTACK))
    ) {
      navy.landing.delete(id);
    }
  }
}

// ---- The battle lines (spec §11.4; Battles.modInputOf reads them every round) ----

/**
 * Spec §11.4: a landing division's own landing cut, `attackBp` ≤ 0 (−70%,
 * marines −35%, landing_craft_2 +10%p: InvasionRules.landingBp) — the
 * landing part only. The coastal fort's cut is not in it: Battles adds
 * that itself from the effective coastal_fort level (coastalFortBp). Null
 * for any other division, and for a landing division attacking out of the
 * region it landed in.
 */
export function amphibiousModsFor(
  navy: WwNavy,
  battleRegion: number,
  row: number,
): CombatMods | null {
  const land = navy.land;
  const t = land.divisions;
  const until = navy.landing.get(t.id[row]);
  // The mark lasts as long as its landing battle (sweepLandingMarks).
  if (until === undefined || t.region[row] !== battleRegion) return null;
  const ce = navy.econ.country(t.owner[row]);
  if (ce === null) return null;
  const marines = (land.flagsOf(row) & TPL_MARINE_ANY) !== 0;
  return { attackBp: -landingBp(marines, ce.researched), defenseBp: 0 };
}

/**
 * Per tick: sea region → bombarding side → the cut. Fleets move only in
 * the navy's tick, after the land war's: within one tick the value cannot
 * change, and a restored game computes the same one.
 */
const bombardMemo = new WeakMap<
  WwNavy,
  { tick: number; bySr: Map<number, Map<number, number>> }
>();

/**
 * Spec §11.4: the defense cut of `side`'s divisions in `region` by enemy
 * shore bombardment, bp ≤ 0: the ships of the side attacking the region's
 * battle on invasion support or strike missions at sea in the sea region
 * of the region's harbor zone, Σ(heavy + light / 2) × 0.1% × (100 +
 * shoreBombardPct) / 100, at most 25% (the stats of the country with the
 * most guns there). Every battle of a coastal region of that sea region
 * gets it, not only landings (HOI4). Shore bombardment is a ship strike:
 * never on a no-strike region (Korea, Taiwan); a landing there is plain
 * ground war.
 */
export function shoreBombardAt(
  navy: WwNavy,
  region: number,
  side: number,
): number {
  const sc = navy.scenario;
  if (isNoStrike(sc, region)) return 0;
  const land = navy.land;
  const b = land.battles.get(region);
  if (b === undefined) return 0;
  const zone = sc.harborOf(region);
  const sr = zone === 0 ? 0 : sc.zoneSr(zone);
  if (sr === 0) return 0;
  const attSide = land.sideOf(b.attLead);
  if (attSide === side) return 0;
  const tick = navy.mg.ticks();
  let memo = bombardMemo.get(navy);
  if (memo === undefined || memo.tick !== tick) {
    memo = { tick, bySr: new Map() };
    bombardMemo.set(navy, memo);
  }
  let bySide = memo.bySr.get(sr);
  if (bySide === undefined) memo.bySr.set(sr, (bySide = new Map()));
  const kept = bySide.get(attSide);
  if (kept !== undefined) return kept;
  const bp = bombardBp(navy, sr, attSide);
  bySide.set(attSide, bp);
  return bp;
}

function bombardBp(navy: WwNavy, sr: number, attSide: number): number {
  const s = navy.scenario.sr(sr);
  if (s === undefined) return 0;
  const byOwner = new Map<number, number>();
  for (const z of s.members) {
    for (const fid of navy.fleetsIn(z)) {
      const f = navy.fleets.get(fid);
      if (
        f === undefined ||
        f.docked !== 0 ||
        (f.mission !== MISSION_SUPPORT && f.mission !== MISSION_STRIKE) ||
        f.state === FLEET_IN_BATTLE ||
        f.state === FLEET_RETURNING ||
        navy.sideOf(f.owner) !== attSide
      ) {
        continue;
      }
      let guns = 0;
      for (const id of f.ships) {
        const r = navy.ships.rowOf(id);
        if (r < 0) continue;
        const st = navy.shipStatsOf(r);
        guns += st.heavy + Math.floor(st.light / 2);
      }
      byOwner.set(f.owner, (byOwner.get(f.owner) ?? 0) + guns);
    }
  }
  let total = 0;
  let lead = 0;
  let leadGuns = 0;
  for (const [owner, guns] of [...byOwner].sort((x, y) => x[0] - y[0])) {
    total += guns;
    if (guns > leadGuns) {
      lead = owner;
      leadGuns = guns;
    }
  }
  const ce = lead === 0 ? null : navy.econ.country(lead);
  return ce === null ? 0 : shoreBombardBp(total, ce.stats);
}

// ---- Beachheads (spec §11.5) ----

/** Spec §11.5: the beachheads (lane C's coastal supply reads them; state in WwNavy). */
export function beachheads(
  navy: WwNavy,
): ReadonlyMap<number, { side: number; until: number }> {
  return navy.beachhead;
}

/**
 * Spec §11.5: a beachhead's coastal supply hub for `side`, milli (P2's
 * daily supply asks it for each side region without a working port):
 * min(6, convoys × 500 / route km) × the route efficiency, as a sea hub
 * (§10.3) — lane C's supply route of the beachhead (ref = the region)
 * carries it; 0 without one, past its 30 days or for another side.
 */
export function beachheadCapacityMilli(
  navy: WwNavy,
  region: number,
  side: number,
): number {
  const b = navy.beachhead.get(region);
  if (b === undefined || b.side !== side) return 0;
  if (navy.day(navy.mg.ticks()) > b.until) return 0;
  const owner = navy.land.controller[region];
  const route =
    routeFor(navy, "supply", owner, region) ??
    findRoute(navy, USE_SUPPLY, owner, region);
  if (route === null) return 0;
  const byConvoys = Math.floor(
    (route.got * WW_SUPPLY_CONVOY_KM * 1000) / Math.max(1, route.km),
  );
  const eff = routeEffPm(route.srs.map((sr) => enemySupPm(navy, side, sr)));
  return Math.floor(
    (Math.min(WW_BEACHHEAD_CAPACITY_MILLI, byConvoys) * eff) / 1000,
  );
}

/** The route of (use, owner, ref) as it stands in the navy's table. */
function findRoute(
  navy: WwNavy,
  use: number,
  owner: number,
  ref: number,
): SeaRoute | null {
  for (const r of navy.routes.values()) {
    if (r.use === use && r.owner === owner && r.ref === ref) return r;
  }
  return null;
}

/** The supremacy ‰ of the sides at war with `side` in a sea region (its last day). */
function enemySupPm(navy: WwNavy, side: number, sr: number): number {
  const sides = navy.sideList();
  const rep = sides.find((s) => s.key === side)?.rep ?? 0;
  let sum = 0;
  for (const s of sides) {
    if (s.key === side || !navy.isEnemy(rep, s.rep)) continue;
    sum += navy.supremacy(s.key, sr);
  }
  return Math.min(1000, sum);
}

/**
 * Spec §11.5, on the day of the country holding the beachhead: it ends
 * past its 30 days, when the side lost it, when it became a working port
 * (lane C's sea hub), or once a working port of the side reaches it over
 * the side's land ("a port taken ends the coastal supply").
 */
function dailyBeachheads(navy: WwNavy, smallID: number, day: number): void {
  const land = navy.land;
  for (const [region, b] of [...navy.beachhead]) {
    if (land.controller[region] !== smallID) continue;
    if (
      day > b.until ||
      navy.sideOf(smallID) !== b.side ||
      navalPort(navy.ww, region) ||
      portLinked(navy, region, b.side)
    ) {
      navy.beachhead.delete(region);
      navy.markCountry(smallID);
    }
  }
}

/** A working port of `side` reaches `region` over regions the side controls (BFS). */
function portLinked(navy: WwNavy, region: number, side: number): boolean {
  const land = navy.land;
  const sc = navy.scenario;
  const seen = new Set<number>([region]);
  const q = [region];
  for (let i = 0; i < q.length; i++) {
    for (const e of sc.edgesOf(q[i])) {
      const n = e.to;
      if (seen.has(n)) continue;
      seen.add(n);
      const c = land.controller[n];
      if (c === 0 || land.sideOf(c) !== side) continue;
      if (navalPort(navy.ww, n)) return true;
      q.push(n);
    }
  }
  return false;
}

// ---- Helpers ----

/** Sets `key` keeping the Map's iteration in key order (Global Constraints). */
function setSorted<V>(m: Map<number, V>, key: number, value: V): void {
  if (m.has(key)) {
    m.set(key, value);
    return;
  }
  let last = -Infinity;
  for (const k of m.keys()) last = k;
  m.set(key, value);
  if (key < last) {
    const e = [...m].sort((a, b) => a[0] - b[0]);
    m.clear();
    for (const [k, v] of e) m.set(k, v);
  }
}
