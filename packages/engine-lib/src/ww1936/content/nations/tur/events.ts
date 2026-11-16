// ww229 (design ww227 §3, §5, §7): Turkey's national events. self = the
// receiver, from = the sender. Texts: ww1936.event_title.<id>,
// ww1936.event_desc.<id>, ww1936.event_opt.<id>.<option>. The old pack's
// tur_montreux_signed, tur_hatay_state, tur_neutrality_pressure and
// tur_aid_request (events/tur.ts) still fire as before.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { after, all, any, not, T } from "../../helpers";

export const TUR_EVENTS: readonly EventDef[] = [
  // ---- politics at home ----
  {
    // Fired by tur_ataturk_succession: the Assembly elects the new president.
    id: "tur_assembly_elects",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "set_leader", person: "tur_inonu" },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 15 },
        effects: [
          { kind: "set_leader", person: "tur_cakmak" },
          { kind: "war_support", pct: 5 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "c",
        ai: { base: 5 },
        effects: [
          { kind: "set_leader", person: "tur_saydam" },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    // Fired by tur_dersim_question: the mountain district refuses the state.
    id: "tur_dersim_rising",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "remove_spirit", id: "tur_eastern_unrest" },
          { kind: "stability", pct: -3 },
          { kind: "army_xp", amount: 10 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
    ],
  },
  {
    // Fired by tur_four_memorandum: four deputies ask for real opposition.
    id: "tur_opposition_petition",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 5 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: -3 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // A year or so after tur_village_institutes_project.
    id: "tur_village_institutes_debate",
    kind: "country",
    picture: "table",
    receivers: ["TUR"],
    trigger: { kind: "focus_done", id: "tur_village_institutes_project" },
    mtthDays: 400,
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "popularity", ideology: "communist", pp: 1 },
          { kind: "research_bonus", branch: "industry", pct: 50, uses: 1 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 2 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The 1939 earthquake in Erzincan: a loose window, not a date.
    id: "tur_erzincan_earthquake",
    kind: "country",
    picture: "crowd",
    receivers: ["TUR"],
    trigger: after("1939-06-01"),
    mtthDays: 240,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "pp", amount: -40 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -4 },
          { kind: "army_xp", amount: 5 },
        ],
      },
    ],
  },
  {
    id: "tur_turanist_trials",
    kind: "country",
    picture: "newspaper",
    receivers: ["TUR"],
    trigger: all(
      { kind: "pop_ge", ideology: "fascist", pct: 12 },
      not({ kind: "ruling", ideology: "fascist" }),
    ),
    mtthDays: 300,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -5 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 4 },
          { kind: "opinion", who: T("SUN"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    id: "tur_poet_on_trial",
    kind: "country",
    picture: "newspaper",
    receivers: ["TUR"],
    trigger: all(
      { kind: "pop_ge", ideology: "communist", pct: 8 },
      not({ kind: "ruling", ideology: "communist" }),
    ),
    mtthDays: 300,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -4 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 3 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Fired by tur_capital_levy: how hard the assessment commissions press.
    id: "tur_capital_levy_debate",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "pp", amount: 60 },
          { kind: "stability", pct: -5 },
          { kind: "opinion", who: T("USA"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "pp", amount: 25 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  // ---- arms ----
  {
    // Fired by tur_p24_licence: the first Kayseri-built fighters.
    id: "tur_kayseri_first_fighters",
    kind: "country",
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [{ kind: "equipment", type: "fighter", gen: 1, count: 15 }],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "doctrine_mastery", domain: "air", amount: 20 }],
      },
    ],
  },
  {
    // Fired by tur_adana_talks to the United Kingdom; from = Turkey.
    id: "tur_allied_arms_mission",
    kind: "country",
    picture: "table",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        available: not({ kind: "at_war_with", of: "from" }),
        ai: { base: 60 },
        effects: [
          { kind: "lend_lease", to: "from", item: "fighter", perMonth: 5 },
          {
            kind: "lend_lease",
            to: "from",
            item: "infantry_equipment",
            perMonth: 300,
          },
          { kind: "opinion", who: "from", of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  // ---- the straits, Hatay and chromium ----
  {
    // A great war in Europe: the belligerents ask about the straits.
    id: "tur_belligerents_ask_passage",
    kind: "country",
    picture: "map",
    receivers: ["TUR"],
    trigger: all(
      { kind: "flag", flag: "tur_straits_sovereign" },
      not({ kind: "at_war" }),
      any(
        { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
        { kind: "at_war_with", who: T("SUN"), of: T("DEU") },
        { kind: "at_war_with", who: T("GBR"), of: T("ITA") },
      ),
    ),
    mtthDays: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "add_spirit", id: "tur_straits_closed" },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        available: { kind: "exists", who: T("GBR") },
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -15, days: 365 },
          { kind: "opinion", who: T("ITA"), of: "self", value: -15, days: 365 },
        ],
      },
      {
        id: "c",
        available: { kind: "exists", who: T("DEU") },
        ai: { base: 10 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -15, days: 365 },
          { kind: "opinion", who: T("SUN"), of: "self", value: -15, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by tur_hatay_joint_garrison to France; from = Turkey.
    id: "tur_hatay_garrison",
    kind: "country",
    picture: "border",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: 10, days: 365 },
          { kind: "set_flag", flag: "tur_hatay_garrisoned", who: "from" },
          { kind: "stability", pct: 2, who: "from" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -15, days: 730 },
          { kind: "war_support", pct: 3, who: "from" },
        ],
      },
    ],
  },
  {
    // Fired by the chromium decisions to the buyer; from = Turkey.
    id: "tur_chromium_offer",
    kind: "country",
    picture: "document",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        available: not({ kind: "at_war_with", of: "from" }),
        ai: { base: 75 },
        effects: [
          { kind: "pp", amount: 40, who: "from" },
          { kind: "opinion", who: "from", of: "self", value: 10, days: 365 },
          { kind: "opinion", of: "from", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -5, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by tur_mosul_claim to Mosul's owner; from = Turkey.
    id: "tur_mosul_note",
    kind: "country",
    picture: "map",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        ai: {
          base: 5,
          mods: [
            {
              if: { kind: "strength_ratio_ge", vs: "from", permille: 1000 },
              factor: 0,
            },
          ],
        },
        effects: [
          {
            kind: "transfer_regions",
            group: "tur_mosul",
            to: "from",
            core: true,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 95 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -30, days: 730 },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  // ---- the great powers ----
  {
    // Berlin's ambassador courts Ankara while Germany fights Britain.
    id: "tur_german_envoy",
    kind: "country",
    picture: "table",
    receivers: ["TUR"],
    trigger: all(
      { kind: "at_war_with", who: T("DEU"), of: T("GBR") },
      not({ kind: "at_war" }),
      not({ kind: "nap_with", of: T("DEU") }),
      not({ kind: "same_faction", of: T("DEU") }),
    ),
    mtthDays: 180,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "nap", of: T("DEU") },
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // With Germany gone, Moscow asks for bases on the straits and the east.
    id: "tur_soviet_demands",
    kind: "country",
    picture: "document",
    receivers: ["TUR"],
    once: "country",
    trigger: all(
      { kind: "exists", who: T("SUN") },
      any(not({ kind: "exists", who: T("DEU") }), {
        kind: "capitulated",
        who: T("DEU"),
      }),
      not({ kind: "same_faction", of: T("SUN") }),
      not({ kind: "ruling", ideology: "communist" }),
    ),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: -30, days: 730 },
          { kind: "opinion", of: T("USA"), value: 20, days: 365 },
          { kind: "war_support", pct: 5 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: 20, days: 365 },
          { kind: "stability", pct: -5 },
          { kind: "remove_spirit", id: "tur_straits_closed" },
        ],
      },
    ],
  },
  {
    // A Balkan Entente partner is at war.
    id: "tur_balkan_ally_attacked",
    kind: "country",
    picture: "column",
    receivers: ["TUR"],
    trigger: all(
      { kind: "flag", flag: "tur_balkan_partner" },
      not({ kind: "at_war" }),
      any({ kind: "at_war", who: T("GRC") }, { kind: "at_war", who: T("YUG") }),
    ),
    mtthDays: 30,
    options: [
      {
        id: "a",
        ai: { base: 30 },
        effects: [
          {
            kind: "send_equipment",
            to: T("GRC"),
            type: "infantry_equipment",
            count: 1000,
          },
          { kind: "opinion", who: T("GRC"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("YUG"), of: "self", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "opinion", who: T("GRC"), of: "self", value: -15, days: 365 },
        ],
      },
    ],
  },
];
