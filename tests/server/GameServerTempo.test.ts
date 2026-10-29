import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { createGameWireContext } from "@openfront/shared/ZbinWire";
import type { GameServer } from "../../src/server/GameServer";
import {
  MatchTelemetryEmitter,
  MatchTelemetryEvent,
  zeroCounters,
} from "../../src/server/telemetry/MatchTelemetry";
import {
  cid,
  makeClient,
  makeGame,
  mockWsOf,
  startGame,
} from "../util/GameServerHarness";

// World War 1936, the unlimited game (engine-lib/ww1936/Pace.ts): the same
// simulation with 400 ms ticks, so the server hands out a turn every 400 ms;
// every other game keeps the 100 ms turn. A started unlimited game may run
// a day (24 h) instead of the usual 3 hours.

const T0 = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

const TIMED: Partial<GameConfig> = {
  gameType: GameType.Private,
  worldWar1936: true,
};
const UNLIMITED: Partial<GameConfig> = { ...TIMED, ww1936Unlimited: true };

// Keeps every telemetry event the game emits.
class RecordingEmitter implements MatchTelemetryEmitter {
  readonly events: MatchTelemetryEvent[] = [];
  emit(event: MatchTelemetryEvent) {
    this.events.push(event);
    return "enqueued" as const;
  }
  counters() {
    return zeroCounters();
  }
  stop() {}
}

// A lobby with its host seated; `turns()` counts the turn frames the host
// has been sent.
function lobby(config: Partial<GameConfig>) {
  const telemetry = new RecordingEmitter();
  const game = makeGame({
    creatorPersistentID: "host-pid",
    config,
    telemetry,
  });
  const host = makeClient({ clientID: cid("host"), persistentID: "host-pid" });
  expect(game.joinClient(host)).toBe("joined");
  const ctx = createGameWireContext([{ clientID: host.clientID }]);
  const turns = () =>
    mockWsOf(host)
      .sent(ctx)
      .filter((m) => m.type === "turn").length;
  const turnIntervalMs = (type: "match_opened" | "match_started") => {
    const e = telemetry.events.find((e) => e.type === type);
    return e === undefined ? undefined : (e.payload as any).turnIntervalMs;
  };
  return { game, host, turns, turnIntervalMs };
}

describe("GameServer: the turn follows the game's tick length", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("an unlimited World War 1936 game hands out a turn every 400 ms", () => {
    const { game, turns, turnIntervalMs } = lobby(UNLIMITED);
    startGame(game);

    vi.advanceTimersByTime(399);
    expect(turns()).toBe(0);
    vi.advanceTimersByTime(801); // 1,200 ms in all
    expect(turns()).toBe(3);
    // Telemetry reports the interval the game runs at.
    expect(turnIntervalMs("match_opened")).toBe(400);
    expect(turnIntervalMs("match_started")).toBe(400);
  });

  it("a timed World War 1936 game hands out a turn every 100 ms", () => {
    const { game, turns, turnIntervalMs } = lobby(TIMED);
    startGame(game);

    vi.advanceTimersByTime(1200);
    expect(turns()).toBe(12);
    expect(turnIntervalMs("match_opened")).toBe(100);
    expect(turnIntervalMs("match_started")).toBe(100);
  });

  it("a host patch that turns unlimited on just before the start is honoured", async () => {
    const { game, host, turns, turnIntervalMs } = lobby(TIMED);
    await mockWsOf(host).emit({
      type: "intent",
      intent: {
        type: "update_game_config",
        config: { ww1936Unlimited: true },
      },
    });
    startGame(game);

    vi.advanceTimersByTime(1200);
    expect(turns()).toBe(3);
    // The lobby opened timed; the game started unlimited.
    expect(turnIntervalMs("match_opened")).toBe(100);
    expect(turnIntervalMs("match_started")).toBe(400);
  });
});

describe("GameServer: an unlimited game's duration cap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // System time jumps rather than advancing the timers: a day of turns is
  // not what is being asked about.
  const startedAt = (config: Partial<GameConfig>): GameServer => {
    const { game } = lobby(config);
    startGame(game);
    return game;
  };

  it("an unlimited game outlives 3 hours and ends after 24", () => {
    const game = startedAt(UNLIMITED);
    vi.setSystemTime(T0 + 3 * HOUR + 1000);
    expect(game.pastMaxDuration()).toBe(false);
    vi.setSystemTime(T0 + 24 * HOUR + 1000);
    expect(game.pastMaxDuration()).toBe(true);
  });

  it("a timed World War 1936 game still ends after 3 hours", () => {
    const game = startedAt(TIMED);
    vi.setSystemTime(T0 + 3 * HOUR + 1000);
    expect(game.pastMaxDuration()).toBe(true);
  });
});
