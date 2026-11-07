import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "./people";
import { AUH_PEOPLE } from "./people_auh";
import { GW_PEOPLE_COMMON } from "./people_common";
import { GW_PEOPLE_DEU } from "./people_deu";
import { GW_PEOPLE_MONEY } from "./people_money";
import { GBR_PEOPLE } from "./people_gbr";
import { RUS_PEOPLE } from "./people_rus";
import { AUH_QUIET_SCENES, withAuhBodies } from "./scenes/auh_bodies";
import { AUH_CRISIS_SCENES } from "./scenes/auh_crisis";
import { AUH_CROWN_SCENES } from "./scenes/auh_crown";
import { AUH_REALM_SCENES } from "./scenes/auh_realm";
import { AUH_WAR_SCENES } from "./scenes/auh_war";
import { BUDGET_SCENES } from "./scenes/budget";
import { COMMON_SCENES } from "./scenes/common";
import { DEU_SCENES } from "./scenes/deu";
import { DEU_BACK_SCENES, withPromiseTerms } from "./scenes/deu_back";
import { DEU_COURT_SCENES } from "./scenes/deu_court";
import { DEU_CRISIS_SCENES } from "./scenes/deu_crisis";
import { DEU_FRONT_SCENES } from "./scenes/deu_front";
import { DEU_HOME_SCENES } from "./scenes/deu_home";
import { DEU_PEACE_SCENES, withSummerWar } from "./scenes/deu_peace";
import { DEU_PEOPLE_SCENES } from "./scenes/deu_people";
import { withDeuReplay } from "./scenes/deu_replay";
import { DEU_SEA_SCENES } from "./scenes/deu_sea";
import { DEU_WAR_SCENES } from "./scenes/deu_war";
import { GBR_CRISIS_SCENES } from "./scenes/gbr_crisis";
import { GBR_HOME_SCENES } from "./scenes/gbr_home";
import { withMore } from "./scenes/gbr_more";
import { GBR_WAR_SCENES } from "./scenes/gbr_war";
import { GBR_WORLD_SCENES } from "./scenes/gbr_world";
import { GOV_SCENES } from "./scenes/gov";
import { GW_DIP_SCENES } from "./scenes/gw_dip";
import { GW_FRAME_SCENES } from "./scenes/gw_frame";
import { GW_NEUTRAL_SCENES } from "./scenes/gw_neutral";
import { withCommonBodies } from "./scenes/gw_replay";
import { GW_WORLD2_SCENES } from "./scenes/gw_world2";
import { RUS_CRISIS_SCENES } from "./scenes/rus_crisis";
import { RUS_FALL_SCENES } from "./scenes/rus_fall";
import { RUS_FRONT_SCENES } from "./scenes/rus_front";
import { RUS_HOME_SCENES } from "./scenes/rus_home";
import { WARTIME_SCENES } from "./scenes/wartime";
import { WORLD_SCENES } from "./scenes/world";

export interface GwContent {
  readonly scenes: readonly GwScene[];
  readonly people: readonly GwPersonDef[];
}

/** All content. A new country's file adds one line here. */
export const GW_CONTENT: GwContent = {
  scenes: withCommonBodies(
    [
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
      ...withAuhBodies(withMore(WARTIME_SCENES)),
      ...[
        ...withAuhBodies([
          ...AUH_CRISIS_SCENES,
          ...AUH_WAR_SCENES,
          ...AUH_REALM_SCENES,
          ...AUH_CROWN_SCENES,
        ]),
        ...AUH_QUIET_SCENES,
        ...withMore([
          ...GBR_CRISIS_SCENES,
          ...GBR_WAR_SCENES,
          ...GBR_HOME_SCENES,
          ...GBR_WORLD_SCENES,
        ]),
        ...RUS_CRISIS_SCENES,
        ...RUS_FRONT_SCENES,
        ...RUS_HOME_SCENES,
        ...RUS_FALL_SCENES,
        ...DEU_FRONT_SCENES,
        ...DEU_SEA_SCENES,
        ...DEU_HOME_SCENES,
        ...DEU_COURT_SCENES,
        ...GW_DIP_SCENES,
        ...GW_NEUTRAL_SCENES,
        ...GW_WORLD2_SCENES,
        ...GW_FRAME_SCENES,
      ].map(withPromiseTerms),
      ...BUDGET_SCENES,
      ...GOV_SCENES,
    ].map(withDeuReplay),
  ),
  people: [
    ...GW_PEOPLE,
    ...GW_PEOPLE_DEU,
    ...GW_PEOPLE_COMMON,
    ...GBR_PEOPLE,
    ...AUH_PEOPLE,
    ...RUS_PEOPLE,
    ...GW_PEOPLE_MONEY,
  ],
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
