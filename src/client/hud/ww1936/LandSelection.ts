// World War 1936 P2 (plan decision 25): the chosen army and the map tap
// flow's draft, shared by the land controller, the army card and the
// render passes; and the events that open the land screens.
import { Stance } from "@openfront/engine-api/ww1936/LandTypes";
import { GameEvent } from "@openfront/shared/EventBus";

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
  version = 0;

  select(army: number | null): void {
    this.army = army;
    this.mode = "none";
    this.pending = null;
    this.targets = [];
    this.stance = "balanced";
    this.zoneDraft = null;
    this.version++;
  }

  setMode(mode: LandMode): void {
    this.mode = mode;
    this.pending = null;
    this.zoneDraft = null;
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
