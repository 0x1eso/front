// ww7 lane A (design ww6 §2): the luck of a land battle, in three layers that
// a round's hit-by-hit expected values cannot give: the tactics each side
// picks every four rounds, the daily luck on each side's attack, and the
// reserves' chance to enter the line. Pure integer functions of (game seed,
// region, battle start tick, round or day): no RNG state anywhere, so a
// restored game rolls what the live one would (Roll.wwRoll). The engine's
// fight, the battle card and predictBattleRange call the same functions.
import {
  LAND_ATTACK_TACTICS,
  LAND_DEFENSE_TACTICS,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  P_LAND_LUCK,
  P_LAND_REINF,
  P_LAND_TACTIC,
  pickWeighted,
  wwRoll,
} from "./Roll";

/** Rounds a tactic pair stays in play (about half a day: 1 tick = 1 round). */
export const TACTIC_PHASE_ROUNDS = 4;

const atk = (id: (typeof LAND_ATTACK_TACTICS)[number]) =>
  LAND_ATTACK_TACTICS.indexOf(id);
const dfn = (id: (typeof LAND_DEFENSE_TACTICS)[number]) =>
  LAND_DEFENSE_TACTICS.indexOf(id);

/** Indices into LAND_ATTACK_TACTICS (what Battle.tacticAtt holds). */
export const AT_ATTACK = atk("attack");
export const AT_ASSAULT = atk("assault");
export const AT_SHOCK = atk("shock");
export const AT_INFILTRATION = atk("infiltration");
export const AT_BARRAGE = atk("barrage");
export const AT_BLITZ = atk("blitz");
export const AT_ENVELOP = atk("envelop");
/** Indices into LAND_DEFENSE_TACTICS (what Battle.tacticDef holds). */
export const DT_DEFEND = dfn("defend");
export const DT_AMBUSH = dfn("ambush");
export const DT_ELASTIC = dfn("elastic");
export const DT_COUNTER = dfn("counter");
export const DT_HOLD = dfn("hold");
export const DT_DEPTH = dfn("depth");
export const DT_WITHDRAW = dfn("withdraw");

/**
 * The defence tactic that counters each attack tactic (-1: none). A counter
 * zeroes the countered tactic's effect; the counter keeps its own.
 */
export const COUNTER_OF_ATTACK: readonly number[] = LAND_ATTACK_TACTICS.map(
  (t) =>
    t === "assault"
      ? DT_AMBUSH
      : t === "shock"
        ? DT_ELASTIC
        : t === "infiltration"
          ? DT_HOLD
          : t === "blitz"
            ? DT_DEPTH
            : t === "envelop"
              ? DT_WITHDRAW
              : -1,
);

/** The attack tactic a defence tactic counters (-1: none); the inverse of COUNTER_OF_ATTACK. */
export const COUNTERED_BY_DEFENSE: readonly number[] = LAND_DEFENSE_TACTICS.map(
  (_, d) => COUNTER_OF_ATTACK.indexOf(d),
);

/** True when the defence tactic counters the attack tactic (its effect is then 0). */
export function isCountered(att: number, def: number): boolean {
  return def >= 0 && COUNTER_OF_ATTACK[att] === def;
}

/**
 * What a tactic pair does in a round. Bp offsets (+2500 is ×1.25) are added
 * within a side and multiplied with the luck; Pp are percentage points.
 */
export interface TacticFx {
  /** Attacker's attack, bp (assault, shock, blitz, envelop; the defender's counter cuts it). */
  attAtkBp: number;
  /** Attacker's soft attack only, bp (barrage). */
  attSoftBp: number;
  /** Defender's attack, bp (ambush, counter). */
  defAtkBp: number;
  /** Defender's block value (defence), bp (hold). */
  defBlockBp: number;
  /** Org damage each side takes, bp (assault, elastic, withdraw). */
  attOrgBp: number;
  defOrgBp: number;
  /** HP damage each side takes, bp (withdraw). */
  attHpBp: number;
  defHpBp: number;
  /** Each side's reserve entry chance, percentage points (infiltration). */
  attReinfPp: number;
  defReinfPp: number;
  /** Blitz landed: the defender's entrenchment bonus counts half. */
  halveEntrench: boolean;
  /**
   * Envelop landed (not countered by withdraw): on the ground, the
   * defenders' annihilation threshold is 20 % instead of 10 % (lane B reads
   * it where a lost battle evicts the defenders).
   */
  envelop: boolean;
  /**
   * Withdraw in play: a defender that loses steps back to the next band in
   * good order, +10 % org (lane B reads it where the defenders retreat).
   */
  withdraw: boolean;
}

