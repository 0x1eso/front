// World War 1936 P4 — the admirals (spec §7.4). The type is plan Task 1
// Step 15's plus `alsoPerson` (Task 13 Step 5); `admiralAvailable` is the
// foundation's. Lane G (Task 13) fills the roster.
//
// Skills are the spec's: attack/defence/manoeuvre/coordination 0..5, at
// most two traits, dates as the spec gives them (`from` inclusive, `until`
// exclusive). As with the P2 generals, deaths, retirements and dismissals
// after a battle are not dates here (the game's war is not history's); the
// spec's dates (a later first flag command, Kimmel's relief, Orlov's arrest,
// the French naval chief's change of side) stay.
//
// Who is left out (spec §7.4, §16.3, controller rulings):
// - Japan: every person is shown by office only. The spec's eight
//   Japanese admirals are eight office cards below, with the spec's skills,
//   traits and dates; no Japanese person's name appears anywhere. The
//   spec's own exclusions (governors-general of Korea or Taiwan, anyone
//   convicted of war crimes or indicted as a Class A suspect) are covered
//   by that.
// - Germany: the two convicted naval commanders-in-chief.
// - France: Jean-Marie Abrial (sentenced in 1946 by the Haute Cour de
//   justice to ten years' forced labour: en.wikipedia + fr.wikipedia), and
//   the 1937-42 chief of the naval staff shown by office only (ruling).
// - Soviet Union: the NKVD officer who headed the navy 1938-39.
// `alsoPerson` marks the same person as a navy-chief advisor card
// (AirChiefs.ts / content/persons/p4.ts): P3 rule "one side at a time",
// the same way as PersonDef.alsoGeneral.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { AdmiralTrait } from "@openfront/engine-api/ww1936/NavyTypes";

export interface AdmiralDef {
  id: string;
  tag: CountryTag;
  atk: number;
  def: number;
  man: number;
  coord: number;
  traits: AdmiralTrait[];
  from?: string;
  until?: string;
  source: string;
  /** P4_PERSONS id of the same person (Task 13 Step 5): the two are never held at once. */
  alsoPerson?: string;
}

type Skills = readonly [atk: number, def: number, man: number, coord: number];
type Extra = Pick<AdmiralDef, "from" | "until" | "alsoPerson">;

function row(
  id: string,
  tag: CountryTag,
  [atk, def, man, coord]: Skills,
  traits: AdmiralTrait[],
  source: string,
  extra: Extra = {},
): AdmiralDef {
  return { id, tag, atk, def, man, coord, traits, ...extra, source };
}

