// Great War 1914: the dossier's papers and the schedule's file entry (ww158, S2),
// made from the house rows for every country with people in `<TAG>_WEAK`. The
// nation lane writes their text in `<TAG>.house.json` (ids in HouseRows
// `dossierIds`); the engine is engine/ww1914/Dossier.
import type { GwAct } from "@openfront/engine-api/ww1914/GwActs";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwCastRule, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  reason,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  dossierIds,
  dossierTags,
  GW_FILE_CAUGHT,
  GwHouseContent,
  GwHouseRow,
} from "../../HouseRows";

const target = role("target");
const policeOf = (h: GwHouseRow | undefined): GwCastRule =>
  h?.police ?? { office: "interior" };

function paper(
  id: string,
  tag: GwTag,
  cast: Record<string, GwCastRule>,
  rest: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: [tag],
    kind: "wire",
    scheduledOnly: true,
    cast,
    salience: 5,
    tags: ["home", "people"],
    variants: [{ id: "base" }],
    ...rest,
  };
}

/** One country's four papers. */
function papers(tag: GwTag, house: GwHouseRow | undefined): GwScene[] {
  const police = policeOf(house);
  return [
    // The police's paper on the file asked for: found, or nothing on him.
    paper(
      dossierIds.report(tag),
      tag,
      { police, target: { picked: "target" } },
      {
        byAct: true,
        variants: [
          { id: "found", when: world({ is: "file", who: target }) },
          { id: "base" },
        ],
      },
    ),
    paper(dossierIds.unasked(tag), tag, { police, target: { called: true } }),
    // He found out he was watched: he comes to say so.
    {
      id: dossierIds.caught(tag),
      nation: [tag],
      kind: "audience",
      scheduledOnly: true,
      byAct: true,
      cast: { target: { picked: "target" } },
      salience: 6,
      tags: ["home", "people"],
      variants: [{ id: "base" }],
      fallback: "own_up",
      options: [
        {
          id: "own_up",
          tell: [],
          effects: [
            trustOf(target, -1),
            remember("file_watched", target),
            reason("file_caught_owned", target),
          ],
        },
        {
          id: "deny",
          tell: [],
          effects: [
            trustOf(target, -2),
            { kind: "rumour", delta: 1 },
            remember("file_watched", target),
            reason("file_caught_denied", target),
          ],
        },
      ],
    },
    paper(dossierIds.scandal(tag), tag, { target: { called: true } }, {
      salience: 7,
    }),
  ];
}

/** The dossier's papers for every country that has weaknesses written. */
export function gwDossierScenes(rows: GwHouseContent): GwScene[] {
  return dossierTags(rows).flatMap((t) =>
    papers(
      t,
      (rows.houses ?? []).find((h) => h.tag === t),
    ),
  );
}

/** The schedule's entry: the police open a file on one of our people. */
export function gwDossierActs(rows: GwHouseContent): GwAct[] {
  return dossierTags(rows).map((t) => ({
    id: dossierIds.act(t),
    nation: [t],
    kind: "intrigue",
    cooldown: 4,
    scene: dossierIds.report(t),
    wait: 1,
    fields: [{ id: "target", people: "own" }],
    effects: [doWorld({ do: "file", who: target })],
    caught: { pct: GW_FILE_CAUGHT, scene: dossierIds.caught(t), wait: 2 },
  }));
}
