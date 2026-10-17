// @vitest-environment jsdom
import { GameMapType, GameMode } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type {
  PublicGameInfo,
  PublicGames,
} from "@openfront/shared/WireSchemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientEnv } from "../src/client/ClientEnv";
import type { DesktopUpdateState } from "../src/client/DesktopShell";

// The component opens a public-lobby WebSocket the moment it connects. jsdom
// has no WebSocket worth talking to and this test is about the gate, not the
// lobby list, so the socket is a no-op -- except for retaining the update
// callback the real socket would drive off the wire, so a snapshot can be
// pushed in (the home menu below).
const { lobbiesCallbackRef } = vi.hoisted(() => ({
  lobbiesCallbackRef: { current: null as ((g: PublicGames) => void) | null },
}));

vi.mock("../src/client/LobbySocket", () => ({
  PublicLobbySocket: class {
    constructor(onUpdate: (g: PublicGames) => void) {
      lobbiesCallbackRef.current = onUpdate;
    }
    start(): void {}
    stop(): void {}
  },
}));

// The lobby modals load on demand; the stubs below stand in for loaded ones.
vi.mock("../src/client/LazyModals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/client/LazyModals")>()),
  whenModalLoaded: (_tag: string, open: () => void) => open(),
}));

// Registers <game-mode-selector> as a side effect.
import "../src/client/GameModeSelector";

function publicLobby(gameID: string): PublicGameInfo {
  return {
    gameID,
    numClients: 3,
    publicGameType: "ffa",
    gameConfig: {
      gameMap: GameMapType.World,
      gameMode: GameMode.FFA,
      maxPlayers: 8,
    } as unknown as GameConfig,
  };
}

/**
 * The pure predicate is covered in GameModeSelectorGating.test.ts. What that
 * cannot see is whether the predicate is actually CONSULTED at each entry
 * point -- a call site that forgets to ask still passes every unit test while
 * letting a stale client into a multiplayer game. So this mounts the real
 * component, drives it into a gated state through the real
 * `desktop-update-state` event the shell bridge dispatches, clicks the real
 * buttons, and asserts nothing proceeded.
 */
let selector: HTMLElement & { updateComplete: Promise<unknown> };
let joinOpen: ReturnType<typeof vi.fn>;
let hostOpen: ReturnType<typeof vi.fn>;
let wiggle: ReturnType<typeof vi.fn>;

function stub(tag: string, methods: Record<string, unknown>): void {
  const el = document.createElement(tag);
  Object.assign(el, methods);
  document.body.appendChild(el);
}

async function setUpdateState(state: DesktopUpdateState | null): Promise<void> {
  if (state !== null) {
    document.dispatchEvent(
      new CustomEvent("desktop-update-state", { detail: state }),
    );
  }
  await selector.updateComplete;
}

/** Clicks every button the selector renders. Returns how many it clicked. */
function clickEveryButton(): number {
  const buttons = Array.from(selector.querySelectorAll("button"));
  for (const button of buttons) button.click();
  return buttons.length;
}

/**
 * Pushes a full lobby snapshot through the (mocked) socket's own update
 * callback, exactly as the real PublicLobbySocket would on receiving a "full"
 * message -- the only way `lobbies` leaves `null`.
 */
async function pushLobbies(games: PublicGames["games"]): Promise<void> {
  lobbiesCallbackRef.current?.({ serverTime: Date.now(), games });
  await selector.updateComplete;
}

async function setUsernameValid(isValid: boolean): Promise<void> {
  window.dispatchEvent(
    new CustomEvent("username-validity-change", { detail: { isValid } }),
  );
  await selector.updateComplete;
}

beforeEach(async () => {
  // connectedCallback reads ClientEnv.gameCreationRate(), which throws without
  // the config the server normally injects into index.html.
  window.BOOTSTRAP_CONFIG = {
    gameEnv: "dev",
    numWorkers: 1,
    turnstileSiteKey: "",
    jwtAudience: "test",
    instanceId: "test",
    gitCommit: "test",
  };
  ClientEnv.reset();

  joinOpen = vi.fn();
  hostOpen = vi.fn();
  wiggle = vi.fn();
  stub("join-lobby-modal", { open: joinOpen });
  stub("host-lobby-modal", { open: hostOpen });
  stub("single-player-modal", { open: vi.fn() });
  stub("desktop-status-bar", { wiggle });
  (window as { showPage?: (id: string) => void }).showPage = vi.fn();

  lobbiesCallbackRef.current = null;
  selector = document.createElement("game-mode-selector") as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  document.body.appendChild(selector);
  await selector.updateComplete;
});

afterEach(() => {
  document.body.innerHTML = "";
  window.BOOTSTRAP_CONFIG = undefined;
  ClientEnv.reset();
  vi.restoreAllMocks();
});

