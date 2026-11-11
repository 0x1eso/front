// The Imjin sea AI (ww175 design §9 "Sea", ww177 lane I5b). It steers the
// fleets of every country no human steers, with the orders a player has
// (move, hold, keep range or board, formation, break off, lure) plus the
// fire ship and the escort of the sea layer, by each fleet's state:
// - Joseon keeps a fleet in being: it fights at range in crane wing when it
//   can choose, raids the convoy groups in its home waters, and when a
//   stronger fleet comes it springs a lure from lee water, holds a narrow
//   channel, or falls back on its main fleet.
// - Japan masses its fleets under the strongest, escorts its supply groups,
//   seeks a decisive fight only when the massed fleet outweighs the foe,
//   closes to board, sends fire ships into packed enemies, keeps out of
//   narrow water it cannot force, and waits when the current runs against it.
// - Ming's fleet, sent by state (SeaStart.mingFleetByState), blockades
//   Japan's busiest landing or joins Joseon's main fleet.
// Once a day each fleet out of battle picks its aim (seaAiDay); every volley
// each fleet in battle picks its order (seaAiVolley).
import { DOCTRINE_FLAGS } from "@openfront/engine-lib/imjin/Doctrine";
import type { Formation } from "@openfront/engine-lib/imjin/SeaRules";
import {
  angleOf,
  BOARD_RANGE_MT,
  currentSpeedPct,
  currentState,
  distMt,
  fireShipWindOk,
  MT,
  shipStats,
  SIGHT_OPEN_MT,
  takesBait,
  VOLLEY_TICKS,
  WIND_PERIOD_DAYS,
  windAt,
} from "@openfront/engine-lib/imjin/SeaRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { USE_SUPPLY } from "../../ww1936/navy/Convoys";
import { navalPortsOf } from "../../ww1936/navy/Ports";
import type { WwImjin } from "../WwImjin";
import { flagsAt, type SeaCtx, tileAt, tileCentre } from "./SeaCtx";
import { seaOrder, splitFleet } from "./SeaFleets";
import { mingFleetByState } from "./SeaStart";
import type { SeaBattle, SeaFleet, SeaShip, SeaState } from "./SeaState";
import { fleetStrength, shipIndex } from "./SeaState";

export { fleetStrength };

/** How far a keep-range fleet looks for a target, milli-tiles. */
const HUNT_MT = 260 * MT;
/**
 * Japan's massed fleet looks across the whole strait: Nagoya to Busan is
 * about 260 tiles, and the landing needs the Joseon fleets on the way gone.
 */
const BOARD_HUNT_MT = 420 * MT;
/**
 * Joseon holds its own waters (design §9): it seeks a foe only this close
 * to one of its ports, milli-tiles.
 */
const HOME_WATERS_MT = 90 * MT;
/** Fleets this close to a point count as one mass. */
const MASS_MT = 15 * MT;
/** A follower closer than this to its leader sails with it. */
const GATHER_MT = 6 * MT;
/** How far a keep-range fleet watches for a stronger foe. */
const THREAT_MT = 40 * MT;
/** A keep-range fleet fights a mass up to this share of its own (%): its guns outrange. */
const RANGE_FIGHT_PCT = 160;
/** In a narrow channel it holds against this much (%): only 3 ships a side fight there. */
const CHANNEL_FIGHT_PCT = 300;
/**
 * A boarding fleet seeks battle only when its mass outweighs the foe by
 * this (%): a keep-range fleet's guns tell long before the grapples do.
 */
const BOARD_ATTACK_PCT = 200;
/** It forces a narrow channel only at this weight (%). */
const BOARD_CHANNEL_PCT = 250;
/** Search radii for lee water and channels, tiles. */
const LEE_SCAN = 12;
const CHANNEL_SCAN = 25;
/** A lure needs a friendly fleet lying this close to its trap. */
const TRAP_MT = 3 * MT;
/** A fleet further than this from its ports goes home when it has nothing to do. */
const IDLE_HOME_MT = 30 * MT;
/** Below this hull share (‰) a fleet goes home to mend. */
const MEND_HULL_PM = 550;
/** It sails again once mended to this share. */
const SAIL_HULL_PM = 850;
/** In battle: a keep-range fleet breaks off below this morale when outweighed by 120%. */
const RANGE_BREAK_MORALE = 450;
const RANGE_BREAK_PCT = 120;
const RANGE_BREAK_HULL_PM = 400;
/** A boarding fleet presses harder: below this morale and outweighed by 150%. */
const BOARD_BREAK_MORALE = 300;
const BOARD_BREAK_PCT = 150;
const BOARD_BREAK_HULL_PM = 300;
/** Ming boards when it outweighs the foe in battle by this (%). */
const MING_BOARD_PCT = 150;
/** Fire ships: sent at an enemy this close that has this many ships packed within 2 tiles. */
const FIRE_SHIP_RANGE_MT = 6 * MT;
const FIRE_SHIP_PACK = 3;
const FIRE_SHIPS_AT_ONCE = 2;
/** The bait roll: a pursuer's bar is its admiral's caution plus up to this (‰). */
const BAIT_ROLL_PM = 600;
const P_SEA_AI_BAIT = idHash("imjin_sea_ai_bait");

