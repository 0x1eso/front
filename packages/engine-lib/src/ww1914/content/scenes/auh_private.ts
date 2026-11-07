import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCond,
  GwEffect,
  GwNode,
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
  promise,
  reason,
  remember,
  role,
  schedule,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { period } from "./period";

/**
 * 「오스트리아-헝가리」, time outside work (ww143): ten story lines of the Emperor's
 * circle, each a person or a pair, four to six scenes across the game. A line
 * has turns the player shapes, ends by state, and is remembered in the work
 * scenes (`withAuhPrivate`, the last table here). The old Emperor dies on a
 * seeded day, so nothing here waits for a date of his: a line's last scene
 * comes from the next reign, and reads what the old man did. Data only; the
 * text is in resources/ww1914/ko/AUH.private.json. Memory keys and reasons all
 * start `auh_p_`.
 */

// ---- The run's branches ----

const K = flag("w_auh_karl");
const FFT = flag("w_auh_ff_throne");
const FJ = not(any(K, FFT));
const REIGN = any(K, FFT);
const heirDead: GwCond = {
  kind: "opening",
  of: ["sarajevo", "sarajevo_delayed"],
};
const ffAlive: GwCond = {
  kind: "opening",
  of: ["sarajevo_survived", "sarajevo_failed", "no_sarajevo"],
};
const war = world({ is: "war" });
const date = (from: string, to?: string): GwCond =>
  world({ is: "date", from, ...(to === undefined ? {} : { to }) });
/** The new reign's first chapters, whoever came. */
const fresh = (within: number): GwCond =>
  any(
    { kind: "chose", scene: "auh_k_succession", within },
    { kind: "chose", scene: "auh_k_ff_throne", within },
  );
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const m = (key: string): GwCond => memory(`auh_p_${key}`);
const isCos = (person: string): GwCond => ({
  kind: "holder",
  office: "chief_of_staff",
  person,
});
const fmIs = (person: string): GwCond => ({
  kind: "holder",
  office: "foreign",
  person,
});
const conradAt = (r: { min?: number; max?: number }): GwCond => ({
  kind: "competence",
  who: { person: "auh_conrad" },
  field: "war",
  ...r,
});
const warmTo = (min: number): GwCond => ({
  kind: "person_trust",
  who: role("p"),
  min,
});
const coldTo = (max: number): GwCond => ({
  kind: "person_trust",
  who: role("p"),
  max,
});

// ---- Effects ----

const rem = (key: string): GwEffect => remember(`auh_p_${key}`);
const why = (key: string): GwEffect => reason(`auh_p_${key}`);
const pt = (delta: number, r = "p"): GwEffect => trustOf(role(r), delta);
const reveal = (id: "auh_rail_muddle"): GwEffect => ({
  kind: "maybe",
  when: { kind: "secret", id },
  then: [doWorld({ do: "reveal", id })],
});

// ---- Shapes ----

const v = (id: string, c?: GwCond): GwVariant =>
  c === undefined ? { id } : { id, when: c };
type ReplyExtra = Partial<
  Pick<GwReply, "when" | "tell" | "effects" | "reacts" | "gain" | "miss">
>;
const r = (
  id: string,
  stance: GwReply["stance"],
  kind: GwReply["kind"],
  next: string | null,
  x: ReplyExtra = {},
): GwReply => ({ id, stance, kind, tell: [], effects: [], next, ...x });
/** The last word of a talk: nothing more to say. */
const bye = (id: string, ...effects: GwEffect[]): GwReply =>
  r(id, "warm", "leave", null, { effects });
