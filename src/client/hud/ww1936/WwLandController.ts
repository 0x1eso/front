// World War 1936 P2 (spec §15.3, plan decision 25): the map's tap flow.
// A tap on one of my tokens chooses that army (again over a stack: the
// next one); with an army chosen, a tap on a region is an order's first
// tap (its preview shows on the army card) and a second tap on the same
// region gives it; a tap anywhere else cancels. Drags move the map.
import {
  EventBus,
  EventConstructor,
  GameEvent,
} from "@openfront/shared/EventBus";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import {
  ContextMenuEvent,
  MouseDownEvent,
  MouseUpEvent,
  TouchEvent,
} from "../../InputHandler";
import { SendWwOrderIntentEvent } from "../../Transport";
import type { GameView } from "../../view";
import {
  battleMarkers,
  hitToken,
  layoutTokens,
} from "../../view/LandTokenLayout";
import type { WwLandView } from "../../view/WwLandView";
import {
  LandSides,
  landSidesOf,
  orderBlock,
  tapKind,
  tapOrder,
  toggleTarget,
} from "./LandModel";
import {
  LandMode,
  landSelectionOf,
  OpenWwBattleEvent,
  WwLandModeEvent,
  WwLandSelection,
  WwSelectArmyEvent,
} from "./LandSelection";
import { isCapitulated, today, TWO_TAP_MIN_MS } from "./WorldWarModel";

/** A finger's reach on the map (spec §15.9), in screen px. */
export const TAP_RADIUS_PX = 24;
/** A press that travels this far moved the map (InputHandler's touch slop). */
const DRAG_PX = 16;

/** The chosen army, its mode or its draft changed: the card and the drawer redraw. */
export class WwLandChangedEvent implements GameEvent {}

/** What the controller needs of the TransformHandler. */
export interface LandTransform {
  /** Screen px per tile. */
  scale: number;
  screenToWorldCoordinatesFloat(x: number, y: number): { x: number; y: number };
}

/** The render lane's layout and hit test (LandTokenLayout), injectable for tests. */
export interface LandTapDeps {
  layout: typeof layoutTokens;
  hit: typeof hitToken;
  markers: typeof battleMarkers;
  now: () => number;
}

/** The last tap the land flow took, per game (landTookTap). */
const taken = new WeakMap<object, { x: number; y: number; at: number }>();

/**
 * Whether the land flow just took the tap at screen (x, y): then the
 * radial menu (whose full-screen overlay would swallow the confirming
 * tap) and the region card stay shut for it.
 */
export function landTookTap(
  game: object,
  x: number,
  y: number,
  now = Date.now(),
): boolean {
  const t = taken.get(game);
  return t !== undefined && t.x === x && t.y === y && now - t.at < 1000;
}

/**
 * The warship controller's bus in this mode: its touch fallback, the
 * radial menu (a ContextMenuEvent), does not open for a tap the land flow
 * took. Everything else goes to the game's bus.
 */
export class LandTapBus extends EventBus {
  constructor(
    private readonly inner: EventBus,
    private readonly game: object,
  ) {
    super();
  }

  emit<T extends GameEvent>(event: T): void {
    if (
      event instanceof ContextMenuEvent &&
      landTookTap(this.game, event.x, event.y)
    ) {
      return;
    }
    this.inner.emit(event);
  }

  on<T extends GameEvent>(
    eventType: EventConstructor<T>,
    callback: (event: T) => void,
  ): void {
    this.inner.on(eventType, callback);
  }

  off<T extends GameEvent>(
    eventType: EventConstructor<T>,
    callback: (event: T) => void,
  ): void {
    this.inner.off(eventType, callback);
  }
}

export class WwLandController implements Controller {
  private readonly deps: LandTapDeps;
  private down: { x: number; y: number } | null = null;
  /** When the pending region got its first tap (a double tap must not confirm). */
  private pendingAt = 0;
  private unregisterBack: (() => void) | null = null;

  constructor(
    private readonly game: GameView,
    private readonly eventBus: EventBus,
    private readonly transform: LandTransform,
    deps: Partial<LandTapDeps> = {},
  ) {
    this.deps = {
      layout: layoutTokens,
      hit: hitToken,
      markers: battleMarkers,
      now: () => Date.now(),
      ...deps,
    };
  }

  private get selection(): WwLandSelection {
    return landSelectionOf(this.game);
  }

  private sides(): LandSides {
    return landSidesOf(this.game);
  }

  init() {
    this.eventBus.on(MouseDownEvent, (e) => (this.down = { x: e.x, y: e.y }));
    this.eventBus.on(MouseUpEvent, (e) => this.tap(e.x, e.y));
    this.eventBus.on(TouchEvent, (e) => this.tap(e.x, e.y));
    this.eventBus.on(WwSelectArmyEvent, (e) => this.select(e.army));
    this.eventBus.on(WwLandModeEvent, (e) => this.setMode(e.mode));
  }

