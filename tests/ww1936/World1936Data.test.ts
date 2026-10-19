import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  COUNTRY_TAGS,
  CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  loadTerrainMap,
  TerrainMapData,
} from "@openfront/engine-lib/game/TerrainMapLoader";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";

const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../resources/maps",
  ),
);

// Miller cylindrical, -60..84 degrees, as cmd/ww1936build draws it.
const W = 4000;
const millerY = (lat: number) =>
  1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * ((lat * Math.PI) / 180)));
const SCALE = W / (2 * Math.PI);
const TOP = millerY(84);

let data: TerrainMapData;
beforeAll(async () => {
  data = await loadTerrainMap(
    await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
  );
}, 60_000);

/** The owner tag at a lon/lat (the nearest land within 3 tiles). */
function ownerAt(lon: number, lat: number): CountryTag | undefined {
  const s = data.scenario!;
  const map = data.gameMap;
  const x0 = Math.floor(((lon + 180) / 360) * W);
  const y0 = Math.floor((TOP - millerY(lat)) * SCALE);
  for (let d = 0; d <= 3; d++) {
    for (let y = y0 - d; y <= y0 + d; y++) {
      for (let x = x0 - d; x <= x0 + d; x++) {
        if (Math.max(Math.abs(x - x0), Math.abs(y - y0)) !== d) continue;
        const t = map.ref(x, y);
        if (map.isLand(t)) return s.region(s.regionAt(t))?.owner;
      }
    }
  }
  return undefined;
}

describe("the world1936 map", () => {
  test("every 1936 country, about 1,200 regions and 150 sea zones", () => {
    const s = data.scenario!;
    expect([...s.countries]).toEqual([...COUNTRY_TAGS]);
    expect(s.landRegions.length).toBeGreaterThanOrEqual(1000);
    expect(s.landRegions.length).toBeLessThanOrEqual(1800);
    expect(s.data.seaZones.length).toBeGreaterThanOrEqual(120);
    expect(s.data.seaZones.length).toBeLessThanOrEqual(300);
    const owners = new Set(s.landRegions.map((r) => r.owner));
    expect(COUNTRY_TAGS.filter((t) => !owners.has(t))).toEqual([]);
  });

  test("every land tile has a land region and every water tile a sea zone", () => {
    const s = data.scenario!;
    const map = data.gameMap;
    let bad = 0;
    map.forEachTile((t) => {
      const id = s.regionAt(t);
      if (map.isLand(t) && !map.isImpassable(t)) {
        if (s.region(id) === undefined) bad++;
      } else if (
        !map.isLand(t) &&
        (id <= SEA_ZONE_BASE || s.seaZone(id) === undefined)
      ) {
        bad++;
      }
    });
    expect(bad).toBe(0);
  });

  test("capitals and VP tiles sit on their own land", () => {
    const s = data.scenario!;
    for (const tag of s.countries) {
      expect(s.region(s.regionAt(s.capitalTile(tag)))?.owner, tag).toBe(tag);
    }
    for (const r of s.landRegions) {
      expect(s.regionAt(s.vpTile(r)), r.name).toBe(r.id);
    }
  });

  test.each([
    ["Berlin", 13.4, 52.52, "DEU"],
    ["Danzig", 18.65, 54.35, "DZG"],
    ["Gdynia", 18.53, 54.52, "POL"],
    ["Gleiwitz", 18.67, 50.29, "DEU"],
    ["Kattowitz", 19.02, 50.26, "POL"],
    ["Wilno", 25.28, 54.69, "POL"],
    ["Lwów", 24.03, 49.84, "POL"],
    ["Königsberg", 20.5, 54.7, "DEU"],
    ["Memel", 21.13, 55.7, "LTU"],
    ["Viipuri", 28.75, 60.71, "FIN"],
    ["Chişinău", 28.86, 47.01, "ROU"],
    ["Trieste", 13.77, 45.65, "ITA"],
    ["Antakya", 36.16, 36.2, "FRA"],
    ["Madrid", -3.7, 40.42, "ESR"],
    ["Burgos", -3.7, 42.34, "ESN"],
    ["Tétouan", -5.37, 35.57, "ESN"],
    ["Cairo", 31.24, 30.04, "GBR"],
    ["Addis Ababa", 38.75, 9.03, "ETH"],
    ["Tripoli", 13.19, 32.89, "ITA"],
    ["Hanoi", 105.85, 21.03, "FRA"],
    ["Batavia", 106.85, -6.21, "NLD"],
    ["Manila", 120.98, 14.6, "USA"],
    ["Karachi", 67.0, 24.86, "RAJ"],
    ["Rangoon", 96.16, 16.87, "RAJ"],
    ["Keijō (Seoul)", 126.98, 37.57, "JPN"],
    ["Taihoku", 121.56, 25.04, "JPN"],
    ["Toyohara", 142.7, 46.95, "JPN"],
    ["Dairen", 121.6, 38.92, "JPN"],
    ["Hsinking", 125.32, 43.88, "MCK"],
    ["Chengde", 117.9, 40.97, "MCK"],
    ["Hohhot", 111.7, 40.8, "SXI"],
    ["Yan'an", 109.5, 36.6, "CCP"],
    ["Xi'an", 108.9, 34.3, "CHN"],
    ["Kyzyl", 94.45, 51.72, "TTU"],
    ["St. John's", -52.7, 47.56, "GBR"],
    ["Windhoek", 17.08, -22.56, "ZAF"],
  ] as const)("%s is %s's", (_name, lon, lat, tag) => {
    expect(ownerAt(lon, lat)).toBe(tag);
  });
});
