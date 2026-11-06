import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import {
  byName,
  byOffice,
  candid,
  GwScene,
  gwSceneProblems,
  keepPromise,
  memory,
  promise,
  remember,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_STANCE_FIT,
  isCandid,
  stanceFit,
} from "@openfront/engine-lib/ww1914/TalkRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { describe, expect, test } from "vitest";
import { stepTo } from "../ww1936/util";
import {
  decision,
  node,
  reply,
  scene,
  talk,
  useScenes,
} from "./narrativeFixture";
import { gwRunner, order, playChapter, seat, view } from "./util";

const x = role("x");

async function game(scenes: GwScene[], gameType?: GameType) {
  useScenes(scenes);
  const config = gameType === undefined ? {} : { gameType };
  const { runner } = await gwRunner(config);
  const gw = runner.game.greatWar()!;
  return { runner, gw, st: gw.s.seats[0] };
}

const summon = (r: GameRunner, person: string, topic: string) =>
  order(r, { kind: "summon", person, topic });

const openTalk = (r: GameRunner) => seat(r).desk.find((c) => c.kind === "talk");

const say = (r: GameRunner, id: string) =>
  order(r, { kind: "reply", card: openTalk(r)!.uid, reply: id });

const log = (r: GameRunner) => seat(r).log.map((l) => l.key);

describe("how a reply goes down", () => {
  test("the same reply lands on one temperament and not on another", () => {
    const base = { trust: 0, pride: 2 };
    const fit = (temperament: "arrogant" | "cold") =>
      stanceFit({ ...base, temperament }, "flatter", "ask");
    expect(fit("arrogant")).toBe(1);
    expect(fit("cold")).toBe(-1);
  });

  test("every temperament has a stance that works and one that doesn't", () => {
    for (const row of Object.values(GW_STANCE_FIT)) {
      const v = Object.values(row);
      expect(Math.max(...v)).toBe(1);
      expect(Math.min(...v)).toBe(-1);
    }
  });

  test("trust carries a reply; a proud person pushes back", () => {
    const p = { temperament: "cold", trust: 0, pride: 2 } as const;
    expect(stanceFit(p, "threat", "push")).toBe(-1);
    expect(stanceFit({ ...p, trust: 2 }, "threat", "push")).toBe(0);
    expect(stanceFit({ ...p, trust: -2 }, "warm", "ask")).toBe(-1);
    expect(stanceFit({ ...p, pride: 4 }, "warm", "push")).toBe(-1);
    expect(stanceFit({ ...p, pride: 4 }, "warm", "ask")).toBe(0);
  });

  const flatterTalk = (who: string) =>
    talk("t", who, {
      open: node(
        reply("praise", {
          stance: "flatter",
          kind: "push",
          tell: ["trust:-1"],
          effects: [setFlag("price")],
          gain: [setFlag("gain")],
          next: "yes",
          miss: "no",
        }),
      ),
      yes: node(reply("bye", { kind: "leave", stance: "warm" })),
      no: node(reply("bye", { kind: "leave", stance: "warm" })),
    });

  test("a reply that lands pays out and goes to next", async () => {
    const { runner, st } = await game([flatterTalk("deu_arrogant")]);
    summon(runner, "deu_arrogant", "t");
    say(runner, "praise");
    expect(openTalk(runner)!.node).toBe("yes");
    expect(st.flags).toEqual(["price", "gain"]);
  });

  test("one that doesn't still costs its price, and goes to miss", async () => {
    const { runner, st } = await game([flatterTalk("deu_cold")]);
    summon(runner, "deu_cold", "t");
    say(runner, "praise");
    expect(openTalk(runner)!.node).toBe("no");
    expect(st.flags).toEqual(["price"]);
  });

  test("flattery that lands swells pride, a threat that lands wounds it", async () => {
    const { runner, gw } = await game([
      talk("a", "deu_arrogant", {
        open: node(reply("r", { stance: "flatter" })),
      }),
      talk("b", "deu_anxious", {
        open: node(reply("r", { stance: "threat" })),
      }),
    ]);
    summon(runner, "deu_arrogant", "a");
    say(runner, "r");
    summon(runner, "deu_anxious", "b");
    say(runner, "r");
    expect(gw.person("deu_arrogant")!.pride).toBe(3);
    expect(gw.person("deu_anxious")!.pride).toBe(1);
  });

  test("a reacts line wins and reads the seat before the price is paid", async () => {
    const { runner, gw, st } = await game([
      talk("t", "deu_cold", {
        open: node(
          reply("r", {
            stance: "warm",
            effects: [trustOf(x, -1)],
            gain: [setFlag("gain")],
            next: null,
            reacts: [
              {
                when: { kind: "person_trust", who: x, min: 1 },
                next: "more",
                effects: [setFlag("reacted")],
              },
            ],
          }),
        ),
        more: node(reply("bye", { kind: "leave", stance: "warm" })),
      }),
    ]);
    gw.person("deu_cold")!.trust = 1;
    summon(runner, "deu_cold", "t");
    say(runner, "r");
    expect(openTalk(runner)!.node).toBe("more");
    expect(st.flags).toEqual(["reacted"]);
  });
});

