// Plane design reform, phase 2, the designer's plane tab: the cell list
// (locked / not designed / my design with its score and the old mark), the
// type constraint on modules, the old mark on a production line, and one
// auto library entry per cell.
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  planeType,
  recommendedPlane,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import { DesignerModel } from "../../../src/client/hud/ww1936/DesignerModel";
import { LibraryStore } from "../../../src/client/hud/ww1936/DesignLibrary";
import { designerGame, saved } from "./DesignerFixture";

const ALL = new Set(WW_TECH_IDS);
const fit = (base: string, type?: string) =>
  ({ ...recommendedPlane(base, ALL, type), name: base }) as DesignDef;
/** A weak fighter: old against the newest static fighter. */
const weak = (base: string) =>
  ({ ...fit(base, "fighter"), modules: ["w_mg2", "", "", ""] }) as DesignDef;

describe("plane cells", () => {
  it("lists the airframe cells of the type: locked, not designed, designed with score", () => {
    const m = new DesignerModel(
      designerGame({
        techs: ["fighter_1", "fighter_2"],
        designs: [saved(fit("small_1", "fighter"), 1)],
      }),
    );
    m.open("plane");
    const cells = m.planeCells();
    // A fighter flies on the small frames and the jets only.
    expect(cells.map((c) => c.base)).toEqual([
      "small_1",
      "small_2",
      "small_3",
      "jet_1",
      "jet_2",
    ]);
    const s1 = cells.find((c) => c.base === "small_1")!;
    const s2 = cells.find((c) => c.base === "small_2")!;
    const s3 = cells.find((c) => c.base === "small_3")!;
    expect(s1.saved?.slot).toBe(1);
    expect(s1.score).toBeGreaterThan(0);
    expect(s2.saved).toBeNull();
    expect(s2.locked).toBe(false);
    expect(s3.locked).toBe(true);
    // Another type: the fighter design is not in that type's cells.
    m.setPlaneType("bomber");
    expect(m.planeCells().map((c) => c.base)).toEqual([
      "medium_1",
      "medium_2",
      "medium_3",
      "jet_medium_1",
    ]);
    expect(m.planeCells().every((c) => c.saved === null)).toBe(true);
  });

  it("marks a design old when a better plane of its type is more than 15 % ahead", () => {
    const m = new DesignerModel(
      designerGame({ designs: [saved(weak("small_1"), 1)] }),
    );
    m.open("plane");
    expect(m.planeCells().find((c) => c.base === "small_1")!.old).toBe(true);
    const lone = new DesignerModel(
      designerGame({
        techs: ["fighter_1"],
        designs: [saved(fit("small_1", "fighter"), 1)],
      }),
    );
    lone.open("plane");
    expect(lone.planeCells().find((c) => c.base === "small_1")!.old).toBe(
      false,
    );
  });

  it("choosing a cell loads its design, or the recommended fit of the type", () => {
    const mine = { ...fit("small_2", "fighter"), name: "Mine" } as DesignDef;
    const m = new DesignerModel(designerGame({ designs: [saved(mine, 4)] }));
    m.open("plane");
    m.setBase("small_2");
    expect(m.draft!.name).toBe("Mine");
    m.setBase("small_3");
    expect(m.draft!.name).toBe("@");
    expect(m.draft!.modules).toEqual(fit("small_3", "fighter").modules);
    m.setPlaneType("cv_fighter");
    m.setBase("small_2");
    expect(planeType(m.draft!)).toBe("cv_fighter");
    expect(m.roleMismatch()).toBe(false);
  });

  it("offers only modules that keep the cell's plane type", () => {
    const m = new DesignerModel(designerGame());
    m.open("plane");
    m.setBase("small_2");
    const ids = (slot: number) => m.moduleRows(slot).map((r) => r.id);
    // A fighter: no bombs, rockets or torpedo in the weapon slot...
    expect(ids(0)).not.toContain("w_torpedo");
    expect(ids(0)).not.toContain("w_rockets");
    // ... and no carrier hook or dive brakes in the special slot.
    expect(ids(3)).not.toContain("m_carrier");
    expect(ids(3)).not.toContain("m_dive_brakes");
    m.setPlaneType("cv_fighter");
    m.setBase("small_2");
    // The carrier form keeps its hook: the special slot has no empty choice.
    expect(ids(3)).toEqual(["m_carrier"]);
  });

  it("saving is impossible when the draft's type no longer matches", () => {
    const m = new DesignerModel(designerGame());
    m.open("plane");
    m.setBase("small_2");
    expect(m.save()).not.toBeNull();
    m.setModule(0, "w_torpedo");
    expect(m.roleMismatch()).toBe(true);
    expect(m.save()).toBeNull();
    expect(m.tapSave(1_000)).toBeNull();
  });

  it("a line making an old plane is marked and offered the best key", () => {
    const m = new DesignerModel(
      designerGame({ techs: ["fighter_1", "fighter_2"] }),
    );
    const old = m.lineOld("fighter", 1)!;
    expect(old.old).toBe(true);
    expect(old.best).toEqual({ equipment: "fighter", gen: 2 });
    expect(m.lineOld("fighter", 2)).toEqual({ old: false, best: null });
    // A design line: old against the fighters, switching to the second generation.
    const withDesign = new DesignerModel(
      designerGame({
        techs: ["fighter_1", "fighter_2"],
        designs: [saved(weak("small_1"), 3)],
      }),
    );
    expect(withDesign.lineOld("plane_design", 3)).toMatchObject({
      old: true,
      best: { equipment: "fighter", gen: 2 },
    });
    // Not a plane or tank key.
    expect(m.lineOld("artillery", 1)).toBeNull();
  });

  it("the library keeps one auto entry per plane cell", () => {
    const mem = new Map<string, string>();
    const s = new LibraryStore(() => ({
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    }));
    s.add({ type: "design", def: { ...fit("small_2", "fighter"), name: "A" } });
    s.add({ type: "design", def: { ...weak("small_2"), name: "B" } });
    s.add({
      type: "design",
      def: { ...fit("small_2", "cas"), name: "CAS" },
    });
    const [a, b, cas] = s.entries.map((e) => e.id);
    expect(s.setAuto(a, true)).toEqual([]);
    expect(s.setAuto(cas, true)).toEqual([]);
    const off = s.setAuto(b, true);
    expect(off.map((e) => e.id)).toEqual([a]);
    expect(s.entries.map((e) => e.auto)).toEqual([false, true, true]);
  });
});
