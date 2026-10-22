// World War 1936 P6 (plan Task 1 Steps 6–13; review L5): the foundation's
// engine-lib bodies later lanes build on — the combat lines, the design
// blend in templates, the P6 build and line checks, the resource
// allocation's priority part and the v5 resource padding.
import {
  DS_FLAME,
  FM_TRAITS,
  KeyStatsTable,
  KS,
  KS_FIELDS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  RESOURCE_COUNT,
  RESOURCE_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  GROUND_SLOTS,
  GROUND_STATIC_SLOTS,
  groundSlotOf,
  NEED_GROUPS,
  TemplateDef,
  TPL_AMPHIBIOUS,
  TPL_ARMOR_ANY,
  TPL_ENGINEER,
  TPL_FLAIL,
  TPL_FLAME,
  TPL_INFANTRY_DIV,
  TPL_MOUNTAIN_MAJOR,
  TPL_TD_DEFEND,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { BATTALIONS, SUPPORTS } from "@openfront/engine-lib/ww1936/Battalions";
import {
  divisionMods,
  ModInput,
  ModResult,
} from "@openfront/engine-lib/ww1936/CombatRules";
import {
  buildBlockOf,
  BuildCheck,
  equipmentTechBlock,
  queuedInRegion,
  queuedLevels,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import { allocateResources } from "@openfront/engine-lib/ww1936/EconomyRules";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  equipByType,
  GEN1,
  genMixOf,
  groupDrawSlots,
  STATIC_KEY_STATS,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import {
  depthBuildBlock,
  DepthBuildInput,
} from "@openfront/engine-lib/ww1936/WorldRules";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import fs from "fs";
import path from "path";
import { DEEP } from "./deepFixture";

const ZERO = techTotals(new Set());
const tech = (s: Partial<WwStats>) => ({ ...ZERO, ...s }) as typeof ZERO;

function input(over: Partial<ModInput> = {}): ModInput {
  return {
    attacking: true,
    genAtt: 0,
    genDef: 0,
    traits: 0,
    flags: 0,
    tech: ZERO,
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
    fmAtt: 0,
    fmDef: 0,
    fmTraits: 0,
    cmdAttBp: 0,
    cmdDefBp: 0,
    enemyPlanCutBp: 0,
    fortCut: 0,
    halfSupply: false,
    designFlags: 0,
    artSoftPm: 0,
    fmPlanBp: 0,
    ...over,
  };
}
const at = (r: ModResult, id: string) =>
  r.attackLines.find((l) => l.id === id)?.bp;
const df = (r: ModResult, id: string) =>
  r.defenseLines.find((l) => l.id === id)?.bp;
const mods = (o: Partial<ModInput>) => divisionMods(input(o));
const T = (t: Parameters<typeof traitBit>[0]) => traitBit(t);

describe("combat lines (CombatRules, spec §4.2–§4.5, §5.2.2, §21.2)", () => {
  it("the new general traits", () => {
    expect(
      at(mods({ traits: T("forest_expert"), land: "forest" }), "trait"),
    ).toBe(1000);
    expect(
      df(
        mods({ traits: T("forest_expert"), land: "jungle", attacking: false }),
        "trait",
      ),
    ).toBe(500);
    expect(
      at(mods({ traits: T("urban_expert"), land: "urban" }), "trait"),
    ).toBe(1000);
    expect(
      df(
        mods({ traits: T("urban_expert"), land: "urban", attacking: false }),
        "trait",
      ),
    ).toBe(1000);
    expect(
      at(mods({ traits: T("swamp_expert"), land: "marsh" }), "trait"),
    ).toBe(1000);
    expect(
      at(mods({ traits: T("swamp_expert"), land: "plains" }), "trait"),
    ).toBeUndefined();
    const inf = { traits: T("infantry_expert"), flags: TPL_INFANTRY_DIV };
    expect(at(mods(inf), "trait")).toBe(1000);
    expect(df(mods({ ...inf, attacking: false }), "trait")).toBe(1000);
    const arm = { traits: T("armor_expert"), flags: TPL_ARMOR_ANY };
    expect(at(mods(arm), "trait")).toBe(1000);
    // Breakthrough (the block value) when it attacks only.
    expect(df(mods(arm), "trait")).toBe(1000);
    expect(df(mods({ ...arm, attacking: false }), "trait")).toBeUndefined();
    expect(
      at(mods({ traits: T("artillery_officer"), artSoftPm: 400 }), "trait"),
    ).toBe(400);
    expect(
      at(mods({ traits: T("commando"), flags: TPL_MOUNTAIN_MAJOR }), "trait"),
    ).toBe(1000);
    expect(at(mods({ traits: T("ambusher"), attacking: false }), "trait")).toBe(
      1500,
    );
    expect(at(mods({ traits: T("ambusher") }), "trait")).toBeUndefined();
    // engineer_officer: river and fort penalties × 85%.
    const river = at(mods({ river: 1 }), "river")!;
    expect(at(mods({ river: 1, traits: T("engineer_officer") }), "river")).toBe(
      -Math.floor((-river * 85) / 100),
    );
  });

  it("field marshal, its traits, the command line and the readiness cut", () => {
    expect(at(mods({ fmAtt: 2 }), "field_marshal")).toBe(500);
    expect(df(mods({ fmDef: 4 }), "field_marshal")).toBe(1000);
    const off = 1 << FM_TRAITS.indexOf("fm_offensive");
    expect(at(mods({ fmTraits: off }), "fm_trait")).toBe(500);
    expect(at(mods({ cmdAttBp: 300 }), "command")).toBe(300);
    expect(df(mods({ cmdDefBp: -200 }), "command")).toBe(-200);
    expect(at(mods({ planBp: 2000, enemyPlanCutBp: -1000 }), "plan")).toBe(
      1000,
    );
    expect(
      at(mods({ planBp: 500, enemyPlanCutBp: -1000 }), "plan"),
    ).toBeUndefined();
    // The field marshal's readiness above the cap: its own line, cut last.
    const fm = mods({ planBp: 3000, fmPlanBp: 1000, enemyPlanCutBp: -500 });
    expect([at(fm, "plan"), at(fm, "fm_plan")]).toEqual([3000, 500]);
  });

  it("design flags: flame, tank destroyer, amphibious, flail", () => {
    expect(at(mods({ designFlags: TPL_FLAME, land: "urban" }), "flame")).toBe(
      1000,
    );
    expect(at(mods({ designFlags: TPL_FLAME, fort: 1 }), "flame")).toBe(1000);
    expect(at(mods({ designFlags: TPL_FLAME }), "flame")).toBeUndefined();
    expect(
      df(
        mods({ designFlags: TPL_TD_DEFEND, attacking: false }),
        "tank_destroyer",
      ),
    ).toBe(1000);
    expect(
      df(mods({ designFlags: TPL_TD_DEFEND }), "tank_destroyer"),
    ).toBeUndefined();
    const river = at(mods({ river: 2 }), "river")!;
    expect(at(mods({ river: 2, designFlags: TPL_AMPHIBIOUS }), "river")).toBe(
      -Math.floor(-river / 2),
    );
    const strait = at(mods({ strait: true }), "strait")!;
    expect(
      at(mods({ strait: true, designFlags: TPL_AMPHIBIOUS }), "strait"),
    ).toBe(strait / 2);
    const fort = at(mods({ fort: 2 }), "fort")!;
    expect(at(mods({ fort: 2, designFlags: TPL_FLAIL }), "fort")).toBe(
      -Math.floor((-fort * 75) / 100),
    );
  });

  it("fort cut, penalty cuts, fort defence, engineers, supply, excess width", () => {
    expect(at(mods({ fort: 3, fortCut: 1 }), "fort")).toBe(
      at(mods({ fort: 2 }), "fort"),
    );
    expect(at(mods({ fort: 1, fortCut: 2 }), "fort")).toBeUndefined();
    const river = at(mods({ river: 1 }), "river")!;
    expect(
      at(mods({ river: 1, tech: tech({ riverPenaltyCutPct: 50 }) }), "river"),
    ).toBe(-Math.floor(-river / 2));
    const fort = at(mods({ fort: 2 }), "fort")!;
    expect(
      at(mods({ fort: 2, tech: tech({ fortPenaltyCutPct: 50 }) }), "fort"),
    ).toBe(-Math.floor(-fort / 2));
    expect(
      df(
        mods({
          attacking: false,
          fort: 2,
          tech: tech({ fortDefPerLevelBp: 300 }),
        }),
        "fort_def",
      ),
    ).toBe(600);
    expect(df(mods({ flags: TPL_ENGINEER }), "engineer")).toBe(500);
    expect(
      df(
        mods({ flags: TPL_ENGINEER, tech: tech({ engineerMulPct: 100 }) }),
        "engineer",
      ),
    ).toBe(1000);
    expect(at(mods({ supplyPm: 500 }), "supply")).toBe(-2500);
    expect(at(mods({ supplyPm: 500, halfSupply: true }), "supply")).toBe(-1250);
    expect(at(mods({ excessBp: -2000 }), "excess")).toBe(-2000);
    expect(
      at(
        mods({ excessBp: -2000, tech: tech({ excessWidthCutPct: 50 }) }),
        "excess",
      ),
    ).toBe(-1000);
  });
});

/** A KeyStatsTable with one tank design in the first design slot. */
function oneDesign(
  row: Partial<Record<keyof typeof KS, number>>,
  year = 1939,
): KeyStatsTable {
  const group = new Int8Array(STATIC_KEY_STATS.group);
  const years = new Int16Array(STATIC_KEY_STATS.year);
  const stats = new Int32Array(STATIC_KEY_STATS.stats);
  const j = GROUND_STATIC_SLOTS;
  group[j] = NEED_GROUPS.indexOf("medium_tank");
  years[j] = year;
  for (const [k, v] of Object.entries(row)) {
    stats[j * KS_FIELDS + KS[k as keyof typeof KS]] = v!;
  }
  return { group, year: years, stats };
}
const tpl = (bns: BattalionId[], support: string[] = []): TemplateDef =>
  ({ name: "", battalions: bns, support }) as TemplateDef;

describe("templates with designs (TemplateStats, plan decisions 6, 7)", () => {
  const MED = groundSlotOf(equipKey("medium_tank", 1));
  const DES = GROUND_STATIC_SLOTS;
  const ks = oneDesign({ soft: 5000, relPm: 900, flags: DS_FLAME });
  const holding = (statics: number, designs: number) => {
    const e = new Array<number>(GROUND_SLOTS).fill(0);
    e[MED] = statics;
    e[DES] = designs;
    return genMixOf(e, ks);
  };

  it("the blend: all design, all static, half and half; the design's flags", () => {
    const def = tpl(["medium_armor"]);
    const stat = templateStats(def, ZERO, holding(50, 0), ks);
    expect(stat).toEqual(templateStats(def, ZERO, GEN1));
    const des = templateStats(def, ZERO, holding(0, 50), ks);
    expect(des.soft).toBe(5000);
    expect(des.designFlags & TPL_FLAME).not.toBe(0);
    const half = templateStats(def, ZERO, holding(50, 50), ks);
    expect(half.soft).toBe(Math.floor((stat.soft * 50 + 5000 * 50) / 100));
  });

  it("equipByType counts a design slot in its group; the draw order", () => {
    const e = new Array<number>(GROUND_SLOTS).fill(0);
    e[MED] = 3;
    e[DES] = 4;
    expect(equipByType(e, ks)[NEED_GROUPS.indexOf("medium_tank")]).toBe(7);
    expect(equipByType(e)[NEED_GROUPS.indexOf("medium_tank")]).toBe(3);
    // Newest year first, then the smaller slot: a 1950 design before every
    // static medium, a 1900 one after them.
    const g = NEED_GROUPS.indexOf("medium_tank");
    expect(groupDrawSlots(oneDesign({}, 1950), g)[0]).toBe(DES);
    const old = groupDrawSlots(oneDesign({}, 1900), g);
    expect(old[old.length - 1]).toBe(DES);
  });

  it("battalion and support company percentages", () => {
    const inf = tpl(new Array<BattalionId>(9).fill("infantry"));
    const s = templateStats(inf, tech({ infAttackPct: 10 }), GEN1);
    expect(s.soft).toBe(9 * Math.floor((BATTALIONS.infantry.soft * 110) / 100));
    const eng = tpl(["infantry"], ["engineer"]);
    const a = templateStats(eng, ZERO, GEN1);
    const b = templateStats(eng, tech({ supportCompanyPct: 100 }), GEN1);
    expect(b.soft - a.soft).toBe(SUPPORTS.engineer.soft);
  });
});

const ALL = new Set<WwTechId>([
  "nuclear_physics",
  "rocketry_1",
  "computing_1",
] as WwTechId[]);
const build = (o: Partial<DepthBuildInput>): DepthBuildInput => ({
  building: "facility_nuclear",
  count: 1,
  core: true,
  facility: 0,
  researched: ALL,
  infra: 3,
  nukesOn: true,
  flyingBombDone: false,
  levelWithQueue: 0,
  dam: -1,
  damLevel: 1,
  damQueued: false,
  ...o,
});

describe("P6 build and line checks (WorldRules, EconomyChecks)", () => {
  it("depthBuildBlock", () => {
    expect(depthBuildBlock(build({}))).toBeNull();
    expect(depthBuildBlock(build({ core: false }))).toBe("not_buildable");
    expect(depthBuildBlock(build({ nukesOn: false }))).toBe("not_buildable");
    expect(depthBuildBlock(build({ infra: 2 }))).toBe("not_buildable");
    expect(depthBuildBlock(build({ researched: new Set() }))).toBe("no_tech");
    expect(depthBuildBlock(build({ facility: 2 }))).toBe("no_slots");
    expect(depthBuildBlock(build({ building: "rocket_site" }))).toBe(
      "project_locked",
    );
    expect(
      depthBuildBlock(
        build({
          building: "rocket_site",
          flyingBombDone: true,
          levelWithQueue: 2,
        }),
      ),
    ).toBeNull();
    expect(
      depthBuildBlock(
        build({
          building: "rocket_site",
          flyingBombDone: true,
          levelWithQueue: 3,
        }),
      ),
    ).toBe("infra_max");
    expect(
      depthBuildBlock(build({ building: "power_plant", levelWithQueue: 2 })),
    ).toBeNull();
    expect(
      depthBuildBlock(build({ building: "power_plant", levelWithQueue: 3 })),
    ).toBe("no_slots");
    expect(depthBuildBlock(build({ building: "dam" }))).toBe("not_buildable");
    expect(
      depthBuildBlock(build({ building: "dam", dam: 0, damLevel: 0 })),
    ).toBeNull();
    expect(
      depthBuildBlock(build({ building: "dam", dam: 0, damLevel: 1 })),
    ).toBe("infra_max");
    expect(
      depthBuildBlock(
        build({ building: "dam", dam: 0, damLevel: 0, damQueued: true }),
      ),
    ).toBe("infra_max");
    expect(depthBuildBlock(build({ building: "infra" }))).toBeNull();
  });

  it("queued P6 buildings and buildBlockOf's depth answer", () => {
    const q = queuedInRegion(
      [
        { region: 5, building: "rocket_site", count: 2 },
        { region: 5, building: "power_plant", count: 1 },
        { region: 5, building: "facility_rocket", count: 1 },
        { region: 5, building: "dam", count: 1 },
        { region: 6, building: "power_plant", count: 3 },
      ] as never,
      5,
    );
    expect(q).toMatchObject({
      rocket_site: 2,
      power_plant: 1,
      facility: 2,
      dam: 1,
      factories: 2,
    });
    expect(queuedLevels(q, "rocket_site")).toBe(2);
    expect(queuedLevels(q, "dam")).toBe(1);
    expect(queuedLevels(q, "power_plant")).toBe(0);
    const check: BuildCheck = {
      building: "power_plant",
      count: 1,
      controlled: true,
      occupied: false,
      queueLength: 0,
      levelWithQueue: 0,
      usedSlots: 0,
      slots: 5,
      coastal: false,
      harbor: false,
      researched: new Set(),
    } as BuildCheck;
    expect(buildBlockOf(check)).toBe("not_buildable");
    expect(buildBlockOf({ ...check, depthBlock: "no_slots" })).toBe("no_slots");
    expect(buildBlockOf({ ...check, depthBlock: null })).toBeNull();
  });

  it("equipmentTechBlock: design slots, project items, licences", () => {
    const none = new Set<WwTechId>();
    const ctx = (o: object = {}) => ({
      designUsable: () => false,
      licensed: new Set<number>(),
      projectsDone: 0,
      ...o,
    });
    expect(equipmentTechBlock(none, "tank_design", 1)).toBe("bad_line");
    expect(equipmentTechBlock(none, "tank_design", 1, ctx())).toBe("bad_line");
    expect(
      equipmentTechBlock(
        none,
        "tank_design",
        1,
        ctx({ designUsable: () => true }),
      ),
    ).toBeNull();
    expect(equipmentTechBlock(none, "flying_bomb", 1, ctx())).toBe(
      "project_locked",
    );
    expect(
      equipmentTechBlock(none, "flying_bomb", 1, ctx({ projectsDone: 1 << 1 })),
    ).toBeNull();
    expect(equipmentTechBlock(none, "medium_tank", 2, ctx())).toBe("no_tech");
    expect(
      equipmentTechBlock(
        none,
        "medium_tank",
        2,
        ctx({ licensed: new Set([equipKey("medium_tank", 2)]) }),
      ),
    ).toBeNull();
  });
});

describe("resources: the priority part and the v5 padding", () => {
  it("allocateResources: priority demand first, then lines by their own per-factory resources", () => {
    const coal = RESOURCE_IDS.indexOf("coal");
    const steel = RESOURCE_IDS.indexOf("steel");
    const avail = new Array<number>(RESOURCE_COUNT).fill(0);
    avail[coal] = 10;
    avail[steel] = 10;
    const pre = new Array<number>(RESOURCE_COUNT).fill(0);
    pre[coal] = 6;
    const per = new Array<number>(RESOURCE_COUNT).fill(0);
    per[coal] = 1;
    per[steel] = 1;
    const a = allocateResources(
      avail,
      [{ key: equipKey("tank_design", 1), factories: 8, per }],
      [],
      pre,
    );
    expect(a.preGot[coal]).toBe(6);
    // 4 coal left for 8 factories: half.
    expect(a.fill).toEqual([500]);
    expect(a.used[coal]).toBe(10);
    expect(a.used[steel]).toBe(8);
    expect(a.short).toEqual([[coal]]);
  });

  it("a v4 region's six resources gain uranium and coal from the v5 fields", () => {
    const dir = path.join(__dirname, "../testdata/maps", DEEP.map);
    const sc = ScenarioIndex.fromFiles(
      JSON.parse(
        fs.readFileSync(path.join(dir, "scenario.json"), "utf8"),
      ) as ReadonlyScenarioData,
      new Uint8Array(fs.readFileSync(path.join(dir, "regions.bin"))),
    );
    for (const r of sc.landRegions) {
      expect(r.res).toHaveLength(RESOURCE_COUNT);
      expect(r.res[RESOURCE_IDS.indexOf("coal")]).toBe(DEEP.coal[r.id] ?? 0);
      expect(r.res[RESOURCE_IDS.indexOf("uranium")]).toBe(
        DEEP.uranium[r.id] ?? 0,
      );
    }
  });
});
