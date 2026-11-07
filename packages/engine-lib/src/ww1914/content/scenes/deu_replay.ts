import type {
  GwNode,
  GwReply,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, trustOf } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Germany: what a second and fifth game read differently. The scenes that come
 * in most games get a twin body, the commonest talks a second opening of another
 * shape: the person who asks first, who refuses, who sends three lines, who is
 * cut off. Each opening hands on to the talk's own nodes through its own replies,
 * so what the talk opens stays open. The text is in the DEU packs, beside the
 * scene's; `withDeuReplay` adds this to the scene as it was written.
 */

/** Scene -> its new bodies: [id, the variant whose `when` it shares]. */
const TWINS: Readonly<Record<string, readonly (readonly [string, string?])[]>> =
  {
    deu_f_ledger: [
      ["b2"],
      ["b3"],
      ["thin2", "thin"],
      ["material2", "material"],
      ["material3", "material"],
      ["storm2", "storm"],
      ["depth2", "depth"],
    ],
    gw_home_deu_1: [["b2"], ["b3"]],
    gw_home_deu_2: [["b2"]],
    deu_h_bread_report: [["b2"], ["b3"], ["y16a2", "y16a"]],
    deu_f_lists_late: [["b2"], ["y16a2", "y16a"]],
    deu_h_loan_drive: [["b2"], ["y16b", "y16"]],
    deu_s_blockade_numbers: [["y16b", "y16"]],
    deu_f_new_arms: [["b2"]],
    deu_c_war_on_serbia: [["b2"]],
    deu_c_ultimatum_out: [["b2"]],
    deu_c_ultimatum_text: [["b2"]],
    deu_c_margin: [["b2"]],
    deu_c_kiel_wire: [["b2"]],
    deu_c_first_words: [["b2"]],
    deu_c_four_powers: [["b2"]],
    deu_c_rus_report: [["b2"]],
    deu_p_moltke_leave: [["crisis2", "crisis"]],
    deu_c_press_serbia: [["b2"]],
    deu_c_bucharest: [["b2"]],
    deu_p_roster: [["after_shot2", "after_shot"]],
    deu_f_east_or_west: [["b2"]],
    deu_h_wounded_home: [["b2"]],
    deu_h_spd_split: [["b2"]],
    deu_k_three_class: [["cold2", "cold"]],
    deu_f_romania_in: [["b2"]],
    deu_w_ledger_dec: [["trench2", "trench"]],
    deu_f_somme_doctrine: [["verdun2", "verdun"]],
    deu_k_new_year: [["b2"]],
    deu_f_verdun_third_month: [["b2"]],
    deu_h_liebknecht_may: [["b2"]],
    deu_h_price_caps: [["b2"]],
    deu_k_princes: [["hungry2", "hungry"]],
    deu_s_vienna_wavers: [["b2"]],
    deu_h_coal_winter: [["b2"]],
    deu_h_pig_cull: [["b2"]],
    deu_w_antwerp: [["british2", "british"]],
    deu_s_wilson_mediation: [["house2", "house"]],
  };

/** A reply of the talk's first node by id, or a reply of the opening's own. */
type Opening = readonly (string | GwReply)[];

const who = { role: "who" };

