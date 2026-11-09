import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const talks = GW_CONTENT.scenes.filter((s) => /^gw_b[tl]_/.test(s.id));
const KO = path.join(__dirname, "../../resources/ww1914/ko");
const pack = (tag: string): GwPack =>
  JSON.parse(
    fs.readFileSync(path.join(KO, `${tag}.budget.json`), "utf8"),
  ) as GwPack;

describe("the money talks", () => {
  test("twenty-two of them, each three to six nodes deep", () => {
    expect(talks.length).toBe(22);
    for (const s of talks) {
      const n = Object.keys(s.nodes ?? {}).length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  test("each has something to find out and something to trade", () => {
    for (const s of talks) {
      const nodes = s.nodes!;
      const dig = nodes.hear.replies.find((r) => r.id === "dig")!;
      expect(dig.kind).toBe("ask");
      expect(nodes.find.says.some((v) => v.id === "straight")).toBe(true);
      const ids = nodes.barter.replies.map((r) => r.id);
      expect(ids).toEqual(["give", "sharp", "refuse"]);
      const give = nodes.barter.replies[0];
      const sharp = nodes.barter.replies[1];
      // What was found buys it cheaper, and that shows in the price.
      expect(sharp.when).toBeDefined();
      expect(sharp.tell.length).toBeLessThan(give.tell.length);
    }
  });

  test("a temper has its own first line, and a sour person can shut it", () => {
    for (const s of talks) {
      const open = s.nodes!.open;
      expect(open.says.length).toBe(3);
      const ask = open.replies.find((r) => r.id === "ask")!;
      expect(ask.reacts?.[0].next).toBe("shut");
    }
  });

  test("every line is written", () => {
    for (const tag of ["DEU", "GBR", "AUH", "RUS", "FRA"]) {
      const scenes = talks.filter((s) => s.nation.includes(tag as "DEU"));
      expect(scenes.length).toBeGreaterThanOrEqual(3);
      expect(gwPackProblems(scenes, pack(tag))).toEqual([]);
    }
  });
});
