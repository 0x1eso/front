import {
  GwPackSchema,
  gwPackProblems,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  gwContentProblems,
  gwSceneEffects,
} from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { DEU_COURT_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/deu_court";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pack = GwPackSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../resources/ww1914/ko/DEU.court.json"),
      "utf8",
    ),
  ),
);

const talks = DEU_COURT_SCENES.filter((s) => s.kind === "talk");

describe("Germany 1915-18, the court share", () => {
  test("the plan's counts", () => {
    const of = (prefix: string) =>
      DEU_COURT_SCENES.filter((s) => s.id.startsWith(prefix)).length;
    // 27 of the plan, and the paper that "one more line" comes back to.
    expect(of("deu_k_")).toBe(28);
    expect(of("deu_t2_")).toBe(24);
    expect(of("deu_v2_")).toBe(5);
    expect(Object.keys(pack.endings ?? {})).toHaveLength(12);
  });

  test("every scene passes the schema and the checks", () => {
    for (const s of DEU_COURT_SCENES) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line, and every hole fills", () => {
    expect(gwPackProblems(DEU_COURT_SCENES, pack)).toEqual([]);
  });

  test("a first word offers all four replies; the empress's last room has no price", () => {
    for (const s of talks) {
      const kinds = s.nodes![s.start!].replies.map((r) => r.kind);
      expect(kinds, s.id).toContain("ask");
      expect(kinds, s.id).toContain("leave");
      if (s.id === "deu_v2_empress_heart") continue;
      expect(kinds, s.id).toContain("push");
      expect(kinds, s.id).toContain("deal");
    }
  });

  test("every promise made here has text and a way to be kept", () => {
    const made = DEU_COURT_SCENES.flatMap(gwSceneEffects);
    const keys = Object.keys(pack.promises ?? {});
    for (const e of made) {
      if (e.kind === "promise") expect(keys, e.key).toContain(e.key);
    }
    for (const key of keys) {
      const kept = made.some(
        (e) =>
          (e.kind === "keep_promise" && e.key === key) ||
          (e.kind === "promise" && e.key === key && e.keep !== undefined),
      );
      expect(kept, key).toBe(true);
    }
  });

  test("the people it names exist", () => {
    const problems = gwContentProblems(GW_CONTENT.scenes, GW_CONTENT.people);
    expect(problems.filter((p) => /no person|no role/.test(p))).toEqual([]);
  });
});
