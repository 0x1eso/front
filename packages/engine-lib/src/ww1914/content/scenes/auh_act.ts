import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  any,
  character,
  chose,
  decide,
  dropCard,
  flag,
  GwCastRule,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReply,
  GwScene,
  GwVariant,
  GwWho,
  holder,
  moody,
  not,
  reason,
  rivalAct,
  rivalStage,
  role,
  schedule,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  doWorld,
  GwWorldEffect,
  world,
} from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * 「오스트리아-헝가리」, what the seat starts and the story around it: the scenes
 * the schedule plays (acts/auh.ts holds the entries and the aims), the opening,
 * the big scenes, the rival, the two rulers' letters and the scenes that press
 * on the aim. Text: resources/ww1914/ko/AUH.act.json.
 */

const NATION: GwScene["nation"] = ["AUH"];

export const v = (id: string, when: GwCond): GwVariant => ({ id, when });
const base: GwVariant = { id: "base" };

export const inWar = world({ is: "war" });
export const peace = not(inWar);
export const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
export const since = (from: string) => world({ is: "date", from });
export const until = (to: string) => world({ is: "date", to });
export const between = (from: string, to: string) =>
  world({ is: "date", from, to });
export const secret = (id: string): GwCond => ({ kind: "secret", id });
export const italyIn = world({ is: "entered", tag: "ITA", side: "entente" });
export const eastPushed = world({
  is: "battle",
  theatre: "east",
  of: ["advance", "break"],
});
/** The Russians came on in the east and the line gave: an army is going. */
const eastBroken = world({
  is: "battle",
  theatre: "east",
  of: ["advance", "break"],
  by: "foe",
});
export const karl = flag("w_auh_karl");
export const ffThrone = flag("w_auh_ff_throne");
export const hungaryAt = (r: { min?: number; max?: number }): GwCond => ({
  kind: "inst",
  inst: "hungary",
  ...r,
});
export const nationsAt = (r: { min?: number; max?: number }): GwCond => ({
  kind: "inst",
  inst: "nations",
  ...r,
});
export const berlinAt = (r: { min?: number; max?: number }): GwCond => ({
  kind: "inst",
  inst: "berlin",
  ...r,
});
export const picked = (field: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field,
  of,
});
export const fits = (who: GwWho): GwCond => ({ kind: "tone_fits", who });
export const able = (who: GwWho, min: number): GwCond => ({
  kind: "competence",
  who,
  field: "politics",
  min,
});
const bread = (max: number): GwCond => ({ kind: "gauge", gauge: "bread", max });
const shells = (max: number): GwCond => ({
  kind: "gauge",
  gauge: "shells",
  max,
});
const strength = (
  tag: GwTag,
  theatre: "east" | "italy",
  r: { min?: number; max?: number },
): GwCond => ({ kind: "strength", tag, theatre, ...r });
const unrest = (min: number) => world({ is: "unrest", min });
const ahead = world({ is: "score", min: 10 });
const behind = world({ is: "score", max: -10 });
const seenScene = (scene: string): GwCond => ({ kind: "seen", scene });
const aim = (...of: string[]): GwCond => ({ kind: "aim", of });
const metAim: GwCond = { kind: "aim_met" };
const crisisOn: GwCond = { kind: "crisis", topic: "balkan" };
const firstGame: GwCond = { kind: "first_game" };

export const inst = (
  i: "hungary" | "council" | "nations" | "berlin" | "army",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
export const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
export const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
export const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
export const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
export const reveal = (id: Extract<GwWorldEffect, { do: "reveal" }>["id"]) =>
  maybe(secret(id), doWorld({ do: "reveal", id }));
const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
const force = (theatre: "east" | "italy", delta: number) =>
  doWorld({ do: "force", tag: "AUH", theatre, delta });
const repute = (delta: number, key: string): GwEffect => ({
  kind: "ruler",
  side: "reputation",
  delta,
  key,
});

const opt = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): GwOption => ({ id, tell, effects, ...(when ? { when } : {}) });

/** What the seat saw: a stamped report with no decision in it. */
const eyes = (
  id: string,
  cast: Record<string, GwCastRule>,
  variants: GwVariant[],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "report",
  cast,
  salience: 6,
  tags: ["home"],
  variants,
  scheduledOnly: true,
  stamp: "confirmed",
  source: "own_eyes",
  ...more,
});

/** What the seat decides once it is there. */
const choice = (
  id: string,
  cast: Record<string, GwCastRule>,
  variants: GwVariant[],
  options: GwOption[],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "proposal",
  cast,
  salience: 6,
  tags: ["home"],
  variants,
  scheduledOnly: true,
  fallback: options[0].id,
  options,
  noBack: true,
  ...more,
});

const to = role("to");
const a = role("a");
const b = role("b");
const e = role("e");
const pm = role("pm");
const chan = role("chan");
const cos = role("cos");
const fm = role("fm");

// ---- 시찰 ----

const VISIT_SCENES: GwScene[] = [
  eyes(
    "auh_a_skoda_v",
    {},
    [
      v("peace", peace),
      v("short", shells(1)),
      v("hollow", strength("AUH", "east", { max: 2 })),
      base,
    ],
    { tags: ["war"] },
  ),
  eyes(
    "auh_a_csepel_v",
    { pm: holder("hun_pm") },
    [v("cold", hungaryAt({ max: -1 })), v("short", shells(1)), base],
    { tags: ["war"] },
  ),
  choice(
    "auh_a_mills_v",
    { pm: holder("hun_pm") },
    [
      v("hidden", secret("auh_hun_grain_hidden")),
      v("harvest", { kind: "stage", stage: "crisis" }),
      base,
    ],
    [
      opt("say_nothing", ["hun_pm:+1"], [trustOf(pm, 1)]),
      opt(
        "ask_pm",
        ["bread:+1", "hun_pm:-1", "hungary:-1"],
        [gauge("bread", 1), trustOf(pm, -1), inst("hungary", -1)],
      ),
    ],
  ),
  eyes("auh_a_queue_v", {}, [
    v("riot", unrest(2)),
    v("hungry", bread(1)),
    base,
  ]),
  eyes("auh_a_prague_v", { chan: holder("chancellor") }, [
    v("sound", all(inWar, secret("auh_czech_regiments_sound"))),
    v("peace", peace),
    base,
  ]),
  eyes(
    "auh_a_hq_v",
    { cos: holder("chief_of_staff") },
    [
      v("command", world({ is: "command" })),
      v("german", berlinAt({ min: 2 })),
      v("hollow", strength("AUH", "east", { max: 2 })),
      v("baden", since("1917-01")),
      base,
    ],
    { tags: ["war"] },
  ),
  eyes(
    "auh_a_przemysl_v",
    {},
    [
      v("pushed", eastPushed),
      v("many", strength("RUS", "east", { min: 4 })),
      base,
    ],
    { tags: ["war"] },
  ),
  eyes("auh_a_pass_v", {}, [v("winter", until("1915-03")), base], {
    tags: ["war"],
  }),
  eyes(
    "auh_a_isonzo_v",
    { bor: { person: "auh_boroevic" } },
    [
      v("broken", world({ is: "battle", theatre: "italy", of: ["break"] })),
      v("thin", strength("AUH", "italy", { max: 2 })),
      base,
    ],
    { tags: ["war"] },
  ),
  eyes(
    "auh_a_semlin_v",
    {},
    [
      v("before", peace),
      v("taken", world({ is: "front", theatre: "balkan", from: "belgrade" })),
      base,
    ],
    { tags: ["war"] },
  ),
  eyes(
    "auh_a_pola_v",
    { navy: holder("navy") },
    [
      v("red", all(inWar, unrest(2))),
      v("italy", italyIn),
      v("peace", peace),
      base,
    ],
    { tags: ["war"] },
  ),
  eyes("auh_a_ward_v", {}, [
    v("full", world({ is: "casualties", min: 800 })),
    base,
  ]),
  eyes("auh_a_barracks_v", {}, [
    v("fever", all(italyIn, since("1915-11"))),
    v("italy", italyIn),
    base,
  ]),
  eyes(
    "auh_a_bosnia_v",
    {},
    [
      v("war", inWar),
      v("alive", { kind: "opening", of: ["sarajevo_survived"] }),
      v("dead", { kind: "opening", of: ["sarajevo"] }),
      base,
    ],
    { tags: ["foreign"] },
  ),
];

