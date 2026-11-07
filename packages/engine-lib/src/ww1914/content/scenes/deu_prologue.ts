// Great War 1914 (ww154): Wilhelm II's earlier life. Format:
// /home/eser/dev/ww154-format.md. Text: resources/ww1914/ko/DEU.prologue.json.
import {
  all,
  byName,
  character,
  decide,
  flag,
  GwCond,
  GwEcho,
  GwScene,
  past,
  rivalLean,
  role,
  setFlag,
  startRuler,
  temper,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";

const tirpitz = byName("deu_tirpitz");
const moltke = byName("deu_moltke");
const bethmann = byName("deu_bethmann");
const heir = byName("deu_heir");
const falkenhayn = byName("deu_falkenhayn");

/** One remembered day: `n` is its place in the row. */
const year = (
  id: string,
  n: number,
  rest: Pick<GwScene, "cast" | "who" | "nodes"> & Partial<GwScene>,
): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "talk",
  big: true,
  scheduledOnly: true,
  once: true,
  salience: 9,
  prologue: n,
  tags: [],
  start: "n1",
  variants: [{ id: "base" }],
  ...rest,
});

const card = (id: string): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: [],
  variants: [{ id: "base" }],
});

const said = (id = "base", when?: GwCond) =>
  when === undefined ? { id } : { id, when };

