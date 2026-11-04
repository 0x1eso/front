// World War 1936 lobby preparation: the start templates a player edited for
// a country, kept on this device for later games. Homepage-safe (no hud/):
// the lobby's picker and the game's sender both read it. Storage is wrapped
// in try/catch like the design library's: blocked, full or broken storage is
// an empty plan.
import {
  BATTALION_IDS,
  SUPPORT_IDS,
  WW_MAX_ARMIES,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_BATTALIONS,
  WW_MAX_SUPPORT,
  WW_MAX_TEMPLATES,
  WW_TEMPLATE_NAME_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { z } from "zod";

export const PREP_KEY = "ww1936-prep-v1";
/** v2 adds the armies' plan and new templates; v1 files (template edits only) still load. */
export const PREP_VERSION = 2;
/** The key a template made in the lobby gets: "new:<n>". */
export const NEW_TEMPLATE_PREFIX = "new:";
export const isNewTemplateKey = (key: string) =>
  key.startsWith(NEW_TEMPLATE_PREFIX);

export interface PrepStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** One edited start template (the 1936 template's key) or a new one ("new:<n>"), and its contents. */
export interface PrepTemplate {
  key: string;
  name: string;
  battalions: string[];
  support: string[];
}

/** How many divisions of a template (by key) an army holds. */
export interface PrepArmyItem {
  key: string;
  count: number;
}

/** The plan of the whole start army: one list per start army, in the country's start order. */
export type PrepArmies = PrepArmyItem[][];

const Entry = z.object({
  key: z.string().min(1).max(40),
  name: z.string().max(WW_TEMPLATE_NAME_MAX),
  battalions: z
    .array(z.enum(BATTALION_IDS as unknown as [string, ...string[]]))
    .min(1)
    .max(WW_MAX_BATTALIONS),
  support: z
    .array(z.enum(SUPPORT_IDS as unknown as [string, ...string[]]))
    .max(WW_MAX_SUPPORT),
});

const ArmyItem = z.object({
  key: z.string().min(1).max(40),
  count: z.number().int().min(0).max(WW_MAX_ARMY_DIVISIONS),
});

const File = z.object({
  v: z.union([z.literal(1), z.literal(PREP_VERSION)]),
  /** Country tag -> its templates (v1: an array; v2: an object with the armies). */
  byCountry: z.record(z.string().max(8), z.unknown()),
  /** The game whose start orders were already sent (a reloaded page must not send twice). */
  sent: z.string().max(80).optional(),
});

interface Country {
  templates: PrepTemplate[];
  armies: PrepArmies | null;
}

interface Data {
  byCountry: Map<string, Country>;
  sent: string;
}

function defaultStorage(): PrepStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readTemplates(list: unknown): PrepTemplate[] {
  const keep: PrepTemplate[] = [];
  if (!Array.isArray(list)) return keep;
  for (const x of list) {
    const e = Entry.safeParse(x);
    if (!e.success || keep.some((k) => k.key === e.data.key)) continue;
    keep.push(e.data);
    if (keep.length >= WW_MAX_TEMPLATES) break;
  }
  return keep;
}

function readArmies(list: unknown): PrepArmies | null {
  if (!Array.isArray(list) || list.length > WW_MAX_ARMIES) return null;
  const out: PrepArmies = [];
  for (const army of list) {
    const items: PrepArmyItem[] = [];
    if (Array.isArray(army)) {
      for (const x of army.slice(0, WW_MAX_TEMPLATES)) {
        const e = ArmyItem.safeParse(x);
        if (e.success && !items.some((i) => i.key === e.data.key)) {
          items.push(e.data);
        }
      }
    }
    out.push(items);
  }
  return out;
}

function read(storage: PrepStorage | null): Data {
  const out: Data = { byCountry: new Map(), sent: "" };
  try {
    const raw = storage?.getItem(PREP_KEY);
    if (raw === null || raw === undefined || raw === "") return out;
    const file = File.safeParse(JSON.parse(raw));
    if (!file.success) return out;
    out.sent = file.data.sent ?? "";
    for (const [tag, v] of Object.entries(file.data.byCountry)) {
      // v1: the value is the list of edited templates.
      const obj =
        v !== null && typeof v === "object" && !Array.isArray(v)
          ? (v as { templates?: unknown; armies?: unknown })
          : { templates: v };
      const templates = readTemplates(obj.templates);
      const armies = readArmies(obj.armies);
      if (templates.length > 0 || armies !== null) {
        out.byCountry.set(tag, { templates, armies });
      }
    }
  } catch {
    return { byCountry: new Map(), sent: "" };
  }
  return out;
}

function write(storage: PrepStorage | null, d: Data): void {
  try {
    storage?.setItem(
      PREP_KEY,
      JSON.stringify({
        v: PREP_VERSION,
        byCountry: Object.fromEntries(d.byCountry),
        ...(d.sent === "" ? {} : { sent: d.sent }),
      }),
    );
  } catch {
    // A blocked or full store: the plan is lost with the page.
  }
}

function put(d: Data, tag: string, c: Country): void {
  if (c.templates.length === 0 && c.armies === null) d.byCountry.delete(tag);
  else d.byCountry.set(tag, c);
}

function countryOf(d: Data, tag: string): Country {
  return d.byCountry.get(tag) ?? { templates: [], armies: null };
}

/** The country's edited start templates (empty when none or the store is unusable). */
export function prepPlanOf(
  tag: string,
  storage: PrepStorage | null = defaultStorage(),
): PrepTemplate[] {
  return read(storage).byCountry.get(tag)?.templates ?? [];
}

/** The country's army plan, or null (the 1936 armies as they are). */
export function prepArmiesOf(
  tag: string,
  storage: PrepStorage | null = defaultStorage(),
): PrepArmies | null {
  return read(storage).byCountry.get(tag)?.armies ?? null;
}

/** Saves the army plan of `tag` (null: back to the 1936 armies). */
export function setPrepArmies(
  tag: string,
  armies: PrepArmies | null,
  storage: PrepStorage | null = defaultStorage(),
): void {
  const d = read(storage);
  const c = countryOf(d, tag);
  put(d, tag, {
    templates: c.templates,
    armies:
      armies === null
        ? null
        : armies.map((a) =>
            a
              .filter((i) => i.count > 0)
              .map((i) => ({ key: i.key, count: i.count })),
          ),
  });
  write(storage, d);
}

/** Forgets everything planned for `tag` (templates and armies). */
export function clearPrepAll(
  tag: string,
  storage: PrepStorage | null = defaultStorage(),
): void {
  const d = read(storage);
  d.byCountry.delete(tag);
  write(storage, d);
}

/** The next free key for a new template of `plan`. */
export function nextNewKey(plan: readonly PrepTemplate[]): string {
  let n = 1;
  while (plan.some((t) => t.key === `${NEW_TEMPLATE_PREFIX}${n}`)) n++;
  return `${NEW_TEMPLATE_PREFIX}${n}`;
}

/** Saves one edited start template of `tag` (replaces the one with the same key). */
export function setPrepTemplate(
  tag: string,
  t: PrepTemplate,
  storage: PrepStorage | null = defaultStorage(),
): void {
  const d = read(storage);
  const c = countryOf(d, tag);
  const i = c.templates.findIndex((x) => x.key === t.key);
  const entry = {
    key: t.key,
    name: t.name.slice(0, WW_TEMPLATE_NAME_MAX),
    battalions: [...t.battalions],
    support: [...t.support],
  };
  // An edit keeps its place in the list; a new one goes last.
  if (i >= 0) c.templates[i] = entry;
  else c.templates.push(entry);
  put(d, tag, c);
  write(storage, d);
}

/** Drops the edit of one start template (back to the 1936 one). */
export function clearPrepTemplate(
  tag: string,
  key: string,
  storage: PrepStorage | null = defaultStorage(),
): void {
  const d = read(storage);
  const c = countryOf(d, tag);
  c.templates = c.templates.filter((x) => x.key !== key);
  // A removed template leaves the armies too.
  if (c.armies !== null) {
    c.armies = c.armies.map((a) => a.filter((i) => i.key !== key));
  }
  put(d, tag, c);
  write(storage, d);
}

/** The game whose start orders went out, or "". */
export function prepSentFor(
  storage: PrepStorage | null = defaultStorage(),
): string {
  return read(storage).sent;
}

export function markPrepSent(
  gameID: string,
  storage: PrepStorage | null = defaultStorage(),
): void {
  const d = read(storage);
  d.sent = gameID;
  write(storage, d);
}
