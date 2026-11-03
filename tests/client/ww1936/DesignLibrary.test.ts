import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import {
  KeyValueStorage,
  LIBRARY_KEY,
  LibraryStore,
  SHARE_CODE_MAX,
} from "../../../src/client/hud/ww1936/DesignLibrary";
import {
  entryStatus,
  LibraryAuto,
} from "../../../src/client/hud/ww1936/DesignLibraryStatus";
import { designerGame, saved } from "./DesignerFixture";

const TANK: DesignDef = {
  kind: "tank",
  base: "light_1",
  modules: ["", "", "", "", "", ""],
  armorLevel: 1,
  engineLevel: 0,
  name: "Mine",
};

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

/** The designer fixture plus what the library reads: templates, a live country, a scenario. */
function gameWith(
  o: {
    techs?: readonly string[];
    designs?: ReturnType<typeof saved>[];
    templates?: { battalions: string[]; support: string[] }[];
  } = {},
) {
  const base = designerGame({
    techs: o.techs as never,
    designs: o.designs,
  }) as unknown as Record<string, unknown>;
  return {
    ...base,
    myPlayer: () => ({ smallID: () => 1, isAlive: () => true }),
    worldWarScenario: () => ({}),
    wwLand: () => ({
      version: 1,
      details: new Map([[1, { templates: o.templates ?? [] }]]),
    }),
  } as never;
}

