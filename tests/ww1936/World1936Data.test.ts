import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  COUNTRY_TAGS,
  CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  CATEGORY_SLOTS,
  REGION_CATEGORIES,
  RESOURCE_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { ReadonlyScenarioRegion } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  loadTerrainMap,
  TerrainMapData,
} from "@openfront/engine-lib/game/TerrainMapLoader";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
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

const xOf = (lon: number) => Math.floor(((lon + 180) / 360) * W);

/** The region at a lon/lat (the nearest land within 3 tiles). */
function regionAt(
  lon: number,
  lat: number,
): ReadonlyScenarioRegion | undefined {
  const s = data.scenario!;
  const map = data.gameMap;
  const x0 = xOf(lon);
  const y0 = Math.floor((TOP - millerY(lat)) * SCALE);
  for (let d = 0; d <= 3; d++) {
    for (let y = y0 - d; y <= y0 + d; y++) {
      for (let x = x0 - d; x <= x0 + d; x++) {
        if (Math.max(Math.abs(x - x0), Math.abs(y - y0)) !== d) continue;
        const t = map.ref(x, y);
        if (map.isLand(t)) return s.region(s.regionAt(t));
      }
    }
  }
  return undefined;
}

/** The owner tag at a lon/lat (the nearest land within 3 tiles). */
function ownerAt(lon: number, lat: number): CountryTag | undefined {
  return regionAt(lon, lat)?.owner;
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
    // The Dniester: the Moldavian ASSR on the east bank, Bender and the
    // Budjak (to the middle of the liman) Romanian.
    ["Tiraspol", 29.63, 46.84, "SUN"],
    ["Rîbnița", 29.0, 47.77, "SUN"],
    ["Bender", 29.48, 46.83, "ROU"],
    ["Cetatea Albă", 30.35, 46.19, "ROU"],
    ["Ovidiopol", 30.44, 46.26, "SUN"],
    ["Beuthen", 18.92, 50.35, "DEU"],
    ["Marienwerder", 18.93, 53.73, "DEU"],
    // Mallorca (Menorca, Republican, is under the generator's 30-tile islet
    // limit and not on the map).
    ["Palma", 2.65, 39.57, "ESN"],
    // Small pieces keep their owner: the generator merges a piece only into
    // a region of the same owner.
    ["Hong Kong", 114.17, 22.32, "GBR"],
    ["Macau", 113.54, 22.19, "PRT"],
    ["Gibraltar", -5.35, 36.14, "GBR"],
    ["Zara", 15.23, 44.12, "ITA"],
    // Spanish Sahara west of today's berm, Cape Juby and Ifni (Natural Earth
    // files them under Moroccan units).
    ["Laayoune", -13.2, 27.15, "ESN"],
    ["Dakhla", -15.93, 23.71, "ESN"],
    ["Tarfaya", -12.92, 27.94, "ESN"],
    ["Sidi Ifni", -10.17, 29.38, "ESN"],
    ["Guelmim", -10.06, 28.99, "FRA"],
  ] as const)("%s is %s's", (_name, lon, lat, tag) => {
    expect(ownerAt(lon, lat)).toBe(tag);
  });

  // Exclaves and small pieces that stand as regions of their own carry the
  // names players know them by, not the Natural Earth unit under them.
  test.each([
    [114.17, 22.32, "Hong Kong", "홍콩"],
    [113.54, 22.19, "Macau", "마카오"],
    [-5.35, 36.14, "Gibraltar", "지브롤터"],
    [15.23, 44.12, "Zara", "자라"],
    [121.6, 38.92, "Kwantung", "관동주"],
    [142.7, 46.95, "Karafuto", "가라후토"],
    [-5.37, 35.57, "Spanish Morocco", "스페인령 모로코"],
    [45.03, 12.8, "Aden", "아덴"],
    [-0.2, 5.56, "Gold Coast", "골드코스트"],
    [123.6, -10.17, "Dutch Timor", "네덜란드령 티모르"],
    [-13.2, 27.15, "Spanish Sahara", "스페인령 사하라"],
  ] as const)("the region at %s, %s is %s", (lon, lat, name, nameKo) => {
    const r = regionAt(lon, lat);
    expect([r?.name, r?.nameKo]).toEqual([name, nameKo]);
  });

  test("Kwantung is a Japanese region of its own, with Dairen's points", () => {
    const s = data.scenario!;
    const map = data.gameMap;
    const kwantung = regionAt(121.6, 38.92)!;
    expect(kwantung.owner).toBe("JPN");
    expect(kwantung.vp).toBeGreaterThan(0);
    // Not joined to Korea across Manchukuo: no tile east of 123°E.
    let east = 0;
    map.forEachTile((t) => {
      if (s.regionAt(t) === kwantung.id && map.x(t) >= xOf(123)) east++;
    });
    expect(east).toBe(0);
  });

  test("the tile counts in scenario.json match regions.bin", () => {
    const s = data.scenario!;
    const counts = new Map<number, number>();
    data.gameMap.forEachTile((t) => {
      const id = s.regionAt(t);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    const wrong = [...s.data.regions, ...s.data.seaZones]
      .filter((r) => counts.get(r.id) !== r.tiles)
      .map((r) => `${r.id} ${r.name}: ${r.tiles} != ${counts.get(r.id)}`);
    expect(wrong).toEqual([]);
    const listed = s.data.regions.length + s.data.seaZones.length;
    expect(counts.size - (counts.has(0) ? 1 : 0)).toBe(listed);
  });

  test("no capital region holds more than a third of its country's points (spec §7.5)", () => {
    // Owner decision 2026-10-20: one thrust to a capital must not end a
    // country. The generator keeps min(capital, max(1, floor(rest / 2))).
    const s = data.scenario!;
    const over: string[] = [];
    for (const tag of s.countries) {
      const own = s.landRegions.filter((r) => r.owner === tag);
      const total = own.reduce((a, r) => a + r.vp, 0);
      const capital = s.region(s.regionAt(s.capitalTile(tag)))!;
      expect(capital.vp, tag).toBeGreaterThanOrEqual(1);
      expect(capital.vp, tag).toBeLessThanOrEqual(
        Math.max(1, Math.floor((total - capital.vp) / 2)),
      );
      // A country whose only points are its capital keeps that 1 point.
      const withPoints = own.filter((r) => r.vp > 0).length;
      if (withPoints > 1 && capital.vp * 3 > total) {
        over.push(`${tag}: ${capital.vp} of ${total}`);
      }
    }
    expect(over).toEqual([]);
  });

  test("only regions with a city hold victory points (spec §7.5)", () => {
    const s = data.scenario!;
    // Most regions are empty land worth nothing, and the USSR's points lie
    // west of 60°E, so its 90% capitulation is reachable without Siberia.
    expect(s.landRegions.filter((r) => r.vp === 0).length).toBeGreaterThan(
      s.landRegions.length / 2,
    );
    const sun = s.landRegions.filter((r) => r.owner === "SUN");
    const all = sun.reduce((a, r) => a + r.vp, 0);
    const east = sun
      .filter((r) => r.vpTile[0] >= xOf(60))
      .reduce((a, r) => a + r.vp, 0);
    expect(east / all).toBeLessThan(0.25);
  });
});

