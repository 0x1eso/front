import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { FRA_WAR_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/fra_war";
import { GW_WAR_ORDERS } from "@openfront/engine/ww1914/Tables";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pack: GwPack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/FRA.war.json"),
    "utf8",
  ),
);

/** Keys and flags the other shares of ww166 write (plan §18). */
const OUTSIDE = [
  "k_fer_front", // W1: Abel Ferry's notebook
  "k_tho_shells", // W3: Thomas on shells
  "f_joffre_free", // W1: the Marne's big scene
  "f_gov_bordeaux", // W1: Bordeaux's big scene
  "f_secret_committee", // W3: the Chamber's secret sitting
];
/** Scenes of the other shares this one reads with `seen`. */
const OTHER_SCENES = ["fra_big_marne"];

describe("France's war share", () => {
  const scenes = FRA_WAR_SCENES;

  test("the plan's counts", () => {
    const n = (p: string) => scenes.filter((s) => s.id.startsWith(p)).length;
    expect(n("fra_w_")).toBe(25);
    // Three big scenes and the quiet card each lays.
    expect(scenes.filter((s) => s.big === true)).toHaveLength(3);
    expect(scenes.filter((s) => s.silent === true)).toHaveLength(3);
    expect(n("fra_t_")).toBe(24);
    expect(n("fra_v_")).toBe(5);
  });

  test("every scene passes its schema and the scene checks", () => {
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line, a brief on every card, no hole unfilled", () => {
    expect(gwPackProblems(scenes, pack)).toEqual([]);
    for (const s of scenes) {
      if (s.silent === true) continue;
      expect(pack.scenes[s.id].brief, s.id).toBeTruthy();
    }
  });

  test("no choice shows its result before the pick", () => {
    for (const s of scenes) {
      for (const o of s.options ?? []) expect(o.tell, s.id).toEqual([]);
      for (const n of Object.values(s.nodes ?? {})) {
        for (const r of n.replies) expect(r.tell, s.id).toEqual([]);
      }
    }
  });

  test("no reference leads nowhere, past what the other shares bring", () => {
    const mine = new Set(scenes.map((s) => s.id));
    const problems = gwContentProblems(
      GW_CONTENT.scenes,
      GW_CONTENT.people,
      OUTSIDE,
    ).filter((p) => mine.has(p.split(/[:.]/)[0]));
    const expected = (p: string) =>
      OTHER_SCENES.some((x) => p.includes(`seen ${x}`));
    expect(problems.filter((p) => !expected(p))).toEqual([]);
  });

  test("every talk has an ask, a push, a deal and a way to leave", () => {
    for (const s of scenes.filter((x) => x.kind === "talk" && !x.big)) {
      const kinds = s.nodes![s.start!].replies.map((r) => r.kind);
      for (const k of ["ask", "push", "deal", "leave"] as const) {
        expect(kinds, `${s.id}: ${k}`).toContain(k);
      }
    }
  });

  test("the mutinies' scene only lessens: no order, no punishment", () => {
    const mutiny = scenes.find((s) => s.id === "fra_big_mutiny")!;
    const kinds = Object.values(mutiny.nodes!).flatMap((n) =>
      n.replies.flatMap((r) => r.effects.map((e) => e.kind)),
    );
    for (const bad of ["end", "dismiss", "roll"]) {
      expect(kinds).not.toContain(bad);
    }
  });

  test("the record cards stand alone: no option, no price", () => {
    for (const id of [
      "fra_w_gas",
      "fra_w_chemin_record",
      "fra_w_mutiny_record",
      "fra_w_paris_gun",
      "fra_w_colonial_front",
    ]) {
      const s = scenes.find((x) => x.id === id)!;
      expect(s.kind).toBe("report");
      expect(s.options ?? []).toEqual([]);
    }
  });

  test("France's war orders name real options of this share", () => {
    const rows = GW_WAR_ORDERS.filter((o) => o.scene.startsWith("fra_"));
    expect(rows.length).toBeGreaterThan(10);
    for (const o of rows) {
      const s = scenes.find((x) => x.id === o.scene);
      expect(
        (s?.options ?? []).map((x) => x.id),
        o.scene,
      ).toContain(o.pick);
    }
  });
});