describe("what the player learns, and when", () => {
  const twoSteps = (who: string, stance: "frank" | "flatter") =>
    talk("t", who, {
      open: node(reply("a", { stance, next: "two" })),
      two: node(reply("b", { stance, next: null })),
    });

  test("the reaction shows only when the talk has ended", async () => {
    const { runner } = await game([twoSteps("deu_cold", "frank")]);
    summon(runner, "deu_cold", "t");
    say(runner, "a");
    expect(log(runner)).toEqual([]);
    say(runner, "b");
    expect(log(runner)).toEqual(["talk_fit_frank"]);
    expect(seat(runner).log[0].who).toBe("deu_cold");
  });

  test("a talk that went well or badly moves trust, once", async () => {
    const well = await game([twoSteps("deu_cold", "frank")]);
    summon(well.runner, "deu_cold", "t");
    say(well.runner, "a");
    expect(well.gw.person("deu_cold")!.trust).toBe(0);
    say(well.runner, "b");
    expect(well.gw.person("deu_cold")!.trust).toBe(1);
    expect(well.st.memory.map((m) => m.key)).toContain("talk_well");

    const ill = await game([twoSteps("deu_cold", "flatter")]);
    summon(ill.runner, "deu_cold", "t");
    say(ill.runner, "a");
    say(ill.runner, "b");
    expect(ill.gw.person("deu_cold")!.trust).toBe(-1);
    expect(log(ill.runner)).toEqual(["talk_clash_flatter"]);
    expect(ill.st.memory.map((m) => m.key)).toContain("talk_ill");
  });

  test("leaving is remembered, sharply if it was sharp", async () => {
    const { runner, gw } = await game([
      talk("a", "deu_stubborn", {
        open: node(reply("go", { kind: "leave", stance: "warm" })),
      }),
      talk("b", "deu_stubborn", {
        open: node(reply("go", { kind: "leave", stance: "cold" })),
      }),
    ]);
    const mem = () => gw.person("deu_stubborn")!.memory;
    summon(runner, "deu_stubborn", "a");
    say(runner, "go");
    expect(mem().map((m) => [m.key, m.weight])).toEqual([["talk_left", 0]]);
    summon(runner, "deu_stubborn", "b");
    say(runner, "go");
    expect(mem().map((m) => [m.key, m.weight])).toEqual([
      ["talk_left", 0],
      ["talk_left", -1],
    ]);
  });

  test("the view never carries the temperament or the mood", async () => {
    const { runner } = await game([twoSteps("deu_cold", "frank")]);
    summon(runner, "deu_cold", "t");
    say(runner, "a");
    const json = JSON.stringify(view(runner));
    expect(json).not.toContain("mood");
    expect(json).not.toContain("talk_fit");
  });
});

