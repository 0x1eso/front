import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  factionIdxOfKey,
  FactionKey,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  WorldWarData,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { zInt, zTiles } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayIndex } from "@openfront/engine-lib/ww1936/Calendar";
import { WW_INITIAL_WARS } from "@openfront/engine-lib/ww1936/History";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { z } from "zod";
import type { Game, Player } from "../game/Game";
import { WwAir, WwAirStateSchema } from "./air/WwAir";
import { WwEconomy, WwEconomyStateSchema } from "./economy/WwEconomy";
import { WwLand, WwLandStateSchema } from "./land/WwLand";
import { NavyAirHooks } from "./navy/NavyAirHooks";
import { WwNavy, WwNavyStateSchema } from "./navy/WwNavy";
import { politicsContent } from "./politics/ContentSource";
import { WwPolitics, WwPoliticsStateSchema } from "./politics/WwPolitics";

export const WorldWarStateSchema = z.object({
  prepEndTick: zInt(),
  lastDay: zInt(),
  wars: z.array(z.tuple([zInt(), zInt(), zInt()])),
  capitulated: z.array(z.tuple([zInt(), zInt(), zInt()])),
  startVp: z.array(zInt()),
  historyRolled: z.boolean(),
  history: z.array(z.tuple([zInt(), z.boolean()])),
  transfers: z.array(
    z.object({ from: zInt(), to: zInt(), tiles: zTiles(), next: zInt() }),
  ),
  /** [smallID, days] of every gauge above 0; written only when not empty. */
  gauges: z.array(z.tuple([zInt(), zInt()])).optional(),
  /** P1 (spec §14.3): always written; a snapshot without it is refused. */
  economy: WwEconomyStateSchema.optional(),
  /** P2 (P2 spec §16.5): always written; a snapshot without it is refused. */
  land: WwLandStateSchema.optional(),
  /** P3 (P3 spec §22.5): always written; a snapshot without it is refused. */
  politics: WwPoliticsStateSchema.optional(),
  /** P4 (P4 spec §19.5): always written; a snapshot without them is refused. */
  navy: WwNavyStateSchema.optional(),
  air: WwAirStateSchema.optional(),
});
export type WorldWarState = z.infer<typeof WorldWarStateSchema>;

/** A capitulated country's remaining tiles moving to its victor (spec §7.5). */
export interface Transfer {
  from: number;
  to: number;
  tiles: Uint32Array;
  next: number;
}

/**
 * World War 1936 game state (spec §7): who is at war with whom, who has
 * capitulated and pending land transfers. The factions are P3 politics'
 * state (P3 plan decision 8); the history calendar moved to politics' beats
 * (P3 plan decision 15: `history` stays in the snapshot schema, empty).
 */
export class WorldWar {
  private readonly size: number;
  private warMatrix: Uint8Array;
  private _wars: [number, number, number][] = [];
  private _capitulated: [number, number, number][] = [];
  private _startVp: number[] = [];
  /**
   * P0's rolled calendar, kept for the snapshot schema only (P3 plan
   * decision 15: politics' history beats replace it): always rolled, empty.
   */
  private _historyRolled = true;
  private _history: [number, boolean][] = [];
  private _transfers: Transfer[] = [];
  /** By smallID: the capitulation gauge, 0..WW_CAPITULATION_DAYS - 1. */
  private _gauge: number[];
  private _prepEndTick = WW_PREP_TICKS;
  private _lastDay = -1;
  /** Not state (DERIVED_FIELDS): whether the screens need an update. */
  private dataDirty = true;
  /**
   * Derived (DERIVED_FIELDS): bumped on every change of the wars, so
   * caches of who may pass a strait or canal know to start over (pre-flight T5).
   */
  warVer = 0;
  /** P1 industry and research (P1 spec §14.1, plan decision 1). */
  readonly economy: WwEconomy;
  /** P3 politics (P3 spec §22.1, plan decision 1): before the land war, which reads factions. */
  readonly politics: WwPolitics;
  /** P2 land war (P2 spec §16.1, plan decision 1). */
  readonly land: WwLand;
  /** P4 navy (P4 spec §19.1, plan decision 2): after the land war. */
  readonly navy: WwNavy;
  /** P4 air war (P4 spec §19.1, plan decision 2): after the navy. */
  readonly air: WwAir;

