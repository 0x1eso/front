import type { GameView } from "../../../view";

/**
 * A SAM ring's range by owner smallID: the engine's own Config.samRangeOf
 * (the domestic air-defense law), so rings show where interception happens.
 */
export function samRangeResolver(
  game: Pick<GameView, "config" | "playerBySmallID">,
): (ownerID: number, baseRange: number) => number {
  return (ownerID, baseRange) => {
    const owner = game.playerBySmallID(ownerID);
    return owner.isPlayer()
      ? game.config().samRangeOf(owner, baseRange)
      : baseRange;
  };
}
