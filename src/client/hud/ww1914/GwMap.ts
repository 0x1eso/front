import { Cell } from "@openfront/engine-api/game/GameTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import type { EventBus } from "@openfront/shared/EventBus";
import type { MapRenderer } from "../../render/gl/MapRenderer";
import {
  GoToPositionEvent,
  type TransformHandler,
} from "../../TransformHandler";
import type { GameView } from "../../view";
import type { GwMapApi, GwSpot } from "./GwCtx";

/** How near the camera comes to a place. */
const PLACE_ZOOM = 5;
/** A pin's label, in pixels: labels this close push each other up. */
const LABEL_W = 96;
const LABEL_H = 24;

/**
 * The map under the panel: the camera, the tiles held for a replay, and the
 * ink drawn over it. Pins are ordinary elements of the panel marked
 * `data-gw-at="x y"`; this keeps them on their tiles as the camera moves.
 */
export class GwMap implements GwMapApi {
  /** Tiles changed and not yet drawn. */
  private held: number[] = [];
  /** Regions outlined now: the one picked, what is falling. */
  private ringed: number | null = null;
  private flashes = new Map<number, number>();
  private paths = new Map<number, Path2D>();
  private looping = false;
  private lastTick = 0;

  constructor(
    private readonly game: GameView,
    private readonly bus: EventBus,
    private readonly transform: TransformHandler,
    private readonly view: MapRenderer,
    private readonly root: HTMLElement,
  ) {
    view.setTileHold((tiles) => {
      for (let i = 0; i < tiles.length; i++) this.held.push(tiles[i]);
    });
  }

  /** The panel's tick: keeps the frame loop alive while the game is. */
  beat(): void {
    this.lastTick = performance.now();
    if (this.looping) return;
    this.looping = true;
    requestAnimationFrame(() => this.frame());
  }

  private frame(): void {
    // The game ended under us: the loop stops, the next tick starts it again.
    if (performance.now() - this.lastTick > 2000 || !this.root.isConnected) {
      this.looping = false;
      return;
    }
    this.placeMarks();
    this.ink();
    requestAnimationFrame(() => this.frame());
  }

