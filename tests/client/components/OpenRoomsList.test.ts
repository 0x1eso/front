import type { PublicGameInfo } from "@openfront/shared/WireSchemas";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", () => ({
  translateText: (key: string) => key,
  getMapName: (m: string) => `map:${m}`,
}));

import "../../../src/client/components/OpenRoomsList";
import type { OpenRoomsList } from "../../../src/client/components/OpenRoomsList";

function room(over: Partial<PublicGameInfo> & { gameID: string }) {
  return {
    numClients: 2,
    publicGameType: "hosted",
    hostName: "Hana",
    gameConfig: { gameMap: "World", maxPlayers: 8 },
    ...over,
  } as PublicGameInfo;
}

async function mount(rooms: PublicGameInfo[], loaded = true) {
  const el = document.createElement("open-rooms-list") as OpenRoomsList;
  el.rooms = rooms;
  el.loaded = loaded;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe("open-rooms-list", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders host, map, count / max and mode chips", async () => {
    const el = await mount([
      room({
        gameID: "aaaa1111",
        numClients: 3,
        gameConfig: {
          gameMap: "World",
          maxPlayers: 8,
          domesticMode: true,
          strategicWeapons: true,
        } as any,
      }),
      room({ gameID: "bbbb2222", hostName: "Min" }),
    ]);
    const rows = el.querySelectorAll(".atlas-room");
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector(".atlas-room-host")!.textContent).toBe("Hana");
    expect(rows[0].querySelector(".atlas-room-map")!.textContent).toBe(
      "map:World",
    );
    expect(rows[0].querySelector(".atlas-room-players")!.textContent).toBe(
      "3 / 8",
    );
    const chips = [...rows[0].querySelectorAll(".atlas-chip")].map(
      (c) => c.textContent,
    );
    expect(chips).toEqual(["open_rooms.domestic", "open_rooms.strategic"]);
    expect(rows[1].querySelectorAll(".atlas-chip")).toHaveLength(0);
  });

  it("emits open-room-join with the game id when 참가 is tapped", async () => {
    const el = await mount([room({ gameID: "aaaa1111" })]);
    const handler = vi.fn();
    el.addEventListener("open-room-join", (e) =>
      handler((e as CustomEvent).detail),
    );
    el.querySelector<HTMLButtonElement>(".atlas-room-join")!.click();
    expect(handler).toHaveBeenCalledWith({ gameID: "aaaa1111" });
  });

  it("shows the empty state once loaded, nothing while loading", async () => {
    const empty = await mount([]);
    expect(empty.querySelector(".atlas-rooms-empty")!.textContent).toContain(
      "open_rooms.empty",
    );
    document.body.innerHTML = "";
    const loading = await mount([], false);
    expect(loading.querySelector(".atlas-rooms-empty")).toBeNull();
  });
});
