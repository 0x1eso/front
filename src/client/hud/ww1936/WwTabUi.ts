// World War 1936 P6 lane U4: what the MIO, market and projects tabs get
// from the drawer that hosts them (the drawer owns the state and the taps).
import type { WwOrder } from "@openfront/engine-api/Schemas";

export interface TabUi {
  send(order: WwOrder): void;
  /** An irreversible action: the first tap arms `key`, a second acts. */
  confirm(key: string, act: () => void): void;
  armed(key: string): boolean;
  redraw(): void;
  /** A country's name from its small id. */
  name(smallID: number): string;
  /** A region's name. */
  regionName(region: number): string;
  /** My own small id. */
  me: number;
  /** Small per-tab state (the card opened, the slider value). */
  pick: Record<string, number>;
}

export const TAB_BTN =
  "h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
export const TAB_HEAD =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