// ---- 친서의 답 ----

const LETTER_SCENES: GwScene[] = [
  eyes(
    "auh_a_l_ferdinand_r",
    { to: { ruler_of: "BGR" } },
    [
      v("kin_fits", all(picked("subject", "kin"), fits(to))),
      v("land_fits", all(picked("subject", "macedonia"), fits(to))),
      v("kin", picked("subject", "kin")),
      base,
    ],
    { tags: ["foreign"] },
  ),
  eyes(
    "auh_a_l_pope_r",
    { to: { person: "vat_benedict" } },
    [
      v("peace_ahead", all(picked("subject", "peace"), ahead)),
      v("peace_behind", all(picked("subject", "peace"), behind)),
      v("peace", picked("subject", "peace")),
      v("warm", fits(to)),
      base,
    ],
    { tags: ["foreign"] },
  ),
  eyes(
    "auh_a_l_alfonso_r",
    { to: { ruler_of: "ESP" } },
    [
      v("mediate_behind", all(picked("subject", "mediate"), behind)),
      v("mediate", picked("subject", "mediate")),
      v("warm", fits(to)),
      base,
    ],
    { tags: ["foreign"] },
  ),
  eyes(
    "auh_a_l_pm_r",
    { to: holder("hun_pm") },
    [
      v("threat", picked("tone", "threat")),
      v("grain_fits", all(picked("subject", "grain"), fits(to))),
      v("grain_cold", all(picked("subject", "grain"), hungaryAt({ max: -1 }))),
      v("grain", picked("subject", "grain")),
      v("franchise_fits", all(picked("subject", "franchise"), fits(to))),
      v("franchise", picked("subject", "franchise")),
      v("romania_fits", fits(to)),
      base,
    ],
    { tags: ["people"] },
  ),
  eyes(
    "auh_a_l_chief_r",
    { to: holder("chief_of_staff") },
    [
      v("threat", picked("tone", "threat")),
      v("truth_fits", all(picked("subject", "truth"), fits(to))),
      v("truth_proud", all(picked("subject", "truth"), moody(to, "arrogant"))),
      v("truth", picked("subject", "truth")),
      v("shells_low", all(picked("subject", "shells"), shells(1))),
      v("shells", picked("subject", "shells")),
      v(
        "germans_deep",
        all(picked("subject", "germans"), berlinAt({ min: 2 })),
      ),
      base,
    ],
    { tags: ["people"] },
  ),
  eyes(
    "auh_a_l_heir_r",
    { to: { any_of: [{ person: "auh_ff" }, { person: "auh_karl" }] } },
    [
      v("crown_fits", all(picked("subject", "crown"), fits(to))),
      v("crown", picked("subject", "crown")),
      v("peace_war", all(picked("subject", "peace"), inWar)),
      v("peace", picked("subject", "peace")),
      v("army_fits", fits(to)),
      base,
    ],
    { tags: ["people", "private"] },
  ),
];

// ---- 칙령과 지시 ----

const ab = {
  a: { picked: "attend" },
  b: { picked: "attend", nth: 1 },
} as const;
const met: GwVariant[] = [
  v("worn", all(moody(a, "weary"), moody(b, "weary"))),
  v("fight", any(moody(a, "arrogant"), moody(b, "arrogant"))),
  base,
];

const ORDER_SCENES: GwScene[] = [
  choice(
    "auh_a_o_council_bread",
    ab,
    [v("empty", bread(1)), ...met],
    [
      opt(
        "pool",
        ["hungary:-1", "bread:+1"],
        [inst("hungary", -1), gauge("bread", 1)],
      ),
      opt(
        "buy",
        ["money:-1", "bread:+1"],
        [gauge("money", -1), gauge("bread", 1)],
      ),
      opt("adjourn", ["council:-1"], [inst("council", -1)]),
    ],
  ),
  choice(
    "auh_a_o_council_germans",
    ab,
    [v("deep", berlinAt({ min: 2 })), ...met],
    [
      opt(
        "minute",
        ["berlin:-1", "deu:-1"],
        [inst("berlin", -1), trust("DEU", -1)],
      ),
      opt("leave_it", ["council:+1"], [inst("council", 1)]),
    ],
    { tags: ["foreign"] },
  ),
  choice(
    "auh_a_o_council_end",
    ab,
    [v("losing", behind), v("winning", ahead), ...met],
    [
      opt(
        "feel_out",
        ["deu:-1", "morale:-1"],
        [trust("DEU", -1), gauge("morale", -1)],
      ),
      opt("no_word", ["army:+1"], [inst("army", 1)]),
    ],
    { tags: ["foreign"] },
  ),
  eyes(
    "auh_a_o_rail_r",
    { war: holder("war") },
    [
      v(
        "north_bad",
        all(picked("subject", "north"), secret("auh_rail_muddle")),
      ),
      v("south_bad", secret("auh_rail_muddle")),
      v("north", picked("subject", "north")),
      base,
    ],
    { tags: ["war"], source: "staff" },
  ),
  eyes(
    "auh_a_o_inquiry_r",
    {},
    [
      v(
        "officers_yes",
        all(picked("subject", "officers"), secret("srb_officers_plot")),
      ),
      v("ministers_yes", secret("srb_officers_plot")),
      v("officers", picked("subject", "officers")),
      base,
    ],
    { tags: ["foreign"], source: "agents", stamp: "unconfirmed" },
  ),
  eyes(
    "auh_a_o_redl_r",
    { cos: holder("chief_of_staff") },
    [v("changed", secret("auh_redl_plans")), base],
    { tags: ["war"], source: "staff" },
  ),
  eyes(
    "auh_a_o_envoy_r",
    { e: { picked: "envoy" } },
    [
      v("rome_good", all(picked("where", "rome"), able(e, 3))),
      v("rome", picked("where", "rome")),
      v("bucharest_good", all(picked("where", "bucharest"), able(e, 3))),
      v("bucharest", picked("where", "bucharest")),
      v("turk_good", able(e, 3)),
      base,
    ],
    { tags: ["foreign"], source: "agents", stamp: "unconfirmed" },
  ),
  eyes(
    "auh_a_o_berlin_r",
    { e: { picked: "envoy" } },
    [
      v("div_deep", all(picked("ask", "divisions"), berlinAt({ min: 2 }))),
      v("divisions", picked("ask", "divisions")),
      v("grain_low", all(picked("ask", "grain"), bread(1))),
      v("grain", picked("ask", "grain")),
      v("aims_behind", behind),
      base,
    ],
    { tags: ["foreign"], source: "embassy_berlin", stamp: "unconfirmed" },
  ),
  choice(
    "auh_a_o_nations_m",
    {},
    [
      v("language", picked("agenda", "language")),
      v("prisoners", picked("agenda", "prisoners")),
      v("low", nationsAt({ max: -2 })),
      base,
    ],
    [
      opt(
        "promise",
        ["nations:+1", "army:-1"],
        [inst("nations", 1), inst("army", -1)],
      ),
      opt("hear_only", ["nations:-1"], [inst("nations", -1)]),
    ],
  ),
  choice(
    "auh_a_o_premiers_m",
    { chan: holder("chancellor"), pm: holder("hun_pm") },
    [
      v("quota", picked("agenda", "quota")),
      v("franchise", picked("agenda", "franchise")),
      v("cold", hungaryAt({ max: -1 })),
      base,
    ],
    [
      opt(
        "split",
        ["hungary:+1", "chancellor:-1"],
        [inst("hungary", 1), trustOf(chan, -1)],
      ),
      opt(
        "for_vienna",
        ["hungary:-1", "chancellor:+1", "bread:+1"],
        [inst("hungary", -1), trustOf(chan, 1), gauge("bread", 1)],
      ),
      opt("adjourn", ["hun_pm:+1"], [trustOf(pm, 1)]),
    ],
  ),
];

