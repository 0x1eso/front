// World War 1936 P4 — the navy-chief and air-chief advisors (spec §16.3,
// plan Task 13 Step 6). Real people for Germany, Britain and the Soviet
// Union only (P3 §8.4); every other country gets the trait title cards.
// Dates: `from` inclusive, `until` exclusive (the day the person leaves the
// office). Each line names its sources.
//
// The Luftwaffe's commander-in-chief and the two German naval commanders-in-
// chief, once left out as convicted, are restored at the end (2026-10-31).
// Still title cards: the NKVD officer who headed the Soviet navy 1938-39 and
// Yakov Alksnis. Japan's advisors carry real names (lang files).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PERSONS_P4: PersonDef[] = [
  // ---- Germany: Luftwaffe chiefs of the general staff ----
  // source: Chef des Luftkommandoamtes / chief of staff 1935-03-01 to his
  // death in an air crash 1936-06-03 (en.wikipedia Walther Wever (general);
  // en.wikipedia Oberkommando der Luftwaffe list). Champion of the long-range bomber.
  {
    id: "deu_wever",
    nameKey: "ww1936.person.deu_wever",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_bomber"] },
    until: "1936-06-03",
    source:
      "Luftwaffe chief of staff 1935-03-01..1936-06-03 (died): en.wikipedia Walther Wever (general); en.wikipedia Oberkommando der Luftwaffe",
  },
  // source: chief of the general staff 1937-06-01 to 1939-01-31; later
  // commanded Luftflotte 5 and the home air defence (en.wikipedia
  // Oberkommando der Luftwaffe list; en.wikipedia Hans-Jürgen Stumpff). Held
  // by the British, never tried.
  {
    id: "deu_stumpff",
    nameKey: "ww1936.person.deu_stumpff",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_air_defense"] },
    from: "1937-06-01",
    until: "1939-02-01",
    source:
      "Luftwaffe chief of the general staff 1937-06-01..1939-01-31: en.wikipedia Oberkommando der Luftwaffe; en.wikipedia Hans-Jürgen Stumpff; never tried",
  },
  // source: chief of the general staff 1939-02-01 to his death 1943-08-18
  // (en.wikipedia Oberkommando der Luftwaffe list; historyofwar.org Hans
  // Jeschonnek). Dive-bomber and tactical-support school.
  {
    id: "deu_jeschonnek",
    nameKey: "ww1936.person.deu_jeschonnek",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_ground"] },
    from: "1939-02-01",
    until: "1943-08-18",
    source:
      "Luftwaffe chief of the general staff 1939-02-01..1943-08-18: en.wikipedia Oberkommando der Luftwaffe; historyofwar.org Hans Jeschonnek",
  },
  // source: chief of the general staff 1943-08-25 to his death after the
  // 1944-07-20 bomb, 1944-07-22 (en.wikipedia Oberkommando der Luftwaffe
  // list; en.wikipedia Günther Korten gives 1943-09-04). Pressed for a
  // strategic bomber force against Soviet industry.
  {
    id: "deu_korten",
    nameKey: "ww1936.person.deu_korten",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_bomber"] },
    from: "1943-08-25",
    until: "1944-07-22",
    source:
      "Luftwaffe chief of the general staff 1943-08-25..1944-07-22: en.wikipedia Oberkommando der Luftwaffe; en.wikipedia Günther Korten",
  },

  // ---- United Kingdom: First Sea Lords ----
  // source: First Sea Lord 1933-01-21 to 1938-09-07 (en.wikipedia First Sea
  // Lord list; en.wikipedia Ernle Chatfield, 1st Baron Chatfield). The spec's
  // "to 1938-11" is moved to the sources' date.
  {
    id: "gbr_chatfield",
    nameKey: "ww1936.person.gbr_chatfield",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_dockyard"] },
    until: "1938-09-07",
    source:
      "First Sea Lord 1933-01-21..1938-09-07: en.wikipedia First Sea Lord; en.wikipedia Ernle Chatfield, 1st Baron Chatfield",
  },
  // source: First Sea Lord 1938-09-07 to 1939-06-12 (en.wikipedia First Sea
  // Lord list; en.wikipedia Roger Backhouse).
  {
    id: "gbr_backhouse",
    nameKey: "ww1936.person.gbr_backhouse",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    from: "1938-09-07",
    until: "1939-06-12",
    source:
      "First Sea Lord 1938-09-07..1939-06-12: en.wikipedia First Sea Lord; en.wikipedia Roger Backhouse",
  },
  // source: First Sea Lord 1939-06-12 to 1943-10-15 (en.wikipedia First Sea
  // Lord list; en.wikipedia Dudley Pound). Also an admiral (Admirals.ts).
  {
    id: "gbr_pound",
    nameKey: "ww1936.person.gbr_pound",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    from: "1939-06-12",
    until: "1943-10-15",
    source:
      "First Sea Lord 1939-06-12..1943-10-15: en.wikipedia First Sea Lord; en.wikipedia Dudley Pound",
  },
  // source: First Sea Lord from 1943-10-15 (en.wikipedia First Sea Lord
  // list; en.wikipedia Andrew Cunningham). Also an admiral (Admirals.ts).
  {
    id: "gbr_cunningham",
    nameKey: "ww1936.person.gbr_cunningham",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    from: "1943-10-15",
    source:
      "First Sea Lord from 1943-10-15: en.wikipedia First Sea Lord; en.wikipedia Andrew Cunningham, 1st Viscount Cunningham of Hyndhope",
  },

  // ---- United Kingdom: air chiefs ----
  // source: Chief of the Air Staff 1933-05-22 to 1937-09-01 (en.wikipedia
  // Chief of the Air Staff (United Kingdom) list; en.wikipedia Edward
  // Ellington). The bomber-heavy expansion schemes.
  {
    id: "gbr_ellington",
    nameKey: "ww1936.person.gbr_ellington",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_bomber"] },
    until: "1937-09-01",
    source:
      "Chief of the Air Staff 1933-05-22..1937-09-01: en.wikipedia Chief of the Air Staff (United Kingdom); en.wikipedia Edward Ellington",
  },
  // source: Chief of the Air Staff 1937-09-01 to 1940-10-25 (same list;
  // en.wikipedia Cyril Newall). Backed the fighter and radar build-up.
  {
    id: "gbr_newall",
    nameKey: "ww1936.person.gbr_newall",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_air_defense"] },
    from: "1937-09-01",
    until: "1940-10-25",
    source:
      "Chief of the Air Staff 1937-09-01..1940-10-25: en.wikipedia Chief of the Air Staff (United Kingdom); en.wikipedia Cyril Newall",
  },
  // source: Chief of the Air Staff from 1940-10-25 (same list; en.wikipedia
  // Charles Portal, 1st Viscount Portal of Hungerford).
  {
    id: "gbr_portal",
    nameKey: "ww1936.person.gbr_portal",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    from: "1940-10-25",
    source:
      "Chief of the Air Staff from 1940-10-25: en.wikipedia Chief of the Air Staff (United Kingdom); en.wikipedia Charles Portal",
  },
  // source: Air Member for Research and Development to 1936, Fighter Command
  // 1936-07-14 to 1940-11-25 (en.wikipedia Hugh Dowding; RAF Museum Battle
  // of Britain history). The spec's air-defence card.
  {
    id: "gbr_dowding",
    nameKey: "ww1936.person.gbr_dowding",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_air_defense"] },
    until: "1940-11-25",
    source:
      "Fighter Command 1936-07-14..1940-11-25: en.wikipedia Hugh Dowding; rafmuseum.org.uk Battle of Britain commanders",
  },
  // source: Bomber Command from 1942-02-22 (en.wikipedia Arthur Harris;
  // en.wikipedia RAF Bomber Command). Never tried. The spec's bombing card.
  {
    id: "gbr_harris",
    nameKey: "ww1936.person.gbr_harris",
    country: "GBR",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_bomber"] },
    from: "1942-02-22",
    source:
      "Bomber Command from 1942-02-22: en.wikipedia Arthur Harris; en.wikipedia RAF Bomber Command",
  },

  // ---- Soviet Union ----
  // source: head of the Naval Forces 1931 to his arrest 1937-07-10 (Mikhail
  // Viktorov from August 1937); shot 1938, rehabilitated (en.wikipedia Vladimir
  // Mitrofanovich Orlov; Military Wiki Commander-in-Chief of the Russian Navy
  // list). Light-forces and submarine school. Also an admiral (Admirals.ts).
  {
    id: "sun_orlov",
    nameKey: "ww1936.person.sun_orlov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_raider"] },
    until: "1937-07-10",
    source:
      "head of the Soviet Naval Forces to his arrest 1937-07-10: en.wikipedia Vladimir Mitrofanovich Orlov; military-history.fandom.com Commander-in-Chief of the Russian Navy",
  },
  // source: People's Commissar of the Navy from 1939-04-28 (en.wikipedia
  // Nikolay Kuznetsov (officer); en.wikipedia Commander-in-Chief of the
  // Russian Navy list). The big-fleet programme. Also an admiral (Admirals.ts).
  {
    id: "sun_kuznetsov",
    nameKey: "ww1936.person.sun_kuznetsov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_dockyard"] },
    from: "1939-04-28",
    source:
      "People's Commissar of the Navy from 1939-04-28: en.wikipedia Nikolay Kuznetsov (officer); en.wikipedia Commander-in-Chief of the Russian Navy",
  },
  // source: head of the Red Army Air Forces 1939-11-19 to 1940-08 (Rychagov
  // from 1940-08-28); arrested 1941-06, shot 1941-10 (en.wikipedia Commander
  // of the Russian Air Force list; globalsecurity.org Russian Air Force
  // commanders). Fighter pilot of Spain and Khalkhin Gol.
  {
    id: "sun_smushkevich",
    nameKey: "ww1936.person.sun_smushkevich",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    from: "1939-11-19",
    until: "1940-08-28",
    source:
      "Red Army Air Forces commander 1939-11-19..1940-08: en.wikipedia Commander of the Russian Air Force; globalsecurity.org Russian Air Force commanders",
  },
  // source: commander of the Red Army Air Forces from 1942-04-11 (same list;
  // globalsecurity.org). Arrested 1946, rehabilitated 1953.
  {
    id: "sun_novikov",
    nameKey: "ww1936.person.sun_novikov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_ground"] },
    from: "1942-04-11",
    source:
      "Red Army Air Forces commander from 1942-04-11: en.wikipedia Commander of the Russian Air Force; globalsecurity.org Russian Air Force commanders",
  },

  // ---- Restored 2026-10-31 (the convicted commanders' exclusion was abolished) ----
  // source: Luftwaffe commander-in-chief from 1935-03-01 (en.wikipedia Oberkommando der Luftwaffe; en.wikipedia Hermann Göring)
  {
    id: "deu_goering",
    nameKey: "ww1936.person.deu_goering",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    from: "1935-03-01",
    source:
      "Luftwaffe commander-in-chief from 1935-03-01 (en.wikipedia Oberkommando der Luftwaffe; en.wikipedia Hermann Göring)",
  },
  // source: Luftwaffe state secretary and inspector general (en.wikipedia Erhard Milch)
  {
    id: "deu_milch",
    nameKey: "ww1936.person.deu_milch",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_air_defense"] },
    source:
      "Luftwaffe state secretary and inspector general (en.wikipedia Erhard Milch)",
  },
  // source: Commander-in-Chief of the Kriegsmarine to 1943-01-30 (en.wikipedia Erich Raeder)
  {
    id: "deu_raeder",
    nameKey: "ww1936.person.deu_raeder",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    until: "1943-01-30",
    source:
      "Commander-in-Chief of the Kriegsmarine to 1943-01-30 (en.wikipedia Erich Raeder)",
  },
  // source: Commander-in-Chief of the Kriegsmarine from 1943-01-30 (en.wikipedia Karl Dönitz)
  {
    id: "deu_doenitz",
    nameKey: "ww1936.person.deu_doenitz",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_raider"] },
    from: "1943-01-30",
    source:
      "Commander-in-Chief of the Kriegsmarine from 1943-01-30 (en.wikipedia Karl Dönitz)",
  },
];
