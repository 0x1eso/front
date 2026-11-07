// Great War 1914 (ww154): Franz Joseph's earlier life. Format:
// /home/eser/dev/ww154-format.md. Text: resources/ww1914/ko/AUH.prologue.json.
//
// Seven scenes, 1848 to the morning of the wire. History happens as it happened;
// a choice is how he took it. What each plants: the first scene the debt to
// Russia and Hungary's grudge, Ischl the study and the marriage, 1866 the blame
// that needs a name, 1867 the oath and the alliance, Mayerling the word and the
// heir, 1898-1900 the rules that bind the funeral, the last the men in the chairs.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwCond,
  GwEcho,
  GwEffect,
  GwNode,
  GwReply,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  byName,
  character,
  chose,
  decide,
  flag,
  memory,
  not,
  past,
  rivalLean,
  role,
  rulerTemper,
  setFlag,
  startRuler,
  temper,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";

const mark = (name: string): GwEffect => setFlag(`pro_auh_${name}`);
const held = (name: string): GwCond => flag(`pro_auh_${name}`);
const trust = (person: string, delta: number): GwEffect =>
  trustOf(byName(person), delta);
const lean = (person: string, delta: number): GwEffect =>
  rivalLean(byName(person), delta);
const nation = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});

const node = (replies: GwReply[], who?: string): GwNode => ({
  ...(who === undefined ? {} : { who }),
  says: [{ id: "base" }],
  replies,
});
const alone = (replies: GwReply[]): GwNode => ({
  alone: true,
  says: [{ id: "base" }],
  replies,
});
/** A node whose line reads an earlier choice; the base comes last. */
const reading = (
  says: { id: string; when: GwCond }[],
  replies: GwReply[],
  who?: string,
): GwNode => ({
  ...node(replies, who),
  says: [...says, { id: "base" }],
});

function memoryScene(
  id: string,
  prologue: number,
  cast: Record<string, string>,
  who: string,
  nodes: Record<string, GwNode>,
  after?: string,
): GwScene {
  return {
    id,
    nation: ["AUH"],
    kind: "talk",
    big: true,
    scheduledOnly: true,
    once: true,
    salience: 9,
    prologue,
    tags: [],
    cast: Object.fromEntries(
      Object.entries(cast).map(([role, person]) => [role, past(person)]),
    ),
    who,
    start: "n1",
    variants: [{ id: "base" }],
    ...(after === undefined ? {} : { after: [{ scene: after }] }),
    nodes,
  } as GwScene;
}

const silent = (id: string): GwScene =>
  ({
    id,
    nation: ["AUH"],
    kind: "wire",
    silent: true,
    scheduledOnly: true,
    cast: {},
    salience: 0,
    tags: [],
    variants: [{ id: "base" }],
  }) as GwScene;

