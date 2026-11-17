import { AIR_TYPES, AirType } from "@openfront/engine-api/ww1936/AirTypes";
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  CountryLaws,
  EQUIP_KEY_COUNT,
  equipKey,
  EquipmentType,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { ImjinStartId, imjinStartOf } from "../imjin/Starts";

export interface MajorStart {
  laws: CountryLaws;
  army: number;
  extraTechs: readonly WwTechId[];
  /** Infantry equipment in reserve (not in the field). */
  infReserve: number;
  /** Generation-1 units. */
  stock: Readonly<Partial<Record<EquipmentType, number>>>;
}

const MAJOR_TECHS: readonly WwTechId[] = [
  "inf_eq_1",
  "support_eq_1",
  "artillery_1",
  "motorized_1",
  "light_tank_1",
  "fighter_1",
  "bomber_1",
];

// Spec §11.1.
export const MAJOR_START: Readonly<Partial<Record<CountryTag, MajorStart>>> = {
  DEU: {
    laws: {
      economy: "partial_mobilization",
      trade: "limited_exports",
      conscription: "limited",
    },
    army: 480_000,
    extraTechs: ["anti_tank_1", "anti_air_1", "construction_1", "tools_1"],
    infReserve: 15_000,
    stock: {
      support_equipment: 1_000,
      artillery: 3_000,
      anti_tank: 800,
      anti_air: 600,
      motorized: 4_000,
      light_tank: 1_500,
      fighter: 650,
      bomber: 700,
    },
  },
  ITA: {
    laws: {
      economy: "partial_mobilization",
      trade: "limited_exports",
      conscription: "limited",
    },
    army: 800_000,
    extraTechs: ["anti_air_1"],
    infReserve: 10_000,
    stock: {
      support_equipment: 600,
      artillery: 4_000,
      anti_tank: 200,
      anti_air: 300,
      motorized: 3_000,
      light_tank: 1_000,
      fighter: 700,
      bomber: 600,
    },
  },
  JPN: {
    laws: {
      economy: "early_mobilization",
      trade: "limited_exports",
      conscription: "limited",
    },
    army: 300_000,
    extraTechs: ["tools_1"],
    infReserve: 8_000,
    stock: {
      support_equipment: 400,
      artillery: 2_000,
      anti_tank: 100,
      anti_air: 200,
      motorized: 2_000,
      light_tank: 400,
      fighter: 900,
      bomber: 600,
    },
  },
  GBR: {
    laws: {
      economy: "civilian",
      trade: "free_trade",
      conscription: "volunteer",
    },
    army: 250_000,
    extraTechs: ["anti_air_1", "tools_1"],
    infReserve: 12_000,
    stock: {
      support_equipment: 800,
      artillery: 2_500,
      anti_tank: 200,
      anti_air: 400,
      motorized: 8_000,
      light_tank: 400,
      fighter: 900,
      bomber: 800,
    },
  },
  FRA: {
    laws: {
      economy: "civilian",
      trade: "export_focus",
      conscription: "extensive",
    },
    army: 650_000,
    extraTechs: ["anti_tank_1"],
    infReserve: 25_000,
    stock: {
      support_equipment: 1_000,
      artillery: 10_000,
      anti_tank: 1_000,
      anti_air: 300,
      motorized: 6_000,
      light_tank: 3_000,
      fighter: 800,
      bomber: 700,
    },
  },
  USA: {
    laws: {
      economy: "civilian",
      trade: "export_focus",
      conscription: "volunteer",
    },
    army: 180_000,
    extraTechs: ["construction_1", "tools_1", "electronics_1"],
    infReserve: 20_000,
    stock: {
      support_equipment: 500,
      artillery: 2_000,
      anti_tank: 100,
      anti_air: 300,
      motorized: 10_000,
      light_tank: 300,
      fighter: 900,
      bomber: 600,
    },
  },
  SUN: {
    laws: {
      economy: "partial_mobilization",
      trade: "closed_economy",
      conscription: "limited",
    },
    army: 1_300_000,
    extraTechs: ["anti_air_1", "construction_1"],
    infReserve: 40_000,
    stock: {
      support_equipment: 2_000,
      artillery: 15_000,
      anti_tank: 1_000,
      anti_air: 1_000,
      motorized: 8_000,
      light_tank: 10_000,
      fighter: 2_500,
      bomber: 2_000,
    },
  },
};

