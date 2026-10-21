// World War 1936 P5 lane O (spec §8.5, plan decision 10): garrison armies
// spread over the administered regions; a region's suppression. Germany
// and Czechoslovakia are humans (no AI moves), on the end map's
// Czechoslovak island chain 13–14–15–20.
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { MOVE_NONE, MOVE_WALK } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  needOf,
  rowSuppression,
  supplyOf,
} from "@openfront/engine/ww1936/endgame/Garrison";
import { garrisonOrder } from "@openfront/engine/ww1936/endgame/Occupation";
import { startHopInto } from "@openfront/engine/ww1936/land/Movement";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  clearLand,
  END_MAP,
  placeArmy,
  stepTo,
  type WwHuman,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const HUMANS: WwHuman[] = [
  { clientID: "HUMANDEU", country: "DEU" },
  { clientID: "HUMANCSK", country: "CSK" },
];
const SUDETEN = END.region["sudetenland"];
const PRAGUE = END.region["prague"];
const SLOVAKIA = END.region["slovakia"];
const KOSICE = END.region["kosice"];
const CZECH = [SUDETEN, PRAGUE, SLOVAKIA, KOSICE];

/** Past the preparation, an empty board, Germany holding Czechoslovakia. */
async function garrisonGame() {
  const runner = await wwRunner({}, HUMANS, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  const deu = endId("DEU");
  clearLand(g);
  const ce = ww.economy.country(deu)!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
  for (const r of CZECH) ww.land.setController(r, deu, g.ticks());
  // Czechoslovakia has capitulated (its legal owner stays until a peace):
  // a playing owner at peace would get its land back (lane X, spec §5.3).
  ww.addCapitulation(endId("CSK"), deu, g.ticks());
  return { runner, g, ww, eg: ww.endgame, land: ww.land, deu };
}

function days(runner: GameRunner, n: number): void {
  const ww = runner.game.worldWar()!;
  stepTo(
    runner,
    dayStartTick(ww.day(runner.game.ticks()) + n, ww.prepEndTick()),
  );
}

describe("World War 1936 P5: garrisons", () => {
  it("a garrison army spreads to the most needed regions", async () => {
    const { runner, eg, land, deu } = await garrisonGame();
    expect([...eg.administeredOf(deu)]).toEqual(CZECH);
    // Resistance makes Slovakia the most needed, then Kosice; Prague,
    // where the army stands, the least.
    eg.resBp[SLOVAKIA] = 9000;
    eg.resBp[KOSICE] = 8000;
    const order = [...CZECH].sort(
      (a, b) => needOf(eg, deu, b) - needOf(eg, deu, a) || a - b,
    );
    expect(order.slice(0, 2)).toEqual([SLOVAKIA, KOSICE]);
    const a = placeArmy(runner.game, "DEU", PRAGUE, 2);
    const [d1, d2] = [...a.divisions].sort((x, y) => x - y);
    // One division covers any one region's need here.
    const r1 = land.divisions.rowOf(d1);
    for (const r of CZECH) {
      expect(rowSuppression(land, r1)).toBeGreaterThan(needOf(eg, deu, r));
    }
    expect(garrisonOrder(eg, deu, a.id, 0)).toBeNull();
    days(runner, 2);
    const t = land.divisions;
    expect(t.dest[land.divisions.rowOf(d1)]).toBe(SLOVAKIA);
    expect(t.dest[land.divisions.rowOf(d2)]).toBe(KOSICE);
    days(runner, 20);
    expect(t.region[t.rowOf(d1)]).toBe(SLOVAKIA);
    expect(t.region[t.rowOf(d2)]).toBe(KOSICE);
    expect(t.mode[t.rowOf(d1)]).toBe(MOVE_NONE);
    // Standing, it counts in full (its strength moves with losses and refits).
    expect(eg.supDeci[SLOVAKIA]).toBeGreaterThanOrEqual(
      needOf(eg, deu, SLOVAKIA),
    );
    // Two more: one region each, nobody leaves its place.
    const b = placeArmy(runner.game, "DEU", PRAGUE, 2);
    for (const id of [...b.divisions]) land.moveToArmy(id, a);
    days(runner, 25);
    const where = [...a.divisions]
      .sort((x, y) => x - y)
      .map((id) => t.region[t.rowOf(id)]);
    expect(where.slice(0, 2)).toEqual([SLOVAKIA, KOSICE]);
    expect([...where].sort((x, y) => x - y)).toEqual(CZECH);
    for (const r of CZECH) {
      expect(eg.supDeci[r], `region ${r}`).toBeGreaterThanOrEqual(
        needOf(eg, deu, r),
      );
    }
  }, 60_000);

  it("a scoped garrison stays on its legal owner's regions", async () => {
    const { runner, g, ww, eg, deu } = await garrisonGame();
    // Kosice taken (legal owner Germany): a Czechoslovak-scoped army skips it.
    ww.politics.setLegalOwner(KOSICE, deu);
    expect(eg.isAdministered(KOSICE)).toBe(true);
    eg.resBp[KOSICE] = 9000;
    const a = placeArmy(g, "DEU", PRAGUE, 4);
    expect(garrisonOrder(eg, deu, a.id, endId("CSK"))).toBeNull();
    days(runner, 25);
    const t = ww.land.divisions;
    for (const id of a.divisions) {
      expect(t.region[t.rowOf(id)]).not.toBe(KOSICE);
    }
    expect(garrisonOrder(eg, deu, a.id, 999)).toBe("bad_target");
    expect(garrisonOrder(eg, endId("CSK"), a.id, 0)).toBe("no_army");
  }, 60_000);

  it("only standing garrison divisions count fully, others half", async () => {
    const { g, eg, land, deu } = await garrisonGame();
    const gar = placeArmy(g, "DEU", SLOVAKIA, 1);
    const other = placeArmy(g, "DEU", SLOVAKIA, 1);
    expect(garrisonOrder(eg, deu, gar.id, 0)).toBeNull();
    const rg = land.divisions.rowOf(gar.divisions[0]);
    const ro = land.divisions.rowOf(other.divisions[0]);
    const sg = rowSuppression(land, rg);
    const so = rowSuppression(land, ro);
    expect(sg).toBeGreaterThan(0);
    expect(supplyOf(eg, SLOVAKIA)).toBe(sg + Math.floor(so / 2));
    // On its way out: it counts no more.
    startHopInto(land, rg, KOSICE, MOVE_WALK);
    expect(supplyOf(eg, SLOVAKIA)).toBe(Math.floor(so / 2));
    // Another country's divisions count nothing for the controller.
    expect(supplyOf(eg, KOSICE)).toBe(0);
    // Its strength scales it.
    land.setMen(ro, Math.floor(land.divisions.men[ro] / 2));
    expect(rowSuppression(land, ro)).toBeLessThan(so);
  }, 60_000);
});
