// ww177 P4 (lane I4a): Joseon's court, the king's flight, the righteous
// armies and Ming's meter, from fixed states on the imjinmini map
// (1 Hanseong, 2 Chungju (hills), 4 Daegu (Japan's, next to Ming),
// 5 Pyongyang, 6-7 Ming).
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { IDEO_COM, IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  courtCohesionStep,
  courtRival,
  flightResult,
  LEADER_JOINED,
  LEADER_RAIDING,
  mingDailyDelta,
  RIGHTEOUS_LEADERS,
  riseChancePct,
  SEAT_ABROAD,
  SEAT_BORDER,
  SEAT_NORTH,
} from "@openfront/engine-lib/imjin/CourtRules";
import {
  IMJIN_FLAGS,
  IMJIN_GFLAGS,
  pickFlag,
} from "@openfront/engine-lib/imjin/CourtScenes";
import { ImjinJoseonMing } from "@openfront/engine/imjin/JoseonMing";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { describe, expect, test } from "vitest";
import { byTag, HUMAN, step, takeRegion, wwRunner } from "../ww1936/util";

const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};

/** A game at war (Japan on Joseon) right after the preparation minute. */
async function atWar() {
  const r = await wwRunner(CONFIG, [{ clientID: HUMAN }], "imjinmini");
  step(r, WW_PREP_TICKS + 2);
  const g = r.game;
  const ww = g.worldWar()!;
  const ids = {
    jos: byTag(g, "JOS").smallID(),
    jpn: byTag(g, "JPN").smallID(),
    min: byTag(g, "MIN").smallID(),
  };
  ww.setWar(ids.jpn, ids.jos, g.ticks());
  return { r, g, ww, jm: ww.imjinJm!, ...ids };
}

function pick(ww: WorldWar, jos: number, f: string): void {
  ww.politics.country(jos)!.flags.set(f, [0, -1]);
}

function divisionsOf(ww: WorldWar, id: number): number {
  const t = ww.land.divisions;
  let n = 0;
  for (let r = 0; r < t.rows; r++) if (t.id[r] !== 0 && t.owner[r] === id) n++;
  return n;
}

describe("Imjin court rules", () => {
  test("cohesion, rivals, flight, risings and Ming's day are integer rules", () => {
    expect(courtCohesionStep([5000, 2000, 1500, 1500], IDEO_DEM, 5000)).toBe(
      100,
    );
    expect(courtCohesionStep([3500, 3200, 1800, 1500], IDEO_DEM, 5000)).toBe(
      -100,
    );
    expect(courtRival([3000, 4000, 1500, 1500], IDEO_DEM)).toBe(IDEO_COM);
    expect(courtRival([3500, 4000, 1000, 1500], IDEO_DEM)).toBe(-1);
    expect(flightResult(0, "split")).toMatchObject({ seat: 1, divided: true });
    expect(flightResult(2, "cross").seat).toBe(SEAT_ABROAD);
    expect(riseChancePct(1999, true, true)).toBe(0);
    expect(riseChancePct(5000, false, false)).toBe(4);
    expect(riseChancePct(5000, true, true)).toBe(7);
    const base = {
      war: true,
      nearHops: 99,
      seat: 0,
      suspicionBp: 0,
      otherFront: false,
      intervened: false,
      divisionsAbroad: 0,
    };
    expect(mingDailyDelta(base)).toBe(10);
    expect(mingDailyDelta({ ...base, nearHops: 1 })).toBe(130);
    expect(
      mingDailyDelta({ ...base, suspicionBp: 2000, otherFront: true }),
    ).toBe(-15);
    expect(mingDailyDelta({ ...base, war: false })).toBe(-5);
  });
});

