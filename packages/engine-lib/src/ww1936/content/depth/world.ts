// World War 1936 P6: the events of the depth systems. Texts:
// ww1936.event_title.<id>, ww1936.event_desc.<id>, ww1936.event_opt.<id>.<opt>.
// Inside an event, self = the receiver.
//
// - treaty_escalation (spec §13.3): the treaty members raise the battleship
//   limit. History sends it on 1938-06-30 (the protocol signed in London that
//   day); the mechanisms lane also sends it to every member when a major
//   outside the treaty lays down a third-generation battleship. The global
//   flag treaty_escalated is what the mechanisms lane reads.
// - usa_uranium_committee (spec §19.6): the Advisory Committee on Uranium
//   first met on 1939-10-21.
// - quebec_agreement (spec §19.6): the British and American atomic projects
//   join, 1943-08-19. The projects lane reads the global flag
//   quebec_agreement (British nuclear scientists add 15% to the American
//   project).
//
// They are date events rather than beats so that a human receiver gets the
// card as well. With the lobby key ww1936Nukes off the projects lane skips
// the two atomic events (the DSL has no condition for the lobby key).
import { all, any, not, T } from "../helpers";
import type { EventDef } from "../types";

export const DEPTH_EVENTS: readonly EventDef[] = [
  {
    id: "treaty_escalation",
    kind: "country",
    picture: "document",
    date: { on: "1938-06-30", to: ["GBR", "USA", "FRA"] },
    trigger: not({ kind: "capitulated" }),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [{ kind: "set_gflag", flag: "treaty_escalated" }],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [{ kind: "pp", amount: 25 }],
      },
    ],
  },
  {
    id: "usa_uranium_committee",
    kind: "country",
    picture: "table",
    date: { on: "1939-10-21", to: ["USA"] },
    trigger: not({ kind: "capitulated" }),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [
          {
            kind: "research_bonus",
            tech: "nuclear_physics",
            pct: 100,
            uses: 1,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [{ kind: "pp", amount: 25 }],
      },
    ],
  },
  {
    id: "quebec_agreement",
    kind: "country",
    picture: "table",
    date: { on: "1943-08-19", to: ["GBR", "USA"] },
    trigger: all(
      not({ kind: "capitulated" }),
      any(
        all(
          { kind: "tag", tag: "GBR" },
          { kind: "same_faction", of: T("USA") },
        ),
        all(
          { kind: "tag", tag: "USA" },
          { kind: "same_faction", of: T("GBR") },
        ),
      ),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [{ kind: "set_gflag", flag: "quebec_agreement" }],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [],
      },
    ],
  },
];
