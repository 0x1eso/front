import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LONG_PRESS_HINT_MS,
  TouchHintController,
} from "../../src/client/controllers/TouchHintController";
import { UserSettings } from "../../src/client/UserSettings";
import type { GameView } from "../../src/client/view";

function game(warships: number, alive = true): GameView {
  const me = {
    isAlive: () => alive,
    units: (type: UnitType) =>
      type === UnitType.Warship
        ? Array.from({ length: warships }, () => ({}))
        : [],
  };
  return { myPlayer: () => me } as unknown as GameView;
}

interface Toast {
  message: string;
  color: string;
  duration: number;
}

describe("long-press hint", () => {
  let toasts: Toast[];
  const capture = (e: Event) => toasts.push((e as CustomEvent<Toast>).detail);

  beforeEach(() => {
    toasts = [];
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
    window.addEventListener("show-message", capture);
  });

  afterEach(() => {
    window.removeEventListener("show-message", capture);
  });

  it("shows once, when a touch player first has a warship", () => {
    const settings = new UserSettings();
    new TouchHintController(game(0), settings, () => true).tick();
    expect(toasts).toHaveLength(0);

    const withShip = new TouchHintController(game(1), settings, () => true);
    withShip.tick();
    withShip.tick();

    expect(toasts).toEqual([
      {
        message: "touch_ui.warship_long_press",
        color: "green",
        duration: LONG_PRESS_HINT_MS,
      },
    ]);
    // A later game on the same device stays quiet.
    new TouchHintController(game(3), new UserSettings(), () => true).tick();
    expect(toasts).toHaveLength(1);
  });

  it("never shows on a mouse device or to a dead player", () => {
    new TouchHintController(game(2), new UserSettings(), () => false).tick();
    new TouchHintController(
      game(2, false),
      new UserSettings(),
      () => true,
    ).tick();
    expect(toasts).toHaveLength(0);
    expect(new UserSettings().touchLongPressHintShown()).toBe(false);
  });

  it("checks once a second", () => {
    expect(
      new TouchHintController(game(0), new UserSettings()).getTickIntervalMs(),
    ).toBe(1000);
  });
});
