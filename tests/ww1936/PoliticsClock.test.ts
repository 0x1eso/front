// World War 1936 P3 (spec §2.2, §22; plan decisions 2, 4, 13): politics'
// place in the tick, on the test map ww1936pol with the test content.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { diffGraphs } from "../util/Snapshot";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  gameHash,
  HUMAN,
  pol,
  POL,
  step,
  stepTo,
  wwRestore,
  wwRunner,
  wwRunnerCapture,
} from "./util";

const DEU_HUMAN = [{ clientID: HUMAN, country: "DEU" as const }];
const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);

beforeEach(() => usePoliticsContent(politicsFixture()));
afterEach(() => usePoliticsContent(null));

describe("politics on the clock", () => {
  it("politics daily step runs once per country per day", async () => {
    const runner = await wwRunner({}, DEU_HUMAN, POL);
    const g = runner.game;
    const id = byTag(g, "DEU").smallID();
    const c = pol(g).country(id)!;
    for (const d of [3, 4]) {
      stepTo(runner, dayStart(d));
      const before = c.ppMilli;
      stepTo(runner, dayStart(d + 1));
      expect(c.ppMilli - before).toBe(pol(g).dailyGainMilli(id));
    }
  });

  it("each country's stats are summed again once a day, on its own tick", async () => {
    const runner = await wwRunner({}, DEU_HUMAN, POL);
    const g = runner.game;
    let first = 2;
    for (const tag of ["DEU", "CSK", "EST"] as const) {
      const id = byTag(g, tag).smallID();
      const c = pol(g).country(id)!;
      const days = [first, first + 1];
      first += 2;
      for (const [i, d] of days.entries()) {
        stepTo(runner, dayStart(d));
        // Full stability: +15% PP gain once the stats are summed again
        // (spec §6.2), then back to 50% (+1% ruling party: 0) the next day.
        // Stability is the base and its lines (spec §6.1), from the step.
        const want = i === 0 ? 15 : 0;
        c.stabBaseBp = i === 0 ? 10_000 : 5000;
        // Day d's ticks before the country's own: not yet.
        stepTo(runner, dayStart(d) + (id % WW_DAY_SPLIT));
        expect(c.stats.ppGainPct, `${tag} day ${d}`).toBe(15 - want);
        step(runner);
        expect(c.stats.ppGainPct, `${tag} day ${d}`).toBe(want);
      }
      stepTo(runner, dayStart(first));
      expect(c.stats.ppGainPct).toBe(0);
    }
  });

  it("nothing political happens during the preparation minute", async () => {
    const runner = await wwRunner({}, DEU_HUMAN, POL);
    const g = runner.game;
    step(runner);
    const p = pol(g);
    const c = p.country(byTag(g, "DEU").smallID())!;
    const pp = c.ppMilli;
    // No daily step: a changed base does not reach the stats.
    c.stabBaseBp = 10_000;
    stepTo(runner, WW_PREP_TICKS - 1);
    expect(c.stats.ppGainPct).toBe(0);
    expect(c.ppMilli).toBe(pp);
    expect(p.beats.every((b) => !b.done)).toBe(true);
    expect(p.delayed).toEqual([]);
    expect(p.wtBp).toBe(400);
    // The first day runs at the minute's end.
    stepTo(runner, WW_PREP_TICKS + WW_DAY_SPLIT);
    expect(c.stats.ppGainPct).toBe(15);
  });

  it("the event queue is empty at the end of every tick", async () => {
    const runner = await wwRunner({}, [], POL);
    for (let i = 0; i < 400; i++) {
      step(runner);
      expect(pol(runner.game).queuedEvents()).toBe(0);
    }
  });

  it("the politics update arrives on the first tick with every country", async () => {
    const { runner, updates } = await wwRunnerCapture({}, DEU_HUMAN, POL);
    step(runner, 2);
    // The clock's first tick (the execution starts the tick after its init).
    const at = updates.findIndex(
      (u) => (u.updates[GameUpdateType.WwPolitics] ?? []).length > 0,
    );
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThanOrEqual(1);
    const first = updates[at].updates[GameUpdateType.WwPolitics];
    expect(first).toHaveLength(1);
    const d = first[0].data;
    expect(d.countries.map((c) => c.smallID)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
    // The human's details only.
    expect(d.details.map((x) => x.smallID)).toEqual([
      byTag(runner.game, "DEU").smallID(),
    ]);
    expect(d.global).not.toBeNull();
    expect(d.global!.wtBp).toBe(400);
    // Spec §15.1: the starting factions as state; spec §16.2: the 1936 pacts.
    expect(d.global!.factions.map((f) => f.key)).toEqual([
      "axis",
      "allies",
      "comintern",
    ]);
    expect(d.global!.naps.length).toBeGreaterThan(0);
    const summary = d.countries.find(
      (c) => c.smallID === byTag(runner.game, "DEU").smallID(),
    )!;
    expect(summary).toMatchObject({
      ruling: 3,
      stabBp: 5000,
      wsBp: 5000,
      ppMilli: 50_000,
    });
    // Quiet ticks send nothing.
    step(runner);
    step(runner, 3);
    expect(
      updates[updates.length - 1].updates[GameUpdateType.WwPolitics] ?? [],
    ).toEqual([]);
  });

  it("a restored game continues with the same hash", async () => {
    const a = await wwRunner({}, DEU_HUMAN, POL);
    stepTo(a, 600);
    // The same content in the restored game (the content source is global).
    const b = await wwRestore(a, DEU_HUMAN, POL);
    expect(diffGraphs(a.game, b.game)).toEqual([]);
    for (let i = 0; i < 300; i++) {
      step(a);
      step(b);
      expect(gameHash(b), `tick ${a.game.ticks()}`).toBe(gameHash(a));
      expect(pol(b.game).hash()).toBe(pol(a.game).hash());
    }
    expect(diffGraphs(a.game, b.game)).toEqual([]);
  }, 120_000);
});
