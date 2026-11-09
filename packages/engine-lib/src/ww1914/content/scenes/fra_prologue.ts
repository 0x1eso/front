// France's prologue: Poincaré's earlier life as memories, and where the main
// story remembers them (echoes). Text in resources/ww1914/ko/FRA.prologue.json.
// Lane W9 (ww166-format.md); shape: /home/eser/dev/ww154-format.md.
//
// Seven scenes, the requisitioned house at Bar-le-Duc to the morning of
// Longchamp. The thread: a Lorraine boy who learned to keep the paper, and a
// President who has the paper and little else. History stays as it was; the
// choices are how he took it. The echoes land on his private life
// (fra_private.ts), the part of the main story that is his own, and, since the
// merge, on the crisis, the opening and the consultations where they belong.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  byName,
  chose,
  decide,
  flag,
  type GwCond,
  type GwEcho,
  type GwNode,
  type GwReply,
  type GwScene,
  type GwVariant,
  not,
  past,
  rivalLean,
  setFlag,
  startRuler,
  temper,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";

const NATION: GwTag[] = ["FRA"];
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

const v = (id: string, when: GwCond): GwVariant => ({ id, when });

const CLEMENCEAU = byName("fra_clemenceau");
const JOFFRE = byName("fra_joffre");
const CAILLAUX = byName("fra_caillaux");
const BRIAND = byName("fra_briand");
const MALVY = byName("fra_malvy");
const BARTHOU = byName("fra_barthou");
const JAURES = byName("fra_jaures");
const VIVIANI = byName("fra_viviani");
const RIBOT = byName("fra_ribot");
const BARRES = byName("fra_barres");
const LUCIEN = byName("fra_lucien");
const HENRIETTE = byName("fra_henriette");
const MESSIMY = byName("fra_messimy");

