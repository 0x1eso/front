import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import {
  LAW_KINDS,
  LAW_LADDERS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  lawDiffLines,
  lawEffectLines,
  lawTab,
  politicsInput,
} from "../../../src/client/hud/ww1936/PoliticsModel";
import { detail, summary } from "./EconomyFixture";
import { fakePolGame } from "./PoliticsFixture";

function tab(wsBp: number, over = {}) {
  const r = fakePolGame({
    summaries: [summary("DEU")],
    details: [
      detail("DEU", {
        laws: {
          economy: "civilian",
          trade: "export_focus",
          conscription: "volunteer",
        },
        lawCooldownUntil: { economy: 0, trade: 12, conscription: 0 },
      }),
    ],
    politics: { ruling: 3, wsBp, wtBp: 10_000, ppMilli: 500_000 },
    ...over,
  } as never);
  return lawTab(politicsInput(r.game as never)!)!;
}

describe("law explanations", () => {
  it("every law in every category lists its effects from the data", () => {
    for (const kind of LAW_KINDS) {
      for (const value of LAW_LADDERS[kind]) {
        const lines = lawEffectLines(kind, value);
        expect(lines.length, `${kind}:${value}`).toBeGreaterThan(0);
        for (const l of lines) expect(l).toMatch(/^\[ww1936\./);
      }
    }
    const ladders = tab(9_000);
    expect(ladders).toHaveLength(LAW_KINDS.length);
    for (const l of ladders) {
      expect(l.summary).toBe(`[ww1936.pol.law.summary.${l.kind}]`);
      for (const s of l.steps) expect(s.effects.length).toBeGreaterThan(0);
    }
    // The numbers are WwLaws' own.
    expect(lawEffectLines("economy", "war_economy")).toEqual([
      "[ww1936.pol.law.fx.consumer_goods] value=20",
      "[ww1936.stat.milConstructionPct] value=20",
      "[ww1936.stat.outputPct] value=5",
      "[ww1936.stat.stabilityBp] value=-300",
    ]);
  });

  it("the difference against the law in force is signed and toned", () => {
    expect(lawDiffLines("economy", "civilian", "war_economy")).toEqual([
      { text: "[ww1936.stat.consumerGoodsPp] value=-15", tone: "neutral" },
      { text: "[ww1936.stat.milConstructionPct] value=50", tone: "good" },
      { text: "[ww1936.stat.outputPct] value=5", tone: "good" },
      { text: "[ww1936.stat.stabilityBp] value=-300", tone: "bad" },
    ]);
    const econ = tab(9_000).find((l) => l.kind === "economy")!;
    const we = econ.steps.find((s) => s.value === "war_economy")!;
    expect(we.diff).toEqual(lawDiffLines("economy", "civilian", "war_economy"));
    expect(econ.steps[0].diff).toEqual([]);
  });

  it("a blocked option shows its reason, cost and wait", () => {
    const ladders = tab(2_400);
    const partial = ladders
      .find((l) => l.kind === "economy")!
      .steps.find((s) => s.value === "partial_mobilization")!;
    expect(partial.state).toBe("locked");
    expect(partial.blockReason).toContain("law_ws");
    const free = ladders
      .find((l) => l.kind === "trade")!
      .steps.find((s) => s.value === "free_trade")!;
    expect(free.wait).toBe("[ww1936.pol.law.wait] days=12");
    expect(free.blockReason).not.toBeNull();
    const open = ladders
      .find((l) => l.kind === "conscription")!
      .steps.find((s) => s.value === "limited")!;
    expect(open.blockReason).toBeNull();
  });
});