export function newTacticFx(): TacticFx {
  return {
    attAtkBp: 0,
    attSoftBp: 0,
    defAtkBp: 0,
    defBlockBp: 0,
    attOrgBp: 0,
    defOrgBp: 0,
    attHpBp: 0,
    defHpBp: 0,
    attReinfPp: 0,
    defReinfPp: 0,
    halveEntrench: false,
    envelop: false,
    withdraw: false,
  };
}

/** Table of design §2.2, written into `out` (no allocation). */
export function tacticFx(att: number, def: number, out: TacticFx): TacticFx {
  const countered = isCountered(att, def);
  let attAtk = 0;
  let attOrg = 0;
  let attReinf = 0;
  let defReinf = 0;
  let halve = false;
  let envelop = false;
  if (!countered) {
    if (att === AT_ASSAULT) {
      attAtk += 2500;
      attOrg += 1000;
    } else if (att === AT_SHOCK) {
      attAtk += 3000;
    } else if (att === AT_INFILTRATION) {
      attReinf += 15;
      defReinf -= 10;
    } else if (att === AT_BLITZ) {
      attAtk += 3500;
      halve = true;
    } else if (att === AT_ENVELOP) {
      attAtk += 1500;
      envelop = true;
    }
  }
  let defAtk = 0;
  let block = 0;
  let defOrg = 0;
  let hp = 0;
  if (def === DT_AMBUSH) {
    defAtk += 1500;
  } else if (def === DT_ELASTIC) {
    defOrg -= 2000;
  } else if (def === DT_COUNTER) {
    defAtk += 2500;
    attAtk -= 1000;
  } else if (def === DT_HOLD) {
    block += 1500;
  } else if (def === DT_WITHDRAW) {
    attOrg -= 2500;
    defOrg -= 2500;
    hp -= 2500;
  }
  out.attAtkBp = attAtk;
  // Barrage is never countered.
  out.attSoftBp = att === AT_BARRAGE ? 2000 : 0;
  out.defAtkBp = defAtk;
  out.defBlockBp = block;
  out.attOrgBp = attOrg;
  out.defOrgBp = defOrg;
  out.attHpBp = hp;
  out.defHpBp = hp;
  out.attReinfPp = attReinf;
  out.defReinfPp = defReinf;
  out.halveEntrench = halve;
  out.envelop = envelop;
  out.withdraw = def === DT_WITHDRAW;
  return out;
}

// ---- Initiative (design §2.3) ----

/** What a side brings to the tactic and initiative picks (the engine reads it off the line). */
export interface TacticSide {
  /** The lead general's trait mask (0 without one). */
  traits: number;
  /** Its attack skill (attacker) or defence skill (defender), 0..5, and its level, 0..5. */
  skill: number;
  level: number;
  signal: boolean;
  recon: boolean;
  /** Doctrine and research: 0..10. */
  doctrine: number;
  /** Experience tier of the line: 0 recruit … 3 elite (CombatRules.expBp's steps). */
  expTier: number;
  /** Artillery battalions and armour + motorized battalions, ‰ of the line's battalions. */
  artPm: number;
  mechPm: number;
  /** Defender: the line's mean entrenchment level and the region's fort level. */
  entrench: number;
  fort: number;
  /** Attacker: regions it attacks from. */
  directions: number;
}

export function newTacticSide(): TacticSide {
  return {
    traits: 0,
    skill: 0,
    level: 0,
    signal: false,
    recon: false,
    doctrine: 0,
    expTier: 0,
    artPm: 0,
    mechPm: 0,
    entrench: 0,
    fort: 0,
    directions: 1,
  };
}

const T = (id: Parameters<typeof traitBit>[0]) => traitBit(id);
const B_PANZER = T("panzer_leader");
const B_INFANTRY_OFFICER = T("infantry_officer");
const B_CAVALRY = T("cavalry_officer");
const B_OFFENSIVE = T("offensive_doctrine");
const B_DEFENSIVE = T("defensive_doctrine");
const B_DESERT_FOX = T("desert_fox");
const B_ARMOR_EXPERT = T("armor_expert");
const B_ARTILLERY = T("artillery_officer");
const B_TRICKSTER = T("trickster");
const B_COMMANDO = T("commando");
const B_SKIRMISHER = T("skirmisher");
const B_AMBUSHER = T("ambusher");

const hasT = (mask: number, bit: number) => (mask & bit) !== 0;

/**
 * 0..100. 20 + the general's skill × 4 + level × 2 + his traits' part + a
 * signal company 10 + a recon company 5 + doctrine 0..10 + 3 a step of the
 * line's experience (design §2.3). The attacker's offensive_doctrine and the
 * defender's defensive_doctrine and ambusher count 6; a trickster 8; a
 * skirmisher 4; a panzer leader (attacker) 4.
 */
