import type { GwCastRule } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  byName,
  chose,
  moody,
  remember,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { fadedWeight } from "@openfront/engine-lib/ww1914/TalkRules";
import {
  castOf,
  grudgeOf,
  holds,
  pickVariant,
  runEffect,
  sceneOf,
  specificity,
} from "@openfront/engine/ww1914/SceneRun";
import { describe, expect, test } from "vitest";
import { decision, scene, useScenes } from "./narrativeFixture";
import { gwRunner, order, playChapter, seat } from "./util";

async function game() {
  const { runner } = await gwRunner();
  const gw = runner.game.greatWar()!;
  return { runner, gw, st: gw.s.seats[0] };
}

async function cast(rules: Record<string, GwCastRule>, trust = {}) {
  useScenes([scene("x", { cast: rules, stage: ["closing"] })]);
  const { gw, st } = await game();
  for (const [id, t] of Object.entries(trust)) {
    gw.person(id)!.trust = t as number;
  }
  return castOf(gw, st, sceneOf("x")!);
}

describe("casting", () => {
  test("by office, in the seat's country or a named one", async () => {
    expect(
      await cast({
        fm: { office: "foreign" },
        grey: { office: "foreign", tag: "GBR" },
      }),
    ).toEqual({ fm: "deu_cold", grey: "gbr_grey" });
  });

  test("the rival is the least trusted minister, the favourite the most", async () => {
    const c = await cast(
      { rival: { rival: true }, fav: { favourite: true } },
      { deu_stubborn: -2, deu_cold: 2 },
    );
    expect(c).toEqual({ rival: "deu_stubborn", fav: "deu_cold" });
  });

  test("a rival isn't someone the scene has already cast", async () => {
    const c = await cast(
      { rival: { rival: true }, cos: { office: "chief_of_staff" } },
      { deu_anxious: -3 },
    );
    expect(c!.cos).toBe("deu_anxious");
    expect(c!.rival).not.toBe("deu_anxious");
    // Written order stays: the pack's voices read in it.
    expect(Object.keys(c!)).toEqual(["rival", "cos"]);
  });

  test("a rival or ally of another role, from either side of the link", async () => {
    expect(
      await cast({ enemy: { rival_of: "fm" }, fm: { office: "foreign" } }),
    ).toEqual({ enemy: "deu_stubborn", fm: "deu_cold" });
    expect(
      await cast({ friend: { ally_of: "pm" }, pm: { office: "chancellor" } }),
    ).toEqual({ friend: "deu_cold", pm: "deu_arrogant" });
  });

  test("a camp: a minister first, someone out of office if none is", async () => {
    const civil = await cast({ a: { camp: "civil" } });
    expect(["deu_arrogant", "deu_cold"]).toContain(civil!.a);
    expect(await cast({ a: { camp: "east" } })).toEqual({ a: "deu_cunning" });
    expect(await cast({ a: { camp: "west" } })).toBeNull();
  });

  test("any_of takes the first that finds someone", async () => {
    const c = await cast({
      a: { any_of: [{ office: "navy" }, { office: "war" }] },
    });
    expect(c).toEqual({ a: "deu_stubborn" });
  });

  test("an empty office and a fallen person shut the scene", async () => {
    useScenes([
      scene("x", {
        cast: { a: { office: "chancellor" } },
        stage: ["closing"],
      }),
    ]);
    const { gw, st } = await game();
    expect(castOf(gw, st, sceneOf("x")!)).not.toBeNull();
    gw.person("deu_arrogant")!.status = "fallen";
    expect(castOf(gw, st, sceneOf("x")!)).toBeNull();
  });

  test("called is who the schedule named", async () => {
    useScenes([
      scene("x", { cast: { a: { called: true } }, stage: ["closing"] }),
    ]);
    const { gw, st } = await game();
    expect(castOf(gw, st, sceneOf("x")!)).toBeNull();
    expect(castOf(gw, st, sceneOf("x")!, "deu_cold")).toEqual({
      a: "deu_cold",
    });
  });

  test("a new holder takes over the scene", async () => {
    useScenes([
      scene("x", { cast: { cos: { office: "chief_of_staff" } }, cooldown: 1 }),
    ]);
    const { runner } = await game();
    expect(seat(runner).desk[0].cast.cos).toBe("deu_anxious");
    order(runner, {
      kind: "appoint",
      person: "deu_cunning",
      office: "chief_of_staff",
    });
    playChapter(runner);
    playChapter(runner);
    expect(seat(runner).desk[0].cast.cos).toBe("deu_cunning");
  });
});

