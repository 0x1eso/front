// World War 1936 P3 (spec §18.6, §18.7; plan Task 6): the AI's politics —
// advisors, the law's PP, decisions, justification, guarantees, factions,
// access, the acceptance table and the war decision — and the owner's
// direction that history beats are suggestions the AI judges. On the test
// map ww1936pol with the test content; the AI countries are named per
// test, every other country is human (plan decision 24). A division's
// battle numbers are pinned to 1000, so the counts set the ratios.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  DecisionDef,
  HistoryBeat,
  PersonDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  WW_BRANCH_DEVIATE_PCT,
  WW_BRANCH_DEVIATE_POLITICAL_PCT,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { GENERIC_EVENTS } from "@openfront/engine-lib/ww1936/content/events/generic";
import type { ContentParts } from "@openfront/engine-lib/ww1936/content/registry";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  AI_ADVISOR_ORDER,
  AI_BEAT_WAIT_DAYS,
  AI_DECISION_PERIOD_DAYS,
  AI_TARGETED_PERIOD_DAYS,
  aiAcceptScore,
  aiPoliticsTick,
  aiWarDecision,
  aiWarScore,
  reserveForBeats,
  reserveForLaw,
} from "@openfront/engine/ww1936/politics/AiPolitics";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { runBeats } from "@openfront/engine/ww1936/politics/HistoryBeats";
import {
  addGuarantee,
  opinionOf,
} from "@openfront/engine/ww1936/politics/Treaties";
import { addWarGoal } from "@openfront/engine/ww1936/politics/WarGoals";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  clearLand,
  dropPact,
  land,
  placeArmy,
  pol,
  POL,
  stepTo,
  WwHuman,
  wwRunnerCapture,
} from "./util";

const ALL: CountryTag[] = [
  "FRA",
  "DEU",
  "ITA",
  "POL",
  "SUN",
  "GBR",
  "AUT",
  "CSK",
  "LTU",
  "EST",
];
/** Capitals (region ids) on ww1936pol. */
const CAPITAL: Partial<Record<CountryTag, number>> = {
  FRA: 1,
  DEU: 3,
  ITA: 5,
  POL: 6,
  SUN: 8,
  GBR: 10,
};

interface AiGame {
  runner: GameRunner;
  p: WwPolitics;
  id: (t: CountryTag) => number;
  /** The first day ≥ the game's day where `(day + id) % period === 0`. */
  dayFor: (t: CountryTag, period: number, from?: number) => number;
  /** Clears the board; `n` divisions per country, each worth 1000. */
  armies: (n: Partial<Record<CountryTag, number>>) => void;
  tick: () => number;
}

