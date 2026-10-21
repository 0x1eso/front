// World War 1936 P6 (pre-flight §0-9, plan decision 37): what the land war
// asks the depth layer. WorldWar installs its WwDepth after building it
// (the P4 NavyAirHooks pattern); until then, and in the pure P2 tests,
// the neutral answers keep P2's numbers. Every read is O(1): the values
// were computed on the owner's (or the zone's) day.
import type { KeyStatsTable } from "@openfront/engine-api/ww1936/DepthTypes";
import { STATIC_KEY_STATS } from "@openfront/engine-lib/ww1936/TemplateStats";

/** Pre-flight §0-2: an army's depth values for ModInput. */
export interface ArmyDepthModsLike {
  fmAtt: number;
  fmDef: number;
  fmTraits: number;
  cmdAttBp: number;
  cmdDefBp: number;
  halfSupply: boolean;
}

export interface LandDepthHooks {
  /** The army's field marshal and command values (lane D). */
  armyMods(owner: number, armyId: number): ArmyDepthModsLike;
  /** The readiness cut `victim`'s enemies impose at `region`, bp ≤ 0 (recon, trickster). */
  planCutBp(victim: number, region: number): number;
  /** The fort levels the army's railway guns cut at `region` (attacker). */
  fortCut(armyId: number, region: number): number;
  /** Centi-hits of railway guns for `side` at `region` this round (beside close air support). */
  railGunHits(region: number, side: number): number;
  /** One division's day of combat (half battalions by track group). */
  noteLandCombat(
    owner: number,
    infHalf: number,
    armorHalf: number,
    supportHalf: number,
  ): void;
  /** The reinforcement order of the country's division ids; null: P2's. */
  reinforceOrder(id: number): number[] | null;
  /** A medal's division experience gain on the army, percent. */
  medalXpPct(armyId: number): number;
  /** Supply into the region, ‰ (flood, scorch, nuke). */
  supplyPm(region: number): number;
  /** Movement into the region slowed, percent. */
  moveCutPct(region: number): number;
  /** A region changed controller. */
  onRegionControl(region: number, from: number, to: number, tick: number): void;
  /** The country's division-slot numbers (plan decision 7). */
  keyStats(owner: number): KeyStatsTable;
}

const NEUTRAL_MODS: ArmyDepthModsLike = {
  fmAtt: 0,
  fmDef: 0,
  fmTraits: 0,
  cmdAttBp: 0,
  cmdDefBp: 0,
  halfSupply: false,
};

export const NEUTRAL_DEPTH_HOOKS: LandDepthHooks = {
  armyMods: () => NEUTRAL_MODS,
  planCutBp: () => 0,
  fortCut: () => 0,
  railGunHits: () => 0,
  noteLandCombat: () => {},
  reinforceOrder: () => null,
  medalXpPct: () => 0,
  supplyPm: () => 1000,
  moveCutPct: () => 0,
  onRegionControl: () => {},
  keyStats: () => STATIC_KEY_STATS,
};
