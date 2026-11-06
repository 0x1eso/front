import {
  BUILDING_COST,
  EQUIP_KEY_COUNT,
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  aheadPct,
  allocateResources,
  assignCivs,
  casualtyRelease,
  constructionDaysLeft,
  constructionProgress,
  consumerGoodsMilli,
  EFF_FLOOR_BP,
  effAfterAdding,
  effAfterSwitch,
  effCapBp,
  efficiencyGrowth,
  extraction,
  freeCivMilli,
  lineOutputMilli,
  projectSpeedPct,
  recruitableMen,
  regionSlots,
  researchProgress,
  researchSlotCount,
  yearStartDay,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  MAJOR_START,
  startArmy,
  startLaws,
  startStock,
  startTechs,
} from "@openfront/engine-lib/ww1936/EconomyStart";
import {
  EQUIPMENT,
  genTech,
  unitCostMilli,
} from "@openfront/engine-lib/ww1936/Equipment";
import { lawBlock } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { lawEffects } from "@openfront/engine-lib/ww1936/WwLaws";
import {
  openSchool,
  techDays,
  techTotals,
  WW_TECHS,
} from "@openfront/engine-lib/ww1936/WwTechs";

describe("production efficiency (spec §8.3)", () => {
  test("10% reaches the 50% cap in about 168 days", () => {
    let e = EFF_FLOOR_BP;
    let days = 0;
    while (e < 5000) {
      e = efficiencyGrowth(e, 5000);
      days++;
    }
    expect(days).toBeGreaterThanOrEqual(163);
    expect(days).toBeLessThanOrEqual(173);
    expect(efficiencyGrowth(5000, 5000)).toBe(5000);
  });

  test("tools raise the cap by 10 points each, up to 90%", () => {
    expect(effCapBp(techTotals(new Set()))).toBe(5000);
    expect(effCapBp(techTotals(new Set(["tools_1", "tools_2"])))).toBe(7000);
    expect(
      effCapBp(
        techTotals(new Set(["tools_1", "tools_2", "tools_3", "tools_4"])),
      ),
    ).toBe(9000);
  });

  test("new factories join at the floor; switching keeps 80/50/30%", () => {
    expect(effAfterAdding(5000, 10, 10)).toBe(3000);
    expect(effAfterAdding(5000, 10, 0)).toBe(5000);
    expect(effAfterSwitch(5000, "artillery", 1, "artillery", 2, 0)).toBe(4000);
    expect(effAfterSwitch(5000, "artillery", 1, "anti_tank", 1, 0)).toBe(2500);
    expect(effAfterSwitch(5000, "artillery", 1, "fighter", 1, 0)).toBe(1500);
    expect(effAfterSwitch(2000, "artillery", 1, "fighter", 1, 0)).toBe(
      EFF_FLOOR_BP,
    );
    expect(effAfterSwitch(5000, "artillery", 1, "fighter", 1, 1000)).toBe(2000);
    expect(effAfterSwitch(5000, "artillery", 2, "artillery", 2, 0)).toBe(5000);
  });

  test("a line's daily output", () => {
    // 10 factories × 4.5 × 50% = 22.5 IC = 22,500 milli; no resources → 20%.
    expect(lineOutputMilli(10, 5000, 0, 1000)).toBe(22_500);
    expect(lineOutputMilli(10, 5000, 0, 0)).toBe(4_500);
    expect(lineOutputMilli(10, 5000, 10, 1000)).toBe(24_750);
    expect(unitCostMilli("infantry_equipment", 1)).toBe(500);
    expect(unitCostMilli("infantry_equipment", 2)).toBe(625);
    expect(unitCostMilli("medium_tank", 3)).toBe(18_000);
  });
});

