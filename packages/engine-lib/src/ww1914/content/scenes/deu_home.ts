import type {
  GwGauge,
  GwInstitution,
  GwOffice,
  GwStage,
  GwTemperament,
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
 * Germany 1915-18, the share at home: the `deu_h_` scenes, the summoned talks
 * of Helfferich, Groener, Ebert and Haase, and five visits. Data only; the text
 * is in resources/ww1914/ko/DEU.home.json. Plan: ww135-plan-deu.md sections 1,
 * 8, 10, 11, 12.
 *
 * Bread goes down by itself here, as shells do elsewhere. Every paper from the
 * army has a way to sign it as it stands and a way to bind it.
 */

const NATION: GwScene["nation"] = ["DEU"];
const WAR: GwStage[] = ["war"];

const who = role("who");
const cos = role("cos");

const HELF = "deu_helfferich";
const GROE = "deu_groener";
const EBERT = "deu_ebert";
const HAASE = "deu_haase";
const RATH = "deu_rathenau";
const BALLIN = "deu_ballin";
const SCHEID = "deu_scheidemann";

const date = (from: string, to: string): GwCond =>
  world({ is: "date", from, to });

// ---- States ----

const war: GwCond = world({ is: "war" });
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const ohl3: GwCond = flag("f_third_ohl");
const rusout: GwCond = world({ is: "out", tag: "RUS" });
const score = (max: number): GwCond => world({ is: "score", max });
const unrest = (min: number): GwCond => world({ is: "unrest", min });
const low = (g: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
const armyMax = (max: number): GwCond => ({ kind: "inst", inst: "army", max });
const reichstagMax = (max: number): GwCond => ({
  kind: "inst",
  inst: "reichstag",
  max,
});
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const known = (...keys: string[]): GwCond => any(...keys.map((k) => memory(k)));
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const broke = (key: string): GwCond => memory(`broke_${key}`);
const waits = (w: GwWho, key: string): GwCond => ({
  kind: "promise",
  who: w,
  key,
  kept: false,
  broken: false,
});
/** Wins over variants that ask less. */
const first = (c: GwCond): GwCond => all(c, war, war, war);

/** Groener runs the war office; he can be sent away from it. */
const groeOffice: GwCond = all(
  flag("f_groener_office"),
  not(flag("f_groener_out")),
);
/** The food office's books don't add up, and the seat has seen that. */
const foodBooks: GwCond = any(
  world({ is: "known", id: "deu_food_books" }),
  memory("m_food_books"),
  memory("k_erz_numbers"),
  seen("deu_h_black_market"),
);
const hardWinter: GwCond = any(
  date("1916-11", "1917-03"),
  date("1917-11", "1918-03"),
);

// ---- Effects ----

const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const army = (d: number) => inst("army", d);
const reichstag = (d: number) => inst("reichstag", d);
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const bread = (d: number) => gauge("bread", d);
const shells = (d: number) => gauge("shells", d);
const money = (d: number) => gauge("money", d);
const morale = (d: number) => gauge("morale", d);
const order = (d: number) => gauge("order", d);
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });
const calm: GwEffect = doWorld({ do: "calm" });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const unflag = (f: string): GwEffect => ({ kind: "unflag", flag: f });
const T = (n: number): GwEffect => trustOf(who, n);

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
  once: s.once ?? s.cooldown === undefined,
});

/** A record card: no option, no price, no feeling. */
const record = (id: string, when: GwCond): GwScene =>
  scene({
    id,
    kind: "report",
    when,
    cast: {},
    salience: 3,
    tags: ["home"],
    stamp: "confirmed",
    source: "press",
    variants: [v("base")],
  });

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
const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const mood = (...of: GwTemperament[]): GwCond => moody(who, ...of);
/** The door is shut: trust at the floor of what a talk can carry. */
const sour: GwCond = { kind: "person_trust", who, max: -2 };
const react = (
  c: GwCond,
  next: string | null,
  ...effects: GwEffect[]
): GwReact => ({ when: c, next, effects });
/** One line, said alike whatever the day's temper. */
const one = [v("base")];
/** The end of a talk, with nothing more in it. */
const bye = (id = "end", stance: GwStance = "cold"): GwReply =>
  r(id, stance, "leave", null);

interface TalkMore {
  /** Chapters before the topic can come again; a once topic has none. */
  cd?: number;
  intro?: GwVariant[];
}

const talkBase = (
  id: string,
  person: string,
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: TalkMore,
) => ({
  id,
  nation: NATION,
  kind: "talk" as const,
  stage: WAR,
  when,
  cast: { who: { person } },
  tags: ["people" as const],
  who: "who",
  variants: more.intro ?? [v("base")],
  start: "open",
  nodes,
  ...(more.cd === undefined ? { once: true } : { cooldown: more.cd }),
});

