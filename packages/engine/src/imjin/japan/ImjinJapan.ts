// ww177 I4b (Imjin design §7, §8, §10): Japan's politics and the truce,
// trimmed to feed the war. Only the Imjin profile builds it (WorldWar.japan),
// so the 1936 game never runs a line of it.
//
// - The great daimyo: a loyalty each; the N-th army is a daimyo's corps, and
//   low loyalty slows its orders (plan readiness) and org recovery, and the
//   mean slows Japan's training and recruiting.
// - Hideyoshi's health: age, the war's strain and bad news; never a date.
//   His death brings the five regents, a fall in stability and loyalty, and
//   a pressure to withdraw (the AI goes home; a human plays on).
// - The run-up (design §8): readiness rises with the muster; Japan may
//   strike once it passes a bar. Early means a thinner first wave and a
//   warning scene for Joseon a month before the war (EARLY_NOTICE_DAYS),
//   which raises its warning: early never means a less warned Joseon.
// - The truce: Konishi and Shen Weijing carry the terms; a disloyal broker
//   softens both texts. When the investiture envoys meet Hideyoshi the truth
//   comes out and the truce breaks; a second invasion comes by state alone.
//
// Scenes (JapanContent.ts) set flags; this reads and clears them once a day.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  AGE_DAYS_1592,
  agingBefore,
  aiStrikePlan,
  BAD_NEWS_BLOW,
  BROKER,
  corpsOfArmy,
  corpsPlanSpeedPct,
  corpsRecoveryPct,
  dailyHealthLoss,
  dailyPressure,
  dailyReadiness,
  dailyWarning,
  DEATH_LOYALTY,
  EARLY_NOTICE_DAYS,
  EARLY_WARNING,
  forgeChancePct,
  FULL_WAVE,
  GRANT_LOYALTY,
  GREAT_DAIMYO,
  HARDLINER,
  HEALTH_BASE,
  HEALTH_SPREAD,
  healthBand,
  HEED_WARNING,
  isEarlyStrike,
  japanStats,
  LOYALTY_MAX,
  loyaltyBand,
  meanLoyalty,
  PRESSURE_ASK,
  PRESSURE_MAX,
  READINESS_1590,
  READINESS_1592,
  REARM_READINESS,
  RUNUP_STEPS,
  secondBar,
  STRIKE_BAR,
  talkDays,
  truceDays,
  warnedOf,
  WARNING_1590,
  WARNING_1592,
  waveOf,
} from "@openfront/engine-lib/imjin/Japan";
import {
  IMJIN_GFLAG,
  IMJIN_PEACE_GFLAG,
  JP_FLAG,
  JP_MARK,
  JP_SCENE,
  JP_SPIRIT,
  JP_SPIRIT_DAYS,
} from "@openfront/engine-lib/imjin/JapanContent";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { z } from "zod";
import type { Game } from "../../game/Game";
import type { ArmyDepthMods } from "../../ww1936/depth/WwDepth";
import { declareWar } from "../../ww1936/Diplomacy";
import { setTruce } from "../../ww1936/endgame/WhitePeace";
import { applyEffects, makeCtx } from "../../ww1936/politics/Dispatch";
import { endWarBetween } from "../../ww1936/politics/Territory";
import type { WorldWar } from "../../ww1936/WorldWar";

/** The truce's course (state, by number: append only). */
export const TRUCE_PHASE = {
  none: 0,
  talksAsked: 1,
  talking: 2,
  replyAsked: 3,
  truce: 4,
  envoysAsked: 5,
  broken: 6,
  peace: 7,
  second: 8,
  withdrawn: 9,
} as const;
const P = TRUCE_PHASE;

/** A truce that only the truth ends (days). */
const TRUCE_LOCK = 100_000;
/** After going home, no war for a year. */
const HOME_TRUCE = 365;
/** An unanswered scene counts as "no" after this many days. */
const ASK_DAYS = 60;

// One-time scenes and messages (bits of `told`, append only).
const T_OMENS = 1 << 0;
const T_OMENS_GRAVE = 1 << 1;
const T_STRIKE_READY = 1 << 2;
const T_STRIKE_FULL = 1 << 3;
const T_STRIKE_AGAIN = 1 << 4;
const T_AILING = 1 << 5;
const T_RUMOUR = 1 << 6;

