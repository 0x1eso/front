import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwMoneyContent } from "../../MoneyRows";
import { war } from "../laws/kit";

// ww209 (W-RUS): Russia's money bills (design §2.3). Checked against the
// Fundamental State Laws of 23 April 1906 (pravo.by's text):
// - Art. 116: a budget not passed by the start of the year leaves the last
//   one in force (with what later laws add), paid out a twelfth a month:
//   `runs_on`.
// - Art. 117: extraordinary credits for the needs of wartime and the
//   preparations before a war are opened by the Emperor's supreme
//   administration, on the grounds the law sets: no vote (`command`). The
//   seat may still put them to the Duma (`budget_put` credits).
// - Art. 118: loans for the cases of Arts. 116 and 117 are arranged by the
//   same supreme administration, which sets when and on what terms.
// - Art. 87: while the Duma does not sit, the Council of Ministers lays a
//   measure before the Emperor directly; it faces the Duma when it returns.
//   The new and raised taxes of 1914-15 went this way (323 measures from
//   July 1914 to July 1915, F: one SPbU paper), so it is the way round.
// The rhythm: seven internal war loans from the autumn of 1914 to the summer
// of 1917 (the first by the decree of 16 October 1914, 500 million at 5 %;
// another 500 million early in 1915; 1,000 million at 5.5 % decided in April
// 1915; profile.ru), about one in five months; the credits themselves were
// opened by the Council of Ministers as the war needed them. The Provisional
// Government kept the same road (the Liberty Loan, 1917), so one row.
// Text: RUS.house.json `money.mark.<id>`. See /home/eser/dev/ww209-format.md.
export const RUS_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "RUS",
      houses: ["duma", "council"],
      credits: [{ by: "command", every: 5 }],
      fail: "runs_on",
      round: { around: "art87" },
      // Each line's owner (decision 5B): who minds it raised or cut.
      owners: {
        // Stavka and its chief; the supreme commander's chair (the Tsar's
        // own from September 1915).
        army: {
          office: "supreme_commander",
          inst: "stavka",
          faction: "rus_stavka",
        },
        // Grigorovich's Naval Ministry; the Octobrists carried the navy's
        // programmes through the Third and Fourth Duma (F).
        navy: { office: "navy", faction: "rus_octob" },
        // Relief ran through the zemstvo and town unions (Zemgor) on treasury
        // grants with no conditions (1914-1918-online, parliaments).
        relief: { faction: "rus_bloc", community: "rus_zemstvo" },
        // Works and welfare: the factories' people.
        works: { faction: "rus_sd", community: "rus_workers" },
        // Russia's own share: the railways (design §1). The Moscow
        // industrialists and their orders ride on them.
        national: { faction: "rus_progress", community: "rus_merchants" },
      },
      // No sea repair for Russia's navy line: the fleet's mood. Under the
      // norm, the Gangut's sailors (Helsingfors, October 1915) come sooner;
      // over it, the Bosporus landing is planned.
      fleet: { low: "rus_h_gangut", high: "rus_w_bosporus_plan" },
    },
  ],
  // Lines his people can be given in the budget (지역에 돈을 준다).
  earmarks: [
    // Zemgor: the Union of Zemstvos (Lvov) and the Union of Towns ran
    // hospitals and refugee camps on the treasury's money.
    {
      id: "rus_zemgor",
      tag: "RUS",
      line: "relief",
      points: 3,
      faction: "rus_bloc",
      community: "rus_zemstvo",
      when: war,
    },
    // Allowances to the reservists' families; the Trudoviks' villages.
    {
      id: "rus_soldier_wives",
      tag: "RUS",
      line: "relief",
      points: 2,
      faction: "rus_trud",
      community: "rus_peasantry",
      when: war,
    },
    // Hospital trains: Purishkevich ran his own behind the front.
    {
      id: "rus_hospital_trains",
      tag: "RUS",
      line: "relief",
      points: 1,
      faction: "rus_rights",
      community: "rus_orthodox",
      when: war,
    },
    // The front-line south-west, Kiev and Volhynia (Shulgin's seat).
    {
      id: "rus_southwest_aid",
      tag: "RUS",
      line: "relief",
      points: 2,
      faction: "rus_pnat",
      community: "rus_zemstvo",
      when: war,
    },
    // Galicia while Russian troops hold Lemberg (September 1914 – June 1915).
    {
      id: "rus_galicia_relief",
      tag: "RUS",
      line: "relief",
      points: 2,
      faction: "rus_rights",
      community: "rus_orthodox",
      when: world({ is: "held", place: "lemberg", by: "us" }),
    },
    // Poland's war victims: the Citizens' Committee in Warsaw (F).
    {
      id: "rus_poland_relief",
      tag: "RUS",
      line: "relief",
      points: 2,
      faction: "rus_poles",
      community: "rus_nations",
      when: war,
    },
    // The war-industries committees (Guchkov's central one, July 1915).
    {
      id: "rus_war_industry",
      tag: "RUS",
      line: "army",
      points: 3,
      faction: "rus_octob",
      community: "rus_merchants",
      when: war,
    },
    // Army orders for Moscow's own works (Konovalov, Ryabushinsky).
    {
      id: "rus_moscow_orders",
      tag: "RUS",
      line: "army",
      points: 2,
      faction: "rus_progress",
      community: "rus_merchants",
      when: war,
    },
    // Peacetime fights in the budget commission: the Synod's parish schools
    // against the zemstvo schools of the 1908 universal schooling credits (F).
    {
      id: "rus_parish_schools",
      tag: "RUS",
      line: "works",
      points: 2,
      faction: "rus_rights",
      community: "rus_orthodox",
    },
    {
      id: "rus_zemstvo_schools",
      tag: "RUS",
      line: "works",
      points: 2,
      faction: "rus_kadets",
      community: "rus_zemstvo",
    },
  ],
};
