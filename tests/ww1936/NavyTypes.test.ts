// World War 1936 P4 (plan Task 1 Step 25): the lists the wire and the
// snapshots store by position, appended after P3's.
import { WwOrderSchema } from "@openfront/engine-api/Schemas";
import { AIR_ORDER_KINDS } from "@openfront/engine-api/ww1936/AirTypes";
import {
  BUILDING_IDS,
  EQUIP_KEY_COUNT,
  EQUIP_KEYS,
  WW_ORDER_BLOCKS,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_EQUIPMENT,
  GROUND_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  FLEET_MISSIONS,
  NAVY_ORDER_KINDS,
  SHIP_CLASSES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { effectGroup } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { WW_STAT_KEYS } from "@openfront/engine-api/ww1936/PoliticsTypes";

/** EQUIP_KEYS before P4 (P1–P3): the first 23 slots stay where they were. */
const P3_EQUIP_KEYS = [
  ["infantry_equipment", 1],
  ["infantry_equipment", 2],
  ["infantry_equipment", 3],
  ["support_equipment", 1],
  ["support_equipment", 2],
  ["artillery", 1],
  ["artillery", 2],
  ["artillery", 3],
  ["anti_tank", 1],
  ["anti_tank", 2],
  ["anti_air", 1],
  ["anti_air", 2],
  ["motorized", 1],
  ["light_tank", 1],
  ["light_tank", 2],
  ["medium_tank", 1],
  ["medium_tank", 2],
  ["medium_tank", 3],
  ["fighter", 1],
  ["fighter", 2],
  ["fighter", 3],
  ["bomber", 1],
  ["bomber", 2],
];

/** The kinds of WwOrderSchema, in order. */
function orderKinds(): string[] {
  return WwOrderSchema.options.map(
    (o) => (o.shape.kind as { value: string }).value,
  );
}

describe("P4 lists (plan decisions 3, 14, 23, 24, 25)", () => {
  it("ship classes and missions", () => {
    expect(SHIP_CLASSES).toEqual(["dd", "cl", "ca", "bc", "bb", "cv", "ss"]);
    // P6 (spec §14.1) appends lay_mines and sweep_mines.
    expect(FLEET_MISSIONS).toHaveLength(9);
  });

  it("the 24 navy and air orders follow improve_relations, in order", () => {
    expect(NAVY_ORDER_KINDS).toHaveLength(21);
    expect(AIR_ORDER_KINDS).toHaveLength(3);
    const kinds = orderKinds();
    const at = kinds.indexOf("improve_relations");
    // P5 (plan decision 10) appends its 13 orders after air_auto.
    expect(kinds.slice(at + 1, at + 1 + 24)).toEqual([
      ...NAVY_ORDER_KINDS,
      ...AIR_ORDER_KINDS,
    ]);
  });

  it("23 more stock slots, the old ones unmoved; divisions keep their 18 slots first", () => {
    // P4's 23, then P6's 33 (plan decision 5).
    expect(EQUIP_KEY_COUNT).toBe(P3_EQUIP_KEYS.length + 23 + 33);
    expect(EQUIP_KEYS.slice(0, 23).map(([t, g]) => [t, g])).toEqual(
      P3_EQUIP_KEYS,
    );
    // Pre-flight ruling 1: no plane and no convoy in a division. P6
    // (pre-flight §0-4): the first 18 slots are the P2 keys, then the 12
    // tank design keys (GROUND_TYPES allow-list).
    expect(GROUND_SLOTS).toBe(30);
    expect(GROUND_EQUIPMENT).toHaveLength(8);
    expect(GROUND_EQUIP_KEYS.slice(0, 18).every((k) => k < 18)).toBe(true);
    expect(GROUND_EQUIP_KEYS.slice(18).map((k) => EQUIP_KEYS[k][0])).toEqual(
      new Array<string>(12).fill("tank_design"),
    );
  });

  it("buildings, techs, refusals and stats are appended", () => {
    expect(BUILDING_IDS.slice(0, 7)).toEqual([
      "civ",
      "mil",
      "dock",
      "infra",
      "fort",
      "rail",
      "supply_hub",
    ]);
    // P6 (spec §9.1, §16) appends six.
    expect(BUILDING_IDS).toHaveLength(20);
    // P5 appends military_police after P4's 56.
    const p4 = WW_TECH_IDS.indexOf("dd_2");
    expect(WW_TECH_IDS[p4 + 55]).toBe("synthetic_oil_2");
    expect(WW_TECH_IDS[p4 - 1]).toBe("rail_1");
    const blocks = WW_ORDER_BLOCKS.slice(
      WW_ORDER_BLOCKS.indexOf("focus_none") + 1,
      WW_ORDER_BLOCKS.indexOf("bad_zone") + 1,
    );
    expect(blocks).toHaveLength(28);
    expect(blocks[0]).toBe("no_fleet");
    expect(blocks[26]).toBe("no_strike_region");
    expect(blocks[27]).toBe("bad_zone");
    const stats = WW_STAT_KEYS.slice(
      WW_STAT_KEYS.indexOf("intelPct") + 1,
      WW_STAT_KEYS.indexOf("paradropPrepPct") + 1,
    );
    // P4 spec §16.3's 26 and the 15 doctrine keys (P6 pre-flight) before
    // the last one.
    expect(stats).toHaveLength(41);
    expect(stats[0]).toBe("navyDefensePct");
    expect(stats[25]).toBe("capitalAttackPct");
    expect(stats[40]).toBe("paradropPrepPct");
  });

  it("the P4 effects are the navy group; annex stays territory", () => {
    expect(effectGroup("ships")).toBe("navy");
    expect(effectGroup("convoys")).toBe("navy");
    expect(effectGroup("fuel")).toBe("navy");
    expect(effectGroup("annex")).toBe("territory");
    expect(effectGroup("transfer_regions")).toBe("territory");
  });
});
