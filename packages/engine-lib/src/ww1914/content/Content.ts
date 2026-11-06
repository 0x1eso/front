import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "./people";
import { COMMON_SCENES } from "./scenes/common";
import { DEU_SCENES } from "./scenes/deu";
import { DEU_BACK_SCENES, withPromiseTerms } from "./scenes/deu_back";
import { DEU_CRISIS_SCENES } from "./scenes/deu_crisis";
import { DEU_PEACE_SCENES, withSummerWar } from "./scenes/deu_peace";
import { DEU_PEOPLE_SCENES } from "./scenes/deu_people";
import { DEU_WAR_SCENES } from "./scenes/deu_war";
import { WARTIME_SCENES } from "./scenes/wartime";
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
    ...[
      ...DEU_CRISIS_SCENES,
      ...DEU_WAR_SCENES,
      ...DEU_PEOPLE_SCENES,
      ...DEU_PEACE_SCENES,
    ]
      .map(withPromiseTerms)
      .map(withSummerWar),
    ...DEU_BACK_SCENES,
    ...WORLD_SCENES,
    ...WARTIME_SCENES,
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
