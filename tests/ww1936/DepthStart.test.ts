// World War 1936 P6 (spec §3.5, §19.2; pre-flight §0-9; review E3): the
// AI's day-0 doctrines — its own row with historical AI, else its
// personality's with the naval rule, and a seeded chance of another.
import type { StartDoctrineDef } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  GD_DOMAIN,
  GRAND_DOCTRINES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  PERSONALITY_START_GD,
  START_DOCTRINE_DEVIATION_PCT,
  startDoctrinePick,
} from "@openfront/engine-lib/ww1936/DoctrineRules";
import { aiPersonality } from "@openfront/engine/ww1936/economy/AiEconomy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

const TABLE: StartDoctrineDef[] = [
  {
    tag: "DEU",
    gd: ["gd_mobile", "gd_trade_interdiction", "gd_battlefield_support"],
    sub: ["inf_elastic", "arm_breakthrough"],
  },
  { tag: "@minor", gd: ["gd_mass", "gd_fleet_in_being", null], sub: [] },
];
const base = {
  table: TABLE,
  historical: true,
  navy: false,
  seed: 1,
  id: 5,
} as const;

/** The row's pick, without the deviation. */
const rowPick = (i: Parameters<typeof startDoctrinePick>[0]) =>
  startDoctrinePick({ ...i, deviationPct: 0 });

afterEach(() => usePoliticsContent(null));

describe("start doctrines", () => {
  it("historical AI: the country's row; else its personality's with the naval rule", () => {
    const deu = rowPick({ ...base, tag: "DEU", personality: "aggressor" });
    expect(deu.gd).toEqual([
      "gd_mobile",
      "gd_trade_interdiction",
      "gd_battlefield_support",
    ]);
    expect(deu.sub).toEqual(["inf_elastic", "arm_breakthrough"]);
    // Historical AI off: Germany plays its personality (no row: the spec's).
    const off = rowPick({
      ...base,
      historical: false,
      tag: "DEU",
      personality: "aggressor",
    });
    expect(off.gd).toEqual([...PERSONALITY_START_GD.aggressor]);
    // A minor: its row on land and in the air; at sea trade interdiction
    // only with a coast and three dockyards.
    const pol = rowPick({ ...base, tag: "POL", personality: "minor" });
    expect(pol.gd).toEqual(["gd_mass", null, null]);
    const navy = rowPick({
      ...base,
      tag: "POL",
      personality: "minor",
      navy: true,
    });
    expect(navy.gd).toEqual(["gd_mass", "gd_trade_interdiction", null]);
  });

  it("a seeded chance of another doctrine of the same domain: games differ", () => {
    let deviated = 0;
    const n = 400;
    for (let seed = 1; seed <= n; seed++) {
      const p = startDoctrinePick({
        ...base,
        seed,
        tag: "DEU",
        personality: "aggressor",
      });
      const land = GRAND_DOCTRINES.indexOf(p.gd[0]!);
      expect(GD_DOMAIN[land]).toBe(0);
      if (p.gd[0] !== "gd_mobile") deviated++;
    }
    // About START_DOCTRINE_DEVIATION_PCT of the games.
    expect(deviated).toBeGreaterThan(
      (n * (START_DOCTRINE_DEVIATION_PCT - 8)) / 100,
    );
    expect(deviated).toBeLessThan(
      (n * (START_DOCTRINE_DEVIATION_PCT + 8)) / 100,
    );
  });

  it("in a game: every AI country picks on day 0, the human never", async () => {
    usePoliticsContent(depthFixture({ startDoctrines: TABLE }));
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANITA", country: "ITA" }],
      DEEP.map,
    );
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    stepTo(runner, WW_PREP_TICKS - 1);
    expect(d.country(DEEP.tag.POL)!.doc.gd).toEqual([-1, -1, -1]);
    stepTo(runner, WW_PREP_TICKS + 1);
    expect(d.country(DEEP.tag.ITA)!.doc.gd).toEqual([-1, -1, -1]);
    for (const tag of ["DEU", "POL", "FRA", "GBR"] as const) {
      const id = DEEP.tag[tag];
      const ce = ww.economy.country(id)!;
      const pick = startDoctrinePick({
        table: TABLE,
        tag,
        personality: aiPersonality(tag),
        historical: runner.game.config().historicalAi() === true,
        navy:
          ce.totals.dock >= 3 &&
          ww.economy.regionsOf(id).some((r) => ww.scenario.harborOf(r) !== 0),
        seed: ww.politics.seed,
        id,
      });
      expect(d.country(id)!.doc.gd, tag).toEqual(
        pick.gd.map((g) => (g === null ? -1 : GRAND_DOCTRINES.indexOf(g))),
      );
      // A non-major AI gets a land doctrine (spec §3.5 "그 밖").
      expect(d.country(id)!.doc.gd[0], tag).toBeGreaterThanOrEqual(0);
    }
  });
});
