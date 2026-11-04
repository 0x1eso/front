// World War 1936 P2 (spec §15.3, plan decision 25): the map's tap flow.
// A tap on one of my tokens chooses that army (again over a stack: the
// next one); with an army chosen, a tap on a region is an order's first
// tap (its preview shows on the army card) and a second tap on the same
// region gives it; a tap anywhere else cancels. Drags move the map.
import type { LandOrder } from "@openfront/engine-api/Schemas";
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
import { showToast } from "../../Utils";
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
  cardBlockText,
  directOrder,
  directTargetsOf,
  groupZone,
  LandSides,
  landSidesOf,
  orderBlock,
  planOrder,
  tapDirectTargets,
  tapKind,
  tapOrder,
  toggleTarget,
  toggleZone,
  zoneOrder,
  zoneShown,
} from "./LandModel";
import {
  LandMode,
  landSelectionOf,
  OpenWwBattleEvent,
  WwLandModeEvent,
  WwLandSelection,
  WwSelectArmyEvent,
} from "./LandSelection";
import { linePeaceMapTap } from "./LinePeaceModel";
import {
  armyGroupColorsOf,
  MULTI_PRESS_MS,
  multiSelectOf,
} from "./MultiSelect";
import { negPeaceMapTap } from "./NegPeaceModel";
import { peaceMapTap } from "./PeaceModel";
import { wingUiOf, WwWingChangedEvent } from "./WingUi";
import { today, TWO_TAP_MIN_MS, wwActive } from "./WorldWarModel";
import type { WwSeaAirController } from "./WwSeaAirController";

