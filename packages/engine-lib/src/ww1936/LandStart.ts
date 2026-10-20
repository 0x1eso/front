// World War 1936 P2: the 1936 templates, land techs and order of battle
// (P2 spec §4.5, §4.6, §6.4). The functions are the foundation's; Task 10
// fills START_OOB.
import { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  SupportId,
  TemplateDef,
} from "@openfront/engine-api/ww1936/LandTypes";

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
}

// Spec §6.4 majors; used only when scenario.json says historicalOob (plan
// decision 14). Task 10 fills it.
export const START_OOB: Readonly<
  Partial<Record<CountryTag, readonly OobArmy[]>>
> = {};

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