export const FRA_PROLOGUE_SCENES: readonly GwScene[] = [
  // 1. 1870-71: the requisitioned house and the dog called Bismarck.
  memory(
    "fra_pro_bismarck",
    1,
    {
      father: past("fra_p_antoni"),
      mother: past("fra_p_nanine"),
      grandfather: past("fra_p_ficatier"),
    },
    "father",
    {
      n1: lone([decide("stairs", "n2")]),
      n2: by("father", [
        decide("receipts", "n3", [setFlag("pro_fra_receipts")]),
        decide("why_ours", "n3"),
      ]),
      n3: lone([decide("listen", "n4")]),
      n4: by("mother", [
        decide("pray", "n5", [temper("gentle"), startRuler("conscience", 1)]),
        decide("faces", "n5", [temper("cold")]),
      ]),
      n5: by("grandfather", [
        decide("notebook", null, [
          setFlag("pro_fra_notebook"),
          temper("cold"),
          startRuler("reputation", 1),
        ]),
        decide("call_dog", null, [
          setFlag("pro_fra_dog"),
          temper("stubborn"),
          trustOf(BARRES, 1),
          startRuler("health", 1),
        ]),
        decide("say_nothing", null, [
          setFlag("pro_fra_kept_quiet"),
          temper("anxious"),
          startRuler("family", 1),
        ]),
      ]),
    },
  ),
  card("fra_pro_bismarck_after", [
    v("notebook", flag("pro_fra_notebook")),
    v("dog", flag("pro_fra_dog")),
    { id: "base" },
  ]),

  // 2. 1893: the youngest minister, his brother the physics master.
  memory(
    "fra_pro_robe",
    2,
    {
      dupuy: past("fra_p_dupuy"),
      lucien: past("fra_lucien"),
      barthou: past("fra_barthou"),
    },
    "dupuy",
    {
      n1: lone([decide("open_note", "n2")]),
      n2: by("dupuy", [decide("one_day", "n3")]),
      n3: by("lucien", [
        decide("teachers", "n4", [
          setFlag("pro_fra_teachers"),
          trustOf(LUCIEN, 1),
          temper("gentle"),
        ]),
        decide("texts", "n4", [setFlag("pro_fra_texts"), temper("cold")]),
      ]),
      n4: by("barthou", [
        decide("friends", "n5", [
          setFlag("pro_fra_barthou_friend"),
          trustOf(BARTHOU, 1),
        ]),
        decide("one_chair", "n5", [
          setFlag("pro_fra_barthou_chair"),
          temper("cunning"),
        ]),
      ]),
      n5: lone([
        decide("yes_now", null, [
          setFlag("pro_fra_yes_now"),
          temper("arrogant"),
          startRuler("reputation", 1),
        ]),
        decide("yes_terms", null, [
          setFlag("pro_fra_yes_terms"),
          temper("cold"),
          startRuler("conscience", 1),
        ]),
        decide("keep_robe", null, [
          setFlag("pro_fra_robe_kept"),
          temper("cunning"),
          startRuler("family", 1),
        ]),
      ]),
    },
  ),
  card("fra_pro_robe_after"),

  // 3. 1894 and 1898: in the room when Dreyfus was condemned, late to say so.
  memory(
    "fra_pro_dreyfus",
    3,
    {
      jaures: past("fra_jaures"),
      clemenceau: past("fra_clemenceau"),
    },
    "jaures",
    {
      n1: lone([decide("ask_nothing", "n2")]),
      n2: lone([decide("read_on", "n3")]),
      n3: by("jaures", [
        decide("procedure", "n4", [trustOf(JAURES, 1)]),
        decide("judged", "n4", [trustOf(JAURES, -1), temper("stubborn")]),
      ]),
      n4: lone([
        decide("own_room", "n5", [
          setFlag("pro_fra_dreyfus_owned"),
          rivalLean(CLEMENCEAU, -1),
          temper("gentle"),
          startRuler("conscience", 1),
        ]),
        decide("law_only", "n5", [
          setFlag("pro_fra_dreyfus_law"),
          rivalLean(CLEMENCEAU, 1),
          temper("cold"),
          startRuler("reputation", 1),
        ]),
        decide("too_late", "n5", [
          setFlag("pro_fra_dreyfus_late"),
          temper("anxious"),
          startRuler("conscience", -1),
        ]),
      ]),
      n5: by(
        "clemenceau",
        [
          decide("answer_back", null, [
            trustOf(CLEMENCEAU, -1),
            rivalLean(CLEMENCEAU, 1),
          ]),
          decide("let_him", null, [temper("weary")]),
        ],
        [
          v("owned", flag("pro_fra_dreyfus_owned")),
          v("late", flag("pro_fra_dreyfus_late")),
          ...b,
        ],
      ),
    },
  ),
  card("fra_pro_dreyfus_after", [
    v("owned", flag("pro_fra_dreyfus_owned")),
    v("late", flag("pro_fra_dreyfus_late")),
    { id: "base" },
  ]),

  // 4. 1912: Caillaux falls, cousin Henri dies, the Tsar's table.
  memory(
    "fra_pro_neva",
    4,
    {
      caillaux: past("fra_caillaux"),
      lucien: past("fra_lucien"),
      sazonov: past("rus_sazonov"),
      tsar: past("rus_nicholas"),
    },
    "caillaux",
    {
      n1: by("caillaux", [
        decide("his_numbers", "n2", [
          trustOf(CAILLAUX, 1),
          rivalLean(CAILLAUX, -1),
        ]),
        decide("his_talks", "n2", [
          setFlag("pro_fra_caillaux_asked"),
          trustOf(CAILLAUX, -1),
          rivalLean(CAILLAUX, 1),
          temper("cold"),
        ]),
      ]),
      n2: by("lucien", [
        decide("pack_bags", "n3", [temper("cold")]),
        decide("stay_day", "n3", [
          setFlag("pro_fra_henri_day"),
          trustOf(LUCIEN, 1),
          startRuler("family", 1),
        ]),
      ]),
      n3: by("sazonov", [
        decide("name_it", "n4", [temper("cold")]),
        decide("ask_word", "n4", [temper("stubborn")]),
      ]),
      n4: by("tsar", [
        decide("all_of_it", "n5", [
          setFlag("pro_fra_alliance_all"),
          temper("stubborn"),
        ]),
        decide("free_hand", "n5", [
          setFlag("pro_fra_alliance_free"),
          temper("cunning"),
        ]),
      ]),
      n5: lone([decide("home", null)]),
    },
  ),
  card("fra_pro_neva_after"),

  // 5. January 1913: Versailles, against Pams and Clemenceau's wish.
  memory(
    "fra_pro_versailles",
    5,
    {
      clemenceau: past("fra_clemenceau"),
      briand: past("fra_briand"),
      henriette: past("fra_henriette"),
    },
    "clemenceau",
    {
      n1: lone([decide("count_again", "n2")]),
      n2: by("clemenceau", [
        decide("one_line", "n3", [
          setFlag("pro_fra_clem_one_line"),
          trustOf(CLEMENCEAU, -1),
          rivalLean(CLEMENCEAU, 1),
          temper("stubborn"),
        ]),
        decide("by_article", "n3", [
          setFlag("pro_fra_clem_articles"),
          temper("cold"),
        ]),
      ]),
      n3: by("briand", [
        decide("all_votes", "n4", [trustOf(BRIAND, 1), rivalLean(BRIAND, -1)]),
        decide("left_first", "n4", [rivalLean(BRIAND, 1)]),
      ]),
      n4: lone([decide("stand_up", "n5")]),
      n5: by("henriette", [
        decide("shield", null, [
          setFlag("pro_fra_hen_shield"),
          trustOf(HENRIETTE, 1),
          temper("stubborn"),
          startRuler("family", 1),
        ]),
        decide("step_back", null, [
          setFlag("pro_fra_hen_back"),
          trustOf(HENRIETTE, -1),
          temper("cold"),
          startRuler("reputation", 1),
        ]),
        decide("together", null, [
          setFlag("pro_fra_hen_together"),
          temper("gentle"),
          startRuler("family", 1),
        ]),
      ]),
    },
  ),
  card("fra_pro_versailles_after", [
    v("line", flag("pro_fra_clem_one_line")),
    { id: "base" },
  ]),

  // 6. 1913: the wedding no paper knew of, and the three-year law.
  memory(
    "fra_pro_babylone",
    6,
    {
      priest: past("fra_p_baudrillart"),
      henriette: past("fra_henriette"),
      joffre: past("fra_joffre"),
      barthou: past("fra_barthou"),
    },
    "priest",
    {
      n1: lone([decide("dress", "n2")]),
      n2: by("priest", [
        decide("thank", "n3"),
        decide("no_record", "n3", [
          setFlag("pro_fra_wedding_hidden"),
          temper("cunning"),
        ]),
      ]),
      n3: by(
        "henriette",
        [
          decide("past_is_past", "n4", [
            trustOf(HENRIETTE, 1),
            temper("gentle"),
          ]),
          decide("hold_hand", "n4", [startRuler("family", 1)]),
        ],
        [
          v("back", flag("pro_fra_hen_back")),
          v("shield", flag("pro_fra_hen_shield")),
          ...b,
        ],
      ),
      n4: by("joffre", [
        decide("his_numbers", "n5", [trustOf(JOFFRE, 1), rivalLean(JOFFRE, 1)]),
        decide("in_writing", "n5", [rivalLean(JOFFRE, -1), temper("cold")]),
      ]),
      n5: lone([decide("read_speech", "n6")]),
      n6: by("barthou", [
        decide("mine_too", null, [
          setFlag("pro_fra_law_mine"),
          trustOf(BARTHOU, 1),
          trustOf(JAURES, -1),
          temper("stubborn"),
          startRuler("reputation", 1),
        ]),
        decide("yours", null, [setFlag("pro_fra_law_his"), temper("cunning")]),
        decide("a_price", null, [
          setFlag("pro_fra_law_price"),
          trustOf(JAURES, 1),
          temper("weary"),
          startRuler("conscience", 1),
        ]),
      ]),
    },
  ),
  card("fra_pro_babylone_after"),

  // 7. June 1914: two cabinets in five days, then the Sunday of the races.
  memory(
    "fra_pro_june",
    7,
    {
      ribot: past("fra_ribot"),
      viviani: past("fra_viviani"),
      messimy: past("fra_messimy"),
      henriette: past("fra_henriette"),
    },
    "henriette",
    {
      n1: by("ribot", [
        decide("thank_him", "n2", [trustOf(RIBOT, 1)]),
        decide("who_next", "n2"),
      ]),
      n2: by("viviani", [
        decide("bind_law", "n2b", [
          setFlag("pro_fra_viv_bound"),
          trustOf(VIVIANI, -1),
          temper("cold"),
        ]),
        decide("trust_him", "n2b", [
          setFlag("pro_fra_viv_trusted"),
          trustOf(VIVIANI, 1),
        ]),
      ]),
      n2b: by("messimy", [
        decide("trains", "n3", [trustOf(MESSIMY, 1)]),
        decide("slow_down", "n3", [trustOf(MESSIMY, -1), temper("cold")]),
      ]),
      n3: lone([decide("to_sunday", "n4")]),
      n4: by("henriette", [
        decide("fear_germany", "n4b", [
          setFlag("pro_fra_fear_germany"),
          temper("stubborn"),
        ]),
        decide("fear_chamber", "n4b", [
          setFlag("pro_fra_fear_chamber"),
          temper("anxious"),
        ]),
        decide("fear_hands", "n4b", [
          setFlag("pro_fra_fear_hands"),
          temper("weary"),
        ]),
      ]),
      n4b: by("henriette", [
        decide("watch_clemenceau", "n5", [rivalLean(CLEMENCEAU, 1)]),
        decide("watch_joffre", "n5", [rivalLean(JOFFRE, 1)]),
        decide("watch_caillaux", "n5", [rivalLean(CAILLAUX, 1)]),
        decide("watch_briand", "n5", [rivalLean(BRIAND, 1)]),
        decide("watch_malvy", "n5", [rivalLean(MALVY, 1)]),
        decide("watch_nobody", "n5", [temper("arrogant")]),
      ]),
      n5: lone([decide("to_longchamp", null)]),
    },
    false,
  ),
];

