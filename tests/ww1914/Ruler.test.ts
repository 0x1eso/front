import { GW_RULER_SIDES } from "@openfront/engine-api/ww1914/GwRuler";
import { GwPackSchema } from "@openfront/engine-api/ww1914/GwPack";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_BROKEN_BODY,
  GW_RULER_BODIES,
  GW_RULER_EVENTS,
  GW_RULER_GATES,
  GW_RULER_MARKS,
  GW_RULERS,
} from "@openfront/engine-lib/ww1914/RulerRows";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import { GreatWar, GreatWarSnapshot } from "@openfront/engine/ww1914/GreatWar";
import { moveRuler, rulerAudiences, rulerStep } from "@openfront/engine/ww1914/Ruler";
import { closeUndecided, holds, pickVariant, sceneOf } from "@openfront/engine/ww1914/SceneRun";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { gwRunner, order, seat, view } from "./util";

const res = (p: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../resources", p), "utf8"),
  );
const SEATS = ["DEU", "GBR", "AUH", "RUS"] as const;

async function fresh(): Promise<GreatWar> {
  const { runner } = await gwRunner();
  return runner.game.greatWar()!;
}

/** Closes a chapter's worth of the rule, and moves the clock on by hand. */
function chapters(gw: GreatWar, n: number, each?: () => void): void {
  for (let i = 0; i < n; i++) {
    each?.();
    rulerStep(gw);
    gw.s.chapter++;
  }
}

describe("the card", () => {
  test("every seat starts with a row, in words the view can carry", async () => {
    const gw = await fresh();
    const r = gw.s.seats[0].ruler;
    expect(r.id).toBe("wilhelm");
    for (const side of GW_RULER_SIDES) {
      expect(r[side]).toBeGreaterThanOrEqual(1);
      expect(r[side]).toBeLessThanOrEqual(5);
    }
  });

  test("the seed nudges the card, inside the row's range", async () => {
    const a = await gwRunner({}, "life-a");
    const b = await gwRunner({}, "life-b");
    const take = (x: typeof a) =>
      x.runner.game.greatWar()!.s.seats[0].ruler;
    const row = GW_RULERS.DEU![0];
    for (const x of [take(a), take(b)]) {
      for (const side of GW_RULER_SIDES) {
        expect(Math.abs(x[side] - row.start[side])).toBeLessThanOrEqual(1);
      }
    }
  });

  test("a move writes its reason on the card and in the log", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    s.ruler.family = 3;
    moveRuler(gw, s, "family", -1, "wilhelm_sons_stay");
    expect(s.ruler.family).toBe(2);
    expect(s.ruler.lines.at(-1)?.key).toBe("wilhelm_sons_stay");
    expect(s.log.some((l) => l.key === "wilhelm_sons_stay")).toBe(true);
  });

  test("a side stops at its ends and says nothing when it can't move", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    s.ruler.health = 5;
    const before = s.ruler.lines.length;
    moveRuler(gw, s, "health", 1, "wilhelm_slept");
    expect(s.ruler.health).toBe(5);
    expect(s.ruler.lines.length).toBe(before);
  });

  test("the person changes with the regime and the card with them", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    gw.nation("DEU")!.regime = "republic";
    rulerStep(gw);
    expect(s.ruler.id).toBeNull();
    expect(view({ game: { greatWar: () => gw } } as never).seats[0].ruler).toBeNull();
  });

  test("a card that is low shortens the working day, never to nothing", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    s.ruler.health = 1;
    expect(rulerAudiences(gw, s, 3)).toBe(2);
    expect(rulerAudiences(gw, s, 1)).toBe(1);
    expect(rulerAudiences(gw, s, 0)).toBe(0);
    s.ruler.health = 4;
    expect(rulerAudiences(gw, s, 3)).toBe(3);
  });

  test("the card survives a snapshot round trip and moves the hash", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    const before = gw.hash();
    moveRuler(gw, s, "conscience", -1, "wilhelm_toll");
    expect(gw.hash()).not.toBe(before);
    const data = GreatWarSnapshot.schema.parse(
      JSON.parse(JSON.stringify(gw.snapshot())),
    );
    const other = await fresh();
    other.restoreState(data);
    expect(other.hash()).toBe(gw.hash());
    expect(other.s.seats[0].ruler).toEqual(s.ruler);
  });
});

