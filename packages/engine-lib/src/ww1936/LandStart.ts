// World War 1936 P2: the 1936 templates, land techs and order of battle
// (P2 spec §4.5, §4.6, §6.4). The functions are the foundation's; Task 10
// filled START_OOB.
import { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  SupportId,
  TemplateDef,
} from "@openfront/engine-api/ww1936/LandTypes";
import { isMajor, startTechs } from "./EconomyStart";
import { presetById, presetDef, presetStatus } from "./TemplatePresets";

export interface StartTemplate {
  /** ww1936.tpl.<key>. */
  key: string;
  def: TemplateDef;
}

const tpl = (
  key: string,
  bns: [BattalionId, number][],
  support: SupportId[] = [],
): StartTemplate => ({
  key,
  def: {
    name: "",
    battalions: bns.flatMap(([id, n]) => new Array<BattalionId>(n).fill(id)),
    support,
  },
});

/** Spec §4.5. The first template is the one the generic order of battle uses. */
export function startTemplates(tag: CountryTag, dev: number): StartTemplate[] {
  const out = baseTemplates(tag, dev);
  const researched = new Set<WwTechId>([
    ...startTechs(tag, 0),
    ...landStartTechs(tag, isMajor(tag), dev),
  ]);
  for (const id of PRESET_PICKS[tag] ??
    (dev >= 4 ? MINOR_PICKS_4 : dev === 3 ? MINOR_PICKS_3 : MINOR_PICKS_LOW)) {
    const x = presetById(id);
    if (x === undefined || out.some((t) => t.key === id)) continue;
    // Usable at the start only: its techs are in the country's start techs.
    if (!presetStatus(x, researched, NO_DESIGNS).usable) continue;
    out.push({ key: id, def: presetDef(x) });
  }
  return out;
}

const NO_DESIGNS: ReadonlySet<number> = new Set();
/** National flavour: the presets each major adds to its 1936 templates (majors hold 4-6). */
const PRESET_PICKS: Partial<Record<CountryTag, readonly string[]>> = {
  DEU: ["pre_mot_infantry", "pre_anti_tank_infantry"],
  ITA: ["pre_mot_infantry", "pre_artillery_div"],
  JPN: ["pre_light_armored", "pre_marine_div", "pre_mot_infantry"],
  GBR: ["pre_marine_div", "pre_mot_infantry", "pre_artillery_div"],
  FRA: ["pre_mot_infantry", "pre_artillery_div"],
  USA: ["pre_light_armored", "pre_marine_div", "pre_mot_infantry"],
  SUN: ["pre_mot_infantry", "pre_artillery_div"],
};
/** Mid and minor nations (3-4 and 2-3 templates) by development. */
const MINOR_PICKS_4 = [
  "pre_engineer_infantry",
  "pre_garrison_div",
  "pre_artillery_div",
];
const MINOR_PICKS_3 = ["pre_engineer_infantry", "pre_garrison_div"];
const MINOR_PICKS_LOW = ["pre_garrison_div"];

function baseTemplates(tag: CountryTag, dev: number): StartTemplate[] {
  switch (tag) {
    case "DEU":
      return [
        tpl(
          "infantry",
          [
            ["infantry", 9],
            ["artillery", 2],
          ],
          ["engineer", "recon"],
        ),
        tpl(
          "armored",
          [
            ["light_armor", 4],
            ["motorized", 2],
            ["mot_artillery", 1],
          ],
          ["recon"],
        ),
        tpl("mountain", [
          ["mountain", 6],
          ["artillery", 1],
        ]),
        tpl("cavalry", [["cavalry", 4]]),
      ];
    case "ITA":
      return [
        tpl(
          "binary",
          [
            ["infantry", 6],
            ["artillery", 2],
          ],
          ["engineer"],
        ),
        tpl("alpini", [
          ["mountain", 6],
          ["artillery", 1],
        ]),
        tpl("celere", [
          ["light_armor", 2],
          ["cavalry", 2],
          ["mot_artillery", 1],
        ]),
        tpl("colonial", [["infantry", 6]]),
      ];
    case "JPN":
      return [
        tpl(
          "square",
          [
            ["infantry", 12],
            ["artillery", 2],
          ],
          ["engineer"],
        ),
        tpl("cavalry_brigade", [["cavalry", 3]]),
        tpl("garrison", [["infantry", 6]]),
      ];
    case "GBR":
      return [
        tpl(
          "infantry",
          [
            ["infantry", 9],
            ["artillery", 3],
          ],
          ["engineer", "recon"],
        ),
        tpl("mobile", [
          ["light_armor", 3],
          ["motorized", 2],
          ["mot_artillery", 1],
        ]),
        tpl("colonial_garrison", [["infantry", 6]]),
      ];
    case "FRA":
      return [
        tpl(
          "infantry",
          [
            ["infantry", 9],
            ["artillery", 3],
          ],
          ["engineer"],
        ),
        tpl(
          "dlm",
          [
            ["light_armor", 2],
            ["motorized", 3],
            ["mot_artillery", 1],
          ],
          ["recon"],
        ),
        tpl("colonial", [["infantry", 6]]),
        tpl("cavalry", [["cavalry", 4]]),
      ];
    case "USA":
      return [
        tpl(
          "square",
          [
            ["infantry", 9],
            ["artillery", 3],
          ],
          ["engineer"],
        ),
        tpl("cavalry", [["cavalry", 4]]),
        tpl("garrison", [["infantry", 6]]),
      ];
    case "SUN":
      return [
        tpl("rifle", [
          ["infantry", 9],
          ["artillery", 2],
        ]),
        tpl("cavalry", [
          ["cavalry", 4],
          ["light_armor", 1],
        ]),
        tpl("tank_brigade", [
          ["light_armor", 3],
          ["motorized", 1],
        ]),
        tpl("mountain_rifle", [["mountain", 6]]),
      ];
    default: {
      const out = [
        tpl(
          "infantry",
          dev >= 3
            ? [
                ["infantry", 9],
                ["artillery", 1],
              ]
            : [["infantry", 9]],
        ),
      ];
      if (dev <= 2) out.push(tpl("cavalry", [["cavalry", 4]]));
      return out;
    }
  }
}

