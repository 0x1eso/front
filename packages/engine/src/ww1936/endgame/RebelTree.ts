// ww229 (design ww227 §2, owner D6): a civil war's rebels on a country with
// its own national tree play that tree, with every focus the country has
// done (or bypassed) already done, and nothing running. ww232 (owner): a
// major's rebels the same way, on the major's tree (its variant paths are
// focuses of the same tree). Countries on the generic tree or a regional
// pack keep what the rebels' slot gets today.
//
// The tree reads the same for the rebels: the country flags its focuses
// test come along. What a tree does as its original tag stays with that
// tag: its history path (the rebels' AI picks by weight), its beats (they
// act on the tag's own country), its balance of power and its decisions.
import {
  CIVIL_WAR_SLOTS,
  COUNTRIES,
  type CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  type FocusTreeId,
  isNationTree,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { ContentRegistry } from "@openfront/engine-lib/ww1936/content/registry";
import { conditionLeaves } from "@openfront/engine-lib/ww1936/Describe";
import type { WwEndgame } from "./WwEndgame";

/** ww232: a tree the rebels take with them: a minor's national tree or a major's own. */
export function inheritedTree(tree: FocusTreeId): boolean {
  if (isNationTree(tree)) return true;
  const row = (COUNTRIES as Partial<Record<string, { major: boolean }>>)[tree];
  return row?.major === true;
}

/** ww232: rebels on a tree they took with them (the AI leaves its history path). */
export function rebelOnInheritedTree(
  tag: CountryTag,
  tree: FocusTreeId,
): boolean {
  return (
    (CIVIL_WAR_SLOTS as readonly string[]).includes(tag) && inheritedTree(tree)
  );
}

/**
 * ww229 MA1 (owner): the tag rebels on a tree they took with them claim to
 * be (the tree is the tag's own: a major's or a minor's national tree); their
 * decision table is that tag's as well. Null for everyone else.
 */
export function rebelClaimedTag(
  tag: CountryTag,
  tree: FocusTreeId,
): CountryTag | null {
  if (!rebelOnInheritedTree(tag, tree)) return null;
  return tree in COUNTRIES ? (tree as CountryTag) : null;
}

export function inheritNationTree(eg: WwEndgame, X: number, R: number): void {
  const pol = eg.ww.politics;
  const xc = pol.country(X);
  const rc = pol.country(R);
  if (xc === null || rc === null || !inheritedTree(xc.tree)) return;
  rc.tree = xc.tree;
  rc.focusState = xc.focusState.map((s) => (s === 1 || s === 2 ? s : 0));
  rc.focus = null;
  rc.queue = [];
  // ww232: the flags the tree's own conditions read, as the country holds them.
  for (const f of treeFlags(pol.content, xc.tree)) {
    const v = xc.flags.get(f);
    if (v !== undefined) rc.flags.set(f, [v[0], v[1]]);
  }
  // ww229 MA1 (owner): the decisions the tree's focuses unlocked (or locked)
  // for the country stay so for the rebels.
  for (const d of treeDecisions(pol.content, xc.tree)) {
    if (xc.unlocked.has(d)) {
      rc.unlocked.add(d);
      rc.locked.delete(d);
    }
    if (xc.locked.has(d)) rc.locked.add(d);
  }
  pol.markCountry(R);
}

/** Decisions by tree (derived from the content, never state). */
const TREE_DECISIONS = new WeakMap<
  ContentRegistry,
  Map<FocusTreeId, readonly string[]>
>();

/**
 * ww229 MA1: the decisions a tree's focuses unlock or lock on their own
 * country (`unlock_decision` / `lock_decision`, also inside `if` and
 * `random_list`), in first-seen order.
 */
export function treeDecisions(
  content: ContentRegistry,
  tree: FocusTreeId,
): readonly string[] {
  let byTree = TREE_DECISIONS.get(content);
  if (byTree === undefined) TREE_DECISIONS.set(content, (byTree = new Map()));
  const known = byTree.get(tree);
  if (known !== undefined) return known;
  const out: string[] = [];
  const effects = (list: readonly Effect[]) => {
    for (const e of list) {
      if (e.kind === "if") {
        effects(e.then);
        effects(e.else ?? []);
      } else if (e.kind === "random_list") {
        for (const o of e.options) effects(o.effects);
      } else if (e.kind === "unlock_decision" || e.kind === "lock_decision") {
        const who = (e as { who?: unknown }).who;
        if (who !== undefined && who !== "self") continue;
        if (!out.includes(e.id)) out.push(e.id);
      }
    }
  };
  for (const i of content.treeFocuses[tree])
    effects(content.focuses[i].effects);
  byTree.set(tree, out);
  return out;
}

/** Flags by tree (derived from the content, never state). */
const TREE_FLAGS = new WeakMap<
  ContentRegistry,
  Map<FocusTreeId, readonly string[]>
>();

/**
 * The country flags a tree's focuses test on their own country (available,
 * bypass, cancelIf, the AI's weights, an `if` effect), in first-seen order.
 */
export function treeFlags(
  content: ContentRegistry,
  tree: FocusTreeId,
): readonly string[] {
  let byTree = TREE_FLAGS.get(content);
  if (byTree === undefined) TREE_FLAGS.set(content, (byTree = new Map()));
  const known = byTree.get(tree);
  if (known !== undefined) return known;
  const out: string[] = [];
  const cond = (c: Condition | undefined) => {
    for (const l of conditionLeaves(c)) {
      if (l.kind !== "flag" && l.kind !== "days_since_flag_ge") continue;
      if (l.who !== undefined && l.who !== "self") continue;
      if (!out.includes(l.flag)) out.push(l.flag);
    }
  };
  const effects = (list: readonly Effect[]) => {
    for (const e of list) {
      if (e.kind === "if") {
        cond(e.cond);
        effects(e.then);
        effects(e.else ?? []);
      } else if (e.kind === "random_list") {
        for (const o of e.options) effects(o.effects);
      }
    }
  };
  for (const i of content.treeFocuses[tree]) {
    const f = content.focuses[i];
    cond(f.available);
    cond(f.bypass);
    cond(f.cancelIf);
    for (const m of f.ai?.mods ?? []) cond(m.if);
    effects(f.effects);
  }
  byTree.set(tree, out);
  return out;
}
