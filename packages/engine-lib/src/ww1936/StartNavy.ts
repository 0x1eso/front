// World War 1936 P4 — the starting navies (spec §6.1–§6.4) and the starting
// air split (spec §12.4). The types are plan Task 1 Step 15's; lane G
// (Task 13) fills the tables. `resolveRegionName` is the foundation's.
//
// How the rows read:
// - A country's `ships` are dealt to its `fleets` class by class in table
//   order: the first fleet takes the first `counts[c]` ships of class c, the
//   next fleet the next ones. So the ships below are listed fleet by fleet,
//   and a named ship sits in the fleet it served in on 1 January 1936.
// - `counts` is BB/BC/CV/CA/CL/DD/SS. Destroyers and submarines have
//   numbered names (spec §4.4); battleships, battlecruisers, carriers and
//   cruisers carry their real names (key ww1936.ship.<name>).
// - Generation 1 unless the spec §6.1 exceptions say 2. Coastal defence
//   ships and armoured cruisers are generation-1 heavy cruisers (spec §4.1).
// - Region names are the world1936 scenario's (map v3 of lane P2-D); every
//   base, fleet base and line port is a coastal region.
// - Lines hold every ship on the slips on 1936-01-01 (spec §6.2 plus the
//   ones the fact-check found). `progressPct` is the first ship's; the
//   others start at 0 and wait their turn (HOI4 queue), so a line may hold
//   more ships than it has docks. Docks per country stay within spec §6.5.
//
// Sources: every named ship's line gives two references, en.wikipedia (the
// class article) and Conway's All the World's Fighting Ships 1922-1946 or
// navypedia.org. The fleet stations of January 1936 follow naval-history.net
// "Royal Navy organisation 1919-39" for Britain and the class articles'
// service histories for the rest (lane report lists the uncertain ones).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { ShipClass } from "@openfront/engine-api/ww1936/NavyTypes";
import type { ScenarioIndex } from "./ScenarioIndex";

export interface StartFleetDef {
  key: string /* ww1936.fleet.<key> */;
  base: string /* port region name */;
  counts: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ] /* BB BC CV CA CL DD SS */;
}
export interface StartShipDef {
  cls: ShipClass;
  gen: number;
  name?: string /* ww1936.ship.<name> */;
}
export interface StartLineDef {
  cls: ShipClass;
  gen: number;
  count: number;
  progressPct: number;
  docks: number;
  names: string[];
  /** Launch port region name (lane G addition; the foundation falls back to the best naval base). */
  port?: string;
}
export interface StartNavyDef {
  tag: CountryTag;
  ships: StartShipDef[];
  fleets: StartFleetDef[];
  lines: StartLineDef[];
  convoys: number;
  bases: string[];
}

function named(
  cls: ShipClass,
  gen: number,
  names: readonly string[],
): StartShipDef[] {
  return names.map((name) => ({ cls, gen, name }));
}
function numbered(cls: ShipClass, gen: number, count: number): StartShipDef[] {
  return Array.from({ length: count }, () => ({ cls, gen }));
}

