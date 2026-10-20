// World War 1936 P3 — German advisors (spec §19.9, §8.4; plan decision 19).
// Real names only for people never convicted by the International Military
// Tribunal, the later Nuremberg trials or any national war-crimes court, and
// never SS, Gestapo or police chiefs. Office holders who were convicted
// (foreign, armaments and OKW chiefs, the Four Year Plan plenipotentiary,
// the propaganda chief) appear as titles only. Ernst Heinkel and Ferdinand
// Porsche (spec "to check") are left to the generic title:rs_aircraft and
// title:rs_armor cards: both firms ran on forced and camp labour, Porsche
// held an honorary SS rank and was held by France as a suspected war
// criminal. Ludwig Beck also leads the army's alternative government
// (focus deu_september_plan, event deu_july_plot; K6 names him in
// countries.ts). `until` is the first day a person no longer serves.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PERSONS_DEU: PersonDef[] = [
  // source: en.wikipedia "Hjalmar Schacht" (Reichsbank dismissal 1939-01-20;
  // IMT acquitted 1946-10-01; denazification sentence quashed on appeal 1948)
  // + Nuremberg judgment text (Avalon/Britannica copy) and Hitler's decree of
  // 1939-01-20 (Harvard Nuremberg Trials Project).
  {
    id: "deu_schacht",
    nameKey: "ww1936.person.deu_schacht",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    until: "1939-01-20",
    source:
      "en.wikipedia Hjalmar Schacht; IMT judgment (acquitted 1946-10-01); Reichsbank dismissal decree 1939-01-20 (Harvard Nuremberg project)",
  },
  // source: en.wikipedia "Franz von Papen" (ambassador to Turkey 1939-04-17 to
  // 1944-08; IMT acquitted; denazification sentence reduced on appeal 1949)
  // + FRUS 1944 vol. V and his IMT testimony: Turkey broke relations 1944-08-02.
  {
    id: "deu_papen",
    nameKey: "ww1936.person.deu_papen",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    until: "1944-08-02",
    source:
      "en.wikipedia Franz von Papen (IMT acquitted); FRUS 1944 v.V and IMT testimony (Turkey broke relations 1944-08-02)",
  },
  // source: en.wikipedia "Werner von Blomberg" (forced to resign 1938-01-27,
  // witness at Nuremberg, never tried, died 1946-03-13) + ko.wikipedia
  // "블롬베르크-프리치 위기".
  {
    id: "deu_blomberg",
    nameKey: "ww1936.person.deu_blomberg",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    until: "1938-01-27",
    source:
      "en.wikipedia Werner von Blomberg (resigned 1938-01-27, never tried); ko.wikipedia Blomberg-Fritsch crisis",
  },
  // source: en.wikipedia "Werner von Fritsch" (forced to resign 1938-02-04,
  // killed 1939-09-22) + en.wikipedia "Oberkommando der Wehrmacht" (decree of
  // 1938-02-04).
  {
    id: "deu_fritsch",
    nameKey: "ww1936.person.deu_fritsch",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    until: "1938-02-04",
    source:
      "en.wikipedia Werner von Fritsch (resigned 1938-02-04); en.wikipedia Oberkommando der Wehrmacht (decree 1938-02-04)",
  },
  // source: en.wikipedia "Walther von Brauchitsch" (C-in-C of the Army
  // 1938-02-04 to 1941-12-19; died 1948-10-18 before any trial) + Jewish
  // Virtual Library biography (relieved December 1941).
  {
    id: "deu_brauchitsch",
    nameKey: "ww1936.person.deu_brauchitsch",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_offense"] },
    from: "1938-02-04",
    until: "1941-12-19",
    source:
      "en.wikipedia Walther von Brauchitsch (1938-02-04 to 1941-12-19, died before trial); Jewish Virtual Library biography",
  },
  // source: de.wikipedia "Ludwig Beck (General)" (asked to be relieved
  // 1938-08-18, handed over to Halder 1938-08-27) + en.wikipedia "Ludwig Beck"
  // (Chief of the General Staff 1935-07-01 to 1938-08; died 1944-07-20).
  {
    id: "deu_beck",
    nameKey: "ww1936.person.deu_beck",
    country: "DEU",
    roles: ["advisor", "leader"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    leaderTraits: ["caretaker"],
    until: "1938-08-27",
    source:
      "de.wikipedia Ludwig Beck (General) (handed over 1938-08-27); en.wikipedia Ludwig Beck",
  },
  // source: en.wikipedia "Franz Halder" (Chief of the General Staff
  // 1938-09-01 to 1942-09-24; acquitted by a German court, retrial dropped
  // 1950; never before a war-crimes tribunal) + Jewish Virtual Library.
  {
    id: "deu_halder",
    nameKey: "ww1936.person.deu_halder",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    from: "1938-09-01",
    until: "1942-09-24",
    source:
      "en.wikipedia Franz Halder (1938-09-01 to 1942-09-24, not convicted); Jewish Virtual Library",
  },
  // source: en.wikipedia "Kurt Zeitzler" (from 1942-09-24; broke down
  // 1944-07-01, Guderian acting chief after 1944-07-20; POW to 1947, never
  // tried) + de.wikipedia "Kurt Zeitzler" (sick early July 1944, discharged
  // 1945-01-31).
  {
    id: "deu_zeitzler",
    nameKey: "ww1936.person.deu_zeitzler",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_logistics"] },
    from: "1942-09-24",
    until: "1944-07-20",
    source:
      "en.wikipedia and de.wikipedia Kurt Zeitzler (1942-09-24 to July 1944, never tried)",
  },
  // source: de.wikipedia "Oswald Lutz (General)" (relieved 1938-02-15,
  // retired 1938-02-28; died 1944) + en.wikipedia "Oswald Lutz" (retired
  // February 1938).
  {
    id: "deu_lutz",
    nameKey: "ww1936.person.deu_lutz",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["theorist_armor"] },
    until: "1938-02-28",
    source:
      "de.wikipedia Oswald Lutz (General) (retired 1938-02-28); en.wikipedia Oswald Lutz",
  },
  // source: en.wikipedia "Heinz Guderian" (POW to 1948, never charged) +
  // P2 GENERALS id "guderian" (P2 spec §6.2).
  {
    id: "deu_guderian",
    nameKey: "ww1936.person.deu_guderian",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["theorist_armor"] },
    alsoGeneral: "guderian",
    source: "en.wikipedia Heinz Guderian (never charged); P2 GENERALS guderian",
  },
  // source: en.wikipedia "Fritz Todt" (Inspector General for roads
  // 1933-07-05, armaments minister 1940-03-17, killed in an air crash
  // 1942-02-08, never tried) + de.wikipedia "Fritz Todt".
  {
    id: "deu_todt",
    nameKey: "ww1936.person.deu_todt",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_construction"] },
    until: "1942-02-08",
    source:
      "en.wikipedia Fritz Todt (died 1942-02-08, never tried); succession to the armaments ministry 1942-02-08",
  },

  // ---- titles (spec §8.4-3): German candidates only, besides the trait cards ----
  // Neurath (to 1938-02-04) and Ribbentrop: both convicted by the IMT.
  {
    id: "title_deu_foreign_minister",
    nameKey: "ww1936.title.deu_foreign_minister",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    source: "title card (spec §8.4-3)",
  },
  // The plenipotentiary from 1936-10-18 was convicted by the IMT.
  {
    id: "title_deu_four_year_plenipotentiary",
    nameKey: "ww1936.title.deu_four_year_plenipotentiary",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1936-10-18",
    source: "title card (spec §8.4-3); Four Year Plan decree 1936-10-18",
  },
  // The propaganda minister is on the banned list (plan Sensitivity).
  {
    id: "title_deu_propaganda_chief",
    nameKey: "ww1936.title.deu_propaganda_chief",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    source: "title card (spec §8.4-3)",
  },
  // Todt's successor from 1942-02-08 was convicted by the IMT.
  {
    id: "title_deu_armaments_minister",
    nameKey: "ww1936.title.deu_armaments_minister",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1942-02-08",
    source: "title card (spec §8.4-3); Todt's death 1942-02-08",
  },
  // The OKW, created 1938-02-04; its chief was convicted by the IMT.
  {
    id: "title_deu_okw_chief",
    nameKey: "ww1936.title.deu_okw_chief",
    country: "DEU",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    from: "1938-02-04",
    source: "title card (spec §8.4-3); OKW decree 1938-02-04",
  },
];
