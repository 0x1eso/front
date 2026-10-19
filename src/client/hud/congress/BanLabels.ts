import { CongressData } from "@openfront/engine-api/congress/CongressTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { resolutionBans } from "@openfront/engine-lib/congress/ResolutionEffects";
import { translateText } from "../../Utils";

/** "🏛 Banned": a banned unit's label on its button (hotbar, radial menu). */
export function bannedBadge(): string {
  return translateText("congress.banned");
}

/** Why a banned unit can't be built: a resolution in force. */
export function bannedReason(): string {
  return translateText("congress.banned_reason");
}

/** Strategic weapons: a resolution stops new production of `type` at my factories (firing from stock never is). */
export function productionBanned(
  data: CongressData | null,
  smallID: number,
  type: UnitType,
): boolean {
  return data !== null && resolutionBans(data.active, smallID, type);
}