// Roll purposes.
const R_PLAN = idHash("imjin_jp_plan");
const R_HEALTH = idHash("imjin_jp_health");
const R_SECOND = idHash("imjin_jp_second");
const R_FORGE = idHash("imjin_jp_forge");
const R_TALK = idHash("imjin_jp_talk");

export const ImjinJapanStateSchema = z.object({
  seeded: z.boolean(),
  lastDay: zInt(),
  loyalty: z.array(zInt()),
  base: z.array(zInt()),
  lband: z.array(zInt()),
  constitution: zInt(),
  health: zInt(),
  hband: zInt(),
  deathDay: zInt(),
  readiness: zInt(),
  warning: zInt(),
  /** An early strike's day, set when Tsushima's reports go out (-1: none). */
  strikeDay: zInt(),
  aiBar: zInt(),
  aiPatience: zInt(),
  readyDay: zInt(),
  secondBar: zInt(),
  warDay: zInt(),
  wasAtWar: z.boolean(),
  mingDay: zInt(),
  told: zInt(),
  phase: zInt(),
  phaseDay: zInt(),
  cooldown: zInt(),
  forged: z.boolean(),
  pressure: zInt(),
  askDay: zInt(),
  grumbleDay: zInt(),
  peakHeld: zInt(),
  weekHeld: zInt(),
  held: zInt(),
});
export type ImjinJapanState = z.infer<typeof ImjinJapanStateSchema>;

export class ImjinJapan {
  private s: ImjinJapanState;
  /** Derived: per army, the depth mods with its daimyo's loyalty in them. */
  private readonly modsScratch = new Map<number, ArmyDepthMods>();
  private readonly statsScratch: Partial<WwStats> = {};
  readonly jpn: number;
  readonly jos: number;
  readonly min: number;

  constructor(
    private readonly mg: Game,
    private readonly ww: WorldWar,
  ) {
    this.jpn = ww.scenario.smallIdOf("JPN");
    this.jos = ww.scenario.smallIdOf("JOS");
    this.min = ww.scenario.smallIdOf("MIN");
    const y1592 = ww.imjinStart === "y1592";
    this.s = {
      seeded: false,
      lastDay: -1,
      loyalty: GREAT_DAIMYO.map((d) => d.loyalty),
      base: GREAT_DAIMYO.map((d) => d.loyalty),
      lband: GREAT_DAIMYO.map((d) => loyaltyBand(d.loyalty)),
      constitution: HEALTH_BASE,
      health: HEALTH_BASE,
      hband: 0,
      deathDay: -1,
      readiness: y1592 ? READINESS_1592 : READINESS_1590,
      warning: y1592 ? WARNING_1592 : WARNING_1590,
      strikeDay: -1,
      aiBar: READINESS_1592,
      aiPatience: 0,
      readyDay: -1,
      secondBar: READINESS_1592,
      warDay: -1,
      wasAtWar: false,
      mingDay: -1,
      told: 0,
      phase: P.none,
      phaseDay: 0,
      cooldown: 0,
      forged: false,
      pressure: 0,
      askDay: -1,
      grumbleDay: -1,
      peakHeld: 0,
      weekHeld: 0,
      held: 0,
    };
  }

  // ---- Reads (the tests, the AI and the screens) ----

  state(): Readonly<ImjinJapanState> {
    return this.s;
  }

  alive(): boolean {
    return this.s.deathDay < 0;
  }

  /** Whether `a` may declare war on `b` now (Diplomacy.declareWarBlock). */
  mayDeclare(a: number, b: number): boolean {
    if (a !== this.jpn || b !== this.jos || this.jpn === 0) return true;
    const s = this.s;
    if (s.phase === P.peace) return false;
    if (s.warDay >= 0 && s.phase !== P.broken && s.phase !== P.withdrawn) {
      return true;
    }
    if (this.ww.politics.isHuman(a)) {
      if (s.readiness < STRIKE_BAR) return false;
      // A second invasion goes at the bar; Joseon knows what is coming.
      if (s.warDay >= 0) return true;
      // An early first strike sails only after Joseon has had its warning.
      if (s.strikeDay >= 0) return this.ww.day(this.mg.ticks()) >= s.strikeDay;
      return !isEarlyStrike(s.readiness);
    }
    if (s.phase === P.withdrawn) return false;
    return this.aiStrikeOpen(this.ww.day(this.mg.ticks()));
  }

  // ---- The engine's hooks ----