/** Longchamp's telegram as it came: none of its other openings. */
const sarajevoAsItWas: GwCond = not({
  kind: "opening",
  of: [
    "sarajevo_survived",
    "sarajevo_failed",
    "sarajevo_delayed",
    "no_sarajevo",
  ],
});
const balkanCrisis: GwCond = { kind: "crisis", topic: "balkan" };

/** Where the main story remembers it: his private life, then the crisis. */
export const FRA_ECHOES: readonly GwEcho[] = [
  // Bar-le-Duc, 1870.
  {
    scene: "fra_p_diary_first",
    id: "pro_notebook",
    when: flag("pro_fra_notebook"),
  },
  { scene: "fra_p_clos_shelled", id: "pro_dog", when: flag("pro_fra_dog") },
  {
    scene: "fra_p_clos_shelled",
    id: "pro_quiet",
    when: flag("pro_fra_kept_quiet"),
  },
  {
    scene: "fra_p_meuse_letters",
    id: "pro_receipts",
    when: flag("pro_fra_receipts"),
  },
  // The robe, 1893.
  {
    scene: "fra_p_luc_schools",
    node: "open",
    id: "pro_teachers",
    when: flag("pro_fra_teachers"),
  },
  {
    scene: "fra_p_luc_schools",
    node: "open",
    id: "pro_texts",
    when: flag("pro_fra_texts"),
  },
  {
    scene: "fra_p_bar_shell",
    node: "open",
    id: "pro_friend",
    when: flag("pro_fra_barthou_friend"),
  },
  {
    scene: "fra_p_bar_shell",
    node: "open",
    id: "pro_chair",
    when: flag("pro_fra_barthou_chair"),
  },
  // Dreyfus.
  {
    scene: "fra_p_diary_tiger",
    id: "pro_law",
    when: flag("pro_fra_dreyfus_law"),
  },
  // 1912.
  {
    scene: "fra_p_luc_henri",
    node: "open",
    id: "pro_day",
    when: chose("fra_pro_neva", "stay_day"),
  },
  // Versailles.
  {
    scene: "fra_p_hen_letter",
    node: "open",
    id: "pro_shield",
    when: flag("pro_fra_hen_shield"),
  },
  {
    scene: "fra_p_hen_letter",
    node: "open",
    id: "pro_back",
    when: flag("pro_fra_hen_back"),
  },
  {
    scene: "fra_p_hen_letter",
    node: "open",
    id: "pro_together",
    when: flag("pro_fra_hen_together"),
  },
  {
    scene: "fra_p_hen_front",
    node: "open",
    id: "pro_back",
    when: flag("pro_fra_hen_back"),
  },
  // Babylone.
  {
    scene: "fra_p_hen_end",
    node: "open",
    id: "pro_hidden",
    when: flag("pro_fra_wedding_hidden"),
  },
  {
    scene: "fra_p_bar_books",
    node: "open",
    id: "pro_law",
    when: flag("pro_fra_law_mine"),
  },
  // June 1914.
  {
    scene: "fra_p_diary_first",
    id: "pro_hands",
    when: flag("pro_fra_fear_hands"),
  },
  {
    scene: "fra_p_diary_last",
    id: "pro_germany",
    when: flag("pro_fra_fear_germany"),
  },
  // On the main story (merge lane): Longchamp's own telegram only, the sea
  // while the crisis runs, Viviani's first evening, the three-year law and the
  // night of the consultations.
  ...(["hands", "germany", "chamber"] as const).map(
    (f): GwEcho => ({
      scene: "fra_c_longchamp",
      id: `pro_${f}`,
      when: all(flag(`pro_fra_fear_${f}`), sarajevoAsItWas),
    }),
  ),
  {
    scene: "fra_big_sea",
    node: "n2",
    id: "pro_all",
    when: all(flag("pro_fra_alliance_all"), balkanCrisis),
  },
  {
    scene: "fra_big_sea",
    node: "n2",
    id: "pro_free",
    when: all(flag("pro_fra_alliance_free"), balkanCrisis),
  },
  {
    scene: "fra_o_first",
    node: "n2",
    id: "pro_bound",
    when: flag("pro_fra_viv_bound"),
  },
  {
    scene: "fra_o_first",
    node: "n2",
    id: "pro_trusted",
    when: flag("pro_fra_viv_trusted"),
  },
  ...(["mine", "his", "price"] as const).map(
    (f): GwEcho => ({
      scene: "fra_c_three_years",
      id: `pro_law_${f}`,
      when: flag(`pro_fra_law_${f}`),
    }),
  ),
  {
    scene: "fra_big_tiger",
    node: "n4",
    id: "pro_line",
    when: flag("pro_fra_clem_one_line"),
  },
  {
    scene: "fra_big_tiger",
    node: "n4",
    id: "pro_owned",
    when: flag("pro_fra_dreyfus_owned"),
  },
  {
    scene: "fra_big_tiger",
    node: "n4",
    id: "pro_late",
    when: flag("pro_fra_dreyfus_late"),
  },
];
