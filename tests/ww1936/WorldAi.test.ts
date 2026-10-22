// World War 1936 P6 lane W1 (plan Task 7 Step 8; spec §16.2, §16.4,
// §16.7, §19.7): the AI's world devices on the deep test map. One country
// is the AI under test; the rest is set up by hand.
import { DAMS, SCORCH_DAYS } from "@openfront/engine-api/ww1936/DepthTypes";
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  AI_SCORCH_FROM,
  aiWorldDay,
  DNIPRO_FLAG,
} from "@openfront/engine/ww1936/depth/AiWorld";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  clearLand,
  HUMAN,
  step,
  stepTo,
  takeRegion,
  warAfterPrep,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

/** Runs whole days (to the first tick of the day `n` days on), then one tick. */
function days(runner: GameRunner, n: number): void {
  const ww = runner.game.worldWar()!;
  const until = ww.day(runner.game.ticks()) + n;
  while (ww.day(runner.game.ticks()) < until) step(runner);
  step(runner);
}

/** A day of the given year whose (day + id) % 10 is `rest` (the AI parts' rhythms). */
function dayOf(iso: string, id: number, rest: number): number {
  let day = dayOfDate(iso);
  while ((day + id) % 10 !== rest) day++;
  return day;
}

describe("World War 1936 P6: the AI's world devices", () => {
  it("the Soviet AI scorches a threatened factory region after moving its buildings", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "POL" }],
      DEEP.map,
    );
    warAfterPrep(runner, HUMAN, "SUN");
    const g = runner.game;
    const ww = g.worldWar()!;
    const d = ww.depth;
    const econ = ww.economy;
    const sun = DEEP.tag.SUN;
    const { warsaw, moscow, kiev } = DEEP.region;
    clearLand(g);
    // Moscow (the capital) is out of the enemy's reach: Warsaw is Soviet.
    // Kiev borders Polish Krakow.
    takeRegion(g, warsaw, "SUN");
    days(runner, 1);
    expect(econ.country(sun)!.totals.warDays).toBeGreaterThanOrEqual(0);
    // Not before 1941 (the AI ran today on the game's 1936 date).
    expect(d.world.scorchQueue).toEqual([]);
    ww.politics.country(sun)!.ppMilli = 100_000;
    // Room in Moscow: its slots are full with what the AI queued there.
    econ.country(sun)!.queue = [];
    const kievMil = econ.mil[kiev];
    const kievCiv = econ.civ[kiev];
    const moscowMil = econ.mil[moscow];
    const moscowCiv = econ.civ[moscow];
    expect(kievMil + kievCiv).toBeGreaterThanOrEqual(2);
    aiWorldDay(d, sun, dayOf(AI_SCORCH_FROM, sun, 5));
    // Moved inland first (P3's move_buildings), as far as Moscow has room.
    const moved = kievMil + kievCiv - econ.mil[kiev] - econ.civ[kiev];
    expect(moved).toBeGreaterThan(0);
    expect(econ.mil[moscow] + econ.civ[moscow] - moscowMil - moscowCiv).toBe(
      moved,
    );
    const today = ww.day(g.ticks());
    expect(d.world.scorchQueue).toEqual([[kiev, sun, today + SCORCH_DAYS]]);
    // One region a day; never the capital.
    aiWorldDay(d, sun, dayOf(AI_SCORCH_FROM, sun, 5));
    expect(d.world.scorchQueue.length).toBe(1);
    // Three days on, what is left burns, the Dnipro dam with it.
    const left = econ.civ[kiev];
    days(runner, SCORCH_DAYS);
    expect(d.world.scorchQueue).toEqual([]);
    expect(econ.civ[kiev]).toBe(left - Math.floor(left / 2));
    expect(d.world.damLevel[DEEP.dam.dam_dnipro.index]).toBe(0);
    expect(d.world.floodUntil.map((x) => x[0])).toEqual(
      [kiev, ...DEEP.dam.dam_dnipro.downstream].sort((a, b) => a - b),
    );
  }, 60_000);

  it("the Dnipro dam beat waits for Germany next to the dam", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      DEEP.map,
    );
    warAfterPrep(runner, HUMAN, "SUN");
    const g = runner.game;
    const ww = g.worldWar()!;
    const d = ww.depth;
    const sun = DEEP.tag.SUN;
    const kiev = DEEP.region.kiev;
    clearLand(g);
    days(runner, 1);
    const c = ww.politics.country(sun)!;
    c.ppMilli = 100_000;
    c.flags.set(DNIPRO_FLAG, [ww.day(g.ticks()), -1]);
    // Germany is far away: the beat waits.
    days(runner, 1);
    expect(d.world.scorchQueue).toEqual([]);
    expect(c.flags.has(DNIPRO_FLAG)).toBe(true);
    // Germany next to Zaporizhzhia (Kiev on the test map): the Soviet Union blows it.
    takeRegion(g, DEEP.region.krakow, "DEU");
    days(runner, 1);
    expect(d.world.scorchQueue.map((x) => x[0])).toEqual([kiev]);
    expect(c.flags.has(DNIPRO_FLAG)).toBe(false);
    days(runner, SCORCH_DAYS);
    expect(d.world.damLevel[DEEP.dam.dam_dnipro.index]).toBe(0);
    expect(
      ww.politics.gflags.has(`${DAMS[DEEP.dam.dam_dnipro.index]}_destroyed`),
    ).toBe(true);
  }, 60_000);

  it("an AI short of energy buys coal or builds a power plant", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 20);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const econ = ww.economy;
    const ita = DEEP.tag.ITA;
    expect(d.country(ita)!.mech.energyPm).toBeLessThan(900);
    const ce = econ.country(ita)!;
    // Rome's slots are full: one civilian factory less makes room (and
    // leaves the energy short).
    econ.addBuilding(DEEP.region.rome, "civ", -1);
    ce.queue = [];
    const coal = RESOURCE_IDS.indexOf("coal");
    const deals = () =>
      econ.trades().filter((t) => t.buyer === ita && t.res === coal).length;
    const before = deals();
    // Not on another day of its ten.
    aiWorldDay(d, ita, dayOf("1936-02-01", ita, 3));
    expect(deals()).toBe(before);
    expect(ce.queue.some((q) => q.building === "power_plant")).toBe(false);
    aiWorldDay(d, ita, dayOf("1936-02-01", ita, 1));
    expect(
      deals() > before || ce.queue.some((q) => q.building === "power_plant"),
    ).toBe(true);
  }, 60_000);
});
