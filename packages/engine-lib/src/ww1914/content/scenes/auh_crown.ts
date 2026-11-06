import type {
  GwGauge,
  GwTemperament,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  chose,
  flag,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReact,
  GwReply,
  GwScene,
  GwVariant,
  GwWho,
  memory,
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
 * 「오스트리아-헝가리」, the crown share (plan: ww135-plan-auh.md §7, §8, §9):
 * the auh_k_ scenes, the talks of Karl, Zita, Czernin and Károlyi, and the
 * visits of Korošec, Lammasch, Archduke Wilhelm, Koerber and Ludendorff. Data
 * only; the text is in resources/ww1914/ko/AUH.crown.json.
 */

// ---- Stand-ins. Each is one place to change when the world catches up. ----

/**
 * The plan's dates (§0), on the `full` calendar's chapters. Becomes the plan's
 * `world date` condition.
 */
const PERIODS = {
  C: [0, 5],
  y14: [6, 10],
  y15a: [11, 17],
  y15b: [18, 22],
  y16a: [23, 29],
  y16b: [30, 35],
  y17a: [36, 41],
  y17b: [42, 47],
  y18a: [48, 53],
  y18b: [54, 59],
} as const;
type Period = keyof typeof PERIODS;
const period = (from: Period, to: Period = from): GwCond => ({
  kind: "chapter",
  min: PERIODS[from][0],
  max: PERIODS[to][1],
});

/**
 * The plan's institutions aren't in GW_INSTITUTIONS at this commit, so these
 * name the nearest that are. AUH has none of them yet: the effects do nothing
 * and the conditions read 0 until the row is added. Change the two names here.
 */
const HUNGARY = "countersign";
const NATIONS = "reichstag";
const hungary = (delta: number): GwEffect => ({
  kind: "inst",
  inst: HUNGARY,
  delta,
});
const nations = (delta: number): GwEffect => ({
  kind: "inst",
  inst: NATIONS,
  delta,
});
const hungaryAt = (r: { min?: number; max?: number }): GwCond => ({
  kind: "inst",
  inst: HUNGARY,
  ...r,
});
const nationsAt = (r: { min?: number; max?: number }): GwCond => ({
  kind: "inst",
  inst: NATIONS,
  ...r,
});

/** The debt to Berlin, counted in flags as the plan's §2 allows. */
const DEBT1 = flag("f_auh_debt_1");
const DEBT2 = flag("f_auh_debt_2");
const debtUp: GwEffect[] = [
  { kind: "maybe", when: DEBT2, then: [setFlag("f_auh_debt_3")] },
  { kind: "maybe", when: DEBT1, then: [setFlag("f_auh_debt_2")] },
  setFlag("f_auh_debt_1"),
];
const debtDown: GwEffect[] = [
  {
    kind: "maybe",
    when: not(DEBT2),
    then: [{ kind: "unflag", flag: "f_auh_debt_1" }],
  },
  {
    kind: "maybe",
    when: not(flag("f_auh_debt_3")),
    then: [{ kind: "unflag", flag: "f_auh_debt_2" }],
  },
  { kind: "unflag", flag: "f_auh_debt_3" },
];

/** The secret `auh_sixtus_copy` isn't in GW_SECRETS yet: a seeded flag for now. */
const COPY = flag("f_auh_sixtus_copy");

// ---- The run's branches (plan §0) ----

const K = flag("w_auh_karl");
const FFT = flag("w_auh_ff_throne");
const FJ = not(any(K, FFT));
const ffAlive: GwCond = {
  kind: "opening",
  of: ["sarajevo_survived", "sarajevo_failed", "no_sarajevo"],
};
const heirDead: GwCond = {
  kind: "opening",
  of: ["sarajevo", "sarajevo_delayed"],
};
/**
 * The world raises w_auh_karl or w_auh_ff_throne on a seeded date (plan §2).
 * Until it does, the date falls by a hidden seeded value, in three places
 * inside the plan's fence: delete this and the `any` that uses it then.
 */
const health = (max: number): GwCond => ({
  kind: "health",
  who: { person: "auh_friedrich" },
  max,
});
const succession: GwCond = any(
  all({ kind: "chapter", min: 21 }, health(1)),
  all({ kind: "chapter", min: 27 }, health(2)),
  { kind: "chapter", min: 33 },
);
/** The reign's first year, whenever it began. */
const young = any(
  { kind: "chose", scene: "auh_k_succession", within: 12 },
  { kind: "chose", scene: "auh_k_ff_throne", within: 12 },
);
const war = world({ is: "war" });
const peace = not(war);
const ent = (tag: GwTag): GwCond => world({ is: "entered", tag });
const out = (tag: GwTag): GwCond => world({ is: "out", tag });
const score = (r: { min?: number; max?: number }): GwCond =>
  world({ is: "score", ...r });
const unrest = (min: number): GwCond => world({ is: "unrest", min });
const gaugeAt = (gauge: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const holds = (
  office: Extract<GwCond, { kind: "holder" }>["office"],
  person: string,
): GwCond => ({ kind: "holder", office, person });
const k = (key: string): GwCond => memory(key);
const moody = (r: string, ...of: GwTemperament[]): GwCond => ({
  kind: "temperament",
  who: role(r),
  of,
});

// ---- Effects ----

const pt = (r: string, delta: number): GwEffect => trustOf(role(r), delta);
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const tempBy = (delta: number): GwEffect => ({ kind: "temp", delta });
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const army = (delta: number): GwEffect => ({
  kind: "inst",
  inst: "army",
  delta,
});
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });
const calm: GwEffect = doWorld({ do: "calm" });
const end = (ending: string): GwEffect => ({ kind: "end", ending });
const when = (c: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when: c,
  then,
});
const dismiss = (r: string): GwEffect => ({ kind: "dismiss", who: role(r) });
const appoint = (
  person: string,
  office: Extract<GwEffect, { kind: "appoint" }>["office"],
): GwEffect => ({ kind: "appoint", who: { person }, office });

// ---- Shapes ----

const v = (id: string, c?: GwCond): GwVariant =>
  c === undefined ? { id } : { id, when: c };
const opt = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  c?: GwCond,
): GwOption =>
  c === undefined ? { id, tell, effects } : { id, when: c, tell, effects };

type SceneFields = Pick<GwScene, "id" | "kind" | "cast" | "salience" | "tags"> &
  Partial<GwScene>;
const scene = (s: SceneFields): GwScene => ({
  nation: ["AUH"],
  once: true,
  variants: [{ id: "base" }],
  ...s,
});

const P: GwWho = role("p");
const T = (...of: GwTemperament[]): GwCond => moody("p", ...of);
const rx = (
  c: GwCond,
  next: string | null,
  ...effects: GwEffect[]
): GwReact => ({
  when: c,
  next,
  effects,
});
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
const node = (replies: GwReply[], ...says: GwVariant[]): GwNode => ({
  says: [...says, { id: "base" }],
  replies,
});
const talk = (
  id: string,
  person: string,
  c: GwCond | undefined,
  nodes: Record<string, GwNode>,
  x: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: ["AUH"],
  kind: "talk",
  ...(c === undefined ? {} : { when: c }),
  cast: { p: { person } },
  salience: 2,
  tags: ["people"],
  once: true,
  summon: true,
  who: "p",
  variants: [{ id: "base" }],
  start: "open",
  nodes,
  ...x,
});
/** A visit: the desk deals it, nobody summons it. */
const visit = (
  id: string,
  person: string,
  c: GwCond | undefined,
  salience: number,
  nodes: Record<string, GwNode>,
): GwScene => talk(id, person, c, nodes, { salience, summon: false });

// ---- The throne changes hands ----

