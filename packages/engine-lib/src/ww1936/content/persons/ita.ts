// World War 1936 P5 — Italian advisors (spec §19.5). Dates: `from` inclusive,
// `until` exclusive (the day the person leaves the office). Every line names
// its sources and the result of the spec §8.4 check (P3 spec): no conviction
// by Nuremberg, Tokyo, a later trial or a national war-crimes court, no
// security-police chief, no leader of mass killings, forced removals or
// purge trials (tried or not). Where that is in doubt the office is shown
// by its title, as spec §19.5 asks:
// - The Minister of National Education 1936-11 to 1943-02 (Giuseppe Bottai:
//   he enforced the 1938 racial laws in the schools) is a title card below.
// - The Chief of the Supreme Command 1940-12 to 1943-02 (Ugo Cavallero: the
//   April 1939 gas operation at the Gaia Zeret caves in Ethiopia was carried
//   out on his order as commander in Italian East Africa — en.wikipedia
//   "Gaia Zeret", it.wikipedia "Ugo Cavallero") and from 1943-02 (Vittorio
//   Ambrosio: wanted by Yugoslavia on the 1947 CROWCASS list, never tried —
//   it.wikipedia "Vittorio Ambrosio") are title cards below.
// - The marshal the King made head of government in 1943 (Pietro Badoglio:
//   as governor of Libya he ordered the 1930 removal of the Jebel Akhdar
//   population into camps, and his extradition was sought by Ethiopia,
//   Yugoslavia and Greece; never tried — en.wikipedia "Pietro Badoglio",
//   "Italian war crimes") is the titled leader title:ita_military_premier
//   (events/ita.ts), not a person. The democratic leader is the title
//   title:ita_council_president.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PERSONS_ITA: PersonDef[] = [
  // ---- politics ----
  // source: Foreign Minister 1936-06-09 to 1943-02-05 (en.wikipedia "Galeazzo
  // Ciano"; Treccani Dizionario Biografico "CIANO, Galeazzo": 9 June 1936,
  // February 1943). Check: shot 1944-01-11 after the Italian Social
  // Republic's Verona treason trial for his 25 July vote — not a war-crimes
  // court; never tried for war crimes.
  {
    id: "ita_ciano",
    nameKey: "ww1936.person.ita_ciano",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "fascist",
    from: "1936-06-09",
    until: "1943-02-05",
    source:
      "Foreign Minister 1936-06-09..1943-02-05: en.wikipedia Galeazzo Ciano; Treccani DBI; Verona treason trial 1944 (RSI), no war-crimes trial",
  },
  // source: ambassador in London to 1939, Minister of Justice 1939-07-12 to
  // 1943-02-06, President of the Chamber of Fasces and Corporations
  // 1939-11-30 to 1943-08-02; his motion carried the Grand Council on
  // 1943-07-25 (it.wikipedia "Dino Grandi"; en.wikipedia "Dino Grandi").
  // Check: death sentence in absentia at Verona (1944, RSI); tried in 1947
  // as a former Fascist official and acquitted.
  {
    id: "ita_grandi",
    nameKey: "ww1936.person.ita_grandi",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    ideology: "fascist",
    from: "1939-07-12",
    until: "1943-07-25",
    source:
      "Justice Minister 1939-07-12, Chamber president to 1943-08: it/en.wikipedia Dino Grandi; acquitted 1947",
  },
  // source: Governor-General of Libya 1934-01-01 until his death over Tobruk
  // on 1940-06-28 (en.wikipedia "Italo Balbo"; Britannica "Italo Balbo").
  // Check: died in 1940; never tried by a war-crimes court.
  {
    id: "ita_balbo",
    nameKey: "ww1936.person.ita_balbo",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["orator"] },
    ideology: "fascist",
    until: "1940-06-28",
    source:
      "Governor-General of Libya 1934-01-01..1940-06-28 (killed over Tobruk): en.wikipedia Italo Balbo; Britannica",
  },
  // Title card for Giuseppe Bottai (see the header): Minister of National
  // Education 1936-11-15 to 1943-02-05 (en.wikipedia "Giuseppe Bottai";
  // it.wikipedia "Giuseppe Bottai", which gives 6 February for the end). He
  // carried out the 1938 racial laws in the schools, so the office is shown by
  // its title (doubt resolves to a title card, spec §19.5).
  {
    id: "title_ita_education_minister",
    nameKey: "ww1936.title.ita_education_minister",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    ideology: "fascist",
    until: "1943-02-05",
    source:
      "title card (spec §19.5): Minister of National Education 1936-11-15..1943-02-05, en/it.wikipedia Giuseppe Bottai; enforced the 1938 racial laws in schools",
  },
  // ---- army chief ----
  // source: Chief of Staff of the Army and Under-Secretary for War
  // 1936-10-07 to 1939-11-03 (en.wikipedia "Chief of Staff of the Italian
  // Army"; it.wikipedia "Alberto Pariani"). Check: arrested after the war
  // for Fascist crimes and acquitted in 1947.
  {
    id: "ita_pariani",
    nameKey: "ww1936.person.ita_pariani",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    from: "1936-10-07",
    until: "1939-11-03",
    source:
      "Army Chief of Staff 1936-10-07..1939-11-03: en.wikipedia Chief of Staff of the Italian Army; it.wikipedia Alberto Pariani; acquitted 1947",
  },
  // Title card for Ugo Cavallero (see the header): Chief of the Supreme
  // General Staff / Comando Supremo 1940-12-05 to 1943-02-01 (en.wikipedia
  // "Chief of the Defence Staff (Italy)"; it.wikipedia "Ugo Cavallero").
  {
    id: "title_ita_supreme_command_1940",
    nameKey: "ww1936.title.ita_supreme_command_chief",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_offense"] },
    from: "1940-12-05",
    until: "1943-02-01",
    source:
      "title card (spec §19.5): Comando Supremo 1940-12-05..1943-02-01, en.wikipedia Chief of the Defence Staff (Italy); it.wikipedia Ugo Cavallero",
  },
  // Title card for Vittorio Ambrosio (see the header): Chief of the Supreme
  // General Staff from 1943-02-01 (en.wikipedia "Chief of the Defence Staff
  // (Italy)"; it.wikipedia "Vittorio Ambrosio").
  {
    id: "title_ita_supreme_command_1943",
    nameKey: "ww1936.title.ita_supreme_command_chief",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    from: "1943-02-01",
    source:
      "title card (spec §19.5): Comando Supremo from 1943-02-01, en.wikipedia Chief of the Defence Staff (Italy); it.wikipedia Vittorio Ambrosio",
  },
  // ---- industry and research ----
  // source: Under-Secretary for Exchange and Currency 1936-01-02, Minister
  // for Exchange and Currency 1937-11-20 to 1939-10-31 (it.wikipedia
  // "Felice Guarneri"; en.wikipedia "Felice Guarneri"). Check: arrested
  // 1944-05-29 and released; cleared by the purge commission.
  {
    id: "ita_guarneri",
    nameKey: "ww1936.person.ita_guarneri",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    until: "1939-10-31",
    source:
      "Exchange and Currency 1936-01-02..1939-10-31: it/en.wikipedia Felice Guarneri; cleared by the purge commission",
  },
  // source: President of the National Research Council (CNR) 1927 and of
  // the Royal Academy of Italy 1930 until his death in Rome on 1937-07-20
  // (sibi.cnr.it "Marconi" slides; Accademia dei Lincei Archivio Marconi;
  // en.wikipedia "Guglielmo Marconi").
  {
    id: "ita_marconi",
    nameKey: "ww1936.person.ita_marconi",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    until: "1937-07-20",
    source:
      "CNR president 1927..1937-07-20 (death): sibi.cnr.it; Accademia dei Lincei; en.wikipedia Guglielmo Marconi",
  },
  // source: left Rome with his family on 1938-12-06 for the Nobel ceremony
  // in Stockholm and went on to New York (arrived 1939-01-02) (Atomic
  // Heritage Foundation timelines "Giulio Fermi", "Nella Fermi Weiner";
  // science.osti.gov "The Life of Enrico Fermi"). Opened by
  // ita_research_council.
  {
    id: "ita_fermi",
    nameKey: "ww1936.person.ita_fermi",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    until: "1938-12-06",
    source:
      "left Italy 1938-12-06 (Nobel, then the USA): Atomic Heritage Foundation; science.osti.gov The Life of Enrico Fermi",
  },
  // ---- navy chief ----
  // source: Under-Secretary of the Navy 1933-11-06 and Chief of Naval Staff
  // (from 1934) to 1940-12-08 (it.wikipedia "Domenico Cavagnari";
  // en.wikipedia "Chief of Staff of the Italian Navy"). Check: no trial.
  {
    id: "ita_cavagnari",
    nameKey: "ww1936.person.ita_cavagnari",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    until: "1940-12-08",
    source:
      "Chief of Naval Staff to 1940-12-08: it.wikipedia Domenico Cavagnari; en.wikipedia Chief of Staff of the Italian Navy",
  },
  // source: Chief of Naval Staff and Under-Secretary 1940-12-08 to
  // 1943-07-25 (it.wikipedia "Arturo Riccardi"; en.wikipedia "Arturo
  // Riccardi" gives 1940-12-11 for the start). Check: no trial.
  {
    id: "ita_riccardi",
    nameKey: "ww1936.person.ita_riccardi",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    from: "1940-12-08",
    until: "1943-07-25",
    source:
      "Chief of Naval Staff 1940-12-08..1943-07-25: it.wikipedia Arturo Riccardi; en.wikipedia (1940-12-11)",
  },
  // ---- air chief ----
  // source: Chief of Air Staff 1934-03-22 to 1939-11-10 (second term) and
  // Under-Secretary for Air to 1939-10-31 (en.wikipedia "Chief of Staff of
  // the Italian Air Force"; it.wikipedia "Giuseppe Valle"). Check: tried in
  // 1947 (illicit enrichment, the Fascist turn of the air force), acquitted.
  {
    id: "ita_valle",
    nameKey: "ww1936.person.ita_valle",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_bomber"] },
    until: "1939-11-10",
    source:
      "Chief of Air Staff to 1939-11-10: en.wikipedia Chief of Staff of the Italian Air Force; it.wikipedia Giuseppe Valle; acquitted 1947",
  },
  // source: Chief of Air Staff 1939-11-10 to 1941-11-15 (en.wikipedia "Chief
  // of Staff of the Italian Air Force"; it.wikipedia "Francesco Pricolo").
  // Check: no trial.
  {
    id: "ita_pricolo",
    nameKey: "ww1936.person.ita_pricolo",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    from: "1939-11-10",
    until: "1941-11-15",
    source:
      "Chief of Air Staff 1939-11-10..1941-11-15: en.wikipedia Chief of Staff of the Italian Air Force; it.wikipedia Francesco Pricolo",
  },
  // source: Chief of Air Staff 1941-11-15 to 1943-07-27 (en.wikipedia "Chief
  // of Staff of the Italian Air Force"; it.wikipedia "Rino Corso Fougier").
  // Check: no trial.
  {
    id: "ita_fougier",
    nameKey: "ww1936.person.ita_fougier",
    country: "ITA",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_ground"] },
    from: "1941-11-15",
    until: "1943-07-27",
    source:
      "Chief of Air Staff 1941-11-15..1943-07-27: en.wikipedia Chief of Staff of the Italian Air Force; it.wikipedia Rino Corso Fougier",
  },
];
