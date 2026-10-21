// World War 1936 P4: naval battles (P4 spec §9.1–§9.8), lane N2 (Task 4).
// One battle per sea zone (its id is the zone's), one round a tick in zone
// order (spec §2.2-6 ⑤). Every number is an integer expectation, no
// randomness. A round: positioning → screening → every ship's shots (half
// focused, half spread) → all the damage at once → carrier strike losses
// → sinkings → submarine reveal → retreats → the end check.
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  admiralTraitBit,
  ENGAGE_RULES,
  FLEET_MISSIONS,
  FLEET_STATES,
  SHIP_CLASSES,
  SHIP_ROLE,
  ShipClass,
  ShipStats,
  WW_HIT_CARRIER_PM,
  WW_HIT_DEPTH_PM,
  WW_HIT_HEAVY_PM,
  WW_HIT_LIGHT_PM,
  WW_HIT_TORPEDO_PM,
  WW_NAVAL_MAX_ROUNDS,
  WW_RESUME_DAYS,
  WW_SHIP_RETREAT_HP_PM,
  WW_SPOT_AFTER_ESCAPE_PM,
  WW_SUB_FIRE_REVEAL_PM,
  WW_SUB_REVEAL_PM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { combineMods } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  carrierScreenPm,
  fleetPower,
  orgDamageMilli,
  pierceFactorPm,
  posDamagePm,
  positioningPm,
  retreatRounds,
  screenPm,
  shotDamageMilli,
  sideRetreats,
  visFactorPm,
} from "@openfront/engine-lib/ww1936/NavalRules";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { deckAttackCenti, deckPlanes, loseStrikePlanes } from "./Carriers";
import { navalPort } from "./Ports";
import type { AdmiralState, Fleet, NavalBattle, WwNavy } from "./WwNavy";

/** Target groups (spec §9.4): escorts, capital ships, carriers, revealed submarines. */
const S = 0;
const C = 1;
const K = 2;
const U = 3;
const GROUP: Readonly<Record<ShipClass, number>> = {
  dd: S,
  cl: S,
  ca: C,
  bc: C,
  bb: C,
  cv: K,
  ss: U,
};
const AVOID = ENGAGE_RULES.indexOf("avoid");
const STRIKE = FLEET_MISSIONS.indexOf("strike");
const HOLD = FLEET_MISSIONS.indexOf("hold");
const ST_MOVING = FLEET_STATES.indexOf("moving");
const ST_ON_STATION = FLEET_STATES.indexOf("on_station");
const ST_SORTIE = FLEET_STATES.indexOf("sortie");
const ST_BATTLE = FLEET_STATES.indexOf("battle");
const ST_RETURNING = FLEET_STATES.indexOf("returning");
const ST_DOCKED = FLEET_STATES.indexOf("docked");
const ST_REPAIRING = FLEET_STATES.indexOf("repairing");
const TACTICIAN = admiralTraitBit("superior_tactician");
const AVIATOR = admiralTraitBit("aviation_enthusiast");
const SEA_WOLF = admiralTraitBit("sea_wolf");
const PROTECTOR = admiralTraitBit("fleet_protector");
/** Spec §7.4: superior tactician +10% positioning, fleet protector +15%p screening, ‰. */
const TACTICIAN_POS_PM = 100;
const PROTECTOR_SCREEN_PM = 150;
/** Spec §9.4: hit bonuses, % (fire_control_1 light and heavy guns, naval_radar_1 every weapon). */
const FIRE_CONTROL_HIT_PCT = 10;
const RADAR_HIT_PCT = 5;
const FIRE_CONTROL: WwTechId = "fire_control_1";
const RADAR: WwTechId = "naval_radar_1";
/** Spec §9.4: rounds between carrier strikes (base_strike_2's carrierRoundsCut takes one off). */
const CARRIER_EVERY = 3;

type SideIdx = 0 | 1;

/** A ship in a battle this round (row numbers hold within the tick). */
interface BShip {
  id: number;
  row: number;
  fleet: Fleet;
  owner: number;
  cls: ShipClass;
  stats: ShipStats;
  /** HP at the round's start (the focused fire reads it). */
  hp: number;
  /** A submarine not yet revealed (spec §9.5). */
  hidden: boolean;
  /** Retreating at the round's start: it does not shoot, hits on it are halved. */
  retreating: boolean;
  dead: boolean;
}

/** One side of a battle this round (spec §9.2, §9.3). */
interface SideCtx {
  ships: BShip[];
  /** Targetable ships by group (S, C, K, revealed submarines U), side order. */
  groups: BShip[][];
  /** Per group: the lowest HP ratio (ties: the smaller ship id), the focused fire's target. */
  focus: (BShip | null)[];
  /** The positioning count: hidden submarines left out. */
  count: number;
  /** The country with the most ships here: its stats set the side's formation. */
  lead: number;
  maneuver: number;
  coord: number;
  traits: number;
  pos: number;
  posDmg: number;
  screen: number;
  cScreen: number;
}

interface Hit {
  hp: number;
  org: number;
  /** Damage by shooting country (the kill goes to the most, ties the smaller smallID). */
  by: Map<number, number>;
}

/**
 * The ships still in a zone's battle on side 0 (attacker) or 1
 * (defender): fleet id order, then ship id order. Ships that got away
 * are left out; hidden submarines and retreating ships are in (screens,
 * test oracles).
 */
