import {
  AirDeploySummary,
  AirFightRow,
  AirType,
  AirZoneData,
  CountryAirDetail,
  WingBrief,
  WingDetail,
  WingFlightRow,
  WwAirData,
} from "@openfront/engine-api/ww1936/AirTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";

/**
 * Every plane of a deployment: the static generations in `counts` and the
 * design planes in `dcounts` (absent with none). A design save moves the
 * static planes of its cell into `dcounts`, so a sum of `counts` alone
 * reads zero for them.
 */
export function deploymentPlanes(d: {
  counts: readonly number[];
  dcounts?: readonly number[];
}): number {
  let n = 0;
  for (const c of d.counts) n += c;
  for (const c of d.dcounts ?? []) n += c;
  return n;
}

/** ww8: how long (client ms) a zone keeps its air-battle flag after the last row. */
export const FIGHT_SHOW_MS = 2500;

/**
 * World War 1936 P4 (spec §19.4): the screens' copy of the air war,
 * merged from WwAir updates: each air zone's day (its sides), my
 * deployments, my detail.
 */
export class WwAirView {
  readonly zones = new Map<number, AirZoneData>();
  readonly deployments = new Map<number, AirDeploySummary>();
  detail: CountryAirDetail | null = null;
  version = 0;
  // ww8: the wings.
  /** Every country's wings, short, unfiltered: go through the fog before any screen reads them. */
  readonly wingBriefs = new Map<number, WingBrief>();
  /** My wings in full. */
  readonly wings = new Map<number, WingDetail>();
  /** Each wing's latest schedule row. */
  readonly flights = new Map<number, WingFlightRow>();
  /** The last update's air battle rows (a new update replaces them). */
  fights: readonly AirFightRow[] = [];

  /**
   * ww8: air battles still showing, by zone (strategic id): until when
   * (client ms) and the sides that lost planes. A screen-only fade: it
   * is not game state.
   */
  private readonly fightUntil = new Map<number, number>();
  private readonly fightSides = new Map<number, number[]>();

  constructor(
    readonly scenario: ScenarioIndex,
    readonly mySmallID: () => number,
    readonly mySide: () => number = mySmallID,
  ) {}

  apply(d: WwAirData, nowMs: number = performance.now()): void {
    // A zone's update is its whole day: every side that flew or holds
    // superiority (a side missing from it holds none now).
    for (const z of d.zones) this.zones.set(z.sr, z);
    for (const x of d.deployments) this.deployments.set(x.id, x);
    for (const id of d.removedDeployments) this.deployments.delete(id);
    const me = this.mySmallID();
    for (const x of d.briefs ?? []) this.wingBriefs.set(x.id, x);
    for (const x of d.wings ?? []) if (x.owner === me) this.wings.set(x.id, x);
    for (const x of d.flights ?? []) this.flights.set(x[0], x);
    this.fights = d.fights ?? [];
    for (const f of this.fights) {
      this.fightUntil.set(f[0], nowMs + FIGHT_SHOW_MS);
      const sides = this.fightSides.get(f[0]) ?? [];
      if (!sides.includes(f[1])) sides.push(f[1]);
      this.fightSides.set(f[0], sides);
    }
    for (const id of d.removedDeployments) {
      this.wingBriefs.delete(id);
      this.wings.delete(id);
      this.flights.delete(id);
    }
    for (const x of d.details) if (x.smallID === me) this.detail = x;
    this.version++;
  }

  /**
   * ww8: calls `fn(sr, sides)` for each air battle still showing at `nowMs`
   * (zone ascending is not promised), dropping the expired ones.
   */
  eachFight(
    nowMs: number,
    fn: (sr: number, sides: readonly number[]) => void,
  ): void {
    for (const [sr, until] of this.fightUntil) {
      if (nowMs >= until) {
        this.fightUntil.delete(sr);
        this.fightSides.delete(sr);
        continue;
      }
      fn(sr, this.fightSides.get(sr)!);
    }
  }

  /** ww8: how many air battles still show at `nowMs` (a cheap change key). */
  activeFights(nowMs: number): number {
    let n = 0;
    for (const until of this.fightUntil.values()) if (nowMs < until) n++;
    return n;
  }

  /** My side's air superiority ‰ over a zone (a plain loop: the fog asks it per zone a tick). */
  mySuperiority(sr: number): number {
    const sides = this.zones.get(sr)?.sides;
    if (sides === undefined) return 0;
    const side = this.mySide();
    for (let i = 0; i < sides.length; i++) {
      if (sides[i].side === side) return sides[i].supPm ?? 0;
    }
    return 0;
  }

  /** My planes of `type` deployed over a zone (every mission). */
  deployedIn(sr: number, type: AirType): number {
    let n = 0;
    for (const d of this.deployments.values()) {
      if (d.sr !== sr || d.type !== type) continue;
      n += deploymentPlanes(d);
    }
    return n;
  }
}