/** A topic on the people screen. */
const talk = (
  id: string,
  person: string,
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: TalkMore = {},
): GwScene => ({
  ...talkBase(id, person, when, nodes, more),
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
  more: TalkMore = {},
): GwScene => ({
  ...talkBase(id, person, when, nodes, more),
  salience,
});

/** Kept by the plan's scene, or by him still sitting there after the vote. */
const helfErzPromise = promise(who, "p_helf_erz", 16, {
  keep: any(
    chose("deu_k_peace_resolution", "ignore"),
    all({ kind: "in_office", who }, date("1917-11", "1918-12")),
  ),
});
/** Past August 1917 with him still at his desk is the promise kept. */
const groeStayPromise = promise(who, "p_groe_stay", 9, {
  keep: all(groeOffice, date("1917-09", "1918-12")),
});
/** Any strike ended without the list. */
const noArrestsPromise = promise(who, "p_ebert_no_arrests", 12, {
  keep: any(
    chose("deu_h_strike_april", "meet_committee"),
    chose("deu_h_strike_january", "talk_through_ebert"),
    chose("deu_h_strike_january", "ask_peace_terms"),
    chose("deu_h_strike_january", "grant_franchise"),
  ),
});

const SCENES: readonly GwScene[] = [
  // ---- Bread ----
  scene({
    id: "deu_h_bread_report",
    kind: "report",
    when: all(war, low("bread", 2), date("1915-01", "1918-12")),
    cast: {},
    salience: 7,
    tags: ["home"],
    cooldown: 3,
    stamp: "confirmed",
    source: "press",
    variants: [
      v("y18", date("1918-01", "1918-12")),
      v("y17b", date("1917-07", "1917-12")),
      v("y17a", date("1917-01", "1917-06")),
      v("y16b", date("1916-07", "1916-12")),
      v("y16a", date("1916-01", "1916-06")),
      v("base"),
    ],
  }),
  scene({
    id: "deu_h_pig_cull",
    kind: "proposal",
    when: all(war, atWar("GBR"), low("bread", 3), date("1915-01", "1915-06")),
    cast: { interior: holder("interior") },
    salience: 7,
    tags: ["home", "tension_up"],
    variants: [
      v("known", memory("k_delb_bread")),
      v("thin", low("bread", 1)),
      v("base"),
    ],
    fallback: "cull_all",
    options: [
      o(
        "cull_all",
        ["bread:+1", "order:-1"],
        [bread(1), order(-1), setFlag("f_pigs_culled"), reason("h_pigs_all")],
      ),
      o("cull_half", ["order:-1"], [order(-1), reason("h_pigs_half")]),
      o(
        "leave_market",
        ["bread:-1", "reichstag:+1"],
        [bread(-1), reichstag(1), reason("h_pigs_left")],
      ),
      o(
        "ask_farmers",
        ["money:-1"],
        [money(-1), setFlag("f_pigs_bought"), reason("h_pigs_bought")],
        memory("k_delb_bread"),
      ),
    ],
  }),
  scene({
    id: "deu_h_price_caps",
    kind: "proposal",
    when: all(war, low("bread", 2), date("1915-01", "1915-12")),
    cast: { interior: holder("interior"), finance: holder("finance") },
    salience: 6,
    tags: ["home"],
    variants: [v("pigs", chose("deu_h_pig_cull", "cull_all")), v("base")],
    fallback: "caps",
    options: [
      o(
        "caps",
        ["order:+1", "bread:-1"],
        [order(1), bread(-1), setFlag("f_price_caps"), reason("h_caps")],
      ),
      o(
        "no_caps",
        ["order:-1", "money:+1"],
        [order(-1), money(1), reason("h_no_caps")],
      ),
      o(
        "caps_with_seizure",
        ["order:+1", "reichstag:-1"],
        [
          order(1),
          reichstag(-1),
          setFlag("f_price_caps"),
          setFlag("f_grain_seized"),
          reason("h_seized"),
        ],
        memory("k_helf_debt"),
      ),
    ],
  }),
  scene({
    id: "deu_h_butter_queue",
    kind: "report",
    when: all(war, low("bread", 2), date("1915-07", "1915-12")),
    cast: {},
    salience: 5,
    tags: ["home", "tension_up"],
    stamp: "confirmed",
    source: "press",
    variants: [v("pigs", chose("deu_h_pig_cull", "cull_all")), v("base")],
  }),
  scene({
    id: "deu_h_food_office",
    kind: "proposal",
    when: all(
      war,
      low("bread", 2),
      date("1916-01", "1916-06"),
      not(flag("f_food_office")),
    ),
    cast: { interior: holder("interior"), chancellor: holder("chancellor") },
    salience: 8,
    tags: ["home"],
    variants: [
      v("thin", low("bread", 1)),
      v("queue", seen("deu_h_butter_queue")),
      v("base"),
    ],
    fallback: "office_weak",
    options: [
      o(
        "office_weak",
        ["order:+1"],
        [order(1), setFlag("f_food_office"), reason("h_office_weak")],
      ),
      o(
        "office_strong",
        ["bread:+1", "army:-1"],
        [
          bread(1),
          army(-1),
          setFlag("f_food_office"),
          setFlag("f_food_office_strong"),
          reason("h_office_strong"),
        ],
        memory("k_groe_rails"),
      ),
      o(
        "leave_states",
        ["bread:-1", "order:-1"],
        [bread(-1), order(-1), reason("h_office_none")],
      ),
    ],
  }),
  scene({
    id: "deu_h_turnip_winter",
    kind: "crisis",
    when: all(war, low("bread", 1), date("1916-11", "1917-03")),
    cast: { interior: holder("interior"), cos: holder("chief_of_staff") },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("strong", flag("f_food_office_strong")),
      v("pair", all(ohl3, war)),
      v("none", not(flag("f_food_office"))),
      v("base"),
    ],
    fallback: "ration_equal",
    options: [
      o(
        "ration_equal",
        ["morale:-1", "order:+1"],
        [morale(-1), order(1), reason("h_turnip_equal")],
      ),
      o(
        "army_share_cut",
        ["bread:+1", "army:-1", "shells:-1"],
        [bread(1), army(-1), shells(-1), authority(1), reason("h_turnip_army")],
        armyMax(3),
      ),
      o(
        "ship_from_romania",
        ["bread:+1", "ally:-1"],
        [
          bread(1),
          { kind: "trust", tag: "AUH", delta: -1 },
          reason("h_turnip_ships"),
        ],
        memory("k_groe_rails"),
      ),
      o(
        "open_cards_hidden",
        ["bread:+1", "money:-1"],
        [bread(1), money(-1), reason("h_turnip_hidden")],
        memory("k_helf_indemnity"),
      ),
    ],
  }),
  scene({
    id: "deu_h_ration_cut",
    kind: "crisis",
    when: all(
      seen("deu_h_turnip_winter"),
      low("bread", 1),
      date("1917-01", "1917-04"),
    ),
    cast: { interior: holder("interior") },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("army_cut", chose("deu_h_turnip_winter", "army_share_cut")),
      v("equal", chose("deu_h_turnip_winter", "ration_equal")),
      v("base"),
    ],
    fallback: "cut_now",
    options: [
      o(
        "cut_now",
        ["bread:+1", "order:-1"],
        [bread(1), order(-1), reason("h_cut_now")],
      ),
      o(
        "cut_with_word",
        ["bread:+1", "reichstag:+1", "army:-1"],
        [bread(1), reichstag(1), army(-1), reason("h_cut_word")],
        memory("k_ebert_franchise"),
      ),
      o(
        "delay_month",
        ["bread:-1", "morale:+1"],
        [bread(-1), morale(1), setFlag("f_cut_delayed"), reason("h_cut_delay")],
      ),
    ],
  }),

  // ---- Money ----
  scene({
    id: "deu_h_loan_drive",
    kind: "proposal",
    when: all(war, date("1915-07", "1918-06")),
    cast: { finance: holder("finance") },
    salience: 6,
    tags: ["home"],
    cooldown: 6,
    variants: [
      v("y18", date("1918-01", "1918-06")),
      v("y17", date("1917-01", "1917-12")),
      v("y16", date("1916-01", "1916-12")),
      v("base"),
    ],
    fallback: "big_drive",
    options: [
      o(
        "big_drive",
        ["money:+1", "morale:-1"],
        [money(1), morale(-1), reason("h_loan_big")],
      ),
      o(
        "tax_part",
        ["money:+1", "reichstag:-1"],
        [money(1), reichstag(-1), reason("h_loan_tax")],
        memory("k_helf_debt"),
      ),
      o("small", ["morale:+1", "money:-1"], [morale(1), money(-1)]),
    ],
  }),
  scene({
    id: "deu_h_war_profits",
    kind: "proposal",
    when: all(war, low("money", 2), date("1915-07", "1917-06")),
    cast: { finance: holder("finance"), interior: holder("interior") },
    salience: 6,
    tags: ["home"],
    variants: [
      v("queue", seen("deu_h_butter_queue")),
      v("pair", all(ohl3, war)),
      v("base"),
    ],
    fallback: "light_tax",
    options: [
      o("light_tax", ["money:+1"], [money(1), reason("h_profit_light")]),
      o(
        "real_tax",
        ["money:+1", "reichstag:+1", "shells:-1"],
        [money(1), reichstag(1), shells(-1), reason("h_profit_real")],
        known("k_groe_profits", "k_helf_books"),
      ),
      o(
        "no_tax",
        ["shells:+1", "order:-1"],
        [shells(1), order(-1), reason("h_profit_none")],
      ),
    ],
  }),

  // ---- The factories ----
  scene({
    id: "deu_h_women_work",
    kind: "proposal",
    when: all(
      war,
      world({ is: "manpower", max: 50 }),
      date("1916-01", "1917-06"),
    ),
    cast: { war: holder("war"), interior: holder("interior") },
    salience: 6,
    tags: ["home"],
    variants: [v("programme", seen("deu_h_hindenburg_programme")), v("base")],
    fallback: "leave_it",
    options: [
      o("leave_it", ["shells:-1"], [shells(-1), reason("h_women_left")]),
      o(
        "women_office",
        ["shells:+1", "manpower:+3"],
        [
          shells(1),
          men(3),
          setFlag("f_women_office"),
          reason("h_women_office"),
        ],
        memory("k_groe_unions"),
      ),
      o(
        "equal_pay_word",
        ["manpower:+2", "order:-1"],
        [men(2), order(-1), reason("h_women_pay")],
      ),
    ],
  }),
  scene({
    id: "deu_h_hindenburg_programme",
    kind: "crisis",
    when: all(war, date("1916-07", "1916-12"), any(ohl3, low("shells", 1))),
    cast: { war: holder("war"), cos: holder("chief_of_staff") },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("bauer", first(memory("k_bauer_triple"))),
      v("groener", first(memory("k_groe_numbers"))),
      v("dry", all(low("shells", 0), war)),
      v("pair", all(ohl3, war)),
      v("base"),
    ],
    fallback: "sign_full",
    options: [
      o(
        "sign_full",
        ["army:+1", "shells:+1", "bread:-1", "manpower:-3"],
        [
          army(1),
          shells(1),
          bread(-1),
          men(-3),
          setFlag("f_programme_full"),
          keepPromise(byName("deu_bauer"), "p_bauer_access"),
          reason("h_prog_full"),
        ],
      ),
      o(
        "sign_half",
        ["army:-1", "shells:+1", "authority:+1"],
        [army(-1), shells(1), authority(1), reason("h_prog_half")],
        memory("k_groe_numbers"),
      ),
      o(
        "triple_all",
        ["army:+1", "shells:+2", "bread:-1", "order:-1", "manpower:-5"],
        [
          army(1),
          shells(2),
          bread(-1),
          order(-1),
          men(-5),
          setFlag("f_programme_full"),
          keepPromise(byName("deu_bauer"), "p_bauer_access"),
          reason("h_prog_triple"),
        ],
        memory("k_bauer_triple"),
      ),
      o(
        "leave_to_ministry",
        ["army:-1", "trust:-1"],
        [army(-1), trustOf(cos, -1), reason("h_prog_ministry")],
      ),
    ],
  }),
  scene({
    id: "deu_h_war_office",
    kind: "proposal",
    when: all(seen("deu_h_hindenburg_programme"), date("1916-07", "1917-02")),
    cast: { war: holder("war"), chancellor: holder("chancellor") },
    salience: 8,
    tags: ["people"],
    variants: [
      v("full", flag("f_programme_full")),
      v("half", chose("deu_h_hindenburg_programme", "sign_half")),
      v("base"),
    ],
    fallback: "groener",
    options: [
      o(
        "groener",
        ["shells:+1", "army:-1"],
        [
          shells(1),
          army(-1),
          setFlag("f_war_office"),
          setFlag("f_groener_office"),
          trustOf(byName(GROE), 1),
          reason("h_office_groener"),
        ],
      ),
      o(
        "stein_keeps",
        ["army:+1"],
        [army(1), setFlag("f_war_office"), reason("h_office_ministry")],
      ),
      o(
        "industry_man",
        ["shells:+1", "reichstag:-1"],
        [
          shells(1),
          reichstag(-1),
          setFlag("f_war_office"),
          reason("h_office_industry"),
        ],
        memory("k_rath_office"),
      ),
    ],
  }),
  scene({
    id: "deu_h_aux_service",
    kind: "crisis",
    when: all(seen("deu_h_war_office"), date("1916-07", "1917-03")),
    cast: { chancellor: holder("chancellor"), interior: holder("interior") },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("full", all(flag("f_programme_full"), groeOffice)),
      v("groener", groeOffice),
      v("ebert", memory("k_ebert_split")),
      v("base"),
    ],
    fallback: "army_text",
    options: [
      o(
        "army_text",
        ["army:+1", "manpower:+3", "order:-1", "reichstag:-1"],
        [army(1), men(3), order(-1), reichstag(-1), reason("h_aux_army")],
      ),
      o(
        "unions_text",
        ["army:-1", "manpower:+3", "reichstag:+1", "order:+1"],
        [
          army(-1),
          men(3),
          reichstag(1),
          order(1),
          setFlag("f_aux_unions"),
          reason("h_aux_unions"),
        ],
        known("k_groe_unions", "k_ebert_split"),
      ),
      o(
        "no_law",
        ["army:-1", "shells:-1"],
        [army(-1), shells(-1), reason("h_aux_none")],
      ),
    ],
  }),
  scene({
    id: "deu_h_unions_table",
    kind: "dispute",
    when: all(
      chose("deu_h_aux_service", "unions_text"),
      groeOffice,
      date("1917-01", "1917-09"),
    ),
    cast: { war: holder("war"), interior: holder("interior") },
    salience: 7,
    tags: ["home"],
    variants: [
      v("promised", waits(byName(GROE), "p_groe_stay")),
      v("profits", memory("k_groe_profits")),
      v("base"),
    ],
    fallback: "back_groener",
    options: [
      o(
        "back_groener",
        ["order:+1", "shells:-1"],
        [
          order(1),
          shells(-1),
          keepPromise(byName(GROE), "p_groe_stay"),
          trustOf(byName(GROE), 1),
          reason("h_table_groener"),
        ],
      ),
      o(
        "back_owners",
        ["shells:+1", "order:-1", "army:+1"],
        [
          shells(1),
          order(-1),
          army(1),
          setFlag("f_groener_out"),
          unflag("f_groener_office"),
          trustOf(byName(GROE), -2),
          reason("h_table_owners"),
        ],
      ),
      o(
        "split_wages",
        ["money:-1", "order:+1"],
        [
          money(-1),
          order(1),
          keepPromise(byName(GROE), "p_groe_stay"),
          reason("h_table_split"),
        ],
        memory("k_groe_profits"),
      ),
    ],
  }),
  scene({
    id: "deu_h_coal_winter",
    kind: "proposal",
    when: all(war, low("order", 3), hardWinter),
    cast: { interior: holder("interior"), war: holder("war") },
    salience: 6,
    tags: ["home"],
    variants: [v("programme", flag("f_programme_full")), v("base")],
    fallback: "factories_first",
    options: [
      o(
        "factories_first",
        ["shells:+1", "morale:-1"],
        [shells(1), morale(-1), reason("h_coal_factories")],
      ),
      o(
        "cities_first",
        ["morale:+1", "order:+1", "shells:-1"],
        [morale(1), order(1), shells(-1), reason("h_coal_cities")],
        memory("k_groe_rails"),
      ),
      o("split_by_week", ["order:-1"], [order(-1), reason("h_coal_split")]),
    ],
  }),

  // ---- The streets ----
  scene({
    id: "deu_h_strike_april",
    kind: "crisis",
    when: all(
      war,
      low("order", 2),
      any(unrest(1), seen("deu_h_ration_cut")),
      date("1917-03", "1917-06"),
    ),
    cast: { interior: holder("interior"), cos: holder("chief_of_staff") },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("arrests", memory("arrests_done")),
      v("banned", memory("rally_banned")),
      v("allowed", memory("rally_allowed")),
      v("base"),
    ],
    fallback: "meet_committee",
    options: [
      o(
        "meet_committee",
        ["order:+1", "army:-1"],
        [order(1), army(-1), calm, reason("h_april_met")],
      ),
      o(
        "army_control",
        ["shells:+1", "army:+1", "order:-1", "reichstag:-1"],
        [
          shells(1),
          army(1),
          order(-1),
          reichstag(-1),
          setFlag("f_factories_under_army"),
          reason("h_april_army"),
        ],
      ),
      o(
        "speak_bread_only",
        ["bread:-1", "order:+1"],
        [bread(-1), order(1), calm, reason("h_april_bread")],
        memory("k_ebert_strike"),
      ),
    ],
  }),
  scene({
    id: "deu_h_strike_january",
    kind: "crisis",
    when: all(
      war,
      low("order", 2),
      any(seen("deu_h_strike_april"), unrest(2)),
      date("1918-01", "1918-06"),
    ),
    cast: {
      interior: holder("interior"),
      chancellor: holder("chancellor"),
      cos: holder("chief_of_staff"),
    },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("broke", first(broke("p_ebert_franchise"))),
      v("promised", waits(byName(EBERT), "p_ebert_no_arrests")),
      v("army", chose("deu_h_strike_april", "army_control")),
      v("met", chose("deu_h_strike_april", "meet_committee")),
      v("base"),
    ],
    fallback: "talk_through_ebert",
    options: [
      o(
        "talk_through_ebert",
        ["order:+1", "army:-1", "trust:+1"],
        [
          order(1),
          army(-1),
          calm,
          trustOf(byName(EBERT), 1),
          keepPromise(byName(EBERT), "p_ebert_no_arrests"),
          reason("h_jan_ebert"),
        ],
      ),
      o(
        "military_rule",
        ["army:+1", "shells:+1", "reichstag:-2", "order:-1"],
        [
          army(1),
          shells(1),
          reichstag(-2),
          order(-1),
          trustOf(byName(EBERT), -2),
          reason("h_jan_army"),
        ],
      ),
      o(
        "ask_peace_terms",
        ["order:+1", "reichstag:+1", "army:-2"],
        [
          order(1),
          reichstag(1),
          army(-2),
          calm,
          setFlag("f_jan_terms_heard"),
          reason("h_jan_terms"),
        ],
        memory("k_ebert_strike"),
      ),
      o(
        "grant_franchise",
        ["order:+2", "reichstag:+2", "army:-2"],
        [
          order(2),
          reichstag(2),
          army(-2),
          calm,
          setFlag("f_jan_franchise"),
          keepPromise(byName(EBERT), "p_ebert_franchise"),
          reason("h_jan_franchise"),
        ],
        memory("k_ebert_franchise"),
      ),
    ],
  }),
  scene({
    id: "deu_h_fleet_food",
    kind: "proposal",
    when: all(war, atWar("GBR"), low("bread", 1), date("1917-01", "1917-10")),
    cast: { navy: holder("navy") },
    salience: 6,
    tags: ["home", "tension_up"],
    variants: [v("cut", seen("deu_h_ration_cut")), v("base")],
    fallback: "leave_it",
    options: [
      o("leave_it", ["order:-1"], [order(-1), reason("h_fleet_left")]),
      o(
        "food_committee",
        ["order:+1", "trust:-1"],
        [
          order(1),
          trustOf(role("navy"), -1),
          setFlag("f_fleet_committee"),
          reason("h_fleet_committee"),
        ],
        memory("k_haase_fleet"),
      ),
      o(
        "officers_rule",
        ["trust:+1", "order:-1"],
        [trustOf(role("navy"), 1), order(-1), reason("h_fleet_officers")],
      ),
    ],
  }),
  record(
    "deu_h_fleet_record",
    all(seen("deu_h_fleet_food"), low("order", 2), date("1917-08", "1917-12")),
  ),
  scene({
    id: "deu_h_spd_split",
    kind: "report",
    when: all(
      war,
      any(seen("gw_credits"), reichstagMax(0)),
      date("1915-12", "1916-06"),
    ),
    cast: {},
    salience: 7,
    tags: ["home", "tension_up"],
    stamp: "confirmed",
    source: "press",
    variants: [
      v("march", date("1916-03", "1916-06")),
      v("met", memory("k_haase_met")),
      v("base"),
    ],
  }),
  scene({
    id: "deu_h_liebknecht_may",
    kind: "proposal",
    when: all(
      war,
      any(low("order", 3), memory("k_haase_met")),
      date("1916-05", "1916-06"),
    ),
    cast: { interior: holder("interior"), war: holder("war") },
    salience: 7,
    tags: ["home", "tension_up"],
    variants: [
      v("law", memory("k_haase_law")),
      v("arrests", memory("arrests_done")),
      v("base"),
    ],
    fallback: "court_martial",
    options: [
      o(
        "court_martial",
        ["army:+1", "order:-1", "reichstag:-1"],
        [
          army(1),
          order(-1),
          reichstag(-1),
          setFlag("f_lieb_court_martial"),
          reason("h_lieb_court"),
        ],
      ),
      o(
        "civil_trial",
        ["reichstag:+1", "army:-1"],
        [reichstag(1), army(-1), reason("h_lieb_civil")],
        memory("k_haase_law"),
      ),
      o(
        "leave_him",
        ["army:-1", "morale:-1", "order:+1"],
        [army(-1), morale(-1), order(1), reason("h_lieb_left")],
      ),
    ],
  }),
  scene({
    id: "deu_h_censor",
    kind: "proposal",
    when: all(war, date("1915-07", "1915-12")),
    cast: { interior: holder("interior"), cos: holder("chief_of_staff") },
    salience: 5,
    tags: ["home"],
    variants: [v("numbers", memory("k_erz_numbers")), v("base")],
    fallback: "leave_generals",
    options: [
      o(
        "leave_generals",
        ["army:+1", "reichstag:-1"],
        [army(1), reichstag(-1), reason("h_censor_generals")],
      ),
      o(
        "one_censor",
        ["army:-1", "reichstag:+1", "authority:+1"],
        [army(-1), reichstag(1), authority(1), reason("h_censor_one")],
        memory("k_erz_numbers"),
      ),
      o(
        "press_office",
        ["morale:+1", "reichstag:-1"],
        [morale(1), reichstag(-1), reason("h_censor_office")],
      ),
    ],
  }),
  record("deu_h_census_record", all(war, date("1916-10", "1916-12"))),
  // One sentence of record: never the result of a choice (plan section 17).
  record("deu_h_ballin_record", date("1918-11", "1918-12")),
  scene({
    id: "deu_h_black_market",
    kind: "report",
    when: all(war, low("bread", 1), date("1916-07", "1918-06")),
    cast: {},
    salience: 5,
    tags: ["home"],
    cooldown: 6,
    stamp: "unconfirmed",
    source: "press",
    variants: [
      v("y18", date("1918-01", "1918-06")),
      v("y17", date("1917-01", "1917-12")),
      v("base"),
    ],
  }),
  scene({
    id: "deu_h_wounded_home",
    kind: "proposal",
    when: all(
      war,
      world({ is: "casualties", min: 500 }),
      date("1916-01", "1917-12"),
    ),
    cast: { interior: holder("interior") },
    salience: 4,
    tags: ["home", "tension_down"],
    variants: [v("sons", memory("k_ebert_sons")), v("base")],
    fallback: "old_pension",
    options: [
      o("old_pension", ["morale:-1"], [morale(-1), reason("h_wounded_old")]),
      o(
        "new_law",
        ["morale:+1", "money:-1", "reichstag:+1"],
        [morale(1), money(-1), reichstag(1), reason("h_wounded_law")],
        memory("k_ebert_sons"),
      ),
      o(
        "jobs_first",
        ["manpower:+2", "money:-1"],
        [men(2), money(-1), reason("h_wounded_jobs")],
      ),
    ],
  }),
  scene({
    id: "deu_h_fatherland_party",
    kind: "proposal",
    when: all(
      war,
      any(memory("k_tirp_party"), seen("deu_k_peace_resolution")),
      not(holds("navy", "deu_tirpitz")),
      date("1917-09", "1917-12"),
    ),
    cast: { chancellor: holder("chancellor"), interior: holder("interior") },
    salience: 7,
    tags: ["home", "tension_up"],
    variants: [
      v("pair", all(ohl3, seen("deu_k_peace_resolution"))),
      v("resolved", seen("deu_k_peace_resolution")),
      v("base"),
    ],
    fallback: "leave_it",
    options: [
      o("leave_it", ["reichstag:-1"], [reichstag(-1), reason("h_party_left")]),
      o(
        "ban_in_army",
        ["army:-1", "reichstag:+1"],
        [army(-1), reichstag(1), reason("h_party_banned")],
      ),
      o(
        "bless_it",
        ["army:+1", "morale:+1", "reichstag:-2"],
        [army(1), morale(1), reichstag(-2), reason("h_party_blessed")],
        memory("k_bauer_press"),
      ),
    ],
  }),
  scene({
    id: "deu_h_hunger_truth",
    kind: "proposal",
    when: all(
      war,
      foodBooks,
      known("k_helf_books", "k_erz_numbers", "m_food_books"),
      date("1917-07", "1918-06"),
    ),
    cast: { interior: holder("interior"), chancellor: holder("chancellor") },
    salience: 7,
    tags: ["home"],
    variants: [v("helf", memory("k_helf_books")), v("base")],
    fallback: "keep_books",
    options: [
      o("keep_books", ["order:-1"], [order(-1), reason("h_books_kept")]),
      o(
        "publish_truth",
        ["morale:-1", "reichstag:+2", "order:+1"],
        [morale(-1), reichstag(2), order(1), reason("h_books_open")],
      ),
      o(
        "show_reichstag_only",
        ["reichstag:+1"],
        [reichstag(1), reason("h_books_committee")],
      ),
    ],
  }),
];