// ---- 연설 ----

const said = { stamp: "confirmed", source: "press" } as const;

const SPEECH_SCENES: GwScene[] = [
  eyes(
    "auh_a_s_peoples_r",
    {},
    [
      v("peace_lost", all(picked("on", "peace"), behind)),
      v("peace", picked("on", "peace")),
      v("duty_low", nationsAt({ max: -1 })),
      base,
    ],
    said,
  ),
  eyes(
    "auh_a_s_budapest_r",
    { pm: holder("hun_pm") },
    [
      v("bread_cold", all(picked("on", "bread"), hungaryAt({ max: -1 }))),
      v("bread", picked("on", "bread")),
      v("crown_warm", hungaryAt({ min: 2 })),
      base,
    ],
    said,
  ),
  eyes(
    "auh_a_s_prague_r",
    {},
    [
      v("language_low", all(picked("on", "language"), nationsAt({ max: -2 }))),
      v("language", picked("on", "language")),
      v("loyalty_low", nationsAt({ max: -2 })),
      base,
    ],
    said,
  ),
  eyes(
    "auh_a_s_army_r",
    {},
    [
      v("tongues_low", all(picked("on", "tongues"), nationsAt({ max: -1 }))),
      v("tongues", picked("on", "tongues")),
      v("thanks_lost", behind),
      base,
    ],
    { source: "staff", tags: ["war"] },
  ),
  eyes(
    "auh_a_s_vienna_r",
    {},
    [
      v("bread_low", all(picked("on", "bread"), bread(1))),
      v("bread", picked("on", "bread")),
      v("dead_many", world({ is: "casualties", min: 800 })),
      base,
    ],
    said,
  ),
  eyes(
    "auh_a_s_house_r",
    {},
    [
      v(
        "nations_house",
        all(picked("on", "nations"), picked("place", "reichsrat")),
      ),
      v("nations", picked("on", "nations")),
      v("war_house", picked("place", "reichsrat")),
      base,
    ],
    said,
  ),
];

// ---- 뒷공작 ----

const pair = {
  a: { picked: "pair" },
  b: { picked: "pair", nth: 1 },
} as const;

const INTRIGUE_SCENES: GwScene[] = [
  eyes(
    "auh_a_i_pair_r",
    pair,
    [
      v("proud", any(moody(a, "arrogant"), moody(b, "arrogant"))),
      v("sly", any(moody(a, "cunning"), moody(b, "cunning"))),
      base,
    ],
    { tags: ["people"], stamp: "unconfirmed" },
  ),
  choice(
    "auh_a_i_pair_out",
    pair,
    [v("sly", moody(a, "cunning")), base],
    [
      opt(
        "own_it",
        ["reputation:-1"],
        [
          trustOf(a, -1),
          trustOf(b, -1),
          repute(-1, "auh_a_pair_known"),
          reason("auh_a_pair_known"),
        ],
      ),
      opt(
        "deny",
        ["authority"],
        [
          trustOf(a, -2),
          doWorld({ do: "authority", delta: -5 }),
          reason("auh_a_pair_denied"),
        ],
      ),
    ],
    { tags: ["people"] },
  ),
  eyes(
    "auh_a_i_rumour_r",
    {},
    [
      v("hoarders", picked("story", "hoarders")),
      v("generals", picked("story", "generals")),
      base,
    ],
    { source: "press", stamp: "unconfirmed" },
  ),
  choice(
    "auh_a_i_rumour_out",
    { chan: holder("chancellor") },
    [v("hoarders", picked("story", "hoarders")), base],
    [
      opt(
        "clerk_goes",
        ["chancellor:-1", "order:-1"],
        [trustOf(chan, -1), gauge("order", -1), reason("auh_a_rumour_clerk")],
      ),
      opt(
        "say_nothing",
        ["hungary:-1", "opinion:-1"],
        [
          inst("hungary", -1),
          opinion("press", -1),
          reason("auh_a_rumour_silent"),
        ],
      ),
    ],
  ),
  eyes(
    "auh_a_i_agent_r",
    {},
    [
      v("gap", all(picked("where", "bucharest"), secret("rou_shell_gap"))),
      v("bucharest", picked("where", "bucharest")),
      v(
        "rome_yes",
        all(picked("where", "rome"), secret("ita_fra_understanding")),
      ),
      v("rome", picked("where", "rome")),
      base,
    ],
    { tags: ["foreign"], source: "agents", stamp: "unconfirmed" },
  ),
  choice(
    "auh_a_i_agent_out",
    { fm: holder("foreign") },
    [
      v("bucharest", picked("where", "bucharest")),
      v("rome", picked("where", "rome")),
      base,
    ],
    [
      opt(
        "disown",
        ["fm:-1"],
        [trustOf(fm, -1), reason("auh_a_agent_disowned")],
      ),
      opt(
        "trade",
        ["money:-1"],
        [gauge("money", -1), reason("auh_a_agent_traded")],
      ),
    ],
    { tags: ["foreign"] },
  ),
  eyes(
    "auh_a_i_swiss_r",
    {},
    [
      v("prince_behind", all(picked("through", "prince"), behind)),
      v("prince", picked("through", "prince")),
      v("banker_ahead", ahead),
      base,
    ],
    { tags: ["foreign"], source: "agents", stamp: "unconfirmed" },
  ),
  choice(
    "auh_a_i_swiss_out",
    { fm: holder("foreign") },
    [v("deep", berlinAt({ min: 2 })), base],
    [
      opt(
        "tell_wilhelm",
        ["deu:-1"],
        [trust("DEU", -1), reason("auh_a_swiss_told")],
      ),
      opt(
        "deny",
        ["deu:-2", "berlin:+1"],
        [trust("DEU", -2), inst("berlin", 1), reason("auh_a_swiss_denied")],
      ),
    ],
    { tags: ["foreign"] },
  ),
  eyes(
    "auh_a_i_cipher_r",
    {},
    [
      v("berlin_deep", all(picked("whose", "berlin"), berlinAt({ min: 2 }))),
      v("berlin", picked("whose", "berlin")),
      v("rome_war", italyIn),
      base,
    ],
    { tags: ["foreign"], source: "agents", stamp: "unconfirmed" },
  ),
  choice(
    "auh_a_i_cipher_out",
    { cos: holder("chief_of_staff") },
    [v("berlin", picked("whose", "berlin")), base],
    [
      opt(
        "close_it",
        ["deu:+1"],
        [trust("DEU", 1), reason("auh_a_cipher_closed")],
      ),
      opt(
        "keep_it",
        ["deu:-1", "cos:+1"],
        [trust("DEU", -1), trustOf(cos, 1), reason("auh_a_cipher_kept")],
      ),
    ],
    { tags: ["foreign"] },
  ),
  eyes(
    "auh_a_i_opposition_r",
    { pm: holder("hun_pm") },
    [v("proud", moody(pm, "arrogant", "stubborn")), base],
    { tags: ["people"], source: "press", stamp: "unconfirmed" },
  ),
  choice(
    "auh_a_i_opposition_out",
    { pm: holder("hun_pm") },
    [v("cold", moody(pm, "cold")), base],
    [
      opt(
        "apologise",
        ["hun_pm:+1", "reputation:-1"],
        [
          trustOf(pm, 1),
          repute(-1, "auh_a_paid_known"),
          reason("auh_a_paid_known"),
        ],
      ),
      opt(
        "stand",
        ["hungary:-2"],
        [inst("hungary", -2), reason("auh_a_paid_stood")],
      ),
    ],
    { tags: ["people"] },
  ),
];

