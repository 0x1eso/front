import {
  CongressData,
  PlayerCongressData,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  cardModels,
  congressDial,
  congressFlags,
  CongressViewer,
  conveneState,
  extraChips,
  flagIcons,
  formatClock,
  newResults,
  reasonText,
  remainingTicks,
  resolutionChips,
  titleText,
} from "../../src/client/hud/congress/CongressModel";
import { EMPTY } from "./CongressFixture";

const ME: PlayerCongressData = {
  influence: 120,
  influencePerSec: 0.45,
  status: "peaceful",
  ballots: [],
};

function viewer(
  data: Partial<PlayerCongressData> = {},
  friends: number[] = [],
): CongressViewer {
  return {
    smallID: 1,
    alive: true,
    data: { ...ME, ...data },
    friendlyTo: (id) => friends.includes(id),
  };
}

const t = (key: string, p?: Record<string, string | number>) =>
  p === undefined ? `[${key}]` : `[${key}:${JSON.stringify(p)}]`;
const names: Record<number, string> = { 1: "me", 2: "jiho", 3: "seoyeon" };
const nameOf = (id: number) => names[id] ?? "?";

describe("the congress dial", () => {
  test("idle: fills toward the next session; soon: gold for the last 20 s", () => {
    expect(congressDial(EMPTY, viewer(), 900)).toMatchObject({
      state: "idle",
      progress: 0.5,
      secondsLeft: 90,
      influence: 120,
      earning: true,
    });
    expect(congressDial(EMPTY, viewer(), 1650).state).toBe("soon");
    expect(
      congressDial(EMPTY, viewer({ status: "aggressing" }), 0).earning,
    ).toBe(false);
  });

  test("before the clock schedules the first session, it idles empty", () => {
    expect(
      congressDial({ ...EMPTY, nextSessionTick: 0 }, viewer(), 50),
    ).toMatchObject({ state: "idle", progress: 0, secondsLeft: 0 });
  });

  test("voting: time left and the items I haven't voted on", () => {
    const data: CongressData = {
      ...EMPTY,
      session: {
        id: 4,
        kind: "regular",
        openTick: 1800,
        closeTick: 2100,
        items: [
          {
            resolution: "sanction",
            targets: [2],
            param: null,
            reason: "aggressor",
            reasonValue: 2.1,
            voters: 3,
          },
          {
            resolution: "research_fund",
            targets: [],
            param: null,
            reason: "global",
            reasonValue: 0,
            voters: 1,
          },
        ],
      },
    };
    const v = viewer({
      ballots: [{ sessionId: 4, item: 0, option: "A", extra: 2 }],
    });
    expect(congressDial(data, v, 1950)).toMatchObject({
      state: "voting",
      progress: 0.5,
      secondsLeft: 15,
      unvoted: 1,
    });
  });

  test("badges: a harmful resolution on me, an emergency I can convene", () => {
    const sanctioned: CongressData = {
      ...EMPTY,
      active: [
        {
          resolution: "sanction",
          option: "A",
          targets: [1],
          param: null,
          sinceTick: 0,
          expires: "next_tally",
        },
      ],
    };
    expect(congressDial(sanctioned, viewer(), 0).targeted).toBe(true);
    const available: CongressData = {
      ...EMPTY,
      available: [{ kind: "nuclear", target: 2, sinceTick: 0 }],
    };
    expect(congressDial(available, viewer(), 0).canConvene).toBe(true);
    expect(
      congressDial(available, viewer({ influence: 49 }), 0).canConvene,
    ).toBe(false);
  });
});

describe("convening from the client", () => {
  const data: CongressData = {
    ...EMPTY,
    available: [{ kind: "aggression", target: 2, sinceTick: 0 }],
  };
  test("mirrors the engine's checks", () => {
    expect(conveneState(data, viewer(), "aggression", 2, 0)).toBeNull();
    expect(conveneState(data, viewer(), "nuclear", 2, 0)).toBe("unavailable");
    expect(conveneState(data, viewer({}, [2]), "aggression", 2, 0)).toBe(
      "friendly",
    );
    expect(
      conveneState(data, viewer({ influence: 10 }), "aggression", 2, 0),
    ).toBe("influence");
    expect(conveneState(data, viewer(), "aggression", 2, 1600)).toBe("window");
    expect(
      conveneState({ ...data, seats: [2, 3] }, viewer(), "aggression", 2, 0),
    ).toBe("seat");
    const sanctioned: CongressData = {
      ...data,
      active: [
        {
          resolution: "sanction",
          option: "A",
          targets: [1],
          param: null,
          sinceTick: 0,
          expires: "next_tally",
        },
      ],
    };
    expect(conveneState(sanctioned, viewer(), "aggression", 2, 0)).toBe(
      "sanctioned",
    );
  });
});

describe("resolutions in force", () => {
  const r = (
    expires: number | "next_tally" | "project_end",
    targets: number[] = [],
  ) => ({
    resolution: "war_tax" as const,
    option: "A" as const,
    targets,
    param: null,
    sinceTick: 0,
    expires,
  });
  test("time left: a tick, the next tally, or the project's end", () => {
    expect(remainingTicks(r(500), EMPTY, 200)).toBe(300);
    expect(remainingTicks(r("next_tally"), EMPTY, 200)).toBe(1900);
    expect(remainingTicks(r("project_end"), EMPTY, 200)).toBeNull();
    const voting: CongressData = {
      ...EMPTY,
      nextSessionTick: 3600,
      session: {
        id: 1,
        kind: "regular",
        openTick: 1800,
        closeTick: 2100,
        items: [],
      },
    };
    expect(remainingTicks(r("next_tally"), voting, 2000)).toBe(100);
  });

  test("chips: mine first, then world rules, then others; at most three", () => {
    const data: CongressData = {
      ...EMPTY,
      active: [
        r("next_tally", [2]),
        r("next_tally"),
        r(900, [1]),
        r("next_tally", [3]),
      ],
    };
    expect(resolutionChips(data, 1, 0).map((c) => [c.mine, c.targets])).toEqual(
      [
        [true, [1]],
        [false, []],
        [false, [2]],
      ],
    );
  });
});

