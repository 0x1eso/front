// Great War 1914 (ww154): Nicholas II's earlier life. Format:
// /home/eser/dev/ww154-format.md. Text: resources/ww1914/ko/RUS.prologue.json.
// History happens as it happened; a choice is how he took it. Seven scenes:
// the stairs of 1881, Livadia, Khodynka, 1905, Kiev, Spala, the last spring.
import {
  all,
  byName,
  chose,
  decide,
  flag,
  GwEcho,
  GwScene,
  not,
  past,
  rivalLean,
  rulerTemper,
  setFlag,
  startRuler,
  temper,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const silent = (id: string): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: [],
  variants: [{ id: "base" }],
});

const big: Pick<
  GwScene,
  | "nation"
  | "kind"
  | "big"
  | "scheduledOnly"
  | "once"
  | "salience"
  | "tags"
  | "start"
  | "variants"
> = {
  nation: ["RUS"],
  kind: "talk",
  big: true,
  scheduledOnly: true,
  once: true,
  salience: 9,
  tags: [],
  start: "n1",
  variants: [{ id: "base" }],
};

const says = [{ id: "base" }];

export const RUS_PROLOGUE_SCENES: readonly GwScene[] = [
  {
    ...big,
    id: "rus_pro_stairs",
    prologue: 1,
    cast: {
      father: past("rus_p_alexander3"),
      mother: past("rus_maria"),
      teacher: past("rus_p_pobedonostsev"),
    },
    who: "father",
    after: [{ scene: "rus_pro_stairs_after" }],
    nodes: {
      n1: {
        alone: true,
        says,
        replies: [decide("go_in", "n2")],
      },
      n2: {
        says,
        replies: [
          decide("look", "night"),
          decide("to_mother", "night", [trustOf(byName("rus_maria"), 1)]),
        ],
      },
      night: { who: "mother", says, replies: [decide("ask_why", "n3")] },
      n3: {
        who: "teacher",
        fallback: "held",
        says,
        replies: [
          decide("held", null, [
            setFlag("pro_rus_stairs_held"),
            temper("stubborn"),
            startRuler("reputation", 1),
          ]),
          decide("fear", null, [
            setFlag("pro_rus_stairs_fear"),
            temper("anxious"),
            startRuler("health", -1),
          ]),
          decide("paper", null, [
            setFlag("pro_rus_stairs_paper"),
            temper("gentle"),
            startRuler("conscience", 1),
          ]),
        ],
      },
    },
  },
  silent("rus_pro_stairs_after"),
  {
    ...big,
    id: "rus_pro_livadia",
    prologue: 2,
    cast: {
      alix: past("rus_alexandra"),
      mother: past("rus_maria"),
      sandro: past("rus_sandro"),
      teacher: past("rus_p_pobedonostsev"),
    },
    who: "alix",
    after: [{ scene: "rus_pro_livadia_after" }],
    nodes: {
      n1: { alone: true, says, replies: [decide("read_it", "n2")] },
      n2: { says, replies: [decide("to_father", "n3")] },
      n3: { who: "mother", says, replies: [decide("kneel", "n4")] },
      n4: { who: "sandro", says, replies: [decide("not_ready", "wedding")] },
      wedding: { who: "mother", says, replies: [decide("between", "n5")] },
      n5: { who: "teacher", says, replies: [decide("take_paper", "n6")] },
      n6: {
        alone: true,
        fallback: "firm",
        says,
        replies: [
          decide("firm", null, [
            setFlag("pro_rus_liv_firm"),
            temper("stubborn"),
            trustOf(byName("rus_alexandra"), 1),
            trustOf(byName("rus_maria"), -1),
          ]),
          decide("unready", null, [
            setFlag("pro_rus_liv_unready"),
            temper("anxious"),
            trustOf(byName("rus_sandro"), 1),
          ]),
          decide("mother", null, [
            setFlag("pro_rus_liv_mother"),
            temper("weary"),
            trustOf(byName("rus_maria"), 1),
            trustOf(byName("rus_alexandra"), -1),
          ]),
        ],
      },
    },
  },
  silent("rus_pro_livadia_after"),
  {
    ...big,
    id: "rus_pro_khodynka",
    prologue: 3,
    cast: {
      uncle: past("rus_p_sergei"),
      sandro: past("rus_sandro"),
      mother: past("rus_maria"),
    },
    who: "uncle",
    after: [{ scene: "rus_pro_khodynka_after" }],
    nodes: {
      n1: { says, replies: [decide("how_many", "n2")] },
      n2: { alone: true, says, replies: [decide("go_back", "n3")] },
      n3: {
        who: "sandro",
        says: [
          { id: "unready", when: flag("pro_rus_liv_unready") },
          { id: "base" },
        ],
        replies: [decide("not_going", "n4")],
      },
      n4: { says, replies: [decide("tell_amb", "n5")] },
      n5: { alone: true, says, replies: [decide("dance", "inquiry")] },
      inquiry: {
        who: "mother",
        fallback: "ally",
        says,
        replies: [
          decide("ally", null, [
            setFlag("pro_rus_kho_ally"),
            temper("cold"),
            startRuler("reputation", -1),
          ]),
          decide("uncles", null, [
            setFlag("pro_rus_kho_uncles"),
            temper("stubborn"),
            trustOf(byName("rus_sandro"), 1),
            trustOf(byName("rus_nikolasha"), -1),
            rivalLean(byName("rus_nikolasha"), 1),
          ]),
          decide("hospital", null, [
            setFlag("pro_rus_kho_hospital"),
            temper("gentle"),
            startRuler("conscience", 1),
          ]),
        ],
      },
    },
  },
  silent("rus_pro_khodynka_after"),
  {
    ...big,
    id: "rus_pro_1905",
    prologue: 4,
    cast: {
      court: past("rus_fredericks"),
      willy: past("deu_wilhelm"),
      witte: past("rus_witte"),
      duke: past("rus_nikolasha"),
    },
    who: "court",
    after: [{ scene: "rus_pro_1905_after" }],
    nodes: {
      n1: { says, replies: [decide("why_not_there", "n2")] },
      n2: { says, replies: [decide("diary", "feb")] },
      feb: { alone: true, says, replies: [decide("stay_in", "n3")] },
      n3: { alone: true, says, replies: [decide("to_sea", "n4")] },
      n4: { who: "willy", says, replies: [decide("sign_it", "n5")] },
      n5: {
        who: "witte",
        fallback: "wary",
        says,
        replies: [
          decide("sorry", "n6", [
            setFlag("pro_rus_bjorko_sorry"),
            trustOf(byName("rus_witte"), -1),
          ]),
          decide("wary", "n6", [
            setFlag("pro_rus_bjorko_wary"),
            trustOf(byName("rus_sazonov"), 1),
          ]),
        ],
      },
      n6: { says, replies: [decide("call_him", "n7")] },
      n7: { who: "duke", says, replies: [decide("sign", "duma")] },
      duma: {
        alone: true,
        fallback: "word",
        says,
        replies: [
          decide("forced", null, [
            setFlag("pro_rus_oct_forced"),
            temper("stubborn"),
            trustOf(byName("rus_witte"), -2),
            trustOf(byName("rus_nikolasha"), -1),
            rivalLean(byName("rus_nikolasha"), 1),
          ]),
          decide("word", null, [
            setFlag("pro_rus_oct_word"),
            temper("weary"),
            startRuler("conscience", 1),
            trustOf(byName("rus_rodzianko"), 1),
            rivalLean(byName("rus_rodzianko"), -1),
          ]),
          decide("kept_back", null, [
            setFlag("pro_rus_oct_kept_back"),
            temper("cunning"),
            trustOf(byName("rus_goremykin"), 1),
            rivalLean(byName("rus_rodzianko"), 1),
          ]),
        ],
      },
    },
  },
  silent("rus_pro_1905_after"),
  {
    ...big,
    id: "rus_pro_kiev",
    prologue: 5,
    cast: {
      pm: past("rus_p_stolypin"),
      war: past("rus_sukhomlinov"),
      fin: past("rus_kokovtsov"),
      land: past("rus_krivoshein"),
      alix: past("rus_alexandra"),
    },
    who: "pm",
    after: [{ scene: "rus_pro_kiev_after" }],
    nodes: {
      n1: { alone: true, says, replies: [decide("to_kiev", "n2")] },
      n2: { says, replies: [decide("later", "joke")] },
      joke: { who: "war", says, replies: [decide("laugh", "n3")] },
      n3: { alone: true, says, replies: [decide("stay", "n4")] },
      n4: { who: "fin", says, replies: [decide("end_file", "n5")] },
      n5: { who: "land", says, replies: [decide("go_on", "n6")] },
      n6: {
        who: "alix",
        fallback: "small",
        says: [{ id: "firm", when: flag("pro_rus_liv_firm") }, { id: "base" }],
        replies: [
          decide("small", null, [
            setFlag("pro_rus_kiev_small"),
            temper("cold"),
            trustOf(byName("rus_goremykin"), 1),
            trustOf(byName("rus_krivoshein"), -1),
            rivalLean(byName("rus_krivoshein"), 1),
          ]),
          decide("land", null, [
            setFlag("pro_rus_kiev_land"),
            temper("stubborn"),
            trustOf(byName("rus_krivoshein"), 1),
            trustOf(byName("rus_sazonov"), 1),
            rivalLean(byName("rus_krivoshein"), -1),
          ]),
          decide("knelt", null, [
            setFlag("pro_rus_kiev_knelt"),
            temper("anxious"),
            startRuler("conscience", 1),
          ]),
        ],
      },
    },
  },
  silent("rus_pro_kiev_after"),
  {
    ...big,
    id: "rus_pro_spala",
    prologue: 6,
    cast: {
      surgeon: past("rus_p_fedorov"),
      court: past("rus_fredericks"),
      alix: past("rus_alexandra"),
      doctor: past("rus_botkin"),
    },
    who: "surgeon",
    after: [{ scene: "rus_pro_spala_after" }],
    nodes: {
      n1: { alone: true, says, replies: [decide("upstairs", "n2")] },
      n2: { says, replies: [decide("no_name", "n3")] },
      n3: { who: "court", says, replies: [decide("tomorrow", "dinner")] },
      dinner: { alone: true, says, replies: [decide("leave_table", "n4")] },
      n4: { who: "alix", says, replies: [decide("sit_night", "n5")] },
      n5: { who: "alix", says, replies: [decide("go_up", "n6")] },
      n6: {
        who: "doctor",
        fallback: "unasked",
        says,
        replies: [
          decide("believed", null, [
            setFlag("pro_rus_spala_believed"),
            temper("gentle"),
            startRuler("family", 1),
            trustOf(byName("rus_rasputin"), 2),
            trustOf(byName("rus_alexandra"), 1),
            trustOf(byName("rus_kokovtsov"), -1),
            trustOf(byName("rus_rodzianko"), -1),
            rivalLean(byName("rus_rodzianko"), 1),
          ]),
          decide("doubted", null, [
            setFlag("pro_rus_spala_doubted"),
            temper("cold"),
            trustOf(byName("rus_rasputin"), -1),
            trustOf(byName("rus_botkin"), 1),
            startRuler("family", -1),
          ]),
          decide("unasked", null, [
            setFlag("pro_rus_spala_unasked"),
            temper("weary"),
            trustOf(byName("rus_alexandra"), 1),
            trustOf(byName("rus_kokovtsov"), -1),
          ]),
        ],
      },
    },
  },
  silent("rus_pro_spala_after"),
  {
    ...big,
    id: "rus_pro_spring",
    prologue: 7,
    cast: {
      pm: past("rus_goremykin"),
      police: past("rus_durnovo"),
      mother: past("rus_maria"),
      speaker: past("rus_rodzianko"),
      fm: past("rus_sazonov"),
      war: past("rus_sukhomlinov"),
      duke: past("rus_nikolasha"),
      alix: past("rus_alexandra"),
      court: past("rus_fredericks"),
    },
    who: "pm",
    after: [{ scene: "rus_pro_spring_after" }],
    nodes: {
      n1: {
        says: [
          { id: "small", when: flag("pro_rus_kiev_small") },
          { id: "base" },
        ],
        replies: [decide("enough", "n2")],
      },
      n2: {
        who: "police",
        fallback: "drawer",
        says,
        replies: [
          decide("read", "maria", [
            setFlag("pro_rus_memo_read"),
            trustOf(byName("rus_durnovo"), 1),
            trustOf(byName("rus_sukhomlinov"), -1),
          ]),
          decide("drawer", "maria", [
            setFlag("pro_rus_memo_drawer"),
            trustOf(byName("rus_sukhomlinov"), 1),
            rivalLean(byName("rus_sukhomlinov"), 1),
          ]),
        ],
      },
      maria: { who: "mother", says, replies: [decide("mama", "n3")] },
      n3: {
        who: "speaker",
        fallback: "cut_short",
        says: [{ id: "word", when: flag("pro_rus_oct_word") }, { id: "base" }],
        replies: [
          decide("cut_short", "n4", [
            trustOf(byName("rus_rodzianko"), -1),
            rivalLean(byName("rus_rodzianko"), 1),
          ]),
          decide("hear_out", "n4", [trustOf(byName("rus_rodzianko"), 1)]),
        ],
      },
      n4: { who: "fm", says, replies: [decide("and_serbia", "n5")] },
      n5: { who: "fm", says, replies: [decide("call_war", "n6")] },
      n6: { who: "war", says, replies: [decide("three_years", "duke")] },
      duke: { who: "duke", says, replies: [decide("not_yet", "n7")] },
      n7: {
        who: "alix",
        says: [
          { id: "doubted", when: flag("pro_rus_spala_doubted") },
          { id: "base" },
        ],
        replies: [decide("to_ship", "n8")],
      },
      n8: {
        who: "court",
        fallback: "time",
        says: [
          { id: "anxious", when: rulerTemper("anxious", "weary") },
          { id: "base" },
        ],
        replies: [
          decide("time", null, [
            setFlag("pro_rus_spring_time"),
            temper("anxious"),
            trustOf(byName("rus_sukhomlinov"), 1),
          ]),
          decide("stand", null, [
            setFlag("pro_rus_spring_stand"),
            temper("stubborn"),
            trustOf(byName("rus_sazonov"), 1),
            startRuler("reputation", 1),
          ]),
          decide("boy", null, [
            setFlag("pro_rus_spring_boy"),
            temper("gentle"),
            startRuler("family", 1),
            trustOf(byName("rus_alexandra"), 1),
          ]),
        ],
      },
    },
  },
  silent("rus_pro_spring_after"),
];

