import {
  type GwGauge,
  type GwInstitution,
  type GwOffice,
  type GwSecret,
  type GwTemperament,
  type GwTheatre,
  gwLastLine,
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
  GwReact,
  GwReply,
  GwReplyKind,
  GwScene,
  GwStance,
  GwVariant,
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
 * Germany 1915-18, the sea and diplomacy share: the `deu_s_` scenes, the
 * summoned talks of Tirpitz, Holtzendorff, Zimmermann and Kühlmann, and five
 * visits. Data only; the text is in resources/ww1914/ko/DEU.sea.json. Plan:
 * ww135-plan-deu.md sections 7, 10, 11, 12.
 */

/** Whole months since Germany came into the war (ww170: by state, not date). */
const own = (min: number, max?: number): GwCond =>
  world(
    max === undefined
      ? { is: "war_months", own: true, min }
      : { is: "war_months", own: true, min, max },
  );
const date = (from: string, to: string): GwCond =>
  world({ is: "date", from, to });
const blockadeAt = (min: number): GwCond => world({ is: "blockade", min });
const americaAt = (range: { min?: number; max?: number }): GwCond =>
  world({ is: "america", ...range });
const russiaProvisional: GwCond = world({
  is: "regime",
  tag: "RUS",
  of: ["provisional", "rep"],
});
const russiaSoviet: GwCond = world({ is: "out", tag: "RUS" });
const noArmistice: GwCond = not(world({ is: "armistice" }));
const britainConvoys: GwCond = world({ is: "tech", tag: "GBR", id: "convoys" });
const known = (id: GwSecret): GwCond => world({ is: "known", id });
const reveal = (id: GwSecret): GwEffect => doWorld({ do: "reveal", id });
const offerTalks: GwEffect = doWorld({ do: "talks" });

// ---- Shorthand ----

const NATION: GwScene["nation"] = ["DEU"];
const WAR: GwScene["stage"] = ["war"];
const who = role("who");
const chancellor = role("chancellor");
const fm = role("fm");
const navy = role("navy");
const cos = role("cos");
const court = role("court");

const R_CHANCELLOR = holder("chancellor");
const R_FM = holder("foreign");
const R_NAVY = holder("navy");
const R_COS = holder("chief_of_staff");
const R_COURT = holder("court");
const R_VIENNA = holder("ambassador_vienna");
const R_INTERIOR = holder("interior");

const war: GwCond = world({ is: "war" });
const atGBR: GwCond = { kind: "at_war", tag: "GBR" };
const atRUS: GwCond = { kind: "at_war", tag: "RUS" };
const atFRA: GwCond = { kind: "at_war", tag: "FRA" };
const rusOut: GwCond = any(
  world({ is: "out", tag: "RUS" }),
  flag("w_russia_out"),
);
/** Russia has stopped fighting, by a revolution or otherwise. */
const russiaDone: GwCond = any(russiaSoviet, rusOut);
const usIn: GwCond = flag("w_america_in");
const linerSunk: GwCond = flag("w_liner_sunk");
const pair: GwCond = flag("f_third_ohl");
/** The war went west: an east-first game has no Belgium to bargain with. */
const belgiumHeld: GwCond = not(world({ is: "plan", of: ["east"] }));
const tied: GwCond = { kind: "inst", inst: "army", min: 4 };
const uboatMin = (min: number): GwCond => world({ is: "uboat", min });
const uboatMax = (max: number): GwCond => world({ is: "uboat", max });
const scoreMin = (min: number): GwCond => world({ is: "score", min });
const scoreMax = (max: number): GwCond => world({ is: "score", max });
const eastAt = (from: string): GwCond =>
  world({ is: "front", theatre: "east", from, to: gwLastLine("east") });
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const gaugeMax = (gauge: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const chosen = (scene: string, ...picks: string[]): GwCond =>
  any(...picks.map((p) => chose(scene, p)));
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const keys = (...k: string[]): GwCond => any(...k.map((x) => memory(x)));

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
const nation = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const america = (delta: number): GwEffect =>
  doWorld({ do: "readiness", tag: "USA", delta });
const uboat = (level: number): GwEffect => doWorld({ do: "uboat", level });
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });
const force = (tag: GwTag, theatre: GwTheatre, delta: number): GwEffect =>
  doWorld({ do: "force", tag, theatre, delta });
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

const o = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): NonNullable<GwScene["options"]>[number] =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

/** A desk scene: Germany's, of the war, dealt once unless it says otherwise. */
const scene = (
  s: Omit<GwScene, "nation" | "once"> & { once?: boolean },
): GwScene => ({
  nation: NATION,
  stage: WAR,
  ...s,
  once: s.once ?? true,
});

// ---- Talks ----

/** The line said here: one for each temperament named, then the base. */
const moods = (...of: GwTemperament[]): GwVariant[] => [
  ...of.map((t) => v(t, moody(who, t))),
  v("base"),
];
/** The straight answer and the other one. */
const straight: GwVariant[] = [v("straight", candid(who)), v("base")];

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
): GwReact => ({
  when: { kind: "person_trust", who, min },
  next,
  effects,
});
/** The door shuts on a seat that has lost them. */
const shut: GwReact = {
  when: { kind: "person_trust", who, max: -2 },
  next: "shut",
  effects: [],
};

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
): GwScene => ({ ...talkBase(id, person, when, nodes), salience });

/** A talk has only its `who`: the minister is reached by office. */
const navyMinister = (delta: number): GwEffect => ({
  kind: "person_trust",
  who: { office: "navy" },
  delta,
});

const TIRPITZ = byName("deu_tirpitz");
const HOLTZ = byName("deu_holtzendorff");
const BERN = byName("deu_bernstorff");
const CAPELLE = byName("deu_capelle");
const SCHEER = byName("deu_scheer");

