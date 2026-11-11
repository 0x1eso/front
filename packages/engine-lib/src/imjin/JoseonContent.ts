// ww177 P6 (lane I6a, Imjin design §7, §8, §11): Joseon's own scenes, its
// war preparations and its people, and Ming as the court in Seoul sees it.
// - Every scene opens by the game's state (a trigger on flags, the war and
//   the map), never by date; history is the start, the state the rest.
// - An option only sets its pick flag (hidden on the card), so no result
//   shows before the pick. The engine (JoseonMing.readPicks) finds the flag
//   in JOS_RESULTS, applies the row and sends its result line in words.
// - The war preparations are decisions: they are tools, so they show what
//   they do, as Japan's run-up decisions do.
// - The people are advisors (court, army, staff and navy seats) with checked
//   facts in `source`; a person's faction is the court slot (Westerners on
//   democratic, Southerners communist, Northerners fascist, as CourtRules).
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  DecisionDef,
  EventDef,
  PersonDef,
  SpiritDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, flag, gflag, not, T } from "../ww1936/content/helpers";
import type { RegionGroupDef } from "../ww1936/content/types";
import { pickFlag } from "./CourtScenes";
import type { ShipKind } from "./SeaRules";

// ---- Places (region ids of resources/maps/imjin1592/scenario.json) ----

const R = {
  hanseong: 1,
  gaeseong: 2,
  suwon: 3,
  haengju: 4,
  chungju: 8,
  gongju: 10,
  dongnae: 14,
  miryang: 17,
  daegu: 18,
  jinju: 20,
  gimhae: 21,
  jeonju: 31,
  namwon: 32,
  pyongyang: 53,
  joryeong: 67,
  chupungnyeong: 68,
  jungnyeong: 69,
  cheolryeong: 70,
} as const;

/** Region groups the scenes' triggers read (Imjin only). */
export const JOS_GROUPS: readonly RegionGroupDef[] = [
  { id: "imjin_g_hanseong", regions: [R.hanseong], owner1936: "JOS" },
  { id: "imjin_g_pyongyang", regions: [R.pyongyang], owner1936: "JOS" },
  { id: "imjin_g_chungju", regions: [R.chungju], owner1936: "JOS" },
  { id: "imjin_g_jinju", regions: [R.jinju], owner1936: "JOS" },
  // Gyeongsang, from Dongnae to Mungyeong.
  {
    id: "imjin_g_gyeongsang",
    regions: [
      14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    ],
    owner1936: "JOS",
  },
];

const JPN = T("JPN");
const atWarWithJapan: Condition = { kind: "at_war_with", of: JPN };
const japanHolds = (group: string): Condition => ({
  kind: "occupied_by",
  group,
  of: JPN,
});
const warDays = (days: number): Condition => ({ kind: "war_days_ge", days });
const jpFlag = (f: string): Condition => ({ ...flag(f), who: JPN });
const peace = not({ kind: "at_war" });

/** Flags this file's scenes and preparations keep on Joseon. */
export const JOS_MARK = {
  /** The embassy's reports were heard (the run-up's next scenes may come). */
  embassyHeard: "imjin_jos_embassy_heard",
  /** The I4b warning flag: Joseon's watch on Japan rises (ImjinJapan). */
  heed: "imjin_jos_do_heed",
  /** A preparation's ships are ready to join the fleet (the engine adds them). */
  panokseon: "imjin_jos_do_panokseon",
  turtle: "imjin_jos_do_turtle",
} as const;

// ---- Scenes ----

type Opt = { id: string; ai: number };

function scene(
  id: string,
  picture: EventDef["picture"],
  trigger: Condition,
  mtthDays: number,
  opts: readonly Opt[],
): EventDef {
  return {
    id,
    kind: "country",
    receivers: ["JOS"],
    trigger,
    mtthDays,
    once: "country",
    timeoutSec: 30,
    picture,
    aiDelayDays: [1, 3],
    options: opts.map((o) => ({
      id: o.id,
      effects: [{ kind: "set_flag", flag: pickFlag(id, o.id) }],
      ai: { base: o.ai },
    })),
  };
}

const abc = (a: number, b: number, c?: number): Opt[] => [
  { id: "a", ai: a },
  { id: "b", ai: b },
  ...(c !== undefined ? [{ id: "c", ai: c }] : []),
];

