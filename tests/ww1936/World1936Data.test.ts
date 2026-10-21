import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  COUNTRY_TAGS,
  CountryTag,
  isDormantTag,
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

/** P5 plan decision 3: the 1936 countries (COUNTRY_TAGS ends with the dormant slots). */
const SCENARIO_TAGS = COUNTRY_TAGS.filter((t) => !isDormantTag(t));

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

/** The region at a lon/lat (the nearest land within reach tiles, 3 by default). */
function regionAt(
  lon: number,
  lat: number,
  reach = 3,
): ReadonlyScenarioRegion | undefined {
  const s = data.scenario!;
  const map = data.gameMap;
  const x0 = xOf(lon);
  const y0 = Math.floor((TOP - millerY(lat)) * SCALE);
  for (let d = 0; d <= reach; d++) {
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
    expect(SCENARIO_TAGS.filter((t) => !owners.has(t))).toEqual([]);
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
    for (const tag of s.scenarioTags()) {
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
    for (const tag of s.scenarioTags()) {
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
interface IndustryTable {
  industry: { tag: CountryTag; mult: number; lon: number; lat: number }[];
  yards: { tag: CountryTag; weight: number; lon: number; lat: number }[];
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
const industryTable: IndustryTable = JSON.parse(
  fs.readFileSync(path.join(srcDir, "industry1936.json"), "utf8"),
);
const MAJORS = ["DEU", "ITA", "JPN", "GBR", "FRA", "USA", "SUN"] as const;

describe("the world1936 economy (P1 spec §3)", () => {
  const regionsOf = (tag: CountryTag) =>
    data.scenario!.landRegions.filter((r) => r.owner === tag);
  const total = (
    rs: readonly ReadonlyScenarioRegion[],
    f: (r: ReadonlyScenarioRegion) => number,
  ) => rs.reduce((a, r) => a + f(r), 0);

  test("the scenario is version 4 (P1's version 2 fields kept)", () => {
    expect(data.scenario!.data.version).toBe(4);
    expect(economyTable.map((r) => r.tag).sort()).toEqual(
      [...SCENARIO_TAGS].sort(),
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
    // P4 spec §6.5: the 1936 dockyards.
    expect(majors).toEqual({
      DEU: [32, 16, 8],
      ITA: [14, 7, 9],
      JPN: [16, 8, 14],
      GBR: [32, 8, 20],
      FRA: [22, 8, 10],
      USA: [80, 5, 16],
      SUN: [40, 22, 8],
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
    for (const tag of SCENARIO_TAGS) {
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
    // Task 9: tungsten and chromium sites at twice their first scale, so
    // the world's supply covers the lines that need them (spec §16 record).
    expect(total(regionsOf("CHN"), (r) => r.res[tungsten])).toBe(60);
    expect(
      total(regionsOf("TUR"), (r) => r.res[RESOURCE_IDS.indexOf("chromium")]),
    ).toBe(20);
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
    for (const tag of s.scenarioTags()) {
      const capital = s.region(s.regionAt(s.capitalTile(tag)))!;
      expect(
        REGION_CATEGORIES.indexOf(capital.cat),
        `${tag} ${capital.name} ${capital.cat}`,
      ).toBeGreaterThanOrEqual(REGION_CATEGORIES.indexOf("city"));
    }
  });

  test("people live where the towns are (ruling 2026-10-20)", () => {
    // Population follows the Natural Earth populated places: a capital holds
    // 5–20% of its homeland, empty land almost no one.
    const s = data.scenario!;
    const homeland = (tag: CountryTag) =>
      total(
        regionsOf(tag).filter((r) => r.core),
        (r) => r.pop,
      );
    for (const tag of ["DEU", "GBR", "JPN", "FRA", "ITA", "POL"] as const) {
      const capital = s.region(s.regionAt(s.capitalTile(tag)))!;
      const share = capital.pop / homeland(tag);
      expect(share, `${tag} ${capital.name}`).toBeGreaterThanOrEqual(0.05);
      expect(share, `${tag} ${capital.name}`).toBeLessThanOrEqual(0.2);
    }
    const alaska = total(
      regionsOf("USA").filter((r) => r.name.startsWith("Alaska")),
      (r) => r.pop,
    );
    expect(alaska / homeland("USA")).toBeLessThan(0.01);
    // The factories follow the people: the Ruhr builds at least as much as
    // Berlin (P4 spec §6.5's eight German dockyards fill the Lower Saxony
    // yard, and the mil it held goes to Berlin: they tie, the Ruhr's
    // metropolis slots full).
    const ruhr = regionAt(7.0, 51.5)!;
    const berlin = regionAt(13.4, 52.52)!;
    expect(ruhr.civ + ruhr.mil).toBeGreaterThanOrEqual(berlin.civ + berlin.mil);
    expect(ruhr.civ + ruhr.mil).toBe(CATEGORY_SLOTS[ruhr.cat]);
  });

  // Ruling 2026-10-20 (fix round 2): 1936 industrial geography.
  const regionsAt = (points: readonly (readonly [number, number])[]) => [
    ...new Map(
      points.map(([lon, lat]) => {
        const r = regionAt(lon, lat)!;
        return [r.id, r] as const;
      }),
    ).values(),
  ];
  const industry = (rs: readonly ReadonlyScenarioRegion[]) =>
    total(rs, (r) => r.civ + r.mil);

  test("US states hold their 1930 census people", () => {
    const pennsylvania = regionAt(-79.99, 40.44)!;
    const florida = regionAt(-80.19, 25.77)!;
    expect(pennsylvania.pop).toBeGreaterThan(florida.pop * 5);
    // New York State (Syracuse; New York City lies in the New Jersey region).
    expect(regionAt(-76.15, 43.05)!.pop).toBeGreaterThan(pennsylvania.pop);
  });

  test("factories follow the 1936 industry", () => {
    // The Rust Belt out-builds the Sun Belt.
    const rustBelt = regionsAt([
      [-79.99, 40.44], // Pittsburgh
      [-81.69, 41.5], // Cleveland
      [-83.05, 42.33], // Detroit
    ]);
    const sunBelt = regionsAt([
      [-95.37, 29.76], // Houston
      [-96.8, 32.78], // Dallas
      [-80.19, 25.77], // Miami
      [-81.66, 30.33], // Jacksonville
    ]);
    expect(industry(rustBelt)).toBeGreaterThan(industry(sunBelt));
    // The Donbas and the Urals out-build any other two Soviet regions.
    const donbasUrals = regionsAt([
      [37.8, 48.0], // Stalino
      [39.3, 48.57], // Voroshilovgrad
      [60.6, 56.84], // Sverdlovsk
      [61.4, 55.16], // Chelyabinsk
      [59.0, 53.4], // Magnitogorsk
    ]);
    const ids = new Set(donbasUrals.map((r) => r.id));
    const others = regionsOf("SUN")
      .filter((r) => !ids.has(r.id))
      .map((r) => r.civ + r.mil)
      .sort((a, b) => b - a);
    expect(industry(donbasUrals)).toBeGreaterThan(others[0] + others[1]);
    // Italy's northern triangle out-builds Lazio.
    const north = regionsAt([
      [9.19, 45.46], // Milan
      [7.68, 45.07], // Turin
    ]);
    expect(industry(north)).toBeGreaterThan(industry([regionAt(12.5, 41.9)!]));
  });

  test("dockyards are in the 1936 naval yards", () => {
    const yardRegions = new Set<number>();
    for (const y of industryTable.yards) {
      const r = regionAt(y.lon, y.lat, 8)!;
      expect(r.owner, `${y.tag} ${y.lon} ${y.lat}`).toBe(y.tag);
      expect(r.dock, `${y.tag} ${r.name}`).toBeGreaterThan(0);
      yardRegions.add(r.id);
    }
    for (const tag of MAJORS) {
      const elsewhere = regionsOf(tag).filter(
        (r) => r.dock > 0 && !yardRegions.has(r.id),
      );
      expect(elsewhere, tag).toEqual([]);
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

// P2 spec §3 (scenario version 3: the land graph) and the P4 map fixes folded
// into the same rebuild (P4 spec §3.1–3.3; plan decision 23).
interface IslandRow {
  key: string;
  owner: CountryTag;
}
const islandTable: IslandRow[] = JSON.parse(
  fs.readFileSync(path.join(srcDir, "islands1936.json"), "utf8"),
);

/** The region of a 1936 owner and name ("TAG:name"). */
function named(tagName: string): ReadonlyScenarioRegion {
  const [tag, name] = tagName.split(/:(.*)/s);
  const hits = data.scenario!.landRegions.filter(
    (r) => r.owner === tag && r.name === name,
  );
  expect(hits.length, tagName).toBe(1);
  return hits[0];
}

/** The edge between two regions, or undefined. */
function edgeOf(a: number, b: number) {
  const s = data.scenario!;
  const i = s.edgeBetween(a, b);
  return i < 0 ? undefined : s.edge(i);
}

// The regions that gave land to a new region (Corsica from Alpes-Maritimes,
// Hatay from Aleppo, Oahu from Hawaii, Singapore from Malaya) may move their
// VP tile (pre-flight D1; cmd/ww1936build lists them). Only Malaya's moved.
const DONORS = new Set([531, 729, 930, 1087]);

/** FNV-1a over "id|owner|name|vpTile" of the regions 1..1342 (VP tile left out for the donors). */
function v2Fingerprint(regions: readonly ReadonlyScenarioRegion[]): {
  h: number;
  n: number;
} {
  let h = 0x811c9dc5;
  const sorted = regions.filter((r) => r.id <= 1342);
  for (const r of sorted) {
    const tile = DONORS.has(r.id) ? "" : `${r.vpTile[0]},${r.vpTile[1]}`;
    const line = `${r.id}|${r.owner}|${r.name}|${tile}\n`;
    for (let i = 0; i < line.length; i++) {
      h ^= line.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return { h, n: sorted.length };
}

describe("the world1936 land graph (P2 spec §3, scenario v3)", () => {
  test("version 3 fields: the hand order of battle, every country's dev, no kmPerTile", () => {
    const d = data.scenario!.data;
    expect(d.version).toBe(4);
    expect(d.historicalOob).toBe(true);
    expect(d.countries.filter((c) => c.dev === undefined)).toEqual([]);
    expect(d.kmPerTile).toBeUndefined();
    // dev is economy1936.json's.
    for (const row of economyTable) {
      expect(d.countries.find((c) => c.tag === row.tag)?.dev, row.tag).toBe(
        row.dev,
      );
    }
  });

  test("the regions 1..1342 keep their name, owner and VP tile from v2", () => {
    // Pinned from the committed version 2 scenario.json (1,265 regions).
    expect(v2Fingerprint(data.scenario!.landRegions)).toEqual({
      h: 3722970793,
      n: 1265,
    });
  });

  test("2,800 to 3,050 land edges; a region without one is an island of its own", () => {
    const s = data.scenario!;
    const map = data.gameMap;
    expect(s.edges().length).toBeGreaterThanOrEqual(2800);
    expect(s.edges().length).toBeLessThanOrEqual(3050);
    s.ensureRegionTiles(map);
    const lonely = s.landRegions.filter((r) => s.edgesOf(r.id).length === 0);
    expect(lonely.length).toBeGreaterThan(0);
    for (const r of lonely) {
      // Its landmass (4-neighbour land tiles) holds no other region's tile.
      const seen = new Set<number>(s.regionTiles(r.id));
      const queue = [...seen];
      for (let head = 0; head < queue.length; head++) {
        for (const n of map.neighbors(queue[head])) {
          if (!map.isLand(n) || seen.has(n)) continue;
          expect(s.regionAt(n), r.name).toBe(r.id);
          seen.add(n);
          queue.push(n);
        }
      }
    }
  });

  test("the edges join both ways, km from the centres", () => {
    const s = data.scenario!;
    for (const [i, e] of s.edges().entries()) {
      expect(s.edgesOf(e.a).some((x) => x.to === e.b && x.edge === i)).toBe(
        true,
      );
      expect(s.edgesOf(e.b).some((x) => x.to === e.a && x.edge === i)).toBe(
        true,
      );
    }
    // Great-circle km between the centres: Berlin's neighbours lie 20 to
    // 800 km from it.
    const berlin = regionAt(13.4, 52.52)!;
    const brandenburg = s.edgesOf(berlin.id).map((x) => s.edge(x.edge).km);
    expect(Math.min(...brandenburg)).toBeGreaterThan(20);
    expect(Math.max(...brandenburg)).toBeLessThan(800);
  });

  test.each([
    ["Messina", "ITA:Palermo", "ITA:Cosenza"],
    ["Øresund", "DNK:Hovedstaden", "SWE:Skåne"],
    ["Kerch", "SUN:Crimea", "SUN:Krasnodar"],
    ["Gibraltar", "GBR:Gibraltar", "ESN:Spanish Morocco"],
    ["Palk", "RAJ:Tamil Nadu", "GBR:Ceylon"],
  ] as const)("the %s strait is a land edge", (_strait, a, b) => {
    const e = edgeOf(named(a).id, named(b).id);
    expect(e?.strait).toBe(1);
    expect(e?.border).toBe(0);
  });

  // Crossings the 6-water-tile rule finds but HOI4 has none of
  // (straits1936.json land.remove).
  test.each([
    ["ITA:Rhodes", "TUR:Mugla"],
    ["ITA:Leros", "TUR:Mugla"],
    ["GBR:Malaya", "NLD:Batavia"],
    ["NLD:Batavia", "GBR:Singapore"],
    ["SUN:Kamchatka (SW)", "JPN:Northern Kurils"],
    ["GBR:Argyll and Bute", "GBR:Fermanagh"],
    ["AUS:Papua and New Guinea", "GBR:Solomon Islands"],
    ["DNK:Hovedstaden", "DEU:Hamburg"],
    ["DNK:Hovedstaden", "DEU:Mecklenburg-Vorpommern"],
  ] as const)("no crossing from %s to %s", (a, b) => {
    expect(edgeOf(named(a).id, named(b).id)).toBeUndefined();
  });

  test("the Pripyat marshes and the Ob swamps are marsh (terrain1936.json)", () => {
    const s = data.scenario!;
    for (const [lon, lat] of [
      [26.1, 52.1], // Pinsk
      [23.7, 52.1], // Brest
      [29.25, 52.05], // Mozyr
      [24.7, 51.2], // Kovel
      [69.0, 61.0], // Khanty-Mansiysk
    ] as const) {
      const r = regionAt(lon, lat)!;
      expect(s.landOf(r.id), r.name).toBe("marsh");
    }
    expect(
      s.landRegions.filter((r) => r.land === "marsh").map((r) => r.id),
    ).toEqual([123, 145, 311, 312, 333]);
  });

  test("big rivers: the Vistula between Germany and Poland, the Rhine between Alsace and Baden", () => {
    const s = data.scenario!;
    expect(s.edges().filter((e) => e.river === 2).length).toBeGreaterThan(30);
    const ownerOf = (id: number) => s.region(id)!.owner;
    const deuPol = s
      .edges()
      .filter(
        (e) =>
          [ownerOf(e.a), ownerOf(e.b)].sort().join() === "DEU,POL" &&
          e.river === 2,
      );
    expect(deuPol.length).toBeGreaterThan(0);
    const alsace = regionAt(7.75, 48.58)!; // Strasbourg
    const baden = regionAt(8.4, 49.01)!; // Karlsruhe
    expect([alsace.owner, baden.owner]).toEqual(["FRA", "DEU"]);
    expect(edgeOf(alsace.id, baden.id)?.river).toBe(2);
  });

  test("terrain: every kind there, jungle in the tropics, urban regions small", () => {
    const s = data.scenario!;
    const kinds = new Set(s.landRegions.map((r) => s.landOf(r.id)));
    for (const k of [
      "plains",
      "forest",
      "hills",
      "mountain",
      "marsh",
      "jungle",
      "desert",
      "urban",
    ] as const) {
      expect(kinds.has(k), k).toBe(true);
    }
    for (const r of s.landRegions) {
      expect(r.land, r.name).toBeDefined();
      if (r.land === "jungle")
        expect(Math.abs(s.latC(r.id))).toBeLessThan(2350);
      if (r.land === "urban") expect(r.tiles, r.name).toBeLessThan(400);
    }
    expect(regionAt(2.35, 48.86)!.land).toBe("urban"); // Paris
  });

  test("rail: majors' capitals at least 2, the Trans-Siberian at least 1", () => {
    const s = data.scenario!;
    for (const tag of MAJORS) {
      const capital = s.region(s.regionAt(s.capitalTile(tag)))!;
      expect(s.startRail(capital.id), tag).toBeGreaterThanOrEqual(2);
    }
    for (const [lon, lat] of [
      [73.4, 55.0], // Omsk
      [82.9, 55.0], // Novosibirsk
      [104.3, 52.3], // Irkutsk
      [113.5, 52.0], // Chita
      [135.1, 48.5], // Khabarovsk
      [131.9, 43.1], // Vladivostok
    ] as const) {
      const r = regionAt(lon, lat)!;
      expect(r.owner).toBe("SUN");
      expect(s.startRail(r.id), r.name).toBeGreaterThanOrEqual(1);
    }
  });

  test("forts: the Maginot Line faces Germany, the Mannerheim Line holds the isthmus", () => {
    const s = data.scenario!;
    const facingGermany = s.landRegions.filter(
      (r) =>
        r.owner === "FRA" &&
        s.edgesOf(r.id).some((x) => s.region(x.to)!.owner === "DEU"),
    );
    expect(facingGermany.length).toBeGreaterThan(0);
    expect(
      Math.max(...facingGermany.map((r) => s.startFort(r.id))),
    ).toBeGreaterThanOrEqual(4);
    const viipuri = regionAt(28.75, 60.71)!;
    expect(viipuri.owner).toBe("FIN");
    expect(s.startFort(viipuri.id)).toBe(3);
  });

  test.each([
    ["London", -0.13, 51.51],
    ["Hamburg", 9.99, 53.55],
    ["Marseille", 5.37, 43.3],
    ["Naples", 14.27, 40.85],
    ["Yokohama", 139.64, 35.44],
  ] as const)("%s is a port", (_city, lon, lat) => {
    const r = regionAt(lon, lat)!;
    expect(data.scenario!.isPort(r.id), r.name).toBe(true);
  });
});

describe("the P4 map fixes (P4 spec §3.1–3.3)", () => {
  test("160 sea zones, the eleven new ones named, three lakes", () => {
    const s = data.scenario!;
    const zones = s.data.seaZones;
    expect(zones.length).toBe(160);
    const name = (id: number) => s.seaZone(id)?.name;
    expect(
      [
        40150, 40151, 40152, 40153, 40154, 40155, 40156, 40157, 40158, 40159,
        40160,
      ].map(name),
    ).toEqual([
      "English Channel",
      "Irish Sea",
      "Celtic Sea",
      "Western Mediterranean",
      "Aegean Sea",
      "Adriatic Sea",
      "Skagerrak",
      "Gulf of Finland",
      "Persian Gulf",
      "Gulf of Aden",
      "Eastern Mediterranean",
    ]);
    expect(s.seaZone(40154)?.nameKo).toBe("에게해");
    expect(s.seaZone(40062)?.name).toBe("Central Mediterranean");
    expect(s.seaZone(40062)?.nameKo).toBe("중앙 지중해");
    expect(zones.filter((z) => z.lake).map((z) => z.id)).toEqual([
      40048, 40051, 40058,
    ]);
  });

  test("every sea has a sea edge, lakes none; the straits, canals and date line", () => {
    const s = data.scenario!;
    const edges = s.data.seaEdges!;
    const touched = new Set(edges.flatMap(([a, b]) => [a, b]));
    for (const z of s.data.seaZones) {
      expect(touched.has(z.id), `${z.id} ${z.name}`).toBe(!z.lake);
    }
    for (const [i, [a, b, km, kind]] of edges.entries()) {
      expect(a).toBeLessThan(b);
      expect(km).toBeGreaterThan(0);
      expect([0, 1, 2, 3]).toContain(kind);
      if (i > 0) {
        const [pa, pb] = edges[i - 1];
        expect(pa < a || (pa === a && pb < b)).toBe(true);
      }
    }
    const kindOf = (a: number, b: number) =>
      edges.find(([x, y]) => x === Math.min(a, b) && y === Math.max(a, b))?.[3];
    expect(kindOf(40059, 40154)).toBe(1); // the Bosporus: Black Sea–Aegean
    expect(kindOf(40160, 40077)).toBe(2); // Suez
    expect(kindOf(40083, 40092)).toBe(2); // Panama
    expect(kindOf(40046, 40041)).toBe(2); // Kiel
    expect(edges.filter((e) => e[3] === 3).length).toBeGreaterThanOrEqual(3);
    const straits = s.data.straits!;
    expect(straits.map((x) => x.id)).toEqual([
      "bosporus",
      "gibraltar",
      "oresund",
      "messina",
      "suez",
      "panama",
      "kiel",
    ]);
    for (const st of straits) {
      expect(kindOf(st.a, st.b), st.id).toBe(st.kind === "canal" ? 2 : 1);
      for (const id of st.shore) expect(s.region(id), st.id).toBeDefined();
    }
  });

  test("the 25 islands are regions from 1343 on, in list order, with their owners", () => {
    const s = data.scenario!;
    const islands = s.landRegions.filter((r) => r.island !== undefined);
    // P4 spec §3.2's 24, and Corsica (controller ruling: P3/P5 content).
    expect(islandTable.length).toBe(25);
    expect(islands.map((r) => r.island)).toEqual(islandTable.map((r) => r.key));
    expect(islands.map((r) => r.id)).toEqual(
      islandTable.map((_r, k) => 1343 + k),
    );
    for (const [k, r] of islands.entries()) {
      expect(r.owner, r.name).toBe(islandTable[k].owner);
      expect(r.tiles, r.name).toBeGreaterThan(0);
      expect(r.coastal, r.name).toBe(true);
    }
    const vp = (key: string) => islands.find((r) => r.island === key)!.vp;
    expect(vp("malta")).toBeGreaterThan(0);
    expect(vp("oahu")).toBeGreaterThan(0);
    expect(vp("okinawa")).toBeGreaterThan(0);
    expect(vp("midway")).toBe(0);
    // Pearl Harbor and Singapore are ports.
    expect(s.isPort(islands.find((r) => r.island === "oahu")!.id)).toBe(true);
  });

  test("Hatay, Singapore, Corsica, Malta, Rhodes, the Mandates, Okinawa, Iwo Jima, Guam and Oahu are regions of their own (P3/P5 content)", () => {
    const hatay = regionAt(36.16, 36.2)!; // Antakya
    expect([hatay.id, hatay.name, hatay.owner, hatay.core]).toEqual([
      1368,
      "Hatay",
      "FRA",
      false,
    ]);
    const singapore = regionAt(103.85, 1.29)!;
    expect([singapore.id, singapore.island, singapore.owner]).toEqual([
      1366,
      "singapore",
      "GBR",
    ]);
    expect(singapore.vp).toBeGreaterThan(0);
    const corsica = regionAt(9.05, 42.15)!;
    expect([corsica.id, corsica.island, corsica.owner]).toEqual([
      1367,
      "corsica",
      "FRA",
    ]);
    const ids = Object.fromEntries(
      data
        .scenario!.landRegions.filter((r) => r.island !== undefined)
        .map((r) => [r.island!, r.id]),
    );
    expect(ids).toMatchObject({
      malta: 1343,
      oahu: 1344,
      guam: 1347,
      saipan: 1350,
      truk: 1351,
      palau: 1352,
      iwo_jima: 1354,
      okinawa: 1355,
      rhodes: 1362,
      leros: 1363,
    });
    // The donors keep their ids.
    expect(regionAt(37.16, 36.2)!.id).toBe(729); // Aleppo
    expect(regionAt(101.69, 3.14)!.id).toBe(1087); // Malaya
    expect(regionAt(7.27, 43.7)!.id).toBe(531); // Nice, Alpes-Maritimes
    expect(regionAt(-155.5, 19.6)!.id).toBe(930); // Hawaii
  });
});

// P4 spec §3.5, §6.4, §6.5, §12.1 (scenario version 4; P4 plan Task 2). The
// version 4 fields are read from the file itself: the ScenarioIndex readers
// (harborOf, startNavalBase, startAirBase, startAa, startCoastalFort) come
// with P4 Task 1.
interface V4Region {
  id: number;
  harbor: number;
  navalBase: number;
  airBase: number;
  aa: number;
  coastalFort: number;
}
const v4: {
  height: number;
  regions: V4Region[];
  rows: { latC: number[]; kmxMilli: number[] };
} = JSON.parse(
  fs.readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../resources/maps/world1936/scenario.json",
    ),
    "utf8",
  ),
);
const v4ById = new Map(v4.regions.map((r) => [r.id, r]));
const v4At = (lon: number, lat: number): V4Region => {
  const r = regionAt(lon, lat)!;
  return v4ById.get(r.id)!;
};
const v4Island = (key: string): V4Region =>
  v4ById.get(data.scenario!.landRegions.find((r) => r.island === key)!.id)!;

describe("the world1936 start bases and harbours (P4 spec §3.5, §6.4, §12.1)", () => {
  test("every region on a sea has the harbour it touches most, the others 0", () => {
    const s = data.scenario!;
    const map = data.gameMap;
    const pairs = new Map<number, Map<number, number>>();
    map.forEachTile((t) => {
      if (!map.isLand(t)) return;
      const id = s.regionAt(t);
      for (const n of map.neighbors(t)) {
        const z = s.regionAt(n);
        if (map.isLand(n) || z <= SEA_ZONE_BASE || s.seaZone(z)?.lake) continue;
        const m = pairs.get(id) ?? new Map<number, number>();
        m.set(z, (m.get(z) ?? 0) + 1);
        pairs.set(id, m);
      }
    });
    const wrong: string[] = [];
    for (const r of s.landRegions) {
      let best = 0;
      let bestN = 0;
      for (const [z, n] of [...(pairs.get(r.id) ?? [])].sort(
        (a, b) => a[0] - b[0],
      )) {
        if (n > bestN) [best, bestN] = [z, n];
      }
      if (v4ById.get(r.id)!.harbor !== best) wrong.push(`${r.id} ${r.name}`);
      // A region off the coast has none; one on a lake only (the Caspian,
      // the Great Lakes) is coastal without a harbour.
      if (!r.coastal) expect(best, r.name).toBe(0);
    }
    expect(wrong).toEqual([]);
  });

  test.each([
    ["Portsmouth", -1.09, 50.8],
    ["Kiel", 10.14, 54.32],
    ["Wilhelmshaven", 8.12, 53.52],
    ["Toulon", 5.93, 43.12],
    ["Brest", -4.49, 48.39],
    ["Taranto", 17.24, 40.47],
    ["La Spezia", 9.83, 44.1],
    ["Yokosuka", 139.67, 35.28],
    ["Kure", 132.56, 34.24],
    ["Norfolk", -76.3, 36.95],
  ] as const)("%s's region has a level 10 naval base", (_place, lon, lat) => {
    expect(v4At(lon, lat).navalBase).toBe(10);
  });

  test("Pearl Harbor, Malta and Singapore have level 8 naval bases", () => {
    expect(v4Island("oahu").navalBase).toBe(8);
    expect(v4Island("malta").navalBase).toBe(8);
    expect(v4Island("singapore").navalBase).toBe(8);
    // Ten level-10 bases in all (spec §6.4).
    expect(v4.regions.filter((r) => r.navalBase === 10).length).toBe(10);
  });

  test("naval bases and coastal forts only on a harbour; every port on a sea has a base", () => {
    const s = data.scenario!;
    for (const r of v4.regions) {
      if (r.navalBase > 0 || r.coastalFort > 0) {
        expect(r.harbor, `${r.id}`).toBeGreaterThan(0);
      }
    }
    // A hand level or the formula min(3, 1 + dockyards), islands included:
    // an island port without a hand base takes the formula (P4 pre-flight
    // T2: Okinawa, the Azores… are supplied by sea), and a naval base makes
    // a port, so the static port and the engine's naval-base port agree.
    const ports = s.landRegions.filter(
      (r) => r.port && v4ById.get(r.id)!.harbor > 0,
    );
    expect(ports.length).toBeGreaterThan(50);
    for (const r of ports) {
      expect(v4ById.get(r.id)!.navalBase, r.name).toBeGreaterThanOrEqual(1);
    }
    for (const r of s.landRegions) {
      if (v4ById.get(r.id)!.navalBase > 0) expect(r.port, r.name).toBe(true);
    }
    expect(v4Island("okinawa").navalBase).toBe(1);
  });

  test("the majors' capitals have level 5 air bases and level 3 anti-air", () => {
    const s = data.scenario!;
    for (const tag of MAJORS) {
      const capital = v4ById.get(s.regionAt(s.capitalTile(tag)))!;
      expect([capital.airBase, capital.aa], tag).toEqual([5, 3]);
    }
    // The islands' own air bases (spec §12.1).
    expect(
      ["malta", "oahu", "singapore", "okinawa", "truk", "midway"].map(
        (k) => v4Island(k).airBase,
      ),
    ).toEqual([2, 4, 3, 2, 2, 1]);
  });

  test.each([
    ["Singapore", 103.82, 1.35],
    ["Gibraltar", -5.35, 36.14],
    ["Kronstadt (Leningrad)", 30.32, 59.94],
    ["Manila", 120.98, 14.6],
  ] as const)("%s has a level 3 coastal fort", (_place, lon, lat) => {
    expect(v4At(lon, lat).coastalFort).toBe(3);
  });

  test("the 1936 dockyards (spec §6.5)", () => {
    const docks = (tag: CountryTag) =>
      data
        .scenario!.landRegions.filter((r) => r.owner === tag)
        .reduce((a, r) => a + r.dock, 0);
    expect(
      Object.fromEntries(
        (
          [
            "DEU",
            "ITA",
            "JPN",
            "GBR",
            "FRA",
            "USA",
            "SUN",
            "NLD",
            "SWE",
            "ESR",
            "ESN",
            "CAN",
            "AUS",
          ] as const
        ).map((tag) => [tag, docks(tag)]),
      ),
    ).toEqual({
      DEU: 8,
      ITA: 9,
      JPN: 14,
      GBR: 20,
      FRA: 10,
      USA: 16,
      SUN: 8,
      NLD: 3,
      SWE: 2,
      ESR: 2,
      ESN: 2,
      CAN: 2,
      AUS: 2,
    });
  });

  test("the row table has a row per map row, its latitude falling southwards", () => {
    expect(v4.rows.latC.length).toBe(v4.height);
    expect(v4.rows.kmxMilli.length).toBe(v4.height);
    for (let y = 1; y < v4.height; y++) {
      expect(v4.rows.latC[y]).toBeLessThan(v4.rows.latC[y - 1]);
    }
  });
});
