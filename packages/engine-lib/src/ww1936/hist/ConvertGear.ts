// World War 1936 historical catalogue: infantry equipment, support
// equipment and guns (artillery, anti-tank, anti-air). Their game effect is
// a small percentage around the battalion's own numbers (the owner's rule:
// the spread stays about +-10-20 %), plus a real cost. Anti-tank guns also
// give a real penetration, since the threshold rule reads it.
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { EQUIPMENT } from "../Equipment";
import { clampInt, compressPct, isqrt, resVec, roundInt } from "./Num";
import { GunEntry, InfantryEntry, SupportEntry } from "./Types";

/** What a gear entry does in the game. */
export interface GearStats {
  /** Percent of the battalion's attack and defence this equipment gives (100 = the 1936 reference). */
  statPct: number;
  /** Anti-tank guns: penetration at 500 m, centi (mm x 100); 0 otherwise. */
  pierceCenti: number;
  /** Milli industry points a unit costs. */
  costMilli: number;
  /** Resources per factory, RESOURCE_IDS order. */
  resources: number[];
}

/** Reference weapons (their stats are 100 %): Kar98k, leFH 18, PaK 36, Flak 38. */
export const REF = {
  rifle: { effRpm: 15, rangeM: 500, mm: 8, costUsd: 30 },
  signal: 15,
  artillery: { kgMin: 59, rangeM: 10_600, costK: 7 },
  anti_tank: { kgMin: 10, rangeM: 4_000, costK: 2.2 },
  anti_air: { kgMin: 25, rangeM: 2_200, costK: 1.6 },
} as const;
const SUPPORT_REF: Readonly<Record<string, number>> = {
  signal: 15,
  engineer: 30,
  medical: 50,
  recon: 150,
  transport: 300,
};
const LO = 85;
const HI = 120;

/** Infantry shoulder arm: rate of fire, range and calibre. */
export function infantryStatsOfEntry(e: InfantryEntry): GearStats {
  const s = e.spec;
  const effRpm = (s.aimedRpm * (100 + s.autoPct)) / 100;
  const rofPm = (effRpm * 1000) / REF.rifle.effRpm;
  const rangePm = (s.rangeM * 1000) / REF.rifle.rangeM;
  const calPm = isqrt(Math.floor((s.mm * 1_000_000) / REF.rifle.mm));
  const ratioPm = (2 * rofPm + rangePm + calPm) / 4;
  return {
    statPct: compressPct(ratioPm, 35, LO, HI),
    pierceCenti: 0,
    costMilli: clampInt(
      roundInt(
        (EQUIPMENT.infantry_equipment.costMilli * s.costUsd) /
          REF.rifle.costUsd,
      ),
      300,
      1200,
    ),
    resources: resVec(RESOURCE_IDS, { steel: 1 }),
  };
}

/** Support set: reach against the kind's reference, cost against 1,500 dollars. */
export function supportStatsOfEntry(e: SupportEntry): GearStats {
  const s = e.spec;
  const ratioPm = (s.rangeKm * 1000) / SUPPORT_REF[s.kind];
  return {
    statPct: compressPct(ratioPm, 25, 90, 115),
    pierceCenti: 0,
    costMilli: clampInt(
      roundInt((EQUIPMENT.support_equipment.costMilli * s.costUsd) / 1500),
      2000,
      8000,
    ),
    resources: resVec(RESOURCE_IDS, { steel: 1, aluminium: 1 }),
  };
}

/** Artillery, anti-tank and anti-air guns: weight of fire per minute and reach. */
export function gunStatsOfEntry(e: GunEntry): GearStats {
  const s = e.spec;
  const ref = REF[e.role];
  const kgMin = s.rpm * s.shellKg * s.barrels;
  const wofPm = isqrt(Math.floor((kgMin * 1_000_000) / ref.kgMin));
  const rangePm = (s.rangeM * 1000) / ref.rangeM;
  // Anti-tank: the shell's penetration is the real threshold, so the stat
  // percent leans on rate of fire and reach only.
  const ratioPm = (2 * wofPm + rangePm) / 3;
  const base = EQUIPMENT[e.role].costMilli;
  return {
    statPct: compressPct(ratioPm, 40, LO, HI),
    pierceCenti: e.role === "anti_tank" ? 100 * s.penMm500 : 0,
    costMilli: clampInt(
      roundInt((base * s.costK) / ref.costK),
      Math.floor(base / 3),
      base * 4,
    ),
    resources:
      e.role === "anti_air"
        ? resVec(RESOURCE_IDS, { steel: 1, aluminium: 1 })
        : resVec(RESOURCE_IDS, { steel: 2, tungsten: 1 }),
  };
}
