import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwPackSchema,
  GwScenePackSchema,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  character,
  chose,
  decide,
  GwScene,
  gwSceneProblems,
  GwSceneSchema,
  rivalAct,
  rivalStage,
  role,
  schedule,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { GW_RIVAL_ROWS } from "@openfront/engine-lib/ww1914/StoryRows";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { memoirOf } from "@openfront/engine/ww1914/Endings";
import { closeUndecided } from "@openfront/engine/ww1914/SceneRun";
import { describe, expect, test } from "vitest";
import { CAST, decision, node, reply, scene } from "./narrativeFixture";
import { gwRunner, order, playChapter, seat, view } from "./util";

const desk = (r: GameRunner) => seat(r).desk.map((c) => c.scene);
const gw = (r: GameRunner) => r.game.greatWar()!;
const raw = (r: GameRunner) => gw(r).s.seats[0];
const trust = (r: GameRunner, id: string) => gw(r).person(id)!.trust;

const fixturePerson = (id: string, tag: GwPersonDef["tag"]): GwPersonDef => ({
  id,
  tag,
  office: null,
  fit: [],
  camps: [],
  temperaments: ["cold"],
  rivals: [],
  allies: [],
  fame: 3,
  source: "fixture",
});

/** The fixture cast, the rival's row and a foreign ruler. */
const PEOPLE: readonly GwPersonDef[] = [
  ...CAST,
  fixturePerson("deu_tirpitz", "DEU"),
  fixturePerson("deu_falkenhayn", "DEU"),
  fixturePerson("rus_nicholas", "RUS"),
];

async function dealt(
  scenes: GwScene[],
  config: Partial<GameConfig> = {},
  gameID?: string,
): Promise<GameRunner> {
  useGwContent({ scenes, people: PEOPLE });
  return (await gwRunner(config, gameID)).runner;
}

const night = (over: Partial<GwScene> = {}): GwScene =>
  scene("night", {
    kind: "talk",
    big: true,
    salience: 9,
    once: true,
    cast: {
      a: { person: "deu_anxious" },
      b: { person: "deu_arrogant" },
    },
    who: "a",
    start: "n1",
    nodes: {
      n1: node(
        reply("warm", { stance: "warm", next: "n2" }),
        reply("cold", { stance: "cold", next: "n2" }),
      ),
      n2: {
        says: [{ id: "base" }],
        alone: true,
        replies: [decide("wait", "n3")],
      },
      n3: {
        says: [{ id: "base" }],
        who: "b",
        fallback: "hold",
        replies: [decide("sign", null), decide("hold", null)],
      },
    },
    ...over,
  });

const paper = (id: string) =>
  scene(id, {
    silent: true,
    scheduledOnly: true,
    salience: 0,
    tags: ["tension_down"],
  });

function reply1(r: GameRunner, id: string): void {
  const card = seat(r).desk.find((c) => c.kind === "talk")!;
  order(r, { kind: "reply", card: card.uid, reply: id });
}