  /** Japan's armies: their daimyo's loyalty in the depth mods (WwDepth.armyMods). */
  armyMods(owner: number, armyId: number, base: ArmyDepthMods): ArmyDepthMods {
    if (owner !== this.jpn || owner === 0) return base;
    const army = this.ww.land.armies.get(armyId);
    if (army === undefined) return base;
    const loy = this.s.loyalty[corpsOfArmy(army.nameNo)];
    const plan = corpsPlanSpeedPct(loy);
    const rec = corpsRecoveryPct(loy);
    if (plan === 0 && rec === 0) return base;
    let m = this.modsScratch.get(armyId);
    if (m === undefined) {
      m = { ...base };
      this.modsScratch.set(armyId, m);
    } else {
      Object.assign(m, base);
    }
    m.planSpeedPct += plan;
    m.recoveryPct += rec;
    return m;
  }

  /** Japan's country stats from its daimyo and the regency (WwPolitics.sumSources). */
  statsPart(smallID: number): Partial<WwStats> | null {
    if (smallID !== this.jpn || smallID === 0) return null;
    const st = japanStats(
      meanLoyalty(this.s.loyalty),
      this.s.pressure,
      !this.alive(),
    );
    const out = this.statsScratch;
    out.trainPct = st.trainPct;
    out.recruitablePct = st.recruitablePct;
    out.stabilityWeeklyBp = st.stabilityWeeklyBp;
    return out;
  }

  // ---- The day ----

  tick(ticks: number): void {
    const ww = this.ww;
    if (ww.inPrep(ticks) || this.jpn === 0 || this.jos === 0) return;
    const day = ww.day(ticks);
    if (day === this.s.lastDay) return;
    this.s.lastDay = day;
    if (!ww.politics.living(this.jpn)) return;
    if (!this.s.seeded) this.seed();
    this.daily(day, ticks);
  }

  private seed(): void {
    const s = this.s;
    const seed = this.ww.politics.seed;
    const y1592 = this.ww.imjinStart === "y1592";
    const plan = aiStrikePlan(wwRoll(seed, R_PLAN, 1), y1592);
    s.aiBar = plan.bar;
    s.aiPatience = plan.patience;
    s.secondBar = secondBar(wwRoll(seed, R_SECOND, 1));
    s.constitution =
      HEALTH_BASE + (wwRoll(seed, R_HEALTH, 1) % (HEALTH_SPREAD + 1));
    s.health = s.constitution - (y1592 ? agingBefore(AGE_DAYS_1592) : 0);
    s.hband = healthBand(s.health, s.constitution);
    s.seeded = true;
  }

  private daily(day: number, tick: number): void {
    const s = this.s;
    const ww = this.ww;
    this.readFlags(day, tick);
    const atJos = ww.isAtWar(this.jpn, this.jos);
    const atMin = this.min !== 0 && ww.isAtWar(this.jpn, this.min);
    // A war with Joseon begins (whoever declared it).
    if (atJos && !s.wasAtWar) this.onWarStart(day, tick);
    s.wasAtWar = atJos;
    if (atMin && s.mingDay < 0) {
      // Ming comes in: bad news for Hideyoshi.
      s.mingDay = day;
      this.badNews();
    }
    this.countHeld(day);
    this.stepHealth(day, tick, atJos, atMin);
    this.stepLoyalty(day, atJos);
    this.stepRunUp(day, tick, atJos);
    this.stepTruce(day, atJos, atMin);
    if (!this.alive()) this.stepRegency(day, tick, atJos, atMin);
    this.mark(JP_MARK.losing, s.peakHeld > 0 && this.heldPm() < 600, day);
  }

  // ---- Flags the scenes and decisions set ----

  private take(id: number, f: string): boolean {
    const c = this.ww.politics.country(id);
    if (c === null || !c.flags.has(f)) return false;
    c.flags.delete(f);
    this.ww.politics.markCountry(id);
    return true;
  }

  private mark(f: string, on: boolean, day: number): void {
    const c = this.ww.politics.country(this.jpn);
    if (c === null || c.flags.has(f) === on) return;
    if (on) c.flags.set(f, [day, -1]);
    else c.flags.delete(f);
    this.ww.politics.markCountry(this.jpn);
  }

