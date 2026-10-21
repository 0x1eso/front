// World War 1936 P5 (spec §2.2, Review Focus 1): the endgame's day.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

describe("World War 1936 P5: the endgame's clock", () => {
  it("every country runs its endgame day once", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    const eg = runner.game.worldWar()!.endgame;
    const runs = new Map<number, number[]>();
    let tick = -1;
    const original = eg.dailyCountry.bind(eg);
    const spy = vi
      .spyOn(eg, "dailyCountry")
      .mockImplementation((id, day, t) => {
        runs.set(id, [...(runs.get(id) ?? []), tick]);
        original(id, day, t);
      });
    const common = vi.spyOn(eg, "dailyCommon");
    for (const day of [0, 1, 2, 30]) {
      const from = dayStartTick(day, WW_PREP_TICKS);
      const to = dayStartTick(day + 1, WW_PREP_TICKS);
      stepTo(runner, from);
      runs.clear();
      common.mockClear();
      for (let t = from; t < to; t++) {
        tick = t - from;
        step(runner);
      }
      expect(common).toHaveBeenCalledTimes(1);
      for (let id = 1; id < END.players + 1; id++) {
        expect(runs.get(id), `${id}`).toEqual([id % WW_DAY_SPLIT]);
      }
    }
    // The dormant slots are no actors: their day does nothing.
    for (let id = END.scenarioCount + 1; id <= END.players; id++) {
      expect(eg.isActor(id)).toBe(false);
    }
    spy.mockRestore();
    common.mockRestore();
  });

  it("a country that stopped playing drops its day notes; a player's go out", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const eg = ww.endgame;
    const [pl, deu] = [endId("POL"), endId("DEU")];
    ww.addCapitulation(pl, deu, runner.game.ticks());
    expect(eg.isActor(pl)).toBe(false);
    eg.note(pl, 0, 1, 2, 3);
    eg.note(deu, 0, 1, 2, 3);
    const day = ww.day(runner.game.ticks());
    eg.dailyCountry(pl, day, runner.game.ticks());
    eg.dailyCountry(deu, day, runner.game.ticks());
    expect(eg.dayNotes).toEqual([]);
  });

  it("the conference clock runs in the preparation minute but the day does not", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    const eg = runner.game.worldWar()!.endgame;
    const tick = vi.spyOn(eg, "tick");
    const common = vi.spyOn(eg, "dailyCommon");
    const country = vi.spyOn(eg, "dailyCountry");
    step(runner, 50);
    expect(runner.game.worldWar()!.inPrep(runner.game.ticks())).toBe(true);
    // The clock execution starts the tick after its init.
    expect(tick.mock.calls.length).toBeGreaterThanOrEqual(48);
    expect(common).not.toHaveBeenCalled();
    expect(country).not.toHaveBeenCalled();
    stepTo(runner, WW_PREP_TICKS + 1);
    expect(common).toHaveBeenCalledTimes(1);
    tick.mockRestore();
    common.mockRestore();
    country.mockRestore();
  });
});
