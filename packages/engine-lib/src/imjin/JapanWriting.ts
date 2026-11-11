// ww177 I6b (Imjin design §7, §8, §11): Japan's writing. The run-up's
// scenes (Hideyoshi's demand, the Sō house, the muster), the war's scenes,
// Japan's war preparations and its people. Every scene is called by the
// state (flags, ground held, the other side's flags), never by a date; the
// options say what is done, never what comes of it. Texts: ww1936.event_*,
// ww1936.decision*, ww1936.spirit*, ww1936.person.* in resources/lang.
//
// Facts checked on the web on 2026-11-11 (en.wikipedia "Japanese invasions
// of Korea (1592-1598)" for the 1592 divisions and Song Sang-hyeon's answer
// at Dongnae; japanese-wiki-corpus "Umekita Ikki" for the 1592 rising at
// Sashiki; "Battle of Bukgwan" and "Prince Imhae" for Kuk Gyeong-in handing
// the princes to Katō at Hoeryong; en.wikipedia "Toyotomi Hidekatsu" for his
// death on Geoje; "Ōtomo Yoshimune" for his flight near Pyongyang; "Nihon
// Maru" for Kuki's flagship; tabi-samurai "Keicho no Yaku" for Kobayakawa
// Hideaki's command in 1597). The engine reads person dates against 1936,
// so the people here carry none: their years are in `source`.
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  DecisionDef,
  EventDef,
  FlagId,
  PersonDef,
  RegionGroupDef,
  SpiritDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, flag, gflag, not, T } from "../ww1936/content/helpers";
import { IMJIN_FLAGS, IMJIN_GFLAGS } from "./CourtScenes";
import { JP_FLAG, JP_MARK } from "./JapanContent";

/** Flags this file's scenes set (marks that stay, and hints for the AIs). */
export const JPW_FLAG = {
  /** The Sō house carried the demand its own softer way. */
  soSoftened: "imjin_jpw_so_softened",
  /** The Taikō's letter asked Joseon to lead the way to Ming. */
  letterSent: "imjin_jpw_letter_sent",
  /** Hidetsugu holds the kampaku's title and the home realm. */
  kampakuGiven: "imjin_jpw_kampaku_given",
  /** Katō holds the two Joseon princes. */
  princesHeld: "imjin_jpw_princes_held",
  /** The fleet keeps to its harbours (the sea AI may read it). */
  seaHold: "imjin_jpw_sea_hold",
  /** The fleet seeks out Joseon's admiral (the sea AI may read it). */
  seaSeek: "imjin_jpw_sea_seek",
} as const;

export const IMJIN_JPW_FLAGS: readonly FlagId[] = Object.values(JPW_FLAG);

/** One-region groups the scenes' triggers read (the imjin1592 map's ids). */
export const JPW_GROUP = {
  dongnae: "imjin_g_dongnae",
  hanseong: "imjin_g_hanseong",
  chungju: "imjin_g_chungju",
  sangju: "imjin_g_sangju",
  pyongyang: "imjin_g_pyongyang",
  hoeryong: "imjin_g_hoeryong",
  jinju: "imjin_g_jinju",
  /** The south coast where the Japanese forts (wajō) stood. */
  southCoast: "imjin_g_south_coast",
  /** Every Joseon county (regions 1-70). */
  korea: "imjin_g_korea",
} as const;

const KOREA_REGIONS: readonly number[] = Array.from(
  { length: 70 },
  (_, i) => i + 1,
);

export const IMJIN_JPW_GROUPS: readonly RegionGroupDef[] = [
  { id: JPW_GROUP.dongnae, regions: [14], owner1936: "JOS" },
  { id: JPW_GROUP.hanseong, regions: [1], owner1936: "JOS" },
  { id: JPW_GROUP.chungju, regions: [8], owner1936: "JOS" },
  { id: JPW_GROUP.sangju, regions: [19], owner1936: "JOS" },
  { id: JPW_GROUP.pyongyang, regions: [53], owner1936: "JOS" },
  { id: JPW_GROUP.hoeryong, regions: [62], owner1936: "JOS" },
  { id: JPW_GROUP.jinju, regions: [20], owner1936: "JOS" },
  {
    id: JPW_GROUP.southCoast,
    // Dongnae, Ulsan, Gimhae, Sacheon, Ungcheon, Geoje, Suncheon.
    regions: [14, 16, 21, 22, 26, 27, 34],
    owner1936: "JOS",
  },
  { id: JPW_GROUP.korea, regions: KOREA_REGIONS, owner1936: "JOS" },
];

