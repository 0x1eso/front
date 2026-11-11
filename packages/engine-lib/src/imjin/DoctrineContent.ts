// ww177 P7b (doctrine §2-§5): the decisions and the scene that change a
// country's way of war by state. Joseon restores 진관 after its muster
// fails, founds the 훈련도감 once Ming's drill masters are in the country,
// and can empty the countryside into its mountain fortresses (청야입보);
// Japan builds its coastal castles (the wajō) once the war turns. A human
// Joseon is asked whether a fleet facing a Japanese landing in force
// scuttles, withdraws west or fights (the AI decides by state). Options only
// set pick flags; the engine applies the results (ImjinDoctrine.ts).
import type {
  DecisionDef,
  EventDef,
  FlagId,
  SpiritDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { any, flag, gflag, not } from "../ww1936/content/helpers";
import { MING_SECOND_RELIEF_GFLAG } from "./CourtRules";
import { pickFlag } from "./CourtScenes";
import { DOCTRINE_FLAGS as D } from "./Doctrine";

/** Japan's wajō under construction (the decision's 60 days). */
export const WAESEONG_BUILDING = "imjin_jpn_waeseong_building";
/** The spirit 청야입보 gives for its 120 days. */
export const CHEONGYA_SPIRIT = "imjin_jos_cheongya";
export const CHEONGYA_DAYS = 120;
/** The scuttling scene (doctrine §5; main's call: a choice for a human). */
export const SCUTTLE_SCENE = "imjin_jos_scuttle";

export const DOCTRINE_DECISIONS: readonly DecisionDef[] = [
  {
    id: "imjin_jos_restore_jingwan",
    category: "military",
    for: ["JOS"],
    visible: flag(D.josRouted),
    available: not({ kind: "has_spirit", id: "imjin_jos_jingwan" }),
    cost: { pp: 25 },
    effects: [
      { kind: "remove_spirit", id: "imjin_jos_jeseung" },
      { kind: "add_spirit", id: "imjin_jos_jingwan" },
    ],
    ai: { base: 60 },
  },
  {
    id: "imjin_jos_hullyeon",
    category: "military",
    for: ["JOS"],
    visible: flag(D.josDrill),
    available: not(flag(D.josHullyeon)),
    cost: { pp: 40 },
    effects: [{ kind: "set_flag", flag: D.josHullyeon }],
    ai: { base: 60 },
  },
  {
    id: "imjin_jos_cheongya",
    category: "military",
    for: ["JOS"],
    visible: { kind: "at_war" },
    available: not(flag(D.josCheongya)),
    cost: { pp: 20 },
    cooldownDays: 240,
    effects: [
      { kind: "set_flag", flag: D.josCheongya, days: CHEONGYA_DAYS },
      { kind: "add_spirit", id: CHEONGYA_SPIRIT, days: CHEONGYA_DAYS },
    ],
    ai: { base: 10 },
  },
  {
    id: "imjin_jpn_waeseong",
    category: "military",
    for: ["JPN"],
    visible: any(gflag(D.jpnSeaCaution), flag(D.jpnLostRegion)),
    available: not(any(flag(WAESEONG_BUILDING), flag(D.jpnWaeseong))),
    cost: { pp: 50 },
    days: 60,
    effects: [{ kind: "set_flag", flag: WAESEONG_BUILDING }],
    completeEffects: [{ kind: "set_flag", flag: D.jpnWaeseong }],
    ai: { base: 60 },
  },
];

export const DOCTRINE_SPIRITS: readonly SpiritDef[] = [
  // 청야입보: the fields emptied into the fortresses; the work stops.
  { id: CHEONGYA_SPIRIT, icon: "wheat", stats: { outputPct: -10 } },
];

/**
 * The scuttling scene: a scuttle the fleet and send its crews to the
 * walls, b withdraw west to the next base, c fight.
 */
export const DOCTRINE_EVENTS: readonly EventDef[] = [
  {
    id: SCUTTLE_SCENE,
    kind: "country",
    once: "never",
    picture: "map",
    aiDelayDays: [0, 1],
    options: ["a", "b", "c"].map((o) => ({
      id: o,
      effects: [{ kind: "set_flag", flag: pickFlag(SCUTTLE_SCENE, o) }],
      ai: { base: o === "c" ? 100 : 0 },
    })),
  },
];

export const DOCTRINE_FLAG_IDS: readonly FlagId[] = [
  ...Object.values(D),
  WAESEONG_BUILDING,
  MING_SECOND_RELIEF_GFLAG,
];
