// World War 1936 P5 — American advisors (spec §19.5). Dates: `from`
// inclusive, `until` exclusive (the day the person leaves the office). None
// of them was tried for war crimes or led a security police (P3 §8.4);
// each line names its sources. President Roosevelt (leader_usa) and Truman
// (usa_truman) are P3's.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PERSONS_USA: PersonDef[] = [
  // ---- politics ----
  // source: Secretary of State 1933-03-04 to 1944-11-30 (history.state.gov
  // "Cordell Hull" — Principal Officers table; en.wikipedia "Cordell Hull").
  {
    id: "usa_hull",
    nameKey: "ww1936.person.usa_hull",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "democratic",
    until: "1944-11-30",
    source:
      "Secretary of State 1933-03-04..1944-11-30: history.state.gov Cordell Hull; en.wikipedia Cordell Hull",
  },
  // source: Secretary of Commerce from 1938-12-24 (to 1940-09-18, the FDR
  // Library finding aid says he resigned in 1940-08), then the President's
  // closest adviser and Lend-Lease administrator (en.wikipedia "Harry
  // Hopkins"; fdrlibrary.org Hopkins papers finding aid).
  {
    id: "usa_hopkins",
    nameKey: "ww1936.person.usa_hopkins",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    ideology: "democratic",
    from: "1938-12-24",
    source:
      "Secretary of Commerce from 1938-12-24, then presidential adviser: en.wikipedia Harry Hopkins; fdrlibrary.org Hopkins papers finding aid",
  },
  // source: Secretary of the Treasury 1934-01-01 to 1945-07-22
  // (home.treasury.gov "Henry Morgenthau, Jr. (1934 - 1945)";
  // federalreservehistory.org "Henry Morgenthau Jr.").
  {
    id: "usa_morgenthau",
    nameKey: "ww1936.person.usa_morgenthau",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    ideology: "democratic",
    until: "1945-07-22",
    source:
      "Secretary of the Treasury 1934-01-01..1945-07-22: home.treasury.gov; federalreservehistory.org Henry Morgenthau Jr.",
  },
  // source: Secretary of War 1940-07-10 to 1945-09-21 (en.wikipedia "Henry
  // L. Stimson"; millercenter.org "Henry L. Stimson (1940–1945)").
  {
    id: "usa_stimson",
    nameKey: "ww1936.person.usa_stimson",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["hawk"] },
    ideology: "democratic",
    from: "1940-07-10",
    until: "1945-09-21",
    source:
      "Secretary of War 1940-07-10..1945-09-21: en.wikipedia Henry L. Stimson; millercenter.org",
  },
  // source: Secretary of Labor 1933-03-04 to 1945-06-30 (dol.gov "Hall of
  // Secretaries: Frances Perkins"; en.wikipedia "Frances Perkins").
  {
    id: "usa_perkins",
    nameKey: "ww1936.person.usa_perkins",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    ideology: "democratic",
    until: "1945-06-30",
    source:
      "Secretary of Labor 1933-03-04..1945-06-30: dol.gov Hall of Secretaries; en.wikipedia Frances Perkins",
  },

  // ---- Army Chief of Staff and staff ----
  // source: Chief of Staff of the Army 1935-10-02 to 1939-08-31
  // (en.wikipedia "Chief of Staff of the United States Army" list;
  // en.wikipedia "Malin Craig").
  {
    id: "usa_craig",
    nameKey: "ww1936.person.usa_craig",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    until: "1939-09-01",
    source:
      "Army Chief of Staff 1935-10-02..1939-08-31: en.wikipedia Chief of Staff of the United States Army; en.wikipedia Malin Craig",
  },
  // source: Chief of Staff of the Army 1939-09-01 to 1945-11-18
  // (en.wikipedia "Chief of Staff of the United States Army" list;
  // en.wikipedia "George C. Marshall"). Not a P2 general.
  {
    id: "usa_marshall",
    nameKey: "ww1936.person.usa_marshall",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_maneuver"] },
    from: "1939-09-01",
    source:
      "Army Chief of Staff 1939-09-01..1945-11-18: en.wikipedia Chief of Staff of the United States Army; en.wikipedia George C. Marshall",
  },
  // source: Chief of Staff, GHQ from 1940-07, Commanding General Army Ground
  // Forces from 1942-03; killed near Saint-Lô 1944-07-25 (army.mil "Rediscovering
  // Fort Knox: 1927 Army officer…"; en.wikipedia "Lesley J. McNair").
  {
    id: "usa_mcnair",
    nameKey: "ww1936.person.usa_mcnair",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_training"] },
    from: "1940-07-01",
    until: "1944-07-25",
    source:
      "GHQ chief of staff 1940-07, Army Ground Forces 1942-03, killed 1944-07-25: army.mil; en.wikipedia Lesley J. McNair",
  },

  // ---- industry and research ----
  // source: named to the National Defense Advisory Commission 1940-05-28,
  // Director General of the Office of Production Management 1941-01-07
  // until the War Production Board replaced it (1942-01-16) (govinfo.gov
  // OPM council minutes; en.wikipedia "William S. Knudsen").
  {
    id: "usa_knudsen",
    nameKey: "ww1936.person.usa_knudsen",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1940-05-28",
    until: "1942-01-16",
    source:
      "NDAC 1940-05-28, OPM Director General 1941-01-07..1942-01: govinfo.gov OPM minutes; en.wikipedia William S. Knudsen",
  },
  // source: chairman of the War Production Board from its creation by
  // Executive Order 9024 on 1942-01-16; J. A. Krug acting chairman from
  // 1944-08-27 and chairman from 1944-10-01 (en.wikipedia "War Production
  // Board"; trumanlibrary.gov letter accepting Krug's resignation, 1945).
  {
    id: "usa_nelson",
    nameKey: "ww1936.person.usa_nelson",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1942-01-16",
    until: "1944-10-01",
    source:
      "War Production Board chairman 1942-01-16..1944-09: en.wikipedia War Production Board; trumanlibrary.gov Krug letter",
  },
  // source: Secretary of the Interior 1933-03-04 to 1946-02-15, in charge of
  // fuel during the war (en.wikipedia "Harold L. Ickes"; nps.gov "Harold
  // Ickes").
  {
    id: "usa_ickes",
    nameKey: "ww1936.person.usa_ickes",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "Secretary of the Interior 1933-03-04..1946-02-15: en.wikipedia Harold L. Ickes; nps.gov Harold Ickes",
  },
  // source: chairman of the National Defense Research Committee from
  // 1940-06-27, director of OSRD from 1941-06-28 (en.wikipedia "Vannevar
  // Bush"; en.wikipedia "National Defense Research Committee"). The focus
  // usa_defense_research opens him early.
  {
    id: "usa_bush",
    nameKey: "ww1936.person.usa_bush",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    from: "1940-06-27",
    source:
      "NDRC chairman 1940-06-27, OSRD director 1941-06-28: en.wikipedia Vannevar Bush; en.wikipedia National Defense Research Committee",
  },

  // ---- Chiefs of Naval Operations ----
  // source: CNO 1933-07-01 to 1937-01-01 (history.navy.mil DANFS "William
  // H. Standley": retired 1937-01-01; en.wikipedia "Chief of Naval
  // Operations" list).
  {
    id: "usa_standley",
    nameKey: "ww1936.person.usa_standley",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    until: "1937-01-02",
    source:
      "CNO 1933-07-01..1937-01-01: history.navy.mil DANFS William H. Standley; en.wikipedia Chief of Naval Operations",
  },
  // source: CNO 1937-01-02 to 1939-08-01 (history.navy.mil "Fleet Admiral
  // William D. Leahy"; en.wikipedia "Chief of Naval Operations" list).
  {
    id: "usa_leahy",
    nameKey: "ww1936.person.usa_leahy",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    from: "1937-01-02",
    until: "1939-08-01",
    source:
      "CNO 1937-01-02..1939-08-01: history.navy.mil Fleet Admiral William D. Leahy; en.wikipedia Chief of Naval Operations",
  },
  // source: CNO 1939-08-01, relieved by King 1942-03-26 (history.navy.mil
  // "Fleet Admiral Ernest J. King": "Relieving Admiral Stark on March 26,
  // 1942"; history.navy.mil Stark photo page; the en.wikipedia CNO table
  // says 1942-03-02 — the Navy's date is kept).
  {
    id: "usa_stark",
    nameKey: "ww1936.person.usa_stark",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    from: "1939-08-01",
    until: "1942-03-26",
    source:
      "CNO 1939-08-01..1942-03-26: history.navy.mil Ernest J. King and Harold R. Stark; en.wikipedia Chief of Naval Operations",
  },
  // source: Commander in Chief, U.S. Fleet from 1941-12-30, CNO from
  // 1942-03-26 (history.navy.mil "Fleet Admiral Ernest J. King";
  // en.wikipedia "Ernest King").
  {
    id: "usa_king",
    nameKey: "ww1936.person.usa_king",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_carrier"] },
    from: "1942-03-26",
    source:
      "COMINCH 1941-12-30, CNO from 1942-03-26: history.navy.mil Fleet Admiral Ernest J. King; en.wikipedia Ernest King",
  },

  // ---- Chiefs of the Air Corps ----
  // source: Chief of the Air Corps from 1935-12-22, killed in a crash at
  // Burbank 1938-09-21 (af.mil "Major General Oscar Westover"; en.wikipedia
  // "Oscar Westover").
  {
    id: "usa_westover",
    nameKey: "ww1936.person.usa_westover",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_ground"] },
    until: "1938-09-21",
    source:
      "Chief of the Air Corps 1935-12-22..1938-09-21 (killed): af.mil Oscar Westover; en.wikipedia Oscar Westover",
  },
  // source: Chief of the Air Corps from 1938-09-29, Chief of the Army Air
  // Forces 1941-06-20, Commanding General 1942-03-09 (af.mil "General
  // Henry H. Arnold"; trumanlibrary.gov 1946 DSM citation; en.wikipedia
  // "Henry H. Arnold").
  {
    id: "usa_arnold",
    nameKey: "ww1936.person.usa_arnold",
    country: "USA",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_bomber"] },
    from: "1938-09-29",
    source:
      "Chief of the Air Corps from 1938-09-29, AAF 1941-06-20: af.mil Henry H. Arnold; trumanlibrary.gov DSM citation; en.wikipedia Henry H. Arnold",
  },
];
