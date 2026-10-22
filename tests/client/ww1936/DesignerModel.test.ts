import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { designStats } from "@openfront/engine-lib/ww1936/DesignRules";
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

import { DesignerModel } from "../../../src/client/hud/ww1936/DesignerModel";
import { designerGame, saved } from "./DesignerFixture";

const ALL = new Set(WW_TECH_IDS);
const CTX = { techs: ALL, projects: 0, relPp: 0, costPct: 0 };

describe("DesignerModel", () => {
  it("the designer shows designStats numbers", () => {
    const m = new DesignerModel(designerGame());
    m.open("tank");
    m.setBase("medium_2");
    m.setModule(0, "gun_hv");
    expect(m.stats()).toEqual(designStats(m.draft!, CTX));
    const s = designStats(m.draft!, CTX) as { soft: number; pierce: number };
    const rows = m.statRows();
    expect(rows.find((r) => r.id === "soft")?.text).toBe(String(s.soft / 100));
    expect(rows.find((r) => r.id === "pierce")?.text).toBe(
      String(s.pierce / 100),
    );
    expect(rows).toHaveLength(8);
  });

  it("a locked module row shows its tech and year", () => {
    const m = new DesignerModel(designerGame({ techs: [] }));
    m.open("tank");
    m.setBase("light_1");
    const rows = m.moduleRows(0);
    const small = rows.find((r) => r.id === "gun_small");
    expect(small?.block).toMatchObject({ tech: "anti_tank_1" });
    expect(small?.block?.year).toBeGreaterThan(1935);
    expect(rows.find((r) => r.id === "mg")?.block).toBeNull();
  });

  it("the compare column marks better and worse", () => {
    const m = new DesignerModel(designerGame());
    m.open("tank");
    m.setBase("medium_2");
    m.recommend();
    // The compare target is the base fitting: the recommended fit hits harder.
    const rows = m.statRows();
    expect(rows.find((r) => r.id === "pierce")?.sign).toBe(1);
    expect(rows.find((r) => r.id === "pierce")?.diffText).toMatch(/^\+/);
    // A newer saved design of the same role becomes the target.
    const better: DesignDef = { ...m.draft!, name: "x", armorLevel: 10 };
    const m2 = new DesignerModel(designerGame({ designs: [saved(better, 1)] }));
    m2.open("tank");
    m2.setBase("medium_2");
    expect(m2.compareIsSaved()).toBe(true);
    expect(m2.statRows().some((r) => r.sign === -1)).toBe(true);
  });

  it("a refused design disables save with the block's text", () => {
    const m = new DesignerModel(designerGame({ techs: ["light_tank_1"] }));
    m.open("tank");
    expect(m.block()).toBe("bad_base");
    m.setBase("light_1");
    m.setModule(0, "gun_small");
    expect(m.block()).toBe("module_locked");
    expect(m.tapSave(0)).toBeNull();
    expect(m.save()).toBeNull();
  });

  it("an experience shortfall refuses the save", () => {
    const m = new DesignerModel(designerGame({ armyXp: 0 }));
    m.open("tank");
    m.setBase("light_1");
    expect(m.block()).toBe("no_xp");
  });

  it("an automatic name is drawn at display time", () => {
    const m = new DesignerModel(designerGame());
    m.open("tank");
    m.setBase("medium_2");
    expect(m.draft!.name).toBe("@");
    expect(m.displayName()).toBe(m.autoName());
    m.setName("My tank");
    expect(m.displayName()).toBe("My tank");
    m.setName("");
    expect(m.draft!.name).toBe("@");
  });

  it("ship and plane designers give eight rows", () => {
    const m = new DesignerModel(designerGame());
    m.open("ship");
    m.setBase("dd_1");
    expect(m.statRows()).toHaveLength(8);
    m.setKind("plane");
    m.setBase("small_2");
    expect(m.statRows()).toHaveLength(8);
    expect(m.block()).toBeNull();
  });
});
