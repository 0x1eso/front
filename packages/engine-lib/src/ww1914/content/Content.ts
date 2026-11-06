import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "./people";
import { AUH_CRISIS_SCENES } from "./scenes/auh_crisis";
import { COMMON_SCENES } from "./scenes/common";
import { DEU_SCENES } from "./scenes/deu";
import { WORLD_SCENES } from "./scenes/world";

export interface GwContent {
  readonly scenes: readonly GwScene[];
  readonly people: readonly GwPersonDef[];
}

/** All content. A new country's file adds one line here. */
export const GW_CONTENT: GwContent = {
  scenes: [
    ...COMMON_SCENES,
    ...DEU_SCENES,
    ...WORLD_SCENES,
    ...AUH_CRISIS_SCENES,
  ],
  people: GW_PEOPLE,
};

let current = GW_CONTENT;

/** What the engine reads. Checked by tests/ww1914, trusted here. */
export function gwContent(): GwContent {
  return current;
}

/** Tests only: play on fixture content. Pass null to go back. */
export function useGwContent(c: GwContent | null): void {
  current = c ?? GW_CONTENT;
}
