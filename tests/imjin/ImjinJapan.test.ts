// ww177 I4b: Japan's politics and the truce, with fixed states: the pure
// rules, then the engine's run-up, the war's start, Hideyoshi's death and
// the forged truce from talks to the second invasion.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  aiStrikePlan,
  BAD_NEWS_BLOW,
  constitutionOf,
  corpsOfArmy,
  corpsPlanSpeedPct,
  corpsRecoveryPct,
  dailyHealthLoss,
  DEATH_LOYALTY,
  EARLY_NOTICE_DAYS,
  EARLY_WARNING,
  forgeChancePct,
  GREAT_DAIMYO,
  healthBand,
  isEarlyStrike,
  japanStats,
  warnedOf,
  waveOf,
} from "@openfront/engine-lib/imjin/Japan";
import {
  JP_FLAG,
  JP_MARK,
  JP_SPIRIT,
} from "@openfront/engine-lib/imjin/JapanContent";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  ImjinJapanStateSchema,
  TRUCE_PHASE,
  type ImjinJapanState,
} from "@openfront/engine/imjin/japan/ImjinJapan";
import { declareWarBlock } from "@openfront/engine/ww1936/Diplomacy";
import { describe, expect, test } from "vitest";
import { byTag, HUMAN, step, stepTo, wwRunner } from "../ww1936/util";

const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};

describe("the pure rules", () => {
  test("corps, loyalty and the go-between", () => {
    expect(corpsOfArmy(1)).toBe(0);
    expect(corpsOfArmy(GREAT_DAIMYO.length + 2)).toBe(1);
    expect(corpsPlanSpeedPct(300)).toBe(-20);
    expect(corpsPlanSpeedPct(600)).toBe(0);
    expect(corpsPlanSpeedPct(900)).toBe(10);
    expect(corpsRecoveryPct(100)).toBe(-20);
    expect(forgeChancePct(200)).toBe(100);
    expect(forgeChancePct(500)).toBe(50);
    expect(forgeChancePct(800)).toBe(0);
    expect(japanStats(400, 500, true)).toEqual({
      trainPct: -25,
      recruitablePct: -5,
      stabilityWeeklyBp: -100,
    });
    expect(japanStats(800, 0, false).trainPct).toBe(0);
  });

  test("health, the waves and the AI's plan", () => {
    expect(healthBand(100_000, 100_000)).toBe(0);
    expect(healthBand(40_000, 100_000)).toBe(1);
    expect(healthBand(20_000, 100_000)).toBe(2);
    expect(healthBand(0, 100_000)).toBe(3);
    expect([waveOf(600), waveOf(800), waveOf(1000)]).toEqual([0, 1, 2]);
    expect([warnedOf(0), warnedOf(500), warnedOf(900)]).toEqual([0, 1, 2]);
    for (const r of [0, 12345, 0xffffffff]) {
      const p = aiStrikePlan(r, false);
      expect(p.bar).toBeGreaterThanOrEqual(650);
      expect(p.bar).toBeLessThanOrEqual(1000);
      expect(p.patience).toBeLessThanOrEqual(150);
    }
    expect(aiStrikePlan(7, true).bar).toBe(1000);
  });

  test("Hideyoshi's death falls by seed and state, mostly from 1597", () => {
    // A 1590 game (day 0 = 1590-04-01): war on Joseon from May 1592, Ming
    // from autumn, a defeat every six months. The day health runs out:
    const R = idHash("imjin_jp_health");
    const deathDay = (seed: number, blowEvery: number) => {
      let h = constitutionOf(wwRoll(seed, R, 1), wwRoll(seed, R, 2));
      for (let d = 0; d < 4000; d++) {
        const wars = (d >= 760 ? 1 : 0) + (d >= 900 ? 1 : 0);
        const years = d >= 760 ? Math.floor((d - 760) / 365) : 0;
        h -= dailyHealthLoss(d, wars, years);
        if (d > 760 && (d - 760) % blowEvery === 0) h -= BAD_NEWS_BLOW;
        if (h <= 0) return d;
      }
      return 4000;
    };
    const days = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => deathDay(s, 180));
    const from1597 = 2467; // 1597-01-01
    expect(days.filter((d) => d >= from1597).length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...days) - Math.min(...days)).toBeGreaterThan(365);
    // A war of a defeat every two months brings every death forward.
    const hard = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => deathDay(s, 60));
    hard.forEach((d, i) => expect(d).toBeLessThan(days[i]));
    expect(Math.max(...hard)).toBeLessThan(from1597);
  });
});

