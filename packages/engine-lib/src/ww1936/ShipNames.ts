// World War 1936 P4 — the names new ships take (spec §4.4, plan decision
// 17), and the historical fleet names. The types are plan Task 1 Step 15's;
// lane G (Task 13) fills the tables.
//
// A major's battleships, battlecruisers, carriers and cruisers built in the
// game take the next name of their list: ships of that period, completed or
// only planned, in the order they were laid down or ordered, after the
// names already at sea or on the slips in 1936 (StartNavy). When a list
// runs out, or a class has no list (no real name existed: the British,
// Japanese, German, Italian and French battlecruisers, the German light
// cruisers, the Soviet carriers), the ship takes a numbered name.
// Destroyers and submarines are always numbered.
//
// Names are keys ww1936.ship.<name>: the original-language name (Japanese
// in Hepburn without long-vowel marks) in English, the Korean loanword
// spelling (외래어 표기법) in Korean. Sources per list: en.wikipedia (the
// class articles named) and Conway's All the World's Fighting Ships 1922-46.
//
// The name list is the foundation's (plan Task 1 Step 15). A ship's nameIdx
// (state): > 0 is index + 1 into shipNameList(tag, cls): the names of the
// country's START_NAVY ships of that class (table order), then its
// START_NAVY lines' names, then SHIP_NAMES[tag][cls] (the names ships built
// in the game take, in order); < 0 is a numbered name −n ("Destroyer No.
// n").
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { ShipClass } from "@openfront/engine-api/ww1936/NavyTypes";
import { START_NAVY } from "./StartNavy";

export const SHIP_NAMES: Readonly<
  Partial<
    Record<CountryTag, Readonly<Partial<Record<ShipClass, readonly string[]>>>>
  >
