import {
  GameUpdateType,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { byTag, HUMAN, stamped, step, stepTo, wwRunnerCapture } from "./util";

const econOf = (updates: GameUpdateViewData[]) =>
  updates.flatMap((u) => u.updates[GameUpdateType.WwEconomy]);

describe("the economy's day (spec §2)", () => {
  test("nothing runs during the preparation minute", async () => {
    const { runner, updates } = await wwRunnerCapture();
    stepTo(runner, WW_PREP_TICKS);
    // Only the opening update (every country, start values), on tick 1.
    const econ = econOf(updates);
    expect(econ.length).toBe(1);
    expect(econ[0].data.countries.map((c) => c.smallID)).toEqual(
      runner.game.allPlayers().map((p) => p.smallID()),
    );
    expect(econ[0].data.details).toEqual([]);
    expect(econ[0].data.regions).toEqual([]);
  });

  // Each tick's update lists the countries processed on it (plus any an
  // order or a trade touched). Day 0 and day 2 have 8 ticks, day 1 has 7;
  // a country is processed on tick dayStart + smallID % 7 of every day.
  test("every country runs exactly once a day", async () => {
    const { runner, updates } = await wwRunnerCapture();
    const ids = runner.game.allPlayers().map((p) => p.smallID());
    for (const day of [0, 1, 2, 40]) {
      const from = dayStartTick(day, WW_PREP_TICKS);
      const to = dayStartTick(day + 1, WW_PREP_TICKS);
      stepTo(runner, from);
      const runs = new Map<number, number[]>();
      for (let t = from; t < to; t++) {
        updates.length = 0;
        step(runner); // runs tick t
        for (const u of econOf(updates)) {
          for (const c of u.data.countries) {
            runs.set(c.smallID, [...(runs.get(c.smallID) ?? []), t - from]);
          }
        }
      }
      for (const id of ids) expect(runs.get(id)).toEqual([id % 7]);
    }
  });

  test("an order during preparation reaches the screen at once", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    stepTo(runner, 10);
    updates.length = 0;
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "research", tech: "tools_2" },
      }),
    ]);
    stepTo(runner, 13);
    const deu = byTag(runner.game, "DEU").smallID();
    const details = econOf(updates).flatMap((u) => u.data.details);
    expect(details.some((d) => d.smallID === deu)).toBe(true);
    // Nothing else moved: the economy still waits for the first day.
    expect(
      econOf(updates).flatMap((u) => u.data.countries.map((c) => c.smallID)),
    ).toEqual([deu]);
  });

  test("a human's first update carries its details", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "POL" },
    ]);
    step(runner, 2);
    const [first] = econOf(updates);
    const pol = byTag(runner.game, "POL").smallID();
    expect(first.data.details.map((d) => d.smallID)).toEqual([pol]);
    const d = first.data.details[0];
    expect(d.laws).toEqual({
      economy: "civilian",
      trade: "export_focus",
      conscription: "limited",
    });
    expect(d.researched).toEqual([
      "inf_eq_1",
      "support_eq_1",
      "motorized_1",
      "artillery_1",
      "fighter_1",
    ]);
    expect(d.slotCount).toBe(2);
    expect(d.warDays).toBe(-1);
  });
});
