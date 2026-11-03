// World War 1936 lobby preparation: the start templates a player edited for
// a country, kept on this device for later games. Homepage-safe (no hud/):
// the lobby's picker and the game's sender both read it. Storage is wrapped
// in try/catch like the design library's: blocked, full or broken storage is
// an empty plan.
import {
  BATTALION_IDS,
  SUPPORT_IDS,
  WW_MAX_BATTALIONS,
  WW_MAX_SUPPORT,
  WW_MAX_TEMPLATES,
  WW_TEMPLATE_NAME_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { z } from "zod";

export const PREP_KEY = "ww1936-prep-v1";
export const PREP_VERSION = 1;

export interface PrepStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** One edited start template: the 1936 template's key and its new contents. */
export interface PrepTemplate {
  key: string;
  name: string;
  battalions: string[];
  support: string[];
}

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

const File = z.object({
  v: z.literal(PREP_VERSION),
  /** Country tag -> its edited start templates. */
  byCountry: z.record(z.string().max(8), z.array(z.unknown())),
  /** The game whose start orders were already sent (a reloaded page must not send twice). */
  sent: z.string().max(80).optional(),
});

interface Data {
  byCountry: Map<string, PrepTemplate[]>;
  sent: string;
}

function defaultStorage(): PrepStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function read(storage: PrepStorage | null): Data {
  const out: Data = { byCountry: new Map(), sent: "" };
  try {
    const raw = storage?.getItem(PREP_KEY);
    if (raw === null || raw === undefined || raw === "") return out;
    const file = File.safeParse(JSON.parse(raw));
    if (!file.success) return out;
    out.sent = file.data.sent ?? "";
    for (const [tag, list] of Object.entries(file.data.byCountry)) {
      const keep: PrepTemplate[] = [];
      for (const x of list) {
        const e = Entry.safeParse(x);
        if (!e.success || keep.some((k) => k.key === e.data.key)) continue;
        keep.push(e.data);
        if (keep.length >= WW_MAX_TEMPLATES) break;
      }
      if (keep.length > 0) out.byCountry.set(tag, keep);
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

/** The country's edited start templates (empty when none or the store is unusable). */
export function prepPlanOf(
  tag: string,
  storage: PrepStorage | null = defaultStorage(),
): PrepTemplate[] {
  return read(storage).byCountry.get(tag) ?? [];
}

/** Saves one edited start template of `tag` (replaces the one with the same key). */
export function setPrepTemplate(
  tag: string,
  t: PrepTemplate,
  storage: PrepStorage | null = defaultStorage(),
): void {
  const d = read(storage);
  const list = (d.byCountry.get(tag) ?? []).filter((x) => x.key !== t.key);
  list.push({
    key: t.key,
    name: t.name.slice(0, WW_TEMPLATE_NAME_MAX),
    battalions: [...t.battalions],
    support: [...t.support],
  });
  d.byCountry.set(tag, list);
  write(storage, d);
}

/** Drops the edit of one start template (back to the 1936 one). */
export function clearPrepTemplate(
  tag: string,
  key: string,
  storage: PrepStorage | null = defaultStorage(),
): void {
  const d = read(storage);
  const list = (d.byCountry.get(tag) ?? []).filter((x) => x.key !== key);
  if (list.length === 0) d.byCountry.delete(tag);
  else d.byCountry.set(tag, list);
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
