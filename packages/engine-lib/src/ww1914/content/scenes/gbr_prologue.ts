// Great War 1914 (ww154): Asquith's earlier life. Format:
// /home/eser/dev/ww154-format.md. Text: resources/ww1914/ko/GBR.prologue.json.
// Seven scenes, the boy in the counting house to the Friday before Sarajevo.
// The thread: he counts, and he acts first and says it afterwards, on paper.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  byName,
  chose,
  decide,
  flag,
  GwCond,
  GwEcho,
  GwNode,
  GwReply,
  GwScene,
  GwVariant,
  not,
  past,
  rivalLean,
  setFlag,
  startRuler,
  temper,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";

const NATION: GwTag[] = ["GBR"];
const b: GwVariant[] = [{ id: "base" }];

const lone = (replies: GwReply[]): GwNode => ({
  alone: true,
  says: b,
  replies,
});
const by = (
  who: string,
  replies: GwReply[],
  says: GwVariant[] = b,
): GwNode => ({ who, says, replies });

function memory(
  id: string,
  prologue: number,
  cast: GwScene["cast"],
  who: string,
  nodes: Record<string, GwNode>,
  after = true,
): GwScene {
  return {
    id,
    nation: NATION,
    kind: "talk",
    big: true,
    scheduledOnly: true,
    once: true,
    salience: 9,
    prologue,
    tags: [],
    cast,
    who,
    start: Object.keys(nodes)[0],
    variants: b,
    ...(after ? { after: [{ scene: `${id}_after` }] } : {}),
    nodes,
  };
}

const card = (id: string, variants: GwVariant[] = b): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: [],
  variants,
});

const LG = byName("gbr_lloyd_george");
const CHURCHILL = byName("gbr_churchill");
const LAW = byName("gbr_bonar_law");
const KITCHENER = byName("gbr_kitchener");
const HALDANE = byName("gbr_haldane");
const REDMOND = byName("gbr_redmond");
const KING = byName("gbr_george_v");
const HENDERSON = byName("gbr_henderson");
const MORLEY = byName("gbr_morley");
const BALFOUR = byName("gbr_balfour");
const HANKEY = byName("gbr_hankey");
const GREY = byName("gbr_grey");

