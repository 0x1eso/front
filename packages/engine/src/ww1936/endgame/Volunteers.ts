// World War 1936 P5 lane A (plan Task 6; spec §12, §13.5): volunteers,
// volunteer air groups and ship transfers.
//
// A volunteer army keeps its owner (men, equipment, reinforcement and
// experience are the sender's, P2 as it is) and fights for its host
// (Army.volunteerFor: sides, battles, captures, orders). It arrives on the
// host's front: walking from a region of the sender next to the host's
// side, else put down at once (org 0) where the sender's land touches the
// host's side or, by sea, in a port of the host's side the sender's
// convoys reach — then it walks to the nearest front region.
import {
  AIR_MISSION_TYPES,
  AIR_MISSIONS,
  AIR_TYPES,
  type AirType,
  CARRIER_AIR_TYPES,
  LAND_ZONE_MISSIONS,
  SEA_ZONE_MISSIONS,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_AIR_VOLUNTEER_MAX,
  WW_AIR_VOLUNTEER_PCT,
  WW_VOLUNTEER_MIN_DIV,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  idleOrder,
  MOVE_ADVANCE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
} from "@openfront/engine-api/ww1936/LandTypes";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { airDeployBlock } from "@openfront/engine-lib/ww1936/AirRules";
import {
  llBlock,
  volunteerBlock,
  volunteerCap,
  type VolunteerIn,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { borderRegionsOf } from "@openfront/engine-lib/ww1936/FrontRules";
import { basesInRange, isCarrierWing } from "../air/Deploy";
import type { Deployment } from "../air/WwAir";
import { leaveBattle } from "../land/Battles";
import { nearestBorder } from "../land/Fronts";
import { stopDivision } from "../land/Movement";
import { armyRows } from "../land/Plans";
import type { Army, WwLand } from "../land/WwLand";
import { convoyPath, freeConvoysOf, portZonesOf } from "../navy/Convoys";
import { cancelInvasion } from "../navy/Invasions";
import { navalPort } from "../navy/Ports";
import { convoysForDivisions } from "../navy/SeaTransfer";
import { addAccess } from "../politics/Treaties";
import { aidRuleBlocks, llIn, markAid, tensionPct, validId } from "./LendLease";
import type { WwEndgame } from "./WwEndgame";

const EVENT_ARRIVE = "gen_volunteers_arrive";

// ---- Conditions (spec §12.1) ----

/** Divisions of `from` serving `to` as volunteers now. */
export function volunteersSent(
  eg: WwEndgame,
  from: number,
  to: number,
): number {
  let n = 0;
  for (const a of eg.ww.land.armiesOf(from)) {
    if (a.volunteerFor === to) n += a.divisions.length;
  }
  return n;
}

/** Spec §12.1's inputs: `from` sends `armyDivs` divisions to `to`. */
export function volunteerIn(
  eg: WwEndgame,
  from: number,
  to: number,
  armyDivs: number,
): VolunteerIn {
  const ww = eg.ww;
  const land = ww.land;
  const enemies = ww.enemiesOf(to);
  return {
    self: from === to,
    targetAtWar: enemies.length > 0,
    atWarWithTargetEnemy: enemies.some((e) => ww.isAtWar(from, e)),
    atWarWithTarget: ww.isAtWar(from, to),
    senderDemocracy: ww.politics.country(from)?.ruling === IDEO_DEM,
    tensionPct: tensionPct(eg),
    senderDivs: land.rowsOf(from).length,
    targetDivs: land.rowsOf(to).length,
    alreadySent: volunteersSent(eg, from, to),
    armyDivs,
    ruleBlocks: aidRuleBlocks(ww.politics, from, to),
  };
}

/** Spec §12.1's cap for `from` → `to` less what already serves there. */
export function volunteerRoom(eg: WwEndgame, from: number, to: number): number {
  const land = eg.ww.land;
  return (
    volunteerCap(land.rowsOf(from).length, land.rowsOf(to).length) -
    volunteersSent(eg, from, to)
  );
}

/** A division the send leaves alone: fighting, retreating, advancing, on a train or ship. */
function busyRow(land: WwLand, r: number): boolean {
  const t = land.divisions;
  const m = t.mode[r];
  return (
    t.battle[r] !== 0 ||
    m === MOVE_RAIL ||
    m === MOVE_SEA ||
    m === MOVE_RETREAT ||
    m === MOVE_ADVANCE
  );
}

function freeArmy(land: WwLand, a: Army): boolean {
  return (
    a.volunteerFor === 0 &&
    a.order.kind !== "garrison" &&
    a.order.kind !== "paradrop"
  );
}

// ---- Arrival (spec §12.1 route; controller ruling: on the host's front) ----

interface Arrival {
  /** Where it enters the host's side. */
  entry: number;
  /** It walks there from where it stands (else it is put down there). */
  walk: boolean;
}

function hostSide(land: WwLand, host: number): (r: number) => boolean {
  return (r) => {
    const c = land.controller[r] ?? 0;
    return c !== 0 && land.sameSide(host, c);
  };
}

/** The host's front regions (its side's regions facing an enemy of it), ascending. */
export function hostFront(eg: WwEndgame, host: number): number[] {
  return borderRegionsOf(eg.ww.land, host, 0);
}

function pick(
  cands: readonly number[],
  front: ReadonlySet<number>,
  km: (r: number) => number,
): number {
  let best = 0;
  let bestF = false;
  let bestKm = 0;
  for (const r of cands) {
    const f = front.has(r);
    const k = km(r);
    if (
      best === 0 ||
      (f && !bestF) ||
      (f === bestF && (k < bestKm || (k === bestKm && r < best)))
    ) {
      best = r;
      bestF = f;
      bestKm = k;
    }
  }
  return best;
}

function arrivalOf(
  eg: WwEndgame,
  a: Army,
  from: number,
  to: number,
): Arrival | WwOrderBlock {
  const ww = eg.ww;
  const land = ww.land;
  const sc = ww.scenario;
  const here = land.armyRegion(a);
  const side = hostSide(land, to);
  const front = new Set(hostFront(eg, to));
  const km = (r: number) => (here === 0 ? 0 : sc.regionKm(here, r));
  // Walking: it stands on the sender's land next to the host's side.
  if (land.controller[here] === from) {
    const next = sc
      .edgesOf(here)
      .map((e) => e.to)
      .filter(side);
    if (next.length > 0) return { entry: pick(next, front, km), walk: true };
  }
  // Over the land border elsewhere.
  const touching: number[] = [];
  for (const r of sc.landRegions) {
    if (!side(r.id)) continue;
    if (sc.edgesOf(r.id).some((e) => land.controller[e.to] === from)) {
      touching.push(r.id);
    }
  }
  if (touching.length > 0) {
    return { entry: pick(touching, front, km), walk: false };
  }
  // By sea: a port of the sender to a port of the host's side.
  const navy = ww.navy;
  const ports = sc.landRegions
    .map((r) => r.id)
    .filter((r) => {
      const z = sc.harborOf(r);
      return z !== 0 && sc.zoneSr(z) !== 0 && side(r) && navalPort(ww, r);
    });
  const zones = [...new Set(ports.map((r) => sc.harborOf(r)))].sort(
    (x, y) => x - y,
  );
  const p = convoyPath(navy, from, portZonesOf(navy, from), zones);
  if (p === null) return "volunteer_conditions";
  if (freeConvoysOf(navy, from) < convoysForDivisions(navy, a.divisions)) {
    return "no_convoys";
  }
  const end = p.zones[p.zones.length - 1];
  const landing = ports.filter((r) => sc.harborOf(r) === end);
  return { entry: pick(landing, front, () => 0), walk: false };
}

/** Puts an army down in `to` at once, org 0 (no path, no battle). */
export function teleportArmy(land: WwLand, a: Army, to: number): void {
  const t = land.divisions;
  for (const r of armyRows(land, a)) {
    // A division on a convoy voyage moves with its voyage.
    if (t.mode[r] === MOVE_SEA && t.need[r] === 0) continue;
    leaveBattle(land, r);
    stopDivision(land, r);
    land.setDivisionRegion(r, to);
    t.dest[r] = to;
    t.org[r] = 0;
    land.touchDivision(r);
  }
  a.order = idleOrder();
  a.front = [];
  a.path = [];
  a.planBp = 0;
  a.pending = true;
  land.markArmy(a.id);
}

// ---- Orders ----

/** volunteers_send (spec §12.1): the whole army goes, its general with it. */
export function sendVolunteers(
  eg: WwEndgame,
  army: number,
  to: number,
  tick: number,
): WwOrderBlock | null {
  const ww = eg.ww;
  const land = ww.land;
  const a = land.armies.get(army);
  if (a === undefined) return "bad_index";
  const from = a.owner;
  if (
    !freeArmy(land, a) ||
    !validId(eg, to) ||
    !eg.isActor(from) ||
    !eg.isActor(to)
  ) {
    return "volunteer_conditions";
  }
  const rows = armyRows(land, a);
  if (rows.length === 0) return "bad_index";
  const block = volunteerBlock(volunteerIn(eg, from, to, rows.length));
  if (block !== null) return block;
  if (rows.some((r) => busyRow(land, r))) return "army_busy";
  const arr = arrivalOf(eg, a, from, to);
  if (typeof arr === "string") return arr;
  cancelInvasion(ww.navy, a.id);
  land.setVolunteerFor(a, to);
  a.auto = false;
  if (!arr.walk) teleportArmy(land, a, arr.entry);
  // On to the host's front, over the host's side (P2's own move order).
  const front = new Set(hostFront(eg, to));
  const dest =
    nearestBorder(land, front, [arr.entry], hostSide(land, to)) || arr.entry;
  if (dest !== land.armyRegion(a)) {
    land.issue(from, { kind: "army_move", army: a.id, region: dest }, "ai");
  }
  eg.volunteers.push({
    army: a.id,
    from,
    to,
    sinceDay: Math.max(0, ww.day(tick)),
    recall: false,
  });
  eg.message(to, "ww1936_volunteers_arrived", {
    fromTag: ww.politics.tagOf(from),
  });
  ww.politics.queueEvent(EVENT_ARRIVE, to, from, 0, 0);
  markAid(eg, from, to);
  return null;
}

/** volunteers_recall (spec §12.3): home on the next day. */
export function recallVolunteers(
  eg: WwEndgame,
  army: number,
  tick: number,
): WwOrderBlock | null {
  void tick;
  const v = eg.volunteers.find((x) => x.army === army);
  if (v === undefined) return "not_volunteer";
  if (!v.recall) {
    v.recall = true;
    markAid(eg, v.from, v.to);
  }
  return null;
}

/** The nearest region `owner` controls from `from` (land edges, ascending), else its capital, else any; 0: none. */
function homeRegion(land: WwLand, owner: number, from: number): number {
  const sc = land.scenario;
  if (from !== 0) {
    if (land.controller[from] === owner) return from;
    const seen = new Set<number>([from]);
    let frontier = [from];
    while (frontier.length > 0) {
      const next: number[] = [];
      for (const r of frontier) {
        for (const e of sc.edgesOf(r)) {
          if (seen.has(e.to)) continue;
          seen.add(e.to);
          if (land.controller[e.to] === owner) return e.to;
          next.push(e.to);
        }
      }
      frontier = next.sort((x, y) => x - y);
    }
  }
  const cap = land.ww.capitalRegion(owner);
  if (sc.region(cap) !== undefined && land.controller[cap] === owner) {
    return cap;
  }
  for (const r of sc.landRegions) {
    if (land.controller[r.id] === owner) return r.id;
  }
  return 0;
}

/** Spec §12.3: back to the sender's nearest region, org 0; a normal army again. */
function sendHome(eg: WwEndgame, a: Army): void {
  const land = eg.ww.land;
  const home = homeRegion(land, a.owner, land.armyRegion(a));
  land.setVolunteerFor(a, 0);
  if (home !== 0) teleportArmy(land, a, home);
}

/**
 * The common day (spec §12.3, §12.4; Volunteers' part of deliverLendLease):
 * a volunteer army whose sender joined the war on its host's enemies is
 * the sender's own army from now on; one recalled, or whose host is at
 * peace, gone (not an exile) or at war with the sender, comes home. A
 * split-off part of a volunteer army gets its own line. Volunteer air
 * groups come home (planes back to the stock) on the same conditions.
 */
export function dailyVolunteers(eg: WwEndgame, day: number): void {
  const ww = eg.ww;
  const land = ww.land;
  if (eg.volunteers.length > 0) {
    const listed = new Set(eg.volunteers.map((v) => v.army));
    for (const a of land.armies.values()) {
      if (a.volunteerFor > 0 && !listed.has(a.id)) {
        eg.volunteers.push({
          army: a.id,
          from: a.owner,
          to: a.volunteerFor,
          sinceDay: day,
          recall: false,
        });
      }
    }
    const keep: typeof eg.volunteers = [];
    for (const v of eg.volunteers) {
      const a = land.armies.get(v.army);
      if (a === undefined || a.volunteerFor !== v.to || a.owner !== v.from) {
        markAid(eg, v.from, v.to);
        continue;
      }
      if (!eg.isActor(v.from)) {
        land.setVolunteerFor(a, 0);
        markAid(eg, v.from, v.to);
        continue;
      }
      if (joinedHostsWar(eg, v.from, v.to)) {
        joinAsRegulars(eg, a, v.from, v.to);
        continue;
      }
      if (v.recall || mustReturn(eg, v.from, v.to)) {
        sendHome(eg, a);
        eg.message(v.to, "ww1936_volunteers_recalled", {
          fromTag: ww.politics.tagOf(v.from),
        });
        markAid(eg, v.from, v.to);
        continue;
      }
      keep.push(v);
    }
    eg.volunteers = keep;
  }
  const air = ww.air;
  for (const d of [...air.deployments.values()]) {
    if (d.volunteerFor <= 0) continue;
    if (
      !eg.isActor(d.owner) ||
      joinedHostsWar(eg, d.owner, d.volunteerFor) ||
      mustReturn(eg, d.owner, d.volunteerFor)
    ) {
      air.removeDeployment(d.id, true);
      air.markCountry(d.owner);
      markAid(eg, d.owner, d.volunteerFor);
    }
  }
}

/**
 * Spec §12.3 (review fix round, HOI4): the sender joined its host's war —
 * its volunteers stay where they stand as its own army (out of the cap and
 * of the host-land rule). Co-belligerents use each other's land (HOI4):
 * the host grants military access when the army stands on land its owner
 * could not otherwise enter, so the day's sweep leaves it there.
 */
function joinAsRegulars(eg: WwEndgame, a: Army, from: number, to: number) {
  const land = eg.ww.land;
  land.setVolunteerFor(a, 0);
  const stuck = armyRows(land, a).some(
    (r) => !land.canEnter(from, land.divisions.region[r]),
  );
  if (stuck) addAccess(eg.ww.politics, from, to);
  markAid(eg, from, to);
}

/** The sender is at war with an enemy of its host (spec §12.3). */
function joinedHostsWar(eg: WwEndgame, from: number, to: number): boolean {
  const ww = eg.ww;
  return ww.enemiesOf(to).some((e) => ww.isAtWar(from, e));
}

/** Spec §12.3: the host is at peace, gone (an exile stays), or at war with the sender. */
function mustReturn(eg: WwEndgame, from: number, to: number): boolean {
  const ww = eg.ww;
  return !eg.isActor(to) || !ww.hasWar(to) || ww.isAtWar(from, to);
}

// ---- Volunteer air groups (spec §12.4) ----

/** Spec §12.4: min(100, 20% of the sender's planes). */
export function airVolunteerCap(eg: WwEndgame, from: number): number {
  const ce = eg.ww.economy.country(from);
  if (ce === null) return 0;
  let n = 0;
  for (const t of AIR_TYPES) {
    for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) {
      const k = equipKey(t, g);
      n += ce.stock[k] + ce.planesDeployed[k];
    }
  }
  return Math.min(
    WW_AIR_VOLUNTEER_MAX,
    Math.floor((n * WW_AIR_VOLUNTEER_PCT) / 100),
  );
}

