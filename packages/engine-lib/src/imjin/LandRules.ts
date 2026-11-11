// ww177 lane I1 (design ww175 §4-§5): the Imjin land rules, pure integer
// functions with no state of their own. The terrain table, the battle's
// steps, phases and orders, the volley clock, ambush and scouting, river
// crossings and the feigned retreat, morale and the rout cascade, and sieges.
// Every chance is a stateless wwRoll of (seed, purpose, region, battle start,
// round), so saves and replays roll the same. Percent values are added to a
// base of 100 (a "Pct" of 0 means no change, −100 means nothing); multipliers
// named "MulPct" are ×/100 (100 is ×1). Morale is per mille, 0..1000.
import { idHash, wwRoll } from "../ww1936/Roll";
import type { ImjinEdge, ImjinTerrain } from "./Terrain";

// ---- Roll purposes ----

/** A "charge at the gap" landing in a reload round. */
export const P_IMJIN_GAP = idHash("imjin_gap");
/** Scouts finding an ambush one region ahead. */
export const P_IMJIN_SCOUT = idHash("imjin_scout");
/** A commander falling in a bad round. */
export const P_IMJIN_CMDR = idHash("imjin_cmdr");

// ---- Cadence (§5 "Cadence") ----

/** A battle round every 5 ticks (0.5 s). */
export const ROUND_TICKS = 5;
/** A phase is 10 rounds (5 s); orders take effect at the next phase. */
export const PHASE_ROUNDS = 10;
/** The opening at range: archers, cannon and arquebus only. */
export const OPENING_ROUNDS = 5;
/** Rounds the winner pursues a routed unit. */
export const PURSUIT_ROUNDS = 3;

/** True on the ticks a battle that started at `startTick` fights a round. */
export function isRoundTick(tick: number, startTick: number): boolean {
  return tick > startTick && (tick - startTick) % ROUND_TICKS === 0;
}

/** The phase (0-based) of a 1-based round. */
export function phaseOf(round: number): number {
  return Math.floor((Math.max(1, round) - 1) / PHASE_ROUNDS);
}

/** True for the first round of a phase, when pending orders take effect. */
export function isPhaseStart(round: number): boolean {
  return round >= 1 && (round - 1) % PHASE_ROUNDS === 0;
}

/** Rounds left in this phase after this round (the card's countdown). */
export function phaseRoundsLeft(round: number): number {
  return PHASE_ROUNDS - 1 - ((Math.max(1, round) - 1) % PHASE_ROUNDS);
}

export type BattleStep = "opening" | "clash" | "pursuit";

/** The battle's step: pursuit once a side broke, else opening, then clash. */
export function battleStep(round: number, broken: boolean): BattleStep {
  if (broken) return "pursuit";
  return round <= OPENING_ROUNDS ? "opening" : "clash";
}

// ---- Unit rows (§5 "Unit rows") ----

export const UNIT_ROWS = [
  "spear",
  "arquebus",
  "archer",
  "cavalry",
  "samurai",
  "cannon",
  "engineer",
  "scout",
  "hwacha",
] as const;
export type UnitRow = (typeof UNIT_ROWS)[number];

/** Rows that fire in the opening at range. */
const RANGED: ReadonlySet<UnitRow> = new Set<UnitRow>([
  "arquebus",
  "archer",
  "cannon",
  "hwacha",
]);

/** True when the row deals damage in this step. */
export function rowFights(row: UnitRow, step: BattleStep): boolean {
  if (row === "engineer" || row === "scout") return false;
  return step !== "opening" || RANGED.has(row);
}

/** Spearmen hold the line: +50 % defence against charges. */
export const SPEAR_VS_CHARGE_PCT = 50;
/** The samurai retinue's shock in the clash. */
export const SAMURAI_CLASH_PCT = 30;
/** Pursuing cavalry hits routers twice. */
export const PURSUIT_CAVALRY_MULPCT = 200;
/** A cannon hit's morale damage, ×/100 of the same hit's. */
export const CANNON_MORALE_MULPCT = 150;
/** The hwacha's one volley a battle, ×/100 of an archer row's hit. */
export const HWACHA_VOLLEY_MULPCT = 400;

/**
 * The hwacha fires once: in the first opening round it stands in line.
 * ww177 P7b (doctrine §4, Haengju): `reload` (Joseon defending a fort, at a
 * phase's first round) fires it again.
 */
export function hwachaMulPct(
  step: BattleStep,
  used: boolean,
  reload = false,
): number {
  return reload || (step === "opening" && !used) ? HWACHA_VOLLEY_MULPCT : 0;
}

// ---- Terrain (§4 table) ----

