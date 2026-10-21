// World War 1936 P4 (plan Task 4 Step 6): repairs in naval bases and
// organisation (spec §5.4, §7.1) on ww1936sea (London: naval base 6,
// dockyards 3; Lyon: naval base 1, France's only dockyard).
import {
  FLEET_MISSIONS,
  FLEET_STATES,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  dailyRepair,
  repairDayMilli,
} from "@openfront/engine/ww1936/navy/Repair";
import type { Fleet, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { NAVAL_BASE, REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import { withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const HUMANS = [
  { clientID: "HUMAN001", country: "GBR" as const },
  { clientID: "HUMAN002", country: "FRA" as const },
];
const GBR = TAG_ID.GBR;
const FRA = TAG_ID.FRA;

async function navyOf(): Promise<WwNavy> {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  return runner.game.worldWar()!.navy;
}

function docked(
  navy: WwNavy,
  owner: number,
  port: number,
  comp: readonly (readonly [ShipClass, number, number])[],
): Fleet {
  return navy.fleets.get(navy.createFleet(owner, port, comp))!;
}

const row = (navy: WwNavy, id: number) => navy.ships.rowOf(id);

describe("repairs (spec §5.4, §7.1)", () => {
  it("repair is (1% + 0.3% × level) a day", async () => {
    const navy = await navyOf();
    expect(NAVAL_BASE[REGION.london]).toBe(6);
    const f = docked(navy, GBR, REGION.london, [["bb", 1, 1]]);
    const r = row(navy, f.ships[0]);
    navy.ships.hp[r] = 75_000;
    dailyRepair(navy, GBR, 0);
    // London level 6: 2.8% of 150 HP = 4.2 HP a day, two dockyards held.
    expect(navy.ships.hp[r]).toBe(79_200);
    expect(navy.ships.docks[r]).toBe(2);
    // Level 10: 4% a day; repairPct scales it.
    expect(repairDayMilli(150_000, 10, 0, 2, 2)).toBe(6_000);
    expect(repairDayMilli(150_000, 6, 50, 2, 2)).toBe(6_300);
    // At sea: no repair, no dockyards.
    f.docked = 0;
    f.state = FLEET_STATES.indexOf("on_station");
    dailyRepair(navy, GBR, 1);
    expect(navy.ships.hp[r]).toBe(79_200);
    expect(navy.ships.docks[r]).toBe(0);
  });

  it("lacking docks slow repair proportionally", async () => {
    const navy = await navyOf();
    // France's one dockyard (Lyon) for a battleship that needs two: half speed.
    expect(repairDayMilli(150_000, 1, 0, 1, 2)).toBe(975);
    expect(repairDayMilli(150_000, 1, 0, 2, 2)).toBe(1_950);
    expect(repairDayMilli(150_000, 1, 0, 0, 2)).toBe(0);
    const f = docked(navy, FRA, REGION.lyon, [["bb", 1, 1]]);
    const r = row(navy, f.ships[0]);
    navy.ships.hp[r] = 75_000;
    const ce = navy.ww.economy.country(FRA)!;
    expect(ce.totals.dock).toBe(1);
    expect(ce.docksLent).toBe(0);
    dailyRepair(navy, FRA, 0);
    // Lane E's lendDocks lends France's one dockyard (docksLent 1, the
    // lines lose it tomorrow); the battleship holds it and repairs at half
    // of Lyon's 1.3% a day.
    expect(ce.docksLent).toBe(1);
    expect(navy.ships.docks[r]).toBe(1);
    expect(navy.ships.hp[r] - 75_000).toBe(975);
  });

  it("repair places: the lowest HP ratio first, capital ships take two", async () => {
    const navy = await navyOf();
    // Lyon level 1: two places. A destroyer at 20%, a battleship at 30%, a
    // destroyer at 50%: the first destroyer takes one place, the battleship
    // does not fit, the second destroyer takes the other.
    const f = docked(navy, FRA, REGION.lyon, [
      ["dd", 1, 2],
      ["bb", 1, 1],
    ]);
    const [d1, d2, bb] = f.ships.map((id) => row(navy, id));
    navy.ships.hp[d1] = 3_000;
    navy.ships.hp[d2] = 7_500;
    navy.ships.hp[bb] = 45_000;
    // Places, not dockyards, are under test: with lane E's lendDocks
    // France's one dockyard would leave the second destroyer a place but
    // nothing to repair with.
    navy.ww.economy.country(FRA)!.totals.dock = 3;
    dailyRepair(navy, FRA, 0);
    expect(navy.ships.hp[bb]).toBe(45_000);
    expect(navy.ships.docks[bb]).toBe(0);
    expect(navy.ships.hp[d1]).toBeGreaterThan(3_000);
    expect(navy.ships.hp[d2]).toBeGreaterThan(7_500);
  });

  it("org recovers 10% a day in port", async () => {
    const navy = await navyOf();
    const f = docked(navy, GBR, REGION.london, [["bb", 1, 1]]);
    const r = row(navy, f.ships[0]);
    navy.ships.org[r] = 10_000;
    dailyRepair(navy, GBR, 0);
    expect(navy.ships.org[r]).toBe(14_000);
    // At sea: 2% a day.
    f.docked = 0;
    f.state = FLEET_STATES.indexOf("on_station");
    dailyRepair(navy, GBR, 1);
    expect(navy.ships.org[r]).toBe(14_800);
    // Full stays full.
    navy.ships.org[r] = 40_000;
    dailyRepair(navy, GBR, 2);
    expect(navy.ships.org[r]).toBe(40_000);
  });

  it("a repaired fleet resumes its mission", async () => {
    const navy = await navyOf();
    // Home from a patrol of the Western Approaches, its last ship nearly whole.
    const f = docked(navy, GBR, REGION.london, [["dd", 1, 1]]);
    const r = row(navy, f.ships[0]);
    f.mission = FLEET_MISSIONS.indexOf("patrol");
    f.missionSr = SR.approaches;
    f.state = FLEET_STATES.indexOf("repairing");
    // 420 milli a day at London: one day from 14.8 HP, then whole.
    navy.ships.hp[r] = 14_800;
    expect(f.zone).toBe(ZONE.west);
    dailyRepair(navy, GBR, 0);
    expect(navy.ships.hp[r]).toBe(15_000);
    // Done: docked with its patrol and region kept (lane N1 sails it out).
    expect(FLEET_STATES[f.state]).toBe("docked");
    expect(FLEET_MISSIONS[f.mission]).toBe("patrol");
    expect(f.missionSr).toBe(SR.approaches);
    // Not yet whole: it goes on repairing.
    const g = docked(navy, GBR, REGION.london, [["bb", 1, 1]]);
    g.mission = FLEET_MISSIONS.indexOf("patrol");
    g.missionSr = SR.approaches;
    g.state = FLEET_STATES.indexOf("repairing");
    navy.ships.hp[row(navy, g.ships[0])] = 100_000;
    dailyRepair(navy, GBR, 1);
    expect(FLEET_STATES[g.state]).toBe("repairing");
    expect(FLEET_MISSIONS[g.mission]).toBe("patrol");
  });
});
