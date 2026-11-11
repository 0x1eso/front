// ww177 P4 (Imjin design §7, lane I4a): Joseon's court, the king's flight,
// the righteous armies and Ming's intervention meter, on the 1936 pieces:
// - the court's three factions are the ideology slots (CourtRules) and its
//   cohesion is Joseon's stability; a change of court is setGovernment;
// - the righteous armies rise from the occupation's resistance (endgame
//   resBp), push it up (the 1936 uprisings then take counties back) and cut
//   the occupier's supply (WwLand Supply reads raidPm);
// - Ming's entry is a 1936 faction and a joined war;
// - a court across the Yalu is the 1936 government in exile when Joseon
//   capitulates with Ming in the war (Exile.pickHost).
// Every scene opens by state. Only the Imjin profile builds this class.
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  groundSlotOf,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  APPOINT_GWON_COHESION_BP,
  APPOINT_GWON_WAR_DAYS,
  APPOINT_YI_COHESION_BP,
  APPOINT_YI_DAY,
  APPOINT_YI_SOUTH_BP,
  BAND_DIVISIONS,
  BAND_EQUIP_PCT,
  bandResistanceBp,
  COMMAND_COHESION_BP,
  COMMAND_REFUSED_BP,
  COURT_LOSS_POP_BP,
  COURT_SHIFT_COOLDOWN_DAYS,
  COURT_SOUTH,
  COURT_STARTS,
  COURT_STEP_DAYS,
  COURT_WEST,
  courtCohesionStep,
  courtRival,
  type FlightPick,
  flightResult,
  LEADER_FALL_PM,
  LEADER_FALLEN,
  LEADER_JOINED,
  LEADER_RAIDING,
  LEADER_WAITING,
  MING_DEMAND_BP,
  MING_EARLY_DAYS,
  MING_EARLY_LOSS_SUSPICION_BP,
  MING_ENVOY_BP,
  MING_ENVOY_SUSPICION_BP,
  MING_FORCE_EQUIP_PCT,
  MING_METER_MAX,
  MING_NORTHWEST_DAYS,
  MING_NORTHWEST_EVERY_DAYS,
  MING_NORTHWEST_ONE_IN,
  MING_RELIEF_BP,
  MING_RELIEF_DIVISIONS,
  MING_START,
  MING_SUSPICION_FADE_BP,
  MING_SUSPICION_MAX,
  MING_VANGUARD_BP,
  MING_VANGUARD_DIVISIONS,
  MING_WAR_BP,
  MING_WEARY_BP,
  mingDailyDelta,
  raidSupplyPm,
  RIGHTEOUS_LEADERS,
  riseChancePct,
  SEAT_ABROAD,
  SEAT_BORDER,
  SEAT_CAPITAL,
  SEAT_FALLEN,
  SEAT_NORTH,
  SEAT_SAFE_HOPS,
  TEMPLE_BURN_PCT,
  TEMPLE_COUNTIES,
  templeLand,
  TIP_COHESION_BP,
  TIP_WAR_DAYS,
} from "@openfront/engine-lib/imjin/CourtRules";
import {
  IMJIN_FLAGS,
  IMJIN_GFLAGS,
  pickFlag,
} from "@openfront/engine-lib/imjin/CourtScenes";
import { JOS_RESULTS } from "@openfront/engine-lib/imjin/JoseonContent";
import type { ImjinStartId } from "@openfront/engine-lib/imjin/Starts";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { addPopularity } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  genMixOf,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { z } from "zod";
import type { Game } from "../game/Game";
import { joinWar } from "../ww1936/Diplomacy";
import { createFaction, joinFaction } from "../ww1936/politics/Factions";
import { setGovernment } from "../ww1936/politics/Ideology";
import type { WorldWar } from "../ww1936/WorldWar";
import { applyJosResult } from "./JoseonPicks";

const P_RISE = idHash("imjin_rise");
const P_FALL = idHash("imjin_fall");
const P_TEMPLE = idHash("imjin_temple");
const P_NORTHWEST = idHash("imjin_northwest");

/** askedMisc bits: scenes asked once a game. */
const ASK_YI = 1;
const ASK_GWON = 2;
const ASK_TIP = 4;
const ASK_MONKS = 8;

export const ImjinJmStateSchema = z.object({
  lastDay: zInt(),
  seat: zInt(),
  seatRegion: zInt(),
  /** Bit per seat: its flight scene was asked. */
  askedSeat: zInt(),
  holding: z.boolean(),
  askedMisc: zInt(),
  shiftRival: zInt(),
  shiftUntil: zInt(),
  /** Joseon's legal counties it controlled at the last day. */
  held: zInt(),
  warDay: zInt(),
  /** By RIGHTEOUS_LEADERS position. */
  leaders: z.array(zInt()),
  bandRegion: z.array(zInt()),
  commanded: z.boolean(),
  monksCalled: z.boolean(),
  /** Counties checked for a temple at their first capture, ascending. */
  templeSeen: z.array(zInt()),
  /** [region, permille] of the counties the bands raid. */
  raid: z.array(z.tuple([zInt(), zInt()])),
  meter: zInt(),
  suspicion: zInt(),
  mingStage: zInt(),
  demandDone: z.boolean(),
  northwestUntil: zInt(),
});
export type ImjinJmState = z.infer<typeof ImjinJmStateSchema>;

