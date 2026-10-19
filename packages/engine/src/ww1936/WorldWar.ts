import {
  COUNTRIES,
  CountryTag,
  FactionId,
} from "@openfront/engine-api/ww1936/Countries";
import {
  WorldWarData,
  WW_PREP_TICKS,
  WW_START_TROOPS_PCT,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { zInt, zTiles } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayIndex } from "@openfront/engine-lib/ww1936/Calendar";
import { WW_INITIAL_WARS } from "@openfront/engine-lib/ww1936/History";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { z } from "zod";
import type { Game, Player } from "../game/Game";

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
 * capitulated, the rolled historical calendar and pending land transfers.
 * Factions are fixed in P0 (COUNTRIES[tag].faction).
 */
export class WorldWar {
  private readonly size: number;
  private warMatrix: Uint8Array;
  private _wars: [number, number, number][] = [];
  private _capitulated: [number, number, number][] = [];
  private _startVp: number[] = [];
  private _historyRolled = false;
  private _history: [number, boolean][] = [];
  private _transfers: Transfer[] = [];
  private _prepEndTick = WW_PREP_TICKS;
  private _lastDay = -1;
  /** Not state (DERIVED_FIELDS): whether the screens need an update. */
  private dataDirty = true;

  constructor(
    private readonly mg: Game,
    readonly scenario: ScenarioIndex,
  ) {
    this.size = scenario.countries.length + 1;
    this.warMatrix = new Uint8Array(this.size * this.size);
  }

  /**
   * Spec §5.3, §7.1: capitals, starting troops, starting victory points and
   * the wars of 1 January 1936. GameImpl calls it once, after the territory.
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
      p.setTroops(
        Math.floor((this.mg.config().maxTroops(p) * WW_START_TROOPS_PCT) / 100),
      );
    }
    this._startVp = this.scenario.startVpBySmallId();
    for (const [x, y] of WW_INITIAL_WARS) {
      const a = this.scenario.smallIdOf(x);
      const b = this.scenario.smallIdOf(y);
      if (a !== 0 && b !== 0) this.setWar(a, b, 0);
    }
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

  factionOf(smallID: number): FactionId | null {
    const tag = this.scenario.tagOfSmallId(smallID);
    return tag === undefined ? null : COUNTRIES[tag].faction;
  }

  /** Members of a faction present in this scenario, by smallID. */
  factionMembers(faction: FactionId): number[] {
    const out: number[] = [];
    this.scenario.countries.forEach((tag, i) => {
      if (COUNTRIES[tag].faction === faction) out.push(i + 1);
    });
    return out;
  }

  sameFaction(a: number, b: number): boolean {
    if (a === b) return false;
    const f = this.factionOf(a);
    return f !== null && f === this.factionOf(b);
  }

  isAtWar(a: number, b: number): boolean {
    if (a <= 0 || b <= 0 || a >= this.size || b >= this.size) return false;
    return this.warMatrix[a * this.size + b] === 1;
  }

  /** Spec §7.2: at war, and the preparation minute is over. */
  canFight(a: number, b: number, tick: number): boolean {
    return !this.inPrep(tick) && this.isAtWar(a, b);
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

  /** Human clientIDs of a camp (a faction), for the team winner (decision 11). */
  humanClientIDsOf(faction: FactionId): string[] {
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
    };
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
    return h >>> 0;
  }

  snapshot(): WorldWarState {
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
    this.rebuildMatrix();
    // A restored game's screens have seen nothing yet.
    this.dataDirty = true;
  }

  private rebuildMatrix(): void {
    this.warMatrix.fill(0);
    for (const [a, b] of this._wars) {
      this.warMatrix[a * this.size + b] = 1;
      this.warMatrix[b * this.size + a] = 1;
    }
  }
}