export function battleShipsOf(
  navy: WwNavy,
  zone: number,
  side: number,
): number[] {
  const b = navy.battles.get(zone);
  if (b === undefined || (side !== 0 && side !== 1)) return [];
  const t = navy.ships;
  const out: number[] = [];
  for (const fid of b.fleets[side]) {
    const f = navy.fleets.get(fid);
    if (f === undefined) continue;
    for (const id of f.ships) {
      const r = t.rowOf(id);
      if (r >= 0 && t.escape[r] !== 0) out.push(id);
    }
  }
  return out;
}

/**
 * Spec §9.1: side `side` engages enemy fleet `target` in `zone`. A battle
 * already there takes the target and the zone's fleets of its two sides
 * in; otherwise a new one opens (attacker `side`, defender the target's
 * side). Participants: the fleets at sea in the zone, by fleet id, whose
 * owners are at war with every country on the other side. Engaging fleets
 * elsewhere (strike forces) come by joinNavalBattle when they arrive; the
 * battle waits for them. The target's submarines are revealed (its
 * spotting opened the battle); every other submarine starts hidden.
 */
export function startNavalBattle(
  navy: WwNavy,
  zone: number,
  side: number,
  target: number,
  tick: number,
): void {
  const tf = navy.fleets.get(target);
  if (tf === undefined || tf.zone !== zone || tf.docked !== 0) return;
  const defSide = navy.sideOf(tf.owner);
  if (defSide === side) return;
  let b = navy.battles.get(zone);
  if (b === undefined) {
    b = {
      zone,
      sides: [side, defSide],
      fleets: [[], []],
      round: 0,
      startHp: [0, 0],
      startOrg: [0, 0],
      retreating: [false, false],
      sunk: [
        new Array<number>(SHIP_CLASSES.length).fill(0),
        new Array<number>(SHIP_CLASSES.length).fill(0),
      ],
      sunkNamed: [],
      startTick: tick,
    };
    navy.addBattle(b);
  }
  const ai = b.sides.indexOf(side);
  const di = b.sides.indexOf(defSide);
  // Another pair of sides fights here: one battle a zone (spec §9.1).
  if (ai < 0 || di < 0 || ai === di) return;
  joinFleet(navy, b, di as SideIdx, tf, true);
  const here = [...navy.fleetsIn(zone)];
  for (const s of [ai, di] as SideIdx[]) {
    for (const id of here) {
      const f = navy.fleets.get(id);
      if (f === undefined || f.docked !== 0 || inBattle(b, f.id)) continue;
      if (navy.sideOf(f.owner) !== b.sides[s]) continue;
      const foes = ownersOf(navy, b, (1 - s) as SideIdx);
      if (foes.every((o) => navy.isEnemy(f.owner, o))) {
        joinFleet(navy, b, s, f, false);
      }
    }
  }
}

/**
 * Spec §9.1: a fleet arriving in a battle's zone joins it on its side,
 * when its owner is at war with every country on the other side.
 */
export function joinNavalBattle(
  navy: WwNavy,
  zone: number,
  fleet: number,
): void {
  const b = navy.battles.get(zone);
  const f = navy.fleets.get(fleet);
  if (b === undefined || f === undefined) return;
  if (f.zone !== zone || f.docked !== 0 || inBattle(b, f.id)) return;
  const s = b.sides.indexOf(navy.sideOf(f.owner));
  if (s < 0) return;
  const foes = ownersOf(navy, b, (1 - s) as SideIdx);
  if (foes.length === 0 || !foes.every((o) => navy.isEnemy(f.owner, o))) {
    return;
  }
  joinFleet(navy, b, s as SideIdx, f, false);
}

/** One round of every naval battle, by zone (spec §2.2-6 ⑤). */
export function stepNavalBattles(navy: WwNavy, tick: number): void {
  for (const b of [...navy.battles.values()]) {
    if (navy.battles.get(b.zone) !== b) continue;
    prune(navy, b);
    if (b.round === 0) {
      // Still waiting for the engaging fleets: the target gone, or nobody coming.
      if (
        b.fleets[1].length === 0 ||
        (b.fleets[0].length === 0 && !engagersComing(navy, b))
      ) {
        endQuietly(navy, b);
        continue;
      }
      if (b.fleets[0].length === 0) continue;
      for (const s of [0, 1] as const) {
        for (const fid of b.fleets[s]) {
          const f = navy.fleets.get(fid)!;
          f.state = ST_BATTLE;
          navy.markFleet(f.id);
        }
      }
    }
    playRound(navy, b, tick);
  }
}

/**
 * Damage from outside a battle (air strikes, port strikes, ASW: lanes A2,
 * C, N2's port strikes): HP and org milli off one ship; at 0 HP it sinks
 * (sunk by `by`; world news for a named capital ship or carrier).
 */
export function applyShipDamage(
  navy: WwNavy,
  shipId: number,
  hpMilli: number,
  orgMilli: number,
  tick: number,
  /** The country whose guns, torpedoes or planes did it (P5 war score). */
  by: number,
): void {
  const t = navy.ships;
  const r = t.rowOf(shipId);
  if (r < 0) return;
  t.hp[r] = Math.max(0, t.hp[r] - Math.max(0, hpMilli));
  t.org[r] = Math.max(0, t.org[r] - Math.max(0, orgMilli));
  navy.markFleet(t.fleet[r]);
  if (t.hp[r] === 0) sinkShip(navy, shipId, tick, by);
}

