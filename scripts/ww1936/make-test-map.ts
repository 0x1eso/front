// Builds tests/testdata/maps/ww1936mini (plan decision 17): a 200x120 World
// War 1936 test map. Land rows 0..99, an island at x 20..49, y 106..115,
// sea elsewhere. Run: npx tsx scripts/ww1936/make-test-map.ts
// Version 2 (P1 plan Task 1): every region has its economy; `coastal` comes
// from the tiles. Version 3 (P2 plan Task 1, the "test map v3" table): the
// land graph (edges with border, km, rivers and the Lyon–London strait),
// each region's terrain, rail, fort, port, latitude and weather cell, the
// countries' development, the sea-zone edge and kmPerTile 4. map.bin,
// regions.bin, the minimaps and manifest.json stay byte for byte the same.
// P3 (plan decision 22): `--variant pol` writes tests/testdata/maps/ww1936pol
// instead — the same map plus nine island regions in the southern sea band
// (y 102..117: Austria 11–12, Czechoslovakia 13–15, Lithuania 16–17,
// Estonia 18–19), the plan's "test map ww1936pol" table. The default output
// does not change.
// P4 (plan decision 29): `--variant sea` writes tests/testdata/maps/ww1936sea
// — the same land and regions 1–10, the southern sea band split into four
// zones (West 40001, Middle 40002, Narrows 40004, East 40003), the Isthmus
// (11, Turkey) between the Narrows and the East Sea and Malta (12, Britain),
// the sea edges with a date line, a strait and a canal, five strategic
// regions and the v4 bases (scenario version 4): the plan's "test map
// ww1936sea" table, which the script checks before it writes.
// P5 (plan decision 31): `--variant end` writes tests/testdata/maps/ww1936end
// — the pol variant (regions 1–19, edges, zones, kmPerTile, dev, version:
// the same code) plus one island region 20 "Kosice" (Czechoslovakia) east
// of Slovakia and the edge 15–20, the plan's "test map ww1936end" table.
// P6 (plan Task 1 Step 19): `--variant deep` writes tests/testdata/maps/
// ww1936deep — the sea variant byte for byte (tiles, regions 1–12, edges,
// zones, strategic regions, bases) plus the scenario v5 fields of the P6
// plan's "test map ww1936deep" table: coal, uranium, hydro, landmarks and
// two dams (Möhne at Munich over Berlin, Dnipro at Kiev over the Isthmus).
import {
  CATEGORY_SLOTS,
  RegionCategory,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { LandTerrain } from "@openfront/engine-api/ww1936/LandTypes";
import type { ScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { encodeRegions } from "@openfront/engine-lib/ww1936/Regions";
import { weatherCell } from "@openfront/engine-lib/ww1936/Weather";
import fs from "fs";
import path from "path";

const W = 200;
const H = 120;
const variantAt = process.argv.indexOf("--variant");
/** P5: the end variant is the pol variant plus Kosice. */
const END = variantAt >= 0 && process.argv[variantAt + 1] === "end";
const POL = END || (variantAt >= 0 && process.argv[variantAt + 1] === "pol");
/** P6: the deep variant is the sea variant plus the v5 fields. */
const DEEP = variantAt >= 0 && process.argv[variantAt + 1] === "deep";
const SEA = DEEP || (variantAt >= 0 && process.argv[variantAt + 1] === "sea");
const NAME = END
  ? "ww1936end"
  : POL
    ? "ww1936pol"
    : DEEP
      ? "ww1936deep"
      : SEA
        ? "ww1936sea"
        : "ww1936mini";

/** P6 (deep variant): the plan's "test map ww1936deep" table, by region. */
const DEEP_V5: Readonly<
  Record<
    number,
    {
      coal?: number;
      uranium?: number;
      hydro?: number;
      landmarks?: (
        | "lm_eiffel"
        | "lm_brandenburg"
        | "lm_colosseum"
        | "lm_kremlin"
        | "lm_westminster"
      )[];
      dam?: { id: "dam_mohne" | "dam_dnipro"; downstream: number[] };
    }
  >
> = {
  1: { coal: 2, landmarks: ["lm_eiffel"] },
  2: { uranium: 2, hydro: 2 },
  3: { coal: 4, landmarks: ["lm_brandenburg"] },
  4: { coal: 1, hydro: 2, dam: { id: "dam_mohne", downstream: [3] } },
  5: { hydro: 3, landmarks: ["lm_colosseum"] },
  6: { coal: 1 },
  7: { coal: 2, uranium: 1 },
  8: { coal: 1, landmarks: ["lm_kremlin"] },
  9: { coal: 2, dam: { id: "dam_dnipro", downstream: [11] } },
  10: { coal: 3, landmarks: ["lm_westminster"] },
};
const OUT = path.join(process.cwd(), `tests/testdata/maps/${NAME}`);

/** P3 islands (pol variant): [x0, x1) × [y0, y1), the plan's table. */
const POL_BOXES: Box[] = [
  [55, 70, 102, 118],
  [70, 80, 102, 118],
  [80, 90, 102, 118],
  [90, 105, 102, 118],
  [105, 115, 102, 118],
  [125, 132, 102, 118],
  [132, 145, 102, 118],
  [155, 170, 102, 118],
  [170, 180, 102, 118],
];
const inBox = ([x0, x1, y0, y1]: Box, x: number, y: number) =>
  x >= x0 && x < x1 && y >= y0 && y < y1;
/** P5 (end variant): Kosice, east of Slovakia (the plan's table). */
const KOSICE_BOX: Box = [115, 122, 102, 118];

/** P4 (sea variant): the Isthmus and Malta, [x0, x1) × [y0, y1). */
const ISTHMUS_BOX: Box = [140, 144, 100, 120];
const MALTA_BOX: Box = [100, 102, 110, 112];

const isLand = (x: number, y: number) =>
  y < 100 ||
  (x >= 20 && x < 50 && y >= 106 && y < 116) ||
  (POL && POL_BOXES.some((b) => inBox(b, x, y))) ||
  (END && inBox(KOSICE_BOX, x, y)) ||
  (SEA && (inBox(ISTHMUS_BOX, x, y) || inBox(MALTA_BOX, x, y)));

type Box = [number, number, number, number]; // x0, x1, y0, y1 (end exclusive)
/** [oil, aluminium, rubber, tungsten, steel, chromium] (RESOURCE_IDS order). */
type Res = [number, number, number, number, number, number];
interface Economy {
  cat: RegionCategory;
  pop: number;
  infra: number;
  core: boolean;
  civ: number;
  mil: number;
  dock: number;
  res: Res;
}
// P1 economy per region (plan Task 1 Step 13, with the pre-flight rulings):
// populations at 1936 scale (Germany 67 million: 1,675,000 recruitable
// under limited conscription), so every major starts with manpower; Munich
// steel 40 and London tungsten 20, so there is something to sell. Docks only
// in coastal regions: Paris's moved to Lyon, and Germany has no coast here.
const ECONOMY: Record<number, Economy> = {
  1: {
    cat: "metropolis",
    pop: 25000,
    infra: 4,
    core: true,
    civ: 5,
    mil: 3,
    dock: 0,
    res: [0, 4, 0, 0, 0, 0],
  },
  2: {
    cat: "city",
    pop: 17000,
    infra: 4,
    core: true,
    civ: 3,
    mil: 2,
    dock: 1,
    res: [0, 0, 0, 0, 20, 0],
  },
  3: {
    cat: "metropolis",
    pop: 40000,
    infra: 5,
    core: true,
    civ: 5,
    mil: 3,
    dock: 0,
    res: [0, 6, 0, 0, 0, 0],
  },
  4: {
    cat: "large_city",
    pop: 27000,
    infra: 5,
    core: true,
    civ: 4,
    mil: 3,
    dock: 0,
    res: [1, 0, 0, 0, 40, 0],
  },
  5: {
    cat: "large_city",
    pop: 43000,
    infra: 3,
    core: true,
    civ: 4,
    mil: 3,
    dock: 1,
    res: [0, 2, 0, 0, 4, 0],
  },
  6: {
    cat: "city",
    pop: 20000,
    infra: 3,
    core: true,
    civ: 3,
    mil: 1,
    dock: 0,
    res: [0, 0, 0, 0, 0, 0],
  },
  7: {
    cat: "town",
    pop: 14000,
    infra: 3,
    core: true,
    civ: 1,
    mil: 1,
    dock: 0,
    res: [1, 0, 0, 0, 8, 0],
  },
  8: {
    cat: "metropolis",
    pop: 90000,
    infra: 3,
    core: true,
    civ: 5,
    mil: 4,
    dock: 0,
    res: [0, 4, 0, 0, 10, 0],
  },
  9: {
    cat: "large_city",
    pop: 75000,
    infra: 3,
    core: true,
    civ: 4,
    mil: 3,
    dock: 0,
    res: [8, 0, 0, 1, 30, 4],
  },
  10: {
    cat: "metropolis",
    pop: 47000,
    infra: 4,
    core: true,
    civ: 5,
    mil: 2,
    dock: 3,
    res: [2, 4, 20, 20, 20, 6],
  },
};

const REGIONS: {
  id: number;
  name: string;
  nameKo: string;
  owner: "FRA" | "DEU" | "ITA" | "POL" | "SUN" | "GBR" | "TUR" | PolTag;
  vp: number;
  box: Box;
  /** The VP tile and center when not the box's middle (sea variant). */
  at?: [number, number];
  island?: string;
}[] = [
  {
    id: 1,
    name: "Paris",
    nameKo: "파리",
    owner: "FRA",
    vp: 21,
    box: [0, 40, 0, 50],
  },
  {
    id: 2,
    name: "Lyon",
    nameKo: "리옹",
    owner: "FRA",
    vp: 3,
    box: [0, 40, 50, 100],
  },
  {
    id: 3,
    name: "Berlin",
    nameKo: "베를린",
    owner: "DEU",
    vp: 21,
    box: [40, 90, 0, 35],
  },
  {
    id: 4,
    name: "Munich",
    nameKo: "뮌헨",
    owner: "DEU",
    vp: 4,
    box: [40, 90, 35, 70],
  },
  {
    id: 5,
    name: "Rome",
    nameKo: "로마",
    owner: "ITA",
    vp: 21,
    box: [40, 90, 70, 100],
  },
  {
    id: 6,
    name: "Warsaw",
    nameKo: "바르샤바",
    owner: "POL",
    vp: 21,
    box: [90, 120, 0, 50],
  },
  {
    id: 7,
    name: "Krakow",
    nameKo: "크라쿠프",
    owner: "POL",
    vp: 3,
    box: [90, 120, 50, 100],
  },
  {
    id: 8,
    name: "Moscow",
    nameKo: "모스크바",
    owner: "SUN",
    vp: 21,
    box: [120, 200, 0, 50],
  },
  {
    id: 9,
    name: "Kiev",
    nameKo: "키이우",
    owner: "SUN",
    vp: 6,
    box: [120, 200, 50, 100],
  },
  {
    id: 10,
    name: "London",
    nameKo: "런던",
    owner: "GBR",
    vp: 21,
    box: [20, 50, 106, 116],
  },
];
type PolTag = "AUT" | "CSK" | "LTU" | "EST";
/** P3's nine islands (pol variant): the plan's "test map ww1936pol" table. */
const POL_REGIONS: (typeof REGIONS)[number][] = [
  {
    id: 11,
    name: "Vienna",
    nameKo: "빈",
    owner: "AUT",
    vp: 15,
    box: POL_BOXES[0],
  },
  {
    id: 12,
    name: "Tyrol",
    nameKo: "티롤",
    owner: "AUT",
    vp: 2,
    box: POL_BOXES[1],
  },
  {
    id: 13,
    name: "Sudetenland",
    nameKo: "주데텐란트",
    owner: "CSK",
    vp: 3,
    box: POL_BOXES[2],
  },
  {
    id: 14,
    name: "Prague",
    nameKo: "프라하",
    owner: "CSK",
    vp: 15,
    box: POL_BOXES[3],
  },
  {
    id: 15,
    name: "Slovakia",
    nameKo: "슬로바키아",
    owner: "CSK",
    vp: 2,
    box: POL_BOXES[4],
  },
  {
    id: 16,
    name: "Memel",
    nameKo: "메멜",
    owner: "LTU",
    vp: 2,
    box: POL_BOXES[5],
  },
  {
    id: 17,
    name: "Kaunas",
    nameKo: "카우나스",
    owner: "LTU",
    vp: 15,
    box: POL_BOXES[6],
  },
  {
    id: 18,
    name: "Tallinn",
    nameKo: "탈린",
    owner: "EST",
    vp: 15,
    box: POL_BOXES[7],
  },
  {
    id: 19,
    name: "Tartu",
    nameKo: "타르투",
    owner: "EST",
    vp: 2,
    box: POL_BOXES[8],
  },
];
const NO_RES: Res = [0, 0, 0, 0, 0, 0];
const polEconomy = (
  cat: RegionCategory,
  pop: number,
  infra: number,
  civ: number,
  mil: number,
): Economy => ({ cat, pop, infra, core: true, civ, mil, dock: 0, res: NO_RES });
const POL_ECONOMY: Record<number, Economy> = {
  11: polEconomy("city", 7000, 4, 2, 1),
  12: polEconomy("rural", 1500, 2, 0, 0),
  13: polEconomy("town", 3000, 3, 1, 1),
  14: polEconomy("city", 7000, 4, 2, 2),
  15: polEconomy("rural", 3000, 2, 1, 0),
  16: polEconomy("town", 600, 2, 0, 0),
  17: polEconomy("town", 2400, 2, 1, 0),
  18: polEconomy("town", 1100, 2, 1, 0),
  19: polEconomy("rural", 500, 1, 0, 0),
};
if (POL) {
  REGIONS.push(...POL_REGIONS);
  Object.assign(ECONOMY, POL_ECONOMY);
}
// P5 (end variant): the plan's "test map ww1936end" table.
if (END) {
  REGIONS.push({
    id: 20,
    name: "Kosice",
    nameKo: "코시체",
    owner: "CSK",
    vp: 3,
    box: KOSICE_BOX,
  });
  Object.assign(ECONOMY, { 20: polEconomy("town", 1500, 2, 1, 0) });
}
// P4 (sea variant): the plan's "test map ww1936sea" table.
if (SEA) {
  REGIONS.push(
    {
      id: 11,
      name: "Isthmus",
      nameKo: "지협",
      owner: "TUR",
      vp: 0,
      box: ISTHMUS_BOX,
      at: [141, 109],
    },
    {
      id: 12,
      name: "Malta",
      nameKo: "몰타",
      owner: "GBR",
      vp: 5,
      box: MALTA_BOX,
      at: [100, 110],
      island: "malta",
    },
  );
  Object.assign(ECONOMY, {
    11: {
      cat: "rural",
      pop: 1000,
      infra: 2,
      core: true,
      civ: 1,
      mil: 0,
      dock: 0,
      res: NO_RES,
    },
    12: {
      cat: "town",
      pop: 250,
      infra: 2,
      core: false,
      civ: 0,
      mil: 0,
      dock: 0,
      res: NO_RES,
    },
  } satisfies Record<number, Economy>);
}

// P2 (the plan's test-map v3 table): terrain, start rail and fort, port,
// latitude of the real city (hundredths of a degree) and its weather cell.
interface Land {
  land: LandTerrain;
  rail: number;
  fort: number;
  port: boolean;
  latC: number;
  wcell: number;
}
const LAND: Record<number, Land> = {
  1: { land: "plains", rail: 2, fort: 2, port: false, latC: 4880, wcell: 378 },
  2: { land: "hills", rail: 1, fort: 0, port: true, latC: 4480, wcell: 378 },
  3: { land: "plains", rail: 3, fort: 0, port: false, latC: 5250, wcell: 415 },
  4: { land: "forest", rail: 2, fort: 0, port: false, latC: 4810, wcell: 379 },
  5: {
    land: "mountain",
    rail: 1,
    fort: 0,
    port: false,
    latC: 4190,
    wcell: 379,
  },
  6: { land: "plains", rail: 1, fort: 0, port: false, latC: 5220, wcell: 416 },
  7: { land: "hills", rail: 0, fort: 0, port: false, latC: 5000, wcell: 416 },
  8: { land: "plains", rail: 2, fort: 0, port: false, latC: 5570, wcell: 417 },
  9: { land: "plains", rail: 1, fort: 0, port: false, latC: 5040, wcell: 417 },
  10: { land: "plains", rail: 2, fort: 0, port: true, latC: 5150, wcell: 414 },
};
// P3 islands: the real cities' latitude and longitude (hundredths of a
// degree); a region without its own city takes its capital's.
const VIENNA = [4820, 1640] as const;
const PRAGUE = [5010, 1440] as const;
const KAUNAS = [5490, 2390] as const;
const TALLINN = [5940, 2480] as const;
const polLand = (
  land: LandTerrain,
  rail: number,
  fort: number,
  [latC, lonC]: readonly [number, number],
): Land => ({
  land,
  rail,
  fort,
  port: false,
  latC,
  wcell: weatherCell(lonC, latC),
});
if (SEA) {
  // P2 `port`: Lyon, Rome, Kiev, London and Malta (the plan's table).
  LAND[5] = { ...LAND[5], port: true };
  LAND[9] = { ...LAND[9], port: true };
  Object.assign(LAND, {
    11: { ...polLand("plains", 0, 0, [4100, 2898]), port: false },
    12: { ...polLand("plains", 0, 0, [3590, 1450]), port: true },
  });
}
if (POL) {
  Object.assign(LAND, {
    11: polLand("hills", 2, 0, VIENNA),
    12: polLand("mountain", 1, 0, VIENNA),
    13: polLand("hills", 1, 2, PRAGUE),
    14: polLand("plains", 2, 0, PRAGUE),
    15: polLand("mountain", 1, 0, PRAGUE),
    16: polLand("plains", 1, 0, KAUNAS),
    17: polLand("plains", 1, 0, KAUNAS),
    18: polLand("plains", 1, 0, TALLINN),
    19: polLand("forest", 0, 0, TALLINN),
  });
}
if (END) LAND[20] = polLand("hills", 1, 0, PRAGUE);
/** Industrialisation (P2 plan decision 14): Poland 1, so it starts small. */
const DEV: Record<string, number> = {
  DEU: 5,
  ITA: 3,
  GBR: 5,
  FRA: 4,
  SUN: 3,
  POL: 1,
  // P3 islands (pol variant).
  ...(POL ? { AUT: 2, CSK: 3, LTU: 1, EST: 1 } : {}),
  // P4 (sea variant).
  ...(SEA ? { TUR: 2 } : {}),
};
/** Hand-drawn rivers on edges ("a-b": 1 small, 2 big) and the straits. */
const RIVERS: Record<string, 1 | 2> = { "6-8": 1, "7-9": 2 };
const STRAITS = ["2-10"];
const KM_PER_TILE = 4;
/** The plan's 16 edges [a, b, border, km, river, strait]: the script checks its own. */
const EXPECTED_EDGES: [number, number, number, number, number, number][] = [
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
/** The pol variant's 6 island edges [a, b, border]; km is computed. */
const POL_EDGES: [number, number, number][] = [
  [11, 12, 16],
  [12, 13, 16],
  [13, 14, 16],
  [14, 15, 16],
  // P5 (end variant): Slovakia–Kosice.
  ...(END ? ([[15, 20, 16]] as [number, number, number][]) : []),
  [16, 17, 16],
  [18, 19, 16],
];

const SEAS = SEA
  ? [
      { id: 40001, name: "West Sea", nameKo: "서해", x0: 0, x1: 60 },
      { id: 40002, name: "Middle Sea", nameKo: "중해", x0: 60, x1: 110 },
      { id: 40004, name: "Narrows", nameKo: "좁은 바다", x0: 110, x1: 140 },
      { id: 40003, name: "East Sea", nameKo: "동해", x0: 144, x1: 200 },
    ]
  : [
      { id: 40001, name: "North Sea", nameKo: "북해", x0: 0, x1: 100 },
      { id: 40002, name: "Black Sea", nameKo: "흑해", x0: 100, x1: 200 },
    ];
/** P4 (sea variant): v4 fields of the zones (the plan's table). */
const SEA_V4: Record<
  number,
  { center: [number, number]; latC: number; wcell: number; sr: number }
> = {
  40001: { center: [10, 110], latC: 5000, wcell: 414, sr: 1001 },
  40002: { center: [85, 110], latC: 4200, wcell: 379, sr: 1002 },
  40004: { center: [125, 110], latC: 4200, wcell: 380, sr: 1002 },
  40003: { center: [170, 110], latC: 4500, wcell: 381, sr: 1003 },
};
const CAPITALS: Record<string, [number, number]> = {
  FRA: [20, 25],
  DEU: [65, 17],
  ITA: [65, 85],
  POL: [105, 25],
  SUN: [160, 25],
  GBR: [35, 110],
  // P3 islands (pol variant): each capital is its VP tile.
  ...(POL
    ? {
        AUT: [62, 110] as [number, number],
        CSK: [97, 110] as [number, number],
        LTU: [138, 110] as [number, number],
        EST: [162, 110] as [number, number],
      }
    : {}),
  // P4 (sea variant).
  ...(SEA ? { TUR: [141, 109] as [number, number] } : {}),
};

function grid(w: number, h: number, land: (x: number, y: number) => boolean) {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) g[y * w + x] = land(x, y) ? 1 : 0;
  return g;
}

/** Half size, water wins (map_generator.go createMiniMap). */
function half(g: Uint8Array, w: number, h: number) {
  const hw = w / 2;
  const hh = h / 2;
  const out = new Uint8Array(hw * hh).fill(1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (g[y * w + x] === 0) out[(y >> 1) * hw + (x >> 1)] = 0;
  return out;
}

/** map.bin bytes: bit7 land, bit6 shoreline, bit5 ocean, bits0-4 magnitude. */
function pack(g: Uint8Array, w: number, h: number) {
  const n = w * h;
  const dist = new Int32Array(n).fill(-1);
  const queue: number[] = [];
  const nb = (i: number) => {
    const x = i % w;
    const out: number[] = [];
    if (i >= w) out.push(i - w);
    if (x > 0) out.push(i - 1);
    if (x < w - 1) out.push(i + 1);
    if (i < n - w) out.push(i + w);
    return out;
  };
  const shore = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    shore[i] = nb(i).some((j) => g[j] !== g[i]) ? 1 : 0;
    if (g[i] === 0 && shore[i] === 1) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const j of nb(i)) {
      if (g[j] === 0 && dist[j] === -1) {
        dist[j] = dist[i] + 1;
        queue.push(j);
      }
    }
  }
  const bytes = new Uint8Array(n);
  let land = 0;
  for (let i = 0; i < n; i++) {
    if (g[i] === 1) {
      bytes[i] = 0x80 | (shore[i] ? 0x40 : 0);
      land++;
    } else {
      bytes[i] =
        (shore[i] ? 0x40 : 0) |
        0x20 |
        Math.min(31, Math.ceil(Math.max(0, dist[i]) / 2));
    }
  }
  return { bytes, land };
}

const full = grid(W, H, isLand);
const g4 = half(full, W, H);
const g16 = half(g4, W / 2, H / 2);
const m1 = pack(full, W, H);
const m4 = pack(g4, W / 2, H / 2);
const m16 = pack(g16, W / 4, H / 4);

const ids = new Uint16Array(W * H);
const tiles = new Map<number, number>();
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let id: number;
    if (isLand(x, y)) {
      const r = REGIONS.find(
        ({ box: [x0, x1, y0, y1] }) => x >= x0 && x < x1 && y >= y0 && y < y1,
      );
      if (r === undefined) throw new Error(`land (${x},${y}) has no region`);
      id = r.id;
    } else if (POL && y > 100) {
      // The pol variant's islands touch the North Sea only (the rows the
      // mainland touches keep their zones).
      id = SEAS[0].id;
    } else {
      id = SEAS.find((s) => x >= s.x0 && x < s.x1)!.id;
    }
    ids[y * W + x] = id;
    tiles.set(id, (tiles.get(id) ?? 0) + 1);
  }
}

