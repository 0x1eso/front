// World War 1936 P5 (plan Task 2, lane W; spec §6.9, §17.1): the
// conference AI on ww1936end — the history table first, then value per
// point within the points, takes bundled into one slot.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DEMAND_KINDS,
  WarLink,
  WW_PEACE_DEMANDS_PER_ROUND,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { planPeaceDemand } from "@openfront/engine-lib/ww1936/PeaceRules";
import type { Game, Player } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import { releasableTags } from "@openfront/engine/ww1936/endgame/Activate";
import {
  peaceCtx,
  priceOf,
  regionCost,
  submitDemands,
} from "@openfront/engine/ww1936/endgame/Conference";
import {
  aiDemands,
  keepsHistoryRow,
} from "@openfront/engine/ww1936/endgame/PeaceAi";
import { addWarScore } from "@openfront/engine/ww1936/endgame/Wars";
import type {
  Conference,
  WwEndgame,
} from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { vi } from "vitest";
import { END, endId } from "./endFixture";
import { END_GROUPS, endgameFixture } from "./endgameFixture";
import { END_MAP, step, stepTo, wwRunner } from "./util";

// Lane X lists the tags a conference may free (the CSK row names SVK).
vi.mock("@openfront/engine/ww1936/endgame/Activate", async (original) => {
  const real =
    await original<
      typeof import("@openfront/engine/ww1936/endgame/Activate")
    >();
  return { ...real, releasableTags: vi.fn(real.releasableTags) };
});

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => {
  usePoliticsContent(null);
  vi.mocked(releasableTags).mockReset();
});

const R = END.region;
const id = (t: CountryTag) => endId(t);

