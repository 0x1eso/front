// World War 1936 P3 (plan Task 17 Step 1, P3 spec §22.5, plan decision
// 30): politics' snapshot oracle on ww1936pol with the test content and a
// few events of this file. Human Germany runs a focus, justifies a war on
// Czechoslovakia, annexes Austria and answers some of its event cards;
// human Czechoslovakia cedes the Sudetenland by a decision; the AI countries choose late (the
// delay list). A copy restored at each moment — mid-focus, a card open,
// mid-transfer, mid-justification, an AI choice on the delay list — runs
// 500 ticks beside the game with the same turns: politics' hash and the
// game hash every tick, the World War state every tick, the snapshot every
// 25. And the turns of a game replay from turn 0, through the wire, to the
// same hash every tick.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { StampedIntent, Turn } from "@openfront/engine-api/Schemas";
import type {
  DecisionDef,
  EventDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import {
  createGameWireContext,
  decodeServerMessage,
  encodeServerMessage,
} from "@openfront/shared/ZbinWire";
import { TestDataMapLoader } from "../util/ScriptedGame";
import {
  hashOf,
  type Moment,
  newRunner,
  replay,
  runLockstep,
  tick,
} from "./lockstep";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, order, pol, POL, wwGameStart, WwHuman } from "./util";

const CSK_HUMAN = "HUMAN002";
const HUMANS: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: CSK_HUMAN, country: "CSK" },
];
/** The test map's Sudetenland (politicsFixture's group). */
const SUDETEN = 13;

const EVENTS: EventDef[] = [
  {
    // Cards for the humans, late choices for the AI, a delayed follow-up.
    id: "t_snap",
    kind: "country",
    receivers: ["DEU", "CSK", "POL", "LTU", "EST", "AUT"],
    trigger: { kind: "always", value: true },
    mtthDays: 12,
    once: "never",
    timeoutSec: 30,
    aiDelayDays: [2, 6],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "pp", amount: 5 },
          { kind: "fire_event", id: "t_snap_later", days: 3 },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [{ kind: "stability", pct: -1 }] },
    ],
  },
  {
    id: "t_snap_later",
    kind: "country",
    once: "never",
    options: [
      { id: "a", ai: { base: 1 }, effects: [{ kind: "pp", amount: 1 }] },
    ],
  },
];
const DECISIONS: DecisionDef[] = [
  {
    // Austria's islands go to Germany first, so the Sudetenland borders a
    // German region (Tyrol) and its cession spreads from there.
    id: "t_anschluss",
    category: "political",
    for: ["DEU"],
    cost: { pp: 10 },
    effects: [{ kind: "annex", target: { tag: "AUT" }, units: "transfer" }],
    ai: { base: 0 },
  },
  {
    id: "t_cede_sudeten",
    category: "political",
    for: ["CSK"],
    cost: { pp: 10 },
    effects: [
      { kind: "transfer_regions", group: "sudetenland", to: { tag: "DEU" } },
    ],
    ai: { base: 0 },
  },
];

beforeEach(() => {
  const base = politicsFixture();
  usePoliticsContent(
    politicsFixture({
      events: [...base.events, ...EVENTS],
      decisions: [...base.decisions, ...DECISIONS],
    }),
  );
});
afterEach(() => usePoliticsContent(null));

async function polFiles() {
  return loadMapFiles(
    new TestDataMapLoader(POL),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
}

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);

/**
 * The humans' turns: Germany's focus on day 1 and its justification on day
 * 5 (at 25% tension, set on day 0: a neutral government's gate), the
 * Anschluss on day 20, its answers to every other card; Czechoslovakia
 * cedes the Sudetenland on day 40.
 */
function humans(g: Game): StampedIntent[] {
  const t = g.ticks();
  const p = pol(g);
  const out: StampedIntent[] = [];
  if (t === dayStart(1) + 2) {
    out.push(order(HUMAN, { kind: "focus_start", focus: "gen_t_a" }));
  }
  if (t === dayStart(5) + 2) {
    const csk = byTag(g, "CSK").smallID();
    out.push(
      order(HUMAN, {
        kind: "justify",
        target: csk,
        goal: "conquer",
        group: "",
      }),
    );
  }
  if (t === dayStart(20) + 2) {
    out.push(
      order(HUMAN, {
        kind: "decision_take",
        decision: "t_anschluss",
        target: 0,
      }),
    );
  }
  if (t === dayStart(40) + 2) {
    out.push(
      order(CSK_HUMAN, {
        kind: "decision_take",
        decision: "t_cede_sudeten",
        target: 0,
      }),
    );
  }
  // Germany answers the cards with an even uid, the day after they come.
  const c = p.country(byTag(g, "DEU").smallID())!;
  for (const card of c.pending) {
    if (card.uid % 2 === 0 && t === card.firedTick + 9) {
      out.push(
        order(HUMAN, { kind: "event_choose", uid: card.uid, option: "b" }),
      );
    }
  }
  return out;
}

/** World tension a neutral government justifies from (25%), from the start. */
function tension(g: Game): void {
  if (g.ticks() === 1) pol(g).wtBp = 3000;
}

const deuPol = (g: Game) => pol(g).country(byTag(g, "DEU").smallID())!;

