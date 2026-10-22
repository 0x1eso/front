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
    // The whole card, text and markup (bar widths are in style attributes).
    for (const n of [LINE, RESERVE, WIDTH, "77.7", "64.1", "width: 80%"]) {
      expect(side.innerHTML).not.toContain(String(n));
    }
    expect(side.innerHTML).toContain("bg-gray-500");
    expect(el.querySelectorAll("[data-ww-mods='defender'] li")).toHaveLength(0);
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

  it("draws the enemy bars in five steps at the close band", async () => {
    const { el } = await battleCard(50);
    const html = el.querySelector(
      "[data-ww-battle-side='defender']",
    )!.innerHTML;
    expect(html).toContain("width: 80%");
    expect(html).not.toContain("77.7");
    expect(html).not.toContain("64.1");
    expect(
      el.querySelector(
        "[data-ww-battle-side='defender'] [data-ww-battle-width]",
      ),
    ).toBeNull();
  });

  it("shows the true numbers at exact band", async () => {
    const { el } = await battleCard(80);
    const side = el.querySelector("[data-ww-battle-side='defender']")!;
    expect(side.textContent).toContain(`n=${LINE}`);
    expect(side.querySelector("[data-ww-battle-width]")).not.toBeNull();
  });

  it("no hud or render file reads enemy army, fleet or air data without the fog", () => {
    const root = path.join(__dirname, "../../../src/client");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".ts")) files.push(full);
      }
    };
    walk(path.join(root, "hud/ww1936"));
    walk(path.join(root, "render"));
    for (const f of ["FleetTokenLayout.ts", "LandTokenLayout.ts"]) {
      files.push(path.join(root, "view", f));
    }
    const reads =
      /\.divisions\b|\b(?:att|def)(?:Line|Reserve)\b|\.armies\b|\.fleets\b|\.deployments\b|\.sorties\b/;
    // Files that read other owners' data must ask the fog (and which call).
    const MUST_FOG: Record<string, string> = {
      "hud/ww1936/FogModel.ts": "armyView",
      "hud/ww1936/WwBattleCard.ts": "bandOf",
      "hud/ww1936/WwFleetCard.ts": "previewEnemyValue",
      "render/gl/passes/ArmyTokenPass.ts": "armyView",
      "render/gl/passes/FleetTokenPass.ts": "fleetView",
      "render/gl/passes/AirSortiePass.ts": "planesSeen",
      // U4's nuke preview counts the enemy divisions in the struck region.
      "hud/ww1936/DepthIndustryModel.ts": "armyView",
      "render/gl/LandFrame.ts": "armyView",
      "view/FleetTokenLayout.ts": "fleetView",
      "view/LandTokenLayout.ts": "armyView",
    };
    // Files that read only my own side's data, or are the T1b swap list
    // (WwArmyCard, WwTopBand: pre-flight A18), or draw no counts.
    const ALLOWED = new Set([
      "hud/ww1936/AirModel.ts",
      "hud/ww1936/IntelModel.ts",
      "hud/ww1936/LandModel.ts",
      "hud/ww1936/LandSeaAir.ts",
      "hud/ww1936/NavyModel.ts",
      "hud/ww1936/WwAirPanel.ts",
      "hud/ww1936/WwArmyCard.ts",
      "hud/ww1936/WwArmyPanel.ts",
      "hud/ww1936/WwLandController.ts",
      "hud/ww1936/WwNavyPanel.ts",
      "hud/ww1936/WwSeaAirController.ts",
      "hud/ww1936/WwTopBand.ts",
      "render/gl/Renderer.ts",
      "render/gl/passes/PlanArrowPass.ts",
      "render/gl/passes/RegionBorderPass.ts",
      // P6 U1/U4/U5 (batch P6-2): my own armies, groups, deployments,
      // divisions and fleets only.
      "hud/ww1936/DoctrineModel.ts",
      "hud/ww1936/MultiSelect.ts",
      "hud/ww1936/WwArmyGroupTab.ts",
      "hud/ww1936/WwAirZoneCard.ts",
      "hud/ww1936/WwNukeFlow.ts",
      "hud/ww1936/DepthMiscModel.ts",
      // P5's screens (merged before this scan): aid and takeover cards and
      // the conference read country totals and fleet classes by design;
      // their fog review goes with T1b's P5 swaps (pre-flight A18).
      "hud/ww1936/EndgameModel.ts",
      "hud/ww1936/PeaceModel.ts",
      "hud/ww1936/WwAidTab.ts",
      "hud/ww1936/WwTakeoverCard.ts",
    ]);
    const rel = (f: string) => path.relative(root, f).split(path.sep).join("/");
    for (const f of files) {
      const r = rel(f);
      const src = fs.readFileSync(f, "utf8");
      if (!reads.test(src)) continue;
      if (r in MUST_FOG) {
        expect(src, `${r} must ask the fog`).toContain(MUST_FOG[r]);
        expect(src, `${r} must import the fog`).toMatch(
          /FogModel|fogOf|fogModelOf/,
        );
      } else {
        expect(
          ALLOWED.has(r),
          `${r} reads enemy data: filter it or allow-list it`,
        ).toBe(true);
      }
    }
    // No stale entries: every listed file exists.
    for (const r of [...ALLOWED, ...Object.keys(MUST_FOG)]) {
      expect(fs.existsSync(path.join(root, r)), r).toBe(true);
    }
  });

  it("fogs the fleet layout, the air deployments and the paradrop flights", () => {
    const g = fogGame({ armies: [army(1, "POL", FAR, { divisions: 4 })] });
    const f = fogModelOf(g.game as never);
    // Air: band 0 sees no planes, a rough band a coarse top, exact the truth.
    expect(f.planesSeen(ID("POL"), 40)).toBe(0);
    g.setLevels([0, 0, 0, 20]);
    expect(f.planesSeen(ID("POL"), 40)).toBeGreaterThan(40);
    expect(f.planesSeen(ID("POL"), 40)).not.toBe(40);
    g.setLevels([0, 0, 0, 80]);
    expect(f.planesSeen(ID("POL"), 40)).toBe(40);
    // A land battle between two others, out of sight, has no marker.
    expect(f.landBattleVisible(FAR, ID("POL"), ID("FRA"))).toBe(false);
    expect(f.landBattleVisible(FAR, ID("DEU"), ID("POL"))).toBe(true);
  });
});