/** Joseon's court and Ming's meter (the Imjin profile only). */
export class ImjinJoseonMing {
  lastDay = -1;
  seat = SEAT_CAPITAL;
  seatRegion = 0;
  askedSeat = 0;
  holding = false;
  askedMisc = 0;
  shiftRival = -1;
  shiftUntil = 0;
  held = 0;
  warDay = -1;
  leaders: number[] = RIGHTEOUS_LEADERS.map(() => LEADER_WAITING);
  bandRegion: number[] = RIGHTEOUS_LEADERS.map(() => 0);
  commanded = false;
  monksCalled = false;
  templeSeen = new Set<number>();
  /** Region → the supply the occupier keeps there, permille (absent: 1000). */
  raid = new Map<number, number>();
  meter = 0;
  suspicion = 0;
  mingStage = 0;
  demandDone = false;
  northwestUntil = -1;

  constructor(
    private readonly mg: Game,
    readonly ww: WorldWar,
    private readonly start: ImjinStartId,
  ) {
    this.meter = MING_START[start].meterBp;
    this.suspicion = MING_START[start].suspicionBp;
  }

  get jos(): number {
    return this.ww.scenario.smallIdOf("JOS");
  }
  get jpn(): number {
    return this.ww.scenario.smallIdOf("JPN");
  }
  get min(): number {
    return this.ww.scenario.smallIdOf("MIN");
  }

  /** WorldWar.start, after politics': the court of the start's year. */
  startGame(): void {
    const jos = this.jos;
    const c = this.ww.politics.country(jos);
    if (c === null) return;
    const s = COURT_STARTS[this.start];
    c.ruling = s.ruling;
    c.pop = [...s.pop];
    c.leader = `title:leader_${IDEOLOGIES[s.ruling]}`;
    c.stabBaseBp = s.cohesionBp;
    c.wsBaseBp = s.warSupportBp;
    this.ww.politics.recomputeStats(jos);
    this.seatRegion = this.ww.capitalRegion(jos);
    this.held = this.heldCount();
  }

  // ---- The day ----

  /** After politics' tick: once a day. */
  tick(ticks: number): void {
    if (this.ww.inPrep(ticks)) return;
    const day = this.ww.day(ticks);
    if (day === this.lastDay) return;
    this.lastDay = day;
    this.day(day, ticks);
  }

  /** The day's step (tests call it directly). */
  day(day: number, tick: number): void {
    const jos = this.jos;
    const pol = this.ww.politics;
    this.lastDay = day;
    if (jos === 0 || pol.country(jos) === null) return;
    this.readPicks(day, tick);
    const atWar = this.jpn !== 0 && this.ww.isAtWar(jos, this.jpn);
    if (atWar && this.warDay < 0) {
      this.warDay = day;
      this.addMeter(MING_WAR_BP);
    }
    const warDays = atWar && this.warDay >= 0 ? day - this.warDay : -1;
    this.countLosses(day);
    if (this.ww.isActor(jos)) {
      if (day % COURT_STEP_DAYS === 0) this.courtStep(day);
      this.appointments(day, warDays);
      if (atWar) {
        this.flight();
        this.temples(day);
        this.righteous(day);
      }
    }
    this.raidMap(atWar);
    this.mingDay(day, atWar, tick);
    pol.flushEvents(tick);
  }

  // ---- Picks (the scenes' and decisions' flags) ----

  private takeFlag(f: string): boolean {
    const c = this.ww.politics.country(this.jos)!;
    if (!c.flags.has(f)) return false;
    c.flags.delete(f);
    this.ww.politics.markCountry(this.jos);
    return true;
  }

