// World War 1936 P3 — politics (docs/superpowers/specs/2026-10-20-ww1936-p3-politics-design.md).
// One WwPolitics lives in WorldWar next to the economy and the land war.
// WorldWarExecution runs tick() before economy.tick() and tickDeadlines()
// after land.tick(). Everything iterates in smallID / content order.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import type { PolOrder, WwOrder } from "@openfront/engine-api/Schemas";
import {
  COUNTRIES,
  CountryTag,
  FACTION_IDS,
  FACTION_LEADER,
} from "@openfront/engine-api/ww1936/Countries";
import {
  WW_DAY_SPLIT,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ADVISOR_SLOTS,
  DRIFT_KEYS,
  FactionKey,
  factionKeyOf,
  FOCUS_TREES,
  FocusId,
  FocusTreeId,
  IDEO_DEM,
  IDEO_NEU,
  IDEOLOGIES,
  PersonDef,
  PersonId,
  RESERVE_KEYS,
  TraitDef,
  TraitId,
  WAR_GOAL_TYPES,
  WarGoalType,
  WW_BRANCH_DEVIATE_PCT,
  WW_BRANCH_DEVIATE_POLITICAL_PCT,
  WW_ELECTION_DAYS,
  WW_EVENT_CHAIN_DEPTH,
  WW_STAT_KEYS,
  WW_TENSION_START_BP,
  WwPolDetail,
  WwPolGlobal,
  WwPoliticsData,
  WwPolSummary,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  type ContentRegistry,
  treePosIn,
} from "@openfront/engine-lib/ww1936/content/registry";
import {
  dailyPpMilli,
  effectiveSurrenderPct,
  LAW_STABILITY_BP,
  stabilityEffects,
  warSupportEffects,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import {
  idHash,
  P_BEAT,
  P_BRANCH,
  P_ELECTION,
  wwRoll,
} from "@openfront/engine-lib/ww1936/Roll";
import {
  addStatsInto,
  addStatsIntoArray,
  emptyStats,
  P6_STAT_RANGE,
  PCT_STAT_KEYS,
  statsArray,
} from "@openfront/engine-lib/ww1936/Stats";
import { z } from "zod";
import type { Game, Player } from "../../game/Game";
import type { WwDepth } from "../depth/WwDepth";
import type { WorldWar } from "../WorldWar";
import { candidatesFor, fireAdvisor, hireAdvisor } from "./Advisors";
import { aiBeatPlanned, aiPoliticsTick } from "./AiPolitics";
import {
  cancelMission,
  decisionCards,
  stepDecisions,
  takeDecision,
} from "./Decisions";
import {
  applyOption,
  checkTriggeredEvents,
  chooseEventOption,
  deliverEvent,
  expireCards,
  openOptions,
} from "./Events";
import { dailyFactions, factionOrder } from "./Factions";
import {
  cancelFocus,
  focusCards,
  queueFocus,
  startFocus,
  stepFocus,
  unqueueFocus,
} from "./Focus";
import { runBeats } from "./HistoryBeats";
import { dailyPower } from "./Power";
import { stabilityLines } from "./Stability";
import { dailyTension } from "./Tension";
import { dailyTreaties, treatyOrder } from "./Treaties";
import {
  afterCapitulation,
  afterWarDeclared,
  afterWarJoined,
  cancelJustification,
  justificationBlocked,
  startJustification,
  stepJustifications,
} from "./WarGoals";

export interface SpiritState {
  id: string;
  untilDay: number;
  addedDay: number;
}
export interface Mission {
  id: string;
  target: number;
  startDay: number;
  endDay: number;
}
export interface Justification {
  on: number;
  type: WarGoalType;
  group: string;
  progressDays: number;
  totalDays: number;
}
export interface WarGoal {
  on: number;
  type: WarGoalType;
  group: string;
  untilDay: number;
}
/** `key`: a TechBranch, or a tech id (spec §10.4 research_bonus). */
export interface ResearchBonus {
  key: string;
  pct: number;
  uses: number;
}
export interface PendingEvent {
  uid: number;
  eventId: string;
  from: number;
  target: number;
  firedTick: number;
  deadlineTick: number;
  aiOption: string;
}
export interface FactionState {
  idx: number;
  name: string;
  nameTag: CountryTag | "";
  leader: number;
  members: number[];
  createdDay: number;
}
export interface Guarantee {
  by: number;
  to: number;
  sinceDay: number;
}
/** a < b. */
export interface Nap {
  a: number;
  b: number;
  sinceDay: number;
  startTreaty: boolean;
}
/** `by`'s armies may enter `from`'s regions (spec §16.3). */
export interface Access {
  by: number;
  from: number;
}
/** a < b. */
export interface OpinionMod {
  a: number;
  b: number;
  value: number;
  untilDay: number;
}
/**
 * The delay list (spec §10.5-3, §12.4): "fire" an event, or apply an AI's
 * "choose" late. Kept in (day, seq) order.
 */
export interface Delayed {
  day: number;
  seq: number;
  kind: "fire" | "choose";
  eventId: string;
  to: number;
  from: number;
  target: number;
  option: string;
}
export interface BeatState {
  fireDay: number;
  skipped: boolean;
  done: boolean;
}
/** One entry of the tick's event queue (plan decision 13; not state). */
export interface QueuedEvent {
  eventId: string;
  to: number;
  from: number;
  target: number;
  depth: number;
}

/** One country's politics (spec §22.1). Indices: IDEOLOGIES, ADVISOR_SLOTS, RESERVE_KEYS. */
export class CountryPol {
  /** Plan decision 32: 50 PP to start. */
  ppMilli = 50_000;
  ppCumMilli = 0;
  /**
   * A country without a COUNTRY_POLITICS row (test content) sits at 50% and
   * 50%, where the dynamic lines are 0 (spec §3.1: with no P3 content the
   * P1/P2 values do not change). K6's table writes spec §19.10's defaults
   * out for every real country.
   */
  stabBaseBp = 5000;
  wsBaseBp = 5000;
  stabBp = 5000;
  wsBp = 5000;
  pop = [1500, 1000, 2000, 5500];
  ruling = IDEO_NEU;
  leader: PersonId = "";
  tree: FocusTreeId = "generic";
  nextElectionDay = -1;
  electionsSuspended = false;
  crisisDays = [0, 0, 0, 0];
  crisisCooldownUntil = -1;
  spirits: SpiritState[] = [];
  advisors: (string | null)[] = new Array<string | null>(
    ADVISOR_SLOTS.length,
  ).fill(null);
  advisorLockUntil: number[] = new Array<number>(ADVISOR_SLOTS.length).fill(-1);
  /** add_advisor_candidate, ascending. */
  candidates: string[] = [];
  /** remove_advisor: never again (spec §19.6 Eden, Litvinov). Ascending. */
  dismissed: string[] = [];
  /** person_trait, in the order given. */
  personTraits: [string, TraitId][] = [];
  focus: { id: FocusId; progressMilli: number } | null = null;
  queued: FocusId | null = null;
  /** By tree position: 0 open, 1 done, 2 bypassed. */
  focusState: Uint8Array = new Uint8Array(0);
  focusesDone = 0;
  partial = new Map<FocusId, number>();
  /** "<id>" or "<id>@<target smallID>" → first day it can be taken again. */
  decisionCooldown = new Map<string, number>();
  missions: Mission[] = [];
  unlocked = new Set<string>();
  locked = new Set<string>();
  taken = new Set<string>();
  /** flag → [day set, day it lapses or -1]. */
  flags = new Map<string, [number, number]>();
  justification: Justification | null = null;
  warGoals: WarGoal[] = [];
  researchBonuses: ResearchBonus[] = [];
  extraResearchSlots = 0;
  reserved: number[] = new Array<number>(RESERVE_KEYS.length).fill(0);
  pending: PendingEvent[] = [];
  firedOnce = new Set<string>();
  /** Repeating event → first day it may fire again. */
  eventCooldown = new Map<string, number>();
  /** improve_relations: target → first day again. */
  improveCooldown = new Map<number, number>();
  /** Countries this one declared war on and still fights (spec §6.1 offensive line; D keeps it). Ascending. */
  declaredOn: number[] = [];
  /** Spec §3.3, state; CountryEconomy.stats is this same object (plan decision 9). */
  readonly stats: WwStats = emptyStats();

  constructor(
    readonly smallID: number,
    readonly tag: CountryTag,
  ) {}

  hasFlag(f: string, day: number): boolean {
    const v = this.flags.get(f);
    return v !== undefined && (v[1] < 0 || day < v[1]);
  }

  hasSpirit(id: string): boolean {
    return this.spirits.some((s) => s.id === id);
  }
}

/** Spec §5.3 government stats, IDEOLOGIES order. */
const GOV_STATS: readonly Partial<WwStats>[] = [
  { stabilityBp: 500, justifyCostPct: 50 },
  { ppGainPct: 5 },
  { warSupportBp: 500, justifyTimePct: -10 },
  {},
];

// ---- Snapshot schema (spec §22.5) ----

const zStr = () => z.string();
const CountryPolSchema = z.object({
  smallID: zInt(),
  ppMilli: zInt(),
  ppCumMilli: zInt(),
  stabBaseBp: zInt(),
  wsBaseBp: zInt(),
  stabBp: zInt(),
  wsBp: zInt(),
  pop: z.array(zInt()),
  ruling: zInt(),
  leader: zStr(),
  tree: z.enum(FOCUS_TREES),
  nextElectionDay: zInt(),
  electionsSuspended: z.boolean(),
  crisisDays: z.array(zInt()),
  crisisCooldownUntil: zInt(),
  spirits: z.array(
    z.object({ id: zStr(), untilDay: zInt(), addedDay: zInt() }),
  ),
  advisors: z.array(zStr().nullable()),
  advisorLockUntil: z.array(zInt()),
  candidates: z.array(zStr()),
  dismissed: z.array(zStr()),
  personTraits: z.array(z.tuple([zStr(), zStr()])),
  focus: z.object({ id: zStr(), progressMilli: zInt() }).nullable(),
  queued: zStr().nullable(),
  done: z.array(zStr()),
  bypassed: z.array(zStr()),
  focusesDone: zInt(),
  partial: z.array(z.tuple([zStr(), zInt()])),
  decisionCooldown: z.array(z.tuple([zStr(), zInt()])),
  missions: z.array(
    z.object({
      id: zStr(),
      target: zInt(),
      startDay: zInt(),
      endDay: zInt(),
    }),
  ),
  unlocked: z.array(zStr()),
  locked: z.array(zStr()),
  taken: z.array(zStr()),
  flags: z.array(z.tuple([zStr(), zInt(), zInt()])),
  justification: z
    .object({
      on: zInt(),
      type: z.enum(WAR_GOAL_TYPES),
      group: zStr(),
      progressDays: zInt(),
      totalDays: zInt(),
    })
    .nullable(),
  warGoals: z.array(
    z.object({
      on: zInt(),
      type: z.enum(WAR_GOAL_TYPES),
      group: zStr(),
      untilDay: zInt(),
    }),
  ),
  researchBonuses: z.array(
    z.object({ key: zStr(), pct: zInt(), uses: zInt() }),
  ),
  extraResearchSlots: zInt(),
  reserved: z.array(zInt()),
  pending: z.array(
    z.object({
      uid: zInt(),
      eventId: zStr(),
      from: zInt(),
      target: zInt(),
      firedTick: zInt(),
      deadlineTick: zInt(),
      aiOption: zStr(),
    }),
  ),
  firedOnce: z.array(zStr()),
  eventCooldown: z.array(z.tuple([zStr(), zInt()])),
  improveCooldown: z.array(z.tuple([zInt(), zInt()])),
  declaredOn: z.array(zInt()),
  stats: z.array(zInt()),
});
export const WwPoliticsStateSchema = z.object({
  seed: zInt(),
  rolled: z.boolean(),
  lastCommonDay: zInt(),
  countries: z.array(CountryPolSchema),
  wtBp: zInt(),
  threatBp: z.array(zInt()),
  factions: z.array(
    z.object({
      idx: zInt(),
      name: zStr(),
      nameTag: zStr(),
      leader: zInt(),
      members: z.array(zInt()),
      createdDay: zInt(),
    }),
  ),
  nextFactionIdx: zInt(),
  guarantees: z.array(z.tuple([zInt(), zInt(), zInt()])),
  naps: z.array(z.tuple([zInt(), zInt(), zInt(), z.boolean()])),
  access: z.array(z.tuple([zInt(), zInt()])),
  opinions: z.array(z.tuple([zInt(), zInt(), zInt(), zInt()])),
  legalOwner: z.array(zInt()),
  gflags: z.array(z.tuple([zStr(), zInt()])),
  firedOnceGlobal: z.array(zStr()),
  removedGenerals: z.array(zStr()),
  delayed: z.array(
    z.object({
      day: zInt(),
      seq: zInt(),
      kind: z.enum(["fire", "choose"]),
      eventId: zStr(),
      to: zInt(),
      from: zInt(),
      target: zInt(),
      option: zStr(),
    }),
  ),
  nextSeq: zInt(),
  beats: z.array(z.tuple([zInt(), z.boolean(), z.boolean()])),
  branchDeviations: z.array(z.tuple([zStr(), zStr().nullable()])),
  nextUid: zInt(),
});
export type WwPoliticsState = z.infer<typeof WwPoliticsStateSchema>;

/** P5 (spec §9.1): the orders a subject may not give on its own, by kind. */
const SUBJECT_ACTION: Partial<
  Record<PolOrder["kind"], "justify" | "faction" | "treaty" | "leave_faction">
> = {
  justify: "justify",
  faction_create: "faction",
  faction_invite: "faction",
  faction_request: "faction",
  faction_leave: "leave_faction",
  guarantee: "treaty",
  nap_offer: "treaty",
  access_ask: "treaty",
};

/** WwPolDetail.statParts order. */
const STAT_PARTS = [
  "tech",
  "laws",
  "spirits",
  "advisors",
  "government",
  "leader",
  "dynamic",
  // P6 (plan decision 24): the depth systems' part (ww1936.stat_src.depth).
  "depth",
] as const;
/**
 * recomputeStats' sum by WW_STAT_KEYS index, reused (never state: each call
 * starts from 0). Final perf lane: a typed array, read and written by
 * position (the same doubles, added in the same order, as the object sum
 * it replaces).
 */
const SUM_SCRATCH = new Float64Array(WW_STAT_KEYS.length);
/** Set while a sum is in SUM_SCRATCH (an exception mid-sum leaves it dirty). */
let scratchDirty = false;
/** recomputeStats' adder: every source into SUM_SCRATCH. */
const addToScratch = (_part: number, p: Partial<WwStats>): void =>
  addStatsIntoArray(SUM_SCRATCH, p);
/** By WW_STAT_KEYS index: a …Pct key (clamped, spec §3.3). */
const IS_PCT: readonly boolean[] = WW_STAT_KEYS.map((k) =>
  PCT_STAT_KEYS.includes(k),
);

/**
 * General id → the persons whose `alsoGeneral` it is, from the content's
 * person table (static content; derived once per table).
 */
const ALSO_GENERAL = new WeakMap<
  ReadonlyMap<string, PersonDef>,
  Map<string, string[]>
>();
function alsoGeneralIndex(
  persons: ReadonlyMap<string, PersonDef>,
): Map<string, string[]> {
  let m = ALSO_GENERAL.get(persons);
  if (m === undefined) {
    m = new Map();
    for (const [id, p] of persons) {
      if (p.alsoGeneral === undefined) continue;
      const l = m.get(p.alsoGeneral);
      if (l === undefined) m.set(p.alsoGeneral, [id]);
      else l.push(id);
    }
    ALSO_GENERAL.set(persons, m);
  }
  return m;
}

export class WwPolitics {
  countries: (CountryPol | null)[];
  // ---- world state (spec §22.1 "global") ----
  wtBp = WW_TENSION_START_BP;
  threatBp: number[];
  factions: FactionState[] = [];
  /** smallID → faction idx, -1: none. Derived from `factions` (rebuildDerived). */
  factionOfIdx: number[];
  nextFactionIdx: number = FACTION_IDS.length;
  guarantees: Guarantee[] = [];
  naps: Nap[] = [];
  access: Access[] = [];
  opinions: OpinionMod[] = [];
  readonly legalOwner: Uint16Array;
  gflags = new Map<string, number>();
  firedOnceGlobal = new Set<string>();
  removedGenerals = new Set<string>();
  delayed: Delayed[] = [];
  nextSeq = 1;
  beats: BeatState[] = [];
  /** "<tag>:<branch point id>" → the alternative taken, null: history. Insertion = roll order. */
  branchDeviations = new Map<string, FocusId | null>();
  nextUid = 1;
  private _seed = 0;
  private _rolled = false;
  private lastCommonDay = -1;
  // ---- derived (DERIVED_FIELDS) ----
  private eventQueue: QueuedEvent[] = [];
  private newsOut: WwPoliticsData["news"] = [];
  private cardsOut: WwPoliticsData["cards"] = [];
  private dirtyPolCountries = new Set<number>();
  private dirtyPolRegions = new Set<number>();
  private polGlobalDirty = true;

  constructor(
    readonly mg: Game,
    readonly ww: WorldWar,
    readonly content: ContentRegistry,
  ) {
    const sc = ww.scenario;
    const n = sc.countries.length + 1;
    this.countries = [
      null,
      ...sc.countries.map((tag, i) => new CountryPol(i + 1, tag)),
    ];
    this.threatBp = new Array<number>(n).fill(0);
    this.factionOfIdx = new Array<number>(n).fill(-1);
    const size = sc.maxRegionId() + 1;
    this.legalOwner = new Uint16Array(size);
    const owners = sc.ownerByRegion();
    for (const r of sc.landRegions) this.legalOwner[r.id] = owners[r.id];
    // Spec §15.1: the starting factions, FACTION_IDS order.
    FACTION_IDS.forEach((f, idx) => {
      const members = sc.countries.flatMap((t, i) =>
        COUNTRIES[t].faction === f ? [i + 1] : [],
      );
      if (members.length === 0) return;
      const lead = sc.smallIdOf(FACTION_LEADER[f]);
      this.factions.push({
        idx,
        name: f,
        nameTag: "",
        leader: members.includes(lead) ? lead : members[0],
        members,
        createdDay: 0,
      });
    });
    for (const c of this.list()) {
      c.tree = this.content.countryIdx.get(c.tag)?.tree ?? "generic";
    }
    this.rebuildDerived();
  }

  get econ() {
    return this.ww.economy;
  }

  get land() {
    return this.ww.land;
  }

  get seed(): number {
    return this._seed;
  }

  rolled(): boolean {
    return this._rolled;
  }

  /**
   * Spec §6.5, §9.2, §19.10: starting values. WorldWar.start calls it once,
   * before economy.start and land.start (controller ruling I3); the techs
   * the economy's start adds recompute the stats as they come.
   */
  start(): void {
    for (const c of this.list()) {
      const d = this.content.countryIdx.get(c.tag);
      const ruling = d?.ruling ?? "neutral";
      c.ruling = IDEOLOGIES.indexOf(ruling);
      if (d !== undefined) {
        c.pop = d.popularity.map((p) => p * 100);
        c.stabBaseBp = d.stability * 100;
        c.wsBaseBp = d.warSupport * 100;
        if (d.firstElection !== undefined) {
          c.nextElectionDay = dayOfDate(d.firstElection);
        }
        for (const s of d.spirits ?? []) {
          c.spirits.push({ id: s, untilDay: -1, addedDay: 0 });
        }
      }
      // Controller ruling R7: startLeader first (Japan's 1936 prime minister).
      c.leader =
        d?.startLeader ?? d?.leaders[ruling] ?? `title:leader_${ruling}`;
      c.stabBp = c.stabBaseBp;
      c.wsBp = c.wsBaseBp;
      c.focusState = new Uint8Array(this.content.treeFocuses[c.tree].length);
      this.recomputeStats(c.smallID);
    }
    for (const [x, y] of this.content.startNaps) {
      const a = this.idOfTag(x);
      const b = this.idOfTag(y);
      if (a === 0 || b === 0) continue;
      this.naps.push({
        a: Math.min(a, b),
        b: Math.max(a, b),
        sinceDay: 0,
        startTreaty: true,
      });
    }
    this.polGlobalDirty = true;
  }

  /**
   * Plan decision 2: the seed, the history beats (P0 decision 14's 1-in-10
   * skip and 0–20 days, plan decision 16), the branch deviations (spec
   * §18.4) and the hashed first elections (spec §5.4). Once a game.
   */
  roll(seed: number, historical: boolean): void {
    if (this._rolled) return;
    this._rolled = true;
    this._seed = seed | 0;
    this.beats = this.content.beats.map((b, i) => {
      const h = this.content.beatHash[i];
      const skipped = !historical || wwRoll(seed, P_BEAT, h, 1) % 10 === 0;
      return {
        fireDay: dayOfDate(b.date) + (wwRoll(seed, P_BEAT, h, 2) % 21),
        skipped,
        done: false,
      };
    });
    for (const c of this.list()) {
      for (const bp of this.content.branchPoints[c.tree] ?? []) {
        const pct = bp.political
          ? WW_BRANCH_DEVIATE_POLITICAL_PCT
          : WW_BRANCH_DEVIATE_PCT;
        const a = idHash(c.tag);
        const b = idHash(bp.id);
        let alt: FocusId | null = null;
        if (
          historical &&
          bp.alternatives.length > 0 &&
          wwRoll(seed, P_BRANCH, a, b) % 100 < pct
        ) {
          const k = wwRoll(seed, P_BRANCH, a, b, 1) % bp.alternatives.length;
          alt = bp.alternatives[k];
        }
        this.branchDeviations.set(`${c.tag}:${bp.id}`, alt);
      }
      if (c.ruling === IDEO_DEM && c.nextElectionDay < 0) {
        c.nextElectionDay =
          wwRoll(seed, P_ELECTION, c.smallID) % WW_ELECTION_DAYS;
      }
    }
    this.polGlobalDirty = true;
  }

  // ---- Clock (spec §2.2) ----

  /** Order 2 and 3: the day's common step, then this tick's share of countries. */
  tick(ticks: number): void {
    if (this.ww.inPrep(ticks)) return;
    const day = this.ww.day(ticks);
    if (day !== this.lastCommonDay) {
      this.lastCommonDay = day;
      this.dailyCommon(day, ticks);
    }
    const k = ticks - dayStartTick(day, this.ww.prepEndTick());
    if (k < 0 || k >= WW_DAY_SPLIT) return;
    for (let id = 1; id < this.countries.length; id++) {
      if (id % WW_DAY_SPLIT === k) this.dailyCountry(id, day, ticks);
    }
  }

  private dailyCommon(day: number, tick: number): void {
    dailyTension(this, day);
    // The delay list: what is due, in (day, seq) order (spec §12.3).
    while (this.delayed.length > 0 && this.delayed[0].day <= day) {
      const d = this.delayed.shift()!;
      if (d.kind === "fire") {
        this.queueEvent(d.eventId, d.to, d.from, d.target, 0);
      } else {
        applyOption(this, d.eventId, d.to, d.from, d.target, d.option, tick, 0);
      }
      this.flushEvents(tick);
    }
    // Dated events, in event order; the receivers in smallID order.
    for (const e of this.content.dateEvents.get(day) ?? []) {
      const def = this.content.events[e];
      const to = (def.date?.to ?? [])
        .map((t) => this.idOfTag(t))
        .filter((id) => id !== 0)
        .sort((a, b) => a - b);
      for (const id of to) this.queueEvent(def.id, id, id, 0, 0);
    }
    this.flushEvents(tick);
    runBeats(this, day, tick);
    this.flushEvents(tick);
    dailyFactions(this, day, tick);
    dailyTreaties(this, day, tick);
    stepJustifications(this, day, tick);
    this.flushEvents(tick);
  }

  private dailyCountry(id: number, day: number, tick: number): void {
    const c = this.countries[id];
    if (c === null || c === undefined) return;
    if (!this.living(id)) {
      if (c.pending.length > 0) c.pending = []; // spec §12.5
      return;
    }
    // Lane D fix 1 (controller ruling): a country that controls no region
    // (annexed, its tiles still on their way) has no political day. P5: a
    // government in exile has one (spec §10.4).
    if (!this.controlsAnyRegion(id) && !this.ww.endgame.isExile(id)) return;
    dailyPower(this, id, day, tick);
    stepFocus(this, id, day, tick);
    stepDecisions(this, id, day, tick);
    if ((day + id) % 5 === 0) checkTriggeredEvents(this, id, day, tick);
    if (!this.isHuman(id)) aiPoliticsTick(this, id, day, tick);
    this.flushEvents(tick);
    this.markCountry(id);
  }

  /** Order 6: human cards past their deadline get their shown option (spec §12.5). */
  tickDeadlines(tick: number): void {
    expireCards(this, tick);
    this.flushEvents(tick);
  }

  // ---- Orders (spec §22.3; the same for humans and the AI) ----

  issue(smallID: number, order: WwOrder, tick: number): WwOrderBlock | null {
    if (!this.living(smallID)) return "dead";
    const o = order as PolOrder;
    // P5 (spec §9.1, pre-flight §A S × T1): a subject's own diplomacy is
    // refused, its beats' too.
    const action = SUBJECT_ACTION[o.kind];
    if (action !== undefined && this.ww.endgame.subjectBlock(smallID, action)) {
      return "subject_restricted";
    }
    let block: WwOrderBlock | null;
    switch (o.kind) {
      case "focus_start":
        block = startFocus(this, smallID, o.focus, tick);
        break;
      case "focus_queue":
        block = queueFocus(this, smallID, o.focus);
        break;
      case "focus_cancel":
        block = cancelFocus(this, smallID);
        break;
      case "focus_unqueue":
        block = unqueueFocus(this, smallID);
        break;
      case "advisor_hire":
        block = hireAdvisor(this, smallID, o.slot, o.advisor, this.day());
        break;
      case "advisor_fire":
        block = fireAdvisor(this, smallID, o.slot, this.day());
        break;
      case "decision_take":
        block = takeDecision(this, smallID, o.decision, o.target, tick, false);
        break;
      case "decision_cancel":
        block = cancelMission(this, smallID, o.decision, o.target);
        break;
      case "event_choose":
        block = chooseEventOption(this, smallID, o.uid, o.option, tick);
        break;
      case "justify":
        block = startJustification(
          this,
          smallID,
          o.target,
          o.goal,
          o.group,
          tick,
        );
        break;
      case "justify_cancel":
        block = cancelJustification(this, smallID);
        break;
      case "guarantee":
      case "guarantee_end":
      case "nap_offer":
      case "nap_break":
      case "access_ask":
      case "access_revoke":
      case "improve_relations":
        block = treatyOrder(this, smallID, o, tick);
        break;
      case "faction_create":
      case "faction_invite":
      case "faction_request":
      case "faction_kick":
      case "faction_leave":
      case "faction_dissolve":
        block = factionOrder(this, smallID, o, tick);
        break;
      default:
        return "bad_index";
    }
    this.flushEvents(tick);
    if (block === null) this.markCountry(smallID);
    return block;
  }

  // ---- Stats (spec §3.3) ----

  stats(smallID: number): WwStats {
    return this.countries[smallID]?.stats ?? emptyStats();
  }

  /**
   * Every source again for one country. Keeps the stats object (the
   * economy holds it). Sums into a reused scratch object: it runs for every
   * country every day (spec §22.7's budget).
   */
  recomputeStats(smallID: number): void {
    const c = this.countries[smallID];
    const ce = this.econ.country(smallID);
    if (c === null || c === undefined || ce === null) return;
    // The scratch is all 0 between calls: the loop below empties it.
    const total = SUM_SCRATCH;
    if (scratchDirty) total.fill(0);
    scratchDirty = true;
    this.sumSources(c, addToScratch);
    // One pass: clamp (spec §3.3), copy what changed, empty the scratch.
    const st = c.stats;
    let changed = false;
    for (let i = 0; i < WW_STAT_KEYS.length; i++) {
      let v = total[i];
      total[i] = 0;
      if (IS_PCT[i]) v = Math.max(-90, Math.min(300, v));
      // P6 (plan decision 24): the ranges of the P6 keys that are no …Pct.
      const r = P6_STAT_RANGE[i];
      if (r !== null) v = Math.max(r[0], Math.min(r[1], v));
      const k = WW_STAT_KEYS[i];
      if (st[k] !== v) {
        st[k] = v;
        changed = true;
      }
    }
    scratchDirty = false;
    // The land war's stats caches look at this (derived, never state).
    if (changed) ce.statsVer++;
    this.markCountry(smallID);
  }

  /**
   * The stats by source for the screens' explain lines (spec §21.4):
   * tech, laws, spirits, advisors, government, leader, dynamic. Built only
   * for a human country's details.
   */
  statParts(c: CountryPol): WwStats[] {
    const parts = STAT_PARTS.map(() => emptyStats());
    this.sumSources(c, (part, p) => addStatsInto(parts[part], p));
    return parts;
  }

  /**
   * Spec §3.3: hands every source of `c`'s stats to `add` (unclamped), with
   * its STAT_PARTS index, in one fixed order.
   */
  private sumSources(
    c: CountryPol,
    add: (part: number, p: Partial<WwStats>) => void,
  ): void {
    const ce = this.econ.country(c.smallID)!;
    // The tech totals are the first 34 stats (P1 + P2 TechEffects).
    add(0, ce.tech as unknown as Partial<WwStats>);
    const lawBp =
      (LAW_STABILITY_BP[ce.laws.economy] ?? 0) +
      (LAW_STABILITY_BP[ce.laws.trade] ?? 0) +
      (LAW_STABILITY_BP[ce.laws.conscription] ?? 0);
    if (lawBp !== 0) add(1, { stabilityBp: lawBp });
    for (const s of c.spirits) {
      const d = this.content.spiritIdx.get(s.id);
      if (d !== undefined) add(2, d.stats);
    }
    const atWar = this.ww.hasWar(c.smallID);
    for (const a of c.advisors) {
      if (a === null) continue;
      for (const t of this.traitsOf(c, a)) this.addTrait(3, t, c, atWar, add);
    }
    add(4, GOV_STATS[c.ruling]);
    for (const t of this.leaderTraits(c)) this.addTrait(5, t, c, atWar, add);
    add(6, stabilityEffects(c.stabBp));
    add(6, warSupportEffects(c.wsBp));
    // P6 hook (plan decision 24): doctrine, officer corps, MIOs,
    // mechanisms, landmarks (neutral before depth.start, pre-flight §0-9).
    const depth = this.ww.depth as WwDepth | undefined;
    if (depth !== undefined) add(7, depth.statsPart(c.smallID));
  }

  private addTrait(
    part: number,
    t: TraitDef,
    c: CountryPol,
    atWar: boolean,
    add: (part: number, p: Partial<WwStats>) => void,
  ): void {
    if (t.atWarOnly === true && !atWar) return;
    if (t.ideology !== undefined && IDEOLOGIES[c.ruling] !== t.ideology) return;
    add(part, t.stats);
    if (t.rulingDriftBp !== undefined) {
      add(part, { [DRIFT_KEYS[c.ruling]]: t.rulingDriftBp });
    }
  }

  /** An advisor's traits: a person's (with person_trait), or a titled card's one. */
  traitsOf(c: CountryPol, advisor: string): TraitDef[] {
    const ids: TraitId[] = [];
    if (advisor.startsWith("title:")) {
      ids.push(advisor.slice(6) as TraitId);
    } else {
      ids.push(...(this.content.personIdx.get(advisor)?.advisor?.traits ?? []));
      for (const [p, t] of c.personTraits) {
        if (p === advisor && !ids.includes(t)) ids.push(t);
      }
    }
    return ids.flatMap((id) => this.content.traitIdx.get(id) ?? []);
  }

  leaderTraits(c: CountryPol): TraitDef[] {
    const p = this.content.personIdx.get(c.leader);
    return (p?.leaderTraits ?? []).flatMap(
      (id) => this.content.traitIdx.get(id) ?? [],
    );
  }

  /** Spec §6.4: today's surrender line, percent of the legal victory points. */
  surrenderPct(smallID: number): number {
    const c = this.countries[smallID];
    const base = COUNTRIES[this.tagOf(smallID)].surrenderPct;
    if (c === null || c === undefined) return base;
    // P6 hook (I, S): collaboration and atomic bombs lower the line.
    const cut =
      (this.ww.depth as WwDepth | undefined)?.surrenderCutPp(smallID) ?? 0;
    return effectiveSurrenderPct(
      base,
      c.stabBp,
      c.wsBp,
      c.stats.surrenderPp - cut,
    );
  }

  dailyGainMilli(smallID: number): number {
    return dailyPpMilli(this.stats(smallID));
  }

  // ---- Event queue (plan decision 13, spec §10.5) ----

  queueEvent(
    eventId: string,
    to: number,
    from: number,
    target: number,
    depth: number,
  ): void {
    this.eventQueue.push({ eventId, to, from, target, depth });
  }

  /** Empties the tick's queue; deeper than WW_EVENT_CHAIN_DEPTH waits for tomorrow. */
  flushEvents(tick: number): void {
    while (this.eventQueue.length > 0) {
      const q = this.eventQueue.shift()!;
      if (q.depth > WW_EVENT_CHAIN_DEPTH) {
        this.addDelayed({
          day: this.ww.day(tick) + 1,
          kind: "fire",
          eventId: q.eventId,
          to: q.to,
          from: q.from,
          target: q.target,
          option: "",
        });
        continue;
      }
      deliverEvent(this, q, tick);
    }
  }

  queuedEvents(): number {
    return this.eventQueue.length;
  }

  addDelayed(d: Omit<Delayed, "seq">): void {
    // The schema's field order, so a live entry and a restored one are the
    // same object (snapshot diffs compare key order).
    const e: Delayed = {
      day: d.day,
      seq: this.nextSeq++,
      kind: d.kind,
      eventId: d.eventId,
      to: d.to,
      from: d.from,
      target: d.target,
      option: d.option,
    };
    let i = this.delayed.length;
    while (i > 0 && this.delayed[i - 1].day > e.day) i--;
    this.delayed.splice(i, 0, e);
  }

  // ---- Land (spec §17, plan decision 17) ----

  /**
   * The only way a legal owner changes. P5 plan decision 17: `core` true
   * makes the region a core of `to` too (the core table); false or absent
   * leaves the cores as they are.
   */
  setLegalOwner(region: number, to: number, core?: boolean): void {
    if (core === true) this.ww.endgame.addCore(to, region);
    if (this.legalOwner[region] === to) return;
    this.legalOwner[region] = to;
    this.dirtyPolRegions.add(region);
    this.econ.markRegionDirty(region);
    // P5: who is administered may change with the legal owner.
    this.ww.endgame.markControlChanged(region);
  }

  /** Spec §17.6, P5 pre-flight §0-5: a core region of its legal owner (the one entry point). */
  isCore(region: number): boolean {
    return this.ww.endgame.hasCore(this.legalOwner[region] ?? 0, region);
  }

  // ---- Queries ----

  /** P6 (pre-flight §A17): the focuses done or bypassed (W3's continuous focus unlock). */
  doneFocusCount(smallID: number): number {
    const c = this.countries[smallID];
    if (c === null || c === undefined) return 0;
    let n = 0;
    for (let i = 0; i < c.focusState.length; i++) {
      if (c.focusState[i] === 1 || c.focusState[i] === 2) n++;
    }
    return n;
  }

  list(): CountryPol[] {
    return this.countries.filter((c): c is CountryPol => c !== null);
  }

  country(smallID: number): CountryPol | null {
    return this.countries[smallID] ?? null;
  }

  tagOf(smallID: number): CountryTag {
    return this.ww.tagOf(smallID);
  }

  /** 0 when the tag is not in this scenario. */
  idOfTag(tag: CountryTag): number {
    return this.ww.scenario.smallIdOf(tag);
  }

  player(smallID: number): Player | null {
    if (smallID <= 0 || smallID >= this.countries.length) return null;
    const p = this.mg.playerBySmallID(smallID);
    return p.isPlayer() ? p : null;
  }

  /** P5 plan decision 6: the country plays (an exile does). */
  living(smallID: number): boolean {
    if (smallID <= 0 || smallID >= this.countries.length) return false;
    return this.ww.isActor(smallID);
  }

  /** The land war's control of at least one region. */
  controlsAnyRegion(smallID: number): boolean {
    const c = this.land.controller;
    for (const r of this.ww.scenario.landRegions) {
      if (c[r.id] === smallID) return true;
    }
    return false;
  }

  /** P5 plan decision 7: a human controls it now (a takeover moves it). */
  isHuman(smallID: number): boolean {
    if (smallID <= 0 || smallID >= this.countries.length) return false;
    return this.ww.isHumanControlled(smallID);
  }

  day(): number {
    return this.ww.day(this.mg.ticks());
  }

  factionIdx(smallID: number): number {
    return this.factionOfIdx[smallID] ?? -1;
  }

  faction(idx: number): FactionState | null {
    return this.factions.find((f) => f.idx === idx) ?? null;
  }

  factionOf(smallID: number): FactionKey | null {
    const i = this.factionIdx(smallID);
    return i < 0 ? null : factionKeyOf(i);
  }

  /** Members of a faction by index, ascending smallID. */
  factionMembers(idx: number): number[] {
    return [...(this.faction(idx)?.members ?? [])].sort((a, b) => a - b);
  }

  sameFaction(a: number, b: number): boolean {
    const fa = this.factionIdx(a);
    return a !== b && fa >= 0 && fa === this.factionIdx(b);
  }

  /** Ideology of a faction = its leader's ruling ideology (spec §5.3). */
  factionIdeology(idx: number): number {
    const f = this.faction(idx);
    return f === null
      ? IDEO_NEU
      : (this.countries[f.leader]?.ruling ?? IDEO_NEU);
  }

  hasAccess(by: number, from: number): boolean {
    return this.access.some((x) => x.by === by && x.from === from);
  }

  hasWarGoal(by: number, on: number): boolean {
    return this.countries[by]?.warGoals.some((g) => g.on === on) ?? false;
  }

  isAtWarBlockedByNap(a: number, b: number): boolean {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return this.naps.some((n) => n.a === lo && n.b === hi);
  }

  guarantorsOf(to: number): number[] {
    return this.guarantees.filter((g) => g.to === to).map((g) => g.by);
  }

  generalRemoved(id: string): boolean {
    return this.removedGenerals.has(id);
  }

  /** Plan decision 19: a person serving as an advisor somewhere is not a general meanwhile. */
  advisorHolds(generalId: string): boolean {
    // Final perf lane: only the persons who are also this general can hold
    // him (most generals have none: no walk over every country's advisors).
    const persons = alsoGeneralIndex(this.content.personIdx).get(generalId);
    if (persons === undefined) return false;
    for (const c of this.list()) {
      for (const a of c.advisors) {
        if (a !== null && persons.includes(a)) return true;
      }
    }
    return false;
  }

  /**
   * Spec §18.7: whom `smallID` plans to fight within 60 days (P2 AI): due
   * history beats, a justification about to finish, held war goals. Ascending.
   */
  plannedWars(smallID: number, day: number): number[] {
    const out = new Set<number>();
    this.content.beats.forEach((b, i) => {
      const s = this.beats[i];
      // A due beat not done yet is still planned: the AI may be waiting
      // for a better moment (owner direction, AiPolitics.aiBeatReady).
      if (s === undefined || s.skipped || s.done) return;
      if (s.fireDay > day + 60) return;
      if (b.act.kind !== "declare" && b.act.kind !== "join") return;
      const a = this.idOfTag(b.actor);
      const t = this.idOfTag(b.act.target);
      // Lane A fix round 1: a due beat the AI rates far below its bar is
      // not staged for (aiBeatPlanned: from 70% of it).
      if (s.fireDay <= day && a !== 0 && !aiBeatPlanned(this, b, a)) return;
      if (a === smallID && t !== 0) out.add(t);
      if (t === smallID && a !== 0) out.add(a);
    });
    const c = this.countries[smallID];
    const j = c?.justification ?? null;
    if (j !== null && j.totalDays - j.progressDays <= 60) out.add(j.on);
    for (const g of c?.warGoals ?? []) out.add(g.on);
    return [...out].sort((x, y) => x - y);
  }

  // ---- Hooks from P0 (Diplomacy, Capitulation) ----

  onWarDeclared(
    attacker: number,
    target: number,
    joined: readonly number[],
    noGoal: boolean,
    tick: number,
  ): void {
    afterWarDeclared(this, attacker, target, joined, noGoal, tick);
    // war_leader and the other at-war lines.
    for (const id of [attacker, ...joined]) this.recomputeStats(id);
    this.flushEvents(tick);
    this.polGlobalDirty = true;
  }

  onWarJoined(actor: number, enemy: number, tick: number): void {
    afterWarJoined(this, actor, enemy, tick);
    this.recomputeStats(actor);
    this.recomputeStats(enemy);
    this.flushEvents(tick);
    this.polGlobalDirty = true;
  }

  /**
   * Spec §17.1: its cards vanish (spec §12.5). P5 (spec §5.1-2): the legal
   * owner stays — the endgame's capitulation decides (its stub moves it).
   */
  onCapitulated(loser: number, victor: number, tick: number): void {
    const c = this.countries[loser];
    if (c !== null && c !== undefined) {
      c.pending = [];
      c.focus = null;
      c.queued = null;
      c.justification = null;
      this.markCountry(loser);
    }
    afterCapitulation(this, loser, victor, tick);
    this.flushEvents(tick);
    this.polGlobalDirty = true;
  }

  // ---- Messages, news, change marks ----

  /** A message to the country's human player only. */
  message(
    smallID: number,
    key: string,
    params: Record<string, string | number> = {},
  ): void {
    const p = this.player(smallID);
    if (p === null || !this.isHuman(smallID)) return;
    this.mg.displayMessage(
      `events_display.${key}`,
      MessageType.WORLD_WAR,
      p.id(),
      undefined,
      params,
    );
  }

  messageAll(key: string, params: Record<string, string | number> = {}): void {
    this.mg.displayMessage(
      `events_display.${key}`,
      MessageType.WORLD_WAR,
      null,
      undefined,
      params,
    );
  }

  /** Spec §12.7: world news, this tick's update only. */
  news(id: string, params: Record<string, string | number> = {}): void {
    this.newsOut.push({ id, params });
  }

  /** E: a new human card for the receiver's screen. */
  noteCard(to: number, card: WwPoliticsData["cards"][number]): void {
    this.cardsOut.push({ ...card, to });
  }

  markCountry(smallID: number): void {
    this.dirtyPolCountries.add(smallID);
  }

  markGlobal(): void {
    this.polGlobalDirty = true;
  }

  /** The region's legal owner changed outside setLegalOwner (screens only). */
  markRegion(region: number): void {
    this.dirtyPolRegions.add(region);
  }

  // ---- Screens (spec §22.4) ----

  takeData(): WwPoliticsData | null {
    if (
      this.dirtyPolCountries.size === 0 &&
      !this.polGlobalDirty &&
      this.dirtyPolRegions.size === 0 &&
      this.newsOut.length === 0 &&
      this.cardsOut.length === 0
    ) {
      return null;
    }
    const ids = [...this.dirtyPolCountries].sort((a, b) => a - b);
    const countries: WwPolSummary[] = [];
    const details: WwPolDetail[] = [];
    for (const id of ids) {
      const c = this.countries[id];
      if (c === null || c === undefined) continue;
      countries.push(this.summary(c));
      if (this.isHuman(id)) details.push(this.detail(c));
    }
    const d: WwPoliticsData = {
      countries,
      details,
      global: this.polGlobalDirty ? this.globalData() : null,
      regions: [...this.dirtyPolRegions]
        .sort((a, b) => a - b)
        .map((id) => ({ id, legalOwner: this.legalOwner[id] })),
      news: this.newsOut,
      cards: this.cardsOut,
    };
    this.dirtyPolCountries.clear();
    this.dirtyPolRegions.clear();
    this.polGlobalDirty = false;
    this.newsOut = [];
    this.cardsOut = [];
    return d;
  }

  summary(c: CountryPol): WwPolSummary {
    const id = c.smallID;
    return {
      smallID: id,
      ruling: c.ruling,
      leader: c.leader,
      pop: [...c.pop],
      stabBp: c.stabBp,
      wsBp: c.wsBp,
      ppMilli: this.isHuman(id) ? c.ppMilli : 0,
      faction: this.factionIdx(id),
      surrenderPct: this.surrenderPct(id),
      focus: c.focus?.id ?? null,
    };
  }

  detail(c: CountryPol): WwPolDetail {
    const id = c.smallID;
    const day = this.day();
    let focus: WwPolDetail["focus"] = null;
    if (c.focus !== null) {
      const fi = this.content.focusIdx.get(c.focus.id);
      const days = fi === undefined ? 0 : this.content.focuses[fi].days;
      focus = {
        id: c.focus.id,
        progressMilli: c.focus.progressMilli,
        daysMilli: days * 1000,
      };
    }
    const j = c.justification;
    return {
      smallID: id,
      ppGainMilli: this.dailyGainMilli(id),
      focus,
      queued: c.queued,
      cards: focusCards(this, id),
      advisors: [...c.advisors],
      advisorLockUntil: [...c.advisorLockUntil],
      candidates: candidatesFor(this, id, day),
      spirits: c.spirits.map((s) => ({ id: s.id, untilDay: s.untilDay })),
      decisions: decisionCards(this, id),
      missions: c.missions.map((m) => ({ ...m })),
      justification:
        j === null
          ? null
          : {
              on: j.on,
              type: j.type,
              progressDays: j.progressDays,
              totalDays: j.totalDays,
              blocked: justificationBlocked(this, id),
            },
      warGoals: c.warGoals.map((g) => ({
        on: g.on,
        type: g.type,
        untilDay: g.untilDay,
      })),
      researchBonuses: c.researchBonuses.map((b) => ({
        branch: b.key,
        pct: b.pct,
        uses: b.uses,
      })),
      statParts: this.statParts(c).map(statsArray),
      stats: statsArray(c.stats),
      stabBaseBp: c.stabBaseBp,
      wsBaseBp: c.wsBaseBp,
      nextElectionDay: c.nextElectionDay,
      crisisDays: [...c.crisisDays],
      pending: c.pending.map((p) => ({ ...p, open: openOptions(this, id, p) })),
      stabLines: stabilityLines(this, id, "stab"),
      wsLines: stabilityLines(this, id, "ws"),
    };
  }

  globalData(): WwPolGlobal {
    const threat: [number, number][] = [];
    for (let id = 1; id < this.threatBp.length; id++) {
      if (this.threatBp[id] > 0) threat.push([id, this.threatBp[id]]);
    }
    threat.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const justifying: [number, number, number][] = [];
    for (const c of this.list()) {
      const j = c.justification;
      if (j !== null) {
        justifying.push([c.smallID, j.on, j.totalDays - j.progressDays]);
      }
    }
    let nextBeatDay = -1;
    for (const b of this.beats) {
      if (b.skipped || b.done) continue;
      if (nextBeatDay < 0 || b.fireDay < nextBeatDay) nextBeatDay = b.fireDay;
    }
    return {
      wtBp: this.wtBp,
      threat: threat.slice(0, 10),
      factions: this.factions.map((f) => ({
        idx: f.idx,
        key: factionKeyOf(f.idx),
        name: f.name,
        nameTag: f.nameTag,
        leader: f.leader,
        members: [...f.members],
      })),
      guarantees: this.guarantees.map((g) => [g.by, g.to]),
      naps: this.naps.map((n) => [n.a, n.b, n.sinceDay, n.startTreaty]),
      access: this.access.map((x) => [x.by, x.from]),
      justifying,
      nextBeatDay,
    };
  }

  // ---- Snapshot, hash (spec §22.5) ----

  snapshot(): WwPoliticsState {
    return {
      seed: this._seed,
      rolled: this._rolled,
      lastCommonDay: this.lastCommonDay,
      countries: this.list().map((c) => this.countrySnapshot(c)),
      wtBp: this.wtBp,
      threatBp: [...this.threatBp],
      factions: this.factions.map((f) => ({
        idx: f.idx,
        name: f.name,
        nameTag: f.nameTag,
        leader: f.leader,
        members: [...f.members],
        createdDay: f.createdDay,
      })),
      nextFactionIdx: this.nextFactionIdx,
      guarantees: this.guarantees.map((g) => [g.by, g.to, g.sinceDay]),
      naps: this.naps.map((n) => [n.a, n.b, n.sinceDay, n.startTreaty]),
      access: this.access.map((x) => [x.by, x.from]),
      opinions: this.opinions.map((o) => [o.a, o.b, o.value, o.untilDay]),
      legalOwner: Array.from(this.legalOwner),
      gflags: [...this.gflags],
      firedOnceGlobal: [...this.firedOnceGlobal],
      removedGenerals: [...this.removedGenerals],
      delayed: this.delayed.map((d) => ({ ...d })),
      nextSeq: this.nextSeq,
      beats: this.beats.map((b) => [b.fireDay, b.skipped, b.done]),
      branchDeviations: [...this.branchDeviations],
      nextUid: this.nextUid,
    };
  }

  /**
   * Maps and sets are written in their iteration (insertion) order, so a
   * restored game iterates them exactly as the live one does.
   */
  private countrySnapshot(c: CountryPol): WwPoliticsState["countries"][number] {
    const done: string[] = [];
    const bypassed: string[] = [];
    this.content.treeFocuses[c.tree].forEach((fi, pos) => {
      const id = this.content.focuses[fi].id;
      if (c.focusState[pos] === 1) done.push(id);
      else if (c.focusState[pos] === 2) bypassed.push(id);
    });
    return {
      smallID: c.smallID,
      ppMilli: c.ppMilli,
      ppCumMilli: c.ppCumMilli,
      stabBaseBp: c.stabBaseBp,
      wsBaseBp: c.wsBaseBp,
      stabBp: c.stabBp,
      wsBp: c.wsBp,
      pop: [...c.pop],
      ruling: c.ruling,
      leader: c.leader,
      tree: c.tree,
      nextElectionDay: c.nextElectionDay,
      electionsSuspended: c.electionsSuspended,
      crisisDays: [...c.crisisDays],
      crisisCooldownUntil: c.crisisCooldownUntil,
      spirits: c.spirits.map((s) => ({ ...s })),
      advisors: [...c.advisors],
      advisorLockUntil: [...c.advisorLockUntil],
      candidates: [...c.candidates],
      dismissed: [...c.dismissed],
      personTraits: c.personTraits.map(([p, t]) => [p, t]),
      focus: c.focus === null ? null : { ...c.focus },
      queued: c.queued,
      done,
      bypassed,
      focusesDone: c.focusesDone,
      partial: [...c.partial],
      decisionCooldown: [...c.decisionCooldown],
      missions: c.missions.map((m) => ({ ...m })),
      unlocked: [...c.unlocked],
      locked: [...c.locked],
      taken: [...c.taken],
      flags: [...c.flags].map(([f, [a, b]]) => [f, a, b]),
      justification: c.justification === null ? null : { ...c.justification },
      warGoals: c.warGoals.map((g) => ({ ...g })),
      researchBonuses: c.researchBonuses.map((b) => ({ ...b })),
      extraResearchSlots: c.extraResearchSlots,
      reserved: [...c.reserved],
      pending: c.pending.map((p) => ({ ...p })),
      firedOnce: [...c.firedOnce],
      eventCooldown: [...c.eventCooldown],
      improveCooldown: [...c.improveCooldown],
      declaredOn: [...c.declaredOn],
      stats: statsArray(c.stats),
    };
  }

  restoreState(s: WwPoliticsState): void {
    this._seed = s.seed;
    this._rolled = s.rolled;
    this.lastCommonDay = s.lastCommonDay;
    for (const x of s.countries) {
      const c = this.countries[x.smallID];
      if (c === null || c === undefined) continue;
      c.ppMilli = x.ppMilli;
      c.ppCumMilli = x.ppCumMilli;
      c.stabBaseBp = x.stabBaseBp;
      c.wsBaseBp = x.wsBaseBp;
      c.stabBp = x.stabBp;
      c.wsBp = x.wsBp;
      c.pop = [...x.pop];
      c.ruling = x.ruling;
      c.leader = x.leader;
      c.tree = x.tree;
      c.nextElectionDay = x.nextElectionDay;
      c.electionsSuspended = x.electionsSuspended;
      c.crisisDays = [...x.crisisDays];
      c.crisisCooldownUntil = x.crisisCooldownUntil;
      c.spirits = x.spirits.map((v) => ({ ...v }));
      c.advisors = [...x.advisors];
      c.advisorLockUntil = [...x.advisorLockUntil];
      c.candidates = [...x.candidates];
      c.dismissed = [...x.dismissed];
      c.personTraits = x.personTraits.map(([p, t]) => [p, t as TraitId]);
      c.focus = x.focus === null ? null : { ...x.focus };
      c.queued = x.queued;
      // Spec §22.5: by id; an id no longer in this tree is dropped.
      c.focusState = new Uint8Array(this.content.treeFocuses[c.tree].length);
      // P6 (pre-flight §0-1): the position in the country's tree (a pack's too).
      const mark = (id: string, v: number) => {
        const pos = treePosIn(this.content, c.tree, id);
        if (pos === undefined) return;
        c.focusState[pos] = v;
      };
      for (const id of x.done) mark(id, 1);
      for (const id of x.bypassed) mark(id, 2);
      c.focusesDone = x.focusesDone;
      c.partial = new Map(x.partial);
      c.decisionCooldown = new Map(x.decisionCooldown);
      c.missions = x.missions.map((m) => ({ ...m }));
      c.unlocked = new Set(x.unlocked);
      c.locked = new Set(x.locked);
      c.taken = new Set(x.taken);
      c.flags = new Map(x.flags.map(([f, a, b]) => [f, [a, b]]));
      c.justification =
        x.justification === null ? null : { ...x.justification };
      c.warGoals = x.warGoals.map((g) => ({ ...g }));
      c.researchBonuses = x.researchBonuses.map((b) => ({ ...b }));
      c.extraResearchSlots = x.extraResearchSlots;
      c.reserved = [...x.reserved];
      c.pending = x.pending.map((p) => ({ ...p }));
      c.firedOnce = new Set(x.firedOnce);
      c.eventCooldown = new Map(x.eventCooldown);
      c.improveCooldown = new Map(x.improveCooldown);
      c.declaredOn = [...x.declaredOn];
      // The stats object is kept: CountryEconomy.stats is the same one.
      WW_STAT_KEYS.forEach((k, i) => {
        c.stats[k] = x.stats[i] ?? 0;
      });
    }
    this.wtBp = s.wtBp;
    this.threatBp = [...s.threatBp];
    this.factions = s.factions.map((f) => ({
      idx: f.idx,
      name: f.name,
      nameTag: f.nameTag as CountryTag | "",
      leader: f.leader,
      members: [...f.members],
      createdDay: f.createdDay,
    }));
    this.nextFactionIdx = s.nextFactionIdx;
    this.guarantees = s.guarantees.map(([by, to, sinceDay]) => ({
      by,
      to,
      sinceDay,
    }));
    this.naps = s.naps.map(([a, b, sinceDay, startTreaty]) => ({
      a,
      b,
      sinceDay,
      startTreaty,
    }));
    this.access = s.access.map(([by, from]) => ({ by, from }));
    this.opinions = s.opinions.map(([a, b, value, untilDay]) => ({
      a,
      b,
      value,
      untilDay,
    }));
    this.legalOwner.set(s.legalOwner);
    this.gflags = new Map(s.gflags);
    this.firedOnceGlobal = new Set(s.firedOnceGlobal);
    this.removedGenerals = new Set(s.removedGenerals);
    this.delayed = s.delayed.map((d) => ({ ...d }));
    this.nextSeq = s.nextSeq;
    // Beats are by content position; a longer table's new beats stay off
    // (no content changes mid-game: server and clients run one build).
    this.beats = this.content.beats.map((b, i) => {
      const v = s.beats[i];
      return v === undefined
        ? { fireDay: dayOfDate(b.date), skipped: true, done: false }
        : { fireDay: v[0], skipped: v[1], done: v[2] };
    });
    this.branchDeviations = new Map(s.branchDeviations);
    this.nextUid = s.nextUid;
    this.rebuildDerived();
    // The stats stay as written (a recompute could differ: not every
    // source change recomputes at once). Controller ruling C1: the land
    // war's sides were rebuilt before politics was restored.
    this.land.onFactionsChanged();
    for (const c of this.list()) this.markCountry(c.smallID);
    for (const r of this.ww.scenario.landRegions)
      this.dirtyPolRegions.add(r.id);
    this.polGlobalDirty = true;
  }

  /** Factions' reverse index, the economy's stats alias and tech hook. */
  rebuildDerived(): void {
    this.rebuildFactionIndex();
    for (const c of this.list()) {
      const ce = this.econ.country(c.smallID);
      if (ce === null) continue;
      ce.stats = c.stats;
      ce.onTechChanged = (id) => this.recomputeStats(id);
    }
    this.eventQueue = [];
  }

  private rebuildFactionIndex(): void {
    this.factionOfIdx.fill(-1);
    for (const f of this.factions) {
      for (const m of f.members) this.factionOfIdx[m] = f.idx;
    }
  }

  /**
   * Spec §15.3: call after any faction change (sides, trade partners). The
   * tick's event queue stays as it is.
   */
  factionsChanged(): void {
    this.rebuildFactionIndex();
    this.land.onFactionsChanged();
    for (const c of this.list()) this.markCountry(c.smallID);
    this.polGlobalDirty = true;
  }

  hash(): number {
    let h = 43;
    const add = (v: number) => {
      h = (Math.imul(h, 31) + v) | 0;
    };
    for (const c of this.list()) {
      add(c.ppMilli);
      add(c.stabBp);
      add(c.wsBp);
      for (const p of c.pop) add(p);
      add(c.ruling);
      add(c.focusesDone);
      add(c.pending.length);
      add(c.advisors.filter((a) => a !== null).length);
    }
    add(this.wtBp);
    for (const f of this.factions) add(f.idx * 97 + f.members.length);
    add(this.guarantees.length);
    add(this.naps.length);
    add(this.access.length);
    const owners = this.ww.scenario.ownerByRegion();
    let moved = 0;
    for (const r of this.ww.scenario.landRegions) {
      if (this.legalOwner[r.id] !== owners[r.id]) moved++;
    }
    add(moved);
    add(this.delayed.length);
    add(this.beats.filter((b) => b.done).length);
    // P3 Task 17 (hash coverage, spec §22.5): everything the snapshot
    // holds, so a desync in a focus's progress, a justification, a flag or
    // the delay list shows on the tick it happens. Derived fields
    // (DERIVED_FIELDS) are not in the snapshot.
    return foldPlain(h, this.snapshot()) >>> 0;
  }
}

/**
 * Folds a snapshot value into a hash: integers (every number of the
 * politics snapshot is one), booleans, strings (FNV-1a), arrays with their
 * length, objects in their key order (the snapshot builds them in one).
 */
function foldPlain(h: number, v: unknown): number {
  if (v === null || v === undefined) return (Math.imul(h, 31) + 1) | 0;
  switch (typeof v) {
    case "number":
      return (Math.imul(h, 31) + (v | 0)) | 0;
    case "boolean":
      return (Math.imul(h, 31) + (v ? 3 : 2)) | 0;
    case "string":
      return (Math.imul(h, 31) + idHash(v)) | 0;
    default:
      break;
  }
  if (Array.isArray(v)) {
    let x = (Math.imul(h, 31) + v.length) | 0;
    for (const e of v) x = foldPlain(x, e);
    return x;
  }
  let x = h;
  for (const k of Object.keys(v as object)) {
    x = foldPlain(x, (v as Record<string, unknown>)[k]);
  }
  return x;
}
