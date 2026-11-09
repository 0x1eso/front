// Great War 1914: the world's fixed numbers. Everything here is a starting
// guess at June 1914 (design §4); the seed moves it inside these bounds.
import {
  GW_THEATRES,
  GwGauge,
  GwOpening,
  GwPlan,
  GwResearch,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";

/** Countries the war needs, on the map or not (the test map has five). */
export const GW_ACTORS: readonly GwTag[] = [
  "DEU",
  "AUH",
  "RUS",
  "FRA",
  "GBR",
  "ITA",
  "OTT",
  "USA",
  "JPN",
  "SRB",
  "MNE",
  "BEL",
  "ROU",
  "BGR",
  "GRC",
];

/** Strength bands 1..5 where a country fights; the seed moves each by one. */
export const GW_FORCE: Readonly<
  Partial<Record<GwTag, Partial<Record<GwTheatre, number>>>>
> = {
  DEU: { west: 5, east: 2, balkan: 1, italy: 1, sea: 3, colonies: 1 },
  AUH: { east: 3, balkan: 2, italy: 3 },
  RUS: { east: 4, caucasus: 3 },
  FRA: { west: 4, balkan: 1, colonies: 1, straits: 1 },
  GBR: {
    west: 2,
    sea: 5,
    balkan: 1,
    straits: 2,
    mesopotamia: 1,
    palestine: 1,
    colonies: 3,
  },
  ITA: { italy: 3 },
  OTT: { caucasus: 2, straits: 3, mesopotamia: 2, palestine: 2 },
  USA: { west: 1, sea: 2 },
  JPN: { colonies: 2 },
  SRB: { balkan: 2 },
  MNE: { balkan: 1 },
  BEL: { west: 1 },
  ROU: { east: 2 },
  BGR: { balkan: 3 },
  GRC: { balkan: 1 },
};

const SIDES = (central: GwTag[], entente: GwTag[]) => ({ central, entente });

/** Who fights in a theatre, the lead first. */
export const GW_THEATRE_SIDES: Readonly<
  Record<GwTheatre, Readonly<Record<GwSide, readonly GwTag[]>>>
> = {
  west: SIDES(["DEU"], ["FRA", "GBR", "BEL", "USA"]),
  east: SIDES(["DEU", "AUH"], ["RUS", "ROU"]),
  // Behind Serbia stands whoever lands at Salonika.
  balkan: SIDES(["AUH", "BGR", "DEU"], ["SRB", "MNE", "GRC", "FRA", "GBR"]),
  italy: SIDES(["AUH", "DEU"], ["ITA"]),
  caucasus: SIDES(["OTT"], ["RUS"]),
  straits: SIDES(["OTT"], ["GBR", "FRA"]),
  mesopotamia: SIDES(["OTT"], ["GBR"]),
  palestine: SIDES(["OTT"], ["GBR"]),
  sea: SIDES(["DEU"], ["GBR", "USA"]),
  colonies: SIDES(["DEU"], ["GBR", "FRA", "JPN"]),
};

export function theatresOf(tag: GwTag): GwTheatre[] {
  return GW_THEATRES.filter(
    (t) =>
      GW_THEATRE_SIDES[t].central.includes(tag) ||
      GW_THEATRE_SIDES[t].entente.includes(tag),
  );
}

/** The AI's order of theatres to put its main effort in. */
export const GW_AI_MAIN: Readonly<
  Partial<Record<GwTag, readonly GwTheatre[]>>
> = {
  DEU: ["west", "east", "balkan", "italy"],
  AUH: ["balkan", "east", "italy"],
  RUS: ["east", "caucasus"],
  FRA: ["west", "straits"],
  GBR: ["west", "straits", "mesopotamia", "palestine", "sea"],
  ITA: ["italy"],
  OTT: ["caucasus", "straits", "palestine", "mesopotamia"],
  USA: ["west"],
  JPN: ["colonies"],
  SRB: ["balkan"],
  MNE: ["balkan"],
  BEL: ["west"],
  ROU: ["east"],
  BGR: ["balkan"],
  GRC: ["balkan"],
};

/** What each trains its research on, a year at a time, round and round. */
export const GW_AI_RESEARCH: Readonly<
  Partial<Record<GwTag, readonly GwResearch[]>>
> = {
  DEU: ["artillery", "infantry", "sea", "infantry"],
  GBR: ["artillery", "sea", "infantry", "sea"],
  FRA: ["artillery", "infantry"],
  USA: ["sea", "infantry"],
  AUH: ["artillery", "infantry"],
  RUS: ["artillery", "infantry"],
};

/**
 * New armies: a band more, the given months after a country came in. Kitchener's
 * men, conscription, the Americans crossing: a rule of time and of nothing else.
 */
export const GW_NEW_ARMIES: readonly {
  readonly tag: GwTag;
  readonly theatre: GwTheatre;
  readonly months: readonly number[];
}[] = [
  { tag: "GBR", theatre: "west", months: [8, 15, 22] },
  { tag: "USA", theatre: "west", months: [6, 9, 12, 15] },
  { tag: "DEU", theatre: "east", months: [8] },
  { tag: "RUS", theatre: "east", months: [10] },
  { tag: "ITA", theatre: "italy", months: [12] },
  { tag: "GBR", theatre: "palestine", months: [20] },
  { tag: "GBR", theatre: "mesopotamia", months: [24] },
];

/**
 * Who comes to a theatre only once another has gone from it: the armies landed
 * at Salonika stand behind Serbia, not beside it.
 */
export const GW_BEHIND: Readonly<
  Partial<Record<GwTheatre, { tags: readonly GwTag[]; once: GwTag }>>
> = {
  balkan: { tags: ["FRA", "GBR"], once: "SRB" },
};

/** A front that went quiet sends its divisions elsewhere. */
export const GW_TRANSFERS: readonly {
  /** The country whose leaving frees them. */
  readonly out: GwTag;
  readonly tag: GwTag;
  readonly to: GwTheatre;
  readonly bands: number;
}[] = [
  { out: "RUS", tag: "DEU", to: "west", bands: 2 },
  { out: "RUS", tag: "AUH", to: "italy", bands: 1 },
  { out: "RUS", tag: "OTT", to: "palestine", bands: 1 },
  { out: "SRB", tag: "AUH", to: "east", bands: 1 },
  { out: "ITA", tag: "AUH", to: "east", bands: 1 },
  { out: "FRA", tag: "DEU", to: "east", bands: 2 },
];

export interface GwBeaten {
  readonly tag: GwTag;
  readonly theatre: GwTheatre;
  /** Falls at or past this line of the theatre. */
  readonly from?: string;
  /** Falls at or behind this line. */
  readonly to?: string;
  /** Chapters it stands before the line can decide it. */
  readonly after: number;
  /** Counts only once this country has gone: the front has turned round. */
  readonly behind?: GwTag;
}

/** A country loses the war when its ground goes. */
export const GW_BEATEN: readonly GwBeaten[] = [
  { tag: "FRA", theatre: "west", from: "paris", after: 2 },
  { tag: "RUS", theatre: "east", from: "kiev", after: 24 },
  { tag: "SRB", theatre: "balkan", from: "nis", after: 13 },
  { tag: "MNE", theatre: "balkan", from: "nis", after: 13 },
  { tag: "ROU", theatre: "east", from: "warsaw", after: 3 },
  { tag: "GRC", theatre: "balkan", from: "salonika", after: 3 },
  { tag: "ITA", theatre: "italy", from: "adige", after: 12 },
  { tag: "OTT", theatre: "straits", from: "constantinople", after: 12 },
  { tag: "OTT", theatre: "palestine", from: "damascus", after: 24 },
  { tag: "BGR", theatre: "balkan", to: "belgrade", after: 6, behind: "SRB" },
  { tag: "DEU", theatre: "west", to: "rhine", after: 30 },
];

export const GW_MANPOWER: Readonly<Partial<Record<GwTag, number>>> = {
  DEU: 80,
  AUH: 60,
  RUS: 100,
  FRA: 65,
  GBR: 70,
  ITA: 50,
  OTT: 45,
  USA: 100,
  JPN: 40,
  SRB: 30,
  MNE: 10,
  BEL: 15,
  ROU: 25,
  BGR: 25,
  GRC: 20,
};

/** Gauges of June 1914 that differ from the plain start. */
export const GW_GAUGES_1914: Readonly<
  Partial<Record<GwTag, Partial<Record<GwGauge, number>>>>
> = {
  DEU: { shells: 3, morale: 4 },
  AUH: { shells: 1, order: 3 },
  RUS: { shells: 1, bread: 3, order: 3, money: 2 },
  FRA: { shells: 2, morale: 4 },
  GBR: { money: 3, bread: 2, order: 4 },
  OTT: { shells: 2, money: 1, order: 3 },
  USA: { money: 3, bread: 3, order: 4 },
  SRB: { money: 0, shells: 1, morale: 4 },
};

/** What an army makes of its numbers, percent, in attack and defence. */
export const GW_ARMY_QUALITY: Readonly<Partial<Record<GwTag, number>>> = {
  DEU: 112,
  GBR: 105,
  SRB: 100,
  FRA: 100,
  USA: 95,
  BEL: 90,
  BGR: 95,
  RUS: 85,
  AUH: 85,
  OTT: 85,
  ITA: 85,
  ROU: 80,
  GRC: 85,
};

export interface GwEntry {
  readonly tag: GwTag;
  /** The earliest date it can come in, YYYY-MM-DD. */
  readonly earliest: string;
  /** Who it joins with no price and no lean: null, the likelier winner. */
  readonly natural: GwSide | null;
  /** Readiness at the start. */
  readonly start: number;
  /** The most each side can honestly offer it (design §10). */
  readonly offers: Readonly<Record<GwSide, number>>;
  /** Where it watches the war: a side going forward here draws it. */
  readonly watches: GwTheatre;
  /** The scene a seat is asked its price on. */
  readonly scene: string;
}

/** Neutrals that can come in (design §10), in the order they are asked. */
export const GW_ENTRIES: readonly GwEntry[] = [
  {
    tag: "JPN",
    earliest: "1914-08-20",
    natural: "entente",
    start: 45,
    offers: { central: 1, entente: 3 },
    watches: "colonies",
    scene: "gw_price_jpn",
  },
  {
    tag: "OTT",
    earliest: "1914-10-15",
    natural: "central",
    start: 40,
    offers: { central: 4, entente: 2 },
    watches: "east",
    scene: "gw_price_ott",
  },
  {
    tag: "ITA",
    earliest: "1915-03-01",
    natural: null,
    start: 20,
    offers: { central: 2, entente: 4 },
    watches: "east",
    scene: "gw_price_ita",
  },
  {
    tag: "BGR",
    earliest: "1915-08-01",
    natural: "central",
    start: 20,
    offers: { central: 4, entente: 2 },
    watches: "balkan",
    scene: "gw_price_bgr",
  },
  {
    tag: "ROU",
    earliest: "1916-05-01",
    natural: "entente",
    start: 10,
    offers: { central: 2, entente: 4 },
    watches: "east",
    scene: "gw_price_rou",
  },
  {
    tag: "GRC",
    earliest: "1917-04-01",
    natural: "entente",
    start: 5,
    offers: { central: 1, entente: 3 },
    watches: "balkan",
    scene: "gw_price_grc",
  },
];

/** Readiness a neutral needs, by character (design §10). */
export const GW_ENTRY_BAR = {
  cautious: 80,
  hardline: 50,
  opportunist: 60,
  principled: 70,
} as const;

/**
 * The scene a country signs mobilisation on, and the option that puts it off.
 * Twice put off, the world decides (Crises.ts): scene plan §1.
 */
export const GW_MOBILISE: Readonly<
  Partial<
    Record<
      GwTag,
      {
        scene: string;
        wait: string;
        /** Who moves first if the seat won't, and the news of it. */
        first: readonly GwTag[];
        news: string;
      }
    >
  >
> = {
  DEU: {
    scene: "deu_c_mobilise",
    wait: "wait_day",
    first: ["RUS", "FRA"],
    news: "mob_first",
  },
  RUS: {
    scene: "rus_c_general_mob",
    wait: "wait_day",
    first: ["DEU", "AUH"],
    news: "mob_first_central",
  },
  // France signs on 1 August 1914; put off twice, Germany moves first.
  FRA: {
    scene: "fra_c_mobilise",
    wait: "wait_day",
    first: ["DEU", "AUH"],
    news: "mob_first_central",
  },
};

/** How a seat's own ultimatum heats the crisis (auh_c_note_draft). */
export const GW_NOTE_FLAGS: Readonly<Partial<Record<string, number>>> = {
  f_auh_note_soft: -1,
  f_auh_note_hard: 0,
  f_auh_note_brutal: 2,
};

/** People the opening has already killed. */
export const GW_OPENING_DEAD: readonly {
  readonly person: string;
  readonly openings: readonly GwOpening[];
}[] = [{ person: "auh_ff", openings: ["sarajevo", "sarajevo_delayed"] }];

/** Those whose day comes whatever the seat does: the record, no more. */
export const GW_PASSING: readonly {
  readonly person: string;
  readonly on: string;
}[] = [
  { person: "rus_witte", on: "1915-03-13" },
  { person: "rus_durnovo", on: "1915-09-24" },
];

/** Those a card reports dead: once it has come, they are gone from the cast. */
export const GW_PASSING_BY_SCENE: readonly {
  readonly person: string;
  readonly scene: string;
}[] = [
  { person: "auh_sturgkh", scene: "auh_h_sturgkh_shot" },
  { person: "gbr_kitchener", scene: "gbr_w_kitchener_lost" },
];

/** Court people who don't take an army, whatever their rank. */
export const GW_NO_COMMAND: readonly string[] = [
  "auh_karl",
  "auh_ff",
  "auh_friedrich",
];

/**
 * People the war tab doesn't name at a front until the story has sent them
 * there (any of these seat flags): a retired general isn't in the field while
 * the desk still asks whether to call him.
 */
export const GW_COMMAND_NAMED_AFTER: Readonly<
  Record<string, readonly string[]>
> = {
  deu_hindenburg: ["f_prittwitz_out", "f_third_ohl"],
  deu_ludendorff: ["f_third_ohl"],
};

/** Countries whose long cast shows only those the seat has come across. */
export const GW_HIDE_UNMET: readonly GwTag[] = ["RUS"];

/** The head of state as a person: off the cast tab for that seat. */
export const GW_SEAT_PERSON: Readonly<
  Partial<Record<GwTag, readonly { person: string; flag?: string }[]>>
> = {
  GBR: [
    { person: "gbr_lloyd_george", flag: "f_pm_lg" },
    { person: "gbr_asquith" },
  ],
  RUS: [{ person: "rus_nicholas" }],
  DEU: [{ person: "deu_wilhelm" }],
  AUH: [{ person: "auh_franz_joseph" }],
  FRA: [{ person: "fra_poincare" }],
};

/**
 * Seat flags that take summons from each chapter they are up: at sea in July
 * 1914 the President has none (France, chapters 3-4); under Clemenceau's
 * government he has one fewer.
 */
export const GW_SUMMONS_LESS: Readonly<Record<string, number>> = {
  f_at_sea: 99,
  f_pm_clemenceau: 1,
};

/** A scene's flag is the war plan signed: scenes set flags, the world reads. */
export const GW_PLAN_FLAGS: Readonly<Partial<Record<string, GwPlan>>> = {
  f_west_plan: "west",
  f_east_first: "east",
};

/**
 * What the war's decisions do to the fronts. A scene sets its flag for the
 * text; this reads the choice, which has a chapter. `odds`, percent, goes on
 * the seat's side's attacks in `theatre` and off the enemy's, for `lasts`
 * chapters from the one it was signed in. `steps` moves the line at once, by
 * progress steps, on the side of the seat. `losses`: percent of the usual dead.
 */
export interface GwWarOrder {
  scene: string;
  pick: string;
  theatre: GwTheatre;
  odds: number;
  lasts: number;
  steps?: number;
  losses?: number;
}

const order = (
  scene: string,
  pick: string,
  theatre: GwTheatre,
  odds: number,
  lasts: number,
  rest: { steps?: number; losses?: number } = {},
): GwWarOrder => ({ scene, pick, theatre, odds, lasts, ...rest });

export const GW_WAR_ORDERS: readonly GwWarOrder[] = [
  order("deu_w_east_relief", "send_two", "west", -12, 2),
  order("deu_w_east_relief", "send_two", "east", 11, 2),
  order("deu_w_east_relief", "send_one", "west", -5, 2),
  order("deu_w_east_relief", "send_one", "east", 5, 2),
  order("deu_w_east_relief", "send_none", "west", 4, 2),
  order("deu_w_east_relief", "send_none", "east", -8, 2),
  order("deu_w_prittwitz", "recall_pair", "east", 6, 2),
  order("deu_w_prittwitz", "recall_old_general", "east", 2, 2),
  order("deu_w_prittwitz", "keep", "east", -5, 1),
  order("deu_w_east_broken", "strip_west", "west", -6, 1),
  order("deu_w_east_broken", "strip_west", "east", 7, 1),
  order("deu_w_marne_order", "approve", "west", -4, 1, { steps: -2 }),
  order("deu_w_marne_order", "go_to_front", "west", -1, 1, { steps: -2 }),
  order("deu_w_marne_order", "limit_retreat", "west", -1, 1, { steps: -1 }),
  order("deu_w_marne_order", "hold_line", "west", 6, 1, { losses: 140 }),
  order("deu_w_ypres_boys", "attack", "west", 7, 1, { losses: 150 }),
  order("deu_w_ypres_boys", "wait_guns", "west", 2, 1),
  order("deu_w_ypres_boys", "pull_back", "west", -9, 1, { losses: 60 }),
  order("deu_w_east_west", "west_again", "west", 6, 1),
  order("deu_w_east_west", "east_corps", "east", 9, 2),
  order("deu_w_east_west", "split", "west", 2, 1),
  order("deu_w_east_west", "split", "east", 4, 1),
  order("deu_w_conrad_help", "send_corps", "east", 4, 2),
  order("deu_w_shell_crisis", "cut_west", "west", -4, 2),
  order("deu_w_fleet_out", "sortie", "sea", 7, 1, { losses: 150 }),
  order("deu_w_fleet_out", "raid_coast", "sea", 4, 1),
  // Russia. One planned blow on a wide front is what the east was broken by.
  order("rus_w_april_council", "brusilov_goes", "east", 45, 4),
  order("rus_w_april_council", "both_fronts", "east", 20, 3),
  order("rus_w_april_council", "west_front", "east", 12, 2),
  order("rus_w_evert_holds", "reserves_south", "east", 15, 2),
  order("rus_w_evert_holds", "wait_evert", "east", -10, 2),
  order("rus_w_kovel", "press_guard", "east", 12, 2, { losses: 140 }),
  order("rus_w_naroch", "attack_now", "east", 8, 1, { losses: 140 }),
  order("rus_w_carpathians", "over_the_pass", "east", 12, 2),
  order("rus_w_spring_promise", "keep_promise", "east", 12, 2),
  order("rus_w_gorlice", "trade_space", "east", -4, 2, { steps: -2 }),
  order("rus_w_gorlice", "hold_ground", "east", 5, 2, { losses: 140 }),
  order("rus_w_warsaw", "leave_all", "east", -4, 2, {
    steps: -2,
    losses: 70,
  }),
  order("rus_w_caucasus_snow", "go_in_snow", "caucasus", 15, 2, {
    losses: 150,
  }),
  // Austria-Hungary.
  order("auh_w_galicia_plan", "attack", "east", 8, 2, { losses: 130 }),
  order("auh_w_lemberg", "fall_back_san", "east", -4, 2, {
    steps: -2,
    losses: 70,
  }),
  order("auh_w_lemberg", "call_germans", "east", 8, 2),
  order("auh_w_carpathian", "push_on", "east", 6, 2, { losses: 150 }),
  order("auh_w_carpathian", "ask_germans", "east", 8, 2),
  order("auh_w_italy_war", "boroevic_to_isonzo", "italy", 10, 3),
  order("auh_w_tyrol_strike", "strike", "italy", 12, 2, { losses: 130 }),
  order("auh_w_tyrol_strike", "strike", "east", -8, 2),
  order("auh_w_brusilov", "call_germans", "east", 12, 2),
  order("auh_w_brusilov", "strip_italy", "east", 10, 2),
  order("auh_w_brusilov", "strip_italy", "italy", -10, 2),
  order("auh_w_brusilov", "fall_back_far", "east", -4, 2, { steps: -3 }),
  order("auh_w_caporetto", "ask_germans", "italy", 25, 2),
  order("auh_w_piave", "both_prongs", "italy", 8, 1, { losses: 150 }),
  // Britain.
  order("gbr_w_council", "west", "west", 6, 3),
  order("gbr_w_council", "straits", "straits", 12, 3),
  order("gbr_w_new_armies", "to_france", "west", 8, 3),
  order("gbr_w_new_armies", "to_straits", "straits", 12, 3),
  order("gbr_w_landing", "more_men", "straits", 12, 2, { losses: 130 }),
  order("gbr_w_somme_first", "agreed_date", "west", 6, 2, { losses: 150 }),
  order("gbr_w_somme_first", "new_weapon", "west", 8, 2),
  order("gbr_w_flanders", "approve", "west", 6, 2, { losses: 150 }),
  order("gbr_w_flanders", "small_bites", "west", 2, 2, { losses: 80 }),
  order("gbr_w_march", "send_all", "west", 12, 2),
  order("gbr_w_doullens", "foch", "west", 10, 3),
  // France (ww166). The President signs; the generals' plans move the line.
  // Big scenes' decisions are replies, not options, so Verdun and the
  // mutinies have no rows here.
  order("fra_w_plan_1915", "west", "west", 6, 3),
  order("fra_w_plan_1915", "wait_shells", "west", 2, 2),
  order("fra_w_plan_1915", "orient", "balkan", 12, 3),
  order("fra_w_dardanelles", "squadron", "straits", 4, 2),
  order("fra_w_dardanelles", "add_division", "straits", 10, 2),
  order("fra_w_champagne", "approve", "west", 6, 2, { losses: 150 }),
  order("fra_w_champagne", "smaller", "west", 3, 2, { losses: 80 }),
  order("fra_w_salonika", "send_sarrail", "balkan", 12, 3),
  order("fra_w_salonika", "small_force", "balkan", 5, 2),
  order("fra_w_noria", "rotate", "west", 4, 3),
  order("fra_w_somme", "joint_attack", "west", 6, 2, { losses: 140 }),
  order("fra_w_somme", "less_french", "west", 3, 2),
  order("fra_w_calais", "sign", "west", 4, 2),
  order("fra_w_calais", "one_battle", "west", 3, 1),
  order("fra_w_nivelle_doubts", "let_him_go", "west", 4, 1, { losses: 170 }),
  order("fra_w_nivelle_doubts", "limit", "west", 2, 1, { losses: 90 }),
  order("fra_w_americans", "ask_amalgam", "west", 4, 3),
  order("fra_w_caporetto", "send", "italy", 10, 2),
  order("fra_w_caporetto", "send", "west", -3, 2),
  order("fra_w_caporetto", "guns_only", "italy", 4, 2),
  order("fra_w_doullens", "foch", "west", 10, 3),
  order("fra_w_doullens", "joint_board", "west", 4, 2),
  order("fra_w_second_marne", "stay_paris", "west", 4, 1),
  order("fra_w_second_marne", "prepare_move", "west", -2, 1),
  order("fra_w_second_marne", "counterattack", "west", 12, 2, { losses: 130 }),
];
