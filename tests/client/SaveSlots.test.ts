import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// The lists read Korean: translateText from ko.json, params filled in.
vi.mock("../../src/client/Utils", () => {
  const ko = JSON.parse(readFileSync("resources/lang/ko.json", "utf8"));
  return {
    translateText: (key: string, params: Record<string, unknown> = {}) => {
      const text = key
        .split(".")
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], ko);
      if (typeof text !== "string") return key;
      return text.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p]));
    },
  };
});

import {
  type LocalSaveBackend,
  LocalSavedGames,
} from "../../src/client/LocalSavedGames";
import { saveGameLabel, saveTitle } from "../../src/client/SaveLabel";

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

describe("saves: the mode's own label, and three rotating autosaves", () => {
  it("labels a save by its mode, not its map (1914 shares the 1936 map)", () => {
    expect(
      saveGameLabel({ mode: "gw1914", country: "DEU", date: "1915-03-10" }),
    ).toBe("대전쟁 1914 · 독일 제국 · 1915년 3월");
    expect(
      saveGameLabel({ mode: "imjin", country: "JOS", date: "1592-05-23" }),
    ).toBe("임진왜란 1592 · 조선 · 1592년 5월");
    expect(saveGameLabel({ mode: "ww1936" })).toBe("세계대전 1936");
  });

  it("rotates autosaves through slots 1-3, oldest first, leaving manual saves alone", async () => {
    const backend = memoryBackend();
    let t = Date.UTC(2026, 10, 13, 12, 0);
    let n = 0;
    const saves = new LocalSavedGames(
      async () => backend,
      async (b) => b,
      async (b) => b,
      () => (t += 60_000),
      () => `id${n++}`,
    );
    const game = {
      mode: "gw1914",
      country: "DEU",
      date: "1914-08-01",
    } as const;
    const meta = { name: "대전쟁 1914", map: "World 1936", tick: 1, game };
    await saves.save(new Uint8Array([100]), meta);

    const slots: (number | undefined)[] = [];
    for (let i = 1; i <= 5; i++) {
      const s = await saves.autosave(new Uint8Array([i]), meta);
      if (typeof s === "string") throw new Error(s);
      slots.push(s.autosave);
    }
    expect(slots).toEqual([1, 2, 3, 1, 2]);

    const list = await saves.list();
    if (list === false) throw new Error("list failed");
    expect(list.map((s) => saveTitle(s))).toEqual([
      "자동 2",
      "자동 1",
      "자동 3",
      "대전쟁 1914",
    ]);
    expect(list.every((s) => s.game?.mode === "gw1914")).toBe(true);
    // Slot 3 holds the third autosave; slots 1 and 2 the newest two.
    expect(backend.data.get("autosave-3")).toEqual(new Uint8Array([3]));
    expect(backend.data.get("autosave-2")).toEqual(new Uint8Array([5]));
    // The player's own save is as it was.
    expect(backend.data.get("id0")).toEqual(new Uint8Array([100]));
    expect(list[3]).toMatchObject({ id: "id0", name: "대전쟁 1914" });
    expect(list[3].autosave).toBeUndefined();
  });
});
