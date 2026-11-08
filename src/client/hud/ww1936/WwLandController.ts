// World War 1936 P2 (spec §15.3, plan decision 25): the map's tap flow.
// A tap on one of my tokens chooses that army (again over a stack: the
// next one); with an army chosen, a tap on a region is an order's first
// tap (its preview shows on the army card) and a second tap on the same
// region gives it; a tap anywhere else cancels. Drags move the map.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { WwArmyGroupData } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  type ArmySummary,
  WW_GOAL_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  type FrontWorld,
  suggestFallback,
} from "@openfront/engine-lib/ww1936/FrontRules";
import {
  EventBus,
  EventConstructor,
  GameEvent,
} from "@openfront/shared/EventBus";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import {
  ClaimDragEvent,
  CloseViewEvent,
  ContextCancelEvent,
  ContextMenuEvent,
  DragEvent,
  MouseDownEvent,
  MouseUpEvent,
  TouchEvent,
  WwStrokeEvent,
} from "../../InputHandler";
import { SendWwOrderIntentEvent } from "../../Transport";
import { showToast, translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  battleMarkers,
  counterStateOf,
  hitCounter,
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
  type DrawMode,
  LandMode,
  landSelectionOf,
  OpenWwBattleEvent,
  type PlannerAction,
  WwDrawModeEvent,
  WwLandModeEvent,
  WwLandSelection,
  WwPlannerEvent,
  WwPlanViewEvent,
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
import { PLANNER_KEYS } from "./PlannerKeys";
import {
  chainFromSamples,
  extendFront,
  fallbackOrder,
  type FrontDraft,
  frontFromSamples,
  frontLineOrder,
  goalOrder,
  goalStartOk,
  groupCarries,
  groupChain,
  groupFront as groupLineFront,
  groupLineOrder,
  hitHandle,
  LINE_DRAFT_MS,
  type LineDraft,
  type LineHandle,
  type LineKind,
  moveFrontEnd,
  moveWaypoint,
  orderCarries,
  restoreOrder,
  shownChain,
  shownFront,
  shownHandles,
  tapFallback,
  tapGoal,
} from "./PlannerModel";
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
  // ww162 (battle planner): the stroke a claimed press draws.
  /** What the claimed press moves: a line from its regions, or one handle. */
  private claim: { handle: LineHandle | null } | null = null;
  /** The stroke's regions, in order, no two the same in a row. */
  private samples: number[] = [];
  /** A handle drag's line as it was when the drag began. */
  private dragBase: { front: FrontDraft | null; goal: number[] } | null = null;
  /** The stroke ran past the cap (told once per stroke). */
  private strokeFull = false;
  /** The fallback switch per army, when set before any fallback line exists. */
  private readonly fbManual = new Map<number, boolean>();
  private unregisterDrawBack: (() => void) | null = null;

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
    // ww162 (design §2): the line modes, their strokes and their buttons.
    this.eventBus.on(ClaimDragEvent, (e) => this.claimDrag(e));
    this.eventBus.on(WwStrokeEvent, (e) => this.strokeEvent(e));
    this.eventBus.on(WwDrawModeEvent, (e) =>
      this.toggleDraw(e.mode, e.group ?? null),
    );
    this.eventBus.on(WwPlannerEvent, (e) => this.plannerAction(e.action));
    this.eventBus.on(WwPlanViewEvent, (e) => {
      const sel = this.selection;
      sel.planView = e.on ?? !sel.planView;
      sel.version++;
      this.changed();
    });
    // Esc and a right-click leave a line mode (a right-click opens no menu then).
    this.eventBus.on(CloseViewEvent, () => this.leaveDraw());
    this.eventBus.on(ContextCancelEvent, (e) => {
      if (this.leaveDraw()) e.taken = true;
    });
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
    this.dropLineDraft(view);
  }

  /** ww162: a sent line shows until the army's order carries it (or LINE_DRAFT_MS pass). */
  private dropLineDraft(view: WwLandView | null): void {
    const sel = this.selection;
    const d = sel.line;
    if (d === null || d.live || view === null) return;
    const g = this.groupData();
    const carried =
      g !== null
        ? groupCarries(g, d)
        : orderCarries(view.armies.get(d.army)?.mine?.order, d);
    if (!carried && this.deps.now() - d.sentAt < LINE_DRAFT_MS) {
      return;
    }
    sel.line = null;
    sel.version++;
    this.changed();
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
    // ww162: a line mode draws; a hold there starts no multi-select.
    if (this.selection.draw !== "none") return;
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

  /**
   * ww44: the group tab's [공격] mode: a tap on an enemy region gives every
   * army of the group the direct attack (ag_execute with the targets, taken
   * in order); the same region again removes it; any other region does
   * nothing. A tap on my token ends the mode and chooses it as usual (false).
   */
  private groupAttackTap(
    view: WwLandView,
    me: number,
    w: { x: number; y: number },
    zoom: number,
  ): boolean {
    const m = this.multi;
    const group = m.attackGroup!;
    const mine = this.deps
      .layout(view, this.game.ticks(), zoom)
      .filter((p) => view.armies.get(p.army)?.owner === me);
    if (this.deps.hit(mine, w.x, w.y, TAP_RADIUS_PX / zoom, null) !== null) {
      m.cancel();
      this.changed();
      return false;
    }
    const region = this.regionAt(view, w.x, w.y);
    const sides = this.sides();
    if (!sides.isEnemy(me, view.controller[region])) return true;
    const armies =
      this.game
        .wwDepth?.()
        ?.armyGroups()
        .find((g) => g.id === group)?.armies ?? [];
    const next = tapDirectTargets(m.attackTargets, region);
    if (
      next.length === m.attackTargets.length &&
      next.every((t, i) => t === m.attackTargets[i])
    ) {
      return true;
    }
    const economy = this.game.wwEconomy?.() ?? null;
    if (economy === null) return true;
    if (next.length === 0) {
      for (const army of armies) {
        this.eventBus.emit(
          new SendWwOrderIntentEvent({ kind: "army_halt", army }),
        );
      }
      m.attackTargets = [];
      m.version++;
      this.changed();
      return true;
    }
    // Refused for every army of the group: told at once, nothing sent.
    const blocks = armies.map((army) =>
      orderBlock(
        view,
        economy,
        me,
        today(this.game),
        directOrder(army, next),
        sides,
      ),
    );
    if (blocks.length > 0 && blocks.every((b) => b !== null)) {
      showToast(cardBlockText(blocks[0]!), "red");
      return true;
    }
    m.attackTargets = next;
    m.version++;
    this.eventBus.emit(
      new SendWwOrderIntentEvent({ kind: "ag_execute", group, targets: next }),
    );
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
    // ww162 §3.1: from zoom 6 my armies stand as division counters; a tap
    // on one picks that division ([사단]), a "+N" chip fans its region out.
    if (
      sel.mode === "none" &&
      (sel.draw === "none" || sel.draw === "divisions") &&
      this.counterTap(view, me, w, zoom)
    ) {
      return true;
    }
    // ww162 (design §2): in a line mode every tap edits the line.
    if (sel.draw !== "none" && sel.army !== null) {
      this.drawTap(view, me, sel.army, this.regionAt(view, w.x, w.y));
      return true;
    }
    if (
      this.multi.attackGroup !== null &&
      this.groupAttackTap(view, me, w, zoom)
    ) {
      return true;
    }
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

  /**
   * ww162 §3.1: a tap on one of my division counters picks that division and
   * opens the card in [사단] (in [사단] already, it joins or leaves the pick);
   * a "+N" chip opens or closes its region's fan. False for anything else
   * (an army counter goes on to today's token tap).
   */
  private counterTap(
    view: WwLandView,
    me: number,
    w: { x: number; y: number },
    zoom: number,
  ): boolean {
    const m = this.multi;
    if (m.active || m.frontGroup !== null || m.attackGroup !== null) {
      return false;
    }
    const mine = this.deps
      .layout(view, this.game.ticks(), zoom)
      .filter(
        (p) =>
          (p.division !== undefined || p.more !== undefined) &&
          view.armies.get(p.army)?.owner === me,
      );
    if (mine.length === 0) return false;
    const hit = hitCounter(
      mine,
      w.x,
      w.y,
      TAP_RADIUS_PX / zoom,
      this.selection.army,
    );
    if (hit === null || hit.kind === "army") return false;
    if (hit.kind === "more") {
      counterStateOf(view).toggleOpen(hit.region);
      this.changed();
      return true;
    }
    this.pickDivision(hit.army, hit.division);
    return true;
  }

  /** Chooses `army` with `division` picked, the card in [사단]; in [사단] on that army, the division toggles. */
  private pickDivision(army: number, division: number): void {
    const sel = this.selection;
    if (sel.army === army && sel.draw === "divisions") {
      const set = new Set(sel.divisions);
      if (!set.delete(division)) set.add(division);
      sel.divisions = [...set].sort((a, b) => a - b);
      sel.pending = null;
      sel.version++;
      this.changed();
      return;
    }
    if (sel.army !== army) this.select(army);
    this.toggleDraw("divisions");
    if (this.selection.draw !== "divisions") return;
    sel.divisions = [division];
    sel.version++;
    this.changed();
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
    // ww162: a line mode belongs to the army it was opened for.
    this.unregisterDrawBack?.();
    this.unregisterDrawBack = null;
    this.claim = null;
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
    // ww162: an order mode ends a line mode (selection.setMode drops it).
    this.unregisterDrawBack?.();
    this.unregisterDrawBack = null;
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

  // ---------------------------------------------------------------------------
  // ww162: the battle planner's lines (design §2)
  // ---------------------------------------------------------------------------

  /** The engine's front rules over the land view and the live sides. */
  private world(view: WwLandView): FrontWorld {
    const sides = this.sides();
    return {
      scenario: view.scenario,
      controller: view.controller,
      sameSide: (a, b) => sides.sameSide(a, b),
      isEnemy: (a, b) => sides.isEnemy(a, b),
    };
  }

  /** The chosen army when it is mine, with the view and my id. */
  private chosen(): {
    view: WwLandView;
    me: number;
    army: ArmySummary;
  } | null {
    const view = this.game.wwLand?.() ?? null;
    const me = this.myId();
    const id = this.selection.army;
    if (view === null || me === null || id === null) return null;
    const army = view.armies.get(id);
    if (army === undefined || army.owner !== me || army.mine === null) {
      return null;
    }
    return { view, me, army };
  }

  /** The army group whose lines the line modes draw (selection.group), while it is mine and alive. */
  private groupData(): WwArmyGroupData | null {
    const id = this.selection.group;
    if (id === null) return null;
    return (
      this.game
        .wwDepth?.()
        ?.armyGroups()
        .find((g) => g.id === id && g.armies.length > 0) ?? null
    );
  }

  private frontShown(
    w: FrontWorld,
    me: number,
    a: ArmySummary,
  ): FrontDraft | null {
    const sel = this.selection;
    const g = this.groupData();
    if (g === null) return shownFront(w, me, a, sel);
    const d = sel.line;
    if (d !== null && d.kind === "front" && d.army === a.id) return d.front;
    return groupLineFront(w, me, g);
  }

  private chainShown(a: ArmySummary, kind: "goal" | "fallback"): number[] {
    const sel = this.selection;
    const g = this.groupData();
    if (g === null) return shownChain(a, sel, kind);
    const d = sel.line;
    if (d !== null && d.kind === kind && d.army === a.id) return d.regions;
    return groupChain(g, kind);
  }

  /**
   * A line mode's chip: on, or off when it is the one on (or "none").
   * `group` (the group tab's chips): the mode draws that group's lines, and
   * one of its armies is chosen for the card and the preview.
   */
  private toggleDraw(mode: DrawMode, group: number | null = null): void {
    const sel = this.selection;
    if (group !== null && mode !== "none" && mode !== "divisions") {
      const me = this.myId();
      const view = this.game.wwLand?.() ?? null;
      const g = this.game
        .wwDepth?.()
        ?.armyGroups()
        .find((x) => x.id === group);
      const lead =
        g?.armies.find(
          (a) =>
            view?.armies.get(a)?.owner === me &&
            (view?.armies.get(a)?.mine ?? null) !== null,
        ) ?? null;
      if (lead === null) return;
      if (sel.army !== null && g!.armies.includes(sel.army)) {
        // Stay on the chosen army when it is one of the group's.
      } else if (sel.army !== lead) {
        this.select(lead);
      }
    }
    const c = this.chosen();
    if (c === null) return;
    const same =
      mode === sel.draw &&
      (mode === "divisions" || mode === "none" || group === sel.group);
    const next: DrawMode = same ? "none" : mode;
    sel.setDraw(next, group);
    this.claim = null;
    if (next === "goal") {
      const g = this.groupData();
      sel.spear =
        g !== null ? g.spear === true : c.army.mine!.order.spear === true;
      sel.stance = c.army.mine!.order.stance;
    }
    this.unregisterDrawBack?.();
    this.unregisterDrawBack = null;
    if (next !== "none") {
      // Back leaves the mode before it lets go of the army.
      this.unregisterDrawBack = registerBackClosable(() => this.leaveDraw());
    }
    this.changed();
  }

  /** Leaves the line mode; true when one was on. */
  private leaveDraw(): boolean {
    const sel = this.selection;
    if (sel.draw === "none") return false;
    sel.setDraw("none");
    this.claim = null;
    this.unregisterDrawBack?.();
    this.unregisterDrawBack = null;
    this.changed();
    return true;
  }

  /** The line mode's kind; null outside the drawing modes. */
  private lineKind(): LineKind | null {
    const d = this.selection.draw;
    return d === "front" || d === "goal" || d === "fallback" ? d : null;
  }

  /**
   * InputHandler's question on a press (design §2): a line mode takes the
   * press as a stroke (Shift: the map's pan), and so does a press on one of
   * the chosen army's handles.
   */
  private claimDrag(e: ClaimDragEvent): void {
    const sel = this.selection;
    const c = this.chosen();
    if (c === null) return;
    const kind = this.lineKind();
    if (kind !== null) e.drawMode = true;
    if (e.shift || sel.mode !== "none" || sel.draw === "divisions") return;
    const m = this.multi;
    if (m.active || m.frontGroup !== null || m.attackGroup !== null) return;
    const zoom = Math.max(1e-6, this.transform.scale);
    const w = this.transform.screenToWorldCoordinatesFloat(e.x, e.y);
    const world = this.world(c.view);
    // A marshal's lines are drawn by strokes and taps (the handles are the army's).
    const handle =
      sel.group !== null
        ? null
        : hitHandle(
            shownHandles(world, c.me, c.army, this.selection),
            w.x,
            w.y,
            TAP_RADIUS_PX / zoom,
          );
    if (handle === null && kind === null) return;
    e.claimed = true;
    this.pressStop();
    this.claim = { handle };
  }

  private strokeEvent(e: WwStrokeEvent): void {
    const claim = this.claim;
    if (claim === null) return;
    const sel = this.selection;
    const c = this.chosen();
    if (c === null || e.phase === "cancel") {
      this.claim = null;
      if (sel.line?.live === true) {
        sel.line = null;
        sel.version++;
        this.changed();
      }
      return;
    }
    const pos = this.transform.screenToWorldCoordinatesFloat(e.x, e.y);
    const region = this.regionAt(c.view, pos.x, pos.y);
    const w = this.world(c.view);
    if (e.phase === "start") {
      this.samples = [];
      this.strokeFull = false;
      this.dragBase =
        claim.handle === null
          ? null
          : {
              front: this.frontShown(w, c.me, c.army),
              goal: this.chainShown(c.army, "goal"),
            };
      this.sample(w, c.me, c.army, claim.handle, region);
      return;
    }
    if (e.phase === "move") {
      this.sample(w, c.me, c.army, claim.handle, region);
      return;
    }
    // "end": one order for the whole stroke.
    this.claim = null;
    const d = sel.line;
    if (d === null || !d.live || d.army !== c.army.id) return;
    d.live = false;
    this.sendLine(c.view, w, c.me, c.army, d);
  }

  /** A stroke reached `region`: the preview is worked out again only when the region changed. */
  private sample(
    w: FrontWorld,
    me: number,
    army: ArmySummary,
    handle: LineHandle | null,
    region: number,
  ): void {
    if (region === 0) return;
    if (this.samples[this.samples.length - 1] === region) return;
    this.samples.push(region);
    const sel = this.selection;
    let next: LineDraft | null = null;
    const draft = (
      kind: LineKind,
      front: FrontDraft | null,
      regions: number[],
    ) =>
      ({
        kind,
        army: army.id,
        front,
        regions,
        live: true,
        sentAt: 0,
      }) as LineDraft;
    if (handle !== null) {
      const base = this.dragBase;
      if (base === null) return;
      if (handle.kind === "end" && base.front !== null) {
        const f = moveFrontEnd(
          w,
          me,
          base.front,
          handle.index === 0 ? 0 : 1,
          region,
        );
        if (f !== null) next = draft("front", f, f.chain);
      } else if (handle.kind === "wp") {
        next = draft(
          "goal",
          null,
          moveWaypoint(w, me, base.goal, handle.index, region),
        );
      }
    } else {
      const kind = this.lineKind();
      if (kind === "front") {
        const f = frontFromSamples(w, me, this.samples);
        if (f !== null) next = draft("front", f, f.chain);
      } else if (kind === "goal" || kind === "fallback") {
        const res = chainFromSamples(w, me, kind, this.samples);
        if (res.full && !this.strokeFull && kind === "goal") {
          this.strokeFull = true;
          showToast(
            translateText(PLANNER_KEYS.refuseGoalFull, { n: WW_GOAL_MAX }),
            "red",
          );
        }
        if (res.regions.length > 0) next = draft(kind, null, res.regions);
      }
    }
    if (next === null) return;
    sel.line = next;
    sel.version++;
    this.changed();
  }

  /**
   * Sends a finished line (a stroke's, a handle drag's or a tap's) as one
   * order, after the client's own checks (an offensive line starts near the
   * front) and the engine's (orderBlock); a refused line is told and drops.
   */
  private sendLine(
    view: WwLandView,
    w: FrontWorld,
    me: number,
    army: ArmySummary,
    d: LineDraft,
  ): void {
    const sel = this.selection;
    const group = this.groupData();
    const order =
      group !== null
        ? groupLineOrder(group, d, sel.spear)
        : this.lineOrder(w, me, army, d);
    // The rules' check: a group's line is checked as its first army's, as
    // the engine does (ArmyGroups.issueGroupLine).
    const check = group !== null ? this.lineOrder(w, me, army, d) : order;
    // An offensive line starts near the front: the group's, all its armies'.
    const zone =
      group === null
        ? army.mine!.front
        : group.armies.flatMap((a) => view.armies.get(a)?.mine?.front ?? []);
    let refusal: string | null = null;
    if (order === null || check === null) {
      refusal = "";
    } else if (
      check.kind === "army_goal" &&
      check.regions.length > 0 &&
      !goalStartOk(w, zone, army.region, check.regions[0])
    ) {
      refusal = translateText(PLANNER_KEYS.refuseGoalFar);
    } else if (check.kind !== "army_fallback" || group === null) {
      const economy = this.game.wwEconomy?.() ?? null;
      const block =
        economy === null
          ? null
          : orderBlock(
              view,
              economy,
              me,
              today(this.game),
              check,
              this.sides(),
            );
      if (block !== null) refusal = cardBlockText(block);
    }
    if (refusal !== null) {
      if (refusal !== "") showToast(refusal, "red");
      sel.line = null;
      sel.version++;
      this.changed();
      return;
    }
    d.live = false;
    d.sentAt = this.deps.now();
    sel.line = d;
    sel.version++;
    // Undo keeps the army's own lines (a marshal's line is redrawn instead).
    if (group === null) {
      sel.undo.push(army.id, d.kind, order!, restoreOrder(army, d.kind));
    }
    this.eventBus.emit(new SendWwOrderIntentEvent(order!));
    this.changed();
  }

  /** The order a line draft stands for; null when it stands for none. */
  private lineOrder(
    w: FrontWorld,
    me: number,
    army: ArmySummary,
    d: LineDraft,
  ): LandOrder | null {
    const o = army.mine!.order;
    switch (d.kind) {
      case "front":
        return d.front === null
          ? { kind: "army_zone", army: army.id, regions: [] }
          : frontLineOrder(army.id, d.front);
      case "goal":
        return goalOrder(
          army.id,
          d.regions,
          this.selection.spear,
          this.selection.stance,
        );
      case "fallback":
        return fallbackOrder(
          army.id,
          d.regions,
          this.fbManual.get(army.id) ?? o.fbManual === true,
        );
    }
  }

  /** Design §2 (taps): a tap in a line mode stretches, adds to or trims the line; in [사단] it moves the picked divisions. */
  private drawTap(
    view: WwLandView,
    me: number,
    armyId: number,
    region: number,
  ): void {
    const army = view.armies.get(armyId);
    if (army === undefined || army.mine === null) return;
    const sel = this.selection;
    if (sel.draw === "divisions") {
      this.divisionTap(view, me, army, region);
      return;
    }
    if (region === 0) return;
    const w = this.world(view);
    const draft = (
      kind: LineKind,
      front: FrontDraft | null,
      regions: number[],
    ) =>
      ({
        kind,
        army: armyId,
        front,
        regions,
        live: false,
        sentAt: 0,
      }) as LineDraft;
    let d: LineDraft | null = null;
    if (sel.draw === "front") {
      const f = extendFront(w, me, this.frontShown(w, me, army), region);
      if (f !== null) d = draft("front", f, f.chain);
    } else if (sel.draw === "goal" || sel.draw === "fallback") {
      const kind = sel.draw;
      const was = this.chainShown(army, kind);
      const res =
        kind === "goal"
          ? tapGoal(w, me, was, region)
          : tapFallback(w, me, was, region);
      if (res.full && kind === "goal") {
        showToast(
          translateText(PLANNER_KEYS.refuseGoalFull, { n: WW_GOAL_MAX }),
          "red",
        );
      }
      const same =
        res.regions.length === was.length &&
        res.regions.every((r, i) => r === was[i]);
      if (!same) d = draft(kind, null, res.regions);
    }
    if (d !== null) this.sendLine(view, w, me, army, d);
  }

  /**
   * [사단] (design §2): with nothing picked, a tap on a region where the
   * army's divisions stand picks them; with divisions picked, a tap on a
   * region is division_move, with today's two-tap confirm.
   */
  private divisionTap(
    view: WwLandView,
    me: number,
    army: ArmySummary,
    region: number,
  ): void {
    const sel = this.selection;
    if (region === 0 || view.scenario.region(region) === undefined) return;
    if (sel.divisions.length === 0) {
      const here = (view.details.get(me)?.divisions ?? [])
        .filter((d) => d.army === army.id && d.region === region)
        .map((d) => d.id)
        .sort((a, b) => a - b);
      if (here.length === 0) return;
      sel.divisions = here;
      sel.pending = null;
      sel.version++;
      this.changed();
      return;
    }
    const now = this.deps.now();
    if (sel.pending !== region) {
      sel.pending = region;
      this.pendingAt = now;
      sel.version++;
      this.changed();
      return;
    }
    if (now - this.pendingAt < TWO_TAP_MIN_MS) return;
    const order: LandOrder = {
      kind: "division_move",
      army: army.id,
      divisions: [...sel.divisions],
      region,
    };
    const economy = this.game.wwEconomy?.() ?? null;
    const block =
      economy === null
        ? null
        : orderBlock(view, economy, me, today(this.game), order, this.sides());
    if (block !== null) {
      showToast(cardBlockText(block), "red");
      return;
    }
    sel.pending = null;
    sel.version++;
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
    this.changed();
  }

  /** The card's second row (design §2), by mode. */
  private plannerAction(a: PlannerAction): void {
    const c = this.chosen();
    if (c === null) return;
    const sel = this.selection;
    const { view, me, army } = c;
    const id = army.id;
    const w = this.world(view);
    const send = (order: LandOrder) =>
      this.eventBus.emit(new SendWwOrderIntentEvent(order));
    const draft = (
      kind: LineKind,
      front: FrontDraft | null,
      regions: number[],
    ) =>
      ({ kind, army: id, front, regions, live: false, sentAt: 0 }) as LineDraft;
    // A marshal's lines: the group's armies run them.
    const group = this.groupData();
    const groupArmies =
      group === null
        ? []
        : group.armies.filter(
            (x) => (view.armies.get(x)?.mine ?? null) !== null,
          );
    switch (a.kind) {
      case "undo": {
        const kind = this.lineKind();
        if (group !== null) return;
        const order = kind === null ? null : sel.undo.undo(id, kind);
        if (order === null) return;
        sel.line = null;
        sel.version++;
        send(order);
        break;
      }
      case "clear": {
        const kind = this.lineKind();
        if (kind === null) return;
        this.sendLine(view, w, me, army, draft(kind, null, []));
        return;
      }
      case "spear":
      case "stance": {
        if (a.kind === "spear") sel.spear = a.on;
        else sel.stance = a.stance;
        sel.version++;
        const goal = this.chainShown(army, "goal");
        if (goal.length > 0)
          this.sendLine(view, w, me, army, draft("goal", null, goal));
        break;
      }
      case "execute":
        if (group !== null && a.on) {
          this.eventBus.emit(
            new SendWwOrderIntentEvent({ kind: "ag_execute", group: group.id }),
          );
        } else if (group !== null) {
          for (const x of groupArmies) {
            send({ kind: "army_execute", army: x, on: false });
          }
        } else send({ kind: "army_execute", army: id, on: a.on });
        break;
      case "suggest": {
        // The AI's own ring (lib FrontRules), forts counted as built.
        const econ = this.game.wwEconomy?.() ?? null;
        const ring = suggestFallback(
          w,
          me,
          group?.enemy ?? army.mine!.order.enemy,
          group === null
            ? army.mine!.front
            : groupArmies.flatMap((x) => view.armies.get(x)!.mine!.front),
          (r) => econ?.buildingCount("fort", r) ?? 0,
        );
        if (ring.length === 0) return;
        this.sendLine(view, w, me, army, draft("fallback", null, ring));
        return;
      }
      case "fb_auto": {
        this.fbManual.set(id, !a.on);
        const fb = this.chainShown(army, "fallback");
        if (fb.length > 0)
          this.sendLine(view, w, me, army, draft("fallback", null, fb));
        break;
      }
      case "fall_back_now":
        if (group === null) send({ kind: "army_fall_back", army: id });
        else {
          for (const x of groupArmies) {
            if ((view.armies.get(x)!.mine!.order.fallback?.length ?? 0) > 0) {
              send({ kind: "army_fall_back", army: x });
            }
          }
        }
        break;
      case "pick":
        sel.divisions = [...new Set(a.divisions)].sort((x, y) => x - y);
        sel.pending = null;
        sel.version++;
        break;
      case "release":
        send({
          kind: "division_release",
          army: id,
          divisions: [...a.divisions],
        });
        break;
      case "whole_army":
        sel.divisions = [];
        if (sel.draw === "divisions") {
          this.leaveDraw();
          return;
        }
        sel.version++;
        break;
    }
    this.changed();
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