describe("big scenes", () => {
  test("a chapter's desk is the scene and what can't wait; the rest waits", async () => {
    const r = await dealt([
      night(),
      scene("noise", { salience: 8 }),
      decision("chain", { kind: "crisis", salience: 8 }),
      decision("sure", { essential: true }),
      decision("plain", { salience: 9 }),
    ]);
    expect(desk(r).sort()).toEqual(["chain", "night", "sure"]);
  });

  test("people come in one after another, and mood closes with each", async () => {
    const r = await dealt([night()]);
    const first = seat(r).desk[0];
    expect(first.big).toBe(true);
    expect(first.who).toBe("deu_anxious");
    // Anxious likes warmth; a second warm word would be needed to move trust.
    gw(r).s.seats[0].desk[0].mood = 1;
    reply1(r, "warm");
    expect(trust(r, "deu_anxious")).toBe(1);
    const alone = seat(r).desk[0];
    expect(alone.who).toBeNull();
    expect(raw(r).desk[0].mood).toBe(0);
    reply1(r, "wait");
    expect(seat(r).desk[0].who).toBe("deu_arrogant");
    reply1(r, "sign");
    expect(desk(r)).toEqual([]);
    expect(raw(r).choices.map((c) => c.pick)).toEqual(["warm", "wait", "sign"]);
  });

  test("a decision draws no reaction", async () => {
    const r = await dealt([night()]);
    reply1(r, "cold");
    reply1(r, "wait");
    const before = trust(r, "deu_arrogant");
    reply1(r, "sign");
    expect(trust(r, "deu_arrogant")).toBe(before);
    expect(raw(r).log.filter((l) => l.key.startsWith("talk_"))).toEqual([]);
  });

  test("the silent card that holds comes when it ends", async () => {
    const after = [
      { scene: "paper", when: chose("night", "sign") },
      { scene: "study" },
    ];
    const r = await dealt([night({ after }), paper("paper"), paper("study")]);
    reply1(r, "warm");
    reply1(r, "wait");
    reply1(r, "hold");
    expect(desk(r)).toEqual(["study"]);
    expect(seat(r).desk[0].silent).toBe(true);
    order(r, { kind: "read", card: seat(r).desk[0].uid });
    expect(desk(r)).toEqual([]);
  });

  test("a timer plays it out by each node's fallback", async () => {
    const r = await dealt([night()]);
    closeUndecided(gw(r), raw(r), true);
    expect(raw(r).desk).toEqual([]);
    expect(raw(r).choices.map((c) => c.pick)).toEqual(["warm", "wait", "hold"]);
    expect(raw(r).choices.every((c) => c.proxy)).toBe(true);
    expect(raw(r).log.map((l) => l.key)).toContain("proxy_signed");
  });

  test("two the desk could draw stand three chapters apart", async () => {
    const second = night({ id: "second", when: { kind: "chapter", min: 1 } });
    const r = await dealt([night(), second]);
    expect(desk(r)).toEqual(["night"]);
    playChapter(r);
    expect(desk(r)).toEqual([]);
    playChapter(r);
    expect(desk(r)).toEqual([]);
    playChapter(r);
    expect(desk(r)).toEqual(["second"]);
  });

  test("a scheduled one doesn't wait, and what was due comes after it", async () => {
    const r = await dealt([
      decision("kick", {
        salience: 9,
        once: true,
        options: [
          {
            id: "ok",
            tell: [],
            effects: [schedule("called", 0), schedule("small", 0)],
          },
        ],
      }),
      night({ id: "called", scheduledOnly: true }),
      scene("small", { scheduledOnly: true }),
    ]);
    playChapter(r);
    expect(desk(r)).toEqual(["called"]);
    playChapter(r);
    expect(desk(r)).toEqual(["small"]);
  });

  test("the forms are checked", () => {
    expect(gwSceneProblems(night())).toEqual([]);
    expect(gwSceneProblems(paper("p"))).toEqual([]);
    const summoned = gwSceneProblems(night({ summon: true }));
    expect(summoned.join()).toContain("a big scene is a talk");
    expect(gwSceneProblems(scene("x", { silent: true })).join()).toContain(
      "silent",
    );
    const n = night();
    n.nodes!.n2 = { ...n.nodes!.n2, who: "nobody" };
    expect(gwSceneProblems(n).join()).toContain("who is not a cast role");
  });
});

const rivalScene = (over: Partial<GwScene> = {}): GwScene =>
  decision("meet", {
    cast: { rival_man: { rival_man: true } },
    salience: 9,
    cooldown: 0,
    options: [
      { id: "ok", tell: [], effects: [] },
      { id: "hug", tell: [], effects: [rivalAct("embrace")] },
      { id: "hit", tell: [], effects: [rivalAct("strike")] },
      {
        id: "end",
        tell: [],
        effects: [{ kind: "rival_end", end: "broken" }],
      },
    ],
    ...over,
  });