describe("construction (spec §4.3)", () => {
  // Buildings take 30% less time (was 144 civilian / 96 military days).
  test("15 civilian factories build a civilian factory in 101 days, a military one in 68", () => {
    const perDay = constructionProgress(15_000, 0);
    expect(Math.ceil((BUILDING_COST.civ * 1000) / perDay)).toBe(101);
    expect(Math.ceil((BUILDING_COST.mil * 1000) / perDay)).toBe(68);
    expect(constructionDaysLeft(BUILDING_COST.civ * 1000, 0, 1, perDay)).toBe(
      101,
    );
    expect(constructionDaysLeft(BUILDING_COST.civ * 1000, 0, 1, 0)).toBe(-1);
  });

  test("each entry gets at most 15, front first", () => {
    expect(assignCivs(18_400, 3)).toEqual([15_000, 3_400, 0]);
    expect(assignCivs(-5, 2)).toEqual([0, 0]);
  });

  test("consumer goods and trade take their share of civilian factories", () => {
    // 32 civ + 16 mil at 25%: 12 factories of consumer goods.
    expect(consumerGoodsMilli(32, 16, 25)).toBe(12_000);
    expect(freeCivMilli(32, 12_000, 2, 0)).toBe(18_000);
    expect(freeCivMilli(32, 12_000, 0, 3)).toBe(23_000);
    expect(freeCivMilli(5, 12_000, 0, 0)).toBe(0);
  });

  test("speed: infrastructure, construction tech, trade law, military only for mil", () => {
    const tech = techTotals(new Set(["construction_1"]));
    const law = lawEffects({
      economy: "civilian",
      trade: "free_trade",
      conscription: "extensive",
    });
    // 10×(5−1) + 10 + (10 − 5) = 55; −30 more for a military factory.
    expect(projectSpeedPct({ building: "civ", infra: 5, tech, law })).toBe(55);
    expect(projectSpeedPct({ building: "mil", infra: 5, tech, law })).toBe(25);
    expect(constructionProgress(1000, -200)).toBe(0);
    // P2 plan decision 10: fortification_1 and rail_1 as speed (+33%).
    const p2 = techTotals(new Set(["fortification_1", "rail_1"]));
    expect(projectSpeedPct({ building: "fort", infra: 1, tech: p2, law })).toBe(
      33 + 5,
    );
    expect(projectSpeedPct({ building: "rail", infra: 1, tech: p2, law })).toBe(
      33 + 5,
    );
    expect(
      projectSpeedPct({ building: "infra", infra: 1, tech: p2, law }),
    ).toBe(5);
  });

  test("slots grow 20% per construction tech", () => {
    expect(regionSlots("city", 0)).toBe(6);
    expect(regionSlots("city", 20)).toBe(7);
    expect(regionSlots("rural", 20)).toBe(2);
    expect(regionSlots("wasteland", 60)).toBe(0);
  });
});

describe("resources (spec §7)", () => {
  test("lines take their resources in order", () => {
    const art = equipKey("artillery", 1); // 2 steel, 1 tungsten per factory
    const inf = equipKey("infantry_equipment", 1); // 1 steel
    // (P6: coal and uranium after P1's six.)
    const avail = [0, 0, 0, 5, 30, 0, 0, 0];
    const a = allocateResources(avail, [
      { key: art, factories: 10 },
      { key: inf, factories: 20 },
    ]);
    // ww115 T8: artillery at half its tungsten takes half its steel, so
    // the rifles get all 20 they need.
    expect(a.fill).toEqual([500, 1000]);
    expect(a.used).toEqual([0, 0, 0, 5, 30, 0, 0, 0]);
    // Which resources each line lacks (RESOURCE_IDS indices).
    expect(a.short).toEqual([[3], []]);
    // Enough of everything: no line lacks anything.
    expect(
      allocateResources(
        [0, 0, 0, 10, 40, 0],
        [
          { key: art, factories: 10 },
          { key: inf, factories: 20 },
        ],
      ).short,
    ).toEqual([[], []]);
    // A line that needs nothing (no factories) is full.
    expect(allocateResources(avail, [{ key: art, factories: 0 }]).fill).toEqual(
      [1000],
    );
  });

  test("T8: a line takes only the share its scarcest resource allows", () => {
    const art = equipKey("artillery", 1); // 2 steel, 1 tungsten per factory
    const inf = equipKey("infantry_equipment", 1); // 1 steel
    // No tungsten at all: the artillery line takes no steel.
    const none = allocateResources(
      [0, 0, 0, 0, 20, 0, 0, 0],
      [
        { key: art, factories: 10 },
        { key: inf, factories: 20 },
      ],
    );
    expect(none.fill).toEqual([0, 1000]);
    expect(none.used[4]).toBe(20);
    expect(none.short).toEqual([[3], []]);
    // Rounding up never takes past what is left, or below zero.
    const odd = allocateResources(
      [0, 0, 0, 1, 3, 0, 0, 0],
      [{ key: art, factories: 3 }],
    );
    expect(odd.fill).toEqual([333]);
    expect(odd.used[3]).toBe(1);
    expect(odd.used[4]).toBe(2);
    // The naval lines behind them go the same way.
    const sea = allocateResources(
      [0, 0, 0, 1, 10, 0, 0, 0],
      [],
      [
        [0, 0, 0, 2, 10, 0, 0, 0],
        [0, 0, 0, 0, 5, 0, 0, 0],
      ],
    );
    expect(sea.extraFill).toEqual([500, 1000]);
  });

  test("T7: the casualty debt falls 5 % a year, at least a man a day", () => {
    expect(casualtyRelease(0)).toBe(0);
    expect(casualtyRelease(1)).toBe(1);
    expect(casualtyRelease(1_000_000)).toBe(137);
    let debt = 1_000_000;
    for (let d = 0; d < 365; d++) debt -= casualtyRelease(debt);
    expect(debt).toBeGreaterThan(950_000);
    expect(debt).toBeLessThan(952_000);
  });

  test("infrastructure and occupation scale extraction", () => {
    expect(extraction(100, 5, 100, 0)).toBe(100);
    expect(extraction(100, 1, 100, 0)).toBe(80);
    expect(extraction(100, 5, 50, 10)).toBe(55);
  });
});

