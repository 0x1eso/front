import {
  GwPackSchema,
  gwPackProblems,
} from "@openfront/engine-api/ww1914/GwPack";
import { gwSceneEffects } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_DIP_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/gw_dip";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const file = path.join(__dirname, "../../resources/ww1914/ko/common.dip.json");
const pack = GwPackSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));

describe("common scenes, the 외교 share", () => {
  test("35 scenes, each sound by itself", () => {
    expect(GW_DIP_SCENES).toHaveLength(35);
    for (const s of GW_DIP_SCENES) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
      expect(s.id.startsWith("gw_d_")).toBe(true);
    }
  });

  test("the pack has every line, and no scene addresses the seat", () => {
    expect(gwPackProblems(GW_DIP_SCENES, pack)).toEqual([]);
    const text = JSON.stringify(pack.scenes);
    expect(text).not.toMatch(/폐하|총리/);
  });

  test("the plan's promises find their keeper here", () => {
    const kept = GW_DIP_SCENES.flatMap(gwSceneEffects).flatMap((e) =>
      e.kind === "keep_promise" ? [e.key] : [],
    );
    for (const key of [
      "p_house_word",
      "p_alfonso_list",
      "p_rou_shells",
      "p_pasic_return",
      "p_haase_passport",
    ]) {
      expect(kept, key).toContain(key);
    }
  });

  test("every decision has a default that can't be greyed", () => {
    for (const s of GW_DIP_SCENES) {
      if (s.options === undefined) continue;
      const open = s.options.find((o) => o.id === s.fallback);
      expect(open?.when, s.id).toBeUndefined();
    }
  });
});
