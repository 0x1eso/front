// World War 1936 P2: scenario.json version 3 and its ScenarioIndex readers
// (P2 spec §3, plan decisions 5 and 28; the plan's "test map v3" table).
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { MINI } from "./util";

const DIR = path.join(__dirname, "../testdata/maps/ww1936mini");
const raw = () =>
  JSON.parse(fs.readFileSync(path.join(DIR, "scenario.json"), "utf8"));
const regionsBin = new Uint8Array(
  fs.readFileSync(path.join(DIR, "regions.bin")),
);
const index = (json: unknown) =>
  ScenarioIndex.fromFiles(ScenarioDataSchema.parse(json), regionsBin);

/** The plan's 16 edges: [a, b, border, km, river, strait]. */
const EDGES = [
  [1, 2, 40, 200, 0, 0],
  [1, 3, 35, 183, 0, 0],
  [1, 4, 15, 210, 0, 0],
  [2, 4, 20, 202, 0, 0],
  [2, 5, 30, 184, 0, 0],
  [2, 10, 0, 156, 0, 1],
  [3, 4, 50, 140, 0, 0],
  [3, 6, 35, 163, 0, 0],
  [4, 5, 50, 132, 0, 0],
  [4, 6, 15, 193, 0, 0],
  [4, 7, 20, 185, 0, 0],
  [5, 7, 30, 165, 0, 0],
  [6, 7, 30, 200, 0, 0],
  [6, 8, 50, 220, 1, 0],
  [7, 9, 50, 220, 2, 0],
  [8, 9, 80, 200, 0, 0],
];

describe("scenario version 3 (P2 spec §3)", () => {
  test("the test map is version 3 with the edge table", () => {
    const sc = index(raw());
    expect(sc.data.version).toBe(3);
    expect(
      sc.edges().map((e) => [e.a, e.b, e.border, e.km, e.river, e.strait]),
    ).toEqual(EDGES);
    expect(sc.edgesOf(4).map((e) => e.to)).toEqual([1, 2, 3, 5, 6, 7]);
    const strait = sc.edgeBetween(2, 10);
    expect(sc.edge(strait).strait).toBe(1);
    expect(sc.edgeBetween(10, 2)).toBe(strait);
    expect(sc.edgeBetween(1, 9)).toBe(-1);
    expect(sc.data.seaEdges).toEqual([[40001, 40002, 400, 0]]);
    expect(sc.data.straits).toEqual([]);
    expect(sc.maxRegionId()).toBe(10);
  });

  test("region tiles", async () => {
    const terrain = await loadTerrainMap(
      await loadMapFiles(
        new TestDataMapLoader(MINI),
        GameMapType.World1936,
        GameMapSize.Normal,
      ),
    );
    const sc = terrain.scenario!;
    expect(() => sc.regionTiles(1)).toThrow();
    sc.ensureRegionTiles(terrain.gameMap);
    expect(sc.regionTiles(1).length).toBe(2000);
    expect(sc.regionTiles(10).length).toBe(300);
    expect(sc.bbox(10)).toEqual([20, 106, 49, 115]);
    for (const r of sc.landRegions) {
      expect(sc.regionTiles(r.id).length, r.name).toBe(r.tiles);
      const tiles = sc.regionTiles(r.id);
      for (let i = 1; i < tiles.length; i++) {
        expect(tiles[i]).toBeGreaterThan(tiles[i - 1]);
      }
    }
    expect(sc.regionTiles(0).length).toBe(0);
    expect(sc.regionTiles(11).length).toBe(0);
  });

  test("v3 readers", () => {
    const sc = index(raw());
    expect(sc.landOf(5)).toBe("mountain");
    expect(sc.landOf(4)).toBe("forest");
    expect(sc.startRail(7)).toBe(0);
    expect(sc.startRail(3)).toBe(3);
    expect(sc.startFort(1)).toBe(2);
    expect(sc.isPort(2)).toBe(true);
    expect(sc.isPort(10)).toBe(true);
    expect(sc.isPort(5)).toBe(false);
    expect(sc.latC(2)).toBe(4480);
    expect(sc.wcell(5)).toBe(379);
    expect(sc.centerTile(1)).toBe(25 * 200 + 20);
    expect(sc.devOf("POL", 4)).toBe(1);
    expect(sc.devOf("DEU", 0)).toBe(5);
    expect(sc.data.historicalOob).toBeUndefined();
    // kmPerTile 4: the straight-line km agree with the edges' km.
    expect(sc.regionKm(3, 6)).toBe(163);
    expect(sc.regionKm(2, 10)).toBe(156);
  });

  test("a version 2 file falls back (decision 5)", () => {
    const json = raw();
    json.version = 2;
    for (const k of ["edges", "seaEdges", "straits", "kmPerTile"]) {
      delete json[k];
    }
    for (const c of json.countries) delete c.dev;
    for (const r of json.regions) {
      for (const k of [
        "land",
        "center",
        "latC",
        "wcell",
        "rail",
        "fort",
        "port",
      ]) {
        delete r[k];
      }
    }
    const sc = index(json);
    // The tile neighbours, without the strait to London.
    expect(sc.edges()).toHaveLength(15);
    expect(sc.edgeBetween(2, 10)).toBe(-1);
    expect(sc.edges().every((e) => e.river === 0 && e.strait === 0)).toBe(true);
    expect(sc.edge(sc.edgeBetween(3, 6)).border).toBe(35);
    expect(sc.landOf(5)).toBe("plains");
    // France is a major and Paris a core region with infrastructure 4.
    expect(sc.startRail(1)).toBe(3);
    expect(sc.startFort(1)).toBe(0);
    // Rome: on the coast with a dockyard.
    expect(sc.isPort(5)).toBe(true);
    expect(sc.devOf("POL", 4)).toBe(3);
    expect(sc.devOf("POL", 1)).toBe(2);
    expect(sc.devOf("POL", 0)).toBe(1);
  });
});
