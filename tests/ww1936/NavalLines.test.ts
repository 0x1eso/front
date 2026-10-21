// World War 1936 P4 (plan Task 9 Step 8): naval lines on dockyards (P4
// spec §5.2–§5.4) on the test map ww1936sea, Britain played by a human
// (London: 3 dockyards, a level-6 naval base; Malta: a level-1 base).
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  lineCostMilli,
  navalLineOutputMilli,
  nextLaunchDays,
} from "@openfront/engine-lib/ww1936/NavalLineRules";
import { lineUnitCost } from "@openfront/engine-lib/ww1936/ShipStats";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  damageBuilding,
  repairBuilding,
} from "@openfront/engine/ww1936/economy/Buildings";
import {
  dockyardsFree,
  lendDocks,
} from "@openfront/engine/ww1936/economy/NavalLines";
import type { CountryEconomy } from "@openfront/engine/ww1936/economy/WwEconomy";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import {
  HUMAN,
  order,
  step,
  stepTo,
  withTestPolitics,
  wwRunnerCapture,
} from "./util";

withTestPolitics();

const GBR = TAG_ID.GBR;

async function britain() {
  const { runner, updates } = await wwRunnerCapture(
    {},
    [{ clientID: HUMAN, country: "GBR" }],
    SEA.map,
  );
  const ww = runner.game.worldWar()!;
  const ce = ww.economy.country(GBR)!;
  return { runner, updates, ww, ce };
}

/** The tick after Britain's economy turn of day `d`. */
function afterTurn(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + (GBR % 7) + 1);
}

function give(runner: GameRunner, o: WwOrder): void {
  step(runner, 1, [order(HUMAN, o)]);
}

function outputPct(ce: CountryEconomy): number {
  return ce.stats.dockOutputPct + ce.law().outputPct + ce.stats.outputPct;
}

