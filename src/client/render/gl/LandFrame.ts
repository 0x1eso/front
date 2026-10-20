/**
 * World War 1936 P2 (spec §15.2, §7.6): what the renderer keeps between
 * frames for the land war — the game tick the tokens glide from, and the
 * paradrop planes flown through PlanePass.
 */

import { ARMY_PARA } from "@openfront/engine-api/ww1936/LandTypes";
import { PLANE_SPEED } from "@openfront/engine-lib/warfare/Warfare";
import type { WwLandView } from "../../view/WwLandView";
import { nextTickSpan } from "../frame/derive/PlaneTrack";
import { UT_TRANSPORT_PLANE, type UnitState } from "../types";

/**
 * The game tick a frame shows: the last tick that arrived plus the share of
 * the (smoothed) tick span gone by since, at most one tick ahead.
 */
export class LandTickClock {
  private tick = 0;
  private atMs = 0;
  private spanMs: number;

  constructor(private readonly msPerTick: number) {
    this.spanMs = msPerTick;
  }

  /** Starts from `tick` (the land war attached, or a context restore). */
  reset(tick: number, nowMs: number): void {
    this.tick = tick;
    this.atMs = nowMs;
    this.spanMs = this.msPerTick;
  }

  /** A game tick arrived at `nowMs`. */
  note(tick: number, nowMs: number): void {
    if (tick === this.tick) return;
    if (tick - this.tick === 1) {
      this.spanMs = nextTickSpan(
        this.spanMs,
        nowMs - this.atMs,
        this.msPerTick,
      );
    }
    this.tick = tick;
    this.atMs = nowMs;
  }

  /** The fractional tick to draw at `nowMs`. */
  at(nowMs: number): number {
    const frac = (nowMs - this.atMs) / Math.max(1, this.spanMs);
    return this.tick + Math.min(1, Math.max(0, frac));
  }
}

/** Ids of the paradrop planes handed to PlanePass (no real unit has them). */
export const PARA_FLIGHT_ID0 = -1_000_000;

interface ParaFlight {
  unit: UnitState;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  startTick: number;
  ticks: number;
}

/**
 * Paradrops (spec §7.6 "the expanded-warfare plane reused", pre-flight R2):
 * an army whose ARMY_PARA bit cleared while its token jumped regions has
 * dropped. A transport plane flies from the old region's center to the new
 * one's (PLANE_SPEED, 6..40 ticks) by being added to the units PlanePass
 * gets; `land` opens the parachutes when it arrives. An order called off
 * (the bit clears, the region stays) flies nothing.
 */
export class ParadropFlights {
  /** Each army's last region × 2 + its ARMY_PARA bit. */
  private readonly seen = new Map<number, number>();
  private seenView: WwLandView | null = null;
  private version = -1;
  private flights: ParaFlight[] = [];
  private nextId = PARA_FLIGHT_ID0;
  /** The units PlanePass gets while a plane flies (reused). */
  private readonly merged = new Map<number, UnitState>();

  /** Planes in flight. */
  get count(): number {
    return this.flights.length;
  }

  reset(): void {
    this.seen.clear();
    this.seenView = null;
    this.version = -1;
    this.flights = [];
  }

  /**
   * The units for PlanePass at `gameTick`: `units` itself while no paradrop
   * plane flies, else a copy with the planes. Looks for new drops when the
   * view changed.
   */
  withFlights(
    view: WwLandView,
    units: ReadonlyMap<number, UnitState>,
    gameTick: number,
    land: (x: number, y: number, owner: number) => void,
  ): ReadonlyMap<number, UnitState> {
    if (view !== this.seenView || view.version !== this.version) {
      if (view !== this.seenView) this.reset();
      this.seenView = view;
      this.version = view.version;
      this.findDrops(view, gameTick);
    }
    if (this.flights.length === 0) return units;
    const out = this.merged;
    out.clear();
    for (const [id, u] of units) out.set(id, u);
    const w = view.scenario.width;
    let kept = 0;
    for (const f of this.flights) {
      const k = gameTick - f.startTick;
      if (k > f.ticks || k < 0) {
        land(f.x1, f.y1, f.unit.ownerID);
        continue;
      }
      f.unit.pos = tileAlong(f, k, w);
      f.unit.lastPos = tileAlong(f, k - 1, w);
      out.set(f.unit.id, f.unit);
      this.flights[kept++] = f;
    }
    this.flights.length = kept;
    return kept === 0 ? units : out;
  }

  private findDrops(view: WwLandView, gameTick: number): void {
    const sc = view.scenario;
    const w = sc.width;
    for (const a of view.armies.values()) {
      const now = a.region * 2 + ((a.state & ARMY_PARA) !== 0 ? 1 : 0);
      const before = this.seen.get(a.id);
      this.seen.set(a.id, now);
      if (before === undefined || before % 2 === 0 || now % 2 === 1) continue;
      const from = Math.floor(before / 2);
      if (from === a.region || from === 0 || a.region === 0) continue;
      const t0 = sc.centerTile(from);
      const t1 = sc.centerTile(a.region);
      const x0 = t0 % w;
      const y0 = Math.floor(t0 / w);
      const x1 = t1 % w;
      const y1 = Math.floor(t1 / w);
      const dist = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      this.flights.push({
        unit: paraPlane(this.nextId--, a.owner, t0, t1),
        x0,
        y0,
        x1,
        y1,
        startTick: gameTick,
        ticks: Math.min(40, Math.max(6, Math.ceil(dist / PLANE_SPEED))),
      });
    }
    if (this.seen.size > view.armies.size) {
      for (const id of [...this.seen.keys()]) {
        if (!view.armies.has(id)) this.seen.delete(id);
      }
    }
  }
}

function tileAlong(f: ParaFlight, j: number, w: number): number {
  const t = Math.max(0, j) / f.ticks;
  const x = Math.round(f.x0 + (f.x1 - f.x0) * t);
  const y = Math.round(f.y0 + (f.y1 - f.y0) * t);
  return y * w + x;
}

/** The paradrop plane PlanePass draws (a transport plane flying to `target`). */
function paraPlane(
  id: number,
  owner: number,
  from: number,
  target: number,
): UnitState {
  return {
    id,
    unitType: UT_TRANSPORT_PLANE,
    ownerID: owner,
    lastOwnerID: null,
    pos: from,
    lastPos: from,
    isActive: true,
    reachedTarget: false,
    retreating: false,
    targetable: false,
    waitTicks: 0,
    markedForDeletion: false,
    health: null,
    underConstruction: false,
    targetUnitId: null,
    targetTile: target,
    troops: 0,
    missileTimerQueue: [],
    level: 1,
    veterancy: 0,
    hasTrainStation: false,
    trainType: null,
    loaded: null,
    constructionStartTick: null,
    samUpgradeStartTick: null,
    samUpgradeStartRange: null,
    samUpgradeTargetLevel: null,
    samUpgradeDuration: null,
  };
}
