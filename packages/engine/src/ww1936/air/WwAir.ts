// World War 1936 P4: the air war's state (P4 spec §19.1): deployments, the
// per air zone results the other steps read the next day, the countries'
// tallies; the tick order (spec §2.2-7), the order dispatch, the screens'
// data, the snapshot and the hash. The lanes write the step functions
// (Task 1 Step 18's stubs).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  AirDeploySummary,
  AirFightRow,
  AirRaidReport,
  AirTemplate,
  AirType,
  AirZoneData,
  CountryAirDetail,
  PlaneStats,
  Wing,
  WING_NEW_FIELD_DEFAULTS,
  WingBrief,
  WingDetail,
  WingFlightRow,
  WingOrder,
  WW_AIR_BASE_CAPACITY,
  WW_FIELD_STRIP_PLANES,
  WW_WINGS_LIVE,
  WwAirData,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_PLANE_DESIGN_SLOTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_IDS,
  equipKey,
  EQUIPMENT_GENS,
  WW_DAY_SPLIT,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { weakPlaneStats } from "@openfront/engine-lib/ww1936/hist/WeakGeneric";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { newWingXp } from "@openfront/engine-lib/ww1936/WingRules";
import { z } from "zod";
import type { Game } from "../../game/Game";
import { aceOnWingGone } from "../depth/Aces";
import {
  designPlaneAsP4,
  loseDesignPlanes,
  planeDesignSlotsOf,
  planeStatsOfKey,
  returnDesignPlanes,
} from "../depth/Designs";
import { designerOn } from "../depth/Hist";
import type { WwDepth } from "../depth/WwDepth";
import { buildingIndex, losePlanes, returnPlanes } from "../economy/Buildings";
import type { WwEconomy } from "../economy/WwEconomy";
import type { WwLand } from "../land/WwLand";
import { onPlanesLost } from "../navy/EndgameHooks";
import type { WwNavy } from "../navy/WwNavy";
import type { WorldWar } from "../WorldWar";
import { aiAir, aiWings, issueArmyAirPriority, issueWingAuto } from "./AiAir";
import { dailyAirZone } from "./AirCombat";
import { airMissionEffects, airSupplyAt } from "./AirEffects";
import {
  airMoveFactorFor,
  airPenaltyFor,
  airSupplyFactorFor,
} from "./AirSuperiority";
import { dailyAirCountry, issueAirOrder } from "./Deploy";
import { designSlotsFor } from "./DesignPlanes";
import {
  groupViews,
  issueGroupDisband,
  issueGroupOrder,
  issueTemplate,
  issueTemplateDrop,
  type AirGroup,
} from "./Groups";
import { paradropBlockFor, stepParadrops } from "./Paradrop";
import { RaidNotes } from "./RaidNotes";
import {
  closeAirZone,
  issueWingMission,
  pulseZones,
  stepWings,
} from "./Sorties";
import {
  baseUsesOf,
  dailyWingCountry,
  formStartWings,
  issueAirField,
  issueWingBase,
  issueWingDisband,
  onBaseControlChanged,
} from "./Wings";

export type { Wing } from "@openfront/engine-api/ww1936/AirTypes";

/** P6 (plan decision 9): every plane of a deployment, static generations then design slots. */
export function wingPlanes(d: Wing): number {
  let n = 0;
  const { counts, dcounts } = d;
  for (let i = 0; i < counts.length; i++) n += counts[i];
  for (let i = 0; i < dcounts.length; i++) n += dcounts[i];
  return n;
}

const PLANE_FIELDS: readonly (keyof PlaneStats)[] = [
  "airAtk",
  "airDef",
  "agility",
  "speedKmh",
  "rangeKm",
  "ground",
  "strat",
  "naval",
  "supWeightMilli",
  "fuelPerSortieMilli",
];

/**
 * P6 (plan decision 9): a deployment's numbers, its planes' weighted by
 * count over its static generations (P4's planeStatsOf) and its design
 * slots (lane E's planeStatsOfKey as P4's type, designPlaneAsP4). With no
 * design planes, the P4 numbers of its generations.
 */
export function deploymentStats(air: WwAir, d: Wing): PlaneStats {
  const type = AIR_TYPES[d.type];
  const parts: [PlaneStats, number][] = [];
  d.counts.forEach((n, g) => {
    if (n > 0) parts.push([air.planeStatsOf(d.owner, type, g + 1), n]);
  });
  const depth = air.ww.depth as WwDepth | undefined;
  if (depth !== undefined) {
    d.dcounts.forEach((n, s) => {
      if (n <= 0) return;
      const ds = planeStatsOfKey(
        depth,
        d.owner,
        equipKey("plane_design", s + 1),
      );
      if (ds !== null) parts.push([designPlaneAsP4(ds, type), n]);
    });
  }
  if (parts.length === 0) return air.planeStatsOf(d.owner, type, 1);
  if (parts.length === 1) return parts[0][0];
  let total = 0;
  for (const [, n] of parts) total += n;
  const out = { ...parts[0][0] };
  for (const f of PLANE_FIELDS) {
    let sum = 0;
    for (const [st, n] of parts) sum += st[f] * n;
    out[f] = Math.floor(sum / total);
  }
  return out;
}

/** The side a deployment fights for: its volunteer host's, else its owner's (P5 volunteers). */
export function wingSide(air: WwAir, d: Wing): number {
  return air.land.sideOf(d.volunteerFor !== 0 ? d.volunteerFor : d.owner);
}

/**
 * Per zone (srIdx): yesterday's results the other steps read (spec §2.2:
 * read a day late, so state). Maps keyed by side or country, in key order.
 */
export interface ZoneAirState {
  /** side → air superiority ‰. */
  sup: Map<number, number>;
  /** side → the worst enemy superiority over the zone ‰ (A1: the land war's penalty reads it). */
  enemySup: Map<number, number>;
  /** side → the battlefield-support bonus (supPenaltyPp) of the enemy holding that worst superiority (A1, spec §14.6). */
  enemyPp: Map<number, number>;
  /** side → the last day its ww1936_air_superiority alert went out for this zone (spec §18.10: 7 days apart). */
  alertDay: Map<number, number>;
  /** side → CAS pool for today, centi-hits (spec §14.7). */
  cas: Map<number, number>;
  /** side → AIR_TYPES-indexed sorties yesterday (screens, AI). */
  sorties: Map<number, number[]>;
  /** country → results yesterday [shotDown, lost, casHits, bombPoints, navalDamage]. */
  result: Map<number, number[]>;
  /**
   * country → today's naval air, milli-sorties (pre-flight A4): search
   * (naval bombers × 3, the others × 1), anti-submarine (1 a plane), naval
   * strike; and its fighters' superiority sorties (N1's supremacy).
   */
  navalSearch: Map<number, number>;
  navalAsw: Map<number, number>;
  navalStrike: Map<number, number>;
  fightersSup: Map<number, number>;
  /** Pre-flight A19: [region, side, ‰] of the CAS pool's split by frontage, the zone's day. */
  casShare: [number, number, number][];
  /** Pre-flight A19: [region, side, milli] of the air supply, the zone's day. */
  airSupply: [number, number, number][];
  /** The day this zone last ran its daily step (written before dailyAirZone). */
  lastDay: number;
  // ww8 (wing model; empty in an old-model game).
  /** side → superiority score, moved by the pulses (design §3.8). */
  score: Map<number, number>;
  /** [battle region, side, CAS centi-hits a tick] of the wings on station, by (region, side). */
  casNow: [number, number, number][];
  /** What today's sorties have added so far; the zone's close moves it to the fields above. */
  today: ZoneToday;
}

/**
 * ww8: a zone's day being built (design §3.8), the same shapes as the
 * ZoneAirState fields it replaces at the zone's close, plus recon sorties
 * by side (depth reads them there).
 */
export interface ZoneToday {
  sorties: Map<number, number[]>;
  result: Map<number, number[]>;
  navalSearch: Map<number, number>;
  navalAsw: Map<number, number>;
  navalStrike: Map<number, number>;
  fightersSup: Map<number, number>;
  airSupply: [number, number, number][];
  recon: Map<number, number>;
  /** owner × 16 + AIR_MISSIONS index → milli-sorties today, for the air doctrine at the close. */
  flown: Map<number, number>;
}

function emptyToday(): ZoneToday {
  return {
    sorties: new Map(),
    result: new Map(),
    navalSearch: new Map(),
    navalAsw: new Map(),
    navalStrike: new Map(),
    fightersSup: new Map(),
    airSupply: [],
    recon: new Map(),
    flown: new Map(),
  };
}

