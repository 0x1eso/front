// World War 1936 ww9 (design §8): the thought sliders in the engine: the
// order, the daily drift, the stats, the snapshot, the AI hook.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { START_THOUGHTS } from "@openfront/engine-lib/ww1936/content/depth/thought";
import {
  thoughtNotch,
  thoughtStats,
} from "@openfront/engine-lib/ww1936/ThoughtRules";
import { thoughtStatsOf } from "@openfront/engine/ww1936/depth/Thought";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { gameHash, order, step, stepTo, wwRestore, wwRunner } from "./util";

const C_ITA = "HUMANITA";
const HUMANS = [{ clientID: C_ITA, country: "ITA" as const }];
const ITA = DEEP.tag.ITA;

beforeEach(() =>
  usePoliticsContent(depthFixture({ startThoughts: START_THOUGHTS })),
);
afterEach(() => usePoliticsContent(null));

describe("thought sliders in the engine", () => {
  it("the order moves a slider at once in the prep minute, then by 0.1 a day; refusals change nothing", async () => {
    const a = await wwRunner({}, HUMANS, DEEP.map);
    step(a, 2);
    const ww = a.game.worldWar()!;
    const d = ww.depth;
    const th = d.country(ITA)!.th;
    expect(th.started).toBe(true);
    const start = th.target[0];
    const goal = start === 10 ? -10 : 10;
    const stats0 = { ...ww.economy.country(ITA)!.stats };
    step(a, 1, [
      order(C_ITA, { kind: "thought_set", slider: "off_def", pos: goal }),
    ]);
    // In the prep minute no time passes: the position follows at once.
    expect(th.target[0]).toBe(goal);
    expect(th.curMilli[0]).toBe(goal * 1000);
    expect(ww.economy.country(ITA)!.stats).not.toEqual(stats0);
    // The same target again, and a slider out of range, are refused.
    expect(
      d.issueThought(
        ITA,
        { kind: "thought_set", slider: "off_def", pos: goal },
        a.game.ticks(),
      ),
    ).toBe("bad_index");
    // After the prep minute a new target is followed 0.1 a day.
    stepTo(a, WW_PREP_TICKS + 2);
    step(a, 1, [
      order(C_ITA, { kind: "thought_set", slider: "off_def", pos: 0 }),
    ]);
    const h = gameHash(a);
    expect(th.target[0]).toBe(0);
    expect(th.curMilli[0]).toBe(goal * 1000);
    expect(h).toBe(gameHash(a));
    for (let day = 1; day <= 3; day++) {
      stepTo(a, WW_PREP_TICKS + 2 + Math.ceil((day * 15) / 2) + 10);
    }
    expect(th.curMilli[0]).toBeLessThan(goal * 1000);
    expect(th.curMilli[0] % 100).toBe(0);
  }, 30_000);

  it("the stats are the sliders' notches, and a restored game continues alike", async () => {
    const a = await wwRunner({}, HUMANS, DEEP.map);
    stepTo(a, WW_PREP_TICKS + 2);
    const ww = a.game.worldWar()!;
    const th = ww.depth.country(ITA)!.th;
    const notches = th.curMilli.map((m) => thoughtNotch(m));
    const yearPct = 100; // 1936
    const expected = thoughtStats(notches, yearPct);
    const got = thoughtStatsOf(ww.depth, ITA);
    expect(got).toEqual(expected);
    const b = await wwRestore(a, HUMANS, DEEP.map);
    expect(gameHash(b)).toBe(gameHash(a));
    step(a, 40);
    step(b, 40);
    expect(gameHash(b)).toBe(gameHash(a));
  }, 30_000);
});