export interface TerrainRow {
  /** Movement speed, % of base. */
  movePct: number;
  /** Added to the base 100 for each row type. */
  cavalryPct: number;
  arquebusPct: number;
  archerPct: number;
  cannonPct: number;
  /** Arquebus and archers on walls: the defender only. */
  wallArquebusPct: number;
  wallArcherPct: number;
  /** A cavalry charge is allowed (it is also off against walls). */
  charge: boolean;
  /** Added to the defender's block. */
  defencePct: number;
  /** Battle width as a fraction of full width. */
  widthNum: number;
  widthDen: number;
  /** Supply throughput, % of base. */
  supplyPct: number;
  /** A supply hub (walled town). */
  hub: boolean;
  /** Keeps its own grain under siege (mountain fortress). */
  ownGrain: boolean;
  /** How many regions off an army here is seen (0: hidden). */
  seenFrom: number;
  /** An ambush here, ×/100 damage taken by the ambushed (0: no ambush). */
  ambushMulPct: number;
  /** Cannon breach this fort at this speed, ×/100 (0: no walls to breach). */
  breachMulPct: number;
  /** Fort levels the class gives at least (walled towns: 1-2 by region data). */
  fortMin: number;
  /** One more band than the region's depth (mountain fortress). */
  extraBand: boolean;
}

function row(r: Partial<TerrainRow>): TerrainRow {
  return {
    movePct: 100,
    cavalryPct: 0,
    arquebusPct: 0,
    archerPct: 0,
    cannonPct: 0,
    wallArquebusPct: 0,
    wallArcherPct: 0,
    charge: true,
    defencePct: 0,
    widthNum: 1,
    widthDen: 1,
    supplyPct: 100,
    hub: false,
    ownGrain: false,
    seenFrom: 1,
    ambushMulPct: 0,
    breachMulPct: 0,
    fortMin: 0,
    extraBand: false,
    ...r,
  };
}

/** The open plain: cavalry +50 and charges, guns +20, seen 2 regions off. */
export const TERRAIN_PLAIN = row({
  cavalryPct: 50,
  arquebusPct: 20,
  cannonPct: 20,
  seenFrom: 2,
});
/** Paddy in the growing months of a farmed county. */
export const TERRAIN_PADDY_WET = row({
  movePct: 40,
  cavalryPct: -60,
  charge: false,
  cannonPct: -30,
  defencePct: 25,
  widthNum: 2,
  widthDen: 3,
  supplyPct: 60,
});
export const TERRAIN_PADDY_DRY = row({ movePct: 80, supplyPct: 90 });

const TERRAIN: Readonly<Record<ImjinTerrain, TerrainRow>> = {
  plain: TERRAIN_PLAIN,
  paddy: TERRAIN_PADDY_DRY,
  hills: row({
    movePct: 70,
    cavalryPct: -30,
    archerPct: 25,
    defencePct: 30,
    widthNum: 2,
    widthDen: 3,
    supplyPct: 80,
  }),
  forest: row({
    movePct: 60,
    cavalryPct: -50,
    arquebusPct: -40,
    archerPct: 10,
    cannonPct: -50,
    defencePct: 25,
    widthNum: 1,
    widthDen: 2,
    supplyPct: 70,
    seenFrom: 0,
    ambushMulPct: 150,
  }),
  mountain: row({
    movePct: 40,
    cavalryPct: -75,
    charge: false,
    arquebusPct: -20,
    archerPct: 30,
    cannonPct: -60,
    defencePct: 50,
    widthNum: 1,
    widthDen: 3,
    supplyPct: 40,
    seenFrom: 0,
    ambushMulPct: 150,
  }),
  pass: row({
    movePct: 30,
    charge: false,
    arquebusPct: -30,
    archerPct: 40,
    cannonPct: -60,
    defencePct: 100,
    widthNum: 1,
    widthDen: 4,
    supplyPct: 30,
    seenFrom: 0,
    ambushMulPct: 200,
  }),
  marsh: row({
    movePct: 30,
    cavalryPct: -75,
    charge: false,
    cannonPct: -50,
    defencePct: 25,
    widthNum: 1,
    widthDen: 2,
    supplyPct: 40,
  }),
  walled: row({
    movePct: 60,
    charge: false,
    wallArquebusPct: 20,
    wallArcherPct: 25,
    widthNum: 1,
    widthDen: 2,
    hub: true,
    breachMulPct: 100,
    fortMin: 1,
  }),
  fortress: row({
    movePct: 30,
    cavalryPct: -100,
    charge: false,
    arquebusPct: 20,
    archerPct: 40,
    widthNum: 1,
    widthDen: 3,
    supplyPct: 40,
    ownGrain: true,
    seenFrom: 0,
    breachMulPct: 50,
    fortMin: 3,
    extraBand: true,
  }),
};