export function initiativeOf(s: TacticSide, defending: boolean): number {
  let v = 20 + s.skill * 4 + s.level * 2;
  const m = s.traits;
  if (hasT(m, B_TRICKSTER)) v += 8;
  if (hasT(m, B_SKIRMISHER)) v += 4;
  if (defending) {
    if (hasT(m, B_DEFENSIVE)) v += 6;
    if (hasT(m, B_AMBUSHER)) v += 6;
  } else {
    if (hasT(m, B_OFFENSIVE)) v += 6;
    if (hasT(m, B_PANZER)) v += 4;
  }
  if (s.signal) v += 10;
  if (s.recon) v += 5;
  v += Math.max(0, Math.min(10, s.doctrine)) + 3 * s.expTier;
  return Math.max(0, Math.min(100, v));
}

// ---- Picking (design §2.1, §2.2) ----

/** v × pct / 100, floored. */
const pct = (v: number, p: number) => Math.floor((v * p) / 100);

/**
 * The attack tactics' pick weights (0: not available), by composition and
 * general: barrage needs artillery battalions ≥ 25 %, blitz armour and
 * motorized ≥ 50 %, envelop two directions or more. Offensive generals go
 * for assault and shock, armour men for blitz and shock, artillery officers
 * for barrage, tricksters and skirmishers for infiltration, cavalry
 * officers for envelop.
 */
export function attackWeights(s: TacticSide, w: number[]): void {
  const m = s.traits;
  w[AT_ATTACK] = hasT(m, B_INFANTRY_OFFICER) ? 30 : 20;
  w[AT_ASSAULT] = hasT(m, B_OFFENSIVE) ? 32 : 16;
  w[AT_SHOCK] = 16;
  if (hasT(m, B_OFFENSIVE)) w[AT_SHOCK] = 32;
  w[AT_INFILTRATION] = 12;
  if (hasT(m, B_TRICKSTER) || hasT(m, B_SKIRMISHER) || hasT(m, B_COMMANDO)) {
    w[AT_INFILTRATION] = 30;
  }
  w[AT_BARRAGE] = s.artPm >= 250 ? 8 + Math.floor(s.artPm / 25) : 0;
  if (hasT(m, B_ARTILLERY)) w[AT_BARRAGE] = pct(w[AT_BARRAGE], 300);
  w[AT_BLITZ] = s.mechPm >= 500 ? 8 + Math.floor(s.mechPm / 20) : 0;
  if (hasT(m, B_PANZER) || hasT(m, B_ARMOR_EXPERT)) {
    w[AT_BLITZ] = pct(w[AT_BLITZ], 300);
    w[AT_SHOCK] = pct(w[AT_SHOCK], 150);
  }
  w[AT_ENVELOP] =
    s.directions >= 2 ? 10 + 4 * Math.min(2, s.directions - 2) : 0;
  if (hasT(m, B_CAVALRY) || hasT(m, B_DESERT_FOX)) {
    w[AT_ENVELOP] = pct(w[AT_ENVELOP], 200);
  }
}

/**
 * The defence tactics' pick weights: hold needs the line's entrenchment ≥ 3
 * or a fort, and grows with both. Defensive generals hold, give ground
 * (elastic) and set depth; ambushers ambush; tricksters and offensive
 * generals counter; skirmishers go elastic.
 */
export function defenseWeights(s: TacticSide, w: number[]): void {
  const m = s.traits;
  w[DT_DEFEND] = 20;
  w[DT_AMBUSH] = 12;
  if (hasT(m, B_AMBUSHER)) w[DT_AMBUSH] = 36;
  if (hasT(m, B_TRICKSTER)) w[DT_AMBUSH] = pct(w[DT_AMBUSH], 150);
  w[DT_ELASTIC] = 12;
  if (hasT(m, B_DEFENSIVE)) w[DT_ELASTIC] = pct(w[DT_ELASTIC], 150);
  if (hasT(m, B_SKIRMISHER)) w[DT_ELASTIC] = pct(w[DT_ELASTIC], 200);
  w[DT_COUNTER] = 10;
  if (hasT(m, B_TRICKSTER) || hasT(m, B_OFFENSIVE)) {
    w[DT_COUNTER] = pct(w[DT_COUNTER], 200);
  }
  if (s.mechPm >= 500) w[DT_COUNTER] = pct(w[DT_COUNTER], 150);
  w[DT_HOLD] =
    s.entrench >= 3 || s.fort > 0 ? 6 + 4 * s.entrench + 6 * s.fort : 0;
  if (hasT(m, B_DEFENSIVE)) w[DT_HOLD] = pct(w[DT_HOLD], 250);
  w[DT_DEPTH] = 10;
  if (hasT(m, B_DEFENSIVE)) w[DT_DEPTH] = pct(w[DT_DEPTH], 150);
  w[DT_WITHDRAW] = 8;
}

