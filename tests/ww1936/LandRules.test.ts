// World War 1936 P2: the pure land-war rules in engine-lib (P2 spec §4,
// §7, §9, §10, §11; plan Task 1 Step 21). Review Focus 3's numbers.
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  GROUND_SLOTS,
  groundSlotOf,
  LAND_TERRAINS,
  SideSum,
  SupportId,
  TemplateDef,
  traitBit,
  WW_MAX_BATTALIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  addToSide,
  combatWidth,
  combineMods,
  divisionMods,
  emptySide,
  excessWidthBp,
  ModInput,
  predictBattle,
  roundDamage,
  roundHits,
  TERRAIN,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { startTemplates } from "@openfront/engine-lib/ww1936/LandStart";
import {
  edgeTicks,
  moveNeed,
  moveStep,
  railStep,
  seaTicks,
  shortestPath,
} from "@openfront/engine-lib/ww1936/MoveRules";
import { RegionHeap } from "@openfront/engine-lib/ww1936/RegionHeap";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  HUB_CAPITAL,
  HUB_CITY,
  HUB_SEA,
  hubCapacityMilli,
  SEA_HUB_MILLI,
  supplyEdgeCost,
  supplyFrom,
  supplyRatePm,
} from "@openfront/engine-lib/ww1936/SupplyRules";
import {
  divisionStats,
  GEN1,
  specialCap,
  strengthPm,
  templateBlock,
  templateStats,
  templateXpCost,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import {
  hash32,
  weatherAt,
  weatherCell,
} from "@openfront/engine-lib/ww1936/Weather";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import fs from "fs";
import path from "path";

const ZERO_TECH = techTotals(new Set());
const ALL_TECHS = new Set(WW_TECH_IDS);

const def = (
  bns: [BattalionId, number][],
  support: SupportId[] = [],
  name = "",
): TemplateDef => ({
  name,
  battalions: bns.flatMap(([id, n]) => new Array<BattalionId>(n).fill(id)),
  support,
});

/** Germany's 1936 infantry division of the spec's example: 7 + 2 artillery, engineers and recon. */
const INF72 = def(
  [
    ["infantry", 7],
    ["artillery", 2],
  ],
  ["engineer", "recon"],
);
const POL9 = def([["infantry", 9]]);

/** Full equipment slots for a template (generation 1). */
function fullSlots(d: TemplateDef): number[] {
  const s = templateStats(d, ZERO_TECH, GEN1);
  const slots = new Array<number>(GROUND_SLOTS).fill(0);
  const types = [
    "infantry_equipment",
    "support_equipment",
    "artillery",
    "anti_tank",
    "anti_air",
    "motorized",
    "light_tank",
    "medium_tank",
  ] as const;
  types.forEach((t, i) => (slots[groundSlotOf(equipKey(t, 1))] = s.need[i]));
  return slots;
}

function side(d: TemplateDef, n: number): SideSum {
  const s = templateStats(d, ZERO_TECH, GEN1);
  const sum = emptySide();
  for (let i = 0; i < n; i++) addToSide(sum, s, s.orgMilli);
  return sum;
}

const neutral = (over: Partial<ModInput>): ModInput => ({
  attacking: true,
  genAtt: 0,
  genDef: 0,
  traits: 0,
  flags: templateStats(INF72, ZERO_TECH, GEN1).flags,
  tech: ZERO_TECH,
  exp: 0,
  planBp: 0,
  land: "plains",
  weather: "clear",
  river: 0,
  strait: false,
  fort: 0,
  entrench: 0,
  excessBp: 0,
  supplyPm: 1000,
  encircled: false,
  airBp: 0,
  fuelBp: 0,
  landingBp: 0,
  coastalFortBp: 0,
  shoreBp: 0,
  ...over,
});

const line = (lines: { id: string; bp: number }[], id: string) =>
  lines.find((l) => l.id === id)?.bp;

describe("templates (P2 spec §4.3, §4.4)", () => {
  test("templateStats: the 1936 infantry division (spec §4.3)", () => {
    const s = templateStats(INF72, ZERO_TECH, GEN1);
    expect(s).toMatchObject({
      width: 20,
      men: 8500,
      hpMilli: 176_200,
      orgMilli: 46_666,
      soft: 9200,
      hard: 1100,
      def: 17_400,
      brk: 3300,
      pierce: 453,
      armor: 0,
      hardnessPm: 0,
      speedCenti: 400,
      supplyMilli: 890,
      trainDays: 90,
    });
    // EQUIPMENT_TYPES order: infantry, support, artillery, ...
    expect(s.need.slice(0, 3)).toEqual([700, 35, 24]);
  });

  test("templateStats: the German armoured division", () => {
    const s = templateStats(
      def(
        [
          ["light_armor", 4],
          ["motorized", 2],
          ["mot_artillery", 1],
        ],
        ["recon"],
      ),
      ZERO_TECH,
      GEN1,
    );
    expect(s).toMatchObject({
      width: 15,
      soft: 8500,
      hard: 2000,
      def: 7000,
      brk: 10_200,
      armor: 700,
      pierce: 1225,
      hardnessPm: 500,
      speedCenti: 800,
      supplyMilli: 3000,
    });
  });

  test("generations and doctrines", () => {
    const lt = def([["light_armor", 1]]);
    const gen2 = GEN1.map((g, i) => (i === 6 ? 200 : g));
    const s = templateStats(lt, ZERO_TECH, gen2);
    expect([s.soft, s.armor, s.speedCenti]).toEqual([1500, 1400, 900]);
    const art = def([["artillery", 1]]);
    expect(
      templateStats(art, techTotals(new Set(["firepower_1"])), GEN1).soft,
    ).toBe(3000);
    const inf = def([["infantry", 1]]);
    expect(
      templateStats(inf, techTotals(new Set(["mass_1", "mass_2"])), GEN1)
        .orgMilli,
    ).toBe(70_000);
    const armour = def([
      ["light_armor", 4],
      ["motorized", 2],
    ]);
    const base = templateStats(armour, ZERO_TECH, GEN1).orgMilli;
    expect(
      templateStats(armour, techTotals(new Set(["mobile_1", "mobile_2"])), GEN1)
        .orgMilli,
    ).toBe(base + 5_000);
    expect(
      templateStats(inf, techTotals(new Set(["mass_1"])), GEN1).trainDays,
    ).toBe(60);
  });

  test("divisionStats and strength follow equipment and men", () => {
    const s = templateStats(INF72, ZERO_TECH, GEN1);
    const slots = fullSlots(INF72);
    slots[groundSlotOf(equipKey("artillery", 1))] = 12;
    const half = divisionStats(s, slots, 4250);
    expect(half.soft).toBe(6700);
    expect(half.hpMilli).toBe(88_100);
    expect(strengthPm(s, slots, 8500)).toBe(926);
    expect(strengthPm(s, fullSlots(INF72), 8500)).toBe(1000);
  });

  test("templateXpCost", () => {
    const base = def([["infantry", 9]]);
    expect(templateXpCost(base, def([["infantry", 10]]))).toBe(5_000);
    expect(
      templateXpCost(
        base,
        def([
          ["infantry", 8],
          ["artillery", 1],
        ]),
      ),
    ).toBe(5_000);
    expect(templateXpCost(base, def([["infantry", 9]], ["engineer"]))).toBe(
      10_000,
    );
    expect(templateXpCost(base, def([["infantry", 9]], [], "Rifles"))).toBe(0);
    expect(templateXpCost(null, def([["infantry", 9]], ["engineer"]))).toBe(
      55_000,
    );
  });

  test("templateBlock (pre-flight U1, U18: 25 battalions, width 40)", () => {
    expect(WW_MAX_BATTALIONS).toBe(25);
    // Width 42 from 21 infantry battalions (count within 25).
    expect(templateBlock(def([["infantry", 21]]), ALL_TECHS, Infinity)).toBe(
      "bad_template",
    );
    expect(templateBlock(def([["infantry", 20]]), ALL_TECHS, Infinity)).toBe(
      null,
    );
    // 26 battalions.
    expect(templateBlock(def([["anti_tank", 26]]), ALL_TECHS, Infinity)).toBe(
      "bad_template",
    );
    expect(
      templateBlock(
        def([["infantry", 9]], ["engineer", "engineer"]),
        ALL_TECHS,
        Infinity,
      ),
    ).toBe("bad_template");
    const mountain = def([["mountain", 6]]);
    expect(
      templateBlock(
        mountain,
        new Set([...ALL_TECHS].filter((t) => t !== "mountaineers")),
        Infinity,
      ),
    ).toBe("no_tech");
    expect(templateBlock(mountain, ALL_TECHS, 0)).toBe("special_cap");
    expect(templateBlock(mountain, ALL_TECHS, 6)).toBe(null);
    expect(
      templateBlock(def([["infantry", 9]], [], " x"), ALL_TECHS, Infinity),
    ).toBe("bad_template");
    expect(
      templateBlock(def([["infantry", 9]], [], ""), ALL_TECHS, Infinity),
    ).toBe(null);
    expect(specialCap(100)).toBe(24);
    expect(specialCap(1000)).toBe(50);
  });

  test("every 1936 template is a valid template (spec §4.5)", () => {
    for (const tag of COUNTRY_TAGS) {
      for (const dev of [1, 2, 3, 4, 5]) {
        for (const st of startTemplates(tag, dev)) {
          expect(
            templateBlock(st.def, ALL_TECHS, Infinity),
            `${tag} ${st.key}`,
          ).toBeNull();
        }
      }
    }
  });
});

describe("combat (P2 spec §9)", () => {
  test("combat width (spec §9.2)", () => {
    const want: Record<string, [number, number, number, number]> = {
      plains: [90, 135, 180, 225],
      forest: [84, 126, 168, 210],
      hills: [80, 120, 160, 200],
      mountain: [75, 100, 125, 150],
      marsh: [60, 90, 120, 150],
      jungle: [84, 126, 168, 210],
      desert: [90, 135, 180, 225],
      urban: [96, 128, 160, 192],
    };
    for (const land of LAND_TERRAINS) {
      for (let d = 1; d <= 4; d++) {
        expect(combatWidth(land, d), `${land} ${d}`).toBe(want[land][d - 1]);
      }
      expect(combatWidth(land, 0)).toBe(TERRAIN[land].width);
      expect(combatWidth(land, 9)).toBe(want[land][3]);
    }
  });

  test("hits and damage (spec §9.10)", () => {
    expect(roundHits(9200, 19_800)).toBe(920);
    expect(roundHits(5400, 3300)).toBe(1170);
    expect(roundDamage(920, false)).toEqual({ orgMilli: 2187, hpMilli: 1514 });
    expect(roundDamage(920, true)).toEqual({ orgMilli: 1093, hpMilli: 757 });
  });

  test("modifiers combine as adds × cuts, cuts stop at −90%", () => {
    expect(combineMods([1000, 500], [-2500])).toBe(8625);
    expect(combineMods([], [-6000, -6000])).toBe(1000);
    expect(excessWidthBp(140, 135)).toBe(-740);
    expect(excessWidthBp(100, 135)).toBe(0);
  });

  test("divisionMods", () => {
    // Plains, clear, full supply, no general: recon's +5%.
    expect(divisionMods(neutral({})).mods.attackBp).toBe(10_500);
    // A big river, halved by the engineers.
    expect(divisionMods(neutral({ river: 2 })).mods.attackBp).toBe(8400);
    // Fort 3, −15% a level (Task 11), engineers take a quarter off.
    expect(line(divisionMods(neutral({ fort: 3 })).attackLines, "fort")).toBe(
      -3375,
    );
    // The defender's entrenchment, engineers and recon.
    expect(
      divisionMods(neutral({ attacking: false, entrench: 4 })).mods.defenseBp,
    ).toBe(12_200);
    expect(
      line(divisionMods(neutral({ supplyPm: 500 })).attackLines, "supply"),
    ).toBe(-2500);
    expect(
      line(divisionMods(neutral({ encircled: true })).attackLines, "encircled"),
    ).toBe(-5000);
    expect(
      line(
        divisionMods(neutral({ river: 2, traits: traitBit("river_crosser") }))
          .attackLines,
        "river",
      ),
    ).toBe(-1000);
  });

  test("predictBattle orders like spec §9.10 (pre-flight U17: no modifiers)", () => {
    const ctx = (directions: number) => ({
      land: "plains" as const,
      directions,
      attackerAttackBp: 10_000,
      attackerBlockBp: 10_000,
      defenderAttackBp: 10_000,
      defenderBlockBp: 10_000,
    });
    // Germany's 7·2 with engineers and recon against Poland's 9 infantry,
    // one on one: the attacker loses (HOI4: attacking alone breaks first).
    const one = predictBattle(side(INF72, 1), side(POL9, 1), ctx(1));
    expect(one.ratioPm).toBeGreaterThanOrEqual(550);
    expect(one.ratioPm).toBeLessThanOrEqual(700);
    // Seven against five, from two directions: the attacker wins in ~20 rounds.
    const seven = predictBattle(side(INF72, 7), side(POL9, 5), ctx(2));
    expect(seven.ratioPm).toBeGreaterThanOrEqual(1100);
    expect(seven.ratioPm).toBeLessThanOrEqual(1200);
    expect(seven.rounds).toBeGreaterThanOrEqual(20);
    expect(seven.rounds).toBeLessThanOrEqual(21);
    expect(predictBattle(emptySide(), side(POL9, 1), ctx(1)).ratioPm).toBe(0);
    expect(predictBattle(side(POL9, 1), emptySide(), ctx(1)).ratioPm).toBe(
      1_000_000,
    );
  });
});

describe("movement, supply and weather (P2 spec §7, §10, §11)", () => {
  const edge = (km: number, river: 0 | 1 | 2 = 0) => ({
    a: 1,
    b: 2,
    border: 10,
    km,
    river,
    strait: 0 as const,
  });

  test("movement (spec §7.2)", () => {
    expect(moveNeed(edge(180), "plains")).toBe(180_000);
    const step = moveStep(400, 1, "clear", 1000, 0);
    expect(step).toBe(7316);
    expect(edgeTicks(180_000, step)).toBe(25);
    expect(moveStep(400, 3, "clear", 1000, 0)).toBe(8047);
    expect(edgeTicks(180_000, 8047)).toBe(23);
    expect(moveNeed(edge(180, 2), "hills")).toBe(329_400);
    expect(moveStep(400, 1, "mud", 1000, 0)).toBe(3658);
    expect(moveStep(400, 1, "clear", 0, 0)).toBe(3658);
    expect(railStep(0)).toBe(91_450);
    expect(edgeTicks(600_000, railStep(0))).toBe(7);
    expect(railStep(20)).toBe(109_740);
    expect(seaTicks(300)).toBe(51);
    expect(seaTicks(156)).toBe(45);
  });

  test("supply (spec §11)", () => {
    expect(hubCapacityMilli(HUB_CAPITAL, 3)).toBe(65_000);
    expect(hubCapacityMilli(HUB_CITY, 3)).toBe(32_000);
    expect(hubCapacityMilli(HUB_SEA, 3)).toBe(SEA_HUB_MILLI);
    expect(supplyEdgeCost(300, 3, 3, "plains", 5)).toBe(6000);
    // A road: 300 km × 100% / (100 + 10 × 1), Task 11's doubled reach.
    expect(supplyEdgeCost(300, 0, 3, "plains", 1)).toBe(27_272);
    expect(supplyFrom(65_000, 6000)).toBe(58_500);
    expect(supplyFrom(65_000, 60_000)).toBe(0);
    expect(supplyRatePm(8500, 17_000)).toBe(500);
    expect(supplyRatePm(8500, 0)).toBe(1000);
  });

  test("weather (spec §10)", () => {
    expect(weatherCell(200, 4880)).toBe(378);
    const h = (wcell: number, day: number) =>
      hash32(wcell, Math.floor(day / 7)) % 100;
    // Temperate Rome in July.
    const july = dayOfDate("1936-07-15");
    expect(weatherAt(july, 4190, "mountain", 379)).toBe(
      h(379, july) < 15 ? "rain" : "clear",
    );
    // Continental Moscow.
    const at = (iso: string) => weatherAt(dayOfDate(iso), 5570, "plains", 417);
    const dec = dayOfDate("1941-12-15");
    expect(at("1941-12-15")).toBe(h(417, dec) < 40 ? "frozen" : "snow");
    expect(at("1937-04-10")).toBe("mud");
    expect(at("1937-03-25")).toBe("mud");
    expect(at("1937-03-10")).toBe("snow");
    expect(at("1937-10-20")).toBe("mud");
    expect(at("1937-11-20")).toBe("snow");
    // The southern hemisphere's July is its January.
    const hs = h(30, july);
    expect(weatherAt(july, -3400, "plains", 30)).toBe(
      hs < 35 ? "snow" : hs < 60 ? "rain" : "clear",
    );
    // Desert, tropical, polar.
    expect(weatherAt(july, 3000, "desert", 200)).toBe(
      h(200, july) < 70 ? "heat" : "clear",
    );
    const aug = dayOfDate("1936-08-10");
    expect(weatherAt(aug, 1000, "jungle", 250)).toBe(
      h(250, aug) < 60 ? "rain" : "clear",
    );
    const jan = dayOfDate("1937-01-10");
    expect(weatherAt(jan, 6500, "plains", 500)).toBe(
      h(500, jan) < 60 ? "frozen" : "snow",
    );
    // The same cell in the same week: the same roll.
    const week = Math.floor(july / 7) * 7;
    for (let d = week; d < week + 7; d++) {
      expect(weatherAt(d, 4190, "plains", 379)).toBe(
        weatherAt(week, 4190, "plains", 379),
      );
    }
  });
});

describe("paths (P2 spec §7.3)", () => {
  const MINI = path.join(__dirname, "../testdata/maps/ww1936mini");
  const sc = ScenarioIndex.fromFiles(
    ScenarioDataSchema.parse(
      JSON.parse(fs.readFileSync(path.join(MINI, "scenario.json"), "utf8")),
    ),
    new Uint8Array(fs.readFileSync(path.join(MINI, "regions.bin"))),
  );
  const km = (e: number) => sc.edge(e).km;

  test("shortestPath", () => {
    // Berlin → Kiev: 140 + 185 + 220 = 545 beats 163 + 220 + 200 = 583.
    expect(shortestPath(sc, 3, 9, () => true, km)).toEqual([3, 4, 7, 9]);
    // Munich and Krakow closed: around by Warsaw and Moscow.
    expect(shortestPath(sc, 3, 9, (r) => r !== 4 && r !== 7, km)).toEqual([
      3, 6, 8, 9,
    ]);
    // Nothing passable: no way to a region two steps off.
    expect(shortestPath(sc, 3, 9, () => false, km)).toEqual([]);
    // The target itself is the last step even when pass refuses it.
    expect(shortestPath(sc, 3, 6, () => false, km)).toEqual([3, 6]);
    expect(shortestPath(sc, 5, 5, () => true, km)).toEqual([5]);
    // London is reached only over the strait.
    expect(shortestPath(sc, 1, 10, () => true, km)).toEqual([1, 2, 10]);
  });

  test("the region heap orders by distance, then region", () => {
    const h = new RegionHeap();
    for (const [d, id] of [
      [5, 9],
      [3, 7],
      [5, 2],
      [1, 8],
      [3, 1],
    ]) {
      h.push(d, id);
    }
    const out: [number, number][] = [];
    while (h.size > 0) {
      const id = h.pop();
      out.push([h.lastDist, id]);
    }
    expect(out).toEqual([
      [1, 8],
      [3, 1],
      [3, 7],
      [5, 2],
      [5, 9],
    ]);
    expect(h.pop()).toBe(-1);
  });
});
