// World War 1936 P6 (spec §11.13): the Nationalist pack events.
// chn_xian_incident is not here: P3 already has it (events/world.ts, lane
// K5 of P3), and a pack never remakes an event of the P3/P5 tables.
//
// Who is who inside an event: self = the receiver, from = the sender (the
// focus or decision that fired it). Effects that can make the receiver
// vanish (annex) come last. The American Volunteer Group is also a P5
// history beat (1941-08-01, a historical AI United States); the request
// event below adds the volunteers only when that beat will not.
// Data only (tests/ww1936/ContentPurity): the helpers come from ../helpers.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, done, not, T } from "../helpers";

export const CHN_EVENTS: EventDef[] = [
  {
    // Fired by chn_united_front (from = China) to the Communists.
    id: "chn_united_front_offer",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80, mods: [{ if: done("ccp_independent"), factor: 25 }] },
        effects: [
          { kind: "opinion", of: "from", value: 30, days: 3650 },
          { kind: "opinion", who: "from", of: "self", value: 30, days: 3650 },
          { kind: "war_support", pct: 5 },
        ],
      },
      {
        id: "b",
        ai: { base: 20, mods: [{ if: done("ccp_independent"), factor: 400 }] },
        effects: [
          { kind: "break_nap", of: "from" },
          { kind: "opinion", of: "from", value: -30, days: 365 },
          { kind: "opinion", who: "from", of: "self", value: -30, days: 365 },
        ],
      },
    ],
  },
  {
    // The road from Lashio to Kunming opened to traffic at the end of 1938.
    id: "chn_burma_road_open",
    kind: "country",
    picture: "map",
    date: { on: "1938-12-01", to: ["CHN"] },
    trigger: not({ kind: "at_war_with", of: T("GBR") }),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", of: T("GBR"), value: 10, days: 365 },
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 1000,
          },
        ],
      },
    ],
  },
  {
    // Fired by chn_us_aid (from = China) to the United States. A
    // historical AI United States sends the group through the P5 beat of
    // 1941-08-01, so option a sends it here only when that beat will not.
    id: "chn_flying_tigers",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          not({ kind: "at_war_with", of: T("JPN") }),
          not({ kind: "at_war_with", of: "from" }),
        ),
        ai: { base: 70 },
        effects: [
          {
            kind: "if",
            cond: not(all({ kind: "is_ai" }, { kind: "historical_ai" })),
            then: [{ kind: "volunteers", to: "from", planes: 100 }],
          },
          { kind: "opinion", of: "from", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 180 },
        ],
      },
    ],
  },
  {
    // Fired by the decision chn_integrate_warlord (from = China) to the
    // clique. A human clique's card defaults to refusing; the autonomy
    // spirit doubles the AI's refusal weight (spec §11.4).
    id: "chn_warlord_joins",
    kind: "country",
    picture: "table",
    once: "never",
    humanDefault: "b",
    options: [
      {
        id: "a",
        ai: {
          base: 50,
          mods: [
            { if: { kind: "at_war_with", of: "from" }, factor: 300 },
            { if: { kind: "opinion_ge", of: "from", value: 75 }, factor: 150 },
          ],
        },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: 20, days: 365 },
          { kind: "annex", who: "from", target: "self", units: "transfer" },
        ],
      },
      {
        id: "b",
        ai: {
          base: 50,
          mods: [
            {
              if: { kind: "has_spirit", id: "chw_provincial_rule" },
              factor: 200,
            },
          ],
        },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: "from", of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
];
