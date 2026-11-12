import { GameType } from "@openfront/engine-api/game/GameTypes";
import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { GW_PEOPLE_COMMON } from "@openfront/engine-lib/ww1914/content/people_common";
import { FRA_PEOPLE } from "@openfront/engine-lib/ww1914/content/people_fra";
import { FRA_HOME_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/fra_home";
import { GW_HOME } from "@openfront/engine/ww1914/HomeTable";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";
import { order, seat, view } from "./util";

const read = (file: string): GwPack =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../resources/ww1914/ko", file),
      "utf8",
    ),
  );
// The share joins the FRA pack at merge, so this test reads it on its own.
const pack = read("FRA.home.json");
/** callPremier's reason lines live in the consultations' pack (lane W5). */
const govReasons = Object.keys(read("FRA.gov.json").reasons ?? {});

/** Set by the other shares of France, or by the engine. */
const OUTSIDE = [
  "f_joffre_free",
  "f_gov_bordeaux",
  "f_pm_clemenceau",
  "f_pm_caillaux",
  "f_pm_painleve",
  "f_pm_briand",
  "k_jof_deputies",
  "k_cai_warned",
  "k_gov_fra_consulted",
];
/** Scenes of the other shares that this one reads. */
const OTHER_SHARES = [
  "fra_c_censorship",
  "fra_f_lancken",
  "fra_t_caillaux_peace",
  "fra_big_mutiny",
  // W5's new premier's list, scheduled by callPremier.
  "gov_fra_cabinet",
];

describe("the home share of France", () => {
  const scenes = FRA_HOME_SCENES;

  test("the plan's counts", () => {
    const n = (p: string) => scenes.filter((s) => s.id.startsWith(p)).length;
    // 26 desk scenes of plan §7 and the top of the ladder.
    // and the four autumn-desk papers of 1458e52b3 (army post, Caillaux
    // back, coal for the cities, first winter).
    expect(n("fra_h_")).toBe(31);
    expect(n("fra_big_")).toBe(1);
    expect(n("fra_t_")).toBe(24);
    expect(n("fra_v_")).toBe(5);
  });

  test("every scene passes its schema and the scene checks", () => {
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line, with a brief on every scene", () => {
    expect(gwPackProblems(scenes, pack, govReasons)).toEqual([]);
    for (const s of scenes) {
      expect(pack.scenes[s.id].brief, s.id).toBeDefined();
    }
  });

  test("no reference leads nowhere, past what the merge brings", () => {
    const problems = gwContentProblems(
      scenes,
      [...GW_PEOPLE, ...GW_PEOPLE_COMMON, ...FRA_PEOPLE],
      OUTSIDE,
    );
    const expected = (p: string) =>
      OTHER_SHARES.some(
        (x) => p.includes(`${x} is no scene`) || p.includes(`${x} has no pick`),
      );
    expect(problems.filter((p) => !expected(p))).toEqual([]);
  });

  test("choices show nothing before the pick", () => {
    for (const s of scenes) {
      for (const o of s.options ?? []) expect(o.tell, s.id).toEqual([]);
      for (const n of Object.values(s.nodes ?? {})) {
        for (const r of n.replies)
          expect(r.tell, `${s.id}.${r.id}`).toEqual([]);
      }
    }
  });

  test("every talk has an ask, a push, a deal and a way to leave", () => {
    for (const s of scenes.filter((x) => x.kind === "talk" && !x.big)) {
      const kinds = s.nodes![s.start!].replies.map((r) => r.kind);
      for (const k of ["ask", "push", "deal", "leave"] as const) {
        expect(kinds, `${s.id}: ${k}`).toContain(k);
      }
    }
  });

  test("a decision has three to six options and a fallback", () => {
    for (const s of scenes.filter((x) => (x.options ?? []).length > 0)) {
      expect(s.options!.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.options!.length, s.id).toBeLessThanOrEqual(6);
      expect(s.fallback, s.id).toBeDefined();
    }
  });

  test("the ladder's top is written, and its way out is the next form", () => {
    for (const id of Object.values(GW_HOME.FRA!.top!)) {
      expect(scenes.some((s) => s.id === id)).toBe(true);
    }
    const top = scenes.find((s) => s.id === "fra_h_top")!;
    expect(top.fallback).toBe("next_regime");
    expect(top.options![0].effects).toContainEqual({
      kind: "world",
      of: { do: "next_regime" },
    });
  });

  test("the flags the other shares read are set where the plan says", () => {
    const sets = (scene: string, option: string, f: string) => {
      const o = scenes
        .find((s) => s.id === scene)!
        .options!.find((x) => x.id === option)!;
      expect(o.effects, `${scene}.${option}`).toContainEqual({
        kind: "flag",
        flag: f,
      });
    };
    sets("fra_h_secret_committee", "allow", "f_secret_committee");
    sets("fra_h_sfio_leaves", "let_go", "f_sfio_out");
  });

  test("calling Clemenceau is a choice on the night, never forced", () => {
    const tiger = scenes.find((s) => s.id === "fra_big_tiger")!;
    const last = tiger.nodes!.n4;
    expect(last.fallback).toBe("painleve_again");
    const call = last.replies.find((r) => r.id === "call_clemenceau")!;
    expect(call.when).toBeUndefined();
    expect(call.effects).toContainEqual({
      kind: "flag",
      flag: "f_pm_clemenceau",
    });
  });

  test("a French seat summons Malvy and hears the police report", async () => {
    const { runner } = await wwRunnerCapture(
      { greatWar1914: true, gameType: GameType.Singleplayer },
      [{ clientID: HUMAN, country: "FRA" }],
    );
    step(runner, 2);
    expect(view(runner).chapter).toBe(0);
    order(runner, {
      kind: "summon",
      person: "fra_malvy",
      topic: "fra_t_malvy_police",
    });
    const card = seat(runner).desk.find(
      (c) => c.scene === "fra_t_malvy_police",
    )!;
    expect(card.node).toBe("open");
    order(runner, { kind: "reply", card: card.uid, reply: "deal" });
    const memories = runner.game
      .greatWar()!
      .s.seats[0].memory.map((m) => m.key);
    expect(memories).toContain("k_mal_police");
  });
});