  private readFlags(day: number, tick: number): void {
    const s = this.s;
    const j = this.jpn;
    if (this.take(j, JP_FLAG.muster)) {
      this.runUp(RUNUP_STEPS.muster);
      this.addLoyalty(20);
    }
    if (this.take(j, JP_FLAG.sekibune)) this.runUp(RUNUP_STEPS.sekibune);
    if (this.take(j, JP_FLAG.nagoya)) this.runUp(RUNUP_STEPS.nagoya);
    if (this.take(j, JP_FLAG.demands)) {
      this.runUp(RUNUP_STEPS.demands);
      this.fire(JP_SCENE.demand, this.jos);
      this.setGflag(IMJIN_GFLAG.japanDemand, day);
    }
    if (this.take(j, JP_FLAG.grant)) this.addLoyalty(GRANT_LOYALTY);
    if (this.take(j, JP_FLAG.example)) this.makeExample();
    if (this.take(this.jos, JP_FLAG.heed)) {
      s.warning = Math.min(1000, s.warning + HEED_WARNING);
    }
    if (this.take(j, JP_FLAG.strikeNow)) this.strike(day, tick);
    const talksYes = this.take(j, JP_FLAG.talksYes);
    const talksNo = this.take(j, JP_FLAG.talksNo);
    if (s.phase === P.talksAsked && (talksYes || talksNo)) {
      if (talksYes) {
        s.phase = P.talking;
        s.phaseDay = day + talkDays(wwRoll(this.ww.politics.seed, R_TALK, day));
      } else {
        s.phase = P.none;
        s.cooldown = day + 120;
      }
    }
    const truceYes = this.take(j, JP_FLAG.truceYes);
    const truceNo = this.take(j, JP_FLAG.truceNo);
    if (s.phase === P.replyAsked && (truceYes || truceNo)) {
      if (truceYes) this.makeTruce(day, tick);
      else {
        s.phase = P.none;
        s.cooldown = day + 180;
      }
    }
    const tear = this.take(j, JP_FLAG.tearLetter);
    const take = this.take(j, JP_FLAG.takeTitle);
    if (s.phase === P.envoysAsked && (tear || take)) {
      if (tear) this.truthOut(day);
      else this.makePeace(day);
    }
    if (this.take(j, JP_FLAG.goHome)) this.withdraw(day, tick);
    if (this.take(j, JP_FLAG.fightOn)) {
      s.pressure = Math.max(0, s.pressure - 200);
    }
  }

  // ---- The run-up and the strike ----

  private runUp(step: { readiness: number; warning: number }): void {
    const s = this.s;
    s.readiness = Math.min(1000, s.readiness + step.readiness);
    if (s.warDay < 0) s.warning = Math.min(1000, s.warning + step.warning);
  }

  private aiStrikeOpen(day: number): boolean {
    const s = this.s;
    if (s.phase === P.broken) {
      // A Ming weary of the war (lane I4a's flag) emboldens the second try.
      const bar = this.mingWeary() ? s.secondBar - 100 : s.secondBar;
      return this.alive() && s.readiness >= bar;
    }
    if (s.warDay >= 0) return false;
    return (
      s.readiness >= s.aiBar &&
      s.readyDay >= 0 &&
      day - s.readyDay >= s.aiPatience
    );
  }

  private stepRunUp(day: number, tick: number, atJos: boolean): void {
    const s = this.s;
    const ww = this.ww;
    const rearming = s.phase === P.broken || s.phase === P.withdrawn;
    if (atJos || (s.warDay >= 0 && !rearming)) return;
    s.readiness = Math.min(
      1000,
      s.readiness + dailyReadiness(meanLoyalty(s.loyalty), day),
    );
    if (s.warDay < 0) {
      s.warning = Math.min(1000, s.warning + dailyWarning(s.readiness));
      // Joseon's court hears of the preparations (design §8).
      if (s.warning >= 300) this.once(T_OMENS, JP_SCENE.omens, this.jos);
      if (s.warning >= 650)
        this.once(T_OMENS_GRAVE, JP_SCENE.omensGrave, this.jos);
    }
    if (s.readiness >= s.aiBar && s.readyDay < 0) s.readyDay = day;
    // An early strike under way sails on its day (a human's or the AI's).
    if (s.strikeDay >= 0 && s.warDay < 0 && day >= s.strikeDay) {
      this.strike(day, tick);
      return;
    }
    if (ww.politics.isHuman(this.jpn)) {
      if (s.phase === P.withdrawn) return;
      if (s.phase === P.broken) {
        if (s.readiness >= STRIKE_BAR) {
          this.once(T_STRIKE_AGAIN, JP_SCENE.strikeAgain, this.jpn);
        }
        return;
      }
      // One scene at each bar (a start at the full muster hears only the second).
      if (s.readiness >= FULL_WAVE) {
        s.told |= T_STRIKE_READY;
        this.once(T_STRIKE_FULL, JP_SCENE.strikeFull, this.jpn);
      } else if (s.readiness >= STRIKE_BAR && s.strikeDay < 0) {
        // Asked again every ASK_DAYS while the muster is short of full.
        if (day % ASK_DAYS === 0) s.told &= ~T_STRIKE_READY;
        this.once(T_STRIKE_READY, JP_SCENE.strikeReady, this.jpn);
      }
      return;
    }
    if (s.phase !== P.withdrawn && this.aiStrikeOpen(day)) {
      this.strike(day, tick);
    }
  }