/** The row for a region class; a paddy reads its wet or dry row. */
export function terrainRow(t: ImjinTerrain, wet = false): TerrainRow {
  return t === "paddy" && wet ? TERRAIN_PADDY_WET : TERRAIN[t];
}

/** True when an army here cannot be seen from outside the region. */
export function isHidden(t: TerrainRow): boolean {
  return t.seenFrom === 0;
}

/** Months (1-12, game calendar) a farmed paddy is flooded. */
export const PADDY_WET_FROM = 5;
export const PADDY_WET_TO = 9;
/** A county stops being farmed above this resistance (‰) or this many days occupied. */
export const UNFARMED_RESISTANCE_PM = 600;
export const UNFARMED_OCCUPIED_DAYS = 90;

/** Nobody floods the fields of a looted or long-occupied county. */
export function countyFarmed(
  resistancePm: number,
  occupiedDays: number,
): boolean {
  return (
    resistancePm <= UNFARMED_RESISTANCE_PM &&
    occupiedDays <= UNFARMED_OCCUPIED_DAYS
  );
}

/** A paddy is wet in the growing months when its county is farmed (by state, not date). */
export function paddyWet(month: number, farmed: boolean): boolean {
  return farmed && month >= PADDY_WET_FROM && month <= PADDY_WET_TO;
}

/** Big rivers freeze in the deepest winter months (decision 8B). */
export function riverFrozen(month: number): boolean {
  return month === 12 || month === 1 || month === 2;
}

/** The row's terrain percent (walls only count for the defender). */
export function rowTerrainPct(
  r: UnitRow,
  t: TerrainRow,
  defending: boolean,
): number {
  switch (r) {
    case "cavalry":
      return t.cavalryPct;
    case "arquebus":
      return t.arquebusPct + (defending ? t.wallArquebusPct : 0);
    case "archer":
    case "hwacha":
      return t.archerPct + (defending ? t.wallArcherPct : 0);
    case "cannon":
      return t.cannonPct;
    default:
      return 0;
  }
}

/** A battle's width in slots from its full width. */
export function terrainWidth(fullWidth: number, t: TerrainRow): number {
  return Math.max(1, Math.floor((fullWidth * t.widthNum) / t.widthDen));
}

// ---- Edges and crossings (§4 "Edges", §5 "River crossings") ----

export interface Crossing {
  /** Phases the attacker spends crossing (0: no crossing). */
  phases: number;
  /** Added to the crossing attacker's damage. */
  attackerPct: number;
  widthNum: number;
  widthDen: number;
  /** False: this edge cannot be attacked across at all. */
  allowed: boolean;
}

const NO_CROSSING: Crossing = {
  phases: 0,
  attackerPct: 0,
  widthNum: 1,
  widthDen: 1,
  allowed: true,
};

/**
 * The crossing an attack over this edge makes. A big river needs a ford, river
 * boats (a port region on it) or engineers; frozen, it is a ford everywhere.
 */
export function crossingOf(
  edge: ImjinEdge,
  frozen: boolean,
  riverBoats: boolean,
  engineers: boolean,
): Crossing {
  switch (edge) {
    case "small_river":
      return { ...NO_CROSSING, phases: 1, attackerPct: -30 };
    case "ford":
      return { ...NO_CROSSING, phases: 1, attackerPct: -20 };
    case "great_river":
      if (frozen) return crossingOf("ford", false, false, false);
      return {
        phases: 2,
        attackerPct: -50,
        widthNum: 1,
        widthDen: 2,
        allowed: riverBoats || engineers,
      };
    default:
      return NO_CROSSING;
  }
}

/** True while the attacker is still in the crossing phases. */
export function inCrossing(c: Crossing, round: number): boolean {
  return phaseOf(round) < c.phases;
}

// ---- Orders (§5 "Orders") ----

export const ATTACK_ORDERS = [
  "advance",
  "volley_advance",
  "charge",
  "charge_gap",
  "flank",
  "barrage",
  "storm",
  "feigned_retreat",
] as const;
export type AttackOrder = (typeof ATTACK_ORDERS)[number];

export const DEFENCE_STANCES = [
  "hold",
  "massed_volley",
  "rolling_volley",
  "archer_screen",
  "counter_charge",
  "strike_crossing",
  "ambush",
  "withdraw",
] as const;
export type DefenceStance = (typeof DEFENCE_STANCES)[number];