describe("manpower and the troop bridge (spec §6)", () => {
  test("recruitable men from population, law and region share", () => {
    expect(recruitableMen(67_000, 100, 25, 0)).toBe(1_675_000);
    expect(recruitableMen(10_000, 10, 15, 0)).toBe(15_000);
    expect(recruitableMen(10_000, 100, 25, 10)).toBe(275_000);
  });
});

describe("laws (spec §5)", () => {
  test("effects add up across the three ladders", () => {
    expect(
      lawEffects({
        economy: "war_economy",
        trade: "export_focus",
        conscription: "service",
      }),
    ).toEqual({
      consumerGoodsPct: 20,
      milConstructionPct: 20,
      constructionPct: -5,
      outputPct: -5,
      exportPct: 50,
      researchPct: 0,
      conscriptionPermille: 100,
    });
  });

  // P3 (plan decision 11): P1's date and war-length conditions are gone;
  // PoliticsRules.lawBlock gates by war support, war and government
  // (PoliticsRules.test.ts holds the whole spec §7.2 table).
  test("conditions: war support or war, and at war", () => {
    const ctx = {
      wsBp: 3000,
      wtBp: 0,
      ruling: 3,
      atWar: false,
      ppMilli: 1_000_000,
      costMilli: 0,
    };
    expect(lawBlock("early_mobilization", ctx)).toBeNull();
    expect(lawBlock("partial_mobilization", ctx)).toBeNull();
    expect(lawBlock("partial_mobilization", { ...ctx, wsBp: 2999 })).toBe(
      "law_ws",
    );
    expect(lawBlock("war_economy", { ...ctx, atWar: true })).toBeNull();
    expect(lawBlock("total_mobilization", { ...ctx, wsBp: 9000 })).toBe(
      "law_condition",
    );
  });
});

