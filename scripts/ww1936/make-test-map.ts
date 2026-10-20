// Builds tests/testdata/maps/ww1936mini (plan decision 17): a 200x120 World
// War 1936 test map. Land rows 0..99, an island at x 20..49, y 106..115,
// sea elsewhere. Run: npx tsx scripts/ww1936/make-test-map.ts
// Version 2 (P1 plan Task 1): every region has its economy; `coastal` comes
// from the tiles.
import {
  CATEGORY_SLOTS,
  RegionCategory,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { encodeRegions } from "@openfront/engine-lib/ww1936/Regions";
import fs from "fs";
import path from "path";

const W = 200;
const H = 120;
const OUT = path.join(process.cwd(), "tests/testdata/maps/ww1936mini");

const isLand = (x: number, y: number) =>
  y < 100 || (x >= 20 && x < 50 && y >= 106 && y < 116);

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
  owner: "FRA" | "DEU" | "ITA" | "POL" | "SUN" | "GBR";
  vp: number;
  box: Box;
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
const SEAS = [
  { id: 40001, name: "North Sea", nameKo: "북해", x0: 0, x1: 100 },
  { id: 40002, name: "Black Sea", nameKo: "흑해", x0: 100, x1: 200 },
];
const CAPITALS: Record<string, [number, number]> = {
  FRA: [20, 25],
  DEU: [65, 17],
  ITA: [65, 85],
  POL: [105, 25],
  SUN: [160, 25],
  GBR: [35, 110],
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

const scenario: ScenarioData = {
  version: 2,
  width: W,
  height: H,
  countries: Object.entries(CAPITALS).map(([tag, capital]) => ({
    tag: tag as ScenarioData["countries"][number]["tag"],
    capital,
  })),
  regions: REGIONS.map((r) => ({
    id: r.id,
    name: r.name,
    nameKo: r.nameKo,
    owner: r.owner,
    vp: r.vp,
    vpTile: [(r.box[0] + r.box[1]) >> 1, (r.box[2] + r.box[3]) >> 1] as [
      number,
      number,
    ],
    tiles: tiles.get(r.id)!,
    terrain: "plains" as const,
    ...ECONOMY[r.id],
    coastal: coastal.has(r.id),
  })),
  seaZones: SEAS.map((s) => ({
    id: s.id,
    name: s.name,
    nameKo: s.nameKo,
    tiles: tiles.get(s.id)!,
  })),
};

const manifest = {
  name: "ww1936mini",
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
console.log(`ww1936mini: ${m1.land} land tiles, ${REGIONS.length} regions`);
