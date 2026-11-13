import type { SavedGame, SavedGameInfo } from "@openfront/shared/ApiSchemas";
import { generateID } from "@openfront/shared/SharedUtil";
import type { SavedGameError } from "./SavedGamesApi";

// Saved solo games kept in this browser, for a self-hosted server: it has no
// API, so no accounts to keep them on (SavedGamesApi sends every call here
// when isSelfHosted()). The same calls and answers as the API's, but a save
// is never shared. The bytes are stored gzipped, as the API stores them.

/**
 * As many of the player's own saves as a browser keeps; past it a save asks
 * to delete one. The autosaves are kept apart from them.
 */
export const MAX_LOCAL_SAVES = 20;
/** Autosaves rotate through this many slots, overwriting the oldest. */
export const AUTOSAVE_SLOTS = 3;
// What the panel's rename box allows (maxlength).
const MAX_NAME_LENGTH = 64;

type LocalSaveMeta = Omit<SavedGame, "public">;

/** Where the saves live: IndexedDB in the browser, a Map in tests. */
export interface LocalSaveBackend {
  allMeta(): Promise<LocalSaveMeta[]>;
  getMeta(id: string): Promise<LocalSaveMeta | undefined>;
  getData(id: string): Promise<Uint8Array | undefined>;
  put(meta: LocalSaveMeta, data?: Uint8Array): Promise<void>;
  remove(id: string): Promise<void>;
}

const toSave = (meta: LocalSaveMeta): SavedGame => ({ ...meta, public: false });

/** What a save records of the game besides its bytes. */
export interface SaveMeta {
  name: string;
  map: string;
  tick: number;
  game?: SavedGameInfo;
}

/** The slot an autosave goes to: an empty one first, else the oldest. */
export function nextAutosaveSlot(
  metas: readonly Pick<LocalSaveMeta, "autosave" | "createdAt">[],
): number {
  const at = new Map<number, string>();
  for (const m of metas) {
    if (m.autosave !== undefined) at.set(m.autosave, m.createdAt);
  }
  let oldest = 1;
  for (let slot = 1; slot <= AUTOSAVE_SLOTS; slot++) {
    const created = at.get(slot);
    if (created === undefined) return slot;
    if (created < at.get(oldest)!) oldest = slot;
  }
  return oldest;
}

export class LocalSavedGames {
  constructor(
    private backend: () => Promise<LocalSaveBackend | null>,
    private gzip: (bytes: Uint8Array) => Promise<Uint8Array>,
    private gunzip: (bytes: Uint8Array) => Promise<Uint8Array>,
    private now: () => number = Date.now,
    private newId: () => string = generateID,
  ) {}