/** What the sea AI reads of the game (WwImjin builds it; tests build their own). */
export interface SeaAiView {
  st: SeaState;
  ctx: SeaCtx;
  jos: number;
  jpn: number;
  min: number;
  /** The AI steers this country's fleets. */
  steers(owner: number): boolean;
  /** The country is at war with someone. */
  atWar(owner: number): boolean;
  /** On the same side (the same country or allies). */
  friends(a: number, b: number): boolean;
  /** The berth tiles of a country's naval ports, in region order. */
  ports(owner: number): readonly number[];
  /** Supply routes with convoys, in id order; `to` is the landing berth tile (-1: none). */
  routes: readonly { id: number; owner: number; got: number; to: number }[];
  /**
   * ww177 P7b (doctrine §3): Japan has lost 40 ships in 30 days and keeps
   * to its harbours. Before it Japan attacks at 1.2× and chases a lure
   * hard (Wakisaka at Hansan); absent: cautious (I5b's rules).
   */
  caution?: boolean;
}

/** Japan's attack bar and bait aggression before its caution (doctrine §3). */
const BOLD_ATTACK_PCT = 120;
const BOLD_BAIT_PM = 1200;
/** Ships the main fleet sends out as a bait (doctrine §5). */
const BAIT_SHIPS = 4;
/** Days out after which an AI fleet heads home (doctrine §5). */
const SORTIE_HOME_DAYS = 10;

type Pt = { x: number; y: number };

function byId(a: { id: number }, b: { id: number }): number {
  return a.id - b.id;
}

function dist(a: Pt, b: Pt): number {
  return distMt(b.x - a.x, b.y - a.y);
}

function hullPm(st: SeaState, f: SeaFleet): number {
  const idx = shipIndex(st);
  let have = 0;
  let full = 0;
  for (const id of f.ships) {
    const s = idx.get(id);
    if (s === undefined) continue;
    have += s.hull;
    full += shipStats(s.kind).hull * 1000;
  }
  return full === 0 ? 0 : Math.floor((have * 1000) / full);
}

function live(f: SeaFleet): boolean {
  return f.ships.length > 0 && !f.fleeing;
}

/** The summed strength of `owner`'s friends (or foes) lying within `r` of a point. */
function massNear(
  v: SeaAiView,
  owner: number,
  p: Pt,
  r: number,
  hostile: boolean,
): number {
  let s = 0;
  for (const e of v.st.fleets) {
    if (!live(e) || dist(e, p) > r) continue;
    const counts = hostile
      ? v.ctx.hostile(owner, e.owner)
      : v.friends(owner, e.owner);
    if (counts) s += fleetStrength(v.st, e);
  }
  return s;
}

/** A country's main fleet: the strongest fleet with its admiral, not fleeing. */
export function mainFleetOf(v: SeaAiView, owner: number): SeaFleet | undefined {
  let best: SeaFleet | undefined;
  let bs = -1;
  for (const f of [...v.st.fleets].sort(byId)) {
    if (f.owner !== owner || !live(f) || !f.admiral.alive) continue;
    const s = fleetStrength(v.st, f);
    if (s > bs) {
      best = f;
      bs = s;
    }
  }
  return best;
}

/** The nearest water tile within `r` tiles of a point that passes `ok`, or -1. */
function findTile(
  ctx: SeaCtx,
  p: Pt,
  r: number,
  ok: (t: number) => boolean,
): number {
  const cx = Math.floor(p.x / MT);
  const cy = Math.floor(p.y / MT);
  let best = -1;
  let bd = Infinity;
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= ctx.height) continue;
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= ctx.width) continue;
      const d = dx * dx + dy * dy;
      if (d > r * r || d >= bd) continue;
      const t = ctx.ref(x, y);
      if (!ctx.isWater(t) || !ok(t)) continue;
      best = t;
      bd = d;
    }
  }
  return best;
}

/** Sail to a tile unless already bound there; `mode` then sets the battle stance. */
function sailTo(
  v: SeaAiView,
  f: SeaFleet,
  tile: number,
  mode?: "board" | "keep_range",
): void {
  const c = tileCentre(v.ctx, tile);
  const bound =
    f.pathIdx < f.path.length &&
    f.target >= 0 &&
    dist(tileCentre(v.ctx, f.target), c) <= 3 * MT;
  if (!bound && tileAt(v.ctx, f.x, f.y) !== tile) {
    seaOrder(v.st, v.ctx, f.owner, f.id, { kind: "move", tile });
  }
  if (mode !== undefined && f.order !== mode && f.order !== "lure")
    seaOrder(v.st, v.ctx, f.owner, f.id, { kind: "engage", mode });
}

