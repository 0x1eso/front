/**
 * The strike effects' two DOM overlays (WwStrikeFxPass): the 20 s glow over
 * the struck region and the victim's red edge flash.
 *
 * Both live in one layer that is `position: fixed`, covers the screen and
 * clips (`overflow: hidden`). The glow follows a map point, so a pan carries
 * it past the screen's edge; an absolutely placed child of <body> there
 * grows the document, and a phone then widens its layout viewport to fit it,
 * so the canvas resizes and the whole map seems to zoom out while the player
 * drags (ww239). Inside the clipped fixed layer the glow never adds to the
 * page's size. The glow is hidden once it has faded, so nothing is left
 * behind at its last place.
 */
import { FLASH_INNER, GLOW_MAX_SHARE } from "./passes/WwStrikeFxPass";

/** What the overlay reads of the camera: centre (tiles) and CSS px per tile. */
export interface OverlayView {
  offsetX: number;
  offsetY: number;
  /** CSS pixels per tile (Camera.zoom / dpr). */
  scale: number;
  /** The canvas' CSS size. */
  width: number;
  height: number;
}

/** The glow's square on screen (CSS px), centred on tile (x, y). */
export function glowRect(
  x: number,
  y: number,
  v: OverlayView,
): { left: number; top: number; size: number } {
  // Never more than GLOW_MAX_SHARE of the shorter screen side, at any zoom.
  const size = Math.round(
    Math.min(
      Math.max(40, 50 * v.scale),
      GLOW_MAX_SHARE * Math.min(v.width, v.height),
    ),
  );
  return {
    left: Math.round(v.width / 2 + (x - v.offsetX) * v.scale - size / 2),
    top: Math.round(v.height / 2 + (y - v.offsetY) * v.scale - size / 2),
    size,
  };
}

export class StrikeOverlay {
  private layer: HTMLDivElement | null = null;
  private glow: HTMLDivElement | null = null;
  private edge: HTMLDivElement | null = null;
  /** Last values written (no style write when unchanged). */
  private readonly last = { size: -1, left: 0, top: 0, op: -1 };
  private edgeLastOp = -1;

  constructor(private readonly host: () => HTMLElement | null) {}

  private ensureLayer(): HTMLDivElement | null {
    if (this.layer !== null) return this.layer;
    const host = this.host();
    if (host === null) return null;
    const el = document.createElement("div");
    el.setAttribute("data-ww-strike-layer", "");
    el.style.cssText =
      "position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:4;contain:strict";
    host.appendChild(el);
    this.layer = el;
    return el;
  }

  /** The glow at tile (x, y) with `alpha`; 0 hides it. */
  light(x: number, y: number, alpha: number, v: OverlayView): void {
    const op = Math.round(alpha * 100);
    if (op <= 0) {
      if (this.glow !== null && this.last.op !== 0) {
        this.glow.style.display = "none";
        this.last.op = 0;
      }
      return;
    }
    let el = this.glow;
    if (el === null) {
      const layer = this.ensureLayer();
      if (layer === null) return;
      el = document.createElement("div");
      el.setAttribute("data-ww-strike-light", "");
      el.style.cssText =
        "position:absolute;pointer-events:none;border-radius:50%;" +
        "background:radial-gradient(circle,rgba(255,236,180,0.9) 0%,rgba(255,200,120,0.35) 40%,rgba(255,200,120,0) 70%)";
      // Under the edge flash, which is added after it when both exist.
      layer.insertBefore(el, layer.firstChild);
      this.glow = el;
    }
    const r = glowRect(x, y, v);
    const last = this.last;
    if (r.size !== last.size) {
      el.style.width = el.style.height = `${r.size}px`;
      last.size = r.size;
    }
    if (r.left !== last.left) {
      el.style.left = `${r.left}px`;
      last.left = r.left;
    }
    if (r.top !== last.top) {
      el.style.top = `${r.top}px`;
      last.top = r.top;
    }
    if (op !== last.op) {
      if (last.op <= 0) el.style.display = "";
      el.style.opacity = String(op / 100);
      last.op = op;
    }
  }

  /** The victim's one red flash: a vignette on the screen's edges, the middle clear. */
  edgeFlash(alpha: number): void {
    const op = Math.round(alpha * 100);
    if (op === this.edgeLastOp) return;
    let el = this.edge;
    if (el === null) {
      if (op <= 0) return;
      const layer = this.ensureLayer();
      if (layer === null) return;
      el = document.createElement("div");
      el.setAttribute("data-ww-strike-edge", "");
      el.style.cssText =
        "position:absolute;inset:0;pointer-events:none;" +
        "background:radial-gradient(ellipse at center,rgba(220,0,0,0) " +
        `${FLASH_INNER * 100}%,rgba(220,0,0,1) 100%);opacity:0`;
      layer.appendChild(el);
      this.edge = el;
    }
    this.edgeLastOp = op;
    el.style.opacity = String(op / 100);
  }

  dispose(): void {
    this.layer?.remove();
    this.layer = this.glow = this.edge = null;
  }
}