/** What the schedule plays: Content.ts marks these as played from it. */
export const AUH_ACT_SCENES: readonly GwScene[] = [
  ...VISIT_SCENES,
  ...LETTER_SCENES,
  ...ORDER_SCENES,
  ...SPEECH_SCENES,
  ...INTRIGUE_SCENES,
];

// ---- 첫 십 분 ----

const circle = {
  fm: holder("foreign"),
  cos: holder("chief_of_staff"),
  hun_pm: holder("hun_pm"),
};

const OPENING_SCENES: GwScene[] = [
  {
    id: "auh_open_three",
    nation: NATION,
    kind: "crisis",
    when: all(firstGame, { kind: "chapter", max: 0 }),
    cast: circle,
    salience: 9,
    tags: ["people", "tension_up"],
    once: true,
    noBack: true,
    variants: [
      v("quiet", {
        kind: "opening",
        of: ["sarajevo_delayed", "no_sarajevo"],
      }),
      v("survived", { kind: "opening", of: ["sarajevo_survived"] }),
      v("failed", { kind: "opening", of: ["sarajevo_failed"] }),
      base,
    ],
    fallback: "to_fm",
    options: [
      opt(
        "to_fm",
        ["fm:+1", "cos:-1"],
        [
          trustOf(role("fm"), 1),
          trustOf(role("cos"), -1),
          schedule("auh_open_after", 1),
        ],
      ),
      opt(
        "to_cos",
        ["temp:+1", "army:+1", "hun_pm:-1"],
        [
          temp(1),
          inst("army", 1),
          trustOf(role("hun_pm"), -1),
          setFlag("f_auh_early_mob"),
          schedule("auh_open_after", 1),
        ],
      ),
      opt(
        "to_pm",
        ["hungary:+1", "cos:-1", "deu:-1"],
        [
          inst("hungary", 1),
          trustOf(role("cos"), -1),
          trust("DEU", -1),
          schedule("auh_open_after", 1),
        ],
      ),
    ],
  },
  eyes(
    "auh_open_after",
    circle,
    [
      v("fm", chose("auh_open_three", "to_fm")),
      v("cos", chose("auh_open_three", "to_cos")),
      base,
    ],
    { salience: 8, tags: ["people"], source: "staff" },
  ),
];

// ---- 고비 ----

/** Replies in a big scene that aren't decisions. */
const say = (
  id: string,
  stance: GwReply["stance"],
  next: string | null,
  kind: GwReply["kind"] = "ask",
): GwReply => ({ id, stance, kind, tell: [], effects: [], next });

const node = (
  who: string | null,
  replies: GwReply[],
  says: GwVariant[] = [base],
  fallback?: string,
): GwNode => ({
  says,
  replies,
  ...(who === null ? { alone: true } : { who }),
  ...(fallback === undefined ? {} : { fallback }),
});

const big = (
  id: string,
  cast: Record<string, GwCastRule>,
  who: string,
  when: GwCond,
  nodes: Record<string, GwNode>,
  after: GwScene["after"],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "talk",
  big: true,
  once: true,
  salience: 9,
  tags: ["war", "tension_up"],
  when,
  cast,
  who,
  start: "n1",
  variants: [base],
  after,
  nodes,
  ...more,
});

const silent = (id: string, variants: GwVariant[] = [base]): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: ["tension_down"],
  variants,
});

const declared = any(flag("f_auh_declared"), atWar("SRB"));

