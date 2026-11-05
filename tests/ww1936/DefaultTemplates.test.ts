// World War 1936 ww107: the guide's default templates and start plans, the
// automatic support companies, new templates on tech for a human, and support
// companies that work only as far as their gear goes.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  EQUIP_KEYS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  NEED_GROUPS,
  SupportId,
  TemplateDef,
  TPL_ENGINEER,
  TPL_RECON,
  TPL_SUPPORT_AA,
  TPL_SUPPORT_AT,
  WW_MAX_TEMPLATES,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  autoCompanyTarget,
  companyBit,
  nextAutoCompany,
} from "@openfront/engine-lib/ww1936/AutoCompanies";
import {
  addToSide,
  casCutHits,
  casualtyReturnShare,
  companyFills,
  companyPmOf,
  divisionMods,
  emptySide,
  entrenchMax,
  fearTakenPct,
  ModInput,
  prepLeftBp,
  RECON_POSITION_CUT_PM,
  stepsAtPm,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { isMajor } from "@openfront/engine-lib/ww1936/EconomyStart";
import { coastalFortBp } from "@openfront/engine-lib/ww1936/InvasionRules";
import {
  aiRoleTemplates,
  START_OOB,
  startTemplates,
} from "@openfront/engine-lib/ww1936/LandStart";
import {
  oobArmyRequired,
  planStartOob,
} from "@openfront/engine-lib/ww1936/StartOob";
import { groupStockOf } from "@openfront/engine-lib/ww1936/StartReform";
import { supplyUseMilli } from "@openfront/engine-lib/ww1936/SupplyRules";
import { reinfPctOf } from "@openfront/engine-lib/ww1936/TacticRules";
import {
  divisionStatsAt,
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { dailyAutoCompanies } from "@openfront/engine/ww1936/land/AutoCompanies";
import { stepPosition } from "@openfront/engine/ww1936/land/Positions";
import { autoAddPresets } from "@openfront/engine/ww1936/land/Presets";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it, vi } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  gameHash,
  HUMAN,
  land,
  order,
  step,
  stepTo,
  wwGameStart,
  wwRestore,
  wwRunnerCapture,
} from "./util";

const MAJORS: readonly CountryTag[] = [
  "DEU",
  "SUN",
  "USA",
  "GBR",
  "JPN",
  "ITA",
  "FRA",
];
const ZERO = techTotals(new Set());
const here = path.dirname(fileURLToPath(import.meta.url));
const maps = new NodeGameMapLoader(path.resolve(here, "../../resources/maps"));
const files = () =>
  loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal);

