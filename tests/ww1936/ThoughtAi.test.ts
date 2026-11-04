// World War 1936 thought sliders, lane T2: the AI's judgement (design §9).
import { THOUGHT_AI_MIN_CHANGE } from "@openfront/engine-api/ww1936/ThoughtTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  airRowOf,
  landRowOf,
  navalRowOf,
} from "@openfront/engine/ww1936/depth/AiCommand";
import { startPosOf } from "@openfront/engine/ww1936/depth/Thought";
import { aiThoughtTargets } from "@openfront/engine/ww1936/depth/ThoughtAi";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { dropPact, stepTo, warAfterPrep, wwRunner } from "./util";
import { giveWing } from "./wingUtil";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const DEU = DEEP.tag.DEU;

function setTarget(d: WwDepth, id: number, target: number[]): void {
  d.country(id)!.th = {
    target,
    curMilli: target.map((t) => t * 1000),
    started: true,
  };
}

describe("thought AI (design §9)", () => {
  it("judges only on its own day, and only once the sliders have started", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANPOL", country: "POL" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    const d = runner.game.worldWar()!.depth;
    const far = new Array<number>(9).fill(9);
    // No thought state yet: nothing to judge.
    expect(aiThoughtTargets(d, DEU, DEU % 90)).toBeNull();
    setTarget(d, DEU, far);
    expect(aiThoughtTargets(d, DEU, (DEU % 90) + 1)).toBeNull();
    const out = aiThoughtTargets(d, DEU, DEU % 90);
    expect(out).not.toBeNull();
    const start = startPosOf(d, DEU);
    out!.forEach((v, s) => {
      expect(Math.abs(v)).toBeLessThanOrEqual(10);
      // A slider that moved went toward the situation, by the minimum or more.
      if (v !== far[s]) {
        expect(Math.abs(v - far[s])).toBeGreaterThanOrEqual(
          THOUGHT_AI_MIN_CHANGE,
        );
        expect(Math.abs(v - start[s])).toBeLessThanOrEqual(5);
      }
    });
    // Already there: nothing to change.
    setTarget(d, DEU, out!);
    expect(aiThoughtTargets(d, DEU, DEU % 90)).toBeNull();
  });

  it("at war it judges every 30 days and answers the same way twice", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANPOL", country: "POL" }],
      DEEP.map,
    );
    dropPact(runner.game, "DEU", "POL");
    warAfterPrep(runner, "HUMANPOL", "DEU");
    const d = runner.game.worldWar()!.depth;
    expect(d.ww.hasWar(DEU)).toBe(true);
    setTarget(d, DEU, new Array<number>(9).fill(-9));
    expect(aiThoughtTargets(d, DEU, (DEU % 30) + 30)).toEqual(
      aiThoughtTargets(d, DEU, (DEU % 30) + 30),
    );
    expect(aiThoughtTargets(d, DEU, DEU % 30)).not.toBeNull();
  });

  it("a wing counts by its own type: strategic bombers pull the strategic slider", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANPOL", country: "POL" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const judge = (type: "strat_bomber" | "bomber"): number => {
      for (const w of [...ww.air.wingsOf(DEU)]) ww.air.removeWing(w.id, true);
      giveWing(ww.air, { owner: DEU, type, planes: 10 });
      setTarget(d, DEU, new Array<number>(9).fill(9));
      return aiThoughtTargets(d, DEU, DEU % 90)![7];
    };
    // Generation 1 of a plain bomber wing is not a strategic bomber.
    expect(judge("strat_bomber")).toBeLessThan(judge("bomber"));
  });

  it("the officer-corps tables are keyed by start position", () => {
    expect(landRowOf([0, 0, -5, 0, 0, 0, 0, 0, 0])).toBe("gd_mass");
    expect(landRowOf([0, -4, 0, 0, 0, 0, 0, 0, 0])).toBe("gd_mobile");
    expect(landRowOf([0, 4, 0, 0, 0, 0, 0, 0, 0])).toBe("gd_firepower");
    expect(landRowOf(new Array<number>(9).fill(0))).toBe("gd_battleplan");
    expect(navalRowOf([0, 0, 0, 0, -4, 0, 0, 0, 0])).toBe(
      "gd_trade_interdiction",
    );
    expect(navalRowOf(new Array<number>(9).fill(0))).toBe("");
    expect(airRowOf([0, 0, 0, 0, 0, 0, 0, -4, 0])).toBe(
      "gd_strategic_destruction",
    );
    expect(airRowOf([0, 0, 0, 0, 0, 0, 0, 4, 0])).toBe(
      "gd_battlefield_support",
    );
  });
});
