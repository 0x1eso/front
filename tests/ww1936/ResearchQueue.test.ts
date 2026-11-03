import {
  GameUpdateType,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import {
  WW_RESEARCH_QUEUE,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { reserveBlockOf } from "@openfront/engine-lib/ww1936/ResearchQueueRules";
import { techCostMilli } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Player } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  queueView,
  reserveResearch,
} from "@openfront/engine/ww1936/economy/ResearchQueue";
import { startResearch } from "@openfront/engine/ww1936/economy/ResearchRun";
import {
  byTag,
  clearStartSetup,
  HUMAN,
  stamped,
  step,
  stepTo,
  wwRestore,
  wwRunnerCapture,
} from "./util";

const DEU = [{ clientID: HUMAN, country: "DEU" as const }];

/** Runs through `p`'s processing on `day`. */
function throughDay(runner: GameRunner, p: Player, day: number): void {
  stepTo(runner, dayStartTick(day, WW_PREP_TICKS) + (p.smallID() % 7) + 1);
}

/** A game where Germany is a human's, its slots empty, auto research off. */
async function germany() {
  const { runner, updates } = await wwRunnerCapture({}, DEU);
  const g = runner.game;
  const econ = g.worldWar()!.economy;
  const deu = byTag(g, "DEU");
  const ce = econ.country(deu.smallID())!;
  clearStartSetup(econ, ce);
  return { runner, updates, g, econ, deu, ce };
}

/** Almost finishes the tech in slot `i`, so the next day completes it. */
function nearlyDone(
  ce: { slots: ({ tech: never; progress: number } | null)[] },
  i: number,
) {
  const s = ce.slots[i]!;
  s.progress = techCostMilli(s.tech) - 1;
}

function dropNotices(updates: GameUpdateViewData[]) {
  return updates
    .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
    .filter((m) => m.message === "events_display.ww1936_research_queue_failed")
    .map((m) => m.params);
}

describe("research queues (one per slot)", () => {
  test("a slot's queue runs in order; automatic research leaves it alone and stays on", async () => {
    const { runner, g, econ, deu, ce } = await germany();
    expect(startResearch(econ, ce, "tools_2")).toBeNull();
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "auto_set", domain: "research", on: true },
      }),
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "research_reserve", tech: "electronics_1", slot: 0 },
      }),
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "research_reserve", tech: "inf_eq_2", slot: 0 },
      }),
    ]);
    expect(ce.rq).toEqual([["electronics_1", "inf_eq_2"]]);
    // Reserving did not switch the automatic research off.
    expect(g.worldWar()!.autoOn(deu.smallID(), "research")).toBe(true);
    nearlyDone(ce as never, 0);
    throughDay(runner, deu, 1);
    expect(ce.researched.has("tools_2")).toBe(true);
    expect(ce.slots[0]?.tech).toBe("electronics_1");
    expect(ce.rq[0]).toEqual(["inf_eq_2"]);
    // The automatic research filled the other slots, but not from the queue.
    expect(ce.slots[1]).not.toBeNull();
    for (const s of ce.slots) expect(["inf_eq_2"]).not.toContain(s?.tech);
    nearlyDone(ce as never, 0);
    throughDay(runner, deu, 2);
    expect(ce.slots[0]?.tech).toBe("inf_eq_2");
    expect(ce.rq[0] ?? []).toEqual([]);
  }, 60_000);

  test("a slot waits for a prerequisite running in another slot, then starts it", async () => {
    const { runner, econ, deu, ce } = await germany();
    expect(startResearch(econ, ce, "inf_eq_2")).toBeNull();
    // Chained: inf_eq_3 needs the running inf_eq_2; slot 1 is free but waits.
    expect(reserveResearch(econ, ce, "inf_eq_3", 1)).toBeNull();
    expect(ce.slots[1]).toBeNull();
    expect(queueView(econ, ce)[1]).toEqual({
      techs: ["inf_eq_3"],
      waitingOn: "inf_eq_2",
    });
    // A direct start passes the waiting slot by.
    expect(startResearch(econ, ce, "electronics_1")).toBeNull();
    expect(ce.slots[2]?.tech).toBe("electronics_1");
    throughDay(runner, deu, 3);
    expect(ce.slots[1]).toBeNull();
    nearlyDone(ce as never, 0);
    throughDay(runner, deu, 4);
    expect(ce.researched.has("inf_eq_2")).toBe(true);
    expect(ce.slots[1]?.tech).toBe("inf_eq_3");
    expect(ce.rq[1] ?? []).toEqual([]);
  }, 60_000);

  test("an exclusive of a running or queued tech is refused with a reason; a tech sits in one queue", async () => {
    const { econ, ce } = await germany();
    expect(startResearch(econ, ce, "tools_2")).toBeNull();
    expect(reserveResearch(econ, ce, "concentrated_1", 0)).toBeNull();
    expect(reserveResearch(econ, ce, "dispersed_1", 0)).toBe("exclusive");
    expect(reserveResearch(econ, ce, "dispersed_1", 1)).toBe("exclusive");
    expect(reserveResearch(econ, ce, "concentrated_1", 1)).toBe(
      "research_queued",
    );
    expect(reserveResearch(econ, ce, "tools_2", 1)).toBe("in_progress");
  });

  test("an entry that can never start goes with what needs it, in one notice, and the next one starts the same day", async () => {
    const { runner, updates, econ, deu, ce } = await germany();
    expect(startResearch(econ, ce, "tools_2")).toBeNull();
    for (const t of [
      "concentrated_1",
      "concentrated_2",
      "electronics_1",
    ] as const) {
      expect(reserveResearch(econ, ce, t, 0)).toBeNull();
    }
    // The other line is taken meanwhile (an event, say).
    ce.addTech("dispersed_1");
    nearlyDone(ce as never, 0);
    throughDay(runner, deu, 1);
    expect(ce.slots[0]?.tech).toBe("electronics_1");
    expect(ce.rq[0] ?? []).toEqual([]);
    expect(dropNotices(updates)).toEqual([{ tech: "concentrated_1" }]);
  }, 60_000);

  test("full queues survive a snapshot with the same hash", async () => {
    const { runner, g, econ, ce } = await germany();
    expect(startResearch(econ, ce, "tools_2")).toBeNull();
    expect(startResearch(econ, ce, "inf_eq_2")).toBeNull();
    expect(startResearch(econ, ce, "electronics_1")).toBeNull();
    const state = () => ({
      researched: ce.researched,
      running: ce.slots.flatMap((s) => (s === null ? [] : [s.tech])),
      slotCount: 3,
      queues: ce.rq,
    });
    for (const t of WW_TECH_IDS) {
      for (const slot of [0, 1]) {
        if (reserveBlockOf(state(), t, slot) === null) {
          expect(reserveResearch(econ, ce, t, slot)).toBeNull();
          break;
        }
      }
      if (
        ce.rq.every((q) => q.length === WW_RESEARCH_QUEUE) &&
        ce.rq.length === 2
      )
        break;
    }
    expect(ce.rq.map((q) => q.length)).toEqual([
      WW_RESEARCH_QUEUE,
      WW_RESEARCH_QUEUE,
    ]);
    const before = econ.hash();
    const copy = await wwRestore(runner, DEU);
    const ce2 = copy.game.worldWar()!.economy.country(ce.smallID)!;
    expect(ce2.rq).toEqual(ce.rq);
    expect(copy.game.worldWar()!.economy.hash()).toBe(before);
    expect(g.worldWar()).not.toBeNull();
  });
});
