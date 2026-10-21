// World War 1936 P5 (plan Task 2, lane W; spec §6): the peace conference
// on ww1936end — opening, points, rounds, control first, the snake order,
// human cards and the treaty.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  CS_GONE,
  PeaceDemand,
  WarLink,
  WW_PEACE_ROUND_TICKS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { participantPoints } from "@openfront/engine-lib/ww1936/EndgameRules";
import {
  expandPeaceDemand,
  type PeaceFacts,
  peacePlanCost,
  peaceRegionBlock,
  peaceSensitivity,
  type PeaceTable,
  planPeaceDemand,
} from "@openfront/engine-lib/ww1936/PeaceRules";
import type { Game, Player } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import {
  activateCountry,
  releasableTags,
} from "@openfront/engine/ww1936/endgame/Activate";
import {
  conferenceView,
  regionBase,
  submitDemands,
} from "@openfront/engine/ww1936/endgame/Conference";
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
import { END_MAP, order, step, stepTo, type WwHuman, wwRunner } from "./util";

// Lane X lists the tags a conference may free; the release test names SVK.
vi.mock("@openfront/engine/ww1936/endgame/Activate", async (original) => {
  const real =
    await original<
      typeof import("@openfront/engine/ww1936/endgame/Activate")
    >();
  return {
    ...real,
    releasableTags: vi.fn(real.releasableTags),
    activateCountry: vi.fn(real.activateCountry),
  };
});

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => {
  usePoliticsContent(null);
  vi.mocked(releasableTags).mockReset();
  vi.mocked(activateCountry).mockClear();
});

const R = END.region;
const id = (t: CountryTag) => endId(t);

interface Game5 {
  runner: GameRunner;
  g: Game;
  ww: WorldWar;
  eg: WwEndgame;
}

