// World War 1936 P6 — the depth systems' state (P6 spec §2.2, §21.1; plan
// decisions 2, 3, 12, 16, 22–24, 39): one record per country (doctrine,
// command, designs, MIOs, intelligence, projects, mechanisms — each lane
// owns one sub-object), the global tables, the tick order, the order
// routing, the queries every lane shares, the screens' data, the snapshot
// and the hash. Lanes fill the stub files this one calls.
import type { DepthOrder, WwOrder } from "@openfront/engine-api/Schemas";
import { AIR_MISSIONS } from "@openfront/engine-api/ww1936/AirTypes";
import {
  ATOMIC_MILESTONES_PM,
  DEPTH_ORDER_KINDS,
  DESIGN_KINDS,
  DESIGN_ORIGINS,
  DesignDefSchema,
  DesignKind,
  DesignStats,
  FACILITY_IDS,
  FM_TRAITS,
  GRAND_DOCTRINES,
  INTEL_MISSIONS as INTEL_MISSION_IDS,
  INTEL_OPERATIONS as INTEL_OPERATION_IDS,
  KeyStatsTable,
  MIO_FAMILIES,
  SPECIAL_PROJECTS,
  SUBDOCTRINES,
  TREATY_END_DATE,
  WW_PLANE_DESIGN_SLOTS,
  WW_SHIP_DESIGN_SLOTS,
  WW_TANK_DESIGN_SLOTS,
  WwArmyGroupData,
  WwDepthData,
  WwDepthDetail,
  WwDepthFx,
  WwDepthSummary,
  WwDepthWorld,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  RESOURCE_COUNT,
  RESOURCE_IDS,
  WW_DAY_SPLIT,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { cpDayMilli } from "@openfront/engine-lib/ww1936/CommandRules";
import { bytesOfHex, hexOf } from "@openfront/engine-lib/ww1936/DepthRules";
import {
  DesignCtx,
  designStats,
  PLANE_MODULE_DEFS,
  SHIP_MODULE_DEFS,
  TANK_MODULE_DEFS,
} from "@openfront/engine-lib/ww1936/DesignRules";
import {
  AIR_SHARE_MICRO_PER_SORTIE,
  landCombatShare,
  masteryLevel,
  NAVAL_SHARE_MICRO,
  startDoctrinePick,
} from "@openfront/engine-lib/ww1936/DoctrineRules";
import { energyPenaltyPct } from "@openfront/engine-lib/ww1936/EnergyRules";
import { marketPriceMilli } from "@openfront/engine-lib/ww1936/MarketRules";
import { BOP_DEFS, bopBand } from "@openfront/engine-lib/ww1936/MechRules";
import { mioPoints, mioSize } from "@openfront/engine-lib/ww1936/MioRules";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import { addStatsInto, emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { STATIC_KEY_STATS } from "@openfront/engine-lib/ww1936/TemplateStats";
import { z } from "zod";
import type { Game } from "../../game/Game";
import { aiPersonality } from "../economy/AiEconomy";
import type { LandDepthHooks } from "../land/DepthHooks";
import type { WorldWar } from "../WorldWar";
import { dailyIntel, issueIntel } from "./Agency";
import { aiCommandDay } from "./AiCommand";
import { aiDesignsDay } from "./AiDesigns";
import { aiIntelDay } from "./AiIntel";
import { aiMarketDay } from "./AiMarket";
import { aiMechDay } from "./AiMech";
import { aiProjectsDay } from "./AiProjects";
import { airZoneDay, issueSeaAir, reconPlanCutBp } from "./AirExtras";
import { aiSeaAirDay } from "./AiSeaAir";
import { aiWorldDay } from "./AiWorld";
import { dailyArmyGroups, issueArmyGroup } from "./ArmyGroups";
import { nukeCutPp, processNukeQueue } from "./Atomic";
import {
  commandLandMods,
  dailyCommand,
  issueCommand,
  medalXpPct,
  reinforceOrder,
  spiritStatsOf,
  tricksterCutBp,
} from "./Command";
import { mechStatsOf } from "./ContinuousFocus";
import { cipherOf, decryptOf } from "./Crypto";
import {
  dailyDesigns,
  designInUse,
  equipCostMilli,
  fillDesignRows,
  issueDesign,
} from "./Designs";
import {
  dailyDoctrine,
  doctrineGainMilli,
  doctrineStatsOf,
  issueDoctrine,
} from "./Doctrine";
import { coalDemand, dailyEnergy, energyDemand } from "./Energy";
import { computeIntelRow } from "./IntelLevels";
import { landmarkStatsOf } from "./Landmarks";
import { dayCommonMarket, issueTrade } from "./Market";
import { dailyMechanisms, dayCommonMech, issueMech } from "./Mechanisms";
import { seaRegionDay } from "./Mines";
import { dailyMio, issueMio, mioStatsOf } from "./Mio";
import {
  collabCutPp,
  intelResistancePp,
  operationSuccessPm,
} from "./Operations";
import { operativeCapturePm } from "./Operatives";
import {
  dailyProjects,
  issueProjects,
  onRegionControl,
  projectEta,
  uraniumDemand,
} from "./Projects";
import { processRaids } from "./Raids";
import { railGunFortCut, railGunHits } from "./RailGuns";
import { processRockets } from "./Rockets";
import { dayCommonWorld, issueWorld, regionStatus } from "./World";

export type { KeyStatsTable } from "@openfront/engine-api/ww1936/DepthTypes";

const zIds = () => z.array(zInt());
const DesignSlotSchema = z.object({
  def: DesignDefSchema,
  origin: z.enum(DESIGN_ORIGINS),
  from: zInt(),
  fromSlot: zInt(),
  obsolete: z.boolean(),
  savedDay: zInt(),
});
export type DesignSlot = z.infer<typeof DesignSlotSchema>;
const OperativeSchema = z.object({
  uid: zInt(),
  codename: zInt(),
  skill: zInt(),
  abroadDays: zInt(),
  state: zInt(),
  target: zInt(),
  /** INTEL_MISSIONS index, -1 none. */
  mission: zInt(),
  op: zInt(),
  sinceDay: zInt(),
  travelLeft: zInt(),
  releaseDay: zInt(),
  recruitLeft: zInt(),
});
export type Operative = z.infer<typeof OperativeSchema>;
const CountryDepthSchema = z.object({
  doc: z.object({
    gd: zIds(),
    gdLock: zIds(),
    sub: zIds(),
    subLock: zIds(),
    masteryMilli: zIds(),
    announced: zIds(),
  }),
  cmd: z.object({
    cpMilli: zInt(),
    spirits: zIds(),
    spiritLock: zIds(),
    medalReady: z.array(z.tuple([zInt(), zInt()])),
  }),
  des: z.object({
    tank: z.array(DesignSlotSchema.nullable()),
    plane: z.array(DesignSlotSchema.nullable()),
    ship: z.array(DesignSlotSchema.nullable()),
  }),
  mio: z.object({
    arch: zIds(),
    fundsMilli: zIds(),
    traits: zIds(),
    investReady: zIds(),
    sizeSeen: zIds(),
  }),
  intel: z.object({
    agency: z.boolean(),
    upgrades: zInt(),
    upId: zInt(),
    upMilli: zInt(),
    operatives: z.array(OperativeSchema),
    nextCodename: zInt(),
    cryptoTarget: zInt(),
    propagandaBp: z.array(z.tuple([zInt(), zInt()])),
    collabPp: z.array(z.tuple([zInt(), zInt()])),
  }),
  proj: z.object({
    running: z.array(
      z.object({
        project: zInt(),
        facility: zInt(),
        progressMilli: zInt(),
        scientist: zInt(),
      }),
    ),
    done: zInt(),
    scientists: z.array(
      z.object({
        id: zInt(),
        spec: zInt(),
        skill: zInt(),
        sinceDay: zInt(),
        project: zInt(),
      }),
    ),
    atomic: z.array(z.tuple([zInt(), zInt()])),
    blueprints: zInt(),
    halved: zInt(),
    nukedCount: zInt(),
    rocketRest: zInt(),
  }),
  mech: z.object({
    cfocus: zInt(),
    cfocusLock: zInt(),
    cfocusOpen: z.boolean(),
    energyPm: zInt(),
    energyExtra: zInt(),
    shortageNoteDay: zInt(),
    /** Unused placeholder kept 0 (append-only shape for later). */
    xpTank: zInt(),
  }),
});
export type CountryDepth = z.infer<typeof CountryDepthSchema>;

export const WwDepthStateSchema = z.object({
  lastCommonDay: zInt(),
  nextUid: zInt(),
  countries: z.array(CountryDepthSchema.nullable()),
  /** Plan decision 12: N × 9 micro-mastery since each country's last turn. */
  dayTally: zIds(),
  groups: z.array(
    z.object({
      id: zInt(),
      owner: zInt(),
      fm: zInt(),
      armies: zIds(),
      auto: z.boolean(),
    }),
  ),
  market: z.object({
    listings: z.array(
      z.object({
        id: zInt(),
        seller: zInt(),
        key: zInt(),
        design: DesignDefSchema.nullable(),
        count: zInt(),
        reserved: zInt(),
      }),
    ),
    deals: z.array(
      z.object({
        id: zInt(),
        buyer: zInt(),
        seller: zInt(),
        key: zInt(),
        design: DesignDefSchema.nullable(),
        count: zInt(),
        priceMilli: zInt(),
        paidMilli: zInt(),
        deliveredMilli: zInt(),
        civs: zInt(),
        startDay: zInt(),
        endDay: zInt(),
      }),
    ),
    licences: z.array(
      z.object({
        id: zInt(),
        from: zInt(),
        to: zInt(),
        key: zInt(),
        ship: zInt(),
        slot: zInt(),
        sinceDay: zInt(),
      }),
    ),
    pending: z.array(
      z.object({
        id: zInt(),
        from: zInt(),
        to: zInt(),
        key: zInt(),
        ship: zInt(),
        deadlineTick: zInt(),
      }),
    ),
    embargoes: z.array(z.tuple([zInt(), zInt()])),
  }),
  intelNet: z.array(z.tuple([zInt(), zInt()])),
  ops: z.array(
    z.object({
      uid: zInt(),
      kind: zInt(),
      owner: zInt(),
      target: zInt(),
      operatives: zIds(),
      startDay: zInt(),
      endDay: zInt(),
    }),
  ),
  infiltrations: z.array(z.tuple([zInt(), zInt(), zInt()])),
  decrypted: z.array(
    z.object({
      o: zInt(),
      t: zInt(),
      progressMilli: zInt(),
      activeUntil: zInt(),
    }),
  ),
  intelLevels: z.string(),
  nukeQueue: z.array(
    z.object({
      owner: zInt(),
      region: zInt(),
      zone: zInt(),
      rocket: z.boolean(),
      day: zInt(),
    }),
  ),
  rocketQueue: z.array(
    z.object({
      owner: zInt(),
      site: zInt(),
      target: zInt(),
      kind: zInt(),
      count: zInt(),
      day: zInt(),
    }),
  ),
  raids: z.array(
    z.object({
      uid: zInt(),
      owner: zInt(),
      kind: zInt(),
      unit: zInt(),
      target: zInt(),
      building: zInt(),
      readyDay: zInt(),
    }),
  ),
  nuked: z.array(z.tuple([zInt(), zInt()])),
  mech: z.object({
    congressBp: zInt(),
    congressFull: zInt(),
    attackedUntil: zInt(),
    isolationCleared: z.boolean(),
    bop: z.array(z.tuple([zInt(), zInt(), zInt()])),
    treaty: z.object({
      members: zIds(),
      escalated: z.boolean(),
      ended: z.boolean(),
      leaving: z.array(z.tuple([zInt(), zInt()])),
    }),
    factionRules: z.array(z.tuple([zInt(), zInt(), z.boolean(), zInt()])),
    factionGoals: z.array(
      z.object({ faction: zInt(), slots: zIds(), achieved: zInt() }),
    ),
  }),
  sea: z.object({
    mines: z.array(z.tuple([zInt(), zInt(), zInt()])),
    aces: z.array(
      z.object({
        id: zInt(),
        owner: zInt(),
        deployment: zInt(),
        sinceDay: zInt(),
        callNo: zInt(),
      }),
    ),
    /** Pre-flight §0-8 (W2): [side, strategic region, recon sorties] of the zone's last day. */
    reconBySide: z.array(z.tuple([zInt(), zInt(), zInt()])),
  }),
  world: z.object({
    damLevel: zIds(),
    floodUntil: z.array(z.tuple([zInt(), zInt()])),
    scorchQueue: z.array(z.tuple([zInt(), zInt(), zInt()])),
    scorchedUntil: z.array(z.tuple([zInt(), zInt()])),
    harbors: z.array(z.tuple([zInt(), zInt(), zInt()])),
    exhaustedUntil: z.array(z.tuple([zInt(), zInt()])),
    /** Spec §16.5: [army, owner, guns, last region] mirror, so guns of a vanished army return or are lost. */
    railGuns: z.array(z.tuple([zInt(), zInt(), zInt(), zInt()])),
    /**
     * Pre-flight §0-8 (W1): [region, supplyPm, buildPct, moveCutPct,
     * resourcePct] of the regions whose status is not neutral, by region.
     */
    regionStatus: z.array(z.tuple([zInt(), zInt(), zInt(), zInt(), zInt()])),
  }),
  /** Pre-flight §0-8 (I): [region, resistance pp] the operations add. */
  resistBoost: z.array(z.tuple([zInt(), zInt()])),
  /** Pre-flight §0-8 (plan decision 22): [smallID, RESOURCE_IDS-ordered units] P1 handed out first. */
  lastPriorityGot: z.array(z.tuple([zInt(), zIds()])),
  /** Daily one-line batches [to, kind, a, b, n] (kinds: 0 rocket hits, 1 mastery level, 2 energy). */
  dayNotes: z.array(z.tuple([zInt(), zInt(), zInt(), zInt(), zInt()])),
});
export type WwDepthState = z.infer<typeof WwDepthStateSchema>;

export type Domain = 0 | 1 | 2;

/**
 * Pre-flight §0-2: an army's depth values for P2's ModInput — O(1) reads
 * of what lane D stores on the owner's day (field marshal, officer corps,
 * medal, decryption), so the battle mods cache stays exact.
 */
export interface ArmyDepthMods {
  fmAtt: number;
  fmDef: number;
  /** FM_TRAITS bits. */
  fmTraits: number;
  cmdAttBp: number;
  cmdDefBp: number;
  /** Spec §4.2 guerrilla_fighter (the army's general or its group): supply penalties halved. */
  halfSupply: boolean;
  // Review L4 (spec §4.3, §4.5; FM_TRAIT_STATS, MEDAL_STATS): the army's
  // non-combat command effects, read by P2 where its country stats are.
  /** Org points added to the max org of the army's divisions (fm_inspiring). */
  orgAdd: number;
  /** Org recovery, percent (fm_inspiring, medal_service). */
  recoveryPct: number;
  /** Readiness growth, percent (fm_offensive, fm_fast_planner). */
  planSpeedPct: number;
  /** Readiness cap raise, bp (fm_thorough): ModInput's "fm_plan" line. */
  planMaxBp: number;
  /** Entrenchment speed, percent (fm_defensive). */
  entrenchSpeedPct: number;
  /** Supply use, percent (fm_logistics). */
  supplyUsePct: number;
  /** Spec §4.3: the field marshal's planning and logistics skills, added to the army general's. */
  fmPlan: number;
  fmLog: number;
}
export const NEUTRAL_ARMY_MODS: ArmyDepthMods = {
  fmAtt: 0,
  fmDef: 0,
  fmTraits: 0,
  cmdAttBp: 0,
  cmdDefBp: 0,
  halfSupply: false,
  orgAdd: 0,
  recoveryPct: 0,
  planSpeedPct: 0,
  planMaxBp: 0,
  entrenchSpeedPct: 0,
  supplyUsePct: 0,
  fmPlan: 0,
  fmLog: 0,
};

/** What lane D's commandLandMods is asked (pre-flight §0-2: per army, never per battle). */
export interface LandModQuery {
  owner: number;
  armyId: number;
}

export class WwDepth implements LandDepthHooks {
  // ---- state (snapshot) ----
  lastCommonDay = -1;
  nextUid = 1;
  countries: (CountryDepth | null)[] = [];
  dayTally: number[] = [];
  groups: WwDepthState["groups"] = [];
  market: WwDepthState["market"] = {
    listings: [],
    deals: [],
    licences: [],
    pending: [],
    embargoes: [],
  };
  intelNet = new Map<number, number>();
  ops: WwDepthState["ops"] = [];
  infiltrations: [number, number, number][] = [];
  decrypted: WwDepthState["decrypted"] = [];
  intelLevels = new Uint8Array(0);
  nukeQueue: WwDepthState["nukeQueue"] = [];
  rocketQueue: WwDepthState["rocketQueue"] = [];
  raids: WwDepthState["raids"] = [];
  nuked = new Map<number, number>();
  mech: WwDepthState["mech"] = {
    congressBp: 3_000,
    congressFull: -1,
    attackedUntil: -1,
    isolationCleared: false,
    bop: [],
    treaty: { members: [], escalated: false, ended: false, leaving: [] },
    factionRules: [],
    factionGoals: [],
  };
  sea: WwDepthState["sea"] = { mines: [], aces: [], reconBySide: [] };
  world: WwDepthState["world"] = {
    damLevel: new Array<number>(9).fill(0),
    floodUntil: [],
    scorchQueue: [],
    scorchedUntil: [],
    harbors: [],
    exhaustedUntil: [],
    railGuns: [],
    regionStatus: [],
  };
  resistBoost: [number, number][] = [];
  /** Pre-flight §0-8: state (P1 writes it on the economy turn, the depth turn reads it the next day). */
  lastPriorityGot = new Map<number, number[]>();
  dayNotes: [number, number, number, number, number][] = [];
  // ---- derived (DERIVED_FIELDS) ----
  /** smallID → kind → slot (1-based) → stats. */
  designStatCache = new Map<number, (DesignStats | null)[][]>();
  /** Pre-flight §0-3(a): rebuilt as a new object, never mutated (its identity joins P2's StatsInputs). */
  keyStatTables = new Map<number, KeyStatsTable>();
  /** LandDepthHooks.keyStatsSeq: moves with every keyStatTables change (derived). */
  keyStatsSeq = 1;
  /** armyMods' reused query (derived scratch). */
  private modQuery: LandModQuery = { owner: 0, armyId: 0 };
  /**
   * Strategic region → side → index in sea.mines (W2 review: P4 side keys
   * are smallIDs or 100000 + faction, so no flat composite). Derived:
   * rebuilt by reindexSparse.
   */
  mineIndex = new Map<number, Map<number, number>>();
  /** region → FACILITY_IDS index + 1. */
  facilityIndex = new Map<number, number>();
  /**
   * Review E16: O(1) reads of the §0-8 sparse tuples — key → index in
   * world.regionStatus (region), resistBoost (region) and sea.reconBySide
   * (side * 1024 + strategic region). Derived: rebuilt by reindexSparse,
   * which a lane calls after it adds or removes a tuple.
   */
  regionStatusIndex = new Map<number, number>();
  resistBoostIndex = new Map<number, number>();
  /** Side → strategic region → index in sea.reconBySide. */
  reconIndex = new Map<number, Map<number, number>>();
  /** Pre-flight §0-3(d): what each design cache row was built from (statsVer, researched, projects done). */
  private designCacheKey = new Map<
    number,
    [number, ReadonlySet<unknown>, number]
  >();
  /** Pre-flight §0-3(d): bumped on every design change of a country (P4's stats memos key on it). */
  private designVer = new Map<number, number>();
  // ---- this tick (not state) ----
  private depthFx: WwDepthFx[] = [];
  private depthNews: WwDepthData["news"] = [];
  private depthDirty = new Set<number>();
  private depthDirtyIntel = new Set<number>();
  private depthDirtyStats = new Set<number>();
  private depthDirtyDesigns: [number, DesignKind, number][] = [];
  private depthDirtyGlobal = true;
  readonly cap: number;

  constructor(
    readonly mg: Game,
    readonly ww: WorldWar,
  ) {
    // P5 decision 3: scenario countries include the dormant slots.
    this.cap = ww.scenario.countries.length + 1;
  }

  start(): void {
    this.countries = Array.from({ length: this.cap }, (_, id) =>
      id === 0 ? null : emptyCountry(),
    );
    this.dayTally = new Array<number>(this.cap * 9).fill(0);
    this.intelLevels = new Uint8Array(this.cap * this.cap * 4);
    // Review E12: no fog until lane I computes the rows (the stub's 100).
    this.intelLevels.fill(100);
    this.world.damLevel = this.ww.scenario.damRegion.map((r) =>
      r > 0 ? 1 : 0,
    );
    this.mech.bop = BOP_DEFS.map((b, i) => [i, b.startPm, bopBand(b.startPm)]);
    this.mech.treaty.members = ["GBR", "USA", "FRA"]
      .map((t) => this.ww.politics.idOfTag(t as never))
      .filter((id) => id > 0)
      .sort((a, b) => a - b);
    startDepthContent(this);
    this.rebuildDerived();
    // Plan decision 36: the first update carries every country.
    for (let id = 1; id < this.cap; id++) this.depthDirty.add(id);
    this.depthDirtyGlobal = true;
  }

  // ---- clock (plan decision 3) ----

  clock(ticks: number): void {
    if (this.ww.inPrep(ticks)) return;
    const day = this.ww.day(ticks);
    if (day !== this.lastCommonDay) {
      this.lastCommonDay = day;
      // Pre-flight §0-9: the seeded start choices on day 0's common step
      // (politics.seed is set by then).
      if (day === 0) this.startAiDoctrines();
      this.dayCommon(day, ticks);
    }
    // The P1 WwEconomy.tick split.
    const k = ticks - dayStartTick(day, this.ww.prepEndTick());
    if (k >= 0 && k < WW_DAY_SPLIT) {
      for (let id = 1; id < this.cap; id++) {
        if (id % WW_DAY_SPLIT === k && this.ww.isActor(id)) {
          this.countryTurn(id, day, ticks);
        }
      }
    }
    this.flushStats();
  }

  /**
   * Spec §3.5 / §19.2 (review E3): every AI country's grand doctrines and
   * sub-doctrines, once, on day 0 (DoctrineRules.startDoctrinePick). A
   * human picks for themselves.
   */
  private startAiDoctrines(): void {
    const content = this.ww.politics.content;
    const historical = this.mg.config().historicalAi() === true;
    const econ = this.ww.economy;
    for (let id = 1; id < this.cap; id++) {
      const c = this.countries[id];
      if (c === null || c === undefined) continue;
      if (isDormant(this, id) || !this.ww.isActor(id)) continue;
      if (this.ww.isHumanControlled(id)) continue;
      const tag = this.ww.tagOf(id);
      const ce = econ.country(id);
      const navy =
        ce !== null &&
        ce.totals.dock >= 3 &&
        econ.regionsOf(id).some((r) => this.ww.scenario.harborOf(r) !== 0);
      const pick = startDoctrinePick({
        table: content.startDoctrines,
        tag,
        personality: aiPersonality(tag),
        historical,
        navy,
        seed: this.ww.politics.seed,
        id,
      });
      applyStartDoctrine(c, pick.gd, pick.sub);
      this.markStats(id);
      this.depthDirty.add(id);
    }
  }

  dayCommon(day: number, tick: number): void {
    dayCommonMarket(this, day, tick); // M: deals pay and deliver, licence cards time out
    dayCommonWorld(this, day, tick); // W1: floods, harbours, scorch queue, exhausted resources, dam dates
    dayCommonMech(this, day, tick); // W3: faction goals, treaty clock, congress drift, BoP drift
    processRockets(this, day, tick); // S
    processRaids(this, day, tick); // S
  }

  countryTurn(id: number, day: number, tick: number): void {
    if (this.countries[id] === null || this.countries[id] === undefined) return;
    dailyEnergy(this, id, day); // W1
    dailyDoctrine(this, id, day); // D (reads and clears dayTally)
    dailyCommand(this, id, day); // D
    dailyArmyGroups(this, id, day); // D
    dailyDesigns(this, id, day); // E
    dailyMio(this, id, day); // M
    dailyIntel(this, id, day); // I (upgrades, operatives, missions, ops, crypto)
    computeIntelRow(this, id, day); // I (this observer's row of intelLevels)
    dailyProjects(this, id, day); // S
    dailyMechanisms(this, id, day); // W3 (congress for USA, BoP, continuous focus)
    // Plan decision 39: the lanes' AI, each deciding its own rhythm.
    if (!this.ww.isHumanControlled(id)) {
      aiCommandDay(this, id, day);
      aiDesignsDay(this, id, day);
      aiMarketDay(this, id, day);
      aiIntelDay(this, id, day);
      aiProjectsDay(this, id, day);
      aiWorldDay(this, id, day);
      aiSeaAirDay(this, id, day);
      aiMechDay(this, id, day);
    }
    this.depthDirty.add(id);
  }

  // ---- hooks called from P2/P4 (plan decision 37) ----

  /** P4 dailySeaRegion, after the convoy war. */
  seaRegionDay(sr: number, day: number): void {
    seaRegionDay(this, sr, day);
  }

  /** P4 WwAir, after the zone's mission effects: W2, then S's drops. */
  airZoneDay(sr: number, day: number, tick: number): void {
    airZoneDay(this, sr, day, tick);
    processNukeQueue(this, sr, day, tick);
  }

  /** Spec §16.5: centi-hits of railway guns for `side` in the battle at `region` this round. */
  railGunHits(region: number, side: number): number {
    return railGunHits(this, region, side);
  }

  /** Pre-flight §0-2: the army's ModInput values (lane D, O(1)). */
  armyMods(owner: number, armyId: number): ArmyDepthMods {
    if (this.countries[owner] === null || this.countries[owner] === undefined) {
      return NEUTRAL_ARMY_MODS;
    }
    // One query object, reused (per division and round: no allocation);
    // commandLandMods reads it and must not keep it.
    const q = this.modQuery;
    q.owner = owner;
    q.armyId = armyId;
    return commandLandMods(this, q);
  }

  /** The readiness cut `victim`'s enemies impose at `region` (recon W2, trickster D), bp ≤ 0. */
  planCutBp(victim: number, region: number): number {
    return (
      reconPlanCutBp(this, victim, region) +
      tricksterCutBp(this, victim, region)
    );
  }

  /** Spec §16.5: the fort levels the army's railway guns cut at `region`. */
  fortCut(armyId: number, region: number): number {
    return railGunFortCut(this, armyId, region);
  }

  reinforceOrder(id: number): number[] | null {
    return this.countries[id] === null || this.countries[id] === undefined
      ? null
      : reinforceOrder(this, id);
  }

  medalXpPct(armyId: number): number {
    return medalXpPct(this, armyId);
  }

  /** W1's region status: the supply multiplier, ‰. */
  supplyPm(region: number): number {
    return regionStatus(this, region).supplyPm;
  }

  /** W1's region status: movement into the region slowed, percent. */
  moveCutPct(region: number): number {
    return regionStatus(this, region).moveCutPct;
  }

  /** P2 WwLand.setController: facilities lost (S), landmarks (stats of both). */
  onRegionControl(
    region: number,
    from: number,
    to: number,
    tick: number,
  ): void {
    if (this.countries.length === 0) return;
    onRegionControl(this, region, from, to, tick);
    // Landmark stats are the only depth stats that follow control (lane S
    // marks its own facility losses).
    if (this.ww.scenario.landmarksOf(region).length > 0) {
      if (from > 0) this.markStats(from);
      if (to > 0) this.markStats(to);
    }
    this.facilityIndex.delete(region);
    const f = facilityOf(this.ww, region);
    if (f > 0) this.facilityIndex.set(region, f);
  }

  /** P1 construction (plan Task 1 Step 12): a dam's repair ends; level 1, its floods over. */
  onDamRepaired(region: number): void {
    const i = this.ww.scenario.damOf(region);
    if (i < 0 || this.world.damLevel.length === 0) return;
    this.world.damLevel[i] = 1;
    const down = new Set(this.ww.scenario.damDownstream[i] ?? []);
    this.world.floodUntil = this.world.floodUntil.filter(([r]) => !down.has(r));
    this.markGlobal();
    const owner = this.ww.economy.controllerOf(region);
    if (owner > 0) this.markStats(owner);
  }

  /** P1 construction: a facility stands in the region now (S's projects read the index). */
  onFacilityBuilt(region: number): void {
    const f = facilityOf(this.ww, region);
    if (f > 0) this.facilityIndex.set(region, f);
    const owner = this.ww.economy.controllerOf(region);
    if (owner > 0) this.markCountry(owner);
  }

  /** Plan decision 12: one division's day of land combat. */
  noteLandCombat(
    owner: number,
    infHalf: number,
    armorHalf: number,
    supportHalf: number,
  ): void {
    if (owner <= 0 || owner >= this.cap || this.dayTally.length === 0) return;
    const [a, b, c] = landCombatShare(infHalf, armorHalf, supportHalf);
    const o = owner * 9;
    this.dayTally[o] += a;
    this.dayTally[o + 1] += b;
    this.dayTally[o + 2] += c;
  }

  /** Plan decision 12: ships in a naval battle (once a day each) or on a mission (the fleet's day). */
  noteNavalCombat(
    owner: number,
    cls: number,
    battle: boolean,
    ships = 1,
  ): void {
    noteNaval(this, owner, cls, battle, ships);
  }

  /** Plan decision 12: a zone's sorties of a mission (AIR_MISSIONS index). */
  noteSorties(owner: number, mission: number, sorties: number): void {
    noteAir(this, owner, mission, sorties);
  }

  // ---- economy hooks (plan decisions 22, 23) ----

  energyOutputPct(id: number): number {
    const c = this.countries[id];
    return c === null || c === undefined
      ? 0
      : energyPenaltyPct(c.mech.energyPm);
  }

  /** RESOURCE_IDS-ordered units taken before the lines: uranium (S), coal (W1). */
  priorityDemand(id: number): number[] {
    const out = new Array<number>(RESOURCE_COUNT).fill(0);
    const c = this.countries[id];
    if (c === null || c === undefined) return out;
    out[RESOURCE_IDS.indexOf("uranium")] = uraniumDemand(this, id);
    out[RESOURCE_IDS.indexOf("coal")] = coalDemand(this, id);
    return out;
  }

  priorityGot(id: number, got: readonly number[]): void {
    const m = this.lastPriorityGot;
    if (got.every((v) => v === 0)) {
      m.delete(id);
      return;
    }
    const had = m.has(id);
    m.set(id, [...got]);
    // Kept in smallID order (a restore builds it sorted).
    if (!had) {
      const sorted = [...m.entries()].sort((a, b) => a[0] - b[0]);
      m.clear();
      for (const [k, v] of sorted) m.set(k, v);
    }
  }

  civsOut(id: number): number {
    return this.countries[id] === null || this.countries[id] === undefined
      ? 0
      : civFlow(this, id).out;
  }

  civsIn(id: number): number {
    return this.countries[id] === null || this.countries[id] === undefined
      ? 0
      : civFlow(this, id).in;
  }

  embargoed(a: number, b: number): boolean {
    return this.market.embargoes.some(
      ([x, y]) => (x === a && y === b) || (x === b && y === a),
    );
  }

  // ---- shared queries ----

  country(id: number): CountryDepth | null {
    return this.countries[id] ?? null;
  }

  nukesOn(): boolean {
    return this.mg.config().gameConfig().ww1936Nukes === true;
  }

  /** Pre-flight §0-11: Korea's and Taiwan's regions are never struck. */
  noStrike(region: number): boolean {
    return (
      isNoStrike(this.ww.scenario, region) ||
      this.ww.politics.content.noStrikeRegions.has(region)
    );
  }

  designSlot(id: number, kind: DesignKind, slot: number): DesignSlot | null {
    const c = this.countries[id];
    return c === null || c === undefined || slot < 1
      ? null
      : (c.des[kind][slot - 1] ?? null);
  }

  designStatsOf(
    id: number,
    kind: DesignKind,
    slot: number,
  ): DesignStats | null {
    this.checkDesignCache(id);
    return (
      this.designStatCache.get(id)?.[DESIGN_KINDS.indexOf(kind)]?.[slot - 1] ??
      null
    );
  }

  keyStats(id: number): KeyStatsTable {
    this.checkDesignCache(id);
    let t = this.keyStatTables.get(id);
    if (t === undefined) {
      t = buildKeyStats(this, id);
      this.keyStatTables.set(id, t);
    }
    return t;
  }

  netPm(o: number, t: number): number {
    return Math.floor((this.intelNet.get(o * 1024 + t) ?? 0) / 1000);
  }

  netMilli(o: number, t: number): number {
    return this.intelNet.get(o * 1024 + t) ?? 0;
  }

  setNetMilli(o: number, t: number, v: number): void {
    const k = o * 1024 + t;
    const x = Math.max(0, Math.min(1_000_000, v));
    if (x === 0) this.intelNet.delete(k);
    else this.intelNet.set(k, x);
  }

  intelOf(o: number, t: number, domain: number): number {
    return this.intelLevels[(o * this.cap + t) * 4 + domain];
  }

  intelRow(o: number): Uint8Array {
    return this.intelLevels.subarray(o * this.cap * 4, (o + 1) * this.cap * 4);
  }

  projectDone(id: number, p: number): boolean {
    return ((this.countries[id]?.proj.done ?? 0) & (1 << p)) !== 0;
  }

  uid(): number {
    return this.nextUid++;
  }

  /** Plan decision 13 / spec §5.1: the experience of a domain (P2 army, P4 navy and air), whole points. */
  xpOf(id: number, domain: Domain): number {
    return Math.floor(xpMilliOf(this.ww, id, domain) / 1000);
  }

  spendXp(id: number, domain: Domain, points: number): boolean {
    if (this.xpOf(id, domain) < points) return false;
    addXpMilli(this.ww, id, domain, -points * 1000);
    return true;
  }

  /** Spec §20.11 notification to one country's controllers (P3 pol.message). */
  message(
    to: number,
    key: string,
    params: Record<string, string | number> = {},
  ): void {
    this.ww.politics.message(to, key, params);
  }

  messageAll(key: string, params: Record<string, string | number> = {}): void {
    this.ww.politics.messageAll(key, params);
  }

  news(id: string, params: Record<string, string | number>): void {
    this.depthNews.push({ id, params });
    this.ww.politics.news(id, params);
  }

  addFx(f: WwDepthFx): void {
    this.depthFx.push(f);
  }

  markCountry(id: number): void {
    this.depthDirty.add(id);
  }

  markIntel(id: number): void {
    this.depthDirtyIntel.add(id);
  }

  markGlobal(): void {
    this.depthDirtyGlobal = true;
  }

  /** Plan decision 24: the depth stats part changed → one recomputeStats at the end of the tick. */
  markStats(id: number): void {
    this.depthDirtyStats.add(id);
  }

  /** Pre-flight §0-3(d): the country's design version (derived; P4's memos compare it). */
  designVersion(id: number): number {
    return this.designVer.get(id) ?? 0;
  }

  markDesign(id: number, kind: DesignKind, slot: number): void {
    this.designVer.set(id, this.designVersion(id) + 1);
    this.depthDirtyDesigns.push([id, kind, slot]);
    this.refreshDesignCache(id);
    this.markStats(id);
  }

  markNuked(region: number, untilDay: number): void {
    // Sensitivity (decision 34): never a no-strike region, whatever calls.
    if (this.noStrike(region)) return;
    this.nuked.set(region, untilDay);
    this.depthDirtyGlobal = true;
  }

  /** P3 effectiveSurrenderPct: collaboration (I) and bombs (S), percentage points. */
  surrenderCutPp(id: number): number {
    if (this.countries[id] === null || this.countries[id] === undefined) {
      return 0;
    }
    return collabCutPp(this, id) + nukeCutPp(this, id);
  }

  /** P5 resistance target: operations (I) and a nuked region (+10), percentage points. */
  resistanceAdjPp(region: number): number {
    if (this.countries.length === 0) return 0;
    const nuked = (this.nuked.get(region) ?? -1) >= this.lastCommonDay ? 10 : 0;
    return intelResistancePp(this, region) + nuked;
  }

  /** Plan decision 24: the depth part of P3 recomputeStats (neutral before start). */
  statsPart(id: number): WwStats {
    const out = emptyStats();
    if (this.countries[id] === null || this.countries[id] === undefined) {
      return out;
    }
    for (const p of [
      doctrineStatsOf(this, id),
      spiritStatsOf(this, id),
      mioStatsOf(this, id),
      mechStatsOf(this, id),
      landmarkStatsOf(this, id),
    ]) {
      addStatsInto(out, p);
    }
    // Spec §9.6: the proximity fuze's artillery soft attack +5% (the
    // battalion step reads artillerySoftPct).
    if (this.projectDone(id, SPECIAL_PROJECTS.indexOf("sp_proximity_fuze"))) {
      addStatsInto(out, { artillerySoftPct: 5 });
    }
    return out;
  }

  private flushStats(): void {
    if (this.depthDirtyStats.size === 0) return;
    const ids = [...this.depthDirtyStats].sort((a, b) => a - b);
    this.depthDirtyStats.clear();
    // (The design caches follow lazily: checkDesignCache reads statsVer.)
    for (const id of ids) this.ww.politics.recomputeStats(id);
  }

  /**
   * Review E1 (plan decision 24): the tick's one stats recompute, at its
   * end (WorldWarExecution), so no mark crosses a tick boundary.
   */
  endTick(): void {
    this.flushStats();
  }

  // ---- orders (plan decision 4) ----

  issue(id: number, o: WwOrder, tick: number): WwOrderBlock | null {
    const c = this.countries[id];
    if (c === null || c === undefined || !this.ww.isActor(id)) return "dead";
    const k = DEPTH_ORDER_KINDS.indexOf(
      o.kind as (typeof DEPTH_ORDER_KINDS)[number],
    );
    if (k < 0) return "bad_index";
    const d = o as DepthOrder;
    // The kind ranges follow DEPTH_ORDER_KINDS: 0–1 doctrine, 2–4 and
    // 12–13 command, 5–11 army groups, 14–19 designs, 20–22 MIO, 23–30
    // trade, 31–39 intel, 40–46 projects, 47–51 mechanisms, 52–55 world,
    // 56 sea/air.
    let r: WwOrderBlock | null;
    if (k <= 1) r = issueDoctrine(this, id, d, tick);
    else if (k <= 4 || k === 12 || k === 13)
      r = issueCommand(this, id, d, tick);
    else if (k <= 11) r = issueArmyGroup(this, id, d, tick);
    else if (k <= 19) r = issueDesign(this, id, d, tick);
    else if (k <= 22) r = issueMio(this, id, d, tick);
    else if (k <= 30) r = issueTrade(this, id, d, tick);
    else if (k <= 39) r = issueIntel(this, id, d, tick);
    else if (k <= 46) r = issueProjects(this, id, d, tick);
    else if (k <= 51) r = issueMech(this, id, d, tick);
    else if (k <= 55) r = issueWorld(this, id, d, tick);
    else r = issueSeaAir(this, id, d, tick);
    // A refusal changes nothing (review E1): only a taken order flushes.
    if (r === null) {
      this.depthDirty.add(id);
      this.flushStats();
    }
    return r;
  }

  // ---- derived ----

  rebuildDerived(): void {
    this.designStatCache.clear();
    this.designCacheKey.clear();
    this.designVer.clear();
    this.keyStatTables.clear();
    this.keyStatsSeq++;
    this.reindexSparse();
    this.facilityIndex.clear();
    for (let id = 1; id < this.cap; id++) {
      if (this.countries[id] !== null && this.countries[id] !== undefined) {
        this.refreshDesignCache(id);
      }
    }
    for (const r of this.ww.scenario.landRegions) {
      const f = facilityOf(this.ww, r.id);
      if (f > 0) this.facilityIndex.set(r.id, f);
    }
  }

  /** Review E16: the §0-8 sparse tuples' and the minefields' indexes again (after a lane adds or removes a tuple). */
  reindexSparse(): void {
    this.regionStatusIndex.clear();
    this.world.regionStatus.forEach((x, i) =>
      this.regionStatusIndex.set(x[0], i),
    );
    this.resistBoostIndex.clear();
    this.resistBoost.forEach((x, i) => this.resistBoostIndex.set(x[0], i));
    this.reconIndex.clear();
    this.sea.reconBySide.forEach(([side, sr], i) =>
      nested(this.reconIndex, side).set(sr, i),
    );
    this.mineIndex.clear();
    this.sea.mines.forEach(([sr, side], i) =>
      nested(this.mineIndex, sr).set(side, i),
    );
  }

  /** Index in sea.mines of `side`'s minefield in `sr`, -1 none. */
  mineAt(sr: number, side: number): number {
    return this.mineIndex.get(sr)?.get(side) ?? -1;
  }

  /** Index in sea.reconBySide of `side`'s recon over `sr`, -1 none. */
  reconAt(side: number, sr: number): number {
    return this.reconIndex.get(side)?.get(sr) ?? -1;
  }

  /** Every design slot's stats again, and a new KeyStatsTable on next read (pre-flight §0-3). */
  refreshDesignCache(id: number): void {
    const c = this.countries[id];
    if (c === null || c === undefined) return;
    const rows: (DesignStats | null)[][] = [];
    for (const kind of DESIGN_KINDS) {
      rows.push(
        c.des[kind].map((s) =>
          s === null ? null : designStats(s.def, designCtxOf(this, id, s.def)),
        ),
      );
    }
    this.designStatCache.set(id, rows);
    const ce = this.ww.economy.country(id);
    this.designCacheKey.set(id, [
      ce?.statsVer ?? -1,
      ce?.researched ?? EMPTY,
      c.proj.done,
    ]);
    this.keyStatTables.delete(id);
    this.keyStatsSeq++;
  }

  /**
   * Pre-flight §0-3(d): a tech lands through ce.onTechChanged without
   * telling the depth layer; the caches are checked on read against the
   * economy's statsVer and researched identity.
   */
  private checkDesignCache(id: number): void {
    const key = this.designCacheKey.get(id);
    const ce = this.ww.economy.country(id);
    if (key === undefined || ce === null) return;
    if (
      key[0] !== ce.statsVer ||
      key[1] !== ce.researched ||
      key[2] !== (this.countries[id]?.proj.done ?? 0)
    ) {
      this.refreshDesignCache(id);
    }
  }

  // ---- screens, snapshots, hash (plan Task 1 Step 10) ----

  takeData(): WwDepthData | null {
    const out: WwDepthData = { fx: this.depthFx, news: this.depthNews };
    if (this.depthDirty.size > 0) {
      const ids = [...this.depthDirty]
        .filter(
          (id) =>
            this.countries[id] !== null && this.countries[id] !== undefined,
        )
        .sort((a, b) => a - b);
      if (ids.length > 0) out.countries = ids.map((id) => summaryOf(this, id));
      const humans = ids.filter((id) => this.ww.isHumanControlled(id));
      if (humans.length > 0)
        out.details = humans.map((id) => detailOf(this, id));
    }
    const intelIds = [...this.depthDirtyIntel]
      .filter((id) => this.ww.isHumanControlled(id))
      .sort((a, b) => a - b);
    if (intelIds.length > 0) {
      out.intel = intelIds.map((o) => ({
        observer: o,
        row: Array.from(this.intelRow(o)),
      }));
    }
    if (this.depthDirtyDesigns.length > 0) {
      out.designsOf = this.depthDirtyDesigns.map(([id, kind, slot]) => ({
        smallID: id,
        kind,
        slot,
        def: this.designSlot(id, kind, slot)?.def ?? null,
      }));
    }
    if (this.depthDirtyGlobal) Object.assign(out, globalDataOf(this));
    const empty =
      out.countries === undefined &&
      out.details === undefined &&
      out.intel === undefined &&
      out.designsOf === undefined &&
      !this.depthDirtyGlobal &&
      this.depthFx.length === 0 &&
      this.depthNews.length === 0;
    this.depthFx = [];
    this.depthNews = [];
    this.depthDirty.clear();
    this.depthDirtyIntel.clear();
    this.depthDirtyDesigns = [];
    this.depthDirtyGlobal = false;
    return empty ? null : out;
  }

  snapshot(): WwDepthState {
    return {
      lastCommonDay: this.lastCommonDay,
      nextUid: this.nextUid,
      countries: this.countries.map((c) =>
        c === null ? null : structuredCloneJson(c),
      ),
      dayTally: [...this.dayTally],
      groups: this.groups.map((g) => ({ ...g, armies: [...g.armies] })),
      market: structuredCloneJson(this.market),
      intelNet: [...this.intelNet.entries()].sort((a, b) => a[0] - b[0]),
      ops: structuredCloneJson(this.ops),
      infiltrations: this.infiltrations.map(
        (x) => [...x] as [number, number, number],
      ),
      decrypted: structuredCloneJson(this.decrypted),
      intelLevels: hexOf(this.intelLevels),
      nukeQueue: structuredCloneJson(this.nukeQueue),
      rocketQueue: structuredCloneJson(this.rocketQueue),
      raids: structuredCloneJson(this.raids),
      nuked: [...this.nuked.entries()].sort((a, b) => a[0] - b[0]),
      mech: structuredCloneJson(this.mech),
      sea: structuredCloneJson(this.sea),
      world: structuredCloneJson(this.world),
      resistBoost: this.resistBoost.map((x) => [x[0], x[1]]),
      lastPriorityGot: [...this.lastPriorityGot.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([id, got]) => [id, [...got]]),
      dayNotes: this.dayNotes.map(
        (x) => [...x] as [number, number, number, number, number],
      ),
    };
  }

  restoreState(s: WwDepthState): void {
    this.lastCommonDay = s.lastCommonDay;
    this.nextUid = s.nextUid;
    this.countries = s.countries.map((c) =>
      c === null ? null : normalizeCountry(structuredCloneJson(c)),
    );
    while (this.countries.length < this.cap) {
      this.countries.push(this.countries.length === 0 ? null : emptyCountry());
    }
    this.dayTally = [...s.dayTally];
    this.groups = structuredCloneJson(s.groups);
    this.market = structuredCloneJson(s.market);
    this.intelNet = new Map(s.intelNet);
    this.ops = structuredCloneJson(s.ops);
    this.infiltrations = s.infiltrations.map(
      (x) => [...x] as [number, number, number],
    );
    this.decrypted = structuredCloneJson(s.decrypted);
    this.intelLevels = new Uint8Array(this.cap * this.cap * 4);
    bytesOfHex(s.intelLevels, this.intelLevels);
    this.nukeQueue = structuredCloneJson(s.nukeQueue);
    this.rocketQueue = structuredCloneJson(s.rocketQueue);
    this.raids = structuredCloneJson(s.raids);
    this.nuked = new Map(s.nuked);
    this.mech = structuredCloneJson(s.mech);
    this.sea = structuredCloneJson(s.sea);
    this.world = structuredCloneJson(s.world);
    this.resistBoost = s.resistBoost.map((x) => [x[0], x[1]]);
    this.lastPriorityGot = new Map(
      s.lastPriorityGot.map(([id, got]) => [id, [...got]]),
    );
    this.dayNotes = s.dayNotes.map(
      (x) => [...x] as [number, number, number, number, number],
    );
    this.rebuildDerived();
    for (let id = 1; id < this.cap; id++) {
      if (this.countries[id] !== null) {
        this.depthDirty.add(id);
        this.depthDirtyIntel.add(id);
      }
    }
    this.depthDirtyGlobal = true;
  }

  /** Spec §21.6 order. */
  hash(): number {
    let h = 17;
    const mix = (v: number) => {
      h = (Math.imul(h, 31) + (v | 0)) >>> 0;
    };
    for (let id = 1; id < this.cap; id++) {
      const c = this.countries[id];
      if (c === null || c === undefined) continue;
      mix(c.doc.masteryMilli.reduce((a, b) => a + b, 0));
      mix(c.cmd.cpMilli);
      mix(
        DESIGN_KINDS.reduce(
          (a, k) => a + c.des[k].filter((x) => x !== null).length,
          0,
        ),
      );
      mix(c.mio.fundsMilli.reduce((a, b) => a + b, 0) % 1_000_000_007);
      mix(c.proj.running.reduce((a, r) => a + r.progressMilli, 0));
      mix(atomicStockOf(this.ww, id));
      mix(c.mech.energyPm);
    }
    for (const [k, v] of [...this.intelNet.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      mix(k);
      mix(v);
    }
    mix(this.decrypted.reduce((a, d) => a + d.progressMilli, 0));
    mix(this.sea.mines.reduce((a, m) => a + m[2], 0));
    mix(this.nuked.size);
    mix(this.market.deals.length);
    // Review E9: the §0-8 state and the other day-driving lists, folded.
    for (const [id, got] of this.lastPriorityGot) {
      mix(id);
      mix(got.reduce((a, b) => a + b, 0));
    }
    mix(this.sea.reconBySide.reduce((a, x) => a + x[0] + x[1] * 7 + x[2], 0));
    mix(this.resistBoost.reduce((a, x) => a + x[0] * 7 + x[1], 0));
    for (const x of this.world.regionStatus) {
      mix(x[0]);
      mix(x[1] + x[2] * 3 + x[3] * 5 + x[4] * 7);
    }
    mix(this.groups.length);
    mix(this.market.embargoes.length);
    mix(this.world.damLevel.reduce((a, l, i) => a + l * (i + 1), 0));
    return h;
  }
}

// ---- helpers (the foundation's bodies) ----

/** The inner map of `outer` at `k`, made when missing. */
function nested<V>(
  outer: Map<number, Map<number, V>>,
  k: number,
): Map<number, V> {
  let m = outer.get(k);
  if (m === undefined) {
    m = new Map<number, V>();
    outer.set(k, m);
  }
  return m;
}

const EMPTY: ReadonlySet<unknown> = new Set();

export function emptyCountry(): CountryDepth {
  const nul = <T>(n: number) => new Array<T | null>(n).fill(null);
  return {
    doc: {
      gd: [-1, -1, -1],
      gdLock: [-1, -1, -1],
      sub: new Array<number>(9).fill(-1),
      subLock: new Array<number>(9).fill(-1),
      masteryMilli: new Array<number>(9).fill(0),
      announced: new Array<number>(9).fill(0),
    },
    cmd: {
      cpMilli: 0,
      spirits: new Array<number>(7).fill(-1),
      spiritLock: new Array<number>(7).fill(-1),
      medalReady: [],
    },
    des: {
      tank: nul(WW_TANK_DESIGN_SLOTS),
      plane: nul(WW_PLANE_DESIGN_SLOTS),
      ship: nul(WW_SHIP_DESIGN_SLOTS),
    },
    mio: {
      arch: new Array<number>(6).fill(-1),
      fundsMilli: new Array<number>(18).fill(0),
      traits: new Array<number>(18).fill(0),
      investReady: new Array<number>(6).fill(-1),
      sizeSeen: new Array<number>(6).fill(0),
    },
    intel: {
      agency: false,
      upgrades: 0,
      upId: -1,
      upMilli: 0,
      operatives: [],
      nextCodename: 0,
      cryptoTarget: 0,
      propagandaBp: [],
      collabPp: [],
    },
    proj: {
      running: [],
      done: 0,
      scientists: [],
      atomic: [],
      blueprints: 0,
      halved: 0,
      nukedCount: 0,
      rocketRest: 0,
    },
    mech: {
      cfocus: -1,
      cfocusLock: -1,
      cfocusOpen: false,
      energyPm: 1000,
      energyExtra: 0,
      shortageNoteDay: -1000,
      xpTank: 0,
    },
  };
}

/** The engine has no structuredClone (host API rule): a JSON copy of plain state. */
export function structuredCloneJson<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

const KNOWN_MODULES: Readonly<
  Record<DesignKind, Readonly<Record<string, unknown>>>
> = {
  tank: TANK_MODULE_DEFS,
  ship: SHIP_MODULE_DEFS,
  plane: PLANE_MODULE_DEFS,
};

/** Plan decision 10, spec §21.6: an unknown module id restores as "" (the base fitting); short arrays fill up. */
function normalizeCountry(c: CountryDepth): CountryDepth {
  const e = emptyCountry();
  const pad = <T>(a: T[], b: readonly T[]) => {
    while (a.length < b.length) a.push(b[a.length]);
    return a;
  };
  pad(c.doc.gd, e.doc.gd);
  pad(c.doc.gdLock, e.doc.gdLock);
  pad(c.doc.sub, e.doc.sub);
  pad(c.doc.subLock, e.doc.subLock);
  pad(c.doc.masteryMilli, e.doc.masteryMilli);
  pad(c.doc.announced, e.doc.announced);
  pad(c.cmd.spirits, e.cmd.spirits);
  pad(c.cmd.spiritLock, e.cmd.spiritLock);
  for (const kind of DESIGN_KINDS) {
    pad(c.des[kind], e.des[kind]);
    for (const s of c.des[kind]) {
      if (s === null) continue;
      s.def.modules = s.def.modules.map((m) =>
        m === "" || KNOWN_MODULES[kind][m] !== undefined ? m : "",
      ) as typeof s.def.modules;
    }
  }
  pad(c.mio.arch, e.mio.arch);
  pad(c.mio.fundsMilli, e.mio.fundsMilli);
  pad(c.mio.traits, e.mio.traits);
  pad(c.mio.investReady, e.mio.investReady);
  pad(c.mio.sizeSeen, e.mio.sizeSeen);
  return c;
}

/** The stat-key suffix of each MIO_FAMILIES entry (MioRules' keys). */
const MIO_KEY: readonly string[] = MIO_FAMILIES.map((f) => f.slice(4));

/** The MIO family (MIO_FAMILIES index) a design draws its reliability and cost from (spec §6.1). */
function designFamily(kind: DesignKind, base: string): number {
  if (kind === "tank") return MIO_KEY.indexOf("armor");
  if (kind === "ship") return MIO_KEY.indexOf("naval");
  return MIO_KEY.indexOf(base.startsWith("small") ? "air_light" : "air_heavy");
}

/** Plan decision 11: what a design's numbers read from its country. */
export function designCtxOf(
  d: WwDepth,
  id: number,
  def: { kind: DesignKind; base: string },
): DesignCtx {
  const ce = d.ww.economy.country(id);
  const f = MIO_KEY[designFamily(def.kind, def.base)];
  const stats = ce?.stats as Partial<Record<WwStatKey, number>> | undefined;
  return {
    techs: ce?.researched ?? new Set(),
    projects: d.countries[id]?.proj.done ?? 0,
    relPp: stats?.[`mioRelPp_${f}` as WwStatKey] ?? 0,
    costPct: stats?.[`mioCostPct_${f}` as WwStatKey] ?? 0,
  };
}

/** P1's facility in a region: FACILITY_IDS index + 1, 0 none. */
export function facilityOf(ww: WorldWar, region: number): number {
  for (let i = 0; i < FACILITY_IDS.length; i++) {
    if ((ww.economy.buildingArray(FACILITY_IDS[i])[region] ?? 0) > 0)
      return i + 1;
  }
  return 0;
}

/**
 * Plan decision 7: a new KeyStatsTable — the static slots' rows are P2's
 * (STATIC_KEY_STATS, the very numbers templateStats uses), the design
 * slots' rows lane E's fillDesignRows writes (stub: group −1).
 */
function buildKeyStats(d: WwDepth, id: number): KeyStatsTable {
  const t: KeyStatsTable = {
    group: STATIC_KEY_STATS.group.slice(),
    year: STATIC_KEY_STATS.year.slice(),
    stats: STATIC_KEY_STATS.stats.slice(),
  };
  if (d.countries[id] !== null && d.countries[id] !== undefined) {
    fillDesignRows(d, id, t);
  }
  return t;
}

/**
 * Plan decision 23: civilian factories leaving (market payments as the
 * buyer, licence fees as the licensee, an agency upgrade's 2) and coming
 * in (market payments as the seller, licence fees as the licensor). Same
 * faction licences cost nothing.
 */
function civFlow(d: WwDepth, id: number): { in: number; out: number } {
  let inn = 0;
  let out = 0;
  for (const deal of d.market.deals) {
    if (deal.paidMilli >= deal.priceMilli) continue;
    if (deal.buyer === id) out += deal.civs;
    if (deal.seller === id) inn += deal.civs;
  }
  for (const l of d.market.licences) {
    if (d.ww.sameFaction(l.from, l.to)) continue;
    if (l.to === id) out += 1;
    if (l.from === id) inn += 1;
  }
  const c = d.countries[id];
  if (c !== null && c !== undefined && c.intel.upId >= 0) out += 2;
  return { in: inn, out };
}

/** Spec §3.4 rows 2: ships in battle or on missions → micro-mastery of the naval tracks. */
function noteNaval(
  d: WwDepth,
  owner: number,
  cls: number,
  battle: boolean,
  ships: number,
): void {
  if (owner <= 0 || owner >= d.cap || d.dayTally.length === 0) return;
  // SHIP_CLASSES: dd cl ca bc bb cv ss.
  const surface = cls === 2 || cls === 3 || cls === 4;
  const carrier = cls === 5;
  const track = surface ? 3 : carrier ? 5 : 4;
  const micro = surface
    ? battle
      ? NAVAL_SHARE_MICRO.surfaceBattle
      : NAVAL_SHARE_MICRO.surfaceMission
    : carrier
      ? battle
        ? NAVAL_SHARE_MICRO.carrierBattle
        : NAVAL_SHARE_MICRO.carrierMission
      : battle
        ? NAVAL_SHARE_MICRO.escortBattle
        : NAVAL_SHARE_MICRO.escortMission;
  d.dayTally[owner * 9 + track] += micro * Math.max(0, ships);
}

/** Spec §3.4 row 3: sorties → micro-mastery of the air tracks. */
function noteAir(
  d: WwDepth,
  owner: number,
  mission: number,
  sorties: number,
): void {
  if (owner <= 0 || owner >= d.cap || d.dayTally.length === 0) return;
  const m = AIR_MISSIONS[mission];
  const track =
    m === "air_superiority" || m === "interception"
      ? 6
      : m === "cas" || m === "strategic_bombing"
        ? 7
        : m === "naval_strike" || m === "naval_patrol" || m === "port_strike"
          ? 8
          : -1;
  if (track < 0) return;
  d.dayTally[owner * 9 + track] +=
    AIR_SHARE_MICRO_PER_SORTIE * Math.max(0, sorties);
}

/** P2 army, P4 navy and air experience, milli. */
function xpMilliOf(ww: WorldWar, id: number, domain: Domain): number {
  if (domain === 0) return ww.land.country(id)?.armyXpMilli ?? 0;
  if (domain === 1) return ww.navy.country(id)?.navyXpMilli ?? 0;
  return ww.air.country(id)?.airXpMilli ?? 0;
}

function addXpMilli(
  ww: WorldWar,
  id: number,
  domain: Domain,
  milli: number,
): void {
  if (domain === 0) {
    const c = ww.land.country(id);
    if (c !== null) c.armyXpMilli = Math.max(0, c.armyXpMilli + milli);
  } else if (domain === 1) {
    const c = ww.navy.country(id);
    if (c !== null) c.navyXpMilli = Math.max(0, c.navyXpMilli + milli);
  } else {
    const c = ww.air.country(id);
    if (c !== null) c.airXpMilli = Math.max(0, c.airXpMilli + milli);
  }
}

/** P1 stock of atomic bombs (plan decision 20). */
export function atomicStockOf(ww: WorldWar, id: number): number {
  return ww.economy.country(id)?.stock[equipKey("atomic_bomb", 1)] ?? 0;
}

/**
 * K5's start tables (spec §3.5, §4.3, §9.2): AI countries' doctrines on
 * day 0, every country's scientist pool, the 1936 field marshals. Dormant
 * slots get nothing (P5 pre-flight §0-4). Lanes D and S refine; the shape
 * of the start state is this.
 */
function startDepthContent(d: WwDepth): void {
  const content = d.ww.politics.content;
  for (let id = 1; id < d.cap; id++) {
    const c = d.countries[id];
    if (c === null || c === undefined) continue;
    const tag = d.ww.tagOf(id);
    if (isDormant(d, id)) continue;
    // (The AI's doctrines come on day 0: WwDepth.startAiDoctrines.)
    const major = d.ww.economy.country(id)?.major ?? false;
    const rows = content.scientists.filter(
      (s) => s.tag === tag && (s.from === undefined || dayOfDate(s.from) <= 0),
    );
    if (rows.length > 0) {
      for (const s of rows) addScientist(c, specIndex(s.spec), s.skill);
    } else {
      const civ = d.ww.economy.country(id)?.totals.civ ?? 0;
      const dev = d.ww.scenario.devOf(tag, civ);
      const n = major ? 4 : dev >= 3 ? 2 : 1;
      for (let i = 0; i < n; i++) addScientist(c, i % 4, 1);
    }
  }
  for (const fm of content.startFieldMarshals) {
    if (fm.from !== undefined && dayOfDate(fm.from) > 0) continue;
    const id = d.ww.politics.idOfTag(fm.tag);
    if (id === 0 || isDormant(d, id)) continue;
    d.ww.land.markFieldMarshal(id, fm.general, FM_TRAITS.indexOf(fm.trait));
  }
}

function isDormant(d: WwDepth, id: number): boolean {
  return d.ww.scenario.isDormantSlot(id);
}

function specIndex(s: string): number {
  return ["nuclear", "rocket", "electronics", "aviation"].indexOf(s);
}

function addScientist(c: CountryDepth, spec: number, skill: number): void {
  c.proj.scientists.push({
    id: c.proj.scientists.length,
    spec,
    skill,
    sinceDay: 0,
    project: -1,
  });
}

function applyStartDoctrine(
  c: CountryDepth,
  gd: readonly (string | null)[],
  sub: readonly (string | null)[],
): void {
  gd.forEach((g, dom) => {
    if (g !== null) c.doc.gd[dom] = GRAND_DOCTRINE_INDEX.get(g) ?? -1;
  });
  sub.forEach((s, t) => {
    if (s !== null && t < 9) c.doc.sub[t] = SUBDOCTRINE_INDEX.get(s) ?? -1;
  });
}

const GRAND_DOCTRINE_INDEX = new Map<string, number>(
  GRAND_DOCTRINES.map((g, i) => [g, i]),
);
const SUBDOCTRINE_INDEX = new Map<string, number>(
  SUBDOCTRINES.map((s, i) => [s, i]),
);

// ---- screens (plan decision 36, spec §21.5) ----

function mioSizes(c: CountryDepth): number[] {
  return c.mio.arch.map((a, f) =>
    a < 0 ? 0 : mioSize(c.mio.fundsMilli[f * 3 + a]),
  );
}

function atomicStage(c: CountryDepth): number {
  const done =
    (c.proj.done & (1 << SPECIAL_PROJECTS.indexOf("sp_atomic"))) !== 0;
  if (done) return 3;
  const run = c.proj.running.find(
    (r) => r.project === SPECIAL_PROJECTS.indexOf("sp_atomic"),
  );
  if (run === undefined) return 0;
  const pm = Math.floor(run.progressMilli / 1000);
  return ATOMIC_MILESTONES_PM.filter((m) => pm >= m).length;
}

function summaryOf(d: WwDepth, id: number): WwDepthSummary {
  const c = d.countries[id]!;
  return {
    smallID: id,
    gd: [...c.doc.gd],
    levels: c.doc.masteryMilli.map((m) => masteryLevel(m)),
    cpMilli: c.cmd.cpMilli,
    energyPm: c.mech.energyPm,
    mioSize: mioSizes(c),
    fieldMarshals: d.ww.land.fieldMarshalCount(id),
    atomicStage: atomicStage(c),
    atomicStock: atomicStockOf(d.ww, id),
    agency: c.intel.agency,
  };
}

function detailOf(d: WwDepth, id: number): WwDepthDetail {
  const c = d.countries[id]!;
  const ce = d.ww.economy.country(id);
  const cpGain = cpDayMilli(
    (ce?.stats as Partial<Record<WwStatKey, number>> | undefined)?.cpGainPct ??
      0,
    d.ww.land.fieldMarshalCount(id),
  );
  const designs: WwDepthDetail["designs"] = [];
  for (const kind of DESIGN_KINDS) {
    c.des[kind].forEach((s, i) => {
      if (s === null) return;
      designs.push({
        kind,
        slot: i + 1,
        def: s.def,
        origin: s.origin,
        from: s.from,
        obsolete: s.obsolete,
        inUse: designInUse(d, id, kind, i + 1),
      });
    });
  }
  const sizes = mioSizes(c);
  const sc = d.ww.scenario;
  let hydro = 0;
  for (const r of d.ww.economy.regionsOf(id)) hydro += sc.hydroOf(r);
  const dams = d.world.damLevel.reduce((a, lv, i) => {
    const r = sc.damRegion[i];
    return lv > 0 && r > 0 && d.ww.economy.controllerOf(r) === id ? a + 1 : a;
  }, 0);
  const plants = d.ww.economy.countryBuildings(id, "power_plant");
  return {
    smallID: id,
    doctrine: {
      gd: [...c.doc.gd],
      gdLock: [...c.doc.gdLock],
      sub: [...c.doc.sub],
      subLock: [...c.doc.subLock],
      masteryMilli: [...c.doc.masteryMilli],
      gainMilli: doctrineGainMilli(d, id),
    },
    command: {
      cpMilli: c.cmd.cpMilli,
      cpGainMilli: cpGain,
      spirits: [...c.cmd.spirits],
      spiritLock: [...c.cmd.spiritLock],
      medalReady: c.cmd.medalReady.map((m) => m[1]),
    },
    designs,
    mio: {
      arch: [...c.mio.arch],
      fundsMilli: [...c.mio.fundsMilli],
      traits: [...c.mio.traits],
      size: sizes,
      points: c.mio.arch.map((a, f) =>
        a < 0 ? 0 : mioPoints(sizes[f], c.mio.traits[f * 3 + a], a),
      ),
      investReady: [...c.mio.investReady],
    },
    intel: {
      agency: c.intel.agency,
      upgrades: c.intel.upgrades,
      upId: c.intel.upId,
      upProgressPm: Math.floor(c.intel.upMilli / 1000),
      operatives: c.intel.operatives.map((o) => ({
        uid: o.uid,
        codename: o.codename,
        skill: o.skill,
        state: (
          ["idle", "travel", "mission", "operation", "captured"] as const
        )[Math.max(0, Math.min(4, o.state))],
        target: o.target,
        mission: o.mission < 0 ? null : (INTEL_MISSION_IDS[o.mission] ?? null),
        op: o.op,
        daysLeft: Math.max(0, o.travelLeft, o.recruitLeft),
        capturePm: operativeCapturePm(d, id, o),
      })),
      operations: d.ops
        .filter((o) => o.owner === id)
        .map((o) => ({
          uid: o.uid,
          kind: INTEL_OPERATION_IDS[o.kind] ?? "op_infiltrate_army",
          target: o.target,
          operatives: [...o.operatives],
          startDay: o.startDay,
          endDay: o.endDay,
          successPm: operationSuccessPm(d, id, o),
        })),
      cryptoTarget: c.intel.cryptoTarget,
      cryptoPm: Math.floor(
        (d.decrypted.find((x) => x.o === id && x.t === c.intel.cryptoTarget)
          ?.progressMilli ?? 0) / 1000,
      ),
      cipher: cipherOf(d, id),
      decrypt: decryptOf(d, id),
      decrypted: d.decrypted
        .filter((x) => x.o === id && x.activeUntil >= 0)
        .map((x) => ({ target: x.t, activeUntil: x.activeUntil })),
      networks: [...d.intelNet.entries()]
        .filter(([k]) => Math.floor(k / 1024) === id)
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => [k % 1024, Math.floor(v / 1000)] as [number, number]),
    },
    projects: {
      running: c.proj.running.map((r) => {
        const eta = projectEta(d, id, r);
        return {
          project: SPECIAL_PROJECTS[r.project] ?? "sp_atomic",
          facility: r.facility,
          progressPm: Math.floor(r.progressMilli / 1000),
          daysLeft: eta.daysLeft,
          scientist: r.scientist,
          inputPm: eta.inputPm,
        };
      }),
      done: c.proj.done,
      scientists: c.proj.scientists.map((s) => ({
        id: s.id,
        spec: s.spec,
        skill: s.skill,
        project: s.project,
      })),
      facilities: [...d.facilityIndex.entries()]
        .filter(([r]) => d.ww.economy.controllerOf(r) === id)
        .sort((a, b) => a[0] - b[0]),
    },
    market: {
      licencesIn: d.market.licences.filter((l) => l.to === id).map((l) => l.id),
      licencesOut: d.market.licences
        .filter((l) => l.from === id)
        .map((l) => l.id),
      deals: d.market.deals
        .filter((x) => x.buyer === id || x.seller === id)
        .map((x) => x.id),
      listings: d.market.listings
        .filter((x) => x.seller === id)
        .map((x) => x.id),
    },
    mech: {
      cfocus: c.mech.cfocus,
      cfocusLock: c.mech.cfocusLock,
      cfocusOpen: c.mech.cfocusOpen,
      congressBp: d.mech.congressBp,
      bop: bopOf(d, id)?.[1] ?? 0,
      bopBand: bopOf(d, id)?.[2] ?? 2,
      treatyMember: d.mech.treaty.members.includes(id) && !d.mech.treaty.ended,
    },
    energy: {
      demand: energyDemand(d, id),
      coal: d.lastPriorityGot.get(id)?.[RESOURCE_IDS.indexOf("coal")] ?? 0,
      hydro,
      plants,
      dams,
      ratioPm: c.mech.energyPm,
    },
  };
}

function bopOf(d: WwDepth, id: number): [number, number, number] | undefined {
  const tag = d.ww.tagOf(id);
  const i = BOP_DEFS.findIndex((b) => b.tag === tag);
  return i < 0 ? undefined : d.mech.bop.find((b) => b[0] === i);
}

function globalDataOf(d: WwDepth): Partial<WwDepthData> {
  const armyGroups: WwArmyGroupData[] = d.groups.map((g) => ({
    id: g.id,
    owner: g.owner,
    fm: g.fm,
    armies: [...g.armies],
  }));
  const world: WwDepthWorld = {
    nuked: [...d.nuked.entries()].sort((a, b) => a[0] - b[0]),
    flooded: d.world.floodUntil.map((x) => [x[0], x[1]]),
    scorched: d.world.scorchedUntil.map((x) => [x[0], x[1]]),
    harbors: d.world.harbors.map((x) => [x[0], x[1], x[2]]),
    damLevel: [...d.world.damLevel],
  };
  return {
    armyGroups,
    market: {
      listings: d.market.listings.map((x) => ({
        id: x.id,
        seller: x.seller,
        key: x.key,
        design: x.design,
        count: x.count,
        priceMilli: marketPriceMilli(
          equipCostMilli(d, x.seller, x.key),
          0,
          x.count,
        ),
      })),
      deals: d.market.deals.map((x) => ({
        id: x.id,
        buyer: x.buyer,
        seller: x.seller,
        key: x.key,
        count: x.count,
        civs: x.civs,
        paidPm:
          x.priceMilli <= 0
            ? 1000
            : Math.floor((x.paidMilli * 1000) / x.priceMilli),
        deliveredPm:
          x.priceMilli <= 0
            ? 1000
            : Math.floor((x.deliveredMilli * 1000) / x.priceMilli),
        endDay: x.endDay,
      })),
      licences: d.market.licences.map((l) => ({
        id: l.id,
        from: l.from,
        to: l.to,
        key: l.key,
        ship: l.ship !== 0,
        slot: l.slot,
        sinceDay: l.sinceDay,
      })),
      embargoes: d.market.embargoes.map((x) => [x[0], x[1]]),
      pendingLicences: d.market.pending.map((p) => ({
        id: p.id,
        from: p.from,
        to: p.to,
        key: p.key,
        deadlineTick: p.deadlineTick,
      })),
    },
    mines: d.sea.mines.map((m) => [m[0], m[1], m[2]]),
    aces: d.sea.aces.map((a) => ({
      id: a.id,
      owner: a.owner,
      deployment: a.deployment,
      callNo: a.callNo,
    })),
    world,
    congressBp: d.mech.congressBp,
    bop: d.mech.bop.map((b) => [b[0], b[1]]),
    treaty: {
      members: [...d.mech.treaty.members],
      escalated: d.mech.treaty.escalated,
      endDay: dayOfDate(TREATY_END_DATE),
    },
    factionRules: d.mech.factionRules.map((r) => [r[0], r[1], r[2]]),
    factionGoals: d.mech.factionGoals.map((g) => [
      g.faction,
      [...g.slots],
      g.achieved,
    ]),
  };
}
