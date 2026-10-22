// World War 1936 P6 (spec §2.2, plan decision 3): the depth systems' day.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { step, stepTo, wwRunner, wwRunnerCapture } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

describe("World War 1936 P6: the depth clock", () => {
  it("every country runs its depth day once", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const runs = new Map<number, number[]>();
    let tick = -1;
    const original = d.countryTurn.bind(d);
    const spy = vi.spyOn(d, "countryTurn").mockImplementation((id, day, t) => {
      runs.set(id, [...(runs.get(id) ?? []), tick]);
      original(id, day, t);
    });
    const common = vi.spyOn(d, "dayCommon");
    for (const day of [0, 1, 2]) {
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
      expect(d.lastCommonDay).toBe(day);
      for (let id = 1; id < d.cap; id++) {
        expect(runs.get(id), `${id}`).toEqual(
          ww.isActor(id) ? [id % WW_DAY_SPLIT] : undefined,
        );
      }
      // No battle: the stub doctrine day empties each tally it reads.
      expect(d.dayTally.every((v) => v === 0)).toBe(true);
    }
    spy.mockRestore();
    common.mockRestore();
  });

  it("nothing depth-related happens during the preparation minute", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const d = runner.game.worldWar()!.depth;
    const common = vi.spyOn(d, "dayCommon");
    const country = vi.spyOn(d, "countryTurn");
    step(runner, 50);
    expect(runner.game.worldWar()!.inPrep(runner.game.ticks())).toBe(true);
    expect(d.lastCommonDay).toBe(-1);
    expect(common).not.toHaveBeenCalled();
    expect(country).not.toHaveBeenCalled();
    // Orders are taken: lane I's agency is founded in the minute too (spec §8.2).
    expect(
      d.issue(DEEP.tag.DEU, { kind: "intel_found" }, runner.game.ticks()),
    ).toBeNull();
    expect(d.country(DEEP.tag.DEU)!.intel.agency).toBe(true);
    common.mockRestore();
    country.mockRestore();
  });

  it("the depth update arrives on the first tick with every country", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [], DEEP.map);
    step(runner, 2);
    const first = updates.find(
      (u) => (u.updates[GameUpdateType.WwDepth] ?? []).length > 0,
    )!;
    const data = first.updates[GameUpdateType.WwDepth][0].data;
    const d = runner.game.worldWar()!.depth;
    const ids = (data.countries ?? []).map((c) => c.smallID);
    const expected: number[] = [];
    for (let id = 1; id < d.cap; id++) {
      if (d.country(id) !== null) expected.push(id);
    }
    expect(ids).toEqual(expected);
    expect(data.world?.damLevel).toEqual(d.world.damLevel);
  });
});
