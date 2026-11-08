// Great War 1914: statecraft's tables and the papers made from them (ww157).
// A later country adds its file's rows here, one line each.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOption, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "../../CraftRows";
import {
  AUH_CRAFT_SCENES,
  AUH_FOOTING,
  AUH_INVENTIONS,
  AUH_PROJECTS,
  AUH_SHORTAGES,
} from "../craft/auh";
import {
  DEU_CRAFT_SCENES,
  DEU_FOOTING,
  DEU_INVENTIONS,
  DEU_PROJECTS,
  DEU_SHORTAGES,
} from "../craft/deu";
import {
  GBR_CRAFT_SCENES,
  GBR_FOOTING,
  GBR_INVENTIONS,
  GBR_PROJECTS,
  GBR_SHORTAGES,
} from "../craft/gbr";
import { invent, project, projectAt, usedEarly } from "../craft/kit";
import {
  RUS_CRAFT_SCENES,
  RUS_FOOTING,
  RUS_INVENTIONS,
  RUS_PROJECTS,
  RUS_SHORTAGES,
} from "../craft/rus";

export const GW_INVENTIONS: readonly GwInventionRow[] = [
  ...DEU_INVENTIONS,
  ...GBR_INVENTIONS,
  ...AUH_INVENTIONS,
  ...RUS_INVENTIONS,
];
export const GW_PROJECTS: readonly GwProjectRow[] = [
  ...DEU_PROJECTS,
  ...GBR_PROJECTS,
  ...AUH_PROJECTS,
  ...RUS_PROJECTS,
];
export const GW_FOOTING: readonly GwFootingRow[] = [
  DEU_FOOTING,
  GBR_FOOTING,
  AUH_FOOTING,
  RUS_FOOTING,
].filter((x): x is GwFootingRow => x !== null);
export const GW_SHORTAGE_ROWS: readonly GwShortageRow[] = [
  ...DEU_SHORTAGES,
  ...GBR_SHORTAGES,
  ...AUH_SHORTAGES,
  ...RUS_SHORTAGES,
];

const opt = (id: string, effects: GwOption["effects"]): GwOption => ({
  id,
  tell: [],
  effects,
});

/** An invention's four papers. Results show only after: no tells. */
export function inventionScenes(row: GwInventionRow): GwScene[] {
  const base = {
    nation: [row.tag],
    scheduledOnly: true,
    once: true,
    tags: ["war" as const],
    cast: { inventor: { past: row.inventor }, ...row.cast },
  };
  return [
    {
      ...base,
      id: row.id,
      kind: "proposal",
      salience: 6,
      variants: [...(row.variants ?? []), { id: "base" }],
      fallback: "quiet",
      options: [
        opt("back", [invent(row.id, "back")]),
        opt("quiet", [invent(row.id, "quiet")]),
        opt("refuse", [invent(row.id, "refuse")]),
      ],
    },
    {
      ...base,
      id: `${row.id}_ok`,
      kind: "proposal",
      salience: 7,
      variants: [{ id: "base" }],
      fallback: "wait",
      options: [opt("field", [invent(row.id, "field")]), opt("wait", [])],
    },
    {
      ...base,
      id: `${row.id}_fail`,
      kind: "proposal",
      // Twice at most: a retry can fail again.
      once: false,
      cooldown: 0,
      salience: 6,
      variants: [{ id: "base" }],
      fallback: "retry",
      options: [
        opt("retry", [invent(row.id, "retry")]),
        opt("drop", [invent(row.id, "drop")]),
      ],
    },
    {
      ...base,
      id: `${row.id}_used`,
      kind: "wire",
      salience: 7,
      variants: [{ id: "early", when: usedEarly(row.id) }, { id: "base" }],
    },
  ];
}

/** The year's pick for a country: one option a project, and "not this year". */
export function agendaScene(
  tag: GwTag,
  rows: readonly GwProjectRow[],
): GwScene {
  return {
    id: `${tag.toLowerCase()}_agenda`,
    nation: [tag],
    kind: "proposal",
    scheduledOnly: true,
    salience: 7,
    tags: ["home"],
    cast: {},
    noBack: true,
    variants: [{ id: "base" }],
    fallback: "later",
    options: [
      ...rows.map((r) => {
        const free = projectAt(r.id, "idle", "dropped");
        const o = opt(r.id, [project("start", r.id)]);
        return {
          ...o,
          when: r.opens === undefined ? free : all(r.opens, free),
        };
      }),
      opt("later", [project("later")]),
    ],
  };
}

/** Every paper made from the rows; fixtures pass their own rows. */
export function craftScenes(
  inventions: readonly GwInventionRow[],
  projects: readonly GwProjectRow[],
): GwScene[] {
  const tags = [...new Set(projects.map((r) => r.tag))];
  return [
    ...inventions.flatMap(inventionScenes),
    ...tags.map((t) =>
      agendaScene(
        t,
        projects.filter((r) => r.tag === t),
      ),
    ),
  ];
}

export const CRAFT_SCENES: readonly GwScene[] = [
  ...craftScenes(GW_INVENTIONS, GW_PROJECTS),
  ...DEU_CRAFT_SCENES,
  ...GBR_CRAFT_SCENES,
  ...AUH_CRAFT_SCENES,
  ...RUS_CRAFT_SCENES,
];
