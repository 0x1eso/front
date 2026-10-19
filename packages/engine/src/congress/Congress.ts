import {
  AGENDA_REASONS,
  AgendaItemData,
  AvailableEmergencyData,
  BALLOT_OPTIONS,
  BallotOption,
  BUILDING_PACT_UNITS,
  CongressData,
  EMERGENCY_KINDS,
  EmergencyKind,
  RankEntry,
  RESOLUTION_IDS,
  ResolutionExpiry,
  ResolutionId,
  ResultData,
  SESSION_KINDS,
  SessionKind,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  TECH_IDS,
  TechId,
  VictoryProjectKind,
} from "@openfront/engine-api/domestic/DomesticTypes";
import type { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  CONFLICT_MEMORY_TICKS,
  EMERGENCY_MAX_PER_GAME,
  EMERGENCY_VOTING_TICKS,
  extraVoteCostMilli,
  HISTORY_LENGTH,
  ledgerBucket,
  RANK_LENGTH,
  RANK_MIN_AGGRESSION_PCT,
  RANK_MIN_VICTIM_PCT,
  round1,
  VOTING_TICKS,
  WAR_PAIR_BUCKETS,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  copyRing,
  newRing,
  Ring,
  ringAdd,
  RingSchema,
} from "@openfront/engine-lib/congress/Ring";
import {
  BallotBlock,
  ballotBlock,
  bOnlyFor,
  isSanctionedIn,
  mayVote,
} from "@openfront/engine-lib/congress/Voting";
import { zInt, zNum, zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { simpleHash } from "@openfront/engine-lib/Util";
import { z } from "zod";
import type { Game, Player, Unit } from "../game/Game";
import type {
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { aggressionPct, victimPct } from "./Metrics";

/** An agenda item while its session votes. */
export type AgendaItem = AgendaItemData;
export type AgendaItemInit = Omit<AgendaItemData, "voters">;

export interface Session {
  id: number;
  kind: SessionKind;
  openTick: number;
  closeTick: number;
  items: AgendaItem[];
}

/** One tallied item (Congress.closeSession). Clients only see the totals; the voter lists make emergency members. */
export interface ItemResult {
  sessionId: number;
  kind: SessionKind;
  index: number;
  item: AgendaItem;
  a: number;
  b: number;
  adopted: BallotOption | null;
  /** smallIDs of the A / B voters, in allPlayers() order. */
  aVoters: number[];
  bVoters: number[];
}

/** An adopted resolution or an emergency outcome in force (plan decision 3). */
export interface ActiveResolution {
  resolution: ResolutionId;
  option: BallotOption;
  targets: number[];
  param: string | null;
  sinceTick: number;
  expires: ResolutionExpiry;
  source: "session" | "emergency";
}

/** A war between two players (spec §4.1); low < high are smallIDs. */
export interface PairConflict {
  low: number;
  high: number;
  /** Who took the first tile after 180 s without any between them. */
  initiator: number;
  lastTick: number;
  /** Tiles low took from high / high took from low, per ledger bucket (120 s window). */
  lowTook: Ring;
  highTook: Ring;
}

export interface EmergencyState {
  kind: EmergencyKind;
  target: number;
  startTick: number;
  endTick: number;
  goalKind: "land" | "silos";
  goal: number;
  progress: number;
  /** In joining order. */
  members: number[];
  /** Voted against: never members. */
  opposed: number[];
  /** smallID -> contribution, in first-contribution order. */
  contributions: Map<number, number>;
  /** Nuclear: the target's finished silos when it started. */
  goalSilos: Unit[];
  /** Ids of goal silos already counted. */
  countedSilos: number[];
}

export type AvailableEmergency = AvailableEmergencyData;

export interface WorldGovVerdict {
  host: number;
  ratified: boolean;
}

export function pairKey(a: number, b: number): number {
  return a < b ? a * 65536 + b : b * 65536 + a;
}

const ItemSchema = z.object({
  resolution: z.enum(RESOLUTION_IDS),
  targets: z.array(zInt()),
  param: z.string().nullable(),
  reason: z.enum(AGENDA_REASONS),
  reasonValue: zNum(),
  voters: zInt(),
});

const ExpirySchema = z.union([
  z.literal("next_tally"),
  z.literal("project_end"),
  zInt(),
]);

const RankSchema = z.array(z.object({ id: zInt(), pct: zNum() }));

export const CongressStateSchema = z.object({
  nextSessionTick: zInt().nullable(),
  nextSessionId: zInt(),
  session: z
    .object({
      id: zInt(),
      kind: z.enum(SESSION_KINDS),
      openTick: zInt(),
      closeTick: zInt(),
      items: z.array(ItemSchema),
    })
    .nullable(),
  seats: z.array(zInt()),
  active: z.array(
    z.object({
      resolution: z.enum(RESOLUTION_IDS),
      option: z.enum(BALLOT_OPTIONS),
      targets: z.array(zInt()),
      param: z.string().nullable(),
      sinceTick: zInt(),
      expires: ExpirySchema,
      source: z.enum(["session", "emergency"]),
    }),
  ),
  history: z.array(
    z.object({
      sessionId: zInt(),
      kind: z.enum(SESSION_KINDS),
      tick: zInt(),
      resolution: z.enum(RESOLUTION_IDS),
      targets: z.array(zInt()),
      param: z.string().nullable(),
      a: zInt(),
      b: zInt(),
      adopted: z.enum(BALLOT_OPTIONS).nullable(),
    }),
  ),
  emergency: z
    .object({
      kind: z.enum(EMERGENCY_KINDS),
      target: zInt(),
      startTick: zInt(),
      endTick: zInt(),
      goalKind: z.enum(["land", "silos"]),
      goal: zInt(),
      progress: zInt(),
      members: z.array(zInt()),
      opposed: z.array(zInt()),
      contributions: z.array(z.tuple([zInt(), zInt()])),
      goalSilos: z.array(zRef()),
      countedSilos: z.array(zInt()),
    })
    .nullable(),
  available: z.array(
    z.object({
      kind: z.enum(EMERGENCY_KINDS),
      target: zInt(),
      sinceTick: zInt(),
    }),
  ),
  cooldownUntil: zInt(),
  targetCooldowns: z.array(z.tuple([zInt(), zInt()])),
  emergenciesStarted: zInt(),
  hegemonyUsed: z.array(z.tuple([zInt(), zInt()])),
  eliminations: z.array(z.tuple([zInt(), zInt()])),
  pairs: z.array(
    z.object({
      low: zInt(),
      high: zInt(),
      initiator: zInt(),
      lastTick: zInt(),
      lowTook: RingSchema,
      highTook: RingSchema,
    }),
  ),
  lastSecurity: z.enum(RESOLUTION_IDS).nullable(),
  lastEconomy: z.enum(RESOLUTION_IDS).nullable(),
  lastBuildingKey: z.string().nullable(),
  built: z.array(z.tuple([z.string(), zInt()])),
  verdicts: z.array(z.tuple([zInt(), zInt(), z.boolean()])),
  discountedTechs: z.array(z.enum(TECH_IDS)),
  aggressors: RankSchema,
  victims: RankSchema,
  /** Written only when not empty (Congress.announced). */
  announced: z.array(z.tuple([z.enum(EMERGENCY_KINDS), zInt()])).optional(),
});
export type CongressState = z.infer<typeof CongressStateSchema>;

// Copies in the snapshot schema's key order, whatever order the caller built
// the object in: a restored congress then snapshots and hashes (toData is
// JSON-hashed) exactly like the live one.
function copyItem(i: AgendaItemInit, voters: number): AgendaItem {
  return {
    resolution: i.resolution,
    targets: [...i.targets],
    param: i.param,
    reason: i.reason,
    reasonValue: i.reasonValue,
    voters,
  };
}

function copyActive(r: ActiveResolution): ActiveResolution {
  return {
    resolution: r.resolution,
    option: r.option,
    targets: [...r.targets],
    param: r.param,
    sinceTick: r.sinceTick,
    expires: r.expires,
    source: r.source,
  };
}

function copyAvailable(a: AvailableEmergency): AvailableEmergency {
  return { kind: a.kind, target: a.target, sinceTick: a.sinceTick };
}

/** Shares no lists or maps with `e`, so a caller's later writes can't reach the state behind the data cache. */
function copyEmergency(e: EmergencyState): EmergencyState {
  return {
    kind: e.kind,
    target: e.target,
    startTick: e.startTick,
    endTick: e.endTick,
    goalKind: e.goalKind,
    goal: e.goal,
    progress: e.progress,
    members: [...e.members],
    opposed: [...e.opposed],
    contributions: new Map(e.contributions),
    goalSilos: [...e.goalSilos],
    countedSilos: [...e.countedSilos],
  };
}

/**
 * The world congress of one game (spec §6-§10): the schedule, the open
 * session and its ballot box, the seats, the resolutions in force, the
 * emergency, the war pairs of the aggression ledger, the result history and
 * what the agenda remembers. Rules live in the congress/*.ts modules; this
 * class stores and reports. Only congress games have one (GameImpl).
 */
export class Congress {
  private nextSession: number | null = null;
  private nextSessionId = 1;
  private _session: Session | null = null;
  private _seats: number[] = [];
  private _active: ActiveResolution[] = [];
  private _history: ResultData[] = [];
  private _emergency: EmergencyState | null = null;
  private _available: AvailableEmergency[] = [];
  private cooldownUntil = 0;
  private targetCooldowns = new Map<number, number>();
  private started = 0;
  /** smallID -> hegemony thresholds already used (0..2). */
  private hegemonyUsed = new Map<number, number>();
  /** Conqueror smallID -> last tick it eliminated a human. */
  private eliminations = new Map<number, number>();
  private _pairs = new Map<number, PairConflict>();
  private lastSecurity: ResolutionId | null = null;
  private lastEconomy: ResolutionId | null = null;
  private lastBuildingKey: string | null = null;
  /** building_pact key -> constructions started since the last regular session. */
  private built = new Map<string, number>();
  /** Owner smallID -> the latest world-government decision on its proclamation. */
  private verdicts = new Map<number, WorldGovVerdict>();
  private _discountedTechs: TechId[] = [];
  private aggressors: RankEntry[] = [];
  private victims: RankEntry[] = [];
  /**
   * (kind, target) pairs everyone already heard can be convened: an index
   * hovering at a threshold doesn't announce the same one again until that
   * target's cooldown starts or the next emergency is convened.
   */
  private announced: [EmergencyKind, number][] = [];
  /** toData() result until the next change. */
  private congressDataCache: CongressData | null = null;
  /** The CongressData last handed to clients (none in a fresh or restored game: its first tick sends one). */
  private lastSentCongressData: CongressData | null = null;

  constructor(private mg: Game) {}

  // --- schedule and sessions (spec §6) ---

  nextSessionTick(): number | null {
    return this.nextSession;
  }

  scheduleNextSession(tick: number): void {
    this.nextSession = tick;
    this.changed();
  }

  session(): Session | null {
    return this._session;
  }

  /** Opens a voting session now (spec §6.1, §9.3). Only one session is open at a time. */
  openSession(
    kind: SessionKind,
    items: readonly AgendaItemInit[],
    now: number,
  ): Session {
    if (this._session !== null) {
      throw new Error("a congress session is already open");
    }
    const s: Session = {
      id: this.nextSessionId++,
      kind,
      openTick: now,
      closeTick:
        now + (kind === "regular" ? VOTING_TICKS : EMERGENCY_VOTING_TICKS),
      items: items.map((i) => copyItem(i, 0)),
    };
    this._session = s;
    this.changed();
    return s;
  }

  /** A seat, or one of the item's targets (spec §6.2). */
  canVote(player: Player, item: AgendaItem): boolean {
    return mayVote(item, player.smallID(), this._seats);
  }

  /** Emergency votes: the target and its friends may only oppose (spec §9.3). */
  bOnly(player: Player, item: AgendaItem): boolean {
    return bOnlyFor(item, player.smallID(), (id) => {
      const target = this.mg.playerBySmallID(id);
      return target.isPlayer() && player.isFriendly(target, true);
    });
  }

  /**
   * A ballot, or a raise of its extra votes (spec §6.3). Spends the
   * difference in escrow and returns null; refuses (spending nothing) with
   * the reason otherwise.
   */
  castBallot(
    player: Player,
    sessionId: number,
    index: number,
    option: BallotOption,
    extra: number,
  ): BallotBlock | null {
    const s = this._session;
    const pc = player.congress();
    const item = s?.items[index];
    const existing = pc?.ballot(sessionId, index) ?? null;
    const block = ballotBlock({
      open:
        s !== null &&
        s.id === sessionId &&
        this.mg.ticks() < s.closeTick &&
        pc !== null &&
        player.isAlive(),
      itemExists: item !== undefined,
      eligible: item !== undefined && this.canVote(player, item),
      bOnly: item !== undefined && this.bOnly(player, item),
      existing,
      option,
      extra,
      influenceMilli: pc?.influenceMilli() ?? 0,
    });
    if (block !== null || pc === null || item === undefined) return block;
    const cost = extraVoteCostMilli(existing?.extra ?? 0, extra);
    pc.spend(cost);
    pc.setBallot({
      sessionId,
      item: index,
      option,
      extra,
      costMilli: (existing?.costMilli ?? 0) + cost,
    });
    if (existing === null) item.voters++;
    this.changed();
    return null;
  }

  /**
   * Tallies the open session (spec §6.4): the larger side wins, a tie adopts
   * nothing; the losing side and ties get their influence back. Records the
   * results in the history and clears the ballots.
   */
  closeSession(): ItemResult[] {
    const s = this._session;
    if (s === null) return [];
    const now = this.mg.ticks();
    const results: ItemResult[] = s.items.map((item, index) => ({
      sessionId: s.id,
      kind: s.kind,
      index,
      item,
      a: 0,
      b: 0,
      adopted: null,
      aVoters: [],
      bVoters: [],
    }));
    const players = this.mg.allPlayers();
    for (const p of players) {
      for (const b of p.congress()?.ballotsFor(s.id) ?? []) {
        const r = results[b.item];
        if (r === undefined) continue;
        if (b.option === "A") {
          r.a += 1 + b.extra;
          r.aVoters.push(p.smallID());
        } else {
          r.b += 1 + b.extra;
          r.bVoters.push(p.smallID());
        }
      }
    }
    for (const r of results) {
      r.adopted = r.a > r.b ? "A" : r.b > r.a ? "B" : null;
    }
    for (const p of players) {
      const pc = p.congress();
      if (pc === null) continue;
      for (const b of pc.ballotsFor(s.id)) {
        if (results[b.item]?.adopted !== b.option) pc.grant(b.costMilli);
      }
      pc.clearBallots(s.id);
    }
    for (const r of results) {
      this._history.push({
        sessionId: s.id,
        kind: s.kind,
        tick: now,
        resolution: r.item.resolution,
        targets: [...r.item.targets],
        param: r.item.param,
        a: r.a,
        b: r.b,
        adopted: r.adopted,
      });
    }
    if (this._history.length > HISTORY_LENGTH) {
      this._history = this._history.slice(-HISTORY_LENGTH);
    }
    this._session = null;
    this.changed();
    return results;
  }

  history(): readonly ResultData[] {
    return this._history;
  }

  // --- seats (spec §6.2) ---

  seats(): readonly number[] {
    return this._seats;
  }

  setSeats(ids: readonly number[]): void {
    this._seats = [...ids].sort((a, b) => a - b);
    this.changed();
  }

  isSeated(smallID: number): boolean {
    return this._seats.includes(smallID);
  }

  // --- resolutions in force (spec §8) ---

  active(): readonly ActiveResolution[] {
    return this._active;
  }

  addResolution(r: ActiveResolution): void {
    this._active.push(copyActive(r));
    this.changed();
  }

  /** At a regular tally: what lasted until the next result ends (spec §8). */
  dropTallyResolutions(): void {
    const keep = this._active.filter((r) => r.expires !== "next_tally");
    if (keep.length === this._active.length) return;
    this._active = keep;
    this.changed();
  }

  /**
   * Once a second: timed resolutions past their tick, and world heritage
   * (A until the project ends, B until the next result or the project's end,
   * spec §10.2) whose project is over. Also forgets world-government
   * verdicts whose owner no longer runs a political project in that office
   * (spec §10.1: a ratification belongs to that one project).
   */
  expireResolutions(now: number): void {
    const keep = this._active.filter((r) => {
      if (typeof r.expires === "number") return r.expires > now;
      if (r.expires === "project_end" || r.resolution === "world_heritage") {
        return this.projectRunning(r.targets[0], Number(r.param));
      }
      return true;
    });
    let changed = false;
    if (keep.length !== this._active.length) {
      this._active = keep;
      changed = true;
    }
    for (const [owner, v] of this.verdicts) {
      if (!this.projectRunning(owner, v.host, "political")) {
        this.verdicts.delete(owner);
        changed = true;
      }
    }
    if (changed) this.changed();
  }

  /** `owner` is alive and its victory project (of `kind`, if given) runs, or waits complete, in unit `host`. */
  private projectRunning(
    owner: number,
    host: number,
    kind?: VictoryProjectKind,
  ): boolean {
    const p = this.mg.playerBySmallID(owner);
    if (!p.isPlayer() || !p.isAlive()) return false;
    const project = p.domestic()?.victoryProject() ?? null;
    return (
      project !== null &&
      project.hostUnitId === host &&
      (kind === undefined || project.kind === kind)
    );
  }

  /** S1 A, from a session or an aggression emergency. */
  isSanctioned(smallID: number): boolean {
    return isSanctionedIn(this._active, smallID);
  }

  // --- the emergency (spec §9; the rules are in Emergencies.ts) ---

  emergency(): EmergencyState | null {
    return this._emergency;
  }

  /** Stores a copy: later writes go through updateEmergency. */
  setEmergency(e: EmergencyState | null): void {
    this._emergency = e === null ? null : copyEmergency(e);
    this.changed();
  }

  /** Mutates the running emergency in place (does nothing without one). */
  updateEmergency(fn: (e: EmergencyState) => void): void {
    if (this._emergency === null) return;
    fn(this._emergency);
    this.changed();
  }

  isEmergencyTarget(smallID: number): boolean {
    return this._emergency?.target === smallID;
  }

  isEmergencyMember(smallID: number): boolean {
    return this._emergency?.members.includes(smallID) ?? false;
  }

  /** The member with the highest contribution above 0 (ties: lower smallID). */
  emergencyHero(): number | null {
    const e = this._emergency;
    if (e === null) return null;
    let hero: number | null = null;
    let best = 0;
    for (const [id, n] of e.contributions) {
      if (n > best || (n === best && n > 0 && hero !== null && id < hero)) {
        hero = id;
        best = n;
      }
    }
    return hero;
  }

  available(): readonly AvailableEmergency[] {
    return this._available;
  }

  setAvailable(list: readonly AvailableEmergency[]): void {
    const next = list.map(copyAvailable);
    if (JSON.stringify(next) === JSON.stringify(this._available)) return;
    this._available = next;
    this.changed();
  }

  globalCooldownUntil(): number {
    return this.cooldownUntil;
  }

  setGlobalCooldown(tick: number): void {
    this.cooldownUntil = tick;
    this.changed();
  }

  targetCooldownUntil(smallID: number): number {
    return this.targetCooldowns.get(smallID) ?? 0;
  }

  setTargetCooldown(smallID: number, tick: number): void {
    this.targetCooldowns.set(smallID, tick);
    this.announced = this.announced.filter(([, t]) => t !== smallID);
  }

  /** Whether everyone already heard that `kind` against `target` can be convened. */
  wasAnnounced(kind: EmergencyKind, target: number): boolean {
    return this.announced.some(([k, t]) => k === kind && t === target);
  }

  noteAnnounced(kind: EmergencyKind, target: number): void {
    if (!this.wasAnnounced(kind, target)) this.announced.push([kind, target]);
  }

  /** An emergency was convened: whatever is listed after it is news again. */
  forgetAnnounced(): void {
    this.announced = [];
  }

  emergenciesStarted(): number {
    return this.started;
  }

  countEmergencyStarted(): void {
    this.started++;
    this.changed();
  }

  hegemonyLevelUsed(smallID: number): number {
    return this.hegemonyUsed.get(smallID) ?? 0;
  }

  useHegemonyLevel(smallID: number, level: number): void {
    this.hegemonyUsed.set(smallID, level);
  }

  lastElimination(smallID: number): number | null {
    return this.eliminations.get(smallID) ?? null;
  }

  noteElimination(smallID: number, tick: number): void {
    this.eliminations.set(smallID, tick);
  }

  // --- war pairs (spec §4.1; Ledger.ts writes them) ---

  pair(a: number, b: number): PairConflict | undefined {
    return this._pairs.get(pairKey(a, b));
  }

  pairs(): PairConflict[] {
    return [...this._pairs.values()];
  }

  /**
   * Records one tile `taker` took from `loser` now and returns the pair's
   * conflict. A pair quiet for longer than CONFLICT_MEMORY_TICKS starts a
   * new conflict with `taker` as the initiator.
   */
  touchPair(taker: number, loser: number, now: number): PairConflict {
    const key = pairKey(taker, loser);
    let p = this._pairs.get(key);
    if (p === undefined || now - p.lastTick > CONFLICT_MEMORY_TICKS) {
      this._pairs.delete(key);
      p = {
        low: Math.min(taker, loser),
        high: Math.max(taker, loser),
        initiator: taker,
        lastTick: now,
        lowTook: newRing(WAR_PAIR_BUCKETS),
        highTook: newRing(WAR_PAIR_BUCKETS),
      };
      this._pairs.set(key, p);
    }
    p.lastTick = now;
    ringAdd(taker === p.low ? p.lowTook : p.highTook, ledgerBucket(now), 1);
    return p;
  }

  prunePairs(now: number): void {
    for (const [key, p] of this._pairs) {
      if (now - p.lastTick > CONFLICT_MEMORY_TICKS) this._pairs.delete(key);
    }
  }

  // --- agenda memory (Sessions.ts) ---

  lastSecurityKind(): ResolutionId | null {
    return this.lastSecurity;
  }

  lastEconomyKind(): ResolutionId | null {
    return this.lastEconomy;
  }

  lastBuildingTarget(): string | null {
    return this.lastBuildingKey;
  }

  rememberAgenda(
    security: ResolutionId | null,
    economy: ResolutionId | null,
    buildingKey: string | null,
  ): void {
    this.lastSecurity = security;
    this.lastEconomy = economy;
    this.lastBuildingKey = buildingKey;
  }

  /** Called when any player starts building `type` (PlayerImpl.buildUnit; upgrades don't count, spec §7.2). */
  noteBuilt(type: UnitType): void {
    const key = BUILDING_PACT_UNITS.find((u) => u.type === type)?.key;
    if (key === undefined) return;
    this.built.set(key, (this.built.get(key) ?? 0) + 1);
  }

  /** The counts since the last regular session; starts the next count. */
  takeBuiltCounts(): Map<string, number> {
    const counts = this.built;
    this.built = new Map();
    return counts;
  }

  // --- world government (WorldGovernment.ts) ---

  verdict(owner: number): WorldGovVerdict | undefined {
    return this.verdicts.get(owner);
  }

  setVerdict(owner: number, v: WorldGovVerdict): void {
    this.verdicts.set(owner, { ...v });
    this.changed();
  }

  // --- tech pact (Effects.ts) ---

  discountedTechs(): readonly TechId[] {
    return this._discountedTechs;
  }

  setDiscountedTechs(list: readonly TechId[]): void {
    if (
      list.length === this._discountedTechs.length &&
      list.every((t, i) => t === this._discountedTechs[i])
    ) {
      return;
    }
    this._discountedTechs = [...list];
    this.changed();
  }

  // --- the rankings of the congress screen (spec §4.2) ---

  refreshRanking(now: number): void {
    const aggressors: RankEntry[] = [];
    const victims: RankEntry[] = [];
    for (const p of this.mg.players()) {
      if (p.congress() === null) continue;
      const a = aggressionPct(this.mg, p, now);
      if (a >= RANK_MIN_AGGRESSION_PCT) {
        aggressors.push({ id: p.smallID(), pct: round1(a) });
      }
      const v = victimPct(this.mg, p, now);
      if (v >= RANK_MIN_VICTIM_PCT) {
        victims.push({ id: p.smallID(), pct: round1(v) });
      }
    }
    const order = (x: RankEntry, y: RankEntry) => y.pct - x.pct || x.id - y.id;
    const a = aggressors.sort(order).slice(0, RANK_LENGTH);
    const v = victims.sort(order).slice(0, RANK_LENGTH);
    if (
      JSON.stringify(a) === JSON.stringify(this.aggressors) &&
      JSON.stringify(v) === JSON.stringify(this.victims)
    ) {
      return;
    }
    this.aggressors = a;
    this.victims = v;
    this.changed();
  }

  // --- data, snapshot, hash ---

  toData(): CongressData {
    const e = this._emergency;
    this.congressDataCache ??= {
      nextSessionTick: this.nextSession ?? 0,
      session:
        this._session === null
          ? null
          : {
              id: this._session.id,
              kind: this._session.kind,
              openTick: this._session.openTick,
              closeTick: this._session.closeTick,
              items: this._session.items.map((i) => copyItem(i, i.voters)),
            },
      seats: [...this._seats],
      active: this._active.map((r) => ({
        resolution: r.resolution,
        option: r.option,
        targets: [...r.targets],
        param: r.param,
        sinceTick: r.sinceTick,
        expires: r.expires,
      })),
      emergency:
        e === null
          ? null
          : {
              kind: e.kind,
              target: e.target,
              startTick: e.startTick,
              endTick: e.endTick,
              goalKind: e.goalKind,
              goal: e.goal,
              progress: e.progress,
              // Secret ballot (spec §6.5): a member shows once it has
              // contributed, so a yes vote alone stays hidden. Its own UI
              // reads PlayerCongressData.emergencyMember.
              members: e.members.filter(
                (id) => (e.contributions.get(id) ?? 0) > 0,
              ),
              hero: this.emergencyHero(),
            },
      available: this._available.map(copyAvailable),
      cooldownUntilTick: this.cooldownUntil,
      emergenciesLeft: Math.max(0, EMERGENCY_MAX_PER_GAME - this.started),
      history: this._history.map((h) => ({ ...h, targets: [...h.targets] })),
      discountedTechs: [...this._discountedTechs],
      aggressors: this.aggressors.map((r) => ({ ...r })),
      victims: this.victims.map((r) => ({ ...r })),
      verdicts: [...this.verdicts].map(([owner, v]) => ({
        owner,
        host: v.host,
        ratified: v.ratified,
      })),
    };
    return this.congressDataCache;
  }

  /** The data to send this tick, or null when clients already have it. */
  takeUnsentData(): CongressData | null {
    const d = this.toData();
    if (d === this.lastSentCongressData) return null;
    this.lastSentCongressData = d;
    return d;
  }

  hash(): number {
    // toData leaves out the members that haven't contributed (secret
    // ballot) and the announced pairs; the desync hash still covers them.
    return simpleHash(
      JSON.stringify([
        this.toData(),
        this._emergency?.members ?? null,
        this.announced,
      ]),
    );
  }

  snapshot(w: SnapshotWriter): CongressState {
    const e = this._emergency;
    return {
      nextSessionTick: this.nextSession,
      nextSessionId: this.nextSessionId,
      session:
        this._session === null
          ? null
          : {
              ...this._session,
              items: this._session.items.map((i) => copyItem(i, i.voters)),
            },
      seats: [...this._seats],
      active: this._active.map(copyActive),
      history: this._history.map((h) => ({ ...h, targets: [...h.targets] })),
      emergency:
        e === null
          ? null
          : {
              kind: e.kind,
              target: e.target,
              startTick: e.startTick,
              endTick: e.endTick,
              goalKind: e.goalKind,
              goal: e.goal,
              progress: e.progress,
              members: [...e.members],
              opposed: [...e.opposed],
              contributions: [...e.contributions],
              goalSilos: e.goalSilos.map((u) => w.unit(u)),
              countedSilos: [...e.countedSilos],
            },
      available: this._available.map(copyAvailable),
      cooldownUntil: this.cooldownUntil,
      targetCooldowns: [...this.targetCooldowns],
      emergenciesStarted: this.started,
      hegemonyUsed: [...this.hegemonyUsed],
      eliminations: [...this.eliminations],
      pairs: [...this._pairs.values()].map((p) => ({
        ...p,
        lowTook: copyRing(p.lowTook),
        highTook: copyRing(p.highTook),
      })),
      lastSecurity: this.lastSecurity,
      lastEconomy: this.lastEconomy,
      lastBuildingKey: this.lastBuildingKey,
      built: [...this.built],
      verdicts: [...this.verdicts].map(
        ([owner, v]) =>
          [owner, v.host, v.ratified] as [number, number, boolean],
      ),
      discountedTechs: [...this._discountedTechs],
      aggressors: this.aggressors.map((r) => ({ ...r })),
      victims: this.victims.map((r) => ({ ...r })),
      ...(this.announced.length === 0
        ? {}
        : {
            announced: this.announced.map(
              ([k, t]) => [k, t] as [EmergencyKind, number],
            ),
          }),
    };
  }

  /** Fills this congress from a snapshot; `mg` already is the restored game. Assigns only. */
  restoreState(s: CongressState, r: SnapshotReader): void {
    this.nextSession = s.nextSessionTick;
    this.nextSessionId = s.nextSessionId;
    this._session =
      s.session === null
        ? null
        : {
            ...s.session,
            items: s.session.items.map((i) => copyItem(i, i.voters)),
          };
    this._seats = [...s.seats];
    this._active = s.active.map(copyActive);
    this._history = s.history.map((h) => ({ ...h, targets: [...h.targets] }));
    this._emergency =
      s.emergency === null
        ? null
        : {
            ...s.emergency,
            members: [...s.emergency.members],
            opposed: [...s.emergency.opposed],
            contributions: new Map(s.emergency.contributions),
            goalSilos: s.emergency.goalSilos.map((i) => r.unit(i)),
            countedSilos: [...s.emergency.countedSilos],
          };
    this._available = s.available.map(copyAvailable);
    this.cooldownUntil = s.cooldownUntil;
    this.targetCooldowns = new Map(s.targetCooldowns);
    this.started = s.emergenciesStarted;
    this.hegemonyUsed = new Map(s.hegemonyUsed);
    this.eliminations = new Map(s.eliminations);
    this._pairs = new Map(
      s.pairs.map((p) => [
        pairKey(p.low, p.high),
        {
          ...p,
          lowTook: copyRing(p.lowTook),
          highTook: copyRing(p.highTook),
        },
      ]),
    );
    this.lastSecurity = s.lastSecurity;
    this.lastEconomy = s.lastEconomy;
    this.lastBuildingKey = s.lastBuildingKey;
    this.built = new Map(s.built);
    this.verdicts = new Map(
      s.verdicts.map(([owner, host, ratified]) => [owner, { host, ratified }]),
    );
    this._discountedTechs = [...s.discountedTechs];
    this.aggressors = s.aggressors.map((x) => ({ ...x }));
    this.victims = s.victims.map((x) => ({ ...x }));
    this.announced = (s.announced ?? []).map(
      ([k, t]) => [k, t] as [EmergencyKind, number],
    );
    this.congressDataCache = null;
    this.lastSentCongressData = null;
  }

  private changed(): void {
    this.congressDataCache = null;
  }
}
