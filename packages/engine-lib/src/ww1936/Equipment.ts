import {
  EquipmentFamily,
  EquipmentType,
  RESOURCE_IDS,
  ResourceId,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";

export interface EquipmentDef {
  family: EquipmentFamily;
  /** Industry milli-points per unit at generation 1. */
  costMilli: number;
  /** Resources per factory on a line, RESOURCE_IDS order. */
  resources: readonly number[];
  /** Units per 100,000 men for full coverage (the stockpile bars); 0: none. */
  needPer100k: number;
  /** The tech that opens each generation. */
  techs: readonly WwTechId[];
}

function res(r: Partial<Record<ResourceId, number>>): readonly number[] {
  return RESOURCE_IDS.map((id) => r[id] ?? 0);
}

// Spec §8.1.
export const EQUIPMENT: Readonly<Record<EquipmentType, EquipmentDef>> = {
  infantry_equipment: {
    family: "infantry",
    costMilli: 500,
    resources: res({ steel: 1 }),
    needPer100k: 0,
    techs: ["inf_eq_1", "inf_eq_2", "inf_eq_3"],
  },
  support_equipment: {
    family: "infantry",
    costMilli: 4_000,
    resources: res({ steel: 1, aluminium: 1 }),
    needPer100k: 300,
    techs: ["support_eq_1", "support_eq_2"],
  },
  artillery: {
    family: "guns",
    costMilli: 3_500,
    resources: res({ steel: 2, tungsten: 1 }),
    needPer100k: 400,
    techs: ["artillery_1", "artillery_2", "artillery_3"],
  },
  anti_tank: {
    family: "guns",
    costMilli: 4_000,
    resources: res({ steel: 2, tungsten: 1 }),
    needPer100k: 200,
    techs: ["anti_tank_1", "anti_tank_2"],
  },
  anti_air: {
    family: "guns",
    costMilli: 4_000,
    resources: res({ steel: 1, aluminium: 1 }),
    needPer100k: 150,
    techs: ["anti_air_1", "anti_air_2"],
  },
  motorized: {
    family: "vehicles",
    costMilli: 2_500,
    resources: res({ oil: 1, rubber: 1 }),
    needPer100k: 1_500,
    techs: ["motorized_1"],
  },
  light_tank: {
    family: "vehicles",
    costMilli: 8_000,
    resources: res({ steel: 1, oil: 1 }),
    needPer100k: 300,
    techs: ["light_tank_1", "light_tank_2"],
  },
  medium_tank: {
    family: "vehicles",
    costMilli: 12_000,
    resources: res({ steel: 2, chromium: 1, oil: 1 }),
    needPer100k: 300,
    techs: ["medium_tank_1", "medium_tank_2", "medium_tank_3"],
  },
  fighter: {
    family: "aircraft",
    costMilli: 22_000,
    resources: res({ aluminium: 2, rubber: 1 }),
    needPer100k: 0,
    techs: ["fighter_1", "fighter_2", "fighter_3"],
  },
  bomber: {
    family: "aircraft",
    costMilli: 30_000,
    resources: res({ aluminium: 3, rubber: 1 }),
    needPer100k: 0,
    techs: ["bomber_1", "bomber_2"],
  },
  // P4 (P4 spec §12.2, §5.3). A carrier type also needs carrier_aviation
  // (PlaneStats.planeGenTechs); the convoy is built on naval lines only.
  heavy_fighter: {
    family: "aircraft",
    costMilli: 30_000,
    resources: res({ aluminium: 3, rubber: 1 }),
    needPer100k: 0,
    techs: ["heavy_fighter_1", "heavy_fighter_2", "heavy_fighter_3"],
  },
  cas: {
    family: "aircraft",
    costMilli: 23_000,
    resources: res({ aluminium: 2, rubber: 1 }),
    needPer100k: 0,
    techs: ["cas_1", "cas_2", "cas_3"],
  },
  naval_bomber: {
    family: "aircraft",
    costMilli: 28_000,
    resources: res({ aluminium: 2, rubber: 1 }),
    needPer100k: 0,
    techs: ["naval_bomber_1", "naval_bomber_2", "naval_bomber_3"],
  },
  strat_bomber: {
    family: "aircraft",
    costMilli: 48_000,
    resources: res({ aluminium: 4, rubber: 2 }),
    needPer100k: 0,
    techs: ["strat_bomber_1", "strat_bomber_2", "strat_bomber_3"],
  },
  transport_plane: {
    family: "aircraft",
    costMilli: 30_000,
    resources: res({ aluminium: 3, rubber: 1 }),
    needPer100k: 0,
    techs: ["transport_plane_1"],
  },
  cv_fighter: {
    family: "aircraft",
    costMilli: 25_000,
    resources: res({ aluminium: 2, rubber: 1 }),
    needPer100k: 0,
    techs: ["fighter_1", "fighter_2", "fighter_3"],
  },
  cv_cas: {
    family: "aircraft",
    costMilli: 26_000,
    resources: res({ aluminium: 2, rubber: 1 }),
    needPer100k: 0,
    techs: ["cas_1", "cas_2", "cas_3"],
  },
  cv_naval_bomber: {
    family: "aircraft",
    costMilli: 30_000,
    resources: res({ aluminium: 2, rubber: 1 }),
    needPer100k: 0,
    techs: ["naval_bomber_1", "naval_bomber_2", "naval_bomber_3"],
  },
  convoy: {
    family: "naval",
    costMilli: 60_000,
    resources: res({ steel: 1 }),
    needPer100k: 0,
    techs: [],
  },
  // P6 (plan Task 1 Step 2). Designs cost what their design says
  // (depth equipCostMilli / equipResources); a design type's "generation"
  // is its slot.
  tank_design: {
    family: "vehicles",
    costMilli: 0,
    resources: res({}),
    needPer100k: 0,
    techs: [],
  },
  plane_design: {
    family: "aircraft",
    costMilli: 0,
    resources: res({}),
    needPer100k: 0,
    techs: [],
  },
  railway_gun: {
    family: "guns",
    costMilli: 40_000,
    resources: res({ steel: 3, tungsten: 1 }),
    needPer100k: 0,
    techs: ["railway_gun_1"],
  },
  floating_harbor: {
    family: "naval",
    // Naval industry 3,000 (spec §16.6): built on naval lines.
    costMilli: 3_000_000,
    resources: res({}),
    needPer100k: 0,
    techs: ["floating_harbor_1"],
  },
  flying_bomb: {
    family: "guns",
    costMilli: 6_000,
    resources: res({ aluminium: 1 }),
    needPer100k: 0,
    techs: [],
  },
  ballistic_rocket: {
    family: "guns",
    costMilli: 18_000,
    resources: res({ aluminium: 1, oil: 1 }),
    needPer100k: 0,
    techs: [],
  },
  atomic_bomb: {
    family: "special",
    costMilli: 0,
    resources: res({}),
    needPer100k: 0,
    techs: [],
  },
};

/** P6 plan decision 5: the design types (a "generation" is a design slot). */
export const DESIGN_TYPES: readonly EquipmentType[] = [
  "tank_design",
  "plane_design",
];
export function isDesignType(type: EquipmentType): boolean {
  return type === "tank_design" || type === "plane_design";
}
/** P6: the types a project opens (equipmentBuildable's caller checks depth.projectDone). */
export const PROJECT_TYPES: Readonly<Partial<Record<EquipmentType, number>>> = {
  // SPECIAL_PROJECTS index: sp_flying_bomb, sp_ballistic.
  flying_bomb: 1,
  ballistic_rocket: 2,
};

/**
 * P4 plan decision 14: the convoy is no P1 line's (naval lines build it).
 * P6 (plan decision 5): nor the floating harbour (a naval line item) or
 * the atomic bomb (facilities make it); flying bombs and ballistic rockets
 * need their project (the line-order judge asks depth.projectDone).
 */
export function equipmentBuildable(type: EquipmentType): boolean {
  return (
    type !== "convoy" && type !== "floating_harbor" && type !== "atomic_bomb"
  );
}

/** Cost of a later generation, percent of generation 1 (P6: design slots past 3 cost 100%). */
export const GEN_COST_PCT: readonly number[] = [100, 125, 150];

export function unitCostMilli(type: EquipmentType, gen: number): number {
  return Math.floor(
    (EQUIPMENT[type].costMilli * (GEN_COST_PCT[gen - 1] ?? 100)) / 100,
  );
}

/** The tech that opens (type, gen). */
export function genTech(type: EquipmentType, gen: number): WwTechId {
  return EQUIPMENT[type].techs[gen - 1];
}
