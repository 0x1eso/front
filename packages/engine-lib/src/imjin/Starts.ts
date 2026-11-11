// ww177 (Imjin design §1, §8, §10): the countries' starts and economies, as
// data. Two starts: the 1590 embassy (the run-up) and the eve of the 1592
// landing. The war's own units are P1's; until then the starts are read
// through the 1936 economy's slots: men (`army`), rifles in reserve, guns
// (artillery) and support (the baggage and engineers). History is the guide,
// not a script: the numbers are a plausible start, and the state decides
// the rest.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  CountryLaws,
  EquipmentType,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";

export interface ImjinStart {
  readonly laws: CountryLaws;
  /** Men under arms at the start. */
  readonly army: number;
  /** Infantry equipment in reserve (not in the field). */
  readonly infReserve: number;
  /** Generation-1 equipment. */
  readonly stock: Readonly<Partial<Record<EquipmentType, number>>>;
  readonly techs: readonly WwTechId[];
  readonly researchSlots: number;
}

export type ImjinStartId = "y1590" | "y1592";

const BASE_TECHS: readonly WwTechId[] = ["inf_eq_1", "support_eq_1"];
/** Joseon's chongtong and Ming's field guns. */
const GUN_TECHS: readonly WwTechId[] = [...BASE_TECHS, "artillery_1"];

/** The countries the Imjin map holds; a tag not here starts as a minor. */
export const IMJIN_STARTS: Readonly<
  Record<ImjinStartId, Readonly<Partial<Record<CountryTag, ImjinStart>>>>
> = {
  // 1590: Japan is one realm after Odawara and musters; Joseon's army has
  // not fought for generations; Ming's strength lies far from Korea.
  y1590: {
    JOS: {
      laws: {
        economy: "civilian",
        trade: "limited_exports",
        conscription: "limited",
      },
      army: 45_000,
      infReserve: 600,
      stock: { artillery: 300, support_equipment: 150 },
      techs: GUN_TECHS,
      researchSlots: 3,
    },
    JPN: {
      laws: {
        economy: "partial_mobilization",
        trade: "export_focus",
        conscription: "extensive",
      },
      army: 120_000,
      infReserve: 1_500,
      stock: { artillery: 40, support_equipment: 400 },
      techs: BASE_TECHS,
      researchSlots: 3,
    },
    MIN: {
      laws: {
        economy: "civilian",
        trade: "closed_economy",
        conscription: "limited",
      },
      army: 90_000,
      infReserve: 1_000,
      stock: { artillery: 500, support_equipment: 300 },
      techs: GUN_TECHS,
      researchSlots: 3,
    },
    JUR: {
      laws: {
        economy: "civilian",
        trade: "export_focus",
        conscription: "extensive",
      },
      army: 12_000,
      infReserve: 100,
      stock: { support_equipment: 30 },
      techs: BASE_TECHS,
      researchSlots: 2,
    },
  },
  // 1592: Japan's nine divisions stand at Nagoya; Joseon has walled a few
  // towns and is still unready.
  y1592: {
    JOS: {
      laws: {
        economy: "civilian",
        trade: "limited_exports",
        conscription: "limited",
      },
      army: 55_000,
      infReserve: 800,
      stock: { artillery: 350, support_equipment: 180 },
      techs: GUN_TECHS,
      researchSlots: 3,
    },
    JPN: {
      laws: {
        economy: "war_economy",
        trade: "limited_exports",
        conscription: "service",
      },
      army: 160_000,
      infReserve: 2_500,
      stock: { artillery: 60, support_equipment: 600 },
      techs: BASE_TECHS,
      researchSlots: 3,
    },
    MIN: {
      laws: {
        economy: "civilian",
        trade: "closed_economy",
        conscription: "limited",
      },
      army: 90_000,
      infReserve: 1_000,
      stock: { artillery: 500, support_equipment: 300 },
      techs: GUN_TECHS,
      researchSlots: 3,
    },
    JUR: {
      laws: {
        economy: "civilian",
        trade: "export_focus",
        conscription: "extensive",
      },
      army: 15_000,
      infReserve: 150,
      stock: { support_equipment: 40 },
      techs: BASE_TECHS,
      researchSlots: 2,
    },
  },
};

/** A country the table does not list: a small realm. */
const MINOR_START: ImjinStart = {
  laws: { economy: "civilian", trade: "export_focus", conscription: "limited" },
  army: 5_000,
  infReserve: 50,
  stock: {},
  techs: BASE_TECHS,
  researchSlots: 2,
};

export function imjinStartOf(start: ImjinStartId, tag: CountryTag): ImjinStart {
  return IMJIN_STARTS[start][tag] ?? MINOR_START;
}