export const DEU_PROLOGUE_SCENES: readonly GwScene[] = [
  // ---- 1867: the arm, the mother, and the story he tells of it ----
  year("deu_pro_arm", 1, {
    cast: {
      tutor: past("deu_p_hinzpeter"),
      father: past("deu_p_fritz"),
      mother: past("deu_p_vicky"),
    },
    who: "tutor",
    after: [{ scene: "deu_pro_arm_after" }],
    nodes: {
      n1: {
        fallback: "go",
        says: [said()],
        replies: [
          decide("go", "n2"),
          decide("wait", "n2", [temper("anxious")]),
        ],
      },
      n2: {
        alone: true,
        fallback: "stand",
        says: [said()],
        replies: [
          decide("stand", "n2f", [temper("stubborn")]),
          decide("cry", "n2f", [temper("gentle")]),
        ],
      },
      n2f: {
        who: "father",
        fallback: "sword",
        says: [said()],
        replies: [decide("sword", "n3")],
      },
      n3: {
        who: "mother",
        fallback: "sleeve",
        says: [said()],
        replies: [decide("sleeve", "n4")],
      },
      n4: {
        alone: true,
        fallback: "ride",
        says: [said()],
        replies: [
          decide("ride", null, [
            setFlag("pro_deu_arm_rode"),
            temper("stubborn"),
            startRuler("health", 1),
          ]),
          decide("hide", null, [
            setFlag("pro_deu_arm_hid"),
            temper("anxious"),
            startRuler("reputation", 1),
          ]),
          decide("read", null, [
            setFlag("pro_deu_arm_read"),
            temper("cold"),
            startRuler("family", -1),
          ]),
        ],
      },
    },
  }),
  card("deu_pro_arm_after"),

  // ---- 1888: ninety-nine days, the soldiers round the palace, England ----
  year("deu_pro_father", 2, {
    cast: {
      father: past("deu_p_fritz"),
      mother: past("deu_p_vicky"),
      young: past("deu_moltke"),
      old: past("deu_p_bismarck"),
      phili: past("deu_eulenburg"),
    },
    who: "father",
    after: [
      { scene: "deu_pro_father_note", when: flag("pro_deu_father_note") },
    ],
    nodes: {
      n1: {
        alone: true,
        fallback: "keep_note",
        says: [said()],
        replies: [
          decide("keep_note", "n2", [setFlag("pro_deu_father_note")]),
          decide("leave_note", "n2", [temper("cold")]),
        ],
      },
      n2: {
        who: "mother",
        fallback: "pass",
        says: [said()],
        replies: [
          decide("accuse", "n3", [startRuler("family", -1)]),
          decide("pass", "n3"),
        ],
      },
      n3: {
        who: "young",
        fallback: "order",
        says: [said()],
        replies: [decide("order", "n4")],
      },
      n4: {
        alone: true,
        fallback: "wait",
        says: [said()],
        replies: [decide("wait", "n4b")],
      },
      n4b: {
        who: "old",
        fallback: "thanks",
        says: [said()],
        replies: [
          decide("thanks", "n5"),
          decide("noted", "n5", [temper("arrogant")]),
        ],
      },
      n5: {
        who: "young",
        fallback: "door",
        says: [said()],
        replies: [
          decide("door", "n6", [
            setFlag("pro_deu_father_door"),
            temper("gentle"),
            startRuler("family", 1),
          ]),
          decide("more", "n6", [
            setFlag("pro_deu_father_sealed"),
            temper("cold"),
            startRuler("conscience", -1),
            trustOf(moltke, 1),
          ]),
          decide("england", "n6", [
            setFlag("pro_deu_father_england"),
            temper("stubborn"),
            trustOf(tirpitz, 1),
            rivalLean(tirpitz, 1),
          ]),
        ],
      },
      n6: {
        who: "phili",
        fallback: "turn",
        says: [said()],
        replies: [
          decide("turn", null, [
            setFlag("pro_deu_phili_music"),
            trustOf(byName("deu_eulenburg"), 1),
          ]),
          decide("paper", null, [temper("cold")]),
        ],
      },
    },
  }),
  card("deu_pro_father_note"),

  // ---- 1890: Bismarck goes, and the wire to Petersburg with him ----
  year("deu_pro_pilot", 3, {
    cast: { old: past("deu_p_bismarck"), general: past("deu_p_caprivi") },
    who: "old",
    after: [{ scene: "deu_pro_pilot_after" }],
    nodes: {
      n1: {
        fallback: "guests",
        says: [said()],
        replies: [
          decide("guests", "n2"),
          decide("order", "n2", [temper("arrogant")]),
        ],
      },
      n2: {
        fallback: "read",
        says: [said()],
        replies: [decide("read", "n2b")],
      },
      n2b: {
        fallback: "hear",
        says: [said()],
        replies: [
          decide("hear", "n3", [setFlag("pro_deu_pilot_heard")]),
          decide("enough", "n3", [temper("arrogant")]),
        ],
      },
      n3: {
        alone: true,
        fallback: "accept",
        says: [said()],
        replies: [decide("accept", "n3b")],
      },
      n3b: {
        fallback: "go",
        says: [said()],
        replies: [decide("go", "n4")],
      },
      n4: {
        who: "general",
        fallback: "why",
        says: [said()],
        replies: [decide("why", "n5")],
      },
      n5: {
        who: "general",
        fallback: "cannot",
        says: [said()],
        replies: [decide("cannot", "n6")],
      },
      n6: {
        alone: true,
        fallback: "vienna",
        says: [said()],
        replies: [
          decide("helm", null, [
            setFlag("pro_deu_pilot_helm"),
            temper("arrogant"),
            startRuler("reputation", 1),
          ]),
          decide("wire", null, [
            setFlag("pro_deu_pilot_wire"),
            temper("anxious"),
            trustOf(byName("deu_pourtales"), 1),
          ]),
          decide("vienna", null, [
            setFlag("pro_deu_vienna_word"),
            temper("stubborn"),
            trustOf(byName("deu_tschirschky"), 1),
          ]),
        ],
      },
    },
  }),
  card("deu_pro_pilot_after"),

  // ---- 1901: the grandmother's pillow, and the fleet she never saw built ----
  year("deu_pro_osborne", 4, {
    cast: {
      admiral: past("deu_tirpitz"),
      doctor: past("deu_p_reid"),
      uncle: past("deu_p_bertie"),
    },
    who: "admiral",
    after: [{ scene: "deu_pro_osborne_after" }],
    nodes: {
      n1: {
        fallback: "table",
        says: [said()],
        replies: [
          decide("table", "n2", [trustOf(tirpitz, 1)]),
          decide("later", "n2", [trustOf(tirpitz, -1)]),
        ],
      },
      n2: {
        alone: true,
        fallback: "kneel",
        says: [said()],
        replies: [decide("kneel", "n3")],
      },
      n3: {
        who: "doctor",
        fallback: "hold",
        says: [said("england", flag("pro_deu_father_england")), said()],
        replies: [decide("hold", "n4", [startRuler("conscience", 1)])],
      },
      n4: {
        alone: true,
        fallback: "rise",
        says: [said()],
        replies: [decide("rise", "n4b")],
      },
      n4b: {
        who: "doctor",
        fallback: "tape",
        says: [said()],
        replies: [decide("tape", "n5")],
      },
      n5: {
        who: "uncle",
        fallback: "dinner",
        says: [said()],
        replies: [decide("dinner", "n5b")],
      },
      n5b: {
        alone: true,
        fallback: "wire",
        says: [said()],
        replies: [decide("wire", "n6")],
      },
      n6: {
        alone: true,
        fallback: "both",
        says: [said()],
        replies: [
          decide("kin", null, [
            setFlag("pro_deu_osborne_kin"),
            temper("gentle"),
            startRuler("family", 1),
            trustOf(byName("deu_lichnowsky"), 1),
            rivalLean(tirpitz, -1),
          ]),
          decide("fleet", null, [
            setFlag("pro_deu_fleet_first"),
            temper("arrogant"),
            trustOf(tirpitz, 1),
            rivalLean(tirpitz, 1),
          ]),
          decide("both", null, [
            setFlag("pro_deu_osborne_both"),
            temper("cunning"),
          ]),
        ],
      },
    },
  }),
  card("deu_pro_osborne_after"),

  // ---- 1905: the treaty on the yacht, and the man in his uncle's chair ----
  year("deu_pro_bjorko", 5, {
    cast: {
      nicky: past("rus_nicholas"),
      clerk: past("deu_tschirschky"),
      chan: past("deu_buelow"),
      julius: past("deu_moltke"),
    },
    who: "nicky",
    nodes: {
      n1: {
        fallback: "pen",
        says: [said()],
        replies: [decide("pen", "n2")],
      },
      n2: {
        alone: true,
        fallback: "ashore",
        says: [said("wire", flag("pro_deu_pilot_wire")), said()],
        replies: [decide("ashore", "n3")],
      },
      n3: {
        who: "chan",
        fallback: "plead",
        says: [said()],
        replies: [decide("plead", "n4")],
      },
      n4: {
        who: "clerk",
        fallback: "drawer",
        says: [said()],
        replies: [
          decide("drawer", "n5", [
            setFlag("pro_deu_bjorko_kept"),
            temper("gentle"),
          ]),
          decide("blame", "n5", [
            setFlag("pro_deu_bjorko_blamed"),
            temper("cold"),
            trustOf(byName("deu_pourtales"), -1),
          ]),
        ],
      },
      n5: {
        who: "julius",
        fallback: "man",
        says: [said("sealed", flag("pro_deu_father_sealed")), said()],
        replies: [
          decide("man", "n6", [
            setFlag("pro_deu_julius_man"),
            trustOf(moltke, 1),
          ]),
          decide("name", "n6", [
            setFlag("pro_deu_julius_name"),
            temper("arrogant"),
            startRuler("reputation", 1),
            trustOf(moltke, -1),
          ]),
          decide("plan", "n6", [
            setFlag("pro_deu_julius_plan"),
            temper("stubborn"),
            rivalLean(falkenhayn, 1),
          ]),
        ],
      },
      n6: {
        alone: true,
        fallback: "map",
        says: [said()],
        replies: [decide("map", null)],
      },
    },
  }),

  // ---- 1907-09: the friend, the son, the laugh, the quiet man ----
  year("deu_pro_laugh", 6, {
    cast: {
      son: past("deu_heir"),
      phili: past("deu_eulenburg"),
      chan: past("deu_buelow"),
      wife: past("deu_empress"),
      diary: past("deu_muller"),
      quiet: past("deu_bethmann"),
    },
    who: "son",
    nodes: {
      n1: {
        fallback: "thank",
        says: [said()],
        replies: [
          decide("thank", "n2", [
            setFlag("pro_deu_son_thanked"),
            trustOf(heir, 1),
            rivalLean(heir, -1),
          ]),
          decide("blame", "n2", [
            setFlag("pro_deu_son_blamed"),
            trustOf(heir, -1),
            rivalLean(heir, 1),
          ]),
        ],
      },
      n2: {
        alone: true,
        fallback: "wait",
        says: [said()],
        replies: [decide("wait", "n2b")],
      },
      n2b: {
        who: "phili",
        fallback: "cut",
        says: [said("music", flag("pro_deu_phili_music")), said()],
        replies: [
          decide("cut", "n3", [
            setFlag("pro_deu_phili_cut"),
            temper("cold"),
            startRuler("conscience", -1),
          ]),
          decide("kept", "n3", [
            setFlag("pro_deu_phili_kept"),
            temper("gentle"),
          ]),
        ],
      },
      n3: {
        alone: true,
        fallback: "stop",
        says: [said()],
        replies: [decide("stop", "n4")],
      },
      n4: {
        who: "chan",
        fallback: "sign",
        says: [said()],
        replies: [
          decide("sign", "n4b"),
          decide("ask", "n4b", [trustOf(byName("deu_buelow"), -1)]),
        ],
      },
      n4b: {
        who: "wife",
        fallback: "hand",
        says: [said()],
        replies: [
          decide("hand", "n5", [startRuler("family", 1)]),
          decide("wall", "n5", [temper("weary")]),
        ],
      },
      n5: {
        who: "diary",
        fallback: "say",
        says: [said()],
        replies: [
          decide("rise", "n6", [
            setFlag("pro_deu_uniform"),
            temper("arrogant"),
            startRuler("health", -1),
            startRuler("reputation", 1),
          ]),
          decide("say", "n6", [
            setFlag("pro_deu_told_muller"),
            temper("anxious"),
            trustOf(byName("deu_muller"), 1),
          ]),
          decide("grudge", "n6", [
            setFlag("pro_deu_buelow_never"),
            temper("stubborn"),
            trustOf(byName("deu_buelow"), -2),
          ]),
        ],
      },
      n6: {
        who: "quiet",
        fallback: "plain",
        says: [said()],
        replies: [
          decide("plain", null, [
            setFlag("pro_deu_beth_plain"),
            trustOf(bethmann, 1),
            rivalLean(bethmann, -1),
          ]),
          decide("stag", null, [
            setFlag("pro_deu_beth_stag"),
            temper("cunning"),
          ]),
          decide("clerk", null, [
            setFlag("pro_deu_beth_clerk"),
            temper("arrogant"),
            trustOf(bethmann, -1),
            rivalLean(bethmann, 1),
          ]),
        ],
      },
    },
  }),

  // ---- June 1914: counting on the right hand, the night before the race ----
  year("deu_pro_june", 7, {
    cast: {
      ff: past("auh_ff"),
      chan: past("deu_bethmann"),
      ballin: past("deu_ballin"),
      admiral: past("deu_tirpitz"),
      julius: past("deu_moltke"),
      diary: past("deu_muller"),
    },
    who: "ff",
    after: [{ scene: "deu_pro_june_after" }],
    nodes: {
      n1: {
        fallback: "two",
        says: [said("word", flag("pro_deu_vienna_word")), said()],
        replies: [decide("two", "n2")],
      },
      n2: {
        who: "chan",
        fallback: "hear",
        says: [
          said("clerk", flag("pro_deu_beth_clerk")),
          said("plain", flag("pro_deu_beth_plain")),
          said(),
        ],
        replies: [
          decide("hear", "n3", [trustOf(bethmann, 1)]),
          decide("army", "n3", [
            trustOf(falkenhayn, 1),
            rivalLean(falkenhayn, 1),
          ]),
        ],
      },
      n3: {
        who: "ballin",
        fallback: "trader",
        says: [said()],
        replies: [decide("trader", "n4", [trustOf(byName("deu_ballin"), 1)])],
      },
      n4: {
        who: "admiral",
        fallback: "letter",
        says: [said("fleet", flag("pro_deu_fleet_first")), said()],
        replies: [decide("letter", "n4b")],
      },
      n4b: {
        who: "julius",
        fallback: "count",
        says: [said()],
        replies: [decide("count", "n5")],
      },
      n5: {
        who: "diary",
        fallback: "enemies",
        says: [said("wire", flag("pro_deu_bjorko_kept")), said()],
        replies: [decide("enemies", "n6")],
      },
      n6: {
        who: "diary",
        fallback: "fear",
        says: [said()],
        replies: [decide("fear", "n7")],
      },
      n7: {
        who: "diary",
        fallback: "wind",
        says: [said("told", flag("pro_deu_told_muller")), said()],
        replies: [
          decide("peace", null, [
            setFlag("pro_deu_june_peace"),
            temper("gentle"),
            startRuler("conscience", 1),
            rivalLean(falkenhayn, 1),
          ]),
          decide("now", null, [
            setFlag("pro_deu_june_now"),
            temper("stubborn"),
            trustOf(moltke, 1),
            rivalLean(bethmann, 1),
          ]),
          decide("alone", null, [
            setFlag("pro_deu_june_alone"),
            temper("anxious"),
            { kind: "trust", tag: "AUH", delta: 1 },
          ]),
          decide("wind", null, [setFlag("pro_deu_june_wind"), temper("weary")]),
        ],
      },
    },
  }),
  card("deu_pro_june_after"),
];