const BIG_SCENES: GwScene[] = [
  big(
    "auh_big_ischl",
    {
      fm: holder("foreign"),
      cos: holder("chief_of_staff"),
      court: holder("court"),
    },
    "fm",
    all(crisisOn, flag("f_auh_broke_off"), not(declared)),
    {
      n1: node("fm", [
        say("why_today", "warm", "n2"),
        say("leave_it", "cold", "n2"),
      ]),
      n2: node(
        "fm",
        [
          decide("strike_line", "n3", [setFlag("f_auh_tk_struck")], ["fm:-1"]),
          decide("let_stand", "n3", [schedule("auh_big_ischl_line", 1)]),
        ],
        [base],
        "let_stand",
      ),
      n3: node(null, [decide("wait", "n4")]),
      n4: node("court", [
        say("how_long", "frank", "n5"),
        say("go_on", "cold", "n5"),
      ]),
      n5: node(
        "fm",
        [
          decide(
            "sign",
            null,
            [
              temp(2),
              setFlag("f_auh_declared"),
              maybe(not(flag("f_auh_sign_council")), inst("council", -2)),
              maybe(not(flag("f_auh_sign_hungary")), inst("hungary", -2)),
              maybe(not(flag("f_auh_sign_austria")), inst("nations", -1)),
              maybe(not(flag("f_auh_sign_berlin")), trust("DEU", -1)),
              dropCard("auh_c_war_serbia"),
            ],
            ["temp:+2", "empty_slots"],
          ),
          decide("morning", null),
        ],
        [v("struck", flag("f_auh_tk_struck")), base],
        "morning",
      ),
    },
    [
      { scene: "auh_big_ischl_signed", when: chose("auh_big_ischl", "sign") },
      { scene: "auh_big_ischl_open" },
    ],
    { stage: ["crisis"] },
  ),
  big(
    "auh_big_lemberg",
    {
      court: holder("court"),
      cos: holder("chief_of_staff"),
      war: holder("war"),
      fin: holder("finance"),
    },
    "court",
    all(
      atWar("RUS"),
      eastPushed,
      world({ is: "war_months", own: true, max: 11 }),
    ),
    {
      n1: node("court", [
        say("how_many", "frank", "n2"),
        say("whose_fault", "cold", "n2"),
      ]),
      n2: node(
        "cos",
        [say("hear", "warm", "n3"), say("not_berlin", "threat", "n3")],
        [v("proud", moody(cos, "arrogant")), base],
      ),
      n3: node("fin", [
        say("poles", "frank", "n4"),
        say("later", "cold", "n4"),
      ]),
      n4: node(null, [decide("wait", "n5")]),
      n5: node(
        "war",
        [
          decide(
            "ask_germans",
            "n6",
            [inst("berlin", 1), force("east", 1), inst("army", -1)],
            ["berlin:+1", "army:-1"],
          ),
          decide(
            "stand_alone",
            "n6",
            [gauge("morale", -1), inst("army", 1)],
            ["morale:-1", "army:+1"],
          ),
        ],
        [base],
        "stand_alone",
      ),
      n6: node(
        "cos",
        [
          decide("keep_him", null, [trustOf(cos, 1)], ["cos:+1"]),
          decide(
            "paper_on_file",
            null,
            [trustOf(cos, -1), setFlag("f_auh_lemberg_rebuke")],
            ["cos:-1"],
          ),
        ],
        [v("germans", chose("auh_big_lemberg", "ask_germans")), base],
        "keep_him",
      ),
    },
    [{ scene: "auh_big_lemberg_wall" }],
  ),
  big(
    "auh_big_trent",
    {
      fm: holder("foreign"),
      hun_pm: holder("hun_pm"),
      cos: holder("chief_of_staff"),
    },
    "fm",
    all(
      world({ is: "neutral", tag: "ITA" }),
      atWar("RUS"),
      world({ is: "war_months", own: true, min: 5, max: 11 }),
    ),
    {
      n1: node("fm", [
        say("price", "frank", "n2"),
        say("who_asks", "cold", "n2"),
      ]),
      n2: node(
        "hun_pm",
        [say("why_you", "warm", "n3"), say("not_yours", "threat", "n3")],
        [v("cold", hungaryAt({ max: -1 })), base],
      ),
      n3: node("cos", [
        say("divisions", "frank", "n4"),
        say("enough", "cold", "n4"),
      ]),
      n4: node(null, [decide("wait", "n5")]),
      n5: node(
        "fm",
        [
          decide(
            "give_now",
            "n6",
            [
              doWorld({ do: "offer", tag: "ITA", value: 4 }),
              inst("army", -2),
              gauge("morale", -1),
              setFlag("f_auh_trent_given"),
            ],
            ["ita:+1", "army:-2", "morale:-1"],
          ),
          decide(
            "after_war",
            "n6",
            [doWorld({ do: "offer", tag: "ITA", value: 2 }), inst("army", -1)],
            ["ita:+1", "army:-1"],
          ),
          decide(
            "not_a_stone",
            "n6",
            [inst("army", 1), inst("hungary", 1)],
            ["army:+1", "hungary:+1"],
          ),
        ],
        [base],
        "after_war",
      ),
      n6: node(
        "hun_pm",
        [say("done", "cold", null, "leave")],
        [
          v("gave", chose("auh_big_trent", "give_now")),
          v("later", chose("auh_big_trent", "after_war")),
          base,
        ],
      ),
    },
    [
      { scene: "auh_big_trent_map", when: chose("auh_big_trent", "give_now") },
      { scene: "auh_big_trent_desk" },
    ],
    { tags: ["foreign", "tension_up"] },
  ),
  big(
    "auh_big_birthday",
    {
      fred: { person: "auh_friedrich" },
      cos: holder("chief_of_staff"),
      court: holder("court"),
    },
    "fred",
    all(atWar("RUS"), eastBroken, between("1916-05", "1916-07")),
    {
      n1: node("fred", [
        say("what_news", "warm", "n2"),
        say("many_happy", "flatter", "n2"),
      ]),
      n2: node(null, [decide("wait", "n3")]),
      n3: node(
        "cos",
        [say("how_far", "frank", "n4"), say("you_said", "threat", "n4")],
        [v("italy", italyIn), base],
      ),
      n4: node("court", [say("army_four", "frank", "n5")]),
      n5: node(
        "cos",
        [
          decide(
            "call_germans",
            "n6",
            [inst("berlin", 2), force("east", 2), inst("army", -1)],
            ["berlin:+2", "army:-1"],
          ),
          decide(
            "strip_italy",
            "n6",
            [force("east", 1), force("italy", -1), trustOf(cos, -1)],
            ["cos:-1"],
          ),
          decide(
            "fall_back",
            "n6",
            [gauge("morale", -1), { kind: "gauge", gauge: "order", delta: -1 }],
            ["morale:-1", "order:-1"],
          ),
        ],
        [base],
        "call_germans",
      ),
      n6: node(
        "fred",
        [
          decide("no_names", null, [inst("army", 1)], ["army:+1"]),
          decide(
            "relieve",
            null,
            [inst("army", -1), gauge("morale", 1)],
            ["army:-1", "morale:+1"],
          ),
        ],
        [base],
        "no_names",
      ),
    },
    [{ scene: "auh_big_birthday_table" }],
  ),
  big(
    "auh_big_bread",
    {
      lw: { person: "auh_landwehr" },
      chan: holder("chancellor"),
      pm: holder("hun_pm"),
    },
    "lw",
    all(
      inWar,
      bread(1),
      world({ is: "war_months", own: true, min: 29, max: 47 }),
    ),
    {
      n1: node("lw", [
        say("days", "frank", "n2"),
        say("numbers", "cold", "n2"),
      ]),
      n2: node(
        "chan",
        [say("what_want", "cold", "n3"), say("hear", "warm", "n3")],
        [v("riot", unrest(2)), base],
      ),
      n3: node(
        "pm",
        [say("your_barns", "frank", "n4"), say("my_crown", "threat", "n4")],
        [v("cold", hungaryAt({ max: -1 })), base],
      ),
      n4: node(null, [decide("wait", "n5")]),
      n5: node(
        "lw",
        [
          decide(
            "order_it",
            "n6",
            [gauge("bread", 2), inst("hungary", -2), trustOf(pm, -1)],
            ["bread:+2", "hungary:-2", "hun_pm:-1"],
          ),
          decide(
            "pay_for_it",
            "n6",
            [gauge("bread", 1), gauge("money", -1)],
            ["bread:+1", "money:-1"],
          ),
          decide(
            "ask_germans",
            "n6",
            [gauge("bread", 1), inst("berlin", 1)],
            ["bread:+1", "berlin:+1"],
          ),
          decide(
            "cut_ration",
            "n6",
            [gauge("order", -1), gauge("morale", -1), inst("hungary", 1)],
            ["order:-1", "morale:-1", "hungary:+1"],
          ),
        ],
        [base],
        "pay_for_it",
      ),
      n6: node(
        "chan",
        [say("enough", "cold", null, "leave")],
        [
          v("ordered", chose("auh_big_bread", "order_it")),
          v("cut", chose("auh_big_bread", "cut_ration")),
          base,
        ],
      ),
    },
    [
      {
        scene: "auh_big_bread_train",
        when: chose("auh_big_bread", "order_it"),
      },
      { scene: "auh_big_bread_line" },
    ],
    { tags: ["home", "tension_up"] },
  ),
  big(
    "auh_big_honour",
    { fm: holder("foreign"), zita: { person: "auh_zita" } },
    "fm",
    // The letter comes out in 1918 whatever brought it out; the denial is one way.
    all(
      karl,
      any(
        seenScene("auh_k_word_of_honour"),
        all(
          any(flag("f_auh_letter_alsace"), flag("f_auh_letter_general")),
          inWar,
          since("1918-01"),
        ),
      ),
    ),
    {
      n1: node("fm", [
        say("what_paper", "cold", "n2"),
        say("speak", "frank", "n2"),
      ]),
      n2: node(
        "fm",
        [say("rest", "cold", "n3"), say("who_said", "threat", "n3")],
        [v("sly", moody(fm, "cunning")), base],
      ),
      n3: node("zita", [
        say("she_hears", "warm", "n4"),
        say("not_now", "cold", "n4"),
      ]),
      n4: node(null, [decide("wait", "n5")]),
      n5: node(
        "fm",
        [
          decide(
            "send_him",
            null,
            [{ kind: "dismiss", who: fm }, repute(1, "auh_big_honour_stood")],
            ["leaves", "reputation:+1"],
          ),
          decide(
            "keep_him",
            null,
            [doWorld({ do: "authority", delta: -5 }), trustOf(fm, 1)],
            ["authority", "fm:+1"],
          ),
        ],
        [base],
        "keep_him",
      ),
    },
    [{ scene: "auh_big_honour_chair" }],
    { tags: ["people", "tension_up"] },
  ),
  big(
    "auh_big_last",
    {
      chan: holder("chancellor"),
      pm: holder("hun_pm"),
      cos: holder("chief_of_staff"),
    },
    "pm",
    all(
      inWar,
      world({ is: "war_months", own: true, min: 46 }),
      any(world({ is: "score", max: -25 }), nationsAt({ max: -3 })),
    ),
    {
      n1: node("pm", [
        say("say_it", "frank", "n2"),
        say("in_the_house", "cold", "n2"),
      ]),
      n2: node("cos", [
        say("how_long", "frank", "n3"),
        say("the_men", "warm", "n3"),
      ]),
      n3: node(
        "chan",
        [say("what_left", "frank", "n4")],
        [v("low", nationsAt({ max: -3 })), base],
      ),
      n4: node(null, [decide("wait", "n5")]),
      n5: node(
        "chan",
        [
          decide(
            "peoples_paper",
            "n6",
            [inst("nations", 2), inst("hungary", -2)],
            ["nations:+2", "hungary:-2"],
          ),
          decide(
            "own_peace",
            "n6",
            [
              trust("DEU", -3),
              inst("army", -1),
              setFlag("f_auh_last_own_peace"),
            ],
            ["deu:-3", "army:-1"],
          ),
          decide(
            "hold_on",
            "n6",
            [inst("army", 1), gauge("morale", -1)],
            ["army:+1", "morale:-1"],
          ),
        ],
        [base],
        "hold_on",
      ),
      n6: node(
        "pm",
        [say("thanks", "warm", null, "leave")],
        [
          v("paper", chose("auh_big_last", "peoples_paper")),
          v("alone", chose("auh_big_last", "own_peace")),
          base,
        ],
      ),
    },
    [{ scene: "auh_big_last_hall" }],
  ),
  big(
    "auh_big_peace",
    {
      pm: holder("hun_pm"),
      chan: holder("chancellor"),
      fm: holder("foreign"),
    },
    "pm",
    all(peace, world({ is: "peace_months", min: 17 })),
    {
      n1: node("pm", [
        say("ten_years", "frank", "n2"),
        say("old_paper", "cold", "n2"),
      ]),
      n2: node("chan", [
        say("your_half", "frank", "n3"),
        say("patience", "warm", "n3"),
      ]),
      n3: node("fm", [say("abroad", "frank", "n4")]),
      n4: node(null, [decide("wait", "n5")]),
      n5: node(
        "pm",
        [
          decide(
            "renew",
            null,
            [inst("hungary", 2), inst("nations", -1)],
            ["hungary:+2", "nations:-1"],
          ),
          decide(
            "vote_first",
            null,
            [inst("hungary", -2), inst("nations", 2), trustOf(pm, -1)],
            ["hungary:-2", "nations:+2", "hun_pm:-1"],
          ),
          decide("one_year", null, [inst("council", 1)], ["council:+1"]),
        ],
        [base],
        "one_year",
      ),
    },
    [{ scene: "auh_big_peace_seal" }],
    { tags: ["home", "tension_up"] },
  ),
];