/** A named capital ship or carrier: its sinking is world news (spec §9.8). */
export function isNamedBig(navy: WwNavy, row: number): boolean {
  const t = navy.ships;
  const role = SHIP_ROLE[SHIP_CLASSES[t.cls[row]]];
  return t.nameIdx[row] > 0 && (role === "capital" || role === "carrier");
}

/**
 * Sinks a ship (WwNavy.removeShip, the killer to P5's onShipSunk); a
 * named capital ship or carrier goes to P3's world news first.
 */
export function sinkShip(
  navy: WwNavy,
  id: number,
  tick: number,
  by: number,
): void {
  const t = navy.ships;
  const r = t.rowOf(id);
  if (r < 0) return;
  if (isNamedBig(navy, r)) {
    const f = navy.fleets.get(t.fleet[r]);
    // Controller ruling R3: country params end in "Tag"; none: "none".
    navy.ww.politics.news("ww1936_ship_sunk_named", {
      countryTag: navy.ww.tagOf(t.owner[r]),
      byTag: by > 0 ? navy.ww.tagOf(by) : "none",
      cls: SHIP_CLASSES[t.cls[r]],
      nameIdx: t.nameIdx[r],
      nameTag: navy.ww.tagOf(t.nameOwner[r]),
      sr: f === undefined ? 0 : navy.scenario.zoneSr(f.zone),
    });
  }
  navy.removeShip(id, true, tick, by);
}

// ---- Joining and leaving ----

function inBattle(b: NavalBattle, fleet: number): boolean {
  return b.fleets[0].includes(fleet) || b.fleets[1].includes(fleet);
}

/** The owners of a side's fleets, ascending. */
function ownersOf(navy: WwNavy, b: NavalBattle, s: SideIdx): number[] {
  const out: number[] = [];
  for (const fid of b.fleets[s]) {
    const o = navy.fleets.get(fid)?.owner;
    if (o !== undefined && !out.includes(o)) out.push(o);
  }
  return out.sort((x, y) => x - y);
}

/** Puts a fleet on side `s` (fleet id order), its ships fresh for the battle. */
function joinFleet(
  navy: WwNavy,
  b: NavalBattle,
  s: SideIdx,
  f: Fleet,
  revealed: boolean,
): void {
  const t = navy.ships;
  if (inBattle(b, f.id)) {
    // Spotted while in the battle: its submarines are seen now.
    if (revealed) {
      for (const id of f.ships) {
        const r = t.rowOf(id);
        if (r >= 0 && SHIP_CLASSES[t.cls[r]] === "ss") {
          t.reveal[r] = WW_SUB_REVEAL_PM;
        }
      }
    }
    return;
  }
  const list = b.fleets[s];
  let i = list.length;
  while (i > 0 && list[i - 1] > f.id) i--;
  list.splice(i, 0, f.id);
  for (const id of f.ships) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    t.escape[r] = -1;
    t.reveal[r] =
      revealed && SHIP_CLASSES[t.cls[r]] === "ss" ? WW_SUB_REVEAL_PM : 0;
    b.startHp[s] += t.hp[r];
    b.startOrg[s] += t.org[r];
  }
  if (b.round > 0) f.state = ST_BATTLE;
  navy.markFleet(f.id);
  navy.markBattle(b.zone);
}

/**
 * A fleet out of the battle: its ships' battle marks cleared, the side's
 * start sums less what it takes away (so the side's loss stays the same).
 */
function detach(navy: WwNavy, b: NavalBattle, s: SideIdx, f: Fleet): void {
  const list = b.fleets[s];
  const i = list.indexOf(f.id);
  if (i >= 0) list.splice(i, 1);
  const t = navy.ships;
  for (const id of f.ships) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    b.startHp[s] = Math.max(0, b.startHp[s] - t.hp[r]);
    b.startOrg[s] = Math.max(0, b.startOrg[s] - t.org[r]);
    t.escape[r] = -1;
    t.reveal[r] = 0;
  }
  navy.markFleet(f.id);
  navy.markBattle(b.zone);
}

/** Fleets no longer at sea in the zone (moved, docked, gone) are out. */
function prune(navy: WwNavy, b: NavalBattle): void {
  for (const s of [0, 1] as const) {
    for (const fid of [...b.fleets[s]]) {
      const f = navy.fleets.get(fid);
      if (f === undefined) {
        b.fleets[s].splice(b.fleets[s].indexOf(fid), 1);
      } else if (f.zone !== b.zone || f.docked !== 0) {
        detach(navy, b, s, f);
      }
    }
  }
}

/**
 * Lane N1's engageRegion sends the attacking side's engaging fleets to
 * the battle: strike forces on a sortie at its fleets, mission fleets
 * sailing to its zone. While one is on its way the battle waits (its
 * fleets listed: they hold where they are, SeaMove.battleFleetIds).
 */
