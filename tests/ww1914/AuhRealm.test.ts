import {
  GW_LINES,
  GW_WORLD_FLAGS,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwPackSchema,
  gwPackProblems,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  gwContentProblems,
  gwSceneConds,
  gwSceneEffects,
} from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { AUH_PEOPLE } from "@openfront/engine-lib/ww1914/content/people_auh";
import { AUH_REALM_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/auh_realm";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const file = path.join(__dirname, "../../resources/ww1914/ko/AUH.realm.json");
const pack = GwPackSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
const scenes = AUH_REALM_SCENES;
const people = [...GW_PEOPLE, ...AUH_PEOPLE];
const talks = scenes.filter((s) => s.kind === "talk");

/** Keys, flags and scenes the other AUH shares own, or plan §2's world flags. */
const OUTSIDE = [
  ...GW_WORLD_FLAGS,
  "w_auh_karl",
  "w_auh_ff_throne",
  "w_auh_sturgkh_shot",
  "k_bil_bill",
  "k_bil_crown",
  "k_bil_poland",
  "k_ber_trentino",
  "k_cz_king",
  "k_cz_price",
  "k_hoyos_zoll",
  "k_koer_quota",
  "k_krob_lang",
  "k_krob_men",
  "k_krob_shells",
  "k_pil_terms",
  "k_stu_bohemia",
  "k_stu_grain",
  "k_stu_open",
];
const OTHER_SCENES = [
  "auh_c_no_annex",
  "auh_k_reichsrat_opens",
  "auh_w_german_command",
];
const fromOtherShares = (p: string) =>
  OTHER_SCENES.some((s) => p.includes(`${s} is no scene`));

describe("the realm share", () => {
  test("each scene passes its schema and its own checks", () => {
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
    expect(new Set(scenes.map((s) => s.id)).size).toBe(scenes.length);
  });

  test("the plan's counts: scenes, talks, visits", () => {
    expect(scenes.filter((s) => s.id.startsWith("auh_h_")).length).toBe(29);
    expect(talks.filter((s) => s.summon === true).length).toBe(24);
    expect(talks.filter((s) => s.summon !== true).length).toBe(5);
  });

  test("no reference leads nowhere but to the other shares", () => {
    const problems = gwContentProblems(scenes, people, OUTSIDE);
    expect(problems.filter((p) => !fromOtherShares(p))).toEqual([]);
  });

  test("the pack holds every line, with no template smells", () => {
    expect(gwPackProblems(scenes, pack)).toEqual([]);
  });

  test("every talk ends, offers a deal, and reads a temperament or a truth", () => {
    for (const s of talks) {
      const replies = Object.values(s.nodes ?? {}).flatMap((n) => n.replies);
      expect(
        replies.some((r) => r.kind === "deal"),
        s.id,
      ).toBe(true);
      expect(
        replies.some((r) => r.kind === "leave"),
        s.id,
      ).toBe(true);
      expect(Object.keys(s.nodes ?? {}).length, s.id).toBeGreaterThanOrEqual(3);
    }
  });

  test("every promise has a keeper or a way back", () => {
    for (const s of scenes) {
      for (const e of gwSceneEffects(s)) {
        if (e.kind !== "promise") continue;
        expect(e.keep ?? e.back, `${s.id} ${e.key}`).toBeDefined();
      }
    }
  });

  test("decisions give three to six options, one always open", () => {
    for (const s of scenes) {
      if (s.options === undefined) continue;
      expect(s.options.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.options.length, s.id).toBeLessThanOrEqual(6);
    }
  });

  test("Kramář's scenes have no option that takes a life", () => {
    const ids = ["auh_h_kramar_arrest", "auh_h_kramar_verdict"];
    for (const id of ids) {
      const t = pack.scenes[id];
      for (const line of Object.values(t.opt ?? {})) {
        expect(line).not.toMatch(/처형|집행한다|교수|총살/);
      }
    }
  });

  test("named fronts exist", () => {
    for (const s of scenes) {
      for (const c of gwSceneConds(s)) {
        if (c.kind !== "world" || c.of.is !== "front") continue;
        expect(GW_LINES[c.of.theatre]).toContain(c.of.from);
      }
    }
  });
});
