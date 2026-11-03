// World War 1936 P4 (plan Task 4 Step 6): navy experience and admirals
// (spec §7.4, §7.5) on ww1936sea — a human Britain against a human Italy
// (the test map has no historical admirals: titled ones only).
import {
  FLEET_MISSIONS,
  FLEET_STATES,
  ShipClass,
  WW_TITLED_ADMIRAL_BASE,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  startNavalBattle,
  stepNavalBattles,
} from "@openfront/engine/ww1936/navy/NavalBattles";
import {
  dailyNavyXp,
  newTitledAdmiral,
} from "@openfront/engine/ww1936/navy/Repair";
import type {
  AdmiralState,
  Fleet,
  WwNavy,
} from "@openfront/engine/ww1936/navy/WwNavy";
import { REGION, SEA, TAG_ID, ZONE } from "./seaFixture";
import { warAfterPrep, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const GBR_H = "HUMAN001";
const ITA_H = "HUMAN002";
const HUMANS = [
  { clientID: GBR_H, country: "GBR" as const },
  { clientID: ITA_H, country: "ITA" as const },
];
const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;
const PORT: Record<number, number> = {
  [GBR]: REGION.london,
  [ITA]: REGION.rome,
};

function atSea(
  navy: WwNavy,
  owner: number,
  comp: readonly (readonly [ShipClass, number, number])[],
): Fleet {
  const f = navy.fleets.get(navy.createFleet(owner, PORT[owner], comp))!;
  f.docked = 0;
  f.state = FLEET_STATES.indexOf("on_station");
  navy.setFleetZone(f, ZONE.west);
  return f;
}

/** A titled admiral for `owner`, in command of `f`. */
function admiralFor(navy: WwNavy, owner: number, f: Fleet): AdmiralState {
  const a = newTitledAdmiral(navy, owner)!;
  f.admiral = a.id;
  a.fleet = f.id;
  return a;
}

describe("admirals and navy experience (spec §7.4, §7.5)", () => {
  it("battle days give admiral XP and raise a skill at level-up", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    warAfterPrep(runner, GBR_H, "ITA");
    const navy = runner.game.worldWar()!.navy;
    const tick = runner.game.ticks();
    const g = atSea(navy, GBR, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    const i = atSea(navy, ITA, [["bb", 1, 2]]);
    const a = admiralFor(navy, GBR, g);
    expect(a.skills).toEqual([1, 1, 1, 1]);
    expect(a.level).toBe(1);
    startNavalBattle(navy, ZONE.west, navy.sideOf(ITA), g.id, tick);
    stepNavalBattles(navy, tick);
    expect(navy.battles.get(ZONE.west)!.fleets[1]).toEqual([g.id]);
    void i;
    // One battle day short of level 2 (100 XP a level).
    a.xpMilli = 99_000;
    dailyNavyXp(navy, GBR, navy.day(tick));
    expect(a.xpMilli).toBe(101_000);
    expect(a.level).toBe(2);
    // Battle days grow attack (the fleet is above half its HP).
    expect(a.usage).toEqual([1, 0, 0, 0]);
    expect(a.skills).toEqual([2, 1, 1, 1]);
  });

  it("a mission day gives 0.2 and grows maneuver", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const navy = runner.game.worldWar()!.navy;
    const g = atSea(navy, GBR, [["cl", 1, 2]]);
    g.mission = FLEET_MISSIONS.indexOf("patrol");
    const a = admiralFor(navy, GBR, g);
    dailyNavyXp(navy, GBR, 0);
    expect(a.xpMilli).toBe(200);
    expect(a.usage).toEqual([0, 0, 1, 0]);
    // In port on hold: nothing.
    g.mission = FLEET_MISSIONS.indexOf("hold");
    dailyNavyXp(navy, GBR, 1);
    expect(a.xpMilli).toBe(200);
  });

  it("appoint_admiral is refused; a fleet with no admiral gets one free", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const navy = runner.game.worldWar()!.navy;
    // No free roster admiral: a titled one is made.
    for (const [k, a] of [...navy.admirals]) {
      if (a.owner === GBR || a.owner === ITA) navy.admirals.delete(k);
    }
    const g = atSea(navy, GBR, [["cl", 1, 2]]);
    expect(g.admiral).toBe(0);
    expect(navy.issue(GBR, { kind: "appoint_admiral" }, 0)).toBe("bad_index");
    dailyNavyXp(navy, GBR, 0);
    const id = WW_TITLED_ADMIRAL_BASE + GBR * 100 + 1;
    expect(g.admiral).toBe(id);
    expect(navy.admirals.get(id)).toMatchObject({
      owner: GBR,
      level: 1,
      skills: [1, 1, 1, 1],
      traits: 0,
      fleet: g.id,
    });
    // Italy's titled admiral sorts before Britain's (admirals iterate by id).
    const h = atSea(navy, ITA, [["cl", 1, 2]]);
    dailyNavyXp(navy, ITA, 0);
    expect(h.admiral).not.toBe(0);
    const ids = [...navy.admirals.keys()];
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
    expect(ids).toContain(WW_TITLED_ADMIRAL_BASE + ITA * 100 + 1);
  });
});