function engagersComing(navy: WwNavy, b: NavalBattle): boolean {
  for (const m of navy.land.sideMembers(b.sides[0])) {
    for (const f of navy.fleetsOf(m)) {
      if (f.state === ST_SORTIE && b.fleets[1].includes(f.sortieTarget)) {
        return true;
      }
      if (f.path.length > 0 && f.dest === b.zone) return true;
    }
  }
  return false;
}

/** A battle that never began (nobody came, or the target left): gone without a word. */
function endQuietly(navy: WwNavy, b: NavalBattle): void {
  for (const s of [0, 1] as const) {
    for (const fid of [...b.fleets[s]]) {
      const f = navy.fleets.get(fid);
      if (f !== undefined) detach(navy, b, s, f);
    }
  }
  navy.endBattle(b.zone);
}

/**
 * Spec §9.7: a fleet that got away goes home to repair below its return
 * threshold, else back to its mission WW_RESUME_DAYS days later (lane N1's
 * applyFleetOrders waits for `resumeDay`); the other side's spotting of it
 * falls to 500‰. A winner keeps its mission (home too below the
 * threshold). A strike force stays on its sortie: N1's housekeeping
 * brings it home once the battle is over.
 */
function afterBattle(
  navy: WwNavy,
  f: Fleet,
  escaped: boolean,
  enemySide: number,
  day: number,
  tick: number,
): void {
  const t = navy.ships;
  let hp = 0;
  let max = 0;
  for (const id of f.ships) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    hp += t.hp[r];
    max += navy.shipStatsOf(r).hpMilli;
  }
  if (escaped && navy.spotPm(enemySide, f.id) > WW_SPOT_AFTER_ESCAPE_PM) {
    navy.setSpotPm(
      navy.scenario.zoneSr(f.zone),
      enemySide,
      f.id,
      WW_SPOT_AFTER_ESCAPE_PM,
    );
  }
  if (f.returnAtPct > 0 && hp * 100 < max * f.returnAtPct) {
    sendHome(navy, f, tick);
  } else {
    f.state =
      f.mission === STRIKE && f.sortieTarget !== 0
        ? ST_SORTIE
        : f.path.length > 0
          ? ST_MOVING
          : ST_ON_STATION;
    if (escaped) f.resumeDay = day + WW_RESUME_DAYS;
  }
  navy.markFleet(f.id);
}

/**
 * Home to repair, exactly as lane N1's SeaMove.sendHome (+ arriveFleet,
 * holdFleet), which this branch does not have yet (the integrator may
 * call it instead): returning on the shortest open sea path; already in
 * the home port's harbor zone it docks at once, repairing when it was on
 * a mission (docked for hold and strike); no way home: it holds where it
 * is.
 */
function sendHome(navy: WwNavy, f: Fleet, tick: number): void {
  void tick;
  const z = navy.harborZone(f.home);
  f.state = ST_RETURNING;
  f.sortieTarget = 0;
  f.edge = -1;
  f.prog = 0;
  f.need = 0;
  const p = z === 0 ? null : navy.pathFor(f, [z]);
  if (p === null) {
    f.mission = HOLD;
    f.missionSr = 0;
    f.path = [];
    f.dest = 0;
    f.state = ST_ON_STATION;
    return;
  }
  f.path = p.zones.slice(1);
  f.dest = p.zones[p.zones.length - 1];
  if (f.path.length > 0) return;
  f.path = [];
  const usable =
    navy.land.sameSide(f.owner, navy.land.controller[f.home] ?? 0) &&
    navalPort(navy.ww, f.home) &&
    z !== 0;
  if (f.zone === z && usable) {
    f.docked = f.home;
    f.dest = 0;
    f.state =
      f.mission === HOLD || f.mission === STRIKE ? ST_DOCKED : ST_REPAIRING;
  }
}

// ---- A round ----

const EMPTY_STATS = emptyStats();

function statsOf(navy: WwNavy, owner: number): WwStats {
  return navy.econ.country(owner)?.stats ?? EMPTY_STATS;
}

function admiralOf(navy: WwNavy, f: Fleet): AdmiralState | undefined {
  return f.admiral === 0 ? undefined : navy.admirals.get(f.admiral);
}

function hasTech(navy: WwNavy, owner: number, tech: WwTechId): boolean {
  return navy.econ.country(owner)?.researched.has(tech) ?? false;
}

/** The side's ships still in the battle (alive, not got away), side order. */
function sideShips(navy: WwNavy, b: NavalBattle, s: SideIdx): BShip[] {
  const t = navy.ships;
  const out: BShip[] = [];
  for (const fid of b.fleets[s]) {
    const f = navy.fleets.get(fid);
    if (f === undefined) continue;
    for (const id of f.ships) {
      const r = t.rowOf(id);
      if (r < 0 || t.escape[r] === 0) continue;
      const cls = SHIP_CLASSES[t.cls[r]];
      out.push({
        id,
        row: r,
        fleet: f,
        owner: f.owner,
        cls,
        stats: navy.shipStatsOf(r),
        hp: t.hp[r],
        hidden: cls === "ss" && t.reveal[r] < WW_SUB_REVEAL_PM,
        retreating: t.escape[r] > 0,
        dead: false,
      });
    }
  }
  return out;
}