const HELF_TALKS: readonly GwScene[] = [
  talk("deu_t2_helf_debt", HELF, all(war, date("1915-01", "1915-12")), {
    open: node(
      [v("cold", mood("cold")), v("base")],
      r("ask", "flatter", "ask", "sum", {
        gain: [remember("k_helf_debt")],
        miss: "brief",
      }),
      r("frank", "frank", "ask", "sum", {
        gain: [remember("k_helf_debt")],
        miss: "brief",
      }),
      r("push", "threat", "push", "brief", {
        tell: ["trust:-1"],
        effects: [T(-1)],
        reacts: [react(mood("cold"), "sum", remember("k_helf_debt"))],
      }),
      r("seat", "warm", "deal", "sum", {
        tell: ["money:+1", "trust:+1"],
        effects: [
          money(1),
          T(1),
          maybe(not(holds("finance", HELF)), {
            kind: "appoint",
            who: byName(HELF),
            office: "finance",
          }),
          remember("k_helf_debt"),
        ],
      }),
      r("later", "cold", "leave", null),
    ),
    sum: node(
      one,
      r("who", "cold", "ask", "loser"),
      r("mark", "frank", "leave", null),
    ),
    loser: node(one, r("mark", "frank", "leave", null), bye("smile", "warm")),
    brief: node(
      one,
      r("again", "cold", "push", "sum", {
        effects: [remember("k_helf_debt")],
        reacts: [react(sour, null, reason("h_helf_shut"))],
      }),
      bye(),
    ),
  }),
  talk(
    "deu_t2_helf_books",
    HELF,
    all(war, low("money", 2), date("1915-07", "1917-06")),
    {
      open: node(
        [v("cold", mood("cold")), v("base")],
        r("ask", "cold", "ask", "book", { miss: "show" }),
        r("flat", "flatter", "ask", "book", { miss: "show" }),
        r("push", "threat", "push", "show", {
          tell: ["trust:-1"],
          effects: [T(-1), remember("k_helf_books")],
          reacts: [react(sour, null, reason("h_helf_shut"))],
        }),
        r("deal", "frank", "deal", "book", {
          tell: ["reichstag:-1", "trust:+1"],
          effects: [reichstag(-1), T(1), remember("k_helf_books")],
        }),
        r("later", "warm", "leave", null),
      ),
      show: node(
        one,
        r("read", "cold", "ask", "book", {
          effects: [remember("k_helf_books")],
        }),
        bye(),
      ),
      book: node(
        [v("straight", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("k_helf_books")],
        }),
        r("after", "cold", "ask", "after", {
          effects: [remember("k_helf_books")],
        }),
      ),
      after: node(one, bye(), bye("thanks", "warm")),
    },
  ),
  talk(
    "deu_t2_helf_no",
    HELF,
    all(
      war,
      atWar("GBR"),
      world({ is: "uboat", max: 1 }),
      date("1916-01", "1917-06"),
    ),
    {
      open: node(
        [v("cold", mood("cold")), v("base")],
        r("ask", "flatter", "ask", "sum", { miss: "dry" }),
        r("cold", "cold", "ask", "sum", { miss: "dry" }),
        r("push", "threat", "push", "dry", {
          tell: ["trust:-1"],
          effects: [T(-1)],
          reacts: [react(mood("arrogant"), null, reason("h_helf_shut"))],
        }),
        r("deal", "frank", "deal", "sum", {
          tell: ["trust:+1", "army:-1"],
          effects: [T(1), army(-1), remember("k_helf_no")],
        }),
        r("later", "warm", "leave", null),
      ),
      dry: node(
        one,
        r("again", "frank", "ask", "sum", {
          reacts: [react(sour, null, reason("h_helf_shut"))],
        }),
        bye(),
      ),
      sum: node(
        one,
        r("mark", "frank", "leave", null, {
          effects: [remember("k_helf_no")],
        }),
        r("convoy", "cold", "ask", "convoy", {
          effects: [remember("k_helf_no")],
        }),
      ),
      convoy: node(
        [v("straight", candid(who)), v("base")],
        r("note", "frank", "leave", null, {
          effects: [doWorld({ do: "reveal", id: "deu_table_wrong" })],
        }),
        bye(),
      ),
    },
  ),
  talk("deu_t2_helf_indemnity", HELF, all(war, date("1916-01", "1917-12")), {
    open: node(
      [v("lost", score(-10)), v("cold", mood("cold")), v("base")],
      r("ask", "cold", "ask", "ledger", { miss: "line" }),
      r("flat", "flatter", "ask", "ledger", { miss: "line" }),
      r("push", "threat", "push", "line", {
        tell: ["trust:-1"],
        effects: [T(-1)],
        reacts: [react(mood("cold"), "ledger")],
      }),
      r("deal", "frank", "deal", "ledger", {
        tell: ["money:-1", "trust:+1"],
        effects: [money(-1), T(1), remember("k_helf_indemnity")],
      }),
      r("later", "warm", "leave", null),
    ),
    line: node(one, r("again", "frank", "ask", "ledger"), bye()),
    ledger: node(
      one,
      r("mark", "cold", "leave", null, {
        effects: [remember("k_helf_indemnity")],
      }),
      r("grain", "frank", "ask", "grain", {
        effects: [remember("k_helf_indemnity")],
      }),
    ),
    grain: node(
      [v("straight", candid(who)), v("base")],
      r("note", "cold", "leave", null, {
        effects: [remember("m_food_books"), doWorld({ do: "reveal", id: "deu_food_books" }), reason("h_books_found")],
      }),
      bye("drop", "warm"),
    ),
  }),
  talk("deu_t2_helf_erz", HELF, all(war, date("1916-07", "1917-12")), {
    open: node(
      [v("cold", mood("cold")), v("base")],
      r("ask", "cold", "ask", "what", { miss: "file" }),
      r("flat", "flatter", "ask", "what", { miss: "file" }),
      r("push", "threat", "push", "file", {
        tell: ["trust:-1"],
        effects: [T(-1)],
        reacts: [react(mood("cold"), "what")],
      }),
      r("deal", "warm", "deal", "bargain", {
        tell: ["trust:+1"],
        effects: [T(1), helfErzPromise],
      }),
      r("later", "frank", "leave", null),
    ),
    file: node(
      one,
      r("read", "cold", "ask", "what", {
        effects: [remember("m_helf_erz_quarrel")],
      }),
      bye(),
    ),
    what: node(
      one,
      r("mark", "frank", "leave", null, {
        effects: [remember("m_helf_erz_quarrel")],
      }),
      r("deal", "warm", "deal", "bargain", {
        tell: ["trust:+1"],
        effects: [T(1), helfErzPromise],
      }),
    ),
    bargain: node(one, bye("end", "frank")),
  }),
  talk(
    "deu_t2_helf_after",
    HELF,
    all(
      war,
      not(holds("interior", HELF)),
      not(holds("finance", HELF)),
      date("1917-07", "1918-12"),
    ),
    {
      open: node(
        [v("lost", score(-15)), v("cold", mood("cold")), v("base")],
        r("ask", "frank", "ask", "end_of", { miss: "sore" }),
        r("flat", "flatter", "ask", "end_of", { miss: "sore" }),
        r("push", "cold", "push", "sore"),
        r("deal", "warm", "deal", "end_of", {
          tell: ["trust:+1"],
          effects: [T(1)],
        }),
        r("later", "cold", "leave", null),
      ),
      sore: node(one, r("again", "cold", "ask", "end_of"), bye()),
      end_of: node(
        [v("straight", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_helf_last_sum")],
        }),
        bye("plain"),
      ),
    },
  ),
];