describe("Imjin: Joseon and Ming", () => {
  test("the 1590 court: the Westerners rule, no elections", async () => {
    const r = await wwRunner(CONFIG, [{ clientID: HUMAN }], "imjinmini");
    const ww = r.game.worldWar()!;
    const c = ww.politics.country(byTag(r.game, "JOS").smallID())!;
    expect(c.ruling).toBe(IDEO_DEM);
    expect(c.pop).toEqual([4000, 2500, 2000, 1500]);
    expect(c.stabBaseBp).toBe(5500);
    expect(ww.imjinJm!.meter).toBe(1000);
  });

  test("the king's flight: the threat opens the scene, the pick moves the court", async () => {
    const { g, ww, jm, jos } = await atWar();
    const c = ww.politics.country(jos)!;
    const stab = c.stabBaseBp;
    jm.day(10, g.ticks());
    // Busan (Japan's) borders Hanseong: the scene is on the king's desk.
    expect(c.firedOnce.has("imjin_flight_capital")).toBe(true);
    expect(jm.seat).toBe(0);
    pick(ww, jos, pickFlag("imjin_flight_capital", "c"));
    jm.day(11, g.ticks());
    expect(jm.seat).toBe(SEAT_NORTH);
    expect(jm.seatRegion).toBe(5);
    expect(c.flags.has(IMJIN_FLAGS.divided)).toBe(true);
    expect(c.flags.has(pickFlag("imjin_flight_capital", "c"))).toBe(false);
    expect(c.stabBaseBp).toBe(stab - 1500);
    // At the border, crossing the Yalu puts the court on Ming soil.
    jm.seat = SEAT_BORDER;
    const meter = jm.meter;
    pick(ww, jos, pickFlag("imjin_flight_border", "b"));
    jm.day(12, g.ticks());
    expect(jm.seat).toBe(SEAT_ABROAD);
    expect(jm.meter).toBeGreaterThanOrEqual(meter + 2500 - 200);
  });

  test("a held seat that falls: the court escapes north in disorder", async () => {
    const { g, ww, jm, jos } = await atWar();
    pick(ww, jos, pickFlag("imjin_flight_capital", "b"));
    jm.day(10, g.ticks());
    expect(jm.holding).toBe(true);
    const ws = ww.politics.country(jos)!.wsBaseBp;
    takeRegion(g, 1, "JPN");
    jm.day(11, g.ticks());
    expect(jm.seat).toBe(SEAT_NORTH);
    expect(jm.holding).toBe(false);
    expect(ww.politics.country(jos)!.wsBaseBp).toBe(ws - 1500);
  });

  test("a righteous army rises from resistance, raids, obeys and joins the army", async () => {
    const { g, ww, jm, jos } = await atWar();
    takeRegion(g, 2, "JPN");
    const joHeon = RIGHTEOUS_LEADERS.findIndex((l) => l.id === "jo_heon");
    let day = 20;
    for (; day < 400 && jm.leaders[joHeon] !== LEADER_RAIDING; day++) {
      ww.endgame.resBp[2] = 9000;
      jm.day(day, g.ticks());
    }
    expect(jm.leaders[joHeon]).toBe(LEADER_RAIDING);
    expect(jm.bandRegion[joHeon]).toBe(2);
    const c = ww.politics.country(jos)!;
    expect(c.flags.has(IMJIN_FLAGS.bandsOut)).toBe(true);
    // Chungju is hill country: the occupier keeps 70% of its supply.
    expect(jm.raidPm(2)).toBe(700);
    c.stabBp = 6000;
    pick(ww, jos, pickFlag("bands", "command"));
    jm.day(++day, g.ticks());
    expect(jm.commanded).toBe(true);
    expect(jm.raidPm(2)).toBe(600);
    // Chungju free again: the band joins the army there.
    const before = divisionsOf(ww, jos);
    takeRegion(g, 2, "JOS");
    jm.day(day + 1, g.ticks());
    expect(jm.leaders[joHeon]).toBe(LEADER_JOINED);
    expect(divisionsOf(ww, jos)).toBe(before + 1);
    expect(c.flags.has(IMJIN_FLAGS.bandsOut)).toBe(false);
    expect(jm.raidPm(2)).toBe(1000);
  });

  test("a weak court's command is refused, and costs it", async () => {
    const { g, ww, jm, jos } = await atWar();
    takeRegion(g, 2, "JPN");
    const joHeon = RIGHTEOUS_LEADERS.findIndex((l) => l.id === "jo_heon");
    jm.leaders[joHeon] = LEADER_RAIDING;
    jm.bandRegion[joHeon] = 2;
    const c = ww.politics.country(jos)!;
    // Cohesion is yesterday's stability (the 1936 day computes it).
    c.stabBaseBp = 2000;
    c.stabBp = 2000;
    pick(ww, jos, pickFlag("bands", "command"));
    jm.day(10, g.ticks());
    expect(jm.commanded).toBe(false);
    expect(c.stabBaseBp).toBe(1800);
  });

  test("Ming's meter: Japan near Liaodong fills it; vanguard, then relief", async () => {
    const { g, ww, jm, jos, jpn, min } = await atWar();
    expect(jm.japanHopsToMing()).toBe(1);
    const before = divisionsOf(ww, min);
    jm.meter = 5990;
    jm.suspicion = 0;
    jm.day(10, g.ticks());
    expect(jm.mingStage).toBe(1);
    expect(ww.isAtWar(min, jpn)).toBe(true);
    expect(ww.sameFaction(min, jos)).toBe(true);
    expect(ww.politics.gflags.has(IMJIN_GFLAGS.mingIn)).toBe(true);
    expect(divisionsOf(ww, min)).toBe(before + 2);
    jm.meter = 9990;
    jm.day(11, g.ticks());
    expect(jm.mingStage).toBe(2);
    expect(ww.politics.gflags.has(IMJIN_GFLAGS.mingRelief)).toBe(true);
    expect(divisionsOf(ww, min)).toBe(before + 8);
    // An envoy raises the meter and eases Ming's suspicion.
    jm.meter = 3000;
    jm.suspicion = 1000;
    pick(ww, jos, pickFlag("envoy", "ming"));
    jm.day(12, g.ticks());
    expect(jm.suspicion).toBeLessThan(1000 - 400 + 1);
    expect(jm.meter).toBeGreaterThan(3000 + 900 - 100);
  });

  test("the snapshot keeps the court's state", async () => {
    const { g, ww, jm } = await atWar();
    takeRegion(g, 2, "JPN");
    jm.meter = 4321;
    jm.day(10, g.ticks());
    const copy = new ImjinJoseonMing(g, ww, "y1590");
    copy.restoreState(jm.snapshot());
    expect(copy.hash()).toBe(jm.hash());
    expect(copy.snapshot()).toEqual(jm.snapshot());
  });
});
