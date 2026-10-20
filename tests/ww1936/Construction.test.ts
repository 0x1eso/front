import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_MAX_QUEUE } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  constructionProgress,
  projectSpeedPct,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  cancelBuild,
  moveBuild,
  queueBuild,
  stepConstruction,
  usedSlots,
} from "@openfront/engine/ww1936/economy/Construction";
import {
  byTag,
  HUMAN,
  stamped,
  step,
  stepTo,
  WwHuman,
  wwRunnerCapture,
} from "./util";

const HUMAN_FRA = "HUMAN002";

/** Runs until every country has had day `d`'s step. */
function finishDay(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + 7);
}

/**
 * The test map with Germany played by a human, so no AI economy touches
 * the numbers (France too when `withFrance`).
 */
async function germany(withFrance = false) {
  const humans: WwHuman[] = [{ clientID: HUMAN, country: "DEU" }];
  if (withFrance) humans.push({ clientID: HUMAN_FRA, country: "FRA" });
  const { runner, updates } = await wwRunnerCapture({}, humans);
  const g = runner.game;
  const ww = g.worldWar()!;
  const econ = ww.economy;
  const deu = byTag(g, "DEU");
  const fra = byTag(g, "FRA");
  const region = (name: string) =>
    ww.scenario.landRegions.find((r) => r.name === name)!;
  return {
    runner,
    updates,
    g,
    ww,
    econ,
    deu,
    fra,
    ce: econ.country(deu.smallID())!,
    fraCe: econ.country(fra.smallID())!,
    munich: region("Munich"),
    berlin: region("Berlin"),
    lyon: region("Lyon"),
    paris: region("Paris"),
  };
}