const GROE_TALKS: readonly GwScene[] = [
  talk("deu_t2_groe_rails", GROE, all(war, date("1915-01", "1916-12")), {
    open: node(
      [v("stubborn", mood("stubborn")), v("base")],
      r("ask", "cold", "ask", "wagons", {
        gain: [remember("k_groe_rails")],
        miss: "table",
      }),
      r("frank", "frank", "ask", "wagons", {
        gain: [remember("k_groe_rails")],
      }),
      r("push", "threat", "push", "table", {
        tell: ["trust:-1"],
        effects: [T(-1)],
        reacts: [react(mood("cold"), "wagons", remember("k_groe_rails"))],
      }),
      r("deal", "warm", "deal", "wagons", {
        tell: ["army:-1", "trust:+1"],
        effects: [army(-1), T(1), remember("k_groe_rails")],
      }),
      r("later", "warm", "leave", null),
    ),
    table: node(
      one,
      r("again", "frank", "ask", "wagons", {
        effects: [remember("k_groe_rails")],
      }),
      bye(),
    ),
    wagons: node(
      one,
      r("grain", "frank", "ask", "grain"),
      r("mark", "cold", "leave", null),
    ),
    grain: node(one, bye("end", "frank")),
  }),
  talk(
    "deu_t2_groe_unions",
    GROE,
    all(war, any(flag("f_war_office"), ohl3), date("1916-07", "1917-06")),
    {
      open: node(
        [v("stubborn", mood("stubborn")), v("base")],
        r("ask", "frank", "ask", "how", {
          gain: [remember("k_groe_unions")],
          miss: "rank",
        }),
        r("cold", "cold", "ask", "how", {
          gain: [remember("k_groe_unions")],
          miss: "rank",
        }),
        r("push", "threat", "push", "rank", {
          tell: ["trust:-1"],
          effects: [T(-1)],
        }),
        r("deal", "warm", "deal", "how", {
          tell: ["army:-1", "reichstag:+1"],
          effects: [army(-1), reichstag(1), remember("k_groe_unions")],
        }),
        r("later", "cold", "leave", null),
      ),
      rank: node(
        one,
        r("sit", "warm", "ask", "how", {
          effects: [remember("k_groe_unions")],
        }),
        bye(),
      ),
      how: node(
        one,
        r("bauer", "frank", "ask", "enemies"),
        r("mark", "cold", "leave", null),
      ),
      enemies: node(one, bye("end", "frank")),
    },
  ),
  talk(
    "deu_t2_groe_numbers",
    GROE,
    all(war, ohl3, date("1916-07", "1917-12")),
    {
      open: node(
        [
          v("full", flag("f_programme_full")),
          v("stubborn", mood("stubborn")),
          v("base"),
        ],
        r("ask", "cold", "ask", "sums", {
          gain: [remember("k_groe_numbers")],
          miss: "paper",
        }),
        r("frank", "frank", "ask", "sums", {
          gain: [remember("k_groe_numbers")],
          miss: "paper",
        }),
        r("push", "threat", "push", "paper", {
          tell: ["trust:-1"],
          effects: [T(-1)],
          reacts: [react(mood("stubborn"), null, reason("h_groe_walked"))],
        }),
        r("deal", "warm", "deal", "sums", {
          tell: ["army:-1", "trust:+1"],
          effects: [army(-1), T(1), remember("k_groe_numbers")],
        }),
        r("later", "warm", "leave", null),
      ),
      paper: node(
        one,
        r("read", "frank", "ask", "sums", {
          effects: [remember("k_groe_numbers")],
        }),
        bye(),
      ),
      sums: node(
        one,
        r("who", "cold", "ask", "colonel"),
        r("mark", "frank", "leave", null),
      ),
      colonel: node(one, bye("end", "cold")),
    },
  ),
  talk(
    "deu_t2_groe_profits",
    GROE,
    all(war, groeOffice, date("1917-01", "1917-08")),
    {
      open: node(
        [v("stubborn", mood("stubborn")), v("base")],
        r("ask", "frank", "ask", "memo", {
          gain: [remember("k_groe_profits")],
          miss: "wall",
        }),
        r("cold", "cold", "ask", "memo", {
          gain: [remember("k_groe_profits")],
          miss: "wall",
        }),
        r("push", "threat", "push", "wall", {
          tell: ["trust:-1"],
          effects: [T(-1)],
          reacts: [react(mood("cold"), "memo", remember("k_groe_profits"))],
        }),
        r("deal", "warm", "deal", "stay", {
          tell: ["trust:+1", "army:-1"],
          effects: [
            T(1),
            army(-1),
            remember("k_groe_profits"),
            groeStayPromise,
          ],
        }),
        r("later", "cold", "leave", null),
      ),
      wall: node(
        one,
        r("again", "frank", "ask", "memo", {
          effects: [remember("k_groe_profits")],
        }),
        bye(),
      ),
      memo: node(
        one,
        r("stay", "warm", "deal", "stay", {
          tell: ["trust:+1"],
          effects: [T(1), groeStayPromise],
        }),
        r("mark", "cold", "leave", null),
      ),
      stay: node(one, bye("end", "frank")),
    },
  ),
  talk(
    "deu_t2_groe_east",
    GROE,
    all(
      war,
      not(groeOffice),
      any(rusout, date("1917-07", "1918-06")),
      date("1917-07", "1918-06"),
    ),
    {
      open: node(
        [
          v("broke", first(broke("p_groe_stay"))),
          v("out", all(flag("f_groener_out"), war)),
          v("stubborn", mood("stubborn")),
          v("base"),
        ],
        r("ask", "frank", "ask", "grain", { miss: "orders" }),
        r("cold", "cold", "ask", "grain", { miss: "orders" }),
        r("push", "threat", "push", "orders", {
          tell: ["trust:-1"],
          effects: [T(-1)],
          reacts: [react(broke("p_groe_stay"), null, reason("h_groe_walked"))],
        }),
        r("deal", "warm", "deal", "grain", {
          tell: ["trust:+1", "army:-1"],
          effects: [T(1), army(-1), remember("m_groe_back_channel")],
        }),
        r("later", "cold", "leave", null),
      ),
      orders: node(one, r("again", "frank", "ask", "grain"), bye()),
      grain: node(
        [v("straight", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_groe_grain")],
        }),
        bye(),
      ),
    },
  ),
  talk(
    "deu_t2_groe_truth",
    GROE,
    all(war, score(0), date("1917-07", "1918-12")),
    {
      open: node(
        [v("lost", score(-20)), v("stubborn", mood("stubborn")), v("base")],
        r("ask", "frank", "ask", "can", {
          gain: [remember("k_groe_truth")],
          miss: "duty",
        }),
        r("cold", "cold", "ask", "can", {
          gain: [remember("k_groe_truth")],
          miss: "duty",
        }),
        r("push", "threat", "push", "duty", {
          tell: ["trust:-1"],
          effects: [T(-1)],
          reacts: [react(mood("cold"), "can", remember("k_groe_truth"))],
        }),
        r("deal", "warm", "deal", "can", {
          tell: ["army:-1", "trust:+1"],
          effects: [army(-1), T(1), remember("k_groe_truth")],
        }),
        r("later", "warm", "leave", null),
      ),
      duty: node(
        one,
        r("again", "frank", "ask", "can", {
          effects: [remember("k_groe_truth")],
        }),
        bye(),
      ),
      can: node(
        one,
        r("after", "frank", "ask", "after"),
        r("mark", "cold", "leave", null),
      ),
      after: node(one, bye("end", "frank")),
    },
  ),
];