async function world(humans: { clientID: string; country: CountryTag }[]) {
  const runner = await createGameRunner(
    wwGameStart({}, humans),
    undefined,
    await files(),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  step(runner, 2);
  return runner;
}

/** A small human game past the preparation minute. */
async function played(tag: CountryTag = "DEU") {
  const humans = [{ clientID: HUMAN, country: tag }];
  const { runner } = await wwRunnerCapture({}, humans);
  stepTo(runner, WW_PREP_TICKS + 1);
  const l = land(runner.game);
  const id = byTag(runner.game, tag).smallID();
  const ce = l.econ.country(id)!;
  const cl = l.country(id)!;
  const setGear = (type: string, n: number) => {
    EQUIP_KEYS.forEach(([t, gen], k) => {
      if (t === type) ce.stock[k] = gen === 1 ? n : 0;
    });
  };
  const check = () => dailyAutoCompanies(l, cl, id);
  return { runner, humans, l, id, ce, cl, setGear, check };
}

const widthOf = (d: TemplateDef) => templateStats(d, ZERO, GEN1).width;

describe("the default templates", () => {
  it("are the guide's: width 15 at most, no cavalry, no engineers or recon", () => {
    for (const tag of MAJORS) {
      const ts = startTemplates(tag, 5);
      for (const t of ts) {
        expect(widthOf(t.def), `${tag} ${t.key}`).toBeLessThanOrEqual(15);
        expect(t.def.battalions, `${tag} ${t.key}`).not.toContain("cavalry");
        expect(t.def.support, `${tag} ${t.key}`).not.toContain("engineer");
        expect(t.def.support, `${tag} ${t.key}`).not.toContain("recon");
      }
      const line = ts[0].def;
      expect(line.battalions.filter((b) => b === "infantry")).toHaveLength(6);
      expect(line.battalions.filter((b) => b === "artillery")).toHaveLength(1);
      expect(line.support, tag).toEqual(
        tag === "DEU" || tag === "FRA"
          ? ["support_artillery", "support_anti_tank"]
          : ["support_artillery"],
      );
      const light = ts.find((t) => t.def.battalions.includes("light_armor"))!;
      expect([...light.def.battalions].sort(), tag).toEqual(
        [
          ...new Array(3).fill("light_armor"),
          ...new Array(3).fill("motorized"),
          "mot_artillery",
        ].sort(),
      );
      expect(light.def.support, tag).toEqual(["support_artillery"]);
    }
  });

  it("keep the national units and the garrisons as the guide does", () => {
    const def = (tag: CountryTag, key: string) =>
      startTemplates(tag, 5).find((t) => t.key === key)!.def;
    expect(def("DEU", "mountain").battalions).toHaveLength(7);
    expect(def("DEU", "mountain").support).toEqual([
      "support_artillery",
      "support_anti_tank",
    ]);
    expect(def("ITA", "alpini").support).toEqual(["support_artillery"]);
    expect(def("SUN", "mountain_rifle")).toMatchObject({
      battalions: new Array(6).fill("mountain"),
      support: [],
    });
    for (const [tag, key] of [
      ["ITA", "colonial"],
      ["FRA", "colonial"],
      ["GBR", "colonial_garrison"],
      ["JPN", "garrison"],
      ["USA", "garrison"],
    ] as const) {
      expect(def(tag, key)).toMatchObject({
        battalions: new Array(6).fill("infantry"),
        support: [],
      });
    }
  });

  it("leave the minors as they were", () => {
    expect(isMajor("POL")).toBe(false);
    expect(startTemplates("POL", 3).map((t) => t.key)).toEqual([
      "infantry",
      "pre_engineer_infantry",
      "pre_garrison_div",
    ]);
    expect(startTemplates("POL", 3)[0].def.battalions).toHaveLength(10);
    expect(startTemplates("POL", 2).map((t) => t.key)).toEqual([
      "infantry",
      "cavalry",
      "pre_garrison_div",
    ]);
    expect(aiRoleTemplates("POL", 3)).toEqual([]);
  });

  it("a plain start is the plan: nothing short but support gear, for human and AI", async () => {
    const human = await world([{ clientID: HUMAN, country: "DEU" }]);
    const l = land(human.game);
    for (const tag of MAJORS) {
      const id = byTag(human.game, tag).smallID();
      const cl = l.country(id)!;
      const keys = cl.templates.map((t) => t.key);
      const own = startTemplates(tag, 5).map((t) => t.key);
      // A human holds the defaults alone; the AI its role templates beside them.
      if (tag === "DEU") expect(keys).toEqual(own);
      else {
        expect(keys.slice(0, own.length)).toEqual(own);
        expect(keys.length).toBeGreaterThan(own.length);
      }
      for (const t of cl.templates) {
        expect(t.auto === true, `${tag} ${t.key}`).toBe(
          own.includes(t.key) && autoCompanyTarget(t.key).length > 0,
        );
      }
      const want = START_OOB[tag]!.reduce(
        (n, a) => n + a.divisions.reduce((m, [, k]) => m + k, 0),
        0,
      );
      const rows = l.rowsOf(id);
      expect(rows.length, tag).toBe(want);
      const gear = NEED_GROUPS.indexOf("support_equipment");
      for (const r of rows) {
        const s = l.statsOf(r);
        s.need.forEach((n, g) => {
          if (n > 0 && g !== gear) {
            expect(s.fill![g], `${tag} ${NEED_GROUPS[g]}`).toBe(1000);
          }
        });
      }
    }
  }, 60_000);

  it("the baked plan is what planStartOob fields, on the start's own men", async () => {
    for (const tag of MAJORS) {
      const runner = await world([{ clientID: HUMAN, country: tag }]);
      const l = land(runner.game);
      const id = byTag(runner.game, tag).smallID();
      const ce = l.econ.country(id)!;
      const cl = l.country(id)!;
      const t = l.divisions;
      const stock = Array.from(ce.stock);
      let men = 0;
      for (const r of l.rowsOf(id)) men += t.men[r];
      const costs = cl.templates.map((x) => {
        const s = templateStats(x.def, ce.stats, GEN1);
        return { men: s.men, need: s.need };
      });
      const groups = groupStockOf(stock);
      for (const r of l.rowsOf(id)) {
        const n = l.statsOf(r).need;
        const fill = l.statsOf(r).fill!;
        n.forEach((v, g) => {
          groups[g] += Math.floor((v * fill[g]) / 1000);
        });
      }
      const armies = START_OOB[tag]!.map((a) => ({
        required: oobArmyRequired(a),
        items: a.divisions.map(([key, count]) => ({
          template: cl.templates.findIndex((x) => x.key === key),
          count,
        })),
      }));
      const res = planStartOob(men, ce.manpower + men, groups, costs, armies);
      expect(res.cutAny, tag).toBe(false);
      expect(res.menUsed, tag).toBe(men);
    }
  }, 120_000);
});

describe("the automatic companies, the pure rule", () => {
  const LINE: TemplateDef = {
    name: "",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "artillery",
    ],
    support: ["support_artillery"],
  };
  const group = (t: string) => NEED_GROUPS.indexOf(t as never);
  const stock = (o: Record<string, number>) => {
    const free = NEED_GROUPS.map(() => 0);
    for (const [t, n] of Object.entries(o)) free[group(t)] = n;
    return free;
  };
  const techs = (...x: string[]) => new Set(x as WwTechId[]);
  const ALL = techs(
    "engineer_company",
    "recon_company",
    "artillery_1",
    "support_eq_1",
    "anti_tank_1",
  );
  const next = (o: Partial<Parameters<typeof nextAutoCompany>[0]>) =>
    nextAutoCompany({
      def: LINE,
      target: autoCompanyTarget("infantry"),
      researched: ALL,
      divisions: 10,
      free: stock({}),
      dropped: 0,
      ...o,
    });

  it("80 % of the divisions: engineers at 160 gear for ten, not at 159", () => {
    const eng = (n: number) => next({ free: stock({ support_equipment: n }) });
    expect(eng(159)).toBeNull();
    expect(eng(160)).toBe("engineer");
  });

  it("engineers first, then recon, even when recon alone would fit", () => {
    // 15 × 10 × 0.8 = 120 fills recon, not the engineers' 160: it waits its turn.
    expect(next({ free: stock({ support_equipment: 150 }) })).toBeNull();
    expect(
      next({
        def: { ...LINE, support: ["support_artillery", "engineer"] },
        free: stock({ support_equipment: 150 }),
      }),
    ).toBe("recon");
  });

  it("a company with its tech closed waits, and the next one goes on", () => {
    const researched = techs("recon_company", "artillery_1", "support_eq_1");
    expect(next({ researched, free: stock({ support_equipment: 1000 }) })).toBe(
      "recon",
    );
    // Other gear isn't held back by a shortage of support equipment.
    expect(next({ free: stock({ anti_tank: 64 }) })).toBe("support_anti_tank");
    expect(next({ free: stock({ anti_tank: 63 }) })).toBeNull();
  });

  it("stops at the template's limit, and a template with no divisions counts as one", () => {
    expect(
      next({
        def: {
          ...LINE,
          support: ["engineer", "recon", "support_artillery", "signal"],
        },
        free: stock({ anti_tank: 1000 }),
      }),
    ).toBeNull();
    expect(next({ divisions: 0, free: stock({ support_equipment: 16 }) })).toBe(
      "engineer",
    );
    expect(
      next({ divisions: 0, free: stock({ support_equipment: 15 }) }),
    ).toBeNull();
  });

  it("a company the AI gave up wants every division and one more: what the drop gave back isn't enough", () => {
    const dropped = companyBit("engineer");
    const eng = (n: number) =>
      next({ dropped, free: stock({ support_equipment: n }) });
    expect(eng(200)).toBeNull();
    expect(eng(219)).toBeNull();
    expect(eng(220)).toBe("engineer");
  });

  it("targets: the line's four, two for the narrow line, none for a garrison", () => {
    expect(autoCompanyTarget("infantry")).toEqual([
      "engineer",
      "recon",
      "support_artillery",
      "support_anti_tank",
    ]);
    expect(autoCompanyTarget("")).toEqual(autoCompanyTarget("infantry"));
    expect(autoCompanyTarget("pre_guide_assault9")).toEqual([
      "engineer",
      "support_artillery",
    ]);
    for (const k of ["garrison", "colonial", "mountain_rifle"]) {
      expect(autoCompanyTarget(k), k).toEqual([]);
    }
  });
});