  /**
   * Japan sails. A first strike before the muster is done (isEarlyStrike)
   * is seen first: Tsushima's reports reach Joseon, its warning rises, and
   * the war comes EARLY_NOTICE_DAYS later (stepRunUp).
   */
  private strike(day: number, tick: number): void {
    const s = this.s;
    const ww = this.ww;
    const a = ww.playerOfTag("JPN");
    const b = ww.playerOfTag("JOS");
    if (a === null || b === null || ww.isAtWar(this.jpn, this.jos)) return;
    const second = s.phase === P.broken || s.phase === P.withdrawn;
    if (!second && s.warDay < 0) {
      if (s.strikeDay < 0 && isEarlyStrike(s.readiness)) {
        s.strikeDay = day + EARLY_NOTICE_DAYS;
        s.warning = Math.min(1000, s.warning + EARLY_WARNING);
        this.fire(JP_SCENE.tsushima, this.jos);
        this.msg(this.jpn, "events_display.ww1936_imjin_jp_sailing_seen");
        return;
      }
      if (s.strikeDay >= 0 && day < s.strikeDay) return;
    }
    declareWar(this.mg, ww, a, b, tick);
  }

  /** The first wave lands (or the second): the spirits by readiness and warning. */
  private onWarStart(day: number, tick: number): void {
    const s = this.s;
    const second = s.phase === P.broken || s.phase === P.withdrawn;
    const wave = waveOf(s.readiness);
    if (wave === 0) {
      this.spirit(this.jpn, JP_SPIRIT.thinWave, JP_SPIRIT_DAYS.thinWave, tick);
    } else if (wave === 2) {
      this.spirit(this.jpn, JP_SPIRIT.fullWave, JP_SPIRIT_DAYS.fullWave, tick);
    }
    this.msg(
      this.jpn,
      [
        "events_display.ww1936_imjin_jp_wave_thin",
        "events_display.ww1936_imjin_jp_wave_ordinary",
        "events_display.ww1936_imjin_jp_wave_full",
      ][wave],
    );
    if (second) {
      // The second time Joseon knows what is coming.
      s.phase = P.second;
    } else {
      s.warDay = day;
      this.mark(JP_MARK.warBegun, true, day);
      const w = warnedOf(s.warning);
      if (w === 0) {
        this.spirit(this.jos, JP_SPIRIT.unready, JP_SPIRIT_DAYS.unready, tick);
      } else if (w === 1) {
        this.spirit(
          this.jos,
          JP_SPIRIT.halfReady,
          JP_SPIRIT_DAYS.halfReady,
          tick,
        );
      }
      this.msg(
        this.jos,
        [
          "events_display.ww1936_imjin_jos_unwarned",
          "events_display.ww1936_imjin_jos_half_warned",
          "events_display.ww1936_imjin_jos_warned",
        ][w],
      );
    }
  }

  // ---- Ground held in Korea, and the news ----

  private countHeld(day: number): void {
    const s = this.s;
    const land = this.ww.land;
    const legal = this.ww.politics.legalOwner;
    let held = 0;
    for (const r of this.ww.scenario.landRegions) {
      if (land.controller[r.id] === this.jpn && legal[r.id] === this.jos)
        held++;
    }
    s.held = held;
    if (held > s.peakHeld) s.peakHeld = held;
    if (day % 7 !== 0) return;
    const step = Math.max(2, Math.floor(s.weekHeld / 10));
    if (s.weekHeld - held >= step) this.badNews();
    else if (held - s.weekHeld >= step) this.addLoyalty(20);
    s.weekHeld = held;
  }