/** The end map past its preparation minute, `humans` playing their tags. */
async function atWar(humans: CountryTag[] = []): Promise<Game5> {
  const list: WwHuman[] = humans.map((t) => ({
    clientID: `H${t}`,
    country: t,
  }));
  const runner = await wwRunner({}, list, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { runner, g: runner.game, ww, eg: ww.endgame };
}

const player = (g: Game, tag: CountryTag): Player => {
  const p = g.playerBySmallID(id(tag));
  if (!p.isPlayer()) throw new Error(`no ${tag}`);
  return p;
};

function war(
  g: Game,
  a: CountryTag,
  b: CountryTag,
  link: WarLink = { kind: "declare" },
) {
  const ww = g.worldWar()!;
  expect(ww.setWar(id(a), id(b), g.ticks(), link)).toBe(true);
  return ww.endgame.war(ww.endgame.warOfPair(id(a), id(b)))!;
}

/**
 * `winners` (the first declares, the rest join its war) beat `loser`:
 * each gets its war score, controls the regions given, and the loser
 * capitulates. The conference it opened.
 */
function beat(
  t: Game5,
  loser: CountryTag,
  winners: [CountryTag, number, number[]][],
): Conference {
  const { g, ww, eg } = t;
  const w = war(g, winners[0][0], loser);
  for (const [tag] of winners.slice(1)) {
    war(g, tag, loser, { kind: "into", warId: w.id });
  }
  for (const [tag, ws, regions] of winners) {
    addWarScore(eg, w.id, id(tag), ws);
    for (const r of regions) ww.land.setController(r, id(tag), g.ticks());
  }
  const before = eg.conferences.length;
  capitulate(g, ww, player(g, loser), g.ticks());
  expect(eg.conferences).toHaveLength(before + 1);
  return eg.conferences[before];
}

const part = (c: Conference, tag: CountryTag) =>
  c.parts.find((p) => p.id === id(tag))!;

function submit(
  t: Game5,
  c: Conference,
  tag: CountryTag,
  demands: PeaceDemand[] | null,
): void {
  expect(submitDemands(t.eg, id(tag), c.id, demands, t.g.ticks())).toBeNull();
}

/** Runs until the conference's round `round` closed (or the conference ended). */
function closeRound(t: Game5, c: Conference): void {
  const round = c.round;
  for (let i = 0; i <= WW_PEACE_ROUND_TICKS + 2; i++) {
    if (c.status === 2 || c.round !== round) return;
    step(t.runner);
  }
  throw new Error("the round did not close");
}

describe("World War 1936 P5: the peace conference (spec §6)", () => {
  it("a lone capitulation opens a conference the same tick", async () => {
    const t = await atWar();
    const tick = t.g.ticks();
    const c = beat(t, "POL", [["DEU", 1000, [R.warsaw]]]);
    expect(c.openTick).toBe(tick);
    expect(c.status).toBe(1);
    expect(c.round).toBe(1);
    expect(c.roundEndTick).toBe(tick + WW_PEACE_ROUND_TICKS);
    expect(c.losers).toEqual([id("POL")]);
    expect(c.parts.map((p) => p.id)).toEqual([id("DEU")]);
    expect(c.stake).toEqual([R.warsaw, R.krakow]);
    expect(c.base).toEqual(c.stake.map((r) => regionBase(t.eg, r)));
    expect(c.ai.map((a) => a.id)).toEqual([id("DEU")]);
  });

  it("participants get points by war score share", async () => {
    const t = await atWar();
    const c = beat(t, "POL", [
      ["DEU", 7000, [R.warsaw]],
      ["SUN", 3000, []],
    ]);
    const total = c.base.reduce((a, b) => a + b, 0);
    expect(c.parts.map((p) => p.pts)).toEqual(
      participantPoints(total, [7000, 3000]),
    );
    expect(part(c, "DEU").pts).toBeGreaterThan(2 * part(c, "SUN").pts);
    const view = conferenceView(t.eg, c.id);
    expect(view.participants.map((p) => p.sharePm)).toEqual([700, 300]);
  });

  it("the controller wins a contested region", async () => {
    const t = await atWar(["DEU", "SUN"]);
    const c = beat(t, "POL", [
      ["DEU", 8000, [R.warsaw]],
      ["SUN", 2000, [R.krakow]],
    ]);
    // Germany goes first, but the Soviet Union controls Krakow.
    submit(t, c, "DEU", [{ kind: "take", region: R.krakow }]);
    submit(t, c, "SUN", [{ kind: "take", region: R.krakow }]);
    closeRound(t, c);
    expect(c.lastRound).toEqual([
      { by: id("DEU"), kind: 0, regions: [], target: 0, ok: false },
      { by: id("SUN"), kind: 0, regions: [R.krakow], target: 0, ok: true },
    ]);
    expect(
      c.settled.filter((s) => s.regions.includes(R.krakow)).map((s) => s.by),
    ).toEqual([id("SUN")]);
  });

  it("a reserved region fails for others even when its controller runs out of points", async () => {
    const t = await atWar(["DEU", "SUN"]);
    const c = beat(t, "POL", [
      ["DEU", 9999, [R.warsaw]],
      ["SUN", 1, [R.krakow]],
    ]);
    expect(part(c, "SUN").pts).toBe(0);
    const before = part(c, "DEU").pts;
    submit(t, c, "DEU", [{ kind: "take", region: R.krakow }]);
    submit(t, c, "SUN", [{ kind: "take", region: R.krakow }]);
    closeRound(t, c);
    expect(c.lastRound.map((x) => [x.by, x.ok])).toEqual([
      [id("DEU"), false],
      [id("SUN"), false],
    ]);
    expect(c.settled).toEqual([]);
    expect(part(c, "DEU").pts).toBe(before);
  });

  it("snake order flips every round", async () => {
    const t = await atWar(["DEU", "ITA"]);
    const c = beat(t, "CSK", [
      ["DEU", 6000, [R.prague]],
      ["ITA", 4000, []],
    ]);
    const order = () =>
      conferenceView(t.eg, c.id)
        .participants.slice()
        .sort((a, b) => a.order - b.order)
        .map((p) => p.id);
    expect(order()).toEqual([id("DEU"), id("ITA")]);
    submit(t, c, "DEU", [{ kind: "take", region: R.sudetenland }]);
    submit(t, c, "ITA", [{ kind: "take", region: R.slovakia }]);
    closeRound(t, c);
    expect(c.lastRound.map((x) => x.by)).toEqual([id("DEU"), id("ITA")]);
    expect(c.round).toBe(2);
    expect(order()).toEqual([id("ITA"), id("DEU")]);
    submit(t, c, "DEU", [{ kind: "take", region: R.kosice }]);
    submit(t, c, "ITA", [{ kind: "take", region: R.prague }]);
    closeRound(t, c);
    expect(c.lastRound.map((x) => x.by)).toEqual([id("ITA"), id("DEU")]);
  });

  it("an unanswered human card applies the shown AI demands at the deadline", async () => {
    const t = await atWar(["DEU"]);
    const c = beat(t, "POL", [["DEU", 1000, [R.warsaw]]]);
    const shown = conferenceView(t.eg, c.id).mine;
    expect(shown.map((m) => [m.id, m.submitted])).toEqual([[id("DEU"), null]]);
    expect(shown[0].ai.length).toBeGreaterThan(0);
    const ai = c.ai[0].demands.map((d) => [d.kind, d.slot]);
    stepTo(t.runner, c.roundEndTick - 1);
    expect(c.round).toBe(1);
    expect(c.status).toBe(1);
    closeRound(t, c);
    expect(c.lastRound.map((x) => [x.kind, x.by])).toEqual(
      ai.map(([k]) => [k, id("DEU")]),
    );
    expect(c.lastRound.some((x) => x.ok)).toBe(true);
  });

  it("a human pass uses nothing that round", async () => {
    const t = await atWar(["DEU"]);
    const c = beat(t, "POL", [
      ["DEU", 5000, [R.warsaw]],
      ["SUN", 5000, []],
    ]);
    const pts = part(c, "DEU").pts;
    submit(t, c, "DEU", null);
    closeRound(t, c);
    expect(part(c, "DEU").pts).toBe(pts);
    expect(c.lastRound.filter((x) => x.by === id("DEU"))).toEqual([]);
    expect(c.settled.filter((s) => s.by === id("DEU"))).toEqual([]);
  });

  it("all humans submitted closes the round on the next tick", async () => {
    const t = await atWar(["DEU"]);
    const c = beat(t, "POL", [["DEU", 1000, [R.warsaw]]]);
    const deadline = c.roundEndTick;
    step(t.runner, 1, [
      order("HDEU", {
        kind: "peace_submit",
        conf: c.id,
        demands: [{ kind: "take", region: R.warsaw }],
      }),
    ]);
    for (let i = 0; i < 3 && c.subs.length === 0; i++) step(t.runner);
    expect(c.subs.map((s) => s.id)).toEqual([id("DEU")]);
    expect(c.round).toBe(1);
    expect(c.roundEndTick).toBeLessThan(deadline);
    expect(c.roundEndTick).toBeLessThanOrEqual(t.g.ticks() + 1);
    step(t.runner);
    expect(c.round === 2 || c.status === 2).toBe(true);
    expect(c.lastRound).toEqual([
      { by: id("DEU"), kind: 0, regions: [R.warsaw], target: 0, ok: true },
    ]);
  });

  it("regions nobody took return to the loser, which comes back to life", async () => {
    const t = await atWar(["DEU"]);
    const { ww, eg } = t;
    const [deu, pl] = [id("DEU"), id("POL")];
    const c = beat(t, "POL", [["DEU", 1000, [R.warsaw]]]);
    expect(ww.land.controller[R.krakow]).toBe(deu);
    submit(t, c, "DEU", [{ kind: "take", region: R.warsaw }]);
    closeRound(t, c);
    expect(c.status).toBe(1);
    submit(t, c, "DEU", null);
    closeRound(t, c);
    expect(c.status).toBe(2);
    expect(c.doneDay).toBe(ww.day(t.g.ticks()));
    expect(ww.politics.legalOwner[R.warsaw]).toBe(deu);
    expect(ww.land.controller[R.warsaw]).toBe(deu);
    expect(ww.politics.legalOwner[R.krakow]).toBe(pl);
    expect(ww.land.controller[R.krakow]).toBe(pl);
    expect(eg.countryState(pl)).toBe("active");
    expect(ww.isCapitulated(pl)).toBe(false);
    expect(eg.isActor(pl)).toBe(true);
    expect(eg.peaceLog[0].losers).toEqual([pl]);
    expect(eg.peaceLog[0].lines).toEqual([
      {
        key: "ww1936.peace.line.take",
        params: {
          who: "DEU",
          whoTag: "DEU",
          loser: "POL",
          loserTag: "POL",
          n: 1,
          regions: String(R.warsaw),
          region: R.warsaw,
        },
      },
    ]);
  });

  it("an occupation zone keeps control until the end", async () => {
    const t = await atWar(["DEU"]);
    const { ww, eg } = t;
    const [deu, pl] = [id("DEU"), id("POL")];
    const c = beat(t, "POL", [["DEU", 1000, [R.warsaw]]]);
    submit(t, c, "DEU", [{ kind: "occupation_zone", region: R.krakow }]);
    closeRound(t, c);
    submit(t, c, "DEU", null);
    closeRound(t, c);
    expect(c.status).toBe(2);
    expect(eg.zones).toEqual([{ region: R.krakow, holder: deu, untilDay: -1 }]);
    expect(ww.land.controller[R.krakow]).toBe(deu);
    expect(ww.politics.legalOwner[R.krakow]).toBe(pl);
    // Poland lives again on Warsaw; the zone stays Germany's days later.
    expect(ww.land.controller[R.warsaw]).toBe(pl);
    stepTo(t.runner, t.g.ticks() + 3 * 300);
    expect(ww.land.controller[R.krakow]).toBe(deu);
    expect(eg.isZone(R.krakow)).toBe(true);
  });

  it("a release wakes a dormant tag with its cores", async () => {
    const t = await atWar(["DEU"]);
    const { ww, eg } = t;
    const [deu, svk] = [id("DEU"), id("SVK")];
    vi.mocked(releasableTags).mockImplementation((_e, stake) =>
      stake.includes(R.slovakia) ? ["SVK"] : [],
    );
    expect(eg.countryState(svk)).toBe("dormant");
    const c = beat(t, "CSK", [["DEU", 1000, [R.prague]]]);
    submit(t, c, "DEU", [{ kind: "release", tag: "SVK" }]);
    closeRound(t, c);
    submit(t, c, "DEU", null);
    closeRound(t, c);
    expect(c.status).toBe(2);
    expect(activateCountry).toHaveBeenCalledWith(
      eg,
      "SVK",
      expect.objectContaining({
        regions: [R.slovakia, R.kosice],
        overlord: { smallID: deu, level: "puppet" },
        equipFrom: deu,
        techFrom: deu,
        faction: "overlord",
      }),
      expect.any(Number),
    );
    for (const r of [R.slovakia, R.kosice]) {
      expect(ww.politics.legalOwner[r]).toBe(svk);
      expect(ww.land.controller[r]).toBe(svk);
    }
    expect(eg.countryState(svk)).toBe("active");
    expect(eg.peaceLog[0].lines.map((l) => l.key)).toContain(
      "ww1936.peace.line.release",
    );
  });

  it("an AI-only conference finishes within one tick", async () => {
    const t = await atWar();
    const c = beat(t, "POL", [["DEU", 1000, [R.warsaw]]]);
    expect(c.status).toBe(1);
    step(t.runner);
    expect(c.status).toBe(2);
    expect(c.doneDay).toBe(t.ww.day(t.g.ticks()));
    expect(t.eg.peaceLog[0].losers).toEqual([id("POL")]);
  });

  it("the victory-point tile follows control when the treaty applies", async () => {
    const t = await atWar(["DEU", "SUN"]);
    const { g, ww } = t;
    const c = beat(t, "POL", [
      ["DEU", 9000, [R.warsaw]],
      ["SUN", 1000, [R.krakow]],
    ]);
    const krakow = ww.scenario.region(R.krakow)!;
    const tile = ww.scenario.vpTile(krakow);
    expect(g.ownerID(tile)).toBe(id("SUN"));
    submit(t, c, "DEU", [{ kind: "take", region: R.krakow }]);
    submit(t, c, "SUN", null);
    closeRound(t, c);
    submit(t, c, "DEU", null);
    submit(t, c, "SUN", null);
    closeRound(t, c);
    expect(c.status).toBe(2);
    expect(ww.politics.legalOwner[R.krakow]).toBe(id("DEU"));
    expect(g.ownerID(tile)).toBe(id("DEU"));
  });

  it("a participant that stopped playing settles nothing and the treaty ignores it", async () => {
    const t = await atWar(["DEU", "ITA"]);
    const { ww, eg } = t;
    const [deu, ita, csk] = [id("DEU"), id("ITA"), id("CSK")];
    ww.land.setController(R.slovakia, ita, t.g.ticks());
    const c = beat(t, "CSK", [
      ["DEU", 6000, [R.prague]],
      ["ITA", 4000, []],
    ]);
    // Round 1: both settle (Italy: Slovakia as its occupation zone).
    submit(t, c, "DEU", [{ kind: "take", region: R.sudetenland }]);
    submit(t, c, "ITA", [{ kind: "occupation_zone", region: R.slovakia }]);
    closeRound(t, c);
    expect(c.round).toBe(2);
    expect(c.settled.map((s) => s.by)).toEqual([deu, ita]);
    // Italy stops playing in round 2: no AI demands, nothing settles for it.
    eg.setCountryState(ita, CS_GONE);
    submit(t, c, "ITA", [{ kind: "take", region: R.kosice }]);
    submit(t, c, "DEU", null);
    closeRound(t, c);
    expect(c.status).toBe(2);
    expect(c.lastRound.filter((x) => x.by === ita)).toEqual([]);
    // Its zone is ignored: Slovakia is Czechoslovakia's again.
    expect(eg.zones).toEqual([]);
    expect(ww.land.controller[R.slovakia]).toBe(csk);
    expect(ww.politics.legalOwner[R.sudetenland]).toBe(deu);
    expect(eg.peaceLog[0].lines.map((l) => l.params.who)).toEqual(["DEU"]);
  });

  it("a puppet, disarmament and a demilitarised region apply to the loser that lives on", async () => {
    const t = await atWar(["DEU"]);
    const { ww, eg } = t;
    const [deu, pl] = [id("DEU"), id("POL")];
    const c = beat(t, "POL", [["DEU", 1000, [R.warsaw]]]);
    submit(t, c, "DEU", [
      { kind: "puppet", target: pl },
      { kind: "disarm", target: pl },
      { kind: "demilitarise", region: R.warsaw },
      // After the puppet settled, the rest stays the puppet's.
      { kind: "take", region: R.krakow },
    ]);
    closeRound(t, c);
    expect(c.lastRound.map((x) => x.ok)).toEqual([true, true, true, false]);
    submit(t, c, "DEU", null);
    closeRound(t, c);
    expect(c.status).toBe(2);
    expect(eg.countryState(pl)).toBe("active");
    expect(eg.subjectOf(pl)).toMatchObject({ overlord: deu, level: "puppet" });
    expect(eg.disarm.map(([x]) => x)).toEqual([pl]);
    expect(eg.dmz).toEqual([[R.warsaw, pl]]);
    expect(ww.politics.legalOwner[R.krakow]).toBe(pl);
  });

  it("the card's view lists what settled, in order, and the main victor", async () => {
    const t = await atWar(["DEU"]);
    const c = beat(t, "POL", [["DEU", 1000, [R.warsaw]]]);
    submit(t, c, "DEU", [{ kind: "take", region: R.warsaw }]);
    closeRound(t, c);
    const view = conferenceView(t.eg, c.id);
    expect(view.mainVictor).toBe(id("DEU"));
    expect(view.settled).toEqual([
      {
        round: 1,
        by: id("DEU"),
        kind: "take",
        target: id("POL"),
        beneficiary: id("DEU"),
        regions: [R.warsaw],
        k: 0,
        pct: 0,
        cost: c.settled[0].cost,
      },
    ]);
    expect(c.settled[0].cost).toBeGreaterThan(0);
  });

  it("a human conference waits in the queue while another is open", async () => {
    const t = await atWar(["DEU"]);
    const a = beat(t, "POL", [["DEU", 1000, [R.warsaw]]]);
    const b = beat(t, "LTU", [["DEU", 1000, [R.kaunas]]]);
    expect([a.status, b.status]).toEqual([1, 0]);
    submit(t, a, "DEU", null);
    expect(submitDemands(t.eg, id("DEU"), b.id, null, t.g.ticks())).toBe(
      "conference_closed",
    );
    closeRound(t, a);
    expect(a.status).toBe(2);
    expect(b.status).toBe(1);
    expect(b.round).toBe(1);
    expect(b.roundEndTick).toBeGreaterThan(t.g.ticks());
  });
});

describe("World War 1936 P5: the demand rules the card shares (engine-lib PeaceRules)", () => {
  // Loser 9 with regions 1–3 (2 borders participant 5's region 4); 5 and 6 win.
  const facts: PeaceFacts = {
    controller: (r) => (r === 1 ? 5 : r === 2 ? 6 : 9),
    legalOwner: (r) => (r === 4 ? 5 : 9),
    hasCore: (who, r) => who === 6 && r === 3,
    neighbours: (r) => (r === 2 ? [4] : r === 4 ? [2] : []),
    regionCivs: () => 4,
    ledFactionSize: () => 0,
    ships: () => [
      { id: 11, w: 30 },
      { id: 12, w: 10 },
    ],
  };
  const table: PeaceTable = {
    stake: [1, 2, 3],
    base: [40, 20, 10],
    losers: [9],
    parts: [{ id: 5 }, { id: 6 }],
    claims: [],
    conquer: [],
    topple: [],
    settled: [],
  };
  /** No Korea or Taiwan here. */
  const none = peaceSensitivity(() => [], 0, 5, []);
  const free = () => true;
  const d = (o: Partial<Parameters<typeof planPeaceDemand>[3]>) => ({
    kind: "take" as const,
    regions: [],
    target: 0,
    beneficiary: 0,
    k: 0,
    pct: 0,
    ...o,
  });
  const plan = (
    p: number,
    o: Partial<Parameters<typeof planPeaceDemand>[3]>,
    s = none,
    t = table,
    ok: (r: number) => boolean = free,
  ) => planPeaceDemand(facts, t, p, d(o), ok, s);

  it("prices and reasons match the engine's", () => {
    // Control halves, another participant's control doubles.
    const take = plan(5, { regions: [1, 2] });
    expect(take).toEqual({
      each: [
        [1, 20],
        [2, 40],
      ],
    });
    expect(peacePlanCost(take as Exclude<typeof take, string>)).toBe(60);
    expect(plan(5, { kind: "take_for", regions: [3], beneficiary: 6 })).toEqual(
      { each: [[3, 5]] },
    );
    expect(plan(5, { kind: "take_for", regions: [1], beneficiary: 6 })).toBe(
      "no_core",
    );
    expect(
      plan(
        6,
        { kind: "occupation_zone", regions: [3] },
        none,
        table,
        (r) => r === 3,
      ),
    ).toBe("not_adjacent");
    expect(plan(5, { kind: "dismantle", target: 9 })).toBe("no_faction");
    // A quarter of 12 civilian factories: 3 at most.
    expect(plan(5, { kind: "reparations", target: 9, k: 4 })).toBe(
      "no_factories",
    );
    // Half the fleet's weight (20 of 40): the 10 fits, the 30 does not.
    expect(plan(5, { kind: "take_navy", target: 9, pct: 50 })).toEqual({
      all: [12],
      cost: 20,
      receiver: 5,
    });
    expect(
      plan(5, { kind: "puppet", target: 9 }, none, table, () => false),
    ).toBe("no_target");
  });

  it("a puppet keeps the loser's other regions; a fleet goes over once", () => {
    const after: PeaceTable = {
      ...table,
      settled: [
        { kind: 5, by: 6, target: 9, k: 0, regions: [] }, // puppet
        { kind: 13, by: 5, target: 9, k: 0, regions: [12] }, // take_navy
      ],
    };
    expect(plan(5, { regions: [1, 3] }, none, after)).toBe("no_target");
    expect(
      plan(5, { kind: "take_navy", target: 9, pct: 50 }, none, after),
    ).toBe("already_used");
    expect(
      plan(6, { kind: "take_navy", target: 9, pct: 50 }, none, after),
    ).toBe("no_ships");
  });

  it("Korea is only ever an occupation zone; Taiwan only its claimant's", () => {
    // Region 1 is "Korea", region 3 "Taiwan"; 7 is "Japan" (excluded).
    const groups = (g: string) =>
      g === "korea_north" ? [1] : g === "taiwan" ? [3] : [];
    const s = peaceSensitivity(groups, 7, 5, []);
    // 6 holds Taiwan's static claim (CLAIMS).
    const sClaim = peaceSensitivity(groups, 7, 5, [6]);
    const rb = (
      p: number,
      kind: Parameters<typeof peaceRegionBlock>[4],
      r: number,
      sens = s,
      recv = p,
      t = table,
    ) => peaceRegionBlock(sens, t, p, recv, kind, r);
    // Korea: a zone for anyone but Japan; nothing else, for nobody.
    expect(rb(5, "occupation_zone", 1)).toBeNull();
    expect(rb(7, "occupation_zone", 1)).toBe("zone_only");
    for (const k of [
      "take",
      "take_group",
      "take_for",
      "annex_rest",
      "release",
      "demilitarise",
    ] as const) {
      expect(rb(5, k, 1)).toBe("zone_only");
    }
    expect(plan(5, { regions: [1] }, s)).toBe("zone_only");
    expect(plan(5, { kind: "annex_rest", target: 9 }, s)).toBe("zone_only");
    // Taiwan with a claimant (6): only 6 takes it, by any take; nobody else.
    expect(rb(6, "take", 3, sClaim)).toBeNull();
    expect(rb(5, "take_for", 3, sClaim, 6)).toBeNull();
    expect(rb(5, "take", 3, sClaim)).toBe("claim_only");
    expect(rb(5, "occupation_zone", 3, sClaim)).toBe("claim_only");
    expect(plan(5, { regions: [3] }, sClaim)).toBe("claim_only");
    // Without a claimant: the main victor's (5) zone only; never Japan.
    expect(rb(5, "occupation_zone", 3)).toBeNull();
    expect(rb(6, "occupation_zone", 3)).toBe("claim_only");
    expect(rb(5, "take", 3)).toBe("claim_only");
    expect(rb(7, "take", 3, peaceSensitivity(groups, 7, 5, [7]))).toBe(
      "claim_only",
    );
    // A war-goal claim (the conference's claims list) makes no claimant.
    const goal: PeaceTable = { ...table, claims: [[6, 3]] };
    expect(rb(6, "take", 3, s, 6, goal)).toBe("claim_only");
    expect(rb(6, "occupation_zone", 3, s, 6, goal)).toBe("claim_only");
    // Another region: no rule.
    expect(rb(5, "take", 2)).toBeNull();
    // A human's wire demand on Korea is refused (bad_demand), a group skips it.
    const x = {
      groupRegions: (g: string) => (g === "g" ? [1, 2] : []),
      releasable: [] as CountryTag[],
      smallIdOf: () => 0,
      hasCore: facts.hasCore,
      sensitivity: s,
    };
    expect(
      expandPeaceDemand(table, 5, { kind: "take", region: 1 }, x),
    ).toBeNull();
    expect(
      expandPeaceDemand(table, 5, { kind: "take_group", group: "g" }, x),
    ).toMatchObject({ regions: [2] });
    expect(
      expandPeaceDemand(table, 5, { kind: "occupation_zone", region: 1 }, x),
    ).toMatchObject({ regions: [1] });
  });

  it("a wire demand is spelled out or refused as the engine does", () => {
    const x = {
      groupRegions: (g: string) => (g === "g" ? [2, 3, 8] : []),
      releasable: [] as CountryTag[],
      smallIdOf: () => 0,
      hasCore: facts.hasCore,
      sensitivity: none,
    };
    expect(
      expandPeaceDemand(table, 5, { kind: "take_group", group: "g" }, x),
    ).toMatchObject({ kind: "take_group", regions: [2, 3] });
    expect(
      expandPeaceDemand(table, 5, { kind: "take", region: 8 }, x),
    ).toBeNull();
    expect(
      expandPeaceDemand(
        table,
        5,
        { kind: "take_for", region: 3, beneficiary: 5 },
        x,
      ),
    ).toBeNull();
    expect(
      expandPeaceDemand(
        table,
        5,
        { kind: "occupation_zone", group: "g", region: 2 },
        x,
      ),
    ).toBeNull();
    expect(
      expandPeaceDemand(table, 5, { kind: "release", tag: "SVK" }, x),
    ).toBeNull();
    expect(
      expandPeaceDemand(table, 5, { kind: "take_navy", target: 9, pct: 30 }, x),
    ).toMatchObject({ target: 9, pct: 30 });
  });
});
