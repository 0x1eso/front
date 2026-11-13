import { dateOfDay } from "@openfront/engine-lib/ww1936/Calendar";
import {
  isImjin,
  wwEpochDays,
} from "@openfront/engine-lib/ww1936/scenario/Profile";
import type { SavedGameInfo } from "@openfront/shared/ApiSchemas";
import type { GameView } from "../../view/GameView";
import { today } from "../ww1936/WorldWarModel";

// What a save records of the running game (SavedGame.game), and when an
// autosave is due. Read from the views the screens already have: nothing
// here asks the simulation for anything.

const pad = (n: number) => String(n).padStart(2, "0");

/** The mode, my country and the in-game date; null for a plain game. */
export function saveInfoOf(game: GameView): SavedGameInfo | null {
  if (game.isGreatWar?.() === true) {
    const gw = game.greatWarData?.() ?? null;
    const tag = gw?.seats[0]?.tag;
    return {
      mode: "gw1914",
      ...(tag === undefined ? {} : { country: tag }),
      ...(gw === null ? {} : { date: gw.date }),
    };
  }
  const gc = game.config().gameConfig();
  if (gc.worldWar1936 !== true) return null;
  const me = game.myPlayer();
  const tag =
    me === null
      ? null
      : (game.worldWarScenario()?.tagOfSmallId(me.smallID()) ?? null);
  const d = dateOfDay(today(game), wwEpochDays(gc));
  return {
    mode: isImjin(gc) ? "imjin" : "ww1936",
    ...(tag === null ? {} : { country: tag }),
    date: `${d.year}-${pad(d.month)}-${pad(d.day)}`,
  };
}

/**
 * What the autosave watches: it saves when this changes. Great War 1914
 * every chapter; 1936 and the Imjin War every quarter of the in-game year
 * (a month passes in about 23 seconds, too often for a full snapshot).
 * Null when nothing is due: a plain game, or a game that has ended.
 */
export function autosaveMarkOf(game: GameView): string | null {
  if (game.isGreatWar?.() === true) {
    const gw = game.greatWarData?.() ?? null;
    if (gw === null || gw.ended !== null) return null;
    return `gw:${gw.chapter}`;
  }
  if (game.gameOver?.() === true) return null;
  const info = saveInfoOf(game);
  if (info?.date === undefined) return null;
  const [year, month] = info.date.split("-").map(Number);
  return `${info.mode}:${year}:${Math.floor((month - 1) / 3)}`;
}
