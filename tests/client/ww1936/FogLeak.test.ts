// World War 1936 P6 (spec §8.9, §25.3): the fog must not leak. A hidden
// enemy's numbers never reach a card's text, a tooltip or a token's data,
// and no card reads the enemy's counts without the fog model.
import { renderTroops } from "@openfront/engine-lib/Format";
import { EventBus } from "@openfront/shared/EventBus";
import fs from "fs";
import path from "path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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
  ID_AIR,
  ID_ARMY,
  ID_NAVY,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { render } from "lit";
import "../../../src/client/hud/layers/PlayerInfoOverlay";
import type { PlayerInfoOverlay } from "../../../src/client/hud/layers/PlayerInfoOverlay";
import "../../../src/client/hud/layers/PlayerPanel";
import type { PlayerPanel } from "../../../src/client/hud/layers/PlayerPanel";
import "../../../src/client/hud/layers/PlayerStats";
import type { PlayerStats } from "../../../src/client/hud/layers/PlayerStats";
import { occRegionLine } from "../../../src/client/hud/ww1936/EndgameModel";
import { fogModelOf } from "../../../src/client/hud/ww1936/FogModel";
import { attackPreview } from "../../../src/client/hud/ww1936/LandModel";
import {
  landSelectionOf,
  OpenWwBattleEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import {
  playerActions,
  politicsInput,
} from "../../../src/client/hud/ww1936/PoliticsModel";
import { WwFleetSelectedEvent } from "../../../src/client/hud/ww1936/SeaAirSelection";
import { today } from "../../../src/client/hud/ww1936/WorldWarModel";
import "../../../src/client/hud/ww1936/WwArmyCard";
import type { WwArmyCard } from "../../../src/client/hud/ww1936/WwArmyCard";
import "../../../src/client/hud/ww1936/WwBattleCard";
import type { WwBattleCard } from "../../../src/client/hud/ww1936/WwBattleCard";
import "../../../src/client/hud/ww1936/WwFleetCard";
import type { WwFleetCard } from "../../../src/client/hud/ww1936/WwFleetCard";
import { WwSeaAirController } from "../../../src/client/hud/ww1936/WwSeaAirController";
import { takeoverCardModel } from "../../../src/client/hud/ww1936/WwTakeoverCard";
import { AirSortiePass } from "../../../src/client/render/gl/passes/AirSortiePass";
import { ShipSpriteProgram } from "../../../src/client/render/gl/passes/FleetTokenPass";
import { preloadAtlasData } from "../../../src/client/render/gl/passes/name-pass/AtlasData";
import { NamePass } from "../../../src/client/render/gl/passes/name-pass/index";
import { LINES_PER_PLAYER } from "../../../src/client/render/gl/passes/name-pass/Types";
import { createRenderSettings } from "../../../src/client/render/gl/RenderSettings";
import {
  hitToken,
  layoutTokens,
  TokenLayoutCache,
} from "../../../src/client/view/LandTokenLayout";
import { WwDepthView } from "../../../src/client/view/WwDepthView";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { REGION, SR, ZONE } from "../../ww1936/seaFixture";
import { detail, region, tileOf } from "./EconomyFixture";
import { occ } from "./EndgameFixture";
import { FAR, fogGame, NEAR, newFog } from "./FogFixture";
import {
  army,
  battle,
  division,
  ID,
  landDetail,
  landRegion,
} from "./LandFixture";
import { fleet, sea, seaGame, ship, SID } from "./SeaAirFixture";

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

/** A WebGL2 stand-in: enums read 0, every call returns a truthy object. */
function fakeGL(): WebGL2RenderingContext {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop === "getParameter") return () => 256;
        if (/^[A-Z0-9_]+$/.test(prop)) return 0;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
}

/**
 * Final review C (I1): the map's name plates for Germany (me) and Poland,
 * each with `men` troops, through the name pass's real updateNames. The
 * troop rows it uploads, by country tag.
 */
