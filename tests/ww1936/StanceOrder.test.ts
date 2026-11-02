// A running plan's stance switch (the army card's 과감 button sends army_plan
// then army_execute through the ww_order intent): the engine must take it.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  stamped,
  step,
  warAfterPrep,
  wwRunner,
} from "./util";

describe("World War 1936: army_plan stance switch through the intent path", () => {
  test("army_plan aggressive then army_execute changes a running plan's stance", async () => {
    const runner = await wwRunner({}, [
      { clientID: HUMAN, country: "DEU" as const },
      { clientID: "HUMAN002", country: "POL" as const },
    ]);
    const g = runner.game;
    warAfterPrep(runner, HUMAN, "POL");
    clearLand(g);
    const l = land(g);
    const a = placeArmy(g, "DEU", 3, 6);
    const pol = byTag(g, "POL").smallID();
    const ww = (order: object) =>
      stamped(HUMAN, { type: "ww_order", order } as never);
    const issue = (order: object) => step(runner, 2, [ww(order)]);
    issue({ kind: "army_front", army: a.id, anchor: 3, enemy: pol });
    expect(a.order.kind).toBe("front");
    const target = [...l.scenario.regionNeighbours(3)].find(
      (r) => l.controller[r] === pol,
    );
    expect(target).toBeDefined();
    issue({
      kind: "army_plan",
      army: a.id,
      targets: [target],
      stance: "balanced",
    });
    issue({ kind: "army_execute", army: a.id, on: true });
    expect(a.order).toMatchObject({
      kind: "plan",
      stance: "balanced",
      executing: true,
    });
    // The 과감 button: the same plan with the stance changed, then execute.
    issue({
      kind: "army_plan",
      army: a.id,
      targets: [target],
      stance: "aggressive",
    });
    issue({ kind: "army_execute", army: a.id, on: true });
    expect(a.order).toMatchObject({
      kind: "plan",
      stance: "aggressive",
      executing: true,
    });
    // Why a stale resend is a silent no-op: a plan naming a region that is
    // ours now is refused (not_at_war), which is what the client must not send.
    l.controller[target!] = a.owner;
    expect(
      l.issue(a.owner, {
        kind: "army_plan",
        army: a.id,
        targets: [target!],
        stance: "balanced",
      }),
    ).toBe("not_at_war");
    expect(WW_PREP_TICKS).toBeGreaterThan(0);
  });
});
