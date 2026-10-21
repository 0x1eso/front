import { AIR_TYPES, AirType } from "@openfront/engine-api/ww1936/AirTypes";
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  CountryLaws,
  EQUIP_KEY_COUNT,
  equipKey,
  EquipmentType,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";

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
]);

/** A minor with this many civilian factories counts as developed (§11.3). */
export const DEVELOPED_CIV = 4;

export function startLaws(tag: CountryTag): CountryLaws {
  const m = MAJOR_START[tag];
  if (m !== undefined) return { ...m.laws };
  return {
    economy: "civilian",
    trade: "export_focus",
    conscription: VOLUNTEER.has(tag) ? "volunteer" : "limited",
  };
}

export function startArmy(tag: CountryTag, recruitable: number): number {
  return (
    MAJOR_START[tag]?.army ??
    Math.max(1000, Math.floor((recruitable * 30) / 100))
  );
}

export function startTechs(tag: CountryTag, civ: number): WwTechId[] {
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
): number[] {
  const out = new Array<number>(EQUIP_KEY_COUNT).fill(0);
  const put = (t: EquipmentType, n: number) => {
    out[equipKey(t, 1)] += n;
  };
  const m = MAJOR_START[tag];
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
): WwTechId[] {
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
