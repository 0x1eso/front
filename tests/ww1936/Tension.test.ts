// World War 1936 P3 (spec §14.1, Task 5): world tension and each
// country's generated share, on ww1936pol with the test content.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { tensionFor } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  addTension,
  dailyTension,
} from "@openfront/engine/ww1936/politics/Tension";
import { addWarGoal } from "@openfront/engine/ww1936/politics/WarGoals";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, pol, POL, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(politicsFixture()));
afterEach(() => usePoliticsContent(null));

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);

async function game() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }], POL);
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const id = (t: CountryTag) => byTag(g, t).smallID();
  return { runner, g, p: pol(g), ww: g.worldWar()!, id };
}

// Game tests: slow under the full suite's load.
describe("world tension (spec §14.1)", { timeout: 60_000 }, () => {
  it("tension decays 1 bp every 10 days", async () => {
    const { runner, p, id } = await game();
    const deu = id("DEU");
    p.wtBp = 1000;
    p.threatBp[deu] = 2;
    // Days 1..30: the 10th, 20th and 30th take one off; a share stops at 0.
    for (let d = 1; d <= 30; d++) dailyTension(p, d);
    expect(p.wtBp).toBe(997);
    expect(p.threatBp[deu]).toBe(0);
    expect(p.threatBp.every((v) => v >= 0)).toBe(true);
    // In the game: days 1..25 hold two tenth days.
    p.wtBp = 1000;
    stepTo(runner, dayStart(26));
    expect(p.wtBp).toBe(998);
  });

  it("acts add tension by the table and the actor's share", async () => {
    const { g, p, ww, id } = await game();
    const [deu, csk, fra, ltu] = [id("DEU"), id("CSK"), id("FRA"), id("LTU")];
    // The table (engine-lib), bp.
    const s = emptyStats();
    expect(tensionFor("justified", true, s)).toBe(400);
    expect(tensionFor("justified", false, s)).toBe(200);
    expect(tensionFor("declare_goal", true, s)).toBe(500);
    expect(tensionFor("declare_goal", false, s)).toBe(200);
    expect(tensionFor("declare_no_goal", true, s)).toBe(1400);
    expect(tensionFor("declare_no_goal", false, s)).toBe(800);
    expect(tensionFor("justified", true, s, "claim")).toBe(200);
    expect(tensionFor("capitulation", false, s)).toBe(200);
    expect(tensionFor("justified", true, { ...s, tensionPct: 50 })).toBe(600);
    // addTension: the world and the actor's share, clamped to 0..10,000.
    const wt = p.wtBp;
    addTension(p, deu, 300);
    expect(p.wtBp).toBe(wt + 300);
    expect(p.threatBp[deu]).toBe(300);
    addTension(p, deu, -500);
    expect(p.threatBp[deu]).toBe(0);
    addTension(p, 0, 20_000);
    expect(p.wtBp).toBe(10_000);
    p.wtBp = 400;
    // A declaration with a goal on a minor: +2%; without one: 2 × 2 + 4.
    addWarGoal(p, deu, csk, "conquer", "", ww.day(g.ticks()));
    declareWar(g, ww, byTag(g, "DEU"), byTag(g, "CSK"), g.ticks());
    expect(p.wtBp).toBe(600);
    expect(p.threatBp[deu]).toBe(200);
    declareWar(g, ww, byTag(g, "DEU"), byTag(g, "LTU"), g.ticks());
    expect(ww.isAtWar(deu, ltu)).toBe(true);
    expect(p.wtBp).toBe(1400);
    expect(p.threatBp[deu]).toBe(1000);
    // A major with a goal: +5%; joining a war adds nothing.
    addWarGoal(p, deu, fra, "conquer", "", ww.day(g.ticks()));
    declareWar(g, ww, byTag(g, "DEU"), byTag(g, "FRA"), g.ticks());
    expect(p.wtBp).toBe(1900);
    expect(p.threatBp[deu]).toBe(1500);
  });
});