/** Task 13 (spec §6). Used only when the scenario has `historicalOob` (plan decision 31). */
export const START_NAVY: readonly StartNavyDef[] = [
  // ======== United Kingdom (spec §6.1: 12/3/6/16/33/110/45, convoys 900) ========
  // CL 30, not 33: the Royal Navy had 30 light cruisers in commission or
  // reserve on 1936-01-01 (13 C, 8 D, 2 E, 5 Leander, 2 Arethusa; Apollo
  // commissioned 1936-01-13 and Amphion 1936-07-06 are a naval line). The
  // reserve fleet keeps 1.
  {
    tag: "GBR",
    convoys: 900,
    bases: [
      "Hampshire", // Portsmouth
      "Devon", // Plymouth (Devonport)
      "Highland", // Scapa Flow
      "Malta",
      "Singapore",
      "Scottish Borders", // Rosyth
      "London", // Chatham
      "Gibraltar",
      "Cairo", // Alexandria and Haifa
      "Hong Kong",
      "Ceylon", // Trincomalee
      "Bermuda",
      "Aden",
      "Northern 2", // Freetown
    ],
    fleets: [
      {
        key: "gbr_home_fleet",
        base: "Highland",
        counts: [5, 2, 2, 4, 10, 36, 12],
      },
      {
        key: "gbr_mediterranean_fleet",
        base: "Cairo",
        counts: [5, 1, 1, 4, 8, 36, 10],
      },
      {
        key: "gbr_china_station",
        base: "Hong Kong",
        counts: [0, 0, 1, 4, 3, 9, 15],
      },
      {
        key: "gbr_east_indies_station",
        base: "Ceylon",
        counts: [0, 0, 0, 1, 3, 0, 0],
      },
      {
        key: "gbr_america_west_indies_station",
        base: "Bermuda",
        counts: [0, 0, 0, 2, 3, 0, 0],
      },
      {
        key: "gbr_africa_station",
        base: "Northern 2",
        counts: [0, 0, 0, 0, 2, 0, 0],
      },
      {
        key: "gbr_reserve_fleet",
        base: "Devon",
        counts: [2, 0, 2, 1, 1, 29, 8],
      },
    ],
    ships: [
      // -- Home Fleet (2nd Battle Squadron, Battlecruiser Squadron, 2nd Cruiser Squadron) --
      // Nelson class: en.wikipedia Nelson-class battleship; Conway's 1922-46
      ...named("bb", 1, ["gbr_nelson", "gbr_rodney"]),
      // Revenge class (Resolution home from the Mediterranean 12.35, Ramillies
      // and Royal Sovereign boys' training 1.36): en.wikipedia Revenge-class
      // battleship; naval-history.net RN organisation 1919-39
      ...named("bb", 1, [
        "gbr_resolution",
        "gbr_ramillies",
        "gbr_royal_sovereign",
      ]),
      // Hood (Home Fleet until 9.36), Repulse (refit Portsmouth to 4.36):
      // en.wikipedia HMS Hood / HMS Repulse (1916); naval-history.net
      ...named("bc", 1, ["gbr_hood", "gbr_repulse"]),
      // Courageous (Home Fleet carrier, refitting at Devonport 10.35-6.36),
      // Furious: en.wikipedia HMS Courageous (50) / HMS Furious;
      // naval-history.net
      ...named("cv", 1, ["gbr_courageous", "gbr_furious"]),
      // Cumberland (refit in Britain 2.35-7.36), Suffolk; Hawkins and
      // Frobisher (Hawkins class, home waters): en.wikipedia County-class
      // cruiser / Hawkins-class cruiser; Conway's 1922-46
      ...named("ca", 1, [
        "gbr_cumberland",
        "gbr_suffolk",
        "gbr_hawkins",
        "gbr_frobisher",
      ]),
      // Leander class, 2nd Cruiser Squadron (generation 2, spec §6.1):
      // en.wikipedia Leander-class cruiser (1931); naval-history.net
      ...named("cl", 2, [
        "gbr_leander",
        "gbr_achilles",
        "gbr_neptune",
        "gbr_orion",
      ]),
      // C class (Carlisle, Caledon and Ceres groups): en.wikipedia C-class
      // cruiser; Conway's 1906-21
      ...named("cl", 1, [
        "gbr_cairo",
        "gbr_calcutta",
        "gbr_caledon",
        "gbr_calypso",
        "gbr_caradoc",
        "gbr_curacoa",
      ]),
      ...numbered("dd", 1, 36),
      ...numbered("ss", 1, 12),

      // -- Mediterranean Fleet (1st Battle Squadron, 1st and 3rd Cruiser Squadrons) --
      // Queen Elizabeth class (Barham from 8.35, Valiant from 7.35): en.wikipedia
      // Queen Elizabeth-class battleship; naval-history.net
      ...named("bb", 1, ["gbr_queen_elizabeth", "gbr_barham", "gbr_valiant"]),
      // Revenge (to 2.36), Royal Oak (refit to 8.36): en.wikipedia
      // Revenge-class battleship; naval-history.net
      ...named("bb", 1, ["gbr_revenge", "gbr_royal_oak"]),
      // Renown (Mediterranean 9.35-1.36): en.wikipedia HMS Renown (1916); naval-history.net
      ...named("bc", 1, ["gbr_renown"]),
      // Glorious: en.wikipedia Courageous-class battlecruiser; naval-history.net
      ...named("cv", 1, ["gbr_glorious"]),
      // London subgroup of the County class, 1st Cruiser Squadron:
      // en.wikipedia County-class cruiser; Conway's 1922-46
      ...named("ca", 1, [
        "gbr_london",
        "gbr_devonshire",
        "gbr_shropshire",
        "gbr_sussex",
      ]),
      // Arethusa class (generation 2, spec §6.1; Arethusa flagship of the 3rd
      // Cruiser Squadron from 2.35, Galatea flagship of the destroyers):
      // en.wikipedia Arethusa-class cruiser (1934); naval-history.net
      ...named("cl", 2, ["gbr_arethusa", "gbr_galatea"]),
      // D class and the C-class anti-aircraft conversions: en.wikipedia
      // Danae-class cruiser / C-class cruiser; naval-history.net
      ...named("cl", 1, [
        "gbr_delhi",
        "gbr_despatch",
        "gbr_durban",
        "gbr_dauntless",
        "gbr_coventry",
        "gbr_curlew",
      ]),
      ...numbered("dd", 1, 36),
      ...numbered("ss", 1, 10),

      // -- China Station (5th Cruiser Squadron, 4th Submarine Flotilla) --
      // Hermes (China from 11.34): en.wikipedia HMS Hermes (95); naval-history.net
      ...named("cv", 1, ["gbr_hermes"]),
      // Kent subgroup and Dorsetshire (flagship from 8.35): en.wikipedia
      // County-class cruiser; naval-history.net
      ...named("ca", 1, [
        "gbr_kent",
        "gbr_cornwall",
        "gbr_berwick",
        "gbr_dorsetshire",
      ]),
      // Capetown; Dunedin and Diomede (New Zealand Division, the nearest
      // station here): en.wikipedia C-class / Danae-class cruiser; naval-history.net
      ...named("cl", 1, ["gbr_capetown", "gbr_dunedin", "gbr_diomede"]),
      ...numbered("dd", 1, 9),
      ...numbered("ss", 1, 15),

      // -- East Indies Station (4th Cruiser Squadron) --
      // Norfolk (flagship from 3.35): en.wikipedia County-class cruiser; naval-history.net
      ...named("ca", 1, ["gbr_norfolk"]),
      // Emerald (from 1935), Enterprise (from 2.36), Colombo (to 2.36):
      // en.wikipedia Emerald-class / C-class cruiser; naval-history.net
      ...named("cl", 1, ["gbr_emerald", "gbr_enterprise", "gbr_colombo"]),

      // -- America and West Indies Station (8th Cruiser Squadron, South America Division) --
      // York (flagship from 12.32), Exeter (South America from 1.34):
      // en.wikipedia York-class cruiser; naval-history.net
      ...named("ca", 1, ["gbr_york", "gbr_exeter"]),
      // Dragon, Danae (to 1.36): en.wikipedia Danae-class cruiser; naval-history.net
      ...named("cl", 1, ["gbr_dragon", "gbr_danae"]),
      // Ajax (South America from 6.35; generation 2): en.wikipedia
      // Leander-class cruiser (1931); naval-history.net
      ...named("cl", 2, ["gbr_ajax"]),

      // -- Africa Station (6th Cruiser Squadron) --
      // Carlisle, Cardiff: en.wikipedia C-class cruiser; naval-history.net
      ...named("cl", 1, ["gbr_carlisle", "gbr_cardiff"]),

      // -- Reserve Fleet --
      // Warspite and Malaya (rebuilding 1934-37 and 1934-36): en.wikipedia
      // Queen Elizabeth-class battleship; Conway's 1922-46
      ...named("bb", 1, ["gbr_warspite", "gbr_malaya"]),
      // Argus (reserve), Eagle: en.wikipedia HMS Argus (I49) / HMS Eagle (1918);
      // Conway's 1922-46
      ...named("cv", 1, ["gbr_argus", "gbr_eagle"]),
      // Effingham (Hawkins class, reserve 1932-37): en.wikipedia Hawkins-class
      // cruiser; Conway's 1922-46
      ...named("ca", 1, ["gbr_effingham"]),
      // Ceres: en.wikipedia C-class cruiser; Conway's 1906-21
      ...named("cl", 1, ["gbr_ceres"]),
      ...numbered("dd", 1, 29),
      ...numbered("ss", 1, 8),
    ],
    // Lines: the spec §6.2 four plus the cruisers on the slips on 1936-01-01
    // (fact-check round 1); the 20 docks are re-split (spec 5/5/5/5).
    lines: [
      // Ark Royal: laid down 1935-09-16 at Cammell Laird, Birkenhead (Mersey),
      // launched 1937-04-13 — about 12% done. en.wikipedia HMS Ark Royal (91)
      {
        cls: "cv",
        gen: 2,
        count: 1,
        progressPct: 12,
        docks: 4,
        names: ["gbr_ark_royal"],
        port: "Manchester",
      },
      // Amphion class: Apollo (Devonport, commissioned 1936-01-13), Amphion
      // (Portsmouth, commissioned 1936-07-06; waits behind Apollo).
      // en.wikipedia Leander-class cruiser (1931)
      {
        cls: "cl",
        gen: 2,
        count: 2,
        progressPct: 97,
        docks: 1,
        names: ["gbr_apollo", "gbr_amphion"],
        port: "Devon",
      },
      // Arethusa class: Penelope (laid down 1934-05-30 at Harland and Wolff,
      // Belfast, launched 1935-10-15), Aurora (laid down 1935-07-23; waits).
      // en.wikipedia Arethusa-class cruiser (1934)
      {
        cls: "cl",
        gen: 2,
        count: 2,
        progressPct: 80,
        docks: 2,
        names: ["gbr_penelope", "gbr_aurora"],
        port: "Fermanagh",
      },
      // Southampton class: Newcastle (laid down 1934-10-04, Vickers Tyne),
      // Southampton (1934-11-21, John Brown), Sheffield (1935-01-31), Glasgow
      // (1935-04-16, Scotts), Birmingham (1935-07-18, Devonport); the later
      // ones wait. en.wikipedia Town-class cruiser (1936)
      {
        cls: "cl",
        gen: 2,
        count: 5,
        progressPct: 40,
        docks: 4,
        names: [
          "gbr_newcastle",
          "gbr_southampton",
          "gbr_sheffield",
          "gbr_glasgow",
          "gbr_birmingham",
        ],
        port: "Glasgow",
      },
      // Tribal-class destroyers (spec §6.2 line; numbered names): en.wikipedia
      // Tribal-class destroyer (1936)
      {
        cls: "dd",
        gen: 2,
        count: 8,
        progressPct: 20,
        docks: 4,
        names: [],
        port: "North Yorkshire",
      },
      {
        cls: "ss",
        gen: 2,
        count: 4,
        progressPct: 30,
        docks: 5,
        names: [],
        port: "London",
      },
    ],
  },

  // ======== United States (spec §6.1: 15/0/3/15/10/100/55, convoys 650) ========
  // Ranger served with the Pacific fleet from 1935, so the Battle Force has
  // the three carriers and the Atlantic force none (spec §6.4 had 2 + 1).
  // The heavy cruisers were all in the Pacific Scouting Force (Augusta in
  // Asia): the spec's Philadelphia reserve becomes the Scouting Force, and
  // the Atlantic keeps the training battleships, one cruiser, destroyers
  // and submarines (fact-check round 1).
  {
    tag: "USA",
    convoys: 650,
    bases: [
      "Virginia", // Norfolk
      "California", // San Diego, Mare Island
      "Oahu", // Pearl Harbor
      "Washington", // Puget Sound
      "New York",
      // Philadelphia Navy Yard: map v4 has no naval base in Pennsylvania (a
      // lake shore); the Delaware yard's base is New Jersey's (P4 pre-flight).
      "New Jersey", // Philadelphia
      "Philippines", // Manila (Cavite)
      "Massachusetts", // Boston
      "South Carolina", // Charleston
      "Guam",
      "Alaska 5", // Dutch Harbor
      "Midway",
      "Wake",
    ],
    fleets: [
      {
        key: "usa_battle_force",
        base: "California",
        counts: [12, 0, 3, 0, 4, 40, 0],
      },
      {
        key: "usa_scouting_force",
        base: "California",
        counts: [0, 0, 0, 14, 4, 30, 0],
      },
      {
        key: "usa_atlantic_squadron",
        base: "Virginia",
        counts: [3, 0, 0, 0, 1, 17, 20],
      },
      {
        key: "usa_submarine_force",
        base: "Oahu",
        counts: [0, 0, 0, 0, 0, 0, 25],
      },
      {
        key: "usa_asiatic_fleet",
        base: "Philippines",
        counts: [0, 0, 0, 1, 1, 13, 10],
      },
    ],
    ships: [
      // -- Battle Force (Pacific) --
      // Nevada, Pennsylvania, New Mexico, Tennessee and Colorado classes:
      // en.wikipedia Standard-type battleship; Conway's 1906-21
      ...named("bb", 1, [
        "usa_nevada",
        "usa_oklahoma",
        "usa_pennsylvania",
        "usa_arizona",
        "usa_new_mexico",
        "usa_mississippi",
        "usa_idaho",
        "usa_tennessee",
        "usa_california",
        "usa_colorado",
        "usa_maryland",
        "usa_west_virginia",
      ]),
      // Lexington, Saratoga: en.wikipedia Lexington-class aircraft carrier;
      // Conway's 1922-46
      ...named("cv", 1, ["usa_lexington", "usa_saratoga"]),
      // Ranger (commissioned 1934-06-04, Pacific from 1935-04-01; generation 2):
      // en.wikipedia USS Ranger (CV-4); Conway's 1922-46
      ...named("cv", 2, ["usa_ranger"]),
      // Omaha class (destroyer flotilla leaders): en.wikipedia Omaha-class
      // cruiser; Conway's 1922-46
      ...named("cl", 1, [
        "usa_omaha",
        "usa_milwaukee",
        "usa_cincinnati",
        "usa_raleigh",
      ]),
      ...numbered("dd", 1, 40),

      // -- Scouting Force (Pacific since 1932; heavy cruiser divisions) --
      // Pensacola class (Pensacola to the Pacific 1935-01-30): en.wikipedia
      // Pensacola-class cruiser / USS Pensacola (CA-24); Conway's 1922-46
      ...named("ca", 1, ["usa_pensacola", "usa_salt_lake_city"]),
      // Northampton class (Houston in the Scouting Force): en.wikipedia
      // Northampton-class cruiser / USS Houston (CA-30); Conway's 1922-46
      ...named("ca", 1, [
        "usa_northampton",
        "usa_chester",
        "usa_louisville",
        "usa_chicago",
        "usa_houston",
      ]),
      // Portland class: en.wikipedia Portland-class cruiser; Conway's 1922-46
      ...named("ca", 1, ["usa_portland", "usa_indianapolis"]),
      // New Orleans class (generation 2): en.wikipedia New Orleans-class
      // cruiser; Conway's 1922-46
      ...named("ca", 2, [
        "usa_new_orleans",
        "usa_astoria",
        "usa_minneapolis",
        "usa_tuscaloosa",
        "usa_san_francisco",
      ]),
      // Omaha class: en.wikipedia Omaha-class cruiser; Conway's 1922-46
      ...named("cl", 1, [
        "usa_richmond",
        "usa_concord",
        "usa_trenton",
        "usa_detroit",
      ]),
      ...numbered("dd", 1, 30),

      // -- Atlantic (Training Squadron, Norfolk; submarines at New London and
      // Coco Solo) --
      // Arkansas, New York, Texas: en.wikipedia Wyoming-class / New York-class
      // battleship; Conway's 1906-21
      ...named("bb", 1, ["usa_arkansas", "usa_new_york", "usa_texas"]),
      // Memphis: en.wikipedia Omaha-class cruiser; Conway's 1922-46
      ...named("cl", 1, ["usa_memphis"]),
      ...numbered("dd", 1, 17),
      ...numbered("ss", 1, 20),

      // -- Submarine Force (Pearl Harbor) --
      ...numbered("ss", 1, 25),

      // -- Asiatic Fleet (Manila) --
      // Augusta (flagship 1933-40): en.wikipedia USS Augusta (CA-31); Conway's 1922-46
      ...named("ca", 1, ["usa_augusta"]),
      // Marblehead: en.wikipedia Omaha-class cruiser; Conway's 1922-46
      ...named("cl", 1, ["usa_marblehead"]),
      ...numbered("dd", 1, 13),
      ...numbered("ss", 1, 10),
    ],
    // Lines: the spec §6.2 four (the Brooklyn line also holds the three
    // more laid down in 1935) plus Wichita; the 16 docks are re-split
    // (spec 5/5/3/3).
    lines: [
      // Yorktown (laid down 1934-05-21), Enterprise (1934-07-16), Newport News:
      // en.wikipedia Yorktown-class aircraft carrier; Conway's 1922-46
      {
        cls: "cv",
        gen: 2,
        count: 1,
        progressPct: 55,
        docks: 4,
        names: ["usa_yorktown"],
        port: "Virginia",
      },
      {
        cls: "cv",
        gen: 2,
        count: 1,
        progressPct: 45,
        docks: 4,
        names: ["usa_enterprise"],
        port: "Virginia",
      },
      // Brooklyn class: Savannah (laid down 1934-05-31, Camden), Nashville
      // (1935-01-24), Brooklyn (1935-03-12, Brooklyn Navy Yard), Boise
      // (1935-04-01, Newport News), Phoenix (1935-04-25), Philadelphia
      // (1935-05-28, Philadelphia), Honolulu (1935-12-09); the later ones
      // wait. en.wikipedia Brooklyn-class cruiser; Conway's 1922-46
      {
        cls: "cl",
        gen: 2,
        count: 7,
        progressPct: 35,
        docks: 3,
        names: [
          "usa_savannah",
          "usa_nashville",
          "usa_brooklyn",
          "usa_boise",
          "usa_phoenix",
          "usa_philadelphia",
          "usa_honolulu",
        ],
        port: "New Jersey", // Savannah's yard, Camden
      },
      // Quincy (laid down 1933-11-15), Vincennes (1934-01-02), Fore River:
      // en.wikipedia New Orleans-class cruiser; Conway's 1922-46
      {
        cls: "ca",
        gen: 2,
        count: 2,
        progressPct: 70,
        docks: 3,
        names: ["usa_quincy", "usa_vincennes"],
        port: "Massachusetts",
      },
      // Wichita (laid down 1935-10-28, Philadelphia Navy Yard): en.wikipedia
      // USS Wichita (CA-45)
      {
        cls: "ca",
        gen: 2,
        count: 1,
        progressPct: 10,
        docks: 2,
        names: ["usa_wichita"],
        port: "New Jersey", // Philadelphia Navy Yard (map v4's base)
      },
    ],
  },

  // ======== Japan (spec §6.1: 6/4/4/12/21/95/55, convoys 450) ========
  // Of the Mogami class only Mogami (1935-07-28) and Mikuma (1935-08-29)
  // were in commission; Suzuya and Kumano are a naval line. CL 19, not 21:
  // the 1912 cruisers Hirado and Yahagi were reserve and training ships
  // (spec §6.1 leaves reserve out), so the Third Fleet keeps 2 (fact-check
  // round 1).
  // Destroyers: the special type III (Akatsuki class, 4) and the Hatsuharu
  // class (6) are generation 2.
  {
    tag: "JPN",
    convoys: 450,
    bases: [
      "Tokyo", // Yokosuka
      "Hiroshima", // Kure
      "Kumamoto", // Sasebo
      "Ōsaka", // Maizuru
      "Truk",
      "Kwantung", // Lüshun
      // No Japanese base in a Korean or Taiwanese region (controller
      // ruling): Chinhae and Kaohsiung are left out, as in the map's base
      // table; the home ports Kure and Sasebo hold the fleets.
      "Akita", // Ominato
      "Palau",
      "Saipan",
      "Kwajalein",
    ],
    fleets: [
      {
        key: "jpn_first_fleet",
        base: "Hiroshima",
        counts: [6, 2, 2, 0, 6, 24, 0],
      },
      {
        key: "jpn_second_fleet",
        base: "Tokyo",
        counts: [0, 2, 2, 12, 6, 32, 0],
      },
      {
        key: "jpn_submarine_squadron",
        base: "Hiroshima",
        counts: [0, 0, 0, 0, 2, 0, 40],
      },
      {
        key: "jpn_third_fleet",
        base: "Kwantung",
        counts: [0, 0, 0, 0, 2, 15, 0],
      },
      {
        key: "jpn_guard_force",
        base: "Ōsaka",
        counts: [0, 0, 0, 0, 3, 24, 15],
      },
    ],
    ships: [
      // -- First Fleet --
      // Nagato, Ise, Fuso classes: en.wikipedia Nagato-class / Ise-class /
      // Fuso-class battleship; Conway's 1906-21
      ...named("bb", 1, [
        "jpn_nagato",
        "jpn_mutsu",
        "jpn_ise",
        "jpn_hyuga",
        "jpn_fuso",
        "jpn_yamashiro",
      ]),
      // Kongo class: en.wikipedia Kongō-class battlecruiser; Conway's 1906-21
      ...named("bc", 1, ["jpn_haruna", "jpn_kirishima"]),
      // Kaga (rebuilt 1935), Ryujo: en.wikipedia Japanese aircraft carrier
      // Kaga / Ryūjō; Conway's 1922-46
      ...named("cv", 1, ["jpn_kaga", "jpn_ryujo"]),
      // Sendai and Nagara classes (destroyer squadron flagships): en.wikipedia
      // Sendai-class / Nagara-class cruiser; Conway's 1906-21
      ...named("cl", 1, [
        "jpn_sendai",
        "jpn_jintsu",
        "jpn_naka",
        "jpn_nagara",
        "jpn_isuzu",
        "jpn_natori",
      ]),
      ...numbered("dd", 2, 10),
      ...numbered("dd", 1, 14),

      // -- Second Fleet --
      // Kongo class: en.wikipedia Kongō-class battlecruiser; Conway's 1906-21
      ...named("bc", 1, ["jpn_kongo", "jpn_hiei"]),
      // Akagi, Hosho: en.wikipedia Japanese aircraft carrier Akagi / Hōshō;
      // Conway's 1922-46
      ...named("cv", 1, ["jpn_akagi", "jpn_hosho"]),
      // Takao, Myoko, Aoba and Furutaka classes: en.wikipedia Takao-class /
      // Myōkō-class / Aoba-class / Furutaka-class cruiser; Conway's 1922-46
      ...named("ca", 1, [
        "jpn_takao",
        "jpn_atago",
        "jpn_maya",
        "jpn_chokai",
        "jpn_myoko",
        "jpn_nachi",
        "jpn_haguro",
        "jpn_ashigara",
        "jpn_aoba",
        "jpn_kinugasa",
        "jpn_furutaka",
        "jpn_kako",
      ]),
      // Mogami class (generation 2): en.wikipedia Mogami-class cruiser; Conway's 1922-46
      ...named("cl", 2, ["jpn_mogami", "jpn_mikuma"]),
      // Yubari; Nagara class: en.wikipedia Japanese cruiser Yūbari /
      // Nagara-class cruiser; Conway's 1922-46
      ...named("cl", 1, ["jpn_yubari", "jpn_abukuma", "jpn_yura", "jpn_kinu"]),
      ...numbered("dd", 1, 32),

      // -- Submarine squadrons --
      // Kuma class (submarine squadron flagships): en.wikipedia Kuma-class
      // cruiser; Conway's 1906-21
      ...named("cl", 1, ["jpn_kitakami", "jpn_oi"]),
      ...numbered("ss", 1, 40),

      // -- Third Fleet (China waters) --
      // Tenryu class: en.wikipedia Tenryū-class cruiser; Conway's 1906-21
      ...named("cl", 1, ["jpn_tenryu", "jpn_tatsuta"]),
      ...numbered("dd", 1, 15),

      // -- Guard force --
      // Kuma class: en.wikipedia Kuma-class cruiser; Conway's 1906-21
      ...named("cl", 1, ["jpn_kuma", "jpn_tama", "jpn_kiso"]),
      ...numbered("dd", 1, 24),
      ...numbered("ss", 1, 15),
    ],
    lines: [
      // Soryu (laid down 1934-11-20, Kure, launched 1935-12-23, commissioned
      // 1937-12): about 65%. Hiryu (laid down 1936-07-08) was not yet on the
      // slips and comes from the name list. en.wikipedia Japanese aircraft
      // carrier Sōryū / Hiryū
      {
        cls: "cv",
        gen: 2,
        count: 1,
        progressPct: 65,
        docks: 4,
        names: ["jpn_soryu"],
        port: "Hiroshima",
      },
      // Mogami class: Suzuya (laid down 1933-12-11, Yokosuka, launched
      // 1934-11-20, rebuilt after 1935; commissioned 1937-10-31), Kumano
      // (1934-04-05, Kawasaki Kobe, launched 1936-10-15; waits).
      // en.wikipedia Mogami-class cruiser
      {
        cls: "cl",
        gen: 2,
        count: 2,
        progressPct: 75,
        docks: 2,
        names: ["jpn_suzuya", "jpn_kumano"],
        port: "Tokyo",
      },
      // Tone class: Tone (laid down 1934-12-01), Chikuma (1935-10-01; waits),
      // Mitsubishi Nagasaki; commissioned 1938-11 and 1939-05. en.wikipedia
      // Tone-class cruiser
      {
        cls: "ca",
        gen: 2,
        count: 2,
        progressPct: 25,
        docks: 2,
        names: ["jpn_tone", "jpn_chikuma"],
        port: "Kumamoto",
      },
      // Shiratsuyu-class destroyers (laid down 1933-35): en.wikipedia
      // Shiratsuyu-class destroyer
      {
        cls: "dd",
        gen: 2,
        count: 4,
        progressPct: 50,
        docks: 3,
        names: [],
        port: "Kumamoto",
      },
      {
        cls: "ss",
        gen: 2,
        count: 2,
        progressPct: 30,
        docks: 3,
        names: [],
        port: "Hiroshima",
      },
    ],
  },

  // ======== France (spec §6.1: 5/0/1/7/6/60/70, convoys 250) ========
  // Generation 2: Algérie, Émile Bertin, La Galissonnière (commissioned
  // 1936-01-01) and the 24 contre-torpilleurs of the Jaguar, Guépard, Aigle
  // and Vauquelin classes.
  {
    tag: "FRA",
    convoys: 250,
    bases: [
      "Alpes-Maritimes", // Toulon
      "Finistère", // Brest, Lorient
      "Orne", // Cherbourg
      "Tunis", // Bizerte
      "El Bayadh", // Mers-el-Kébir
      "Dakar",
      "Grand Casablanca",
      "Saigon",
      "Aleppo", // Beirut
    ],
    fleets: [
      {
        key: "fra_mediterranean_squadron",
        base: "Alpes-Maritimes",
        counts: [3, 0, 0, 6, 4, 36, 35],
      },
      {
        key: "fra_atlantic_squadron",
        base: "Finistère",
        counts: [2, 0, 1, 1, 1, 18, 25],
      },
      {
        key: "fra_far_east_division",
        base: "Saigon",
        counts: [0, 0, 0, 0, 1, 0, 0],
      },
      {
        key: "fra_north_africa_forces",
        base: "Tunis",
        counts: [0, 0, 0, 0, 0, 6, 10],
      },
    ],
    ships: [
      // -- Mediterranean Squadron (Toulon) --
      // Bretagne class: en.wikipedia Bretagne-class battleship; Conway's 1922-46
      ...named("bb", 1, ["fra_bretagne", "fra_provence", "fra_lorraine"]),
      // Algérie (generation 2): en.wikipedia French cruiser Algérie; Conway's 1922-46
      ...named("ca", 2, ["fra_algerie"]),
      // Suffren and Duquesne classes: en.wikipedia Suffren-class / Duquesne-class
      // cruiser; Conway's 1922-46
      ...named("ca", 1, [
        "fra_foch",
        "fra_dupleix",
        "fra_colbert",
        "fra_suffren",
        "fra_tourville",
      ]),
      // Émile Bertin, La Galissonnière (generation 2): en.wikipedia French
      // cruiser Émile Bertin / La Galissonnière-class cruiser; Conway's 1922-46
      ...named("cl", 2, ["fra_emile_bertin", "fra_la_galissonniere"]),
      // Duguay-Trouin class: en.wikipedia Duguay-Trouin-class cruiser; Conway's 1922-46
      ...named("cl", 1, ["fra_duguay_trouin", "fra_primauguet"]),
      // Contre-torpilleurs (generation 2): en.wikipedia Jaguar-, Guépard-,
      // Aigle- and Vauquelin-class destroyer
      ...numbered("dd", 2, 24),
      ...numbered("dd", 1, 12),
      ...numbered("ss", 1, 35),

      // -- Atlantic Squadron (Brest) --
      // Courbet class: en.wikipedia Courbet-class battleship (1911); Conway's 1922-46
      ...named("bb", 1, ["fra_courbet", "fra_paris"]),
      // Béarn: en.wikipedia French aircraft carrier Béarn; Conway's 1922-46
      ...named("cv", 1, ["fra_bearn"]),
      // Duquesne: en.wikipedia Duquesne-class cruiser; Conway's 1922-46
      ...named("ca", 1, ["fra_duquesne"]),
      // Jeanne d'Arc (training cruiser, 1931): en.wikipedia French cruiser
      // Jeanne d'Arc (1930); Conway's 1922-46
      ...named("cl", 1, ["fra_jeanne_darc"]),
      ...numbered("dd", 1, 18),
      ...numbered("ss", 1, 25),

      // -- Far East (Saigon) --
      // Lamotte-Picquet: en.wikipedia Duguay-Trouin-class cruiser; Conway's 1922-46
      ...named("cl", 1, ["fra_lamotte_picquet"]),

      // -- North Africa (Bizerte) --
      ...numbered("dd", 1, 6),
      ...numbered("ss", 1, 10),
    ],
    lines: [
      // Dunkerque (laid down 1932-12-24, Brest), Strasbourg (1934-11-25,
      // Penhoët, Saint-Nazaire — the map's Côtes-d'Armor region holds the
      // Loire estuary): en.wikipedia Dunkerque-class battleship; Conway's 1922-46
      {
        cls: "bc",
        gen: 2,
        count: 1,
        progressPct: 85,
        docks: 2,
        names: ["fra_dunkerque"],
        port: "Finistère",
      },
      {
        cls: "bc",
        gen: 2,
        count: 1,
        progressPct: 40,
        docks: 2,
        names: ["fra_strasbourg"],
        port: "Côtes-d'Armor",
      },
      // Richelieu (ordered 1935, laid down 1935-10-22, Brest): en.wikipedia
      // Richelieu-class battleship; Conway's 1922-46
      {
        cls: "bb",
        gen: 2,
        count: 1,
        progressPct: 10,
        docks: 2,
        names: ["fra_richelieu"],
        port: "Finistère",
      },
      // La Galissonnière class, one line per yard (all launched 1935-36,
      // commissioned 1937): Jean de Vienne (Arsenal de Lorient, laid down
      // 1931-12-20, launched 1935-07-31); Marseillaise (Chantiers de la Loire,
      // Nantes, 1933-10-23) and Georges Leygues (Penhoët, Saint-Nazaire,
      // 1933-09-21; waits); Gloire (Forges et Chantiers de la Gironde,
      // Lormont, 1933-11-13); Montcalm (Forges et Chantiers de la
      // Méditerranée, La Seyne, 1933-11-15). en.wikipedia La
      // Galissonnière-class cruiser
      {
        cls: "cl",
        gen: 2,
        count: 1,
        progressPct: 70,
        docks: 1,
        names: ["fra_jean_de_vienne"],
        port: "Finistère",
      },
      {
        cls: "cl",
        gen: 2,
        count: 2,
        progressPct: 65,
        docks: 1,
        names: ["fra_marseillaise", "fra_georges_leygues"],
        port: "Côtes-d'Armor",
      },
      {
        cls: "cl",
        gen: 2,
        count: 1,
        progressPct: 65,
        docks: 1,
        names: ["fra_gloire"],
        port: "Gironde",
      },
      {
        cls: "cl",
        gen: 2,
        count: 1,
        progressPct: 65,
        docks: 1,
        names: ["fra_montcalm"],
        port: "Alpes-Maritimes",
      },
    ],
  },

  // ======== Italy (spec §6.1: 4/0/0/7/12/50/70, convoys 200) ========
  // Generation 2: the Montecuccoli class and Duca d'Aosta (1935-07-13, the
  // same year and type; spec §6.1 named only the Montecuccoli pair).
  {
    tag: "ITA",
    convoys: 200,
    bases: [
      "Bari", // Taranto, Brindisi
      "Modena", // La Spezia
      "Napoli",
      "Udine", // Pola
      "Palermo", // Messina
      "Tripolitania", // Tripoli
      "Ajdabiya", // Tobruk
      "Eritrea", // Massawa
      "Leros",
      "Rhodes",
    ],
    fleets: [
      {
        key: "ita_first_squadron",
        base: "Modena",
        counts: [2, 0, 0, 4, 6, 20, 25],
      },
      {
        key: "ita_second_squadron",
        base: "Bari",
        counts: [2, 0, 0, 3, 4, 20, 25],
      },
      {
        key: "ita_red_sea_command",
        base: "Eritrea",
        counts: [0, 0, 0, 0, 0, 4, 8],
      },
      {
        key: "ita_aegean_command",
        base: "Leros",
        counts: [0, 0, 0, 0, 0, 6, 12],
      },
      {
        key: "ita_libya_command",
        base: "Ajdabiya",
        counts: [0, 0, 0, 0, 2, 0, 0],
      },
    ],
    ships: [
      // -- 1st Squadron (La Spezia) --
      // Conte di Cavour class (rebuilding 1933-37, counted ready, spec §6.1):
      // en.wikipedia Conte di Cavour-class battleship; Conway's 1922-46
      ...named("bb", 1, ["ita_conte_di_cavour", "ita_giulio_cesare"]),
      // Zara class: en.wikipedia Zara-class cruiser; Conway's 1922-46
      ...named("ca", 1, ["ita_zara", "ita_fiume", "ita_gorizia", "ita_pola"]),
      // Montecuccoli class and Duca d'Aosta (generation 2): en.wikipedia
      // Raimondo Montecuccoli-class / Duca d'Aosta-class cruiser; Conway's 1922-46
      ...named("cl", 2, [
        "ita_montecuccoli",
        "ita_attendolo",
        "ita_duca_d_aosta",
      ]),
      // Giussano class: en.wikipedia Alberto di Giussano-class cruiser; Conway's 1922-46
      ...named("cl", 1, [
        "ita_alberto_di_giussano",
        "ita_alberico_da_barbiano",
        "ita_bartolomeo_colleoni",
      ]),
      ...numbered("dd", 1, 20),
      ...numbered("ss", 1, 25),

      // -- 2nd Squadron (Taranto) --
      // Andrea Doria class: en.wikipedia Andrea Doria-class battleship; Conway's 1922-46
      ...named("bb", 1, ["ita_caio_duilio", "ita_andrea_doria"]),
      // Trento class, Bolzano: en.wikipedia Trento-class cruiser / Italian
      // cruiser Bolzano; Conway's 1922-46
      ...named("ca", 1, ["ita_trento", "ita_trieste", "ita_bolzano"]),
      // Bande Nere, Cadorna class; Quarto: en.wikipedia Alberto di Giussano-class /
      // Luigi Cadorna-class cruiser / Italian cruiser Quarto; Conway's 1922-46
      ...named("cl", 1, [
        "ita_giovanni_delle_bande_nere",
        "ita_luigi_cadorna",
        "ita_armando_diaz",
        "ita_quarto",
      ]),
      ...numbered("dd", 1, 20),
      ...numbered("ss", 1, 25),

      // -- Red Sea (Massawa) and Aegean (Leros) --
      ...numbered("dd", 1, 4),
      ...numbered("ss", 1, 8),
      ...numbered("dd", 1, 6),
      ...numbered("ss", 1, 12),

      // -- Libya (Tobruk) --
      // Bari, Taranto (ex-German cruisers, colonial service): en.wikipedia
      // Italian cruiser Bari / Taranto; Conway's 1922-46
      ...named("cl", 1, ["ita_bari", "ita_taranto"]),
    ],
    lines: [
      // Littorio (laid down 1934-10-28, Genoa), Vittorio Veneto (1934-10-28,
      // Trieste): en.wikipedia Littorio-class battleship; Conway's 1922-46.
      // The 9 docks are re-split for the two cruisers added below (spec 4/4/1).
      {
        cls: "bb",
        gen: 2,
        count: 1,
        progressPct: 30,
        docks: 3,
        names: ["ita_littorio"],
        port: "Modena",
      },
      {
        cls: "bb",
        gen: 2,
        count: 1,
        progressPct: 30,
        docks: 3,
        names: ["ita_vittorio_veneto"],
        port: "Udine",
      },
      // Luigi di Savoia Duca degli Abruzzi (laid down 1933-12-28, OTO
      // Muggiano, La Spezia) and her sister Giuseppe Garibaldi (same day,
      // CRDA Trieste): en.wikipedia Duca degli Abruzzi-class cruiser
      {
        cls: "cl",
        gen: 2,
        count: 1,
        progressPct: 60,
        docks: 1,
        names: ["ita_duca_degli_abruzzi"],
        port: "Modena",
      },
      {
        cls: "cl",
        gen: 2,
        count: 1,
        progressPct: 60,
        docks: 1,
        names: ["ita_giuseppe_garibaldi"],
        port: "Udine",
      },
      // Eugenio di Savoia (Ansaldo, Genoa; laid down 1933-07-06, launched
      // 1935-03-16, commissioned 1936-01-16): en.wikipedia Italian cruiser
      // Eugenio di Savoia
      {
        cls: "cl",
        gen: 2,
        count: 1,
        progressPct: 97,
        docks: 1,
        names: ["ita_eugenio_di_savoia"],
        port: "Modena",
      },
    ],
  },

  // ======== Germany (spec §6.1: 2/0/0/3/6/12/18, convoys 120) ========
  // Generation 2: the three Deutschland-class ships (Admiral Graf Spee
  // commissioned 1936-01-06) and every U-boat. SS 17, not 18 (uboat.net).
  {
    tag: "DEU",
    convoys: 120,
    bases: [
      "Hamburg", // Kiel, Hamburg
      "Niedersachsen", // Wilhelmshaven
      "Pomerania", // Swinemünde
      "East Prussia", // Pillau
      "Heligoland",
    ],
    fleets: [
      { key: "deu_fleet", base: "Hamburg", counts: [2, 0, 0, 3, 4, 12, 0] },
      {
        key: "deu_uboat_flotilla",
        base: "Niedersachsen",
        counts: [0, 0, 0, 0, 2, 0, 17],
      },
    ],
    ships: [
      // -- Fleet (Kiel) --
      // Deutschland-class pre-dreadnoughts: en.wikipedia Deutschland-class
      // battleship (1904); Conway's 1922-46
      ...named("bb", 1, ["deu_schlesien", "deu_schleswig_holstein"]),
      // Deutschland class (generation 2): en.wikipedia Deutschland-class
      // cruiser; Conway's 1922-46
      ...named("ca", 2, [
        "deu_deutschland",
        "deu_admiral_scheer",
        "deu_admiral_graf_spee",
      ]),
      // Königsberg class, Leipzig class: en.wikipedia Königsberg-class /
      // Leipzig-class cruiser; Conway's 1922-46
      ...named("cl", 1, [
        "deu_koenigsberg",
        "deu_koeln",
        "deu_leipzig",
        "deu_nuernberg",
      ]),
      // Raubvogel and Raubtier torpedo boats: en.wikipedia Type 23 / Type 24
      // torpedo boat
      ...numbered("dd", 1, 12),

      // -- U-boat flotilla (Wilhelmshaven) --
      // Emden, Karlsruhe (training cruisers): en.wikipedia German cruiser
      // Emden / Königsberg-class cruiser; Conway's 1922-46
      ...named("cl", 1, ["deu_emden", "deu_karlsruhe"]),
      // Type IIA and IIB U-boats in commission on 1936-01-01: U-1..U-14 and
      // U-17..U-19 = 17 (generation 2): en.wikipedia Type II submarine;
      // uboat.net U-13, U-15, U-17, U-20
      ...numbered("ss", 2, 17),
    ],
    lines: [
      // Scharnhorst (laid down 1935-06-15, Wilhelmshaven, launched 1936-10-03),
      // Gneisenau (1935-05-06, Kiel, launched 1936-12-08): about a quarter
      // done. en.wikipedia Scharnhorst-class battleship; Conway's 1922-46
      {
        cls: "bc",
        gen: 2,
        count: 1,
        progressPct: 25,
        docks: 3,
        names: ["deu_scharnhorst"],
        port: "Niedersachsen",
      },
      {
        cls: "bc",
        gen: 2,
        count: 1,
        progressPct: 30,
        docks: 3,
        names: ["deu_gneisenau"],
        port: "Hamburg",
      },
      // Admiral Hipper (laid down 1935-07-06, Hamburg): en.wikipedia
      // Admiral Hipper-class cruiser; Conway's 1922-46
      {
        cls: "ca",
        gen: 2,
        count: 1,
        progressPct: 15,
        docks: 2,
        names: ["deu_admiral_hipper"],
        port: "Hamburg",
      },
    ],
  },

  // ======== Soviet Union (spec §6.1: 3/0/0/0/3/18/60, convoys 80) ========
  // Profintern went to the Black Sea in 1930 with Parizhskaya Kommuna, so
  // the three cruisers are all in the Black Sea Fleet (spec §6.4 had 1 + 2).
  {
    tag: "SUN",
    convoys: 80,
    bases: [
      "Leningrad", // Kronstadt
      "Crimea", // Sevastopol
      "Primor'ye", // Vladivostok
      "Murmansk 2",
      "Odessa",
      "Krasnodar", // Novorossiysk
      "Arkhangel'sk 9",
    ],
    fleets: [
      {
        key: "sun_baltic_fleet",
        base: "Leningrad",
        counts: [2, 0, 0, 0, 0, 9, 25],
      },
      {
        key: "sun_black_sea_fleet",
        base: "Crimea",
        counts: [1, 0, 0, 0, 3, 5, 15],
      },
      {
        key: "sun_pacific_fleet",
        base: "Primor'ye",
        counts: [0, 0, 0, 0, 0, 2, 15],
      },
      {
        key: "sun_northern_flotilla",
        base: "Murmansk 2",
        counts: [0, 0, 0, 0, 0, 2, 5],
      },
    ],
    ships: [
      // -- Baltic Fleet --
      // Gangut class: en.wikipedia Gangut-class battleship; Conway's 1922-46
      ...named("bb", 1, ["sun_marat", "sun_oktyabrskaya_revolyutsiya"]),
      ...numbered("dd", 1, 9),
      // Half the submarines are generation 2 (spec §6.1): the Shchuka and
      // Malyutka series of 1933-35. en.wikipedia Shchuka-class submarine
      ...numbered("ss", 2, 12),
      ...numbered("ss", 1, 13),

      // -- Black Sea Fleet --
      // Parizhskaya Kommuna: en.wikipedia Gangut-class battleship; Conway's 1922-46
      ...named("bb", 1, ["sun_parizhskaya_kommuna"]),
      // Krasny Kavkaz, Chervona Ukraina, Profintern: en.wikipedia Admiral
      // Nakhimov-class / Svetlana-class cruiser; Conway's 1922-46
      ...named("cl", 1, [
        "sun_krasny_kavkaz",
        "sun_chervona_ukraina",
        "sun_profintern",
      ]),
      ...numbered("dd", 1, 5),
      ...numbered("ss", 2, 8),
      ...numbered("ss", 1, 7),

      // -- Pacific Fleet --
      ...numbered("dd", 1, 2),
      ...numbered("ss", 2, 8),
      ...numbered("ss", 1, 7),

      // -- Northern Flotilla --
      ...numbered("dd", 1, 2),
      ...numbered("ss", 2, 2),
      ...numbered("ss", 1, 3),
    ],
    lines: [
      // Kirov (laid down 1935-10-22, Ordzhonikidze Yard, Leningrad; launched
      // 1936-11-30, commissioned 1938-09-26) and Voroshilov (1935-10-15, Marti
      // South, Nikolayev; commissioned 1940-06-20): about 12% and 10%. The 8
      // docks are re-split (spec 3/2/3). en.wikipedia Kirov-class cruiser
      {
        cls: "ca",
        gen: 2,
        count: 1,
        progressPct: 12,
        docks: 2,
        names: ["sun_kirov"],
        port: "Leningrad",
      },
      {
        cls: "ca",
        gen: 2,
        count: 1,
        progressPct: 10,
        docks: 2,
        names: ["sun_voroshilov"],
        port: "Mykolayiv",
      },
      // Gnevny-class destroyers (Project 7, first laid down 1935): en.wikipedia
      // Gnevny-class destroyer
      {
        cls: "dd",
        gen: 2,
        count: 4,
        progressPct: 20,
        docks: 2,
        names: [],
        port: "Leningrad",
      },
      {
        cls: "ss",
        gen: 2,
        count: 6,
        progressPct: 40,
        docks: 2,
        names: [],
        port: "Mykolayiv",
      },
    ],
  },

  // ======== Minor navies (spec §6.3; generation 1 unless noted) ========
  {
    tag: "NLD",
    convoys: 150,
    bases: ["Batavia", "Noord-Holland"], // Surabaya (fleet), Den Helder
    fleets: [
      {
        key: "nld_east_indies_squadron",
        base: "Batavia",
        counts: [0, 0, 0, 0, 2, 8, 16],
      },
    ],
    ships: [
      // Java class: en.wikipedia Java-class cruiser; Conway's 1922-46
      ...named("cl", 1, ["nld_java", "nld_sumatra"]),
      ...numbered("dd", 1, 8),
      ...numbered("ss", 1, 16),
    ],
    lines: [
      // De Ruyter (laid down 1933-09-16, Wilton-Fijenoord, Schiedam):
      // en.wikipedia HNLMS De Ruyter (1935); Conway's 1922-46
      {
        cls: "cl",
        gen: 2,
        count: 1,
        progressPct: 60,
        docks: 3,
        names: ["nld_de_ruyter"],
        port: "Noord-Holland",
      },
    ],
  },
  {
    tag: "ESR",
    convoys: 60,
    bases: ["Murcia"], // Cartagena
    fleets: [
      {
        key: "esr_republican_fleet",
        base: "Murcia",
        counts: [1, 0, 0, 0, 3, 13, 12],
      },
    ],
    ships: [
      // Jaime I: en.wikipedia España-class battleship; Conway's 1922-46
      ...named("bb", 1, ["esr_jaime_i"]),
      // Libertad, Miguel de Cervantes (Almirante Cervera class), Méndez Núñez:
      // en.wikipedia Almirante Cervera-class / Blas de Lezo-class cruiser; Conway's 1922-46
      ...named("cl", 1, [
        "esr_libertad",
        "esr_miguel_de_cervantes",
        "esr_mendez_nunez",
      ]),
      ...numbered("dd", 1, 13),
      ...numbered("ss", 1, 12),
    ],
    lines: [],
  },
  {
    tag: "ESN",
    convoys: 40,
    bases: ["La Coruña"], // Ferrol
    fleets: [
      {
        key: "esn_nationalist_fleet",
        base: "La Coruña",
        counts: [1, 0, 0, 0, 2, 1, 0],
      },
    ],
    ships: [
      // España (ex-Alfonso XIII): en.wikipedia España-class battleship; Conway's 1922-46
      ...named("bb", 1, ["esn_espana"]),
      // Almirante Cervera; República (ex-Reina Victoria Eugenia; refitting at
      // Cádiz in 1936, kept for the spec §6.3 count): en.wikipedia
      // Almirante Cervera-class cruiser / Spanish cruiser Reina Victoria Eugenia;
      // Conway's 1922-46
      ...named("cl", 1, ["esn_almirante_cervera", "esn_republica"]),
      ...numbered("dd", 1, 1),
    ],
    lines: [
      // Canarias, Baleares (laid down 1928, Ferrol; launched 1931 and 1932,
      // commissioned 1936): en.wikipedia Canarias-class cruiser; Conway's 1922-46
      {
        cls: "ca",
        gen: 2,
        count: 1,
        progressPct: 80,
        docks: 1,
        names: ["esn_canarias"],
        port: "La Coruña",
      },
      {
        cls: "ca",
        gen: 2,
        count: 1,
        progressPct: 75,
        docks: 1,
        names: ["esn_baleares"],
        port: "La Coruña",
      },
    ],
  },
  {
    tag: "AUS",
    convoys: 60,
    bases: ["New South Wales"], // Sydney
    fleets: [
      {
        key: "aus_australian_squadron",
        base: "New South Wales",
        counts: [0, 0, 0, 2, 2, 5, 0],
      },
    ],
    ships: [
      // Australia, Canberra (County class): en.wikipedia County-class cruiser; Conway's 1922-46
      ...named("ca", 1, ["aus_australia", "aus_canberra"]),
      // Sydney (ex-Phaeton, 1935; modified Leander, generation 2 like the
      // British Leanders), Adelaide: en.wikipedia HMAS Sydney (D48) /
      // HMAS Adelaide (1918); Conway's 1922-46
      ...named("cl", 2, ["aus_sydney"]),
      ...named("cl", 1, ["aus_adelaide"]),
      ...numbered("dd", 1, 5),
    ],
    lines: [],
  },
  {
    tag: "CAN",
    convoys: 50,
    bases: ["Nova Scotia"], // Halifax
    fleets: [
      {
        key: "can_canadian_navy",
        base: "Nova Scotia",
        counts: [0, 0, 0, 0, 0, 4, 0],
      },
    ],
    ships: [...numbered("dd", 1, 4)],
    lines: [],
  },
  {
    tag: "TUR",
    convoys: 30,
    bases: ["Istanbul"],
    fleets: [
      {
        key: "tur_turkish_fleet",
        base: "Istanbul",
        counts: [0, 1, 0, 0, 0, 4, 5],
      },
    ],
    ships: [
      // Yavuz (ex-Goeben): en.wikipedia SMS Goeben; Conway's 1922-46
      ...named("bc", 1, ["tur_yavuz"]),
      ...numbered("dd", 1, 4),
      ...numbered("ss", 1, 5),
    ],
    lines: [],
  },
  {
    tag: "GRC",
    convoys: 80,
    bases: ["Attiki"], // Salamis
    fleets: [
      {
        key: "grc_hellenic_fleet",
        base: "Attiki",
        counts: [0, 0, 0, 1, 0, 10, 6],
      },
    ],
    ships: [
      // Georgios Averof (armoured cruiser = heavy cruiser 1): en.wikipedia
      // Greek cruiser Georgios Averof; Conway's 1922-46
      ...named("ca", 1, ["grc_georgios_averof"]),
      ...numbered("dd", 1, 10),
      ...numbered("ss", 1, 6),
    ],
    lines: [],
  },
  {
    tag: "SWE",
    convoys: 60,
    bases: ["Kronoberg"], // Karlskrona
    fleets: [
      {
        key: "swe_coastal_fleet",
        base: "Kronoberg",
        counts: [0, 0, 0, 3, 1, 10, 12],
      },
    ],
    ships: [
      // Sverige class (coastal defence ships): en.wikipedia Sverige-class
      // coastal defence ship; Conway's 1922-46
      ...named("ca", 1, [
        "swe_sverige",
        "swe_gustaf_v",
        "swe_drottning_victoria",
      ]),
      // Gotland (1934, generation 2 per spec §6.3): en.wikipedia HSwMS Gotland
      // (1933); Conway's 1922-46
      ...named("cl", 2, ["swe_gotland"]),
      ...numbered("dd", 1, 10),
      ...numbered("ss", 1, 12),
    ],
    lines: [],
  },
  {
    tag: "NOR",
    convoys: 200,
    bases: ["Oslo", "Hordaland"], // Horten (Oslo region), Bergen
    fleets: [
      {
        key: "nor_norwegian_navy",
        base: "Oslo",
        counts: [0, 0, 0, 2, 0, 7, 9],
      },
    ],
    ships: [
      // Norge class (coastal defence ships): en.wikipedia Norge-class coastal
      // defence ship; Conway's 1922-46
      ...named("ca", 1, ["nor_norge", "nor_eidsvold"]),
      ...numbered("dd", 1, 7),
      ...numbered("ss", 1, 9),
    ],
    lines: [],
  },
  {
    tag: "DNK",
    convoys: 40,
    bases: ["Hovedstaden"], // Copenhagen
    fleets: [
      {
        key: "dnk_danish_navy",
        base: "Hovedstaden",
        counts: [0, 0, 0, 1, 0, 6, 6],
      },
    ],
    ships: [
      // Niels Juel (Peder Skram was laid up 1935-39): en.wikipedia HDMS Niels
      // Juel / HDMS Peder Skram (1908); Conway's 1922-46
      ...named("ca", 1, ["dnk_niels_juel"]),
      ...numbered("dd", 1, 6),
      ...numbered("ss", 1, 6),
    ],
    lines: [],
  },
  {
    tag: "FIN",
    convoys: 20,
    bases: ["Uusimaa"], // Helsinki
    fleets: [
      {
        key: "fin_finnish_navy",
        base: "Uusimaa",
        counts: [0, 0, 0, 2, 0, 0, 5],
      },
    ],
    ships: [
      // Väinämöinen class (coastal defence ships): en.wikipedia Väinämöinen-class
      // coastal defence ship; Conway's 1922-46
      ...named("ca", 1, ["fin_vainamoinen", "fin_ilmarinen"]),
      ...numbered("ss", 1, 5),
    ],
    lines: [],
  },
  {
    tag: "POL",
    convoys: 10,
    bases: ["Pomeranian"], // Gdynia
    fleets: [
      {
        key: "pol_polish_navy",
        base: "Pomeranian",
        counts: [0, 0, 0, 0, 0, 2, 3],
      },
    ],
    // Wicher and Burza only: Grom and Błyskawica entered service in 1937
    // (en.wikipedia Grom-class destroyer).
    ships: [...numbered("dd", 1, 2), ...numbered("ss", 1, 3)],
    lines: [],
  },
  {
    tag: "ROU",
    convoys: 10,
    bases: ["Tulcea"], // Constanța
    fleets: [
      {
        key: "rou_romanian_navy",
        base: "Tulcea",
        counts: [0, 0, 0, 0, 0, 4, 1],
      },
    ],
    ships: [...numbered("dd", 1, 4), ...numbered("ss", 1, 1)],
    lines: [],
  },
  {
    tag: "YUG",
    convoys: 10,
    bases: ["Podgorica"], // Kotor
    fleets: [
      {
        key: "yug_yugoslav_navy",
        base: "Podgorica",
        counts: [0, 0, 0, 0, 1, 4, 4],
      },
    ],
    ships: [
      // Dalmacija (ex-Niobe): en.wikipedia SMS Niobe (1899); Conway's 1922-46
      ...named("cl", 1, ["yug_dalmacija"]),
      ...numbered("dd", 1, 4),
      ...numbered("ss", 1, 4),
    ],
    lines: [],
  },
  {
    tag: "PRT",
    convoys: 30,
    bases: ["Lisboa"],
    fleets: [
      {
        key: "prt_portuguese_navy",
        base: "Lisboa",
        counts: [0, 0, 0, 0, 0, 5, 3],
      },
    ],
    ships: [...numbered("dd", 1, 5), ...numbered("ss", 1, 3)],
    lines: [],
  },
  {
    tag: "ARG",
    convoys: 30,
    bases: ["Ciudad de Buenos Aires"], // Puerto Belgrano
    fleets: [
      {
        key: "arg_sea_fleet",
        base: "Ciudad de Buenos Aires",
        counts: [2, 0, 0, 2, 0, 8, 3],
      },
    ],
    ships: [
      // Rivadavia class: en.wikipedia Rivadavia-class battleship; Conway's 1922-46
      ...named("bb", 1, ["arg_rivadavia", "arg_moreno"]),
      // Veinticinco de Mayo class: en.wikipedia Veinticinco de Mayo-class
      // cruiser; Conway's 1922-46
      ...named("ca", 1, ["arg_almirante_brown", "arg_veinticinco_de_mayo"]),
      ...numbered("dd", 1, 8),
      ...numbered("ss", 1, 3),
    ],
    lines: [],
  },
  {
    tag: "BRA",
    convoys: 30,
    bases: ["Rio de Janeiro"],
    fleets: [
      {
        key: "bra_brazilian_fleet",
        base: "Rio de Janeiro",
        counts: [2, 0, 0, 0, 2, 1, 3],
      },
    ],
    ships: [
      // Minas Geraes class: en.wikipedia Minas Geraes-class battleship; Conway's 1922-46
      ...named("bb", 1, ["bra_minas_geraes", "bra_sao_paulo"]),
      // Bahia class: en.wikipedia Bahia-class cruiser; Conway's 1922-46
      ...named("cl", 1, ["bra_bahia", "bra_rio_grande_do_sul"]),
      ...numbered("dd", 1, 1),
      ...numbered("ss", 1, 3),
    ],
    lines: [],
  },
  {
    tag: "CHL",
    convoys: 20,
    bases: ["Bío-Bío"], // Talcahuano
    fleets: [
      {
        key: "chl_chilean_squadron",
        base: "Bío-Bío",
        counts: [1, 0, 0, 0, 0, 6, 9],
      },
    ],
    ships: [
      // Almirante Latorre: en.wikipedia Chilean battleship Almirante Latorre;
      // Conway's 1922-46
      ...named("bb", 1, ["chl_almirante_latorre"]),
      // The armoured cruiser O'Higgins (spec §6.3 CA 1) was decommissioned in
      // 1933 (en.wikipedia Chilean cruiser O'Higgins (1897)), so Chile has none.
      ...numbered("dd", 1, 6),
      ...numbered("ss", 1, 9),
    ],
    lines: [],
  },
  {
    // Siam had no submarines until the Matchanu class (delivered 1937-38),
    // so its four are left out (spec §6.3 had 4).
    tag: "THA",
    convoys: 10,
    bases: ["Sa Kaeo"], // Sattahip
    fleets: [
      {
        key: "tha_siamese_navy",
        base: "Sa Kaeo",
        counts: [0, 0, 0, 2, 0, 0, 0],
      },
    ],
    ships: [
      // Ratanakosindra class (coastal defence ships, 1925 and 1930):
      // en.wikipedia HTMS Sukhothai; navypedia "Ratanakosindra coast defence ships"
      ...named("ca", 1, ["tha_ratanakosindra", "tha_sukhothai"]),
    ],
    lines: [],
  },
  {
    tag: "CHN",
    convoys: 20,
    bases: ["Shanghai"],
    fleets: [
      {
        key: "chn_chinese_navy",
        base: "Shanghai",
        counts: [0, 0, 0, 0, 4, 0, 0],
      },
    ],
    ships: [
      // Ning Hai (1932), Yat Sen (1931), Chao Ho and Ying Swei (1912):
      // en.wikipedia Chinese cruiser Ning Hai / Yat Sen / Chao Ho-class cruiser;
      // Conway's 1922-46
      ...named("cl", 1, [
        "chn_ning_hai",
        "chn_yat_sen",
        "chn_chao_ho",
        "chn_ying_swei",
      ]),
    ],
    lines: [],
  },
];

