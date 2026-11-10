import { GameType } from "@openfront/engine-api/game/GameTypes";
import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { GBR_PEOPLE } from "@openfront/engine-lib/ww1914/content/people_gbr";
import { GBR_HOME_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/gbr_home";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";
import { order, seat, view } from "./util";

// The fragment joins the GBR pack at merge, so this test reads it on its own.
const pack: GwPack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/GBR.home.json"),
    "utf8",
  ),
);

/** Set by the other shares of Britain, or by lane Y. */
const OUTSIDE = [
  "f_home_rule_lives",
  "k_bal_admiralty",
  "k_birrell_dublin",
  "k_car_lastword",
  "k_car_office",
  "k_chu_back",
  "k_french_shells",
  "k_hall_room40",
  "k_kit_shells",
  "k_king_pledge",
  "k_mck_army",
  "k_mck_stand",
  "k_red_amnesty",
  "k_red_convention",
  "k_han_minutes",
  "broke_p_redmond_badge",
  "m_wilson_leaks",
];
/** Scenes of the other shares that this one reads. */
const OTHER_SHARES = [
  "gbr_c_deputation",
  "gbr_w_fisher_out",
  "gbr_w_march",
  "gbr_w_somme_first",
  // The fall track's second paper (scenes/gov.ts), ww169's 2B gate.
  "gov_gbr_table_2",
];

describe("the home share of Britain", () => {
  const scenes = GBR_HOME_SCENES;

  test("the plan's counts", () => {
    const n = (p: string) => scenes.filter((s) => s.id.startsWith(p)).length;
    expect(n("gbr_h_")).toBe(27);
    expect(n("gbr_t_")).toBe(24);
    expect(n("gbr_v_")).toBe(5);
  });

  test("every scene passes its schema and the scene checks", () => {
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line, with no hole left unfilled", () => {
    expect(gwPackProblems(scenes, pack)).toEqual([]);
  });

  test("no reference leads nowhere, past what the merge brings", () => {
    const problems = gwContentProblems(
      scenes,
      [...GW_PEOPLE, ...GBR_PEOPLE],
      OUTSIDE,
    );
    const expected = (p: string) =>
      OTHER_SHARES.some((x) => p.includes(`${x} is no scene`));
    expect(problems.filter((p) => !expected(p))).toEqual([]);
  });

  test("every talk has an ask, a push, a deal and a way to leave", () => {
    for (const s of scenes.filter((x) => x.kind === "talk")) {
      const kinds = s.nodes![s.start!].replies.map((r) => r.kind);
      for (const k of ["ask", "push", "deal", "leave"] as const) {
        expect(kinds, `${s.id}: ${k}`).toContain(k);
      }
    }
  });

  test("a decision has three to six options, a locked one a way to open", () => {
    // The chair given up is an ending card: its one option closes the game (2B).
    const ending = (x: (typeof scenes)[number]) =>
      x.options!.every((o) => o.tell.includes("ends_game"));
    for (const s of scenes.filter((x) => (x.options ?? []).length > 0)) {
      if (ending(s)) continue;
      expect(s.options!.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.options!.length, s.id).toBeLessThanOrEqual(6);
      expect(s.fallback, s.id).toBeDefined();
    }
  });

  test("the flags the world reads are set where the plan says", () => {
    const sets = (scene: string, option: string, f: string) => {
      const o = scenes
        .find((s) => s.id === scene)!
        .options!.find((x) => x.id === option)!;
      expect(o.effects, `${scene}.${option}`).toContainEqual({
        kind: "flag",
        flag: f,
      });
    };
    sets("gbr_h_coalition", "coalition", "f_coalition");
    sets("gbr_h_coalition", "own_terms", "f_coalition");
    sets("gbr_h_ireland_talks", "lloyd_george_terms", "f_ireland_settled");
    sets("gbr_h_conscription", "single_men", "f_gbr_conscript");
    sets("gbr_h_conscription", "all_men", "f_gbr_conscript");
  });

  test("losing the chair ends the game, behind the fall track (2B)", () => {
    const call = scenes.find((s) => s.id === "gbr_h_palace_call")!;
    expect(call.fallback).toBe("stay_and_fight");
    expect(JSON.stringify(call.when)).toContain("gov_gbr_table_2");
    const chair = scenes.find((s) => s.id === "gbr_h_new_chair")!;
    expect(chair.options!.map((o) => o.id)).toEqual(["end_memoir"]);
    for (const s of scenes) {
      for (const o of s.options ?? []) {
        expect(o.effects).not.toContainEqual({ kind: "flag", flag: "f_pm_lg" });
      }
    }
  });

  test("every stop leads to a halt: no option orders a death", () => {
    const stop = scenes.find((s) => s.id === "gbr_h_stop")!;
    expect(stop.options!.map((o) => o.id)).toEqual([
      "wire_stop",
      "go_to_dublin",
      "amnesty_word",
    ]);
    for (const o of stop.options!) {
      expect(o.effects).toContainEqual({
        kind: "flag",
        flag: "f_gbr_courts_stopped",
      });
    }
    const record = scenes.find((s) => s.id === "gbr_h_dublin_record")!;
    expect(record.options ?? []).toEqual([]);
  });

  test("a British seat summons Lloyd George and walks the budget talk", async () => {
    const { runner } = await wwRunnerCapture(
      { greatWar1914: true, gameType: GameType.Singleplayer },
      [{ clientID: HUMAN, country: "GBR" }],
    );
    step(runner, 2);
    expect(view(runner).chapter).toBe(0);
    order(runner, {
      kind: "summon",
      person: "gbr_lloyd_george",
      topic: "gbr_t_lg_budget",
    });
    const card = seat(runner).desk.find((c) => c.scene === "gbr_t_lg_budget")!;
    expect(card.node).toBe("open");
    order(runner, { kind: "reply", card: card.uid, reply: "stand" });
    const memories = runner.game
      .greatWar()!
      .s.seats[0].memory.map((m) => m.key);
    expect(memories).toContain("k_lg_budget");
  });
});
