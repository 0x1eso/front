import {
  GwPackSchema,
  gwPackProblems,
} from "@openfront/engine-api/ww1914/GwPack";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_NEUTRAL_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/gw_neutral";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pack = GwPackSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../resources/ww1914/ko/common.neutral.json"),
      "utf8",
    ),
  ),
);

describe("common scenes, the neutrals' share", () => {
  test("the plan's count, every id gw_o_", () => {
    // gw_o_prt_ships went in f17a62327 (only its date stood behind it).
    expect(GW_NEUTRAL_SCENES).toHaveLength(34);
    for (const s of GW_NEUTRAL_SCENES) expect(s.id).toMatch(/^gw_o_/);
  });

  test("every scene passes the checks and the pack holds every line", () => {
    for (const s of GW_NEUTRAL_SCENES) expect(gwSceneProblems(s)).toEqual([]);
    expect(gwPackProblems(GW_NEUTRAL_SCENES, pack)).toEqual([]);
  });

  test("a decision has three options or more, one open, a fallback", () => {
    for (const s of GW_NEUTRAL_SCENES.filter((x) => x.kind === "proposal")) {
      expect(s.options!.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.fallback, s.id).toBeDefined();
    }
  });

  test("the text names no office of a seat and no form of address", () => {
    const text = JSON.stringify(pack.scenes);
    // ww196 merge: a form of address, not a foreign premier named ("루마니아
    // 총리"); the address forms as TextLint reads them.
    expect(text).not.toMatch(
      /(?<![가-힣'‘])(?<!(?:황제|황후|황태자|국왕|여왕|왕|차르|카이저|술탄|교황|대공|}) ?)폐하|총리님|당신/,
    );
  });
});
