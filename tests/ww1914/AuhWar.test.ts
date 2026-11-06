import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { AUH_PEOPLE } from "@openfront/engine-lib/ww1914/content/people_auh";
import { AUH_WAR_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/auh_war";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// The fragment joins AUH.json at merge, so this test reads it on its own.
const pack: GwPack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/AUH.war.json"),
    "utf8",
  ),
);

/** Set by the other shares or by lane Y, not by this file. */
const OUTSIDE = [
  "k_bil_potiorek",
  "k_cz_price",
  "k_karl_front",
  "k_karl_xx",
  "w_auh_karl",
];
/** Scenes of the other shares that this one reads with `chose`. */
const OTHER_SHARES = [
  "auh_c_b_staffel",
  "auh_h_factory_law",
  "auh_h_food_committee",
  "auh_h_italy_offer",
  "auh_h_romania_offer",
  "auh_h_shell_output",
];
/** Plan section 2's secrets, not yet in GW_SECRETS. */
const NEW_SECRETS = ["auh_czech_regiments_sound", "auh_redl_plans"];

describe("the war share of 오스트리아-헝가리", () => {
  const scenes = AUH_WAR_SCENES;

  test("the plan's counts", () => {
    const n = (p: string) => scenes.filter((s) => s.id.startsWith(p)).length;
    expect(n("auh_w_")).toBe(28);
    expect(n("auh_t_")).toBe(24);
    // Five visits, and the night at court in Karl's reign.
    expect(n("auh_v_")).toBe(6);
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
      [...GW_PEOPLE, ...AUH_PEOPLE],
      OUTSIDE,
    );
    const expected = (p: string) =>
      OTHER_SHARES.some((x) => p.includes(`chose ${x} is no scene`)) ||
      NEW_SECRETS.some((x) => p.includes(`secret ${x} is not in GW_SECRETS`));
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

  test("the record cards stand alone: no option, no price, no other scene", () => {
    const cards = ["auh_w_record_serbia", "auh_w_record_galicia"];
    for (const s of scenes) {
      if (cards.includes(s.id)) {
        expect(s.options ?? []).toEqual([]);
        expect(s.nodes).toBeUndefined();
        continue;
      }
      const lines = JSON.stringify(pack.scenes[s.id]);
      for (const place of ["샤바츠", "레슈니차", "탈러호프"]) {
        expect(lines.includes(place), `${s.id}: ${place}`).toBe(false);
      }
    }
  });
});
