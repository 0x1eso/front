import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwMoneyContent } from "../../MoneyRows";
import { REICHSRAT_OPEN } from "../house/houses";

// ww209 (W-AUH): Austria-Hungary's money bills (design §2.3). Checked
// 2026-11-13 unless marked F:
// - Vienna: the last ordinary budget was voted in 1910. From the Reichsrat's
//   prorogation in March 1914 until it met again on 30 May 1917 the state ran
//   on provisional budgets by decree under §14 of the 1867 constitution
//   (1914-1918-online, war finance Austria-Hungary; Rauchensteiner, The First
//   World War and the End of the Habsburg Monarchy, p. 718, via
//   austria-forum.org). A decree of 30 Dec 1915 carried credits to 30 June
//   1916 (Wienbibliothek gazette index, via search): half-yearly.
// - Once it sat, the Reichsrat voted provisional budgets half a year at a
//   time: one ran to December 1917 (Rauchensteiner p. 718), the next was due
//   by 30 June 1918. The Polish Club refused it, the budget lapsed on 1 July,
//   and Hussarek's passed after Seidler went, with Poles away (Rauchensteiner
//   pp. 962-964; The Spectator, 3 Aug 1918: a majority of 19).
// - The war loans came about half-yearly: eight, from November 1914 to June
//   1918, Austrian and Hungarian issues side by side (loan prospectuses via
//   search: the 1st Nov 1914, the 3rd May-July 1915, the 7th Hungarian Nov
//   1917, the 8th June-July 1918).
// - Budapest sat through the war. No ordinary estimates passed there either:
//   the 1914-15 finance act was carried on by authorisation (indemnity) bills,
//   and Law LXIII of 1912 gave the government the war's costs
//   (1914-1918-online, war finance). It voted a property tax and a war
//   profits tax in 1916 (same). No way round it: Tisza's majority or nothing.
// - The fleet: Cattaro, 1-3 Feb 1918 (widely documented); its card is
//   auh_cs_cattaro, dealt by hunger and low morale, not by date. A sea
//   operation: auh_cs_fleet_harbour (harbour or sortie, every few months).
// F: the §14 decrees' exact half-years 1914-16 (one decree seen); the
// Hungarian indemnity bills' dates.

const war: GwCond = world({ is: "war" });

export const AUH_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "AUH",
      houses: ["reichsrat", "budapest"],
      credits: [
        { by: "vote", every: 6, when: REICHSRAT_OPEN },
        { by: "decree", every: 6 },
      ],
      fail: "runs_on",
      failBy: { budapest: "unpaid" },
      round: { around: "par14" },
      owners: {
        // The AOK minds the army's money: Conrad, then Arz.
        army: { faction: "auh_aok", office: "chief_of_staff" },
        // The k.u.k. fleet at Pola: Haus, then Njegovan and Horthy.
        navy: { office: "navy" },
        // Vienna's bread lines: the Christian Socials held the city hall.
        relief: { faction: "auh_csoc", community: "auh_c_vienna" },
        // The factory districts: the Social Democrats' people.
        works: { faction: "auh_sd", community: "auh_c_workers" },
        // Hungary's quota: Tisza's party, the Magyars' Diet.
        national: {
          inst: "hungary",
          faction: "auh_work",
          community: "auh_c_magyars",
        },
      },
      fleet: { low: "auh_cs_cattaro", high: "auh_cs_fleet_harbour" },
    },
  ],
  // 지역에 돈을 준다: points of a line for a leader's people. The places are
  // real; the sums are the game's (T tunes). Text: AUH.house.json
  // money.mark.<id>.
  earmarks: [
    // Galicia's refugees and burnt towns: the Russians held Lemberg from
    // Sept 1914 to 22 June 1915 (widely documented); the Polish Club's ask.
    {
      id: "auh_galicia_aid",
      tag: "AUH",
      line: "relief",
      points: 2,
      faction: "auh_poles",
      community: "auh_c_north",
      when: war,
    },
    // Vienna's flour: the city's food under the Christian Social mayor.
    {
      id: "auh_vienna_flour",
      tag: "AUH",
      line: "relief",
      points: 2,
      faction: "auh_csoc",
      community: "auh_c_vienna",
    },
    // War kitchens and rents in the factory districts.
    {
      id: "auh_workers_bread",
      tag: "AUH",
      line: "relief",
      points: 1,
      faction: "auh_sd",
      community: "auh_c_workers",
    },
    // Czech schools in Bohemia and Moravia (the game's reading of the Czech
    // Union's school demands, F).
    {
      id: "auh_bohemia_schools",
      tag: "AUH",
      line: "works",
      points: 1,
      faction: "auh_czech",
      community: "auh_c_north",
    },
    // Dalmatia and Herzegovina went hungry in 1917 (the Yugoslav Club's
    // complaint beside the May Declaration, F).
    {
      id: "auh_dalmatia_bread",
      tag: "AUH",
      line: "relief",
      points: 1,
      faction: "auh_slavs",
      community: "auh_c_south",
      when: war,
    },
    // Hungary's grain at a Hungarian price: Tisza's party's ask.
    {
      id: "auh_grain_price",
      tag: "AUH",
      line: "national",
      points: 2,
      faction: "auh_work",
      community: "auh_c_magyars",
    },
    // Tyrol's valleys behind the Italian front (from May 1915): the German
    // Nationals' Alpine seats (F).
    {
      id: "auh_tyrol_valleys",
      tag: "AUH",
      line: "works",
      points: 1,
      faction: "auh_germans",
      community: "auh_c_germans",
      when: { kind: "at_war", tag: "ITA" },
    },
  ],
};
