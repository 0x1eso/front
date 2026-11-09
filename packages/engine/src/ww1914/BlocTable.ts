// Great War 1914: who stands behind the head of state (design §6, ww142). One row
// per country: a later country adds a row and a `<TAG>.press.json`, no code. A
// bloc keeps no value: its support is these terms added up as things stand.
// Two points make one step of support. Blocs.ts reads this table.
import {
  GwCamp,
  GwGauge,
  GwInstitution,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  chose,
  flag,
  GwCond,
  not,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

/** `key`: the reason as the screen gives it, pack press.why.<key>. */
export type GwBlocTerm =
  | { t: "base"; points: number; key: string }
  /** A body's weight, `per` points a step; a body the regime lacks counts 0. */
  | { t: "inst"; inst: GwInstitution; per: number; key: string }
  | { t: "if"; when: GwCond; points: number; key: string }
  /** How the seat stands with that camp's ministers, on average. */
  | { t: "camp"; camp: GwCamp; per: number; none?: number; key: string };

export interface GwBlocDef {
  readonly terms: readonly GwBlocTerm[];
}

export interface GwBlocTie {
  readonly a: GwBloc;
  readonly b: GwBloc;
  /** Pack press.ties.<key>, or <key>_off while `when` doesn't hold. */
  readonly key: string;
  /** Absent: the tie always holds. */
  readonly when?: GwCond;
}

export interface GwBlocRow {
  readonly blocs: Readonly<Record<GwBloc, GwBlocDef>>;
  readonly ties: readonly GwBlocTie[];
}

const base = (points: number, key: string): GwBlocTerm => ({
  t: "base",
  points,
  key,
});
const inst = (i: GwInstitution, per: number, key: string): GwBlocTerm => ({
  t: "inst",
  inst: i,
  per,
  key,
});
const when = (c: GwCond, points: number, key: string): GwBlocTerm => ({
  t: "if",
  when: c,
  points,
  key,
});
const camp = (c: GwCamp, per: number, key: string): GwBlocTerm => ({
  t: "camp",
  camp: c,
  per,
  key,
});
const low = (gauge: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const high = (gauge: GwGauge, min: number): GwCond => ({
  kind: "gauge",
  gauge,
  min,
});
const instAt = (i: GwInstitution, min?: number, max?: number): GwCond => ({
  kind: "inst",
  inst: i,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
});
const rumours = (min: number): GwCond => ({ kind: "rumour", min });
const losing = world({ is: "score", max: -25 });
const winning = world({ is: "score", min: 25 });
const earlyWar = all(world({ is: "war" }), world({ is: "war_age", max: 12 }));
const lateWar = world({ is: "war_age", min: 24 });
/** Germany's truce: no such thing once the party's officers are in cells. */
const truceHolds = all(earlyWar, not(flag("f_arrests_done")));

const DEU: GwBlocRow = {
  blocs: {
    army: {
      terms: [
        base(2, "army_oath"),
        inst("army", 2, "army_heard"),
        camp("military", 1, "army_men"),
        when(low("shells", 0), -3, "shells_out"),
        when(losing, -2, "losing"),
        when(winning, 2, "winning"),
      ],
    },
    court: {
      terms: [
        base(4, "court_house"),
        inst("countersign", 1, "chancellor_signs"),
        when(chose("deu_k_easter_message", "equal_vote_word"), -3, "franchise"),
        when(low("order", 1), -3, "street_fear"),
        when(rumours(3), -2, "rumour_palace"),
      ],
    },
    parliament: {
      terms: [
        inst("reichstag", 2, "reichstag_heard"),
        inst("countersign", 1, "chancellor_signs"),
        camp("moderate", 1, "moderates"),
        when(chose("deu_k_peace_resolution", "accept_text"), 3, "peace_text"),
        when(chose("deu_k_peace_resolution", "dissolve"), -4, "dissolved"),
      ],
    },
    business: {
      terms: [
        base(2, "orders"),
        when(high("money", 2), 2, "credit_good"),
        when(low("money", 0), -3, "credit_gone"),
        when(world({ is: "blockade", min: 6 }), -2, "blockade_bites"),
        when(chose("deu_h_hindenburg_programme"), 3, "programme"),
        when(chose("gw_bm_deu_1916", "profits_tax"), -2, "profits_tax"),
      ],
    },
    workers: {
      terms: [
        base(-3, "shut_out"),
        inst("reichstag", 1, "reichstag_heard"),
        when(truceHolds, 3, "truce"),
        when(low("bread", 1), -3, "bread_short"),
        when(low("bread", 0), -2, "bread_gone"),
        when(chose("deu_h_aux_service", "unions_text"), 3, "unions_law"),
        when(chose("deu_c_war_speech", "pledge_haase"), 2, "haase_word"),
        when(low("order", 1), -2, "strikes"),
      ],
    },
    press: {
      terms: [
        base(2, "press_habit"),
        when(rumours(3), -2, "rumour_beats"),
        when(chose("deu_h_censor", "one_censor"), 2, "one_censor"),
      ],
    },
  },
  ties: [
    {
      a: "army",
      b: "court",
      key: "sword_throne",
      when: instAt("army", undefined, 3),
    },
    {
      a: "court",
      b: "business",
      key: "rye_iron",
      when: instAt("reichstag", undefined, 1),
    },
    {
      a: "parliament",
      b: "workers",
      key: "left_majority",
      when: instAt("reichstag", 1),
    },
    {
      a: "workers",
      b: "court",
      key: "truce",
      when: all(truceHolds, high("order", 2)),
    },
    {
      a: "army",
      b: "business",
      key: "guns_contract",
      when: chose("deu_h_hindenburg_programme"),
    },
  ],
};

const GBR: GwBlocRow = {
  blocs: {
    army: {
      terms: [
        base(2, "army_oath"),
        inst("army", 2, "army_heard"),
        camp("military", 1, "army_men"),
        when(low("shells", 0), -3, "shells_out"),
        when(losing, -2, "losing"),
        when(chose("gw_gbr_conscription", "conscript"), 2, "conscripts"),
      ],
    },
    court: {
      terms: [
        base(4, "court_house"),
        when({ kind: "pressure", topic: "ireland", min: 3 }, -2, "ulster_fear"),
        when(low("order", 1), -3, "street_fear"),
        when(rumours(4), -2, "rumour_palace"),
      ],
    },
    parliament: {
      terms: [
        inst("commons", 2, "commons_heard"),
        inst("cabinet", 1, "cabinet_holds"),
        inst("irish", 1, "irish_votes"),
        camp("liberal", 1, "liberals"),
      ],
    },
    business: {
      terms: [
        base(2, "city"),
        when(high("money", 2), 2, "credit_good"),
        when(low("money", 1), -2, "credit_thin"),
        when(low("money", 0), -2, "credit_gone"),
        when(world({ is: "shipping", min: 5 }), -3, "shipping_lost"),
        when(chose("gw_bm_gbr_1916", "excess_profits"), -2, "profits_tax"),
      ],
    },
    workers: {
      terms: [
        base(1, "unions_count"),
        when(earlyWar, 2, "truce"),
        when(low("bread", 1), -3, "bread_short"),
        when(low("order", 1), -2, "strikes"),
        when(chose("gw_gbr_conscription", "conscript"), -3, "conscripts_hate"),
        when(chose("gbr_h_conscription", "all_men"), -3, "conscripts_hate"),
        when(chose("gw_home_gbr_2", "rent_act"), 3, "rent_act"),
        when(chose("gw_home_gbr_1", "dilution"), -2, "dilution"),
      ],
    },
    press: {
      terms: [
        base(3, "press_habit"),
        inst("opposition", 1, "opposition_papers"),
        when(rumours(3), -2, "rumour_beats"),
      ],
    },
  },
  ties: [
    { a: "army", b: "press", key: "generals_papers", when: instAt("army", -1) },
    {
      a: "parliament",
      b: "workers",
      key: "lib_lab",
      when: instAt("commons", 0),
    },
    { a: "court", b: "army", key: "palace_ghq" },
    {
      a: "business",
      b: "parliament",
      key: "city_treasury",
      when: high("money", 1),
    },
    {
      a: "workers",
      b: "business",
      key: "treasury_agreement",
      when: all(world({ is: "war" }), high("order", 2)),
    },
  ],
};

const AUH: GwBlocRow = {
  blocs: {
    army: {
      terms: [
        base(2, "army_oath"),
        inst("army", 2, "army_heard"),
        inst("berlin", -1, "berlin_commands"),
        camp("military", 1, "army_men"),
        when(low("morale", 1), -2, "regiments_tired"),
      ],
    },
    court: {
      terms: [
        base(2, "court_house"),
        inst("council", 2, "council_meets"),
        camp("dynasty", 1, "dynasty_men"),
        when(instAt("nations", undefined, -3), -2, "realm_fear"),
        when(rumours(3), -2, "rumour_palace"),
      ],
    },
    parliament: {
      terms: [
        inst("hungary", 1, "budapest"),
        inst("nations", 1, "nations_heard"),
        when(
          all(lateWar, not(chose("auh_h_reichsrat_call", "open_it"))),
          -2,
          "reichsrat_shut",
        ),
        when(chose("auh_h_reichsrat_call", "open_it"), 3, "reichsrat_open"),
        camp("magyar", 1, "magyars"),
      ],
    },
    business: {
      terms: [
        base(2, "orders"),
        when(high("money", 2), 2, "credit_good"),
        when(low("money", 0), -3, "credit_gone"),
        when(low("bread", 1), -2, "bread_short"),
        inst("berlin", -1, "berlin_lends"),
      ],
    },
    workers: {
      terms: [
        base(-2, "shut_out"),
        when(earlyWar, 2, "truce"),
        when(low("bread", 1), -3, "bread_short"),
        when(low("bread", 0), -2, "bread_gone"),
        when(low("order", 1), -2, "strikes"),
        when(chose("auh_k_jan_strike", "talk_workers"), 3, "talked_to"),
        when(chose("auh_k_jan_strike", "call_troops"), -3, "troops_called"),
      ],
    },
    press: {
      terms: [base(2, "press_habit"), when(rumours(3), -2, "rumour_beats")],
    },
  },
  ties: [
    {
      a: "army",
      b: "court",
      key: "house_army",
      when: instAt("berlin", undefined, 2),
    },
    {
      a: "parliament",
      b: "court",
      key: "compromise",
      when: instAt("hungary", -1),
    },
    { a: "business", b: "army", key: "war_supply", when: world({ is: "war" }) },
    {
      a: "workers",
      b: "parliament",
      key: "peoples_front",
      when: instAt("nations", undefined, -2),
    },
    {
      a: "press",
      b: "court",
      key: "vienna_papers",
      when: instAt("council", 0),
    },
  ],
};

const RUS: GwBlocRow = {
  blocs: {
    army: {
      terms: [
        base(2, "army_oath"),
        inst("stavka", 2, "stavka_heard"),
        camp("military", 1, "army_men"),
        when(low("shells", 0), -3, "shells_out"),
        when(world({ is: "command" }), 1, "tsar_leads"),
        when(losing, -2, "losing"),
      ],
    },
    court: {
      terms: [
        base(2, "court_house"),
        inst("court", 2, "court_heard"),
        camp("court", 1, "court_men"),
        when(rumours(4), -2, "rumour_palace"),
      ],
    },
    parliament: {
      terms: [
        inst("duma", 2, "duma_heard"),
        inst("ministers", 1, "ministers_hold"),
        camp("duma", 1, "duma_men"),
        when(chose("rus_h_bloc", "prorogue"), -3, "prorogued"),
        when(rumours(4), -2, "dark_forces"),
      ],
    },
    business: {
      terms: [
        base(1, "orders"),
        when(high("money", 2), 2, "credit_good"),
        when(low("money", 0), -3, "credit_gone"),
        when(chose("gw_rus_session", "war_industry"), 3, "committees"),
        when(chose("rus_w_shell_famine", "call_industry"), 3, "committees"),
        when(chose("rus_h_bloc", "prorogue"), -2, "prorogued"),
      ],
    },
    workers: {
      terms: [
        base(-3, "shut_out"),
        inst("soviet", -1, "soviet_counts"),
        when(earlyWar, 3, "truce"),
        when(low("bread", 1), -3, "bread_short"),
        when(low("bread", 0), -2, "bread_gone"),
        when(low("order", 1), -2, "strikes"),
        when(chose("gw_home_rus_1", "wages"), 2, "wages_paid"),
      ],
    },
    press: {
      terms: [
        inst("duma", 1, "duma_heard"),
        when(rumours(3), -2, "rumour_beats"),
        when(
          world({ is: "regime", of: ["rep", "provisional"] }),
          4,
          "press_free",
        ),
      ],
    },
  },
  ties: [
    { a: "army", b: "court", key: "oath", when: instAt("stavka", -1) },
    {
      a: "parliament",
      b: "business",
      key: "progressive_bloc",
      when: instAt("duma", undefined, 1),
    },
    { a: "court", b: "press", key: "court_papers", when: instAt("court", 1) },
    { a: "workers", b: "army", key: "barracks", when: low("order", 1) },
    {
      a: "army",
      b: "parliament",
      key: "generals_duma",
      when: all(instAt("duma", -1), instAt("court", undefined, 0)),
    },
  ],
};

/** France (ww166, lane W5): `court` is the right and the Church, the salons
 * and the Academy; the Republic has no court, but it has them. */
const fraRegime = (...of: string[]): GwCond => world({ is: "regime", of });
const fraLaw = (id: string): GwCond => world({ is: "law", id, of: ["force"] });
const FRA: GwBlocRow = {
  blocs: {
    army: {
      terms: [
        base(2, "army_oath"),
        inst("army", 2, "gqg_heard"),
        camp("military", 1, "army_men"),
        when(low("shells", 0), -3, "shells_out"),
        when(losing, -2, "losing"),
        when(flag("f_joffre_free"), 2, "joffre_free"),
        when(flag("f_joffre_fallen"), -1, "joffre_fallen"),
      ],
    },
    court: {
      terms: [
        base(1, "right_waits"),
        camp("right", 1, "right_men"),
        when(fraRegime("fra_union"), 3, "union_right"),
        when(fraRegime("fra_tiger"), 2, "tiger_right"),
        when(flag("f_pm_caillaux"), -4, "caillaux_peace"),
        when(rumours(4), -2, "rumour_traitors"),
      ],
    },
    parliament: {
      terms: [
        inst("chamber", 2, "chamber_heard"),
        inst("senate", 1, "senate_heard"),
        inst("countersign", 1, "cabinet_holds"),
        camp("radical", 1, "radicals"),
        when(fraRegime("fra_tiger"), -1, "tiger_rules"),
        when(flag("f_secret_committee"), 2, "secret_committees"),
      ],
    },
    business: {
      terms: [
        base(1, "forges"),
        when(high("money", 2), 2, "credit_good"),
        when(low("money", 0), -3, "credit_gone"),
        when(flag("f_gov_bordeaux"), -1, "bordeaux"),
        when(fraLaw("fra_law_war_profits"), -2, "profits_tax"),
      ],
    },
    workers: {
      terms: [
        base(-1, "cgt_distrust"),
        camp("socialist", 1, "socialists"),
        when(fraRegime("fra_union"), 3, "union_left"),
        when(flag("f_sfio_out"), -3, "sfio_out"),
        when(flag("f_carnet_b_used"), -3, "carnet_b"),
        when(low("bread", 1), -3, "bread_short"),
        when(low("order", 1), -2, "strikes"),
        when(fraLaw("fra_law_allowances"), 1, "allowances"),
      ],
    },
    press: {
      terms: [
        base(2, "press_habit"),
        inst("chamber", 1, "chamber_heard"),
        when(flag("f_law_censor"), -2, "censor_law"),
        when(rumours(3), -2, "rumour_beats"),
      ],
    },
  },
  ties: [
    { a: "army", b: "court", key: "gqg_salons", when: instAt("army", 1) },
    {
      a: "parliament",
      b: "workers",
      key: "union_benches",
      when: fraRegime("fra_union"),
    },
    { a: "court", b: "press", key: "right_papers" },
    {
      a: "business",
      b: "parliament",
      key: "forges_senate",
      when: high("money", 1),
    },
    { a: "workers", b: "army", key: "poilus_factories", when: low("order", 1) },
  ],
};

/** A country with no row has no bloc screen. */
export const GW_BLOC_ROWS: Readonly<Partial<Record<GwTag, GwBlocRow>>> = {
  DEU,
  GBR,
  AUH,
  RUS,
  FRA,
};