  /** Everything marked to sit on a tile goes to it. */
  placeMarks(): void {
    const marks = this.root.querySelectorAll<HTMLElement>("[data-gw-at]");
    const taken: { x: number; y: number }[] = [];
    for (const el of marks) {
      const [x, y] = (el.dataset.gwAt ?? "0 0").split(" ").map(Number);
      const p = this.transform.worldToScreenCoordinates(new Cell(x, y));
      let top = p.y;
      while (taken.some((t) => near(t, p.x, top))) top -= LABEL_H;
      taken.push({ x: p.x, y: top });
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(top)}px) translate(-50%, -100%)`;
    }
  }

  /** The land under a screen point, or null for the sea and off the map. */
  spotAt(x: number, y: number): GwSpot | null {
    const c = this.transform.screenToWorldCoordinates(x, y);
    if (!this.game.isValidCoord(c.x, c.y)) return null;
    return this.spotOfTile(this.game.ref(c.x, c.y));
  }

  private spotOfTile(tile: number): GwSpot | null {
    const s = this.game.gwScenario();
    const row = s?.region(s.regionIds[tile]);
    if (row === undefined) return null;
    const place = (row.place ?? null) as GwPlace | null;
    return { region: row.id, tile, place, name: row.nameKo };
  }

  spotOfPlace(place: GwPlace): GwSpot | null {
    const [x, y] = GW_PLACES[place].center;
    return this.spotOfTile(this.game.ref(x, y));
  }

  /** Who holds a tile now. */
  holderAt(tile: number): GwTag | null {
    const owner = this.game.owner(tile);
    return owner.isPlayer() ? this.game.gwTagOf(owner.smallID()) : null;
  }

  fly(place: GwPlace): void {
    const p = GW_PLACES[place];
    this.ring(p.id);
    this.look(p.center[0], p.center[1], PLACE_ZOOM);
  }

  /** Centres the camera with nothing in its way: the panels are put away. */
  lookWhole(x: number, y: number, zoom: number): void {
    this.bus.emit(new GoToPositionEvent(x, y, zoom));
  }

  /** Centres the camera on the part of the screen the panels leave free. */
  private look(x: number, y: number, zoom: number): void {
    const phone = window.innerWidth < 640;
    const dx = phone ? 0 : 200 / zoom;
    const dy = phone ? (window.innerHeight * 0.28) / zoom : 0;
    this.bus.emit(
      new GoToPositionEvent(Math.round(x - dx), Math.round(y + dy), zoom),
    );
  }

  ring(region: number | null): void {
    this.ringed = region;
  }

  /** A region glows for a moment as it changes hands. */
  flash(region: number): void {
    this.flashes.set(region, performance.now());
  }

  /** Tiles waiting in `region`, nearest to the mover's side first. */
  takeHeld(region: number, fromX: number, fromY: number): number[] {
    const s = this.game.gwScenario();
    if (s === null) return [];
    const mine: number[] = [];
    this.held = this.held.filter((t) => {
      if (s.regionIds[t] !== region) return true;
      mine.push(t);
      return false;
    });
    const d = (t: number) =>
      Math.hypot(this.game.x(t) - fromX, this.game.y(t) - fromY);
    return mine.sort((a, b) => d(a) - d(b));
  }

  draw(tiles: readonly number[]): void {
    this.view.releaseTiles(tiles);
  }

  /** Everything still waiting goes on the map. */
  drawHeld(): void {
    if (this.held.length === 0) return;
    this.view.releaseTiles(this.held);
    this.held = [];
  }

  private pathOf(region: number): Path2D {
    const known = this.paths.get(region);
    if (known !== undefined) return known;
    const s = this.game.gwScenario();
    const path = new Path2D();
    if (s !== null) {
      s.ensureRegionTiles(this.game);
      const ids = s.regionIds;
      const w = this.game.width();
      for (const t of s.regionTiles(region)) {
        const x = t % w;
        const y = (t - x) / w;
        if (ids[t - 1] !== region) edge(path, x, y, x, y + 1);
        if (ids[t + 1] !== region) edge(path, x + 1, y, x + 1, y + 1);
        if (ids[t - w] !== region) edge(path, x, y, x + 1, y);
        if (ids[t + w] !== region) edge(path, x, y + 1, x + 1, y + 1);
      }
    }
    this.paths.set(region, path);
    return path;
  }

  /** The rings and flashes, drawn in tile space over the map. */
  private ink(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>("[data-gw-ink]");
    const ctx = canvas?.getContext("2d") ?? null;
    if (canvas === null || ctx === null) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const now = performance.now();
    for (const [id, at] of this.flashes) {
      if (now - at > FLASH_MS) this.flashes.delete(id);
    }
    if (this.ringed === null && this.flashes.size === 0) return;
    const o = this.transform.worldToScreenCoordinates(new Cell(0, 0));
    const u = this.transform.worldToScreenCoordinates(new Cell(1000, 0));
    const scale = (u.x - o.x) / 1000;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, o.x * dpr, o.y * dpr);
    ctx.lineJoin = "round";
    if (this.ringed !== null) {
      const path = this.pathOf(this.ringed);
      ctx.strokeStyle = "rgba(15,23,42,0.75)";
      ctx.lineWidth = 4 / scale;
      ctx.stroke(path);
      ctx.strokeStyle = "rgba(252,211,77,0.95)";
      ctx.lineWidth = 2 / scale;
      ctx.stroke(path);
    }
    for (const [id, at] of this.flashes) {
      const left = 1 - (now - at) / FLASH_MS;
      ctx.strokeStyle = `rgba(255,255,255,${left.toFixed(2)})`;
      ctx.lineWidth = (2 + 3 * left) / scale;
      ctx.stroke(this.pathOf(id));
    }
  }
}

const FLASH_MS = 1400;

function near(t: { x: number; y: number }, x: number, y: number): boolean {
  return Math.abs(t.x - x) < LABEL_W && Math.abs(t.y - y) < LABEL_H;
}

function edge(p: Path2D, x0: number, y0: number, x1: number, y1: number): void {
  p.moveTo(x0, y0);
  p.lineTo(x1, y1);
}