/** How long a tapped zone stays on screen before the engine's own zone replaces it. */
const ZONE_DRAFT_MS = 4000;
/** ww42: taps closer than this to the last direct order build on its target list. */
const DIRECT_DRAFT_MS = 2500;
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
  /** ww8 (lane G): the wing orders' target taps, asked first; true when it took the tap. */
  wing: ((wx: number, wy: number, radius: number) => boolean) | null;
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
  private directAt = 0;
  private directDraft: number[] = [];
  private unregisterBack: (() => void) | null = null;
  private unregisterMultiBack: (() => void) | null = null;
  /** P6 (spec §20.4): the 500 ms press on one of my tokens, and the tap that ends it. */
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private pressed = false;
  /** When the zone draft (selection.zoneDraft) was last sent. */
  private zoneDraftAt = 0;

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
      wing: null,
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

  /** The army group colours the token pass draws (synced when the depth view changes); a tapped zone gives way to the engine's. */
  tick() {
    const view = this.game.wwLand?.() ?? null;
    const depth = this.game.wwDepth?.() ?? null;
    if (view !== null && depth !== null) armyGroupColorsOf(view).sync(depth);
    this.dropZoneDraft(view);
  }

  /** The tapped zone shows until the engine's order carries it (or ZONE_DRAFT_MS pass). */
  private dropZoneDraft(view: WwLandView | null): void {
    const sel = this.selection;
    const draft = sel.zoneDraft;
    if (draft === null || view === null) return;
    const order =
      sel.army === null ? undefined : view.armies.get(sel.army)?.mine?.order;
    const same =
      order !== undefined &&
      order.zone.length === draft.length &&
      order.zone.every((r, i) => r === draft[i]);
    if (!same && this.deps.now() - this.zoneDraftAt < ZONE_DRAFT_MS) return;
    sel.zoneDraft = null;
    sel.version++;
    this.changed();
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
      // A hold during multi-select keeps the selection.
      if (hit === null || this.multi.active) return;
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
      // Elsewhere: a front flow begun from the group tab ends; the bar's stays.
      if (m.active) {
        m.pending = null;
        m.version++;
      } else m.cancel();
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
    // P5 (lane U1, spec §20.2): the conference map mode takes every tap first.
    if (peaceMapTap(this.game, this.regionAt(view, w.x, w.y))) return true;
    // Negotiated peace: the composer's region pick mode, likewise.
    if (negPeaceMapTap(this.game, this.regionAt(view, w.x, w.y))) return true;
    // Peace on the current line: its map names the tapped region.
    if (linePeaceMapTap(this.game, this.regionAt(view, w.x, w.y))) return true;
    const radius = TAP_RADIUS_PX / zoom;
    // ww8: a wing order waiting for its target takes the tap before any token.
    if (this.deps.wing?.(w.x, w.y, radius) === true) return true;
    if (this.multi.active || this.multi.frontGroup !== null) {
      return this.multiTap(view, me, w, zoom);
    }
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
      // A plan's draft and a zone being tapped survive stray taps: the
      // card's back or cancel ends them.
      if (sel.mode !== "plan" && sel.mode !== "front") this.cancel();
      return;
    }
    if (kind === "direct") {
      this.directTap(view, me, army, region);
      return;
    }
    if (kind === "plan") {
      // ww7: [공격] — a target joins or leaves the plan, which goes to the
      // engine at once (its zone and odds come back with the next update).
      const next = toggleTarget(sel.targets, region);
      // A fourth target changes nothing: nothing to send.
      const same =
        next.length === sel.targets.length &&
        next.every((t, i) => t === sel.targets[i]);
      sel.targets = next;
      sel.pending = null;
      if (!same) this.sendPlan(view, army);
      this.changed();
      return;
    }
    if (kind === "zone") {
      // ww7: [방어] — a border region joins or leaves the zone (the whole
      // list goes; empty: the engine picks the zone again).
      const next = toggleZone(zoneShown(view, sel, army), region);
      sel.zoneDraft = next;
      sel.pending = null;
      sel.version++;
      this.zoneDraftAt = this.deps.now();
      this.eventBus.emit(new SendWwOrderIntentEvent(zoneOrder(army, next)));
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

  /**
   * ww42: a tap on an enemy region with an army chosen: the attack starts at
   * once; each further tap adds a target (taken in order); a target tapped
   * again is dropped (the last one stops the attack). A refused order is
   * told at once (the card and a toast) and changes nothing.
   */
  private directTap(
    view: WwLandView,
    me: number,
    army: number,
    region: number,
  ): void {
    const sel = this.selection;
    const now = this.deps.now();
    const cur = directTargetsOf(view.armies.get(army));
    // Taps that come faster than the engine's update build on each other.
    const base =
      this.directDraft.length > 0 && now - this.directAt < DIRECT_DRAFT_MS
        ? this.directDraft
        : cur;
    const next = tapDirectTargets(base, region);
    if (next.length === base.length && next.every((t, i) => t === base[i])) {
      return;
    }
    const order: LandOrder =
      next.length === 0 ? { kind: "army_halt", army } : directOrder(army, next);
    const economy = this.game.wwEconomy?.() ?? null;
    if (economy === null) return;
    const block = orderBlock(
      view,
      economy,
      me,
      today(this.game),
      order,
      this.sides(),
    );
    sel.pending = null;
    if (block !== null) {
      sel.refusal = block;
      sel.version++;
      showToast(cardBlockText(block), "red");
      this.changed();
      return;
    }
    sel.refusal = null;
    this.directDraft = next;
    this.directAt = now;
    sel.version++;
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
    this.changed();
  }

  /**
   * ww7: sends the chosen targets and stance as the army's plan. A plan
   * that ran keeps running (army_plan stops it, so execute follows).
   */
  private sendPlan(view: WwLandView, army: number): void {
    const sel = this.selection;
    const was = view.armies.get(army)?.mine?.order;
    this.eventBus.emit(
      new SendWwOrderIntentEvent(planOrder(army, sel.targets, sel.stance)),
    );
    if (was?.kind === "plan" && was.executing && sel.targets.length > 0) {
      this.eventBus.emit(
        new SendWwOrderIntentEvent({ kind: "army_execute", army, on: true }),
      );
    }
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
      // ...and the wing card (a token tap does not go through WwSelectArmyEvent).
      const wings = wingUiOf(this.game);
      if (wings.ids.length > 0 || wings.mode !== "none") {
        wings.clear();
        this.eventBus.emit(new WwWingChangedEvent());
      }
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
  return groupZone(view, me, sides, anchor, divisions);
}