/**
 * The scenes (the card's options in order, a first):
 * - run-up: the embassy's two reports, the crown prince, the defence
 *   system, the northern generals, telling Ming of Japan's letter;
 * - war: the landing, Chungju, the Imjin River, Jinju, Ming's army comes,
 *   Haengju, the famine, the second war, Pyongyang retaken.
 */
export const JOS_EVENTS: readonly EventDef[] = [
  // The run-up (design §8). The embassy comes home once Japan's muster shows.
  scene(
    "imjin_jos_embassy",
    "document",
    all(
      peace,
      any(
        jpFlag("imjin_jp_mustered"),
        jpFlag("imjin_jp_sekibune_built"),
        jpFlag("imjin_jp_nagoya_built"),
        jpFlag("imjin_jp_demands_sent"),
      ),
    ),
    30,
    abc(35, 45, 20),
  ),
  // Jeong Cheol's plea for an heir, while the Westerners rule.
  scene(
    "imjin_jos_crown_prince",
    "table",
    all(peace, { kind: "ruling", ideology: "democratic" }),
    150,
    abc(30, 50, 20),
  ),
  scene(
    "imjin_jos_defence_system",
    "map",
    all(peace, any(flag(JOS_MARK.embassyHeard), gflag("imjin_japan_demand"))),
    45,
    abc(60, 40),
  ),
  scene(
    "imjin_jos_northern_generals",
    "border",
    all(peace, flag(JOS_MARK.embassyHeard)),
    60,
    abc(50, 50),
  ),
  scene(
    "imjin_jos_warn_ming",
    "document",
    all(peace, gflag("imjin_japan_demand")),
    20,
    abc(60, 40),
  ),
  // The war.
  scene(
    "imjin_jos_landing",
    "column",
    all(atWarWithJapan, japanHolds("imjin_g_gyeongsang")),
    5,
    abc(45, 30, 25),
  ),
  scene(
    "imjin_jos_chungju",
    "map",
    all(
      atWarWithJapan,
      warDays(5),
      japanHolds("imjin_g_gyeongsang"),
      not(japanHolds("imjin_g_chungju")),
    ),
    10,
    abc(40, 40, 20),
  ),
  scene(
    "imjin_jos_imjin_river",
    "border",
    all(atWarWithJapan, japanHolds("imjin_g_hanseong")),
    5,
    abc(55, 45),
  ),
  scene(
    "imjin_jos_jinju",
    "crowd",
    all(atWarWithJapan, warDays(60), japanHolds("imjin_g_gyeongsang"), {
      kind: "controls_group",
      group: "imjin_g_jinju",
    }),
    30,
    abc(70, 30),
  ),
  scene(
    "imjin_jos_ming_arrives",
    "column",
    all({ kind: "at_war" }, gflag("imjin_ming_in")),
    5,
    abc(60, 40),
  ),
  scene(
    "imjin_jos_haengju",
    "map",
    all(atWarWithJapan, flag("imjin_gwon_yul"), japanHolds("imjin_g_hanseong")),
    15,
    abc(65, 35),
  ),
  scene(
    "imjin_jos_famine",
    "crowd",
    all({ kind: "at_war" }, warDays(300), { kind: "lost_vp_ge", pct: 15 }),
    30,
    abc(40, 30, 30),
  ),
  scene(
    "imjin_jos_second_war",
    "map",
    all(atWarWithJapan, gflag("imjin_truce_broken")),
    5,
    abc(45, 25, 30),
  ),
  scene(
    "imjin_jos_pyongyang",
    "column",
    all(
      atWarWithJapan,
      gflag("imjin_ming_relief"),
      japanHolds("imjin_g_pyongyang"),
    ),
    10,
    abc(55, 45),
  ),
];

// ---- What each pick does (applied by the engine, then told in words) ----

export interface JosResult {
  /** The pick flag (or a preparation's completion flag) the engine takes. */
  readonly flag: string;
  readonly effects?: readonly Effect[];
  /** Ships that join the fleet at the first held base of the list. */
  readonly ships?: {
    readonly bases: readonly string[];
    readonly kinds: readonly (readonly [ShipKind, number])[];
  };
  /** Ming's intervention meter and its suspicion of Joseon, bp. */
  readonly mingMeterBp?: number;
  readonly mingSuspicionBp?: number;
  /**
   * The result line's full key (`events_display.<message>`; the engine
   * sends the message); none: the effects speak.
   */
  readonly lineKey?: string;
}

