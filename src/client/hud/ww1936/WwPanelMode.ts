import { GameEvent } from "@openfront/shared/EventBus";
import { landSelectionOf } from "./LandSelection";
import { linePeaceUiOf } from "./LinePeaceModel";
import { multiSelectOf } from "./MultiSelect";
import { negPeaceUiOf } from "./NegPeaceModel";
import { peaceUiOf } from "./PeaceModel";
import { strikeFlowOf } from "./WwNukeFlow";
import { seaAirOf } from "./WwSeaAirController";

// World War 1936 HUD rework: a dock button opens its drawer as a full-screen
// panel. A flow that needs the map (an order's target, a front, a strike or
// raid target, a sea or air tap mode, the peace conference map) makes the
// open panel step aside: it hides, the dock shows a "back to panel" chip,
// and the panel returns when the flow ends.

/** The open panel steps aside (true) for a map flow, or comes back (false). */
export class WwPanelMinimizedEvent implements GameEvent {
  constructor(public readonly minimized: boolean) {}
}

/** Esc: the open panel closes. */
export class WwClosePanelEvent implements GameEvent {}

/** The panel is full-screen: the dock row (fixed, z above) leaves room at the bottom. */
export const WW_PANEL_STYLE =
  "inset:0;padding-bottom:calc(var(--ww-dock-h,0px) + env(safe-area-inset-bottom));";
export const WW_PANEL_HIDDEN_STYLE = "display:none;";

export function wwPanelStyle(minimized: boolean): string {
  return minimized ? WW_PANEL_HIDDEN_STYLE : WW_PANEL_STYLE;
}

/**
 * A flow that taps the map is on now. Reads only fields (no allocation), so
 * the dock may ask on every tick.
 */
export function wwMapFlowActive(game: object): boolean {
  const land = landSelectionOf(game);
  if (land.mode !== "none") return true;
  const multi = multiSelectOf(land);
  if (multi.active || multi.frontGroup !== null) return true;
  if (seaAirOf(game).draft.mode !== "none") return true;
  if (strikeFlowOf(game).step !== "idle") return true;
  return (
    peaceUiOf(game).map || negPeaceUiOf(game).map || linePeaceUiOf(game).map
  );
}
