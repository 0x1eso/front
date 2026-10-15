import express from "express";
import http from "http";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, test, vi } from "vitest";
import { registerGamePreviewRoute } from "../../src/server/GamePreviewRoute";
import { defaultGameServerDeps } from "../../src/server/GameServer";
import { FailOpenPrivilegeChecker } from "../../src/server/Privilege";
import { startPrivilegeChecks } from "../../src/server/PrivilegeRefresher";
import { startRankedCheckinLoops } from "../../src/server/RankedCheckin";
import { replayWinnerInChild } from "../../src/server/WinnerReplay";

function spyLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

describe("self-hosted server wiring", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("polls no cosmetics catalog and lets every join through", () => {
    vi.stubEnv("SELF_HOSTED", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const privileges = startPrivilegeChecks(spyLog() as never);
    expect(privileges()).toBeInstanceOf(FailOpenPrivilegeChecker);
    expect(privileges().resolveClanTag("ABC", [])).toEqual({
      tag: "ABC",
      dropped: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("starts no ranked check-ins", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.useFakeTimers();
    const fetchFn = vi.fn();
    const log = spyLog();
    startRankedCheckinLoops({
      gm: {},
      playlist: {},
      workerId: 0,
      log,
      isActive: () => true,
      fetchFn,
    } as never);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  test("archives nothing and fetches no tribe names", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const deps = defaultGameServerDeps();
    await deps.archive({} as never);
    await expect(deps.fetchTribes([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // A replay only settles a disputed winner for the archive, and nothing is
  // archived: it would be a game's worth of simulation in a child process
  // for nothing.
  test("replays no disputed winner", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    const deps = defaultGameServerDeps();
    expect(deps.replayWinner).not.toBe(replayWinnerInChild);
    await expect(deps.replayWinner({} as never, [])).resolves.toBeNull();

    vi.stubEnv("SELF_HOSTED", "");
    expect(defaultGameServerDeps().replayWinner).toBe(replayWinnerInChild);
  });

  test("a game link preview asks no API about the game", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    const log = spyLog();
    const app = express();
    registerGamePreviewRoute({
      app,
      gm: { game: () => null } as never,
      workerId: 0,
      log: log as never,
      baseDir: "/nonexistent",
    });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const res = await fetch(`${base}/game/abcdefgh`, { redirect: "manual" });
      expect(res.status).toBe(302);
      const outbound = fetchSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((url) => !url.startsWith(base));
      expect(outbound).toEqual([]);
      expect(log.warn).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
