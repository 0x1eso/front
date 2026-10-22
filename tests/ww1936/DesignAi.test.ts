// World War 1936 P6 lane E (plan Task 3 Step 8, spec §19.3): the AI's
// designs — Germany alone runs as the AI's country under test (a human
// Britain beside it), its experience and techs given by the test.
import type { AiDesignPreset } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  recommendedTank,
  tankRole,
} from "@openfront/engine-lib/ww1936/DesignRules";
import {
  AI_TD_DAY,
  aiDesignsDay,
} from "@openfront/engine/ww1936/depth/AiDesigns";
import {
  equipResources,
  grantDesign,
  sameDesign,
  saveDesign,
} from "@openfront/engine/ww1936/depth/Designs";
import type {
  DesignSlot,
  WwDepth,
} from "@openfront/engine/ww1936/depth/WwDepth";
import {
  aiInput,
  AiPlan,
  aiPlan,
} from "@openfront/engine/ww1936/economy/AiEconomy";
import { issueNavalLineOrder } from "@openfront/engine/ww1936/economy/NavalLines";
import {
  addLine,
  changeLine,
} from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { clearStartSetup, HUMAN, step, stepTo, wwRunner } from "./util";

afterEach(() => usePoliticsContent(null));

const DEU = DEEP.tag.DEU;
/** K5's medium I preset (spec §5.2.3), its radio not researched in 1936. */
const PRESET: AiDesignPreset = {
  id: "preset_medium_1",
  def: {
    kind: "tank",
    base: "medium_1",
    modules: [
      "gun_cs",
      "turret_3",
      "torsion",
      "welded",
      "petrol",
      "radio",
      "smoke",
    ],
    armorLevel: 2,
    engineLevel: 2,
  },
};

async function game(presets: AiDesignPreset[]) {
  usePoliticsContent(depthFixture({ aiDesignPresets: presets }));
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "GBR" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  ww.land.country(DEU)!.armyXpMilli = 300_000;
  return { runner, ww, d: ww.depth };
}

/** The country's saved tank designs, slot order. */
const tanks = (d: WwDepth, id: number): DesignSlot[] =>
  d.country(id)!.des.tank.filter((s): s is DesignSlot => s !== null);