  private readPicks(day: number, tick: number): void {
    const F = (s: string, o: string) => this.takeFlag(pickFlag(s, o));
    if (F("imjin_flight_capital", "a")) this.applyFlight("flee");
    if (F("imjin_flight_capital", "b")) this.applyFlight("hold");
    if (F("imjin_flight_capital", "c")) this.applyFlight("split");
    if (F("imjin_flight_north", "a")) this.applyFlight("flee");
    if (F("imjin_flight_north", "b")) this.applyFlight("hold");
    if (F("imjin_flight_north", "c")) this.applyFlight("split");
    if (F("imjin_flight_border", "a")) this.applyFlight("hold");
    if (F("imjin_flight_border", "b")) this.applyFlight("cross");
    if (F("imjin_court_shift", "a")) this.shiftCourt(true, tick);
    if (F("imjin_court_shift", "b")) this.shiftCourt(false, tick);
    if (F("imjin_appoint_yi", "a")) {
      this.setFlag(IMJIN_FLAGS.yiNavy, day);
      if (this.court().ruling === COURT_WEST) this.cohesion(-200);
      this.tell("ww1936_imjin_yi_appointed", {});
    }
    if (F("imjin_appoint_yi", "b")) this.tell("ww1936_imjin_yi_passed", {});
    if (F("imjin_appoint_gwon", "a")) {
      this.setFlag(IMJIN_FLAGS.gwonYul, day);
      this.tell("ww1936_imjin_gwon_appointed", {});
    }
    if (F("imjin_appoint_gwon", "b")) this.tell("ww1936_imjin_gwon_passed", {});
    if (F("imjin_double_agent", "a")) {
      this.setFlag(IMJIN_FLAGS.admiralArrested, day);
      this.cohesion(-300);
      this.tell("ww1936_imjin_admiral_arrested", {});
    }
    if (F("imjin_double_agent", "b")) {
      this.cohesion(-500);
      addPopularity(this.court().pop, this.court().ruling, -300);
      this.tell("ww1936_imjin_admiral_trusted", {});
    }
    if (F("imjin_monks_call", "a")) this.callMonks(day);
    if (F("imjin_monks_call", "b")) this.tell("ww1936_imjin_monks_left", {});
    if (F("envoy", "ming")) {
      this.addMeter(MING_ENVOY_BP + (this.seat >= SEAT_BORDER ? 300 : 0));
      this.suspicion = Math.max(0, this.suspicion - MING_ENVOY_SUSPICION_BP);
      this.tell("ww1936_imjin_envoy_sent", {});
    }
    if (F("bands", "command")) this.commandBands(day);
    if (F("bands", "muster")) this.musterBands();
    // ww177 P6 (lane I6a): the writers' scenes and preparations, by table.
    for (const r of JOS_RESULTS) {
      if (!this.takeFlag(r.flag)) continue;
      const done = applyJosResult(this.ww, this.jos, r, tick);
      if (r.mingMeterBp !== undefined) this.addMeter(r.mingMeterBp);
      if (r.mingSuspicionBp !== undefined) {
        this.suspicion = Math.max(
          0,
          Math.min(MING_SUSPICION_MAX, this.suspicion + r.mingSuspicionBp),
        );
      }
      if (done && r.lineKey !== undefined) {
        this.tell(r.lineKey.slice("events_display.".length), {});
      }
    }
  }

  // ---- The court ----

  private court() {
    return this.ww.politics.country(this.jos)!;
  }

  /** Cohesion is Joseon's stability: a change of its base (bp). */
  cohesion(bp: number): void {
    const c = this.court();
    c.stabBaseBp = Math.max(0, Math.min(10000, c.stabBaseBp + bp));
    this.ww.politics.recomputeStats(this.jos);
    this.ww.politics.markCountry(this.jos);
  }

  private warSupport(bp: number): void {
    const c = this.court();
    c.wsBaseBp = Math.max(0, Math.min(10000, c.wsBaseBp + bp));
    this.ww.politics.recomputeStats(this.jos);
  }

  private setFlag(f: string, day: number): void {
    this.court().flags.set(f, [day, -1]);
    this.ww.politics.markCountry(this.jos);
  }

  private clearFlag(f: string): void {
    if (this.court().flags.delete(f)) this.ww.politics.markCountry(this.jos);
  }

  private hasFlag(f: string): boolean {
    return this.court().flags.has(f);
  }

  private courtStep(day: number): void {
    const c = this.court();
    const d = courtCohesionStep(c.pop, c.ruling, c.stabBp);
    if (d !== 0) this.cohesion(d);
    if (day < this.shiftUntil) return;
    const rival = courtRival(c.pop, c.ruling);
    if (rival < 0) return;
    this.shiftRival = rival;
    this.shiftUntil = day + COURT_SHIFT_COOLDOWN_DAYS;
    this.ww.politics.queueEvent("imjin_court_shift", this.jos, this.jos, 0, 0);
  }

  private shiftCourt(yield_: boolean, tick: number): void {
    const rival = this.shiftRival;
    this.shiftRival = -1;
    if (rival < 0) return;
    if (yield_) {
      setGovernment(this.ww.politics, this.jos, rival, tick);
      this.cohesion(300);
      this.tell("ww1936_imjin_court_yielded", {
        ideology: IDEOLOGIES[rival],
      });
    } else {
      addPopularity(this.court().pop, rival, -600);
      this.cohesion(-800);
      this.tell("ww1936_imjin_court_held", { ideology: IDEOLOGIES[rival] });
    }
  }

  private appointments(day: number, warDays: number): void {
    const c = this.court();
    const ask = (bit: number, id: string) => {
      this.askedMisc |= bit;
      this.ww.politics.queueEvent(id, this.jos, this.jos, 0, 0);
    };
    if (
      (this.askedMisc & ASK_YI) === 0 &&
      day >= APPOINT_YI_DAY &&
      c.stabBp >= APPOINT_YI_COHESION_BP &&
      (c.ruling === COURT_SOUTH || c.pop[COURT_SOUTH] >= APPOINT_YI_SOUTH_BP)
    ) {
      ask(ASK_YI, "imjin_appoint_yi");
    }
    if (
      (this.askedMisc & ASK_GWON) === 0 &&
      warDays >= APPOINT_GWON_WAR_DAYS &&
      c.stabBp >= APPOINT_GWON_COHESION_BP
    ) {
      ask(ASK_GWON, "imjin_appoint_gwon");
    }
    if (
      (this.askedMisc & ASK_TIP) === 0 &&
      this.hasFlag(IMJIN_FLAGS.yiNavy) &&
      c.stabBp < TIP_COHESION_BP &&
      (warDays >= TIP_WAR_DAYS ||
        (warDays >= 0 && this.ww.politics.gflags.has(IMJIN_GFLAGS.truceBroken)))
    ) {
      ask(ASK_TIP, "imjin_double_agent");
    }
  }