// A region is coastal when one of its tiles touches a sea-zone tile.
const coastal = new Set<number>();
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const id = ids[y * W + x];
    if (id >= SEA_ZONE_BASE) continue;
    const touches = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ].some(
      ([nx, ny]) =>
        nx >= 0 &&
        nx < W &&
        ny >= 0 &&
        ny < H &&
        ids[ny * W + nx] >= SEA_ZONE_BASE,
    );
    if (touches) coastal.add(id);
  }
}
for (const r of REGIONS) {
  const e = ECONOMY[r.id];
  if (e.civ + e.mil + e.dock > CATEGORY_SLOTS[e.cat]) {
    throw new Error(`${r.name}: more factories than ${e.cat} slots`);
  }
  if (e.dock > 0 && !coastal.has(r.id)) {
    throw new Error(`${r.name}: a dockyard in a region without a coast`);
  }
}

const vpTileOf = (r: (typeof REGIONS)[number]): [number, number] =>
  r.at ?? [(r.box[0] + r.box[1]) >> 1, (r.box[2] + r.box[3]) >> 1];

// The land edges (P2 spec §3.2): one right/down pass counts the 4-neighbour
// tile pairs of two different land regions; km from the centers.
const borders = new Map<string, number>();
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const a = ids[y * W + x];
    const pairs: number[] = [];
    if (x + 1 < W) pairs.push(ids[y * W + x + 1]);
    if (y + 1 < H) pairs.push(ids[(y + 1) * W + x]);
    for (const b of pairs) {
      if (a === b || a >= SEA_ZONE_BASE || b >= SEA_ZONE_BASE) continue;
      const k = `${Math.min(a, b)}-${Math.max(a, b)}`;
      borders.set(k, (borders.get(k) ?? 0) + 1);
    }
  }
}
for (const k of STRAITS) borders.set(k, borders.get(k) ?? 0);
const center = new Map(REGIONS.map((r) => [r.id, vpTileOf(r)]));
const edges: [number, number, number, number, number, number][] = [...borders]
  .map(([k, border]): [number, number, number, number, number, number] => {
    const [a, b] = k.split("-").map(Number);
    const [ax, ay] = center.get(a)!;
    const [bx, by] = center.get(b)!;
    const km = Math.round(
      KM_PER_TILE * Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2),
    );
    return [a, b, border, km, RIVERS[k] ?? 0, STRAITS.includes(k) ? 1 : 0];
  })
  .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
