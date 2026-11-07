import type {
  GwEffect,
  GwOption,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { flag } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GW_LAW_HOME, GwLawRow, lawTermTell } from "../../LawRows";
import { AUH_LAWS } from "../laws/auh";
import { DEU_LAWS } from "../laws/deu";
import { GBR_LAWS } from "../laws/gbr";
import { RUS_LAWS } from "../laws/rus";

/** Every bill. A later country adds its file of rows here. */
export const GW_LAWS: readonly GwLawRow[] = [
  ...DEU_LAWS,
  ...GBR_LAWS,
  ...AUH_LAWS,
  ...RUS_LAWS,
];

/** Never drawn: the engine calls these (engine/ww1914/Laws). */
const onlyCalled = flag("gw_world_called_only");

const act = (e: Parameters<typeof doWorld>[0]): GwEffect => doWorld(e);

/** The card of the drafting: each option is a text of the bill. */
function draftScene(row: GwLawRow): GwScene {
  return {
    id: `gw_law_${row.id}`,
    nation: [row.tag],
    kind: "proposal",
    cast: { ...row.cast },
    salience: 6,
    tags: ["home"],
    when: onlyCalled,
    variants: [...(row.variants ?? []), { id: "base" }],
    fallback: row.draft[0].id,
    options: row.draft.map((d) => {
      const o: GwOption = {
        id: d.id,
        tell: [...d.tell],
        effects: [
          act({ do: "law_text", law: row.id, text: d.id, support: d.support }),
          ...d.effects,
        ],
      };
      return d.when === undefined ? o : { ...o, when: d.when };
    }),
  };
}

/** The day: the same four doors for every bill, in the country's own words. */
function dayScene(row: GwLawRow): GwScene {
  const law = row.id;
  const says = [...row.passedTell, ...lawTermTell(row)];
  const d = GW_LAW_HOME[row.tag]?.decree ?? null;
  const options: GwOption[] = [
    { id: "put", tell: says, effects: [act({ do: "law_put", law })] },
  ];
  if (row.decree && d !== null) {
    options.push({
      id: "decree",
      when: world({ is: "law_decree", id: law }),
      tell: [`authority:-${d.price}`, `${d.inst}:${d.delta}`, ...says],
      effects: [act({ do: "law_decree", law })],
    });
  }
  options.push(
    { id: "hold", tell: [], effects: [act({ do: "law_hold", law })] },
    { id: "withdraw", tell: [], effects: [act({ do: "law_withdraw", law })] },
  );
  return {
    id: `gw_lv_${law}`,
    nation: [row.tag],
    kind: "proposal",
    cast: { ...row.cast },
    salience: 7,
    tags: ["home"],
    when: onlyCalled,
    variants: [
      { id: "short", when: world({ is: "law_count", id: law, max: -1 }) },
      { id: "base" },
    ],
    fallback: "put",
    options,
  };
}

function talkScene(row: GwLawRow): GwScene {
  return {
    id: `gw_lt_${row.id}`,
    nation: [row.tag],
    kind: "talk",
    when: world({ is: "law", id: row.id, of: ["persuade", "vote"] }),
    cast: { who: row.talk.who },
    salience: 1,
    tags: ["people", "home"],
    who: "who",
    variants: [{ id: "base" }],
    start: row.talk.start,
    nodes: { ...row.talk.nodes },
    once: true,
    summon: true,
  };
}

function afterScene(row: GwLawRow): GwScene[] {
  if (row.after === undefined) return [];
  return [
    {
      id: `gw_lf_${row.id}`,
      nation: [row.tag],
      kind: "proposal",
      cast: { ...(row.after.cast ?? row.cast) },
      salience: 6,
      tags: ["home"],
      when: onlyCalled,
      variants: [{ id: "base" }],
      fallback: row.after.options[0].id,
      options: [...row.after.options],
    },
  ];
}

export const LAW_SCENES: readonly GwScene[] = GW_LAWS.flatMap((row) => [
  draftScene(row),
  dayScene(row),
  talkScene(row),
  ...afterScene(row),
]);
