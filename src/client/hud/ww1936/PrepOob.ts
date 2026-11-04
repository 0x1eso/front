// World War 1936 lobby preparation (logic): a major's whole start army as the
// player plans it. The templates (the country's start templates as edited,
// and new ones), how many divisions of each every start army holds. What the
// game will really field comes from engine-lib's planStartOob, the function
// the engine calls for the start_oob order, so the preview is the result.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  SupportId,
  TemplateDef,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TEMPLATES,
} from "@openfront/engine-api/ww1936/LandTypes";
import { START_OOB } from "@openfront/engine-lib/ww1936/LandStart";
import {
  OobArmyAsk,
  oobArmyRequired,
  OobResult,
  planStartOob,
  startOobBudget,
} from "@openfront/engine-lib/ww1936/StartOob";
import {
  isNewTemplateKey,
  nextNewKey,
  PrepArmies,
  PrepArmyItem,
  PrepTemplate,
} from "../../components/ww1936/PrepPlan";
import { translateText } from "../../Utils";
import { LibEntry, templateKey } from "./DesignLibrary";
import { armyName } from "./LandModel";
import {
  lobbyResearched,
  lobbyStartTemplates,
  planProblem,
  startGroupStock,
  statsOf,
} from "./LobbyPrep";
import { startRegionName } from "./StartRegionNames";
import { isKoreanUi } from "./WorldWarModel";

/** A major (a country with a 1936 order of battle) plans its whole start army. */
export const hasStartOob = (tag: CountryTag): boolean =>
  START_OOB[tag] !== undefined;

export interface OobTemplateRow {
  /** The 1936 key of a start template, or "new:<n>". */
  key: string;
  def: TemplateDef;
  isNew: boolean;
  /** The plan changed it (a start template) or made it (a new one). */
  edited: boolean;
  men: number;
  need: readonly number[];
  /** Why it cannot be applied at the start, or null. */
  problem: string | null;
}

export interface OobArmyRow {
  index: number;
  /** The army's number in the game's naming (the start order). */
  nameNo: number;
  /** An operation is running: the army must be staffed. */
  required: boolean;
  region: string;
  /** The 1936 division count. */
  original: number;
  /** The plan: a count per template row (0 for none), in row order. */
  counts: number[];
  /** The plan's total. */
  total: number;
  /** What the game will really field, in the same order as `counts`. */
  fielded: number[];
  fieldedTotal: number;
}

export interface PrepOobModel {
  tag: CountryTag;
  templates: OobTemplateRow[];
  armies: OobArmyRow[];
  result: OobResult;
  /** Nothing differs from the 1936 start. */
  isDefault: boolean;
  /** Reasons the plan can't be saved or sent (an operation army empty), as texts. */
  problems: string[];
}

/** The 1936 armies as a plan, for a country with an order of battle. */
export function defaultArmies(tag: CountryTag): PrepArmies {
  return (START_OOB[tag] ?? []).map((a) =>
    a.divisions.map(([key, count]) => ({ key, count })),
  );
}

const countsOf = (items: readonly PrepArmyItem[]) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.key, (m.get(i.key) ?? 0) + i.count);
  return m;
};

const sameItems = (a: readonly PrepArmyItem[], b: readonly PrepArmyItem[]) => {
  const x = countsOf(a);
  const y = countsOf(b);
  for (const [k, n] of x) if (n !== (y.get(k) ?? 0)) return false;
  for (const [k, n] of y) if (n !== (x.get(k) ?? 0)) return false;
  return true;
};

/** `armies` is stored only when it differs from the 1936 start. */
export function normalizeArmies(
  tag: CountryTag,
  armies: PrepArmies,
): PrepArmies | null {
  const base = defaultArmies(tag);
  if (
    armies.length === base.length &&
    armies.every((a, i) => sameItems(a, base[i]))
  ) {
    return null;
  }
  return armies;
}

/** A stored plan counts only when it fits the country's armies; otherwise the 1936 start. */
export function armiesOfPlan(
  tag: CountryTag,
  stored: PrepArmies | null,
): PrepArmies {
  const base = defaultArmies(tag);
  return stored !== null && stored.length === base.length ? stored : base;
}

