import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwAct, GwAim } from "@openfront/engine-api/ww1914/GwActs";
import type { GwEcho, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "../CraftRows";
import type { GwHouseContent } from "../HouseRows";
import { withRuler } from "../RulerRows";
import { AUH_ACT_SCENES, AUH_ACTS, AUH_AIMS } from "./acts/auh";
import { COMMON_ACT_SCENES, COMMON_ACTS } from "./acts/common";
import { DEU_ACT_SCENES, DEU_ACTS, DEU_AIMS } from "./acts/deu";
import { GBR_ACT_SCENES, GBR_ACTS, GBR_AIMS } from "./acts/gbr";
import { RUS_ACT_SCENES, RUS_ACTS, RUS_AIMS } from "./acts/rus";
import { GW_PEOPLE } from "./people";
import { AUH_PEOPLE } from "./people_auh";
import { GW_PEOPLE_COMMON } from "./people_common";
import { GW_PEOPLE_DEU } from "./people_deu";
import { GBR_PEOPLE } from "./people_gbr";
import { GW_PEOPLE_HEADS } from "./people_heads";
import { GW_PEOPLE_MONEY } from "./people_money";
import { GW_PEOPLE_RULER } from "./people_ruler";
import { RUS_PEOPLE } from "./people_rus";
import { RUS_KIN } from "./people_rus_private";
import { AUH_STORY_SCENES } from "./scenes/auh_act";
import { AUH_QUIET_SCENES, withAuhBodies } from "./scenes/auh_bodies";
import { AUH_CRISIS_SCENES } from "./scenes/auh_crisis";
import { AUH_CROWN_SCENES } from "./scenes/auh_crown";
import {
  AUH_PRIVATE_PEOPLE,
  AUH_PRIVATE_SCENES,
  withAuhPrivate,
} from "./scenes/auh_private";
import { AUH_ECHOES, AUH_PROLOGUE_SCENES } from "./scenes/auh_prologue";
import { AUH_REALM_SCENES } from "./scenes/auh_realm";
import { AUH_WAR_SCENES } from "./scenes/auh_war";
import { BUDGET_SCENES } from "./scenes/budget";
import { COMMON_SCENES } from "./scenes/common";
import { gwDossierActs, gwDossierScenes } from "./scenes/dossier";
import {
  CRAFT_SCENES,
  GW_FOOTING,
  GW_INVENTIONS,
  GW_PROJECTS,
  GW_SHORTAGE_ROWS,
} from "./scenes/craft";
import { DEU_SCENES } from "./scenes/deu";
import { DEU_STORY_SCENES } from "./scenes/deu_act";
import { DEU_BACK_SCENES, withPromiseTerms } from "./scenes/deu_back";
import { DEU_COURT_SCENES } from "./scenes/deu_court";
import { DEU_CRISIS_SCENES } from "./scenes/deu_crisis";
import { DEU_FRONT_SCENES } from "./scenes/deu_front";
import { DEU_HOME_SCENES } from "./scenes/deu_home";
import { DEU_PEACE_SCENES, withSummerWar } from "./scenes/deu_peace";
import { DEU_PEOPLE_SCENES } from "./scenes/deu_people";
import {
  DEU_PRIVATE_PEOPLE,
  DEU_PRIVATE_SCENES,
  withDeuPrivate,
} from "./scenes/deu_private";
import { DEU_ECHOES, DEU_PROLOGUE_SCENES } from "./scenes/deu_prologue";
import { withDeuReplay } from "./scenes/deu_replay";
import { DEU_SEA_SCENES } from "./scenes/deu_sea";
import { DEU_WAR_SCENES } from "./scenes/deu_war";
import { GBR_CRISIS_SCENES } from "./scenes/gbr_crisis";
import { GBR_HOME_SCENES } from "./scenes/gbr_home";
import { withMore } from "./scenes/gbr_more";
import {
  GBR_PRIVATE_PEOPLE,
  GBR_PRIVATE_SCENES,
  withGbrPrivate,
} from "./scenes/gbr_private";
import { GBR_ECHOES, GBR_PROLOGUE_SCENES } from "./scenes/gbr_prologue";
import { GBR_WAR_SCENES } from "./scenes/gbr_war";
import { GBR_WORLD_SCENES } from "./scenes/gbr_world";
import { GOV_SCENES } from "./scenes/gov";
import { GW_DIP_SCENES } from "./scenes/gw_dip";
import { GW_FRAME_SCENES } from "./scenes/gw_frame";
import { GW_NEUTRAL_SCENES } from "./scenes/gw_neutral";
import { withCommonBodies } from "./scenes/gw_replay";
import { GW_WORLD2_SCENES } from "./scenes/gw_world2";
import {
  GW_HOUSE_CONTENT,
  gwHouseScenes,
  HOUSE_WRITTEN_SCENES,
} from "./scenes/house";
import { GW_LAWS, LAW_SCENES } from "./scenes/laws";
import { PRESS_SCENES } from "./scenes/press";
import { withEchoes } from "./scenes/prologue_echoes";
import { RULER_SCENES } from "./scenes/ruler";
import { RUS_STORY_SCENES } from "./scenes/rus_act";
import { RUS_CRISIS_SCENES } from "./scenes/rus_crisis";
import { RUS_FALL_SCENES } from "./scenes/rus_fall";
import { RUS_FRONT_SCENES } from "./scenes/rus_front";
import { RUS_HOME_SCENES } from "./scenes/rus_home";
import { RUS_PRIVATE_SCENES, withRusPrivate } from "./scenes/rus_private";
import { RUS_ECHOES, RUS_PROLOGUE_SCENES } from "./scenes/rus_prologue";
import { TABLE_SCENES } from "./scenes/table";
import { WARTIME_SCENES } from "./scenes/wartime";
import { WORLD_SCENES } from "./scenes/world";

export interface GwContent extends GwHouseContent {
  readonly scenes: readonly GwScene[];
  readonly people: readonly GwPersonDef[];
  /** The schedule's entries (원수의 일정); fixtures may have none. */
  readonly acts?: readonly GwAct[];
  /** The aims a country can declare (국가 목표). */
  readonly aims?: readonly GwAim[];
  /** Statecraft rows (ww157); fixtures may have none. */
  readonly inventions?: readonly GwInventionRow[];
  readonly projects?: readonly GwProjectRow[];
  readonly footing?: readonly GwFootingRow[];
  readonly shortages?: readonly GwShortageRow[];
}

/** Where the main story remembers the prologues. */
export const GW_ECHOES: readonly GwEcho[] = [
  ...DEU_ECHOES,
  ...GBR_ECHOES,
  ...AUH_ECHOES,
  ...RUS_ECHOES,
];

/** All content. A new country's file adds one line here. */
export const GW_CONTENT: GwContent = {
  scenes: withEchoes(
    withCommonBodies(
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
          ...withGbrPrivate(
            withMore([
              ...GBR_CRISIS_SCENES,
              ...GBR_WAR_SCENES,
              ...GBR_HOME_SCENES,
              ...GBR_WORLD_SCENES,
            ]),
          ),
          ...GBR_PRIVATE_SCENES,
          ...[
            ...RUS_CRISIS_SCENES,
            ...RUS_FRONT_SCENES,
            ...RUS_HOME_SCENES,
            ...RUS_FALL_SCENES,
          ].map(withRusPrivate),
          ...RUS_PRIVATE_SCENES,
          ...DEU_FRONT_SCENES,
          ...DEU_SEA_SCENES,
          ...DEU_HOME_SCENES,
          ...DEU_COURT_SCENES,
          ...GW_DIP_SCENES,
          ...GW_NEUTRAL_SCENES,
          ...TABLE_SCENES,
          ...GW_WORLD2_SCENES,
          ...GW_FRAME_SCENES,
        ].map(withPromiseTerms),
        ...BUDGET_SCENES,
        ...LAW_SCENES,
        ...CRAFT_SCENES,
        ...gwHouseScenes(GW_HOUSE_CONTENT, GW_LAWS),
        ...HOUSE_WRITTEN_SCENES,
        ...gwDossierScenes(GW_HOUSE_CONTENT),
        ...RULER_SCENES,
        ...GOV_SCENES,
        ...DEU_PRIVATE_SCENES,
        ...AUH_PRIVATE_SCENES,
        ...AUH_STORY_SCENES,
        ...PRESS_SCENES,
        ...DEU_STORY_SCENES,
        ...RUS_STORY_SCENES,
        ...[
          ...COMMON_ACT_SCENES,
          ...DEU_ACT_SCENES,
          ...GBR_ACT_SCENES,
          ...AUH_ACT_SCENES,
          ...RUS_ACT_SCENES,
        ].map((s) => ({ ...s, byAct: true })),
        ...DEU_PROLOGUE_SCENES,
        ...GBR_PROLOGUE_SCENES,
        ...AUH_PROLOGUE_SCENES,
        ...RUS_PROLOGUE_SCENES,
      ]
        .map(withDeuReplay)
        .map(withDeuPrivate)
        .map(withAuhPrivate)
        .map(withRuler),
    ),
    GW_ECHOES,
  ),
  people: [
    ...GW_PEOPLE,
    ...GW_PEOPLE_DEU,
    ...GW_PEOPLE_COMMON,
    ...GBR_PEOPLE,
    ...AUH_PEOPLE,
    ...RUS_PEOPLE,
    ...GW_PEOPLE_MONEY,
    ...GW_PEOPLE_RULER,
    ...DEU_PRIVATE_PEOPLE,
    ...RUS_KIN,
    ...GBR_PRIVATE_PEOPLE,
    ...AUH_PRIVATE_PEOPLE,
    ...GW_PEOPLE_HEADS,
  ],
  acts: [
    ...COMMON_ACTS,
    ...DEU_ACTS,
    ...GBR_ACTS,
    ...AUH_ACTS,
    ...RUS_ACTS,
    ...gwDossierActs(GW_HOUSE_CONTENT),
  ],
  aims: [...DEU_AIMS, ...GBR_AIMS, ...AUH_AIMS, ...RUS_AIMS],
  inventions: GW_INVENTIONS,
  projects: GW_PROJECTS,
  footing: GW_FOOTING,
  shortages: GW_SHORTAGE_ROWS,
  ...GW_HOUSE_CONTENT,
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