describe("the automatic companies in the game", () => {
  it("one company a template a check, through the refit, only on its own day", async () => {
    const { l, id, cl, setGear, check } = await played();
    const line = cl.templates[0];
    setGear("support_equipment", 1_000_000);
    setGear("anti_tank", 1_000_000);
    const armour = cl.templates[1];
    dailyAutoCompanies(l, cl, id + 1);
    expect(line.def.support).toHaveLength(2);
    check();
    expect(line.def.support).toContain("engineer");
    expect(line.def.support).not.toContain("recon");
    expect(armour.def.support).toContain("engineer");
    check();
    expect(line.def.support).toContain("recon");
    expect(armour.def.support).toContain("recon");
    check();
    expect(armour.def.support).toContain("support_anti_tank");
    expect(line.def.support).toHaveLength(4);
    // It is the ordinary save: the name stays the template's.
    expect(line.key).not.toBe("");
    expect(line.auto).toBe(true);
  }, 60_000);

  it("gear owed to divisions isn't free, and one check spends its stock once", async () => {
    const { l, id, cl, setGear, check } = await played();
    const line = cl.templates[0];
    const rows = l
      .rowsOf(id)
      .filter((r) => l.divisions.template[r] === line.id);
    expect(rows.length).toBeGreaterThan(0);
    const armour = cl.templates[1];
    const armourRows = l
      .rowsOf(id)
      .filter((r) => l.divisions.template[r] === armour.id).length;
    // Enough for the line, and none left for the armour after it.
    setGear(
      "support_equipment",
      Math.ceil(rows.length * 20 * 0.8) + Math.max(1, armourRows) * 8,
    );
    check();
    expect(line.def.support).toContain("engineer");
    expect(armour.def.support).not.toContain("engineer");
    // Nothing has reached the divisions yet: recon can't count the same gear.
    check();
    expect(line.def.support).not.toContain("recon");
  }, 60_000);

  it("a human's edit turns them off, the switch turns them on, a save by the rule doesn't", async () => {
    const { runner, l, id, cl, setGear, check } = await played();
    const line = cl.templates[0];
    setGear("support_equipment", 1_000_000);
    const save = (by: "player" | "ai") =>
      l.issue(
        id,
        {
          kind: "template_save",
          template: line.id,
          base: 0,
          name: "",
          battalions: [...line.def.battalions],
          support: [...line.def.support],
        },
        by,
      );
    expect(save("ai")).toBeNull();
    expect(line.auto).toBe(true);
    expect(save("player")).toBeNull();
    expect(line.auto).toBeUndefined();
    check();
    expect(line.def.support).not.toContain("engineer");
    runner.addTurn({
      turnNumber: runner.game.ticks(),
      intents: [
        order(HUMAN, { kind: "template_auto", template: line.id, on: true }),
      ],
    });
    step(runner, 1);
    expect(line.auto).toBe(true);
    check();
    expect(line.def.support).toContain("engineer");
    expect(
      l.issue(id, { kind: "template_auto", template: line.id, on: false }),
    ).toBeNull();
    expect(line.auto).toBeUndefined();
    const garrison = {
      id: cl.nextTemplateId++,
      key: "garrison",
      def: { name: "", battalions: ["infantry" as const], support: [] },
    };
    cl.templates.push(garrison);
    expect(
      l.issue(id, { kind: "template_auto", template: garrison.id, on: true }),
    ).toBe("bad_template");
  }, 60_000);

  it("nothing moves in the preparation minute", async () => {
    const { runner } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    step(runner, 2);
    const l = land(runner.game);
    const id = byTag(runner.game, "DEU").smallID();
    const cl = l.country(id)!;
    const ce = l.econ.country(id)!;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 1_000_000;
    dailyAutoCompanies(l, cl, id);
    expect(cl.templates[0].def.support).toHaveLength(2);
  }, 60_000);

  it("the AI's add and drop don't fight: a company goes once and stays gone on the same stock", async () => {
    const { runner } = await wwRunnerCapture({}, []);
    stepTo(runner, WW_PREP_TICKS + 1);
    const l = land(runner.game);
    const id = byTag(runner.game, "DEU").smallID();
    const cl = l.country(id)!;
    const ce = l.econ.country(id)!;
    const line = cl.templates[0];
    const rows = l
      .rowsOf(id)
      .filter((r) => l.divisions.template[r] === line.id);
    const setGear = (n: number) =>
      EQUIP_KEYS.forEach(([t, gen], k) => {
        if (t === "support_equipment") ce.stock[k] = gen === 1 ? n : 0;
      });
    cl.training.length = 0;
    cl.trainees.length = 0;
    setGear(Math.max(1, rows.length) * 20);
    dailyAutoCompanies(l, cl, id);
    expect(line.def.support).toContain("engineer");
    // The divisions take it all: training stalls and the company goes.
    setGear(0);
    dailyAutoCompanies(l, cl, id);
    expect(line.def.support).not.toContain("engineer");
    expect(line.autoDropped).toBe(companyBit("engineer"));
    // What came back fills the divisions but leaves nothing to train on.
    setGear(Math.max(1, rows.length) * 20);
    const changes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const before = line.def.support.length;
      dailyAutoCompanies(l, cl, id);
      changes.push(line.def.support.length - before);
    }
    expect(changes.every((c) => c === 0)).toBe(true);
    // A real surplus brings it back, and the mark goes.
    setGear((Math.max(1, rows.length) + 1) * 20);
    dailyAutoCompanies(l, cl, id);
    expect(line.def.support).toContain("engineer");
    expect(line.autoDropped).toBeUndefined();
  }, 60_000);

  it("snapshot and restore keep the switch and the dropped mark, and the hash sees them", async () => {
    const { runner, humans, cl } = await played();
    const line = cl.templates[0];
    line.autoDropped = companyBit("recon");
    const off = cl.templates[1];
    delete off.auto;
    const hash = gameHash(runner);
    const copy = await wwRestore(runner, humans);
    expect(gameHash(copy)).toBe(hash);
    const c = land(copy.game).country(cl.smallID)!;
    expect(c.templates[0].auto).toBe(true);
    expect(c.templates[0].autoDropped).toBe(companyBit("recon"));
    expect(c.templates[1].auto).toBeUndefined();
    line.autoDropped = 0;
    expect(gameHash(runner)).not.toBe(hash);
  }, 60_000);
});

