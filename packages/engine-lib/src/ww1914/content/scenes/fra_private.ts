import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReply,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  flag,
  memory,
  not,
  reason,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { period } from "./period";

/**
 * 「프랑스」, the President's private life (ww166 W9, plan §11.5). Seven lines
 * outside work, across the game: Henriette; his brother Lucien; the house at
 * Sampigny; his friend Barthou and Barthou's son; Barrès, the other Lorrainer
 * of the Académie; the diary he keeps every night; letters from the Meuse. Talks tagged `private` belong to the private
 * meeting; the rest come by themselves (a visit, a paper). Each line is
 * remembered by its own later scenes, and the prologue's choices come back
 * here through FRA_ECHOES (fra_prologue.ts).
 *
 * The player is Poincaré for the whole game, so nothing closes on a cabinet.
 * Henriette and Lucien are family: never in a file (GW_NO_FILE), never under
 * threat. Their first scene is a visit, since both are unlisted until then.
 * Data only; the text is in resources/ww1914/ko/FRA.private.json. Memory keys
 * start `m_fra_`, reasons `fra_p_`.
 */

// ---- Conditions ----

const war: GwCond = { kind: "at_war", tag: "DEU" };
const chapter = (min: number, max?: number): GwCond =>
  max === undefined ? { kind: "chapter", min } : { kind: "chapter", min, max };
const date = (from: string, to?: string): GwCond =>
  world({ is: "date", from, ...(to === undefined ? {} : { to }) });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const m = (key: string): GwCond => memory(`m_fra_${key}`);
/** The war is over, or nearly: an armistice, or its month. */
const over: GwCond = any(world({ is: "armistice" }), date("1918-11"));
const tiger = flag("f_pm_clemenceau");
/** Ashore: the crisis weeks before the voyage, or from the return to autumn. */
const ashore: GwCond = any(chapter(0, 2), chapter(5, 9));
const henSeen = seen("fra_p_hen_letter");

// ---- Effects ----

const rem = (key: string): GwEffect => remember(`m_fra_${key}`);
const why = (key: string): GwEffect => reason(`fra_p_${key}`);
const pt = (delta: number): GwEffect => trustOf(role("p"), delta);

// ---- Shapes ----

const v = (id: string, c?: GwCond): GwVariant =>
  c === undefined ? { id } : { id, when: c };
const r = (
  id: string,
  stance: GwReply["stance"],
  kind: GwReply["kind"],
  next: string | null,
  effects: GwEffect[] = [],
): GwReply => ({ id, stance, kind, tell: [], effects, next });
/** The last word of a talk. */
const bye = (
  id: string,
  stance: GwReply["stance"],
  ...effects: GwEffect[]
): GwReply => r(id, stance, "leave", null, effects);
/** A node: its replies, then the lines that read the past (base last). */
const node = (replies: GwReply[], ...says: GwVariant[]): GwNode => ({
  says: [...says, { id: "base" }],
  replies,
});
const opt = (id: string, ...effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});

const PRIVATE: GwScene["tags"] = ["people", "private", "tension_down"];

/** The player goes to them: on the private meeting's list. */
const talk = (
  id: string,
  person: string,
  c: GwCond,
  nodes: Record<string, GwNode>,
  x: Partial<GwScene> = {},
): GwScene => ({
  id: `fra_p_${id}`,
  nation: ["FRA"],
  kind: "talk",
  when: c,
  cast: { p: { person } },
  salience: 3,
  tags: PRIVATE,
  once: true,
  summon: true,
  who: "p",
  variants: [{ id: "base" }],
  start: "open",
  nodes,
  ...x,
});
/** They come: the desk deals it. */
const visit = (
  id: string,
  person: string,
  c: GwCond,
  salience: number,
  nodes: Record<string, GwNode>,
  x: Partial<GwScene> = {},
): GwScene => talk(id, person, c, nodes, { salience, summon: false, ...x });
/** A paper of his own: the diary, a letter, a report on the house. */
const paper = (
  id: string,
  c: GwCond,
  salience: number,
  options: GwOption[],
  variants: GwVariant[] = [{ id: "base" }],
): GwScene => ({
  id: `fra_p_${id}`,
  nation: ["FRA"],
  kind: "proposal",
  when: c,
  cast: {},
  salience,
  tags: ["private", "tension_down"],
  once: true,
  noBack: true,
  variants,
  fallback: options[0].id,
  options,
});

