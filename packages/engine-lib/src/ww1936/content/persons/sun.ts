// World War 1936 P3 — Soviet advisors by name (spec §19.9, lane K4).
// Not here (spec §8.4-2, BANNED_PERSON_IDS): the NKVD chiefs Yagoda, Yezhov
// and Beria, and the purge-trial prosecutor and judge Vyshinsky and Ulrikh.
// Dates were checked against English and Russian Wikipedia (and a third
// source where noted); an `until` that a purge event takes over is left out
// (plan Task 13 Step 4).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PERSONS_SUN = [
  // ---- Political ----
  {
    // source: en/ru.wikipedia "Vyacheslav Molotov" — Chairman of the Council of
    // People's Commissars 1930-12-19..1941-05-06; foreign affairs from 1939-05-03
    // (the trait diplomat comes with the event sun_litvinov_dismissed).
    id: "sun_molotov",
    nameKey: "ww1936.person.sun_molotov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    source:
      "en/ru.wikipedia Vyacheslav Molotov: premier 1930-12-19..1941-05-06, foreign affairs 1939-05-03",
  },
  {
    // source: en.wikipedia + ru.wikipedia "Maxim Litvinov" — People's Commissar
    // for Foreign Affairs 1930-07-21..1939-05-03.
    id: "sun_litvinov",
    nameKey: "ww1936.person.sun_litvinov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    until: "1939-05-03",
    source:
      "en/ru.wikipedia Maxim Litvinov: foreign affairs commissar 1930-07-21..1939-05-03",
  },
  {
    // source: en.wikipedia "Andrei Zhdanov" — Central Committee secretary from
    // 1934, Leningrad first secretary 1934-12..1945-01.
    id: "sun_zhdanov",
    nameKey: "ww1936.person.sun_zhdanov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["party_ideologue"] },
    ideology: "communist",
    source:
      "en/ru.wikipedia Andrei Zhdanov: CC secretary from 1934-02, Leningrad first secretary 1934-12..1945-01",
  },
  {
    // source: en.wikipedia "Mikhail Kalinin" — chairman of the Central Executive
    // Committee to 1938-01-17, then of the Supreme Soviet Presidium to 1946-03.
    id: "sun_kalinin",
    nameKey: "ww1936.person.sun_kalinin",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    source:
      "en/ru.wikipedia Mikhail Kalinin: head of state (CEC, then Presidium 1938-01-17..1946-03)",
  },
  {
    // source: en.wikipedia + ru.wikipedia "Nikolai Bukharin" — Izvestia editor
    // from 1934; arrested 1937-02-27 (the purge path removes him by event).
    id: "sun_bukharin",
    nameKey: "ww1936.person.sun_bukharin",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    source:
      "en/ru.wikipedia Nikolai Bukharin: arrested 1937-02-27 (event sun_bukharin_arrest)",
  },

  // ---- Army chief ----
  {
    // source: en.wikipedia "Kliment Voroshilov" + ru.wikipedia "Timoshenko" —
    // People's Commissar for Defense until 1940-05-07.
    id: "sun_voroshilov",
    nameKey: "ww1936.person.sun_voroshilov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    until: "1940-05-07",
    source:
      "en.wikipedia Kliment Voroshilov, ru.wikipedia Timoshenko: defense commissar until 1940-05-07",
  },
  {
    // source: en.wikipedia + ru.wikipedia "Semyon Timoshenko" — People's
    // Commissar for Defense 1940-05-07..1941-07-19.
    id: "sun_timoshenko",
    nameKey: "ww1936.person.sun_timoshenko",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_offense"] },
    from: "1940-05-07",
    until: "1941-07-19",
    alsoGeneral: "timoshenko",
    source:
      "en/ru.wikipedia Semyon Timoshenko: defense commissar 1940-05-07..1941-07-19",
  },

  // ---- Staff and theorists ----
  {
    // source: en.wikipedia "Alexander Yegorov (general)" + ru.wikipedia — Chief
    // of the General Staff to 1937-05-10 (the purge path removes him by event).
    id: "sun_yegorov",
    nameKey: "ww1936.person.sun_yegorov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    source:
      "en/ru.wikipedia Alexander Yegorov: CGS until 1937-05-10 (event sun_yegorov_replaced)",
  },
  {
    // source: en.wikipedia + ru.wikipedia "Boris Shaposhnikov" — CGS
    // 1937-05-10..1940-08 (Meretskov from 1940-08-15) and 1941-07-29..1942-05-11
    // (the second term by the events sun_shaposhnikov_returns / _steps_down).
    id: "sun_shaposhnikov",
    nameKey: "ww1936.person.sun_shaposhnikov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    from: "1937-05-10",
    until: "1940-08-15",
    source:
      "en/ru.wikipedia Boris Shaposhnikov: CGS 1937-05-10..1940-08, 1941-07-29..1942-05-11",
  },
  {
    // source: ru.wikipedia "Kirill Meretskov" (1940-08-15..1941-01-14) +
    // en.wikipedia "Chief of the General Staff (Russia)" (August 1940..January 1941).
    id: "sun_meretskov",
    nameKey: "ww1936.person.sun_meretskov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_logistics"] },
    from: "1940-08-15",
    until: "1941-01-14",
    alsoGeneral: "meretskov",
    source:
      "ru.wikipedia Kirill Meretskov, en.wikipedia CGS list: CGS 1940-08-15..1941-01-14",
  },
  {
    // source: en.wikipedia "Chief of the General Staff (Russia)" + ru.wikipedia
    // "Aleksandr Vasilevsky" — CGS from 1942-06-26.
    id: "sun_vasilevsky",
    nameKey: "ww1936.person.sun_vasilevsky",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    from: "1942-06-26",
    source:
      "en.wikipedia CGS list, ru.wikipedia Aleksandr Vasilevsky: CGS from 1942-06-26",
  },
  {
    // source: en.wikipedia "Aleksei Antonov" (Overy: "On December 11 [1942]") +
    // ru.wikipedia — head of the Operations Directorate and deputy CGS.
    id: "sun_antonov",
    nameKey: "ww1936.person.sun_antonov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_logistics"] },
    from: "1942-12-11",
    source:
      "en/ru.wikipedia Aleksei Antonov: deputy CGS and operations chief from 1942-12-11",
  },
  {
    // source: en.wikipedia "Mikhail Tukhachevsky" (arrested 1937-05-22) +
    // ru.wikipedia "Дело военных" (trial 1937-06-11). The purge path removes
    // him by the event sun_military_trial; P2 GENERALS id "tukhachevsky".
    id: "sun_tukhachevsky",
    nameKey: "ww1936.person.sun_tukhachevsky",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["theorist_land"] },
    alsoGeneral: "tukhachevsky",
    source:
      "en.wikipedia Mikhail Tukhachevsky, ru.wikipedia Дело военных: arrested 1937-05-22, tried 1937-06-11",
  },
  {
    // source: en.wikipedia + ru.wikipedia "Georgii Isserson" — General Staff
    // Academy; arrested 1941-06-07 (a purge victim, rehabilitated 1955).
    id: "sun_isserson",
    nameKey: "ww1936.person.sun_isserson",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["theorist_land"] },
    until: "1941-06-07",
    source: "en/ru.wikipedia Georgii Isserson: arrested 1941-06-07",
  },

  // ---- Industry ----
  {
    // source: en.wikipedia + ru.wikipedia "Sergo Ordzhonikidze" — People's
    // Commissar of Heavy Industry 1932-01-05 until his death on 1937-02-18.
    id: "sun_ordzhonikidze",
    nameKey: "ww1936.person.sun_ordzhonikidze",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_construction"] },
    until: "1937-02-18",
    source:
      "en/ru.wikipedia Sergo Ordzhonikidze: heavy industry commissar, died 1937-02-18",
  },
  {
    // source: en.wikipedia + ru.wikipedia "Nikolai Voznesensky" — chairman of
    // Gosplan from 1938-01-19.
    id: "sun_voznesensky",
    nameKey: "ww1936.person.sun_voznesensky",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1938-01-19",
    source:
      "en/ru.wikipedia Nikolai Voznesensky: Gosplan chairman from 1938-01-19",
  },
  {
    // source: en.wikipedia "Anastas Mikoyan" — People's Commissar for Food
    // 1934-1938, for Foreign Trade 1938-1946.
    id: "sun_mikoyan",
    nameKey: "ww1936.person.sun_mikoyan",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "en/ru.wikipedia Anastas Mikoyan: food commissar 1934-1938, foreign trade 1938-1946",
  },
  {
    // source: ru.wikipedia "Dmitry Ustinov" (9 June 1941) + generals.dk and the
    // en.wikipedia "Boris Vannikov" term end — People's Commissar of Armaments.
    id: "sun_ustinov",
    nameKey: "ww1936.person.sun_ustinov",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1941-06-09",
    source:
      "ru.wikipedia Dmitry Ustinov, generals.dk: armaments commissar from 1941-06-09",
  },

  // ---- Research ----
  {
    // source: en.wikipedia + ru.wikipedia "Mikhail Koshkin" — chief designer
    // of the T-34 at Kharkiv; died 1940-09-26.
    id: "sun_koshkin",
    nameKey: "ww1936.person.sun_koshkin",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_armor"] },
    until: "1940-09-26",
    source:
      "en/ru.wikipedia Mikhail Koshkin: T-34 chief designer, died 1940-09-26",
  },
  {
    // source: ru.wikipedia "Vyacheslav Malyshev" + globalsecurity.org
    // NKTankprom — People's Commissar of the Tank Industry from 1941-09-11.
    id: "sun_malyshev",
    nameKey: "ww1936.person.sun_malyshev",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_armor"] },
    from: "1941-09-11",
    source:
      "ru.wikipedia Vyacheslav Malyshev, globalsecurity.org: tank industry commissar from 1941-09-11",
  },
  {
    // source: en.wikipedia + ru.wikipedia "Andrei Tupolev" — arrested
    // 1937-10-21, released 1941-07-19 (both by event on the purge path).
    id: "sun_tupolev",
    nameKey: "ww1936.person.sun_tupolev",
    country: "SUN",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_aircraft"] },
    source:
      "en/ru.wikipedia Andrei Tupolev: arrested 1937-10-21, released 1941-07-19 (events)",
  },
] satisfies PersonDef[];
