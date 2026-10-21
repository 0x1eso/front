import {
  BUILDING_IDS,
  BuildingId,
  WwCountryDetail,
  WwCountrySummary,
  WwEconomyData,
  WwRegionData,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { effectiveCount } from "@openfront/engine-lib/ww1936/BuildingDamage";
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
  /** P2 level buildings (plan decision 10). */
  readonly fort: Uint8Array;
  readonly rail: Uint8Array;
  readonly hub: Uint8Array;
  readonly controller: Uint16Array;
  /** P3 deposit bonuses by region (absent: none), RESOURCE_IDS order. */
  private resBonus = new Map<number, number[]>();
  /** P4 buildings (P4 spec §12.1). */
  readonly navalBase: Uint8Array;
  readonly airBase: Uint8Array;
  readonly aa: Uint8Array;
  readonly radar: Uint8Array;
  readonly coastalFort: Uint8Array;
  readonly refinery: Uint8Array;
  readonly silo: Uint8Array;
  /** P4 bomb damage by region (absent: none), BUILDING_IDS order, milli. */
  private damage = new Map<number, number[]>();
  /** P4 (lane U): the repair's progress by damaged region, ‰ (WwRegionData.repairPm). */
  private repairPm = new Map<number, number>();
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
    this.fort = new Uint8Array(size);
    this.rail = new Uint8Array(size);
    this.hub = new Uint8Array(size);
    this.controller = new Uint16Array(size);
    this.navalBase = new Uint8Array(size);
    this.airBase = new Uint8Array(size);
    this.aa = new Uint8Array(size);
    this.radar = new Uint8Array(size);
    this.coastalFort = new Uint8Array(size);
    this.refinery = new Uint8Array(size);
    this.silo = new Uint8Array(size);
    const owners = scenario.ownerByRegion();
    for (const r of regions) {
      this.civ[r.id] = r.civ;
      this.mil[r.id] = r.mil;
      this.dock[r.id] = r.dock;
      this.infra[r.id] = r.infra;
      this.fort[r.id] = scenario.startFort(r.id);
      this.rail[r.id] = scenario.startRail(r.id);
      this.controller[r.id] = owners[r.id];
      // P4: the engine's start levels (the refineries and silos come in the first update).
      this.navalBase[r.id] = scenario.startNavalBase(r.id);
      this.airBase[r.id] = scenario.startAirBase(r.id);
      this.aa[r.id] = scenario.startAa(r.id);
      this.coastalFort[r.id] = scenario.startCoastalFort(r.id);
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
      this.fort[r.id] = r.fort;
      this.rail[r.id] = r.rail;
      this.hub[r.id] = r.hub;
      this.controller[r.id] = r.controller;
      if (r.res === undefined) this.resBonus.delete(r.id);
      else this.resBonus.set(r.id, [...r.res]);
      this.navalBase[r.id] = r.navalBase;
      this.airBase[r.id] = r.airBase;
      this.aa[r.id] = r.aa;
      this.radar[r.id] = r.radar;
      this.coastalFort[r.id] = r.coastalFort;
      this.refinery[r.id] = r.refinery;
      this.silo[r.id] = r.silo;
      if (r.damage.length === 0) this.damage.delete(r.id);
      else this.damage.set(r.id, [...r.damage]);
      if (r.repairPm === undefined) this.repairPm.delete(r.id);
      else this.repairPm.set(r.id, r.repairPm);
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
      fort: this.fort[id],
      rail: this.rail[id],
      hub: this.hub[id],
      ...(this.resBonus.has(id) ? { res: [...this.resBonus.get(id)!] } : {}),
      navalBase: this.navalBase[id],
      airBase: this.airBase[id],
      aa: this.aa[id],
      radar: this.radar[id],
      coastalFort: this.coastalFort[id],
      refinery: this.refinery[id],
      silo: this.silo[id],
      damage: [...(this.damage.get(id) ?? [])],
      ...(this.repairPm.has(id) ? { repairPm: this.repairPm.get(id)! } : {}),
    };
  }

  /** P4: a building's count or level in a region (before damage). */
  buildingCount(b: BuildingId, region: number): number {
    switch (b) {
      case "civ":
        return this.civ[region];
      case "mil":
        return this.mil[region];
      case "dock":
        return this.dock[region];
      case "infra":
        return this.infra[region];
      case "fort":
        return this.fort[region];
      case "rail":
        return this.rail[region];
      case "supply_hub":
        return this.hub[region];
      case "naval_base":
        return this.navalBase[region];
      case "air_base":
        return this.airBase[region];
      case "anti_air":
        return this.aa[region];
      case "radar":
        return this.radar[region];
      case "coastal_fort":
        return this.coastalFort[region];
      case "synthetic_refinery":
        return this.refinery[region];
      case "fuel_silo":
        return this.silo[region];
    }
  }

  /** P4 plan decision 13: the working buildings, count − whole damaged ones (the engine's effectiveBuildings). */
  effectiveBuildings(b: BuildingId, region: number): number {
    return effectiveCount(
      this.buildingCount(b, region),
      this.damage.get(region)?.[BUILDING_IDS.indexOf(b)] ?? 0,
    );
  }

  /** P4 plan decision 11: the region's naval base works now (the engine's navalPort). */
  navalPort(region: number): boolean {
    return this.effectiveBuildings("naval_base", region) >= 1;
  }
}
