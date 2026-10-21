// P4 Task 10 (lane AI): the AI's naval lines and dockyards (spec §17.5).
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  AI_SWITCH_DAY,
  aiConvoyShort,
  aiDockTarget,
  AiInput,
  AiNavalLineInput,
  aiNavalLinePlan,
  aiNavalShares,
  aiPlan,
  newestShipGen,
} from "@openfront/engine/ww1936/economy/AiEconomy";

const START: WwTechId[] = ["dd_2", "cl_2", "ca_2", "bb_2", "cv_2", "ss_2"];

function lines(over: Partial<AiNavalLineInput>): AiNavalLineInput {
  return {
    tag: "GBR",
    docks: 20,
    lines: [],
    researched: new Set(START),
    convoyStock: 100,
    convoyNeed: 0,
    port: 10,
    ...over,
  };
}

/** Docks a plan gives each class (new lines and added docks). */
function docksBy(
  plan: ReturnType<typeof aiNavalLinePlan>,
  i: AiNavalLineInput,
) {
  const out: Record<string, number> = {};
  for (const o of plan) {
    if (o.kind === "naval_line_add") out[o.cls] = (out[o.cls] ?? 0) + o.docks;
    if (o.kind === "naval_line_docks") {
      const l = i.lines.find((x) => x.id === o.line)!;
      out[l.slot] = (out[l.slot] ?? 0) + o.docks - l.docks;
    }
  }
  return out;
}