export const AUH_PROLOGUE_SCENES: readonly GwScene[] = [
  memoryScene(
    "auh_pro_olmutz",
    1,
    {
      mother: "auh_p_sophie",
      tutor: "auh_p_bombelles",
      chan: "auh_p_schwarzenberg",
      uncle: "auh_p_ferdinand",
      tsar: "auh_p_nicholas1",
    },
    "mother",
    {
      n1: node([
        decide("read", "n1b", [temper("stubborn")]),
        decide("ride", "n1b", [temper("gentle"), startRuler("health", 1)]),
      ]),
      n1b: node([decide("nod", "n2")], "tutor"),
      n2: node([decide("kiss", "n3")]),
      n3: node([decide("name", "n4")], "chan"),
      n4: node(
        [
          decide("youth", "n5", [mark("youth"), temper("weary")]),
          decide("god", "n5", [
            mark("god"),
            temper("stubborn"),
            startRuler("reputation", 1),
          ]),
          decide("mother", "n5", [
            mark("mother"),
            temper("anxious"),
            startRuler("family", 1),
          ]),
        ],
        "uncle",
      ),
      n5: alone([decide("sign", "n6")]),
      n6: node([decide("army", "n7")], "chan"),
      n7: node(
        [
          decide("thanks", "n8", [
            mark("russia_debt"),
            temper("gentle"),
            nation("RUS", 1),
          ]),
          decide("shame", "n8", [
            mark("russia_shame"),
            temper("cold"),
            nation("RUS", -1),
          ]),
        ],
        "tsar",
      ),
      n8: node([decide("hear", "n9")], "chan"),
      n9: node([
        decide("law", null, [
          mark("arad_law"),
          temper("cold"),
          startRuler("conscience", -1),
          trust("auh_tisza", -1),
          lean("auh_tisza", 1),
        ]),
        decide("names", null, [
          mark("arad_names"),
          temper("gentle"),
          startRuler("conscience", 1),
          trust("auh_tisza", 1),
        ]),
      ]),
    },
    "auh_pro_olmutz_after",
  ),
  silent("auh_pro_olmutz_after"),
  memoryScene(
    "auh_pro_ischl",
    2,
    { mother: "auh_p_sophie", sisi: "auh_p_elisabeth" },
    "mother",
    {
      n1: node([decide("bow", "n2")]),
      n2: node([decide("look", "n3")], "sisi"),
      n3: node([decide("thank", "n4")]),
      n4: node([decide("laugh", "n4b")], "sisi"),
      n4b: node([decide("soon", "n5")], "sisi"),
      n5: node(
        [
          decide("beside", null, [
            mark("sisi_beside"),
            temper("gentle"),
            startRuler("family", 1),
          ]),
          decide("leave", null, [
            mark("sisi_left"),
            temper("cold"),
            startRuler("family", -1),
          ]),
        ],
        "sisi",
      ),
    },
    "auh_pro_ischl_after",
  ),
  silent("auh_pro_ischl_after"),
  {
    ...memoryScene(
      "auh_pro_sadowa",
      3,
      { minister: "auh_p_buol", beck: "auh_beck" },
      "minister",
      {
        n0: reading(
          [{ id: "debt", when: held("russia_debt") }],
          [
            decide("even", "n0b", [mark("russia_even"), temper("cunning")]),
            decide("ingrate", "n0b", [
              mark("russia_ingrate"),
              startRuler("conscience", -1),
            ]),
          ],
        ),
        n0b: alone([decide("note", "n0c")]),
        n0c: alone([decide("ride", "n1")]),
        n1: alone([decide("write", "n2")]),
        n2: alone([decide("order", "n3")]),
        n3: alone([decide("answer", "n4")]),
        n4: node([decide("keep", "n5")], "beck"),
        n5: alone([decide("read", "n6")]),
        n6: node(
          [
            decide("one_name", null, [
              mark("benedek_used"),
              temper("cold"),
              startRuler("conscience", -1),
            ]),
            decide("my_wire", null, [
              mark("benedek_owed"),
              temper("gentle"),
              startRuler("conscience", 1),
              trust("auh_beck", 1),
            ]),
            decide("no_generals", null, [
              mark("generals_doubt"),
              temper("anxious"),
              trust("auh_conrad", -1),
              lean("auh_conrad", 1),
            ]),
          ],
          "beck",
        ),
      },
      "auh_pro_sadowa_after",
    ),
    start: "n0",
  },
  silent("auh_pro_sadowa_after"),
  memoryScene(
    "auh_pro_crown",
    4,
    {
      deak: "auh_p_deak",
      andrassy: "auh_p_andrassy",
      sisi: "auh_p_elisabeth",
      mother: "auh_p_sophie",
    },
    "deak",
    {
      n1: node([decide("ask", "n1b")]),
      n1b: reading(
        [{ id: "left", when: held("sisi_left") }],
        [decide("meet", "n2")],
        "sisi",
      ),
      n2: node([decide("walk", "n3")], "andrassy"),
      n3: reading(
        [{ id: "left", when: held("sisi_left") }],
        [decide("open", "n4")],
        "sisi",
      ),
      n4: alone([
        decide("keep_it", "n5", [
          mark("oath_true"),
          temper("stubborn"),
          startRuler("reputation", 1),
          trust("auh_tisza", 1),
          lean("auh_tisza", -1),
        ]),
        decide("price", "n5", [
          mark("oath_price"),
          temper("cunning"),
          trust("auh_tisza", -1),
          lean("auh_tisza", 1),
        ]),
      ]),
      n5: node(
        [
          decide("sit", "n5b", [
            mark("max_sat"),
            temper("gentle"),
            startRuler("family", 1),
          ]),
          decide("desk", "n5b", [mark("max_desk"), temper("weary")]),
        ],
        "mother",
      ),
      n5b: node(
        [
          decide("firm", "n6", [mark("prague_firm"), temper("stubborn")]),
          decide("regret", "n6", [
            mark("prague_regret"),
            startRuler("conscience", 1),
          ]),
        ],
        "andrassy",
      ),
      n6: node(
        [
          decide("friend", null, [
            mark("berlin_friend"),
            temper("stubborn"),
            nation("DEU", 1),
          ]),
          decide("use", null, [mark("berlin_need"), temper("cunning")]),
        ],
        "andrassy",
      ),
    },
  ),
  memoryScene(
    "auh_pro_mayerling",
    5,
    {
      rudolf: "auh_p_rudolf",
      sisi: "auh_p_elisabeth",
      schratt: "auh_schratt",
      daughter: "auh_valerie",
      doctor: "auh_p_widerhofer",
      bolfras: "auh_bolfras",
    },
    "rudolf",
    {
      n1: node([
        decide("not_yours", "n1b", [mark("rudolf_no"), temper("stubborn")]),
        decide("say_nothing", "n1b", [mark("rudolf_kept"), temper("anxious")]),
      ]),
      n1b: reading(
        [{ id: "no", when: held("rudolf_no") }],
        [decide("good_night", "n2")],
      ),
      n2: reading(
        [{ id: "left", when: held("sisi_left") }],
        [decide("hear", "n3")],
        "sisi",
      ),
      n3: node(
        [
          decide("drink", "n4", [
            mark("schratt_stayed"),
            trust("auh_schratt", 1),
            startRuler("family", 1),
          ]),
          decide("papers", "n4", [
            mark("alone"),
            temper("weary"),
            startRuler("health", -1),
          ]),
        ],
        "schratt",
      ),
      n4: node([decide("no_ask", "n5")], "daughter"),
      n5: node(
        [
          decide("believe", "n6", [mark("word_believed"), temper("anxious")]),
          decide("know", "n6", [
            mark("word_knew"),
            temper("cunning"),
            startRuler("conscience", 1),
          ]),
        ],
        "doctor",
      ),
      n6: alone([decide("half_past", "n7")]),
      n7: node([decide("shelf", null)], "bolfras"),
    },
    "auh_pro_mayerling_after",
  ),
  silent("auh_pro_mayerling_after"),
  memoryScene(
    "auh_pro_geneva",
    6,
    {
      paar: "auh_p_paar",
      daughter: "auh_valerie",
      heir: "auh_ff",
      court: "auh_montenuovo",
      beck: "auh_beck",
      chief: "auh_conrad",
      minister: "auh_p_aehrenthal",
    },
    "paar",
    {
      n1: node([
        decide("spared", "n2", [temper("weary")]),
        decide("sit", "n2", [temper("stubborn")]),
      ]),
      n2: reading(
        [{ id: "beside", when: held("sisi_beside") }],
        [
          decide("her_room", "n3", [
            mark("sisi_room"),
            temper("gentle"),
            startRuler("family", 1),
          ]),
          decide("the_list", "n3", [
            mark("jubilee_on"),
            temper("cold"),
            startRuler("reputation", 1),
          ]),
        ],
        "daughter",
      ),
      n3: node([decide("no", "n4")], "heir"),
      n4: node([decide("draft", "n5")], "court"),
      n5: node(
        [
          decide("rule", "n6", [
            mark("ff_rule"),
            temper("stubborn"),
            trust("auh_ff", -1),
            lean("auh_ff", 1),
          ]),
          decide("shoulder", "n6", [
            mark("ff_pity"),
            temper("gentle"),
            trust("auh_ff", 1),
            lean("auh_ff", -1),
          ]),
        ],
        "heir",
      ),
      n6: node(
        [
          decide("walk", "n6b", [mark("beck_walks"), trust("auh_beck", 1)]),
          decide("sign", "n6b", [temper("cold")]),
        ],
        "beck",
      ),
      n6b: node([decide("hear", "n7")], "chief"),
      n7: node(
        [
          decide("ours", null, [mark("bosnia_right"), temper("arrogant")]),
          decide("debt", null, [mark("bosnia_fear"), temper("anxious")]),
        ],
        "minister",
      ),
    },
    "auh_pro_geneva_after",
  ),
  silent("auh_pro_geneva_after"),
  memoryScene(
    "auh_pro_summer",
    7,
    {
      young: "auh_karl",
      chief: "auh_conrad",
      count: "auh_berchtold",
      heir: "auh_ff",
      bolfras: "auh_bolfras",
      magyar: "auh_tisza",
      daughter: "auh_valerie",
      beck: "auh_beck",
      schratt: "auh_schratt",
    },
    "young",
    {
      n1: node([
        decide("teach", "n2", [mark("karl_taught"), trust("auh_karl", 1)]),
        decide("later", "n2", [mark("karl_later")]),
      ]),
      n2: node([decide("peace", "n3")], "chief"),
      n3: alone([
        decide("shut", "n4", [
          mark("conrad_shut"),
          temper("cold"),
          trust("auh_conrad", -1),
          lean("auh_conrad", 1),
        ]),
        decide("door", "n4", [
          mark("conrad_door"),
          trust("auh_conrad", 1),
          lean("auh_conrad", -1),
        ]),
      ]),
      n4: node(
        [
          decide("duty", "n4b", [mark("ber_duty"), lean("auh_berchtold", 1)]),
          decide("believe", "n4b", [
            mark("ber_trust"),
            trust("auh_berchtold", 1),
            lean("auh_berchtold", -1),
          ]),
        ],
        "count",
      ),
      n4b: node([decide("back", "n4c")], "heir"),
      n4c: node(
        [
          decide("plan", "n5", [mark("redl_plan")]),
          decide("table", "n5", [
            mark("redl_table"),
            temper("anxious"),
            trust("auh_conrad", -1),
          ]),
        ],
        "bolfras",
      ),
      n5: reading(
        [
          { id: "true", when: held("oath_true") },
          { id: "price", when: held("oath_price") },
        ],
        [decide("sign", "n6")],
        "magyar",
      ),
      n6: node([decide("papers", "n7")], "daughter"),
      n7: node(
        [
          decide("seated", "n7b", [mark("ff_seated")]),
          decide("to_door", "n7b", [mark("ff_door"), trust("auh_ff", 1)]),
        ],
        "heir",
      ),
      n7b: node([decide("good", "n8")], "count"),
      n8: node([decide("enemies", "n9")], "beck"),
      n9: node([decide("fear", "n10")], "beck"),
      n10: node([decide("enough", "n11")], "beck"),
      n11: node(
        [
          decide("no_war", "n12", [mark("want_peace"), temper("gentle")]),
          decide("whole", "n12", [mark("want_whole"), temper("stubborn")]),
          decide("done", "n12", [mark("want_rest"), temper("weary")]),
        ],
        "schratt",
      ),
      n12: alone([decide("pen", null)]),
    },
  ),
];

