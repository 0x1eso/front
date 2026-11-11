// Imjin sea layer (ww175 design §6.2): the state of tile fleets, battle
// circles and convoy groups. Plain JSON of integers and short strings, so the
// snapshot is a deep copy and the hash folds every field in a fixed order.
// Arrays stay sorted by id; nothing iterates a Map or a Set.
import type { Formation, ShipKind } from "@openfront/engine-lib/imjin/SeaRules";
import {
  FORMATIONS,
  MORALE_MAX,
  shipKindIndex,
  shipStats,
} from "@openfront/engine-lib/imjin/SeaRules";

export interface SeaAdmiral {
  /** Skills 0-5 (design §6.2): each +5% to its part. */
  gunnery: number;
  tactics: number;
  boarding: number;
  nerve: number;
  /** 0 once killed. */
  alive: number;
}

export interface SeaShip {
  id: number;
  kind: ShipKind;
  owner: number;
  fleet: number;
  /** Position, milli-tiles. */
  x: number;
  y: number;
  /** Binary angle (1024 a circle). */
  heading: number;
  /** Hull left, milli-points. */
  hull: number;
  crew: number;
  /** 1 while burning. */
  fire: number;
  /** 1 while fouled by a current: neither fires nor sails. */
  fouled: number;
  /** Ticks left stuck on a shoal. */
  stuck: number;
  /** 1 once ordered to become a fire ship. */
  fireShip: number;
  /** The ship's last ordered point (it keeps it outside command radius). */
  tx: number;
  ty: number;
}

export const SEA_ORDERS = [
  "hold",
  "move",
  "keep_range",
  "board",
  "break_off",
  "lure",
  "escort",
] as const;
export type SeaOrderKind = (typeof SEA_ORDERS)[number];

export interface SeaFleet {
  id: number;
  owner: number;
  /** Ship ids in slot order; slot 0 is the flagship. */
  ships: number[];
  admiral: SeaAdmiral;
  formation: Formation;
  /** The formation being taken up, and the ticks it still takes. */
  formationTo: Formation;
  formationTicks: number;
  morale: number;
  order: SeaOrderKind;
  /** Order target: a tile for move and lure, a route id for escort. */
  target: number;
  /** Strategic path (tiles) and the index of the next tile. */
  path: number[];
  pathIdx: number;
  /** Anchor (the flagship's position at strategic speed), milli-tiles. */
  x: number;
  y: number;
  heading: number;
  /** Battle id, 0 when none. */
  battle: number;
  /** Ticks without moving (lee hiding needs a still fleet). */
  still: number;
  /** 1 when its first volley in this battle is an ambush. */
  ambush: number;
  /** 1 while fleeing; `fleeTile` is the friendly port it runs for (-1 none). */
  fleeing: number;
  fleeTile: number;
  /** Ticks since the fleet was last hit (rally needs 10 s quiet). */
  quiet: number;
  /** 1 when it lay still in lee at the end of the last tick (an ambush in waiting). */
  lurk: number;
  /**
   * ww177 I5b, the sea AI's lure: the tile where a friendly fleet lies in
   * wait, which this fleet shows itself to the foe for and then runs to.
   */
  lureTo?: number;
}

export interface SeaBattle {
  id: number;
  /** Centre, milli-tiles. */
  cx: number;
  cy: number;
  startTick: number;
  /** Current id of the channel at the centre, 0 when none. */
  current: number;
}

export interface ConvoyGroup {
  id: number;
  owner: number;
  route: number;
  path: number[];
  pathIdx: number;
  x: number;
  y: number;
  convoys: number;
  /** Cargo still aboard (supply units). */
  cargo: number;
  /** Fleet ids that have already raided it (sorted). */
  raidedBy: number[];
}

export interface SeaArrival {
  owner: number;
  route: number;
  convoys: number;
  cargo: number;
  tick: number;
}

export interface SeaEvent {
  tick: number;
  /** "battle_open", "battle_end", "sunk", "taken", "burnt", "admiral_dead", "flee", "rally", "raid". */
  kind: string;
  a: number;
  b: number;
}

export interface SeaState {
  nextId: number;
  ships: SeaShip[];
  fleets: SeaFleet[];
  battles: SeaBattle[];
  groups: ConvoyGroup[];
  /** Groups landed since the bridge last read them (SeaSupply consumes). */
  arrivals: SeaArrival[];
  /** Recent events for the client and the AI (the bridge clears them). */
  events: SeaEvent[];
  /** ww177 I5b: the day Ming's fleet put to sea (absent: not yet). */
  mingFleet?: number;
}

export function emptySeaState(): SeaState {
  return {
    nextId: 1,
    ships: [],
    fleets: [],
    battles: [],
    groups: [],
    arrivals: [],
    events: [],
  };
}

export function newAdmiral(p: Partial<SeaAdmiral> = {}): SeaAdmiral {
  return { gunnery: 0, tactics: 0, boarding: 0, nerve: 0, alive: 1, ...p };
}

