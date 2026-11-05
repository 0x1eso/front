// World War 1936 P2: the combat rules (P2 spec §9.2–§9.4, §9.9). The
// engine's battle lane, the AI, the attack preview and the battle card call
// the same pure integer functions.
import { FM_TRAITS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BattleCtx,
  BattlePrediction,
  BattleRange,
  CombatMods,
  LandTerrain,
  ModLine,
  SideSum,
  TPL_AMPHIBIOUS,
  TPL_ARMOR_ANY,
  TPL_BARE_ARMOR,
  TPL_CAVALRY_MAJOR,
  TPL_ENGINEER,
  TPL_FLAIL,
  TPL_FLAME,
  TPL_FOOT_MAJOR,
  TPL_HEAVY_LEAD,
  TPL_INFANTRY_DIV,
  TPL_MARINE_ANY,
  TPL_MARINE_MAJOR,
  TPL_MOTOR_ANY,
  TPL_MOUNTAIN_MAJOR,
  TPL_PARA_ANY,
  TPL_RECON,
  TPL_SUPPORT_AA,
  TPL_SUPPORT_AT,
  TPL_SUPPORT_GUNS,
  TPL_TANK_FORCE,
  TPL_TD_DEFEND,
  traitBit,
  WW_ROUND_HOUR_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { FM_TRAIT_STATS } from "./CommandRules";
import { NAT_ALPINI_OBSTACLE_PCT, NAT_UNIT_ITA } from "./NationalUnits";
import {
  RANGE_HIGH_ATT_ATK_BP,
  RANGE_LOW_DEF_ATK_BP,
  RANGE_LUCK_BP,
} from "./TacticRules";
import { TechTotals } from "./WwTechs";

/** A P6 stat of a TechTotals that is the country's WwStats (0 when absent: a neutral tech). */
function stat(t: TechTotals, k: WwStatKey): number {
  return (t as unknown as Partial<WwStats>)[k] ?? 0;
}

export interface TerrainDef {
  width: number;
  perDirection: number;
}

// Spec §7.2. ww84 (owner): terrain decides nothing. No attack cut, no extra
// distance, no supply cost; every region has the one width (rivers, straits
// and forts are what is left of the ground).
const ONE_WIDTH: TerrainDef = { width: 90, perDirection: 45 };
export const TERRAIN: Readonly<Record<LandTerrain, TerrainDef>> = {
  plains: ONE_WIDTH,
  desert: ONE_WIDTH,
  forest: ONE_WIDTH,
  hills: ONE_WIDTH,
  mountain: ONE_WIDTH,
  marsh: ONE_WIDTH,
  jungle: ONE_WIDTH,
  urban: ONE_WIDTH,
};

/**
 * Spec §9.4 river penalties on the attack, bp, by edge river (0 none, 1
 * small, 2 big). Task 11 (controller ruling 7): a third of the land edges
 * carry a small river (23%, any Natural Earth river within 2 tiles of 40%
 * of the border) and only a part of an attack crosses it, so a small
 * river costs −10% (was −20%, HOI4 −30% per province crossed); a big
 * river (Rhine, Vistula, Danube, Volga…: 12% of the edges) keeps −40%.
 */
export const RIVER_ATTACK_BP: readonly [number, number, number] = [
  0, -1000, -4000,
];

/**
 * Spec §9.4 fort penalty on the attack, bp per fort level of the defended
 * region (engineers take a quarter off). Task 11 (내 판단): −15% a level
 * (was −12%): with −12% ten 1940 German divisions broke three entrenched
 * French divisions behind a level-5 fort in two days (spec §19.3 wants
 * the Maginot to hold). ww7 lane F: −17% (was −15%): design §5's 50 % only
 * at 5:1 with guns and engineers; −85% at level 5, −64% with engineers.
 */
export const FORT_ATTACK_BP = -1700;

/**
 * ww7: defence per entrenchment level, bp (was 300; ww6 design §5). ww90: 25 %
 * (was 5 %): with no ground left to hide in, a dug-in line is what holds. Three
 * to one with guns takes it two times in three (plan section 6).
 */
export const ENTRENCH_DEF_BP = 2500;
/** ww98 (owner): the levels at the full rate; each one above gives this, bp. */
export const ENTRENCH_FULL_LEVELS = 5;
export const ENTRENCH_DEEP_BP = 1250;

/** ww98: what `level` levels of entrenchment are worth together, bp. */
export function entrenchBp(level: number): number {
  return level <= ENTRENCH_FULL_LEVELS
    ? level * ENTRENCH_DEF_BP
    : ENTRENCH_FULL_LEVELS * ENTRENCH_DEF_BP +
        (level - ENTRENCH_FULL_LEVELS) * ENTRENCH_DEEP_BP;
}

/** ww7: defence per position level (Positions.ts), bp. Equal to a level of entrenchment: predictBattle counts levels by it. */
export const POSITION_DEF_BP = 2500;

/**
 * ww98 (owner): what the support companies do. Each works for its own division
 * only, the attackers' on that division's hits, the defenders' on what that
 * division takes, so a line of them never adds up past the figure here.
 */
/** Engineers attacking: the share of the enemy's entrenchment and position gone, ‰, and its cap with research (engineerMulPct). */
export const ENGINEER_PREP_CUT_PM = 300;
export const ENGINEER_PREP_CUT_MAX_PM = 500;
/** Recon attacking: the share of the enemy's position gone, ‰, after the engineers'. */
export const RECON_POSITION_CUT_PM = 100;
/** Recon on either side: what the battle card's luck and tactic bounds keep, %. */
export const RECON_RANGE_PCT = 50;
/** Support guns: rounds of fire a level of the enemy's entrenchment takes (the whole line firing), and the levels a battle can wear. */
export const ENTRENCH_WEAR_ROUNDS = 8;
export const ENTRENCH_WEAR_MAX = 3;
/** Support anti-tank: the share of the tank fear its division takes, %. */
export const SUPPORT_AT_FEAR_PCT = 50;
/** Support anti-air: what its division takes of close air support and of the air superiority penalty, %. */
export const SUPPORT_AA_CAS_PCT = 80;
export const SUPPORT_AA_AIR_PCT = 75;
/** Field hospital: the share of attrition its division takes, %. */
export const HOSPITAL_ATTRITION_PCT = 75;
/** Logistics: the share of its division's fuel it burns, %. */
export const LOGISTICS_FUEL_PCT = 90;

/** ww98: a division's engineers against prepared ground, ‰: research scales it (`mulPct`), up to the cap. */
export function engineerCutPm(flags: number, mulPct: number): number {
  return has(flags, TPL_ENGINEER)
    ? Math.min(
        ENGINEER_PREP_CUT_MAX_PM,
        Math.floor((ENGINEER_PREP_CUT_PM * Math.max(0, 100 + mulPct)) / 100),
      )
    : 0;
}
/** ww84: marines recover org at this percent of the normal rate for this many days after a landing. */
export const MARINE_LANDED_RECOVERY_PCT = 150;
export const MARINE_LANDED_DAYS = 3;

/** ww84: assault infantry's breakthrough when it attacks, bp. */
export const ASSAULT_BREAK_BP = 2000;
/** ww84: the share of the river and fort penalties assault infantry pays, percent. */
export const ASSAULT_OBSTACLE_PCT = 85;

/** ww7: a defended region with a fort of this level or more halves the extra width of the attack directions. */
export const FORT_HALF_WIDTH_FROM = 3;

/**
 * Spec §9.2: base width plus one step for every direction after the first
 * (1..4). ww7: against a fort of level FORT_HALF_WIDTH_FROM or more (`fort`,
 * the defended region's) those extra steps count half (floor).
 */
export function combatWidth(
  land: LandTerrain,
  directions: number,
  fort = 0,
): number {
  const t = TERRAIN[land];
  const extra = t.perDirection * (Math.max(1, Math.min(4, directions)) - 1);
  return (
    t.width + (fort >= FORT_HALF_WIDTH_FROM ? Math.floor(extra / 2) : extra)
  );
}

export function applyBp(x: number, bp: number): number {
  return Math.floor((x * bp) / 10_000);
}

/** Spec §9.3-2: soft against the soft share of the target, hard against its hardness (centi). */
export function attackValue(
  soft: number,
  hard: number,
  targetHardnessPm: number,
): number {
  const h = Math.max(0, Math.min(1000, targetHardnessPm));
  return Math.floor((soft * (1000 - h) + hard * h) / 1000);
}

/**
 * Spec §9.3-4: hits an hour, centi: 10% of the attack within the block value,
 * 40% of the rest. ww7 lane F: `prepBp` is the defender's prepared ground
 * (entrenchment and positions, +5 % a level, and the hold tactic): the hits
 * inside the block land ÷ (1 + prep). A division's attack rarely passes its
 * target's block (1936 infantry: 138 against 261), and then a bigger block
 * alone would change nothing: an entrenched line took what an open one did.
 */
export function roundHits(attack: number, block: number, prepBp = 0): number {
  const a = Math.max(0, attack);
  const d = Math.max(0, block);
  const inside = 10 * Math.min(a, d);
  return Math.floor(
    ((prepBp > 0 ? Math.floor((inside * 10_000) / (10_000 + prepBp)) : inside) +
      40 * Math.max(0, a - d)) /
      100,
  );
}

/**
 * ww7 lane F: org and HP a hit takes, thousandths (spec §9.3-6: 130 and 90).
 * At the spec's numbers a 2:1 attack on a prepared line was over in two days
 * (design §5 wants 4–7) and a whole band in one or two; both are cut alike,
 * so what a battle costs in men is what it was and only the pace changes.
 */
export const ORG_PER_HIT_E3 = 52;
export const HP_PER_HIT_E3 = 36;

/** ww84: the org damage a foot division takes defending, and tanks with no infantry, %. */
export const FOOT_DEFENCE_ORG_PCT = 82;
export const BARE_ARMOR_ORG_PCT = 125;

/** ww91: the share of a division's casualties that return to the pool, %: 20 (50 with a hospital) plus the stat, within 0..100 (a negative stat cuts it). */
export function casualtyReturnShare(hospital: boolean, pp: number): number {
  return Math.max(0, Math.min(100, (hospital ? 50 : 20) + pp));
}

/** ww90: what armour with no infantry loses of its attack defending, bp, and the share of its hardness that counts then, %. */
export const BARE_DEFENCE_ATTACK_CUT_BP = 6500;
export const BARE_HARDNESS_PCT = 50;

/** ww90: how hard a defender with `flags` is to hit: tanks with no infantry are reached at close quarters. */
export function defenderHardnessPm(hardnessPm: number, flags: number): number {
  return has(flags, TPL_BARE_ARMOR)
    ? Math.floor((hardnessPm * BARE_HARDNESS_PCT) / 100)
    : hardnessPm;
}

/** ww84: what a defender with `flags` takes of the org damage dealt to it, %. */
export function defenderOrgPct(flags: number, footPp = 0): number {
  return has(flags, TPL_BARE_ARMOR)
    ? BARE_ARMOR_ORG_PCT
    : has(flags, TPL_FOOT_MAJOR)
      ? FOOT_DEFENCE_ORG_PCT + footPp
      : 100;
}

/** ww84: what a trench takes off a tank's protection, ‰ a level, at most. */
export const TRENCH_ANTI_TANK_PM = 50;
export const TRENCH_ANTI_TANK_MAX_PM = 250;

/** ww84: rounds of the next band that armour running through ignores trenches, and what it costs the enemy's reserves, points. */
export const EXPLOIT_ROUNDS = 4;
export const EXPLOIT_RESERVE_PP = -20;
/** ww84: the org a division needs left to run through, percent of its maximum. */
export const EXPLOIT_ORG_PCT = 50;
/** ww84: its pace into a taken region, percent; light tanks' more. */
export const EXPLOIT_ADVANCE_PCT = 200;
export const EXPLOIT_ADVANCE_LIGHT_PCT = 250;

/**
 * ww90: what a blitz is worth to the prediction, on the tanks' share of the
 * attackers: armour picks it about half the time, +35 % attack and half the
 * trench, and predictBattle reads no tactics. A trench deep enough to stop
 * infantry made tanks read far worse than they fought (0.72 won six in ten).
 */
const BLITZ_ATTACK_BP = 1500;
const BLITZ_PREP_CUT_PM = 250;

/** ww84: the rounds of a band its attackers' guns open with. */
export const PREP_FIRE_ROUNDS = 8;
/** ww84: what heavy tanks take off the enemy's prepared ground and forts, ‰ and percent kept. */
export const HEAVY_PREP_CUT_PM = 250;
/** ww90: tanks with their motorized roll over a part of a trench that stops infantry, ‰. */
export const TANK_PREP_CUT_PM = 400;
export const HEAVY_FORT_PCT = 75;

/** ww84: `keepPm` of the prepared ground, less the share a barrage of `fireBp` takes. */
function keepAfterFire(keepPm: number, fireBp: number): number {
  return Math.floor((keepPm * (10_000 - fireBp)) / 10_000);
}

/**
 * ww84: the share of a defender's prepared ground, ‰, that counts against a
 * division with `flags` whose barrage is at `fireBp` this round.
 */
export function prepKeepPm(flags: number, fireBp: number): number {
  return keepAfterFire(
    1000 -
      (has(flags, TPL_TANK_FORCE) ? TANK_PREP_CUT_PM : 0) -
      (has(flags, TPL_HEAVY_LEAD) ? HEAVY_PREP_CUT_PM : 0),
    fireBp,
  );
}

/**
 * ww98: what is left of a defender's prepared ground `prepBp` (position `posBp`
 * of it) against a division with `flags`: what prepKeepPm keeps, less its
 * engineers' share (`cutPm`), and of the position its recon's as well. Each cut
 * works on what the last one left.
 */
export function prepLeftBp(
  prepBp: number,
  posBp: number,
  flags: number,
  fireBp: number,
  cutPm: number,
): number {
  const keep = Math.floor((prepKeepPm(flags, fireBp) * (1000 - cutPm)) / 1000);
  const left = Math.floor((prepBp * keep) / 1000);
  return has(flags, TPL_RECON)
    ? left - Math.floor((posBp * keep * RECON_POSITION_CUT_PM) / 1_000_000)
    : left;
}

/** ww84: entrenched foot get at tanks close up: ‰ off the protection of what they hit. */
export function trenchCutPm(flags: number, levels: number): number {
  return has(flags, TPL_FOOT_MAJOR)
    ? Math.min(TRENCH_ANTI_TANK_MAX_PM, TRENCH_ANTI_TANK_PM * levels)
    : 0;
}

/** ww84: what tanks do to defenders with nothing to stop them, extra org damage, %. */
export const TANK_FEAR_PCT = 30;

/** The side's best pierce with something left to fire it. */
function bestPierce(
  pierce: readonly number[],
  hard: readonly number[],
): number {
  let best = 0;
  for (let i = 0; i < hard.length; i++) {
    if (hard[i] > 0 && pierce[i] > best) best = pierce[i];
  }
  return best;
}

/** ww84: the points anti-tank research takes off the tank fear penalty. */
export function tankFearCutPp(tech: TechTotals): number {
  return stat(tech, "tankFearCutPp");
}

/**
 * ww84: tank fear, extra org damage % a defender takes from an armour-major
 * attacker when its best pierce is at most a third of the attacker's armour,
 * less `cutPp` (anti-tank research).
 */
export function tankFearPct(
  bandPierce: readonly number[],
  bandHard: readonly number[],
  attackerArmor: number,
  cutPp: number,
): number {
  if (
    attackerArmor <= 0 ||
    bestPierce(bandPierce, bandHard) * 3 > attackerArmor
  ) {
    return 0;
  }
  return Math.max(0, TANK_FEAR_PCT - cutPp);
}

/** ww98: what a defender with `flags` takes of `fearPct`: support anti-tank halves it. */
export function fearTakenPct(fearPct: number, flags: number): number {
  return has(flags, TPL_SUPPORT_AT)
    ? Math.floor((fearPct * SUPPORT_AT_FEAR_PCT) / 100)
    : fearPct;
}

/** ww84: what armour stops of the hard part of a hit, ‰, with pierce at or below a third of it. */
export const ARMOR_PROTECT_MAX_PM = 850;
/** ww84: and at two thirds of it; nothing at pierce equal to it. */
export const ARMOR_PROTECT_MID_PM = 500;
/** ww90 (owner): under this armour, centi, a light vehicle never stops more than the middle share. */
export const ARMOR_FULL_PROTECT_FROM = 2000;

/**
 * ww90 (owner): armour after its research percent: a light vehicle the research
 * would lift to the line takes half of it. Plate on a Pz I isn't a Pz III.
 */
export function researchedArmor(armor: number, pct: number): number {
  const full = Math.floor((armor * (100 + pct)) / 100);
  return armor < ARMOR_FULL_PROTECT_FROM && full >= ARMOR_FULL_PROTECT_FROM
    ? Math.floor((armor * (200 + pct)) / 200)
    : full;
}

/**
 * Spec §9.3-5, ww84: the share of a hard hit armour stops, ‰: 850 up to pierce
 * a third of the armour, falling in a straight line to 500 at two thirds and to
 * nothing at pierce equal to it. How armoured the target is shows elsewhere:
 * the soft part of a hit goes through (hitProtectPm). ww90: a light vehicle,
 * under ARMOR_FULL_PROTECT_FROM, stops the middle share at most: rifles at close
 * range still hurt a Pz I or an armoured car.
 */
export function armorProtectPm(armor: number, pierce: number): number {
  if (armor <= 0 || pierce >= armor) return 0;
  const p3 = pierce * 3;
  if (p3 > 2 * armor) {
    return Math.floor((ARMOR_PROTECT_MID_PM * (3 * armor - p3)) / armor);
  }
  if (armor < ARMOR_FULL_PROTECT_FROM) return ARMOR_PROTECT_MID_PM;
  return p3 <= armor
    ? ARMOR_PROTECT_MAX_PM
    : ARMOR_PROTECT_MAX_PM -
        Math.floor(
          ((ARMOR_PROTECT_MAX_PM - ARMOR_PROTECT_MID_PM) * (p3 - armor)) /
            armor,
        );
}

/**
 * ww84: what armour stops of a division's hard attack, ‰: each pierce band
 * against the armour on its own, weighted by its hard attack. `cutPm` comes
 * off every band's protection.
 */
export function bandProtectPm(
  pierce: readonly number[],
  hard: readonly number[],
  armor: number,
  cutPm = 0,
): number {
  if (armor <= 0) return 0;
  let sum = 0;
  let all = 0;
  for (let i = 0; i < hard.length; i++) {
    const h = hard[i];
    if (h <= 0) continue;
    all += h;
    sum += h * Math.max(0, armorProtectPm(armor, pierce[i]) - cutPm);
  }
  return all === 0 ? 0 : Math.floor(sum / all);
}

/**
 * ww84: the share of a whole hit armour stops, ‰: a hit is split as the attack
 * value is (attackValue), soft goes through, the hard part meets the armour.
 */
export function hitProtectPm(
  soft: number,
  hard: number,
  targetHardnessPm: number,
  hardProtectPm: number,
): number {
  if (hardProtectPm <= 0) return 0;
  const h = Math.max(0, Math.min(1000, targetHardnessPm));
  const hardPart = hard * h;
  const all = soft * (1000 - h) + hardPart;
  return all <= 0 ? 0 : Math.floor((hardProtectPm * hardPart) / all);
}

/**
 * Spec §9.3-6: one round (1.829 HOI4 hours) of damage from `hitsCenti`:
 * ORG_PER_HIT_E3 org and HP_PER_HIT_E3 HP a hit, less the share `protectPm`
 * armour stops (armorProtectPm).
 */
export function roundDamage(
  hitsCenti: number,
  protectPm = 0,
): { orgMilli: number; hpMilli: number } {
  let org = Math.floor(
    (hitsCenti * WW_ROUND_HOUR_MILLI * ORG_PER_HIT_E3) / 100_000,
  );
  let hp = Math.floor(
    (hitsCenti * WW_ROUND_HOUR_MILLI * HP_PER_HIT_E3) / 100_000,
  );
  if (protectPm > 0) {
    org = Math.floor((org * (1000 - protectPm)) / 1000);
    hp = Math.floor((hp * (1000 - protectPm)) / 1000);
  }
  return { orgMilli: org, hpMilli: hp };
}

/** Spec §9.4: (100 + Σadds) × (100 + Σcuts) with the cuts stopping at −90%; bp. */
export function combineMods(
  adds: readonly number[],
  cuts: readonly number[],
): number {
  let up = 0;
  for (const a of adds) up += a;
  let down = 0;
  for (const c of cuts) down += c;
  down = Math.max(-9000, down);
  return Math.floor(((10_000 + up) * (10_000 + down)) / 10_000);
}

/** ww67: the most an overfull line loses, bp (the owner's terrain cap). */
export const EXCESS_WIDTH_MAX_BP = 1000;

/** Spec §9.2: −2% attack for every 1% of width over the line; ww67: at most −10 %. */
export function excessWidthBp(usedWidth: number, width: number): number {
  const over = Math.max(0, usedWidth - width);
  // (0, not −0, when the line fits.)
  return width <= 0 || over === 0
    ? 0
    : -Math.min(EXCESS_WIDTH_MAX_BP, Math.floor((over * 20_000) / width));
}

/** Spec §5.4: recruit, regular, veteran, elite. */
export function expBp(exp: number): number {
  return exp < 250 ? 0 : exp < 500 ? 500 : exp < 750 ? 1000 : 2000;
}

/** 2^times for the halvings (0..3): a table, no `**` (determinism rules). */
const POW2: readonly number[] = [1, 2, 4, 8];

/** Halves a negative bp `times` times, toward zero. */
function halve(bp: number, times: number): number {
  return -Math.floor(-bp / POW2[Math.max(0, Math.min(3, times))]);
}

export interface ModInput {
  /** The division attacks (from a neighbour, or dropped into the region) or defends. */
  attacking: boolean;
  /** The army's general (0s when none): attack and defence skill, trait mask. */
  genAtt: number;
  genDef: number;
  traits: number;
  /** TemplateStats flags. */
  flags: number;
  tech: TechTotals;
  exp: number;
  /** The army's readiness when the division fights in or from its front region; else 0. */
  planBp: number;
  /** Attacker only: the edge it attacks over (0 when dropped in), the region's fort level. */
  river: 0 | 1 | 2;
  strait: boolean;
  fort: number;
  /** Defender only: its own entrenchment level. */
  entrench: number;
  /**
   * ww7, defender only: the level (0..3) of the position its side has built
   * in the region (Positions.ts). Absent (the screens' inputs): 0.
   */
  posLevel?: number;
  /** Its side's excess-width penalty, bp ≤ 0. */
  excessBp: number;
  supplyPm: number;
  encircled: boolean;
  // P4 (pre-flight ruling 3): cuts from the navy and air war, bp ≤ 0, read
  // from the hooks in modInputOf (and from the views on the battle card).
  /** Spec §14.6: the worst enemy air superiority over the battle (attack and defense). */
  airBp: number;
  /** Spec §15.4: yesterday's fuel shortage on the fuel battalions (attack and defense). */
  fuelBp: number;
  /** Spec §11.4, a landing division attacking: the landing and the coastal fort. */
  landingBp: number;
  coastalFortBp: number;
  /** Spec §11.4, a defender: the enemy's shore bombardment. */
  shoreBp: number;
  // P6 (pre-flight §0-2): always present, flat, O(1) reads of values the
  // depth systems store on their days, so modsOf's cache stays exact and
  // the battle card shows the engine's lines.
  /** Spec §4.3: the army group's field marshal (0s when none): attack and defence skill, FM_TRAITS mask. */
  fmAtt: number;
  fmDef: number;
  fmTraits: number;
  /** Spec §4.4, §4.5, §8.7: officer corps, medal and decryption of the army, bp. */
  cmdAttBp: number;
  cmdDefBp: number;
  /** The enemy's cut of this division's readiness (recon, trickster), bp ≤ 0. */
  enemyPlanCutBp: number;
  /** Spec §16.5: railway guns' fort level cut (attacker), levels. */
  fortCut: number;
  /** Spec §4.2 guerrilla_fighter on the army group: supply penalties halved. */
  halfSupply: boolean;
  /** TPL_FLAME … TPL_TD_DEFEND of the designs the division holds (DivisionStats.designFlags). */
  designFlags: number;
  /** The share of its soft attack its artillery carries, ‰ (artillery_officer). */
  artSoftPm: number;
  /**
   * Review L4 (preflight §D "fm_plan"): the part of the army's readiness
   * above the country's cap that its field marshal's planMaxBp allows, bp
   * ≥ 0 (planBp holds the rest). Shown as its own line, "fm_plan".
   */
  fmPlanBp: number;
  /**
   * ww7 lane A (design §2.2 blitz): the defender's entrenchment counts half
   * (the attacker's blitz is in play and not countered). Always set by
   * modInputOf so the mods cache sees it.
   */
  halfEntrench?: boolean;
}

export interface ModResult {
  mods: CombatMods;
  attackLines: ModLine[];
  defenseLines: ModLine[];
}

const has = (mask: number, bit: number) => (mask & bit) !== 0;
const TB = (t: Parameters<typeof traitBit>[0]) => traitBit(t);

/**
 * Spec §9.4 (and §4.2 companies, §6.2 traits, §11.5 encirclement): a
 * division's attack and defence modifiers in one battle. ww84: the ground and
 * the weather are not among them. "defense" multiplies its block value (defence
 * when it defends, breakthrough when it attacks).
 */
export function divisionMods(i: ModInput): ModResult {
  const aAdd: ModLine[] = [];
  const aCut: ModLine[] = [];
  const dAdd: ModLine[] = [];
  const dCut: ModLine[] = [];
  const push = (l: ModLine[], id: string, bp: number) => {
    if (bp !== 0) l.push({ id, bp });
  };
  // ww84: assault infantry pays a sixth less for rivers and forts.
  // ww91: the Italian Alpini pay a little less still.
  const assault = has(i.flags, TPL_MOUNTAIN_MAJOR)
    ? i.tech.natUnit === NAT_UNIT_ITA
      ? NAT_ALPINI_OBSTACLE_PCT
      : ASSAULT_OBSTACLE_PCT
    : 100;
  // Attack
  push(aAdd, "general", i.genAtt * 500);
  let trait = 0;
  if (
    has(i.traits, TB("panzer_leader")) &&
    has(i.flags, TPL_ARMOR_ANY | TPL_MOTOR_ANY)
  ) {
    trait += 1000;
  }
  if (has(i.traits, TB("infantry_officer")) && has(i.flags, TPL_INFANTRY_DIV)) {
    trait += 500;
  }
  if (has(i.traits, TB("cavalry_officer")) && has(i.flags, TPL_CAVALRY_MAJOR)) {
    trait += 1000;
  }
  if (has(i.traits, TB("offensive_doctrine"))) trait += 500;
  // P6 (spec §4.2): the new general traits.
  if (has(i.traits, TB("infantry_expert")) && has(i.flags, TPL_INFANTRY_DIV)) {
    trait += 1000;
  }
  if (has(i.traits, TB("armor_expert")) && has(i.flags, TPL_ARMOR_ANY)) {
    trait += 1000;
  }
  // (An approximation: the share of the division's soft attack its
  // artillery carries, in bp, on the whole attack line.)
  if (has(i.traits, TB("artillery_officer"))) trait += i.artSoftPm;
  if (
    has(i.traits, TB("commando")) &&
    has(i.flags, TPL_MOUNTAIN_MAJOR | TPL_MARINE_MAJOR | TPL_PARA_ANY)
  ) {
    trait += 1000;
  }
  if (has(i.traits, TB("ambusher")) && !i.attacking) trait += 1500;
  push(aAdd, "trait", trait);
  // P6 (spec §4.3, plan decision 14): the field marshal's half skill and
  // traits, the officer corps / medal / decryption line.
  push(aAdd, "field_marshal", i.fmAtt * 250);
  push(aAdd, "fm_trait", fmTraitBp(i.fmTraits, "attackBp"));
  push(aAdd, "command", i.cmdAttBp);
  push(aAdd, "doctrine", i.tech.attackPct * 100);
  push(aAdd, "exp", expBp(i.exp));
  // P6: the enemy's recon and trickster cut the readiness (never below 0);
  // the field marshal's part above the country's cap is its own line.
  const planTotal = Math.max(
    0,
    i.planBp + i.fmPlanBp + Math.min(0, i.enemyPlanCutBp),
  );
  const fmPlanBp = Math.max(0, planTotal - i.planBp);
  const planBp = planTotal - fmPlanBp;
  push(aAdd, "plan", planBp);
  push(aAdd, "fm_plan", fmPlanBp);
  if (i.attacking) {
    // P6 (spec §4.2, §5.2.2, §21.2): engineer officers, amphibious and
    // flail tanks, the river and fort penalty cuts.
    // ww97: Juin's line breaker cuts the same two penalties (not stacked).
    const engOfficer =
      has(i.traits, TB("engineer_officer")) || has(i.traits, TB("line_breaker"))
        ? 85
        : 100;
    const amph = has(i.designFlags, TPL_AMPHIBIOUS);
    if (i.river > 0) {
      const n =
        (has(i.flags, TPL_ENGINEER) ? 1 : 0) +
        (has(i.flags, TPL_MARINE_ANY) || amph ? 1 : 0) +
        (has(i.traits, TB("river_crosser")) ? 1 : 0);
      push(
        aCut,
        "river",
        cutBy(
          cutBy(
            cutBy(
              halve(RIVER_ATTACK_BP[i.river], n),
              100 - stat(i.tech, "riverPenaltyCutPct"),
            ),
            engOfficer,
          ),
          assault,
        ),
      );
    }
    if (i.strait) {
      push(
        aCut,
        "strait",
        has(i.flags, TPL_MARINE_ANY) || amph ? -2500 : -5000,
      );
    }
    const fort = Math.max(0, i.fort - i.fortCut);
    if (fort > 0) {
      let f = -Math.floor(
        (-FORT_ATTACK_BP * fort * (has(i.flags, TPL_ENGINEER) ? 75 : 100)) /
          100,
      );
      if (has(i.designFlags, TPL_FLAIL)) f = cutBy(f, 75);
      if (has(i.flags, TPL_HEAVY_LEAD)) f = cutBy(f, HEAVY_FORT_PCT);
      f = cutBy(f, 100 - stat(i.tech, "fortPenaltyCutPct"));
      push(aCut, "fort", cutBy(cutBy(f, engOfficer), assault));
    }
    if (has(i.designFlags, TPL_FLAME) && fort > 0) {
      push(aAdd, "flame", 1000);
    }
  }
  // P6 (spec §21.2, review L2): excessWidthCutPct shrinks the excess-width penalty.
  push(
    aCut,
    "excess",
    cutBy(i.excessBp, 100 - stat(i.tech, "excessWidthCutPct")),
  );
  let supplyCut = -(1000 - Math.max(0, Math.min(1000, i.supplyPm))) * 5;
  // P6 (spec §4.2 guerrilla_fighter): supply penalties halved. One source:
  // lane D's commandLandMods sets halfSupply for the trait.
  if (i.halfSupply) supplyCut = halve(supplyCut, 1);
  // ww67: a pocket takes its encircled line only. With the supply cut on top
  // it stood at the −90 % floor at once and fell for almost no casualties.
  if (i.encircled) supplyCut = 0;
  push(aCut, "supply", supplyCut);
  push(aCut, "encircled", i.encircled ? -5000 : 0);
  // P4 (spec §14.6, §15.4, §11.4).
  // ww98: support anti-air keeps a part of the enemy's sky off its division.
  const airBp = has(i.flags, TPL_SUPPORT_AA)
    ? cutBy(i.airBp, SUPPORT_AA_AIR_PCT)
    : i.airBp;
  push(aCut, "air", airBp);
  push(aCut, "fuel", i.fuelBp);
  if (i.attacking) {
    push(aCut, "landing", i.landingBp);
    push(aCut, "coastal_fort", i.coastalFortBp);
  }
  // Defence (the block value)
  push(dAdd, "general", i.genDef * 500);
  let dTrait = 0;
  if (has(i.traits, TB("infantry_officer")) && has(i.flags, TPL_INFANTRY_DIV)) {
    dTrait += 500;
  }
  if (has(i.traits, TB("defensive_doctrine"))) dTrait += 1000;
  // P6 (spec §4.2).
  if (has(i.traits, TB("infantry_expert")) && has(i.flags, TPL_INFANTRY_DIV)) {
    dTrait += 1000;
  }
  if (
    has(i.traits, TB("armor_expert")) &&
    i.attacking &&
    has(i.flags, TPL_ARMOR_ANY)
  ) {
    dTrait += 1000;
  }
  push(dAdd, "trait", dTrait);
  push(dAdd, "field_marshal", i.fmDef * 250);
  push(dAdd, "fm_trait", fmTraitBp(i.fmTraits, "defenseBp"));
  push(dAdd, "command", i.cmdDefBp);
  if (!i.attacking && has(i.designFlags, TPL_TD_DEFEND)) {
    push(dAdd, "tank_destroyer", 1000);
  }
  if (i.attacking) {
    const mech = has(i.flags, TPL_ARMOR_ANY | TPL_MOTOR_ANY)
      ? i.tech.mechBreakPct
      : 0;
    push(dAdd, "doctrine", (i.tech.breakthroughPct + mech) * 100);
    // ww84: assault infantry breaks through a fifth harder.
    push(
      dAdd,
      "mountain",
      has(i.flags, TPL_MOUNTAIN_MAJOR) ? ASSAULT_BREAK_BP : 0,
    );
  } else {
    push(dAdd, "doctrine", i.tech.defensePct * 100);
    push(dAdd, "entrench", entrenchBp(i.entrench));
    push(dAdd, "position", (i.posLevel ?? 0) * POSITION_DEF_BP);
    // P6 (spec §21.2): the fort's defence per level (its own region's fort).
    push(dAdd, "fort_def", i.fort * stat(i.tech, "fortDefPerLevelBp"));
  }
  push(dAdd, "exp", expBp(i.exp));
  push(dAdd, "plan", planBp);
  push(dAdd, "fm_plan", fmPlanBp);
  push(dCut, "supply", supplyCut);
  push(dCut, "encircled", i.encircled ? -5000 : 0);
  push(dCut, "air", airBp);
  push(dCut, "fuel", i.fuelBp);
  if (!i.attacking) push(dCut, "shore_bombard", i.shoreBp);
  // ww7 lane A (design §2.2): blitz halves the defender's entrenchment
  // bonus. Lane B2: a new entrenchment-like line (positions) joins
  // ENTRENCH_LINE_IDS to be halved too.
  if (i.halfEntrench === true && !i.attacking) {
    for (const l of dAdd) {
      if (ENTRENCH_LINE_IDS.includes(l.id)) l.bp = Math.floor(l.bp / 2);
    }
  }
  const sum = (l: ModLine[]) => l.map((x) => x.bp);
  let prepBp = 0;
  let posBp = 0;
  for (const l of dAdd) {
    if (PREP_LINE_IDS.includes(l.id)) prepBp += l.bp;
    if (l.id === "position") posBp = l.bp;
  }
  return {
    mods: {
      attackBp: combineMods(sum(aAdd), sum(aCut)),
      defenseBp: combineMods(sum(dAdd), sum(dCut)),
      prepBp,
      posBp,
      defCutMulBp: combineMods([], sum(dCut)),
    },
    attackLines: [...aAdd, ...aCut],
    defenseLines: [...dAdd, ...dCut],
  };
}

/** ww7 lane A: the defence lines a blitz halves (ModInput.halfEntrench). */
const ENTRENCH_LINE_IDS: readonly string[] = ["entrench"];
/** ww7 lane F: the defence lines that are prepared ground (roundHits). */
const PREP_LINE_IDS: readonly string[] = ["entrench", "position"];

/** P6: a negative bp kept at pct% (toward zero). */
function cutBy(bp: number, pct: number): number {
  return -Math.floor((-bp * Math.max(0, pct)) / 100);
}

/** P6 (spec §4.2): the field marshal traits' attack or defence bp. */
export function fmTraitBp(mask: number, k: "attackBp" | "defenseBp"): number {
  if (mask === 0) return 0;
  let bp = 0;
  for (let b = 0; b < FM_TRAITS.length; b++) {
    if ((mask & (1 << b)) !== 0) bp += FM_TRAIT_STATS[FM_TRAITS[b]][k] ?? 0;
  }
  return bp;
}

/** Readiness cap (spec §8.3): 30% (+10%p battleplan_1, + P3 planMaxBp). */
export function planMaxBp(tech: TechTotals): number {
  return 3000 + tech.planMaxBp;
}

/**
 * Entrenchment cap (spec §9.4): 5, +5 engineers, +2 battleplan_2
 * (tech.entrenchMax). ww84: tanks with no infantry dig in half as deep.
 */
export function entrenchMax(flags: number, tech: TechTotals): number {
  const max = 5 + (has(flags, TPL_ENGINEER) ? 5 : 0) + tech.entrenchMax;
  return has(flags, TPL_BARE_ARMOR) ? Math.floor(max / 2) : max;
}

/**
 * P4 spec §14.7: a round's close air support hits, centi, after the target's
 * anti-air (1% a point, at most 60%) and the region's AA (5% a level). ww98:
 * and its support anti-air, by the target's `flags`.
 */
export function casCutHits(
  hits: number,
  targetAirAtk: number,
  aaLevel: number,
  flags = 0,
): number {
  const h = Math.floor((hits * (100 - Math.min(60, targetAirAtk))) / 100);
  const c = Math.floor((h * Math.max(0, 100 - 5 * aaLevel)) / 100);
  return has(flags, TPL_SUPPORT_AA)
    ? Math.floor((c * SUPPORT_AA_CAS_PCT) / 100)
    : c;
}

/**
 * ww84: what armour stops of close air support, ‰: half what it stops of a
 * shot with no pierce to speak of, on the armoured share of the target.
 */
export function casProtectPm(armor: number, hardnessPm: number): number {
  const h = Math.max(0, Math.min(1000, hardnessPm));
  return Math.floor((armorProtectPm(armor, 0) * h) / 2000);
}

/** ww84: what a side under close air support loses of its reserves' chance, points. */
export const CAS_RESERVE_PP = -10;

/** ww84: hitProtectPm from side sums: what `to`'s armour stops of `from`'s hits. */
function sideProtectPm(
  from: SideSum,
  to: SideSum,
  attacking: boolean,
  cutPm = 0,
  hardnessPm = to.hardnessPm,
): number {
  if (to.armor <= 0) return 0;
  const pierce = attacking ? from.bandPierceAtk : from.bandPierce;
  const hard = from.bandHard;
  return hitProtectPm(
    from.soft,
    from.hard,
    hardnessPm,
    pierce === undefined || hard === undefined
      ? Math.max(0, armorProtectPm(to.armor, from.pierce) - cutPm)
      : bandProtectPm(pierce, hard, to.armor, cutPm),
  );
}

/**
 * ww90: the extra org damage a side's tanks do to `def` by fear, %, by their
 * share of its width. ww98: and by the share of `def` whose support anti-tank
 * halves it.
 */
export function sideFearPct(att: SideSum, def: SideSum, cutPp: number): number {
  if (def.bandPierce === undefined || def.bandHard === undefined) return 0;
  const fear = Math.floor(
    (tankFearPct(def.bandPierce, def.bandHard, att.armor, cutPp) *
      (att.armorMajorPm ?? 0)) /
      1000,
  );
  return (
    fear -
    Math.floor(
      (fear * (100 - SUPPORT_AT_FEAR_PCT) * (def.fearHalfPm ?? 0)) / 100_000,
    )
  );
}

/** ww84: a round's org damage to a defending side, by what it is made of and the attackers' tanks. */
function sideDefOrg(
  org: number,
  att: SideSum,
  def: SideSum,
  ctx: BattleCtx,
): number {
  const fear = sideFearPct(att, def, ctx.tankFearCutPp ?? 0);
  return Math.floor((org * ((def.defOrgPct ?? 100) + fear)) / 100);
}

/**
 * Spec §9.9: how fast each side strips the other's org, from side sums.
 * The engine's plan step (§8.2), the AI (§14.4) and the attack preview
 * (§15.3) all call it; the screen passes the army summaries' sums.
 */
export function predictBattle(
  att: SideSum,
  def: SideSum,
  ctx: BattleCtx,
): BattlePrediction {
  if (att.divisions === 0) return { ratioPm: 0, rounds: 0, days: 0 };
  if (def.divisions === 0) return { ratioPm: 1_000_000, rounds: 0, days: 0 };
  const width = combatWidth(ctx.land, ctx.directions, ctx.fort);
  // Divisions in line ×1000: the share of each side the width holds.
  const lineA = Math.min(
    1000 * att.divisions,
    Math.floor((1000 * att.divisions * width) / Math.max(1, att.width)),
  );
  const lineD = Math.min(
    1000 * def.divisions,
    Math.floor((1000 * def.divisions * width) / Math.max(1, def.width)),
  );
  const per = (x: number, n: number) => Math.floor(x / n);
  // ww90: tanks with no infantry fire less and are reached at close quarters.
  const bare = def.barePm ?? 0;
  const defHardnessPm =
    def.hardnessPm -
    Math.floor((def.hardnessPm * (100 - BARE_HARDNESS_PCT) * bare) / 100_000);
  const tanks = att.armorMajorPm ?? 0;
  const aA = applyBp(
    applyBp(
      attackValue(
        per(att.soft, att.divisions),
        per(att.hard, att.divisions),
        defHardnessPm,
      ),
      ctx.attackerAttackBp,
    ),
    10_000 + Math.floor((BLITZ_ATTACK_BP * tanks) / 1000),
  );
  const aD = applyBp(
    applyBp(
      attackValue(
        per(def.soft, def.divisions),
        per(def.hard, def.divisions),
        att.hardnessPm,
      ),
      ctx.defenderAttackBp,
    ),
    10_000 - Math.floor((BARE_DEFENCE_ATTACK_CUT_BP * bare) / 1000),
  );
  const dA = applyBp(per(att.brk, att.divisions), ctx.attackerBlockBp);
  const prepBp = ctx.defenderPrepBp ?? 0;
  // Only the foot on the defending side reach the tanks from a trench.
  const trench = Math.floor(
    (Math.min(
      TRENCH_ANTI_TANK_MAX_PM,
      TRENCH_ANTI_TANK_PM * Math.floor(prepBp / POSITION_DEF_BP),
    ) *
      (def.footPm ?? 0)) /
      1000,
  );
  const toAtt = roundDamage(
    roundHits(aD, dA),
    sideProtectPm(def, att, false, trench),
  ).orgMilli;
  // ww8: close air support, a round's hits on one division with no block value.
  const casDef = ctx.casAttCenti ?? 0;
  const casAtt = ctx.casDefCenti ?? 0;
  const casOrg =
    casDef > 0
      ? Math.floor(
          (roundDamage(casDef, casProtectPm(def.armor, def.hardnessPm))
            .orgMilli *
            (def.defOrgPct ?? 100)) /
            100,
        )
      : 0;
  // A round's org off the defenders with `fireBp` of barrage, `keepPm` of
  // their prepared ground left and `wornBp` of it gone to the guns for good.
  const perDef = per(def.def, def.divisions);
  const cutMul = ctx.defenderCutMulBp ?? 10_000;
  const posBp = ctx.defenderPosBp ?? 0;
  const reconCut = att.reconCutPm ?? 0;
  const roundOnDef = (
    fireBp: number,
    keepPm: number,
    wornBp: number,
  ): number => {
    const prep =
      Math.floor(((prepBp - wornBp) * keepPm) / 1000) -
      Math.floor((posBp * keepPm * reconCut) / 1_000_000);
    const block =
      ctx.defenderBlockBp - Math.floor(((prepBp - prep) * cutMul) / 10_000);
    const toDef = sideDefOrg(
      roundDamage(
        roundHits(
          fireBp > 0 ? applyBp(aA, 10_000 + fireBp) : aA,
          applyBp(perDef, block),
          prep,
        ),
        sideProtectPm(att, def, true, 0, defHardnessPm),
      ).orgMilli,
      att,
      def,
      ctx,
    );
    return Math.floor((toDef * lineA) / 1000) + casOrg;
  };
  const heavyKeep = Math.floor(
    ((((1000 -
      Math.floor(
        (HEAVY_PREP_CUT_PM * (att.heavyPm ?? 0) + TANK_PREP_CUT_PM * tanks) /
          1000,
      )) *
      (1000 - Math.floor((BLITZ_PREP_CUT_PM * tanks) / 1000))) /
      1000) *
      (1000 - (att.engineerCutPm ?? 0))) /
      1000,
  );
  const fire = att.prepFireBp ?? 0;
  const fireRounds = fire > 0 ? (ctx.prepFireRounds ?? PREP_FIRE_ROUNDS) : 0;
  const exploitRounds = ctx.exploitRounds ?? 0;
  // ww98: the guns' wear, a level every `wearEvery` rounds while there's any.
  const level = ctx.defenderEntrench ?? 0;
  const wearPm = att.wearPm ?? 0;
  const wearLevels =
    wearPm > 0
      ? Math.min(level, ENTRENCH_WEAR_MAX - (ctx.wornLevels ?? 0))
      : 0;
  const wearEvery =
    wearLevels > 0
      ? Math.ceil((ENTRENCH_WEAR_ROUNDS * 1000) / Math.max(1, wearPm))
      : 0;
  let rounds: number;
  let dmgDef: number;
  if (fireRounds === 0 && exploitRounds === 0 && wearLevels <= 0) {
    dmgDef = roundOnDef(0, heavyKeep, 0);
    rounds = dmgDef <= 0 ? 999_999 : Math.ceil(def.orgMilli / dmgDef);
  } else {
    // ww84: the rounds as they will go: each stretch runs to the next change.
    let org = def.orgMilli;
    let n = 0;
    while (org > 0) {
      const firing = n < fireRounds;
      const running = n < exploitRounds;
      const worn = wearEvery > 0 ? Math.floor(n / wearEvery) : 0;
      const k = Math.min(wearLevels, worn);
      let next = 0;
      if (firing) next = fireRounds;
      if (running && (next === 0 || exploitRounds < next)) next = exploitRounds;
      if (k < wearLevels && (next === 0 || (k + 1) * wearEvery < next)) {
        next = (k + 1) * wearEvery;
      }
      const dmg = roundOnDef(
        firing ? fire : 0,
        running ? 0 : firing ? keepAfterFire(heavyKeep, fire) : heavyKeep,
        k > 0 ? entrenchBp(level) - entrenchBp(level - k) : 0,
      );
      if (next === 0) {
        n = dmg <= 0 ? 999_999 : n + Math.ceil(org / dmg);
        break;
      }
      const length = next - n;
      if (dmg * length >= org) {
        n += Math.ceil(org / Math.max(1, dmg));
        break;
      }
      n = next;
      org -= dmg * length;
    }
    rounds = n;
    dmgDef = rounds >= 999_999 ? 0 : Math.floor(def.orgMilli / rounds);
  }
  const dmgAtt =
    Math.floor((toAtt * lineD) / 1000) +
    (casAtt > 0
      ? roundDamage(casAtt, casProtectPm(att.armor, att.hardnessPm)).orgMilli
      : 0);
  const ratioPm =
    dmgAtt <= 0
      ? 1_000_000
      : Math.floor(
          (dmgDef * att.orgMilli * 1000) / (dmgAtt * Math.max(1, def.orgMilli)),
        );
  return { ratioPm, rounds, days: Math.ceil((rounds * 2) / 15) };
}

/**
 * ww7 lane A (design §2.6): the attacker's chance to win, percent, read from
 * the org-removal ratio ‰ of predictBattle / predictBattleRange (≥ 1000: on
 * average the attacker strips the defender first). The ratio is only the
 * expected value: the tactics, the daily luck and the reserves of a real
 * battle (TacticRules) spread the outcomes around it, and this table is how
 * often the attacker really wins at that ratio.
 *
 * WIN_PCT_AT[k] is the win percent at the ratio WIN_RATIO_AT_PM[k], the
 * quarter-octaves 1000 × 2^(k/4) ‰ for k = -16…16 (1/16 … 16); between two
 * entries the percent is interpolated in the ratio, outside them it is the
 * end entry, and a ratio of 0 or less is 0 and of 1,000,000 or more 100.
 *
 * To refit (after a change to the battle rules: tactics, luck, widths, the
 * damage tables…): `npx tsx scripts/ww1936/duel-fit.ts` plays 2,000 seeded
 * duels through the engine's real `fight` (varied sizes, templates, terrain,
 * rivers, forts, entrenchment, one or two directions), buckets them by the
 * predicted ratio's log, fits a monotone curve (pool adjacent violators) and
 * prints WIN_PCT_AT; paste it here. The fit is deterministic (seed 1). The
 * current table (ww90, `--duels 4000`, tank and anti-tank divisions in the
 * draw): the even fight is won a little under half the time, 1.2 four in five,
 * 1.4 nine in ten, 2 nearly always, 0.7 one in ten.
 */
export const WIN_RATIO_AT_PM: readonly number[] = [
  63, 74, 88, 105, 125, 149, 177, 210, 250, 297, 354, 420, 500, 595, 707, 841,
  1000, 1189, 1414, 1682, 2000, 2378, 2828, 3364, 4000, 4757, 5657, 6727, 8000,
  9514, 11314, 13454, 16000,
];
export const WIN_PCT_AT: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 10, 23, 46, 82, 88, 97, 99, 100,
  100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
];

