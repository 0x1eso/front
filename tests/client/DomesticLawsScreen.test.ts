import { vi } from "vitest";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { render } from "lit";
import { lawsDial } from "../../src/client/hud/domestic/DomesticStatus";
import {
  LawsScreenContext,
  renderLawsScreen,
} from "../../src/client/hud/domestic/LawsScreen";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

const BASE: DomesticData = {
  science: 0,
  political: 0,
  cumulativeScience: 0,
  cumulativePolitical: 0,
  sciencePerSec: 0,
  politicalPerSec: 0,
  techs: [],
  research: null,
  recruitTargetPct: 100,
  laws: {},
  lawCooldownUntilTick: 0,
  governmentTier: 0,
  government: "chiefdom",
  conditions: [],
};

interface Harness {
  root: HTMLElement;
  proclaim: ReturnType<typeof vi.fn>;
  choose: ReturnType<typeof vi.fn>;
  card(law: string, option: string): HTMLElement;
  pick(law: string, option: string): HTMLButtonElement;
  confirm(law: string, option: string): HTMLButtonElement | null;
}

/**
 * The laws screen in a stand-in for the drawer: it holds the armed card or
 * button and draws the screen again whenever that changes.
 */
function harness(
  d: Partial<DomesticData>,
  opts: { gold?: bigint; nowTick?: number } = {},
): Harness {
  const root = document.createElement("div");
  const proclaim = vi.fn();
  const choose = vi.fn();
  const ctx: LawsScreenContext = {
    view: new DomesticClientView({ ...BASE, ...d }),
    gold: opts.gold ?? 0n,
    infiniteGold: false,
    nowTick: opts.nowTick ?? 0,
    armed: null,
    arm(key) {
      ctx.armed = key;
      draw();
    },
    proclaim,
    choose,
  };
  const draw = () => render(renderLawsScreen(ctx), root);
  draw();
  const card = (law: string, option: string) =>
    root.querySelector<HTMLElement>(
      `[data-law="${law}"] [data-option="${option}"]`,
    )!;
  return {
    root,
    proclaim,
    choose,
    card,
    pick: (law, option) =>
      card(law, option).querySelector<HTMLButtonElement>("[data-law-pick]")!,
    confirm: (law, option) =>
      card(law, option).querySelector<HTMLButtonElement>("[data-law-confirm]"),
  };
}

function govCard(root: HTMLElement, government: string) {
  return root.querySelector(`[data-government="${government}"]`) as HTMLElement;
}

describe("laws dial state", () => {
  test("cooldown, available, short and none", () => {
    const view = (d: Partial<DomesticData>) =>
      new DomesticClientView({ ...BASE, ...d });
    expect(
      lawsDial(view({ political: 999, lawCooldownUntilTick: 450 }), 0),
    ).toMatchObject({ kind: "cooldown", seconds: 45, progress: 1 });
    expect(lawsDial(view({ political: 350 }), 0).kind).toBe("available");
    expect(
      lawsDial(view({ political: 70, politicalPerSec: 2 }), 0),
    ).toMatchObject({ kind: "short", progress: 0.2, seconds: 140, cost: 350 });
    // Every law but the tech-locked one proclaimed: nothing is open.
    const allButNuclear = {
      trade: "A",
      taxation: "A",
      construction: "A",
      learning: "A",
      service: "A",
      doctrine: "A",
      mobilization: "A",
      diplomacy: "A",
      opinion: "A",
      religion: "A",
    } as const;
    expect(
      lawsDial(view({ political: 99999, laws: allButNuclear }), 0).kind,
    ).toBe("none");
  });
});

