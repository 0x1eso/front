import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import type { FactionKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_GAME_MINUTES } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  CampScore,
  campScores,
  CountryScoreInput,
  lastCampStanding,
} from "@openfront/engine-lib/ww1936/Score";
import type { Game, Player } from "../game/Game";
import { controlledVp } from "./Capitulation";
import type { WorldWar } from "./WorldWar";

export interface WorldWarWin {
  winner: Player | FactionKey;
  reason: "ww_score" | "ww_last_camp";
  camp: CampScore;
}

/** Each country's numbers now (spec §7.6). Capitulated countries are not alive. */
export function scoreInputs(mg: Game, ww: WorldWar): CountryScoreInput[] {
  const vp = controlledVp(mg, ww);
  return ww.scenario.countries.map((tag, i) => {
    const id = i + 1;
    const p = mg.playerBySmallID(id);
    const alive = p.isPlayer() && p.isAlive() && !ww.isCapitulated(id);
    return {
      smallID: id,
      // P3 plan decision 8: the faction now (politics' state).
      faction: ww.factionOf(id),
      major: COUNTRIES[tag].major,
      alive,
      vp: vp[id],
      tiles: p.isPlayer() ? p.numTilesOwned() : 0,
    };
  });
}

export function worldWarCamps(mg: Game, ww: WorldWar): CampScore[] {
  return campScores(
    scoreInputs(mg, ww),
    ww.scenario.totalVp(),
    mg.numLandTiles(),
  );
}

/**
 * Spec §7.6: the only camp left with a living major wins at once; at the
 * time limit the best camp wins on score. Null while the game goes on.
 */
export function worldWarVerdict(
  mg: Game,
  ww: WorldWar,
  elapsedSeconds: number,
): WorldWarWin | null {
  const camps = worldWarCamps(mg, ww);
  const last = lastCampStanding(camps);
  if (last !== null) {
    return { winner: campWinner(mg, last), reason: "ww_last_camp", camp: last };
  }
  const minutes = mg.config().maxTimerMinutes() ?? WW_GAME_MINUTES;
  if (elapsedSeconds < minutes * 60) return null;
  const best = camps[0];
  if (best === undefined) return null;
  return { winner: campWinner(mg, best), reason: "ww_score", camp: best };
}

export function checkWorldWarWin(mg: Game, ww: WorldWar): WorldWarWin | null {
  return worldWarVerdict(mg, ww, mg.elapsedGameSeconds());
}

function campWinner(mg: Game, camp: CampScore): Player | FactionKey {
  if (typeof camp.camp !== "number") return camp.camp;
  const p = mg.playerBySmallID(camp.camp);
  if (!p.isPlayer()) throw new Error(`camp ${camp.camp} has no player`);
  return p;
}
