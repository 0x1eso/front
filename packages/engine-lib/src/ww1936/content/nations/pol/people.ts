// ww229: Poland's people. Leaders for every ideology (Mościcki is the P0
// leader_pol and Witos the P3 pol_witos, both already in persons/leaders.ts)
// and the advisors of the ruling camp. A person with an ideology is an
// advisor only under that ideology, so the camp's ministers have none.
// Dates: `from` inclusive, `until` exclusive. Data only.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const POL_PERSONS: PersonDef[] = [
  // ---- non-aligned: the ruling camp ----
  {
    id: "pol_rydz",
    nameKey: "ww1936.person.pol_rydz",
    country: "POL",
    roles: ["leader", "advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    leaderTraits: ["generalissimo"],
    alsoGeneral: "rydz_smigly",
    source:
      "Inspector General of the Armed Forces from 1935, Marshal of Poland from 1936: en.wikipedia Edward Rydz-Śmigły; pl.wikipedia",
  },
  {
    id: "pol_skladkowski",
    nameKey: "ww1936.person.pol_skladkowski",
    country: "POL",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    leaderTraits: ["caretaker"],
    until: "1939-09-30",
    source:
      "Prime Minister 1936-05-15 to 1939-09-30 and Minister of the Interior: en.wikipedia Felicjan Sławoj Składkowski",
  },
  {
    id: "pol_beck",
    nameKey: "ww1936.person.pol_beck",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    until: "1939-09-30",
    source:
      "Minister of Foreign Affairs 1932-11-02 to 1939-09-30: en.wikipedia Józef Beck; Britannica",
  },
  {
    id: "pol_kwiatkowski",
    nameKey: "ww1936.person.pol_kwiatkowski",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_construction"] },
    until: "1939-09-30",
    source:
      "Deputy Prime Minister and Minister of the Treasury 1935-1939, the father of Gdynia and the Central Industrial District: en.wikipedia Eugeniusz Kwiatkowski",
  },
  {
    id: "pol_koc",
    nameKey: "ww1936.person.pol_koc",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    from: "1937-02-21",
    source:
      "Colonel, first leader of the Camp of National Unity (OZN) 1937-1938: en.wikipedia Adam Koc; pl.wikipedia Obóz Zjednoczenia Narodowego",
  },
  {
    id: "pol_starzynski",
    nameKey: "ww1936.person.pol_starzynski",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["orator"] },
    until: "1939-10-27",
    source:
      "Mayor of Warsaw 1934-1939, civil commissioner of the defence of Warsaw, arrested in October 1939: en.wikipedia Stefan Starzyński",
  },
  {
    id: "pol_stachiewicz",
    nameKey: "ww1936.person.pol_stachiewicz",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    until: "1939-09-30",
    source:
      "Chief of the General Staff 1935-1939: en.wikipedia Wacław Stachiewicz; pl.wikipedia",
  },
  {
    id: "pol_kutrzeba_staff",
    nameKey: "ww1936.person.pol_kutrzeba_staff",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["theorist_land"] },
    alsoGeneral: "kutrzeba",
    source:
      "Commandant of the War College from 1928, author of the 1938 study of a war with Germany: en.wikipedia Tadeusz Kutrzeba; pl.wikipedia",
  },
  {
    id: "pol_sosnkowski",
    nameKey: "ww1936.person.pol_sosnkowski",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    alsoGeneral: "sosnkowski",
    source:
      "Army Inspector in the 1930s, later Commander-in-Chief in exile 1943-1944: en.wikipedia Kazimierz Sosnkowski",
  },
  {
    id: "pol_rayski",
    nameKey: "ww1936.person.pol_rayski",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    source:
      "Head of the Aviation Department of the Ministry of Military Affairs 1926-1939: en.wikipedia Ludomił Rayski; pl.wikipedia",
  },
  {
    id: "pol_swirski",
    nameKey: "ww1936.person.pol_swirski",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    source:
      "Head of the Navy (Kierownictwo Marynarki Wojennej) 1925-1947, vice-admiral: en.wikipedia Jerzy Świrski",
  },
  {
    id: "pol_rejewski",
    nameKey: "ww1936.person.pol_rejewski",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    locked: true,
    source:
      "Mathematician of the Cipher Bureau from 1932, broke the Enigma machine and designed the cryptologic bomb: en.wikipedia Marian Rejewski",
  },
  {
    id: "pol_dabrowski",
    nameKey: "ww1936.person.pol_dabrowski",
    country: "POL",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_aircraft"] },
    source:
      "Aircraft designer at PZL, designer of the PZL.37 Łoś: en.wikipedia Jerzy Dąbrowski (engineer)",
  },

  // ---- democratic: the Morges Front and the peasants ----
  {
    id: "pol_sikorski",
    nameKey: "ww1936.person.pol_sikorski",
    country: "POL",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["war_leader"],
    until: "1943-07-04",
    source:
      "Co-founder of the Morges Front 1936, Prime Minister in exile 1939-1943, died at Gibraltar 1943-07-04: en.wikipedia Władysław Sikorski",
  },
  {
    id: "pol_paderewski",
    nameKey: "ww1936.person.pol_paderewski",
    country: "POL",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["peace_negotiator"],
    until: "1941-06-29",
    source:
      "Pianist and Prime Minister of 1919, patron of the Morges Front 1936, died 1941-06-29: en.wikipedia Ignacy Jan Paderewski",
  },
  {
    id: "pol_mikolajczyk",
    nameKey: "ww1936.person.pol_mikolajczyk",
    country: "POL",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["reformer"],
    source:
      "Peasant Party leader, Prime Minister in exile 1943-1944: en.wikipedia Stanisław Mikołajczyk",
  },

  // ---- communist ----
  {
    id: "pol_gomulka",
    nameKey: "ww1936.person.pol_gomulka",
    country: "POL",
    roles: ["leader"],
    ideology: "communist",
    leaderTraits: ["party_boss"],
    source:
      "Communist Party of Poland organiser, imprisoned 1936-1939, secretary of the Polish Workers' Party from 1943: en.wikipedia Władysław Gomułka",
  },
  {
    id: "pol_bierut",
    nameKey: "ww1936.person.pol_bierut",
    country: "POL",
    roles: ["leader"],
    ideology: "communist",
    leaderTraits: ["party_boss"],
    source:
      "Comintern agent and Communist Party of Poland member, imprisoned 1933-1938, chairman of the State National Council 1944: en.wikipedia Bolesław Bierut",
  },

  // ---- fascist: the national radicals ----
  {
    id: "pol_piasecki",
    nameKey: "ww1936.person.pol_piasecki",
    country: "POL",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["strongman"],
    source:
      "Leader of the National Radical Movement Falanga from 1935: en.wikipedia Bolesław Piasecki",
  },
  {
    id: "pol_mosdorf",
    nameKey: "ww1936.person.pol_mosdorf",
    country: "POL",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["party_boss"],
    until: "1943-10-11",
    source:
      "Co-founder and leader of the National Radical Camp 1934, died at Auschwitz in 1943: en.wikipedia Jan Mosdorf",
  },
];
