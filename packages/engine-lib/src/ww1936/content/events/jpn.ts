// World War 1936 P5 — Japanese events (spec §19.2 rows 1, 21, 23, 30, 36,
// the Japanese end of row 47, row 48) and the news card that carries the
// surrender five days after the decision.
// Who is who inside an event: self = the receiver, from = the sender.
// Principles (spec §18.1-2, §19.2 end): the texts stay with military and
// diplomatic facts and carry no wartime slogan; no Japanese person by name; the heads
// of the client governments (Nanjing, Burma, the Philippines) are titles —
// create_state leaves their leader to the dormant country's politics (K5).
// Events that the history beats fire (K5) but that a human Japan must also
// reach carry a trigger of their own; the beat and the trigger fire the
// same event once.
// Data only (tests/ww1936/ContentPurity): the helpers come from ../helpers.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  JPN_KWANTUNG_COOLDOWN_DAYS,
  JPN_KWANTUNG_MTTH_DAYS,
  JPN_KWANTUNG_STABILITY,
  JPN_REVOLT_COOLDOWN_DAYS,
  JPN_REVOLT_MTTH_DAYS,
  JPN_REVOLT_POP_PCT,
  JPN_REVOLT_STABILITY,
  NO_CIVIL_WAR,
} from "../focus/jpn_showa";
import { after, all, any, flag, not, T } from "../helpers";

