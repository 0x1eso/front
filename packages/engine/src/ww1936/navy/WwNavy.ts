// World War 1936 P4: the navy's state (P4 spec §19.1): ships as columns,
// fleets, naval battles, convoy routes, voyages, invasions, admirals and the
// per sea region spotting and supremacy; the tick order (spec §2.2-6), the
// order dispatch, the screens' data, the snapshot and the hash. The lanes
// write the step functions (Task 1 Step 18's stubs); this file owns the
// state and the orchestration.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_PLANE_DESIGN_SLOTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  WW_DAY_SPLIT,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { LandOrderSource } from "@openfront/engine-api/ww1936/LandTypes";
import {
  CONVOY_USES,
  CountryNavyDetail,
  DECK_SLOTS,
  ENGAGE_RULES,
  FLEET_FLAG_AUTO,
  FLEET_FLAG_LOW_FUEL,
  FLEET_MISSIONS,
  FLEET_STATES,
  FleetSummary,
  INVASION_STATES,
  NavalBattleSummary,
  SeaRegionData,
  SHIP_CLASSES,
  ShipClass,
  ShipStats,
  WW_MAX_FLEET_SHIPS,
  WW_SPOT_FULL_PM,
  WwNavyData,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { applyShipDesign } from "@openfront/engine-lib/ww1936/DesignRules";
import { fleetFuelSpeedPm } from "@openfront/engine-lib/ww1936/FuelRules";
import { NAVAL_BEATS } from "@openfront/engine-lib/ww1936/NavalBeats";
import {
  lineCostMilli,
  navalLineClass,
} from "@openfront/engine-lib/ww1936/NavalLineRules";
import { tickMilliKm } from "@openfront/engine-lib/ww1936/NavalRules";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import { idHash, P_NAVALBEAT, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { edgePassable, seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import { queuedShipName } from "@openfront/engine-lib/ww1936/ShipNames";
import { shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { z } from "zod";
import type { Game } from "../../game/Game";
import { shipDesignOf } from "../depth/Designs";
import { convoysOf, losePlanes } from "../economy/Buildings";
import { fuelCapOf, noteFleetFuel } from "../economy/Fuel";
import { dockyardsFree, issueNavalLineOrder } from "../economy/NavalLines";
import type { WwEconomy } from "../economy/WwEconomy";
import type { Side, WwLand } from "../land/WwLand";
import type { WorldWar } from "../WorldWar";
import { aiInvasions } from "./AiInvasion";
import { aiNavy } from "./AiNavy";
import { carrierPortStrike, issueCarrierOrder } from "./Carriers";
import { allocateConvoys } from "./Convoys";
import { convoyWar } from "./ConvoyWar";
import { exileNavyAndAir, onPlanesLost, onShipSunk } from "./EndgameHooks";
import {
  applyFleetOrders,
  dailyFleetHousekeeping,
  issueFleetOrder,
} from "./Fleets";
import { dailyInvasions, issueInvasionOrder } from "./Invasions";
import { engageRegion, FST } from "./Missions";
import { stepNavalBattles } from "./NavalBattles";
import { startNavy } from "./NavyStartRun";
import { bestNavalBase, navalPort, navalPortsOf } from "./Ports";
import {
  appointAdmiral,
  dailyNavyXp,
  dailyRepair,
  fleetRepairDays,
} from "./Repair";
import { stepFleets } from "./SeaMove";
import { dailyVoyages, issueSeaTransfer, stepSeaVoyages } from "./SeaTransfer";
import { spotRegion } from "./Spotting";
import { supremacyRegion } from "./Supremacy";

/** P6 (plan decision 9): [index, value] of the non-zero cells. */
function nonZeroCells(a: Int32Array): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== 0) out.push([i, a[i]]);
  return out;
}

// ---- Ships: one row each, columns (plan decision 16) ----

const SHIP_COLS = {
  id: Int32Array,
  owner: Uint16Array,
  cls: Uint8Array,
  gen: Uint8Array,
  fleet: Int32Array,
  hp: Int32Array,
  org: Int32Array,
  nameIdx: Int32Array,
  /** Submarine reveal progress ‰ in its battle (spec §9.5). */
  reveal: Int16Array,
  /** Rounds left to escape; −1: not retreating (spec §9.7). */
  escape: Int8Array,
  /** Repair docks held today (spec §5.4). */
  docks: Uint8Array,
  /** The country whose name list nameIdx is of (a transferred ship keeps its name). */
  nameOwner: Uint16Array,
  // P6 (plan decision 8, Task 1 Step 2).
  /** Ship design slot (1..24); 0: the base class. */
  design: Uint8Array,
  /** The design slot a refit gives; 0 none (lane E's Refit). */
  refitTo: Uint8Array,
  /** Refit days left; a ship with > 0 stays in port like a repair. */
  refitLeft: Int16Array,
  /** P6 (plan decision 12): the day its battle last fed the doctrine tally; -1: never. */
  tallyDay: Int16Array,
} as const;
type ShipColumn = keyof typeof SHIP_COLS;
const SHIP_COLUMNS = Object.keys(SHIP_COLS) as ShipColumn[];
type IntArray = Int32Array | Uint16Array | Uint8Array | Int16Array | Int8Array;

/**
 * The ships as columns. Rows stay in ship-id order: ids only rise, a
 * removed row is a tombstone (id 0, escape −1) until the daily compaction.
 * Row numbers are valid within one tick; keep ship ids across ticks (plan
 * decision 16).
 */
export class ShipTable {
  rows = 0;
  id = new Int32Array(0);
  owner = new Uint16Array(0);
  cls = new Uint8Array(0);
  gen = new Uint8Array(0);
  fleet = new Int32Array(0);
  hp = new Int32Array(0);
  org = new Int32Array(0);
  nameIdx = new Int32Array(0);
  reveal = new Int16Array(0);
  escape = new Int8Array(0);
  docks = new Uint8Array(0);
  nameOwner = new Uint16Array(0);
  /** DECK_SLOTS per row: (cv_fighter, cv_cas, cv_naval_bomber) × gen 1..3. */
  deck = new Int32Array(0);
  // P6 (plan decisions 8, 9).
  design = new Uint8Array(0);
  refitTo = new Uint8Array(0);
  refitLeft = new Int16Array(0);
  tallyDay = new Int16Array(0);
  /** WW_PLANE_DESIGN_SLOTS per row: carrier planes of each plane design slot. */
  deckD = new Int32Array(0);
  /** Derived (DERIVED_FIELDS): ship id → row. */
  shipRowIndex = new Map<number, number>();
  private capacity = 0;

  constructor() {
    // Always at least 64 rows, so an empty table and its restore are equal.
    this.grow(64);
  }

  col(name: ShipColumn): IntArray {
    return (this as unknown as Record<ShipColumn, IntArray>)[name];
  }

  grow(min: number): void {
    const cap = Math.max(64, this.capacity * 2, min);
    for (const name of SHIP_COLUMNS) {
      const next = new SHIP_COLS[name](cap);
      next.set(this.col(name).subarray(0, this.rows));
      (this as unknown as Record<ShipColumn, IntArray>)[name] = next;
    }
    const deck = new Int32Array(cap * DECK_SLOTS);
    deck.set(this.deck.subarray(0, this.rows * DECK_SLOTS));
    this.deck = deck;
    const deckD = new Int32Array(cap * WW_PLANE_DESIGN_SLOTS);
    deckD.set(this.deckD.subarray(0, this.rows * WW_PLANE_DESIGN_SLOTS));
    this.deckD = deckD;
    this.capacity = cap;
  }

  /** Appends a ship; ids rise, so the rows stay in id order. */
  add(
    id: number,
    owner: number,
    cls: number,
    gen: number,
    fleet: number,
    hp: number,
    org: number,
    nameIdx: number,
  ): number {
    if (this.rows === this.capacity) this.grow(this.rows + 1);
    const r = this.rows++;
    for (const name of SHIP_COLUMNS) this.col(name)[r] = 0;
    this.deck.fill(0, r * DECK_SLOTS, (r + 1) * DECK_SLOTS);
    this.deckD.fill(
      0,
      r * WW_PLANE_DESIGN_SLOTS,
      (r + 1) * WW_PLANE_DESIGN_SLOTS,
    );
    this.tallyDay[r] = -1;
    this.id[r] = id;
    this.owner[r] = owner;
    this.cls[r] = cls;
    this.gen[r] = gen;
    this.fleet[r] = fleet;
    this.hp[r] = hp;
    this.org[r] = org;
    this.nameIdx[r] = nameIdx;
    this.nameOwner[r] = owner;
    this.escape[r] = -1;
    this.shipRowIndex.set(id, r);
    return r;
  }

  alive(r: number): boolean {
    return this.id[r] !== 0;
  }

  rowOf(id: number): number {
    return this.shipRowIndex.get(id) ?? -1;
  }

  count(): number {
    return this.shipRowIndex.size;
  }

  /** A tombstone (every column 0, escape −1) until compact(). */
  kill(r: number): void {
    this.shipRowIndex.delete(this.id[r]);
    for (const name of SHIP_COLUMNS) this.col(name)[r] = 0;
    this.escape[r] = -1;
    this.deck.fill(0, r * DECK_SLOTS, (r + 1) * DECK_SLOTS);
    this.deckD.fill(
      0,
      r * WW_PLANE_DESIGN_SLOTS,
      (r + 1) * WW_PLANE_DESIGN_SLOTS,
    );
  }

  /** P6: the row's design-plane deck slots (a view: valid until the table grows). */
  deckDOf(r: number): Int32Array {
    return this.deckD.subarray(
      r * WW_PLANE_DESIGN_SLOTS,
      (r + 1) * WW_PLANE_DESIGN_SLOTS,
    );
  }

  /** The row's deck slots (a view: valid until the table grows). */
  deckOf(r: number): Int32Array {
    return this.deck.subarray(r * DECK_SLOTS, (r + 1) * DECK_SLOTS);
  }

  /** Drops tombstones, keeping the order. True when rows moved. */
  compact(): boolean {
    let w = 0;
    for (let r = 0; r < this.rows; r++) {
      if (this.id[r] === 0) continue;
      if (w !== r) {
        for (const name of SHIP_COLUMNS) this.col(name)[w] = this.col(name)[r];
        this.deck.copyWithin(
          w * DECK_SLOTS,
          r * DECK_SLOTS,
          (r + 1) * DECK_SLOTS,
        );
        this.deckD.copyWithin(
          w * WW_PLANE_DESIGN_SLOTS,
          r * WW_PLANE_DESIGN_SLOTS,
          (r + 1) * WW_PLANE_DESIGN_SLOTS,
        );
      }
      w++;
    }
    const moved = w !== this.rows;
    // The tail is zeros again, so a restored table is equal element by element.
    for (const name of SHIP_COLUMNS) this.col(name).fill(0, w, this.rows);
    this.deck.fill(0, w * DECK_SLOTS, this.rows * DECK_SLOTS);
    this.deckD.fill(
      0,
      w * WW_PLANE_DESIGN_SLOTS,
      this.rows * WW_PLANE_DESIGN_SLOTS,
    );
    this.rows = w;
    this.rebuildIndex();
    return moved;
  }

  rebuildIndex(): void {
    this.shipRowIndex = new Map();
    for (let r = 0; r < this.rows; r++) {
      if (this.id[r] !== 0) this.shipRowIndex.set(this.id[r], r);
    }
  }

  /** Every used row and the capacity (plan decision 16: a restore rebuilds the same arrays). */
  snapshot(): ShipTableState {
    const cols = {} as Record<ShipColumn, number[]>;
    for (const name of SHIP_COLUMNS) {
      cols[name] = Array.from(this.col(name).subarray(0, this.rows));
    }
    return {
      ...cols,
      rows: this.rows,
      capacity: this.capacity,
      deck: Array.from(this.deck.subarray(0, this.rows * DECK_SLOTS)),
      // P6 (plan decision 9): the non-zero cells only, [index, planes].
      deckD: nonZeroCells(
        this.deckD.subarray(0, this.rows * WW_PLANE_DESIGN_SLOTS),
      ),
    };
  }

  restore(s: ShipTableState): void {
    this.rows = 0;
    this.capacity = 0;
    this.grow(s.capacity);
    for (const name of SHIP_COLUMNS) this.col(name).set(s[name] ?? []);
    this.deck.set(s.deck);
    for (const [i, v] of s.deckD ?? []) this.deckD[i] = v;
    this.rows = s.rows;
    this.rebuildIndex();
  }
}

// ---- Fleets, battles, routes, voyages, invasions, admirals ----

export interface Fleet {
  id: number;
  owner: number;
  nameIdx: number;
  num: number;
  admiral: number;
  /** Ship ids, ascending. */
  ships: number[];
  home: number;
  zone: number;
  docked: number;
  /** Zones ahead, the next first; the edge in progress and its milli-km. */
  path: number[];
  edge: number;
  prog: number;
  need: number;
  /** Where a move order or the mission sends it (0: nowhere). */
  dest: number;
  /** FLEET_MISSIONS index. */
  mission: number;
  missionSr: number;
  /** ENGAGE_RULES index. */
  engage: number;
  returnAtPct: number;
  auto: boolean;
  /** FLEET_STATES index. */
  state: number;
  /** Strike force: the enemy fleet it sortied against. */
  sortieTarget: number;
  /** Day it goes back to its mission after a battle (spec §9.7). */
  resumeDay: number;
  /** Carrier deck mix in tenths, fighter / CAS / torpedo bomber (spec §9.6). */
  mix: [number, number, number];
  /** Sea region it was in at the last daily step (spotting resets on a change). */
  lastSr: number;
  /** Last day it spent a tick at sea (fuel, spec §7.3). */
  seaDay: number;
  /** Pending carrier port strike: the target port region (spec §13.4); 0 none. */
  portStrike: number;
  /** Spec §7.2: the port's new-ships fleet (commissionShip puts launches here). */
  newShips: boolean;
}

export interface NavalBattle {
  zone: number;
  /** Side keys: [attacker, defender]. */
  sides: [number, number];
  fleets: [number[], number[]];
  round: number;
  startHp: [number, number];
  startOrg: [number, number];
  retreating: [boolean, boolean];
  /** Ships sunk so far per side × SHIP_CLASSES index (the end-of-battle line, spec §9.8). */
  sunk: [number[], number[]];
  /** Named ships sunk this battle (world news). */
  sunkNamed: number[];
  startTick: number;
}

export interface SeaRoute {
  id: number;
  /** CONVOY_USES index. */
  use: number;
  /** Who pays the convoys. */
  owner: number;
  /** Trade id / hub region / voyage id. */
  ref: number;
  zones: number[];
  km: number;
  /** Sea regions crossed, each once, in path order. */
  srs: number[];
  need: number;
  got: number;
  nextDay: number;
}

export interface Voyage {
  id: number;
  owner: number;
  army: number;
  invasion: boolean;
  divisions: number[];
  from: number;
  to: number;
  /** SeaRoute id. */
  route: number;
  /** Position on route.zones. */
  zoneIdx: number;
  prog: number;
  need: number;
  /** Convoys bound at launch (plan decision 20). */
  bound: number;
  aborting: boolean;
  departTick: number;
}

export interface Invasion {
  army: number;
  owner: number;
  target: number;
  from: number;
  /** INVASION_STATES index. */
  state: number;
  prepDays: number;
  prepDone: number;
  voyage: number;
  readySent: boolean;
}

export interface AdmiralState {
  id: number;
  owner: number;
  xpMilli: number;
  level: number;
  /** Attack, defense, maneuver, coordination. */
  skills: [number, number, number, number];
  /** ADMIRAL_TRAITS bit mask. */
  traits: number;
  fleet: number;
  /** Days in battle / taking damage / on mission / carriers-escort (spec §7.4 which skill grows). */
  usage: [number, number, number, number];
}

/** One country's navy bookkeeping. */
export class CountryNavy {
  navyXpMilli = 0;
  titledAdmirals = 0;
  nextFleetNum = 1;
  /** 30 daily convoy losses, milli, by day % 30 (screen + AI). */
  convoyLoss = new Array<number>(30).fill(0);
  /** The day's bundles of notifications (state: a snapshot may fall before they go). */
  shipsLostToday = 0;
  commissionedToday: number[] = [];
  /** Numbered-name counters per SHIP_CLASSES index (plan decision 17). */
  nameNum = new Array<number>(SHIP_CLASSES.length).fill(0);
  /** Names of the build queue taken per SHIP_CLASSES index (ShipNames.queuedShipName). */
  nameNext = new Array<number>(SHIP_CLASSES.length).fill(0);
  constructor(
    readonly smallID: number,
    readonly tag: CountryTag,
  ) {}
}

/** Per sea region state, srIdx order (decision 19). */
export interface SrNavyState {
  /**
   * P5 (pre-flight §0-10): side key → the convoy loss rate ‰ of the
   * region's last day (lane C's convoy war writes it; lend-lease reads it).
   */
  lossRate: Map<number, number>;
  /** side key → supremacy ‰, computed on the region's day. */
  sup: Map<number, number>;
  /** side key → (fleet id → spotting ‰), non-zero only. */
  spot: Map<number, Map<number, number>>;
  /** country → convoy raid remainder milli. */
  raidRest: Map<number, number>;
  /** country → convoys sunk here yesterday, milli (spotting bonus, screens). */
  lossYesterday: Map<number, number>;
  /** Fleets that sank convoys here yesterday (spotting +300, spec §8.4). */
  raidedYesterday: number[];
  /** The day this region last ran its daily step (the foundation writes it before calling the lanes). */
  lastDay: number;
}

function emptySrState(): SrNavyState {
  return {
    lossRate: new Map(),
    sup: new Map(),
    spot: new Map(),
    raidRest: new Map(),
    lossYesterday: new Map(),
    raidedYesterday: [],
    lastDay: -1,
  };
}

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

// ---- Snapshot schema ----

const zInts = () => z.array(zInt());
const ShipTableSchema = z.object({
  rows: zInt(),
  capacity: zInt(),
  id: zInts(),
  owner: zInts(),
  cls: zInts(),
  gen: zInts(),
  fleet: zInts(),
  hp: zInts(),
  org: zInts(),
  nameIdx: zInts(),
  reveal: zInts(),
  escape: zInts(),
  docks: zInts(),
  nameOwner: zInts(),
  deck: zInts(),
  // P6 (plan decisions 8, 9, 12): written always; absent reads 0 (tallyDay −1).
  design: zInts().optional(),
  refitTo: zInts().optional(),
  refitLeft: zInts().optional(),
  tallyDay: zInts().optional(),
  deckD: z.array(z.tuple([zInt(), zInt()])).optional(),
});
type ShipTableState = z.infer<typeof ShipTableSchema>;
const FleetSchema = z.object({
  id: zInt(),
  owner: zInt(),
  nameIdx: zInt(),
  num: zInt(),
  admiral: zInt(),
  ships: zInts(),
  home: zInt(),
  zone: zInt(),
  docked: zInt(),
  path: zInts(),
  edge: zInt(),
  prog: zInt(),
  need: zInt(),
  dest: zInt(),
  mission: zInt(),
  missionSr: zInt(),
  engage: zInt(),
  returnAtPct: zInt(),
  auto: z.boolean(),
  state: zInt(),
  sortieTarget: zInt(),
  resumeDay: zInt(),
  mix: z.tuple([zInt(), zInt(), zInt()]),
  lastSr: zInt(),
  seaDay: zInt(),
  portStrike: zInt(),
  newShips: z.boolean(),
});
const BattleSchema = z.object({
  zone: zInt(),
  sides: z.tuple([zInt(), zInt()]),
  fleets: z.tuple([zInts(), zInts()]),
  round: zInt(),
  startHp: z.tuple([zInt(), zInt()]),
  startOrg: z.tuple([zInt(), zInt()]),
  retreating: z.tuple([z.boolean(), z.boolean()]),
  sunk: z.tuple([zInts(), zInts()]),
  sunkNamed: zInts(),
  startTick: zInt(),
});
const RouteSchema = z.object({
  id: zInt(),
  use: zInt(),
  owner: zInt(),
  ref: zInt(),
  zones: zInts(),
  km: zInt(),
  srs: zInts(),
  need: zInt(),
  got: zInt(),
  nextDay: zInt(),
});
const VoyageSchema = z.object({
  id: zInt(),
  owner: zInt(),
  army: zInt(),
  invasion: z.boolean(),
  divisions: zInts(),
  from: zInt(),
  to: zInt(),
  route: zInt(),
  zoneIdx: zInt(),
  prog: zInt(),
  need: zInt(),
  bound: zInt(),
  aborting: z.boolean(),
  departTick: zInt(),
});
const InvasionSchema = z.object({
  army: zInt(),
  owner: zInt(),
  target: zInt(),
  from: zInt(),
  state: zInt(),
  prepDays: zInt(),
  prepDone: zInt(),
  voyage: zInt(),
  readySent: z.boolean(),
});
const AdmiralSchema = z.object({
  id: zInt(),
  owner: zInt(),
  xpMilli: zInt(),
  level: zInt(),
  skills: z.tuple([zInt(), zInt(), zInt(), zInt()]),
  traits: zInt(),
  fleet: zInt(),
  usage: z.tuple([zInt(), zInt(), zInt(), zInt()]),
});
const SrSchema = z.object({
  lossRate: z.array(z.tuple([zInt(), zInt()])),
  sup: z.array(z.tuple([zInt(), zInt()])),
  spot: z.array(z.tuple([zInt(), zInt(), zInt()])),
  raidRest: z.array(z.tuple([zInt(), zInt()])),
  lossYesterday: z.array(z.tuple([zInt(), zInt()])),
  raidedYesterday: zInts(),
  lastDay: zInt(),
});
const CountryNavySchema = z.object({
  navyXpMilli: zInt(),
  titledAdmirals: zInt(),
  nextFleetNum: zInt(),
  convoyLoss: zInts(),
  shipsLostToday: zInt(),
  commissionedToday: zInts(),
  nameNum: zInts(),
  nameNext: zInts(),
});
export const WwNavyStateSchema = z.object({
  ships: ShipTableSchema,
  fleets: z.array(FleetSchema),
  battles: z.array(BattleSchema),
  routes: z.array(RouteSchema),
  voyages: z.array(VoyageSchema),
  invasions: z.array(InvasionSchema),
  admirals: z.array(AdmiralSchema),
  srs: z.array(SrSchema),
  countries: z.array(CountryNavySchema),
  /** Lane I (pre-flight A10): beachhead region → [side, until day]; landing division → until tick. */
  beachhead: z.array(z.tuple([zInt(), zInt(), zInt()])),
  landing: z.array(z.tuple([zInt(), zInt()])),
  /** Lane AI (pre-flight A14): NAVAL_BEATS rolls [idHash, delay, skipped]. */
  beats: z.array(z.tuple([zInt(), zInt(), z.boolean()])),
  beatsRolled: z.boolean(),
  nextShipId: zInt(),
  nextFleetId: zInt(),
  nextRouteId: zInt(),
  nextVoyageId: zInt(),
  convoysSunkTotal: zInt(),
  lastCommonDay: zInt(),
});
export type WwNavyState = z.infer<typeof WwNavyStateSchema>;

const MISSION_HOLD = FLEET_MISSIONS.indexOf("hold");
const ENGAGE_DEFAULT = ENGAGE_RULES.indexOf("if_stronger");
const STATE_DOCKED = FLEET_STATES.indexOf("docked");

/**
 * World War 1936 P4 navy (spec §19.1). Lives in WorldWar (plan decision
 * 2); ticks after the land war (spec §2.2-6).
 */
export class WwNavy {
  readonly ships = new ShipTable();
  readonly fleets = new Map<number, Fleet>();
  readonly battles = new Map<number, NavalBattle>();
  readonly routes = new Map<number, SeaRoute>();
  readonly voyages = new Map<number, Voyage>();
  readonly invasions = new Map<number, Invasion>();
  readonly admirals = new Map<number, AdmiralState>();
  readonly srState: SrNavyState[];
  /** Lane I: beachhead region → its side and the last day (spec §11.5). */
  readonly beachhead = new Map<number, { side: number; until: number }>();
  /** Lane I: division id → the tick its landing mark ends (spec §11.4). */
  readonly landing = new Map<number, number>();
  /** Lane AI: [idHash, delay days, skipped] per NAVAL_BEATS row (spec §17.6). */
  beats: [number, number, boolean][] = [];
  beatsRolled = false;
  nextShipId = 1;
  nextFleetId = 1;
  nextRouteId = 1;
  nextVoyageId = 1;
  convoysSunkTotal = 0;
  private lastCommonDay = -1;
  private countryList: (CountryNavy | null)[];
  // Derived (DERIVED_FIELDS).
  /** owner × 64 + cls × 8 + gen → the stats at that stats version and tech set (pre-flight §0-7). */
  private shipStatsMemo = new Map<
    number,
    {
      statsVer: number;
      researched: unknown;
      designVer: number;
      stats: ShipStats;
    }
  >();
  private fleetsByOwner: number[][] = [];
  private fleetsByZone = new Map<number, number[]>();
  private navyDirtyFleets = new Set<number>();
  private navyDirtyBattles = new Set<number>();
  private navyDirtySrs = new Set<number>();
  private navyDirtyCountries = new Set<number>();
  private removedFleetIds: number[] = [];
  private endedBattleZones: number[] = [];
  /** Screens only: this tick's sinkings per battle zone, [class, side, nameIdx, nameOwner] (NavalBattleSummary.sunk). */
  private sunkThisTick = new Map<number, [number, number, number, number][]>();

  constructor(
    readonly mg: Game,
    readonly ww: WorldWar,
  ) {
    const sc = ww.scenario;
    // The harbor fallback reads the tiles; the land war built the region tiles already.
    sc.ensureRegionTiles(mg.map());
    sc.navalZones();
    this.srState = sc.strategicList().map(() => emptySrState());
    this.countryList = [
      null,
      ...sc.countries.map((tag, i) => new CountryNavy(i + 1, tag)),
    ];
    this.rebuildDerived();
  }

  get econ(): WwEconomy {
    return this.ww.economy;
  }
  get land(): WwLand {
    return this.ww.land;
  }
  get scenario(): ScenarioIndex {
    return this.ww.scenario;
  }

  /** Spec §6: start navy, fleets, lines, admirals. WorldWar.start calls it once, after politics, economy and land. */
  start(): void {
    startNavy(this);
    for (const id of this.fleets.keys()) this.navyDirtyFleets.add(id);
    for (const s of this.scenario.strategicList()) {
      if (s.kind === "sea") this.navyDirtySrs.add(s.idx);
    }
    for (const cn of this.countries()) this.navyDirtyCountries.add(cn.smallID);
  }

  /**
   * Pre-flight A14: the NAVAL_BEATS rolls, once (WorldWarExecution.init,
   * after politics' roll): skip one in ten, delay 0..20 days.
   */
  rollBeats(seed: number): void {
    if (this.beatsRolled) return;
    this.beats = NAVAL_BEATS.map((b) => {
      const h = idHash(b.id);
      const skip = wwRoll(seed, P_NAVALBEAT, h, 1) % 10 === 0;
      const delay = wwRoll(seed, P_NAVALBEAT, h, 2) % 21;
      return [h, delay, skip];
    });
    this.beatsRolled = true;
  }

  // ---- Clock (spec §2.2-6) ----

  tick(ticks: number): void {
    this.sunkThisTick.clear();
    const prep = this.ww.inPrep(ticks);
    if (!prep) {
      const day = this.ww.day(ticks);
      if (day !== this.lastCommonDay) {
        this.lastCommonDay = day;
        this.dailyCommon();
      }
      const k = ticks - dayStartTick(day, this.ww.prepEndTick());
      if (k >= 0 && k < WW_DAY_SPLIT) {
        // ① sea regions: spotting, supremacy, convoy war, battles start
        for (const s of this.scenario.strategicList()) {
          if (s.kind === "sea" && s.idx % WW_DAY_SPLIT === k) {
            dailySeaRegion(this, s.id, day, ticks);
          }
        }
        // ② countries: housekeeping, repair, convoys, invasions, AI
        for (let id = 1; id < this.countryList.length; id++) {
          if (id % WW_DAY_SPLIT === k) this.dailyCountry(id, day, ticks);
        }
      }
    }
    applyFleetOrders(this, ticks); // ③
    stepFleets(this, ticks); // ④ (the preparation minute: own waters, no battles)
    if (!prep) {
      stepNavalBattles(this, ticks); // ⑤ zone order
      stepSeaVoyages(this, ticks); // ⑥ sea moves and landings
    }
  }

  private dailyCommon(): void {
    if (this.ships.compact()) this.rebuildFleetIndex();
    for (const cn of this.countries()) {
      cn.shipsLostToday = 0;
      cn.commissionedToday = [];
    }
  }

  private dailyCountry(id: number, day: number, tick: number): void {
    const cn = this.countryList[id];
    const p = this.mg.playerBySmallID(id);
    // P5 plan decision 6: the countries that play (an exile does).
    if (
      cn === null ||
      cn === undefined ||
      !p.isPlayer() ||
      !this.ww.isActor(id)
    ) {
      return;
    }
    dailyFleetHousekeeping(this, id, day); // N1
    noteFleetFuel(this, id, day); // E (pre-flight A13)
    dailyRepair(this, id, day); // N2 (borrows docks: E's lendDocks)
    allocateConvoys(this, id, day); // C
    dailyVoyages(this, id, day); // C (pre-flight §0-8)
    dailyInvasions(this, id, day, tick); // I
    dailyNavyXp(this, id, day); // N2
    noteNavalMissions(this, id); // P6 hook (D, plan decision 12)
    // P5 plan decision 7: the AI runs a country no human controls now.
    if (
      !this.ww.isHumanControlled(id) ||
      this.fleetsOf(id).some((f) => f.auto)
    ) {
      aiNavy(this, id, day);
      aiInvasions(this, id, day);
    }
    this.navyDirtyCountries.add(id);
  }

  // ---- Orders (spec §19.3; the same for humans and the AI) ----

  /**
   * One navy order of `smallID`'s country (NAVY_ORDER_KINDS and army_sea);
   * null when it took effect. `by` (pre-flight T1): a player's order turns
   * an auto fleet's auto off (lane N1).
   */
  issue(
    smallID: number,
    order: WwOrder,
    tick: number,
    by: LandOrderSource = "player",
  ): WwOrderBlock | null {
    const cn = this.country(smallID);
    const p = this.mg.playerBySmallID(smallID);
    // P5 plan decision 6: the country plays (an exile does).
    if (cn === null || !p.isPlayer() || !this.ww.isActor(smallID)) {
      return "dead";
    }
    let block: WwOrderBlock | null;
    switch (order.kind) {
      case "fleet_mission":
      case "fleet_move":
      case "fleet_return":
      case "fleet_base":
      case "fleet_engage":
      case "fleet_return_at":
      case "fleet_split":
      case "fleet_merge":
      case "fleet_admiral":
      case "fleet_auto":
        block = issueFleetOrder(this, smallID, order, tick); // N1
        if (block === null && by === "player" && order.kind !== "fleet_auto") {
          const f = this.fleets.get(order.fleet);
          if (f !== undefined && f.auto) {
            f.auto = false;
            this.markFleet(f.id);
          }
        }
        break;
      case "fleet_port_strike":
      case "carrier_mix":
        block = issueCarrierOrder(this, smallID, order, tick); // N2
        break;
      case "naval_line_add":
      case "naval_line_docks":
      case "naval_line_count":
      case "naval_line_remove":
      case "naval_line_move":
        block = issueNavalLineOrder(
          this.econ,
          this.econ.country(smallID)!,
          order,
          this.scenario,
        ); // E
        if (block === null) this.econ.markCountryDirty(smallID);
        break;
      case "appoint_admiral":
        block = appointAdmiral(this, smallID); // N2
        break;
      case "army_sea":
        block = issueSeaTransfer(this, smallID, order, tick, by); // C (decision 34)
        break;
      case "army_invade":
      case "invasion_execute":
      case "invasion_cancel":
        block = issueInvasionOrder(this, smallID, order, tick, by); // I
        break;
      default:
        return "bad_index";
    }
    if (block === null) this.navyDirtyCountries.add(smallID);
    return block;
  }

  // ---- Sides (decision 18) ----

  sideOf(smallID: number): number {
    return this.land.sideOf(smallID);
  }
  sideList(): readonly Side[] {
    return this.land.sideList();
  }
  isEnemy(a: number, b: number): boolean {
    return this.land.isEnemy(a, b);
  }

  // ---- Ships and fleets (used by every lane) ----

  /**
   * Spec §5.2 / P3 `ships`: a new ship in `port`'s new-ships fleet (one per
   * country and port; another when it is full). Without `nameIdx` a
   * destroyer or submarine takes a numbered name, any other class the next
   * name of its build queue (numbered when the queue ran out). Returns the
   * ship id.
   */
  commissionShip(
    owner: number,
    cls: ShipClass,
    gen: number,
    port: number,
    nameIdx?: number,
    design = 0,
  ): number {
    const cn = this.country(owner)!;
    let f: Fleet | undefined;
    for (const id of this.fleetsByOwner[owner] ?? []) {
      const x = this.fleets.get(id)!;
      if (
        x.newShips &&
        x.docked === port &&
        x.ships.length < WW_MAX_FLEET_SHIPS
      ) {
        f = x;
        break;
      }
    }
    if (f === undefined) {
      f = this.newFleet(owner, port, 0);
      f.newShips = true;
    }
    const id = this.addShip(
      f,
      cls,
      gen,
      nameIdx ?? this.nextName(cn, cls),
      design,
    );
    cn.commissionedToday.push(id);
    return id;
  }

  /** Tests and spec §6: a fleet docked in `port` from (class, gen, count) rows; returns its id. */
  createFleet(
    owner: number,
    port: number,
    comp: readonly (readonly [ShipClass, number, number])[],
    nameIdx = 0,
  ): number {
    const cn = this.country(owner)!;
    const f = this.newFleet(owner, port, nameIdx);
    for (const [cls, gen, count] of comp) {
      for (let i = 0; i < count; i++) {
        this.addShip(f, cls, gen, this.nextName(cn, cls));
      }
    }
    return f.id;
  }

  /** A new empty fleet docked in `port` (NavyStartRun, commissionShip, createFleet). */
  newFleet(owner: number, port: number, nameIdx: number): Fleet {
    const cn = this.country(owner)!;
    const zone = this.scenario.harborOf(port);
    const f: Fleet = {
      id: this.nextFleetId++,
      owner,
      nameIdx,
      num: cn.nextFleetNum++,
      admiral: 0,
      ships: [],
      home: port,
      zone,
      docked: port,
      path: [],
      edge: -1,
      prog: 0,
      need: 0,
      dest: 0,
      mission: MISSION_HOLD,
      missionSr: 0,
      engage: ENGAGE_DEFAULT,
      returnAtPct: 50,
      auto: false,
      state: STATE_DOCKED,
      sortieTarget: 0,
      resumeDay: -1,
      mix: [4, 3, 3],
      lastSr: this.scenario.zoneSr(zone),
      seaDay: -1,
      portStrike: 0,
      newShips: false,
    };
    // Fleet ids only rise: the Map stays in id order.
    this.fleets.set(f.id, f);
    (this.fleetsByOwner[owner] ??= []).push(f.id);
    this.indexZone(f.id, zone);
    this.markFleet(f.id);
    return f;
  }

  /** Adds a ship at full HP and org to `f`; returns its id. */
  addShip(
    f: Fleet,
    cls: ShipClass,
    gen: number,
    nameIdx: number,
    design = 0,
  ): number {
    const id = this.nextShipId++;
    const ci = SHIP_CLASSES.indexOf(cls);
    const r = this.ships.add(id, f.owner, ci, gen, f.id, 0, 0, nameIdx);
    // P6 (plan decision 8): a design line launches its design.
    this.ships.design[r] = design;
    const s = this.shipStatsOf(r);
    this.ships.hp[r] = s.hpMilli;
    this.ships.org[r] = s.orgMilli;
    // Ship ids only rise: pushing keeps the fleet's list ascending.
    f.ships.push(id);
    this.markFleet(f.id);
    return id;
  }

  /** Plan decision 17: the name a new ship of `cls` takes. */
  private nextName(cn: CountryNavy, cls: ShipClass): number {
    const ci = SHIP_CLASSES.indexOf(cls);
    if (cls !== "dd" && cls !== "ss") {
      const q = queuedShipName(cn.tag, cls, cn.nameNext[ci]);
      if (q > 0) {
        cn.nameNext[ci]++;
        return q;
      }
    }
    cn.nameNum[ci]++;
    return -cn.nameNum[ci];
  }

  /** The next numbered name of (owner, class), as a nameIdx (−n: "Destroyer No. n"). */
  numberedName(owner: number, cls: ShipClass): number {
    const cn = this.country(owner)!;
    const ci = SHIP_CLASSES.indexOf(cls);
    cn.nameNum[ci]++;
    return -cn.nameNum[ci];
  }

  /**
   * Sinks (`sunk`) or removes a ship: its row, its fleet slot (an empty
   * fleet goes), its deck planes (lost). `by`: the country that sank it
   * (P5 war score: EndgameHooks.onShipSunk), 0 when nobody did.
   */
  removeShip(id: number, sunk: boolean, tick: number, by = 0): void {
    const t = this.ships;
    const r = t.rowOf(id);
    if (r < 0) return;
    const owner = t.owner[r];
    const fleetId = t.fleet[r];
    if (sunk) onShipSunk(this, id, owner, SHIP_CLASSES[t.cls[r]], by, tick);
    const ce = this.econ.country(owner);
    if (ce !== null) this.loseDeck(ce, t.deckOf(r), sunk ? by : -1);
    const f = this.fleets.get(fleetId);
    if (f !== undefined) {
      f.ships = f.ships.filter((s) => s !== id);
      this.markFleet(fleetId);
    }
    t.kill(r);
    if (sunk) {
      const cn = this.country(owner);
      if (cn !== null) cn.shipsLostToday++;
    }
    this.removeFleetIfEmpty(fleetId);
  }

  /**
   * A deck's planes off the deployed ledger (DECK_SLOTS: 3 types × 3
   * generations); `by` ≥ 0: they went down with the ship, sunk by `by`
   * (EndgameHooks.onPlanesLost), −1: removed.
   */
  private loseDeck(
    ce: NonNullable<ReturnType<WwEconomy["country"]>>,
    deck: Int32Array,
    by: number,
  ): void {
    const types = ["cv_fighter", "cv_cas", "cv_naval_bomber"] as const;
    types.forEach((type, i) => {
      const counts = [deck[i * 3], deck[i * 3 + 1], deck[i * 3 + 2]];
      if (!counts.some((c) => c > 0)) return;
      losePlanes(ce, type, counts);
      if (by >= 0) {
        const n = counts[0] + counts[1] + counts[2];
        onPlanesLost(this.ww.air, ce.smallID, by, type, n);
      }
    });
  }

  /**
   * P5 hook (decision 32): a ship goes to `to`'s nearest working naval
   * base's new-ships fleet (by sea from where it is); it keeps its name,
   * its deck planes go back to the old owner's stock. Without a base the
   * ship is gone.
   */
  transferShip(id: number, to: number): void {
    const t = this.ships;
    const r = t.rowOf(id);
    if (r < 0 || this.country(to) === null) return;
    const from = t.owner[r];
    const zone = this.fleets.get(t.fleet[r])?.zone ?? 0;
    const ports = navalPortsOf(this.ww, to).filter(
      (p) => this.scenario.harborOf(p) !== 0,
    );
    let best = 0;
    let bestKm = Infinity;
    for (const p of ports) {
      const path = seaPath(
        this.scenario,
        [zone],
        [this.scenario.harborOf(p)],
        this.passable(to, true),
      );
      if (path !== null && path.km < bestKm) {
        best = p;
        bestKm = path.km;
      }
    }
    if (best === 0) {
      this.removeShip(id, false, this.mg.ticks());
      return;
    }
    const ceFrom = this.econ.country(from);
    if (ceFrom !== null) this.returnDeck(ceFrom, t.deckOf(r));
    const old = t.fleet[r];
    const f0 = this.fleets.get(old);
    if (f0 !== undefined) {
      f0.ships = f0.ships.filter((s) => s !== id);
      this.markFleet(old);
    }
    let f: Fleet | undefined;
    for (const fid of this.fleetsByOwner[to] ?? []) {
      const x = this.fleets.get(fid)!;
      if (x.newShips && x.docked === best) f = x;
    }
    f ??= Object.assign(this.newFleet(to, best, 0), { newShips: true });
    t.owner[r] = to;
    t.fleet[r] = f.id;
    f.ships.push(id);
    f.ships.sort((a, b) => a - b);
    this.markFleet(f.id);
    this.removeFleetIfEmpty(old);
  }

  private returnDeck(
    ce: NonNullable<ReturnType<WwEconomy["country"]>>,
    deck: Int32Array,
  ): void {
    const types = ["cv_fighter", "cv_cas", "cv_naval_bomber"] as const;
    types.forEach((type, i) => {
      for (let g = 0; g < 3; g++) {
        const n = deck[i * 3 + g];
        if (n <= 0) continue;
        const k = equipKey(type, g + 1);
        const back = Math.min(n, ce.planesDeployed[k]);
        ce.planesDeployed[k] -= back;
        ce.stock[k] += back;
        deck[i * 3 + g] = 0;
      }
    });
  }

  /** A fleet with no ship left goes (spec §7.2): out of its battle, its admiral free. */
  removeFleetIfEmpty(fleetId: number): void {
    const f = this.fleets.get(fleetId);
    if (f === undefined || f.ships.length > 0) return;
    this.fleets.delete(fleetId);
    this.removedFleetIds.push(fleetId);
    this.navyDirtyFleets.delete(fleetId);
    const own = this.fleetsByOwner[f.owner];
    if (own !== undefined) {
      this.fleetsByOwner[f.owner] = own.filter((x) => x !== fleetId);
    }
    this.unindexZone(fleetId, f.zone);
    for (const b of this.battles.values()) {
      for (const side of [0, 1] as const) {
        const i = b.fleets[side].indexOf(fleetId);
        if (i >= 0) {
          b.fleets[side].splice(i, 1);
          this.markBattle(b.zone);
        }
      }
    }
    const a = this.admirals.get(f.admiral);
    if (a !== undefined && a.fleet === fleetId) a.fleet = 0;
  }

  /** Moves a fleet to `zone` in the zone index (lane N1's moves call it). */
  setFleetZone(f: Fleet, zone: number): void {
    if (f.zone === zone) return;
    this.unindexZone(f.id, f.zone);
    f.zone = zone;
    this.indexZone(f.id, zone);
    this.markFleet(f.id);
  }

  /**
   * A ship's numbers (shipStats) at its owner's stats and techs: kept by
   * (owner, class, generation) while the owner's statsVer and researched
   * set are the same (pre-flight §0-7), so a kept value is a fresh one.
   */
  shipStatsOf(row: number): ShipStats {
    const t = this.ships;
    return this.statsFor(
      t.owner[row],
      SHIP_CLASSES[t.cls[row]],
      t.gen[row],
      t.design[row],
    );
  }

  /**
   * shipStats of (owner, class, generation), memoised like shipStatsOf.
   * P6 (plan decision 8, pre-flight §A6): with a design slot, the design's
   * modifiers over it (lane E's shipDesignOf), the memo keyed by the slot
   * and the owner's design version too.
   */
  statsFor(owner: number, cls: ShipClass, gen: number, design = 0): ShipStats {
    const ce = this.econ.country(owner);
    const key =
      (owner * 64 + SHIP_CLASSES.indexOf(cls) * 8 + gen) * 32 + design;
    const dv = design === 0 ? 0 : this.ww.depth.designVersion(owner);
    const hit = this.shipStatsMemo.get(key);
    if (
      ce !== null &&
      hit !== undefined &&
      hit.statsVer === ce.statsVer &&
      hit.researched === ce.researched &&
      hit.designVer === dv
    ) {
      return hit.stats;
    }
    const base =
      ce === null
        ? shipStats(cls, gen, emptyStats(), new Set())
        : shipStats(cls, gen, ce.stats, ce.researched);
    const stats =
      design === 0
        ? base
        : applyShipDesign(base, shipDesignOf(this.ww.depth, owner, design));
    if (ce !== null) {
      this.shipStatsMemo.set(key, {
        statsVer: ce.statsVer,
        researched: ce.researched,
        designVer: dv,
        stats,
      });
    }
    return stats;
  }

  /** Spec §7.2: the slowest ship × (100 + navalSpeedPct) / 100 × the fuel factor, centi-knots. */
  fleetSpeedCentiKn(f: Fleet): number {
    let min = Infinity;
    for (const id of f.ships) {
      const r = this.ships.rowOf(id);
      if (r >= 0) min = Math.min(min, this.shipStatsOf(r).speedCentiKn);
    }
    if (min === Infinity) return 0;
    const ce = this.econ.country(f.owner);
    const pct = 100 + (ce?.stats.navalSpeedPct ?? 0);
    const fuel = fleetFuelSpeedPm(ce?.fuelRatioPm ?? 1000);
    return Math.floor((Math.floor((min * pct) / 100) * fuel) / 1000);
  }

  /** Spec §8.3: the shortest-ranged ship's range, km. */
  fleetRangeKm(f: Fleet): number {
    let min = Infinity;
    for (const id of f.ships) {
      const r = this.ships.rowOf(id);
      if (r >= 0) min = Math.min(min, this.shipStatsOf(r).rangeKm);
    }
    return min === Infinity ? 0 : min;
  }

  /** edgePassable for `owner` now (straits, canals, Montreux). */
  passable(owner: number, warship: boolean): (edge: number) => boolean {
    const sc = this.scenario;
    const land = this.land;
    const ww = this.ww;
    const tur = sc.smallIdOf("TUR");
    const q = {
      controller: (r: number) => land.controller[r] ?? 0,
      isEnemy: (a: number, b: number) => land.isEnemy(a, b),
      neutralTurkey: (r: number) =>
        tur !== 0 &&
        land.controller[r] === tur &&
        ww.factionOf(tur) === null &&
        !ww.hasWar(tur),
      isAtWarAny: (a: number) => ww.hasWar(a),
    };
    return (edge) => edgePassable(sc, edge, owner, warship, q);
  }

  /** seaPath from the fleet's zone to the nearest of `toZones`, its passable edges. */
  pathFor(
    f: Fleet,
    toZones: readonly number[],
  ): { zones: number[]; km: number } | null {
    return seaPath(
      this.scenario,
      [f.zone],
      toZones,
      this.passable(f.owner, true),
    );
  }

  /** Plan decision 11: a working naval base now. */
  isPort(region: number): boolean {
    return navalPort(this.ww, region);
  }

  harborZone(region: number): number {
    return this.scenario.harborOf(region);
  }

  fleetZoneSr(f: Fleet): number {
    return this.scenario.zoneSr(f.zone);
  }

  /** A country's fleets, by id. */
  fleetsOf(owner: number): Fleet[] {
    return (this.fleetsByOwner[owner] ?? []).map((id) => this.fleets.get(id)!);
  }

  /** Fleet ids in a zone, ascending (docked ones too). */
  fleetsIn(zone: number): readonly number[] {
    return this.fleetsByZone.get(zone) ?? NO_IDS;
  }

  /** A side's supremacy ‰ in a sea region (the region's last day). */
  supremacy(side: number, sr: number): number {
    const i = this.scenario.srIdxOf(sr);
    return i < 0 ? 0 : (this.srState[i].sup.get(side) ?? 0);
  }

  setSupremacy(sr: number, values: ReadonlyMap<number, number>): void {
    const i = this.scenario.srIdxOf(sr);
    if (i < 0) return;
    const m = new Map<number, number>();
    for (const [k, v] of [...values].sort((a, b) => a[0] - b[0])) {
      if (v !== 0) m.set(k, v);
    }
    this.srState[i].sup = m;
    this.markSr(i);
  }

  /** P5 (pre-flight §0-10): `owner`'s side's convoy loss rate ‰ in sea region srIdx (its last day). */
  lossRatePm(srIdx: number, owner: number): number {
    return this.srState[srIdx]?.lossRate.get(this.sideOf(owner)) ?? 0;
  }

  /** A side's spotting progress ‰ on a fleet, in the fleet's sea region. */
  spotPm(side: number, fleet: number): number {
    const f = this.fleets.get(fleet);
    if (f === undefined) return 0;
    const i = this.scenario.srIdxOf(this.fleetZoneSr(f));
    return i < 0 ? 0 : (this.srState[i].spot.get(side)?.get(fleet) ?? 0);
  }

  /** Sets a side's spotting progress on a fleet in sea region `sr` (0 deletes). */
  setSpotPm(sr: number, side: number, fleet: number, pm: number): void {
    const i = this.scenario.srIdxOf(sr);
    if (i < 0) return;
    const st = this.srState[i];
    let m = st.spot.get(side);
    if (pm === 0) {
      if (m === undefined) return;
      m.delete(fleet);
      if (m.size === 0) st.spot.delete(side);
    } else {
      if (m === undefined) setSorted(st.spot, side, (m = new Map()));
      setSorted(m, fleet, pm);
    }
    this.markSr(i);
  }

  spotted(side: number, fleet: number): boolean {
    return this.spotPm(side, fleet) >= WW_SPOT_FULL_PM;
  }

  country(smallID: number): CountryNavy | null {
    return this.countryList[smallID] ?? null;
  }

  countries(): CountryNavy[] {
    return this.countryList.filter((c): c is CountryNavy => c !== null);
  }

  day(tick: number): number {
    return this.ww.day(tick);
  }

  /** A message to the country's human player only; `key` is the full key (events_display.ww1936_…). */
  message(
    to: number,
    key: string,
    params: Record<string, string | number> = {},
  ): void {
    const p = this.mg.playerBySmallID(to);
    if (!p.isPlayer() || !this.ww.isHumanControlled(to)) return;
    this.mg.displayMessage(
      key,
      MessageType.WORLD_WAR,
      p.id(),
      undefined,
      params,
    );
  }

  markFleet(id: number): void {
    if (this.fleets.has(id)) this.navyDirtyFleets.add(id);
  }
  markBattle(zone: number): void {
    this.navyDirtyBattles.add(zone);
  }
  markSr(srIdx: number): void {
    this.navyDirtySrs.add(srIdx);
  }
  markCountry(id: number): void {
    this.navyDirtyCountries.add(id);
  }
  /** Ends a battle (its zone goes out in endedBattles). */
  endBattle(zone: number): void {
    if (this.battles.delete(zone)) this.endedBattleZones.push(zone);
  }
  /** Adds a battle keeping `battles` in zone order. */
  addBattle(b: NavalBattle): void {
    setSorted(this.battles, b.zone, b);
    this.markBattle(b.zone);
  }

  // ---- Control, capitulation, annexation (decision 32) ----

  /**
   * Spec §7.1: `region` changed hands this tick. Fleets of `from`'s side
   * docked there put to sea toward the nearest base of their side (lane
   * N1 moves them; none → they scuttle); `from`'s naval lines there move
   * to its best base (none: they stall, port 0).
   */
  onControlChanged(
    region: number,
    from: number,
    to: number,
    tick: number,
  ): void {
    if (from === 0 || this.land.sameSide(from, to)) return;
    // Docked there: in its harbor zone (a copy: scuttling edits the index).
    const harbor = this.scenario.harborOf(region);
    const here = harbor === 0 ? NO_IDS : [...this.fleetsIn(harbor)];
    for (const id of here) {
      const f = this.fleets.get(id);
      if (f === undefined) continue;
      if (f.docked !== region || !this.land.sameSide(f.owner, from)) continue;
      const base = this.nearestBase(f);
      if (base === 0) {
        for (const id of [...f.ships]) this.removeShip(id, true, tick);
        this.message(f.owner, "events_display.ww1936_fleet_scuttled", {
          region,
        });
        continue;
      }
      f.docked = 0;
      f.home = base;
      f.state = FLEET_STATES.indexOf("returning");
      this.markFleet(f.id);
    }
    const ce = this.econ.country(from);
    if (ce !== null) {
      for (const l of ce.navalLines) {
        if (l.port === region) l.port = bestNavalBase(this.ww, from);
      }
    }
  }

  /** The nearest working base of the fleet's side by sea; 0 when none. */
  private nearestBase(f: Fleet): number {
    let best = 0;
    let bestKm = Infinity;
    for (const r of this.scenario.landRegions) {
      if (!this.land.sameSide(f.owner, this.land.controller[r.id])) continue;
      if (!navalPort(this.ww, r.id)) continue;
      const z = this.scenario.harborOf(r.id);
      if (z === 0) continue;
      const p = this.pathFor(f, [z]);
      if (p !== null && p.km < bestKm) {
        best = r.id;
        bestKm = p.km;
      }
    }
    return best;
  }

  /**
   * Decision 32: a capitulated country's ships, fleets, battle places,
   * routes, voyages and invasions are gone this tick (P5 makes exile
   * fleets of them).
   */
  onCapitulation(loser: number, victor: number): void {
    // P5 (pre-flight §0-2): an exile fleet and air force may leave first.
    exileNavyAndAir(this, this.ww.air, loser, victor);
    const tick = this.mg.ticks();
    for (const f of this.fleetsOf(loser)) {
      for (const id of [...f.ships]) this.removeShip(id, false, tick);
    }
    for (const [id, r] of [...this.routes]) {
      if (r.owner === loser) this.routes.delete(id);
    }
    for (const [id, v] of [...this.voyages]) {
      if (v.owner === loser) this.voyages.delete(id);
    }
    for (const [id, inv] of [...this.invasions]) {
      if (inv.owner === loser) this.invasions.delete(id);
    }
    for (const a of this.admirals.values()) {
      if (a.owner === loser) a.fleet = 0;
    }
    this.navyDirtyCountries.add(loser);
  }

  /**
   * Decision 32 (P3 annexation): "transfer": `from`'s fleets become `to`'s
   * (new fleet numbers of `to`), its ships keep their names; "disband":
   * the ships are gone. Either way the decks' planes go back to `from`'s
   * stock. Routes, voyages and invasions of `from` end.
   */
  transferUnits(from: number, to: number, mode: "transfer" | "disband"): void {
    const toCn = this.country(to);
    if (toCn === null || from === to) return;
    const tick = this.mg.ticks();
    const ceFrom = this.econ.country(from);
    for (const f of this.fleetsOf(from)) {
      // The decks' planes are `from`'s: back to its stock either way.
      if (ceFrom !== null) {
        for (const id of f.ships) {
          const r = this.ships.rowOf(id);
          if (r >= 0) this.returnDeck(ceFrom, this.ships.deckOf(r));
        }
      }
      if (mode === "disband") {
        for (const id of [...f.ships]) this.removeShip(id, false, tick);
        continue;
      }
      this.fleetsByOwner[from] = (this.fleetsByOwner[from] ?? []).filter(
        (x) => x !== f.id,
      );
      f.owner = to;
      f.num = toCn.nextFleetNum++;
      f.admiral = 0;
      f.auto = false;
      (this.fleetsByOwner[to] ??= []).push(f.id);
      this.fleetsByOwner[to].sort((a, b) => a - b);
      for (const id of f.ships) {
        const r = this.ships.rowOf(id);
        if (r >= 0) this.ships.owner[r] = to;
      }
      this.markFleet(f.id);
    }
    for (const [id, r] of [...this.routes]) {
      if (r.owner === from) this.routes.delete(id);
    }
    for (const [id, v] of [...this.voyages]) {
      if (v.owner === from) this.voyages.delete(id);
    }
    for (const [id, inv] of [...this.invasions]) {
      if (inv.owner === from) this.invasions.delete(id);
    }
    for (const a of this.admirals.values()) {
      if (a.owner === from) a.fleet = 0;
    }
    this.navyDirtyCountries.add(from);
    this.navyDirtyCountries.add(to);
  }

  // ---- Screens (spec §19.4) ----

  /** The changes since the last call, or null when nothing changed. */
  takeData(): WwNavyData | null {
    if (
      this.battles.size === 0 &&
      this.navyDirtyFleets.size === 0 &&
      this.navyDirtySrs.size === 0 &&
      this.navyDirtyCountries.size === 0 &&
      this.removedFleetIds.length === 0 &&
      this.endedBattleZones.length === 0
    ) {
      this.navyDirtyBattles.clear();
      return null;
    }
    const humans = new Set<number>();
    for (const cn of this.countries()) {
      const p = this.mg.playerBySmallID(cn.smallID);
      if (p.isPlayer() && this.ww.isHumanControlled(cn.smallID)) {
        humans.add(cn.smallID);
      }
    }
    const data: WwNavyData = {
      fleets: [],
      removedFleets: [...this.removedFleetIds],
      battles: [],
      endedBattles: [...this.endedBattleZones],
      seaRegions: [],
      details: [],
    };
    for (const id of [...this.navyDirtyFleets].sort((a, b) => a - b)) {
      const f = this.fleets.get(id);
      if (f !== undefined) data.fleets.push(this.fleetSummary(f, humans));
    }
    // Every live battle every tick (spec §19.4).
    for (const b of this.battles.values()) {
      data.battles.push(this.battleSummary(b));
    }
    for (const i of [...this.navyDirtySrs].sort((a, b) => a - b)) {
      data.seaRegions.push(this.seaRegionData(i));
    }
    for (const id of [...this.navyDirtyCountries].sort((a, b) => a - b)) {
      if (humans.has(id)) data.details.push(this.countryDetail(id));
    }
    this.navyDirtyFleets.clear();
    this.navyDirtyBattles.clear();
    this.navyDirtySrs.clear();
    this.navyDirtyCountries.clear();
    this.removedFleetIds = [];
    this.endedBattleZones = [];
    if (
      data.fleets.length === 0 &&
      data.removedFleets.length === 0 &&
      data.battles.length === 0 &&
      data.endedBattles.length === 0 &&
      data.seaRegions.length === 0 &&
      data.details.length === 0
    ) {
      return null;
    }
    return data;
  }

  fleetSummary(f: Fleet, humans: ReadonlySet<number>): FleetSummary {
    const t = this.ships;
    const counts = new Array<number>(SHIP_CLASSES.length).fill(0);
    let hp = 0;
    let maxHp = 0;
    let org = 0;
    let maxOrg = 0;
    const ships: FleetSummary["ships"] = [];
    const mine = humans.has(f.owner);
    for (const id of f.ships) {
      const r = t.rowOf(id);
      if (r < 0) continue;
      const s = this.shipStatsOf(r);
      counts[t.cls[r]]++;
      hp += t.hp[r];
      maxHp += s.hpMilli;
      org += t.org[r];
      maxOrg += s.orgMilli;
      if (mine) {
        ships.push({
          id,
          cls: SHIP_CLASSES[t.cls[r]],
          gen: t.gen[r],
          nameIdx: t.nameIdx[r],
          nameOwner: t.nameOwner[r],
          hpPm: s.hpMilli === 0 ? 0 : Math.floor((t.hp[r] * 1000) / s.hpMilli),
        });
      }
    }
    const speed = this.fleetSpeedCentiKn(f);
    const ce = this.econ.country(f.owner);
    let flags = 0;
    if ((ce?.fuelRatioPm ?? 1000) < 1000) flags |= FLEET_FLAG_LOW_FUEL;
    if (f.auto) flags |= FLEET_FLAG_AUTO;
    const stepMilliKm = tickMilliKm(speed);
    return {
      id: f.id,
      owner: f.owner,
      nameIdx: f.nameIdx,
      num: f.num,
      counts,
      hpPm: maxHp === 0 ? 0 : Math.floor((hp * 1000) / maxHp),
      orgPm: maxOrg === 0 ? 0 : Math.floor((org * 1000) / maxOrg),
      zone: f.zone,
      docked: f.docked,
      path: f.path.slice(0, 8),
      progPm: f.need <= 0 ? 0 : Math.floor((f.prog * 1000) / f.need),
      stepPm:
        f.need <= 0 || f.path.length === 0
          ? 0
          : Math.floor((stepMilliKm * 1000) / f.need),
      mission: FLEET_MISSIONS[f.mission] ?? "hold",
      missionSr: f.missionSr,
      state: FLEET_STATES[f.state] ?? "docked",
      flags,
      admiral: mine ? f.admiral : 0,
      engage: mine ? (ENGAGE_RULES[f.engage] ?? "always") : "always",
      returnAtPct: mine ? f.returnAtPct : 50,
      ships,
      // Lane U (the fleet card): own fleets' home, repair days, deck mix.
      ...(mine
        ? {
            home: f.home,
            repairDays: fleetRepairDays(this, f),
            ...(counts[SHIP_CLASSES.indexOf("cv")] > 0
              ? { mix: [...f.mix] as [number, number, number] }
              : {}),
          }
        : {}),
    };
  }

  private battleSummary(b: NavalBattle): NavalBattleSummary {
    const side = (i: 0 | 1) => {
      let hp = 0;
      let maxHp = 0;
      let org = 0;
      let maxOrg = 0;
      let n = 0;
      let rep = 0;
      for (const fid of b.fleets[i]) {
        const f = this.fleets.get(fid);
        if (f === undefined) continue;
        if (rep === 0 || f.owner < rep) rep = f.owner;
        for (const id of f.ships) {
          const r = this.ships.rowOf(id);
          if (r < 0) continue;
          const s = this.shipStatsOf(r);
          hp += this.ships.hp[r];
          maxHp += s.hpMilli;
          org += this.ships.org[r];
          maxOrg += s.orgMilli;
          n++;
        }
      }
      return {
        rep,
        hpPm: maxHp === 0 ? 0 : Math.floor((hp * 1000) / maxHp),
        orgPm: maxOrg === 0 ? 0 : Math.floor((org * 1000) / maxOrg),
        n,
      };
    };
    const a = side(0);
    const d = side(1);
    return {
      zone: b.zone,
      attacker: a.rep,
      defender: d.rep,
      round: b.round,
      hpPm: [a.hpPm, d.hpPm],
      orgPm: [a.orgPm, d.orgPm],
      ships: [a.n, d.n],
      sunk: (this.sunkThisTick.get(b.zone) ?? []).map(
        (x): [number, number, number, number] => [x[0], x[1], x[2], x[3]],
      ),
    };
  }

  /** N2's sinkings: a ship of `side` sank in the battle in `zone` this tick (screens only). */
  noteSunk(
    zone: number,
    cls: number,
    side: number,
    nameIdx: number,
    nameOwner: number,
  ): void {
    let l = this.sunkThisTick.get(zone);
    if (l === undefined) {
      l = [];
      this.sunkThisTick.set(zone, l);
    }
    l.push([cls, side, nameIdx, nameOwner]);
  }

  private seaRegionData(i: number): SeaRegionData {
    const s = this.scenario.strategicList()[i];
    const st = this.srState[i];
    return {
      sr: s.id,
      sup: [...st.sup],
      spotted: [...st.spot].map(([side, m]): [number, number[]] => [
        side,
        [...m].filter(([, pm]) => pm >= WW_SPOT_FULL_PM).map(([fid]) => fid),
      ]),
      convoyLoss: [...st.lossYesterday],
    };
  }

  private countryDetail(id: number): CountryNavyDetail {
    const cn = this.country(id)!;
    const ce = this.econ.country(id)!;
    const byUse = new Array<number>(CONVOY_USES.length).fill(0);
    for (const v of this.voyages.values()) {
      if (v.owner === id) byUse[CONVOY_USES.indexOf("voyage")] += v.bound;
    }
    for (const r of this.routes.values()) {
      if (r.owner === id) byUse[r.use] += r.got;
    }
    const day = this.ww.day(this.mg.ticks());
    return {
      smallID: id,
      lines: ce.navalLines.map((l) => ({
        id: l.id,
        cls: navalLineClass(l.cls),
        gen: l.gen,
        docks: l.docks,
        activeDocks: l.activeDocks,
        progressMilli: l.progress,
        costMilli: lineCostMilli(l),
        left: l.left,
        port: l.port,
        nextName:
          l.names[0] ??
          (navalLineClass(l.cls) === "convoy" ||
          navalLineClass(l.cls) === "floating_harbor" ||
          SHIP_CLASSES[l.cls] === "dd" ||
          SHIP_CLASSES[l.cls] === "ss"
            ? 0
            : queuedShipName(cn.tag, SHIP_CLASSES[l.cls], cn.nameNext[l.cls])),
        outputMilli: l.lastOutput,
        fill: l.fill,
      })),
      docks: ce.totals.dock,
      docksLent: ce.docksLent,
      docksIdle: dockyardsFree(this.econ, ce),
      convoys: convoysOf(ce),
      convoysByUse: byUse,
      routes: [...this.routes.values()]
        .filter((r) => r.owner === id)
        .map((r) => ({
          id: r.id,
          use: CONVOY_USES[r.use] ?? "trade",
          owner: r.owner,
          ref: r.ref,
          zones: [...r.zones],
          km: r.km,
          srs: [...r.srs],
          need: r.need,
          got: r.got,
        })),
      invasions: [...this.invasions.values()]
        .filter((x) => x.owner === id)
        .map((x) => {
          const v = this.voyages.get(x.voyage);
          const route = v === undefined ? undefined : this.routes.get(v.route);
          return {
            army: x.army,
            target: x.target,
            from: x.from,
            state: INVASION_STATES[x.state] ?? "preparing",
            prepDone: x.prepDone,
            prepDays: x.prepDays,
            convoys: v?.bound ?? 0,
            route: (route?.srs ?? []).map((sr): [number, number] => [
              sr,
              this.supremacy(this.sideOf(id), sr),
            ]),
          };
        }),
      admirals: [...this.admirals.values()]
        .filter((a) => a.owner === id)
        .map((a): [number, number] => [a.id, a.fleet]),
      navyXpMilli: cn.navyXpMilli,
      convoyLoss30: Array.from(
        { length: 30 },
        (_, i) => cn.convoyLoss[(((day + 1 + i) % 30) + 30) % 30],
      ),
      fuelMilli: ce.fuelMilli,
      fuelCapMilli: fuelCapOf(this.econ, ce),
      fuelRatioPm: ce.fuelRatioPm,
      // Lane U: my landing divisions (the battle card's landing lines) and
      // my admirals' skills now.
      landing: [...this.landing.keys()]
        .filter((d) => {
          const r = this.land.divisions.rowOf(d);
          return r >= 0 && this.land.divisions.owner[r] === id;
        })
        .sort((a, b) => a - b),
      admiralSkills: [...this.admirals.values()]
        .filter((a) => a.owner === id)
        .map((a): [number, number, number, number, number, number, number] => [
          a.id,
          ...a.skills,
          a.traits,
          a.level,
        ]),
    };
  }

  // ---- Snapshot, hash ----

  snapshot(): WwNavyState {
    return {
      ships: this.ships.snapshot(),
      fleets: [...this.fleets.values()].map((f) => ({
        ...f,
        ships: [...f.ships],
        path: [...f.path],
        mix: [...f.mix] as [number, number, number],
      })),
      battles: [...this.battles.values()].map((b) => ({
        ...b,
        sides: [...b.sides] as [number, number],
        fleets: [[...b.fleets[0]], [...b.fleets[1]]],
        startHp: [...b.startHp] as [number, number],
        startOrg: [...b.startOrg] as [number, number],
        retreating: [...b.retreating] as [boolean, boolean],
        sunk: [[...b.sunk[0]], [...b.sunk[1]]],
        sunkNamed: [...b.sunkNamed],
      })),
      routes: [...this.routes.values()].map((r) => ({
        ...r,
        zones: [...r.zones],
        srs: [...r.srs],
      })),
      voyages: [...this.voyages.values()].map((v) => ({
        ...v,
        divisions: [...v.divisions],
      })),
      invasions: [...this.invasions.values()].map((x) => ({ ...x })),
      admirals: [...this.admirals.values()].map((a) => ({
        ...a,
        skills: [...a.skills] as [number, number, number, number],
        usage: [...a.usage] as [number, number, number, number],
      })),
      srs: this.srState.map((s) => ({
        lossRate: [...s.lossRate].map(([k, v]): [number, number] => [k, v]),
        sup: [...s.sup].map(([k, v]): [number, number] => [k, v]),
        spot: [...s.spot].flatMap(([side, m]) =>
          [...m].map(([f, pm]): [number, number, number] => [side, f, pm]),
        ),
        raidRest: [...s.raidRest].map(([k, v]): [number, number] => [k, v]),
        lossYesterday: [...s.lossYesterday].map(([k, v]): [number, number] => [
          k,
          v,
        ]),
        raidedYesterday: [...s.raidedYesterday],
        lastDay: s.lastDay,
      })),
      countries: this.countries().map((c) => ({
        navyXpMilli: c.navyXpMilli,
        titledAdmirals: c.titledAdmirals,
        nextFleetNum: c.nextFleetNum,
        convoyLoss: [...c.convoyLoss],
        shipsLostToday: c.shipsLostToday,
        commissionedToday: [...c.commissionedToday],
        nameNum: [...c.nameNum],
        nameNext: [...c.nameNext],
      })),
      beachhead: [...this.beachhead].map(([r, b]): [number, number, number] => [
        r,
        b.side,
        b.until,
      ]),
      landing: [...this.landing].map(([d, t]): [number, number] => [d, t]),
      beats: this.beats.map((b): [number, number, boolean] => [
        b[0],
        b[1],
        b[2],
      ]),
      beatsRolled: this.beatsRolled,
      nextShipId: this.nextShipId,
      nextFleetId: this.nextFleetId,
      nextRouteId: this.nextRouteId,
      nextVoyageId: this.nextVoyageId,
      convoysSunkTotal: this.convoysSunkTotal,
      lastCommonDay: this.lastCommonDay,
    };
  }

  restoreState(s: WwNavyState): void {
    this.ships.restore(s.ships);
    this.fleets.clear();
    for (const f of s.fleets) {
      this.fleets.set(f.id, {
        ...f,
        ships: [...f.ships],
        path: [...f.path],
        mix: [...f.mix] as [number, number, number],
      });
    }
    this.battles.clear();
    for (const b of s.battles) {
      this.battles.set(b.zone, {
        ...b,
        sides: [...b.sides] as [number, number],
        fleets: [[...b.fleets[0]], [...b.fleets[1]]],
        startHp: [...b.startHp] as [number, number],
        startOrg: [...b.startOrg] as [number, number],
        retreating: [...b.retreating] as [boolean, boolean],
        sunk: [[...b.sunk[0]], [...b.sunk[1]]],
        sunkNamed: [...b.sunkNamed],
      });
    }
    this.routes.clear();
    for (const r of s.routes) {
      this.routes.set(r.id, { ...r, zones: [...r.zones], srs: [...r.srs] });
    }
    this.voyages.clear();
    for (const v of s.voyages) {
      this.voyages.set(v.id, { ...v, divisions: [...v.divisions] });
    }
    this.invasions.clear();
    for (const x of s.invasions) this.invasions.set(x.army, { ...x });
    this.admirals.clear();
    for (const a of s.admirals) {
      this.admirals.set(a.id, {
        ...a,
        skills: [...a.skills] as [number, number, number, number],
        usage: [...a.usage] as [number, number, number, number],
      });
    }
    s.srs.forEach((x, i) => {
      const st = this.srState[i];
      if (st === undefined) return;
      st.lossRate = new Map(x.lossRate.map(([k, v]) => [k, v]));
      st.sup = new Map(x.sup.map(([k, v]) => [k, v]));
      st.spot = new Map();
      for (const [side, f, pm] of x.spot) {
        let m = st.spot.get(side);
        if (m === undefined) st.spot.set(side, (m = new Map()));
        m.set(f, pm);
      }
      st.raidRest = new Map(x.raidRest.map(([k, v]) => [k, v]));
      st.lossYesterday = new Map(x.lossYesterday.map(([k, v]) => [k, v]));
      st.raidedYesterday = [...x.raidedYesterday];
      st.lastDay = x.lastDay;
    });
    this.countries().forEach((c, i) => {
      const x = s.countries[i];
      if (x === undefined) return;
      c.navyXpMilli = x.navyXpMilli;
      c.titledAdmirals = x.titledAdmirals;
      c.nextFleetNum = x.nextFleetNum;
      c.convoyLoss = [...x.convoyLoss];
      c.shipsLostToday = x.shipsLostToday;
      c.commissionedToday = [...x.commissionedToday];
      c.nameNum = [...x.nameNum];
      c.nameNext = [...x.nameNext];
    });
    this.beachhead.clear();
    for (const [r, side, until] of s.beachhead) {
      this.beachhead.set(r, { side, until });
    }
    this.landing.clear();
    for (const [d, t] of s.landing) this.landing.set(d, t);
    this.beats = s.beats.map((b): [number, number, boolean] => [
      b[0],
      b[1],
      b[2],
    ]);
    this.beatsRolled = s.beatsRolled;
    this.nextShipId = s.nextShipId;
    this.nextFleetId = s.nextFleetId;
    this.nextRouteId = s.nextRouteId;
    this.nextVoyageId = s.nextVoyageId;
    this.convoysSunkTotal = s.convoysSunkTotal;
    this.lastCommonDay = s.lastCommonDay;
    this.rebuildDerived();
    // A restored game's screens have seen nothing yet.
    for (const id of this.fleets.keys()) this.navyDirtyFleets.add(id);
    for (const st of this.scenario.strategicList()) {
      if (st.kind === "sea") this.navyDirtySrs.add(st.idx);
    }
    for (const cn of this.countries()) this.navyDirtyCountries.add(cn.smallID);
  }

  /** The memo, the fleet indexes. The constructor and restoreState call it. */
  rebuildDerived(): void {
    this.shipStatsMemo.clear();
    this.ships.rebuildIndex();
    this.rebuildFleetIndex();
  }

  private rebuildFleetIndex(): void {
    this.fleetsByOwner = [];
    this.fleetsByZone = new Map();
    for (const f of this.fleets.values()) {
      (this.fleetsByOwner[f.owner] ??= []).push(f.id);
      this.indexZone(f.id, f.zone);
    }
  }

  private indexZone(fleet: number, zone: number): void {
    const l = this.fleetsByZone.get(zone);
    if (l === undefined) {
      setSorted(this.fleetsByZone, zone, [fleet]);
      return;
    }
    let i = l.length;
    while (i > 0 && l[i - 1] > fleet) i--;
    l.splice(i, 0, fleet);
  }

  private unindexZone(fleet: number, zone: number): void {
    const l = this.fleetsByZone.get(zone);
    if (l === undefined) return;
    const i = l.indexOf(fleet);
    if (i >= 0) l.splice(i, 1);
    if (l.length === 0) this.fleetsByZone.delete(zone);
  }

  /**
   * Per country (smallID order) the live ships, their HP, organisation and
   * battle marks (reveal, escape, docks held, in ship order); per fleet
   * (id, zone, docked, state, prog); per battle (zone, round, retreating,
   * start HP and organisation); per admiral (id, experience, skills,
   * usage); each country's navy experience; the convoys sunk; per
   * invasion (army, state, prepDone, target, voyage); per beachhead
   * (region, side, until); per landing mark (division, until); per voyage
   * (id, zoneIdx, prog).
   */
  hash(): number {
    let h = 41;
    const t = this.ships;
    const len = this.countryList.length;
    const n = new Array<number>(len).fill(0);
    const hp = new Array<number>(len).fill(0);
    const org = new Array<number>(len).fill(0);
    const marks = new Array<number>(len).fill(0);
    for (let r = 0; r < t.rows; r++) {
      if (t.id[r] === 0) continue;
      const o = t.owner[r];
      n[o]++;
      hp[o] = (hp[o] + t.hp[r]) | 0;
      org[o] = (org[o] + t.org[r]) | 0;
      marks[o] =
        (Math.imul(marks[o], 31) +
          t.reveal[r] * 1024 +
          (t.escape[r] + 1) * 16 +
          t.docks[r]) |
        0;
    }
    for (let id = 1; id < len; id++) {
      if (n[id] === 0) continue;
      h = (Math.imul(h, 31) + id) >>> 0;
      h = (Math.imul(h, 31) + n[id]) >>> 0;
      h = (Math.imul(h, 31) + hp[id]) >>> 0;
      h = (Math.imul(h, 31) + org[id]) >>> 0;
      h = (Math.imul(h, 31) + marks[id]) >>> 0;
    }
    for (const f of this.fleets.values()) {
      h = (Math.imul(h, 31) + f.id) >>> 0;
      h = (Math.imul(h, 31) + f.zone) >>> 0;
      h = (Math.imul(h, 31) + f.docked) >>> 0;
      h = (Math.imul(h, 31) + f.state) >>> 0;
      h = (Math.imul(h, 31) + f.prog) >>> 0;
    }
    for (const b of this.battles.values()) {
      h = (Math.imul(h, 31) + b.zone) >>> 0;
      h = (Math.imul(h, 31) + b.round) >>> 0;
      h =
        (Math.imul(h, 31) +
          (b.retreating[0] ? 1 : 0) +
          (b.retreating[1] ? 2 : 0)) >>>
        0;
      h = (Math.imul(h, 31) + b.startHp[0]) >>> 0;
      h = (Math.imul(h, 31) + b.startHp[1]) >>> 0;
      h = (Math.imul(h, 31) + b.startOrg[0]) >>> 0;
      h = (Math.imul(h, 31) + b.startOrg[1]) >>> 0;
    }
    for (const a of this.admirals.values()) {
      h = (Math.imul(h, 31) + a.id) >>> 0;
      h = (Math.imul(h, 31) + a.xpMilli) >>> 0;
      for (const v of a.skills) h = (Math.imul(h, 31) + v) >>> 0;
      for (const v of a.usage) h = (Math.imul(h, 31) + v) >>> 0;
    }
    for (const c of this.countries()) {
      h = (Math.imul(h, 31) + c.navyXpMilli) >>> 0;
    }
    h = (Math.imul(h, 31) + this.convoysSunkTotal) >>> 0;
    for (const x of this.invasions.values()) {
      h = (Math.imul(h, 31) + x.army) >>> 0;
      h = (Math.imul(h, 31) + x.state) >>> 0;
      h = (Math.imul(h, 31) + x.prepDone) >>> 0;
      h = (Math.imul(h, 31) + x.target) >>> 0;
      h = (Math.imul(h, 31) + x.voyage) >>> 0;
    }
    // Lane I review: beachheads (region, side, until) and landing marks.
    for (const [r, b] of this.beachhead) {
      h = (Math.imul(h, 31) + r) >>> 0;
      h = (Math.imul(h, 31) + b.side) >>> 0;
      h = (Math.imul(h, 31) + b.until) >>> 0;
    }
    for (const [d, until] of this.landing) {
      h = (Math.imul(h, 31) + d) >>> 0;
      h = (Math.imul(h, 31) + until) >>> 0;
    }
    for (const v of this.voyages.values()) {
      h = (Math.imul(h, 31) + v.id) >>> 0;
      h = (Math.imul(h, 31) + v.zoneIdx) >>> 0;
      h = (Math.imul(h, 31) + v.prog) >>> 0;
    }
    // Supremacy, spotting and the convoy routes (P4 review).
    this.srState.forEach((s, i) => {
      let sup = 0;
      for (const [k, v] of s.sup) sup = (Math.imul(sup, 31) + k + v) | 0;
      let spot = 0;
      for (const [k, m] of s.spot) {
        for (const [f, v] of m) spot = (Math.imul(spot, 31) + k + f + v) | 0;
      }
      if (sup !== 0 || spot !== 0) {
        h = (Math.imul(h, 31) + i) >>> 0;
        h = (Math.imul(h, 31) + sup) >>> 0;
        h = (Math.imul(h, 31) + spot) >>> 0;
      }
    });
    for (const r of this.routes.values()) {
      h = (Math.imul(h, 31) + r.id) >>> 0;
      h = (Math.imul(h, 31) + r.owner * 8 + r.use) >>> 0;
      h = (Math.imul(h, 31) + r.got) >>> 0;
    }
    return h;
  }
}

/**
 * Spec §2.2-6 ①: a sea region's day. The foundation writes `lastDay`,
 * then the lanes in order: spotting → supremacy → convoy war → engagements
 * → the pending carrier port strikes there (pre-flight §0-9).
 */
export function dailySeaRegion(
  navy: WwNavy,
  sr: number,
  day: number,
  tick: number,
): void {
  const idx = navy.scenario.srIdxOf(sr);
  if (idx < 0) return;
  navy.srState[idx].lastDay = day;
  spotRegion(navy, sr, day); // N1
  supremacyRegion(navy, sr); // N1
  convoyWar(navy, sr, day); // C
  // P6 hook (W2, plan decision 3): mines laid, swept, struck.
  navy.ww.depth.seaRegionDay(sr, day);
  engageRegion(navy, sr, tick); // N1 → N2
  // P6 hook (D, plan decision 12): ships in battle here today feed their
  // owners' naval doctrine tracks once a day (ShipTable.tallyDay).
  noteNavalBattles(navy, sr, day);
  // Port strikes of the fleets in the region, zone by zone, then by id.
  const strikers: Fleet[] = [];
  for (const z of navy.scenario.sr(sr)?.members ?? NO_IDS) {
    for (const id of navy.fleetsIn(z)) {
      const f = navy.fleets.get(id);
      if (f !== undefined && f.portStrike !== 0) strikers.push(f);
    }
  }
  for (const f of strikers) {
    const port = f.portStrike;
    f.portStrike = 0;
    if (isNoStrike(navy.scenario, port)) continue; // P6 pre-flight
    carrierPortStrike(navy, f.id, port, tick); // N2
  }
  navy.markSr(idx);
}

const NO_IDS: readonly number[] = [];

/** P6 (plan decision 12): each ship of a fleet in battle in the region, once a day. */
function noteNavalBattles(navy: WwNavy, sr: number, day: number): void {
  const t = navy.ships;
  for (const z of navy.scenario.sr(sr)?.members ?? NO_IDS) {
    for (const id of navy.fleetsIn(z)) {
      const f = navy.fleets.get(id);
      if (f === undefined || f.state !== FST.battle) continue;
      for (const sid of f.ships) {
        const r = t.rowOf(sid);
        if (r < 0 || t.tallyDay[r] === day) continue;
        t.tallyDay[r] = day;
        navy.ww.depth.noteNavalCombat(t.owner[r], t.cls[r], true);
      }
    }
  }
}

/** P6 (plan decision 12): the ships of the country's fleets on a mission, the country's day. */
function noteNavalMissions(navy: WwNavy, id: number): void {
  const t = navy.ships;
  const perCls = new Array<number>(SHIP_CLASSES.length).fill(0);
  for (const f of navy.fleetsOf(id)) {
    if (f.state !== FST.onStation) continue;
    for (const sid of f.ships) {
      const r = t.rowOf(sid);
      if (r >= 0) perCls[t.cls[r]]++;
    }
  }
  perCls.forEach((n, cls) => {
    if (n > 0) navy.ww.depth.noteNavalCombat(id, cls, false, n);
  });
}
