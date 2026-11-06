// World War 1936: the whole start army planned in the lobby (start_oob).
// The pure rule, called by the engine (land/StartOob) and by the lobby, so
// the preview is the result: how many divisions of each template each of
// the country's start armies really fields, from the men budget and the
// stock (full-strength divisions only).
import { WW_MAX_ARMY_DIVISIONS } from "@openfront/engine-api/ww1936/LandTypes";
import type { OobArmy } from "./LandStart";
import { CUTTING_GROUP, FILLABLE_GROUP } from "./StartReform";
import { specialCap } from "./TemplateStats";

/** What one division of a template takes: men, and equipment per need group. */
export interface OobTemplateCost {
  men: number;
  need: readonly number[];
  /** Battalions and special ones in a division (omitted: no special ones). */
  battalions?: number;
  special?: number;
}

/** One army of the plan: its template counts, and whether it must be staffed. */
export interface OobArmyAsk {
  required: boolean;
  items: readonly { template: number; count: number }[];
}

export type OobCut = "none" | "men" | "cap" | "equip" | "special";

export interface OobItemResult {
  asked: number;
  fielded: number;
  /** Why fewer were fielded; `group` names the need group for "equip". */
  cut: OobCut;
  group: number;
}

export interface OobArmyResult {
  items: OobItemResult[];
  total: number;
  required: boolean;
}

export interface OobResult {
  armies: OobArmyResult[];
  /** Divisions fielded in all. */
  total: number;
  /** Divisions asked for in all. */
  asked: number;
  menBudget: number;
  menAsked: number;
  menUsed: number;
  /** Per need group: what the plan asks, what it gets, what the stock is. */
  equipAsked: number[];
  equipUsed: number[];
  groupStock: number[];
  /** The first need group a shortage cut, or -1. */
  limitedGroup: number;
  /** The indices of required armies that field nothing. */
  emptyRequired: number[];
  /** Special battalions the plan fields, and the most the fielded army may hold (spec §4.1). */
  specialUsed: number;
  specialLimit: number;
  /** True when the special cap cut a division. */
  specialCut: boolean;
  /** True when something asked for was not fielded. */
  cutAny: boolean;
}

/** The men of the country's original start divisions, in total. */
export function startOobBudget(
  oob: readonly OobArmy[],
  menOfKey: (key: string) => number,
): number {
  let n = 0;
  for (const a of oob) {
    for (const [key, k] of a.divisions) n += k * menOfKey(key);
  }
  return n;
}

/** An army with a running operation must be staffed. */
export function oobArmyRequired(a: OobArmy): boolean {
  return a.planTargets !== undefined && a.planTargets.length > 0;
}

/** The army indices in the order they fill: operation armies first, then the others in order. */
export function oobFillOrder(
  armies: readonly { required: boolean }[],
): number[] {
  return armies
    .map((_, i) => i)
    .sort(
      (a, b) =>
        Number(armies[b].required) - Number(armies[a].required) || a - b,
    );
}

/**
 * The fill. Operation armies first, then the others in order, items in
 * their listed order; each division is full strength or not made. Men are
 * limited by `min(menBudget, menPool)`; `groupStock` is everything the
 * start's divisions held plus the stock (what the old divisions give back).
 */
export function planStartOob(
  menBudget: number,
  menPool: number,
  groupStock: readonly number[],
  templates: readonly OobTemplateCost[],
  armies: readonly OobArmyAsk[],
): OobResult {
  const groups = groupStock.length;
  const left = [...groupStock];
  let menLeft = Math.min(menBudget, menPool);
  const equipAsked = new Array<number>(groups).fill(0);
  const equipUsed = new Array<number>(groups).fill(0);
  const out: OobArmyResult[] = armies.map((a) => ({
    items: a.items.map((it) => ({
      asked: it.count,
      fielded: 0,
      cut: "none" as OobCut,
      group: -1,
    })),
    total: 0,
    required: a.required,
  }));
  let menAsked = 0;
  let menUsed = 0;
  let asked = 0;
  let limitedGroup = -1;
  let battalions = 0;
  let special = 0;
  let specialCut = false;
  for (const a of armies) {
    for (const it of a.items) {
      const t = templates[it.template];
      if (t === undefined || it.count <= 0) continue;
      asked += it.count;
      menAsked += it.count * t.men;
      for (let g = 0; g < groups; g++) {
        equipAsked[g] += it.count * (t.need[g] ?? 0);
      }
    }
  }
  for (const ai of oobFillOrder(armies)) {
    const army = out[ai];
    armies[ai].items.forEach((it, ii) => {
      const t = templates[it.template];
      const r = army.items[ii];
      if (t === undefined || it.count <= 0) return;
      for (let i = 0; i < it.count; i++) {
        if (army.total >= WW_MAX_ARMY_DIVISIONS) {
          r.cut = "cap";
          return;
        }
        if (menLeft < t.men) {
          r.cut = "men";
          return;
        }
        // The special cap: max(24, 5 % of all battalions), as training holds it.
        const nb = t.battalions ?? 0;
        const ns = t.special ?? 0;
        if (ns > 0 && special + ns > specialCap(battalions + nb)) {
          r.cut = "special";
          specialCut = true;
          return;
        }
        let short = -1;
        for (let g = 0; g < groups; g++) {
          const need = t.need[g] ?? 0;
          if (need > 0 && CUTTING_GROUP[g] && left[g] < need) {
            short = g;
            break;
          }
        }
        if (short >= 0) {
          r.cut = "equip";
          r.group = short;
          if (limitedGroup < 0) limitedGroup = short;
          return;
        }
        menLeft -= t.men;
        battalions += nb;
        special += ns;
        menUsed += t.men;
        for (let g = 0; g < groups; g++) {
          const need = FILLABLE_GROUP[g]
            ? Math.min(t.need[g] ?? 0, Math.max(0, left[g]))
            : 0;
          left[g] -= need;
          equipUsed[g] += need;
        }
        r.fielded++;
        army.total++;
      }
    });
  }
  const total = out.reduce((n, a) => n + a.total, 0);
  const emptyRequired: number[] = [];
  out.forEach((a, i) => {
    if (a.required && a.total === 0) emptyRequired.push(i);
  });
  return {
    armies: out,
    total,
    asked,
    menBudget,
    menAsked,
    menUsed,
    equipAsked,
    equipUsed,
    groupStock: [...groupStock],
    limitedGroup,
    emptyRequired,
    specialUsed: special,
    specialLimit: specialCap(battalions),
    specialCut,
    cutAny: total < asked,
  };
}
