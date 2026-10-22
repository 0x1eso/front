import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  WW_LL_TENSION_DEMOCRACY_PCT,
  WW_UPRISING_RES_BP,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { idleOrder } from "@openfront/engine-api/ww1936/LandTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
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
  garrisonPlan,
  integrateRows,
  llGate,
  myOccRows,
  occupationCells,
  occupationChip,
  occupationMapSource,
  occupationModeOf,
  pumpGarrison,
  startGarrison,
  summarize,
  whyText,
  zoneLine,
} from "../../../src/client/hud/ww1936/EndgameModel";
import {
  OCC_BLINK,
  OCC_HATCH,
} from "../../../src/client/render/gl/passes/OccupationPass";
import { ID } from "./EconomyFixture";
import { fakeEndGame, occ } from "./EndgameFixture";
import { army, division, landDetail, mine, startTemplate } from "./LandFixture";

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

  it("the 38th parallel zone reads neutral: no resistance, a grey fill", () => {
    const korea = CONTENT.groupIdx.get("korea_south")!.regions[0];
    const { game } = fakeEndGame({
      me: "GBR",
      endgame: {
        zones: [
          { region: korea, holder: ID("SUN"), untilDay: 9_999 },
          { region: KRAKOW, holder: ID("FRA"), untilDay: 9_999 },
        ],
      },
    });
    const line = zoneLine(game, korea)!;
    expect(line.startsWith("[ww1936.occ.zone_korea] · ")).toBe(true);
    expect(line).not.toContain("res");
    expect(zoneLine(game, KRAKOW)!.startsWith("[ww1936.occ.zone] · ")).toBe(
      true,
    );
    expect(zoneLine(game, WARSAW)).toBeNull();
    // Both zones neutral grey on the map, no hatch or rim, for any viewer.
    const cells = occupationCells(game, ID("GBR"));
    expect(cells.map((c) => c.region).sort((a, b) => a - b)).toEqual(
      [KRAKOW, korea].sort((a, b) => a - b),
    );
    for (const c of cells) {
      expect(c.flags).toBe(0);
      expect(c.rgb[0]).toBe(c.rgb[1]);
      expect(c.rgb[1]).toBe(c.rgb[2]);
    }
  });

  it("the map's key moves with the data, not with the clock", () => {
    const { game, eg, land } = occupied();
    let t = 600;
    const g = { ...game, ticks: () => t } as typeof game;
    const src = occupationMapSource(g);
    const k0 = src.key();
    t += 5;
    expect(src.key()).toBe(k0);
    // A row replaced (the view swaps objects): the key moves next tick.
    eg.apply({ news: [], occupation: [occ(KRAKOW, "DEU", { resBp: 100 })] });
    expect(src.key()).toBe(k0);
    t++;
    const k1 = src.key();
    expect(k1).not.toBe(k0);
    // Krakow back in Polish hands.
    land.controller[KRAKOW] = ID("POL");
    t++;
    const k2 = src.key();
    expect(k2).not.toBe(k1);
    // The mode toggles at once.
    occupationModeOf(g).toggle();
    expect(src.key()).not.toBe(k2);
    expect(src.on()).toBe(true);
  });

  it("garrisonPlan takes cavalry, then the weakest, never in battle or garrisons", () => {
    const inf = startTemplate("DEU", 1, {
      battalions: ["infantry", "infantry"],
      support: [],
    });
    const cav = startTemplate("DEU", 2, {
      battalions: ["cavalry", "cavalry"],
      support: [],
    });
    const at = (needDeci: number) => {
      const r = fakeEndGame({
        me: "DEU",
        control: [[WARSAW, "DEU"]],
        endgame: { occupation: [occ(WARSAW, "DEU", { needDeci })] },
      });
      const garrison = { ...idleOrder(), kind: "garrison" as const };
      r.land.apply(
        {
          armies: [
            army(1, "DEU", 3, { divisions: 2 }),
            army(2, "DEU", 3, { divisions: 3 }),
            army(3, "DEU", 3, {
              divisions: 1,
              mine: mine({ order: garrison }),
            }),
          ],
          removedArmies: [],
          battles: [],
          endedBattles: [],
          regions: [],
          countries: [],
          details: [
            landDetail("DEU", {
              templates: [inf, cav],
              divisions: [
                division(11, 1, 3), // infantry 20
                division(12, 1, 3, { strengthPm: 400 }), // 8
                division(21, 2, 3, { template: 2 }), // cavalry 40
                division(22, 2, 3, { strengthPm: 700 }), // 14
                division(23, 2, 3, { battle: 5 }), // in a battle
                division(31, 3, 3), // the garrison army's 20
              ],
            }),
          ],
        },
        600,
      );
      return r;
    };
    // Need 100: 90% is 90, the garrison army has 20 — 70 to find.
    const big = at(100);
    const plan = garrisonPlan(big.game, ID("DEU"))!;
    expect(plan.wantDeci).toBe(70);
    expect(plan.picks).toEqual([21, 12, 22, 11]);
    expect(plan.gotDeci).toBe(82);
    expect(plan.whole).toEqual([1]);
    expect(plan.splits).toEqual([
      { army: 2, count: 1, template: 1 },
      { army: 2, count: 1, template: 2 },
    ]);
    // Need 50: 25 to find, the cavalry alone.
    expect(garrisonPlan(at(50).game, ID("DEU"))!.picks).toEqual([21]);
    // Need 20: the garrison army is enough.
    expect(garrisonPlan(at(20).game, ID("DEU"))!.picks).toEqual([]);

    // The job: splits now; once the two new armies show, one merged garrison.
    const sent: WwOrder[] = [];
    expect(startGarrison(big.game, ID("DEU"), (o) => sent.push(o), 0)).toBe(
      true,
    );
    expect(sent.map((o) => o.kind)).toEqual(["army_split", "army_split"]);
    sent.length = 0;
    pumpGarrison(big.game, ID("DEU"), (o) => sent.push(o), 100);
    expect(sent).toEqual([]);
    big.land.apply(
      {
        armies: [
          army(4, "DEU", 3, { divisions: 1 }),
          army(5, "DEU", 3, { divisions: 1 }),
        ],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [],
        countries: [],
        details: [],
      },
      601,
    );
    pumpGarrison(big.game, ID("DEU"), (o) => sent.push(o), 200);
    expect(sent).toEqual([
      { kind: "army_merge", army: 4, into: 1 },
      { kind: "army_merge", army: 5, into: 1 },
      { kind: "army_garrison", army: 1, scope: 0 },
    ]);
  });
});