describe("the bottoms come with warnings", () => {
  test("ignored twice, the doctors were right: the game is lost", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    s.ruler.health = 0;
    const calls = () =>
      s.scheduled.filter((q) => q.scene === "deu_life_doctors").length;
    rulerStep(gw);
    expect(calls()).toBe(1);
    expect(gw.s.ended).toBeNull();
    s.seen.deu_life_doctors = gw.s.chapter + 1;
    gw.s.chapter += 2;
    rulerStep(gw);
    expect(calls()).toBe(2);
    expect(gw.s.ended).toBeNull();
    gw.s.chapter += 2;
    rulerStep(gw);
    expect(gw.s.ended).toBe("deu_r_death");
  });

  test("rest ends the clock", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    s.ruler.health = 0;
    rulerStep(gw);
    expect(s.ruler.failing).not.toBeNull();
    moveRuler(gw, s, "health", 2, "wilhelm_rested");
    gw.s.chapter += 6;
    rulerStep(gw);
    expect(s.ruler.failing).toBeNull();
    expect(gw.s.ended).toBeNull();
  });

  test("the clock can't run out on a warning never read", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    s.ruler.health = 0;
    rulerStep(gw);
    gw.s.chapter += 9;
    rulerStep(gw);
    expect(gw.s.ended).toBeNull();
    expect(s.scheduled.at(-1)?.scene).toBe("deu_life_doctors");
  });

  test("reputation at the bottom, unanswered, puts the person out", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    s.ruler.reputation = 0;
    rulerStep(gw);
    s.seen.deu_life_shaken = gw.s.chapter + 1;
    gw.s.chapter += 4;
    rulerStep(gw);
    expect(gw.s.ended).toBe("deu_r_removed");
  });

  test("the row that can't die of it doesn't: age has its own written end", () => {
    const fj = GW_RULERS.AUH!.find((r) => r.id === "franz_joseph")!;
    expect(fj.mortal).toBe(false);
    expect(fj.removable).toBe(false);
    expect(fj.shaken).toBeNull();
  });

  test("the fallback of every called scene is the safe one", () => {
    for (const row of Object.values(GW_RULERS).flat()) {
      for (const [id, pick] of [
        [row.doctors, "rest"],
        [row.shaken, null],
      ] as const) {
        const scene = id === null ? null : sceneOf(id);
        if (scene === null) continue;
        const open = scene.options?.find((o) => o.id === scene.fallback);
        expect(open, id!).toBeDefined();
        expect(open!.effects.some((e) => e.kind === "ruler" && e.delta > 0)).toBe(true);
        if (pick !== null) expect(scene.fallback).toBe(pick);
      }
    }
  });
});

describe("conscience", () => {
  test("breaks once, doesn't come back, and calls its scene", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    s.ruler.conscience = 0;
    rulerStep(gw);
    expect(s.ruler.broken).toBe(gw.s.chapter);
    expect(s.scheduled.at(-1)?.scene).toBe("deu_life_broken");
    moveRuler(gw, s, "conscience", 2, "wilhelm_prayed");
    expect(s.ruler.conscience).toBe(0);
  });

  test("once broken its body beats every other a decision has", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    const scene = GW_CONTENT.scenes.find((x) => x.id === "deu_f_ledger")!;
    expect(scene.variants[0].id).toBe(GW_BROKEN_BODY);
    const ctx = { gw, seat: s, cast: {} };
    const whole = pickVariant(ctx, scene.variants, 7);
    expect(whole).not.toBe(GW_BROKEN_BODY);
    s.ruler.broken = gw.s.chapter;
    expect(pickVariant(ctx, scene.variants, 7)).toBe(GW_BROKEN_BODY);
  });

  test("the hand stops before it breaks, and signs again after", async () => {
    const gw = await fresh();
    const s = gw.s.seats[0];
    const scene = GW_CONTENT.scenes.find(
      (x) => x.id === "deu_f_spring_plan",
    )!;
    const o = scene.options!.find((x) => x.id === "michael")!;
    const open = () => holds({ gw, seat: s, cast: {} }, o.when!);
    s.ruler.conscience = 4;
    expect(open()).toBe(true);
    s.ruler.conscience = 2;
    expect(open()).toBe(false);
    s.ruler.conscience = 0;
    expect(open()).toBe(true);
  });

  test("the price of a mark shows on the option and is paid", async () => {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const s = gw.s.seats[0];
    const scene = GW_CONTENT.scenes.find((x) => x.id === "deu_w_ypres_boys")!;
    const o = scene.options!.find((x) => x.id === "attack")!;
    expect(o.tell).toContain("conscience:-1");
    expect(o.effects).toContainEqual({
      kind: "ruler",
      side: "conscience",
      delta: -1,
      key: "wilhelm_sent",
    });
    expect(s.ruler.id).toBe("wilhelm");
    expect(seat(runner).ruler?.id).toBe("wilhelm");
    closeUndecided(gw, s, false);
    order(runner, { kind: "ready", chapter: view(runner).chapter, on: true });
  });
});

