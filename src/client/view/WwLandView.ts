import {
  ArmySummary,
  BattleSummary,
  CountryLandDetail,
  CountryLandSummary,
  RegionLandData,
  WwLandData,
} from "@openfront/engine-api/ww1936/LandTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";

/**
 * World War 1936 P2 (spec §16.4): the screens' copy of the land war, merged
 * from WwLand updates. Render passes read only this (spec §21.3).
 */
export class WwLandView {
  readonly armies = new Map<number, ArmySummary>();
  readonly battles = new Map<number, BattleSummary>();
  readonly regions = new Map<number, RegionLandData>();
  readonly countries = new Map<number, CountryLandSummary>();
  readonly details = new Map<number, CountryLandDetail>();
  readonly controller: Uint16Array;
  /** Tick each army's summary arrived (token interpolation). */
  private readonly armyTick = new Map<number, number>();
  version = 0;

  constructor(readonly scenario: ScenarioIndex) {
    this.controller = new Uint16Array(scenario.maxRegionId() + 1);
    const owners = scenario.ownerByRegion();
    for (const r of scenario.landRegions) this.controller[r.id] = owners[r.id];
  }

  apply(d: WwLandData, tick: number): void {
    for (const a of d.armies) {
      this.armies.set(a.id, a);
      this.armyTick.set(a.id, tick);
    }
    for (const id of d.removedArmies) {
      this.armies.delete(id);
      this.armyTick.delete(id);
    }
    for (const b of d.battles) this.battles.set(b.region, b);
    for (const r of d.endedBattles) this.battles.delete(r);
    for (const r of d.regions) {
      this.regions.set(r.id, r);
      this.controller[r.id] = r.controller;
    }
    for (const c of d.countries) this.countries.set(c.smallID, c);
    for (const x of d.details) this.details.set(x.smallID, x);
    this.version++;
  }

  armiesOf(smallID: number): ArmySummary[] {
    return [...this.armies.values()]
      .filter((a) => a.owner === smallID)
      .sort((a, b) => a.id - b.id);
  }

  /** Armies whose token stands in `region`, by id. */
  armiesAt(region: number): ArmySummary[] {
    return [...this.armies.values()]
      .filter((a) => a.region === region)
      .sort((a, b) => a.id - b.id);
  }

  /** Token position in tiles at `tick` (fractional): between the two centers while it moves. */
  /** The token's tile position; null for region 0 (no region). */
  tokenXY(a: ArmySummary, tick: number): [number, number] | null {
    if (
      a.region === 0 ||
      (a.move !== null && (a.move.from === 0 || a.move.to === 0))
    ) {
      return null;
    }
    const w = this.scenario.width;
    const at = (region: number): [number, number] => {
      const t = this.scenario.centerTile(region);
      return [t % w, Math.floor(t / w)];
    };
    if (a.move === null) return at(a.region);
    const since = Math.max(0, tick - (this.armyTick.get(a.id) ?? tick));
    const p = Math.min(1000, a.move.progPm + a.move.stepPm * since) / 1000;
    const [x0, y0] = at(a.move.from);
    const [x1, y1] = at(a.move.to);
    return [x0 + (x1 - x0) * p, y0 + (y1 - y0) * p];
  }
}