/** Spec §4.6: the land techs a country starts with. */
export function landStartTechs(
  tag: CountryTag,
  major: boolean,
  dev: number,
): WwTechId[] {
  const out: WwTechId[] = [];
  if (major) out.push("engineer_company", "recon_company");
  else if (dev >= 3) out.push("engineer_company");
  if (tag === "DEU" || tag === "ITA") out.push("mountaineers");
  if (tag === "GBR" || tag === "USA" || tag === "JPN") out.push("marines");
  if (tag === "FRA") out.push("fortification_1");
  return out;
}

export interface OobArmy {
  /** Region ids, first one the country controls at the start wins (Task 10). */
  regions: readonly number[];
  /** [template key, divisions]. */
  divisions: readonly (readonly [string, number])[];
  /** An operation already running (Italy in Ethiopia, spec §6.4). */
  planTargets?: readonly number[];
  /**
   * Starts under a titled general (spec §6.2) when the roster has no named
   * one left for it: Japan shows titles only (controller ruling).
   */
  titledGeneral?: boolean;
}

// Spec §6.4 majors; used only when scenario.json says historicalOob (plan
// decision 14). Region ids are world1936's (1..1342, which Task 2 keeps),
// named in the comments; the first one each country holds at the start is
// where the army stands (LandStartRun), so every list starts with one of its
// own regions. Divisions per template are spec §6.4's table; an army holds
// at most WW_MAX_ARMY_DIVISIONS (24). Generals go by skill to the armies in
// this order (spec §6.4), so the main army of each country comes first.
export const START_OOB: Readonly<
  Partial<Record<CountryTag, readonly OobArmy[]>>