describe("new templates on tech", () => {
  it("a human gets the guide's as they open, its companies on, and divisions stay as they are", async () => {
    const { l, id, cl, ce } = await played();
    autoAddPresets(l, cl);
    const before = l.rowsOf(id).map((r) => l.divisions.template[r]);
    const has = (k: string) => cl.templates.some((t) => t.key === k);
    // Open from the first day: the narrow line and the motorized division.
    expect(has("pre_guide_assault9")).toBe(true);
    expect(has("pre_guide_motor")).toBe(true);
    // Germany's mountain line is already this template.
    expect(has("pre_guide_assault")).toBe(false);
    expect(has("pre_guide_armour")).toBe(false);
    ce.addTech("light_tank_2");
    ce.addTech("medium_tank_1");
    autoAddPresets(l, cl);
    const k22 = cl.templates.find((t) => t.key === "pre_guide_armour")!;
    expect(k22.auto).toBe(true);
    expect(widthOf(k22.def)).toBe(22);
    expect(has("pre_guide_armour15")).toBe(true);
    expect(l.rowsOf(id).map((r) => l.divisions.template[r])).toEqual(before);
  }, 60_000);

  it("a full list gets the existing notice and no second try; a deleted one stays gone", async () => {
    const { l, cl, ce } = await played();
    autoAddPresets(l, cl);
    while (cl.templates.length < WW_MAX_TEMPLATES) {
      cl.templates.push({
        id: cl.nextTemplateId++,
        key: "",
        def: { name: "x", battalions: ["cavalry"], support: [] },
      });
    }
    const message = vi.spyOn(l, "message");
    ce.addTech("light_tank_2");
    ce.addTech("medium_tank_1");
    autoAddPresets(l, cl);
    expect(cl.templates).toHaveLength(WW_MAX_TEMPLATES);
    expect(message).toHaveBeenCalledWith(
      cl.smallID,
      "ww1936.econ.block.too_many_templates",
    );
    cl.templates.pop();
    cl.templates.pop();
    autoAddPresets(l, cl);
    expect(cl.templates.map((t) => t.key)).not.toContain("pre_guide_armour");
  }, 60_000);

  it("the AI keeps its own role templates", async () => {
    const { runner } = await wwRunnerCapture({}, []);
    stepTo(runner, WW_PREP_TICKS + 1);
    const l = land(runner.game);
    const id = byTag(runner.game, "DEU").smallID();
    const cl = l.country(id)!;
    const ce = l.econ.country(id)!;
    expect(cl.templates.map((t) => t.key)).toContain("pre_mot_infantry");
    ce.addTech("light_tank_2");
    ce.addTech("medium_tank_1");
    autoAddPresets(l, cl);
    const keys = cl.templates.map((t) => t.key);
    expect(keys).toContain("pre_medium_armored");
    expect(keys.filter((k) => k.startsWith("pre_guide"))).toEqual([]);
  }, 60_000);
});

