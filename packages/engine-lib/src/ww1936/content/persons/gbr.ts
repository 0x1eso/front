// World War 1936 P3 — British advisors and the leaders the British events
// install (spec §19.9). Dates: `from` inclusive, `until` exclusive (the day
// the person leaves the office). None of them was tried for war crimes or
// led a security police (spec §8.4); each line names its sources.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PERSONS_GBR: PersonDef[] = [
  // ---- politics ----
  // source: Chancellor of the Exchequer to 1937-05-28, then Prime Minister
  // to 1940-05-10; died 1940-11-09 (en.wikipedia "Neville Chamberlain";
  // archontology.org UK prime ministers; gov.uk "Past Prime Ministers").
  // Leaves the advisor slot when he becomes leader (spec §5.7).
  {
    id: "gbr_chamberlain",
    nameKey: "ww1936.person.gbr_chamberlain",
    country: "GBR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    leaderTraits: ["peace_negotiator"],
    ideology: "democratic",
    until: "1940-11-09",
    source:
      "Chancellor of the Exchequer, PM 1937-05-28..1940-05-10, died 1940-11-09: en.wikipedia Neville Chamberlain; archontology.org; gov.uk Past Prime Ministers",
  },
  // source: Foreign Secretary 1935-12 to 1938-02-20 and again from
  // 1940-12-22 (en.wikipedia "Anthony Eden"; University of Birmingham
  // archive catalogue: Dec 1935-Feb 1938, Dec 1940-Jul 1945; UWE paper:
  // resigned 1938-02-20). No dates: the events gbr_eden_resigns and
  // gbr_eden_returns move him.
  {
    id: "gbr_eden",
    nameKey: "ww1936.person.gbr_eden",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "democratic",
    source:
      "Foreign Secretary 1935-12..1938-02-20 and from 1940-12-22: en.wikipedia Anthony Eden; University of Birmingham archive catalogue",
  },
  // source: Foreign Secretary 1938-02-21 to 1940-12-22, then ambassador in
  // Washington (en.wikipedia "Edward Wood, 1st Earl of Halifax"; gov.uk
  // "Past Foreign Secretaries": Feb 1938-Dec 1940; Britannica gives the
  // formal appointment as 1938-02-25).
  {
    id: "gbr_halifax",
    nameKey: "ww1936.person.gbr_halifax",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    ideology: "democratic",
    from: "1938-02-21",
    until: "1940-12-22",
    source:
      "Foreign Secretary 1938-02-21..1940-12-22: en.wikipedia Edward Wood, 1st Earl of Halifax; gov.uk Past Foreign Secretaries; Britannica",
  },
  // source: backbench critic of the government to 1939-09, First Lord of
  // the Admiralty 1939-09-03, Prime Minister 1940-05-10 (en.wikipedia
  // "Winston Churchill"; archontology.org UK prime ministers).
  {
    id: "gbr_churchill",
    nameKey: "ww1936.person.gbr_churchill",
    country: "GBR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["hawk", "orator"] },
    leaderTraits: ["war_leader"],
    ideology: "democratic",
    source:
      "First Lord of the Admiralty 1939-09-03, PM 1940-05-10: en.wikipedia Winston Churchill; archontology.org",
  },
  // source: Leader of the Labour Party from 1935-10-25 (elected 1935-12-03),
  // Deputy Prime Minister 1942-02-19, Prime Minister 1945-07-26
  // (en.wikipedia "Clement Attlee"; archontology.org; gov.uk "Past Prime
  // Ministers").
  {
    id: "gbr_attlee",
    nameKey: "ww1936.person.gbr_attlee",
    country: "GBR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "Labour leader from 1935-10-25, PM 1945-07-26: en.wikipedia Clement Attlee; archontology.org; gov.uk Past Prime Ministers",
  },
  // source: Minister of Labour and National Service 1940-05-13 to
  // 1945-05-23 (en.wikipedia "Secretary of State for Employment" list;
  // en.wikipedia "Ernest Bevin").
  {
    id: "gbr_bevin",
    nameKey: "ww1936.person.gbr_bevin",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    ideology: "democratic",
    from: "1940-05-13",
    source:
      "Minister of Labour 1940-05-13..1945-05-23: en.wikipedia Secretary of State for Employment; en.wikipedia Ernest Bevin",
  },

  // ---- Chief of the Imperial General Staff ----
  // source: CIGS 1936-05-15 to 1937-12-06 (en.wikipedia "Chief of the
  // General Staff (United Kingdom)" list; en.wikipedia "John Vereker, 6th
  // Viscount Gort": Gort replaced him on 1937-12-06).
  {
    id: "gbr_deverell",
    nameKey: "ww1936.person.gbr_deverell",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    until: "1937-12-06",
    source:
      "CIGS 1936-05-15..1937-12-06: en.wikipedia Chief of the General Staff (United Kingdom); en.wikipedia Lord Gort",
  },
  // source: CIGS 1937-12-06 to 1939-09-03, then commander of the BEF
  // (en.wikipedia CIGS list and "Lord Gort"; historyofwar.org "John Vereker,
  // sixth Viscount Gort"). P2 general "gort".
  {
    id: "gbr_gort",
    nameKey: "ww1936.person.gbr_gort",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    from: "1937-12-06",
    until: "1939-09-03",
    alsoGeneral: "gort",
    source:
      "CIGS 1937-12-06..1939-09-03, then BEF: en.wikipedia Chief of the General Staff (United Kingdom); historyofwar.org Lord Gort",
  },
  // source: CIGS from 1939-09-03 (the CIGS list says 09-04) until Dill's
  // appointment, announced 1940-05-27 (the list says 05-26)
  // (en.wikipedia "Edmund Ironside"; en.wikipedia CIGS list).
  {
    id: "gbr_ironside",
    nameKey: "ww1936.person.gbr_ironside",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_offense"] },
    from: "1939-09-03",
    until: "1940-05-27",
    source:
      "CIGS 1939-09-03..1940-05-27: en.wikipedia Edmund Ironside, 1st Baron Ironside; en.wikipedia Chief of the General Staff (United Kingdom)",
  },
  // source: Vice-CIGS 1940-04, CIGS 1940-05-27 to 1941-12-25 (en.wikipedia
  // "John Dill"; en.wikipedia CIGS list).
  {
    id: "gbr_dill",
    nameKey: "ww1936.person.gbr_dill",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    from: "1940-05-27",
    until: "1941-12-25",
    source:
      "CIGS 1940-05-27..1941-12-25: en.wikipedia John Dill; en.wikipedia Chief of the General Staff (United Kingdom)",
  },
  // source: CIGS 1941-12-25 to 1946-06-25 (en.wikipedia CIGS list;
  // encyclopedia.com "Alan Francis Brooke": "late 1941"). P2 general
  // "brooke".
  {
    id: "gbr_brooke",
    nameKey: "ww1936.person.gbr_brooke",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_maneuver"] },
    from: "1941-12-25",
    alsoGeneral: "brooke",
    source:
      "CIGS 1941-12-25..1946-06-25: en.wikipedia Chief of the General Staff (United Kingdom); encyclopedia.com Alan Francis Brooke",
  },

  // ---- theorists ----
  // source: military correspondent of The Times 1935-1939 and informal
  // adviser to the War Secretary to 1938-07 (en.wikipedia "B. H. Liddell
  // Hart"); never charged with anything. No dates.
  {
    id: "gbr_liddell_hart",
    nameKey: "ww1936.person.gbr_liddell_hart",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["theorist_land"] },
    source:
      "military theorist, informal adviser to the War Secretary to 1938-07: en.wikipedia B. H. Liddell Hart",
  },
  // source: Royal Tank Corps from 1923, brigadier 1934, formed the Mobile
  // Division (Egypt) 1938-09/10, retired 1940, recalled 1941 (en.wikipedia
  // "Percy Hobart"; en.wikipedia "7th Armoured Division"). No dates.
  {
    id: "gbr_hobart",
    nameKey: "ww1936.person.gbr_hobart",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["theorist_armor"] },
    source:
      "armour pioneer, Mobile Division Egypt 1938: en.wikipedia Percy Hobart; en.wikipedia 7th Armoured Division",
  },

  // ---- industry ----
  // source: Minister for Co-ordination of Defence 1936-03-13 to 1939-01-29
  // (en.wikipedia "Minister for Co-ordination of Defence"; Auckland Star
  // 1939-01-30 via paperspast.natlib.govt.nz).
  {
    id: "gbr_inskip",
    nameKey: "ww1936.person.gbr_inskip",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1936-03-13",
    until: "1939-01-29",
    source:
      "Minister for Co-ordination of Defence 1936-03-13..1939-01-29: en.wikipedia Minister for Co-ordination of Defence; paperspast 1939-01-30",
  },
  // source: Minister of Aircraft Production 1940-05-14 to 1941-05-01
  // (en.wikipedia "Minister of Aircraft Production"; en.wikipedia "Max
  // Aitken, 1st Baron Beaverbrook").
  {
    id: "gbr_beaverbrook",
    nameKey: "ww1936.person.gbr_beaverbrook",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1940-05-14",
    until: "1941-05-01",
    source:
      "Minister of Aircraft Production 1940-05-14..1941-05-01: en.wikipedia Minister of Aircraft Production; en.wikipedia Lord Beaverbrook",
  },
  // source: President of the Board of Trade from 1940-01-05, Minister of
  // Supply 1940-10 and 1942-1945 (en.wikipedia "President of the Board of
  // Trade"; en.wikipedia "Andrew Rae Duncan").
  {
    id: "gbr_duncan",
    nameKey: "ww1936.person.gbr_duncan",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    from: "1940-01-05",
    source:
      "President of the Board of Trade from 1940-01-05, Minister of Supply: en.wikipedia President of the Board of Trade; en.wikipedia Andrew Rae Duncan",
  },

  // ---- research ----
  // source: chairman of the Committee for the Scientific Survey of Air
  // Defence from 1935, Rector of Imperial College, Tizard Mission 1940-09
  // (en.wikipedia "Henry Tizard"; Grace's Guide "Robert Watson-Watt": the
  // 1935 radar report went to Tizard's committee). Opened by
  // gbr_scientific_committee.
  {
    id: "gbr_tizard",
    nameKey: "ww1936.person.gbr_tizard",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "Tizard Committee chairman, Tizard Mission 1940: en.wikipedia Henry Tizard; gracesguide.co.uk",
  },
  // source: radar pioneer (Daventry test 1935-02-26), Superintendent of
  // Bawdsey Research Station 1936-09-01, Director of Communications
  // Development 1938-07 (en.wikipedia "Robert Watson-Watt"; Grace's Guide;
  // npl.co.uk). Opened by gbr_radar_chain.
  {
    id: "gbr_watson_watt",
    nameKey: "ww1936.person.gbr_watson_watt",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "radar pioneer, Bawdsey 1936-09-01, DCD 1938: en.wikipedia Robert Watson-Watt; gracesguide.co.uk; npl.co.uk",
  },
];
