import type { GameConfig } from "@openfront/engine-api/Schemas";
import { GwScene, schedule } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  GW_COOLDOWN_DEFAULT,
  GW_DESK_MAX,
} from "@openfront/engine/ww1914/Desk";
import { describe, expect, test } from "vitest";
import { decision, scene, useScenes } from "./narrativeFixture";
import { gwRunner, order, playChapter, seat, view } from "./util";

const desk = (r: GameRunner) => seat(r).desk.map((c) => c.scene);

async function dealt(
  scenes: GwScene[],
  config: Partial<GameConfig> = {},
  gameID?: string,
): Promise<GameRunner> {
  useScenes(scenes);
  return (await gwRunner(config, gameID)).runner;
}

const wires = (n: number, over: Partial<GwScene> = {}) =>
  Array.from({ length: n }, (_, i) => scene(`w${i}`, over));

describe("what comes to the desk", () => {
  test("the most salient that hold, three in a crisis chapter", async () => {
    const r = await dealt([
      scene("low", { salience: 1 }),
      scene("mid", { salience: 4 }),
      scene("high", { salience: 7 }),
      scene("top", { salience: 6 }),
      scene("shut", { salience: 9, when: { kind: "temp", min: 10 } }),
    ]);
    expect(desk(r).sort()).toEqual(["high", "mid", "top"]);
  });

  test("a more specific condition beats a plain one of equal salience", async () => {
    const open = { kind: "temp", min: 0 } as const;
    const r = await dealt([
      scene("plain1"),
      scene("plain2"),
      scene("plain3"),
      scene("plain4"),
      scene("plain5"),
      scene("sharp", {
        when: { kind: "all", of: [open, open, open] },
      }),
    ]);
    expect(desk(r)).toContain("sharp");
  });

  test("a scene of must-see salience takes a place past the usual count", async () => {
    const r = await dealt([...wires(5, { salience: 9 })]);
    expect(desk(r)).toHaveLength(GW_DESK_MAX);
  });

  test("once, cooldown and the default cooldown", async () => {
    const r = await dealt([
      scene("once", { once: true, salience: 9 }),
      scene("every", { cooldown: 1, salience: 8 }),
      scene("plain", { salience: 7 }),
    ]);
    const seenAt: Record<string, number[]> = {};
    for (let ch = 0; ch < 6; ch++) {
      for (const id of desk(r)) (seenAt[id] ??= []).push(ch);
      playChapter(r);
    }
    expect(seenAt.once).toEqual([0]);
    expect(seenAt.every).toEqual([0, 2, 4]);
    expect(seenAt.plain[1] - seenAt.plain[0]).toBe(GW_COOLDOWN_DEFAULT + 1);
  });

  test("a stage and a nation shut a scene out", async () => {
    const r = await dealt([
      scene("later", { stage: ["y1914"] }),
      scene("british", { nation: ["GBR"] }),
      scene("now"),
    ]);
    expect(desk(r)).toEqual(["now"]);
  });
});

describe("the mix", () => {
  test("no full desk of one subject while another can come", async () => {
    const home = wires(6, { salience: 9, tags: ["home"] });
    const r = await dealt([
      ...home,
      scene("war", { salience: 1, tags: ["war"] }),
    ]);
    expect(desk(r)).toHaveLength(GW_DESK_MAX);
    expect(desk(r)).toContain("war");
  });

  test("a card pushes back cards of its kind and subject", async () => {
    const r = await dealt([
      decision("d1", { tags: ["home"], salience: 6 }),
      decision("d2", { tags: ["home"], salience: 6 }),
      decision("d3", { tags: ["home"], salience: 6 }),
      scene("w", { tags: ["foreign"], salience: 5 }),
    ]);
    expect(desk(r)).toContain("w");
  });

  test("one visitor a chapter", async () => {
    const visit = (id: string): GwScene =>
      scene(id, {
        kind: "talk",
        salience: 9,
        cast: { x: { office: "chancellor" } },
        who: "x",
        start: "open",
        nodes: {
          open: {
            says: [{ id: "base" }],
            replies: [
              {
                id: "bye",
                stance: "warm",
                kind: "leave",
                tell: [],
                effects: [],
                next: null,
              },
            ],
          },
        },
      });
    const r = await dealt([visit("v1"), visit("v2"), scene("w")]);
    expect(seat(r).desk.filter((c) => c.kind === "talk")).toHaveLength(1);
  });
});

describe("the tension curve", () => {
  test("a desk of rising tension is followed by a calming card", async () => {
    const up = wires(4, { tags: ["tension_up"], salience: 9, cooldown: 1 });
    const r = await dealt([
      ...up,
      scene("calm", { tags: ["tension_down"], salience: 1 }),
    ]);
    expect(desk(r)).not.toContain("calm");
    const gw = r.game.greatWar()!;
    expect(gw.s.seats[0].tension).toBeGreaterThanOrEqual(2);
    playChapter(r);
    expect(desk(r)).toContain("calm");
  });

  test("calm chapters lift a rising scene over its salience", async () => {
    const r = await dealt([
      scene("a", { salience: 5 }),
      scene("b", { salience: 5 }),
      scene("c", { salience: 5 }),
      scene("rise", { salience: 4, tags: ["tension_up"] }),
    ]);
    expect(desk(r)).toContain("rise");
  });
});

