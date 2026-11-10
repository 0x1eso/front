import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import {
  RUS_KIN,
  RUS_KIN_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/people_rus_private";
import { RUS_PRIVATE_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/rus_private";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const res = path.join(__dirname, "../../resources");
const read = (p: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(res, p), "utf8"));
const lineOf = (id: string) => id.split("_")[2];

describe("Russia's private lines", () => {
  const scenes = RUS_PRIVATE_SCENES;

  test("ten lines of four to six scenes, each with a turn the player shapes", () => {
    const lines = new Map<string, number>();
    for (const s of scenes) {
      lines.set(lineOf(s.id), (lines.get(lineOf(s.id)) ?? 0) + 1);
    }
    expect(lines.size).toBe(10);
    for (const [id, n] of lines) {
      expect(n, id).toBeGreaterThanOrEqual(4);
      expect(n, id).toBeLessThanOrEqual(6);
      const leaves = JSON.stringify(scenes.filter((s) => lineOf(s.id) === id));
      expect(leaves, id).toMatch(/"remember"/);
    }
  });

  test("every scene passes its schema, is once, and is tagged private", () => {
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
      expect(s.once, s.id).toBe(true);
      expect(s.tags, s.id).toContain("private");
    }
  });

  test("the pack holds every line, the laid-over ones too", async () => {
    const pack: GwPack = await loadGwPack("RUS", async (p) => read(p));
    expect(gwPackProblems(scenes, pack)).toEqual([]);
    // The other nations' lines use the same ids; their text is in their packs.
    const touched = GW_CONTENT.scenes.filter(
      (s) =>
        !/^(?:auh|deu|gbr)_/.test(s.id) &&
        JSON.stringify(s).includes('"id":"p_'),
    );
    expect(touched.length).toBeGreaterThanOrEqual(10);
    expect(gwPackProblems(touched, pack)).toEqual([]);
  });

  test("every memory a work scene reads is written by a line", () => {
    const problems = gwContentProblems(GW_CONTENT.scenes, GW_CONTENT.people, [
      "gw_world_called_only",
    ]).filter((p) => p.includes("k_p_") || p.includes("rus_p_"));
    expect(problems).toEqual([]);
  });

  test("the circle holds no office and can't be cast into work scenes", () => {
    for (const p of RUS_KIN) {
      expect(p.office, p.id).toBeNull();
      expect(p.fit, p.id).toEqual([]);
      expect(p.camps, p.id).toEqual([]);
      expect(RUS_KIN_VOICE_NOTES[p.id]?.length ?? 0, p.id).toBeGreaterThan(20);
      expect(p.source.length, p.id).toBeGreaterThan(20);
    }
  });
});