const spirit = (id: string, days?: number): Effect =>
  days === undefined
    ? { kind: "add_spirit", id }
    : { kind: "add_spirit", id, days };
const fort = (regions: readonly number[], amount: number): Effect => ({
  kind: "fort",
  where: { regions },
  amount,
});
const stab = (pct: number): Effect => ({ kind: "stability", pct });
const ws = (pct: number): Effect => ({ kind: "war_support", pct });
const pp = (amount: number): Effect => ({ kind: "pp", amount });
const pop = (ideology: "democratic" | "communist" | "fascist", n: number) =>
  ({ kind: "popularity", ideology, pp: n }) as const;
const setFlag = (f: string): Effect => ({ kind: "set_flag", flag: f });
const heard = setFlag(JOS_MARK.embassyHeard);
const heed = setFlag(JOS_MARK.heed);
const conscription: Effect = {
  kind: "law_step",
  law: "conscription",
  steps: 1,
};

const pick = (s: string, o: string, r: Omit<JosResult, "flag">): JosResult => ({
  flag: pickFlag(s, o),
  lineKey: `events_display.ww1936_${s}_${o}`,
  ...r,
});

export const JOS_RESULTS: readonly JosResult[] = [
  // The embassy: Hwang Yun-gil (war comes), Kim Seong-il (no war), or both.
  pick("imjin_jos_embassy", "a", {
    effects: [heard, heed, stab(-3), ws(5), pop("democratic", 3)],
  }),
  pick("imjin_jos_embassy", "b", {
    effects: [heard, stab(3), pop("communist", 3)],
  }),
  pick("imjin_jos_embassy", "c", {
    effects: [heard, heed, pp(-20), fort([R.dongnae, R.gimhae], 1)],
  }),
  // The heir: name Gwanghae, exile Jeong Cheol, or leave it.
  pick("imjin_jos_crown_prince", "a", {
    effects: [stab(5), pop("democratic", 5)],
  }),
  pick("imjin_jos_crown_prince", "b", {
    effects: [
      stab(-3),
      pop("democratic", -10),
      pop("communist", 5),
      pop("fascist", 5),
    ],
  }),
  pick("imjin_jos_crown_prince", "c", { effects: [stab(-2)] }),
  // The defence system: the central muster or the regional garrisons.
  pick("imjin_jos_defence_system", "a", {
    effects: [spirit("imjin_jos_jeseung")],
  }),
  pick("imjin_jos_defence_system", "b", {
    effects: [spirit("imjin_jos_jingwan")],
  }),
  // Sin Rip and Yi Il ride south to look at the defences, or stay north.
  pick("imjin_jos_northern_generals", "a", {
    effects: [heed, fort([R.joryeong, R.chupungnyeong, R.jungnyeong], 1)],
  }),
  pick("imjin_jos_northern_generals", "b", { effects: [stab(2)] }),
  // Japan's letter: tell Beijing (Ryu Seong-ryong) or keep it (Yi San-hae).
  pick("imjin_jos_warn_ming", "a", {
    effects: [pp(-15)],
    mingMeterBp: 300,
    mingSuspicionBp: -600,
  }),
  pick("imjin_jos_warn_ming", "b", {
    effects: [stab(2)],
    mingSuspicionBp: 600,
  }),
  // The landing: hold the walls, take the people to the hills, or muster.
  pick("imjin_jos_landing", "a", {
    effects: [spirit("imjin_jos_last_stand", 60), ws(10)],
  }),
  pick("imjin_jos_landing", "b", { effects: [stab(3), ws(-3)] }),
  pick("imjin_jos_landing", "c", { effects: [conscription, stab(-5)] }),
  // Chungju: the plain, the pass, or back to the capital.
  pick("imjin_jos_chungju", "a", {
    effects: [spirit("imjin_jos_cavalry_stand", 45)],
  }),
  pick("imjin_jos_chungju", "b", {
    effects: [fort([R.joryeong], 2), fort([R.chungju], 1)],
  }),
  pick("imjin_jos_chungju", "c", { effects: [fort([R.hanseong], 1), ws(-3)] }),
  // The Imjin River line, or the army gathers at Pyongyang.
  pick("imjin_jos_imjin_river", "a", {
    effects: [fort([R.gaeseong], 1), spirit("imjin_jos_river_line", 60)],
  }),
  pick("imjin_jos_imjin_river", "b", {
    effects: [fort([R.pyongyang], 1), spirit("imjin_jos_muster_north", 90)],
  }),
  // Jinju: hold with the townsfolk, or send the garrison to Jeolla.
  pick("imjin_jos_jinju", "a", { effects: [fort([R.jinju], 2), ws(5)] }),
  pick("imjin_jos_jinju", "b", {
    effects: [fort([R.jeonju, R.namwon], 1), stab(-2)],
  }),
  // Ming's army: follow its generals and feed it, or keep our own command.
  pick("imjin_jos_ming_arrives", "a", {
    effects: [pp(-40), stab(-3)],
    mingMeterBp: 500,
  }),
  pick("imjin_jos_ming_arrives", "b", {
    effects: [ws(5)],
    mingMeterBp: -300,
    mingSuspicionBp: 300,
  }),
  // Haengju: hold the hill fort, or join the Ming army.
  pick("imjin_jos_haengju", "a", {
    effects: [fort([R.haengju], 2), spirit("imjin_jos_last_stand", 60)],
  }),
  pick("imjin_jos_haengju", "b", {
    effects: [spirit("imjin_jos_muster_north", 60)],
    mingMeterBp: 200,
  }),
  // The famine: the granaries, the blank titles, or the army first.
  pick("imjin_jos_famine", "a", { effects: [stab(8), pp(-40)] }),
  pick("imjin_jos_famine", "b", { effects: [pp(60), stab(-4)] }),
  pick("imjin_jos_famine", "c", {
    effects: [ws(5), stab(-8), spirit("imjin_jos_grain", 120)],
  }),
  // The second war: the mountain fortresses, empty plains, or Ming leads.
  pick("imjin_jos_second_war", "a", {
    effects: [fort([R.namwon, R.jeonju, R.daegu], 1)],
  }),
  pick("imjin_jos_second_war", "b", {
    effects: [stab(-5), ws(10), spirit("imjin_jos_scorched", 120)],
  }),
  pick("imjin_jos_second_war", "c", { effects: [stab(-3)], mingMeterBp: 500 }),
  // Pyongyang: our men on the walls beside Ming's, or Ming leads.
  pick("imjin_jos_pyongyang", "a", {
    effects: [spirit("imjin_jos_storm", 60), ws(5)],
  }),
  pick("imjin_jos_pyongyang", "b", { effects: [stab(2)], mingMeterBp: 300 }),
  // The preparations' ships (the decisions set these on completion).
  {
    flag: JOS_MARK.panokseon,
    ships: { bases: ["Yeosu", "Haenam", "Geoje"], kinds: [["panokseon", 6]] },
    lineKey: "events_display.ww1936_imjin_jos_ships_panokseon",
  },
  {
    flag: JOS_MARK.turtle,
    ships: { bases: ["Yeosu", "Haenam"], kinds: [["turtle", 2]] },
    lineKey: "events_display.ww1936_imjin_jos_ships_turtle",
  },
];

