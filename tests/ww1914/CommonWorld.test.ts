import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GwPackSchema,
  gwPackProblems,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_WORLD2_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/gw_world2";
import { WORLD_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/world";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const file = path.join(
  __dirname,
  "../../resources/ww1914/ko/common.world.json",
);
const pack = GwPackSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
const scenes = GW_WORLD2_SCENES;

describe("common share: world", () => {
  test("35 scenes: 18 news, 17 crises, all valid", () => {
    expect(scenes.filter((s) => s.id.startsWith("gw_n_"))).toHaveLength(18);
    expect(scenes.filter((s) => s.id.startsWith("gw_x_"))).toHaveLength(17);
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line and nothing more", () => {
    // ww173 S7b keeps the common text of its offensive card (world.ts) here.
    const offensive = WORLD_SCENES.filter((s) => s.id === "gw_offensive_seen");
    expect(offensive).toHaveLength(1);
    const all = [...scenes, ...offensive];
    expect(gwPackProblems(all, pack)).toEqual([]);
    expect(Object.keys(pack.scenes).sort()).toEqual(
      all.map((s) => s.id).sort(),
    );
  });

  test("one line serves every seat: no address, no voice, no chancellor", () => {
    for (const s of scenes) {
      expect(s.voices, s.id).toBeUndefined();
      expect(Object.keys(s.cast).filter((r) => r === "chancellor")).toEqual([]);
    }
    const all = JSON.stringify(pack.scenes);
    for (const word of ["폐하", "총리 각하", "당신", "{chancellor"]) {
      expect(all.includes(word), word).toBe(false);
    }
  });

  test("record cards are read-only and take no choice", () => {
    const cards = scenes.filter((s) => s.id.startsWith("gw_n_record_"));
    expect(cards).toHaveLength(3);
    for (const s of cards) {
      expect(s.kind).toBe("report");
      expect(s.options).toBeUndefined();
    }
  });

  test("decisions offer three or more, and a scene's seats are real", () => {
    for (const s of scenes) {
      for (const t of s.nation) expect(GW_TAGS).toContain(t);
      if (s.options !== undefined) {
        expect(s.options.length, s.id).toBeGreaterThanOrEqual(3);
        expect(s.fallback, s.id).toBeDefined();
      }
    }
  });
});
