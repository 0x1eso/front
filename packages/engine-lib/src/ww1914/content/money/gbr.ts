import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwMoneyContent } from "../../MoneyRows";

// ww209 (W-GBR): Britain's money bills (design §2.3). Text: GBR.house.json
// `money.mark.<id>`. See /home/eser/dev/ww209-format.md.
//
// Checked (Hansard, api.parliament.uk; 1914-1918-online):
// - The Commons only: the Parliament Act 1911 leaves the Lords a month's
//   delay on a money bill, no veto.
// - Votes of credit: £100 m on 6 Aug 1914, £225 m on 16 Nov 1914, then 1 Mar
//   1915 (more for 1914-15 and £250 m for 1915-16), Jun 1915 (£250 m, "the
//   fifth"), Jul 1915 (£150 m), Sep 1915 (£250 m), Nov 1915, 21 Feb 1916
//   (about £420 m); in 1917 Feb, Mar, May (£500 m), Jul (£650 m), Dec (£550
//   m). About every three months in the first war year, every two after.
// - The way round: none in law. Taxes taken on a resolution alone were struck
//   down in Bowles v Bank of England (1912-13); the Crown spends only what
//   Parliament grants. The game's way round is the prorogation power
//   (gbr_pw_prorogue, `beyond`: supply by Order in Council), at its price.
// - Supply is confidence. The Lords' refusal of the People's Budget (Nov
//   1909) was met by a dissolution and the January 1910 election: `dissolve`.
//   Rosebery resigned over the cordite vote on the War Office's supply (June
//   1895): from memory, F.
//
// Owners: the Army and Navy Estimates are moved by the Secretary of State for
// War and the First Lord; the Unionists were the big-navy party ("we want
// eight", 1909) and the yards build the keels; Labour and the unions minded
// the separation allowances and pensions (the Ministry of Pensions under
// Labour's Barnes, Dec 1916, F); the national line (allied subsidies) is the
// Foreign Office's. Works: the Liberals' New Liberalism (pensions 1908,
// insurance 1911) and the chapels behind it.

const war: GwCond = world({ is: "war" });
const warAge = (min: number): GwCond => world({ is: "war_age", min });

export const GBR_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "GBR",
      houses: ["commons"],
      credits: [
        // From the war's second year on: about every two months.
        { by: "vote", every: 2, when: warAge(10) },
        // Aug 1914, Nov 1914, Mar 1915: about every three months.
        { by: "vote", every: 3 },
      ],
      fail: "confidence",
      round: { flag: "f_gbr_prorogued" },
      dissolve: true,
      owners: {
        army: { faction: "gbr_generals", inst: "army", office: "war" },
        navy: {
          faction: "gbr_unionists",
          community: "gbr_war_industry",
          office: "navy",
        },
        relief: { faction: "gbr_labour", community: "gbr_unions" },
        works: { faction: "gbr_liberals", community: "gbr_nonconformists" },
        national: { office: "foreign" },
      },
    },
  ],
  earmarks: [
    // Irish land purchase: the Treasury's stock for the 1903 and 1909 Land
    // Acts ran short and purchases stalled (F). The Irish Party's money price
    // (gbr_irish `irish_money`).
    {
      id: "gbr_irish_land",
      tag: "GBR",
      line: "works",
      points: 1,
      faction: "gbr_irish",
      community: "gbr_irish_catholics",
    },
    // Shell contracts for Ireland: national shell factories at Dublin, Cork
    // and Waterford after Irish members' complaints (1915-16, F).
    {
      id: "gbr_irish_shells",
      tag: "GBR",
      line: "army",
      points: 2,
      faction: "gbr_irish",
      community: "gbr_irish_catholics",
      when: warAge(8),
    },
    // The Ulster Volunteers taken in whole as the 36th (Ulster) Division
    // (Sept 1914): their camps, kit and reserve battalions.
    {
      id: "gbr_ulster_division",
      tag: "GBR",
      line: "army",
      points: 1,
      faction: "gbr_unionists",
      community: "gbr_ulster_church",
      when: war,
    },
    // Lloyd George's Welsh Army Corps (Sept 1914), the 38th (Welsh) Division.
    {
      id: "gbr_welsh_corps",
      tag: "GBR",
      line: "army",
      points: 1,
      faction: "gbr_liberals",
      community: "gbr_nonconformists",
      when: war,
    },
    // Separation allowances for soldiers' wives and the war pensions: the
    // Labour Party's price (gbr_labour `pensions`).
    {
      id: "gbr_separation",
      tag: "GBR",
      line: "relief",
      points: 1,
      faction: "gbr_labour",
      community: "gbr_unions",
      when: war,
    },
    // Homes for munition workers: Well Hall (Woolwich, 1915) and the
    // townships at Gretna and Eastriggs (1916).
    {
      id: "gbr_munition_homes",
      tag: "GBR",
      line: "works",
      points: 1,
      faction: "gbr_lg",
      community: "gbr_war_industry",
      when: warAge(10),
    },
    // Guaranteed prices for wheat and oats (the Corn Production Act, Aug
    // 1917): the farms and the land.
    {
      id: "gbr_corn_prices",
      tag: "GBR",
      line: "relief",
      points: 1,
      faction: "gbr_unionists",
      community: "gbr_landed_city",
      when: warAge(28),
    },
  ],
};
