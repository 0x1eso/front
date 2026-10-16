import { UnitType } from "@openfront/engine-api/game/GameTypes";
import type {
  InterceptorData,
  SatelliteData,
  StrategicData,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { describe, expect, it } from "vitest";
import {
  borderPulse,
  formatClock,
  hasSatelliteUp,
  isLastSeconds,
  preparingSilos,
  PULSE_HZ_END,
  PULSE_HZ_START,
  RETICLE_END_FRACTION,
  reticleMaxRadius,
  reticleRadius,
  StrategicFxTracker,
  type FxPlayer,
} from "../../../../../src/client/render/frame/derive/StrategicFx";

function data(satellite: SatelliteData): StrategicData {
  return {
    stock: {
      [UnitType.AtomBomb]: 0,
      [UnitType.HydrogenBomb]: 0,
      [UnitType.MIRV]: 0,
    },
    jobs: [],
    satellite,
  };
}

function player(id: number, satellite: SatelliteData, alive = true): FxPlayer {
  return {
    smallID: () => id,
    isAlive: () => alive,
    strategicData: () => data(satellite),
  };
}

describe("reticle", () => {
  it("shrinks linearly from its full size to a fraction over the minute", () => {
    expect(reticleRadius(600, 600, 100)).toBe(100);
    expect(reticleRadius(0, 600, 100)).toBeCloseTo(100 * RETICLE_END_FRACTION);
    const mid = reticleRadius(300, 600, 100);
    expect(mid).toBeLessThan(100);
    expect(mid).toBeGreaterThan(100 * RETICLE_END_FRACTION);
    // Monotonic.
    expect(reticleRadius(200, 600, 100)).toBeLessThan(
      reticleRadius(400, 600, 100),
    );
  });

  it("clamps out-of-range times and scales with territory", () => {
    expect(reticleRadius(9999, 600, 50)).toBe(50);
    expect(reticleRadius(-5, 600, 50)).toBeCloseTo(50 * RETICLE_END_FRACTION);
    expect(reticleMaxRadius(0)).toBe(18);
    expect(reticleMaxRadius(1e9)).toBe(120);
    expect(reticleMaxRadius(5000)).toBeGreaterThan(reticleMaxRadius(500));
  });
});

describe("last seconds", () => {
  it("is the band's red state for the final 10 s only", () => {
    expect(isLastSeconds(101)).toBe(false);
    expect(isLastSeconds(100)).toBe(true);
    expect(isLastSeconds(1)).toBe(true);
    expect(isLastSeconds(0)).toBe(false);
  });
});

describe("border pulse", () => {
  const cycles = (from: number, to: number) => {
    let n = 0;
    let prev = borderPulse(from, 600);
    let rising = false;
    for (let left = from - 1; left >= to; left--) {
      const v = borderPulse(left, 600);
      if (rising && v < prev) n++;
      rising = v > prev;
      prev = v;
    }
    return n;
  };

  it("stays within 0..1", () => {
    for (let left = 0; left <= 600; left += 7) {
      const v = borderPulse(left, 600);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("beats faster as time runs out", () => {
    expect(PULSE_HZ_END).toBeGreaterThan(PULSE_HZ_START);
    // First 10 s vs the last 10 s of the minute.
    expect(cycles(600, 500)).toBeLessThan(cycles(100, 0));
  });
});

describe("clock text", () => {
  it("formats m:ss, rounding up", () => {
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(0.2)).toBe("0:01");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("preparing silo selection", () => {
  it("lists alive players' preparing silos with progress and time left", () => {
    const players = [
      player(1, {
        phase: "preparing",
        siloId: 7,
        startTick: 0,
        readyTick: 900,
      }),
      player(2, { phase: "orbit" }),
      player(3, { phase: "none" }),
      player(
        4,
        { phase: "preparing", siloId: 8, startTick: 0, readyTick: 900 },
        false,
      ),
      player(5, {
        phase: "preparing",
        siloId: 9,
        startTick: 0,
        readyTick: 900,
      }),
    ];
    const out = preparingSilos(players, 450, (id) =>
      id === 9 ? null : id * 10,
    );
    expect(out).toEqual([
      { siloId: 7, ownerID: 1, tile: 70, progress: 0.5, secondsLeft: 45 },
    ]);
  });
});

describe("leaderboard icon", () => {
  it("is for a satellite in orbit or counting down, not preparing or none", () => {
    expect(hasSatelliteUp(data({ phase: "orbit" }))).toBe(true);
    expect(
      hasSatelliteUp(
        data({ phase: "targeted", target: 2, strikeTick: 9, interceptors: [] }),
      ),
    ).toBe(true);
    expect(
      hasSatelliteUp(
        data({ phase: "preparing", siloId: 1, startTick: 0, readyTick: 9 }),
      ),
    ).toBe(false);
    expect(hasSatelliteUp(data({ phase: "none" }))).toBe(false);
    expect(hasSatelliteUp(null)).toBe(false);
  });
});

describe("StrategicFxTracker", () => {
  const siloTile = (id: number) => id * 100;
  const shot = (resolveTick: number, from = 55): InterceptorData => ({
    by: 3,
    type: UnitType.HydrogenBomb,
    resolveTick,
    from,
  });
  const targeted = (
    strikeTick: number,
    interceptors: InterceptorData[] = [],
  ): SatelliteData => ({
    phase: "targeted",
    target: 2,
    strikeTick,
    interceptors,
  });

  it("is silent on its first look at a game in progress", () => {
    const t = new StrategicFxTracker();
    const ev = t.update(
      [player(1, targeted(900, [shot(500)]))],
      400,
      9,
      siloTile,
    );
    expect(ev.interceptStreaks).toEqual([]);
    expect(ev.interceptResults).toEqual([]);
  });

  it("reports a launch from the preparing silo's tile when it reaches orbit", () => {
    const t = new StrategicFxTracker();
    const prep: SatelliteData = {
      phase: "preparing",
      siloId: 7,
      startTick: 0,
      readyTick: 900,
    };
    t.update([player(1, prep)], 100, 9, siloTile);
    t.update([player(1, prep)], 101, 9, siloTile);
    const ev = t.update([player(1, { phase: "orbit" })], 900, 9, () => null);
    expect(ev.launches).toEqual([700]);
    // Not again.
    expect(
      t.update([player(1, { phase: "orbit" })], 901, 9, siloTile).launches,
    ).toEqual([]);
  });

  it("a failed preparation is not a launch", () => {
    const t = new StrategicFxTracker();
    const prep: SatelliteData = {
      phase: "preparing",
      siloId: 7,
      startTick: 0,
      readyTick: 900,
    };
    t.update([player(1, prep)], 100, 9, siloTile);
    expect(
      t.update([player(1, { phase: "none" })], 101, 9, siloTile).launches,
    ).toEqual([]);
  });

  it("draws a streak for each newly fired interceptor that has a silo, once", () => {
    const t = new StrategicFxTracker();
    t.update([player(1, targeted(900))], 400, 9, siloTile);
    const a = shot(430, 55);
    const noFrom: InterceptorData = { ...shot(431), from: undefined };
    let ev = t.update(
      [player(1, targeted(900, [a, noFrom]))],
      401,
      9,
      siloTile,
    );
    expect(ev.interceptStreaks).toEqual([55]);
    ev = t.update([player(1, targeted(900, [a, noFrom]))], 402, 9, siloTile);
    expect(ev.interceptStreaks).toEqual([]);
  });

  it("an interceptor that vanishes while the satellite still counts down missed", () => {
    const t = new StrategicFxTracker();
    t.update([player(1, targeted(900, [shot(430)]))], 428, 9, siloTile);
    const ev = t.update([player(1, targeted(900))], 431, 9, siloTile);
    expect(ev.interceptResults).toEqual([false]);
  });

  it("the satellite leaving the countdown early means it was shot down", () => {
    const t = new StrategicFxTracker();
    t.update(
      [player(1, targeted(900, [shot(430), shot(431, 56)]))],
      428,
      9,
      siloTile,
    );
    const ev = t.update([player(1, { phase: "none" })], 431, 9, siloTile);
    expect(ev.interceptResults).toEqual([true]);
  });

  it("does not need a 'spent' phase: none after the shot-down also reads as a hit", () => {
    const t = new StrategicFxTracker();
    t.update([player(1, targeted(900, [shot(430)]))], 429, 9, siloTile);
    expect(
      t.update([player(1, { phase: "orbit" })], 430, 9, siloTile)
        .interceptResults,
    ).toEqual([true]);
  });

  it("an interceptor judged as the strike lands is a miss", () => {
    const t = new StrategicFxTracker();
    t.update([player(1, targeted(900, [shot(900)]))], 899, 9, siloTile);
    const ev = t.update([player(1, { phase: "none" })], 900, 9, siloTile, [
      { attackerID: 1, targetID: 2, wave: 0 },
    ]);
    expect(ev.interceptResults).toEqual([false]);
  });

  it("beeps once per second in the last 10 s, for the target with the warning flag", () => {
    const t = new StrategicFxTracker();
    const sat = targeted(1000);
    const beeps: boolean[][] = [];
    for (let now = 880; now <= 1000; now++) {
      const ev = t.update([player(1, sat)], now, 2, siloTile);
      if (ev.beeps.length > 0) beeps.push([...ev.beeps]);
    }
    // seconds left 10..1 -> ten beeps, all for me (I am smallID 2, the target).
    expect(beeps).toHaveLength(10);
    expect(beeps.every((b) => b.length === 1 && b[0] === true)).toBe(true);

    const other = new StrategicFxTracker();
    const ev = other.update([player(1, sat)], 950, 5, siloTile);
    expect(ev.beeps).toEqual([false]);
  });

  it("handles strike waves: the first starts it, later ones only count", () => {
    const t = new StrategicFxTracker();
    let ev = t.update([], 10, 2, siloTile, [
      { attackerID: 1, targetID: 2, wave: 0 },
    ]);
    expect(ev.strikeStarts).toEqual([true]);
    expect(ev.laterWaves).toBe(0);
    ev = t.update([], 11, 3, siloTile, [
      { attackerID: 1, targetID: 2, wave: 1 },
      { attackerID: 1, targetID: 2, wave: 2 },
    ]);
    expect(ev.strikeStarts).toEqual([]);
    expect(ev.laterWaves).toBe(2);
    // A one-shot strike (no wave field) is a first wave; not mine -> false.
    ev = t.update([], 12, 3, siloTile, [{ attackerID: 1, targetID: 2 }]);
    expect(ev.strikeStarts).toEqual([false]);
  });

  it("forgets a player who died", () => {
    const t = new StrategicFxTracker();
    t.update([player(1, targeted(900, [shot(430)]))], 428, 9, siloTile);
    t.update([player(1, targeted(900, [shot(430)]), false)], 429, 9, siloTile);
    const ev = t.update([player(1, targeted(900))], 431, 9, siloTile);
    expect(ev.interceptResults).toEqual([]);
  });
});