const VOLUNTEER: ReadonlySet<CountryTag> = new Set<CountryTag>([
  "CAN",
  "AUS",
  "NZL",
  "ZAF",
  "RAJ",
  "IRL",
  // Balance patch (w7-bal): Poland fields 60 % of its recruits (25 -> 15 permille).
  "POL",
]);

/** A minor with this many civilian factories counts as developed (§11.3). */
export const DEVELOPED_CIV = 4;

/**
 * The start functions below take `imjin`, the Imjin War's start
 * (Profile.imjinCalendarOf(...).start), or null for 1936's (ww177).
 */
export function startLaws(
  tag: CountryTag,
  imjin: ImjinStartId | null = null,
): CountryLaws {
  if (imjin !== null) return { ...imjinStartOf(imjin, tag).laws };
  const m = MAJOR_START[tag];
  if (m !== undefined) return { ...m.laws };
  return {
    economy: "civilian",
    trade: "export_focus",
    conscription: VOLUNTEER.has(tag) ? "volunteer" : "limited",
  };
}

/**
 * ww236: a tier-A minor's 1936 start beyond the map's buildings, on the
 * world map's historical order of battle only (like REFINERY_START). Rough
 * proportions of HOI4's 1936 starts against this game's majors: no tier-A
 * minor opens with a single factory, the real industrial or army powers
 * among them (Poland, Czechoslovakia, Sweden, China, Brazil, the
 * dominions) get several, a dockyard goes only where there was a navy.
 * Spain is left as it is (the owner's call).
 */
export interface MinorStart {
  /**
   * Added to the map's own buildings: [region name (one of the country's
   * own 1936 regions), civilian factories, military factories, dockyards].
   */
  factories: readonly (readonly [string, number, number, number])[];
  /** The 1936 army in divisions of its first template, instead of P2's generic count. */
  divisions?: number;
}

