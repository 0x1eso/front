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

import { IntentSchema } from "@openfront/engine-api/Schemas";
import {
  cleanDesignName,
  DesignerModel,
} from "../../../src/client/hud/ww1936/DesignerModel";
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
    expect(rows.find((r) => r.id === "soft_attack")?.text).toBe(
      String(s.soft / 100),
    );
    expect(rows.find((r) => r.id === "piercing")?.text).toBe(
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
    expect(rows.find((r) => r.id === "piercing")?.sign).toBe(1);
    expect(rows.find((r) => r.id === "piercing")?.diffText).toMatch(/^\+/);
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

  it("a plane design reads the air force's experience (lane D's detail.doctrine.xp)", () => {
    const m = new DesignerModel(designerGame({ airXp: 0 }));
    m.open("plane");
    m.setBase("small_2");
    expect(m.xpHave()).toBe(0);
    expect(m.block()).toBe("no_xp");
    const rich = new DesignerModel(designerGame({ airXp: 500 }));
    rich.open("plane");
    rich.setBase("small_2");
    expect(rich.xpHave()).toBe(500_000);
    expect(rich.block()).not.toBe("no_xp");
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

  it("final review D (D1): a typed name is cleaned to what the server takes", () => {
    const savedName = (typed: string) => {
      const m = new DesignerModel(designerGame());
      m.open("tank");
      m.setBase("medium_2");
      m.setName(typed);
      expect(m.nameOk()).toBe(true);
      m.tapSave(1_000);
      const order = m.tapSave(2_000);
      expect(order).not.toBeNull();
      // The order the server parses: no kick.
      expect(IntentSchema.safeParse({ type: "ww_order", order }).success).toBe(
        true,
      );
      return (order as { def: { name: string } }).def.name;
    };
    // A trailing space (a Korean IME commonly leaves one) and a leading one.
    expect(savedName("Tiger ")).toBe("Tiger");
    expect(savedName("티거 ")).toBe("티거");
    expect(savedName("  Königstiger")).toBe("Königstiger");
    // Markup loses its brackets.
    expect(savedName("<b>Tiger</b>")).toBe("bTiger/b");
    // A ZWJ emoji loses its joiner (and a bidi override is dropped).
    expect(savedName("🏳️‍🌈 Panzer")).toBe("🏳️🌈 Panzer");
    expect(savedName("\u202ePanzer")).toBe("Panzer");
    // Too long: cut to 24 at a whole character, then trimmed.
    expect(savedName("Panzerkampfwagen VI Ausf. B")).toBe(
      "Panzerkampfwagen VI Ausf",
    );
    expect(cleanDesignName("🐯".repeat(13))).toBe("🐯".repeat(12));
    // Nothing left: the automatic name.
    expect(cleanDesignName(" <> \u200d ")).toBe("");
    expect(savedName(" <> ")).toBe("@");
  });

  it("final review D (D1): a name the schema refuses blocks Save", () => {
    const m = new DesignerModel(designerGame());
    m.open("tank");
    m.setBase("medium_2");
    // A name that got past setName (an old draft, a future screen).
    m.draft = { ...m.draft!, name: "Tiger " };
    expect(m.nameOk()).toBe(false);
    expect(m.tapSave(1_000)).toBeNull();
    expect(m.tapSave(2_000)).toBeNull();
    expect(m.save()).toBeNull();
    m.setName(m.draft.name);
    expect(m.nameOk()).toBe(true);
    expect(m.save()).not.toBeNull();
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

  it("a copy is refused when every slot holds a design", () => {
    const def = {
      kind: "tank",
      base: "light_1",
      modules: ["", "", "", "", "", ""],
      armorLevel: 0,
      engineLevel: 0,
      name: "x",
    } as DesignDef;
    const full = Array.from({ length: 12 }, (_, i) => saved(def, i + 1));
    const m = new DesignerModel(designerGame({ designs: full }));
    m.open("tank", def);
    expect(m.block()).toBe("design_slots_full");
  });
});
