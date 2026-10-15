import {
  LAW_IDS,
  LawId,
  LawOption,
  Modifier,
  PolicyFlag,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { LAW_BASE_COST, LAW_COST_GROWTH } from "./Balance";

export interface LawOptionDef {
  modifiers: readonly Modifier[];
  flags: readonly PolicyFlag[];
}

export interface LawDef {
  id: LawId;
  /** Tech needed before either option can be proclaimed. */
  requires: TechId | null;
  A: LawOptionDef;
  B: LawOptionDef;
}

function optionDef(
  modifiers: readonly Modifier[],
  flags: readonly PolicyFlag[] = [],
): LawOptionDef {
  return { modifiers, flags };
}

function lawDef(
  id: LawId,
  A: LawOptionDef,
  B: LawOptionDef,
  requires: TechId | null = null,
): LawDef {
  return { id, requires, A, B };
}

// Spec §5.2.
export const LAWS: Readonly<Record<LawId, LawDef>> = {
  trade: lawDef(
    "trade",
    optionDef([{ stat: "trade", pct: 40 }]),
    optionDef([
      { stat: "cityTax", pct: 60 },
      { stat: "foreignTrade", pct: -30 },
    ]),
  ),
  taxation: lawDef(
    "taxation",
    optionDef([
      { stat: "goldIncome", pct: 30 },
      { stat: "troopRegen", pct: -15 },
    ]),
    optionDef([
      { stat: "cityTax", pct: 40 },
      { stat: "cityBuildTime", pct: -50 },
    ]),
  ),
  construction: lawDef(
    "construction",
    optionDef([{ stat: "buildCost", pct: -25 }]),
    optionDef([{ stat: "buildTime", pct: -50 }]),
  ),
  learning: lawDef(
    "learning",
    optionDef([], ["researchSubsidy"]),
    optionDef([{ stat: "adminOutput", pct: 40 }]),
  ),
  service: lawDef(
    "service",
    optionDef([
      { stat: "maxTroops", pct: 25 },
      { stat: "goldIncome", pct: -10 },
    ]),
    optionDef([
      { stat: "troopUpkeep", pct: -50 },
      { stat: "attackLoss", pct: -15 },
    ]),
  ),
  doctrine: lawDef(
    "doctrine",
    optionDef([
      { stat: "defensePost", pct: 40 },
      { stat: "defenseLoss", pct: -15 },
    ]),
    optionDef([
      { stat: "attackSpeed", pct: 30 },
      { stat: "defenseLoss", pct: 10 },
    ]),
  ),
  mobilization: lawDef(
    "mobilization",
    optionDef([{ stat: "troopRegen", pct: 100, when: "troopsAtMostHalf" }]),
    // upkeepFreeBand adds percentage points: 40% -> 60%.
    optionDef([{ stat: "upkeepFreeBand", pct: 20 }]),
  ),
  nuclear: lawDef(
    "nuclear",
    optionDef([
      { stat: "siloSamCost", pct: -30 },
      { stat: "nukeCost", pct: -20 },
    ]),
    optionDef([{ stat: "samRange", pct: 30 }]),
    "manhattan_project",
  ),
  diplomacy: lawDef(
    "diplomacy",
    optionDef([{ stat: "alliedTrade", pct: 50 }]),
    optionDef(
      [
        { stat: "political", pct: 40 },
        { stat: "defenseLoss", pct: -10 },
      ],
      ["noForeignTrade"],
    ),
  ),
  opinion: lawDef(
    "opinion",
    optionDef([{ stat: "political", pct: 25 }]),
    optionDef([{ stat: "science", pct: 20 }]),
  ),
  religion: lawDef(
    "religion",
    // State religion also allows theocracy (GOVERNMENTS.theocracy.requiresLaw).
    optionDef([
      { stat: "political", pct: 15 },
      { stat: "troopRegen", pct: 15 },
      { stat: "science", pct: -10 },
    ]),
    optionDef([
      { stat: "science", pct: 15 },
      { stat: "foreignTrade", pct: 20 },
      { stat: "expansionSpeed", pct: 20 },
    ]),
  ),
};

/**
 * The next law's cost after `proclaimed` laws, before lawCost:
 * round(LAW_BASE_COST × LAW_COST_GROWTH^k).
 */
export function lawBaseCost(proclaimed: number): number {
  let cost = LAW_BASE_COST;
  for (let i = 0; i < proclaimed; i++) {
    cost *= LAW_COST_GROWTH;
  }
  return Math.round(cost);
}

/**
 * Political power (whole points) the next law costs after the lawCost
 * modifier. Integer math keeps x.5 results exact, so they round up.
 */
export function lawCost(proclaimed: number, lawCostPct: number): number {
  return Math.round((lawBaseCost(proclaimed) * (100 + lawCostPct)) / 100);
}

export type LawBlock = "proclaimed" | "requires" | "cooldown";

/** Why `law` can't be proclaimed now (cost aside), or null when it can. */
export function lawBlock(
  law: LawId,
  proclaimed: LawOption | undefined,
  techs: ReadonlySet<TechId>,
  cooldownUntilTick: number,
  nowTick: number,
): LawBlock | null {
  if (proclaimed !== undefined) return "proclaimed";
  const requires = LAWS[law].requires;
  if (requires !== null && !techs.has(requires)) return "requires";
  if (nowTick < cooldownUntilTick) return "cooldown";
  return null;
}

/** A DomesticData laws record as a map in LAW_IDS order. */
export function lawMapOf(
  laws: Partial<Record<LawId, LawOption>>,
): Map<LawId, LawOption> {
  const out = new Map<LawId, LawOption>();
  for (const id of LAW_IDS) {
    const chosen = laws[id];
    if (chosen !== undefined) out.set(id, chosen);
  }
  return out;
}