export const MINOR_START: Readonly<Partial<Record<CountryTag, MinorStart>>> = {
  // 7/2/1 -> 9/4/1. Warsaw, Upper Silesia, the Central Industrial Region
  // (Stalowa Wola, Mielec). Some 30 infantry divisions in 1939.
  POL: {
    factories: [
      ["Masovian", 1, 0, 0],
      ["Silesian", 1, 1, 0],
      ["Subcarpathian", 0, 1, 0],
    ],
    divisions: 20,
  },
  // 2/1/0 -> 4/2/0. Csepel (Manfred Weiss), Diósgyőr steel.
  HUN: {
    factories: [
      ["Budapest", 1, 1, 0],
      ["Borsod-Abaúj-Zemplén", 1, 0, 0],
    ],
    divisions: 8,
  },
  // 2/1/0 -> 4/2/0. Ploiești oil, Bucharest, the Reșița works.
  ROU: {
    factories: [
      ["Prahova", 1, 0, 0],
      ["Bucharest", 1, 0, 0],
      ["Timis", 0, 1, 0],
    ],
    divisions: 14,
  },
  // 6/6/0 -> 8/6/0. Prague, Ostrava (Vítkovice); Škoda is on the map already.
  CSK: {
    factories: [
      ["Prague", 1, 0, 0],
      ["Moravskoslezský", 1, 0, 0],
    ],
    divisions: 16,
  },
  // 2/1/0 -> 4/2/0. Belgrade, Zagreb.
  YUG: {
    factories: [
      ["Grad Beograd", 1, 1, 0],
      ["Grad Zagreb", 1, 0, 0],
    ],
    divisions: 12,
  },
  // 1/0/0 -> 3/1/0. Tampere (Tampella), Helsinki. Nine divisions in 1939.
  FIN: {
    factories: [
      ["Pirkanmaa", 1, 1, 0],
      ["Uusimaa", 1, 0, 0],
    ],
    divisions: 8,
  },
  // 4/2/2 -> 6/3/2. Gothenburg, Malmö, Bofors (Karlskoga).
  SWE: {
    factories: [
      ["Västra Götaland", 1, 0, 0],
      ["Skåne", 1, 0, 0],
      ["Orebro", 0, 1, 0],
    ],
    divisions: 6,
  },
  // 1/0/0 -> 2/1/1. Thessaloniki, the Piraeus arsenal and Salamis yard.
  GRC: {
    factories: [
      ["Kentriki Makedonia", 1, 0, 0],
      ["Attiki", 0, 1, 1],
    ],
    divisions: 6,
  },
  // 1/0/0 -> 2/1/0. Plovdiv, the Sofia arsenal.
  BGR: {
    factories: [
      ["Plovdiv", 1, 0, 0],
      ["Grad Sofiya", 0, 1, 0],
    ],
    divisions: 6,
  },
  // 1/0/0 -> 2/1/1. Bergen, Kongsberg, the Horten naval yard.
  NOR: {
    factories: [
      ["Hordaland", 1, 0, 0],
      ["Buskerud", 0, 1, 0],
      ["Oslo", 0, 0, 1],
    ],
    divisions: 4,
  },
  // 6/2/3 -> 7/3/3. Arnhem, the Bandung arms works in the Indies.
  NLD: {
    factories: [
      ["Gelderland", 1, 0, 0],
      ["Batavia", 0, 1, 0],
    ],
  },
  // 6/2/1 -> 7/3/1. FN and the Liège-Brussels industry.
  BEL: {
    factories: [["Brussels", 1, 1, 0]],
    divisions: 12,
  },
  // 1/0/0 -> 2/1/1. Lisbon, its army arsenal and naval yard.
  PRT: {
    factories: [["Lisboa", 1, 1, 1]],
    divisions: 5,
  },
  // 2/1/0 -> 4/2/1. Istanbul (the Golden Horn and Gölcük yards), the
  // Ankara arms works (MKE), Izmir.
  TUR: {
    factories: [
      ["Istanbul", 1, 0, 1],
      ["Ankara", 0, 1, 0],
      ["Izmir", 1, 0, 0],
    ],
    divisions: 14,
  },
  // 4/1/0 -> 6/2/1. São Paulo, Minas Gerais, the Rio navy arsenal.
  BRA: {
    factories: [
      ["São Paulo", 1, 0, 0],
      ["Minas Gerais", 1, 0, 0],
      ["Rio de Janeiro", 0, 1, 1],
    ],
    divisions: 16,
  },
  // 3/1/0 -> 5/2/1. Buenos Aires and its naval yard, Rosario, the Córdoba
  // military aircraft factory.
  ARG: {
    factories: [
      ["Ciudad de Buenos Aires", 1, 0, 1],
      ["Santa Fe", 1, 0, 0],
      ["Córdoba", 0, 1, 0],
    ],
    divisions: 10,
  },
  // 2/1/0 -> 3/1/0. Monterrey steel.
  MEX: {
    factories: [["Nuevo León", 1, 0, 0]],
  },
  // 6/2/1 -> 8/4/1. Wuhan (the Hanyang arsenal), Nanjing, the Jiangnan
  // arsenal. Its army is the generic cap already (50).
  CHN: {
    factories: [
      ["Hubei", 1, 1, 0],
      ["Jiangsu", 1, 0, 0],
      ["Shanghai", 0, 1, 0],
    ],
  },
  // 1/0/0 -> 1/1/0. The Yan'an arsenal; some 30,000 men after the Long March.
  CCP: {
    factories: [["Yan'an", 0, 1, 0]],
    divisions: 3,
  },
  // 3/1/0 -> 4/2/0. Mukden (its arsenal), Anshan steel.
  MCK: {
    factories: [["Liaoning", 1, 1, 0]],
  },
  // 4/1/2 -> 6/2/2. Ontario's and Quebec's industry.
  CAN: {
    factories: [
      ["Ontario (SE)", 1, 1, 0],
      ["Québec (S)", 1, 0, 0],
    ],
    divisions: 5,
  },
  // 3/1/2 -> 4/2/2. Newcastle (BHP), the Footscray and Maribyrnong works.
  AUS: {
    factories: [
      ["New South Wales", 1, 0, 0],
      ["Victoria", 0, 1, 0],
    ],
    divisions: 4,
  },
  // 2/1/0 -> 3/2/0. The Witwatersrand, Pretoria.
  ZAF: {
    factories: [["Gauteng", 1, 1, 0]],
    divisions: 5,
  },
};