/** `ai` play themselves; the rest are human. After the preparation minute. */
async function aiGame(
  ai: CountryTag[],
  parts: Partial<ContentParts> = {},
  historicalAi = true,
  gameID?: string,
): Promise<AiGame> {
  usePoliticsContent(politicsFixture(parts));
  const humans: WwHuman[] = ALL.filter((t) => !ai.includes(t)).map(
    (country, i) => ({
      clientID: `HUMAN${String(i + 1).padStart(3, "0")}`,
      country,
    }),
  );
  const { runner } = await wwRunnerCapture(
    { historicalAi },
    humans,
    POL,
    gameID,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const p = pol(g);
  const id = (t: CountryTag) => byTag(g, t).smallID();
  // Every division's battle numbers (soft + hard + defence + breakthrough)
  // sum to 1000, so the division counts set the ratios.
  const l = land(g);
  const statsOf = l.statsOf.bind(l);
  vi.spyOn(l, "statsOf").mockImplementation((r) => ({
    ...statsOf(r),
    soft: 400,
    hard: 100,
    def: 400,
    brk: 100,
  }));
  return {
    runner,
    p,
    id,
    dayFor: (t, period, from = p.ww.day(g.ticks())) => {
      let d = from;
      while ((d + id(t)) % period !== 0) d++;
      return d;
    },
    armies: (n) => {
      clearLand(g);
      for (const [t, k] of Object.entries(n) as [CountryTag, number][]) {
        if (k > 0) placeArmy(g, t, CAPITAL[t]!, k);
      }
    },
    tick: () => g.ticks(),
  };
}

const person = (
  id: string,
  nameKey: string,
  country: CountryTag,
  slot: NonNullable<PersonDef["advisor"]>["slot"],
  trait: NonNullable<PersonDef["advisor"]>["traits"][number],
): PersonDef => ({
  id,
  nameKey,
  country,
  roles: ["advisor"],
  advisor: { slot, traits: [trait] },
  source: "test",
});

const decision = (id: string, w: number, extra: Partial<DecisionDef> = {}) =>
  ({
    id,
    category: "political",
    for: "any",
    cost: { pp: 10 },
    cooldownDays: 1000,
    effects: [],
    ai: { base: w },
    ...extra,
  }) as DecisionDef;

/** The test events plus K1's diplomatic requests (lane D answers them by the score). */
const DIPLO_EVENTS = [
  ...politicsFixture().events,
  ...GENERIC_EVENTS.filter((e) => e.id.startsWith("gen_diplo_")),
];

const beat = (
  id: string,
  actor: CountryTag,
  act: HistoryBeat["act"],
  date = "1936-01-10",
): HistoryBeat => ({ id, date, actor, act });

afterEach(() => {
  usePoliticsContent(null);
  vi.restoreAllMocks();
});

describe("the AI's politics (spec §18.6)", { timeout: 60_000 }, () => {
  it("an AI hires advisors by its personality order", async () => {
    const persons = [
      // A real name and a titled person (R20: real names first).
      person(
        "t_deu_chief",
        "ww1936.person.t_deu_chief",
        "DEU",
        "army_chief",
        "chief_offense",
      ),
      person(
        "t_deu_ind",
        "ww1936.title.t_deu_ind",
        "DEU",
        "industry",
        "ind_production",
      ),
    ];
    const g = await aiGame(["DEU", "GBR", "POL"], { persons, decisions: [] });
    const run = (t: CountryTag, calls: number) => {
      const c = g.p.country(g.id(t))!;
      let d = g.dayFor(t, 3);
      for (let i = 0; i < calls; i++, d += 3) {
        c.ppMilli = 1_000_000;
        aiPoliticsTick(g.p, g.id(t), d, g.tick());
      }
      return c.advisors;
    };
    // The aggressor: chief_offense → ind_production → hawk → staff_planner,
    // one a call, each in the first seat of its branch; then nothing.
    expect(AI_ADVISOR_ORDER.aggressor).toEqual([
      "chief_offense",
      "ind_production",
      "hawk",
      "staff_planner",
    ]);
    expect(run("DEU", 1)[3]).toBe("t_deu_chief");
    expect(run("DEU", 1)[6]).toBe("t_deu_ind");
    expect(run("DEU", 1)[0]).toBe("title:hawk");
    expect(run("DEU", 1)[4]).toBe("title:staff_planner");
    expect(run("DEU", 3)).toEqual([
      "title:hawk",
      null,
      null,
      "t_deu_chief",
      "title:staff_planner",
      null,
      "t_deu_ind",
      null,
    ]);
    // The democracy and the minor.
    expect(run("GBR", 4)).toEqual([
      "title:administrator",
      null,
      null,
      "title:chief_defense",
      null,
      null,
      "title:ind_construction",
      "title:rs_science",
    ]);
    expect(run("POL", 4)).toEqual([
      "title:administrator",
      null,
      null,
      "title:chief_defense",
      null,
      null,
      "title:ind_construction",
      null,
    ]);
  });

  it("an advisor waits for its own seat's PP rather than a cheaper later trait", async () => {
    const g = await aiGame(["DEU"], { decisions: [] });
    const deu = g.id("DEU");
    const c = g.p.country(deu)!;
    let d = g.dayFor("DEU", 3);
    for (let i = 0; i < 2; i++, d += 3) {
      c.ppMilli = 1_000_000;
      aiPoliticsTick(g.p, deu, d, g.tick());
    }
    expect(c.advisors[3]).toBe("title:chief_offense");
    expect(c.advisors[6]).toBe("title:ind_production");
    // hawk (a 150-PP political seat) is next: 199 PP above the reserve is
    // not enough, and staff_planner (100) is not taken instead.
    const keep = reserveForLaw(g.p, deu, d) + reserveForBeats(g.p, deu, d);
    c.ppMilli = (keep + 199) * 1000;
    aiPoliticsTick(g.p, deu, d, g.tick());
    expect(c.advisors[0]).toBeNull();
    expect(c.advisors[4]).toBeNull();
    c.ppMilli = (keep + 200) * 1000;
    aiPoliticsTick(g.p, deu, d + 3, g.tick());
    expect(c.advisors[0]).toBe("title:hawk");
  });

  it("an AI keeps PP for its target law", async () => {
    const decisions = [decision("t_rally", 10, { cost: { pp: 50 } })];
    const g = await aiGame(["DEU"], { decisions });
    const deu = g.id("DEU");
    const c = g.p.country(deu)!;
    const d = g.dayFor("DEU", AI_DECISION_PERIOD_DAYS);
    // The P1 AI economy's next law (R10) costs PP: it is kept back (an
    // aggressor at peace wants partial mobilisation).
    g.p.econ.country(deu)!.laws.economy = "civilian";
    const law = reserveForLaw(g.p, deu, d);
    expect(law).toBeGreaterThan(0);
    const keep = law + reserveForBeats(g.p, deu, d);
    // The first advisor (army chief, 100) needs 100 + 50 above it.
    c.ppMilli = (keep + 149) * 1000;
    aiPoliticsTick(g.p, deu, d, g.tick());
    expect(c.advisors[3]).toBeNull();
    expect(c.taken.has("t_rally")).toBe(false);
    c.ppMilli = (keep + 150) * 1000;
    aiPoliticsTick(g.p, deu, d + 6, g.tick());
    expect(c.advisors[3]).toBe("title:chief_offense");
    // The decision step after it took the 50 PP left above the reserve.
    expect(c.taken.has("t_rally")).toBe(true);
    expect(c.ppMilli).toBe(keep * 1000);
    c.taken.delete("t_rally");
    c.decisionCooldown.delete("t_rally");
    // Every seat it wants full: a decision gets what is above the reserve.
    c.advisors = [
      "title:hawk",
      null,
      null,
      "title:chief_offense",
      "title:staff_planner",
      null,
      "title:ind_production",
      null,
    ];
    c.ppMilli = (keep + 49) * 1000;
    aiPoliticsTick(g.p, deu, d + 12, g.tick());
    expect(c.taken.has("t_rally")).toBe(false);
    c.ppMilli = (keep + 50) * 1000;
    aiPoliticsTick(g.p, deu, d + 18, g.tick());
    expect(c.taken.has("t_rally")).toBe(true);
    expect(c.ppMilli).toBe(keep * 1000);
  });

  it("an AI takes the heaviest decision and leaves beat decisions to the beat", async () => {
    const decisions = [
      decision("t_beat", 50),
      decision("t_heavy", 30),
      decision("t_tie_a", 20),
      decision("t_tie_b", 20),
      decision("t_zero", 0),
      decision("t_target", 40, {
        target: { among: { kind: "always", value: true } },
      }),
    ];
    const beats = [
      beat("b_t_beat", "DEU", { kind: "decision", id: "t_beat" }, "1937-06-01"),
    ];
    const g = await aiGame(["DEU"], { decisions, beats });
    const deu = g.id("DEU");
    const c = g.p.country(deu)!;
    c.advisors = c.advisors.map(
      (_, i) =>
        `title:${["hawk", "orator", "diplomat", "chief_offense", "staff_planner", "staff_training", "ind_production", "rs_science"][i]}`,
    );
    g.p.beats[0] = { fireDay: 500, skipped: false, done: false };
    const takes: string[] = [];
    const call = (d: number) => {
      const before = new Set(c.decisionCooldown.keys());
      c.ppMilli = 1_000_000;
      aiPoliticsTick(g.p, deu, d, g.tick());
      takes.push(
        [...c.decisionCooldown.keys()].filter((k) => !before.has(k)).join(),
      );
    };
    // A day with targeted decisions: t_target (40) on the first other
    // country by smallID; t_beat (50) waits for its beat.
    const d = g.dayFor("DEU", AI_TARGETED_PERIOD_DAYS);
    call(d);
    // Decision days without targeted ones: 30, then the tie in content order.
    call(d + 6);
    call(d + 12);
    call(d + 18);
    // Nothing left: weight 0 never; the beat's decision still waits.
    call(d + 24);
    // The beat skipped (or lapsed): the general AI may take it (R2).
    g.p.beats[0].skipped = true;
    call(d + 36);
    const first = Math.min(...ALL.map(g.id).filter((x) => x !== deu));
    expect(takes).toEqual([
      `t_target@${first}`,
      "t_heavy",
      "t_tie_a",
      "t_tie_b",
      "",
      "t_beat",
    ]);
  });

  it("with historical AI off an aggressor justifies on a weaker neighbour", async () => {
    const groups = [
      ...politicsFixture().groups,
      { id: "t_krakow", regions: [7], owner1936: "POL" as CountryTag },
    ];
    const setup = async (claims = false, historical = false) => {
      const g = await aiGame(
        ["DEU"],
        {
          decisions: [],
          groups,
          claims: claims ? [{ tag: "DEU", groups: ["t_krakow"] }] : [],
        },
        historical,
      );
      const deu = g.id("DEU");
      const c = g.p.country(deu)!;
      c.ruling = IDEO_FAS;
      c.advisors = c.advisors.map(() => "title:orator");
      c.ppMilli = 1_000_000;
      return { ...g, deu, c, d: g.dayFor("DEU", 3) };
    };
    // Its neighbours: France (smallID 1), Italy (its faction), Poland (a
    // 1934 pact). France is too strong (DEU and half of Italy, its faction
    // mate, against France and Britain): Poland is the one — the pact is
    // broken first (controller ruling 1) and both are paid for.
    {
      const { p, deu, c, d, id, armies, tick } = await setup();
      armies({ DEU: 10, ITA: 2, FRA: 12, POL: 2 });
      const keep = reserveForLaw(p, deu, d) + reserveForBeats(p, deu, d);
      c.ppMilli = (keep + 99) * 1000;
      aiPoliticsTick(p, deu, d, tick());
      expect(c.justification).toBeNull();
      c.ppMilli = (keep + 100) * 1000;
      aiPoliticsTick(p, deu, d + 3, tick());
      expect(p.isAtWarBlockedByNap(deu, id("POL"))).toBe(false);
      expect(c.justification).toMatchObject({ on: id("POL"), type: "conquer" });
      expect(c.ppMilli).toBe(keep * 1000);
    }
    // France weak too: the neighbour without a pact goes first…
    {
      const { p, deu, c, d, id, armies, tick } = await setup();
      armies({ DEU: 10, FRA: 2, POL: 2 });
      aiPoliticsTick(p, deu, d, tick());
      expect(c.justification?.on).toBe(id("FRA"));
    }
    // …but a claim (CLAIMS) goes before it: a claim justification on its group.
    {
      const { p, deu, c, d, id, armies, tick } = await setup(true);
      dropPact(p.mg, "DEU", "POL");
      armies({ DEU: 10, FRA: 2, POL: 2 });
      aiPoliticsTick(p, deu, d, tick());
      expect(c.justification).toMatchObject({
        on: id("POL"),
        type: "claim",
        group: "t_krakow",
      });
    }
    // A neighbour a major guarantees is left alone.
    {
      const { p, deu, c, d, id, armies, tick } = await setup(true);
      dropPact(p.mg, "DEU", "POL");
      armies({ DEU: 10, FRA: 30, POL: 2 });
      addGuarantee(p, id("GBR"), id("POL"), 0);
      aiPoliticsTick(p, deu, d, tick());
      expect(c.justification).toBeNull();
    }
    // With historical AI the beats lead: no justification.
    {
      const { p, deu, c, d, armies, tick } = await setup(false, true);
      armies({ DEU: 10, FRA: 2, POL: 2 });
      aiPoliticsTick(p, deu, d, tick());
      expect(c.justification).toBeNull();
    }
  });

  it("acceptance scores follow the table", async () => {
    const g = await aiGame([]);
    const { p, id } = g;
    const [deu, pl, gbr, sun, fra] = ["DEU", "POL", "GBR", "SUN", "FRA"].map(
      (t) => id(t as CountryTag),
    );
    const op = (to: number, from: number) =>
      Math.trunc(opinionOf(p, to, from) / 2);
    const ww = p.ww;
    // Faction invitation (Britain, a major, leads the Allies; Poland in
    // none; every government neutral): same ideology +40, the inviter a
    // major +10, opinion / 2.
    p.wtBp = 5000;
    expect(aiAcceptScore(p, "faction_invite", gbr, pl)).toBe(
      40 + 10 + op(pl, gbr),
    );
    // Another ideology −40.
    p.country(pl)!.ruling = IDEO_COM;
    expect(aiAcceptScore(p, "faction_invite", gbr, pl)).toBe(
      -40 + 10 + op(pl, gbr),
    );
    p.country(pl)!.ruling = p.country(gbr)!.ruling;
    // A common enemy +40 (Poland and France both fight the Soviet Union).
    ww.setWar(pl, sun, g.tick());
    ww.setWar(fra, sun, g.tick());
    expect(aiAcceptScore(p, "faction_invite", gbr, pl)).toBe(
      40 + 40 + 10 + op(pl, gbr),
    );
    ww.endWar(pl, sun);
    // The faction at war and the joiner at peace −20.
    expect(aiAcceptScore(p, "faction_invite", gbr, pl)).toBe(
      40 + 10 - 20 + op(pl, gbr),
    );
    ww.endWar(fra, sun);
    // Justified against +30.
    p.country(deu)!.justification = {
      on: pl,
      type: "conquer",
      group: "",
      progressDays: 0,
      totalDays: 100,
    };
    expect(aiAcceptScore(p, "faction_invite", gbr, pl)).toBe(
      40 + 30 + 10 + op(pl, gbr),
    );
    p.country(deu)!.justification = null;
    // A democracy under the 40% door −100 (the inviter neutral: −40 too).
    p.country(pl)!.ruling = IDEO_DEM;
    p.wtBp = 3900;
    expect(aiAcceptScore(p, "faction_invite", gbr, pl)).toBe(
      -40 + 10 - 100 + op(pl, gbr),
    );
    p.wtBp = 4000;
    expect(aiAcceptScore(p, "faction_invite", gbr, pl)).toBe(
      -40 + 10 + op(pl, gbr),
    );
    p.country(pl)!.ruling = p.country(gbr)!.ruling;
    // A join request: Poland asks Britain — judged on Poland against the
    // Allies; Poland is no major (no +10).
    expect(aiAcceptScore(p, "faction_request", pl, gbr)).toBe(40 + op(gbr, pl));

    // Non-aggression: +30 and opinion / 2.
    g.armies({ DEU: 3, POL: 2 });
    expect(aiAcceptScore(p, "nap", deu, pl)).toBe(30 + op(pl, deu));
    // The proposer twice as strong or more +20.
    g.armies({ DEU: 4, POL: 2 });
    expect(aiAcceptScore(p, "nap", deu, pl)).toBe(30 + 20 + op(pl, deu));
    g.armies({ DEU: 3, POL: 2 });
    // The proposer justifying on me −100.
    p.country(deu)!.justification = {
      on: pl,
      type: "conquer",
      group: "",
      progressDays: 0,
      totalDays: 100,
    };
    expect(aiAcceptScore(p, "nap", deu, pl)).toBe(30 - 100 + op(pl, deu));
    p.country(deu)!.justification = null;
    // I aim at the proposer (a goal) −100.
    addWarGoal(p, pl, deu, "conquer", "", 0);
    expect(aiAcceptScore(p, "nap", deu, pl)).toBe(30 - 100 + op(pl, deu));
    p.country(pl)!.warGoals = [];

    // Access: same ideology +20, opinion / 2.
    expect(aiAcceptScore(p, "access", deu, pl)).toBe(20 + op(pl, deu));
    p.country(deu)!.ruling = IDEO_FAS;
    expect(aiAcceptScore(p, "access", deu, pl)).toBe(op(pl, deu));
    p.country(deu)!.ruling = p.country(pl)!.ruling;
    // The asker fights my neighbour (the Soviet Union), which threatens me
    // (≥ 5% generated tension) +30.
    ww.setWar(deu, sun, g.tick());
    p.threatBp[sun] = 499;
    expect(aiAcceptScore(p, "access", deu, pl)).toBe(20 + op(pl, deu));
    p.threatBp[sun] = 500;
    expect(aiAcceptScore(p, "access", deu, pl)).toBe(20 + 30 + op(pl, deu));
    // The asker aims at me −100.
    addWarGoal(p, deu, pl, "conquer", "", 0);
    expect(aiAcceptScore(p, "access", deu, pl)).toBe(
      20 + 30 - 100 + op(pl, deu),
    );
  });

  it("a democratic major guarantees a threatened minor someone justifies on", async () => {
    const g = await aiGame(["GBR"], { decisions: [] }, false);
    const { p, id } = g;
    const [gbr, deu, pl] = [id("GBR"), id("DEU"), id("POL")];
    const c = p.country(gbr)!;
    c.ruling = IDEO_DEM;
    c.advisors = c.advisors.map(() => "title:orator");
    p.country(deu)!.justification = {
      on: pl,
      type: "conquer",
      group: "",
      progressDays: 0,
      totalDays: 100,
    };
    p.threatBp[deu] = 500;
    const d = g.dayFor("GBR", 3);
    c.ppMilli = 1_000_000;
    p.wtBp = 2499;
    aiPoliticsTick(p, gbr, d, g.tick());
    expect(p.guarantorsOf(pl)).toEqual([]);
    p.wtBp = 2500;
    aiPoliticsTick(p, gbr, d + 3, g.tick());
    expect(p.guarantorsOf(pl)).toEqual([gbr]);
  });

  it("a leader invites a neighbour that would accept; a threatened country asks to join", async () => {
    const g = await aiGame(
      ["DEU", "POL"],
      { decisions: [], events: DIPLO_EVENTS },
      false,
    );
    const { p, id } = g;
    const [deu, pl, sun] = [id("DEU"), id("POL"), id("SUN")];
    for (const t of [deu, pl]) {
      p.country(t)!.advisors = p.country(t)!.advisors.map(() => "title:orator");
      p.country(t)!.ppMilli = 1_000_000;
    }
    p.wtBp = 4500;
    // Germany is busy justifying elsewhere (no justification on Poland).
    p.country(deu)!.justification = {
      on: id("GBR"),
      type: "conquer",
      group: "",
      progressDays: 0,
      totalDays: 100,
    };
    // Poland would score under 70 for Germany's invitation: not invited.
    const d = g.dayFor("DEU", 30);
    aiPoliticsTick(p, deu, d, g.tick());
    expect(p.factionIdx(pl)).toBe(-1);
    // Someone justifies on Poland (+30): invited, and it accepts.
    p.country(sun)!.justification = {
      on: pl,
      type: "conquer",
      group: "",
      progressDays: 0,
      totalDays: 100,
    };
    expect(aiAcceptScore(p, "faction_invite", deu, pl)).toBeGreaterThanOrEqual(
      70,
    );
    aiPoliticsTick(p, deu, d + 30, g.tick());
    expect(p.sameFaction(deu, pl)).toBe(true);
    // A threatened Poland outside any faction asks the one it fits.
    const axis = p.factions.find((f) => f.members.includes(pl))!;
    axis.members = axis.members.filter((m) => m !== pl);
    p.factionsChanged();
    expect(p.factionIdx(pl)).toBe(-1);
    aiPoliticsTick(p, pl, g.dayFor("POL", 30, d + 31), g.tick());
    expect(p.sameFaction(deu, pl)).toBe(true);
  });

  it("an AI asks a neighbour for access to a war it plans beyond it", async () => {
    const g = await aiGame(
      ["DEU", "POL"],
      { decisions: [], events: DIPLO_EVENTS },
      false,
    );
    const { p, id } = g;
    const [deu, pl, sun] = [id("DEU"), id("POL"), id("SUN")];
    const c = p.country(deu)!;
    c.advisors = c.advisors.map(() => "title:orator");
    c.ppMilli = 1_000_000;
    // Germany fights the Soviet Union, which it does not border; Poland
    // borders both and the Soviet Union threatens it.
    g.p.ww.setWar(deu, sun, g.tick());
    c.declaredOn = [sun];
    p.threatBp[sun] = 600;
    expect(aiAcceptScore(p, "access", deu, pl)).toBeGreaterThanOrEqual(50);
    aiPoliticsTick(p, deu, g.dayFor("DEU", 15), g.tick());
    expect(p.hasAccess(deu, pl)).toBe(true);
  });
});

describe("the war decision (spec §18.7)", { timeout: 60_000 }, () => {
  async function war(historical = false) {
    const g = await aiGame(["DEU", "FRA"], { decisions: [] }, historical);
    const { p, id } = g;
    const [deu, pl, fra] = [id("DEU"), id("POL"), id("FRA")];
    dropPact(p.mg, "DEU", "POL");
    addWarGoal(p, deu, pl, "conquer", "", 0);
    const d = p.ww.day(g.tick());
    return { ...g, deu, pl, fra, d };
  }

  it("an AI declares with a goal when strong enough", async () => {
    // An aggressor needs 1.3 times the target's side.
    {
      const { p, deu, pl, d, armies, tick } = await war();
      armies({ DEU: 4, POL: 4 });
      expect(aiWarScore(p, deu, pl, false)).toBe(1000);
      expect(aiWarDecision(p, deu, d, tick())).toBe(0);
      armies({ DEU: 13, POL: 10 });
      expect(aiWarDecision(p, deu, d, tick())).toBe(pl);
      expect(p.ww.isAtWar(deu, pl)).toBe(true);
      // The goal is used (spec §14.2).
      expect(p.hasWarGoal(deu, pl)).toBe(false);
    }
    // War support under 40%: no.
    {
      const { p, deu, d, armies, tick } = await war();
      armies({ DEU: 13, POL: 10 });
      p.country(deu)!.wsBp = 3999;
      expect(aiWarDecision(p, deu, d, tick())).toBe(0);
    }
    // France (not an aggressor) needs 1.6.
    {
      const { p, fra, pl, d, armies, tick } = await war();
      addWarGoal(p, fra, pl, "conquer", "", 0);
      armies({ FRA: 15, POL: 10 });
      expect(aiWarDecision(p, fra, d, tick())).toBe(0);
      armies({ FRA: 16, POL: 10 });
      expect(aiWarDecision(p, fra, d, tick())).toBe(pl);
    }
    // Fighting a major alone (the Soviet Union): no new war.
    {
      const { p, deu, d, armies, tick, id } = await war();
      armies({ DEU: 30, POL: 2 });
      p.ww.setWar(deu, id("SUN"), tick());
      expect(aiWarDecision(p, deu, d, tick())).toBe(0);
    }
    // The target's faction counts: Poland with Britain's faction is too much.
    {
      const { p, deu, pl, d, armies, tick, id } = await war();
      armies({ DEU: 13, POL: 10, GBR: 10 });
      p.factions.find((f) => f.leader === id("GBR"))!.members.push(pl);
      p.factionsChanged();
      expect(aiWarDecision(p, deu, d, tick())).toBe(0);
    }
  });

  it("with historical AI off a pact is broken before the attack (controller ruling 1)", async () => {
    const g = await aiGame(["DEU"], { decisions: [] }, false);
    const { p, id } = g;
    const [deu, pl] = [id("DEU"), id("POL")];
    addWarGoal(p, deu, pl, "conquer", "", 0);
    g.armies({ DEU: 13, POL: 10 });
    const c = p.country(deu)!;
    const d = p.ww.day(g.tick());
    const keep = reserveForLaw(p, deu, d) + reserveForBeats(p, deu, d);
    c.ppMilli = (keep + 49) * 1000;
    expect(aiWarDecision(p, deu, d, g.tick())).toBe(0);
    expect(p.isAtWarBlockedByNap(deu, pl)).toBe(true);
    c.ppMilli = (keep + 50) * 1000;
    expect(aiWarDecision(p, deu, d, g.tick())).toBe(pl);
    expect(p.isAtWarBlockedByNap(deu, pl)).toBe(false);
    expect(c.ppMilli).toBe(keep * 1000);
  });

  it("before a history beat's date only a strong AI declares (R11 as a rail)", async () => {
    // Germany's goal on Poland, the 1939-09-01 beat still to come.
    const { p, deu, pl, d, armies, tick, id } = await war(true);
    expect(d).toBeLessThan(dayOfDate("1939-09-01"));
    armies({ DEU: 15, POL: 10 });
    expect(aiWarDecision(p, deu, d, tick())).toBe(0);
    armies({ DEU: 20, POL: 10 });
    expect(aiWarDecision(p, deu, d, tick())).toBe(pl);
    // Either way round: the Soviet Union and the 1941-06-22 German beat.
    const sun = id("SUN");
    addWarGoal(p, sun, deu, "conquer", "", 0);
    armies({ SUN: 15, DEU: 10 });
    expect(aiWarDecision(p, sun, d, tick())).toBe(0);
  });
});

describe(
  "history beats are suggestions (owner direction)",
  { timeout: 60_000 },
  () => {
    async function beats(
      list: HistoryBeat[],
      ai: CountryTag[] = ["DEU", "GBR", "SUN"],
    ) {
      const g = await aiGame(ai, { decisions: [], beats: list }, true);
      const d = g.p.ww.day(g.tick());
      list.forEach(
        (_, i) => (g.p.beats[i] = { fireDay: d, skipped: false, done: false }),
      );
      return { ...g, d };
    }

    it("a war beat waits while the AI rates it badly and lapses after its window", async () => {
      const { p, id, armies, tick, d } = await beats([
        beat("b_t_war", "DEU", { kind: "declare", target: "POL" }),
      ]);
      const [deu, pl] = [id("DEU"), id("POL")];
      armies({ DEU: 7, POL: 10 });
      runBeats(p, d, tick());
      expect(p.ww.isAtWar(deu, pl)).toBe(false);
      expect(p.beats[0].done).toBe(false);
      // Still planned meanwhile (the land AI stages for it).
      expect(p.plannedWars(deu, d + 40)).toContain(pl);
      runBeats(p, d + AI_BEAT_WAIT_DAYS - 1, tick());
      expect(p.beats[0].done).toBe(false);
      runBeats(p, d + AI_BEAT_WAIT_DAYS, tick());
      expect(p.beats[0].done).toBe(true);
      expect(p.ww.isAtWar(deu, pl)).toBe(false);
    });

    it("a war beat acts once the AI rates it well enough", async () => {
      const { p, id, armies, tick, d } = await beats([
        beat("b_t_war", "DEU", { kind: "declare", target: "POL" }),
      ]);
      const [deu, pl] = [id("DEU"), id("POL")];
      armies({ DEU: 7, POL: 10 });
      runBeats(p, d, tick());
      expect(p.ww.isAtWar(deu, pl)).toBe(false);
      armies({ DEU: 8, POL: 10 });
      runBeats(p, d + 1, tick());
      expect(p.ww.isAtWar(deu, pl)).toBe(true);
      expect(p.beats[0].done).toBe(true);
    });

    it("no Barbarossa while Germany fights another major on its border", async () => {
      const { p, id, armies, tick, d } = await beats([
        beat("b_t_barbarossa", "DEU", { kind: "declare", target: "SUN" }),
      ]);
      const [deu, sun, fra] = [id("DEU"), id("SUN"), id("FRA")];
      armies({ DEU: 12, SUN: 10 });
      expect(aiWarScore(p, deu, sun, false)).toBe(1200);
      // France on Germany's border: the score halves (600 < 800).
      p.ww.setWar(deu, fra, tick());
      expect(aiWarScore(p, deu, sun, false)).toBe(600);
      runBeats(p, d, tick());
      expect(p.ww.isAtWar(deu, sun)).toBe(false);
      expect(p.beats[0].done).toBe(false);
      // France is out of the war: the beat goes ahead.
      p.ww.endWar(deu, fra);
      runBeats(p, d + 30, tick());
      expect(p.ww.isAtWar(deu, sun)).toBe(true);
    });

    it("a join that is owed goes ahead; one opening a war is judged as a declaration", async () => {
      // Britain guarantees Poland; Germany fights Poland: Britain's join is
      // owed, however weak it is (the Allies of 1939-09-03).
      {
        const { p, id, armies, tick, d } = await beats([
          beat("b_t_join", "GBR", { kind: "join", target: "DEU" }),
        ]);
        const [gbr, deu, pl] = [id("GBR"), id("DEU"), id("POL")];
        armies({ GBR: 1, DEU: 30, POL: 1 });
        addGuarantee(p, gbr, pl, 0);
        p.ww.setWar(deu, pl, tick());
        runBeats(p, d, tick());
        expect(p.ww.isAtWar(gbr, deu)).toBe(true);
      }
      // Nobody fights Germany: Britain's "join" would open the war, judged as
      // a declaration against the Axis — it waits.
      {
        const { p, id, armies, tick, d } = await beats([
          beat("b_t_join", "GBR", { kind: "join", target: "DEU" }),
        ]);
        const [gbr, deu] = [id("GBR"), id("DEU")];
        armies({ GBR: 10, DEU: 10, ITA: 5 });
        runBeats(p, d, tick());
        expect(p.ww.isAtWar(gbr, deu)).toBe(false);
        expect(p.beats[0].done).toBe(false);
      }
      // A join into a war others fight: the co-belligerents count (0.6).
      {
        const { p, id, armies, tick, d } = await beats(
          [beat("b_t_join", "SUN", { kind: "join", target: "POL" })],
          ["DEU", "SUN"],
        );
        const [sun, deu, pl] = [id("SUN"), id("DEU"), id("POL")];
        dropPact(p.mg, "SUN", "POL");
        armies({ SUN: 1, DEU: 5, POL: 10 });
        p.ww.setWar(deu, pl, tick());
        expect(aiWarScore(p, sun, pl, true)).toBe(600);
        runBeats(p, d, tick());
        expect(p.ww.isAtWar(sun, pl)).toBe(true);
      }
    });

    it("different seeds give different histories", async () => {
      // The real content: branch points deviate at about 25% (political 15%),
      // seeded per game; beats are delayed 0–20 days and skipped 1 in 10.
      expect(WW_BRANCH_DEVIATE_PCT).toBe(25);
      expect(WW_BRANCH_DEVIATE_POLITICAL_PCT).toBe(15);
      const histories = new Set<string>();
      const deuPolDays = new Set<number>();
      let points = 0;
      let deviated = 0;
      for (let s = 1; s <= 6; s++) {
        usePoliticsContent(null);
        const { runner } = await wwRunnerCapture({}, [], POL, `WWAI000${s}`);
        stepTo(runner, WW_PREP_TICKS + 1);
        const p = pol(runner.game);
        const devs = [...p.branchDeviations.values()];
        points += devs.length;
        deviated += devs.filter((x) => x !== null).length;
        const i = p.content.beats.findIndex(
          (b) => b.id === "b1939_09_01_deu_pol",
        );
        deuPolDays.add(p.beats[i].skipped ? -1 : p.beats[i].fireDay);
        histories.add(JSON.stringify([...p.branchDeviations]));
      }
      expect(histories.size).toBeGreaterThanOrEqual(2);
      expect(deuPolDays.size).toBeGreaterThanOrEqual(2);
      // A plausible share across the six games' branch points.
      expect(deviated / points).toBeGreaterThan(0.08);
      expect(deviated / points).toBeLessThan(0.4);
    });
  },
);
