import {
  WwCountryDetail,
  WwCountrySummary,
  WwEconomyData,
  WwRegionData,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";

/**
 * World War 1936 P1 (spec §14.4): the screens' copy of the economy, merged
 * from WwEconomy updates. The regions start from scenario.json, like the
 * engine's; the countries arrive with the first update.
 */
export class WwEconomyView {
  private summaries = new Map<number, WwCountrySummary>();
  private details = new Map<number, WwCountryDetail>();
  readonly civ: Uint8Array;
  readonly mil: Uint8Array;
  readonly dock: Uint8Array;
  readonly infra: Uint8Array;
  readonly controller: Uint16Array;
  /** Bumped on every merge; screens redraw when it moves. */
  version = 0;

  constructor(readonly scenario: ScenarioIndex) {
    const regions = scenario.landRegions;
    const size =
      (regions.length === 0 ? 0 : regions[regions.length - 1].id) + 1;
    this.civ = new Uint8Array(size);
    this.mil = new Uint8Array(size);
    this.dock = new Uint8Array(size);
    this.infra = new Uint8Array(size);
    this.controller = new Uint16Array(size);
    const owners = scenario.ownerByRegion();
    for (const r of regions) {
      this.civ[r.id] = r.civ;
      this.mil[r.id] = r.mil;
      this.dock[r.id] = r.dock;
      this.infra[r.id] = r.infra;
      this.controller[r.id] = owners[r.id];
    }
  }

  apply(d: WwEconomyData): void {
    for (const s of d.countries) this.summaries.set(s.smallID, s);
    for (const x of d.details) this.details.set(x.smallID, x);
    for (const r of d.regions) {
      this.civ[r.id] = r.civ;
      this.mil[r.id] = r.mil;
      this.dock[r.id] = r.dock;
      this.infra[r.id] = r.infra;
      this.controller[r.id] = r.controller;
    }
    this.version++;
  }

  summary(smallID: number): WwCountrySummary | null {
    return this.summaries.get(smallID) ?? null;
  }

  detail(smallID: number): WwCountryDetail | null {
    return this.details.get(smallID) ?? null;
  }

  troopCap(smallID: number): number | null {
    return this.summaries.get(smallID)?.troopCap ?? null;
  }

  region(id: number): WwRegionData {
    return {
      id,
      controller: this.controller[id],
      civ: this.civ[id],
      mil: this.mil[id],
      dock: this.dock[id],
      infra: this.infra[id],
    };
  }
}