function emptyZone(): ZoneAirState {
  return {
    sup: new Map(),
    enemySup: new Map(),
    enemyPp: new Map(),
    alertDay: new Map(),
    cas: new Map(),
    sorties: new Map(),
    result: new Map(),
    navalSearch: new Map(),
    navalAsw: new Map(),
    navalStrike: new Map(),
    fightersSup: new Map(),
    casShare: [],
    airSupply: [],
    lastDay: -1,
    score: new Map(),
    casNow: [],
    today: emptyToday(),
  };
}

export class CountryAir {
  /** 30-day ring of bomb points taken after AA, by day % 30 (spec §14.8 war support). */
  bombTaken = new Array<number>(30).fill(0);
  /** 30-day ring tallies by day % 30: shot down, lost, bombs given, ships sunk, convoys sunk. */
  tally = Array.from({ length: 5 }, () => new Array<number>(30).fill(0));
  /** Zones (strategic ids) the AI runs for a human (air_auto). */
  autoZones: number[] = [];
  // ww8 (wing model).
  /** The raid reports, oldest first, at most WW_AIR_REPORT_ROWS (design §5.2). */
  reports: AirRaidReport[] = [];
  /** The armies under [✈ priority], ascending. */
  priorityArmies: number[] = [];
  /** Per AIR_TYPES index: the next wing's nameNo. */
  nextWingNo = new Array<number>(AIR_TYPES.length).fill(1);
  /** Per AIR_TYPES index: the day that type may form a wing again (after a disband). */
  reformDay = new Array<number>(AIR_TYPES.length).fill(0);
  // w50 (air groups).
  /** The saved air templates (at most WW_MAX_AIR_TEMPLATES) and the next one's id. */
  templates: AirTemplate[] = [];
  nextTemplateId = 1;
  constructor(
    readonly smallID: number,
    readonly tag: CountryTag,
  ) {}
}

// ---- Snapshot schema ----

const zInts = () => z.array(zInt());
const pairs = () => z.array(z.tuple([zInt(), zInt()]));
const triples = () => z.array(z.tuple([zInt(), zInt(), zInt()]));
const WingSchema = z.object({
  id: zInt(),
  owner: zInt(),
  sr: zInt(),
  type: zInt(),
  mission: zInt(),
  counts: zInts(),
  goalCount: zInt(),
  base: zInt(),
  lossRest: zInt(),
  auto: z.boolean(),
  volunteerFor: zInt(),
  // P6 (plan decision 9): written always; absent reads the defaults.
  dcounts: zInts().optional(),
  night: z.boolean().optional(),
  ace: zInt().optional(),
  // ww8.
  nameNo: zInt(),
  target: zInt(),
  follow: zInt(),
  escortOf: zInt(),
  cls: zInt(),
  phase: zInt(),
  until: zInt(),
  flyMilli: zInt(),
  leg: zInt(),
  hit: zInt(),
  flySr: zInt(),
  flyMission: zInt(),
  xpMilli: zInt(),
  kills: zInt(),
  lastFerryDay: zInt(),
  noticeDay: zInt(),
  dayKills: zInt(),
  dayLost: zInt(),
  prevKills: zInt(),
  prevLost: zInt(),
  aceMark: zInt(),
  // w50: present only when set.
  group: zInt().optional(),
  fullMax: zInt().optional(),
});
const ZoneTodaySchema = z.object({
  sorties: z.array(z.tuple([zInt(), zInts()])),
  result: z.array(z.tuple([zInt(), zInts()])),
  navalSearch: pairs(),
  navalAsw: pairs(),
  navalStrike: pairs(),
  fightersSup: pairs(),
  airSupply: triples(),
  recon: pairs(),
  flown: pairs(),
});
const ZoneSchema = z.object({
  sup: pairs(),
  enemySup: pairs(),
  enemyPp: pairs(),
  alertDay: pairs(),
  cas: pairs(),
  sorties: z.array(z.tuple([zInt(), zInts()])),
  result: z.array(z.tuple([zInt(), zInts()])),
  navalSearch: pairs(),
  navalAsw: pairs(),
  navalStrike: pairs(),
  fightersSup: pairs(),
  casShare: triples(),
  airSupply: triples(),
  lastDay: zInt(),
  // ww8.
  score: pairs(),
  casNow: triples(),
  today: ZoneTodaySchema,
});
const RaidReportSchema = z.object({
  day: zInt(),
  attacker: zInt(),
  victim: zInt(),
  region: zInt(),
  cls: zInt(),
  raids: zInt(),
  planes: zInt(),
  lost: zInt(),
  points: zInt(),
  stopped: pairs(),
  fuelMilli: zInt(),
  shipsHit: zInt(),
  groundPlanes: zInt(),
  wsBp: zInt(),
  repairDays: zInt(),
});
const TemplateSchema = z.object({
  id: zInt(),
  name: z.string(),
  planes: zInts(),
  keep: zInt(),
});
const GroupSchema = z.object({
  id: zInt(),
  owner: zInt(),
  tpl: zInt(),
  zones: zInts(),
  priority: zInt(),
  army: zInt(),
  cls: zInt(),
  target: zInt(),
  auto: z.boolean(),
  night: z.boolean(),
  base: zInt(),
});
const CountryAirSchema = z.object({
  bombTaken: zInts(),
  tally: z.array(zInts()),
  autoZones: zInts(),
  // ww8.
  reports: z.array(RaidReportSchema),
  priorityArmies: zInts(),
  nextWingNo: zInts(),
  reformDay: zInts(),
  // w50: present only when set.
  templates: z.array(TemplateSchema).optional(),
  nextTemplateId: zInt().optional(),
});
export const WwAirStateSchema = z.object({
  wings: z.array(WingSchema),
  zones: z.array(ZoneSchema),
  countries: z.array(CountryAirSchema),
  nextWingId: zInt(),
  planesLostTotal: zInt(),
  bombPointsTotal: zInt(),
  lastCommonDay: zInt(),
  // ww8.
  wingsLive: z.boolean(),
  strips: pairs(),
  // w50: present only when set.
  groups: z.array(GroupSchema).optional(),
  nextGroupId: zInt().optional(),
});
export type WwAirState = z.infer<typeof WwAirStateSchema>;

const mapOf = <V>(e: readonly (readonly [number, V])[]): Map<number, V> =>
  new Map(e.map(([k, v]) => [k, v]));

/**
 * The air model a new game starts on: WW_WINGS_LIVE in every real game. Only
 * the old model's tests write it (tests/ww1936/oldAirModel.ts), and it goes
 * with the old model.
 */
export const newGameAirModel = { wingsLive: WW_WINGS_LIVE };

/**
 * World War 1936 P4 air war (spec §19.1). Lives in WorldWar (plan decision
 * 2); ticks after the navy (spec §2.2-7).
 */
export class WwAir {
  readonly wings = new Map<number, Wing>();
  /** srIdx order (decision 19). */
  readonly zoneState: ZoneAirState[];
  nextWingId = 1;
  planesLostTotal = 0;
  bombPointsTotal = 0;
  /** The air-raid notice (message-only memory, not state). */
  readonly raidNotes = new RaidNotes();
  private lastCommonDay = -1;
  /**
   * ww8: which air model runs this game (AirTypes.WW_WINGS_LIVE). State: a
   * test turns one game on before it runs, and a restored copy must follow.
   */
  wingsLive: boolean = newGameAirModel.wingsLive;
  /** ww8: field strips, region → the tick it opens, ascending (setStrip keeps the order). */
  strips = new Map<number, number>();
  /** w50: the air groups by id, ascending (their wings carry Wing.group). */
  readonly groups = new Map<number, AirGroup>();
  nextGroupId = 1;
  private countryList: (CountryAir | null)[];
  // Derived (DERIVED_FIELDS).
  /** `wings` in id order, as an array (the air steps walk it every tick); null: stale. */
  private wingList: Wing[] | null = null;
  private wingsBySr = new Map<number, number[]>();
  private wingsByBase = new Map<number, number[]>();
  /** Task 15 (perf): deployment ids by owner, ascending (wingsOf). */
  private wingsByOwner = new Map<number, number[]>();
  /** owner × 256 + type × 4 + gen → the stats at that stats version and tech set (pre-flight §0-7). */
  private planeStatsMemo = new Map<
    number,
    { statsVer: number; researched: unknown; stats: PlaneStats }
  >();
  private airDirtyZones = new Set<number>();
  private airDirtyWings = new Set<number>();
  private airDirtyCountries = new Set<number>();
  private removedWingIds: number[] = [];
  // ww8. The take-offs and the air battles' results of this tick, for the
  // screens only (takeData empties them).
  private flightsOut: WingFlightRow[] = [];
  private fightsOut: AirFightRow[] = [];

  constructor(
    readonly mg: Game,
    readonly ww: WorldWar,
  ) {
    const sc = ww.scenario;
    this.zoneState = sc.strategicList().map(() => emptyZone());
    this.countryList = [
      null,
      ...sc.countries.map((tag, i) => new CountryAir(i + 1, tag)),
    ];
    this.rebuildDerived();
  }