describe("the rival", () => {
  test("the seed picks from the row, differently across games", async () => {
    useGwContent(null);
    const who = new Set<string | null>();
    for (const id of ["r1", "r2", "r3", "r4", "r5", "r6"]) {
      const { runner } = await gwRunner({}, id);
      who.add(raw(runner).story.rival.who);
    }
    expect(who.size).toBeGreaterThan(1);
    for (const id of who) expect(GW_RIVAL_ROWS.DEU).toContain(id);
  });

  test("hidden: nothing in the view says who or how far", async () => {
    const r = await dealt([]);
    expect(raw(r).story.rival.who).not.toBeNull();
    const before = JSON.stringify(view(r));
    const rival = raw(r).story.rival;
    rival.who = rival.who === "deu_tirpitz" ? "deu_falkenhayn" : "deu_tirpitz";
    rival.stage = 3;
    rival.heat = 99;
    rival.act = "strike";
    expect(JSON.stringify(view(r))).toBe(before);
  });

  test("the stages move with the game, faster at low trust", async () => {
    const r = await dealt([]);
    const a = raw(r).story.rival;
    expect(a.stage).toBe(1);
    const stages: number[] = [];
    for (let i = 0; i < 9; i++) {
      playChapter(r);
      stages.push(raw(r).story.rival.stage);
    }
    expect(stages[0]).toBe(1);
    expect(stages[3]).toBe(2);
    expect(stages[7]).toBe(3);
    const low = await dealt([]);
    gw(low).person(raw(low).story.rival.who!)!.trust = -2;
    playChapter(low);
    playChapter(low);
    expect(raw(low).story.rival.stage).toBe(2);
  });

  test("a scene gated on the stage casts him; embrace cools, strike opens", async () => {
    const r = await dealt([rivalScene({ when: rivalStage(1, 1) })]);
    const card = seat(r).desk[0];
    expect(card.cast.rival_man).toBe(raw(r).story.rival.who);
    raw(r).story.rival.heat = 5;
    order(r, { kind: "choose", card: card.uid, option: "hug" });
    expect(raw(r).story.rival.act).toBe("embrace");
    expect(raw(r).story.rival.heat).toBe(3);
    const s = await dealt([rivalScene()]);
    order(s, { kind: "choose", card: seat(s).desk[0].uid, option: "hit" });
    expect(raw(s).story.rival.stage).toBe(3);
    playChapter(s);
    expect(raw(s).story.rival.stage).toBe(3);
  });

  test("closing the track ends his scenes; the memoir names him", async () => {
    const r = await dealt([rivalScene()]);
    const who = raw(r).story.rival.who!;
    order(r, { kind: "choose", card: seat(r).desk[0].uid, option: "end" });
    expect(raw(r).story.rival.end).toBe("broken");
    playChapter(r);
    playChapter(r);
    expect(desk(r)).toEqual([]);
    expect(memoirOf(gw(r), raw(r)).rival).toMatchObject({
      who,
      end: "broken",
    });
  });

  test("gone by other means closes it plainly", async () => {
    const r = await dealt([]);
    gw(r).person(raw(r).story.rival.who!)!.status = "dead";
    playChapter(r);
    expect(raw(r).story.rival.end).toBe("gone");
  });
});

const nicky = role("other_ruler");
const letter = (over: Partial<GwScene> = {}): GwScene =>
  decision("nicky", {
    kind: "letter",
    who: "other_ruler",
    salience: 9,
    cooldown: 0,
    cast: { other_ruler: { ruler_of: "RUS" } },
    variants: [
      { id: "hard", when: character(nicky, "hardline") },
      { id: "wary", when: character(nicky, "cautious") },
      { id: "sharp", when: character(nicky, "opportunist") },
      { id: "base" },
    ],
    options: [
      {
        id: "warm",
        tell: [],
        effects: [{ kind: "letter", who: nicky, tone: "warm" }],
      },
    ],
    ...over,
  });

describe("letters", () => {
  test("the variant reads the hidden character of that ruler", async () => {
    const seen = new Map<string, string>();
    for (const id of ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"]) {
      const r = await dealt([letter()], {}, id);
      const ai = gw(r).nation("RUS")!.ai;
      const card = seat(r).desk[0];
      expect(card.who).toBe("rus_nicholas");
      expect(card.letterFrom).toBe("RUS");
      if (seen.has(ai)) expect(seen.get(ai)).toBe(card.variant);
      seen.set(ai, card.variant);
    }
    expect(seen.size).toBeGreaterThan(1);
    if (seen.has("principled")) expect(seen.get("principled")).toBe("base");
  });

  test("the thread keeps both ways, and conditions read it", async () => {
    const r = await dealt([
      letter({ once: true }),
      letter({
        id: "second",
        salience: 9,
        when: {
          kind: "all",
          of: [
            { kind: "letters", who: nicky, out: true, tone: "warm" },
            { kind: "letters", who: nicky, out: false, min: 1, max: 1 },
          ],
        },
      }),
    ]);
    expect(raw(r).story.letters).toMatchObject([
      { with: "RUS", out: false, scene: "nicky" },
    ]);
    playChapter(r);
    expect(desk(r)).toEqual(["second"]);
    expect(seat(r).letters?.map((x) => x.out)).toEqual([false, true, false]);
  });

  test("war is read, and a seat's country writes no letters here", async () => {
    const r = await dealt([letter()]);
    const n = gw(r).nation("DEU")!;
    const ctx = { gw: gw(r), seat: raw(r), cast: { x: "rus_nicholas" } };
    const { holds } = await import("@openfront/engine/ww1914/SceneRun");
    const c = { kind: "at_war_with", who: role("x") } as const;
    expect(holds(ctx, c)).toBe(false);
    n.atWar.push("RUS");
    expect(holds(ctx, c)).toBe(true);
    const own = await dealt([
      letter({ cast: { other_ruler: { ruler_of: "DEU" } } }),
    ]);
    expect(desk(own)).toEqual([]);
  });
});