const CROWN_THRONE: readonly GwScene[] = [
  scene({
    id: "auh_k_old_age",
    kind: "report",
    when: all(FJ, period("y15b", "y16b")),
    cast: { court: { office: "court" } },
    salience: 6,
    tags: ["people", "tension_down"],
    once: false,
    cooldown: 6,
    stamp: "confirmed",
    variants: [v("peace", peace), v("losing", score({ max: -10 })), v("base")],
  }),
  scene({
    id: "auh_k_succession",
    kind: "crisis",
    when: all(any(K, all(heirDead, not(FFT), succession)), not(FFT)),
    cast: { fm: { office: "foreign" } },
    salience: 9,
    tags: ["people", "tension_up"],
    variants: [
      v("peace", peace),
      v("pledged", all(war, k("k_karl_peace"))),
      v("losing", all(war, score({ max: -10 }))),
      v("base"),
    ],
    fallback: "keep_old_men",
    options: [
      opt(
        "keep_old_men",
        ["army:+1", "nations:-1"],
        [setFlag("w_auh_karl"), army(1), nations(-1), reason("auh_k_kept_men")],
      ),
      opt(
        "new_names",
        ["army:-1", "authority:+5"],
        [
          setFlag("w_auh_karl"),
          setFlag("f_auh_new_names"),
          army(-1),
          authority(5),
          reason("auh_k_new_names"),
        ],
        k("k_karl_peace"),
      ),
      opt(
        "promise_peace",
        ["morale:+1", "order:+1", "berlin:+1"],
        [
          setFlag("w_auh_karl"),
          setFlag("f_auh_peace_word"),
          gauge("morale", 1),
          gauge("order", 1),
          trust("DEU", -1),
          ...debtUp,
          reason("auh_k_peace_word"),
        ],
        k("k_karl_peace"),
      ),
    ],
  }),
  scene({
    id: "auh_k_ff_throne",
    kind: "crisis",
    when: any(FFT, all(ffAlive, not(K), succession)),
    cast: { court: { office: "court" }, hun: { office: "hun_pm" } },
    salience: 9,
    tags: ["people", "tension_up"],
    variants: [
      v("peace", peace),
      v("tisza", holds("hun_pm", "auh_tisza")),
      v("base"),
    ],
    fallback: "crown_first",
    options: [
      opt(
        "crown_first",
        ["hungary:+1", "nations:-1"],
        [setFlag("w_auh_ff_throne"), hungary(1), nations(-1)],
      ),
      opt(
        "program_before_oath",
        ["hungary:-3", "nations:+3", "trust:-2"],
        [
          setFlag("w_auh_ff_throne"),
          setFlag("f_auh_ff_program"),
          hungary(-3),
          nations(3),
          pt("hun", -2),
          reason("auh_k_ff_program"),
        ],
        k("k_ff_program"),
      ),
      opt(
        "half_program",
        ["hungary:-1", "nations:+1", "court:-1"],
        [
          setFlag("w_auh_ff_throne"),
          setFlag("f_auh_ff_half"),
          hungary(-1),
          nations(1),
          pt("court", -1),
        ],
      ),
    ],
  }),
  scene({
    id: "auh_k_new_men",
    kind: "audience",
    when: all(K, young),
    cast: { court: { office: "court" } },
    salience: 8,
    tags: ["people"],
    variants: [
      v("named", flag("f_auh_new_names")),
      v("peace", peace),
      v("base"),
    ],
    fallback: "keep_court",
    options: [
      opt("keep_court", ["court:+1"], [pt("court", 1)]),
      opt(
        "new_court",
        ["authority:-5", "leaves"],
        [
          setFlag("f_auh_new_court"),
          authority(-5),
          dismiss("court"),
          reason("auh_k_new_court"),
        ],
        k("k_bol_heir"),
      ),
      opt(
        "czernin_to_foreign",
        ["hungary:-1", "authority:-5"],
        [
          setFlag("f_auh_czernin_called"),
          appoint("auh_czernin", "foreign"),
          hungary(-1),
          authority(-5),
          reason("auh_k_czernin_in"),
        ],
        all(k("k_cz_king"), not(holds("foreign", "auh_czernin"))),
      ),
    ],
  }),
  scene({
    id: "auh_k_coronation",
    kind: "crisis",
    when: all(any(K, FFT), young),
    cast: { hun: { office: "hun_pm" }, chancellor: { office: "chancellor" } },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("ff", FFT),
      v("heard", k("karl_on_oath")),
      v("peace", peace),
      v("base"),
    ],
    fallback: "crown_at_once",
    options: [
      opt(
        "crown_at_once",
        ["hungary:+2", "nations:-1"],
        [
          setFlag("f_auh_sworn"),
          hungary(2),
          nations(-1),
          pt("hun", 1),
          reason("auh_k_sworn"),
        ],
      ),
      opt(
        "delay_oath",
        ["hungary:-2", "chancellor:+1"],
        [
          setFlag("f_auh_oath_delayed"),
          hungary(-2),
          pt("chancellor", 1),
          reason("auh_k_oath_delayed"),
        ],
        k("k_koer_quota"),
      ),
      opt(
        "reform_clause",
        ["hungary:-1", "nations:+1"],
        [
          setFlag("f_auh_sworn"),
          setFlag("f_auh_oath_clause"),
          hungary(-1),
          nations(1),
        ],
        k("k_tisza_oath"),
      ),
      opt(
        "suffrage_first",
        ["hungary:-3", "nations:+1", "order:+1"],
        [
          setFlag("f_auh_oath_delayed"),
          setFlag("f_auh_suffrage_word"),
          hungary(-3),
          nations(1),
          gauge("order", 1),
          pt("hun", -2),
        ],
        k("k_kar_vote"),
      ),
    ],
  }),
  scene({
    id: "auh_k_command",
    kind: "audience",
    when: all(K, war, young, holds("chief_of_staff", "auh_conrad")),
    cast: { cos: { office: "chief_of_staff" }, court: { office: "court" } },
    salience: 8,
    tags: ["people", "war"],
    variants: [
      v("losing", score({ max: -15 })),
      v("proud", { kind: "pride", who: role("cos"), min: 4 }),
      v("base"),
    ],
    fallback: "keep_conrad",
    options: [
      opt("keep_conrad", ["army:+1"], [army(1), pt("cos", 1)]),
      opt(
        "take_command",
        ["authority:+5", "army:-1", "trust:-1"],
        [
          setFlag("f_auh_own_command"),
          authority(5),
          army(-1),
          pt("cos", -1),
          reason("auh_k_own_command"),
        ],
      ),
      opt(
        "arz_for_conrad",
        ["army:-1", "morale:+1", "leaves"],
        [
          setFlag("f_auh_own_command"),
          appoint("auh_arz", "chief_of_staff"),
          army(-1),
          gauge("morale", 1),
          reason("auh_k_arz_in"),
        ],
        k("k_bol_conrad"),
      ),
      opt(
        "tyrol_for_conrad",
        ["leaves"],
        [
          setFlag("f_auh_conrad_tyrol"),
          appoint("auh_arz", "chief_of_staff"),
          doWorld({
            do: "command",
            who: { person: "auh_conrad" },
            theatre: "italy",
          }),
          reason("auh_k_conrad_tyrol"),
        ],
        k("k_bol_names"),
      ),
    ],
  }),
  scene({
    id: "auh_k_tisza_out",
    kind: "dispute",
    when: all(K, holds("hun_pm", "auh_tisza"), period("y17a", "y17b")),
    cast: { hun: { office: "hun_pm" } },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("soldiers", k("k_tisza_franchise")),
      v("bread", gaugeAt("bread", 1)),
      v("base"),
    ],
    fallback: "keep_tisza",
    options: [
      opt(
        "keep_tisza",
        ["hungary:+1", "nations:-1"],
        [hungary(1), nations(-1)],
      ),
      opt(
        "ask_resignation",
        ["hungary:-2", "nations:+1", "leaves"],
        [
          setFlag("f_auh_tisza_gone"),
          hungary(-2),
          nations(1),
          dismiss("hun"),
          reason("auh_k_tisza_gone"),
        ],
        any(k("k_tisza_franchise"), k("k_kar_vote")),
      ),
      opt(
        "deal_on_soldiers_vote",
        ["hungary:-1", "morale:+1"],
        [
          setFlag("f_auh_soldiers_vote"),
          hungary(-1),
          gauge("morale", 1),
          pt("hun", 1),
        ],
        k("k_tisza_franchise"),
      ),
    ],
  }),
  scene({
    id: "auh_k_amnesty",
    kind: "proposal",
    when: all(
      K,
      any(k("k_kra_prison"), chose("auh_h_kramar_verdict")),
      period("y17a", "y17b"),
    ),
    cast: {
      chancellor: { office: "chancellor" },
      cos: { office: "chief_of_staff" },
    },
    salience: 7,
    tags: ["home", "tension_down"],
    variants: [
      v("visited", k("k_kra_prison")),
      v("house_open", { kind: "seen", scene: "auh_k_reichsrat_opens" }),
      v("base"),
    ],
    fallback: "wait",
    options: [
      opt("wait", ["army:+1", "nations:-1"], [army(1), nations(-1)]),
      opt(
        "full_amnesty",
        ["army:-2", "nations:+2", "cos:-1"],
        [
          setFlag("f_auh_amnesty"),
          army(-2),
          nations(2),
          pt("cos", -1),
          reason("auh_k_amnesty"),
        ],
        k("k_kra_amnesty"),
      ),
      opt(
        "army_exception",
        ["army:-1", "nations:+1"],
        [setFlag("f_auh_amnesty_half"), army(-1), nations(1)],
      ),
    ],
  }),
  scene({
    id: "auh_k_reichsrat_opens",
    kind: "crisis",
    when: all(K, war, period("y17a")),
    cast: { chancellor: { office: "chancellor" } },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("open_already", chose("auh_h_reichsrat_call", "open_it")),
      v("strikes", unrest(1)),
      v("base"),
    ],
    fallback: "throne_speech",
    options: [
      opt(
        "throne_speech",
        ["order:+1"],
        [gauge("order", 1), setFlag("f_auh_house_open")],
      ),
      opt(
        "speech_on_nations",
        ["nations:+2", "hungary:-1"],
        [
          setFlag("f_auh_house_open"),
          nations(2),
          hungary(-1),
          reason("auh_k_speech_nations"),
        ],
        k("k_adl_after"),
      ),
      opt(
        "delay",
        ["nations:-1", "order:-1"],
        [nations(-1), gauge("order", -1), setFlag("f_auh_house_shut")],
      ),
    ],
  }),
  scene({
    id: "auh_k_may_decl",
    kind: "proposal",
    when: all(
      { kind: "seen", scene: "auh_k_reichsrat_opens" },
      period("y17a", "y17b"),
    ),
    cast: { chancellor: { office: "chancellor" }, hun: { office: "hun_pm" } },
    salience: 7,
    tags: ["foreign", "tension_up"],
    variants: [
      v("shut", flag("f_auh_house_shut")),
      v("warned", k("k_kor_may")),
      v("base"),
    ],
    fallback: "hear_nothing",
    options: [
      opt("hear_nothing", ["nations:-1"], [nations(-1)]),
      opt(
        "ask_for_draft",
        ["nations:+1", "hungary:-1"],
        [setFlag("f_auh_may_draft"), nations(1), hungary(-1)],
        k("k_kor_may"),
      ),
      opt(
        "crown_of_bohemia",
        ["nations:+2", "hungary:-2"],
        [
          setFlag("f_auh_bohemia_crown"),
          nations(2),
          hungary(-2),
          pt("hun", -1),
        ],
        k("k_kra_crown"),
      ),
    ],
  }),
];

