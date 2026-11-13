import { not } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwMoneyContent } from "../../MoneyRows";
import { since, war } from "../laws/kit";

// ww209 (W-FRA): France's money bills (design §2.3). The Chambre, then the
// Sénat, equal; a cabinet falls on a lost money vote. No way round: the state
// of siege carries no money. Text: FRA.house.json `money.mark.<id>`. See
// /home/eser/dev/ww209-format.md.
//
// The rhythm (checked): no budget was voted for the war years; the Chambers
// voted "douzièmes provisoires" instead. Six twelfths in August 1914, six more
// for the first half of 1915 (Ribot's bill went to the budget commission on
// 18-19 December 1914; Le Havre press of 19 December 1914); from 1915 the
// credits in three-month tranches that Ribot announced, the price of the
// Chambers sitting for good (assemblee-nationale.fr, "L'Union sacrée à
// l'œuvre"); still by quarter for the first quarter of 1919 (senat.fr,
// documents parlementaires 1918). When in 1915 the quarters began is not
// checked: here, from the summer. Sept 1916 passed 448:4 with the socialists
// (design, press); the first no votes were three socialists, Brizon,
// Raffin-Dugens and Blanc, on 24 June 1916 (fr.wikipedia Pierre Brizon).
// Not checked: whether the 1879 rule on credits opened by decree in the
// Chambers' absence counts as a way round; the Chambers sat from January 1915
// on, so it would close at once (the August 1914 decrees were ratified).
//
// Owners (5B): the army is the GQG's (Joffre's office); the navy the rue
// Royale's and the Fédération républicaine's, who back the fleet bill; relief
// the CGT's queues and the Catholics' charities (their orphans' price); works
// the Radicals' mayors; the national share is the soldiers' families'
// allowance (law of 5 August 1914), the socialists' cause, paid out mostly to
// the countryside (cantonal commissions; Ille-et-Vilaine archives guide).
//
// Earmarks: the refugees of the invaded north and east (secours aux
// réfugiés, 1914-1921: Nancy archives); the war damages, whose right to
// reparation the Chambers declared on 26 December 1914 and paid by the law of
// 17 April 1919 (Foulquier, RHFD 35); the workers' canteens; the nation's
// wards (pupilles de la nation, law of 27 July 1917); the schoolteachers'
// pay before the war; the farms short of hands.
export const FRA_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "FRA",
      houses: ["chambre", "senat"],
      credits: [
        { by: "vote", every: 3, when: since("1915-06") },
        { by: "vote", every: 6 },
      ],
      fail: "confidence",
      owners: {
        army: { office: "chief_of_staff", inst: "army", faction: "fra_gqg" },
        navy: { office: "navy", faction: "fra_fed_rep" },
        relief: { faction: "fra_catholics", community: "fra_cgt" },
        works: { faction: "fra_radicals", community: "fra_mayors" },
        national: {
          faction: "fra_sfio",
          community: "fra_peasants",
          inst: "chamber",
        },
      },
    },
  ],
  earmarks: [
    {
      id: "fra_refugees",
      tag: "FRA",
      line: "relief",
      points: 2,
      faction: "fra_fed_rep",
      when: war,
    },
    {
      id: "fra_war_damages",
      tag: "FRA",
      line: "works",
      points: 3,
      faction: "fra_left_rep",
      community: "fra_mayors",
      when: since("1914-12"),
    },
    {
      id: "fra_canteens",
      tag: "FRA",
      line: "relief",
      points: 2,
      faction: "fra_sfio",
      community: "fra_cgt",
      when: war,
    },
    {
      id: "fra_war_wards",
      tag: "FRA",
      line: "national",
      points: 2,
      faction: "fra_catholics",
      community: "fra_catholic",
      when: war,
    },
    {
      id: "fra_teachers",
      tag: "FRA",
      line: "works",
      points: 2,
      faction: "fra_radicals",
      community: "fra_laics",
      when: not(war),
    },
    {
      id: "fra_farm_hands",
      tag: "FRA",
      line: "works",
      points: 2,
      faction: "fra_radicals",
      community: "fra_peasants",
      when: war,
    },
  ],
};