describe("World War 1936 P4: naval lines (spec §5.2–§5.4)", () => {
  test("orders: classes, ports, counts, the twenty-line cap", async () => {
    const { runner, ww, ce } = await britain();
    const navy = ww.navy;
    const t = runner.game.ticks();
    const add = (o: Partial<Extract<WwOrder, { kind: "naval_line_add" }>>) =>
      navy.issue(
        GBR,
        {
          kind: "naval_line_add",
          cls: "dd",
          gen: 1,
          docks: 1,
          count: 1,
          port: REGION.london,
          ...o,
        },
        t,
      );
    // Generation 1 is open to all; later ones need their tech.
    expect(add({ cls: "bb", gen: 1 })).toBeNull();
    ce.researched.delete("dd_2");
    expect(add({ cls: "dd", gen: 2 })).toBe("bad_ship_class");
    // Heavy cruisers have no 1944 generation; convoys only one.
    expect(add({ cls: "ca", gen: 4 })).toBe("bad_ship_class");
    expect(add({ cls: "convoy", gen: 2, count: 0 })).toBe("bad_ship_class");
    // A port is a working naval base Britain controls.
    expect(add({ port: REGION.paris })).toBe("no_naval_base");
    expect(add({ port: REGION.rome })).toBe("no_naval_base");
    expect(add({ port: REGION.malta })).toBeNull();
    // Only a convoy line keeps going.
    expect(add({ count: 0 })).toBe("bad_index");
    expect(add({ cls: "convoy", count: 0 })).toBeNull();
    expect(ce.navalLines.map((l) => [l.cls, l.left, l.port])).toEqual([
      [4, 1, REGION.london],
      [0, 1, REGION.malta],
      [7, 0, REGION.london],
    ]);
    const [bb, dd, cv] = ce.navalLines.map((l) => l.id);
    // Docks, counts, moving, removing.
    expect(
      navy.issue(GBR, { kind: "naval_line_docks", line: dd, docks: 3 }, t),
    ).toBeNull();
    expect(ce.navalLines[1].docks).toBe(3);
    expect(
      navy.issue(GBR, { kind: "naval_line_count", line: dd, count: 0 }, t),
    ).toBe("bad_index");
    expect(
      navy.issue(GBR, { kind: "naval_line_count", line: dd, count: 5 }, t),
    ).toBeNull();
    expect(
      navy.issue(GBR, { kind: "naval_line_move", line: cv, to: 0 }, t),
    ).toBeNull();
    expect(ce.navalLines.map((l) => l.id)).toEqual([cv, bb, dd]);
    expect(
      navy.issue(GBR, { kind: "naval_line_move", line: bb, to: 3 }, t),
    ).toBe("bad_index");
    expect(
      navy.issue(GBR, { kind: "naval_line_remove", line: bb }, t),
    ).toBeNull();
    expect(navy.issue(GBR, { kind: "naval_line_remove", line: bb }, t)).toBe(
      "bad_line",
    );
    expect(ce.navalLines.map((l) => l.id)).toEqual([cv, dd]);
    while (ce.navalLines.length < 20) expect(add({})).toBeNull();
    expect(add({})).toBe("line_full");
  });

  test("a destroyer on 3 docks launches on the predicted day", async () => {
    const { runner, updates, ww, ce } = await britain();
    give(runner, {
      kind: "naval_line_add",
      cls: "dd",
      gen: 1,
      docks: 3,
      count: 2,
      port: REGION.london,
    });
    const line = ce.navalLines[ce.navalLines.length - 1];
    // The preparation minute only sets lines up (spec §2.2).
    afterTurn(runner, -1);
    expect(line.progress).toBe(0);
    afterTurn(runner, 0);
    expect(line.activeDocks).toBe(3);
    const out = line.lastOutput;
    expect(out).toBe(navalLineOutputMilli(3, outputPct(ce), line.fill));
    expect(line.progress).toBe(out);
    // 1922 destroyer: 1,200 at 7,500 a day (× output%, × resources).
    expect(lineCostMilli(line)).toBe(1_200_000);
    expect(lineUnitCost("dd", 1)).toBe(1200);
    const days = nextLaunchDays(line, out);
    expect(days).toBeGreaterThan(100);
    expect(days).toBeLessThanOrEqual(160);
    let launched = -1;
    for (let d = 1; d <= days + 1 && launched < 0; d++) {
      afterTurn(runner, d);
      if (line.left === 1) launched = d;
    }
    expect(launched).toBe(days);
    // It sits in London's new-ships fleet, the line goes on with the rest.
    const fleets = ww.navy.fleetsOf(GBR).filter((f) => f.newShips);
    expect(fleets).toHaveLength(1);
    expect(fleets[0].docked).toBe(REGION.london);
    expect(fleets[0].ships).toHaveLength(1);
    expect(line.progress).toBe((days + 1) * out - 1_200_000);
    const msgs = updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_ship_commissioned");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].params).toEqual({ n: 1, cls: "dd", ship: 1 });
  }, 120_000);

  test("docks lent to repair slow the line the next day", async () => {
    const { runner, ce } = await britain();
    give(runner, {
      kind: "naval_line_add",
      cls: "dd",
      gen: 1,
      docks: 3,
      count: 1,
      port: REGION.london,
    });
    const line = ce.navalLines[ce.navalLines.length - 1];
    afterTurn(runner, 0);
    expect(line.activeDocks).toBe(3);
    expect(ce.totals.dock).toBe(3);
    expect(dockyardsFree(runner.game.worldWar()!.economy, ce)).toBe(0);
    // The navy's day (N2's repair) borrows after the economy's turn: at
    // most the usable dockyards not lent yet.
    expect(lendDocks(ce, 2)).toBe(2);
    expect(lendDocks(ce, 5)).toBe(1);
    expect(lendDocks(ce, 1)).toBe(0);
    expect(ce.docksLent).toBe(3);
    afterTurn(runner, 1);
    expect(line.activeDocks).toBe(0);
    expect(line.lastOutput).toBe(0);
    // Lent for that day only: the economy's turn gave them back.
    expect(ce.docksLent).toBe(0);
    expect(lendDocks(ce, 2)).toBe(2);
    afterTurn(runner, 2);
    expect(line.activeDocks).toBe(1);
    expect(line.lastOutput).toBe(
      navalLineOutputMilli(1, outputPct(ce), line.fill),
    );
    afterTurn(runner, 3);
    expect(line.activeDocks).toBe(3);
  }, 60_000);

  test("convoys from a line add to the stock", async () => {
    const { runner, ce } = await britain();
    give(runner, {
      kind: "naval_line_add",
      cls: "convoy",
      gen: 1,
      docks: 3,
      count: 0,
      port: REGION.london,
    });
    const line = ce.navalLines[ce.navalLines.length - 1];
    const key = equipKey("convoy", 1);
    const before = ce.stock[key];
    let made = 0;
    for (let d = 0; d < 20; d++) {
      afterTurn(runner, d);
      made += line.lastOutput;
    }
    // 60 a convoy; the line keeps going (count 0).
    expect(lineCostMilli(line)).toBe(60_000);
    expect(made).toBeGreaterThan(60_000 * 2);
    expect(ce.stock[key] - before).toBe(Math.floor(made / 60_000));
    expect(line.progress).toBe(made % 60_000);
    expect(ce.navalLines).toContain(line);
    // A count ends it: the last one done, the line goes.
    give(runner, { kind: "naval_line_count", line: line.id, count: 1 });
    const stock = ce.stock[key];
    for (let d = 20; d < 30 && ce.navalLines.includes(line); d++) {
      afterTurn(runner, d);
    }
    expect(ce.navalLines).not.toContain(line);
    expect(ce.stock[key]).toBe(stock + 1);
  }, 60_000);

  test("a lost port stalls the line until another base exists", async () => {
    const { runner, updates, ww, ce } = await britain();
    const econ = ww.economy;
    give(runner, {
      kind: "naval_line_add",
      cls: "dd",
      gen: 1,
      docks: 3,
      count: 1,
      port: REGION.london,
    });
    const line = ce.navalLines[ce.navalLines.length - 1];
    afterTurn(runner, 0);
    const kept = line.progress;
    expect(kept).toBeGreaterThan(0);
    // Bombed out: London's base (6 levels) and Malta's (1). The dockyards
    // still stand, but no port is left to launch into.
    damageBuilding(econ, REGION.london, "naval_base", 6000);
    damageBuilding(econ, REGION.malta, "naval_base", 1000);
    afterTurn(runner, 1);
    afterTurn(runner, 2);
    expect(line.port).toBe(0);
    expect(line.activeDocks).toBe(0);
    expect(line.lastOutput).toBe(0);
    // Its progress stays; the stall is told once.
    expect(line.progress).toBe(kept);
    const stalled = () =>
      updates
        .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
        .filter(
          (m) => m.message === "events_display.ww1936_naval_line_stalled",
        );
    expect(stalled()).toHaveLength(1);
    expect(stalled()[0].params).toEqual({ cls: "dd" });
    expect(dockyardsFree(econ, ce)).toBe(3);
    // Malta works again: the line moves there and goes on.
    repairBuilding(econ, REGION.malta, "naval_base", 1000);
    afterTurn(runner, 3);
    expect(line.port).toBe(REGION.malta);
    expect(line.activeDocks).toBe(3);
    expect(line.progress).toBe(kept + line.lastOutput);
    expect(stalled()).toHaveLength(1);
  }, 60_000);
});
