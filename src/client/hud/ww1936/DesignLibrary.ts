// World War 1936: the owner's personal library of tank, plane and ship
// designs and division templates. It lives in this device's localStorage
// (client only; no order, rule or snapshot changes) and carries designs to
// the next game. Entries keep their contents loosely typed on purpose: a
// module or battalion removed in a later version must show as "unusable",
// never make the whole library fail to load. DesignLibraryStatus.ts checks
// an entry against the game with the engine-lib functions the designers use.
import { DESIGN_KINDS } from "@openfront/engine-api/ww1936/DepthTypes";
import { z } from "zod";

export const LIBRARY_KEY = "ww1936-library-v1";
export const LIBRARY_VERSION = 1;
/** Entries kept at most (a share code or a full store cannot grow past it). */
export const LIBRARY_MAX_ENTRIES = 120;
/** A pasted share code longer than this is refused unread. */
export const SHARE_CODE_MAX = 60_000;
const CODE_PREFIX = "WW36L1:";

const Name = z.string().max(40);
const Id = z.string().min(1).max(40);

const DesignContent = z.object({
  type: z.literal("design"),
  def: z.object({
    kind: z.enum(DESIGN_KINDS),
    base: z.string().max(16),
    modules: z.array(z.string().max(40)).max(8),
    armorLevel: z.number().int().min(0).max(10).optional(),
    engineLevel: z.number().int().min(0).max(10).optional(),
    name: Name,
  }),
});

const TemplateContent = z.object({
  type: z.literal("template"),
  name: Name,
  battalions: z.array(z.string().max(40)).max(40),
  support: z.array(z.string().max(40)).max(10),
});

const Content = z.discriminatedUnion("type", [DesignContent, TemplateContent]);

export type LibContent = z.infer<typeof Content>;
export type LibEntry = LibContent & { id: string; auto: boolean };

const StoredEntry = z.intersection(
  Content,
  z.object({ id: Id, auto: z.boolean().default(false) }),
);
const StoredFile = z.object({
  v: z.literal(LIBRARY_VERSION),
  entries: z.array(z.unknown()).max(LIBRARY_MAX_ENTRIES * 2),
});
const ShareFile = z.object({
  v: z.literal(LIBRARY_VERSION),
  e: z.array(Content).max(LIBRARY_MAX_ENTRIES),
});

/** What makes two entries "the same": the contents without the name. */
export function contentKey(c: LibContent): string {
  if (c.type === "design") {
    const d = c.def;
    const m = [...d.modules];
    while (m.length > 0 && m[m.length - 1] === "") m.pop();
    return `d|${d.kind}|${d.base}|${m.join(",")}|${d.armorLevel ?? 0}|${d.engineLevel ?? 0}`;
  }
  return templateKey(c.battalions, c.support);
}

/** A template's contents as a key: the order does not matter (the cost is a multiset's). */
export function templateKey(
  battalions: readonly string[],
  support: readonly string[],
): string {
  return `t|${[...battalions].sort().join(",")}|${[...support].sort().join(",")}`;
}

export interface KeyValueStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function newId(taken: ReadonlySet<string>): string {
  for (let i = 0; i < 50; i++) {
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    if (!taken.has(id)) return id;
  }
  return `x${taken.size}`;
}

export type AddResult = "added" | "renamed" | "full";

export class LibraryStore {
  entries: LibEntry[] = [];
  private listeners = new Set<() => void>();

  constructor(private readonly storage: () => KeyValueStorage | null) {
    this.reload();
  }

  /** Reads the store again; blocked, empty or broken storage is an empty library. */
  reload(): void {
    this.entries = [];
    try {
      const raw = this.storage()?.getItem(LIBRARY_KEY);
      if (raw === null || raw === undefined || raw === "") return;
      const file = StoredFile.safeParse(JSON.parse(raw));
      if (!file.success) return;
      const seen = new Set<string>();
      for (const e of file.data.entries) {
        const p = StoredEntry.safeParse(e);
        if (!p.success || seen.has(p.data.id)) continue;
        seen.add(p.data.id);
        this.entries.push(p.data as LibEntry);
        if (this.entries.length >= LIBRARY_MAX_ENTRIES) break;
      }
    } catch {
      this.entries = [];
    }
  }