/** Spec §12.4 split of the starting fighters / bombers, AIR_TYPES order
 * (fighter, bomber, heavy_fighter, cas, naval_bomber, strat_bomber,
 * transport_plane, cv_fighter, cv_cas, cv_naval_bomber). The sums equal
 * the P1 stocks (EconomyStart: fighters 650/700/900/900/800/900/2500). */
export const START_PLANES: Readonly<
  Partial<Record<CountryTag, readonly number[]>>
> = {
  DEU: [600, 400, 50, 150, 0, 0, 150, 0, 0, 0],
  ITA: [700, 500, 0, 0, 100, 0, 0, 0, 0, 0],
  JPN: [750, 150, 0, 0, 300, 0, 0, 150, 0, 150],
  GBR: [800, 460, 0, 0, 100, 100, 0, 100, 0, 140],
  FRA: [720, 620, 50, 0, 50, 0, 0, 30, 0, 30],
  USA: [700, 200, 0, 100, 100, 0, 0, 200, 0, 200],
  SUN: [2500, 900, 0, 500, 0, 500, 100, 0, 0, 0],
};

/** The START_NAVY row of a country, or undefined. */
export function startNavyOf(tag: CountryTag): StartNavyDef | undefined {
  return START_NAVY.find((d) => d.tag === tag);
}

/**
 * The land region with scenario.json name `name` (the smallest id when two
 * share it); throws when there is none, so a data row naming a region the
 * map lost fails at the start (the data tests check the real map).
 */
export function resolveRegionName(sc: ScenarioIndex, name: string): number {
  for (const r of sc.landRegions) if (r.name === name) return r.id;
  throw new Error(`World War 1936: no region named "${name}"`);
}
