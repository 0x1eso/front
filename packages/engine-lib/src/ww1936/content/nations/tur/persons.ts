// ww229 (design ww227 §7): Turkey's leaders and advisors. Names:
// ww1936.person.<id>. Real people only; the founder is the P0 leader_tur and
// İsmet İnönü the P0 tur_inonu (persons/leaders.ts). Dates are deaths only
// (the game's politics is not history's); offices are in the sources, from
// memory of en.wikipedia and tr.wikipedia.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TUR_PERSONS: readonly PersonDef[] = [
  // ---- neutral: the single party's men ----
  {
    id: "tur_saydam",
    nameKey: "ww1936.person.tur_saydam",
    country: "TUR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    leaderTraits: ["caretaker"],
    ideology: "neutral",
    until: "1942-07-08",
    source:
      "Refik Saydam, health minister in the 1920s and 1930s, Prime Minister 1939-01 to his death in office 1942-07 (en.wikipedia Refik Saydam)",
  },
  {
    id: "tur_saracoglu",
    nameKey: "ww1936.person.tur_saracoglu",
    country: "TUR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    leaderTraits: ["peace_negotiator"],
    ideology: "neutral",
    source:
      "Şükrü Saracoğlu, finance minister 1933-1938, foreign minister 1938-1942, Prime Minister 1942-1946 (en.wikipedia Şükrü Saracoğlu)",
  },
  {
    id: "tur_aras",
    nameKey: "ww1936.person.tur_aras",
    country: "TUR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "neutral",
    source:
      "Tevfik Rüştü Aras, foreign minister 1925-1938, negotiated Montreux and the Balkan and Saadabad pacts (en.wikipedia Tevfik Rüştü Aras)",
  },
  {
    id: "tur_menemencioglu",
    nameKey: "ww1936.person.tur_menemencioglu",
    country: "TUR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    ideology: "neutral",
    source:
      "Numan Menemencioğlu, secretary-general of the foreign ministry in the 1930s, foreign minister 1942-1944 (en.wikipedia Numan Menemencioğlu)",
  },
  {
    id: "tur_kaya",
    nameKey: "ww1936.person.tur_kaya",
    country: "TUR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    ideology: "neutral",
    source:
      "Şükrü Kaya, interior minister 1927-1938 and secretary-general of the Republican People's Party (en.wikipedia Şükrü Kaya)",
  },
  {
    id: "tur_cakmak",
    nameKey: "ww1936.person.tur_cakmak",
    country: "TUR",
    roles: ["leader", "advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    leaderTraits: ["generalissimo"],
    ideology: "neutral",
    alsoGeneral: "cakmak",
    source:
      "Fevzi Çakmak, Marshal, Chief of the General Staff 1921-1944; later an opposition deputy (en.wikipedia Fevzi Çakmak)",
  },
  {
    id: "tur_gunduz",
    nameKey: "ww1936.person.tur_gunduz",
    country: "TUR",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    ideology: "neutral",
    source:
      "Asım Gündüz, general, Second Chief of the General Staff in the 1930s under Çakmak (tr.wikipedia Asım Gündüz)",
  },
  {
    id: "tur_yucel",
    nameKey: "ww1936.person.tur_yucel",
    country: "TUR",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    ideology: "neutral",
    source:
      "Hasan Âli Yücel, education minister 1938-1946, founded the Village Institutes with İsmail Hakkı Tonguç (en.wikipedia Hasan Âli Yücel)",
  },
  {
    id: "tur_demirag",
    nameKey: "ww1936.person.tur_demirag",
    country: "TUR",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_aircraft"] },
    ideology: "neutral",
    source:
      "Nuri Demirağ, railway contractor, founded a private aircraft factory in 1936 (Nu.D.36, Nu.D.38) and a party in 1945 (en.wikipedia Nuri Demirağ)",
  },
  // ---- democratic: the liberal opposition ----
  {
    id: "tur_bayar",
    nameKey: "ww1936.person.tur_bayar",
    country: "TUR",
    roles: ["leader", "advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "Celal Bayar, founder of İş Bankası, economy minister 1932-1937, Prime Minister 1937-1939, co-founder of the Democrat Party 1946 (en.wikipedia Celal Bayar)",
  },
  {
    id: "tur_menderes",
    nameKey: "ww1936.person.tur_menderes",
    country: "TUR",
    roles: ["leader"],
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "Adnan Menderes, deputy for Aydın from 1930, one of the four signatories of the 1945 memorandum, Prime Minister 1950-1960 (en.wikipedia Adnan Menderes)",
  },
  {
    id: "tur_okyar",
    nameKey: "ww1936.person.tur_okyar",
    country: "TUR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    leaderTraits: ["peace_negotiator"],
    ideology: "democratic",
    source:
      "Ali Fethi Okyar, founder of the Free Republican Party 1930, ambassador in London 1934-1939, justice minister 1939-1941 (en.wikipedia Ali Fethi Okyar)",
  },
  {
    id: "tur_koprulu",
    nameKey: "ww1936.person.tur_koprulu",
    country: "TUR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["orator"] },
    ideology: "democratic",
    source:
      "Mehmet Fuat Köprülü, historian, deputy from 1935, a signatory of the 1945 memorandum and a Democrat Party founder (en.wikipedia Mehmet Fuat Köprülü)",
  },
  // ---- fascist: the party-state and the Turanists ----
  {
    id: "tur_peker",
    nameKey: "ww1936.person.tur_peker",
    country: "TUR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    leaderTraits: ["party_boss"],
    ideology: "fascist",
    source:
      "Recep Peker, secretary-general of the Republican People's Party 1931-1936, removed after proposing a party modelled on Italy's; Prime Minister 1946-1947 (en.wikipedia Recep Peker)",
  },
  {
    id: "tur_atsiz",
    nameKey: "ww1936.person.tur_atsiz",
    country: "TUR",
    roles: ["leader"],
    leaderTraits: ["strongman"],
    ideology: "fascist",
    source:
      "Hüseyin Nihal Atsız, Turanist writer, published Orkun 1933-1934 and 1943-1944, tried in the 1944 Racism-Turanism trials (en.wikipedia Nihal Atsız)",
  },
  // ---- communist: the underground TKP ----
  {
    id: "tur_sefik_husnu",
    nameKey: "ww1936.person.tur_sefik_husnu",
    country: "TUR",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "Şefik Hüsnü Deymer, physician, general secretary of the illegal Communist Party of Turkey in the 1920s and 1930s (en.wikipedia Şefik Hüsnü)",
  },
  {
    id: "tur_kivilcimli",
    nameKey: "ww1936.person.tur_kivilcimli",
    country: "TUR",
    roles: ["leader"],
    ideology: "communist",
    source:
      "Hikmet Kıvılcımlı, TKP organiser and theorist, jailed 1938-1950 (en.wikipedia Hikmet Kıvılcımlı)",
  },
  {
    id: "tur_nazim_hikmet",
    nameKey: "ww1936.person.tur_nazim_hikmet",
    country: "TUR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    ideology: "communist",
    source:
      "Nâzım Hikmet Ran, communist poet, sentenced in 1938 for inciting the army and navy, released in 1950 (en.wikipedia Nâzım Hikmet)",
  },
];