/** The spirits the scenes and preparations give. */
export const JPW_SPIRIT = {
  forcedMarch: "imjin_jpw_forced_march",
  beachhead: "imjin_jpw_beachhead",
  race: "imjin_jpw_race",
  onePlan: "imjin_jpw_one_plan",
  provinces: "imjin_jpw_provinces",
  chaseKing: "imjin_jpw_chase_king",
  holdPyongyang: "imjin_jpw_hold_pyongyang",
  pushYalu: "imjin_jpw_push_yalu",
  seaHold: "imjin_jpw_sea_hold",
  seaSeek: "imjin_jpw_sea_seek",
  roadGarrisons: "imjin_jpw_road_garrisons",
  reprisals: "imjin_jpw_reprisals",
  holdNorth: "imjin_jpw_hold_north",
  fallBack: "imjin_jpw_fall_back",
  pullSouth: "imjin_jpw_pull_south",
  holdAll: "imjin_jpw_hold_all",
  jinju: "imjin_jpw_jinju",
  kampakuHome: "imjin_jpw_kampaku_home",
  taikoAlone: "imjin_jpw_taiko_alone",
  riceStores: "imjin_jpw_rice_stores",
  roadMaps: "imjin_jpw_road_maps",
  volleys: "imjin_jpw_volleys",
  relayCastles: "imjin_jpw_relay_castles",
  winterGear: "imjin_jpw_winter_gear",
} as const;

export const IMJIN_JPW_SPIRITS: SpiritDef[] = [
  {
    id: JPW_SPIRIT.forcedMarch,
    icon: "infantry",
    stats: { planSpeedPct: 20, orgPct: -10 },
  },
  {
    id: JPW_SPIRIT.beachhead,
    icon: "shield",
    stats: { orgPct: 10, planSpeedPct: -10 },
  },
  {
    id: JPW_SPIRIT.race,
    icon: "infantry",
    stats: { attackPct: 5, planSpeedPct: 15, orgPct: -5 },
  },
  {
    id: JPW_SPIRIT.onePlan,
    icon: "shield",
    stats: { orgPct: 5, defensePct: 5 },
  },
  {
    id: JPW_SPIRIT.provinces,
    icon: "crown",
    stats: { complianceGainPct: 20, garrisonNeedPct: -10 },
  },
  {
    id: JPW_SPIRIT.chaseKing,
    icon: "infantry",
    stats: { planSpeedPct: 15, supplyUsePct: 10 },
  },
  { id: JPW_SPIRIT.holdPyongyang, icon: "shield", stats: { defensePct: 10 } },
  {
    id: JPW_SPIRIT.pushYalu,
    icon: "infantry",
    stats: { attackPct: 5, supplyUsePct: 10 },
  },
  {
    id: JPW_SPIRIT.seaHold,
    icon: "shield",
    stats: { convoyEscortPct: 15, convoyLossPct: -10 },
  },
  {
    id: JPW_SPIRIT.seaSeek,
    icon: "infantry",
    stats: { navyAttackPct: 10, convoyEscortPct: -10 },
  },
  {
    id: JPW_SPIRIT.roadGarrisons,
    icon: "shield",
    stats: { supplyUsePct: -10, planSpeedPct: -10 },
  },
  {
    id: JPW_SPIRIT.reprisals,
    icon: "chain_broken",
    stats: { garrisonNeedPct: -15, resistanceTargetPct: 20 },
  },
  {
    id: JPW_SPIRIT.holdNorth,
    icon: "shield",
    stats: { defensePct: 10, orgPct: -5 },
  },
  {
    id: JPW_SPIRIT.fallBack,
    icon: "shield",
    stats: { orgPct: 10, recoveryPct: 15 },
  },
  {
    id: JPW_SPIRIT.pullSouth,
    icon: "shield",
    stats: { orgPct: 10, recoveryPct: 20 },
  },
  {
    id: JPW_SPIRIT.holdAll,
    icon: "shield",
    stats: { defensePct: 5, orgPct: -10 },
  },
  { id: JPW_SPIRIT.jinju, icon: "infantry", stats: { attackPct: 10 } },
  {
    id: JPW_SPIRIT.kampakuHome,
    icon: "crown",
    stats: { stabilityBp: 300, ppGainPct: 5 },
  },
  {
    id: JPW_SPIRIT.taikoAlone,
    icon: "crown",
    stats: { ppGainPct: 10, stabilityBp: -300 },
  },
  { id: JPW_SPIRIT.riceStores, icon: "factory", stats: { supplyUsePct: -10 } },
  { id: JPW_SPIRIT.roadMaps, icon: "infantry", stats: { planSpeedPct: 5 } },
  { id: JPW_SPIRIT.volleys, icon: "infantry", stats: { attackPct: 5 } },
  {
    id: JPW_SPIRIT.relayCastles,
    icon: "factory",
    stats: { supplyUsePct: -5, convoyLossPct: -10 },
  },
  {
    id: JPW_SPIRIT.winterGear,
    icon: "shield",
    stats: { winterPenaltyPct: -30, orgPct: 5 },
  },
];

