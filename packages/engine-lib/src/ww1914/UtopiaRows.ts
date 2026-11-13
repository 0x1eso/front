// Great War 1914 (ww207/ww208): the faction utopias, after Frostpunk 2's Utopia
// trees. The seven templates in content/utopia/templates.ts (C lane), each
// seat's trees in content/utopia/<tag>.ts (W lanes); text gw.utopia.* (C) and
// pack `utopia.<faction>.*` in <TAG>.house.json (W). engine/ww1914/Utopia runs
// them (S2). See /home/eser/dev/ww207-format.md.
import type {
  GwAxisPush,
  GwNodeKind,
  GwNodeTier,
  GwTreeTemplate,
} from "@openfront/engine-api/ww1914/GwSociety";
import type { GwCond, GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";

/** A node of a tree: what 연다 gives. */
export interface GwNodeRow {
  /** Unique in its tree: `m1`..`m3`, `b1`..`b3`, `x1`..`x3` in templates. */
  readonly id: string;
  readonly tier: GwNodeTier;
  readonly kind: GwNodeKind;
  /** kind `law`: the exclusive law row (GwLawRow `exclusive`) it brings into the book. */
  readonly law?: string;
  /** kind `institution`: its id (a ministry, a paper, a militia, a council); text gw.utopia.institution.<id>. */
  readonly institution?: string;
  /** kind `ability`: the power row it makes stronger (its `ability.strong`). */
  readonly power?: string;
  /** It opens only while this holds, besides the tier before. */
  readonly when?: GwCond;
  /** Once, on opening: perks (econ terms, a bloc floor), institutions' effects. */
  readonly effects?: readonly GwEffect[];
  /** Axis notches it moves on opening. */
  readonly axes?: GwAxisPush;
}

/** A template: nine nodes, three a tier, in order. */
export interface GwTreeTemplateRow {
  readonly id: GwTreeTemplate;
  readonly nodes: readonly GwNodeRow[];
}

/** A faction's tree: a template, named and bent, with 1-2 nodes of its own. */
export interface GwTreeRow {
  /** The faction row. */
  readonly faction: string;
  readonly template: GwTreeTemplate;
  /** The utopia's id: pack utopia.<id>.{name,note} (사회민주 독일). */
  readonly utopia: string;
  /** Template node id -> what this faction changes in it (its law, its words). */
  readonly bend?: Readonly<
    Record<string, Partial<Omit<GwNodeRow, "id" | "tier">>>
  >;
  /** Its own nodes, replacing template nodes of the same tier (`replaces`). */
  readonly own?: readonly (GwNodeRow & { readonly replaces: string })[];
  /** The regime it brings when realised (engine Regimes id); none: the regime stays. */
  readonly regime?: string;
  /**
   * Decision 1B: the head the seat can play on as when the regime removes
   * the person (a ruler row, lane P); absent: the person stays, or none.
   */
  readonly head?: string;
  /** Realised, its state holds too (land held for 승리의 독일). */
  readonly when?: GwCond;
  /** Once, on realisation, after society is absorbed. */
  readonly realised?: readonly GwEffect[];
  /** The scene of realisation (`scheduledOnly`); the common card if absent. */
  readonly scene?: string;
}

/** Everything the utopias read from content, as GwContent carries it. */
export interface GwUtopiaContent {
  readonly templates?: readonly GwTreeTemplateRow[];
  readonly trees?: readonly GwTreeRow[];
}

export function joinUtopia(parts: readonly GwUtopiaContent[]): GwUtopiaContent {
  return {
    templates: parts.flatMap((p) => p.templates ?? []),
    trees: parts.flatMap((p) => p.trees ?? []),
  };
}

/** Affinity a month from the axes: per step the axes stand on each ideal. */
export const GW_AFFINITY_AXIS = 2;
/** Affinity a passed bill of its own, a project done, brings. */
export const GW_AFFINITY_BILL = 5;
