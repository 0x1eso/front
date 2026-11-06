import {
  GwPackSchema,
  gwPackProblems,
} from "@openfront/engine-api/ww1914/GwPack";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_FRAME_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/gw_frame";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pack = GwPackSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../resources/ww1914/ko/common.frame.json"),
      "utf8",
    ),
  ),
);
const scenes = GW_FRAME_SCENES;
const talks = scenes.filter((s) => s.kind === "talk");

describe("common share: frame", () => {
  test("27 talks (the plan's small kings are five) and 12 end scenes", () => {
    expect(talks).toHaveLength(27);
    for (const s of talks) expect(s.id).toMatch(/^gw_f_/);
    expect(scenes.filter((s) => s.id.startsWith("gw_e_"))).toHaveLength(12);
  });

  test("every scene passes the checks and the pack holds every line", () => {
    for (const s of scenes) expect(gwSceneProblems(s)).toEqual([]);
    expect(gwPackProblems(scenes, pack)).toEqual([]);
    expect(Object.keys(pack.scenes).sort()).toEqual(
      scenes.map((s) => s.id).sort(),
    );
  });

  test("a talk asks, pushes, deals and leaves, all from its first node", () => {
    for (const s of talks) {
      const kinds = new Set(s.nodes!.open.replies.map((r) => r.kind));
      expect([...kinds].sort(), s.id).toEqual(["ask", "deal", "leave", "push"]);
      expect(s.summon, s.id).toBeUndefined();
    }
  });

  test("a decision has three options or more, one open, a fallback", () => {
    for (const s of scenes.filter((x) => x.kind === "proposal")) {
      expect(s.options!.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.fallback, s.id).toBeDefined();
    }
  });

  test("one line serves every seat: no address, no voice, no chancellor", () => {
    for (const s of scenes) {
      expect(s.voices, s.id).toBeUndefined();
      expect(Object.keys(s.cast)).not.toContain("chancellor");
    }
    const text = JSON.stringify(pack);
    expect(text).not.toMatch(/폐하|총리|당신|\{chancellor/);
  });

  test("the record card takes no choice", () => {
    const card = scenes.find((s) => s.id === "gw_e_prisoners_home")!;
    expect(card.kind).toBe("report");
    expect(card.options).toBeUndefined();
  });

  test("the six common endings have a paragraph", () => {
    expect(Object.keys(pack.endings!).sort()).toEqual([
      "armistice_conference",
      "compromise_peace",
      "deadline",
      "home_collapse",
      "long_peace",
      "victory_peace",
    ]);
  });
});
