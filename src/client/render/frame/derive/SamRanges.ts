import type { GameView } from "../../../view";

/**
 * A SAM ring's range by owner smallID: the engine's own Config.samRangeOf
 * (the domestic air-defense law), so rings show where interception happens.
 */
export function samRangeResolver(
  game: Pick<GameView, "config" | "playerBySmallID">,
): (ownerID: number, baseRange: number) => number {
  return (ownerID, baseRange) => {
    let owner: ReturnType<typeof game.playerBySmallID>;
    try {
      owner = game.playerBySmallID(ownerID);
    } catch {
      // An owner the view doesn't know yet (it throws): don't take the
      // frame down over a ring, draw its base range.
      return baseRange;
    }
    return owner.isPlayer()
      ? game.config().samRangeOf(owner, baseRange)
      : baseRange;
  };
}
