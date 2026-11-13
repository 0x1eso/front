import type { GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwUtopiaContent } from "../../UtopiaRows";

// ww207 (W-RUS): RUS's faction trees: a template each, named and bent, 1-2
// nodes of their own, the regime and head a realised utopia brings. Text:
// resources/ww1914/ko/RUS.house.json `utopia.<id>`. See
// /home/eser/dev/ww207-format.md.
//
// The Octobrists' constitutional monarchy keeps Nicholas (`crown`, the
// ministry the Duma trusts). The Kadets' parliamentary republic and the
// Trudoviks' peasant republic make `rep`: the person goes, and the seat may
// play on as Prince Lvov or Kerensky (decision 1B; lane P writes those ruler
// rows, ids `lvov` and `kerensky`). The Rights' autocracy brings back `tsar`.
// The Bolsheviks' soviet Russia is a soviet form (lane S2 names it; here
// `rus_soviet`), with no head to play on as. The Progressists' merchants'
// Russia changes no regime. Own nodes are `perk`s and `law`s, never a new
// institution word, so the common text stays C's.
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const opinion = (
  bloc: "court" | "parliament" | "business" | "workers",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const inst = (i: "court" | "duma" | "stavka", delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});

export const RUS_UTOPIA: GwUtopiaContent = {
  trees: [
    {
      faction: "rus_octob",
      template: "parliament",
      utopia: "rus_u_constitutional",
      regime: "crown",
      own: [
        {
          id: "rus_octob_committees",
          tier: "moderate",
          kind: "perk",
          replaces: "m2",
          effects: [gauge("shells", 1), opinion("business", 1)],
        },
        {
          id: "rus_octob_law",
          tier: "bold",
          kind: "law",
          law: "rus_x_liberties",
          replaces: "b1",
          axes: { rule: 1 },
        },
      ],
    },
    {
      faction: "rus_kadets",
      template: "parliament",
      utopia: "rus_u_parl_republic",
      regime: "rep",
      head: "lvov",
      own: [
        {
          id: "rus_kadets_zemgor",
          tier: "moderate",
          kind: "perk",
          replaces: "m2",
          effects: [gauge("morale", 1), inst("duma", 1)],
        },
        {
          id: "rus_kadets_law",
          tier: "bold",
          kind: "law",
          law: "rus_x_ministry",
          replaces: "b1",
          axes: { rule: 1 },
        },
      ],
    },
    {
      faction: "rus_rights",
      template: "crown_army",
      utopia: "rus_u_autocracy",
      regime: "tsar",
      own: [
        {
          id: "rus_rights_synod",
          tier: "moderate",
          kind: "perk",
          replaces: "m2",
          effects: [opinion("court", 1), gauge("order", 1)],
          axes: { nations: -1 },
        },
        {
          id: "rus_rights_law",
          tier: "bold",
          kind: "law",
          law: "rus_x_advisory",
          replaces: "b1",
          axes: { rule: -1 },
        },
      ],
    },
    {
      faction: "rus_trud",
      template: "labour",
      utopia: "rus_u_peasant_republic",
      regime: "rep",
      head: "kerensky",
      own: [
        {
          id: "rus_trud_law",
          tier: "bold",
          kind: "law",
          law: "rus_x_land",
          replaces: "b1",
          axes: { class: 1 },
        },
      ],
    },
    {
      faction: "rus_bolsh",
      template: "labour",
      utopia: "rus_u_soviet",
      regime: "rus_soviet",
      own: [
        {
          id: "rus_bolsh_law",
          tier: "bold",
          kind: "law",
          law: "rus_x_eight_hours",
          replaces: "b1",
          axes: { class: 1 },
        },
        {
          id: "rus_bolsh_peace",
          tier: "extreme",
          kind: "perk",
          replaces: "x1",
          effects: [opinion("workers", 1), inst("stavka", -2)],
        },
      ],
    },
    {
      faction: "rus_progress",
      template: "market_empire",
      utopia: "rus_u_merchants",
      own: [
        {
          id: "rus_progress_banks",
          tier: "moderate",
          kind: "perk",
          replaces: "m2",
          effects: [gauge("money", 1), opinion("business", 1)],
        },
      ],
    },
  ],
};
