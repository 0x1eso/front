// Great War 1914: each country's newspapers (ww142). A row holds the real papers
// with the blocs that read them, the stories they can run, and what goes round
// when news is cut. A later country adds a row and a `<TAG>.press.json`, no code.
// The chapter's story is the heaviest one called; each paper in `tones` has its
// own take in the pack, press.heads.<story>.<paper>, and its tone is what the
// readers come away with: -1 against the seat, 1 for it.
import { GwInstitution } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import { all, GwCond, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

export type GwStoryOn =
  /** An act of the seat's press policy (Press.ts). */
  | { event: string }
  /** A decision of this chapter; `prefix`: `chose` starts the scene's id. */
  | { chose: readonly string[]; picks?: readonly string[]; prefix?: boolean }
  /** News of this chapter, by key prefix: the seat's own, or a side's. */
  | { news: readonly string[]; own?: boolean; side?: "ours" | "theirs" }
  /** A decision of this chapter moved a body, a gauge or the temperature. */
  | { moved: string; sign: 1 | -1 }
  /** The state of things; no `when`: any chapter, the last resort. */
  | { when?: GwCond };

export interface GwStory {
  readonly id: string;
  readonly weight: number;
  readonly on: GwStoryOn;
  /** Paper id -> how its take reads. */
  readonly tones: Readonly<Record<string, number>>;
  /** Chapters before it can run again. */
  readonly rest?: number;
  /** The censor lets it through. */
  readonly free?: boolean;
}

export interface GwPaper {
  readonly id: string;
  /** Who reads it: its take moves their opinion. */
  readonly blocs: readonly GwBloc[];
  /** Whom it offends to see this paper's editor at the palace. */
  readonly foe?: GwBloc;
  readonly noInvite?: boolean;
}

export interface GwPressRow {
  readonly papers: readonly GwPaper[];
  /** The censor's level in June 1914, the most it can be at peace. */
  readonly start: number;
  readonly peaceCap: number;
  /** Where the war's own law puts it. */
  readonly warLevel: number;
  /** Authority a tighter censor costs. */
  readonly price: number;
  /** The body that must stand this high for a tighter censor. */
  readonly bar?: {
    readonly inst: GwInstitution;
    readonly min: number;
    readonly why: string;
  };
  /** Forms of government with no censor. */
  readonly free: readonly string[];
  /** Decisions no paper can hear of: they call no story. */
  readonly closed: readonly string[];
  readonly stories: readonly GwStory[];
  readonly rumours: readonly { readonly id: string; readonly when?: GwCond }[];
}

const story = (
  id: string,
  weight: number,
  on: GwStoryOn,
  tones: Readonly<Record<string, number>>,
  more: { rest?: number; free?: boolean } = {},
): GwStory => ({ id, weight, on, tones, ...more });

const event = (e: string): GwStoryOn => ({ event: e });
const decided = (scene: string | string[], ...picks: string[]): GwStoryOn => ({
  chose: typeof scene === "string" ? [scene] : scene,
  ...(picks.length === 0 ? {} : { picks }),
});
const news = (...keys: string[]): GwStoryOn => ({ news: keys });
const ownNews = (...keys: string[]): GwStoryOn => ({ news: keys, own: true });
const moved = (what: string, sign: 1 | -1): GwStoryOn => ({
  moved: what,
  sign,
});
const low = (gauge: "shells" | "bread" | "money", max: number): GwStoryOn => ({
  when: all(world({ is: "war" }), { kind: "gauge", gauge, max }),
});

const atWar = world({ is: "war" });
const atPeace = not(atWar);
const WON: GwStoryOn = {
  news: ["front_break", "front_advance"],
  side: "ours",
};
const LOST: GwStoryOn = {
  news: ["front_break", "front_advance"],
  side: "theirs",
};
// The war's own temperature doesn't count: this is the last week of peace.
const HOT: GwStoryOn = { when: all({ kind: "temp", min: 5 }, atPeace) };
const CAME_IN: GwStoryOn = { when: world({ is: "in_war", min: 0, max: 0 }) };
const COOLED = news(
  "crisis_compromise",
  "crisis_fizzled",
  "crisis_humiliation",
);
const HEAVY: GwStoryOn = {
  when: all(atWar, world({ is: "casualties", min: 400 })),
};
const LONG_WAR: GwStoryOn = {
  when: all(atWar, world({ is: "war_age", min: 12 })),
};
const PEACE: GwStoryOn = { when: atPeace };
const WAR: GwStoryOn = { when: atWar };

const DEU: GwPressRow = {
  papers: [
    { id: "vor", blocs: ["workers"], foe: "court" },
    { id: "kreuz", blocs: ["court"], foe: "parliament" },
    { id: "tag", blocs: ["parliament"], foe: "army" },
    { id: "ffm", blocs: ["business"], foe: "workers" },
    { id: "dtz", blocs: ["army"], foe: "parliament" },
  ],
  start: 0,
  peaceCap: 0,
  warLevel: 1,
  price: 8,
  bar: { inst: "reichstag", min: -3, why: "reichstag" },
  free: ["republic"],
  closed: [
    "deu_c_first_words",
    "deu_c_potsdam",
    "deu_c_blank_cheque",
    "deu_c_ultimatum_text",
    "deu_c_nicky",
    "deu_c_lichnowsky_offer",
    "deu_w_war_aims",
    "deu_w_separate_peace",
    "deu_s_separate_russia",
    "deu_s_lenin_train",
    "deu_k_last_sortie",
  ],
  stories: [
    story(
      "censor",
      10,
      event("censor"),
      { vor: -1, tag: -1, kreuz: 1 },
      { rest: 0 },
    ),
    story("lift", 10, event("lift"), { tag: 1, vor: 1, dtz: -1 }, { rest: 0 }),
    story(
      "leak",
      10,
      event("leak"),
      { tag: 0, vor: 0, kreuz: -1 },
      { rest: 0 },
    ),
    story(
      "war_censor",
      7,
      event("war_censor"),
      { vor: -1, kreuz: 1, tag: 0 },
      { free: true },
    ),
    story("law_voted", 9, ownNews("law_passed"), {
      tag: 1,
      vor: 0,
      kreuz: -1,
    }),
    story("law_decreed", 9, ownNews("law_decreed"), {
      vor: -1,
      tag: -1,
      kreuz: 1,
    }),
    story("law_gone", 9, ownNews("law_repealed"), {
      tag: 1,
      vor: 1,
      dtz: -1,
    }),
    story(
      "mobilise",
      9,
      decided("deu_c_mobilise", "west_plan", "east_first", "liege_first"),
      { kreuz: 1, tag: 0, vor: -1 },
    ),
    story("belgium", 9, decided("deu_c_belgium_note", "send"), {
      dtz: 1,
      tag: -1,
      vor: -1,
    }),
    story("war_speech", 9, decided("deu_c_war_speech"), {
      kreuz: 1,
      tag: 1,
      vor: 1,
    }),
    story("credits", 8, decided("gw_credits"), { vor: 0, ffm: 1, dtz: 1 }),
    story("liner", 8, decided("deu_s_liner"), { dtz: 1, tag: -1, ffm: -1 }),
    story(
      "uboat",
      9,
      decided(
        ["deu_s_pless", "gw_uboat_second"],
        "sign",
        "sign_with_zones",
        "unrestricted",
      ),
      { dtz: 1, tag: -1, vor: -1 },
    ),
    story(
      "aux_service",
      9,
      decided("deu_h_aux_service", "army_text", "unions_text"),
      { vor: 0, ffm: 1, kreuz: -1 },
    ),
    story(
      "third_ohl",
      9,
      decided("deu_f_third_ohl", "call_pair", "pair_with_terms"),
      { dtz: 1, kreuz: 1, tag: 0 },
    ),
    story(
      "easter",
      9,
      decided("deu_k_easter_message", "vague_word", "equal_vote_word"),
      { kreuz: -1, tag: 1, vor: 0 },
    ),
    story(
      "peace_text",
      9,
      decided("deu_k_peace_resolution", "accept_text", "interpret"),
      { tag: 1, vor: 1, dtz: -1 },
    ),
    story("jan_strike", 9, decided("deu_h_strike_january"), {
      vor: -1,
      ffm: 0,
      kreuz: 1,
    }),
    story("turnip", 8, decided("deu_h_turnip_winter"), {
      vor: -1,
      tag: 0,
      kreuz: 0,
    }),
    story("republic", 9, ownNews("regime_republic"), {
      vor: 1,
      kreuz: -1,
      tag: 1,
    }),
    story("sarajevo", 8, news("shot_fired"), { kreuz: 0, tag: 0, vor: 0 }),
    story("war_in", 9, CAME_IN, { kreuz: 1, tag: 1, vor: 0 }),
    story("armistice", 9, news("armistice_"), { vor: 0, kreuz: -1, tag: 0 }),
    story("cooled", 7, COOLED, { vor: 1, tag: 1, dtz: -1 }),
    story("america", 7, news("america_entered"), { dtz: 0, tag: -1, vor: -1 }),
    story("unrest_big", 8, ownNews("unrest_3", "unrest_4"), {
      vor: -1,
      kreuz: -1,
      tag: -1,
    }),
    story("strikes", 7, ownNews("unrest_1", "unrest_2"), {
      vor: -1,
      kreuz: -1,
      ffm: -1,
    }),
    story(
      "budget",
      6,
      { chose: ["gw_bm_deu_"], prefix: true },
      { ffm: 0, vor: -1, dtz: 1 },
    ),
    story("front_won", 6, WON, { dtz: 1, tag: 1, vor: 0 }),
    story("front_lost", 6, LOST, { dtz: -1, tag: 0, vor: -1 }),
    story("temp_up", 5, moved("temp", 1), { dtz: 1, tag: -1, vor: -1 }),
    story("temp_down", 5, moved("temp", -1), { dtz: -1, tag: 1, vor: 1 }),
    story("army_up", 5, moved("army", 1), { dtz: 1, tag: -1, vor: -1 }),
    story("army_down", 5, moved("army", -1), { dtz: -1, tag: 1, kreuz: -1 }),
    story("reich_up", 5, moved("reichstag", 1), { tag: 1, vor: 1, kreuz: -1 }),
    story("reich_down", 5, moved("reichstag", -1), {
      tag: -1,
      vor: -1,
      kreuz: 1,
    }),
    story("order_down", 4, moved("order", -1), { vor: -1, ffm: -1, kreuz: 0 }),
    story("money_down", 4, moved("money", -1), { ffm: -1, tag: 0, kreuz: 0 }),
    story("bread_low", 4, low("bread", 1), { vor: -1, tag: -1, kreuz: 0 }),
    story("shells_low", 3, low("shells", 0), { dtz: -1, ffm: 0, tag: -1 }),
    story("money_low", 3, low("money", 0), { ffm: -1, tag: 0, kreuz: 0 }),
    story("heavy", 3, HEAVY, { vor: -1, kreuz: 0, ffm: 0 }, { rest: 8 }),
    story("hot", 3, HOT, { dtz: 1, tag: 0, vor: -1 }, { rest: 2 }),
    story("long_war", 2, LONG_WAR, { vor: -1, tag: 0, dtz: 1 }, { rest: 6 }),
    story("war_quiet", 1, WAR, { kreuz: 0, tag: 0, ffm: 0 }, { rest: 2 }),
    story("peace_quiet", 1, PEACE, { kreuz: 0, tag: 0, vor: 0 }, { rest: 2 }),
    story("any_day", 0, {}, { ffm: 0, tag: 0, kreuz: 0 }, { rest: 0 }),
  ],
  rumours: [
    { id: "gold_cars", when: world({ is: "war_age", max: 6 }) },
    { id: "spies_wells", when: world({ is: "war_age", max: 8 }) },
    { id: "kaiser_ill" },
    { id: "hoarders", when: { kind: "gauge", gauge: "bread", max: 2 } },
    { id: "army_lies", when: world({ is: "war_age", min: 10 }) },
    { id: "peace_soon", when: world({ is: "war_age", min: 16 }) },
    { id: "fleet_trouble", when: world({ is: "war_age", min: 24 }) },
    { id: "rich_eat", when: { kind: "gauge", gauge: "bread", max: 1 } },
  ],
};

const GBR: GwPressRow = {
  papers: [
    { id: "herald", blocs: ["workers"], foe: "army" },
    { id: "post", blocs: ["court"], foe: "workers" },
    { id: "guardian", blocs: ["parliament"], foe: "army" },
    { id: "times", blocs: ["business"], foe: "parliament" },
    { id: "mail", blocs: ["army"], foe: "parliament" },
  ],
  start: 0,
  peaceCap: 0,
  warLevel: 1,
  price: 14,
  bar: { inst: "commons", min: -2, why: "commons" },
  free: [],
  closed: [
    "gbr_c_war_office_held",
    "gbr_c_cambon",
    "gbr_c_cabinet_one",
    "gbr_c_cabinet_two",
    "gbr_f_tsar",
    "gbr_f_zimmermann",
  ],
  stories: [
    story(
      "censor",
      10,
      event("censor"),
      { guardian: -1, mail: -1, post: 1 },
      { rest: 0 },
    ),
    story(
      "lift",
      10,
      event("lift"),
      { guardian: 1, times: 1, post: -1 },
      { rest: 0 },
    ),
    story(
      "leak",
      10,
      event("leak"),
      { times: 0, mail: 0, guardian: -1 },
      { rest: 0 },
    ),
    story(
      "war_censor",
      7,
      event("war_censor"),
      { times: 0, herald: -1, post: 1 },
      { free: true },
    ),
    story(
      "ultimatum",
      9,
      decided(["gbr_c_ultimatum", "gw_gbr_entry"], "send", "enter", "force_it"),
      { times: 1, post: 1, guardian: -1 },
    ),
    story("bef", 9, decided("gbr_c_bef", "four_divisions", "six_divisions"), {
      mail: 1,
      times: 1,
      herald: -1,
    }),
    story("kitchener", 8, decided("gbr_c_war_office", "kitchener"), {
      mail: 1,
      times: 1,
      guardian: 0,
    }),
    story("home_rule", 8, decided("gbr_c_home_rule_act"), {
      post: -1,
      guardian: 1,
      times: 0,
    }),
    story("shells", 9, decided("gbr_h_shells"), {
      mail: -1,
      times: -1,
      guardian: 0,
    }),
    story(
      "coalition",
      9,
      decided(
        ["gw_gbr_coalition", "gbr_h_coalition"],
        "coalition",
        "own_terms",
      ),
      { times: 1, guardian: -1, post: 0 },
    ),
    story(
      "conscription",
      9,
      decided(
        ["gw_gbr_conscription", "gbr_h_conscription"],
        "conscript",
        "all_men",
        "single_men",
      ),
      { mail: 1, herald: -1, guardian: -1 },
    ),
    story("landing", 8, decided("gbr_w_landing", "land"), {
      mail: 1,
      times: 0,
      guardian: 0,
    }),
    story("evacuate", 8, decided("gbr_w_evacuate", "evacuate"), {
      mail: -1,
      guardian: 0,
      times: 0,
    }),
    story("easter", 9, decided("gbr_h_easter"), {
      post: 1,
      guardian: -1,
      herald: -1,
    }),
    story(
      "somme",
      8,
      decided("gbr_w_somme_first", "agreed_date", "later_date"),
      { mail: 1, times: 1, herald: 0 },
    ),
    story(
      "convoy",
      8,
      decided("gbr_w_convoy", "trial_convoy", "walk_in_admiralty"),
      { times: 1, post: 0, mail: 1 },
    ),
    story(
      "blockade",
      7,
      decided(
        ["gbr_f_blockade", "gw_blockade_paper"],
        "full_order",
        "half_order",
        "tighten",
      ),
      { mail: 1, post: 1, guardian: -1 },
    ),
    story("regime_coalition", 9, ownNews("regime_coalition"), {
      times: 1,
      guardian: -1,
      post: 0,
    }),
    story("regime_war_cabinet", 9, ownNews("regime_war_cabinet"), {
      mail: 1,
      guardian: -1,
      times: 1,
    }),
    story("sarajevo", 8, news("shot_fired"), {
      times: 0,
      guardian: 0,
      post: 0,
    }),
    story("war_in", 9, CAME_IN, { times: 1, post: 1, guardian: -1 }),
    story("armistice", 9, news("armistice_"), { times: 0, mail: 0, herald: 0 }),
    story("cooled", 7, COOLED, { guardian: 1, times: 0, mail: -1 }),
    story("america", 7, news("america_entered"), {
      times: 1,
      mail: 1,
      guardian: 1,
    }),
    story("unrest_big", 8, ownNews("unrest_3", "unrest_4"), {
      herald: -1,
      post: -1,
      times: -1,
    }),
    story("strikes", 7, ownNews("unrest_1", "unrest_2"), {
      herald: -1,
      post: -1,
      times: 0,
    }),
    story(
      "budget",
      6,
      { chose: ["gw_bm_gbr_"], prefix: true },
      { times: 0, herald: -1, guardian: 1 },
    ),
    story("front_won", 6, WON, { mail: 1, times: 1, herald: 0 }),
    story("front_lost", 6, LOST, { mail: -1, times: 0, herald: -1 }),
    story("temp_up", 5, moved("temp", 1), {
      mail: 1,
      guardian: -1,
      herald: -1,
    }),
    story("temp_down", 5, moved("temp", -1), {
      mail: -1,
      guardian: 1,
      herald: 1,
    }),
    story("cabinet_up", 5, moved("cabinet", 1), {
      guardian: 1,
      times: 0,
      post: 0,
    }),
    story("cabinet_down", 5, moved("cabinet", -1), {
      guardian: -1,
      times: 0,
      mail: -1,
    }),
    story("opposition_up", 5, moved("opposition", 1), {
      post: 1,
      mail: 1,
      guardian: -1,
    }),
    story("opposition_down", 5, moved("opposition", -1), {
      post: -1,
      mail: -1,
      guardian: 1,
    }),
    story("irish_up", 5, moved("irish", 1), {
      guardian: 1,
      post: -1,
      times: 0,
    }),
    story("irish_down", 5, moved("irish", -1), {
      guardian: -1,
      post: 1,
      herald: -1,
    }),
    story("army_up", 4, moved("army", 1), {
      mail: 1,
      guardian: -1,
      herald: -1,
    }),
    story("army_down", 4, moved("army", -1), {
      mail: -1,
      post: -1,
      guardian: 1,
    }),
    story("order_down", 4, moved("order", -1), {
      herald: -1,
      times: -1,
      post: 0,
    }),
    story("money_down", 4, moved("money", -1), {
      times: -1,
      guardian: 0,
      post: 0,
    }),
    story("bread_low", 4, low("bread", 1), { herald: -1, times: -1, mail: 0 }),
    story("shells_low", 3, low("shells", 0), {
      mail: -1,
      times: -1,
      guardian: 0,
    }),
    story("money_low", 3, low("money", 0), { times: -1, guardian: 0, post: 0 }),
    story("heavy", 3, HEAVY, { herald: -1, times: 0, mail: 0 }, { rest: 8 }),
    story("hot", 3, HOT, { mail: 1, guardian: -1, times: 0 }, { rest: 2 }),
    story(
      "long_war",
      2,
      LONG_WAR,
      { herald: -1, guardian: 0, mail: 1 },
      { rest: 6 },
    ),
    story("war_quiet", 1, WAR, { times: 0, guardian: 0, post: 0 }, { rest: 2 }),
    story(
      "peace_quiet",
      1,
      PEACE,
      { times: 0, guardian: 0, post: 0 },
      { rest: 2 },
    ),
    story("any_day", 0, {}, { times: 0, guardian: 0, post: 0 }, { rest: 0 }),
  ],
  rumours: [
    { id: "russians_snow", when: world({ is: "war_age", max: 4 }) },
    { id: "spies_lamps", when: world({ is: "war_age", max: 8 }) },
    { id: "haldane", when: world({ is: "war_age", max: 12 }) },
    { id: "hidden_hand", when: world({ is: "war_age", min: 8 }) },
    { id: "margot", when: world({ is: "war_age", min: 6 }) },
    { id: "angels", when: world({ is: "war_age", min: 2 }) },
    { id: "shipping", when: world({ is: "shipping", min: 3 }) },
    { id: "profiteers" },
  ],
};

const AUH: GwPressRow = {
  papers: [
    { id: "az", blocs: ["workers"], foe: "court" },
    { id: "reichspost", blocs: ["court", "army"], foe: "parliament" },
    { id: "nfp", blocs: ["business"], foe: "workers" },
    { id: "lloyd", blocs: ["parliament"], foe: "army" },
    { id: "narodni", blocs: ["parliament"], foe: "court" },
  ],
  start: 1,
  peaceCap: 1,
  warLevel: 1,
  price: 6,
  free: ["austria_republic"],
  closed: [
    "auh_c_tisza_letter",
    "auh_c_no_annex",
    "auh_c_hoyos_mission",
    "auh_c_council_july",
    "auh_c_note_draft",
    "auh_w_tyrol_strike",
    "auh_k_sixtus",
    "gw_auh_feeler",
  ],
  stories: [
    story(
      "censor",
      10,
      event("censor"),
      { az: -1, narodni: -1, reichspost: 1 },
      { rest: 0 },
    ),
    story(
      "lift",
      10,
      event("lift"),
      { az: 1, nfp: 1, reichspost: -1 },
      { rest: 0 },
    ),
    story(
      "leak",
      10,
      event("leak"),
      { nfp: 0, lloyd: 0, reichspost: -1 },
      { rest: 0 },
    ),
    story(
      "war_censor",
      7,
      event("war_censor"),
      { nfp: 0, az: -1, reichspost: 1 },
      { free: true },
    ),
    story("serb_reply", 9, decided("auh_c_serb_reply", "break_off"), {
      reichspost: 1,
      nfp: 1,
      az: -1,
    }),
    story("war_serbia", 9, decided("auh_c_war_serbia", "sign"), {
      reichspost: 1,
      lloyd: 0,
      az: -1,
    }),
    story("przemysl", 8, decided("auh_w_przemysl"), {
      reichspost: 0,
      az: -1,
      nfp: 0,
    }),
    story("italy_war", 9, decided("auh_w_italy_war"), {
      reichspost: 1,
      nfp: 1,
      narodni: 0,
    }),
    story(
      "german_command",
      9,
      decided(
        ["auh_w_german_command", "auh_w_one_command"],
        "accept_terms",
        "sign",
        "sign_with_clause",
      ),
      { reichspost: -1, nfp: 0, lloyd: 0 },
    ),
    story("grain", 9, decided("auh_h_grain_border"), {
      lloyd: -1,
      az: -1,
      nfp: 0,
    }),
    story(
      "reichsrat",
      8,
      decided(
        ["auh_h_reichsrat_call", "auh_k_reichsrat_opens"],
        "open_it",
        "open_delegations",
        "throne_speech",
        "speech_on_nations",
      ),
      { az: 1, narodni: 1, reichspost: -1 },
    ),
    story("succession", 9, decided(["gw_succession_auh", "auh_k_succession"]), {
      reichspost: 1,
      nfp: 0,
      narodni: 0,
    }),
    story("jan_strike", 9, decided("auh_k_jan_strike"), {
      az: -1,
      reichspost: 1,
      nfp: 0,
    }),
    story("word_of_honour", 9, decided("auh_k_word_of_honour"), {
      reichspost: -1,
      nfp: -1,
      lloyd: -1,
    }),
    story(
      "manifesto",
      9,
      decided("auh_k_manifesto", "austria_only", "whole_realm"),
      { narodni: -1, lloyd: -1, reichspost: 1 },
    ),
    story("sarajevo", 8, news("shot_fired"), { reichspost: 0, nfp: 0, az: 0 }),
    story("war_in", 9, CAME_IN, { reichspost: 1, nfp: 1, az: -1 }),
    story("armistice", 9, news("armistice_"), {
      nfp: 0,
      az: 0,
      reichspost: -1,
    }),
    story("cooled", 7, COOLED, { nfp: 1, az: 1, reichspost: -1 }),
    story("america", 7, news("america_entered"), {
      nfp: -1,
      az: -1,
      reichspost: 0,
    }),
    story("unrest_big", 8, ownNews("unrest_3", "unrest_4"), {
      az: -1,
      reichspost: -1,
      narodni: -1,
    }),
    story("strikes", 7, ownNews("unrest_1", "unrest_2"), {
      az: -1,
      reichspost: -1,
      nfp: 0,
    }),
    story(
      "budget",
      6,
      { chose: ["gw_bm_auh_"], prefix: true },
      { nfp: 0, lloyd: -1, az: -1 },
    ),
    story(
      "law_day",
      7,
      { chose: ["gw_lv_auh_"], picks: ["put", "decree"], prefix: true },
      { nfp: 0, lloyd: 0, az: -1 },
    ),
    story("front_won", 6, WON, { reichspost: 1, nfp: 1, az: 0 }),
    story("front_lost", 6, LOST, { reichspost: -1, nfp: 0, narodni: 0 }),
    story("temp_up", 5, moved("temp", 1), { reichspost: 1, nfp: 0, az: -1 }),
    story("temp_down", 5, moved("temp", -1), { reichspost: -1, nfp: 1, az: 1 }),
    story("army_up", 5, moved("army", 1), { reichspost: 1, lloyd: -1, az: -1 }),
    story("army_down", 5, moved("army", -1), {
      reichspost: -1,
      nfp: 0,
      lloyd: 1,
    }),
    story("hungary_up", 5, moved("hungary", 1), {
      lloyd: 1,
      reichspost: -1,
      nfp: 0,
    }),
    story("hungary_down", 5, moved("hungary", -1), {
      lloyd: -1,
      reichspost: 1,
      nfp: 0,
    }),
    story("nations_up", 5, moved("nations", 1), {
      narodni: 1,
      nfp: -1,
      reichspost: -1,
    }),
    story("nations_down", 5, moved("nations", -1), {
      narodni: -1,
      nfp: 1,
      az: -1,
    }),
    story("berlin_up", 5, moved("berlin", 1), {
      reichspost: -1,
      nfp: 1,
      narodni: -1,
    }),
    story("order_down", 4, moved("order", -1), {
      az: -1,
      nfp: -1,
      reichspost: 0,
    }),
    story("money_down", 4, moved("money", -1), {
      nfp: -1,
      lloyd: 0,
      reichspost: 0,
    }),
    story("bread_low", 4, low("bread", 1), { az: -1, nfp: -1, lloyd: 0 }),
    story("shells_low", 3, low("shells", 0), {
      reichspost: -1,
      nfp: 0,
      lloyd: 0,
    }),
    story("money_low", 3, low("money", 0), {
      nfp: -1,
      lloyd: 0,
      reichspost: 0,
    }),
    story(
      "heavy",
      3,
      HEAVY,
      { az: -1, narodni: -1, reichspost: 0 },
      { rest: 8 },
    ),
    story("hot", 3, HOT, { reichspost: 1, nfp: 0, az: -1 }, { rest: 2 }),
    story(
      "long_war",
      2,
      LONG_WAR,
      { az: -1, nfp: 0, reichspost: 1 },
      { rest: 6 },
    ),
    story(
      "war_quiet",
      1,
      WAR,
      { nfp: 0, lloyd: 0, reichspost: 0 },
      { rest: 2 },
    ),
    story(
      "peace_quiet",
      1,
      PEACE,
      { nfp: 0, lloyd: 0, reichspost: 0 },
      { rest: 2 },
    ),
    story("any_day", 0, {}, { nfp: 0, lloyd: 0, reichspost: 0 }, { rest: 0 }),
  ],
  rumours: [
    {
      id: "emperor_dead",
      when: world({ is: "regime", of: ["dual_monarchy", "ff_throne"] }),
    },
    { id: "czech_regiments", when: world({ is: "war_age", min: 6 }) },
    { id: "hungary_hoards", when: { kind: "gauge", gauge: "bread", max: 2 } },
    { id: "german_hand", when: world({ is: "war_age", min: 10 }) },
    { id: "italian_wife", when: world({ is: "regime", of: ["karl"] }) },
    { id: "karl_drink", when: world({ is: "regime", of: ["karl"] }) },
    { id: "spies_serbs", when: world({ is: "war_age", max: 8 }) },
    { id: "peace_soon", when: world({ is: "war_age", min: 16 }) },
  ],
};

const RUS: GwPressRow = {
  papers: [
    { id: "pravda", blocs: ["workers"], foe: "court", noInvite: true },
    { id: "zem", blocs: ["court"], foe: "parliament" },
    { id: "rech", blocs: ["parliament"], foe: "court" },
    { id: "utro", blocs: ["business"], foe: "court" },
    { id: "nv", blocs: ["army"], foe: "parliament" },
  ],
  start: 1,
  peaceCap: 1,
  warLevel: 1,
  price: 6,
  free: ["rep", "provisional"],
  closed: [
    "rus_c_door",
    "rus_c_heir_fall",
    "rus_c_council",
    "rus_c_prep_period",
    "rus_c_willy",
    "rus_h_keys",
    "rus_h_friend_file",
    "rus_h_heir_bleed",
    "rus_r_family_letter",
  ],
  stories: [
    story(
      "censor",
      10,
      event("censor"),
      { rech: -1, utro: -1, zem: 1 },
      { rest: 0 },
    ),
    story(
      "lift",
      10,
      event("lift"),
      { rech: 1, utro: 1, zem: -1 },
      { rest: 0 },
    ),
    story("leak", 10, event("leak"), { nv: 0, rech: 0, zem: -1 }, { rest: 0 }),
    story(
      "war_censor",
      7,
      event("war_censor"),
      { nv: 1, rech: 0, pravda: -1 },
      { free: true },
    ),
    story(
      "general_mob",
      9,
      decided("rus_c_general_mob", "sign", "sign_and_wire"),
      { nv: 1, rech: 0, pravda: -1 },
    ),
    story("balcony", 9, decided("rus_c_balcony"), { nv: 1, zem: 1, rech: 1 }),
    story("vodka", 8, decided("rus_c_vodka"), { utro: 0, zem: 1, nv: 0 }),
    // The day of a bill: the page says which one, above the headlines.
    story(
      "law",
      8,
      { chose: ["gw_lv_"], prefix: true, picks: ["put"] },
      { rech: 0, zem: 0, utro: 0 },
    ),
    story(
      "law_87",
      9,
      { chose: ["gw_lv_"], prefix: true, picks: ["decree"] },
      { rech: -1, nv: 1, zem: 1 },
    ),
    story("shell_famine", 9, decided("rus_w_shell_famine"), {
      rech: -1,
      utro: 0,
      nv: -1,
    }),
    story("warsaw", 9, decided("rus_w_warsaw"), { nv: -1, rech: -1, zem: 0 }),
    story(
      "command",
      9,
      decided(
        ["rus_w_command", "gw_rus_command"],
        "self_command",
        "self_with_her_letter",
        "take_command",
      ),
      { zem: 1, nv: 0, rech: -1 },
    ),
    story("brusilov", 8, decided("rus_w_april_council", "brusilov_goes"), {
      nv: 1,
      rech: 1,
      utro: 0,
    }),
    story("prorogue", 9, decided("rus_h_bloc", "prorogue", "prorogue_soft"), {
      zem: 1,
      rech: -1,
      utro: -1,
    }),
    story("treason", 9, decided("rus_r_treason"), { rech: 0, zem: -1, nv: 0 }),
    story("friend_dead", 9, decided("rus_r_friend_dead"), {
      zem: -1,
      nv: 0,
      rech: 0,
    }),
    story("dual_power", 9, decided("rus_r_dual_power"), {
      rech: 0,
      pravda: -1,
      nv: -1,
    }),
    story("offensive", 9, decided("rus_r_offensive"), {
      nv: 1,
      rech: 1,
      pravda: -1,
    }),
    story(
      "regime_provisional",
      9,
      ownNews("regime_provisional", "regime_rep"),
      { rech: 1, pravda: 0, nv: -1 },
    ),
    story("regime_crown", 9, ownNews("regime_crown", "regime_regency"), {
      rech: 1,
      zem: -1,
      nv: 0,
    }),
    story("sarajevo", 8, news("shot_fired"), { nv: 0, rech: 0, zem: 0 }),
    story("war_in", 9, CAME_IN, { nv: 1, zem: 1, rech: 1 }),
    story("armistice", 9, news("armistice_"), { rech: 0, nv: -1, pravda: 0 }),
    story("cooled", 7, COOLED, { rech: 1, nv: -1, utro: 1 }),
    story("america", 7, news("america_entered"), { rech: 1, utro: 1, nv: 0 }),
    story("unrest_big", 8, ownNews("unrest_3", "unrest_4"), {
      pravda: -1,
      zem: -1,
      rech: -1,
    }),
    story("strikes", 7, ownNews("unrest_1", "unrest_2"), {
      pravda: -1,
      zem: -1,
      utro: -1,
    }),
    story(
      "budget",
      6,
      { chose: ["gw_bm_rus_"], prefix: true },
      { utro: 0, rech: -1, nv: 1 },
    ),
    story("front_won", 6, WON, { nv: 1, zem: 1, rech: 0 }),
    story("front_lost", 6, LOST, { nv: -1, rech: -1, zem: 0 }),
    story("temp_up", 5, moved("temp", 1), { nv: 1, rech: 0, pravda: -1 }),
    story("temp_down", 5, moved("temp", -1), { nv: -1, rech: 1, utro: 1 }),
    story("court_up", 5, moved("court", 1), { zem: 1, rech: -1, utro: -1 }),
    story("court_down", 5, moved("court", -1), { zem: -1, rech: 1, nv: 0 }),
    story("stavka_up", 5, moved("stavka", 1), { nv: 1, rech: 0, zem: 0 }),
    story("stavka_down", 5, moved("stavka", -1), { nv: -1, zem: 0, rech: 0 }),
    story("duma_up", 5, moved("duma", 1), { rech: 1, utro: 1, zem: -1 }),
    story("duma_down", 5, moved("duma", -1), { rech: -1, utro: -1, zem: 1 }),
    story("ministers_up", 5, moved("ministers", 1), {
      rech: 0,
      nv: 1,
      utro: 0,
    }),
    story("ministers_down", 5, moved("ministers", -1), {
      rech: -1,
      nv: 0,
      utro: -1,
    }),
    story("order_down", 4, moved("order", -1), {
      pravda: -1,
      utro: -1,
      zem: 0,
    }),
    story("money_down", 4, moved("money", -1), { utro: -1, rech: 0, nv: 0 }),
    story("bread_low", 4, low("bread", 1), { pravda: -1, rech: -1, utro: 0 }),
    story("shells_low", 3, low("shells", 0), { nv: -1, rech: -1, utro: 0 }),
    story("money_low", 3, low("money", 0), { utro: -1, rech: 0, nv: 0 }),
    story("heavy", 3, HEAVY, { pravda: -1, rech: 0, nv: 0 }, { rest: 8 }),
    story("hot", 3, HOT, { nv: 1, rech: 0, pravda: -1 }, { rest: 2 }),
    story("long_war", 2, LONG_WAR, { pravda: -1, rech: 0, nv: 1 }, { rest: 6 }),
    story("war_quiet", 1, WAR, { nv: 0, rech: 0, utro: 0 }, { rest: 2 }),
    story("peace_quiet", 1, PEACE, { nv: 0, rech: 0, zem: 0 }, { rest: 2 }),
    story("any_day", 0, {}, { nv: 0, rech: 0, utro: 0 }, { rest: 0 }),
  ],
  rumours: [
    { id: "empress_wire", when: world({ is: "war_age", min: 6 }) },
    { id: "dark_forces", when: world({ is: "war_age", min: 10 }) },
    { id: "friend_rules", when: world({ is: "war_age", min: 4 }) },
    { id: "german_generals", when: world({ is: "war_age", max: 20 }) },
    { id: "spies_stavka", when: world({ is: "war_age", min: 4 }) },
    { id: "separate_peace", when: world({ is: "war_age", min: 14 }) },
    { id: "flour_hidden", when: { kind: "gauge", gauge: "bread", max: 2 } },
    { id: "bread_cards", when: { kind: "gauge", gauge: "bread", max: 1 } },
  ],
};

/** A country with no row has no papers on its desk. */
export const GW_PRESS_ROWS: Readonly<Partial<Record<GwTag, GwPressRow>>> = {
  DEU,
  GBR,
  AUH,
  RUS,
};