> = {
  GBR: {
    // King George V class (5), Lion class (4, laid down 1939, cancelled),
    // Vanguard: en.wikipedia King George V-class / Lion-class battleship
    // (1938) / HMS Vanguard (23); Conway's 1922-46
    bb: [
      "gbr_king_george_v",
      "gbr_prince_of_wales",
      "gbr_duke_of_york",
      "gbr_anson",
      "gbr_howe",
      "gbr_lion",
      "gbr_temeraire",
      "gbr_conqueror",
      "gbr_thunderer",
      "gbr_vanguard",
    ],
    // Illustrious and Implacable classes, Unicorn, Colossus class:
    // en.wikipedia Illustrious-class / Implacable-class / Colossus-class
    // aircraft carrier, HMS Unicorn (I72); Conway's 1922-46
    cv: [
      "gbr_illustrious",
      "gbr_formidable",
      "gbr_victorious",
      "gbr_indomitable",
      "gbr_implacable",
      "gbr_indefatigable",
      "gbr_unicorn",
      "gbr_colossus",
      "gbr_glory",
      "gbr_ocean",
      "gbr_vengeance",
      "gbr_venerable",
      "gbr_warrior",
      "gbr_theseus",
      "gbr_triumph",
      "gbr_perseus",
    ],
    // Surrey, Northumberland (ordered 1929, cancelled 1930; no later British
    // heavy cruiser): en.wikipedia Surrey-class cruiser; Conway's 1922-46
    ca: ["gbr_surrey", "gbr_northumberland"],
    // Town class after the 1936 line (Manchester, Liverpool laid down 1936),
    // Dido class, Fiji class (Apollo, Amphion, Penelope, Aurora and
    // Birmingham were on the slips in 1936: StartNavy lines): en.wikipedia
    // Town-class (1936) / Dido-class / Fiji-class cruiser; Conway's 1922-46
    cl: [
      "gbr_manchester",
      "gbr_liverpool",
      "gbr_gloucester",
      "gbr_edinburgh",
      "gbr_belfast",
      "gbr_dido",
      "gbr_euryalus",
      "gbr_naiad",
      "gbr_phoebe",
      "gbr_sirius",
      "gbr_bonaventure",
      "gbr_hermione",
      "gbr_charybdis",
      "gbr_cleopatra",
      "gbr_scylla",
      "gbr_fiji",
      "gbr_kenya",
      "gbr_mauritius",
      "gbr_nigeria",
      "gbr_trinidad",
    ],
  },
  USA: {
    // North Carolina, South Dakota, Iowa and Montana classes: en.wikipedia
    // North Carolina- / South Dakota- (1939) / Iowa- / Montana-class
    // battleship; Conway's 1922-46
    bb: [
      "usa_north_carolina",
      "usa_washington",
      "usa_south_dakota",
      "usa_indiana",
      "usa_massachusetts",
      "usa_alabama",
      "usa_iowa",
      "usa_new_jersey",
      "usa_missouri",
      "usa_wisconsin",
      "usa_illinois",
      "usa_kentucky",
      "usa_montana",
      "usa_ohio",
      "usa_maine",
      "usa_new_hampshire",
      "usa_louisiana",
    ],
    // Alaska class (large cruisers; Philippines, Puerto Rico, Samoa
    // cancelled): en.wikipedia Alaska-class cruiser; Conway's 1922-46
    bc: [
      "usa_alaska",
      "usa_guam",
      "usa_hawaii",
      "usa_philippines",
      "usa_puerto_rico",
      "usa_samoa",
    ],
    // Wasp, Hornet, Essex class (names not already used), Independence class:
    // en.wikipedia USS Wasp (CV-7) / USS Hornet (CV-8) / Essex-class /
    // Independence-class aircraft carrier; Conway's 1922-46
    cv: [
      "usa_wasp",
      "usa_hornet",
      "usa_essex",
      "usa_intrepid",
      "usa_franklin",
      "usa_ticonderoga",
      "usa_randolph",
      "usa_bunker_hill",
      "usa_bennington",
      "usa_boxer",
      "usa_bon_homme_richard",
      "usa_antietam",
      "usa_lake_champlain",
      "usa_shangri_la",
      "usa_independence",
      "usa_princeton",
      "usa_belleau_wood",
      "usa_cowpens",
      "usa_monterey",
      "usa_cabot",
    ],
    // Baltimore class, Oregon City class (Wichita was on the slips in 1936:
    // StartNavy line): en.wikipedia Baltimore-class / Oregon City-class
    // cruiser; Conway's 1922-46
    ca: [
      "usa_baltimore",
      "usa_boston",
      "usa_canberra",
      "usa_pittsburgh",
      "usa_saint_paul",
      "usa_columbus",
      "usa_bremerton",
      "usa_fall_river",
      "usa_macon",
      "usa_toledo",
      "usa_los_angeles",
      "usa_oregon_city",
      "usa_albany",
      "usa_rochester",
    ],
    // St. Louis class (laid down 1936-12), Atlanta class, Cleveland class
    // (the seven Brooklyns laid down by 1935 are a StartNavy line):
    // en.wikipedia Brooklyn- / Atlanta- / Cleveland-class cruiser; Conway's 1922-46
    cl: [
      "usa_st_louis",
      "usa_helena",
      "usa_atlanta",
      "usa_juneau",
      "usa_san_diego",
      "usa_san_juan",
      "usa_cleveland",
      "usa_columbia",
      "usa_montpelier",
      "usa_denver",
      "usa_santa_fe",
      "usa_birmingham",
      "usa_mobile",
      "usa_biloxi",
      "usa_oakland",
      "usa_reno",
      "usa_miami",
    ],
  },
  JPN: {
    // Yamato class (Shinano completed as a carrier, so it is in the carrier
    // list): en.wikipedia Yamato-class battleship; Conway's 1922-46
    bb: ["jpn_yamato", "jpn_musashi"],
    // Hiryu (laid down 1936-07-08), Shokaku class, Taiho, Junyo class, Zuiho class, Ryuho, Chitose class,
    // Unryu class, Shinano, Taiyo class: en.wikipedia Shōkaku- / Hiyō- /
    // Zuihō- / Chitose- / Unryū- / Taiyō-class aircraft carrier, Japanese
    // aircraft carrier Taihō / Ryūhō / Shinano; Conway's 1922-46
    cv: [
      "jpn_hiryu",
      "jpn_shokaku",
      "jpn_zuikaku",
      "jpn_zuiho",
      "jpn_shoho",
      "jpn_junyo",
      "jpn_hiyo",
      "jpn_ryuho",
      "jpn_chitose",
      "jpn_chiyoda",
      "jpn_taiho",
      "jpn_unryu",
      "jpn_amagi",
      "jpn_katsuragi",
      "jpn_kasagi",
      "jpn_aso",
      "jpn_ikoma",
      "jpn_kurama",
      "jpn_shinano",
      "jpn_taiyo",
      "jpn_unyo",
    ],
    // Ibuki (the Tone class was on the slips in 1936: StartNavy line):
    // en.wikipedia Ibuki-class cruiser (1942); Conway's 1922-46
    ca: ["jpn_ibuki"],
    // Katori class, Agano class, Oyodo class (Suzuya and Kumano were on the
    // slips in 1936: StartNavy line): en.wikipedia Katori- / Agano- /
    // Ōyodo-class cruiser; Conway's 1922-46
    cl: [
      "jpn_katori",
      "jpn_kashima",
      "jpn_kashii",
      "jpn_agano",
      "jpn_noshiro",
      "jpn_yahagi",
      "jpn_sakawa",
      "jpn_oyodo",
      "jpn_niyodo",
    ],
  },
  DEU: {
    // Bismarck class: en.wikipedia Bismarck-class battleship; Conway's 1922-46
    bb: ["deu_bismarck", "deu_tirpitz"],
    // Graf Zeppelin: en.wikipedia German aircraft carrier Graf Zeppelin; Conway's 1922-46
    cv: ["deu_graf_zeppelin"],
    // Admiral Hipper class after Hipper: en.wikipedia Admiral Hipper-class
    // cruiser; Conway's 1922-46
    ca: ["deu_bluecher", "deu_prinz_eugen", "deu_seydlitz", "deu_luetzow"],
  },
  ITA: {
    // Littorio class after the 1936 lines: en.wikipedia Littorio-class
    // battleship; Conway's 1922-46
    bb: ["ita_roma", "ita_impero"],
    // Aquila, Sparviero (liner conversions): en.wikipedia Italian aircraft
    // carrier Aquila / Sparviero; Conway's 1922-46
    cv: ["ita_aquila", "ita_sparviero"],
    // Capitani Romani class, Etna class (Eugenio di Savoia and Giuseppe
    // Garibaldi were on the slips in 1936: StartNavy lines): en.wikipedia
    // Capitani Romani- / Etna-class cruiser; Conway's 1922-46
    cl: [
      "ita_attilio_regolo",
      "ita_scipione_africano",
      "ita_pompeo_magno",
      "ita_ottaviano_augusto",
      "ita_ulpio_traiano",
      "ita_caio_mario",
      "ita_claudio_druso",
      "ita_claudio_tiberio",
      "ita_cornelio_silla",
      "ita_paolo_emilio",
      "ita_vipsanio_agrippa",
      "ita_giulio_germanico",
      "ita_etna",
      "ita_vesuvio",
    ],
  },
  FRA: {
    // Richelieu class after Richelieu, Alsace class (planned 1940):
    // en.wikipedia Richelieu-class / Alsace-class battleship; Conway's 1922-46
    bb: [
      "fra_jean_bart",
      "fra_clemenceau",
      "fra_gascogne",
      "fra_alsace",
      "fra_normandie",
      "fra_flandre",
      "fra_bourgogne",
    ],
    // Joffre class: en.wikipedia Joffre-class aircraft carrier; Conway's 1922-46
    cv: ["fra_joffre", "fra_painleve"],
    // De Grasse class (planned 1937-38; the whole La Galissonnière class was
    // on the slips or in service in 1936): en.wikipedia De Grasse-class
    // cruiser; Conway's 1922-46
    cl: ["fra_de_grasse", "fra_chateaurenault", "fra_guichen"],
  },
  SUN: {
    // Sovetsky Soyuz class: en.wikipedia Sovetsky Soyuz-class battleship;
    // Conway's 1922-46
    bb: [
      "sun_sovetsky_soyuz",
      "sun_sovetskaya_ukraina",
      "sun_sovetskaya_rossiya",
      "sun_sovetskaya_belorussiya",
    ],
    // Kronshtadt class: en.wikipedia Kronshtadt-class battlecruiser; Conway's 1922-46
    bc: ["sun_kronshtadt", "sun_sevastopol"],
    // Project 26-bis (Kirov and Voroshilov were on the slips in 1936:
    // StartNavy lines); Petropavlovsk (ex-Lützow):
    // en.wikipedia Kirov-class cruiser / German cruiser Lützow (1939);
    // Conway's 1922-46. Lazar Kaganovich left out (sensitivity).
    ca: ["sun_maxim_gorky", "sun_molotov", "sun_kalinin", "sun_petropavlovsk"],
    // Chapayev class: en.wikipedia Chapayev-class cruiser; Conway's 1922-46
    cl: [
      "sun_chapayev",
      "sun_chkalov",
      "sun_zheleznyakov",
      "sun_frunze",
      "sun_kuibyshev",
      "sun_ordzhonikidze",
      "sun_sverdlov",
    ],
  },
};

