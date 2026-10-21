// World War 1936 P2: the battalion and support company tables (P2 spec
// §4.1, §4.2). Units: attack, defence, armour, pierce centi; HP, org and
// supply milli; hardness ‰; speed centi-km/h.
import {
  EquipmentType,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  SupportId,
  TPL_ENGINEER,
  TPL_HOSPITAL,
  TPL_LOGISTICS,
  TPL_RECON,
  TPL_SIGNAL,
} from "@openfront/engine-api/ww1936/LandTypes";

export type BattalionKind =
  | "infantry"
  | "cavalry"
  | "special"
  | "motor"
  | "artillery"
  | "gun"
  | "armor";

export interface BattalionDef {
  kind: BattalionKind;
  width: number;
  men: number;
  /** Main equipment first: it scales the battalion (spec §4.3). */
  equip: readonly (readonly [EquipmentType, number])[];
  hpMilli: number;
  orgMilli: number;
  soft: number;
  hard: number;
  def: number;
  brk: number;
  pierce: number;
  armor: number;
  hardnessPm: number;
  speedCenti: number;
  supplyMilli: number;
  trainDays: number;
  /** P4 spec §10.5: convoy weight, centi (infantry 0.5 → 50). */
  weightCenti: number;
  /** P4 spec §14.6: air attack against planes (anti-air battalion 20). */
  airAtk: number;
  techs: readonly WwTechId[];
  /** Mountain, marine and paratrooper count against the special cap (spec §4.1). */
  special: boolean;
  /** Gets firepower_1's soft attack (artillery kinds). */
  artillery: boolean;
}

type Row = Omit<BattalionDef, "kind" | "special" | "artillery">;
const b = (
  kind: BattalionKind,
  r: Row,
  special = false,
  artillery = false,
): BattalionDef => ({ kind, ...r, special, artillery });

export const BATTALIONS: Readonly<Record<BattalionId, BattalionDef>> = {
  infantry: b("infantry", {
    width: 2,
    men: 1000,
    equip: [["infantry_equipment", 100]],
    hpMilli: 25_000,
    orgMilli: 60_000,
    soft: 600,
    hard: 100,
    def: 2200,
    brk: 300,
    pierce: 400,
    armor: 0,
    hardnessPm: 0,
    speedCenti: 400,
    supplyMilli: 70,
    trainDays: 90,
    weightCenti: 50,
    airAtk: 0,
    techs: ["inf_eq_1"],
  }),
  cavalry: b("cavalry", {
    width: 2,
    men: 1000,
    equip: [["infantry_equipment", 120]],
    hpMilli: 25_000,
    orgMilli: 70_000,
    soft: 600,
    hard: 100,
    def: 2000,
    brk: 400,
    pierce: 400,
    armor: 0,
    hardnessPm: 0,
    speedCenti: 600,
    supplyMilli: 100,
    trainDays: 90,
    weightCenti: 50,
    airAtk: 0,
    techs: [],
  }),
  mountain: b(
    "special",
    {
      width: 2,
      men: 1000,
      equip: [
        ["infantry_equipment", 100],
        ["support_equipment", 20],
      ],
      hpMilli: 20_000,
      orgMilli: 70_000,
      soft: 600,
      hard: 100,
      def: 2200,
      brk: 400,
      pierce: 400,
      armor: 0,
      hardnessPm: 0,
      speedCenti: 400,
      supplyMilli: 80,
      trainDays: 120,
      weightCenti: 50,
      airAtk: 0,
      techs: ["mountaineers"],
    },
    true,
  ),
  marine: b(
    "special",
    {
      width: 2,
      men: 1000,
      equip: [
        ["infantry_equipment", 100],
        ["support_equipment", 20],
      ],
      hpMilli: 20_000,
      orgMilli: 70_000,
      soft: 600,
      hard: 100,
      def: 2200,
      brk: 400,
      pierce: 400,
      armor: 0,
      hardnessPm: 0,
      speedCenti: 400,
      supplyMilli: 80,
      trainDays: 120,
      weightCenti: 50,
      airAtk: 0,
      techs: ["marines"],
    },
    true,
  ),
  paratrooper: b(
    "special",
    {
      width: 2,
      men: 1000,
      equip: [
        ["infantry_equipment", 100],
        ["support_equipment", 30],
      ],
      hpMilli: 20_000,
      orgMilli: 70_000,
      soft: 600,
      hard: 100,
      def: 2000,
      brk: 400,
      pierce: 400,
      armor: 0,
      hardnessPm: 0,
      speedCenti: 400,
      supplyMilli: 80,
      trainDays: 150,
      weightCenti: 50,
      airAtk: 0,
      techs: ["paratroopers"],
    },
    true,
  ),
  motorized: b("motor", {
    width: 2,
    men: 1000,
    equip: [
      ["infantry_equipment", 100],
      ["motorized", 35],
    ],
    hpMilli: 25_000,
    orgMilli: 60_000,
    soft: 600,
    hard: 100,
    def: 2200,
    brk: 400,
    pierce: 400,
    armor: 0,
    hardnessPm: 100,
    speedCenti: 1200,
    supplyMilli: 150,
    trainDays: 90,
    weightCenti: 75,
    airAtk: 0,
    techs: ["motorized_1"],
  }),
  artillery: b(
    "artillery",
    {
      width: 3,
      men: 500,
      equip: [["artillery", 12]],
      hpMilli: 600,
      orgMilli: 0,
      soft: 2500,
      hard: 200,
      def: 1000,
      brk: 600,
      pierce: 500,
      armor: 0,
      hardnessPm: 0,
      speedCenti: 400,
      supplyMilli: 200,
      trainDays: 90,
      weightCenti: 50,
      airAtk: 0,
      techs: ["artillery_1"],
    },
    false,
    true,
  ),
  mot_artillery: b(
    "artillery",
    {
      width: 3,
      men: 500,
      equip: [
        ["artillery", 12],
        ["motorized", 12],
      ],
      hpMilli: 600,
      orgMilli: 0,
      soft: 2500,
      hard: 200,
      def: 1000,
      brk: 600,
      pierce: 500,
      armor: 0,
      hardnessPm: 100,
      speedCenti: 1200,
      supplyMilli: 300,
      trainDays: 90,
      weightCenti: 75,
      airAtk: 0,
      techs: ["artillery_1", "motorized_1"],
    },
    false,
    true,
  ),
  anti_tank: b("gun", {
    width: 1,
    men: 500,
    equip: [["anti_tank", 12]],
    hpMilli: 600,
    orgMilli: 0,
    soft: 400,
    hard: 1500,
    def: 400,
    brk: 100,
    pierce: 5000,
    armor: 0,
    hardnessPm: 0,
    speedCenti: 400,
    supplyMilli: 150,
    trainDays: 90,
    weightCenti: 50,
    airAtk: 0,
    techs: ["anti_tank_1"],
  }),
  anti_air: b("gun", {
    width: 1,
    men: 500,
    equip: [["anti_air", 12]],
    hpMilli: 600,
    orgMilli: 0,
    soft: 300,
    hard: 700,
    def: 400,
    brk: 100,
    pierce: 2500,
    armor: 0,
    hardnessPm: 0,
    speedCenti: 400,
    supplyMilli: 150,
    trainDays: 90,
    weightCenti: 50,
    airAtk: 20,
    techs: ["anti_air_1"],
  }),
  light_armor: b("armor", {
    width: 2,
    men: 500,
    equip: [["light_tank", 60]],
    hpMilli: 2000,
    orgMilli: 10_000,
    soft: 1200,
    hard: 400,
    def: 400,
    brk: 2200,
    pierce: 1500,
    armor: 1000,
    hardnessPm: 800,
    speedCenti: 800,
    supplyMilli: 600,
    trainDays: 120,
    weightCenti: 100,
    airAtk: 0,
    techs: ["light_tank_1"],
  }),
  medium_armor: b("armor", {
    width: 2,
    men: 500,
    equip: [["medium_tank", 50]],
    hpMilli: 2000,
    orgMilli: 10_000,
    soft: 2000,
    hard: 1200,
    def: 600,
    brk: 3500,
    pierce: 4500,
    armor: 4000,
    hardnessPm: 900,
    speedCenti: 600,
    supplyMilli: 800,
    trainDays: 150,
    weightCenti: 150,
    airAtk: 0,
    techs: ["medium_tank_1"],
  }),
};

