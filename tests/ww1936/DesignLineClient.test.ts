// The client's line judge (lineDepthOf over a WwDepthView) agrees with the
// engine's on a real game: a design the screen allows is accepted by
// addLine, one it blocks is refused.
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { recommendedPlane } from "@openfront/engine-lib/ww1936/DesignRules";
import { equipmentTechBlock } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { copyDesignTo } from "@openfront/engine/ww1936/depth/DesignCopy";
import { saveDesign } from "@openfront/engine/ww1936/depth/Designs";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  lineDepthOf,
  pickerLayout,
} from "../../src/client/hud/ww1936/EconomyModel";
import { WwDepthView } from "../../src/client/view/WwDepthView";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { clearStartSetup, HUMAN, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const DEU = DEEP.tag.DEU;
const ALL = new Set(WW_TECH_IDS);

describe("the client's depth context for a line", () => {
  it("allows exactly the designs and projects the engine accepts", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const ce = ww.economy.country(GBR)!;
    clearStartSetup(ww.economy, ce);
    for (const t of WW_TECH_IDS) ce.addTech(t);
    const tank = { ...recommendedPlane("small_1", ALL), name: "@" };
    // Slot 1: my plane; tank slot 1 and 2: mine, then an obsolete one.
    expect(saveDesign(d, GBR, tank, 0, "own", 0, 0, 0)).toBe(1);
    expect(saveDesign(d, DEU, tank, 0, "own", 0, 0, 0)).toBe(1);
    expect(copyDesignTo(d, DEU, 1, "plane", GBR, "captured")).toBe(2);
    // The game's screen data, as the client receives it.
    d.markCountry(GBR);
    d.markGlobal();
    const view = new WwDepthView();
    view.apply(d.takeData()!);
    const game = { wwDepth: () => view };
    const depth = lineDepthOf(game, GBR);
    expect(depth).toBeDefined();
    const researched = new Set(ce.researched);
    for (const [type, slot] of [
      ["plane_design", 1],
      ["plane_design", 2],
      ["plane_design", 3],
      ["tank_design", 1],
      ["flying_bomb", 1],
      ["ballistic_rocket", 1],
    ] as const) {
      const client = equipmentTechBlock(researched, type, slot, depth);
      const engine = addLine(ww.economy, ce, type, slot, 1);
      expect([type, slot, client === null]).toEqual([
        type,
        slot,
        engine === null,
      ]);
      // Remove the line again so the limit never interferes.
      ce.lines.length = 0;
    }
    // A finished project opens its line item on both sides.
    d.country(GBR)!.proj.done |=
      1 << SPECIAL_PROJECTS.indexOf("sp_flying_bomb");
    d.markCountry(GBR);
    view.apply(d.takeData()!);
    const after = lineDepthOf(game, GBR);
    expect(equipmentTechBlock(researched, "flying_bomb", 1, after)).toBeNull();
    expect(addLine(ww.economy, ce, "flying_bomb", 1, 1)).toBeNull();
    // Without the depth context the old judge refused every design.
    expect(equipmentTechBlock(researched, "plane_design", 1)).toBe("bad_line");
    expect(equipmentTechBlock(researched, "plane_design", 1, depth)).toBeNull();
    // Only my usable, non-captured design is offered, and it stands in for
    // its cell's static plane (the tank side has none).
    const layout = pickerLayout(view.detail(GBR)!.designs);
    expect([...layout.replaced.values()].map((r) => r.slot)).toEqual([1]);
    expect(layout.groups).toEqual([]);
    expect(layout.foreign).toEqual([]);
  });
});