describe("variants", () => {
  test("the most specific that holds wins, wherever it is written", async () => {
    const on = { kind: "temp", min: 0 } as const;
    const off = { kind: "temp", min: 99 } as const;
    useScenes([]);
    const { gw, st } = await game();
    const ctx = { gw, seat: st, cast: {} };
    expect(
      pickVariant(ctx, [
        { id: "one", when: on },
        { id: "two", when: { kind: "all", of: [on, on] } },
        { id: "nope", when: { kind: "all", of: [off, off, off] } },
        { id: "base" },
      ]),
    ).toBe("two");
  });

  test("specificity counts leaves, the weakest branch of an any", () => {
    const leaf = { kind: "temp", min: 0 } as const;
    expect(specificity(undefined)).toBe(0);
    expect(specificity(leaf)).toBe(1);
    expect(specificity({ kind: "all", of: [leaf, leaf] })).toBe(2);
    expect(
      specificity({
        kind: "any",
        of: [leaf, { kind: "all", of: [leaf, leaf] }],
      }),
    ).toBe(1);
  });

  test("equal variants take turns: a scene's bodies all come before a repeat", async () => {
    useScenes([
      scene("x", {
        cooldown: 1,
        variants: [{ id: "a" }, { id: "b" }, { id: "c" }],
      }),
    ]);
    const { runner } = await game();
    const bodies: string[] = [];
    for (let i = 0; i < 6; i++) {
      for (const c of seat(runner).desk) bodies.push(c.variant);
      playChapter(runner);
    }
    expect(bodies.slice().sort()).toEqual(["a", "b", "c"]);
  });

  test("the voice follows the person the seed made", async () => {
    const who = role("cos");
    useScenes([
      scene("x", {
        cast: { cos: { office: "chief_of_staff" } },
        voices: {
          cos: [
            { id: "scared", when: moody(who, "anxious") },
            { id: "steady", when: moody(who, "cold") },
            { id: "base" },
          ],
        },
      }),
    ]);
    const { runner } = await game();
    expect(seat(runner).desk[0].voice).toEqual({ cos: "scared" });
  });
});