async function game(country: "JOS" | "JPN") {
  const r = await wwRunner(CONFIG, [{ clientID: HUMAN, country }], "imjinmini");
  const g = r.game;
  const ww = g.worldWar()!;
  const jp = ww.japan!;
  // The test writes the state it needs (fixed states).
  const s = jp.state() as ImjinJapanState;
  const jpn = byTag(g, "JPN");
  const jos = byTag(g, "JOS");
  const min = byTag(g, "MIN");
  const nextDay = () => {
    const d = ww.day(g.ticks());
    stepTo(r, dayStartTick(d + 1, ww.prepEndTick()) + 1);
  };
  const setFlag = (f: string) =>
    ww.politics.country(jpn.smallID())!.flags.set(f, [ww.day(g.ticks()), -1]);
  return { r, g, ww, jp, s, jpn, jos, min, nextDay, setFlag };
}

describe("the engine", () => {
  test("an early strike is told to Joseon a month before; never less warned", async () => {
    const { r, g, ww, s, jpn, jos, nextDay, setFlag } = await game("JOS");
    step(r, WW_PREP_TICKS + 2);
    nextDay();
    // The demand has gone out, so the Sō house's scene (I6b), whose plain
    // demand adds readiness, cannot lift this muster past the thin wave.
    setFlag(JP_MARK.demandsSent);
    // The AI's bar is met below a full muster: an early strike.
    s.readiness = 650;
    s.aiBar = 650;
    s.aiPatience = 0;
    s.readyDay = 0;
    s.warning = 100;
    nextDay();
    expect(isEarlyStrike(650)).toBe(true);
    expect(s.strikeDay).toBe(ww.day(g.ticks()) + EARLY_NOTICE_DAYS);
    expect(s.warning).toBeGreaterThanOrEqual(100 + EARLY_WARNING);
    expect(ww.isAtWar(jpn.smallID(), jos.smallID())).toBe(false);
    const until = s.strikeDay;
    while (ww.day(g.ticks()) < until) nextDay();
    nextDay();
    expect(ww.isAtWar(jpn.smallID(), jos.smallID())).toBe(true);
    const spirits = (id: number) =>
      ww.politics.country(id)!.spirits.map((x) => x.id);
    expect(spirits(jpn.smallID())).toContain(JP_SPIRIT.thinWave);
    expect(spirits(jos.smallID())).not.toContain(JP_SPIRIT.unready);
  }, 60_000);

  test("the AI strikes only past its bar; the first wave by readiness", async () => {
    const { r, g, ww, jp, s, jpn, jos, nextDay } = await game("JOS");
    step(r, WW_PREP_TICKS + 2);
    nextDay();
    expect(s.seeded).toBe(true);
    s.readiness = 100;
    s.readyDay = -1;
    expect(declareWarBlock(g, ww, jpn, jos, g.ticks())).toBe("not_ready");
    expect(jp.mayDeclare(jos.smallID(), jpn.smallID())).toBe(true);
    // Joseon was never warned: a thin wave meets an unready country.
    s.warning = 0;
    ww.setWar(jpn.smallID(), jos.smallID(), g.ticks());
    nextDay();
    expect(s.warDay).toBeGreaterThanOrEqual(0);
    const spirits = (id: number) =>
      ww.politics.country(id)!.spirits.map((x) => x.id);
    expect(spirits(jpn.smallID())).toContain(JP_SPIRIT.thinWave);
    expect(spirits(jos.smallID())).toContain(JP_SPIRIT.unready);
    expect(
      ww.politics.country(jpn.smallID())!.flags.has(JP_MARK.warBegun),
    ).toBe(true);
    // A corps under a wavering daimyo is slow to take orders.
    const army = ww.land.armiesOf(jpn.smallID())[0];
    expect(army).toBeDefined();
    const before = ww.depth.armyMods(jpn.smallID(), army.id).planSpeedPct;
    s.loyalty[corpsOfArmy(army.nameNo)] = 300;
    expect(ww.depth.armyMods(jpn.smallID(), army.id).planSpeedPct).toBe(
      before - 20,
    );
    // The state survives a snapshot.
    const snap = ImjinJapanStateSchema.parse(jp.snapshot());
    const h = jp.hash();
    jp.restoreState(snap);
    expect(jp.hash()).toBe(h);
  }, 60_000);

  test("Hideyoshi's death: the regents, and loyalty falls", async () => {
    const { r, ww, s, jpn, nextDay } = await game("JPN");
    step(r, WW_PREP_TICKS + 2);
    nextDay();
    const base = [...s.base];
    s.health = 1;
    nextDay();
    expect(s.deathDay).toBeGreaterThanOrEqual(0);
    expect(s.base).toEqual(base.map((b) => b - DEATH_LOYALTY));
    const c = ww.politics.country(jpn.smallID())!;
    expect(c.flags.has(JP_MARK.regency)).toBe(true);
    expect(c.pending.some((p) => p.eventId === "imjin_jp_taiko_dies")).toBe(
      true,
    );
  }, 60_000);

  test("a forged truce, the truth, and a second invasion by state", async () => {
    const { r, g, ww, s, jpn, jos, min, nextDay, setFlag } = await game("JPN");
    step(r, WW_PREP_TICKS + 2);
    ww.setWar(jpn.smallID(), jos.smallID(), g.ticks());
    ww.setWar(jpn.smallID(), min.smallID(), g.ticks());
    nextDay();
    expect(s.mingDay).toBeGreaterThanOrEqual(0);
    // Hideyoshi is failing; Konishi will forge; a month after Ming came in.
    s.hband = 2;
    s.loyalty[0] = s.base[0] = 200;
    for (let i = 0; i < 31 && s.phase === TRUCE_PHASE.none; i++) nextDay();
    expect(s.phase).toBe(TRUCE_PHASE.talksAsked);
    setFlag(JP_FLAG.talksYes);
    nextDay();
    expect(s.phase).toBe(TRUCE_PHASE.talking);
    s.phaseDay = ww.day(g.ticks());
    nextDay();
    expect(s.forged).toBe(true);
    expect(s.phase).toBe(TRUCE_PHASE.replyAsked);
    setFlag(JP_FLAG.truceYes);
    nextDay();
    expect(s.phase).toBe(TRUCE_PHASE.truce);
    expect(ww.isAtWar(jpn.smallID(), jos.smallID())).toBe(false);
    expect(ww.isAtWar(jpn.smallID(), min.smallID())).toBe(false);
    expect(declareWarBlock(g, ww, jpn, jos, g.ticks())).toBe("truce_active");
    // The envoys come; the letter is read; the truth is out.
    s.phaseDay = ww.day(g.ticks());
    nextDay();
    expect(s.phase).toBe(TRUCE_PHASE.envoysAsked);
    const konishi = s.loyalty[0];
    setFlag(JP_FLAG.tearLetter);
    nextDay();
    expect(s.phase).toBe(TRUCE_PHASE.broken);
    expect(s.loyalty[0]).toBeLessThan(konishi);
    expect(ww.endgame.truceUntil(jpn.smallID(), jos.smallID())).toBe(0);
    expect(ww.politics.gflags.has("imjin_truce_broken")).toBe(true);
    // The muster begins again: no war until it passes the bar.
    expect(declareWarBlock(g, ww, jpn, jos, g.ticks())).toBe("not_ready");
    s.readiness = 600;
    setFlag(JP_FLAG.strikeNow);
    nextDay();
    expect(ww.isAtWar(jpn.smallID(), jos.smallID())).toBe(true);
    nextDay();
    expect(s.phase).toBe(TRUCE_PHASE.second);
  }, 60_000);
});