/** The country with the most ships on the side (ties: the smaller smallID). */
function leadOf(ships: readonly BShip[]): number {
  const n = new Map<number, number>();
  for (const x of ships) n.set(x.owner, (n.get(x.owner) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [o, c] of [...n].sort((x, y) => x[0] - y[0])) {
    if (c > bestN) {
      best = o;
      bestN = c;
    }
  }
  return best;
}

/** Negative when `a` has the lower HP ratio. */
const hpRatioCmp = (a: BShip, b: BShip) =>
  a.hp * b.stats.hpMilli - b.hp * a.stats.hpMilli;

function sideCtx(navy: WwNavy, ships: BShip[]): SideCtx {
  const groups: BShip[][] = [[], [], [], []];
  let count = 0;
  let maneuver = 0;
  let coord = 0;
  let traits = 0;
  const seen = new Set<number>();
  for (const x of ships) {
    if (!x.hidden) {
      groups[GROUP[x.cls]].push(x);
      count++;
    }
    if (!seen.has(x.fleet.id)) {
      seen.add(x.fleet.id);
      const a = admiralOf(navy, x.fleet);
      if (a !== undefined) {
        maneuver = Math.max(maneuver, a.skills[2]);
        coord = Math.max(coord, a.skills[3]);
        traits |= a.traits;
      }
    }
  }
  const focus = groups.map((g) => {
    let best: BShip | null = null;
    for (const x of g) {
      const c = best === null ? -1 : hpRatioCmp(x, best);
      if (best === null || c < 0 || (c === 0 && x.id < best.id)) best = x;
    }
    return best;
  });
  return {
    ships,
    groups,
    focus,
    count,
    lead: leadOf(ships),
    maneuver,
    coord,
    traits,
    pos: 0,
    posDmg: 0,
    screen: 0,
    cScreen: 0,
  };
}

/** Spec §9.2, §9.3: both sides' positioning, screening and carrier screening. */
function formation(navy: WwNavy, a: SideCtx, d: SideCtx): void {
  for (const [me, them] of [
    [a, d],
    [d, a],
  ] as const) {
    const st = statsOf(navy, me.lead);
    me.pos = positioningPm(
      me.count,
      them.count,
      me.maneuver,
      st.positioningPct,
      (me.traits & TACTICIAN) !== 0 ? TACTICIAN_POS_PM : 0,
    );
    me.posDmg = posDamagePm(me.pos);
    me.screen = screenPm(
      me.groups[S].length,
      me.groups[C].length,
      me.groups[K].length,
      me.pos,
      me.coord * 50 +
        ((me.traits & PROTECTOR) !== 0 ? PROTECTOR_SCREEN_PM : 0) +
        st.screeningPct * 10,
    );
    me.cScreen = carrierScreenPm(
      me.groups[C].length,
      me.groups[K].length,
      me.pos,
    );
  }
}

/**
 * Spec §9.4: a weapon's share ‰ of each target group, `back` to the back
 * line (its carriers by carrier screening, or by count), an empty group's
 * share passed on S → C → K (and K's back to the front).
 */
function sharesOf(t: SideCtx, back: number, byCount: boolean): number[] {
  const n = [t.groups[S].length, t.groups[C].length, t.groups[K].length];
  let toK: number;
  if (byCount) {
    const nb = n[C] + n[K];
    toK = nb === 0 ? 0 : Math.floor((back * n[K]) / nb);
  } else {
    toK = Math.floor((back * (1000 - t.cScreen)) / 1000);
  }
  const out = [1000 - back, back - toK, toK, 0];
  if (n[S] === 0) {
    out[C] += out[S];
    out[S] = 0;
  }
  if (n[C] === 0) {
    out[K] += out[C];
    out[C] = 0;
  }
  if (n[K] === 0) {
    if (n[S] > 0) out[S] += out[K];
    else if (n[C] > 0) out[C] += out[K];
    out[K] = 0;
  }
  return out;
}

const DEPTH_SHARES = [0, 0, 0, 1000];

/**
 * Spec §9.4 modifiers, bp: (navy attack + admiral attack × 5 + doctrine
 * and traits) and (− the target's admiral defense × 4 − its navy
 * defense), combined like P2's (cuts stop at −90%).
 */
function modsBp(
  navy: WwNavy,
  shooter: BShip,
  target: BShip,
  carrierStrike: boolean,
): number {
  const sa = statsOf(navy, shooter.owner);
  const st = statsOf(navy, target.owner);
  const adm = admiralOf(navy, shooter.fleet);
  const tadm = admiralOf(navy, target.fleet);
  const traits = adm?.traits ?? 0;
  const adds = [sa.navyAttackPct * 100, (adm?.skills[0] ?? 0) * 500];
  const role = SHIP_ROLE[shooter.cls];
  if (carrierStrike) {
    // Spec §7.4: coordination +5% and the aviation enthusiast +20% carrier attack.
    adds.push(
      (sa.carrierStrikePct + sa.navalStrikePct) * 100,
      (adm?.skills[3] ?? 0) * 500,
      (traits & AVIATOR) !== 0 ? 2000 : 0,
    );
  } else if (role === "capital") {
    adds.push(sa.capitalAttackPct * 100);
  } else if (role === "sub") {
    adds.push(sa.subAttackPct * 100, (traits & SEA_WOLF) !== 0 ? 1500 : 0);
  }
  const cuts = [-(tadm?.skills[1] ?? 0) * 400, -st.navyDefensePct * 100];
  return combineMods(adds, cuts) - 10_000;
}

function addHit(
  hits: Map<number, Hit>,
  target: BShip,
  hpMilli: number,
  by: number,
): void {
  if (hpMilli <= 0) return;
  let h = hits.get(target.id);
  if (h === undefined) {
    h = { hp: 0, org: 0, by: new Map() };
    hits.set(target.id, h);
  }
  h.hp += hpMilli;
  h.org += orgDamageMilli(hpMilli, target.stats.orgMilli, target.stats.hpMilli);
  h.by.set(by, (h.by.get(by) ?? 0) + hpMilli);
}

/**
 * Side `a` shoots at `t` (spec §9.4): every ship not retreating and with
 * organisation left fires each weapon; the i-th shooter (side order) hits
 * the group's lowest HP ratio when i is even, its (i + round) mod n-th
 * ship when odd. A hidden submarine fires only its torpedoes. Returns the
 * submarines that fired and the carriers that struck.
 */
function fire(
  navy: WwNavy,
  round: number,
  a: SideCtx,
  t: SideCtx,
  hits: Map<number, Hit>,
): { subsFired: Set<number>; strikers: BShip[] } {
  const subsFired = new Set<number>();
  const strikers: BShip[] = [];
  const org = navy.ships.org;
  const light = sharesOf(t, 1000 - t.screen, false);
  const heavy = sharesOf(t, t.groups[S].length === 0 ? 1000 : 700, false);
  const subTorp = sharesOf(t, 1000 - Math.floor(t.screen / 2), false);
  const strike = sharesOf(t, 700, true);
  const canDepth = t.groups[U].length > 0;
  let i = 0;
  for (const sh of a.ships) {
    if (sh.retreating || org[sh.row] <= 0) continue;
    const me = i++;
    const st = sh.stats;
    const radar = hasTech(navy, sh.owner, RADAR) ? RADAR_HIT_PCT : 0;
    const guns =
      radar +
      (hasTech(navy, sh.owner, FIRE_CONTROL) ? FIRE_CONTROL_HIT_PCT : 0);
    const shoot = (
      attack: number,
      hitPm: number,
      hitPct: number,
      pierce: number | null,
      shares: readonly number[],
      depth: boolean,
      isStrike: boolean,
    ): boolean => {
      let any = false;
      if (attack <= 0) return any;
      for (let g = 0; g < 4; g++) {
        const grp = t.groups[g];
        if (shares[g] <= 0 || grp.length === 0) continue;
        const target =
          me % 2 === 0 ? t.focus[g]! : grp[(me + round) % grp.length];
        let hit = Math.floor((hitPm * (100 + hitPct)) / 100);
        if (target.retreating) hit = Math.floor(hit / 2);
        const pf =
          pierce === null ? 1000 : pierceFactorPm(pierce, target.stats.armor);
        const d = shotDamageMilli(
          attack,
          modsBp(navy, sh, target, isStrike),
          hit,
          visFactorPm(target.stats.vis, depth),
          a.posDmg,
          pf,
          shares[g],
        );
        addHit(hits, target, d, sh.owner);
        any = true;
      }
      return any;
    };
    if (sh.cls === "ss") {
      if (!sh.hidden) {
        shoot(
          st.light,
          WW_HIT_LIGHT_PM,
          guns,
          st.lightPierce,
          light,
          false,
          false,
        );
      }
      if (
        round % 2 === 0 &&
        shoot(st.torpedo, WW_HIT_TORPEDO_PM, radar, null, subTorp, false, false)
      ) {
        subsFired.add(sh.id);
      }
      continue;
    }
    shoot(st.light, WW_HIT_LIGHT_PM, guns, st.lightPierce, light, false, false);
    shoot(st.heavy, WW_HIT_HEAVY_PM, guns, st.heavyPierce, heavy, false, false);
    shoot(st.torpedo, WW_HIT_TORPEDO_PM, radar, null, light, false, false);
    if (canDepth) {
      shoot(st.depth, WW_HIT_DEPTH_PM, radar, null, DEPTH_SHARES, true, false);
    }
    if (sh.cls === "cv") {
      const every = Math.max(
        1,
        CARRIER_EVERY - statsOf(navy, sh.owner).carrierRoundsCut,
      );
      if (
        round % every === 0 &&
        shoot(
          deckAttackCenti(navy, sh.row, sh.owner),
          WW_HIT_CARRIER_PM,
          radar,
          null,
          strike,
          false,
          true,
        )
      ) {
        strikers.push(sh);
      }
    }
  }
  return { subsFired, strikers };
}

/** The killer of a ship hit this round: the country that did the most damage. */
function killerOf(h: Hit | undefined): number {
  if (h === undefined) return 0;
  let best = 0;
  let most = 0;
  for (const [o, d] of [...h.by].sort((x, y) => x[0] - y[0])) {
    if (d > most) {
      best = o;
      most = d;
    }
  }
  return best;
}

function maxSpeed(ships: readonly BShip[]): number {
  let m = 0;
  for (const x of ships) if (!x.dead) m = Math.max(m, x.stats.speedCentiKn);
  return m;
}

function playRound(navy: WwNavy, b: NavalBattle, tick: number): void {
  const t = navy.ships;
  const day = navy.day(tick);
  b.round++;
  const round = b.round;
  navy.markBattle(b.zone);
  const sr = navy.scenario.zoneSr(b.zone);
  // Spec §8.2, §9.7: an `avoid` fleet retreats from the first round (a
  // hidden submarine slips away in 2 rounds); a side of them all retreats.
  const pre: BShip[][] = [sideShips(navy, b, 0), sideShips(navy, b, 1)];
  for (const s of [0, 1] as const) {
    const enemyMax = maxSpeed(pre[1 - s]);
    let allAvoid = pre[s].length > 0;
    for (const x of pre[s]) {
      if (x.fleet.engage !== AVOID) {
        allAvoid = false;
        continue;
      }
      if (t.escape[x.row] < 0) {
        t.escape[x.row] = retreatRounds(
          x.stats.speedCentiKn,
          enemyMax,
          x.hidden,
        );
        x.retreating = true;
      }
    }
    if (allAvoid) b.retreating[s] = true;
  }
  const sides = [sideCtx(navy, pre[0]), sideCtx(navy, pre[1])];
  formation(navy, sides[0], sides[1]);
  // Every shot first, then all the damage at once (spec §9.4 end).
  const hits = new Map<number, Hit>();
  const shots = [
    fire(navy, round, sides[0], sides[1], hits),
    fire(navy, round, sides[1], sides[0], hits),
  ];
  for (const [id, h] of hits) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    t.hp[r] = Math.max(0, t.hp[r] - h.hp);
    t.org[r] = Math.max(0, t.org[r] - h.org);
    navy.markFleet(t.fleet[r]);
  }
  // Spec §9.4: the strike planes the enemy's anti-air and deck fighters take.
  for (const s of [0, 1] as const) {
    if (shots[s].strikers.length > 0) {
      strikeLosses(navy, shots[s].strikers, sides[1 - s]);
    }
  }
  sinkings(navy, b, sides, hits, tick, sr);
  // Spec §9.5: the hidden submarines' reveal.
  for (const s of [0, 1] as const) {
    let asw = 0;
    for (const e of sides[1 - s].ships) {
      if (!e.dead && (e.cls === "dd" || e.cls === "cl")) {
        asw += e.stats.subDetect;
      }
    }
    for (const x of sides[s].ships) {
      if (x.dead || !x.hidden) continue;
      const gain =
        Math.floor((asw * 10) / Math.max(1, x.stats.vis)) +
        (shots[s].subsFired.has(x.id) ? WW_SUB_FIRE_REVEAL_PM : 0);
      t.reveal[x.row] = Math.min(WW_SUB_REVEAL_PM, t.reveal[x.row] + gain);
    }
  }
  retreats(navy, b, sides, round);
  // Fleets whose every ship got away leave the battle.
  for (const s of [0, 1] as const) {
    for (const fid of [...b.fleets[s]]) {
      const f = navy.fleets.get(fid);
      if (f === undefined) continue;
      if (f.ships.every((id) => t.escape[t.rowOf(id)] === 0)) {
        detach(navy, b, s, f);
        afterBattle(navy, f, true, b.sides[1 - s], day, tick);
      }
    }
  }
  // The end (spec §9.7): a side with nobody left, both breaking off, or 40 rounds.
  const inN = [0, 0];
  const activeN = [0, 0];
  for (const s of [0, 1] as const) {
    for (const id of battleShipsOf(navy, b.zone, s)) {
      inN[s]++;
      if (t.escape[t.rowOf(id)] < 0) activeN[s]++;
    }
  }
  if (inN[0] === 0 || inN[1] === 0) {
    finish(navy, b, inN[0] > 0 ? 0 : inN[1] > 0 ? 1 : -1, day, tick);
  } else if (
    (activeN[0] === 0 && activeN[1] === 0) ||
    round >= WW_NAVAL_MAX_ROUNDS
  ) {
    finish(navy, b, -1, day, tick);
  }
}

