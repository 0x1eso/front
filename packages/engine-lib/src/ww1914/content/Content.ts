import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwAct, GwAim } from "@openfront/engine-api/ww1914/GwActs";
import type { GwDeptContent } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwPersonaContent } from "@openfront/engine-api/ww1914/GwPersona";
import { joinPersona } from "@openfront/engine-api/ww1914/GwPersona";
import type { GwEcho, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "../CraftRows";
import type { GwHouseContent } from "../HouseRows";
import type { GwPowerContent } from "../PowerRows";
import { withRuler } from "../RulerRows";
import { joinDepts } from "../TaskRows";
import { AUH_ACT_SCENES, AUH_ACTS, AUH_AIMS } from "./acts/auh";
import {
  AGENT_ACTS,
  AGENT_SCENES,
  COMMON_ACT_SCENES,
  COMMON_ACTS,
  SPY_SCENES,
} from "./acts/common";
import { DEU_ACT_SCENES, DEU_ACTS, DEU_AIMS } from "./acts/deu";
import { FRA_ACT_SCENES, FRA_ACTS, FRA_AIMS } from "./acts/fra";
import { GBR_ACT_SCENES, GBR_ACTS, GBR_AIMS } from "./acts/gbr";
import { NAVAL_ACT_SCENES, NAVAL_ACTS } from "./acts/naval";
import { RUS_ACT_SCENES, RUS_ACTS, RUS_AIMS } from "./acts/rus";
import { GW_CAPITAL_SCENES } from "./capital";
import { AUH_DEPT_SCENES, AUH_DEPTS } from "./depts/auh";
import { COMMON_DEPT_SCENES, COMMON_DEPTS } from "./depts/common";
import { DEU_DEPT_SCENES, DEU_DEPTS } from "./depts/deu";
import { FRA_DEPT_SCENES, FRA_DEPTS } from "./depts/fra";
import { GBR_DEPT_SCENES, GBR_DEPTS } from "./depts/gbr";
import { RUS_DEPT_SCENES, RUS_DEPTS } from "./depts/rus";
import { GW_LADDER_POWERS, GW_LADDER_SCENES } from "./ladder";
import { GW_PEOPLE } from "./people";
import { AUH_PEOPLE } from "./people_auh";
import { GW_PEOPLE_COMMON } from "./people_common";
import { DEU_POSTS, GW_PEOPLE_DEU } from "./people_deu";
import { FRA_PEOPLE, FRA_POSTS } from "./people_fra";
import { GBR_PEOPLE, GBR_POSTS } from "./people_gbr";
import { GW_PEOPLE_HEADS } from "./people_heads";
import { GW_PEOPLE_MONEY } from "./people_money";
import { GW_PEOPLE_RULER } from "./people_ruler";
import { RUS_PEOPLE, RUS_POSTS } from "./people_rus";
import { RUS_KIN } from "./people_rus_private";
import { SPY_PEOPLE } from "./people_spies";
import { AUH_PERSONA } from "./persona/auh";
import { DEU_PERSONA } from "./persona/deu";
import { FRA_PERSONA } from "./persona/fra";
import { GBR_PERSONA } from "./persona/gbr";
import { RUS_PERSONA } from "./persona/rus";
import { AUH_POWER_SCENES, AUH_POWERS, AUH_REACTORS } from "./powers/auh";
import { COMMON_POWER_SCENES, COMMON_POWERS } from "./powers/common";
import { DEU_POWER_SCENES, DEU_POWERS, DEU_REACTORS } from "./powers/deu";
import { FRA_POWER_SCENES, FRA_POWERS, FRA_REACTORS } from "./powers/fra";
import { GBR_POWER_SCENES, GBR_POWERS, GBR_REACTORS } from "./powers/gbr";
import { RUS_POWER_SCENES, RUS_POWERS, RUS_REACTORS } from "./powers/rus";
import { AUH_STORY_SCENES } from "./scenes/auh_act";
import { AUH_AFTER_SCENES } from "./scenes/auh_after";
import { AUH_AGENTS_SCENES } from "./scenes/auh_agents";
import { AUH_QUIET_SCENES, withAuhBodies } from "./scenes/auh_bodies";
import { AUH_COLONIES_SCENES } from "./scenes/auh_colonies";
import { AUH_CRISIS_SCENES } from "./scenes/auh_crisis";
import { AUH_CROWN_SCENES } from "./scenes/auh_crown";
import { AUH_HOMEFRONT_SCENES } from "./scenes/auh_homefront";
import { AUH_LAND_EVENTS } from "./scenes/auh_lands";
import { AUH_OFFENSIVE_SCENES } from "./scenes/auh_offensive";
import {
  AUH_PRIVATE_PEOPLE,
  AUH_PRIVATE_SCENES,
  withAuhPrivate,
} from "./scenes/auh_private";
import { AUH_ECHOES, AUH_PROLOGUE_SCENES } from "./scenes/auh_prologue";
import { AUH_REALM_SCENES } from "./scenes/auh_realm";
import { AUH_RULE_SCENES } from "./scenes/auh_rule";
import { AUH_SETTLE_SCENES } from "./scenes/auh_settle";
import { AUH_STALL_EVENTS } from "./scenes/auh_stall";
import { AUH_WAR_SCENES } from "./scenes/auh_war";
import { AUH_WAR_EVENTS } from "./scenes/auh_wars";
import { AUH_YEARS_SCENES } from "./scenes/auh_years";
import { BUDGET_SCENES } from "./scenes/budget";
import { COMMON_SCENES } from "./scenes/common";
import {
  CRAFT_SCENES,
  GW_FOOTING,
  GW_INVENTIONS,
  GW_PROJECTS,
  GW_SHORTAGE_ROWS,
} from "./scenes/craft";
import { DEU_SCENES } from "./scenes/deu";
import { DEU_STORY_SCENES } from "./scenes/deu_act";
import { DEU_AFTER_SCENES } from "./scenes/deu_after";
import { DEU_BACK_SCENES, withPromiseTerms } from "./scenes/deu_back";
import { DEU_COURT_SCENES } from "./scenes/deu_court";
import { DEU_CRISIS_SCENES } from "./scenes/deu_crisis";
import { DEU_FRONT_SCENES } from "./scenes/deu_front";
import { DEU_HOME_SCENES } from "./scenes/deu_home";
import { DEU_HOMEFRONT_SCENES } from "./scenes/deu_homefront";
import { DEU_LAND_EVENTS } from "./scenes/deu_lands";
import { DEU_OFFENSIVE_SCENES } from "./scenes/deu_offensive";
import { DEU_PEACE_SCENES, withSummerWar } from "./scenes/deu_peace";
import { DEU_PEOPLE_SCENES } from "./scenes/deu_people";
import {
  DEU_PRIVATE_PEOPLE,
  DEU_PRIVATE_SCENES,
  withDeuPrivate,
} from "./scenes/deu_private";
import { DEU_ECHOES, DEU_PROLOGUE_SCENES } from "./scenes/deu_prologue";
import { withDeuReplay } from "./scenes/deu_replay";
import { DEU_RULE_SCENES } from "./scenes/deu_rule";
import { DEU_SEA_SCENES } from "./scenes/deu_sea";
import { DEU_SETTLE_SCENES } from "./scenes/deu_settle";
import { DEU_STALL_EVENTS } from "./scenes/deu_stall";
import { DEU_WAR_SCENES } from "./scenes/deu_war";
import { DEU_WAR_EVENTS } from "./scenes/deu_wars";
import { DEU_YEARS_SCENES } from "./scenes/deu_years";
import { gwDossierActs, gwDossierScenes } from "./scenes/dossier";
import { GW_FILLER_SCENES } from "./scenes/filler";
import { FRA_STORY_SCENES } from "./scenes/fra_act";
import { FRA_AFTER_SCENES } from "./scenes/fra_after";
import { FRA_COLONIES_SCENES } from "./scenes/fra_colonies";
import { FRA_CRISIS_SCENES } from "./scenes/fra_crisis";
import { FRA_HOME_SCENES } from "./scenes/fra_home";
import { FRA_HOMEFRONT_SCENES } from "./scenes/fra_homefront";
import { FRA_LAND_EVENTS } from "./scenes/fra_lands";
import { FRA_OFFENSIVE_SCENES } from "./scenes/fra_offensive";
import { FRA_PRESIDENT_SCENES } from "./scenes/fra_president";
import { FRA_PRIVATE_PEOPLE, FRA_PRIVATE_SCENES } from "./scenes/fra_private";
import { FRA_ECHOES, FRA_PROLOGUE_SCENES } from "./scenes/fra_prologue";
import { FRA_RULE_SCENES } from "./scenes/fra_rule";
import { FRA_SETTLE_SCENES } from "./scenes/fra_settle";
import { FRA_STALL_EVENTS } from "./scenes/fra_stall";
import { FRA_WAR_SCENES } from "./scenes/fra_war";
import { FRA_WAR_EVENTS } from "./scenes/fra_wars";
import { FRA_WORLD_SCENES } from "./scenes/fra_world";
import { FRA_YEARS_SCENES } from "./scenes/fra_years";
import { GBR_AFTER_SCENES } from "./scenes/gbr_after";
import { GBR_CRISIS_SCENES } from "./scenes/gbr_crisis";
import { GBR_HOME_SCENES } from "./scenes/gbr_home";
import { GBR_HOMEFRONT_SCENES } from "./scenes/gbr_homefront";
import { GBR_LAND_EVENTS } from "./scenes/gbr_lands";
import { withMore } from "./scenes/gbr_more";
import { GBR_OFFENSIVE_SCENES } from "./scenes/gbr_offensive";
import {
  GBR_PRIVATE_PEOPLE,
  GBR_PRIVATE_SCENES,
  withGbrPrivate,
} from "./scenes/gbr_private";
import { GBR_ECHOES, GBR_PROLOGUE_SCENES } from "./scenes/gbr_prologue";
import { GBR_RULE_SCENES } from "./scenes/gbr_rule";
import { GBR_SETTLE_SCENES } from "./scenes/gbr_settle";
import { GBR_STALL_EVENTS } from "./scenes/gbr_stall";
import { GBR_WAR_SCENES } from "./scenes/gbr_war";
import { GBR_WAR_EVENTS } from "./scenes/gbr_wars";
import { GBR_WORLD_SCENES } from "./scenes/gbr_world";
import { GBR_YEARS_SCENES } from "./scenes/gbr_years";
import { GOV_SCENES } from "./scenes/gov";
import { GW_AFTER_SCENES } from "./scenes/gw_after";
import { GW_DIP_SCENES } from "./scenes/gw_dip";
import { GW_FRAME_SCENES } from "./scenes/gw_frame";
import { GW_HOMEFRONT_SCENES } from "./scenes/gw_homefront";
import { GW_NEUTRAL_SCENES } from "./scenes/gw_neutral";
import { withCommonBodies } from "./scenes/gw_replay";
import { GW_RULE_SCENES } from "./scenes/gw_rule";
import { GW_WORLD2_SCENES } from "./scenes/gw_world2";
import { GW_YEARS_SCENES } from "./scenes/gw_years";
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
import { RUS_AFTER_SCENES } from "./scenes/rus_after";
import { RUS_AGENTS_SCENES } from "./scenes/rus_agents";
import { RUS_COLONIES_SCENES } from "./scenes/rus_colonies";
import { RUS_CRISIS_SCENES } from "./scenes/rus_crisis";
import { RUS_FALL_SCENES } from "./scenes/rus_fall";
import { RUS_FRONT_SCENES } from "./scenes/rus_front";
import { RUS_HOME_SCENES } from "./scenes/rus_home";
import { RUS_HOMEFRONT_SCENES } from "./scenes/rus_homefront";
import { RUS_LAND_EVENTS } from "./scenes/rus_lands";
import { RUS_OFFENSIVE_SCENES } from "./scenes/rus_offensive";
import { RUS_PRIVATE_SCENES, withRusPrivate } from "./scenes/rus_private";
import { RUS_ECHOES, RUS_PROLOGUE_SCENES } from "./scenes/rus_prologue";
import { RUS_RULE_SCENES } from "./scenes/rus_rule";
import { RUS_SETTLE_SCENES } from "./scenes/rus_settle";
import { RUS_STALL_EVENTS } from "./scenes/rus_stall";
import { RUS_WAR_EVENTS } from "./scenes/rus_wars";
import { RUS_YEARS_SCENES } from "./scenes/rus_years";
import { SETTLE_SCENES } from "./scenes/settle";
import { STALL_SCENES } from "./scenes/stall_events";
import { TABLE_SCENES } from "./scenes/table";
import { WARTIME_SCENES } from "./scenes/wartime";
import { WORLD_SCENES } from "./scenes/world";

export interface GwContent extends GwHouseContent, GwPowerContent {
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
  /** ww193: the departments' rows (content/depts); fixtures may have none. */
  readonly depts?: GwDeptContent;
  /** ww196: the ruler as a person (content/persona); fixtures may have none. */
  readonly persona?: GwPersonaContent;
}

/** Where the main story remembers the prologues. */
export const GW_ECHOES: readonly GwEcho[] = [
  ...DEU_ECHOES,
  ...GBR_ECHOES,
  ...AUH_ECHOES,
  ...RUS_ECHOES,
  ...FRA_ECHOES,
];

/** All content. A new country's file adds one line here. */
export const GW_CONTENT: GwContent = {
  scenes: withEchoes(
    withCommonBodies(
      [
        ...COMMON_SCENES,
        // ww193: the departments' fallback reports and the seats' new papers.
        ...COMMON_DEPT_SCENES,
        ...DEU_DEPT_SCENES,
        ...GBR_DEPT_SCENES,
        ...FRA_DEPT_SCENES,
        ...RUS_DEPT_SCENES,
        ...AUH_DEPT_SCENES,
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
          ...FRA_CRISIS_SCENES,
          ...FRA_WAR_SCENES,
          ...FRA_HOME_SCENES,
          ...FRA_WORLD_SCENES,
          ...FRA_PRIVATE_SCENES,
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
        ...FRA_STORY_SCENES,
        ...[
          ...COMMON_ACT_SCENES,
          ...NAVAL_ACT_SCENES,
          ...AGENT_SCENES,
          ...DEU_ACT_SCENES,
          ...GBR_ACT_SCENES,
          ...AUH_ACT_SCENES,
          ...RUS_ACT_SCENES,
          ...FRA_ACT_SCENES,
        ].map((s) => ({ ...s, byAct: true })),
        ...COMMON_POWER_SCENES,
        ...DEU_POWER_SCENES,
        ...GBR_POWER_SCENES,
        ...AUH_POWER_SCENES,
        ...RUS_POWER_SCENES,
        ...FRA_POWER_SCENES,
        ...DEU_PROLOGUE_SCENES,
        ...GBR_PROLOGUE_SCENES,
        ...AUH_PROLOGUE_SCENES,
        ...RUS_PROLOGUE_SCENES,
        ...FRA_PROLOGUE_SCENES,
        ...GW_LADDER_SCENES,
        // ww188: a fallen capital and giving up.
        ...GW_CAPITAL_SCENES,
        ...GW_FILLER_SCENES,
        // ww171 phase 4: each seat's scenes of new wars and peaces.
        ...DEU_WAR_EVENTS,
        ...GBR_WAR_EVENTS,
        ...AUH_WAR_EVENTS,
        ...RUS_WAR_EVENTS,
        ...FRA_WAR_EVENTS,
        // ww172 phase 5: each seat's scenes of occupation and the tables.
        ...DEU_LAND_EVENTS,
        ...GBR_LAND_EVENTS,
        ...AUH_LAND_EVENTS,
        ...RUS_LAND_EVENTS,
        ...FRA_LAND_EVENTS,
        // ww173 phase A: a front that breaks, the plain card and each seat's.
        ...STALL_SCENES,
        ...DEU_STALL_EVENTS,
        ...GBR_STALL_EVENTS,
        ...AUH_STALL_EVENTS,
        ...RUS_STALL_EVENTS,
        ...FRA_STALL_EVENTS,
        // ww173 phase B: each seat's scenes of its great offensives.
        ...DEU_OFFENSIVE_SCENES,
        ...GBR_OFFENSIVE_SCENES,
        ...AUH_OFFENSIVE_SCENES,
        ...RUS_OFFENSIVE_SCENES,
        ...FRA_OFFENSIVE_SCENES,
        // ww173: the secret war's desk scenes (acts/common).
        ...SPY_SCENES,
        // ww190: the peace years, ruling land, the home front, the aftermath.
        ...DEU_YEARS_SCENES,
        ...DEU_RULE_SCENES,
        ...DEU_SETTLE_SCENES,
        ...DEU_HOMEFRONT_SCENES,
        ...DEU_AFTER_SCENES,
        ...GBR_YEARS_SCENES,
        ...GBR_RULE_SCENES,
        ...GBR_SETTLE_SCENES,
        ...GBR_HOMEFRONT_SCENES,
        ...GBR_AFTER_SCENES,
        ...FRA_YEARS_SCENES,
        ...FRA_RULE_SCENES,
        ...FRA_SETTLE_SCENES,
        ...FRA_HOMEFRONT_SCENES,
        ...FRA_AFTER_SCENES,
        ...RUS_YEARS_SCENES,
        ...RUS_RULE_SCENES,
        ...RUS_SETTLE_SCENES,
        ...RUS_HOMEFRONT_SCENES,
        ...RUS_AFTER_SCENES,
        ...AUH_YEARS_SCENES,
        ...AUH_RULE_SCENES,
        ...AUH_SETTLE_SCENES,
        ...AUH_HOMEFRONT_SCENES,
        ...AUH_AFTER_SCENES,
        ...FRA_COLONIES_SCENES,
        ...RUS_COLONIES_SCENES,
        ...AUH_COLONIES_SCENES,
        ...RUS_AGENTS_SCENES,
        ...AUH_AGENTS_SCENES,
        ...FRA_PRESIDENT_SCENES,
        ...GW_YEARS_SCENES,
        ...GW_RULE_SCENES,
        ...SETTLE_SCENES,
        ...GW_HOMEFRONT_SCENES,
        ...GW_AFTER_SCENES,
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
    ...FRA_PEOPLE,
    ...FRA_PRIVATE_PEOPLE,
    ...SPY_PEOPLE,
    // ww179: names for the vacancy boxes that had none, last for the rolls.
    ...DEU_POSTS,
    ...GBR_POSTS,
    ...RUS_POSTS,
    ...FRA_POSTS,
  ],
  acts: [
    ...COMMON_ACTS,
    ...NAVAL_ACTS,
    ...AGENT_ACTS,
    ...DEU_ACTS,
    ...GBR_ACTS,
    ...AUH_ACTS,
    ...RUS_ACTS,
    ...FRA_ACTS,
    ...gwDossierActs(GW_HOUSE_CONTENT),
  ],
  aims: [...DEU_AIMS, ...GBR_AIMS, ...AUH_AIMS, ...RUS_AIMS, ...FRA_AIMS],
  inventions: GW_INVENTIONS,
  projects: GW_PROJECTS,
  footing: GW_FOOTING,
  shortages: GW_SHORTAGE_ROWS,
  depts: joinDepts([
    COMMON_DEPTS,
    DEU_DEPTS,
    GBR_DEPTS,
    FRA_DEPTS,
    RUS_DEPTS,
    AUH_DEPTS,
  ]),
  persona: joinPersona([
    DEU_PERSONA,
    GBR_PERSONA,
    FRA_PERSONA,
    RUS_PERSONA,
    AUH_PERSONA,
  ]),
  ...GW_HOUSE_CONTENT,
  powers: [
    ...DEU_POWERS,
    ...GBR_POWERS,
    ...AUH_POWERS,
    ...RUS_POWERS,
    ...FRA_POWERS,
    ...GW_LADDER_POWERS,
    // The person's own end, last in its group.
    ...COMMON_POWERS,
  ],
  reactors: [
    ...DEU_REACTORS,
    ...GBR_REACTORS,
    ...AUH_REACTORS,
    ...RUS_REACTORS,
    ...FRA_REACTORS,
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
