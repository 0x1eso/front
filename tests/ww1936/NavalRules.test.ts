// World War 1936 P4 (plan Task 1 Step 25): naval battle, spotting and
// supremacy numbers (spec §8.4, §8.5, §9.2–§9.10).
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  carrierScreenPm,
  fleetPower,
  fleetSupPowerMilli,
  fleetVis,
  orgDamageMilli,
  pierceFactorPm,
  posDamagePm,
  positioningPm,
  predictNaval,
  retreatRounds,
  screenPm,
  searchPoints,
  shotDamageMilli,
  sideRetreats,
  spotGainPm,
  supremacyPm,
  tickMilliKm,
  visFactorPm,
} from "@openfront/engine-lib/ww1936/NavalRules";
import { shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";

const Z = emptyStats();

describe("naval rules", () => {
  it("positioning", () => {
    expect(positioningPm(1, 1, 0, 0)).toBe(1000);
    expect(positioningPm(3, 1, 0, 0)).toBe(880);
    expect(positioningPm(10, 2, 0, 0)).toBe(820);
    expect(positioningPm(100, 1, 0, 0)).toBe(300);
    expect(posDamagePm(1000)).toBe(1000);
    expect(posDamagePm(300)).toBe(650);
  });

  it("screening 3:1 and carriers 1:1", () => {
    expect(screenPm(3, 1, 0, 1000, 0)).toBe(1000);
    expect(screenPm(2, 1, 0, 880, 0)).toBe(586);
    expect(screenPm(0, 4, 0, 1000, 0)).toBe(0);
    expect(screenPm(12, 4, 0, 1000, 0)).toBe(1000);
    expect(screenPm(0, 0, 0, 1000, 0)).toBe(1000);
    expect(screenPm(2, 1, 0, 1000, 500)).toBe(1000);
    expect(carrierScreenPm(1, 1, 1000)).toBe(1000);
    expect(carrierScreenPm(0, 2, 1000)).toBe(0);
    expect(carrierScreenPm(1, 2, 1000)).toBe(500);
  });

  it("pierce thresholds", () => {
    expect(pierceFactorPm(8000, 5000)).toBe(1000);
    expect(pierceFactorPm(4000, 5000)).toBe(800);
    expect(pierceFactorPm(3000, 5000)).toBe(500);
    expect(pierceFactorPm(1500, 5000)).toBe(250);
    expect(pierceFactorPm(1000, 5000)).toBe(100);
    expect(pierceFactorPm(500, 0)).toBe(1000);
    expect(visFactorPm(30, false)).toBe(1500);
    expect(visFactorPm(20, false)).toBe(1000);
    expect(visFactorPm(5, false)).toBe(300);
    expect(visFactorPm(6, true)).toBe(600);
    expect(visFactorPm(12, true)).toBe(1000);
  });

  it("damage", () => {
    // A 1922 battleship's heavy guns on a battleship.
    expect(shotDamageMilli(5000, 0, 100, 1500, 1000, 1000, 1000)).toBe(7500);
    // Light guns.
    expect(shotDamageMilli(1000, 0, 120, 1500, 1000, 250, 1000)).toBe(450);
    // Graf Spee's heavy guns on Exeter.
    expect(shotDamageMilli(2500, 0, 100, 1000, 1000, 1000, 700)).toBe(1750);
    expect(shotDamageMilli(5000, -9000, 100, 1500, 1000, 1000, 1000)).toBe(750);
    expect(orgDamageMilli(7500, 40_000, 150_000)).toBe(3000);
  });

  it("the 1922 battleship duel breaks off at round 8 (spec §9.10)", () => {
    let hp = 150_000;
    let round = 0;
    for (;;) {
      round++;
      hp -= 7950;
      if (sideRetreats(round, 150_000, hp, 40_000, 40_000, 1000, false)) break;
    }
    expect(round).toBe(8);
    expect(hp).toBeGreaterThan(0);
  });

  it("retreat", () => {
    expect(retreatRounds(2200, 3400, false)).toBe(8);
    expect(retreatRounds(3400, 2200, false)).toBe(2);
    expect(retreatRounds(2800, 2800, false)).toBe(6);
    expect(retreatRounds(0, 0, true)).toBe(2);
    expect(sideRetreats(3, 150_000, 10_000, 40_000, 0, 0, false)).toBe(false);
    expect(sideRetreats(4, 150_000, 89_000, 40_000, 40_000, 1000, false)).toBe(
      true,
    );
    expect(sideRetreats(4, 150_000, 91_000, 40_000, 40_000, 1000, false)).toBe(
      false,
    );
    expect(sideRetreats(4, 150_000, 150_000, 40_000, 12_000, 1000, false)).toBe(
      true,
    );
    expect(sideRetreats(10, 150_000, 150_000, 40_000, 40_000, 499, false)).toBe(
      true,
    );
    expect(sideRetreats(0, 150_000, 150_000, 40_000, 40_000, 1000, true)).toBe(
      true,
    );
  });

  it("spotting and supremacy (spec §8.4–§8.5)", () => {
    expect(spotGainPm(160, 40, 15)).toBe(426);
    expect(spotGainPm(320, 70, 212)).toBe(105);
    expect(fleetVis(30, 6, false)).toBe(40);
    expect(fleetVis(6, 10, true)).toBe(15);
    expect(searchPoints(160, 1000, 0)).toBe(160);
    expect(searchPoints(160, 300, 20)).toBe(57);
    expect(supremacyPm(0, 0)).toBe(0);
    expect(supremacyPm(100, 0)).toBe(1000);
    expect(supremacyPm(21, 79)).toBe(210);
    const h = 150_000;
    const one = [{ supWeight: 10, genHpPct: 100, hpMilli: h, maxHpMilli: h }];
    expect(fleetSupPowerMilli(one, 1000, 1000)).toBe(10_000);
    const half = [
      { supWeight: 10, genHpPct: 100, hpMilli: h / 2, maxHpMilli: h },
    ];
    expect(fleetSupPowerMilli(half, 500, 1000)).toBe(2500);
  });

  it("movement", () => {
    expect(tickMilliKm(2500)).toBe(84_682);
    expect(tickMilliKm(1200)).toBe(40_647);
  });

  it("fleet power", () => {
    const s = shipStats("bb", 1, Z, new Set());
    expect(fleetPower([{ stats: s, hpMilli: s.hpMilli }])).toBe(21_000);
    expect(fleetPower([{ stats: s, hpMilli: s.hpMilli / 2 }])).toBe(10_500);
  });

  it("the battle preview: one battleship each, equal and broken off", () => {
    const s = shipStats("bb", 1, Z, new Set());
    const side = {
      count: SHIP_CLASSES.map((c) => (c === "bb" ? 1 : 0)),
      hpMilli: s.hpMilli,
      maxHpMilli: s.hpMilli,
      orgMilli: s.orgMilli,
      light: s.light,
      heavy: s.heavy,
      torpedo: 0,
      depth: 0,
      carrierAttack: 0,
      armor: s.armor,
      lightPierce: s.lightPierce,
      heavyPierce: s.heavyPierce,
      vis: s.vis,
      minSpeed: s.speedCentiKn,
      maxSpeed: s.speedCentiKn,
      maneuver: 0,
      modsBp: 0,
    };
    const ctx = {
      attackerPosPct: 0,
      defenderPosPct: 0,
      attackerScreenBonusPm: 0,
      defenderScreenBonusPm: 0,
      attackerCarrierEvery: 3,
      defenderCarrierEvery: 3,
    };
    const p = predictNaval(side, side, ctx);
    expect(p.ratioPm).toBe(1000);
    expect(p.rounds).toBeGreaterThanOrEqual(8);
    expect(p.rounds).toBeLessThanOrEqual(16);
    expect(p.sunkA).toBe(p.sunkB);
    expect(predictNaval(side, side, ctx)).toEqual(p);
  });
});