const HEN = "fra_henriette";
const LUC = "fra_lucien";
const BAR = "fra_barthou";

// ---- 1. 앙리에트 ----

const HENRIETTE: readonly GwScene[] = [
  visit("hen_letter", HEN, ashore, 5, {
    open: node(
      [
        r("burn", "warm", "deal", "burned", [rem("hen_burned"), pt(1)]),
        r("police", "cold", "push", "police", [rem("hen_police")]),
        r("read", "frank", "ask", "read"),
      ],
      v("war", war),
    ),
    read: node([
      bye("burn_now", "warm", rem("hen_burned"), pt(1)),
      bye("keep_it", "cold", rem("hen_kept")),
    ]),
    burned: node([bye("end", "warm")]),
    police: node([bye("end", "cold", pt(-1))]),
  }),
  visit("hen_paris", HEN, all(war, chapter(6, 7)), 5, {
    open: node([
      bye("with_me", "warm", rem("hen_with"), pt(1)),
      bye("she_stays", "frank", rem("hen_stays")),
      bye("not_yet", "cold"),
    ]),
  }),
  talk("hen_rooms", HEN, all(war, period("14"), henSeen), {
    open: node(
      [
        r("all_rooms", "warm", "deal", "yes", [
          rem("hen_rooms"),
          why("hen_rooms"),
          pt(1),
        ]),
        r("two_rooms", "frank", "deal", "yes", [rem("hen_rooms_few")]),
        r("ask_pm", "cold", "ask", "pm"),
      ],
      v("police", m("hen_police")),
      v("stays", m("hen_stays")),
    ),
    yes: node([bye("end", "warm")]),
    pm: node([
      bye("then_yes", "warm", rem("hen_rooms_few")),
      bye("wait", "cold", pt(-1)),
    ]),
  }),
  talk("hen_godson", HEN, all(war, period("15a", "16a"), henSeen), {
    open: node(
      [
        r("read_it", "warm", "ask", "letter"),
        bye("sign_only", "frank", rem("hen_signed")),
        bye("not_mine", "cold", pt(-1)),
      ],
      v("rooms", m("hen_rooms")),
    ),
    letter: node([
      bye("write_self", "warm", rem("hen_wrote"), pt(1)),
      bye("sign", "frank", rem("hen_signed")),
    ]),
  }),
  visit("hen_noel", HEN, all(war, date("1915-11", "1916-01")), 4, {
    open: node(
      [
        bye("go_with", "warm", rem("hen_thann"), why("hen_thann"), pt(1)),
        bye("she_goes", "frank", rem("hen_alone")),
        bye("by_army", "cold", rem("hen_army")),
      ],
      v("wrote", m("hen_wrote")),
    ),
  }),
  talk("hen_nieces", HEN, all(war, period("15b", "17a"), henSeen), {
    open: node([
      r("let_her", "warm", "deal", "bar", [rem("hen_niece_bar"), pt(1)]),
      r("paris", "frank", "deal", "paris", [rem("hen_niece_paris")]),
      r("her_mother", "cold", "ask", "mother"),
    ]),
    bar: node([bye("end", "warm")]),
    paris: node([bye("end", "frank")]),
    mother: node([
      bye("then_bar", "warm", rem("hen_niece_bar")),
      bye("then_paris", "frank", rem("hen_niece_paris")),
    ]),
  }),
  talk("hen_front", HEN, all(war, period("16a", "16b"), henSeen), {
    open: node(
      [
        r("come", "warm", "deal", "coif", [pt(1)]),
        bye("hospitals", "frank", rem("hen_hospitals")),
        bye("stay", "cold", rem("hen_stayed"), pt(-1)),
      ],
      v("thann", m("hen_thann")),
    ),
    coif: node([
      bye("coif", "warm", rem("hen_came")),
      bye("plain", "frank", rem("hen_came")),
    ]),
  }),
  visit("hen_garden", HEN, all(war, date("1917-03", "1917-10")), 4, {
    open: node([
      bye("bar_it", "cold", rem("hen_censored")),
      bye("laugh", "warm", rem("hen_laughed"), pt(1)),
      r("ask_her", "frank", "ask", "her"),
    ]),
    her: node([
      bye("her_way", "warm", rem("hen_laughed")),
      bye("still_bar", "cold", rem("hen_censored")),
    ]),
  }),
  visit("hen_end", HEN, over, 6, {
    open: node(
      [
        r("count", "warm", "ask", "count"),
        bye("to_clos", "frank", rem("hen_clos")),
        bye("rest", "warm"),
      ],
      v("came", m("hen_came")),
      v("stayed", m("hen_stayed")),
      v("hospitals", m("hen_hospitals")),
    ),
    count: node([
      bye("answer_all", "warm", rem("hen_answer")),
      bye("end", "warm"),
    ]),
  }),
];

