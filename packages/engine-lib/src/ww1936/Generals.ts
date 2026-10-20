// World War 1936 P2: the generals (P2 spec §6.2). The functions are the
// foundation's; Task 10 fills the roster.
import { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  GeneralTrait,
  traitBit,
  WW_TITLED_GENERAL_BASE,
} from "@openfront/engine-api/ww1936/LandTypes";
import { dayOfDate } from "./Calendar";

export interface GeneralDef {
  /** Translation key ww1936.general.<id>. */
  id: string;
  tag: CountryTag;
  att: number;
  def: number;
  plan: number;
  log: number;
  traits: readonly GeneralTrait[];
  /** ISO date it can first serve (spec §6.2); none: from the start. */
  from?: string;
  /** ISO date it leaves (arrest, dismissal). */
  until?: string;
  /** Spans it cannot serve, [from, until) ISO. */
  gaps?: readonly (readonly [string, string])[];
  /** Where the dates and the exclusion check come from (Task 10). */
  source: string;
}

// Append only: a general's id in a game is its index + 1 (plan decision 17).
// The first two rows are the foundation's seed and stay first. The rest is
// the P2 spec §6.2 roster (Task 10): real people, facts only. Left out by
// the principle (spec §6.2, mode rulings): Japanese officers who governed
// Korea or Taiwan, led the Korea Army or were convicted at any war-crimes
// trial; anyone convicted by the IMT, the later Nuremberg trials or another
// war-crimes court; police and secret-police chiefs; and, when in doubt,
// anyone the sources leave open (the titled generals fill in).
// tests/ww1936/LandData.test.ts lists the excluded names.
//
// Dates (all checked 2026-10-21): `from` is the day of the first
// general-officer rank (Generalmajor, brigadier general, major-general in
// Britain, général de brigade, generale di brigata, shōshō, kombrig in the
// Red Army of 1935-40) when it came after 1936-01-01; `until` and `gaps`
// are arrests (spec §6.2: purges, the 1944 plot). Retirements, recalls,
// deaths and dismissals that followed a battle are not dates here: the
// game's war is not history's.
type Skills = readonly [att: number, def: number, plan: number, log: number];
type Dates = Pick<GeneralDef, "from" | "until" | "gaps">;

function row(
  id: string,
  tag: CountryTag,
  [att, def, plan, log]: Skills,
  traits: readonly GeneralTrait[],
  source: string,
  dates: Dates = {},
): GeneralDef {
  return { id, tag, att, def, plan, log, traits, ...dates, source };
}