/**
 * Spec §9.7: ships at 0 HP sink this round (the most damaging country
 * gets the kill); named capital ships and carriers are world news, the
 * rest one line per owner and class.
 */
function sinkings(
  navy: WwNavy,
  b: NavalBattle,
  sides: readonly SideCtx[],
  hits: Map<number, Hit>,
  tick: number,
  sr: number,
): void {
  const t = navy.ships;
  const bundles = new Map<number, number[]>();
  for (const s of [0, 1] as const) {
    for (const x of sides[s].ships) {
      const r = t.rowOf(x.id);
      if (r < 0 || t.hp[r] > 0) continue;
      x.dead = true;
      const ci = t.cls[r];
      b.sunk[s][ci]++;
      if (isNamedBig(navy, r)) {
        b.sunkNamed.push(x.id);
      } else {
        let n = bundles.get(x.owner);
        if (n === undefined) {
          n = new Array<number>(SHIP_CLASSES.length).fill(0);
          bundles.set(x.owner, n);
        }
        n[ci]++;
      }
      sinkShip(navy, x.id, tick, killerOf(hits.get(x.id)));
    }
  }
  for (const [owner, n] of [...bundles].sort((x, y) => x[0] - y[0])) {
    n.forEach((c, ci) => {
      if (c === 0) return;
      navy.message(owner, "events_display.ww1936_ship_sunk", {
        cls: SHIP_CLASSES[ci],
        n: c,
        sr,
        zone: b.zone,
      });
    });
  }
}

