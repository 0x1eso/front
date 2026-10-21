// World War 1936 P4 (plan Task 4 Step 6): naval battles (spec §9) on the
// test map ww1936sea — a human Britain against a human Italy, fleets put
// to sea by hand and the battle opened directly (lane N1 opens them in a
// real game), its rounds run by stepNavalBattles.
import {
  ENGAGE_RULES,
  FLEET_MISSIONS,
  FLEET_STATES,
  SHIP_CLASSES,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  battleShipsOf,
  startNavalBattle,
  stepNavalBattles,
} from "@openfront/engine/ww1936/navy/NavalBattles";
import { dailyRepair } from "@openfront/engine/ww1936/navy/Repair";
import type { Fleet, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  gameHash,
  step,
  warAfterPrep,
  withTestPolitics,
  wwRestore,
  wwRunner,
} from "./util";

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

/** Britain and Italy at war, past the preparation minute. */
async function seaWar(): Promise<{
  runner: GameRunner;
  navy: WwNavy;
  tick: number;
}> {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  warAfterPrep(runner, GBR_H, "ITA");
  const navy = runner.game.worldWar()!.navy;
  expect(navy.isEnemy(GBR, ITA)).toBe(true);
  return { runner, navy, tick: runner.game.ticks() };
}

/** A fleet of `owner` from its home port, at sea in `zone`. */
function atSea(
  navy: WwNavy,
  owner: number,
  zone: number,
  comp: readonly (readonly [ShipClass, number, number])[],
): Fleet {
  const f = navy.fleets.get(navy.createFleet(owner, PORT[owner], comp))!;
  f.docked = 0;
  f.state = FLEET_STATES.indexOf("on_station");
  navy.setFleetZone(f, zone);
  return f;
}

/** Runs rounds until the zone's battle ends (at most `max`); returns the last round. */
function fightOut(navy: WwNavy, zone: number, tick: number, max = 60): number {
  let last = 0;
  for (let i = 0; i < max && navy.battles.has(zone); i++) {
    stepNavalBattles(navy, tick);
    last = navy.battles.get(zone)?.round ?? last + 1;
  }
  expect(navy.battles.has(zone)).toBe(false);
  return last;
}

const hpOf = (navy: WwNavy, id: number) => navy.ships.hp[navy.ships.rowOf(id)];

