// World War 1936 P2: the combat rules (P2 spec §9.2–§9.4, §9.9). The
// engine's battle lane, the AI, the attack preview and the battle card call
// the same pure integer functions.
import { FM_TRAITS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BattleCtx,
  BattlePrediction,
  CombatMods,
  LandTerrain,
  ModLine,
  SideSum,
  TPL_AMPHIBIOUS,
  TPL_ARMOR_ANY,
  TPL_ARMOR_MAJOR,
  TPL_CAVALRY_MAJOR,
  TPL_ENGINEER,
  TPL_FLAIL,
  TPL_FLAME,
  TPL_INFANTRY_DIV,
  TPL_MARINE_ANY,
  TPL_MARINE_MAJOR,
  TPL_MOTOR_ANY,
  TPL_MOUNTAIN_ANY,
  TPL_MOUNTAIN_MAJOR,
  TPL_PARA_ANY,
  TPL_RECON,
  TPL_TD_DEFEND,
  traitBit,
  Weather,
  WW_ROUND_HOUR_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { FM_TRAIT_STATS } from "./CommandRules";
import { WEATHER } from "./Weather";
import { TechTotals } from "./WwTechs";

/** A P6 stat of a TechTotals that is the country's WwStats (0 when absent: a neutral tech). */
function stat(t: TechTotals, k: WwStatKey): number {
  return (t as unknown as Partial<WwStats>)[k] ?? 0;
}

export interface TerrainDef {
  width: number;
  perDirection: number;
  /** Attacker's attack, bp (≤ 0). */
  attackBp: number;
  /** Extra distance to enter, % (spec §7.2). */
  movePct: number;
  /** Supply cost of a road edge into it, % (spec §11.2). */
  supplyPct: number;
}

// Spec §9.2 (pre-1.11 HOI4 widths), §7.2, §11.2.
export const TERRAIN: Readonly<Record<LandTerrain, TerrainDef>> = {
  plains: {
    width: 90,
    perDirection: 45,
    attackBp: 0,
    movePct: 0,
    supplyPct: 100,
  },
  desert: {
    width: 90,
    perDirection: 45,
    attackBp: 0,
    movePct: 10,
    supplyPct: 100,
  },
  forest: {
    width: 84,
    perDirection: 42,
    attackBp: -1500,
    movePct: 25,
    supplyPct: 120,
  },
  hills: {
    width: 80,
    perDirection: 40,
    attackBp: -2500,
    movePct: 33,
    supplyPct: 120,
  },
  mountain: {
    width: 75,
    perDirection: 25,
    attackBp: -5000,
    movePct: 100,
    supplyPct: 200,
  },
  marsh: {
    width: 60,
    perDirection: 30,
    attackBp: -4000,
    movePct: 66,
    supplyPct: 150,
  },
  jungle: {
    width: 84,
    perDirection: 42,
    attackBp: -3000,
    movePct: 66,
    supplyPct: 150,
  },
  urban: {
    width: 96,
    perDirection: 32,
    attackBp: -3000,
    movePct: 10,
    supplyPct: 120,
  },
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
 * the Maginot to hold); −75% at level 5, −56% with engineers.
 */
export const FORT_ATTACK_BP = -1500;

/** Spec §9.2: base width plus one step for every direction after the first (1..4). */
export function combatWidth(land: LandTerrain, directions: number): number {
  const t = TERRAIN[land];
  return t.width + t.perDirection * (Math.max(1, Math.min(4, directions)) - 1);
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

/** Spec §9.3-4: hits an hour, centi: 10% of the attack within the block value, 40% of the rest. */
export function roundHits(attack: number, block: number): number {
  const a = Math.max(0, attack);
  const d = Math.max(0, block);
  return Math.floor((10 * Math.min(a, d) + 40 * Math.max(0, a - d)) / 100);
}

/**
 * Spec §9.3-6: one round (1.829 HOI4 hours) of damage from `hitsCenti`:
 * 0.13 org and 0.09 HP a hit, halved when the target's armour beats the
 * attacker's pierce (spec §9.3-5).
 */
export function roundDamage(
  hitsCenti: number,
  armorHalved: boolean,
): { orgMilli: number; hpMilli: number } {
  let org = Math.floor((hitsCenti * WW_ROUND_HOUR_MILLI * 13) / 10_000);
  let hp = Math.floor((hitsCenti * WW_ROUND_HOUR_MILLI * 9) / 10_000);
  if (armorHalved) {
    org = Math.floor(org / 2);
    hp = Math.floor(hp / 2);
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

/** Spec §9.2: −2% attack for every 1% of width over the line. */
export function excessWidthBp(usedWidth: number, width: number): number {
  const over = Math.max(0, usedWidth - width);
  // (0, not −0, when the line fits.)
  return width <= 0 || over === 0 ? 0 : -Math.floor((over * 20_000) / width);
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
  /** The battle region's terrain and weather. */
  land: LandTerrain;
  weather: Weather;
  /** Attacker only: the edge it attacks over (0 when dropped in), the region's fort level. */
  river: 0 | 1 | 2;
  strait: boolean;
  fort: number;
  /** Defender only: its own entrenchment level. */
  entrench: number;
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
}

export interface ModResult {
  mods: CombatMods;
  attackLines: ModLine[];
  defenseLines: ModLine[];
}

const has = (mask: number, bit: number) => (mask & bit) !== 0;
const TB = (t: Parameters<typeof traitBit>[0]) => traitBit(t);

/**
 * Spec §9.4 (and §4.1 terrain specialities, §4.2 companies, §6.2 traits,
 * §10 weather, §11.5 encirclement): a division's attack and defence
 * modifiers in one battle. "defense" multiplies its block value (defence
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
  const hillsOrMountain = i.land === "hills" || i.land === "mountain";
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
  if (has(i.traits, TB("desert_fox")) && i.land === "desert") trait += 1000;
  if (has(i.traits, TB("mountaineer")) && hillsOrMountain) trait += 1000;
  // P6 (spec §4.2): the new general traits.
  const forest = i.land === "forest" || i.land === "jungle";
  if (has(i.traits, TB("forest_expert")) && forest) trait += 1000;
  if (has(i.traits, TB("urban_expert")) && i.land === "urban") trait += 1000;
  if (has(i.traits, TB("swamp_expert")) && i.land === "marsh") trait += 1000;
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
  push(
    aAdd,
    "doctrine",
    i.tech.attackPct * 100 +
      (i.land === "desert" ? i.tech.desertAttackPct * 100 : 0),
  );
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
  push(aAdd, "recon", has(i.flags, TPL_RECON) ? 500 : 0);
  push(
    aAdd,
    "mountain",
    has(i.flags, TPL_MOUNTAIN_MAJOR) && hillsOrMountain ? 2500 : 0,
  );
  push(
    aAdd,
    "marine",
    has(i.flags, TPL_MARINE_MAJOR) && i.land === "marsh" ? 1500 : 0,
  );
  if (i.attacking) {
    if (has(i.flags, TPL_ARMOR_MAJOR)) {
      if (i.land === "plains" || i.land === "desert") {
        push(aAdd, "armor_terrain", 1000);
      } else {
        push(aCut, "armor_terrain", -2000);
      }
    }
    push(aCut, "terrain", TERRAIN[i.land].attackBp);
    // P6 (spec §4.2, §5.2.2, §21.2): engineer officers, amphibious and
    // flail tanks, the river and fort penalty cuts.
    const engOfficer = has(i.traits, TB("engineer_officer")) ? 85 : 100;
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
            halve(RIVER_ATTACK_BP[i.river], n),
            100 - stat(i.tech, "riverPenaltyCutPct"),
          ),
          engOfficer,
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
      f = cutBy(f, 100 - stat(i.tech, "fortPenaltyCutPct"));
      push(aCut, "fort", cutBy(f, engOfficer));
    }
    if (has(i.designFlags, TPL_FLAME) && (i.land === "urban" || fort > 0)) {
      push(aAdd, "flame", 1000);
    }
    let w = WEATHER[i.weather].attackBp;
    if (i.weather === "snow" || i.weather === "frozen") {
      if (has(i.traits, TB("winter_specialist"))) w = halve(w, 1);
      if (i.weather === "snow" && has(i.flags, TPL_MOUNTAIN_ANY)) {
        w = halve(w, 1);
      }
      w = -Math.floor((-w * Math.max(0, 100 - i.tech.winterPenaltyPct)) / 100);
    }
    if (i.weather === "heat" && has(i.traits, TB("desert_fox"))) w = 0;
    push(aCut, "weather", w);
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
  push(aCut, "supply", supplyCut);
  push(aCut, "encircled", i.encircled ? -5000 : 0);
  // P4 (spec §14.6, §15.4, §11.4).
  push(aCut, "air", i.airBp);
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
  if (
    has(i.traits, TB("forest_expert")) &&
    (i.land === "forest" || i.land === "jungle")
  ) {
    dTrait += 500;
  }
  if (has(i.traits, TB("urban_expert")) && i.land === "urban") dTrait += 1000;
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
  } else {
    push(
      dAdd,
      "doctrine",
      i.tech.defensePct * 100 +
        (i.land === "forest" ? i.tech.forestDefensePct * 100 : 0),
    );
    push(dAdd, "entrench", i.entrench * 300);
    // P6 (spec §21.2): the fort's defence per level (its own region's fort).
    push(dAdd, "fort_def", i.fort * stat(i.tech, "fortDefPerLevelBp"));
  }
  push(dAdd, "exp", expBp(i.exp));
  push(dAdd, "plan", planBp);
  push(dAdd, "fm_plan", fmPlanBp);
  push(dAdd, "recon", has(i.flags, TPL_RECON) ? 500 : 0);
  // P6 (spec §21.2): engineerMulPct scales the engineers' line.
  push(
    dAdd,
    "engineer",
    has(i.flags, TPL_ENGINEER)
      ? Math.floor(
          (500 * Math.max(0, 100 + stat(i.tech, "engineerMulPct"))) / 100,
        )
      : 0,
  );
  push(
    dAdd,
    "mountain",
    has(i.flags, TPL_MOUNTAIN_MAJOR) && hillsOrMountain ? 1000 : 0,
  );
  push(dCut, "supply", supplyCut);
  push(dCut, "encircled", i.encircled ? -5000 : 0);
  push(dCut, "air", i.airBp);
  push(dCut, "fuel", i.fuelBp);
  if (!i.attacking) push(dCut, "shore_bombard", i.shoreBp);
  const sum = (l: ModLine[]) => l.map((x) => x.bp);
  return {
    mods: {
      attackBp: combineMods(sum(aAdd), sum(aCut)),
      defenseBp: combineMods(sum(dAdd), sum(dCut)),
    },
    attackLines: [...aAdd, ...aCut],
    defenseLines: [...dAdd, ...dCut],
  };
}

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

/** Entrenchment cap (spec §9.4): 5, +5 engineers, +2 battleplan_2 (tech.entrenchMax). */
export function entrenchMax(flags: number, tech: TechTotals): number {
  return 5 + (has(flags, TPL_ENGINEER) ? 5 : 0) + tech.entrenchMax;
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
  const width = combatWidth(ctx.land, ctx.directions);
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
  const aA = applyBp(
    attackValue(
      per(att.soft, att.divisions),
      per(att.hard, att.divisions),
      def.hardnessPm,
    ),
    ctx.attackerAttackBp,
  );
  const dD = applyBp(per(def.def, def.divisions), ctx.defenderBlockBp);
  const aD = applyBp(
    attackValue(
      per(def.soft, def.divisions),
      per(def.hard, def.divisions),
      att.hardnessPm,
    ),
    ctx.defenderAttackBp,
  );
  const dA = applyBp(per(att.brk, att.divisions), ctx.attackerBlockBp);
  const toDef = roundDamage(roundHits(aA, dD), def.armor > att.pierce).orgMilli;
  const toAtt = roundDamage(roundHits(aD, dA), att.armor > def.pierce).orgMilli;
  const dmgDef = Math.floor((toDef * lineA) / 1000);
  const dmgAtt = Math.floor((toAtt * lineD) / 1000);
  const rounds = dmgDef <= 0 ? 999_999 : Math.ceil(def.orgMilli / dmgDef);
  const ratioPm =
    dmgAtt <= 0
      ? 1_000_000
      : Math.floor(
          (dmgDef * att.orgMilli * 1000) / (dmgAtt * Math.max(1, def.orgMilli)),
        );
  return { ratioPm, rounds, days: Math.ceil((rounds * 2) / 15) };
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
  };
}
