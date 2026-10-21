// World War 1936 P3 (spec §6.1; controller rulings R4, R12): the lines of
// stability and war support, one by one, on the test map ww1936pol with
// the test content (no country rows: neutral, 50% bases, 55% neutral vote).
import { IDEO_DEM, IDEO_FAS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  computeStability,
  stabilityLines,
} from "@openfront/engine/ww1936/politics/Stability";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, pol, POL, step, takeRegion, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(politicsFixture()));
afterEach(() => usePoliticsContent(null));

async function game() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "GBR" }], POL);
  step(runner);
  const g = runner.game;
  const p = pol(g);
  const id = (t: "GBR" | "DEU" | "POL" | "FRA") => byTag(g, t).smallID();
  const line = (x: number, which: "stab" | "ws", name: string) =>
    stabilityLines(p, x, which).find((l) => l.key === `ww1936.pol.line.${name}`)
      ?.bp ?? 0;
  return { runner, g, p, ww: g.worldWar()!, id, line };
}

describe("stability and war support lines", () => {
  it("the base comes first and the lines add up to the value", async () => {
    const { p, id } = await game();
    const gbr = id("GBR");
    p.wtBp = 1000;
    const stab = stabilityLines(p, gbr, "stab");
    const ws = stabilityLines(p, gbr, "ws");
    expect(stab[0]).toEqual({ key: "ww1936.pol.line.stab_base", bp: 5000 });
    expect(ws[0]).toEqual({ key: "ww1936.pol.line.ws_base", bp: 5000 });
    // Neutral government with 55%: +1%; tension 10% × 30%: +3%.
    expect(stab).toEqual([
      { key: "ww1936.pol.line.stab_base", bp: 5000 },
      { key: "ww1936.pol.line.stab_party", bp: 100 },
    ]);
    expect(ws).toEqual([
      { key: "ww1936.pol.line.ws_base", bp: 5000 },
      { key: "ww1936.pol.line.ws_tension", bp: 300 },
    ]);
    expect(computeStability(p, gbr)).toEqual({ stabBp: 5100, wsBp: 5300 });
  });

  it("the ruling party: +10% at 100%, −4% at 30%", async () => {
    const { p, id, line } = await game();
    const c = p.country(id("GBR"))!;
    c.pop = [0, 0, 0, 10_000];
    expect(line(c.smallID, "stab", "stab_party")).toBe(1000);
    c.pop = [4000, 2000, 1000, 3000];
    expect(line(c.smallID, "stab", "stab_party")).toBe(-400);
  });

  it("a democracy fighting the war it declared loses 10%", async () => {
    const { g, p, ww, id, line } = await game();
    const [gbr, pl] = [id("GBR"), id("POL")];
    const c = p.country(gbr)!;
    c.declaredOn = [pl];
    ww.setWar(gbr, pl, g.ticks());
    // Neutral: no line.
    expect(line(gbr, "stab", "stab_offensive")).toBe(0);
    c.ruling = IDEO_DEM;
    expect(line(gbr, "stab", "stab_offensive")).toBe(-1000);
    // A war it was dragged into is no offensive war.
    c.declaredOn = [];
    expect(line(gbr, "stab", "stab_offensive")).toBe(0);
    c.declaredOn = [pl];
    ww.endWar(gbr, pl);
    expect(line(gbr, "stab", "stab_offensive")).toBe(0);
  });

  it("lost victory points cost up to 20% stability", async () => {
    const { g, id, line } = await game();
    const pl = id("POL");
    // Krakow: 3 of Poland's 24 victory points (12%).
    takeRegion(g, 7, "DEU");
    expect(line(pl, "stab", "stab_occupation")).toBe(-240);
    takeRegion(g, 6, "DEU");
    expect(line(pl, "stab", "stab_occupation")).toBe(-2000);
  });

  it("a PP deficit costs 10%", async () => {
    const { p, id, line } = await game();
    const c = p.country(id("GBR"))!;
    expect(line(c.smallID, "stab", "stab_no_pp")).toBe(0);
    c.ppMilli = -1;
    expect(line(c.smallID, "stab", "stab_no_pp")).toBe(-1000);
  });

  it("world tension lifts democracies and neutrals only", async () => {
    const { p, id, line } = await game();
    const gbr = id("GBR");
    const c = p.country(gbr)!;
    p.wtBp = 10_000;
    expect(line(gbr, "ws", "ws_tension")).toBe(3000);
    c.ruling = IDEO_DEM;
    p.wtBp = 5000;
    expect(line(gbr, "ws", "ws_tension")).toBe(1500);
    c.ruling = IDEO_FAS;
    expect(line(gbr, "ws", "ws_tension")).toBe(0);
  });

  it("a war declared on me adds 10%, an enemy in my capital 10% more", async () => {
    const { g, p, ww, id, line } = await game();
    const [deu, pl, fra] = [id("DEU"), id("POL"), id("FRA")];
    p.country(deu)!.declaredOn = [pl];
    expect(line(pl, "ws", "ws_defense")).toBe(0);
    ww.setWar(deu, pl, g.ticks());
    expect(line(pl, "ws", "ws_defense")).toBe(1000);
    // The attacker gets no defence line.
    expect(line(deu, "ws", "ws_defense")).toBe(0);
    expect(line(pl, "ws", "ws_capital")).toBe(0);
    takeRegion(g, 6, "DEU");
    expect(line(pl, "ws", "ws_capital")).toBe(1000);
    // A capital held by someone it is not at war with is no such line.
    takeRegion(g, 6, "FRA");
    expect(ww.isAtWar(pl, fra)).toBe(false);
    expect(line(pl, "ws", "ws_capital")).toBe(0);
  });

  it("war weariness: −4% per 1% of the core population lost, at most 30%", async () => {
    const { g, p, id, line } = await game();
    const pl = id("POL");
    const cl = g.worldWar()!.land.country(pl)!;
    // Poland's core: Warsaw 20,000 + Krakow 14,000 thousand people.
    cl.casualtiesTotal = 340_000;
    expect(line(pl, "ws", "ws_casualties")).toBe(-400);
    cl.casualtiesTotal = 34_000_000;
    expect(line(pl, "ws", "ws_casualties")).toBe(-3000);
    // Lost legal victory points weigh on top: 12% × 20.
    expect(line(pl, "ws", "ws_lost_vp")).toBe(0);
    takeRegion(g, 7, "DEU");
    expect(line(pl, "ws", "ws_lost_vp")).toBe(-240);
    expect(line(pl, "ws", "ws_casualties")).toBe(-3000);
    // The value never goes below 0.
    p.country(pl)!.wsBaseBp = 1000;
    expect(computeStability(p, pl).wsBp).toBe(0);
  });
});
