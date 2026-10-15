import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AlternateViewEvent,
  BuildTapEvent,
  ContextMenuEvent,
  InputHandler,
  MouseMoveEvent,
  MouseUpEvent,
  ToggleCoordinateGridEvent,
  TouchEvent,
  TouchLongPressStartEvent,
  ZoomEvent,
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
  pointerId = 1,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId,
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
    eventBus.on(BuildTapEvent, (e) => seen.push(e));
    eventBus.on(ZoomEvent, (e) => seen.push(e));
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

  it("in build mode a tap goes to the build ghost, not the menu", () => {
    uiState.ghostStructure = UnitType.City;
    pressMoveRelease(canvas, 0, "touch");

    expect(of(TouchEvent)).toHaveLength(0);
    expect(of(BuildTapEvent).map((e) => [e.x, e.y])).toEqual([[100, 100]]);
    // The tap only aims: BuildPreviewController builds on a second tap on
    // the aimed ghost, never straight from this release.
    expect(of(MouseUpEvent)).toHaveLength(0);
  });

  it("a mouse click in build mode still builds at once", () => {
    uiState.ghostStructure = UnitType.City;
    pressMoveRelease(canvas, 0, "mouse");

    expect(of(MouseUpEvent).map((e) => [e.x, e.y])).toEqual([[100, 100]]);
    expect(of(BuildTapEvent)).toHaveLength(0);
  });

  it("after build mode ends a tap goes back to the menu path", () => {
    uiState.ghostStructure = UnitType.City;
    pressMoveRelease(canvas, 0, "touch");
    uiState.ghostStructure = null;
    pressMoveRelease(canvas, 0, "touch");

    expect(of(BuildTapEvent)).toHaveLength(1);
    expect(of(TouchEvent)).toHaveLength(1);
  });

  /** Thumb anchored at (100,100), index finger spreading from (200,200). */
  function pinch(): void {
    pointer(canvas, "pointerdown", 100, 100, "touch", 1);
    pointer(canvas, "pointerdown", 200, 200, "touch", 2);
    pointer(window, "pointermove", 250, 250, "touch", 2);
    pointer(window, "pointermove", 300, 300, "touch", 2);
    // The thumb lifts first, having wobbled 3px: that is no tap.
    pointer(window, "pointerup", 102, 101, "touch", 1);
    pointer(window, "pointerup", 300, 300, "touch", 2);
  }

  it.each([UnitType.City, UnitType.AtomBomb] as const)(
    "a pinch in build mode (%s) zooms without aiming or building",
    (type) => {
      uiState.ghostStructure = type;
      pinch();

      expect(of(ZoomEvent).length).toBeGreaterThan(0);
      expect(of(BuildTapEvent)).toHaveLength(0);
      expect(of(MouseUpEvent)).toHaveLength(0);
    },
  );

  it("a pinch outside build mode opens no menu", () => {
    pinch();
    expect(of(ZoomEvent).length).toBeGreaterThan(0);
    expect(of(TouchEvent)).toHaveLength(0);
  });

  it("a two-finger tap is not a tap either, whichever finger lifts first", () => {
    pointer(canvas, "pointerdown", 100, 100, "touch", 1);
    pointer(canvas, "pointerdown", 160, 100, "touch", 2);
    pointer(window, "pointerup", 160, 100, "touch", 2);
    pointer(window, "pointerup", 100, 100, "touch", 1);
    expect(of(TouchEvent)).toHaveLength(0);
  });

  it.each([UnitType.AtomBomb, null] as const)(
    "re-gripping during a pinch (ghost %s) is no tap while the thumb still rests (C4)",
    (type) => {
      uiState.ghostStructure = type;
      pointer(canvas, "pointerdown", 100, 100, "touch", 1); // thumb stays down
      pointer(canvas, "pointerdown", 200, 200, "touch", 2);
      pointer(window, "pointermove", 260, 260, "touch", 2);
      pointer(window, "pointerup", 260, 260, "touch", 2);
      // The index finger comes back to re-grip and lifts without moving.
      pointer(canvas, "pointerdown", 240, 240, "touch", 3);
      pointer(window, "pointerup", 241, 240, "touch", 3);
      pointer(window, "pointerup", 100, 100, "touch", 1);

      expect(of(ZoomEvent).length).toBeGreaterThan(0);
      expect(of(BuildTapEvent)).toHaveLength(0);
      expect(of(TouchEvent)).toHaveLength(0);
      // Every finger is up: the next tap is a tap again.
      pressMoveRelease(canvas, 0, "touch");
      expect(of(type === null ? TouchEvent : BuildTapEvent)).toHaveLength(1);
    },
  );

  it("a finger whose release never arrived does not block the next taps (C4)", () => {
    // A finger goes down and its pointerup is lost.
    pointer(canvas, "pointerdown", 300, 300, "touch", 7);
    pressMoveRelease(canvas, 0, "touch");
    // The next touch is the only one on the screen: the browser marks it
    // primary, and it taps.
    const down = new Event("pointerdown", { bubbles: true, cancelable: true });
    Object.assign(down, {
      pointerId: 8,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 100,
      x: 100,
      y: 100,
    });
    canvas.dispatchEvent(down);
    pointer(window, "pointerup", 100, 100, "touch", 8);
    expect(of(TouchEvent).map((e) => [e.x, e.y])).toEqual([[100, 100]]);
  });

  it("the first one-finger tap after a pinch taps again", () => {
    uiState.ghostStructure = UnitType.City;
    pinch();
    pressMoveRelease(canvas, 0, "touch");
    expect(of(BuildTapEvent).map((e) => [e.x, e.y])).toEqual([[100, 100]]);
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
