import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { requiredTech } from "@openfront/engine-lib/domestic/Locks";
import { translateText } from "../../Utils";

/** "🔒 <tech>": a locked unit's label on its button (hotbar, radial menu). */
export function lockedBadge(type: UnitType): string {
  const tech = requiredTech(type);
  return `🔒 ${tech === null ? "" : translateText(`domestic.tech.${tech}.name`)}`;
}

/** "Requires <tech>" for a unit that a domestic-mode tech still locks. */
export function lockedReason(type: UnitType): string {
  const tech = requiredTech(type);
  return translateText("domestic.locked_requires", {
    tech: tech === null ? "" : translateText(`domestic.tech.${tech}.name`),
  });
}
