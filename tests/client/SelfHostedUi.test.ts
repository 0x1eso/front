import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientEnv } from "../../src/client/ClientEnv";

vi.mock("../../src/client/LobbySocket", () => ({
  PublicLobbySocket: class {
    start(): void {}
    stop(): void {}
  },
}));

vi.mock("../../src/client/UserMeBroadcast", () => ({
  lastUserMeResponse: () => null,
}));

import "../../src/client/components/DesktopNavBar";
import "../../src/client/components/MobileNavBar";
import "../../src/client/components/PlayPage";
import "../../src/client/components/SteamWishlistButton";
// Registers <game-mode-selector> as a side effect.
import "../../src/client/GameModeSelector";
// PlayPage embeds <username-input>, which GameModeSelector queries on connect.
import "../../src/client/UsernameInput";

// jsdom has no ResizeObserver, and the mobile top bar shares a subtree with
// <steam-wishlist>, which constructs one on first update.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

type Mountable = HTMLElement & {
  updateComplete: Promise<unknown>;
  requestUpdate(): void;
};

async function mount(tag: string): Promise<Mountable> {
  const el = document.createElement(tag) as Mountable;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function boot(selfHosted: boolean) {
  window.BOOTSTRAP_CONFIG = {
    gameEnv: "dev",
    numWorkers: 1,
    turnstileSiteKey: "",
    jwtAudience: "test",
    instanceId: "test",
    gitCommit: "test",
    ...(selfHosted ? { selfHosted: true } : {}),
  };
  ClientEnv.reset();
}

afterEach(() => {
  document.body.innerHTML = "";
  window.BOOTSTRAP_CONFIG = undefined;
  ClientEnv.reset();
});

describe("what a self-hosted page hides", () => {
  it("styles.css hides .no-self-host under html.self-hosted", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "../../src/client/styles.css"),
      "utf8",
    );
    expect(css).toMatch(
      /html\.self-hosted \.no-self-host\s*\{\s*display:\s*none !important;\s*\}/,
    );
  });

  it.each(["desktop-nav-bar", "mobile-nav-bar"])(
    "%s marks the pages that need the account API",
    async (tag) => {
      boot(true);
      const bar = await mount(tag);
      for (const page of [
        "page-item-store",
        "page-inventory",
        "page-leaderboard",
        "page-clan",
      ]) {
        expect(
          bar.querySelector(`[data-page="${page}"]`)?.closest(".no-self-host"),
          page,
        ).not.toBeNull();
      }
    },
  );

  it("keeps the way home: the wordmark in the desktop bar", async () => {
    boot(true);
    const bar = await mount("desktop-nav-bar");
    const home = bar.querySelector('[data-page="page-play"]');
    expect(home?.querySelector("game-wordmark")).not.toBeNull();
    expect(home?.closest(".no-self-host")).toBeNull();
  });

  it("hides the news bell (upstream's changelog) but keeps help and settings", async () => {
    boot(true);
    const icons = await mount("nav-utility-icons");
    expect(
      icons.querySelector('[data-page="page-news"]')?.closest(".no-self-host"),
    ).not.toBeNull();
    for (const page of ["page-help", "page-settings"]) {
      expect(
        icons.querySelector(`[data-page="${page}"]`)?.closest(".no-self-host"),
        page,
      ).toBeNull();
    }
  });

  it("hides the menu button, whose every item needs the account API", async () => {
    boot(true);
    const page = await mount("play-page");
    expect(
      page.querySelector("#hamburger-btn")?.classList.contains("no-self-host"),
    ).toBe(true);
  });

  it("offers no clan tag, and does not send one stored before", async () => {
    type Input = Mountable & { getClanTag(): string | null };
    try {
      // Control: off a self-hosted server the stored tag is picked up.
      localStorage.setItem("username", "Friend");
      localStorage.setItem("clanTag", "WOLF");
      boot(false);
      const upstream = (await mount("username-input")) as Input;
      expect(upstream.querySelector("#clan-tag-button")).not.toBeNull();
      expect(upstream.getClanTag()).toBe("WOLF");
      upstream.remove();

      localStorage.setItem("clanTag", "WOLF");
      boot(true);
      const input = (await mount("username-input")) as Input;
      expect(input.querySelector("#clan-tag-button")).toBeNull();
      expect(input.getClanTag()).toBeNull();
    } finally {
      localStorage.removeItem("username");
      localStorage.removeItem("clanTag");
    }
  });

  // Ranked needs OpenFront's API, but this fork's home menu has no Ranked
  // button on any page: it is Solo, Create and Join.
  it.each([true, false])(
    "offers no Ranked button, and keeps Create and Join (self-hosted: %s)",
    async (selfHosted) => {
      boot(selfHosted);
      const selector = await mount("game-mode-selector");
      expect(selector.textContent).not.toContain("mode_selector.ranked_title");
      expect(selector.textContent).toContain("main.create");
      expect(selector.textContent).toContain("main.join");
    },
  );

  it("shows no Steam promo", async () => {
    boot(true);
    const promo = await mount("steam-wishlist-button");
    expect(promo.querySelector("a")).toBeNull();
    boot(false);
    promo.requestUpdate();
    await promo.updateComplete;
    expect(promo.querySelector("a")).not.toBeNull();
  });
});