  /** Per mille of the most Japan ever held in Korea that it holds now. */
  private heldPm(): number {
    const s = this.s;
    return s.peakHeld === 0 ? 1000 : Math.floor((s.held * 1000) / s.peakHeld);
  }

  private badNews(): void {
    if (this.alive()) this.s.health -= BAD_NEWS_BLOW;
    this.addLoyalty(-40);
  }

  // ---- Hideyoshi ----

  private stepHealth(
    day: number,
    tick: number,
    atJos: boolean,
    atMin: boolean,
  ): void {
    const s = this.s;
    if (!this.alive()) return;
    const ageDay = day + (this.ww.imjinStart === "y1592" ? AGE_DAYS_1592 : 0);
    s.health -= dailyHealthLoss(ageDay, (atJos ? 1 : 0) + (atMin ? 1 : 0));
    const band = healthBand(s.health, s.constitution);
    if (band > s.hband) {
      s.hband = band;
      this.msg(
        this.jpn,
        [
          "",
          "events_display.ww1936_imjin_jp_taiko_failing",
          "events_display.ww1936_imjin_jp_taiko_bedridden",
          "events_display.ww1936_imjin_jp_taiko_grave",
        ][band],
      );
      if (band >= 2) {
        this.mark(JP_MARK.frail, true, day);
        this.once(T_AILING, JP_SCENE.ailing, this.jpn);
        if ((s.told & T_RUMOUR) === 0) {
          s.told |= T_RUMOUR;
          this.msg(this.jos, "events_display.ww1936_imjin_jos_taiko_rumour");
        }
      }
    }
    if (s.health <= 0) this.die(day, tick);
  }

  private die(day: number, _tick: number): void {
    const s = this.s;
    s.health = 0;
    s.hband = 3;
    s.deathDay = day;
    const c = this.ww.politics.country(this.jpn);
    const named = c !== null && c.flags.has(JP_FLAG.regentsNamed);
    const fall = named ? DEATH_LOYALTY / 2 : DEATH_LOYALTY;
    for (let i = 0; i < s.loyalty.length; i++) {
      s.base[i] = Math.max(0, s.base[i] - fall);
    }
    this.addLoyalty(-fall);
    this.mark(JP_MARK.regency, true, day);
    this.fire(JP_SCENE.dies, this.jpn);
    this.msg(this.jos, "events_display.ww1936_imjin_jos_taiko_dead");
  }

  private stepRegency(
    day: number,
    tick: number,
    atJos: boolean,
    atMin: boolean,
  ): void {
    const s = this.s;
    s.pressure = Math.min(
      PRESSURE_MAX,
      s.pressure + dailyPressure(this.heldPm(), atMin, atJos),
    );
    if (!atJos) return;
    if (this.ww.politics.isHuman(this.jpn)) {
      if (
        s.pressure >= PRESSURE_ASK &&
        (s.askDay < 0 || day - s.askDay >= 90)
      ) {
        s.askDay = day;
        this.fire(JP_SCENE.regentsPress, this.jpn);
      }
    } else if (s.pressure >= PRESSURE_MAX) {
      this.withdraw(day, tick);
    }
  }

  /** The armies come home: the wars end and the land goes back. */
  private withdraw(day: number, tick: number): void {
    const s = this.s;
    const pol = this.ww.politics;
    const atJos = this.ww.isAtWar(this.jpn, this.jos);
    if (!atJos && s.phase !== P.truce) return;
    endWarBetween(pol, this.jpn, this.jos, tick);
    if (this.min !== 0) endWarBetween(pol, this.jpn, this.min, tick);
    if (s.phase === P.truce) this.dropTruces();
    setTruce(this.ww.endgame, this.jpn, this.jos, day + HOME_TRUCE);
    if (this.min !== 0) {
      setTruce(this.ww.endgame, this.jpn, this.min, day + HOME_TRUCE);
    }
    s.phase = P.withdrawn;
    s.pressure = 0;
    s.wasAtWar = false;
    s.readiness = Math.min(s.readiness, REARM_READINESS);
    this.mg.displayMessage(
      "events_display.ww1936_imjin_jp_withdraws",
      MessageType.WORLD_WAR,
      null,
      undefined,
      { countryTag: "JPN" },
    );
  }

  // ---- The daimyo ----

  private addLoyalty(n: number): void {
    const s = this.s;
    for (let i = 0; i < s.loyalty.length; i++) {
      s.loyalty[i] = Math.max(0, Math.min(LOYALTY_MAX, s.loyalty[i] + n));
    }
  }