const SILENT_SCENES: GwScene[] = [
  silent("auh_big_ischl_signed", [v("struck", flag("f_auh_tk_struck")), base]),
  silent("auh_big_ischl_open"),
  silent("auh_big_lemberg_wall"),
  silent("auh_big_trent_map"),
  silent("auh_big_trent_desk"),
  silent("auh_big_birthday_table"),
  silent("auh_big_bread_train"),
  silent("auh_big_bread_line"),
  silent("auh_big_honour_chair"),
  silent("auh_big_last_hall"),
  silent("auh_big_peace_seal"),
];

/** The line of the Ischl paper that wasn't so, a chapter after it was signed. */
const ISCHL_LINE: GwScene = {
  id: "auh_big_ischl_line",
  nation: NATION,
  kind: "report",
  scheduledOnly: true,
  cast: { fm: holder("foreign") },
  salience: 7,
  tags: ["people"],
  stamp: "confirmed",
  source: "staff",
  variants: [base],
};

// ---- 맞서는 사람 ----

const rm = role("rival_man");
const leans = (
  camp: "military" | "hard" | "magyar" | "civil" | "moderate" | "dynasty",
): GwCond => ({
  kind: "leans",
  who: rm,
  camp,
});
/** The row told apart by the camps in people data. */
const RIVALS: Readonly<Record<string, GwCond>> = {
  conrad: all(leans("military"), leans("hard")),
  tisza: leans("magyar"),
  berchtold: all(leans("civil"), leans("hard")),
  ff: all(leans("military"), leans("moderate")),
  czernin: all(leans("civil"), leans("moderate"), leans("dynasty")),
};
const theMan = { rival_man: { rival_man: true } } as const;