describe("asking", () => {
  const answer = (who: string) =>
    talk("t", who, {
      open: {
        says: [
          { id: "evades", when: { kind: "not", of: candid(x) } },
          { id: "straight", when: candid(x) },
          { id: "base" },
        ],
        replies: [
          reply("again", { stance: "frank", next: "open" }),
          reply("bye", { kind: "leave", stance: "warm" }),
        ],
      },
    });

  test("who answers straight hangs on temperament and trust", () => {
    expect(isCandid({ temperament: "anxious", trust: 0 }, 0)).toBe(true);
    expect(isCandid({ temperament: "cold", trust: 0 }, 0)).toBe(false);
    expect(isCandid({ temperament: "cold", trust: 1 }, 0)).toBe(true);
    expect(isCandid({ temperament: "cunning", trust: 1 }, 0)).toBe(false);
    expect(isCandid({ temperament: "cunning", trust: 1 }, 1)).toBe(true);
  });

  test("the line said follows, and a talk going well opens them up", async () => {
    const { runner } = await game([answer("deu_cold")]);
    summon(runner, "deu_cold", "t");
    expect(openTalk(runner)!.says).toBe("evades");
    say(runner, "again");
    expect(openTalk(runner)!.says).toBe("straight");
  });

  test("the answer can be about what the view hides", async () => {
    const { runner, gw } = await game([
      talk("t", "deu_cold", {
        open: {
          says: [
            {
              id: "sick",
              when: { kind: "health", who: byName("deu_anxious"), max: 1 },
            },
            { id: "base" },
          ],
          replies: [reply("bye", { kind: "leave", stance: "warm" })],
        },
      }),
    ]);
    gw.person("deu_anxious")!.health = 1;
    summon(runner, "deu_cold", "t");
    expect(openTalk(runner)!.says).toBe("sick");
  });
});

describe("topics", () => {
  const bye = () => node(reply("bye", { kind: "leave", stance: "warm" }));
  const topics = (r: GameRunner, id: string) =>
    seat(r).people.find((p) => p.id === id)!.topics;

  test("state opens them, weightiest first, talked-out last", async () => {
    const { runner, st } = await game([
      talk("always", "deu_cold", { open: bye() }, { salience: 1, cooldown: 1 }),
      talk("hot", "deu_cold", { open: bye() }, { salience: 6 }),
      talk(
        "rumour",
        "deu_cold",
        { open: bye() },
        { when: memory("rumour"), salience: 9 },
      ),
    ]);
    expect(topics(runner, "deu_cold")).toEqual(["hot", "always"]);
    st.memory.push({ key: "rumour", who: null, chapter: 0, weight: 0 });
    expect(topics(runner, "deu_cold")).toEqual(["rumour", "hot", "always"]);
    summon(runner, "deu_cold", "hot");
    say(runner, "bye");
    playChapter(runner);
    playChapter(runner);
    playChapter(runner);
    expect(topics(runner, "deu_cold")).toEqual(["rumour", "always", "hot"]);
  });

  test("a stage, once and a cooldown close a topic; a closed one is refused", async () => {
    const { runner } = await game([
      talk("later", "deu_cold", { open: bye() }, { stage: ["y1914"] }),
      talk("single", "deu_cold", { open: bye() }, { once: true }),
    ]);
    expect(topics(runner, "deu_cold")).toEqual(["single"]);
    summon(runner, "deu_cold", "later");
    expect(openTalk(runner)).toBeUndefined();
    summon(runner, "deu_cold", "single");
    say(runner, "bye");
    expect(topics(runner, "deu_cold")).toEqual([]);
    const before = seat(runner).audiences;
    summon(runner, "deu_cold", "single");
    expect(seat(runner).audiences).toBe(before);
  });

  test("a topic can be about someone's rival: the cast finds who", async () => {
    const { runner } = await game([
      scene("t", {
        kind: "talk",
        summon: true,
        cast: { x: { office: "foreign" }, enemy: { rival_of: "x" } },
        who: "x",
        start: "open",
        nodes: { open: bye() },
      }),
    ]);
    summon(runner, "deu_cold", "t");
    expect(openTalk(runner)!.cast).toEqual({
      x: "deu_cold",
      enemy: "deu_stubborn",
    });
  });

  test("summons per chapter come from the calendar and are spent", async () => {
    const { runner } = await game([
      talk("a", "deu_cold", { open: bye() }),
      talk("b", "deu_cold", { open: bye() }),
      talk("c", "deu_cold", { open: bye() }),
      talk("d", "deu_cold", { open: bye() }),
    ]);
    expect(seat(runner).audiences).toBe(3);
    for (const t of ["a", "b", "c"]) {
      summon(runner, "deu_cold", t);
      say(runner, "bye");
    }
    expect(seat(runner).audiences).toBe(0);
    summon(runner, "deu_cold", "d");
    expect(openTalk(runner)).toBeUndefined();
  });
});

