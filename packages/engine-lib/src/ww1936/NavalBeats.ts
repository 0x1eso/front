// World War 1936 P4 — the naval and air history beats (spec §17.6). The
// type is plan Task 1 Step 15's; lane G (Task 13) fills the table; the AI
// lane (Task 10) rolls the 10% skip and 0-20 day delay and multiplies the
// target's score by 10 inside the window (landings: from − prep − 30 days
// to from + 120 days; campaigns: from to `to`).
//
// The 20 rows of the spec table are 22 beats: the strategic bombing of
// Germany is a British beat (from 1942-02) and an American one (from
// 1943-01), and the 1941-12-08 landings are one beat against Britain
// (Malaya) and one against the United States (the Philippines, Guam,
// Wake). A beat belongs to one country, the first the spec names; the
// Leyte and Luzon landings are one beat because the map has one
// Philippine region (its window covers Luzon, 1945-01-09). Targets are
// world1936 region names (map v3); `vs` is who holds them on the date.
// Sources: en.wikipedia (the operation articles named) and the US Army
// Center of Military History / Naval History and Heritage Command or the
// Imperial War Museums chronologies.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";

export interface NavalBeatDef {
  id: string;
  tag: CountryTag;
  from: string;
  to?: string;
  kind: "invade" | "port_strike" | "air_campaign" | "paradrop";
  targets: string[] /* region names */;
  vs?: CountryTag[];
  zoneHint?: string;
}

