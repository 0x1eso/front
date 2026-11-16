// ww229: Romania's people: leaders for every ideology (2-3 each, with the
// row's Carol II, Maniu and the Conducător) and the advisors. Dates are kept
// only where they are certain (a death, an assassination, a dismissal).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ROU_PERSONS: PersonDef[] = [
  // ---- leaders and advisors: neutral (the Crown's governments) ----
  {
    id: "rou_tatarescu",
    nameKey: "ww1936.person.rou_tatarescu",
    country: "ROU",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "political", traits: ["administrator"] },
    source:
      "en.wikipedia Gheorghe Tătărescu: National Liberal, Prime Minister 1934-1937 and 1939-1940",
  },
  {
    id: "rou_calinescu",
    nameKey: "ww1936.person.rou_calinescu",
    country: "ROU",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "political", traits: ["security_chief"] },
    until: "1939-09-21",
    source:
      "en.wikipedia Armand Călinescu: Interior Minister 1937-1939, Prime Minister 1939, killed by Legionaries 1939-09-21",
  },
  // ---- democratic ----
  {
    id: "rou_mihalache",
    nameKey: "ww1936.person.rou_mihalache",
    country: "ROU",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Ion Mihalache: co-founder and president of the National Peasants' Party 1933-1937",
  },
  {
    id: "rou_dinu_bratianu",
    nameKey: "ww1936.person.rou_dinu_bratianu",
    country: "ROU",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Constantin I. C. Brătianu: president of the National Liberal Party 1934-1947, in opposition to the royal dictatorship",
  },
  // ---- fascist ----
  {
    id: "rou_codreanu",
    nameKey: "ww1936.person.rou_codreanu",
    country: "ROU",
    roles: ["leader"],
    ideology: "fascist",
    until: "1938-11-30",
    source:
      "en.wikipedia Corneliu Zelea Codreanu: founder and leader of the Legion of the Archangel Michael, killed in custody 1938-11-30",
  },
  {
    id: "rou_sima",
    nameKey: "ww1936.person.rou_sima",
    country: "ROU",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Horia Sima: leader of the Iron Guard from 1938, Deputy Prime Minister of the National Legionary State 1940-1941",
  },
  {
    id: "rou_goga",
    nameKey: "ww1936.person.rou_goga",
    country: "ROU",
    roles: ["leader"],
    ideology: "fascist",
    until: "1938-05-07",
    source:
      "en.wikipedia Octavian Goga: poet, National Christian Party, Prime Minister 1937-1938, died 1938-05-07",
  },
  // ---- communist ----
  {
    id: "rou_patrascanu",
    nameKey: "ww1936.person.rou_patrascanu",
    country: "ROU",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Lucrețiu Pătrășcanu: lawyer and leading member of the banned Romanian Communist Party; in the 1944 coup",
  },
  {
    id: "rou_gheorghiu_dej",
    nameKey: "ww1936.person.rou_gheorghiu_dej",
    country: "ROU",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Gheorghe Gheorghiu-Dej: railway worker, jailed after the Grivița strike of 1933, party leader from 1944",
  },
  {
    id: "rou_pauker",
    nameKey: "ww1936.person.rou_pauker",
    country: "ROU",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Ana Pauker: Romanian Communist Party leader, tried 1936, exchanged to the Soviet Union 1941",
  },
  // ---- advisors ----
  {
    id: "rou_titulescu",
    nameKey: "ww1936.person.rou_titulescu",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    until: "1936-08-29",
    source:
      "en.wikipedia Nicolae Titulescu: Foreign Minister 1932-1936, League of Nations president twice, dismissed 1936-08-29",
  },
  {
    id: "rou_gafencu",
    nameKey: "ww1936.person.rou_gafencu",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["peace_negotiator"] },
    source:
      "en.wikipedia Grigore Gafencu: Foreign Minister 1938-1940, envoy to Moscow 1940-1941",
  },
  {
    id: "rou_mihai_antonescu",
    nameKey: "ww1936.person.rou_mihai_antonescu",
    country: "ROU",
    roles: ["advisor"],
    ideology: "fascist",
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "en.wikipedia Mihai Antonescu: Deputy Prime Minister and Foreign Minister 1941-1944",
  },
  {
    id: "rou_manoilescu",
    nameKey: "ww1936.person.rou_manoilescu",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_construction"] },
    source:
      "en.wikipedia Mihail Manoilescu: economist of protection for new industry, Minister of Industry 1931, Foreign Minister 1940",
  },
  {
    id: "rou_malaxa",
    nameKey: "ww1936.person.rou_malaxa",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "en.wikipedia Nicolae Malaxa: industrialist, the Malaxa works in Bucharest (locomotives, tubes, arms)",
  },
  {
    id: "rou_gigurtu",
    nameKey: "ww1936.person.rou_gigurtu",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "en.wikipedia Ion Gigurtu: mining engineer and industrialist, Minister of Industry 1937-1938, Prime Minister 1940",
  },
  {
    id: "rou_carafoli",
    nameKey: "ww1936.person.rou_carafoli",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_aircraft"] },
    source:
      "en.wikipedia Elie Carafoli: aerodynamicist, professor at the Bucharest Polytechnic, designer at IAR (IAR CV 11)",
  },
  {
    id: "rou_samsonovici",
    nameKey: "ww1936.person.rou_samsonovici",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    source:
      "en.wikipedia Nicolae Samsonovici: Chief of the General Staff 1934-1937, Minister of War 1933",
  },
  {
    id: "rou_steflea",
    nameKey: "ww1936.person.rou_steflea",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_logistics"] },
    source: "en.wikipedia Ilie Șteflea: Chief of the General Staff 1942-1944",
  },
  {
    id: "rou_jienescu",
    nameKey: "ww1936.person.rou_jienescu",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_ground"] },
    source:
      "en.wikipedia Gheorghe Jienescu: Under-Secretary of State for the Air 1941-1944",
  },
  {
    id: "rou_macellariu",
    nameKey: "ww1936.person.rou_macellariu",
    country: "ROU",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    source:
      "en.wikipedia Horia Macellariu: commander of the Romanian Black Sea fleet 1943-1944, the Crimea evacuation",
  },
];
