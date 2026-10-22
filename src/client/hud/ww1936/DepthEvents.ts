// World War 1936 P6 (plan Task 1 Step 18, spec §20): the events that open
// the depth screens and start the strike flows. U1–U5 listen for them.
import type { DesignKind } from "@openfront/engine-api/ww1936/DepthTypes";
import { GameEvent } from "@openfront/shared/EventBus";

export type WwDepthScreen =
  | "doctrine"
  | "intel"
  | "designer"
  | "designs"
  | "projects"
  | "mio"
  | "market";

/** Opens a depth drawer (the designer with a kind, a slot, a tab). */
export class WwDepthOpenEvent implements GameEvent {
  constructor(
    readonly kind: WwDepthScreen,
    readonly arg?: { kind?: DesignKind; slot?: number; tab?: string },
  ) {}
}

export type WwStrikeKind =
  | "nuke"
  | "rocket"
  | "raid_para"
  | "raid_commando"
  | "raid_bomb";

/** Starts a strike flow from a site, unit or zone (U4, U5). */
export class WwStrikeFlowEvent implements GameEvent {
  constructor(
    readonly kind: WwStrikeKind,
    readonly from: number,
  ) {}
}

/** Several armies chosen at once (U1's army group creation). */
export class WwMultiSelectEvent implements GameEvent {
  constructor(readonly armies: number[]) {}
}
