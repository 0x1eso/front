import { Modifier, TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  SPACE_PROGRAM_COST,
  TECH_COST_BY_ERA,
  TECH_SECONDS_BY_ERA,
} from "./Balance";

export type Era = 1 | 2 | 3 | 4;
export type Branch = "economy" | "military" | "learning";

export interface TechDef {
  id: TechId;
  era: Era;
  branch: Branch;
  /** Science points. */
  cost: number;
  /** Research time before modifiers. */
  seconds: number;
  prereqs: readonly TechId[];
  modifiers: readonly Modifier[];
  unlocks: readonly UnitType[];
  /** Banking: stored gold earns interest. */
  interest?: true;
}

type TechExtras = Partial<
  Pick<TechDef, "prereqs" | "modifiers" | "unlocks" | "interest" | "cost">
>;

function tech(
  id: TechId,
  era: Era,
  branch: Branch,
  extra: TechExtras = {},
): TechDef {
  return {
    id,
    era,
    branch,
    cost: extra.cost ?? TECH_COST_BY_ERA[era - 1],
    seconds: TECH_SECONDS_BY_ERA[era - 1],
    prereqs: extra.prereqs ?? [],
    modifiers: extra.modifiers ?? [],
    unlocks: extra.unlocks ?? [],
    ...(extra.interest ? ({ interest: true } as const) : {}),
  };
}

// Spec §4.2.
export const TECHS: Readonly<Record<TechId, TechDef>> = {
  currency: tech("currency", 1, "economy", {
    modifiers: [{ stat: "cityTax", pct: 50 }],
  }),
  navigation: tech("navigation", 1, "economy", {
    modifiers: [
      { stat: "tradeShip", pct: 40 },
      { stat: "portCost", pct: -25 },
    ],
  }),
  fortification: tech("fortification", 1, "military", {
    modifiers: [
      { stat: "defensePost", pct: 50 },
      { stat: "defensePostCost", pct: -30 },
    ],
  }),
  academia: tech("academia", 1, "learning", {
    modifiers: [{ stat: "instituteOutput", pct: 40 }],
  }),
  bureaucracy: tech("bureaucracy", 1, "learning", {
    modifiers: [{ stat: "adminOutput", pct: 40 }],
  }),
  railroad: tech("railroad", 2, "economy", { unlocks: [UnitType.Factory] }),
  banking: tech("banking", 2, "economy", { interest: true }),
  steel_ships: tech("steel_ships", 2, "military", {
    unlocks: [UnitType.Warship],
  }),
  conscription: tech("conscription", 2, "military", {
    modifiers: [
      { stat: "troopRegen", pct: 25 },
      { stat: "recruitCost", pct: -30 },
    ],
  }),
  scientific_method: tech("scientific_method", 2, "learning", {
    modifiers: [
      { stat: "researchTime", pct: -30 },
      { stat: "science", pct: 15 },
    ],
  }),
  printing_press: tech("printing_press", 2, "learning", {
    modifiers: [
      { stat: "political", pct: 25 },
      { stat: "lawCost", pct: -15 },
    ],
  }),
  industrialization: tech("industrialization", 3, "economy", {
    modifiers: [
      { stat: "train", pct: 50 },
      { stat: "buildCost", pct: -15 },
    ],
  }),
  global_trade: tech("global_trade", 3, "economy", {
    modifiers: [
      { stat: "tradeShipSpawn", pct: 50 },
      { stat: "alliedTrade", pct: 50 },
    ],
  }),
  rocketry: tech("rocketry", 3, "military", {
    unlocks: [UnitType.MissileSilo],
  }),
  radar: tech("radar", 3, "military", { unlocks: [UnitType.SAMLauncher] }),
  manhattan_project: tech("manhattan_project", 3, "military", {
    prereqs: ["rocketry"],
    unlocks: [UnitType.AtomBomb],
  }),
  computers: tech("computers", 3, "learning", {
    modifiers: [
      { stat: "science", pct: 30 },
      { stat: "political", pct: 15 },
    ],
  }),
  globalization: tech("globalization", 4, "economy", {
    modifiers: [{ stat: "allGold", pct: 30 }],
  }),
  thermonuclear: tech("thermonuclear", 4, "military", {
    prereqs: ["manhattan_project"],
    unlocks: [UnitType.HydrogenBomb],
  }),
  mirv: tech("mirv", 4, "military", {
    prereqs: ["thermonuclear"],
    unlocks: [UnitType.MIRV],
  }),
  // The science-victory project itself arrives in phase 3.
  space_program: tech("space_program", 4, "learning", {
    prereqs: ["computers"],
    cost: SPACE_PROGRAM_COST,
  }),
};
