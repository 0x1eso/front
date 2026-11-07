import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { crisisStep } from "@openfront/engine/ww1914/Crises";
import { dealDesk, deskCandidates } from "@openfront/engine/ww1914/Desk";
import { researchStep } from "@openfront/engine/ww1914/Eras";
import { homeStep } from "@openfront/engine/ww1914/Home";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const scene = (id: string): GwScene => {
  const s = gwContent().scenes.find((x) => x.id === id);
  if (s === undefined) throw new Error(id);
  return s;
};

async function game() {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  const gw = runner.game.greatWar()!;
  return { gw, s: gw.s, seat: gw.s.seats[0] };
}

describe("what an Austrian run on the screen showed", () => {
  test("one clause more comes back to the same two papers", () => {
    const s = scene("auh_c_serb_second");
    expect(gwSceneProblems(s)).toEqual([]);
    const ids = s.options!.map((o) => o.id);
    expect(ids).toEqual(["break_now", "take_it"]);
    const asked = JSON.stringify(s.when);
    expect(asked).toContain("ask_more");
    expect(JSON.stringify(s.options![0].effects)).toContain("f_auh_broke_off");
    expect(JSON.stringify(s.options![1].effects)).toContain("close_chain");
  });

  test("the first desk starts with the wire, not its answer", () => {
    expect(JSON.stringify(scene("auh_c_who_signs").when)).toContain('"min":1');
  });

  test("Vienna's signature decides July, not a later spark", async () => {
    const { gw, s, seat } = await game();
    seat.tag = "AUH";
    s.chain = { topic: "straits", step: 4, hold: 0, short: true };
    s.crisis = "straits";
    s.spark = null;
    s.temp = 8;
    crisisStep(gw);
    expect(s.chain?.step).toBe(5);
    crisisStep(gw);
    expect(s.warChapter).not.toBeNull();
  });

  test("with nothing signed, July still closes at Vienna's desk", async () => {
    const { gw, s, seat } = await game();
    seat.tag = "AUH";
    s.chain = { topic: "balkan", step: 4, hold: 0, short: false };
    s.crisis = "balkan";
    s.temp = 8;
    crisisStep(gw);
    expect(s.chain).toBeNull();
    expect(s.warChapter).toBeNull();
  });

  test("a new age of the war is told once", async () => {
    const { gw, s, seat } = await game();
    s.warChapter = 6;
    for (s.chapter = 7; s.chapter < 30; s.chapter++) researchStep(gw);
    const told = seat.memory
      .filter((m) => m.key.startsWith("era_"))
      .map((m) => m.key);
    expect(told.length).toBeGreaterThan(0);
    expect(new Set(told).size).toBe(told.length);
  });

  test("after the armistice a paper of the war no longer comes", async () => {
    const { gw, s, seat } = await game();
    s.chapter = 30;
    s.day = 0;
    s.warChapter = 6;
    const war = (x: GwScene) => x.stage === undefined && x.tags.includes("war");
    s.armistice = { kind: "compromise", chapter: 30, by: null };
    expect(deskCandidates(gw, seat).filter((c) => war(c.scene))).toEqual([]);
    seat.desk = [];
    seat.scheduled = [{ scene: "gw_peace_feeler", chapter: s.chapter }];
    dealDesk(gw, seat);
    expect(seat.desk.some((c) => c.scene === "gw_peace_feeler")).toBe(false);
  });

  test("order that comes and goes doesn't bring the same paper monthly", async () => {
    const { gw, s, seat } = await game();
    const n = gw.nation("DEU")!;
    s.warChapter = 6;
    s.chapter = 20;
    n.side = "central";
    n.atWar = ["FRA"];
    const rung = "gw_home_deu_1";
    const low = () => {
      n.gauges.order = 0;
      n.lowOrder = 1;
      n.unrest = 0;
      seat.scheduled = [];
    };
    low();
    seat.seen[rung] = s.chapter - 2;
    homeStep(gw);
    expect(seat.scheduled.some((q) => q.scene === rung)).toBe(false);
    low();
    seat.seen[rung] = s.chapter - 7;
    homeStep(gw);
    expect(seat.scheduled.some((q) => q.scene === rung)).toBe(true);
  });

  test("prices of a war come only when there is one", () => {
    expect(JSON.stringify(scene("gw_x_prices").when)).toContain("war_age");
  });
});