export function winPctOf(ratioPm: number): number {
  if (ratioPm <= 0) return 0;
  if (ratioPm >= 1_000_000) return 100;
  const e = WIN_RATIO_AT_PM;
  const w = WIN_PCT_AT;
  const last = e.length - 1;
  if (ratioPm <= e[0]) return w[0];
  if (ratioPm >= e[last]) return w[last];
  let k = 1;
  while (ratioPm > e[k]) k++;
  return (
    w[k - 1] +
    Math.floor(((w[k] - w[k - 1]) * (ratioPm - e[k - 1])) / (e[k] - e[k - 1]))
  );
}

/** x × bp ÷ 10,000 for a combined modifier (floor). */
function scaleBp(x: number, bp: number): number {
  return Math.floor((x * bp) / 10_000);
}

/**
 * ww7 lane A (design §2.6): predictBattle with the luck around it, three
 * expected-value runs (no sampling):
 * - low: the attacker's luck at −RANGE_LUCK_BP, its tactic countered (no
 *   effect) and the defender on its commonest counter, ambush (+15 % attack);
 * - mid: predictBattle as it is;
 * - high: luck at +RANGE_LUCK_BP and the attacker's tactic in full, shock
 *   (+30 %) against a plain defence.
 * low ≤ mid ≤ high; winPct is the attacker's chance at the mid ratio
 * (winPctOf), days those of the mid run.
 */