/** A MINOR_START army's men per division: its rifles and guns cover the divisions. */
export const MINOR_START_MEN_PER_DIVISION = 10_000;

/** The MINOR_START divisions on the historical order of battle, else undefined. */
export function minorStartDivisions(
  tag: CountryTag,
  historical: boolean,
): number | undefined {
  return historical ? MINOR_START[tag]?.divisions : undefined;
}

export function startArmy(
  tag: CountryTag,
  recruitable: number,
  imjin: ImjinStartId | null = null,
  historical = false,
): number {
  if (imjin !== null) return imjinStartOf(imjin, tag).army;
  const major = MAJOR_START[tag]?.army;
  if (major !== undefined) return major;
  const generic = Math.max(1000, Math.floor((recruitable * 30) / 100));
  const divs = minorStartDivisions(tag, historical);
  return divs === undefined
    ? generic
    : Math.max(generic, divs * MINOR_START_MEN_PER_DIVISION);
}

export function startTechs(
  tag: CountryTag,
  civ: number,
  imjin: ImjinStartId | null = null,
): WwTechId[] {
  if (imjin !== null) return [...imjinStartOf(imjin, tag).techs];
  const m = MAJOR_START[tag];
  if (m !== undefined) return [...MAJOR_TECHS, ...m.extraTechs];
  const out: WwTechId[] = ["inf_eq_1", "support_eq_1", "artillery_1"];
  if (civ >= DEVELOPED_CIV) out.push("motorized_1", "fighter_1");
  return out;
}

/** Stock in EQUIP_KEYS order, all generation 1 (spec §11). */
export function startStock(
  tag: CountryTag,
  army: number,
  civ: number,
  mil: number,
  imjin: ImjinStartId | null = null,
): number[] {
  const out = new Array<number>(EQUIP_KEY_COUNT).fill(0);
  const put = (t: EquipmentType, n: number) => {
    out[equipKey(t, 1)] += n;
  };
  const m = imjin !== null ? imjinStartOf(imjin, tag) : MAJOR_START[tag];
  if (m !== undefined) {
    put("infantry_equipment", m.infReserve);
    for (const [t, n] of Object.entries(m.stock)) put(t as EquipmentType, n);
    return out;
  }
  put("infantry_equipment", Math.floor(army / 100));
  put("artillery", Math.floor((army * 400 * 30) / 10_000_000));
  put("support_equipment", Math.floor((army * 300 * 20) / 10_000_000));
  if (civ >= DEVELOPED_CIV) put("fighter", (civ + mil) * 10);
  return out;
}

/**
 * Research overhaul (changes §1.2): the research slots a country starts
 * with — a major 3, the United States and the Soviet Union 4, any other
 * country (a dormant slot when it wakes too) 2. Factories no longer add
 * slots; focuses and the decision do (research_slot).
 */
export const START_RESEARCH_SLOTS: Readonly<
  Partial<Record<CountryTag, number>>
> = { USA: 4, SUN: 4 };

export function startResearchSlots(
  tag: CountryTag,
  imjin: ImjinStartId | null = null,
): number {
  if (imjin !== null) return imjinStartOf(imjin, tag).researchSlots;
  return START_RESEARCH_SLOTS[tag] ?? (isMajor(tag) ? 3 : 2);
}

export function isMajor(tag: CountryTag): boolean {
  return COUNTRIES[tag].major;
}

// ---- P4 (P4 spec §4.3, §12.3, §12.4, §15.2) ----