  private makeExample(): void {
    const s = this.s;
    let lo = 0;
    for (let i = 1; i < s.loyalty.length; i++) {
      if (s.loyalty[i] < s.loyalty[lo]) lo = i;
    }
    const keep = s.loyalty[lo];
    this.addLoyalty(40);
    s.loyalty[lo] = Math.max(0, keep - 150);
  }

  private stepLoyalty(day: number, atJos: boolean): void {
    const s = this.s;
    const longWar = atJos && s.warDay >= 0 && day - s.warDay > 365;
    const truce = s.phase === P.truce;
    for (let i = 0; i < s.loyalty.length; i++) {
      const d = GREAT_DAIMYO[i];
      let v = s.loyalty[i];
      // Drift back to where the man stands, a point every other day.
      if (day % 2 === 0) {
        if (v < s.base[i]) v++;
        else if (v > s.base[i]) v--;
      }
      if (day % 3 === 0) {
        if (longWar && d.dove) v--;
        if (truce && d.hawk) v--;
        if (truce && d.dove) v++;
      }
      s.loyalty[i] = Math.max(0, Math.min(LOYALTY_MAX, v));
      const band = loyaltyBand(s.loyalty[i]);
      if (band > s.lband[i] && band >= 2) {
        this.msg(
          this.jpn,
          band === 2
            ? "events_display.ww1936_imjin_jp_daimyo_wavers"
            : "events_display.ww1936_imjin_jp_daimyo_defiant",
          {
            daimyoPerson: d.nameKey,
          },
        );
      }
      s.lband[i] = band;
    }
    if (
      meanLoyalty(s.loyalty) < 450 &&
      (s.grumbleDay < 0 || day - s.grumbleDay >= 120)
    ) {
      s.grumbleDay = day;
      this.fire(JP_SCENE.grumble, this.jpn);
    }
  }

  // ---- The truce ----

  private stepTruce(day: number, atJos: boolean, atMin: boolean): void {
    const s = this.s;
    const seed = this.ww.politics.seed;
    switch (s.phase) {
      case P.none: {
        // Talks open by state: Ming is in the war, and it goes badly, or
        // Hideyoshi fails, or the war drags on.
        if (!atJos || !atMin || s.mingDay < 0 || day - s.mingDay < 30) return;
        if (day < s.cooldown) return;
        const reason =
          this.mingWeary() ||
          this.heldPm() < 750 ||
          s.hband >= 2 ||
          (s.warDay >= 0 && day - s.warDay >= 540);
        if (!reason) return;
        s.phase = P.talksAsked;
        s.phaseDay = day;
        this.fire(JP_SCENE.talks, this.jpn);
        return;
      }
      case P.talksAsked:
      case P.replyAsked:
        if (day - s.phaseDay > ASK_DAYS) {
          s.phase = P.none;
          s.cooldown = day + 120;
        }
        return;
      case P.talking: {
        if (day < s.phaseDay) return;
        // The texts cross: does the broker soften them?
        const pct = forgeChancePct(s.loyalty[BROKER]);
        s.forged = wwRoll(seed, R_FORGE, day) % 100 < pct;
        if (s.forged) {
          s.phase = P.replyAsked;
          s.phaseDay = day;
          this.fire(JP_SCENE.mingReply, this.jpn);
        } else {
          // The true terms: Ming will not hear them.
          s.phase = P.none;
          s.cooldown = day + 180;
          this.msg(this.jpn, "events_display.ww1936_imjin_jp_ming_refuses");
          this.badNews();
        }
        return;
      }
      case P.truce:
        if (day < s.phaseDay) return;
        s.phase = P.envoysAsked;
        s.phaseDay = day;
        this.fire(
          this.alive() ? JP_SCENE.investiture : JP_SCENE.investitureRegents,
          this.jpn,
        );
        return;
      case P.envoysAsked:
        // Unanswered: the envoys go home and nothing changes.
        if (day - s.phaseDay > ASK_DAYS) this.makePeace(day);
        return;
      default:
        return;
    }
  }