/** A small sign: an ordinary paper with one line that doesn't sit right. */
const sign = (who: string, n: number, tags: GwScene["tags"]): GwScene => ({
  id: `auh_rv_${who}_sign${n}`,
  nation: NATION,
  kind: "wire",
  when: all(rivalStage(1, 1), RIVALS[who], { kind: "chapter", min: n * 3 }),
  cast: theMan,
  salience: 4,
  tags,
  once: true,
  variants: [base],
});

const embraced: GwCond = { kind: "rival_act", of: ["embrace"] };
const pushed: GwCond = { kind: "rival_act", of: ["push"] };
const struck: GwCond = { kind: "rival_act", of: ["strike"] };

const gather = (who: string, strike: GwEffect[]): GwScene => ({
  id: `auh_rv_${who}_gather`,
  nation: NATION,
  kind: "audience",
  when: all(rivalStage(2, 2), RIVALS[who]),
  cast: theMan,
  salience: 7,
  tags: ["people"],
  once: true,
  noBack: true,
  variants: [base],
  fallback: "embrace",
  options: [
    opt("embrace", [], [rivalAct("embrace"), trustOf(rm, 1)]),
    opt("push", [], [rivalAct("push"), trustOf(rm, -1)]),
    opt("strike", [], [rivalAct("strike"), ...strike, trustOf(rm, -1)]),
  ],
});

const clash = (who: string, strike: GwEffect[]): GwScene => ({
  id: `auh_rv_${who}_clash`,
  nation: NATION,
  kind: "crisis",
  when: all(rivalStage(3, 3), RIVALS[who]),
  cast: theMan,
  salience: 8,
  tags: ["people", "tension_up"],
  once: true,
  noBack: true,
  variants: [
    v("struck", struck),
    v("pushed", pushed),
    v("embraced", embraced),
    base,
  ],
  fallback: "embrace",
  options: [
    opt(
      "embrace",
      ["authority"],
      [
        rivalAct("embrace"),
        trustOf(rm, 2),
        doWorld({ do: "authority", delta: -5 }),
        { kind: "rival_end", end: "reconciled" },
        reason("auh_rv_reconciled", rm),
      ],
    ),
    opt(
      "push",
      ["authority"],
      [
        rivalAct("push"),
        doWorld({ do: "authority", delta: -10 }),
        { kind: "rival_end", end: "prevailed" },
        reason("auh_rv_prevailed", rm),
      ],
    ),
    opt(
      "strike",
      ["reputation:-1"],
      [
        rivalAct("strike"),
        ...strike,
        repute(-1, "auh_rv_broken"),
        { kind: "rival_end", end: "broken" },
        reason("auh_rv_broken", rm),
      ],
    ),
  ],
});

const out: GwEffect = { kind: "dismiss", who: rm };

const RIVAL_SCENES: GwScene[] = [
  sign("conrad", 1, ["war"]),
  sign("conrad", 2, ["people"]),
  gather("conrad", [inst("army", -1)]),
  clash("conrad", [out, inst("army", -1)]),
  sign("tisza", 1, ["home"]),
  sign("tisza", 2, ["people"]),
  gather("tisza", [inst("hungary", -1)]),
  clash("tisza", [out, inst("hungary", -2)]),
  sign("berchtold", 1, ["foreign"]),
  sign("berchtold", 2, ["people"]),
  gather("berchtold", [inst("council", -1)]),
  clash("berchtold", [out, inst("council", -1)]),
  sign("ff", 1, ["people"]),
  sign("ff", 2, ["home"]),
  gather("ff", [inst("army", -1)]),
  clash("ff", [inst("army", -1), gauge("order", -1)]),
  sign("czernin", 1, ["foreign"]),
  sign("czernin", 2, ["people"]),
  gather("czernin", [trust("DEU", -1)]),
  clash("czernin", [out, trust("DEU", -1)]),
];

// ---- 황제의 편지 ----

const other = role("other_ruler");

const letter = (
  id: string,
  ruler: GwTag,
  variants: GwVariant[],
  options: GwOption[],
  more: Partial<GwScene>,
): GwScene => ({
  id,
  nation: NATION,
  kind: "letter",
  who: "other_ruler",
  once: true,
  salience: 6,
  tags: ["foreign"],
  cast: { other_ruler: { ruler_of: ruler } },
  variants,
  fallback: options[0].id,
  options,
  noBack: true,
  ...more,
});

const answer = (
  id: string,
  tone: "warm" | "cold" | "frank",
  tell: string[],
  effects: GwEffect[],
): GwOption =>
  opt(id, tell, [{ kind: "letter", who: other, tone }, ...effects]);

const hard = character(other, "hardline");
const wary = character(other, "cautious");
const sly = character(other, "opportunist");
const letters = (tone: "warm" | "cold"): GwCond => ({
  kind: "letters",
  who: other,
  tone,
});
const theirWar: GwCond = { kind: "at_war_with", who: other };
const over = any(world({ is: "armistice" }), since("1918-06"));