// Append only: an admiral's id in a game is its index + 1 (plan decision 17).
export const ADMIRALS: readonly AdmiralDef[] = [
  // ---- United Kingdom ----
  row(
    "gbr_cunningham",
    "GBR",
    [5, 4, 4, 4],
    ["superior_tactician"],
    "en.wikipedia Andrew Cunningham, 1st Viscount Cunningham of Hyndhope; en.wikipedia First Sea Lord list (First Sea Lord from 1943-10-15); never tried",
    { alsoPerson: "gbr_cunningham" },
  ),
  row(
    "gbr_tovey",
    "GBR",
    [4, 4, 3, 3],
    [],
    "en.wikipedia John Tovey; dreadnoughtproject.org: flag officer from the mid-1930s, C-in-C Home Fleet 1940-43; never tried",
  ),
  row(
    "gbr_somerville",
    "GBR",
    [3, 4, 3, 4],
    ["aviation_enthusiast"],
    "en.wikipedia James Somerville; dreadnoughtproject.org: Force H 1940-42, Eastern Fleet 1942-44; never tried",
  ),
  row(
    "gbr_fraser",
    "GBR",
    [4, 3, 3, 3],
    [],
    "en.wikipedia Bruce Fraser; dreadnoughtproject.org: Third Sea Lord and Controller from 1939 (spec §7.4 date 1939); never tried",
    { from: "1939-01-01" },
  ),
  row(
    "gbr_harwood",
    "GBR",
    [4, 2, 4, 2],
    [],
    "en.wikipedia Henry Harwood; dreadnoughtproject.org: South America Division, flag rank after the River Plate 1939 (spec §7.4 date 1939); never tried",
    { from: "1939-01-01" },
  ),
  row(
    "gbr_horton",
    "GBR",
    [2, 4, 2, 4],
    ["fleet_protector"],
    "en.wikipedia Max Horton; dreadnoughtproject.org: Flag Officer Submarines 1940, Western Approaches 1942 (spec §7.4 date 1940); never tried",
    { from: "1940-01-01" },
  ),
  row(
    "gbr_ramsay",
    "GBR",
    [2, 3, 3, 5],
    ["amphibious_expert"],
    "en.wikipedia Bertram Ramsay; dreadnoughtproject.org: recalled 1939 as Flag Officer Dover, Normandy naval commander 1944 (spec §7.4 date 1939); never tried",
    { from: "1939-01-01" },
  ),
  row(
    "gbr_pound",
    "GBR",
    [2, 3, 2, 4],
    [],
    "en.wikipedia Dudley Pound; en.wikipedia First Sea Lord list (First Sea Lord 1939-06-12..1943-10-15); never tried",
    { alsoPerson: "gbr_pound" },
  ),

  // ---- United States ----
  row(
    "usa_nimitz",
    "USA",
    [4, 4, 4, 5],
    ["aviation_enthusiast"],
    "en.wikipedia Chester W. Nimitz; NHHC (history.navy.mil) biography: Commander in Chief, Pacific Fleet from the end of 1941; never tried",
  ),
  row(
    "usa_spruance",
    "USA",
    [4, 4, 5, 4],
    ["superior_tactician"],
    "en.wikipedia Raymond A. Spruance; NHHC biography: flag rank from 1940 (spec §7.4 date 1940); never tried",
    { from: "1940-01-01" },
  ),
  row(
    "usa_halsey",
    "USA",
    [5, 2, 3, 3],
    ["aviation_enthusiast"],
    "en.wikipedia William Halsey Jr.; NHHC biography: carrier commands from the mid-1930s; never tried",
  ),
  row(
    "usa_fletcher",
    "USA",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Frank Jack Fletcher; NHHC biography: carrier task forces 1942; never tried",
  ),
  row(
    "usa_mitscher",
    "USA",
    [4, 2, 3, 4],
    ["aviation_enthusiast"],
    "en.wikipedia Marc Mitscher; NHHC biography: commanded Hornet from 1941 (spec §7.4 date 1941); never tried",
    { from: "1941-01-01" },
  ),
  row(
    "usa_kinkaid",
    "USA",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Thomas C. Kinkaid; NHHC biography: flag rank 1941 (spec §7.4 date 1941); never tried",
    { from: "1941-01-01" },
  ),
  row(
    "usa_turner",
    "USA",
    [3, 3, 3, 4],
    ["amphibious_expert"],
    "en.wikipedia Richmond K. Turner; NHHC biography: flag rank 1941, amphibious forces 1942-45 (spec §7.4 date 1941); never tried",
    { from: "1941-01-01" },
  ),
  row(
    "usa_kimmel",
    "USA",
    [2, 3, 2, 3],
    [],
    "en.wikipedia Husband E. Kimmel; NHHC biography: Commander in Chief, US Fleet 1941, relieved 1941-12-17 (spec §7.4 date); never tried",
    { until: "1941-12-17" },
  ),

  // ---- Japan: offices only (controller ruling), spec §7.4 skills and dates ----
  row(
    "jpn_combined_fleet",
    "JPN",
    [5, 3, 4, 5],
    ["aviation_enthusiast"],
    "office card: Commander-in-Chief of the Combined Fleet (en.wikipedia Combined Fleet; ja.wikipedia 連合艦隊司令長官), spec §7.4 row 1",
  ),
  row(
    "jpn_carrier_division_2",
    "JPN",
    [5, 2, 3, 3],
    ["aviation_enthusiast"],
    "office card: commander of the 2nd Carrier Division (en.wikipedia Carrier Division 2; ja.wikipedia 第二航空戦隊), spec §7.4 row 2, from 1940",
    { from: "1940-01-01" },
  ),
  row(
    "jpn_mobile_fleet",
    "JPN",
    [4, 3, 4, 4],
    [],
    "office card: commander of the Mobile Fleet (en.wikipedia First Mobile Fleet; ja.wikipedia 第一機動艦隊), spec §7.4 row 3",
  ),
  row(
    "jpn_second_fleet",
    "JPN",
    [3, 3, 3, 3],
    [],
    "office card: Commander-in-Chief of the Second Fleet (en.wikipedia Second Fleet (Imperial Japanese Navy); ja.wikipedia 第二艦隊), spec §7.4 row 4",
  ),
  row(
    "jpn_first_air_fleet",
    "JPN",
    [3, 3, 2, 3],
    [],
    "office card: Commander-in-Chief of the First Air Fleet (en.wikipedia First Air Fleet; ja.wikipedia 第一航空艦隊), spec §7.4 row 5",
  ),
  row(
    "jpn_eighth_fleet",
    "JPN",
    [4, 2, 4, 2],
    [],
    "office card: Commander-in-Chief of the Eighth Fleet (en.wikipedia Eighth Fleet (Imperial Japanese Navy); ja.wikipedia 第八艦隊), spec §7.4 row 6",
  ),
  row(
    "jpn_destroyer_squadron_2",
    "JPN",
    [4, 2, 5, 2],
    [],
    "office card: commander of Destroyer Squadron 2 (en.wikipedia Destroyer Squadron 2 (Japan); ja.wikipedia 第二水雷戦隊), spec §7.4 row 7",
  ),
  row(
    "jpn_cruiser_division_7",
    "JPN",
    [3, 3, 3, 2],
    [],
    "office card: commander of Cruiser Division 7 (en.wikipedia Cruiser Division 7; ja.wikipedia 第七戦隊), spec §7.4 row 8",
  ),

  // ---- Germany ----
  row(
    "deu_luetjens",
    "DEU",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Günther Lütjens; de.wikipedia: fleet commander 1940-41; died 1941, never tried",
  ),
  row(
    "deu_marschall",
    "DEU",
    [3, 3, 3, 2],
    [],
    "en.wikipedia Wilhelm Marschall; de.wikipedia: fleet commander 1939-40; never tried",
  ),
  row(
    "deu_ciliax",
    "DEU",
    [3, 3, 4, 2],
    [],
    "en.wikipedia Otto Ciliax; de.wikipedia: battleship and fleet commands 1939-42; never tried",
  ),
  row(
    "deu_carls",
    "DEU",
    [2, 3, 2, 3],
    [],
    "en.wikipedia Rolf Carls; de.wikipedia: fleet and naval group commands 1936-43; died 1945, never tried",
  ),
  row(
    "deu_friedeburg",
    "DEU",
    [2, 3, 2, 3],
    ["sea_wolf"],
    "en.wikipedia Hans-Georg von Friedeburg; de.wikipedia: U-boat organisation 1939-43; died 1945, never tried",
  ),

  // ---- Italy ----
  row(
    "ita_campioni",
    "ITA",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Inigo Campioni; it.wikipedia: fleet commander 1939-40; shot by the Italian Social Republic in 1944, never tried for war crimes",
  ),
  row(
    "ita_iachino",
    "ITA",
    [3, 3, 2, 3],
    [],
    "en.wikipedia Angelo Iachino; it.wikipedia: fleet commander 1940-43; never tried",
  ),
  row(
    "ita_bergamini",
    "ITA",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Carlo Bergamini; it.wikipedia: battle fleet commander 1943; died 1943, never tried",
  ),
  row(
    "ita_da_zara",
    "ITA",
    [4, 2, 3, 2],
    [],
    "en.wikipedia Alberto Da Zara; it.wikipedia: cruiser division commander 1940-43; never tried",
  ),
  row(
    "ita_riccardi",
    "ITA",
    [2, 3, 2, 3],
    [],
    "en.wikipedia Arturo Riccardi; it.wikipedia: Chief of Staff of the Regia Marina 1940-43; never tried",
  ),

  // ---- France ----
  row(
    "fra_gensoul",
    "FRA",
    [3, 3, 3, 2],
    [],
    "en.wikipedia Marcel-Bruno Gensoul + fr.wikipedia: Force de Raid 1939-40; investigated at the Liberation, proceedings judged inopportune (fr.wikipedia), never convicted",
  ),
  row(
    "fra_godfroy",
    "FRA",
    [2, 3, 2, 2],
    [],
    "en.wikipedia René-Émile Godfroy + fr.wikipedia: Force X 1940-43; retired by decree 1943-12-10, annulled by the Conseil d'État 1955, never tried",
  ),
  row(
    "fra_naval_staff",
    "FRA",
    [2, 3, 3, 4],
    [],
    "office card (controller ruling): Chief of the Naval Staff (en.wikipedia French Navy; fr.wikipedia Chef d'état-major de la Marine), spec §7.4 row 4 skills, until 1942-11-13",
    { until: "1942-11-13" },
  ),

  // ---- Soviet Union ----
  row(
    "sun_kuznetsov",
    "SUN",
    [3, 3, 3, 4],
    [],
    "en.wikipedia Nikolay Kuznetsov (officer); en.wikipedia Commander-in-Chief of the Russian Navy list (People's Commissar from 1939-04-28); spec §7.4 date 1937; never tried for war crimes",
    { from: "1937-01-01", alsoPerson: "sun_kuznetsov" },
  ),
  row(
    "sun_golovko",
    "SUN",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Arseniy Golovko; ru.wikipedia: Northern Fleet commander from 1940 (spec §7.4 date 1940); never tried",
    { from: "1940-01-01" },
  ),
  row(
    "sun_oktyabrsky",
    "SUN",
    [2, 3, 2, 3],
    [],
    "en.wikipedia Filipp Oktyabrsky; ru.wikipedia: Black Sea Fleet commander from 1939; never tried",
  ),
  row(
    "sun_tributs",
    "SUN",
    [2, 3, 2, 3],
    [],
    "en.wikipedia Vladimir Tributs; ru.wikipedia: Baltic Fleet commander from 1939 (spec §7.4 date 1939); never tried",
    { from: "1939-01-01" },
  ),
  row(
    "sun_yumashev",
    "SUN",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Ivan Yumashev; ru.wikipedia: Black Sea Fleet 1938-39, Pacific Fleet 1939-47; never tried",
  ),
  row(
    "sun_orlov",
    "SUN",
    [2, 2, 2, 2],
    [],
    "en.wikipedia Vladimir Mitrofanovich Orlov + Military Wiki list of Soviet naval commanders: head of the Naval Forces 1931 to his arrest 1937-07-10 (Viktorov from August 1937); executed 1938",
    { until: "1937-07-10", alsoPerson: "sun_orlov" },
  ),
];
