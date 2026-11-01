// Annexed land (legal owner = controller, no core) becomes core by itself
// after WW_AUTO_INTEGRATE_DAYS without an uprising; wartime occupation never.
import {
  CS_GONE,
  WW_AUTO_INTEGRATE_DAYS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { uprisingNow } from "@openfront/engine/ww1936/endgame/Occupation";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { clearLand, END_MAP, stepTo, type WwHuman, wwRunner } from "./util";

const N = WW_AUTO_INTEGRATE_DAYS;
const HUMANS: WwHuman[] = [
  { clientID: "HUMANDEU", country: "DEU" },
  { clientID: "HUMANCSK", country: "CSK" },
];
const SLOVAKIA = END.region["slovakia"];

describe("World War 1936: automatic integration of annexed land", () => {
  beforeEach(() => usePoliticsContent(endgameFixture()));
  afterEach(() => usePoliticsContent(null));

  async function setup(annexed: boolean) {
    const runner = await wwRunner({}, HUMANS, END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    clearLand(g);
    const deu = endId("DEU");
    ww.endgame.setCountryState(endId("CSK"), CS_GONE);
    ww.land.setController(SLOVAKIA, deu, g.ticks());
    if (annexed) ww.politics.setLegalOwner(SLOVAKIA, deu); // a conference's cession
    return { runner, g, ww, eg: ww.endgame, deu };
  }
  function days(runner: GameRunner, n: number): void {
    const ww = runner.game.worldWar()!;
    stepTo(
      runner,
      dayStartTick(ww.day(runner.game.ticks()) + n, ww.prepEndTick()),
    );
  }

  it("a ceded region becomes core after the period, with a notice path", async () => {
    const { runner, eg, deu } = await setup(true);
    days(runner, 2);
    expect(eg.autoOwner[SLOVAKIA]).toBe(deu);
    days(runner, N - 7);
    expect(eg.hasCore(deu, SLOVAKIA)).toBe(false);
    days(runner, 10);
    expect(eg.hasCore(deu, SLOVAKIA)).toBe(true);
    expect(eg.isAdministered(SLOVAKIA)).toBe(false);
    expect(eg.autoOwner[SLOVAKIA]).toBe(0);
  }, 120_000);

  it("an uprising resets the clock", async () => {
    const { runner, g, eg, deu } = await setup(true);
    days(runner, N - 10);
    uprisingNow(eg, SLOVAKIA, g.ticks());
    days(runner, 20); // would be past N without the reset
    expect(eg.hasCore(deu, SLOVAKIA)).toBe(false);
    days(runner, N);
    expect(eg.hasCore(deu, SLOVAKIA)).toBe(true);
  }, 120_000);

  it("wartime occupation never integrates", async () => {
    const { runner, eg, deu } = await setup(false);
    days(runner, N + 30);
    expect(eg.hasCore(deu, SLOVAKIA)).toBe(false);
    expect(eg.autoOwner[SLOVAKIA]).toBe(0);
  }, 120_000);

  it("a change of owner resets the clock; snapshot and restore agree", async () => {
    const { runner, g, ww, eg, deu } = await setup(true);
    days(runner, N - 10);
    const gbr = endId("GBR");
    ww.land.setController(SLOVAKIA, gbr, g.ticks());
    ww.politics.setLegalOwner(SLOVAKIA, gbr);
    days(runner, 20);
    expect(eg.hasCore(deu, SLOVAKIA)).toBe(false);
    expect(eg.hasCore(gbr, SLOVAKIA)).toBe(false);
    expect(eg.autoOwner[SLOVAKIA]).toBe(gbr);
    // Snapshot -> restore into the same graph: same hash, same arrays.
    const hash = eg.hash();
    const snap = JSON.parse(JSON.stringify(eg.snapshot()));
    const since = eg.autoSince[SLOVAKIA];
    eg.autoOwner.fill(0);
    eg.autoSince.fill(0);
    eg.restoreState(snap);
    expect(eg.autoOwner[SLOVAKIA]).toBe(gbr);
    expect(eg.autoSince[SLOVAKIA]).toBe(since);
    expect(eg.hash()).toBe(hash);
  }, 120_000);
});
