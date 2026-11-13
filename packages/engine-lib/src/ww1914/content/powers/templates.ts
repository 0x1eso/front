// Great War 1914 (ww208 merge): the ability a template gives the parties that
// have no row of their own (design §7: "born factions get the ability of
// their template"): every generic party (S1's peasants, nationalists,
// veterans and peace parties) and every born real party (a birth row's
// faction) that no power row names. One row a party, on the 정당 group; it
// shows while the party stands. Text in resources/ww1914/ko/common.powers.json
// (`powers.<id>`, and `reasons.gw_ab_<template>` for its news line).
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwTreeTemplate } from "@openfront/engine-api/ww1914/GwSociety";
import type { GwEffect, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { genericFactionRows } from "../../GenericParties";
import type { GwFactionRow } from "../../HouseRows";
import { GW_RALLY_SCENE, type GwPowerRow } from "../../PowerRows";
import type { GwSocietyContent } from "../../SocietyRows";
import type { GwUtopiaContent } from "../../UtopiaRows";
import type { GwContent } from "../Content";
import { called, opt, v } from "../scenes/ruler_kit";

type G = "morale" | "order" | "money" | "shells" | "bread";
const gauge = (g: G, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const opinion = (bloc: string, delta: number): GwEffect =>
  ({ kind: "opinion", bloc, delta }) as GwEffect;
const reason = (key: string): GwEffect => ({ kind: "reason", key });

interface Ability {
  readonly effects: readonly GwEffect[];
  readonly strong: readonly GwEffect[];
  readonly turned: readonly GwEffect[];
}

/** What a template's party does when asked, strong, and turned. */
export const GW_TEMPLATE_ABILITIES: Readonly<Record<GwTreeTemplate, Ability>> =
  {
    parliament: {
      effects: [gauge("morale", 1), opinion("press", 1)],
      strong: [gauge("morale", 2), opinion("press", 1)],
      turned: [gauge("order", -1), opinion("press", -1)],
    },
    labour: {
      effects: [gauge("shells", 1), gauge("order", 1)],
      strong: [gauge("shells", 1), gauge("order", 1), gauge("bread", 1)],
      turned: [gauge("shells", -1), gauge("order", -1)],
    },
    crown_army: {
      effects: [gauge("order", 1), opinion("army", 1)],
      strong: [gauge("order", 2), opinion("army", 1)],
      turned: [gauge("order", -1), opinion("army", -1)],
    },
    nation: {
      effects: [gauge("order", 1)],
      strong: [gauge("order", 1), gauge("morale", 1)],
      turned: [gauge("order", -2)],
    },
    church: {
      effects: [gauge("morale", 1)],
      strong: [gauge("morale", 2)],
      turned: [gauge("morale", -1), gauge("order", -1)],
    },
    market_empire: {
      effects: [gauge("money", 1)],
      strong: [gauge("money", 2)],
      turned: [gauge("money", -2)],
    },
    peace: {
      effects: [gauge("order", 1), gauge("morale", -1)],
      strong: [gauge("order", 2)],
      turned: [gauge("morale", -1), gauge("order", -1)],
    },
  };

/** `deu_g_peasants` -> `deu_pw_ab_g_peasants`. */
export function templateAbilityId(faction: string): string {
  const cut = faction.indexOf("_");
  return `${faction.slice(0, cut)}_pw_ab_${faction.slice(cut + 1)}`;
}

function rowFor(f: GwFactionRow, t: GwTreeTemplate): GwPowerRow {
  const a = GW_TEMPLATE_ABILITIES[t];
  const news = reason(`gw_ab_${t}`);
  return {
    id: templateAbilityId(f.id),
    tag: f.tag as GwTag,
    group: "factions",
    kind: "custom",
    shows: {
      kind: "world",
      of: { is: "faction", id: f.id, of: ["in", "under"] },
    },
    tags: ["ability"],
    effects: [...a.effects, news],
    ability: {
      faction: f.id,
      strong: [...a.strong, news],
      turned: { effects: [...a.turned] },
    },
  };
}

/**
 * The template rows: generic parties, and born real parties that no power
 * row in `powers` names (by `ability.faction` or the faction's `ability`).
 */
export function templateAbilityRows(
  base: {
    readonly houses?: GwContent["houses"];
    readonly factions?: readonly GwFactionRow[];
    readonly society?: GwSocietyContent;
    readonly utopia?: GwUtopiaContent;
  },
  powers: readonly GwPowerRow[],
): GwPowerRow[] {
  const named = new Set(
    powers.flatMap((p) => (p.ability === undefined ? [] : [p.ability.faction])),
  );
  const born = new Set((base.society?.births ?? []).map((b) => b.faction));
  const real = (base.factions ?? []).filter(
    (f) => born.has(f.id) && f.ability === undefined,
  );
  const generic = genericFactionRows(base as GwContent);
  const out: GwPowerRow[] = [];
  // A party with a tree has its tree's template.
  const trees = base.utopia?.trees ?? [];
  for (const f of [...real, ...generic]) {
    const t = f.template ?? trees.find((x) => x.faction === f.id)?.template;
    if (t === undefined || named.has(f.id)) continue;
    out.push(rowFor(f, t));
  }
  return out;
}

const rally = (reward: "support" | "order" | "morale"): GwEffect => ({
  kind: "world",
  of: { do: "rally_reward", reward },
});

/**
 * The rally card (FP2's rally: the player picks the reward). Utopia.stir lays
 * it when a faction that trusts the seat rallies (S2); the party is named by
 * the reason line before it. Text: common.powers.json `scenes.gw_rally`.
 */
export const GW_RALLY_SCENES: readonly GwScene[] = [
  called({
    id: GW_RALLY_SCENE,
    nation: ["DEU", "GBR", "FRA", "RUS", "AUH"],
    kind: "crisis",
    cast: {},
    salience: 6,
    variants: [v("base")],
    fallback: "grow",
    options: [
      opt("grow", [rally("support")]),
      opt("order", [rally("order")]),
      opt("morale", [rally("morale")]),
    ],
  }),
];
