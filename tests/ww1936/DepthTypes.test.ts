// World War 1936 P6 (plan Task 1 Step 21): the depth lists and their
// anchors (wire, snapshot and content enums: append only).
import { WwOrderSchema } from "@openfront/engine-api/Schemas";
import {
  ARMY_SPIRITS,
  DEPTH_ORDER_KINDS,
  PLANE_MODULES,
  SHIP_MODULES,
  SUB_TRACK,
  SUBDOCTRINES,
  TANK_MODULES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_IDS,
  EQUIP_KEY_COUNT,
  EQUIP_KEYS,
  WW_ORDER_BLOCKS,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  CONDITION_KINDS,
  EFFECT_KINDS,
  effectGroup,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { WW_STAT_KEYS } from "@openfront/engine-api/ww1936/PoliticsTypes";

const after = <T extends string>(list: readonly T[], anchor: T): T[] =>
  list.slice(list.indexOf(anchor) + 1);

describe("World War 1936 P6 lists", () => {
  it("the 57 depth orders follow army_garrison in the ww_order union", () => {
    const kinds = WwOrderSchema.options.map(
      (o) => (o.shape.kind as { value: string }).value,
    );
    expect(DEPTH_ORDER_KINDS).toHaveLength(57);
    // White peace appends its two after them, then the automation's two.
    expect(after(kinds, "army_garrison")).toEqual([
      ...DEPTH_ORDER_KINDS,
      "peace_offer",
      "peace_reply",
      "auto_set",
      "army_auto_all",
    ]);
  });

  it("doctrines, spirits and modules", () => {
    expect(SUBDOCTRINES).toHaveLength(21);
    expect(SUB_TRACK).toHaveLength(21);
    // Three per track pair, the domains in order (land 0–2, naval 3–5, air 6–8).
    for (let i = 0; i < 21; i++) {
      expect(SUB_TRACK[i]).toBeGreaterThanOrEqual(0);
      expect(SUB_TRACK[i]).toBeLessThan(9);
      if (i > 0) expect(SUB_TRACK[i]).toBeGreaterThanOrEqual(SUB_TRACK[i - 1]);
    }
    expect(ARMY_SPIRITS).toHaveLength(21);
    expect(TANK_MODULES).toHaveLength(30);
    expect(SHIP_MODULES).toHaveLength(25);
    expect(PLANE_MODULES).toHaveLength(21);
  });

  it("techs, refusals, stats, effects and conditions are appended", () => {
    expect(after(WW_TECH_IDS, "military_police")).toHaveLength(33);
    expect(after(WW_TECH_IDS, "military_police")[0]).toBe("heavy_tank_1");
    // 32 (pre-flight §0-6: no_civs and no_xp existed already).
    // White peace appends its five after railgun_limit.
    const blocks = after(WW_ORDER_BLOCKS, "subject_restricted").slice(0, 32);
    expect(blocks).toHaveLength(32);
    expect(blocks[0]).toBe("no_cp");
    expect(blocks[31]).toBe("railgun_limit");
    expect(new Set(WW_ORDER_BLOCKS).size).toBe(WW_ORDER_BLOCKS.length);
    // 69 (the brief's 74 less the 5 P4 added at the pre-flight's request).
    const stats = after(WW_STAT_KEYS, "occupationOutputPp");
    expect(stats).toHaveLength(69);
    expect(stats[0]).toBe("infAttackPct");
    expect(new Set(WW_STAT_KEYS).size).toBe(WW_STAT_KEYS.length);
    // Pre-flight §0-6: after P5's navy_xp; 10 conditions with nukes_on.
    expect(after(EFFECT_KINDS, "navy_xp")).toHaveLength(11);
    expect(after(EFFECT_KINDS, "navy_xp")[0]).toBe("doctrine_mastery");
    // After P5 lane E's borders_group (merged after legitimacy_ge).
    expect(after(CONDITION_KINDS, "borders_group")).toHaveLength(10);
    expect(after(CONDITION_KINDS, "borders_group")[9]).toBe("nukes_on");
    expect(effectGroup("doctrine_mastery")).toBe("depth");
    expect(effectGroup("cfocus_unlock")).toBe("depth");
    expect(effectGroup("release")).toBe("endgame");
    expect(effectGroup("navy_xp")).toBe("endgame");
  });

  it("equipment keys grow by exactly 33, the old ones unmoved; divisions 30 slots", () => {
    const old = EQUIP_KEYS.findIndex(([t]) => t === "tank_design");
    expect(EQUIP_KEY_COUNT - old).toBe(33);
    expect(EQUIP_KEYS.slice(old).map(([t]) => t)).toEqual([
      ...new Array<string>(12).fill("tank_design"),
      ...new Array<string>(16).fill("plane_design"),
      "railway_gun",
      "floating_harbor",
      "flying_bomb",
      "ballistic_rocket",
      "atomic_bomb",
    ]);
    // Pre-flight §0-4: the 18 P2 slots, then the 12 tank designs.
    expect(GROUND_SLOTS).toBe(30);
    expect(GROUND_EQUIP_KEYS.slice(0, 18).every((k) => k < old)).toBe(true);
    expect(GROUND_EQUIP_KEYS.slice(18)).toEqual(
      Array.from({ length: 12 }, (_, i) => old + i),
    );
  });

  it("the six buildings follow fuel_silo", () => {
    expect(after(BUILDING_IDS, "fuel_silo")).toEqual([
      "facility_nuclear",
      "facility_rocket",
      "facility_science",
      "rocket_site",
      "power_plant",
      "dam",
    ]);
  });
});
