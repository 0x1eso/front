import { all, any, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwSocietyContent } from "../../SocietyRows";
import { isLaw, warAge } from "../house/kit";

// ww207 (W-AUH): AUH's communities (one ideal each) and its birth rows (real
// parties born by state). Text: resources/ww1914/ko/AUH.house.json
// `communities.<id>`. Ideals go on the faction rows in content/house/auh.ts.
// See /home/eser/dev/ww207-format.md.
//
// Axes: rule 칙령 (-1) ↔ 의회 (+1); class 재산 ↔ 노동; dual 이원 체제 ↔ 민족들.
// The design's six (궁정과 군, 빈 시민, 귀족과 마자르 젠트리, 노동자, 마자르
// 국민, the nations as two) and one more: the German burghers of Bohemia and
// the Alpine towns, the German Nationals' people, who held to the dual order
// beside the Magyars (the 1911 Reichsrat seated about a hundred German
// national deputies: en.wikipedia 1911 Cisleithanian election, checked
// 2026-11-13). Sizes are the game's reading of the 1910 census (memory, F):
// Germans about a third of Austria's half, Magyars about half of Hungary's,
// the Slavs and Romanians the larger part of the whole.

export const AUH_SOCIETY: GwSocietyContent = {
  communities: [
    {
      id: "auh_c_court",
      tag: "AUH",
      ideal: { axis: "rule", side: -1 },
      size: 1,
      trust: 2,
    },
    {
      id: "auh_c_vienna",
      tag: "AUH",
      ideal: { axis: "rule", side: 1 },
      size: 2,
    },
    {
      id: "auh_c_gentry",
      tag: "AUH",
      ideal: { axis: "class", side: -1 },
      size: 2,
      trust: 1,
    },
    {
      id: "auh_c_workers",
      tag: "AUH",
      ideal: { axis: "class", side: 1 },
      size: 3,
      trust: -1,
    },
    {
      id: "auh_c_magyars",
      tag: "AUH",
      ideal: { axis: "dual", side: -1 },
      size: 3,
      trust: 1,
    },
    {
      id: "auh_c_germans",
      tag: "AUH",
      ideal: { axis: "dual", side: -1 },
      size: 3,
    },
    // The nations as two: the north (Czechs, Poles, Ukrainians of Galicia)
    // and the south (Slovenes, Croats, Serbs, Romanians).
    {
      id: "auh_c_north",
      tag: "AUH",
      ideal: { axis: "dual", side: 1 },
      size: 4,
      trust: -1,
    },
    {
      id: "auh_c_south",
      tag: "AUH",
      ideal: { axis: "dual", side: 1 },
      size: 3,
      trust: -1,
      // Quicker to boil than the north once the war drags (the Serbs of
      // Bosnia and Syrmia under suspicion from the first weeks).
      steps: [3, 5, 9],
    },
  ],
  births: [
    // The party's left around Friedrich Adler (the Verein "Karl Marx",
    // 1916, F: memory), the January 1918 strike's councils after it. Born
    // from the hot factory districts while the war drags.
    {
      faction: "auh_sd_left",
      tag: "AUH",
      from: "auh_c_workers",
      when: warAge(18),
    },
    // Hungary's Social Democrats (since 1890) held no seat under the census
    // (F: memory): they come into the Diet once the franchise opens, or
    // when the workers boil over late in the war.
    {
      faction: "auh_hun_sd",
      tag: "AUH",
      from: "auh_c_workers",
      // ww211: or in peace, once Tisza's house guard shuts the Diet's door
      // on the street (the suffrage strike of 23 May 1912, F: memory).
      when: any(isLaw("auh_franchise"), warAge(30), isLaw("auh_house_rules")),
    },
    // The Ukrainian deputies of Galicia (31 in 1911: en.wikipedia 1911
    // Cisleithanian election, checked 2026-11-13), one club in the war (F).
    {
      faction: "auh_ukr",
      tag: "AUH",
      from: "auh_c_north",
    },
    // The Romanian National Party of Hungary and Transylvania (a handful of
    // seats in 1910, F: memory). Born from the south once Bucharest's war
    // is near or the war drags.
    {
      faction: "auh_romanians",
      tag: "AUH",
      from: "auh_c_south",
      // ww211: in peace, once the school law or the commissioner's rule in
      // Croatia stirs the south (the game's reading).
      when: any(
        not(world({ is: "neutral", tag: "ROU" })),
        warAge(24),
        isLaw("auh_schools"),
        isLaw("auh_croatia_charter"),
      ),
    },
    // Károlyi's party (July 1916: en.wikipedia Mihály Károlyi). The split
    // row stays; this is the state's way: Magyars hot and no voice for peace.
    {
      faction: "auh_karolyi",
      tag: "AUH",
      from: "auh_c_magyars",
      when: all(warAge(12), not(isLaw("auh_peace_motion"))),
    },
  ],
};