// ---- 2. 뤼시앵 ----

const LUCIEN: readonly GwScene[] = [
  visit("luc_wireless", LUC, ashore, 4, {
    open: node(
      [r("how_far", "frank", "ask", "far"), bye("dinner", "warm")],
      v("back", chapter(5)),
    ),
    far: node([
      bye("thank", "warm", rem("luc_wireless"), pt(1)),
      bye("enough", "cold"),
    ]),
  }),
  talk("luc_schools", LUC, all(war, period("14"), seen("fra_p_luc_wireless")), {
    open: node(
      [
        bye("exams", "frank", rem("luc_exams")),
        bye("close", "cold", rem("luc_closed")),
        bye("your_call", "warm", rem("luc_free"), pt(1)),
      ],
      v("wireless", m("luc_wireless")),
    ),
  }),
  visit(
    "luc_henri",
    LUC,
    all(date("1915-07", "1915-08"), seen("fra_p_luc_wireless")),
    3,
    {
      open: node([
        r("remember", "warm", "ask", "his"),
        bye("work", "cold", pt(-1)),
      ]),
      his: node([
        bye("more", "warm", rem("luc_henri"), pt(1)),
        bye("end", "frank"),
      ]),
    },
  ),
  talk(
    "luc_rector",
    LUC,
    all(date("1917-01", "1917-12"), seen("fra_p_luc_wireless")),
    {
      open: node(
        [
          bye("take_it", "warm", rem("luc_rector"), pt(1)),
          bye("minister", "cold", rem("luc_minister")),
          bye("wait", "frank", rem("luc_waited"), pt(-1)),
        ],
        v("free", m("luc_free")),
      ),
    },
  ),
  visit(
    "luc_gun",
    LUC,
    all(war, period("18a"), seen("fra_p_luc_wireless")),
    5,
    {
      open: node(
        [
          bye("keep_open", "frank", rem("luc_open")),
          bye("cellars", "warm", rem("luc_cellars")),
          bye("south", "cold", rem("luc_south")),
        ],
        v("rector", m("luc_rector")),
        v("henri", m("luc_henri")),
      ),
    },
  ),
];

// ---- 3. 상피니의 집 ----

const CLOS: readonly GwScene[] = [
  visit("clos_august", HEN, ashore, 3, {
    open: node(
      [
        bye("plan", "warm", rem("clos_august"), pt(1)),
        bye("after_russia", "frank", rem("clos_late")),
        bye("not_this_year", "cold", pt(-1)),
      ],
      v("late", chapter(5)),
    ),
  }),
  paper(
    "clos_shelled",
    all(war, date("1914-10", "1915-03")),
    6,
    [
      opt("say_nothing", rem("clos_silent")),
      opt("let_print", rem("clos_printed"), why("clos_printed")),
      opt("no_men", rem("clos_no_men"), why("clos_no_men")),
    ],
    [v("august", m("clos_august")), v("base")],
  ),
  paper(
    "clos_ruin",
    all(war, period("15a", "16b"), seen("fra_p_clos_shelled")),
    4,
    [
      opt("stop", rem("clos_saw")),
      opt("drive_on", rem("clos_passed")),
      opt("take_tile", rem("clos_saw"), rem("clos_tile")),
    ],
    [v("no_men", m("clos_no_men")), v("base")],
  ),
  visit("clos_after", HEN, all(over, seen("fra_p_clos_shelled")), 4, {
    open: node(
      [
        bye("village_first", "warm", rem("clos_village"), pt(1)),
        bye("rebuild", "frank", rem("clos_rebuild")),
        bye("let_it_be", "cold"),
      ],
      v("tile", m("clos_tile")),
      v("saw", m("clos_saw")),
      v("passed", m("clos_passed")),
    ),
  }),
];