const LETTERS: GwScene[] = [
  letter(
    "auh_letter_w1",
    "DEU",
    [
      v("alive", not({ kind: "opening", of: ["sarajevo"] })),
      v("hard", hard),
      v("wary", wary),
      v("sly", sly),
      base,
    ],
    [
      answer(
        "reply_warm",
        "warm",
        ["deu:+1"],
        [trust("DEU", 1), schedule("auh_letter_w2", 2)],
      ),
      answer("reply_cold", "cold", [], [schedule("auh_letter_w2", 2)]),
    ],
    { when: { kind: "chapter", min: 1, max: 2 } },
  ),
  letter(
    "auh_letter_w2",
    "DEU",
    [
      v("cold", all(hard, letters("cold"))),
      v("hard", hard),
      v("wary", wary),
      v("sly", sly),
      base,
    ],
    [
      answer(
        "reply_warm",
        "warm",
        ["deu:+1", "temp:+1"],
        [trust("DEU", 1), temp(1), schedule("auh_letter_w3", 5)],
      ),
      answer(
        "reply_frank",
        "frank",
        ["temp:-1"],
        [temp(-1), schedule("auh_letter_w3", 5)],
      ),
    ],
    { scheduledOnly: true, salience: 7 },
  ),
  letter(
    "auh_letter_w3",
    "DEU",
    [
      v("peace", peace),
      v("deep", all(berlinAt({ min: 2 }), hard)),
      v("hard", hard),
      v("wary", wary),
      v("sly", sly),
      base,
    ],
    [
      answer("reply_warm", "warm", ["deu:+1"], [trust("DEU", 1)]),
      answer(
        "reply_cold",
        "cold",
        ["deu:-1", "berlin:-1"],
        [trust("DEU", -1), inst("berlin", -1)],
      ),
    ],
    { scheduledOnly: true, salience: 7 },
  ),
  letter(
    "auh_letter_w4",
    "DEU",
    [v("hard", hard), v("wary", wary), v("sly", sly), base],
    [
      answer("reply_warm", "warm", [], []),
      answer("reply_cold", "cold", [], []),
    ],
    { when: all(seenScene("auh_letter_w3"), over), salience: 7 },
  ),
  letter(
    "auh_letter_n1",
    "RUS",
    [
      v("alive", not({ kind: "opening", of: ["sarajevo"] })),
      v("hard", hard),
      v("wary", wary),
      v("sly", sly),
      base,
    ],
    [
      answer(
        "reply_warm",
        "warm",
        ["rus:+1"],
        [trust("RUS", 1), schedule("auh_letter_n2", 2)],
      ),
      answer(
        "reply_cold",
        "cold",
        ["rus:-1"],
        [trust("RUS", -1), schedule("auh_letter_n2", 2)],
      ),
    ],
    { when: { kind: "chapter", min: 1, max: 2 } },
  ),
  letter(
    "auh_letter_n2",
    "RUS",
    [
      v("cold", letters("cold")),
      v("hard", hard),
      v("wary", wary),
      v("sly", sly),
      base,
    ],
    [
      answer(
        "reply_warm",
        "warm",
        ["rus:+1", "temp:-1"],
        [trust("RUS", 1), temp(-1), schedule("auh_letter_n3", 5)],
      ),
      answer(
        "reply_cold",
        "cold",
        ["temp:+1"],
        [temp(1), schedule("auh_letter_n3", 5)],
      ),
    ],
    { scheduledOnly: true, salience: 7 },
  ),
  letter(
    "auh_letter_n3",
    "RUS",
    [
      v("peace", not(theirWar)),
      v("hard", hard),
      v("wary", wary),
      v("sly", sly),
      base,
    ],
    [
      answer("reply_warm", "warm", ["morale:-1"], [gauge("morale", -1)]),
      answer("reply_cold", "cold", [], []),
    ],
    { scheduledOnly: true },
  ),
  letter(
    "auh_letter_n4",
    "RUS",
    [v("war", theirWar), v("hard", hard), v("wary", wary), base],
    [
      answer("reply_warm", "warm", ["rus:+1"], [trust("RUS", 1)]),
      answer("reply_cold", "cold", [], []),
    ],
    { when: all(seenScene("auh_letter_n3"), over), salience: 7 },
  ),
];

// ---- 목표가 묻는 때 ----

const press = (
  id: string,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  options: GwOption[],
  tags: GwScene["tags"],
): GwScene => ({
  id,
  nation: NATION,
  kind: "dispute",
  when,
  cast,
  salience: 7,
  tags,
  once: true,
  variants: [v("holding", metAim), base],
  fallback: options[0].id,
  options,
});

const AIM_SCENES: GwScene[] = [
  press(
    "auh_m_serbia",
    all(
      aim("auh_aim_serbia"),
      atWar("SRB"),
      atWar("RUS"),
      world({ is: "war_months", own: true, min: 2 }),
    ),
    { cos: holder("chief_of_staff") },
    [
      opt(
        "keep_south",
        ["cos:-1", "morale:-1"],
        [trustOf(cos, -1), gauge("morale", -1)],
      ),
      opt(
        "send_north",
        ["cos:+1"],
        [trustOf(cos, 1), force("east", 1), setFlag("f_auh_aim_bent")],
      ),
    ],
    ["war"],
  ),
  press(
    "auh_m_crown",
    all(aim("auh_aim_crown"), world({ is: "war_months", min: 10 })),
    { pm: holder("hun_pm"), court: holder("court") },
    [
      opt("no_promise", ["hun_pm:-1"], [trustOf(pm, -1)]),
      opt(
        "give_word",
        ["hungary:+1", "nations:-1"],
        [inst("hungary", 1), inst("nations", -1), setFlag("f_auh_aim_bent")],
      ),
    ],
    ["home"],
  ),
  press(
    "auh_m_peace",
    all(
      aim("auh_aim_peace"),
      inWar,
      world({ is: "war_months", own: true, min: 10 }),
    ),
    { fm: holder("foreign"), cos: holder("chief_of_staff") },
    [
      opt(
        "hear_them",
        ["deu:-1", "army:-1"],
        [trust("DEU", -1), inst("army", -1)],
      ),
      opt("not_yet", ["cos:+1"], [trustOf(cos, 1), setFlag("f_auh_aim_bent")]),
    ],
    ["foreign"],
  ),
  press(
    "auh_m_own",
    all(
      aim("auh_aim_own"),
      inWar,
      world({ is: "war_months", own: true, min: 5 }),
    ),
    { cos: holder("chief_of_staff") },
    [
      opt(
        "refuse",
        ["deu:-1", "morale:-1"],
        [trust("DEU", -1), gauge("morale", -1)],
      ),
      opt(
        "take_them",
        ["berlin:+1"],
        [inst("berlin", 1), force("east", 1), setFlag("f_auh_aim_bent")],
      ),
    ],
    ["war"],
  ),
  press(
    "auh_m_nations",
    all(
      aim("auh_aim_nations"),
      inWar,
      world({ is: "war_months", own: true, min: 5 }),
    ),
    { chan: holder("chancellor"), cos: holder("chief_of_staff") },
    [
      opt(
        "civil_courts",
        ["army:-1", "cos:-1"],
        [inst("army", -1), trustOf(cos, -1)],
      ),
      opt(
        "army_courts",
        ["nations:-1", "order:+1"],
        [inst("nations", -1), gauge("order", 1), setFlag("f_auh_aim_bent")],
      ),
    ],
    ["home"],
  ),
  press(
    "auh_m_bread",
    all(
      aim("auh_aim_bread"),
      inWar,
      world({ is: "war_months", own: true, min: 10 }),
    ),
    { chan: holder("chancellor"), fm: holder("foreign") },
    [
      opt(
        "keep_grain",
        ["deu:-1", "shells:-1"],
        [trust("DEU", -1), gauge("shells", -1)],
      ),
      opt(
        "send_grain",
        ["bread:-1", "shells:+1"],
        [gauge("bread", -1), gauge("shells", 1), setFlag("f_auh_aim_bent")],
      ),
    ],
    ["home"],
  ),
];

/** The aim bent twice over: the court says so, once. */
const AIM_REMINDER: GwScene = {
  id: "auh_m_reminder",
  nation: NATION,
  kind: "report",
  when: all(flag("f_auh_aim_bent"), world({ is: "war_months", min: 29 })),
  cast: {},
  salience: 5,
  tags: ["people"],
  once: true,
  stamp: "confirmed",
  source: "own_eyes",
  variants: [
    v("serbia", aim("auh_aim_serbia")),
    v("crown", aim("auh_aim_crown")),
    v("peace", aim("auh_aim_peace")),
    v("own", aim("auh_aim_own")),
    v("nations", aim("auh_aim_nations")),
    base,
  ],
};

/** The opening, the big scenes, the rival, the letters, the aim's pressure. */
export const AUH_STORY_SCENES: readonly GwScene[] = [
  ...OPENING_SCENES,
  ...BIG_SCENES,
  ...SILENT_SCENES,
  ISCHL_LINE,
  ...RIVAL_SCENES,
  ...LETTERS,
  ...AIM_SCENES,
  AIM_REMINDER,
];