/**
 * 1936's counter table (TacticRules.COUNTER_OF_ATTACK) with era names: a
 * counter zeroes the countered order's own effect. assault→ambush became
 * storm→counter-charge (the sally at the ladders), shock→elastic became
 * charge→hold (the spear hedge), infiltration→hold became volley
 * advance→archers' screen, blitz→depth became charge at the gap→rolling
 * volley (no gap to find), envelop→withdraw stays flank→withdraw. The feigned
 * retreat has no counter: it only works on a counter-charge.
 */
export const COUNTER_OF_ORDER: Readonly<
  Record<AttackOrder, DefenceStance | null>
> = {
  advance: null,
  volley_advance: "archer_screen",
  charge: "hold",
  charge_gap: "rolling_volley",
  flank: "withdraw",
  barrage: null,
  // ww177 P7b (doctrine §7.3): missiles from the walls, not a sally
  // against the ladders.
  storm: "archer_screen",
  feigned_retreat: null,
};

export function orderCountered(o: AttackOrder, s: DefenceStance): boolean {
  return COUNTER_OF_ORDER[o] === s;
}

/** Orders that send cavalry in as a charge (the volley clock reads them). */
export function isCharge(o: AttackOrder): boolean {
  return o === "charge" || o === "charge_gap";
}

/** What an order pair does this round, beyond the volley clock. */
export interface OrderFx {
  /** Added to each attacker row's damage, by row. */
  attRowPct: Partial<Record<UnitRow, number>>;
  /** Added to each defender row's damage, by row. */
  defRowPct: Partial<Record<UnitRow, number>>;
  /** Added to all attacker / defender damage. */
  attPct: number;
  defPct: number;
  /** Added to the defender's block. */
  blockPct: number;
  /** ×/100 on morale and strength each side takes. */
  attTakenMulPct: number;
  defTakenMulPct: number;
  /** Morale the defender loses once at the phase start (flanked). */
  defMoraleHit: number;
}

function noFx(): OrderFx {
  return {
    attRowPct: {},
    defRowPct: {},
    attPct: 0,
    defPct: 0,
    blockPct: 0,
    attTakenMulPct: 100,
    defTakenMulPct: 100,
    defMoraleHit: 0,
  };
}

/** Morale a flanked side loses. */
export const FLANKED_MORALE = 100;

/**
 * The order pair's effects. `crossing`: the attacker is in its crossing
 * phases now. A countered order has no effect; the counter keeps its own.
 */
export function orderFx(
  o: AttackOrder,
  s: DefenceStance,
  crossing: boolean,
): OrderFx {
  const fx = noFx();
  const countered = orderCountered(o, s);
  if (!countered) {
    switch (o) {
      case "volley_advance":
        fx.attRowPct.arquebus = 25;
        break;
      case "charge":
      case "charge_gap":
        fx.attRowPct.cavalry = 30;
        break;
      case "flank":
        fx.attPct = 20;
        fx.defMoraleHit = FLANKED_MORALE;
        break;
      case "barrage":
        fx.attRowPct.cannon = 30;
        fx.attRowPct.archer = 30;
        break;
      case "storm":
        fx.attPct = 20;
        fx.attTakenMulPct = 120;
        break;
      case "feigned_retreat":
        // The bait not taken: the phase is spent pulling back.
        if (s !== "counter_charge") fx.attPct = -20;
        break;
      default:
        break;
    }
  }
  switch (s) {
    case "hold":
      fx.blockPct = 20;
      break;
    case "archer_screen":
      fx.defRowPct.archer = 25;
      break;
    case "counter_charge":
      fx.defRowPct.cavalry = 30;
      break;
    case "strike_crossing":
      // ×1.5 into a crossing; a wasted phase (−20 %) when nobody crosses.
      fx.defPct = crossing ? 50 : -20;
      break;
    case "withdraw":
      fx.defPct = -50;
      fx.defTakenMulPct = 50;
      break;
    default:
      break;
  }
  return fx;
}

/** A side's orders: the one in effect and the one given for the next phase. */
export interface OrderSlot<T> {
  current: T;
  pending: T | null;
}

/**
 * Orders given at any time take effect at the next phase; an ambushed side
 * cannot change them while `lockedPhases` is above 0.
 */
export function stepOrders<T>(
  slot: OrderSlot<T>,
  round: number,
  lockedPhases: number,
): OrderSlot<T> {
  if (!isPhaseStart(round) || slot.pending === null || lockedPhases > 0) {
    return slot;
  }
  return { current: slot.pending, pending: null };
}

/**
 * The feigned retreat: a defender that answers with a counter-charge crosses
 * after it, and the roles flip for the crossing phases: it fights them into
 * the waiting volley (the old attacker then strikes the crossing).
 */