// ---- 4. 바르투와 아들 ----

const BARTHOU: readonly GwScene[] = [
  talk("bar_max", BAR, all(war, period("14")), {
    open: node([r("ask", "warm", "ask", "max"), bye("work", "frank")]),
    max: node([
      bye("come_back", "warm", rem("bar_max"), pt(1)),
      bye("proud", "frank", rem("bar_max")),
    ]),
  }),
  visit("bar_shell", BAR, all(war, date("1914-12", "1915-06")), 7, {
    open: node(
      [
        bye("go_to_him", "warm", rem("bar_went"), why("bar_went"), pt(2)),
        bye("write", "frank", rem("bar_wrote"), pt(1)),
        bye("send_hen", "frank", rem("bar_hen")),
      ],
      v("max", m("bar_max")),
    ),
  }),
  talk(
    "bar_books",
    BAR,
    all(war, period("15b", "17b"), seen("fra_p_bar_shell")),
    {
      open: node(
        [
          r("read_letters", "warm", "ask", "letters"),
          bye("give_work", "frank", rem("bar_work")),
          bye("leave", "cold", pt(-1)),
        ],
        v("went", m("bar_went")),
        v("wrote", m("bar_wrote")),
      ),
      letters: node([bye("end", "warm", rem("bar_read"), pt(1))]),
    },
  ),
];

// ---- 5. 바레스: 같은 로렌 사람 ----

const BAR_ = "fra_barres";

const BARRES: readonly GwScene[] = [
  talk("barres_metz", BAR_, ashore, {
    open: node([
      r("why_now", "frank", "ask", "why"),
      bye("no_word", "cold", rem("barres_quiet"), pt(-1)),
      bye("one_line", "warm", rem("barres_line"), pt(1)),
    ]),
    why: node([
      bye("no_word2", "cold", rem("barres_quiet")),
      bye("one_line2", "warm", rem("barres_line"), pt(1)),
    ]),
  }),
  visit("barres_book", BAR_, all(war, period("15a", "16b")), 4, {
    open: node(
      [
        bye("sign", "warm", rem("barres_signed"), pt(1)),
        bye("own_words", "frank", rem("barres_own")),
        bye("decline", "cold", pt(-1)),
      ],
      v("quiet", m("barres_quiet")),
      v("line", m("barres_line")),
    ),
  }),
  visit("barres_end", BAR_, all(over, seen("fra_p_barres_metz")), 4, {
    open: node(
      [
        bye("together", "warm", rem("barres_together")),
        bye("dead_first", "frank", rem("barres_dead")),
        bye("no_speech", "cold"),
      ],
      v("signed", m("barres_signed")),
      v("own", m("barres_own")),
    ),
  }),
];

// ---- 6. 일기 ----

const DIARY: readonly GwScene[] = [
  paper("diary_first", all(war, chapter(5, 7)), 5, [
    opt("all_of_it", rem("diary_full")),
    opt("facts_only", rem("diary_facts")),
    opt("blank", rem("diary_blank")),
  ]),
  paper(
    "diary_generals",
    all(war, chapter(7, 10)),
    4,
    [
      opt("anger", rem("diary_anger")),
      opt("questions", rem("diary_questions")),
      opt("tear_out", rem("diary_torn")),
    ],
    [v("full", m("diary_full")), v("facts", m("diary_facts")), v("base")],
  ),
  paper(
    "diary_names",
    all(war, period("15b", "16b")),
    4,
    [
      opt("copy_names", rem("diary_names")),
      opt("count_only", rem("diary_count")),
      opt("close_book", rem("diary_closed")),
    ],
    [v("relief", m("meuse_relief")), v("base")],
  ),
  paper(
    "diary_tiger",
    all(tiger, war),
    5,
    [
      opt("fair", rem("diary_fair")),
      opt("bitter", rem("diary_bitter")),
      opt("nothing", rem("diary_silent")),
    ],
    [v("anger", m("diary_anger")), v("base")],
  ),
  paper(
    "diary_last",
    over,
    6,
    [
      opt("keep_all", rem("diary_kept")),
      opt("cut", rem("diary_cut")),
      opt("to_lucien", rem("diary_lucien")),
    ],
    [
      v("bitter", m("diary_bitter")),
      v("names", m("diary_names")),
      v("blank", all(m("diary_blank"), not(m("diary_names")))),
      v("base"),
    ],
  ),
];

