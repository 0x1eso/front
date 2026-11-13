import type { GwSocietyContent } from "../../SocietyRows";

// ww207 (W-RUS): RUS's communities (one ideal each) and its birth rows (real
// parties born by state). Text: resources/ww1914/ko/RUS.house.json
// `communities.<id>`. Ideals go on the faction rows in content/house/rus.ts.
// See /home/eser/dev/ww207-format.md.
//
// Axes: rule (전제 -1 / 의회 +1), class (지주·자본 -1 / 농민·노동 +1),
// nations (하나의 러시아 -1 / 민족들 +1). Sizes are words, not census shares:
// the peasants are some four in five of the empire, and by the 1897 census
// the non-Russian peoples (Poles, Finns, Jews, Ukrainians, the Baltic and
// Muslim peoples) are more than half of it.
//
// Births (checked): the Socialist Revolutionaries boycotted the Third and the
// Fourth Duma (1907-1917); the Trudoviks were their voice in it. The Union of
// the Russian People (Dubrovin, 1905) was the street of the Rights. The
// National Democrats (Dmowski), who lost Warsaw's seat in 1912, founded the
// Polish National Committee in Warsaw in November 1914. Here each comes in
// when its community is hot and no sitting party speaks for it, not on a
// date; the Union follows the SRs as their opposite.
export const RUS_SOCIETY: GwSocietyContent = {
  communities: [
    {
      id: "rus_court_officials",
      tag: "RUS",
      ideal: { axis: "rule", side: -1 },
      size: 1,
      trust: 2,
    },
    {
      id: "rus_zemstvo",
      tag: "RUS",
      ideal: { axis: "rule", side: 1 },
      size: 2,
      trust: -1,
    },
    {
      id: "rus_landowners",
      tag: "RUS",
      ideal: { axis: "class", side: -1 },
      size: 1,
      trust: 1,
    },
    {
      id: "rus_merchants",
      tag: "RUS",
      ideal: { axis: "class", side: -1 },
      size: 1,
      trust: 0,
    },
    {
      id: "rus_peasantry",
      tag: "RUS",
      ideal: { axis: "class", side: 1 },
      size: 5,
      trust: 0,
      // Slow to anger, slow to cool: the village.
      steps: [4, 8, 12],
    },
    {
      id: "rus_workers",
      tag: "RUS",
      ideal: { axis: "class", side: 1 },
      size: 2,
      trust: -1,
      // Quick to strike: Petrograd's factories.
      steps: [2, 5, 8],
    },
    {
      id: "rus_orthodox",
      tag: "RUS",
      ideal: { axis: "nations", side: -1 },
      size: 3,
      trust: 1,
    },
    {
      id: "rus_nations",
      tag: "RUS",
      ideal: { axis: "nations", side: 1 },
      size: 4,
      trust: -1,
    },
  ],
  births: [
    {
      faction: "rus_sr",
      tag: "RUS",
      from: "rus_peasantry",
      opposite: "rus_urp",
    },
    { faction: "rus_urp", tag: "RUS", from: "rus_orthodox" },
    { faction: "rus_poles", tag: "RUS", from: "rus_nations" },
  ],
};
