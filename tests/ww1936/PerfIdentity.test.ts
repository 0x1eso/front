// World War 1936, the final perf lane: each speed-up answers exactly what
// the code it replaced answered. The old computations are written out here
// as references, and every case compares against them.
import { traitBit } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  dayOfDate,
  daysFromCivil,
} from "@openfront/engine-lib/ww1936/Calendar";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { skirmisherContact } from "@openfront/engine/ww1936/depth/Command";
import { levelPartsOf } from "@openfront/engine/ww1936/depth/IntelLevels";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { placeArmy, stepTo, wwRunner } from "./util";

afterEach(() => usePoliticsContent(null));

describe("final perf lane: same answers", () => {
  test("dayOfDate remembers valid dates and still throws on a bad one", () => {
    const epoch = daysFromCivil(1936, 1, 1);
    for (const iso of [
      "1936-01-01",
      "1939-09-01",
      "1945-08-21",
      "1900-02-28",
    ]) {
      const [y, m, d] = iso.split("-").map(Number);
      expect(dayOfDate(iso)).toBe(daysFromCivil(y, m, d) - epoch);
      // The second answer is the remembered one: the same.
      expect(dayOfDate(iso)).toBe(daysFromCivil(y, m, d) - epoch);
    }
    expect(() => dayOfDate("1939-9-1")).toThrow("not an ISO date");
    expect(() => dayOfDate("1939-9-1")).toThrow("not an ISO date");
  });

  test("advisorHolds: the persons index answers what the walk over every advisor did", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner({}, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const pol = runner.game.worldWar()!.politics;
    // The old walk (plan decision 19).
    const walk = (p: WwPolitics, generalId: string) =>
      p
        .list()
        .some((c) =>
          c.advisors.some(
            (a) =>
              a !== null &&
              p.content.personIdx.get(a)?.alsoGeneral === generalId,
          ),
        );
    const also = [...pol.content.personIdx.values()].filter(
      (p) => p.alsoGeneral !== undefined,
    );
    const ids = [
      ...new Set([
        ...GENERALS.map((g) => g.id),
        ...also.map((p) => p.alsoGeneral!),
        "no_such_general",
      ]),
    ];
    const check = () => {
      for (const id of ids)
        expect(pol.advisorHolds(id), id).toBe(walk(pol, id));
    };
    check();
    // Seat every person who is also a general somewhere, then a title.
    const c = pol.list()[0];
    for (const [i, p] of also.slice(0, c.advisors.length).entries()) {
      c.advisors[i] = p.id;
    }
    check();
    if (also.length > 0)
      expect(pol.advisorHolds(also[0].alsoGeneral!)).toBe(true);
    c.advisors[0] = "title:administrator";
    check();
    c.advisors.fill(null);
    check();
  });

  test("intel rows: the skirmisher line is Command.skirmisherContact's answer for every target", async () => {
    usePoliticsContent(depthFixture());
    const DEU = DEEP.tag.DEU;
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANDEU", country: "DEU" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const d = ww.depth;
    const land = ww.land;
    for (const tag of ["DEU", "POL"] as const) {
      const ce = ww.economy.country(DEEP.tag[tag])!;
      ce.manpower = 1_000_000;
      for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 100_000;
    }
    const deu = placeArmy(g, "DEU", DEEP.region.berlin, 2);
    placeArmy(g, "POL", DEEP.region.warsaw, 1);
    const cl = land.country(DEU)!;
    const gen = cl.generals.find((x) => x.army === 0)!;
    deu.general = gen.id;
    gen.army = deu.id;
    const lines = () => {
      const on = new Set<number>();
      for (const [t, dom, key] of levelPartsOf(d, DEU)) {
        if (key === "skirmisher" && dom === 1) on.add(t);
      }
      return on;
    };
    const check = () => {
      const on = lines();
      for (let t = 1; t < d.cap; t++) {
        if (t === DEU || !ww.isActor(t)) continue;
        const atWar = ww.isAtWar(DEU, t);
        const nb =
          ww.economy.countryNeighbours(DEU).includes(t) ||
          // Shared harbour zones count as neighbours too: take the row's own word.
          levelPartsOf(d, DEU).some(
            ([x, , key]) => x === t && key === "neighbour",
          );
        expect(on.has(t), `target ${t}`).toBe(
          (atWar || nb) && skirmisherContact(d, DEU, t),
        );
      }
      return on;
    };
    expect(check().size).toBe(0);
    gen.traits |= traitBit("skirmisher");
    expect(check().size).toBeGreaterThan(0);
    gen.traits &= ~traitBit("skirmisher");
    expect(check().size).toBe(0);
  });
});
