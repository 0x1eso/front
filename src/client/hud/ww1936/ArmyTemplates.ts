// World War 1936: army templates (a saved list of division templates and
// counts, trained into one army at once). The entries live in the owner's
// library (DesignLibrary.ts, type "army"); this file is the model between
// them and the game: what a train needs (templates to make first, parts the
// country lacks), the composition of an existing army, and the rows of the
// training queue that belong to one train_army order.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  CountryLandDetail,
  TemplateData,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TEMPLATES,
  WW_MAX_TRAINING,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwLandView } from "../../view/WwLandView";
import { LibContent, LibEntry, templateKey } from "./DesignLibrary";
import { entryStatus, existingKeys } from "./DesignLibraryStatus";
import { blockText } from "./EconomyModel";
import { techOf, templateDef, templateName } from "./LandModel";

export type ArmyContent = Extract<LibContent, { type: "army" }>;
export type ArmyEntry = Extract<LibEntry, { type: "army" }>;
export type ArmyItem = ArmyContent["items"][number];

export function isArmyEntry(e: LibEntry): e is ArmyEntry {
  return e.type === "army";
}

export function armyTotal(items: readonly { count: number }[]): number {
  let n = 0;
  for (const i of items) n += i.count;
  return n;
}

/** The army templates of the library, in the library's order. */
export function armyEntries(entries: readonly LibEntry[]): ArmyEntry[] {
  return entries.filter(isArmyEntry);
}

/**
 * The composition of an existing army as library content: one item per
 * template, most numerous first (then by template id).
 */
export function compositionOf(
  land: CountryLandDetail,
  army: number,
  name: string,
): ArmyContent | null {
  const counts = new Map<number, number>();
  for (const d of land.divisions) {
    if (d.army === army)
      counts.set(d.template, (counts.get(d.template) ?? 0) + 1);
  }
  const items: ArmyItem[] = [];
  const ids = [...counts.keys()].sort(
    (a, b) => counts.get(b)! - counts.get(a)! || a - b,
  );
  for (const id of ids) {
    const t = land.templates.find((x) => x.id === id);
    if (t === undefined) continue;
    items.push({
      name: templateName(t).slice(0, 40),
      battalions: [...t.battalions],
      support: [...t.support],
      count: counts.get(id)!,
    });
  }
  if (items.length === 0) return null;
  return {
    type: "army",
    name: name.slice(0, 40),
    items: items.slice(0, WW_MAX_ARMY_DIVISIONS),
  };
}

export type TrainPlan =
  | {
      ok: true;
      /** template_save orders for the parts the country has no template for yet. */
      saves: WwOrder[];
      /** Per item: the country template's id, or 0 while it is still to be made. */
      items: { template: number; count: number; item: ArmyItem }[];
    }
  | { ok: false; reason: string };

const matches = (t: TemplateData, i: ArmyItem) =>
  templateKey(t.battalions, t.support) === templateKey(i.battalions, i.support);

/**
 * What a tap on [train] needs: every item matched to a template of the country
 * by content, the missing ones made first with template_save (the parts must
 * be available; the first that is not stops the whole thing with its name).
 */
