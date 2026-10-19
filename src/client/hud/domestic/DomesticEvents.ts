import { GameEvent } from "@openfront/shared/EventBus";

/** The drawer's screens, one per dial (spec §14d); "congress" only in congress games. */
export type DomesticScreen = "research" | "laws" | "victory" | "congress";
/** The three domestic screens every domestic game has. */
export const DOMESTIC_SCREENS: readonly DomesticScreen[] = [
  "research",
  "laws",
  "victory",
];

/**
 * A dial was tapped: open the drawer on its screen, or close the drawer if
 * that screen is already open.
 */
export class OpenDomesticScreenEvent implements GameEvent {
  constructor(public readonly screen: DomesticScreen) {}
}

/** The drawer now shows `screen` (null: closed), so the dials can mark it. */
export class DomesticScreenShownEvent implements GameEvent {
  constructor(public readonly screen: DomesticScreen | null) {}
}