function namePlateRows(
  fog: Parameters<NamePass["setTroopFog"]>[0] | "unset",
  men: number,
): Record<string, string> {
  const tags = ["DEU", "POL"] as const;
  const players = tags.map((tag) => ({
    smallID: ID(tag),
    id: `P${ID(tag)}`,
    name: tag,
    displayName: tag,
    clanTag: null,
    clientID: null,
    playerType: 0,
    team: null,
    isLobbyCreator: false,
  }));
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (() => ({})) as never;
  const pass = new NamePass(
    fakeGL(),
    { mapWidth: 100, mapHeight: 100, unitTypes: [], players } as never,
    new Float32Array(64 * 4),
    createRenderSettings(),
    { allianceExtensionPromptOffset: () => 0 } as never,
  );
  HTMLCanvasElement.prototype.getContext = getContext;
  if (fog !== "unset") pass.setTroopFog(fog);
  const upload = vi.spyOn(
    NamePass.prototype as unknown as {
      uploadStringRow(row: number, text: string): number;
    },
    "uploadStringRow",
  );
  const names = new Map(
    players.map((p) => [p.id, { playerID: p.id, x: 10, y: 10, size: 4 }]),
  );
  const states = new Map(
    players.map((p) => [
      p.smallID,
      { smallID: p.smallID, isAlive: true, troops: men, outgoingEmojis: [] },
    ]),
  );
  pass.updateNames(names, states as never, true);
  const rows: Record<string, string> = {};
  // Slot i's first row is its name, the next its troops.
  for (const [row, text] of upload.mock.calls) {
    if (row % LINES_PER_PLAYER === 1) {
      rows[tags[Math.floor(row / LINES_PER_PLAYER)]] = text;
    }
  }
  upload.mockRestore();
  return rows;
}