describe("a support company works as far as its gear goes", () => {
  const INF = new Array(9).fill("infantry");
  const stats = (support: SupportId[]) =>
    templateStats({ name: "", battalions: INF, support }, ZERO, GEN1);
  const at = (support: SupportId[], group: string, pm: number) => {
    const s = stats(support);
    const fill = NEED_GROUPS.map((t) => (t === group ? pm : 1000));
    return divisionStatsAt(s, fill, s.men);
  };
  const G = "support_equipment";
  const input = (o: Partial<ModInput>): ModInput =>
    ({
      attacking: true,
      genAtt: 0,
      genDef: 0,
      traits: 0,
      flags: 0,
      tech: ZERO,
      exp: 0,
      planBp: 0,
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
      ...o,
    }) as ModInput;
  const line = (i: ModInput, id: string) =>
    divisionMods(i).attackLines.find((x) => x.id === id)?.bp;

  const supportSlot = () =>
    GROUND_EQUIP_KEYS.findIndex((k) => EQUIP_KEYS[k][0] === G);

  it("reads the lowest fill of its gear; full numbers read full", () => {
    expect(companyPmOf(at(["engineer"], G, 400), TPL_ENGINEER)).toBe(400);
    expect(companyPmOf(stats(["engineer"]), TPL_ENGINEER)).toBe(1000);
    expect(companyPmOf(at([], G, 400), TPL_ENGINEER)).toBe(0);
    expect(
      companyFills(
        ["logistics", "support_artillery"],
        NEED_GROUPS.map((t) => (t === "motorized" ? 300 : 1000)),
      ),
    ).toEqual([
      { id: "logistics", pm: 300 },
      { id: "support_artillery", pm: 1000 },
    ]);
  });

  it("the trench cap: 5, plus the engineers' 5 by their gear, rounded down", () => {
    const cap = (pm: number) => entrenchMax(TPL_ENGINEER, ZERO, pm);
    expect([0, 199, 200, 500, 800, 999, 1000].map(cap)).toEqual([
      5, 5, 6, 7, 9, 9, 10,
    ]);
  });

  it("the engineers' cuts on prepared ground, river and fort", () => {
    expect(stats(["engineer"]).engineerCutPm).toBe(300);
    expect(at(["engineer"], G, 500).engineerCutPm).toBe(150);
    expect(at(["engineer"], G, 0).engineerCutPm).toBe(0);
    const fort = (engineerPm: number) =>
      line(input({ flags: TPL_ENGINEER, fort: 2, engineerPm }), "fort")!;
    const none = line(input({ fort: 2 }), "fort")!;
    expect(fort(0)).toBe(none);
    expect(fort(1000)).toBe(Math.ceil(none * 0.75));
    expect(fort(500)).toBe(Math.ceil(none * 0.88));
    const river = (engineerPm: number) =>
      line(input({ flags: TPL_ENGINEER, river: 2, engineerPm }), "river")!;
    const wet = line(input({ river: 2 }), "river")!;
    expect(river(0)).toBe(wet);
    expect(river(1000)).toBe(wet / 2);
    expect(river(500)).toBe((wet * 3) / 4);
    expect(coastalFortBp(2, true, 1000)).toBe(2250);
    expect(coastalFortBp(2, true, 500)).toBe(2626);
    expect(coastalFortBp(2, true, 0)).toBe(3000);
  });

  it("digging and positions: every odd day at full, none without gear, spread between", () => {
    const steps = (pm: number) => {
      let n = 0;
      for (let i = 0; i < 100; i++) n += stepsAtPm(i, pm);
      return n;
    };
    expect([0, 250, 500, 1000].map(steps)).toEqual([0, 25, 50, 100]);
    const after = (pm: number) => {
      let s = { level: 0, days: 0 };
      for (let i = 0; i < 6; i++) {
        s = stepPosition(s.level, s.days, true, false, false, pm > 0, pm);
      }
      return s;
    };
    expect(after(1000)).toEqual({ level: 1, days: 2 });
    expect(after(0)).toEqual({ level: 0, days: 6 });
  });

  it("recon: its cut by the gear, and what is on or off at half", () => {
    expect(prepLeftBp(10_000, 5000, TPL_RECON, 0, 0, 1000)).toBe(9500);
    expect(prepLeftBp(10_000, 5000, TPL_RECON, 0, 0, 500)).toBe(9750);
    expect(prepLeftBp(10_000, 5000, TPL_RECON, 0, 0, 0)).toBe(10_000);
    const side = (pm: number) => {
      const sum = emptySide();
      const s = at(["recon"], G, pm);
      addToSide(sum, s, s.orgMilli);
      return sum;
    };
    expect(side(1000).reconCutPm).toBe(RECON_POSITION_CUT_PM);
    expect(side(500).reconCutPm).toBe(RECON_POSITION_CUT_PM / 2);
    expect(side(500).recon).toBe(true);
    expect(side(499).recon).toBeUndefined();
  });

  it("guns, anti-tank and anti-air: their rules go with their guns", () => {
    const guns = (pm: number) => {
      const sum = emptySide();
      const s = at(["support_artillery"], "artillery", pm);
      addToSide(sum, s, s.orgMilli);
      return [sum.wearPm, s.prepFireBp];
    };
    const full = stats(["support_artillery"]).prepFireBp;
    expect(full).toBeGreaterThan(0);
    expect(guns(1000)).toEqual([1000, full]);
    expect(guns(500)).toEqual([500, Math.floor(full / 2)]);
    expect(guns(0)).toEqual([0, 0]);
    expect(fearTakenPct(40, TPL_SUPPORT_AT, 1000)).toBe(20);
    expect(fearTakenPct(40, TPL_SUPPORT_AT, 500)).toBe(30);
    expect(fearTakenPct(40, TPL_SUPPORT_AT, 0)).toBe(40);
    expect(casCutHits(1000, 0, 0, TPL_SUPPORT_AA, 1000)).toBe(800);
    expect(casCutHits(1000, 0, 0, TPL_SUPPORT_AA, 500)).toBe(900);
    expect(casCutHits(1000, 0, 0, TPL_SUPPORT_AA, 0)).toBe(1000);
    const air = (supportAaPm: number) =>
      line(input({ flags: TPL_SUPPORT_AA, airBp: -4000, supportAaPm }), "air");
    expect([air(1000), air(500), air(0)]).toEqual([-3000, -3520, -4000]);
    const aa = at(["support_anti_air"], "anti_air", 500);
    expect(aa.airAtk).toBe(stats(["support_anti_air"]).airAtk / 2);
  });

  it("hospital, logistics and signal", () => {
    expect(casualtyReturnShare(true, 0, 1000)).toBe(50);
    expect(casualtyReturnShare(true, 0, 500)).toBe(35);
    expect(casualtyReturnShare(true, 0, 0)).toBe(20);
    expect(supplyUseMilli(1000, 0, true, false, 0, 1000)).toBe(800);
    expect(supplyUseMilli(1000, 0, true, false, 0, 500)).toBe(900);
    expect(reinfPctOf(40, true, 0, 1000)).toBe(45);
    expect(reinfPctOf(40, true, 0, 500)).toBe(40);
  });

  it("in the game: a line with no gear for its engineers gets none of their cap, and the card says so", async () => {
    const { l, id, cl, ce, setGear, check } = await played();
    setGear("support_equipment", 1_000_000);
    check();
    const line = cl.templates[0];
    expect(line.def.support).toContain("engineer");
    const r = l.rowsOf(id).find((x) => l.divisions.template[x] === line.id)!;
    expect(l.companyPm(r, TPL_ENGINEER)).toBe(0);
    expect(
      entrenchMax(l.flagsOf(r), ce.stats, l.companyPm(r, TPL_ENGINEER)),
    ).toBe(entrenchMax(0, ce.stats));
    const card = () =>
      l.countryDetail(cl).divisions.find((x) => x.id === l.divisions.id[r])!;
    expect(card().companies).toEqual([{ id: "engineer", pm: 0 }]);
    // Filled, the card has nothing to say.
    l.addEquip(r, supportSlot(), 20);
    expect(l.companyPm(r, TPL_ENGINEER)).toBe(1000);
    expect(card().companies).toBeUndefined();
  }, 60_000);
});

describe("British Guiana", () => {
  it("is worth 5 victory points in both scenario files", () => {
    for (const f of [
      "../../map-generator/scenarios/world1936/scenario.src.json",
      "../../resources/maps/world1936/scenario.json",
    ]) {
      const regions = JSON.parse(fs.readFileSync(path.join(here, f), "utf8"))
        .regions as { id: number; vp: number }[];
      expect(regions.find((r) => r.id === 972)!.vp, f).toBe(5);
    }
  });

  it("takes the world's total to 1,465", async () => {
    const runner = await world([]);
    expect(runner.game.worldWar()!.scenario.totalVp()).toBe(1465);
  }, 60_000);
});
