// World War 1936 P3 (spec §14.2–§14.4, Task 5): justification and war
// goals, on ww1936pol with the test content (every government neutral at
// 50% unless a test sets it).
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { addNap, breakNap } from "@openfront/engine/ww1936/politics/Treaties";
import {
  addWarGoal,
  justificationBlocked,
} from "@openfront/engine/ww1936/politics/WarGoals";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  pol,
  POL,
  stepTo,
  WwHuman,
  wwRunnerCapture,
} from "./util";

beforeEach(() => usePoliticsContent(politicsFixture()));
afterEach(() => usePoliticsContent(null));

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);

/** Humans in order (HUMAN001, HUMAN002…), stepped past the preparation minute into day 0. */
async function game(tags: CountryTag[]) {
  const humans: WwHuman[] = tags.map((country, i) => ({
    clientID: i === 0 ? HUMAN : `HUMAN00${i + 1}`,
    country,
  }));
  const { runner, updates } = await wwRunnerCapture({}, humans, POL);
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const id = (t: CountryTag) => byTag(g, t).smallID();
  const messages = (key: string, to: number) =>
    updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter(
        (m) => m.message === `events_display.${key}` && m.playerID === to,
      );
  return { runner, g, p: pol(g), ww: g.worldWar()!, id, messages };
}

/** Every step of day `d` has run (the next common step has not). */
const endOfDay = (runner: Parameters<typeof stepTo>[0], d: number) =>
  stepTo(runner, dayStart(d + 1));

const justify = (target: number) => ({
  kind: "justify" as const,
  target,
  goal: "conquer" as const,
  group: "",
});

// Game tests: slow under the full suite's load.
describe(
  "war goals and justification (spec §14.2, §14.3)",
  { timeout: 60_000 },
  () => {
    it("justification takes 100 days and grants a war goal", async () => {
      const { runner, g, p, id, messages } = await game(["DEU", "CSK"]);
      const [deu, csk] = [id("DEU"), id("CSK")];
      // A neutral government justifies from 25% tension.
      p.wtBp = 3000;
      const c = p.country(deu)!;
      const pp = c.ppMilli;
      const d0 = p.ww.day(g.ticks());
      expect(p.issue(deu, justify(csk), g.ticks())).toBeNull();
      expect(c.ppMilli).toBe(pp - 50_000);
      expect(c.justification).toEqual({
        on: csk,
        type: "conquer",
        group: "",
        progressDays: 0,
        totalDays: 100,
      });
      // One at a time; the target hears of it at the start.
      expect(p.issue(deu, justify(id("LTU")), g.ticks())).toBe("justify_busy");
      endOfDay(runner, d0);
      const started = { countryTag: "DEU", targetTag: "CSK" };
      expect(messages("ww1936_justify_started", csk)[0].params).toEqual(
        started,
      );
      expect(messages("ww1936_justify_started", deu)[0].params).toEqual(
        started,
      );
      expect(messages("ww1936_justified_against", csk)).toHaveLength(0);
      endOfDay(runner, d0 + 99);
      expect(c.justification!.progressDays).toBe(99);
      expect(p.hasWarGoal(deu, csk)).toBe(false);
      endOfDay(runner, d0 + 100);
      expect(c.justification).toBeNull();
      expect(c.warGoals).toEqual([
        { on: csk, type: "conquer", group: "", untilDay: d0 + 100 + 365 },
      ]);
      // +2% (a minor) to the world and to Germany's share; ten decays since.
      expect(p.threatBp[deu]).toBe(200);
      expect(p.wtBp).toBe(3000 - 10 + 200);
      expect(messages("ww1936_justified_against", csk)).toHaveLength(1);
      expect(messages("ww1936_justified_against", csk)[0].params).toEqual({
        countryTag: "DEU",
      });
      // A goal held: no second justification on the same target.
      expect(p.issue(deu, justify(csk), g.ticks())).toBe("treaty_exists");
    });

    it("a democracy needs tension to justify", async () => {
      const { g, p, id } = await game(["GBR"]);
      const [gbr, csk] = [id("GBR"), id("CSK")];
      const c = p.country(gbr)!;
      c.ruling = IDEO_DEM;
      p.recomputeStats(gbr);
      c.ppMilli = 500_000;
      p.wtBp = 4000;
      expect(p.issue(gbr, justify(csk), g.ticks())).toBe("tension_gate");
      // 50% and a target that made 5% of it.
      p.wtBp = 5000;
      expect(p.issue(gbr, justify(csk), g.ticks())).toBe("tension_gate");
      p.threatBp[csk] = 500;
      expect(p.issue(gbr, justify(csk), g.ticks())).toBeNull();
      p.issue(gbr, { kind: "justify_cancel" }, g.ticks());
      // 80%: anyone. A democracy pays 50% more (75 PP on a minor).
      p.threatBp[csk] = 0;
      p.wtBp = 8000;
      const pp = c.ppMilli;
      expect(p.issue(gbr, justify(csk), g.ticks())).toBeNull();
      expect(c.ppMilli).toBe(pp - 75_000);
    });

    it("a justification pauses when a pact appears and resumes", async () => {
      const { runner, g, p, id } = await game(["DEU"]);
      const [deu, csk] = [id("DEU"), id("CSK")];
      p.wtBp = 3000;
      const d0 = p.ww.day(g.ticks());
      expect(p.issue(deu, justify(csk), g.ticks())).toBeNull();
      const c = p.country(deu)!;
      endOfDay(runner, d0 + 10);
      expect(c.justification!.progressDays).toBe(10);
      expect(justificationBlocked(p, deu)).toBe(false);
      addNap(p, deu, csk, d0 + 10);
      expect(justificationBlocked(p, deu)).toBe(true);
      endOfDay(runner, d0 + 15);
      // Paused, not lost.
      expect(c.justification!.progressDays).toBe(10);
      breakNap(p, deu, csk);
      endOfDay(runner, d0 + 18);
      expect(c.justification!.progressDays).toBe(13);
    });

    it("goals expire after a year", async () => {
      const { runner, g, p, id, messages } = await game(["DEU"]);
      const [deu, csk] = [id("DEU"), id("CSK")];
      const d0 = p.ww.day(g.ticks());
      addWarGoal(p, deu, csk, "claim", "sudetenland", d0);
      const goal = p.country(deu)!.warGoals[0];
      expect(goal).toEqual({
        on: csk,
        type: "claim",
        group: "sudetenland",
        untilDay: d0 + 365,
      });
      // The same rule a year on, five days from now.
      goal.untilDay = d0 + 5;
      endOfDay(runner, d0 + 4);
      expect(p.hasWarGoal(deu, csk)).toBe(true);
      endOfDay(runner, d0 + 5);
      expect(p.hasWarGoal(deu, csk)).toBe(false);
      expect(messages("ww1936_war_goal_expired", deu)).toHaveLength(1);
    });
  },
);
