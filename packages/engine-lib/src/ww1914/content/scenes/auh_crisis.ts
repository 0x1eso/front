import type {
  GwInstitution,
  GwOpening,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
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
  GwReply,
  GwScene,
  GwStance,
  GwVariant,
  GwWho,
  keepPromise,
  memory,
  moody,
  not,
  promise,
  reason,
  remember,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwWorldEffect } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * 「오스트리아-헝가리」, the crisis share: the auh_c_ scenes, the talks of
 * Berchtold, Hoyos, Biliński and Stürgkh, and five visits. Data only; the text
 * is in resources/ww1914/ko/AUH.crisis.json. Plan: ww135-plan-auh.md §4, §8.
 */

const NATION: GwScene["nation"] = ["AUH"];
const p = role("p");
const cos = role("cos");
const fm = role("fm");
const pm = role("hun_pm");
const chan = role("chancellor");
const war = role("war");
const court = role("court");

/** Hungary, the joint council, the nations: the empire's bodies. */
const body = (inst: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst,
  delta,
});
const hungary = (d: number) => body("hungary", d);
const council = (d: number) => body("council", d);
const nations = (d: number) => body("nations", d);

const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
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
const delay = (days: number): GwEffect => ({ kind: "delay", days });
const money = (delta: number): GwEffect => ({
  kind: "gauge",
  gauge: "money",
  delta,
});
const order = (delta: number): GwEffect => ({
  kind: "gauge",
  gauge: "order",
  delta,
});
const act = (of: GwWorldEffect): GwEffect => ({ kind: "world", of });
const hold = act({ do: "hold" });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const reveal = (id: "srb_officers_plot" | "ita_fra_understanding") =>
  maybe({ kind: "secret", id }, act({ do: "reveal", id }));
const force = (theatre: "east" | "balkan", delta: number) =>
  act({ do: "force", tag: "AUH", theatre, delta });

const crisis: GwCond = { kind: "crisis", topic: "balkan" };
const chain = (min: number, max?: number): GwCond => ({
  kind: "world",
  of: { is: "chain", min, max },
});
/** July's chain, the Sarajevo crisis, whenever it runs: not a later spark's. */
const july = (min?: number, max?: number): GwCond => ({
  kind: "world",
  of: {
    is: "chain",
    short: false,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  },
});
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const opening = (...of: GwOpening[]): GwCond => ({ kind: "opening", of });
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const inWar: GwCond = { kind: "world", of: { is: "war" } };
const hasSecret = (id: string): GwCond => ({ kind: "secret", id });
const pride = (who: GwWho, min: number): GwCond => ({
  kind: "pride",
  who,
  min,
});
const chapters = (min: number, max: number): GwCond => ({
  kind: "chapter",
  min,
  max,
});
const inOffice = (who: GwWho): GwCond => ({ kind: "in_office", who });

/** The archduke lives (plan §0, `FF+`). */
const ffAlive = opening("sarajevo_survived", "sarajevo_failed", "no_sarajevo");
const eastPushed: GwCond = {
  kind: "world",
  of: { is: "battle", theatre: "east", of: ["advance", "break"] },
};
/** Serbia has been declared on, by the seat's paper or by the war itself. */
const declared = any(flag("f_auh_declared"), atWar("SRB"));

const v = (id: string, when: GwCond): GwVariant => ({ id, when });
const base: GwVariant = { id: "base" };
/** A variant for each temperament of `who`, then the base. */
const moods = (who: GwWho, ...of: Parameters<typeof moody>[1][]) => [
  ...of.map((t) => v(t, moody(who, t))),
  base,
];

/**
 * Scenes whose gate already says when (ww170: the July chain, or the war's own
 * state): they keep no stage list, so a crisis or a war that comes late still
 * brings them.
 */
const BY_STATE: ReadonlySet<string> = new Set([
  "auh_c_berlin_answer",
  "auh_c_council_july",
  "auh_c_decree",
  "auh_c_funeral",
  "auh_c_grey_conference",
  "auh_c_no_annex",
  "auh_c_note_out",
  "auh_c_serb_reply",
  "auh_c_serb_second",
  "auh_c_war_russia",
  "auh_c_war_serbia",
]);

function scene(
  id: string,
  kind: GwScene["kind"],
  salience: number,
  tags: GwScene["tags"],
  cast: GwScene["cast"],
  when: GwCond,
  variants: GwVariant[],
  more: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: NATION,
    kind,
    ...(BY_STATE.has(id) ? {} : { stage: ["crisis", "y1914"] }),
    when,
    cast,
    salience,
    tags,
    once: true,
    variants,
    ...more,
  };
}

const opt = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): NonNullable<GwScene["options"]>[number] =>
  when === undefined ? { id, tell, effects } : { id, when, tell, effects };

const r = (
  id: string,
  stance: GwStance,
  kind: GwReply["kind"],
  tell: string[],
  effects: GwEffect[],
  next: string | null,
  more: Partial<GwReply> = {},
): GwReply => ({ id, stance, kind, tell, effects, next, ...more });

const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const plain = (...replies: GwReply[]): GwNode => node([base], ...replies);
const close = (id: string, stance: GwStance): GwReply =>
  r(id, stance, "leave", [], [], null);

/** Called from the people screen. */
function talk(
  id: string,
  person: string,
  when: GwCond,
  nodes: Record<string, GwNode>,
  stage?: GwScene["stage"],
): GwScene {
  return {
    id,
    nation: NATION,
    kind: "talk",
    ...(stage === undefined ? {} : { stage }),
    when,
    cast: { p: { person } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [base],
    start: "open",
    nodes,
  };
}
const C: GwScene["stage"] = ["crisis", "y1914"];

/** The desk brings it: they come without being called. */
function visit(
  id: string,
  rule: GwScene["cast"][string],
  when: GwCond | undefined,
  salience: number,
  tags: GwScene["tags"],
  nodes: Record<string, GwNode>,
  more: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: NATION,
    kind: "talk",
    ...(when === undefined ? {} : { when }),
    cast: { p: rule },
    salience,
    tags,
    once: true,
    who: "p",
    variants: [base],
    start: "open",
    nodes,
    ...more,
  };
}

const K = remember;
const pt = trustOf;