  get econ(): WwEconomy {
    return this.ww.economy;
  }
  get land(): WwLand {
    return this.ww.land;
  }
  get navy(): WwNavy {
    return this.ww.navy;
  }

  /** Spec §12.4: nothing deployed at the start (the AI deploys on its first day). */
  start(): void {
    for (const c of this.countries()) this.airDirtyCountries.add(c.smallID);
    if (this.wingsLive) formStartWings(this); // lane A
  }

  // ---- Clock (spec §2.2-7) ----

  tick(ticks: number): void {
    const prep = this.ww.inPrep(ticks);
    if (!prep) {
      const day = this.ww.day(ticks);
      if (day !== this.lastCommonDay) this.lastCommonDay = day;
      const k = ticks - dayStartTick(day, this.ww.prepEndTick());
      if (this.wingsLive) {
        this.tickWings(ticks, day, k);
        return;
      }
      if (k >= 0 && k < WW_DAY_SPLIT) {
        // ① air zones: sorties, combat, AA, superiority, then the effects
        for (const s of this.ww.scenario.strategicList()) {
          if (s.idx % WW_DAY_SPLIT !== k) continue;
          this.zoneState[s.idx].lastDay = day;
          // A1/A2 mark the zone (setAirSup, markZone) when it changed.
          dailyAirZone(this, s.id, day); // A1
          airMissionEffects(this, s.id, day); // A2
          // P6 hooks (D, W2, S; plan decisions 3, 12): the depth's zone day
          // (mines' air side, night, aces, recon, then the atomic drops).
          this.ww.depth.airZoneDay(s.id, day, ticks);
        }
        if (k === WW_DAY_SPLIT - 1) this.raidNotes.flush(this, day);
        // ② countries: re-basing, refills, decks, AI
        for (let id = 1; id < this.countryList.length; id++) {
          if (id % WW_DAY_SPLIT === k) this.dailyCountry(id, day);
        }
      }
      stepParadrops(this, ticks); // ③ A2
    }
  }

  /**
   * ww8: the wing model's tick (design §3.5, §3.6, §3.8): the wings' phases,
   * the zones' pulses, then the zones' close and the countries' turns on the
   * day's first ticks.
   */
  private tickWings(ticks: number, day: number, k: number): void {
    stepWings(this, ticks); // lane B
    pulseZones(this, ticks); // lane B
    if (k < 0 || k >= WW_DAY_SPLIT) return;
    for (const s of this.ww.scenario.strategicList()) {
      if (s.idx % WW_DAY_SPLIT !== k) continue;
      this.zoneState[s.idx].lastDay = day;
      closeAirZone(this, s.id, day, ticks); // lane B
      this.ww.depth.airZoneDay(s.id, day, ticks);
    }
    if (k === WW_DAY_SPLIT - 1) this.raidNotes.flush(this, day);
    for (let id = 1; id < this.countryList.length; id++) {
      if (id % WW_DAY_SPLIT !== k) continue;
      const p = this.mg.playerBySmallID(id);
      if (!p.isPlayer() || !this.ww.isActor(id)) continue;
      dailyWingCountry(this, id, day); // lane A
      if (!this.ww.isHumanControlled(id) || this.ww.autoOn(id, "air")) {
        aiWings(this, id, day); // lane E
      }
      this.airDirtyCountries.add(id);
    }
  }

  private dailyCountry(id: number, day: number): void {
    const c = this.countryList[id];
    const p = this.mg.playerBySmallID(id);
    // P5 plan decision 6: the countries that play (an exile does).
    if (
      c === null ||
      c === undefined ||
      !p.isPlayer() ||
      !this.ww.isActor(id)
    ) {
      return;
    }
    dailyAirCountry(this, id, day); // A1
    // P5 plan decision 7: the AI runs a country no human controls now.
    // A human's auto zones, or (automation) its whole air force.
    if (
      !this.ww.isHumanControlled(id) ||
      c.autoZones.length > 0 ||
      this.ww.autoOn(id, "air")
    ) {
      aiAir(this, id, day);
    }
    this.airDirtyCountries.add(id);
  }

  // ---- Orders (spec §19.3) ----

  /** air_deploy / air_recall / air_auto (A1); null when it took effect. */
  issue(smallID: number, order: WwOrder, tick: number): WwOrderBlock | null {
    const c = this.country(smallID);
    const p = this.mg.playerBySmallID(smallID);
    // P5 plan decision 6: the country plays (an exile does).
    if (c === null || !p.isPlayer() || !this.ww.isActor(smallID)) {
      return "dead";
    }
    switch (order.kind) {
      case "air_deploy":
      case "air_recall":
      case "air_auto": {
        if (this.wingsLive) return "bad_index";
        const block = issueAirOrder(this, smallID, order, tick);
        if (block === null) this.airDirtyCountries.add(smallID);
        return block;
      }
      case "wing_mission":
      case "wing_base":
      case "wing_auto":
      case "wing_disband":
      case "air_field":
      case "army_air_priority": {
        const block = this.issueWingOrder(smallID, order, tick);
        if (block === null) this.airDirtyCountries.add(smallID);
        return block;
      }
      case "air_template":
      case "air_template_drop":
      case "air_group_order":
      case "air_group_disband": {
        if (!this.wingsLive) return "bad_index";
        const block =
          order.kind === "air_template"
            ? issueTemplate(this, smallID, order)
            : order.kind === "air_template_drop"
              ? issueTemplateDrop(this, smallID, order.id)
              : order.kind === "air_group_order"
                ? issueGroupOrder(this, smallID, order, tick)
                : issueGroupDisband(this, smallID, order.group, tick);
        if (block === null) this.airDirtyCountries.add(smallID);
        return block;
      }
      default:
        return "bad_index";
    }
  }

  /**
   * ww8: the wing orders (design §3.3). Refused in the old model. An order
   * takes the sender's own wings only: one foreign or unknown id refuses it
   * whole, before the lanes' judges run.
   */
  private issueWingOrder(
    smallID: number,
    order: WingOrder,
    tick: number,
  ): WwOrderBlock | null {
    if (!this.wingsLive) return "bad_index";
    switch (order.kind) {
      case "wing_mission": {
        const wings = this.ownWings(smallID, order.wings);
        if (wings === null) return "bad_index";
        // A wing in a group takes its group's orders (recon excepted; [auto] wings too).
        if (
          order.mission !== "recon" &&
          wings.some((w) => w.group !== 0 && !w.auto)
        ) {
          return "in_group";
        }
        return issueWingMission(this, smallID, wings, order, tick); // lane B
      }
      case "wing_base": {
        const wings = this.ownWings(smallID, order.wings);
        if (wings === null) return "bad_index";
        if (wings.some((w) => w.group !== 0 && !w.auto)) return "in_group";
        return issueWingBase(this, smallID, wings, order, tick); // lane A
      }
      case "wing_auto": {
        const wings = this.ownWings(smallID, order.wings);
        if (wings === null) return "bad_index";
        return issueWingAuto(this, smallID, wings, order.on); // lane E
      }
      case "wing_disband": {
        const wings = this.ownWings(smallID, [order.wing]);
        if (wings === null) return "bad_index";
        return issueWingDisband(this, smallID, wings[0], tick); // lane A
      }
      case "air_field":
        return issueAirField(this, smallID, order.region, tick); // lane A
      case "army_air_priority":
        return issueArmyAirPriority(this, smallID, order.army, order.on); // lane E
    }
  }