export function feintFlips(o: AttackOrder, s: DefenceStance): boolean {
  return o === "feigned_retreat" && s === "counter_charge";
}

// ---- The volley clock (§5 "The volley clock") ----

/** A side fires by the clock with at least this share of arquebus. */
export const VOLLEY_SHARE_PCT = 30;
export const MASSED_FIRE_MULPCT = 250;
export const ROLLING_FIRE_MULPCT = 90;
/** Massed fire comes every third round, then two reload rounds. */
export const MASSED_CYCLE = 3;

export type VolleyMode = "none" | "massed" | "rolling";
export type VolleyBeat = "none" | "fire" | "reload" | "rolling";

/**
 * A side's volley mode. Every arquebus line fires by the clock: rolling by
 * default; massed on the massed-volley stance or the volley advance, once
 * arquebus are at least VOLLEY_SHARE_PCT of the side.
 */
export function volleyModeOf(
  order: AttackOrder | DefenceStance,
  arqSharePct: number,
): VolleyMode {
  if (arqSharePct <= 0) return "none";
  const massed = order === "massed_volley" || order === "volley_advance";
  return massed && arqSharePct >= VOLLEY_SHARE_PCT ? "massed" : "rolling";
}

/** This round's beat of the clock. Massed fires in rounds 1, 4, 7... */
export function volleyBeat(mode: VolleyMode, round: number): VolleyBeat {
  if (mode === "rolling") return "rolling";
  if (mode === "massed") {
    return (Math.max(1, round) - 1) % MASSED_CYCLE === 0 ? "fire" : "reload";
  }
  return "none";
}

/** ×/100 on the side's arquebus damage this round. */
export function volleyMulPct(beat: VolleyBeat): number {
  switch (beat) {
    case "fire":
      return MASSED_FIRE_MULPCT;
    case "reload":
      return 0;
    case "rolling":
      return ROLLING_FIRE_MULPCT;
    default:
      return 100;
  }
}

/** A charge into a loaded massed volley. */
export const CHARGE_INTO_FIRE_TAKEN_MULPCT = 300;
export const CHARGE_INTO_FIRE_MORALE = 200;
/** A charge that lands in the reload. */
export const CHARGE_GAP_DEALT_MULPCT = 200;
export const CHARGE_GAP_MORALE = 150;

export interface ChargeResult {
  /** ×/100 on what the charging cavalry deals and takes this round. */
  dealtMulPct: number;
  takenMulPct: number;
  /** Morale the charger and the charged lose at once. */
  chargerMorale: number;
  defenderMorale: number;
}

/**
 * Where a charge lands on the defender's clock. Against a massed volley a
 * plain charge meets the loaded volley (the gunners hold their fire for it);
 * "charge at the gap" lands in a reload round when `gapLanded`. Spearmen at
 * VOLLEY_SHARE_PCT or more of the defence halve the charge's bonus.
 */
export function chargeResult(
  mode: VolleyMode,
  gapLanded: boolean,
  spearSharePct: number,
): ChargeResult {
  if (mode === "massed" && !gapLanded) {
    return {
      dealtMulPct: 100,
      takenMulPct: CHARGE_INTO_FIRE_TAKEN_MULPCT,
      chargerMorale: CHARGE_INTO_FIRE_MORALE,
      defenderMorale: 0,
    };
  }
  if (mode === "massed") {
    const halve = spearSharePct >= VOLLEY_SHARE_PCT;
    return {
      dealtMulPct: halve
        ? 100 + Math.floor((CHARGE_GAP_DEALT_MULPCT - 100) / 2)
        : CHARGE_GAP_DEALT_MULPCT,
      takenMulPct: 100,
      chargerMorale: 0,
      defenderMorale: halve
        ? Math.floor(CHARGE_GAP_MORALE / 2)
        : CHARGE_GAP_MORALE,
    };
  }
  return {
    dealtMulPct: 100,
    takenMulPct: 100,
    chargerMorale: 0,
    defenderMorale: 0,
  };
}

/** The charge bonus a terrain gives cavalry, halved by a spear line. */
export function chargeTerrainPct(t: TerrainRow, spearSharePct: number): number {
  if (!t.charge || t.cavalryPct <= 0) return t.cavalryPct;
  return spearSharePct >= VOLLEY_SHARE_PCT
    ? Math.floor(t.cavalryPct / 2)
    : t.cavalryPct;
}

/** % chance a charge at the gap lands in a reload round: 50 + 10 × skill. */
export function gapChancePct(skill: number): number {
  return Math.max(0, Math.min(100, 50 + 10 * skill));
}

