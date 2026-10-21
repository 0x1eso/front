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
import type { Game, Player } from "@openfront/engine/game/Game";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import { releasableTags } from "@openfront/engine/ww1936/endgame/Activate";
import {
  priceOf,
  regionCost,
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
import { endgameFixture } from "./endgameFixture";
import { END_MAP, stepTo, wwRunner } from "./util";

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
): Promise<{ g: Game; ww: WorldWar; eg: WwEndgame }> {
  const runner = await wwRunner(config, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { g: runner.game, ww, eg: ww.endgame };
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
    const c = beat(g, "CSK", [
      ["DEU", 1000, [R.sudetenland, R.prague, R.slovakia, R.kosice]],
    ]);
    const deu = c.parts[0];
    deu.pts = 10_000;
    const ai = aiDemands(eg, c.id, deu.id);
    expect(kinds(ai)).not.toContain("take");
    const groups = ai.filter((d) => DEMAND_KINDS[d.kind] === "take_group");
    // Several regions, one slot (in the AI's order, each once).
    expect(groups).toHaveLength(1);
    expect(groups[0].regions.length).toBeGreaterThanOrEqual(2);
    expect(new Set(groups[0].regions).size).toBe(groups[0].regions.length);
    expect(ai.map((d) => d.slot)).toEqual(ai.map((_, i) => i));
  });
});
