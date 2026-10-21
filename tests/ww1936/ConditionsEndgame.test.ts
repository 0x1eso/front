// World War 1936 P5 (plan Task 8, spec §16.4): every endgame condition, a
// true and a false case each, on the end map (ww1936end) with the end
// fixture; `who` follows the P3 rule.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { LeafCondition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { RegionGroupDef } from "@openfront/engine-lib/ww1936/content/types";
import { makeSubject } from "@openfront/engine/ww1936/endgame/Subjects";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import { vi } from "vitest";
import { endId } from "./endFixture";
import { END_GROUPS, endgameFixture } from "./endgameFixture";
import { END_MAP, stepTo, takeRegion, wwRunner } from "./util";

// W's share is a stub until lane W merges: 40% for Germany against Poland.
vi.mock("@openfront/engine/ww1936/endgame/Wars", async (original) => {
  const real =
    await original<typeof import("@openfront/engine/ww1936/endgame/Wars")>();
  return {
    ...real,
    warScoreShare: vi.fn((_eg: unknown, id: number, of: number) =>
      id === endId("DEU") && of === endId("POL") ? 400 : 0,
    ),
  };
});

const GROUPS: RegionGroupDef[] = [
  ...END_GROUPS,
  { id: "t_poland", regions: [6, 7], owner1936: "POL" },
  { id: "t_lyon", regions: [2], owner1936: "FRA" },
];

beforeEach(() => usePoliticsContent(endgameFixture({ groups: GROUPS })));
afterEach(() => usePoliticsContent(null));

const T = (tag: CountryTag) => ({ tag });

/**
 * The end map with: Poland in exile in Britain (legitimacy 50%), Germany
 * holding Warsaw (resistance 40%, compliance 30%), Czechoslovakia a German
 * puppet (autonomy 30%), an open conference on Poland with Germany.
 */
async function world() {
  const runner = await wwRunner({}, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  const eg = ww.endgame;
  const [deu, pl, gbr, csk] = ["DEU", "POL", "GBR", "CSK"].map((t) =>
    endId(t as CountryTag),
  );
  takeRegion(g, 6, "DEU");
  eg.resBp[6] = 4000;
  eg.compBp[6] = 3000;
  ww.addCapitulation(pl, deu, g.ticks());
  eg.exiles.push({
    smallID: pl,
    host: gbr,
    legitBp: 5000,
    sinceDay: 0,
    zeroDays: 0,
    lastDelta: 0,
    faction: -1,
    capital: 6,
  });
  eg.rebuildDerived();
  makeSubject(eg, csk, deu, "puppet", false, g.ticks());
  eg.subjects[eg.subjectIdx.get(csk)!].autBp = 3000;
  eg.conferences.push({
    id: 1,
    warIds: [],
    losers: [pl],
    stake: [6, 7],
    base: [],
    parts: [{ id: deu, wsMilli: 0, pts: 0, human: false }],
    claims: [],
    conquer: [],
    topple: [],
    status: 1,
    doneDay: -1,
    round: 0,
    roundEndTick: 0,
    openTick: g.ticks(),
    subs: [],
    ai: [],
    settled: [],
    lastRound: [],
  });
  /** The condition for `self` (the P3 rule's default `who`). */
  const holds = (self: CountryTag, c: LeafCondition) =>
    evalCondition(makeCtx(ww.politics, endId(self), 0, 0, g.ticks()), c);
  return { holds };
}

describe("World War 1936 P5: endgame conditions", { timeout: 60_000 }, () => {
  it("each condition has a true and a false case", async () => {
    const { holds } = await world();
    const pairs: [CountryTag, LeafCondition, boolean][] = [
      ["POL", { kind: "is_exile" }, true],
      ["DEU", { kind: "is_exile" }, false],
      // `who`: about Poland, asked by Germany.
      ["DEU", { kind: "is_exile", who: T("POL") }, true],
      ["POL", { kind: "exile_host", of: T("GBR") }, true],
      ["POL", { kind: "exile_host", of: T("FRA") }, false],
      ["CSK", { kind: "is_subject" }, true],
      ["AUT", { kind: "is_subject" }, false],
      ["CSK", { kind: "subject_of", of: T("DEU") }, true],
      ["CSK", { kind: "subject_of", of: T("ITA") }, false],
      // Index order (integrated 0 … dominion 3): a puppet is ≥ puppet, not ≥ colony.
      ["CSK", { kind: "subject_level_ge", level: "puppet" }, true],
      ["CSK", { kind: "subject_level_ge", level: "colony" }, false],
      ["AUT", { kind: "subject_level_ge", level: "integrated" }, false],
      ["CSK", { kind: "autonomy_ge", pct: 30 }, true],
      ["CSK", { kind: "autonomy_ge", pct: 31 }, false],
      ["DEU", { kind: "country_state", tag: "SVK", state: "dormant" }, true],
      ["DEU", { kind: "country_state", tag: "SVK", state: "active" }, false],
      ["DEU", { kind: "occupied_by", group: "warsaw", of: "self" }, true],
      ["DEU", { kind: "occupied_by", group: "warsaw", of: T("SUN") }, false],
      ["DEU", { kind: "resistance_ge", group: "t_poland", pct: 40 }, true],
      ["DEU", { kind: "resistance_ge", group: "t_poland", pct: 41 }, false],
      ["DEU", { kind: "compliance_ge", group: "t_poland", pct: 30 }, true],
      ["DEU", { kind: "compliance_ge", group: "t_poland", pct: 31 }, false],
      // No administered region in the group: false.
      ["DEU", { kind: "resistance_ge", group: "east_poland", pct: 0 }, false],
      ["DEU", { kind: "war_score_share_ge", of: T("POL"), pct: 40 }, true],
      ["DEU", { kind: "war_score_share_ge", of: T("POL"), pct: 41 }, false],
      ["DEU", { kind: "in_conference" }, true],
      ["POL", { kind: "in_conference" }, true],
      ["SUN", { kind: "in_conference" }, false],
      ["POL", { kind: "legitimacy_ge", pct: 50 }, true],
      ["POL", { kind: "legitimacy_ge", pct: 51 }, false],
      ["DEU", { kind: "legitimacy_ge", pct: 0 }, false],
      // Berlin borders Warsaw; France holds nothing next to it.
      ["DEU", { kind: "borders_group", group: "warsaw" }, true],
      ["FRA", { kind: "borders_group", group: "warsaw" }, false],
      // Italy touches Lyon by land; Britain only across the strait.
      ["ITA", { kind: "borders_group", group: "t_lyon" }, true],
      ["GBR", { kind: "borders_group", group: "t_lyon" }, false],
    ];
    for (const [self, c, want] of pairs) {
      expect(holds(self, c), `${self} ${JSON.stringify(c)}`).toBe(want);
    }
  });
});
