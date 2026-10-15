import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { requiredTech } from "@openfront/engine-lib/domestic/Locks";
import { translateText } from "../../Utils";

/** "Requires <tech>" for a unit that a domestic-mode tech still locks. */
export function lockedReason(type: UnitType): string {
  const tech = requiredTech(type);
  return translateText("domestic.locked_requires", {
    tech: tech === null ? "" : translateText(`domestic.tech.${tech}.name`),
  });
}