export function gapLands(
  seed: number,
  region: number,
  battleStart: number,
  round: number,
  skill: number,
): boolean {
  return (
    wwRoll(seed, P_IMJIN_GAP, region, battleStart, round) % 100 <
    gapChancePct(skill)
  );
}

/** Scouts or a commander of skill 3 or more read the enemy's rhythm. */
export function seesRhythm(scouts: boolean, skill: number): boolean {
  return scouts || skill >= 3;
}

// ---- Ambush and scouting (§5 "Ambush") ----

/** Days an army must stand still on the ambush stance to be hidden. */
export const AMBUSH_STILL_DAYS = 2;
export const AMBUSH_LOCK_PHASES = 2;
export const AMBUSH_MORALE = 150;
/** The careful march: −40 % speed, the ambush's effects halved. */
export const CAREFUL_MARCH_MOVE_PCT = 60;

/** True when the army is hidden in ambush here. */
export function ambushHidden(
  t: ImjinTerrain,
  stance: DefenceStance,
  stillDays: number,
): boolean {
  return (
    stance === "ambush" &&
    terrainRow(t).ambushMulPct > 0 &&
    stillDays >= AMBUSH_STILL_DAYS
  );
}

export interface AmbushFx {
  /** Phases the ambushed cannot pick orders. */
  lockPhases: number;
  /** The ambushed side's width as a fraction of the battle's. */
  widthNum: number;
  widthDen: number;
  /** ×/100 on the damage the ambushed takes. */
  takenMulPct: number;
  /** Morale it loses at once. */
  morale: number;
}

/** The ambush's effects on the side marching in; a careful march halves them. */
export function ambushFx(t: ImjinTerrain, careful: boolean): AmbushFx {
  const mul = terrainRow(t).ambushMulPct;
  if (!careful) {
    return {
      lockPhases: AMBUSH_LOCK_PHASES,
      widthNum: 1,
      widthDen: 3,
      takenMulPct: mul,
      morale: AMBUSH_MORALE,
    };
  }
  return {
    lockPhases: AMBUSH_LOCK_PHASES / 2,
    widthNum: 2,
    widthDen: 3,
    takenMulPct: 100 + Math.floor((mul - 100) / 2),
    morale: AMBUSH_MORALE / 2,
  };
}

/** % chance scouts spot an ambush one region ahead: 40 + 20 × level. */
export function scoutChancePct(level: number): number {
  return level <= 0 ? 0 : Math.min(100, 40 + 20 * level);
}

/** Keyed by the region ahead, the day and the marching army. */
export function scoutSpots(
  seed: number,
  region: number,
  day: number,
  army: number,
  level: number,
): boolean {
  return (
    wwRoll(seed, P_IMJIN_SCOUT, region, day, army) % 100 < scoutChancePct(level)
  );
}

// ---- Morale and rout (§5 "Morale and rout") ----

export const MORALE_MAX = 1000;
/** Below this a unit routs. */
export const ROUT_BELOW = 150;
/** −6 morale per 1 % of strength lost. */
export const CASUALTY_MORALE_PER_PCT = 6;
export const COMMANDER_KILLED_MORALE = 300;
export const NEIGHBOUR_ROUT_MORALE = 60;
export const WINNING_PHASE_MORALE = 20;
export const ENEMY_ROUT_MORALE = 100;
/** A routed unit runs this many regions and drops this share of its equipment. */
export const ROUT_RUN_REGIONS = 2;
export const ROUT_EQUIPMENT_LOSS_PCT = 25;

export function clampMorale(m: number): number {
  return Math.max(0, Math.min(MORALE_MAX, m));
}

/** Morale lost for a share of strength lost, in ‰ of strength. */
export function casualtyMorale(lostPm: number): number {
  return Math.floor((Math.max(0, lostPm) * CASUALTY_MORALE_PER_PCT) / 10);
}

export function routs(morale: number): boolean {
  return morale < ROUT_BELOW;
}

/** A neighbour's rout costs this much; halved with a commander present. */
export function neighbourRoutMorale(commander: boolean): number {
  return commander ? NEIGHBOUR_ROUT_MORALE / 2 : NEIGHBOUR_ROUT_MORALE;
}

/**
 * Routs cascade through a line: each unit that newly routs costs its two
 * neighbours (by line order) their neighbour's-rout morale, until no new unit
 * routs. `morale` and `commander` are by line slot; `routed` marks slots
 * already routed. Returns the new morale and routed flags.
 */
