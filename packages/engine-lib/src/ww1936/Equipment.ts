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
  /** Units per 100,000 men for full coverage; 0: no P1 combat role. */
  needPer100k: number;
  /** Attack, defense, speed percent at full coverage, generation 1. */
  bonus: readonly [number, number, number];
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
    bonus: [0, 0, 0],
    techs: ["inf_eq_1", "inf_eq_2", "inf_eq_3"],
  },
  support_equipment: {
    family: "infantry",
    costMilli: 4_000,
    resources: res({ steel: 1, aluminium: 1 }),
    needPer100k: 300,
    bonus: [5, 5, 0],
    techs: ["support_eq_1", "support_eq_2"],
  },
  artillery: {
    family: "guns",
    costMilli: 3_500,
    resources: res({ steel: 2, tungsten: 1 }),
    needPer100k: 400,
    bonus: [15, 10, 0],
    techs: ["artillery_1", "artillery_2", "artillery_3"],
  },
  anti_tank: {
    family: "guns",
    costMilli: 4_000,
    resources: res({ steel: 2, tungsten: 1 }),
    needPer100k: 200,
    bonus: [0, 10, 0],
    techs: ["anti_tank_1", "anti_tank_2"],
  },
  anti_air: {
    family: "guns",
    costMilli: 4_000,
    resources: res({ steel: 1, aluminium: 1 }),
    needPer100k: 150,
    bonus: [0, 5, 0],
    techs: ["anti_air_1", "anti_air_2"],
  },
  motorized: {
    family: "vehicles",
    costMilli: 2_500,
    resources: res({ oil: 1, rubber: 1 }),
    needPer100k: 1_500,
    bonus: [0, 0, 10],
    techs: ["motorized_1"],
  },
  light_tank: {
    family: "vehicles",
    costMilli: 8_000,
    resources: res({ steel: 1, oil: 1 }),
    needPer100k: 300,
    bonus: [10, 0, 10],
    techs: ["light_tank_1", "light_tank_2"],
  },
  medium_tank: {
    family: "vehicles",
    costMilli: 12_000,
    resources: res({ steel: 2, chromium: 1, oil: 1 }),
    needPer100k: 300,
    bonus: [20, 5, 10],
    techs: ["medium_tank_1", "medium_tank_2", "medium_tank_3"],
  },
  fighter: {
    family: "aircraft",
    costMilli: 22_000,
    resources: res({ aluminium: 2, rubber: 1 }),
    needPer100k: 0,
    bonus: [0, 0, 0],
    techs: ["fighter_1", "fighter_2", "fighter_3"],
  },
  bomber: {
    family: "aircraft",
    costMilli: 30_000,
    resources: res({ aluminium: 3, rubber: 1 }),
    needPer100k: 0,
    bonus: [0, 0, 0],
    techs: ["bomber_1", "bomber_2"],
  },
};

/** Cost of a later generation, percent of generation 1. */
export const GEN_COST_PCT: readonly number[] = [100, 125, 150];

export function unitCostMilli(type: EquipmentType, gen: number): number {
  return Math.floor((EQUIPMENT[type].costMilli * GEN_COST_PCT[gen - 1]) / 100);
}

/** The tech that opens (type, gen). */
export function genTech(type: EquipmentType, gen: number): WwTechId {
  return EQUIPMENT[type].techs[gen - 1];
}
