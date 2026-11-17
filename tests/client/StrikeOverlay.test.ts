// ww239: dragging the map while an atomic strike's glow showed made the page
// zoom out on phones: the glow sat absolutely in <body>, so once a pan took
// it past the screen's edge it grew the document, the browser widened the
// layout viewport and the canvas resized. The glow now lives in a fixed,
// clipped layer, stays on its map point at any pan or zoom, and hides once
// it has faded; the player's drag still wins over an automatic camera move.
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DragEvent } from "../../src/client/InputHandler";
import { Camera } from "../../src/client/render/gl/Camera";
import {
  glowRect,
  type OverlayView,
  StrikeOverlay,
} from "../../src/client/render/gl/StrikeOverlay";
import {
  GOTO_INTERVAL_MS,
  GoToPositionEvent,
  TransformHandler,
} from "../../src/client/TransformHandler";
import type { GameView } from "../../src/client/view";

const view = (ox: number, oy: number, scale: number): OverlayView => ({
  offsetX: ox,
  offsetY: oy,
  scale,
  width: 390,
  height: 844,
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("StrikeOverlay (ww239)", () => {
  it("keeps the glow in a fixed, clipped layer, even far past the screen's edge", () => {
    const o = new StrikeOverlay(() => document.body);
    // The struck point 2000 px right of and below the screen.
    o.light(100, 100, 0.4, view(-150, -150, 8));
    o.edgeFlash(0.3);
    const glow = document.querySelector<HTMLElement>("[data-ww-strike-light]")!;
    const edge = document.querySelector<HTMLElement>("[data-ww-strike-edge]")!;
    const layer = glow.parentElement!;
    expect(layer).not.toBe(document.body);
    expect(layer.hasAttribute("data-ww-strike-layer")).toBe(true);
    expect(edge.parentElement).toBe(layer);
    expect(layer.style.position).toBe("fixed");
    expect(layer.style.overflow).toBe("hidden");
    expect(layer.style.pointerEvents).toBe("none");
    expect(parseInt(glow.style.left, 10)).toBeGreaterThan(390);
    // Nothing of the strike is a direct child of <body> but the layer.
    expect(
      [...document.body.children].filter((c) =>
        c.matches("[data-ww-strike-light],[data-ww-strike-edge]"),
      ),
    ).toEqual([]);
    o.dispose();
    expect(document.querySelector("[data-ww-strike-layer]")).toBeNull();
  });

  it("stays on its map point at any pan and zoom, with the camera's own projection", () => {
    const cam = new Camera(4000, 2000);
    cam.resize(390, 844);
    for (const [ox, oy, zoom] of [
      [2130, 630, 8],
      [2000, 700, 8],
      [2130, 630, 2],
      [1500, 300, 16],
    ]) {
      cam.setCameraState(ox, oy, zoom);
      const r = glowRect(2129, 637, view(ox, oy, zoom));
      const at = cam.worldToScreen(2129, 637);
      expect(Math.abs(r.left + r.size / 2 - at.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.top + r.size / 2 - at.y)).toBeLessThanOrEqual(1);
      // A pan never changes the glow's size or the camera's zoom.
      expect(glowRect(2129, 637, view(ox + 300, oy - 200, zoom)).size).toBe(
        r.size,
      );
      expect(cam.zoom).toBe(zoom);
    }
  });

  it("hides the glow once it has faded and shows it again for the next strike", () => {
    const o = new StrikeOverlay(() => document.body);
    o.light(10, 10, 0.4, view(10, 10, 4));
    const glow = document.querySelector<HTMLElement>("[data-ww-strike-light]")!;
    expect(glow.style.display).toBe("");
    o.light(10, 10, 0, view(10, 10, 4));
    expect(glow.style.display).toBe("none");
    o.light(10, 10, 0.3, view(12, 10, 4));
    expect(glow.style.display).toBe("");
    expect(glow.style.opacity).toBe("0.3");
    o.dispose();
  });

  it("lets the player's drag cancel an automatic camera move without touching the zoom", () => {
    vi.useFakeTimers();
    const game = {
      width: () => 400,
      height: () => 400,
      myPlayer: () => null,
    } as unknown as GameView;
    const bus = new EventBus();
    const th = new TransformHandler(
      game,
      bus,
      document.createElement("canvas"),
    );
    const scale = th.scale;
    bus.emit(new GoToPositionEvent(380, 380));
    vi.advanceTimersByTime(GOTO_INTERVAL_MS * 3);
    bus.emit(new DragEvent(40, 0));
    const [x, y] = [th.offsetX, th.offsetY];
    vi.advanceTimersByTime(GOTO_INTERVAL_MS * 10);
    expect([th.offsetX, th.offsetY]).toEqual([x, y]);
    expect(th.scale).toBe(scale);
  });
});
