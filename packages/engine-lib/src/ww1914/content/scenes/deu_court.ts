import type {
  GwGauge,
  GwInstitution,
  GwOffice,
  GwSecret,
  GwTemperament,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  any,
  byName,
  candid,
  chose,
  flag,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReact,
  GwReply,
  GwReplyKind,
  GwScene,
  GwStance,
  GwVariant,
  GwWho,
  holder,
  keepPromise,
  memory,
  moody,
  not,
  promise,
  reason,
  remember,
  role,
  schedule,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Germany 1915-18, the court share: the `deu_k_` scenes, the summoned talks of
 * Bethmann Hollweg, Müller, the Crown Prince and Erzberger, five visits, and
 * the twelve closing paragraphs. Data only; the text is in
 * resources/ww1914/ko/DEU.court.json. Plan: ww135-plan-deu.md sections 1, 9,
 * 10, 11, 12, 15.
 */

const date = (from: string, to: string): GwCond =>
  world({ is: "date", from, to });
const known = (id: GwSecret): GwCond => world({ is: "known", id });
const reveal = (id: GwSecret): GwEffect => doWorld({ do: "reveal", id });
const tsarGone: GwCond = not(
  world({ is: "regime", tag: "RUS", of: ["tsar", "crown"] }),
);
const stopped: GwCond = world({ is: "armistice" });
const offerTalks: GwEffect = doWorld({ do: "talks" });
/** The wire to Wilson opens the notes; `sign` at their end stops the war. */
const sue: GwEffect = setFlag("f_deu_sued");
const nextRegime: GwEffect = doWorld({ do: "next_regime" });
const republic: GwCond = world({ is: "regime", of: ["republic"] });
const closeSeat: GwEffect = doWorld({ do: "close_seat" });
const sign: GwEffect[] = [doWorld({ do: "armistice", kind: "central_lost" })];

// ---- Shorthand ----

const NATION: GwScene["nation"] = ["DEU"];
const WAR: GwScene["stage"] = ["war"];

const who = role("who");
const cos = role("cos");

const R_CHANCELLOR = holder("chancellor");
const R_COS = holder("chief_of_staff");
const R_COURT = holder("court");
const R_FM = holder("foreign");
const R_NAVY = holder("navy");
const R_INTERIOR = holder("interior");
const LUD = { person: "deu_ludendorff" };
const VAL = { person: "deu_valentini" };

const war: GwCond = world({ is: "war" });
const peace: GwCond = not(war);
const atGBR: GwCond = { kind: "at_war", tag: "GBR" };
const atFRA: GwCond = { kind: "at_war", tag: "FRA" };
const pair: GwCond = flag("f_third_ohl");
const tied: GwCond = { kind: "inst", inst: "army", min: 4 };
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const beth: GwCond = holds("chancellor", "deu_bethmann");
const michaelisIn: GwCond = holds("chancellor", "deu_michaelis");
const maxIn: GwCond = holds("chancellor", "deu_max_baden");
const scoreMax = (max: number): GwCond => world({ is: "score", max });
const scoreMin = (min: number): GwCond => world({ is: "score", min });
const unrestMin = (min: number): GwCond => world({ is: "unrest", min });
const lost: GwCond = scoreMax(-25);
const instMax = (i: GwInstitution, max: number): GwCond => ({
  kind: "inst",
  inst: i,
  max,
});
const instMin = (i: GwInstitution, min: number): GwCond => ({
  kind: "inst",
  inst: i,
  min,
});
const gaugeMax = (gauge: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const keys = (...k: string[]): GwCond => any(...k.map((x) => memory(x)));
const chosen = (scene: string, ...picks: string[]): GwCond =>
  any(...picks.map((p) => chose(scene, p)));
/** Ludendorff beside the chief, or in the chair himself, and not sent away. */
const ludUp: GwCond = all(
  any(pair, holds("chief_of_staff", "deu_ludendorff")),
  not(flag("f_lud_out")),
);

const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const army = (d: number) => inst("army", d);
const reichstag = (d: number) => inst("reichstag", d);
const countersign = (d: number) => inst("countersign", d);
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });
const calm: GwEffect = doWorld({ do: "calm" });
const appoint = (person: string | GwWho, office: GwOffice): GwEffect => ({
  kind: "appoint",
  who: typeof person === "string" ? byName(person) : person,
  office,
});
const when = (c: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when: c,
  then,
});
const unflag = (f: string): GwEffect => ({ kind: "unflag", flag: f });
const pt = (w: GwWho, d: number): GwEffect => trustOf(w, d);

const v = (id: string, c?: GwCond): GwVariant =>
  c === undefined ? { id } : { id, when: c };
const t = (m: GwTemperament): GwVariant => v(m, moody(who, m));

const o = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  c?: GwCond,
): GwOption =>
  c === undefined ? { id, tell, effects } : { id, tell, effects, when: c };

type SceneBody = Omit<GwScene, "nation" | "id" | "kind">;
const scene = (id: string, kind: GwScene["kind"], s: SceneBody): GwScene => ({
  id,
  nation: NATION,
  kind,
  stage: WAR,
  once: true,
  ...s,
});

// ---- Talks ----

type ReplyMore = Partial<Omit<GwReply, "id" | "stance" | "kind" | "next">>;

const rep = (
  id: string,
  stance: GwStance,
  kind: GwReplyKind,
  next: string | null,
  x: ReplyMore = {},
): GwReply => ({ id, stance, kind, tell: [], effects: [], next, ...x });
const ask = (id: string, s: GwStance, next: string | null, x?: ReplyMore) =>
  rep(id, s, "ask", next, x);
const push = (id: string, s: GwStance, next: string | null, x?: ReplyMore) =>
  rep(id, s, "push", next, x);
const deal = (id: string, s: GwStance, next: string | null, x?: ReplyMore) =>
  rep(id, s, "deal", next, x);
const leave = (id: string, s: GwStance, x?: ReplyMore) =>
  rep(id, s, "leave", null, x);
const react = (
  c: GwCond,
  next: string | null,
  ...effects: GwEffect[]
): GwReact => ({
  when: c,
  next,
  effects,
});
const node = (says: GwVariant[], replies: GwReply[]): GwNode => ({
  says: [...says, v("base")],
  replies,
});
/** A node that closes: one line and a word to end on. */
const last = (says: GwVariant[], id = "end", s: GwStance = "warm"): GwNode =>
  node(says, [leave(id, s)]);

interface TalkMore {
  variants?: GwVariant[];
  salience?: number;
  cast?: GwScene["cast"];
}

const talk = (
  id: string,
  person: string,
  c: GwCond,
  nodes: Record<string, GwNode>,
  summon: boolean,
  x: TalkMore = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "talk",
  stage: WAR,
  when: c,
  cast: { who: { person }, ...x.cast },
  salience: x.salience ?? (summon ? 3 : 5),
  tags: ["people"],
  once: true,
  variants: [...(x.variants ?? []), v("base")],
  ...(summon ? { summon: true } : {}),
  who: "who",
  start: "open",
  nodes,
});
const audience = (
  id: string,
  person: string,
  c: GwCond,
  nodes: Record<string, GwNode>,
  x?: TalkMore,
) => talk(id, person, c, nodes, true, x);
const visit = (
  id: string,
  person: string,
  c: GwCond,
  nodes: Record<string, GwNode>,
  x?: TalkMore,
) => talk(id, person, c, nodes, false, x);

// ---- The shared moves of the scenes ----

/** The desk draws deu_k_new_chancellor on this: a schedule would deal it twice. */
const vacate: GwEffect[] = [setFlag("f_vac_chancellor")];
const filled: GwEffect = unflag("f_vac_chancellor");
const noteSent: GwEffect[] = [
  when(flag("f_note_2"), setFlag("f_note_3")),
  when(flag("f_note_1"), setFlag("f_note_2")),
  setFlag("f_note_1"),
];