  constructor(
    private readonly mg: Game,
    readonly scenario: ScenarioIndex,
  ) {
    this.size = scenario.countries.length + 1;
    this.warMatrix = new Uint8Array(this.size * this.size);
    this._gauge = new Array<number>(this.size).fill(0);
    this.economy = new WwEconomy(mg, this, scenario);
    this.politics = new WwPolitics(mg, this, politicsContent());
    this.land = new WwLand(mg, this, this.economy);
    this.navy = new WwNavy(mg, this);
    this.air = new WwAir(mg, this);
    // Plan decision 36: the land war reads the navy, the air war and fuel.
    this.land.hooks = new NavyAirHooks(this.navy, this.air);
  }

  /**
   * Spec §5.3, §7.1: capitals, starting victory points, the wars of
   * 1 January 1936, then the economy's start (P1 spec §6.6, §11) and the
   * land war's (P2 spec §6.4: the 1936 armies), after politics' (P3 spec
   * §6.5). GameImpl calls it once, after the territory.
   */
  start(): void {
    for (const p of this.mg.allPlayers()) {
      const tag = this.tagOf(p.smallID());
      if (p.name() !== COUNTRIES[tag].name) {
        throw new Error(
          `player ${p.smallID()} is ${p.name()}, expected ${tag}`,
        );
      }
      const capital = this.scenario.capitalTile(tag);
      p.setSpawnTile(capital);
      this.mg.stats().recordSpawnTile(p, capital);
    }
    this._startVp = this.scenario.startVpBySmallId();
    for (const [x, y] of WW_INITIAL_WARS) {
      const a = this.scenario.smallIdOf(x);
      const b = this.scenario.smallIdOf(y);
      if (a !== 0 && b !== 0) this.setWar(a, b, 0);
    }
    // Controller ruling I3: politics first (HOI4: laws, spirits and the
    // government apply from day 0), so the economy's start (manpower) and
    // the land war's (the 1936 divisions) read the country's stats.
    this.politics.start();
    this.economy.start();
    this.land.start();
    // P4 (plan decision 2): the 1936 navies, then the air war (nothing deployed).
    this.navy.start();
    this.air.start();
  }

  // ---- Queries ----

  prepEndTick(): number {
    return this._prepEndTick;
  }

  inPrep(tick: number): boolean {
    return tick < this._prepEndTick;
  }

  day(tick: number): number {
    return dayIndex(tick, this._prepEndTick);
  }

  tagOf(smallID: number): CountryTag {
    const tag = this.scenario.tagOfSmallId(smallID);
    if (tag === undefined)
      throw new Error(`no country with smallID ${smallID}`);
    return tag;
  }

  /**
   * The player of a country, or null when the country is not in this
   * scenario. Dead and capitulated countries still have their player:
   * callers that need a living one check isAlive() / isCapitulated().
   */
  playerOfTag(tag: CountryTag): Player | null {
    const id = this.scenario.smallIdOf(tag);
    if (id === 0) return null;
    const p = this.mg.playerBySmallID(id);
    return p.isPlayer() ? p : null;
  }

  /** P3 plan decision 8: the faction is politics' state. */
  factionOf(smallID: number): FactionKey | null {
    return this.politics.factionOf(smallID);
  }

  /** Members of a faction by key, ascending smallID. */
  factionMembers(faction: FactionKey): number[] {
    return this.politics.factionMembers(factionIdxOfKey(faction));
  }

  sameFaction(a: number, b: number): boolean {
    return this.politics.sameFaction(a, b);
  }

  isAtWar(a: number, b: number): boolean {
    if (a <= 0 || b <= 0 || a >= this.size || b >= this.size) return false;
    return this.warMatrix[a * this.size + b] === 1;
  }

  /** Spec §7.2: at war, and the preparation minute is over. */
  canFight(a: number, b: number, tick: number): boolean {
    return !this.inPrep(tick) && this.isAtWar(a, b);
  }

  /** Whether the country is at war with anyone. */
  hasWar(smallID: number): boolean {
    if (smallID <= 0 || smallID >= this.size) return false;
    const row = smallID * this.size;
    for (let b = 1; b < this.size; b++) {
      if (this.warMatrix[row + b] === 1) return true;
    }
    return false;
  }