describe("construction (spec §4)", () => {
  test("a project gains what the formula says", async () => {
    const { runner, ce, munich } = await germany();
    expect(munich.id).toBe(4);
    // The player's build order, during the preparation minute.
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "build", region: munich.id, building: "civ", count: 1 },
      }),
    ]);
    expect(ce.queue).toHaveLength(1);
    expect(ce.queue[0].progress).toBe(0);
    finishDay(runner, 0);
    const speed = projectSpeedPct({
      building: "civ",
      infra: 5,
      tech: ce.tech,
      law: ce.law(),
    });
    // Infrastructure 5: +40; construction_1: +10.
    expect(speed).toBe(50);
    // 9 civilian factories less 25% consumer goods of 15 factories.
    expect(ce.totals.freeCivMilli).toBe(5_250);
    const q = ce.queue[0];
    expect(q.lastAssigned).toBe(Math.min(15_000, ce.totals.freeCivMilli));
    expect(q.lastSpeedPct).toBe(speed);
    expect(q.progress).toBe(
      constructionProgress(Math.min(15_000, ce.totals.freeCivMilli), speed),
    );
    expect(q.progress).toBe(39_375);
  });

  test("the building appears when the cost is reached, the rest rolls on", async () => {
    const { runner, updates, econ, deu, ce, munich } = await germany();
    expect(queueBuild(econ, ce, munich.id, "civ", 2)).toBeNull();
    const before = 10_800_000 - 1;
    ce.queue[0].progress = before;
    const civ = econ.civ[munich.id];
    finishDay(runner, 0);
    expect(econ.civ[munich.id]).toBe(civ + 1);
    expect(ce.queue).toHaveLength(1);
    expect(ce.queue[0].count).toBe(1);
    expect(ce.queue[0].progress).toBe(before + 39_375 - 10_800_000);
    // The owner hears of it, once for the day.
    const built = updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_built");
    expect(built).toHaveLength(1);
    expect(built[0].playerID).toBe(deu.smallID());
    expect(built[0].params).toEqual({ count: 1 });
    // The screens get the region; the next day counts the new factory.
    const regions = updates
      .flatMap((u) => u.updates[GameUpdateType.WwEconomy])
      .flatMap((e) => e.data.regions)
      .filter((r) => r.id === munich.id);
    expect(regions[regions.length - 1].civ).toBe(civ + 1);
    finishDay(runner, 1);
    expect(ce.totals.civ).toBe(10);
    // The last one done, the entry ends and its extra progress is dropped.
    ce.queue[0].progress = 10_800_000 - 1;
    finishDay(runner, 2);
    expect(econ.civ[munich.id]).toBe(civ + 2);
    expect(ce.queue).toEqual([]);
  });

  test("the queue reserves slots", async () => {
    const { econ, ce, munich } = await germany();
    // Munich (large_city): 8 slots, 9 with construction_1; 7 factories.
    expect(econ.regionSlots(munich.id, ce.tech.slotPct)).toBe(9);
    expect(usedSlots(econ, munich.id)).toBe(7);
    expect(queueBuild(econ, ce, munich.id, "civ", 3)).toBe("no_slots");
    expect(queueBuild(econ, ce, munich.id, "civ", 1)).toBeNull();
    expect(usedSlots(econ, munich.id)).toBe(8);
    expect(queueBuild(econ, ce, munich.id, "civ", 1)).toBeNull();
    expect(usedSlots(econ, munich.id)).toBe(9);
    expect(queueBuild(econ, ce, munich.id, "civ", 1)).toBe("no_slots");
    expect(queueBuild(econ, ce, munich.id, "mil", 1)).toBe("no_slots");
    expect(ce.queue).toHaveLength(2);
  });

  test("infrastructure stops at five", async () => {
    const { econ, ce, fraCe, berlin, munich, lyon, paris } =
      await germany(true);
    expect(econ.infra[berlin.id]).toBe(5);
    expect(queueBuild(econ, ce, berlin.id, "infra", 1)).toBe("infra_max");
    expect(queueBuild(econ, ce, munich.id, "dock", 1)).toBe("not_buildable");
    expect(queueBuild(econ, ce, paris.id, "civ", 1)).toBe("not_controlled");
    expect(queueBuild(econ, ce, 999, "infra", 1)).toBe("not_controlled");
    // Lyon (infrastructure 4): one more level, the queued one counts.
    expect(econ.infra[lyon.id]).toBe(4);
    expect(queueBuild(econ, fraCe, lyon.id, "infra", 2)).toBe("infra_max");
    expect(queueBuild(econ, fraCe, lyon.id, "infra", 1)).toBeNull();
    expect(queueBuild(econ, fraCe, lyon.id, "infra", 1)).toBe("infra_max");
    // Thirty entries at most.
    while (fraCe.queue.length < WW_MAX_QUEUE) {
      fraCe.queue.push({ ...fraCe.queue[0] });
    }
    expect(queueBuild(econ, ce, munich.id, "civ", 1)).toBeNull();
    expect(queueBuild(econ, fraCe, paris.id, "infra", 1)).toBe("queue_full");
  });

  test("an infrastructure level finishes like a factory", async () => {
    const { runner, econ, fraCe, lyon } = await germany(true);
    expect(queueBuild(econ, fraCe, lyon.id, "infra", 1)).toBeNull();
    fraCe.queue[0].progress = 4_500_000 - 1;
    finishDay(runner, 0);
    expect(econ.infra[lyon.id]).toBe(5);
    expect(fraCe.queue).toEqual([]);
    expect(queueBuild(econ, fraCe, lyon.id, "infra", 1)).toBe("infra_max");
  });

  test("losing a region drops its projects", async () => {
    const { runner, updates, ww, econ, ce, fra, fraCe, munich, berlin } =
      await germany(true);
    expect(queueBuild(econ, ce, munich.id, "civ", 1)).toBeNull();
    expect(queueBuild(econ, ce, berlin.id, "civ", 1)).toBeNull();
    stepTo(runner, WW_PREP_TICKS + 1);
    fra.conquer(ww.scenario.vpTile(munich));
    // Until the next day's common step the region is still Germany's.
    finishDay(runner, 0);
    expect(ce.queue.map((q) => q.region)).toEqual([munich.id, berlin.id]);
    finishDay(runner, 1);
    expect(econ.controllerOf(munich.id)).toBe(fra.smallID());
    expect(ce.queue.map((q) => q.region)).toEqual([berlin.id]);
    const regions = updates
      .flatMap((u) => u.updates[GameUpdateType.WwEconomy])
      .flatMap((e) => e.data.regions)
      .filter((r) => r.id === munich.id);
    expect(regions[regions.length - 1].controller).toBe(fra.smallID());
    // The factories stay in Munich; Germany has only Berlin's 5 now, and
    // France counts half of Munich's 4 (Germany still fights).
    expect(econ.civ[munich.id]).toBe(4);
    expect(ce.totals.civ).toBe(5);
    expect(econ.isOccupied(munich.id)).toBe(true);
    expect(fraCe.totals.civ).toBe(8 + Math.floor((4 * 50) / 100));
    expect(queueBuild(econ, fraCe, munich.id, "civ", 1)).toBe("occupied");
  });

  test("occupied regions count half and cannot get factories", async () => {
    const { runner, ww, econ, deu, ce, fraCe, lyon } = await germany(true);
    stepTo(runner, WW_PREP_TICKS + 1);
    expect([ce.totals.civ, ce.totals.mil]).toEqual([9, 6]);
    deu.conquer(ww.scenario.vpTile(lyon));
    finishDay(runner, 1);
    expect(econ.controllerOf(lyon.id)).toBe(deu.smallID());
    expect(econ.isOccupied(lyon.id)).toBe(true);
    // Lyon: civ 3, mil 2 at 50%, each rounded down.
    expect(ce.totals.civ).toBe(9 + 1);
    expect(ce.totals.mil).toBe(6 + 1);
    expect(fraCe.totals.civ).toBe(5);
    expect(queueBuild(econ, ce, lyon.id, "civ", 1)).toBe("occupied");
    expect(queueBuild(econ, ce, lyon.id, "mil", 1)).toBe("occupied");
    // Lyon's infrastructure is 4: one more level is allowed.
    expect(queueBuild(econ, ce, lyon.id, "infra", 1)).toBeNull();
  });

  test("15 per project, front first", async () => {
    const { econ, deu, ce, munich, berlin } = await germany();
    expect(queueBuild(econ, ce, munich.id, "civ", 1)).toBeNull();
    expect(queueBuild(econ, ce, berlin.id, "civ", 1)).toBeNull();
    expect(queueBuild(econ, ce, munich.id, "mil", 1)).toBeNull();
    ce.totals.freeCivMilli = 20_000;
    stepConstruction(econ, ce, deu);
    expect(ce.queue.map((q) => q.lastAssigned)).toEqual([15_000, 5_000, 0]);
    expect(ce.queue.map((q) => q.progress)).toEqual([
      constructionProgress(15_000, 50),
      constructionProgress(5_000, 50),
      0,
    ]);
    // A military factory under partial mobilisation builds 10% faster.
    expect(ce.queue.map((q) => q.lastSpeedPct)).toEqual([50, 50, 60]);
  });

  test("cancel and move", async () => {
    const { econ, ce, munich, berlin } = await germany();
    expect(queueBuild(econ, ce, munich.id, "civ", 1)).toBeNull();
    expect(queueBuild(econ, ce, berlin.id, "civ", 1)).toBeNull();
    expect(queueBuild(econ, ce, munich.id, "mil", 1)).toBeNull();
    const [a, b, c] = ce.queue;
    expect(cancelBuild(econ, ce, 5)).toBe("bad_index");
    expect(cancelBuild(econ, ce, -1)).toBe("bad_index");
    expect(moveBuild(econ, ce, 0, 3)).toBe("bad_index");
    expect(moveBuild(econ, ce, 0, 2)).toBeNull();
    expect(ce.queue).toEqual([b, c, a]);
    expect(moveBuild(econ, ce, 2, 0)).toBeNull();
    expect(ce.queue).toEqual([a, b, c]);
    // Cancelling gives the reserved slot back.
    expect(queueBuild(econ, ce, munich.id, "civ", 1)).toBe("no_slots");
    expect(cancelBuild(econ, ce, 2)).toBeNull();
    expect(ce.queue).toEqual([a, b]);
    expect(queueBuild(econ, ce, munich.id, "civ", 1)).toBeNull();
  });

  test("the player's cancel and move orders reach the queue", async () => {
    const { runner, ce, munich, berlin } = await germany();
    const order = (o: WwOrder) =>
      stamped(HUMAN, { type: "ww_order", order: o });
    step(runner, 1, [
      order({ kind: "build", region: munich.id, building: "civ", count: 1 }),
      order({ kind: "build", region: berlin.id, building: "civ", count: 1 }),
    ]);
    expect(ce.queue.map((q) => q.region)).toEqual([munich.id, berlin.id]);
    step(runner, 1, [order({ kind: "move_build", index: 1, to: 0 })]);
    expect(ce.queue.map((q) => q.region)).toEqual([berlin.id, munich.id]);
    step(runner, 1, [order({ kind: "cancel_build", index: 0 })]);
    expect(ce.queue.map((q) => q.region)).toEqual([munich.id]);
  });
});