// ---- War preparations (about 15; the 1936 focus tree's place) ----

const once = (id: string): Condition => not({ kind: "decision_taken", id });

function prep(
  id: string,
  category: DecisionDef["category"],
  d: Omit<DecisionDef, "id" | "category" | "for" | "visible"> & {
    visible?: Condition;
    oneShot?: boolean;
  },
): DecisionDef {
  const { oneShot, visible, ...rest } = d;
  const vis =
    oneShot === false
      ? visible
      : visible === undefined
        ? once(id)
        : all(visible, once(id));
  return {
    id,
    category,
    for: ["JOS"],
    ...(vis !== undefined ? { visible: vis } : {}),
    ...rest,
  };
}

export const JOS_DECISIONS: readonly DecisionDef[] = [
  prep("imjin_jos_prep_walls_south", "military", {
    cost: { pp: 40 },
    days: 60,
    completeEffects: [
      fort([R.dongnae, R.miryang, R.jinju, R.gimhae], 1),
      stab(-2),
    ],
    ai: { base: 30, mods: [{ if: flag(JOS_MARK.embassyHeard), factor: 200 }] },
  }),
  prep("imjin_jos_prep_fortresses", "military", {
    cost: { pp: 40 },
    days: 90,
    completeEffects: [fort([R.suwon, R.haengju, R.gongju], 1)],
    ai: { base: 20 },
  }),
  prep("imjin_jos_prep_passes", "military", {
    cost: { pp: 35 },
    days: 60,
    completeEffects: [
      fort([R.joryeong, R.chupungnyeong, R.jungnyeong, R.cheolryeong], 1),
    ],
    ai: { base: 25 },
  }),
  prep("imjin_jos_prep_panokseon", "military", {
    oneShot: false,
    cost: { pp: 50 },
    days: 90,
    cooldownDays: 180,
    completeEffects: [setFlag(JOS_MARK.panokseon)],
    ai: { base: 25, mods: [{ if: flag("imjin_yi_navy"), factor: 200 }] },
  }),
  prep("imjin_jos_prep_turtle", "military", {
    visible: flag("imjin_yi_navy"),
    cost: { pp: 40 },
    days: 120,
    completeEffects: [setFlag(JOS_MARK.turtle)],
    ai: { base: 60 },
  }),
  prep("imjin_jos_prep_archers", "military", {
    cost: { pp: 35 },
    days: 60,
    completeEffects: [spirit("imjin_jos_archers")],
    ai: { base: 30 },
  }),
  prep("imjin_jos_prep_guns", "military", {
    oneShot: false,
    cost: { pp: 30 },
    days: 60,
    cooldownDays: 120,
    completeEffects: [
      { kind: "equipment", type: "artillery", gen: 1, count: 100 },
    ],
    ai: { base: 20 },
  }),
  prep("imjin_jos_prep_beacons", "military", {
    available: peace,
    cost: { pp: 20 },
    days: 30,
    completeEffects: [heed],
    ai: { base: 30 },
  }),
  prep("imjin_jos_prep_muster_rolls", "political", {
    oneShot: false,
    cost: { pp: 50 },
    days: 90,
    cooldownDays: 365,
    completeEffects: [conscription, stab(-3)],
    ai: { base: 15, mods: [{ if: { kind: "at_war" }, factor: 300 }] },
  }),
  prep("imjin_jos_prep_grain", "economy", {
    cost: { pp: 30 },
    days: 60,
    completeEffects: [spirit("imjin_jos_grain_stores")],
    ai: { base: 20 },
  }),
  prep("imjin_jos_prep_hullyeon", "military", {
    available: all({ kind: "at_war" }, warDays(180), gflag("imjin_ming_in")),
    cost: { pp: 60 },
    days: 120,
    completeEffects: [spirit("imjin_jos_samsu")],
    ai: { base: 50 },
  }),
  prep("imjin_jos_prep_somogun", "political", {
    available: all({ kind: "at_war" }, warDays(240)),
    cost: { pp: 40 },
    days: 60,
    completeEffects: [conscription, { kind: "manpower", recruitablePct: 5 }],
    ai: { base: 40 },
  }),
  prep("imjin_jos_prep_jochong", "military", {
    available: all({ kind: "at_war" }, warDays(120)),
    cost: { pp: 40 },
    days: 90,
    completeEffects: [spirit("imjin_jos_jochong")],
    ai: { base: 40 },
  }),
  prep("imjin_jos_prep_blank_titles", "economy", {
    oneShot: false,
    available: { kind: "at_war" },
    cooldownDays: 120,
    effects: [pp(50), stab(-3)],
    ai: { base: 10 },
  }),
  prep("imjin_jos_prep_relief", "economy", {
    oneShot: false,
    available: { kind: "at_war" },
    cost: { pp: 40 },
    cooldownDays: 90,
    effects: [stab(5)],
    ai: { base: 15 },
  }),
];