const mainland = edges.filter(([a, b]) => a <= 10 && b <= 10);
const islands = edges.filter(([a, b]) => a > 10 || b > 10);
if (JSON.stringify(mainland) !== JSON.stringify(EXPECTED_EDGES)) {
  throw new Error(
    `test map edges differ from the plan's table:\n${JSON.stringify(edges)}`,
  );
}
const islandPairs = islands.map(([a, b, border, , river, strait]) => [
  a,
  b,
  border,
  river,
  strait,
]);
const expectedIslands = (
  POL ? POL_EDGES : SEA ? ([[9, 11, 4]] as [number, number, number][]) : []
).map(([a, b, border]) => [a, b, border, 0, 0]);
if (JSON.stringify(islandPairs) !== JSON.stringify(expectedIslands)) {
  throw new Error(
    `island edges differ from the plan's table:\n${JSON.stringify(islands)}`,
  );
}

// ---- P4 (sea variant): harbors, bases, strategic regions, checks ----

/** Spec §3.5: each region's harbor zone (most 4-neighbour tile pairs, ties smaller id); 0 none. */
function harborOf(region: number): number {
  const pairs = new Map<number, number>();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ids[y * W + x] !== region) continue;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const z = ids[ny * W + nx];
        if (z >= SEA_ZONE_BASE) pairs.set(z, (pairs.get(z) ?? 0) + 1);
      }
    }
  }
  let best = 0;
  let bestN = 0;
  for (const [z, n] of [...pairs].sort((a, b) => a[0] - b[0])) {
    if (n > bestN) {
      best = z;
      bestN = n;
    }
  }
  return best;
}
/** The plan's tables (tests/ww1936/seaFixture.ts exports the same values). */
const SEA_HARBOR: Record<number, number> = {
  2: 40001,
  5: 40002,
  7: 40002,
  9: 40003,
  10: 40001,
  11: 40003,
  12: 40002,
};
const SEA_NAVAL_BASE: Record<number, number> = {
  10: 6,
  5: 3,
  9: 2,
  2: 1,
  12: 1,
};
const SEA_AIR_BASE: Record<number, number> = { 3: 2, 10: 2, 5: 1 };
const SEA_WATER: Record<number, number> = {
  40001: 900,
  40002: 996,
  40004: 600,
  40003: 1120,
};
const SEA_CONVOYS: Record<string, number> = {
  FRA: 65,
  ITA: 35,
  GBR: 35,
  SUN: 80,
  POL: 30,
  TUR: 5,
  DEU: 0,
};
const WEST_LAND = [1, 2, 3, 4, 5, 10];
if (SEA) {
  for (const r of REGIONS) {
    const h = harborOf(r.id);
    if (h !== (SEA_HARBOR[r.id] ?? 0)) {
      throw new Error(
        `${r.name}: harbor ${h}, the table says ${SEA_HARBOR[r.id] ?? 0}`,
      );
    }
  }
  const e911 = edges.find(([a, b]) => a === 9 && b === 11);
  if (e911 === undefined || e911[3] !== 156) {
    throw new Error(
      `edge 9-11: ${JSON.stringify(e911)}, the table says km 156`,
    );
  }
  for (const [z, n] of Object.entries(SEA_WATER)) {
    if (tiles.get(Number(z)) !== n) {
      throw new Error(
        `zone ${z}: ${tiles.get(Number(z))} water tiles, the table says ${n}`,
      );
    }
  }
  for (const [tag, n] of Object.entries(SEA_CONVOYS)) {
    const own = REGIONS.filter((r) => r.owner === tag);
    const coast = own.some((r) => harborOf(r.id) !== 0);
    const civMil = own.reduce(
      (s, r) => s + ECONOMY[r.id].civ + ECONOMY[r.id].mil,
      0,
    );
    if ((coast ? civMil * 5 : 0) !== n) {
      throw new Error(
        `${tag}: ${coast ? civMil * 5 : 0} convoys, the table says ${n}`,
      );
    }
  }
}