export const GENERALS: readonly GeneralDef[] = [
  {
    id: "rundstedt",
    tag: "DEU",
    att: 4,
    def: 4,
    plan: 3,
    log: 3,
    traits: [],
    source:
      "seed; en.wikipedia Gerd von Rundstedt: General der Infanterie 1932, commanded Gruppenkommando 1 in 1936; held by the British, never tried (released 1949)",
  },
  {
    id: "bock",
    tag: "DEU",
    att: 4,
    def: 3,
    plan: 3,
    log: 3,
    traits: [],
    source:
      "seed; en.wikipedia Fedor von Bock + de.wikipedia: Generalmajor 1929-02-01, General der Infanterie 1935-03-01; died 1945-05-04, never tried",
  },

  // ---- Germany ----
  row(
    "guderian",
    "DEU",
    [5, 2, 3, 3],
    ["panzer_leader"],
    "en.wikipedia Heinz Guderian + de.wikipedia: Generalmajor 1936-08-01; released 1948 without charge",
    { from: "1936-08-01" },
  ),
  row(
    "rommel",
    "DEU",
    [5, 2, 3, 1],
    ["panzer_leader"],
    "en.wikipedia Erwin Rommel (Generalmajor August 1939) + de.wikipedia (rückwirkend zum 1. August 1939); never tried",
    { from: "1939-08-01" },
  ),
  row(
    "model",
    "DEU",
    [3, 5, 3, 3],
    ["defensive_doctrine"],
    "en.wikipedia Walter Model + de.wikipedia: Generalmajor 1938-03-01; died 1945-04-21, never tried",
    { from: "1938-03-01" },
  ),
  row(
    "kluge",
    "DEU",
    [3, 4, 3, 3],
    ["infantry_officer"],
    "en.wikipedia Günther von Kluge + de.wikipedia: Generalmajor 1933-02-01, Generalleutnant 1934, VI Army Corps in 1936; died 1944, never tried",
  ),
  row(
    "witzleben",
    "DEU",
    [2, 3, 3, 3],
    [],
    "en.wikipedia Erwin von Witzleben + de.wikipedia: Generalmajor 1934-02-01, III Army Corps (Berlin) in 1936; arrested 1944-07-21 (GDW Berlin biography)",
    { until: "1944-07-21" },
  ),
  row(
    "heinrici",
    "DEU",
    [2, 5, 2, 3],
    ["defensive_doctrine"],
    "en.wikipedia Gotthard Heinrici + de.wikipedia: Generalmajor with effect from 1936-01-01; British POW to 1948, never tried",
  ),
  row(
    "paulus",
    "DEU",
    [2, 3, 4, 4],
    [],
    "en.wikipedia Friedrich Paulus (rank list: Generalmajor 1939-01-01) + de.wikipedia (early 1939); Nuremberg witness, never charged",
    { from: "1939-01-01" },
  ),
  row(
    "hube",
    "DEU",
    [4, 3, 2, 3],
    ["panzer_leader"],
    "en.wikipedia Hans-Valentin Hube + TracesOfWar and de.wikipedia: Generalmajor 1940-06-01; died 1944, never tried",
    { from: "1940-06-01" },
  ),
  row(
    "wenck",
    "DEU",
    [3, 3, 4, 4],
    ["organizer"],
    "en.wikipedia Walther Wenck + de.wikipedia and TracesOfWar: Generalmajor 1943-03-01; US POW to 1947, never tried",
    { from: "1943-03-01" },
  ),
  row(
    "geyr",
    "DEU",
    [3, 3, 3, 3],
    ["panzer_leader"],
    "en.wikipedia Leo Geyr von Schweppenburg + de.wikipedia: Generalmajor 1935-09-01 (valka.cz: 1935-08-01), attaché in London 1933-37; US captivity to 1947, never tried",
  ),
  row(
    "wietersheim",
    "DEU",
    [3, 3, 2, 3],
    [],
    "en.wikipedia Gustav Anton von Wietersheim + generals.dk and TracesOfWar: Generalmajor 1934-07-01; Nuremberg witness, never tried",
  ),

  // ---- Soviet Union ----
  row(
    "tukhachevsky",
    "SUN",
    [4, 3, 5, 3],
    [],
    "en.wikipedia Mikhail Tukhachevsky + ru.wikipedia: Marshal November 1935; arrested 1937-05-22 (spec §6.2, Sybir Memorial Museum)",
    { until: "1937-05-22" },
  ),
  row(
    "zhukov",
    "SUN",
    [5, 4, 4, 3],
    [],
    "en.wikipedia Georgy Zhukov + generals.dk: kombrig 1935-11-26, komdiv 1938-02-22 (ru.wikipedia, NKO order 0170/p)",
  ),
  row(
    "rokossovsky",
    "SUN",
    [4, 5, 3, 3],
    [],
    "en.wikipedia Konstantin Rokossovsky + ru sources: komdiv 1935; NKVD prison 1937-08-17 to 1940-03-22 (NKVD certificate of 1940-04-04; Great Russian Encyclopedia: August 1937 to March 1940)",
    { gaps: [["1937-08-17", "1940-03-22"]] },
  ),
  row(
    "konev",
    "SUN",
    [4, 3, 3, 3],
    [],
    "en.wikipedia Ivan Konev + ru.wikipedia: komdiv from 1935-11-26, 37th Rifle Division (generals.dk dates komdiv 1936-11-26)",
  ),
  row(
    "timoshenko",
    "SUN",
    [3, 3, 2, 2],
    [],
    "en.wikipedia Semyon Timoshenko + generals.dk: komkor 1935-11-20",
  ),
  row(
    "budyonny",
    "SUN",
    [1, 2, 1, 1],
    ["cavalry_officer"],
    "en.wikipedia Semyon Budyonny + ru.wikipedia: one of the first five Marshals of the Soviet Union, 1935-11-20",
  ),
  row(
    "uborevich",
    "SUN",
    [4, 3, 4, 3],
    ["organizer"],
    "en.wikipedia Ieronim Uborevich + ru.wikipedia: komandarm 1st rank 1935-11-20; arrested 1937-05-29",
    { until: "1937-05-29" },
  ),
  row(
    "yakir",
    "SUN",
    [3, 3, 4, 3],
    [],
    "en.wikipedia Iona Yakir + ru.wikipedia: komandarm 1st rank 1935-11-20; arrested 1937-05-28 (spec §6.2)",
    { until: "1937-05-28" },
  ),
  row(
    "blyukher",
    "SUN",
    [3, 3, 3, 2],
    [],
    "en.wikipedia Vasily Blyukher + ru.wikipedia: Marshal 1935; arrested 1938-10-22 (spec §6.2, Military Wiki)",
    { until: "1938-10-22" },
  ),
  row(
    "meretskov",
    "SUN",
    [3, 3, 3, 3],
    ["winter_specialist"],
    "en.wikipedia Kirill Meretskov (arrested 23 June 1941, released September 1941) + ru.wikipedia: komdiv 1935-11-20; released 1941-09-06",
    { gaps: [["1941-06-23", "1941-09-06"]] },
  ),
  row(
    "vatutin",
    "SUN",
    [4, 3, 4, 3],
    [],
    "en.wikipedia Nikolai Vatutin + ru.wikipedia: colonel 1935-11-29, kombrig 1938-02-17 (generals.dk: 1938-02-22)",
    { from: "1938-02-17" },
  ),
  row(
    "malinovsky",
    "SUN",
    [3, 3, 4, 3],
    [],
    "en.wikipedia Rodion Malinovsky + ru.wikipedia: colonel 1935-11-28, kombrig 1938-06-15 (generals.dk: 1938-07-15)",
    { from: "1938-06-15" },
  ),
  row(
    "chuikov",
    "SUN",
    [3, 4, 2, 2],
    ["defensive_doctrine"],
    "en.wikipedia Vasily Chuikov + ru.wikipedia and generals.dk: colonel 1936, kombrig 1938-02-17",
    { from: "1938-02-17" },
  ),
  row(
    "yeremenko",
    "SUN",
    [3, 3, 2, 2],
    ["cavalry_officer"],
    "en.wikipedia Andrey Yeryomenko + ru.wikipedia: colonel 1935-12-30, kombrig 1938-02-17 (generals.dk: 1938-02-22)",
    { from: "1938-02-17" },
  ),

  // ---- United Kingdom ----
  row(
    "gort",
    "GBR",
    [2, 3, 2, 3],
    [],
    "en.wikipedia John Vereker, 6th Viscount Gort: major-general 1935-11-25, Commandant Staff College 1936",
  ),
  row(
    "wavell",
    "GBR",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Archibald Wavell + generals.dk: major-general 1933-10-16",
  ),
  row(
    "brooke",
    "GBR",
    [3, 4, 4, 4],
    [],
    "en.wikipedia Alan Brooke, 1st Viscount Alanbrooke + generals.dk: major-general 1935-06-01",
  ),
  row(
    "montgomery",
    "GBR",
    [3, 4, 5, 4],
    [],
    "en.wikipedia Bernard Montgomery + generals.dk: major-general 1938-10-28 (8th Division, Palestine, October 1938: ARRSE)",
    { from: "1938-10-28" },
  ),
  row(
    "oconnor",
    "GBR",
    [5, 2, 3, 2],
    [],
    "en.wikipedia Richard O'Connor (major-general September 1938, 7th Division) + generals.dk: 1938-09-29",
    { from: "1938-09-29" },
  ),
  row(
    "maitland_wilson",
    "GBR",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Henry Maitland Wilson + generals.dk: major-general 1935-04-30",
  ),
  row(
    "alexander",
    "GBR",
    [3, 4, 3, 3],
    [],
    "en.wikipedia Harold Alexander (major-general 1937, the army's youngest) + generals.dk: 1937-10-16",
    { from: "1937-10-16" },
  ),
  row(
    "auchinleck",
    "GBR",
    [3, 3, 3, 4],
    [],
    "en.wikipedia Claude Auchinleck + generals.dk: major-general 1935-11-30 (LRB: major-general in the 1935 Mohmand operations)",
  ),
  row(
    "slim",
    "GBR",
    [3, 4, 4, 4],
    ["infantry_officer"],
    "en.wikipedia William Slim + generals.dk and ADB: acting major-general 1941-05-15 (10th Indian Division)",
    { from: "1941-05-15" },
  ),
  row(
    "alan_cunningham",
    "GBR",
    [3, 3, 2, 3],
    [],
    "en.wikipedia Alan Cunningham + generals.dk and London Gazette 34548: major-general, 5th AA Division 1938-09-01",
    { from: "1938-09-01" },
  ),
  row(
    "leese",
    "GBR",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Oliver Leese (acting major-general December 1940) + generals.dk: 1940-12-30 (a brief acting spell 1940-05-11 to 06-30 left out)",
    { from: "1940-12-30" },
  ),
  row(
    "dempsey",
    "GBR",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Miles Dempsey + generals.dk and service record: acting major-general 1941-06-15",
    { from: "1941-06-15" },
  ),
  row(
    "horrocks",
    "GBR",
    [4, 3, 3, 3],
    [],
    "en.wikipedia Brian Horrocks + his memoir and TracesOfWar: acting major-general, 44th Division 1941-06-25",
    { from: "1941-06-25" },
  ),

  // ---- France ----
  row(
    "gamelin",
    "FRA",
    [1, 3, 2, 3],
    [],
    "en.wikipedia Maurice Gamelin + Chemins de mémoire: head of the army from 1935; the Riom trial ended without a verdict",
  ),
  row(
    "georges",
    "FRA",
    [2, 3, 2, 3],
    [],
    "en.wikipedia Alphonse Georges + fr.wikipedia: général de division 1928, inspector of North African troops 1935",
  ),
  row(
    "giraud",
    "FRA",
    [3, 2, 2, 2],
    [],
    "en.wikipedia Henri Giraud + valka.cz: général de brigade 1930-12-22, Military Governor of Metz 1936-04-11 (generals.dk)",
  ),
  row(
    "juin",
    "FRA",
    [4, 3, 3, 3],
    ["mountaineer"],
    "en.wikipedia Alphonse Juin + fr.wikipedia, Chemins de mémoire, TracesOfWar: général de brigade 1938-12-26",
    { from: "1938-12-26" },
  ),
  row(
    "de_gaulle",
    "FRA",
    [4, 2, 3, 2],
    ["panzer_leader"],
    "en.wikipedia Charles de Gaulle during World War II + TracesOfWar: temporary général de brigade effective 1940-06-01",
    { from: "1940-06-01" },
  ),
  row(
    "billotte",
    "FRA",
    [2, 3, 3, 3],
    [],
    "en.wikipedia Gaston Billotte: general 1927, Supreme War Council from 1933 (Who's Who in WWII)",
  ),
  row(
    "pretelat",
    "FRA",
    [2, 4, 2, 3],
    ["defensive_doctrine"],
    "en.wikipedia André-Gaston Prételat: commanded 1st Division 1927-30, then XI Military Region (generals.dk index)",
  ),
  row(
    "blanchard",
    "FRA",
    [2, 3, 2, 3],
    [],
    "en.wikipedia Georges Maurice Jean Blanchard: general 1932 (imagesdefense.gouv.fr portrait)",
  ),
  row(
    "prioux",
    "FRA",
    [3, 2, 2, 2],
    ["cavalry_officer"],
    "fr.wikipedia René Prioux: général de brigade 1932-08-12, Director of Cavalry 1936-02-01 + en.wikipedia (Cavalry Corps 1940); never tried",
  ),
  row(
    "delattre",
    "FRA",
    [4, 4, 3, 3],
    [],
    "en.wikipedia Jean de Lattre de Tassigny + Chemins de mémoire: général de brigade 1939-03-23 (fr.wikipedia: 22 March)",
    { from: "1939-03-23" },
  ),
  row(
    "leclerc",
    "FRA",
    [4, 2, 3, 2],
    ["panzer_leader", "desert_fox"],
    "en.wikipedia Philippe Leclerc de Hauteclocque + fr.wikipedia, generals.dk, valka.cz: provisional général de brigade 1941-08-10",
    { from: "1941-08-10" },
  ),
  row(
    "catroux",
    "FRA",
    [2, 3, 3, 3],
    [],
    "en.wikipedia Georges Catroux + fr.wikipedia: general's command at Marrakech 1931-34, troops in Algeria from October 1936",
  ),

  // ---- United States ----
  row(
    "macarthur",
    "USA",
    [3, 3, 3, 2],
    [],
    "en.wikipedia Douglas MacArthur + generals.dk: major general 1925-01-17, military advisor to the Philippines from 1935",
  ),
  row(
    "krueger",
    "USA",
    [3, 3, 4, 3],
    [],
    "en.wikipedia Walter Krueger (temporary brigadier general October 1936) + Krueger's 1957 interview (Marshall Foundation: made brigadier the same day as Marshall, 1936-10-01); the article's table says 1936-05-01",
    { from: "1936-10-01" },
  ),
  row(
    "patton",
    "USA",
    [5, 2, 3, 3],
    ["panzer_leader"],
    "en.wikipedia George S. Patton + historyonthenet timeline: temporary brigadier general 1940-10-02",
    { from: "1940-10-02" },
  ),
  row(
    "bradley",
    "USA",
    [3, 4, 4, 4],
    [],
    "en.wikipedia Omar Bradley + military.com: temporary brigadier general 1941-02-20 (Infantry School)",
    { from: "1941-02-20" },
  ),
  row(
    "eisenhower",
    "USA",
    [2, 3, 4, 5],
    ["logistics_wizard"],
    "en.wikipedia Dwight D. Eisenhower (brigadier general 1941-10-03) + generals.dk: brigadier general 1941-09-29 (date of rank)",
    { from: "1941-09-29" },
  ),
  row(
    "drum",
    "USA",
    [2, 3, 3, 3],
    [],
    "en.wikipedia Hugh A. Drum: major general 1931-12-01, Hawaiian Department 1935-37",
  ),
  row(
    "stilwell",
    "USA",
    [3, 3, 3, 2],
    [],
    "en.wikipedia Joseph Stilwell + generals.dk and TracesOfWar: brigadier general 1939-07-01",
    { from: "1939-07-01" },
  ),
  row(
    "clark",
    "USA",
    [3, 2, 3, 3],
    [],
    "en.wikipedia Mark W. Clark + Military Wiki: temporary brigadier general 1941-08-04 (generals.dk: 08-05)",
    { from: "1941-08-04" },
  ),
  row(
    "hodges",
    "USA",
    [2, 4, 3, 3],
    ["infantry_officer"],
    "en.wikipedia Courtney Hodges + Together We Served and Warfare History Network: brigadier general May 1940 (generals.dk: 1940-04-01); first of the month",
    { from: "1940-05-01" },
  ),
  row(
    "simpson",
    "USA",
    [3, 3, 3, 3],
    [],
    "en.wikipedia William Hood Simpson + generals.dk and valka.cz: brigadier general 1940-10-01",
    { from: "1940-10-01" },
  ),
  row(
    "devers",
    "USA",
    [3, 3, 3, 4],
    [],
    "en.wikipedia Jacob L. Devers + generals.dk and TracesOfWar: brigadier general 1940-05-01",
    { from: "1940-05-01" },
  ),
  row(
    "eichelberger",
    "USA",
    [3, 4, 3, 3],
    [],
    "en.wikipedia Robert L. Eichelberger + generals.dk and historyofwar.org: brigadier general 1940-10-01",
    { from: "1940-10-01" },
  ),

  // ---- Italy ----
  row(
    "badoglio",
    "ITA",
    [2, 3, 4, 3],
    [],
    "en.wikipedia Pietro Badoglio: Marshal of Italy 1926, commander in Ethiopia 1935-36; never tried",
  ),
  row(
    "graziani",
    "ITA",
    [2, 3, 2, 2],
    [],
    "en.wikipedia Rodolfo Graziani: southern front in Ethiopia 1935-36; his 1950 sentence was for collaboration, never a war-crimes court (spec §6.2 keeps him)",
  ),
  row(
    "messe",
    "ITA",
    [4, 4, 3, 3],
    [],
    "en.wikipedia Giovanni Messe (brigadier general, September 1935) + generals.dk (1936-01-01) and it.wikipedia",
  ),
  row(
    "bastico",
    "ITA",
    [2, 3, 2, 3],
    [],
    "en.wikipedia Ettore Bastico + generals.dk: generale di brigata 1928-06-03; it.wikipedia: never tried",
  ),
  row(
    "guzzoni",
    "ITA",
    [2, 3, 2, 2],
    [],
    "en.wikipedia Alfredo Guzzoni + generals.dk: generale di brigata 1930-01-13; tried by the RSI as a traitor (it.wikipedia)",
  ),
  row(
    "gariboldi",
    "ITA",
    [2, 3, 2, 2],
    [],
    "en.wikipedia Italo Gariboldi + it.wikipedia and generals.dk: generale di brigata 1931-09-15; the RSI's 1944 sentence was political",
  ),
  row(
    "bergonzoli",
    "ITA",
    [3, 2, 2, 2],
    [],
    "en.wikipedia Annibale Bergonzoli + it.wikipedia and generals.dk: generale di brigata 1935-04-12; never tried",
  ),
  row(
    "pintor",
    "ITA",
    [2, 3, 3, 3],
    [],
    "en.wikipedia Pietro Pintor + it.wikipedia and generals.dk: generale di brigata 1928-08-17, generale di divisione 1932-10-29",
  ),
  row(
    "caracciolo",
    "ITA",
    [2, 3, 2, 2],
    ["cavalry_officer"],
    "en.wikipedia Mario Caracciolo di Feroleto + it.wikipedia: generale di divisione, 1st Celere Division 1935-36; the RSI's sentence was political",
  ),
  row(
    "visconti_prasca",
    "ITA",
    [3, 2, 2, 2],
    [],
    "en.wikipedia Sebastiano Visconti Prasca + it.wikipedia and generals.dk: generale di brigata 1934-10-18 (it.wikipedia: January 1935); sentenced by the Germans for resistance",
  ),
  row(
    "soddu",
    "ITA",
    [2, 2, 2, 3],
    [],
    "en.wikipedia Ubaldo Soddu + it.wikipedia and generals.dk: generale di brigata 1934-03-12; never tried",
  ),
  row(
    "vercellino",
    "ITA",
    [2, 3, 2, 2],
    ["mountaineer"],
    "en.wikipedia Mario Vercellino + generals.dk: generale di brigata 1930-07-31; it.wikipedia: Superga Division 1934, Turin corps 1935-40",
  ),

  // ---- Japan (spec §6.2 principle checked for each) ----
  row(
    "kuribayashi",
    "JPN",
    [2, 5, 3, 3],
    ["defensive_doctrine"],
    "en.wikipedia Tadamichi Kuribayashi + ja.wikipedia: shōshō 1940-03-09 (TracesOfWar: March 1940); no Korea/Taiwan post, never tried",
    { from: "1940-03-09" },
  ),
  row(
    "anami",
    "JPN",
    [3, 3, 2, 2],
    [],
    "en.wikipedia Korechika Anami (major general March 1935) + ja.wikipedia: shōshō 1935-03-15; no Korea/Taiwan post, never charged",
  ),
  row(
    "nishio",
    "JPN",
    [3, 3, 3, 2],
    [],
    "en.wikipedia Toshizō Nishio + ja.wikipedia: chūjō 1933-08-01, Kwantung Army chief of staff 1934-36; held as a Class-A suspect, not indicted, released 1948",
  ),
  row(
    "kawabe",
    "JPN",
    [3, 2, 2, 2],
    [],
    "en.wikipedia Masakazu Kawabe (major general 1936) + ja.wikipedia: shōshō 1936-03-07; held as a suspect 1945-47, never tried",
    { from: "1936-03-07" },
  ),
  row(
    "higuchi",
    "JPN",
    [2, 4, 3, 2],
    ["winter_specialist"],
    "en.wikipedia Kiichiro Higuchi (major general by 1937) + ja.wikipedia: shōshō 1937-08-02; a staff officer, not a commander, of the Korea Army in 1923; never tried",
    { from: "1937-08-02" },
  ),

  // ---- Poland ----
  row(
    "rydz_smigly",
    "POL",
    [2, 3, 2, 2],
    [],
    "en.wikipedia Edward Rydz-Śmigły + pl.wikipedia: Inspector General of the Armed Forces from 1935-05-12, Marshal 1936-11-10",
  ),
  row(
    "sosnkowski",
    "POL",
    [3, 4, 3, 3],
    [],
    "en.wikipedia Kazimierz Sosnkowski + pl.wikipedia: generał dywizji 1922 (seniority 1919)",
  ),
  row(
    "kutrzeba",
    "POL",
    [3, 3, 4, 2],
    [],
    "en.wikipedia Tadeusz Kutrzeba + pl.wikipedia: generał brygady 1927-03-16, commandant of the War College from 1928",
  ),
  row(
    "anders",
    "POL",
    [4, 2, 2, 2],
    ["cavalry_officer"],
    "en.wikipedia Władysław Anders + pl.wikipedia: generał brygady 1934-01-01, Nowogródek Cavalry Brigade",
  ),
  row(
    "maczek",
    "POL",
    [4, 3, 3, 2],
    ["panzer_leader"],
    "en.wikipedia Stanisław Maczek + pl.wikipedia: generał brygady 1939-11-15",
    { from: "1939-11-15" },
  ),

  // ---- Finland ----
  row(
    "mannerheim",
    "FIN",
    [3, 5, 4, 3],
    ["defensive_doctrine"],
    "en.wikipedia Carl Gustaf Emil Mannerheim + fi.wikipedia: field marshal 1933, chairman of the Defence Council 1931-39",
  ),
  row(
    "osterman",
    "FIN",
    [2, 3, 2, 2],
    [],
    "en.wikipedia Hugo Österman + fi.wikipedia: kenraalimajuri 1930-07-10, commander of the army from 1933-01-12",
  ),
  row(
    "heinrichs",
    "FIN",
    [2, 3, 4, 3],
    [],
    "en.wikipedia Erik Heinrichs + fi.wikipedia: kenraalimajuri 1933-05-16, 1st Division 1931-38",
  ),
  row(
    "siilasvuo",
    "FIN",
    [4, 3, 2, 2],
    ["winter_specialist"],
    "en.wikipedia Hjalmar Siilasvuo + fi.wikipedia: kenraalimajuri 1940-04-08",
    { from: "1940-04-08" },
  ),

  // ---- China (Nationalist government) ----
  row(
    "chen_cheng",
    "CHN",
    [3, 3, 3, 3],
    [],
    "en.wikipedia Chen Cheng + generals.dk: lieutenant general 1935-04-04",
  ),
  row(
    "xue_yue",
    "CHN",
    [4, 4, 3, 2],
    ["defensive_doctrine"],
    "en.wikipedia Xue Yue + generals.dk: lieutenant general 1935-04-05",
  ),
  row(
    "he_yingqin",
    "CHN",
    [2, 3, 3, 3],
    [],
    "en.wikipedia He Yingqin + generals.dk: general 1st rank 1935-04-02, minister of war 1930-44",
  ),
  row(
    "zhang_zhizhong",
    "CHN",
    [3, 2, 2, 2],
    [],
    "en.wikipedia Zhang Zhizhong + generals.dk: lieutenant general 1935-04-04",
  ),

  // ---- Chinese Communists (no ranks before 1955) ----
  row(
    "zhu_de",
    "CCP",
    [3, 3, 4, 3],
    [],
    "en.wikipedia Zhu De: commander-in-chief of the Red Army through the Long March",
  ),
  row(
    "liu_bocheng",
    "CCP",
    [4, 3, 4, 2],
    [],
    "en.wikipedia Liu Bocheng: chief of staff on the Long March, 129th Division 1937",
  ),
  row(
    "he_long",
    "CCP",
    [3, 3, 2, 2],
    [],
    "en.wikipedia He Long: 2nd Front Army 1935-36, 120th Division 1937",
  ),
  row(
    "lin_biao",
    "CCP",
    [5, 2, 3, 2],
    [],
    "en.wikipedia Lin Biao: 1st Red Army Corps on the Long March, 115th Division (Pingxingguan) 1937",
  ),

  // ---- Nationalist Spain ----
  row(
    "franco",
    "ESN",
    [3, 3, 4, 3],
    [],
    "en.wikipedia Francisco Franco + es.wikipedia: general since 1926, chief of the central general staff 1935",
  ),
  row(
    "mola",
    "ESN",
    [3, 3, 3, 2],
    [],
    "en.wikipedia Emilio Mola + es.wikipedia: general de brigada 1927, commander in Morocco 1935-11-03 to 1936-03-01",
  ),
  row(
    "varela",
    "ESN",
    [4, 2, 2, 2],
    [],
    "en.wikipedia José Enrique Varela + es.wikipedia: general de brigada 1935-10-31",
  ),

  // ---- Republican Spain ----
  row(
    "miaja",
    "ESR",
    [2, 4, 2, 2],
    ["defensive_doctrine"],
    "en.wikipedia José Miaja + es.wikipedia: general de brigada August 1932",
  ),
  row(
    "pozas",
    "ESR",
    [2, 3, 2, 2],
    [],
    "en.wikipedia Sebastián Pozas + es.wikipedia: general 1926, inspector general of the Civil Guard from 1936-01-08",
  ),

  // ---- Romania ----
  row(
    "sanatescu",
    "ROU",
    [2, 3, 3, 2],
    ["cavalry_officer"],
    "en.wikipedia Constantin Sănătescu: brigadier general 1935-10-16, 3rd Cavalry Brigade 1935; never tried",
  ),
  row(
    "avramescu",
    "ROU",
    [3, 3, 2, 2],
    ["mountaineer"],
    "en.wikipedia Gheorghe Avramescu: brigadier general 1935, 1st Mountain Division; died in Soviet custody 1945, never tried",
  ),

  // ---- Yugoslavia ----
  row(
    "simovic",
    "YUG",
    [2, 3, 3, 2],
    [],
    "en.wikipedia Dušan Simović + valka.cz (Bjelajac): brigadni general 1925, divizijski general 1930-09-06; air force commander from 1936",
  ),
  row(
    "kosic",
    "YUG",
    [2, 3, 2, 2],
    [],
    "en.wikipedia Petar Kosić + valka.cz (Bjelajac): divizijski general 1930-09-06, first deputy chief of the General Staff 1930-36",
  ),

  // ---- Greece ----
  row(
    "papagos",
    "GRC",
    [3, 4, 4, 3],
    ["mountaineer"],
    "en.wikipedia Alexandros Papagos: major general 1930, minister for military affairs 1935-36; held by the Germans 1943-45",
  ),
  row(
    "pitsikas",
    "GRC",
    [2, 4, 2, 2],
    [],
    "en.wikipedia Ioannis Pitsikas: lieutenant general after the 6th Division (to 1935), I Army Corps to 1940; held at Dachau",
  ),

  // ---- Turkey ----
  row(
    "cakmak",
    "TUR",
    [3, 4, 4, 3],
    [],
    "en.wikipedia Fevzi Çakmak: Marshal 1922, Chief of the General Staff 1921-44",
  ),
  row(
    "orbay",
    "TUR",
    [2, 3, 3, 2],
    [],
    "en.wikipedia Kâzım Orbay + Atatürk Ansiklopedisi: orgeneral 1935-08-30, 3rd Army Inspector from 1935-08-24",
  ),
  row(
    "altay",
    "TUR",
    [3, 3, 2, 2],
    ["cavalry_officer"],
    "en.wikipedia Fahrettin Altay + MSB biography: orgeneral, 1st Army Inspector from 1933; cavalry corps commander in 1922",
  ),

  // ---- Hungary ----
  row(
    "nagy",
    "HUN",
    [2, 3, 3, 3],
    [],
    "en.wikipedia Vilmos Nagy de Nagybaczon + hu.wikipedia: vezérőrnagy 1934-05-01; held by the Arrow Cross regime 1944-45",
  ),
  row(
    "sonyi",
    "HUN",
    [2, 3, 2, 2],
    [],
    "en.wikipedia Hugó Sónyi + hu.wikipedia: tábornok 1927-11-01, commander-in-chief of the Honvéd 1936-09 to 1940-03",
  ),
];