  /** The start tick of the oldest war `smallID` is in now, or null at peace. */
  earliestWarTick(smallID: number): number | null {
    let best: number | null = null;
    for (const [a, b, since] of this._wars) {
      if ((a === smallID || b === smallID) && (best === null || since < best)) {
        best = since;
      }
    }
    return best;
  }

  enemiesOf(smallID: number): number[] {
    const out: number[] = [];
    for (let b = 1; b < this.size; b++) {
      if (this.isAtWar(smallID, b)) out.push(b);
    }
    return out;
  }

  isCapitulated(smallID: number): boolean {
    return this._capitulated.some(([s]) => s === smallID);
  }

  startVp(smallID: number): number {
    return this._startVp[smallID] ?? 0;
  }

  /** Spec §7.5: the country's capitulation gauge, 0..WW_CAPITULATION_DAYS - 1. */
  capitulationGauge(smallID: number): number {
    return this._gauge[smallID] ?? 0;
  }

  /** Human clientIDs of a camp (a faction), for the team winner (decision 11). */
  humanClientIDsOf(faction: FactionKey): string[] {
    const out: string[] = [];
    for (const id of this.factionMembers(faction)) {
      const p = this.mg.playerBySmallID(id);
      if (p.isPlayer() && p.clientID() !== null) out.push(p.clientID()!);
    }
    return out;
  }

  // ---- Changes (the lanes' functions call these) ----

  /** Starts a war; false when it already runs or a == b. */
  setWar(a: number, b: number, tick: number): boolean {
    if (a === b || this.isAtWar(a, b)) return false;
    if (a <= 0 || b <= 0 || a >= this.size || b >= this.size) return false;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    this._wars.push([lo, hi, tick]);
    this.warMatrix[lo * this.size + hi] = 1;
    this.warMatrix[hi * this.size + lo] = 1;
    this.dataDirty = true;
    this.warVer++;
    return true;
  }

  /** Ends one war (P3 end_war, controller ruling R13); false when there was none. */
  endWar(a: number, b: number): boolean {
    if (!this.isAtWar(a, b)) return false;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    this._wars = this._wars.filter(([x, y]) => !(x === lo && y === hi));
    this.rebuildMatrix();
    this.dataDirty = true;
    return true;
  }

  /** Ends every war of a country (on capitulation). */
  endWarsOf(smallID: number): void {
    const kept = this._wars.filter(([a, b]) => a !== smallID && b !== smallID);
    if (kept.length === this._wars.length) return;
    this._wars = kept;
    this.rebuildMatrix();
    this.dataDirty = true;
  }

  addCapitulation(smallID: number, victor: number, tick: number): void {
    if (this.isCapitulated(smallID)) return;
    this._capitulated.push([smallID, victor, tick]);
    this.dataDirty = true;
  }

  /** Sets the capitulation gauge (checkCapitulations keeps it in range). */
  setCapitulationGauge(smallID: number, days: number): void {
    if (smallID <= 0 || smallID >= this.size) return;
    if (this._gauge[smallID] === days) return;
    this._gauge[smallID] = days;
    this.dataDirty = true;
  }

  queueTransfer(from: number, to: number, tiles: Uint32Array): void {
    this._transfers.push({ from, to, tiles, next: 0 });
  }

  transfers(): Transfer[] {
    return this._transfers;
  }

  historyRolled(): boolean {
    return this._historyRolled;
  }

  /** Per HISTORY entry: [fire day, or -1 when skipped; fired yet]. */
  history(): readonly (readonly [number, boolean])[] {
    return this._history;
  }

  setHistory(plan: [number, boolean][]): void {
    this._history = plan;
    this._historyRolled = true;
  }

  markHistoryDone(index: number): void {
    const entry = this._history[index];
    if (entry !== undefined) this._history[index] = [entry[0], true];
  }

  lastDay(): number {
    return this._lastDay;
  }

  setLastDay(day: number): void {
    this._lastDay = day;
  }

  // ---- Screens, snapshots, hash ----

  data(): WorldWarData {
    return {
      prepEndTick: this._prepEndTick,
      wars: this._wars.map(([a, b, sinceTick]) => ({ a, b, sinceTick })),
      capitulated: this._capitulated.map(([smallID, victor, tick]) => ({
        smallID,
        victor,
        tick,
      })),
      gauges: this.gauges().map(([smallID, days]) => ({ smallID, days })),
    };
  }

