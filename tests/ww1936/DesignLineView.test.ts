import type { DepthOrder } from "@openfront/engine-api/Schemas";
// A design line's screen data: the line row of a tank destroyer (or any
// design) carries the design's own cost and resources, so the row shows
// the real units a day and what it waits on (it showed "0.0 a day" and no
// shortage, as the static table holds 0 for the design types).
import {
  equipKey,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { recommendedTank } from "@openfront/engine-lib/ww1936/DesignRules";
import { equipCostMilli } from "@openfront/engine/ww1936/depth/Designs";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  lineDaysEach,
  lineRows,
} from "../../src/client/hud/ww1936/EconomyModel";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { clearStartSetup, HUMAN, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;

describe("a design line on the screen", () => {
  it("shows the design's cost, output and missing resource", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const ce = ww.economy.country(GBR)!;
    for (const t of WW_TECH_IDS) ce.addTech(t);
    clearStartSetup(ww.economy, ce);
    // A tank destroyer whose gun takes tungsten (the high-velocity gun).
    const td = {
      ...recommendedTank("medium_1", ce.researched, "tank_destroyer"),
      name: "TD",
    } as Extract<DepthOrder, { kind: "design_save" }>["def"];
    expect(d.issue(GBR, { kind: "design_save", def: td }, 0)).toBeNull();
    const key = equipKey("tank_design", 1);
    expect(addLine(ww.economy, ce, "tank_design", 1, 3)).toBeNull();
    step(runner, 15 * 30);
    ww.economy.markCountryDirty(GBR);
    const detail = ww.economy
      .takeData()!
      .details.find((x) => x.smallID === GBR)!;
    const line = detail.lines[0];
    // The engine builds it: output and stock are real...
    expect(ce.stock[key]).toBeGreaterThan(0);
    // ...and the row says so: the design's cost, not the static 0.
    expect(line.costMilli).toBe(equipCostMilli(d, GBR, key));
    expect(line.costMilli).toBeGreaterThan(0);
    const row = lineRows(detail)[0];
    expect(row.perDay).toBeGreaterThan(0);
    expect(row.perDay).toBeCloseTo(line.outputMilli / line.costMilli, 9);
    // Without tungsten the gun's line is idle, and the row names it.
    expect(line.per?.[3]).toBeGreaterThan(0);
    detail.resources[3].produced = 0;
    detail.resources[3].imported = 0;
    expect(lineRows(detail)[0].shortage).toContain("tungsten");
  });

  it("days for one unit when it takes more than a day", () => {
    expect(lineDaysEach(0)).toBe(0);
    expect(lineDaysEach(1.5)).toBe(0);
    expect(lineDaysEach(0.25)).toBe(4);
    expect(lineDaysEach(0.03)).toBe(34);
  });
});
