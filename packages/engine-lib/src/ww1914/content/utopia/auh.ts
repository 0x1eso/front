import { setFlag } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwNodeRow, GwUtopiaContent } from "../../UtopiaRows";
import { gauge, inst } from "../laws/kit";

// ww207 (W-AUH): AUH's faction trees: a template each, named and bent, a node
// of their own, the regime a realised utopia brings. Text:
// resources/ww1914/ko/AUH.house.json `utopia.<id>`. See
// /home/eser/dev/ww207-format.md.
//
// Each named tree carries its exclusive law (content/laws/auh.ts
// AUH_EXCLUSIVE_LAWS) on the node its row names, bent to kind `law`. The
// regimes auh_federal_crown and auh_trial are S2's; Karl stays in both.
// ww208 merge: the Social Democrats' tree brings the existing (ww197) form
// `austria_republic`, which has no place for the crown; its head is Renner
// (lane P). ww210 merge: the peace party born in the war (the generic
// `auh_g_peace`) takes the path without Karl: Lammasch's neutral federation
// of the peoples, form `federation`, head Lammasch (lane P).

const law = (id: string): Partial<GwNodeRow> => ({ kind: "law", law: id });

export const AUH_UTOPIA: GwUtopiaContent = {
  trees: [
    // Tisza: Hungary's half whole, its army its own, the nations kept down.
    {
      faction: "auh_work",
      template: "nation",
      utopia: "auh_u_magyar",
      bend: { b1: law("auh_x_magyar_army") },
      own: [
        {
          id: "o_grain",
          replaces: "m2",
          tier: "moderate",
          kind: "ability",
          power: "auh_pw_ab_grain",
        },
      ],
      realised: [inst("hungary", 2)],
    },
    // The German Nationals: Austria German at the centre, bound to Berlin.
    {
      faction: "auh_germans",
      template: "nation",
      utopia: "auh_u_german",
      bend: { b1: law("auh_x_mitteleuropa") },
      own: [
        {
          id: "o_offices",
          replaces: "m3",
          tier: "moderate",
          kind: "perk",
          effects: [inst("council", 1), inst("nations", -1)],
          axes: { dual: -1 },
        },
      ],
      realised: [setFlag("f_auh_german_austria"), inst("berlin", 1)],
    },
    // The Christian Socials: the Belvedere's federation under a Catholic crown.
    {
      faction: "auh_csoc",
      template: "church",
      utopia: "auh_u_federal",
      bend: { x1: law("auh_x_federal") },
      own: [
        {
          id: "o_city_hall",
          replaces: "m1",
          tier: "moderate",
          kind: "ability",
          power: "auh_pw_ab_city",
        },
      ],
      regime: "auh_federal_crown",
      realised: [setFlag("f_auh_federal")],
    },
    // The South Slav club: a third kingdom under the Habsburg sceptre.
    {
      faction: "auh_slavs",
      template: "nation",
      utopia: "auh_u_trial",
      bend: { x1: law("auh_x_trial") },
      own: [
        {
          id: "o_club",
          replaces: "b2",
          tier: "bold",
          kind: "perk",
          effects: [inst("nations", 1)],
          axes: { dual: 1 },
        },
      ],
      regime: "auh_trial",
      realised: [setFlag("f_auh_trial")],
    },
    // The Social Democrats: Renner's federation of nations by persons.
    {
      faction: "auh_sd",
      template: "labour",
      utopia: "auh_u_renner",
      bend: { b1: law("auh_x_autonomy") },
      own: [
        {
          id: "o_unions",
          replaces: "m1",
          tier: "moderate",
          kind: "ability",
          power: "auh_pw_ab_unions",
        },
      ],
      regime: "austria_republic",
      head: "renner",
      realised: [gauge("order", 1), inst("nations", 1)],
    },
    // The Czechs: the Bohemian state right, a king crowned in Prague.
    {
      faction: "auh_czech",
      template: "nation",
      utopia: "auh_u_bohemia",
      bend: { x1: law("auh_x_bohemian_crown") },
      own: [
        {
          id: "o_loyal",
          replaces: "m1",
          tier: "moderate",
          kind: "ability",
          power: "auh_pw_ab_czech",
        },
      ],
      realised: [setFlag("f_auh_bohemia_crown")],
    },
    // The Polish Club: the Austro-Polish solution, Galicia and Congress
    // Poland one kingdom under Vienna (F: memory, the war's plan).
    {
      faction: "auh_poles",
      template: "nation",
      utopia: "auh_u_poland",
      own: [
        {
          id: "o_legions",
          replaces: "m2",
          tier: "moderate",
          kind: "ability",
          power: "auh_pw_ab_legions",
        },
      ],
      realised: [setFlag("f_auh_poland_claimed")],
    },
    // The AOK: the empire run from Teschen.
    {
      faction: "auh_aok",
      template: "crown_army",
      utopia: "auh_u_army",
      realised: [inst("army", 2)],
    },
    // The peace party born in the war: Lammasch's way. The Hague jurist, the
    // Meinl circle's man for a separate peace (Karl sounded him for premier
    // in June 1917; premier at last 27 Oct-11 Nov 1918), for a neutral
    // Austria of free peoples. Realised: the peoples' councils govern and Karl
    // steps back from the affairs of state, as on 11 Nov 1918.
    {
      faction: "auh_g_peace",
      template: "peace",
      utopia: "auh_u_lammasch",
      regime: "federation",
      head: "lammasch",
      realised: [setFlag("f_auh_peace_word"), inst("nations", 1)],
    },
    // Károlyi: peace with the Entente and a Hungary of its own.
    {
      faction: "auh_karolyi",
      template: "peace",
      utopia: "auh_u_karolyi",
      realised: [setFlag("f_auh_peace_word"), inst("berlin", -1)],
    },
  ],
};
