import type { TileRef } from "@openfront/engine-api/game/GameMap";
import type { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import {
  SATELLITE_STRIKE_DELAY_TICKS,
  strikeSecondsLeft,
} from "@openfront/engine-lib/strategic/Strategic";

/**
 * Strategic weapons (spec §6.6): the pure logic behind the stronger effects.
 * Nothing here touches GL, the DOM or sound; the renderer, the band and the
 * sound controller read what it derives.
 */

/** The last seconds of the countdown: red band, warning sound. */
export const LAST_SECONDS = 10;
/** Border pulse rate (Hz) at the start of the minute and at its end. */
export const PULSE_HZ_START = 0.7;
export const PULSE_HZ_END = 3;
/** Reticle radius as a fraction of its starting radius once the minute is up. */
export const RETICLE_END_FRACTION = 0.35;

const TICKS_PER_SECOND = 10;

/** Ticks left to the strike, never negative. */
export function ticksLeft(strikeTick: number, now: number): number {
  return Math.max(0, strikeTick - now);
}

/** Reticle radius: starts at `maxRadius` and shrinks linearly over the minute. */
export function reticleRadius(
  left: number,
  total: number,
  maxRadius: number,
): number {
  const f = Math.min(1, Math.max(0, left / Math.max(1, total)));
  return maxRadius * (RETICLE_END_FRACTION + (1 - RETICLE_END_FRACTION) * f);
}

/** The countdown band turns red for the last LAST_SECONDS seconds. */
export function isLastSeconds(left: number): boolean {
  return left > 0 && left <= LAST_SECONDS * TICKS_PER_SECOND;
}

/**
 * Border pulse brightness 0..1 for `leftTicks` of `totalTicks` left. The
 * rate climbs linearly from PULSE_HZ_START to PULSE_HZ_END; the phase is the
 * integral of the rate, so speeding up never makes it jump.
 */
export function borderPulse(leftTicks: number, totalTicks: number): number {
  const total = Math.max(1, totalTicks) / TICKS_PER_SECOND;
  const elapsed =
    Math.min(Math.max(0, totalTicks - leftTicks), totalTicks) /
    TICKS_PER_SECOND;
  const phase =
    PULSE_HZ_START * elapsed +
    ((PULSE_HZ_END - PULSE_HZ_START) * elapsed * elapsed) / (2 * total);
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
}

/** A silo preparing a satellite, as the badge/ring/label need it. */
export interface PreparingSilo {
  siloId: number;
  ownerID: number;
  tile: TileRef;
  progress: number;
  secondsLeft: number;
}

/** What the effects read of a player (PlayerView satisfies it). */
export interface FxPlayer {
  smallID(): number;
  isAlive(): boolean;
  strategicData(): StrategicData | null;
}

/** Silos preparing a satellite (every player sees them); `siloTile` is null for a silo that left the view. */
export function preparingSilos(
  players: Iterable<FxPlayer>,
  now: number,
  siloTile: (siloId: number) => TileRef | null,
  out: PreparingSilo[] = [],
): PreparingSilo[] {
  out.length = 0;
  for (const p of players) {
    if (!p.isAlive()) continue;
    const sat = p.strategicData()?.satellite;
    if (sat?.phase !== "preparing") continue;
    const tile = siloTile(sat.siloId);
    if (tile === null) continue;
    const span = Math.max(1, sat.readyTick - sat.startTick);
    out.push({
      siloId: sat.siloId,
      ownerID: p.smallID(),
      tile,
      progress: Math.min(1, Math.max(0, (now - sat.startTick) / span)),
      secondsLeft: strikeSecondsLeft(sat.readyTick, now),
    });
  }
  return out;
}

/** A satellite in orbit or counting down (leaderboard icon); preparing does not count. */
export function hasSatelliteUp(data: StrategicData | null): boolean {
  const phase = data?.satellite.phase;
  return phase === "orbit" || phase === "targeted";
}

/** A countdown in progress, for the border pulse and the reticle. */
export interface FxCountdown {
  attackerID: number;
  targetID: number;
  strikeTick: number;
}

export function activeCountdowns(
  players: Iterable<FxPlayer>,
  out: FxCountdown[] = [],
): FxCountdown[] {
  out.length = 0;
  for (const p of players) {
    if (!p.isAlive()) continue;
    const sat = p.strategicData()?.satellite;
    if (sat?.phase !== "targeted") continue;
    out.push({
      attackerID: p.smallID(),
      targetID: sat.target,
      strikeTick: sat.strikeTick,
    });
  }
  return out;
}

/** One orbital strike wave, as the effects need it. */
export interface WaveInput {
  attackerID: number;
  targetID: number;
  wave?: number;
}

/** Events for one update(); the arrays are reused, so read them before the next call. */
export interface StrategicFxEvents {
  /** A satellite reached orbit: its silo's tile. */
  launches: TileRef[];
  /** An interceptor was fired: its silo's tile. */
  interceptStreaks: TileRef[];
  /** A resolved interception: true = shot down, false = missed. */
  interceptResults: boolean[];
  /** A once-a-second beep in the last seconds: true if I am the target. */
  beeps: boolean[];
  /** The first wave of a strike landed: true if I am the target. */
  strikeStarts: boolean[];
  /** Waves after the first. */
  laterWaves: number;
}

const EMPTY_KEYS: ReadonlySet<string> = new Set();

interface Tracked {
  phase: string;
  prepTile: TileRef | null;
  strikeTick: number;
  keys: ReadonlySet<string>;
  lastBeepSecs: number;
}

export const STRIKE_TOTAL_TICKS = SATELLITE_STRIKE_DELAY_TICKS;

/**
 * Follows every player's satellite across ticks and reports what changed:
 * launches, interceptors fired and judged, last-seconds beeps and strike
 * waves. Hit or miss is inferred (the engine sends no result update): an
 * interceptor that leaves the list while the satellite is still counting
 * down missed; if the satellite leaves the countdown without a strike having
 * landed, it was shot down.
 */
export class StrategicFxTracker {
  private tracked = new Map<number, Tracked>();
  private readonly events: StrategicFxEvents = {
    launches: [],
    interceptStreaks: [],
    interceptResults: [],
    beeps: [],
    strikeStarts: [],
    laterWaves: 0,
  };

  reset(): void {
    this.tracked.clear();
  }

  update(
    players: Iterable<FxPlayer>,
    now: number,
    myID: number,
    siloTile: (siloId: number) => TileRef | null,
    waves: readonly WaveInput[] = [],
  ): StrategicFxEvents {
    const ev = this.events;
    ev.launches.length = 0;
    ev.interceptStreaks.length = 0;
    ev.interceptResults.length = 0;
    ev.beeps.length = 0;
    ev.strikeStarts.length = 0;
    ev.laterWaves = 0;

    for (const w of waves) {
      if (w.wave === undefined || w.wave === 0) {
        ev.strikeStarts.push(w.targetID === myID);
      } else {
        ev.laterWaves++;
      }
    }

    for (const p of players) {
      const id = p.smallID();
      const data = p.strategicData();
      if (!p.isAlive() || data === null) {
        this.tracked.delete(id);
        continue;
      }
      const sat = data.satellite;
      const prev = this.tracked.get(id);
      const keys: ReadonlySet<string> =
        sat.phase === "targeted" && sat.interceptors.length > 0
          ? new Set(sat.interceptors.map(interceptorKey))
          : EMPTY_KEYS;

      if (prev !== undefined) {
        // Launch: the preparation finished and the satellite is in orbit.
        if (
          prev.phase === "preparing" &&
          sat.phase === "orbit" &&
          prev.prepTile !== null
        ) {
          ev.launches.push(prev.prepTile);
        }
        if (sat.phase === "targeted") {
          for (const i of sat.interceptors) {
            if (!prev.keys.has(interceptorKey(i)) && i.from !== undefined) {
              ev.interceptStreaks.push(i.from);
            }
          }
        }
        if (prev.phase === "targeted" && prev.keys.size > 0) {
          let gone = 0;
          for (const k of prev.keys) if (!keys.has(k)) gone++;
          if (sat.phase === "targeted") {
            // Still counting down: every interceptor that vanished missed.
            for (let n = 0; n < gone; n++) ev.interceptResults.push(false);
          } else if (gone > 0) {
            const struck =
              now >= prev.strikeTick || waves.some((w) => w.attackerID === id);
            if (struck) {
              for (let n = 0; n < gone; n++) ev.interceptResults.push(false);
            } else {
              // Gone from the countdown before its time: shot down.
              ev.interceptResults.push(true);
            }
          }
        }
      }

      const cur: Tracked = prev ?? {
        phase: sat.phase,
        prepTile: null,
        strikeTick: 0,
        keys: EMPTY_KEYS,
        lastBeepSecs: Infinity,
      };
      if (sat.phase === "preparing") {
        cur.prepTile = siloTile(sat.siloId) ?? cur.prepTile;
      } else {
        cur.prepTile = null;
      }
      if (sat.phase === "targeted") {
        const secs = strikeSecondsLeft(sat.strikeTick, now);
        if (secs > 0 && secs <= LAST_SECONDS && secs !== cur.lastBeepSecs) {
          ev.beeps.push(sat.target === myID);
        }
        cur.lastBeepSecs = secs;
        cur.strikeTick = sat.strikeTick;
      } else {
        cur.lastBeepSecs = Infinity;
      }
      cur.phase = sat.phase;
      cur.keys = keys;
      if (prev === undefined) this.tracked.set(id, cur);
    }
    return ev;
  }
}

function interceptorKey(i: {
  by: number;
  type: string;
  resolveTick: number;
  from?: number;
}): string {
  return `${i.by}:${i.type}:${i.resolveTick}:${i.from ?? ""}`;
}

/** "1:05" for 65 seconds. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const r = s % 60;
  return `${Math.floor(s / 60)}:${r < 10 ? "0" : ""}${r}`;
}

/** Reticle size for a territory of `tiles` tiles: a bit wider than the land. */
export function reticleMaxRadius(tiles: number): number {
  return Math.min(
    120,
    Math.max(18, Math.sqrt(Math.max(0, tiles) / Math.PI) * 1.25),
  );
}