const FOCUS_EVENT: Moment[] = [
  {
    name: "(a) mid-focus, day 30",
    when: (g) => {
      const c = deuPol(g);
      return (
        g.worldWar()!.day(g.ticks()) >= 30 &&
        c.focus !== null &&
        c.focus.progressMilli > 0
      );
    },
  },
  {
    name: "(b) a human card before its deadline",
    when: (g) =>
      deuPol(g).pending.some(
        (x) => x.deadlineTick > g.ticks() + 50 && x.firedTick < g.ticks(),
      ),
  },
  {
    name: "(d) mid-justification",
    when: (g) => {
      const j = deuPol(g).justification;
      return j !== null && j.progressDays > 3;
    },
  },
  {
    name: "(e) an AI choice on the delay list",
    when: (g) => pol(g).delayed.some((d) => d.kind === "choose"),
  },
  {
    name: "an event on the delay list",
    when: (g) => pol(g).delayed.some((d) => d.kind === "fire"),
  },
];

const TRANSFER: Moment = {
  name: "(c) the tick after the Sudetenland transfer",
  when: (g) => pol(g).legalOwner[SUDETEN] === byTag(g, "DEU").smallID(),
};
const ANSCHLUSS: Moment = {
  name: "the tick after the Anschluss",
  when: (g) => !byTag(g, "AUT").isAlive(),
};

/** Politics' hash, compared on its own too (the game hash holds it). */
function samePolitics(_n: string, _age: number, main: Game, copy: Game): void {
  if (pol(main).hash() !== pol(copy).hash()) {
    throw new Error(`politics hash diverged at tick ${main.ticks()}`);
  }
}

/** The region's victory-point tile is its controller's. */
function vpWithControl(g: Game, region: number): boolean {
  const ww = g.worldWar()!;
  const tile = ww.scenario.vpTile(ww.scenario.region(region)!);
  return g.ownerID(tile) === ww.land.controller[region];
}

describe("politics restores exactly (P3 spec §22.5)", () => {
  test("restoring mid-focus and mid-event continues exactly", async () => {
    const rep = await runLockstep({
      start: wwGameStart({}, HUMANS),
      files: await polFiles(),
      until: dayStart(70),
      window: 500,
      wwEvery: 1,
      fullEvery: 25,
      graphs: true,
      moments: FOCUS_EVENT,
      intents: humans,
      hand: tension,
      afterTick: samePolitics,
    });
    expect(rep.missed).toEqual([]);
  }, 300_000);

  test("restoring mid-transfer keeps the victory-point tile with control", async () => {
    let checked = 0;
    const rep = await runLockstep({
      start: wwGameStart({}, HUMANS),
      files: await polFiles(),
      until: dayStart(41) + 520,
      window: 500,
      wwEvery: 1,
      fullEvery: 25,
      graphs: true,
      moments: [ANSCHLUSS, TRANSFER],
      intents: humans,
      hand: tension,
      onRestore: (n, main, copy) => {
        if (n !== TRANSFER.name) return;
        const deu = byTag(main, "DEU").smallID();
        // The region changed hands peacefully: the tile at once, the rest
        // by the spread (still under way).
        expect(main.worldWar()!.land.controller[SUDETEN]).toBe(deu);
        expect(main.worldWar()!.land.spreads.has(SUDETEN)).toBe(true);
        expect(vpWithControl(main, SUDETEN)).toBe(true);
        expect(vpWithControl(copy, SUDETEN)).toBe(true);
      },
      afterTick: (n, age, main, copy) => {
        samePolitics(n, age, main, copy);
        if (n !== TRANSFER.name) return;
        expect(vpWithControl(copy, SUDETEN)).toBe(true);
        checked++;
      },
    });
    expect(rep.restores.map((r) => r.name)).toEqual([
      ANSCHLUSS.name,
      TRANSFER.name,
    ]);
    expect(checked).toBe(500);
  }, 300_000);

  test("the politics hash matches across two runs", async () => {
    const files = await polFiles();
    const start = wwGameStart({}, HUMANS);
    const a = await newRunner(start, files);
    const b = await newRunner(start, files);
    while (a.game.ticks() < 3000) {
      const turn: Turn = {
        turnNumber: a.game.ticks(),
        intents: humans(a.game),
      };
      for (const r of [a, b]) {
        tick(r, turn);
        tension(r.game);
      }
      expect(pol(b.game).hash()).toBe(pol(a.game).hash());
      expect(hashOf(b.game)).toBe(hashOf(a.game));
    }
    // Something happened: cards came and went, the focus, the cession.
    const c = deuPol(a.game);
    expect(c.focusesDone).toBeGreaterThan(0);
    expect(pol(a.game).legalOwner[SUDETEN]).toBe(
      byTag(a.game, "DEU").smallID(),
    );
  }, 300_000);

  test("a recorded game of humans and AI replays from turn 0 to the same hash", async () => {
    const files = await polFiles();
    const start = wwGameStart({}, HUMANS);
    // The humans' turns only (no test hand: a replay has none). The
    // justification waits for tension, which the cession and the cards'
    // stability do not raise: it is refused, as in a real game.
    const rep = await runLockstep({
      start,
      files,
      until: dayStart(60),
      window: 0,
      wwEvery: 0,
      moments: [],
      intents: humans,
    });
    expect(rep.turns.some((t) => t.intents.length > 0)).toBe(true);
    // As the server relays them (binary turns) and archives them (JSON).
    const ctx = createGameWireContext(start.players);
    const wire = rep.turns.map((turn) => {
      const m = decodeServerMessage(
        encodeServerMessage({ type: "turn", turn }, ctx),
        ctx,
      );
      if (m.type !== "turn") throw new Error("not a turn");
      return JSON.parse(JSON.stringify(m.turn)) as Turn;
    });
    const again = await replay(start, files, wire);
    expect(again).toEqual(rep.hashes);
  }, 300_000);
});