describe("the opening", () => {
  const circle = (id: string): GwPersonDef => ({
    ...fixturePerson(id, "DEU"),
    office: "court",
  });
  const people = [
    ...PEOPLE.filter((p) => p.tag !== "DEU"),
    fixturePerson("deu_bethmann", "DEU"),
    fixturePerson("deu_jagow", "DEU"),
    fixturePerson("deu_moltke", "DEU"),
    circle("deu_stranger"),
    fixturePerson("deu_tirpitz", "DEU"),
  ];
  const by = (id: string, who: string, over: Partial<GwScene> = {}) =>
    decision(id, { cast: { x: { person: who } }, ...over });
  const scenes = [
    by("near1", "deu_bethmann", { salience: 6 }),
    by("near2", "deu_jagow", { salience: 5 }),
    by("near3", "deu_moltke", { salience: 4 }),
    by("far", "deu_stranger", { salience: 7 }),
  ];
  const start = (config: Partial<GameConfig>, list = scenes) => {
    useGwContent({ scenes: list, people });
    return gwRunner(config).then((x) => x.runner);
  };

  test("no list, no opening", async () => {
    const r = await start({});
    expect(desk(r)).toContain("far");
    expect(desk(r).length).toBeGreaterThan(2);
  });

  test("a nation on the shelf opens as usual", async () => {
    const r = await start({ greatWar1914Played: ["DEU"] });
    expect(desk(r)).toContain("far");
  });

  test("a first game: two cards, about the circle, and only it on the tab", async () => {
    const r = await start({ greatWar1914Played: ["GBR"] });
    expect(desk(r)).toEqual(["near1", "near2"]);
    expect(seat(r).people.map((p) => p.id)).not.toContain("deu_stranger");
    expect(seat(r).people.map((p) => p.id)).toContain("deu_bethmann");
  });

  test("the state brings in whoever it needs, and they stay", async () => {
    const must = by("must", "deu_stranger", { salience: 8, once: true });
    const r = await start({ greatWar1914Played: [] }, [...scenes, must]);
    expect(desk(r)).toContain("must");
    expect(seat(r).people.map((p) => p.id)).toContain("deu_stranger");
  });

  test("it ends after three chapters", async () => {
    const r = await start({ greatWar1914Played: [] });
    for (let i = 0; i < 3; i++) playChapter(r);
    expect(view(r).chapter).toBe(3);
    expect(seat(r).people.map((p) => p.id)).toContain("deu_stranger");
  });

  test("the condition reads it", async () => {
    const first = by("first", "deu_bethmann", {
      when: { kind: "first_game" },
    });
    const a = await start({ greatWar1914Played: [] }, [first]);
    expect(desk(a)).toEqual(["first"]);
    const b = await start({ greatWar1914Played: ["DEU"] }, [first]);
    expect(desk(b)).toEqual([]);
  });
});

describe("the content", () => {
  test("the shapes writers use pass the schema", () => {
    const after = [{ scene: "p", when: chose("night", "sign") }];
    for (const x of [night({ after }), paper("p"), rivalScene(), letter()]) {
      expect(() => GwSceneSchema.parse(x), x.id).not.toThrow();
      expect(gwSceneProblems(x)).toEqual([]);
    }
    const nodes = {
      n: { says: { base: "말" }, replies: {}, at: "밤", room: "문" },
    };
    const pack = { title: "t", text: { base: "b" }, nodes };
    expect(() => GwScenePackSchema.parse(pack)).not.toThrow();
    const rivals = { deu_tirpitz: { broken: "끝났다." } };
    const full = { version: 1, scenes: {}, people: {}, rivals };
    expect(GwPackSchema.parse(full).rivals).toEqual(rivals);
  });

  test("rows and heads name real people", async () => {
    useGwContent(null);
    const { GW_HEADS, GW_OPENING_CIRCLE } =
      await import("@openfront/engine-lib/ww1914/StoryRows");
    const ids = new Set(GW_CONTENT.people.map((p) => p.id));
    const named = [
      ...Object.values(GW_RIVAL_ROWS).flat(),
      ...Object.values(GW_OPENING_CIRCLE).flat(),
      ...Object.values(GW_HEADS)
        .flat()
        .map((r) => r.person),
    ];
    for (const id of named) expect(ids.has(id), id).toBe(true);
  });
});