describe("vote cards", () => {
  const data: CongressData = {
    ...EMPTY,
    seats: [2, 3],
    session: {
      id: 9,
      kind: "emergency",
      openTick: 100,
      closeTick: 300,
      items: [
        {
          resolution: "emergency",
          targets: [1],
          param: "nuclear",
          reason: "convened",
          reasonValue: 2,
          voters: 1,
        },
      ],
    },
  };
  test("the target votes though unseated, may only oppose, and sees which side is good for it", () => {
    const [card] = cardModels(data, viewer());
    expect(card).toEqual({
      sessionId: 9,
      index: 0,
      kind: "emergency",
      item: data.session!.items[0],
      closeTick: 300,
      eligible: true,
      bOnly: true,
      myVote: null,
      favorable: "B",
      turnout: { voted: 1, total: 3 },
    });
  });

  test("an ally of the target may only oppose too; others choose freely", () => {
    const onTwo: CongressData = {
      ...data,
      seats: [1, 2, 3],
      session: {
        ...data.session!,
        items: [{ ...data.session!.items[0], targets: [2] }],
      },
    };
    const [ally] = cardModels(onTwo, viewer({}, [2]));
    expect(ally).toMatchObject({
      eligible: true,
      bOnly: true,
      favorable: null,
    });
    const [other] = cardModels(onTwo, viewer());
    expect(other).toMatchObject({ eligible: true, bOnly: false });
  });

  test("extra-vote chips cost what the raise costs and switch off past my influence", () => {
    expect(extraChips(null, 500)).toEqual([]);
    expect(
      extraChips({ sessionId: 1, item: 0, option: "A", extra: 1 }, 50),
    ).toEqual([
      { extra: 2, cost: 20, affordable: true },
      { extra: 3, cost: 50, affordable: true },
      { extra: 4, cost: 90, affordable: false },
      { extra: 5, cost: 140, affordable: false },
    ]);
  });
});

describe("text", () => {
  test("titles name targets or parameters", () => {
    const item = (
      resolution: string,
      targets: number[],
      param: string | null,
    ) => ({ resolution, targets, param }) as never;
    expect(titleText(item("sanction", [2], null), nameOf, t)).toBe(
      "[congress.resolution.sanction.name] · jiho",
    );
    expect(titleText(item("truce", [2, 3], null), nameOf, t)).toBe(
      "[congress.resolution.truce.name] · jiho ↔ seoyeon",
    );
    expect(titleText(item("building_pact", [], "factory"), nameOf, t)).toBe(
      "[congress.resolution.building_pact.name] · [unit_type.factory]",
    );
    expect(titleText(item("law_review", [], "doctrine:B"), nameOf, t)).toBe(
      "[congress.resolution.law_review.name] · [domestic.law.doctrine.B.name]",
    );
    expect(titleText(item("emergency", [2], "nuclear"), nameOf, t)).toBe(
      "[congress.emergency.nuclear] · jiho",
    );
  });

  test("reasons carry names and numbers", () => {
    expect(
      reasonText(
        {
          resolution: "sanction",
          targets: [2],
          param: null,
          reason: "aggressor",
          reasonValue: 2.1,
          voters: 0,
        },
        nameOf,
        t,
      ),
    ).toBe(
      '[congress.reason.aggressor:{"pct":2.1,"ratio":2.1,"count":2.1,"name":"jiho"}]',
    );
  });

  test("clock", () => {
    expect(formatClock(1340)).toBe("2:14");
    expect(formatClock(-5)).toBe("0:00");
  });
});

describe("results and flags", () => {
  test("new results are the ones not seen before; none on the first data", () => {
    const a = {
      sessionId: 1,
      kind: "regular" as const,
      tick: 2100,
      resolution: "war_tax" as const,
      targets: [],
      param: null,
      a: 3,
      b: 1,
      adopted: "A" as const,
    };
    const b = { ...a, sessionId: 2, tick: 3900 };
    expect(newResults(null, [a])).toEqual([]);
    expect(newResults([a], [a, b])).toEqual([b]);
  });

  test("leaderboard flags", () => {
    const data: CongressData = {
      ...EMPTY,
      active: [
        {
          resolution: "sanction",
          option: "A",
          targets: [2],
          param: null,
          sinceTick: 0,
          expires: "next_tally",
        },
        {
          resolution: "truce",
          option: "A",
          targets: [2, 3],
          param: null,
          sinceTick: 0,
          expires: 900,
        },
      ],
      emergency: {
        kind: "nuclear",
        target: 2,
        startTick: 0,
        endTick: 1800,
        goalKind: "silos",
        goal: 2,
        progress: 0,
        members: [3],
        hero: null,
      },
    };
    expect(flagIcons(congressFlags(data, 2))).toBe("⛔🕊🚨");
    expect(flagIcons(congressFlags(data, 3))).toBe("🕊⚔");
    expect(congressFlags(null, 2)).toBe(0);
  });
});