const trustNotRefused = [
  not(flag("f_trust_refused_1")),
  not(flag("f_trust_refused_2")),
];

/** Where the main story remembers it: variants laid over its scenes. */
export const RUS_ECHOES: readonly GwEcho[] = [
  // The first paper of a first game: the three who sit in chapter 0.
  {
    scene: "rus_o_first",
    node: "n2",
    id: "pro_stand",
    when: flag("pro_rus_spring_stand"),
  },
  {
    scene: "rus_o_first",
    node: "n3",
    id: "pro_time",
    when: flag("pro_rus_spring_time"),
  },
  {
    scene: "rus_o_first",
    node: "n4",
    id: "pro_small",
    when: flag("pro_rus_kiev_small"),
  },
  // The first weeks.
  {
    scene: "rus_c_door",
    id: "pro_believed",
    when: flag("pro_rus_spala_believed"),
  },
  {
    scene: "rus_c_skerries",
    id: "pro_fear",
    when: all(flag("pro_rus_stairs_fear"), {
      kind: "opening",
      of: ["sarajevo"],
    }),
  },
  {
    scene: "rus_c_heir_fall",
    id: "pro_believed",
    when: flag("pro_rus_spala_believed"),
  },
  {
    scene: "rus_c_heir_fall",
    id: "pro_doubted",
    when: flag("pro_rus_spala_doubted"),
  },
  {
    scene: "rus_c_pokrovskoe",
    id: "pro_believed",
    when: flag("pro_rus_spala_believed"),
  },
  {
    scene: "rus_c_poincare",
    id: "pro_ally",
    when: flag("pro_rus_kho_ally"),
  },
  // July.
  {
    scene: "rus_c_willy",
    id: "pro_sorry",
    when: flag("pro_rus_bjorko_sorry"),
  },
  {
    scene: "rus_c_willy",
    id: "pro_wary",
    when: flag("pro_rus_bjorko_wary"),
  },
  {
    scene: "rus_v_durnovo_memo",
    node: "open",
    id: "pro_read",
    when: flag("pro_rus_memo_read"),
  },
  {
    scene: "rus_v_witte_warn",
    node: "open",
    id: "pro_forced",
    when: flag("pro_rus_oct_forced"),
  },
  {
    scene: "rus_b_peterhof",
    node: "n4",
    id: "pro_read",
    when: flag("pro_rus_memo_read"),
  },
  {
    scene: "rus_b_peterhof_held",
    id: "pro_cup",
    when: flag("pro_rus_kho_hospital"),
  },
  // The war comes.
  {
    scene: "rus_c_balcony",
    id: "pro_fear",
    when: flag("pro_rus_stairs_fear"),
  },
  {
    scene: "rus_c_supreme",
    id: "pro_pistol",
    when: flag("pro_rus_oct_forced"),
  },
  // The house.
  {
    scene: "rus_v_kok_numbers",
    node: "open",
    id: "pro_unasked",
    when: flag("pro_rus_spala_unasked"),
  },
  {
    scene: "rus_h_heir_bleed",
    id: "pro_doubted",
    when: all(
      flag("pro_rus_spala_doubted"),
      not(flag("f_friend_exiled")),
      not(chose("rus_h_heir_stavka", "take_him")),
      not(chose("rus_h_heir_stavka", "one_week")),
    ),
  },
  {
    scene: "rus_h_friend_exile",
    id: "pro_doubted",
    when: flag("pro_rus_spala_doubted"),
  },
  {
    scene: "rus_h_mother",
    id: "pro_mother",
    when: all(
      flag("pro_rus_liv_mother"),
      not({ kind: "seen", scene: "rus_r_friend_dead" }),
    ),
  },
  {
    scene: "rus_b_quiet_year",
    node: "n4",
    id: "pro_land",
    when: flag("pro_rus_kiev_land"),
  },
  {
    scene: "rus_p_san_3",
    node: "ball",
    id: "pro_uncles",
    when: flag("pro_rus_kho_uncles"),
  },
  {
    scene: "rus_p_san_5",
    node: "liv",
    id: "pro_unready",
    when: flag("pro_rus_liv_unready"),
  },
  // The long end.
  {
    scene: "rus_b_august",
    node: "n6",
    id: "pro_firm",
    when: flag("pro_rus_liv_firm"),
  },
  {
    scene: "rus_b_winter",
    node: "n5",
    id: "pro_boy",
    when: flag("pro_rus_spring_boy"),
  },
  {
    scene: "rus_b_winter",
    node: "n6",
    id: "pro_paper",
    when: flag("pro_rus_stairs_paper"),
  },
  {
    scene: "rus_r_trust",
    id: "pro_word",
    when: all(flag("pro_rus_oct_word"), ...trustNotRefused),
  },
  {
    scene: "rus_r_trust",
    id: "pro_kept",
    when: all(flag("pro_rus_oct_kept_back"), ...trustNotRefused),
  },
  {
    scene: "rus_b_last_night",
    node: "n5",
    id: "pro_held",
    when: flag("pro_rus_stairs_held"),
  },
  {
    scene: "rus_b_last_night_after",
    id: "pro_knelt",
    when: flag("pro_rus_kiev_knelt"),
  },
  {
    scene: "rus_r_abdication",
    id: "pro_unready",
    when: all(
      flag("pro_rus_liv_unready"),
      world({ is: "regime", of: ["tsar"] }),
      not(chose("rus_r_abdication", "refuse_and_fight")),
    ),
  },
];