/** The picks of one phase (written by pickTactics). */
export interface TacticPick {
  att: number;
  def: number;
}

// Scratch weights (a pick allocates nothing).
const WA: number[] = new Array<number>(LAND_ATTACK_TACTICS.length).fill(0);
const WD: number[] = new Array<number>(LAND_DEFENSE_TACTICS.length).fill(0);

/**
 * Design §2.2, §2.3: both sides pick, each from its weights by its own roll
 * (k = 0 the attacker's, 1 the defender's). The side with the higher
 * initiative picks second with 50 % + the difference in percent, seeing the
 * other's pick: a defender takes the tactic that counters it when it has
 * one (and may use it); an attacker keeps clear of the attack tactic the
 * defender's pick counters. Otherwise both pick blind. The inputs are the
 * only state: the roll is wwRoll(seed, P_LAND_TACTIC, region, since,
 * round × 4 + k).
 */
export function pickTactics(
  seed: number,
  region: number,
  since: number,
  round: number,
  att: TacticSide,
  def: TacticSide,
  out: TacticPick,
): TacticPick {
  const ia = initiativeOf(att, false);
  const id = initiativeOf(def, true);
  const key = round * 4;
  const rA = wwRoll(seed, P_LAND_TACTIC, region, since, key);
  const rD = wwRoll(seed, P_LAND_TACTIC, region, since, key + 1);
  const rS = wwRoll(seed, P_LAND_TACTIC, region, since, key + 2) % 100;
  attackWeights(att, WA);
  defenseWeights(def, WD);
  const sees = ia !== id && rS < Math.min(100, 50 + Math.abs(ia - id));
  if (sees && ia > id) {
    // The attacker picks second.
    const d = pickWeighted(WD, rD);
    const countered = COUNTERED_BY_DEFENSE[d];
    if (countered >= 0) WA[countered] = 0;
    out.def = d;
    out.att = pickWeighted(WA, rA);
  } else if (sees) {
    // The defender picks second.
    const a = pickWeighted(WA, rA);
    const c = COUNTER_OF_ATTACK[a];
    out.att = a;
    out.def = c >= 0 && WD[c] > 0 ? c : pickWeighted(WD, rD);
  } else {
    out.att = pickWeighted(WA, rA);
    out.def = pickWeighted(WD, rD);
  }
  return out;
}

// ---- Daily luck (design §2.1) ----

/** The attack of a side is multiplied by 1 + luck, luck within ± this many bp. */
export const LUCK_MAX_BP = 1000;

/**
 * A side's luck for a day of the battle, bp in −1000..+1000: the sum of two
 * rolls, so triangular around 0 (side 0: the attacker, 1: the defender).
 */
export function luckBp(
  seed: number,
  region: number,
  since: number,
  day: number,
  side: number,
): number {
  const k = day * 4 + side * 2;
  const a = wwRoll(seed, P_LAND_LUCK, region, since, k) % (LUCK_MAX_BP + 1);
  const b = wwRoll(seed, P_LAND_LUCK, region, since, k + 1) % (LUCK_MAX_BP + 1);
  return a + b - LUCK_MAX_BP;
}

// ---- Reserves (design §2.4) ----

/** Most a reserve division's chance to enter a free slot can be, percent. */
export const REINF_MAX_PCT = 70;

/**
 * 25 % + initiative ÷ 4 + a signal company 10 + the infiltration points
 * (attacker +15, defender −10 against it), within 0..70.
 */
export function reinfPctOf(
  initiative: number,
  signal: boolean,
  infiltrationPp: number,
): number {
  const p =
    25 + Math.floor(initiative / 4) + (signal ? 10 : 0) + infiltrationPp;
  return Math.max(0, Math.min(REINF_MAX_PCT, p));
}

/** 0..99, one division's roll for the round (the division enters when it is under its chance). */
export function reinfRoll(
  seed: number,
  region: number,
  since: number,
  round: number,
  id: number,
): number {
  return (
    wwRoll(
      seed,
      P_LAND_REINF,
      region ^ Math.imul(id, 0x9e3779b1),
      since,
      round,
    ) % 100
  );
}

// ---- predictBattleRange's two bounds (design §2.6) ----

/**
 * Bad case: our tactic is countered (no effect) and the defender takes the
 * counter that countered it most often, ambush (its own +15 % attack).
 */
export const RANGE_LOW_DEF_ATK_BP = 1500;
/** Good case: our tactic lands in full, shock (+30 % attack), against a plain defence. */
export const RANGE_HIGH_ATT_ATK_BP = 3000;