  private makeTruce(day: number, tick: number): void {
    const s = this.s;
    const pol = this.ww.politics;
    // Japan keeps what it holds (the coast forts) while the envoys travel.
    endWarBetween(pol, this.jpn, this.jos, tick, () => true);
    if (this.min !== 0)
      endWarBetween(pol, this.jpn, this.min, tick, () => true);
    setTruce(this.ww.endgame, this.jpn, this.jos, day + TRUCE_LOCK);
    if (this.min !== 0) {
      setTruce(this.ww.endgame, this.jpn, this.min, day + TRUCE_LOCK);
    }
    s.phase = P.truce;
    s.wasAtWar = false;
    s.phaseDay = day + truceDays(wwRoll(pol.seed, R_TALK, day, 1));
    this.fire(JP_SCENE.truce, this.jos);
  }

  private dropTruces(): void {
    const eg = this.ww.endgame;
    const pairs = [this.jos, this.min].filter((x) => x !== 0);
    eg.truces = eg.truces.filter(
      ([a, b]) =>
        !pairs.some(
          (x) => Math.min(x, this.jpn) === a && Math.max(x, this.jpn) === b,
        ),
    );
    eg.dirtyPeace = true;
  }

  /** The investiture letter is read: the truce breaks; Japan musters again. */
  private truthOut(day: number): void {
    const s = this.s;
    this.dropTruces();
    this.setGflag(IMJIN_GFLAG.truceBroken, day);
    if (s.forged) {
      s.loyalty[BROKER] = Math.max(0, s.loyalty[BROKER] - 300);
      s.loyalty[HARDLINER] = Math.min(LOYALTY_MAX, s.loyalty[HARDLINER] + 100);
    }
    if (this.alive()) s.health -= BAD_NEWS_BLOW;
    s.readiness = REARM_READINESS;
    s.phase = P.broken;
    this.fire(JP_SCENE.truceBroken, this.jos);
  }

  private makePeace(day: number): void {
    const pol = this.ww.politics;
    this.s.phase = P.peace;
    pol.gflags.set(IMJIN_PEACE_GFLAG, day);
    pol.markGlobal();
  }

  // ---- Helpers ----

  private mingWeary(): boolean {
    return this.ww.politics.gflags.has(IMJIN_GFLAG.mingWeary);
  }

  private setGflag(f: string, day: number): void {
    const pol = this.ww.politics;
    if (pol.gflags.has(f)) return;
    pol.gflags.set(f, day);
    pol.markGlobal();
  }

  private fire(id: string, to: number): void {
    if (to === 0 || !this.ww.politics.living(to)) return;
    this.ww.politics.queueEvent(id, to, to, 0, 0);
  }

  private once(bit: number, id: string, to: number): void {
    if ((this.s.told & bit) !== 0) return;
    this.s.told |= bit;
    this.fire(id, to);
  }

  private msg(
    to: number,
    key: string,
    params: Record<string, string | number> = {},
  ): void {
    // A full events_display key (the client's notice; politics.message
    // would add the prefix itself).
    if (to === 0 || key === "") return;
    const pol = this.ww.politics;
    const p = pol.player(to);
    if (p === null || !pol.isHuman(to)) return;
    this.mg.displayMessage(
      key,
      MessageType.WORLD_WAR,
      p.id(),
      undefined,
      params,
    );
  }

  private spirit(to: number, id: string, days: number, tick: number): void {
    if (to === 0 || !this.ww.politics.living(to)) return;
    applyEffects(makeCtx(this.ww.politics, to, to, 0, tick), [
      { kind: "add_spirit", id, days },
    ]);
  }

  // ---- Snapshot and hash ----

  snapshot(): ImjinJapanState {
    const s = this.s;
    return {
      ...s,
      loyalty: [...s.loyalty],
      base: [...s.base],
      lband: [...s.lband],
    };
  }

  restoreState(st: ImjinJapanState): void {
    this.s = {
      ...st,
      loyalty: [...st.loyalty],
      base: [...st.base],
      lband: [...st.lband],
    };
    this.modsScratch.clear();
  }

  hash(): number {
    const s = this.s;
    let h = 19;
    const add = (v: number) => {
      h = (Math.imul(h, 31) + (v | 0)) | 0;
    };
    for (const v of s.loyalty) add(v);
    for (const v of s.base) add(v);
    add(s.health);
    add(s.deathDay);
    add(s.readiness);
    add(s.warning);
    add(s.strikeDay);
    add(s.warDay);
    add(s.phase);
    add(s.phaseDay);
    add(s.forged ? 1 : 0);
    add(s.pressure);
    add(s.told);
    add(s.held);
    return h >>> 0;
  }
}
