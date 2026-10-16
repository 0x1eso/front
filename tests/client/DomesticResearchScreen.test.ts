import { vi } from "vitest";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

import {
  DomesticData,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { render } from "lit";
import {
  linkedToAbove,
  linkedToBelow,
  researchDial,
  TECH_TREE,
  techNodeState,
  TREE_BRANCHES,
  TREE_ERAS,
} from "../../src/client/hud/domestic/DomesticStatus";
import {
  renderResearchScreen,
  renderTechSheet,
  ResearchScreenContext,
} from "../../src/client/hud/domestic/ResearchScreen";
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

function data(d: Partial<DomesticData>): DomesticData {
  return { ...BASE, ...d };
}

describe("research node states", () => {
  const state = (d: DomesticData, id: TechId) =>
    techNodeState(d, new Set(d.techs), id);

  test("done, researching, available and reserved", () => {
    const d = data({
      techs: ["currency"],
      research: { tech: "navigation", ticksLeft: 50, totalTicks: 200 },
      science: 150,
      queuedTech: "academia",
    });
    expect(state(d, "currency").kind).toBe("done");
    expect(state(d, "navigation").kind).toBe("researching");
    // Open and paid for, even while the lab is busy: it can follow.
    expect(state(d, "fortification").kind).toBe("available");
    expect(state(d, "academia")).toMatchObject({
      kind: "available",
      queued: true,
    });
    expect(state(d, "fortification").queued).toBe(false);
  });

  test("short of science: seconds until it's in, at today's rate", () => {
    expect(
      state(data({ science: 50, sciencePerSec: 2 }), "currency"),
    ).toMatchObject({ kind: "short", secondsUntil: 50 });
    // Nothing coming in: no estimate.
    expect(state(data({ science: 50 }), "currency")).toMatchObject({
      kind: "short",
      secondsUntil: null,
    });
  });

  test("locked by the era gate or a missing prerequisite, with the reason", () => {
    expect(state(data({ science: 9999 }), "railroad")).toMatchObject({
      kind: "locked",
      lock: "era",
    });
    // Era 3 is open (two era-2 techs), but the Manhattan Project needs rocketry.
    const open3 = data({
      science: 9999,
      techs: ["currency", "navigation", "railroad", "banking"],
    });
    expect(state(open3, "manhattan_project")).toMatchObject({
      kind: "locked",
      lock: "prereq",
      missing: "rocketry",
    });
    expect(state(open3, "rocketry").kind).toBe("available");
  });
});

describe("research dial state", () => {
  test("researching, available, short, none", () => {
    expect(
      researchDial(
        data({
          research: { tech: "currency", ticksLeft: 50, totalTicks: 200 },
        }),
      ),
    ).toMatchObject({
      kind: "researching",
      tech: "currency",
      secondsLeft: 5,
      progress: 0.75,
    });
    expect(researchDial(data({ science: 150 })).kind).toBe("available");
    expect(researchDial(data({ science: 30 }))).toMatchObject({
      kind: "short",
      progress: 0.2,
    });
    expect(researchDial(data({ techs: [...TECH_IDS] })).kind).toBe("none");
    expect(researchDial(data({ queuedTech: "banking" })).queued).toBe(
      "banking",
    );
  });
});

describe("the tree layout", () => {
  test("holds every tech once, in its era row and branch column", () => {
    const seen: TechId[] = [];
    for (const era of TREE_ERAS) {
      for (const branch of TREE_BRANCHES) {
        for (const id of TECH_TREE[era][branch]) {
          expect(TECHS[id]).toMatchObject({ era, branch });
          seen.push(id);
        }
      }
    }
    expect([...seen].sort()).toEqual([...TECH_IDS].sort());
  });

  test("puts every prerequisite right above the tech that needs it", () => {
    for (const id of TECH_IDS) {
      if (TECHS[id].prereqs.length > 0) expect(linkedToAbove(id)).toBe(true);
    }
    expect(linkedToBelow("rocketry")).toBe(true);
    expect(linkedToBelow("manhattan_project")).toBe(true);
    expect(linkedToBelow("computers")).toBe(true);
    expect(linkedToBelow("radar")).toBe(false);
  });
});

interface Harness {
  root: HTMLElement;
  ctx: ResearchScreenContext;
  research: ReturnType<typeof vi.fn>;
  queue: ReturnType<typeof vi.fn>;
  node(id: TechId): HTMLButtonElement;
  sheet(): HTMLElement | null;
  action(name: string): HTMLButtonElement | null;
}

/** The research screen and its sheet, drawn again whenever the drawer's state changes. */
function harness(d: DomesticData, gold = 0n): Harness {
  const root = document.createElement("div");
  const research = vi.fn();
  const queue = vi.fn();
  const ctx: ResearchScreenContext = {
    view: new DomesticClientView(d),
    gold,
    infiniteGold: false,
    selected: null,
    armed: null,
    select(tech) {
      ctx.selected = tech;
      ctx.armed = null;
      draw();
    },
    arm(key) {
      ctx.armed = key;
      draw();
    },
    isUnitDisabled: (type) => type === UnitType.Satellite,
    research,
    queue,
  };
  const draw = () =>
    render(
      [
        renderResearchScreen(ctx),
        ctx.selected === null ? null : renderTechSheet(ctx),
      ],
      root,
    );
  draw();
  return {
    root,
    ctx,
    research,
    queue,
    node: (id) => root.querySelector<HTMLButtonElement>(`[data-tech="${id}"]`)!,
    sheet: () => root.querySelector("[data-sheet-tech]"),
    action: (name) =>
      root.querySelector<HTMLButtonElement>(`[data-sheet-action="${name}"]`),
  };
}

describe("research screen", () => {
  test("lays the tree out by era, with gates between the eras", () => {
    const h = harness(data({ techs: ["currency"] }));
    expect(
      [...h.root.querySelectorAll("[data-era]")].map(
        (e) => (e as HTMLElement).dataset.era,
      ),
    ).toEqual(["1", "2", "3", "4"]);
    const gate = h.root.querySelector<HTMLElement>('[data-era-gate="2"]')!;
    expect(gate.dataset.open).toBe("false");
    expect(gate.textContent).toContain(
      'domestic.tree.era_gate:{"era":2,"prev":1,"need":2,"have":1}',
    );
    expect(
      h.root.querySelectorAll('[data-era="3"] [data-prereq-line]').length,
    ).toBeGreaterThan(0);
  });

  test("each node shows its state; short ones their cost in red and an ETA", () => {
    const h = harness(
      data({
        techs: ["currency"],
        science: 100,
        sciencePerSec: 5,
        research: { tech: "navigation", ticksLeft: 50, totalTicks: 200 },
      }),
    );
    expect(h.node("currency").dataset.state).toBe("done");
    expect(h.node("navigation").dataset.state).toBe("researching");
    expect(h.node("railroad").dataset.state).toBe("locked");
    const short = h.node("academia");
    expect(short.dataset.state).toBe("short");
    expect(short.querySelector("[data-node-cost]")!.className).toContain(
      "text-red-400",
    );
    // 50 science missing at 5 a second.
    expect(short.textContent).toContain('domestic.ready_in:{"seconds":10}');
    expect(h.node("railroad").textContent).toContain(
      'domestic.tree.needs_era:{"era":1,"need":2}',
    );
  });

  test("a tap on a node opens its sheet with the full effect and what it unlocks", () => {
    const h = harness(
      data({ techs: ["currency", "navigation", "railroad", "banking"] }),
    );
    expect(h.sheet()).toBeNull();
    h.node("rocketry").click();
    const sheet = h.sheet()!;
    expect(sheet.textContent).toContain("domestic.tech.rocketry.desc");
    expect(sheet.querySelector('[data-unlock="missile_silo"]')).not.toBeNull();
    // A tap on the same node closes it again.
    h.node("rocketry").click();
    expect(h.sheet()).toBeNull();

    // Units the lobby left out (here the satellite) aren't advertised.
    h.node("space_program").click();
    expect(h.sheet()!.querySelector("[data-unlock]")).toBeNull();
  });

  test("starts an open, paid-for tech with one tap on the big button", () => {
    const h = harness(data({ science: 200 }));
    h.node("currency").click();
    expect(h.action("start")!.textContent).toContain(
      'domestic.tree.start:{"cost":150}',
    );
    h.action("start")!.click();
    expect(h.research).toHaveBeenCalledExactlyOnceWith("currency", false);
    expect(h.action("queue")).toBeNull();
  });

  test("while a research runs, reserving the next takes two taps", () => {
    const h = harness(
      data({
        science: 500,
        research: { tech: "currency", ticksLeft: 100, totalTicks: 200 },
      }),
    );
    h.node("navigation").click();
    expect(h.action("start")).toBeNull();
    expect(h.action("queue")!.textContent).toContain(
      "domestic.tree.queue_next",
    );
    h.action("queue")!.click();
    expect(h.queue).not.toHaveBeenCalled();
    expect(h.action("queue")!.textContent).toContain(
      "domestic.tree.queue_confirm",
    );
    h.action("queue")!.click();
    expect(h.queue).toHaveBeenCalledExactlyOnceWith("navigation");
  });

  test("a locked tech can be reserved too: it starts once open", () => {
    const h = harness(
      data({
        techs: ["currency", "navigation", "railroad", "banking"],
        research: { tech: "rocketry", ticksLeft: 100, totalTicks: 450 },
        queuedTech: "radar",
      }),
    );
    h.node("manhattan_project").click();
    expect(h.root.querySelector("[data-sheet-status]")!.textContent).toContain(
      'domestic.blocked.prereq:{"tech":"domestic.tech.rocketry.name"}',
    );
    // Says which reservation it replaces.
    expect(
      h.root.querySelector("[data-sheet-replaces]")!.textContent,
    ).toContain("domestic.tech.radar.name");
    h.action("queue")!.click();
    h.action("queue")!.click();
    expect(h.queue).toHaveBeenCalledExactlyOnceWith("manhattan_project");
  });

  test("idle and short of science: pay the rest in gold, or reserve", () => {
    const poor = harness(data({ science: 100 }));
    poor.node("currency").click();
    expect(poor.action("gold")!.disabled).toBe(true);
    expect(poor.root.querySelector("[data-reason]")!.textContent).toContain(
      "build_menu.not_enough_money",
    );
    expect(poor.action("queue")!.textContent).toContain(
      "domestic.tree.queue_auto",
    );

    // 50 points short at 1,000 gold each.
    const rich = harness(data({ science: 100 }), 50_000n);
    rich.node("currency").click();
    expect(rich.action("gold")!.disabled).toBe(false);
    rich.action("gold")!.click();
    expect(rich.research).toHaveBeenCalledExactlyOnceWith("currency", true);
  });

  test("the queue slot shows the reservation; its ✕ and the sheet cancel it", () => {
    const empty = harness(data({}));
    expect(
      empty.root.querySelector("[data-queue-slot]")!.textContent,
    ).toContain("domestic.tree.next_empty");
    expect(empty.root.querySelector("[data-queue-cancel]")).toBeNull();

    const h = harness(
      data({
        research: { tech: "currency", ticksLeft: 100, totalTicks: 200 },
        queuedTech: "academia",
      }),
    );
    const slot = h.root.querySelector("[data-queue-slot]")!;
    expect(slot.textContent).toContain("domestic.tech.academia.name");
    expect(h.node("academia").dataset.queued).toBe("true");
    h.root.querySelector<HTMLButtonElement>("[data-queue-cancel]")!.click();
    expect(h.queue).toHaveBeenLastCalledWith(null);

    // The queued tech's sheet offers "cancel reservation" instead.
    h.root.querySelector<HTMLButtonElement>("[data-queue-tech]")!.click();
    expect(h.ctx.selected).toBe("academia");
    expect(h.action("queue")).toBeNull();
    h.action("cancel")!.click();
    expect(h.queue).toHaveBeenCalledTimes(2);
    expect(h.queue).toHaveBeenLastCalledWith(null);
  });

  test("the current card shows the research, its time left and the science", () => {
    const h = harness(
      data({
        science: 42,
        sciencePerSec: 3,
        research: { tech: "currency", ticksLeft: 120, totalTicks: 200 },
      }),
    );
    const card = h.root.querySelector("[data-research-current]")!;
    expect(card.textContent).toContain("domestic.tech.currency.name");
    expect(card.textContent).toContain(
      'domestic.tree.seconds_left:{"seconds":12}',
    );
    expect(
      card.querySelector("[data-research-science]")!.textContent,
    ).toContain("42");
    expect(
      card.querySelector("[data-ring]")!.getAttribute("data-progress"),
    ).toBe("0.40");
  });
});