describe("the rows", () => {
  const scene = (id: string) => GW_CONTENT.scenes.find((x) => x.id === id);

  test("every mark and event points at something written", () => {
    for (const m of GW_RULER_MARKS) {
      const s = scene(m.scene);
      expect(s, m.scene).toBeDefined();
      expect(s!.options?.some((o) => o.id === m.option), m.option).toBe(true);
    }
    for (const e of GW_RULER_EVENTS) expect(scene(e.scene), e.scene).toBeDefined();
  });

  test("a gate leaves another way open and stands on no written `when`", () => {
    const written = new Map<string, boolean>();
    for (const g of GW_RULER_GATES) {
      const s = scene(g.scene);
      expect(s, g.scene).toBeDefined();
      const o = s!.options!.find((x) => x.id === g.option);
      expect(o, g.option).toBeDefined();
      written.set(`${g.scene}.${g.option}`, true);
      const others = s!.options!.filter(
        (x) => x.id !== g.option && x.when === undefined,
      );
      expect(others.length, g.scene).toBeGreaterThan(0);
    }
  });

  test("a body lies over one country's scene, and over every line it shows", async () => {
    for (const id of GW_RULER_BODIES) {
      const s = scene(id)!;
      expect(s.nation.length, id).toBe(1);
      const pack = await loadGwPack(s.nation[0], async (p) => res(p));
      const t = pack.scenes[id];
      expect(t.text[GW_BROKEN_BODY], id).toBeDefined();
      for (const o of s.options ?? []) {
        expect(t.optBy?.[GW_BROKEN_BODY]?.[o.id], `${id}.${o.id}`).toBeDefined();
      }
    }
  });

  test.each(SEATS)("%s: the card's words and reason lines are all written", async (tag) => {
    const own = GwPackSchema.parse(res(`ww1914/ko/${tag}.ruler.json`));
    for (const row of GW_RULERS[tag]!) {
      const w = own.rulers?.[row.id];
      expect(w, row.id).toBeDefined();
      for (const k of ["age", "toll", "praised", "blamed", "failing", "broken"]) {
        expect(own.reasons?.[`${row.id}_${k}`], `${row.id}_${k}`).toBeDefined();
      }
      if (row.seenEvery !== null) {
        expect(own.reasons?.[`${row.id}_unseen`], row.id).toBeDefined();
      }
      if (row.shaken !== null) {
        expect(own.reasons?.[`${row.id}_shaken`], row.id).toBeDefined();
      }
    }
    const low = tag.toLowerCase();
    expect(own.endings?.[`${low}_r_death`]).toBeDefined();
    expect(own.endings?.[`${low}_r_removed`]).toBeDefined();
  });

  test("no mark sits on anything but one's own men and people", () => {
    // Conscience marks are on offensives and call-ups only: nothing here is a
    // price, a path or a bonus for an atrocity.
    const conscience = GW_RULER_MARKS.filter((m) => m.side === "conscience");
    for (const m of conscience) {
      expect(m.scene).toMatch(/^(deu|gbr|auh|rus)_[wf]_/);
    }
  });

});
