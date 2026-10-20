// World War 1936 P3 (spec §5.2–§5.8; controller rulings R6, R7, R8):
// drift, elections, regime crises and changes of government, on the test
// map ww1936pol with the test content.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  IDEO_NEU,
  WW_ELECTION_DAYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { GENERIC_EVENTS } from "@openfront/engine-lib/ww1936/content/events/generic";
import type { ContentParts } from "@openfront/engine-lib/ww1936/content/registry";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { leaveFaction } from "@openfront/engine/ww1936/politics/Factions";
import {
  civilWar,
  dailyIdeology,
  fitsFaction,
  governmentLeader,
  resolveIdeology,
  setGovernment,
  setLeader,
} from "@openfront/engine/ww1936/politics/Ideology";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  pol,
  POL,
  step,
  stepTo,
  wwGameStart,
  wwRunner,
} from "./util";

// Lane D writes leaveFaction; here it is watched (and still runs).
vi.mock(
  "@openfront/engine/ww1936/politics/Factions",
  async (importOriginal) => {
    const orig =
      await importOriginal<
        typeof import("@openfront/engine/ww1936/politics/Factions")
      >();
    return { ...orig, leaveFaction: vi.fn(orig.leaveFaction) };
  },
);

const ELECTION = GENERIC_EVENTS.find((e) => e.id === "gen_election")!;
const EXTRA: Partial<ContentParts> = {
  events: [
    ELECTION,
    {
      id: "gbr_election_1937",
      kind: "country",
      options: [{ id: "a", ai: { base: 1 }, effects: [] }],
    },
    {
      // A dated own election (like Britain's 1945 one).
      id: "fra_election_1936",
      kind: "country",
      date: { on: "1936-01-10", to: ["FRA"] },
      options: [{ id: "a", ai: { base: 1 }, effects: [] }],
    },
  ],
  spirits: [
    {
      id: "t_drift",
      stats: { driftDemBp: 11, driftComBp: 7, driftFasBp: -3, driftNeuBp: -9 },
      icon: "flag",
    },
    {
      id: "t_no_votes",
      stats: {},
      icon: "flag",
      rules: ["no_elections"],
    },
    {
      id: "gen_civil_strife",
      stats: { outputPct: -20, constructionPct: -20 },
      icon: "flag",
    },
  ],
  persons: [
    {
      id: "t_fra_dem",
      nameKey: "ww1936.person.t_fra_dem",
      country: "FRA",
      roles: ["advisor"],
      advisor: { slot: "political", traits: ["administrator"] },
      ideology: "democratic",
      source: "test",
    },
    {
      id: "t_pol_gone",
      nameKey: "ww1936.person.t_pol_gone",
      country: "POL",
      roles: ["leader"],
      ideology: "democratic",
      until: "1936-01-05",
      source: "test",
    },
    {
      id: "t_pol_fas",
      nameKey: "ww1936.person.t_pol_fas",
      country: "POL",
      roles: ["leader"],
      ideology: "fascist",
      source: "test",
    },
  ],
  countries: [
    {
      tag: "POL",
      ruling: "neutral",
      popularity: [25, 5, 10, 60],
      stability: 50,
      warSupport: 50,
      tree: "generic",
      leaders: { democratic: "t_pol_gone", fascist: "t_pol_fas" },
    },
  ],
};

beforeEach(() => {
  usePoliticsContent(politicsFixture(EXTRA));
  vi.mocked(leaveFaction).mockClear();
});
afterEach(() => usePoliticsContent(null));

function afterDay(runner: GameRunner, id: number, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + (id % WW_DAY_SPLIT) + 1);
}

async function game(human: CountryTag) {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: human }], POL);
  step(runner);
  const g = runner.game;
  const p = pol(g);
  const id = (t: CountryTag) => byTag(g, t).smallID();
  return { runner, g, p, id };
}

const sum = (pop: number[]) => pop.reduce((a, b) => a + b, 0);

