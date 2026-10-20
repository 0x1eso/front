// World War 1936 P6 — the Spanish pack events (spec §11.13). Of the five
// planned events, two already exist and are not made again (lane report):
// the Non-Intervention Committee of 1936-09-09 is P5's
// gbr_non_intervention_committee, and the end of the civil war is P3's
// esp_civil_war_won with P5's esp_civil_war_ends. spa_aid_request is the
// request the pack's focuses send (spa_gold_reserve to Moscow, spa_axis_aid
// to Berlin and Rome); the DSL has no request effect, so the supplier gets a
// card. Military and diplomatic facts only, no bombing of towns and no
// reprisals (spec §24-7); people appear by office, never by name.
//
// Who is who: self = the receiver, from = the sender. A date event reaches
// both Spains, so each option is open only where it makes sense, and a last
// option without effects catches the rest.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, not } from "../helpers";

export const SPA_EVENTS: EventDef[] = [
  {
    // 1936-11-23: the frontal assault on Madrid is called off.
    id: "spa_madrid_holds",
    kind: "country",
    picture: "column",
    date: { on: "1936-11-23", to: ["ESR", "ESN"] },
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "tag", tag: "ESR" },
          { kind: "controls_group", group: "madrid" },
        ),
        ai: { base: 10 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "b",
        available: all(
          { kind: "tag", tag: "ESN" },
          { kind: "controls_group", who: T("ESR"), group: "madrid" },
        ),
        ai: { base: 10 },
        effects: [
          { kind: "army_xp", amount: 10 },
          { kind: "war_support", pct: -3 },
        ],
      },
      {
        id: "c",
        available: not(
          any(
            all(
              { kind: "tag", tag: "ESR" },
              { kind: "controls_group", group: "madrid" },
            ),
            all(
              { kind: "tag", tag: "ESN" },
              { kind: "controls_group", who: T("ESR"), group: "madrid" },
            ),
          ),
        ),
        ai: { base: 10 },
        effects: [],
      },
    ],
  },
  {
    // 1938-07-25: the Republican army crosses the Ebro.
    id: "spa_ebro_battle",
    kind: "country",
    picture: "map",
    date: { on: "1938-07-25", to: ["ESR", "ESN"] },
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "tag", tag: "ESR" },
          { kind: "at_war_with", of: T("ESN") },
        ),
        ai: { base: 70 },
        effects: [
          { kind: "add_spirit", id: "spa_ebro_offensive", days: 120 },
          { kind: "war_support", pct: 5 },
        ],
      },
      {
        id: "b",
        available: all(
          { kind: "tag", tag: "ESR" },
          { kind: "at_war_with", of: T("ESN") },
        ),
        ai: { base: 30 },
        effects: [
          { kind: "add_spirit", id: "spa_capital_holds", days: 120 },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "c",
        available: all(
          { kind: "tag", tag: "ESN" },
          { kind: "at_war_with", of: T("ESR") },
        ),
        ai: { base: 10 },
        effects: [
          { kind: "army_xp", amount: 15 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "d",
        available: not({ kind: "at_war_with", of: T("ESN") }),
        ai: { base: 1 },
        effects: [],
      },
    ],
  },
  {
    // 1940-10-23: the meeting at the Hendaye railway station; Spain names a
    // high price and enters no war.
    id: "spa_hendaye",
    kind: "country",
    picture: "table",
    date: { on: "1940-10-23", to: ["ESN"] },
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "exists", who: T("DEU") },
          not({ kind: "at_war_with", of: T("DEU") }),
        ),
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        available: all(
          { kind: "exists", who: T("DEU") },
          not({ kind: "at_war_with", of: T("DEU") }),
          not({ kind: "in_faction" }),
        ),
        ai: { base: 15 },
        effects: [
          { kind: "unlock_decision", id: "gen_join_axis" },
          { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
          { kind: "war_support", pct: 5 },
        ],
      },
      {
        id: "c",
        ai: { base: 15 },
        effects: [
          { kind: "stability", pct: 5 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by spa_gold_reserve (to the Soviet Union) and spa_axis_aid (to
    // Germany and Italy); from = the Spanish side asking.
    id: "spa_aid_request",
    kind: "country",
    picture: "document",
    once: "never",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        available: all(
          { kind: "at_war", who: "from" },
          not({ kind: "at_war_with", of: "from" }),
        ),
        ai: {
          base: 30,
          mods: [
            { if: { kind: "tag", tag: "SUN" }, factor: 300 },
            { if: { kind: "ruling", ideology: "democratic" }, factor: 25 },
          ],
        },
        effects: [
          {
            kind: "lend_lease",
            to: "from",
            item: "infantry_equipment",
            perMonth: 500,
          },
          { kind: "opinion", who: "from", of: "self", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        available: all(
          { kind: "at_war", who: "from" },
          not({ kind: "at_war_with", of: "from" }),
        ),
        ai: {
          base: 20,
          mods: [
            {
              if: {
                kind: "focus_done",
                who: "from",
                id: "spa_foreign_volunteers",
              },
              factor: 200,
            },
            { if: { kind: "ruling", ideology: "democratic" }, factor: 25 },
          ],
        },
        effects: [
          {
            kind: "lend_lease",
            to: "from",
            item: "infantry_equipment",
            perMonth: 300,
          },
          { kind: "volunteers", to: "from", divisions: 1, planes: 30 },
          { kind: "opinion", who: "from", of: "self", value: 30, days: 365 },
        ],
      },
      {
        id: "c",
        ai: { base: 50 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
];
