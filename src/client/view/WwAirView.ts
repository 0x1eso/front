import {
  AirDeploySummary,
  AirType,
  AirZoneData,
  CountryAirDetail,
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
