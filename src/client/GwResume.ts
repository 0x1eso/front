import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { SnapshotHeader } from "@openfront/engine-api/game/SnapshotHeader";
import type { GwResumeInfo } from "@openfront/shared/WireSchemas";
import { getPlayToken } from "./Auth";
import { ClientEnv } from "./ClientEnv";
import { downloadSavedGame, listSavedGames } from "./SavedGamesApi";
import { ensureServerList } from "./ServerList";

/** A friends' save the host can bring back; `key` names why it can't, if so. */
export type GwResumeResult =
  | { ok: true; info: GwResumeInfo; calendar: string; timer?: number }
  | { ok: false; key: string };

/** Saves in this browser or on this account, for the resume list. */
export const gwSaves = listSavedGames;

/**
 * Host's resume: reads the save (on a worker of its own: this page can't load
 * the engine) and hands its bytes to the lobby. The server keeps them for the
 * start message; every client restores them.
 */
export async function resumeInLobby(
  gameID: string,
  saveID: string,
): Promise<GwResumeResult> {
  const snapshot = await downloadSavedGame(saveID, false);
  if (typeof snapshot === "string") {
    return { ok: false, key: "gw.lobby.resume_failed" };
  }
  const { readSnapshotHeader } = await import("./WorkerClient");
  let header: SnapshotHeader;
  try {
    header = await readSnapshotHeader(snapshot);
  } catch (err) {
    console.warn("Not a snapshot this build reads", err);
    return { ok: false, key: "saved_games.error.unreadable" };
  }
  const gw = header.greatWar;
  if (
    gw === undefined ||
    header.gameConfig.gameType === GameType.Singleplayer
  ) {
    return { ok: false, key: "gw.lobby.resume_not_friends" };
  }
  const calendar = header.gameConfig.greatWar1914Calendar ?? "y1914";
  const timer = header.gameConfig.greatWar1914TimerSec;
  const query = new URLSearchParams({
    seats: gw.seats.join(","),
    chapter: String(gw.chapter),
    date: gw.date,
    calendar,
    ...(timer === undefined ? {} : { timer: String(timer) }),
  });
  try {
    await ensureServerList();
    const token = await getPlayToken();
    const res = await fetch(
      `${ClientEnv.gameHttpBase(gameID)}/${ClientEnv.gameWorkerPath(gameID)}/api/game/${gameID}/gw_resume?${query}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          Authorization: `Bearer ${token}`,
        },
        body: snapshot as BodyInit,
      },
    );
    if (!res.ok) return { ok: false, key: "gw.lobby.resume_failed" };
  } catch (e) {
    console.error("resumeInLobby: upload failed", e);
    return { ok: false, key: "gw.lobby.resume_failed" };
  }
  return {
    ok: true,
    info: { seats: gw.seats, chapter: gw.chapter, date: gw.date },
    calendar,
    timer,
  };
}