/**
 * Spec §9.7: the retreating count down (at 0 they got away); then a ship
 * under 25% HP or out of organisation retreats, and a side that lost 40%
 * of its HP, fell to 30% of its organisation or (after round 10) has less
 * than half the other's power retreats whole. Faster ships get away first.
 */
function retreats(
  navy: WwNavy,
  b: NavalBattle,
  sides: readonly SideCtx[],
  round: number,
): void {
  const t = navy.ships;
  for (const s of [0, 1] as const) {
    for (const x of sides[s].ships) {
      if (!x.dead && x.retreating && t.escape[x.row] > 0) t.escape[x.row]--;
    }
  }
  const hidden = (x: BShip) =>
    x.cls === "ss" && t.reveal[x.row] < WW_SUB_REVEAL_PM;
  for (const s of [0, 1] as const) {
    const enemyMax = maxSpeed(sides[1 - s].ships);
    const start = (x: BShip) => {
      t.escape[x.row] = retreatRounds(
        x.stats.speedCentiKn,
        enemyMax,
        hidden(x),
      );
    };
    for (const x of sides[s].ships) {
      if (x.dead || t.escape[x.row] >= 0) continue;
      if (
        t.hp[x.row] * 1000 < x.stats.hpMilli * WW_SHIP_RETREAT_HP_PM ||
        t.org[x.row] <= 0
      ) {
        start(x);
      }
    }
    if (!b.retreating[s]) {
      const sum = sideSums(navy, b, s);
      const mine = powerOf(navy, b, s);
      const theirs = powerOf(navy, b, s === 0 ? 1 : 0);
      const ratio = theirs === 0 ? 4000 : Math.floor((mine * 1000) / theirs);
      b.retreating[s] = sideRetreats(
        round,
        b.startHp[s],
        sum.hp,
        b.startOrg[s],
        sum.org,
        ratio,
        false,
      );
    }
    if (b.retreating[s]) {
      for (const x of sides[s].ships) {
        if (!x.dead && t.escape[x.row] < 0) start(x);
      }
    }
  }
}