/** Scene ids (texts: ww1936.event_title|desc|opt.<id>). */
export const JPW_SCENE = {
  soPlea: "imjin_jp_so_plea",
  embassy: "imjin_jp_embassy",
  tsurumatsu: "imjin_jp_tsurumatsu",
  kampaku: "imjin_jp_kampaku",
  shimazuLate: "imjin_jp_shimazu_late",
  umekita: "imjin_jp_umekita",
  busan: "imjin_jp_busan",
  race: "imjin_jp_race",
  hanseong: "imjin_jp_hanseong",
  pyongyang: "imjin_jp_pyongyang",
  princes: "imjin_jp_princes",
  seaAdmiral: "imjin_jp_sea_admiral",
  righteous: "imjin_jp_righteous",
  mingArmy: "imjin_jp_ming_army",
  longWar: "imjin_jp_long_war",
  jinju: "imjin_jp_jinju",
  noses: "imjin_jp_noses",
  hidetsugu: "imjin_jp_hidetsugu",
} as const;

const set = (f: string): Effect => ({ kind: "set_flag", flag: f });
const spirit = (id: string, days?: number): Effect => ({
  kind: "add_spirit",
  id,
  ...(days !== undefined ? { days } : {}),
});
const ctrl = (group: string): Condition => ({ kind: "controls_group", group });
const atWarJos: Condition = { kind: "at_war_with", of: T("JOS") };
const warBegun = flag(JP_MARK.warBegun);
const josFlag = (f: string): Condition => ({
  kind: "flag",
  who: T("JOS"),
  flag: f,
});

type Opt = readonly [ai: number, effects: readonly Effect[]];

/** A Japanese scene the state calls: options a, b (, c) in order. */
function jpScene(
  id: string,
  picture: EventDef["picture"],
  trigger: Condition,
  opts: readonly Opt[],
  mtthDays?: number,
  once: EventDef["once"] = "country",
): EventDef {
  return {
    id,
    kind: "country",
    receivers: ["JPN"],
    trigger,
    ...(mtthDays !== undefined ? { mtthDays } : {}),
    once,
    picture,
    timeoutSec: 30,
    options: opts.map(([ai, effects], i) => ({
      id: "abcd"[i],
      ai: { base: ai },
      effects,
    })),
  };
}

