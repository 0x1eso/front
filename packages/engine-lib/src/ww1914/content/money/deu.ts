import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwMoneyContent } from "../../MoneyRows";

// ww209 (W-DEU): Germany's money bills (design §2.3). The Reichstag, then the
// Bundesrat (Prussia's 17 and the small states follow the chancellor; the
// south holds 17). Text: DEU.house.json `money.mark.<id>`. See
// /home/eser/dev/ww209-format.md.
//
// Checked (✔) and not (F):
// - Credits: 5 bn on 4 Aug 1914 and 5 bn in Dec 1914, 10 bn in Mar 1915
//   (Helfferich in the house, 20 Aug 1915, ✔), 10 bn on 20 Aug 1915 and 10 bn
//   on 21 Dec 1915 (FES SPD chronicle ✔), two of 12 bn in 1916
//   (Wirtschaftsdienst ✔; 64 bn in all by Feb 1917 ✔), 15 bn bills in 1917
//   and a 15 bn credit in July 1918 (press ✔; the 1917-18 dates F). About
//   every four months, not half-yearly: `every: 4`.
// - A refused budget: the Reich constitution has no rule for it; Prussia's
//   way in 1862-66 was to spend without one (Bismarck's gap theory) and get
//   an indemnity in 1866 (DHM LeMO ✔). That is `f_deu_no_budget` (the power
//   deu_pw_nobudget), so last year's runs on here.
// - Dissolving over money: on 13 Dec 1906 the Centre, the SPD, the Poles and
//   the Guelphs threw out the South West Africa supplement, 178:168, and
//   Bülow dissolved the house the same day: the "Hottentot" election of
//   25 Jan 1907 (✔).
const war = world({ is: "war" });

export const DEU_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "DEU",
      houses: ["reichstag", "bundesrat"],
      credits: [{ by: "vote", every: 4 }],
      fail: "runs_on",
      round: { flag: "f_deu_no_budget" },
      dissolve: true,
      // Who minds each line (decision 5B).
      owners: {
        // The OHL and the War Ministry's estimates; the veterans' leagues.
        army: {
          faction: "deu_ohl",
          community: "deu_patriots",
          inst: "army",
          office: "chief_of_staff",
        },
        // Tirpitz's Naval Office; the Navy League and the yards' men: the
        // National Liberals carried every Navy Law with heavy industry.
        navy: {
          faction: "deu_natlib",
          community: "deu_patriots",
          office: "navy",
        },
        // The soldiers' families' allowance (the Reich's law of 4 Aug 1914)
        // and the war kitchens: the SPD's and the unions' first ask.
        relief: { faction: "deu_spd", community: "deu_workers" },
        // Building, the towns' works and the farm credit banks: the Centre's
        // own, from the Volksverein to the Bavarian peasants' unions.
        works: { faction: "deu_centre", community: "deu_catholics" },
        // The states' share (the matricular contributions): the Bundesrat's
        // south, and the Reichstag's mood with it (GW_BUDGET's national inst).
        national: { faction: "deu_south", inst: "reichstag" },
      },
      // DEU's navy line feeds the blockade, but the fleet's mood reads it too
      // (design §1): kept under the norm, the 1917 food unrest in the fleet
      // comes on sooner.
      fleet: { low: "deu_h_fleet_food" },
    },
  ],
  // Points of a line (of 100) set aside for his people. The war norm is
  // army 72, navy 8, relief 8, works 6, national 6.
  earmarks: [
    {
      // The Reich's money for East Prussia after the Russians left it,
      // autumn 1914 onward: farms, towns and roads rebuilt.
      id: "deu_east_prussia",
      tag: "DEU",
      line: "works",
      points: 2,
      faction: "deu_cons",
      community: "deu_owners",
      when: war,
    },
    {
      // The soldiers' families' allowance raised above the 1914 rate.
      id: "deu_war_families",
      tag: "DEU",
      line: "relief",
      points: 2,
      faction: "deu_spd",
      community: "deu_workers",
      when: war,
    },
    {
      // Cheap credit for small farms through the cooperative banks: the
      // Centre's peasants in Bavaria, the Rhineland and Silesia.
      id: "deu_farm_credit",
      tag: "DEU",
      line: "works",
      points: 2,
      faction: "deu_centre",
      community: "deu_catholics",
    },
    {
      // The matricular contributions the states pay into the Reich, eased
      // for Bavaria, Saxony, Württemberg and Baden.
      id: "deu_states_share",
      tag: "DEU",
      line: "national",
      points: 2,
      faction: "deu_south",
    },
    {
      // Relief for the villages behind the Vosges front in Upper Alsace.
      id: "deu_alsace_front",
      tag: "DEU",
      line: "relief",
      points: 1,
      faction: "deu_minor",
      community: "deu_borderlands",
      when: war,
    },
    {
      // More U-boat yards and crews (the kind of the 1918 Scheer programme).
      id: "deu_uboat_yards",
      tag: "DEU",
      line: "navy",
      points: 2,
      faction: "deu_natlib",
      community: "deu_patriots",
      when: war,
    },
  ],
};