const node = (replies: GwReply[], ...says: GwVariant[]): GwNode => ({
  says: [...says, { id: "base" }],
  replies,
});
const PRIVATE: GwScene["tags"] = ["people", "private", "tension_down"];
/** The player goes to them: on the private meeting's list. */
const talk = (
  id: string,
  person: string,
  c: GwCond | undefined,
  nodes: Record<string, GwNode>,
  x: Partial<GwScene> = {},
): GwScene => ({
  id: `auh_p_${id}`,
  nation: ["AUH"],
  kind: "talk",
  ...(c === undefined ? {} : { when: c }),
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
/** It comes only because something earlier called it. */
const called = (
  id: string,
  person: string,
  nodes: Record<string, GwNode>,
  x: Partial<GwScene> = {},
): GwScene =>
  talk(id, person, undefined, nodes, {
    summon: false,
    scheduledOnly: true,
    ...x,
  });

// ---- 1. 슈라트: 서른 해의 아침 ----

const SCHRATT: readonly GwScene[] = [
  talk(
    "sch_ischl",
    "auh_schratt",
    all(FJ, period("c")),
    {
      open: node([
        r("theatre", "warm", "ask", "gossip"),
        r("last", "frank", "ask", "last"),
        bye("coffee"),
      ]),
      gossip: node([
        bye("chin", pt(1), rem("sch_laughed")),
        r("toni", "frank", "ask", "toni"),
      ]),
      toni: node([bye("nothing"), bye("called_up", rem("sch_toni"))]),
      last: node([bye("eat", pt(1))]),
    },
    { variants: [v("news", heirDead), v("base")] },
  ),
  talk("sch_kammer", "auh_schratt", all(FJ, war, period("14")), {
    open: node(
      [
        r("weekly", "warm", "deal", "promised", {
          effects: [
            rem("sch_kept"),
            promise(role("p"), "auh_p_sch_weekly", 8, {
              keep: seen("auh_p_sch_bread"),
              back: "auh_p_sch_line",
            }),
          ],
          tell: ["promise"],
        }),
        r("thin", "frank", "deal", "thin", { effects: [rem("sch_thin")] }),
        r("vienna", "warm", "ask", "vienna"),
      ],
      v("laughed", m("sch_laughed")),
    ),
    promised: node([bye("done")]),
    thin: node([bye("one_line", pt(1)), bye("no_line", pt(-1))]),
    vienna: node(
      [
        r("weekly2", "warm", "deal", "promised", {
          effects: [
            rem("sch_kept"),
            promise(role("p"), "auh_p_sch_weekly", 8, {
              keep: seen("auh_p_sch_bread"),
              back: "auh_p_sch_line",
            }),
          ],
          tell: ["promise"],
        }),
        bye("enough", rem("sch_thin")),
      ],
      v("lost", world({ is: "score", max: -10 })),
    ),
  }),
  talk("sch_bread", "auh_schratt", all(FJ, war, period("15a", "17a")), {
    open: node(
      [
        r("eat", "warm", "ask", "queue", { gain: [pt(1)] }),
        r("table", "frank", "deal", "queue", {
          effects: [rem("bread_table"), why("bread_table")],
        }),
        r("no_queue", "cold", "push", "stiff"),
      ],
      v("thin", m("sch_thin")),
    ),
    queue: node(
      [bye("she_is_right", pt(1)), r("who_said", "cold", "leave", null)],
      v("mine", { kind: "gauge", gauge: "order", max: 1 }),
    ),
    stiff: node([bye("sorry"), r("still", "cold", "leave", null)]),
  }),
  talk(
    "sch_ribbon",
    "auh_schratt",
    all(FJ, seen("auh_p_sch_bread"), date("1915-07")),
    {
      open: node([
        r("schlenther", "cold", "ask", "cool"),
        r("my_word", "frank", "ask", "word", { gain: [pt(1)] }),
        bye("leave_it"),
      ]),
      cool: node([r("my_word2", "frank", "ask", "word"), bye("leave_it2")]),
      word: node([
        r("why_back", "warm", "ask", "back", { effects: [rem("sch_asked")] }),
        r("wont_ask", "warm", "ask", "burn"),
      ]),
      back: node([r("the_letters", "warm", "ask", "burn")]),
      burn: node([bye("burn_them", rem("sch_burned")), bye("keep_them")]),
    },
  ),
  called("sch_line", "auh_schratt", {
    open: node([
      bye("four_oclock", pt(1), rem("sch_answered")),
      r("later", "cold", "leave", null, { effects: [rem("sch_silent")] }),
    ]),
  }),
  visit(
    "sch_roses",
    "auh_schratt",
    all(REIGN, fresh(3)),
    8,
    {
      open: node(
        [
          r("lead", "warm", "push", "bed", {
            tell: ["trust:-1"],
            effects: [rem("sch_led"), pt(-1, "mont")],
          }),
          r("side_door", "frank", "deal", "side", {
            effects: [rem("sch_side")],
          }),
          r("rule", "cold", "leave", null, {
            effects: [rem("sch_refused"), why("sch_refused")],
          }),
        ],
        v("answered", m("sch_answered")),
        v("kept", m("sch_kept")),
        v("silent", any(m("sch_silent"), m("sch_thin"))),
      ),
      bed: node(
        [bye("guard")],
        v("burned", m("sch_burned")),
        v("asked", m("sch_asked")),
      ),
      side: node([bye("go_well")]),
    },
    {
      cast: {
        p: { person: "auh_schratt" },
        mont: { person: "auh_montenuovo" },
      },
    },
  ),
];

// ---- 2. 베크: 다섯 달 먼저 난 사람 ----

const BECK: readonly GwScene[] = [
  talk("beck_walk", "auh_beck", all(FJ, period("c")), {
    open: node([
      r("not_rain", "frank", "ask", "young"),
      bye("rain"),
      r("how_is_he", "warm", "ask", "young"),
    ]),
    young: node(
      [
        r("what_table", "frank", "ask", "rail", {
          effects: [reveal("auh_rail_muddle"), rem("beck_told")],
        }),
        bye("old_man", pt(-1)),
      ],
      v("other", not(isCos("auh_conrad"))),
    ),
    rail: node(
      [bye("not_said")],
      v("muddle", { kind: "secret", id: "auh_rail_muddle" }),
    ),
  }),
  talk("beck_wire", "auh_beck", all(FJ, war, period("14", "15a")), {
    open: node([
      r("impossible", "frank", "ask", "wire", { gain: [pt(1)] }),
      r("forgot", "cold", "ask", "forgot"),
      bye("not_today"),
    ]),
    forgot: node([r("impossible2", "frank", "ask", "wire"), bye("not_today2")]),
    wire: node([
      r("you_then", "frank", "ask", "truth", { effects: [rem("beck_told")] }),
      bye("tables_only", pt(-1), rem("beck_shut")),
    ]),
    truth: node(
      [bye("hear_it", pt(1))],
      v("low", all(isCos("auh_conrad"), conradAt({ max: 1 }))),
      v("high", all(isCos("auh_conrad"), conradAt({ min: 3 }))),
    ),
  }),
  talk(
    "beck_name",
    "auh_beck",
    all(FJ, seen("auh_p_beck_walk"), date("1915-01")),
    {
      open: node([
        r("why_name", "warm", "ask", "name", { gain: [pt(1)] }),
        r("long_name", "warm", "ask", "name"),
        bye("sign_it"),
      ]),
      name: node([r("my_name", "frank", "ask", "mine"), bye("understood")]),
      mine: node([bye("enough_names")]),
    },
  ),
  talk(
    "beck_fear",
    "auh_beck",
    all(FJ, seen("auh_p_beck_name"), not(m("beck_shut"))),
    {
      open: node([
        r("heir", "frank", "ask", "heir", { effects: [rem("fear_heir")] }),
        r("land", "frank", "ask", "land", { effects: [rem("fear_land")] }),
        r("son", "frank", "ask", "son", { effects: [rem("fear_son")] }),
        r("nothing", "cold", "leave", null, { effects: [rem("fear_none")] }),
      ]),
      heir: node([bye("thanks")]),
      land: node([bye("thanks")]),
      son: node([bye("thanks")]),
    },
  ),
  talk("beck_cap", "auh_beck", REIGN, {
    open: node(
      [
        r("more", "warm", "ask", "no_more"),
        r("come_by", "warm", "deal", "stay", { effects: [rem("beck_stays")] }),
        bye("thanks"),
      ],
      v("heir", all(K, m("fear_heir"))),
      v("land", m("fear_land")),
      v("son", m("fear_son")),
      v("none", m("fear_none")),
      v("shut", m("beck_shut")),
    ),
    no_more: node([
      r("come_by2", "warm", "deal", "stay", { effects: [rem("beck_stays")] }),
      bye("thanks2"),
    ]),
    stay: node([bye("done")]),
  }),
];

// ---- 3. 콘라트: 헤르베르트 ----

const CONRAD: readonly GwScene[] = [
  visit(
    "con_list",
    "auh_bolfras",
    all(FJ, world({ is: "entered", tag: "RUS" }), isCos("auh_conrad"), {
      kind: "chapter",
      min: 3,
      max: 8,
    }),
    6,
    {
      open: node([
        r("leave_him", "frank", "deal", null, {
          effects: [rem("con_left"), schedule("auh_p_con_rawa", 2)],
        }),
        r("move_him", "warm", "deal", null, {
          effects: [rem("con_moved"), schedule("auh_p_con_paper", 2)],
        }),
        r("ask_him", "warm", "ask", "ask"),
      ]),
      ask: node([
        r("leave_him2", "frank", "deal", null, {
          effects: [rem("con_left"), schedule("auh_p_con_rawa", 2)],
        }),
        r("move_him2", "warm", "deal", null, {
          effects: [rem("con_moved"), schedule("auh_p_con_paper", 2)],
        }),
      ]),
    },
  ),
  called(
    "con_rawa",
    "auh_conrad",
    {
      open: node(
        [
          r("heard", "warm", "ask", "said", { gain: [pt(1)] }),
          r("go_on", "cold", "ask", "map", { effects: [rem("con_map")] }),
          r("my_son", "frank", "ask", "rudolf", {
            effects: [rem("con_wept"), pt(1)],
          }),
        ],
        v("again", m("con_sent")),
      ),
      said: node([
        r("my_son2", "frank", "ask", "rudolf", {
          effects: [rem("con_wept"), pt(1)],
        }),
        bye("go_rest", rem("con_said")),
      ]),
      map: node([r("very_well", "cold", "leave", null)]),
      rudolf: node([bye("sit")], v("again", m("con_sent"))),
    },
    { variants: [v("again", m("con_sent")), v("base")] },
  ),
  called("con_paper", "auh_conrad", {
    open: node([
      r("sign", "frank", "deal", "signed", {
        effects: [rem("con_sent"), schedule("auh_p_con_rawa", 3)],
      }),
      r("wont", "cold", "deal", "kept", { effects: [rem("con_kept")] }),
      r("father", "warm", "ask", "father"),
    ]),
    father: node([
      r("sign2", "frank", "deal", "signed", {
        effects: [rem("con_sent"), schedule("auh_p_con_rawa", 3)],
      }),
      r("wont2", "cold", "deal", "kept", { effects: [rem("con_kept")] }),
    ]),
    signed: node([bye("go")]),
    kept: node([bye("go2")]),
  }),
  talk(
    "con_marry",
    "auh_conrad",
    all(FJ, isCos("auh_conrad"), period("15a", "15b")),
    {
      open: node(
        [
          r("shut_eyes", "warm", "deal", "yes", {
            effects: [rem("con_blessed"), pt(1)],
          }),
          r("eight_years", "warm", "ask", "wait"),
          r("scandal", "cold", "push", "back", {
            effects: [rem("con_refused"), pt(-1)],
          }),
        ],
        v("wept", m("con_wept")),
        v("map", m("con_map")),
        v("kept", m("con_kept")),
      ),
      wait: node([
        r("shut_eyes2", "warm", "deal", "yes", {
          effects: [rem("con_blessed"), pt(1)],
        }),
        bye("think_on_it"),
      ]),
      back: node([
        r("too_far", "cold", "leave", null),
        r("shut_eyes3", "frank", "deal", "yes", {
          effects: [rem("con_blessed")],
        }),
      ]),
      yes: node([bye("go")]),
    },
  ),
  visit(
    "con_church",
    "auh_bolfras",
    all(FJ, seen("auh_p_con_marry"), date("1915-09", "1916-03")),
    4,
    {
      open: node(
        [
          bye("photograph", rem("con_gift")),
          r("nothing", "cold", "leave", null),
          r("who_came", "warm", "ask", "who"),
        ],
        v("refused", m("con_refused")),
      ),
      who: node([bye("photograph2", rem("con_gift")), bye("nothing2")]),
    },
  ),
  talk(
    "con_trunk",
    "auh_conrad",
    any(REIGN, all(not(isCos("auh_conrad")), date("1915-07"))),
    {
      open: node(
        [
          r("what_in", "warm", "ask", "in"),
          r("herbert", "frank", "ask", "son"),
          bye("keep_it"),
        ],
        v("kept", m("con_kept")),
      ),
      in: node(
        [
          r("herbert2", "frank", "ask", "son"),
          r("paper", "frank", "deal", "paper", {
            when: all(K, seen("auh_p_con_marry")),
            effects: [rem("con_paper_gone"), pt(1)],
          }),
          bye("keep_it2"),
        ],
        v("gift", m("con_gift")),
        v("blessed", m("con_blessed")),
      ),
      son: node(
        [bye("hold_on")],
        v("sent", m("con_sent")),
        v("kept", m("con_kept")),
        v("left", m("con_left")),
      ),
      paper: node([bye("done")]),
    },
  ),
];

// ---- 4. 발레리: 독일어로 말하는 딸 ----

const VALERIE: readonly GwScene[] = [
  talk(
    "val_table",
    "auh_valerie",
    all(FJ, { kind: "chapter", min: 2, max: 7 }),
    {
      open: node([
        r("how_old", "warm", "ask", "age"),
        r("did_you_eat", "warm", "ask", "ate"),
        bye("letters"),
      ]),
      age: node([bye("no_more")]),
      ate: node([r("how_old2", "warm", "ask", "age"), bye("letters2")]),
    },
  ),
  visit(
    "val_hubert",
    "auh_valerie",
    all(FJ, war, seen("auh_p_val_table"), period("14", "15a")),
    4,
    {
      open: node([
        r("send", "frank", "deal", "sent", {
          effects: [rem("val_sent"), why("val_sent")],
        }),
        r("keep", "warm", "deal", "kept", { effects: [rem("val_kept")] }),
        r("ask_her", "warm", "ask", "say"),
      ]),
      say: node([
        r("send2", "frank", "deal", "sent", {
          effects: [rem("val_sent"), why("val_sent")],
        }),
        r("keep2", "warm", "deal", "kept", { effects: [rem("val_kept")] }),
      ]),
      sent: node([bye("yes")]),
      kept: node([bye("yes2")]),
    },
  ),
  talk("val_ward", "auh_valerie", all(FJ, war, period("15a", "16b")), {
    open: node(
      [
        r("you_give", "frank", "push", "water", { effects: [rem("val_went")] }),
        r("i_give", "warm", "ask", "water2", {
          effects: [rem("val_went"), pt(1)],
        }),
        r("go", "cold", "leave", null, { effects: [rem("val_left_ward")] }),
      ],
      v("sent", m("val_sent")),
    ),
    water: node([bye("well_done")]),
    water2: node([bye("well_done2")]),
  }),
  talk(
    "val_name",
    "auh_valerie",
    all(FJ, seen("auh_p_val_ward"), date("1915-03")),
    {
      open: node([
        bye("wont_ask", pt(1), rem("val_unsaid")),
        r("speak_to_him", "frank", "push", "dont"),
        r("diary", "warm", "ask", "diary"),
      ]),
      dont: node([bye("wont_ask2", rem("val_unsaid"))]),
      diary: node([bye("read_it")]),
    },
  ),
  talk(
    "val_letter",
    "auh_valerie",
    all(FJ, seen("auh_p_val_table"), date("1915-07")),
    {
      open: node(
        [
          r("read", "frank", "push", "read", {
            effects: [rem("val_letter_read")],
          }),
          r("keep_it", "warm", "ask", "kept", {
            effects: [rem("val_letter_left"), pt(1)],
          }),
          r("not_now", "cold", "leave", null),
        ],
        v("unsaid", m("val_unsaid")),
      ),
      read: node([bye("give_back")]),
      kept: node([bye("good_night")]),
    },
  ),
  talk("val_trial", "auh_valerie", REIGN, {
    open: node(
      [
        r("how_was_he", "warm", "ask", "how"),
        r("hubert", "warm", "ask", "boy"),
        bye("thanks"),
      ],
      v("read", m("val_letter_read")),
      v("left", m("val_letter_left")),
    ),
    how: node(
      [r("hubert2", "warm", "ask", "boy"), bye("thanks2")],
      v("went", m("val_went")),
      v("ward", m("val_left_ward")),
    ),
    boy: node(
      [bye("thanks3")],
      v("sent", m("val_sent")),
      v("kept", m("val_kept")),
    ),
  }),
];

// ---- 5. 케테를: 세 시 반의 사람 ----

const KETTERL: readonly GwScene[] = [
  talk("ket_morning", "auh_ketterl", all(FJ, { kind: "chapter", min: 1 }), {
    open: node([
      r("what_for", "warm", "ask", "phone"),
      bye("no_thanks"),
      bye("put_it_in", rem("ket_phone")),
    ]),
    phone: node([bye("put_it_in2", rem("ket_phone")), bye("no_thanks2")]),
  }),
  talk("ket_button", "auh_ketterl", all(FJ, war, period("14", "15b")), {
    open: node([
      r("where", "warm", "ask", "where"),
      r("find_him", "warm", "deal", "find", {
        effects: [rem("ket_found"), pt(1)],
      }),
      bye("my_button", rem("ket_button"), pt(1)),
    ]),
    where: node([
      r("find_him2", "warm", "deal", "find", {
        effects: [rem("ket_found"), pt(1)],
      }),
      bye("my_button2", rem("ket_button"), pt(1)),
    ]),
    find: node([bye("thanks")]),
  }),
  talk(
    "ket_shoes",
    "auh_ketterl",
    all(FJ, war, seen("auh_p_ket_button"), date("1915-03")),
    {
      open: node(
        [
          r("whose", "warm", "ask", "whose"),
          r("kitchen", "warm", "ask", "kitchen"),
          bye("thanks"),
        ],
        v("phone", m("ket_phone")),
      ),
      whose: node([r("kitchen2", "warm", "ask", "kitchen"), bye("thanks2")]),
      kitchen: node([bye("thanks3")], v("bread", m("bread_table"))),
    },
  ),
  talk("ket_book", "auh_ketterl", all(FJ, seen("auh_p_ket_shoes")), {
    open: node([r("will_you", "frank", "ask", "will"), bye("close_it")]),
    will: node([
      bye("dont", rem("ket_book_no")),
      bye("write", rem("ket_book_yes"), pt(1)),
      bye("as_you_like"),
    ]),
  }),
  visit(
    "ket_half",
    "auh_ketterl",
    all(REIGN, fresh(5)),
    7,
    {
      open: node([
        r("words", "warm", "ask", "words"),
        r("stay", "warm", "deal", "stay", { effects: [rem("ket_stays")] }),
        bye("rest"),
      ]),
      words: node(
        [
          r("stay2", "warm", "deal", "stay", { effects: [rem("ket_stays")] }),
          bye("rest2"),
        ],
        v("no", m("ket_book_no")),
        v("yes", m("ket_book_yes")),
      ),
      stay: node([bye("done")]),
    },
    { variants: [v("button", m("ket_button")), v("base")] },
  ),
];

// ---- 6. 치타: 쇤브룬의 아이 ----

const ZITA: readonly GwScene[] = [
  talk("zit_hand", "auh_zita", all(FJ, heirDead, { kind: "chapter", min: 6 }), {
    open: node([
      r("let_him", "warm", "ask", "stay"),
      r("will_he", "frank", "ask", "fear", {
        effects: [rem("zit_told"), pt(1)],
      }),
      bye("take_him"),
    ]),
    stay: node([
      r("will_he2", "frank", "ask", "fear", {
        effects: [rem("zit_told"), pt(1)],
      }),
      bye("thank_you"),
    ]),
    fear: node([bye("not_him")]),
  }),
  talk(
    "zit_evening",
    "auh_zita",
    all(FJ, heirDead, seen("auh_p_zit_hand"), date("1915-01")),
    {
      open: node(
        [
          r("too_good", "frank", "ask", "good"),
          r("what_he_says", "warm", "ask", "says"),
          bye("rest"),
        ],
        v("told", m("zit_told")),
      ),
      good: node([bye("teach", rem("zit_charge")), bye("say_nothing")]),
      says: node([r("too_good2", "frank", "ask", "good"), bye("rest2")]),
    },
  ),
  visit("zit_white", "auh_zita", all(K, fresh(6)), 9, {
    open: node(
      [
        r("walks", "warm", "deal", "walk", { effects: [rem("zit_walked")] }),
        r("stays", "frank", "deal", "home", { effects: [rem("zit_home")] }),
        r("what_you", "warm", "ask", "you"),
      ],
      v("charge", m("zit_charge")),
    ),
    you: node([
      r("walks2", "warm", "deal", "walk", { effects: [rem("zit_walked")] }),
      r("stays2", "frank", "deal", "home", { effects: [rem("zit_home")] }),
    ]),
    walk: node([bye("yes")]),
    home: node([bye("yes2")]),
  }),
  talk("zit_night", "auh_zita", all(K, war), {
    open: node(
      [
        r("ate", "warm", "ask", "ate"),
        r("read_to_me", "warm", "ask", "read"),
        bye("sleep"),
      ],
      v("ket", m("ket_stays")),
    ),
    ate: node([bye("tomorrow"), r("read_to_me2", "warm", "ask", "read")]),
    read: node([bye("good_night")]),
  }),
  talk("zit_wartholz", "auh_zita", all(K, heirDead, seen("auh_p_zit_night")), {
    open: node([
      r("remember", "frank", "ask", "day"),
      r("father", "frank", "ask", "father"),
      bye("not_tonight"),
    ]),
    day: node([bye("enough")], v("walked", m("zit_walked"))),
    father: node([bye("enough2")]),
  }),
  talk("zit_otto", "auh_zita", all(K, date("1918-01")), {
    open: node(
      [
        r("tell_him", "frank", "ask", "tell", { effects: [rem("zit_answer")] }),
        r("let_me", "warm", "ask", "me"),
        bye("later"),
      ],
      v("home", m("zit_home")),
    ),
    tell: node([bye("yes")]),
    me: node([bye("yes2")]),
  }),
];

// ---- 7. 아들러: 그 낱말 ----

const ADLER: readonly GwScene[] = [
  talk("adl_klessheim", "auh_adler", all(FJ, period("15a", "16b")), {
    open: node([
      r("court_doctors", "frank", "ask", "brother", { gain: [pt(1)] }),
      r("my_brother", "frank", "ask", "brother", { gain: [pt(1)] }),
      r("opinion", "cold", "ask", "plain"),
    ]),
    brother: node([
      bye("will_write", rem("adl_wrote")),
      r("wont_write", "cold", "leave", null),
    ]),
    plain: node([r("very_well", "cold", "leave", null)]),
  }),
  talk("adl_word", "auh_adler", all(FJ, seen("auh_p_adl_klessheim")), {
    open: node(
      [
        r("was_he", "frank", "ask", "honest", {
          effects: [rem("adl_word")],
          gain: [pt(1)],
        }),
        r("paper_only", "cold", "leave", null),
      ],
      v("wrote", m("adl_wrote")),
    ),
    honest: node(
      [r("your_girl", "warm", "ask", "mucki"), bye("thanks")],
      v("cold", coldTo(-1)),
    ),
    mucki: node([bye("not_known")]),
  }),
  visit(
    "adl_same",
    "auh_adler",
    all(flag("w_auh_sturgkh_shot"), m("adl_word")),
    6,
    {
      open: node(
        [
          r("sign", "frank", "push", "signed", {
            effects: [rem("adl_signed")],
          }),
          r("grave", "warm", "ask", "grave", {
            effects: [{ kind: "remember", key: "k_adl_son" }],
          }),
          r("yours", "warm", "leave", null, { effects: [rem("adl_left")] }),
        ],
        v("heir", REIGN),
      ),
      grave: node([
        r("sign2", "frank", "push", "signed", {
          effects: [rem("adl_signed")],
        }),
        bye("yours2", rem("adl_refused")),
      ]),
      signed: node([bye("as_you_will")]),
    },
  ),
  talk("adl_stein", "auh_adler", seen("auh_h_adler_trial"), {
    open: node(
      [
        r("heart", "warm", "ask", "heart"),
        r("out", "warm", "deal", "out", {
          effects: [rem("adl_amnesty"), pt(1)],
        }),
        bye("go_home"),
      ],
      v("signed", m("adl_signed")),
      v("refused", any(m("adl_refused"), m("adl_left"))),
    ),
    heart: node([
      r("out2", "warm", "deal", "out", {
        effects: [rem("adl_amnesty"), pt(1)],
      }),
      bye("go_home2"),
    ]),
    out: node([bye("yes")]),
  }),
];

// ---- 8. 티서: 두 딸 ----

const TISZA: readonly GwScene[] = [
  talk("tis_sunday", "auh_tisza", all(FJ, period("c", "15a")), {
    open: node([
      r("father", "warm", "ask", "father", { gain: [pt(1)] }),
      r("what_read", "warm", "ask", "book"),
      bye("train"),
    ]),
    father: node([bye("yes")]),
    book: node([r("father2", "warm", "ask", "father"), bye("yes2")]),
  }),
  visit(
    "tis_may",
    "auh_tisza",
    all(
      FJ,
      any(date("1915-05", "1915-06"), date("1916-05", "1916-06")),
      seen("auh_p_tis_sunday"),
    ),
    6,
    {
      open: node([
        r("my_girl", "frank", "ask", "told", {
          effects: [rem("tis_told"), pt(1)],
        }),
        r("nothing", "cold", "leave", null, { effects: [rem("tis_held")] }),
      ]),
      told: node([bye("keep_it")]),
    },
  ),
  talk(
    "tis_colonel",
    "auh_tisza",
    all(
      not({ kind: "holder", office: "hun_pm", person: "auh_tisza" }),
      date("1916-06"),
    ),
    {
      open: node(
        [
          r("why_go", "frank", "ask", "why"),
          r("seat_kept", "warm", "deal", "seat", {
            effects: [rem("tis_seat")],
          }),
          bye("mind_yourself"),
        ],
        v("told", m("tis_told")),
      ),
      why: node([bye("mind_yourself2")]),
      seat: node([bye("go")]),
    },
  ),
  talk("tis_villa", "auh_tisza", date("1918-07"), {
    open: node(
      [
        r("order", "threat", "push", "no", { miss: "no" }),
        r("how_then", "frank", "ask", "how"),
        bye("as_you_will", rem("tis_no_guard")),
      ],
      v("seat", m("tis_seat")),
      v("told", m("tis_told")),
    ),
    no: node([bye("as_you_will2", rem("tis_no_guard"))]),
    how: node([bye("as_you_will3", rem("tis_no_guard"))]),
  }),
];

// ---- 9. 베르히톨트: 원한 적 없는 자리 ----

const BERCHTOLD: readonly GwScene[] = [
  talk(
    "ber_race",
    "auh_berchtold",
    all(FJ, fmIs("auh_berchtold"), period("c")),
    {
      open: node([
        r("you_refused", "frank", "ask", "thrice"),
        bye("go_see", rem("ber_freed"), pt(1)),
        r("no_races", "cold", "leave", null),
      ]),
      thrice: node([
        r("wrong", "frank", "ask", "wrong"),
        bye("duty", rem("ber_bound")),
      ]),
      wrong: node([bye("nothing")]),
    },
  ),
  talk(
    "ber_nandine",
    "auh_berchtold",
    all(FJ, fmIs("auh_berchtold"), war, period("14", "15a")),
    {
      open: node(
        [
          r("rest", "warm", "deal", "rest", {
            effects: [rem("ber_rest"), pt(1)],
          }),
          r("want_out", "frank", "ask", "out"),
          bye("regards"),
        ],
        v("bound", m("ber_bound")),
      ),
      rest: node([bye("go")]),
      out: node([bye("go2")]),
    },
  ),
  visit(
    "ber_pheasant",
    "auh_berchtold",
    all(not(fmIs("auh_berchtold")), date("1915-02"), not(K)),
    4,
    {
      open: node(
        [
          r("why_not_shoot", "warm", "ask", "gun"),
          r("come_back", "frank", "ask", "back"),
          bye("thanks"),
        ],
        v("rest", m("ber_rest")),
      ),
      gun: node([bye("thanks2")]),
      back: node([bye("thanks3")]),
    },
  ),
  talk("ber_table", "auh_berchtold", all(K, not(fmIs("auh_berchtold"))), {
    open: node(
      [
        r("sit", "warm", "ask", "sit", { gain: [pt(1)] }),
        r("hoyos", "frank", "ask", "hoyos"),
        bye("go_on"),
      ],
      v("freed", m("ber_freed")),
    ),
    sit: node([r("hoyos2", "frank", "ask", "hoyos"), bye("go_on2")]),
    hoyos: node([bye("go_on3")]),
  }),
];

// ---- 10. 조피의 아이들, 살아 있는 판에는 대공 내외 ----

const SOPHIE: readonly GwScene[] = [
  visit(
    "sop_room",
    "auh_sophie",
    all(FJ, heirDead, { kind: "chapter", min: 1, max: 5 }),
    5,
    {
      open: node([
        r("come_here", "warm", "ask", "here", { effects: [rem("sop_warm")] }),
        r("lessons", "cold", "ask", "lessons", { effects: [rem("sop_cool")] }),
        r("sorry", "frank", "ask", "coffin"),
      ]),
      here: node([r("sorry2", "frank", "ask", "coffin"), bye("sweets")]),
      lessons: node([
        r("rule", "cold", "leave", null),
        r("signed", "frank", "ask", "after", { effects: [rem("sop_told")] }),
      ]),
      coffin: node([
        r("rule2", "cold", "leave", null),
        r("signed2", "frank", "ask", "after", { effects: [rem("sop_told")] }),
      ]),
      after: node([bye("go_well")]),
    },
  ),
  visit(
    "sop_ledger",
    "auh_bolfras",
    all(FJ, heirDead, seen("auh_p_sop_room"), period("14", "15a")),
    3,
    {
      open: node([
        bye("my_purse", rem("sop_paid"), why("sop_paid")),
        r("thun_pays", "cold", "leave", null),
        r("how_much", "warm", "ask", "much"),
      ]),
      much: node([
        bye("my_purse2", rem("sop_paid"), why("sop_paid")),
        r("thun_pays2", "cold", "leave", null),
      ]),
    },
  ),
  visit(
    "sop_letter",
    "auh_sophie",
    all(FJ, heirDead, seen("auh_p_sop_room"), date("1915-06", "1916-09")),
    4,
    {
      open: node(
        [
          bye("answer_self", rem("sop_answered")),
          bye("secretary"),
          r("what_else", "warm", "ask", "else"),
        ],
        v("warm", m("sop_warm")),
        v("told", m("sop_told")),
      ),
      else: node([bye("answer_self2", rem("sop_answered")), bye("secretary2")]),
    },
  ),
  talk("sop_grown", "auh_sophie", all(K, heirDead), {
    open: node(
      [
        r("artstetten", "warm", "ask", "grave"),
        r("anything", "warm", "deal", "need", { effects: [rem("sop_kept")] }),
        bye("go_well"),
      ],
      v("answered", m("sop_answered")),
      v("told", m("sop_told")),
      v("paid", m("sop_paid")),
    ),
    grave: node([bye("go_well2")]),
    need: node([bye("go_well3")]),
  }),
  talk("ff_table", "auh_ff", all(FJ, ffAlive, period("c", "15a")), {
    open: node([
      r("both", "warm", "deal", "both", { effects: [rem("ff_dined")] }),
      r("rule", "cold", "leave", null, { effects: [rem("ff_barred")] }),
      r("why_angry", "frank", "ask", "angry"),
    ]),
    angry: node([
      r("both2", "warm", "deal", "both", { effects: [rem("ff_dined")] }),
      r("rule2", "cold", "leave", null, { effects: [rem("ff_barred")] }),
    ]),
    both: node([bye("eight")]),
  }),
  talk(
    "ff_roses",
    "auh_ff",
    all(FJ, ffAlive, seen("auh_p_ff_table"), date("1914-08")),
    {
      open: node(
        [
          r("children", "warm", "ask", "kids"),
          r("after_me", "frank", "ask", "after"),
          bye("thanks"),
        ],
        v("dined", m("ff_dined")),
        v("barred", m("ff_barred")),
      ),
      kids: node([r("after_me2", "frank", "ask", "after"), bye("thanks2")]),
      after: node([bye("hold_tongue")]),
    },
  ),
  visit("ff_step", "auh_montenuovo", all(FFT, fresh(6)), 6, {
    open: node(
      [
        r("crown_her", "threat", "push", "crown", {
          tell: ["hungary:-1"],
          effects: [
            { kind: "inst", inst: "hungary", delta: -1 },
            rem("ff_empress"),
          ],
        }),
        r("beside_me", "frank", "deal", "beside", {
          effects: [rem("ff_beside")],
        }),
        r("later", "cold", "leave", null),
      ],
      v("dined", m("ff_dined")),
    ),
    crown: node([bye("that_is_all")]),
    beside: node([bye("that_is_all2")]),
  }),
];

// ---- The lines' other turns: what only some games reach ----

const TURNS: readonly GwScene[] = [
  talk(
    "sch_notice",
    "auh_schratt",
    all(FJ, war, m("sch_toni"), date("1915-07")),
    {
      open: node([
        r("stop", "warm", "deal", "stop", { effects: [rem("sch_toni_saved")] }),
        r("want", "warm", "ask", "want"),
        r("same", "frank", "ask", "same", { effects: [rem("sch_toni_went")] }),
      ]),
      want: node([
        r("stop2", "warm", "deal", "stop", {
          effects: [rem("sch_toni_saved")],
        }),
        r("same2", "frank", "ask", "same", { effects: [rem("sch_toni_went")] }),
      ]),
      stop: node([bye("yes")]),
      same: node([bye("yes2")]),
    },
  ),
  talk(
    "sch_chair",
    "auh_schratt",
    all(REIGN, any(m("sch_led"), m("sch_side"))),
    {
      open: node(
        [
          r("who_was", "warm", "ask", "who"),
          r("need", "warm", "deal", "need"),
          bye("thanks"),
        ],
        v("went", m("sch_toni_went")),
        v("saved", m("sch_toni_saved")),
      ),
      who: node([bye("thanks2")]),
      need: node([bye("thanks3")]),
    },
  ),
  visit("sch_knife", "auh_montenuovo", all(REIGN, m("sch_refused")), 4, {
    open: node([bye("keep_it", rem("sch_knife_kept")), bye("send_back")]),
  }),
  talk(
    "beck_hunt",
    "auh_beck",
    all(FJ, seen("auh_p_beck_walk"), not(m("beck_shut")), date("1914-09")),
    {
      open: node([
        r("hit", "frank", "ask", "hit", { gain: [pt(1)] }),
        r("wind", "warm", "ask", "wind", { gain: [pt(1)] }),
        r("empty", "frank", "ask", "empty"),
      ]),
      hit: node([bye("laugh")]),
      wind: node([bye("laugh2")]),
      empty: node([bye("yes")]),
    },
  ),
  talk("ket_collar", "auh_ketterl", all(FJ, seen("auh_p_ket_morning")), {
    open: node([r("twenty_two", "frank", "ask", "age"), bye("thanks")]),
    age: node([r("gallows", "frank", "ask", "church"), bye("thanks2")]),
    church: node([bye("yes")]),
  }),
  talk("tis_sabre", "auh_tisza", all(FJ, seen("auh_p_tis_sunday")), {
    open: node([
      r("why", "warm", "ask", "why"),
      r("how", "warm", "ask", "how", {
        effects: [rem("tis_karolyi")],
        gain: [pt(1)],
      }),
      bye("enough"),
    ]),
    why: node([
      r("how2", "warm", "ask", "how", { effects: [rem("tis_karolyi")] }),
      bye("enough2"),
    ]),
    how: node([bye("enough3")]),
  }),
  talk("adl_last", "auh_adler", all(date("1918-08"), m("adl_word")), {
    open: node(
      [
        r("son", "frank", "ask", "son"),
        r("wrong", "warm", "ask", "wrong"),
        bye("rest"),
      ],
      v("amnesty", m("adl_amnesty")),
    ),
    son: node([bye("rest2")]),
    wrong: node([bye("rest3")]),
  }),
  talk(
    "val_munich",
    "auh_valerie",
    all(FJ, war, seen("auh_p_val_table"), date("1915-08")),
    {
      open: node([r("mama", "frank", "ask", "mama"), bye("answer")]),
      mama: node([bye("enough")]),
    },
  ),
  talk("val_wallsee", "auh_valerie", all(K, date("1918-07")), {
    open: node(
      [
        r("come", "warm", "deal", "come", { effects: [rem("val_called")] }),
        r("beds", "warm", "ask", "beds"),
        bye("thanks"),
      ],
      v("read", m("val_letter_read")),
    ),
    beds: node([bye("thanks2")]),
    come: node([bye("thanks3")]),
  }),
  talk("beck_rain", "auh_beck", all(REIGN, m("beck_stays"), date("1916-01")), {
    open: node(
      [bye("thanks", pt(1))],
      v("low", world({ is: "score", max: -10 })),
    ),
  }),
  visit("ket_nephew", "auh_ketterl", all(FJ, m("ket_found")), 3, {
    open: node([bye("glad"), r("what_now", "warm", "ask", "now")]),
    now: node([bye("glad2")]),
  }),
  talk("hoy_bag", "auh_hoyos", all(K, seen("auh_p_ber_table")), {
    open: node([
      r("put_away", "warm", "push", "away", {
        effects: [rem("hoy_bag_gone")],
        gain: [pt(1)],
      }),
      r("sister", "warm", "ask", "sister"),
      bye("leave_it"),
    ]),
    sister: node([
      r("put_away2", "warm", "push", "away", {
        effects: [rem("hoy_bag_gone")],
      }),
      bye("leave_it2"),
    ]),
    away: node([bye("good")]),
  }),
  talk("sop_table", "auh_sophie", all(FJ, ffAlive, m("ff_dined")), {
    open: node([
      r("majesty", "cold", "leave", null),
      r("as_you_like", "warm", "ask", "like", { gain: [pt(1)] }),
    ]),
    like: node([bye("yes")]),
  }),
];

/**
 * Trust and warmth: the same person, the same day, a warmer or a colder first
 * line. They stand behind what a line remembers and before the base.
 */
const WARMTH: Readonly<Record<string, { warm?: boolean; cold?: boolean }>> = {
  auh_p_sch_ribbon: { cold: true },
  auh_p_beck_wire: { warm: true, cold: true },
  auh_p_con_trunk: { warm: true, cold: true },
  auh_p_zit_evening: { cold: true },
  auh_p_adl_stein: { cold: true },
  auh_p_tis_sunday: { warm: true, cold: true },
  auh_p_tis_colonel: { cold: true },
  auh_p_tis_villa: { warm: true },
  auh_p_ber_pheasant: { cold: true },
  auh_p_ber_table: { cold: true },
  auh_p_ket_half: { warm: true },
  auh_p_con_marry: { cold: true },
};

function withWarmth(s: GwScene): GwScene {
  const w = WARMTH[s.id];
  const open = s.nodes?.open;
  if (w === undefined || open === undefined) return s;
  const says = open.says.slice(0, -1);
  if (w.warm === true) says.push(v("warm", warmTo(2)));
  if (w.cold === true) says.push(v("cold", coldTo(-1)));
  says.push(open.says[open.says.length - 1]);
  return { ...s, nodes: { ...s.nodes, open: { ...open, says } } };
}

export const AUH_PRIVATE_SCENES: readonly GwScene[] = [
  ...SCHRATT,
  ...BECK,
  ...CONRAD,
  ...VALERIE,
  ...KETTERL,
  ...ZITA,
  ...ADLER,
  ...TISZA,
  ...BERCHTOLD,
  ...SOPHIE,
  ...TURNS,
].map(withWarmth);

// ---- It reaches back into work ----

/**
 * What the lines leave in the work scenes: a `says` variant at the head of a
 * node, in the scene's own pack under the id given. First one that holds wins,
 * so these speak before a temperament does.
 */
const ECHOES: readonly {
  scene: string;
  node: string;
  id: string;
  when: GwCond;
}[] = [
  {
    scene: "auh_t_con_wait",
    node: "open",
    id: "p_beck",
    when: all(FJ, m("beck_told")),
  },
  {
    scene: "auh_t_kar_first",
    node: "open",
    id: "p_sabre",
    when: all(FJ, m("tis_karolyi")),
  },
  {
    scene: "auh_t_con_germans",
    node: "open",
    id: "p_wept",
    when: all(FJ, m("con_wept")),
  },
  {
    scene: "auh_t_con_germans",
    node: "open",
    id: "p_map",
    when: all(FJ, m("con_map")),
  },
  { scene: "auh_t_con_tyrol", node: "open", id: "p_kept", when: m("con_kept") },
  {
    scene: "auh_t_con_tyrol",
    node: "open",
    id: "p_sent",
    when: all(FJ, m("con_sent")),
  },
  {
    scene: "auh_t_con_piave",
    node: "open",
    id: "p_wept",
    when: all(REIGN, m("con_wept")),
  },
  {
    scene: "auh_t_con_piave",
    node: "open",
    id: "p_map",
    when: all(REIGN, m("con_map")),
  },
  {
    scene: "auh_t_bol_days",
    node: "open",
    id: "p_garden",
    when: all(FJ, m("sch_thin")),
  },
  {
    scene: "auh_v_land_days",
    node: "open",
    id: "p_bread",
    when: m("bread_table"),
  },
  {
    scene: "auh_t_tisza_grain",
    node: "open",
    id: "p_told",
    when: all(FJ, m("tis_told")),
  },
  {
    scene: "auh_t_tisza_grain",
    node: "open",
    id: "p_held",
    when: all(FJ, m("tis_held")),
  },
  {
    scene: "auh_t_tisza_oath",
    node: "open",
    id: "p_told",
    when: all(FJ, m("tis_told")),
  },
  { scene: "auh_t_adl_son", node: "open", id: "p_word", when: m("adl_word") },
  {
    scene: "auh_t_ber_after",
    node: "open",
    id: "p_freed",
    when: all(FJ, m("ber_freed")),
  },
  {
    scene: "auh_t_ber_after",
    node: "open",
    id: "p_bound",
    when: all(FJ, m("ber_bound")),
  },
  {
    scene: "auh_t_karl_peace",
    node: "open",
    id: "p_fear",
    when: m("fear_heir"),
  },
  {
    scene: "auh_t_zita_italian",
    node: "open",
    id: "p_told",
    when: all(FJ, m("zit_told")),
  },
  {
    scene: "auh_t_bor_socks",
    node: "open",
    id: "p_hubert",
    when: all(FJ, m("val_sent")),
  },
  {
    scene: "auh_t_bor_socks",
    node: "open",
    id: "p_kept",
    when: all(FJ, m("val_kept")),
  },
];

/** Lays the echoes over a scene of the other shares. */
export function withAuhPrivate(s: GwScene): GwScene {
  const mine = ECHOES.filter((e) => e.scene === s.id);
  if (mine.length === 0 || s.nodes === undefined) return s;
  const nodes = { ...s.nodes };
  for (const e of mine) {
    const n = nodes[e.node];
    nodes[e.node] = { ...n, says: [{ id: e.id, when: e.when }, ...n.says] };
  }
  return { ...s, nodes };
}

// ---- The people only these lines need ----

/**
 * Nobody here holds a desk or can be given one; `camps` is empty so that no
 * camp role casts them. Appended after every other list: order matters to the
 * seed rolls. Schratt and Ketterl are also in the ruler lane's people_ruler.ts
 * under these ids: when both land, keep that row and drop these two.
 */
export const AUH_PRIVATE_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "auh_schratt",
    tag: "AUH",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["weary", "cunning"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "b. 11 Sep 1853, Baden; Burgtheater, left 1900 after a quarrel with Schlenther; separated from Kiss von Ittebe, son Anton b. 1880; Gloriettegasse and a house at Ischl; Wilczek a friend; the break of 1900-1901; debts paid (en.wikipedia Katharina Schratt). Her name for the wartime visits, 'Kammergarten' in the aides' log, dates 1 Aug-20 Dec 1914, an hour at most (Rauchensteiner, First World War and the End of the Habsburg Monarchy p. 633). Last saw him 19 Nov 1916, two white roses, Karl led her in (unofficialroyalty.com). Villa Felicitas (austria-forum). The Gugelhupf, no. 9 (memory)",
  },
  {
    id: "auh_ketterl",
    tag: "AUH",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["stubborn", "weary"],
    rivals: [],
    allies: [],
    fame: 1,
    source:
      "Eugen Ketterl 1859-1928, valet 1894 to 1916; the 3:30 greeting, breakfast at five, fourteen chamber staff, the telephone and the WC, the Emperor thanking him for a glass of water (habsburger.net, the valet de chambre); his account book, Der alte Kaiser (dorotheum.com, upenn catalogue). 'Why must it be now', the 3:30 call (roadstothegreatwar 2016). The nephew in the Fourth is invented",
  },
  {
    id: "auh_beck",
    tag: "AUH",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["stubborn", "weary"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "b. 21 Mar 1830, Freiburg; aide to Franz Joseph 1863-1881; the Emperor's confidential agent with Benedek before and after Königgrätz; chief of staff 1881-1906, replaced by Conrad at Franz Ferdinand's urging; count 1906; captain of the Arcièren guard; took his wife's name 1913; d. 9 Feb 1920 (en.wikipedia Friedrich von Beck-Rzikowsky). The wording of the telegrams of 1 Jul 1866 (memory)",
  },
  {
    id: "auh_valerie",
    tag: "AUH",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["stubborn", "cold"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "b. 22 Apr 1868, Buda; German with her father, a lifelong dislike of things Hungarian, her mother spoke her only Hungarian; married Franz Salvator at Ischl 1890; Wallsee; ten children, Agnes d. 1911; a hospital barracks in the castle; his son by Stephanie Richter, Franz Joseph, 1914, borne in silence; called caring for her father a trial (en.wikipedia Archduchess Marie Valerie). Hubert b. 1894 (same). His service, and Rudolf's farewell letter to her (memory)",
  },
  {
    id: "auh_sophie",
    tag: "AUH",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["cold", "stubborn"],
    rivals: [],
    allies: [],
    fame: 1,
    source:
      "Sophie von Hohenberg, b. 24 Jul 1901; brothers Max 1902, Ernst 1904; Jaroslav Thun guardian; met the Emperor in Jul 1914, 'a bit cool'; a stipend, the estate short of cash (en.wikipedia Princess Sophie of Hohenberg; histclo). In play only where Sarajevo took her parents",
  },
];

/** How each of them talks. */
export const AUH_PRIVATE_VOICE_NOTES: Readonly<Record<string, string>> = {
  auh_schratt:
    "배우. 수다스럽고 남의 말을 그 사람 목소리로 옮긴다. 폐하를 놀리는 단 한 사람이고, 놀린 뒤 '폐하' 한마디로 돌아온다. 해요체. 슬픈 말일수록 음식 얘기로 돌린다.",
  auh_ketterl:
    "시종. 상냥하고 실무적이다. 사람 말을 옮기지 않고 물건으로 말한다: 구두, 단추, 끈, 물. 자기 소관을 벗어나면 그렇다고 말한다.",
  auh_beck:
    "여든 넘은 전 참모총장. 황제보다 다섯 달 먼저 났고 그것을 빌미로 말한다. 건조하다. 전투를 날씨처럼 말하고 1866년을 '그 해'라고만 부른다. 콘라트는 '그 젊은이'다.",
  auh_valerie:
    "막내딸. 아버지와는 독일어로만 말한다. 해요체, '아버지'. 밥을 먹었는지부터 묻고 세어 둔다. 헝가리 말이 나오면 문을 찾는다. 할 말을 하다 말고 '아니에요'로 거둔다.",
  auh_sophie:
    "어른 앞에서 배운 대로 말하는 아이. 또박또박하고 묻지 말라는 것을 묻는다. 동생 이름을 대신 댄다. 자라서는 말이 더 짧아진다.",
};
