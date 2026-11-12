// Great War 1914 (ww190 §9): FRA's colonies and the sea. Owned by the W-FRA
// lane; conds and effects in /home/eser/dev/ww190-interfaces.md. Text in
// resources/ww1914/ko/FRA.colonies.json.
import type { GwSeaZone } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  type GwCond,
  type GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  fm,
  gauge,
  inst,
  men,
  navy,
  opinion,
  paper,
  pm,
  ranged,
  trust,
  v,
  warMin,
  warMonths,
} from "./fra_years";

/**
 * The empire at war: Germany's African colonies next door, the men the
 * colonies give and what that costs there, the Adriatic and the Serbs, the
 * Mediterranean fleet, the old battleships for the Straits. Cooldown 4; most
 * come once.
 */

const fighting = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const sea = (zone: GwSeaZone, by: "us" | "foe" | "none"): GwCond =>
  world({ is: "sea_hold", sea: zone, by });
const manpower = (max: number): GwCond =>
  ranged({ is: "manpower" }, undefined, max);

const CS = {
  cooldown: 4,
  once: true,
  tags: ["war", "foreign"],
} as Partial<GwScene>;

export const FRA_COLONIES_SCENES: readonly GwScene[] = [
  paper(
    "fra_cs_togo",
    all(fighting("DEU"), warMonths(1)),
    [v("ours", world({ is: "held", place: "togo", by: "us" })), v("base")],
    [
      ["share", [trust("GBR", 1)]],
      ["claim", [opinion("press", 1), trust("GBR", -1)]],
      ["colonial_office", [inst("chamber", 1)]],
    ],
    { ...CS, cast: { fm } },
  ),
  paper(
    "fra_cs_kamerun",
    all(fighting("DEU"), warMonths(4)),
    [v("ours", world({ is: "held", place: "kamerun", by: "us" })), v("base")],
    [
      ["columns", [men(-1), opinion("army", 1)]],
      ["british", [trust("GBR", 1)]],
      ["hold", [gauge("order", 1)]],
    ],
    { ...CS, cast: { war: warMin } },
  ),
  paper(
    "fra_cs_diagne",
    all(warMonths(30), manpower(60)),
    [v("low", manpower(40)), v("base")],
    [
      ["promises", [men(3), inst("chamber", 1)]],
      ["levy", [men(3), gauge("order", -1)]],
      ["none", [opinion("parliament", 1)]],
    ],
    { ...CS, cast: { pm } },
  ),
  paper(
    "fra_cs_volta",
    warMonths(12, 40),
    [v("long", warMonths(24)), v("base")],
    [
      ["columns", [men(-1), gauge("order", 1)]],
      ["stop_levy", [men(-1), opinion("parliament", 1)]],
      ["chiefs", [gauge("money", -1)]],
    ],
    { ...CS, cast: { war: warMin } },
  ),
  paper(
    "fra_cs_indochina",
    all(warMonths(18), manpower(70)),
    [v("low", manpower(45)), v("base")],
    [
      ["workers", [men(2), gauge("money", -1)]],
      ["soldiers", [men(2), gauge("order", -1)]],
      ["none", [opinion("workers", 1)]],
    ],
    { ...CS, cast: { pm } },
  ),
  paper(
    "fra_cs_otranto",
    all(
      fighting("AUH"),
      world({ is: "entered", tag: "ITA", side: "entente" }),
      any(sea("adriatic", "foe"), sea("adriatic", "none")),
    ),
    [v("foe", sea("adriatic", "foe")), v("base")],
    [
      ["destroyers", [trust("ITA", 1), opinion("army", -1)]],
      ["drifters", [trust("GBR", 1)]],
      ["italy", [trust("ITA", -1)]],
    ],
    { ...CS, cast: { navy } },
  ),
  paper(
    "fra_cs_corfu",
    all(
      any(fighting("AUH"), fighting("DEU")),
      ranged({ is: "beaten", tag: "SRB" }, 0),
    ),
    [v("greece", world({ is: "neutral", tag: "GRC" })), v("base")],
    [
      ["corfu", [trust("SRB", 2), trust("GRC", -1)]],
      ["bizerte", [trust("SRB", 1)]],
      ["leave", [trust("SRB", -1)]],
    ],
    { ...CS, cast: { navy, fm }, salience: 7 },
  ),
  paper(
    "fra_cs_med_fleet",
    all(warMonths(1), any(fighting("AUH"), fighting("OTT"), fighting("DEU"))),
    [v("foe", sea("med", "foe")), v("ours", sea("med", "us")), v("base")],
    [
      ["hunt", [gauge("morale", 1)]],
      ["convoys", [gauge("bread", 1)]],
      ["port", [opinion("press", -1)]],
    ],
    { ...CS, once: false, cast: { navy } },
  ),
  paper(
    "fra_cs_straits_ships",
    all(fighting("OTT"), warMonths(3)),
    [v("open", world({ is: "open", theatre: "straits" })), v("base")],
    [
      ["squadron", [trust("GBR", 1), inst("army", -1)]],
      ["few", [trust("GBR", 1)]],
      ["refuse", [trust("GBR", -1)]],
    ],
    { ...CS, cast: { navy, fm } },
  ),
];
