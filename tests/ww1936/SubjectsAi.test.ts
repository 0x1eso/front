// World War 1936 P5 lane S (plan Task 4 Step 6/7): the subjects' and
// overlords' AI — upgrade request, independence war, demand, tighten, annex.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { aiSubjectsDay } from "@openfront/engine/ww1936/endgame/AiSubjects";
import {
  endIndependenceWar,
  FLAG_CONTROL_TIGHTENED,
  FLAG_INDEPENDENCE_DENIED,
  makeSubject,
  stepSubject,
  subjectLine,
} from "@openfront/engine/ww1936/endgame/Subjects";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { decisionBlock } from "@openfront/engine/ww1936/politics/Decisions";
import { applyOption } from "@openfront/engine/ww1936/politics/Events";
import { endId } from "./endFixture";
import { subjectFixture } from "./subjectFixture";
import { END_MAP, stepTo, wwRunner } from "./util";

// The test map's countries all hold 17+ points; the annex rule needs a big overlord.
let bigVp: number[] | null = null;
vi.mock("@openfront/engine/ww1936/Capitulation", async (orig) => {
  const m =
    await orig<typeof import("@openfront/engine/ww1936/Capitulation")>();
  return {
    ...m,
    controlledVp: (...a: Parameters<typeof m.controlledVp>) =>
      bigVp ?? m.controlledVp(...a),
  };
});

afterEach(() => {
  bigVp = null;
  usePoliticsContent(null);
  vi.restoreAllMocks();
});

async function started(historicalAi = false) {
  usePoliticsContent(subjectFixture());
  const runner = await wwRunner({ historicalAi }, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  return { runner, g: runner.game, ww: runner.game.worldWar()! };
}

const day = (ww: { day(t: number): number }, g: { ticks(): number }) =>
  ww.day(g.ticks());

describe("World War 1936 P5: subjects AI", () => {
  it("autonomy at 100% fires the upgrade request", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const pol = ww.politics;
    const [deu, ltu] = [endId("DEU"), endId("LTU")];
    makeSubject(eg, ltu, deu, "puppet", false, g.ticks());
    subjectLine(eg, ltu)!.autBp = 10_000;
    // Hold the event so the overlord's answer is chosen here.
    const flush = vi.spyOn(pol, "flushEvents").mockImplementation(() => {});
    aiSubjectsDay(eg, ltu, day(ww, g), g.ticks());
    expect(pol.queuedEvents()).toBe(1);
    flush.mockRestore();
    // The overlord grants it: one level up, autonomy 20%.
    applyOption(pol, "gen_subject_upgrade", deu, ltu, 0, "a", g.ticks(), 0);
    expect(eg.subjectOf(ltu)!.level).toBe("colony");
    expect(subjectLine(eg, ltu)!.autBp).toBe(2000);
  });

  it("a refused request leads to an independence war that sends a lost subject back to integrated", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const pol = ww.politics;
    // The strong subject of a weak overlord.
    const [ltu, pl] = [endId("LTU"), endId("POL")];
    makeSubject(eg, pl, ltu, "colony", false, g.ticks());
    // The subject asks, the overlord refuses.
    applyOption(pol, "gen_subject_upgrade", ltu, pl, 0, "b", g.ticks(), 0);
    expect(pol.country(pl)!.hasFlag(FLAG_INDEPENDENCE_DENIED, pol.day())).toBe(
      true,
    );
    stepSubject(eg, pl, day(ww, g));
    expect(pol.hasWarGoal(pl, ltu)).toBe(true);
    // Strong enough and the overlord at peace: the independence war.
    vi.spyOn(ww, "hasWar").mockReturnValue(false);
    aiSubjectsDay(eg, pl, day(ww, g), g.ticks());
    vi.restoreAllMocks();
    const s = subjectLine(eg, pl)!;
    expect(s.suspended).toBe(true);
    expect(ww.isAtWar(pl, ltu)).toBe(true);
    expect(eg.war(eg.warOfPair(pl, ltu))?.kind).toBe("independence");
    // The subject loses.
    endIndependenceWar(eg, eg.warOfPair(pl, ltu), 1, g.ticks());
    expect(eg.subjectOf(pl)!.level).toBe("integrated");
    expect(subjectLine(eg, pl)!.autBp).toBe(0);
    expect(subjectLine(eg, pl)!.suspended).toBe(false);
    expect(ww.isAtWar(pl, ltu)).toBe(false);
  });

  it("an integrated puppet at 0% can be annexed", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const pol = ww.politics;
    const [deu, ltu] = [endId("DEU"), endId("LTU")];
    makeSubject(eg, ltu, deu, "integrated", false, g.ticks());
    subjectLine(eg, ltu)!.autBp = 0;
    pol.country(deu)!.ppMilli = 500_000;
    expect(decisionBlock(pol, deu, "gen_annex_subject", ltu)).toBeNull();
    bigVp = new Array<number>(eg.size).fill(1);
    bigVp[deu] = 100;
    aiSubjectsDay(eg, deu, day(ww, g), g.ticks());
    expect(
      pol.country(deu)!.missions.some((m) => m.id === "gen_annex_subject"),
    ).toBe(true);
  });

  it("an overlord tightens its grip on a restless subject, not on a dominion", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const pol = ww.politics;
    const [deu, ltu] = [endId("DEU"), endId("LTU")];
    pol.country(deu)!.ppMilli = 500_000;
    makeSubject(eg, ltu, deu, "dominion", false, g.ticks());
    subjectLine(eg, ltu)!.autBp = 9000;
    aiSubjectsDay(eg, deu, day(ww, g), g.ticks());
    expect(pol.country(ltu)!.flags.has(FLAG_CONTROL_TIGHTENED)).toBe(false);
    makeSubject(eg, ltu, deu, "puppet", false, g.ticks());
    subjectLine(eg, ltu)!.autBp = 9000;
    aiSubjectsDay(eg, deu, day(ww, g), g.ticks());
    expect(pol.country(ltu)!.flags.has(FLAG_CONTROL_TIGHTENED)).toBe(true);
  });

  it("a subject of another ideology with PP to spare demands autonomy", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const pol = ww.politics;
    const [deu, ltu] = [endId("DEU"), endId("LTU")];
    makeSubject(eg, ltu, deu, "puppet", false, g.ticks());
    const c = pol.country(ltu)!;
    c.ruling = (pol.country(deu)!.ruling + 1) % 4;
    c.ppMilli = 500_000;
    const before = subjectLine(eg, ltu)!.autBp;
    aiSubjectsDay(eg, ltu, day(ww, g), g.ticks());
    expect(subjectLine(eg, ltu)!.autBp).toBeGreaterThan(before);
    expect(c.ppMilli).toBeLessThan(500_000);
  });
});

describe("World War 1936 P5: subjects AI, historical", () => {
  it("a historical overlord leaves tightening to the beats", async () => {
    const { g, ww } = await started(true);
    const eg = ww.endgame;
    const pol = ww.politics;
    const [deu, ltu] = [endId("DEU"), endId("LTU")];
    pol.country(deu)!.ppMilli = 500_000;
    makeSubject(eg, ltu, deu, "puppet", false, g.ticks());
    subjectLine(eg, ltu)!.autBp = 9000;
    aiSubjectsDay(eg, deu, day(ww, g), g.ticks());
    expect(pol.country(ltu)!.flags.has(FLAG_CONTROL_TIGHTENED)).toBe(false);
  });
});
