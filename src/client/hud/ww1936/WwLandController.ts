// World War 1936 P2 (spec §15.3, plan decision 25): the map's tap flow.
// A tap on one of my tokens chooses that army (again over a stack: the
// next one); with an army chosen, a tap on a region is an order's first
// tap (its preview shows on the army card) and a second tap on the same
// region gives it; a tap anywhere else cancels. Drags move the map.
import { frontOf, frontSize } from "@openfront/engine-lib/ww1936/FrontRules";
import {
  EventBus,
  EventConstructor,
  GameEvent,
} from "@openfront/shared/EventBus";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import {
  ContextMenuEvent,
  DragEvent,
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
import { WwMultiSelectEvent } from "./DepthEvents";
import {
  borderRegions,
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
import {
  armyGroupColorsOf,
  MULTI_PRESS_MS,
  multiSelectOf,
} from "./MultiSelect";
import { today, TWO_TAP_MIN_MS, wwActive } from "./WorldWarModel";
import type { WwSeaAirController } from "./WwSeaAirController";

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
  /** P4 (plan decision 40): the navy's and the air war's taps; null: none. */
  seaAir: Pick<
    WwSeaAirController,
    "handleTap" | "keepsArmy" | "selectFleet" | "selectZone"
  > | null;
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
  private unregisterMultiBack: (() => void) | null = null;
  /** P6 (spec §20.4): the 500 ms press on one of my tokens, and the tap that ends it. */
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private pressed = false;

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
      seaAir: null,
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
    this.eventBus.on(MouseDownEvent, (e) => {
      this.down = { x: e.x, y: e.y };
      this.pressStart(e.x, e.y);
    });
    // A map drag is no press.
    this.eventBus.on(DragEvent, () => this.pressStop());
    this.eventBus.on(MouseUpEvent, (e) => this.tap(e.x, e.y));
    this.eventBus.on(TouchEvent, (e) => this.tap(e.x, e.y));
    this.eventBus.on(WwSelectArmyEvent, (e) => this.select(e.army));
    this.eventBus.on(WwLandModeEvent, (e) => this.setMode(e.mode));
  }

  getTickIntervalMs() {
    return 250;
  }

  /** The army group colours the token pass draws (synced when the depth view changes). */
  tick() {
    const view = this.game.wwLand?.() ?? null;
    const depth = this.game.wwDepth?.() ?? null;
    if (view !== null && depth !== null) armyGroupColorsOf(view).sync(depth);
  }

  private get multi() {
    return multiSelectOf(this.selection);
  }

  private pressStart(x: number, y: number): void {
    this.pressStop();
    this.pressed = false;
    if (this.myId() === null) return;
    this.pressTimer = setTimeout(() => {
      this.pressTimer = null;
      const view = this.game.wwLand?.() ?? null;
      const me = this.myId();
      if (view === null || me === null) return;
      const zoom = Math.max(1e-6, this.transform.scale);
      const w = this.transform.screenToWorldCoordinatesFloat(x, y);
      const mine = this.deps
        .layout(view, this.game.ticks(), zoom)
        .filter((p) => view.armies.get(p.army)?.owner === me);
      const hit = this.deps.hit(mine, w.x, w.y, TAP_RADIUS_PX / zoom, null);
      if (hit === null) return;
      // The release that follows is not a tap.
      this.pressed = true;
      this.startMulti(hit);
    }, MULTI_PRESS_MS);
  }

  private pressStop(): void {
    if (this.pressTimer !== null) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  /** Starts the multi-select mode with `army`; the army card steps aside. */
  startMulti(army: number): void {
    this.select(null);
    this.multi.start(army);
    this.unregisterMultiBack?.();
    this.unregisterMultiBack = registerBackClosable(() => {
      if (!this.multi.active) return false;
      this.endMulti();
      return true;
    });
    this.eventBus.emit(new WwMultiSelectEvent([...this.multi.armies]));
    this.changed();
  }

  endMulti(): void {
    this.multi.cancel();
    this.unregisterMultiBack?.();
    this.unregisterMultiBack = null;
    this.eventBus.emit(new WwMultiSelectEvent([]));
    this.changed();
  }

  /** A tap while choosing several: a token toggles, a front flow's region picks; true (the tap is ours). */
  private multiTap(
    view: WwLandView,
    me: number,
    w: { x: number; y: number },
    zoom: number,
  ): boolean {
    const m = this.multi;
    const mine = this.deps
      .layout(view, this.game.ticks(), zoom)
      .filter((p) => view.armies.get(p.army)?.owner === me);
    const hit = this.deps.hit(mine, w.x, w.y, TAP_RADIUS_PX / zoom, null);
    if (m.frontGroup === null || hit !== null) {
      if (hit !== null && m.toggle(hit)) {
        this.eventBus.emit(new WwMultiSelectEvent([...m.armies]));
        if (!m.active) this.endMulti();
      }
      this.changed();
      return true;
    }
    // The group's front: a border region, then the same region again.
    const region = this.regionAt(view, w.x, w.y);
    const sides = this.sides();
    if (!borderRegions(view, me, sides).includes(region)) {
      m.pending = null;
      m.version++;
      this.changed();
      return true;
    }
    const now = this.deps.now();
    if (m.pending !== region) {
      m.pending = region;
      this.pendingAt = now;
      m.version++;
      this.changed();
      return true;
    }
    if (now - this.pendingAt < TWO_TAP_MIN_MS) return true;
    const divisions = (
      this.game
        .wwDepth?.()
        ?.armyGroups()
        .find((g) => g.id === m.frontGroup)?.armies ?? []
    ).reduce((n, a) => n + (view.armies.get(a)?.divisions ?? 0), 0);
    const regions = groupFront(view, me, sides, region, divisions);
    if (regions.length > 0) {
      this.eventBus.emit(
        new SendWwOrderIntentEvent({
          kind: "ag_front",
          group: m.frontGroup,
          frontRegions: regions,
          enemy: 0,
        }),
      );
    }
    m.frontGroup = null;
    m.pending = null;
    m.version++;
    this.changed();
    return true;
  }

  /** A short tap on the map at screen (x, y); true when the land flow took it. */
  tap(x: number, y: number): boolean {
    this.pressStop();
    if (this.pressed) {
      // The release of a long press: it started the mode, it is no tap.
      this.pressed = false;
      this.down = null;
      taken.set(this.game, { x, y, at: Date.now() });
      return true;
    }
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
    if (me === null) return null;
    // P5 pre-flight §0-1: an exile still commands its divisions.
    return wwActive(this.game, me.smallID()) ? me.smallID() : null;
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
    if (this.multi.active) return this.multiTap(view, me, w, zoom);
    // 1. One of my tokens: choose it (over a stack, the one after the chosen).
    const mine = this.deps
      .layout(view, this.game.ticks(), zoom)
      .filter((p) => view.armies.get(p.army)?.owner === me);
    const hit = this.deps.hit(mine, w.x, w.y, radius, sel.army);
    if (hit !== null) {
      // In an order mode another army's token stands for its region (move
      // or rail onto a friendly stack); the chosen army's own token in
      // reach still chooses (or cycles) as usual.
      const own = mine.some(
        (p) =>
          p.army === sel.army &&
          (p.x - w.x) * (p.x - w.x) + (p.y - w.y) * (p.y - w.y) <=
            radius * radius,
      );
      const at = view.armies.get(hit)?.region ?? 0;
      if (sel.army !== null && sel.mode !== "none" && !own && at !== 0) {
        this.regionTap(view, me, sel.army, at);
      } else {
        this.select(hit);
      }
      return true;
    }
    // P4 (plan decision 40): then the navy's and the air war's taps — a
    // fleet token, a mission's or a landing's target, an air zone — unless
    // the chosen army waits for its order's tap.
    const seaAir = this.deps.seaAir;
    if (seaAir !== null && (sel.army === null || sel.mode === "none")) {
      // A landing's taps keep the army (asked before: its last tap ends the mode).
      const keep = seaAir.keepsArmy();
      if (seaAir.handleTap(w.x, w.y, radius, sel.army !== null)) {
        if (sel.army !== null && !keep) this.select(null);
        return true;
      }
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
      // A plan's draft survives stray taps: the card's back or cancel ends it.
      if (sel.mode !== "plan") this.cancel();
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
    this.modeTo("none");
    this.changed();
  }

  /** The selection's mode; leaving plan mode drops the plan's draft. */
  private modeTo(mode: LandMode): void {
    const sel = this.selection;
    if (sel.mode === "plan" && mode !== "plan") sel.targets = [];
    sel.setMode(mode);
  }

  /** "Elsewhere": the preview, else the mode, else the chosen army goes. */
  private cancel(): void {
    const sel = this.selection;
    if (sel.pending !== null) {
      sel.pending = null;
      sel.version++;
    } else if (sel.mode !== "none") {
      this.modeTo("none");
    } else {
      this.select(null);
      return;
    }
    this.changed();
  }

  private select(army: number | null): void {
    this.selection.select(army);
    // One card at a time: an army hides the fleet's and the zone's (P4).
    if (army !== null) {
      this.deps.seaAir?.selectFleet(0);
      this.deps.seaAir?.selectZone(0);
    }
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
    this.modeTo(mode);
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

/** Spec §4.3: the front a group holds from `anchor`, sized by all its divisions (ag_front splits it by army). */
export function groupFront(
  view: WwLandView,
  me: number,
  sides: LandSides,
  anchor: number,
  divisions: number,
): number[] {
  return frontOf(
    {
      scenario: view.scenario,
      controller: view.controller,
      sameSide: sides.sameSide,
      isEnemy: sides.isEnemy,
    },
    me,
    0,
    anchor,
    frontSize(divisions),
  );
}
