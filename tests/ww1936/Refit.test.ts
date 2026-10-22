// World War 1936 P6 lane E (plan Task 3 Step 8, spec §5.3.4): ship
// refits — a human Britain's destroyers in London (naval base 6).
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  FLEET_MISSIONS,
  FLEET_STATES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { navalLineOutputMilli } from "@openfront/engine-lib/ww1936/NavalLineRules";
import {
  refitCostMilli,
  refitHolds,
} from "@openfront/engine/ww1936/depth/Refit";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const LONDON = DEEP.region.london;
const MALTA = DEEP.region.malta;
const REPAIRING = FLEET_STATES.indexOf("repairing");
/** A destroyer II with more anti-air (+60%, cost +5%). */
const AA_DD: DesignDef = {
  kind: "ship",
  base: "dd_2",
  modules: ["", "", "sec_aa", ""],
  name: "AA Destroyer",
};

async function game() {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "GBR" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  ww.navy.country(GBR)!.navyXpMilli = 400_000;
  const d = ww.depth;
  expect(
    d.issue(GBR, { kind: "design_save", def: AA_DD }, runner.game.ticks()),
  ).toBeNull();
  return { runner, ww, d, navy: ww.navy };
}

describe("World War 1936 P6: ship refits", () => {
  it("ship refit changes stats in port", async () => {
    const { runner, ww, d, navy } = await game();
    const fid = navy.createFleet(GBR, LONDON, [["dd", 2, 2]]);
    const f = navy.fleets.get(fid)!;
    const [ship, other] = f.ships;
    const t = navy.ships;
    const r0 = t.rowOf(ship);
    const before = navy.shipStatsOf(r0);
    const tick = runner.game.ticks();
    // The refusals first: an empty slot, someone else's ship, a wrong hull.
    expect(d.issue(GBR, { kind: "ship_refit", ship, slot: 2 }, tick)).toBe(
      "bad_slot",
    );
    expect(
      d.issue(DEEP.tag.FRA, { kind: "ship_refit", ship, slot: 1 }, tick),
    ).toBe("bad_slot");
    const malta = navy.createFleet(GBR, MALTA, [["dd", 2, 1]]);
    const atMalta = navy.fleets.get(malta)!.ships[0];
    // Malta's naval base is level 1: no refits there.
    expect(
      d.issue(GBR, { kind: "ship_refit", ship: atMalta, slot: 1 }, tick),
    ).toBe("not_refittable");
    const cl = navy.createFleet(GBR, LONDON, [["cl", 2, 1]]);
    expect(
      d.issue(
        GBR,
        { kind: "ship_refit", ship: navy.fleets.get(cl)!.ships[0], slot: 1 },
        tick,
      ),
    ).toBe("not_refittable");
    // The refit: (sec_aa 5% + 10%) of the hull over Britain's 3 dockyards.
    const ce = ww.economy.country(GBR)!;
    expect(
      d.issue(GBR, { kind: "ship_refit", ship, slot: 1 }, tick),
    ).toBeNull();
    expect(d.issue(GBR, { kind: "ship_refit", ship, slot: 1 }, tick)).toBe(
      "not_refittable",
    );
    const r = t.rowOf(ship);
    expect(t.refitTo[r]).toBe(1);
    const pct =
      ce.stats.dockOutputPct + ce.law().outputPct + ce.stats.outputPct;
    const days = Math.ceil(
      refitCostMilli("dd", 2, null, AA_DD.modules) /
        (3 * navalLineOutputMilli(1, pct, 1000)),
    );
    expect(t.refitLeft[r]).toBe(days);
    expect(days).toBeGreaterThan(1);
    expect(f.state).toBe(REPAIRING);
    // Same numbers until it is done.
    expect(navy.shipStatsOf(r).aa).toBe(before.aa);
    for (let i = 0; i < 20 * 15 && t.refitLeft[t.rowOf(ship)] > 0; i++) {
      step(runner, 1);
    }
    const r2 = t.rowOf(ship);
    expect(t.refitLeft[r2]).toBe(0);
    expect(t.refitTo[r2]).toBe(0);
    expect(t.design[r2]).toBe(1);
    expect(navy.shipStatsOf(r2).aa).toBe(Math.floor((before.aa * 160) / 100));
    // The other destroyer kept the base class.
    expect(t.design[t.rowOf(other)]).toBe(0);
    expect(navy.shipStatsOf(t.rowOf(other)).aa).toBe(before.aa);
  });

  it("a refitting ship cannot sail", async () => {
    const { runner, d, navy } = await game();
    const fid = navy.createFleet(GBR, LONDON, [["dd", 2, 1]]);
    const f = navy.fleets.get(fid)!;
    const ship = f.ships[0];
    const t = navy.ships;
    expect(
      d.issue(GBR, { kind: "ship_refit", ship, slot: 1 }, runner.game.ticks()),
    ).toBeNull();
    expect(refitHolds(navy, f)).toBe(true);
    // A mission waits for it: the fleet stays in London while it refits
    // (the fleet orders' port lock is T1b's hook).
    f.mission = FLEET_MISSIONS.indexOf("patrol");
    f.missionSr = DEEP.sr.approaches;
    let days = 0;
    while (t.refitLeft[t.rowOf(ship)] > 0 && days < 30) {
      step(runner, 15);
      days += 2;
      if (t.refitLeft[t.rowOf(ship)] > 0) {
        expect(f.docked).toBe(LONDON);
        expect(f.path).toEqual([]);
      }
    }
    expect(t.design[t.rowOf(ship)]).toBe(1);
    expect(refitHolds(navy, f)).toBe(false);
    // Done: the mission takes it out.
    step(runner, 4 * 15);
    expect(f.docked).toBe(0);
  });

  it("a refit out of port waits", async () => {
    const { runner, d, navy } = await game();
    const fid = navy.createFleet(GBR, LONDON, [["dd", 2, 1]]);
    const f = navy.fleets.get(fid)!;
    const ship = f.ships[0];
    const t = navy.ships;
    const tick = runner.game.ticks();
    expect(
      d.issue(GBR, { kind: "ship_refit", ship, slot: 1 }, tick),
    ).toBeNull();
    const left = t.refitLeft[t.rowOf(ship)];
    // The player sails it anyway (until T1b's port lock refuses the order).
    expect(
      navy.issue(
        GBR,
        { kind: "fleet_move", fleet: fid, zone: DEEP.zone.middle },
        tick,
      ),
    ).toBeNull();
    step(runner, 3 * 15);
    expect(f.docked).toBe(0);
    expect(t.refitLeft[t.rowOf(ship)]).toBe(left);
    expect(t.design[t.rowOf(ship)]).toBe(0);
  });
});
