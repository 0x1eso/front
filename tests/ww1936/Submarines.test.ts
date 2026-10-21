// World War 1936 P4 (plan Task 4 Step 6): submarines in a naval battle
// (spec §9.5) on ww1936sea — a human Britain against a human Italy, the
// battle opened on an Italian destroyer so Italy's submarines start hidden.
import {
  ENGAGE_RULES,
  FLEET_STATES,
  ShipClass,
  WW_HIT_DEPTH_PM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { combineMods } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  posDamagePm,
  positioningPm,
  shotDamageMilli,
  visFactorPm,
} from "@openfront/engine-lib/ww1936/NavalRules";
import {
  battleShipsOf,
  startNavalBattle,
  stepNavalBattles,
} from "@openfront/engine/ww1936/navy/NavalBattles";
import type { Fleet, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { REGION, SEA, TAG_ID, ZONE } from "./seaFixture";
import { warAfterPrep, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const GBR_H = "HUMAN001";
const HUMANS = [
  { clientID: GBR_H, country: "GBR" as const },
  { clientID: "HUMAN002", country: "ITA" as const },
];
const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;
const PORT: Record<number, number> = {
  [GBR]: REGION.london,
  [ITA]: REGION.rome,
};

async function seaWar(): Promise<{ navy: WwNavy; tick: number }> {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  warAfterPrep(runner, GBR_H, "ITA");
  return { navy: runner.game.worldWar()!.navy, tick: runner.game.ticks() };
}

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

const hpOf = (navy: WwNavy, id: number) => navy.ships.hp[navy.ships.rowOf(id)];
const revealOf = (navy: WwNavy, id: number) =>
  navy.ships.reveal[navy.ships.rowOf(id)];

/** Britain's 8 destroyers engage an Italian destroyer; 2 Italian submarines are in the zone, hidden. */
async function hunt() {
  const { navy, tick } = await seaWar();
  const hunters = atSea(navy, GBR, [["dd", 1, 8]]);
  const decoy = atSea(navy, ITA, [["dd", 1, 1]]);
  const subs = atSea(navy, ITA, [["ss", 1, 2]]);
  startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), decoy.id, tick);
  expect(navy.battles.get(ZONE.west)!.fleets[1]).toEqual([decoy.id, subs.id]);
  return { navy, tick, hunters, decoy, subs };
}

describe("submarines (spec §9.5)", () => {
  it("a hidden submarine is not a target until it fires", async () => {
    const { navy, tick, hunters, subs } = await hunt();
    const full = subs.ships.map((id) => hpOf(navy, id));
    for (const id of subs.ships) expect(revealOf(navy, id)).toBe(0);
    // Round 1 (odd): no torpedoes; the destroyers' sonar: Σ ASW × 10 / visibility
    // (8 × 25 × 10 / 6 = 333‰ without sonar; Britain starts with sonar_1).
    const asw = navy.shipStatsOf(navy.ships.rowOf(hunters.ships[0])).subDetect;
    const vis = navy.shipStatsOf(navy.ships.rowOf(subs.ships[0])).vis;
    const perRound = Math.floor((8 * asw * 10) / vis);
    expect(perRound).toBeGreaterThanOrEqual(333);
    expect(perRound + perRound + 400).toBeGreaterThanOrEqual(1000);
    stepNavalBattles(navy, tick);
    expect(subs.ships.map((id) => hpOf(navy, id))).toEqual(full);
    for (const id of subs.ships) expect(revealOf(navy, id)).toBe(perRound);
    // Round 2: they fire (+400‰) and are seen, still untouched this round.
    stepNavalBattles(navy, tick);
    expect(subs.ships.map((id) => hpOf(navy, id))).toEqual(full);
    for (const id of subs.ships) expect(revealOf(navy, id)).toBe(1000);
    // Round 3: now they are targets.
    stepNavalBattles(navy, tick);
    const after = subs.ships.map((id) => hpOf(navy, id));
    expect(after.some((hp, k) => hp < full[k])).toBe(true);
  });

  it("after firing, only depth charges hit it", async () => {
    const { navy, tick, hunters, subs } = await hunt();
    stepNavalBattles(navy, tick);
    stepNavalBattles(navy, tick);
    // The decoy is gone by now: only the revealed submarines are left to shoot at.
    expect(battleShipsOf(navy, ZONE.west, 1)).toEqual(subs.ships);
    const before = subs.ships.map((id) => hpOf(navy, id));
    stepNavalBattles(navy, tick);
    const lost = subs.ships.reduce(
      (s, id, k) => s + before[k] - hpOf(navy, id),
      0,
    );
    // Every destroyer's depth charges once (share 1000‰), nothing else.
    const gbr = navy.econ.country(GBR)!.stats;
    const ita = navy.econ.country(ITA)!.stats;
    const mods =
      combineMods([gbr.navyAttackPct * 100], [-ita.navyDefensePct * 100]) -
      10_000;
    const dd = navy.shipStatsOf(navy.ships.rowOf(hunters.ships[0]));
    const ss = navy.shipStatsOf(navy.ships.rowOf(subs.ships[0]));
    const pos = positioningPm(8, 2, 0, gbr.positioningPct);
    const one = shotDamageMilli(
      dd.depth,
      mods,
      WW_HIT_DEPTH_PM,
      visFactorPm(ss.vis, true),
      posDamagePm(pos),
      1000,
      1000,
    );
    expect(one).toBeGreaterThan(0);
    expect(lost).toBe(8 * one);
  });

  it("an avoiding submarine slips away in 2 rounds", async () => {
    const { navy, tick } = await seaWar();
    atSea(navy, GBR, [["dd", 1, 4]]);
    const decoy = atSea(navy, ITA, [["dd", 1, 1]]);
    const sub = atSea(navy, ITA, [["ss", 1, 1]]);
    sub.engage = ENGAGE_RULES.indexOf("avoid");
    const ss = sub.ships[0];
    const full = hpOf(navy, ss);
    startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), decoy.id, tick);
    stepNavalBattles(navy, tick);
    expect(battleShipsOf(navy, ZONE.west, 1)).toContain(ss);
    expect(navy.ships.escape[navy.ships.rowOf(ss)]).toBe(1);
    stepNavalBattles(navy, tick);
    // Away after round 2, never seen, never hit.
    expect(battleShipsOf(navy, ZONE.west, 1)).not.toContain(ss);
    expect(navy.battles.get(ZONE.west)?.fleets[1] ?? []).not.toContain(sub.id);
    expect(hpOf(navy, ss)).toBe(full);
    expect(revealOf(navy, ss)).toBe(0);
  });
});