// ---- The letter, the bread, the street ----

const CROWN_LETTER: readonly GwScene[] = [
  scene({
    id: "auh_k_sixtus",
    kind: "crisis",
    when: all(K, war, any(period("y17a", "y17b"), all(period("y16b"), young))),
    cast: { fm: { office: "foreign" } },
    salience: 9,
    tags: ["foreign", "tension_down"],
    variants: [
      v("czernin", holds("foreign", "auh_czernin")),
      v("burian", holds("foreign", "auh_burian")),
      v("losing", score({ max: -15 })),
      v("brothers", k("k_zita_brothers")),
      v("base"),
    ],
    fallback: "no_letter",
    options: [
      opt("no_letter", [], [reason("auh_k_no_letter")]),
      opt(
        "general_words",
        ["fra:+1"],
        [setFlag("f_auh_letter_general"), trust("FRA", 1)],
        k("k_zita_brothers"),
      ),
      opt(
        "letter_alsace",
        ["fra:+2", "temp:-1"],
        [
          setFlag("f_auh_letter_alsace"),
          trust("FRA", 2),
          tempBy(-1),
          {
            kind: "roll",
            key: "auh_sixtus_copy",
            pct: 50,
            then: [setFlag("f_auh_sixtus_copy")],
          },
          reason("auh_k_letter"),
        ],
        k("k_zita_sixtus"),
      ),
      opt(
        "tell_czernin",
        ["fm:+1", "fra:+1"],
        [
          setFlag("f_auh_letter_general"),
          setFlag("f_auh_told_fm"),
          pt("fm", 1),
          trust("FRA", 1),
        ],
        k("k_zita_czernin"),
      ),
    ],
  }),
  scene({
    id: "auh_k_bread_peace",
    kind: "crisis",
    when: all(any(out("RUS"), k("k_cz_bread")), period("y17b", "y18a")),
    cast: { fm: { office: "foreign" }, hun: { office: "hun_pm" } },
    salience: 8,
    tags: ["foreign"],
    variants: [
      v("hungry", gaugeAt("bread", 1)),
      v("poles", k("k_bil_poland")),
      v("base"),
    ],
    fallback: "no_chelm",
    options: [
      opt(
        "no_chelm",
        ["bread:-1", "nations:+1"],
        [gauge("bread", -1), nations(1)],
      ),
      opt(
        "chelm_for_grain",
        ["bread:+1", "nations:-2"],
        [
          setFlag("f_auh_chelm_given"),
          gauge("bread", 1),
          nations(-2),
          reason("auh_k_chelm"),
        ],
        k("k_cz_bread"),
      ),
      opt(
        "ukraine_crownland",
        ["bread:+1", "nations:-3", "hungary:-1"],
        [
          setFlag("f_auh_chelm_given"),
          setFlag("f_auh_crownland"),
          gauge("bread", 1),
          nations(-3),
          hungary(-1),
        ],
        k("k_wil_vasyl"),
      ),
    ],
  }),
  scene({
    id: "auh_k_jan_strike",
    kind: "crisis",
    when: all(K, war, gaugeAt("bread", 1), period("y18a")),
    cast: { chancellor: { office: "chancellor" } },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("adler", k("k_adl_strike")),
      v("peace_word", flag("f_auh_peace_word")),
      v("second", unrest(2)),
      v("base"),
    ],
    fallback: "call_troops",
    options: [
      opt(
        "call_troops",
        ["order:+1", "morale:-1", "nations:-1"],
        [
          gauge("order", 1),
          gauge("morale", -1),
          nations(-1),
          reason("auh_k_troops"),
        ],
      ),
      opt(
        "talk_workers",
        ["order:+1", "army:-1"],
        [
          setFlag("f_auh_workers_council"),
          gauge("order", 1),
          army(-1),
          calm,
          reason("auh_k_talked"),
        ],
        k("k_adl_strike"),
      ),
      opt(
        "peace_word",
        ["order:+1", "morale:+1", "berlin:+1"],
        [
          setFlag("f_auh_peace_word"),
          gauge("order", 1),
          gauge("morale", 1),
          trust("DEU", -1),
          ...debtUp,
          calm,
        ],
        k("k_karl_front"),
      ),
      opt(
        "ration_back",
        ["order:+1", "bread:-1", "hungary:-1"],
        [gauge("order", 1), gauge("bread", -1), hungary(-1), calm],
        k("k_land_days"),
      ),
    ],
  }),
  scene({
    id: "auh_k_cattaro",
    kind: "proposal",
    when: all(K, war, unrest(1), period("y18a")),
    cast: { navy: { office: "navy" } },
    salience: 7,
    tags: ["war", "tension_up"],
    variants: [v("heard", k("k_krob_tyrol")), v("base")],
    fallback: "navy_court",
    options: [
      opt("navy_court", ["army:+1", "order:-1"], [army(1), gauge("order", -1)]),
      opt(
        "read_demands",
        ["morale:+1", "army:-1"],
        [setFlag("f_auh_read_demands"), gauge("morale", 1), army(-1)],
        k("k_krob_tyrol"),
      ),
      opt(
        "horthy_command",
        ["army:+1", "leaves"],
        [
          setFlag("f_auh_horthy"),
          appoint("auh_horthy", "navy"),
          army(1),
          reason("auh_k_horthy"),
        ],
      ),
    ],
  }),
  scene({
    id: "auh_k_czernin_speech",
    kind: "crisis",
    when: all(
      K,
      chose("auh_k_sixtus"),
      holds("foreign", "auh_czernin"),
      period("y18a"),
    ),
    cast: { fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign", "tension_up"],
    variants: [
      v("told", flag("f_auh_told_fm")),
      v("nerves", moody("fm", "anxious")),
      v("base"),
    ],
    fallback: "let_him",
    options: [
      opt(
        "let_him",
        ["fra:-1", "temp:+1"],
        [trust("FRA", -1), tempBy(1), setFlag("f_auh_speech_given")],
      ),
      opt(
        "stop_speech",
        ["fm:-1"],
        [pt("fm", -1), setFlag("f_auh_speech_stopped")],
        k("k_cz_speech"),
      ),
      opt(
        "tell_him_all",
        ["fm:-1"],
        [
          setFlag("f_auh_told_fm"),
          setFlag("f_auh_speech_stopped"),
          pt("fm", -1),
        ],
        k("k_zita_word"),
      ),
    ],
  }),
  scene({
    id: "auh_k_word_of_honour",
    kind: "crisis",
    when: all(
      K,
      any(COPY, { kind: "seen", scene: "auh_k_czernin_speech" }),
      chose("auh_k_sixtus", "letter_alsace"),
      period("y18a", "y18b"),
    ),
    cast: { fm: { office: "foreign" } },
    salience: 9,
    tags: ["people", "tension_up"],
    variants: [
      v("speech", flag("f_auh_speech_given")),
      v("told", flag("f_auh_told_fm")),
      v("stopped", flag("f_auh_speech_stopped")),
      v("base"),
    ],
    fallback: "deny",
    options: [
      opt(
        "deny",
        ["berlin:+1", "authority:-10", "fra:-2"],
        [
          setFlag("f_auh_denied"),
          authority(-10),
          trust("FRA", -2),
          ...debtUp,
          reason("auh_k_denied"),
        ],
      ),
      opt(
        "own_it",
        ["berlin:+1", "authority:-5", "trust:+1"],
        [
          setFlag("f_auh_owned"),
          authority(-5),
          trust("DEU", -2),
          ...debtUp,
          reason("auh_k_owned"),
        ],
        k("k_zita_word"),
      ),
      opt(
        "blame_no_one",
        ["authority:-5", "fra:-1", "deu:-1"],
        [
          setFlag("f_auh_silent"),
          authority(-5),
          trust("FRA", -1),
          trust("DEU", -1),
        ],
      ),
    ],
  }),
  scene({
    id: "auh_k_spa",
    kind: "crisis",
    when: all(
      K,
      war,
      any(DEBT2, { kind: "seen", scene: "auh_k_word_of_honour" }),
      period("y18a", "y18b"),
    ),
    cast: { fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign", "tension_up"],
    variants: [
      v("after_letter", { kind: "seen", scene: "auh_k_word_of_honour" }),
      v("hungry", gaugeAt("bread", 1)),
      v("base"),
    ],
    fallback: "sign",
    options: [
      opt(
        "sign",
        ["berlin:+1", "deu:+2", "nations:-1"],
        [
          setFlag("f_auh_spa_signed"),
          trust("DEU", 2),
          nations(-1),
          ...debtUp,
          reason("auh_k_spa"),
        ],
      ),
      opt(
        "sign_less",
        ["deu:+1"],
        [setFlag("f_auh_spa_less"), trust("DEU", 1)],
        k("k_bur_peace"),
      ),
      opt(
        "do_not_go",
        ["deu:-3", "bread:-1", "berlin:-1"],
        [
          setFlag("f_auh_spa_refused"),
          trust("DEU", -3),
          gauge("bread", -1),
          ...debtDown,
          reason("auh_k_no_spa"),
        ],
        k("k_zita_stay"),
      ),
    ],
  }),
  scene({
    id: "auh_k_mutinies",
    kind: "report",
    when: all(out("RUS"), unrest(1), period("y18a", "y18b")),
    cast: {},
    salience: 7,
    tags: ["war", "tension_up"],
    stamp: "confirmed",
    source: "staff",
    variants: [
      v("hungry", gaugeAt("bread", 1)),
      v("amnesty", flag("f_auh_amnesty")),
      v("base"),
    ],
  }),
];

// ---- The end of the old form ----

const endWar: GwEffect[] = [
  when(score({ min: -24 }), end("auh_e_compromise")),
  when(
    any(score({ max: -25 }), nationsAt({ max: -3 })),
    end("auh_e_dissolution"),
  ),
  when(
    any(flag("f_auh_spa_refused"), all(flag("f_auh_letter_alsace"), not(COPY))),
    end("auh_e_separate_peace"),
  ),
  when(flag("f_auh_go_on"), end("auh_e_remnant")),
];

const CROWN_END: readonly GwScene[] = [
  scene({
    id: "auh_k_manifesto",
    kind: "crisis",
    when: all(
      K,
      any(score({ max: -15 }), nationsAt({ max: -3 })),
      period("y18b"),
    ),
    cast: { chancellor: { office: "chancellor" }, hun: { office: "hun_pm" } },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("draft", k("k_lam_federal")),
      v("oath_free", flag("f_auh_oath_delayed")),
      v("sworn", flag("f_auh_sworn")),
      v("base"),
    ],
    fallback: "austria_only",
    options: [
      opt(
        "austria_only",
        ["nations:+1", "hungary:+1"],
        [
          setFlag("f_auh_manifesto"),
          nations(1),
          hungary(1),
          reason("auh_k_manifesto"),
        ],
      ),
      opt(
        "whole_realm",
        ["nations:+2", "hungary:-3"],
        [
          setFlag("f_auh_manifesto"),
          setFlag("f_auh_manifesto_all"),
          nations(2),
          hungary(-3),
          pt("hun", -2),
        ],
        k("k_lam_federal"),
      ),
      opt("nothing_yet", ["nations:-2"], [nations(-2)]),
    ],
  }),
  scene({
    id: "auh_k_wilson",
    kind: "crisis",
    when: all(K, any(score({ max: -20 }), out("BGR")), period("y18b")),
    cast: { fm: { office: "foreign" } },
    salience: 9,
    tags: ["foreign", "tension_down"],
    variants: [
      v("remnant", flag("f_auh_go_on")),
      v("manifesto", flag("f_auh_manifesto")),
      v("base"),
    ],
    fallback: "fourteen_points",
    options: [
      opt(
        "fourteen_points",
        ["usa:+1", "deu:-1"],
        [trust("USA", 1), trust("DEU", -1), reason("auh_k_note_wilson")],
      ),
      opt(
        "separate_note",
        ["usa:+1", "deu:-2", "berlin:-1"],
        [
          setFlag("f_auh_separate_note"),
          trust("USA", 1),
          trust("DEU", -2),
          ...debtDown,
          when(
            all(flag("f_auh_letter_alsace"), not(COPY)),
            end("auh_e_separate_peace"),
          ),
        ],
        k("k_bur_wilson"),
      ),
      opt(
        "accept_all",
        ["usa:+2", "nations:-2", "hungary:-2"],
        [
          setFlag("f_auh_accept_all"),
          trust("USA", 2),
          nations(-2),
          hungary(-2),
        ],
        k("k_lam_federal"),
      ),
    ],
  }),
  scene({
    id: "auh_k_armistice",
    kind: "crisis",
    when: all(
      war,
      any(score({ max: -30 }), { kind: "seen", scene: "auh_k_wilson" }),
      period("y18b"),
    ),
    cast: { cos: { office: "chief_of_staff" }, fm: { office: "foreign" } },
    salience: 9,
    tags: ["war", "tension_down"],
    variants: [
      v("republic", flag("f_auh_go_republic")),
      v("crown", flag("f_auh_go_crown")),
      v("hungary_gone", hungaryAt({ max: -2 })),
      v("base"),
    ],
    fallback: "accept_terms",
    options: [
      opt("accept_terms", ["ends_game"], endWar),
      opt(
        "march_on_vienna",
        ["ends_game", "order:-2"],
        [gauge("order", -2), end("auh_e_army_gone")],
        k("k_bor_vienna"),
      ),
      opt(
        "separate_with_hungary",
        ["ends_game", "hungary:+1"],
        [hungary(1), end("auh_e_personal_union")],
        k("k_kar_pm"),
      ),
    ],
  }),
  scene({
    id: "auh_k_new_form",
    kind: "crisis",
    when: any(unrest(4), nationsAt({ max: -5 })),
    cast: { chancellor: { office: "chancellor" } },
    salience: 9,
    tags: ["people", "tension_up"],
    variants: [
      v("peace", peace),
      v("army_home", world({ is: "manpower", max: 20 })),
      v("base"),
    ],
    fallback: "end_here",
    options: [
      opt(
        "end_here",
        ["ends_game"],
        [
          end("auh_e_dissolution"),
          when(world({ is: "manpower", max: 20 }), end("auh_e_army_gone")),
        ],
      ),
      opt(
        "go_on_austria",
        ["order:+1"],
        [
          setFlag("f_auh_go_on"),
          setFlag("f_auh_go_republic"),
          gauge("order", 1),
          when(war, schedule("auh_k_wilson", 1)),
          schedule("auh_k_armistice", 3),
        ],
        k("k_adl_after"),
      ),
      opt(
        "go_on_crown",
        ["authority:+5"],
        [
          setFlag("f_auh_go_on"),
          setFlag("f_auh_go_crown"),
          authority(5),
          when(war, schedule("auh_k_wilson", 1)),
          schedule("auh_k_armistice", 3),
        ],
        k("k_zita_stay"),
      ),
    ],
  }),
  scene({
    id: "auh_k_danube_fed",
    kind: "crisis",
    when: all(
      any(K, FFT),
      nationsAt({ min: 2 }),
      hungaryAt({ min: 0 }),
      k("k_lam_federal"),
      period("y17a", "y18b"),
    ),
    cast: { chancellor: { office: "chancellor" }, hun: { office: "hun_pm" } },
    salience: 8,
    tags: ["home", "tension_down"],
    variants: [v("ff", FFT), v("war", war), v("base")],
    fallback: "wait",
    options: [
      opt("wait", ["nations:-1"], [nations(-1)]),
      opt("proclaim", ["ends_game"], [end("auh_e_federal")], k("k_kra_crown")),
      opt(
        "with_hungary_veto",
        ["ends_game"],
        [end("auh_e_federal")],
        k("k_kar_land"),
      ),
    ],
  }),
  scene({
    id: "auh_k_personal_union",
    kind: "crisis",
    when: all(hungaryAt({ max: -4 }), period("y17b", "y18b")),
    cast: { hun: { office: "hun_pm" } },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("karolyi", holds("hun_pm", "auh_karolyi")),
      v("tisza", holds("hun_pm", "auh_tisza")),
      v("base"),
    ],
    fallback: "refuse",
    options: [
      opt(
        "refuse",
        ["hungary:-1", "bread:-1"],
        [hungary(-1), gauge("bread", -1)],
      ),
      opt(
        "accept_union",
        ["ends_game"],
        [end("auh_e_personal_union")],
        k("k_kar_pm"),
      ),
      opt(
        "offer_army",
        ["hungary:+2", "army:-2"],
        [setFlag("f_auh_hungarian_army"), hungary(2), army(-2)],
        k("k_tisza_oath"),
      ),
    ],
  }),
  scene({
    id: "auh_k_vasyl",
    kind: "proposal",
    when: all(K, k("k_wil_vasyl"), out("RUS"), period("y18a", "y18b")),
    cast: { fm: { office: "foreign" } },
    salience: 6,
    tags: ["foreign"],
    variants: [v("crownland", flag("f_auh_crownland")), v("base")],
    fallback: "forbid",
    options: [
      opt("forbid", ["deu:+1"], [trust("DEU", 1)]),
      opt(
        "let_him_ride",
        ["bread:+1", "deu:-2", "nations:-1"],
        [
          setFlag("f_auh_vasyl_rides"),
          gauge("bread", 1),
          trust("DEU", -2),
          nations(-1),
        ],
        k("k_wil_vasyl"),
      ),
    ],
  }),
  scene({
    id: "auh_k_peace_vote",
    kind: "crisis",
    when: all(peace, period("y16b", "y18b")),
    cast: { hun: { office: "hun_pm" }, chancellor: { office: "chancellor" } },
    salience: 7,
    tags: ["home"],
    variants: [v("ff", FFT), v("karl", K), v("base")],
    fallback: "leave_it",
    options: [
      opt("leave_it", ["hungary:+1", "nations:-1"], [hungary(1), nations(-1)]),
      opt(
        "soldiers_no_vote",
        ["hungary:+1", "order:-1"],
        [hungary(1), gauge("order", -1)],
      ),
      opt(
        "ask_for_vote",
        ["hungary:-2", "nations:+2", "order:+1"],
        [
          setFlag("f_auh_vote_asked"),
          hungary(-2),
          nations(2),
          gauge("order", 1),
        ],
        k("k_kar_vote"),
      ),
    ],
  }),
];