/** Spec §4.3, §12.3: the navy and air techs of 1936 (generation 1 is open to all). */
const NAVAL_START: Readonly<Partial<Record<CountryTag, readonly WwTechId[]>>> =
  {
    GBR: [
      "dd_2",
      "cl_2",
      "ca_2",
      "bb_2",
      "cv_2",
      "ss_2",
      "sonar_1",
      "carrier_aviation",
      "naval_bomber_1",
      "strat_bomber_1",
    ],
    USA: [
      "dd_2",
      "cl_2",
      "ca_2",
      "bb_2",
      "cv_2",
      "ss_2",
      "carrier_aviation",
      "naval_bomber_1",
      "cas_1",
    ],
    JPN: [
      "dd_2",
      "cl_2",
      "ca_2",
      "bb_2",
      "cv_2",
      "ss_2",
      "torpedo_1",
      "carrier_aviation",
      "naval_bomber_1",
    ],
    FRA: ["dd_2", "cl_2", "ca_2", "bc_2", "bb_2", "ss_2", "heavy_fighter_1"],
    ITA: ["dd_2", "cl_2", "ca_2", "bb_2", "ss_2", "naval_bomber_1"],
    DEU: [
      "dd_2",
      "cl_2",
      "ca_2",
      "bc_2",
      "bb_2",
      "ss_2",
      "cas_1",
      "heavy_fighter_1",
      "transport_plane_1",
      "synthetic_oil_1",
    ],
    SUN: [
      "dd_2",
      "cl_2",
      "ss_2",
      "cas_1",
      "strat_bomber_1",
      "transport_plane_1",
    ],
  };

/**
 * Spec §4.3, §12.3: a country's 1936 navy and air techs, by tag on every
 * map; any other developed (dev ≥ 3) country with a coast `dd_2 ss_2`.
 */
export function navalStartTechs(
  tag: CountryTag,
  dev: number,
  coastal: boolean,
  imjin: ImjinStartId | null = null,
): WwTechId[] {
  // ww177: the Imjin War's navy is its own layer (design §6).
  if (imjin !== null) return [];
  const m = NAVAL_START[tag];
  if (m !== undefined) return [...m];
  return dev >= 3 && coastal ? ["dd_2", "ss_2"] : [];
}

/** P1's fighter stock splits over these (spec §12.4); its bombers over the other AIR_TYPES. */
const FIGHTER_LIKE: readonly AirType[] = [
  "fighter",
  "heavy_fighter",
  "cv_fighter",
];

/**
 * Spec §12.4 (historical order of battle only): the stock's generation-1
 * fighters and bombers dealt over `split` (AIR_TYPES order). The sums stay
 * P1's: a row that does not add up is scaled into them, the remainder
 * staying with the fighter or the bomber.
 */
export function splitStartPlanes(
  stock: number[],
  split: readonly number[] | undefined,
): void {
  if (split === undefined) return;
  const groups: [AirType, readonly AirType[]][] = [
    ["fighter", FIGHTER_LIKE],
    ["bomber", AIR_TYPES.filter((t) => !FIGHTER_LIKE.includes(t))],
  ];
  for (const [main, group] of groups) {
    const mk = equipKey(main, 1);
    const pool = stock[mk];
    let total = 0;
    for (const t of group) total += split[AIR_TYPES.indexOf(t)] ?? 0;
    if (total <= 0) continue;
    let given = 0;
    for (const t of group) {
      if (t === main) continue;
      const n = Math.floor((pool * (split[AIR_TYPES.indexOf(t)] ?? 0)) / total);
      stock[equipKey(t, 1)] += n;
      given += n;
    }
    stock[mk] = pool - given;
  }
}

/** Spec §12.1 (historical order of battle only): Germany's two synthetic fuel plants (Leuna, Pölitz). */
export const REFINERY_START: Readonly<
  Partial<Record<CountryTag, readonly (readonly [string, number])[]>>
> = {
  DEU: [
    ["Sachsen-Anhalt", 1],
    ["Pomerania", 1],
  ],
};

/** Spec §15.2 (historical order of battle only): Japan's six fuel silos, at its home naval fuel depots. */
export const SILO_START: Readonly<
  Partial<Record<CountryTag, readonly (readonly [string, number])[]>>
> = {
  JPN: [
    ["Tokyo", 2],
    ["Hiroshima", 2],
    ["Nagasaki", 2], // Sasebo (map v5: carved out of Kumamoto)
  ],
};