  /** Joseon's legal counties lost (won back) since yesterday move the court. */
  private countLosses(day: number): void {
    const now = this.heldCount();
    const d = now - this.held;
    this.held = now;
    if (d === 0) return;
    const c = this.court();
    addPopularity(c.pop, c.ruling, d * COURT_LOSS_POP_BP);
    if (d < 0 && this.warDay >= 0 && day - this.warDay < MING_EARLY_DAYS) {
      this.suspicion = Math.min(
        MING_SUSPICION_MAX,
        this.suspicion - d * MING_EARLY_LOSS_SUSPICION_BP,
      );
    }
    this.ww.politics.markCountry(this.jos);
  }

  private heldCount(): number {
    const jos = this.jos;
    const legal = this.ww.politics.legalOwner;
    const ctl = this.ww.land.controller;
    let n = 0;
    for (const r of this.ww.scenario.landRegions) {
      if (legal[r.id] === jos && ctl[r.id] === jos) n++;
    }
    return n;
  }

  // ---- The king's flight ----

  private enemyOfJoseon(ctl: number): boolean {
    return ctl !== 0 && ctl !== this.jos && this.ww.isAtWar(ctl, this.jos);
  }

  private flight(): void {
    if (this.seat >= SEAT_ABROAD) return;
    if (this.seatRegion === 0) this.seatRegion = this.pickSeat(this.seat);
    const ctl = this.ww.land.controller;
    if (this.seatRegion !== 0 && this.enemyOfJoseon(ctl[this.seatRegion])) {
      this.seatFell();
      return;
    }
    if (this.holding || (this.askedSeat & (1 << this.seat)) !== 0) return;
    const threatened = this.ww.scenario
      .regionNeighbours(this.seatRegion)
      .some((n) => this.enemyOfJoseon(ctl[n]));
    if (!threatened) return;
    this.askedSeat |= 1 << this.seat;
    const id =
      this.seat === SEAT_CAPITAL
        ? "imjin_flight_capital"
        : this.seat === SEAT_NORTH
          ? "imjin_flight_north"
          : "imjin_flight_border";
    this.ww.politics.queueEvent(id, this.jos, this.jos, 0, 0);
  }

  private seatFell(): void {
    const from = this.seatRegion;
    const r = SEAT_FALLEN;
    this.cohesion(r.cohesionBp);
    this.warSupport(r.warSupportBp);
    const c = this.court();
    addPopularity(c.pop, c.ruling, -r.rulingPopBp);
    this.addMeter(r.mingBp);
    this.seat = Math.min(SEAT_ABROAD, this.seat + 1);
    if (this.seat === SEAT_ABROAD) this.addMeter(2500);
    this.seatRegion = this.pickSeat(this.seat);
    this.holding = false;
    this.tell("ww1936_imjin_seat_fell", { region: from });
  }

  /** Applies a flight pick (the result line says it in words). */
  applyFlight(pick: FlightPick): void {
    if (this.seat >= SEAT_ABROAD) return;
    const r = flightResult(this.seat, pick);
    this.cohesion(r.cohesionBp);
    this.warSupport(r.warSupportBp);
    const c = this.court();
    if (r.rulingPopBp !== 0) addPopularity(c.pop, c.ruling, -r.rulingPopBp);
    this.addMeter(r.mingBp);
    if (r.divided) this.setFlag(IMJIN_FLAGS.divided, this.lastDay);
    this.holding = pick === "hold";
    if (r.seat !== this.seat) {
      this.seat = r.seat;
      this.seatRegion = this.pickSeat(r.seat);
    }
    this.tell(`ww1936_imjin_flight_${pick}`, {
      region: this.seatRegion,
    });
  }

  /** The seat the court goes to (0: abroad, or nowhere safe). */
  pickSeat(seat: number): number {
    const jos = this.jos;
    if (seat === SEAT_ABROAD) return 0;
    if (seat === SEAT_CAPITAL) return this.ww.capitalRegion(jos);
    const sc = this.ww.scenario;
    const ctl = this.ww.land.controller;
    const dist = this.enemyDistance();
    let best = 0;
    let bestKey = -1;
    for (const r of sc.landRegions) {
      if (ctl[r.id] !== jos || r.id === this.seatRegion) continue;
      if (
        seat === SEAT_BORDER &&
        !sc.regionNeighbours(r.id).some((n) => ctl[n] === this.min)
      ) {
        continue;
      }
      const key = dist[r.id] * 1000 + r.vp;
      if (key > bestKey) {
        best = r.id;
        bestKey = key;
      }
    }
    if (best === 0 && seat === SEAT_BORDER) return this.pickSeat(SEAT_NORTH);
    return best;
  }