const EBERT_TALKS: readonly GwScene[] = [
  talk(
    "deu_t2_ebert_first",
    EBERT,
    all(
      war,
      any(memory("k_delb_bridge"), reichstagMax(1)),
      date("1915-01", "1916-06"),
    ),
    {
      open: node(
        [
          v("arrests", memory("arrests_done")),
          v("banned", memory("rally_banned")),
          v("allowed", memory("rally_allowed")),
          v("weary", mood("weary")),
          v("base"),
        ],
        r("ask", "frank", "ask", "dues", {
          gain: [remember("k_ebert_first")],
          miss: "minutes",
        }),
        r("warm", "warm", "ask", "dues", {
          gain: [remember("k_ebert_first")],
          miss: "minutes",
        }),
        r("push", "threat", "push", "minutes", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [react(mood("cold"), "dues", remember("k_ebert_first"))],
        }),
        r("deal", "cold", "deal", "dues", {
          tell: ["reichstag:+1", "army:-1"],
          effects: [reichstag(1), army(-1), remember("k_ebert_first")],
        }),
        r("later", "cold", "leave", null),
      ),
      minutes: node(
        one,
        r("again", "frank", "ask", "dues", {
          effects: [remember("k_ebert_first")],
        }),
        bye(),
      ),
      dues: node(
        one,
        r("haase", "frank", "ask", "haase"),
        r("mark", "cold", "leave", null),
      ),
      haase: node(one, bye("end", "warm")),
    },
  ),
  talk(
    "deu_t2_ebert_split",
    EBERT,
    all(war, memory("k_ebert_first"), date("1915-07", "1916-12")),
    {
      open: node(
        [
          v("after", seen("deu_h_spd_split")),
          v("weary", mood("weary")),
          v("base"),
        ],
        r("ask", "frank", "ask", "count", {
          gain: [remember("k_ebert_split")],
          miss: "closed",
        }),
        r("warm", "warm", "ask", "count", {
          gain: [remember("k_ebert_split")],
          miss: "closed",
        }),
        r("push", "threat", "push", "closed", {
          tell: ["trust:-1"],
          effects: [T(-1)],
          reacts: [react(mood("weary"), "count", remember("k_ebert_split"))],
        }),
        r("deal", "cold", "deal", "count", {
          tell: ["reichstag:+1", "army:-1"],
          effects: [reichstag(1), army(-1), remember("k_ebert_split")],
        }),
        r("later", "cold", "leave", null),
      ),
      closed: node(
        one,
        r("again", "frank", "ask", "count", {
          effects: [remember("k_ebert_split")],
        }),
        bye(),
      ),
      count: node(
        one,
        r("price", "cold", "ask", "price"),
        r("mark", "frank", "leave", null),
      ),
      price: node(one, bye("end", "frank")),
    },
  ),
  talk(
    "deu_t2_ebert_franchise",
    EBERT,
    all(war, memory("k_ebert_first"), date("1916-01", "1917-12")),
    {
      open: node(
        [
          v("russia", date("1917-03", "1917-12")),
          v("weary", mood("weary")),
          v("base"),
        ],
        r("ask", "frank", "ask", "law", {
          gain: [remember("k_ebert_franchise")],
          miss: "plain",
        }),
        r("cold", "cold", "ask", "law", {
          gain: [remember("k_ebert_franchise")],
          miss: "plain",
        }),
        r("push", "threat", "push", "plain", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [
            react(mood("stubborn"), "law", remember("k_ebert_franchise")),
          ],
        }),
        r("deal", "warm", "deal", "word", {
          tell: ["reichstag:+1", "trust:+1"],
          effects: [
            reichstag(1),
            T(1),
            remember("k_ebert_franchise"),
            promise(who, "p_ebert_franchise", 14, {
              keep: any(
                chose("deu_k_easter_message", "equal_vote_word"),
                chose("deu_h_strike_january", "grant_franchise"),
              ),
            }),
          ],
        }),
        r("later", "cold", "leave", null),
      ),
      plain: node(
        one,
        r("again", "frank", "ask", "law", {
          effects: [remember("k_ebert_franchise")],
        }),
        bye(),
      ),
      law: node(
        one,
        r("word", "warm", "deal", "word", {
          tell: ["trust:+1"],
          effects: [
            T(1),
            promise(who, "p_ebert_franchise", 14, {
              keep: any(
                chose("deu_k_easter_message", "equal_vote_word"),
                chose("deu_h_strike_january", "grant_franchise"),
              ),
            }),
          ],
        }),
        r("mark", "cold", "leave", null),
      ),
      word: node(one, bye("end", "frank")),
    },
  ),
  talk(
    "deu_t2_ebert_sons",
    EBERT,
    all(war, memory("k_ebert_first"), date("1917-03", "1917-12")),
    {
      open: node(
        [v("both", date("1917-06", "1917-12")), v("base")],
        r("warm", "warm", "ask", "sons", {
          effects: [remember("k_ebert_sons")],
        }),
        r("work", "cold", "leave", null),
      ),
      sons: node(
        [v("both", date("1917-06", "1917-12")), v("base")],
        r("still", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [T(1)],
        }),
        r("law", "frank", "ask", "law"),
      ),
      law: node(one, bye("end", "warm")),
    },
  ),
  talk(
    "deu_t2_ebert_strike",
    EBERT,
    all(
      war,
      memory("k_ebert_first"),
      any(unrest(1), seen("deu_h_ration_cut")),
      date("1917-01", "1918-06"),
    ),
    {
      open: node(
        [
          v("after", seen("deu_h_strike_april")),
          v("weary", mood("weary")),
          v("base"),
        ],
        r("ask", "frank", "ask", "inside", {
          gain: [remember("k_ebert_strike")],
          miss: "rule",
        }),
        r("cold", "cold", "ask", "inside", {
          gain: [remember("k_ebert_strike")],
          miss: "rule",
        }),
        r("push", "threat", "push", "rule", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [react(mood("cold"), "inside", remember("k_ebert_strike"))],
        }),
        r("deal", "warm", "deal", "pledge", {
          tell: ["army:-1", "trust:+1"],
          effects: [
            army(-1),
            T(1),
            remember("k_ebert_strike"),
            noArrestsPromise,
          ],
        }),
        r("later", "cold", "leave", null),
      ),
      rule: node(
        one,
        r("again", "frank", "ask", "inside", {
          effects: [remember("k_ebert_strike")],
        }),
        bye(),
      ),
      inside: node(
        one,
        r("pledge", "warm", "deal", "pledge", {
          tell: ["army:-1", "trust:+1"],
          effects: [army(-1), T(1), noArrestsPromise],
        }),
        r("mark", "cold", "leave", null),
      ),
      pledge: node(one, bye("end", "frank")),
    },
  ),
  talk(
    "deu_t2_ebert_breach",
    EBERT,
    all(war, any(score(-25), seen("deu_k_spa")), date("1918-07", "1918-12")),
    {
      open: node(
        [v("spa", seen("deu_k_spa")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "gap", {
          gain: [remember("k_ebert_breach")],
          miss: "bill",
        }),
        r("cold", "cold", "ask", "gap", {
          gain: [remember("k_ebert_breach")],
          miss: "bill",
        }),
        r("push", "threat", "push", "bill", {
          tell: ["trust:-1"],
          effects: [T(-1)],
          reacts: [
            react(mood("cold", "stubborn"), "gap", remember("k_ebert_breach")),
          ],
        }),
        r("deal", "warm", "deal", "gap", {
          tell: ["army:-2", "reichstag:+2"],
          effects: [army(-2), reichstag(2), remember("k_ebert_breach")],
        }),
        r("later", "cold", "leave", null),
      ),
      bill: node(
        one,
        r("again", "frank", "ask", "gap", {
          effects: [remember("k_ebert_breach")],
        }),
        bye(),
      ),
      gap: node(
        one,
        r("crown", "frank", "ask", "crown"),
        r("mark", "cold", "leave", null),
      ),
      crown: node(one, bye("end", "frank")),
    },
  ),
];