function holdFast(v: SeaAiView, f: SeaFleet): void {
  if (f.order !== "hold" || f.path.length > 0)
    seaOrder(v.st, v.ctx, f.owner, f.id, { kind: "hold" });
}

function setFormation(v: SeaAiView, f: SeaFleet, fm: Formation): void {
  if (f.formationTo !== fm)
    seaOrder(v.st, v.ctx, f.owner, f.id, { kind: "formation", formation: fm });
}

/** `owner`'s busiest route with a group at sea and its landing berth, or null. */
function busiestRoute(
  v: SeaAiView,
  owner: number,
): { id: number; to: number } | null {
  let best: { id: number; to: number } | null = null;
  let got = 0;
  for (const r of v.routes) {
    if (r.owner !== owner || r.got <= got) continue;
    if (!v.st.groups.some((g) => g.route === r.id)) continue;
    best = { id: r.id, to: r.to };
    got = r.got;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Once a day

/** One day of the AI's fleets out of battle. */
export function seaAiDay(v: SeaAiView): void {
  for (const f of [...v.st.fleets].sort(byId)) {
    if (!live(f) || f.battle !== 0 || !v.steers(f.owner)) continue;
    dayFleet(v, f);
  }
}

function dayFleet(v: SeaAiView, f: SeaFleet): void {
  const { st, ctx } = v;
  const here = tileAt(ctx, f.x, f.y);
  if (here < 0) return;
  if (f.lureTo !== undefined && lureDay(v, f)) return;
  const hull = hullPm(st, f);
  const home = ctx.nearestPort(f.owner, f.x, f.y);
  if (
    hull < MEND_HULL_PM ||
    (f.order === "hold" &&
      hull < SAIL_HULL_PM &&
      home >= 0 &&
      ctx.portLevelAt(f.owner, here) > 0)
  ) {
    if (home >= 0 && home !== here) sailTo(v, f, home);
    return;
  }
  if (!f.admiral.alive && straggle(v, f)) return;
  // Sortie endurance (doctrine §5): after 10 days out, home to refit.
  if (
    (f.daysOut ?? 0) >= SORTIE_HOME_DAYS &&
    home >= 0 &&
    f.lureTo === undefined
  ) {
    if (f.pathIdx >= f.path.length || f.path[f.path.length - 1] !== home)
      sailTo(v, f, home);
    return;
  }
  if (f.owner === v.jpn) boardDay(v, f, home);
  else rangeDay(v, f, home);
}

/**
 * Ships without an admiral (broken off one by one) sail for the nearest
 * fleet of their own with one, out of battle, and rejoin it on arrival.
 */
function straggle(v: SeaAiView, f: SeaFleet): boolean {
  let best: SeaFleet | undefined;
  let bd = Infinity;
  for (const o of [...v.st.fleets].sort(byId)) {
    if (o === f || o.owner !== f.owner || !live(o) || !o.admiral.alive)
      continue;
    if (o.battle !== 0) continue;
    const d = dist(o, f);
    if (d < bd) {
      best = o;
      bd = d;
    }
  }
  if (best === undefined) return false;
  const to = tileAt(v.ctx, best.x, best.y);
  if (to < 0 || !v.ctx.isWater(to)) return false;
  sailTo(v, f, to);
  return true;
}

/** A lure on its way: show itself to the foe, then run for the trap. */
function lureDay(v: SeaAiView, f: SeaFleet): boolean {
  const trap = f.lureTo!;
  const c = tileCentre(v.ctx, trap);
  const waiting = v.st.fleets.some(
    (o) =>
      o !== f &&
      o.owner === f.owner &&
      live(o) &&
      (o.battle !== 0 || dist(o, c) <= TRAP_MT || trapBound(v, o, c)),
  );
  if (!waiting || dist(f, c) <= 2 * MT || !v.atWar(f.owner)) {
    delete f.lureTo;
    return false;
  }
  if (f.order === "lure") return true;
  let foe: SeaFleet | undefined;
  let fd = 2 * THREAT_MT;
  for (const e of [...v.st.fleets].sort(byId)) {
    if (!live(e) || !v.ctx.hostile(f.owner, e.owner)) continue;
    const d = dist(e, f);
    if (d < fd) {
      foe = e;
      fd = d;
    }
  }
  if (foe === undefined) {
    delete f.lureTo;
    return false;
  }
  if (fd <= SIGHT_OPEN_MT || f.path.length === 0) {
    seaOrder(v.st, v.ctx, f.owner, f.id, { kind: "lure", tile: trap });
  } else {
    const to = tileAt(v.ctx, foe.x, foe.y);
    if (to >= 0) sailTo(v, f, to);
  }
  return true;
}

/** The fleet is sailing for a spot near `c`. */
function trapBound(v: SeaAiView, o: SeaFleet, c: Pt): boolean {
  return (
    o.pathIdx < o.path.length &&
    dist(tileCentre(v.ctx, o.path[o.path.length - 1]), c) <= TRAP_MT
  );
}

/** True while a friendly lure runs for this fleet's lying-in-wait spot. */
function trapSet(v: SeaAiView, f: SeaFleet): boolean {
  if (f.order !== "hold" && f.order !== "keep_range") return false;
  return v.st.fleets.some((o) => {
    if (o.owner !== f.owner || o.lureTo === undefined || !live(o)) return false;
    const c = tileCentre(v.ctx, o.lureTo);
    return dist(f, c) <= TRAP_MT || trapBound(v, f, c);
  });
}

/** The strongest foe mass within THREAT_MT: its fleet and its weight. */
function threatTo(
  v: SeaAiView,
  f: SeaFleet,
): { e: SeaFleet; s: number } | null {
  let out: { e: SeaFleet; s: number } | null = null;
  for (const e of [...v.st.fleets].sort(byId)) {
    if (!live(e) || !v.ctx.hostile(f.owner, e.owner)) continue;
    if (dist(e, f) > THREAT_MT) continue;
    const s = massNear(v, f.owner, e, MASS_MT, true);
    if (out === null || s > out.s) out = { e, s };
  }
  return out;
}

/** Joseon and Ming: keep range, raid, and keep the fleet in being. */
function rangeDay(v: SeaAiView, f: SeaFleet, home: number): void {
  const { ctx } = v;
  const ming = f.owner === v.min;
  if (!v.atWar(f.owner)) {
    idle(v, f, home);
    return;
  }
  const mine = massNear(v, f.owner, f, MASS_MT, false);
  const threat = threatTo(v, f);
  if (threat !== null && threat.s * 100 > mine * RANGE_FIGHT_PCT) {
    if (trapSet(v, f)) return;
    const inChannel = flagsAt(ctx, f.x, f.y).channel;
    if (inChannel && threat.s * 100 <= mine * CHANNEL_FIGHT_PCT) {
      holdFast(v, f);
      return;
    }
    if (springLure(v, f, threat.e)) return;
    if (threat.s * 100 <= mine * CHANNEL_FIGHT_PCT) {
      const near = dist(f, threat.e) - 5 * MT;
      const ch = findTile(
        ctx,
        f,
        CHANNEL_SCAN,
        (t) =>
          ctx.flags(t).channel && dist(tileCentre(ctx, t), threat.e) >= near,
      );
      if (ch >= 0) {
        sailTo(v, f, ch, "keep_range");
        return;
      }
    }
    fallBack(v, f, home);
    return;
  }
  if (trapSet(v, f)) return;
  const target = rangeTarget(v, f, mine, ming);
  if (target !== null) {
    const to = tileAt(ctx, target.x, target.y);
    if (to >= 0 && ctx.isWater(to)) {
      sailTo(v, f, to, "keep_range");
      setFormation(v, f, f.ships.length >= 5 ? "crane" : "line");
      return;
    }
  }
  if (ming && mingStation(v, f, mine)) return;
  idle(v, f, home);
}

/**
 * The nearest foe a keep-range fleet can take: a fleet whose mass it can
 * fight, or a convoy group whose escort it can; groups count as nearer
 * (raiding is the aim), and Joseon looks only in its home waters.
 */
function rangeTarget(
  v: SeaAiView,
  f: SeaFleet,
  mine: number,
  ming: boolean,
): Pt | null {
  const { ctx } = v;
  const inReach = (p: Pt): boolean => {
    if (ming) return true;
    const port = ctx.nearestPort(f.owner, p.x, p.y);
    return port >= 0 && dist(tileCentre(ctx, port), p) <= HOME_WATERS_MT;
  };
  let best: Pt | null = null;
  let bd = HUNT_MT;
  for (const e of [...v.st.fleets].sort(byId)) {
    if (!live(e) || !ctx.hostile(f.owner, e.owner)) continue;
    const d = dist(e, f);
    if (d >= bd || !inReach(e)) continue;
    if (massNear(v, f.owner, e, MASS_MT, true) * 100 > mine * RANGE_FIGHT_PCT)
      continue;
    best = { x: e.x, y: e.y };
    bd = d;
  }
  for (const g of [...v.st.groups].sort(byId)) {
    if (!ctx.hostile(f.owner, g.owner) || g.raidedBy.includes(f.id)) continue;
    const d = Math.floor((dist(g, f) * 2) / 3);
    if (d >= bd || !inReach(g)) continue;
    if (massNear(v, f.owner, g, 10 * MT, true) * 100 > mine * RANGE_FIGHT_PCT)
      continue;
    best = { x: g.x, y: g.y };
    bd = d;
  }
  return best;
}

/**
 * The lure (design §6.2, Hansan): the main fleet, with an admiral of
 * tactics 3 or more, lies still in lee water near it, and a smaller fleet
 * sails to show itself to the foe and runs for that spot.
 */
function springLure(v: SeaAiView, f: SeaFleet, foe: SeaFleet): boolean {
  const { ctx } = v;
  const main = mainFleetOf(v, f.owner);
  // ww177 P7b: any great fleet under an admiral who can set a trap (not
  // only the strongest: Yi's at Yeosu and Yi Eok-gi's at Haenam are alike).
  if (
    main === undefined ||
    f.admiral.tactics < 3 ||
    fleetStrength(v.st, f) * 2 < fleetStrength(v.st, main)
  )
    return false;
  if (v.st.fleets.some((o) => o.owner === f.owner && o.lureTo !== undefined))
    return false;
  const foeD = dist(f, foe);
  const lee = findTile(
    ctx,
    f,
    LEE_SCAN,
    (t) => ctx.flags(t).lee && dist(tileCentre(ctx, t), foe) >= foeD - 2 * MT,
  );
  if (lee < 0) return false;
  const mine = fleetStrength(v.st, f);
  let bait: SeaFleet | undefined;
  let bd = 80 * MT;
  for (const o of [...v.st.fleets].sort(byId)) {
    if (o === f || o.owner !== f.owner || !live(o) || o.battle !== 0) continue;
    if (fleetStrength(v.st, o) * 2 > mine) continue;
    if (hullPm(v.st, o) < MEND_HULL_PM) continue;
    const d = dist(o, f);
    if (d < bd) {
      bait = o;
      bd = d;
    }
  }
  // ww177 P7b (doctrine §5, Hansan): with no small fleet near, the main
  // fleet sends a few of its own ships out as the bait.
  if (bait === undefined && f.battle === 0 && f.ships.length > BAIT_SHIPS * 2) {
    const idx = shipIndex(v.st);
    const small = f.ships
      .slice(1)
      .filter((id) => idx.get(id)?.kind === "hyeopseon");
    const rest = f.ships.slice(1).filter((id) => !small.includes(id));
    bait = splitFleet(v.st, f.id, [...small, ...rest].slice(0, BAIT_SHIPS));
    if (bait !== undefined)
      bait.admiral = { ...f.admiral, gunnery: 2, tactics: 2 };
  }
  if (bait === undefined) return false;
  if (tileAt(ctx, f.x, f.y) === lee) holdFast(v, f);
  else sailTo(v, f, lee);
  setFormation(v, f, "crane");
  bait.lureTo = lee;
  const to = tileAt(ctx, foe.x, foe.y);
  if (to >= 0) sailTo(v, bait, to);
  return true;
}

/** Outweighed: fall back on the main fleet if it is near, else on a port. */
function fallBack(v: SeaAiView, f: SeaFleet, home: number): void {
  const main = mainFleetOf(v, f.owner);
  if (
    main !== undefined &&
    main !== f &&
    main.battle === 0 &&
    dist(main, f) <= 150 * MT &&
    dist(main, f) > GATHER_MT
  ) {
    const to = tileAt(v.ctx, main.x, main.y);
    if (to >= 0) {
      sailTo(v, f, to, "keep_range");
      return;
    }
  }
  if (home >= 0 && tileAt(v.ctx, f.x, f.y) !== home) sailTo(v, f, home);
  else holdFast(v, f);
}

/** Ming: blockade Japan's busiest landing if it can hold there, else join Joseon's main fleet. */
function mingStation(v: SeaAiView, f: SeaFleet, mine: number): boolean {
  const r = busiestRoute(v, v.jpn);
  if (r !== null && r.to >= 0) {
    const c = tileCentre(v.ctx, r.to);
    const foes = massNear(v, f.owner, c, MASS_MT, true);
    const friends = dist(f, c) <= MASS_MT ? 0 : mine;
    if (
      foes * 100 <=
      (massNear(v, f.owner, c, MASS_MT, false) + friends) * RANGE_FIGHT_PCT
    ) {
      if (dist(f, c) > 2 * MT) sailTo(v, f, r.to, "keep_range");
      else holdFast(v, f);
      return true;
    }
  }
  const main = mainFleetOf(v, v.jos);
  if (main !== undefined && main.battle === 0 && dist(main, f) > GATHER_MT) {
    const to = tileAt(v.ctx, main.x, main.y);
    if (to >= 0) {
      sailTo(v, f, to, "keep_range");
      return true;
    }
  }
  return false;
}

/** Nothing to do: home if far, else lie in lee water by the berth, else hold. */
function idle(v: SeaAiView, f: SeaFleet, home: number): void {
  const { ctx } = v;
  if (home < 0) {
    holdFast(v, f);
    return;
  }
  const berth = tileCentre(ctx, home);
  if (dist(f, berth) > IDLE_HOME_MT) {
    sailTo(v, f, home);
    return;
  }
  if (f.pathIdx < f.path.length) return;
  if (!flagsAt(ctx, f.x, f.y).lee) {
    const lee = findTile(
      ctx,
      berth,
      6,
      (t) => ctx.flags(t).lee && ctx.portLevelAt(f.owner, t) > 0,
    );
    if (lee >= 0 && lee !== tileAt(ctx, f.x, f.y)) {
      sailTo(v, f, lee);
      return;
    }
  }
  holdFast(v, f);
}

/** Japan: mass under the strongest fleet, escort, and seek the decisive fight. */
function boardDay(v: SeaAiView, f: SeaFleet, home: number): void {
  const { ctx } = v;
  const lead = mainFleetOf(v, f.owner);
  if (lead === undefined) return;
  if (f !== lead) {
    followLead(v, f, lead);
    return;
  }
  if (!v.atWar(f.owner)) {
    holdFast(v, f);
    return;
  }
  setFormation(v, f, "wedge");
  // Wait for the mass: weighty followers still far off hold the leader back.
  const mass = massNear(v, f.owner, f, MASS_MT, false);
  // A foe close by that the mass would not attack (its guns outrange the
  // grapples): back to a harbour beyond the foe's home waters, the fleet
  // kept in being (after Hansan the Japanese fleets kept to theirs).
  const threat = threatTo(v, f);
  if (
    v.caution !== false &&
    threat !== null &&
    threat.s * BOARD_ATTACK_PCT > mass * 100
  ) {
    const haven = havenOf(v, f, threat.e.owner, home);
    if (haven >= 0 && tileAt(ctx, f.x, f.y) !== haven) sailTo(v, f, haven);
    else holdFast(v, f);
    return;
  }
  let far = 0;
  for (const o of v.st.fleets)
    if (
      o.owner === f.owner &&
      live(o) &&
      o.battle === 0 &&
      dist(o, f) > MASS_MT &&
      hullPm(v.st, o) >= MEND_HULL_PM
    )
      far += fleetStrength(v.st, o);
  const target = boardTarget(v, f, mass);
  if (target >= 0 && far * 3 <= mass) {
    sailTo(v, f, target, "board");
    return;
  }
  const r = busiestRoute(v, f.owner);
  if (r !== null) {
    if (f.order !== "escort" || f.target !== r.id)
      seaOrder(v.st, ctx, f.owner, f.id, { kind: "escort", route: r.id });
    return;
  }
  if (home >= 0 && dist(f, tileCentre(ctx, home)) > IDLE_HOME_MT)
    sailTo(v, f, home);
  else if (f.order === "escort" || f.pathIdx >= f.path.length) holdFast(v, f);
}

/** The nearest own berth beyond the home waters of `foe`, else `home`. */
function havenOf(v: SeaAiView, f: SeaFleet, foe: number, home: number): number {
  const { ctx } = v;
  let best = home;
  let bd = Infinity;
  for (const t of v.ports(f.owner)) {
    if (t < 0) continue;
    const c = tileCentre(ctx, t);
    const fp = ctx.nearestPort(foe, c.x, c.y);
    if (fp >= 0 && dist(tileCentre(ctx, fp), c) <= HOME_WATERS_MT) continue;
    const d = dist(c, f);
    if (d < bd) {
      best = t;
      bd = d;
    }
  }
  return best;
}

/** A follower sails with its leader: to its battle, to its side, on its errand. */
function followLead(v: SeaAiView, f: SeaFleet, lead: SeaFleet): void {
  const { ctx } = v;
  if (lead.battle !== 0) {
    const b = v.st.battles.find((x) => x.id === lead.battle);
    const to = b ? tileAt(ctx, b.cx, b.cy) : -1;
    if (to >= 0 && ctx.isWater(to)) {
      sailTo(v, f, to, "board");
      return;
    }
  }
  if (dist(f, lead) > GATHER_MT) {
    const to = tileAt(ctx, lead.x, lead.y);
    if (to >= 0) sailTo(v, f, to, "board");
    return;
  }
  if (lead.order === "escort") {
    if (f.order !== "escort" || f.target !== lead.target)
      seaOrder(v.st, ctx, f.owner, f.id, {
        kind: "escort",
        route: lead.target,
      });
  } else if (lead.pathIdx < lead.path.length) {
    sailTo(v, f, lead.path[lead.path.length - 1], "board");
  } else holdFast(v, f);
}

/**
 * The nearest foe the massed boarding fleet outweighs, out of narrow water
 * unless it can force it; a small foe on the move is chased only when the
 * admiral takes the bait (design §6.2 "the lure").
 */
function boardTarget(v: SeaAiView, f: SeaFleet, mass: number): number {
  const { ctx } = v;
  let best = -1;
  let bd = BOARD_HUNT_MT;
  for (const e of [...v.st.fleets].sort(byId)) {
    if (!live(e) || !ctx.hostile(f.owner, e.owner)) continue;
    const d = dist(e, f);
    if (d >= bd) continue;
    // Every foe that could sail into the circle counts.
    const foe = Math.max(1, massNear(v, f.owner, e, THREAT_MT, true));
    const bar = v.caution === false ? BOLD_ATTACK_PCT : BOARD_ATTACK_PCT;
    if (foe * bar > mass * 100) continue;
    if (flagsAt(ctx, e.x, e.y).channel && foe * BOARD_CHANNEL_PCT > mass * 100)
      continue;
    if (e.pathIdx < e.path.length && !baitTaken(v, f, e, mass, foe)) continue;
    const t = tileAt(ctx, e.x, e.y);
    if (t < 0 || !ctx.isWater(t)) continue;
    best = t;
    bd = d;
  }
  return best;
}

/** Design §6.2: ratio × aggression against the admiral's caution and a daily roll. */
export function baitTaken(
  v: SeaAiView,
  f: SeaFleet,
  e: SeaFleet,
  mass: number,
  foe: number,
): boolean {
  const nerve = f.admiral.alive ? f.admiral.nerve : 0;
  const tactics = f.admiral.alive ? f.admiral.tactics : 0;
  const ratio = Math.min(3000, Math.floor((mass * 1000) / Math.max(1, foe)));
  const bar =
    1500 +
    300 * tactics +
    (wwRoll(v.ctx.seed, P_SEA_AI_BAIT, f.id, e.id, v.ctx.day) % BAIT_ROLL_PM);
  const aggression =
    f.owner === v.jpn && v.caution === false ? BOLD_BAIT_PM : 600 + 100 * nerve;
  return takesBait(ratio, aggression, bar);
}

// ---------------------------------------------------------------------------
// Every volley, in battle

/** Each AI fleet in battle picks its order for the next volley. */
export function seaAiVolley(v: SeaAiView): void {
  const { st } = v;
  for (const b of [...st.battles].sort(byId)) {
    const members = st.fleets.filter((f) => f.battle === b.id).sort(byId);
    for (const f of members) {
      if (!live(f) || !v.steers(f.owner)) continue;
      volleyFleet(v, b, members, f);
    }
  }
}

function volleyFleet(
  v: SeaAiView,
  b: SeaBattle,
  members: readonly SeaFleet[],
  f: SeaFleet,
): void {
  const { st, ctx } = v;
  if (f.order === "break_off") return;
  if (f.lureTo !== undefined) {
    if (f.order !== "lure")
      seaOrder(st, ctx, f.owner, f.id, { kind: "lure", tile: f.lureTo });
    return;
  }
  let mine = 0;
  let theirs = 0;
  for (const o of members) {
    if (!live(o)) continue;
    if (ctx.hostile(f.owner, o.owner)) theirs += fleetStrength(st, o);
    else if (v.friends(f.owner, o.owner)) mine += fleetStrength(st, o);
  }
  if (theirs === 0) return;
  const hull = hullPm(st, f);
  const board =
    f.owner === v.jpn ||
    (f.owner === v.min && mine * 100 >= theirs * MING_BOARD_PCT);
  const channel = flagsAt(ctx, f.x, f.y).channel;
  if (board) {
    if (
      hull < BOARD_BREAK_HULL_PM ||
      (f.morale < BOARD_BREAK_MORALE && theirs * 100 > mine * BOARD_BREAK_PCT)
    ) {
      seaOrder(st, ctx, f.owner, f.id, { kind: "break_off" });
      return;
    }
    if (!channel) setFormation(v, f, "wedge");
    if (channel && againstCurrent(v, b, f)) holdFast(v, f);
    else if (f.order !== "board")
      seaOrder(st, ctx, f.owner, f.id, { kind: "engage", mode: "board" });
    if (f.owner === v.jpn) fireShips(v, b, f);
    return;
  }
  if (
    hull < RANGE_BREAK_HULL_PM ||
    (f.morale < RANGE_BREAK_MORALE && theirs * 100 > mine * RANGE_BREAK_PCT)
  ) {
    seaOrder(st, ctx, f.owner, f.id, { kind: "break_off" });
    return;
  }
  // The crane wing by state (doctrine §5): against a column or a wedge, or
  // a foe chasing a lure; otherwise the line.
  if (!channel) {
    const closing = members.some(
      (o) =>
        live(o) &&
        ctx.hostile(f.owner, o.owner) &&
        (o.formation === "column" || o.formation === "wedge"),
    );
    const lured = members.some(
      (o) => live(o) && o.owner === f.owner && o.lureTo !== undefined,
    );
    setFormation(
      v,
      f,
      f.ships.length >= 5 && (closing || lured) ? "crane" : "line",
    );
  }
  if (f.order !== "keep_range")
    seaOrder(st, ctx, f.owner, f.id, { kind: "engage", mode: "keep_range" });
}

/** The channel's current runs against the fleet's heading now (design §6.2). */
function againstCurrent(v: SeaAiView, b: SeaBattle, f: SeaFleet): boolean {
  const fl = flagsAt(v.ctx, f.x, f.y);
  if (!fl.current || !b.current) return false;
  const cur = currentState(v.ctx.seed, b.id, v.ctx.tick - b.startTick);
  return (
    currentSpeedPct(f.heading, v.ctx.currentAxis(fl.current), cur.sign) < 0
  );
}

/** Japan's fire ships: a small boat sent downwind into a packed enemy. */
function fireShips(v: SeaAiView, b: SeaBattle, f: SeaFleet): void {
  const { st, ctx } = v;
  const idx = shipIndex(st);
  const own: SeaShip[] = [];
  let lit = 0;
  for (const id of f.ships) {
    const s = idx.get(id);
    if (!s || s.hull <= 0) continue;
    if (s.fireShip) lit++;
    else if (shipStats(s.kind).small) own.push(s);
  }
  if (own.length === 0 || lit >= FIRE_SHIPS_AT_ONCE) return;
  const inBattle = new Set(
    st.fleets.filter((x) => x.battle === b.id).map((x) => x.id),
  );
  const foes = st.ships.filter(
    (s) => s.hull > 0 && inBattle.has(s.fleet) && ctx.hostile(f.owner, s.owner),
  );
  let pick: SeaShip | null = null;
  let aim: SeaShip | null = null;
  let pd = FIRE_SHIP_RANGE_MT + 1;
  for (const e of foes) {
    let packed = 0;
    for (const o of foes) if (dist(o, e) <= 2 * BOARD_RANGE_MT) packed++;
    if (packed < FIRE_SHIP_PACK) continue;
    for (const s of own) {
      const d = dist(s, e);
      if (d < pd) {
        pick = s;
        aim = e;
        pd = d;
      }
    }
  }
  if (pick === null || aim === null) return;
  const t = tileAt(ctx, pick.x, pick.y);
  const wind = windAt(
    ctx.seed,
    t < 0 ? 0 : ctx.zoneOf(t),
    Math.floor(ctx.day / WIND_PERIOD_DAYS),
    ctx.month,
  );
  const bearing = angleOf(aim.x - pick.x, aim.y - pick.y);
  if (!fireShipWindOk(wind.to, wind.strength, bearing)) return;
  seaOrder(st, ctx, f.owner, f.id, { kind: "fire_ship", ship: pick.id });
}

// ---------------------------------------------------------------------------
// The game's side

function viewOf(im: WwImjin, tick: number): SeaAiView {
  const ww = im.ww;
  const land = ww.land;
  const routes = [...ww.navy.routes.values()]
    .filter((r) => r.use === USE_SUPPLY && r.got > 0)
    .sort((a, b) => a.id - b.id)
    .map((r) => ({
      id: r.id,
      owner: r.owner,
      got: r.got,
      to: im.portTile(r.ref),
    }));
  return {
    st: im.st.sea,
    ctx: im.ctx(tick),
    jos: im.idOf("JOS"),
    jpn: im.idOf("JPN"),
    min: im.idOf("MIN"),
    steers: (o) => !ww.isHumanControlled(o) || ww.autoOn(o, "navy"),
    atWar: (o) => ww.enemiesOf(o).length > 0,
    friends: (a, b) => land.sameSide(a, b),
    ports: (o) => navalPortsOf(ww, o).map((r) => im.portTile(r)),
    routes,
    caution: ww.politics.gflags.has(DOCTRINE_FLAGS.jpnSeaCaution),
  };
}

/** One day of the AI's fleets (WwImjin.daily); Ming's fleet comes by state first. */
export function imjinSeaAi(im: WwImjin, day: number, tick: number): void {
  mingFleetByState(im, day);
  seaAiDay(viewOf(im, tick));
}

/** Every volley tick (WwImjin.tick): the AI's orders in battle. */
export function imjinSeaBattleAi(im: WwImjin, tick: number): void {
  if (tick % VOLLEY_TICKS !== 0 || im.st.sea.battles.length === 0) return;
  seaAiVolley(viewOf(im, tick));
}
