import type {
  GwGauge,
  GwStage,
  GwTemperament,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  byName,
  chose,
  flag,
  GwCond,
  GwEffect,
  GwNode,
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
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Germany 1915-18, the front share: the `deu_f_` scenes, the summoned talks of
 * Falkenhayn, Hindenburg, Ludendorff and Bauer, and five visits. Data only; the
 * text is in resources/ww1914/ko/DEU.front.json. Plan: ww135-plan-deu.md
 * sections 1, 6, 10, 11, 12.
 *
 * The verbs here are 풀어 주기 and 묶기: every army paper can be signed as it
 * stands or bound with a condition. The monthly `deu_f_ledger` signs without
 * `army:+1`, or its 48 signatures would fill the scale by themselves; the big
 * papers carry it.
 *
 * Stand-ins, each one definition to swap when the world lane lands:
 * `date` (`world({ is: "date", from, to })`, on w135-world), `tech`
 * (`{ is: "tech" }`), `soviet` (`{ is: "regime", tag: "RUS", of: ["soviet"] }`),
 * `signChief` (`{ do: "sign_chief" }`, on w130-gw) and `FRONTS_SCREEN`
 * (`{ screen: "fronts" }`, on w130-gw), `f_talks_asked` (`{ do: "talks" }`).
 */

const NATION: GwScene["nation"] = ["DEU"];
const WAR: GwStage[] = ["war"];

const who = role("who");
const cos = role("cos");
const war_ = role("war");
const chancellor = role("chancellor");
const court = role("court");
const envoy = role("envoy");
const foreign = role("foreign");

const FALK = byName("deu_falkenhayn");
const HIND = byName("deu_hindenburg");
const LUD = byName("deu_ludendorff");
const HEIR = byName("deu_heir");
const KUHL = byName("deu_kuhlmann");
const MOLTKE = byName("deu_moltke");

// ---- Stand-ins ----

const monthly: GwCond = { kind: "span", max: 30 };
const bimonthly: GwCond = { kind: "span", min: 31 };
const monthOf = (d: string): number =>
  (Number(d.slice(0, 4)) - 1915) * 12 + Number(d.slice(5, 7)) - 1;

/** The game's date, both ends included: "YYYY-MM", on `full` and `standard`. */
const date = (from: string, to: string): GwCond => {
  const a = monthOf(from);
  const b = monthOf(to);
  return any(
    all(monthly, { kind: "chapter", min: 11 + a, max: 11 + b }),
    all(bimonthly, {
      kind: "chapter",
      min: 11 + Math.floor(a / 2),
      max: 11 + Math.floor(b / 2),
    }),
  );
};
/** Research reached: for now the month the plan's tech can first be there. */
const tech = (from: string): GwCond => date(from, "1918-12");
const soviet: GwCond = date("1917-11", "1918-12");
const signChief: GwEffect[] = [];
const FRONTS_SCREEN = {};

// ---- States ----

const war: GwCond = world({ is: "war" });
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const west1: GwCond = world({ is: "plan", of: ["west"] });
const east1: GwCond = world({ is: "plan", of: ["east"] });
const ohl3: GwCond = flag("f_third_ohl");
/** The two men, not Groener in Ludendorff's place. */
const pair3: GwCond = all(ohl3, not(flag("f_groener_qm")));
const rusout: GwCond = world({ is: "out", tag: "RUS" });
const usin: GwCond = world({ is: "entered", tag: "USA", side: "entente" });
const auhIn: GwCond = not(world({ is: "out", tag: "AUH" }));
const italyIn: GwCond = world({ is: "entered", tag: "ITA", side: "entente" });
const romaniaIn: GwCond = world({ is: "entered", tag: "ROU" });
const bulgariaIn: GwCond = world({ is: "entered", tag: "BGR" });
const serbiaOut: GwCond = world({ is: "out", tag: "SRB" });
const score = (max: number): GwCond => world({ is: "score", max });
const scoreUp = (min: number): GwCond => world({ is: "score", min });
const men_ = (max: number): GwCond => world({ is: "manpower", max });
const front = (theatre: GwTheatre, from: string): GwCond =>
  world({ is: "front", theatre, from });
const low = (g: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
const armyMax = (max: number): GwCond => ({ kind: "inst", inst: "army", max });
const armyMin = (min: number): GwCond => ({ kind: "inst", inst: "army", min });
const chiefIs = (person: string): GwCond => ({
  kind: "holder",
  office: "chief_of_staff",
  person,
});
const trusts = (w: GwWho, min: number): GwCond => ({
  kind: "person_trust",
  who: w,
  min,
});
const known = (...keys: string[]): GwCond => any(...keys.map((k) => memory(k)));
const lately = (key: string, within: number): GwCond => ({
  kind: "memory",
  key,
  within,
});
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
/** Wins over variants that ask less: three more leaves. */
const first = (c: GwCond): GwCond => all(c, war, war, war);

// ---- Effects ----

const army = (delta: number): GwEffect => ({
  kind: "inst",
  inst: "army",
  delta,
});
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const ally = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const pride = (w: GwWho, delta: number): GwEffect => ({
  kind: "pride",
  who: w,
  delta,
});
const force = (theatre: GwTheatre, delta: number): GwEffect =>
  doWorld({ do: "force", tag: "DEU", theatre, delta });
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });
const command = (w: GwWho, theatre: GwTheatre): GwEffect =>
  doWorld({ do: "command", who: w, theatre });
const appointChief = (w: GwWho): GwEffect => ({
  kind: "appoint",
  who: w,
  office: "chief_of_staff",
});

// ---- Shapes ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

const o = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): NonNullable<GwScene["options"]>[number] =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

const scene = (
  s: Omit<GwScene, "nation" | "once" | "stage"> & { once?: boolean },
): GwScene => ({
  nation: NATION,
  stage: WAR,
  ...s,
  once: s.once ?? true,
});

/** A record card: no option, no price, no feeling. */
const record = (
  id: string,
  when: GwCond,
  variants: GwVariant[],
  source: "staff" | "press",
): GwScene =>
  scene({
    id,
    kind: "report",
    when,
    cast: {},
    salience: 3,
    tags: ["war"],
    stamp: "confirmed",
    source,
    variants,
  });

// ---- Talks ----

const T = (delta: number): GwEffect => trustOf(who, delta);
const key = (k: string): GwEffect => remember(k);
/** Stand-in for `{ do: "reveal", id }`: the plan's secrets come in later. */
const reveal = (id: string): GwEffect => remember(`m_${id}`);

/** The line said here: one for each temperament named, then the base. */
const moods = (...of: GwTemperament[]): GwVariant[] => [
  ...of.map((t) => v(t, moody(who, t))),
  v("base"),
];

interface ReplyMore {
  tell?: string[];
  effects?: GwEffect[];
  when?: GwCond;
  reacts?: GwReact[];
  gain?: GwEffect[];
  miss?: string | null;
}

const r = (
  id: string,
  stance: GwStance,
  kind: GwReplyKind,
  next: string | null,
  more: ReplyMore = {},
): GwReply => ({
  id,
  stance,
  kind,
  tell: more.tell ?? [],
  effects: more.effects ?? [],
  next,
  ...(more.when === undefined ? {} : { when: more.when }),
  ...(more.reacts === undefined ? {} : { reacts: more.reacts }),
  ...(more.gain === undefined ? {} : { gain: more.gain }),
  ...(more.miss === undefined ? {} : { miss: more.miss }),
});
const bye = (id = "end", stance: GwStance = "cold"): GwReply =>
  r(id, stance, "leave", null);
const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const plain = (...replies: GwReply[]): GwNode => node([v("base")], ...replies);

const ifMood = (
  next: string | null,
  effects: GwEffect[],
  ...of: GwTemperament[]
): GwReact => ({ when: moody(who, ...of), next, effects });
const ifTrust = (
  min: number,
  next: string | null,
  effects: GwEffect[],
): GwReact => ({ when: trusts(who, min), next, effects });
const ifCold = (next: string | null, effects: GwEffect[] = []): GwReact => ({
  when: { kind: "person_trust", who, max: -2 },
  next,
  effects,
});

const talkBase = (
  id: string,
  person: string,
  when: GwCond,
  nodes: Record<string, GwNode>,
) => ({
  id,
  nation: NATION,
  kind: "talk" as const,
  stage: WAR,
  when,
  cast: { who: { person } },
  tags: ["people" as const],
  who: "who",
  variants: [v("base")],
  start: "open",
  nodes,
  once: true,
});

/** A topic on the people screen. */
const talk = (
  id: string,
  person: string,
  when: GwCond,
  nodes: Record<string, GwNode>,
): GwScene => ({
  ...talkBase(id, person, when, nodes),
  salience: 1,
  summon: true,
});

/** Someone comes to the desk. */
const visit = (
  id: string,
  person: string,
  when: GwCond,
  salience: number,
  nodes: Record<string, GwNode>,
): GwScene => ({
  ...talkBase(id, person, when, nodes),
  salience,
});

