import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { EventBus } from "@openfront/shared/EventBus";
import { MouseUpEvent } from "../../InputHandler";
import type { MapRenderer } from "../../render/gl/MapRenderer";
import type {
  OccupationCell,
  OccupationSource,
} from "../../render/gl/passes/OccupationPass";
import {
  GoToPositionEvent,
  type TransformHandler,
} from "../../TransformHandler";
import type { GameView } from "../../view";
import { placeOfRegion } from "./GwTableModel";

/** How wide a name on the map is, and how tall: closer ones give way. */
const TAG_W = 58;
const TAG_H = 17;
/** The drawer: beside the map from this width, under it below that. */
const DRAWER_BESIDE = 640;
const DRAWER_W = 400;
const DRAWER_UP = 0.42;

/**
 * The paint on the map for the war aims and the peace table: regions filled
 * through the occupation pass, names kept on their tiles, and a tap read as a
 * place. `cells` returns null while nothing is painted, and then the map is as
 * it always was.
 */
export class GwMapPaint implements OccupationSource {
  private drawn: readonly OccupationCell[] = [];
  private looping = false;

  constructor(
    private readonly game: GameView,
    private readonly bus: EventBus,
    private readonly transform: TransformHandler,
    view: MapRenderer,
    private readonly now: () => readonly OccupationCell[] | null,
    private readonly tapped: (place: GwPlace) => void,
  ) {
    const scenario = game.gwScenario();
    if (scenario !== null) {
      view.setRegionIds(scenario.regionIds);
      view.setOccupationMap(this);
    }
    bus.on(MouseUpEvent, (e) => this.onTap(e.x, e.y));
  }

  on(): boolean {
    const cells = this.now();
    this.drawn = cells ?? [];
    return cells !== null;
  }

  key(): string {
    return this.drawn
      .map((c) => `${c.region}:${c.level}:${c.flags}:${c.rgb[0]}`)
      .join(",");
  }

  cells(): readonly OccupationCell[] {
    return this.drawn;
  }

  private onTap(x: number, y: number): void {
    if (this.now() === null) return;
    const cell = this.transform.screenToWorldCoordinates(x, y);
    if (!this.game.isValidCoord(cell.x, cell.y)) return;
    const scenario = this.game.gwScenario();
    const tile = this.game.ref(cell.x, cell.y);
    const place = placeOfRegion(scenario?.regionIds[tile] ?? 0);
    if (place !== null) this.tapped(place);
  }

  fly(place: GwPlace): void {
    const [x, y] = GW_PLACES[place].center;
    this.flyTo(x, y);
  }

  /** Brings a tile to the middle of what the drawer leaves of the map. */
  flyTo(x: number, y: number): void {
    const scale = Math.max(this.transform.scale, 0.1);
    const wide = window.innerWidth >= DRAWER_BESIDE;
    const dx = wide ? DRAWER_W / 2 / scale : 0;
    const dy = wide ? 0 : (window.innerHeight * DRAWER_UP) / 2 / scale;
    this.bus.emit(
      new GoToPositionEvent(Math.round(x - dx), Math.round(y + dy)),
    );
  }

  /** Keeps the names on the map on their tiles while there are any. */
  keepTags(): void {
    if (this.looping) return;
    this.looping = true;
    const frame = () => {
      const tags = document.querySelectorAll<HTMLElement>("[data-gw-tag-at]");
      if (tags.length === 0) {
        this.looping = false;
        return;
      }
      this.place(tags);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private place(tags: NodeListOf<HTMLElement>): void {
    const taken: { x: number; y: number }[] = [];
    for (const el of tags) {
      const [wx, wy] = (el.dataset.gwTagAt ?? "0 0").split(" ").map(Number);
      const p = this.transform.worldToScreenCoordinates({ x: wx, y: wy } as never);
      const crowded = taken.some(
        (o) => Math.abs(o.x - p.x) < TAG_W && Math.abs(o.y - p.y) < TAG_H,
      );
      el.style.display = crowded ? "none" : "";
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -50%)`;
      if (!crowded) taken.push(p);
    }
  }
}