  /** [smallID, days] of every gauge above 0, by smallID. */
  private gauges(): [number, number][] {
    const out: [number, number][] = [];
    for (let id = 1; id < this.size; id++) {
      if (this._gauge[id] !== 0) out.push([id, this._gauge[id]]);
    }
    return out;
  }

  /** The data when it changed since the last call, else null. */
  takeData(): WorldWarData | null {
    if (!this.dataDirty) return null;
    this.dataDirty = false;
    return this.data();
  }

  hash(): number {
    let h = 17;
    for (const [a, b] of this._wars) h = (Math.imul(h, 31) + a * 97 + b) | 0;
    for (const [s, v] of this._capitulated) {
      h = (Math.imul(h, 31) + s * 131 + v + 7) | 0;
    }
    // Nothing while every gauge is empty.
    for (const [id, days] of this.gauges()) {
      h = (Math.imul(h, 31) + id * 257 + days + 3) | 0;
    }
    h = (Math.imul(h, 31) + this.economy.hash()) | 0;
    h = (Math.imul(h, 31) + this.land.hash()) | 0;
    h = (Math.imul(h, 31) + this.politics.hash()) | 0;
    // P4 (spec §19.5): after P3's.
    h = (Math.imul(h, 31) + this.navy.hash()) | 0;
    return (Math.imul(h, 31) + this.air.hash()) >>> 0;
  }

  snapshot(): WorldWarState {
    const gauges = this.gauges();
    return {
      prepEndTick: this._prepEndTick,
      lastDay: this._lastDay,
      wars: this._wars.map((w) => [w[0], w[1], w[2]]),
      capitulated: this._capitulated.map((c) => [c[0], c[1], c[2]]),
      startVp: [...this._startVp],
      historyRolled: this._historyRolled,
      history: this._history.map((h) => [h[0], h[1]]),
      transfers: this._transfers.map((t) => ({
        from: t.from,
        to: t.to,
        tiles: t.tiles.slice(),
        next: t.next,
      })),
      ...(gauges.length === 0 ? {} : { gauges }),
      economy: this.economy.snapshot(),
      land: this.land.snapshot(),
      politics: this.politics.snapshot(),
      navy: this.navy.snapshot(),
      air: this.air.snapshot(),
    };
  }

  restoreState(s: WorldWarState): void {
    this._prepEndTick = s.prepEndTick;
    this._lastDay = s.lastDay;
    this._wars = s.wars.map((w) => [w[0], w[1], w[2]]);
    this._capitulated = s.capitulated.map((c) => [c[0], c[1], c[2]]);
    this._startVp = [...s.startVp];
    this._historyRolled = s.historyRolled;
    this._history = s.history.map((h) => [h[0], h[1]]);
    this._transfers = s.transfers.map((t) => ({
      from: t.from,
      to: t.to,
      tiles: t.tiles.slice(),
      next: t.next,
    }));
    this._gauge = new Array<number>(this.size).fill(0);
    for (const [id, days] of s.gauges ?? []) this._gauge[id] = days;
    this.rebuildMatrix();
    // A restored game's screens have seen nothing yet.
    this.dataDirty = true;
    // No P3 game continues with P4 code (P4 spec §19.5; the P3 way).
    if (s.navy === undefined || s.air === undefined) {
      throw new Error(
        "World War 1936 snapshot without its navy and air (made before P4)",
      );
    }
    // No P0 game continues with P1 code (P1 spec §14.3).
    if (s.economy === undefined) {
      throw new Error(
        "World War 1936 snapshot without its economy (made before P1)",
      );
    }
    this.economy.restoreState(s.economy);
    // No P1 game continues with P2 code (P2 spec §16.5).
    if (s.land === undefined) {
      throw new Error(
        "World War 1936 snapshot without its land war (made before P2)",
      );
    }
    this.land.restoreState(s.land);
    // No P2 game continues with P3 code (P3 spec §22.5, plan decision 30).
    if (s.politics === undefined) {
      throw new Error(
        "World War 1936 snapshot without its politics (made before P3)",
      );
    }
    this.politics.restoreState(s.politics);
    this.navy.restoreState(s.navy);
    this.air.restoreState(s.air);
  }

  private rebuildMatrix(): void {
    this.warVer++;
    this.warMatrix.fill(0);
    for (const [a, b] of this._wars) {
      this.warMatrix[a * this.size + b] = 1;
      this.warMatrix[b * this.size + a] = 1;
    }
  }
}