  /** Newest first, as the API lists them. */
  async list(): Promise<SavedGame[] | false> {
    try {
      const db = await this.backend();
      if (db === null) return false;
      const metas = await db.allMeta();
      return metas
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toSave);
    } catch (err) {
      console.warn("local saves: list failed", err);
      return false;
    }
  }

  async save(
    snapshot: Uint8Array,
    meta: SaveMeta,
  ): Promise<SavedGame | SavedGameError> {
    return this.store(snapshot, meta, null);
  }

  /**
   * An autosave: into one of the AUTOSAVE_SLOTS, overwriting the oldest.
   * The player's own saves are never touched, nor counted against.
   */
  async autosave(
    snapshot: Uint8Array,
    meta: SaveMeta,
  ): Promise<SavedGame | SavedGameError> {
    return this.store(snapshot, meta, "auto");
  }

  private async store(
    snapshot: Uint8Array,
    meta: SaveMeta,
    auto: "auto" | null,
  ): Promise<SavedGame | SavedGameError> {
    try {
      const db = await this.backend();
      if (db === null) return "request_failed";
      const metas = await db.allMeta();
      const slot = auto === null ? undefined : nextAutosaveSlot(metas);
      if (
        slot === undefined &&
        metas.filter((m) => m.autosave === undefined).length >= MAX_LOCAL_SAVES
      ) {
        return "limit";
      }
      const data = await this.gzip(snapshot);
      const stored: LocalSaveMeta = {
        // A slot keeps its id: the new save replaces the old one's bytes.
        id: slot === undefined ? this.newId() : `autosave-${slot}`,
        name: meta.name.slice(0, MAX_NAME_LENGTH),
        map: meta.map,
        tick: meta.tick,
        sizeBytes: data.byteLength,
        createdAt: new Date(this.now()).toISOString(),
        ...(meta.game === undefined ? {} : { game: meta.game }),
        ...(slot === undefined ? {} : { autosave: slot }),
      };
      await db.put(stored, data);
      return toSave(stored);
    } catch (err) {
      // A full disk or blocked storage.
      console.warn("local saves: save failed", err);
      return "request_failed";
    }
  }

  /** Renames a save. Sharing needs a server to share from: refused. */
  async update(
    id: string,
    update: { name?: string; public?: boolean },
  ): Promise<SavedGame | SavedGameError> {
    if (update.public === true) return "rejected";
    try {
      const db = await this.backend();
      if (db === null) return "request_failed";
      const meta = await db.getMeta(id);
      if (meta === undefined) return "not_found";
      if (update.name === undefined) return toSave(meta);
      const name = update.name.trim();
      if (name === "" || name.length > MAX_NAME_LENGTH) return "rejected";
      const renamed = { ...meta, name };
      await db.put(renamed);
      return toSave(renamed);
    } catch (err) {
      console.warn("local saves: rename failed", err);
      return "request_failed";
    }
  }

  async delete(id: string): Promise<true | SavedGameError> {
    try {
      const db = await this.backend();
      if (db === null) return "request_failed";
      if ((await db.getMeta(id)) === undefined) return "not_found";
      await db.remove(id);
      return true;
    } catch (err) {
      console.warn("local saves: delete failed", err);
      return "request_failed";
    }
  }

  /** A save's snapshot, uncompressed and ready to restore. */
  async download(id: string): Promise<Uint8Array | SavedGameError> {
    try {
      const db = await this.backend();
      if (db === null) return "request_failed";
      const data = await db.getData(id);
      if (data === undefined) return "not_found";
      return await this.gunzip(data);
    } catch (err) {
      console.warn("local saves: load failed", err);
      return "request_failed";
    }
  }
}

const DB_NAME = "saved-games";
const DB_VERSION = 1;
// The list reads only the small records; a save's bytes are read to play it.
const META = "meta";
const DATA = "data";
// Another tab holding an old version open can stall the open forever.
const OPEN_TIMEOUT_MS = 5_000;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function openIndexedDbSaves(
  idb: IDBFactory | undefined = globalThis.indexedDB,
): Promise<LocalSaveBackend | null> {
  if (idb === undefined) return Promise.resolve(null);
  return new Promise<IDBDatabase | null>((resolve, reject) => {
    const open = idb.open(DB_NAME, DB_VERSION);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, OPEN_TIMEOUT_MS);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DATA)) db.createObjectStore(DATA);
    };
    open.onsuccess = () => {
      clearTimeout(timer);
      // Opened after the caller gave up: the next call opens it again.
      if (timedOut) {
        open.result.close();
        return;
      }
      open.result.onversionchange = () => open.result.close();
      resolve(open.result);
    };
    open.onerror = () => {
      clearTimeout(timer);
      reject(open.error);
    };
  }).then((db) =>
    db === null
      ? null
      : {
          async allMeta() {
            const tx = db.transaction(META, "readonly");
            return (await request(
              tx.objectStore(META).getAll(),
            )) as LocalSaveMeta[];
          },
          async getMeta(id) {
            const tx = db.transaction(META, "readonly");
            return (await request(tx.objectStore(META).get(id))) as
              | LocalSaveMeta
              | undefined;
          },
          async getData(id) {
            const tx = db.transaction(DATA, "readonly");
            return (await request(tx.objectStore(DATA).get(id))) as
              | Uint8Array
              | undefined;
          },
          async put(meta, data) {
            const stores = data === undefined ? [META] : [META, DATA];
            const tx = db.transaction(stores, "readwrite");
            tx.objectStore(META).put(meta);
            if (data !== undefined) tx.objectStore(DATA).put(data, meta.id);
            await done(tx);
          },
          async remove(id) {
            const tx = db.transaction([META, DATA], "readwrite");
            tx.objectStore(META).delete(id);
            tx.objectStore(DATA).delete(id);
            await done(tx);
          },
        },
  );
}