describe("memory", () => {
  test("a decision is written down and can be called back", async () => {
    useScenes([
      decision("first", {
        once: true,
        options: [
          { id: "yes", tell: [], effects: [] },
          { id: "no", tell: [], effects: [] },
        ],
      }),
      scene("echo", {
        when: chose("first", "no"),
        variants: [
          { id: "fresh", when: { kind: "chose", scene: "first", within: 0 } },
          { id: "base" },
        ],
      }),
    ]);
    const { runner, gw, st } = await game();
    const ctx = { gw, seat: st, cast: {} };
    order(runner, {
      kind: "choose",
      card: seat(runner).desk[0].uid,
      option: "no",
    });
    expect(holds(ctx, chose("first"))).toBe(true);
    expect(holds(ctx, chose("first", "yes"))).toBe(false);
    playChapter(runner);
    expect(seat(runner).desk.map((c) => c.scene)).toEqual(["echo"]);
    expect(seat(runner).desk[0].variant).toBe("base");
    expect(seat(runner).choices?.[0].date).toBe("1914-06-28");
  });

  test("memory has a date the text can use, and an age it can ask", async () => {
    useScenes([decision("d", { stage: ["closing"] })]);
    const { runner, gw, st } = await game();
    const ctx = { gw, seat: st, cast: { x: "deu_cold" } };
    playChapter(runner);
    runEffect(ctx, remember("snub", role("x")));
    const q = (within: number) =>
      holds(ctx, { kind: "memory", key: "snub", within });
    expect(q(0)).toBe(true);
    playChapter(runner);
    playChapter(runner);
    expect(q(1)).toBe(false);
    expect(q(2)).toBe(true);
    expect(seat(runner).memory?.[0]).toEqual({
      key: "snub",
      who: "deu_cold",
      date: "1914-07-05",
    });
  });

  test("what a person holds fades towards zero and never past it", async () => {
    expect(fadedWeight(-2, 0)).toBe(-2);
    expect(fadedWeight(-2, 4)).toBe(-1);
    expect(fadedWeight(-2, 8)).toBe(0);
    expect(fadedWeight(-2, 40)).toBe(0);
    expect(fadedWeight(3, 4)).toBe(2);
    useScenes([]);
    const { gw, st } = await game();
    const p = gw.person("deu_cold")!;
    const ctx = { gw, seat: st, cast: {} };
    runEffect(ctx, {
      kind: "remember",
      key: "slight",
      who: byName("deu_cold"),
      weight: -2,
    });
    expect(grudgeOf(p, 0)).toBe(-2);
    expect(grudgeOf(p, 5)).toBe(-1);
    expect(holds(ctx, { kind: "grudge", who: byName("deu_cold"), max: -2 })).toBe(
      true,
    );
  });

  test("forget takes it off the seat and the person", async () => {
    useScenes([]);
    const { gw, st } = await game();
    const ctx = { gw, seat: st, cast: {} };
    const who = byName("deu_cold");
    runEffect(ctx, remember("a", who));
    runEffect(ctx, remember("b", who));
    runEffect(ctx, { kind: "forget", key: "a", who });
    expect(st.memory.map((m) => m.key)).toEqual(["b"]);
    expect(gw.person("deu_cold")!.memory.map((m) => m.key)).toEqual(["b"]);
  });
});

describe("conditions on hidden values", () => {
  test("they read the state and never reach the view", async () => {
    useScenes([]);
    const { runner, gw, st } = await game();
    const ctx = { gw, seat: st, cast: {} };
    const p = gw.person("deu_anxious")!;
    p.competence = [3, 1, 1];
    p.health = 1;
    const who = byName("deu_anxious");
    expect(
      holds(ctx, { kind: "competence", who, field: "war", min: 3 }),
    ).toBe(true);
    expect(
      holds(ctx, { kind: "competence", who, field: "politics", min: 2 }),
    ).toBe(false);
    expect(holds(ctx, { kind: "health", who, max: 1 })).toBe(true);
    const src = gw.s.sources[0];
    expect(
      holds(ctx, {
        kind: "source_band",
        source: src.id,
        min: src.band,
        max: src.band,
      }),
    ).toBe(true);
    runEffect(ctx, { kind: "source", source: src.id, right: true });
    expect(
      holds(ctx, { kind: "source_record", source: src.id, min: 1 }),
    ).toBe(true);
    expect(JSON.stringify(seat(runner))).not.toContain("competence");
  });

  test("offices: in office, empty, a rival in one", async () => {
    useScenes([]);
    const { gw, st } = await game();
    const ctx = { gw, seat: st, cast: {} };
    const who = byName("deu_cold");
    expect(holds(ctx, { kind: "in_office", who })).toBe(true);
    expect(holds(ctx, { kind: "office_empty", office: "navy" })).toBe(true);
    expect(holds(ctx, { kind: "rival_in_office", who })).toBe(true);
    gw.person("deu_stubborn")!.office = null;
    expect(holds(ctx, { kind: "rival_in_office", who })).toBe(false);
  });

  test("roll is seeded, the same key gives the same answer", async () => {
    useScenes([]);
    const { gw, st } = await game();
    const ctx = { gw, seat: st, cast: {} };
    const roll = (pct: number, flag: string) =>
      runEffect(ctx, {
        kind: "roll",
        key: "k",
        pct,
        then: [{ kind: "flag", flag }],
      });
    roll(100, "always");
    roll(0, "never");
    expect(st.flags).toEqual(["always"]);
  });
});