  /** A short tap on the map at screen (x, y); true when the land flow took it. */
  tap(x: number, y: number): boolean {
    const down = this.down;
    this.down = null;
    // Defence in depth: InputHandler sends only taps, but a press that
    // travelled moved the map and orders nothing.
    if (
      down !== null &&
      Math.abs(x - down.x) + Math.abs(y - down.y) >= DRAG_PX
    ) {
      return false;
    }
    const took = this.handle(x, y);
    if (took) taken.set(this.game, { x, y, at: Date.now() });
    return took;
  }

  private myId(): number | null {
    if (this.game.worldWarScenario() === null) return null;
    const me = this.game.myPlayer();
    if (me === null || !me.isAlive()) return null;
    return isCapitulated(this.game, me.smallID()) ? null : me.smallID();
  }

  private handle(x: number, y: number): boolean {
    const view = this.game.wwLand?.() ?? null;
    const me = this.myId();
    if (view === null || me === null) return false;
    const sel = this.selection;
    if (sel.army !== null && view.armies.get(sel.army)?.owner !== me) {
      this.select(null);
    }
    const zoom = Math.max(1e-6, this.transform.scale);
    const w = this.transform.screenToWorldCoordinatesFloat(x, y);
    const radius = TAP_RADIUS_PX / zoom;
    // 1. One of my tokens: choose it (over a stack, the one after the chosen).
    const mine = this.deps
      .layout(view, this.game.ticks(), zoom)
      .filter((p) => view.armies.get(p.army)?.owner === me);
    const hit = this.deps.hit(mine, w.x, w.y, radius, sel.army);
    if (hit !== null) {
      this.select(hit);
      return true;
    }
    // 2. No army chosen: a battle marker opens its card; the rest is the
    // map's (the radial menu, the region card).
    if (sel.army === null) {
      const marker = this.markerAt(view, w.x, w.y, radius);
      if (marker === null) return false;
      this.eventBus.emit(new OpenWwBattleEvent(marker));
      return true;
    }
    // 3. An army chosen: an order's first or second tap, or a cancel.
    this.regionTap(view, me, sel.army, this.regionAt(view, w.x, w.y));
    return true;
  }

  private markerAt(
    view: WwLandView,
    wx: number,
    wy: number,
    radius: number,
  ): number | null {
    let best: number | null = null;
    let bestD = radius * radius;
    for (const m of this.deps.markers(view)) {
      const d = (m.x - wx) * (m.x - wx) + (m.y - wy) * (m.y - wy);
      if (d <= bestD) {
        best = m.region;
        bestD = d;
      }
    }
    return best;
  }

  private regionAt(view: WwLandView, wx: number, wy: number): number {
    const s = view.scenario;
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);
    if (tx < 0 || ty < 0 || tx >= s.width || ty >= s.height) return 0;
    return s.regionAt(ty * s.width + tx);
  }

  private regionTap(
    view: WwLandView,
    me: number,
    army: number,
    region: number,
  ): void {
    const sel = this.selection;
    const sides = this.sides();
    const kind = tapKind(view, me, sel.mode, region, sides);
    if (kind === null) {
      this.cancel();
      return;
    }
    if (kind === "plan") {
      sel.targets = toggleTarget(sel.targets, region);
      sel.pending = null;
      this.changed();
      return;
    }
    const now = this.deps.now();
    if (sel.pending !== region) {
      sel.pending = region;
      this.pendingAt = now;
      this.changed();
      return;
    }
    // The same region again: the confirming tap — unless it came as a
    // double tap, before the preview could be read.
    if (now - this.pendingAt < TWO_TAP_MIN_MS) return;
    const order = tapOrder(kind, army, region);
    const economy = this.game.wwEconomy?.() ?? null;
    if (order === null || economy === null) return;
    // Refused: the card shows why (the same check); the preview stays.
    if (
      orderBlock(view, economy, me, today(this.game), order, sides) !== null
    ) {
      return;
    }
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
    sel.setMode("none");
    this.changed();
  }

  /** "Elsewhere": the preview, else the mode, else the chosen army goes. */
  private cancel(): void {
    const sel = this.selection;
    if (sel.pending !== null) {
      sel.pending = null;
      sel.version++;
    } else if (sel.mode !== "none") {
      sel.setMode("none");
    } else {
      this.select(null);
      return;
    }
    this.changed();
  }

  private select(army: number | null): void {
    this.selection.select(army);
    this.unregisterBack?.();
    this.unregisterBack = null;
    if (army !== null) {
      // Registered on each choice, after the drawers: Back closes an open
      // drawer first, then lets go of the army.
      this.unregisterBack = registerBackClosable(() => {
        if (this.selection.army === null) return false;
        this.select(null);
        return true;
      });
    }
    this.changed();
  }

  private setMode(mode: LandMode): void {
    const sel = this.selection;
    if (sel.army === null) return;
    sel.setMode(mode);
    // A plan's draft starts from the plan the army runs.
    if (mode === "plan" && sel.targets.length === 0) {
      const order = this.game.wwLand?.()?.armies.get(sel.army)?.mine?.order;
      if (order?.kind === "plan") {
        sel.targets = [...order.targets];
        sel.stance = order.stance;
      }
    }
    this.changed();
  }

  private changed(): void {
    this.eventBus.emit(new WwLandChangedEvent());
  }
}