export const IMJIN_JPW_EVENTS: EventDef[] = [
  // ---- The run-up ----
  // Sō Yoshitoshi must carry the Taikō's demand to Joseon; Tsushima lives by
  // the Busan trade, and he would rather ask for an embassy.
  jpScene(
    JPW_SCENE.soPlea,
    "document",
    all(
      not(warBegun),
      not(flag(JP_MARK.demandsSent)),
      not(flag(JPW_FLAG.soSoftened)),
    ),
    [
      [
        50,
        [
          set(JPW_FLAG.soSoftened),
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: -3, who: T("JOS") },
        ],
      ],
      [50, [set(JP_MARK.demandsSent), set(JP_FLAG.demands)]],
    ],
    40,
  ),
  // The Joseon embassy before Hideyoshi at Jurakudai, and his letter.
  jpScene(
    JPW_SCENE.embassy,
    "table",
    all(
      not(warBegun),
      any(
        { kind: "days_since_flag_ge", flag: JPW_FLAG.soSoftened, days: 45 },
        { kind: "days_since_flag_ge", flag: JP_MARK.demandsSent, days: 45 },
      ),
    ),
    [
      [
        70,
        [
          set(JPW_FLAG.letterSent),
          { kind: "set_gflag", flag: IMJIN_GFLAGS.japanDemand },
          { kind: "war_support", pct: 5 },
          { kind: "war_support", pct: 3, who: T("JOS") },
        ],
      ],
      [
        30,
        [
          { kind: "stability", pct: 3 },
          { kind: "pp", amount: 20 },
        ],
      ],
    ],
    30,
  ),
  // His infant son dies; the grief may come at any time of the run-up.
  jpScene(
    JPW_SCENE.tsurumatsu,
    "crowd",
    not(warBegun),
    [
      [
        60,
        [
          { kind: "war_support", pct: 10 },
          { kind: "stability", pct: -5 },
        ],
      ],
      [
        40,
        [
          { kind: "stability", pct: 3 },
          { kind: "war_support", pct: -3 },
        ],
      ],
    ],
    500,
    "game",
  ),
  // Once the muster runs: who rules at home while the Taikō makes war.
  jpScene(
    JPW_SCENE.kampaku,
    "crowd",
    all(not(warBegun), flag(JP_MARK.mustered)),
    [
      [60, [set(JPW_FLAG.kampakuGiven), spirit(JPW_SPIRIT.kampakuHome)]],
      [40, [spirit(JPW_SPIRIT.taikoAlone)]],
    ],
    60,
  ),
  // The Shimazu, beaten in 1587, are slow to fill their quota.
  jpScene(
    JPW_SCENE.shimazuLate,
    "map",
    all(not(warBegun), flag(JP_MARK.mustered)),
    [
      [55, [set(JP_FLAG.example)]],
      [45, [{ kind: "stability", pct: 1 }]],
    ],
    75,
  ),
  // A Shimazu retainer seizes a castle at home rather than cross.
  jpScene(
    JPW_SCENE.umekita,
    "border",
    all(warBegun, atWarJos),
    [
      [55, [set(JP_FLAG.example), { kind: "stability", pct: -2 }]],
      [
        45,
        [
          { kind: "pp", amount: -30 },
          { kind: "stability", pct: -2 },
        ],
      ],
    ],
    120,
  ),

  // ---- The war ----
  // Busan and Dongnae have fallen.
  jpScene(JPW_SCENE.busan, "column", all(atWarJos, ctrl(JPW_GROUP.dongnae)), [
    [60, [spirit(JPW_SPIRIT.forcedMarch, 60)]],
    [40, [spirit(JPW_SPIRIT.beachhead, 60)]],
  ]),
  // The corps race each other up the roads to Hanseong.
  jpScene(
    JPW_SCENE.race,
    "map",
    all(
      atWarJos,
      any(ctrl(JPW_GROUP.sangju), ctrl(JPW_GROUP.chungju)),
      not(ctrl(JPW_GROUP.hanseong)),
    ),
    [
      [60, [spirit(JPW_SPIRIT.race, 90)]],
      [40, [spirit(JPW_SPIRIT.onePlan, 90)]],
    ],
  ),
  // The capital is taken.
  jpScene(JPW_SCENE.hanseong, "map", all(atWarJos, ctrl(JPW_GROUP.hanseong)), [
    [50, [spirit(JPW_SPIRIT.provinces, 365)]],
    [35, [spirit(JPW_SPIRIT.chaseKing, 60)]],
    [
      15,
      [
        { kind: "war_support", pct: 8 },
        { kind: "pp", amount: -40 },
      ],
    ],
  ]),
  // Pyongyang is taken; the fleet should come up the west coast.
  jpScene(
    JPW_SCENE.pyongyang,
    "map",
    all(atWarJos, ctrl(JPW_GROUP.pyongyang)),
    [
      [55, [spirit(JPW_SPIRIT.holdPyongyang, 120)]],
      [45, [spirit(JPW_SPIRIT.pushYalu, 120)]],
    ],
  ),
  // In the far north the princes are handed over.
  jpScene(JPW_SCENE.princes, "crowd", all(atWarJos, ctrl(JPW_GROUP.hoeryong)), [
    [70, [set(JPW_FLAG.princesHeld), { kind: "pp", amount: 30 }]],
    [
      30,
      [
        { kind: "war_support", pct: -5, who: T("JOS") },
        { kind: "stability", pct: 2 },
      ],
    ],
  ]),
  // A Joseon admiral with cannon-armed ships holds the south coast.
  jpScene(
    JPW_SCENE.seaAdmiral,
    "border",
    all(
      atWarJos,
      { kind: "war_days_ge", days: 45 },
      josFlag(IMJIN_FLAGS.yiNavy),
    ),
    [
      [55, [set(JPW_FLAG.seaHold), spirit(JPW_SPIRIT.seaHold, 365)]],
      [45, [set(JPW_FLAG.seaSeek), spirit(JPW_SPIRIT.seaSeek, 180)]],
    ],
    30,
  ),
  // Righteous armies cut the roads behind the corps.
  jpScene(
    JPW_SCENE.righteous,
    "border",
    all(atWarJos, josFlag(IMJIN_FLAGS.bandsOut)),
    [
      [55, [spirit(JPW_SPIRIT.roadGarrisons, 180)]],
      [
        45,
        [
          spirit(JPW_SPIRIT.reprisals, 180),
          { kind: "resistance", group: JPW_GROUP.korea, pct: 10 },
          { kind: "war_support", pct: 5, who: T("JOS") },
        ],
      ],
    ],
    20,
  ),
  // Ming's army crosses the Yalu.
  jpScene(
    JPW_SCENE.mingArmy,
    "column",
    all(atWarJos, gflag(IMJIN_GFLAGS.mingIn)),
    [
      [50, [spirit(JPW_SPIRIT.holdNorth, 120)]],
      [50, [spirit(JPW_SPIRIT.fallBack, 120)]],
    ],
  ),
  // The campaign drags on: pull back to the coast or hold every town.
  jpScene(
    JPW_SCENE.longWar,
    "column",
    all(atWarJos, { kind: "war_days_ge", days: 150 }),
    [
      [50, [spirit(JPW_SPIRIT.pullSouth, 120)]],
      [50, [spirit(JPW_SPIRIT.holdAll, 120)]],
    ],
    90,
  ),
  // The Taikō wants the walled town that threw his army back.
  jpScene(
    JPW_SCENE.jinju,
    "map",
    all(
      atWarJos,
      { kind: "war_days_ge", days: 240 },
      ctrl(JPW_GROUP.dongnae),
      not(ctrl(JPW_GROUP.jinju)),
    ),
    [
      [60, [spirit(JPW_SPIRIT.jinju, 90), { kind: "war_support", pct: 5 }]],
      [40, [{ kind: "stability", pct: -2 }]],
    ],
    60,
  ),
  // The second war: how the dead are counted.
  jpScene(
    JPW_SCENE.noses,
    "document",
    all(atWarJos, gflag(IMJIN_GFLAGS.truceBroken)),
    [
      [
        60,
        [
          set(JP_FLAG.grant),
          { kind: "resistance", group: JPW_GROUP.korea, pct: 10 },
          { kind: "war_support", pct: 10, who: T("JOS") },
        ],
      ],
      [40, [{ kind: "stability", pct: -3 }]],
    ],
    30,
  ),
  // An heir is born; the kampaku's place is in doubt.
  jpScene(
    JPW_SCENE.hidetsugu,
    "table",
    all(flag(JPW_FLAG.kampakuGiven), warBegun, {
      kind: "war_days_ge",
      days: 365,
    }),
    [
      [
        55,
        [
          { kind: "remove_spirit", id: JPW_SPIRIT.kampakuHome },
          spirit(JPW_SPIRIT.taikoAlone),
          { kind: "stability", pct: -8 },
        ],
      ],
      [45, [{ kind: "stability", pct: 2 }]],
    ],
    200,
    "game",
  ),
];

