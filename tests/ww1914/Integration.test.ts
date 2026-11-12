import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import { proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { runEffect, sceneOf } from "@openfront/engine/ww1914/SceneRun";
import { GW_WAR_ORDERS } from "@openfront/engine/ww1914/Tables";
import { declareWar } from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { gwRunner, playChapter, seat } from "./util";

const gwOf = (r: GameRunner): GreatWar => r.game.greatWar()!;
const scene = (id: string) => GW_CONTENT.scenes.find((s) => s.id === id)!;

async function warAt(chapter: number, id: string, plan: "west" | null) {
  const { runner } = await gwRunner({}, id);
  const gw = gwOf(runner);
  gw.s.chain = null;
  gw.s.spark = null;
  while (gw.s.chapter < chapter) playChapter(runner);
  gw.s.plan = plan;
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  return { runner, gw };
}

describe("the shares on the world", () => {
  test("a war with no signature runs on the standing plan, and says so", async () => {
    const { runner, gw } = await warAt(5, "GWI1", null);
    expect(gw.s.plan).toBe("west");
    expect(gw.s.seats[0].flags).toContain("f_west_plan");
    expect(seat(runner).log.map((l) => l.key)).toContain("plan_standing");
  });

  test("signing the chief's ledger signs his paper; returning it leaves the fronts open", async () => {
    const { runner, gw } = await warAt(5, "GWI2", "west");
    playChapter(runner);
    const s = gw.s.seats[0];
    const ctx = { gw, seat: s, cast: {} };
    s.signed = -1;
    const first = proposalsFor(gw, s).find((p) => p.open)!;
    runEffect(ctx, { kind: "world", of: { do: "sign_chief" } });
    expect(s.signed).toBe(gw.s.chapter);
    expect(s.alloc.main).toBe(first.main);
    const back = scene("deu_w_ledger_oct").options!.find(
      (o) => o.id === "return_chief",
    );
    expect(back?.screen).toBe("fronts");
  });

  test("every war order names a scene's real option", () => {
    for (const o of GW_WAR_ORDERS) {
      const ids = (sceneOf(o.scene)?.options ?? []).map((x) => x.id);
      expect(ids, `${o.scene}.${o.pick}`).toContain(o.pick);
    }
  });

  test("a retreat signed moves the line back before the guns", async () => {
    const { runner, gw } = await warAt(5, "GWI3", "west");
    // Since ww171 July's war is Vienna's; Germany comes in by its own
    // signature (treaty_calls). Here it does: the west is its front.
    declareWar(gw, "DEU", "FRA", "test");
    playChapter(runner);
    const s = gw.s.seats[0];
    const west = gw.s.theatres.find((t) => t.id === "west")!;
    west.line = 3;
    west.progress = 0;
    gw.nation("FRA")!.alloc = { ...gw.nation("FRA")!.alloc!, posture: "hold" };
    s.desk = [];
    s.choices.push({
      scene: "deu_w_marne_order",
      pick: "approve",
      chapter: gw.s.chapter,
      proxy: false,
    });
    s.alloc = { ...s.alloc, posture: "hold" };
    s.signed = gw.s.chapter;
    playChapter(runner);
    expect(west.line * 3 + west.progress).toBeLessThan(9);
  });

  test("August's scenes wait for a summer war; a late war gets its own ledger", async () => {
    const { runner, gw } = await warAt(8, "GWI4", "west");
    playChapter(runner);
    const s = gw.s.seats[0];
    expect(s.flags).not.toContain("w_summer_war");
    const desk = s.desk.map((c) => c.scene);
    expect(desk).toContain("deu_w_late_ledger");
    expect(desk.filter((d) => d.startsWith("deu_w_ledger"))).toEqual([]);
  });

  test("a war of the summer raises the flag", async () => {
    const { runner, gw } = await warAt(5, "GWI5", "west");
    playChapter(runner);
    expect(gw.s.seats[0].flags).toContain("w_summer_war");
  });

  test("the delayed visit keeps July's days", async () => {
    let id = 0;
    for (;;) {
      const { runner } = await gwRunner({}, `GWD${id++}`);
      const gw = gwOf(runner);
      if (gw.s.opening !== "sarajevo_delayed") continue;
      playChapter(runner);
      playChapter(runner);
      expect(gw.s.chapter).toBe(2);
      expect(gw.s.chain?.step).toBe(2);
      return;
    }
  }, 60000);

  test("Falkenhayn at the staff leaves Wild at the ministry: two hats, one office each", async () => {
    const { gw } = await warAt(5, "GWI6", "west");
    const s = gw.s.seats[0];
    const opt = scene("deu_w_new_chief").options!.find(
      (o) => o.id === "falkenhayn",
    )!;
    for (const e of opt.effects) runEffect({ gw, seat: s, cast: {} }, e);
    expect(gw.person("deu_falkenhayn")?.office).toBe("chief_of_staff");
    expect(gw.person("deu_wild")?.office).toBe("war");
  });
});

describe("the desk", () => {
  test("news lies above the decisions it asks about", async () => {
    const { runner } = await gwRunner({}, "GWI7");
    const desk = seat(runner).desk;
    const firstDecision = desk.findIndex((c) => c.options.length > 0);
    const lastRead = desk.map((c) => c.options.length === 0).lastIndexOf(true);
    if (firstDecision >= 0 && lastRead >= 0) {
      expect(lastRead).toBeLessThan(firstDecision);
    }
  });

  test("the peace share has a card for every month without a war", () => {
    const peace = GW_CONTENT.scenes.filter(
      (s) => s.id.startsWith("deu_w_peace_") && s.kind !== "talk",
    );
    expect(peace.length).toBeGreaterThanOrEqual(11);
  });
});