/** Historical fleet names (ww1936.fleet.<key>), in START_NAVY order. */
export const FLEET_NAMES: readonly string[] = [
  "gbr_home_fleet",
  "gbr_mediterranean_fleet",
  "gbr_china_station",
  "gbr_east_indies_station",
  "gbr_america_west_indies_station",
  "gbr_africa_station",
  "gbr_reserve_fleet",
  "usa_battle_force",
  "usa_scouting_force",
  "usa_atlantic_squadron",
  "usa_submarine_force",
  "usa_asiatic_fleet",
  "jpn_first_fleet",
  "jpn_second_fleet",
  "jpn_submarine_squadron",
  "jpn_third_fleet",
  "jpn_guard_force",
  "fra_mediterranean_squadron",
  "fra_atlantic_squadron",
  "fra_far_east_division",
  "fra_north_africa_forces",
  "ita_first_squadron",
  "ita_second_squadron",
  "ita_red_sea_command",
  "ita_aegean_command",
  "ita_libya_command",
  "deu_fleet",
  "deu_uboat_flotilla",
  "sun_baltic_fleet",
  "sun_black_sea_fleet",
  "sun_pacific_fleet",
  "sun_northern_flotilla",
  "nld_east_indies_squadron",
  "esr_republican_fleet",
  "esn_nationalist_fleet",
  "aus_australian_squadron",
  "can_canadian_navy",
  "tur_turkish_fleet",
  "grc_hellenic_fleet",
  "swe_coastal_fleet",
  "nor_norwegian_navy",
  "dnk_danish_navy",
  "fin_finnish_navy",
  "pol_polish_navy",
  "rou_romanian_navy",
  "yug_yugoslav_navy",
  "prt_portuguese_navy",
  "arg_sea_fleet",
  "bra_brazilian_fleet",
  "chl_chilean_squadron",
  "tha_siamese_navy",
  "chn_chinese_navy",
];

