// ww91 lane N1: per-major gear. Trucks and support items stand in for their
// own keys, real costs at the halved gap, truck wear.
import {
  DS_HIST,
  KS,
  KS_FIELDS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_EQUIP_KEYS } from "@openfront/engine-api/ww1936/LandTypes";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { HIST_CATALOGUE } from "@openfront/engine-lib/ww1936/hist/index";
import { histStaticEntry } from "@openfront/engine-lib/ww1936/hist/Slots";
import {
  HALF_GAP_MAX_PCT,
  HALF_GAP_MIN_PCT,
  halfGapCostMilli,
  staticGearCostMilli,
} from "@openfront/engine-lib/ww1936/hist/StaticCost";
import { histStaticKeyTable } from "@openfront/engine-lib/ww1936/hist/StaticKeys";
import { HIST_COUNTRIES } from "@openfront/engine-lib/ww1936/hist/Types";
import { breakdownPpm } from "@openfront/engine-lib/ww1936/hist/Wear";
import { aiRetools } from "@openfront/engine/ww1936/economy/AiEconomy";
import { describe, expect, test } from "vitest";

const TRUCK = {
  DEU: "deu_opel_blitz",
  SUN: "sun_zis5",
  USA: "usa_cckw",
  GBR: "gbr_bedford_ql",
  JPN: "jpn_type94_truck",
  ITA: "ita_fiat626",
  FRA: "fra_citroen23",
} as const;
const SUPPORT = {
  DEU: "deu_kuebelwagen",
  SUN: "sun_gaz_aa",
  USA: "usa_jeep",
  GBR: "gbr_ws18",
  JPN: "jpn_kurogane_95",
  ITA: "ita_alce",
  FRA: "fra_unic_p107",
} as const;

describe("per-major gear", () => {
  test("each major's truck stands in for the motorized key, a support item for the support key", () => {
    for (const c of HIST_COUNTRIES) {
      expect(histStaticEntry(c, "motorized", 1)?.id).toBe(TRUCK[c]);
      expect(histStaticEntry(c, "support_equipment", 1)?.id).toBe(SUPPORT[c]);
    }
  });

  test("the halved gap, within 75 to 130 % of generic", () => {
    // Generic 4.00: a 3.73 item costs 3.865; 8.00 is held to 5.20; 1.82 to 3.00.
    expect(halfGapCostMilli(4000, 3730)).toBe(3865);
    expect(halfGapCostMilli(4000, 8000)).toBe(5200);
    expect(halfGapCostMilli(4000, 1820)).toBe(3000);
    for (const c of HIST_COUNTRIES) {
      for (const type of EQUIPMENT_TYPES) {
        for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
          const generic = unitCostMilli(type, g);
          const v = staticGearCostMilli(c, type, g);
          expect(v).toBeGreaterThanOrEqual(
            Math.floor((generic * HALF_GAP_MIN_PCT) / 100),
          );
          expect(v).toBeLessThanOrEqual(
            Math.floor((generic * HALF_GAP_MAX_PCT) / 100),
          );
        }
      }
    }
    // Trucks: the Soviet ZiS-5 ($1,500) costs 2.19, the American CCKW ($4,000) 3.25.
    expect(staticGearCostMilli("SUN", "motorized", 1)).toBe(2188);
    expect(staticGearCostMilli("USA", "motorized", 1)).toBe(3250);
    // No country, a tank or a plane key: generic.
    expect(staticGearCostMilli(null, "motorized", 1)).toBe(2500);
    expect(staticGearCostMilli("DEU", "light_tank", 1)).toBe(
      unitCostMilli("light_tank", 1),
    );
  });

  test("a truck wears by its reliability, only a catalogue truck", () => {
    const j = GROUND_EQUIP_KEYS.indexOf(equipKey("motorized", 1));
    expect(j).toBeGreaterThanOrEqual(0);
    const wear = (tag: Parameters<typeof histStaticKeyTable>[0]) => {
      const t = histStaticKeyTable(tag);
      const o = j * KS_FIELDS;
      return (t.stats[o + KS.flags] & DS_HIST) === 0
        ? 0
        : breakdownPpm(t.stats[o + KS.relPm]);
    };
    expect(wear("DEU")).toBe(1750);
    expect(wear("SUN")).toBe(500);
    expect(wear("USA")).toBe(0);
    expect(wear("POL")).toBe(0);
    expect(Object.keys(HIST_CATALOGUE)).toHaveLength(7);
  });

  test("the AI does not retool a line to a generation that costs over 150 %", () => {
    const researched = new Set<WwTechId>(["anti_air_1", "anti_air_2"]);
    const k1 = equipKey("anti_air", 1);
    const lines = [{ id: 7, key: k1, effBp: 5000 }] as unknown as Parameters<
      typeof aiRetools
    >[0];
    const order = [
      { kind: "change_line", line: 7, equipment: "anti_air", gen: 2 },
    ];
    expect(aiRetools(lines, researched, 5000)).toEqual(order);
    const price = (g: number) => (key: number) =>
      key === k1 ? 4000 : key === equipKey("anti_air", 2) ? g : 0;
    expect(aiRetools(lines, researched, 5000, price(6000))).toEqual(order);
    expect(aiRetools(lines, researched, 5000, price(6100))).toEqual([]);
  });
});