export const JPN_EVENTS: EventDef[] = [
  {
    // 1940-03-30 (beat, K5) or the focus jpn_nanjing_regime.
    id: "jpn_nanjing_government",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        available: {
          kind: "occupied_by",
          group: "east_china_occupied",
          of: "self",
        },
        ai: { base: 90 },
        effects: [
          {
            kind: "create_state",
            tag: "RNG",
            regions: ["east_china_occupied"],
            from: T("CHN"),
            overlord: "self",
            level: "puppet",
            ideology: "neutral",
          },
          { kind: "war_support", who: T("CHN"), pct: 5 },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // Vichy receives it from the second jpn_demand_indochina_access
    // (from = Japan). Southern Indochina, 1941-07-28; the United States
    // gets its oil-embargo decision.
    id: "jpn_south_indochina",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "access", of: "from" },
          { kind: "unlock_decision", who: T("USA"), id: "usa_oil_embargo" },
        ],
      },
    ],
  },
  {
    // 1941-11-26 in Washington. talks_continue holds the 1941-12-07 beat
    // back for 60 days (FLAGS_P5_BASE).
    id: "jpn_hull_note",
    kind: "country",
    picture: "document",
    date: { on: "1941-11-26", to: ["JPN"] },
    trigger: all(
      not({ kind: "at_war_with", of: T("USA") }),
      flag("jpn_hawaii_started"),
    ),
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [{ kind: "war_support", pct: 10 }],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", of: T("USA"), value: 20, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
          { kind: "set_flag", flag: "talks_continue", days: 60 },
        ],
      },
    ],
  },
  {
    // 1943-08-01 (beat, K5), or whenever Japan holds part of Burma later.
    id: "jpn_burma_state",
    kind: "country",
    picture: "crowd",
    receivers: ["JPN"],
    trigger: all(
      after("1943-08-01"),
      { kind: "occupied_by", group: "burma", of: "self" },
      { kind: "country_state", tag: "BRM", state: "dormant" },
    ),
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "occupied_by", group: "burma", of: "self" },
          { kind: "country_state", tag: "BRM", state: "dormant" },
        ),
        ai: { base: 90 },
        effects: [
          {
            kind: "create_state",
            tag: "BRM",
            regions: ["burma"],
            from: T("RAJ"),
            overlord: "self",
            level: "puppet",
            ideology: "neutral",
          },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // 1943-10-14 (beat, K5), or whenever Japan holds part of the
    // Philippines later and no Philippine state stands.
    id: "jpn_philippine_republic",
    kind: "country",
    picture: "crowd",
    receivers: ["JPN"],
    trigger: all(
      after("1943-10-14"),
      { kind: "occupied_by", group: "philippines", of: "self" },
      any(
        { kind: "country_state", tag: "PHL", state: "dormant" },
        { kind: "country_state", tag: "PHL", state: "gone" },
      ),
    ),
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "occupied_by", group: "philippines", of: "self" },
          any(
            { kind: "country_state", tag: "PHL", state: "dormant" },
            { kind: "country_state", tag: "PHL", state: "gone" },
          ),
        ),
        ai: { base: 90 },
        effects: [
          {
            kind: "create_state",
            tag: "PHL",
            regions: ["philippines"],
            from: T("USA"),
            overlord: "self",
            level: "puppet",
            ideology: "neutral",
          },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // Sent by potsdam_conference (K5) nine days after 1945-07-17. A human
    // who lets the card run out keeps fighting.
    id: "jpn_potsdam_declaration",
    kind: "country",
    picture: "newspaper",
    timeoutSec: 30,
    humanDefault: "a",
    options: [
      { id: "a", history: true, ai: { base: 90 }, effects: [] },
      {
        id: "b",
        ai: { base: 10 },
        effects: [{ kind: "surrender", to: T("USA") }],
      },
    ],
  },
  {
    // 1945-08-10 (beat, K5), or later once the Soviet Union is at war with
    // Japan and Japan or Manchukuo has lost a tenth of its victory points.
    // The surrender itself comes five days later (jpn_surrender_effect).
    id: "jpn_surrender_decision",
    kind: "country",
    picture: "table",
    receivers: ["JPN"],
    trigger: all(
      after("1945-08-10"),
      { kind: "at_war_with", of: T("SUN") },
      { kind: "at_war_with", of: T("USA") },
      any(
        { kind: "lost_vp_ge", pct: 10 },
        { kind: "lost_vp_ge", who: T("MCK"), pct: 10 },
      ),
    ),
    timeoutSec: 30,
    historyPct: 90,
    humanDefault: "b",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [{ kind: "fire_event", id: "jpn_surrender_effect", days: 5 }],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [{ kind: "stability", pct: -5 }],
      },
    ],
  },
  {
    // The news line everyone sees on 1945-08-15; Japan surrenders to the
    // United States.
    id: "jpn_surrender_effect",
    kind: "news",
    picture: "newspaper",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [{ kind: "surrender", to: T("USA") }],
      },
    ],
  },
  // ---- The Showa Restoration's opposition (focus/jpn_showa.ts) ----
  {
    // The navy and the Control Faction: the old establishment still holds a
    // following (neutral popularity). Steady enough, the regime breaks the
    // movement; not, the country divides. The generic regime crisis is not
    // queued for Japan while the regime holds (Ideology.dailyIdeology).
    id: "jpn_service_revolt",
    kind: "country",
    receivers: ["JPN"],
    trigger: all(
      flag("jpn_regime_seized"),
      { kind: "ruling", ideology: "fascist" },
      { kind: "pop_ge", ideology: "neutral", pct: JPN_REVOLT_POP_PCT },
      NO_CIVIL_WAR,
    ),
    mtthDays: JPN_REVOLT_MTTH_DAYS,
    once: "never",
    // A card waits for its answer for about 70 days: no second one meanwhile.
    cooldownDays: JPN_REVOLT_COOLDOWN_DAYS,
    picture: "crowd",
    options: [
      {
        // Exactly one option stands at any time.
        id: "a",
        available: { kind: "stability_ge", pct: JPN_REVOLT_STABILITY },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: -15 },
          { kind: "stability", pct: -15 },
          { kind: "war_support", pct: -5 },
        ],
        ai: { base: 100 },
      },
      {
        id: "b",
        available: not({ kind: "stability_ge", pct: JPN_REVOLT_STABILITY }),
        effects: [
          { kind: "civil_war", ideology: "neutral" },
          // A failed split falls back to a neutral government: put the
          // restoration back (a no-op when it already rules).
          {
            kind: "if",
            cond: not({ kind: "ruling", ideology: "fascist" }),
            then: [{ kind: "set_government", ideology: "fascist" }],
          },
        ],
        ai: { base: 100 },
      },
    ],
  },
  {
    // The Kwantung Army: a Japan that gave it autonomy (jpn_kwantung_autonomy)
    // and has not settled with it (jpn_kwantung_settlement) may lose
    // Manchukuo. Steady enough, the generals are brought to heel; not, they
    // cut the leash and Manchukuo, with the leased territory, goes with them.
    id: "jpn_kwantung_break",
    kind: "country",
    receivers: ["JPN"],
    trigger: all(
      flag("jpn_regime_seized"),
      { kind: "focus_done", id: "jpn_kwantung_autonomy" },
      not(flag("jpn_kwantung_settled")),
      { kind: "subject_of", who: T("MCK"), of: "self" },
    ),
    mtthDays: JPN_KWANTUNG_MTTH_DAYS,
    once: "never",
    cooldownDays: JPN_KWANTUNG_COOLDOWN_DAYS,
    picture: "map",
    options: [
      {
        id: "a",
        available: { kind: "stability_ge", pct: JPN_KWANTUNG_STABILITY },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "war_support", pct: -3 },
        ],
        ai: { base: 100 },
      },
      {
        id: "b",
        available: not({ kind: "stability_ge", pct: JPN_KWANTUNG_STABILITY }),
        effects: [
          { kind: "end_subject", target: T("MCK") },
          { kind: "transfer_regions", group: "kwantung", to: T("MCK") },
          { kind: "stability", pct: -5 },
          { kind: "fire_event", id: "jpn_manchukuo_defiance", to: T("MCK") },
        ],
        ai: { base: 100 },
      },
    ],
  },
  {
    // The other side of the break: Manchukuo leaves the camp and fights.
    id: "jpn_manchukuo_defiance",
    kind: "country",
    picture: "border",
    options: [
      {
        id: "a",
        effects: [
          { kind: "leave_faction" },
          { kind: "declare_war", on: T("JPN") },
        ],
        ai: { base: 100 },
      },
    ],
  },
];
