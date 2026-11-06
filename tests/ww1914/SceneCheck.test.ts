import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  chose,
  flag,
  memory,
  promise,
  reason,
  role,
  schedule,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { describe, expect, test } from "vitest";
import { CAST, decision, node, reply, scene, talk } from "./narrativeFixture";

describe("references across scenes", () => {
  const problems = (...s: Parameters<typeof scene>[]) =>
    gwContentProblems(
      s.map((a) => scene(...a)),
      CAST,
    );

  test("a flag, a memory or a scene nothing provides", () => {
    const list = problems(
      ["a", { when: flag("ghost") }],
      ["b", { when: memory("ghost_key") }],
      ["c", { when: { kind: "seen", scene: "nowhere" } }],
      ["d", { when: chose("nowhere") }],
    ).join();
    expect(list).toContain("flag ghost is never set");
    expect(list).toContain("memory ghost_key is never written");
    expect(list).toContain("seen nowhere");
    expect(list).toContain("chose nowhere");
  });

  test("a pick the scene doesn't have", () => {
    const list = gwContentProblems(
      [decision("d"), scene("a", { when: chose("d", "nope") })],
      CAST,
    );
    expect(list).toEqual(["a: d has no pick nope"]);
  });

  test("what the engine writes counts, and `outside` adds to it", () => {
    const s = [
      scene("a", { when: memory("talk_left") }),
      scene("b", { when: flag("set_by_code") }),
    ];
    expect(gwContentProblems(s, CAST, ["set_by_code"])).toEqual([]);
  });

  test("a promise's keys and its way back", () => {
    const x = role("x");
    const s = [
      talk("t", "deu_cold", {
        open: node(
          reply("r", { effects: [promise(x, "budget", 1, { back: "gone" })] }),
        ),
      }),
      scene("a", { when: memory("broke_budget") }),
    ];
    expect(gwContentProblems(s, CAST)).toEqual(["t: back gone is no scene"]);
  });

  test("a scheduled scene nothing schedules, a person nobody wrote", () => {
    const list = gwContentProblems(
      [
        scene("a", { scheduledOnly: true }),
        scene("b", { cast: { x: { person: "deu_nobody" } } }),
        decision("c", {
          options: [{ id: "ok", tell: [], effects: [schedule("gone", 1)] }],
        }),
      ],
      CAST,
    ).join();
    expect(list).toContain("nothing schedules it");
    expect(list).toContain("no person deu_nobody");
    expect(list).toContain("schedule gone is no scene");
  });
});

describe("the pack against the scenes", () => {
  const pack = (over: Partial<GwPack>): GwPack => ({
    version: 1,
    scenes: {},
    people: {},
    ...over,
  });

  test("a missing body, option, why, line, voice and topic", () => {
    const s = [
      decision("d", {
        cast: { cos: { office: "chief_of_staff" } },
        variants: [{ id: "extra" }, { id: "base" }],
        voices: { cos: [{ id: "scared" }] },
        options: [
          { id: "a", tell: [], effects: [] },
          { id: "b", when: flag("x"), tell: [], effects: [] },
        ],
      }),
      talk("t", "deu_cold", { open: node(reply("r")) }),
    ];
    const p = pack({
      scenes: {
        d: { title: "제목", text: { base: "본문." } },
        t: { title: "제목", text: { base: "본문." } },
      },
    });
    const list = gwPackProblems(s, p).join("\n");
    for (const what of [
      "d: no text for variant extra",
      "d: no text for option a",
      "d: no text for why b",
      "d: no text for voice cos.scared",
      "t: no text for open.says.base",
      "t: no text for open.reply.r",
      "t: no text for topic",
    ]) {
      expect(list).toContain(what);
    }
  });

  test("a scene not in the pack", () => {
    expect(gwPackProblems([scene("a")], pack({}))).toEqual([
      "a: not in the pack",
    ]);
  });

  test("two bodies opening alike read as a template", () => {
    const s = [scene("a", { variants: [{ id: "x" }, { id: "base" }] })];
    const p = pack({
      scenes: {
        a: {
          title: "제목",
          text: { x: "비가 왔다. 첫째.", base: "비가 왔다. 둘째." },
        },
      },
    });
    expect(gwPackProblems(s, p).join()).toContain("open alike");
  });

  test("a hole nothing fills; the ones that fill pass", () => {
    const s = [scene("a", { cast: { cos: { office: "chief_of_staff" } } })];
    const text = (base: string) =>
      pack({ scenes: { a: { title: "제목", text: { base } } } });
    const ok = "{cos}이(가) {cos.title}으로 {date}에. {mem.k}, {chose.x}.";
    expect(gwPackProblems(s, text(ok))).toEqual([]);
    expect(gwPackProblems(s, text("{fm}이 왔다.")).join()).toContain(
      "{fm} fills from nothing",
    );
  });

  test("a reason or promise with no text", () => {
    const x = role("x");
    const s = [
      talk("t", "deu_cold", {
        open: {
          says: [{ id: "base" }],
          replies: [
            reply("r", {
              effects: [reason("why_not"), promise(x, "budget", 1)],
            }),
          ],
        },
      }),
    ];
    const p = pack({
      scenes: {
        t: {
          title: "제목",
          text: { base: "본문." },
          topic: "주제",
          nodes: { open: { says: { base: "말." }, replies: { r: "답." } } },
        },
      },
    });
    const list = gwPackProblems(s, p);
    expect(list).toEqual([
      "t: no text for reason why_not",
      "t: no text for promise budget",
    ]);
    expect(gwPackProblems(s, p, ["why_not"])).toHaveLength(1);
  });
});
