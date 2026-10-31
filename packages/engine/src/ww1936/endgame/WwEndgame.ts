// World War 1936 P5 (spec §21.1, §25.3; plan decisions 2–9, 14, 17–20):
// the endgame's state — dormant slots, country states, controllers, war
// records, the core table, occupation numbers, subjects, exiles, aid,
// conferences — its daily clock, its orders, its screen data, snapshot and
// hash. The lanes fill the functions this file calls (one file each); they
// read and write these fields and never keep copies of their own.
import { MessageType, PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  COUNTRIES,
  CountryTag,
  isDormantTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  RESOURCE_COUNT,
  WW_DAY_SPLIT,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  COUNTRY_STATES,
  CountryState,
  CS_ACTIVE,
  CS_DORMANT,
  MEMBER_STATES,
  MemberState,
  OCCUPATION_LAWS,
  OccupationLaw,
  SUBJECT_LEVELS,
  SubjectLevel,
  WAR_KINDS,
  WarLink,
  WW_CORE_SLOTS,
  WW_WAR_KEEP_DAYS,
  WwEndgameData,
  WwPeaceLogEntry,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { z } from "zod";
import type { Game } from "../../game/Game";
import type { WorldWar } from "../WorldWar";
import { aiAidDay, aiAidEventChoice } from "./AiAid";
import { aiOccupationDay } from "./AiOccupation";
import { aiSubjectsDay } from "./AiSubjects";
import { capitulate } from "./Capitulate";
import { conferenceView, stepConferences, submitDemands } from "./Conference";
import { wakePending } from "./Executions";
import {
  exileEconomy,
  exilePpFactorPct,
  resolveTakeovers,
  stepExile,
  takeoverPick,
} from "./Exile";
import { assignGarrisons } from "./Garrison";
import {
  aidEventOption,
  aidView,
  deliverLendLease,
  issueAid,
  stepLendLease,
  volunteerCanEnter,
} from "./LendLease";
import { returnLiberated } from "./Liberation";
import { aiLinePeaceDay, linePeaceData, offerLinePeace } from "./LinePeace";
import { peaceJudgeData } from "./NegPeace";
import {
  garrisonOrder,
  integrateRegion,
  occView,
  regionShareOf,
  setOccupationLaw,
  stepOccupation,
  supplyFactorOf,
} from "./Occupation";
import {
  onOverlordWar,
  startSubjects,
  stepSubject,
  subjectBlock,
  subjectEconomy,
  tradeCivFactorPct,
  upgradeChoice,
} from "./Subjects";
import {
  checkWarEnds,
  dailyWarScore,
  disarmBlockOf,
  reparationsEconomy,
  warSummary,
} from "./Wars";
import {
  aiPeaceDay,
  expirePeaceTimers,
  offerPeace,
  peaceOfferView,
  replyPeace,
  stepFronts,
  stepPeaceOffers,
  truceUntil,
} from "./WhitePeace";

const zIds = () => z.array(zInt());
const StoredDemandSchema = z.object({
  kind: zInt(),
  slot: zInt(),
  regions: zIds(),
  target: zInt(),
  beneficiary: zInt(),
  k: zInt(),
  pct: zInt(),
});
/** Plan decision 11: a demand as state (regions spelled out; DEMAND_KINDS index). */
export type StoredDemand = z.infer<typeof StoredDemandSchema>;
const SettledSchema = z.object({
  kind: zInt(),
  by: zInt(),
  regions: zIds(),
  target: zInt(),
  beneficiary: zInt(),
  k: zInt(),
  pct: zInt(),
  round: zInt(),
  cost: zInt(),
});
export type Settled = z.infer<typeof SettledSchema>;
const ConferenceSchema = z.object({
  id: zInt(),
  warIds: zIds(),
  losers: zIds(),
  stake: zIds(),
  base: zIds(),
  parts: z.array(
    z.object({ id: zInt(), wsMilli: zInt(), pts: zInt(), human: z.boolean() }),
  ),
  claims: z.array(z.tuple([zInt(), zInt()])),
  conquer: z.array(z.tuple([zInt(), zInt()])),
  topple: z.array(z.tuple([zInt(), zInt()])),
  /** 0 queued, 1 open, 2 done. */
  status: zInt(),
  /** The day it closed (status 2; -1 before): its wars go 30 days later (spec §4.2). */
  doneDay: zInt(),
  round: zInt(),
  roundEndTick: zInt(),
  openTick: zInt(),
  subs: z.array(
    z.object({
      id: zInt(),
      demands: z.array(StoredDemandSchema),
      passed: z.boolean(),
    }),
  ),
  ai: z.array(z.object({ id: zInt(), demands: z.array(StoredDemandSchema) })),
  settled: z.array(SettledSchema),
  lastRound: z.array(
    z.object({
      by: zInt(),
      kind: zInt(),
      regions: zIds(),
      target: zInt(),
      ok: z.boolean(),
    }),
  ),
});
export type Conference = z.infer<typeof ConferenceSchema>;
const WarSchema = z.object({
  id: zInt(),
  kind: z.enum(WAR_KINDS),
  startDay: zInt(),
  sides: z
    .array(
      z.object({
        leader: zInt(),
        members: z.array(
          z.object({
            id: zInt(),
            state: z.enum(MEMBER_STATES),
            joinedDay: zInt(),
            wsMilli: zInt(),
          }),
        ),
      }),
    )
    .length(2),
  goal: z.object({ type: z.string(), group: z.string() }).nullable(),
  ended: z.object({ day: zInt(), winner: zInt() }).nullable(),
});
const SubjectSchema = z.object({
  subject: zInt(),
  overlord: zInt(),
  /** SUBJECT_LEVELS index. */
  level: zInt(),
  autBp: zInt(),
  neutral: z.boolean(),
  deniedDay: zInt(),
  tightenUntil: zInt(),
  lastDelta: zInt(),
  suspended: z.boolean(),
  flowRes: zIds(),
  flowCiv: zInt(),
  flowMp: zInt(),
  /** Production cost of equipment received from the overlord today (A adds, S reads and clears). */
  llToday: zInt(),
});
export type Subject = z.infer<typeof SubjectSchema>;
const ExileSchema = z.object({
  smallID: zInt(),
  host: zInt(),
  legitBp: zInt(),
  sinceDay: zInt(),
  zeroDays: zInt(),
  lastDelta: zInt(),
  /** P3 faction index at exile time (takeover candidates, spec §11.2); -1: none. */
  faction: zInt(),
  capital: zInt(),
});
export type Exile = z.infer<typeof ExileSchema>;
const LendLeaseSchema = z.object({
  id: zInt(),
  from: zInt(),
  to: zInt(),
  item: z.string(),
  gen: zInt(),
  perMonth: zInt(),
  sentMilli: zInt(),
  startDay: zInt(),
  blocked: z.string().nullable(),
  monthStart: zInt(),
  sentMonth: zInt(),
  arrivedMonth: zInt(),
  route: zInt(),
  /** P5 lane A (review fix round): opened by the aid AI, which sizes it; content and request contracts keep theirs. */
  ai: z.boolean().optional(),
});
export type LendLease = z.infer<typeof LendLeaseSchema>;
const InTransitSchema = z.object({
  contract: zInt(),
  from: zInt(),
  to: zInt(),
  item: z.string(),
  gen: zInt(),
  countMilli: zInt(),
  arriveDay: zInt(),
  srs: zIds(),
  sea: z.boolean(),
  costMilli: zInt(),
});
export type InTransit = z.infer<typeof InTransitSchema>;
/** Negotiated peace (NegPeace.ts): an offer's terms (EndgameTypes.WwPeaceTerms). */
const PeaceTermsSchema = z.object({
  give: zIds(),
  take: zIds(),
  pay: zInt(),
  demand: zInt(),
  free: zIds(),
});
/** White peace (WhitePeace.ts): a pending offer. */
const PeaceOfferSchema = z.object({
  id: zInt(),
  war: zInt(),
  from: zInt(),
  to: zInt(),
  whole: z.boolean(),
  sentTick: zInt(),
  /** A human target's deadline (an AI target answers on the next tick). */
  deadlineTick: zInt(),
  /** Negotiated peace: the terms (absent: a white peace; older snapshots have none). */
  terms: PeaceTermsSchema.optional(),
  /** Peace on the current line (LinePeace.ts): true; absent for the other kinds. */
  line: z.literal(true).optional(),
});
export type PeaceOffer = z.infer<typeof PeaceOfferSchema>;
export const WwEndgameStateSchema = z.object({
  gameID: z.string().max(64),
  lastCommonDay: zInt(),
  countryState: zIds(),
  nameKey: z.array(z.string().nullable()),
  nameArg: z.array(z.string().nullable()),
  /** 0xRRGGBB; -1: none. */
  color: zIds(),
  controllerOf: z.array(z.tuple([z.string(), zInt()])),
  /** clientID → its first country (MVP "now (first)"). */
  everHuman: z.array(z.tuple([z.string(), zInt()])),
  wars: z.array(WarSchema),
  nextWarId: zInt(),
  /** [a, b, war] in the order the pairs were made (the Map's order). */
  pairWar: z.array(z.tuple([zInt(), zInt(), zInt()])),
  conferences: z.array(ConferenceSchema),
  nextConfId: zInt(),
  peaceLog: z.array(
    z.object({
      day: zInt(),
      losers: zIds(),
      lines: z.array(
        z.object({
          key: z.string(),
          params: z.record(z.string(), z.union([z.string(), zInt()])),
        }),
      ),
    }),
  ),
  /** [region, holder1, holder2, holder3] for every region with a holder. */
  cores: z.array(z.tuple([zInt(), zInt(), zInt(), zInt()])),
  /** [region, resBp, compBp, sinceDay, compHighDays, uprisingDays, supDeci] where any is non-zero. */
  occ: z.array(
    z.tuple([zInt(), zInt(), zInt(), zInt(), zInt(), zInt(), zInt()]),
  ),
  occLaw: z.array(
    z.object({ by: zInt(), of: zInt(), law: zInt(), lockUntilDay: zInt() }),
  ),
  zones: z.array(
    z.object({ region: zInt(), holder: zInt(), untilDay: zInt() }),
  ),
  dmz: z.array(z.tuple([zInt(), zInt()])),
  subjects: z.array(SubjectSchema),
  exiles: z.array(ExileSchema),
  lendLease: z.array(LendLeaseSchema),
  inTransit: z.array(InTransitSchema),
  nextLlId: zInt(),
  volunteers: z.array(
    z.object({
      army: zInt(),
      from: zInt(),
      to: zInt(),
      sinceDay: zInt(),
      recall: z.boolean(),
    }),
  ),
  reparations: z.array(
    z.object({ from: zInt(), to: zInt(), k: zInt(), untilDay: zInt() }),
  ),
  disarm: z.array(z.tuple([zInt(), zInt()])),
  takeoverCards: z.array(
    z.object({
      client: z.string(),
      from: zInt(),
      candidates: zIds(),
      deadlineTick: zInt(),
      pick: zInt(),
    }),
  ),
  wakeQueue: zIds(),
  /** Daily one-line batches (spec §20.8): [to, kind, a, b, n]. Kinds: NOTE_KEYS. */
  dayNotes: z.array(z.tuple([zInt(), zInt(), zInt(), zInt(), zInt()])),
  /** P5 final lane: [smallID, victory points lost when it came back] (capitulationBase). */
  capBase: z.array(z.tuple([zInt(), zInt()])).optional(),
  /** White peace: pending offers (by id), refusal cooldowns [from, to, untilDay], truces [a, b, untilDay] (a < b), fronts [war, a, b, sinceDay]. */
  peaceOffers: z.array(PeaceOfferSchema).optional(),
  nextOfferId: zInt().optional(),
  peaceCooldowns: z.array(z.tuple([zInt(), zInt(), zInt()])).optional(),
  truces: z.array(z.tuple([zInt(), zInt(), zInt()])).optional(),
  fronts: z.array(z.tuple([zInt(), zInt(), zInt(), zInt()])).optional(),
});
export type WwEndgameState = z.infer<typeof WwEndgameStateSchema>;

/** What a day of subjects, reparations and exiles moves (plan decision 19). */
export interface EconAdjust {
  res: number[];
  civIn: number;
  civOut: number;
  manpower: number;
  virtualMil: number;
}

/** A plain-data deep copy (no host structuredClone in the engine). */
function cloneJson<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** spec §25.3. Lanes call these fields and methods; they never keep their own copies. */
/** WwEndgame.war's index: war id → position in the wars list (derived; see war()). */
const WAR_POS = new WeakMap<readonly WwWar[], Map<number, number>>();

export class WwEndgame {
  readonly size: number;
  readonly regionCap: number;
  gameID = "";
  lastCommonDay = -1;
  countryStateArr: Uint8Array;
  nameKey: (string | null)[];
  nameArg: (string | null)[];
  color: number[];
  controllerOf: [string, number][] = [];
  everHuman: [string, number][] = [];
  wars: WwWar[] = [];
  nextWarId = 1;
  pairWar = new Map<number, number>();
  conferences: Conference[] = [];
  nextConfId = 1;
  peaceLog: WwPeaceLogEntry[] = [];
  coreTable: Uint16Array;
  resBp: Int16Array;
  compBp: Int16Array;
  occSince: Int32Array;
  compHigh: Uint16Array;
  uprDays: Uint8Array;
  supDeci: Int32Array;
  occLaw: { by: number; of: number; law: number; lockUntilDay: number }[] = [];
  zones: { region: number; holder: number; untilDay: number }[] = [];
  dmz: [number, number][] = [];
  subjects: Subject[] = [];
  exiles: Exile[] = [];
  lendLease: LendLease[] = [];
  inTransit: InTransit[] = [];
  nextLlId = 1;
  volunteers: {
    army: number;
    from: number;
    to: number;
    sinceDay: number;
    recall: boolean;
  }[] = [];
  reparations: { from: number; to: number; k: number; untilDay: number }[] = [];
  disarm: [number, number][] = [];
  takeoverCards: {
    client: string;
    from: number;
    candidates: number[];
    deadlineTick: number;
    pick: number;
  }[] = [];
  wakeQueue: number[] = [];
  dayNotes: [number, number, number, number, number][] = [];
  /**
   * P5 final lane (the exile return loop): a country back from exile, or
   * revived, with the victory points it had lost when it came back, by
   * smallID. P0's capitulation check counts only what it loses after that
   * (Capitulation.checkCapitulations); a recovery lowers it, peace clears it.
   */
  capBase: [number, number][] = [];
  /** White peace (WhitePeace.ts): pending offers, by id. */
  peaceOffers: PeaceOffer[] = [];
  nextOfferId = 1;
  /** [from, to, untilDay]: `from` may not offer `to` again before untilDay. */
  peaceCooldowns: [number, number, number][] = [];
  /** [a, b, untilDay] (a < b): neither declares on the other before untilDay. */
  truces: [number, number, number][] = [];
  /** [war, regions side 0 holds of side 1, the other way, the day the front last moved]. */
  fronts: [number, number, number, number][] = [];

  // ---- Derived (DERIVED_FIELDS) ----
  /** smallID → clientID of its human controller (plan decision 7). */
  humanOf = new Map<number, string>();
  /** controller smallID → administered regions, ascending (plan decision 18). */
  adminByController = new Map<number, number[]>();
  adminSet = new Set<number>();
  /** By region: its administering controller, 0: not administered. */
  adminCtrlOf: Int32Array;
  adminDirty = true;
  subjectIdx = new Map<number, number>();
  exileIdx = new Map<number, number>();
  warsOfIdx = new Map<number, number[]>();
  endgameNews: { id: string; params: Record<string, string | number> }[] = [];
  dirtyCountries = new Set<number>();
  dirtyWars = false;
  dirtyConf = false;
  dirtyPeaceLog = false;
  dirtyCores = new Set<number>();
  dirtyOcc = new Set<number>();
  dirtySubjects = false;
  dirtyExiles = false;
  dirtyZones = false;
  dirtyAid = new Set<number>();
  dirtyControllers = false;
  dirtyTakeover = false;
  dirtyPeace = false;
  firstData = true;
  /** Negotiated peace (screens only): the day the judge rows were made, and the rows last sent (JSON). */
  judgeDay = -1;
  judgeSent = "";
  /** Peace on the current line (screens only): the day its rows were made, and the rows last sent (JSON). */
  lineDay = -1;
  lineSent = "";

  constructor(
    readonly mg: Game,
    readonly ww: WorldWar,
  ) {
    this.size = ww.scenario.countries.length + 1;
    let maxR = 0;
    for (const r of ww.scenario.landRegions) maxR = Math.max(maxR, r.id);
    this.regionCap = maxR + 1;
    this.countryStateArr = new Uint8Array(this.size);
    this.nameKey = new Array<string | null>(this.size).fill(null);
    this.nameArg = new Array<string | null>(this.size).fill(null);
    this.color = new Array<number>(this.size).fill(-1);
    this.coreTable = new Uint16Array(this.regionCap * WW_CORE_SLOTS);
    this.resBp = new Int16Array(this.regionCap);
    this.compBp = new Int16Array(this.regionCap);
    this.occSince = new Int32Array(this.regionCap);
    this.compHigh = new Uint16Array(this.regionCap);
    this.uprDays = new Uint8Array(this.regionCap);
    this.supDeci = new Int32Array(this.regionCap);
    this.adminCtrlOf = new Int32Array(this.regionCap);
  }

  /** Spec §3.1, §7.1, §9.4: country states, 1936 cores, starting subjects. */
  start(): void {
    const sc = this.ww.scenario;
    for (let id = 1; id < this.size; id++) {
      this.countryStateArr[id] = isDormantTag(sc.countries[id - 1])
        ? CS_DORMANT
        : CS_ACTIVE;
      this.dirtyCountries.add(id);
    }
    const owners = sc.ownerByRegion();
    for (const r of sc.landRegions)
      if (r.core) this.addCore(owners[r.id], r.id);
    const content = this.ww.politics.content;
    for (const c of content.cores) {
      const id = sc.smallIdOf(c.tag);
      if (id === 0) continue;
      for (const g of c.groups) {
        for (const r of content.groupIdx.get(g)?.regions ?? []) {
          this.addCore(id, r);
        }
      }
    }
    // Subjects.ts (S): spec §9.4's table.
    startSubjects(this);
    for (const p of this.mg.allPlayers()) {
      const c = p.clientID();
      if (p.type() === PlayerType.Human && c !== null) {
        this.everHuman.push([c, p.smallID()]);
      }
    }
    this.everHuman.sort(byClient);
    this.rebuildDerived();
  }

  setGameID(id: string): void {
    this.gameID = id;
  }

  // ---- Clock (spec §2.2; WorldWarExecution calls clock after politics.tick, tick after air.tick) ----

  clock(ticks: number): void {
    if (this.ww.inPrep(ticks)) return;
    const day = this.ww.day(ticks);
    if (day !== this.lastCommonDay) {
      this.lastCommonDay = day;
      this.dailyCommon(day, ticks);
    }
    const k = ticks - dayStartTick(day, this.ww.prepEndTick());
    if (k < 0 || k >= WW_DAY_SPLIT) return;
    for (let id = 1; id < this.size; id++) {
      if (id % WW_DAY_SPLIT === k) this.dailyCountry(id, day, ticks);
    }
  }

  /** Spec §2.2 order 2. */
  dailyCommon(day: number, tick: number): void {
    this.settleAdmin();
    returnLiberated(this, day, tick); // X: spec §5.3
    this.expireZones(day);
    dailyWarScore(this, day); // W: occupation points (spec §4.5)
    checkWarEnds(this, day, tick); // W: spec §4.4, opens conferences
    stepFronts(this, day); // white peace: the stalemate count
    expirePeaceTimers(this, day); // white peace: truces, cooldowns
    deliverLendLease(this, day); // A: spec §13.3
    this.dropOldWars(day);
    this.expireTimed(day);
  }

  /** Spec §2.2 order 3: smallID % 7 === k. */
  dailyCountry(id: number, day: number, tick: number): void {
    if (!this.isActor(id)) {
      // Nobody reads a country's notes once it stopped playing.
      this.dropDayNotes(id);
      return;
    }
    if (this.adminDirty) this.rebuildAdmin();
    stepOccupation(this, id, day); // O
    assignGarrisons(this, id, day); // O
    if (this.subjectIdx.has(id)) stepSubject(this, id, day); // S
    if (this.exileIdx.has(id)) stepExile(this, id, day); // X
    stepLendLease(this, id, day); // A
    if (!this.isHumanControlled(id)) {
      aiOccupationDay(this, id, day, tick); // O
      aiSubjectsDay(this, id, day, tick); // S
      aiAidDay(this, id, day, tick); // A
      aiPeaceDay(this, id, day, tick); // white peace
      aiLinePeaceDay(this, id, day, tick); // peace on the current line
    }
    this.flushDayNotes(id);
  }

  /** Spec §2.2 order 8. */
  tick(tick: number): void {
    stepConferences(this, tick); // W: deadlines, AI-only conferences (plan decision 33)
    resolveTakeovers(this, tick); // X
    stepPeaceOffers(this, tick); // white peace: AI answers, card deadlines
    wakePending(this, tick); // foundation: addCountryExecutions for wakeQueue
  }

  // ---- Orders (plan decision 10) ----

  issue(smallID: number, order: WwOrder, tick: number): WwOrderBlock | null {
    const day = this.ww.day(tick);
    switch (order.kind) {
      case "peace_submit":
        return submitDemands(this, smallID, order.conf, order.demands, tick);
      case "peace_pass":
        return submitDemands(this, smallID, order.conf, null, tick);
      case "occupation_law":
        return setOccupationLaw(this, smallID, order.of, order.law, day);
      case "integrate_region":
        return integrateRegion(this, smallID, order.region, day);
      case "lend_lease":
      case "lend_lease_cancel":
      case "lend_lease_request":
      case "volunteers_send":
      case "volunteers_recall":
      case "air_volunteers":
      case "ships_transfer":
        return issueAid(this, smallID, order, tick);
      case "takeover_pick":
        // Comes by clientID (takeoverPickBy); never from a country.
        return "no_takeover";
      case "army_garrison":
        return garrisonOrder(this, smallID, order.army, order.scope);
      case "peace_offer":
        return offerPeace(
          this,
          smallID,
          order.war,
          order.target,
          tick,
          order.terms,
        );
      case "peace_reply":
        return replyPeace(this, smallID, order.offer, order.accept, tick);
      case "line_peace_offer":
        return offerLinePeace(this, smallID, order.war, order.target, tick);
      default:
        return "bad_index";
    }
  }

  /**
   * takeover_pick (spec §11.3): by the sender's clientID, before any
   * player check (the human's country is gone; ExecutionManager routes it).
   */
  takeoverPickBy(
    client: string,
    pick: number,
    tick: number,
  ): WwOrderBlock | null {
    return takeoverPick(this, client, pick, tick);
  }

  // ---- Capitulation (plan decision 9) ----

  onCapitulated(loser: number, victor: number, tick: number): void {
    // P6 hook (plan decision 20): atomic bombs are never captured.
    const ce = this.ww.economy.country(loser);
    if (ce !== null) ce.stock[equipKey("atomic_bomb", 1)] = 0;
    capitulate(this, loser, victor, tick); // W (the foundation's stub mimics P0–P4)
  }

  // ---- War records (spec §4.2–§4.3, plan decision 8; foundation bodies) ----

  static pairKey(a: number, b: number, size: number): number {
    return Math.min(a, b) * size + Math.max(a, b);
  }
  war(id: number): WwWar | null {
    // Final perf lane: by an id → position index (derived, outside the
    // snapshot graph), checked on every read: a position that no longer
    // holds that id (wars added, ended or restored) rebuilds it, so the
    // answer is always the first war with that id, as find gave.
    let idx = WAR_POS.get(this.wars);
    let pos = idx?.get(id);
    if (pos === undefined || this.wars[pos]?.id !== id) {
      idx = new Map();
      for (let i = 0; i < this.wars.length; i++) {
        if (!idx.has(this.wars[i].id)) idx.set(this.wars[i].id, i);
      }
      WAR_POS.set(this.wars, idx);
      pos = idx.get(id);
    }
    return pos === undefined ? null : this.wars[pos];
  }
  warOfPair(a: number, b: number): number {
    return this.pairWar.get(WwEndgame.pairKey(a, b, this.size)) ?? 0;
  }
  warsOf(id: number): readonly number[] {
    return this.warsOfIdx.get(id) ?? [];
  }
  sideIndex(w: WwWar, id: number): 0 | 1 | -1 {
    if (w.sides[0].members.some((m) => m.id === id)) return 0;
    if (w.sides[1].members.some((m) => m.id === id)) return 1;
    return -1;
  }
  member(w: WwWar, id: number): WwWar["sides"][0]["members"][number] | null {
    const s = this.sideIndex(w, id);
    if (s === -1) return null;
    return w.sides[s].members.find((m) => m.id === id) ?? null;
  }
  /** Oldest ongoing war `id` belongs to (any state but left); 0 if none. */
  oldestWarOf(id: number): number {
    for (const w of this.wars) {
      if (w.ended !== null) continue;
      const m = this.member(w, id);
      if (m !== null && m.state !== "left") return w.id;
    }
    return 0;
  }
  /**
   * WorldWar.setWar, after the pair went in: its war record; returns the
   * war's id. "into": the pair joins that war (0: `b`'s oldest), the newcomer
   * on the side opposite the one already in it (a declaration's faction
   * chain brings `b` into `a`'s war; a join brings `a` into `b`'s). With
   * neither in it, or both on one side, it is a new war.
   */
  onWarPairCreated(a: number, b: number, link: WarLink, tick: number): number {
    const day = this.ww.inPrep(tick) ? 0 : this.ww.day(tick);
    let w: WwWar | null = null;
    if (link.kind === "into") {
      w = this.war(link.warId === 0 ? this.oldestWarOf(b) : link.warId);
    }
    const sa = w === null ? -1 : this.sideIndex(w, a);
    const sb = w === null ? -1 : this.sideIndex(w, b);
    if (
      w === null ||
      w.ended !== null ||
      (sa < 0 && sb < 0) ||
      (sa >= 0 && sa === sb)
    ) {
      w = {
        id: this.nextWarId++,
        kind: link.kind === "declare" ? (link.war ?? "normal") : "normal",
        startDay: day,
        sides: [
          { leader: a, members: [] },
          { leader: b, members: [] },
        ],
        goal:
          link.kind === "declare" && link.goal
            ? { type: link.goal.type, group: link.goal.group ?? "" }
            : null,
        ended: null,
      };
      this.wars.push(w);
      this.addMember(w, 0, a, day);
      this.addMember(w, 1, b, day);
    } else {
      for (const [x, sx, other] of [
        [a, sa, sb],
        [b, sb, sa],
      ] as const) {
        if (sx < 0) {
          this.addMember(w, (1 - other) as 0 | 1, x, day);
          continue;
        }
        const m = this.member(w, x)!;
        if (m.state === "left") m.state = this.isExile(x) ? "exiled" : "active";
      }
    }
    this.pairWar.set(WwEndgame.pairKey(a, b, this.size), w.id);
    this.rebuildWarIdx();
    this.dirtyWars = true;
    onOverlordWar(this, a, b, false, tick); // S: subjects follow (spec §9.1)
    onOverlordWar(this, b, a, true, tick);
    return w.id;
  }
  private addMember(w: WwWar, side: 0 | 1, id: number, day: number): void {
    w.sides[side].members.push({
      id,
      state: this.isExile(id) ? "exiled" : "active",
      joinedDay: day,
      wsMilli: 0,
    });
  }
  /** P3 end_war / P0 endWarsOf: the pair is gone; a member with no pair left in that war has left (spec §4.3). */
  onWarPairRemoved(a: number, b: number, _tick: number): void {
    const key = WwEndgame.pairKey(a, b, this.size);
    const wid = this.pairWar.get(key);
    if (wid === undefined) return;
    this.pairWar.delete(key);
    const w = this.war(wid);
    if (w !== null && w.ended === null) {
      for (const x of [a, b]) {
        const m = this.member(w, x);
        if (m === null || m.state !== "active") continue;
        let left = true;
        for (const [k, v] of this.pairWar) {
          if (
            v === wid &&
            (Math.floor(k / this.size) === x || k % this.size === x)
          ) {
            left = false;
          }
        }
        if (left) m.state = "left";
      }
      this.fixLeader(w);
    }
    this.rebuildWarIdx();
    this.dirtyWars = true;
  }
  /**
   * P3 joinFaction (pre-flight §0-6): into every ongoing war a faction
   * member fights, against the other side's fighting members (active or
   * exiled), each pair in that war's record.
   */
  onFactionJoined(id: number, tick: number): void {
    const fid = this.ww.politics.factionIdx(id);
    if (fid < 0) return;
    const fights = (s: MemberState) => s === "active" || s === "exiled";
    for (const w of [...this.wars]) {
      if (w.ended !== null) continue;
      for (const s of [0, 1] as const) {
        const ours = w.sides[s].members.some(
          (m) =>
            m.id !== id &&
            fights(m.state) &&
            this.ww.politics.factionIdx(m.id) === fid,
        );
        if (!ours) continue;
        for (const e of w.sides[1 - s].members) {
          if (e.id === id || !fights(e.state) || this.ww.isAtWar(id, e.id)) {
            continue;
          }
          if (!this.ww.isActor(e.id)) continue;
          this.ww.setWar(id, e.id, tick, { kind: "into", warId: w.id });
        }
      }
    }
  }
  setMemberState(warId: number, id: number, state: MemberState): void {
    const w = this.war(warId);
    const m = w === null ? null : this.member(w, id);
    if (m === null || w === null) return;
    m.state = state;
    this.fixLeader(w);
    this.dirtyWars = true;
  }
  /** Spec §4.3 last row: an inactive leader passes to the active member with most factories (ties smallID). */
  fixLeader(w: WwWar): void {
    for (const side of w.sides) {
      if (
        side.members.some((m) => m.id === side.leader && m.state === "active")
      ) {
        continue;
      }
      let best = 0;
      let bestF = -1;
      for (const m of side.members) {
        if (m.state !== "active") continue;
        const f = this.factoriesOf(m.id);
        if (f > bestF || (f === bestF && m.id < best)) {
          best = m.id;
          bestF = f;
        }
      }
      if (best !== 0) side.leader = best;
    }
  }
  factoriesOf(id: number): number {
    const ce = this.ww.economy.country(id);
    return ce === null ? 0 : ce.totals.civ + ce.totals.mil;
  }
  private rebuildWarIdx(): void {
    this.warsOfIdx.clear();
    for (const w of this.wars) {
      for (const s of w.sides) {
        for (const m of s.members) {
          const l = this.warsOfIdx.get(m.id);
          if (l === undefined) this.warsOfIdx.set(m.id, [w.id]);
          else l.push(w.id);
        }
      }
    }
  }
  /**
   * Spec §4.2: an ended war goes 30 days after the conference that settled
   * it closed (after its end when none did); never while one is queued or
   * open.
   */
  private dropOldWars(day: number): void {
    const kept = this.wars.filter((w) => {
      if (w.ended === null) return true;
      let since = w.ended.day;
      for (const c of this.conferences) {
        if (!c.warIds.includes(w.id)) continue;
        if (c.status !== 2) return true;
        since = Math.max(since, c.doneDay);
      }
      return day - since <= WW_WAR_KEEP_DAYS;
    });
    if (kept.length !== this.wars.length) {
      this.wars = kept;
      this.rebuildWarIdx();
      this.dirtyWars = true;
    }
  }

  /** White peace: the day the truce between `a` and `b` ends (0: none). */
  truceUntil(a: number, b: number): number {
    return truceUntil(this, a, b);
  }

  // ---- Capitulation baseline (P5 final lane, the exile return loop) ----

  /** Victory points `id` had lost when it came back (0: none). */
  capitulationBase(id: number): number {
    return this.capBase.find(([x]) => x === id)?.[1] ?? 0;
  }
  setCapitulationBase(id: number, lostVp: number): void {
    const kept = this.capBase.filter(([x]) => x !== id);
    if (lostVp > 0) kept.push([id, lostVp]);
    this.capBase = kept.sort((a, b) => a[0] - b[0]);
  }

  // ---- Countries, actors, controllers (plan decisions 6, 7) ----

  countryState(id: number): CountryState {
    return COUNTRY_STATES[this.countryStateArr[id] ?? CS_DORMANT];
  }
  setCountryState(id: number, s: number): void {
    if (this.countryStateArr[id] === s) return;
    this.countryStateArr[id] = s;
    this.dirtyCountries.add(id);
  }
  /** Plan decision 6: plays its turns (active, alive, not capitulated), or an exile. */
  isActor(id: number): boolean {
    if (this.exileIdx.has(id)) return true;
    if (this.countryStateArr[id] !== CS_ACTIVE || this.ww.isCapitulated(id)) {
      return false;
    }
    const p = this.mg.playerBySmallID(id);
    return p.isPlayer() && p.isAlive();
  }
  isHumanControlled(id: number): boolean {
    return this.humanOf.has(id);
  }
  humanClientOf(id: number): string | null {
    return this.humanOf.get(id) ?? null;
  }
  /** The country `client` controls after a takeover (0: spectating); null: its own (never moved). */
  controlledBy(client: string): number | null {
    for (const [c, id] of this.controllerOf) if (c === client) return id;
    return null;
  }
  /** Takeover (spec §11.3) and spectating (0). */
  setControl(client: string, smallID: number): void {
    this.controllerOf = this.controllerOf.filter(([c]) => c !== client);
    this.controllerOf.push([client, smallID]);
    this.controllerOf.sort(byClient);
    const before = new Set(this.humanOf.keys());
    this.rebuildHumans();
    this.dirtyControllers = true;
    // The difficulty's AI handicap follows the control (AiDifficulty): the
    // countries that changed hands get their stats again, in id order.
    const flipped = new Set(before);
    for (const id of this.humanOf.keys()) {
      if (before.has(id)) flipped.delete(id);
      else flipped.add(id);
    }
    for (const id of [...flipped].sort((a, b) => a - b)) {
      this.ww.politics.recomputeStats(id);
      // Automation: the AI runs the one it was given; the human starts
      // its new country with every switch off.
      this.ww.clearAuto(id);
    }
  }
  /** Plan decision 7: the human players' own countries, then the moved controllers. */
  rebuildHumans(): void {
    this.humanOf.clear();
    const moved = new Set(this.controllerOf.map(([c]) => c));
    for (const p of this.mg.allPlayers()) {
      const c = p.clientID();
      if (p.type() === PlayerType.Human && c !== null && !moved.has(c)) {
        this.humanOf.set(p.smallID(), c);
      }
    }
    for (const [c, id] of this.controllerOf)
      if (id > 0) this.humanOf.set(id, c);
  }
  displayNameKey(id: number): string | null {
    return this.nameKey[id];
  }
  /**
   * The capital region of a country: its scenario capital, else (a woken
   * dormant slot) the controlled region with the most victory points (ties:
   * the smaller id), an exile's recorded capital; 0 when none.
   */
  capitalRegion(id: number): number {
    const sc = this.ww.scenario;
    const tag = sc.tagOfSmallId(id);
    if (tag === undefined) return 0;
    const tile = sc.capitalTileOrNull(tag);
    if (tile !== null) return sc.regionAt(tile);
    const ex = this.exileIdx.get(id);
    if (ex !== undefined && this.exiles[ex].capital > 0) {
      return this.exiles[ex].capital;
    }
    let best = 0;
    let bestVp = -1;
    for (const r of sc.landRegions) {
      if (this.ww.land.controller[r.id] !== id) continue;
      if (r.vp > bestVp) {
        best = r.id;
        bestVp = r.vp;
      }
    }
    return best;
  }

  // ---- Exiles, subjects, side (plan decision 20) ----

  isExile(id: number): boolean {
    return this.exileIdx.has(id);
  }
  exileHost(id: number): number {
    const i = this.exileIdx.get(id);
    return i === undefined ? 0 : this.exiles[i].host;
  }
  /** P2 side owner: an exile fights as its host. */
  sideOwner(id: number): number {
    const h = this.exileHost(id);
    return h > 0 ? h : id;
  }
  subjectOf(
    id: number,
  ): { overlord: number; level: SubjectLevel; neutral: boolean } | null {
    const i = this.subjectIdx.get(id);
    if (i === undefined) return null;
    const s = this.subjects[i];
    return {
      overlord: s.overlord,
      level: SUBJECT_LEVELS[s.level],
      neutral: s.neutral,
    };
  }
  subjectsOf(overlord: number): number[] {
    return this.subjects
      .filter((s) => s.overlord === overlord)
      .map((s) => s.subject)
      .sort((a, b) => a - b);
  }

  // ---- Cores (spec §7, plan decision 17; foundation bodies) ----

  coreHolders(region: number): number[] {
    const out: number[] = [];
    if (region <= 0 || region >= this.regionCap) return out;
    for (let k = 0; k < WW_CORE_SLOTS; k++) {
      const v = this.coreTable[region * WW_CORE_SLOTS + k];
      if (v !== 0) out.push(v);
    }
    return out;
  }
  hasCore(id: number, region: number): boolean {
    if (id <= 0 || region <= 0 || region >= this.regionCap) return false;
    for (let k = 0; k < WW_CORE_SLOTS; k++) {
      if (this.coreTable[region * WW_CORE_SLOTS + k] === id) return true;
    }
    return false;
  }
  /** Spec §7.2: full slots push out the smallest-smallID gone (dormant first) holder; none gone → no add. */
  addCore(id: number, region: number): void {
    if (id <= 0 || region <= 0 || region >= this.regionCap) return;
    if (this.hasCore(id, region)) return;
    let h = this.coreHolders(region);
    if (h.length >= WW_CORE_SLOTS) {
      const out = h
        .filter(
          (x) => this.countryStateArr[x] !== CS_ACTIVE && !this.isExile(x),
        )
        .sort(
          (a, b) =>
            Number(this.countryStateArr[b] === CS_DORMANT) -
              Number(this.countryStateArr[a] === CS_DORMANT) || a - b,
        )[0];
      if (out === undefined) return;
      h = h.filter((x) => x !== out);
    }
    h.push(id);
    this.writeCores(region, h);
  }
  removeCore(id: number, region: number): void {
    if (!this.hasCore(id, region)) return;
    this.writeCores(
      region,
      this.coreHolders(region).filter((x) => x !== id),
    );
  }
  private writeCores(region: number, h: number[]): void {
    this.writeCoresRaw(region, h);
    this.dirtyCores.add(region);
    this.markControlChanged(region);
  }
  private writeCoresRaw(region: number, h: number[]): void {
    const s = [...h].sort((a, b) => a - b);
    for (let k = 0; k < WW_CORE_SLOTS; k++) {
      this.coreTable[region * WW_CORE_SLOTS + k] = s[k] ?? 0;
    }
  }

  // ---- Occupation queries (spec §8.1; O fills the shares) ----

  /**
   * Spec §8.1 (pre-flight §0-3): the controller holds no core there,
   * someone else does, and it is occupied (controller ≠ legal owner) or
   * taken (the legal owner changed since 1936) — never a colony held since
   * 1936 (the US Philippines), never a region without another core.
   */
  computeAdministered(region: number): boolean {
    const c = this.ww.land.controller[region] ?? 0;
    if (c === 0 || region <= 0 || region >= this.regionCap) return false;
    let other = false;
    for (let k = 0; k < WW_CORE_SLOTS; k++) {
      const h = this.coreTable[region * WW_CORE_SLOTS + k];
      if (h === c) return false;
      if (h !== 0) other = true;
    }
    if (!other) return false;
    const legal = this.ww.politics.legalOwner[region] ?? 0;
    return c !== legal || legal !== this.ww.scenario.ownerByRegion()[region];
  }
  isAdministered(region: number): boolean {
    if (this.adminDirty) this.rebuildAdmin();
    return this.adminSet.has(region);
  }
  administeredOf(controller: number): readonly number[] {
    if (this.adminDirty) this.rebuildAdmin();
    return this.adminByController.get(controller) ?? [];
  }
  /**
   * Called by P2 setController, P3 setLegalOwner (foundation hooks) and core
   * changes: that region's administered state again (one region, not the
   * map: control changes every tick of a war).
   */
  markControlChanged(region: number): void {
    this.dirtyOcc.add(region);
    if (this.adminDirty || region <= 0 || region >= this.regionCap) return;
    const was = this.adminCtrlOf[region];
    const now = this.computeAdministered(region)
      ? this.ww.land.controller[region]
      : 0;
    if (was === now) return;
    // HOI4: a new occupier starts from nothing; leaving administration ends it.
    if (now === 0 || was !== 0) this.clearOcc(region);
    if (was !== 0) {
      const l = this.adminByController.get(was) ?? [];
      const kept = l.filter((r) => r !== region);
      if (kept.length === 0) this.adminByController.delete(was);
      else this.adminByController.set(was, kept);
      this.adminSet.delete(region);
    }
    if (now !== 0) {
      const l = [...(this.adminByController.get(now) ?? []), region];
      this.adminByController.set(
        now,
        l.sort((a, b) => a - b),
      );
      this.adminSet.add(region);
    }
    this.adminCtrlOf[region] = now;
  }
  /** The administered regions again (derived only: never changes state). */
  rebuildAdmin(): void {
    this.adminSet.clear();
    this.adminByController.clear();
    this.adminCtrlOf.fill(0);
    for (const r of this.ww.scenario.landRegions) {
      if (!this.computeAdministered(r.id)) continue;
      this.adminSet.add(r.id);
      const c = this.ww.land.controller[r.id];
      this.adminCtrlOf[r.id] = c;
      const l = this.adminByController.get(c);
      if (l === undefined) this.adminByController.set(c, [r.id]);
      else l.push(r.id);
    }
    this.adminDirty = false;
  }
  /** The day's common step: a region no longer administered forgets its occupation numbers. */
  private settleAdmin(): void {
    if (this.adminDirty) this.rebuildAdmin();
    for (let r = 1; r < this.regionCap; r++) {
      if (this.adminSet.has(r)) continue;
      if (
        this.occSince[r] !== 0 ||
        this.resBp[r] !== 0 ||
        this.compBp[r] !== 0 ||
        this.compHigh[r] !== 0 ||
        this.uprDays[r] !== 0 ||
        this.supDeci[r] !== 0
      ) {
        this.clearOcc(r);
      }
    }
  }
  clearOcc(region: number): void {
    this.resBp[region] = 0;
    this.compBp[region] = 0;
    this.occSince[region] = 0;
    this.compHigh[region] = 0;
    this.uprDays[region] = 0;
    this.supDeci[region] = 0;
    this.dirtyOcc.add(region);
  }
  /** P1 hook: null = the P1 rule (not administered). */
  regionShare(
    region: number,
  ): { factoryPct: number; resourcePct: number; manpowerPct: number } | null {
    return this.isAdministered(region) ? regionShareOf(this, region) : null;
  }
  /** P2 supply hook, permille (spec §8.6). */
  supplyFactorPm(region: number): number {
    return this.isAdministered(region) ? supplyFactorOf(this, region) : 1000;
  }
  occupationLawOf(by: number, of: number): OccupationLaw {
    const e =
      this.occLaw.find((x) => x.by === by && x.of === of) ??
      this.occLaw.find((x) => x.by === by && x.of === 0);
    return e === undefined ? "occ_military" : OCCUPATION_LAWS[e.law];
  }
  isZone(region: number): boolean {
    return this.zones.some((z) => z.region === region);
  }
  zoneHolder(region: number): number {
    return this.zones.find((z) => z.region === region)?.holder ?? 0;
  }
  private expireZones(day: number): void {
    const kept = this.zones.filter((z) => z.untilDay < 0 || z.untilDay > day);
    if (kept.length !== this.zones.length) {
      this.zones = kept;
      this.dirtyZones = true;
    }
  }
  /** Spec §6.4 demilitarise: `smallID` may not enter (or fortify) `region`. */
  isDmz(region: number, smallID: number): boolean {
    if (this.dmz.length === 0) return false;
    return this.dmz.some(([r, of]) => r === region && of === smallID);
  }
  private expireTimed(day: number): void {
    this.reparations = this.reparations.filter((x) => x.untilDay > day);
    this.disarm = this.disarm.filter(([, until]) => until > day);
  }

  // ---- Hooks the earlier phases read (foundation inserts the calls; lanes fill the bodies) ----

  /** P1 refreshTotals (plan decision 19): what flows in and out today. */
  econAdjust(id: number): EconAdjust {
    const out: EconAdjust = {
      res: new Array<number>(RESOURCE_COUNT).fill(0),
      civIn: 0,
      civOut: 0,
      manpower: 0,
      virtualMil: 0,
    };
    subjectEconomy(this, id, out); // S
    reparationsEconomy(this, id, out); // W
    exileEconomy(this, id, out); // X
    return out;
  }
  /** P2 train / P4 naval lines, dock builds (spec §6.4 disarm). */
  disarmBlock(
    id: number,
    what: "train" | "naval" | "dock",
  ): WwOrderBlock | null {
    return disarmBlockOf(this, id, what); // W
  }
  /** P3 daily political power, percent (spec §10.4: 50..100 for an exile). */
  ppFactorPct(id: number): number {
    return this.isExile(id) ? exilePpFactorPct(this, id) : 100; // X
  }
  /** P3 order handlers (spec §9.1). */
  subjectBlock(
    id: number,
    action: "declare" | "justify" | "faction" | "treaty" | "leave_faction",
  ): boolean {
    return subjectBlock(this, id, action); // S
  }
  /** P1 trade: percent of the civilian-factory cost (spec §9.1 dominion −50%). */
  tradeCivFactorPct(buyer: number, seller: number): number {
    return tradeCivFactorPct(this, buyer, seller); // S
  }
  /** P2 canArmyEnter for an army with volunteerFor (spec §12.2). */
  volunteerCanEnter(army: number, region: number): boolean {
    return volunteerCanEnter(this, army, region); // A
  }
  /** P3 events: after the applied option's effects (plan decision 38). */
  onEventOption(
    eventId: string,
    optionId: string,
    self: number,
    from: number,
    tick: number,
  ): void {
    aidEventOption(this, eventId, optionId, self, from, tick); // A
  }
  /**
   * P3 aiChooseOption (pre-flight §A A): the endgame's own answer for an AI
   * receiver (gen_diplo_lend_lease by llRequestScore), or null for P3's.
   */
  aiEventChoice(eventId: string, self: number, from: number): string | null {
    return (
      upgradeChoice(this, eventId, self) ?? // S
      aiAidEventChoice(this, eventId, self, from) // A
    );
  }

  // ---- News, messages, daily notes ----

  news(id: string, params: Record<string, string | number>): void {
    this.endgameNews.push({ id, params });
  }
  message(
    to: number,
    key: string,
    params: Record<string, string | number>,
  ): void {
    if (!this.isHumanControlled(to)) return;
    const p = this.mg.playerBySmallID(to);
    if (!p.isPlayer()) return;
    this.mg.displayMessage(
      `events_display.${key}`,
      MessageType.WORLD_WAR,
      p.id(),
      undefined,
      params,
    );
  }
  messageAll(key: string, params: Record<string, string | number>): void {
    this.mg.displayMessage(
      `events_display.${key}`,
      MessageType.WORLD_WAR,
      null,
      undefined,
      params,
    );
  }
  note(to: number, kind: number, a: number, b: number, n: number): void {
    const e = this.dayNotes.find(
      (x) => x[0] === to && x[1] === kind && x[2] === a && x[3] === b,
    );
    if (e !== undefined) e[4] += n;
    else this.dayNotes.push([to, kind, a, b, n]);
  }
  private dropDayNotes(id: number): void {
    if (this.dayNotes.some((x) => x[0] === id)) {
      this.dayNotes = this.dayNotes.filter((x) => x[0] !== id);
    }
  }
  /** One line per (country, kind) a day (spec §20.8). The lanes give the message text through NOTE_KEYS. */
  private flushDayNotes(id: number): void {
    if (this.dayNotes.length === 0) return;
    const mine = this.dayNotes.filter((x) => x[0] === id);
    if (mine.length === 0) return;
    this.dayNotes = this.dayNotes.filter((x) => x[0] !== id);
    for (const kind of [NOTE_CAPTURE, NOTE_LL, NOTE_GARRISON]) {
      const rows = mine.filter((x) => x[1] === kind);
      if (rows.length === 0) continue;
      const items = rows.map((x) => `${x[2]}:${x[3]}:${x[4]}`).join(",");
      this.message(id, NOTE_KEYS[kind], {
        ...this.noteArgs(kind, rows),
        items,
      });
    }
  }
  /**
   * P5 lane A (controller ruling): a batch's own params (NOTE_ARGS) — the
   * value of the named column in its biggest row (ties: the first), a
   * country column as its tag.
   */
  private noteArgs(
    kind: number,
    rows: readonly (readonly number[])[],
  ): Record<string, string | number> {
    const arg = NOTE_ARGS[kind];
    if (arg === null || arg === undefined) return {};
    let top = rows[0];
    for (const x of rows) if (x[4] > top[4]) top = x;
    const v = top[arg.col];
    return { [arg.param]: arg.country ? this.ww.tagOf(v) : v };
  }

  // ---- Screens, snapshot, hash ----

  takeData(): WwEndgameData | null {
    const first = this.firstData;
    const d: WwEndgameData = { news: this.endgameNews };
    if (first || this.dirtyCountries.size > 0) {
      const ids = first
        ? [...Array(this.size - 1).keys()].map((i) => i + 1)
        : [...this.dirtyCountries].sort((a, b) => a - b);
      d.countries = ids.map((id) => ({
        smallID: id,
        state: this.countryState(id),
        nameKey: this.nameKey[id],
        nameArg: (this.nameArg[id] as CountryTag | null) ?? null,
        color: this.color[id] < 0 ? null : this.color[id],
        flag: this.flagOf(id),
      }));
    }
    if (first || this.dirtyControllers) {
      d.controllers = this.controllerOf.map(([c, i]) => [c, i]);
    }
    if (first || this.dirtyWars)
      d.wars = this.wars.map((w) => warSummary(this, w));
    if (first || this.dirtyConf) {
      const open =
        this.conferences.find(
          (c) => c.status === 1 && c.parts.some((p) => p.human),
        ) ?? null;
      d.conference = open === null ? null : conferenceView(this, open.id);
      d.queuedConferences = this.conferences.filter(
        (c) => c.status === 0,
      ).length;
    }
    if (first || this.dirtyPeaceLog) d.peaceLog = this.peaceLog;
    // The first update (a start, or a restored game's new screens) sends
    // the whole occupation, core and aid picture, not the changes.
    if (first || this.dirtyOcc.size > 0) {
      const occIds = first
        ? [...Array(this.regionCap).keys()].filter((r) =>
            this.isAdministered(r),
          )
        : [...this.dirtyOcc].sort((a, b) => a - b);
      const shown = occIds.filter(
        (r) =>
          this.isAdministered(r) &&
          (this.isHumanControlled(this.ww.land.controller[r]) ||
            this.coreHolders(r).some((h) => this.isHumanControlled(h))),
      );
      d.occupation = shown.map((r) => ({
        ...occView(this, r),
        compHighDays: this.compHigh[r],
      }));
      // A changed region without a row now: the screens drop its old one.
      if (!first) {
        const gone = occIds.filter((r) => r > 0 && !shown.includes(r));
        if (gone.length > 0) d.occupationGone = gone;
      }
      d.occLaws = this.occLaw.map((x) => ({
        by: x.by,
        of: x.of,
        law: OCCUPATION_LAWS[x.law],
        lockUntilDay: x.lockUntilDay,
      }));
    }
    if (first || this.dirtyCores.size > 0) {
      // First: every region with a core now or in the scenario (one whose
      // cores all went must not fall back to the scenario's on the screens).
      const sc = this.ww.scenario;
      const coreIds = first
        ? [...Array(this.regionCap).keys()].filter(
            (r) =>
              r > 0 &&
              (this.coreHolders(r).length > 0 || sc.region(r)?.core === true),
          )
        : [...this.dirtyCores].sort((a, b) => a - b);
      d.coreChanges = coreIds.map((r) => ({
        region: r,
        holders: this.coreHolders(r),
      }));
    }
    if (first || this.dirtyZones) d.zones = this.zones.map((z) => ({ ...z }));
    if (first || this.dirtySubjects) {
      d.subjects = this.subjects.map((s) => ({
        subject: s.subject,
        overlord: s.overlord,
        level: SUBJECT_LEVELS[s.level],
        autBp: s.autBp,
        deltaBp: s.lastDelta,
        neutral: s.neutral,
      }));
    }
    if (first || this.dirtyExiles) {
      d.exiles = this.exiles.map((e) => ({
        smallID: e.smallID,
        host: e.host,
        legitBp: e.legitBp,
        deltaBp: e.lastDelta,
        virtualMil: Math.floor(e.legitBp / 1000),
        capital: e.capital,
      }));
    }
    if (first || this.dirtyAid.size > 0) {
      const aidIds = first
        ? [...Array(this.size).keys()].filter((id) => id > 0)
        : [...this.dirtyAid].sort((a, b) => a - b);
      d.aid = aidIds
        .filter((id) => this.isHumanControlled(id))
        .map((id) => aidView(this, id));
    }
    if (first || this.dirtyTakeover) {
      d.takeover = this.takeoverCards.map((c) => ({
        client: c.client,
        from: c.from,
        candidates: [...c.candidates],
        deadlineTick: c.deadlineTick,
      }));
    }
    // A pending line offer's card shows the line as it is today.
    const lineCard =
      this.lineDay !== this.lastCommonDay &&
      this.peaceOffers.some((o) => o.line === true);
    if (first || this.dirtyPeace || lineCard) {
      d.peaceOffers = this.peaceOffers.map((o) => peaceOfferView(this, o));
      d.peaceCooldowns = this.peaceCooldowns.map(
        ([a, b, u]): [number, number, number] => [a, b, u],
      );
      d.truces = this.truces.map(([a, b, u]): [number, number, number] => [
        a,
        b,
        u,
      ]);
    }
    // Negotiated peace: the judge's war facts for the humans' offers (the
    // composer's hint), once a day and when the wars change; sent on change.
    const judge = peaceJudgeData(this, first);
    if (judge !== null) d.peaceJudge = judge;
    // Peace on the current line: the humans' possible offers, settled now.
    const line = linePeaceData(this, first);
    if (line !== null) d.linePeace = line;
    const empty = Object.keys(d).length === 1 && d.news.length === 0;
    this.endgameNews = [];
    this.firstData = false;
    this.dirtyCountries.clear();
    this.dirtyWars = false;
    this.dirtyConf = false;
    this.dirtyPeaceLog = false;
    this.dirtyCores.clear();
    this.dirtyOcc.clear();
    this.dirtySubjects = false;
    this.dirtyExiles = false;
    this.dirtyZones = false;
    this.dirtyAid.clear();
    this.dirtyControllers = false;
    this.dirtyTakeover = false;
    this.dirtyPeace = false;
    return empty ? null : d;
  }

  /** Spec §3.5: a named civil-war slot flies its ideology's flag. */
  flagOf(id: number): string {
    const tag = this.ww.tagOf(id);
    if (this.nameKey[id] !== null && tag.startsWith("CW")) {
      const ruling = this.ww.politics.country(id)?.ruling ?? -1;
      return `ww_cw_${IDEOLOGIES[ruling] ?? "neutral"}`;
    }
    return COUNTRIES[tag].flag;
  }

  snapshot(): WwEndgameState {
    const cores: [number, number, number, number][] = [];
    for (let r = 1; r < this.regionCap; r++) {
      const h = this.coreHolders(r);
      if (h.length > 0) cores.push([r, h[0] ?? 0, h[1] ?? 0, h[2] ?? 0]);
    }
    const occ: [number, number, number, number, number, number, number][] = [];
    for (let r = 1; r < this.regionCap; r++) {
      if (
        this.resBp[r] !== 0 ||
        this.compBp[r] !== 0 ||
        this.occSince[r] !== 0 ||
        this.compHigh[r] !== 0 ||
        this.uprDays[r] !== 0 ||
        this.supDeci[r] !== 0
      ) {
        occ.push([
          r,
          this.resBp[r],
          this.compBp[r],
          this.occSince[r],
          this.compHigh[r],
          this.uprDays[r],
          this.supDeci[r],
        ]);
      }
    }
    return cloneJson({
      gameID: this.gameID,
      lastCommonDay: this.lastCommonDay,
      countryState: [...this.countryStateArr],
      nameKey: this.nameKey,
      nameArg: this.nameArg,
      color: this.color,
      controllerOf: this.controllerOf,
      everHuman: this.everHuman,
      wars: this.wars,
      nextWarId: this.nextWarId,
      pairWar: [...this.pairWar].map(([k, w]): [number, number, number] => [
        Math.floor(k / this.size),
        k % this.size,
        w,
      ]),
      conferences: this.conferences,
      nextConfId: this.nextConfId,
      peaceLog: this.peaceLog,
      cores,
      occ,
      occLaw: this.occLaw,
      zones: this.zones,
      dmz: this.dmz,
      subjects: this.subjects,
      exiles: this.exiles,
      lendLease: this.lendLease,
      inTransit: this.inTransit,
      nextLlId: this.nextLlId,
      volunteers: this.volunteers,
      reparations: this.reparations,
      disarm: this.disarm,
      takeoverCards: this.takeoverCards,
      wakeQueue: this.wakeQueue,
      dayNotes: this.dayNotes,
      capBase: this.capBase,
      peaceOffers: this.peaceOffers,
      nextOfferId: this.nextOfferId,
      peaceCooldowns: this.peaceCooldowns,
      truces: this.truces,
      fronts: this.fronts,
    });
  }

  restoreState(s: WwEndgameState): void {
    const c = cloneJson(s);
    this.gameID = c.gameID;
    this.lastCommonDay = c.lastCommonDay;
    this.countryStateArr = Uint8Array.from(c.countryState);
    this.nameKey = c.nameKey;
    this.nameArg = c.nameArg;
    this.color = c.color;
    this.controllerOf = c.controllerOf;
    this.everHuman = c.everHuman;
    this.wars = c.wars as WwWar[];
    this.nextWarId = c.nextWarId;
    this.pairWar = new Map(
      c.pairWar.map(([a, b, w]) => [WwEndgame.pairKey(a, b, this.size), w]),
    );
    this.conferences = c.conferences;
    this.nextConfId = c.nextConfId;
    this.peaceLog = c.peaceLog;
    this.coreTable.fill(0);
    for (const [r, a, b, d] of c.cores) {
      this.writeCoresRaw(
        r,
        [a, b, d].filter((x) => x !== 0),
      );
    }
    for (const arr of [
      this.resBp,
      this.compBp,
      this.occSince,
      this.compHigh,
      this.uprDays,
      this.supDeci,
    ]) {
      arr.fill(0);
    }
    for (const [r, res, comp, since, high, upr, sup] of c.occ) {
      this.resBp[r] = res;
      this.compBp[r] = comp;
      this.occSince[r] = since;
      this.compHigh[r] = high;
      this.uprDays[r] = upr;
      this.supDeci[r] = sup;
    }
    this.occLaw = c.occLaw;
    this.zones = c.zones;
    this.dmz = c.dmz;
    this.subjects = c.subjects;
    this.exiles = c.exiles;
    this.lendLease = c.lendLease;
    this.inTransit = c.inTransit;
    this.nextLlId = c.nextLlId;
    this.volunteers = c.volunteers;
    this.reparations = c.reparations;
    this.disarm = c.disarm;
    this.takeoverCards = c.takeoverCards;
    this.wakeQueue = c.wakeQueue;
    this.dayNotes = c.dayNotes;
    this.capBase = c.capBase ?? [];
    this.peaceOffers = c.peaceOffers ?? [];
    this.nextOfferId = c.nextOfferId ?? 1;
    this.peaceCooldowns = c.peaceCooldowns ?? [];
    this.truces = c.truces ?? [];
    this.fronts = c.fronts ?? [];
    this.rebuildDerived();
    // A restored game's screens have seen nothing yet.
    this.firstData = true;
  }

  /** Everything in DERIVED_FIELDS, from state only. */
  rebuildDerived(): void {
    this.rebuildHumans();
    this.rebuildWarIdx();
    this.subjectIdx = new Map(this.subjects.map((s, i) => [s.subject, i]));
    this.exileIdx = new Map(this.exiles.map((e, i) => [e.smallID, i]));
    // Rebuilt on first use (WorldWar restores the endgame before the land war).
    this.adminDirty = true;
  }

  /** Spec §21.5: from state only (never the derived administered list). */
  hash(): number {
    let h = 0;
    const mix = (v: number) => {
      h = (Math.imul(h, 31) + (v | 0)) | 0;
    };
    for (let i = 1; i < this.size; i++) mix(this.countryStateArr[i] * (i + 1));
    mix(this.wars.length);
    for (const w of this.wars) {
      for (const s of w.sides) {
        for (const m of s.members) {
          mix(
            MEMBER_STATES.indexOf(m.state) + m.id * 4 + (m.wsMilli % 1_000_003),
          );
        }
      }
    }
    // Batch 21 glue (lane W review, minor 13): every stored conference
    // field, and the zones, demilitarised regions, reparations, arms limits
    // and peace log lane W writes. Field by field, never by key order (a
    // restored object's keys follow the schema).
    const ids = (a: readonly number[]) => {
      mix(a.length);
      for (const v of a) mix(v);
    };
    const pairs = (a: readonly (readonly [number, number])[]) => {
      mix(a.length);
      for (const [x, y] of a) {
        mix(x);
        mix(y);
      }
    };
    const text = (s: string) => {
      mix(s.length);
      for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i));
    };
    const demands = (ds: readonly StoredDemand[]) => {
      mix(ds.length);
      for (const d of ds) {
        mix(d.kind);
        mix(d.slot);
        ids(d.regions);
        mix(d.target);
        mix(d.beneficiary);
        mix(d.k);
        mix(d.pct);
      }
    };
    mix(this.nextConfId);
    mix(this.conferences.length);
    for (const c of this.conferences) {
      mix(c.id);
      ids(c.warIds);
      ids(c.losers);
      ids(c.stake);
      ids(c.base);
      mix(c.parts.length);
      for (const p of c.parts) {
        mix(p.id);
        mix(p.wsMilli % 1_000_003);
        mix(p.pts);
        mix(p.human ? 1 : 0);
      }
      pairs(c.claims);
      pairs(c.conquer);
      pairs(c.topple);
      mix(c.status);
      mix(c.doneDay);
      mix(c.round);
      mix(c.roundEndTick);
      mix(c.openTick);
      mix(c.subs.length);
      for (const s of c.subs) {
        mix(s.id);
        demands(s.demands);
        mix(s.passed ? 1 : 0);
      }
      mix(c.ai.length);
      for (const a of c.ai) {
        mix(a.id);
        demands(a.demands);
      }
      mix(c.settled.length);
      for (const s of c.settled) {
        mix(s.kind);
        mix(s.by);
        ids(s.regions);
        mix(s.target);
        mix(s.beneficiary);
        mix(s.k);
        mix(s.pct);
        mix(s.round);
        mix(s.cost);
      }
      mix(c.lastRound.length);
      for (const l of c.lastRound) {
        mix(l.by);
        mix(l.kind);
        ids(l.regions);
        mix(l.target);
        mix(l.ok ? 1 : 0);
      }
    }
    mix(this.zones.length);
    for (const z of this.zones) {
      mix(z.region);
      mix(z.holder);
      mix(z.untilDay);
    }
    pairs(this.dmz);
    mix(this.reparations.length);
    for (const x of this.reparations) {
      mix(x.from);
      mix(x.to);
      mix(x.k);
      mix(x.untilDay);
    }
    pairs(this.disarm);
    mix(this.peaceLog.length);
    for (const e of this.peaceLog) {
      mix(e.day);
      ids(e.losers);
      mix(e.lines.length);
      for (const l of e.lines) {
        text(l.key);
        const keys = Object.keys(l.params).sort();
        mix(keys.length);
        for (const k of keys) {
          text(k);
          const v = l.params[k];
          if (typeof v === "number") mix(v);
          else text(v);
        }
      }
    }
    for (let r = 1; r < this.regionCap; r++) {
      if (
        this.resBp[r] === 0 &&
        this.compBp[r] === 0 &&
        this.compHigh[r] === 0 &&
        this.uprDays[r] === 0 &&
        this.occSince[r] === 0
      ) {
        continue;
      }
      mix(r);
      mix(this.resBp[r]);
      mix(this.compBp[r]);
      mix(this.compHigh[r]);
      mix(this.uprDays[r]);
      mix(this.occSince[r]);
    }
    for (const l of this.occLaw) {
      mix(l.by * 131 + l.of);
      mix(l.law);
      mix(l.lockUntilDay);
    }
    for (const s of this.subjects) {
      mix(s.level);
      mix(s.autBp);
    }
    // Lane X review: the host, zero days, capital and faction move too.
    for (const e of this.exiles) {
      mix(e.smallID);
      mix(e.legitBp);
      mix(e.host);
      mix(e.zeroDays);
      mix(e.capital);
      mix(e.faction);
    }
    // Batch 20 glue: the aid AI resizes the contracts it owns (lane A's `ai`).
    for (const l of this.lendLease) {
      mix(l.sentMilli % 1_000_003);
      mix(l.perMonth);
      mix(l.ai === true ? 1 : 0);
    }
    for (const t of this.inTransit) mix(t.countMilli % 1_000_003);
    for (let i = 0; i < this.coreTable.length; i++) {
      if (this.coreTable[i] !== 0) mix(this.coreTable[i] * 7 + i);
    }
    for (const [c, id] of this.controllerOf) {
      mix(c.length);
      mix(id);
    }
    // P5 final lane: the capitulation baselines (none in most games).
    if (this.capBase.length > 0) pairs(this.capBase);
    // White peace: offers, cooldowns, truces and the fronts' stalemate count.
    mix(this.nextOfferId);
    mix(this.peaceOffers.length);
    for (const o of this.peaceOffers) {
      mix(o.id);
      mix(o.war);
      mix(o.from);
      mix(o.to);
      mix(o.whole ? 1 : 0);
      mix(o.sentTick);
      mix(o.deadlineTick);
      // Negotiated peace: the terms, field by field (none: a 0; peace on
      // the current line: a 2 — it carries no terms).
      const t = o.terms;
      mix(t !== undefined ? 1 : o.line === true ? 2 : 0);
      if (t !== undefined) {
        ids(t.give);
        ids(t.take);
        mix(t.pay);
        mix(t.demand);
        ids(t.free);
      }
    }
    for (const list of [this.peaceCooldowns, this.truces]) {
      mix(list.length);
      for (const [a, b, u] of list) {
        mix(a);
        mix(b);
        mix(u);
      }
    }
    mix(this.fronts.length);
    for (const [w, a, b, since] of this.fronts) {
      mix(w);
      mix(a);
      mix(b);
      mix(since);
    }
    return h;
  }
}

function byClient(a: [string, number], b: [string, number]): number {
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

/** Plan decision 24: the three daily batches. `items` is "a:b:n,…" (the screen formats it). */
export const NOTE_KEYS = [
  "ww1936_captured",
  "ww1936_ll_arrived",
  "ww1936_garrison_short",
] as const;
export const NOTE_CAPTURE = 0;
export const NOTE_LL = 1;
export const NOTE_GARRISON = 2;
/**
 * The param each batch adds to `items` (lane T's keys, spec §22): the row
 * column (2: a, 3: b) it reads, a country (sent as its tag) or not.
 */
export const NOTE_ARGS: readonly ({
  param: string;
  col: 2 | 3;
  country: boolean;
} | null)[] = [
  { param: "region", col: 3, country: false },
  { param: "fromTag", col: 2, country: true },
  null,
];
