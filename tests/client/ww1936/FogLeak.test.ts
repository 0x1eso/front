// World War 1936 P6 (spec §8.9, §25.3): the fog must not leak. A hidden
// enemy's numbers never reach a card's text, a tooltip or a token's data,
// and no card reads the enemy's counts without the fog model.
import { EventBus } from "@openfront/shared/EventBus";
import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { fogModelOf } from "../../../src/client/hud/ww1936/FogModel";
import { OpenWwBattleEvent } from "../../../src/client/hud/ww1936/LandSelection";
import "../../../src/client/hud/ww1936/WwBattleCard";
import type { WwBattleCard } from "../../../src/client/hud/ww1936/WwBattleCard";
import {
  hitToken,
  layoutTokens,
  TokenLayoutCache,
} from "../../../src/client/view/LandTokenLayout";
import { FAR, fogGame, NEAR, newFog } from "./FogFixture";
import { army, battle, ID } from "./LandFixture";

// Numbers no label may contain by accident.
const LINE = 137;
const RESERVE = 241;
const WIDTH = 389;

async function battleCard(level: number) {
  const g = fogGame({
    level,
    armies: [army(3, "POL", NEAR, { divisions: 173 })],
    battles: [
      battle(NEAR, "DEU", "POL", {
        defLine: LINE,
        defReserve: RESERVE,
        defWidth: WIDTH,
        defOrgPm: 777,
        defStrPm: 641,
        width: 457,
      }),
    ],
  });
  fogModelOf(g.game as never);
  const el = document.createElement("ww-battle-card") as WwBattleCard;
  el.game = g.game as never;
  el.eventBus = new EventBus();
  document.body.appendChild(el);
  el.init();
  el.eventBus.emit(new OpenWwBattleEvent(NEAR));
  el.tick();
  await el.updateComplete;
  return { g, el };
}

describe("fog leaks (spec §8.9)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fog hides exact enemy counts in every card", async () => {
    // Battle card, band 0.
    const { g, el } = await battleCard(0);
    const side = el.querySelector("[data-ww-battle-side='defender']")!;
    for (const n of [LINE, RESERVE, WIDTH, 777, 641, 77.7, 64.1]) {
      expect(side.textContent).not.toContain(String(n));
    }
    expect(side.textContent).toContain("n=?");
    expect(side.querySelector("[data-ww-battle-width]")).toBeNull();
    for (const node of el.querySelectorAll("[title], [aria-label]")) {
      expect(node.getAttribute("title") ?? "").not.toContain(String(LINE));
    }
    // The other cards' numbers, drawn at band 0: the model's answers.
    const f = newFog(g);
    const texts = [
      f.battleEnemyLabel(NEAR, 0),
      f.countLabel(ID("POL"), 173),
      f.countLabel(0, 173),
      f.zoneSorties(1, ID("POL")),
      f.regionView(NEAR).label(173),
      String(f.previewEnemyValue(173, ID("POL"))),
      String(f.previewEnemyValue(173, 0)),
    ];
    for (const t of texts) {
      expect(t).not.toContain("173");
      expect(t).not.toContain(String(LINE + RESERVE));
    }
    expect(f.regionView(NEAR).buildings).toBe("hidden");
    const c = f.countryView(ID("POL"));
    expect(c).toMatchObject({
      stability: "hidden",
      focus: false,
      advisors: false,
      all: false,
      atomic: "hidden",
    });
  });

  it("gives a hidden army no token data at all", () => {
    const g = fogGame({ armies: [army(2, "POL", FAR, { divisions: 173 })] });
    const f = newFog(g);
    expect(f.armyView(2)).toEqual({ visible: false });
    expect(f.ghosts()).toEqual([]);
    // A seen army at band 0 carries no number in the token's glyph.
    const h = fogGame({ armies: [army(2, "POL", NEAR, { divisions: 173 })] });
    const v = newFog(h).armyView(2);
    expect(v.visible && v.shown).toBe(-1);
    expect(v.visible && v.countLabel).toBe("?");
    expect(v.visible && v.bars).toBe("gray");
  });

  it("keeps a hidden army out of the layout, the fan-out and the taps", () => {
    const g = fogGame({
      armies: [
        army(1, "POL", FAR, { divisions: 5 }),
        army(2, "POL", FAR, { divisions: 6 }),
        army(9, "DEU", FAR, { divisions: 3 }),
      ],
    });
    const f = fogModelOf(g.game as never);
    expect(f.armyView(1).visible).toBe(false);
    const land = g.land;
    const cache = new TokenLayoutCache();
    cache.update(land, 700, 4);
    expect(cache.count).toBe(1);
    expect(cache.indexOf(1)).toBe(-1);
    // The visible army is not pushed off the region's centre by hidden ones.
    const c = land.scenario.centerTile(FAR);
    expect(cache.placements[0].y).toBeCloseTo(
      Math.floor(c / land.scenario.width),
    );
    const placed = layoutTokens(land, 700, 4);
    expect(placed.map((p) => p.army)).toEqual([9]);
    // A tap right on the hidden army's place finds only the visible one.
    const x = c % land.scenario.width;
    const hit = hitToken(placed, x, placed[0].y, 5, null);
    expect(hit).toBe(9);
    // When sight is gained the layout follows (stamp-driven resample).
    g.state.superiority = 700;
    g.air.version++;
    cache.update(land, 700, 4);
    expect(cache.count).toBe(3);
  });

  it("shows the true numbers at exact band", async () => {
    const { el } = await battleCard(80);
    const side = el.querySelector("[data-ww-battle-side='defender']")!;
    expect(side.textContent).toContain(`n=${LINE}`);
    expect(side.querySelector("[data-ww-battle-width]")).not.toBeNull();
  });

  it("no hud file reads enemy division counts directly", () => {
    const dir = path.join(__dirname, "../../../src/client/hud/ww1936");
    // The cards the foundation swapped to the fog model (task-1 report) must
    // reach the battle, air-zone and fleet numbers only through it.
    const raw: Record<string, RegExp> = {
      "WwBattleCard.ts":
        /\bn: (?:line|reserve)\b|b\.(?:att|def)(?:Line|Reserve)\)?\s*[^,\s]*\s*\)/,
      "WwAirZoneCard.ts": /\.sorties\b/,
      "WwFleetCard.ts": /preview_enemy",\s*\{\s*n: (?!fogModelOf)/,
    };
    for (const [file, bad] of Object.entries(raw)) {
      const src = fs.readFileSync(path.join(dir, file), "utf8");
      expect(src).toContain("fogModelOf");
      expect(bad.test(src), file).toBe(false);
    }
    // And only FogModel names the fog internals.
    for (const f of fs.readdirSync(dir)) {
      if (f === "FogModel.ts") continue;
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect(
        /\bfogPreviewValue\b|\bintelBand\b.*\.divisions/.test(src),
        f,
      ).toBe(false);
    }
    // The passes ask the fog before they make an instance.
    const passes = path.join(__dirname, "../../../src/client/render/gl/passes");
    for (const [file, call] of [
      ["ArmyTokenPass.ts", "armyView"],
      ["FleetTokenPass.ts", "fleetView"],
      ["NavalBattleMarkerPass.ts", "navalBattleVisible"],
    ]) {
      expect(fs.readFileSync(path.join(passes, file), "utf8")).toContain(call);
    }
  });
});