export interface SupportDef {
  men: number;
  /** P4 spec §10.5: every company 0.1 → 10 (centi). */
  weightCenti: number;
  /** P4 spec §14.6: the support anti-air company 10. */
  airAtk: number;
  equip: readonly (readonly [EquipmentType, number])[];
  hpMilli: number;
  soft: number;
  hard: number;
  def: number;
  brk: number;
  pierce: number;
  flag: number;
  techs: readonly WwTechId[];
  artillery: boolean;
}

const s = (
  r: Partial<SupportDef> & Pick<SupportDef, "men" | "equip" | "techs">,
): SupportDef => ({
  weightCenti: 10,
  airAtk: 0,
  hpMilli: 0,
  soft: 0,
  hard: 0,
  def: 0,
  brk: 0,
  pierce: 0,
  flag: 0,
  artillery: false,
  ...r,
});

export const SUPPORTS: Readonly<Record<SupportId, SupportDef>> = {
  engineer: s({
    men: 300,
    equip: [["support_equipment", 20]],
    flag: TPL_ENGINEER,
    techs: ["engineer_company"],
  }),
  recon: s({
    men: 200,
    equip: [["support_equipment", 15]],
    flag: TPL_RECON,
    techs: ["recon_company"],
  }),
  support_artillery: s({
    men: 300,
    equip: [["artillery", 12]],
    hpMilli: 200,
    soft: 1500,
    hard: 100,
    def: 500,
    brk: 200,
    pierce: 500,
    techs: ["artillery_1", "support_eq_1"],
    artillery: true,
  }),
  support_anti_tank: s({
    men: 200,
    equip: [["anti_tank", 8]],
    hpMilli: 200,
    hard: 800,
    def: 200,
    pierce: 4500,
    techs: ["anti_tank_1", "support_eq_1"],
  }),
  support_anti_air: s({
    men: 200,
    airAtk: 10,
    equip: [["anti_air", 8]],
    hpMilli: 200,
    soft: 200,
    hard: 400,
    pierce: 2000,
    techs: ["anti_air_1", "support_eq_1"],
  }),
  field_hospital: s({
    men: 300,
    equip: [["support_equipment", 20]],
    flag: TPL_HOSPITAL,
    techs: ["field_hospital"],
  }),
  logistics: s({
    men: 300,
    equip: [
      ["support_equipment", 15],
      ["motorized", 10],
    ],
    flag: TPL_LOGISTICS,
    techs: ["logistics_company"],
  }),
  signal: s({
    men: 200,
    equip: [["support_equipment", 15]],
    flag: TPL_SIGNAL,
    techs: ["signal_company"],
  }),
  // P5 (P5 spec §8.5): no attack or defence; its suppression is
  // EndgameRules.SUPPORT_SUPPRESS (no new column here).
  military_police: s({
    men: 300,
    equip: [["support_equipment", 10]],
    techs: ["military_police"],
  }),
};