export const GBR_PROLOGUE_SCENES: readonly GwScene[] = [
  memory(
    "gbr_pro_ledger",
    1,
    {
      grandfather: past("gbr_p_willans"),
      mother: past("gbr_p_emily"),
      master: past("gbr_p_jowett"),
    },
    "grandfather",
    {
      n1: lone([decide("add_up", "n2")]),
      n2: by("grandfather", [decide("nod", "n2b")]),
      n2b: by("mother", [decide("promise", "n3")]),
      n3: lone([
        decide("stay_watch", "n3b", [setFlag("pro_gbr_newgate_stayed")]),
        decide("walk_on", "n3b", [setFlag("pro_gbr_newgate_passed")]),
      ]),
      n3b: lone([decide("go_on", "n4")]),
      n4: by("master", [
        decide("count", null, [
          setFlag("pro_gbr_boy_count"),
          temper("cold"),
          startRuler("reputation", 1),
        ]),
        decide("letters", null, [
          setFlag("pro_gbr_boy_letters"),
          temper("gentle"),
          startRuler("family", 1),
        ]),
        decide("nothing", null, [
          setFlag("pro_gbr_boy_owes_none"),
          temper("arrogant"),
          startRuler("conscience", -1),
        ]),
      ]),
    },
  ),
  card("gbr_pro_ledger_after"),
  memory(
    "gbr_pro_lamlash",
    2,
    {
      haldane: past("gbr_haldane"),
      senior: past("gbr_p_russell"),
      redmond: past("gbr_redmond"),
      helen: past("gbr_p_helen"),
      raymond: past("gbr_p_raymond"),
    },
    "haldane",
    {
      a1: lone([decide("up_stairs", "a2")]),
      a2: by("haldane", [decide("say_yes", "n1")]),
      n1: by("senior", [decide("stand_up", "n2")]),
      n2: lone([decide("sit_down", "n3")]),
      n3: by("redmond", [
        decide("cause", "n4", [
          setFlag("pro_gbr_irish_cause"),
          trustOf(REDMOND, 1),
        ]),
        decide("brief", "n4", [
          setFlag("pro_gbr_irish_brief"),
          trustOf(REDMOND, -1),
          temper("cold"),
        ]),
      ]),
      n4: by("helen", [decide("tell_helen", "n5")]),
      n5: lone([decide("go_north", "n6")]),
      n6: lone([decide("to_room", "n6b")]),
      n6b: by("helen", [
        decide("hold_hand", "n7", [temper("gentle")]),
        decide("say_it", "n7", [
          setFlag("pro_gbr_helen_said"),
          startRuler("conscience", 1),
        ]),
      ]),
      n7: by("raymond", [
        decide("tell_them", null, [
          setFlag("pro_gbr_helen_told"),
          temper("gentle"),
          startRuler("family", 1),
        ]),
        decide("let_him", null, [
          setFlag("pro_gbr_helen_shut"),
          temper("cold"),
          startRuler("family", -1),
        ]),
        decide("write_her", null, [
          setFlag("pro_gbr_helen_wrote"),
          temper("anxious"),
          startRuler("conscience", -1),
        ]),
      ]),
    },
  ),
  card("gbr_pro_lamlash_after", [
    { id: "told", when: flag("pro_gbr_helen_told") },
    { id: "shut", when: flag("pro_gbr_helen_shut") },
    { id: "wrote", when: flag("pro_gbr_helen_wrote") },
    { id: "base" },
  ]),
  memory(
    "gbr_pro_ackton",
    3,
    {
      pickard: past("gbr_p_pickard"),
      haldane: past("gbr_haldane"),
      margot: past("gbr_margot"),
    },
    "haldane",
    {
      n1: lone([decide("read_twice", "n1b")]),
      n1b: by("pickard", [decide("answer_him", "n2")]),
      n2: by("haldane", [decide("thank_haldane", "n3")]),
      n3: lone([
        decide("law", "n3b", [
          setFlag("pro_gbr_feather_law"),
          trustOf(HENDERSON, -1),
          temper("stubborn"),
        ]),
        decide("names", "n3b", [
          setFlag("pro_gbr_feather_names"),
          trustOf(HENDERSON, 1),
          startRuler("conscience", 1),
        ]),
        decide("no_troops", "n3b", [
          setFlag("pro_gbr_feather_no_troops"),
          temper("anxious"),
        ]),
      ]),
      n3b: lone([decide("read_yes", "n4")]),
      n4: by(
        "margot",
        [
          decide("henry", null, [
            setFlag("pro_gbr_henry"),
            trustOf(BALFOUR, 1),
            startRuler("reputation", 1),
          ]),
          decide("children", null, [
            setFlag("pro_gbr_children_first"),
            startRuler("family", 1),
          ]),
        ],
        [{ id: "pro_wrote", when: flag("pro_gbr_helen_wrote") }, ...b],
      ),
    },
  ),
  card("gbr_pro_ackton_after"),
  memory(
    "gbr_pro_biarritz",
    4,
    {
      grey: past("gbr_grey"),
      haldane: past("gbr_haldane"),
      cb: past("gbr_p_cb"),
      king: past("gbr_p_edward"),
      lg: past("gbr_lloyd_george"),
    },
    "grey",
    {
      n1: by("grey", [decide("hand_on", "n2")]),
      n2: lone([
        decide("by_note", "n2b", [
          setFlag("pro_gbr_relugas_note"),
          temper("anxious"),
        ]),
        decide("by_deed", "n2b", [
          setFlag("pro_gbr_relugas_deed"),
          trustOf(HALDANE, 1),
          temper("cunning"),
        ]),
      ]),
      n2b: by("haldane", [decide("sit_down", "n2c")]),
      n2c: by("cb", [decide("hold_cb", "n3")]),
      n3: by("king", [decide("name_them", "n4")]),
      n4: by("lg", [
        decide("keep_near", "n5", [
          setFlag("pro_gbr_lg_near"),
          trustOf(LG, 1),
          rivalLean(LG, -1),
          temper("gentle"),
        ]),
        decide("count_him", "n5", [
          setFlag("pro_gbr_lg_counted"),
          trustOf(LG, -1),
          rivalLean(LG, 1),
          temper("cunning"),
        ]),
      ]),
      n5: lone([decide("seal_list", null)]),
    },
  ),
  card("gbr_pro_biarritz_after"),
  memory(
    "gbr_pro_comet",
    5,
    {
      redmond: past("gbr_redmond"),
      lg: past("gbr_lloyd_george"),
      king: past("gbr_george_v"),
      bigge: past("gbr_stamfordham"),
    },
    "redmond",
    {
      b1: lone([decide("to_redmond", "n1")]),
      n1: by(
        "redmond",
        [
          decide("debt", "n2", [
            setFlag("pro_gbr_redmond_debt"),
            trustOf(REDMOND, 1),
          ]),
          decide("price", "n2", [
            setFlag("pro_gbr_redmond_price"),
            temper("cunning"),
          ]),
        ],
        [
          { id: "pro_cause", when: flag("pro_gbr_irish_cause") },
          { id: "pro_brief", when: flag("pro_gbr_irish_brief") },
          ...b,
        ],
      ),
      n2: lone([decide("same_answer", "n3")]),
      n3: lone([decide("stay_on_deck", "n3b")]),
      n3b: by("lg", [
        decide("let_it_lie", "n4"),
        decide("keep_paper", "n4", [
          setFlag("pro_gbr_coalition_kept"),
          rivalLean(LG, 1),
        ]),
      ]),
      n4: by("king", [
        decide("press", "n5", [
          setFlag("pro_gbr_king_pressed"),
          trustOf(KING, -1),
          temper("stubborn"),
        ]),
        decide("owe", "n5", [setFlag("pro_gbr_king_owed"), trustOf(KING, 1)]),
      ]),
      n5: by("bigge", [decide("bow_out", "n6")]),
      n6: lone([
        decide("count_faces", null, [
          setFlag("pro_gbr_howl_counted"),
          trustOf(LAW, -1),
          rivalLean(LAW, 1),
          temper("cold"),
        ]),
        decide("fold_it", null, [
          setFlag("pro_gbr_howl_folded"),
          startRuler("health", -1),
          temper("weary"),
        ]),
        decide("waited", null, [
          setFlag("pro_gbr_wait_won"),
          startRuler("reputation", 1),
          temper("cunning"),
        ]),
      ]),
    },
  ),
  card("gbr_pro_comet_after"),
  memory(
    "gbr_pro_map",
    6,
    {
      grey: past("gbr_grey"),
      wilson: past("gbr_wilson"),
      churchill: past("gbr_churchill"),
      haldane: past("gbr_haldane"),
      morley: past("gbr_morley"),
      law: past("gbr_bonar_law"),
    },
    "grey",
    {
      g1: by("grey", [
        decide("let_go_on", "n1", [trustOf(GREY, 1)]),
        decide("dangerous", "n1", [trustOf(GREY, -1), temper("anxious")]),
      ]),
      n1: by("wilson", [decide("ask_navy", "n2")]),
      n2: lone([decide("close_file", "n3")]),
      n3: by("churchill", [
        decide("glad", "n4", [
          setFlag("pro_gbr_ch_glad"),
          trustOf(CHURCHILL, 1),
          rivalLean(CHURCHILL, -1),
        ]),
        decide("wary", "n4", [
          setFlag("pro_gbr_ch_wary"),
          rivalLean(CHURCHILL, 1),
        ]),
      ]),
      n4: by(
        "haldane",
        [
          decide("face", "n5", [
            setFlag("pro_gbr_haldane_face"),
            trustOf(HALDANE, 1),
            startRuler("conscience", 1),
          ]),
          decide("note", "n5", [
            setFlag("pro_gbr_haldane_note"),
            trustOf(HALDANE, -1),
            temper("weary"),
          ]),
        ],
        [{ id: "pro_note", when: flag("pro_gbr_relugas_note") }, ...b],
      ),
      n5: by("morley", [
        decide("only_paper", "n6", [
          setFlag("pro_gbr_map_paper"),
          trustOf(MORLEY, 1),
        ]),
        decide("knew", "n6", [
          setFlag("pro_gbr_map_knew"),
          startRuler("conscience", -1),
          temper("cunning"),
        ]),
      ]),
      n6: by("law", [
        decide("take_it_well", "n7", [trustOf(LAW, 1)]),
        decide("look_ahead", "n7", [trustOf(LAW, -1), rivalLean(LAW, 1)]),
      ]),
      n7: by("haldane", [decide("thank_him", null)]),
    },
  ),
  card("gbr_pro_map_after"),
  memory(
    "gbr_pro_friday",
    7,
    {
      hankey: past("gbr_hankey"),
      grey: past("gbr_grey"),
      venetia: past("gbr_venetia"),
      margot: past("gbr_margot"),
    },
    "venetia",
    {
      n1: by("hankey", [
        decide("top_drawer", "n1b"),
        decide("you_keep_it", "n1b", [trustOf(HANKEY, 1)]),
      ]),
      n1b: lone([decide("to_car", "n1c")]),
      n1c: by("grey", [decide("go_river", "n2")]),
      n2: by("venetia", [
        decide("right", "n2b", [setFlag("pro_gbr_fri_free_hand")]),
        decide("fix", "n2b", [setFlag("pro_gbr_fri_france_counts")]),
      ]),
      n2b: by("venetia", [
        decide("needed", "n3", [temper("cold")]),
        decide("owed", "n3", [trustOf(LG, 1)]),
      ]),
      n3: by("venetia", [
        decide("fear_ulster", "n4", [
          setFlag("pro_gbr_fear_ulster"),
          temper("anxious"),
        ]),
        decide("fear_table", "n4", [
          setFlag("pro_gbr_fear_table"),
          temper("weary"),
        ]),
        decide("fear_europe", "n4", [
          setFlag("pro_gbr_fear_europe"),
          temper("stubborn"),
        ]),
      ]),
      n4: by("venetia", [
        decide("watch_lg", "n4b", [rivalLean(LG, 1)]),
        decide("watch_churchill", "n4b", [rivalLean(CHURCHILL, 1)]),
        decide("watch_law", "n4b", [rivalLean(LAW, 1)]),
        decide("watch_kitchener", "n4b", [rivalLean(KITCHENER, 1)]),
        decide("watch_nobody", "n4b", [temper("arrogant")]),
      ]),
      n4b: by("margot", [decide("good_night", "n5")]),
      n5: lone([decide("sunday", null)]),
    },
    false,
  ),
];