export function predictBattleRange(
  att: SideSum,
  def: SideSum,
  ctx: BattleCtx,
): BattleRange {
  const mid = predictBattle(att, def, ctx);
  if (att.divisions === 0 || def.divisions === 0) {
    return {
      lowPm: mid.ratioPm,
      midPm: mid.ratioPm,
      highPm: mid.ratioPm,
      winPct: winPctOf(mid.ratioPm),
      days: mid.days,
    };
  }
  // ww98: recon on either side: both know better what they face.
  const seen = att.recon === true || def.recon === true;
  const span = (bp: number) =>
    seen ? Math.floor((bp * RECON_RANGE_PCT) / 100) : bp;
  const low = predictBattle(att, def, {
    ...ctx,
    attackerAttackBp: scaleBp(
      ctx.attackerAttackBp,
      10_000 - span(RANGE_LUCK_BP),
    ),
    // (Recon: the ambush the low bound assumes finds nobody.)
    defenderAttackBp:
      att.recon === true
        ? ctx.defenderAttackBp
        : scaleBp(ctx.defenderAttackBp, 10_000 + span(RANGE_LOW_DEF_ATK_BP)),
  });
  const high = predictBattle(att, def, {
    ...ctx,
    attackerAttackBp: scaleBp(
      scaleBp(ctx.attackerAttackBp, 10_000 + span(RANGE_LUCK_BP)),
      10_000 + span(RANGE_HIGH_ATT_ATK_BP),
    ),
  });
  return {
    lowPm: low.ratioPm,
    midPm: mid.ratioPm,
    highPm: high.ratioPm,
    winPct: winPctOf(mid.ratioPm),
    days: mid.days,
  };
}

