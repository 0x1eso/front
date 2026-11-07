import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { temperOf } from "@openfront/engine-api/ww1914/GwPrologue";
import {
  byName,
  decide,
  flag,
  GwEcho,
  GwScene,
  gwSceneProblems,
  past,
  rivalLean,
  rulerTemper,
  setFlag,
  startRuler,
  temper,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  GW_ECHOES,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { withEchoes } from "@openfront/engine-lib/ww1914/content/scenes/prologue_echoes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { describe, expect, test } from "vitest";
import { step } from "../ww1936/util";
import { CAST, node, reply, scene } from "./narrativeFixture";
import { gwRunner, order, seat, view } from "./util";

const gw = (r: GameRunner) => r.game.greatWar()!;
const raw = (r: GameRunner) => gw(r).s.seats[0];

const person = (id: string): GwPersonDef => ({
  ...CAST[4],
  id,
  temperaments: ["cold"],
});
const PEOPLE = [
  ...CAST,
  person("deu_tirpitz"),
  person("deu_falkenhayn"),
  person("deu_crown_prince"),
  person("deu_bethmann"),
];

/** Two choices, the second reading the first; the old man is only in the pack. */
const one = (over: Partial<GwScene> = {}): GwScene =>
  scene("pro_one", {
    kind: "talk",
    big: true,
    scheduledOnly: true,
    prologue: 1,
    salience: 9,
    once: true,
    cast: { old: past("deu_p_bismarck") },
    who: "old",
    start: "n1",
    after: [{ scene: "pro_one_after" }],
    nodes: {
      n1: {
        says: [{ id: "base" }],
        replies: [decide("wait", "n2")],
      },
      n2: {
        says: [{ id: "base" }],
        fallback: "bend",
        replies: [
          decide("bend", null, [
            setFlag("pro_bent"),
            startRuler("family", 1),
            temper("gentle"),
          ]),
          decide("break", null, [
            setFlag("pro_broke"),
            startRuler("family", -9),
            trustOf(byName("deu_cold"), 2),
            temper("arrogant"),
            rivalLean(byName("deu_tirpitz"), 9),
          ]),
        ],
      },
    },
    ...over,
  });

const after = scene("pro_one_after", {
  silent: true,
  scheduledOnly: true,
  salience: 0,
});

const two = scene("pro_two", {
  ...one(),
  id: "pro_two",
  prologue: 2,
  after: undefined,
  variants: [{ id: "hard", when: rulerTemper("arrogant") }, { id: "base" }],
  nodes: {
    n1: { says: [{ id: "base" }], replies: [decide("go", null)] },
  },
  start: "n1",
});

const first = scene("telegram", { salience: 9 });

async function start(
  config: Partial<GameConfig>,
  scenes: GwScene[] = [one(), after, two, first],
  gameID?: string,
): Promise<GameRunner> {
  useGwContent({ scenes, people: PEOPLE });
  return (await gwRunner(config, gameID)).runner;
}

const PLAY = { greatWar1914Prologue: { play: true, picks: [] } };

function answer(r: GameRunner, id: string): void {
  const card = seat(r).desk.find((c) => c.kind === "talk")!;
  order(r, { kind: "reply", card: card.uid, reply: id });
}

function readSilent(r: GameRunner): void {
  const card = seat(r).desk.find((c) => c.silent === true)!;
  order(r, { kind: "read", card: card.uid });
}

/** Through both scenes, taking `pick` at the fork. */
function live(r: GameRunner, pick: string): void {
  answer(r, "wait");
  answer(r, pick);
  readSilent(r);
  answer(r, "go");
  step(r, 2);
}

describe("the prologue", () => {
  test("no lobby field: chapter 0 opens as before, with no state on the seat", async () => {
    const r = await start({});
    expect(seat(r).desk.map((c) => c.scene)).toEqual(["telegram"]);
    expect(raw(r).prologue).toBeUndefined();
    expect(seat(r).prologue).toBeNull();
  });

  test("played: the scenes come in order, then the telegram", async () => {
    const r = await start(PLAY);
    const card = seat(r).desk[0];
    expect(card.scene).toBe("pro_one");
    expect(card.past).toBe(1);
    expect(card.who).toBe("deu_p_bismarck");
    expect(seat(r).prologue).toMatchObject({ step: 1, total: 2, done: false });
    answer(r, "wait");
    answer(r, "break");
    expect(seat(r).desk.map((c) => c.scene)).toEqual(["pro_one_after"]);
    readSilent(r);
    expect(seat(r).desk.map((c) => c.scene)).toEqual(["pro_two"]);
    answer(r, "go");
    step(r, 2);
    expect(seat(r).desk.map((c) => c.scene)).toEqual(["telegram"]);
    expect(seat(r).prologue).toMatchObject({ done: true });
    expect(view(r).chapter).toBe(0);
  });

  test("the world waits: only answers count until it opens", async () => {
    const r = await start(PLAY);
    order(r, { kind: "ready", chapter: 0, on: true });
    order(r, { kind: "dismiss", person: "deu_cold" });
    expect(raw(r).ready).toBe(false);
    expect(gw(r).person("deu_cold")!.office).toBe("foreign");
    step(r, 20);
    expect(seat(r).desk.map((c) => c.scene)).toEqual(["pro_one"]);
  });

  test("a choice leaves ordinary state: card, trust, flag, temper", async () => {
    const r = await start(PLAY);
    const before = raw(r).ruler.family;
    live(r, "break");
    expect(raw(r).flags).toContain("pro_broke");
    expect(raw(r).ruler.family).toBe(1);
    expect(raw(r).ruler.family).toBeLessThan(Math.max(before, 2));
    expect(raw(r).ruler.lines).toEqual([]);
    expect(gw(r).person("deu_cold")!.trust).toBe(2);
    expect(raw(r).prologue?.temper).toBe("arrogant");
  });

  test("a later scene reads what an earlier one left", async () => {
    const r = await start(PLAY);
    answer(r, "wait");
    answer(r, "break");
    readSilent(r);
    expect(seat(r).desk[0].variant).toBe("hard");
  });

  test("the temper is the mark taken most, the later on a tie", () => {
    expect(temperOf([])).toBeNull();
    expect(temperOf(["cold", "gentle"])).toBe("gentle");
    expect(temperOf(["cold", "gentle", "cold"])).toBe("cold");
  });

  test("skipped with picks: the same state as played, with no card shown", async () => {
    const played = await start(PLAY, undefined, "same");
    live(played, "break");
    const picks = seat(played).prologue!.picks;
    expect(picks).toEqual(["pro_one.wait", "pro_one.break", "pro_two.go"]);
    const skipped = await start(
      { greatWar1914Prologue: { play: false, picks: [...picks] } },
      undefined,
      "same",
    );
    expect(seat(skipped).desk.map((c) => c.scene)).toEqual(["telegram"]);
    expect(raw(skipped).flags).toEqual(raw(played).flags);
    expect(raw(skipped).ruler.family).toBe(raw(played).ruler.family);
    expect(raw(skipped).prologue).toEqual(raw(played).prologue);
    expect(raw(skipped).story.rival.who).toBe(raw(played).story.rival.who);
  });

  test("skipped with no picks: neutral, as if it had not been", async () => {
    const plain = await start({}, undefined, "same");
    const skipped = await start(
      { greatWar1914Prologue: { play: false, picks: [] } },
      undefined,
      "same",
    );
    expect(raw(skipped).flags).toEqual([]);
    expect(raw(skipped).ruler).toEqual(raw(plain).ruler);
    expect(raw(skipped).prologue?.temper).toBeNull();
    expect(seat(skipped).desk.map((c) => c.scene)).toEqual(["telegram"]);
  });

  test("a stale pick falls to the node's fallback", async () => {
    const r = await start({
      greatWar1914Prologue: { play: false, picks: ["pro_one.wait"] },
    });
    expect(raw(r).flags).toEqual(["pro_bent"]);
  });

  test("a friends' game has none, whatever the field says", async () => {
    const r = await start({
      ...PLAY,
      gameType: GameType.Private,
    });
    expect(raw(r).prologue).toBeUndefined();
  });

  test("a nation with no scenes goes straight to its desk", async () => {
    const r = await start(PLAY, [first]);
    expect(seat(r).desk.map((c) => c.scene)).toEqual(["telegram"]);
  });

  test("a nudge moves who becomes the rival over many seeds", async () => {
    let pushed = 0;
    let plain = 0;
    const ids = Array.from({ length: 12 }, (_, i) => `seed${i}`);
    for (const id of ids) {
      const a = await start({}, undefined, id);
      if (raw(a).story.rival.who === "deu_tirpitz") plain++;
      const b = await start(
        {
          greatWar1914Prologue: {
            play: false,
            picks: ["pro_one.wait", "pro_one.break", "pro_two.go"],
          },
        },
        undefined,
        id,
      );
      if (raw(b).story.rival.who === "deu_tirpitz") pushed++;
    }
    expect(pushed).toBeGreaterThan(plain);
  });

  test("resumed from a snapshot it goes on where it was", async () => {
    const r = await start(PLAY);
    answer(r, "wait");
    const s = JSON.parse(JSON.stringify(gw(r).snapshot()));
    gw(r).restoreState(s);
    answer(r, "bend");
    readSilent(r);
    expect(seat(r).desk.map((c) => c.scene)).toEqual(["pro_two"]);
  });

  test("the checks: what a prologue scene must be", () => {
    expect(gwSceneProblems(one())).toEqual([]);
    const bad = one({
      cast: { old: { person: "deu_cold" } },
      nodes: {
        n1: node(reply("hello", { tell: ["army:+1"] })),
      },
    });
    const list = gwSceneProblems(bad).join("\n");
    expect(list).toContain("cast by `past`");
    expect(list).toContain("shows no results");
    expect(list).toContain("ends on a decide");
    const stray = scene("stray", {
      kind: "talk",
      cast: { a: { person: "deu_cold" } },
      who: "a",
      start: "n1",
      nodes: { n1: node(reply("x", { effects: [temper("cold")] })) },
    });
    expect(gwSceneProblems(stray).join("\n")).toContain("outside a prologue");
  });

  test("every echo lands on a scene or node that exists", () => {
    const lost = GW_ECHOES.filter((e) => {
      const s = GW_CONTENT.scenes.find((x) => x.id === e.scene);
      return e.node === undefined
        ? s === undefined
        : s?.nodes?.[e.node] === undefined;
    });
    expect(lost).toEqual([]);
  });

  test("a nation's scene numbers don't repeat", () => {
    const rows = GW_CONTENT.scenes.flatMap((s) =>
      s.prologue === undefined ? [] : s.nation.map((t) => `${t}.${s.prologue}`),
    );
    expect(new Set(rows).size).toBe(rows.length);
  });

  test("an echo goes first on a body or a node's line", () => {
    const echoes: GwEcho[] = [
      { scene: "pro_one", id: "bent", when: flag("pro_bent") },
      { scene: "pro_one", node: "n2", id: "bent", when: flag("pro_bent") },
    ];
    const [s] = withEchoes([one()], echoes);
    expect(s.variants.map((v) => v.id)).toEqual(["bent", "base"]);
    expect(s.nodes!.n2.says.map((v) => v.id)).toEqual(["bent", "base"]);
    expect(s.nodes!.n1.says.map((v) => v.id)).toEqual(["base"]);
  });
});