describe("research (spec §9)", () => {
  test("a year early doubles the time, more turns steep; it shrinks by day", () => {
    expect(aheadPct(1937, yearStartDay(1937) - 365)).toBe(100);
    expect(aheadPct(1938, yearStartDay(1938) - 730)).toBe(700);
    expect(aheadPct(1938, yearStartDay(1938) - 183)).toBe(50);
    expect(aheadPct(1937, yearStartDay(1937))).toBe(0);
    expect(researchProgress(0, 100)).toBe(500);
    expect(researchProgress(10, 0)).toBe(1100);
    expect(techDays(1936)).toBe(120);
    expect(techDays(1942)).toBe(210);
  });

  test("slots: the start slots plus the effects', at most 6 (research overhaul)", () => {
    expect(researchSlotCount(3, 0)).toBe(3);
    expect(researchSlotCount(4, 1)).toBe(5);
    expect(researchSlotCount(3, 3)).toBe(6);
    expect(researchSlotCount(4, 4)).toBe(6);
  });

  test("263 techs; prerequisites exist and come no later", () => {
    // P1's 46, P2's 10 (P2 spec §4.6), P4's 56 (P4 spec §4.3, §12.3),
    // P5's military police (P5 spec §8.5), P6's 33 (P6 spec §1.4) and the
    // research overhaul's 108 (changes §2.3), w28's 2 (metal substitutes),
    // ww82's 7 merged techs.
    expect(WW_TECH_IDS.length).toBe(263);
    for (const id of WW_TECH_IDS) {
      expect(WW_TECHS[id].id).toBe(id);
      for (const p of WW_TECHS[id].prereqs) {
        expect(WW_TECHS[p].year).toBeLessThanOrEqual(WW_TECHS[id].year);
      }
    }
  });

  test("every generation has its tech", () => {
    // P1's 23, P4's 23 (eight plane types, convoys), P6's 45, then the design pools grown to 48 tank and 64 plane slots (+36 +36).
    expect(EQUIP_KEY_COUNT).toBe(163);
    for (const [type, def] of Object.entries(EQUIPMENT)) {
      // P4: the convoy's one generation needs no tech; P6: the design
      // slots and the project-gated weapons neither (plan decision 7).
      expect(def.techs.length).toBe(
        [
          "convoy",
          "tank_design",
          "plane_design",
          "flying_bomb",
          "ballistic_rocket",
          "atomic_bomb",
        ].includes(type)
          ? 0
          : EQUIPMENT_GENS[type as keyof typeof EQUIPMENT_GENS],
      );
      for (const t of def.techs) expect(WW_TECHS[t]).toBeDefined();
      expect(
        equipKey(
          type as "artillery",
          EQUIPMENT_GENS[type as keyof typeof EQUIPMENT_GENS] + 1,
        ),
      ).toBe(-1);
    }
    expect(genTech("medium_tank", 2)).toBe("medium_tank_2");
    expect(equipKey("artillery", 0)).toBe(-1);
  });

  test("stock keys follow EQUIPMENT_TYPES, generation by generation", () => {
    expect(EQUIP_KEYS[0]).toEqual(["infantry_equipment", 1]);
    // (P6's seven types follow P4's convoy.)
    expect(EQUIP_KEYS[equipKey("convoy", 1) + 1]).toEqual(["tank_design", 1]);
    expect(EQUIP_KEYS[EQUIP_KEY_COUNT - 1]).toEqual(["atomic_bomb", 1]);
    for (const t of EQUIPMENT_TYPES) {
      for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) {
        expect(EQUIP_KEYS[equipKey(t, g)]).toEqual([t, g]);
      }
    }
  });

  test("tech effects sum; a country opens one doctrine school", () => {
    const t = techTotals(
      new Set(["construction_1", "construction_2", "mass_1"]),
    );
    expect(t.constructionPct).toBe(20);
    expect(t.slotPct).toBe(40);
    // P6 plan decision 25: mass_1 is retired and adds nothing (its values
    // come from the grand doctrines' stat keys now).
    expect(t.recruitablePct).toBe(0);
    expect(t.infTrainCutPct).toBe(0);
    expect(t.trainPct).toBe(0);
    expect(openSchool(["tools_1", "mobile_1"])).toBe("mobile");
    expect(openSchool(["tools_1"])).toBeNull();
  });
});

describe("start values (spec §11)", () => {
  test("majors use their table, the others the formula", () => {
    expect(startLaws("DEU")).toEqual({
      economy: "partial_mobilization",
      trade: "limited_exports",
      conscription: "limited",
    });
    // Poland moved to volunteer conscription (balance fff0c4c33, 25 -> 15 permille).
    expect(startLaws("POL").conscription).toBe("volunteer");
    expect(startLaws("CAN").conscription).toBe("volunteer");
    expect(startArmy("SUN", 0)).toBe(1_300_000);
    expect(startArmy("POL", 200_000)).toBe(60_000);
    expect(startArmy("POL", 100)).toBe(1000);
    expect(startTechs("POL", 3)).toEqual([
      "inf_eq_1",
      "support_eq_1",
      "artillery_1",
    ]);
    expect(startTechs("POL", 4)).toContain("fighter_1");
    expect(startTechs("DEU", 0)).toContain("tools_1");
  });

  test("stock: a major's reserve, a minor's coverage", () => {
    const deu = startStock("DEU", 480_000, 9, 6);
    expect(deu[equipKey("infantry_equipment", 1)]).toBe(
      MAJOR_START.DEU!.infReserve,
    );
    expect(deu[equipKey("light_tank", 1)]).toBe(1_500);
    expect(deu[equipKey("light_tank", 2)]).toBe(0);
    const pol = startStock("POL", 60_000, 4, 2);
    expect(pol[equipKey("infantry_equipment", 1)]).toBe(600);
    // 30% artillery and 20% support coverage of 60,000 men.
    expect(pol[equipKey("artillery", 1)]).toBe(72);
    expect(pol[equipKey("support_equipment", 1)]).toBe(36);
    expect(pol[equipKey("fighter", 1)]).toBe(60);
  });
});
