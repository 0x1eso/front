import {
  GovernmentId,
  LawId,
  LawOption,
  Modifier,
  PolicyFlag,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { GOVERNMENT_TIER_THRESHOLDS, MILLI } from "./Balance";

/** The highest tier that offers governments; tier 3 adds none. */
export const MAX_GOVERNMENT_TIER = 2;

export interface GovernmentDef {
  id: GovernmentId;
  tier: 0 | 1 | 2;
  modifiers: readonly Modifier[];
  flags: readonly PolicyFlag[];
  /** A proclaimed law option this government needs first. */
  requiresLaw: { law: LawId; option: LawOption } | null;
}

function governmentDef(
  id: GovernmentId,
  tier: 0 | 1 | 2,
  extra: Partial<
    Pick<GovernmentDef, "modifiers" | "flags" | "requiresLaw">
  > = {},
): GovernmentDef {
  return {
    id,
    tier,
    modifiers: extra.modifiers ?? [],
    flags: extra.flags ?? [],
    requiresLaw: extra.requiresLaw ?? null,
  };
}

// Spec §6.2, §6.3.
export const GOVERNMENTS: Readonly<Record<GovernmentId, GovernmentDef>> = {
  chiefdom: governmentDef("chiefdom", 0),
  monarchy: governmentDef("monarchy", 1, {
    modifiers: [
      { stat: "maxTroops", pct: 20 },
      { stat: "upkeepFreeBand", pct: 20 },
      { stat: "science", pct: -15 },
    ],
    flags: ["feudal"],
  }),
  republic: governmentDef("republic", 1, {
    modifiers: [
      { stat: "goldIncome", pct: 20 },
      { stat: "trade", pct: 25 },
      // Public works.
      { stat: "cityBuildTime", pct: -50 },
      { stat: "recruitCost", pct: 25 },
    ],
  }),
  theocracy: governmentDef("theocracy", 1, {
    modifiers: [
      { stat: "political", pct: 30 },
      { stat: "defenseLoss", pct: -20 },
      { stat: "science", pct: -15 },
    ],
    flags: ["tithe"],
    requiresLaw: { law: "religion", option: "A" },
  }),
  democracy: governmentDef("democracy", 2, {
    modifiers: [
      { stat: "goldIncome", pct: 30 },
      { stat: "science", pct: 30 },
      { stat: "goldPaymentCost", pct: -50 },
      // Peace dividend and war weariness.
      { stat: "political", pct: 30, when: "notAttacking" },
      { stat: "political", pct: -50, when: "attacking" },
    ],
  }),
  fascism: governmentDef("fascism", 2, {
    modifiers: [
      { stat: "troopRegen", pct: 30 },
      { stat: "attackLoss", pct: -25 },
      { stat: "recruitCost", pct: -50 },
      // War economy.
      { stat: "goldIncome", pct: 30, when: "attacking" },
      { stat: "science", pct: -20 },
      { stat: "goldIncome", pct: -10, when: "notAttacking" },
    ],
  }),
  communism: governmentDef("communism", 2, {
    modifiers: [
      { stat: "buildCost", pct: -30 },
      { stat: "buildTime", pct: -50 },
      // Five-year plan.
      { stat: "instituteOutput", pct: 50 },
      { stat: "adminOutput", pct: 50 },
      { stat: "trade", pct: -30 },
    ],
    flags: ["noProductionUpkeep"],
  }),
};

export const GOVERNMENTS_BY_TIER: readonly (readonly GovernmentId[])[] = [
  ["chiefdom"],
  ["monarchy", "republic", "theocracy"],
  ["democracy", "fascism", "communism"],
];

/** Highest tier (0..3) whose threshold the cumulative political power reached. */
export function governmentTier(cumulativePoliticalMilli: number): number {
  let tier = 0;
  for (const threshold of GOVERNMENT_TIER_THRESHOLDS) {
    if (cumulativePoliticalMilli >= threshold * MILLI) tier++;
  }
  return tier;
}

export type GovernmentBlock =
  | "tierNotReached"
  | "tierPassed"
  | "chosen"
  | "requires";

/**
 * Why `government` can't be adopted now, or null when it can. Governments
 * open at tier min(reached, 2), so a skipped tier stays closed while tier 3
 * still offers tier 2. The current government's tier counts as chosen until
 * the next one opens (spec §6.1).
 */
export function governmentBlock(
  tier: number,
  current: GovernmentId,
  laws: ReadonlyMap<LawId, LawOption>,
  government: GovernmentId,
): GovernmentBlock | null {
  const def = GOVERNMENTS[government];
  const open = Math.min(tier, MAX_GOVERNMENT_TIER);
  if (def.tier > open) return "tierNotReached";
  if (def.tier < open || def.tier === 0) return "tierPassed";
  if (GOVERNMENTS[current].tier >= def.tier) return "chosen";
  const req = def.requiresLaw;
  if (req !== null && laws.get(req.law) !== req.option) return "requires";
  return null;
}