/** A side's HP and organisation now: every ship of its fleets (got away or not). */
function sideSums(
  navy: WwNavy,
  b: NavalBattle,
  s: SideIdx,
): { hp: number; org: number } {
  const t = navy.ships;
  let hp = 0;
  let org = 0;
  for (const fid of b.fleets[s]) {
    for (const id of navy.fleets.get(fid)?.ships ?? []) {
      const r = t.rowOf(id);
      if (r < 0) continue;
      hp += t.hp[r];
      org += t.org[r];
    }
  }
  return { hp, org };
}

/** Spec §9.9: fleetPower of the side's ships still in the battle. */
function powerOf(navy: WwNavy, b: NavalBattle, s: SideIdx): number {
  const t = navy.ships;
  return fleetPower(
    battleShipsOf(navy, b.zone, s).map((id) => {
      const r = t.rowOf(id);
      return { stats: navy.shipStatsOf(r), hpMilli: t.hp[r] };
    }),
  );
}

/**
 * Spec §9.4: a side's carrier strike planes lost to the enemy's ships'
 * anti-air (Σ AA × 0.05 planes) and its deck fighters (airDuelMilli,
 * detection 1000).
 */
function strikeLosses(
  navy: WwNavy,
  strikers: readonly BShip[],
  enemy: SideCtx,
): void {
  const t = navy.ships;
  let aaCenti = 0;
  const fighters: { owner: number; counts: number[] }[] = [];
  for (const e of enemy.ships) {
    if (e.dead || t.rowOf(e.id) < 0) continue;
    aaCenti += e.stats.aa;
    if (e.cls === "cv") {
      const d = deckPlanes(navy, e.row)[0];
      if (d.some((n) => n > 0)) fighters.push({ owner: e.owner, counts: d });
    }
  }
  loseStrikePlanes(
    navy,
    strikers.map((x) => x.id),
    Math.floor(aaCenti / 2),
    fighters,
    enemy.lead,
  );
}

/**
 * The battle's end: the winner's fleets keep their missions, everyone
 * else got away (spec §9.7); the line goes to both sides' human players
 * (spec §9.8).
 */
function finish(
  navy: WwNavy,
  b: NavalBattle,
  winner: -1 | 0 | 1,
  day: number,
  tick: number,
): void {
  for (const s of [0, 1] as const) {
    for (const fid of [...b.fleets[s]]) {
      const f = navy.fleets.get(fid);
      if (f === undefined) continue;
      detach(navy, b, s, f);
      afterBattle(navy, f, winner !== s, b.sides[1 - s], day, tick);
    }
  }
  const sr = navy.scenario.zoneSr(b.zone);
  const lost = [0, 1].map((s) => b.sunk[s].reduce((x, y) => x + y, 0));
  for (const s of [0, 1] as const) {
    for (const m of navy.land.sideMembers(b.sides[s])) {
      navy.message(m, "events_display.ww1936_naval_battle", {
        sr,
        zone: b.zone,
        ours: lost[s],
        theirs: lost[1 - s],
      });
    }
  }
  navy.endBattle(b.zone);
}