describe("laws screen", () => {
  test("a proclaimed option wears the stamp; the other is dimmed and discarded", () => {
    const h = harness({ political: 200, laws: { trade: "A" } });
    // The second law: round(350 × 1.35) = 473.
    expect(h.root.textContent).toContain('domestic.law_next_cost:{"cost":473}');
    const a = h.card("trade", "A");
    expect(a.dataset.state).toBe("proclaimed");
    expect(a.querySelector("[data-stamp]")!.textContent).toContain(
      "domestic.proclaimed",
    );
    const b = h.card("trade", "B");
    expect(b.dataset.state).toBe("discarded");
    expect(b.className).toContain("opacity-40");
    expect(b.querySelector("[data-stamp]")!.textContent).toContain(
      "domestic.rejected",
    );
    expect(h.pick("trade", "A").disabled).toBe(true);
    expect(h.pick("trade", "B").disabled).toBe(true);
    expect(h.card("taxation", "A").dataset.state).toBe("open");
  });

  test("a tap on a card shows its proclaim button; a tap on that proclaims", () => {
    const h = harness({ political: 400 });
    expect(h.confirm("taxation", "B")).toBeNull();
    h.pick("taxation", "B").click();
    expect(h.proclaim).not.toHaveBeenCalled();
    expect(h.confirm("taxation", "B")!.textContent).toContain(
      'domestic.book.proclaim:{"cost":350}',
    );
    expect(h.card("taxation", "B").textContent).toContain(
      "domestic.book.permanent",
    );
    // Only the tapped card shows it.
    expect(h.confirm("taxation", "A")).toBeNull();
    h.confirm("taxation", "B")!.click();
    expect(h.proclaim).toHaveBeenCalledExactlyOnceWith("taxation", "B", false);
    // Done: the card is no longer armed.
    expect(h.confirm("taxation", "B")).toBeNull();
  });

  test("tapping another card moves the proclaim button there", () => {
    const h = harness({ political: 400 });
    h.pick("taxation", "B").click();
    h.pick("taxation", "A").click();
    expect(h.confirm("taxation", "B")).toBeNull();
    h.confirm("taxation", "A")!.click();
    expect(h.proclaim).toHaveBeenCalledExactlyOnceWith("taxation", "A", false);
  });

  test("without enough political power the button pays the rest in gold", () => {
    const poor = harness({ political: 40 });
    poor.pick("trade", "A").click();
    expect(poor.confirm("trade", "A")!.textContent).toContain(
      "domestic.proclaim_with_gold",
    );
    expect(poor.confirm("trade", "A")!.disabled).toBe(true);
    expect(
      poor.card("trade", "A").querySelector("[data-reason]")!.textContent,
    ).toContain("build_menu.not_enough_money");

    // The first law costs 350: 310 missing points at 1,000 gold each.
    const rich = harness({ political: 40 }, { gold: 310_000n });
    rich.pick("trade", "A").click();
    expect(rich.confirm("trade", "A")!.disabled).toBe(false);
    rich.confirm("trade", "A")!.click();
    expect(rich.proclaim).toHaveBeenCalledExactlyOnceWith("trade", "A", true);
  });

  test("during the cooldown every card is locked and the dial counts down", () => {
    const h = harness(
      { political: 1000, lawCooldownUntilTick: 500 },
      { nowTick: 100 },
    );
    const status = h.root.querySelector<HTMLElement>("[data-law-status]")!;
    expect(status.dataset.lawStatus).toBe("cooldown");
    expect(status.textContent).toContain(
      'domestic.law_cooldown:{"seconds":40}',
    );
    expect(status.querySelector("[data-clock]")).not.toBeNull();
    expect(h.card("trade", "A").dataset.state).toBe("cooldown");
    expect(h.pick("trade", "A").disabled).toBe(true);
    h.pick("trade", "A").click();
    expect(h.confirm("trade", "A")).toBeNull();
  });

  test("a law whose tech is missing is grey and names the tech", () => {
    const h = harness({ political: 1000 });
    const row = h.root.querySelector<HTMLElement>('[data-law="nuclear"]')!;
    expect(row.dataset.locked).toBe("true");
    expect(row.querySelector("[data-law-condition]")!.textContent).toContain(
      "domestic.locked_requires",
    );
    expect(h.card("nuclear", "A").dataset.state).toBe("locked");
    expect(h.pick("nuclear", "A").disabled).toBe(true);
    expect(h.pick("trade", "A").disabled).toBe(false);
  });

  test("shows political power, its rate and the next law's cost", () => {
    const h = harness({ political: 70, politicalPerSec: 2 });
    const status = h.root.querySelector<HTMLElement>("[data-law-status]")!;
    expect(status.dataset.lawStatus).toBe("short");
    expect(status.textContent).toContain("70");
    expect(status.textContent).toContain('domestic.per_sec:{"value":"2.0"}');
    expect(status.textContent).toContain('domestic.ready_in:{"seconds":140}');
  });
});

describe("government on the laws screen", () => {
  test("tier 0: the bar to tier 1 and a preview of its governments", () => {
    const h = harness({ cumulativePolitical: 400 });
    const section = h.root.querySelector<HTMLElement>(
      "[data-government-section]",
    )!;
    expect(section.dataset.choosable).toBe("false");
    expect(section.textContent).toContain(
      'domestic.gov_progress:{"value":400,"next":800,"tier":1}',
    );
    const preview = section.querySelector("[data-government-preview]")!;
    expect(preview.textContent).toContain('domestic.book.preview:{"tier":1}');
    expect(govCard(h.root, "monarchy").textContent).toContain(
      'domestic.gov_needs_tier:{"tier":1}',
    );
    expect(govCard(h.root, "monarchy").querySelector("button")).toBeNull();
  });

  test("tier 1: the choice is right there, highlighted; adopting takes two taps", () => {
    const h = harness({ governmentTier: 1, cumulativePolitical: 1000 });
    const section = h.root.querySelector<HTMLElement>(
      "[data-government-section]",
    )!;
    expect(section.dataset.choosable).toBe("true");
    expect(section.querySelector("[data-government-choice]")).not.toBeNull();
    expect(section.textContent).toContain(
      'domestic.gov_progress:{"value":1000,"next":2800,"tier":2}',
    );
    const adopt = () =>
      govCard(h.root, "republic").querySelector("button") as HTMLElement;
    adopt().click();
    expect(h.choose).not.toHaveBeenCalled();
    expect(adopt().textContent).toContain("domestic.tap_again_to_confirm");
    adopt().click();
    expect(h.choose).toHaveBeenCalledExactlyOnceWith("republic");
    expect(govCard(h.root, "theocracy").querySelector("button")).toBeNull();
    expect(govCard(h.root, "theocracy").textContent).toContain(
      "domestic.gov_requires_law",
    );
  });

  test("tier 2 under a monarchy: the open tier-2 governments", () => {
    const h = harness({ governmentTier: 2, government: "monarchy" });
    expect(govCard(h.root, "fascism").querySelector("button")).not.toBeNull();
  });

  test("a chosen tier-2 government: no choice, and tier 3 ends the bar", () => {
    const h = harness({ governmentTier: 3, government: "democracy" });
    const section = h.root.querySelector<HTMLElement>(
      "[data-government-section]",
    )!;
    expect(section.dataset.choosable).toBe("false");
    expect(section.textContent).toContain("domestic.gov_max_tier");
    expect(section.querySelector("[data-government-preview]")).toBeNull();
  });
});