describe("design library", () => {
  it("round trip: saved to storage, read back, load sends the normal orders", () => {
    const disk = memory();
    const a = new LibraryStore(() => disk);
    a.add({ type: "design", def: TANK });
    a.add({
      type: "template",
      name: "Line",
      battalions: ["infantry", "infantry"],
      support: [],
    });
    const b = new LibraryStore(() => disk); // a new game, a new page
    expect(b.entries).toHaveLength(2);
    const game = gameWith();
    const [d, t] = b.entries.map((e) => entryStatus(e, game));
    expect(d.state).toBe("ready");
    expect(d.order).toEqual({ kind: "design_save", def: TANK });
    expect(t.order).toMatchObject({
      kind: "template_save",
      template: 0,
      base: 0,
      name: "Line",
    });
  });

  it("the same contents twice do not duplicate; the name is updated", () => {
    const s = new LibraryStore(() => memory());
    expect(s.add({ type: "design", def: TANK })).toBe("added");
    expect(s.add({ type: "design", def: { ...TANK, name: "New" } })).toBe(
      "renamed",
    );
    s.add({
      type: "template",
      name: "A",
      battalions: ["infantry", "cavalry"],
      support: [],
    });
    s.add({
      type: "template",
      name: "B",
      battalions: ["cavalry", "infantry"],
      support: [],
    });
    expect(s.entries).toHaveLength(2);
    expect(s.entries[0]).toMatchObject({ def: { name: "New" } });
  });

  it("a blocked entry says why, offers no order, and a stale one is unusable", () => {
    const poor = gameWith({ techs: [] });
    const s = new LibraryStore(() => memory());
    s.add({ type: "design", def: { ...TANK, base: "medium_1" } });
    s.add({
      type: "template",
      name: "Line",
      battalions: ["infantry"],
      support: [],
    });
    s.add({ type: "design", def: { ...TANK, base: "gone_9" } });
    const [tank, line, gone] = s.entries.map((e) => entryStatus(e, poor));
    expect(tank.state).toBe("blocked");
    expect(tank.reason).toContain("ww1936.library.needs");
    expect(tank.order).toBeNull();
    expect(line.state).toBe("blocked");
    expect(line.reason).toContain("inf_eq_1");
    // Nothing costs experience any more: a rich game says ready.
    const rich = gameWith({ techs: WW_TECH_IDS });
    expect(entryStatus(s.entries[1], rich).state).toBe("ready");
    expect(gone.state).toBe("stale");
    expect(gone.order).toBeNull();
  });

  it("auto-create sends once, and not again after a reload that already has it", () => {
    const disk = memory();
    const s = new LibraryStore(() => disk);
    s.add({ type: "design", def: TANK });
    s.setAuto(s.entries[0].id, true);
    let t = 0;
    const sent: unknown[] = [];
    const empty = gameWith({ techs: WW_TECH_IDS });
    const auto = new LibraryAuto(
      s,
      (o) => sent.push(o),
      () => undefined,
      () => t,
    );
    auto.tick(empty);
    t += 5_000;
    auto.tick(empty); // the order is on its way: nothing more
    t += 40_000;
    auto.tick(empty);
    expect(sent).toHaveLength(1);
    // Reload: the game now holds the design (even retired), so a new runner sends nothing.
    const again = new LibraryStore(() => disk);
    expect(again.entries[0].auto).toBe(true);
    const held = gameWith({ designs: [saved(TANK, 1, { obsolete: true })] });
    const second = new LibraryAuto(
      again,
      (o) => sent.push(o),
      () => undefined,
      () => 0,
    );
    second.tick(held);
    expect(sent).toHaveLength(1);
  });

  it("bad share codes are refused without crashing or changing the library", () => {
    const s = new LibraryStore(() => memory());
    s.add({ type: "design", def: TANK });
    const code = s.exportCode();
    const bad = [
      "",
      "hello",
      "WW36L1:not base64!!",
      "WW36L1:" + btoa('{"v":1,"e":[{"type":"design"}]}'),
      "WW36L1:" + "A".repeat(SHARE_CODE_MAX),
    ];
    for (const text of bad) expect(s.importCode(text).ok).toBe(false);
    expect(s.entries).toHaveLength(1);
    const other = new LibraryStore(() => memory());
    expect(other.importCode(code)).toMatchObject({ ok: true, added: 1 });
    expect(other.entries[0].auto).toBe(false);
    expect(LIBRARY_KEY).toBeTruthy();
  });

  it("army templates: round trip, share code, same contents renamed, old data loads", () => {
    const mem = memory();
    // A file written before army templates existed still loads.
    mem.setItem(
      LIBRARY_KEY,
      JSON.stringify({
        v: 1,
        entries: [
          {
            id: "old",
            auto: false,
            type: "template",
            name: "Old",
            battalions: ["infantry"],
            support: [],
          },
          { id: "future", type: "from-a-later-version" },
        ],
      }),
    );
    const s = new LibraryStore(() => mem);
    expect(s.entries.map((e) => e.id)).toEqual(["old"]);
    const army = {
      type: "army" as const,
      name: "Armoured",
      items: [
        { name: "Inf", battalions: ["infantry"], support: [], count: 10 },
        { name: "Tank", battalions: ["light_armor"], support: [], count: 4 },
      ],
    };
    expect(s.add(army)).toBe("added");
    // The same contents in another order and name: renamed, not duplicated.
    expect(
      s.add({
        ...army,
        name: "Again",
        items: [army.items[1], army.items[0]],
      }),
    ).toBe("renamed");
    expect(s.entries).toHaveLength(2);
    const back = new LibraryStore(() => mem);
    expect(back.entries[1]).toMatchObject({ type: "army", name: "Again" });
    // The status card needs no game: an army template is not loaded here.
    expect(
      entryStatus(back.entries[1], {} as never, new Set()).order,
    ).toBeNull();
    // Share code round trip; more than 24 divisions in a code are refused.
    const other = new LibraryStore(() => memory());
    expect(other.importCode(s.exportCode([s.entries[1].id]))).toMatchObject({
      ok: true,
      added: 1,
    });
    expect(other.entries[0]).toMatchObject({ type: "army", name: "Again" });
    const big = JSON.stringify({
      v: 1,
      e: [{ ...army, items: [{ ...army.items[0], count: 25 }] }],
    });
    expect(other.importCode("WW36L1:" + btoa(big)).ok).toBe(false);
  });
});