async function atWar(
  config: { historicalAi?: boolean } = {},
  humans: CountryTag[] = [],
): Promise<{ runner: GameRunner; g: Game; ww: WorldWar; eg: WwEndgame }> {
  const runner = await wwRunner(
    config,
    humans.map((t) => ({ clientID: `H${t}`, country: t })),
    END_MAP,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { runner, g: runner.game, ww, eg: ww.endgame };
}

const player = (g: Game, tag: CountryTag): Player => {
  const p = g.playerBySmallID(id(tag));
  if (!p.isPlayer()) throw new Error(`no ${tag}`);
  return p;
};

/** `winners` beat `loser` (one war; each with its war score and regions). */
function beat(
  g: Game,
  loser: CountryTag,
  winners: [CountryTag, number, number[]][],
): Conference {
  const ww = g.worldWar()!;
  const eg = ww.endgame;
  const link = (warId: number): WarLink => ({ kind: "into", warId });
  ww.setWar(id(winners[0][0]), id(loser), g.ticks());
  const w = eg.war(eg.warOfPair(id(winners[0][0]), id(loser)))!;
  for (const [tag] of winners.slice(1)) {
    ww.setWar(id(tag), id(loser), g.ticks(), link(w.id));
  }
  for (const [tag, ws, regions] of winners) {
    addWarScore(eg, w.id, id(tag), ws);
    for (const r of regions) ww.land.setController(r, id(tag), g.ticks());
  }
  capitulate(g, ww, player(g, loser), g.ticks());
  return eg.conferences[eg.conferences.length - 1];
}

const kinds = (ds: { kind: number }[]) => ds.map((d) => DEMAND_KINDS[d.kind]);

describe("World War 1936 P5: the conference AI (spec §6.9, §17.1)", () => {
  it("the history table goes first", async () => {
    const { g, ww, eg } = await atWar();
    vi.mocked(releasableTags).mockImplementation((_e, stake) =>
      stake.includes(R.slovakia) ? ["SVK"] : [],
    );
    // A seed whose game keeps Germany's CSK row in this conference
    // (pre-flight §0-8: ~75% of seeds).
    const pol = ww.politics as unknown as { _seed: number };
    let seed = 1;
    while (!keepsHistoryRow(seed, "CSK", id("DEU"), eg.nextConfId)) seed++;
    pol._seed = seed;
    const c = beat(g, "CSK", [["DEU", 1000, [R.prague]]]);
    const ai = aiDemands(eg, c.id, id("DEU"));
    // The test row: DEU take_group prague, release SVK — in that order.
    expect(kinds(ai).slice(0, 2)).toEqual(["take_group", "release"]);
    expect(ai[0].regions).toEqual([R.prague]);
    expect(ai[1].beneficiary).toBe(id("SVK"));
    expect(ai.map((d) => d.slot)).toEqual(ai.map((_, i) => i));
    // The card's default for this round is the same list.
    expect(c.ai.find((a) => a.id === id("DEU"))!.demands).toEqual(ai);
  });

  it("AI picks by value per point and stays within its points", async () => {
    const { g, eg } = await atWar();
    // The Soviet Union holds Warsaw, Germany Krakow: for Germany Krakow is
    // half price and Warsaw double (another participant holds it).
    const c = beat(g, "POL", [
      ["DEU", 6000, [R.krakow]],
      ["SUN", 4000, [R.warsaw]],
    ]);
    const deu = c.parts.find((p) => p.id === id("DEU"))!;
    const krakow = regionCost(eg, c, R.krakow, deu.id, deu.id);
    const warsaw = regionCost(eg, c, R.warsaw, deu.id, deu.id);
    expect(warsaw).toBeGreaterThan(krakow);
    // Points for Krakow, not for both.
    deu.pts = krakow + warsaw - 1;
    const ai = aiDemands(eg, c.id, deu.id);
    const taken = ai
      .filter((d) => DEMAND_KINDS[d.kind] === "take_group")
      .flatMap((d) => d.regions);
    expect(taken).toContain(R.krakow);
    expect(taken).not.toContain(R.warsaw);
    // What it asks for fits its points, slot by slot.
    let spent = 0;
    const used = new Map<number, number>();
    for (const d of ai) {
      spent += priceOf(eg, c, deu.id, d, used);
      for (const r of d.regions) used.set(r, deu.id);
    }
    expect(spent).toBeLessThanOrEqual(deu.pts);
    expect(ai.length).toBeLessThanOrEqual(WW_PEACE_DEMANDS_PER_ROUND);
    // No points, no demands.
    deu.pts = 0;
    expect(aiDemands(eg, c.id, deu.id)).toEqual([]);
  });

  it("takes are bundled into one slot", async () => {
    const { g, eg } = await atWar({ historicalAi: false });
    // Austria (no aggressor: it takes rather than puppets) beats Czechoslovakia.
    const c = beat(g, "CSK", [
      ["AUT", 1000, [R.sudetenland, R.prague, R.slovakia, R.kosice]],
    ]);
    const aut = c.parts[0];
    aut.pts = 10_000;
    const ai = aiDemands(eg, c.id, aut.id);
    expect(kinds(ai)).not.toContain("take");
    const groups = ai.filter((d) => DEMAND_KINDS[d.kind] === "take_group");
    // Several regions, one slot (in the AI's order, each once).
    expect(groups).toHaveLength(1);
    expect(groups[0].regions.length).toBeGreaterThanOrEqual(2);
    expect(new Set(groups[0].regions).size).toBe(groups[0].regions.length);
    expect(ai.map((d) => d.slot)).toEqual(ai.map((_, i) => i));
  });
});

// Korea and Taiwan (spec §6.9, §16.4; owner decision 6; controller ruling)
// on Czechoslovakia's regions: Slovakia + Kosice = "korea_north", Prague =
// "korea_south", Sudetenland = "taiwan"; Italy plays China (it claims
// "taiwan"), the history row is a JPN-style one.
function koreaFixture(claimant = true) {
  return endgameFixture({
    groups: [
      ...END_GROUPS,
      { id: "korea_north", regions: [R.slovakia, R.kosice], owner1936: "CSK" },
      { id: "korea_south", regions: [R.prague], owner1936: "CSK" },
      { id: "taiwan", regions: [R.sudetenland], owner1936: "CSK" },
    ],
    claims: claimant ? [{ tag: "ITA", groups: ["taiwan"] }] : [],
    peace: [
      {
        loser: "CSK",
        lines: [
          {
            by: { tag: "GBR" },
            demands: [{ kind: "occupation_zone", group: "korea_south" }],
          },
          {
            by: { tag: "SUN" },
            demands: [{ kind: "occupation_zone", group: "korea_north" }],
          },
          {
            by: { tag: "ITA" },
            demands: [{ kind: "take_group", group: "taiwan" }],
          },
        ],
      },
    ],
  });
}
const NORTH = [R.slovakia, R.kosice];
const SOUTH = [R.prague];
const KOREA = [...NORTH, ...SOUTH];
const TAIWAN = R.sudetenland;

/** Britain (most war score, it holds Prague: the victor), the Soviet Union (Kosice), Italy. */
function beatCsk(g: Game, italy = true): Conference {
  return beat(g, "CSK", [
    ["GBR", 4000, [R.prague]],
    ["SUN", 3000, [R.kosice]],
    ...(italy ? [["ITA", 3000, []] as [CountryTag, number, number[]]] : []),
  ]);
}

const zones = (ds: { kind: number; regions: number[] }[]) =>
  ds
    .filter((d) => DEMAND_KINDS[d.kind] === "occupation_zone")
    .map((d) => [...d.regions].sort((a, b) => a - b));

describe("World War 1936 P5: Korea and Taiwan at the conference (spec §6.9)", () => {
  it("the 38th parallel: US and Soviet zones are always the AI default", async () => {
    // Historical AI off, then on with a seed whose roll drops both rows.
    for (const historicalAi of [false, true]) {
      usePoliticsContent(koreaFixture());
      const { g, ww, eg } = await atWar({ historicalAi });
      if (historicalAi) {
        const pol = ww.politics as unknown as { _seed: number };
        let seed = 1;
        while (
          keepsHistoryRow(seed, "CSK", id("GBR"), eg.nextConfId) ||
          keepsHistoryRow(seed, "CSK", id("SUN"), eg.nextConfId)
        ) {
          seed++;
        }
        pol._seed = seed;
      }
      const c = beatCsk(g);
      expect(zones(aiDemands(eg, c.id, id("SUN")))).toContainEqual(NORTH);
      expect(zones(aiDemands(eg, c.id, id("GBR")))).toContainEqual(SOUTH);
    }
  });

  it("a zone whose intended holder is absent goes to an earlier zone's holder", async () => {
    usePoliticsContent(koreaFixture());
    const { g, eg } = await atWar({ historicalAi: false });
    // No Soviet Union: Britain (the south's holder) takes the north too.
    const c = beat(g, "CSK", [
      ["GBR", 6000, [R.prague]],
      ["ITA", 4000, []],
    ]);
    const z = zones(aiDemands(eg, c.id, id("GBR")));
    expect(z).toContainEqual(SOUTH);
    expect(z).toContainEqual(NORTH);
    expect(zones(aiDemands(eg, c.id, id("ITA")))).not.toContainEqual(NORTH);
  });

  it("the AI never takes or annexes Korea", async () => {
    usePoliticsContent(koreaFixture());
    const { g, eg } = await atWar({ historicalAi: false });
    const c = beatCsk(g);
    for (const p of c.parts) {
      p.pts = 10_000;
      for (const d of aiDemands(eg, c.id, p.id)) {
        const k = DEMAND_KINDS[d.kind];
        expect(k).not.toBe("annex_rest");
        if (k === "occupation_zone") continue;
        for (const r of d.regions) expect(KOREA).not.toContain(r);
      }
    }
  });

  it("Taiwan goes to the country claiming it", async () => {
    usePoliticsContent(koreaFixture());
    const { runner, g, ww, eg } = await atWar({ historicalAi: false });
    const c = beatCsk(g);
    // Britain controls it (the victor), yet only Italy ("China") asks for it.
    expect(ww.land.controller[TAIWAN]).toBe(id("GBR"));
    const ita = aiDemands(eg, c.id, id("ITA"));
    expect(ita[0]).toMatchObject({ kind: 1, regions: [TAIWAN] });
    for (const tag of ["GBR", "SUN"] as const) {
      for (const d of aiDemands(eg, c.id, id(tag))) {
        expect(d.regions).not.toContain(TAIWAN);
      }
    }
    step(runner);
    expect(c.status).toBe(2);
    expect(ww.politics.legalOwner[TAIWAN]).toBe(id("ITA"));
    // Korea: zones, the legal owner unchanged.
    for (const r of KOREA) expect(ww.politics.legalOwner[r]).toBe(id("CSK"));
    expect(eg.zones.map((z) => z.region).sort((a, b) => a - b)).toEqual(
      [...KOREA].sort((a, b) => a - b),
    );
  });

  it("without a claimant Taiwan is only the main victor's occupation zone", async () => {
    usePoliticsContent(koreaFixture(false));
    const { g, eg } = await atWar({ historicalAi: false });
    const c = beatCsk(g, false);
    expect(zones(aiDemands(eg, c.id, id("GBR")))).toContainEqual([TAIWAN]);
    for (const d of aiDemands(eg, c.id, id("SUN"))) {
      expect(d.regions).not.toContain(TAIWAN);
    }
    const ctx = peaceCtx(eg, c);
    const plan = (p: CountryTag, kind: "take" | "occupation_zone") =>
      planPeaceDemand(
        ctx.facts,
        ctx.table,
        id(p),
        { kind, regions: [TAIWAN], target: 0, beneficiary: 0, k: 0, pct: 0 },
        () => true,
        ctx.sens,
      );
    expect(plan("GBR", "take")).toBe("claim_only");
    expect(plan("SUN", "occupation_zone")).toBe("claim_only");
    expect(plan("GBR", "occupation_zone")).toMatchObject({ all: [TAIWAN] });
  });

  it("a human is refused Korea and Taiwan the same way", async () => {
    usePoliticsContent(koreaFixture());
    const { runner, g, ww, eg } = await atWar({ historicalAi: false }, ["GBR"]);
    const c = beatCsk(g);
    const gbr = id("GBR");
    const tick = () => g.ticks();
    expect(
      submitDemands(
        eg,
        gbr,
        c.id,
        [{ kind: "take", region: R.prague }],
        tick(),
      ),
    ).toBe("bad_demand");
    expect(
      submitDemands(
        eg,
        gbr,
        c.id,
        [{ kind: "take_group", group: "korea_south" }],
        tick(),
      ),
    ).toBe("bad_demand");
    expect(
      submitDemands(eg, gbr, c.id, [{ kind: "take", region: TAIWAN }], tick()),
    ).toBe("bad_demand");
    // A zone is fine; an annexation of a Korea holder fails when it settles.
    expect(
      submitDemands(
        eg,
        gbr,
        c.id,
        [
          { kind: "occupation_zone", group: "korea_south" },
          { kind: "annex_rest", target: id("CSK") },
        ],
        tick(),
      ),
    ).toBeNull();
    const ctx = peaceCtx(eg, c);
    expect(
      planPeaceDemand(
        ctx.facts,
        ctx.table,
        gbr,
        {
          kind: "annex_rest",
          regions: [],
          target: id("CSK"),
          beneficiary: 0,
          k: 0,
          pct: 0,
        },
        () => true,
        ctx.sens,
      ),
    ).toBe("zone_only");
    while (c.round === 1 && c.status === 1) step(runner);
    const mine = c.lastRound.filter((x) => x.by === gbr);
    expect(mine.map((x) => [DEMAND_KINDS[x.kind], x.ok])).toEqual([
      ["occupation_zone", true],
      ["annex_rest", false],
    ]);
    for (const r of KOREA) expect(ww.politics.legalOwner[r]).toBe(id("CSK"));
  });
});
