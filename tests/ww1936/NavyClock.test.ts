// World War 1936 P4 (plan Task 1 Step 25, Review Focus 1): the navy and air
// clock — every sea region and air zone once a day on its share of the
// day's ticks, nothing in the preparation minute, the updates after P3's.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { SEA } from "./seaFixture";
import {
  HUMAN,
  step,
  stepTo,
  withTestPolitics,
  wwRunner,
  wwRunnerCapture,
} from "./util";

withTestPolitics();

const HUMANS = [{ clientID: HUMAN, country: "GBR" as const }];

describe("navy and air clock (spec §2.2)", () => {
  it("every sea region and air zone runs its day once", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    const list = ww.scenario.strategicList();
    stepTo(runner, WW_PREP_TICKS);
    const sea = list.filter((s) => s.kind === "sea");
    const seaDays = new Map<number, number[]>();
    const airDays = new Map<number, number[]>();
    let lastSea = sea.map((s) => ww.navy.srState[s.idx].lastDay);
    let lastAir = list.map((s) => ww.air.zoneState[s.idx].lastDay);
    const end = dayStartTick(30, ww.prepEndTick());
    while (runner.game.ticks() < end) {
      const tick = runner.game.ticks();
      step(runner);
      const day = ww.day(tick);
      const k = tick - dayStartTick(day, ww.prepEndTick());
      sea.forEach((s, i) => {
        const now = ww.navy.srState[s.idx].lastDay;
        if (now !== lastSea[i]) {
          expect(now).toBe(day);
          expect(k).toBe(s.idx % WW_DAY_SPLIT);
          (seaDays.get(s.idx) ?? seaDays.set(s.idx, []).get(s.idx)!).push(day);
        }
      });
      list.forEach((s, i) => {
        const now = ww.air.zoneState[s.idx].lastDay;
        if (now !== lastAir[i]) {
          expect(now).toBe(day);
          expect(k).toBe(s.idx % WW_DAY_SPLIT);
          (airDays.get(s.idx) ?? airDays.set(s.idx, []).get(s.idx)!).push(day);
        }
      });
      lastSea = sea.map((s) => ww.navy.srState[s.idx].lastDay);
      lastAir = list.map((s) => ww.air.zoneState[s.idx].lastDay);
    }
    const days = Array.from({ length: 30 }, (_, d) => d);
    for (const s of sea) expect(seaDays.get(s.idx)).toEqual(days);
    for (const s of list) expect(airDays.get(s.idx)).toEqual(days);
  }, 120_000);

  it("nothing spots, fights or flies during the preparation minute", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    stepTo(runner, WW_PREP_TICKS - 1);
    for (const s of ww.navy.srState) {
      expect(s.lastDay).toBe(-1);
      expect(s.sup.size + s.spot.size).toBe(0);
    }
    for (const z of ww.air.zoneState) expect(z.lastDay).toBe(-1);
    expect(ww.navy.battles.size).toBe(0);
  }, 60_000);

  it("the P4 updates come after P3's", async () => {
    const { runner, updates } = await wwRunnerCapture({}, HUMANS, SEA.map);
    step(runner, 2);
    expect(GameUpdateType.WwNavy).toBe(GameUpdateType.WwPolitics + 1);
    expect(GameUpdateType.WwAir).toBe(GameUpdateType.WwPolitics + 2);
    // The first tick the clock runs sends all of them.
    const at = updates.findIndex(
      (u) => (u.updates[GameUpdateType.WwNavy] ?? []).length > 0,
    );
    expect(at).toBeGreaterThanOrEqual(0);
    const first = updates[at].updates;
    expect(first[GameUpdateType.WwPolitics]?.length).toBe(1);
    expect(first[GameUpdateType.WwNavy]?.length).toBe(1);
    expect(first[GameUpdateType.WwAir]?.length).toBe(1);
    // The first tick sends every sea region and my country's detail.
    const navy = first[GameUpdateType.WwNavy]![0].data;
    expect(navy.seaRegions.map((s) => s.sr)).toEqual([1001, 1002, 1003]);
    expect(navy.details.map((d) => d.smallID)).toEqual([3]);
  }, 60_000);
});