const lists = new Map<string, { names: string[]; queueFrom: number }>();

function listOf(
  tag: CountryTag,
  cls: ShipClass,
): { names: string[]; queueFrom: number } {
  const key = `${tag}:${cls}`;
  let l = lists.get(key);
  if (l !== undefined) return l;
  const names: string[] = [];
  const add = (n: string) => {
    if (!names.includes(n)) names.push(n);
  };
  for (const d of START_NAVY) {
    if (d.tag !== tag) continue;
    for (const s of d.ships)
      if (s.cls === cls && s.name !== undefined) add(s.name);
    for (const ln of d.lines)
      if (ln.cls === cls) for (const n of ln.names) add(n);
  }
  const queueFrom = names.length;
  for (const n of SHIP_NAMES[tag]?.[cls] ?? []) add(n);
  l = { names, queueFrom };
  lists.set(key, l);
  return l;
}

/** Every name a (country, class) ship can carry, in nameIdx order. */
export function shipNameList(
  tag: CountryTag,
  cls: ShipClass,
): readonly string[] {
  return listOf(tag, cls).names;
}

/** The nameIdx of a name of the list, 0 when it is not in it. */
export function shipNameIdx(
  tag: CountryTag,
  cls: ShipClass,
  name: string,
): number {
  return listOf(tag, cls).names.indexOf(name) + 1;
}

/**
 * The nameIdx of the `n`-th name of the build queue (SHIP_NAMES order);
 * 0 when the queue has no more (the ship takes a numbered name).
 */
export function queuedShipName(
  tag: CountryTag,
  cls: ShipClass,
  n: number,
): number {
  const l = listOf(tag, cls);
  const i = l.queueFrom + n;
  return i < l.names.length ? i + 1 : 0;
}

/** The name key of a nameIdx > 0 (ww1936.ship.<key>), or null for a numbered name. */
export function shipNameKey(
  tag: CountryTag,
  cls: ShipClass,
  nameIdx: number,
): string | null {
  if (nameIdx <= 0) return null;
  return listOf(tag, cls).names[nameIdx - 1] ?? null;
}

/** A fleet name's nameIdx (FLEET_NAMES index + 1), 0 when unknown. */
export function fleetNameIdx(key: string): number {
  return FLEET_NAMES.indexOf(key) + 1;
}
