import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/DesktopPresence", () => ({
  desktopPresence: {
    isAvailable: vi.fn(() => false),
    openInviteDialog: vi.fn(async () => true),
    set: vi.fn(),
    consumePendingInvite: vi.fn(async () => null),
    subscribeInvites: vi.fn(() => () => undefined),
  },
}));

import { GameMode } from "@openfront/engine-api/game/GameTypes";
import { HostLobbyModal } from "../../src/client/HostLobbyModal";

describe("HostLobbyModal sends congress only for domestic + congress + FFA", () => {
  async function sent(modal: any): Promise<unknown> {
    modal.constructUrl = vi.fn(async () => "http://localhost/");
    modal.updateLobbyHistory = vi.fn();
    let config: any;
    modal.addEventListener("update-game-config", (e: CustomEvent) => {
      config = e.detail.config;
    });
    await modal.putGameConfig();
    return config.congress;
  }

  function host(): any {
    const modal = new HostLobbyModal() as any;
    modal.lobbyId = "ABCD1234";
    modal.domesticMode = true;
    modal.congress = true;
    modal.gameMode = GameMode.FFA;
    return modal;
  }

  it("is true for domestic + congress + FFA", async () => {
    expect(await sent(host())).toBe(true);
  });

  it("is false after switching to Team", async () => {
    const modal = host();
    modal.gameMode = GameMode.Team;
    expect(await sent(modal)).toBe(false);
  });

  it("is false after turning domestic mode off", async () => {
    const modal = host();
    modal.domesticMode = false;
    expect(await sent(modal)).toBe(false);
  });

  it("is false when the congress toggle is off", async () => {
    const modal = host();
    modal.congress = false;
    expect(await sent(modal)).toBe(false);
  });
});