// ---- Talks ----

const bye = (id = "bye", stance: GwReply["stance"] = "warm"): GwReply =>
  r(id, stance, "leave", null);
const heard = (key: string): GwEffect => remember(key);
const well = (d = 1): GwEffect => ({ kind: "mood", delta: d });
const czernin: GwWho = { person: "auh_czernin" };

const KARL_TALKS: readonly GwScene[] = [
  talk("auh_t_karl_funeral", "auh_karl", all(period("C"), heirDead), {
    open: node(
      [
        r("why", "frank", "ask", "kids", {
          reacts: [rx(T("stubborn"), "stand")],
        }),
        r("rule", "cold", "push", "stand", {
          tell: ["trust:-1"],
          effects: [pt("p", -1)],
          reacts: [rx(T("anxious"), "fold")],
        }),
        r("terms", "warm", "deal", "bargain", {
          effects: [heard("k_karl_funeral")],
        }),
        bye("no", "cold"),
      ],
      v("anx", T("anxious")),
    ),
    kids: node([
      r("grant", "warm", "ask", null, {
        effects: [heard("k_karl_funeral"), well()],
      }),
      bye("enough", "cold"),
    ]),
    stand: node([
      r("yield", "frank", "ask", null, { effects: [heard("k_karl_funeral")] }),
      r("order", "threat", "push", null, {
        tell: ["trust:-1"],
        effects: [pt("p", -1)],
      }),
    ]),
    fold: node([bye("kind"), bye("done", "cold")]),
    bargain: node([bye("ok")]),
  }),
  talk("auh_t_karl_teschen", "auh_karl", all(FJ, war, period("y14", "y15a")), {
    open: node(
      [
        r("ask", "frank", "ask", "hq", {
          reacts: [rx(T("anxious"), "hq", well())],
        }),
        r("praise", "flatter", "ask", "polite", { miss: "polite" }),
        r("report", "warm", "deal", "direct", {
          tell: ["court:-1"],
          effects: [
            { kind: "person_trust", who: { office: "court" }, delta: -1 },
            setFlag("f_auh_karl_reports"),
          ],
        }),
        bye(),
      ],
      v("ff", ffAlive),
    ),
    hq: node(
      [
        r("conrad", "cold", "ask", "con", {
          reacts: [rx(T("stubborn"), "con", well())],
        }),
        r("distance", "frank", "ask", "far"),
        bye(),
      ],
      v("stub", T("stubborn")),
      v("anx", T("anxious")),
    ),
    polite: node([r("really", "frank", "ask", "hq"), bye("fine", "cold")]),
    direct: node([bye("good")]),
    con: node([bye("thanks"), bye("careful", "cold")]),
    far: node([bye("noted"), bye("hush", "cold")]),
  }),
  talk("auh_t_karl_front", "auh_karl", all(FJ, war, period("y15a", "y16a")), {
    open: node(
      [
        r("say", "warm", "ask", "words", {
          effects: [heard("k_karl_front")],
        }),
        r("numbers", "cold", "ask", "count", {
          reacts: [rx(T("anxious"), "shaken")],
        }),
        r("swap", "frank", "deal", "swap_t", {
          tell: ["audiences:-1"],
          effects: [{ kind: "audiences", delta: -1 }, heard("k_karl_front")],
        }),
        bye(),
      ],
      v("ff", ffAlive),
    ),
    words: node(
      [
        r("peace", "frank", "ask", "peace", {
          reacts: [rx(T("stubborn"), "peace", well())],
        }),
        bye("enough"),
      ],
      v("anx", T("anxious")),
    ),
    count: node([
      r("and", "frank", "ask", "words", { effects: [heard("k_karl_front")] }),
      bye("enough", "cold"),
    ]),
    shaken: node([
      r("sit", "warm", "ask", "words", { effects: [heard("k_karl_front")] }),
      bye("off", "cold"),
    ]),
    swap_t: node([bye("go")]),
    peace: node([bye("keep"), bye("silent", "threat")]),
  }),
  talk(
    "auh_t_karl_xx",
    "auh_karl",
    all(FJ, ent("ITA"), period("y15b", "y16a")),
    {
      open: node(
        [
          r("why", "frank", "ask", "why"),
          r("no", "cold", "push", "sulk", {
            tell: ["trust:-1"],
            effects: [pt("p", -1)],
            reacts: [rx(T("stubborn"), "again")],
          }),
          r("give", "warm", "deal", "given", {
            tell: ["cos:-1"],
            effects: [
              {
                kind: "person_trust",
                who: { office: "chief_of_staff" },
                delta: -1,
              },
              heard("k_karl_xx"),
            ],
          }),
          bye(),
        ],
        v("stub", T("stubborn")),
      ),
      why: node([
        r("ok", "warm", "ask", "given", { effects: [heard("k_karl_xx")] }),
        r("conrad", "cold", "ask", "con"),
        bye("later"),
      ]),
      sulk: node([bye("good"), bye("out", "cold")]),
      again: node([
        r("yield", "frank", "ask", "given", { effects: [heard("k_karl_xx")] }),
        r("order", "threat", "push", null, {
          tell: ["trust:-1"],
          effects: [pt("p", -1)],
        }),
      ]),
      con: node([
        r("then", "frank", "ask", "given", { effects: [heard("k_karl_xx")] }),
        bye("drop"),
      ]),
      given: node([bye("go")]),
    },
  ),
  talk(
    "auh_t_karl_peace",
    "auh_karl",
    all(FJ, heirDead, period("y15b", "y16b")),
    {
      open: node(
        [
          r("tell", "warm", "ask", "plan", {
            effects: [heard("k_karl_peace")],
          }),
          r("test", "cold", "ask", "hedge", {
            reacts: [rx(T("stubborn"), "plan", heard("k_karl_peace"))],
          }),
          r("swear", "frank", "deal", "sworn", {
            effects: [heard("k_karl_peace"), setFlag("f_auh_karl_swore")],
          }),
          bye(),
        ],
        v("anx", T("anxious")),
      ),
      hedge: node([
        r("again", "warm", "ask", "plan", { effects: [heard("k_karl_peace")] }),
        bye("enough", "cold"),
      ]),
      plan: node(
        [
          r("berlin", "frank", "ask", "berlin"),
          r("people", "cold", "ask", "men"),
          bye("heard"),
        ],
        v("stub", T("stubborn")),
      ),
      berlin: node([bye("know"), bye("fool", "cold")]),
      men: node([bye("know"), bye("fool", "cold")]),
      sworn: node([bye("go")]),
    },
  ),
  talk(
    "auh_t_karl_hungary",
    "auh_karl",
    all(any(FJ, FFT), period("y16a", "y16b")),
    {
      open: node(
        [
          r("oath", "frank", "ask", "oath", {
            effects: [heard("karl_on_oath")],
          }),
          r("warn", "cold", "push", "taught", {
            tell: ["trust:-1"],
            effects: [pt("p", -1), heard("karl_on_oath")],
            reacts: [rx(T("anxious"), "fear", heard("karl_on_oath"))],
          }),
          r("send", "warm", "deal", "sent", {
            tell: ["hungary:+1"],
            effects: [hungary(1), setFlag("f_auh_karl_budapest")],
          }),
          bye(),
        ],
        v("ff", FFT),
      ),
      oath: node(
        [r("tisza", "frank", "ask", "tisza"), bye("enough")],
        v("stub", T("stubborn")),
      ),
      taught: node([bye("good"), r("tisza", "frank", "ask", "tisza")]),
      fear: node([bye("calm"), bye("cold", "cold")]),
      tisza: node([bye("know"), bye("ha", "cold")]),
      sent: node([bye("go")]),
    },
  ),
];

