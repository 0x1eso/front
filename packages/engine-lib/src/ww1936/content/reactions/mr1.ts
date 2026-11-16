// ww229 MR1 (design ww227 §7): Germany, Italy and the Soviet Union answer
// the minors of Central and Eastern Europe, the Balkans, the Baltic and the
// straits. The world events fire when a minor's own content completes a
// bloc, a federation, a restoration, an ideology change, an oil or ore deal
// or a straits closure; each major answers by its government and situation
// (court, guarantee, oppose, or wait), and its answer sets the side its AI
// takes in its reaction focuses (focus/deu.ts, ita.ts, sun.ts *_MR_FOCUSES).
// The minors' answers to the majors' old demands are appended to those
// events (answers). Texts: ww1936.event_title/_desc/_opt.<id>. Data only.
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { DEU_MR_FOCUSES } from "../focus/deu";
import { ITA_MR_FOCUSES } from "../focus/ita";
import { SUN_MR_FOCUSES } from "../focus/sun";
import {
  all,
  any,
  exists,
  fire,
  firstOf,
  flag,
  focusBeat,
  isTag,
  mrCourt,
  mrCourtAi,
  mrGuard,
  mrGuardAi,
  mrOppose,
  mrOpposeAi,
  not,
  setFlag,
  T,
} from "../helpers";
import type { Condition, EventDef, HistoryBeat } from "../types";
import {
  BALKAN_BLOC,
  BALKAN_GRC,
  BALKAN_TUR,
  DANUBE_CSK,
  DANUBE_HUN,
  DEU_DANUBE_OPEN,
  DEU_NORTH_OPEN,
  DEU_SOUTHEAST_OPEN,
  ENTENTE,
  ENTENTE_ROU,
  HABSBURG,
  INTERMARIUM,
  IRON_GUARD,
  ITA_BALKAN_OPEN,
  ITA_DANUBE_OPEN,
  ITA_OIL_OPEN,
  NORDIC,
  NORDIC_FIN,
  NORDIC_SWE,
  ORE_EMBARGO,
  RED_BALKANS,
  RED_YUG,
  ROU_OIL_WEST,
  STRAITS_CLOSED,
  SUN_BALTIC_OPEN,
  SUN_COMRADES_OPEN,
  SUN_STRAITS_OPEN,
  TUR_CHROME,
} from "./mr1Conds";
import type { ReactionDef } from "./types";

const ALWAYS: Condition = { kind: "always", value: true };
/** Waiting to see: the money a reaction would have cost. */
const WAIT: Effect = { kind: "pp", amount: 15 };

/** The flags a major's answer leaves: the side its reaction focuses take. */
const MR1_FLAGS = [
  "mr_danube_court",
  "mr_danube_oppose",
  "mr_entente_court",
  "mr_entente_oppose",
  "mr_balkan_court",
  "mr_balkan_oppose",
  "mr_intermarium_court",
  "mr_intermarium_oppose",
  "mr_nordic_court",
  "mr_nordic_oppose",
  "mr_ore_court",
  "mr_ore_oppose",
  "mr_straits_court",
  "mr_straits_oppose",
  "mr_ironguard_court",
  "mr_ironguard_oppose",
  "mr_red_court",
  "mr_red_oppose",
];

/** Bessarabia and northern Bukovina change hands (rou_bessarabia_ultimatum a). */
const CEDE_BESSARABIA: Effect[] = [
  { kind: "news", id: "news_bessarabia" },
  { kind: "set_gflag", flag: "bessarabia_lost" },
  { kind: "tension", who: "from", pct: 2 },
  { kind: "transfer_regions", group: "bessarabia", to: "from" },
  { kind: "transfer_regions", group: "north_bukovina", to: "from" },
];

