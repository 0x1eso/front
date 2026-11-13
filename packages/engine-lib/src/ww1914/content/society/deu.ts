import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { all } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwSocietyContent } from "../../SocietyRows";
import { warAge } from "../house/kit";

// ww207 (W-DEU): DEU's communities (one ideal each) and its birth rows (real
// parties born by state). Text: resources/ww1914/ko/DEU.house.json
// `communities.<id>`. Ideals go on the faction rows in content/house/deu.ts.
// See /home/eser/dev/ww207-format.md.
//
// Axes: rule 왕권 ↔ 의회, class 재산 ↔ 노동, force 무력 ↔ 협조. Sizes are
// words (1 한 줌 .. 5 나라의 절반), not counts. Flavour, checked loosely: the
// veterans' leagues (Kyffhäuserbund) near three million and the Navy League
// near a million (patriots); the Free Trade Unions some 2.5 million in 1913
// (workers); the Centre's Volksverein near 800,000 (Catholics); the 1912
// Reichstag's 18 Poles, 9 Alsace-Lorrainers and one Dane (borderlands).

const war: GwCond = world({ is: "war" });
const uspdIn: GwCond = world({ is: "faction", id: "deu_uspd", of: ["in"] });

export const DEU_SOCIETY: GwSocietyContent = {
  communities: [
    {
      id: "deu_officials",
      tag: "DEU",
      ideal: { axis: "rule", side: -1 },
      size: 2,
      trust: 2,
    },
    {
      id: "deu_burghers",
      tag: "DEU",
      ideal: { axis: "rule", side: 1 },
      size: 3,
    },
    {
      id: "deu_owners",
      tag: "DEU",
      ideal: { axis: "class", side: -1 },
      size: 2,
      trust: 1,
    },
    {
      id: "deu_workers",
      tag: "DEU",
      ideal: { axis: "class", side: 1 },
      size: 4,
      trust: -1,
    },
    {
      id: "deu_patriots",
      tag: "DEU",
      ideal: { axis: "force", side: -1 },
      size: 2,
      trust: 1,
    },
    {
      id: "deu_catholics",
      tag: "DEU",
      ideal: { axis: "force", side: 1 },
      size: 3,
    },
    {
      // Poles, Danes, Alsace-Lorrainers: they ask for their own say first,
      // and heat quicker than the rest.
      id: "deu_borderlands",
      tag: "DEU",
      ideal: { axis: "rule", side: 1 },
      size: 1,
      trust: -2,
      steps: [2, 5, 9],
    },
  ],
  births: [
    {
      // The SPD's anti-war minority: against the credits from December
      // 1915, out of the group in March 1916, its own party at Gotha in
      // April 1917. Its opposite: the Fatherland Party.
      faction: "deu_uspd",
      tag: "DEU",
      from: "deu_workers",
      when: all(war, warAge(12)),
      opposite: "deu_fatherland",
    },
    {
      // Tirpitz and Kapp's Fatherland Party, 2 September 1917, against the
      // Peace Resolution, with Pan-German money.
      faction: "deu_fatherland",
      tag: "DEU",
      from: "deu_patriots",
      when: all(war, warAge(18)),
    },
    {
      // Liebknecht and Luxemburg's group inside the USPD; a party of its own
      // (the KPD) only at the turn of 1918-19.
      faction: "deu_spartacus",
      tag: "DEU",
      from: "deu_workers",
      when: all(uspdIn, world({ is: "unrest", min: 1 })),
    },
  ],
};