describe("World War 1936 P6: the AI's designs", () => {
  it("AI saves the recommended design when a chassis tech arrives", async () => {
    const { runner, ww, d } = await game([]);
    const ce = ww.economy.country(DEU)!;
    // 1936: its light chassis I (no medium tank yet).
    step(runner, 12 * 15);
    let list = tanks(d, DEU);
    expect(list.map((s) => s.def.base)).toEqual(["light_1"]);
    expect(list[0].origin).toBe("own");
    expect(list[0].def.name).toBe("@rec_light_1");
    expect(
      sameDesign(
        list[0].def,
        recommendedTank("light_1", ce.researched, "tank"),
      ),
    ).toBe(true);
    // The medium chassis arrives: its recommended design within ten days.
    ce.addTech("medium_tank_1");
    const xp = d.xpOf(DEU, 0);
    step(runner, 12 * 15);
    list = tanks(d, DEU);
    expect(list.map((s) => s.def.base)).toEqual(["light_1", "medium_1"]);
    expect(list[1].def.name).toBe("@rec_medium_1");
    expect(d.xpOf(DEU, 0)).toBeLessThan(xp);
    // Nothing more while the techs stay: one design a chassis.
    step(runner, 30 * 15);
    expect(tanks(d, DEU)).toHaveLength(2);
    // The light tank line moves to the light design near its cap.
    const line = ce.lines.find((l) => l.key === equipKey("light_tank", 1))!;
    expect(line).toBeDefined();
    line.effBp = 10_000;
    step(runner, 12 * 15);
    expect(line.key).toBe(equipKey("tank_design", 1));
    // Same chassis weight, another key: 60% of its efficiency kept.
    expect(line.effBp).toBeLessThanOrEqual(6_000 + 100);
  });

  it("AI takes K5's preset, unresearched modules at the base fitting", async () => {
    const { runner, ww, d } = await game([PRESET]);
    const ce = ww.economy.country(DEU)!;
    ce.addTech("medium_tank_1");
    step(runner, 12 * 15);
    const list = tanks(d, DEU);
    expect(list.map((s) => s.def.base)).toEqual(["medium_1"]);
    expect(list[0].def.name).toBe("@preset_medium_1");
    // No torsion bar, radio or turret_3 limit: torsion and radio wait.
    expect(list[0].def.modules).toEqual([
      "gun_cs",
      "turret_3",
      "",
      "welded",
      "petrol",
      "",
      "smoke",
    ]);
    // The radio and the torsion bar researched: no rework within the year…
    ce.addTech("tank_radio");
    ce.addTech("torsion_bar");
    step(runner, 30 * 15);
    expect(tanks(d, DEU)).toHaveLength(1);
    // … and a reworked design once it is a year old.
    list[0].savedDay -= 365;
    step(runner, 12 * 15);
    const now = tanks(d, DEU).filter((s) => !s.obsolete);
    expect(now).toHaveLength(1);
    expect(now[0].def.modules).toEqual(PRESET.def.modules);
    expect(now[0].def.name).toBe("@preset_medium_1");
  });

  it("an aggressor major turns a medium line to tank destroyers in 1940 and fields them", async () => {
    const { runner, ww, d } = await game([]);
    const ce = ww.economy.country(DEU)!;
    for (const t of ["medium_tank_1", "medium_tank_2"] as const) ce.addTech(t);
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "medium_tank", 1, 2)).toBeNull();
    expect(addLine(ww.economy, ce, "medium_tank", 1, 1)).toBeNull();
    const tpl = ww.land.country(DEU)!.nextTemplateId;
    expect(
      ww.land.issue(
        DEU,
        {
          kind: "template_save",
          template: 0,
          base: 0,
          name: "Panzer",
          battalions: ["medium_armor", "medium_armor", "motorized"],
          support: [],
        },
        "ai",
      ),
    ).toBeNull();
    // Called on a 1940 design day (plan decision 30: the lane function).
    let day = AI_TD_DAY;
    while (day % 10 !== DEU % 10) day++;
    aiDesignsDay(d, DEU, day);
    const td = tanks(d, DEU).find((s) => tankRole(s.def) === "tank_destroyer")!;
    expect(td.def.base).toBe("medium_2");
    const slot = d.country(DEU)!.des.tank.indexOf(td) + 1;
    // The smaller medium line builds them; the other stays medium.
    const key = equipKey("tank_design", slot);
    expect(ce.lines.map((l) => l.key)).toEqual([
      equipKey("medium_tank", 1),
      key,
    ]);
    // With a battalion's worth in stock the armoured template takes one.
    ce.stock[key] = 40;
    aiDesignsDay(d, DEU, day + 10);
    expect(ww.land.country(DEU)!.template(tpl)!.def.battalions).toEqual([
      "medium_armor",
      "medium_armor",
      "motorized",
      "tank_destroyer",
    ]);
    void runner;
  });

  it("naval lines launch the AI's fit: radar and dual-purpose guns for Britain in 1940", async () => {
    const { ww, d } = await game([]);
    const GBR = DEEP.tag.GBR;
    const ce = ww.economy.country(GBR)!;
    ww.navy.country(GBR)!.navyXpMilli = 400_000;
    for (const t of ["dual_purpose_guns", "naval_radar_1"] as const) {
      ce.addTech(t);
    }
    expect(
      issueNavalLineOrder(
        ww.economy,
        ce,
        {
          kind: "naval_line_add",
          cls: "cl",
          gen: 2,
          docks: 1,
          count: 2,
          port: DEEP.region.london,
        },
        ww.scenario,
      ),
    ).toBeNull();
    let day = AI_TD_DAY;
    while (day % 10 !== GBR % 10) day++;
    aiDesignsDay(d, GBR, day);
    const s = d.designSlot(GBR, "ship", 1)!;
    expect(s.def.base).toBe("cl_2");
    expect(s.def.modules).toEqual([
      "",
      "sec_dp",
      "",
      "radar_surface",
      "floatplane",
    ]);
    expect(ce.navalLines[0].design).toBe(1);
    // The next design day keeps it: one design a hull and fit.
    const before = d.country(GBR)!.des.ship.filter((x) => x !== null).length;
    aiDesignsDay(d, GBR, day);
    expect(d.country(GBR)!.des.ship.filter((x) => x !== null).length).toBe(
      before,
    );
  });

  it("design_grant hands out a preset for free (spec §18.3)", async () => {
    const { runner, ww, d } = await game([PRESET]);
    const GBR = DEEP.tag.GBR;
    const xp = d.xpOf(GBR, 0);
    const ctx = makeCtx(ww.politics, GBR, GBR, GBR, runner.game.ticks());
    grantDesign(ctx, { kind: "design_grant", preset: "preset_medium_1" }, GBR);
    grantDesign(ctx, { kind: "design_grant", preset: "no_such_preset" }, GBR);
    const list = tanks(d, GBR);
    expect(list).toHaveLength(1);
    expect(list[0].def.name).toBe("@preset_medium_1");
    expect(list[0].def.modules).toEqual(PRESET.def.modules);
    expect(list[0].origin).toBe("own");
    expect(d.xpOf(GBR, 0)).toBe(xp);
  });

  it("an AI treaty member's battleship line never takes a granted shbb_hull design", async () => {
    const { ww, d } = await game([]);
    const FRA = DEEP.tag.FRA;
    const ce = ww.economy.country(FRA)!;
    for (const t of ["bb_2", "bb_3", "super_heavy_battleship"] as const) {
      ce.addTech(t);
    }
    // No navy experience: the AI cannot save its own fit.
    ww.navy.country(FRA)!.navyXpMilli = 0;
    const shbb = {
      kind: "ship" as const,
      base: "bb_3",
      modules: ["", "", "", "", "", "shbb_hull"],
      name: "@grant",
    };
    expect(saveDesign(d, FRA, shbb, 0, "own", 0, 0, 0)).toBe(1);
    expect(
      issueNavalLineOrder(
        ww.economy,
        ce,
        {
          kind: "naval_line_add",
          cls: "bb",
          gen: 3,
          docks: 1,
          count: 1,
          port: DEEP.region.lyon,
        },
        ww.scenario,
      ),
    ).toBeNull();
    const line = ce.navalLines[ce.navalLines.length - 1];
    let day = AI_TD_DAY;
    while (day % 10 !== FRA % 10) day++;
    aiDesignsDay(d, FRA, day);
    expect(line.design).toBe(0);
    // A legal design of the hull is taken.
    const std = { ...shbb, modules: ["", "sec_aa", "", "", "", "floatplane"] };
    expect(saveDesign(d, FRA, std, 0, "own", 0, 0, 0)).toBe(2);
    aiDesignsDay(d, FRA, day + 10);
    expect(line.design).toBe(2);
  });

  it("a design line counts against its static share: no extra medium line (review E4)", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const ce = ww.economy.country(DEU)!;
    ce.addTech("medium_tank_1");
    clearStartSetup(ww.economy, ce);
    const med = {
      kind: "tank" as const,
      base: "medium_1" as const,
      modules: ["", "", "", "", "", "", ""],
      armorLevel: 0,
      engineLevel: 0,
      name: "Med",
    };
    expect(saveDesign(ww.depth, DEU, med, 0, "own", 0, 0, 0)).toBe(1);
    expect(addLine(ww.economy, ce, "medium_tank", 1, 1)).toBeNull();
    const line = ce.lines[0];
    ce.totals.idleMil = 6;
    const tick = runner.game.ticks();
    const day = ww.day(tick);
    const addsMedium = (orders: AiPlan) =>
      orders.some(
        (o) => o.kind === "add_line" && o.equipment === "medium_tank",
      );
    // A static medium line: the plan adds to it, no second medium line.
    expect(addsMedium(aiPlan(aiInput(ww.economy, ce, day, tick)))).toBe(false);
    // The line moves to the design: still none.
    expect(changeLine(ww.economy, ce, line.id, "tank_design", 1)).toBeNull();
    const input = aiInput(ww.economy, ce, day, tick);
    expect(input.lines[0].as).toBe("medium_tank");
    expect(input.lines[0].per).toEqual(equipResources(ww.depth, DEU, line.key));
    const plan = aiPlan(input);
    expect(addsMedium(plan)).toBe(false);
    // Without the mapping (P1's old reading) a medium line would open.
    const raw = {
      ...input,
      lines: input.lines.map(({ as: _a, per: _p, ...l }) => l),
    };
    expect(addsMedium(aiPlan(raw))).toBe(true);
  });
});