const chair: GwCond = not(flag("f_pm_lg"));
/** A prologue flag, while Asquith is the one in the chair. */
const his = (f: string): GwCond => all(flag(f), chair);
const lived = (scene: string): GwCond => all({ kind: "seen", scene }, chair);
const EAST_FIRST: GwCond = { kind: "world", of: { is: "plan", of: ["east"] } };

/** Where the main story remembers it: variants laid over its scenes. */
export const GBR_ECHOES: readonly GwEcho[] = [
  // The ledger.
  { scene: "gbr_c_roster", id: "pro_count", when: his("pro_gbr_boy_count") },
  {
    scene: "gbr_big_december",
    node: "n5",
    id: "pro_count",
    when: his("pro_gbr_boy_count"),
  },
  {
    scene: "gbr_life_letters_after",
    id: "pro_letters",
    when: his("pro_gbr_boy_letters"),
  },
  {
    scene: "gbr_big_dublin",
    node: "n2",
    id: "pro_stayed",
    when: his("pro_gbr_newgate_stayed"),
  },
  {
    scene: "gbr_big_dublin",
    node: "n2",
    id: "pro_passed",
    when: his("pro_gbr_newgate_passed"),
  },
  {
    scene: "gbr_life_letters_after",
    id: "pro_wrote",
    when: his("pro_gbr_helen_wrote"),
  },
  // The witness box and the island.
  {
    scene: "gbr_big_first_quiet",
    id: "pro_lamlash",
    when: all(chose("gbr_big_first", "ships"), lived("gbr_pro_lamlash")),
  },
  {
    scene: "gbr_big_may",
    node: "n1",
    id: "pro_times",
    when: lived("gbr_pro_lamlash"),
  },
  {
    scene: "gbr_big_dublin",
    node: "n3",
    id: "pro_cause",
    when: his("pro_gbr_irish_cause"),
  },
  {
    scene: "gbr_big_dublin",
    node: "n3",
    id: "pro_brief",
    when: his("pro_gbr_irish_brief"),
  },
  {
    scene: "gbr_p_hal_hampstead",
    node: "arran",
    id: "pro_shut",
    when: his("pro_gbr_helen_shut"),
  },
  {
    scene: "gbr_life_after_raymond",
    id: "pro_told",
    when: his("pro_gbr_helen_told"),
  },
  {
    scene: "gbr_life_after_raymond",
    id: "pro_shut",
    when: his("pro_gbr_helen_shut"),
  },
  // Ackton Hall and the wedding.
  { scene: "gbr_life_table", id: "pro_henry", when: his("pro_gbr_henry") },
  {
    scene: "gbr_life_sons",
    id: "pro_children",
    when: his("pro_gbr_children_first"),
  },
  {
    scene: "gbr_p_hen_featherstone",
    id: "pro_names",
    when: his("pro_gbr_feather_names"),
  },
  {
    scene: "gbr_p_hen_featherstone",
    id: "pro_law",
    when: his("pro_gbr_feather_law"),
  },
  {
    scene: "gbr_c_war_office_held",
    id: "pro_no_troops",
    when: his("pro_gbr_feather_no_troops"),
  },
  // The chairs.
  {
    scene: "gbr_p_hal_relugas",
    node: "open",
    id: "pro_note",
    when: his("pro_gbr_relugas_note"),
  },
  {
    scene: "gbr_p_hal_relugas",
    node: "open",
    id: "pro_deed",
    when: his("pro_gbr_relugas_deed"),
  },
  {
    scene: "gbr_big_first",
    node: "n2",
    id: "pro_near",
    when: his("pro_gbr_lg_near"),
  },
  {
    scene: "gbr_big_december",
    node: "n3",
    id: "pro_near",
    when: his("pro_gbr_lg_near"),
  },
  {
    scene: "gbr_big_december",
    node: "n3",
    id: "pro_counted",
    when: his("pro_gbr_lg_counted"),
  },
  {
    scene: "gbr_p_hal_everything",
    node: "open",
    id: "pro_note",
    when: his("pro_gbr_haldane_note"),
  },
  {
    scene: "gbr_p_hal_everything",
    node: "open",
    id: "pro_face",
    when: his("pro_gbr_haldane_face"),
  },
  // The Lords and the King.
  {
    scene: "gbr_big_may_quiet",
    id: "pro_paper",
    when: his("pro_gbr_coalition_kept"),
  },
  {
    scene: "gbr_c_amending",
    id: "pro_debt",
    when: his("pro_gbr_redmond_debt"),
  },
  {
    scene: "gbr_t_redmond_counties",
    node: "open",
    id: "pro_price",
    when: his("pro_gbr_redmond_price"),
  },
  {
    scene: "gbr_c_palace",
    id: "pro_pressed",
    when: his("pro_gbr_king_pressed"),
  },
  { scene: "gbr_c_palace", id: "pro_owed", when: his("pro_gbr_king_owed") },
  { scene: "gbr_life_shaken", id: "pro_wait", when: his("pro_gbr_wait_won") },
  // The map.
  { scene: "gbr_c_cambon", id: "pro_knew", when: his("pro_gbr_map_knew") },
  {
    scene: "gbr_c_cabinet_one",
    id: "pro_paper",
    when: his("pro_gbr_map_paper"),
  },
  {
    scene: "gbr_big_sunday",
    node: "n4",
    id: "pro_map",
    when: lived("gbr_pro_map"),
  },
  {
    scene: "gbr_c_bef",
    id: "pro_map",
    when: all(lived("gbr_pro_map"), not(EAST_FIRST)),
  },
  {
    scene: "gbr_c_antwerp",
    id: "pro_wary",
    when: all(his("pro_gbr_ch_wary"), not(flag("f_bef_antwerp"))),
  },
  // The Friday.
  {
    scene: "gbr_c_note_read",
    id: "pro_europe",
    when: all(his("pro_gbr_fear_europe"), not(flag("f_home_rule_lives"))),
  },
  {
    scene: "gbr_c_note_read",
    id: "pro_ulster",
    when: all(his("pro_gbr_fear_ulster"), not(flag("f_home_rule_lives"))),
  },
  {
    scene: "gbr_big_sunday",
    node: "n1",
    id: "pro_table",
    when: his("pro_gbr_fear_table"),
  },
  {
    scene: "gbr_big_aside",
    node: "n1",
    id: "pro_counts",
    when: his("pro_gbr_fri_france_counts"),
  },
  {
    scene: "gbr_big_aside",
    node: "n1",
    id: "pro_free",
    when: his("pro_gbr_fri_free_hand"),
  },
];
