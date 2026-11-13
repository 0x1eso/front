import { all, any } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwSocietyContent } from "../../SocietyRows";
import { temper, warAge } from "../house/kit";

// ww207 (W-FRA): FRA's communities (one ideal each) and its birth rows (real
// parties born by state). Text: resources/ww1914/ko/FRA.house.json
// `communities.<id>`. Ideals go on the faction rows in content/house/fra.ts.
// See /home/eser/dev/ww207-format.md.
//
// FRA's axes: rule 권위 (-1) ↔ 공화 (+1), class 재산 ↔ 노동, church 교회 ↔ 세속.
// Sizes are words, not counts: France in 1914 was still about half rural (the
// 1911 census), its schoolteachers and mayors the Republic's spine. The
// peasants, small owners above all, side with property.
//
// Births: the socialist minority (Longuet's men, Zimmerwald's echo) comes from
// the CGT's workers once the war has run long and they are hot; Caillaux's
// radicals of a negotiated peace come from the small-town republicans once the
// war goes badly. Both stay the `splits` fallback in content/house/fra.ts.
export const FRA_SOCIETY: GwSocietyContent = {
  communities: [
    {
      id: "fra_officers",
      tag: "FRA",
      ideal: { axis: "rule", side: -1 },
      size: 2,
    },
    {
      id: "fra_mayors",
      tag: "FRA",
      ideal: { axis: "rule", side: 1 },
      size: 4,
      trust: 1,
    },
    {
      id: "fra_rentiers",
      tag: "FRA",
      ideal: { axis: "class", side: -1 },
      size: 2,
    },
    {
      id: "fra_peasants",
      tag: "FRA",
      ideal: { axis: "class", side: -1 },
      size: 4,
    },
    {
      id: "fra_cgt",
      tag: "FRA",
      ideal: { axis: "class", side: 1 },
      size: 3,
      trust: -1,
    },
    {
      id: "fra_catholic",
      tag: "FRA",
      ideal: { axis: "church", side: -1 },
      size: 4,
      trust: -1,
    },
    {
      id: "fra_laics",
      tag: "FRA",
      ideal: { axis: "church", side: 1 },
      size: 3,
      trust: 1,
    },
  ],
  births: [
    {
      faction: "fra_minority",
      tag: "FRA",
      from: "fra_cgt",
      when: all(warAge(12), any(temper("fra_sfio", 2), warAge(24))),
    },
    {
      faction: "fra_caillaux",
      tag: "FRA",
      from: "fra_mayors",
      when: all(
        warAge(12),
        any(world({ is: "score", max: -10 }), temper("fra_radicals", 2)),
      ),
    },
  ],
};