/** Talk -> the replies of its second opening: body `b2`, node `o2`. */
const OPENINGS: Readonly<Record<string, Opening>> = {
  deu_v2_ballin_ships: [
    "ask",
    "deal",
    {
      id: "admiral",
      stance: "cold",
      kind: "push",
      tell: ["trust:-1"],
      effects: [trustOf(who, -1)],
      next: "o2_end",
    },
    "later",
  ],
  deu_v2_rupprecht_letter: ["deal", "leave"],
  deu_v2_rathenau_office: ["warm", "push", "later"],
  deu_v2_valentini_paper: ["keep_paper", "sign_it"],
  deu_v2_parvus_bill: ["sum", "out", "end"],
  deu_v2_mackensen_report: ["ask", "leave"],
  deu_v2_hoffmann_wine: ["ask", "push", "leave"],
  deu_t2_kuhl_paris: ["road", "cover", "end"],
  deu_t_heir_dig: ["trade", "shut", "go"],
  deu_t2_muller_night: ["all_of_it", "door", "sleep"],
  deu_t_kuhn_navy: ["swap", "stop", "pay"],
  deu_t2_erz_belgium: ["still", "quiet", "noted"],
  deu_t2_hind_name: ["deal", "leave"],
  deu_t2_erz_numbers: ["committee", "whose", "too_many"],
  deu_t2_groe_rails: ["deal", "push", "later"],
  deu_t2_helf_indemnity: ["ask", "deal", "later"],
  deu_t2_ebert_first: ["deal", "ask", "later"],
  deu_t_tirp_britain: ["deal_it", "push", "leave"],
  deu_t2_zimm_jagow: ["health", "seat", "end"],
  deu_t_hind_letter: ["promise", "leave"],
  deu_t_muller_tirpitz: ["how", "hate", "end"],
  deu_t2_zimm_sofia: ["loan", "price", "end"],
  deu_t2_heir_bauer: ["what_talk", "friends", "tell_mother"],
  deu_v_nicholas_wire: ["warm", "firm", "no"],
  deu_v_hoyos: ["date", "cold", "later"],
};

/** Nodes an opening needs of its own. */
const OPENING_NODES: Readonly<
  Record<string, Readonly<Record<string, GwNode>>>
> = {
  deu_v2_ballin_ships: {
    o2_end: {
      says: [{ id: "base" }],
      replies: [
        {
          id: "end",
          stance: "cold",
          kind: "leave",
          tell: [],
          effects: [],
          next: null,
        },
      ],
    },
  },
};

/**
 * Written for a war and gated by date or office alone: in a Europe still at peace
 * in 1915 these spoke of trenches that weren't there.
 */
const WAR_ONLY: ReadonlySet<string> = new Set([
  "deu_t2_beth_reform",
  "deu_t2_beth_terms",
  "deu_t2_beth_sign",
  "deu_t2_muller_valentini",
  "deu_t2_muller_heir",
  "deu_t2_muller_diary",
  "deu_t2_heir_verdun",
  "deu_t2_falk_bleed",
  "deu_t2_falk_wild",
  "deu_t2_tirp_stay",
  "deu_t2_zimm_jagow",
  "deu_t2_zimm_sofia",
  "deu_t2_holtz_tirpitz",
  "deu_t2_bauer_list",
  "deu_k_silent_rule",
  "deu_k_valentini_out",
]);

function withTwins(s: GwScene): GwScene {
  const twins = TWINS[s.id];
  if (twins === undefined) return s;
  const made: GwVariant[] = twins.map(([id, like]) => {
    const when = s.variants.find((v) => v.id === like)?.when;
    return when === undefined ? { id } : { id, when };
  });
  const last = s.variants.length - 1;
  return {
    ...s,
    variants: [...s.variants.slice(0, last), ...made, s.variants[last]],
  };
}

function withOpening(s: GwScene): GwScene {
  const replies = OPENINGS[s.id];
  if (replies === undefined || s.nodes === undefined) return s;
  const first = s.nodes[s.start!].replies;
  const open: GwNode = {
    says: [{ id: "base" }],
    replies: replies.map((r) =>
      typeof r === "string" ? first.find((x) => x.id === r)! : r,
    ),
  };
  return {
    ...s,
    variants: [...s.variants, { id: "b2" }],
    starts: { b2: "o2" },
    nodes: { ...s.nodes, o2: open, ...OPENING_NODES[s.id] },
  };
}

function warOnly(s: GwScene): GwScene {
  if (!WAR_ONLY.has(s.id)) return s;
  const war = world({ is: "war" });
  return { ...s, when: s.when === undefined ? war : all(s.when, war) };
}

export const withDeuReplay = (s: GwScene): GwScene =>
  warOnly(withOpening(withTwins(s)));
