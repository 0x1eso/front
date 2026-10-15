import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AlternateViewEvent,
  ContextMenuEvent,
  InputHandler,
  MouseMoveEvent,
  MouseUpEvent,
  ToggleCoordinateGridEvent,
  TouchEvent,
  TouchLongPressStartEvent,
} from "../../src/client/InputHandler";
import type { UIState } from "../../src/client/UIState";
import { KEYBINDS_KEY, UserSettings } from "../../src/client/UserSettings";
import type { GameView } from "../../src/client/view";

type PointerType = "touch" | "mouse";

/** jsdom's PointerEvent drops pointerId/pointerType, so fake one. */
function pointer(
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
  pointerType: PointerType,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    pointerType,
    button: 0,
    clientX: x,
    clientY: y,
    x,
    y,
  });
  target.dispatchEvent(event);
}

/** Press at (100, 100), move right by dx, release there. */
function pressMoveRelease(
  target: EventTarget,
  dx: number,
  pointerType: PointerType,
): void {
  pointer(target, "pointerdown", 100, 100, pointerType);
  pointer(target, "pointermove", 100 + dx, 100, pointerType);
  pointer(target, "pointerup", 100 + dx, 100, pointerType);
}

describe("InputHandler on a touch screen", () => {
  let canvas: HTMLDivElement;
  let eventBus: EventBus;
  let uiState: UIState;
  let handler: InputHandler;
  let seen: object[];

  function of<T extends object>(type: new (...args: never[]) => T): T[] {
    return seen.filter((e): e is T => e instanceof type);
  }

  beforeEach(() => {
    new UserSettings().removeCached(KEYBINDS_KEY, false);
    canvas = document.createElement("div");
    document.body.appendChild(canvas);
    eventBus = new EventBus();
    seen = [];
    eventBus.on(TouchEvent, (e) => seen.push(e));
    eventBus.on(MouseUpEvent, (e) => seen.push(e));
    eventBus.on(MouseMoveEvent, (e) => seen.push(e));
    eventBus.on(ContextMenuEvent, (e) => seen.push(e));
    eventBus.on(TouchLongPressStartEvent, (e) => seen.push(e));
    eventBus.on(AlternateViewEvent, (e) => seen.push(e));
    eventBus.on(ToggleCoordinateGridEvent, (e) => seen.push(e));
    uiState = {
      attackRatio: 0.2,
      ghostStructure: null,
      rocketDirectionUp: true,
      upgradeMultiplier: 1,
    };
    const game = {
      inSpawnPhase: () => false,
      myPlayer: () => ({ isAlive: () => true }),
    } as unknown as GameView;
    handler = new InputHandler(game, uiState, canvas, eventBus);
    handler.initialize();
  });

  afterEach(() => {
    handler.destroy();
    canvas.remove();
    vi.useRealTimers();
  });

  it("a finger that wobbles 12px still taps", () => {
    pressMoveRelease(canvas, 12, "touch");
    expect(of(TouchEvent)).toHaveLength(1);
  });

  it("a finger that moves 16px drags instead of tapping", () => {
    pressMoveRelease(canvas, 16, "touch");
    expect(of(TouchEvent)).toHaveLength(0);
  });

  it("a mouse keeps the 10px threshold", () => {
    pressMoveRelease(canvas, 12, "mouse");
    expect(of(MouseUpEvent)).toHaveLength(0);
    expect(of(ContextMenuEvent)).toHaveLength(0);
  });

  it("a 12px wobble does not cancel the long-press", () => {
    vi.useFakeTimers();
    pointer(canvas, "pointerdown", 100, 100, "touch");
    pointer(canvas, "pointermove", 112, 100, "touch");
    vi.advanceTimersByTime(800);
    expect(of(TouchLongPressStartEvent)).toHaveLength(1);
  });

  it("moving 16px before 800ms cancels the long-press", () => {
    vi.useFakeTimers();
    pointer(canvas, "pointerdown", 100, 100, "touch");
    pointer(canvas, "pointermove", 116, 100, "touch");
    vi.advanceTimersByTime(800);
    expect(of(TouchLongPressStartEvent)).toHaveLength(0);
  });

  it("in build mode a tap places the ghost where the finger landed", () => {
    uiState.ghostStructure = UnitType.City;
    pressMoveRelease(canvas, 0, "touch");

    expect(of(TouchEvent)).toHaveLength(0);
    const moves = of(MouseMoveEvent);
    const ups = of(MouseUpEvent);
    expect(moves.map((e) => [e.x, e.y])).toEqual([[100, 100]]);
    expect(ups.map((e) => [e.x, e.y])).toEqual([[100, 100]]);
    // The ghost moves under the finger before the confirm reads its tile.
    expect(seen.indexOf(moves[0])).toBeLessThan(seen.indexOf(ups[0]));
  });

  it("after build mode ends a tap goes back to the menu path", () => {
    uiState.ghostStructure = UnitType.City;
    pressMoveRelease(canvas, 0, "touch");
    uiState.ghostStructure = null;
    pressMoveRelease(canvas, 0, "touch");

    expect(of(MouseUpEvent)).toHaveLength(1);
    expect(of(TouchEvent)).toHaveLength(1);
  });

  it("follows a grid toggle made elsewhere, so M flips what is shown", () => {
    eventBus.emit(new ToggleCoordinateGridEvent(true));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM" }));

    expect(of(ToggleCoordinateGridEvent).map((e) => e.enabled)).toEqual([
      true,
      false,
    ]);
  });

  it("follows a view toggle made elsewhere, so Space does not resend it", () => {
    eventBus.emit(new AlternateViewEvent(true));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));

    expect(of(AlternateViewEvent).map((e) => e.alternateView)).toEqual([true]);
  });
});
