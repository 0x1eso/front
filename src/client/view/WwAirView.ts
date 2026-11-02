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
 * World War 1936 P4 (spec §19.4): the screens' copy of the air war,
 * merged from WwAir updates: each air zone's day (its sides), my
 * deployments, my detail.
 */
export class WwAirView {
  readonly zones = new Map<number, AirZoneData>();
  readonly deployments = new Map<number, AirDeploySummary>();
  detail: CountryAirDetail | null = null;
  version = 0;
  // ww8: the wing model's copy (empty in an old-model game).
  /** This game runs the wing model: the screens switch on it. */
  live = false;
  /** Every country's wings, short, unfiltered: go through the fog before any screen reads them. */
  readonly wingBriefs = new Map<number, WingBrief>();
  /** My wings in full. */
  readonly wings = new Map<number, WingDetail>();
  /** Each wing's latest schedule row. */
  readonly flights = new Map<number, WingFlightRow>();
  /** The last update's air battle rows (a new update replaces them). */
  fights: readonly AirFightRow[] = [];

  constructor(
    readonly scenario: ScenarioIndex,
    readonly mySmallID: () => number,
    readonly mySide: () => number = mySmallID,
  ) {}

  apply(d: WwAirData): void {
    // A zone's update is its whole day: every side that flew or holds
    // superiority (a side missing from it holds none now).
    for (const z of d.zones) this.zones.set(z.sr, z);
    for (const x of d.deployments) this.deployments.set(x.id, x);
    for (const id of d.removedDeployments) this.deployments.delete(id);
    const me = this.mySmallID();
    if (d.live === true) this.live = true;
    for (const x of d.briefs ?? []) this.wingBriefs.set(x.id, x);
    for (const x of d.wings ?? []) if (x.owner === me) this.wings.set(x.id, x);
    for (const x of d.flights ?? []) this.flights.set(x[0], x);
    this.fights = d.fights ?? [];
    for (const id of d.removedDeployments) {
      this.wingBriefs.delete(id);
      this.wings.delete(id);
      this.flights.delete(id);
    }
    for (const x of d.details) if (x.smallID === me) this.detail = x;
    this.version++;
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
      for (const c of d.counts) n += c;
    }
    return n;
  }
}