/** Full hull of a ship in milli-points. */
export function fullHull(kind: ShipKind): number {
  return shipStats(kind).hull * 1000;
}

/** Build a fleet at a tile position with ships in slot order. */
export function addFleet(
  st: SeaState,
  owner: number,
  x: number,
  y: number,
  kinds: readonly ShipKind[],
  opts: {
    formation?: Formation;
    heading?: number;
    admiral?: Partial<SeaAdmiral>;
  } = {},
): SeaFleet {
  const formation = opts.formation ?? "line";
  const heading = opts.heading ?? 0;
  const fleet: SeaFleet = {
    id: st.nextId++,
    owner,
    ships: [],
    admiral: newAdmiral(opts.admiral),
    formation,
    formationTo: formation,
    formationTicks: 0,
    morale: MORALE_MAX,
    order: "hold",
    target: -1,
    path: [],
    pathIdx: 0,
    x,
    y,
    heading,
    battle: 0,
    still: 0,
    ambush: 0,
    fleeing: 0,
    fleeTile: -1,
    quiet: 0,
    lurk: 0,
  };
  for (const kind of kinds) {
    const s = shipStats(kind);
    const ship: SeaShip = {
      id: st.nextId++,
      kind,
      owner,
      fleet: fleet.id,
      x,
      y,
      heading,
      hull: s.hull * 1000,
      crew: s.crew,
      fire: 0,
      fouled: 0,
      stuck: 0,
      fireShip: 0,
      tx: x,
      ty: y,
    };
    st.ships.push(ship);
    fleet.ships.push(ship.id);
  }
  st.fleets.push(fleet);
  return fleet;
}

export function shipIndex(st: SeaState): Map<number, SeaShip> {
  const m = new Map<number, SeaShip>();
  for (const s of st.ships) m.set(s.id, s);
  return m;
}

/** A fleet's fighting weight for the AI's estimates: guns, arquebus and boarding by hull left. */
export function fleetStrength(st: SeaState, f: SeaFleet): number {
  const idx = shipIndex(st);
  let v = 0;
  for (const id of f.ships) {
    const s = idx.get(id);
    if (s === undefined) continue;
    const k = shipStats(s.kind);
    v += Math.floor(
      ((k.guns * 3 + k.arq * 2 + k.boardAtk * 2 + 2) * s.hull) /
        (k.hull * 1000),
    );
  }
  return v;
}

export function fleetById(st: SeaState, id: number): SeaFleet | undefined {
  for (const f of st.fleets) if (f.id === id) return f;
  return undefined;
}

/** Deep copy for the snapshot and the restore. */
export function cloneSeaState(st: SeaState): SeaState {
  return JSON.parse(JSON.stringify(st)) as SeaState;
}

function fold(h: number, v: number): number {
  h ^= v | 0;
  h = Math.imul(h, 0x01000193);
  h ^= Math.floor(v / 4294967296) | 0;
  return Math.imul(h, 0x01000193) >>> 0;
}

/** FNV-1a fold of the whole state; arrivals and events are transient and not folded. */
export function seaHash(st: SeaState): number {
  let h = 0x811c9dc5;
  h = fold(h, st.nextId);
  for (const s of st.ships) {
    for (const v of [
      s.id,
      shipKindIndex(s.kind),
      s.owner,
      s.fleet,
      s.x,
      s.y,
      s.heading,
      s.hull,
      s.crew,
      s.fire,
      s.fouled,
      s.stuck,
      s.fireShip,
      s.tx,
      s.ty,
    ])
      h = fold(h, v);
  }
  for (const f of st.fleets) {
    for (const v of [
      f.id,
      f.owner,
      f.admiral.gunnery,
      f.admiral.tactics,
      f.admiral.boarding,
      f.admiral.nerve,
      f.admiral.alive,
      FORMATIONS.indexOf(f.formation),
      FORMATIONS.indexOf(f.formationTo),
      f.formationTicks,
      f.morale,
      f.target,
      f.pathIdx,
      f.path.length,
      f.x,
      f.y,
      f.heading,
      f.battle,
      f.still,
      f.ambush,
      f.fleeing,
      f.fleeTile,
      f.quiet,
    ])
      h = fold(h, v);
    h = fold(h, SEA_ORDERS.indexOf(f.order));
    h = fold(h, f.lurk);
    if (f.lureTo !== undefined) h = fold(h, f.lureTo + 1);
    for (const id of f.ships) h = fold(h, id);
  }
  for (const b of st.battles)
    for (const v of [b.id, b.cx, b.cy, b.startTick, b.current]) h = fold(h, v);
  for (const g of st.groups) {
    for (const v of [
      g.id,
      g.owner,
      g.route,
      g.pathIdx,
      g.path.length,
      g.x,
      g.y,
      g.convoys,
      g.cargo,
    ])
      h = fold(h, v);
    for (const id of g.raidedBy) h = fold(h, id);
  }
  if (st.mingFleet !== undefined) h = fold(h, st.mingFleet + 1);
  return h;
}
