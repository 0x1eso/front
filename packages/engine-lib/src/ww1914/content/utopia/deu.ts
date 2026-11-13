import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type { GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwUtopiaContent } from "../../UtopiaRows";

// ww207 (W-DEU): DEU's faction trees: a template each, named and bent, a node
// or two of their own, the regime and head a realised utopia brings. Text:
// resources/ww1914/ko/DEU.house.json `utopia.<id>` (name, note, and the words
// of every node bent or added here). Exclusive laws: content/house/deu.ts
// (deu_x_*). See /home/eser/dev/ww207-format.md.
//
// Regimes: `republic` is engine Regimes' own; `deu_parl` and `deu_soviet` are
// S2's new forms (the soviet form's id is this lane's guess). Heads are lane
// P's ruler rows (`ebert`). History is flavour: these are what each party
// hoped the Reich would become, not what came.

const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
const inst = (
  i: "army" | "reichstag" | "countersign",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });

export const DEU_UTOPIA: GwUtopiaContent = {
  trees: [
    {
      // The Erfurt programme's Germany: a republic in all but name first,
      // then in name. Ebert would be its head.
      faction: "deu_spd",
      template: "labour",
      utopia: "deu_social_republic",
      bend: { m2: { kind: "law", law: "deu_x_eight_hours" } },
      own: [
        {
          id: "spd_free_unions",
          replaces: "m1",
          tier: "moderate",
          kind: "perk",
          effects: [opinion("workers", 1)],
          axes: { class: 1 },
        },
      ],
      regime: "republic",
      head: "ebert",
    },
    {
      // Payer's and Naumann's: the Kaiser stays, the ministers answer to
      // the house.
      faction: "deu_progress",
      template: "parliament",
      utopia: "deu_parl_monarchy",
      bend: { m2: { kind: "law", law: "deu_x_proportional" } },
      own: [
        {
          id: "prog_free_press",
          replaces: "b2",
          tier: "bold",
          kind: "perk",
          effects: [opinion("press", 1), inst("reichstag", 1)],
          axes: { rule: 1 },
        },
      ],
      regime: "deu_parl",
    },
    {
      // Erzberger's Centre: parity for Catholics, the states' rights, a
      // peace of understanding. The crown stays.
      faction: "deu_centre",
      template: "church",
      utopia: "deu_christian_reich",
      bend: { b1: { kind: "ability", power: "deu_pw_ab_centre" } },
      own: [
        {
          id: "centre_volksverein",
          replaces: "m1",
          tier: "moderate",
          kind: "perk",
          effects: [opinion("parliament", 1)],
          axes: { force: 1 },
        },
      ],
    },
    {
      // Bassermann's and Stresemann's: the fleet, the markets of the world,
      // industry's voice in the Reich.
      faction: "deu_natlib",
      template: "market_empire",
      utopia: "deu_world_power",
      bend: { b1: { kind: "ability", power: "deu_pw_ab_natlib" } },
      own: [
        {
          id: "natlib_trade_board",
          replaces: "m1",
          tier: "moderate",
          kind: "perk",
          effects: [opinion("business", 1), gauge("money", 1)],
          axes: { class: -1 },
        },
      ],
    },
    {
      // The Prussian Conservatives': the crown's army, the three-class
      // house, the estates east of the Elbe.
      faction: "deu_cons",
      template: "crown_army",
      utopia: "deu_crown_estates",
      bend: {
        b1: { kind: "law", law: "deu_x_army_fixed" },
        b2: { kind: "ability", power: "deu_pw_ab_cons" },
      },
      own: [
        {
          id: "cons_agrarian_league",
          replaces: "m1",
          tier: "moderate",
          kind: "perk",
          effects: [opinion("court", 1), gauge("bread", 1)],
          axes: { class: -1 },
        },
      ],
    },
    {
      // The supreme command's: the war economy under the army, the
      // chancellor its man. Realised: the OHL rules (the existing flag).
      faction: "deu_ohl",
      template: "crown_army",
      utopia: "deu_army_rule",
      own: [
        {
          id: "ohl_war_office",
          replaces: "m1",
          tier: "moderate",
          kind: "perk",
          effects: [gauge("shells", 1), inst("army", 1)],
          axes: { force: -1 },
        },
      ],
      realised: [{ kind: "flag", flag: "f_deu_ohl_rule" }],
    },
    {
      // The Fatherland Party's victor's peace: Belgium, Longwy-Briey, the
      // east. Realised only once the war is being won.
      faction: "deu_fatherland",
      template: "nation",
      utopia: "deu_victory",
      bend: { b1: { kind: "ability", power: "deu_pw_ab_fatherland" } },
      own: [
        {
          id: "fl_war_aims_press",
          replaces: "m1",
          tier: "moderate",
          kind: "perk",
          effects: [opinion("army", 1), gauge("morale", 1)],
          axes: { force: -1 },
        },
      ],
      when: world({ is: "score", min: 20 }),
    },
    {
      // Haase's: a peace without annexations, then the rest.
      faction: "deu_uspd",
      template: "peace",
      utopia: "deu_peace_first",
      own: [
        {
          id: "uspd_stockholm",
          replaces: "m1",
          tier: "moderate",
          kind: "perk",
          effects: [opinion("workers", 1)],
          axes: { force: 1 },
        },
      ],
    },
    {
      // Liebknecht's and Luxemburg's: all power to the councils.
      faction: "deu_spartacus",
      template: "labour",
      utopia: "deu_council_republic",
      own: [
        {
          id: "sparta_shop_stewards",
          replaces: "b1",
          tier: "bold",
          kind: "perk",
          effects: [opinion("workers", 1), gauge("order", -1)],
          axes: { class: 1 },
        },
      ],
      regime: "deu_soviet",
    },
    {
      // The Poles', Danes' and Alsace-Lorrainers': their own tongue in
      // school and court, their own say at home.
      faction: "deu_minor",
      template: "nation",
      utopia: "deu_borderland_rights",
      own: [
        {
          id: "minor_mother_tongue",
          replaces: "m1",
          tier: "moderate",
          kind: "perk",
          effects: [{ kind: "pressure", topic: "alsace", delta: -1 }],
          axes: { rule: 1 },
        },
      ],
    },
  ],
};
