import {
  GwPackSchema,
  gwPackProblems,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  gwContentProblems,
  gwSceneConds,
  gwSceneEffects,
} from "@openfront/engine-api/ww1914/SceneCheck";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import {
  AUH_PRIVATE_PEOPLE,
  AUH_PRIVATE_SCENES,
  AUH_PRIVATE_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/scenes/auh_private";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const res = (p: string) => path.join(__dirname, "../../resources", p);
const json = (p: string): unknown =>
  JSON.parse(fs.readFileSync(res(p), "utf8"));
const own = GwPackSchema.parse(json("ww1914/ko/AUH.private.json"));
const cast = GwPackSchema.parse(json("ww1914/ko/AUH.people.json"));

describe("the Emperor's circle, outside work", () => {
  test("every scene passes the scene check", () => {
    for (const s of AUH_PRIVATE_SCENES) {
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("every line has its text, the echoes too, and no reference is lost", async () => {
    const pack = await loadGwPack("AUH", async (p) => json(p));
    const auh = GW_CONTENT.scenes.filter((s) => s.nation.includes("AUH"));
    expect(gwPackProblems(AUH_PRIVATE_SCENES, own)).toEqual([]);
    const lost = gwPackProblems(auh, pack).filter((x) => x.includes("p_"));
    expect(lost).toEqual([]);
    const mine = new Set(AUH_PRIVATE_SCENES.map((s) => s.id));
    const problems = gwContentProblems(GW_CONTENT.scenes, GW_CONTENT.people);
    // World flags (`w_`) are set by the engine, not by a scene.
    const lines = problems.filter((x) => !x.includes(": flag w_"));
    expect(lines.filter((x) => mine.has(x.split(":")[0]))).toEqual([]);
  });

  test("everything is tagged private, and a scene remembers or ends a line", () => {
    for (const s of AUH_PRIVATE_SCENES) {
      expect(s.tags, s.id).toContain("private");
      expect(s.nation).toEqual(["AUH"]);
    }
    const written = new Set(
      AUH_PRIVATE_SCENES.flatMap((s) => gwSceneEffects(s))
        .filter((e) => e.kind === "remember")
        .map((e) => (e.kind === "remember" ? e.key : "")),
    );
    const read = new Set(
      GW_CONTENT.scenes
        .flatMap((s) => gwSceneConds(s))
        .filter((c) => c.kind === "memory")
        .map((c) => (c.kind === "memory" ? c.key : "")),
    );
    const heard = [...written].filter((k) => read.has(k));
    expect(heard.length).toBeGreaterThan(25);
  });

  test("no button here is an atrocity: nothing reaches for a people", () => {
    const text = JSON.stringify(own);
    for (const word of ["학살", "처형", "총살"]) {
      expect(text.includes(word), word).toBe(false);
    }
  });

  test("the people have a source, a voice and a name", () => {
    for (const p of AUH_PRIVATE_PEOPLE) {
      expect(p.source.length).toBeGreaterThan(20);
      expect(p.office).toBeNull();
      expect(p.camps).toEqual([]);
      expect(AUH_PRIVATE_VOICE_NOTES[p.id], p.id).toBeTruthy();
      expect(cast.people[p.id]?.name, p.id).toBeTruthy();
    }
  });
});
