// World War 1936 P4 (plan decision 36): what the land war reads from the
// navy, the air war and fuel. P2's battles, movement and supply call these
// (O(1) reads of state the lanes compute on their days: pre-flight D);
// WorldWar installs NavyAirHooks, NEUTRAL_HOOKS stand in before. Each
// method calls one lane's function (named in its comment): that lane
// changes only its line.
import type { CombatMods } from "@openfront/engine-api/ww1936/LandTypes";
import {
  HUB_SEA,
  hubCapacityMilli,
} from "@openfront/engine-lib/ww1936/SupplyRules";
import { airSupplyAt, casHitsFor } from "../air/AirEffects";
import type { WwAir } from "../air/WwAir";
import { harborLevelOf } from "../depth/Harbors";
import type { WwDepth } from "../depth/WwDepth";
import {
  amphibiousModsFor,
  beachheadCapacityMilli,
  shoreBombardAt,
} from "./Invasions";
import { seaHubCapacityMilli } from "./SeaSupply";
import type { WwNavy } from "./WwNavy";

export interface LandSeaAirHooks {
  /** Spec §14.6: attack and defense cut of a division (its air attack) of `side` fighting in `region`, bp ≤ 0. */
  airPenaltyBp(region: number, side: number, divAirAtk: number): number;
  /** Spec §14.7: `side`'s close air support hits a round in that battle, centi. */
  casHits(battleRegion: number, side: number): number;
  /** Spec §14.6: movement of `side` into `region`, ‰. */
  airMoveFactorPm(region: number, side: number): number;
  /** Spec §15.4: yesterday's fuel ratio of `owner`, ‰. */
  fuelFactorPm(owner: number): number;
  /** Spec §10.3: a working port's sea-hub capacity for `side`, milli a day. */
  seaHubCapacity(region: number, side: number): number;
  /** Spec §11.5: a beachhead's coastal supply hub (a region with no working port), milli; 0 none. */
  beachheadCapacity(region: number, side: number): number;
  /** Spec §14.10: air supply added to `region` for `side`, milli a day. */
  airSupply(region: number, side: number): number;
  /** Spec §11.4: the defense cut of `side`'s divisions in `region` by enemy shore bombardment, bp ≤ 0. */
  shoreBombardBp(region: number, side: number): number;
  /**
   * Spec §11.4: a landing division's landing cut only (attackBp ≤ 0; the
   * coastal fort's cut Battles computes itself); null for any other.
   */
  amphibious(battleRegion: number, row: number): CombatMods | null;
}

/** Before WorldWar installs the navy and air (and in pure P2 tests): nothing changes. */
export const NEUTRAL_HOOKS: LandSeaAirHooks = {
  airPenaltyBp: () => 0,
  casHits: () => 0,
  airMoveFactorPm: () => 1000,
  fuelFactorPm: () => 1000,
  seaHubCapacity: () => hubCapacityMilli(HUB_SEA, 0),
  beachheadCapacity: () => 0,
  airSupply: () => 0,
  shoreBombardBp: () => 0,
  amphibious: () => null,
};

export class NavyAirHooks implements LandSeaAirHooks {
  constructor(
    private readonly navy: WwNavy,
    private readonly air: WwAir,
  ) {}

  airPenaltyBp(region: number, side: number, divAirAtk: number): number {
    return this.air.airPenaltyBp(region, side, divAirAtk); // A1
  }
  casHits(battleRegion: number, side: number): number {
    return casHitsFor(this.air, battleRegion, side); // A2
  }
  airMoveFactorPm(region: number, side: number): number {
    return this.air.airMoveFactorPm(region, side); // A1
  }
  fuelFactorPm(owner: number): number {
    return this.navy.econ.country(owner)?.fuelRatioPm ?? 1000; // E
  }
  seaHubCapacity(region: number, side: number): number {
    // P6 glue (W1): a floating harbour at a base-1 or base-2 port counts too.
    return Math.max(
      seaHubCapacityMilli(this.navy, region, side), // C
      this.floatingHarborMilli(region, side),
    );
  }
  beachheadCapacity(region: number, side: number): number {
    return Math.max(
      beachheadCapacityMilli(this.navy, region, side), // I
      this.floatingHarborMilli(region, side),
    );
  }
  /**
   * P6 hook (W1, spec §16.6): a floating harbour works as a port of its
   * level (5 for 60 days, then down to 0 by day 120) for its controller's
   * side, milli; 0 none.
   */
  private floatingHarborMilli(region: number, side: number): number {
    const depth = this.navy.ww.depth as WwDepth | undefined;
    if (depth === undefined) return 0;
    const lv = harborLevelOf(depth, region);
    const c = this.navy.land.controller[region] ?? 0;
    if (lv <= 0 || c === 0 || this.navy.land.sideOf(c) !== side) return 0;
    return 4_000 + 2 * lv;
  }
  airSupply(region: number, side: number): number {
    return airSupplyAt(this.air, region, side); // A2
  }
  shoreBombardBp(region: number, side: number): number {
    return shoreBombardAt(this.navy, region, side); // I
  }
  amphibious(battleRegion: number, row: number): CombatMods | null {
    return amphibiousModsFor(this.navy, battleRegion, row); // I
  }
}
