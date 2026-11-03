// Tank design reform, phase 1, the designer's tank tab: the cell list
// (locked / not designed / my design with its score and the old mark), the
// role constraint on modules, and the save over a cell.
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { recommendedTank } from "@openfront/engine-lib/ww1936/DesignRules";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import { DesignerModel } from "../../../src/client/hud/ww1936/DesignerModel";
import { designerGame, saved } from "./DesignerFixture";

const ALL = new Set(WW_TECH_IDS);
const fit = (base: string, role: Parameters<typeof recommendedTank>[2]) =>
  ({ ...recommendedTank(base, ALL, role), name: base }) as DesignDef;

describe("tank cells", () => {
  it("lists the cells of the role: locked, not designed, designed with score", () => {
    const m = new DesignerModel(
      designerGame({
        techs: ["light_tank_1", "light_tank_2"],
        designs: [saved(fit("light_1", "tank"), 1)],
      }),
    );
    m.open("tank");
    const cells = m.cells();
    expect(cells.map((c) => c.base)).toContain("heavy_3");
    const l1 = cells.find((c) => c.base === "light_1")!;
    const l2 = cells.find((c) => c.base === "light_2")!;
    const m1 = cells.find((c) => c.base === "medium_1")!;
    expect(l1.saved?.slot).toBe(1);
    expect(l1.score).toBeGreaterThan(0);
    expect(l2.saved).toBeNull();
    expect(l2.locked).toBe(false);
    expect(m1.locked).toBe(true);
    // Another role: the light I design is not in that role's cells.
    m.setRole("tank_destroyer");
    expect(m.cells().every((c) => c.saved === null)).toBe(true);
  });

  it("marks a design old when a better key of its group is more than 15 % ahead", () => {
    const m = new DesignerModel(
      designerGame({
        techs: ["light_tank_1", "light_tank_2"],
        designs: [saved(fit("light_1", "tank"), 1)],
      }),
    );
    m.open("tank");
    // The light II static (and its recommended design) beat light I by far.
    expect(m.cells().find((c) => c.base === "light_1")!.old).toBe(true);
    const lone = new DesignerModel(
      designerGame({
        techs: ["light_tank_1"],
        designs: [saved(fit("light_1", "tank"), 1)],
      }),
    );
    lone.open("tank");
    expect(lone.cells().find((c) => c.base === "light_1")!.old).toBe(false);
  });

  it("choosing a cell loads its design, or the recommended fit of the role", () => {
    const mine = { ...fit("medium_2", "tank"), name: "Mine" } as DesignDef;
    const m = new DesignerModel(designerGame({ designs: [saved(mine, 4)] }));
    m.open("tank");
    m.setBase("medium_2");
    expect(m.draft!.name).toBe("Mine");
    m.setBase("medium_3");
    expect(m.draft!.name).toBe("@");
    expect(m.draft!.modules).toEqual(
      recommendedTank("medium_3", ALL, "tank").modules,
    );
    m.setRole("sp_artillery");
    m.setBase("medium_2");
    expect(m.draft!.modules[0]).toBe("howitzer");
  });

  it("offers only modules that keep the cell's role", () => {
    const m = new DesignerModel(designerGame());
    m.open("tank");
    m.setBase("medium_2");
    const gunIds = (slot: number) => m.moduleRows(slot).map((r) => r.id);
    // A tank: no howitzer, no anti-air gun.
    expect(gunIds(0)).not.toContain("howitzer");
    expect(gunIds(0)).not.toContain("aa_auto");
    // ... and no turret-less hull (that would be a tank destroyer).
    expect(gunIds(1)).not.toContain("turret_none");
    m.setRole("tank_destroyer");
    m.setBase("medium_2");
    expect(gunIds(1)).toEqual(["turret_none"]);
    expect(gunIds(0)).not.toContain("howitzer");
    m.setRole("sp_anti_air");
    m.setBase("medium_2");
    expect(gunIds(0)).toEqual(["aa_auto"]);
  });

  it("saving is impossible when the draft's role no longer matches", () => {
    const m = new DesignerModel(designerGame());
    m.open("tank");
    m.setBase("medium_2");
    expect(m.save()).not.toBeNull();
    // A module that turns it into a self-propelled gun (a hand-made draft).
    m.setModule(0, "howitzer");
    expect(m.roleMismatch()).toBe(true);
    expect(m.save()).toBeNull();
    expect(m.tapSave(1_000)).toBeNull();
  });

  it("a line making an old key is marked and offered the best key", () => {
    const m = new DesignerModel(
      designerGame({ techs: ["light_tank_1", "light_tank_2"] }),
    );
    const old = m.lineOld("light_tank", 1)!;
    expect(old.old).toBe(true);
    expect(old.best).toEqual({ equipment: "light_tank", gen: 2 });
    expect(m.lineOld("light_tank", 2)).toEqual({ old: false, best: null });
    // Not a tank key.
    expect(m.lineOld("artillery", 1)).toBeNull();
  });
});