export const DEU_SEA_SCENES: readonly GwScene[] = [
  // ---- 1915: the first ships ----
  scene({
    id: "deu_s_neutral_flags",
    kind: "proposal",
    when: all(
      war,
      atGBR,
      any(flag("f_zone_declared"), uboatMin(1)),
      world({ is: "war_months", own: true, min: 6, max: 17 }),
    ),
    cast: { navy: R_NAVY, fm: R_FM },
    salience: 6,
    tags: ["foreign"],
    variants: [v("zone", flag("f_zone_declared")), v("base")],
    fallback: "warn_only",
    options: [
      o(
        "warn_only",
        ["navy:-1", "america:-1"],
        [trustOf(navy, -1), america(-5)],
      ),
      o(
        "sink_all",
        ["navy:+1", "fm:-1", "america:+2", "usa:-1"],
        [
          trustOf(navy, 1),
          trustOf(fm, -1),
          america(15),
          nation("USA", -1),
          setFlag("f_sink_neutrals"),
          reason("s_sink_neutrals"),
        ],
      ),
      o(
        "list_exempt",
        ["fm:+1", "navy:-1", "america:-2"],
        [
          trustOf(fm, 1),
          trustOf(navy, -1),
          america(-10),
          setFlag("f_neutral_list"),
        ],
        memory("k_bern_line"),
      ),
    ],
  }),
  scene({
    id: "deu_s_liner",
    kind: "crisis",
    when: all(war, any(linerSunk, all(uboatMin(1), own(9, 14))), own(7, 29)),
    cast: { fm: R_FM, navy: R_NAVY, chancellor: R_CHANCELLOR },
    salience: 9,
    tags: ["foreign", "tension_up"],
    variants: [
      v("lusitania", date("1915-04", "1915-06")),
      v("warned", memory("k_bern_line")),
      v("studied", flag("f_zone_study")),
      v("base"),
    ],
    fallback: "regret",
    options: [
      o(
        "regret",
        ["america:+1", "navy:-1"],
        [america(5), trustOf(navy, -1), setFlag("f_liner_regret")],
      ),
      o(
        "justify",
        ["america:+2", "usa:-1", "morale:+1", "chancellor:-1"],
        [
          america(15),
          nation("USA", -1),
          gauge("morale", 1),
          trustOf(chancellor, -1),
          setFlag("f_liner_justified"),
          reason("s_liner_justified"),
        ],
      ),
      o(
        "offer_reparation",
        ["america:-1", "money:-1", "navy:-1", "morale:-1"],
        [
          america(-5),
          gauge("money", -1),
          gauge("morale", -1),
          trustOf(navy, -1),
          setFlag("f_liner_paid"),
        ],
        memory("k_bern_line"),
      ),
      o(
        "restrict_at_once",
        ["uboat:1", "america:-2", "chancellor:+1", "navy:-2"],
        [
          uboat(1),
          america(-10),
          trustOf(chancellor, 1),
          trustOf(navy, -2),
          setFlag("f_liner_restricted"),
        ],
        memory("k_beth_uboat"),
      ),
    ],
  }),
  scene({
    id: "deu_s_restrict_order",
    kind: "dispute",
    when: all(
      war,
      seen("deu_s_liner"),
      uboatMin(1),
      world({ is: "war_months", own: true, min: 9, max: 23 }),
    ),
    cast: { chancellor: R_CHANCELLOR, navy: R_NAVY },
    salience: 8,
    tags: ["foreign"],
    variants: [
      v("press", known("deu_tirpitz_press")),
      v("justified", flag("f_liner_justified")),
      v("base"),
    ],
    fallback: "order_quiet",
    options: [
      o(
        "order_quiet",
        ["uboat:1", "navy:-1", "america:-1"],
        [uboat(1), trustOf(navy, -1), america(-5)],
      ),
      o(
        "order_public",
        ["uboat:1", "america:-2", "navy:-2", "morale:-1", "reichstag:+1"],
        [
          uboat(1),
          america(-10),
          trustOf(navy, -2),
          gauge("morale", -1),
          reichstag(1),
          setFlag("f_order_public"),
        ],
      ),
      o(
        "refuse_order",
        ["chancellor:-2", "navy:+1", "america:+2", "countersign:-1"],
        [
          trustOf(chancellor, -2),
          trustOf(navy, 1),
          america(15),
          countersign(-1),
          keepPromise(TIRPITZ, "p_tirp_quiet"),
          reason("s_order_refused"),
        ],
      ),
      o(
        "trade_with_tirpitz",
        ["uboat:1", "america:-1", "navy:+1", "countersign:-1"],
        [
          uboat(1),
          america(-5),
          trustOf(navy, 1),
          countersign(-1),
          setFlag("f_tirp_memo_attached"),
        ],
        memory("k_tirp_line"),
      ),
    ],
  }),
  scene({
    id: "deu_s_blockade_numbers",
    kind: "report",
    when: all(
      atGBR,
      blockadeAt(3),
      world({ is: "war_months", own: true, min: 5, max: 47 }),
    ),
    cast: {},
    salience: 6,
    tags: ["home", "tension_up"],
    once: false,
    cooldown: 5,
    stamp: "confirmed",
    source: "staff",
    variants: [
      v("y15", date("1915-01", "1915-12")),
      v("y16", date("1916-01", "1916-12")),
      v("y17", date("1917-01", "1917-12")),
      v("base"),
    ],
  }),

  // ---- 1916: the fleet, the admiral, the second ship ----
  scene({
    id: "deu_s_fleet_out",
    kind: "dispute",
    when: all(
      war,
      any(atGBR, atFRA),
      world({ is: "war_months", own: true, min: 17, max: 23 }),
    ),
    cast: { navy: R_NAVY, court: R_COURT, scheer: { person: "deu_scheer" } },
    salience: 7,
    tags: ["war"],
    variants: [
      v("gbrout", not(atGBR)),
      v("kept", memory("navy_kept_cabinet")),
      v("base"),
    ],
    fallback: "let_scheer",
    options: [
      o(
        "let_scheer",
        ["army:+1", "court:-1", "morale:+1"],
        [
          army(1),
          trustOf(court, -1),
          gauge("morale", 1),
          doWorld({ do: "command", who: SCHEER, theatre: "sea" }),
          setFlag("f_scheer_fleet"),
        ],
      ),
      o(
        "hold_port",
        ["army:-1", "court:+1", "morale:-1"],
        [
          army(-1),
          trustOf(court, 1),
          gauge("morale", -1),
          reason("s_fleet_held"),
        ],
      ),
      o(
        "sortie_with_limit",
        ["court:+1", "authority:+1"],
        [
          trustOf(court, 1),
          authority(1),
          doWorld({ do: "command", who: SCHEER, theatre: "sea" }),
          setFlag("f_scheer_fleet"),
          setFlag("f_sortie_limit"),
        ],
        memory("k_muller_fleet"),
      ),
    ],
  }),
  scene({
    id: "deu_s_jutland",
    kind: "report",
    when: all(
      war,
      chosen("deu_s_fleet_out", "let_scheer", "sortie_with_limit"),
      world({ is: "war_months", own: true, min: 18, max: 29 }),
    ),
    cast: {},
    salience: 8,
    tags: ["war", "tension_down"],
    stamp: "unconfirmed",
    source: "press",
    variants: [
      v("limit", chose("deu_s_fleet_out", "sortie_with_limit")),
      // ww180: the British were told the fleet was out (NavalIntel).
      v("met", world({ is: "naval", can: "met" })),
      v("gbrout", not(atGBR)),
      v("base"),
    ],
  }),
  scene({
    id: "deu_s_sussex",
    kind: "crisis",
    when: all(
      war,
      uboatMin(1),
      americaAt({ min: 15 }),
      world({ is: "war_months", own: true, min: 19, max: 25 }),
    ),
    cast: { chancellor: R_CHANCELLOR, navy: R_NAVY },
    salience: 8,
    tags: ["foreign", "tension_up"],
    variants: [
      v("no_order", chose("deu_s_restrict_order", "refuse_order")),
      v("public", flag("f_order_public")),
      v("base"),
    ],
    fallback: "give_pledge",
    options: [
      o(
        "give_pledge",
        ["uboat:0", "america:-2", "navy:-2", "army:-1"],
        [
          uboat(0),
          america(-15),
          trustOf(navy, -2),
          army(-1),
          setFlag("f_sussex_pledge"),
        ],
      ),
      o(
        "conditional_pledge",
        ["uboat:0", "america:-1", "navy:-1", "fm:+1"],
        [
          uboat(0),
          america(-8),
          trustOf(navy, -1),
          setFlag("f_sussex_pledge"),
          setFlag("f_pledge_conditional"),
        ],
        memory("k_bern_wilson"),
      ),
      o(
        "defy",
        ["america:+3", "usa:-2", "navy:+1", "chancellor:-2"],
        [
          america(25),
          nation("USA", -2),
          trustOf(navy, 1),
          trustOf(chancellor, -2),
          setFlag("f_sussex_defied"),
          reason("s_sussex_defied"),
        ],
      ),
    ],
  }),
  scene({
    id: "deu_s_tirpitz_goes",
    kind: "audience",
    when: all(
      holds("navy", "deu_tirpitz"),
      any(
        seen("deu_s_restrict_order"),
        memory("broke_p_tirp_uboat_seat"),
        memory("m_tirp_letter_known"),
      ),
      world({ is: "war_months", min: 14, max: 25 }),
    ),
    cast: { navy: R_NAVY, court: R_COURT },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: [
      v("broken", memory("broke_p_tirp_uboat_seat")),
      v("kept", memory("k_tirp_kept")),
      v("base"),
    ],
    fallback: "accept",
    options: [
      o(
        "accept",
        ["leaves", "morale:-1", "army:-1", "court:+1"],
        [
          { kind: "appoint", who: CAPELLE, office: "navy" },
          gauge("morale", -1),
          army(-1),
          trustOf(court, 1),
          keepPromise(HOLTZ, "p_holtz_navy"),
          setFlag("f_tirpitz_gone"),
          reason("s_tirpitz_left"),
        ],
      ),
      o(
        "refuse_letter",
        ["trust:+1", "chancellor:-1", "countersign:-1"],
        [
          trustOf(navy, 1),
          { kind: "person_trust", who: { office: "chancellor" }, delta: -1 },
          countersign(-1),
          keepPromise(TIRPITZ, "p_tirp_uboat_seat"),
          remember("k_tirp_kept"),
        ],
      ),
      o(
        "trade_seat",
        ["army:+1", "countersign:-1", "promise"],
        [
          army(1),
          countersign(-1),
          keepPromise(TIRPITZ, "p_tirp_uboat_seat"),
          setFlag("f_tirp_at_table"),
        ],
        memory("k_tirp_stay"),
      ),
      o(
        "send_to_press",
        ["leaves", "court:+1", "authority:+1"],
        [
          { kind: "appoint", who: CAPELLE, office: "navy" },
          trustOf(court, 1),
          authority(1),
          keepPromise(HOLTZ, "p_holtz_navy"),
          setFlag("f_tirpitz_gone"),
          setFlag("f_tirpitz_quiet"),
          reason("s_tirpitz_left"),
        ],
        memory("k_muller_heir"),
      ),
    ],
  }),
  scene({
    id: "deu_s_wilson_mediation",
    kind: "proposal",
    when: all(
      atGBR,
      belgiumHeld,
      not(usIn),
      americaAt({ max: 60 }),
      world({ is: "war_months", own: true, min: 17, max: 29 }),
    ),
    cast: { fm: R_FM, chancellor: R_CHANCELLOR },
    salience: 7,
    tags: ["foreign", "tension_down"],
    variants: [
      v("house", date("1916-01", "1916-03")),
      v("election", date("1916-09", "1916-12")),
      v("base"),
    ],
    fallback: "polite_no",
    options: [
      o("polite_no", ["america:+1", "fm:-1"], [america(5), trustOf(fm, -1)]),
      o(
        "say_belgium",
        ["america:-2", "army:-1", "reichstag:+1", "cos:-1"],
        [
          america(-15),
          army(-1),
          reichstag(1),
          {
            kind: "person_trust",
            who: { office: "chief_of_staff" },
            delta: -1,
          },
          setFlag("f_belgium_said"),
        ],
        memory("k_erz_belgium"),
      ),
      o(
        "secret_terms",
        ["america:-2", "fm:+1"],
        [america(-12), trustOf(fm, 1), setFlag("f_secret_terms")],
        memory("k_bern_wilson"),
      ),
    ],
  }),

  // ---- The table and the signature ----
  scene({
    id: "deu_s_table",
    kind: "report",
    when: all(
      atGBR,
      blockadeAt(5),
      world({ is: "war_months", own: true, min: 24, max: 30 }),
    ),
    cast: { holtz: { person: "deu_holtzendorff" } },
    salience: 7,
    tags: ["foreign", "tension_up"],
    stamp: "estimate",
    source: "staff",
    variants: [v("hungry", gaugeMax("bread", 1)), v("pair", pair), v("base")],
  }),
  scene({
    id: "deu_s_pless",
    kind: "crisis",
    when: all(
      atGBR,
      uboatMax(1),
      any(seen("deu_s_table"), tied),
      world({ is: "war_months", own: true, min: 24, max: 41 }),
    ),
    cast: { chancellor: R_CHANCELLOR, navy: R_NAVY, cos: R_COS },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: false,
    cooldown: 5,
    variants: [
      v("doubted", known("deu_table_wrong")),
      v("again", seen("deu_s_pless")),
      v("defied", flag("f_sussex_defied")),
      v("hungry", gaugeMax("bread", 1)),
      v("pair", pair),
      v("base"),
    ],
    fallback: "not_yet",
    options: [
      o(
        "not_yet",
        ["navy:-1", "cos:-1", "army:-1", "chancellor:+1"],
        [
          trustOf(navy, -1),
          trustOf(cos, -1),
          army(-1),
          trustOf(chancellor, 1),
          keepPromise({ person: "deu_bethmann" }, "p_beth_pless"),
          keepPromise({ person: "deu_ballin" }, "p_ballin_ear"),
          setFlag("f_pless_refused"),
        ],
      ),
      o(
        "sign",
        ["uboat:2", "america:+3", "army:+1", "countersign:-2", "chancellor:-2"],
        [
          uboat(2),
          america(30),
          army(1),
          countersign(-2),
          trustOf(chancellor, -2),
          trustOf(navy, 1),
          trustOf(cos, 1),
          keepPromise(TIRPITZ, "tirp_uboats"),
          keepPromise(TIRPITZ, "p_tirp_uboat_seat"),
          setFlag("f_pless_signed"),
          reason("s_pless_signed"),
        ],
      ),
      o(
        "sign_with_zones",
        ["uboat:2", "america:+2", "countersign:-1", "authority:+1"],
        [
          uboat(2),
          america(20),
          countersign(-1),
          authority(1),
          trustOf(navy, 1),
          keepPromise(TIRPITZ, "tirp_uboats"),
          keepPromise(TIRPITZ, "p_tirp_uboat_seat"),
          setFlag("f_pless_signed"),
          setFlag("f_pless_zones"),
        ],
        memory("k_holtz_neutrals"),
      ),
      o(
        "wait_for_wilson",
        ["army:-1", "cos:-1", "america:-1"],
        [
          army(-1),
          trustOf(cos, -1),
          america(-5),
          keepPromise({ person: "deu_bethmann" }, "p_beth_pless"),
          keepPromise(BERN, "p_bern_time"),
          setFlag("f_pless_refused"),
        ],
        keys("k_bern_wilson", "k_helf_no"),
      ),
      o(
        "ask_doubts",
        ["navy:-1", "authority:+1"],
        [
          trustOf(navy, -1),
          authority(1),
          reveal("deu_table_wrong"),
          reason("s_table_asked"),
        ],
        memory("k_holtz_table"),
      ),
    ],
  }),
  scene({
    id: "deu_s_peace_note",
    kind: "crisis",
    when: all(
      war,
      any(scoreMin(0), eastAt("warsaw")),
      not(flag("f_note_sent")),
      own(24, 36),
    ),
    cast: { chancellor: R_CHANCELLOR, fm: R_FM, cos: R_COS },
    salience: 8,
    tags: ["foreign", "tension_down"],
    variants: [
      v("terms", flag("f_secret_terms")),
      v("romania", world({ is: "entered", tag: "ROU" })),
      v("pair", pair),
      v("base"),
    ],
    fallback: "no_terms",
    options: [
      o(
        "no_terms",
        ["america:-1", "reichstag:+1"],
        [america(-5), reichstag(1), setFlag("f_note_sent")],
      ),
      o(
        "stay_silent",
        ["cos:+1", "chancellor:-1", "army:+1"],
        [trustOf(cos, 1), trustOf(chancellor, -1), army(1)],
      ),
      o(
        "terms_named",
        ["talks", "cos:-2", "army:-1", "reichstag:+1", "morale:-1"],
        [
          offerTalks,
          trustOf(cos, -2),
          army(-1),
          reichstag(1),
          gauge("morale", -1),
          setFlag("f_note_sent"),
          setFlag("f_note_terms"),
          reason("s_note_terms"),
        ],
        keys("k_beth_reform", "k_kuhl_belgium"),
      ),
      o(
        "leave_to_wilson",
        ["america:-2", "cos:-1"],
        [america(-15), trustOf(cos, -1), setFlag("f_note_sent")],
        memory("k_bern_wilson"),
      ),
    ],
  }),
  scene({
    id: "deu_s_second_table",
    kind: "audience",
    scheduledOnly: true,
    cast: { holtz: { person: "deu_holtzendorff" }, navy: R_NAVY },
    salience: 6,
    tags: ["people"],
    variants: [
      v("convoys", any(britainConvoys, memory("m_convoy_heard"))),
      v("base"),
    ],
    fallback: "file_it",
    options: [
      o(
        "file_it",
        ["trust:+1", "morale:-1"],
        [
          { kind: "person_trust", who: HOLTZ, delta: 1 },
          gauge("morale", -1),
          keepPromise(HOLTZ, "p_holtz_honest"),
        ],
      ),
      o(
        "show_chiefs",
        ["trust:+1", "army:-1", "cos:-1"],
        [
          { kind: "person_trust", who: HOLTZ, delta: 1 },
          army(-1),
          {
            kind: "person_trust",
            who: { office: "chief_of_staff" },
            delta: -1,
          },
          keepPromise(HOLTZ, "p_holtz_honest"),
          setFlag("f_second_table_shown"),
        ],
      ),
      o(
        "retire_him",
        ["leaves", "navy:+1"],
        [
          doWorld({ do: "leave", who: HOLTZ }),
          trustOf(navy, 1),
          reason("s_holtz_retired"),
        ],
      ),
    ],
  }),
  scene({
    id: "deu_s_zimm_wire",
    kind: "crisis",
    when: all(
      any(uboatMin(2), seen("deu_s_pless")),
      any(holds("foreign", "deu_zimmermann"), memory("k_zimm_mexico")),
      not(usIn),
      world({ is: "war_months", min: 26, max: 35 }),
    ),
    cast: { fm: R_FM },
    salience: 7,
    tags: ["foreign", "tension_up"],
    variants: [
      v("mexico", memory("k_zimm_mexico")),
      v("zimm", holds("foreign", "deu_zimmermann")),
      v("base"),
    ],
    fallback: "do_not_send",
    options: [
      o("do_not_send", ["fm:-1"], [trustOf(fm, -1), setFlag("f_wire_held")]),
      o(
        "send_washington",
        ["fm:+1"],
        [trustOf(fm, 1), setFlag("f_wire_sent"), schedule("deu_s_wire_out", 2)],
      ),
      o(
        "send_courier",
        ["fm:+1"],
        [trustOf(fm, 1), setFlag("f_wire_courier"), reason("s_wire_courier")],
        memory("k_zimm_cipher"),
      ),
      o(
        "send_all",
        ["fm:+1", "america:+1"],
        [
          trustOf(fm, 1),
          america(5),
          setFlag("f_wire_sent"),
          schedule("deu_s_wire_out", 1),
        ],
        memory("k_zimm_mexico"),
      ),
    ],
  }),
  scene({
    id: "deu_s_wire_out",
    kind: "crisis",
    scheduledOnly: true,
    cast: { fm: R_FM, chancellor: R_CHANCELLOR },
    salience: 8,
    tags: ["foreign", "tension_up"],
    variants: [
      v("all", chose("deu_s_zimm_wire", "send_all")),
      v("zimm", holds("foreign", "deu_zimmermann")),
      v("base"),
    ],
    fallback: "deny",
    options: [
      o(
        "deny",
        ["america:+2", "fm:+1", "chancellor:-1"],
        [america(15), trustOf(fm, 1), trustOf(chancellor, -1)],
      ),
      o(
        "admit",
        ["america:+1", "fm:-1", "reichstag:+1"],
        [america(5), trustOf(fm, -1), reichstag(1), reason("s_wire_admitted")],
        memory("k_zimm_admit"),
      ),
      o(
        "blame_hand",
        ["america:+2", "fm:-2", "leaves"],
        [
          america(15),
          trustOf(fm, -2),
          doWorld({ do: "leave", who: fm }),
          reason("s_wire_blamed"),
        ],
      ),
    ],
  }),
  scene({
    id: "deu_s_america_in",
    kind: "report",
    when: all(usIn, world({ is: "war_months", min: 27 })),
    cast: {},
    salience: 9,
    tags: ["foreign", "tension_up"],
    stamp: "confirmed",
    source: "staff",
    variants: [
      v("wire", flag("f_wire_sent")),
      v("no_boats", uboatMax(1)),
      v("base"),
    ],
  }),
  scene({
    id: "deu_s_america_counts",
    kind: "report",
    when: all(usIn, world({ is: "war_months", min: 35 })),
    cast: {},
    salience: 7,
    tags: ["war", "tension_up"],
    once: false,
    cooldown: 4,
    stamp: "unconfirmed",
    source: "agents",
    variants: [
      v("y17", date("1917-07", "1917-12")),
      v("spring", date("1918-01", "1918-06")),
      v("base"),
    ],
  }),

  // ---- The east ----
  scene({
    id: "deu_s_separate_russia",
    kind: "proposal",
    when: all(
      atRUS,
      not(rusOut),
      any(flag("f_sounding_russia"), flag("f_denmark_channel"), scoreMin(5)),
      world({ is: "war_months", own: true, min: 11, max: 29 }),
    ),
    cast: { fm: R_FM, chancellor: R_CHANCELLOR },
    salience: 8,
    tags: ["foreign", "tension_down"],
    variants: [
      v("east1", world({ is: "plan", of: ["east"] })),
      v("andersen", flag("f_denmark_channel")),
      v("sounding", flag("f_sounding_russia")),
      v("base"),
    ],
    fallback: "refuse",
    options: [
      o("refuse", ["auh:+1", "fm:-1"], [nation("AUH", 1), trustOf(fm, -1)]),
      o(
        "andersen_again",
        ["rus:+1", "talks"],
        [
          nation("RUS", 1),
          setFlag("f_andersen_again"),
          setFlag("f_russia_line_open"),
        ],
        memory("k_andersen"),
      ),
      o(
        "stockholm_line",
        ["rus:+1", "chancellor:+1"],
        [
          nation("RUS", 1),
          trustOf(chancellor, 1),
          keepPromise({ person: "deu_pourtales" }, "pour_use"),
          setFlag("f_stockholm_line"),
          setFlag("f_russia_line_open"),
        ],
        memory("k_falk_russia"),
      ),
      o(
        "offer_straits",
        ["rus:+2", "ott:-2", "auh:-1"],
        [
          nation("RUS", 2),
          nation("OTT", -2),
          nation("AUH", -1),
          setFlag("f_straits_offered"),
          setFlag("f_russia_line_open"),
          reason("s_straits_offered"),
        ],
        memory("k_zimm_straits"),
      ),
    ],
  }),
  scene({
    id: "deu_s_poland_kingdom",
    kind: "proposal",
    when: all(
      eastAt("warsaw"),
      not(rusOut),
      world({ is: "war_months", min: 20, max: 32 }),
    ),
    cast: { chancellor: R_CHANCELLOR, cos: R_COS, vienna: R_VIENNA },
    salience: 7,
    tags: ["foreign"],
    variants: [
      v("line_open", flag("f_russia_line_open")),
      v("pair", pair),
      v("base"),
    ],
    fallback: "wait",
    options: [
      o("wait", ["cos:-1", "rus:+1"], [trustOf(cos, -1), nation("RUS", 1)]),
      o(
        "proclaim",
        ["army:+1", "rus:-2", "auh:-1", "manpower:+1"],
        [
          army(1),
          nation("RUS", -2),
          nation("AUH", -1),
          men(1),
          setFlag("f_poland_kingdom"),
          { kind: "unflag", flag: "f_russia_line_open" },
          reason("s_poland_closes_russia"),
        ],
      ),
      o(
        "proclaim_with_vienna",
        ["rus:-2", "auh:+1", "manpower:+1"],
        [
          nation("RUS", -2),
          nation("AUH", 1),
          men(1),
          keepPromise({ person: "deu_jagow" }, "jagow_poland_first"),
          setFlag("f_poland_kingdom"),
          { kind: "unflag", flag: "f_russia_line_open" },
          reason("s_poland_closes_russia"),
        ],
        memory("k_lud_poland"),
      ),
      o(
        "border_strip",
        ["army:+1", "rus:-1", "chancellor:-1", "reichstag:-1"],
        [
          army(1),
          nation("RUS", -1),
          trustOf(chancellor, -1),
          reichstag(-1),
          setFlag("f_border_strip"),
        ],
      ),
    ],
  }),
  scene({
    id: "deu_s_lenin_train",
    kind: "crisis",
    when: all(
      russiaProvisional,
      atRUS,
      world({ is: "war_months", own: true, min: 31, max: 37 }),
    ),
    cast: { fm: R_FM, cos: R_COS },
    salience: 8,
    tags: ["foreign"],
    variants: [v("parvus", memory("k_parvus")), v("pair", pair), v("base")],
    fallback: "refuse",
    options: [
      o("refuse", ["cos:-1"], [trustOf(cos, -1), setFlag("f_train_refused")]),
      o(
        "pass_train",
        ["rus:-1", "cos:+1", "reichstag:-1"],
        [
          nation("RUS", -1),
          trustOf(cos, 1),
          reichstag(-1),
          force("RUS", "east", -1),
          setFlag("f_lenin_passed"),
        ],
      ),
      o(
        "pass_with_eye",
        ["rus:-1", "cos:+1"],
        [
          nation("RUS", -1),
          trustOf(cos, 1),
          force("RUS", "east", -1),
          setFlag("f_lenin_passed"),
          setFlag("f_lenin_watched"),
        ],
        memory("k_parvus"),
      ),
      o(
        "leave_to_staff",
        ["army:+1", "fm:-1"],
        [
          army(1),
          trustOf(fm, -1),
          force("RUS", "east", -1),
          setFlag("f_lenin_passed"),
          reason("s_train_staff"),
        ],
      ),
    ],
  }),
  scene({
    id: "deu_s_brest_opens",
    kind: "crisis",
    when: all(russiaDone, world({ is: "war_months", min: 31, max: 51 })),
    cast: { fm: R_FM, cos: R_COS },
    salience: 9,
    tags: ["foreign"],
    variants: [
      v("lenin", flag("f_lenin_passed")),
      v("kuhl", holds("foreign", "deu_kuhlmann")),
      // ww187: "across the Dvina": the east line there or past.
      {
        ...v("far", eastAt("dvina")),
        assumes: { line: { east: ["dvina", "kiev"] } },
      },
      v("base"),
    ],
    fallback: "staff_terms",
    options: [
      o(
        "staff_terms",
        ["army:+1", "fm:-1", "reichstag:-1", "countersign:-1"],
        [
          army(1),
          trustOf(fm, -1),
          reichstag(-1),
          countersign(-1),
          trustOf(cos, 1),
          keepPromise({ person: "deu_ludendorff" }, "p_lud_aims"),
          setFlag("f_brest_staff"),
        ],
      ),
      o(
        "kuehlmann_terms",
        ["army:-1", "authority:+1", "fm:+1", "cos:-1"],
        [
          army(-1),
          authority(1),
          trustOf(fm, 1),
          trustOf(cos, -1),
          setFlag("f_brest_kuhl"),
        ],
        memory("k_kuhl_brest"),
      ),
      o(
        "annex_nothing",
        ["army:-2", "reichstag:+2", "cos:-2", "morale:-1"],
        [
          army(-2),
          reichstag(2),
          trustOf(cos, -2),
          gauge("morale", -1),
          setFlag("f_brest_nothing"),
          reason("s_brest_nothing"),
        ],
        memory("k_erz_resolution"),
      ),
    ],
  }),
  scene({
    id: "deu_s_brest_no_peace",
    kind: "crisis",
    when: all(seen("deu_s_brest_opens"), world({ is: "war_months", min: 32 })),
    cast: { fm: R_FM, cos: R_COS },
    salience: 8,
    tags: ["foreign", "tension_up"],
    variants: [
      // ww187: "from the Dvina to Petrograd": the east line on the Dvina.
      {
        ...v("staff", flag("f_brest_staff")),
        assumes: { line: { east: ["riga", "dvina"] } },
      },
      v("nothing", flag("f_brest_nothing")),
      v("base"),
    ],
    fallback: "march_on",
    options: [
      o(
        "march_on",
        ["army:+1", "fm:-1", "manpower:-1", "reichstag:-1"],
        [
          army(1),
          trustOf(fm, -1),
          men(-1),
          reichstag(-1),
          force("RUS", "east", -2),
          setFlag("f_brest_marched"),
        ],
      ),
      o(
        "wait",
        ["cos:-2", "army:-1"],
        [trustOf(cos, -2), army(-1), setFlag("f_brest_waited")],
      ),
      o(
        "sign_ukraine_first",
        ["bread:+1", "cos:+1", "fm:+1", "rus:-1"],
        [
          gauge("bread", 1),
          trustOf(cos, 1),
          trustOf(fm, 1),
          nation("RUS", -1),
          setFlag("f_ukraine_first"),
        ],
        memory("k_hoff_home"),
      ),
    ],
  }),
  scene({
    id: "deu_s_ukraine_bread",
    kind: "proposal",
    when: all(
      rusOut,
      gaugeMax("bread", 2),
      world({ is: "war_months", min: 41, max: 51 }),
    ),
    cast: { interior: R_INTERIOR, cos: R_COS },
    salience: 7,
    tags: ["home"],
    variants: [
      v("first", flag("f_ukraine_first")),
      v("unrest", gaugeMax("order", 2)),
      v("base"),
    ],
    fallback: "requisition_rule",
    options: [
      o(
        "requisition_rule",
        ["bread:+1", "manpower:-1", "cos:+1"],
        [
          gauge("bread", 1),
          men(-1),
          trustOf(cos, 1),
          setFlag("f_ukraine_requisition"),
        ],
      ),
      o(
        "buy_with_goods",
        ["bread:+1", "money:-1", "shells:-1", "authority:+1"],
        [
          gauge("bread", 1),
          gauge("money", -1),
          gauge("shells", -1),
          authority(1),
          setFlag("f_ukraine_bought"),
        ],
        memory("k_groe_rails"),
      ),
      o(
        "skoropadsky_deal",
        ["bread:+1", "army:+1", "manpower:-1", "reichstag:-1"],
        [
          gauge("bread", 1),
          army(1),
          men(-1),
          reichstag(-1),
          setFlag("f_ukraine_hetman"),
        ],
      ),
    ],
  }),
  scene({
    id: "deu_s_baltic_thrones",
    kind: "proposal",
    when: all(rusOut, world({ is: "war_months", min: 41 })),
    cast: { fm: R_FM, court: R_COURT },
    salience: 4,
    tags: ["foreign"],
    variants: [v("kuhl", flag("f_brest_kuhl")), v("base")],
    fallback: "leave_it",
    options: [
      o("leave_it", ["court:-1"], [trustOf(court, -1)]),
      o(
        "personal_union",
        ["army:+1", "reichstag:-1", "morale:+1", "fm:-1"],
        [
          army(1),
          reichstag(-1),
          gauge("morale", 1),
          trustOf(fm, -1),
          setFlag("f_baltic_crown"),
        ],
      ),
      o(
        "local_diets",
        ["fm:+1", "army:-1", "reichstag:+1"],
        [trustOf(fm, 1), army(-1), reichstag(1), setFlag("f_baltic_diets")],
        memory("k_kuhl_brest"),
      ),
    ],
  }),

  // ---- 1917: what Belgium costs ----
  scene({
    id: "deu_s_papal_note",
    kind: "proposal",
    when: all(war, belgiumHeld, noArmistice, own(30)),
    cast: { fm: R_FM, chancellor: R_CHANCELLOR },
    salience: 8,
    tags: ["foreign", "tension_down"],
    variants: [
      v("resolution", seen("deu_k_peace_resolution")),
      v("not_beth", not(holds("chancellor", "deu_bethmann"))),
      v("base"),
    ],
    fallback: "general_words",
    options: [
      o(
        "general_words",
        ["fm:-1", "army:+1"],
        [trustOf(fm, -1), army(1), setFlag("f_papal_vague")],
      ),
      o(
        "belgium_clear",
        ["talks", "army:-2", "reichstag:+2", "morale:-1"],
        [
          offerTalks,
          army(-2),
          reichstag(2),
          gauge("morale", -1),
          keepPromise({ person: "deu_haase" }, "p_haase_annex"),
          keepPromise({ person: "deu_erzberger" }, "p_erz_rome"),
          setFlag("f_belgium_given"),
          reason("s_belgium_given"),
        ],
        memory("k_erz_vatican"),
      ),
      o(
        "secret_answer",
        ["fm:+1", "army:-1"],
        [
          trustOf(fm, 1),
          army(-1),
          keepPromise({ person: "deu_erzberger" }, "p_erz_rome"),
          setFlag("f_papal_secret"),
        ],
        memory("k_kuhl_belgium"),
      ),
    ],
  }),
  scene({
    id: "deu_s_belgium_price",
    kind: "proposal",
    when: all(
      atGBR,
      belgiumHeld,
      any(not(flag("f_aims_full")), memory("k_kuhl_belgium")),
      world({ is: "war_months", own: true, min: 35, max: 44 }),
    ),
    cast: { fm: R_FM, cos: R_COS },
    salience: 8,
    tags: ["foreign", "tension_down"],
    variants: [
      v("scrap", memory("scrap_of_paper")),
      v("aims", flag("f_aims_full")),
      v("base"),
    ],
    fallback: "hold_belgium",
    options: [
      o(
        "hold_belgium",
        ["army:+1", "fm:-1"],
        [army(1), trustOf(fm, -1), setFlag("f_belgium_held")],
      ),
      o(
        "sound_london",
        ["talks", "gbr:+1", "cos:-2", "army:-1"],
        [
          offerTalks,
          nation("GBR", 1),
          trustOf(cos, -2),
          army(-1),
          keepPromise({ person: "deu_lichnowsky" }, "lich_channel"),
          setFlag("f_london_sounded"),
          reason("s_london_sounded"),
        ],
        memory("k_kuhl_belgium"),
      ),
      o(
        "crown_council",
        ["authority:+1", "cos:-1", "fm:+1"],
        [
          authority(1),
          trustOf(cos, -1),
          trustOf(fm, 1),
          setFlag("f_belgium_council"),
        ],
      ),
    ],
  }),
  scene({
    id: "deu_s_alsace_offer",
    kind: "proposal",
    when: all(
      scoreMax(0),
      atFRA,
      memory("k_kuhl_paris"),
      world({ is: "war_months", own: true, min: 29, max: 47 }),
    ),
    cast: { fm: R_FM, chancellor: R_CHANCELLOR },
    salience: 5,
    tags: ["foreign", "tension_down"],
    variants: [v("late", date("1917-10", "1918-06")), v("base")],
    fallback: "never",
    options: [
      o("never", ["morale:+1", "fm:-1"], [gauge("morale", 1), trustOf(fm, -1)]),
      o(
        "sound_paris",
        ["talks", "fra:+1", "army:-2", "morale:-1"],
        [
          offerTalks,
          nation("FRA", 1),
          army(-2),
          gauge("morale", -1),
          setFlag("f_alsace_sounded"),
          reason("s_alsace_sounded"),
        ],
      ),
      o(
        "ask_neutral_broker",
        ["fra:+1", "army:-1"],
        [nation("FRA", 1), army(-1), setFlag("f_alsace_broker")],
      ),
    ],
  }),
  scene({
    id: "deu_s_vienna_wavers",
    kind: "crisis",
    when: all(
      any(atRUS, rusOut),
      any(
        { kind: "nation_gauge", tag: "AUH", gauge: "order", max: 2 },
        known("auh_sixtus_copy"),
      ),
      world({ is: "war_months", min: 29, max: 47 }),
    ),
    cast: { fm: R_FM, vienna: R_VIENNA },
    salience: 7,
    tags: ["foreign", "tension_up"],
    variants: [
      v("known", known("auh_sixtus_copy")),
      v("karl", flag("w_auh_karl")),
      v("base"),
    ],
    fallback: "ignore",
    options: [
      o("ignore", ["auh:+1"], [nation("AUH", 1)]),
      o(
        "confront",
        ["auh:-2", "army:+1"],
        [nation("AUH", -2), army(1), setFlag("f_vienna_confronted")],
      ),
      o(
        "let_vienna_talk",
        ["talks", "auh:+1", "army:-1", "fm:+1"],
        [
          offerTalks,
          nation("AUH", 1),
          army(-1),
          trustOf(fm, 1),
          setFlag("f_vienna_channel"),
        ],
        memory("k_kuhl_arms"),
      ),
    ],
  }),
  scene({
    id: "deu_s_vienna_chain",
    kind: "proposal",
    when: all(
      seen("deu_s_vienna_wavers"),
      world({ is: "war_months", min: 41, max: 50 }),
    ),
    cast: { fm: R_FM, cos: R_COS },
    salience: 6,
    tags: ["foreign"],
    variants: [v("confronted", flag("f_vienna_confronted")), v("base")],
    fallback: "bind_tight",
    options: [
      o(
        "bind_tight",
        ["army:+1", "auh:-2", "cos:+1"],
        [
          army(1),
          nation("AUH", -2),
          trustOf(cos, 1),
          setFlag("f_vienna_bound"),
        ],
      ),
      o(
        "keep_equal",
        ["auh:+1", "cos:-1"],
        [nation("AUH", 1), trustOf(cos, -1)],
      ),
      o(
        "leave_door",
        ["auh:+1", "army:-1", "fm:+1"],
        [
          nation("AUH", 1),
          army(-1),
          trustOf(fm, 1),
          setFlag("f_vienna_channel"),
        ],
        memory("k_kuhl_arms"),
      ),
    ],
  }),

  // ---- Tirpitz ----
  talk(
    "deu_t2_tirp_line",
    "deu_tirpitz",
    all(atGBR, world({ is: "war_months", own: true, min: 5, max: 17 })),
    {
      open: node(
        moods("stubborn", "arrogant"),
        r("why", "frank", "ask", "why", { reacts: [shut] }),
        r("order", "threat", "push", "given", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          gain: [remember("k_tirp_line")],
          miss: "wall",
        }),
        r("memo", "warm", "deal", "given", {
          tell: ["countersign:-1"],
          effects: [countersign(-1), remember("k_tirp_line")],
        }),
        bye(),
      ),
      why: node(
        straight,
        r("big", "cold", "ask", "given", {
          gain: [remember("k_tirp_line")],
          miss: "wall",
        }),
        bye("noted", "warm"),
      ),
      given: plain(bye("done", "cold")),
      wall: plain(bye()),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_tirp_stay",
    "deu_tirpitz",
    all(
      holds("navy", "deu_tirpitz"),
      world({ is: "war_months", own: true, min: 11, max: 23 }),
    ),
    {
      open: node(
        moods("arrogant", "cunning"),
        r("what", "frank", "ask", "what", { reacts: [shut] }),
        r("forbid", "threat", "push", "cold", {
          tell: ["trust:-1", "army:+1"],
          effects: [trustOf(who, -1), army(1)],
        }),
        r("seat", "flatter", "deal", "seat", {
          tell: ["promise", "trust:+1"],
          effects: [
            trustOf(who, 1),
            remember("k_tirp_stay"),
            promise(who, "p_tirp_uboat_seat", 8),
          ],
        }),
        bye(),
      ),
      what: node(
        straight,
        r("seat2", "warm", "deal", "seat", {
          tell: ["promise"],
          effects: [
            remember("k_tirp_stay"),
            promise(who, "p_tirp_uboat_seat", 8),
          ],
        }),
        bye("noted", "cold"),
      ),
      seat: plain(bye("done", "warm")),
      cold: plain(bye()),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_tirp_press",
    "deu_tirpitz",
    all(war, world({ is: "war_months", own: true, min: 5, max: 23 })),
    {
      open: node(
        moods("cunning", "stubborn"),
        r("who", "cold", "ask", "denies", {
          reacts: [shut, ifTrust(2, "owned", [reveal("deu_tirpitz_press")])],
        }),
        r("show", "threat", "push", "owned", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          gain: [reveal("deu_tirpitz_press")],
          miss: "denies",
        }),
        r("quiet", "frank", "deal", "quiet", {
          tell: ["promise"],
          effects: [
            promise(who, "p_tirp_quiet", 6, {
              keep: chose("deu_s_restrict_order", "refuse_order"),
            }),
            reveal("deu_tirpitz_press"),
          ],
        }),
        bye(),
      ),
      denies: plain(
        bye(),
        r("again", "cold", "push", "owned", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          gain: [reveal("deu_tirpitz_press")],
          miss: null,
        }),
      ),
      owned: plain(bye("done", "cold")),
      quiet: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_tirp_son",
    "deu_tirpitz",
    all(atGBR, world({ is: "war_months", own: true, min: 5, max: 29 })),
    {
      open: node(
        [v("base")],
        r("word", "warm", "ask", "word", {
          reacts: [shut],
          effects: [setFlag("f_alfonso_heard")],
        }),
        r("use", "cold", "push", "stiff", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
        }),
        r("send", "warm", "deal", "thanks", {
          tell: ["trust:+1", "gbr:+1"],
          effects: [
            trustOf(who, 1),
            nation("GBR", 1),
            setFlag("f_alfonso_heard"),
            remember("m_tirp_son_helped"),
          ],
        }),
        bye("end", "warm"),
      ),
      word: node(straight, bye("done", "warm")),
      stiff: plain(bye()),
      thanks: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_tirp_party",
    "deu_tirpitz",
    all(
      not(holds("navy", "deu_tirpitz")),
      world({ is: "war_months", min: 23, max: 41 }),
    ),
    {
      open: node(
        moods("arrogant", "stubborn"),
        r("who", "cold", "ask", "who", {
          reacts: [shut],
          effects: [remember("k_tirp_party")],
        }),
        r("stop", "threat", "push", "stop", {
          tell: ["trust:-1", "morale:-1"],
          effects: [
            trustOf(who, -1),
            gauge("morale", -1),
            remember("k_tirp_party"),
          ],
        }),
        r("title", "flatter", "deal", "title", {
          tell: ["trust:+1", "reichstag:-1"],
          effects: [
            trustOf(who, 1),
            reichstag(-1),
            remember("k_tirp_party"),
            setFlag("f_tirp_courted"),
          ],
        }),
        bye(),
      ),
      who: node(straight, bye()),
      stop: plain(bye()),
      title: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_tirp_after",
    "deu_tirpitz",
    all(
      not(holds("navy", "deu_tirpitz")),
      world({ is: "war_months", min: 35 }),
    ),
    {
      open: node(
        [
          v("son", memory("m_tirp_son_helped")),
          ...moods("cunning", "stubborn"),
        ],
        r("fleet", "frank", "ask", "fleet", { reacts: [shut] }),
        r("capelle", "cold", "push", "capelle", {
          effects: [],
          gain: [remember("m_capelle_weak")],
          miss: "wall",
        }),
        r("book", "warm", "deal", "book", {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("m_capelle_weak")],
        }),
        bye(),
      ),
      fleet: node(straight, bye("done", "warm")),
      capelle: plain(bye()),
      book: plain(bye("done", "warm")),
      wall: plain(bye()),
      shut: plain(bye()),
    },
  ),

  // ---- Holtzendorff ----
  talk(
    "deu_t2_holtz_table",
    "deu_holtzendorff",
    all(atGBR, world({ is: "war_months", own: true, min: 23, max: 35 })),
    {
      open: node(
        moods("cold", "anxious"),
        r("how", "cold", "ask", "how", {
          reacts: [shut],
          effects: [remember("k_holtz_table")],
        }),
        r("wrong", "threat", "push", "stiff", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [
            ifMood(
              "gap",
              [reveal("deu_table_wrong"), remember("k_holtz_table")],
              "anxious",
            ),
          ],
        }),
        r("cover", "warm", "deal", "gap", {
          tell: ["trust:+1"],
          effects: [
            trustOf(who, 1),
            remember("k_holtz_table"),
            reveal("deu_table_wrong"),
          ],
        }),
        bye(),
      ),
      how: node(
        straight,
        r("convoy", "frank", "ask", "gap", {
          gain: [reveal("deu_table_wrong")],
          miss: "stiff",
        }),
        bye("noted", "cold"),
      ),
      gap: plain(bye("done", "warm")),
      stiff: plain(bye()),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_holtz_neutrals",
    "deu_holtzendorff",
    all(atGBR, world({ is: "war_months", own: true, min: 17, max: 35 })),
    {
      open: node(
        moods("cold"),
        r("list", "frank", "ask", "list", {
          reacts: [shut],
          effects: [remember("k_holtz_neutrals")],
        }),
        r("all", "cold", "push", "all", {
          tell: ["america:+1"],
          effects: [america(5)],
        }),
        r("corridor", "warm", "deal", "corridor", {
          tell: ["navy:-1"],
          effects: [navyMinister(-1), remember("k_holtz_neutrals")],
        }),
        bye(),
      ),
      list: node(straight, bye("done", "cold")),
      all: plain(bye()),
      corridor: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_holtz_tirpitz",
    "deu_holtzendorff",
    all(
      holds("navy", "deu_tirpitz"),
      world({ is: "war_months", own: true, min: 13, max: 23 }),
    ),
    {
      open: node(
        moods("anxious", "cold"),
        r("two", "frank", "ask", "two", {
          reacts: [shut],
          gain: [remember("m_tirp_letter_known")],
        }),
        r("choose", "threat", "push", "choose", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          gain: [reveal("deu_tirpitz_press")],
          miss: "stiff",
        }),
        r("one", "warm", "deal", "one", {
          tell: ["promise", "trust:+1"],
          effects: [
            trustOf(who, 1),
            promise(who, "p_holtz_navy", 8),
            remember("m_tirp_letter_known"),
          ],
        }),
        bye(),
      ),
      two: node(straight, bye("done", "cold")),
      choose: plain(bye()),
      one: plain(bye("done", "warm")),
      stiff: plain(bye()),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_holtz_convoy",
    "deu_holtzendorff",
    all(uboatMin(2), world({ is: "war_months", min: 31, max: 41 })),
    {
      open: node(
        [
          v("seen", britainConvoys),
          v("anxious", moody(who, "anxious")),
          v("base"),
        ],
        r("why", "cold", "ask", "why", { reacts: [shut] }),
        r("more", "threat", "push", "more", {
          tell: ["money:-1", "trust:-1"],
          effects: [gauge("money", -1), trustOf(who, -1)],
        }),
        r("study", "warm", "deal", "study", {
          tell: ["trust:+1", "navy:-1"],
          effects: [
            trustOf(who, 1),
            navyMinister(-1),
            remember("m_convoy_heard"),
          ],
        }),
        bye(),
      ),
      why: node(straight, bye("done", "cold")),
      more: plain(bye()),
      study: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_holtz_months",
    "deu_holtzendorff",
    all(uboatMin(2), world({ is: "war_months", min: 35, max: 47 })),
    {
      open: node(
        moods("cold", "anxious"),
        r("next", "frank", "ask", "next", { reacts: [shut] }),
        r("answer", "threat", "push", "stiff", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [ifMood("next", [], "anxious")],
        }),
        r("honest", "warm", "deal", "honest", {
          tell: ["promise"],
          effects: [
            promise(who, "p_holtz_honest", 5),
            schedule("deu_s_second_table", 2),
          ],
        }),
        bye(),
      ),
      next: node(
        straight,
        r("honest2", "warm", "deal", "honest", {
          tell: ["promise"],
          effects: [
            promise(who, "p_holtz_honest", 5),
            schedule("deu_s_second_table", 2),
          ],
        }),
        bye("noted", "cold"),
      ),
      honest: plain(bye("done", "warm")),
      stiff: plain(bye()),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_holtz_out",
    "deu_holtzendorff",
    all(scoreMax(0), atGBR, world({ is: "war_months", own: true, min: 41 })),
    {
      open: node(
        moods("anxious"),
        r("mood", "frank", "ask", "mood", {
          reacts: [
            shut,
            ifTrust(1, "plan", [reveal("deu_fleet_plan_oct")]),
            {
              when: memory("m_capelle_weak"),
              next: "plan",
              effects: [reveal("deu_fleet_plan_oct")],
            },
          ],
        }),
        r("order", "threat", "push", "stiff", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
        }),
        r("rest", "warm", "deal", "plan", {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), reveal("deu_fleet_plan_oct")],
        }),
        bye("end", "warm"),
      ),
      mood: plain(bye("done", "cold")),
      plan: plain(bye("done", "warm")),
      stiff: plain(bye()),
      shut: plain(bye()),
    },
  ),

  // ---- Zimmermann ----
  talk(
    "deu_t2_zimm_jagow",
    "deu_zimmermann",
    all(
      holds("foreign", "deu_jagow"),
      world({ is: "war_months", own: true, min: 11, max: 29 }),
    ),
    {
      open: node(
        moods("cunning", "arrogant"),
        r("health", "warm", "ask", "health", { reacts: [shut] }),
        r("work", "cold", "push", "work", {
          miss: "laugh",
        }),
        r("seat", "flatter", "deal", "seat", {
          tell: ["promise", "trust:+1"],
          effects: [
            trustOf(who, 1),
            promise(who, "p_zimm_foreign", 10, {
              keep: holds("foreign", "deu_zimmermann"),
            }),
          ],
        }),
        bye(),
      ),
      health: node(straight, bye("done", "cold")),
      work: plain(bye()),
      seat: plain(bye("done", "warm")),
      laugh: plain(bye()),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_zimm_casement",
    "deu_zimmermann",
    all(
      any(flag("f_back_rebels"), atGBR),
      world({ is: "war_months", min: 5, max: 23 }),
    ),
    {
      open: node(
        moods("arrogant"),
        r("men", "cold", "ask", "men", {
          reacts: [shut],
          effects: [remember("m_zimm_parvus")],
        }),
        r("drop", "threat", "push", "drop", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
        }),
        r("back", "warm", "deal", "back", {
          tell: ["promise", "gbr:-1"],
          effects: [
            nation("GBR", -1),
            promise(who, "p_zimm_ireland", 6, { keep: flag("f_back_rebels") }),
            keepPromise(who, "zimm_no_name"),
            remember("m_zimm_parvus"),
          ],
        }),
        bye(),
      ),
      men: node(straight, bye("done", "cold")),
      drop: plain(bye()),
      back: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_zimm_sofia",
    "deu_zimmermann",
    all(
      not(world({ is: "entered", tag: "BGR" })),
      world({ is: "war_months", own: true, min: 5, max: 17 }),
    ),
    {
      open: node(
        moods("cunning"),
        r("price", "cold", "ask", "price", {
          reacts: [shut],
          effects: [remember("k_zimm_sofia")],
        }),
        r("now", "threat", "push", "now", {
          tell: ["trust:-1", "auh:-1"],
          effects: [
            trustOf(who, -1),
            nation("AUH", -1),
            remember("k_zimm_sofia"),
          ],
        }),
        r("loan", "warm", "deal", "loan", {
          tell: ["money:-1"],
          effects: [gauge("money", -1), remember("k_zimm_sofia")],
        }),
        bye(),
      ),
      price: node(straight, bye("done", "cold")),
      now: plain(bye()),
      loan: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_zimm_straits",
    "deu_zimmermann",
    all(atRUS, world({ is: "war_months", own: true, min: 11, max: 29 })),
    {
      open: node(
        moods("cunning", "arrogant"),
        r("would", "frank", "ask", "would", {
          reacts: [shut],
          gain: [remember("k_zimm_straits")],
          miss: "joke",
        }),
        r("write", "cold", "push", "write", {
          tell: ["ott:-1"],
          effects: [nation("OTT", -1), remember("k_zimm_straits")],
        }),
        r("quiet", "warm", "deal", "quiet", {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_zimm_straits")],
        }),
        bye(),
      ),
      would: plain(bye("done", "cold")),
      write: plain(bye()),
      quiet: plain(bye("done", "warm")),
      joke: plain(
        r("again", "cold", "ask", "would", {
          gain: [remember("k_zimm_straits")],
          miss: null,
        }),
        bye(),
      ),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_zimm_mexico",
    "deu_zimmermann",
    all(uboatMin(1), world({ is: "war_months", min: 23, max: 35 })),
    {
      open: node(
        moods("cunning", "arrogant"),
        r("what", "frank", "ask", "what", {
          reacts: [shut],
          effects: [remember("k_zimm_mexico")],
        }),
        r("how", "cold", "ask", "how", {
          effects: [remember("k_zimm_mexico")],
          gain: [remember("k_zimm_cipher")],
          miss: "laugh",
        }),
        r("draft", "warm", "deal", "draft", {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_zimm_mexico")],
        }),
        r("no", "threat", "push", "no", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
        }),
        bye(),
      ),
      what: node(
        straight,
        r("how2", "cold", "ask", "how", {
          gain: [remember("k_zimm_cipher")],
          miss: "laugh",
        }),
        bye("noted", "cold"),
      ),
      how: plain(bye("done", "cold")),
      laugh: plain(bye()),
      draft: plain(bye("done", "warm")),
      no: plain(bye()),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_zimm_admit",
    "deu_zimmermann",
    all(seen("deu_s_wire_out"), world({ is: "war_months", min: 29, max: 41 })),
    {
      open: node(
        moods("arrogant", "cunning"),
        r("true", "frank", "ask", "true", {
          reacts: [shut],
          effects: [remember("k_zimm_admit")],
        }),
        r("say", "threat", "push", "say", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          gain: [remember("k_zimm_admit")],
          miss: "wall",
        }),
        r("cover", "warm", "deal", "cover", {
          tell: ["trust:+1", "chancellor:-1"],
          effects: [
            trustOf(who, 1),
            { kind: "person_trust", who: { office: "chancellor" }, delta: -1 },
            remember("k_zimm_admit"),
          ],
        }),
        bye(),
      ),
      true: node(straight, bye("done", "cold")),
      say: plain(bye()),
      cover: plain(bye("done", "warm")),
      wall: plain(bye()),
      shut: plain(bye()),
    },
  ),

  // ---- Kühlmann ----
  talk(
    "deu_t2_kuhl_hague",
    "deu_kuhlmann",
    all(war, world({ is: "war_months", own: true, min: 8, max: 29 })),
    {
      open: node(
        moods("cunning", "cold"),
        r("cabinet", "cold", "ask", "cabinet", {
          reacts: [shut],
          gain: [{ kind: "source", source: "embassy_london", right: true }],
          miss: "pictures",
        }),
        r("press", "threat", "push", "pictures", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
        }),
        r("budget", "warm", "deal", "budget", {
          tell: ["money:-1", "trust:+1"],
          effects: [
            gauge("money", -1),
            trustOf(who, 1),
            { kind: "source", source: "embassy_london", right: true },
          ],
        }),
        bye(),
      ),
      cabinet: node(straight, bye("done", "cold")),
      pictures: plain(bye()),
      budget: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_kuhl_paris",
    "deu_kuhlmann",
    all(atFRA, world({ is: "war_months", own: true, min: 8, max: 41 })),
    {
      open: node(
        [
          v("cambon", keys("m_offer_paris", "cambon_saw")),
          v("cunning", moody(who, "cunning")),
          v("base"),
        ],
        r("road", "frank", "ask", "road", {
          reacts: [shut],
          gain: [remember("k_kuhl_paris")],
          miss: "lunch",
        }),
        r("open", "cold", "push", "road", {
          tell: ["army:-1"],
          effects: [army(-1), remember("k_kuhl_paris")],
        }),
        r("cover", "warm", "deal", "cover", {
          tell: ["trust:+1", "cos:-1"],
          effects: [
            trustOf(who, 1),
            {
              kind: "person_trust",
              who: { office: "chief_of_staff" },
              delta: -1,
            },
            remember("k_kuhl_paris"),
          ],
        }),
        bye(),
      ),
      road: plain(bye("done", "cold")),
      lunch: plain(
        r("back", "cold", "ask", "road", {
          effects: [remember("k_kuhl_paris")],
        }),
        bye(),
      ),
      cover: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_kuhl_belgium",
    "deu_kuhlmann",
    all(
      atGBR,
      belgiumHeld,
      world({ is: "war_months", own: true, min: 23, max: 41 }),
    ),
    {
      open: node(
        moods("cunning", "cold"),
        r("price", "frank", "ask", "price", {
          reacts: [shut],
          effects: [remember("k_kuhl_belgium")],
        }),
        r("keep", "threat", "push", "keep", {
          tell: ["trust:-1", "army:+1"],
          effects: [trustOf(who, -1), army(1)],
        }),
        r("mine", "warm", "deal", "mine", {
          tell: ["army:-1", "trust:+1"],
          effects: [army(-1), trustOf(who, 1), remember("k_kuhl_belgium")],
        }),
        bye(),
      ),
      price: node(straight, bye("done", "cold")),
      keep: plain(bye()),
      mine: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_kuhl_brest",
    "deu_kuhlmann",
    all(russiaDone, world({ is: "war_months", min: 31, max: 51 })),
    {
      open: node(
        moods("cunning", "cold"),
        r("word", "cold", "ask", "word", {
          reacts: [shut],
          effects: [remember("k_kuhl_brest")],
        }),
        r("hurry", "threat", "push", "hurry", {
          tell: ["trust:-1", "army:+1"],
          effects: [trustOf(who, -1), army(1)],
        }),
        r("hands", "warm", "deal", "hands", {
          tell: ["cos:-1", "trust:+1"],
          effects: [
            {
              kind: "person_trust",
              who: { office: "chief_of_staff" },
              delta: -1,
            },
            trustOf(who, 1),
            remember("k_kuhl_brest"),
          ],
        }),
        bye(),
      ),
      word: node(straight, bye("done", "cold")),
      hurry: plain(bye()),
      hands: plain(bye("done", "warm")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_kuhl_arms",
    "deu_kuhlmann",
    all(atFRA, world({ is: "war_months", own: true, min: 41, max: 47 })),
    {
      open: node(
        moods("cunning", "cold"),
        r("say", "frank", "ask", "say", {
          reacts: [shut],
          effects: [remember("k_kuhl_arms")],
        }),
        r("forbid", "threat", "push", "forbid", {
          tell: ["trust:-1", "army:+1"],
          effects: [trustOf(who, -1), army(1)],
        }),
        r("stand", "warm", "deal", "stand", {
          tell: ["promise", "trust:+1"],
          effects: [
            trustOf(who, 1),
            remember("k_kuhl_arms"),
            promise(who, "p_kuhl_speech", 8, {
              keep: any(
                chose("deu_f_offensive_month", "stop_and_dig"),
                all(
                  holds("foreign", "deu_kuhlmann"),
                  date("1918-08", "1918-12"),
                ),
              ),
            }),
          ],
        }),
        r("vienna", "cold", "ask", "vienna", {
          gain: [reveal("auh_sixtus_copy"), remember("k_kuhl_arms")],
          miss: "say",
        }),
        bye(),
      ),
      say: node(straight, bye("done", "cold")),
      forbid: plain(bye()),
      stand: plain(bye("done", "warm")),
      vienna: plain(bye("done", "cold")),
      shut: plain(bye()),
    },
  ),
  talk(
    "deu_t2_kuhl_after",
    "deu_kuhlmann",
    all(
      memory("k_kuhl_arms"),
      not(holds("foreign", "deu_kuhlmann")),
      world({ is: "war_months", min: 43 }),
    ),
    {
      open: node(
        moods("cunning", "cold"),
        r("why", "frank", "ask", "why", { reacts: [shut] }),
        r("back", "flatter", "push", "back", {
          gain: [remember("m_kuhl_hintze")],
          miss: "lunch",
        }),
        r("letter", "warm", "deal", "letter", {
          tell: ["trust:+1", "army:-1"],
          effects: [trustOf(who, 1), army(-1), remember("m_kuhl_hintze")],
        }),
        bye("end", "warm"),
      ),
      why: node(straight, bye("done", "warm")),
      back: plain(bye()),
      letter: plain(bye("done", "warm")),
      lunch: plain(bye()),
      shut: plain(bye()),
    },
  ),

  // ---- Those who come ----
  visit(
    "deu_v2_bernstorff_cable",
    "deu_bernstorff",
    all(
      atGBR,
      any(linerSunk, flag("f_zone_declared"), uboatMin(1)),
      world({ is: "war_months", own: true, min: 5, max: 23 }),
    ),
    5,
    {
      open: node(
        [v("liner", linerSunk), v("cunning", moody(who, "cunning")), v("base")],
        r("mood", "frank", "ask", "mood", {
          effects: [remember("k_bern_line")],
        }),
        r("hold", "cold", "push", "hold", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [ifMood("mood", [remember("k_bern_line")], "cunning")],
        }),
        r("free", "warm", "deal", "free", {
          tell: ["trust:+1", "navy:-1"],
          effects: [
            trustOf(who, 1),
            { kind: "person_trust", who: { office: "navy" }, delta: -1 },
            remember("k_bern_line"),
          ],
        }),
        bye(),
      ),
      mood: node(straight, bye("done", "cold")),
      hold: plain(bye()),
      free: plain(bye("done", "warm")),
    },
  ),
  visit(
    "deu_v2_bernstorff_house",
    "deu_bernstorff",
    all(
      atGBR,
      americaAt({ min: 25 }),
      not(usIn),
      world({ is: "war_months", own: true, min: 23, max: 33 }),
    ),
    6,
    {
      open: node(
        moods("anxious", "cunning"),
        r("said", "frank", "ask", "said", {
          effects: [remember("k_bern_wilson")],
        }),
        r("bluff", "cold", "push", "bluff", {
          reacts: [ifMood("said", [remember("k_bern_wilson")], "anxious")],
        }),
        r("time", "warm", "deal", "time", {
          tell: ["promise", "trust:+1"],
          effects: [
            trustOf(who, 1),
            remember("k_bern_wilson"),
            promise(who, "p_bern_time", 6),
          ],
        }),
        bye(),
      ),
      said: node(straight, bye("done", "cold")),
      bluff: plain(bye()),
      time: plain(bye("done", "warm")),
    },
  ),
  visit(
    "deu_v2_andersen_call",
    "dnk_andersen",
    all(
      atRUS,
      any(flag("f_denmark_channel"), memory("m_andersen")),
      world({ is: "war_months", own: true, min: 5, max: 23 }),
    ),
    5,
    {
      open: node(
        moods("weary", "cunning"),
        r("king", "warm", "ask", "king", {
          gain: [remember("k_andersen")],
          miss: "tea",
        }),
        r("press", "threat", "push", "tea", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
        }),
        r("carry", "frank", "deal", "carry", {
          tell: ["auh:-1", "rus:+1"],
          effects: [
            nation("AUH", -1),
            nation("RUS", 1),
            remember("k_andersen"),
          ],
        }),
        bye("end", "warm"),
      ),
      king: plain(bye("done", "warm")),
      tea: plain(bye()),
      carry: plain(bye("done", "warm")),
    },
  ),
  visit(
    "deu_v2_parvus_bill",
    "deu_parvus",
    all(atRUS, any(memory("m_zimm_parvus"), own(7)), own(5, 35)),
    4,
    {
      open: node(
        moods("cunning", "arrogant"),
        r("sum", "cold", "ask", "sum", {
          effects: [remember("k_parvus")],
        }),
        r("out", "threat", "push", "out", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [ifMood("sum", [remember("k_parvus")], "cunning")],
        }),
        r("pay", "frank", "deal", "pay", {
          tell: ["money:-1", "rus:-1"],
          effects: [
            gauge("money", -1),
            nation("RUS", -1),
            force("RUS", "east", -1),
            remember("k_parvus"),
          ],
        }),
        bye(),
      ),
      sum: node(straight, bye("done", "cold")),
      out: plain(bye()),
      pay: plain(bye("done", "cold")),
    },
  ),
  visit(
    "deu_v2_hintze_spa",
    "deu_hintze",
    all(
      any(scoreMax(-10), memory("m_kuhl_hintze")),
      world({ is: "war_months", min: 41 }),
    ),
    6,
    {
      open: node(
        moods("cunning", "cold"),
        r("really", "cold", "ask", "really", {
          gain: [{ kind: "source", source: "staff", right: false }],
          miss: "polite",
        }),
        r("orders", "threat", "push", "polite", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
        }),
        r("carry", "frank", "deal", "carry", {
          tell: ["army:-1", "trust:+1"],
          effects: [army(-1), trustOf(who, 1), setFlag("f_hintze_told")],
        }),
        bye(),
      ),
      really: node(straight, bye("done", "cold")),
      polite: plain(
        r("again", "frank", "ask", "really", {
          gain: [{ kind: "source", source: "staff", right: false }],
          miss: null,
        }),
        bye(),
      ),
      carry: plain(bye("done", "warm")),
    },
  ),
];