const notAtWar = not(warBegun);
const once = (mark: string): Condition => not(flag(mark));

/** Japan's war preparations (with I4b's five run-up decisions, sixteen). */
export const IMJIN_JPW_DECISIONS: DecisionDef[] = [
  {
    id: "imjin_jp_kunitomo_guns",
    category: "military",
    for: ["JPN"],
    cost: { pp: 40 },
    cooldownDays: 180,
    days: 60,
    completeEffects: [
      { kind: "equipment", type: "infantry_equipment", gen: 1, count: 1_500 },
      { kind: "equipment", type: "artillery", gen: 1, count: 100 },
    ],
    ai: { base: 25 },
  },
  {
    id: "imjin_jp_rice_stores",
    category: "economy",
    for: ["JPN"],
    visible: once("imjin_jpw_rice_stored"),
    cost: { pp: 50 },
    days: 90,
    effects: [set("imjin_jpw_rice_stored")],
    completeEffects: [spirit(JPW_SPIRIT.riceStores)],
    ai: { base: 25 },
  },
  {
    id: "imjin_jp_korea_roads",
    category: "military",
    for: ["JPN"],
    available: notAtWar,
    visible: once("imjin_jpw_roads_mapped"),
    cost: { pp: 30 },
    days: 60,
    effects: [set("imjin_jpw_roads_mapped")],
    completeEffects: [spirit(JPW_SPIRIT.roadMaps)],
    ai: { base: 20 },
  },
  {
    id: "imjin_jp_volley_drill",
    category: "military",
    for: ["JPN"],
    visible: once("imjin_jpw_volleys_drilled"),
    cost: { pp: 40 },
    days: 90,
    effects: [set("imjin_jpw_volleys_drilled")],
    completeEffects: [
      spirit(JPW_SPIRIT.volleys),
      { kind: "army_xp", amount: 20 },
    ],
    ai: { base: 25 },
  },
  {
    id: "imjin_jp_hostages",
    category: "political",
    for: ["JPN"],
    visible: once("imjin_jpw_hostages_kept"),
    cost: { pp: 50 },
    effects: [
      set("imjin_jpw_hostages_kept"),
      set(JP_FLAG.grant),
      { kind: "stability", pct: -3 },
    ],
    ai: { base: 15 },
  },
  {
    id: "imjin_jp_kuki_ships",
    category: "military",
    for: ["JPN"],
    cost: { pp: 60 },
    cooldownDays: 365,
    days: 120,
    completeEffects: [{ kind: "convoys", amount: 150 }],
    ai: { base: 20 },
  },
  {
    id: "imjin_jp_relay_castles",
    category: "military",
    for: ["JPN"],
    visible: once("imjin_jpw_relays_built"),
    cost: { pp: 40 },
    days: 90,
    effects: [set("imjin_jpw_relays_built")],
    completeEffects: [
      spirit(JPW_SPIRIT.relayCastles),
      { kind: "convoys", amount: 40 },
    ],
    ai: { base: 25 },
  },
  {
    id: "imjin_jp_wajo",
    category: "military",
    for: ["JPN"],
    available: all(atWarJos, {
      kind: "controls_group",
      group: JPW_GROUP.dongnae,
    }),
    cost: { pp: 50 },
    cooldownDays: 180,
    days: 60,
    completeEffects: [
      { kind: "fort", where: { group: JPW_GROUP.southCoast }, amount: 2 },
    ],
    ai: { base: 20 },
  },
  {
    id: "imjin_jp_second_levy",
    category: "military",
    for: ["JPN"],
    available: warBegun,
    cost: { pp: 40 },
    cooldownDays: 365,
    effects: [
      { kind: "manpower", recruitablePct: 10 },
      { kind: "stability", pct: -3 },
    ],
    ai: { base: 15 },
  },
  {
    id: "imjin_jp_winter_clothes",
    category: "economy",
    for: ["JPN"],
    available: warBegun,
    visible: once("imjin_jpw_winter_sent"),
    cost: { pp: 30 },
    days: 45,
    effects: [set("imjin_jpw_winter_sent")],
    completeEffects: [
      spirit(JPW_SPIRIT.winterGear),
      { kind: "equipment", type: "support_equipment", gen: 1, count: 100 },
    ],
    ai: { base: 25 },
  },
  {
    id: "imjin_jp_village_notices",
    category: "political",
    for: ["JPN"],
    available: all(atWarJos, ctrl(JPW_GROUP.hanseong)),
    cost: { pp: 40 },
    cooldownDays: 180,
    effects: [{ kind: "compliance", group: JPW_GROUP.korea, pct: 10 }],
    ai: { base: 15 },
  },
];