const ZITA_TALKS: readonly GwScene[] = [
  talk("auh_t_zita_brothers", "auh_zita", period("y15a", "y17a"), {
    open: node(
      [
        r("how", "warm", "ask", "news", {
          effects: [heard("k_zita_brothers")],
        }),
        r("whose", "cold", "push", "edge", {
          tell: ["trust:-1"],
          effects: [pt("p", -1)],
          reacts: [rx(T("cold"), "news", heard("k_zita_brothers"))],
        }),
        r("post", "frank", "deal", "post", {
          tell: ["court:-1"],
          effects: [
            { kind: "person_trust", who: { office: "court" }, delta: -1 },
            heard("k_zita_brothers"),
          ],
        }),
        bye(),
      ],
      v("k", K),
    ),
    news: node(
      [r("sixtus", "frank", "ask", "six"), bye("thanks")],
      v("cold", T("cold")),
    ),
    edge: node([
      r("sorry", "warm", "ask", "news", {
        effects: [heard("k_zita_brothers")],
      }),
      bye("end", "cold"),
    ]),
    post: node([bye("done")]),
    six: node([bye("careful"), bye("noted", "cold")]),
  }),
  talk(
    "auh_t_zita_italian",
    "auh_zita",
    all(ent("ITA"), period("y15a", "y16b")),
    {
      open: node(
        [
          r("who", "frank", "ask", "who"),
          r("ignore", "cold", "push", "icy", {
            reacts: [rx(T("stubborn"), "icy", well(-1))],
          }),
          r("stop", "warm", "deal", "pledge", {
            effects: [
              promise(P, "zita_press", 8, {
                keep: { kind: "person_trust", who: role("who"), min: 1 },
              }),
            ],
          }),
          bye(),
        ],
        v("k", K),
      ),
      who: node(
        [
          r("press", "cold", "ask", "paper"),
          r("stop2", "warm", "deal", "pledge", {
            effects: [
              promise(P, "zita_press", 8, {
                keep: { kind: "person_trust", who: role("who"), min: 1 },
              }),
            ],
          }),
          bye("enough"),
        ],
        v("cold", T("cold")),
      ),
      paper: node(
        [bye("noted"), bye("drop", "cold")],
        v("poor", { kind: "source_band", source: "press", max: 1 }),
      ),
      icy: node([bye("end", "cold"), bye("sorry")]),
      pledge: node([bye("yes")]),
    },
  ),
  talk(
    "auh_t_zita_sixtus",
    "auh_zita",
    all(K, k("k_zita_brothers"), any(period("y16b", "y17b"), young)),
    {
      open: node(
        [
          r("call", "frank", "ask", "risk", {
            effects: [heard("k_zita_sixtus")],
          }),
          r("danger", "cold", "ask", "weigh", {
            reacts: [rx(T("stubborn"), "weigh", well())],
          }),
          r("if", "warm", "deal", "term", {
            effects: [heard("k_zita_sixtus"), setFlag("f_auh_sixtus_mother")],
          }),
          bye(),
        ],
        v("cold", T("cold")),
      ),
      weigh: node([
        r("yes", "frank", "ask", "risk", { effects: [heard("k_zita_sixtus")] }),
        bye("no", "cold"),
      ]),
      risk: node([r("fm", "frank", "ask", "fm"), bye("go")]),
      term: node([bye("go")]),
      fm: node([bye("think"), bye("hide", "cold")]),
    },
  ),
  talk("auh_t_zita_czernin", "auh_zita", all(K, period("y17a", "y18a")), {
    open: node(
      [
        r("trust", "frank", "ask", "judge", {
          reacts: [
            rx(
              { kind: "temperament", who: czernin, of: ["anxious"] },
              "nerves",
              heard("k_zita_czernin"),
            ),
          ],
        }),
        r("defend", "cold", "push", "firm", {
          tell: ["trust:-1"],
          effects: [pt("p", -1)],
        }),
        r("watch", "warm", "deal", "watch", {
          effects: [heard("k_zita_czernin"), setFlag("f_auh_zita_reads_fm")],
        }),
        bye(),
      ],
      v("stub", T("stubborn")),
    ),
    judge: node(
      [
        r("paris", "frank", "ask", "paris", {
          effects: [heard("k_zita_czernin")],
        }),
        bye("enough"),
      ],
      v("vain", { kind: "temperament", who: czernin, of: ["arrogant"] }),
      v("sly", { kind: "temperament", who: czernin, of: ["cunning"] }),
    ),
    nerves: node([r("paris", "frank", "ask", "paris"), bye("enough")]),
    firm: node([r("then", "frank", "ask", "judge"), bye("end", "cold")]),
    watch: node([bye("yes")]),
    paris: node(
      [
        bye("hm"),
        r("copy", "frank", "ask", null, {
          when: COPY,
          effects: [heard("k_knows_copy")],
        }),
      ],
      v("copy", COPY),
    ),
  }),
  talk(
    "auh_t_zita_word",
    "auh_zita",
    all(K, chose("auh_k_sixtus"), period("y17b", "y18b")),
    {
      open: node(
        [
          r("what", "frank", "ask", "weigh", {
            effects: [heard("k_zita_word")],
          }),
          r("deny", "cold", "push", "no", {
            reacts: [rx(T("cold"), "weigh", heard("k_zita_word"))],
          }),
          r("share", "warm", "deal", "share", {
            effects: [heard("k_zita_word"), setFlag("f_auh_zita_shares")],
          }),
          bye(),
        ],
        v("letter", chose("auh_k_sixtus", "letter_alsace")),
      ),
      weigh: node([bye("hard"), r("god", "frank", "ask", "god")]),
      no: node([
        r("then", "frank", "ask", "weigh", { effects: [heard("k_zita_word")] }),
        bye("end", "cold"),
      ]),
      share: node([bye("yes")]),
      god: node([bye("amen")]),
    },
  ),
  talk("auh_t_zita_stay", "auh_zita", all(K, period("y18a", "y18b")), {
    open: node(
      [
        r("what", "frank", "ask", "stay", { effects: [heard("k_zita_stay")] }),
        r("tired", "warm", "ask", "tired", {
          reacts: [rx(T("stubborn"), "stay", heard("k_zita_stay"))],
        }),
        r("vow", "warm", "deal", "vow", {
          effects: [heard("k_zita_stay"), setFlag("f_auh_zita_vow")],
        }),
        bye(),
      ],
      v("late", score({ max: -20 })),
    ),
    stay: node([r("kids", "frank", "ask", "kids"), bye("hear")]),
    tired: node([
      r("again", "frank", "ask", "stay", { effects: [heard("k_zita_stay")] }),
      bye("enough"),
    ]),
    vow: node([bye("yes")]),
    kids: node([bye("hm"), bye("end", "cold")]),
  }),
];

