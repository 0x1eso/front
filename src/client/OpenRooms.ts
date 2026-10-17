import { getPlayToken } from "./Auth";
import { ClientEnv } from "./ClientEnv";
import { ensureServerList } from "./ServerList";

// POST /api/game/:id/open_room on the game server (worker): the host of a
// self-hosted lobby shows or hides it in the homepage's open-rooms list.
// Creator-only; server-authoritative.
export async function setOpenRoom(
  gameID: string,
  open: boolean,
): Promise<{ ok: true; open: boolean } | { ok: false }> {
  try {
    await ensureServerList();
    const token = await getPlayToken();
    const response = await fetch(
      `${ClientEnv.gameHttpBase(gameID)}/${ClientEnv.gameWorkerPath(gameID)}/api/game/${gameID}/open_room`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ open }),
      },
    );
    if (!response.ok) return { ok: false };
    const body = await response.json().catch(() => null);
    return {
      ok: true,
      open: typeof body?.open === "boolean" ? body.open : open,
    };
  } catch (e) {
    console.error("setOpenRoom: request failed", e);
    return { ok: false };
  }
}
