import type {
  GwEffect,
  GwNode,
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
import { GW_HOUSE_LAWS, houseBill, NOT_HOUSE_BROUGHT } from "./house";

/** Every bill. A later country adds its file of rows here. */
export const GW_LAWS: readonly GwLawRow[] = [
  ...DEU_LAWS,
  ...GBR_LAWS,
  ...AUH_LAWS,
  ...RUS_LAWS,
  ...GW_HOUSE_LAWS,
];

/** Never drawn: the engine calls these (engine/ww1914/Laws). */
const onlyCalled = flag("gw_world_called_only");

const act = (e: Parameters<typeof doWorld>[0]): GwEffect => doWorld(e);

/** The card of the drafting: each option is a text of the bill. */
function draftScene(row: GwLawRow, house: boolean): GwScene {
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
        // A bill the house runs (ww158) shows no price on its old card either.
        tell: house ? [] : [...d.tell],
        effects: [
          act({ do: "law_text", law: row.id, text: d.id, support: d.support }),
          ...d.effects,
        ],
      };
      return d.when === undefined ? o : { ...o, when: d.when };
    }),
  };
}

/**
 * The day: the same four doors for every bill, in the country's own words. A
 * bill the house runs (ww158) shows no price: the count is the count, and the
 * way round's price comes after; a bill the house brought can't be withdrawn.
 */
function dayScene(row: GwLawRow, house: boolean): GwScene {
  const law = row.id;
  const says = house ? [] : [...row.passedTell, ...lawTermTell(row)];
  const d = GW_LAW_HOME[row.tag]?.decree ?? null;
  const options: GwOption[] = [
    { id: "put", tell: says, effects: [act({ do: "law_put", law })] },
  ];
  // A house bill always shows the way round: greyed, with the pack's why, where
  // the constitution doesn't reach it.
  if (house || (row.decree && d !== null)) {
    options.push({
      id: "decree",
      when: world({ is: "law_decree", id: law }),
      tell:
        house || d === null
          ? []
          : [`authority:-${d.price}`, `${d.inst}:${d.delta}`, ...says],
      effects: [act({ do: "law_decree", law })],
    });
  }
  options.push(
    { id: "hold", tell: [], effects: [act({ do: "law_hold", law })] },
    {
      id: "withdraw",
      tell: [],
      effects: [act({ do: "law_withdraw", law })],
      ...(house ? { when: NOT_HOUSE_BROUGHT(law) } : {}),
    },
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
      // A house bill's day reads the whip's word, right or wrong, not the count.
      {
        id: "short",
        when: house
          ? world({ is: "whip_said", of: ["short", "hopeless"] })
          : world({ is: "law_count", id: law, max: -1 }),
      },
      { id: "base" },
    ],
    fallback: "put",
    options,
  };
}

/** The sponsor's talk on a house bill: the same nodes, no price shown. */
function untold(row: GwLawRow): Record<string, GwNode> {
  return Object.fromEntries(
    Object.entries(row.talk.nodes).map(([id, n]) => [
      id,
      { ...n, replies: n.replies.map((r) => ({ ...r, tell: [] })) },
    ]),
  );
}

function talkScene(row: GwLawRow, house: boolean): GwScene {
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
    nodes: house ? untold(row) : { ...row.talk.nodes },
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

/**
 * A bill's papers. `house`: the house runs it (ww158): no price shows before
 * the pick, and the day reads the whip's word, not the count.
 */
export function lawScenes(
  row: GwLawRow,
  house = houseBill(row.id) !== null,
): GwScene[] {
  return [
    draftScene(row, house),
    dayScene(row, house),
    talkScene(row, house),
    ...afterScene(row),
  ];
}

export const LAW_SCENES: readonly GwScene[] = GW_LAWS.flatMap((row) =>
  lawScenes(row),
);
