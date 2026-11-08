// World War 1936 P2 (plan decision 25): the chosen army and the map tap
// flow's draft, shared by the land controller, the army card and the
// render passes; and the events that open the land screens.
import { Stance } from "@openfront/engine-api/ww1936/LandTypes";
import { GameEvent } from "@openfront/shared/EventBus";
import { type DrawMode, type LineDraft, LineUndo } from "./PlannerModel";

export type { DrawMode } from "./PlannerModel";

/**
 * What a map tap means now (spec §15.3). ww7: "plan" is the [공격] mode (tap
 * 1-3 enemy regions), "front" the [방어] mode (tap our border regions into or
 * out of the army's zone); "attack" is the plain one-region attack.
 */
export type LandMode =
  | "none"
  | "move"
  | "attack"
  | "front"
  | "plan"
  | "rail"
  | "sea"
  | "paradrop";
export type WwArmyTab =
  | "armies"
  | "training"
  | "templates"
  | "generals"
  // P6 (spec §20.4): army groups.
  | "groups";

/** The chosen army and the tap flow's draft; shared by the controller, the card and the passes. */
export class WwLandSelection {
  army: number | null = null;
  mode: LandMode = "none";
  /** First tap of "tap → confirm tap": the region waiting for its second tap. */
  pending: number | null = null;
  /** Plan draft (spec §15.3-5). */
  targets: number[] = [];
  stance: Stance = "balanced";
  /**
   * ww7: the zone the last tap sent (army_zone), shown until the engine's
   * update carries it; null: the army's own (`mine.front`).
   */
  zoneDraft: number[] | null = null;
  /** ww42: why the last direct-attack tap was refused (an order block); cleared by the next good tap. */
  refusal: string | null = null;
  // ww162 (battle planner, design §2): the army card's line modes.
  /** The line mode on (`mode` is "none" meanwhile): a drag or a tap draws that line. */
  draw: DrawMode = "none";
  /** The line being drawn, or just sent and not yet carried by the engine's order. */
  line: LineDraft | null = null;
  /** The offensive line's [넓게|돌파] chip: a spearhead (else a broad line). */
  spear = false;
  /** [사단] mode: the chosen army's divisions picked (ids, ascending). */
  divisions: number[] = [];
  /** The plan view (design §3): every army of mine shows its lines, faint. Kept across choices. */
  planView = false;
  /** The line orders sent, per army and line, for [되돌리기] (the card asks canUndo). */
  readonly undo = new LineUndo();
  version = 0;

  select(army: number | null): void {
    this.army = army;
    this.mode = "none";
    this.pending = null;
    this.targets = [];
    this.stance = "balanced";
    this.zoneDraft = null;
    this.refusal = null;
    this.draw = "none";
    this.line = null;
    this.spear = false;
    this.divisions = [];
    this.version++;
  }

  setMode(mode: LandMode): void {
    this.mode = mode;
    this.pending = null;
    this.zoneDraft = null;
    // An order mode and a line mode never stand together.
    this.draw = "none";
    this.line = null;
    this.divisions = [];
    this.version++;
  }

  /** ww162: a line mode on (or "none": off); the order modes go. */
  setDraw(draw: DrawMode): void {
    this.mode = "none";
    this.pending = null;
    this.zoneDraft = null;
    this.draw = draw;
    this.line = null;
    if (draw !== "divisions") this.divisions = [];
    this.version++;
  }
}

const selections = new WeakMap<object, WwLandSelection>();
/** One selection per game view. */
export function landSelectionOf(game: object): WwLandSelection {
  let s = selections.get(game);
  if (s === undefined) selections.set(game, (s = new WwLandSelection()));
  return s;
}

export class WwSelectArmyEvent implements GameEvent {
  constructor(readonly army: number | null) {}
}
export class WwLandModeEvent implements GameEvent {
  constructor(readonly mode: LandMode) {}
}
export class OpenWwArmyEvent implements GameEvent {
  /** `convertArmy`: open the templates tab on that army's overwrite picker. */
  constructor(
    readonly tab: WwArmyTab = "armies",
    readonly convertArmy?: number,
  ) {}
}
export class OpenWwBattleEvent implements GameEvent {
  constructor(readonly region: number) {}
}

/**
 * ww162 (design §2): the army card's line chips. A chip turns its mode on;
 * the same mode again (or "none") turns it off. The land controller keeps
 * the chosen army and answers with WwLandChangedEvent.
 */
export class WwDrawModeEvent implements GameEvent {
  constructor(readonly mode: DrawMode) {}
}

/**
 * ww162 (design §2): the card's second row, by mode. The land controller
 * builds and sends the orders (the card only asks):
 * - undo, clear: the current line mode's line (front, goal or fallback);
 * - spear (on: a spearhead), stance: the offensive line, re-sent when set;
 * - execute (on/off): army_execute;
 * - suggest: the fallback ring; fb_auto (on: the army falls back by
 *   itself); fall_back_now: army_fall_back;
 * - pick (divisions: the [사단] list's checks), release (divisions; empty:
 *   every pin), whole_army: the whole army again.
 */
export type PlannerAction =
  | { kind: "undo" }
  | { kind: "clear" }
  | { kind: "spear"; on: boolean }
  | { kind: "stance"; stance: Stance }
  | { kind: "execute"; on: boolean }
  | { kind: "suggest" }
  | { kind: "fb_auto"; on: boolean }
  | { kind: "fall_back_now" }
  | { kind: "pick"; divisions: number[] }
  | { kind: "release"; divisions: number[] }
  | { kind: "whole_army" };
export class WwPlannerEvent implements GameEvent {
  constructor(readonly action: PlannerAction) {}
}

/** ww162 (design §3): the army bar's plan view toggle (`on` absent: flip). */
export class WwPlanViewEvent implements GameEvent {
  constructor(readonly on?: boolean) {}
}