  /** The named wings, ascending and without repeats; null when one is not the sender's. */
  private ownWings(smallID: number, ids: readonly number[]): Wing[] | null {
    const out: Wing[] = [];
    for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
      const w = this.wings.get(id);
      if (w === undefined || w.owner !== smallID) return null;
      out.push(w);
    }
    return out;
  }

  // ---- What the others read ----

  /** A side's air superiority ‰ over a strategic region (its last day). */
  airSup(side: number, sr: number): number {
    const i = this.ww.scenario.srIdxOf(sr);
    return i < 0 ? 0 : (this.zoneState[i].sup.get(side) ?? 0);
  }

  /** Sets a zone's superiority by side (A1, on the zone's day). */
  setAirSup(sr: number, values: ReadonlyMap<number, number>): void {
    const i = this.ww.scenario.srIdxOf(sr);
    if (i < 0) return;
    const m = new Map<number, number>();
    for (const [k, v] of [...values].sort((a, b) => a[0] - b[0])) {
      if (v !== 0) m.set(k, v);
    }
    this.zoneState[i].sup = m;
    this.airDirtyZones.add(i);
  }

  /** A side's CAS pool over a zone today, centi-hits. */
  casPool(sr: number, side: number): number {
    const i = this.ww.scenario.srIdxOf(sr);
    return i < 0 ? 0 : (this.zoneState[i].cas.get(side) ?? 0);
  }

  /** Spec §14.6 for a battle region and a division side: the worst enemy superiority's penalty (A1). */
  airPenaltyBp(region: number, side: number, divAirAtk: number): number {
    return airPenaltyFor(this, region, side, divAirAtk);
  }

  /** Spec §14.6: movement into `region` (A1). */
  airMoveFactorPm(region: number, side: number): number {
    return airMoveFactorFor(this, region, side);
  }

  /** ww84: what enemy superiority leaves of `region`'s supply, ‰. */
  airSupplyFactorPm(region: number, side: number): number {
    return airSupplyFactorFor(this, region, side);
  }

  /** Spec §14.10: air supply into `region` (A2). */
  airSupplyMilli(region: number, side: number): number {
    return airSupplyAt(this, region, side);
  }

  /** Spec §14.10: the air war's conditions of a paradrop (A2). */
  paradropBlock(
    smallID: number,
    army: number,
    target: number,
  ): WwOrderBlock | null {
    return paradropBlockFor(this, smallID, army, target);
  }

  /** Wing ids in a zone, ascending. */
  wingsIn(sr: number): readonly number[] {
    return this.wingsBySr.get(sr) ?? NO_IDS;
  }

  /** The owner's deployments in id order (the Map's order). */
  wingsOf(owner: number): Wing[] {
    const ids = this.wingsByOwner.get(owner);
    if (ids === undefined) return [];
    const out: Wing[] = [];
    for (const id of ids) out.push(this.wings.get(id)!);
    return out;
  }

  /** Planes based at a region now (capacity check, spec §13.3; P6: design planes too). */
  baseUse(region: number): number {
    let n = 0;
    for (const id of this.wingsByBase.get(region) ?? NO_IDS) {
      const d = this.wings.get(id);
      if (d !== undefined) n += wingPlanes(d);
    }
    return n;
  }

  /**
   * w50: a base can be used: an air_base with damage short of its level, or
   * a ready field strip. There is no limit on the planes it holds.
   */
  baseUsable(region: number): boolean {
    const econ = this.econ;
    const level = econ.buildingArray("air_base")[region] ?? 0;
    const dmg =
      econ.damage[region * BUILDING_IDS.length + buildingIndex("air_base")] ??
      0;
    if (level * 1000 - dmg > 0) return true;
    const ready = this.strips.get(region);
    return ready !== undefined && this.mg.ticks() >= ready;
  }

  /** Spec §13.3 (the old model): level × 200 less the bomb damage (whole and partial levels). */
  baseCapacity(region: number): number {
    const econ = this.econ;
    const level = econ.buildingArray("air_base")[region] ?? 0;
    const dmg =
      econ.damage[region * BUILDING_IDS.length + buildingIndex("air_base")] ??
      0;
    const cap = Math.max(
      0,
      Math.floor((WW_AIR_BASE_CAPACITY * (level * 1000 - dmg)) / 1000),
    );
    if (this.strips.size === 0) return cap;
    const ready = this.strips.get(region);
    return ready !== undefined && this.mg.ticks() >= ready
      ? cap + WW_FIELD_STRIP_PLANES
      : cap;
  }

  /** ww8: every wing in id order. Don't add or remove wings while walking it. */
  wingArray(): readonly Wing[] {
    return (this.wingList ??= [...this.wings.values()]);
  }

  /** ww8: the wing ids based at a region, ascending (a ferrying wing counts at its destination). */
  wingsAtBase(region: number): readonly number[] {
    return this.wingsByBase.get(region) ?? NO_IDS;
  }

  /** A base's bomb damage per level, ‰ (0 with no air_base). */
  baseDamagePm(region: number): number {
    const level = this.econ.buildingArray("air_base")[region] ?? 0;
    const dmg =
      this.econ.damage[
        region * BUILDING_IDS.length + buildingIndex("air_base")
      ] ?? 0;
    return level === 0 ? 0 : Math.floor(dmg / level);
  }

  /**
   * planeStats at the owner's stats and techs, kept by (owner, type,
   * generation) while its statsVer and researched set are the same
   * (pre-flight §0-7).
   */
  planeStatsOf(owner: number, type: AirType, gen: number): PlaneStats {
    const ce = this.econ.country(owner);
    const key = owner * 256 + AIR_TYPES.indexOf(type) * 4 + gen;
    const hit = this.planeStatsMemo.get(key);
    if (
      ce !== null &&
      hit !== undefined &&
      hit.statsVer === ce.statsVer &&
      hit.researched === ce.researched
    ) {
      return hit.stats;
    }
    const base =
      ce === null
        ? planeStats(type, gen, emptyStats(), new Set())
        : planeStats(type, gen, ce.stats, ce.researched);
    // Owner, 2026-11-05: a generic plane is weaker than any real one.
    const stats = designerOn(this.ww.depth)
      ? base
      : weakPlaneStats(base, type, gen);
    if (ce !== null) {
      this.planeStatsMemo.set(key, {
        statsVer: ce.statsVer,
        researched: ce.researched,
        stats,
      });
    }
    return stats;
  }

  /**
   * A drop's transport numbers, whoever flies it: reach and the run in are the
   * lift's rules, read from the generic transport whatever the planes are, so
   * they stay out of planeStatsOf's cut for generic planes.
   */
  transportStatsOf(owner: number): PlaneStats {
    const ce = this.econ.country(owner);
    if (ce === null) {
      return planeStats("transport_plane", 1, emptyStats(), new Set());
    }
    // ww91 (B17): a major's best held catalogue transport (design slots by
    // score, the first with stock) sets reach and run in; none held: generic.
    const depth = this.ww.depth as WwDepth | undefined;
    if (depth !== undefined) {
      for (const slot of planeDesignSlotsOf(depth, owner, "transport_plane")) {
        const key = equipKey("plane_design", slot);
        if (ce.stock[key] <= 0) continue;
        const ds = planeStatsOfKey(depth, owner, key);
        if (ds !== null) return designPlaneAsP4(ds, "transport_plane");
      }
    }
    return planeStats("transport_plane", 1, ce.stats, ce.researched);
  }

  /**
   * Adds a wing. Ids only rise: the Map stays in id order. Whatever the caller
   * leaves out starts at rest, and the planes in `counts` and `dcounts` are the
   * caller's to have taken off the ledger.
   */
  /** ww91 N3: a new wing's experience, the national pilot keys on top of 300. */
  private newWingXp(owner: number): number {
    const st = this.econ.country(owner)?.stats;
    if (st === undefined) return WING_NEW_FIELD_DEFAULTS.xpMilli;
    return newWingXp(st, this.ww.day(this.mg.ticks()) === 0);
  }

  addWing(
    d: Pick<Wing, "owner" | "type" | "counts" | "base"> &
      Partial<Omit<Wing, "id" | "owner" | "type" | "counts" | "base">>,
  ): Wing {
    // Field by field in the snapshot's order, whatever the caller's.
    const n = WING_NEW_FIELD_DEFAULTS;
    const full: Wing = {
      id: this.nextWingId++,
      owner: d.owner,
      sr: d.sr ?? 0,
      type: d.type,
      mission: d.mission ?? n.flyMission,
      counts: [...d.counts],
      goalCount: d.goalCount ?? 0,
      base: d.base,
      lossRest: d.lossRest ?? 0,
      auto: d.auto ?? false,
      volunteerFor: d.volunteerFor ?? 0,
      dcounts:
        d.dcounts === undefined
          ? new Array<number>(WW_PLANE_DESIGN_SLOTS).fill(0)
          : [...d.dcounts],
      night: d.night ?? false,
      ace: d.ace ?? 0,
      nameNo: d.nameNo ?? n.nameNo,
      target: d.target ?? n.target,
      follow: d.follow ?? n.follow,
      escortOf: d.escortOf ?? n.escortOf,
      cls: d.cls ?? n.cls,
      phase: d.phase ?? n.phase,
      until: d.until ?? n.until,
      flyMilli: d.flyMilli ?? n.flyMilli,
      leg: d.leg ?? n.leg,
      hit: d.hit ?? n.hit,
      flySr: d.flySr ?? n.flySr,
      flyMission: d.flyMission ?? n.flyMission,
      xpMilli: d.xpMilli ?? this.newWingXp(d.owner),
      kills: d.kills ?? n.kills,
      lastFerryDay: d.lastFerryDay ?? n.lastFerryDay,
      noticeDay: d.noticeDay ?? n.noticeDay,
      dayKills: d.dayKills ?? n.dayKills,
      dayLost: d.dayLost ?? n.dayLost,
      prevKills: d.prevKills ?? n.prevKills,
      prevLost: d.prevLost ?? n.prevLost,
      aceMark: d.aceMark ?? n.aceMark,
      group: d.group ?? n.group,
      fullMax: d.fullMax ?? n.fullMax,
    };
    this.wings.set(full.id, full);
    this.wingList = null;
    this.indexWing(full);
    this.markWing(full.id);
    return full;
  }

  /** Ends a deployment; its planes go back to the stock when `returnPlanes`, else they are gone with it. */
  removeWing(id: number, back: boolean): void {
    const d = this.wings.get(id);
    if (d === undefined) return;
    if (this.wingsLive) aceOnWingGone(this.ww.depth, d); // lane D
    const ce = this.econ.country(d.owner);
    if (ce !== null) {
      const type = AIR_TYPES[d.type];
      if (back) {
        returnPlanes(ce, type, d.counts);
      } else {
        d.counts.forEach((c, i) => {
          const k = equipKey(type, i + 1);
          if (k >= 0)
            ce.planesDeployed[k] = Math.max(0, ce.planesDeployed[k] - c);
        });
      }
      // P6 (lane E): its design planes the same way (a carrier wing's
      // record mirrors its deck: the deck keeps them, its caller zeroes it).
      if (back) returnDesignPlanes(this.ww.depth, d.owner, d.dcounts);
      else loseDesignPlanes(this.ww.depth, d.owner, d.dcounts);
    }
    this.wings.delete(id);
    this.wingList = null;
    this.unindexWing(d);
    this.airDirtyWings.delete(id);
    this.removedWingIds.push(id);
    this.airDirtyCountries.add(d.owner);
  }

  /**
   * The kill site of every air loss (A1's combat, AA, N2's fleet AA, A2):
   * takes `counts` (per generation) off deployment `id` and the deployed
   * ledger, and names the killer `by` (0: nobody — fuel, crashes) to P5's
   * war score (EndgameHooks.onPlanesLost). A deployment left empty stays
   * (its refill is A1's); returns the planes taken. P6 (lane E): the
   * entries of `counts` past the record's generations are its design
   * slots (index gens + slot − 1), off `dcounts` and the design ledger.
   */
  shootDown(id: number, counts: readonly number[], by: number): number {
    const d = this.wings.get(id);
    if (d === undefined) return 0;
    const gens = d.counts.length;
    const took = d.counts.map((c, i) =>
      Math.max(0, Math.min(c, Math.floor(counts[i] ?? 0))),
    );
    let n = took.reduce((a, b) => a + b, 0);
    let tookD: number[] | null = null;
    if (counts.length > gens) {
      tookD = d.dcounts.map((c, s) =>
        Math.max(0, Math.min(c, Math.floor(counts[gens + s] ?? 0))),
      );
      for (const c of tookD) n += c;
    }
    if (n === 0) return 0;
    if (this.wingsLive) d.dayLost += n;
    took.forEach((c, i) => (d.counts[i] -= c));
    const type = AIR_TYPES[d.type];
    const ce = this.econ.country(d.owner);
    if (ce !== null) losePlanes(ce, type, took);
    if (tookD !== null) {
      tookD.forEach((c, s) => (d.dcounts[s] -= c));
      loseDesignPlanes(this.ww.depth, d.owner, tookD);
    }
    onPlanesLost(this, d.owner, by, type, n);
    this.markWing(id);
    this.airDirtyCountries.add(d.owner);
    return n;
  }

  /**
   * Hands a deployment to another owner (P5 civil war, spec §15.3: planes
   * based in the rebels' regions); the owner index follows (P5 final lane:
   * a bare `d.owner =` left the old owner's index with a stale id).
   */
  setWingOwner(d: Wing, owner: number): void {
    if (d.owner === owner) return;
    const from = d.owner;
    this.unindexWing(d);
    d.owner = owner;
    this.indexWing(d);
    this.markWing(d.id);
    this.airDirtyCountries.add(from);
    this.airDirtyCountries.add(owner);
  }

  /** Moves a deployment to another base (A1's re-basing). */
  setWingBase(d: Wing, base: number): void {
    if (d.base === base) return;
    this.unindexWing(d);
    d.base = base;
    this.indexWing(d);
    this.markWing(d.id);
  }

  /** ww8: moves a wing's standing order to another zone (the wingsIn index follows). */
  setWingZone(d: Wing, sr: number): void {
    if (d.sr === sr) return;
    this.unindexWing(d);
    d.sr = sr;
    this.indexWing(d);
    this.markWing(d.id);
  }

  /** ww8: opens a field strip at `readyTick` (a negative tick removes it), keeping key order. */
  setStrip(region: number, readyTick: number): void {
    if (readyTick < 0) this.strips.delete(region);
    else {
      this.strips.set(region, readyTick);
      this.strips = new Map([...this.strips].sort((a, b) => a[0] - b[0]));
    }
  }

  /** ww8: a take-off, stand-down or ferry for the screens this tick (lanes A, B). */
  noteFlight(row: WingFlightRow): void {
    this.flightsOut.push(row);
  }

  /** ww8: a side's losses in a zone's air battle for the screens this tick (lane B). */
  noteFight(sr: number, side: number, lost: number): void {
    this.fightsOut.push([sr, side, lost]);
  }

  country(smallID: number): CountryAir | null {
    return this.countryList[smallID] ?? null;
  }

  countries(): CountryAir[] {
    return this.countryList.filter((c): c is CountryAir => c !== null);
  }

  markZone(srIdx: number): void {
    this.airDirtyZones.add(srIdx);
  }
  markWing(id: number): void {
    const w = this.wings.get(id);
    if (w === undefined) return;
    this.airDirtyWings.add(id);
    // A group's view lists its members' phases.
    if (w.group !== 0) this.airDirtyCountries.add(w.owner);
  }

  /** w50: removes a group (its wings, if any, must have gone or be released first). */
  removeGroup(id: number): void {
    const g = this.groups.get(id);
    if (g === undefined) return;
    for (const w of this.wingsOf(g.owner)) {
      if (w.group === id) {
        w.group = 0;
        w.fullMax = 0;
        this.markWing(w.id);
      }
    }
    this.groups.delete(id);
    this.airDirtyCountries.add(g.owner);
  }
  markCountry(id: number): void {
    this.airDirtyCountries.add(id);
  }
  /** A message to the country's human player only; `key` is the full key. */
  message(
    to: number,
    key: string,
    params: Record<string, string | number>,
  ): void {
    this.navy.message(to, key, params);
  }

  // ---- Control, capitulation, annexation (decision 32) ----

  /** A base lost changes nothing today: the owner's next day re-bases (A1). */
  onControlChanged(
    region: number,
    from: number,
    to: number,
    tick: number,
  ): void {
    if (from === to) return;
    for (const id of this.wingsByBase.get(region) ?? NO_IDS) {
      this.markWing(id);
    }
    if (this.wingsLive) onBaseControlChanged(this, region, from, to, tick); // lane A
  }

  /** Decision 32: a capitulated country's deployments are gone with their planes. */
  onCapitulation(loser: number, victor: number): void {
    void victor;
    for (const d of this.wingsOf(loser)) this.removeWing(d.id, false);
    this.dropCountryGroups(loser);
    const c = this.country(loser);
    if (c !== null) {
      c.autoZones = [];
      c.priorityArmies = [];
    }
  }

  /**
   * Decision 32 (P3 annexation): `from`'s deployments go back to its stock
   * (P3's merge moves the stock to `to`); "disband" too.
   */
  transferUnits(from: number, to: number, mode: "transfer" | "disband"): void {
    void to;
    void mode;
    for (const d of this.wingsOf(from)) this.removeWing(d.id, true);
    this.dropCountryGroups(from);
    const c = this.country(from);
    if (c !== null) {
      c.autoZones = [];
      c.priorityArmies = [];
    }
  }

  /** w50: a country that is gone loses its groups and templates. */
  private dropCountryGroups(id: number): void {
    for (const g of [...this.groups.values()]) {
      if (g.owner === id) this.groups.delete(g.id);
    }
    const c = this.country(id);
    if (c !== null) c.templates = [];
  }

  // ---- Screens (spec §19.4) ----

  takeData(): WwAirData | null {
    if (
      this.airDirtyZones.size === 0 &&
      this.airDirtyWings.size === 0 &&
      this.airDirtyCountries.size === 0 &&
      this.removedWingIds.length === 0 &&
      this.flightsOut.length === 0 &&
      this.fightsOut.length === 0
    ) {
      return null;
    }
    const humans = new Set<number>();
    for (const c of this.countries()) {
      const p = this.mg.playerBySmallID(c.smallID);
      if (p.isPlayer() && this.ww.isHumanControlled(c.smallID)) {
        humans.add(c.smallID);
      }
    }
    const data: WwAirData = {
      zones: [],
      deployments: [],
      removedDeployments: [...this.removedWingIds],
      details: [],
    };
    const list = this.ww.scenario.strategicList();
    for (const i of [...this.airDirtyZones].sort((a, b) => a - b)) {
      const z = this.zoneState[i];
      const sides = new Set<number>([...z.sup.keys(), ...z.sorties.keys()]);
      const zone: AirZoneData = {
        sr: list[i].id,
        // Spec §14.6: what the battle card needs for the land war's air cut.
        enemySky: [...z.enemySup]
          .sort((a, b) => a[0] - b[0])
          .map(([side, enemySupPm]) => ({
            side,
            enemySupPm,
            bonusPp: z.enemyPp.get(side) ?? 0,
          })),
        sides: [...sides]
          .sort((a, b) => a - b)
          .map((side) => ({
            side,
            supPm: z.sup.get(side) ?? 0,
            sorties: [...(z.sorties.get(side) ?? [])],
          })),
        result: [...z.result]
          .filter(([id]) => humans.has(id))
          .map(([id, r]) => [
            id,
            {
              shotDown: r[0] ?? 0,
              lost: r[1] ?? 0,
              casHitsCenti: r[2] ?? 0,
              bombPoints: r[3] ?? 0,
              navalDamageMilli: r[4] ?? 0,
            },
          ]),
      };
      data.zones.push(zone);
    }
    for (const id of [...this.airDirtyWings].sort((a, b) => a - b)) {
      const d = this.wings.get(id);
      if (d !== undefined && humans.has(d.owner)) {
        data.deployments.push(this.deploySummary(d));
      }
    }
    for (const id of [...this.airDirtyCountries].sort((a, b) => a - b)) {
      if (humans.has(id)) data.details.push(this.countryDetail(id));
    }
    if (this.wingsLive) this.fillWingData(data, humans);
    if (this.flightsOut.length > 0) this.flightsOut = [];
    if (this.fightsOut.length > 0) this.fightsOut = [];
    this.airDirtyZones.clear();
    this.airDirtyWings.clear();
    this.airDirtyCountries.clear();
    this.removedWingIds = [];
    if (
      data.zones.length === 0 &&
      data.deployments.length === 0 &&
      data.removedDeployments.length === 0 &&
      data.details.length === 0 &&
      data.briefs === undefined &&
      data.flights === undefined &&
      data.fights === undefined
    ) {
      return null;
    }
    return data;
  }

  /** ww8: the wing model's part of the update. Fields with nothing in them stay absent. */
  private fillWingData(data: WwAirData, humans: ReadonlySet<number>): void {
    data.live = true;
    const briefs: WingBrief[] = [];
    const wings: WingDetail[] = [];
    for (const id of [...this.airDirtyWings].sort((a, b) => a - b)) {
      const w = this.wings.get(id);
      if (w === undefined) continue;
      briefs.push(this.wingBrief(w));
      if (humans.has(w.owner)) wings.push(this.wingDetail(w));
    }
    if (briefs.length > 0) data.briefs = briefs;
    if (wings.length > 0) data.wings = wings;
    if (this.flightsOut.length > 0) data.flights = this.flightsOut;
    if (this.fightsOut.length > 0) data.fights = this.fightsOut;
  }

  private wingBrief(w: Wing): WingBrief {
    return {
      id: w.id,
      owner: w.owner,
      side: wingSide(this, w),
      type: w.type,
      base: w.base,
      planes: wingPlanes(w),
      phase: w.phase,
      until: w.until,
      flySr: w.flySr,
      hit: w.hit,
      flyMission: w.flyMission,
    };
  }

  private wingDetail(w: Wing): WingDetail {
    const st = deploymentStats(this, w);
    return {
      ...this.wingBrief(w),
      nameNo: w.nameNo,
      mission: w.mission,
      sr: w.sr,
      target: w.target,
      follow: w.follow,
      escortOf: w.escortOf,
      cls: w.cls,
      night: w.night,
      auto: w.auto,
      volunteerFor: w.volunteerFor,
      counts: [...w.counts],
      ...(w.dcounts.some((c) => c > 0) ? { dcounts: [...w.dcounts] } : {}),
      flyMilli: w.flyMilli,
      leg: w.leg,
      xpMilli: w.xpMilli,
      kills: w.kills,
      ace: w.ace,
      prevKills: w.prevKills,
      prevLost: w.prevLost,
      rangeKm: st.rangeKm,
      speedKmh: st.speedKmh,
      ...(w.group !== 0 ? { group: w.group } : {}),
      ...(w.fullMax !== 0 ? { fullMax: w.fullMax } : {}),
    };
  }

  private deploySummary(d: Wing): AirDeploySummary {
    return {
      id: d.id,
      owner: d.owner,
      sr: d.sr,
      type: AIR_TYPES[d.type],
      mission: AIR_MISSIONS[d.mission],
      counts: [...d.counts],
      target: d.goalCount,
      base: d.base,
      // P6 (lane W2): the night flag, only when on (day records keep P4's shape).
      ...(d.night ? { night: true } : {}),
      // P6 (lane E): the design planes per slot, only with some.
      ...(d.dcounts.some((c) => c > 0) ? { dcounts: [...d.dcounts] } : {}),
    };
  }

  /**
   * Spec §14.8 (the screens' hatching and bomb carpets): the regions `id`
   * controls with bomb damage outstanding, [region, damage milli summed
   * over its buildings], ascending. Repairs (lane E) take them off.
   */
  private bombedRegionsOf(id: number): [number, number][] {
    const out: [number, number][] = [];
    const n = BUILDING_IDS.length;
    const dmg = this.econ.damage;
    const ctl = this.ww.land.controller;
    for (const r of this.ww.scenario.landRegions) {
      if (ctl[r.id] !== id) continue;
      let sum = 0;
      for (let b = 0; b < n; b++) sum += dmg[r.id * n + b] ?? 0;
      if (sum > 0) out.push([r.id, sum]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  private countryDetail(id: number): CountryAirDetail {
    const c = this.country(id)!;
    const ce = this.econ.country(id)!;
    const bases = new Map<number, number>();
    for (const d of this.wingsOf(id)) {
      if (d.base <= 0) continue;
      const n = wingPlanes(d);
      bases.set(d.base, (bases.get(d.base) ?? 0) + n);
    }
    // P6 (lane E): each type's design slots (the designs flying as it).
    const depth = this.ww.depth;
    const dslots = AIR_TYPES.map((type) => designSlotsFor(depth, id, type));
    const sum = (arr: readonly number[], type: AirType) => {
      let n = 0;
      for (let g = 1; g <= EQUIPMENT_GENS[type]; g++)
        n += arr[equipKey(type, g)];
      for (const s of dslots[AIR_TYPES.indexOf(type)]) {
        n += arr[equipKey("plane_design", s)] ?? 0;
      }
      return n;
    };
    const decks = AIR_TYPES.map(() => 0);
    const t = this.navy.ships;
    for (let r = 0; r < t.rows; r++) {
      if (t.id[r] === 0 || t.owner[r] !== id) continue;
      const deck = t.deckOf(r);
      ["cv_fighter", "cv_cas", "cv_naval_bomber"].forEach((type, i) => {
        const ti = AIR_TYPES.indexOf(type as AirType);
        decks[ti] += deck[i * 3] + deck[i * 3 + 1] + deck[i * 3 + 2];
        for (const s of dslots[ti]) decks[ti] += t.deckDOf(r)[s - 1] ?? 0;
      });
    }
    const deployed = AIR_TYPES.map((type, i) =>
      Math.max(0, sum(ce.planesDeployed, type) - decks[i]),
    );
    const day = this.ww.day(this.mg.ticks());
    const ring = (r: readonly number[]) => {
      let n = 0;
      for (let i = 0; i < 30; i++) n += r[(((day - i) % 30) + 30) % 30] ?? 0;
      return n;
    };
    return {
      smallID: id,
      bases: [...bases]
        .sort((a, b) => a[0] - b[0])
        .map(([region, used]) => ({
          region,
          used,
          cap: this.baseCapacity(region),
          damagePm: this.baseDamagePm(region),
        })),
      stock: AIR_TYPES.map((type) => sum(ce.stock, type)),
      deployed,
      decks,
      tally30: [
        ring(c.tally[0]),
        ring(c.tally[1]),
        ring(c.tally[2]),
        ring(c.bombTaken),
        ring(c.tally[3]),
        ring(c.tally[4]),
      ],
      bombedRegions: this.bombedRegionsOf(id),
      // Lane U: the zones the AI runs for this human (the zone card's auto).
      autoZones: [...c.autoZones].sort((a, b) => a - b),
      ...(this.wingsLive ? this.wingCountryDetail(id, c) : {}),
      ...(this.wingsLive && c.templates.length > 0
        ? {
            templates: c.templates.map((t) => ({
              ...t,
              planes: [...t.planes],
            })),
          }
        : {}),
      ...(this.wingsLive && this.groups.size > 0 ? this.groupDetail(id) : {}),
    };
  }

  private groupDetail(id: number): Pick<CountryAirDetail, "groups"> {
    const groups = groupViews(this, id);
    return groups.length > 0 ? { groups } : {};
  }

  /** ww8: the country's part of the update in the wing model. */
  private wingCountryDetail(
    id: number,
    c: CountryAir,
  ): Pick<CountryAirDetail, "bases" | "strips" | "reports" | "priorityArmies"> {
    const ctl = this.land.controller;
    return {
      bases: baseUsesOf(this, id), // lane A
      strips: [...this.strips].filter(([r]) => ctl[r] === id),
      reports: c.reports.map((r) => ({ ...r, stopped: [...r.stopped] })),
      priorityArmies: [...c.priorityArmies],
    };
  }

  // ---- Snapshot, hash ----

  snapshot(): WwAirState {
    const arr = (m: Map<number, number>) =>
      [...m].map(([k, v]): [number, number] => [k, v]);
    return {
      wings: [...this.wings.values()].map((d) => ({
        ...d,
        counts: [...d.counts],
        dcounts: [...d.dcounts],
      })),
      zones: this.zoneState.map((z) => ({
        sup: arr(z.sup),
        enemySup: arr(z.enemySup),
        enemyPp: arr(z.enemyPp),
        alertDay: arr(z.alertDay),
        cas: arr(z.cas),
        sorties: [...z.sorties].map(([k, v]): [number, number[]] => [
          k,
          [...v],
        ]),
        result: [...z.result].map(([k, v]): [number, number[]] => [k, [...v]]),
        navalSearch: arr(z.navalSearch),
        navalAsw: arr(z.navalAsw),
        navalStrike: arr(z.navalStrike),
        fightersSup: arr(z.fightersSup),
        casShare: z.casShare.map((x): [number, number, number] => [
          x[0],
          x[1],
          x[2],
        ]),
        airSupply: z.airSupply.map((x): [number, number, number] => [
          x[0],
          x[1],
          x[2],
        ]),
        lastDay: z.lastDay,
        score: arr(z.score),
        casNow: z.casNow.map((x): [number, number, number] => [
          x[0],
          x[1],
          x[2],
        ]),
        today: {
          sorties: [...z.today.sorties].map(([k, v]): [number, number[]] => [
            k,
            [...v],
          ]),
          result: [...z.today.result].map(([k, v]): [number, number[]] => [
            k,
            [...v],
          ]),
          navalSearch: arr(z.today.navalSearch),
          navalAsw: arr(z.today.navalAsw),
          navalStrike: arr(z.today.navalStrike),
          fightersSup: arr(z.today.fightersSup),
          airSupply: z.today.airSupply.map((x): [number, number, number] => [
            x[0],
            x[1],
            x[2],
          ]),
          recon: arr(z.today.recon),
          flown: arr(z.today.flown),
        },
      })),
      countries: this.countries().map((c) => ({
        bombTaken: [...c.bombTaken],
        tally: c.tally.map((t) => [...t]),
        autoZones: [...c.autoZones],
        reports: c.reports.map((r) => ({
          ...r,
          stopped: r.stopped.map((x): [number, number] => [x[0], x[1]]),
        })),
        priorityArmies: [...c.priorityArmies],
        nextWingNo: [...c.nextWingNo],
        reformDay: [...c.reformDay],
        ...(c.templates.length > 0
          ? {
              templates: c.templates.map((t) => ({
                ...t,
                planes: [...t.planes],
              })),
            }
          : {}),
        ...(c.nextTemplateId !== 1 ? { nextTemplateId: c.nextTemplateId } : {}),
      })),
      nextWingId: this.nextWingId,
      planesLostTotal: this.planesLostTotal,
      bombPointsTotal: this.bombPointsTotal,
      lastCommonDay: this.lastCommonDay,
      wingsLive: this.wingsLive,
      strips: arr(this.strips),
      ...(this.groups.size > 0
        ? {
            groups: [...this.groups.values()].map((g) => ({
              ...g,
              zones: [...g.zones],
            })),
          }
        : {}),
      ...(this.nextGroupId !== 1 ? { nextGroupId: this.nextGroupId } : {}),
    };
  }

  restoreState(s: WwAirState): void {
    this.wings.clear();
    for (const d of s.wings) {
      this.wings.set(d.id, {
        ...d,
        counts: [...d.counts],
        dcounts:
          d.dcounts === undefined
            ? new Array<number>(WW_PLANE_DESIGN_SLOTS).fill(0)
            : [...d.dcounts],
        night: d.night ?? false,
        ace: d.ace ?? 0,
        group: d.group ?? 0,
        fullMax: d.fullMax ?? 0,
      });
    }
    s.zones.forEach((x, i) => {
      const z = this.zoneState[i];
      if (z === undefined) return;
      z.sup = mapOf(x.sup);
      z.enemySup = mapOf(x.enemySup);
      z.enemyPp = mapOf(x.enemyPp);
      z.alertDay = mapOf(x.alertDay);
      z.cas = mapOf(x.cas);
      z.sorties = new Map(x.sorties.map(([k, v]) => [k, [...v]]));
      z.result = new Map(x.result.map(([k, v]) => [k, [...v]]));
      z.navalSearch = mapOf(x.navalSearch);
      z.navalAsw = mapOf(x.navalAsw);
      z.navalStrike = mapOf(x.navalStrike);
      z.fightersSup = mapOf(x.fightersSup);
      z.casShare = x.casShare.map((y): [number, number, number] => [
        y[0],
        y[1],
        y[2],
      ]);
      z.airSupply = x.airSupply.map((y): [number, number, number] => [
        y[0],
        y[1],
        y[2],
      ]);
      z.lastDay = x.lastDay;
      z.score = mapOf(x.score);
      z.casNow = x.casNow.map((y): [number, number, number] => [
        y[0],
        y[1],
        y[2],
      ]);
      z.today = {
        sorties: new Map(x.today.sorties.map(([k, v]) => [k, [...v]])),
        result: new Map(x.today.result.map(([k, v]) => [k, [...v]])),
        navalSearch: mapOf(x.today.navalSearch),
        navalAsw: mapOf(x.today.navalAsw),
        navalStrike: mapOf(x.today.navalStrike),
        fightersSup: mapOf(x.today.fightersSup),
        airSupply: x.today.airSupply.map((y): [number, number, number] => [
          y[0],
          y[1],
          y[2],
        ]),
        recon: mapOf(x.today.recon),
        flown: mapOf(x.today.flown),
      };
    });
    this.countries().forEach((c, i) => {
      const x = s.countries[i];
      if (x === undefined) return;
      c.bombTaken = [...x.bombTaken];
      c.tally = x.tally.map((t) => [...t]);
      c.autoZones = [...x.autoZones];
      c.reports = x.reports.map((r) => ({
        ...r,
        stopped: r.stopped.map((y): [number, number] => [y[0], y[1]]),
      }));
      c.priorityArmies = [...x.priorityArmies];
      c.nextWingNo = [...x.nextWingNo];
      c.reformDay = [...x.reformDay];
      c.templates = (x.templates ?? []).map((t) => ({
        ...t,
        planes: [...t.planes],
      }));
      c.nextTemplateId = x.nextTemplateId ?? 1;
    });
    this.groups.clear();
    for (const g of s.groups ?? []) {
      this.groups.set(g.id, { ...g, zones: [...g.zones] });
    }
    this.nextGroupId = s.nextGroupId ?? 1;
    this.nextWingId = s.nextWingId;
    this.planesLostTotal = s.planesLostTotal;
    this.bombPointsTotal = s.bombPointsTotal;
    this.lastCommonDay = s.lastCommonDay;
    this.wingsLive = s.wingsLive;
    this.strips = mapOf(s.strips);
    this.rebuildDerived();
    // A restored game's screens have seen nothing yet.
    this.zoneState.forEach((_, i) => this.airDirtyZones.add(i));
    for (const id of this.wings.keys()) this.airDirtyWings.add(id);
    for (const c of this.countries()) this.airDirtyCountries.add(c.smallID);
  }

  /** The memo and the deployment indexes. The constructor and restoreState call it. */
  rebuildDerived(): void {
    this.planeStatsMemo.clear();
    this.wingsBySr = new Map();
    this.wingsByBase = new Map();
    this.wingsByOwner = new Map();
    this.wingList = null;
    for (const d of this.wings.values()) this.indexWing(d);
  }

  private indexWing(d: Wing): void {
    insertSorted(this.wingsBySr, d.sr, d.id);
    insertSorted(this.wingsByBase, d.base, d.id);
    insertSorted(this.wingsByOwner, d.owner, d.id);
  }

  private unindexWing(d: Wing): void {
    removeFrom(this.wingsBySr, d.sr, d.id);
    removeFrom(this.wingsByBase, d.base, d.id);
    removeFrom(this.wingsByOwner, d.owner, d.id);
  }

  /**
   * Per country the planes deployed; per zone the superiority by side and
   * the mission effects' state the land war reads later (CAS pool and
   * shares, air supply, the results); per country the 30-day rings; the
   * losses and bomb points so far. Empty state adds nothing.
   */
  hash(): number {
    let h = 43;
    const n = new Array<number>(this.countryList.length).fill(0);
    for (const d of this.wings.values()) {
      for (const c of d.counts) n[d.owner] += c;
      // P6 (lane E): the design planes by slot (only when some fly, so a
      // game without them keeps its hash).
      for (let s = 0; s < d.dcounts.length; s++) {
        if (d.dcounts[s] !== 0) {
          h = (Math.imul(h, 31) + (s + 1) * 4096 + d.dcounts[s]) >>> 0;
        }
      }
      // Where and what for (P4 review).
      h = (Math.imul(h, 31) + d.id) >>> 0;
      h = (Math.imul(h, 31) + d.sr * 16 + d.mission) >>> 0;
      // P6 lane W2 review: the night flag and the ace (only when set, so a
      // game without them keeps its hash).
      if (d.night || d.ace !== 0) {
        h = (Math.imul(h, 31) + (d.night ? 1 : 0)) >>> 0;
        h = (Math.imul(h, 31) + d.ace) >>> 0;
      }
    }
    for (let id = 1; id < n.length; id++) {
      if (n[id] !== 0) h = (Math.imul(h, 31) + id * 7 + n[id]) >>> 0;
    }
    const mix = (x: number, v: number) => (Math.imul(x, 31) + v) | 0;
    this.zoneState.forEach((z, i) => {
      let sum = 0;
      for (const v of z.sup.values()) sum += v;
      if (sum !== 0) h = (Math.imul(h, 31) + i * 11 + sum) >>> 0;
      // Lane A2 review: the effects' state of the zone.
      let fx = 0;
      for (const [k, v] of z.cas) fx = mix(mix(fx, k), v);
      for (const [r, s, m] of z.casShare) fx = mix(mix(mix(fx, r), s), m);
      for (const [r, s, m] of z.airSupply) fx = mix(mix(mix(fx, r), s), m);
      for (const [k, row] of z.result) {
        fx = mix(fx, k);
        for (const v of row) fx = mix(fx, v);
      }
      if (fx !== 0) h = (Math.imul(h, 31) + i * 17 + fx) >>> 0;
      // A1: the battlefield-support bonus and the alerts' days (state).
      for (const [k, v] of z.enemyPp) {
        h = (Math.imul(h, 31) + i * 13 + k + v) >>> 0;
      }
      for (const [k, v] of z.alertDay) {
        h = (Math.imul(h, 31) + i * 17 + k + v) >>> 0;
      }
    });
    for (const c of this.countries()) {
      let r = 0;
      for (const v of c.bombTaken) r = mix(r, v);
      for (const t of c.tally) for (const v of t) r = mix(r, v);
      if (r !== 0) h = (Math.imul(h, 31) + c.smallID * 19 + r) >>> 0;
    }
    h = (Math.imul(h, 31) + this.planesLostTotal) >>> 0;
    h = (Math.imul(h, 31) + this.bombPointsTotal) >>> 0;
    return this.hashRest(h) >>> 0;
  }

  /**
   * P4 Task 16 (hash coverage, spec §19.5): everything else the snapshot
   * holds — each deployment's type, counts per generation, target, base,
   * loss remainder and flags; each zone's enemy superiority, sorties, naval
   * search, ASW and strike pools, fighters' superiority and its day; each
   * country's experience and auto zones — so a desync shows on the tick it
   * happens. Derived fields (DERIVED_FIELDS) stay out.
   */
  private hashRest(h0: number): number {
    let h = h0 | 0;
    const mix = (v: number) => {
      h = (Math.imul(h, 31) + (v | 0)) | 0;
    };
    const fold = (xs: ArrayLike<number>) => {
      let s = xs.length;
      for (let i = 0; i < xs.length; i++) s = (Math.imul(s, 33) + xs[i]) | 0;
      mix(s);
    };
    const pairs = (m: ReadonlyMap<number, number>) => {
      mix(m.size);
      for (const [k, v] of m) {
        mix(k);
        mix(v);
      }
    };
    for (const d of this.wings.values()) {
      mix(d.owner);
      mix(d.type);
      fold(d.counts);
      mix(d.goalCount);
      mix(d.base);
      mix(d.lossRest);
      mix((d.auto ? 1 : 0) + d.volunteerFor * 2);
      // ww8: the new fields, only off their rest values (an old-model game
      // keeps its hash; the same below for the zones and the countries).
      for (let f = 0; f < WING_NEW_FIELDS.length; f++) {
        const k = WING_NEW_FIELDS[f];
        if (d[k] !== WING_NEW_FIELD_DEFAULTS[k]) {
          mix(f + 1);
          mix(d[k]);
        }
      }
    }
    for (const z of this.zoneState) {
      pairs(z.sup);
      pairs(z.enemySup);
      for (const [k, v] of z.sorties) {
        mix(k);
        fold(v);
      }
      pairs(z.navalSearch);
      pairs(z.navalAsw);
      pairs(z.navalStrike);
      pairs(z.fightersSup);
      mix(z.lastDay);
      if (z.score.size > 0) pairs(z.score);
      for (const [r, s, v] of z.casNow) {
        mix(r);
        mix(s);
        mix(v);
      }
      const t = z.today;
      for (const m of [t.sorties, t.result]) {
        for (const [k, v] of m) {
          mix(k);
          fold(v);
        }
      }
      for (const m of [t.navalSearch, t.navalAsw, t.navalStrike]) {
        if (m.size > 0) pairs(m);
      }
      if (t.fightersSup.size > 0) pairs(t.fightersSup);
      if (t.recon.size > 0) pairs(t.recon);
      if (t.flown.size > 0) pairs(t.flown);
      for (const [r, s, v] of t.airSupply) {
        mix(r);
        mix(s);
        mix(v);
      }
    }
    for (const c of this.countries()) {
      fold(c.autoZones);
      for (const r of c.reports) {
        for (const k of REPORT_FIELDS) mix(r[k]);
        for (const [b, m] of r.stopped) {
          mix(b);
          mix(m);
        }
      }
      if (c.priorityArmies.length > 0) fold(c.priorityArmies);
      for (let i = 0; i < c.nextWingNo.length; i++) {
        if (c.nextWingNo[i] !== 1) mix(i * 2 + c.nextWingNo[i]);
        if (c.reformDay[i] !== 0) mix(i * 3 + c.reformDay[i]);
      }
    }
    mix(this.nextWingId);
    mix(this.lastCommonDay);
    if (this.wingsLive) mix(1);
    if (this.strips.size > 0) pairs(this.strips);
    // w50: only when set.
    for (const g of this.groups.values()) {
      mix(g.id);
      mix(g.owner);
      mix(g.tpl);
      fold(g.zones);
      mix(g.priority);
      mix(g.army);
      mix(g.cls);
      mix(g.target);
      mix((g.auto ? 1 : 0) + (g.night ? 2 : 0));
      mix(g.base);
    }
    if (this.nextGroupId !== 1) mix(this.nextGroupId);
    for (const c of this.countries()) {
      for (const t of c.templates) {
        mix(c.smallID);
        mix(t.id);
        fold(t.planes);
        mix(t.keep);
        for (let i = 0; i < t.name.length; i++) mix(t.name.charCodeAt(i));
      }
      if (c.nextTemplateId !== 1) mix(c.smallID * 5 + c.nextTemplateId);
    }
    return h;
  }
}

/** The wing fields the hash reads off their rest values, in a fixed order. */
const WING_NEW_FIELDS = Object.keys(
  WING_NEW_FIELD_DEFAULTS,
) as (keyof typeof WING_NEW_FIELD_DEFAULTS)[];

const REPORT_FIELDS = [
  "day",
  "attacker",
  "victim",
  "region",
  "cls",
  "raids",
  "planes",
  "lost",
  "points",
  "fuelMilli",
  "shipsHit",
  "groundPlanes",
  "wsBp",
  "repairDays",
] as const;

const NO_IDS: readonly number[] = [];

function insertSorted(m: Map<number, number[]>, key: number, id: number): void {
  let l = m.get(key);
  if (l === undefined) m.set(key, (l = []));
  let i = l.length;
  while (i > 0 && l[i - 1] > id) i--;
  l.splice(i, 0, id);
}

function removeFrom(m: Map<number, number[]>, key: number, id: number): void {
  const l = m.get(key);
  if (l === undefined) return;
  const i = l.indexOf(id);
  if (i >= 0) l.splice(i, 1);
  if (l.length === 0) m.delete(key);
}