/** A division's numbers addSide reads. */
export interface SideStats {
  width: number;
  soft: number;
  hard: number;
  def: number;
  brk: number;
  armor: number;
  pierce: number;
  hardnessPm: number;
  hpMilli: number;
  bandPierce?: readonly number[];
  bandPierceAtk?: readonly number[];
  bandHard?: readonly number[];
  /** TPL_* flags (absent: no division rule counts). */
  flags?: number;
  prepFireBp?: number;
  /** ww91: the org damage it takes defending, % (absent: from `flags`). */
  defOrgPct?: number;
  /** ww98: what its engineers take off prepared ground, ‰ (absent: 0). */
  engineerCutPm?: number;
}

/** ww84: the most pierce bands a side sum keeps; the rest join the band nearest in pierce. */
const SIDE_BANDS_MAX = 8;

/** ww84: `hard` hard attack at this pierce into a side's bands. */
function addSideBand(
  sum: SideSum,
  pierce: number,
  atk: number,
  hard: number,
): void {
  const ps = (sum.bandPierce ??= []);
  const as = (sum.bandPierceAtk ??= []);
  const hs = (sum.bandHard ??= []);
  let k = -1;
  for (let i = 0; i < ps.length; i++) {
    if (ps[i] === pierce && as[i] === atk) {
      k = i;
      break;
    }
  }
  if (k < 0 && ps.length >= SIDE_BANDS_MAX) {
    k = 0;
    for (let i = 1; i < ps.length; i++) {
      if (Math.abs(ps[i] - pierce) < Math.abs(ps[k] - pierce)) k = i;
    }
  }
  if (k >= 0) {
    hs[k] += hard;
    return;
  }
  ps.push(pierce);
  as.push(atk);
  hs.push(hard);
}