const sarajevo: GwCond = { kind: "opening", of: ["sarajevo"] };

/** Where the main story remembers it: variants laid over its scenes. */
export const DEU_ECHOES: readonly GwEcho[] = [
  // The crisis: what was promised, and to whom.
  {
    scene: "deu_big_kiel",
    node: "n6",
    id: "pro_word",
    when: all(flag("pro_deu_vienna_word"), sarajevo),
  },
  {
    scene: "deu_big_kiel",
    node: "n3",
    id: "pro_heard",
    when: all(flag("pro_deu_pilot_heard"), sarajevo),
  },
  {
    scene: "deu_big_aug",
    node: "n1",
    id: "pro_peace",
    when: flag("pro_deu_june_peace"),
  },
  {
    scene: "deu_c_blank_cheque",
    id: "pro_word",
    when: all(flag("pro_deu_vienna_word"), sarajevo),
  },
  {
    scene: "deu_c_blank_cheque",
    id: "pro_alone",
    when: all(flag("pro_deu_june_alone"), sarajevo),
  },
  {
    scene: "deu_t_moltke_window",
    node: "open",
    id: "pro_now",
    when: flag("pro_deu_june_now"),
  },
  {
    scene: "deu_t_moltke_cure",
    node: "open",
    id: "pro_man",
    when: flag("pro_deu_julius_man"),
  },
  {
    scene: "deu_t_beth_calc",
    node: "open",
    id: "pro_plain",
    when: flag("pro_deu_beth_plain"),
  },
  {
    scene: "deu_t_tirp_fleet",
    node: "open",
    id: "pro_fleet",
    when: flag("pro_deu_fleet_first"),
  },
  {
    scene: "deu_big_aug",
    node: "n6",
    id: "pro_kept",
    when: flag("pro_deu_bjorko_kept"),
  },
  {
    scene: "deu_big_aug",
    node: "n6",
    id: "pro_blamed",
    when: flag("pro_deu_bjorko_blamed"),
  },
  // The cousin.
  {
    scene: "deu_l_nicky_1",
    id: "pro_kept",
    when: all(
      flag("pro_deu_bjorko_kept"),
      character(role("other"), "principled"),
    ),
  },
  {
    scene: "deu_l_nicky_gone",
    id: "pro_kept",
    when: flag("pro_deu_bjorko_kept"),
  },
  // The private stories.
  {
    scene: "deu_pv_mol_julius",
    node: "fear",
    id: "pro_note",
    when: flag("pro_deu_father_note"),
  },
  {
    scene: "deu_pv_bet_piano",
    node: "father",
    id: "pro_door",
    when: flag("pro_deu_father_door"),
  },
  {
    scene: "deu_pv_bet_piano",
    node: "father",
    id: "pro_sealed",
    when: flag("pro_deu_father_sealed"),
  },
  {
    scene: "deu_pv_eul_letter",
    id: "pro_kept",
    when: flag("pro_deu_phili_kept"),
  },
  {
    scene: "deu_pv_eul_garden",
    node: "sorry",
    id: "pro_cut",
    when: flag("pro_deu_phili_cut"),
  },
  {
    scene: "deu_pv_mul_1908",
    node: "laugh",
    id: "pro_told",
    when: flag("pro_deu_told_muller"),
  },
  {
    scene: "deu_pv_mul_1908",
    node: "yes",
    id: "pro_uniform",
    when: flag("pro_deu_uniform"),
  },
  {
    scene: "deu_pv_gra_lap",
    node: "mother",
    id: "pro_read",
    when: flag("pro_deu_arm_read"),
  },
  // The arm, the family, England.
  {
    scene: "deu_life_photograph",
    id: "pro_hid",
    when: flag("pro_deu_arm_hid"),
  },
  {
    scene: "deu_life_osborne",
    id: "pro_kin",
    when: flag("pro_deu_osborne_kin"),
  },
  {
    scene: "deu_life_osborne",
    id: "pro_england",
    when: flag("pro_deu_father_england"),
  },
  {
    scene: "deu_life_garter",
    id: "pro_fleet",
    when: flag("pro_deu_fleet_first"),
  },
  {
    scene: "deu_a_watch_out",
    id: "pro_thanked",
    when: flag("pro_deu_son_thanked"),
  },
  {
    scene: "deu_v_moltke_resign",
    node: "open",
    id: "pro_name",
    when: flag("pro_deu_julius_name"),
  },
  {
    scene: "deu_v2_buelow_opera",
    node: "wound",
    id: "pro_never",
    when: flag("pro_deu_buelow_never"),
  },
  // The end.
  {
    scene: "deu_big_last_fog",
    id: "pro_note",
    when: flag("pro_deu_father_note"),
  },
];