/** The emperor still sits: Karl's and the archduke's reigns remember nothing. */
const fj = not(any(flag("w_auh_karl"), flag("w_auh_ff_throne")));
/** The opening where the wire brings both deaths. */
const killed: GwCond = { kind: "opening", of: ["sarajevo"] };
const heirLives: GwCond = {
  kind: "opening",
  of: ["sarajevo_survived", "sarajevo_failed", "no_sarajevo"],
};
const berlinSigned = flag("f_auh_sign_berlin");
const conradSits: GwCond = {
  kind: "holder",
  office: "chief_of_staff",
  person: "auh_conrad",
};

/** Where the main story remembers it: variants laid over its scenes. */
export const AUH_ECHOES: readonly GwEcho[] = [
  // The wire, the funeral and the first papers.
  {
    scene: "auh_c_ischl_wire",
    id: "pro_door",
    when: all(held("ff_door"), killed),
  },
  {
    scene: "auh_c_ischl_wire",
    id: "pro_names",
    when: all(held("arad_names"), killed),
  },
  {
    scene: "auh_c_ischl_wire",
    id: "pro_curse",
    when: all(held("arad_law"), killed),
  },
  {
    scene: "auh_c_funeral",
    id: "pro_rule",
    when: all(held("ff_rule"), killed, not(memory("k_ber_funeral"))),
  },
  {
    scene: "auh_c_funeral",
    id: "pro_pity",
    when: all(held("ff_pity"), killed, not(memory("k_ber_funeral"))),
  },
  { scene: "auh_c_who_signs", id: "pro_true", when: held("oath_true") },
  { scene: "auh_c_who_signs", id: "pro_price", when: held("oath_price") },
  {
    scene: "auh_c_conrad_now",
    id: "pro_shut",
    when: all(held("conrad_shut"), conradSits),
  },
  {
    scene: "auh_c_conrad_now",
    id: "pro_door",
    when: all(held("conrad_door"), conradSits),
  },
  {
    scene: "auh_c_tisza_letter",
    id: "pro_oath",
    when: all(
      held("oath_true"),
      not(flag("f_auh_early_mob")),
      not(berlinSigned),
    ),
  },
  {
    scene: "auh_c_berlin_answer",
    id: "pro_need",
    when: all(
      held("berlin_need"),
      berlinSigned,
      not(flag("f_auh_berlin_term")),
    ),
  },
  {
    scene: "auh_c_berlin_answer",
    id: "pro_rudolf",
    when: all(
      held("rudolf_kept"),
      berlinSigned,
      not(flag("f_auh_berlin_term")),
    ),
  },
  {
    scene: "auh_c_war_russia",
    id: "pro_debt",
    when: all(held("russia_debt"), berlinSigned),
  },
  {
    scene: "auh_c_war_russia",
    id: "pro_shame",
    when: all(held("russia_shame"), berlinSigned),
  },
  // The big scenes.
  {
    scene: "auh_big_ischl",
    node: "n3",
    id: "pro_owed",
    when: held("benedek_owed"),
  },
  {
    scene: "auh_big_ischl",
    node: "n3",
    id: "pro_doubt",
    when: held("generals_doubt"),
  },
  {
    scene: "auh_big_ischl_signed",
    id: "pro_peace",
    when: all(held("want_peace"), not(flag("f_auh_tk_struck"))),
  },
  {
    scene: "auh_big_lemberg",
    node: "n4",
    id: "pro_mother",
    when: all(held("mother"), fj),
  },
  {
    scene: "auh_big_lemberg",
    node: "n6",
    id: "pro_used",
    when: all(
      held("benedek_used"),
      not(chose("auh_big_lemberg", "ask_germans")),
      fj,
    ),
  },
  {
    scene: "auh_big_trent",
    node: "n4",
    id: "pro_god",
    when: all(held("god"), fj),
  },
  { scene: "auh_big_last", node: "n4", id: "pro_youth", when: held("youth") },
  // The private lines.
  {
    scene: "auh_p_beck_wire",
    node: "wire",
    id: "pro_owed",
    when: held("benedek_owed"),
  },
  {
    scene: "auh_p_val_letter",
    node: "open",
    id: "pro_no",
    when: all(held("rudolf_no"), not(memory("auh_p_val_unsaid"))),
  },
  {
    scene: "auh_p_val_letter",
    node: "open",
    id: "pro_kept",
    when: all(held("rudolf_kept"), not(memory("auh_p_val_unsaid"))),
  },
  {
    scene: "auh_p_adl_word",
    node: "open",
    id: "pro_knew",
    when: held("word_knew"),
  },
  {
    scene: "auh_p_adl_word",
    node: "open",
    id: "pro_believed",
    when: held("word_believed"),
  },
  {
    scene: "auh_p_ber_race",
    node: "thrice",
    id: "pro_trust",
    when: held("ber_trust"),
  },
  {
    scene: "auh_p_ff_table",
    node: "angry",
    id: "pro_pity",
    when: all(held("ff_pity"), heirLives),
  },
  {
    scene: "auh_p_sch_ischl",
    node: "last",
    id: "pro_stayed",
    when: held("schratt_stayed"),
  },
  {
    scene: "auh_p_sch_ischl",
    node: "last",
    id: "pro_weary",
    when: all(rulerTemper("weary"), held("want_rest")),
  },
  {
    scene: "auh_life_crypt",
    id: "pro_sat",
    when: all(held("max_sat"), fj),
  },
  {
    scene: "auh_letter_n1",
    id: "pro_bosnia",
    when: all(
      held("bosnia_fear"),
      killed,
      character(role("other_ruler"), "principled"),
    ),
  },
  {
    scene: "auh_t_kra_crown",
    node: "open",
    id: "pro_regret",
    when: all(held("prague_regret"), fj),
  },
  {
    scene: "auh_p_beck_walk",
    node: "open",
    id: "pro_walk",
    when: held("beck_walks"),
  },
  {
    scene: "auh_p_beck_walk",
    node: "rail",
    id: "pro_table",
    when: held("redl_table"),
  },
  {
    scene: "auh_p_tis_may",
    node: "told",
    id: "pro_beside",
    when: held("sisi_beside"),
  },
  {
    scene: "auh_t_karl_xx",
    node: "open",
    id: "pro_taught",
    when: held("karl_taught"),
  },
];