describe("naval battles (spec §9)", () => {
  it("two 1922 battleships break off around round 8 and neither sinks", async () => {
    const { navy, tick } = await seaWar();
    const g = atSea(navy, GBR, ZONE.west, [["bb", 1, 1]]);
    const i = atSea(navy, ITA, ZONE.west, [["bb", 1, 1]]);
    startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), i.id, tick);
    const b = navy.battles.get(ZONE.west)!;
    expect(b.fleets).toEqual([[g.id], [i.id]]);
    const rounds = fightOut(navy, ZONE.west, tick);
    expect(rounds).toBeGreaterThanOrEqual(7);
    expect(rounds).toBeLessThanOrEqual(10);
    for (const f of [g, i]) {
      expect(f.ships).toHaveLength(1);
      const hp = hpOf(navy, f.ships[0]);
      expect(hp).toBeGreaterThan(0);
      // Both lost about 40% (spec §9.10).
      expect(hp).toBeLessThan(100_000);
      expect(FLEET_STATES[f.state]).not.toBe("battle");
    }
  });

  it("a full screen keeps surface torpedoes off the battle line", async () => {
    const { navy, tick } = await seaWar();
    const g = atSea(navy, GBR, ZONE.west, [
      ["bb", 1, 4],
      ["dd", 1, 12],
    ]);
    // A titled admiral: coordination 1 (+50‰) fills the screen (positioning 990‰).
    const cn = navy.country(GBR)!;
    cn.navyXpMilli = 10_000;
    expect(navy.issue(GBR, { kind: "appoint_admiral" }, tick)).toBeNull();
    const adm = [...navy.admirals.values()].find(
      (a) => a.owner === GBR && a.level === 1 && a.skills.every((s) => s === 1),
    )!;
    g.admiral = adm.id;
    adm.fleet = g.id;
    const i = atSea(navy, ITA, ZONE.west, [["dd", 1, 12]]);
    startNavalBattle(navy, ZONE.west, navy.sideOf(ITA), g.id, tick);
    const before = g.ships.map((id) => hpOf(navy, id));
    stepNavalBattles(navy, tick);
    expect(navy.battles.get(ZONE.west)!.round).toBe(1);
    const after = g.ships.map((id) => hpOf(navy, id));
    // The four battleships (the first rows) untouched; the destroyers took it all.
    expect(after.slice(0, 4)).toEqual(before.slice(0, 4));
    const ddLoss = before
      .slice(4)
      .reduce((s, hp, k) => s + hp - after[4 + k], 0);
    expect(ddLoss).toBeGreaterThan(0);
    void i;
  });

  it("the faster ship escapes first", async () => {
    const { navy, tick } = await seaWar();
    // An `avoid` fleet retreats from the first round: both ships together.
    const g = atSea(navy, GBR, ZONE.west, [
      ["bb", 1, 1],
      ["dd", 1, 1],
    ]);
    g.engage = ENGAGE_RULES.indexOf("avoid");
    const i = atSea(navy, ITA, ZONE.west, [["bb", 1, 1]]);
    void i;
    const [bb, dd] = g.ships;
    startNavalBattle(navy, ZONE.west, navy.sideOf(ITA), g.id, tick);
    stepNavalBattles(navy, tick);
    expect(battleShipsOf(navy, ZONE.west, 1)).toEqual([bb, dd]);
    // 34 knots against 22: 2 rounds; 22 against 22: 6.
    expect(navy.ships.escape[navy.ships.rowOf(dd)]).toBe(1);
    expect(navy.ships.escape[navy.ships.rowOf(bb)]).toBe(5);
    stepNavalBattles(navy, tick);
    expect(battleShipsOf(navy, ZONE.west, 1)).toEqual([bb]);
    for (let r = 3; r <= 5; r++) {
      stepNavalBattles(navy, tick);
      expect(battleShipsOf(navy, ZONE.west, 1)).toEqual([bb]);
    }
    stepNavalBattles(navy, tick);
    // Round 6: the battleship is away too, the battle over.
    expect(navy.battles.has(ZONE.west)).toBe(false);
    expect(g.ships).toEqual([bb, dd]);
    expect(navy.ships.escape[navy.ships.rowOf(bb)]).toBe(-1);
  });

  it("a ship at 0 HP is removed in the same round", async () => {
    const { navy, tick } = await seaWar();
    const g = atSea(navy, GBR, ZONE.west, [["bb", 1, 1]]);
    const i = atSea(navy, ITA, ZONE.west, [["dd", 1, 2]]);
    void g;
    const [doomed, other] = i.ships;
    const dr = navy.ships.rowOf(doomed);
    navy.ships.hp[dr] = 1;
    const name = [navy.ships.nameIdx[dr], navy.ships.nameOwner[dr]];
    startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), i.id, tick);
    navy.takeData();
    stepNavalBattles(navy, tick);
    const b = navy.battles.get(ZONE.west)!;
    expect(b.round).toBe(1);
    expect(navy.ships.rowOf(doomed)).toBe(-1);
    expect(i.ships).toEqual([other]);
    expect(battleShipsOf(navy, ZONE.west, 1)).toEqual([other]);
    expect(b.sunk[1][SHIP_CLASSES.indexOf("dd")]).toBe(1);
    // The screens' battle line lists this tick's sinking (Task 1's summary).
    const summary = navy.takeData()!.battles.find((x) => x.zone === ZONE.west)!;
    expect(summary.sunk).toEqual([[SHIP_CLASSES.indexOf("dd"), 1, ...name]]);
  });

  it("a beaten fleet goes home and borrows docks", async () => {
    const { runner, navy, tick } = await seaWar();
    // Britain's patrolling battleship starts at 45%; London's harbor zone
    // is the West Sea.
    const g = atSea(navy, GBR, ZONE.west, [["bb", 1, 1]]);
    g.mission = FLEET_MISSIONS.indexOf("patrol");
    g.missionSr = SR.approaches;
    const bb = g.ships[0];
    const max = navy.shipStatsOf(navy.ships.rowOf(bb)).hpMilli;
    navy.ships.hp[navy.ships.rowOf(bb)] = Math.floor((max * 45) / 100);
    const i = atSea(navy, ITA, ZONE.west, [["bb", 1, 1]]);
    startNavalBattle(navy, ZONE.west, navy.sideOf(ITA), g.id, tick);
    fightOut(navy, ZONE.west, tick);
    expect(hpOf(navy, bb)).toBeGreaterThan(0);
    expect(hpOf(navy, bb) * 2).toBeLessThan(max);
    // Below its 50% return threshold: home, docked, repairing.
    expect(g.docked).toBe(REGION.london);
    expect(FLEET_STATES[g.state]).toBe("repairing");
    // The winner stays at sea on its station, no wait.
    expect(i.docked).toBe(0);
    expect(FLEET_STATES[i.state]).toBe("on_station");
    // The country's day: London (level 6) repairs it with two dockyards
    // lent (lane E's lendDocks counts them in docksLent).
    const day = navy.day(runner.game.ticks());
    const hp0 = hpOf(navy, bb);
    dailyRepair(navy, GBR, day);
    const r = navy.ships.rowOf(bb);
    expect(navy.ships.docks[r]).toBe(2);
    expect(hpOf(navy, bb) - hp0).toBe(4_200);
  });

  it("a battle restored mid-way continues exactly", async () => {
    const { runner, navy, tick } = await seaWar();
    atSea(navy, GBR, ZONE.west, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    const i = atSea(navy, ITA, ZONE.west, [
      ["bb", 1, 1],
      ["dd", 1, 2],
    ]);
    atSea(navy, ITA, ZONE.west, [["ss", 1, 2]]);
    startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), i.id, tick);
    // The game's tick runs a round (spec §2.2-6 ⑤).
    step(runner, 3);
    expect(navy.battles.get(ZONE.west)!.round).toBe(3);
    const copy = await wwRestore(runner, HUMANS, SEA.map);
    const navyOf = (r: GameRunner) => r.game.worldWar()!.navy;
    for (let k = 0; k < 12; k++) {
      step(runner);
      step(copy);
      expect(JSON.stringify(navyOf(copy).snapshot())).toBe(
        JSON.stringify(navyOf(runner).snapshot()),
      );
      expect(gameHash(copy)).toBe(gameHash(runner));
    }
  }, 60_000);

  it("40 rounds end the battle", async () => {
    const { navy, tick } = await seaWar();
    // Two carriers with empty decks: 0.72 HP a round each, never 40% lost.
    const g = atSea(navy, GBR, ZONE.west, [["cv", 1, 1]]);
    const i = atSea(navy, ITA, ZONE.west, [["cv", 1, 1]]);
    startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), i.id, tick);
    let round = 0;
    for (let k = 0; k < 39; k++) {
      stepNavalBattles(navy, tick);
      round = navy.battles.get(ZONE.west)!.round;
    }
    expect(round).toBe(39);
    stepNavalBattles(navy, tick);
    expect(navy.battles.has(ZONE.west)).toBe(false);
    for (const f of [g, i]) {
      expect(f.ships).toHaveLength(1);
      expect(hpOf(navy, f.ships[0])).toBeGreaterThan(0);
      expect(FLEET_STATES[f.state]).not.toBe("battle");
    }
  });
});
