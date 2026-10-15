import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiBase } from "../../src/client/ApiBase";
import { getPlayToken, userAuth } from "../../src/client/Auth";
import { ClientEnv } from "../../src/client/ClientEnv";
import {
  backendReachable,
  backendUnreachableConfirmed,
  ensureServerList,
  resetServerList,
  startServerListPolling,
} from "../../src/client/ServerList";

const GUEST_ID = "11111111-1111-4111-8111-111111111111";
// Written by the client, and removed only by clearLocalSession().
const PERSISTENT_ID_KEY = "player_persistent_id";

// The page a game server renders: its own one-entry map and letter.
function boot(selfHosted: boolean) {
  window.BOOTSTRAP_CONFIG = {
    gameEnv: "prod",
    cluster: { a: { host: "play.example.com", numWorkers: 2 } },
    instanceLetter: "a",
    turnstileSiteKey: "",
    jwtAudience: "play.example.com",
    instanceId: "test",
    gitCommit: "abc",
    ...(selfHosted ? { selfHosted: true } : {}),
  };
  ClientEnv.reset();
  resetServerList();
}

afterEach(() => {
  resetServerList();
  window.BOOTSTRAP_CONFIG = undefined;
  ClientEnv.reset();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a self-hosted page's API traffic", () => {
  it("sends API calls to this server's stub", () => {
    boot(true);
    const stub = `${window.location.origin}/selfhost-api`;
    expect(getApiBase()).toBe(stub);
    expect(ClientEnv.jwtIssuer()).toBe(stub);
  });

  it("control: a page that is not self-hosted still uses api.<domain>", () => {
    boot(false);
    expect(getApiBase()).toBe("https://api.play.example.com");
  });

  it("never asks an API for the server list", async () => {
    boot(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    startServerListPolling();
    expect(await ensureServerList()).toBe("fallback");
    expect(await ensureServerList()).toBe("fallback");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(backendReachable()).toBeNull();
    expect(backendUnreachableConfirmed()).toBe(false);
  });

  it("control: a page that is not self-hosted does ask", async () => {
    boot(false);
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      status: 404,
      ok: false,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await ensureServerList();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "https://api.play.example.com/cluster.json",
    );
  });

  it("keeps the guest's persistent ID without asking any API", async () => {
    boot(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem(PERSISTENT_ID_KEY, GUEST_ID);

    expect(await userAuth()).toBe(false);
    expect(await getPlayToken()).toBe(GUEST_ID);
    expect(await getPlayToken()).toBe(GUEST_ID);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(PERSISTENT_ID_KEY)).toBe(GUEST_ID);
  });
});
