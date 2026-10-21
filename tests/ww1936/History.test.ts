// P0's historical calendar (spec §7.4). P3 (plan decision 15) moved it to
// politics' history beats (content/history.ts, the first 48 safety beats):
// the roll is stateless now (Roll.test.ts "beats keep P0's skip and delay
// distribution"), the declare / join behaviour is the same.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { HISTORY_BEATS } from "@openfront/engine-lib/ww1936/content/history";
import {
  HISTORY,
  HISTORY_MAX_DELAY_DAYS,
} from "@openfront/engine-lib/ww1936/History";
import { addGuarantee } from "@openfront/engine/ww1936/politics/Treaties";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { byTag, HUMAN, pol, step, stepTo, wwRunner } from "./util";

const beatOf = (actor: string, target: string) =>
  HISTORY_BEATS.findIndex(
    (b) =>
      b.actor === actor &&
      (b.act.kind === "declare" || b.act.kind === "join") &&
      b.act.target === target,
  );
const DEU_POL = beatOf("DEU", "POL");
const GBR_DEU = beatOf("GBR", "DEU");

/** Only the given beats, at the given days; the rest skipped. */
function only(p: WwPolitics, entries: Record<number, number>): void {
  p.beats = p.content.beats.map((_, i) => ({
    fireDay: entries[i] ?? 0,
    skipped: entries[i] === undefined,
    done: false,
  }));
}

describe("the historical calendar (spec §7.4; P3 history beats)", () => {
  test("the table is sorted by date and names two different countries", () => {
    for (let i = 1; i < HISTORY.length; i++) {
      expect(dayOfDate(HISTORY[i].date)).toBeGreaterThanOrEqual(
        dayOfDate(HISTORY[i - 1].date),
      );
    }
    for (const e of HISTORY) expect(e.actor).not.toBe(e.target);
  });

  test("each beat is skipped or happens 0..20 days late, the same way every time", async () => {
    const a = await wwRunner();
    const b = await wwRunner();
    step(a);
    step(b);
    const plan = pol(a.game).beats;
    expect(plan).toHaveLength(HISTORY_BEATS.length);
    expect(pol(b.game).beats).toEqual(plan);
    let skipped = 0;
    plan.forEach((s, i) => {
      if (s.skipped) skipped++;
      const day = dayOfDate(HISTORY_BEATS[i].date);
      expect(s.fireDay).toBeGreaterThanOrEqual(day);
      expect(s.fireDay).toBeLessThanOrEqual(day + HISTORY_MAX_DELAY_DAYS);
    });
    expect(skipped).toBeLessThan(HISTORY_BEATS.length / 3);
  });

  test("historical AI off: every beat is skipped", async () => {
    const runner = await wwRunner({ historicalAi: false });
    step(runner);
    expect(pol(runner.game).beats.every((b) => b.skipped)).toBe(true);
  });

  test("a due beat fires for a nation: a declaration, then a join", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    step(runner);
    only(pol(g), { [DEU_POL]: 2, [GBR_DEU]: 3 });
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS) + 1);
    const [deu, pl, gbr, ita] = ["DEU", "POL", "GBR", "ITA"].map((t) =>
      byTag(g, t as "DEU"),
    );
    expect(ww.isAtWar(deu.smallID(), pl.smallID())).toBe(true);
    expect(ww.isAtWar(gbr.smallID(), deu.smallID())).toBe(false);
    // P3 lane A (owner direction): a beat is a suggestion the AI judges; a
    // join it owes — Britain guarantees Poland, as in 1939 — goes ahead
    // whatever the odds.
    addGuarantee(pol(g), gbr.smallID(), pl.smallID(), 0);
    stepTo(runner, dayStartTick(3, WW_PREP_TICKS) + 1);
    expect(ww.isAtWar(gbr.smallID(), deu.smallID())).toBe(true);
    expect(ww.isAtWar(gbr.smallID(), ita.smallID())).toBe(false);
    expect(pol(g).beats[DEU_POL].done).toBe(true);
  });

  test("a human country is never moved by the calendar", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
    const g = runner.game;
    const ww = g.worldWar()!;
    step(runner);
    only(pol(g), { [DEU_POL]: 1 });
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS));
    expect(
      ww.isAtWar(byTag(g, "DEU").smallID(), byTag(g, "POL").smallID()),
    ).toBe(false);
    expect(pol(g).beats[DEU_POL].done).toBe(true);
  });

  test("a beat with a country the scenario lacks passes quietly", async () => {
    const runner = await wwRunner();
    const ww = runner.game.worldWar()!;
    step(runner);
    only(pol(runner.game), { 0: 1 }); // ESN → ESR: neither is on the test map
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS));
    expect(pol(runner.game).beats[0].done).toBe(true);
    expect(ww.data().wars).toEqual([]);
  });
});