// P1 spec §3: scenario.json version 2, from the tool's two tables
// (map-generator/scenarios/world1936/src).
interface EconomyRow {
  tag: CountryTag;
  popCore: number;
  popColonial: number;
  dev: number;
  civ?: number;
  mil?: number;
  dock?: number;
}
interface SiteRow {
  tag: CountryTag;
  res: (typeof RESOURCE_IDS)[number];
  amount: number;
}
const srcDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../map-generator/scenarios/world1936/src",
);
const economyTable: EconomyRow[] = JSON.parse(
  fs.readFileSync(path.join(srcDir, "economy1936.json"), "utf8"),
);
const siteTable: SiteRow[] = JSON.parse(
  fs.readFileSync(path.join(srcDir, "resources1936.json"), "utf8"),
);
const MAJORS = ["DEU", "ITA", "JPN", "GBR", "FRA", "USA", "SUN"] as const;

describe("the world1936 economy (P1 spec §3)", () => {
  const regionsOf = (tag: CountryTag) =>
    data.scenario!.landRegions.filter((r) => r.owner === tag);
  const total = (
    rs: readonly ReadonlyScenarioRegion[],
    f: (r: ReadonlyScenarioRegion) => number,
  ) => rs.reduce((a, r) => a + f(r), 0);

  test("the scenario is version 2", () => {
    expect(data.scenario!.data.version).toBe(2);
    expect(economyTable.map((r) => r.tag).sort()).toEqual(
      [...COUNTRY_TAGS].sort(),
    );
  });

  test("factories add up to the table", () => {
    // The majors' factories are the table's (spec §11.1)…
    const majors = Object.fromEntries(
      MAJORS.map((tag) => {
        const rs = regionsOf(tag);
        return [
          tag,
          [
            total(rs, (r) => r.civ),
            total(rs, (r) => r.mil),
            total(rs, (r) => r.dock),
          ],
        ];
      }),
    );
    expect(majors).toEqual({
      DEU: [32, 16, 3],
      ITA: [14, 7, 4],
      JPN: [16, 8, 8],
      GBR: [32, 8, 12],
      FRA: [22, 8, 4],
      USA: [80, 5, 10],
      SUN: [40, 22, 4],
    });
    // …and everyone else's the formula of spec §11.3, unless the table
    // gives a value (Czechoslovakia's mil 6, Sweden's mil 2).
    const DEV_CIV = [20, 100, 220, 400, 700];
    for (const row of economyTable) {
      const rs = regionsOf(row.tag);
      let civ = Math.floor(
        (row.popCore * DEV_CIV[row.dev - 1] + 500_000) / 1_000_000,
      );
      if (row.popCore >= 1000) civ = Math.max(civ, 1);
      civ = row.civ ?? civ;
      const mil = row.mil ?? Math.floor((civ + 2) / 4);
      const coast = rs.some((r) => r.coastal);
      const dock = row.dock ?? (coast ? Math.floor((civ + 5) / 10) : 0);
      expect(
        [
          total(rs, (r) => r.civ),
          total(rs, (r) => r.mil),
          total(rs, (r) => r.dock),
        ],
        row.tag,
      ).toEqual([civ, mil, dock]);
    }
    expect(total(regionsOf("POL"), (r) => r.civ)).toBe(7);
    expect(total(regionsOf("CSK"), (r) => r.mil)).toBe(6);
  });

  test("population adds up", () => {
    for (const row of economyTable) {
      expect(
        total(regionsOf(row.tag), (r) => r.pop),
        row.tag,
      ).toBe(row.popCore + row.popColonial);
    }
  });

  test("resources add up to the sites", () => {
    const want = new Map<string, number>();
    for (const s of siteTable) {
      const key = `${s.tag} ${s.res}`;
      want.set(key, (want.get(key) ?? 0) + s.amount);
    }
    for (const tag of COUNTRY_TAGS) {
      const rs = regionsOf(tag);
      RESOURCE_IDS.forEach((res, k) => {
        expect(
          total(rs, (r) => r.res[k]),
          `${tag} ${res}`,
        ).toBe(want.get(`${tag} ${res}`) ?? 0);
      });
    }
    const oil = RESOURCE_IDS.indexOf("oil");
    const tungsten = RESOURCE_IDS.indexOf("tungsten");
    const rubber = RESOURCE_IDS.indexOf("rubber");
    expect(total(regionsOf("USA"), (r) => r.res[oil])).toBe(153);
    expect(total(regionsOf("CHN"), (r) => r.res[tungsten])).toBe(30);
    expect(total(regionsOf("GBR"), (r) => r.res[rubber])).toBe(54);
    // Germany has steel and little else (spec §3.5).
    expect(regionsOf("DEU").filter((r) => r.res[rubber] > 0)).toEqual([]);
  });

  test("buildings fit their slots", () => {
    const over = data
      .scenario!.landRegions.filter(
        (r) => r.civ + r.mil + r.dock > CATEGORY_SLOTS[r.cat],
      )
      .map((r) => `${r.id} ${r.name} ${r.cat}`);
    expect(over).toEqual([]);
  });

  test("dockyards are on the coast", () => {
    // coastal is what the tiles say: a land tile touching a sea-zone tile.
    const s = data.scenario!;
    const map = data.gameMap;
    const coast = new Set<number>();
    map.forEachTile((t) => {
      if (!map.isLand(t)) return;
      const id = s.regionAt(t);
      if (coast.has(id)) return;
      for (const n of map.neighbors(t)) {
        if (!map.isLand(n) && s.regionAt(n) > SEA_ZONE_BASE) coast.add(id);
      }
    });
    const wrong = s.landRegions
      .filter((r) => r.coastal !== coast.has(r.id))
      .map((r) => `${r.id} ${r.name}`);
    expect(wrong).toEqual([]);
    expect(s.landRegions.filter((r) => r.dock > 0 && !r.coastal)).toEqual([]);
  });

  test("capitals are at least cities", () => {
    const s = data.scenario!;
    for (const tag of s.countries) {
      const capital = s.region(s.regionAt(s.capitalTile(tag)))!;
      expect(
        REGION_CATEGORIES.indexOf(capital.cat),
        `${tag} ${capital.name} ${capital.cat}`,
      ).toBeGreaterThanOrEqual(REGION_CATEGORIES.indexOf("city"));
    }
  });

  test("no major lacks a core region", () => {
    for (const tag of MAJORS) {
      expect(
        regionsOf(tag).some((r) => r.core),
        tag,
      ).toBe(true);
    }
    // Colonies are not homeland (spec §3.3-1): Korea, Kwantung, Egypt…
    expect(regionAt(126.98, 37.57)?.core).toBe(false);
    expect(regionAt(121.6, 38.92)?.core).toBe(false);
    expect(regionAt(31.24, 30.04)?.core).toBe(false);
    expect(regionAt(-52.7, 47.56)?.core).toBe(false);
    expect(regionAt(13.4, 52.52)?.core).toBe(true);
  });
});