export const JOS_SPIRITS: readonly SpiritDef[] = [
  // 제승방략: men gather at set points for a commander sent from the capital.
  {
    id: "imjin_jos_jeseung",
    icon: "compass",
    stats: { planSpeedPct: 15, orgPct: -5 },
  },
  // 진관: every district defends its own ground.
  {
    id: "imjin_jos_jingwan",
    icon: "fort",
    stats: { defensePct: 10, planSpeedPct: -10 },
  },
  { id: "imjin_jos_last_stand", icon: "shield", stats: { defensePct: 10 } },
  {
    id: "imjin_jos_cavalry_stand",
    icon: "sword",
    stats: { attackPct: 10, defensePct: -5 },
  },
  { id: "imjin_jos_river_line", icon: "shield", stats: { defensePct: 8 } },
  {
    id: "imjin_jos_muster_north",
    icon: "flag",
    stats: { orgPct: 10, planSpeedPct: 10 },
  },
  {
    id: "imjin_jos_archers",
    icon: "infantry",
    stats: { attackPct: 5, defensePct: 5 },
  },
  { id: "imjin_jos_grain_stores", icon: "wheat", stats: { supplyUsePct: -10 } },
  { id: "imjin_jos_grain", icon: "wheat", stats: { supplyUsePct: -15 } },
  {
    id: "imjin_jos_samsu",
    icon: "medal",
    stats: { attackPct: 10, orgPct: 5 },
  },
  { id: "imjin_jos_jochong", icon: "infantry", stats: { attackPct: 5 } },
  {
    id: "imjin_jos_scorched",
    icon: "chain_broken",
    stats: { supplyUsePct: -10, stabilityBp: -300 },
  },
  { id: "imjin_jos_storm", icon: "fist", stats: { attackPct: 10 } },
];

