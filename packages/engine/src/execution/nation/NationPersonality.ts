import {
  GovernmentId,
  LawId,
  LawOption,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { PlayerID } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { simpleHash } from "@openfront/engine-lib/Util";

/** Spec §9.1. */
export const PERSONALITIES = [
  "conqueror",
  "merchant",
  "scholar",
  "zealot",
] as const;
export type Personality = (typeof PERSONALITIES)[number];

export interface LawChoice {
  law: LawId;
  option: LawOption;
}

/** What one nation researches, proclaims, adopts and builds (shared: read-only). */
export interface NationDomesticPlan {
  readonly personality: Personality;
  /** Priority techs (lightly shuffled), then the rest in balanced order. */
  readonly techOrder: readonly TechId[];
  /** Priority laws (lightly shuffled), then FALLBACK_LAW_ORDER's others. */
  readonly lawOrder: readonly LawChoice[];
  /** The government to adopt at tier 1 and at tier 2. */
  readonly governments: readonly [GovernmentId, GovernmentId];
  /** Research institutes / admin offices wanted per city. */
  readonly instituteRatio: number;
  readonly officeRatio: number;
}

/** Every tech in a sensible order: what a nation researches after its priorities. */
export const BALANCED_RESEARCH_ORDER: readonly TechId[] = [
  "currency",
  "academia",
  "navigation",
  "bureaucracy",
  "fortification",
  "railroad",
  "conscription",
  "scientific_method",
  "steel_ships",
  "banking",
  "printing_press",
  "rocketry",
  "manhattan_project",
  "industrialization",
  "radar",
  "computers",
  "global_trade",
  "globalization",
  "thermonuclear",
  "mirv",
  "space_program",
];

/** One option per law, never isolationism: what a nation proclaims after its priorities. */
export const FALLBACK_LAW_ORDER: readonly LawChoice[] = [
  { law: "construction", option: "A" },
  { law: "opinion", option: "A" },
  { law: "taxation", option: "B" },
  { law: "learning", option: "B" },
  { law: "trade", option: "A" },
  { law: "mobilization", option: "B" },
  { law: "service", option: "B" },
  { law: "doctrine", option: "A" },
  { law: "religion", option: "B" },
  { law: "nuclear", option: "B" },
  { law: "diplomacy", option: "A" },
];

interface PersonalityDef {
  techs: readonly TechId[];
  laws: readonly LawChoice[];
  governments: readonly [GovernmentId, GovernmentId];
  instituteRatio: number;
  officeRatio: number;
}

// Spec §9.1. The ratios are this plan's choice (spec §9.2 leaves them open).
const PERSONALITY_DEFS: Readonly<Record<Personality, PersonalityDef>> = {
  conqueror: {
    techs: [
      "fortification",
      "conscription",
      "steel_ships",
      "rocketry",
      "manhattan_project",
      "thermonuclear",
    ],
    laws: [
      { law: "service", option: "A" },
      { law: "doctrine", option: "B" },
      { law: "mobilization", option: "A" },
      { law: "taxation", option: "A" },
      { law: "nuclear", option: "A" },
    ],
    governments: ["monarchy", "fascism"],
    instituteRatio: 0.5,
    officeRatio: 0.25,
  },
  merchant: {
    techs: [
      "currency",
      "navigation",
      "railroad",
      "banking",
      "global_trade",
      "industrialization",
      "globalization",
    ],
    laws: [
      { law: "trade", option: "A" },
      { law: "diplomacy", option: "A" },
      { law: "construction", option: "A" },
      { law: "religion", option: "B" },
    ],
    governments: ["republic", "democracy"],
    instituteRatio: 0.35,
    officeRatio: 0.35,
  },
  scholar: {
    techs: ["academia", "scientific_method", "computers", "space_program"],
    laws: [
      { law: "opinion", option: "B" },
      { law: "learning", option: "A" },
      { law: "religion", option: "B" },
    ],
    governments: ["republic", "communism"],
    instituteRatio: 1,
    officeRatio: 0.25,
  },
  zealot: {
    techs: ["bureaucracy", "printing_press", "radar"],
    laws: [
      { law: "religion", option: "A" },
      { law: "opinion", option: "A" },
      { law: "doctrine", option: "A" },
      { law: "diplomacy", option: "B" },
    ],
    governments: ["theocracy", "democracy"],
    instituteRatio: 0.25,
    officeRatio: 1,
  },
};

/** Odds (1 in N) that two neighbours in a priority list swap places. */
const JITTER_SWAP_ODDS = 3;

/** One pass of random neighbour swaps: same personality, slightly different order. */
function jitter<T>(list: readonly T[], random: PseudoRandom): T[] {
  const out = [...list];
  for (let i = 0; i + 1 < out.length; i++) {
    if (random.chance(JITTER_SWAP_ODDS)) {
      [out[i], out[i + 1]] = [out[i + 1], out[i]];
    }
  }
  return out;
}

export function buildDomesticPlan(
  personality: Personality,
  random: PseudoRandom,
): NationDomesticPlan {
  const def = PERSONALITY_DEFS[personality];
  const priorityLaws = new Set(def.laws.map((c) => c.law));
  return {
    personality,
    techOrder: [
      ...jitter(def.techs, random),
      ...BALANCED_RESEARCH_ORDER.filter((t) => !def.techs.includes(t)),
    ],
    lawOrder: [
      ...jitter(def.laws, random),
      ...FALLBACK_LAW_ORDER.filter((c) => !priorityLaws.has(c.law)),
    ],
    governments: def.governments,
    instituteRatio: def.instituteRatio,
    officeRatio: def.officeRatio,
  };
}

/** Plans by player id; a plan depends on nothing else, so games can share them. */
const PLAN_CACHE = new Map<PlayerID, NationDomesticPlan>();
/** Far more nations than any game has; the cache starts over beyond it. */
const PLAN_CACHE_LIMIT = 4096;

/**
 * The plan for one nation. Seeded from its id with a PRNG of its own, so
 * the nation's shared PRNG stream is untouched and the plan needs no
 * snapshot: it is the same every time it is computed. Built once per id,
 * as nations ask for it many times per structure pass.
 */
export function nationDomesticPlan(playerId: PlayerID): NationDomesticPlan {
  let plan = PLAN_CACHE.get(playerId);
  if (plan === undefined) {
    const random = new PseudoRandom(simpleHash(`domestic-plan:${playerId}`));
    plan = buildDomesticPlan(random.randElement([...PERSONALITIES]), random);
    if (PLAN_CACHE.size >= PLAN_CACHE_LIMIT) PLAN_CACHE.clear();
    PLAN_CACHE.set(playerId, plan);
  }
  return plan;
}
