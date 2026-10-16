import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { StockpiledNuke } from "@openfront/engine-api/strategic/StrategicTypes";
import { LineFactory } from "@openfront/engine-lib/strategic/Strategic";
import type { Game, Player } from "../game/Game";
import type { PlayerStrategic } from "./PlayerStrategic";

const NUKE_KEYS: Readonly<Record<StockpiledNuke, string>> = {
  [UnitType.AtomBomb]: "unit_type.atom_bomb",
  [UnitType.HydrogenBomb]: "unit_type.hydrogen_bomb",
  [UnitType.MIRV]: "unit_type.mirv",
};

/** The player's finished factories: one production line per level. */
export function finishedFactories(player: Player): LineFactory[] {
  return player
    .units(UnitType.Factory)
    .filter((f) => f.isActive() && !f.isUnderConstruction())
    .map((f) => ({ id: f.id(), level: f.level() }));
}

/** Everyone hears that `player`'s nuclear program was stopped (spec §4). */
export function announceProductionLost(mg: Game, player: Player): void {
  mg.displayMessage(
    "events_display.nuke_production_lost",
    MessageType.UNIT_DESTROYED,
    null,
    undefined,
    { name: player.displayName() },
    undefined,
    player.id(),
  );
}

/**
 * One tick of a player's factory lines (spec §4): lines whose factory is
 * gone or has a new owner are lost, unpaid back; finished nukes join the
 * stockpile.
 */
export function processProduction(
  mg: Game,
  player: Player,
  s: PlayerStrategic,
  now: number,
): void {
  const lost = s.dropJobs((job) => {
    const factory = mg.unit(job.factoryId);
    return (
      factory === undefined || !factory.isActive() || factory.owner() !== player
    );
  });
  if (lost > 0) announceProductionLost(mg, player);
  for (const job of s.finishJobs(now)) {
    mg.displayMessage(
      "events_display.nuke_production_done",
      MessageType.RESEARCH_COMPLETE,
      player.id(),
      undefined,
      { unit: NUKE_KEYS[job.type] },
      job.factoryId,
    );
  }
}
