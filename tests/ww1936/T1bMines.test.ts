// World War 1936 P6 T1b (navy/air half): enemy mines on P4's convoy war
// and landings (spec §15.1, lane W2's sites 1 and 2) on ww1936sea, every
// country human.
import { CONVOY_USES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  mineConvoyLossPm,
  mineInvasionCutPct,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import { noteKills } from "@openfront/engine/ww1936/endgame/Wars";
import {
  convoyLossPmOf,
  convoyWar,
} from "@openfront/engine/ww1936/navy/ConvoyWar";
import { amphibiousModsFor } from "@openfront/engine/ww1936/navy/Invasions";
import type { SeaRoute, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { vi } from "vitest";
import { CONVOY, seaGame, war } from "./convoyUtil";
import { REGION, SR, TAG_ID } from "./seaFixture";
import { placeArmy, withTestPolitics } from "./util";

withTestPolitics();

// Wars is a leaf of the war score: the spy only watches who is credited.
vi.mock("@openfront/engine/ww1936/endgame/Wars", async (original) => {
  const real =
    await original<typeof import("@openfront/engine/ww1936/endgame/Wars")>();
  return { ...real, noteKills: vi.fn(real.noteKills) };
});

function britishRoute(navy: WwNavy, got: number, day: number): SeaRoute {
  const r: SeaRoute = {
    id: navy.nextRouteId++,
    use: CONVOY_USES.indexOf("trade"),
    owner: TAG_ID.GBR,
    ref: 999,
    zones: [40001],
    km: 0,
    srs: [SR.approaches],
    need: got,
    got,
    nextDay: day + 7,
  };
  navy.routes.set(r.id, r);
  return r;
}

function setMines(d: WwDepth, rows: [number, number, number][]): void {
  d.sea.mines = rows;
  d.reindexSparse();
}

describe("T1b: mines in the convoy war and landings (spec §15.1)", () => {
  it("a mined region sinks convoys with no raider there, credited to nobody", async () => {
    const g = await seaGame();
    const { navy, ww } = g;
    war(g, "ITA", "GBR");
    const day = ww.day(g.runner.game.ticks());
    const idx = ww.scenario.srIdxOf(SR.approaches);
    britishRoute(navy, 30, day);
    const stock = g.ce("GBR").stock[CONVOY];
    // No mines: nothing happens (P4's fast path).
    convoyWar(navy, SR.approaches, day);
    expect(navy.srState[idx].lossYesterday.size).toBe(0);
    expect(convoyLossPmOf(navy, TAG_ID.GBR, SR.approaches)).toBe(0);
    // 50 units of Italian mines: m / 10 = 50 ‰ of the 30 convoys a day.
    setMines(ww.depth, [[SR.approaches, ww.land.sideOf(TAG_ID.ITA), 500_000]]);
    expect(mineConvoyLossPm(500_000)).toBe(50);
    vi.mocked(noteKills).mockClear();
    convoyWar(navy, SR.approaches, day + 1);
    const st = navy.srState[idx];
    expect(st.lossYesterday.get(TAG_ID.GBR)).toBe(30 * 50);
    // 1,500 milli: one convoy goes, 500 stay.
    expect(g.ce("GBR").stock[CONVOY]).toBe(stock - 1);
    expect(st.raidRest.get(TAG_ID.GBR)).toBe(500);
    expect([...navy.routes.values()][0].got).toBe(29);
    // Nobody sank it: the war score hears nothing.
    expect(vi.mocked(noteKills)).not.toHaveBeenCalled();
    // P5 lend-lease's read adds the mines; the AI's escort signal does not.
    expect(convoyLossPmOf(navy, TAG_ID.GBR, SR.approaches)).toBe(50);
    expect(st.lossRate.size).toBe(0);
    // Italy's own mines spare Italy's convoys.
    expect(convoyLossPmOf(navy, TAG_ID.ITA, SR.approaches)).toBe(0);
  });

  it("enemy mines on the landing's sea region cut the landing", async () => {
    const g = await seaGame();
    const { navy, ww } = g;
    war(g, "ITA", "GBR");
    const l = ww.land;
    const a = placeArmy(g.runner.game, "GBR", REGION.rome, 1);
    const id = a.divisions[0];
    const row = l.divisions.rowOf(id);
    navy.landing.set(id, 1_000_000);
    // Rome's harbour zone lies in the Central Waters.
    expect(ww.scenario.zoneSr(ww.scenario.harborOf(REGION.rome))).toBe(
      SR.central,
    );
    expect(amphibiousModsFor(navy, REGION.rome, row)?.attackBp).toBe(-7000);
    setMines(ww.depth, [[SR.central, ww.land.sideOf(TAG_ID.ITA), 550_000]]);
    expect(mineInvasionCutPct(550_000)).toBe(5);
    expect(amphibiousModsFor(navy, REGION.rome, row)?.attackBp).toBe(-7500);
    // A full field cuts 10% at most.
    setMines(ww.depth, [[SR.central, ww.land.sideOf(TAG_ID.ITA), 1_000_000]]);
    expect(amphibiousModsFor(navy, REGION.rome, row)?.attackBp).toBe(-8000);
    // Mines elsewhere (the Approaches) do not reach Rome's landing.
    setMines(ww.depth, [
      [SR.approaches, ww.land.sideOf(TAG_ID.ITA), 1_000_000],
    ]);
    expect(amphibiousModsFor(navy, REGION.rome, row)?.attackBp).toBe(-7000);
    // Britain's own mines do not cut Britain's landing.
    setMines(ww.depth, [[SR.central, ww.land.sideOf(TAG_ID.GBR), 1_000_000]]);
    expect(amphibiousModsFor(navy, REGION.rome, row)?.attackBp).toBe(-7000);
  });
});
