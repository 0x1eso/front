import {
  BUILDING_COST,
  EQUIP_KEY_COUNT,
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  aheadPct,
  allocateResources,
  assignCivs,
  constructionDaysLeft,
  constructionProgress,
  consumerGoodsMilli,
  coveragePermille,
  EFF_FLOOR_BP,
  effAfterAdding,
  effAfterSwitch,
  effCapBp,
  efficiencyGrowth,
  extraction,
  freeCivMilli,
  genBonusPct,
  lineOutputMilli,
  projectSpeedPct,
  recruitableMen,
  recruitToday,
  regionSlots,
  researchProgress,
  researchSlotCount,
  tradeRouteOk,
  trainCap,
  troopCapOf,
  wwCombatScales,
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
import {
  lawConditionMet,
  lawEffects,
} from "@openfront/engine-lib/ww1936/WwLaws";
import {
  openSchool,
  techDays,
  techTotals,
  WW_TECHS,
} from "@openfront/engine-lib/ww1936/WwTechs";

describe("production efficiency (spec §8.3)", () => {
  test("10% reaches the 50% cap in about 480 days", () => {
    let e = EFF_FLOOR_BP;
    let days = 0;
    while (e < 5000) {
      e = efficiencyGrowth(e, 5000);
      days++;
    }
    expect(days).toBeGreaterThanOrEqual(470);
    expect(days).toBeLessThanOrEqual(490);
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
  test("15 civilian factories build a civilian factory in 144 days", () => {
    const perDay = constructionProgress(15_000, 0);
    expect(Math.ceil((BUILDING_COST.civ * 1000) / perDay)).toBe(144);
    expect(constructionDaysLeft(BUILDING_COST.civ * 1000, 0, 1, perDay)).toBe(
      144,
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
    const avail = [0, 0, 0, 5, 30, 0];
    const a = allocateResources(avail, [
      { key: art, factories: 10 },
      { key: inf, factories: 20 },
    ]);
    expect(a.fill).toEqual([500, 500]); // tungsten 5/10, then steel 10/20
    expect(a.used).toEqual([0, 0, 0, 5, 30, 0]);
    // Which resources each line lacks (RESOURCE_IDS indices): artillery
    // gets all 20 steel but half its tungsten; the rifles the 10 steel left.
    expect(a.short).toEqual([[3], [4]]);
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

  test("a draft needs manpower, equipment and training room", () => {
    expect(recruitToday(100_000, 500, 20_000)).toBe(5_000);
    expect(recruitToday(3_000, 500, 20_000)).toBe(3_000);
    expect(recruitToday(100_000, 9_000, 20_000)).toBe(20_000);
    expect(troopCapOf(480_000, 1_195_000, 15_000)).toBe(630_000);
    expect(trainCap(1_675_000, 0)).toBe(18_611);
    expect(trainCap(10_000, 0)).toBe(500);
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

  test("conditions: dates, war and its length", () => {
    const peace36 = { day: 0, warDays: -1 };
    expect(lawConditionMet("early_mobilization", peace36)).toBe(true);
    expect(lawConditionMet("partial_mobilization", peace36)).toBe(false);
    expect(
      lawConditionMet("partial_mobilization", {
        day: dayOfDate("1937-01-01"),
        warDays: -1,
      }),
    ).toBe(true);
    expect(lawConditionMet("war_economy", { day: 0, warDays: 0 })).toBe(true);
    expect(
      lawConditionMet("total_mobilization", { day: 0, warDays: 364 }),
    ).toBe(false);
    expect(lawConditionMet("all_adults", { day: 0, warDays: 365 })).toBe(true);
    expect(lawConditionMet("scraping", { day: 0, warDays: 729 })).toBe(false);
    expect(
      lawConditionMet("extensive", {
        day: dayOfDate("1938-01-01"),
        warDays: -1,
      }),
    ).toBe(true);
  });
});

describe("research (spec §9)", () => {
  test("a year early doubles the time; the penalty shrinks by day", () => {
    expect(aheadPct(1937, yearStartDay(1936))).toBe(100);
    expect(aheadPct(1937, yearStartDay(1937))).toBe(0);
    expect(researchProgress(0, 100)).toBe(500);
    expect(researchProgress(10, 0)).toBe(1100);
    expect(techDays(1936)).toBe(120);
    expect(techDays(1942)).toBe(210);
  });

  test("slots: 3 for majors, 2 for others, +1 at 50 and 100 factories", () => {
    expect(researchSlotCount(true, 48)).toBe(3);
    expect(researchSlotCount(true, 85)).toBe(4);
    expect(researchSlotCount(false, 120)).toBe(4);
    expect(researchSlotCount(true, 300)).toBe(5);
  });

  test("46 techs; prerequisites exist and come no later", () => {
    expect(WW_TECH_IDS.length).toBe(46);
    for (const id of WW_TECH_IDS) {
      expect(WW_TECHS[id].id).toBe(id);
      for (const p of WW_TECHS[id].prereqs) {
        expect(WW_TECHS[p].year).toBeLessThanOrEqual(WW_TECHS[id].year);
      }
    }
  });

  test("every generation has its tech", () => {
    expect(EQUIP_KEY_COUNT).toBe(23);
    for (const [type, def] of Object.entries(EQUIPMENT)) {
      expect(def.techs.length).toBe(
        EQUIPMENT_GENS[type as keyof typeof EQUIPMENT_GENS],
      );
      for (const t of def.techs) expect(WW_TECHS[t]).toBeDefined();
      expect(equipKey(type as "artillery", def.techs.length + 1)).toBe(-1);
    }
    expect(genTech("medium_tank", 2)).toBe("medium_tank_2");
    expect(equipKey("artillery", 0)).toBe(-1);
  });

  test("stock keys follow EQUIPMENT_TYPES, generation by generation", () => {
    expect(EQUIP_KEYS[0]).toEqual(["infantry_equipment", 1]);
    expect(EQUIP_KEYS[EQUIP_KEY_COUNT - 1]).toEqual(["bomber", 2]);
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
    expect(t.recruitablePct).toBe(10);
    expect(t.trainPct).toBe(50);
    expect(openSchool(["tools_1", "mobile_1"])).toBe("mobile");
    expect(openSchool(["tools_1"])).toBeNull();
  });
});

describe("combat bridge (spec §10)", () => {
  test("coverage, generations and loss scales", () => {
    expect(coveragePermille(400, 100_000, 400)).toBe(1000);
    expect(coveragePermille(200, 100_000, 400)).toBe(500);
    expect(coveragePermille(5, 0, 400)).toBe(0);
    expect(coveragePermille(5, 100, 0)).toBe(0);
    expect(genBonusPct(100)).toBe(100);
    expect(genBonusPct(250)).toBe(145);
    expect(genBonusPct(300)).toBe(160);
    const s = wwCombatScales(
      { attackPct: 50, defensePct: 25, speedPct: 20 },
      { attackPct: 5, defensePct: 4, speedPct: 0 },
    );
    expect(s.attackerLoss).toBeCloseTo(0.416, 3);
    expect(s.defenderLoss).toBeCloseTo(0.865, 3);
    expect(s.attackerSpeed).toBeCloseTo(1.2, 6);
  });
});

describe("trade routes (spec §7.4)", () => {
  // 1 - 2 - 3 - 4 by land; 5 shares a sea zone with 1; 6 is alone.
  const graph = (wars: [number, number][] = [], factions: number[][] = []) => ({
    atWar: (a: number, b: number) =>
      wars.some(([x, y]) => (x === a && y === b) || (x === b && y === a)),
    sameFaction: (a: number, b: number) =>
      factions.some((f) => f.includes(a) && f.includes(b)),
    neighbours: (c: number) =>
      ({ 1: [2], 2: [1, 3], 3: [2, 4], 4: [3] })[c] ?? [],
    seaZones: (c: number) =>
      new Set(c === 1 || c === 5 ? [40001] : c === 4 ? [40002] : []),
  });

  test("land through countries at peace, a shared sea, or the faction", () => {
    expect(tradeRouteOk(graph(), 1, 4)).toBe(true);
    expect(tradeRouteOk(graph(), 1, 5)).toBe(true);
    expect(tradeRouteOk(graph(), 1, 6)).toBe(false);
    expect(tradeRouteOk(graph([], [[1, 6]]), 1, 6)).toBe(true);
    expect(tradeRouteOk(graph(), 1, 1)).toBe(false);
  });

  test("a war cuts the land route and the trade itself", () => {
    expect(tradeRouteOk(graph([[1, 3]]), 1, 4)).toBe(false);
    expect(tradeRouteOk(graph([[1, 3]]), 1, 3)).toBe(false);
    expect(tradeRouteOk(graph([[1, 4]], [[1, 4]]), 1, 4)).toBe(false);
  });
});

describe("start values (spec §11)", () => {
  test("majors use their table, the others the formula", () => {
    expect(startLaws("DEU")).toEqual({
      economy: "partial_mobilization",
      trade: "limited_exports",
      conscription: "limited",
    });
    expect(startLaws("POL").conscription).toBe("limited");
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
    expect(coveragePermille(pol[equipKey("artillery", 1)], 60_000, 400)).toBe(
      300,
    );
    expect(
      coveragePermille(pol[equipKey("support_equipment", 1)], 60_000, 300),
    ).toBe(200);
    expect(pol[equipKey("fighter", 1)]).toBe(60);
  });
});
