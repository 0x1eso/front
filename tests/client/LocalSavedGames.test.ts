import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type LocalSaveBackend,
  LocalSavedGames,
  MAX_LOCAL_SAVES,
} from "../../src/client/LocalSavedGames";
import {
  deleteSavedGame,
  downloadSavedGame,
  fetchSharedSavedGame,
  listSavedGames,
  localSavedGames,
  updateSavedGame,
  uploadSavedGame,
} from "../../src/client/SavedGamesApi";

/** A backend as IndexedDB would be, kept in Maps. */
function memoryBackend(): LocalSaveBackend & { data: Map<string, Uint8Array> } {
  const meta = new Map<string, Parameters<LocalSaveBackend["put"]>[0]>();
  const data = new Map<string, Uint8Array>();
  return {
    data,
    allMeta: async () => [...meta.values()],
    getMeta: async (id) => meta.get(id),
    getData: async (id) => data.get(id),
    put: async (m, d) => {
      meta.set(m.id, m);
      if (d !== undefined) data.set(m.id, d);
    },
    remove: async (id) => {
      meta.delete(id);
      data.delete(id);
    },
  };
}

// Stand-ins for gzip: reversible, and visibly not the input.
const pack = async (b: Uint8Array) => Uint8Array.from([9, ...b]);
const unpack = async (b: Uint8Array) => b.slice(1);

function store(backend: LocalSaveBackend | null = memoryBackend()) {
  let t = Date.UTC(2026, 9, 30, 12, 0);
  let n = 0;
  return new LocalSavedGames(
    async () => backend,
    pack,
    unpack,
    () => (t += 60_000),
    () => `id${n++}`,
  );
}

const META = { name: "World 2026-10-30 12:00", map: "World", tick: 6000 };

describe("LocalSavedGames", () => {
  it("keeps a save and gives back the snapshot it was made from", async () => {
    const backend = memoryBackend();
    const saves = store(backend);
    const saved = await saves.save(new Uint8Array([1, 2, 3]), META);
    expect(saved).toMatchObject({ ...META, id: "id0", public: false });
    // Stored compressed, as the API stores it.
    expect([...backend.data.get("id0")!]).toEqual([9, 1, 2, 3]);
    expect([...((await saves.download("id0")) as Uint8Array)]).toEqual([
      1, 2, 3,
    ]);
  });

  it("lists the newest first", async () => {
    const saves = store();
    await saves.save(new Uint8Array([1]), { ...META, name: "first" });
    await saves.save(new Uint8Array([2]), { ...META, name: "second" });
    const list = await saves.list();
    expect(list && list.map((s) => s.name)).toEqual(["second", "first"]);
  });

  it("renames, and refuses an empty name and sharing", async () => {
    const saves = store();
    await saves.save(new Uint8Array([1]), META);
    expect(await saves.update("id0", { name: "  Berlin  " })).toMatchObject({
      name: "Berlin",
    });
    expect(await saves.update("id0", { name: "   " })).toBe("rejected");
    expect(await saves.update("id0", { public: true })).toBe("rejected");
    expect(await saves.update("nope", { name: "x" })).toBe("not_found");
  });

  it("deletes a save and its bytes", async () => {
    const backend = memoryBackend();
    const saves = store(backend);
    await saves.save(new Uint8Array([1]), META);
    expect(await saves.delete("id0")).toBe(true);
    expect(await saves.list()).toEqual([]);
    expect(backend.data.size).toBe(0);
    expect(await saves.delete("id0")).toBe("not_found");
    expect(await saves.download("id0")).toBe("not_found");
  });

  it("stops at its limit", async () => {
    const saves = store();
    for (let i = 0; i < MAX_LOCAL_SAVES; i++) {
      await saves.save(new Uint8Array([i]), META);
    }
    expect(await saves.save(new Uint8Array([0]), META)).toBe("limit");
  });

  it("answers as a failed request when the browser has no storage", async () => {
    const saves = store(null);
    expect(await saves.list()).toBe(false);
    expect(await saves.save(new Uint8Array([1]), META)).toBe("request_failed");
    expect(await saves.download("id0")).toBe("request_failed");
  });
});

describe("SavedGamesApi on a self-hosted server", () => {
  afterEach(() => {
    delete (window as { BOOTSTRAP_CONFIG?: unknown }).BOOTSTRAP_CONFIG;
    vi.restoreAllMocks();
  });

  it("asks this browser's store, never the network", async () => {
    (window as { BOOTSTRAP_CONFIG?: unknown }).BOOTSTRAP_CONFIG = {
      selfHosted: true,
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const saved = {
      ...META,
      id: "a",
      sizeBytes: 1,
      createdAt: "",
      public: false,
    };
    const list = vi.spyOn(localSavedGames, "list").mockResolvedValue([saved]);
    const save = vi.spyOn(localSavedGames, "save").mockResolvedValue(saved);
    const update = vi.spyOn(localSavedGames, "update").mockResolvedValue(saved);
    const del = vi.spyOn(localSavedGames, "delete").mockResolvedValue(true);
    const bytes = new Uint8Array([1]);
    const download = vi
      .spyOn(localSavedGames, "download")
      .mockResolvedValue(bytes);

    expect(await listSavedGames()).toEqual([saved]);
    expect(await uploadSavedGame(bytes, META)).toBe(saved);
    expect(await updateSavedGame("a", { name: "b" })).toBe(saved);
    expect(await deleteSavedGame("a")).toBe(true);
    expect(await downloadSavedGame("a", false)).toBe(bytes);
    // Nothing is shared from a browser's own store.
    expect(await downloadSavedGame("a", true)).toBe("not_found");
    expect(await fetchSharedSavedGame("a")).toBe("not_found");

    expect(list).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(bytes, META);
    expect(update).toHaveBeenCalledWith("a", { name: "b" });
    expect(del).toHaveBeenCalledWith("a");
    expect(download).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