/** The rows of templates: the country's start templates (as the plan edits them), then the new ones. */
export function oobTemplateRows(
  tag: CountryTag,
  plan: readonly PrepTemplate[],
  researched: ReadonlySet<WwTechId> = lobbyResearched(tag),
  designGroups: ReadonlySet<number> = new Set(),
): OobTemplateRow[] {
  const rows: OobTemplateRow[] = [];
  const push = (
    key: string,
    def: TemplateDef,
    isNew: boolean,
    edited: boolean,
    // The start template's contents untouched (a rename only): the game
    // does not judge it, as a start template may hold unresearched parts.
    sameContent = false,
  ) => {
    const s = statsOf(def, researched);
    let problem =
      (isNew || edited) && !sameContent
        ? planProblem(def, researched, designGroups)
        : null;
    if (problem === null && (isNew || edited) && def.name.trim() === "") {
      problem = translateText("ww1936.prep.no_name");
    }
    rows.push({ key, def, isNew, edited, men: s.men, need: s.need, problem });
  };
  for (const st of lobbyStartTemplates(tag)) {
    const p = plan.find((x) => x.key === st.key);
    push(
      st.key,
      p === undefined
        ? { ...st.def, name: translateText(`ww1936.tpl.${st.key}`) }
        : {
            name: p.name,
            battalions: p.battalions as BattalionId[],
            support: p.support as SupportId[],
          },
      false,
      p !== undefined,
      p !== undefined &&
        p.battalions.join() === st.def.battalions.join() &&
        p.support.join() === st.def.support.join(),
    );
  }
  for (const p of plan) {
    if (!isNewTemplateKey(p.key) || rows.length >= WW_MAX_TEMPLATES) continue;
    push(
      p.key,
      {
        name: p.name,
        battalions: p.battalions as BattalionId[],
        support: p.support as SupportId[],
      },
      true,
      true,
    );
  }
  return rows;
}

/** How many more new templates the plan may hold. */
export const newTemplateRoom = (
  tag: CountryTag,
  plan: readonly PrepTemplate[],
) =>
  Math.max(
    0,
    WW_MAX_TEMPLATES -
      lobbyStartTemplates(tag).length -
      plan.filter((p) => isNewTemplateKey(p.key)).length,
  );

/**
 * The model of a major's plan. A template that cannot be applied (a part not
 * researched, no name) fields nothing: its counts are kept, shown with the
 * reason, and left out of the order.
 */
export function oobModel(
  tag: CountryTag,
  plan: readonly PrepTemplate[],
  stored: PrepArmies | null,
  researched: ReadonlySet<WwTechId> = lobbyResearched(tag),
  designGroups: ReadonlySet<number> = new Set(),
): PrepOobModel | null {
  const oob = START_OOB[tag];
  if (oob === undefined) return null;
  const templates = oobTemplateRows(tag, plan, researched, designGroups);
  const armiesPlan = armiesOfPlan(tag, stored);
  const index = new Map(templates.map((t, i) => [t.key, i]));
  const counts = armiesPlan.map((items) => {
    const row = new Array<number>(templates.length).fill(0);
    for (const i of items) {
      const k = index.get(i.key);
      if (k !== undefined) row[k] += i.count;
    }
    return row;
  });
  // The original templates' men: the budget.
  const originals = new Map(
    lobbyStartTemplates(tag).map((t) => [
      t.key,
      statsOf(t.def, researched).men,
    ]),
  );
  const first = originals.values().next().value ?? 0;
  const budget = startOobBudget(oob, (k) => originals.get(k) ?? first);
  const asks: OobArmyAsk[] = oob.map((a, i) => ({
    required: oobArmyRequired(a),
    items: templates.map((t, k) => ({
      template: k,
      count:
        t.problem === null ? Math.min(counts[i][k], WW_MAX_ARMY_DIVISIONS) : 0,
    })),
  }));
  const result = planStartOob(
    budget,
    Infinity,
    startGroupStock(tag),
    templates.map((t) => ({ men: t.men, need: t.need })),
    asks,
  );
  const korean = isKoreanUi();
  const armies: OobArmyRow[] = oob.map((a, i) => ({
    index: i,
    nameNo: i + 1,
    required: asks[i].required,
    region: startRegionName(a.regions[0], korean),
    original: a.divisions.reduce((n, [, k]) => n + k, 0),
    counts: counts[i],
    total: counts[i].reduce((n, x) => n + x, 0),
    fielded: result.armies[i].items.map((x) => x.fielded),
    fieldedTotal: result.armies[i].total,
  }));
  const problems: string[] = [];
  for (const r of armies) {
    if (r.required && r.total === 0) {
      problems.push(
        translateText("ww1936.prep.oob_empty_required", {
          army: armyName(r.nameNo),
        }),
      );
    } else if (r.required && r.fieldedTotal === 0) {
      problems.push(
        translateText("ww1936.prep.oob_unfilled_required", {
          army: armyName(r.nameNo),
        }),
      );
    }
  }
  return {
    tag,
    templates,
    armies,
    result,
    isDefault: plan.length === 0 && normalizeArmies(tag, armiesPlan) === null,
    problems,
  };
}