const reveal = (id: "rou_treaty_dead"): GwEffect =>
  doWorld({ do: "reveal", id });

const CZERNIN_TALKS: readonly GwScene[] = [
  talk("auh_t_cz_bucharest", "auh_czernin", period("C"), {
    open: node(
      [
        r("treaty", "frank", "ask", "treaty", {
          reacts: [
            rx(
              { kind: "candid", who: P },
              "treaty_true",
              heard("k_cz_bucharest"),
              reveal("rou_treaty_dead"),
            ),
          ],
        }),
        r("flatter", "flatter", "ask", "show", {
          effects: [heard("k_cz_bucharest")],
        }),
        r("pay", "warm", "deal", "paid", {
          tell: ["money:-1"],
          effects: [gauge("money", -1), heard("k_cz_bucharest")],
        }),
        bye(),
      ],
      v("arr", T("arrogant")),
      v("anx", T("anxious")),
    ),
    treaty: node([
      r("really", "cold", "ask", "treaty_true", {
        effects: [heard("k_cz_bucharest")],
      }),
      bye("enough"),
    ]),
    treaty_true: node(
      [bye("thanks")],
      v("dead", { kind: "secret", id: "rou_treaty_dead" }),
    ),
    show: node([bye("good"), bye("less", "cold")]),
    paid: node([bye("go")]),
  }),
  talk(
    "auh_t_cz_king",
    "auh_czernin",
    all(not(ent("ROU")), period("y14", "y15b")),
    {
      open: node(
        [
          r("how", "frank", "ask", "king", { effects: [heard("k_cz_king")] }),
          r("press", "cold", "push", "pushed", {
            reacts: [
              rx(T("arrogant"), "sour"),
              rx(T("anxious"), "king", heard("k_cz_king")),
            ],
            effects: [heard("k_cz_king")],
          }),
          r("word", "warm", "deal", "dealt", {
            tell: ["hungary:-1"],
            effects: [hungary(-1), heard("k_cz_king")],
          }),
          bye(),
        ],
        v("dead", { kind: "chapter", min: 9 }),
      ),
      king: node(
        [bye("thanks"), bye("noted", "cold")],
        v("dead", { kind: "chapter", min: 9 }),
      ),
      pushed: node([bye("end", "cold")]),
      sour: node([bye("end", "cold"), bye("cool")]),
      dealt: node([bye("go")]),
    },
  ),
  talk(
    "auh_t_cz_price",
    "auh_czernin",
    all(not(ent("ROU")), period("y15a", "y16a")),
    {
      open: node(
        [
          r("sum", "cold", "ask", "sum", { effects: [heard("k_cz_price")] }),
          r("praise", "flatter", "ask", "boast", {
            reacts: [rx(T("cunning"), "dodge")],
            effects: [heard("k_cz_price")],
          }),
          r("name", "frank", "deal", "named", {
            tell: ["hungary:-1"],
            effects: [hungary(-1), heard("k_cz_price")],
          }),
          bye(),
        ],
        v("anx", T("anxious")),
      ),
      sum: node([bye("hm"), r("tisza", "frank", "ask", "tisza")]),
      boast: node([r("sum", "cold", "ask", "sum"), bye("good")]),
      dodge: node([
        r("sum", "cold", "ask", "sum", { effects: [heard("k_cz_price")] }),
        bye("end", "cold"),
      ]),
      named: node([bye("go")]),
      tisza: node([bye("know")]),
    },
  ),
  talk("auh_t_cz_rout", "auh_czernin", all(ent("ROU"), period("y16b")), {
    open: node(
      [
        r("why", "frank", "ask", "why", {
          reacts: [rx(T("arrogant"), "blame")],
          effects: [heard("k_cz_king")],
        }),
        r("charge", "threat", "push", "blame", {
          tell: ["trust:-1"],
          effects: [pt("p", -1)],
          miss: "blame",
        }),
        r("post", "warm", "deal", "post", {
          tell: ["hungary:-1"],
          effects: [hungary(-1), heard("k_cz_king")],
        }),
        bye(),
      ],
      v("anx", T("anxious")),
    ),
    why: node([bye("thanks"), bye("cold", "cold")]),
    blame: node([
      r("again", "frank", "ask", "why", { effects: [heard("k_cz_king")] }),
      bye("end", "cold"),
    ]),
    post: node([bye("go")]),
  }),
  talk("auh_t_cz_bread", "auh_czernin", all(K, period("y17b", "y18a")), {
    open: node(
      [
        r("seen", "frank", "ask", "seen", { effects: [heard("k_cz_bread")] }),
        r("sum", "cold", "ask", "sum", {
          reacts: [rx(T("anxious"), "seen", heard("k_cz_bread"))],
          effects: [heard("k_cz_bread")],
        }),
        r("hand", "warm", "deal", "hand", {
          tell: ["authority:-5"],
          effects: [authority(-5), heard("k_cz_bread")],
        }),
        bye(),
      ],
      v("cun", T("cunning")),
    ),
    seen: node([r("chelm", "frank", "ask", "chelm"), bye("go")]),
    sum: node([r("chelm", "frank", "ask", "chelm"), bye("go", "cold")]),
    hand: node([bye("go")]),
    chelm: node([bye("hm"), bye("noted", "cold")]),
  }),
  talk(
    "auh_t_cz_speech",
    "auh_czernin",
    all(K, holds("foreign", "auh_czernin"), period("y18a")),
    {
      open: node(
        [
          r("show", "frank", "ask", "draft", {
            effects: [heard("k_cz_speech")],
          }),
          r("order", "cold", "push", "draft", {
            tell: ["trust:-1"],
            effects: [pt("p", -1), heard("k_cz_speech")],
            reacts: [rx(T("arrogant"), "huff", heard("k_cz_speech"))],
          }),
          r("read", "warm", "deal", "read", {
            effects: [heard("k_cz_speech"), setFlag("f_auh_read_speech")],
          }),
          bye(),
        ],
        v("anx", T("anxious")),
      ),
      draft: node([r("clem", "frank", "ask", "clem"), bye("later")]),
      huff: node([bye("calm"), bye("end", "cold")]),
      read: node([bye("go")]),
      clem: node([bye("hm"), bye("noted", "cold")]),
    },
  ),
];