describe("ideology", () => {
  it("drift keeps the sum", async () => {
    const { g, p, id } = await game("DEU");
    const deu = id("DEU");
    const c = p.country(deu)!;
    c.spirits.push({ id: "t_drift", untilDay: -1, addedDay: 0 });
    p.recomputeStats(deu);
    // Out of the crisis's reach: the drift alone.
    c.crisisCooldownUntil = 1_000_000;
    for (let d = 0; d < 365; d++) {
      dailyIdeology(p, deu, d, g.ticks());
      expect(sum(c.pop), `day ${d}`).toBe(10_000);
      expect(Math.min(...c.pop), `day ${d}`).toBeGreaterThanOrEqual(0);
    }
    p.flushEvents(g.ticks());
    // Democracy and communism grew, the others shrank.
    expect(c.pop[IDEO_DEM]).toBeGreaterThan(1500);
    expect(c.pop[IDEO_COM]).toBeGreaterThan(1000);
    expect(c.pop[IDEO_NEU]).toBeLessThan(5500);
  });

  it("elections change government only above 50%", async () => {
    const { runner, g, p, id } = await game("GBR");
    const gbr = id("GBR");
    const c = p.country(gbr)!;
    const queued = vi.spyOn(p, "queueEvent");
    c.ruling = IDEO_DEM;
    c.pop = [5500, 1500, 1000, 2000];
    c.nextElectionDay = 3;
    afterDay(runner, gbr, 2);
    expect(queued).not.toHaveBeenCalledWith("gen_election", gbr, gbr, 0, 0);
    afterDay(runner, gbr, 3);
    expect(queued).toHaveBeenCalledWith("gen_election", gbr, gbr, 0, 0);
    expect(c.nextElectionDay).toBe(3 + WW_ELECTION_DAYS);
    // The event's options (lane E applies the one picked): 55% democrats.
    const ctx = makeCtx(p, gbr, gbr, 0, g.ticks());
    const open = () =>
      ELECTION.options
        .filter((o) => evalCondition(ctx, o.available))
        .map((o) => o.id);
    expect(open()).toEqual(["a"]);
    applyEffects(ctx, ELECTION.options[0].effects);
    expect(c.ruling).toBe(IDEO_DEM);
    // 60% communists: "accept the result" puts them in power.
    c.pop = [3000, 6000, 500, 500];
    expect(open()).toEqual(["b", "c"]);
    applyEffects(ctx, ELECTION.options[1].effects);
    expect(c.ruling).toBe(IDEO_COM);
    expect(c.leader).toBe("title:leader_communist");
    // 40% democrats, nobody above half: a coalition, the government stays.
    c.ruling = IDEO_DEM;
    c.pop = [4000, 3000, 1000, 2000];
    expect(open()).toEqual(["d"]);
  });

  it("a country's own election event replaces the generic one", async () => {
    const { runner, p, id } = await game("GBR");
    const gbr = id("GBR");
    const c = p.country(gbr)!;
    const queued = vi.spyOn(p, "queueEvent");
    c.ruling = IDEO_DEM;
    c.pop = [6000, 1000, 1000, 2000];
    const d1937 = dayOfDate("1937-01-01");
    c.nextElectionDay = 4;
    afterDay(runner, gbr, 4);
    // 1936: no gbr_election_1936 in the content, the generic event.
    expect(queued).toHaveBeenLastCalledWith("gen_election", gbr, gbr, 0, 0);
    c.nextElectionDay = d1937 + 2;
    afterDay(runner, gbr, d1937 + 2);
    expect(queued).toHaveBeenLastCalledWith(
      "gbr_election_1937",
      gbr,
      gbr,
      0,
      0,
    );
  }, 60_000);

  it("a dated own election event is that year's election (spec §5.4)", async () => {
    const { runner, g, p, id } = await game("FRA");
    const ww = g.worldWar()!;
    const [fra, pl] = [id("FRA"), id("POL")];
    const c = p.country(fra)!;
    const queued = vi.spyOn(p, "queueEvent");
    const msg = vi.spyOn(g, "displayMessage");
    const elections = () =>
      msg.mock.calls.filter((x) => x[0] === "events_display.ww1936_election")
        .length;
    // France suspended its elections during a war; the next one is overdue.
    c.ruling = IDEO_DEM;
    c.nextElectionDay = 2;
    c.electionsSuspended = true;
    ww.setWar(fra, pl, g.ticks());
    afterDay(runner, fra, 8);
    expect(elections()).toBe(0);
    // 1936-01-10 (day 9): the dated event fires and counts as the election.
    afterDay(runner, fra, 9);
    expect(queued).toHaveBeenCalledWith("fra_election_1936", fra, fra, 0, 0);
    expect(c.nextElectionDay).toBe(9 + WW_ELECTION_DAYS);
    expect(elections()).toBe(1);
    // Peace the next day: the suspension lifts, and no second election.
    ww.endWar(fra, pl);
    afterDay(runner, fra, 11);
    expect(c.electionsSuspended).toBe(false);
    expect(queued.mock.calls.map((x) => x[0])).not.toContain("gen_election");
    expect(elections()).toBe(1);
  });

  it("suspended elections never fire", async () => {
    const { runner, g, p, id } = await game("GBR");
    const ww = g.worldWar()!;
    const [gbr, fra, pl] = [id("GBR"), id("FRA"), id("POL")];
    const queued = vi.spyOn(p, "queueEvent");
    const elections = () =>
      queued.mock.calls.filter((x) => x[0] === "gen_election").map((x) => x[1]);
    for (const x of [gbr, fra]) {
      p.country(x)!.ruling = IDEO_DEM;
      p.country(x)!.nextElectionDay = 2;
    }
    // Britain suspends them during a war; France has the "no elections" rule.
    ww.setWar(gbr, pl, g.ticks());
    p.country(gbr)!.electionsSuspended = true;
    p.country(gbr)!.flags.set("elections_suspended", [0, -1]);
    p.country(fra)!.spirits.push({
      id: "t_no_votes",
      untilDay: -1,
      addedDay: 0,
    });
    for (let d = 2; d <= 6; d++) {
      afterDay(runner, gbr, d);
      afterDay(runner, fra, d);
    }
    expect(elections()).toEqual([]);
    expect(p.country(gbr)!.nextElectionDay).toBe(2);
    // Controller ruling R6: the first day at peace lifts the suspension and
    // the overdue election is held at once.
    ww.endWar(gbr, pl);
    afterDay(runner, gbr, 7);
    expect(p.country(gbr)!.electionsSuspended).toBe(false);
    expect(p.country(gbr)!.hasFlag("elections_suspended", 7)).toBe(false);
    expect(elections()).toEqual([gbr]);
    expect(p.country(gbr)!.nextElectionDay).toBe(7 + WW_ELECTION_DAYS);
  });

  it("a regime crisis fires after 30 days above 60%", async () => {
    const { g, p, id } = await game("DEU");
    const deu = id("DEU");
    const c = p.country(deu)!;
    const queued = vi.spyOn(p, "queueEvent");
    const crises = () =>
      queued.mock.calls
        .map((x, i) => (x[0] === "gen_regime_crisis" ? days[i] : -1))
        .filter((d) => d >= 0);
    const days: number[] = [];
    const run = (from: number, to: number) => {
      for (let d = from; d < to; d++) {
        const n = queued.mock.calls.length;
        dailyIdeology(p, deu, d, g.ticks());
        for (let k = n; k < queued.mock.calls.length; k++) days.push(d);
      }
      p.flushEvents(g.ticks());
    };
    // 60% for 29 days, a dip, then 60% again: the count starts over.
    c.pop = [500, 6000, 1000, 2500];
    run(10, 39);
    c.pop = [500, 5900, 1000, 2600];
    run(39, 40);
    expect(crises()).toEqual([]);
    c.pop = [500, 6500, 1000, 2000];
    run(40, 250);
    // The 30th day, then a 90-day cooldown, then again.
    expect(crises()).toEqual([69, 159, 249]);
    expect(c.ruling).toBe(IDEO_NEU);
  });

  it("a government change follows spec §5.6 (faction, laws, advisors)", async () => {
    const { g, p, id } = await game("FRA");
    const ww = g.worldWar()!;
    const [gbr, fra, pl] = [id("GBR"), id("FRA"), id("POL")];
    const allies = p.factionIdx(gbr);
    expect(p.faction(allies)!.members).toEqual(
      expect.arrayContaining([gbr, fra]),
    );
    p.country(gbr)!.ruling = IDEO_DEM;
    p.country(fra)!.ruling = IDEO_DEM;
    const c = p.country(fra)!;
    const ce = ww.economy.country(fra)!;
    ce.laws.trade = "free_trade";
    c.advisors[0] = "t_fra_dem";
    c.advisors[1] = "title:administrator";
    c.pop = [6000, 2000, 1000, 1000];
    const msg = vi.spyOn(g, "displayMessage");
    setGovernment(p, fra, IDEO_COM, g.ticks());
    expect(c.ruling).toBe(IDEO_COM);
    expect(c.leader).toBe("title:leader_communist");
    // At least half the vote for the new government, the sum kept.
    expect(c.pop[IDEO_COM]).toBe(5000);
    expect(sum(c.pop)).toBe(10_000);
    // A democratic faction: a communist member leaves (at peace).
    expect(leaveFaction).toHaveBeenCalledWith(p, fra, g.ticks());
    // No free trade under communism: the nearest step, free.
    expect(ce.laws.trade).toBe("export_focus");
    // The democrat goes, the titled card stays.
    expect(c.advisors.slice(0, 2)).toEqual([null, "title:administrator"]);
    expect(msg).toHaveBeenCalledWith(
      "events_display.ww1936_government_changed",
      expect.anything(),
      null,
      undefined,
      { countryTag: "FRA", ideology: "communist" },
    );
    // Back to democracy (the faction's ideology): the member stays.
    vi.mocked(leaveFaction).mockClear();
    setGovernment(p, fra, IDEO_DEM, g.ticks());
    expect(leaveFaction).not.toHaveBeenCalled();
    expect(c.nextElectionDay).toBe(p.day() + WW_ELECTION_DAYS);
    // The leader turns fascist: the democrat leaves, a neutral member fits a
    // fascist faction (spec §15.3) and one at war stays.
    p.faction(allies)!.members.push(pl);
    p.factionsChanged();
    setGovernment(p, gbr, IDEO_FAS, g.ticks());
    expect(vi.mocked(leaveFaction).mock.calls.map((x) => x[1])).toEqual([fra]);
    vi.mocked(leaveFaction).mockClear();
    ww.setWar(fra, id("DEU"), g.ticks());
    setGovernment(p, gbr, IDEO_DEM, g.ticks());
    // Democratic again: neutral Poland misfits, France fights on.
    expect(vi.mocked(leaveFaction).mock.calls.map((x) => x[1])).toEqual([pl]);
  });

  it("the faction fit rule (spec §15.3, R8)", () => {
    expect(fitsFaction(IDEO_DEM, IDEO_DEM)).toBe(true);
    expect(fitsFaction(IDEO_NEU, IDEO_FAS)).toBe(true);
    expect(fitsFaction(IDEO_NEU, IDEO_NEU)).toBe(true);
    expect(fitsFaction(IDEO_NEU, IDEO_DEM)).toBe(false);
    expect(fitsFaction(IDEO_FAS, IDEO_NEU)).toBe(false);
    expect(fitsFaction(IDEO_COM, IDEO_DEM)).toBe(false);
  });

  it("the new leader is the table's, or a title past their dates (R7)", async () => {
    const { runner, p, id } = await game("FRA");
    const pl = id("POL");
    const c = p.country(pl)!;
    setGovernment(p, pl, IDEO_FAS, 0);
    expect(c.leader).toBe("t_pol_fas");
    // A leader-only person whose `until` (1936-01-05) has come is not seated.
    stepTo(runner, dayStartTick(5, WW_PREP_TICKS));
    setGovernment(p, pl, IDEO_DEM, 0);
    expect(c.leader).toBe("title:leader_democratic");
    // An explicit set_leader is never gated; a seated advisor leaves the seat.
    c.advisors[2] = "t_pol_gone";
    setLeader(p, pl, "t_pol_gone", 0);
    expect(c.leader).toBe("t_pol_gone");
    expect(c.advisors[2]).toBeNull();
  });

  it("Japan's leader is a title from 1936-02-26 (spec §5.7, R7)", async () => {
    usePoliticsContent(
      politicsFixture({
        ...EXTRA,
        persons: [
          ...(EXTRA.persons ?? []),
          {
            id: "t_jpn_named",
            nameKey: "ww1936.person.t_jpn_named",
            country: "JPN",
            roles: ["leader"],
            ideology: "neutral",
            source: "test",
          },
        ],
        countries: [
          {
            tag: "JPN",
            ruling: "neutral",
            popularity: [15, 2, 33, 50],
            stability: 50,
            warSupport: 55,
            tree: "generic",
            startLeader: "t_jpn_named",
            leaders: { neutral: "t_jpn_named", fascist: "t_jpn_named" },
          },
        ],
      }),
    );
    const files = await loadMapFiles(
      new NodeGameMapLoader(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../resources/maps",
        ),
      ),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      files,
      () => {},
    );
    const g = runner.game;
    const p = pol(g);
    const jpn = byTag(g, "JPN").smallID();
    const c = p.country(jpn)!;
    // 1936-01-01: the named starting leader; a change of government before
    // the incident seats the table's person.
    expect(c.leader).toBe("t_jpn_named");
    setGovernment(p, jpn, IDEO_FAS, g.ticks());
    expect(c.leader).toBe("t_jpn_named");
    expect(governmentLeader(p, jpn, IDEO_NEU, dayOfDate("1936-02-25"))).toBe(
      "t_jpn_named",
    );
    // From the 26 February incident on: the prime minister's title in place
    // of any named leader; a title in the table stays as it is.
    for (const ideo of [IDEO_FAS, IDEO_NEU]) {
      expect(governmentLeader(p, jpn, ideo, dayOfDate("1936-02-26"))).toBe(
        "title:jpn_prime_minister",
      );
    }
    expect(governmentLeader(p, jpn, IDEO_DEM, dayOfDate("1936-03-01"))).toBe(
      "title:leader_democratic",
    );
    // Another country is not touched; an explicit set_leader is not gated.
    const pl = byTag(g, "POL").smallID();
    expect(governmentLeader(p, pl, IDEO_FAS, dayOfDate("1937-01-01"))).toBe(
      "title:leader_fascist",
    );
    setLeader(p, jpn, "t_jpn_named", g.ticks());
    expect(c.leader).toBe("t_jpn_named");
  }, 120_000);

  it("civil war sets the government and the strife spirit", async () => {
    const { g, p, id } = await game("DEU");
    const pl = id("POL");
    const c = p.country(pl)!;
    expect(resolveIdeology(p, pl, "largest_other")).toBe(IDEO_DEM);
    c.stabBaseBp = 2000;
    c.wsBaseBp = 4000;
    civilWar(p, pl, resolveIdeology(p, pl, "largest_other"), g.ticks());
    expect(c.ruling).toBe(IDEO_DEM);
    expect(c.stabBaseBp).toBe(0);
    expect(c.wsBaseBp).toBe(3000);
    expect(c.spirits).toContainEqual({
      id: "gen_civil_strife",
      untilDay: p.day() + 180,
      addedDay: p.day(),
    });
    expect(c.stats.outputPct).toBeLessThanOrEqual(-20);
  });
});