  private persist(): void {
    try {
      this.storage()?.setItem(
        LIBRARY_KEY,
        JSON.stringify({ v: LIBRARY_VERSION, entries: this.entries }),
      );
    } catch {
      // A blocked or full store: the library lives on for this session.
    }
    for (const l of this.listeners) l();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Adds content, or renames the entry with the same contents (never a duplicate). */
  add(c: LibContent): AddResult {
    const key = contentKey(c);
    const at = this.entries.findIndex((e) => contentKey(e) === key);
    if (at >= 0) {
      this.entries[at] = { ...this.entries[at], ...c } as LibEntry;
      this.persist();
      return "renamed";
    }
    if (this.entries.length >= LIBRARY_MAX_ENTRIES) return "full";
    const id = newId(new Set(this.entries.map((e) => e.id)));
    this.entries.push({ ...c, id, auto: false } as LibEntry);
    this.persist();
    return "added";
  }

  remove(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.persist();
  }

  setAuto(id: string, on: boolean): void {
    this.entries = this.entries.map((e) =>
      e.id === id ? ({ ...e, auto: on } as LibEntry) : e,
    );
    this.persist();
  }

  /** The share code of the whole library (`ids` omitted) or of some entries. */
  exportCode(ids?: readonly string[]): string {
    const list = this.entries
      .filter((e) => ids === undefined || ids.includes(e.id))
      .map((e) =>
        e.type === "design"
          ? { type: e.type, def: e.def }
          : {
              type: e.type,
              name: e.name,
              battalions: e.battalions,
              support: e.support,
            },
      );
    const json = JSON.stringify({ v: LIBRARY_VERSION, e: list });
    return CODE_PREFIX + toBase64(json);
  }

  /** Merges a pasted share code. Imported entries start with auto-create off. */
  importCode(text: string): ImportResult {
    const code = text.replace(/\s+/g, "");
    if (code === "") return { ok: false, reason: "empty" };
    if (code.length > SHARE_CODE_MAX) return { ok: false, reason: "too_big" };
    if (!code.startsWith(CODE_PREFIX)) return { ok: false, reason: "bad" };
    let parsed: z.infer<typeof ShareFile>;
    try {
      const json = fromBase64(code.slice(CODE_PREFIX.length));
      const r = ShareFile.safeParse(JSON.parse(json));
      if (!r.success) return { ok: false, reason: "bad" };
      parsed = r.data;
    } catch {
      return { ok: false, reason: "bad" };
    }
    let added = 0;
    let known = 0;
    let full = false;
    const before = this.entries.length;
    const keys = new Set(this.entries.map(contentKey));
    const taken = new Set(this.entries.map((e) => e.id));
    for (const c of parsed.e) {
      const k = contentKey(c);
      if (keys.has(k)) {
        known++;
        continue;
      }
      if (this.entries.length >= LIBRARY_MAX_ENTRIES) {
        full = true;
        break;
      }
      const id = newId(taken);
      taken.add(id);
      keys.add(k);
      this.entries.push({ ...c, id, auto: false } as LibEntry);
      added++;
    }
    if (this.entries.length !== before) this.persist();
    return { ok: true, added, known, full };
  }
}

export type ImportResult =
  | { ok: false; reason: "empty" | "too_big" | "bad" }
  | { ok: true; added: number; known: number; full: boolean };

function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(s: string): string {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

let shared: LibraryStore | null = null;
/** The one store of this page (the designers, the library screen and the auto-creator share it). */
export function libraryStore(): LibraryStore {
  shared ??= new LibraryStore(defaultStorage);
  return shared;
}