const HAASE_TALKS: readonly GwScene[] = [
  talk(
    "deu_t2_haase_no",
    HAASE,
    all(
      war,
      any(memory("k_haase_met"), reichstagMax(0)),
      date("1915-01", "1915-12"),
    ),
    {
      open: node(
        [
          v("told", memory("haase_was_told_no_list")),
          v("anxious", mood("anxious")),
          v("weary", mood("weary")),
          v("base"),
        ],
        r("ask", "frank", "ask", "count", {
          gain: [remember("k_haase_met")],
          miss: "clause",
        }),
        r("warm", "warm", "ask", "count", {
          gain: [remember("k_haase_met")],
          miss: "clause",
        }),
        r("push", "threat", "push", "clause", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [react(mood("anxious"), "count", remember("k_haase_met"))],
        }),
        r("deal", "cold", "deal", "count", {
          tell: ["army:-1", "reichstag:+1"],
          effects: [army(-1), reichstag(1), remember("k_haase_met")],
        }),
        r("later", "cold", "leave", null),
      ),
      clause: node(
        one,
        r("again", "frank", "ask", "count", {
          effects: [remember("k_haase_met")],
        }),
        bye(),
      ),
      count: node(
        [v("straight", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_haase_votes")],
        }),
        bye(),
      ),
    },
  ),
  talk(
    "deu_t2_haase_law",
    HAASE,
    all(
      war,
      any(memory("k_haase_met"), seen("deu_h_spd_split")),
      date("1915-07", "1916-06"),
    ),
    {
      open: node(
        [v("anxious", mood("anxious")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "article", {
          gain: [remember("k_haase_law")],
          miss: "brief",
        }),
        r("warm", "warm", "ask", "article", {
          gain: [remember("k_haase_law")],
          miss: "brief",
        }),
        r("push", "threat", "push", "brief", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [react(mood("stubborn"), null, reason("h_haase_walked"))],
        }),
        r("deal", "cold", "deal", "article", {
          tell: ["army:-1"],
          effects: [army(-1), remember("k_haase_law")],
        }),
        r("later", "cold", "leave", null),
      ),
      brief: node(
        one,
        r("again", "frank", "ask", "article", {
          effects: [remember("k_haase_law")],
        }),
        bye(),
      ),
      article: node(
        one,
        r("him", "warm", "ask", "him"),
        r("mark", "cold", "leave", null),
      ),
      him: node(one, bye("end", "frank")),
    },
  ),
  talk(
    "deu_t2_haase_annex",
    HAASE,
    all(
      war,
      any(flag("f_aims_full"), flag("f_no_annex_belgium")),
      date("1915-01", "1916-06"),
    ),
    {
      open: node(
        [
          v("kept", flag("f_no_annex_belgium")),
          v("anxious", mood("anxious")),
          v("base"),
        ],
        r("ask", "frank", "ask", "price", { miss: "first" }),
        r("warm", "warm", "ask", "price", { miss: "first" }),
        r("push", "threat", "push", "first", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [react(mood("anxious"), "price")],
        }),
        r("deal", "cold", "deal", "pledge", {
          tell: ["reichstag:+1", "army:-1"],
          effects: [
            reichstag(1),
            army(-1),
            promise(who, "p_haase_annex", 34, {
              keep: chose("deu_s_papal_note", "belgium_clear"),
            }),
          ],
        }),
        r("later", "cold", "leave", null),
      ),
      first: node(one, r("again", "frank", "ask", "price"), bye()),
      price: node(
        [v("straight", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_haase_belgium_price")],
        }),
        r("deal", "cold", "deal", "pledge", {
          tell: ["reichstag:+1", "army:-1"],
          effects: [
            reichstag(1),
            army(-1),
            promise(who, "p_haase_annex", 34, {
              keep: chose("deu_s_papal_note", "belgium_clear"),
            }),
          ],
        }),
      ),
      pledge: node(one, bye("end", "frank")),
    },
  ),
  talk(
    "deu_t2_haase_out",
    HAASE,
    all(war, seen("deu_h_spd_split"), date("1916-01", "1917-06")),
    {
      open: node(
        [v("anxious", mood("anxious")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "ebert", { miss: "door" }),
        r("warm", "warm", "ask", "ebert", { miss: "door" }),
        r("push", "threat", "push", "door", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [react(mood("weary"), null, reason("h_haase_walked"))],
        }),
        r("deal", "cold", "deal", "room", {
          tell: ["reichstag:+1", "army:-1"],
          effects: [
            reichstag(1),
            army(-1),
            promise(who, "p_haase_room", 12, {
              keep: any(
                chose("deu_h_liebknecht_may", "civil_trial"),
                chose("deu_h_liebknecht_may", "leave_him"),
                chose("deu_h_strike_april", "meet_committee"),
              ),
            }),
          ],
        }),
        r("later", "cold", "leave", null),
      ),
      door: node(one, r("again", "frank", "ask", "ebert"), bye()),
      ebert: node(
        one,
        r("mark", "frank", "leave", null, {
          effects: [remember("m_haase_ebert")],
        }),
        bye(),
      ),
      room: node(one, bye("end", "frank")),
    },
  ),
  talk(
    "deu_t2_haase_stockholm",
    HAASE,
    all(
      war,
      any(seen("gw_d_stockholm"), date("1917-04", "1917-12")),
      date("1917-03", "1917-12"),
    ),
    {
      open: node(
        [v("anxious", mood("anxious")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "russians", { miss: "stamp" }),
        r("warm", "warm", "ask", "russians", { miss: "stamp" }),
        r("push", "threat", "push", "stamp", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [react(mood("anxious"), "russians")],
        }),
        r("deal", "cold", "deal", "pass", {
          tell: ["army:-1", "reichstag:+1"],
          effects: [
            army(-1),
            reichstag(1),
            promise(who, "p_haase_passport", 8, {
              keep: chose("gw_d_stockholm", "passports"),
            }),
          ],
        }),
        r("later", "cold", "leave", null),
      ),
      stamp: node(one, r("again", "frank", "ask", "russians"), bye()),
      russians: node(
        [v("straight", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_haase_russians")],
        }),
        bye(),
      ),
      pass: node(one, bye("end", "frank")),
    },
  ),
  talk(
    "deu_t2_haase_fleet",
    HAASE,
    all(
      war,
      any(seen("deu_h_fleet_food"), low("bread", 1)),
      date("1917-01", "1918-12"),
    ),
    {
      open: node(
        [
          v("record", seen("deu_h_fleet_record")),
          v("anxious", mood("anxious")),
          v("weary", mood("weary")),
          v("base"),
        ],
        r("ask", "frank", "ask", "ships", {
          gain: [remember("k_haase_fleet")],
          miss: "charge",
        }),
        r("warm", "warm", "ask", "ships", {
          gain: [remember("k_haase_fleet")],
          miss: "charge",
        }),
        r("push", "threat", "push", "charge", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [react(mood("stubborn"), null, reason("h_haase_walked"))],
        }),
        r("deal", "cold", "deal", "ships", {
          tell: ["reichstag:+1", "trust:+1"],
          effects: [reichstag(1), T(1), remember("k_haase_fleet")],
        }),
        r("later", "cold", "leave", null),
      ),
      charge: node(
        one,
        r("again", "frank", "ask", "ships", {
          effects: [remember("k_haase_fleet")],
        }),
        bye(),
      ),
      ships: node(
        one,
        r("next", "frank", "ask", "next"),
        r("mark", "cold", "leave", null),
      ),
      next: node(one, bye("end", "frank")),
    },
  ),
];