describe("fog leaks (spec §8.9)", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () =>
        JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../../../resources/atlases/msdf-atlas.json"),
            "utf8",
          ),
        ),
    }));
    await preloadAtlasData();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("final review C (I1): the name plates show another country's men through the fog", () => {
    const MEN = 4_870_000;
    const exact = renderTroops(MEN);
    // Other modes (no fog): every plate shows the exact troops.
    expect(namePlateRows("unset", MEN)).toEqual({ DEU: exact, POL: exact });
    // The mode, as the renderer wires it: Poland's men at Germany's army band.
    const g = fogGame({ level: 0 });
    const f = fogModelOf(g.game as never);
    const at0 = namePlateRows(() => f, MEN);
    expect(at0.DEU).toBe(exact);
    expect(at0.POL).toBe("?");
    g.setLevels([0, 20, 0, 0]);
    const rough = namePlateRows(() => f, MEN);
    expect(rough.POL).toContain("~");
    expect(rough.POL).not.toContain(exact);
    g.setLevels([0, 80, 0, 0]);
    expect(namePlateRows(() => f, MEN).POL).toBe(exact);
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

  it("final review C (I2): the leaderboard and the player panel keep another country's men fogged", () => {
    const g = fogGame({ level: 0 });
    // The leaderboard: the troop columns (maxtroops is a default) are gone
    // in the mode, and stay in the user's choice for other games.
    const columns = (game: unknown) => {
      const t = document.createElement("player-stats") as PlayerStats;
      t.game = game as never;
      return (t as unknown as { visibleColumns(): readonly { id: string }[] })
        .visibleColumns()
        .map((c) => c.id);
    };
    const ww = columns(g.game);
    expect(ww).not.toContain("maxtroops");
    expect(ww).not.toContain("troops");
    expect(ww).toContain("tiles");
    expect(columns({ ...g.game, worldWarScenario: () => null })).toContain(
      "maxtroops",
    );
    // The player panel's chips: no gold in the mode, Poland's men at my
    // army band, mine exact.
    const panel = document.createElement("player-panel") as PlayerPanel;
    panel.g = g.game as never;
    const chips = (tag: "DEU" | "POL") => {
      const box = document.createElement("div");
      render(
        (
          panel as unknown as { renderResources(p: unknown): unknown }
        ).renderResources(g.game.playerBySmallID(ID(tag))) as never,
        box,
      );
      return box;
    };
    const exact = renderTroops(480_000);
    const pol = chips("POL");
    expect(pol.textContent).not.toContain(exact);
    expect(pol.querySelector("[data-player-troops]")!.textContent).toContain(
      "?",
    );
    expect(pol.textContent).not.toContain("[player_panel.gold]");
    expect(chips("DEU").textContent).toContain(exact);
    g.setLevels([0, 80, 0, 0]);
    expect(chips("POL").textContent).toContain(exact);
  });

  it("final review C (I4): the player panel's politics line follows the civil band", () => {
    const g = fogGame({ level: 0 });
    const deu = g.pol.summary(ID("DEU"))!;
    g.pol.apply(
      {
        countries: [
          {
            ...deu,
            smallID: ID("POL"),
            faction: -1,
            stabBp: 6_100,
            wsBp: 3_300,
          },
        ],
        details: [],
        global: null,
        regions: [],
        news: [],
        cards: [],
      } as never,
      700,
    );
    const f = fogModelOf(g.game as never);
    const i = politicsInput(g.game as never)!;
    const info = () => playerActions(i, ID("POL"), undefined, f).info!;
    // Unknown: the government and the leader only.
    expect(info()).toMatch(/^\[ww1936\.diplo\.info_basic\] /);
    for (const n of ["61", "33", "stab", "ws="])
      expect(info()).not.toContain(n);
    // Rough: ranges, never the numbers.
    g.setLevels([20, 0, 0, 0]);
    expect(info()).toContain("[ww1936.diplo.info]");
    expect(info()).toMatch(/stab=\d+~\d+,ws=\d+~\d+/);
    expect(info()).not.toContain("stab=61");
    // Exact civil intel: the numbers.
    g.setLevels([80, 0, 0, 0]);
    expect(info()).toContain("stab=61,ws=33");
    // My own line is always exact.
    expect(playerActions(i, ID("DEU"), undefined, f).info).toContain("stab=50");
    // The player panel draws the line through my fog.
    g.setLevels([0, 0, 0, 0]);
    const panel = document.createElement("player-panel") as PlayerPanel;
    panel.g = g.game as never;
    panel.eventBus = new EventBus();
    const box = document.createElement("div");
    render(
      (
        panel as unknown as { renderWwActions(p: unknown): unknown }
      ).renderWwActions(g.game.playerBySmallID(ID("POL"))) as never,
      box,
    );
    const line = box.querySelector("[data-ww-info]")!.textContent!;
    expect(line).toContain("[ww1936.diplo.info_basic]");
    expect(line).not.toContain("61");
  });

  it("final review C (I5): an enemy carrier's sorties never start from a fleet the fog hides", () => {
    // Germany's carrier fleet in the western zone; I am Britain, with rough
    // air intel on Germany (its planes show as a band) and no sighting.
    const s = seaGame({
      me: "GBR",
      fleets: [
        fleet({
          id: 7,
          owner: SID("DEU"),
          zone: ZONE.west,
          ships: [ship(77, "cv")],
        }),
      ],
    });
    const depth = new WwDepthView();
    const row = new Array<number>((sea.countries.length + 1) * 4).fill(0);
    row[SID("DEU") * 4 + ID_AIR] = 20;
    depth.apply({ intel: [{ observer: SID("GBR"), row }], fx: [], news: [] });
    const game = {
      ...s.game,
      wwDepth: () => depth,
      isSpectator: () => false,
      gameOver: () => false,
    };
    const f = fogModelOf(game as never);
    expect(f.fleetView(7).visible).toBe(false);
    const day = () => ({
      zones: [
        {
          sr: SR.approaches,
          sides: [
            {
              side: SID("DEU"),
              supPm: 700,
              sorties: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          ],
          result: [],
        },
      ],
      deployments: [
        {
          id: 1,
          owner: SID("DEU"),
          sr: SR.approaches,
          type: "fighter" as const,
          mission: "air_superiority" as const,
          counts: [60],
          target: 60,
          // Flies from the carrier, ship 77.
          base: -77,
        },
      ],
      removedDeployments: [],
      details: [],
    });
    const gl = fakeGL();
    const fly = () => {
      const pass = new AirSortiePass(gl, {}, new ShipSpriteProgram(gl, {}, {}));
      s.air.apply(day());
      pass.update(s.air, s.navy, 0, 4);
      s.air.apply(day());
      pass.update(s.air, s.navy, 0, 4);
      return pass.airborneCount;
    };
    expect(fly()).toBe(0);
    // The same sorties with the fog off (a spectator): from the carrier.
    f.forceOff(true);
    expect(fly()).toBeGreaterThan(0);
  });

  it("final review C (I6): the fleet mission preview shows its odds only at the exact navy band", async () => {
    const preview = async (level: number) => {
      // My (British) fleet in London; a spotted Italian fleet in the Middle
      // Sea, at war.
      const g = seaGame({
        fleets: [
          fleet({
            id: 7,
            zone: ZONE.west,
            docked: REGION.london,
            state: "docked",
            ships: [ship(1, "bb"), ship(2, "dd")],
          }),
          fleet({
            id: 9,
            owner: SID("ITA"),
            zone: ZONE.middle,
            counts: [2, 0, 0, 0, 1, 0, 0],
            ships: [],
            flags: 1 << 2, // FLEET_FLAG_SPOTTED
          }),
        ],
        wars: [["GBR", "ITA"]],
      });
      const depth = new WwDepthView();
      const row = new Array<number>((sea.countries.length + 1) * 4).fill(0);
      row[SID("ITA") * 4 + ID_NAVY] = level;
      depth.apply({ intel: [{ observer: SID("GBR"), row }], fx: [], news: [] });
      const game = {
        ...g.game,
        wwDepth: () => depth,
        isSpectator: () => false,
        gameOver: () => false,
      };
      const bus = new EventBus();
      let now = 10_000;
      const controller = new WwSeaAirController(game as never, bus, () => 4, {
        layout: () => [],
        hit: () => 0,
        now: () => now,
      });
      controller.init();
      const el = document.createElement("ww-fleet-card") as WwFleetCard;
      el.game = game as never;
      el.eventBus = bus;
      document.body.appendChild(el);
      el.init();
      bus.emit(new WwFleetSelectedEvent(7));
      const step = async () => {
        el.tick();
        await el.updateComplete;
      };
      await step();
      for (const sel of [
        "[data-ww-fleet-btn='mission']",
        "[data-ww-fleet-btn='mission_patrol']",
        "[data-ww-card-fold='open']",
      ]) {
        el.querySelector<HTMLElement>(sel)!.click();
        await step();
      }
      // The Middle Sea's centre: Central Waters' preview.
      now += 1000;
      controller.handleTap(85, 110);
      await step();
      const odds = el.querySelector("[data-ww-preview-odds]");
      el.remove();
      return odds;
    };
    // Band 0: the ratio (my power / theirs) would give their true ships.
    const hidden = (await preview(0))!;
    expect(hidden.getAttribute("data-ww-preview-odds")).toBe("?");
    expect(hidden.textContent).toContain("ratio=?");
    expect((await preview(50))!.textContent).toContain("ratio=?");
    // Exact navy intel: the true odds.
    expect((await preview(80))!.textContent).toMatch(/ratio=\d+\.\d\d/);
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

  it("T1b: the army card's attack preview counts the defenders through the fog", async () => {
    const at = async (level: number) => {
      const g = fogGame({
        level,
        details: [detail("DEU")],
        armies: [
          army(1, "DEU", 4, { divisions: 3 }),
          army(2, "POL", NEAR, { divisions: 173 }),
        ],
        landDetails: [
          landDetail("DEU", {
            divisions: [
              division(1, 1, 4),
              division(2, 1, 4),
              division(3, 1, 4),
            ],
          }),
        ],
      });
      const el = document.createElement("ww-army-card") as WwArmyCard;
      el.game = g.game as never;
      el.eventBus = new EventBus();
      document.body.appendChild(el);
      el.init();
      const sel = landSelectionOf(g.game as never);
      sel.select(1);
      sel.pending = NEAR;
      sel.version++;
      el.tick();
      await el.updateComplete;
      const ratio = el
        .querySelector("[data-ww-preview='attack'] [data-ww-ratio]")!
        .getAttribute("data-ww-ratio");
      const f = fogModelOf(g.game as never);
      const view = g.land;
      const economy = g.game.wwEconomy();
      const day = today(g.game as never);
      const exact = attackPreview(view, economy, ID("DEU"), 1, NEAR, day)!;
      const fogged = attackPreview(
        view,
        economy,
        ID("DEU"),
        1,
        NEAR,
        day,
        undefined,
        (n, o) => f.previewEnemyValue(n, o),
      )!;
      el.remove();
      return { ratio: Number(ratio), exact, fogged };
    };
    // Band 0: the card's ratio is the fogged one (512 stand-in divisions), not the truth.
    const hidden = await at(0);
    expect(hidden.fogged.ratioPm).toBeLessThan(hidden.exact.ratioPm);
    expect(hidden.ratio).not.toBe(hidden.exact.ratioPm);
    // Exact band: the true ratio.
    const known = await at(80);
    expect(known.fogged.ratioPm).toBe(known.exact.ratioPm);
    expect(known.ratio).toBe(known.exact.ratioPm);
  });

  it("T1b: the region card, the troop bar, the occupation line and the takeover card", () => {
    const g = fogGame({
      level: 0,
      regions: [region(NEAR, { civ: 137, mil: 241, dock: 0, fort: 3 })],
      landRegions: [FAR, NEAR, 7].map((id) =>
        landRegion(id, {
          controller: ID("POL"),
          counts: id === NEAR ? [[ID("POL"), 173]] : [],
        }),
      ),
    });
    const overlay = document.createElement(
      "player-info-overlay",
    ) as PlayerInfoOverlay;
    overlay.game = g.game as never;
    overlay.eventBus = new EventBus();
    const o = overlay as unknown as {
      renderRegionLand(t: number): unknown;
      renderRegionEconomy(t: number): unknown;
      wwTroopLabels(p: unknown, total: number, max: number): unknown;
    };
    const box = document.createElement("div");
    render(o.renderRegionLand(tileOf(NEAR)), box);
    expect(box.querySelector("[data-ww-region-divisions]")!.textContent).toBe(
      "[ww1936.land.region_divisions] ours=0,theirs=?",
    );
    expect(box.innerHTML).not.toContain("173");
    expect(box.innerHTML).not.toContain("■■■");
    const econ = document.createElement("div");
    render(o.renderRegionEconomy(tileOf(NEAR)), econ);
    for (const n of ["137", "241"]) expect(econ.innerHTML).not.toContain(n);
    expect(econ.textContent).toContain("civ=?,mil=?,dock=?");
    // The troop bar: Poland's men are hidden, mine are not.
    const pol = g.game.playerBySmallID(ID("POL"));
    expect(o.wwTroopLabels(pol, 480_000, 900_000)).toEqual(["?", "?"]);
    expect(
      o.wwTroopLabels(g.game.playerBySmallID(ID("DEU")), 480_000, 900_000),
    ).toBeNull();
    g.setLevels([0, 20, 0, 0]);
    const rough = o.wwTroopLabels(pol, 480_000, 900_000) as string[];
    expect(rough[0]).toContain("~");
    expect(rough[0]).not.toContain("480");
    // The occupation line: Poland's garrison in my Munich, at Poland's army band.
    g.setLevels([0, 0, 0, 0]);
    const eg = new WwEndgameView();
    eg.apply({
      news: [],
      occupation: [
        occ(4, "POL", { supDeci: 1_370, needDeci: 2_410, resBp: 4_400 }),
      ],
    });
    g.land.controller[4] = ID("POL");
    const game = { ...g.game, wwEndgame: () => eg };
    const f = fogModelOf(g.game as never);
    const line = occRegionLine(game as never, 4, f)!;
    expect(line).toContain("have=?");
    expect(line).toContain("pct=?");
    expect(line).toContain("res=44");
    expect(line).not.toContain("137");
    // Exact without the fog (the occupation tab's own rows).
    expect(occRegionLine(game as never, 4)!).toContain("have=137.0");
    // The takeover card: a candidate's divisions at its army band (a
    // country of my faction would be exact).
    const tk = new WwEndgameView();
    tk.apply({
      news: [],
      takeover: [
        {
          client: "c1",
          from: ID("DEU"),
          candidates: [ID("POL")],
          deadlineTick: 900,
        },
      ],
    });
    const tg = {
      ...g.game,
      myClientID: () => "c1",
      wwEndgame: () => tk,
      wwLand: () => ({ countries: new Map([[ID("POL"), { divisions: 41 }]]) }),
    };
    const rows = (lv: number) => {
      g.setLevels([0, lv, 0, 0]);
      return takeoverCardModel(tg as never, f)!.rows[0].line;
    };
    expect(rows(0)).toContain("divisions=?");
    expect(rows(0)).not.toContain("41");
    expect(rows(80)).toContain("divisions=41");
    expect(f.countLabel(ID("POL"), 41, ID_ARMY)).toBe("41");
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
    // Final review C (M7): the hover card, the player panel, the
    // leaderboard's columns and the rest of the HUD layers show every
    // country too.
    walk(path.join(root, "hud/layers"));
    for (const f of ["FleetTokenLayout.ts", "LandTokenLayout.ts"]) {
      files.push(path.join(root, "view", f));
    }
    // Final review C (M7): another country's men (troops) and ship counts,
    // and its stability and war support, are fogged numbers too.
    const reads =
      /\.divisions\b|\b(?:att|def)(?:Line|Reserve)\b|\.armies\b|\.fleets\b|\.deployments\b|\.sorties\b|\.troops\b|\btroops\(\)|\.counts\b|\bstabBp\b|\bwsBp\b/;
    // Files that read other owners' data must ask the fog (and which
    // calls: each one must be there).
    const MUST_FOG: Record<string, string | string[]> = {
      "hud/ww1936/FogModel.ts": "armyView",
      "hud/ww1936/WwBattleCard.ts": "bandOf",
      // Final review C (I6): the enemy's power and the odds.
      "hud/ww1936/WwFleetCard.ts": ["previewEnemyValue", "oddsHidden"],
      // The mission preview's odds below the exact navy band.
      "hud/ww1936/NavyModel.ts": ["oddsHidden", "ID_NAVY"],
      "render/gl/passes/ArmyTokenPass.ts": "armyView",
      "render/gl/passes/FleetTokenPass.ts": "fleetView",
      // Final review C (I5): a carrier launches from a fleet the fog shows.
      "render/gl/passes/AirSortiePass.ts": ["planesSeen", "fleetView"],
      // U4's nuke preview counts the enemy divisions in the struck region.
      "hud/ww1936/DepthIndustryModel.ts": "armyView",
      "render/gl/LandFrame.ts": "armyView",
      "view/FleetTokenLayout.ts": "fleetView",
      "view/LandTokenLayout.ts": "armyView",
      // T1b (pre-flight A18): the P5 swaps and the P5 screens' review.
      // The army card's attack preview (the defenders' count).
      "hud/ww1936/WwArmyCard.ts": "previewEnemyValue",
      // The region card (buildings, divisions, fleets in port), the
      // troop bar and the occupation line's garrison.
      "hud/layers/PlayerInfoOverlay.ts": ["countLabel", "troopsLabel"],
      // The occupation line's garrison of another side.
      "hud/ww1936/EndgameModel.ts": "countLabel",
      // A candidate country's divisions.
      "hud/ww1936/WwTakeoverCard.ts": "countLabel",
      // Final review C (I1): the map's name plates (another country's men).
      "render/gl/passes/name-pass/index.ts": "troopsLabel",
      // Final review C (I2, I4): the player panel's men and politics line.
      "hud/layers/PlayerPanel.ts": "troopsLabel",
      "hud/ww1936/PoliticsModel.ts": "countryView",
    };
    // Files that read only my own side's data, or draw no counts.
    const ALLOWED = new Set([
      "hud/ww1936/AirModel.ts",
      "hud/ww1936/IntelModel.ts",
      "hud/ww1936/LandModel.ts",
      "hud/ww1936/LandSeaAir.ts",
      "hud/ww1936/WwAirPanel.ts",
      "hud/ww1936/WwArmyPanel.ts",
      "hud/ww1936/WwLandController.ts",
      "hud/ww1936/WwNavyPanel.ts",
      "hud/ww1936/WwSeaAirController.ts",
      // T1b review: my divisions, my groups and the armies I picked.
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
      // T1b review: my volunteers, the volunteers serving in my country
      // (my side in its battles) and what is shipped to me.
      "hud/ww1936/WwAidTab.ts",
      // Final review C (M7): my own army's men (armyMenOf on me) and my
      // own war support.
      "hud/ww1936/EconomyModel.ts",
      "hud/ww1936/WwIndustryPanel.ts",
      // Vanilla HUD: my own troops, and the vanilla attacks, boats and
      // donations, which the mode refuses (no attack, boat or troop
      // donation in World War 1936).
      "hud/layers/AlertFrame.ts",
      "hud/layers/AttacksDisplay.ts",
      "hud/layers/ChatModal.ts",
      "hud/layers/ControlPanel.ts",
      "hud/layers/EventsDisplay.ts",
      "hud/layers/PlayerActionHandler.ts",
      "hud/layers/RadialMenuElements.ts",
      "hud/layers/SendResourceModal.ts",
      "hud/layers/UnitDisplay.ts",
    ]);
    // Files that read other countries' numbers the spec makes public
    // (spec §8.9: conferences are public). T1b review: the conference
    // prices a fleet share from the loser's ship classes, as the engine
    // does, and shows only conference points and percentages.
    const PUBLIC = new Set(["hud/ww1936/PeaceModel.ts"]);
    // Files that show a fogged number only outside the mode, with the gate
    // that drops it in the mode (final review C I2: the leaderboard's
    // troop columns).
    const MODE_GATED: Record<string, string> = {
      "hud/layers/lib/StatsColumns.ts": "worldWarHidden: true",
    };
    const rel = (f: string) => path.relative(root, f).split(path.sep).join("/");
    for (const f of files) {
      const r = rel(f);
      const src = fs.readFileSync(f, "utf8");
      if (!reads.test(src)) continue;
      if (r in MUST_FOG) {
        for (const call of [MUST_FOG[r]].flat()) {
          expect(src, `${r} must ask the fog (${call})`).toContain(call);
        }
        expect(src, `${r} must import the fog`).toMatch(
          /FogModel|fogOf|fogModelOf/,
        );
      } else if (r in MODE_GATED) {
        expect(src, `${r} must gate the mode`).toContain(MODE_GATED[r]);
      } else {
        expect(
          ALLOWED.has(r) || PUBLIC.has(r),
          `${r} reads enemy data: filter it or allow-list it`,
        ).toBe(true);
      }
    }
    // Final review C (I2): every leaderboard column whose number is a
    // country's men is dropped in the mode.
    const columns = fs
      .readFileSync(path.join(root, "hud/layers/lib/StatsColumns.ts"), "utf8")
      .split("defineColumn({")
      .slice(1);
    const troopColumns = columns.filter((c) =>
      /troops\(\)|maxTroops\(/.test(c.slice(0, c.indexOf("cell:"))),
    );
    expect(troopColumns.length).toBeGreaterThanOrEqual(2);
    for (const c of troopColumns) {
      expect(c, "a troop column shows in the mode").toContain(
        "worldWarHidden: true",
      );
    }
    // No stale entries: every listed file exists.
    for (const r of [
      ...ALLOWED,
      ...PUBLIC,
      ...Object.keys(MUST_FOG),
      ...Object.keys(MODE_GATED),
    ]) {
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