const KAR_MET = k("k_kar_met");
const inFrance = { kind: "chapter", min: 8 } as const;

const KAROLYI_TALKS: readonly GwScene[] = [
  talk("auh_t_kar_first", "auh_karolyi", period("C", "y14"), {
    open: node(
      [
        r("hear", "warm", "ask", "hear", { effects: [heard("k_kar_met")] }),
        r("rebuke", "cold", "push", "stiff", {
          effects: [heard("k_kar_met")],
          reacts: [rx(T("arrogant"), "stiff", well(-1), heard("k_kar_met"))],
        }),
        r("seat", "frank", "deal", "seat", {
          tell: ["hun:-1"],
          effects: [
            { kind: "person_trust", who: { office: "hun_pm" }, delta: -1 },
            heard("k_kar_met"),
          ],
        }),
        bye(),
      ],
      v("back", inFrance),
    ),
    hear: node([r("berlin", "frank", "ask", "berlin"), bye("thanks")]),
    stiff: node([bye("end", "cold"), r("sit", "warm", "ask", "hear")]),
    seat: node([bye("go")]),
    berlin: node([bye("noted"), bye("careful", "cold")]),
  }),
  talk("auh_t_kar_paris", "auh_karolyi", all(KAR_MET, period("y14", "y15b")), {
    open: node(
      [
        r("terms", "frank", "ask", "terms"),
        r("spy", "threat", "push", "stiff", {
          tell: ["trust:-1"],
          effects: [pt("p", -1)],
        }),
        r("letter", "warm", "deal", "letter", {
          effects: [setFlag("f_auh_kar_paris")],
        }),
        bye(),
      ],
      v("anx", T("anxious")),
    ),
    terms: node(
      [bye("thanks"), bye("noted", "cold")],
      v("candid", { kind: "candid", who: P }),
    ),
    stiff: node([bye("end", "cold")]),
    letter: node([bye("go")]),
  }),
  talk("auh_t_kar_land", "auh_karolyi", all(KAR_MET, period("y15b", "y17a")), {
    open: node(
      [
        r("how", "frank", "ask", "how", { effects: [heard("k_kar_land")] }),
        r("own", "cold", "ask", "own", {
          reacts: [rx(T("stubborn"), "how", heard("k_kar_land"))],
          effects: [heard("k_kar_land")],
        }),
        r("draft", "warm", "deal", "draft", {
          effects: [heard("k_kar_land"), setFlag("f_auh_land_draft")],
        }),
        bye(),
      ],
      v("arr", T("arrogant")),
    ),
    how: node([r("tisza", "frank", "ask", "tisza"), bye("thanks")]),
    own: node([bye("hm"), r("how", "frank", "ask", "how")]),
    draft: node([bye("go")]),
    tisza: node([bye("noted")]),
  }),
  talk("auh_t_kar_split", "auh_karolyi", all(KAR_MET, period("y16a", "y17a")), {
    open: node(
      [
        r("count", "frank", "ask", "count"),
        r("stay", "warm", "push", "stay", {
          reacts: [rx(T("stubborn"), "stay", well(-1))],
        }),
        r("sound", "frank", "deal", "sound", {
          tell: ["promise"],
          effects: [
            promise(P, "kar_peace", 16, {
              keep: any(
                chose("auh_k_sixtus", "general_words"),
                chose("auh_k_sixtus", "letter_alsace"),
                chose("auh_k_sixtus", "tell_czernin"),
                chose("auh_h_mitteleuropa", "refuse"),
              ),
            }),
          ],
        }),
        bye(),
      ],
      v("anx", T("anxious")),
    ),
    count: node(
      [bye("thanks"), bye("noted", "cold")],
      v("low", hungaryAt({ max: -1 })),
      v("high", hungaryAt({ min: 2 })),
    ),
    stay: node([bye("end", "cold"), r("count", "frank", "ask", "count")]),
    sound: node([bye("yes")]),
  }),
  talk("auh_t_kar_vote", "auh_karolyi", all(KAR_MET, period("y16b", "y18a")), {
    open: node(
      [
        r("how", "frank", "ask", "trench", { effects: [heard("k_kar_vote")] }),
        r("doubt", "cold", "ask", "doubt", {
          reacts: [rx(T("anxious"), "trench", heard("k_kar_vote"))],
        }),
        r("say", "warm", "deal", "said", {
          tell: ["hungary:-1"],
          effects: [hungary(-1), heard("k_kar_vote")],
        }),
        bye(),
      ],
      v("k", K),
    ),
    trench: node([r("tisza", "frank", "ask", "tisza"), bye("thanks")]),
    doubt: node([
      r("again", "frank", "ask", "trench", { effects: [heard("k_kar_vote")] }),
      bye("end", "cold"),
    ]),
    said: node([bye("go")]),
    tisza: node([bye("noted")]),
  }),
  talk(
    "auh_t_kar_pm",
    "auh_karolyi",
    all(KAR_MET, score({ max: -10 }), period("y18a", "y18b")),
    {
      open: node(
        [
          r("if", "frank", "ask", "if", { effects: [heard("k_kar_pm")] }),
          r("test", "cold", "ask", "test", {
            reacts: [rx(T("arrogant"), "test", well(-1))],
          }),
          r("offer", "warm", "deal", "offer", {
            tell: ["hungary:+1"],
            effects: [hungary(1), heard("k_kar_pm")],
          }),
          bye(),
        ],
        v("anx", T("anxious")),
      ),
      if: node([r("crown", "frank", "ask", "crown"), bye("thanks")]),
      test: node([
        r("if", "frank", "ask", "if", { effects: [heard("k_kar_pm")] }),
        bye("end", "cold"),
      ]),
      offer: node([bye("go")]),
      crown: node([bye("noted")]),
    },
  ),
];