const scenario: ScenarioData = {
  version: DEEP ? 5 : SEA ? 4 : 3,
  width: W,
  height: H,
  countries: Object.entries(CAPITALS).map(([tag, capital]) => ({
    tag: tag as ScenarioData["countries"][number]["tag"],
    capital,
    dev: DEV[tag],
  })),
  regions: REGIONS.map((r) => ({
    id: r.id,
    name: r.name,
    nameKo: r.nameKo,
    owner: r.owner,
    vp: r.vp,
    vpTile: vpTileOf(r),
    tiles: tiles.get(r.id)!,
    terrain: "plains" as const,
    ...ECONOMY[r.id],
    coastal: coastal.has(r.id),
    land: LAND[r.id].land,
    center: vpTileOf(r),
    latC: LAND[r.id].latC,
    wcell: LAND[r.id].wcell,
    rail: LAND[r.id].rail,
    fort: LAND[r.id].fort,
    port: LAND[r.id].port,
    ...(r.island === undefined ? {} : { island: r.island }),
    ...(SEA
      ? {
          sr: WEST_LAND.includes(r.id) ? 1 : 2,
          harbor: SEA_HARBOR[r.id] ?? 0,
          navalBase: SEA_NAVAL_BASE[r.id] ?? 0,
          airBase: SEA_AIR_BASE[r.id] ?? 0,
          aa: r.id === 10 ? 1 : 0,
          coastalFort: r.id === 10 ? 1 : 0,
        }
      : {}),
    // P6 (deep variant): scenario v5.
    ...(DEEP ? (DEEP_V5[r.id] ?? {}) : {}),
  })),
  seaZones: SEAS.map((s) => ({
    id: s.id,
    name: s.name,
    nameKo: s.nameKo,
    tiles: tiles.get(s.id)!,
    ...(SEA ? SEA_V4[s.id] : {}),
  })),
  edges,
  seaEdges: SEA
    ? [
        [40001, 40002, 300, 0],
        // The date line: the West Sea meets x = 0, the East Sea x = 199.
        [40001, 40003, 240, 3],
        [40002, 40004, 160, 1],
        [40003, 40004, 60, 2],
      ]
    : [[40001, 40002, 400, 0]],
  straits: SEA
    ? [
        { id: "narrows", kind: "strait", a: 40002, b: 40004, shore: [7] },
        { id: "isthmus_canal", kind: "canal", a: 40003, b: 40004, shore: [11] },
      ]
    : [],
  kmPerTile: KM_PER_TILE,
  ...(SEA
    ? {
        strategic: [
          {
            id: 1,
            kind: "land" as const,
            name: "West",
            nameKo: "서부",
            center: [65, 52] as [number, number],
            latC: 4810,
            members: WEST_LAND,
          },
          {
            id: 2,
            kind: "land" as const,
            name: "East",
            nameKo: "동부",
            center: [105, 75] as [number, number],
            latC: 5000,
            members: [6, 7, 8, 9, 11, 12],
          },
          {
            id: 1001,
            kind: "sea" as const,
            name: "Western Approaches",
            nameKo: "서부 접근로",
            center: [10, 110] as [number, number],
            latC: 5000,
            members: [40001],
          },
          {
            id: 1002,
            kind: "sea" as const,
            name: "Central Waters",
            nameKo: "중앙 해역",
            center: [85, 110] as [number, number],
            latC: 4200,
            members: [40002, 40004],
          },
          {
            id: 1003,
            kind: "sea" as const,
            name: "Eastern Waters",
            nameKo: "동부 해역",
            center: [170, 110] as [number, number],
            latC: 4500,
            members: [40003],
          },
        ],
      }
    : {}),
};

const manifest = {
  name: NAME,
  map: { width: W, height: H, num_land_tiles: m1.land },
  map4x: { width: W / 2, height: H / 2, num_land_tiles: m4.land },
  map16x: { width: W / 4, height: H / 4, num_land_tiles: m16.land },
  nations: [],
  ww1936: true,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "map.bin"), m1.bytes);
fs.writeFileSync(path.join(OUT, "map4x.bin"), m4.bytes);
fs.writeFileSync(path.join(OUT, "map16x.bin"), m16.bytes);
fs.writeFileSync(path.join(OUT, "regions.bin"), encodeRegions(ids, W, H));
fs.writeFileSync(
  path.join(OUT, "scenario.json"),
  JSON.stringify(scenario, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(OUT, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`${NAME}: ${m1.land} land tiles, ${REGIONS.length} regions`);
