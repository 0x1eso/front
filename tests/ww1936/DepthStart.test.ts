// World War 1936 ww9 (design §5.5, §8): the thought sliders start on the
// first clock for every country, human or AI, at its row (historical AI)
// or its personality's; an empty table starts nothing.
import { THOUGHT_SLIDER_COUNT } from "@openfront/engine-api/ww1936/ThoughtTypes";
import { START_THOUGHTS } from "@openfront/engine-lib/ww1936/content/depth/thought";
import { thoughtStartPos } from "@openfront/engine-lib/ww1936/ThoughtRules";
import { thoughtStatsOf } from "@openfront/engine/ww1936/depth/Thought";
import { aiPersonality } from "@openfront/engine/ww1936/economy/AiEconomy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

describe("start thoughts", () => {
  it("every country, the human too, starts at its seeded row on the first clock", async () => {
    usePoliticsContent(depthFixture({ startThoughts: START_THOUGHTS }));
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANITA", country: "ITA" }],
      DEEP.map,
    );
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    stepTo(runner, 2);
    for (const tag of ["DEU", "POL", "FRA", "GBR", "ITA"] as const) {
      const id = DEEP.tag[tag];
      const th = d.country(id)!.th;
      expect(th.started, tag).toBe(true);
      const pos = thoughtStartPos({
        table: START_THOUGHTS,
        tag,
        personality: aiPersonality(tag),
        historical: runner.game.config().historicalAi() === true,
        seed: ww.politics.seed,
        id,
      });
      expect(th.target, tag).toEqual(pos);
      expect(th.curMilli, tag).toEqual(pos.map((p) => p * 1000));
      expect(th.target).toHaveLength(THOUGHT_SLIDER_COUNT);
    }
  });

  it("an empty table starts nothing and the stats stay empty", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    stepTo(runner, 2);
    const d = runner.game.worldWar()!.depth;
    expect(d.country(DEEP.tag.DEU)!.th.started).toBe(false);
    expect(thoughtStatsOf(d, DEEP.tag.DEU)).toEqual({});
  });
});
