import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { TANK_BASE_DEFS } from "@openfront/engine-lib/ww1936/DesignRules";
import { describe, expect, it } from "vitest";
import { DesignerModel } from "../../../src/client/hud/ww1936/DesignerModel";
import { designerGame } from "./DesignerFixture";

const LOCKED = Object.entries(TANK_BASE_DEFS).find(
  ([, b]) => b.tech !== undefined,
)![0];

describe("draft for the library", () => {
  it("a locked chassis can be drafted and saved to the library, and stays marked locked", () => {
    const m = new DesignerModel(designerGame({ techs: [] }));
    m.open("tank", LOCKED);
    m.setDraftMode(true);
    expect(m.libraryBlock()).toBeNull();
    expect(m.stats()).not.toBeNull();
    expect(m.baseChips().find((c) => c.id === LOCKED)?.locked).toBe(true);
    expect(m.checkNew(m.draft!).techs.length).toBeGreaterThan(0);
  });

  it("the in-game save still refuses it, in draft mode or not", () => {
    const m = new DesignerModel(designerGame({ techs: [] }));
    m.open("tank", LOCKED);
    expect(m.block()).toBe("bad_base");
    m.setDraftMode(true);
    expect(m.block()).toBe("bad_base");
    expect(m.tapSave(0)).toBeNull();
    expect(m.save()).toBeNull();
    // With the tech it saves in the game once the switch is off.
    const full = new DesignerModel(designerGame({ techs: WW_TECH_IDS }));
    full.open("tank", LOCKED);
    expect(full.checkNew(full.draft!).block).toBeNull();
  });
});