  /** Hops from the nearest county Joseon's enemies hold (capped). */
  private enemyDistance(): number[] {
    const sc = this.ww.scenario;
    const ctl = this.ww.land.controller;
    const dist = new Array<number>(sc.maxRegionId() + 1).fill(SEAT_SAFE_HOPS);
    let frontier: number[] = [];
    for (const r of sc.landRegions) {
      if (this.enemyOfJoseon(ctl[r.id])) {
        dist[r.id] = 0;
        frontier.push(r.id);
      }
    }
    for (let h = 1; h < SEAT_SAFE_HOPS && frontier.length > 0; h++) {
      const next: number[] = [];
      for (const r of frontier) {
        for (const n of sc.regionNeighbours(r)) {
          if (dist[n] > h) {
            dist[n] = h;
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    return dist;
  }

  // ---- Righteous armies and monks ----

  /** Whether a county is a leader's home (its name or its province's). */
  private homeOf(leader: number, region: number): boolean {
    const sc = this.ww.scenario;
    const name = sc.region(region)?.name ?? "";
    const prov = sc.sr(sc.regionSr(region))?.name ?? "";
    const homes = RIGHTEOUS_LEADERS[leader].homes;
    return homes.includes(name) || (prov !== "" && homes.includes(prov));
  }

  /** Joseon's legal counties its enemies hold, ascending. */
  occupied(): number[] {
    const jos = this.jos;
    const legal = this.ww.politics.legalOwner;
    const ctl = this.ww.land.controller;
    const out: number[] = [];
    for (const r of this.ww.scenario.landRegions) {
      if (legal[r.id] === jos && this.enemyOfJoseon(ctl[r.id])) out.push(r.id);
    }
    return out;
  }

  /** The leader's most restless occupied home county (0: none). */
  private bestHome(leader: number, occ: readonly number[]): number {
    const res = this.ww.endgame.resBp;
    let best = 0;
    for (const r of occ) {
      if (!this.homeOf(leader, r)) continue;
      if (best === 0 || res[r] > res[best]) best = r;
    }
    return best;
  }

  private righteous(day: number): void {
    const occ = this.occupied();
    const res = this.ww.endgame.resBp;
    const divided = this.hasFlag(IMJIN_FLAGS.divided);
    const seed = this.ww.politics.seed;
    RIGHTEOUS_LEADERS.forEach((L, i) => {
      const st = this.leaders[i];
      if (st === LEADER_WAITING) {
        if (L.monk && !this.monksCalled) return;
        const r = this.bestHome(i, occ);
        if (r === 0) return;
        const pct = riseChancePct(res[r], divided, this.commanded);
        if (pct <= 0 || wwRoll(seed, P_RISE, i, day) % 100 >= pct) return;
        this.leaders[i] = LEADER_RAIDING;
        this.bandRegion[i] = r;
        this.ww.politics.messageAll("ww1936_imjin_righteous_rise", {
          leader: L.id,
          region: r,
        });
        return;
      }
      if (st !== LEADER_RAIDING) return;
      const r = this.bestHome(i, occ);
      if (r === 0) {
        // The home is free again: the band joins the army.
        this.joinArmy(i, this.bandRegion[i]);
        return;
      }
      this.bandRegion[i] = r;
      const push = bandResistanceBp(this.commanded);
      for (const o of occ) {
        if (!this.homeOf(i, o) || !this.ww.endgame.isAdministered(o)) continue;
        res[o] = Math.min(10000, res[o] + push);
        this.ww.endgame.dirtyOcc.add(o);
      }
      const enemyThere = this.ww.land
        .rowsIn(r)
        .some((row) => this.enemyOfJoseon(this.ww.land.divisions.owner[row]));
      if (enemyThere && wwRoll(seed, P_FALL, i, day) % 1000 < LEADER_FALL_PM) {
        this.leaders[i] = LEADER_FALLEN;
        this.bandRegion[i] = 0;
        this.ww.politics.messageAll("ww1936_imjin_righteous_fallen", {
          leader: L.id,
          region: r,
        });
      }
    });
    this.syncBandFlags(day);
  }

  private syncBandFlags(day: number): void {
    const out = this.leaders.some((s) => s === LEADER_RAIDING);
    if (out && !this.hasFlag(IMJIN_FLAGS.bandsOut)) {
      this.setFlag(IMJIN_FLAGS.bandsOut, day);
    }
    if (!out) {
      this.clearFlag(IMJIN_FLAGS.bandsOut);
      this.clearFlag(IMJIN_FLAGS.commanded);
      this.commanded = false;
    }
  }

  /** A band (or a monk with no occupied home) joins the army as divisions. */
  private joinArmy(leader: number, from: number): void {
    this.leaders[leader] = LEADER_JOINED;
    this.bandRegion[leader] = 0;
    const at = this.nearestOwn(from);
    if (at !== 0) this.spawnForce(this.jos, at, BAND_DIVISIONS, BAND_EQUIP_PCT);
    this.ww.politics.messageAll("ww1936_imjin_righteous_join", {
      leader: RIGHTEOUS_LEADERS[leader].id,
      region: at,
    });
  }

  /** The nearest county Joseon controls (from itself outward; 0: none). */
  private nearestOwn(from: number): number {
    const sc = this.ww.scenario;
    const ctl = this.ww.land.controller;
    const jos = this.jos;
    if (from !== 0 && ctl[from] === jos) return from;
    const seen = new Set<number>([from]);
    let frontier = from === 0 ? [] : [from];
    while (frontier.length > 0) {
      const next: number[] = [];
      let best = 0;
      for (const r of frontier) {
        for (const n of sc.regionNeighbours(r)) {
          if (seen.has(n)) continue;
          seen.add(n);
          if (ctl[n] === jos && (best === 0 || n < best)) best = n;
          next.push(n);
        }
      }
      if (best !== 0) return best;
      frontier = next;
    }
    const cap = this.ww.capitalRegion(jos);
    return ctl[cap] === jos ? cap : 0;
  }

  private commandBands(day: number): void {
    if (!this.leaders.some((st) => st === LEADER_RAIDING)) return;
    const c = this.court();
    const authority =
      c.stabBp >= COMMAND_COHESION_BP &&
      (this.seat < SEAT_ABROAD || this.hasFlag(IMJIN_FLAGS.divided));
    if (!authority) {
      this.cohesion(-COMMAND_REFUSED_BP);
      this.tell("ww1936_imjin_command_refused", {});
      return;
    }
    this.commanded = true;
    this.setFlag(IMJIN_FLAGS.commanded, day);
    this.tell("ww1936_imjin_command_obeyed", {});
  }

  private musterBands(): void {
    RIGHTEOUS_LEADERS.forEach((_, i) => {
      if (this.leaders[i] === LEADER_RAIDING) {
        this.joinArmy(i, this.bandRegion[i]);
      }
    });
    this.syncBandFlags(this.lastDay);
  }

  private callMonks(day: number): void {
    this.monksCalled = true;
    const occ = this.occupied();
    RIGHTEOUS_LEADERS.forEach((L, i) => {
      if (!L.monk || this.leaders[i] !== LEADER_WAITING) return;
      const r = this.bestHome(i, occ);
      if (r !== 0) {
        this.leaders[i] = LEADER_RAIDING;
        this.bandRegion[i] = r;
        this.ww.politics.messageAll("ww1936_imjin_righteous_rise", {
          leader: L.id,
          region: r,
        });
      } else {
        // No occupied home: the monks march to the army.
        const home =
          this.ww.scenario.landRegions.find(
            (x) =>
              this.homeOf(i, x.id) &&
              this.ww.land.controller[x.id] === this.jos,
          )?.id ?? 0;
        this.joinArmy(i, home);
      }
    });
    this.syncBandFlags(day);
  }

  private temples(day: number): void {
    const sc = this.ww.scenario;
    const seed = this.ww.politics.seed;
    for (const r of this.occupied()) {
      if (this.templeSeen.has(r)) continue;
      this.templeSeen.add(r);
      const name = sc.region(r)?.name ?? "";
      const burns =
        TEMPLE_COUNTIES.includes(name) ||
        (templeLand(sc.landOf(r)) &&
          wwRoll(seed, P_TEMPLE, r) % 100 < TEMPLE_BURN_PCT);
      if (!burns) continue;
      this.setFlag(IMJIN_FLAGS.templeBurned, day);
      this.ww.politics.messageAll("ww1936_imjin_temple_burned", { region: r });
      if ((this.askedMisc & ASK_MONKS) === 0) {
        this.askedMisc |= ASK_MONKS;
        this.ww.politics.queueEvent(
          "imjin_monks_call",
          this.jos,
          this.jos,
          0,
          0,
        );
      }
    }
  }

  /** The counties the bands raid now (WwLand's supply reads raidPm). */
  private raidMap(atWar: boolean): void {
    this.raid.clear();
    if (!atWar) return;
    const sc = this.ww.scenario;
    const occ = this.occupied();
    RIGHTEOUS_LEADERS.forEach((_, i) => {
      if (this.leaders[i] !== LEADER_RAIDING) return;
      for (const r of occ) {
        if (!this.homeOf(i, r)) continue;
        const pm = raidSupplyPm(sc.landOf(r), this.commanded);
        this.raid.set(r, Math.min(this.raid.get(r) ?? 1000, pm));
      }
    });
  }

  /** The supply Joseon's enemies keep in `region`, permille (1000: no raid). */
  raidPm(region: number): number {
    const pm = this.raid.get(region);
    if (pm === undefined) return 1000;
    return this.enemyOfJoseon(this.ww.land.controller[region]) ? pm : 1000;
  }

  // ---- Ming ----

  addMeter(bp: number): void {
    this.meter = Math.max(0, Math.min(MING_METER_MAX, this.meter + bp));
  }

  private mingDay(day: number, atWar: boolean, tick: number): void {
    const min = this.min;
    if (min === 0 || !this.ww.isActor(min)) return;
    const pol = this.ww.politics;
    if (!this.demandDone && atWar && pol.gflags.has(IMJIN_GFLAGS.japanDemand)) {
      this.demandDone = true;
      this.addMeter(MING_DEMAND_BP);
    }
    if (
      day > 0 &&
      day % MING_NORTHWEST_EVERY_DAYS === 0 &&
      day >= this.northwestUntil &&
      wwRoll(pol.seed, P_NORTHWEST, day) % MING_NORTHWEST_ONE_IN === 0
    ) {
      this.northwestUntil = day + MING_NORTHWEST_DAYS;
      pol.messageAll("ww1936_imjin_ming_northwest", {});
    }
    const otherFront =
      day < this.northwestUntil ||
      this.ww
        .enemiesOf(min)
        .some((e) => e !== this.jpn && !this.ww.land.sameSide(e, this.jpn));
    this.addMeter(
      mingDailyDelta({
        war: atWar,
        nearHops: this.japanHopsToMing(),
        seat: this.seat,
        suspicionBp: this.suspicion,
        otherFront,
        intervened: this.mingStage > 0,
        divisionsAbroad: this.mingAbroad(),
      }),
    );
    this.suspicion = Math.max(0, this.suspicion - MING_SUSPICION_FADE_BP);
    if (atWar && this.mingStage === 0 && this.meter >= MING_VANGUARD_BP) {
      this.mingStage = 1;
      this.mingEnters(day, tick);
    }
    if (atWar && this.mingStage === 1 && this.meter >= MING_RELIEF_BP) {
      this.mingStage = 2;
      pol.gflags.set(IMJIN_GFLAGS.mingRelief, day);
      this.spawnForce(
        min,
        this.mingMuster(),
        MING_RELIEF_DIVISIONS,
        MING_FORCE_EQUIP_PCT,
      );
      pol.messageAll("ww1936_imjin_ming_relief", {});
      pol.markGlobal();
    }
    const weary = this.mingStage > 0 && this.meter < MING_WEARY_BP;
    if (weary !== pol.gflags.has(IMJIN_GFLAGS.mingWeary)) {
      if (weary) pol.gflags.set(IMJIN_GFLAGS.mingWeary, day);
      else pol.gflags.delete(IMJIN_GFLAGS.mingWeary);
      pol.markGlobal();
    }
  }

  /** Ming takes Joseon under its banner and goes to war with Japan. */
  private mingEnters(day: number, tick: number): void {
    const pol = this.ww.politics;
    const min = this.min;
    const jos = this.jos;
    const jpn = this.jpn;
    let fi = pol.factionIdx(min);
    if (fi < 0) fi = createFaction(pol, min, undefined, day);
    if (fi >= 0 && pol.factionIdx(jos) < 0) joinFaction(pol, jos, fi, tick);
    if (jpn !== 0 && !this.ww.isAtWar(min, jpn)) {
      const mp = this.mg.playerBySmallID(min);
      const jp = this.mg.playerBySmallID(jpn);
      const ok =
        mp.isPlayer() &&
        jp.isPlayer() &&
        joinWar(this.mg, this.ww, mp, jp, tick);
      if (!ok) this.ww.setWar(min, jpn, tick, { kind: "into", warId: 0 });
    }
    pol.gflags.set(IMJIN_GFLAGS.mingIn, day);
    pol.markGlobal();
    this.spawnForce(
      min,
      this.mingMuster(),
      MING_VANGUARD_DIVISIONS,
      MING_FORCE_EQUIP_PCT,
    );
    pol.messageAll("ww1936_imjin_ming_enters", {});
  }

  /** Ming's muster: its county on Joseon's border with the most points. */
  private mingMuster(): number {
    const sc = this.ww.scenario;
    const ctl = this.ww.land.controller;
    const legal = this.ww.politics.legalOwner;
    const min = this.min;
    let best = 0;
    let bestVp = -1;
    for (const r of sc.landRegions) {
      if (ctl[r.id] !== min) continue;
      if (!sc.regionNeighbours(r.id).some((n) => legal[n] === this.jos)) {
        continue;
      }
      if (r.vp > bestVp) {
        best = r.id;
        bestVp = r.vp;
      }
    }
    return best !== 0 ? best : this.ww.capitalRegion(min);
  }

  /** Hops from Japan's nearest county to Ming's land (99: farther than 3). */
  japanHopsToMing(): number {
    const sc = this.ww.scenario;
    const ctl = this.ww.land.controller;
    const min = this.min;
    const jpn = this.jpn;
    if (jpn === 0) return 99;
    let frontier: number[] = [];
    const seen = new Set<number>();
    for (const r of sc.landRegions) {
      if (ctl[r.id] === min) {
        frontier.push(r.id);
        seen.add(r.id);
      }
    }
    for (let h = 1; h <= 3 && frontier.length > 0; h++) {
      const next: number[] = [];
      for (const r of frontier) {
        for (const n of sc.regionNeighbours(r)) {
          if (seen.has(n)) continue;
          seen.add(n);
          const c = ctl[n];
          if (c === jpn || (c !== 0 && this.ww.land.sameSide(c, jpn))) {
            return h;
          }
          next.push(n);
        }
      }
      frontier = next;
    }
    return 99;
  }

  /** Ming divisions on Joseon's legal soil. */
  private mingAbroad(): number {
    const min = this.min;
    const legal = this.ww.politics.legalOwner;
    const t = this.ww.land.divisions;
    let n = 0;
    for (let row = 0; row < t.rows; row++) {
      if (t.id[row] === 0 || t.owner[row] !== min) continue;
      if (legal[t.region[row]] === this.jos) n++;
    }
    return n;
  }

  /**
   * `n` divisions of `owner`'s first template at `region`, as one army,
   * raised there with `equipPct`% of the template's first-generation gear
   * (as the 1936 uprising's, Occupation.spawnUprising).
   */
  private spawnForce(
    owner: number,
    region: number,
    n: number,
    equipPct: number,
  ): void {
    const land = this.ww.land;
    const cl = land.country(owner);
    const ce = land.econ.country(owner);
    const tpl = cl?.templates[0];
    if (region === 0 || cl === null || ce === null || tpl === undefined) return;
    const s = templateStats(
      tpl.def,
      ce.stats,
      genMixOf(new Array<number>(GROUND_SLOTS).fill(0)),
    );
    const slots = new Array<number>(GROUND_SLOTS).fill(0);
    EQUIPMENT_TYPES.forEach((type, i) => {
      const j = groundSlotOf(equipKey(type, 1));
      if (j >= 0 && s.need[i] > 0) {
        slots[j] = Math.floor((s.need[i] * equipPct) / 100);
      }
    });
    const org = templateStats(tpl.def, ce.stats, genMixOf(slots)).orgMilli;
    const army =
      land.newArmy(owner) ??
      land
        .armiesOf(owner)
        .sort((a, b) => a.id - b.id)
        .find((a) => a.divisions.length + n <= WW_MAX_ARMY_DIVISIONS) ??
      null;
    if (army === null) return;
    for (let i = 0; i < n; i++) {
      land.spawnDivision(owner, tpl.id, region, army, s.men, slots, org);
    }
  }

  // ---- Messages ----

  /** A result line to Joseon's player. */
  private tell(key: string, params: Record<string, string | number>): void {
    this.ww.endgame.message(this.jos, key, params);
  }

  // ---- Snapshot and hash ----

  snapshot(): ImjinJmState {
    return {
      lastDay: this.lastDay,
      seat: this.seat,
      seatRegion: this.seatRegion,
      askedSeat: this.askedSeat,
      holding: this.holding,
      askedMisc: this.askedMisc,
      shiftRival: this.shiftRival,
      shiftUntil: this.shiftUntil,
      held: this.held,
      warDay: this.warDay,
      leaders: [...this.leaders],
      bandRegion: [...this.bandRegion],
      commanded: this.commanded,
      monksCalled: this.monksCalled,
      templeSeen: [...this.templeSeen].sort((a, b) => a - b),
      raid: [...this.raid].sort((a, b) => a[0] - b[0]),
      meter: this.meter,
      suspicion: this.suspicion,
      mingStage: this.mingStage,
      demandDone: this.demandDone,
      northwestUntil: this.northwestUntil,
    };
  }

  restoreState(s: ImjinJmState): void {
    this.lastDay = s.lastDay;
    this.seat = s.seat;
    this.seatRegion = s.seatRegion;
    this.askedSeat = s.askedSeat;
    this.holding = s.holding;
    this.askedMisc = s.askedMisc;
    this.shiftRival = s.shiftRival;
    this.shiftUntil = s.shiftUntil;
    this.held = s.held;
    this.warDay = s.warDay;
    // Append only: a leader added later starts waiting.
    this.leaders = RIGHTEOUS_LEADERS.map((_, i) => s.leaders[i] ?? 0);
    this.bandRegion = RIGHTEOUS_LEADERS.map((_, i) => s.bandRegion[i] ?? 0);
    this.commanded = s.commanded;
    this.monksCalled = s.monksCalled;
    this.templeSeen = new Set(s.templeSeen);
    this.raid = new Map(s.raid.map(([r, pm]) => [r, pm]));
    this.meter = s.meter;
    this.suspicion = s.suspicion;
    this.mingStage = s.mingStage;
    this.demandDone = s.demandDone;
    this.northwestUntil = s.northwestUntil;
  }

  hash(): number {
    const s = this.snapshot();
    let h = 17;
    const f = (v: number | boolean) => {
      h = (Math.imul(h, 31) + (typeof v === "boolean" ? (v ? 1 : 0) : v)) | 0;
    };
    f(s.lastDay);
    f(s.seat);
    f(s.seatRegion);
    f(s.askedSeat);
    f(s.holding);
    f(s.askedMisc);
    f(s.shiftRival);
    f(s.shiftUntil);
    f(s.held);
    f(s.warDay);
    s.leaders.forEach(f);
    s.bandRegion.forEach(f);
    f(s.commanded);
    f(s.monksCalled);
    s.templeSeen.forEach(f);
    for (const [r, pm] of s.raid) {
      f(r);
      f(pm);
    }
    f(s.meter);
    f(s.suspicion);
    f(s.mingStage);
    f(s.demandDone);
    f(s.northwestUntil);
    return h >>> 0;
  }
}
