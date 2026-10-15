import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Cosmetics", () => ({
  getPlayerCosmetics: vi.fn(async () => ({})),
  prewarmCosmetics: vi.fn(),
}));

vi.mock("../../src/client/TerrainMapFileLoader", () => ({
  terrainMapFileLoader: { getMapData: vi.fn() },
}));

vi.mock("../../src/client/UserMeBroadcast", () => ({
  lastUserMeResponse: () => null,
}));

// The map picker's cards watch their own visibility; jsdom has no observer.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import "../../src/client/SinglePlayerModal";

/** What the modal shows a guest where the achievements toggle would be. */
function guestBanner(): HTMLElement {
  const modal = document.createElement("single-player-modal") as any;
  document.body.appendChild(modal);
  const root = document.createElement("div");
  render(modal.renderNotLoggedInBanner(), root);
  return root;
}

afterEach(() => {
  delete (window as { BOOTSTRAP_CONFIG?: unknown }).BOOTSTRAP_CONFIG;
  document.body.innerHTML = "";
});

describe("single-player modal sign-in banner", () => {
  it("asks a guest to sign in for achievements", () => {
    expect(guestBanner().querySelector("button")).not.toBeNull();
  });

  it("says nothing on a self-hosted server, which has no accounts", () => {
    (window as { BOOTSTRAP_CONFIG?: unknown }).BOOTSTRAP_CONFIG = {
      selfHosted: true,
    };
    const banner = guestBanner();
    expect(banner.querySelector("button")).toBeNull();
    expect(banner.textContent!.trim()).toBe("");
  });
});
