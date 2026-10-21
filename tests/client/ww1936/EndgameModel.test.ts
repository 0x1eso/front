import {
  WW_LL_TENSION_DEMOCRACY_PCT,
  WW_UPRISING_RES_BP,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { coveragePct } from "@openfront/engine-lib/ww1936/EndgameRules";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import {
  EndgameModel,
  integrateRows,
  llGate,
  myOccRows,
  occupationCells,
  occupationChip,
  summarize,
  whyText,
} from "../../../src/client/hud/ww1936/EndgameModel";
import {
  OCC_BLINK,
  OCC_HATCH,
} from "../../../src/client/render/gl/passes/OccupationPass";
import { ID } from "./EconomyFixture";
import { fakeEndGame, occ } from "./EndgameFixture";

const WARSAW = 6;
const KRAKOW = 7;
const MOSCOW = 8;

/** Germany holds Warsaw and Krakow; Moscow's row is stale (the Soviets hold it again). */
function occupied() {
  return fakeEndGame({
    me: "DEU",
    control: [
      [WARSAW, "DEU"],
      [KRAKOW, "DEU"],
    ],
    endgame: {
      occupation: [
        occ(WARSAW, "DEU", {
          needDeci: 41,
          supDeci: 32,
          resBp: 8_200,
          compBp: 1_800,
        }),
        occ(KRAKOW, "DEU", {
          needDeci: 20,
          supDeci: 25,
          resBp: 3_000,
          compBp: 2_200,
        }),
        occ(MOSCOW, "DEU", { needDeci: 99, supDeci: 0, resBp: 9_000 }),
      ],
    },
  });
}

describe("EndgameModel (P5 spec §20.3–§20.7)", () => {
  it("occupation summary sums need and supply", () => {
    const { game, eg } = occupied();
    const me = ID("DEU");
    const rows = myOccRows(game, me);
    expect(rows.map((r) => r.region)).toEqual([WARSAW, KRAKOW]);
    expect(rows.map((r) => r.owner)).toEqual([ID("POL"), ID("POL")]);
    const s = summarize(rows);
    expect(s).toEqual({
      regions: 2,
      avgResBp: 5_600,
      avgCompBp: 2_000,
      needDeci: 61,
      supDeci: 57,
      coveredPct: coveragePct(57, 61),
    });
    expect(new EndgameModel(eg, game).occupationSummary(me)).toEqual(s);
    expect(
      [...new EndgameModel(eg, game).byLegalOwner(me).entries()].map(
        ([owner, list]) => [owner, list.map((o) => o.region)],
      ),
    ).toEqual([[ID("POL"), [WARSAW, KRAKOW]]]);
    // The band chip: two regions, average resistance 56%.
    expect(occupationChip(game)).toEqual({ n: 2, resPct: 56 });
    // The map: Warsaw short of garrison and near an uprising, Krakow neither.
    expect(8_200).toBeGreaterThanOrEqual(WW_UPRISING_RES_BP);
    const cells = occupationCells(game, me);
    expect(cells.map((c) => [c.region, c.flags])).toEqual([
      [WARSAW, OCC_HATCH | OCC_BLINK],
      [KRAKOW, 0],
    ]);
    // Poland sees its own cores held by Germany, faintly.
    expect(occupationCells(game, ID("POL")).map((c) => c.region)).toEqual([
      WARSAW,
      KRAKOW,
    ]);
  });

  it("a blocked lend-lease gives the democracy reason", () => {
    const at = (ruling: number, wtBp: number) =>
      fakeEndGame({
        me: "GBR",
        wars: [["FRA", "DEU"]],
        politics: { ruling, wtBp },
        global: { wtBp },
      }).game;
    const why = llGate(at(0, 3_100), ID("GBR"), ID("FRA"));
    expect(why).toEqual({
      key: "ww1936.aid.why.ll_tension",
      params: { need: WW_LL_TENSION_DEMOCRACY_PCT, now: 31 },
    });
    expect(whyText(why!)).toBe(
      `[ww1936.aid.why.ll_tension] need=${WW_LL_TENSION_DEMOCRACY_PCT},now=31`,
    );
    // Over the mark, or another government: no reason.
    expect(llGate(at(0, 4_500), ID("GBR"), ID("FRA"))).toBeNull();
    expect(llGate(at(2, 3_100), ID("GBR"), ID("FRA"))).toBeNull();
    // Never to myself.
    expect(llGate(at(0, 4_500), ID("GBR"), ID("GBR"))?.key).toBe(
      "ww1936.aid.why.ll_conditions",
    );
  });

  it("integration waits for the engine's days of high compliance", () => {
    const at = (compHighDays: number | undefined) =>
      fakeEndGame({
        me: "DEU",
        control: [[WARSAW, "DEU"]],
        polSummaries: [],
        endgame: {
          occupation: [occ(WARSAW, "DEU", { compBp: 9_500, compHighDays })],
          coreChanges: [{ region: WARSAW, holders: [ID("POL")] }],
        },
      });
    const g = at(30);
    // Germany as the legal owner of Warsaw (a peace treaty took it).
    g.pol.legalOwner[WARSAW] = ID("DEU");
    expect(integrateRows(g.game, ID("DEU"))).toEqual([]);
    const ready = at(180);
    ready.pol.legalOwner[WARSAW] = ID("DEU");
    expect(integrateRows(ready.game, ID("DEU")).map((r) => r.region)).toEqual([
      WARSAW,
    ]);
  });
});
