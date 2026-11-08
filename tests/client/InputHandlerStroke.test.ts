// ww162 (battle planner, design §2): InputHandler's drag claim — a claimed
// press draws (WwStrokeEvent) instead of panning, a claimed press that never
// moved still taps, two fingers cancel the stroke and pan in a draw mode,
// Shift pans there, and a right-click asks before the menu opens.
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClaimDragEvent,
  ContextCancelEvent,
  ContextMenuEvent,
  DragEvent,
  InputHandler,
  TouchEvent,
  TouchLongPressStartEvent,
  WarshipSelectionBoxUpdateEvent,
  WwStrokeEvent,
  ZoomEvent,
} from "../../src/client/InputHandler";
import type { UIState } from "../../src/client/UIState";
import { KEYBINDS_KEY, UserSettings } from "../../src/client/UserSettings";
import type { GameView } from "../../src/client/view";

/** jsdom's PointerEvent drops pointerId/pointerType, so fake one. */
function pointer(
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  x: number,
  y: number,
  pointerType: "touch" | "mouse",
  pointerId = 1,
  shiftKey = false,
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
    shiftKey,
  });
  target.dispatchEvent(event);
}

describe("InputHandler's drag claim (ww162)", () => {
  let canvas: HTMLDivElement;
  let bus: EventBus;
  let handler: InputHandler;
  let seen: object[];
  /** What the fake controller answers: claim the press, say it is a draw mode. */
  let answer: { claim: boolean; draw: boolean; cancel: boolean };

  function of<T extends object>(type: new (...args: never[]) => T): T[] {
    return seen.filter((e): e is T => e instanceof type);
  }

  beforeEach(() => {
    new UserSettings().removeCached(KEYBINDS_KEY, false);
    canvas = document.createElement("div");
    document.body.appendChild(canvas);
    bus = new EventBus();
    seen = [];
    answer = { claim: true, draw: true, cancel: false };
    bus.on(ClaimDragEvent, (e) => {
      seen.push(e);
      e.drawMode = answer.draw;
      if (!e.shift) e.claimed = answer.claim;
    });
    bus.on(ContextCancelEvent, (e) => {
      seen.push(e);
      e.taken = answer.cancel;
    });
    for (const t of [
      WwStrokeEvent,
      DragEvent,
      TouchEvent,
      ZoomEvent,
      ContextMenuEvent,
      TouchLongPressStartEvent,
      WarshipSelectionBoxUpdateEvent,
    ]) {
      bus.on(t as never, (e: object) => seen.push(e));
    }
    const uiState = {
      attackRatio: 0.2,
      ghostStructure: null,
      rocketDirectionUp: true,
      upgradeMultiplier: 1,
    } as UIState;
    const game = {
      inSpawnPhase: () => false,
      myPlayer: () => ({ isAlive: () => true }),
    } as unknown as GameView;
    handler = new InputHandler(game, uiState, canvas, bus);
    handler.initialize();
  });

  afterEach(() => {
    handler.destroy();
    canvas.remove();
    vi.useRealTimers();
  });

  it("a claimed drag strokes, from the press point, and never pans", () => {
    pointer(canvas, "pointerdown", 100, 100, "touch");
    pointer(window, "pointermove", 110, 100, "touch");
    pointer(window, "pointermove", 130, 100, "touch");
    pointer(window, "pointermove", 160, 120, "touch");
    pointer(window, "pointerup", 160, 120, "touch");
    expect(of(WwStrokeEvent).map((e) => [e.phase, e.x, e.y])).toEqual([
      ["start", 100, 100],
      ["move", 130, 100],
      ["move", 160, 120],
      ["end", 160, 120],
    ]);
    expect(of(DragEvent)).toEqual([]);
    expect(of(TouchEvent)).toEqual([]);
  });

  it("a claimed press that never moved is still a tap, and starts no long press", () => {
    vi.useFakeTimers();
    pointer(canvas, "pointerdown", 100, 100, "touch");
    vi.advanceTimersByTime(900);
    pointer(window, "pointerup", 104, 100, "touch");
    expect(of(WwStrokeEvent)).toEqual([]);
    expect(of(TouchLongPressStartEvent)).toEqual([]);
    expect(of(TouchEvent)).toHaveLength(1);
  });

  it("unclaimed, the press pans as before", () => {
    answer = { claim: false, draw: false, cancel: false };
    pointer(canvas, "pointerdown", 100, 100, "mouse");
    pointer(window, "pointermove", 140, 100, "mouse");
    pointer(window, "pointerup", 140, 100, "mouse");
    expect(of(WwStrokeEvent)).toEqual([]);
    expect(of(DragEvent).map((e) => e.deltaX)).toEqual([40]);
  });

  it("a second finger cancels the stroke; in a draw mode two fingers pan and zoom", () => {
    pointer(canvas, "pointerdown", 100, 100, "touch", 1);
    pointer(window, "pointermove", 130, 100, "touch", 1);
    pointer(canvas, "pointerdown", 200, 100, "touch", 2);
    pointer(window, "pointermove", 230, 120, "touch", 2);
    pointer(window, "pointerup", 130, 100, "touch", 1);
    pointer(window, "pointerup", 230, 120, "touch", 2);
    expect(of(WwStrokeEvent).map((e) => e.phase)).toEqual([
      "start",
      "move",
      "cancel",
    ]);
    // The centre moved (15, 10): a pan; the fingers spread: a zoom.
    expect(of(DragEvent).map((e) => [e.deltaX, e.deltaY])).toEqual([[15, 10]]);
    expect(of(ZoomEvent).length).toBeGreaterThan(0);
    expect(of(TouchEvent)).toEqual([]);
  });

  it("outside a draw mode two fingers only zoom, as before", () => {
    answer = { claim: false, draw: false, cancel: false };
    pointer(canvas, "pointerdown", 100, 100, "touch", 1);
    pointer(canvas, "pointerdown", 200, 100, "touch", 2);
    pointer(window, "pointermove", 230, 120, "touch", 2);
    expect(of(DragEvent)).toEqual([]);
  });

  it("Shift + drag in a draw mode pans, never box-selects", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft" }));
    pointer(canvas, "pointerdown", 100, 100, "mouse", 1, true);
    pointer(window, "pointermove", 140, 100, "mouse", 1, true);
    pointer(window, "pointerup", 140, 100, "mouse", 1, true);
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft" }));
    expect(of(WwStrokeEvent)).toEqual([]);
    expect(of(WarshipSelectionBoxUpdateEvent)).toEqual([]);
    expect(of(DragEvent).map((e) => e.deltaX)).toEqual([40]);
  });

  it("a cancelled pointer cancels the stroke", () => {
    pointer(canvas, "pointerdown", 100, 100, "touch");
    pointer(window, "pointermove", 140, 100, "touch");
    pointer(window, "pointercancel", 140, 100, "touch");
    expect(of(WwStrokeEvent).map((e) => e.phase)).toEqual([
      "start",
      "move",
      "cancel",
    ]);
  });

  it("a right-click the controller used opens no menu", () => {
    const click = () =>
      canvas.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          clientX: 5,
          clientY: 6,
        }),
      );
    answer.cancel = true;
    click();
    expect(of(ContextMenuEvent)).toEqual([]);
    answer.cancel = false;
    click();
    expect(of(ContextMenuEvent)).toHaveLength(1);
  });
});