// ---- 7. 뫼즈 ----

const MEUSE: readonly GwScene[] = [
  paper("meuse_mother", ashore, 3, [
    opt("carry", rem("meuse_beads")),
    opt("to_lucien", rem("meuse_beads_lucien")),
    opt("drawer"),
  ]),
  paper(
    "meuse_letters",
    all(war, period("14", "15a")),
    5,
    [
      opt("answer_each", rem("meuse_answered")),
      opt("relief", rem("meuse_relief"), why("meuse_relief")),
      opt("prefect", rem("meuse_prefect")),
    ],
    [v("beads", m("meuse_beads")), v("base")],
  ),
];

export const FRA_PRIVATE_SCENES: readonly GwScene[] = [
  ...HENRIETTE,
  ...LUCIEN,
  ...CLOS,
  ...BARTHOU,
  ...BARRES,
  ...DIARY,
  ...MEUSE,
];

// ---- The people only these lines need ----

/**
 * Family: no desk, no camp, never in a file. Seen on the people screen only
 * once they have come up. Appended after every other list: order matters to
 * the seed rolls. Names in FRA.people.json, so that every seat can read them.
 */
export const FRA_PRIVATE_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "fra_henriette",
    tag: "FRA",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["stubborn", "anxious"],
    rivals: [],
    allies: [],
    unlisted: true,
    fame: 2,
    source:
      "Henriette Adeline Benucci, b. 8 May 1858, Passy; natural daughter of Raphaël Benucci, an Italian-born coachman, legitimised 14 Jul 1863; convent school; m. Dominic Killoran 3 Feb 1883, divorced 30 Apr 1890; m. Arthur Bazire 24 Jun 1891, widowed 16 May 1892; a salon; Poincaré's companion from 1901, civil marriage 17 Aug 1904; church wedding in secret 5 May 1913 at 10 rue de Babylone by Mgr Baudrillart, once Killoran's death (1909) was proved; called 'sulfureuse' by the press; no children, raised three nieces; parcel workshops at the Élysée; a marraine de guerre with over 12,000 godsons by her husband's count; went with him on most journeys, at times in a regional coif; the 1917 orang-utan (or chimpanzee) in the Élysée garden, kept out of the press by the censor (fr.wikipedia Henriette Poincaré). What she says is invented",
  },
  {
    id: "fra_lucien",
    tag: "FRA",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["weary", "cold"],
    rivals: [],
    allies: [],
    unlisted: true,
    fame: 1,
    source:
      "Lucien Poincaré, b. 22 Jul 1862, Bar-le-Duc; École normale 1883-86 with Painlevé; physics; professor at Louis-le-Grand 1893; rector at Chambéry 1900; inspector general of public instruction 1902; director of secondary, then higher education from 1910; vice-rector of the Académie de Paris 1917 after Liard; 'L'Électricité' 1907, 4th ed. 1918; cousin of Henri Poincaré; d. 9 Mar 1920 (fr.wikipedia Lucien Poincaré). His talks are invented",
  },
];

/** How each of them talks. */
export const FRA_PRIVATE_VOICE_NOTES: Readonly<Record<string, string>> = {
  fra_henriette:
    "이탈리아계 마부의 딸, 파리의 살롱을 꾸린 여자. 빠르고 밝게 말하고 남의 흉을 웃으며 옮긴다. 남편을 사석에서 '레몽'이라 부르고 사람들 앞에서는 '대통령'이라 부른다. 해요체. 자기 지난 일 얘기가 나오면 먼저 꺼내 버린다. 일은 목록으로 말한다: 상자 몇 개, 편지 몇 통.",
  fra_lucien:
    "물리학자 동생. 형을 '형'이라 부르는 단 한 사람이다. 해요체. 설명하다 손으로 그림을 그린다. 숫자를 단위와 함께 말한다. 행정 일은 귀찮다고 하면서 꼼꼼히 한다. 사촌 앙리 이름이 나오면 말이 느려진다.",
};
