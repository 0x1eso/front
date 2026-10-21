// World War 1936 P5 lane X (plan Task 5 Step 5, spec §5.3): land a
// country at peace with its legal owner holds goes back to that owner at
// the next day's common step — not an occupation zone, not to the dead.
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { clearLand, END_MAP, step, stepTo, takeRegion, wwRunner } from "./util";

afterEach(() => usePoliticsContent(null));

async function started() {
  const runner = await wwRunner({}, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  clearLand(runner.game);
  return { runner, g: runner.game, ww: runner.game.worldWar()! };
}

/** Through the next day's common step. */
function nextDay(runner: GameRunner): void {
  const ww = runner.game.worldWar()!;
  const day = ww.day(runner.game.ticks());
  stepTo(runner, dayStartTick(day + 1, WW_PREP_TICKS) + 1);
}

describe("World War 1936 P5: liberated land", () => {
  beforeEach(() => usePoliticsContent(endgameFixture()));

  it("an ally's recaptured region goes back to its legal owner the next day", async () => {
    const { runner, g, ww } = await started();
    const [deu, pl, gbr] = [endId("DEU"), endId("POL"), endId("GBR")];
    const eg = ww.endgame;
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    ww.setWar(deu, gbr, g.ticks(), {
      kind: "into",
      warId: eg.warOfPair(deu, pl),
    });
    // Germany's conquest stays: it fights Poland.
    takeRegion(g, 7, "DEU");
    nextDay(runner);
    expect(ww.land.controller[7]).toBe(deu);
    // Britain retakes Krakow: Britain's until the next day's common step.
    takeRegion(g, 7, "GBR");
    step(runner);
    expect(ww.land.controller[7]).toBe(gbr);
    nextDay(runner);
    expect(ww.land.controller[7]).toBe(pl);
    expect(ww.politics.legalOwner[7]).toBe(pl);
    expect(g.owner(ww.scenario.vpTile(ww.scenario.region(7)!)).smallID()).toBe(
      pl,
    );
  });

  it("an occupation zone is never returned", async () => {
    const { runner, g, ww } = await started();
    const [csk, gbr] = [endId("CSK"), endId("GBR")];
    const eg = ww.endgame;
    // At peace, Britain holds the Sudetenland and Slovakia; Slovakia is its
    // zone (Czechoslovakia keeps Prague and Kosice: it plays on).
    takeRegion(g, 13, "GBR");
    takeRegion(g, 15, "GBR");
    eg.zones.push({ region: 15, holder: gbr, untilDay: -1 });
    eg.dirtyZones = true;
    nextDay(runner);
    nextDay(runner);
    expect(ww.land.controller[13]).toBe(csk);
    expect(ww.land.controller[15]).toBe(gbr);
  });

  it("a gone owner that is no exile gets nothing back", async () => {
    const { runner, g, ww } = await started();
    const [ltu, gbr] = [endId("LTU"), endId("GBR")];
    const eg = ww.endgame;
    // Britain holds Memel; Lithuania (Kaunas left, but gone — a
    // conference's to settle) gets nothing back.
    takeRegion(g, 16, "GBR");
    eg.setCountryState(ltu, CS_GONE);
    nextDay(runner);
    nextDay(runner);
    expect(ww.land.controller[16]).toBe(gbr);
    expect(ww.land.controller[17]).toBe(ltu);
    expect(eg.countryState(ltu)).toBe("gone");
  });
});