export const NAVAL_BEATS: readonly NavalBeatDef[] = [
  // Italian invasion of Albania, landing at Durrës 1939-04-07: en.wikipedia
  // Italian invasion of Albania; Britannica. P2 froze this war (no land route).
  {
    id: "ita_albania",
    tag: "ITA",
    from: "1939-04-07",
    kind: "invade",
    targets: ["Tiranë"],
    vs: ["ALB"],
  },
  // Operation Weserübung, landings at Oslo, Bergen, Trondheim and Narvik
  // 1940-04-09: en.wikipedia Operation Weserübung; IWM chronology
  {
    id: "deu_norway",
    tag: "DEU",
    from: "1940-04-09",
    kind: "invade",
    targets: ["Oslo", "Hordaland", "Sør-Trøndelag", "Nordland 2"],
    vs: ["NOR"],
  },
  // Battle of Britain 1940-07-10..1940-10-31 (British dating): air superiority
  // and bombing over southern England. A Sea Lion landing is the AI's own
  // choice if it ever wins supremacy (spec §17.6), not a beat.
  // en.wikipedia Battle of Britain; RAF Museum
  {
    id: "deu_battle_of_britain",
    tag: "DEU",
    from: "1940-07-10",
    to: "1940-10-31",
    kind: "air_campaign",
    targets: ["London", "Hampshire"],
    vs: ["GBR"],
  },
  // Battle of Taranto, carrier strike 1940-11-11: en.wikipedia Battle of
  // Taranto; NHHC / IWM
  {
    id: "gbr_taranto",
    tag: "GBR",
    from: "1940-11-11",
    kind: "port_strike",
    targets: ["Bari"],
    vs: ["ITA"],
  },
  // Battle of Crete, airborne assault 1941-05-20 (the map joins Crete to
  // Central Greece): en.wikipedia Battle of Crete; IWM
  {
    id: "deu_crete",
    tag: "DEU",
    from: "1941-05-20",
    kind: "paradrop",
    targets: ["Stereá Elláda"],
    vs: ["GRC", "GBR"],
  },
  // Attack on Pearl Harbor 1941-12-07 (Hawaii time): en.wikipedia Attack on
  // Pearl Harbor; NHHC
  {
    id: "jpn_pearl_harbor",
    tag: "JPN",
    from: "1941-12-07",
    kind: "port_strike",
    targets: ["Oahu"],
    vs: ["USA"],
  },
  // Kota Bharu landing 1941-12-08: en.wikipedia Japanese invasion of Malaya; IWM
  {
    id: "jpn_malaya",
    tag: "JPN",
    from: "1941-12-08",
    kind: "invade",
    targets: ["Malaya"],
    vs: ["GBR"],
  },
  // Philippines (first landings 1941-12-08, Lingayen 12-22), Guam
  // (1941-12-08), Wake (12-08 attack, taken 12-23): en.wikipedia Philippines
  // campaign (1941-1942), Battle of Guam (1941), Battle of Wake Island; US Army CMH
  {
    id: "jpn_philippines",
    tag: "JPN",
    from: "1941-12-08",
    kind: "invade",
    targets: ["Philippines", "Guam", "Wake"],
    vs: ["USA"],
  },
  // Netherlands East Indies campaign 1942-01-11 (Tarakan, Manado) to
  // 1942-03-01 (Java): Borneo, Celebes (the map's Papua Barat region),
  // Sumatra and Java (the map's Batavia region): en.wikipedia Dutch East
  // Indies campaign; US Army CMH
  {
    id: "jpn_east_indies",
    tag: "JPN",
    from: "1942-01-11",
    to: "1942-03-01",
    kind: "invade",
    targets: ["British Borneo", "Kalimantan Timur", "Papua Barat", "Batavia"],
    vs: ["NLD", "GBR"],
  },
  // RAF Bomber Command's area offensive: directive of 1942-02-14 to the end
  // of the war: en.wikipedia Area bombing directive / RAF Bomber Command; IWM
  {
    id: "gbr_bomber_offensive",
    tag: "GBR",
    from: "1942-02-14",
    to: "1945-05-08",
    kind: "air_campaign",
    targets: ["Nordrhein-Westfalen", "Hamburg", "Berlin"],
    vs: ["DEU"],
  },
  // Guadalcanal landing 1942-08-07: en.wikipedia Guadalcanal campaign; NHHC
  {
    id: "usa_guadalcanal",
    tag: "USA",
    from: "1942-08-07",
    kind: "invade",
    targets: ["Solomon Islands"],
    vs: ["JPN"],
  },
  // Operation Torch, Morocco and Algeria 1942-11-08 (with Britain); the
  // defenders were Vichy French, whose tag P5 decides, so no `vs`:
  // en.wikipedia Operation Torch; US Army CMH
  {
    id: "usa_torch",
    tag: "USA",
    from: "1942-11-08",
    kind: "invade",
    targets: ["Grand Casablanca", "El Bayadh", "Alger"],
  },
  // Eighth Air Force over Germany, first raid (Wilhelmshaven) 1943-01-27:
  // en.wikipedia Combined Bomber Offensive / Eighth Air Force; US Air Force
  // Historical Support Division
  {
    id: "usa_bomber_offensive",
    tag: "USA",
    from: "1943-01-27",
    to: "1945-05-08",
    kind: "air_campaign",
    targets: ["Nordrhein-Westfalen", "Bayern", "Berlin"],
    vs: ["DEU"],
  },
  // Operation Husky, Sicily 1943-07-10 (with the United States): en.wikipedia
  // Allied invasion of Sicily; IWM
  {
    id: "gbr_sicily",
    tag: "GBR",
    from: "1943-07-10",
    kind: "invade",
    targets: ["Palermo"],
    vs: ["ITA", "DEU"],
  },
  // Operation Avalanche, Salerno 1943-09-09 (with Britain): en.wikipedia
  // Allied invasion of Italy; US Army CMH
  {
    id: "usa_salerno",
    tag: "USA",
    from: "1943-09-09",
    kind: "invade",
    targets: ["Napoli"],
    vs: ["DEU"],
  },
  // Battle of Tarawa 1943-11-20: en.wikipedia Battle of Tarawa; NHHC
  {
    id: "usa_tarawa",
    tag: "USA",
    from: "1943-11-20",
    kind: "invade",
    targets: ["Tarawa"],
    vs: ["JPN"],
  },
  // Normandy landings 1944-06-06 (with Britain and Canada; the beaches are
  // in the map's Eure and Orne regions): en.wikipedia Normandy landings; IWM
  {
    id: "usa_normandy",
    tag: "USA",
    from: "1944-06-06",
    kind: "invade",
    targets: ["Eure", "Orne"],
    vs: ["DEU"],
  },
  // Battle of Saipan 1944-06-15: en.wikipedia Battle of Saipan; NHHC
  {
    id: "usa_saipan",
    tag: "USA",
    from: "1944-06-15",
    kind: "invade",
    targets: ["Saipan"],
    vs: ["JPN"],
  },
  // Operation Dragoon 1944-08-15 (with France): en.wikipedia Operation
  // Dragoon; US Army CMH
  {
    id: "usa_southern_france",
    tag: "USA",
    from: "1944-08-15",
    kind: "invade",
    targets: ["Alpes-Maritimes", "Bouches-du-Rhône"],
    vs: ["DEU"],
  },
  // Leyte 1944-10-20, then Luzon (Lingayen) 1945-01-09: en.wikipedia Battle
  // of Leyte / Invasion of Lingayen Gulf; US Army CMH
  {
    id: "usa_leyte",
    tag: "USA",
    from: "1944-10-20",
    kind: "invade",
    targets: ["Philippines"],
    vs: ["JPN"],
  },
  // Battle of Iwo Jima 1945-02-19: en.wikipedia Battle of Iwo Jima; NHHC
  {
    id: "usa_iwo_jima",
    tag: "USA",
    from: "1945-02-19",
    kind: "invade",
    targets: ["Iwo Jima"],
    vs: ["JPN"],
  },
  // Battle of Okinawa 1945-04-01: en.wikipedia Battle of Okinawa; US Army CMH
  {
    id: "usa_okinawa",
    tag: "USA",
    from: "1945-04-01",
    kind: "invade",
    targets: ["Okinawa"],
    vs: ["JPN"],
  },
];