const SCENES: readonly GwScene[] = [
  scene(
    "auh_c_ischl_wire",
    "wire",
    9,
    ["foreign", "tension_up"],
    { court: { office: "court" } },
    chapters(0, 0),
    [
      v("quiet", opening("no_sarajevo")),
      v("delayed", opening("sarajevo_delayed")),
      v("failed", opening("sarajevo_failed")),
      v("survived", opening("sarajevo_survived")),
      base,
    ],
  ),
  scene(
    "auh_c_roster",
    "report",
    9,
    ["people"],
    { fm: { office: "foreign" } },
    chapters(0, 1),
    [v("quiet", not(crisis)), v("heir", ffAlive), base],
    { stamp: "confirmed", source: "staff" },
  ),
  scene(
    "auh_c_who_signs",
    "report",
    9,
    ["people", "tension_up"],
    { fm: { office: "foreign" } },
    // The wire is the first paper of the crisis; this one answers it.
    all(
      crisis,
      { kind: "world", of: { is: "chain", short: false, max: 5 } },
      { kind: "world", of: { is: "chain", short: false, min: 1, max: 5 } },
    ),
    [v("weary", moody(fm, "weary")), base],
    { stamp: "confirmed", source: "staff" },
  ),
  scene(
    "auh_c_funeral",
    "proposal",
    8,
    ["home"],
    { court: { office: "court" }, mont: { person: "auh_montenuovo" } },
    // The heir is dead and July's chain has just begun.
    any(
      all(opening("sarajevo"), july(0, 1)),
      all(opening("sarajevo_delayed"), crisis, july(2, 4)),
    ),
    [
      v("asked", memory("k_ber_funeral")),
      v("delayed", opening("sarajevo_delayed")),
      base,
    ],
    {
      fallback: "by_the_rules",
      options: [
        opt(
          "by_the_rules",
          ["montenuovo:+1"],
          [pt(byName("auh_montenuovo"), 1), setFlag("f_auh_funeral_small")],
        ),
        opt(
          "same_step",
          ["montenuovo:-2", "nations:+1"],
          [
            pt(byName("auh_montenuovo"), -2),
            nations(1),
            setFlag("f_auh_funeral_same_step"),
            reason("auh_c_funeral_r1"),
          ],
          memory("k_karl_funeral"),
        ),
        opt(
          "invite_kings",
          ["deu:+1", "temp:+1", "montenuovo:-1"],
          [
            trust("DEU", 1),
            temp(1),
            pt(byName("auh_montenuovo"), -1),
            setFlag("f_auh_funeral_kings"),
          ],
          memory("k_ber_funeral"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_ff_alive",
    "proposal",
    7,
    ["foreign"],
    { fm: { office: "foreign" }, cos: { office: "chief_of_staff" } },
    all(opening("sarajevo_survived"), chapters(0, 2)),
    [v("sitting", memory("k_ff_no_war")), base],
    {
      fallback: "hear_both",
      options: [
        opt("hear_both", [], [setFlag("f_auh_heard_both")]),
        opt(
          "back_archduke",
          ["temp:-2", "cos:-1", "army:-1"],
          [temp(-2), pt(cos, -1), army(-1), setFlag("f_auh_ff_line")],
          memory("k_ff_no_war"),
        ),
        opt(
          "back_conrad",
          ["temp:+2", "army:+1", "archduke:-2"],
          [
            temp(2),
            army(1),
            pt(byName("auh_ff"), -2),
            setFlag("f_auh_conrad_line"),
          ],
        ),
      ],
    },
  ),
  scene(
    "auh_c_failed_plot",
    "proposal",
    7,
    ["foreign"],
    { fm: { office: "foreign" } },
    all(opening("sarajevo_failed"), chapters(0, 1)),
    [v("cunning", moody(fm, "cunning")), base],
    {
      fallback: "ask_inquiry",
      options: [
        opt("ask_inquiry", ["temp:-1"], [temp(-1), setFlag("f_auh_inquiry")]),
        opt(
          "press_belgrade",
          ["temp:+2", "army:+1"],
          [temp(2), army(1), setFlag("f_auh_pressed_belgrade")],
        ),
        opt(
          "hush",
          ["temp:-2", "cos:-1"],
          [
            temp(-2),
            pt({ office: "chief_of_staff" }, -1),
            setFlag("f_auh_hushed"),
          ],
          memory("k_ff_no_war"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_belvedere",
    "audience",
    7,
    ["people", "tension_up"],
    { court: { office: "court" }, ff: { person: "auh_ff" } },
    all(ffAlive, not(crisis), { kind: "chapter", max: 5 }),
    [
      v("after", {
        kind: "world",
        of: { is: "chain_end", of: ["compromise", "humiliation", "fizzled"] },
      }),
      base,
    ],
    {
      fallback: "put_aside",
      options: [
        opt("put_aside", [], [setFlag("f_auh_program_set_aside")]),
        opt(
          "read_it",
          ["archduke:+1", "court:-1", "hun_pm:-1"],
          [
            pt(byName("auh_ff"), 1),
            pt(court, -1),
            pt({ office: "hun_pm" }, -1),
            setFlag("f_auh_program_read"),
          ],
          memory("k_ff_program"),
        ),
        opt(
          "forbid",
          ["archduke:-2", "court:+1"],
          [
            pt(byName("auh_ff"), -2),
            pt(court, 1),
            setFlag("f_auh_program_forbidden"),
          ],
        ),
      ],
    },
  ),
  scene(
    "auh_c_albania",
    "proposal",
    6,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" } },
    all(
      any(opening("no_sarajevo"), not(crisis)),
      { kind: "pressure", topic: "balkan", min: 1 },
      { kind: "chapter", max: 5 },
    ),
    [v("wire", { kind: "trust", tag: "ITA", max: -1 }), base],
    {
      fallback: "watch",
      options: [
        opt("watch", ["ita:-1"], [trust("ITA", -1)]),
        opt(
          "joint_with_rome",
          ["ita:+1", "money:-1"],
          [trust("ITA", 1), money(-1), setFlag("f_auh_albania_joint")],
          memory("k_ber_rome"),
        ),
        opt(
          "send_ships",
          ["ita:-2", "temp:+1"],
          [
            trust("ITA", -2),
            temp(1),
            { kind: "pressure", topic: "balkan", delta: 1 },
            setFlag("f_auh_albania_ships"),
          ],
        ),
      ],
    },
  ),
  scene(
    "auh_c_conrad_now",
    "dispute",
    8,
    ["war", "tension_up"],
    { cos: { office: "chief_of_staff" }, fm: { office: "foreign" } },
    all(crisis, chain(0, 2)),
    moods(cos, "anxious", "arrogant", "stubborn"),
    {
      fallback: "wait_inquiry",
      options: [
        opt(
          "wait_inquiry",
          ["cos:-1"],
          [pt(cos, -1), setFlag("f_auh_inquiry")],
        ),
        opt(
          "mobilise_now",
          ["temp:+2", "army:+1", "hungary:-1", "fm:-1"],
          [
            temp(2),
            army(1),
            hungary(-1),
            pt(fm, -1),
            act({ do: "mobilize", tag: "AUH", level: 1 }),
            setFlag("f_auh_early_mob"),
          ],
        ),
        opt(
          "send_wiesner",
          ["fm:+1"],
          [
            pt(fm, 1),
            setFlag("f_auh_inquiry"),
            setFlag("f_auh_wiesner_sent"),
            reveal("srb_officers_plot"),
          ],
          memory("k_bil_bosnia"),
        ),
        opt(
          "count_leave",
          ["cos:-1", "army:+1"],
          [pt(cos, -1), army(1), setFlag("f_auh_leave_counted")],
          memory("k_krob_harvest"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_tisza_letter",
    "dispute",
    9,
    ["foreign", "tension_up"],
    {
      hun_pm: { office: "hun_pm" },
      fm: { office: "foreign" },
      cos: { office: "chief_of_staff" },
    },
    all(crisis, chain(1, 2), {
      kind: "holder",
      office: "hun_pm",
      person: "auh_tisza",
    }),
    [
      v("rushed", flag("f_auh_early_mob")),
      v("cheque", flag("f_auh_sign_berlin")),
      v("cold", moody(pm, "cold")),
      v("arrogant", moody(pm, "arrogant")),
      base,
    ],
    {
      fallback: "persuade",
      options: [
        opt(
          "persuade",
          ["delay:7", "army:-1"],
          [delay(7), army(-1), hold, setFlag("f_auh_sign_hungary")],
        ),
        opt(
          "bypass",
          ["army:+1", "hungary:-2", "hun_pm:-1"],
          [army(1), hungary(-2), pt(pm, -1), setFlag("f_auh_tisza_bypassed")],
        ),
        opt(
          "soften",
          ["temp:-2", "army:-2", "deu:-1"],
          [
            temp(-2),
            army(-2),
            trust("DEU", -1),
            setFlag("f_auh_softened"),
            maybe(pride(cos, 3), act({ do: "letter", who: cos })),
          ],
        ),
        opt(
          "trade_grain",
          ["hungary:+1", "money:-1"],
          [
            hungary(1),
            money(-1),
            setFlag("f_auh_sign_hungary"),
            setFlag("f_auh_grain_price"),
          ],
          memory("k_bur_tisza"),
        ),
        opt(
          "romania_word",
          ["hungary:+1", "rou:+1", "deu:+1"],
          [
            hungary(1),
            trust("ROU", 1),
            trust("DEU", 1),
            setFlag("f_auh_sign_hungary"),
            setFlag("f_auh_rou_word"),
          ],
          memory("k_cz_bucharest"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_hoyos_mission",
    "crisis",
    9,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" } },
    all(crisis, chain(1, 2)),
    [
      v("survived", opening("sarajevo_survived")),
      v("bypassed", flag("f_auh_tisza_bypassed")),
      v("waiting", flag("f_auh_sign_hungary")),
      v("delayed", opening("sarajevo_delayed")),
      base,
    ],
    {
      fallback: "letter_only",
      options: [
        opt(
          "letter_only",
          ["deu:+1"],
          [
            trust("DEU", 1),
            setFlag("f_auh_letter_only"),
            maybe(
              { kind: "ai", tag: "DEU", of: ["hardline", "opportunist"] },
              setFlag("f_auh_sign_berlin"),
            ),
          ],
        ),
        opt(
          "full_memo",
          ["deu:+1", "temp:+1"],
          [
            trust("DEU", 1),
            temp(1),
            setFlag("f_auh_sign_berlin"),
            setFlag("f_auh_memo_full"),
          ],
        ),
        opt(
          "no_envoy",
          ["deu:-1", "temp:-1", "hungary:+1"],
          [trust("DEU", -1), temp(-1), hungary(1), setFlag("f_auh_no_envoy")],
          memory("k_tisza_wait"),
        ),
        opt(
          "ask_term",
          ["temp:+1"],
          [temp(1), setFlag("f_auh_sign_berlin"), setFlag("f_auh_berlin_term")],
          memory("k_hoyos_term"),
        ),
        opt(
          "partition_word",
          ["temp:+2", "hungary:-2", "rus:-1"],
          [
            temp(2),
            hungary(-2),
            trust("RUS", -1),
            setFlag("f_auh_sign_berlin"),
            setFlag("f_auh_partition_said"),
          ],
          memory("k_hoyos_partition"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_berlin_answer",
    "wire",
    9,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" } },
    all(july(), crisis, seen("auh_c_hoyos_mission")),
    [
      v("term", flag("f_auh_berlin_term")),
      v("cold", not(flag("f_auh_sign_berlin"))),
      base,
    ],
  ),
  scene(
    "auh_c_council_july",
    "crisis",
    8,
    ["foreign", "tension_up"],
    {
      fm: { office: "foreign" },
      hun_pm: { office: "hun_pm" },
      chancellor: { office: "chancellor" },
      war: { office: "war" },
      finance: { office: "finance" },
    },
    all(july(), crisis, seen("auh_c_hoyos_mission")),
    [
      v("bypassed", flag("f_auh_tisza_bypassed")),
      v("no_berlin", not(flag("f_auh_sign_berlin"))),
      v("signed", flag("f_auh_sign_hungary")),
      base,
    ],
    {
      fallback: "note_first",
      options: [
        opt(
          "note_first",
          ["council:+1"],
          [council(1), setFlag("f_auh_sign_council")],
        ),
        opt(
          "war_at_once",
          ["army:+1", "temp:+2", "hungary:-1"],
          [
            army(1),
            temp(2),
            hungary(-1),
            setFlag("f_auh_sign_council"),
            setFlag("f_auh_council_war"),
          ],
        ),
        opt(
          "note_then_talk",
          ["council:+1", "hungary:+1", "army:-1"],
          [
            council(1),
            hungary(1),
            army(-1),
            setFlag("f_auh_sign_council"),
            setFlag("f_auh_sign_hungary"),
          ],
          memory("k_tisza_terms"),
        ),
        opt(
          "ask_moltke",
          ["army:+1", "fm:-1", "temp:+1"],
          [
            army(1),
            pt(fm, -1),
            temp(1),
            setFlag("f_auh_sign_council"),
            setFlag("f_auh_moltke_asked"),
          ],
          memory("k_con_moltke"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_wiesner",
    "report",
    7,
    ["foreign"],
    {},
    all(crisis, chain(2, 3)),
    [
      v("plot", hasSecret("srb_officers_plot")),
      v("sent", flag("f_auh_wiesner_sent")),
      base,
    ],
    { stamp: "unconfirmed", source: "agents" },
  ),
  scene(
    "auh_c_harvest",
    "proposal",
    7,
    ["home"],
    { war: { office: "war" }, hun_pm: { office: "hun_pm" } },
    all(crisis, chain(1, 3)),
    [v("counted", flag("f_auh_leave_counted")), base],
    {
      fallback: "leave_alone",
      options: [
        opt(
          "leave_alone",
          ["war:-1"],
          [pt(war, -1), setFlag("f_auh_leave_kept")],
        ),
        opt(
          "recall_now",
          ["army:+1", "hungary:-1", "temp:+1"],
          [army(1), hungary(-1), temp(1), setFlag("f_auh_leave_recalled")],
        ),
        opt(
          "after_harvest",
          ["hun_pm:+1", "delay:3"],
          [pt(pm, 1), delay(3), setFlag("f_auh_leave_ends_quietly")],
          memory("k_krob_harvest"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_note_draft",
    "crisis",
    9,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" }, hun_pm: { office: "hun_pm" } },
    all(crisis, chain(2, 3)),
    [
      v("plot", {
        kind: "world",
        of: { is: "known", id: "srb_officers_plot" },
      }),
      v("pushed", memory("k_tsch_push")),
      v("signed", flag("f_auh_sign_hungary")),
      v("bypassed", flag("f_auh_tisza_bypassed")),
      base,
    ],
    {
      fallback: "hard",
      options: [
        opt("hard", ["temp:+1"], [temp(1), setFlag("f_auh_note_hard")]),
        opt(
          "brutal",
          ["temp:+3", "army:+1", "gbr:-1", "hungary:-1"],
          [
            temp(3),
            army(1),
            trust("GBR", -1),
            hungary(-1),
            setFlag("f_auh_note_brutal"),
          ],
        ),
        opt(
          "acceptable",
          ["temp:-2", "army:-1", "deu:-1", "hungary:+1"],
          [
            temp(-2),
            army(-1),
            trust("DEU", -1),
            hungary(1),
            setFlag("f_auh_note_soft"),
          ],
          memory("k_tisza_terms"),
        ),
        opt(
          "drop_officers",
          ["temp:-1", "gbr:+1", "cos:-1"],
          [
            temp(-1),
            trust("GBR", 1),
            pt({ office: "chief_of_staff" }, -1),
            setFlag("f_auh_note_hard"),
            setFlag("f_auh_note_no_officers"),
          ],
          memory("k_ber_clause"),
        ),
        opt(
          "inquiry_only",
          ["temp:-3", "deu:-2", "army:-2"],
          [
            temp(-3),
            trust("DEU", -2),
            army(-2),
            setFlag("f_auh_note_soft"),
            setFlag("f_auh_note_inquiry"),
          ],
          memory("k_bil_inquiry"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_no_annex",
    "dispute",
    7,
    ["foreign"],
    { hun_pm: { office: "hun_pm" }, cos: { office: "chief_of_staff" } },
    all(july(), crisis, seen("auh_c_council_july")),
    [v("said", flag("f_auh_partition_said")), base],
    {
      fallback: "swear",
      options: [
        opt(
          "swear",
          ["hungary:+1", "cos:-1"],
          [hungary(1), pt(cos, -1), setFlag("f_auh_no_annex")],
        ),
        opt(
          "keep_open",
          ["hungary:-1", "army:+1"],
          [hungary(-1), army(1), setFlag("f_auh_annex_open")],
        ),
        opt(
          "give_to_bulgaria",
          ["hungary:+1", "bgr:+1", "rou:-1"],
          [
            hungary(1),
            trust("BGR", 1),
            trust("ROU", -1),
            setFlag("f_auh_no_annex"),
            setFlag("f_auh_bgr_word"),
          ],
          memory("k_hoyos_partition"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_note_timing",
    "proposal",
    7,
    ["foreign"],
    { fm: { office: "foreign" } },
    all(crisis, chain(2, 2)),
    [v("pushed", memory("k_tsch_push")), base],
    {
      fallback: "after_visit",
      options: [
        opt(
          "after_visit",
          ["delay:3"],
          [delay(3), setFlag("f_auh_note_after_visit")],
        ),
        opt(
          "send_now",
          ["temp:+1", "deu:+1", "fra:-1"],
          [
            temp(1),
            trust("DEU", 1),
            trust("FRA", -1),
            setFlag("f_auh_note_during_visit"),
          ],
        ),
        opt(
          "one_more_week",
          ["delay:7", "deu:-1", "hun_pm:+1"],
          [delay(7), trust("DEU", -1), pt({ office: "hun_pm" }, 1), hold],
          any(memory("k_tisza_wait"), memory("k_tsch_push")),
        ),
      ],
    },
  ),
  scene(
    "auh_c_italy_art7",
    "proposal",
    6,
    ["foreign"],
    { fm: { office: "foreign" } },
    all(crisis, chain(2, 4)),
    [
      v("known", {
        kind: "world",
        of: { is: "known", id: "ita_fra_understanding" },
      }),
      v("rumour", hasSecret("ita_fra_understanding")),
      base,
    ],
    {
      fallback: "say_nothing",
      options: [
        opt("say_nothing", ["ita:-1"], [trust("ITA", -1)]),
        opt(
          "tell_rome",
          ["ita:+1", "temp:+1"],
          [trust("ITA", 1), temp(1), setFlag("f_auh_told_rome")],
          memory("k_ber_rome"),
        ),
        opt(
          "name_a_price",
          ["ita:+2", "cos:-1", "hungary:-1"],
          [
            trust("ITA", 2),
            pt({ office: "chief_of_staff" }, -1),
            hungary(-1),
            act({ do: "offer", tag: "ITA", value: 1 }),
            setFlag("f_auh_rome_price"),
          ],
          memory("k_ber_rome"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_note_out",
    "wire",
    8,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" } },
    all(july(), flag("w_ultimatum_out"), seen("auh_c_note_draft")),
    [
      v("brutal", flag("f_auh_note_brutal")),
      v("soft", flag("f_auh_note_soft")),
      base,
    ],
  ),
  scene(
    "auh_c_serb_reply",
    "crisis",
    9,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" }, cos: { office: "chief_of_staff" } },
    all(july(), crisis, flag("w_ultimatum_out"), seen("auh_c_note_draft")),
    [
      v("soft", flag("f_auh_note_soft")),
      v("brutal", flag("f_auh_note_brutal")),
      v("officers", flag("f_auh_note_no_officers")),
      base,
    ],
    {
      fallback: "break_off",
      options: [
        opt(
          "break_off",
          ["temp:+2", "army:+1"],
          [temp(2), army(1), setFlag("f_auh_broke_off")],
        ),
        opt(
          "ask_more",
          ["delay:3", "deu:-1", "cos:-1"],
          [delay(3), trust("DEU", -1), pt(cos, -1), hold],
        ),
        opt(
          "accept_reply",
          ["ends_crisis", "army:-2", "deu:-2", "cos:-1"],
          [
            army(-2),
            trust("DEU", -2),
            pt(cos, -1),
            setFlag("f_auh_reply_accepted"),
            act({ do: "close_chain", outcome: "compromise" }),
          ],
          memory("k_hoyos_halt"),
        ),
        opt(
          "halt_at_belgrade",
          ["temp:-1", "army:-1", "gbr:+1"],
          [
            temp(-1),
            army(-1),
            trust("GBR", 1),
            setFlag("f_auh_broke_off"),
            setFlag("f_auh_halt_belgrade"),
          ],
          memory("k_bol_halt"),
        ),
      ],
    },
  ),
  // One clause more buys three days, and then the same two papers come back:
  // without this card the crisis closes with nobody having said so.
  scene(
    "auh_c_serb_second",
    "crisis",
    9,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" }, cos: { office: "chief_of_staff" } },
    all(
      july(),
      crisis,
      chose("auh_c_serb_reply", "ask_more"),
      not(flag("f_auh_broke_off")),
    ),
    [base],
    {
      fallback: "break_now",
      options: [
        opt(
          "break_now",
          ["temp:+2", "army:+1"],
          [temp(2), army(1), setFlag("f_auh_broke_off")],
        ),
        opt(
          "take_it",
          ["ends_crisis", "army:-2", "deu:-1"],
          [
            army(-2),
            trust("DEU", -1),
            setFlag("f_auh_reply_accepted"),
            act({ do: "close_chain", outcome: "compromise" }),
          ],
        ),
      ],
    },
  ),
  // July's papers come once. A later spark has its own: Vienna can still say no,
  // and pay for it, or a careful seat has nothing to keep the peace with.
  scene(
    "auh_c_spark_answer",
    "crisis",
    9,
    ["foreign", "tension_down"],
    { fm: { office: "foreign" }, cos: { office: "chief_of_staff" } },
    { kind: "world", of: { is: "chain", min: 3, max: 4, short: true } },
    [
      v("balkan", crisis),
      v("straits", { kind: "crisis", topic: "straits" }),
      base,
    ],
    {
      stage: ["crisis", "y1914", "war"],
      once: false,
      cooldown: 3,
      fallback: "stand",
      options: [
        opt("stand", ["temp:+1", "army:+1"], [temp(1), army(1)]),
        opt(
          "give_way",
          ["ends_crisis", "army:-1", "deu:-1"],
          [
            army(-1),
            trust("DEU", -1),
            act({ do: "close_chain", outcome: "compromise" }),
          ],
        ),
      ],
    },
  ),
  scene(
    "auh_c_grey_conference",
    "proposal",
    6,
    ["foreign", "tension_down"],
    { fm: { office: "foreign" } },
    all(july(), crisis, seen("auh_c_serb_reply")),
    [v("halt", flag("f_auh_halt_belgrade")), base],
    {
      fallback: "refuse",
      options: [
        opt("refuse", ["gbr:-1", "temp:+1"], [trust("GBR", -1), temp(1)]),
        opt(
          "accept",
          ["temp:-2", "gbr:+2", "deu:-1", "army:-1"],
          [
            temp(-2),
            trust("GBR", 2),
            trust("DEU", -1),
            army(-1),
            setFlag("f_auh_conference"),
          ],
          memory("k_ber_brake"),
        ),
        opt(
          "pass_to_berlin",
          ["delay:2"],
          [delay(2), setFlag("f_auh_passed_grey")],
        ),
      ],
    },
  ),
  scene(
    "auh_c_mob_plan",
    "crisis",
    8,
    ["war", "tension_up"],
    { cos: { office: "chief_of_staff" }, war: { office: "war" } },
    all(crisis, chain(3), { kind: "temp", min: 5 }),
    [
      v("russia", flag("w_rus_partial")),
      v("muddle", hasSecret("auh_rail_muddle")),
      base,
    ],
    {
      fallback: "plan_b",
      options: [
        opt(
          "plan_b",
          ["temp:+1"],
          [
            temp(1),
            act({ do: "mobilize", tag: "AUH", level: 1 }),
            setFlag("f_auh_plan_b"),
          ],
        ),
        opt(
          "plan_r",
          ["temp:+2", "rus:-1", "hungary:-1"],
          [
            temp(2),
            trust("RUS", -1),
            hungary(-1),
            act({ do: "mobilize", tag: "AUH", level: 2 }),
            setFlag("f_auh_plan_r"),
          ],
          memory("k_con_wait"),
        ),
        opt(
          "watch_russia",
          ["cos:-1"],
          [
            pt(cos, -1),
            act({ do: "mobilize", tag: "AUH", level: 1 }),
            setFlag("f_auh_plan_watch"),
          ],
          memory("k_krob_rail"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_war_serbia",
    "crisis",
    8,
    ["war", "tension_up"],
    { fm: { office: "foreign" }, chancellor: { office: "chancellor" } },
    all(july(), crisis, flag("f_auh_broke_off"), not(declared)),
    [
      v("halt", flag("f_auh_halt_belgrade")),
      v("no_council", not(flag("f_auh_sign_council"))),
      base,
    ],
    {
      fallback: "sign",
      options: [
        opt(
          "sign",
          ["temp:+2", "empty_slots"],
          [
            temp(2),
            setFlag("f_auh_declared"),
            maybe(not(flag("f_auh_sign_council")), council(-2)),
            maybe(not(flag("f_auh_sign_hungary")), hungary(-2)),
            maybe(not(flag("f_auh_sign_austria")), nations(-1)),
            maybe(not(flag("f_auh_sign_berlin")), trust("DEU", -1)),
          ],
        ),
        opt(
          "wait_for_army",
          ["delay:7", "deu:-1", "cos:+1"],
          [
            delay(7),
            trust("DEU", -1),
            pt({ office: "chief_of_staff" }, 1),
            hold,
          ],
          memory("k_con_wait"),
        ),
        opt(
          "call_delegations",
          ["delay:7", "nations:+1", "deu:-1"],
          [
            delay(7),
            nations(1),
            trust("DEU", -1),
            hold,
            setFlag("f_auh_sign_austria"),
          ],
          memory("k_stu_closed"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_berlin_brake",
    "proposal",
    7,
    ["foreign", "tension_down"],
    { fm: { office: "foreign" } },
    all(declared, not(atWar("RUS")), { kind: "chapter", max: 5 }),
    [v("halt", flag("f_auh_halt_belgrade")), base],
    {
      fallback: "ignore",
      options: [
        opt("ignore", ["temp:+1", "deu:-1"], [temp(1), trust("DEU", -1)]),
        opt(
          "stop_at_belgrade",
          ["temp:-2", "army:-1", "deu:+1"],
          [temp(-2), army(-1), trust("DEU", 1), setFlag("f_auh_halt_belgrade")],
          any(memory("k_ber_brake"), memory("k_tsch_push")),
        ),
      ],
    },
  ),
  scene(
    "auh_c_b_staffel",
    "dispute",
    8,
    ["war", "tension_up"],
    { cos: { office: "chief_of_staff" }, war: { office: "war" } },
    all(declared, any(flag("w_rus_general"), flag("w_rus_partial")), {
      kind: "chapter",
      max: 5,
    }),
    [
      v("muddle", hasSecret("auh_rail_muddle")),
      v("plan_r", flag("f_auh_plan_r")),
      v("watched", flag("f_auh_plan_watch")),
      base,
    ],
    {
      fallback: "south_first",
      options: [
        opt(
          "south_first",
          ["balkan:+1", "east:-1"],
          [force("balkan", 1), force("east", -1), setFlag("f_auh_b_south")],
        ),
        opt(
          "north_now",
          ["east:+1", "balkan:-1", "cos:-1"],
          [
            force("east", 1),
            force("balkan", -1),
            pt(cos, -1),
            setFlag("f_auh_b_north"),
          ],
          any(memory("k_krob_rail"), memory("k_con_moltke")),
        ),
        opt(
          "stop_at_border",
          ["balkan:-1", "war:+1", "deu:-1"],
          [
            force("balkan", -1),
            pt(war, 1),
            trust("DEU", -1),
            setFlag("f_auh_b_held"),
          ],
        ),
      ],
    },
  ),
  scene(
    "auh_c_war_russia",
    "crisis",
    8,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" } },
    all(declared, not(atWar("RUS")), flag("w_rus_general")),
    [v("no_berlin", not(flag("f_auh_sign_berlin"))), base],
    {
      fallback: "sign",
      options: [
        opt(
          "sign",
          ["war_russia", "deu:+1"],
          [trust("DEU", 1), act({ do: "declare", tag: "RUS" })],
        ),
        opt(
          "let_them_begin",
          ["deu:-1", "gbr:+1"],
          [trust("DEU", -1), trust("GBR", 1), setFlag("f_auh_russia_first")],
          memory("k_ber_brake"),
        ),
      ],
    },
  ),
  scene(
    "auh_c_decree",
    "proposal",
    7,
    ["home"],
    { chancellor: { office: "chancellor" }, war: { office: "war" } },
    // Signed in the crisis or the war's first weeks, whenever they come.
    all(
      any(declared, inWar),
      any(
        { kind: "world", of: { is: "chain" } },
        { kind: "world", of: { is: "war_months", own: true, max: 2 } },
      ),
    ),
    [v("delegations", flag("f_auh_sign_austria")), base],
    {
      fallback: "all_at_once",
      options: [
        opt(
          "all_at_once",
          ["order:+1", "nations:-1"],
          [order(1), nations(-1), setFlag("f_auh_decree_full")],
        ),
        opt(
          "narrow",
          ["war:-1", "nations:+1"],
          [pt(war, -1), nations(1), setFlag("f_auh_decree_narrow")],
          memory("k_stu_decree"),
        ),
        opt(
          "with_reichsrat",
          ["chancellor:-1", "nations:+1"],
          [
            pt(chan, -1),
            nations(1),
            setFlag("f_auh_sign_austria"),
            setFlag("f_auh_decree_reichsrat"),
          ],
          memory("k_adl_pulse"),
        ),
      ],
    },
  ),
];

/** The heir is dead and July's chain has just begun. */
const funeralTime = any(
  all(opening("sarajevo"), july(0, 1)),
  all(opening("sarajevo_delayed"), crisis, july(2, 4)),
);
const fmIs = (person: string): GwCond => ({
  kind: "holder",
  office: "foreign",
  person,
});

const BERCHTOLD: readonly GwScene[] = [
  talk("auh_t_ber_funeral", "auh_berchtold", all(funeralTime), {
    open: node(
      moods(p, "weary", "cunning"),
      r("ask", "warm", "ask", [], [], "kings", {
        gain: [K("k_ber_funeral")],
        miss: "rules",
      }),
      r("press", "cold", "push", ["trust:-1"], [pt(p, -1)], "kings", {
        gain: [K("k_ber_funeral")],
        miss: "rules",
      }),
      r(
        "deal",
        "frank",
        "deal",
        ["montenuovo:-1"],
        [K("k_ber_funeral"), pt(byName("auh_montenuovo"), -1)],
        "kings",
      ),
      close("leave", "cold"),
    ),
    kings: plain(
      r("berlin", "frank", "ask", [], [], "wilhelm"),
      r("enough", "warm", "leave", ["trust:+1"], [pt(p, 1)], null),
    ),
    wilhelm: node(
      [v("anxious", moody(p, "anxious")), base],
      close("end", "cold"),
      close("end2", "frank"),
    ),
    rules: plain(
      r("again", "frank", "ask", [], [], "kings", {
        gain: [K("k_ber_funeral")],
        miss: null,
      }),
      r("end", "cold", "leave", [], [reason("auh_t_ber_funeral_r1")], null),
    ),
  }),
  talk(
    "auh_t_ber_clause",
    "auh_berchtold",
    all(crisis, { kind: "world", of: { is: "chain", short: false, max: 5 } }),
    {
      open: node(
        moods(p, "anxious", "cunning"),
        r("ask", "frank", "ask", [], [], "clause", {
          gain: [K("k_ber_clause")],
          miss: "drafters",
        }),
        r("press", "threat", "push", ["trust:-1"], [pt(p, -1)], "clause", {
          gain: [K("k_ber_clause")],
          miss: "drafters",
        }),
        r(
          "deal",
          "warm",
          "deal",
          [],
          [
            K("k_ber_clause"),
            promise(p, "ber_note_cover", 4, {
              keep: all(chose("auh_c_note_draft"), inOffice(role("who"))),
            }),
          ],
          "clause",
        ),
        close("leave", "cold"),
      ),
      clause: plain(
        r("why", "frank", "ask", [], [], "officers"),
        r("thanks", "warm", "leave", ["trust:+1"], [pt(p, 1)], null),
      ),
      officers: node(
        [v("weary", moody(p, "weary")), base],
        close("end", "frank"),
        close("end2", "cold"),
      ),
      drafters: plain(
        r("who", "cold", "ask", [], [], "clause", {
          gain: [K("k_ber_clause")],
          miss: null,
        }),
        r("end", "cold", "leave", [], [reason("auh_t_ber_clause_r1")], null),
      ),
    },
    C,
  ),
  talk(
    "auh_t_ber_rome",
    "auh_berchtold",
    { kind: "chapter", max: 5 },
    {
      open: node(
        moods(p, "weary"),
        r("ask", "warm", "ask", [], [], "article", {
          gain: [K("k_ber_rome")],
          miss: "merey",
        }),
        r("flat", "flatter", "ask", [], [], "article", {
          gain: [K("k_ber_rome")],
          miss: "merey",
        }),
        r(
          "deal",
          "frank",
          "deal",
          ["cos:-1"],
          [K("k_ber_rome"), pt({ office: "chief_of_staff" }, -1)],
          "article",
        ),
        close("leave", "cold"),
      ),
      article: plain(
        r(
          "truth",
          "frank",
          "ask",
          [],
          [reveal("ita_fra_understanding")],
          "paris",
        ),
        r("end", "warm", "leave", [], [], null),
      ),
      paris: node(
        [
          v("known", all(hasSecret("ita_fra_understanding"), candid(p))),
          v("hedged", hasSecret("ita_fra_understanding")),
          base,
        ],
        close("end", "frank"),
        close("end2", "cold"),
      ),
      merey: plain(
        r("again", "frank", "ask", [], [], "article", {
          gain: [K("k_ber_rome")],
          miss: null,
        }),
        r("end", "cold", "leave", [], [reason("auh_t_ber_rome_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_ber_brake",
    "auh_berchtold",
    all(
      crisis,
      { kind: "temp", min: 5 },
      { kind: "world", of: { is: "chain", short: false, max: 5 } },
    ),
    {
      open: node(
        moods(p, "anxious", "weary"),
        r("ask", "frank", "ask", [], [], "can", {
          gain: [K("k_ber_brake")],
          miss: "cannot",
        }),
        r("warm", "warm", "ask", [], [], "can", {
          gain: [K("k_ber_brake")],
          miss: "cannot",
        }),
        r(
          "deal",
          "frank",
          "deal",
          [],
          [
            K("k_ber_brake"),
            promise(p, "ber_release", 8, {
              keep: not(inOffice(role("who"))),
            }),
          ],
          "can",
        ),
        r("threat", "threat", "push", ["trust:-1"], [pt(p, -1)], "cannot", {
          reacts: [
            {
              when: moody(p, "anxious"),
              next: "can",
              effects: [K("k_ber_brake"), reason("auh_t_ber_brake_r2")],
            },
          ],
        }),
        close("leave", "cold"),
      ),
      can: plain(
        r("how", "frank", "ask", [], [], "how"),
        r("end", "warm", "leave", ["trust:+1"], [pt(p, 1)], null),
      ),
      how: plain(close("end", "frank"), close("end2", "cold")),
      cannot: plain(
        r("end", "cold", "leave", [], [reason("auh_t_ber_brake_r1")], null),
      ),
    },
    C,
  ),
  talk(
    "auh_t_ber_trentino",
    "auh_berchtold",
    all(
      { kind: "world", of: { is: "war_months", own: true, max: 11 } },
      inWar,
      not({ kind: "world", of: { is: "entered", tag: "ITA" } }),
      inOffice(p),
    ),
    {
      open: node(
        moods(p, "weary", "cunning"),
        r("ask", "frank", "ask", [], [], "price", {
          gain: [K("k_ber_trentino")],
          miss: "who_stops",
        }),
        r("press", "cold", "push", [], [], "price", {
          gain: [K("k_ber_trentino")],
          miss: "who_stops",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["hun_pm:-1", "hungary:-1"],
          [K("k_ber_trentino"), pt({ office: "hun_pm" }, -1), hungary(-1)],
          "price",
        ),
        r(
          "release",
          "warm",
          "deal",
          ["leaves"],
          [keepPromise(p, "ber_release"), act({ do: "leave", who: p })],
          "going",
          {
            when: {
              kind: "promise",
              who: p,
              key: "ber_release",
              kept: false,
              broken: false,
            },
          },
        ),
        close("leave", "cold"),
      ),
      price: plain(
        r("tisza", "frank", "ask", [], [], "who_stops"),
        r("end", "warm", "leave", ["trust:+1"], [pt(p, 1)], null),
      ),
      who_stops: plain(close("end", "frank"), close("end2", "cold")),
      going: plain(close("end", "warm")),
    },
  ),
  talk(
    "auh_t_ber_after",
    "auh_berchtold",
    all(
      { kind: "world", of: { is: "war_months", min: 5, max: 41 } },
      not(fmIs("auh_berchtold")),
    ),
    {
      open: node(
        moods(p, "weary", "cunning"),
        r("ask", "warm", "ask", [], [], "heir", { miss: "polite" }),
        r("flat", "flatter", "ask", [], [], "heir", { miss: "polite" }),
        r(
          "deal",
          "frank",
          "deal",
          ["court:-1"],
          [K("k_ber_steward"), pt({ office: "court" }, -1)],
          "heir",
        ),
        close("leave", "cold"),
      ),
      heir: node(
        [
          v("burian", fmIs("auh_burian")),
          v("czernin", fmIs("auh_czernin")),
          base,
        ],
        r("conrad", "frank", "ask", [], [], "conrad"),
        r("end", "warm", "leave", ["trust:+1"], [pt(p, 1)], null),
      ),
      conrad: node(
        [
          v("low", {
            kind: "competence",
            who: byName("auh_conrad"),
            field: "war",
            max: 1,
          }),
          v("high", {
            kind: "competence",
            who: byName("auh_conrad"),
            field: "war",
            min: 3,
          }),
          base,
        ],
        close("end", "frank"),
        close("end2", "cold"),
      ),
      polite: plain(
        r("end", "cold", "leave", [], [reason("auh_t_ber_after_r1")], null),
      ),
    },
  ),
];

const HOYOS: readonly GwScene[] = [
  talk(
    "auh_t_hoyos_term",
    "auh_hoyos",
    all(crisis, { kind: "world", of: { is: "chain", short: false, max: 5 } }),
    {
      open: node(
        moods(p, "arrogant"),
        r("ask", "cold", "ask", [], [], "term", {
          gain: [K("k_hoyos_term")],
          miss: "smile",
        }),
        r("flat", "flatter", "ask", [], [], "term", {
          gain: [K("k_hoyos_term")],
          miss: "smile",
        }),
        r(
          "deal",
          "frank",
          "deal",
          [],
          [
            K("k_hoyos_term"),
            promise(p, "hoyos_credit", 2, {
              keep: chose("auh_c_hoyos_mission", "ask_term"),
            }),
          ],
          "term",
        ),
        close("leave", "cold"),
      ),
      term: plain(
        r("risk", "frank", "ask", [], [], "risk"),
        r("end", "cold", "leave", [], [], null),
      ),
      risk: node(
        [v("cunning", moody(p, "cunning")), base],
        close("end", "frank"),
        close("end2", "cold"),
      ),
      smile: plain(
        r("again", "threat", "push", ["trust:-1"], [pt(p, -1)], "term", {
          gain: [K("k_hoyos_term")],
          miss: null,
        }),
        r("end", "cold", "leave", [], [reason("auh_t_hoyos_term_r1")], null),
      ),
    },
    C,
  ),
  talk(
    "auh_t_hoyos_partition",
    "auh_hoyos",
    all(crisis, { kind: "world", of: { is: "chain", short: false, max: 5 } }),
    {
      open: node(
        [
          v("back", seen("auh_c_berlin_answer")),
          v("arrogant", moody(p, "arrogant")),
          base,
        ],
        r("ask", "cold", "ask", [], [], "map", {
          gain: [K("k_hoyos_partition")],
          miss: "denied",
        }),
        r("warm", "warm", "ask", [], [], "map", {
          gain: [K("k_hoyos_partition")],
          miss: "denied",
        }),
        r(
          "deal",
          "frank",
          "deal",
          ["fm:-1"],
          [
            K("k_hoyos_partition"),
            pt({ office: "foreign" }, -1),
            setFlag("f_auh_partition_hushed"),
          ],
          "map",
        ),
        close("leave", "cold"),
      ),
      map: plain(
        r("berlin", "frank", "ask", [], [], "promised"),
        r("end", "cold", "leave", [], [], null),
      ),
      promised: node(
        [
          v("full", flag("f_auh_memo_full")),
          v("cold", not(flag("f_auh_sign_berlin"))),
          base,
        ],
        close("end", "frank"),
        close("end2", "cold"),
      ),
      denied: plain(
        r(
          "end",
          "cold",
          "leave",
          [],
          [reason("auh_t_hoyos_partition_r1")],
          null,
        ),
      ),
    },
    C,
  ),
  talk(
    "auh_t_hoyos_young",
    "auh_hoyos",
    { kind: "chapter", max: 5 },
    {
      open: node(
        moods(p, "cunning"),
        r("ask", "flatter", "ask", [], [], "names", {
          gain: [K("k_hoyos_young")],
          miss: "modest",
        }),
        r("cold", "cold", "ask", [], [], "names", {
          gain: [K("k_hoyos_young")],
          miss: "modest",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["fm:-1"],
          [K("k_hoyos_young"), pt({ office: "foreign" }, -1)],
          "names",
        ),
        close("leave", "cold"),
      ),
      names: plain(
        r("berchtold", "frank", "ask", [], [], "minister"),
        r("end", "cold", "leave", [], [], null),
      ),
      minister: node(
        [
          v("real", all(candid(p), fmIs("auh_berchtold"))),
          v("other", not(fmIs("auh_berchtold"))),
          base,
        ],
        close("end", "frank"),
        close("end2", "cold"),
      ),
      modest: plain(
        r("end", "cold", "leave", [], [reason("auh_t_hoyos_young_r1")], null),
      ),
    },
    C,
  ),
  talk(
    "auh_t_hoyos_halt",
    "auh_hoyos",
    all(july(), crisis, flag("w_ultimatum_out")),
    {
      open: node(
        [
          v("soft", flag("f_auh_note_soft")),
          v("brutal", flag("f_auh_note_brutal")),
          base,
        ],
        r("ask", "frank", "ask", [], [], "read", {
          gain: [K("k_hoyos_halt")],
          miss: "paper",
        }),
        r("press", "threat", "push", ["trust:-1"], [pt(p, -1)], "read", {
          gain: [K("k_hoyos_halt")],
          miss: "paper",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["trust:+1", "fm:-1"],
          [K("k_hoyos_halt"), pt(p, 1), pt({ office: "foreign" }, -1)],
          "read",
        ),
        close("leave", "cold"),
      ),
      read: plain(
        r("would", "frank", "ask", [], [], "would"),
        r("end", "cold", "leave", [], [], null),
      ),
      would: node(
        [
          v("takes", all(flag("f_auh_note_soft"), candid(p))),
          v("never", flag("f_auh_note_brutal")),
          base,
        ],
        close("end", "frank"),
        close("end2", "cold"),
      ),
      paper: plain(
        r("end", "cold", "leave", [], [reason("auh_t_hoyos_halt_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_hoyos_guilt",
    "auh_hoyos",
    all({ kind: "world", of: { is: "war_months", own: true, max: 17 } }, inWar),
    {
      open: node(
        moods(p, "arrogant", "cunning"),
        r("ask", "warm", "ask", [], [], "bag", { miss: "stiff" }),
        r("cold", "cold", "ask", [], [], "bag", { miss: "stiff" }),
        r(
          "deal",
          "frank",
          "deal",
          [],
          [
            promise(p, "hoyos_post", 12, {
              keep: any(
                memory("k_hoyos_zoll_heard"),
                chose("auh_k_new_men", "new_court"),
              ),
            }),
          ],
          "post",
        ),
        close("leave", "cold"),
      ),
      bag: plain(
        r(
          "deal",
          "frank",
          "deal",
          [],
          [
            promise(p, "hoyos_post", 12, {
              keep: any(
                memory("k_hoyos_zoll_heard"),
                chose("auh_k_new_men", "new_court"),
              ),
            }),
          ],
          "post",
        ),
        r("absolve", "warm", "leave", ["trust:+1"], [pt(p, 1)], null),
        close("end", "cold"),
      ),
      post: plain(close("end", "warm")),
      stiff: plain(
        r("end", "cold", "leave", [], [reason("auh_t_hoyos_guilt_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_hoyos_zoll",
    "auh_hoyos",
    all(
      { kind: "world", of: { is: "war_months", own: true, min: 11, max: 35 } },
      inWar,
    ),
    {
      open: node(
        moods(p, "arrogant"),
        r("ask", "frank", "ask", [], [], "dinner", {
          gain: [K("k_hoyos_zoll")],
          miss: "tables",
        }),
        r("flat", "flatter", "ask", [], [], "dinner", {
          gain: [K("k_hoyos_zoll")],
          miss: "tables",
        }),
        r(
          "deal",
          "cold",
          "deal",
          ["deu:-1"],
          [K("k_hoyos_zoll"), trust("DEU", -1)],
          "dinner",
        ),
        close("leave", "cold"),
      ),
      dinner: plain(
        r("how", "frank", "ask", [], [], "slow"),
        r("end", "cold", "leave", [], [], null),
      ),
      slow: plain(
        r(
          "send",
          "warm",
          "leave",
          [],
          [K("k_hoyos_zoll_heard"), keepPromise(p, "hoyos_post")],
          null,
        ),
        close("end", "cold"),
      ),
      tables: plain(
        r("end", "cold", "leave", [], [reason("auh_t_hoyos_zoll_r1")], null),
      ),
    },
  ),
];

const BILINSKI: readonly GwScene[] = [
  talk("auh_t_bil_bosnia", "auh_bilinski", july(), {
    open: node(
      moods(p, "cunning", "weary"),
      r("ask", "warm", "ask", [], [], "heard", {
        gain: [K("k_bil_bosnia")],
        miss: "nothing",
      }),
      r("cold", "cold", "ask", [], [], "heard", {
        gain: [K("k_bil_bosnia")],
        miss: "nothing",
      }),
      r(
        "deal",
        "frank",
        "deal",
        ["potiorek:-1"],
        [K("k_bil_bosnia"), pt(byName("auh_potiorek"), -1)],
        "heard",
      ),
      close("leave", "cold"),
    ),
    heard: plain(
      r(
        "officers",
        "frank",
        "ask",
        [],
        [reveal("srb_officers_plot")],
        "rumour",
      ),
      r("end", "warm", "leave", ["trust:+1"], [pt(p, 1)], null),
    ),
    rumour: node(
      [
        v("true", all(hasSecret("srb_officers_plot"), candid(p))),
        v("half", hasSecret("srb_officers_plot")),
        base,
      ],
      close("end", "frank"),
      close("end2", "cold"),
    ),
    nothing: plain(
      r("again", "frank", "ask", [], [], "heard", {
        gain: [K("k_bil_bosnia")],
        miss: null,
      }),
      r("end", "cold", "leave", [], [reason("auh_t_bil_bosnia_r1")], null),
    ),
  }),
  talk(
    "auh_t_bil_inquiry",
    "auh_bilinski",
    all(crisis, { kind: "world", of: { is: "chain", short: false, max: 5 } }),
    {
      open: node(
        moods(p, "cunning"),
        r("ask", "frank", "ask", [], [], "first", {
          gain: [K("k_bil_inquiry")],
          miss: "banker",
        }),
        r("cold", "cold", "push", [], [], "first", {
          gain: [K("k_bil_inquiry")],
          miss: "banker",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["cos:-1"],
          [K("k_bil_inquiry"), pt({ office: "chief_of_staff" }, -1)],
          "first",
        ),
        close("leave", "cold"),
      ),
      first: plain(
        r("cost", "frank", "ask", [], [], "cost"),
        r("end", "warm", "leave", [], [], null),
      ),
      cost: node(
        [v("weary", moody(p, "weary")), base],
        close("end", "frank"),
        close("end2", "cold"),
      ),
      banker: plain(
        r("end", "cold", "leave", [], [reason("auh_t_bil_inquiry_r1")], null),
      ),
    },
    C,
  ),
  // The bill for a war: while a crisis runs, or in the war's first months.
  talk(
    "auh_t_bil_bill",
    "auh_bilinski",
    any(
      { kind: "world", of: { is: "chain" } },
      { kind: "world", of: { is: "war_months", own: true, max: 5 } },
    ),
    {
      open: node(
        [v("war", inWar), v("cunning", moody(p, "cunning")), base],
        r("ask", "cold", "ask", [], [], "bill", {
          gain: [K("k_bil_bill")],
          miss: "joke",
        }),
        r("warm", "warm", "ask", [], [], "bill", {
          gain: [K("k_bil_bill")],
          miss: "joke",
        }),
        r(
          "deal",
          "frank",
          "deal",
          ["hun_pm:-1"],
          [K("k_bil_bill"), pt({ office: "hun_pm" }, -1)],
          "bill",
        ),
        close("leave", "cold"),
      ),
      bill: plain(
        r("who", "frank", "ask", [], [], "who_pays"),
        r("end", "cold", "leave", [], [], null),
      ),
      who_pays: plain(close("end", "frank"), close("end2", "cold")),
      joke: plain(
        r("again", "frank", "ask", [], [], "bill", {
          gain: [K("k_bil_bill")],
          miss: null,
        }),
        r("end", "cold", "leave", [], [reason("auh_t_bil_bill_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_bil_potiorek",
    "auh_bilinski",
    all(
      { kind: "world", of: { is: "war_months", own: true, max: 4 } },
      atWar("SRB"),
    ),
    {
      open: node(
        moods(p, "cunning", "weary"),
        r("ask", "frank", "ask", [], [], "man", {
          gain: [K("k_bil_potiorek")],
          miss: "careful",
        }),
        r("flat", "flatter", "ask", [], [], "man", {
          gain: [K("k_bil_potiorek")],
          miss: "careful",
        }),
        r(
          "deal",
          "cold",
          "deal",
          ["potiorek:-1", "cos:+1"],
          [
            K("k_bil_potiorek"),
            pt(byName("auh_potiorek"), -1),
            pt({ office: "chief_of_staff" }, 1),
          ],
          "man",
        ),
        close("leave", "cold"),
      ),
      man: plain(
        r("june", "frank", "ask", [], [], "june"),
        r("end", "cold", "leave", [], [], null),
      ),
      june: plain(close("end", "frank"), close("end2", "cold")),
      careful: plain(
        r("end", "cold", "leave", [], [reason("auh_t_bil_potiorek_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_bil_poland",
    "auh_bilinski",
    all(
      { kind: "world", of: { is: "war_months", own: true, max: 11 } },
      atWar("RUS"),
    ),
    {
      open: node(
        [v("pushed", eastPushed), v("weary", moody(p, "weary")), base],
        r("ask", "warm", "ask", [], [], "ask_poles", {
          gain: [K("k_bil_poland")],
          miss: "later",
        }),
        r("cold", "cold", "ask", [], [], "ask_poles", {
          gain: [K("k_bil_poland")],
          miss: "later",
        }),
        r(
          "deal",
          "frank",
          "deal",
          ["hungary:-1"],
          [
            K("k_bil_poland"),
            hungary(-1),
            promise(p, "bil_galicia", 12, {
              keep: any(
                chose("auh_h_poland_crown", "claim_for_house"),
                chose("auh_h_poland_crown", "trade_with_berlin"),
              ),
              back: "auh_v_bil_promise",
            }),
          ],
          "ask_poles",
        ),
        close("leave", "cold"),
      ),
      ask_poles: plain(
        r("legion", "frank", "ask", [], [], "legion"),
        r("end", "warm", "leave", ["trust:+1"], [pt(p, 1)], null),
      ),
      legion: plain(close("end", "frank"), close("end2", "cold")),
      later: plain(
        r("end", "cold", "leave", [], [reason("auh_t_bil_poland_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_bil_crown",
    "auh_bilinski",
    all(
      { kind: "world", of: { is: "war_months", min: 11, max: 29 } },
      {
        kind: "world",
        of: { is: "front", theatre: "east", from: "vistula", to: "kiev" },
      },
    ),
    {
      open: node(
        [
          v(
            "out",
            not({ kind: "holder", office: "finance", person: "auh_bilinski" }),
          ),
          v("cunning", moody(p, "cunning")),
          base,
        ],
        r("ask", "frank", "ask", [], [], "weight", {
          gain: [K("k_bil_crown")],
          miss: "polish",
        }),
        r("warm", "warm", "ask", [], [], "weight", {
          gain: [K("k_bil_crown")],
          miss: "polish",
        }),
        r(
          "deal",
          "cold",
          "deal",
          ["nations:+1", "hungary:-1"],
          [K("k_bil_crown"), nations(1), hungary(-1)],
          "weight",
        ),
        close("leave", "cold"),
      ),
      weight: plain(
        r("tisza", "frank", "ask", [], [], "third"),
        r("end", "cold", "leave", [], [], null),
      ),
      third: plain(close("end", "frank"), close("end2", "cold")),
      polish: plain(
        r("end", "cold", "leave", [], [reason("auh_t_bil_crown_r1")], null),
      ),
    },
  ),
];

const STURGKH: readonly GwScene[] = [
  talk(
    "auh_t_stu_closed",
    "auh_sturgkh",
    { kind: "chapter", max: 5 },
    {
      open: node(
        moods(p, "cold"),
        r("ask", "frank", "ask", [], [], "why_shut", {
          gain: [K("k_stu_closed")],
          miss: "for_now",
        }),
        r("cold", "cold", "ask", [], [], "why_shut", {
          gain: [K("k_stu_closed")],
          miss: "for_now",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["chancellor:+1", "nations:-1"],
          [K("k_stu_closed"), pt(p, 1), nations(-1)],
          "why_shut",
        ),
        close("leave", "cold"),
      ),
      why_shut: plain(
        r("delegations", "frank", "ask", [], [], "delegations"),
        r("end", "cold", "leave", [], [], null),
      ),
      delegations: plain(close("end", "frank"), close("end2", "cold")),
      for_now: plain(
        r("again", "threat", "push", ["trust:-1"], [pt(p, -1)], "why_shut", {
          gain: [K("k_stu_closed")],
          miss: null,
        }),
        r("end", "cold", "leave", [], [reason("auh_t_stu_closed_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_stu_decree",
    "auh_sturgkh",
    all(any(crisis, inWar), { kind: "chapter", max: 5 }),
    {
      open: node(
        moods(p, "stubborn"),
        r("ask", "cold", "ask", [], [], "paragraph", {
          gain: [K("k_stu_decree")],
          miss: "article",
        }),
        r("frank", "frank", "ask", [], [], "paragraph", {
          gain: [K("k_stu_decree")],
          miss: "article",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["war:-1"],
          [K("k_stu_decree"), pt({ office: "war" }, -1)],
          "paragraph",
        ),
        close("leave", "cold"),
      ),
      paragraph: plain(
        r("army", "frank", "ask", [], [], "army"),
        r("end", "cold", "leave", [], [], null),
      ),
      army: plain(close("end", "frank"), close("end2", "cold")),
      article: plain(
        r("end", "cold", "leave", [], [reason("auh_t_stu_decree_r1")], null),
      ),
    },
    C,
  ),
  talk(
    "auh_t_stu_bohemia",
    "auh_sturgkh",
    all(
      { kind: "world", of: { is: "war_months", own: true, max: 11 } },
      inWar,
      inOffice(p),
    ),
    {
      open: node(
        moods(p, "cold", "stubborn"),
        r("ask", "frank", "ask", [], [], "prague", {
          gain: [K("k_stu_bohemia")],
          miss: "ministry",
        }),
        r("cold", "cold", "ask", [], [], "prague", {
          gain: [K("k_stu_bohemia")],
          miss: "ministry",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["cos:-1"],
          [K("k_stu_bohemia"), pt({ office: "chief_of_staff" }, -1)],
          "prague",
        ),
        close("leave", "cold"),
      ),
      prague: plain(
        r("thun", "frank", "ask", [], [], "governor"),
        r("end", "cold", "leave", [], [], null),
      ),
      governor: plain(close("end", "frank"), close("end2", "cold")),
      ministry: plain(
        r("end", "cold", "leave", [], [reason("auh_t_stu_bohemia_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_stu_grain",
    "auh_sturgkh",
    all(
      { kind: "world", of: { is: "war_months", own: true, min: 5, max: 17 } },
      inWar,
      inOffice(p),
      {
        kind: "gauge",
        gauge: "bread",
        max: 2,
      },
    ),
    {
      open: node(
        moods(p, "cold"),
        r("ask", "frank", "ask", [], [], "bread", {
          gain: [K("k_stu_grain")],
          miss: "tables",
        }),
        r("press", "cold", "push", [], [], "bread", {
          gain: [K("k_stu_grain")],
          miss: "tables",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["hun_pm:-1", "hungary:-1"],
          [K("k_stu_grain"), pt({ office: "hun_pm" }, -1), hungary(-1)],
          "bread",
        ),
        close("leave", "cold"),
      ),
      bread: plain(
        r("border", "frank", "ask", [], [], "border"),
        r("end", "cold", "leave", [], [], null),
      ),
      border: plain(close("end", "frank"), close("end2", "cold")),
      tables: plain(
        r("end", "cold", "leave", [], [reason("auh_t_stu_grain_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_stu_open",
    "auh_sturgkh",
    all(
      { kind: "world", of: { is: "war_months", own: true, min: 11, max: 29 } },
      inOffice(p),
    ),
    {
      open: node(
        moods(p, "stubborn", "cold"),
        r("ask", "frank", "ask", [], [], "when", {
          gain: [K("k_stu_open")],
          miss: "same",
        }),
        r("threat", "threat", "push", ["trust:-1"], [pt(p, -1)], "when", {
          gain: [K("k_stu_open")],
          miss: "same",
        }),
        r(
          "deal",
          "cold",
          "deal",
          ["chancellor:-1"],
          [
            K("k_stu_open"),
            pt(p, -1),
            promise(p, "stu_open", 12, {
              keep: chose("auh_h_reichsrat_call", "open_it"),
            }),
          ],
          "when",
        ),
        close("leave", "cold"),
      ),
      when: plain(
        r("speech", "frank", "ask", [], [], "speech"),
        r("end", "cold", "leave", [], [], null),
      ),
      speech: plain(close("end", "frank"), close("end2", "cold")),
      same: plain(
        r("end", "cold", "leave", [], [reason("auh_t_stu_open_r1")], null),
      ),
    },
  ),
  talk(
    "auh_t_stu_letters",
    "auh_sturgkh",
    all(
      { kind: "world", of: { is: "war_months", own: true, min: 17, max: 29 } },
      inOffice(p),
      {
        kind: "world",
        of: { is: "unrest", min: 0 },
      },
    ),
    {
      open: node(
        moods(p, "cold", "stubborn"),
        r("ask", "warm", "ask", [], [], "drawer", {
          gain: [K("k_stu_letters")],
          miss: "routine",
        }),
        r("frank", "frank", "ask", [], [], "drawer", {
          gain: [K("k_stu_letters")],
          miss: "routine",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["trust:+1"],
          [K("k_stu_letters"), pt(p, 1)],
          "guard",
        ),
        close("leave", "cold"),
      ),
      drawer: plain(
        r("who", "frank", "ask", [], [], "who"),
        r("guard", "warm", "ask", [], [], "guard"),
        close("end", "cold"),
      ),
      who: plain(close("end", "frank"), close("end2", "cold")),
      guard: plain(close("end", "warm")),
      routine: plain(
        r("end", "cold", "leave", [], [reason("auh_t_stu_letters_r1")], null),
      ),
    },
  ),
];

const VISITS: readonly GwScene[] = [
  visit(
    "auh_v_tsch_push",
    { person: "deu_tschirschky" },
    all(crisis, chain(1, 3)),
    6,
    ["foreign", "tension_up"],
    {
      open: node(
        [
          v("no_cheque", not(flag("f_auh_sign_berlin"))),
          v("arrogant", moody(p, "arrogant")),
          base,
        ],
        r("ask", "cold", "ask", [], [], "wants", {
          gain: [K("k_tsch_push")],
          miss: "lecture",
        }),
        r("thank", "flatter", "ask", [], [], "wants", {
          gain: [K("k_tsch_push")],
          miss: "lecture",
        }),
        r(
          "deal",
          "frank",
          "deal",
          ["deu:+1", "temp:+1"],
          [K("k_tsch_push"), trust("DEU", 1), temp(1)],
          "wants",
        ),
        r("door", "threat", "leave", ["deu:-1"], [trust("DEU", -1)], null),
      ),
      wants: plain(
        r("whose", "frank", "ask", [], [], "whose"),
        r("end", "cold", "leave", [], [], null),
      ),
      whose: node(
        [v("hard", { kind: "ai", tag: "DEU", of: ["hardline"] }), base],
        close("end", "frank"),
        close("end2", "cold"),
      ),
      lecture: plain(
        r("end", "cold", "leave", [], [reason("auh_v_tsch_push_r1")], null),
      ),
    },
    { stage: C },
  ),
  visit(
    "auh_v_ff_program",
    { person: "auh_ff" },
    // The heir lives and is not yet on the throne.
    all(ffAlive, not(flag("w_auh_ff_throne"))),
    6,
    ["people", "tension_up"],
    {
      open: node(
        [v("war", inWar), v("stubborn", moody(p, "stubborn")), base],
        r("ask", "frank", "ask", [], [], "list", {
          gain: [K("k_ff_program")],
          miss: "flush",
        }),
        r("warm", "warm", "ask", [], [], "list", {
          gain: [K("k_ff_program")],
          miss: "flush",
        }),
        r(
          "deal",
          "cold",
          "deal",
          ["court:-1", "hun_pm:-1"],
          [
            K("k_ff_program"),
            pt({ office: "court" }, -1),
            pt({ office: "hun_pm" }, -1),
          ],
          "list",
        ),
        close("leave", "cold"),
      ),
      list: plain(
        r("oath", "frank", "ask", [], [], "oath"),
        r("end", "cold", "leave", [], [], null),
      ),
      oath: plain(close("end", "frank"), close("end2", "cold")),
      flush: plain(
        r("end", "cold", "leave", [], [reason("auh_v_ff_program_r1")], null),
      ),
    },
  ),
  visit(
    "auh_v_ff_no_war",
    { person: "auh_ff" },
    all(ffAlive, { kind: "temp", min: 3 }, { kind: "chapter", max: 5 }),
    7,
    ["foreign", "tension_down"],
    {
      open: node(
        [
          v("bed", opening("sarajevo_survived")),
          v("arrogant", moody(p, "arrogant")),
          base,
        ],
        r("ask", "frank", "ask", [], [], "why", {
          gain: [K("k_ff_no_war")],
          miss: "curse",
        }),
        r("cold", "cold", "ask", [], [], "why", {
          gain: [K("k_ff_no_war")],
          miss: "curse",
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["cos:-1", "temp:-1"],
          [K("k_ff_no_war"), pt({ office: "chief_of_staff" }, -1), temp(-1)],
          "why",
        ),
        close("leave", "cold"),
      ),
      why: plain(
        r("conrad", "frank", "ask", [], [], "conrad"),
        r("end", "warm", "leave", ["trust:+1"], [pt(p, 1)], null),
      ),
      conrad: plain(close("end", "frank"), close("end2", "cold")),
      curse: plain(
        r("end", "cold", "leave", [], [reason("auh_v_ff_no_war_r1")], null),
      ),
    },
    { stage: C },
  ),
  visit(
    "auh_v_bil_promise",
    { called: true },
    undefined,
    5,
    ["people"],
    {
      open: node(
        moods(p, "cunning", "weary"),
        r("sorry", "warm", "ask", [], [], "answer", {
          gain: [pt(p, 1), reason("promise_mended", p)],
        }),
        r(
          "pay",
          "frank",
          "deal",
          ["nations:+1", "hungary:-1"],
          [nations(1), hungary(-1), keepPromise(p, "bil_galicia")],
          "answer",
        ),
        r(
          "shrug",
          "cold",
          "leave",
          ["trust:-1", "nations:-1"],
          [pt(p, -1), nations(-1)],
          null,
        ),
      ),
      answer: node(
        [v("eased", { kind: "mood", min: 1 }), base],
        close("end", "warm"),
      ),
    },
    { scheduledOnly: true },
  ),
  visit(
    "auh_v_rival_complaint",
    { rival: true },
    all(inWar, { kind: "person_trust", who: p, max: -1 }),
    5,
    ["people"],
    {
      open: node(
        moods(p, "anxious", "cold", "arrogant", "cunning", "weary", "stubborn"),
        r("hear", "warm", "ask", [], [], "complaint", {
          gain: [pt(p, 1), reason("auh_v_rival_r1", p)],
        }),
        r("short", "cold", "push", [], [], "complaint"),
        r(
          "deal",
          "frank",
          "deal",
          ["authority:-5", "trust:+1"],
          [act({ do: "authority", delta: -5 }), pt(p, 1)],
          "complaint",
        ),
        r("out", "threat", "leave", ["trust:-1"], [pt(p, -1)], null),
      ),
      complaint: node(
        [
          v("eased", { kind: "mood", min: 1 }),
          v("hurt", { kind: "mood", max: -1 }),
          base,
        ],
        close("end", "warm"),
        close("end2", "cold"),
      ),
    },
    { once: false, cooldown: 6 },
  ),
];

/**
 * Where a talk turns to what the person makes of someone else (design §5.6):
 * the reply opens at that node, and the answer is straight only if `candid`.
 */
const ASIDES: Readonly<Record<string, string>> = {
  auh_t_ber_funeral: "kings",
  auh_t_ber_clause: "clause",
  auh_t_ber_rome: "article",
  auh_t_ber_brake: "can",
  auh_t_ber_trentino: "price",
  auh_t_hoyos_term: "term",
  auh_t_hoyos_partition: "map",
  auh_t_hoyos_young: "names",
  auh_t_hoyos_halt: "read",
  auh_t_hoyos_zoll: "dinner",
  auh_t_bil_bosnia: "heard",
  auh_t_bil_inquiry: "first",
  auh_t_bil_bill: "bill",
  auh_t_bil_potiorek: "man",
  auh_t_stu_closed: "why_shut",
  auh_t_stu_decree: "paragraph",
  auh_t_stu_bohemia: "prague",
  auh_t_stu_grain: "bread",
  auh_t_stu_open: "when",
  auh_v_tsch_push: "wants",
};

function withAside(s: GwScene): GwScene {
  const at = ASIDES[s.id];
  if (at === undefined || s.nodes === undefined) return s;
  const host = s.nodes[at];
  return {
    ...s,
    nodes: {
      ...s.nodes,
      [at]: {
        ...host,
        replies: [r("aside", "cold", "ask", [], [], "aside"), ...host.replies],
      },
      aside: node(
        [v("candid", candid(p)), base],
        close("end", "frank"),
        close("end2", "cold"),
      ),
    },
  };
}

export const AUH_CRISIS_SCENES: readonly GwScene[] = [
  ...SCENES,
  ...[...BERCHTOLD, ...HOYOS, ...BILINSKI, ...STURGKH, ...VISITS].map(
    withAside,
  ),
];