/** The planes the sender's volunteer groups hold or wait for (their targets). */
export function airVolunteersOut(eg: WwEndgame, from: number): number {
  const seen = new Set<string>();
  let n = 0;
  for (const d of eg.ww.air.deploymentsOf(from)) {
    if (d.volunteerFor <= 0 || isCarrierWing(d)) continue;
    const key = `${d.sr}:${d.type}:${d.mission}:${d.volunteerFor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    n += d.target;
  }
  return n;
}

function missionFor(plane: AirType, kind: "land" | "sea"): number {
  const allowed = kind === "sea" ? SEA_ZONE_MISSIONS : LAND_ZONE_MISSIONS;
  return AIR_MISSIONS.findIndex(
    (m) =>
      m !== "paradrop" &&
      allowed.includes(m) &&
      AIR_MISSION_TYPES[m].includes(plane),
  );
}

function planesInStock(eg: WwEndgame, from: number, plane: AirType): number {
  const ce = eg.ww.economy.country(from);
  if (ce === null) return 0;
  let n = 0;
  for (let g = 1; g <= EQUIPMENT_GENS[plane]; g++) {
    n += ce.stock[equipKey(plane, g)];
  }
  return n;
}

/**
 * air_volunteers (spec §12.4): a volunteer group of `count` `plane` over
 * `zone` from air bases of the host's side; P4's daily refill draws the
 * planes (Deploy.refill: the group's side is the host's, deploymentSide).
 */
export function sendAirVolunteers(
  eg: WwEndgame,
  from: number,
  to: number,
  zone: number,
  plane: AirType,
  count: number,
  tick: number,
): WwOrderBlock | null {
  void tick;
  const ww = eg.ww;
  if (!validId(eg, to) || !eg.isActor(from) || !eg.isActor(to)) {
    return "volunteer_conditions";
  }
  // The political conditions of §12.1 (planes need no divisions of their own).
  const vi = volunteerIn(eg, from, to, 0);
  vi.senderDivs = Math.max(vi.senderDivs, WW_VOLUNTEER_MIN_DIV);
  const block = volunteerBlock(vi);
  if (block !== null) return block;
  const s = ww.scenario.sr(zone);
  if (s === undefined) return "bad_zone";
  if ((CARRIER_AIR_TYPES as readonly AirType[]).includes(plane)) {
    return "bad_air_mission";
  }
  if (airVolunteersOut(eg, from) + count > airVolunteerCap(eg, from)) {
    return "volunteer_limit";
  }
  const mission = missionFor(plane, s.kind);
  if (mission < 0) return "bad_air_mission";
  const air = ww.air;
  const type = AIR_TYPES.indexOf(plane);
  const group = air
    .deploymentsOf(from)
    .filter(
      (d) =>
        d.sr === zone &&
        d.type === type &&
        d.mission === mission &&
        d.volunteerFor === to &&
        !isCarrierWing(d),
    );
  let range = 0;
  for (let g = 1; g <= EQUIPMENT_GENS[plane]; g++) {
    range = Math.max(range, air.planeStatsOf(from, plane, g).rangeKm);
  }
  const used = air.deploymentsOf(from).filter((d) => !isCarrierWing(d)).length;
  const b = airDeployBlock({
    sr: zone,
    srKind: s.kind,
    type: plane,
    mission: AIR_MISSIONS[mission],
    count,
    have: planesInStock(eg, from, plane),
    deploymentsUsed: group.length > 0 ? 0 : used,
    anyBaseInRange:
      basesInRange(air, ww.land.sideOf(to), zone, range).length > 0,
  });
  if (b !== null) return b;
  if (group.length > 0) {
    const target = group[0].target + count;
    for (const d of group) {
      d.target = target;
      air.markDeployment(d.id);
    }
  } else {
    const d: Omit<Deployment, "id"> = {
      owner: from,
      sr: zone,
      type,
      mission,
      counts: new Array<number>(EQUIPMENT_GENS[plane]).fill(0),
      target: count,
      base: 0,
      lossRest: 0,
      auto: false,
      volunteerFor: to,
    };
    air.addDeployment(d);
  }
  air.markCountry(from);
  markAid(eg, from, to);
  return null;
}

// ---- Ships (spec §13.5, §16.4) ----

/** ships_transfer (spec §13.5): at once, under §13.2's conditions. */
export function transferShips(
  eg: WwEndgame,
  from: number,
  to: number,
  ships: readonly number[],
  tick: number,
): WwOrderBlock | null {
  const ww = eg.ww;
  if (!validId(eg, to)) return "bad_index";
  const block = llBlock(llIn(eg, from, to, Math.max(0, ww.day(tick))));
  if (block !== null) return block;
  const navy = ww.navy;
  const t = navy.ships;
  const ids = [...new Set(ships)].sort((x, y) => x - y);
  for (const id of ids) {
    const r = t.rowOf(id);
    if (r < 0 || t.owner[r] !== from) return "ships_not_owned";
  }
  // P4's transferShip removes a ship with no naval base to go to.
  const sc = ww.scenario;
  const havePort = sc.landRegions.some(
    (r) =>
      ww.land.controller[r.id] === to &&
      navalPort(ww, r.id) &&
      sc.harborOf(r.id) !== 0,
  );
  if (!havePort) return "ll_conditions";
  for (const id of ids) navy.transferShip(id, to);
  markAid(eg, from, to);
  return null;
}

/** Spec §16.4: `owner`'s ships, heaviest by supremacy weight first (ties: smaller id), until `pct`% of the weight. */
export function shipsByWeight(
  eg: WwEndgame,
  owner: number,
  pct: number,
): number[] {
  const navy = eg.ww.navy;
  const t = navy.ships;
  const all: { id: number; w: number }[] = [];
  for (let r = 0; r < t.rows; r++) {
    if (!t.alive(r) || t.owner[r] !== owner) continue;
    all.push({ id: t.id[r], w: navy.shipStatsOf(r).supWeight });
  }
  all.sort((a, b) => b.w - a.w || a.id - b.id);
  let total = 0;
  for (const s of all) total += s.w;
  const p = Math.max(0, Math.min(100, pct));
  const out: number[] = [];
  if (total <= 0) {
    const n = Math.ceil((all.length * p) / 100);
    return all.slice(0, n).map((s) => s.id);
  }
  const target = Math.ceil((total * p) / 100);
  let taken = 0;
  for (const s of all) {
    if (taken >= target) break;
    out.push(s.id);
    taken += s.w;
  }
  return out;
}

/** scuttle_fleet (spec §16.4): the share sinks by its own hand (no war score). */
export function scuttleFleet(
  eg: WwEndgame,
  owner: number,
  pct: number,
  tick: number,
): void {
  for (const id of shipsByWeight(eg, owner, pct)) {
    eg.ww.navy.removeShip(id, false, tick);
  }
}

// ---- The volunteers effect and the AI's pick (spec §16.4, §17.4) ----

/**
 * Spec §17.4: the strongest free army of `from` with at most `n`
 * divisions; with none, its `n` strongest free divisions as a new army
 * (fewer when it has fewer); null when it has none.
 */
export function pickVolunteerArmy(
  eg: WwEndgame,
  from: number,
  n: number,
): Army | null {
  const land = eg.ww.land;
  const t = land.divisions;
  if (n <= 0) return null;
  let best: Army | null = null;
  let bestS = -1;
  for (const a of land.armiesOf(from)) {
    if (!freeArmy(land, a)) continue;
    const rows = armyRows(land, a);
    if (rows.length === 0 || rows.length > n) continue;
    if (rows.some((r) => busyRow(land, r))) continue;
    let s = 0;
    for (const r of rows) s += land.strengthOf(r);
    if (s > bestS) {
      best = a;
      bestS = s;
    }
  }
  if (best !== null) return best;
  const free = land
    .rowsOf(from)
    .filter((r) => {
      const a = land.armies.get(t.army[r]);
      return a !== undefined && freeArmy(land, a) && !busyRow(land, r);
    })
    .map((r) => ({ r, id: t.id[r], s: land.strengthOf(r) }))
    .sort((x, y) => y.s - x.s || x.id - y.id)
    .slice(0, n);
  if (free.length === 0) return null;
  const b = land.newArmy(from);
  if (b === null) return null;
  for (const x of free) land.moveToArmy(x.id, b);
  b.pending = true;
  land.markArmy(b.id);
  return b;
}

/** The plane type a volunteer group flies: the one with most in stock (ties: AIR_TYPES order); null with none. */
function volunteerPlane(eg: WwEndgame, from: number): AirType | null {
  let best: AirType | null = null;
  let bestN = 0;
  for (const t of AIR_TYPES) {
    if ((CARRIER_AIR_TYPES as readonly AirType[]).includes(t)) continue;
    if (t === "transport_plane") continue;
    const n = planesInStock(eg, from, t);
    if (n > bestN) {
      best = t;
      bestN = n;
    }
  }
  return best;
}

/** The air zone over the host's front (its first front region's), else over its capital; 0: none. */
function volunteerZone(eg: WwEndgame, to: number): number {
  const sc = eg.ww.scenario;
  const front = hostFront(eg, to);
  const r = front.length > 0 ? front[0] : eg.ww.capitalRegion(to);
  return sc.region(r) === undefined ? 0 : sc.regionSr(r);
}

/**
 * The volunteers effect (spec §16.4) and the AI's sends (§17.4): the
 * actor's pick of `divisions` divisions (within the cap) and a group of
 * `planes` planes (within the cap and its stock).
 */
export function applyVolunteersEffect(
  eg: WwEndgame,
  from: number,
  to: number,
  divisions: number,
  planes: number,
  tick: number,
): void {
  if (divisions > 0) {
    const n = Math.min(divisions, volunteerRoom(eg, from, to));
    if (n > 0 && volunteerBlock(volunteerIn(eg, from, to, n)) === null) {
      const a = pickVolunteerArmy(eg, from, n);
      if (a !== null) sendVolunteers(eg, a.id, to, tick);
    }
  }
  if (planes > 0) {
    const plane = volunteerPlane(eg, from);
    const zone = volunteerZone(eg, to);
    if (plane === null || zone === 0) return;
    const count = Math.min(
      planes,
      airVolunteerCap(eg, from) - airVolunteersOut(eg, from),
      planesInStock(eg, from, plane),
    );
    if (count > 0) {
      sendAirVolunteers(eg, from, to, zone, plane, count, tick);
    }
  }
}
