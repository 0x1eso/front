import {
  CountryNavyDetail,
  FleetSummary,
  NavalBattleSummary,
  SeaRegionData,
  WwNavyData,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";

/** P2 WwLand's side key: a faction 100,000 + its index, a country alone its smallID. */
export function sideKeyOf(smallID: number, factionIdx: number): number {
  return factionIdx < 0 ? smallID : 100_000 + factionIdx;
}

/**
 * World War 1936 P4 (spec §19.4): the screens' copy of the navy, merged
 * from WwNavy updates; the fleet tokens' interpolation (date line
 * included). The renderer and the HUD read only this (plan Task 11, 12).
 */
export class WwNavyView {
  readonly fleets = new Map<number, FleetSummary>();
  readonly battles = new Map<number, NavalBattleSummary>();
  readonly seaRegions = new Map<number, SeaRegionData>();
  detail: CountryNavyDetail | null = null;
  /** Bumped on every merge; screens redraw when it moves. */
  version = 0;
  /** The tick each fleet's summary (its path and progress) arrived. */
  private arrived = new Map<number, number>();

  constructor(
    readonly scenario: ScenarioIndex,
    readonly mySmallID: () => number,
    /** My side's key (P2's: faction or country); a lone country by default. */
    readonly mySide: () => number = mySmallID,
  ) {}

  apply(d: WwNavyData, tick: number): void {
    for (const f of d.fleets) {
      this.fleets.set(f.id, f);
      this.arrived.set(f.id, tick);
    }
    for (const id of d.removedFleets) {
      this.fleets.delete(id);
      this.arrived.delete(id);
    }
    for (const b of d.battles) this.battles.set(b.zone, b);
    for (const z of d.endedBattles) this.battles.delete(z);
    for (const s of d.seaRegions) this.seaRegions.set(s.sr, s);
    const me = this.mySmallID();
    for (const x of d.details) if (x.smallID === me) this.detail = x;
    this.version++;
  }

  /**
   * Interpolated tile position [x, y] of a fleet at `tick + alpha`: from
   * its zone's center toward the next zone's, by its progress and step.
   * Across the date line the short way: x may be < 0 or ≥ the map width
   * (FleetTokenLayout draws both ends).
   */
  fleetXY(id: number, tick: number, alpha: number): [number, number] {
    const f = this.fleets.get(id);
    if (f === undefined) return [0, 0];
    const W = this.scenario.width;
    const c0 = this.scenario.zoneCenter(f.zone);
    const x0 = c0 % W;
    const y0 = Math.floor(c0 / W);
    if (f.path.length === 0) return [x0, y0];
    const c1 = this.scenario.zoneCenter(f.path[0]);
    let x1 = c1 % W;
    const y1 = Math.floor(c1 / W);
    if (Math.abs(x1 - x0) > W / 2) x1 += x1 > x0 ? -W : W;
    const since = tick - (this.arrived.get(id) ?? tick) + alpha;
    const pm = Math.max(0, Math.min(1000, f.progPm + f.stepPm * since));
    return [x0 + ((x1 - x0) * pm) / 1000, y0 + ((y1 - y0) * pm) / 1000];
  }

  /** Sea region → my side's supremacy ‰ (0..1000), for the sea layer colours. */
  mySupremacy(sr: number): number {
    const side = this.mySide();
    for (const [k, pm] of this.seaRegions.get(sr)?.sup ?? []) {
      if (k === side) return pm;
    }
    return 0;
  }

  /** My side spotted this enemy fleet (spec §8.4). */
  spottedByMe(fleet: number): boolean {
    const side = this.mySide();
    for (const s of this.seaRegions.values()) {
      for (const [k, ids] of s.spotted) {
        if (k === side && ids.includes(fleet)) return true;
      }
    }
    return false;
  }
}