export function planTrain(
  e: ArmyEntry,
  game: Parameters<typeof entryStatus>[1],
  land: CountryLandDetail,
  translate: (key: string, p?: Record<string, string | number>) => string,
): TrainPlan {
  const total = armyTotal(e.items);
  if (total > WW_MAX_ARMY_DIVISIONS || total < 1) {
    return { ok: false, reason: translate("ww1936.army_tpl.too_big") };
  }
  if (land.training.length + e.items.length > WW_MAX_TRAINING) {
    return { ok: false, reason: blockText("queue_full") };
  }
  const have = existingKeys(game);
  const saves: WwOrder[] = [];
  const made = new Set<string>();
  const items: { template: number; count: number; item: ArmyItem }[] = [];
  for (const item of e.items) {
    const t = land.templates.find((x) => matches(x, item));
    if (t !== undefined) {
      items.push({ template: t.id, count: item.count, item });
      continue;
    }
    const key = templateKey(item.battalions, item.support);
    if (!made.has(key)) {
      const s = entryStatus(
        {
          type: "template",
          id: "",
          auto: false,
          name: item.name,
          battalions: item.battalions,
          support: item.support,
        },
        game,
        have,
      );
      if (s.order === null) {
        return {
          ok: false,
          reason: translate("ww1936.army_tpl.part_missing", {
            name: item.name,
            reason: s.reason,
          }),
        };
      }
      if (land.templates.length + saves.length >= WW_MAX_TEMPLATES) {
        return {
          ok: false,
          reason: blockText("too_many_templates"),
        };
      }
      saves.push(s.order);
      made.add(key);
    }
    items.push({ template: 0, count: item.count, item });
  }
  return { ok: true, saves, items };
}

/** The train_army order once every item has a template; null while one is still being made. */
export function trainOrder(
  e: ArmyEntry,
  land: CountryLandDetail,
  region: number,
): WwOrder | null {
  const items: { template: number; count: number }[] = [];
  for (const item of e.items) {
    const t = land.templates.find((x) => matches(x, item));
    if (t === undefined) return null;
    items.push({ template: t.id, count: item.count });
  }
  return { kind: "train_army", items, region };
}

// ---- the queue ----

/** A template's training days with the country's research (what a division not started yet will need). */
export function trainDaysFor(
  economy: WwEconomyView,
  me: number,
): (t: TemplateData) => number {
  const tech = techOf(economy, me);
  return (t) => templateStats(templateDef(t), tech, GEN1).trainDays;
}

export interface GroupRow {
  /** The group id; the first entry still in the queue is the one orders name. */
  group: number;
  entry: number;
  /** Divisions in all, and how many have finished training. */
  total: number;
  trained: number;
  /** Divisions in training right now (deploy now needs one). */
  started: number;
  /** The slowest division's days left (not started: its full time). */
  daysLeft: number;
  /** "manpower" | "equipment" | "". */
  waiting: string;
  /** "Infantry ×10 · Armour ×4": the row's name (the order carries none). */
  list: string;
}

/** One row per train_army order in the queue, in queue order. */
export function groupRows(
  view: WwLandView,
  me: number,
  trainDaysOf: (template: TemplateData) => number,
): GroupRow[] {
  const land = view.details.get(me);
  if (land === undefined) return [];
  const rows = new Map<number, GroupRow>();
  const counts = new Map<number, Map<number, number>>();
  for (const e of land.training) {
    if (e.group === undefined) continue;
    let r = rows.get(e.group);
    if (r === undefined) {
      r = {
        group: e.group,
        entry: e.id,
        total: 0,
        trained: 0,
        started: 0,
        daysLeft: 0,
        waiting: "",
        list: "",
      };
      rows.set(e.group, r);
      counts.set(e.group, new Map());
    }
    const t = land.templates.find((x) => x.id === e.template);
    const n = e.remaining + e.trainees.length;
    r.total += n;
    r.started += e.trainees.length;
    for (const x of e.trainees) {
      if (x.days >= x.need) r.trained++;
      r.daysLeft = Math.max(r.daysLeft, x.need - x.days);
    }
    if (e.remaining > 0 && t !== undefined) {
      r.daysLeft = Math.max(r.daysLeft, trainDaysOf(t));
    }
    if (e.waiting === "manpower" || (e.waiting !== "" && r.waiting === "")) {
      r.waiting = e.waiting;
    }
    const m = counts.get(e.group)!;
    m.set(e.template, (m.get(e.template) ?? 0) + n);
  }
  for (const [g, r] of rows) {
    r.list = [...counts.get(g)!]
      .map(([id, n]) => {
        const t = land.templates.find((x) => x.id === id);
        return `${t === undefined ? "?" : templateName(t)} ×${n}`;
      })
      .join(" · ");
  }
  return [...rows.values()];
}