const VISITS: readonly GwScene[] = [
  visit(
    "deu_v2_rathenau_office",
    RATH,
    all(war, date("1915-01", "1916-12")),
    6,
    {
      open: node(
        [
          v("nitrate", memory("m_nitrate")),
          v("raw", memory("m_raw_office")),
          v("anxious", mood("anxious")),
          v("base"),
        ],
        r("ask", "frank", "ask", "stock", {
          gain: [remember("k_rath_office")],
          miss: "essay",
        }),
        r("warm", "warm", "ask", "stock", {
          gain: [remember("k_rath_office")],
          miss: "essay",
        }),
        r("push", "cold", "push", "stock", {
          effects: [remember("k_rath_office")],
          reacts: [react(mood("anxious"), "essay", T(-1))],
        }),
        r("deal", "flatter", "deal", "stock", {
          tell: ["army:-1", "trust:+1"],
          effects: [army(-1), T(1), remember("k_rath_office")],
        }),
        r("later", "cold", "leave", null),
      ),
      essay: node(
        one,
        r("again", "frank", "ask", "stock", {
          effects: [remember("k_rath_office")],
        }),
        bye(),
      ),
      stock: node(
        [v("straight", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_rath_shells")],
        }),
        r("officer", "warm", "ask", "officer"),
      ),
      officer: node(one, bye("end", "warm")),
    },
    { cd: 10 },
  ),
  visit(
    "deu_v2_rathenau_census",
    RATH,
    all(war, seen("deu_h_census_record"), date("1916-11", "1917-06")),
    6,
    {
      open: node(
        [v("anxious", mood("anxious")), v("base")],
        r("hear", "warm", "ask", "ask"),
        r("frank", "frank", "ask", "ask"),
        r("no", "cold", "leave", null),
      ),
      ask: node(
        one,
        r("sorry", "frank", "leave", null),
        r("law", "cold", "ask", "law"),
        r("nothing", "warm", "leave", null),
      ),
      law: node(one, bye("end", "cold")),
    },
  ),
  visit(
    "deu_v2_ballin_ships",
    BALLIN,
    all(war, atWar("GBR"), date("1915-01", "1916-12")),
    6,
    {
      open: node(
        [v("weary", mood("weary")), v("base")],
        r("ask", "warm", "ask", "rates", { miss: "joke" }),
        r("frank", "frank", "ask", "rates", { miss: "joke" }),
        r("push", "cold", "push", "joke", {
          tell: ["trust:-1"],
          effects: [T(-1)],
          reacts: [react(mood("weary"), "rates")],
        }),
        r("deal", "warm", "deal", "ear", {
          tell: ["trust:+1"],
          effects: [
            T(1),
            promise(who, "p_ballin_ear", 30, {
              keep: chose("deu_s_pless", "not_yet"),
            }),
          ],
        }),
        r("later", "cold", "leave", null),
      ),
      joke: node(one, r("again", "warm", "ask", "rates"), bye()),
      rates: node(
        [v("straight", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [
            doWorld({ do: "reveal", id: "deu_table_wrong" }),
            remember("m_ballin_rates"),
          ],
        }),
        r("deal", "warm", "deal", "ear", {
          tell: ["trust:+1"],
          effects: [
            T(1),
            remember("m_ballin_rates"),
            promise(who, "p_ballin_ear", 30, {
              keep: chose("deu_s_pless", "not_yet"),
            }),
          ],
        }),
      ),
      ear: node(one, bye("end", "warm")),
    },
    { cd: 12 },
  ),
  visit(
    "deu_v2_ballin_last",
    BALLIN,
    all(war, score(0), date("1917-07", "1918-12")),
    7,
    {
      open: node(
        [
          v("kept", memory("kept_p_ballin_ear")),
          v("broke", broke("p_ballin_ear")),
          v("weary", mood("weary")),
          v("base"),
        ],
        r("alone", "warm", "ask", "alone", {
          tell: ["trust:+1"],
          effects: [T(1)],
        }),
        r("say", "frank", "ask", "say"),
        r("cold", "cold", "leave", null),
      ),
      alone: node(
        [v("kept", memory("kept_p_ballin_ear")), v("base")],
        r("thanks", "warm", "leave", null, {
          effects: [remember("m_ballin_heard")],
        }),
        bye("end", "frank"),
      ),
      say: node(
        one,
        r("thanks", "warm", "leave", null, {
          effects: [remember("m_ballin_heard")],
        }),
        bye(),
      ),
    },
  ),
  visit(
    "deu_v2_scheidemann_corridor",
    SCHEID,
    all(war, memory("k_ebert_first"), date("1916-07", "1917-12")),
    5,
    {
      open: node(
        [v("weary", mood("weary")), v("base")],
        r("ask", "cold", "ask", "price", { miss: "joke" }),
        r("frank", "frank", "ask", "price", { miss: "joke" }),
        r("push", "threat", "push", "joke", {
          tell: ["reichstag:-1"],
          effects: [reichstag(-1)],
          reacts: [react(mood("cunning"), "price")],
        }),
        r("deal", "flatter", "deal", "price", {
          tell: ["reichstag:+1", "army:-1"],
          effects: [reichstag(1), army(-1)],
        }),
        r("later", "warm", "leave", null),
      ),
      joke: node(one, r("again", "cold", "ask", "price"), bye()),
      price: node(
        [v("straight", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_spd_price")],
        }),
        bye(),
      ),
    },
    { cd: 12 },
  ),
];

export const DEU_HOME_SCENES: readonly GwScene[] = [
  ...SCENES,
  ...HELF_TALKS,
  ...GROE_TALKS,
  ...EBERT_TALKS,
  ...HAASE_TALKS,
  ...VISITS,
];
