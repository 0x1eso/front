// World War 1936 (T23 determinism lane): no two state records share one
// array, since a restored game never does. The strict object-graph check
// (diffGraphs: an object reached twice in one graph must be one object in
// the other) holds after a restore when
// - a lend-lease contract ships two generations on one day (each shipment
//   its own `srs`), and
// - a conference round settles a demand (lastRound and settled each their
//   own `regions`).
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { DEMAND_KINDS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEO_FAS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import { submitDemands } from "@openfront/engine/ww1936/endgame/Conference";
import { addWarScore } from "@openfront/engine/ww1936/endgame/Wars";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { diffGraphs } from "../util/Snapshot";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  clearLand,
  clearStartSetup,
  END_MAP,
  gameHash,
  order,
  step,
  stepTo,
  type WwHuman,
  wwRestore,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

/** The restored copy has the same graph, aliasing included, and runs on equal. */
async function restoresStrictly(
  a: GameRunner,
  humans: WwHuman[],
): Promise<void> {
  const b = await wwRestore(a, humans, END_MAP);
  expect(gameHash(b)).toBe(gameHash(a));
  expect(diffGraphs(a.game, b.game)).toEqual([]);
  for (let i = 0; i < 30; i++) {
    step(a);
    step(b);
    expect(gameHash(b), `tick ${i + 1} after the restore`).toBe(gameHash(a));
  }
  expect(diffGraphs(a.game, b.game)).toEqual([]);
}

function until(runner: GameRunner, done: () => boolean, max = 2000): void {
  for (let i = 0; i < max && !done(); i++) step(runner);
  if (!done()) throw new Error("condition not reached");
}

describe("World War 1936: no shared arrays between state records", () => {
  it("a contract's shipments of one day each keep their own route", async () => {
    const humans: WwHuman[] = [
      { clientID: "HUMANITA", country: "ITA" },
      { clientID: "HUMANPOL", country: "POL" },
    ];
    const a = await wwRunner({}, humans, END_MAP);
    stepTo(a, WW_PREP_TICKS + 1);
    const g = a.game;
    const ww = g.worldWar()!;
    const eg = ww.endgame;
    const [ita, pl, sun] = (["ITA", "POL", "SUN"] as const).map(endId);
    clearLand(g);
    for (const id of [ita, pl]) {
      clearStartSetup(ww.economy, ww.economy.country(id)!);
    }
    // Five of the oldest generation and plenty of the next: a day's ten
    // go as two shipments (gen 0: any generation, oldest first).
    const ce = ww.economy.country(ita)!;
    ce.stock[equipKey("infantry_equipment", 1)] = 5;
    ce.stock[equipKey("infantry_equipment", 2)] = 10_000;
    ww.setWar(pl, sun, g.ticks(), { kind: "declare" });
    step(a, 2, [
      order("HUMANITA", {
        kind: "lend_lease",
        to: pl,
        item: "infantry_equipment",
        gen: 0,
        perMonth: 300,
      }),
    ]);
    until(a, () => eg.inTransit.length >= 2);
    const [x, y] = eg.inTransit;
    expect([x.gen, y.gen, x.arriveDay]).toEqual([1, 2, y.arriveDay]);
    expect(x.srs).toEqual(y.srs);
    expect(x.srs).not.toBe(y.srs);
    await restoresStrictly(a, humans);
  }, 60_000);

  it("a conference round's results and its settlements keep their own regions", async () => {
    const humans: WwHuman[] = [{ clientID: "HDEU", country: "DEU" }];
    const a = await wwRunner({}, humans, END_MAP);
    stepTo(a, WW_PREP_TICKS + 2);
    const g = a.game;
    const ww = g.worldWar()!;
    const eg = ww.endgame;
    const [deu, pol] = (["DEU", "POL"] as const).map(endId);
    ww.politics.country(deu)!.ruling = IDEO_FAS;
    // Germany beats Poland holding Warsaw; Krakow is left for round 2.
    // Reparations settle as one row (a take settles region by region).
    expect(ww.setWar(deu, pol, g.ticks(), { kind: "declare" })).toBe(true);
    const war = eg.war(eg.warOfPair(deu, pol))!;
    addWarScore(eg, war.id, deu, 1000);
    ww.land.setController(END.region.warsaw, deu, g.ticks());
    const p = g.playerBySmallID(pol);
    if (!p.isPlayer()) throw new Error("no POL");
    capitulate(g, ww, p, g.ticks());
    const c = eg.conferences[eg.conferences.length - 1];
    expect(
      submitDemands(
        eg,
        deu,
        c.id,
        [
          { kind: "reparations", target: pol, k: 1 },
          { kind: "take", region: END.region.warsaw },
        ],
        g.ticks(),
      ),
    ).toBeNull();
    until(a, () => c.lastRound.length > 0, 400);
    expect(eg.conferences).toContain(c);
    const REP = DEMAND_KINDS.indexOf("reparations");
    const last = c.lastRound.find((r) => r.kind === REP && r.ok)!;
    const settled = c.settled.find((s) => s.kind === REP)!;
    expect(last).toBeDefined();
    expect(settled).toBeDefined();
    expect(last.regions).toEqual(settled.regions);
    expect(last.regions).not.toBe(settled.regions);
    await restoresStrictly(a, humans);
  }, 60_000);
});