/** The plan back as stored items (rows in template order, zero counts left out). */
export function armiesOfModel(m: PrepOobModel): PrepArmies {
  return m.armies.map((a) =>
    m.templates
      .map((t, k) => ({ key: t.key, count: a.counts[k] }))
      .filter((i) => i.count > 0),
  );
}

/**
 * One count changed, clamped to the army's 24; null (refused) when it would
 * leave an army with a running operation empty.
 */
export function withCount(
  m: PrepOobModel,
  army: number,
  key: string,
  want: number,
): PrepArmies | null {
  const k = m.templates.findIndex((t) => t.key === key);
  const a = m.armies[army];
  if (k < 0 || a === undefined) return null;
  const others = a.total - a.counts[k];
  const n = Math.max(
    0,
    Math.min(Math.floor(want), WW_MAX_ARMY_DIVISIONS - others),
  );
  if (a.required && others + n === 0) return null;
  const next = armiesOfModel(m);
  const items = next[army].filter((i) => i.key !== key);
  if (n > 0) items.push({ key, count: n });
  next[army] = orderItems(m, items);
  return next;
}

function orderItems(m: PrepOobModel, items: PrepArmyItem[]): PrepArmyItem[] {
  const pos = new Map(m.templates.map((t, i) => [t.key, i]));
  return [...items].sort(
    (x, y) => (pos.get(x.key) ?? 0) - (pos.get(y.key) ?? 0),
  );
}