export function traitMask(traits: readonly GeneralTrait[]): number {
  let m = 0;
  for (const t of traits) m |= traitBit(t);
  return m;
}

/** GENERALS ids of a country, by skill sum descending then id. */
export function rosterOf(tag: CountryTag): number[] {
  const out: number[] = [];
  GENERALS.forEach((g, i) => {
    if (g.tag === tag) out.push(i + 1);
  });
  const sum = (id: number) => {
    const g = GENERALS[id - 1];
    return g.att + g.def + g.plan + g.log;
  };
  return out.sort((a, b) => sum(b) - sum(a) || a - b);
}

/** Spec §6.2: whether the general can serve on `day`. */
export function generalServes(g: GeneralDef, day: number): boolean {
  if (g.from !== undefined && day < dayOfDate(g.from)) return false;
  if (g.until !== undefined && day >= dayOfDate(g.until)) return false;
  for (const [a, b] of g.gaps ?? []) {
    if (day >= dayOfDate(a) && day < dayOfDate(b)) return false;
  }
  return true;
}

/**
 * A titled general's id (plan decision 17, pre-flight U21): the title
 * number in the thousands, the country below, so no count of titles makes
 * two countries' ids meet (smallIDs stay below 1000).
 */
export function titledGeneralId(smallID: number, titleNo: number): number {
  return WW_TITLED_GENERAL_BASE + titleNo * 1000 + smallID;
}

/** Whether a general id is a titled general's (not a GENERALS index + 1). */
export function isTitledGeneral(id: number): boolean {
  return id >= WW_TITLED_GENERAL_BASE;
}

/** The title number of a titled general's id ("Commander No. n"); 0 for a named one. */
export function titleNoOfGeneral(id: number): number {
  return isTitledGeneral(id)
    ? Math.floor((id - WW_TITLED_GENERAL_BASE) / 1000)
    : 0;
}
