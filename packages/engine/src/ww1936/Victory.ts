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

/**
 * Each country's numbers now (spec §7.6). Capitulated countries are not
 * alive; P5: an exile is (it plays on, spec §1.4), a dormant slot is not a
 * line at all (P5 spec §16.1).
 */
export function scoreInputs(mg: Game, ww: WorldWar): CountryScoreInput[] {
  const vp = controlledVp(mg, ww);
  const out: CountryScoreInput[] = [];
  ww.scenario.countries.forEach((tag, i) => {
    const id = i + 1;
    if (ww.endgame.countryState(id) === "dormant") return;
    const p = mg.playerBySmallID(id);
    const alive = ww.isActor(id);
    // P5 spec §16.1: a subject without a faction of its own counts in its overlord's.
    const own = ww.factionOf(id);
    const overlord = ww.endgame.subjectOf(id)?.overlord ?? 0;
    const faction = own ?? (overlord > 0 ? ww.factionOf(overlord) : null);
    out.push({
      smallID: id,
      // P3 plan decision 8: the faction now (politics' state).
      faction,
      major: COUNTRIES[tag].major,
      alive,
      vp: vp[id],
      tiles: p.isPlayer() ? p.numTilesOwned() : 0,
    });
  });
  return out;
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
 * time limit the best camp wins on score (the unlimited game has none).
 * Null while the game goes on.
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
  // The unlimited game has no time limit: it ends only by conquest.
  if (mg.config().wwUnlimited()) return null;
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
