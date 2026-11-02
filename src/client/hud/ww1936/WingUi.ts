// World War 1936 ww8 (lane G, design §8): the chosen wings and the order
// draft they share between the wing card, the air drawer, the map taps
// (WwWingController) and the render lane's glow. One per game view.
import type { AirMission } from "@openfront/engine-api/ww1936/AirTypes";
import { GameEvent } from "@openfront/shared/EventBus";

/** What the next map tap means: a mission target, a new base, a field strip. */
export type WingMode = "none" | "mission" | "base" | "field";

/** The mission group a button opens (design §3.4). */
export type WingGroup = "air" | "ground" | "bomb" | "sea" | "lift";

/** The render lane's token tap and the drawer choose wings; `add` extends the choice (a long press). */
export class WwSelectWingsEvent implements GameEvent {
  constructor(
    readonly ids: readonly number[],
    readonly add = false,
  ) {}
}
/** The wing screens changed (the card and the glow redraw). */
export class WwWingChangedEvent implements GameEvent {}

export class WingUi {
  /** The chosen wings, ascending (at most 20 to an order). */
  ids: number[] = [];
  mode: WingMode = "none";
  /** The group whose chips show, and the mission and bomb class chosen (mission mode). */
  group: WingGroup | null = null;
  mission: AirMission = "air_superiority";
  cls = 0;
  /** A pending first tap (base, field): the region waiting for its second tap. */
  pending = 0;
  pendingAt = 0;
  /** The last refusal's block key and the mission it was for ("" none). */
  refused = "";
  /** The disband button tapped once. */
  disbandAsk = false;
  /** Bases whose group chip was tapped open into a fan (the render lane). */
  expanded = new Set<number>();
  version = 0;

  bump(): void {
    this.version++;
  }

  select(ids: readonly number[], add = false): void {
    const next = add ? [...this.ids, ...ids] : [...ids];
    this.ids = [...new Set(next)].sort((a, b) => a - b);
    this.reset();
  }

  clear(): void {
    this.ids = [];
    this.reset();
  }

  reset(): void {
    this.mode = "none";
    this.group = null;
    this.pending = 0;
    this.refused = "";
    this.disbandAsk = false;
    this.version++;
  }
}

const states = new WeakMap<object, WingUi>();

export function wingUiOf(game: object): WingUi {
  let s = states.get(game);
  if (s === undefined) {
    s = new WingUi();
    states.set(game, s);
  }
  return s;
}
