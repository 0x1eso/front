// World War 1936 P6 T1b (navy/air half): the refit port lock (lane E's T1b
// site 5; spec §5.3.4) — a human Britain's destroyers in London (naval
// base 6) on ww1936deep.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { FLEET_STATES } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { refitHolds } from "@openfront/engine/ww1936/depth/Refit";
import { dailyRepair } from "@openfront/engine/ww1936/navy/Repair";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const LONDON = DEEP.region.london;
const REPAIRING = FLEET_STATES.indexOf("repairing");
const DOCKED = FLEET_STATES.indexOf("docked");
const AA_DD: Extract<DepthOrder, { kind: "design_save" }>["def"] = {
  kind: "ship",
  base: "dd_2",
  modules: ["", "", "sec_aa", ""],
  name: "AA Destroyer",
};

describe("T1b: a refitting ship holds its fleet in port", () => {
  it("player fleet orders and P4's repair end respect refitHolds", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const navy = ww.navy;
    const d = ww.depth;
    navy.country(GBR)!.navyXpMilli = 400_000;
    expect(
      d.issue(GBR, { kind: "design_save", def: AA_DD }, runner.game.ticks()),
    ).toBeNull();
    const fid = navy.createFleet(GBR, LONDON, [["dd", 2, 2]]);
    const f = navy.fleets.get(fid)!;
    const [ship, other] = f.ships;
    const tick = () => runner.game.ticks();
    expect(
      d.issue(GBR, { kind: "ship_refit", ship, slot: 1 }, tick()),
    ).toBeNull();
    expect(refitHolds(navy, f)).toBe(true);
    // Every order that would sail it is refused while the ship refits.
    const sea = ww.scenario.sr(DEEP.sr.approaches)!.members[0];
    expect(
      navy.issue(
        GBR,
        {
          kind: "fleet_mission",
          fleet: fid,
          mission: "patrol",
          sr: DEEP.sr.approaches,
        },
        tick(),
      ),
    ).toBe("fleet_busy");
    expect(
      navy.issue(GBR, { kind: "fleet_move", fleet: fid, zone: sea }, tick()),
    ).toBe("fleet_busy");
    expect(
      navy.issue(
        GBR,
        { kind: "fleet_base", fleet: fid, port: DEEP.region.malta },
        tick(),
      ),
    ).toBe("fleet_busy");
    expect(navy.issue(GBR, { kind: "fleet_return", fleet: fid }, tick())).toBe(
      "fleet_busy",
    );
    expect(f.docked).toBe(LONDON);
    // P4's repair end keeps the fleet in the repair state: HP whole, still refitting.
    expect(f.state).toBe(REPAIRING);
    dailyRepair(navy, GBR, ww.day(tick()));
    expect(f.state).toBe(REPAIRING);
    // A split may still take the other destroyer to sea.
    expect(
      navy.issue(
        GBR,
        { kind: "fleet_split", fleet: fid, counts: [], ships: [other] },
        tick(),
      ),
    ).toBeNull();
    const free = navy
      .fleetsOf(GBR)
      .find((x) => x.id !== fid && x.ships.includes(other))!;
    expect(refitHolds(navy, free)).toBe(false);
    expect(
      navy.issue(
        GBR,
        {
          kind: "fleet_mission",
          fleet: free.id,
          mission: "patrol",
          sr: DEEP.sr.approaches,
        },
        tick(),
      ),
    ).toBeNull();
    // Done: the lock lifts and the repair end docks it.
    const t = navy.ships;
    for (let i = 0; i < 40 * 15 && t.refitLeft[t.rowOf(ship)] > 0; i++) {
      step(runner, 1);
    }
    expect(refitHolds(navy, f)).toBe(false);
    step(runner, 3 * 15);
    expect(f.state).toBe(DOCKED);
    expect(
      navy.issue(
        GBR,
        {
          kind: "fleet_mission",
          fleet: fid,
          mission: "patrol",
          sr: DEEP.sr.approaches,
        },
        tick(),
      ),
    ).toBeNull();
  }, 120_000);
});