> = {
  // Germany: infantry 36, armored 3, mountain 3, cavalry 1 (43).
  DEU: [
    {
      // East: Lower Silesia, Upper Silesia, Pomerania.
      regions: [335, 352, 271],
      divisions: [
        ["infantry", 14],
        ["mountain", 3],
        ["cavalry", 1],
      ],
    },
    {
      // West: Rheinland-Pfalz, Nordrhein-Westfalen.
      regions: [356, 322],
      divisions: [["infantry", 14]],
    },
    {
      // Reserve: Berlin.
      regions: [306],
      divisions: [
        ["infantry", 8],
        ["armored", 3],
      ],
    },
  ],
  // Italy: binary 60, alpini 6, celere 2, colonial 12 (80).
  ITA: [
    {
      // Ethiopian front, north: Eritrea; marching on Addis Ababa.
      regions: [980],
      divisions: [
        ["binary", 12],
        ["colonial", 6],
      ],
      planTargets: [1056],
    },
    {
      // Ethiopian front, south: Italian Somaliland; marching on Addis Ababa.
      regions: [1039],
      divisions: [
        ["binary", 2],
        ["colonial", 4],
      ],
      planTargets: [1056],
    },
    {
      // Libya: Tripolitania, Ajdabiya (Cyrenaica).
      regions: [809, 812],
      divisions: [
        ["binary", 6],
        ["colonial", 2],
      ],
    },
    {
      // North: Turin, Milano.
      regions: [494, 482],
      divisions: [
        ["binary", 16],
        ["alpini", 6],
        ["celere", 2],
      ],
    },
    {
      // South: Roma, Napoli.
      regions: [576, 609],
      divisions: [["binary", 24]],
    },
  ],
  // Japan: square 17, cavalry brigades 4, garrisons 4 (25). Japan has no
  // named generals (titles only): the Kwantung and home armies start under
  // titled generals, the two smaller armies under none. No Japanese army
  // starts in Korea or Taiwan (controller ruling on final review B M5, the
  // spirit of "no Japanese base there"): the 1936 Korea garrison's two
  // divisions stand in the Kwantung lease, the Taiwan garrison in Kyūshū.
  JPN: [
    {
      // Kwantung Army: the Kwantung lease, then Manchukuo's Jilin and
      // Liaoning (its own camp, spec §7.1).
      regions: [666, 486, 553],
      divisions: [
        ["square", 5],
        ["cavalry_brigade", 3],
        ["garrison", 1],
      ],
      titledGeneral: true,
    },
    {
      // Home islands: Tokyo, Ōsaka.
      regions: [758, 766],
      divisions: [
        ["square", 10],
        ["cavalry_brigade", 1],
        ["garrison", 2],
      ],
      titledGeneral: true,
    },
    {
      // The Korea garrison's divisions, moved out: Kwantung.
      regions: [666],
      divisions: [["square", 2]],
    },
    {
      // The Taiwan garrison, moved out: Kumamoto (Kyūshū), else Tokyo.
      regions: [800, 758],
      divisions: [["garrison", 1]],
    },
  ],
  // United Kingdom: infantry 12, mobile 1, colonial garrisons 8 (21).
  GBR: [
    {
      // Home: London, Hampshire (Aldershot).
      regions: [329, 337],
      divisions: [
        ["infantry", 10],
        ["mobile", 1],
      ],
    },
    {
      // Egypt and Palestine: Cairo.
      regions: [767],
      divisions: [
        ["infantry", 2],
        ["colonial_garrison", 2],
      ],
    },
    {
      // Malaya and Hong Kong: Malaya, Hong Kong.
      regions: [1087, 927],
      divisions: [["colonial_garrison", 3]],
    },
    {
      // East Africa: Nairobi, Khartoum.
      regions: [1104, 933],
      divisions: [["colonial_garrison", 3]],
    },
  ],
  // France: infantry 40, DLM 2, colonial 25, cavalry 4 (71).
  FRA: [
    {
      // North-east 1 (the Maginot Line): Moselle, Meuse.
      regions: [390, 376],
      divisions: [
        ["infantry", 20],
        ["dlm", 2],
        ["cavalry", 2],
      ],
    },
    {
      // North-east 2 (the Belgian border): Pas-de-Calais, Marne.
      regions: [353, 379],
      divisions: [
        ["infantry", 14],
        ["cavalry", 2],
      ],
    },
    {
      // Alps: Savoie, Alpes-Maritimes.
      regions: [497, 531],
      divisions: [["infantry", 6]],
    },
    {
      // North Africa: Alger, Tunis, Grand Casablanca.
      regions: [733, 725, 787],
      divisions: [["colonial", 17]],
    },
    {
      // Levant: Aleppo.
      regions: [729],
      divisions: [["colonial", 4]],
    },
    {
      // Indochina: Ha Noi, Saigon.
      regions: [918, 988],
      divisions: [["colonial", 4]],
    },
  ],
  // United States: square 9, cavalry 2, garrisons 6 (17).
  USA: [
    {
      // Home: Texas, District of Columbia.
      regions: [749, 662],
      divisions: [
        ["square", 9],
        ["cavalry", 2],
      ],
    },
    {
      // Philippines.
      regions: [945],
      divisions: [["garrison", 2]],
    },
    {
      // Hawaii (and Panama, which has no US region on the map).
      regions: [930],
      divisions: [["garrison", 4]],
    },
  ],
  // Soviet Union: rifle 100, cavalry 20, tank brigades 10, mountain 4 (134).
  SUN: [
    {
      // West 1 (Leningrad): Leningrad, Novgorod.
      regions: [163, 193],
      divisions: [
        ["rifle", 17],
        ["tank_brigade", 2],
      ],
    },
    {
      // West 2 (Belorussia): City of Minsk, Vitebsk.
      regions: [277, 247],
      divisions: [
        ["rifle", 18],
        ["cavalry", 4],
        ["tank_brigade", 2],
      ],
    },
    {
      // West 3 (Kiev): Kiev City, Zhytomyr.
      regions: [344, 341],
      divisions: [
        ["rifle", 17],
        ["cavalry", 5],
        ["tank_brigade", 2],
      ],
    },
    {
      // West 4 (the Romanian border): Odessa, Khmel'nyts'kyy.
      regions: [429, 364],
      divisions: [
        ["rifle", 18],
        ["cavalry", 3],
        ["tank_brigade", 2],
      ],
    },
    {
      // Caucasus: Tbilisi, Bakı.
      regions: [601, 603],
      divisions: [
        ["rifle", 6],
        ["cavalry", 2],
        ["mountain_rifle", 4],
      ],
    },
    {
      // Central Asia: Tashkent, Stalinabad.
      regions: [570, 669],
      divisions: [
        ["rifle", 4],
        ["cavalry", 4],
      ],
    },
    {
      // Far East: Khabarovsk (S), Primor'ye.
      regions: [251, 424],
      divisions: [
        ["rifle", 20],
        ["cavalry", 2],
        ["tank_brigade", 2],
      ],
    },
  ],
};

/** Spec §6.4 "그 밖": min(50, startArmy × r / men), r by development. */
export function genericDivisions(
  startArmy: number,
  dev: number,
  divisionMen: number,
): number {
  const pct = dev >= 3 ? 100 : dev === 2 ? 50 : 30;
  return Math.max(
    0,
    Math.min(
      50,
      Math.floor((startArmy * pct) / 100 / Math.max(1, divisionMen)),
    ),
  );
}