/** ww84: every pierce band of `from` into `sum` (a screen joining two sides). */
export function addSideBands(sum: SideSum, from: SideSum): void {
  const ps = from.bandPierce;
  const as = from.bandPierceAtk;
  const hs = from.bandHard;
  if (ps === undefined || as === undefined || hs === undefined) {
    addSideBand(sum, from.pierce, from.pierce, from.hard);
    return;
  }
  for (let i = 0; i < hs.length; i++) addSideBand(sum, ps[i], as[i], hs[i]);
}

/** `old` over width `w0` and `x` over width `w`, width-weighted (no closure: addToSide runs per division). */
function byWidth(old: number, x: number, w0: number, w: number): number {
  return w0 + w === 0 ? 0 : Math.floor((old * w0 + x * w) / (w0 + w));
}

/** Adds one division's numbers to a side sum (armour, pierce, hardness width-weighted). */
export function addToSide(sum: SideSum, s: SideStats, orgMilli: number): void {
  const w0 = sum.width;
  const w1 = w0 + s.width;
  const sw = s.width;
  // Width-weighted (no closure: the battles and the screens call it per division).
  sum.armor = w1 === 0 ? 0 : Math.floor((sum.armor * w0 + s.armor * sw) / w1);
  sum.pierce =
    w1 === 0 ? 0 : Math.floor((sum.pierce * w0 + s.pierce * sw) / w1);
  sum.hardnessPm =
    w1 === 0 ? 0 : Math.floor((sum.hardnessPm * w0 + s.hardnessPm * sw) / w1);
  const fl = s.flags ?? 0;
  sum.defOrgPct = byWidth(
    sum.defOrgPct ?? 100,
    s.defOrgPct ?? defenderOrgPct(fl),
    w0,
    sw,
  );
  sum.footPm = byWidth(
    sum.footPm ?? 0,
    has(fl, TPL_FOOT_MAJOR) ? 1000 : 0,
    w0,
    sw,
  );
  sum.armorMajorPm = byWidth(
    sum.armorMajorPm ?? 0,
    has(fl, TPL_TANK_FORCE) ? 1000 : 0,
    w0,
    sw,
  );
  sum.barePm = byWidth(
    sum.barePm ?? 0,
    has(fl, TPL_BARE_ARMOR) ? 1000 : 0,
    w0,
    sw,
  );
  sum.prepFireBp = byWidth(sum.prepFireBp ?? 0, s.prepFireBp ?? 0, w0, sw);
  sum.heavyPm = byWidth(
    sum.heavyPm ?? 0,
    has(fl, TPL_HEAVY_LEAD) ? 1000 : 0,
    w0,
    sw,
  );
  if (has(fl, TPL_RECON)) sum.recon = true;
  sum.engineerCutPm = byWidth(
    sum.engineerCutPm ?? 0,
    s.engineerCutPm ?? 0,
    w0,
    sw,
  );
  sum.reconCutPm = byWidth(
    sum.reconCutPm ?? 0,
    has(fl, TPL_RECON) ? RECON_POSITION_CUT_PM : 0,
    w0,
    sw,
  );
  sum.wearPm = byWidth(
    sum.wearPm ?? 0,
    has(fl, TPL_SUPPORT_GUNS) ? 1000 : 0,
    w0,
    sw,
  );
  sum.fearHalfPm = byWidth(
    sum.fearHalfPm ?? 0,
    has(fl, TPL_SUPPORT_AT) ? 1000 : 0,
    w0,
    sw,
  );
  const hs = s.bandHard;
  if (hs === undefined || s.bandPierce === undefined) {
    addSideBand(sum, s.pierce, s.pierce, s.hard);
  } else {
    const ps = s.bandPierce;
    const as = s.bandPierceAtk ?? ps;
    for (let i = 0; i < hs.length; i++) addSideBand(sum, ps[i], as[i], hs[i]);
  }
  sum.divisions++;
  sum.width = w1;
  sum.soft += s.soft;
  sum.hard += s.hard;
  sum.def += s.def;
  sum.brk += s.brk;
  sum.orgMilli += orgMilli;
  sum.hpMilli += s.hpMilli;
}

export function emptySide(): SideSum {
  return {
    divisions: 0,
    width: 0,
    soft: 0,
    hard: 0,
    def: 0,
    brk: 0,
    armor: 0,
    pierce: 0,
    hardnessPm: 0,
    orgMilli: 0,
    hpMilli: 0,
    bandPierce: [],
    bandPierceAtk: [],
    bandHard: [],
  };
}
