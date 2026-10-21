// P4 Task 10 (lane AI): the naval and air history beats (spec §17.6).
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { NAVAL_BEATS } from "@openfront/engine-lib/ww1936/NavalBeats";
import { shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { aiInvasionScore } from "@openfront/engine/ww1936/navy/AiInvasion";
import {
  AI_BEAT_FACTOR,
  aiNavalPlan,
  aiNavyStyle,
  aiSupPower,
  beatFactor,
  beatWindow,
  navalBeatRoll,
  navalSideSum,
} from "@openfront/engine/ww1936/navy/AiNavy";
import { REGION, SEA } from "./seaFixture";
import { pol, step, wwRunner } from "./util";

describe("the naval and air history beats (spec §17.6)", () => {
  test("10% of 10,000 fake beats are skipped, delay averages 10 ± 0.5", () => {
    let skipped = 0;
    let delay = 0;
    for (let i = 0; i < 10_000; i++) {
      const [, d, skip] = navalBeatRoll(12345, `fake_beat_${i}`);
      if (skip) skipped++;
      delay += d;
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(20);
    }
    expect(skipped).toBeGreaterThanOrEqual(900);
    expect(skipped).toBeLessThanOrEqual(1100);
    expect(Math.abs(delay / 10_000 - 10)).toBeLessThanOrEqual(0.5);
  });

  test("the game rolls its beats once, as navalBeatRoll does", async () => {
    const runner = await wwRunner({}, [], SEA.map);
    step(runner);
    const navy = runner.game.worldWar()!.navy;
    expect(navy.beatsRolled).toBe(true);
    const seed = pol(runner.game).seed;
    expect(navy.beats).toEqual(
      NAVAL_BEATS.map((b) => navalBeatRoll(seed, b.id)),
    );
  });

  test("a beat multiplies its target's score by 10 inside its window", () => {
    // A landing: from its day − preparation − 30 to its day + 120.
    const albania = NAVAL_BEATS.find((b) => b.id === "ita_albania")!;
    const at = dayOfDate(albania.from) + 5;
    const w = beatWindow(albania, 5, 60);
    expect(w).toEqual([at - 90, at + 120]);
    expect(beatFactor(w, at - 91)).toBe(1);
    expect(beatFactor(w, at - 90)).toBe(AI_BEAT_FACTOR);
    expect(beatFactor(w, at + 120)).toBe(10);
    expect(beatFactor(w, at + 121)).toBe(1);
    // A campaign: its days, moved by the delay; a port strike: 30 days either side.
    const bob = NAVAL_BEATS.find((b) => b.id === "deu_battle_of_britain")!;
    expect(beatWindow(bob, 3, 60)).toEqual([
      dayOfDate("1940-07-10") + 3,
      dayOfDate("1940-10-31") + 3,
    ]);
    const taranto = NAVAL_BEATS.find((b) => b.id === "gbr_taranto")!;
    const t = dayOfDate(taranto.from);
    expect(beatWindow(taranto, 0, 60)).toEqual([t - 30, t + 30]);
    // The landing's score ×10.
    const target = {
      target: REGION.rome,
      vp: 10,
      port: true,
      enemyCapital: false,
      islandBase: false,
      divisions: 1,
      routeKm: 2500,
    };
    expect(aiInvasionScore({ ...target, beat: true })).toBe(
      aiInvasionScore(target) * 10,
    );
    // A port strike's: the beat's port (2 capital ships, ×10 = 20) before
    // a bigger one off the beat (5).
    const cvFleet = (() => {
      const ships = [
        ...Array.from({ length: 3 }, () => "cv" as const),
        ...Array.from({ length: 9 }, () => "dd" as const),
      ].map((cls) => {
        const stats = shipStats(cls, 2, emptyStats(), new Set());
        return {
          cls: SHIP_CLASSES.indexOf(cls),
          gen: 2,
          stats,
          hpMilli: stats.hpMilli,
          orgMilli: stats.orgMilli,
        };
      });
      return {
        id: 1,
        counts: SHIP_CLASSES.map((c) => (c === "cv" ? 3 : c === "dd" ? 9 : 0)),
        supPower: aiSupPower(ships),
        sum: navalSideSum(ships),
        home: REGION.london,
        docked: 0,
        sr: 1002,
        state: "on_station" as const,
        mission: "patrol" as const,
        missionSr: 1002,
        engage: "always" as const,
        returnAtPct: 70,
        newShips: false,
        rangeKm: 10_000,
      };
    })();
    const region = (sr: number) => ({
      sr,
      km: 300,
      home: false,
      traffic: 0,
      lossMilli: 0,
      raiderSpotted: false,
      enemyTraffic: 0,
      enemyEscort: 0,
      enemySup: 0,
      enemySum: null,
      enemySpotted: false,
      invasion: false,
    });
    const orders = aiNavalPlan({
      smallID: 3,
      day: 0,
      atWar: true,
      fleets: [cvFleet],
      fleetCount: 1,
      regions: [region(1002), region(1003)],
      ports: [
        { port: REGION.kiev, sr: 1003, capitals: 5, beat: false },
        { port: REGION.rome, sr: 1002, capitals: 2, beat: true },
      ],
      style: aiNavyStyle("GBR"),
      seed: 0,
    });
    expect(orders).toContainEqual({
      kind: "fleet_port_strike",
      fleet: 1,
      port: REGION.rome,
    });
  });
});