export const DEU_COURT_SCENES: readonly GwScene[] = [
  // ---- The three scales, the new names ----
  scene("deu_k_new_year", "report", {
    when: date("1915-01", "1915-06"),
    cast: { chancellor: R_CHANCELLOR, cos: R_COS },
    salience: 9,
    tags: ["people"],
    stamp: "confirmed",
    source: "staff",
    variants: [
      v("peace", peace),
      v("paris", world({ is: "out", tag: "FRA" })),
      v("gbrout", all(atFRA, not(atGBR))),
      v("east1", world({ is: "plan", of: ["east"] })),
      v("base"),
    ],
  }),
  scene("deu_k_new_faces", "report", {
    when: date("1915-01", "1918-06"),
    cast: { court: R_COURT },
    salience: 7,
    tags: ["people"],
    once: false,
    cooldown: 10,
    stamp: "confirmed",
    source: "staff",
    variants: [
      v("spring15", date("1915-01", "1915-08")),
      v("autumn15", date("1915-09", "1916-06")),
      v("autumn16", date("1916-07", "1917-02")),
      v("year17", date("1917-03", "1917-12")),
      v("base"),
    ],
  }),
  scene("deu_k_war_aims_gag", "proposal", {
    when: all(
      war,
      date("1915-01", "1915-06"),
      any(flag("f_aims_full"), flag("f_aims_secret")),
    ),
    cast: { chancellor: R_CHANCELLOR, interior: R_INTERIOR },
    salience: 7,
    tags: ["home"],
    variants: [
      v("london", keys("told_lich_silent", "k_read_london")),
      v("full", flag("f_aims_full")),
      v("base"),
    ],
    fallback: "keep_ban",
    options: [
      o(
        "keep_ban",
        ["reichstag:+1", "army:-1"],
        [reichstag(1), army(-1), setFlag("f_aims_ban_kept")],
      ),
      o(
        "lift_ban",
        ["army:+1", "reichstag:-1", "order:-1"],
        [
          army(1),
          reichstag(-1),
          gauge("order", -1),
          setFlag("f_aims_ban_lifted"),
          reason("aims_ban_lifted"),
        ],
      ),
      o(
        "ban_both",
        ["reichstag:+1", "countersign:+1", "army:-1"],
        [
          reichstag(1),
          countersign(1),
          army(-1),
          setFlag("f_aims_ban_kept"),
          remember("m_ban_both"),
        ],
        memory("k_erz_belgium"),
      ),
    ],
  }),
  scene("deu_k_three_class", "proposal", {
    when: all(
      war,
      date("1915-07", "1916-12"),
      any(flag("f_franchise_word"), instMax("reichstag", 1)),
    ),
    cast: { chancellor: R_CHANCELLOR, interior: R_INTERIOR },
    salience: 7,
    tags: ["home"],
    variants: [
      v("word_given", flag("f_franchise_word")),
      v("cold", instMax("reichstag", -1)),
      v("base"),
    ],
    fallback: "not_now",
    options: [
      o(
        "not_now",
        ["reichstag:-1"],
        [reichstag(-1), reason("franchise_put_off")],
      ),
      o(
        "word_after_war",
        ["reichstag:+2", "army:-1"],
        [
          reichstag(2),
          army(-1),
          setFlag("f_franchise_word"),
          keepPromise(byName("deu_bethmann"), "p_beth_reform"),
        ],
        memory("k_beth_reform"),
      ),
      o(
        "draft_quietly",
        ["countersign:+1"],
        [countersign(1), setFlag("f_franchise_draft")],
      ),
    ],
  }),
  // ---- 1917: the word, the letters, the vote ----
  scene("deu_k_easter_message", "crisis", {
    when: all(
      war,
      date("1917-03", "1917-06"),
      any(tsarGone, unrestMin(1)),
      not(flag("f_easter_given")),
    ),
    cast: { chancellor: R_CHANCELLOR, interior: R_INTERIOR },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("promised", chosen("deu_k_three_class", "word_after_war")),
      v("strike", unrestMin(1)),
      v("ration", gaugeMax("bread", 1)),
      v("base"),
    ],
    fallback: "vague_word",
    options: [
      o(
        "vague_word",
        ["order:+1", "reichstag:+1"],
        [
          gauge("order", 1),
          reichstag(1),
          setFlag("f_easter_given"),
          reason("easter_vague"),
        ],
      ),
      o(
        "equal_vote_word",
        ["order:+1", "reichstag:+2", "army:-2"],
        [
          gauge("order", 1),
          reichstag(2),
          army(-2),
          calm,
          setFlag("f_easter_given"),
          setFlag("f_equal_vote"),
          keepPromise(byName("deu_bethmann"), "p_beth_reform"),
          keepPromise(byName("deu_ebert"), "p_ebert_franchise"),
          reason("easter_equal"),
        ],
        keys("k_beth_reform", "k_ebert_franchise"),
      ),
      o(
        "nothing",
        ["army:+1", "reichstag:-2", "order:-1"],
        [army(1), reichstag(-2), gauge("order", -1), reason("easter_nothing")],
      ),
    ],
  }),
  scene("deu_k_july_crisis", "crisis", {
    when: all(
      war,
      beth,
      date("1917-03", "1917-10"),
      instMin("army", 3),
      not(flag("f_july_done")),
    ),
    cast: { chancellor: R_CHANCELLOR, cos: R_COS, court: R_COURT },
    salience: 9,
    tags: ["people", "tension_up"],
    variants: [
      v("ring", known("deu_heir_ring")),
      v("stood", memory("m_beth_stand")),
      v("resolution", keys("k_erz_resolution")),
      v("tied", tied),
      v("one_man", not(pair)),
      v("base"),
    ],
    fallback: "let_chancellor_go",
    options: [
      o(
        "let_chancellor_go",
        ["army:+1", "countersign:-1"],
        [
          army(1),
          countersign(-1),
          setFlag("f_july_done"),
          ...vacate,
          reason("july_let_go"),
        ],
      ),
      o(
        "keep_chancellor",
        ["army:-1", "countersign:+1", "authority:-10"],
        [
          army(-1),
          countersign(1),
          authority(-10),
          setFlag("f_july_done"),
          pt(cos, -2),
          keepPromise(byName("deu_bethmann"), "p_beth_stand"),
          doWorld({ do: "letter", who: cos }),
          reason("july_kept"),
        ],
        instMax("army", 4),
      ),
      o(
        "call_bluff",
        ["army:-2", "countersign:+1"],
        [
          army(-2),
          countersign(1),
          setFlag("f_july_done"),
          setFlag("f_bluff_called"),
          pt(cos, -1),
          keepPromise(byName("deu_bethmann"), "p_beth_stand"),
          keepPromise(byName("deu_heir"), "p_heir_friends"),
          reason("july_bluff"),
        ],
        memory("k_hind_card"),
      ),
      o(
        "pick_own_man",
        ["countersign:+1", "reichstag:+1"],
        [
          countersign(1),
          reichstag(1),
          setFlag("f_july_done"),
          setFlag("f_own_chancellor"),
          appoint("deu_hertling", "chancellor"),
          reason("july_own_man"),
        ],
        memory("k_muller_valentini"),
      ),
      o(
        "pick_their_man",
        ["army:+2", "countersign:-2"],
        [
          army(2),
          countersign(-2),
          setFlag("f_july_done"),
          appoint("deu_michaelis", "chancellor"),
          reason("july_their_man"),
        ],
        memory("k_bauer_list"),
      ),
    ],
  }),
  scene("deu_k_peace_resolution", "crisis", {
    when: all(
      war,
      date("1917-03", "1917-12"),
      any(memory("k_erz_resolution"), instMax("reichstag", 0)),
    ),
    cast: { chancellor: R_CHANCELLOR, cos: R_COS },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("michaelis", michaelisIn),
      v("tied", tied),
      v("beth", beth),
      v("base"),
    ],
    fallback: "ignore",
    options: [
      o(
        "ignore",
        ["reichstag:-2"],
        [
          reichstag(-2),
          keepPromise(byName("deu_helfferich"), "p_helf_erz"),
          reason("resolution_ignored"),
        ],
      ),
      o(
        "accept_text",
        ["reichstag:+2", "army:-2"],
        [
          reichstag(2),
          army(-2),
          setFlag("f_resolution_taken"),
          offerTalks,
          reason("resolution_taken"),
        ],
      ),
      o(
        "interpret",
        ["reichstag:+1", "countersign:-1"],
        [
          reichstag(1),
          countersign(-1),
          setFlag("f_resolution_read"),
          reason("resolution_read"),
        ],
        memory("k_erz_helf"),
      ),
      o(
        "dissolve",
        ["army:+1", "reichstag:-3", "order:-1"],
        [
          army(1),
          reichstag(-3),
          gauge("order", -1),
          reason("resolution_dissolved"),
        ],
        instMin("army", 2),
      ),
    ],
  }),
  // A vacancy can open in any year, and the world can open one by itself.
  scene("deu_k_new_chancellor", "audience", {
    when: any(
      { kind: "office_empty", office: "chancellor" },
      flag("f_vac_chancellor"),
    ),
    cast: {
      court: R_COURT,
      cos: R_COS,
      first: {
        any_of: [
          { person: "deu_delbruck" },
          { person: "deu_helfferich" },
          { person: "deu_michaelis" },
          { person: "deu_hertling" },
        ],
      },
    },
    salience: 8,
    tags: ["people"],
    once: false,
    cooldown: 3,
    variants: [
      v("lost", scoreMax(-15)),
      v("july", chose("deu_k_july_crisis", "let_chancellor_go")),
      v("tied", tied),
      v("empty", { kind: "office_empty", office: "chancellor" }),
      v("base"),
    ],
    fallback: "first_name",
    options: [
      o(
        "first_name",
        ["countersign:+1", "army:-1"],
        [
          filled,
          countersign(1),
          army(-1),
          appoint(role("first"), "chancellor"),
        ],
      ),
      o(
        "michaelis",
        ["army:+1", "countersign:-1"],
        [
          filled,
          army(1),
          countersign(-1),
          appoint("deu_michaelis", "chancellor"),
        ],
        not(michaelisIn),
      ),
      o(
        "hertling",
        ["reichstag:+1"],
        [filled, reichstag(1), appoint("deu_hertling", "chancellor")],
        not(holds("chancellor", "deu_hertling")),
      ),
      o(
        "bulow",
        ["reichstag:+2", "authority:-10"],
        [
          filled,
          reichstag(2),
          authority(-10),
          appoint("deu_buelow", "chancellor"),
        ],
        memory("k_erz_resolution"),
      ),
      o(
        "max_baden",
        ["reichstag:+2", "army:-1"],
        [
          filled,
          reichstag(2),
          army(-1),
          appoint("deu_max_baden", "chancellor"),
        ],
        memory("k_max_terms"),
      ),
    ],
  }),
  scene("deu_k_interparty", "proposal", {
    when: all(
      war,
      date("1917-07", "1917-12"),
      memory("k_erz_resolution"),
      seen("deu_k_peace_resolution"),
    ),
    cast: { chancellor: R_CHANCELLOR },
    salience: 7,
    tags: ["home"],
    variants: [
      v("taken", chose("deu_k_peace_resolution", "accept_text")),
      v("base"),
    ],
    fallback: "ignore",
    options: [
      o("ignore", ["reichstag:-1"], [reichstag(-1)]),
      o(
        "send_chancellor",
        ["reichstag:+1", "countersign:-1"],
        [
          reichstag(1),
          countersign(-1),
          setFlag("f_interparty_heard"),
          when(michaelisIn, ...vacate, reason("michaelis_fell")),
        ],
      ),
      o(
        "receive_them",
        ["reichstag:+2", "army:-1"],
        [
          reichstag(2),
          army(-1),
          setFlag("f_interparty_heard"),
          setFlag("f_received_majority"),
        ],
        memory("k_ebert_first"),
      ),
    ],
  }),
  scene("deu_k_deputies_at_table", "audience", {
    when: all(
      war,
      date("1917-03", "1917-12"),
      memory("k_ebert_first"),
      memory("k_erz_numbers"),
    ),
    cast: { court: R_COURT },
    salience: 6,
    tags: ["people", "tension_down"],
    variants: [v("tied", tied), v("base")],
    fallback: "decline",
    options: [
      o("decline", ["reichstag:-1"], [reichstag(-1)]),
      o(
        "invite",
        ["reichstag:+2", "army:-1"],
        [
          reichstag(2),
          army(-1),
          setFlag("f_socialist_at_table"),
          reason("deputies_dined"),
        ],
      ),
      o(
        "invite_without_socialist",
        ["reichstag:+1"],
        [reichstag(1), remember("m_table_without_spd")],
      ),
    ],
  }),
  scene("deu_k_silent_rule", "report", {
    when: all(tied, date("1917-01", "1918-06")),
    cast: { court: R_COURT },
    salience: 8,
    tags: ["people"],
    once: false,
    cooldown: 8,
    stamp: "confirmed",
    source: "staff",
    variants: [
      v("new_chancellor", not(beth)),
      v("uboats", world({ is: "uboat", min: 2 })),
      v("base"),
    ],
  }),
  scene("deu_k_take_back", "crisis", {
    when: all(
      tied,
      ludUp,
      date("1917-01", "1918-06"),
      keys("k_muller_night", "k_groe_truth"),
    ),
    cast: { court: R_COURT, cos: R_COS, lud: LUD },
    salience: 7,
    tags: ["people", "tension_up"],
    variants: [
      v("groener", memory("k_groe_truth")),
      v("grey", instMin("army", 5)),
      v("base"),
    ],
    fallback: "not_now",
    options: [
      o("not_now", [], [reason("take_back_put_off")]),
      o(
        "part_the_pair",
        ["army:-3", "authority:-15"],
        [
          army(-3),
          authority(-15),
          setFlag("f_lud_out"),
          { kind: "dismiss", who: role("lud") },
          pt(cos, -2),
          reason("pair_parted"),
        ],
      ),
      o(
        "new_quartermaster",
        ["army:-2", "countersign:+1"],
        [
          army(-2),
          countersign(1),
          setFlag("f_lud_out"),
          setFlag("f_groener_quartermaster"),
          { kind: "dismiss", who: role("lud") },
          reason("quartermaster_changed"),
        ],
        memory("k_groe_truth"),
      ),
      o(
        "reichstag_with_you",
        ["army:-2", "reichstag:+2", "countersign:-1"],
        [
          army(-2),
          reichstag(2),
          countersign(-1),
          setFlag("f_reichstag_at_side"),
          reason("reichstag_at_side"),
        ],
        memory("k_ebert_first"),
      ),
    ],
  }),
  scene("deu_k_valentini_out", "audience", {
    when: all(tied, date("1917-10", "1918-06"), not(flag("f_valentini_out"))),
    cast: { court: R_COURT, cos: R_COS, val: VAL },
    salience: 7,
    tags: ["people", "tension_up"],
    variants: [v("own_man", flag("f_own_chancellor")), v("base")],
    fallback: "yield",
    options: [
      o(
        "yield",
        ["army:+1", "countersign:-1"],
        [
          army(1),
          countersign(-1),
          setFlag("f_valentini_out"),
          doWorld({ do: "leave", who: role("val") }),
          reason("valentini_gone"),
        ],
      ),
      o(
        "refuse",
        ["army:-1", "authority:-10"],
        [army(-1), authority(-10), pt(cos, -2), reason("valentini_kept")],
        instMax("army", 4),
      ),
      o(
        "trade",
        ["countersign:+1"],
        [
          countersign(1),
          setFlag("f_valentini_out"),
          doWorld({ do: "leave", who: role("val") }),
          remember("m_cabinet_kept"),
          reason("valentini_traded"),
        ],
        memory("k_muller_valentini"),
      ),
    ],
  }),
  scene("deu_k_princes", "proposal", {
    when: all(war, date("1916-07", "1918-06"), gaugeMax("order", 3)),
    cast: { chancellor: R_CHANCELLOR },
    salience: 5,
    tags: ["home"],
    variants: [v("hungry", gaugeMax("bread", 1)), v("base")],
    fallback: "words",
    options: [
      o("words", [], [reason("princes_answered")]),
      o(
        "hear_rupprecht",
        ["army:-1", "order:+1"],
        [army(-1), gauge("order", 1), remember("m_heard_south")],
        memory("k_rupp_view"),
      ),
      o(
        "call_princes",
        ["countersign:+1", "authority:-5"],
        [countersign(1), authority(-5), setFlag("f_princes_called")],
      ),
    ],
  }),
  // ---- The end ----
  scene("deu_k_spa", "crisis", {
    when: all(
      war,
      date("1917-10", "1918-12"),
      any(lost, seen("deu_f_black_day")),
      not(stopped),
    ),
    cast: { cos: R_COS, chancellor: R_CHANCELLOR, fm: R_FM },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("truth", memory("k_hind_truth")),
      v("hintze", holds("foreign", "deu_hintze")),
      v("taken_back", flag("f_lud_out")),
      v("one_man", not(pair)),
      v("deep", scoreMax(-40)),
      v("base"),
    ],
    fallback: "wire_wilson_now",
    options: [
      o(
        "wire_wilson_now",
        ["army:-1", "reichstag:-1", "morale:-1"],
        [
          army(-1),
          reichstag(-1),
          gauge("morale", -1),
          sue,
          setFlag("f_wire_wilson"),
          reason("spa_wired"),
        ],
      ),
      o(
        "one_more_line",
        ["army:+1", "morale:-1", "order:-1"],
        [
          army(1),
          gauge("morale", -1),
          gauge("order", -1),
          reason("spa_held"),
          schedule("deu_k_spa_again", 2),
        ],
      ),
      o(
        "parliament_first",
        ["army:-2", "reichstag:+2"],
        [
          army(-2),
          reichstag(2),
          sue,
          setFlag("f_wire_wilson"),
          setFlag("f_parliament_told"),
          reason("spa_parliament"),
        ],
        keys("k_hind_truth", "k_ebert_breach"),
      ),
      o(
        "sue_paris",
        ["army:-1", "ally:-1"],
        [
          army(-1),
          { kind: "trust", tag: "AUH", delta: -1 },
          offerTalks,
          setFlag("f_wire_wilson"),
          setFlag("f_paris_line"),
          reason("spa_paris"),
        ],
        memory("k_kuhl_arms"),
      ),
    ],
  }),
  // What "one more line" comes back to: the same paper, two months older.
  {
    id: "deu_k_spa_again",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    cast: { cos: R_COS, chancellor: R_CHANCELLOR },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    scheduledOnly: true,
    variants: [v("base")],
    fallback: "wire_now",
    options: [
      o(
        "wire_now",
        ["army:-1", "morale:-1"],
        [
          army(-1),
          gauge("morale", -1),
          sue,
          setFlag("f_wire_wilson"),
          reason("spa_wired_late"),
        ],
      ),
      o(
        "parliament_now",
        ["army:-2", "reichstag:+1"],
        [
          army(-2),
          reichstag(1),
          sue,
          setFlag("f_wire_wilson"),
          setFlag("f_parliament_told"),
        ],
      ),
    ],
  },
  scene("deu_k_parliament_rule", "crisis", {
    when: all(war, flag("f_wire_wilson"), not(stopped)),
    cast: { chancellor: R_CHANCELLOR, court: R_COURT },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("max_in", maxIn),
      v("told", flag("f_parliament_told")),
      v("hertling", holds("chancellor", "deu_hertling")),
      v("base"),
    ],
    fallback: "max_baden",
    options: [
      o(
        "max_baden",
        ["reichstag:+2", "army:-1"],
        [
          reichstag(2),
          army(-1),
          appoint("deu_max_baden", "chancellor"),
          setFlag("f_parliament_rule"),
          reason("parliament_max"),
        ],
      ),
      o(
        "ebert_cabinet",
        ["reichstag:+3", "army:-2", "order:+1"],
        [
          reichstag(3),
          army(-2),
          gauge("order", 1),
          appoint("deu_max_baden", "chancellor"),
          setFlag("f_parliament_rule"),
          setFlag("f_ebert_cabinet"),
          reason("parliament_ebert"),
        ],
        memory("k_ebert_breach"),
      ),
      o(
        "keep_hertling",
        ["reichstag:-2", "order:-1"],
        [reichstag(-2), gauge("order", -1), reason("parliament_refused")],
      ),
    ],
  }),
  scene("deu_k_wilson_notes", "crisis", {
    when: all(
      war,
      flag("f_wire_wilson"),
      not(flag("f_paris_line")),
      not(flag("f_note_3")),
      not(stopped),
    ),
    cast: { fm: R_FM, chancellor: R_CHANCELLOR },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: false,
    cooldown: 1,
    variants: [
      v("third", flag("f_note_2")),
      v("second", flag("f_note_1")),
      v("tied", tied),
      v("base"),
    ],
    fallback: "answer_soft",
    options: [
      o(
        "answer_soft",
        ["army:-1"],
        [army(-1), ...noteSent, reason("note_answered")],
      ),
      o(
        "refuse_terms",
        ["army:+1", "reichstag:-1", "order:-1"],
        [
          army(1),
          reichstag(-1),
          gauge("order", -1),
          ...noteSent,
          reason("note_refused"),
        ],
      ),
      o(
        "offer_abdication_hint",
        ["order:+1", "authority:-10"],
        [
          gauge("order", 1),
          authority(-10),
          ...noteSent,
          setFlag("f_abdication_hinted"),
          reason("note_hinted"),
        ],
        memory("k_max_terms"),
      ),
    ],
  }),
  scene("deu_k_ludendorff_out", "audience", {
    when: all(war, flag("f_wire_wilson"), ludUp, flag("f_note_1")),
    cast: { chancellor: R_CHANCELLOR, cos: R_COS, lud: LUD },
    salience: 8,
    tags: ["people"],
    variants: [
      v("reversed", chose("deu_k_wilson_notes", "refuse_terms")),
      v("nerves", { kind: "health", who: role("lud"), max: 1 }),
      v("base"),
    ],
    fallback: "accept_letter",
    options: [
      o(
        "accept_letter",
        ["army:-2", "reichstag:+1"],
        [
          army(-2),
          reichstag(1),
          setFlag("f_lud_out"),
          doWorld({ do: "leave", who: role("lud") }),
          reason("lud_gone"),
        ],
      ),
      o(
        "keep_him",
        ["army:+1", "reichstag:-2"],
        [army(1), reichstag(-2), reason("lud_kept")],
      ),
      o(
        "groener_next",
        ["army:-2", "reichstag:+1", "order:+1"],
        [
          army(-2),
          reichstag(1),
          gauge("order", 1),
          setFlag("f_lud_out"),
          setFlag("f_groener_quartermaster"),
          doWorld({ do: "leave", who: role("lud") }),
          reason("lud_groener"),
        ],
        memory("k_groe_truth"),
      ),
    ],
  }),
  scene("deu_k_last_sortie", "crisis", {
    when: all(atGBR, flag("f_wire_wilson"), date("1918-01", "1918-12")),
    cast: { navy: R_NAVY, court: R_COURT },
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      v(
        "told_scheer",
        all(known("deu_fleet_plan_oct"), holds("navy", "deu_scheer")),
      ),
      v("told", known("deu_fleet_plan_oct")),
      v("base"),
    ],
    fallback: "not_told",
    options: [
      o("not_told", [], [setFlag("f_sortie_ordered"), reason("sortie_unseen")]),
      o(
        "forbid",
        ["army:-1", "order:+1"],
        [army(-1), gauge("order", 1), reason("sortie_forbidden")],
        all(memory("k_muller_fleet"), known("deu_fleet_plan_oct")),
      ),
      o(
        "allow",
        ["army:+1", "order:-2"],
        [
          army(1),
          gauge("order", -2),
          setFlag("f_sortie_ordered"),
          reason("sortie_allowed"),
        ],
        known("deu_fleet_plan_oct"),
      ),
    ],
  }),
  scene("deu_k_kiel", "crisis", {
    when: all(
      date("1918-01", "1918-12"),
      any(unrestMin(3), flag("f_sortie_ordered")),
    ),
    cast: { navy: R_NAVY, interior: R_INTERIOR },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("spread", unrestMin(4)),
      v("sortie", flag("f_sortie_ordered")),
      v("forbidden", chose("deu_k_last_sortie", "forbid")),
      v("base"),
    ],
    fallback: "send_noske",
    options: [
      o(
        "send_noske",
        ["order:+1", "reichstag:+1", "army:-1"],
        [calm, gauge("order", 1), reichstag(1), army(-1), reason("kiel_noske")],
      ),
      o(
        "send_troops",
        ["army:+1", "order:-2"],
        [
          army(1),
          gauge("order", -2),
          setFlag("f_kiel_troops"),
          reason("kiel_troops"),
        ],
      ),
      o(
        "amnesty_word",
        ["order:+2", "army:-2"],
        [calm, gauge("order", 2), army(-2), reason("kiel_amnesty")],
        memory("k_haase_fleet"),
      ),
    ],
  }),
  scene("deu_k_abdication", "crisis", {
    when: all(
      any(flag("f_note_1"), flag("f_paris_line")),
      any(unrestMin(3), lost),
      not(stopped),
    ),
    cast: { chancellor: R_CHANCELLOR, cos: R_COS, court: R_COURT },
    salience: 9,
    tags: ["people", "tension_up"],
    variants: [
      v("hinted", flag("f_abdication_hinted")),
      v("father", memory("k_heir_father")),
      v("max", maxIn),
      v("kiel", seen("deu_k_kiel")),
      v("base"),
    ],
    fallback: "refuse",
    options: [
      o(
        "refuse",
        ["army:+1", "order:-1"],
        [
          army(1),
          gauge("order", -1),
          setFlag("f_kaiser_refused"),
          reason("abdication_refused"),
        ],
      ),
      o(
        "emperor_only",
        ["order:+1", "reichstag:-1"],
        [
          gauge("order", 1),
          reichstag(-1),
          setFlag("f_abdicated"),
          setFlag("f_prussia_kept"),
          reason("abdication_half"),
        ],
      ),
      o(
        "abdicate_for_grandson",
        ["order:+2", "reichstag:+1"],
        [
          calm,
          gauge("order", 2),
          reichstag(1),
          setFlag("f_abdicated"),
          setFlag("f_grandson"),
          reason("abdication_grandson"),
        ],
        memory("k_heir_father"),
      ),
      o(
        "regency",
        ["order:+2", "reichstag:+2"],
        [
          calm,
          gauge("order", 2),
          reichstag(2),
          setFlag("f_abdicated"),
          setFlag("f_regency"),
          reason("abdication_regency"),
        ],
        memory("k_max_terms"),
      ),
    ],
  }),
  scene("deu_k_army_answer", "crisis", {
    when: all(seen("deu_k_abdication"), unrestMin(3), not(stopped)),
    cast: { cos: R_COS, court: R_COURT },
    salience: 9,
    tags: ["people", "tension_up"],
    variants: [
      v("refused", flag("f_kaiser_refused")),
      v("groener", flag("f_groener_quartermaster")),
      v("base"),
    ],
    fallback: "lead_army_home",
    options: [
      o(
        "lead_army_home",
        ["order:-1"],
        [gauge("order", -1), setFlag("f_note_from_spa"), reason("army_no")],
      ),
      o(
        "leave_for_holland",
        ["order:+1"],
        [
          gauge("order", 1),
          setFlag("f_note_from_spa"),
          setFlag("f_holland"),
          reason("holland"),
        ],
      ),
      o(
        "stay_in_berlin",
        ["army:-1", "morale:+1"],
        [
          army(-1),
          gauge("morale", 1),
          setFlag("f_stayed_berlin"),
          reason("stayed_berlin"),
        ],
        memory("k_heir_holland"),
      ),
    ],
  }),
  scene("deu_k_republic", "crisis", {
    when: unrestMin(4),
    cast: { chancellor: R_CHANCELLOR },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("ebert", all(memory("k_ebert_breach"), flag("f_ebert_cabinet"))),
      v("abdicated", flag("f_abdicated")),
      v("base"),
    ],
    fallback: "close_seat",
    options: [
      o("close_seat", ["ends_game"], [closeSeat]),
      o(
        "go_on_as_ebert",
        ["order:+1", "reichstag:+2"],
        [
          nextRegime,
          gauge("order", 1),
          reichstag(2),
          appoint("deu_ebert", "chancellor"),
          setFlag("f_seat_ebert"),
          reason("republic_ebert"),
        ],
        memory("k_ebert_breach"),
      ),
      o(
        "go_on_as_regent",
        ["order:+1", "reichstag:+1"],
        [
          nextRegime,
          gauge("order", 1),
          reichstag(1),
          setFlag("f_seat_regent"),
          reason("republic_regent"),
        ],
      ),
    ],
  }),
  scene("deu_k_armistice_terms", "crisis", {
    when: any(stopped, flag("f_note_3"), flag("f_paris_line")),
    cast: { fm: R_FM, cos: R_COS },
    salience: 9,
    tags: ["foreign", "tension_up"],
    variants: [
      v("republic", republic),
      v("hunger", gaugeMax("bread", 0)),
      v("groener", flag("f_groener_quartermaster")),
      v("base"),
    ],
    fallback: "civilian_signs",
    options: [
      o(
        "civilian_signs",
        ["ends_game"],
        [setFlag("f_civilian_signed"), remember("m_civilian_signed"), ...sign],
      ),
      o(
        "general_signs",
        ["ends_game", "army:-2"],
        [
          army(-2),
          setFlag("f_general_signed"),
          keepPromise(byName("deu_erzberger"), "p_erz_cover"),
          ...sign,
        ],
        memory("k_erz_compiegne"),
      ),
      o(
        "refuse",
        ["army:+1", "order:-2", "morale:-1"],
        [
          army(1),
          gauge("order", -2),
          gauge("morale", -1),
          unflag("f_note_3"),
          reason("terms_refused"),
        ],
      ),
    ],
  }),
  {
    id: "deu_k_closing",
    nation: NATION,
    kind: "ledger",
    stage: ["closing"],
    // The 1914 row closes with deu_w_closing, at chapter 11.
    when: { kind: "chapter", min: 12 },
    cast: { chancellor: R_CHANCELLOR },
    salience: 9,
    tags: ["home"],
    once: true,
    variants: [
      v("peace", peace),
      v("republic", republic),
      v("hunger", gaugeMax("bread", 0)),
      v("won", scoreMin(15)),
      v("lost", scoreMax(-15)),
      v("base"),
    ],
    fallback: "close_year",
    options: [o("close_year", [], [])],
  },
  // ---- The years without the war ----
  scene("deu_k_peace_reichstag", "proposal", {
    when: all(peace, date("1915-01", "1916-12")),
    cast: { chancellor: R_CHANCELLOR, interior: R_INTERIOR },
    salience: 6,
    tags: ["home"],
    variants: [
      v("army_asks", instMin("army", 2)),
      v("left", instMax("reichstag", 0)),
      v("base"),
    ],
    fallback: "small_bill",
    options: [
      o("small_bill", ["reichstag:+1"], [reichstag(1), army(-1)]),
      o(
        "franchise_deal",
        ["reichstag:+2", "army:-1", "countersign:+1"],
        [
          reichstag(2),
          army(-1),
          countersign(1),
          setFlag("f_franchise_word"),
          keepPromise(byName("deu_bethmann"), "p_beth_reform"),
        ],
        memory("k_beth_reform"),
      ),
      o(
        "army_bill",
        ["army:+2", "reichstag:-2", "money:-1"],
        [army(2), reichstag(-2), gauge("money", -1)],
      ),
    ],
  }),
  scene("deu_k_peace_close", "proposal", {
    when: all(peace, date("1915-07", "1918-12"), seen("deu_k_peace_reichstag")),
    cast: { chancellor: R_CHANCELLOR },
    salience: 7,
    tags: ["home", "tension_down"],
    once: false,
    cooldown: 6,
    variants: [v("late", date("1916-07", "1918-12")), v("base")],
    fallback: "go_on",
    options: [
      o("go_on", [], []),
      o(
        "close_as_peace",
        ["ends_game"],
        [{ kind: "end", ending: "long_peace" }],
      ),
      o("one_more_budget", ["money:+1"], [gauge("money", 1)]),
    ],
  }),

  // ---- Bethmann Hollweg ----
  audience(
    "deu_t2_beth_reform",
    "deu_bethmann",
    all(beth, date("1915-01", "1917-06")),
    {
      open: node(
        [t("anxious"), t("weary")],
        [
          ask("trenches", "frank", "trenches"),
          push("draft", "threat", "draft", {
            tell: ["trust:-1"],
            effects: [pt(who, -1), remember("k_beth_reform")],
            reacts: [react(moody(who, "anxious"), "afraid", pt(who, -1))],
          }),
          deal("word", "warm", "word", {
            tell: ["promise", "army:-1"],
            effects: [
              army(-1),
              promise(who, "p_beth_reform", 18),
              remember("k_beth_reform"),
            ],
          }),
          leave("later", "cold"),
        ],
      ),
      trenches: node(
        [],
        [
          ask("herrenhaus", "cold", "lords", {
            effects: [remember("k_beth_reform")],
          }),
          deal("word", "warm", "word", {
            tell: ["promise", "army:-1"],
            effects: [
              army(-1),
              promise(who, "p_beth_reform", 18),
              remember("k_beth_reform"),
            ],
          }),
          leave("enough", "warm"),
        ],
      ),
      lords: last([]),
      draft: last([]),
      afraid: last([], "end", "cold"),
      word: last([]),
    },
  ),
  audience(
    "deu_t2_beth_uboat",
    "deu_bethmann",
    all(beth, atGBR, date("1915-01", "1916-06")),
    {
      open: node(
        [t("anxious")],
        [
          ask("sum", "frank", "sum"),
          push("yield", "cold", "hurt", {
            tell: ["countersign:-1"],
            effects: [countersign(-1)],
            reacts: [react(moody(who, "weary"), "sum")],
          }),
          deal("trade", "warm", "sum", {
            tell: ["army:-1", "countersign:+1"],
            effects: [army(-1), countersign(1), remember("k_beth_uboat")],
          }),
          leave("enough", "cold"),
        ],
      ),
      sum: node(
        [],
        [
          ask("america", "cold", "washington", {
            effects: [remember("k_beth_uboat")],
          }),
          ask("admirals", "frank", "admirals"),
          leave("noted", "warm"),
        ],
      ),
      admirals: node(
        [],
        [
          ask("america", "cold", "washington", {
            effects: [remember("k_beth_uboat")],
          }),
          leave("noted", "warm"),
        ],
      ),
      washington: last([]),
      hurt: last([], "end", "cold"),
    },
  ),
  audience(
    "deu_t2_beth_terms",
    "deu_bethmann",
    all(beth, date("1916-01", "1917-06")),
    {
      open: node(
        [t("weary")],
        [
          ask("how", "frank", "paper"),
          push("write", "threat", "paper", {
            tell: ["trust:-1"],
            effects: [pt(who, -1)],
            reacts: [react(moody(who, "anxious"), "fear")],
          }),
          deal("cover", "warm", "paper", {
            tell: ["countersign:+1", "army:-1"],
            effects: [countersign(1), army(-1), remember("k_beth_terms")],
          }),
          leave("not_yet", "cold"),
        ],
      ),
      paper: node(
        [],
        [
          ask("clause", "cold", "clause", {
            effects: [remember("k_beth_terms")],
          }),
          ask("angry", "frank", "angry"),
          leave("think", "warm"),
        ],
      ),
      angry: node(
        [],
        [
          ask("clause", "cold", "clause", {
            effects: [remember("k_beth_terms")],
          }),
          leave("think", "warm"),
        ],
      ),
      clause: last([]),
      fear: last([], "end", "cold"),
    },
  ),
  audience(
    "deu_t2_beth_pless",
    "deu_bethmann",
    all(beth, seen("deu_s_table"), date("1916-07", "1917-06")),
    {
      open: node(
        [t("anxious")],
        [
          ask("if_signed", "frank", "end_of_him"),
          push("with_me", "cold", "hollow", {
            tell: ["countersign:-1"],
            effects: [countersign(-1), remember("m_beth_pressed")],
            reacts: [react(moody(who, "weary"), "end_of_him")],
          }),
          deal("hold", "warm", "held", {
            tell: ["promise"],
            effects: [
              promise(who, "p_beth_pless", 6, {
                keep: chosen("deu_s_pless", "not_yet", "wait_for_wilson"),
              }),
            ],
          }),
          leave("noted", "cold"),
        ],
      ),
      end_of_him: node(
        [v("straight", candid(who))],
        [
          deal("hold", "warm", "held", {
            tell: ["promise"],
            effects: [
              promise(who, "p_beth_pless", 6, {
                keep: chosen("deu_s_pless", "not_yet", "wait_for_wilson"),
              }),
            ],
          }),
          leave("noted", "warm"),
        ],
      ),
      hollow: last([], "end", "cold"),
      held: last([]),
    },
  ),
  audience(
    "deu_t2_beth_sign",
    "deu_bethmann",
    all(beth, tied, date("1917-01", "1917-12")),
    {
      open: node(
        [t("weary")],
        [
          ask("who", "cold", "who"),
          push("stay", "threat", "stiff", {
            tell: ["trust:-1"],
            effects: [pt(who, -1)],
            reacts: [react(moody(who, "anxious"), "who")],
          }),
          deal("stand", "frank", "stand", {
            tell: ["promise", "army:-1"],
            effects: [
              army(-1),
              promise(who, "p_beth_stand", 8),
              remember("m_beth_stand"),
            ],
          }),
          leave("go_on", "warm"),
        ],
      ),
      who: node(
        [v("straight", candid(who))],
        [
          deal("stand", "frank", "stand", {
            tell: ["promise", "army:-1"],
            effects: [
              army(-1),
              promise(who, "p_beth_stand", 8),
              remember("m_beth_stand"),
            ],
          }),
          leave("noted", "cold"),
        ],
      ),
      stiff: last([], "end", "cold"),
      stand: last([]),
    },
  ),
  audience(
    "deu_t2_beth_after",
    "deu_bethmann",
    all(not(beth), date("1917-07", "1918-12")),
    {
      open: node(
        [v("broken", memory("broke_p_beth_stand")), t("weary")],
        [
          ask("heir", "frank", "weight"),
          push("come_back", "flatter", "no_return", {
            tell: ["reichstag:+1"],
            effects: [reichstag(1)],
            reacts: [react(moody(who, "anxious"), "no_return")],
          }),
          deal("write", "warm", "memoir", {
            tell: ["trust:+1"],
            effects: [pt(who, 1), remember("m_beth_memoir")],
          }),
          leave("trees", "warm"),
        ],
      ),
      weight: node(
        [v("max", maxIn), v("michaelis", michaelisIn)],
        [
          deal("write", "warm", "memoir", {
            tell: ["trust:+1"],
            effects: [pt(who, 1), remember("m_beth_memoir")],
          }),
          leave("thanks", "warm"),
        ],
      ),
      no_return: last([]),
      memoir: last([]),
    },
  ),

  // ---- Müller ----
  audience(
    "deu_t2_muller_night",
    "deu_muller",
    all(any(war, tied), date("1915-01", "1918-06")),
    {
      open: node(
        [t("cunning"), t("weary")],
        [
          ask("who_sleeps", "warm", "health"),
          push("all_of_it", "cold", "half", {
            effects: [remember("k_muller_night")],
            reacts: [react(moody(who, "cunning"), "turned")],
          }),
          deal("door", "frank", "door", {
            tell: ["audiences:-1"],
            effects: [
              { kind: "audiences", delta: -1 },
              remember("k_muller_night"),
            ],
          }),
          leave("sleep", "warm"),
        ],
      ),
      health: node(
        [
          v("chief_bad", {
            kind: "health",
            who: { office: "chief_of_staff" },
            max: 1,
          }),
          v("chancellor_bad", {
            kind: "health",
            who: { office: "chancellor" },
            max: 1,
          }),
        ],
        [
          ask("what_then", "frank", "half", {
            effects: [remember("k_muller_night")],
          }),
          leave("thanks", "warm"),
        ],
      ),
      half: last([]),
      turned: last([], "end", "cold"),
      door: last([]),
    },
  ),
  audience(
    "deu_t2_muller_terms",
    "deu_muller",
    all(war, date("1916-01", "1917-06")),
    {
      open: node(
        [t("cold")],
        [
          ask("what_was", "frank", "old"),
          push("find_it", "cold", "old", {
            effects: [remember("k_muller_terms")],
            reacts: [react(moody(who, "cunning"), "rights")],
          }),
          deal("guard", "warm", "rights", {
            tell: ["army:-1"],
            effects: [army(-1), remember("k_muller_terms")],
          }),
          leave("leave_it", "warm"),
        ],
      ),
      old: node(
        [],
        [
          ask("today", "frank", "rights", {
            effects: [remember("k_muller_terms")],
          }),
          leave("leave_it", "cold"),
        ],
      ),
      rights: last([]),
    },
  ),
  audience(
    "deu_t2_muller_valentini",
    "deu_muller",
    all(date("1916-07", "1918-06"), not(flag("f_valentini_out"))),
    {
      open: node(
        [v("tied", tied)],
        [
          ask("friend", "warm", "friend"),
          push("use_him", "cold", "hands", {
            effects: [remember("k_muller_valentini")],
            reacts: [react(moody(who, "weary"), "friend")],
          }),
          deal("shield", "frank", "hands", {
            tell: ["army:-1"],
            effects: [army(-1), remember("k_muller_valentini")],
          }),
          leave("noted", "cold"),
        ],
      ),
      friend: node(
        [],
        [
          ask("names", "frank", "hands", {
            effects: [remember("k_muller_valentini")],
          }),
          leave("noted", "warm"),
        ],
      ),
      hands: last([]),
    },
  ),
  audience(
    "deu_t2_muller_fleet",
    "deu_muller",
    all(atGBR, date("1916-01", "1918-12")),
    {
      open: node(
        [v("late", date("1918-07", "1918-12"))],
        [
          ask("whose", "frank", "whose"),
          push("order", "cold", "whose", {
            effects: [remember("k_muller_fleet")],
            reacts: [react(moody(who, "cunning"), "cabinet")],
          }),
          deal("your_men", "warm", "cabinet", {
            tell: ["trust:+1", "army:-1"],
            effects: [pt(who, 1), army(-1), remember("k_muller_fleet")],
          }),
          leave("noted", "cold"),
        ],
      ),
      whose: node(
        [v("oct", date("1918-07", "1918-12"))],
        [
          ask("orders_where", "frank", "cabinet", {
            effects: [
              remember("k_muller_fleet"),
              when(date("1918-07", "1918-12"), reveal("deu_fleet_plan_oct")),
            ],
          }),
          leave("noted", "warm"),
        ],
      ),
      cabinet: last([v("oct", known("deu_fleet_plan_oct"))]),
    },
  ),
  audience(
    "deu_t2_muller_heir",
    "deu_muller",
    all(
      date("1915-01", "1917-12"),
      any(holds("navy", "deu_tirpitz"), seen("deu_k_july_crisis")),
    ),
    {
      open: node(
        [t("cunning")],
        [
          ask("table", "frank", "table"),
          push("names", "threat", "shut", {
            tell: ["trust:-1"],
            effects: [pt(who, -1)],
            reacts: [
              react(
                { kind: "person_trust", who, min: 2 },
                "table",
                remember("k_muller_heir"),
              ),
            ],
          }),
          deal("no_diary", "warm", "table", {
            tell: ["trust:+1"],
            effects: [pt(who, 1), remember("k_muller_heir")],
          }),
          leave("noted", "cold"),
        ],
      ),
      table: node(
        [v("straight", candid(who))],
        [
          ask("how_far", "frank", "ring", {
            effects: [remember("k_muller_heir"), reveal("deu_heir_ring")],
          }),
          leave("noted", "warm"),
        ],
      ),
      ring: last([]),
      shut: last([], "end", "cold"),
    },
  ),
  audience(
    "deu_t2_muller_diary",
    "deu_muller",
    all(date("1917-07", "1918-12"), { kind: "person_trust", who, min: 2 }),
    {
      open: node(
        [t("weary")],
        [
          ask("worst", "frank", "worst"),
          push("read", "threat", "closed", {
            tell: ["trust:-1"],
            effects: [pt(who, -1)],
          }),
          deal("keep_you", "warm", "kept", {
            tell: ["promise"],
            effects: [
              promise(who, "p_muller_diary", 12, {
                keep: all(
                  seen("deu_k_abdication"),
                  holds("court", "deu_muller"),
                ),
              }),
            ],
          }),
          leave("noted", "cold"),
        ],
      ),
      worst: node(
        [
          v("signed", chosen("deu_s_pless", "sign")),
          v("july", chose("deu_k_july_crisis", "let_chancellor_go")),
        ],
        [
          deal("keep_you", "warm", "kept", {
            tell: ["promise"],
            effects: [
              promise(who, "p_muller_diary", 12, {
                keep: all(
                  seen("deu_k_abdication"),
                  holds("court", "deu_muller"),
                ),
              }),
              remember("m_muller_line"),
            ],
          }),
          leave("thanks", "warm", { effects: [remember("m_muller_line")] }),
        ],
      ),
      closed: last([], "end", "cold"),
      kept: last([]),
    },
  ),

  // ---- The Crown Prince ----
  audience(
    "deu_t2_heir_verdun",
    "deu_heir",
    all(
      date("1915-07", "1916-06"),
      any(flag("f_heir_army"), flag("f_heir_minder"), memory("heir_refused")),
    ),
    {
      open: node(
        [
          v("refused", memory("heir_refused")),
          v("forward", memory("heir_said_go_forward")),
          t("arrogant"),
        ],
        [
          ask("what_see", "frank", "meuse"),
          push("be_general", "cold", "sulk", {
            tell: ["trust:-1"],
            effects: [pt(who, -1)],
            reacts: [react(moody(who, "cunning"), "meuse")],
          }),
          deal("say_it", "warm", "chief", {
            tell: ["army:-1"],
            effects: [army(-1), remember("k_heir_verdun")],
          }),
          leave("go_back", "cold"),
        ],
      ),
      meuse: node(
        [],
        [
          ask("chief_says", "frank", "chief", {
            effects: [remember("k_heir_verdun")],
          }),
          push("hero", "flatter", "chief", {
            effects: [{ kind: "pride", who, delta: 1 }],
            reacts: [
              react(moody(who, "arrogant"), "sulk", {
                kind: "pride",
                who,
                delta: 1,
              }),
            ],
          }),
          leave("go_back", "warm"),
        ],
      ),
      chief: last([]),
      sulk: last([], "end", "cold"),
    },
  ),
  audience(
    "deu_t2_heir_stop",
    "deu_heir",
    all(seen("deu_f_verdun_plan"), date("1916-01", "1916-12")),
    {
      open: node(
        [t("arrogant")],
        [
          ask("how_many", "frank", "counted"),
          push("chief_says_go", "cold", "boy", {
            effects: [],
            reacts: [react(moody(who, "cunning"), "counted")],
          }),
          deal("your_word", "warm", "paper", {
            tell: ["army:-1"],
            effects: [army(-1), remember("k_heir_stop")],
          }),
          leave("not_your_place", "threat", {
            tell: ["trust:-1"],
            effects: [pt(who, -1)],
          }),
        ],
      ),
      counted: node(
        [],
        [
          ask("will_you", "warm", "paper", {
            effects: [remember("k_heir_stop")],
          }),
          leave("heard", "frank"),
        ],
      ),
      boy: last([], "end", "cold"),
      paper: last([]),
    },
  ),
  audience(
    "deu_t2_heir_bauer",
    "deu_heir",
    all(war, date("1916-01", "1917-12")),
    {
      open: node(
        [t("cunning")],
        [
          ask("what_talk", "warm", "talk"),
          push("drop_him", "threat", "stiff", {
            tell: ["trust:-1"],
            effects: [pt(who, -1)],
            reacts: [react(moody(who, "arrogant"), "stiff", pt(who, -1))],
          }),
          deal("friends", "frank", "friends", {
            tell: ["promise"],
            effects: [promise(who, "p_heir_friends", 12)],
          }),
          leave("tell_mother", "warm"),
        ],
      ),
      talk: node(
        [v("straight", candid(who))],
        [
          ask("list", "cold", "list", {
            effects: [reveal("deu_heir_ring")],
          }),
          deal("friends", "frank", "friends", {
            tell: ["promise"],
            effects: [promise(who, "p_heir_friends", 12)],
          }),
          leave("tell_mother", "cold"),
        ],
      ),
      list: last([]),
      stiff: last([], "end", "cold"),
      friends: last([]),
    },
  ),
  audience(
    "deu_t2_heir_chancellor",
    "deu_heir",
    all(beth, date("1917-01", "1917-12")),
    {
      open: node(
        [t("arrogant")],
        [
          ask("what_said", "frank", "said"),
          push("who_sent", "cold", "bluster", {
            reacts: [react(moody(who, "cunning"), "said")],
          }),
          deal("in_the_open", "warm", "open_door", {
            tell: ["reichstag:+1", "countersign:-1"],
            effects: [
              reichstag(1),
              countersign(-1),
              remember("m_heir_deputies"),
            ],
          }),
          leave("son", "warm"),
        ],
      ),
      said: node(
        [v("straight", candid(who))],
        [
          ask("promised", "cold", "promised", {
            effects: [reveal("deu_heir_ring")],
          }),
          leave("son", "warm"),
        ],
      ),
      bluster: last([], "end", "cold"),
      promised: last([]),
      open_door: last([]),
    },
  ),
  audience(
    "deu_t2_heir_father",
    "deu_heir",
    all(date("1918-01", "1918-12"), any(lost, scoreMax(-10))),
    {
      open: node(
        [t("cunning")],
        [
          ask("babelsberg", "frank", "paper"),
          push("are_you_ready", "cold", "ready", {
            reacts: [react(moody(who, "arrogant"), "not_me")],
          }),
          deal("boy", "warm", "boy", {
            tell: ["trust:+1"],
            effects: [pt(who, 1), remember("k_heir_father")],
          }),
          leave("forget", "warm"),
        ],
      ),
      paper: node(
        [],
        [
          ask("and_you", "frank", "boy", {
            effects: [remember("k_heir_father")],
          }),
          leave("forget", "cold"),
        ],
      ),
      ready: node(
        [],
        [
          ask("and_you", "frank", "boy", {
            effects: [remember("k_heir_father")],
          }),
          leave("forget", "cold"),
        ],
      ),
      not_me: last([], "end", "cold"),
      boy: last([]),
    },
  ),
  audience("deu_t2_heir_holland", "deu_heir", seen("deu_k_abdication"), {
    open: node(
      [t("arrogant")],
      [
        ask("where", "warm", "where"),
        push("stay", "threat", "army", {
          effects: [remember("k_heir_holland")],
          reacts: [react(moody(who, "cunning"), "where")],
        }),
        deal("together", "frank", "army", {
          tell: ["trust:+1", "army:-1"],
          effects: [pt(who, 1), army(-1), remember("k_heir_holland")],
        }),
        leave("go", "cold"),
      ],
    ),
    where: node(
      [],
      [
        ask("what_men", "frank", "army", {
          effects: [remember("k_heir_holland")],
        }),
        leave("go", "warm"),
      ],
    ),
    army: last([]),
  }),

  // ---- Erzberger ----
  audience(
    "deu_t2_erz_numbers",
    "deu_erzberger",
    all(war, date("1915-01", "1916-12")),
    {
      open: node(
        [t("stubborn")],
        [
          ask("whose", "cold", "whose"),
          push("sources", "threat", "names", {
            tell: ["reichstag:-1"],
            effects: [reichstag(-1), remember("k_erz_numbers")],
            reacts: [react(moody(who, "stubborn"), "again")],
          }),
          deal("committee", "frank", "committee", {
            tell: ["reichstag:+1", "army:-1"],
            effects: [reichstag(1), army(-1), remember("k_erz_numbers")],
          }),
          leave("too_many", "cold"),
        ],
      ),
      whose: node(
        [
          v("press_poor", { kind: "source_band", source: "press", max: 1 }),
          v("straight", candid(who)),
        ],
        [
          ask("bread", "frank", "bread", {
            effects: [remember("k_erz_numbers"), reveal("deu_food_books")],
          }),
          leave("too_many", "warm"),
        ],
      ),
      again: last([], "end", "cold"),
      names: last([]),
      bread: last([]),
      committee: last([]),
    },
  ),
  audience(
    "deu_t2_erz_belgium",
    "deu_erzberger",
    all(war, date("1915-01", "1916-12")),
    {
      open: node(
        [v("no_annex", flag("f_no_annex_belgium")), t("cunning")],
        [
          ask("still", "frank", "still"),
          push("your_paper", "threat", "shame", {
            reacts: [react(moody(who, "cunning"), "still")],
          }),
          deal("quiet", "cold", "quiet", {
            tell: ["reichstag:+1", "army:-1"],
            effects: [reichstag(1), army(-1), remember("k_erz_belgium")],
          }),
          leave("noted", "cold"),
        ],
      ),
      still: node(
        [],
        [
          ask("price", "frank", "price", {
            effects: [remember("k_erz_belgium")],
          }),
          leave("noted", "warm"),
        ],
      ),
      shame: last([]),
      price: last([]),
      quiet: last([]),
    },
  ),
  audience(
    "deu_t2_erz_vatican",
    "deu_erzberger",
    all(war, date("1916-01", "1917-12")),
    {
      open: node(
        [t("stubborn")],
        [
          ask("who_hears", "frank", "rome"),
          push("use_it", "cold", "rome", {
            effects: [remember("k_erz_vatican")],
            reacts: [react(moody(who, "stubborn"), "catholic")],
          }),
          deal("answer", "warm", "answer", {
            tell: ["promise"],
            effects: [
              remember("k_erz_vatican"),
              promise(who, "p_erz_rome", 16, {
                keep: chosen(
                  "deu_s_papal_note",
                  "belgium_clear",
                  "secret_answer",
                ),
              }),
            ],
          }),
          leave("noted", "cold"),
        ],
      ),
      rome: node(
        [],
        [
          deal("answer", "warm", "answer", {
            tell: ["promise"],
            effects: [
              remember("k_erz_vatican"),
              promise(who, "p_erz_rome", 16, {
                keep: chosen(
                  "deu_s_papal_note",
                  "belgium_clear",
                  "secret_answer",
                ),
              }),
            ],
          }),
          leave("noted", "warm", { effects: [remember("k_erz_vatican")] }),
        ],
      ),
      catholic: last([], "end", "cold"),
      answer: last([]),
    },
  ),
  audience(
    "deu_t2_erz_resolution",
    "deu_erzberger",
    all(
      date("1917-01", "1917-12"),
      any(scoreMax(5), world({ is: "uboat", min: 2 })),
    ),
    {
      open: node(
        [v("signed", world({ is: "uboat", min: 2 })), t("cunning")],
        [
          ask("tonnage", "frank", "speech"),
          push("not_in_public", "threat", "will_speak", {
            tell: ["reichstag:-1"],
            effects: [reichstag(-1), remember("k_erz_resolution")],
          }),
          deal("text", "warm", "text", {
            tell: ["army:-1", "reichstag:+1"],
            effects: [army(-1), reichstag(1), remember("k_erz_resolution")],
          }),
          leave("noted", "cold"),
        ],
      ),
      speech: node(
        [],
        [
          ask("majority", "cold", "text", {
            effects: [remember("k_erz_resolution")],
          }),
          leave("noted", "warm"),
        ],
      ),
      will_speak: last([], "end", "cold"),
      text: last([]),
    },
  ),
  audience(
    "deu_t2_erz_helf",
    "deu_erzberger",
    all(war, date("1917-01", "1918-06")),
    {
      open: node(
        [t("stubborn")],
        [
          ask("feud", "frank", "feud"),
          push("drop_it", "cold", "feud", {
            reacts: [react(moody(who, "stubborn"), "court")],
          }),
          deal("words", "warm", "words", {
            tell: ["countersign:-1"],
            effects: [countersign(-1), remember("k_erz_helf")],
          }),
          leave("noted", "cold"),
        ],
      ),
      feud: node(
        [],
        [
          ask("reading", "frank", "words", {
            effects: [remember("k_erz_helf")],
          }),
          leave("noted", "warm"),
        ],
      ),
      court: last([], "end", "cold"),
      words: last([]),
    },
  ),
  audience(
    "deu_t2_erz_compiegne",
    "deu_erzberger",
    any(seen("deu_k_wilson_notes"), flag("f_paris_line")),
    {
      open: node(
        [t("cunning")],
        [
          ask("who", "frank", "who"),
          push("you_go", "cold", "go", {
            effects: [remember("k_erz_compiegne")],
            reacts: [react(moody(who, "stubborn"), "who")],
          }),
          deal("cover", "warm", "cover", {
            tell: ["promise"],
            effects: [
              remember("k_erz_compiegne"),
              promise(who, "p_erz_cover", 3),
            ],
          }),
          leave("later", "cold"),
        ],
      ),
      who: node(
        [],
        [
          deal("cover", "warm", "cover", {
            tell: ["promise"],
            effects: [
              remember("k_erz_compiegne"),
              promise(who, "p_erz_cover", 3),
            ],
          }),
          leave("later", "cold", { effects: [remember("k_erz_compiegne")] }),
        ],
      ),
      go: last([]),
      cover: last([]),
    },
  ),

  // ---- Visits ----
  visit(
    "deu_v2_empress_table",
    "deu_empress",
    all(beth, date("1915-07", "1917-06")),
    {
      open: node(
        [t("anxious")],
        [
          ask("who_told", "warm", "who"),
          push("not_your_room", "cold", "hurt", {
            tell: ["trust:-1"],
            effects: [pt(who, -1)],
          }),
          deal("hear_both", "frank", "both", {
            tell: ["countersign:-1"],
            effects: [
              countersign(-1),
              pt({ person: "deu_bethmann" }, -1),
              pt(who, 1),
            ],
          }),
          leave("pray", "warm"),
        ],
      ),
      who: node(
        [],
        [
          leave("pray", "warm", {
            tell: ["trust:+1"],
            effects: [pt({ person: "deu_bethmann" }, 1)],
          }),
          leave("think", "frank", {
            effects: [pt({ person: "deu_bethmann" }, -1)],
          }),
        ],
      ),
      hurt: last([], "end", "cold"),
      both: last([]),
    },
  ),
  visit(
    "deu_v2_empress_heart",
    "deu_empress",
    all(date("1918-01", "1918-12"), scoreMax(-5)),
    {
      open: node(
        [t("stubborn")],
        [
          ask("sleep", "warm", "room"),
          ask("sons", "frank", "sons"),
          leave("sit", "warm"),
        ],
      ),
      room: last([]),
      sons: last([]),
    },
  ),
  visit(
    "deu_v2_valentini_paper",
    "deu_valentini",
    all(war, date("1915-07", "1917-06")),
    {
      open: node(
        [t("weary")],
        [
          ask("whose_file", "frank", "file"),
          push("next_name", "cold", "precedent", {
            reacts: [react(moody(who, "weary"), "file")],
          }),
          deal("keep_paper", "warm", "file", {
            tell: ["countersign:+1", "army:-1"],
            effects: [countersign(1), army(-1), remember("m_val_paper")],
          }),
          leave("sign_it", "cold"),
        ],
      ),
      file: node(
        [v("thin", beth)],
        [
          ask("after", "frank", "after", {
            effects: [remember("m_val_next")],
          }),
          leave("sign_it", "warm"),
        ],
      ),
      precedent: last([], "end", "cold"),
      after: last([]),
    },
  ),
  visit(
    "deu_v2_buelow_opera",
    "deu_buelow",
    all(
      date("1915-01", "1917-12"),
      any(flag("f_vac_chancellor"), instMax("countersign", -1)),
    ),
    {
      open: node(
        [t("cunning")],
        [
          ask("who_sent", "cold", "sent"),
          push("daily", "threat", "wound", {
            reacts: [
              react(moody(who, "arrogant"), "wound", {
                kind: "pride",
                who,
                delta: 1,
              }),
            ],
          }),
          deal("rome", "warm", "sent", {
            tell: ["reichstag:+1", "authority:-5"],
            effects: [reichstag(1), authority(-5), remember("m_buelow_heard")],
          }),
          leave("the_door", "cold"),
        ],
      ),
      sent: node(
        [v("straight", candid(who))],
        [leave("the_door", "cold"), leave("noted", "warm")],
      ),
      wound: last([], "end", "cold"),
    },
  ),
  visit(
    "deu_v2_max_terms",
    "deu_max_baden",
    all(date("1917-07", "1918-12"), scoreMax(0)),
    {
      open: node(
        [t("anxious")],
        [
          ask("what_saw", "frank", "camps"),
          push("your_side", "cold", "liberal", {
            reacts: [react(moody(who, "anxious"), "camps")],
          }),
          deal("terms", "warm", "terms", {
            tell: ["reichstag:+1", "army:-1"],
            effects: [reichstag(1), army(-1), remember("k_max_terms")],
          }),
          leave("thanks", "cold"),
        ],
      ),
      camps: node(
        [],
        [
          ask("if_called", "frank", "terms", {
            effects: [remember("k_max_terms")],
          }),
          leave("thanks", "warm"),
        ],
      ),
      liberal: last([], "end", "cold"),
      terms: last([]),
    },
  ),
];