/** The marks the preparations set. */
export const IMJIN_JPW_DECISION_FLAGS: readonly FlagId[] = [
  "imjin_jpw_rice_stored",
  "imjin_jpw_roads_mapped",
  "imjin_jpw_volleys_drilled",
  "imjin_jpw_hostages_kept",
  "imjin_jpw_relays_built",
  "imjin_jpw_winter_sent",
];

type Slot = NonNullable<PersonDef["advisor"]>;
const adv = (
  id: string,
  country: PersonDef["country"],
  slot: Slot["slot"],
  trait: Slot["traits"][number],
  source: string,
): PersonDef => ({
  id,
  nameKey: `ww1936.person.${id}`,
  country,
  roles: ["advisor"],
  advisor: { slot, traits: [trait] },
  source,
});

/**
 * Japan's people (and Ming's go-between), as advisors. `source`: the years
 * and the role in the war; checked on the web 2026-11-11 unless it says
 * "unchecked".
 */
export const IMJIN_JPW_PERSONS: PersonDef[] = [
  // The commissioners (bugyō) and the regents.
  adv(
    "imjin_ishida_mitsunari",
    "JPN",
    "staff",
    "staff_logistics",
    "1560-1600; commissioner, sent to Hanseong in 1592; one of the Five Commissioners",
  ),
  adv(
    "imjin_otani_yoshitsugu",
    "JPN",
    "staff",
    "staff_planner",
    "c.1558-1600; commissioner in Korea 1592-93",
  ),
  adv(
    "imjin_mashita_nagamori",
    "JPN",
    "political",
    "administrator",
    "1545-1615; commissioner in Korea 1592-93; one of the Five Commissioners",
  ),
  adv(
    "imjin_natsuka_masaie",
    "JPN",
    "industry",
    "ind_production",
    "?-1600; ran the treasury and the rice for the war; one of the Five Commissioners",
  ),
  adv(
    "imjin_asano_nagamasa",
    "JPN",
    "political",
    "planner",
    "1547-1611; one of the Five Commissioners",
  ),
  adv(
    "imjin_maeda_geni",
    "JPN",
    "political",
    "security_chief",
    "1539-1602; governor of Kyoto; one of the Five Commissioners",
  ),
  adv(
    "imjin_tokugawa_ieyasu",
    "JPN",
    "political",
    "conciliator",
    "1543-1616; held his men at Nagoya and never crossed; first of the Five Elders",
  ),
  adv(
    "imjin_maeda_toshiie",
    "JPN",
    "political",
    "administrator",
    "1538-1599; one of the Five Elders",
  ),
  adv(
    "imjin_uesugi_kagekatsu",
    "JPN",
    "army_chief",
    "chief_defense",
    "1556-1623; one of the Five Elders",
  ),
  adv(
    "imjin_toyotomi_hidetsugu",
    "JPN",
    "political",
    "planner",
    "1568-1595; kampaku from the end of 1591; forced to kill himself in 1595",
  ),
  // The go-betweens.
  adv(
    "imjin_konishi_yukinaga",
    "JPN",
    "political",
    "diplomat",
    "c.1558-1600; first division 1592; the truce talks with Shen Weijing",
  ),
  adv(
    "imjin_so_yoshitoshi",
    "JPN",
    "political",
    "diplomat",
    "1568-1615; lord of Tsushima, Konishi's son-in-law; first division 1592",
  ),
  adv(
    "imjin_genso",
    "JPN",
    "political",
    "orator",
    "Keitetsu Genso, 1537-1611; Zen monk of Tsushima, went with the Sō missions and with Konishi",
  ),
  adv(
    "imjin_yanagawa_shigenobu",
    "JPN",
    "political",
    "conciliator",
    "?-1605; the Sō house's elder and envoy (dates unchecked)",
  ),
  adv(
    "imjin_naito_joan",
    "JPN",
    "political",
    "diplomat",
    "Konishi's envoy to Beijing in the talks (dates unchecked)",
  ),
  adv(
    "imjin_saisho_jotai",
    "JPN",
    "political",
    "propagandist",
    "1548-1607; Zen monk, wrote Hideyoshi's foreign letters",
  ),
  // The commanders of the corps.
  adv(
    "imjin_kato_kiyomasa",
    "JPN",
    "army_chief",
    "chief_offense",
    "1562-1611; second division; took the princes at Hoeryong 1592; Ulsan 1597-98",
  ),
  adv(
    "imjin_kuroda_nagamasa",
    "JPN",
    "army_chief",
    "chief_maneuver",
    "1568-1623; third division 1592",
  ),
  adv(
    "imjin_shimazu_yoshihiro",
    "JPN",
    "army_chief",
    "chief_defense",
    "1535-1619; fourth division 1592; Sacheon 1598",
  ),
  adv(
    "imjin_kobayakawa_takakage",
    "JPN",
    "army_chief",
    "chief_maneuver",
    "1533-1597; sixth division; Byeokjegwan 1593",
  ),
  adv(
    "imjin_tachibana_muneshige",
    "JPN",
    "army_chief",
    "chief_offense",
    "1567-1643; sixth division; Byeokjegwan 1593",
  ),
  adv(
    "imjin_ukita_hideie",
    "JPN",
    "army_chief",
    "chief_organizer",
    "1572-1655; eighth division, commander at Hanseong; one of the Five Elders",
  ),
  adv(
    "imjin_fukushima_masanori",
    "JPN",
    "staff",
    "staff_training",
    "1561-1624; fifth division 1592",
  ),
  adv(
    "imjin_mori_terumoto",
    "JPN",
    "army_chief",
    "chief_organizer",
    "1553-1625; seventh division; one of the Five Elders",
  ),
  adv(
    "imjin_kobayakawa_hideaki",
    "JPN",
    "staff",
    "staff_planner",
    "1582-1602; commander-in-chief of the 1597 invasion, at Busan",
  ),
  adv(
    "imjin_nabeshima_naoshige",
    "JPN",
    "staff",
    "staff_training",
    "1538-1618; second division 1592",
  ),
  adv(
    "imjin_chosokabe_motochika",
    "JPN",
    "staff",
    "staff_training",
    "1539-1599; fifth division 1592",
  ),
  adv(
    "imjin_hosokawa_tadaoki",
    "JPN",
    "staff",
    "staff_planner",
    "1563-1646; ninth division; the first siege of Jinju 1592",
  ),
  adv(
    "imjin_hachisuka_iemasa",
    "JPN",
    "staff",
    "staff_logistics",
    "1558-1639; fifth division 1592",
  ),
  adv(
    "imjin_matsura_shigenobu",
    "JPN",
    "navy_chief",
    "nc_raider",
    "1549-1614; lord of Hirado; first division 1592",
  ),
  adv(
    "imjin_arima_harunobu",
    "JPN",
    "staff",
    "staff_training",
    "1567-1612; first division 1592",
  ),
  // The admirals.
  adv(
    "imjin_kuki_yoshitaka",
    "JPN",
    "navy_chief",
    "nc_fleet_battle",
    "1542-1600; built the Nihon Maru, his flagship at Angolpo 1592",
  ),
  adv(
    "imjin_todo_takatora",
    "JPN",
    "navy_chief",
    "nc_amphibious",
    "1556-1630; fleet commander 1597, Chilcheollyang",
  ),
  adv(
    "imjin_wakisaka_yasuharu",
    "JPN",
    "navy_chief",
    "nc_escort",
    "1554-1626; beaten at Hansan 1592",
  ),
  adv(
    "imjin_kato_yoshiaki",
    "JPN",
    "navy_chief",
    "nc_fleet_battle",
    "1563-1631; fleet commander, Chilcheollyang 1597",
  ),
  adv(
    "imjin_kurushima_michifusa",
    "JPN",
    "navy_chief",
    "nc_raider",
    "1561-1597; fifth division 1592; killed at Myeongnyang",
  ),
  // Ming's go-between in the talks with Konishi.
  adv(
    "imjin_shen_weijing",
    "MIN",
    "political",
    "diplomat",
    "Ming's go-between with Konishi; executed once the talks failed (years unchecked)",
  ),
];