export const DEU_FRONT_SCENES: readonly GwScene[] = [
  // ---- The month's paper ----
  scene({
    id: "deu_f_ledger",
    kind: "ledger",
    when: all(war, date("1915-01", "1918-12")),
    cast: { cos: holder("chief_of_staff") },
    salience: 9,
    tags: ["war"],
    once: false,
    cooldown: 1,
    variants: [
      v("lost", first(score(-25))),
      v("storm", all(date("1918-01", "1918-12"), scoreUp(-24), war)),
      v("pair", all(pair3, date("1916-09", "1917-12"))),
      v("depth", all(date("1917-01", "1917-12"), war)),
      v("material", all(date("1916-01", "1916-12"), war)),
      v(
        "returned",
        all(
          date("1915-01", "1915-06"),
          known(
            "m_returned_aug",
            "m_returned_sep",
            "m_returned_oct",
            "m_returned_nov",
            "m_returned_dec",
          ),
          war,
        ),
      ),
      v("thin", all(low("shells", 1), war)),
      v("base"),
    ],
    fallback: "sign_chief",
    options: [
      o("sign_chief", ["trust:+1"], [...signChief, trustOf(cos, 1)]),
      {
        ...o(
          "return_chief",
          ["trust:-1", "army:-1"],
          [trustOf(cos, -1), army(-1), remember("m_returned_late")],
          armyMax(3),
        ),
        ...FRONTS_SCREEN,
      },
      o(
        "bind_chief",
        ["army:-1", "authority:+1", "trust:-1"],
        [
          ...signChief,
          army(-1),
          authority(1),
          trustOf(cos, -1),
          remember("m_bound_chief"),
          reason("f_ledger_bound"),
        ],
        all(
          known("k_beth_terms", "k_muller_terms", "k_rupp_view"),
          not(lately("m_bound_chief", 3)),
        ),
      ),
    ],
  }),

  // ---- 1915: east or west ----
  scene({
    id: "deu_f_east_or_west",
    kind: "dispute",
    when: all(
      war,
      atWar("RUS"),
      date("1915-01", "1915-06"),
      not(flag("f_ew_settled")),
    ),
    cast: { cos: holder("chief_of_staff"), war: holder("war") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("chief_east", first(chiefIs("deu_hindenburg"))),
      v("pair", all(known("m_east_pair", "m_pair_sent"), war)),
      v("east_plan", all(east1, war)),
      v("base"),
    ],
    fallback: "back_chief",
    options: [
      o(
        "back_chief",
        ["army:+1", "trust:+1"],
        [
          army(1),
          trustOf(cos, 1),
          trustOf(HIND, -1),
          force("west", 1),
          setFlag("f_ew_settled"),
          setFlag("f_ew_west"),
          keepPromise(FALK, "falk_seat"),
          reason("f_ew_west"),
        ],
      ),
      o(
        "back_east",
        ["army:+1", "trust:-1"],
        [
          army(1),
          trustOf(cos, -1),
          trustOf(HIND, 1),
          force("east", 1),
          setFlag("f_ew_settled"),
          setFlag("f_ew_east"),
          reason("f_ew_east"),
        ],
      ),
      o(
        "split",
        ["shells:-1", "authority:+1"],
        [
          gauge("shells", -1),
          authority(1),
          force("west", 1),
          force("east", 1),
          setFlag("f_ew_settled"),
          setFlag("f_ew_split"),
          reason("f_ew_split"),
        ],
        memory("k_falk_two_fronts"),
      ),
      o(
        "east_with_leash",
        ["army:-1", "authority:+1"],
        [
          army(-1),
          authority(1),
          force("east", 1),
          trustOf(HIND, 1),
          setFlag("f_ew_settled"),
          setFlag("f_ew_east"),
          setFlag("f_east_leash"),
          reason("f_ew_leash"),
        ],
        memory("k_hind_east_price"),
      ),
    ],
  }),
  scene({
    id: "deu_f_ober_ost_letter",
    kind: "audience",
    when: all(
      chose("deu_f_east_or_west", "back_chief"),
      date("1915-01", "1915-09"),
    ),
    cast: { cos: holder("chief_of_staff"), court: holder("court") },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: [
      v("pair", all(known("m_east_pair", "m_pair_sent"), war)),
      v("seat", all({ kind: "promise", who: FALK, key: "falk_seat" }, war)),
      v("base"),
    ],
    fallback: "keep_pair",
    options: [
      o(
        "keep_pair",
        ["army:+1", "trust:-1"],
        [army(1), trustOf(cos, -1), trustOf(HIND, 1), reason("f_letter_kept")],
      ),
      o(
        "move_lud",
        ["trust:+1", "morale:-1"],
        [
          trustOf(cos, 1),
          trustOf(LUD, -2),
          trustOf(HIND, -2),
          gauge("morale", -1),
          setFlag("f_lud_south"),
          reason("f_letter_moved"),
        ],
      ),
      o(
        "accept_letter",
        ["morale:-2", "authority:+2", "leaves"],
        [
          gauge("morale", -2),
          authority(2),
          { kind: "dismiss", who: HIND },
          trustOf(LUD, -2),
          setFlag("f_hind_sent_home"),
          reason("f_letter_accepted"),
        ],
      ),
      o(
        "heal_rift",
        ["authority:+1"],
        [
          authority(1),
          trustOf(HIND, 1),
          setFlag("f_rift_healed"),
          reason("f_letter_healed"),
        ],
        memory("k_hoff_rift"),
      ),
    ],
  }),
  record(
    "deu_f_gas_record",
    all(
      war,
      front("west", "liege"),
      tech("1915-04"),
      date("1915-04", "1915-12"),
    ),
    [v("base")],
    "staff",
  ),
  scene({
    id: "deu_f_gorlice",
    kind: "proposal",
    when: all(war, atWar("RUS"), auhIn, date("1915-03", "1915-09"), {
      kind: "gauge",
      gauge: "shells",
      min: 2,
    }),
    cast: { cos: holder("chief_of_staff") },
    salience: 8,
    tags: ["war"],
    variants: [
      v("east_won", all(flag("f_ew_east"), war)),
      v("vienna_low", all({ kind: "trust", tag: "AUH", max: 0 }, war)),
      v("base"),
    ],
    fallback: "mackensen",
    options: [
      o(
        "mackensen",
        ["army:+1", "ally:+1"],
        [
          army(1),
          ally("AUH", 1),
          force("east", 1),
          command(byName("deu_mackensen"), "east"),
          reason("f_gorlice_mackensen"),
        ],
      ),
      o(
        "ober_ost",
        ["army:+1", "trust:+1"],
        [
          army(1),
          force("east", 1),
          trustOf(HIND, 1),
          command(HIND, "east"),
          keepPromise(HIND, "p_hind_name"),
          reason("f_gorlice_ober_ost"),
        ],
      ),
      o(
        "conrad_leads",
        ["army:-1", "ally:+2"],
        [
          army(-1),
          ally("AUH", 2),
          force("east", 1),
          setFlag("f_conrad_led"),
          reason("f_gorlice_conrad"),
        ],
        memory("k_vienna_face"),
      ),
      o(
        "two_fronts_short",
        ["army:-1", "ally:-1"],
        [
          army(-1),
          ally("AUH", -1),
          force("west", 1),
          reason("f_gorlice_short"),
        ],
      ),
    ],
  }),
  scene({
    id: "deu_f_warsaw_falls",
    kind: "report",
    when: all(war, front("east", "warsaw"), date("1915-01", "1916-06")),
    cast: {},
    salience: 6,
    tags: ["war", "tension_down"],
    stamp: "confirmed",
    source: "staff",
    variants: [
      v("mackensen", all(chose("deu_f_gorlice", "mackensen"), war)),
      v("base"),
    ],
  }),
  scene({
    id: "deu_f_serbia_road",
    kind: "proposal",
    when: all(bulgariaIn, not(serbiaOut), date("1915-07", "1915-12")),
    cast: {
      cos: holder("chief_of_staff"),
      envoy: holder("ambassador_vienna"),
    },
    salience: 7,
    tags: ["war"],
    variants: [
      v(
        "straits_low",
        all({ kind: "seen", scene: "deu_f_straits_shells" }, war),
      ),
      v("thin", all(low("shells", 1), war)),
      v("base"),
    ],
    fallback: "german_lead",
    options: [
      o(
        "german_lead",
        ["army:+1", "ally:-1"],
        [
          army(1),
          ally("AUH", -1),
          force("balkan", 2),
          command(byName("deu_mackensen"), "balkan"),
          reason("f_serbia_german"),
        ],
      ),
      o(
        "vienna_lead",
        ["ally:+1"],
        [ally("AUH", 1), force("balkan", 1), reason("f_serbia_vienna")],
      ),
      o(
        "wait_spring",
        ["ally:-1"],
        [ally("OTT", -1), ally("BGR", -1), reason("f_serbia_wait")],
      ),
      o(
        "bulgaria_price",
        ["money:-1", "ally:+1"],
        [
          gauge("money", -1),
          ally("BGR", 2),
          force("balkan", 2),
          reason("f_serbia_bulgaria"),
        ],
        memory("k_zimm_sofia"),
      ),
    ],
  }),
  scene({
    id: "deu_f_straits_shells",
    kind: "proposal",
    when: all(
      world({ is: "open", theatre: "straits" }),
      flag("f_ottoman_signed"),
      date("1915-01", "1915-12"),
    ),
    cast: { cos: holder("chief_of_staff"), foreign: holder("foreign") },
    salience: 6,
    tags: ["foreign"],
    variants: [v("narrows", all(front("straits", "narrows"), war)), v("base")],
    fallback: "words_only",
    options: [
      o(
        "words_only",
        ["ally:-1"],
        [ally("OTT", -1), reason("f_straits_words")],
      ),
      o(
        "smuggle",
        ["money:-1", "ally:+1"],
        [
          gauge("money", -1),
          ally("OTT", 1),
          ally("ROU", -1),
          reason("f_straits_smuggle"),
        ],
      ),
      o(
        "serbia_first",
        ["army:+1", "ally:+1"],
        [
          army(1),
          ally("OTT", 1),
          force("balkan", 1),
          setFlag("f_serbia_road_first"),
          reason("f_straits_serbia"),
        ],
        memory("k_falk_two_fronts"),
      ),
    ],
  }),
  scene({
    id: "deu_f_east1_year",
    kind: "proposal",
    when: all(war, east1, date("1915-01", "1915-12")),
    cast: { cos: holder("chief_of_staff"), foreign: holder("foreign") },
    salience: 8,
    tags: ["war"],
    variants: [
      v("britain_out", all(not(atWar("GBR")), war)),
      v(
        "alsace",
        all(atWar("FRA"), { kind: "gauge", gauge: "morale", min: 3 }),
      ),
      v("base"),
    ],
    fallback: "push_east",
    options: [
      o(
        "push_east",
        ["army:+1"],
        [army(1), force("east", 1), reason("f_east1_push")],
      ),
      o(
        "offer_paris2",
        ["army:-1", "authority:+1"],
        [
          army(-1),
          authority(1),
          ally("FRA", 1),
          setFlag("f_offered_paris"),
          reason("f_east1_paris"),
        ],
        memory("k_kuhl_paris"),
      ),
      o(
        "turn_west",
        ["army:+1", "trust:-1"],
        [
          army(1),
          trustOf(cos, -1),
          force("west", 1),
          force("east", -1),
          reason("f_east1_turn"),
        ],
      ),
    ],
  }),

  // ---- 1916: Verdun, the Somme, the two men ----
  scene({
    id: "deu_f_verdun_plan",
    kind: "crisis",
    when: all(
      war,
      west1,
      atWar("FRA"),
      date("1915-10", "1916-06"),
      world({
        is: "battle",
        theatre: "west",
        of: ["stalemate", "repelled", "quiet"],
      }),
    ),
    cast: { cos: holder("chief_of_staff"), war: holder("war") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("falk", first(chiefIs("deu_falkenhayn"))),
      v("hind", first(chiefIs("deu_hindenburg"))),
      v("moltke_east", all(memory("m_moltke_said_east"), war, war)),
      v("thin", all(low("shells", 1), war)),
      v("base"),
    ],
    fallback: "sign_major",
    options: [
      o(
        "sign_major",
        ["army:+1", "manpower:-4", "shells:-1"],
        [
          army(1),
          men(-4),
          gauge("shells", -1),
          force("west", 2),
          setFlag("f_verdun"),
          setFlag("f_verdun_major"),
          reason("f_verdun_major"),
        ],
      ),
      o(
        "sign_limited",
        ["manpower:-2"],
        [
          men(-2),
          force("west", 1),
          setFlag("f_verdun"),
          reason("f_verdun_limited"),
        ],
      ),
      o(
        "east_instead",
        ["trust:-1", "army:-1"],
        [trustOf(cos, -1), army(-1), force("east", 2), reason("f_verdun_east")],
        memory("k_hind_east_price"),
      ),
      o(
        "cap_by_months",
        ["army:-1", "authority:+1", "manpower:-2"],
        [
          army(-1),
          authority(1),
          men(-2),
          force("west", 1),
          setFlag("f_verdun"),
          setFlag("f_verdun_cap"),
          reason("f_verdun_cap"),
        ],
        memory("k_falk_bleed"),
      ),
      o(
        "heir_chooses",
        ["manpower:-3", "heir:+1", "trust:-1"],
        [
          men(-3),
          trustOf(HEIR, 2),
          trustOf(cos, -1),
          force("west", 1),
          setFlag("f_verdun"),
          setFlag("f_verdun_heir"),
          keepPromise(HEIR, "heir_after"),
          reason("f_verdun_heir"),
        ],
        memory("k_heir_verdun"),
      ),
    ],
  }),
  scene({
    id: "deu_f_verdun_third_month",
    kind: "dispute",
    when: all(
      flag("f_verdun"),
      date("1916-03", "1916-12"),
      world({ is: "battle", theatre: "west", of: ["stalemate", "repelled"] }),
    ),
    cast: { cos: holder("chief_of_staff"), heir: { person: "deu_heir" } },
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      v("cap", all(flag("f_verdun_cap"), war, war)),
      v("heir_own", all(flag("f_verdun_heir"), war, war)),
      v("base"),
    ],
    fallback: "go_on",
    options: [
      o(
        "go_on",
        ["army:+1", "manpower:-4", "morale:-1"],
        [army(1), men(-4), gauge("morale", -1), reason("f_third_go_on")],
      ),
      o(
        "stop_now",
        ["army:-1", "heir:+1", "authority:+1"],
        [
          army(-1),
          authority(1),
          trustOf(HEIR, 1),
          trustOf(cos, -1),
          setFlag("f_verdun_stopped"),
          reason("f_third_stop"),
        ],
        memory("k_heir_stop"),
      ),
      o(
        "guns_only",
        ["shells:-1", "manpower:-1"],
        [gauge("shells", -1), men(-1), reason("f_third_guns")],
        memory("k_bauer_guns"),
      ),
      o(
        "ask_rupprecht",
        ["army:-1", "authority:+1", "trust:-1"],
        [
          army(-1),
          authority(1),
          trustOf(cos, -1),
          trustOf(byName("deu_rupprecht"), 1),
          setFlag("f_verdun_stopped"),
          reason("f_third_rupp"),
        ],
        memory("k_rupp_view"),
      ),
    ],
  }),
  scene({
    id: "deu_f_somme_doctrine",
    kind: "proposal",
    when: all(war, atWar("GBR"), date("1916-06", "1916-12")),
    cast: { cos: holder("chief_of_staff") },
    salience: 8,
    tags: ["war"],
    variants: [
      v("pair", pair3),
      v("verdun", all(flag("f_verdun"), war)),
      v("base"),
    ],
    fallback: "hold_first_line",
    options: [
      o(
        "hold_first_line",
        ["army:+1", "manpower:-3"],
        [army(1), men(-3), force("west", 1), reason("f_somme_hold")],
      ),
      o(
        "depth",
        ["army:-1", "manpower:-1"],
        [
          army(-1),
          men(-1),
          force("west", 1),
          setFlag("f_depth"),
          reason("f_somme_depth"),
        ],
        memory("k_lud_depth"),
      ),
      o(
        "generals_choose",
        ["manpower:-2", "trust:-1"],
        [men(-2), trustOf(cos, -1), reason("f_somme_generals")],
      ),
    ],
  }),
  scene({
    id: "deu_f_brusilov_help",
    kind: "proposal",
    when: all(
      war,
      atWar("RUS"),
      auhIn,
      date("1916-03", "1916-12"),
      world({ is: "battle", theatre: "east", of: ["break", "advance"] }),
    ),
    cast: {
      cos: holder("chief_of_staff"),
      envoy: holder("ambassador_vienna"),
    },
    salience: 8,
    tags: ["foreign", "tension_up"],
    variants: [
      v("verdun", all(flag("f_verdun"), war, war)),
      v("vienna_low", all({ kind: "trust", tag: "AUH", max: 0 }, war)),
      v("base"),
    ],
    fallback: "corps_as_asked",
    options: [
      o(
        "corps_as_asked",
        ["ally:+1", "manpower:-2"],
        [
          ally("AUH", 1),
          men(-2),
          force("east", 1),
          force("west", -1),
          reason("f_brusilov_corps"),
        ],
      ),
      o(
        "corps_for_command",
        ["army:+1", "ally:-1", "manpower:-2"],
        [
          army(1),
          ally("AUH", -1),
          men(-2),
          force("east", 2),
          force("west", -1),
          setFlag("f_joint_command"),
          reason("f_brusilov_command"),
        ],
        memory("k_hind_unified"),
      ),
      o(
        "words_only",
        ["ally:-2"],
        [ally("AUH", -2), reason("f_brusilov_words")],
      ),
    ],
  }),
  scene({
    id: "deu_f_romania_in",
    kind: "report",
    when: all(romaniaIn, date("1916-01", "1917-06")),
    cast: {},
    salience: 8,
    tags: ["foreign", "tension_up"],
    stamp: "confirmed",
    source: "embassy_vienna",
    variants: [v("falk", all(chiefIs("deu_falkenhayn"), war)), v("base")],
  }),
  scene({
    id: "deu_f_third_ohl",
    kind: "crisis",
    when: all(
      chiefIs("deu_falkenhayn"),
      any(romaniaIn, seen("deu_f_verdun_third_month")),
      not(flag("f_third_ohl")),
      date("1916-02", "1917-03"),
    ),
    cast: {
      chancellor: holder("chancellor"),
      cos: holder("chief_of_staff"),
      court: holder("court"),
    },
    salience: 9,
    tags: ["people", "tension_up"],
    variants: [
      v("romania", all(romaniaIn, war, war)),
      v("pair", all(known("m_east_pair", "m_pair_sent"), war)),
      v("verdun", all(flag("f_verdun_major"), war)),
      v("thin", all(low("morale", 2), war)),
      v("base"),
    ],
    fallback: "call_pair",
    options: [
      o(
        "keep_chief",
        ["army:-1", "trust:+1", "morale:-1"],
        [
          army(-1),
          trustOf(cos, 1),
          gauge("morale", -1),
          keepPromise(FALK, "p_falk_command"),
          reason("f_ohl_kept"),
        ],
      ),
      o(
        "call_pair",
        ["army:+2", "morale:+1", "trust:-2"],
        [
          army(2),
          gauge("morale", 1),
          trustOf(cos, -2),
          appointChief(HIND),
          command(LUD, "west"),
          setFlag("f_third_ohl"),
          keepPromise(HIND, "p_hind_name"),
          reason("f_ohl_pair"),
        ],
      ),
      o(
        "pair_with_terms",
        ["army:+1", "morale:+1", "authority:+1", "trust:-2"],
        [
          army(1),
          gauge("morale", 1),
          authority(1),
          trustOf(cos, -2),
          appointChief(HIND),
          command(LUD, "west"),
          setFlag("f_third_ohl"),
          setFlag("f_ohl_terms"),
          keepPromise(HIND, "p_hind_name"),
          reason("f_ohl_terms"),
        ],
        known("k_beth_terms", "k_muller_terms"),
      ),
      o(
        "groener_quartermaster",
        ["army:+1", "authority:+1", "trust:-2"],
        [
          army(1),
          authority(1),
          trustOf(cos, -2),
          trustOf(LUD, -2),
          appointChief(HIND),
          setFlag("f_third_ohl"),
          setFlag("f_groener_qm"),
          keepPromise(HIND, "p_hind_name"),
          reason("f_ohl_groener"),
        ],
        memory("k_groe_rails"),
      ),
      o(
        "mackensen_instead",
        ["army:-1", "authority:+1", "morale:-1", "trust:-1"],
        [
          army(-1),
          authority(1),
          gauge("morale", -1),
          trustOf(cos, -1),
          trustOf(HIND, -2),
          appointChief(byName("deu_mackensen")),
          reason("f_ohl_mackensen"),
        ],
        any(memory("k_vienna_face"), chose("deu_f_gorlice", "mackensen")),
      ),
    ],
  }),
  scene({
    id: "deu_f_unified_command",
    kind: "proposal",
    when: all(
      war,
      atWar("RUS"),
      auhIn,
      not(flag("f_joint_command")),
      { kind: "trust", tag: "AUH", max: 1 },
      date("1916-07", "1916-11"),
    ),
    cast: {
      cos: holder("chief_of_staff"),
      envoy: holder("ambassador_vienna"),
    },
    salience: 7,
    tags: ["foreign"],
    variants: [v("romania", all(romaniaIn, war)), v("base")],
    fallback: "ask_gently",
    options: [
      o(
        "ask_gently",
        ["ally:-1"],
        [
          ally("AUH", -1),
          setFlag("f_joint_command"),
          reason("f_unified_gently"),
        ],
      ),
      o(
        "demand",
        ["army:+1", "ally:-2"],
        [
          army(1),
          ally("AUH", -2),
          force("east", 1),
          setFlag("f_joint_command"),
          reason("f_unified_demand"),
        ],
        memory("k_hind_unified"),
      ),
      o("leave_it", ["trust:-1"], [trustOf(cos, -1), reason("f_unified_left")]),
    ],
  }),
  scene({
    id: "deu_f_withdraw_line",
    kind: "proposal",
    when: all(
      war,
      any(ohl3, men_(45)),
      date("1916-09", "1917-06"),
      front("west", "somme"),
    ),
    cast: { cos: holder("chief_of_staff") },
    salience: 7,
    tags: ["war", "tension_down"],
    variants: [v("pair", pair3), v("base")],
    fallback: "withdraw",
    options: [
      o(
        "withdraw",
        ["army:+1", "manpower:+2", "morale:-1"],
        [
          army(1),
          men(2),
          gauge("morale", -1),
          setFlag("f_line_withdrawn"),
          reason("f_withdraw"),
        ],
      ),
      o(
        "hold_ground",
        ["army:-1", "manpower:-3", "trust:-1"],
        [army(-1), men(-3), trustOf(cos, -1), reason("f_withdraw_hold")],
      ),
      o(
        "partial",
        ["army:-1", "manpower:+1", "authority:+1"],
        [
          army(-1),
          men(1),
          authority(1),
          setFlag("f_line_withdrawn"),
          reason("f_withdraw_partial"),
        ],
        any(memory("k_rupp_view"), memory("k_falk_after")),
      ),
    ],
  }),
  record(
    "deu_f_occupation_record",
    all(war, date("1916-10", "1917-06"), atWar("BEL")),
    [v("line", flag("f_line_withdrawn")), v("base")],
    "press",
  ),

  // ---- 1917: Italy, new arms, the last plan ----
  scene({
    id: "deu_f_italy_corps",
    kind: "proposal",
    when: all(italyIn, auhIn, date("1917-07", "1917-12")),
    cast: {
      cos: holder("chief_of_staff"),
      envoy: holder("ambassador_vienna"),
    },
    salience: 7,
    tags: ["foreign"],
    variants: [
      v("rus_out", all(rusout, war)),
      v("vienna_low", all({ kind: "trust", tag: "AUH", max: 0 }, war)),
      v("base"),
    ],
    fallback: "send_corps",
    options: [
      o(
        "send_corps",
        ["army:+1", "ally:+1", "manpower:-1"],
        [
          army(1),
          ally("AUH", 1),
          men(-1),
          force("italy", 2),
          force("west", -1),
          reason("f_italy_sent"),
        ],
      ),
      o("refuse", ["ally:-2"], [ally("AUH", -2), reason("f_italy_refused")]),
      o(
        "send_with_lead",
        ["army:+1", "ally:-1", "manpower:-1"],
        [
          army(1),
          ally("AUH", -1),
          men(-1),
          force("italy", 3),
          force("west", -1),
          reason("f_italy_lead"),
        ],
        memory("k_hind_unified"),
      ),
    ],
  }),
  scene({
    id: "deu_f_new_arms",
    kind: "proposal",
    when: all(war, tech("1916-10"), date("1916-10", "1918-06")),
    cast: { cos: holder("chief_of_staff"), war: holder("war") },
    salience: 7,
    tags: ["war"],
    once: false,
    cooldown: 6,
    variants: [
      v("spring", all(date("1918-01", "1918-06"), war)),
      v("cambrai", all(date("1917-11", "1917-12"), war)),
      v("schools", all(date("1917-01", "1917-10"), war)),
      v("base"),
    ],
    fallback: "school_first",
    options: [
      o(
        "school_first",
        ["army:+1", "manpower:-1"],
        [army(1), men(-1), force("west", 1), reason("f_arms_school")],
      ),
      o(
        "tank_programme",
        ["army:-1", "money:-1"],
        [
          army(-1),
          gauge("money", -1),
          setFlag("f_tanks_ordered"),
          reason("f_arms_tanks"),
        ],
        memory("k_groe_numbers"),
      ),
      o(
        "guns_first",
        ["shells:+1", "money:-1"],
        [gauge("shells", 1), gauge("money", -1), reason("f_arms_guns")],
        memory("k_bauer_guns"),
      ),
    ],
  }),
  scene({
    id: "deu_f_spring_plan",
    kind: "crisis",
    when: all(
      atWar("FRA"),
      any(rusout, date("1918-01", "1918-06")),
      date("1917-07", "1918-06"),
    ),
    cast: { cos: holder("chief_of_staff"), chancellor: holder("chancellor") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("no_east", all(not(rusout), war, war)),
      v("no_america", all(not(usin), war, war)),
      v("pair", all(pair3, usin)),
      v("thin", all(low("bread", 1), low("shells", 1))),
      v("base"),
    ],
    fallback: "michael",
    options: [
      o(
        "michael",
        ["army:+1", "manpower:-5", "shells:-1"],
        [
          army(1),
          men(-5),
          gauge("shells", -1),
          force("west", 3),
          setFlag("f_spring"),
          setFlag("f_spring_michael"),
          reason("f_spring_michael"),
        ],
      ),
      o(
        "flanders",
        ["army:+1", "manpower:-4", "shells:-1"],
        [
          army(1),
          men(-4),
          gauge("shells", -1),
          force("west", 2),
          setFlag("f_spring"),
          setFlag("f_spring_flanders"),
          reason("f_spring_flanders"),
        ],
      ),
      o(
        "one_blow_then_talk",
        ["army:-1", "authority:+1", "manpower:-3"],
        [
          army(-1),
          authority(1),
          men(-3),
          force("west", 2),
          setFlag("f_spring"),
          setFlag("f_spring_one_blow"),
          reason("f_spring_one_blow"),
        ],
        known("k_kuhl_arms", "k_rupp_view"),
      ),
      o(
        "stand_and_talk",
        ["army:-2", "authority:+2", "trust:-2"],
        [
          army(-2),
          authority(2),
          trustOf(cos, -2),
          setFlag("f_spring_stood"),
          setFlag("f_talks_asked"),
          reason("f_spring_stand"),
        ],
        known("k_groe_truth", "k_falk_after"),
      ),
      o(
        "stop_line",
        ["army:-1", "authority:+1", "manpower:-4"],
        [
          army(-1),
          authority(1),
          men(-4),
          force("west", 3),
          setFlag("f_spring"),
          setFlag("f_spring_stop_line"),
          reason("f_spring_stop_line"),
        ],
        memory("k_lud_spring"),
      ),
    ],
  }),
  scene({
    id: "deu_f_east_garrison",
    kind: "proposal",
    when: all(rusout, front("east", "warsaw"), date("1918-01", "1918-08")),
    cast: { cos: holder("chief_of_staff"), foreign: holder("foreign") },
    salience: 7,
    tags: ["war"],
    variants: [
      v("spring", all(flag("f_spring"), war)),
      v("bread", all(low("bread", 1), war)),
      v("base"),
    ],
    fallback: "strip_east",
    options: [
      o(
        "strip_east",
        ["army:+1", "bread:-1"],
        [
          army(1),
          gauge("bread", -1),
          force("west", 2),
          force("east", -2),
          reason("f_garrison_strip"),
        ],
      ),
      o(
        "keep_east",
        ["bread:+1", "trust:-1"],
        [gauge("bread", 1), trustOf(cos, -1), reason("f_garrison_keep")],
      ),
      o(
        "half",
        ["authority:+1"],
        [
          authority(1),
          force("west", 1),
          force("east", -1),
          reason("f_garrison_half"),
        ],
        memory("k_hoff_home"),
      ),
    ],
  }),
  scene({
    id: "deu_f_offensive_month",
    kind: "dispute",
    when: all(flag("f_spring"), date("1918-03", "1918-10"), atWar("FRA")),
    cast: { cos: holder("chief_of_staff"), chancellor: holder("chancellor") },
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      v("near", all(front("west", "marne"), war, war)),
      v("one_blow", all(flag("f_spring_one_blow"), war)),
      v("base"),
    ],
    fallback: "next_blow",
    options: [
      o(
        "next_blow",
        ["army:+1", "manpower:-4", "morale:-1"],
        [
          army(1),
          men(-4),
          gauge("morale", -1),
          force("west", 1),
          reason("f_month_next"),
        ],
      ),
      o(
        "stop_and_dig",
        ["army:-1", "authority:+1", "trust:-1"],
        [
          army(-1),
          authority(1),
          trustOf(cos, -1),
          setFlag("f_spring_dug_in"),
          keepPromise(KUHL, "p_kuhl_speech"),
          reason("f_month_dig"),
        ],
        memory("k_rupp_view"),
      ),
      o(
        "stop_at_line",
        ["army:-1", "authority:+1", "manpower:-1"],
        [
          army(-1),
          authority(1),
          men(-1),
          setFlag("f_spring_dug_in"),
          reason("f_month_line"),
        ],
        memory("k_lud_spring"),
      ),
    ],
  }),
  scene({
    id: "deu_f_last_classes",
    kind: "proposal",
    when: all(war, men_(25), date("1917-07", "1918-12")),
    cast: { war: holder("war"), cos: holder("chief_of_staff") },
    salience: 8,
    tags: ["home"],
    once: false,
    cooldown: 6,
    variants: [
      v("boys", all(date("1918-06", "1918-12"), war)),
      v("wounded", all(date("1918-01", "1918-05"), war)),
      v("base"),
    ],
    fallback: "call_class",
    options: [
      o(
        "call_class",
        ["army:+1", "manpower:+4", "morale:-1"],
        [army(1), men(4), gauge("morale", -1), reason("f_classes_call")],
      ),
      o(
        "comb_factories",
        ["manpower:+3", "shells:-1", "army:-1"],
        [men(3), gauge("shells", -1), army(-1), reason("f_classes_comb")],
        memory("k_groe_numbers"),
      ),
      o(
        "disband_divisions",
        ["manpower:+2", "trust:-1"],
        [
          men(2),
          trustOf(cos, -1),
          force("west", -1),
          reason("f_classes_disband"),
        ],
      ),
    ],
  }),
  scene({
    id: "deu_f_black_day",
    kind: "crisis",
    when: all(
      world({
        is: "battle",
        theatre: "west",
        of: ["break", "advance", "repelled"],
      }),
      score(-15),
      usin,
      date("1918-06", "1918-12"),
    ),
    cast: { cos: holder("chief_of_staff"), chancellor: holder("chancellor") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("spring_lost", all(flag("f_spring_michael"), war, war)),
      v("dug_in", all(flag("f_spring_dug_in"), war, war)),
      v("thin", all(low("morale", 1), war)),
      v("base"),
    ],
    fallback: "hold_line",
    options: [
      o(
        "hold_line",
        ["army:+1", "manpower:-3", "morale:-1"],
        [army(1), men(-3), gauge("morale", -1), reason("f_black_hold")],
      ),
      o(
        "talks_now",
        ["army:-1", "authority:+1"],
        [
          army(-1),
          authority(1),
          setFlag("f_talks_asked"),
          setFlag("f_black_talks"),
          reason("f_black_talks"),
        ],
        known("k_hind_truth", "k_groe_truth"),
      ),
      o(
        "order_retreat",
        ["manpower:+1", "morale:-1", "trust:-1"],
        [
          men(1),
          gauge("morale", -1),
          trustOf(cos, -1),
          setFlag("f_black_retreat"),
          reason("f_black_retreat"),
        ],
      ),
      o(
        "change_chief",
        ["army:-2", "authority:+1", "leaves"],
        [
          army(-2),
          authority(1),
          { kind: "dismiss", who: cos },
          setFlag("f_black_chief_gone"),
          reason("f_black_chief"),
        ],
        armyMax(3),
      ),
    ],
  }),
  scene({
    id: "deu_f_lists_late",
    kind: "report",
    when: all(
      war,
      world({ is: "casualties", min: 300 }),
      date("1915-01", "1918-12"),
    ),
    cast: {},
    salience: 6,
    tags: ["home", "tension_up"],
    once: false,
    cooldown: 5,
    stamp: "confirmed",
    source: "press",
    variants: [
      v("y18", all(date("1918-01", "1918-12"), war)),
      v("y17", all(date("1917-01", "1917-12"), war)),
      v("y16b", all(date("1916-07", "1916-12"), war)),
      v("y16a", all(date("1916-01", "1916-06"), war)),
      v("base"),
    ],
  }),
  scene({
    id: "deu_f_lettow_wire",
    kind: "report",
    when: all(
      war,
      world({ is: "open", theatre: "colonies" }),
      date("1916-01", "1918-12"),
    ),
    cast: {},
    salience: 3,
    tags: ["war", "tension_down"],
    once: false,
    cooldown: 10,
    stamp: "estimate",
    source: "agents",
    variants: [v("airship", all(date("1917-10", "1918-12"), war)), v("base")],
  }),
  scene({
    id: "deu_f_paris_in_range",
    kind: "crisis",
    when: all(front("west", "marne"), atWar("FRA"), date("1915-07", "1918-12")),
    cast: { cos: holder("chief_of_staff"), chancellor: holder("chancellor") },
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      v("spring", all(flag("f_spring"), war, war)),
      v("britain_out", all(not(atWar("GBR")), war)),
      v("base"),
    ],
    fallback: "press_on",
    options: [
      o(
        "press_on",
        ["army:+1", "manpower:-4"],
        [army(1), men(-4), force("west", 2), reason("f_paris_press")],
      ),
      o(
        "dictate",
        ["army:-1", "authority:+1"],
        [
          army(-1),
          authority(1),
          setFlag("f_paris_dictated"),
          setFlag("f_talks_asked"),
          reason("f_paris_dictate"),
        ],
        memory("k_beth_terms"),
      ),
      o(
        "stop_and_offer",
        ["army:-1", "authority:+1", "trust:-1"],
        [
          army(-1),
          authority(1),
          trustOf(cos, -1),
          ally("FRA", 1),
          setFlag("f_paris_offered"),
          setFlag("f_talks_asked"),
          reason("f_paris_offer"),
        ],
        memory("k_kuhl_paris"),
      ),
    ],
  }),
  // ---- Falkenhayn ----
  talk(
    "deu_t2_falk_two_fronts",
    "deu_falkenhayn",
    all(war, date("1915-01", "1915-06")),
    {
      open: node(
        moods("cold", "arrogant"),
        r("ask", "frank", "ask", "why", {
          gain: [key("k_falk_two_fronts")],
          miss: "evade",
        }),
        r("push", "cold", "push", "numbers", {
          reacts: [ifMood("bristle", [T(-1), pride(who, 1)], "arrogant")],
        }),
        r("deal", "flatter", "deal", "why", {
          tell: ["trust:+1"],
          effects: [T(1), key("k_falk_two_fronts")],
          reacts: [ifMood("evade", [T(-1)], "cold", "cunning")],
        }),
        bye("leave", "warm"),
      ),
      why: plain(r("sum", "frank", "ask", "numbers"), bye("end", "cold")),
      numbers: plain(
        r("keep", "frank", "deal", null, {
          tell: ["trust:+1"],
          effects: [T(1), key("k_falk_two_fronts")],
        }),
        bye("end", "cold"),
      ),
      evade: plain(r("again", "warm", "ask", "numbers"), bye("end", "cold")),
      bristle: plain(
        r("calm", "warm", "ask", "numbers", {
          tell: ["trust:+1"],
          effects: [T(1)],
        }),
        bye("end", "cold"),
      ),
    },
  ),
  talk(
    "deu_t2_falk_bleed",
    "deu_falkenhayn",
    all(chiefIs("deu_falkenhayn"), date("1915-07", "1916-06")),
    {
      open: node(
        moods("cunning", "cold"),
        r("ask", "cold", "ask", "ratio", {
          reacts: [ifCold("closed")],
        }),
        r("push", "threat", "push", "land", {
          tell: ["trust:-1"],
          effects: [T(-1)],
          gain: [key("k_falk_bleed")],
          miss: "closed",
        }),
        r("deal", "frank", "deal", "cap", {
          tell: ["army:-1"],
          effects: [army(-1), key("k_falk_bleed")],
          reacts: [
            ifMood("sneer", [army(-1), key("k_falk_bleed")], "arrogant"),
          ],
        }),
        bye("leave", "cold"),
      ),
      ratio: node(
        [
          v("strong", {
            kind: "strength",
            tag: "FRA",
            theatre: "west",
            min: 4,
          }),
          v("base"),
        ],
        r("land", "frank", "ask", "land"),
        bye("end", "cold"),
      ),
      land: plain(
        r("key", "cold", "deal", null, {
          effects: [key("k_falk_bleed")],
        }),
        bye("end", "warm"),
      ),
      cap: plain(bye("end", "frank")),
      sneer: plain(bye("end", "cold")),
      closed: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_falk_russia",
    "deu_falkenhayn",
    all(atWar("RUS"), date("1915-01", "1916-06")),
    {
      open: node(
        moods("cunning"),
        r("ask", "frank", "ask", "cut", {
          reacts: [ifTrust(2, "plain_said", [key("k_falk_russia")])],
          miss: "turn",
        }),
        r("push", "cold", "push", "chancellor"),
        r("deal", "warm", "deal", "stockholm", {
          tell: ["trust:+1"],
          effects: [T(1)],
        }),
        bye("leave", "cold"),
      ),
      cut: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_falk_russia")],
        }),
        r("doubt", "cold", "ask", "stockholm"),
      ),
      chancellor: plain(r("then", "frank", "ask", "cut"), bye("end", "cold")),
      stockholm: plain(
        r("key", "warm", "deal", null, {
          tell: ["trust:+1"],
          effects: [T(1), key("k_falk_russia")],
        }),
        bye("end", "cold"),
      ),
      turn: plain(r("again", "warm", "ask", "stockholm"), bye("end", "cold")),
      plain_said: plain(bye("end", "warm")),
    },
  ),
  talk(
    "deu_t2_falk_wild",
    "deu_falkenhayn",
    all(
      any(
        { kind: "office_empty", office: "war" },
        { kind: "holder", office: "war", person: "deu_wild" },
      ),
      date("1915-01", "1915-12"),
    ),
    {
      open: node(
        moods("arrogant"),
        r("ask", "cold", "ask", "man"),
        r("push", "cold", "push", "hats", {
          reacts: [ifMood("bristle", [T(-1)], "arrogant")],
        }),
        r("deal", "frank", "deal", "promise", {
          tell: ["trust:+1"],
          effects: [
            T(1),
            promise(who, "p_falk_ministry", 4, {
              keep: { kind: "holder", office: "war", person: "deu_wild" },
            }),
          ],
        }),
        bye("leave", "warm"),
      ),
      man: node(
        [
          v(
            "good",
            world({
              is: "competence",
              who: { person: "deu_wild" },
              field: "admin",
              min: 3,
            }),
          ),
          v("base"),
        ],
        r("keep", "frank", "deal", "promise", {
          tell: ["trust:+1"],
          effects: [
            T(1),
            promise(who, "p_falk_ministry", 4, {
              keep: { kind: "holder", office: "war", person: "deu_wild" },
            }),
          ],
        }),
        bye("end", "cold"),
      ),
      hats: plain(r("then", "frank", "ask", "man"), bye("end", "cold")),
      bristle: plain(r("calm", "warm", "ask", "man"), bye("end", "cold")),
      promise: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_falk_pair",
    "deu_falkenhayn",
    all(chiefIs("deu_falkenhayn"), not(ohl3), date("1916-01", "1916-12")),
    {
      open: node(
        moods("cold", "cunning"),
        r("ask", "frank", "ask", "them", {
          miss: "evade",
        }),
        r("push", "threat", "push", "letter", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "warm", "deal", "promised", {
          tell: ["trust:+1"],
          effects: [
            T(1),
            promise(who, "p_falk_command", 6, {
              back: "deu_t2_falk_after",
            }),
          ],
        }),
        bye("leave", "cold"),
      ),
      them: node(
        [
          v("nerves", {
            kind: "health",
            who: { person: "deu_ludendorff" },
            max: 2,
          }),
          v("base"),
        ],
        r("deal", "frank", "deal", "promised", {
          tell: ["trust:+1"],
          effects: [
            T(1),
            promise(who, "p_falk_command", 6, {
              back: "deu_t2_falk_after",
            }),
          ],
        }),
        bye("end", "cold"),
      ),
      letter: plain(r("then", "cold", "ask", "them"), bye("end", "cold")),
      evade: plain(bye("end", "cold")),
      promised: plain(bye("end", "warm")),
    },
  ),
  talk(
    "deu_t2_falk_after",
    "deu_falkenhayn",
    all(not(chiefIs("deu_falkenhayn")), date("1916-07", "1918-12")),
    {
      open: node(
        [
          v("broken", {
            kind: "promise",
            who,
            key: "p_falk_command",
            broken: true,
          }),
          v("far", date("1917-07", "1918-12")),
          ...moods("arrogant"),
        ],
        r("ask", "frank", "ask", "heir_to", {
          gain: [key("k_falk_after")],
          miss: "polite",
        }),
        r("push", "cold", "push", "weak"),
        r("deal", "warm", "deal", "post", {
          tell: ["trust:+1"],
          effects: [T(1), key("k_falk_after")],
        }),
        bye("leave", "warm"),
      ),
      heir_to: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_falk_after")],
        }),
        r("weak", "cold", "ask", "weak"),
      ),
      weak: node(
        [
          v("lud_low", {
            kind: "health",
            who: { person: "deu_ludendorff" },
            max: 2,
          }),
          v("base"),
        ],
        r("keep", "cold", "deal", null, {
          effects: [remember("m_falk_on_pair")],
        }),
        bye("end", "cold"),
      ),
      post: plain(bye("end", "warm")),
      polite: plain(bye("end", "cold")),
    },
  ),

  // ---- Hindenburg ----
  talk(
    "deu_t2_hind_east_price",
    "deu_hindenburg",
    all(atWar("RUS"), date("1915-01", "1915-06")),
    {
      open: node(
        moods("stubborn"),
        r("ask", "frank", "ask", "price", {
          gain: [key("k_hind_east_price")],
          reacts: [ifCold("closed")],
        }),
        r("push", "threat", "push", "firm", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "flatter", "deal", "half", {
          tell: ["trust:+1"],
          effects: [T(1), pride(who, 1)],
        }),
        bye("leave", "cold"),
      ),
      price: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_hind_east_price")],
        }),
        bye("end", "cold"),
      ),
      firm: plain(r("then", "cold", "ask", "price"), bye("end", "cold")),
      half: plain(
        r("key", "warm", "deal", null, {
          effects: [key("k_hind_east_price")],
        }),
        bye("end", "cold"),
      ),
      closed: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_hind_name",
    "deu_hindenburg",
    all(war, date("1915-03", "1916-06")),
    {
      open: node(
        moods("cold"),
        r("ask", "warm", "ask", "nails"),
        r("push", "cold", "push", "whose", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "flatter", "deal", "promised", {
          tell: ["trust:+1"],
          effects: [T(1), pride(who, 1), promise(who, "p_hind_name", 8)],
        }),
        bye("leave", "warm"),
      ),
      nails: node(
        [v("low", low("morale", 2)), v("base")],
        r("deal", "frank", "deal", "promised", {
          tell: ["trust:+1"],
          effects: [T(1), promise(who, "p_hind_name", 8)],
        }),
        bye("end", "warm"),
      ),
      whose: plain(r("then", "warm", "ask", "nails"), bye("end", "cold")),
      promised: plain(bye("end", "warm")),
    },
  ),
  talk(
    "deu_t2_hind_unified",
    "deu_hindenburg",
    all(atWar("RUS"), auhIn, date("1916-01", "1917-12")),
    {
      open: node(
        moods("stubborn"),
        r("ask", "cold", "ask", "hand", {
          gain: [key("k_hind_unified")],
        }),
        r("push", "cold", "push", "signed", {
          reacts: [ifMood("hand", [key("k_hind_unified")], "cold")],
        }),
        r("deal", "warm", "deal", "vienna", {
          tell: ["ally:-1"],
          effects: [ally("AUH", -1), key("k_hind_unified")],
        }),
        bye("leave", "cold"),
      ),
      hand: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_hind_unified")],
        }),
        bye("end", "cold"),
      ),
      signed: plain(r("then", "frank", "ask", "hand"), bye("end", "cold")),
      vienna: plain(bye("end", "warm")),
    },
  ),
  talk(
    "deu_t2_hind_who_signs",
    "deu_hindenburg",
    all(ohl3, date("1916-09", "1917-12")),
    {
      open: node(
        moods("cold", "stubborn"),
        r("ask", "frank", "ask", "knows", {
          miss: "wall",
        }),
        r("push", "threat", "push", "wall", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "warm", "deal", "door", {
          tell: ["audiences:+1"],
          effects: [{ kind: "audiences", delta: 1 }, remember("m_hind_door")],
        }),
        bye("leave", "cold"),
      ),
      knows: node(
        [
          v(
            "little",
            all(world({ is: "competence", who, field: "war", max: 2 }), war),
          ),
          v("base"),
        ],
        r("door", "warm", "deal", "door", {
          tell: ["audiences:+1"],
          effects: [{ kind: "audiences", delta: 1 }, remember("m_hind_door")],
        }),
        bye("end", "cold"),
      ),
      wall: plain(bye("end", "cold")),
      door: plain(bye("end", "warm")),
    },
  ),
  talk(
    "deu_t2_hind_card",
    "deu_hindenburg",
    all(ohl3, armyMin(4), date("1917-01", "1917-12")),
    {
      open: node(
        moods("stubborn"),
        r("ask", "cold", "ask", "knife", {
          gain: [key("k_hind_card")],
          miss: "wall",
        }),
        r("push", "threat", "push", "letter", {
          tell: ["trust:-1"],
          effects: [T(-1), key("k_hind_card")],
          reacts: [ifMood("wall", [T(-1)], "stubborn")],
        }),
        r("deal", "frank", "deal", "old_man", {
          tell: ["trust:+1"],
          effects: [T(1), key("k_hind_card")],
        }),
        bye("leave", "cold"),
      ),
      knife: plain(
        r("key", "cold", "deal", null, {
          effects: [key("k_hind_card")],
        }),
        bye("end", "cold"),
      ),
      letter: plain(bye("end", "cold")),
      wall: plain(bye("end", "cold")),
      old_man: plain(bye("end", "warm")),
    },
  ),
  talk(
    "deu_t2_hind_truth",
    "deu_hindenburg",
    all(score(-5), date("1918-01", "1918-12")),
    {
      open: node(
        moods("cold"),
        r("ask", "frank", "ask", "said", {
          gain: [key("k_hind_truth")],
          miss: "duty",
        }),
        r("push", "cold", "push", "duty"),
        r("deal", "warm", "deal", "name", {
          tell: ["trust:+1"],
          effects: [T(1), key("k_hind_truth")],
        }),
        bye("leave", "warm"),
      ),
      said: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_hind_truth")],
        }),
        bye("end", "warm"),
      ),
      duty: plain(r("again", "frank", "ask", "said"), bye("end", "cold")),
      name: plain(bye("end", "warm")),
    },
  ),

  // ---- Ludendorff ----
  talk(
    "deu_t2_lud_depth",
    "deu_ludendorff",
    all(war, date("1916-01", "1916-12")),
    {
      open: node(
        moods("arrogant", "anxious"),
        r("ask", "cold", "ask", "empty", {
          gain: [key("k_lud_depth")],
          miss: "scorn",
        }),
        r("push", "cold", "push", "scorn"),
        r("deal", "flatter", "deal", "free", {
          tell: ["army:-1"],
          effects: [army(-1), key("k_lud_depth")],
          reacts: [
            ifMood(
              "free",
              [army(-1), key("k_lud_depth"), pride(who, 1)],
              "arrogant",
            ),
          ],
        }),
        bye("leave", "cold"),
      ),
      empty: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_lud_depth")],
        }),
        bye("end", "cold"),
      ),
      scorn: plain(r("then", "cold", "ask", "empty"), bye("end", "cold")),
      free: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_lud_poland",
    "deu_ludendorff",
    all(front("east", "warsaw"), date("1915-07", "1916-12")),
    {
      open: node(
        moods("stubborn"),
        r("ask", "frank", "ask", "numbers", {
          gain: [key("k_lud_poland")],
        }),
        r("push", "threat", "push", "vienna", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "cold", "deal", "vienna", {
          tell: ["ally:-1"],
          effects: [ally("AUH", -1), key("k_lud_poland")],
        }),
        bye("leave", "cold"),
      ),
      numbers: plain(
        r("key", "cold", "deal", null, {
          effects: [key("k_lud_poland")],
        }),
        bye("end", "cold"),
      ),
      vienna: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_lud_figures",
    "deu_ludendorff",
    all(ohl3, date("1916-09", "1917-12")),
    {
      open: node(
        moods("anxious", "arrogant"),
        r("ask", "cold", "ask", "fix", {
          miss: "angry",
        }),
        r("push", "cold", "push", "angry", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "frank", "deal", "fix", {
          tell: ["trust:+1"],
          effects: [T(1)],
        }),
        bye("leave", "warm"),
      ),
      fix: node(
        [
          v("rosy", { kind: "source_band", source: "staff", max: 2 }),
          v("base"),
        ],
        r("take", "frank", "deal", null, {
          effects: [remember("m_staff_read")],
        }),
        bye("end", "cold"),
      ),
      angry: plain(r("then", "warm", "ask", "fix"), bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_lud_aims",
    "deu_ludendorff",
    all(ohl3, date("1917-01", "1917-12")),
    {
      open: node(
        moods("arrogant"),
        r("ask", "cold", "ask", "least", {
          miss: "all",
        }),
        r("push", "threat", "push", "all", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "flatter", "deal", "promised", {
          tell: ["army:+1", "trust:+1"],
          effects: [army(1), T(1), promise(who, "p_lud_aims", 10)],
        }),
        bye("leave", "cold"),
      ),
      least: plain(
        r("deal", "frank", "deal", "promised", {
          tell: ["army:+1", "trust:+1"],
          effects: [army(1), T(1), promise(who, "p_lud_aims", 10)],
        }),
        bye("end", "cold"),
      ),
      all: plain(r("then", "cold", "ask", "least"), bye("end", "cold")),
      promised: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_lud_spring",
    "deu_ludendorff",
    all(any(rusout, date("1918-01", "1918-06")), date("1917-07", "1918-06")),
    {
      open: node(
        moods("stubborn", "anxious"),
        r("ask", "frank", "ask", "next", {
          gain: [key("k_lud_spring")],
          miss: "hole",
        }),
        r("push", "cold", "push", "hole"),
        r("deal", "warm", "deal", "line", {
          tell: ["army:-1"],
          effects: [army(-1), key("k_lud_spring")],
          reacts: [ifMood("hole", [T(-1)], "arrogant")],
        }),
        bye("leave", "cold"),
      ),
      next: plain(
        r("key", "cold", "deal", null, {
          effects: [key("k_lud_spring")],
        }),
        bye("end", "cold"),
      ),
      hole: plain(r("line", "frank", "ask", "line"), bye("end", "cold")),
      line: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_lud_spring")],
        }),
        bye("end", "cold"),
      ),
    },
  ),
  talk(
    "deu_t2_lud_nerves",
    "deu_ludendorff",
    all(score(-5), date("1918-01", "1918-12")),
    {
      open: node(
        moods("anxious", "stubborn"),
        r("ask", "warm", "ask", "man", {
          miss: "shout",
        }),
        r("push", "cold", "push", "shout", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "frank", "deal", "doctor", {
          tell: ["trust:+1"],
          effects: [
            T(1),
            promise(who, "p_lud_doctor", 2, {
              keep: not(seen("deu_k_ludendorff_out")),
            }),
          ],
        }),
        bye("leave", "warm"),
      ),
      man: node(
        [v("worn", { kind: "health", who, max: 2 }), v("base")],
        r("deal", "warm", "deal", "doctor", {
          tell: ["trust:+1"],
          effects: [
            T(1),
            promise(who, "p_lud_doctor", 2, {
              keep: not(seen("deu_k_ludendorff_out")),
            }),
          ],
        }),
        bye("end", "warm"),
      ),
      shout: plain(r("calm", "warm", "ask", "man"), bye("end", "cold")),
      doctor: plain(bye("end", "warm")),
    },
  ),

  // ---- Bauer ----
  talk("deu_t2_bauer_guns", "deu_bauer", all(war, date("1915-07", "1916-12")), {
    open: node(
      moods("arrogant"),
      r("ask", "cold", "ask", "count", {
        gain: [key("k_bauer_guns")],
      }),
      r("push", "cold", "push", "chief", {
        reacts: [ifMood("count", [key("k_bauer_guns")], "cunning")],
      }),
      r("deal", "flatter", "deal", "krupp", {
        tell: ["money:-1"],
        effects: [gauge("money", -1), key("k_bauer_guns")],
      }),
      bye("leave", "cold"),
    ),
    count: plain(
      r("key", "cold", "deal", null, {
        effects: [key("k_bauer_guns")],
      }),
      bye("end", "cold"),
    ),
    chief: plain(r("then", "cold", "ask", "count"), bye("end", "cold")),
    krupp: plain(bye("end", "cold")),
  }),
  talk(
    "deu_t2_bauer_doors",
    "deu_bauer",
    all(war, date("1916-01", "1917-06")),
    {
      open: node(
        moods("cunning"),
        r("ask", "cold", "ask", "ring", {
          gain: [reveal("deu_heir_ring")],
          miss: "smile",
        }),
        r("push", "threat", "push", "smile", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "flatter", "deal", "access", {
          tell: ["trust:+1", "countersign:-1"],
          effects: [
            T(1),
            { kind: "inst", inst: "countersign", delta: -1 },
            promise(who, "p_bauer_access", 8),
          ],
        }),
        bye("leave", "cold"),
      ),
      ring: plain(
        r("deal", "frank", "deal", "access", {
          tell: ["trust:+1", "countersign:-1"],
          effects: [
            T(1),
            { kind: "inst", inst: "countersign", delta: -1 },
            promise(who, "p_bauer_access", 8),
          ],
        }),
        bye("end", "cold"),
      ),
      smile: plain(bye("end", "cold")),
      access: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_bauer_triple",
    "deu_bauer",
    all(ohl3, date("1916-07", "1916-12")),
    {
      open: node(
        moods("arrogant", "cunning"),
        r("ask", "frank", "ask", "basis", {
          miss: "try_it",
        }),
        r("push", "cold", "push", "try_it"),
        r("deal", "flatter", "deal", "triple", {
          tell: ["army:+1"],
          effects: [army(1), key("k_bauer_triple")],
        }),
        bye("leave", "cold"),
      ),
      basis: plain(
        r("key", "cold", "deal", null, {
          effects: [key("k_bauer_triple")],
        }),
        bye("end", "cold"),
      ),
      try_it: plain(
        r("key", "cold", "deal", null, {
          effects: [key("k_bauer_triple")],
        }),
        bye("end", "cold"),
      ),
      triple: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_bauer_list",
    "deu_bauer",
    all(
      { kind: "holder", office: "chancellor", person: "deu_bethmann" },
      armyMin(4),
      date("1917-01", "1917-12"),
    ),
    {
      open: node(
        moods("cunning"),
        r("ask", "cold", "ask", "names", {
          gain: [key("k_bauer_list")],
          miss: "smile",
        }),
        r("push", "threat", "push", "smile", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "flatter", "deal", "names", {
          tell: ["countersign:-1"],
          effects: [
            { kind: "inst", inst: "countersign", delta: -1 },
            key("k_bauer_list"),
          ],
        }),
        bye("leave", "cold"),
      ),
      names: plain(
        r("key", "cold", "deal", null, {
          effects: [key("k_bauer_list")],
        }),
        bye("end", "cold"),
      ),
      smile: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_bauer_press",
    "deu_bauer",
    all(ohl3, date("1917-07", "1917-12")),
    {
      open: node(
        moods("arrogant"),
        r("ask", "cold", "ask", "papers", {
          gain: [key("k_bauer_press")],
        }),
        r("push", "threat", "push", "papers", {
          tell: ["trust:-1"],
          effects: [T(-1), key("k_bauer_press")],
        }),
        r("deal", "flatter", "deal", "soldiers", {
          tell: ["reichstag:-1"],
          effects: [
            { kind: "inst", inst: "reichstag", delta: -1 },
            key("k_bauer_press"),
          ],
        }),
        bye("leave", "cold"),
      ),
      papers: plain(bye("end", "cold")),
      soldiers: plain(bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_bauer_after",
    "deu_bauer",
    all(war, date("1917-07", "1918-12")),
    {
      open: node(
        moods("cunning"),
        r("ask", "cold", "ask", "real", {
          miss: "smile",
        }),
        r("push", "cold", "push", "smile"),
        r("deal", "frank", "deal", "groener", {
          tell: ["audiences:+1"],
          effects: [
            { kind: "audiences", delta: 1 },
            remember("m_bauer_groener"),
          ],
        }),
        bye("leave", "cold"),
      ),
      real: node(
        [v("thin", low("shells", 1)), v("base")],
        r("then", "frank", "deal", "groener", {
          tell: ["audiences:+1"],
          effects: [
            { kind: "audiences", delta: 1 },
            remember("m_bauer_groener"),
          ],
        }),
        bye("end", "cold"),
      ),
      smile: plain(bye("end", "cold")),
      groener: plain(bye("end", "cold")),
    },
  ),

  // ---- Visits ----
  visit(
    "deu_v2_hoffmann_wine",
    "deu_hoffmann",
    all(atWar("RUS"), date("1915-01", "1916-12")),
    5,
    {
      open: node(
        moods("cunning"),
        r("ask", "frank", "ask", "rift", {
          gain: [key("k_hoff_rift")],
        }),
        r("push", "cold", "push", "tale"),
        r("deal", "warm", "deal", "tale", {
          tell: ["trust:+1"],
          effects: [T(1), key("k_hoff_rift")],
        }),
        bye("leave", "cold"),
      ),
      rift: plain(
        r("rus", "cold", "ask", "russians"),
        r("key", "frank", "deal", null, {
          effects: [key("k_hoff_rift")],
        }),
      ),
      tale: plain(r("rus", "frank", "ask", "russians"), bye("end", "warm")),
      russians: node(
        [
          v("many", { kind: "strength", tag: "RUS", theatre: "east", min: 4 }),
          v("base"),
        ],
        bye("end", "warm"),
      ),
    },
  ),
  visit(
    "deu_v2_hoffmann_brest",
    "deu_hoffmann",
    all(any(rusout, soviet), date("1917-11", "1918-06")),
    6,
    {
      open: node(
        moods("arrogant"),
        r("ask", "frank", "ask", "fist", {
          gain: [key("k_hoff_home")],
        }),
        r("push", "cold", "push", "home"),
        r("deal", "warm", "deal", "home", {
          tell: ["trust:+1"],
          effects: [T(1), key("k_hoff_home")],
        }),
        bye("leave", "cold"),
      ),
      fist: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_hoff_home")],
        }),
        bye("end", "cold"),
      ),
      home: plain(bye("end", "warm")),
    },
  ),
  visit(
    "deu_v2_rupprecht_letter",
    "deu_rupprecht",
    all(war, any(low("order", 3), score(5)), date("1916-01", "1918-06")),
    6,
    {
      open: node(
        moods("weary", "cold"),
        r("ask", "frank", "ask", "view", {
          gain: [key("k_rupp_view")],
          reacts: [ifCold("polite")],
        }),
        r("push", "threat", "push", "polite", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "warm", "deal", "view", {
          tell: ["trust:+1"],
          effects: [T(1), key("k_rupp_view")],
        }),
        bye("leave", "cold"),
      ),
      view: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_rupp_view")],
        }),
        bye("end", "warm"),
      ),
      polite: plain(bye("end", "cold")),
    },
  ),
  visit(
    "deu_v2_mackensen_report",
    "deu_mackensen",
    all(
      any(seen("deu_f_gorlice"), all(auhIn, atWar("RUS"))),
      date("1915-01", "1916-12"),
    ),
    5,
    {
      open: node(
        moods("cold"),
        r("ask", "cold", "ask", "vienna", {
          gain: [key("k_vienna_face")],
        }),
        r("push", "cold", "push", "horses"),
        r("deal", "flatter", "deal", "vienna", {
          tell: ["trust:+1"],
          effects: [T(1), key("k_vienna_face")],
        }),
        bye("leave", "warm"),
      ),
      vienna: plain(
        r("key", "frank", "deal", null, {
          effects: [key("k_vienna_face")],
        }),
        bye("end", "cold"),
      ),
      horses: plain(r("then", "warm", "ask", "vienna"), bye("end", "cold")),
    },
  ),
  visit(
    "deu_v2_moltke_last",
    "deu_moltke",
    all(not(chiefIs("deu_moltke")), date("1915-01", "1916-06")),
    5,
    {
      open: node(
        [
          v("kept", memory("m_kept_moltke")),
          v("name", memory("m_moltke_in_name")),
          ...moods("weary"),
        ],
        r("ask", "warm", "ask", "letter"),
        r("push", "cold", "push", "past"),
        r("deal", "frank", "deal", "named", {
          tell: ["trust:+1"],
          effects: [T(1), keepPromise(MOLTKE, "moltke_name")],
        }),
        bye("leave", "warm"),
      ),
      letter: plain(
        r("deal", "warm", "deal", "named", {
          tell: ["trust:+1"],
          effects: [T(1), keepPromise(MOLTKE, "moltke_name")],
        }),
        bye("end", "warm"),
      ),
      past: plain(bye("end", "warm")),
      named: plain(bye("end", "warm")),
    },
  ),
];