describe("the AI's naval production (spec §17.5)", () => {
  test("naval line shares follow the table", () => {
    // The table, BC·BB as battleships.
    expect(aiNavalShares("GBR", false)).toEqual({
      dd: 35,
      cl: 15,
      ca: 0,
      bc: 0,
      bb: 10,
      cv: 15,
      ss: 5,
      convoy: 20,
    });
    expect(aiNavalShares("DEU", false)).toMatchObject({
      ss: 60,
      bb: 15,
      dd: 15,
      ca: 5,
      convoy: 5,
    });
    expect(aiNavalShares("JPN", false)).toMatchObject({
      cv: 25,
      ss: 15,
      ca: 5,
    });
    expect(aiNavalShares("SUN", false)).toMatchObject({ ss: 50, bb: 0, cv: 0 });
    // Anyone else with dockyards: destroyers, submarines, convoys.
    expect(aiNavalShares("TUR", false)).toEqual({
      dd: 50,
      cl: 0,
      ca: 0,
      bc: 0,
      bb: 0,
      cv: 0,
      ss: 40,
      convoy: 10,
    });
    // 20 idle dockyards: Britain's lines get 7/3/2/3/1/4, each a new line
    // of the newest generation, launched at the given port.
    const i = lines({});
    const plan = aiNavalLinePlan(i);
    expect(docksBy(plan, i)).toEqual({
      dd: 7,
      cl: 3,
      bb: 2,
      cv: 3,
      ss: 1,
      convoy: 4,
    });
    expect(plan[0]).toEqual({
      kind: "naval_line_add",
      cls: "dd",
      gen: 2,
      docks: 7,
      count: 6,
      port: 10,
    });
    expect(
      plan.find((o) => o.kind === "naval_line_add" && o.cls === "convoy"),
    ).toMatchObject({ count: 0 });
    // A line of the newest generation takes more docks; an older one does not.
    const withLines = lines({
      docks: 24,
      lines: [
        { id: 1, slot: "dd", gen: 2, docks: 7 },
        { id: 2, slot: "cl", gen: 1, docks: 3 },
        { id: 3, slot: "bb", gen: 2, docks: 2 },
        { id: 4, slot: "cv", gen: 2, docks: 3 },
        { id: 5, slot: "ss", gen: 2, docks: 1 },
        { id: 6, slot: "convoy", gen: 1, docks: 4 },
      ],
    });
    const more = aiNavalLinePlan(withLines);
    expect(more).toContainEqual({
      kind: "naval_line_docks",
      line: 1,
      docks: 8,
    });
    expect(more.find((o) => o.kind === "naval_line_add")).toMatchObject({
      cls: "cl",
      gen: 2,
    });
    expect(docksBy(more, withLines)).toEqual({
      dd: 1,
      cl: 1,
      cv: 1,
      convoy: 1,
    });
    // New generations first.
    expect(newestShipGen("dd", new Set(["dd_2", "dd_3"]))).toBe(3);
    expect(newestShipGen("bc", new Set())).toBe(1);
    // No port: no new line.
    expect(aiNavalLinePlan(lines({ port: 0 }))).toEqual([]);
  });

  test("convoy demand moves 30% of the docks", () => {
    // The routes need more than 90% of the stock.
    expect(aiConvoyShort(91, 100)).toBe(true);
    expect(aiConvoyShort(90, 100)).toBe(false);
    // Convoys 30%, the ships 70% in proportion (largest remainders).
    expect(aiNavalShares("GBR", true)).toEqual({
      dd: 31,
      cl: 13,
      ca: 0,
      bc: 0,
      bb: 9,
      cv: 13,
      ss: 4,
      convoy: 30,
    });
    const i = lines({ convoyNeed: 95 });
    expect(docksBy(aiNavalLinePlan(i), i).convoy).toBe(6);
    // Once the convoys are no longer short, a convoy line over its share
    // gives the extra dockyards back (to 4 of 20).
    const back = aiNavalLinePlan(
      lines({
        lines: [{ id: 9, slot: "convoy", gen: 1, docks: 6 }],
        convoyNeed: 10,
      }),
    );
    expect(back[0]).toEqual({ kind: "naval_line_docks", line: 9, docks: 4 });
  });

  test("dockyards short of the target: four military factories to one dockyard", () => {
    expect(aiDockTarget("GBR", false)).toBe(30);
    expect(aiDockTarget("USA", false)).toBe(0);
    expect(aiDockTarget("USA", true)).toBe(40);
    expect(aiDockTarget("TUR", true)).toBe(0);
    const base: AiInput = {
      tag: "DEU",
      personality: "aggressor",
      major: true,
      day: AI_SWITCH_DAY.aggressor,
      warDays: 0,
      laws: {
        economy: "civilian",
        trade: "export_focus",
        conscription: "limited",
      },
      lawCooldownUntil: { economy: -1, trade: -1, conscription: -1 },
      wsBp: 5000,
      wtBp: 0,
      ruling: 3,
      ppMilli: 0,
      manpower: 500_000,
      recruitable: 850_000,
      infStock: 0,
      freeCivMilli: 150_000,
      mil: 0,
      idleMil: 0,
      effCapBp: 5000,
      lines: [],
      queue: [],
      slots: [],
      slotCount: 0,
      researched: [],
      produced: [0, 0, 0, 0, 0, 0],
      exported: [0, 0, 0, 0, 0, 0],
      imported: [0, 0, 0, 0, 0, 0],
      payableCivs: 0,
      paidCivs: 0,
      buying: [],
      partners: [],
      regions: [
        {
          region: 1,
          infra: 5,
          free: 60,
          infraRoom: 0,
          occupied: false,
          res: [0, 0, 0, 0, 0, 0],
          coastal: true,
        },
      ],
      docks: 10,
      dockTarget: 15,
    };
    const builds = (i: AiInput) =>
      aiPlan(i).flatMap((o) =>
        o.kind === "build" ? [`${o.building}x${o.count}`] : [],
      );
    expect(builds(base)).toEqual([
      "milx3",
      "milx3",
      "milx3",
      "milx3",
      "dockx3",
      "milx3",
      "milx3",
      "milx3",
      "milx3",
      "dockx2",
      "milx3",
    ]);
    // At the target, or before the switch, or inland: none.
    expect(builds({ ...base, docks: 15 })).not.toContain("dockx3");
    expect(
      builds({
        ...base,
        regions: [{ ...base.regions[0], coastal: false }],
      }).some((b) => b.startsWith("dock")),
    ).toBe(false);
    expect(
      builds({ ...base, day: 0, warDays: -1 }).some((b) =>
        b.startsWith("dock"),
      ),
    ).toBe(false);
  });
});