describe("a talk opens a decision's option", () => {
  test("closed and greyed until the talk, then it can be signed", async () => {
    const { runner, st } = await game([
      talk("hoyos", "deu_cold", {
        open: node(
          reply("listen", { effects: [remember("heard_hoyos")] }),
          reply("bye", { kind: "leave", stance: "warm" }),
        ),
      }),
      decision("cheque", {
        options: [
          { id: "plain", tell: [], effects: [] },
          {
            id: "term",
            when: memory("heard_hoyos"),
            tell: [],
            effects: [setFlag("term")],
          },
        ],
      }),
    ]);
    const card = () => seat(runner).desk.find((c) => c.scene === "cheque")!;
    const term = () => card().options.find((o) => o.id === "term")!;
    expect(term().open).toBe(false);
    const sign: GwOrder = { kind: "choose", card: card().uid, option: "term" };
    order(runner, sign);
    expect(st.flags).toEqual([]);
    summon(runner, "deu_cold", "hoyos");
    say(runner, "listen");
    expect(term().open).toBe(true);
    order(runner, sign);
    expect(st.flags).toEqual(["term"]);
  });
});

describe("promises", () => {
  const offer = (over: Parameters<typeof promise>[3] = {}) =>
    talk("t", "deu_stubborn", {
      open: node(
        reply("swear", {
          kind: "deal",
          stance: "warm",
          effects: [promise(x, "budget", 1, over)],
        }),
      ),
    });
  const pay = decision("pay", {
    stage: ["crisis"],
    options: [
      {
        id: "yes",
        tell: [],
        effects: [keepPromise(byName("deu_stubborn"), "budget")],
      },
    ],
  });

  test("unkept past due: trust falls and the person comes back", async () => {
    const { runner, gw } = await game([offer(), back()]);
    summon(runner, "deu_stubborn", "t");
    say(runner, "swear");
    expect(seat(runner).promises).toEqual([
      {
        key: "budget",
        who: "deu_stubborn",
        due: "1914-07-05",
        kept: false,
        broken: false,
      },
    ]);
    playChapter(runner);
    expect(seat(runner).desk).toEqual([]);
    expect(gw.person("deu_stubborn")!.trust).toBe(0);
    playChapter(runner);
    expect(gw.person("deu_stubborn")!.trust).toBe(-1);
    expect(seat(runner).promises?.[0].broken).toBe(true);
    const card = openTalk(runner)!;
    expect(card.scene).toBe("gw_promise_broken");
    expect(card.who).toBe("deu_stubborn");
    expect(log(runner)).toContain("promise_broken");
    expect(gw.person("deu_stubborn")!.memory.map((m) => m.key)).toContain(
      "broke_budget",
    );
    // Once: a broken promise isn't broken again.
    say(runner, "bye");
    playChapter(runner);
    expect(openTalk(runner)).toBeUndefined();
    expect(gw.person("deu_stubborn")!.trust).toBe(-1);
  });

  test("a named scene is how they come back", async () => {
    const { runner } = await game([
      offer({ back: "furious" }),
      back(),
      scene("furious", {
        kind: "talk",
        scheduledOnly: true,
        cast: { x: { called: true } },
        who: "x",
        start: "open",
        nodes: { open: node(reply("bye", { kind: "leave", stance: "warm" })) },
      }),
    ]);
    summon(runner, "deu_stubborn", "t");
    say(runner, "swear");
    playChapter(runner);
    playChapter(runner);
    expect(openTalk(runner)!.scene).toBe("furious");
  });

  test("a decision keeps it: thanks instead of a visit", async () => {
    const { runner, gw } = await game([offer(), pay, back()]);
    summon(runner, "deu_stubborn", "t");
    say(runner, "swear");
    playChapter(runner);
    playChapter(runner);
    expect(seat(runner).promises?.[0].kept).toBe(true);
    expect(gw.person("deu_stubborn")!.trust).toBe(1);
    expect(log(runner)).toContain("promise_kept");
    expect(openTalk(runner)).toBeUndefined();
  });

  test("a condition keeps it by itself: the rival is gone", async () => {
    const { runner, gw } = await game([
      offer({
        keep: { kind: "office_empty", office: "foreign" },
      }),
      back(),
    ]);
    summon(runner, "deu_stubborn", "t");
    say(runner, "swear");
    order(runner, { kind: "dismiss", person: "deu_cold" });
    playChapter(runner);
    expect(seat(runner).promises?.[0].kept).toBe(true);
    expect(gw.person("deu_stubborn")!.trust).toBe(1);
  });

  test("the conditions see it: made, kept, broken", async () => {
    const { runner, gw, st } = await game([offer(), back()]);
    const ctxHolds = (broken?: boolean) =>
      st.promises.some((p) => broken === undefined || p.broken === broken);
    expect(ctxHolds()).toBe(false);
    summon(runner, "deu_stubborn", "t");
    say(runner, "swear");
    expect(ctxHolds(false)).toBe(true);
    playChapter(runner);
    playChapter(runner);
    expect(ctxHolds(true)).toBe(true);
    expect(gw.person("deu_stubborn")!.status).toBe("active");
  });

  // The common scene, as the fixture's content replaces the real one.
  function back(): GwScene {
    return scene("gw_promise_broken", {
      kind: "talk",
      scheduledOnly: true,
      cast: { who: { called: true } },
      who: "who",
      start: "open",
      nodes: { open: node(reply("bye", { kind: "leave", stance: "warm" })) },
    });
  }
});

