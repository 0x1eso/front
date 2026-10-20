// World War 1936 P3 (spec §18.2, §18.3, plan decision 15): the history
// beats' data — the first 48 are P0's calendar, 1:1; lane K5 adds its beats
// below the marker, sorted on their own (controller ruling R19) — and the
// beats in the game (Task 3), on the test map ww1936pol with test content.
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  BeatAct,
  DecisionDef,
  EventDef,
  HistoryBeat,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { simpleHash } from "@openfront/engine-lib/Util";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { HISTORY_BEATS } from "@openfront/engine-lib/ww1936/content/history";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { HISTORY } from "@openfront/engine-lib/ww1936/History";
import { idHash, P_BEAT, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  beatPending,
  runBeats,
} from "@openfront/engine/ww1936/politics/HistoryBeats";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, pol, POL, step, stepTo, wwRunnerCapture } from "./util";

describe("history beats", () => {
  const beats = CONTENT.beats;

  it("every P0 calendar entry is a safety beat, in the same order", () => {
    HISTORY.forEach((e, i) => {
      const b = beats[i];
      expect(b, `P0 entry ${i}`).toBeDefined();
      expect(b.date).toBe(e.date);
      expect(b.actor).toBe(e.actor);
      // The Soviet invasion of Poland was undeclared: a join (no
      // guarantees called; controller ruling, lane D fix round 1).
      const kind = b.id === "b1939_09_17_sun_pol" ? "join" : e.kind;
      expect(b.act).toEqual({ kind, target: e.target });
      expect(b.safety).toBe(true);
      expect(b.id).toBe(
        `b${e.date.split("-").join("_")}_${e.actor.toLowerCase()}_${e.target.toLowerCase()}`,
      );
    });
  });

  it("each block is in date order (P0's 48, then the new beats)", () => {
    const blocks = [
      beats.slice(0, HISTORY.length),
      beats.slice(HISTORY.length),
    ];
    for (const block of blocks) {
      for (let i = 1; i < block.length; i++) {
        expect(dayOfDate(block[i].date), block[i].id).toBeGreaterThanOrEqual(
          dayOfDate(block[i - 1].date),
        );
      }
    }
  });

  it("ids are unique and every act names something that exists", () => {
    const ids = beats.map((b) => b.id);
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([]);
    for (const b of beats) {
      expect(COUNTRY_TAGS, b.id).toContain(b.actor);
      const a = b.act;
      switch (a.kind) {
        case "declare":
        case "join":
        case "diplo":
          expect(COUNTRY_TAGS, b.id).toContain(a.target);
          expect(a.target, b.id).not.toBe(b.actor);
          break;
        case "decision":
          expect(CONTENT.decisionIdx.has(a.id), b.id).toBe(true);
          if (a.target !== undefined) expect(COUNTRY_TAGS).toContain(a.target);
          break;
        case "event":
          expect(CONTENT.eventIdx.has(a.id), b.id).toBe(true);
          break;
        case "focus":
          expect(CONTENT.focusIdx.has(a.id), b.id).toBe(true);
          break;
      }
      if (b.windowDays !== undefined) {
        expect(b.windowDays, b.id).toBeGreaterThan(0);
      }
      expect(dayOfDate(b.date), b.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("a decision beat names a target exactly when its decision is targeted", () => {
    for (const b of beats) {
      if (b.act.kind !== "decision") continue;
      const d = CONTENT.decisions[CONTENT.decisionIdx.get(b.act.id)!];
      expect(b.act.target !== undefined, b.id).toBe(d.target !== undefined);
      expect(d.for === "any" || d.for.includes(b.actor), b.id).toBe(true);
    }
  });
});

// ---- In the game (Task 3) ----

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);
const mark = (id: string): Effect => ({ kind: "unlock_decision", id });
const beat = (
  id: string,
  actor: HistoryBeat["actor"],
  act: BeatAct,
  windowDays?: number,
): HistoryBeat => ({
  id,
  date: "1936-01-03",
  actor,
  act,
  ...(windowDays === undefined ? {} : { windowDays }),
});
const TEST_BEATS: HistoryBeat[] = [
  beat("b_t_anschluss", "DEU", { kind: "decision", id: "deu_t_anschluss" }),
  beat("b_t_dear", "DEU", { kind: "decision", id: "t_dear_beat" }, 3),
  beat("b_t_dear30", "DEU", { kind: "decision", id: "t_dear_beat30" }),
  beat("b_t_event", "DEU", { kind: "event", id: "t_beat_event" }),
  beat("b_t_nap", "DEU", { kind: "diplo", order: "nap", target: "POL" }, 3),
  beat("b_t_ita", "DEU", { kind: "declare", target: "ITA" }, 2),
  beat("b_t_pol", "DEU", { kind: "declare", target: "POL" }),
  beat("b_t_gbr", "GBR", { kind: "declare", target: "DEU" }),
];
const B = Object.fromEntries(TEST_BEATS.map((b, i) => [b.id, i]));
const dec = (id: string, d: Partial<DecisionDef>): DecisionDef => ({
  id,
  category: "political",
  for: "any",
  ai: { base: 0 },
  ...d,
});
const TEST_DECISIONS: DecisionDef[] = [
  dec("deu_t_anschluss", {
    for: ["DEU"],
    effects: [
      { kind: "fire_event", id: "t_anschluss_aut", to: { tag: "AUT" } },
    ],
  }),
  dec("t_dear_beat", { cost: { pp: 1000 }, effects: [mark("t_dear_taken")] }),
  dec("t_dear_beat30", {
    cost: { pp: 1000 },
    effects: [mark("t_dear30_taken")],
  }),
];
const TEST_EVENTS: EventDef[] = [
  {
    id: "t_anschluss_aut",
    kind: "country",
    options: [{ id: "a", ai: { base: 1 }, effects: [mark("t_annexed")] }],
  },
  {
    id: "t_beat_event",
    kind: "country",
    options: [
      { id: "a", ai: { base: 1 }, effects: [mark("t_beat_event_got")] },
    ],
  },
];
const testContent = (beats: readonly HistoryBeat[] = TEST_BEATS) =>
  politicsFixture({
    beats,
    decisions: [...politicsFixture().decisions, ...TEST_DECISIONS],
    events: [...politicsFixture().events, ...TEST_EVENTS],
  });

/** Whether `beatId` is skipped in the game `gameID` (plan decisions 2, 16). */
const skippedFor = (gameID: string, beatId: string) =>
  wwRoll(simpleHash(gameID) + 1937, P_BEAT, idHash(beatId), 1) % 10 === 0;

function gameIdWhere(pred: (gameID: string) => boolean): string {
  for (let i = 0; i < 500; i++) {
    const id = `WWBEAT${String(i).padStart(3, "0")}`;
    if (pred(id)) return id;
  }
  throw new Error("no game id");
}

/** Only the beats `keep` are left, due on `day`; `rolled` keeps their rolled skip. */
function onlyBeats(
  p: WwPolitics,
  keep: number[],
  day: number,
  rolled = false,
): void {
  p.beats = p.beats.map((b, j) =>
    keep.includes(j)
      ? { ...b, fireDay: day, skipped: rolled ? b.skipped : false }
      : { ...b, skipped: true },
  );
}

async function game(
  humans: { clientID: string; country: "DEU" | "POL" }[] = [],
  gameID?: string,
): Promise<{ runner: GameRunner; p: WwPolitics }> {
  const { runner } = await wwRunnerCapture({}, humans, POL, gameID);
  step(runner);
  return { runner, p: pol(runner.game) };
}

const ids = (runner: GameRunner) => {
  const g = runner.game;
  const t = (tag: "DEU" | "ITA" | "GBR" | "POL" | "AUT") =>
    byTag(g, tag).smallID();
  return {
    deu: t("DEU"),
    ita: t("ITA"),
    gbr: t("GBR"),
    pl: t("POL"),
    aut: t("AUT"),
  };
};

describe("history beats in the game", () => {
  beforeEach(() => usePoliticsContent(testContent()));
  afterEach(() => usePoliticsContent(null));

  it("the safety net declares the P0 wars when the new path did not", async () => {
    // P0's 48 safety beats only: no new path at all.
    usePoliticsContent(testContent(HISTORY_BEATS.slice(0, HISTORY.length)));
    const at = (id: string) => HISTORY_BEATS.findIndex((b) => b.id === id);
    const [deuPol, gbrDeu] = [
      at("b1939_09_01_deu_pol"),
      at("b1939_09_03_gbr_deu"),
    ];
    const gameID = gameIdWhere(
      (x) =>
        !skippedFor(x, "b1939_09_01_deu_pol") &&
        !skippedFor(x, "b1939_09_03_gbr_deu"),
    );
    // No other path: the beats declare (the pact goes first, a goal is made).
    {
      const { runner, p } = await game([], gameID);
      const { deu, gbr, pl } = ids(runner);
      onlyBeats(p, [deuPol, gbrDeu], 2, true);
      stepTo(runner, dayStart(3));
      const ww = runner.game.worldWar()!;
      expect(ww.isAtWar(deu, pl)).toBe(true);
      expect(ww.isAtWar(gbr, deu)).toBe(true);
      expect(p.isAtWarBlockedByNap(deu, pl)).toBe(false);
      expect(p.hasWarGoal(deu, pl)).toBe(true);
      expect(p.hasWarGoal(gbr, deu)).toBe(true);
      expect(p.beats[deuPol].done && p.beats[gbrDeu].done).toBe(true);
    }
    // A guarantee (or a call to arms, an event) made both wars first: the
    // beats change nothing — the pact stays, no goal is made.
    {
      const { runner, p } = await game([], gameID);
      const { deu, gbr, pl } = ids(runner);
      onlyBeats(p, [deuPol, gbrDeu], 2, true);
      stepTo(runner, dayStart(1));
      const ww = runner.game.worldWar()!;
      ww.setWar(deu, pl, runner.game.ticks());
      ww.setWar(gbr, deu, runner.game.ticks());
      const wars = ww.data().wars;
      stepTo(runner, dayStart(3));
      expect(ww.data().wars).toEqual(wars);
      expect(p.isAtWarBlockedByNap(deu, pl)).toBe(true);
      expect(p.hasWarGoal(deu, pl)).toBe(false);
      expect(p.hasWarGoal(gbr, deu)).toBe(false);
      expect(p.beats[deuPol].done && p.beats[gbrDeu].done).toBe(true);
    }
  });

  it("a skipped Anschluss beat leaves Austria alone that day", async () => {
    for (const skipped of [false, true]) {
      const gameID = gameIdWhere(
        (x) => skippedFor(x, "b_t_anschluss") === skipped,
      );
      const { runner, p } = await game([], gameID);
      const { deu, aut } = ids(runner);
      expect(p.beats[B.b_t_anschluss].skipped).toBe(skipped);
      onlyBeats(p, [B.b_t_anschluss], 2, true);
      // A skipped beat leaves the decision to the general AI (spec §18.6-3).
      expect(beatPending(p, deu, "deu_t_anschluss")).toBe(!skipped);
      expect(beatPending(p, aut, "deu_t_anschluss")).toBe(false);
      stepTo(runner, dayStart(3));
      expect(p.country(aut)!.unlocked.has("t_annexed"), gameID).toBe(!skipped);
      expect(p.country(deu)!.taken.has("deu_t_anschluss")).toBe(!skipped);
      expect(beatPending(p, deu, "deu_t_anschluss")).toBe(false);
    }
  });

  it("a decision beat retries for its window when PP is short", async () => {
    // windowDays 3: tried on days 2, 3, 4; PP arrives for day 4.
    {
      const { runner, p } = await game();
      const { deu } = ids(runner);
      const c = p.country(deu)!;
      onlyBeats(p, [B.b_t_dear, B.b_t_dear30], 2);
      stepTo(runner, dayStart(4));
      expect(p.beats[B.b_t_dear].done).toBe(false);
      expect(beatPending(p, deu, "t_dear_beat")).toBe(true);
      expect(c.unlocked.has("t_dear_taken")).toBe(false);
      c.ppMilli = 1_200_000;
      step(runner);
      expect(c.unlocked.has("t_dear_taken")).toBe(true);
      expect(p.beats[B.b_t_dear].done).toBe(true);
      // The other (window 30 by default) found 200 PP left: still trying.
      expect(p.beats[B.b_t_dear30].done).toBe(false);
      const t = runner.game.ticks();
      runBeats(p, 2 + 29, t);
      expect(p.beats[B.b_t_dear30].done).toBe(false);
      runBeats(p, 2 + 30, t);
      expect(p.beats[B.b_t_dear30].done).toBe(true);
      expect(c.unlocked.has("t_dear30_taken")).toBe(false);
    }
    // No PP in the window: the beat ends on day 5, later PP changes nothing.
    {
      const { runner, p } = await game();
      const { deu } = ids(runner);
      const c = p.country(deu)!;
      onlyBeats(p, [B.b_t_dear], 2);
      stepTo(runner, dayStart(5));
      expect(p.beats[B.b_t_dear].done).toBe(false);
      step(runner);
      expect(p.beats[B.b_t_dear].done).toBe(true);
      c.ppMilli = 1_200_000;
      stepTo(runner, dayStart(8));
      expect(c.unlocked.has("t_dear_taken")).toBe(false);
    }
  });

  it("an event beat fires the event for the actor", async () => {
    const { runner, p } = await game();
    const { deu } = ids(runner);
    onlyBeats(p, [B.b_t_event], 2);
    stepTo(runner, dayStart(2));
    expect(p.country(deu)!.unlocked.has("t_beat_event_got")).toBe(false);
    step(runner);
    expect(p.country(deu)!.unlocked.has("t_beat_event_got")).toBe(true);
    expect(p.country(deu)!.firedOnce.has("t_beat_event")).toBe(true);
    expect(p.beats[B.b_t_event].done).toBe(true);
  });

  it("a diplomacy beat sends its order and retries a refusal in its window", async () => {
    // Germany and Poland already have the 1934 pact: the offer is refused.
    const { runner, p } = await game();
    onlyBeats(p, [B.b_t_nap], 2);
    stepTo(runner, dayStart(5));
    expect(p.beats[B.b_t_nap].done).toBe(false);
    step(runner);
    expect(p.beats[B.b_t_nap].done).toBe(true);
  });

  it("a blocked declaration retries for its window", async () => {
    // Italy is Germany's faction partner on days 2: refused, tried again.
    {
      const { runner, p } = await game();
      const { deu, ita } = ids(runner);
      onlyBeats(p, [B.b_t_ita], 2);
      stepTo(runner, dayStart(3));
      const ww = runner.game.worldWar()!;
      expect(ww.isAtWar(deu, ita)).toBe(false);
      expect(p.beats[B.b_t_ita].done).toBe(false);
      // Italy leaves the Axis: day 3's try declares.
      p.factions[0].members = p.factions[0].members.filter((m) => m !== ita);
      p.factionsChanged();
      step(runner);
      expect(ww.isAtWar(deu, ita)).toBe(true);
      expect(p.beats[B.b_t_ita].done).toBe(true);
    }
    {
      const { runner, p } = await game();
      const { deu, ita } = ids(runner);
      onlyBeats(p, [B.b_t_ita], 2);
      stepTo(runner, dayStart(5));
      expect(p.beats[B.b_t_ita].done).toBe(true);
      expect(runner.game.worldWar()!.isAtWar(deu, ita)).toBe(false);
    }
  });

  it("beats never move a human country", async () => {
    const { runner, p } = await game([{ clientID: HUMAN, country: "DEU" }]);
    const { deu, gbr, pl, aut } = ids(runner);
    const mine = [
      B.b_t_anschluss,
      B.b_t_event,
      B.b_t_nap,
      B.b_t_pol,
      B.b_t_dear,
    ];
    onlyBeats(p, [...mine, B.b_t_gbr], 2);
    p.country(deu)!.ppMilli = 1_200_000;
    stepTo(runner, dayStart(3));
    const ww = runner.game.worldWar()!;
    const c = p.country(deu)!;
    expect(ww.isAtWar(deu, pl)).toBe(false);
    expect(p.isAtWarBlockedByNap(deu, pl)).toBe(true);
    expect(p.hasWarGoal(deu, pl)).toBe(false);
    expect(c.taken.size).toBe(0);
    expect(c.unlocked.size).toBe(0);
    expect(c.pending).toEqual([]);
    expect(p.country(aut)!.unlocked.size).toBe(0);
    for (const i of mine) expect(p.beats[i].done, TEST_BEATS[i].id).toBe(true);
    // An AI's beat against the human country happens (spec §18.8).
    expect(ww.isAtWar(gbr, deu)).toBe(true);
  });
});
