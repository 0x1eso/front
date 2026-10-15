import {
  GovernmentId,
  LawId,
  LawOption,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  DOMESTIC_INTERVAL_TICKS,
  GOVERNMENT_TIER_THRESHOLDS,
  LAW_COOLDOWN_TICKS,
  MILLI,
} from "@openfront/engine-lib/domestic/Balance";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";

export const HUMAN = new PlayerInfo(
  "human",
  PlayerType.Human,
  null,
  "human_id",
);

/** A plains game (100x100, all land) with domestic mode on. */
export async function domesticGame(
  config: Partial<GameConfig> = {},
  humans: PlayerInfo[] = [HUMAN],
): Promise<Game> {
  return setup("plains", { domesticMode: true, ...config }, humans);
}

export function conquerSquare(
  game: Game,
  player: Player,
  x0: number,
  y0: number,
  size: number,
): void {
  for (let x = x0; x < x0 + size; x++) {
    for (let y = y0; y < y0 + size; y++) {
      player.conquer(game.ref(x, y));
    }
  }
}

/** Gives a player techs directly, skipping costs and era rules. */
export function grantTechs(player: Player, ...techs: TechId[]): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  for (const tech of techs) {
    d.beginResearch(tech, 0);
    d.advanceResearch(DOMESTIC_INTERVAL_TICKS);
  }
}

/** Proclaims laws directly, skipping costs, conditions and the cooldown. */
export function grantLaws(
  player: Player,
  laws: Partial<Record<LawId, LawOption>>,
): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  for (const [law, option] of Object.entries(laws) as [LawId, LawOption][]) {
    // A cooldown that ends at tick 0 leaves the next proclamation open.
    d.proclaimLaw(law, option, -LAW_COOLDOWN_TICKS);
  }
}

/** Adopts a government directly, skipping tier rules and the cooldown. */
export function grantGovernment(
  player: Player,
  government: GovernmentId,
): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  d.chooseGovernment(government, -LAW_COOLDOWN_TICKS);
}

export function conquerRect(
  game: Game,
  player: Player,
  x0: number,
  y0: number,
  width: number,
  height: number,
): void {
  for (let x = x0; x < x0 + width; x++) {
    for (let y = y0; y < y0 + height; y++) {
      player.conquer(game.ref(x, y));
    }
  }
}

/** A finished research institute / admin office at `level` (build it before adding gold: building costs gold). */
export function buildLevel(
  game: Game,
  player: Player,
  type: UnitType.ResearchInstitute | UnitType.AdminOffice,
  x: number,
  y: number,
  level: number,
): Unit {
  const unit = player.buildUnit(type, game.ref(x, y), {});
  for (let l = 1; l < level; l++) unit.increaseLevel();
  return unit;
}

/**
 * Government tier 3 (spec §6.1): 8,000 cumulative political power. Phase 2
 * raises the stored tier in the per-second processing (refreshGovernmentTier
 * after addYield), so the helper takes that step itself instead of waiting
 * for a domestic second.
 */
export function reachGovernmentTier3(player: Player): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  d.addYield(0, GOVERNMENT_TIER_THRESHOLDS[2] * MILLI);
  d.refreshGovernmentTier();
}
