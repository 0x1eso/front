// World War 1936 P3 (spec §20.4, plan decision 25): the explain lines of
// effects, conditions and stats, made from the data. The screens use them;
// the engine numbers the failing condition leaves in the same order.
import type {
  Condition,
  Effect,
  LeafCondition,
  RegionPick,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  WW_STAT_KEYS,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

/** Key families (lane T writes the keys, Task 9): ww1936.fx.<kind>, ww1936.cond.<kind>. */
const FX = "ww1936.fx.";
const COND = "ww1936.cond.";

export interface DescLine {
  /** ww1936.fx.<kind>, ww1936.cond.<kind>, ww1936.stat.<key>, or a header (…all, …any, …not, …else, …random_option). */
  key: string;
  params: Record<string, string | number>;
  depth: number;
  /** For conditions: the leaf number (conditionLeaves order); -1 for headers and effects. */
  leaf: number;
}

/** "@self", "@from", "@target", a tag, "@leader:<inner>", "@owner:<group>". */
export function selectorCode(s: Selector | undefined): string {
  if (s === undefined || s === "self") return "@self";
  if (s === "from" || s === "target") return `@${s}`;
  if ("tag" in s) return s.tag;
  if ("factionLeaderOf" in s) {
    return `@leader:${selectorCode(s.factionLeaderOf)}`;
  }
  return `@owner:${s.ownerOf}`;
}

export function pickCode(p: RegionPick): string {
  if (p === "capital") return "capital";
  if ("group" in p) return `group:${p.group}`;
  if ("best" in p) return `best:${p.best}${p.of ? `:${p.of}` : ""}`;
  if ("coreBest" in p) return `core:${p.coreBest}`;
  if ("borderWith" in p) {
    const w = p.borderWith === "threat" ? "threat" : selectorCode(p.borderWith);
    return `border:${w}:${p.n}`;
  }
  if ("acquired" in p) return `acquired:${p.n}`;
  if ("coastal" in p) return `coastal:${p.n}`;
  if ("withResources" in p) return `resources:${p.withResources}`;
  return `regions:${p.regions.join(",")}`;
}

/** Primitive fields as params; selectors and picks as codes; nested lists are lines of their own. */
function paramsOf(o: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const picks =
    o.kind === "move_buildings" ? ["where", "from", "to"] : ["where"];
  for (const [k, v] of Object.entries(o)) {
    if (k === "kind" || k === "then" || k === "else") continue;
    if (k === "options" || k === "cond") continue;
    if (typeof v === "number" || typeof v === "string") out[k] = v;
    else if (typeof v === "boolean") out[k] = v ? 1 : 0;
    else if (picks.includes(k)) out[k] = pickCode(v as RegionPick);
    else if (v !== undefined) out[k] = selectorCode(v as Selector);
  }
  if (!("who" in out)) out.who = "@self";
  return out;
}

export function describeEffects(
  effects: readonly Effect[],
  depth = 0,
): DescLine[] {
  const out: DescLine[] = [];
  for (const e of effects) {
    out.push({
      key: `${FX}${e.kind}`,
      params: paramsOf(e as Record<string, unknown>),
      depth,
      leaf: -1,
    });
    if (e.kind === "if") {
      out.push(
        ...describeCondition(e.cond, depth + 1).map((l) => ({
          ...l,
          leaf: -1,
        })),
      );
      out.push(...describeEffects(e.then, depth + 1));
      if (e.else !== undefined) {
        out.push({ key: `${FX}else`, params: {}, depth, leaf: -1 });
        out.push(...describeEffects(e.else, depth + 1));
      }
    } else if (e.kind === "random_list") {
      for (const o of e.options) {
        out.push({
          key: `${FX}random_option`,
          params: { weight: o.weight },
          depth: depth + 1,
          leaf: -1,
        });
        out.push(...describeEffects(o.effects, depth + 2));
      }
    }
  }
  return out;
}

/** Leaves in depth-first order; their index is the "leaf number". */
export function conditionLeaves(c: Condition | undefined): LeafCondition[] {
  if (c === undefined) return [];
  if ("all" in c) return c.all.flatMap(conditionLeaves);
  if ("any" in c) return c.any.flatMap(conditionLeaves);
  if ("not" in c) return conditionLeaves(c.not);
  return [c];
}

export function describeCondition(
  c: Condition | undefined,
  depth = 0,
): DescLine[] {
  const out: DescLine[] = [];
  let n = 0;
  const walk = (x: Condition, d: number): void => {
    if ("all" in x || "any" in x) {
      const list = "all" in x ? x.all : x.any;
      if (list.length > 1) {
        const key = `${COND}${"all" in x ? "all" : "any"}`;
        out.push({ key, params: {}, depth: d, leaf: -1 });
      }
      for (const y of list) walk(y, list.length > 1 ? d + 1 : d);
    } else if ("not" in x) {
      out.push({ key: `${COND}not`, params: {}, depth: d, leaf: -1 });
      walk(x.not, d + 1);
    } else {
      out.push({
        key: `${COND}${x.kind}`,
        params: paramsOf(x as Record<string, unknown>),
        depth: d,
        leaf: n++,
      });
    }
  };
  if (c !== undefined) walk(c, depth);
  return out;
}

/** One line per non-zero stat, WW_STAT_KEYS order. */
export function describeStats(s: Partial<WwStats>): DescLine[] {
  const out: DescLine[] = [];
  for (const k of WW_STAT_KEYS) {
    const v = s[k];
    if (v !== undefined && v !== 0) {
      out.push({
        key: `ww1936.stat.${k}`,
        params: { value: v },
        depth: 0,
        leaf: -1,
      });
    }
  }
  return out;
}