const MR1_EVENTS: EventDef[] = [
  // ---- the Danube ----
  {
    id: "mr_danube_hun",
    kind: "country",
    receivers: ["DEU", "ITA", "SUN"],
    trigger: DANUBE_HUN,
    mtthDays: 7,
    picture: "map",
    options: [
      {
        id: "a",
        ai: mrCourtAi("HUN", 30, [{ if: isTag("ITA"), factor: 200 }]),
        effects: [mrCourt("HUN"), setFlag("mr_danube_court")],
      },
      {
        id: "b",
        ai: mrGuardAi("HUN"),
        effects: [mrGuard("HUN"), setFlag("mr_danube_court")],
      },
      {
        id: "c",
        ai: mrOpposeAi("HUN", 15, [{ if: isTag("DEU"), factor: 200 }]),
        effects: [mrOppose("HUN", "topple"), setFlag("mr_danube_oppose")],
      },
      { id: "d", ai: { base: 30 }, effects: [WAIT] },
    ],
  },
  {
    id: "mr_danube_csk",
    kind: "country",
    receivers: ["DEU", "ITA", "SUN"],
    trigger: DANUBE_CSK,
    mtthDays: 7,
    picture: "map",
    options: [
      {
        id: "a",
        ai: mrCourtAi("CSK", 30, [{ if: isTag("SUN"), factor: 200 }]),
        effects: [mrCourt("CSK"), setFlag("mr_danube_court")],
      },
      {
        id: "b",
        ai: mrGuardAi("CSK"),
        effects: [mrGuard("CSK"), setFlag("mr_danube_court")],
      },
      {
        id: "c",
        ai: mrOpposeAi("CSK", 15, [{ if: isTag("DEU"), factor: 300 }]),
        effects: [mrOppose("CSK", "topple"), setFlag("mr_danube_oppose")],
      },
      { id: "d", ai: { base: 30 }, effects: [WAIT] },
    ],
  },
  {
    id: "mr_habsburg_crown",
    kind: "country",
    receivers: ["DEU", "ITA"],
    trigger: HABSBURG,
    mtthDays: 7,
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: mrCourtAi("HUN", 20, [{ if: isTag("ITA"), factor: 300 }]),
        effects: [mrCourt("HUN"), setFlag("mr_danube_court")],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("HUN"), of: "self", value: -20, days: 730 },
          { kind: "tension", pct: 1 },
        ],
      },
      {
        id: "c",
        ai: mrOpposeAi("HUN", 15, [{ if: isTag("DEU"), factor: 400 }]),
        effects: [mrOppose("HUN", "topple"), setFlag("mr_danube_oppose")],
      },
    ],
  },
  {
    id: "mr_little_entente",
    kind: "country",
    receivers: ["DEU", "ITA", "SUN"],
    trigger: ENTENTE,
    mtthDays: 7,
    picture: "table",
    options: [
      {
        id: "a",
        ai: mrCourtAi("ROU", 25, [{ if: isTag("SUN"), factor: 200 }]),
        effects: [
          firstOf([
            [ENTENTE_ROU, [mrCourt("ROU")]],
            [ALWAYS, [mrCourt("CSK")]],
          ]),
          setFlag("mr_entente_court"),
        ],
      },
      {
        id: "b",
        available: exists("HUN"),
        ai: mrCourtAi("HUN", 20, [{ if: isTag("SUN"), factor: 0 }]),
        effects: [mrCourt("HUN")],
      },
      {
        id: "c",
        ai: mrOpposeAi("CSK", 10, [{ if: isTag("SUN"), factor: 20 }]),
        effects: [
          firstOf([
            [ENTENTE_ROU, [mrOppose("ROU", "topple")]],
            [ALWAYS, [mrOppose("CSK", "topple")]],
          ]),
          setFlag("mr_entente_oppose"),
        ],
      },
      { id: "d", ai: { base: 30 }, effects: [WAIT] },
    ],
  },
  // ---- the Balkans ----
  {
    id: "mr_balkan_bloc",
    kind: "country",
    receivers: ["ITA", "DEU", "SUN"],
    trigger: BALKAN_BLOC,
    mtthDays: 7,
    picture: "table",
    options: [
      {
        id: "a",
        ai: mrCourtAi("GRC", 25),
        effects: [
          firstOf([
            [BALKAN_GRC, [mrCourt("GRC")]],
            [BALKAN_TUR, [mrCourt("TUR")]],
            [ALWAYS, [mrCourt("YUG")]],
          ]),
          setFlag("mr_balkan_court"),
        ],
      },
      {
        id: "b",
        available: exists("BGR"),
        ai: mrCourtAi("BGR", 20, [{ if: isTag("ITA"), factor: 200 }]),
        effects: [mrCourt("BGR"), setFlag("mr_balkan_court")],
      },
      {
        id: "c",
        ai: mrOpposeAi("GRC", 10, [{ if: isTag("ITA"), factor: 300 }]),
        effects: [
          firstOf([
            [BALKAN_GRC, [mrOppose("GRC", "conquer")]],
            [BALKAN_TUR, [mrOppose("TUR", "topple")]],
            [ALWAYS, [mrOppose("YUG", "topple")]],
          ]),
          setFlag("mr_balkan_oppose"),
        ],
      },
      { id: "d", ai: { base: 30 }, effects: [WAIT] },
    ],
  },
  {
    id: "mr_iron_guard",
    kind: "country",
    receivers: ["DEU", "ITA", "SUN"],
    trigger: IRON_GUARD,
    mtthDays: 7,
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: mrCourtAi("ROU", 25),
        effects: [mrCourt("ROU"), setFlag("mr_ironguard_court")],
      },
      {
        id: "b",
        ai: mrGuardAi("ROU", 10, [{ if: isTag("SUN"), factor: 0 }]),
        effects: [mrGuard("ROU"), setFlag("mr_ironguard_court")],
      },
      {
        id: "c",
        ai: mrOpposeAi("ROU", 10, [{ if: isTag("SUN"), factor: 300 }]),
        effects: [
          firstOf([
            [isTag("SUN"), [mrOppose("ROU", "claim", "bessarabia")]],
            [ALWAYS, [mrOppose("ROU", "topple")]],
          ]),
          setFlag("mr_ironguard_oppose"),
        ],
      },
      { id: "d", ai: { base: 30 }, effects: [WAIT] },
    ],
  },
  {
    id: "mr_red_balkans",
    kind: "country",
    receivers: ["SUN", "DEU", "ITA"],
    trigger: RED_BALKANS,
    mtthDays: 7,
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: mrCourtAi("YUG", 25),
        effects: [
          firstOf([
            [RED_YUG, [mrCourt("YUG")]],
            [ALWAYS, [mrCourt("BGR")]],
          ]),
          setFlag("mr_red_court"),
        ],
      },
      {
        id: "b",
        ai: mrGuardAi("YUG", 10, [
          { if: { kind: "ruling", ideology: "communist" }, factor: 300 },
        ]),
        effects: [
          firstOf([
            [RED_YUG, [mrGuard("YUG")]],
            [ALWAYS, [mrGuard("BGR")]],
          ]),
          setFlag("mr_red_court"),
        ],
      },
      {
        id: "c",
        ai: mrOpposeAi("YUG", 15, [{ if: isTag("ITA"), factor: 200 }]),
        effects: [
          firstOf([
            [RED_YUG, [mrOppose("YUG", "topple")]],
            [ALWAYS, [mrOppose("BGR", "topple")]],
          ]),
          setFlag("mr_red_oppose"),
        ],
      },
      { id: "d", ai: { base: 30 }, effects: [WAIT] },
    ],
  },
  // ---- the straits ----
  {
    id: "mr_straits_closed",
    kind: "country",
    receivers: ["SUN", "ITA", "DEU"],
    trigger: STRAITS_CLOSED,
    mtthDays: 5,
    picture: "map",
    options: [
      {
        id: "a",
        ai: mrOpposeAi("TUR", 15, [{ if: isTag("SUN"), factor: 200 }]),
        effects: [
          mrOppose("TUR", "claim", "turkish_straits"),
          setFlag("mr_straits_oppose"),
        ],
      },
      {
        id: "b",
        ai: mrCourtAi("TUR", 25),
        effects: [mrCourt("TUR"), setFlag("mr_straits_court")],
      },
      {
        id: "c",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("TUR"), of: "self", value: 10, days: 365 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    id: "mr_turkish_chromium",
    kind: "country",
    receivers: ["DEU"],
    trigger: TUR_CHROME,
    mtthDays: 14,
    picture: "factory",
    options: [
      {
        id: "a",
        ai: mrCourtAi("TUR", 40),
        effects: [
          mrCourt("TUR"),
          {
            kind: "if",
            cond: all(
              exists("TUR"),
              not({ kind: "at_war_with", of: T("TUR") }),
            ),
            then: [
              {
                kind: "send_equipment",
                to: T("TUR"),
                type: "artillery",
                count: 100,
              },
            ],
          },
        ],
      },
      { id: "b", ai: { base: 30 }, effects: [WAIT] },
    ],
  },
  // ---- oil and ore ----
  {
    id: "mr_romanian_oil",
    kind: "country",
    receivers: ["DEU", "ITA"],
    trigger: ROU_OIL_WEST,
    mtthDays: 14,
    picture: "factory",
    options: [
      {
        id: "a",
        ai: mrCourtAi("ROU", 30),
        effects: [
          mrCourt("ROU"),
          {
            kind: "if",
            cond: all(
              exists("ROU"),
              not({ kind: "at_war_with", of: T("ROU") }),
            ),
            then: [
              {
                kind: "send_equipment",
                to: T("ROU"),
                type: "artillery",
                count: 100,
              },
            ],
          },
        ],
      },
      {
        id: "b",
        ai: mrOpposeAi("ROU", 10),
        effects: [mrOppose("ROU", "claim", "ploiesti")],
      },
      {
        id: "c",
        ai: { base: 25 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "pp", amount: 20 },
        ],
      },
    ],
  },
  {
    id: "mr_swedish_ore",
    kind: "country",
    receivers: ["DEU"],
    trigger: ORE_EMBARGO,
    mtthDays: 7,
    picture: "factory",
    options: [
      {
        id: "a",
        ai: mrCourtAi("SWE", 30),
        effects: [mrCourt("SWE"), setFlag("mr_ore_court")],
      },
      {
        id: "b",
        ai: mrOpposeAi("SWE", 15),
        effects: [mrOppose("SWE", "topple"), setFlag("mr_ore_oppose")],
      },
      {
        id: "c",
        ai: { base: 25 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "pp", amount: 20 },
        ],
      },
    ],
  },
  // ---- the Baltic ----
  {
    id: "mr_nordic_union",
    kind: "country",
    receivers: ["DEU", "SUN"],
    trigger: NORDIC,
    mtthDays: 7,
    picture: "table",
    options: [
      {
        id: "a",
        ai: mrCourtAi("SWE", 25),
        effects: [
          firstOf([
            [NORDIC_FIN, [mrCourt("FIN")]],
            [NORDIC_SWE, [mrCourt("SWE")]],
            [ALWAYS, [mrCourt("NOR")]],
          ]),
          setFlag("mr_nordic_court"),
        ],
      },
      {
        id: "b",
        ai: mrGuardAi("SWE", 10),
        effects: [
          firstOf([
            [NORDIC_FIN, [mrGuard("FIN")]],
            [NORDIC_SWE, [mrGuard("SWE")]],
            [ALWAYS, [mrGuard("NOR")]],
          ]),
          setFlag("mr_nordic_court"),
        ],
      },
      {
        id: "c",
        ai: mrOpposeAi("FIN", 15, [{ if: isTag("SUN"), factor: 200 }]),
        effects: [
          firstOf([
            [
              all(isTag("SUN"), NORDIC_FIN),
              [mrOppose("FIN", "claim", "karelian_isthmus")],
            ],
            [NORDIC_FIN, [mrOppose("FIN", "topple")]],
            [NORDIC_SWE, [mrOppose("SWE", "topple")]],
            [ALWAYS, [mrOppose("NOR", "topple")]],
          ]),
          setFlag("mr_nordic_oppose"),
        ],
      },
      { id: "d", ai: { base: 30 }, effects: [WAIT] },
    ],
  },
  {
    id: "mr_intermarium",
    kind: "country",
    receivers: ["DEU", "SUN"],
    trigger: INTERMARIUM,
    mtthDays: 7,
    picture: "map",
    options: [
      {
        id: "a",
        ai: mrCourtAi("POL", 25),
        effects: [
          {
            kind: "if",
            cond: all(
              exists("POL"),
              not({ kind: "at_war_with", of: T("POL") }),
            ),
            then: [
              { kind: "nap", of: T("POL") },
              {
                kind: "opinion",
                who: T("POL"),
                of: "self",
                value: 20,
                days: 730,
              },
            ],
          },
          setFlag("mr_intermarium_court"),
        ],
      },
      {
        id: "b",
        ai: mrOpposeAi("POL", 20),
        effects: [
          firstOf([
            [isTag("DEU"), [mrOppose("POL", "claim", "polish_corridor")]],
            [ALWAYS, [mrOppose("POL", "topple")]],
          ]),
          setFlag("mr_intermarium_oppose"),
        ],
      },
      { id: "c", ai: { base: 30 }, effects: [WAIT] },
    ],
  },
  // ---- fired by the minors' answers ----
  {
    // Fired by csk_munich_dictate d (from = Czechoslovakia).
    id: "mr_sun_prague_appeal",
    kind: "country",
    picture: "document",
    timeoutSec: 30,
    aiDelayDays: [3, 3],
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 730 },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 30 }, factor: 200 },
            { if: { kind: "at_war" }, factor: 30 },
            { if: { kind: "ruling", ideology: "fascist" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "guarantee", of: "from" },
          { kind: "send_equipment", to: "from", type: "bomber", count: 30 },
          { kind: "opinion", who: "from", of: "self", value: 30, days: 730 },
        ],
      },
    ],
  },
  {
    // Fired by fin_soviet_demands c (from = Finland).
    id: "mr_sun_finnish_offer",
    kind: "country",
    picture: "map",
    timeoutSec: 30,
    aiDelayDays: [5, 5],
    options: [
      {
        id: "a",
        ai: {
          base: 40,
          mods: [
            { if: { kind: "at_war" }, factor: 200 },
            { if: { kind: "ruling", ideology: "democratic" }, factor: 300 },
          ],
        },
        effects: [
          { kind: "opinion", of: "from", value: 20, days: 730 },
          { kind: "pp", amount: 15 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          {
            kind: "war_goal",
            on: "from",
            type: "claim",
            group: "karelian_isthmus",
          },
          { kind: "tension", pct: 2 },
        ],
      },
    ],
  },
  {
    // Fired by rou_bessarabia_ultimatum c (from = Romania).
    id: "mr_deu_romanian_turn",
    kind: "country",
    picture: "table",
    timeoutSec: 30,
    aiDelayDays: [5, 5],
    options: [
      {
        id: "a",
        ai: {
          base: 60,
          mods: [
            { if: { kind: "ruling", ideology: "democratic" }, factor: 30 },
            { if: { kind: "at_war_with", of: "from" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "guarantee", of: "from" },
          { kind: "send_equipment", to: "from", type: "artillery", count: 100 },
          { kind: "opinion", who: "from", of: "self", value: 30, days: 730 },
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
];

/**
 * The historical AI's reaction focuses: the opening focus when its question
 * opens, a side's focus once the major's answer chose that side.
 */
const MR1_BEATS: HistoryBeat[] = [
  // Germany.
  focusBeat(
    "mr_deu_danube",
    "DEU",
    "deu_mr_danubian_question",
    DEU_DANUBE_OPEN,
  ),
  focusBeat(
    "mr_deu_case_otto",
    "DEU",
    "deu_mr_case_otto",
    all(
      { kind: "focus_done", id: "deu_mr_danubian_question" },
      any(flag("mr_danube_oppose"), flag("mr_entente_oppose")),
    ),
  ),
  focusBeat(
    "mr_deu_danube_clearing",
    "DEU",
    "deu_mr_danube_clearing",
    all(
      { kind: "focus_done", id: "deu_mr_danubian_question" },
      any(flag("mr_danube_court"), flag("mr_entente_court")),
    ),
  ),
  focusBeat("mr_deu_north", "DEU", "deu_mr_northern_ore", DEU_NORTH_OPEN),
  focusBeat(
    "mr_deu_salzgitter",
    "DEU",
    "deu_mr_salzgitter",
    all({ kind: "focus_done", id: "deu_mr_northern_ore" }, ORE_EMBARGO),
  ),
  focusBeat(
    "mr_deu_ore_for_arms",
    "DEU",
    "deu_mr_ore_for_arms",
    all(
      { kind: "focus_done", id: "deu_mr_northern_ore" },
      any(flag("mr_ore_court"), flag("mr_nordic_court")),
    ),
  ),
  focusBeat(
    "mr_deu_northern_pressure",
    "DEU",
    "deu_mr_northern_pressure",
    all(
      { kind: "focus_done", id: "deu_mr_northern_ore" },
      any(flag("mr_ore_oppose"), flag("mr_nordic_oppose")),
    ),
  ),
  focusBeat(
    "mr_deu_southeast",
    "DEU",
    "deu_mr_southeast_oil",
    DEU_SOUTHEAST_OPEN,
  ),
  // Italy.
  focusBeat("mr_ita_balkans", "ITA", "ita_mr_balkan_sphere", ITA_BALKAN_OPEN),
  focusBeat(
    "mr_ita_arms_for_sofia",
    "ITA",
    "ita_mr_arms_for_sofia",
    all(
      { kind: "focus_done", id: "ita_mr_balkan_sphere" },
      any(
        flag("mr_balkan_court"),
        flag("mr_entente_court"),
        flag("mr_ironguard_court"),
      ),
    ),
  ),
  focusBeat(
    "mr_ita_break_the_bloc",
    "ITA",
    "ita_mr_break_the_bloc",
    all(
      { kind: "focus_done", id: "ita_mr_balkan_sphere" },
      any(
        flag("mr_balkan_oppose"),
        flag("mr_entente_oppose"),
        flag("mr_red_oppose"),
      ),
    ),
  ),
  focusBeat(
    "mr_ita_rome_protocols",
    "ITA",
    "ita_mr_rome_protocols",
    ITA_DANUBE_OPEN,
  ),
  focusBeat("mr_ita_oil", "ITA", "ita_mr_oil_for_the_fleet", ITA_OIL_OPEN),
  // The Soviet Union.
  focusBeat("mr_sun_baltic", "SUN", "sun_mr_baltic_security", SUN_BALTIC_OPEN),
  focusBeat(
    "mr_sun_buffer_pacts",
    "SUN",
    "sun_mr_buffer_pacts",
    all(
      { kind: "focus_done", id: "sun_mr_baltic_security" },
      any(flag("mr_nordic_court"), flag("mr_intermarium_court")),
    ),
  ),
  focusBeat(
    "mr_sun_northern_war_plan",
    "SUN",
    "sun_mr_northern_war_plan",
    all(
      { kind: "focus_done", id: "sun_mr_baltic_security" },
      any(flag("mr_nordic_oppose"), flag("mr_intermarium_oppose")),
    ),
  ),
  focusBeat(
    "mr_sun_straits",
    "SUN",
    "sun_mr_straits_question",
    SUN_STRAITS_OPEN,
  ),
  focusBeat(
    "mr_sun_straits_bases",
    "SUN",
    "sun_mr_straits_bases",
    all(
      { kind: "focus_done", id: "sun_mr_straits_question" },
      flag("mr_straits_oppose"),
    ),
  ),
  focusBeat(
    "mr_sun_black_sea_pact",
    "SUN",
    "sun_mr_black_sea_pact",
    all(
      { kind: "focus_done", id: "sun_mr_straits_question" },
      flag("mr_straits_court"),
    ),
  ),
  focusBeat(
    "mr_sun_comrades",
    "SUN",
    "sun_mr_balkan_comrades",
    SUN_COMRADES_OPEN,
  ),
];

export const MR1_REACTIONS: ReactionDef = {
  id: "mr1",
  focuses: [...DEU_MR_FOCUSES, ...ITA_MR_FOCUSES, ...SUN_MR_FOCUSES],
  events: MR1_EVENTS,
  decisions: [],
  spirits: [],
  flags: MR1_FLAGS,
  beats: MR1_BEATS,
  answers: [
    {
      // Germany's Munich terms: Prague may man its forts, or call on Moscow.
      event: "csk_munich_dictate",
      ai: {
        a: {
          base: 70,
          mods: [
            { if: flag("csk_will_fight"), factor: 40 },
            { if: { kind: "guaranteed_by", of: T("SUN") }, factor: 70 },
          ],
        },
      },
      options: [
        {
          id: "c",
          available: flag("csk_will_fight"),
          ai: { base: 40 },
          effects: [
            { kind: "war_support", pct: 15 },
            { kind: "fort", where: { group: "sudetenland" }, amount: 1 },
            { kind: "army_xp", amount: 10 },
            fire("deu_sudeten_refused", T("DEU")),
          ],
        },
        {
          id: "d",
          available: all(
            exists("SUN"),
            not({ kind: "ruling", who: T("SUN"), ideology: "fascist" }),
            not({ kind: "at_war_with", of: T("SUN") }),
          ),
          ai: {
            base: 15,
            mods: [
              { if: flag("csk_trusts_allies"), factor: 200 },
              {
                if: { kind: "opinion_ge", of: T("SUN"), value: 20 },
                factor: 150,
              },
            ],
          },
          effects: [
            { kind: "war_support", pct: 5 },
            fire("mr_sun_prague_appeal", T("SUN")),
            fire("deu_sudeten_refused", T("DEU")),
          ],
        },
      ],
    },
    {
      // Germany's Prague ultimatum: the army that meant to fight still can.
      event: "csk_prague_ultimatum",
      ai: {
        a: { base: 70, mods: [{ if: flag("csk_will_fight"), factor: 40 }] },
      },
      options: [
        {
          id: "c",
          available: flag("csk_will_fight"),
          ai: { base: 40 },
          effects: [
            { kind: "war_support", pct: 20 },
            { kind: "army_xp", amount: 15 },
            { kind: "war_goal", who: "from", on: "self", type: "conquer" },
          ],
        },
      ],
    },
    {
      // The Soviet Bessarabian ultimatum: Bucharest may also yield and turn
      // to Berlin, or fight beside its allies.
      event: "rou_bessarabia_ultimatum",
      ai: {
        b: {
          base: 30,
          mods: [
            { if: flag("rou_entente_staff"), factor: 150 },
            { if: { kind: "in_faction" }, factor: 150 },
          ],
        },
      },
      options: [
        {
          id: "c",
          available: exists("DEU"),
          ai: {
            base: 25,
            mods: [
              { if: flag("rou_german_trade"), factor: 200 },
              { if: { kind: "ruling", ideology: "fascist" }, factor: 300 },
              { if: { kind: "at_war_with", of: T("DEU") }, factor: 0 },
            ],
          },
          effects: [
            ...CEDE_BESSARABIA,
            { kind: "opinion", of: T("DEU"), value: 25, days: 730 },
            fire("mr_deu_romanian_turn", T("DEU")),
          ],
        },
        {
          id: "d",
          available: any(flag("rou_polish_alliance"), { kind: "in_faction" }),
          ai: {
            base: 25,
            mods: [
              { if: { kind: "character", is: "status_quo" }, factor: 150 },
            ],
          },
          effects: [
            { kind: "war_support", pct: 15 },
            { kind: "fort", where: { group: "bessarabia" }, amount: 1 },
            {
              kind: "war_goal",
              who: "from",
              on: "self",
              type: "claim",
              group: "bessarabia",
            },
          ],
        },
      ],
    },
    {
      // Moscow's demands on Finland: an island lease may still be offered.
      event: "fin_soviet_demands",
      ai: {
        a: {
          base: 70,
          mods: [
            { if: flag("fin_refused_bases"), factor: 150 },
            { if: flag("fin_soviet_treaty"), factor: 30 },
          ],
        },
        b: {
          base: 30,
          mods: [{ if: flag("fin_soviet_treaty"), factor: 200 }],
        },
      },
      options: [
        {
          id: "c",
          available: flag("fin_islands_leased"),
          ai: { base: 40 },
          effects: [
            { kind: "stability", pct: -5 },
            { kind: "access", of: "from" },
            fire("mr_sun_finnish_offer", "from"),
          ],
        },
      ],
    },
    {
      // The Soviet bases and ultimatum to the Baltic states: a state with a
      // protector or a camp refuses more often.
      event: "bal_mutual_assistance",
      ai: {
        b: {
          base: 20,
          mods: [
            {
              if: any(
                { kind: "guaranteed_by", of: T("DEU") },
                { kind: "guaranteed_by", of: T("GBR") },
                { kind: "guaranteed_by", of: T("FRA") },
              ),
              factor: 200,
            },
            { if: { kind: "in_faction" }, factor: 200 },
          ],
        },
      },
    },
    {
      event: "bal_soviet_ultimatum",
      ai: {
        b: {
          base: 30,
          mods: [
            {
              if: any(
                { kind: "guaranteed_by", of: T("DEU") },
                { kind: "guaranteed_by", of: T("GBR") },
                { kind: "guaranteed_by", of: T("FRA") },
              ),
              factor: 200,
            },
            { if: { kind: "in_faction" }, factor: 200 },
          ],
        },
      },
    },
    {
      // The Tripartite invitation: Belgrade may sign a pact and no more.
      event: "yug_tripartite",
      ai: {
        b: { base: 30, mods: [{ if: flag("yug_gold_saved"), factor: 150 }] },
      },
      options: [
        {
          id: "c",
          available: all(
            exists("DEU"),
            not({ kind: "at_war_with", of: T("DEU") }),
            not({ kind: "nap_with", of: T("DEU") }),
          ),
          ai: { base: 25, mods: [{ if: flag("yug_gold_saved"), factor: 200 }] },
          effects: [
            { kind: "nap", of: T("DEU") },
            {
              kind: "opinion",
              who: T("DEU"),
              of: "self",
              value: -10,
              days: 730,
            },
          ],
        },
      ],
    },
    {
      // Danzig: a Poland that leads its own camp holds firmer; a fascist or
      // German-aligned one gives way more often.
      event: "pol_danzig_demand",
      ai: {
        a: {
          base: 70,
          mods: [{ if: { kind: "faction_leader" }, factor: 150 }],
        },
        b: {
          base: 30,
          mods: [
            { if: { kind: "ruling", ideology: "fascist" }, factor: 200 },
            { if: { kind: "same_faction", of: T("DEU") }, factor: 300 },
          ],
        },
      },
    },
    {
      // The Moscow peace: a Finland with Nordic allies fights on more often.
      event: "fin_moscow_peace",
      ai: {
        b: { base: 30, mods: [{ if: { kind: "in_faction" }, factor: 200 }] },
      },
    },
  ],
};
