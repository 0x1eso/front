// ww229: Bulgaria's people: leaders for every ideology (2-3 each besides
// the row's Boris III) and the advisors. Dates are kept only where they are
// certain (a killing, the People's Court sentences of 1945-02-01).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const BGR_PERSONS: PersonDef[] = [
  // ---- neutral: the Tsar's governments and the Zveno officers ----
  {
    id: "bgr_kyoseivanov",
    nameKey: "ww1936.person.bgr_kyoseivanov",
    country: "BGR",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "en.wikipedia Georgi Kyoseivanov: Prime Minister 1935-1940 and his own Foreign Minister, the Tsar's man for the Balkan pacts",
  },
  {
    id: "bgr_filov",
    nameKey: "ww1936.person.bgr_filov",
    country: "BGR",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "political", traits: ["administrator"] },
    until: "1945-02-01",
    source:
      "en.wikipedia Bogdan Filov: archaeologist, Prime Minister 1940-1943, regent 1943-1944; sentenced by the People's Court 1945-02-01",
  },
  {
    id: "bgr_bagryanov",
    nameKey: "ww1936.person.bgr_bagryanov",
    country: "BGR",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "industry", traits: ["ind_resources"] },
    until: "1945-02-01",
    source:
      "en.wikipedia Ivan Bagryanov: Minister of Agriculture 1938-1941, Prime Minister in summer 1944; sentenced by the People's Court 1945-02-01",
  },
  {
    id: "bgr_kimon_georgiev",
    nameKey: "ww1936.person.bgr_kimon_georgiev",
    country: "BGR",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "en.wikipedia Kimon Georgiev: Zveno, Prime Minister after the coup of 1934 and again in the Fatherland Front government of 1944",
  },
  // ---- democratic ----
  {
    id: "bgr_mushanov",
    nameKey: "ww1936.person.bgr_mushanov",
    country: "BGR",
    roles: ["leader", "advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["conciliator"] },
    source:
      "en.wikipedia Nikola Mushanov: Democratic Party, Prime Minister 1931-1934, leader of the opposition in the partyless parliament",
  },
  {
    id: "bgr_petkov",
    nameKey: "ww1936.person.bgr_petkov",
    country: "BGR",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Nikola Petkov: leader of the Agrarian Union's Pladne wing, a founder of the Fatherland Front",
  },
  {
    id: "bgr_gichev",
    nameKey: "ww1936.person.bgr_gichev",
    country: "BGR",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Dimitar Gichev: leader of the Agrarian Union's Vrabcha 1 wing, in the opposition Five of the late 1930s",
  },
  // ---- communist ----
  {
    id: "bgr_dimitrov",
    nameKey: "ww1936.person.bgr_dimitrov",
    country: "BGR",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Georgi Dimitrov: acquitted at the Leipzig trial, General Secretary of the Comintern 1935-1943 in Moscow",
  },
  {
    id: "bgr_kolarov",
    nameKey: "ww1936.person.bgr_kolarov",
    country: "BGR",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Vasil Kolarov: Comintern secretary, in Moscow through the war, later head of the provisional presidency",
  },
  {
    id: "bgr_kostov",
    nameKey: "ww1936.person.bgr_kostov",
    country: "BGR",
    roles: ["leader", "advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["party_ideologue"] },
    source:
      "en.wikipedia Traicho Kostov: secretary of the underground Workers' Party at home in the 1940s, jailed 1942-1944",
  },
  // ---- fascist ----
  {
    id: "bgr_lukov",
    nameKey: "ww1936.person.bgr_lukov",
    country: "BGR",
    roles: ["leader"],
    ideology: "fascist",
    until: "1943-02-13",
    source:
      "en.wikipedia Hristo Lukov: Minister of War 1935-1938, then leader of the Union of Bulgarian National Legions; shot 1943-02-13",
  },
  {
    id: "bgr_tsankov",
    nameKey: "ww1936.person.bgr_tsankov",
    country: "BGR",
    roles: ["leader", "advisor"],
    ideology: "fascist",
    advisor: { slot: "political", traits: ["orator"] },
    source:
      "en.wikipedia Aleksandar Tsankov: Prime Minister 1923-1926, founder of the National Social Movement",
  },
  {
    id: "bgr_gabrovski",
    nameKey: "ww1936.person.bgr_gabrovski",
    country: "BGR",
    roles: ["leader", "advisor"],
    ideology: "fascist",
    advisor: { slot: "political", traits: ["security_chief"] },
    until: "1945-02-01",
    source:
      "en.wikipedia Petar Gabrovski: a founder of the Ratniks, Minister of the Interior 1940-1943; sentenced by the People's Court 1945-02-01",
  },
  // ---- advisors of any government ----
  {
    id: "bgr_bozhilov",
    nameKey: "ww1936.person.bgr_bozhilov",
    country: "BGR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    until: "1945-02-01",
    source:
      "en.wikipedia Dobri Bozhilov: banker, Minister of Finance 1938-1943, Prime Minister 1943-1944; sentenced by the People's Court 1945-02-01",
  },
  {
    id: "bgr_peshev",
    nameKey: "ww1936.person.bgr_peshev",
    country: "BGR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    source:
      "en.wikipedia Dimitar Peshev: Minister of Justice 1935-1936, Deputy Speaker of the National Assembly 1938-1943",
  },
  {
    id: "bgr_ivan_popov",
    nameKey: "ww1936.person.bgr_ivan_popov",
    country: "BGR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "en.wikipedia Ivan Popov (politician): Foreign Minister 1940-1941 in the Filov cabinet; from memory",
  },
  {
    id: "bgr_daskalov",
    nameKey: "ww1936.person.bgr_daskalov",
    country: "BGR",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    source:
      "en.wikipedia Teodosi Daskalov: Minister of War 1938-1941, who built the army up after the Salonika agreement; from memory",
  },
  {
    id: "bgr_velchev",
    nameKey: "ww1936.person.bgr_velchev",
    country: "BGR",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_training"] },
    source:
      "en.wikipedia Damyan Velchev: leader of the Military League and the 1934 coup, sentenced in 1936 and pardoned, Minister of War 1944",
  },
  {
    id: "bgr_nadjakov",
    nameKey: "ww1936.person.bgr_nadjakov",
    country: "BGR",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Georgi Nadjakov: physicist at Sofia University, discovered the photoelectret state in the 1930s",
  },
];