describe("the multiplayer gate at its real call sites", () => {
  it("mounts and, ungated, the multiplayer entry points do proceed", async () => {
    await setUpdateState({ status: "current", bytes: 0, total: 0 });

    expect(clickEveryButton()).toBeGreaterThan(0);

    // Establishes the control: these are genuinely reachable, so the
    // assertions below are about the gate and not about a broken mount.
    expect(joinOpen).toHaveBeenCalled();
    expect(hostOpen).toHaveBeenCalled();
    expect(wiggle).not.toHaveBeenCalled();
  });

  it("refuses every multiplayer entry point while an update is downloading", async () => {
    await setUpdateState({ status: "downloading", bytes: 1, total: 100 });

    clickEveryButton();

    expect(joinOpen).not.toHaveBeenCalled();
    expect(hostOpen).not.toHaveBeenCalled();
    // Refusing silently would look like a broken button; the click has to land
    // somewhere, and it lands on the snackbar.
    expect(wiggle).toHaveBeenCalled();
  });

  it("refuses while an update is staged, and marks the buttons aria-disabled", async () => {
    await setUpdateState({ status: "staged", bytes: 100, total: 100 });

    expect(
      selector.querySelectorAll('button[aria-disabled="true"]').length,
    ).toBeGreaterThan(0);

    clickEveryButton();

    expect(joinOpen).not.toHaveBeenCalled();
    expect(hostOpen).not.toHaveBeenCalled();
  });

  it("does not refuse on a failure the player cannot retry away", async () => {
    await setUpdateState({
      status: "failed",
      bytes: 0,
      total: 0,
      error: { kind: "refused", message: "403 from the WAF" },
    });

    clickEveryButton();

    expect(joinOpen).toHaveBeenCalled();
    expect(hostOpen).toHaveBeenCalled();
  });

  it("does refuse on a network failure, where Retry is a real remedy", async () => {
    await setUpdateState({
      status: "failed",
      bytes: 0,
      total: 0,
      error: { kind: "network", message: "offline" },
    });

    clickEveryButton();

    expect(joinOpen).not.toHaveBeenCalled();
    expect(hostOpen).not.toHaveBeenCalled();
  });

  it("does refuse on a hash-verification failure, which Retry can also fix", async () => {
    // Newly gating: the descriptor parsed, so we KNOW a newer version exists,
    // and the CDN bytes not matching it is something Retry can genuinely
    // resolve. Asserted here and not only against the pure predicate, so the
    // real call sites are covered for this kind too.
    await setUpdateState({
      status: "failed",
      bytes: 0,
      total: 0,
      error: { kind: "verify", message: "sha256 mismatch" },
    });

    clickEveryButton();

    expect(joinOpen).not.toHaveBeenCalled();
    expect(hostOpen).not.toHaveBeenCalled();
  });

  it("does not refuse on a malformed descriptor, which Retry cannot fix", async () => {
    await setUpdateState({
      status: "failed",
      bytes: 0,
      total: 0,
      error: { kind: "parse", message: "unsupported schemaVersion" },
    });

    clickEveryButton();

    expect(joinOpen).toHaveBeenCalled();
    expect(hostOpen).toHaveBeenCalled();
  });

  it("never gates the single-player card", async () => {
    const solo = vi.fn();
    (
      document.querySelector("single-player-modal") as HTMLElement & {
        open: unknown;
      }
    ).open = solo;

    await setUpdateState({ status: "downloading", bytes: 1, total: 100 });
    clickEveryButton();

    expect(solo).toHaveBeenCalled();
  });
});

/**
 * This fork's homepage is just Solo, Create and Join (it is played among
 * friends): no public-lobby cards, no upcoming column linking to the lobby
 * browser, no Ranked or tutorial card. The feed still runs -- it carries the
 * update prompt and the count of rooms other players host -- so a snapshot
 * full of lobbies must still leave the three actions alone.
 */
describe("the home menu", () => {
  const labels = () =>
    Array.from(selector.querySelectorAll("button")).map((b) =>
      b.textContent?.replace(/\s+/g, " ").trim(),
    );

  it("offers exactly Solo, Create and Join, before and after a snapshot", async () => {
    expect(labels()).toEqual(["main.solo", "main.create", "main.join"]);

    await pushLobbies({
      ffa: [publicLobby("ffa-1")],
      team: [publicLobby("team-1")],
      special: [publicLobby("special-1")],
    });

    expect(labels()).toEqual(["main.solo", "main.create", "main.join"]);
    // The only section is the friends' open-room list (spec: open rooms);
    // server-made public matchmaking games are never shown.
    const sections = Array.from(selector.querySelectorAll("section"));
    expect(sections.map((el) => el.className)).toEqual(["atlas-rooms"]);
    expect(selector.textContent).not.toContain("public_lobby.upcoming");
    expect(selector.textContent).not.toContain("ffa-1");
  });

  it("counts the rooms other players host on the Join button", async () => {
    const badge = () => selector.querySelector(".atlas-action-badge");
    expect(badge()).toBeNull();

    await pushLobbies({
      ffa: [publicLobby("ffa-1")],
      hosted: [publicLobby("room-1"), publicLobby("room-2")],
    });

    expect(badge()?.textContent).toBe("2");
    expect(badge()?.closest("button")?.textContent).toContain("main.join");
  });

  it("disables all three while the username is invalid", async () => {
    await setUsernameValid(false);
    const buttons = Array.from(selector.querySelectorAll("button"));
    expect(buttons).toHaveLength(3);
    expect(buttons.every((b) => b.disabled)).toBe(true);

    await setUsernameValid(true);
    expect(
      Array.from(selector.querySelectorAll("button")).every((b) => !b.disabled),
    ).toBe(true);
  });
});