const VISITS: readonly GwScene[] = [
  visit("auh_v_kor_may", "auh_korosec", all(K, period("y17a", "y17b")), 5, {
    open: node(
      [
        r("show", "frank", "ask", "text", { effects: [heard("k_kor_may")] }),
        r("warn", "cold", "push", "firm", {
          tell: ["nations:-1"],
          effects: [nations(-1)],
          reacts: [rx(T("cunning"), "text", heard("k_kor_may"))],
        }),
        r("first", "warm", "deal", "first", {
          tell: ["nations:+1"],
          effects: [nations(1), heard("k_kor_may")],
        }),
        bye(),
      ],
      v("cun", T("cunning")),
    ),
    text: node([r("croatia", "frank", "ask", "cro"), bye("thanks")]),
    firm: node([bye("end", "cold")]),
    first: node([bye("go")]),
    cro: node([bye("noted")]),
  }),
  visit(
    "auh_v_lam_plan",
    "auh_lammasch",
    all(any(K, FFT), period("y17a", "y18b")),
    5,
    {
      open: node(
        [
          r("read", "warm", "ask", "plan", {
            effects: [heard("k_lam_federal")],
          }),
          r("short", "cold", "ask", "short", {
            reacts: [rx(T("stubborn"), "plan", heard("k_lam_federal"))],
          }),
          r("keep", "frank", "deal", "kept", {
            effects: [heard("k_lam_federal"), setFlag("f_auh_lam_draft")],
          }),
          bye(),
        ],
        v("weary", T("weary")),
      ),
      plan: node([r("peace", "frank", "ask", "peace"), bye("thanks")]),
      short: node([
        r("read", "warm", "ask", "plan", { effects: [heard("k_lam_federal")] }),
        bye("end", "cold"),
      ]),
      kept: node([bye("go")]),
      peace: node([bye("noted")]),
    },
  ),
  visit(
    "auh_v_wil_vasyl",
    "auh_wilhelm",
    all(
      K,
      any({ kind: "at_war", tag: "RUS" }, out("RUS")),
      period("y17b", "y18b"),
    ),
    5,
    {
      open: node(
        [
          r("dream", "warm", "ask", "dream", {
            effects: [heard("k_wil_vasyl")],
          }),
          r("shirt", "cold", "push", "soldier", {
            reacts: [rx(T("arrogant"), "soldier", well(-1))],
            effects: [heard("k_wil_vasyl")],
          }),
          r("back", "frank", "deal", "backed", {
            tell: ["deu:-1"],
            effects: [trust("DEU", -1), heard("k_wil_vasyl")],
          }),
          bye(),
        ],
        v("anx", T("anxious")),
      ),
      dream: node([r("poles", "frank", "ask", "poles"), bye("thanks")]),
      soldier: node([bye("go"), bye("end", "cold")]),
      backed: node([bye("go")]),
      poles: node([bye("noted")]),
    },
  ),
  visit("auh_v_koer_quota", "auh_koerber", period("y16a", "y17a"), 5, {
    open: node(
      [
        r("sum", "frank", "ask", "sum", { effects: [heard("k_koer_quota")] }),
        r("again", "cold", "push", "teach", {
          reacts: [rx(T("cold"), "sum", heard("k_koer_quota"))],
        }),
        r("back", "warm", "deal", "backed", {
          tell: ["hungary:-1"],
          effects: [hungary(-1), heard("k_koer_quota")],
        }),
        bye(),
      ],
      v("k", K),
    ),
    sum: node([r("tisza", "frank", "ask", "tisza"), bye("thanks")]),
    teach: node([
      r("yes", "frank", "ask", "sum", { effects: [heard("k_koer_quota")] }),
      bye("end", "cold"),
    ]),
    backed: node([bye("go")]),
    tisza: node([bye("noted")]),
  }),
  visit(
    "auh_v_lud_grain",
    "deu_ludendorff",
    all(out("RUS"), period("y17b", "y18b")),
    6,
    {
      open: node(
        [
          r("whose", "frank", "ask", "whose"),
          r("no", "threat", "push", "hard", {
            tell: ["deu:-1", "bread:-1"],
            effects: [trust("DEU", -1), gauge("bread", -1)],
          }),
          r("share", "cold", "deal", "share", {
            tell: ["berlin:+1", "bread:+1"],
            effects: [...debtUp, gauge("bread", 1)],
          }),
          bye("leave", "cold"),
        ],
        v("hungry", gaugeAt("bread", 1)),
      ),
      whose: node([
        r("share2", "cold", "deal", "share", {
          tell: ["berlin:+1", "bread:+1"],
          effects: [...debtUp, gauge("bread", 1)],
        }),
        bye("leave", "cold"),
      ]),
      hard: node([bye("leave", "cold")]),
      share: node([bye("leave", "cold")]),
    },
  ),
];

export const AUH_CROWN_SCENES: readonly GwScene[] = [
  ...CROWN_THRONE,
  ...CROWN_LETTER,
  ...CROWN_END,
  ...KARL_TALKS,
  ...ZITA_TALKS,
  ...CZERNIN_TALKS,
  ...KAROLYI_TALKS,
  ...VISITS,
];