describe("the last two games", () => {
  const five = () => wires(6);

  test("scenes shown lately lose to the rest", async () => {
    const recent = ["w0.base", "w1.base", "w2.base"];
    const r = await dealt(five(), { greatWar1914Recent: recent });
    expect(desk(r).sort()).toEqual(["w3", "w4", "w5"]);
  });

  test("but a must-see scene still comes", async () => {
    const r = await dealt(
      [scene("sarajevo", { salience: 9 }), ...wires(2, { salience: 5 })],
      { greatWar1914Recent: ["sarajevo.base"] },
    );
    expect(desk(r)).toContain("sarajevo");
  });

  test("a scene with an unseen body comes back with that body", async () => {
    const twoBodies: GwScene = scene("both", {
      salience: 9,
      variants: [{ id: "first" }, { id: "second" }],
    });
    const r = await dealt([twoBodies], {
      greatWar1914Recent: ["both.first"],
    });
    expect(seat(r).desk[0].variant).toBe("second");
  });

  test("the list is part of the game: the same list deals the same", async () => {
    const config = { greatWar1914Recent: ["w0.base"] };
    const a = await dealt(five(), config, "GWSAME");
    const b = await dealt(five(), config, "GWSAME");
    expect(desk(a)).toEqual(desk(b));
  });
});

describe("ties", () => {
  test("seeds settle them differently, the same seed alike", async () => {
    const desks = new Set<string>();
    for (const id of ["GWT1", "GWT2", "GWT3", "GWT4", "GWT5"]) {
      const a = await dealt(wires(12), {}, id);
      const b = await dealt(wires(12), {}, id);
      expect(desk(a)).toEqual(desk(b));
      desks.add(desk(a).join());
    }
    expect(desks.size).toBeGreaterThan(1);
  });
});

describe("a quiet chapter", () => {
  const quiet = (id: string, span: { min?: number; max?: number }) =>
    scene(id, {
      quiet: true,
      salience: 0,
      when: { kind: "span", ...span },
    });

  test("nothing to deal: one quiet card, chosen by the chapter's length", async () => {
    const r = await dealt([
      quiet("week", { max: 7 }),
      quiet("month", { min: 8 }),
    ]);
    expect(desk(r)).toEqual(["week"]);
    for (let i = 0; i < 6; i++) playChapter(r);
    expect(view(r).stage).toBe("y1914");
    expect(desk(r)).toEqual(["month"]);
  });

  test("small wires fold into it and aren't read", async () => {
    const r = await dealt([
      quiet("week", { max: 7 }),
      scene("note1", { salience: 1 }),
      scene("note2", { salience: 0 }),
    ]);
    expect(desk(r)).toEqual(["week"]);
    expect(seat(r).desk[0].folded?.slice().sort()).toEqual(["note1", "note2"]);
    expect(seat(r).shown).toEqual(["week.base"]);
    expect(r.game.greatWar()!.s.seats[0].seen.note1).toBe(0);
  });

  test("anything that asks a decision keeps the chapter open", async () => {
    const r = await dealt([
      quiet("week", { max: 7 }),
      scene("note", { salience: 1 }),
      decision("small", { salience: 1 }),
    ]);
    expect(desk(r).sort()).toEqual(["note", "small"]);
  });

  test("the game's own quiet scenes fill an empty desk at every length", async () => {
    const { runner: r } = await gwRunner();
    const gw = r.game.greatWar()!;
    gw.s.seats[0].seen.deu_sample_envoy = 0;
    while (view(r).ended === null) {
      playChapter(r);
      if (view(r).ended !== null) break;
      expect(seat(r).desk.length).toBeGreaterThan(0);
    }
  });
});

describe("what was scheduled", () => {
  test("comes on its chapter, past its stage, whatever the draw", async () => {
    const r = await dealt([
      decision("start", {
        once: true,
        options: [{ id: "ok", tell: [], effects: [schedule("follow", 2)] }],
      }),
      scene("follow", { scheduledOnly: true, stage: ["closing"] }),
    ]);
    expect(desk(r)).toEqual(["start"]);
    playChapter(r);
    expect(desk(r)).toEqual([]);
    playChapter(r);
    expect(desk(r)).toEqual(["follow"]);
  });

  test("never comes by the draw", async () => {
    const r = await dealt([scene("follow", { scheduledOnly: true })]);
    expect(desk(r)).toEqual([]);
  });

  test("past a full desk it waits for the next chapter", async () => {
    const r = await dealt([
      decision("start", {
        once: true,
        options: [
          {
            id: "ok",
            tell: [],
            effects: Array.from({ length: GW_DESK_MAX + 1 }, (_, i) => ({
              kind: "schedule" as const,
              scene: `s${i}`,
              chapters: 1,
            })),
          },
        ],
      }),
      ...Array.from({ length: GW_DESK_MAX + 1 }, (_, i) =>
        scene(`s${i}`, { scheduledOnly: true }),
      ),
    ]);
    playChapter(r);
    expect(desk(r)).toEqual(["s0", "s1", "s2", "s3"]);
    playChapter(r);
    expect(desk(r)).toEqual(["s4"]);
  });

  test("a decision card blocks ready and `order` closes it", async () => {
    const r = await dealt([decision("d")]);
    const card = seat(r).desk[0];
    expect(seat(r).readyBlock).toBe("open_cards");
    order(r, { kind: "choose", card: card.uid, option: "ok" });
    expect(seat(r).readyBlock).toBeNull();
    expect(seat(r).choices?.map((c) => c.pick)).toEqual(["ok"]);
  });
});