/** How many more divisions of `key` the army can take at full strength within the men and the stock. */
export function roomFor(m: PrepOobModel, army: number, key: string): number {
  const k = m.templates.findIndex((t) => t.key === key);
  const a = m.armies[army];
  if (k < 0 || a === undefined || m.templates[k].problem !== null) return 0;
  let lo = 0;
  let hi = WW_MAX_ARMY_DIVISIONS - a.total;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fullAfter(m, army, k, mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** True when adding `more` of template `k` to the army is all fielded. */
function fullAfter(
  m: PrepOobModel,
  army: number,
  k: number,
  more: number,
): boolean {
  const asks: OobArmyAsk[] = m.armies.map((a, i) => ({
    required: a.required,
    items: m.templates.map((t, j) => ({
      template: j,
      count:
        t.problem !== null
          ? 0
          : a.counts[j] + (i === army && j === k ? more : 0),
    })),
  }));
  const r = planStartOob(
    m.result.menBudget,
    Infinity,
    m.result.groupStock,
    m.templates.map((t) => ({ men: t.men, need: t.need })),
    asks,
  );
  const it = r.armies[army].items[k];
  return it.fielded === it.asked;
}

/** [남은 인력으로 채우기]: as many of `key` as the budget and the stock allow. */
export function fillRemaining(
  m: PrepOobModel,
  army: number,
  key: string,
): PrepArmies | null {
  const more = roomFor(m, army, key);
  const k = m.templates.findIndex((t) => t.key === key);
  if (k < 0 || more <= 0) return null;
  return withCount(m, army, key, m.armies[army].counts[k] + more);
}

export interface LibraryFill {
  armies: PrepArmies;
  /** New templates the entry needs (made in the plan). */
  added: PrepTemplate[];
  /** Entries left out, with the reason. */
  skipped: string[];
}

/**
 * [군 템플릿 불러오기]: the army becomes the library army entry, up to 24
 * divisions. Items whose template is in the plan use it; the others become new
 * templates (while there is room and their parts are researched).
 */
export function fillFromLibrary(
  m: PrepOobModel,
  plan: readonly PrepTemplate[],
  army: number,
  entry: Extract<LibEntry, { type: "army" }>,
  researched: ReadonlySet<WwTechId> = lobbyResearched(m.tag),
): LibraryFill | null {
  const a = m.armies[army];
  if (a === undefined) return null;
  const items: PrepArmyItem[] = [];
  const added: PrepTemplate[] = [];
  const skipped: string[] = [];
  let room = newTemplateRoom(m.tag, plan);
  let left = WW_MAX_ARMY_DIVISIONS;
  for (const it of entry.items) {
    if (left <= 0) break;
    const def: TemplateDef = {
      name: it.name,
      battalions: it.battalions as BattalionId[],
      support: it.support as SupportId[],
    };
    const ck = templateKey(def.battalions, def.support);
    let row =
      m.templates.find(
        (t) =>
          t.problem === null &&
          templateKey(t.def.battalions, t.def.support) === ck,
      )?.key ??
      added.find((t) => templateKey(t.battalions, t.support) === ck)?.key;
    if (row === undefined) {
      const why = planProblem(def, researched, new Set());
      if (why !== null || room <= 0 || def.name.trim() === "") {
        skipped.push(
          translateText("ww1936.prep.skipped", {
            name: it.name,
            reason: why ?? translateText("ww1936.prep.no_room"),
          }),
        );
        continue;
      }
      const key = nextNewKey([...plan, ...added]);
      added.push({
        key,
        name: it.name,
        battalions: [...def.battalions],
        support: [...def.support],
      });
      room--;
      row = key;
    }
    const n = Math.min(it.count, left);
    left -= n;
    const have = items.find((x) => x.key === row);
    if (have !== undefined) have.count += n;
    else items.push({ key: row, count: n });
  }
  const total = items.reduce((n, i) => n + i.count, 0);
  if (a.required && total === 0) return null;
  const armies = armiesOfModel(m);
  armies[army] = items;
  return { armies, added, skipped };
}

// ---- applying it at the start ----

/** What the start_oob order is built from. */
export interface OobOrder {
  order: WwOrder;
  /** Divisions the game will field, and the ones the plan asked for. */
  fielded: number;
  asked: number;
  /** The text for a notice: what got fielded, what was cut. */
  summary: string;
}

/**
 * The start_oob order for the plan, or the reason it can't be sent. Only the
 * templates the game has (by key) and that can be applied go; a count on one
 * that can't is left out, and the order is built from what remains.
 */
export function oobOrderOf(
  m: PrepOobModel,
  gameKeys: ReadonlySet<string>,
): OobOrder | string {
  if (m.problems.length > 0) return m.problems[0];
  const usable = (t: OobTemplateRow) =>
    t.problem === null && (t.isNew || gameKeys.has(t.key));
  const used = new Set<number>();
  m.armies.forEach((a) =>
    a.counts.forEach((n, k) => {
      if (n > 0 && usable(m.templates[k])) used.add(k);
    }),
  );
  const send: number[] = [];
  m.templates.forEach((t, k) => {
    if (usable(t) && (t.edited || used.has(k))) send.push(k);
  });
  const at = new Map(send.map((k, i) => [k, i]));
  const order = {
    kind: "start_oob",
    templates: send.map((k) => {
      const t = m.templates[k];
      return t.isNew
        ? {
            name: t.def.name,
            battalions: [...t.def.battalions],
            support: [...t.def.support],
          }
        : {
            key: t.key,
            name: t.edited ? t.def.name : "",
            battalions: [...t.def.battalions],
            support: [...t.def.support],
          };
    }),
    // An army holds 24 at most: what is stored beyond it is cut in item
    // order, as the fill cuts it.
    armies: m.armies.map((a) => {
      let room = WW_MAX_ARMY_DIVISIONS;
      const items: { template: number; count: number }[] = [];
      a.counts.forEach((n, k) => {
        const at1 = at.get(k);
        if (n <= 0 || at1 === undefined || room <= 0) return;
        const c = Math.min(n, room);
        room -= c;
        items.push({ template: at1, count: c });
      });
      return items;
    }),
  } as WwOrder;
  const r = m.result;
  return {
    order,
    fielded: r.total,
    asked: r.asked,
    summary: oobSummary(m),
  };
}

/** What the plan fields, and what was cut, in words. */
export function oobSummary(m: PrepOobModel): string {
  const r = m.result;
  if (!r.cutAny)
    return translateText("ww1936.prep.oob_applied", { n: r.total });
  const cut = r.armies.some((a) => a.items.some((i) => i.cut === "men"))
    ? translateText("ww1936.prep.cut_men")
    : r.limitedGroup >= 0
      ? translateText("ww1936.prep.cut_equip")
      : translateText("ww1936.prep.cut_cap");
  return translateText("ww1936.prep.oob_applied_cut", {
    n: r.total,
    asked: r.asked,
    cut,
  });
}
