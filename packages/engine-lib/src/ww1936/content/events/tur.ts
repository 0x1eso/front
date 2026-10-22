// World War 1936 P6 — the Turkish pack events (spec §11.13): the Montreux
// convention, the State of Hatay of 1938 (the transfer of 1939 stays P3's
// tur_hatay_question → fra_hatay_cession), the Allied pressure of November
// 1943, and tur_aid_request, the arms request the focus tur_allied_treaty
// sends to London (the DSL has no request effect). self = the receiver,
// from = the sender; people appear by office only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, not } from "../helpers";

export const TUR_EVENTS: EventDef[] = [
  {
    // 1936-07-20: the convention is signed and Turkey may refortify the Straits.
    id: "tur_montreux_signed",
    kind: "country",
    picture: "document",
    date: { on: "1936-07-20", to: ["TUR"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
          { kind: "opinion", who: T("SUN"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("SUN"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // 1938-09-02: the sanjak's assembly opens and proclaims the State of Hatay.
    id: "tur_hatay_state",
    kind: "country",
    picture: "border",
    date: { on: "1938-09-02", to: ["TUR"] },
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "owns_group", who: T("FRA"), group: "hatay" },
        ai: { base: 70 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "pp", amount: 25 },
          { kind: "opinion", who: T("FRA"), of: "self", value: -5, days: 365 },
        ],
      },
      {
        id: "b",
        available: { kind: "owns_group", who: T("FRA"), group: "hatay" },
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: T("FRA"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "c",
        available: not({ kind: "owns_group", who: T("FRA"), group: "hatay" }),
        ai: { base: 1 },
        effects: [],
      },
    ],
  },
  {
    // 1943-11-05: in Cairo the British foreign secretary asks for air bases
    // and for Turkey's entry into the war; Ankara answers that it is not ready.
    id: "tur_neutrality_pressure",
    kind: "country",
    picture: "table",
    date: { on: "1943-11-05", to: ["TUR"] },
    options: [
      {
        id: "a",
        history: true,
        available: not({ kind: "at_war" }),
        ai: { base: 80 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("SUN"), of: "self", value: -15, days: 365 },
        ],
      },
      {
        id: "b",
        available: all(
          { kind: "exists", who: T("GBR") },
          not({ kind: "at_war_with", of: T("GBR") }),
        ),
        ai: { base: 15 },
        effects: [
          { kind: "access", of: T("GBR") },
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
          { kind: "war_support", pct: 5 },
        ],
      },
      {
        id: "c",
        available: all(
          not({ kind: "in_faction" }),
          { kind: "exists", who: T("GBR") },
          not({ kind: "at_war_with", of: T("GBR") }),
        ),
        ai: { base: 5 },
        effects: [
          {
            kind: "fire_event",
            id: "gen_diplo_faction_request",
            to: { factionLeaderOf: T("GBR") },
          },
          { kind: "war_support", pct: 10 },
        ],
      },
      {
        id: "d",
        available: all(
          { kind: "at_war" },
          any(not({ kind: "exists", who: T("GBR") }), {
            kind: "at_war_with",
            of: T("GBR"),
          }),
        ),
        ai: { base: 1 },
        effects: [],
      },
    ],
  },
  {
    // Fired by tur_allied_treaty (to the United Kingdom); from = Turkey.
    id: "tur_aid_request",
    kind: "country",
    picture: "document",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        available: not({ kind: "at_war_with", of: "from" }),
        ai: { base: 60 },
        effects: [
          { kind: "lend_lease", to: "from", item: "fighter", perMonth: 10 },
          {
            kind: "lend_lease",
            to: "from",
            item: "infantry_equipment",
            perMonth: 500,
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
];
