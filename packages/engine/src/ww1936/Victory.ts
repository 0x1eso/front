import { FactionId } from "@openfront/engine-api/ww1936/Countries";
import { CampScore } from "@openfront/engine-lib/ww1936/Score";
import type { Game, Player } from "../game/Game";
import type { WorldWar } from "./WorldWar";

// Task 6 fills these (spec §7.6).

export interface WorldWarWin {
  winner: Player | FactionId;
  reason: "ww_score" | "ww_last_camp";
  camp: CampScore;
}

export function worldWarCamps(_mg: Game, _ww: WorldWar): CampScore[] {
  return [];
}

export function worldWarVerdict(
  _mg: Game,
  _ww: WorldWar,
  _elapsedSeconds: number,
): WorldWarWin | null {
  return null;
}

export function checkWorldWarWin(mg: Game, ww: WorldWar): WorldWarWin | null {
  return worldWarVerdict(mg, ww, mg.elapsedGameSeconds());
}
