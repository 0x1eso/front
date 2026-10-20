// World War 1936 P2 — the land war
// (docs/superpowers/specs/2026-10-20-ww1936-p2-divisions-design.md).
// One WwLand lives in WorldWar next to the economy; WorldWarExecution
// ticks it after economy.tick. Every list iterates in number order.
import {
  Cell,
  MessageType,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  CountryTag,
  FACTION_IDS,
} from "@openfront/engine-api/ww1936/Countries";
import {
  WW_DAY_SPLIT,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ARMY_AUTO,
  ARMY_BATTLE,
  ARMY_ENCIRCLED,
  ARMY_EXECUTING,
  ARMY_MOVING,
  ARMY_ORDER_KINDS,
  ARMY_PARA,
  ARMY_RAIL,
  ARMY_RETREAT,
  ARMY_SEA,
  ArmyOrder,
  ArmySummary,
  BATTALION_IDS,
  BattalionId,
  BattleSummary,
  CountryLandDetail,
  CountryLandSummary,
  DivisionData,
  DivisionStats,
  GeneralData,
  GROUND_SLOTS,
  idleOrder,
  LandMessageKey,
  LandOrderSource,
  MOVE_NONE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  RegionLandData,
  STANCES,
  SupportId,
  TemplateDef,
  TrainingData,
  Weather,
  WEATHERS,
  WW_DEPLOY_MIN_FILL_PM,
  WW_MAX_ARMIES,
  WwLandData,
} from "@openfront/engine-api/ww1936/LandTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  addToSide,
  combatWidth,
  emptySide,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import {
  divisionStatsAt,
  equipFill,
  equipFillPm,
  genMixInto,
  genMixOf,
  strengthPmAt,
  templateCounts,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import {
  techTotals,
  type TechTotals,
} from "@openfront/engine-lib/ww1936/WwTechs";
import { z } from "zod";
import type { Game, Player } from "../../game/Game";
import type { WwEconomy } from "../economy/WwEconomy";
import type { WorldWar } from "../WorldWar";
import { aiLandTick } from "./AiLand";
import { dailyEntrench, stepBattles, stepRecovery } from "./Battles";
import { dailyFronts } from "./Fronts";
import { appointGeneral, assignGeneral } from "./GeneralsRun";
import { startLand } from "./LandStartRun";
import { stepMovement } from "./Movement";
import { stepSpread } from "./Occupation";
import { applyArmyOrders, issueArmyOrder } from "./Orders";
import { dailySupply } from "./Supply";
import { dailySustain } from "./Sustain";
import {
  cancelTraining,
  deleteTemplate,
  deployNow,
  lowestFillPm,
  queueTraining,
  saveTemplate,
} from "./Training";

// ---- Divisions: one row each, columns (spec §5.2) ----

const COLS = {
  id: Int32Array,
  owner: Uint16Array,
  template: Uint16Array,
  army: Int32Array,
  region: Uint16Array,
  next: Uint16Array,
  edge: Int32Array,
  prog: Int32Array,
  need: Int32Array,
  /** Milli-km (rail, walk) or milli-ticks (sea) the last tick moved; the screens interpolate with it. */
  step: Int32Array,
  mode: Uint8Array,
  dest: Uint16Array,
  men: Int32Array,
  org: Int32Array,
  exp: Int16Array,
  entrench: Uint8Array,
  stillDays: Uint16Array,
  supply: Int16Array,
  encircled: Uint8Array,
  battle: Uint16Array,
  role: Uint8Array,
  front: Uint8Array,
  lossMen: Int32Array,
  /** Last day it fought (experience, generals, army XP); -1: never. */
  lastFight: Int32Array,
} as const;
export type DivisionColumn = keyof typeof COLS;
export const DIVISION_COLUMNS = Object.keys(COLS) as DivisionColumn[];
type IntArray = Int32Array | Uint16Array | Uint8Array | Int16Array;

/**
 * Spec §5.2: the divisions as columns. Rows stay in division-id order:
 * ids only rise, a removed row is a tombstone (id 0) until the daily
 * compaction (plan decision 15). Row numbers are valid within one tick;
 * keep division ids across ticks.
 *
 * Write men, equipment and the template through WwLand.setMen / addEquip /
 * setTemplate (or call WwLand.touchDivision after the write), so the army
 * summary goes out again.
 */
export class DivisionTable {
  rows = 0;
  id = new Int32Array(0);
  owner = new Uint16Array(0);
  template = new Uint16Array(0);
  army = new Int32Array(0);
  region = new Uint16Array(0);
  next = new Uint16Array(0);
  edge = new Int32Array(0);
  prog = new Int32Array(0);
  need = new Int32Array(0);
  step = new Int32Array(0);
  mode = new Uint8Array(0);
  dest = new Uint16Array(0);
  men = new Int32Array(0);
  org = new Int32Array(0);
  exp = new Int16Array(0);
  entrench = new Uint8Array(0);
  stillDays = new Uint16Array(0);
  supply = new Int16Array(0);
  encircled = new Uint8Array(0);
  battle = new Uint16Array(0);
  role = new Uint8Array(0);
  front = new Uint8Array(0);
  lossMen = new Int32Array(0);
  lastFight = new Int32Array(0);
  /** GROUND_SLOTS per row, GROUND_EQUIP_KEYS order. */
  equip = new Int32Array(0);
  /** Milli-units of equipment lost but not yet taken (spec §5.5). */
  lossEq = new Int32Array(0);
  /** Derived (DERIVED_FIELDS): division id → row. */
  rowIndex = new Map<number, number>();
  /**
   * Derived (DERIVED_FIELDS): moves on every add, kill, compaction and
   * restore, so lists of rows built from the table know when to rebuild.
   */
  rowsVersion = 0;
  private cap = 0;

  constructor() {
    // Always at least 64 rows, so an empty table and its restore are equal.
    this.grow(64);
  }

  col(name: DivisionColumn): IntArray {
    return (this as unknown as Record<DivisionColumn, IntArray>)[name];
  }

  private grow(min: number): void {
    const cap = Math.max(64, this.cap * 2, min);
    for (const name of DIVISION_COLUMNS) {
      const next = new COLS[name](cap);
      next.set(this.col(name).subarray(0, this.rows));
      (this as unknown as Record<DivisionColumn, IntArray>)[name] = next;
    }
    for (const name of ["equip", "lossEq"] as const) {
      const next = new Int32Array(cap * GROUND_SLOTS);
      next.set(this[name].subarray(0, this.rows * GROUND_SLOTS));
      this[name] = next;
    }
    this.cap = cap;
  }

  /** Appends a division; ids rise, so the rows stay in id order. */
  add(
    id: number,
    owner: number,
    template: number,
    army: number,
    region: number,
  ): number {
    if (this.rows === this.cap) this.grow(this.rows + 1);
    const r = this.rows++;
    for (const name of DIVISION_COLUMNS) this.col(name)[r] = 0;
    this.equip.fill(0, r * GROUND_SLOTS, (r + 1) * GROUND_SLOTS);
    this.lossEq.fill(0, r * GROUND_SLOTS, (r + 1) * GROUND_SLOTS);
    this.id[r] = id;
    this.owner[r] = owner;
    this.template[r] = template;
    this.army[r] = army;
    this.region[r] = region;
    this.dest[r] = region;
    this.edge[r] = -1;
    this.supply[r] = 1000;
    this.lastFight[r] = -1;
    this.rowIndex.set(id, r);
    this.rowsVersion++;
    return r;
  }

  alive(r: number): boolean {
    return this.id[r] !== 0;
  }

  rowOf(id: number): number {
    return this.rowIndex.get(id) ?? -1;
  }

  count(): number {
    return this.rowIndex.size;
  }

  /** A tombstone (an all-zero row) until compact(). */
  kill(r: number): void {
    this.rowsVersion++;
    this.rowIndex.delete(this.id[r]);
    for (const name of DIVISION_COLUMNS) this.col(name)[r] = 0;
    this.equip.fill(0, r * GROUND_SLOTS, (r + 1) * GROUND_SLOTS);
    this.lossEq.fill(0, r * GROUND_SLOTS, (r + 1) * GROUND_SLOTS);
  }

  /** The row's 18 equipment slots (a view: valid until the table grows). */
  equipOf(r: number): Int32Array {
    return this.equip.subarray(r * GROUND_SLOTS, (r + 1) * GROUND_SLOTS);
  }

  /** Drops tombstones, keeping the order. True when rows moved. */
  compact(): boolean {
    let w = 0;
    for (let r = 0; r < this.rows; r++) {
      if (this.id[r] === 0) continue;
      if (w !== r) {
        for (const name of DIVISION_COLUMNS) {
          this.col(name)[w] = this.col(name)[r];
        }
        this.equip.copyWithin(
          w * GROUND_SLOTS,
          r * GROUND_SLOTS,
          (r + 1) * GROUND_SLOTS,
        );
        this.lossEq.copyWithin(
          w * GROUND_SLOTS,
          r * GROUND_SLOTS,
          (r + 1) * GROUND_SLOTS,
        );
      }
      w++;
    }
    const moved = w !== this.rows;
    // The tail is zeros again, so a restored table is equal element by element.
    for (const name of DIVISION_COLUMNS) this.col(name).fill(0, w, this.rows);
    this.equip.fill(0, w * GROUND_SLOTS, this.rows * GROUND_SLOTS);
    this.lossEq.fill(0, w * GROUND_SLOTS, this.rows * GROUND_SLOTS);
    this.rows = w;
    this.rowsVersion++;
    this.rebuildIndex();
    return moved;
  }

  rebuildIndex(): void {
    this.rowIndex = new Map();
    for (let r = 0; r < this.rows; r++) {
      if (this.id[r] !== 0) this.rowIndex.set(this.id[r], r);
    }
  }

  /**
   * Every used row (tombstones are zero rows, at most a day's worth) and the
   * capacity, so a restore rebuilds the very same arrays (the snapshot
   * oracles compare them element by element). Never compacts: a snapshot
   * must not change the game.
   */
  snapshot(): DivisionTableState {
    const cols = {} as Record<DivisionColumn, number[]>;
    for (const name of DIVISION_COLUMNS) {
      cols[name] = Array.from(this.col(name).subarray(0, this.rows));
    }
    return {
      ...cols,
      cap: this.cap,
      equip: Array.from(this.equip.subarray(0, this.rows * GROUND_SLOTS)),
      lossEq: Array.from(this.lossEq.subarray(0, this.rows * GROUND_SLOTS)),
    };
  }

  restore(s: DivisionTableState): void {
    const n = s.id.length;
    this.rows = 0;
    this.cap = 0;
    this.grow(s.cap);
    for (const name of DIVISION_COLUMNS) this.col(name).set(s[name]);
    this.equip.set(s.equip);
    this.lossEq.set(s.lossEq);
    this.rows = n;
    this.rowsVersion++;
    this.rebuildIndex();
  }
}

// ---- Armies, battles, spreads, countries ----

export interface Army {
  id: number;
  owner: number;
  /** "N-th army" (spec §18). */
  nameNo: number;
  /** General id (plan decision 17); 0: none. */
  general: number;
  /** Division ids, ascending. */
  divisions: number[];
  order: ArmyOrder;
  auto: boolean;
  planBp: number;
  /** Front regions of the last daily recompute (spec §8.1), in BFS order. */
  front: number[];
  /** Remaining regions of a move order's path. */
  path: number[];
  /** Its order changed: applyArmyOrders turns it into destinations this tick. */
  pending: boolean;
  /** Day of the last paradrop; -1: never. */
  paraLastDay: number;
}

export interface Battle {
  /** The defending region; also the battle's number. */
  region: number;
  sinceTick: number;
  round: number;
  /** Division ids, ascending. */
  attackers: number[];
  defenders: number[];
  /** Ids in line this round, in line order (spec §9.2). */
  attLine: number[];
  defLine: number[];
  /** Defender org at the start plus every newcomer's (spec §12.3), milli. */
  startOrgMilli: number;
  lostOrgMilli: number;
  /** Colour of the spread (spec §9.1): widest attacker country, defender = controller. */
  attLead: number;
  defLead: number;
}

export const SPREAD_BATTLE = 0;
export const SPREAD_CAPTURE = 1;
export const SPREAD_REVERT = 2;
export const SPREAD_CAPITULATION = 3;

/** Spec §12: tiles of `region` going to `by`. The tile order is derived from `sources`. */
export interface Spread {
  region: number;
  by: number;
  kind: number;
  /** Regions the spread starts from (attackers' regions); empty: from the center. */
  sources: number[];
  /** Tiles of the order already given to `by`. */
  done: number;
  /** `done` at the start of `dayNo` (the 20%-a-day cap). */
  dayBase: number;
  dayNo: number;
}

export interface LandTemplate {
  id: number;
  /** ww1936.tpl.<key> for a 1936 default; "" for a player's own. */
  key: string;
  /** Replace it (never write into it): the stats caches see a new def. */
  def: TemplateDef;
}

export interface TrainingEntry {
  id: number;
  template: number;
  /** Divisions not started yet. */
  remaining: number;
  /** 0: a new army. */
  army: number;
  /** 0: the capital region. */
  region: number;
}

export interface Trainee {
  entry: number;
  template: number;
  men: number;
  /** GROUND_SLOTS. */
  equip: number[];
  days: number;
}

export interface GeneralState {
  id: number;
  /** GENERALS index; -1 for a titled general. */
  roster: number;
  titleNo: number;
  att: number;
  dfn: number;
  plan: number;
  log: number;
  traits: number;
  xp: number;
  level: number;
  /** Army id; 0: free. */
  army: number;
  /** Days spent attacking, defending, preparing, short of supply (spec §6.2). */
  use: number[];
  /** Battle days in winter, desert, mountains, across rivers (trait unlocks). */
  terrainDays: number[];
}

export class CountryLand {
  templates: LandTemplate[] = [];
  nextTemplateId = 1;
  training: TrainingEntry[] = [];
  trainees: Trainee[] = [];
  nextEntryId = 1;
  armyXpMilli = 0;
  generals: GeneralState[] = [];
  nextArmyNo = 1;
  nextTitleNo = 1;
  casualtiesToday = 0;
  readyToday = 0;
  warnedTileAttack = false;
  /**
   * The most divisions the country has had (its day counts them): the AI
   * measures its reserve against it, so losses do not shrink the reserve
   * (P2 Task 6, controller ruling 2).
   */
  peakDivisions = 0;

  constructor(
    readonly smallID: number,
    readonly tag: CountryTag,
  ) {}

  template(id: number): LandTemplate | null {
    return this.templates.find((t) => t.id === id) ?? null;
  }
}

// ---- Snapshot schema (spec §16.5) ----

const zInts = () => z.array(zInt());
const DivisionTableStateSchema = z.object({
  ...(Object.fromEntries(DIVISION_COLUMNS.map((c) => [c, zInts()])) as Record<
    DivisionColumn,
    ReturnType<typeof zInts>
  >),
  cap: zInt(),
  equip: zInts(),
  lossEq: zInts(),
});
type DivisionTableState = z.infer<typeof DivisionTableStateSchema>;

const OrderSchema = z.object({
  kind: z.enum(ARMY_ORDER_KINDS),
  to: zInt(),
  mode: zInt(),
  anchor: zInt(),
  enemy: zInt(),
  targets: zInts(),
  stance: z.enum(STANCES),
  executing: z.boolean(),
  readyDay: zInt(),
});

export const WwLandStateSchema = z.object({
  controller: zInts(),
  supplyMilli: zInts(),
  encircled: zInts(),
  useMilli: zInts(),
  lastCommonDay: zInt(),
  nextDivisionId: zInt(),
  nextArmyId: zInt(),
  controlChanges: zInt(),
  divisions: DivisionTableStateSchema,
  armies: z.array(
    z.object({
      id: zInt(),
      owner: zInt(),
      nameNo: zInt(),
      general: zInt(),
      divisions: zInts(),
      order: OrderSchema,
      auto: z.boolean(),
      planBp: zInt(),
      front: zInts(),
      path: zInts(),
      pending: z.boolean(),
      paraLastDay: zInt(),
    }),
  ),
  battles: z.array(
    z.object({
      region: zInt(),
      sinceTick: zInt(),
      round: zInt(),
      attackers: zInts(),
      defenders: zInts(),
      attLine: zInts(),
      defLine: zInts(),
      startOrgMilli: zInt(),
      lostOrgMilli: zInt(),
      attLead: zInt(),
      defLead: zInt(),
    }),
  ),
  spreads: z.array(
    z.object({
      region: zInt(),
      by: zInt(),
      kind: zInt(),
      sources: zInts(),
      done: zInt(),
      dayBase: zInt(),
      dayNo: zInt(),
    }),
  ),
  countries: z.array(
    z.object({
      smallID: zInt(),
      templates: z.array(
        z.object({
          id: zInt(),
          key: z.string(),
          name: z.string(),
          battalions: z.array(z.string()),
          support: z.array(z.string()),
        }),
      ),
      nextTemplateId: zInt(),
      training: z.array(
        z.object({
          id: zInt(),
          template: zInt(),
          remaining: zInt(),
          army: zInt(),
          region: zInt(),
        }),
      ),
      trainees: z.array(
        z.object({
          entry: zInt(),
          template: zInt(),
          men: zInt(),
          equip: zInts(),
          days: zInt(),
        }),
      ),
      nextEntryId: zInt(),
      armyXpMilli: zInt(),
      generals: z.array(
        z.object({
          id: zInt(),
          roster: zInt(),
          titleNo: zInt(),
          att: zInt(),
          dfn: zInt(),
          plan: zInt(),
          log: zInt(),
          traits: zInt(),
          xp: zInt(),
          level: zInt(),
          army: zInt(),
          use: zInts(),
          terrainDays: zInts(),
        }),
      ),
      nextArmyNo: zInt(),
      nextTitleNo: zInt(),
      casualtiesToday: zInt(),
      readyToday: zInt(),
      warnedTileAttack: z.boolean(),
      peakDivisions: zInt(),
    }),
  ),
});
export type WwLandState = z.infer<typeof WwLandStateSchema>;

/** A side (spec §7.1): a faction, or a country alone. */
export interface Side {
  key: number;
  /** Smallest member smallID: the side's supply runs on its turn (spec §2.2). */
  rep: number;
  members: number[];
}

/**
 * A division's numbers and what they were computed from (pre-flight U8):
 * a hit must match its country's stats inputs (the tech totals object and
 * every template def: StatsInputs.epoch), the template number, the men
 * and every equipment slot, so a write that forgot touchDivision can never
 * leave a live game on numbers a restored one would not have. New men or
 * equipment keep `base` while the generation mix holds (templateStats
 * reads the equipment only through it); `eff` and `strength` follow on
 * their next read (P2 Task 11 perf).
 */
interface StatsEntry {
  epoch: number;
  template: number;
  men: number;
  /** GROUND_SLOTS, the equipment `base` / `eff` were computed from. */
  equip: Int32Array;
  /** genMixOf(equip). */
  mix: number[];
  base: DivisionStats;
  /** null: not computed since men or equipment moved. */
  eff: DivisionStats | null;
  /** -1: not computed since men or equipment moved. */
  strength: number;
  /** equipFill(base, equip); null: not computed since they moved. */
  fill: number[] | null;
}

/**
 * A country's stats inputs as last read (derived): its tech totals object
 * (WwEconomy replaces it whenever a tech lands, never writes into it) and
 * its templates' ids and defs (a def is replaced, never written into).
 * `epoch` moves when any of them changed, so a cached number with this
 * epoch was computed from the very inputs a fresh computation reads.
 */
interface StatsInputs {
  tech: TechTotals | null;
  ids: number[];
  defs: TemplateDef[];
  epoch: number;
}

/** A template's numbers at one generation mix (the screens, the AI, divisions sharing it). */
interface TemplateStatsEntry {
  epoch: number;
  /** At generation 1 everywhere (GEN1_MIX); null: not computed yet. */
  gen1: DivisionStats | null;
  /** By the mix's numbers joined with commas. */
  byMix: Map<string, DivisionStats>;
}

const EMPTY_DEF: TemplateDef = { name: "", battalions: [], support: [] };
const NO_ROWS: readonly number[] = Object.freeze([]);
const NO_TEMPLATES: readonly LandTemplate[] = Object.freeze([]);
/** statsEntry's generation mix scratch. */
const MIX_SCRATCH: number[] = [];
/** genMixOf of an empty division: generation 1 everywhere (templateStatsOf). */
const GEN1_MIX: readonly number[] = genMixOf(
  new Array<number>(GROUND_SLOTS).fill(0),
);
/** A dead row's numbers (templateNumbersOf). */
const EMPTY_STATS: DivisionStats = templateStats(
  EMPTY_DEF,
  techTotals(new Set()),
  GEN1_MIX,
);

/**
 * Org max, template flags, width and supply use by row (WwLand.rowStats, derived): valid
 * while the row holds the same division id and template and its country's
 * stats epoch is the same.
 */
interface RowStats {
  id: Int32Array;
  tpl: Uint16Array;
  epoch: Int32Array;
  orgMax: Int32Array;
  flags: Int32Array;
  width: Int32Array;
  supply: Int32Array;
  /** The template's numbers at generation 1 (templateNumbersOf). */
  gen1: DivisionStats[];
}

/**
 * Sets `key` in a Map kept in ascending key order (iteration order): in
 * place when present, appended when above every key, else re-sorted.
 */
function setInOrder<V>(m: Map<number, V>, key: number, v: V): void {
  if (m.has(key)) {
    m.set(key, v);
    return;
  }
  let max = -Infinity;
  for (const k of m.keys()) if (k > max) max = k;
  m.set(key, v);
  if (key > max) return;
  const sorted = [...m.entries()].sort((x, y) => x[0] - y[0]);
  m.clear();
  for (const [k, x] of sorted) m.set(k, x);
}

/** A stats entry's numbers at its men and equipment (computed on the first read after they moved). */
function effOf(e: StatsEntry): DivisionStats {
  return (e.eff ??= divisionStatsAt(e.base, fillOf(e), e.men));
}

function strengthOfEntry(e: StatsEntry): number {
  if (e.strength < 0) e.strength = strengthPmAt(e.base, fillOf(e), e.men);
  return e.strength;
}

function fillOf(e: StatsEntry): number[] {
  return (e.fill ??= equipFill(e.base, e.equip));
}

function newRowStats(cap: number): RowStats {
  return {
    id: new Int32Array(cap),
    tpl: new Uint16Array(cap),
    epoch: new Int32Array(cap),
    orgMax: new Int32Array(cap),
    flags: new Int32Array(cap),
    width: new Int32Array(cap),
    supply: new Int32Array(cap),
    gen1: new Array<DivisionStats>(cap),
  };
}

function growRowStats(c: RowStats, rows: number): RowStats {
  const n = newRowStats(Math.max(64, rows, c.id.length * 2));
  n.id.set(c.id);
  n.tpl.set(c.tpl);
  n.epoch.set(c.epoch);
  n.orgMax.set(c.orgMax);
  n.flags.set(c.flags);
  n.width.set(c.width);
  n.supply.set(c.supply);
  for (let i = 0; i < c.gen1.length; i++) n.gen1[i] = c.gen1[i];
  return n;
}

export class WwLand {
  readonly controller: Uint16Array;
  /** Supply of each region for its controller's side, milli (spec §11.2, decision 16). */
  readonly supplyMilli: Int32Array;
  /** 1: cut off from every hub of its controller's side (spec §11.5). */
  readonly encircled: Uint8Array;
  /**
   * Supply the controlling side's divisions in each region use, milli
   * (pre-flight U12: the region card's "use"). Task 5's daily supply writes it.
   */
  readonly useMilli: Int32Array;
  readonly divisions = new DivisionTable();
  readonly armies = new Map<number, Army>();
  readonly battles = new Map<number, Battle>();
  readonly spreads = new Map<number, Spread>();
  nextDivisionId = 1;
  nextArmyId = 1;
  controlChanges = 0;
  private lastCommonDay = -1;
  private countryList: (CountryLand | null)[];
  // Derived (DERIVED_FIELDS).
  private sideOfId: number[] = [];
  private sideListCache: Side[] = [];
  private statsCache = new Map<number, StatsEntry>();
  /** owner × 65536 + template → the template's numbers by generation mix. */
  private tplCache = new Map<number, TemplateStatsEntry>();
  private statsInputs: (StatsInputs | undefined)[] = [];
  /**
   * Org max, template flags, width and supply use by row (stepRecovery reads every
   * row every tick): valid while the row holds the same division id and
   * template and its country's stats epoch is the same. They read only the
   * template def and the tech (templateStats: no generation, men or
   * equipment).
   */
  private rowStats = newRowStats(0);
  /**
   * weatherAt by region for the last day read (weatherOn): the weather is
   * a function of the day and the region's static place, so a kept value
   * is the one a fresh call returns.
   */
  private weatherCache: { day: Int32Array; w: Uint8Array } | null = null;
  private regionRows: number[][] = [];
  private regionRowsDirty = true;
  /** Live rows by owner, in row order, for divisions.rowsVersion `ownerRowsVersion`. */
  private ownerRows: number[][] = [];
  private ownerRowsVersion = -1;
  /** Spread tile orders (rebuilt from Spread.sources), Task 4. */
  readonly spreadOrders = new Map<number, Uint32Array>();
  /** A map-sized scratch for building spread orders (Task 4); derived. */
  spreadScratch: Uint8Array | null = null;
  // Screens.
  private dirtyArmies = new Set<number>();
  private dirtyLandRegions = new Set<number>();
  /** Countries whose summary goes out (casualties, divisions, men, battles). */
  private dirtyLandCountries = new Set<number>();
  /** Countries whose detail goes out (a human's templates, training, generals, divisions); each also in dirtyLandCountries. */
  private dirtyLandDetails = new Set<number>();
  private removedArmyIds: number[] = [];
  private endedBattleIds: number[] = [];

  constructor(
    readonly mg: Game,
    readonly ww: WorldWar,
    readonly econ: WwEconomy,
  ) {
    const sc = ww.scenario;
    const size = sc.maxRegionId() + 1;
    this.controller = new Uint16Array(size);
    this.supplyMilli = new Int32Array(size);
    this.encircled = new Uint8Array(size);
    this.useMilli = new Int32Array(size);
    const owners = sc.ownerByRegion();
    for (const r of sc.landRegions) this.controller[r.id] = owners[r.id];
    this.countryList = [
      null,
      ...sc.countries.map((tag, i) => new CountryLand(i + 1, tag)),
    ];
    // The static region tiles and land graph, built now so a restored game
    // holds the same scenario as a live one.
    sc.ensureRegionTiles(mg.map());
    sc.edges();
    this.rebuildDerived();
  }

  get scenario() {
    return this.ww.scenario;
  }

  /** Spec §6.4: templates, generals, the 1936 order of battle. WorldWar.start calls it once, after economy.start. */
  start(): void {
    startLand(this);
    for (const cl of this.countries()) {
      const p = this.mg.playerBySmallID(cl.smallID);
      if (p.isPlayer()) p.setTroops(this.fieldMen(cl.smallID));
      this.markDetail(cl.smallID);
    }
    for (const id of this.armies.keys()) this.dirtyArmies.add(id);
    for (const r of this.scenario.landRegions) this.dirtyLandRegions.add(r.id);
  }

  // ---- Clock (spec §2.2) ----

  tick(ticks: number): void {
    const prep = this.ww.inPrep(ticks);
    if (!prep) {
      const day = this.ww.day(ticks);
      if (day !== this.lastCommonDay) {
        this.lastCommonDay = day;
        this.dailyCommon();
      }
      const k = ticks - dayStartTick(day, this.ww.prepEndTick());
      if (k >= 0 && k < WW_DAY_SPLIT) {
        for (const side of this.sideListCache) {
          if (side.rep % WW_DAY_SPLIT === k) dailySupply(this, side.key);
        }
        for (let id = 1; id < this.countryList.length; id++) {
          if (id % WW_DAY_SPLIT === k) this.dailyCountry(id, day);
        }
      }
    }
    applyArmyOrders(this, ticks);
    stepMovement(this, ticks);
    if (!prep) stepBattles(this, ticks);
    stepRecovery(this);
    if (!prep) stepSpread(this);
  }

  private dailyCommon(): void {
    if (this.divisions.compact()) this.regionRowsDirty = true;
    for (const cl of this.countries()) cl.casualtiesToday = 0;
  }

  private dailyCountry(id: number, day: number): void {
    const cl = this.countryList[id];
    const p = this.mg.playerBySmallID(id);
    if (
      cl === null ||
      cl === undefined ||
      !p.isPlayer() ||
      !p.isAlive() ||
      this.ww.isCapitulated(id)
    ) {
      return;
    }
    let divisions = 0;
    for (const a of this.armiesOf(id)) divisions += a.divisions.length;
    if (divisions > cl.peakDivisions) cl.peakDivisions = divisions;
    dailyFronts(this, id, day);
    dailySustain(this, id, day);
    dailyEntrench(this, id);
    if (
      p.type() !== PlayerType.Human ||
      this.armiesOf(id).some((a) => a.auto)
    ) {
      aiLandTick(this, id, day);
    }
    // Spec §13.2: the troop number mirrors the men in the field.
    p.setTroops(this.fieldMen(id));
    this.markDetail(id);
  }

  // ---- Orders (spec §16.3; the same for humans and the AI) ----

  /**
   * One land order of `smallID`'s country; null when it took effect.
   * `by` (pre-flight U2): a player's army order turns the army's `auto`
   * off (spec §8.5); the AI's (aiLandTick) does not.
   */
  issue(
    smallID: number,
    order: WwOrder,
    by: LandOrderSource = "player",
  ): WwOrderBlock | null {
    const cl = this.country(smallID);
    const p = this.mg.playerBySmallID(smallID);
    if (
      cl === null ||
      !p.isPlayer() ||
      !p.isAlive() ||
      this.ww.isCapitulated(smallID)
    ) {
      return "dead";
    }
    let block: WwOrderBlock | null;
    switch (order.kind) {
      case "template_save":
        block = saveTemplate(this, cl, order);
        break;
      case "template_delete":
        block = deleteTemplate(this, cl, order.template);
        break;
      case "train":
        block = queueTraining(this, cl, order);
        break;
      case "cancel_train":
        block = cancelTraining(this, cl, order.entry);
        break;
      case "deploy_now":
        block = deployNow(this, cl, order.entry);
        break;
      case "army_general":
        block = assignGeneral(this, cl, order.army, order.general);
        // Spec §8.5 (U2): a player's general order turns `auto` off.
        if (block === null && by === "player") {
          const a = this.armies.get(order.army);
          if (a !== undefined && a.auto) {
            a.auto = false;
            this.dirtyArmies.add(a.id);
          }
        }
        break;
      case "appoint_general":
        block = appointGeneral(this, cl);
        break;
      case "army_move":
      case "army_rail":
      case "army_sea":
      case "army_attack":
      case "army_front":
      case "army_plan":
      case "army_execute":
      case "army_halt":
      case "army_split":
      case "army_merge":
      case "army_disband":
      case "army_auto":
      case "paradrop":
        block = issueArmyOrder(this, cl, order, by);
        break;
      default:
        return "bad_index";
    }
    if (block === null) this.markDetail(smallID);
    return block;
  }

  // ---- Sides (spec §7.1: the faction, or the country alone) ----

  sideOf(smallID: number): number {
    return this.sideOfId[smallID] ?? smallID;
  }

  sameSide(a: number, b: number): boolean {
    return a > 0 && b > 0 && (a === b || this.sideOf(a) === this.sideOf(b));
  }

  sideMembers(side: number): readonly number[] {
    return this.sideListCache.find((s) => s.key === side)?.members ?? [];
  }

  sideList(): readonly Side[] {
    return this.sideListCache;
  }

  /** At war and past the preparation minute (P0 canFight). */
  isEnemy(a: number, b: number): boolean {
    return a > 0 && b > 0 && this.ww.canFight(a, b, this.mg.ticks());
  }

  /** Spec §7.1: own, same side, or an enemy's region (to attack or take). */
  canEnter(smallID: number, region: number): boolean {
    const c = this.controller[region] ?? 0;
    return c !== 0 && (this.sameSide(c, smallID) || this.isEnemy(smallID, c));
  }

  // ---- Control (decision 9: the only way it changes) ----

  /**
   * Hands `region` to `by` this tick, its victory-point tile with it
   * (Review Focus 1). The rest of its tiles follow by the spread (Task 4).
   */
  setController(region: number, by: number, tick: number, notify = true): void {
    const old = this.controller[region];
    if (old === by) return;
    this.controller[region] = by;
    this.controlChanges++;
    const r = this.scenario.region(region)!;
    const vpTile = this.scenario.vpTile(r);
    const p = this.mg.playerBySmallID(by);
    if (
      p.isPlayer() &&
      this.mg.map().isLand(vpTile) &&
      this.mg.ownerID(vpTile) !== by
    ) {
      p.conquer(vpTile);
    }
    this.dirtyLandRegions.add(region);
    this.econ.markRegionDirty(region);
    // A capitulation hands over dozens of regions at once: no message each.
    if (notify && r.vp > 0) {
      this.message(by, "events_display.ww1936_region_taken", {
        region: r.id,
      });
      if (old !== 0) {
        this.message(old, "events_display.ww1936_region_lost", {
          region: r.id,
        });
      }
    }
    void tick;
  }

  /**
   * The box of the regions `smallID` controls, in region order (P2 spec
   * §13.1: PlayerExecution's cluster box in this mode); null when none.
   */
  controlBox(smallID: number): { min: Cell; max: Cell } | null {
    const sc = this.scenario;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (const r of sc.landRegions) {
      if (this.controller[r.id] !== smallID) continue;
      const b = sc.bbox(r.id);
      if (b[0] < 0) continue;
      x0 = Math.min(x0, b[0]);
      y0 = Math.min(y0, b[1]);
      x1 = Math.max(x1, b[2]);
      y1 = Math.max(y1, b[3]);
    }
    if (x1 < 0) return null;
    return { min: new Cell(x0, y0), max: new Cell(x1, y1) };
  }

  // ---- Divisions ----

  /**
   * A new division in `army` at `region` (spec §5.1, §6.4). Men and
   * equipment come with it: the caller drew them (Stock.ts).
   */
  spawnDivision(
    owner: number,
    template: number,
    region: number,
    army: Army,
    men: number,
    equip: ArrayLike<number>,
    orgMilli: number,
  ): number {
    const id = this.nextDivisionId++;
    const r = this.divisions.add(id, owner, template, army.id, region);
    this.divisions.men[r] = men;
    this.divisions.org[r] = orgMilli;
    this.divisions.equipOf(r).set(Array.from(equip));
    army.divisions.push(id);
    this.rowListAdd(region, r);
    this.dirtyArmies.add(army.id);
    this.dirtyLandRegions.add(region);
    this.markDetail(owner);
    return id;
  }

  /**
   * Removes a division (spec §5.3 disband after its refund, §9.6 destroyed,
   * §5.5 capitulation). Its army loses it; an empty army goes. A destroyed
   * division's men count as today's casualties, dead for good.
   */
  killDivision(row: number, destroyed: boolean): void {
    const t = this.divisions;
    const id = t.id[row];
    if (id === 0) return;
    const owner = t.owner[row];
    if (destroyed) this.noteCasualties(owner, t.men[row], t.men[row]);
    const army = this.armies.get(t.army[row]);
    if (army !== undefined) {
      army.divisions = army.divisions.filter((d) => d !== id);
      this.dirtyArmies.add(army.id);
      if (army.divisions.length === 0) this.removeArmy(army.id);
    }
    const b = this.battles.get(t.battle[row]);
    if (b !== undefined) {
      b.attackers = b.attackers.filter((d) => d !== id);
      b.defenders = b.defenders.filter((d) => d !== id);
      b.attLine = b.attLine.filter((d) => d !== id);
      b.defLine = b.defLine.filter((d) => d !== id);
    }
    this.rowListRemove(t.region[row], row);
    this.dirtyLandRegions.add(t.region[row]);
    this.markDetail(owner);
    t.kill(row);
    this.statsCache.delete(id);
  }

  /**
   * Men lost today (spec §5.5) and those of them dead for good: the dead
   * leave P1's recruitable pool (CountryEconomy.casualties), so the
   * manpower ceiling does not refill as they die. Task 4's HP losses call
   * it with the 20% (50% with a field hospital) who come back left out of
   * `dead`.
   */
  noteCasualties(smallID: number, lost: number, dead: number): void {
    const cl = this.country(smallID);
    if (cl !== null && lost > 0) cl.casualtiesToday += lost;
    const ce = this.econ.country(smallID);
    if (ce !== null && dead > 0) ce.casualties += dead;
    // Today's casualties are in the summary only (P2 Task 11, I2).
    this.dirtyLandCountries.add(smallID);
  }

  setDivisionRegion(row: number, region: number): void {
    const old = this.divisions.region[row];
    if (old === region) return;
    this.rowListRemove(old, row);
    this.divisions.region[row] = region;
    this.rowListAdd(region, row);
    this.dirtyArmies.add(this.divisions.army[row]);
    this.dirtyLandRegions.add(old);
    this.dirtyLandRegions.add(region);
  }

  /** Live rows in a region, in row (= id) order. A view: copy it before changing divisions. */
  rowsIn(region: number): readonly number[] {
    if (this.regionRowsDirty) {
      const out: number[][] = [];
      const t = this.divisions;
      for (let r = 0; r < t.rows; r++) {
        if (t.id[r] === 0) continue;
        (out[t.region[r]] ??= []).push(r);
      }
      this.regionRows = out;
      this.regionRowsDirty = false;
    }
    return this.regionRows[region] ?? NO_ROWS;
  }

  private rowListAdd(region: number, row: number): void {
    if (this.regionRowsDirty) return;
    const l = (this.regionRows[region] ??= []);
    let i = l.length;
    while (i > 0 && l[i - 1] > row) i--;
    l.splice(i, 0, row);
  }

  private rowListRemove(region: number, row: number): void {
    if (this.regionRowsDirty) return;
    const l = this.regionRows[region];
    if (l === undefined) return;
    const i = l.indexOf(row);
    if (i >= 0) l.splice(i, 1);
  }

  templateOf(owner: number, template: number): LandTemplate | null {
    return this.country(owner)?.template(template) ?? null;
  }

  /** Full-strength numbers at the division's generations (org max, width, speed, supply use). */
  baseStatsOf(row: number): DivisionStats {
    return this.statsEntry(row).base;
  }

  /** Numbers at its men and equipment now (attack, defence, HP). */
  statsOf(row: number): DivisionStats {
    return effOf(this.statsEntry(row));
  }

  /**
   * Call after changing a division's men, equipment or template: its army
   * goes out again. (The stats caches check their inputs on every read.)
   */
  touchDivision(row: number): void {
    this.dirtyArmies.add(this.divisions.army[row]);
  }

  /** Sets a division's men (pre-flight U8: the one way lanes write them). */
  setMen(row: number, men: number): void {
    this.divisions.men[row] = men;
    this.touchDivision(row);
  }

  /** Adds `delta` to equipment slot `slot` (GROUND_SLOTS index) of a division. */
  addEquip(row: number, slot: number, delta: number): void {
    this.divisions.equip[row * GROUND_SLOTS + slot] += delta;
    this.touchDivision(row);
  }

  /** Moves a division to another template of its country. */
  setTemplate(row: number, template: number): void {
    this.divisions.template[row] = template;
    this.touchDivision(row);
  }

  /** Maximum org with P3's orgPct (spec §9.8). */
  orgMaxOf(row: number): number {
    return this.rowOrgEntry(row) ? this.rowStats.orgMax[row] : 0;
  }

  /**
   * Every country's stats epoch, read now (index smallID). A pass over
   * many rows that changes no template or tech (stepRecovery) reads it
   * once and hands each row its owner's to orgMaxAt / flagsAt.
   */
  statsEpochs(): Int32Array {
    const out = new Int32Array(this.countryList.length);
    for (let id = 1; id < out.length; id++) out[id] = this.statsEpoch(id);
    return out;
  }

  /** orgMaxOf with the owner's stats epoch from statsEpochs (this pass). */
  orgMaxAt(row: number, epoch: number): number {
    return this.rowOrgEntry(row, epoch) ? this.rowStats.orgMax[row] : 0;
  }

  /** flagsOf with the owner's stats epoch from statsEpochs (this pass). */
  flagsAt(row: number, epoch: number): number {
    return this.rowOrgEntry(row, epoch) ? this.rowStats.flags[row] : 0;
  }

  /** Spec §10: `region`'s weather on `day` (weatherAt, kept by region for the last day read). */
  weatherOn(region: number, day: number): Weather {
    const sc = this.scenario;
    let c = this.weatherCache;
    if (c === null) {
      const n = sc.maxRegionId() + 1;
      c = { day: new Int32Array(n).fill(-0x80000000), w: new Uint8Array(n) };
      this.weatherCache = c;
    }
    if (region >= 0 && region < c.day.length && c.day[region] === day) {
      return WEATHERS[c.w[region]];
    }
    const w = weatherAt(
      day,
      sc.latC(region),
      sc.landOf(region),
      sc.wcell(region),
    );
    if (region >= 0 && region < c.day.length) {
      c.day[region] = day;
      c.w[region] = WEATHERS.indexOf(w);
    }
    return w;
  }

  /** The template's flags (TPL_*) of a division: they read only its template def. */
  flagsOf(row: number): number {
    return this.rowOrgEntry(row) ? this.rowStats.flags[row] : 0;
  }

  /** A division's combat width: it reads only its template def. */
  widthOf(row: number): number {
    return this.rowOrgEntry(row) ? this.rowStats.width[row] : 0;
  }

  /**
   * The division's template at generation 1, from the row cache. Only the
   * numbers that read just the def and the tech are the division's own:
   * width, men, orgMilli (before orgPct), supplyMilli, trainDays, need,
   * flags, special, battalions. Attack, defence, HP, armour, pierce,
   * hardness and speed follow the generations: baseStatsOf / statsOf.
   */
  templateNumbersOf(row: number): DivisionStats {
    return this.rowOrgEntry(row) ? this.rowStats.gen1[row] : EMPTY_STATS;
  }

  /** A division's full-strength supply use, milli a day (spec §11.3): it reads only its template def. */
  supplyBaseOf(row: number): number {
    return this.rowOrgEntry(row) ? this.rowStats.supply[row] : 0;
  }

  /** Fills the row's org max and flags when stale; false for a dead row. */
  private rowOrgEntry(row: number, knownEpoch = -1): boolean {
    const t = this.divisions;
    const id = t.id[row];
    if (id === 0) {
      // A tombstone: the old reads gave a template-less division's numbers.
      return false;
    }
    let c = this.rowStats;
    if (row >= c.id.length) c = this.rowStats = growRowStats(c, t.rows);
    const owner = t.owner[row];
    const epoch = knownEpoch >= 0 ? knownEpoch : this.statsEpoch(owner);
    const tpl = t.template[row];
    if (c.id[row] === id && c.tpl[row] === tpl && c.epoch[row] === epoch) {
      return true;
    }
    // Org and flags do not depend on the generation mix: any mix gives them.
    const base = this.templateStatsAt(owner, tpl, GEN1_MIX, epoch);
    const ce = this.econ.country(owner);
    const pct = ce === null ? 0 : ce.tech.orgPct;
    c.id[row] = id;
    c.tpl[row] = tpl;
    c.epoch[row] = epoch;
    c.orgMax[row] = Math.floor((base.orgMilli * (100 + pct)) / 100);
    c.flags[row] = base.flags;
    c.width[row] = base.width;
    c.supply[row] = base.supplyMilli;
    c.gen1[row] = base;
    return true;
  }

  /**
   * The country's stats epoch (see StatsInputs): moves when its tech
   * totals object or any template's id or def is not the one last seen.
   */
  private statsEpoch(owner: number): number {
    let s = this.statsInputs[owner];
    if (s === undefined) {
      s = { tech: null, ids: [], defs: [], epoch: 0 };
      this.statsInputs[owner] = s;
    }
    const tech = this.econ.country(owner)?.tech ?? null;
    const tpls = this.countryList[owner]?.templates ?? NO_TEMPLATES;
    let same = s.tech === tech && s.defs.length === tpls.length;
    for (let i = 0; same && i < tpls.length; i++) {
      same = tpls[i].def === s.defs[i] && tpls[i].id === s.ids[i];
    }
    if (!same) {
      s.tech = tech;
      s.ids = tpls.map((x) => x.id);
      s.defs = tpls.map((x) => x.def);
      s.epoch++;
    }
    return s.epoch;
  }

  private defOf(owner: number, template: number): TemplateDef | null {
    const tpls = this.countryList[owner]?.templates ?? NO_TEMPLATES;
    for (let i = 0; i < tpls.length; i++) {
      if (tpls[i].id === template) return tpls[i].def;
    }
    return null;
  }

  /** templateStats of the country's template at generation mix `mix` (EMPTY_DEF when it has none). */
  private templateStatsAt(
    owner: number,
    template: number,
    mix: readonly number[],
    epoch: number,
  ): DivisionStats {
    const key = owner * 65_536 + template;
    let e = this.tplCache.get(key);
    if (e === undefined || e.epoch !== epoch) {
      e = { epoch, gen1: null, byMix: new Map() };
      this.tplCache.set(key, e);
    }
    let gen1 = true;
    for (let i = 0; gen1 && i < mix.length; i++) gen1 = mix[i] === 100;
    if (gen1 && e.gen1 !== null) return e.gen1;
    const mixKey = gen1 ? "" : mix.join(",");
    if (!gen1) {
      const hit = e.byMix.get(mixKey);
      if (hit !== undefined) return hit;
    }
    const stats = templateStats(
      this.defOf(owner, template) ?? EMPTY_DEF,
      this.econ.country(owner)!.tech,
      mix,
    );
    if (gen1) e.gen1 = stats;
    else e.byMix.set(mixKey, stats);
    return stats;
  }

  private statsEntry(row: number): StatsEntry {
    const t = this.divisions;
    const id = t.id[row];
    const owner = t.owner[row];
    const epoch = this.statsEpoch(owner);
    const tpl = t.template[row];
    const men = t.men[row];
    const base0 = row * GROUND_SLOTS;
    const eq = t.equip;
    const hit = this.statsCache.get(id);
    if (hit !== undefined && hit.epoch === epoch && hit.template === tpl) {
      const he = hit.equip;
      let same = hit.men === men;
      for (let j = 0; same && j < GROUND_SLOTS; j++) {
        same = he[j] === eq[base0 + j];
      }
      if (same) return hit;
      // Men or equipment moved: the base holds while the generation mix does.
      hit.men = men;
      for (let j = 0; j < GROUND_SLOTS; j++) he[j] = eq[base0 + j];
      const mix = genMixInto(MIX_SCRATCH, he);
      let sameMix = true;
      for (let i = 0; sameMix && i < mix.length; i++) {
        sameMix = mix[i] === hit.mix[i];
      }
      if (!sameMix) {
        hit.mix = [...mix];
        hit.base = this.templateStatsAt(owner, tpl, hit.mix, epoch);
      }
      hit.eff = null;
      hit.strength = -1;
      hit.fill = null;
      return hit;
    }
    const equip = eq.slice(base0, base0 + GROUND_SLOTS);
    const mix = genMixOf(equip);
    const entry: StatsEntry = {
      epoch,
      template: tpl,
      men,
      equip,
      mix,
      base: this.templateStatsAt(owner, tpl, mix, epoch),
      eff: null,
      strength: -1,
      fill: null,
    };
    this.statsCache.set(id, entry);
    return entry;
  }

  /** Template numbers at generation 1 (screens, AI), cached per country, template and stats epoch. */
  templateStatsOf(owner: number, template: number): DivisionStats | null {
    if (this.defOf(owner, template) === null) return null;
    if (this.econ.country(owner) === null) return null;
    return this.templateStatsAt(
      owner,
      template,
      GEN1_MIX,
      this.statsEpoch(owner),
    );
  }

  strengthOf(row: number): number {
    return strengthOfEntry(this.statsEntry(row));
  }

  // ---- Armies (spec §6.1) ----

  newArmy(owner: number): Army | null {
    const cl = this.country(owner);
    if (cl === null || this.armiesOf(owner).length >= WW_MAX_ARMIES) {
      return null;
    }
    const a: Army = {
      id: this.nextArmyId++,
      owner,
      nameNo: cl.nextArmyNo++,
      general: 0,
      divisions: [],
      order: idleOrder(),
      auto: false,
      planBp: 0,
      front: [],
      path: [],
      pending: false,
      paraLastDay: -1,
    };
    this.armies.set(a.id, a);
    this.dirtyArmies.add(a.id);
    return a;
  }

  /** Spec §6.1: an army without divisions goes; its general is free again. */
  removeArmy(id: number): void {
    const a = this.armies.get(id);
    if (a === undefined) return;
    const g = this.country(a.owner)?.generals.find((x) => x.army === id);
    if (g !== undefined) g.army = 0;
    this.armies.delete(id);
    this.dirtyArmies.delete(id);
    this.removedArmyIds.push(id);
    this.markDetail(a.owner);
  }

  /** Moves a division to another army (split, merge, AI grouping). */
  moveToArmy(divisionId: number, army: Army): void {
    const r = this.divisions.rowOf(divisionId);
    if (r < 0) return;
    const old = this.armies.get(this.divisions.army[r]);
    if (old !== undefined && old !== army) {
      old.divisions = old.divisions.filter((d) => d !== divisionId);
      this.dirtyArmies.add(old.id);
      if (old.divisions.length === 0) this.removeArmy(old.id);
    }
    if (!army.divisions.includes(divisionId)) {
      army.divisions.push(divisionId);
      army.divisions.sort((a, b) => a - b);
    }
    this.divisions.army[r] = army.id;
    this.dirtyArmies.add(army.id);
  }

  armiesOf(smallID: number): Army[] {
    const out: Army[] = [];
    for (const a of this.armies.values()) if (a.owner === smallID) out.push(a);
    return out;
  }

  /** Spec §6.1: the region holding most of its divisions (ties: smaller id). */
  armyRegion(a: Army): number {
    const count = new Map<number, number>();
    for (const id of a.divisions) {
      const r = this.divisions.rowOf(id);
      if (r < 0) continue;
      const reg = this.divisions.region[r];
      count.set(reg, (count.get(reg) ?? 0) + 1);
    }
    let best = 0;
    let bestN = 0;
    for (const [reg, n] of count) {
      if (n > bestN || (n === bestN && reg < best)) {
        best = reg;
        bestN = n;
      }
    }
    return best;
  }

  // ---- Countries ----

  country(smallID: number): CountryLand | null {
    return this.countryList[smallID] ?? null;
  }

  countries(): CountryLand[] {
    return this.countryList.filter((c): c is CountryLand => c !== null);
  }

  fieldMen(smallID: number): number {
    const t = this.divisions;
    let n = 0;
    for (const r of this.rowsOf(smallID)) n += t.men[r];
    return n;
  }

  /**
   * The country's live rows in row (= id) order (derived: rebuilt when the
   * table added, killed, compacted or restored rows). A view: copy it
   * before adding or removing divisions while walking it.
   */
  rowsOf(smallID: number): readonly number[] {
    const t = this.divisions;
    if (this.ownerRowsVersion !== t.rowsVersion) {
      const out: number[][] = [];
      for (let r = 0; r < t.rows; r++) {
        if (t.id[r] !== 0) (out[t.owner[r]] ??= []).push(r);
      }
      this.ownerRows = out;
      this.ownerRowsVersion = t.rowsVersion;
    }
    return this.ownerRows[smallID] ?? NO_ROWS;
  }

  /** fieldMen of every country in one pass, indexed by smallID. */
  fieldMenByCountry(): number[] {
    const out = new Array<number>(this.countryList.length).fill(0);
    const t = this.divisions;
    for (let r = 0; r < t.rows; r++) {
      if (t.id[r] !== 0 && t.owner[r] < out.length) out[t.owner[r]] += t.men[r];
    }
    return out;
  }

  trainingMen(smallID: number): number {
    let n = 0;
    for (const x of this.country(smallID)?.trainees ?? []) n += x.men;
    return n;
  }

  /** P1's manpower ceiling counts these (spec §13.2). */
  armyMen(smallID: number): number {
    return this.fieldMen(smallID) + this.trainingMen(smallID);
  }

  day(): number {
    return this.ww.day(this.mg.ticks());
  }

  /**
   * A message to the country's human player only (spec §15.8). `key` is
   * the full translation key (pre-flight U5), passed literally.
   */
  message(
    smallID: number,
    key: LandMessageKey,
    params: Record<string, string | number> = {},
  ): void {
    const p = this.mg.playerBySmallID(smallID);
    if (!p.isPlayer() || p.type() !== PlayerType.Human) return;
    this.mg.displayMessage(
      key,
      MessageType.WORLD_WAR,
      p.id(),
      undefined,
      params,
    );
  }

  /** AttackExecution / TransportShipExecution refused one (decision 7): tell a human once a game. */
  noteVanillaAttack(p: Player): void {
    const cl = this.country(p.smallID());
    if (cl === null || cl.warnedTileAttack || p.type() !== PlayerType.Human) {
      return;
    }
    cl.warnedTileAttack = true;
    this.message(p.smallID(), "events_display.ww1936_no_tile_attacks");
  }

  /** Spec §5.5, §12.5: a capitulated country's divisions, armies and training are gone. */
  removeCountryForces(smallID: number): void {
    for (const r of [...this.rowsOf(smallID)]) this.killDivision(r, false);
    for (const a of this.armiesOf(smallID)) this.removeArmy(a.id);
    const cl = this.country(smallID);
    if (cl !== null) {
      cl.training = [];
      cl.trainees = [];
      for (const g of cl.generals) g.army = 0;
    }
    this.markDetail(smallID);
  }

  // ---- Change marks for the screens ----
  // Battles are not marked: every live battle is sent every tick (takeData).

  markArmy(id: number): void {
    this.dirtyArmies.add(id);
  }
  /** Adds a battle keeping `battles` in region order (Map order is iteration order). */
  addBattle(b: Battle): void {
    setInOrder(this.battles, b.region, b);
  }
  /** Sets a region's spread keeping `spreads` in region order. */
  setSpread(s: Spread): void {
    setInOrder(this.spreads, s.region, s);
  }
  endBattle(region: number): void {
    if (this.battles.delete(region)) this.endedBattleIds.push(region);
  }
  markRegion(region: number): void {
    this.dirtyLandRegions.add(region);
  }
  /** The country's summary and (a human's) detail go out. */
  markCountry(smallID: number): void {
    this.markDetail(smallID);
  }
  private markDetail(smallID: number): void {
    this.dirtyLandCountries.add(smallID);
    this.dirtyLandDetails.add(smallID);
  }

  // ---- Screens (spec §16.4) ----

  takeData(): WwLandData | null {
    if (
      this.dirtyArmies.size === 0 &&
      this.battles.size === 0 &&
      this.dirtyLandRegions.size === 0 &&
      this.dirtyLandCountries.size === 0 &&
      this.removedArmyIds.length === 0 &&
      this.endedBattleIds.length === 0
    ) {
      return null;
    }
    const asc = (s: Iterable<number>) => [...s].sort((a, b) => a - b);
    const d: WwLandData = {
      armies: [],
      removedArmies: asc(this.removedArmyIds),
      battles: [],
      endedBattles: asc(this.endedBattleIds),
      regions: [],
      countries: [],
      details: [],
    };
    for (const id of asc(this.dirtyArmies)) {
      const a = this.armies.get(id);
      if (a !== undefined) d.armies.push(this.armySummary(a));
    }
    // Spec §16.4: a running battle every tick.
    for (const region of asc(this.battles.keys())) {
      d.battles.push(this.battleSummary(this.battles.get(region)!));
    }
    for (const r of asc(this.dirtyLandRegions)) {
      if (this.scenario.region(r) !== undefined) {
        d.regions.push(this.regionData(r));
      }
    }
    for (const id of asc(this.dirtyLandCountries)) {
      const cl = this.country(id);
      if (cl === null) continue;
      d.countries.push(this.countrySummary(cl));
      if (!this.dirtyLandDetails.has(id)) continue;
      const p = this.mg.playerBySmallID(id);
      if (p.isPlayer() && p.type() === PlayerType.Human) {
        d.details.push(this.countryDetail(cl));
      }
    }
    this.dirtyArmies.clear();
    this.dirtyLandRegions.clear();
    this.dirtyLandCountries.clear();
    this.dirtyLandDetails.clear();
    this.removedArmyIds = [];
    this.endedBattleIds = [];
    return d;
  }

  armySummary(a: Army): ArmySummary {
    const t = this.divisions;
    const sum = emptySide();
    let strength = 0;
    let org = 0;
    let orgMax = 0;
    let supply = 0;
    let n = 0;
    let state = 0;
    let slowest = -1;
    let slowestPm = Infinity;
    const perTemplate = new Map<number, number>();
    for (const id of a.divisions) {
      const r = t.rowOf(id);
      if (r < 0) continue;
      n++;
      const e = this.statsEntry(r);
      addToSide(sum, effOf(e), t.org[r]);
      strength += strengthOfEntry(e);
      org += t.org[r];
      orgMax += this.orgMaxOf(r);
      supply += t.supply[r];
      perTemplate.set(t.template[r], (perTemplate.get(t.template[r]) ?? 0) + 1);
      const mode = t.mode[r];
      if (mode !== MOVE_NONE) {
        state |= ARMY_MOVING;
        if (mode === MOVE_RAIL) state |= ARMY_RAIL;
        if (mode === MOVE_SEA) state |= ARMY_SEA;
        if (mode === MOVE_RETREAT) state |= ARMY_RETREAT;
        const pm =
          t.need[r] <= 0 ? 0 : Math.floor((t.prog[r] * 1000) / t.need[r]);
        if (pm < slowestPm) {
          slowestPm = pm;
          slowest = r;
        }
      }
      if (t.battle[r] !== 0) state |= ARMY_BATTLE;
      if (t.encircled[r] !== 0) state |= ARMY_ENCIRCLED;
    }
    if (a.order.executing) state |= ARMY_EXECUTING;
    if (a.auto) state |= ARMY_AUTO;
    if (a.order.kind === "paradrop") state |= ARMY_PARA;
    let move: ArmySummary["move"] = null;
    let eta = -1;
    if (slowest >= 0) {
      const need = Math.max(1, t.need[slowest]);
      move = {
        from: t.region[slowest],
        to: t.next[slowest],
        progPm: slowestPm,
        stepPm: Math.floor((t.step[slowest] * 1000) / need),
      };
      if (t.step[slowest] > 0) {
        eta = Math.ceil(
          Math.max(0, t.need[slowest] - t.prog[slowest]) / t.step[slowest],
        );
      }
    }
    let bestTpl = -1;
    let bestN = 0;
    for (const [tpl, k] of perTemplate) {
      if (k > bestN || (k === bestN && tpl < bestTpl)) {
        bestTpl = tpl;
        bestN = k;
      }
    }
    const def = bestTpl < 0 ? null : this.templateOf(a.owner, bestTpl)?.def;
    const counts = def === null || def === undefined ? [] : templateCounts(def);
    const symbol =
      counts.length === 0
        ? -1
        : BATTALION_IDS.indexOf(counts[0][0] as BattalionId);
    const p = this.mg.playerBySmallID(a.owner);
    const human = p.isPlayer() && p.type() === PlayerType.Human;
    return {
      id: a.id,
      owner: a.owner,
      nameNo: a.nameNo,
      general: a.general,
      divisions: n,
      strengthPm: n === 0 ? 0 : Math.floor(strength / n),
      orgPm: orgMax <= 0 ? 0 : Math.floor((org * 1000) / orgMax),
      state,
      region: this.armyRegion(a),
      move,
      sum,
      symbol,
      mine: human
        ? {
            order: { ...a.order, targets: [...a.order.targets] },
            front: [...a.front],
            planBp: a.planBp,
            auto: a.auto,
            path: [...a.path],
            supplyPm: n === 0 ? 0 : Math.floor(supply / n),
            etaTicks: eta,
            paraLastDay: a.paraLastDay,
          }
        : null,
    };
  }

  battleSummary(b: Battle): BattleSummary {
    const t = this.divisions;
    const side = (ids: readonly number[]) => {
      let org = 0;
      let orgMax = 0;
      let str = 0;
      let n = 0;
      for (const id of ids) {
        const r = t.rowOf(id);
        if (r < 0) continue;
        n++;
        org += t.org[r];
        orgMax += this.orgMaxOf(r);
        str += this.strengthOf(r);
      }
      return {
        orgPm: orgMax <= 0 ? 0 : Math.floor((org * 1000) / orgMax),
        strPm: n === 0 ? 0 : Math.floor(str / n),
      };
    };
    const lineWidth = (ids: readonly number[]) => {
      let w = 0;
      for (const id of ids) {
        const r = t.rowOf(id);
        if (r >= 0) w += this.baseStatsOf(r).width;
      }
      return w;
    };
    const from = new Set<number>();
    for (const id of b.attackers) {
      const r = t.rowOf(id);
      if (r >= 0) from.add(t.region[r]);
    }
    const directions = Math.max(1, from.size);
    const att = side(b.attackers);
    const def = side(b.defenders);
    return {
      region: b.region,
      attacker: b.attLead,
      defender: b.defLead,
      attLine: b.attLine.length,
      attReserve: Math.max(0, b.attackers.length - b.attLine.length),
      defLine: b.defLine.length,
      defReserve: Math.max(0, b.defenders.length - b.defLine.length),
      width: combatWidth(this.scenario.landOf(b.region), directions),
      attWidth: lineWidth(b.attLine),
      defWidth: lineWidth(b.defLine),
      directions,
      progressPm: Math.floor(
        (b.lostOrgMilli * 1000) / Math.max(1, b.startOrgMilli),
      ),
      attOrgPm: att.orgPm,
      defOrgPm: def.orgPm,
      attStrPm: att.strPm,
      defStrPm: def.strPm,
    };
  }

  regionData(region: number): RegionLandData {
    const t = this.divisions;
    const count = new Map<number, number>();
    for (const r of this.rowsIn(region)) {
      count.set(t.owner[r], (count.get(t.owner[r]) ?? 0) + 1);
    }
    const counts = [...count]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 3);
    return {
      id: region,
      controller: this.controller[region],
      supplyMilli: this.supplyMilli[region],
      useMilli: this.useMilli[region],
      encircled: this.encircled[region] !== 0,
      counts,
    };
  }

  countrySummary(cl: CountryLand): CountryLandSummary {
    const t = this.divisions;
    const id = cl.smallID;
    let divisions = 0;
    let men = 0;
    const battles = new Set<number>();
    const encircledArmies = new Set<number>();
    for (const r of this.rowsOf(id)) {
      divisions++;
      men += t.men[r];
      if (t.battle[r] !== 0) battles.add(t.battle[r]);
      if (t.encircled[r] !== 0) encircledArmies.add(t.army[r]);
    }
    return {
      smallID: id,
      divisions,
      fieldMen: men,
      trainingMen: this.trainingMen(id),
      casualtiesToday: cl.casualtiesToday,
      battles: battles.size,
      encircledArmies: encircledArmies.size,
    };
  }

  countryDetail(cl: CountryLand): CountryLandDetail {
    const t = this.divisions;
    const id = cl.smallID;
    const ce = this.econ.country(id);
    const inUse = new Map<number, number>();
    const divisions: DivisionData[] = [];
    for (const r of this.rowsOf(id)) {
      inUse.set(t.template[r], (inUse.get(t.template[r]) ?? 0) + 1);
      const orgMax = this.orgMaxOf(r);
      const fill = equipFill(this.baseStatsOf(r), t.equipOf(r));
      const need = this.baseStatsOf(r).need;
      let equipPm = 1000;
      fill.forEach((f, i) => {
        if (need[i] > 0) equipPm = Math.min(equipPm, f);
      });
      divisions.push({
        id: t.id[r],
        army: t.army[r],
        template: t.template[r],
        region: t.region[r],
        strengthPm: this.strengthOf(r),
        orgPm: orgMax <= 0 ? 0 : Math.floor((t.org[r] * 1000) / orgMax),
        exp: t.exp[r],
        supplyPm: t.supply[r],
        equipPm,
        battle: t.battle[r],
        role: t.role[r],
      });
    }
    const training: TrainingData[] = cl.training.map((e) => {
      const s = this.templateStatsOf(id, e.template);
      const trainees = cl.trainees
        .filter((x) => x.entry === e.id)
        .map((x) => {
          const ts = this.templateStatsOf(id, x.template);
          return {
            days: x.days,
            need: ts?.trainDays ?? 0,
            fillPm: ts === null ? 0 : equipFillPm(ts, x.equip),
          };
        });
      let waiting = "";
      if (e.remaining > 0 && s !== null && (ce?.manpower ?? 0) < s.men) {
        waiting = "manpower";
      } else if (
        // The engine deploys on the lowest fill of the needed types
        // (Training.dailyTraining), not the cost-weighted bar above.
        cl.trainees.some((x) => {
          if (x.entry !== e.id) return false;
          const ts = this.templateStatsOf(id, x.template);
          return (
            ts !== null &&
            x.days >= ts.trainDays &&
            lowestFillPm(ts, x.equip) < WW_DEPLOY_MIN_FILL_PM
          );
        })
      ) {
        waiting = "equipment";
      }
      return {
        id: e.id,
        template: e.template,
        remaining: e.remaining,
        trainees,
        army: e.army,
        region: e.region,
        waiting,
      };
    });
    const generals: GeneralData[] = cl.generals.map((g) => {
      const def = g.roster >= 0 ? GENERALS[g.roster] : undefined;
      return {
        id: g.id,
        key: def?.id ?? "",
        titleNo: g.titleNo,
        att: g.att,
        def: g.dfn,
        plan: g.plan,
        log: g.log,
        traits: g.traits,
        level: g.level,
        xp: g.xp,
        army: g.army,
        // -1: open (no date in the roster).
        from: def?.from === undefined ? -1 : dayOfDate(def.from),
        until: def?.until === undefined ? -1 : dayOfDate(def.until),
      };
    });
    return {
      smallID: id,
      armyXpMilli: cl.armyXpMilli,
      templates: cl.templates.map((tpl) => ({
        id: tpl.id,
        name: tpl.def.name,
        key: tpl.key,
        battalions: [...tpl.def.battalions],
        support: [...tpl.def.support],
        inUse: inUse.get(tpl.id) ?? 0,
      })),
      training,
      generals,
      divisions,
    };
  }

  // ---- Snapshot, hash (spec §16.5) ----

  hash(): number {
    const n = this.countryList.length;
    const divs = new Array<number>(n).fill(0);
    const men = new Array<number>(n).fill(0);
    const org = new Array<number>(n).fill(0);
    const t = this.divisions;
    for (let r = 0; r < t.rows; r++) {
      if (t.id[r] === 0) continue;
      const o = t.owner[r];
      if (o >= n) continue;
      divs[o]++;
      men[o] = (men[o] + t.men[r]) | 0;
      org[o] = (org[o] + t.org[r]) | 0;
    }
    let h = 43;
    for (let id = 1; id < n; id++) {
      h = (Math.imul(h, 31) + divs[id] * 7 + men[id]) | 0;
      h = (Math.imul(h, 31) + org[id]) | 0;
    }
    h = (Math.imul(h, 31) + this.battles.size) | 0;
    for (const b of this.battles.values()) {
      h = (Math.imul(h, 31) + b.region * 3 + b.lostOrgMilli) | 0;
    }
    h = (Math.imul(h, 31) + this.controlChanges) | 0;
    h = (Math.imul(h, 31) + this.nextDivisionId * 5 + this.nextArmyId) | 0;
    for (const a of this.armies.values()) {
      h = (Math.imul(h, 31) + a.id * 13 + this.armyRegion(a)) | 0;
    }
    for (const s of this.spreads.values()) {
      h = (Math.imul(h, 31) + s.region * 7 + s.done) | 0;
    }
    return h >>> 0;
  }

  snapshot(): WwLandState {
    return {
      controller: Array.from(this.controller),
      supplyMilli: Array.from(this.supplyMilli),
      encircled: Array.from(this.encircled),
      useMilli: Array.from(this.useMilli),
      lastCommonDay: this.lastCommonDay,
      nextDivisionId: this.nextDivisionId,
      nextArmyId: this.nextArmyId,
      controlChanges: this.controlChanges,
      divisions: this.divisions.snapshot(),
      armies: [...this.armies.values()].map((a) => ({
        id: a.id,
        owner: a.owner,
        nameNo: a.nameNo,
        general: a.general,
        divisions: [...a.divisions],
        order: copyOrder(a.order),
        auto: a.auto,
        planBp: a.planBp,
        front: [...a.front],
        path: [...a.path],
        pending: a.pending,
        paraLastDay: a.paraLastDay,
      })),
      battles: [...this.battles.values()].map((b) => ({
        region: b.region,
        sinceTick: b.sinceTick,
        round: b.round,
        attackers: [...b.attackers],
        defenders: [...b.defenders],
        attLine: [...b.attLine],
        defLine: [...b.defLine],
        startOrgMilli: b.startOrgMilli,
        lostOrgMilli: b.lostOrgMilli,
        attLead: b.attLead,
        defLead: b.defLead,
      })),
      spreads: [...this.spreads.values()].map((s) => ({
        region: s.region,
        by: s.by,
        kind: s.kind,
        sources: [...s.sources],
        done: s.done,
        dayBase: s.dayBase,
        dayNo: s.dayNo,
      })),
      countries: this.countries().map((cl) => ({
        smallID: cl.smallID,
        templates: cl.templates.map((tpl) => ({
          id: tpl.id,
          key: tpl.key,
          name: tpl.def.name,
          battalions: [...tpl.def.battalions],
          support: [...tpl.def.support],
        })),
        nextTemplateId: cl.nextTemplateId,
        training: cl.training.map((e) => ({
          id: e.id,
          template: e.template,
          remaining: e.remaining,
          army: e.army,
          region: e.region,
        })),
        trainees: cl.trainees.map((x) => ({
          entry: x.entry,
          template: x.template,
          men: x.men,
          equip: [...x.equip],
          days: x.days,
        })),
        nextEntryId: cl.nextEntryId,
        armyXpMilli: cl.armyXpMilli,
        generals: cl.generals.map(copyGeneral),
        nextArmyNo: cl.nextArmyNo,
        nextTitleNo: cl.nextTitleNo,
        casualtiesToday: cl.casualtiesToday,
        readyToday: cl.readyToday,
        warnedTileAttack: cl.warnedTileAttack,
        peakDivisions: cl.peakDivisions,
      })),
    };
  }

  restoreState(s: WwLandState): void {
    this.controller.set(s.controller);
    this.supplyMilli.set(s.supplyMilli);
    this.encircled.set(s.encircled);
    this.useMilli.set(s.useMilli);
    this.lastCommonDay = s.lastCommonDay;
    this.nextDivisionId = s.nextDivisionId;
    this.nextArmyId = s.nextArmyId;
    this.controlChanges = s.controlChanges;
    this.divisions.restore(s.divisions);
    this.armies.clear();
    for (const a of s.armies) {
      this.armies.set(a.id, {
        id: a.id,
        owner: a.owner,
        nameNo: a.nameNo,
        general: a.general,
        divisions: [...a.divisions],
        order: copyOrder(a.order),
        auto: a.auto,
        planBp: a.planBp,
        front: [...a.front],
        path: [...a.path],
        pending: a.pending,
        paraLastDay: a.paraLastDay,
      });
    }
    this.battles.clear();
    for (const b of s.battles) {
      this.battles.set(b.region, {
        region: b.region,
        sinceTick: b.sinceTick,
        round: b.round,
        attackers: [...b.attackers],
        defenders: [...b.defenders],
        attLine: [...b.attLine],
        defLine: [...b.defLine],
        startOrgMilli: b.startOrgMilli,
        lostOrgMilli: b.lostOrgMilli,
        attLead: b.attLead,
        defLead: b.defLead,
      });
    }
    this.spreads.clear();
    for (const x of s.spreads) {
      this.spreads.set(x.region, {
        region: x.region,
        by: x.by,
        kind: x.kind,
        sources: [...x.sources],
        done: x.done,
        dayBase: x.dayBase,
        dayNo: x.dayNo,
      });
    }
    for (const c of s.countries) {
      const cl = this.countryList[c.smallID];
      if (cl === null || cl === undefined) continue;
      cl.templates = c.templates.map((tpl) => ({
        id: tpl.id,
        key: tpl.key,
        def: {
          name: tpl.name,
          battalions: tpl.battalions as BattalionId[],
          support: tpl.support as SupportId[],
        },
      }));
      cl.nextTemplateId = c.nextTemplateId;
      cl.training = c.training.map((e) => ({
        id: e.id,
        template: e.template,
        remaining: e.remaining,
        army: e.army,
        region: e.region,
      }));
      cl.trainees = c.trainees.map((x) => ({
        entry: x.entry,
        template: x.template,
        men: x.men,
        equip: [...x.equip],
        days: x.days,
      }));
      cl.nextEntryId = c.nextEntryId;
      cl.armyXpMilli = c.armyXpMilli;
      cl.generals = c.generals.map(copyGeneral);
      cl.nextArmyNo = c.nextArmyNo;
      cl.nextTitleNo = c.nextTitleNo;
      cl.casualtiesToday = c.casualtiesToday;
      cl.readyToday = c.readyToday;
      cl.warnedTileAttack = c.warnedTileAttack;
      cl.peakDivisions = c.peakDivisions;
    }
    this.rebuildDerived();
    // A restored game's screens have seen nothing yet.
    for (const id of this.armies.keys()) this.dirtyArmies.add(id);
    for (const r of this.scenario.landRegions) this.dirtyLandRegions.add(r.id);
    for (const cl of this.countries()) this.markDetail(cl.smallID);
  }

  /**
   * Derived (DERIVED_FIELDS): moves at every rebuildDerived (construction,
   * restore, factions), so caches kept outside the land know to start over.
   */
  derivedEpoch = 0;

  /** Sides, caches, the spread orders. The constructor and restoreState call it. */
  rebuildDerived(): void {
    this.derivedEpoch++;
    const n = this.countryList.length;
    this.sideOfId = new Array<number>(n).fill(0);
    const byKey = new Map<number, Side>();
    for (let id = 1; id < n; id++) {
      const f = this.ww.factionOf(id);
      const key = f === null ? id : 100_000 + FACTION_IDS.indexOf(f);
      this.sideOfId[id] = key;
      let s = byKey.get(key);
      if (s === undefined) byKey.set(key, (s = { key, rep: id, members: [] }));
      s.members.push(id);
    }
    this.sideListCache = [...byKey.values()].sort((a, b) => a.rep - b.rep);
    this.statsCache.clear();
    this.tplCache.clear();
    this.statsInputs = [];
    this.rowStats = newRowStats(0);
    this.weatherCache = null;
    this.regionRowsDirty = true;
    this.ownerRowsVersion = -1;
    this.divisions.rebuildIndex();
    this.spreadOrders.clear(); // Task 4 rebuilds an order on its first use
  }

  /** P3 hook (P3 spec §17.3): factions changed, sides again. */
  onFactionsChanged(): void {
    this.rebuildDerived();
  }
}

function copyOrder(o: ArmyOrder): ArmyOrder {
  return {
    kind: o.kind,
    to: o.to,
    mode: o.mode,
    anchor: o.anchor,
    enemy: o.enemy,
    targets: [...o.targets],
    stance: o.stance,
    executing: o.executing,
    readyDay: o.readyDay,
  };
}

function copyGeneral(g: GeneralState): GeneralState {
  return {
    id: g.id,
    roster: g.roster,
    titleNo: g.titleNo,
    att: g.att,
    dfn: g.dfn,
    plan: g.plan,
    log: g.log,
    traits: g.traits,
    xp: g.xp,
    level: g.level,
    army: g.army,
    use: [...g.use],
    terrainDays: [...g.terrainDays],
  };
}