export function routCascade(
  morale: readonly number[],
  commander: readonly boolean[],
  routed: readonly boolean[] = [],
): { morale: number[]; routed: boolean[] } {
  const m = morale.map(clampMorale);
  const out = m.map((v, i) => routed[i] === true || routs(v));
  const queue: number[] = [];
  m.forEach((_, i) => {
    if (out[i] && routed[i] !== true) queue.push(i);
  });
  while (queue.length > 0) {
    const i = queue.shift()!;
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= m.length || out[j]) continue;
      m[j] = clampMorale(m[j] - neighbourRoutMorale(commander[j] === true));
      if (routs(m[j])) {
        out[j] = true;
        queue.push(j);
      }
    }
  }
  return { morale: m, routed: out };
}

/** A commander may fall in a round his unit loses over this share, or routs. */
export const COMMANDER_RISK_LOSS_PM = 300;
export const COMMANDER_DEATH_PCT = 3;
export const COMMANDER_DEATH_BRAVE_PCT = 6;

export function commanderAtRisk(lostPm: number, routed: boolean): boolean {
  return routed || lostPm > COMMANDER_RISK_LOSS_PM;
}

export function commanderFalls(
  seed: number,
  region: number,
  battleStart: number,
  round: number,
  commanderId: number,
  brave: boolean,
): boolean {
  const r =
    wwRoll(
      seed,
      P_IMJIN_CMDR,
      region ^ Math.imul(commanderId, 0x9e3779b1),
      battleStart,
      round,
    ) % 100;
  return r < (brave ? COMMANDER_DEATH_BRAVE_PCT : COMMANDER_DEATH_PCT);
}

// ---- One row's damage this round ----

export interface RowHitCtx {
  row: UnitRow;
  defending: boolean;
  step: BattleStep;
  terrain: TerrainRow;
  fx: OrderFx;
  /** This side's volley beat (arquebus only). */
  beat: VolleyBeat;
  /** The opposing side's spear share, % (halves the plain's charge bonus). */
  enemySpearPct: number;
  /** The attacker's crossing while it is in its crossing phases, else null. */
  crossing: Crossing | null;
  /** The target is routed (pursuit). */
  targetRouted: boolean;
  /** The hwacha already fired this battle. */
  hwachaUsed: boolean;
  /** ww177 P7b: the hwacha fires again this round (hwachaMulPct). */
  hwachaReload?: boolean;
  /** ww177 P7b: the samurai's clash bonus, % (absent: SAMURAI_CLASH_PCT). */
  samuraiClashPct?: number;
}

function mulPct(v: number, pct: number): number {
  return Math.floor((v * pct) / 100);
}

/**
 * ×/100 on one row's damage this round, every layer but luck and the charge's
 * landing (chargeResult): the step, terrain, orders, volley clock, samurai
 * clash, pursuit and crossing. Each layer floors in turn.
 */
export function rowDealtMulPct(c: RowHitCtx): number {
  if (!rowFights(c.row, c.step)) return 0;
  const terrainPct =
    c.row === "cavalry"
      ? chargeTerrainPct(c.terrain, c.enemySpearPct)
      : rowTerrainPct(c.row, c.terrain, c.defending);
  let v = Math.max(0, 100 + terrainPct);
  const rowPct = (c.defending ? c.fx.defRowPct : c.fx.attRowPct)[c.row] ?? 0;
  v = mulPct(
    v,
    Math.max(0, 100 + rowPct + (c.defending ? c.fx.defPct : c.fx.attPct)),
  );
  if (c.row === "arquebus") v = mulPct(v, volleyMulPct(c.beat));
  if (c.row === "hwacha")
    v = mulPct(v, hwachaMulPct(c.step, c.hwachaUsed, c.hwachaReload === true));
  if (c.row === "samurai" && c.step === "clash")
    v = mulPct(v, 100 + (c.samuraiClashPct ?? SAMURAI_CLASH_PCT));
  if (c.row === "cavalry" && c.step === "pursuit" && c.targetRouted) {
    v = mulPct(v, PURSUIT_CAVALRY_MULPCT);
  }
  if (!c.defending && c.crossing !== null) {
    v = mulPct(v, Math.max(0, 100 + c.crossing.attackerPct));
  }
  return v;
}

/** ×/100 on a defender's block: terrain, the hold, spearmen against a charge. */
export function blockMulPct(
  t: TerrainRow,
  fx: OrderFx,
  spearSharePct: number,
  charged: boolean,
): number {
  const spear =
    charged && spearSharePct >= VOLLEY_SHARE_PCT ? SPEAR_VS_CHARGE_PCT : 0;
  return 100 + t.defencePct + fx.blockPct + spear;
}

// ---- Sieges (§5 "Sieges") ----

export type SiegeChoice = "storm" | "breach" | "starve";

