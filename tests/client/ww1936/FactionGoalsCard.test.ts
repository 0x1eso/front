// @vitest-environment jsdom
// The faction goal slots are labelled ("Goal 1..3"), and what each goal needs
// and pays is written out, so three rows of the same six buttons read as
// three slots to fill and not as a repeat.
import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params && Object.keys(params).length > 0
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import type { GoalSlot } from "../../../src/client/hud/ww1936/DepthMiscModel";
import { renderFactionRules } from "../../../src/client/hud/ww1936/WwFactionRulesCard";

const ctx = { armed: () => false, tap: () => {}, send: () => {} };
const OPTIONS: GoalSlot["options"] = ["fg_members", "fg_industry"];
const rule = {
  rule: "fr_shared_intel",
  on: true,
  canToggle: false,
  order: { kind: "faction_rule" },
} as never;

function draw(goals: GoalSlot[]): HTMLElement {
  const root = document.createElement("div");
  render(renderFactionRules([rule], goals, ctx), root);
  return root;
}

describe("faction goal slots", () => {
  it("numbers each slot and explains every goal the leader can pick", () => {
    const root = draw(
      [0, 1, 2].map((slot) => ({
        slot,
        goal: null,
        achieved: false,
        options: OPTIONS,
        canPick: true,
      })),
    );
    const slots = [...root.querySelectorAll("[data-ww-goal-slot]")];
    expect(slots.map((s) => s.querySelector("b")?.textContent)).toEqual([
      "[ww1936.faction_ui.goal_slot] n=1",
      "[ww1936.faction_ui.goal_slot] n=2",
      "[ww1936.faction_ui.goal_slot] n=3",
    ]);
    // Each button says what it needs on hover, and the legend lists them once.
    expect(
      root
        .querySelector("[data-ww-goal-pick=fg_industry]")
        ?.getAttribute("title"),
    ).toBe("[ww1936.faction_goal_desc.fg_industry]");
    expect(
      [...root.querySelectorAll("[data-ww-goal-desc]")].map((e) =>
        e.getAttribute("data-ww-goal-desc"),
      ),
    ).toEqual(OPTIONS);
  });

  it("shows a chosen goal with its condition, and no legend when nothing is open", () => {
    const root = draw([
      {
        slot: 0,
        goal: "fg_members",
        achieved: true,
        options: [],
        canPick: false,
      },
    ]);
    expect(root.querySelector("[data-ww-goal-slot]")?.textContent).toContain(
      "[ww1936.faction_goal_desc.fg_members]",
    );
    expect(root.querySelector("[data-ww-goal-legend]")).toBeNull();
  });
});