describe("the timer", () => {
  test("a visitor left waiting remembers; the talk's reasons still land", async () => {
    const { runner, gw } = await game(
      [
        scene("v", {
          kind: "talk",
          cast: { x: { office: "foreign" } },
          who: "x",
          start: "open",
          once: true,
          nodes: {
            open: node(reply("a", { stance: "frank", next: "two" })),
            two: node(reply("b", { kind: "leave", stance: "warm" })),
          },
        }),
      ],
      GameType.Private,
    );
    say(runner, "a");
    stepTo(runner, view(runner).deadlineTick! + 2);
    expect(view(runner).chapter).toBe(1);
    expect(gw.person("deu_cold")!.memory.map((m) => m.key)).toContain(
      "talk_left",
    );
    expect(log(runner)).toContain("talk_fit_frank");
    expect(seat(runner).desk).toEqual([]);
  });

  test("a timer's decision is written down as proxied", async () => {
    const { runner } = await game([decision("d")], GameType.Private);
    stepTo(runner, view(runner).deadlineTick! + 2);
    expect(seat(runner).choices).toEqual([
      { scene: "d", pick: "ok", date: "1914-06-28", proxy: true },
    ]);
  });
});

describe("what the checker refuses", () => {
  const problems = (s: GwScene) => gwSceneProblems(s);
  const bye = () => node(reply("bye", { kind: "leave", stance: "warm" }));

  test("a leave reply that goes on", () => {
    const s = talk("t", "a", {
      open: node(reply("go", { kind: "leave", next: "open" })),
    });
    expect(problems(s).join()).toContain("leave reply");
  });

  test("a node nothing reaches, and a node with no way out", () => {
    const s = talk("t", "a", {
      open: node(reply("r", { next: "loop" }), reply("end")),
      loop: node(
        reply("r", { next: "open", when: memory("x") }),
        reply("s", { next: "loop" }),
      ),
      lost: bye(),
    });
    const list = problems(s).join();
    expect(list).toContain("t.lost: node can't be reached");
    expect(list).toContain("t.loop: no way out");
  });

  test("miss goes to a real node", () => {
    const s = talk("t", "a", { open: node(reply("r", { miss: "gone" })) });
    expect(problems(s).join()).toContain("next gone is not a node");
  });

  test("cast links and voices name real roles; a quiet scene is a wire", () => {
    const s = scene("q", {
      kind: "report",
      quiet: true,
      cast: { a: { rival_of: "b" } },
      voices: { z: [{ id: "base" }] },
    });
    const list = problems(s).join();
    expect(list).toContain("b is not a role");
    expect(list).toContain("voices of no role z");
    expect(list).toContain("a quiet scene");
  });

  test("a clean talk has no problems", () => {
    const s = talk("t", "a", {
      open: node(reply("go", { next: "two" }), reply("end")),
      two: bye(),
    });
    expect(problems(s)).toEqual([]);
  });

  test("byOffice names a holder in a condition", async () => {
    const { gw } = await game([]);
    expect(gw.person("deu_cold")!.office).toBe("foreign");
    expect(byOffice("foreign")).toEqual({ office: "foreign" });
  });
});
