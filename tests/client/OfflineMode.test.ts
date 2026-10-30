import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientEnv } from "../../src/client/ClientEnv";

const lobbySocket = vi.hoisted(() => ({ starts: 0, stops: 0 }));
vi.mock("../../src/client/LobbySocket", () => ({
  PublicLobbySocket: class {
    start(): void {
      lobbySocket.starts++;
    }
    stop(): void {
      lobbySocket.stops++;
    }
  },
}));

vi.mock("../../src/client/UserMeBroadcast", () => ({
  lastUserMeResponse: () => null,
}));

const toasts = vi.hoisted(() => [] as string[]);
vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  showToast: (message: string) => toasts.push(message),
}));

import "../../src/client/components/OfflineBanner";
import "../../src/client/components/PlayPage";
// Registers <game-mode-selector> as a side effect.
import { OFFLINE_META } from "@openfront/shared/ServiceWorkerRules";
import "../../src/client/GameModeSelector";
import {
  isOffline,
  probeServer,
  setOffline,
  startsOffline,
} from "../../src/client/pwa/OfflineState";
// PlayPage embeds <username-input>, which GameModeSelector queries on connect.
import "../../src/client/UsernameInput";

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

async function settle(el: Mountable) {
  await el.updateComplete;
  await Promise.resolve();
  await el.updateComplete;
}

beforeEach(() => {
  window.BOOTSTRAP_CONFIG = {
    gameEnv: "dev",
    numWorkers: 1,
    turnstileSiteKey: "",
    jwtAudience: "test",
    instanceId: "test",
    gitCommit: "test",
    selfHosted: true,
  };
  ClientEnv.reset();
  lobbySocket.starts = 0;
  lobbySocket.stops = 0;
  toasts.length = 0;
});

afterEach(() => {
  setOffline(false);
  document.body.innerHTML = "";
  document.head.querySelectorAll("meta").forEach((m) => m.remove());
  window.BOOTSTRAP_CONFIG = undefined;
  ClientEnv.reset();
});

describe("knowing the page is offline", () => {
  it("starts offline with no network, or when the worker served its copy", () => {
    expect(startsOffline(document, false)).toBe(true);
    expect(startsOffline(document, true)).toBe(false);
    const meta = document.createElement("meta");
    meta.name = OFFLINE_META;
    meta.content = "1";
    document.head.appendChild(meta);
    expect(startsOffline(document, true)).toBe(true);
  });

  it("keeps the state on <html> and announces changes", () => {
    const seen: boolean[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent).detail);
    document.addEventListener("offline-change", listener);
    setOffline(true);
    setOffline(true);
    expect(document.documentElement.classList.contains("offline")).toBe(true);
    expect(isOffline()).toBe(true);
    setOffline(false);
    expect(isOffline()).toBe(false);
    expect(seen).toEqual([true, false]);
    document.removeEventListener("offline-change", listener);
  });

  it("asks the server itself whether it is back", async () => {
    const answer = (status: number) =>
      (async () => new Response(null, { status })) as unknown as typeof fetch;
    expect(await probeServer(answer(200))).toBe(true);
    // A proxy's "the server behind me is down".
    expect(await probeServer(answer(530))).toBe(false);
    expect(await probeServer(answer(502))).toBe(false);
    const unreachable = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await probeServer(unreachable)).toBe(false);
  });
});

describe("what the menu shows offline", () => {
  it("styles.css hides what needs the API, and .no-offline, under html.offline", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "../../src/client/styles.css"),
      "utf8",
    );
    expect(css).toMatch(
      /html\.offline \.no-self-host,\s*html\.offline \.no-offline\s*\{\s*display:\s*none !important;\s*\}/,
    );
  });

  it("the banner says solo only, and only while offline", async () => {
    const banner = await mount("offline-banner");
    expect(banner.textContent?.trim()).toBe("");
    setOffline(true);
    await settle(banner);
    expect(banner.textContent).toContain("pwa.offline_banner");
    expect(banner.querySelector("[role=status]")).not.toBeNull();
    setOffline(false);
    await settle(banner);
    expect(banner.textContent?.trim()).toBe("");
  });

  it("the play page carries the banner above the menu", async () => {
    const page = await mount("play-page");
    expect(page.querySelector("offline-banner")).not.toBeNull();
  });

  it("the account controls are the ones the API needs", async () => {
    // Hidden by the html.offline rule above; this checks they carry the class.
    const page = await mount("play-page");
    expect(
      page
        .querySelector("nav-account-menu")
        ?.classList.contains("no-self-host"),
    ).toBe(true);
  });

  function actions(selector: HTMLElement) {
    const buttons = [...selector.querySelectorAll("button")];
    const find = (key: string) =>
      buttons.find((b) => b.textContent?.includes(key))!;
    return {
      solo: find("main.solo"),
      create: find("main.create"),
      join: find("main.join"),
    };
  }

  it("Create and Join are off with the reason, Solo is not", async () => {
    setOffline(true);
    const selector = await mount("game-mode-selector");
    const { solo, create, join } = actions(selector);
    for (const button of [create, join]) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.title).toBe("pwa.offline_banner");
      expect(button.classList.contains("atlas-action-blocked")).toBe(true);
    }
    expect(solo.getAttribute("aria-disabled")).toBe("false");
    expect(solo.title).toBe("");
  });

  it("a click on Create offline says why instead of opening a lobby", async () => {
    setOffline(true);
    const selector = await mount("game-mode-selector");
    actions(selector).create.click();
    actions(selector).join.click();
    expect(toasts).toEqual(["pwa.offline_banner", "pwa.offline_banner"]);
  });

  it("drops the room list and never dials the lobby feed", async () => {
    setOffline(true);
    const selector = await mount("game-mode-selector");
    expect(selector.querySelector("open-rooms-list")).toBeNull();
    expect(lobbySocket.starts).toBe(0);
  });

  it("brings both back when the network returns", async () => {
    setOffline(true);
    const selector = await mount("game-mode-selector");
    setOffline(false);
    await settle(selector);
    expect(selector.querySelector("open-rooms-list")).not.toBeNull();
    expect(lobbySocket.starts).toBe(1);
    const { create } = actions(selector);
    expect(create.getAttribute("aria-disabled")).toBe("false");
    // And closes the feed again when it goes.
    setOffline(true);
    await settle(selector);
    expect(lobbySocket.stops).toBeGreaterThan(0);
    expect(selector.querySelector("open-rooms-list")).toBeNull();
  });

  it("online, nothing changes: the feed opens and the room list shows", async () => {
    const selector = await mount("game-mode-selector");
    expect(lobbySocket.starts).toBe(1);
    expect(selector.querySelector("open-rooms-list")).not.toBeNull();
    expect(actions(selector).create.getAttribute("aria-disabled")).toBe(
      "false",
    );
  });
});
