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
    // ww196 merge: a form of address, not a foreign premier named ("루마니아
    // 총리"); the address forms as TextLint reads them.
    expect(text).not.toMatch(
      /(?<![가-힣'‘])(?<!(?:황제|황후|황태자|국왕|여왕|왕|차르|카이저|술탄|교황|대공|}) ?)폐하|총리님|당신|\{chancellor/,
    );
  });

  test("the record card takes no choice", () => {
    const card = scenes.find((s) => s.id === "gw_e_prisoners_home")!;
    expect(card.kind).toBe("report");
    expect(card.options).toBeUndefined();
  });

  test("the common endings have a paragraph, under the countries' own", () => {
    // common.json loads before a country's file, so a country's own wins.
    const common = GwPackSchema.parse(
      JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "../../resources/ww1914/ko/common.json"),
          "utf8",
        ),
      ),
    );
    expect(pack.endings).toBeUndefined();
    expect(Object.keys(common.endings!).sort()).toEqual([
      "armistice_conference",
      "compromise_peace",
      "deadline",
      "home_collapse",
      "long_peace",
      // ww172 s5: occupation and the bilateral table's own endings.
      "occupation_held",
      "pair_war_lost",
      "pair_war_won",
      "separate_peace",
      "under_occupation",
      // ww208 1B: the utopia's own end (S2).
      "utopia_realised",
      "victory_peace",
    ]);
  });
});