export const JOS_FLAGS: readonly string[] = [
  JOS_MARK.embassyHeard,
  JOS_MARK.panokseon,
  JOS_MARK.turtle,
];

// ---- People (design §11; checked 2026-11-11, see each `source`) ----

function person(
  id: string,
  country: "JOS" | "MIN",
  slot: NonNullable<PersonDef["advisor"]>["slot"],
  trait: NonNullable<PersonDef["advisor"]>["traits"][number],
  source: string,
  ideology?: PersonDef["ideology"],
): PersonDef {
  return {
    id: `imjin_${id}`,
    nameKey: `imjin.person.${id}`,
    country,
    roles: ["advisor"],
    advisor: { slot, traits: [trait] },
    ...(ideology !== undefined ? { ideology } : {}),
    source,
  };
}

const KOWIKI = "ko.wikipedia";
const ENWIKI = "en.wikipedia Japanese invasions of Korea (1592-1598)";

export const JOS_PERSONS: readonly PersonDef[] = [
  // The court.
  person(
    "ryu_seong_ryong",
    "JOS",
    "political",
    "administrator",
    `${KOWIKI} 류성룡: right councillor 1590, left councillor; pressed to tell Ming of Japan's letter against Yi San-hae; recommended Gwon Yul and Yi Sun-sin 1591; chief councillor and commissioner in the war; led the moderates who became the Southerners`,
    "communist",
  ),
  person(
    "yi_san_hae",
    "JOS",
    "political",
    "security_chief",
    `${KOWIKI} 건저의 사건: chief councillor 1591, turned the heir plea against Jeong Cheol; head of the hard-line Easterners who became the Northerners`,
    "fascist",
  ),
  person(
    "jeong_cheol",
    "JOS",
    "political",
    "hawk",
    `${KOWIKI} 건저의 사건: Westerner, left councillor after the 1589 purge; asked for Gwanghae as heir in 1591 and was exiled to Ganggye`,
    "democratic",
  ),
  person(
    "yun_du_su",
    "JOS",
    "political",
    "fiscal_hawk",
    `${KOWIKI} 건저의 사건: a Westerner dismissed with Jeong Cheol in 1591`,
    "democratic",
  ),
  person(
    "hwang_yun_gil",
    "JOS",
    "political",
    "hawk",
    `${KOWIKI} 황윤길: chief envoy of the 1590 embassy, a Westerner; reported on his return (Busan, 1591-03) that war would surely come`,
    "democratic",
  ),
  person(
    "kim_seong_il",
    "JOS",
    "political",
    "conciliator",
    `${KOWIKI} 황윤길, 김시민: deputy envoy 1590, an Easterner; reported no sign of invasion; in the war the court's recruiting commissioner in Gyeongsang, who made Kim Si-min acting magistrate of Jinju`,
    "communist",
  ),
  person(
    "heo_seong",
    "JOS",
    "political",
    "administrator",
    `${KOWIKI} 황윤길: secretary of the 1590 embassy, an Easterner who sided with Hwang Yun-gil and was shunned for it`,
  ),
  person(
    "yi_hang_bok",
    "JOS",
    "political",
    "diplomat",
    `${KOWIKI} 이항복: royal secretary 1592, rode with the king north; minister of war in turn with Yi Deok-hyeong; at Uiju eased the Ming envoy's doubts so the relief came; kept out of the factions`,
  ),
  person(
    "yi_deok_hyeong",
    "JOS",
    "political",
    "diplomat",
    `${KOWIKI} 이덕형 (1561): youngest chief scholar 1591; talked with the envoy Genso in 1592; went to Ming to ask for an army; minister of war from 1593; right councillor 1598; Yi San-hae's son-in-law, of the Southerners`,
    "communist",
  ),
  // The army.
  person(
    "sin_rip",
    "JOS",
    "army_chief",
    "chief_offense",
    `${KOWIKI} 신립: beat Nitanggae's Jurchen with about 500 horse (1583); commander of the three provinces 1592; fought before the river at Tangeumdae near Chungju, lunar 1592-04-28, rejecting Kim Yeo-mul's advice to hold Joryeong; drowned himself`,
  ),
  person(
    "yi_il",
    "JOS",
    "army_chief",
    "chief_maneuver",
    `${KOWIKI} 제승방략, 신립; ${ENWIKI}: northern commander who urged the jeseung bangnyak (1588); border commander 1592, beaten at Sangju (4 Jun 1592), joined Sin Rip`,
  ),
  person(
    "gwon_yul",
    "JOS",
    "army_chief",
    "chief_defense",
    `${KOWIKI} 권율: Uiju magistrate 1591; Gwangju (Jeolla) magistrate at the outbreak 1592; won at Ichi with Hwang Jin and was made Jeolla governor; held Doksan; Haengju, lunar 1593-02-12; supreme commander 1593-06`,
  ),
  person(
    "kim_myeong_won",
    "JOS",
    "army_chief",
    "chief_organizer",
    `${KOWIKI} 김명원: supreme commander lunar 1592-04-29 on the Han; lost the Imjin River lunar 05-17; gave the command to Gwon Yul in 1593; later minister of war and councillor`,
  ),
  person(
    "kim_si_min",
    "JOS",
    "staff",
    "staff_training",
    `${KOWIKI} 김시민; ${ENWIKI}: Jinju assistant magistrate 1591, acting then full magistrate 1592; held Jinju about 3,800 strong with new arquebuses; shot on the last day (12 Nov 1592), died 1593-01-28`,
  ),
  person(
    "hwang_jin",
    "JOS",
    "staff",
    "staff_planner",
    `${KOWIKI} 권율: Dongbok county magistrate who beat Kobayakawa at Ichi with Gwon Yul (1592)`,
  ),
  // The navy.
  person(
    "yi_sun_sin",
    "JOS",
    "navy_chief",
    "nc_fleet_battle",
    `${KOWIKI} 이순신: Jeongeup magistrate 1589-12 on Ryu Seong-ryong's word; Jeolla Left Navy at Yeosu 1591-03-13 (lunar 02-13); turtle ships first fought at Sacheon; three-province admiral 1593; dismissed lunar 1597-04-11, jailed 04-19, spared on Jeong Tak's plea; restored after Chilcheollyang; killed at Noryang 16 Dec 1598`,
  ),
  person(
    "won_gyun",
    "JOS",
    "navy_chief",
    "nc_raider",
    `${KOWIKI} 원균: Gyeongsang Right Navy 1592, sank most of his own ships at the outbreak; fought beside Yi Sun-sin; three-province admiral 1597; killed after Chilcheollyang`,
  ),
  person(
    "yi_eok_gi",
    "JOS",
    "navy_chief",
    "nc_escort",
    `${KOWIKI} 이억기: Jeolla Right Navy, fought in the combined fleet with Yi Sun-sin and Won Gyun; killed at Chilcheollyang 1597`,
  ),
  // Ming, as the court sees it (an AI country: its seats).
  person(
    "song_yingchang",
    "MIN",
    "staff",
    "staff_logistics",
    `${ENWIKI}: commanded the Ming army at Pyongyang; his letters of 1 Mar 1593 tell the battle`,
  ),
  person(
    "li_rusong",
    "MIN",
    "army_chief",
    "chief_offense",
    `${ENWIKI}: commander of all Ming forces in Korea; Pyongyang 5-8 Feb 1593; checked at Byeokjegwan, after which he moved with care`,
  ),
  person(
    "zu_chengxun",
    "MIN",
    "army_chief",
    "chief_maneuver",
    `${ENWIKI}: led about 5,000 horse into Pyongyang; routed in the rain, 23 Aug 1592`,
  ),
  person(
    "wu_weizhong",
    "MIN",
    "staff",
    "staff_training",
    `${ENWIKI}: crossed the Yalu with 3,000 men on 5 Jan 1593 and fought at Pyongyang`,
  ),
  person(
    "luo_shangzhi",
    "MIN",
    "staff",
    "staff_planner",
    `${ENWIKI}: said to be first over Pyongyang's wall (6 Feb 1593); trained Korean gun units from July 1593`,
  ),
  person(
    "shen_weijing",
    "MIN",
    "political",
    "diplomat",
    `${ENWIKI}: chief negotiator of the peace talks; executed when the second invasion began (1597)`,
  ),
  person(
    "shi_xing",
    "MIN",
    "political",
    "conciliator",
    `${ENWIKI}: minister of war behind the talks, removed in 1597 (design §11: prison, died 1599)`,
  ),
  person(
    "xing_jie",
    "MIN",
    "political",
    "hawk",
    `${ENWIKI}: minister of war from 1597, stationed in Korea; planned the final offensive of 1598`,
  ),
  person(
    "yang_hao",
    "MIN",
    "staff",
    "staff_planner",
    `${ENWIKI}: superintendent of Korea 1597; fled ahead of his army from Ulsan, Jan 1598`,
  ),
  person(
    "ma_gui",
    "MIN",
    "army_chief",
    "chief_organizer",
    `${ENWIKI}: chief commander in Korea 1597; led the Ulsan offensives of 1598`,
  ),
  person(
    "liu_ting",
    "MIN",
    "army_chief",
    "chief_defense",
    `${ENWIKI}: struck Suncheon by land with Yi Sun-sin by sea, 1598`,
  ),
  person(
    "chen_lin",
    "MIN",
    "navy_chief",
    "nc_fleet_battle",
    `${ENWIKI}: came with the Ming navy in May 1598; night attack at Noryang, 16 Dec 1598`,
  ),
  person(
    "deng_zilong",
    "MIN",
    "navy_chief",
    "nc_escort",
    `${ENWIKI}: came with Chen Lin's navy in May 1598; killed at Noryang`,
  ),
];

/**
 * People named only in the scenes (no seat): the king, the crown prince,
 * Dongnae's magistrate, Busan's commander, Sin Rip's aide, Ming's Namwon
 * commander. Their `imjin.person.<id>` names are in the lang files.
 */
export const JOS_NAMED: readonly { id: string; source: string }[] = [
  {
    id: "seonjo",
    source: `${KOWIKI} 건저의 사건, 류성룡: the king; fled to Uiju 1592`,
  },
  {
    id: "gwanghae",
    source: `${KOWIKI} 건저의 사건: named crown prince in 1592 to lead the divided court`,
  },
  {
    id: "song_sang_hyeon",
    source: `${ENWIKI}: held Dongnae; refused Konishi: dying is easy, letting you pass is hard`,
  },
  {
    id: "jeong_bal",
    source: `${ENWIKI}: commander at Busan, killed late May 1592`,
  },
  {
    id: "kim_yeo_mul",
    source: `${KOWIKI} 신립: Sin Rip's aide, urged holding Joryeong, died with him`,
  },
  {
    id: "yang_yuan",
    source: `${ENWIKI}: led the Ming troops at Namwon 1597, escaped, executed by Ming`,
  },
];