/** Storming the walls: the attacker ×0.5, the defender ×1.5. */
export const STORM_ATTACKER_MULPCT = 50;
export const STORM_DEFENDER_MULPCT = 150;
/** A garrison out of grain loses this much morale a day. */
export const STARVING_MORALE = 50;
/** Besiegers caught between a relief army and a sally. */
export const RELIEF_BESIEGER_BLOCK_MULPCT = 70;
export const RELIEF_BESIEGER_MORALE = 100;

export interface SiegeState {
  /** Days of grain left. */
  grainDays: number;
  /** Fort level left. */
  fort: number;
  /** Days of breaching on the current level. */
  breachDays: number;
  /** The garrison's morale. */
  morale: number;
}

/**
 * Days cannon take to cut one level: 3 × level, slower on a mountain fortress
 * (breachMulPct 50: twice as long); engineers cut it by a third. 0: no breach.
 */
export function breachDaysFor(
  level: number,
  t: TerrainRow,
  engineers: boolean,
  bigGuns = false,
): number {
  if (level <= 0 || t.breachMulPct <= 0) return 0;
  let d = Math.floor((3 * level * 100) / t.breachMulPct);
  // ww177 P7b (doctrine §6): Ming's heavy guns breach twice as fast.
  if (bigGuns) d = Math.max(1, Math.floor(d / 2));
  return engineers ? Math.max(1, d - Math.floor(d / 3)) : d;
}

/**
 * One day of siege. The garrison eats its grain, then starves; cannon (with
 * the breach choice) cut a level every breachDaysFor days.
 */
export function siegeDay(
  s: SiegeState,
  choice: SiegeChoice,
  cannon: boolean,
  engineers: boolean,
  t: TerrainRow,
  bigGuns = false,
): SiegeState {
  const n = { ...s };
  if (n.grainDays > 0) n.grainDays--;
  else n.morale = clampMorale(n.morale - STARVING_MORALE);
  if (choice === "breach" && cannon && n.fort > 0) {
    const need = breachDaysFor(n.fort, t, engineers, bigGuns);
    n.breachDays++;
    if (need > 0 && n.breachDays >= need) {
      n.fort--;
      n.breachDays = 0;
    }
  }
  return n;
}

/**
 * ×/100 on each side's damage in a storm (a fort of level 0 is no wall).
 * ww177 P7b (doctrine §7.3): by the wall's level: a town wall 80/125, a
 * level-2 wall 65/140, a fortress or a wajō (3+) 50/150. Busanjin and
 * Dongnae fell in hours; Haengju held.
 */
export function stormMulPct(fort: number): {
  attacker: number;
  defender: number;
} {
  if (fort <= 0) return { attacker: 100, defender: 100 };
  if (fort === 1) return { attacker: 80, defender: 125 };
  if (fort === 2) return { attacker: 65, defender: 140 };
  return { attacker: STORM_ATTACKER_MULPCT, defender: STORM_DEFENDER_MULPCT };
}

/** Escalade (doctrine §7.3): the attacker's bonus, the strength it needs over the garrison, and the wall it can climb. */
export const ESCALADE_PCT = 25;
export const ESCALADE_RATIO_PCT = 300;
export const ESCALADE_MAX_FORT = 2;
/** Ming's guns blow the gates on a storm (doctrine §6). */
export const GATES_BLOWN_PCT = 20;
/** The moonlit storm: the defender's missile rows ×/100 (doctrine §2). */
export const NIGHT_STORM_MULPCT = 70;
/** The bigyeokjincheonroe's morale on a barrage phase (doctrine §4). */
export const BIGYEOK_BARRAGE_MORALE = 100;
/** The iron shields: arquebus fire on Ming ×/100 (doctrine §6). */
export const IRON_SHIELDS_MULPCT = 85;

/**
 * A relief army attacking the besiegers lets the garrison sally the same
 * phase; the besiegers then fight both ways at ×0.7 block and lose 100 morale.
 */
export function reliefFx(
  relief: boolean,
  sally: boolean,
): {
  besiegerBlockMulPct: number;
  besiegerMorale: number;
} {
  return relief && sally
    ? {
        besiegerBlockMulPct: RELIEF_BESIEGER_BLOCK_MULPCT,
        besiegerMorale: RELIEF_BESIEGER_MORALE,
      }
    : { besiegerBlockMulPct: 100, besiegerMorale: 0 };
}

/** The fort level a region has: the class's minimum, or its own data if higher. */
export function fortLevelOf(t: ImjinTerrain, regionLevel: number): number {
  return Math.max(
    terrainRow(t).fortMin,
    t === "walled" ? Math.min(2, regionLevel) : regionLevel,
  );
}
