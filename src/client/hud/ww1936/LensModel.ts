// World War 1936 w14: the map lenses. One lens colours the land regions by
// one kind of fact (terrain, victory points, weather, supply, defence,
// resources, industry, occupation, diplomacy). The cells go to the
// occupation pass (a region -> colour table), rebuilt only when what the
// lens shows changed. Every value on land the player has no intel on goes
// through the fog model first: a hidden value never becomes a colour.
//
// The legend and the tap readout live here too, so the screens only draw.
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  LAND_TERRAINS,
  WEATHERS,
  type LandTerrain,
  type Weather,
} from "@openfront/engine-api/ww1936/LandTypes";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { paddyWet, riverFrozen } from "@openfront/engine-lib/imjin/LandRules";
import {
  IMJIN_TERRAINS,
  edgeBetween,
  hasImjinTerrain,
  regionTerrain,
  type ImjinEdge,
  type ImjinTerrain,
} from "@openfront/engine-lib/imjin/Terrain";
import { dateOfDay } from "@openfront/engine-lib/ww1936/Calendar";
import { regionSlots } from "@openfront/engine-lib/ww1936/EconomyRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import {
  OCC_BLINK,
  OCC_HATCH,
  type OccupationCell,
  type OccupationSource,
} from "../../render/gl/passes/OccupationPass";
import type { PlaceLabel } from "../../render/gl/passes/WorldTextPass";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { slotPctOfCountry } from "./EconomyModel";
import {
  occRegionLine,
  occupationCells,
  occupationChip,
  occupationMapSource,
  occupationModeOf,
} from "./EndgameModel";
import { fogModelOf, type FogModel } from "./FogModel";
import {
  landSidesOf,
  levelBoxes,
  levelDots,
  regionName,
  type LandSides,
} from "./LandModel";
import { ideologyName, lostVpPct, politicsInput } from "./PoliticsModel";
import {
  LENS_RESOURCES,
  REGION_LENSES,
  type RegionLens,
  type SeaAirSelection,
} from "./SeaAirSelection";
import { countryName, factionName, isKoreanUi, today } from "./WorldWarModel";
import { wwEpoch } from "./WwClientCalendar";

export type Rgb = readonly [number, number, number];

/** The lens settings a source reads (SeaAirSelection holds them). */
export type LensSettings = Pick<
  SeaAirSelection,
  "layer" | "regionLens" | "lensResource" | "lensDiplo" | "version"
>;

// ---- Translation keys (spelled out: the translation scan reads literals) ----

export const LENS_NAME_KEYS: Readonly<
  Record<RegionLens | "sea" | "air", string>
> = {
  sea: "ww1936.lens.name.sea",
  air: "ww1936.lens.name.air",
  terrain: "ww1936.lens.name.terrain",
  vp: "ww1936.lens.name.vp",
  weather: "ww1936.lens.name.weather",
  supply: "ww1936.lens.name.supply",
  defence: "ww1936.lens.name.defence",
  resources: "ww1936.lens.name.resources",
  industry: "ww1936.lens.name.industry",
  occupation: "ww1936.lens.name.occupation",
  diplomacy: "ww1936.lens.name.diplomacy",
};

export const LENS_HINT_KEYS: Readonly<
  Record<RegionLens | "sea" | "air", string>
> = {
  sea: "ww1936.lens.hint.sea",
  air: "ww1936.lens.hint.air",
  terrain: "ww1936.lens.hint.terrain",
  vp: "ww1936.lens.hint.vp",
  weather: "ww1936.lens.hint.weather",
  supply: "ww1936.lens.hint.supply",
  defence: "ww1936.lens.hint.defence",
  resources: "ww1936.lens.hint.resources",
  industry: "ww1936.lens.hint.industry",
  occupation: "ww1936.lens.hint.occupation",
  diplomacy: "ww1936.lens.hint.diplomacy",
};

const TERRAIN_KEYS: Readonly<Record<LandTerrain, string>> = {
  plains: "ww1936.terrain.plains",
  forest: "ww1936.terrain.forest",
  hills: "ww1936.terrain.hills",
  mountain: "ww1936.terrain.mountain",
  marsh: "ww1936.terrain.marsh",
  jungle: "ww1936.terrain.jungle",
  desert: "ww1936.terrain.desert",
  urban: "ww1936.terrain.urban",
};

// The Imjin map's region classes (ww175 design §4): the name and the
// short words of what each does to a battle.
const IMJIN_TERRAIN_KEYS: Readonly<Record<ImjinTerrain, string>> = {
  plain: "ww1936.imjin.terrain.plain",
  paddy: "ww1936.imjin.terrain.paddy",
  hills: "ww1936.imjin.terrain.hills",
  forest: "ww1936.imjin.terrain.forest",
  mountain: "ww1936.imjin.terrain.mountain",
  pass: "ww1936.imjin.terrain.pass",
  marsh: "ww1936.imjin.terrain.marsh",
  walled: "ww1936.imjin.terrain.walled",
  fortress: "ww1936.imjin.terrain.fortress",
};

const IMJIN_WORDS_KEYS: Readonly<Record<ImjinTerrain, string>> = {
  plain: "ww1936.imjin.words.plain",
  paddy: "ww1936.imjin.words.paddy",
  hills: "ww1936.imjin.words.hills",
  forest: "ww1936.imjin.words.forest",
  mountain: "ww1936.imjin.words.mountain",
  pass: "ww1936.imjin.words.pass",
  marsh: "ww1936.imjin.words.marsh",
  walled: "ww1936.imjin.words.walled",
  fortress: "ww1936.imjin.words.fortress",
};

const IMJIN_EDGE_KEYS: Readonly<Record<Exclude<ImjinEdge, "none">, string>> = {
  small_river: "ww1936.imjin.edge.small_river",
  great_river: "ww1936.imjin.edge.great_river",
  ford: "ww1936.imjin.edge.ford",
};

const WEATHER_KEYS: Readonly<Record<Weather, string>> = {
  clear: "ww1936.weather.clear",
  rain: "ww1936.weather.rain",
  mud: "ww1936.weather.mud",
  snow: "ww1936.weather.snow",
  frozen: "ww1936.weather.frozen",
  heat: "ww1936.weather.heat",
};

const RES_KEYS: Readonly<Record<(typeof LENS_RESOURCES)[number], string>> = {
  oil: "ww1936.res.oil",
  aluminium: "ww1936.res.aluminium",
  rubber: "ww1936.res.rubber",
  tungsten: "ww1936.res.tungsten",
  steel: "ww1936.res.steel",
  chromium: "ww1936.res.chromium",
  uranium: "ww1936.res.uranium",
  coal: "ww1936.res.coal",
};

// ---- Colours (bright enough to read through the map's dark tones) ----

export const TERRAIN_RGB: Readonly<Record<LandTerrain, Rgb>> = {
  plains: [226, 220, 110],
  forest: [74, 168, 72],
  hills: [190, 128, 66],
  mountain: [214, 218, 226],
  marsh: [90, 176, 210],
  jungle: [20, 150, 112],
  desert: [240, 172, 64],
  urban: [236, 96, 134],
};

/** The Imjin map's region classes on the terrain lens. */
export const IMJIN_TERRAIN_RGB: Readonly<Record<ImjinTerrain, Rgb>> = {
  plain: [226, 220, 110],
  paddy: [96, 204, 188],
  hills: [190, 128, 66],
  forest: [52, 150, 64],
  mountain: [214, 218, 226],
  pass: [255, 72, 72],
  marsh: [90, 150, 236],
  walled: [236, 96, 134],
  fortress: [168, 92, 214],
};

export const WEATHER_RGB: Readonly<Record<Weather, Rgb>> = {
  clear: [250, 226, 140],
  rain: [74, 144, 236],
  mud: [150, 98, 52],
  snow: [232, 240, 250],
  frozen: [120, 226, 250],
  heat: [255, 112, 48],
};

const RES_RGB: Readonly<Record<(typeof LENS_RESOURCES)[number], Rgb>> = {
  oil: [245, 166, 35],
  aluminium: [205, 216, 230],
  rubber: [198, 108, 216],
  tungsten: [64, 214, 208],
  steel: [122, 162, 255],
  chromium: [120, 226, 120],
  uranium: [212, 240, 60],
  coal: [176, 150, 130],
};

const GOOD: Rgb = [58, 200, 96];
const WARN: Rgb = [246, 186, 40];
const BAD: Rgb = [232, 66, 56];
export const UNKNOWN: Rgb = [128, 134, 150];
const NEUTRAL: Rgb = [158, 164, 176];

const VP_STEPS: readonly { min: number; rgb: Rgb; level: number }[] = [
  { min: 1, rgb: [250, 226, 140], level: 24 },
  { min: 4, rgb: [250, 184, 70], level: 30 },
  { min: 7, rgb: [244, 124, 50], level: 36 },
  { min: 12, rgb: [230, 62, 60], level: 42 },
  { min: 21, rgb: [190, 36, 150], level: 48 },
];

const DEFENCE_STEPS: readonly { min: number; rgb: Rgb; level: number }[] = [
  { min: 1, rgb: [150, 190, 255], level: 24 },
  { min: 3, rgb: [84, 140, 244], level: 32 },
  { min: 5, rgb: [128, 96, 240], level: 38 },
  { min: 7, rgb: [200, 70, 240], level: 44 },
];

const IND_MIL: Rgb = [236, 92, 70];
const IND_CIV: Rgb = [84, 152, 242];
const IND_DOCK: Rgb = [58, 204, 200];

const FACTION_RGB: Readonly<Record<string, Rgb>> = {
  allies: [74, 144, 240],
  axis: [214, 150, 66],
  comintern: [232, 70, 70],
};
const FACTION_EXTRA: readonly Rgb[] = [
  [170, 130, 250],
  [60, 204, 150],
  [244, 120, 190],
  [250, 210, 70],
  [60, 210, 236],
];
const IDEOLOGY_RGB: readonly Rgb[] = [
  [74, 144, 240],
  [232, 70, 70],
  [206, 140, 60],
  [158, 164, 176],
];

const LEVEL_UNKNOWN = 12;

// ---- Context ----

interface Ctx {
  game: GameView;
  s: ScenarioIndex;
  me: number;
  sides: LandSides;
  fog: FogModel;
  day: number;
}

function ctxOf(game: GameView): Ctx | null {
  const s = game.worldWarScenario();
  if (s === null) return null;
  return {
    game,
    s,
    me: game.myPlayer()?.smallID() ?? 0,
    sides: landSidesOf(game),
    fog: fogModelOf(game),
    day: today(game),
  };
}

function controllerOf(c: Ctx, id: number): number {
  return (
    c.game.wwLand?.()?.controller[id] ??
    c.game.wwEconomy?.()?.controller[id] ??
    c.s.ownerByRegion()[id] ??
    0
  );
}

/** The holder's side is mine (own, or allied: the fog shows them whole). */
function mineSide(c: Ctx, id: number): boolean {
  const h = controllerOf(c, id);
  return c.me > 0 && h > 0 && c.sides.sameSide(c.me, h);
}

/** Buildings and levels of this region are shown exact. */
function shownExact(c: Ctx, id: number): boolean {
  return c.fog.regionView(id).buildings === "exact";
}

function unknownCell(region: number): OccupationCell {
  return { region, rgb: UNKNOWN, level: LEVEL_UNKNOWN, flags: 0 };
}

function stepOf(
  steps: readonly { min: number; rgb: Rgb; level: number }[],
  v: number,
): { rgb: Rgb; level: number } | null {
  let out: { rgb: Rgb; level: number } | null = null;
  for (const st of steps) if (v >= st.min) out = st;
  return out;
}

const capitalCache = new WeakMap<ScenarioIndex, ReadonlySet<number>>();

/** The regions holding a country's scenario capital. */
export function capitalRegions(s: ScenarioIndex): ReadonlySet<number> {
  let set = capitalCache.get(s);
  if (set === undefined) {
    const out = new Set<number>();
    for (const tag of s.countries) {
      const tile = s.capitalTileOrNull(tag);
      if (tile === null) continue;
      const id = s.regionAt(tile);
      if (id > 0) out.add(id);
    }
    set = out;
    capitalCache.set(s, set);
  }
  return set;
}

/** Deposits of a region, RESOURCE_IDS order (the map's, public). */
function depositsOf(c: Ctx, id: number): number[] {
  const r = c.s.region(id);
  const now = c.game.wwEconomy?.()?.region(id);
  return RESOURCE_IDS.map((_, i) => (r?.res[i] ?? 0) + (now?.res?.[i] ?? 0));
}

function freeSlotsOf(c: Ctx, id: number): number {
  const econ = c.game.wwEconomy?.();
  const r = c.s.region(id);
  if (econ === null || econ === undefined || r === undefined) return 0;
  const used =
    econ.civ[id] +
    econ.mil[id] +
    econ.dock[id] +
    econ.refinery[id] +
    econ.silo[id] +
    econ.alloy[id] +
    econ.smelter[id] +
    (econ.facility[id] !== 0 ? 1 : 0) +
    econ.powerPlant[id];
  return Math.max(0, regionSlots(r.cat, slotPctOfCountry(econ, c.me)) - used);
}

function weatherIn(c: Ctx, id: number): Weather {
  return weatherAt(
    c.day,
    c.s.latC(id),
    c.s.landOf(id),
    c.s.wcell(id),
    wwEpoch(),
  );
}

/** Supply class of a region on my side: 0 none, 1 short, 2 enough; -1 unknown. */
export function supplyClass(supplyMilli: number, useMilli: number): number {
  if (supplyMilli < 0) return -1;
  if (supplyMilli === 0) return 0;
  return useMilli > supplyMilli ? 1 : 2;
}

// ---- Faction and ideology colours ----

function factionRgbOf(c: Ctx, holder: number): Rgb {
  const pol = c.game.wwPolitics?.();
  const idx = pol?.factionIdx(holder) ?? -1;
  if (idx < 0) return NEUTRAL;
  const f = pol?.global?.factions.find((x) => x.idx === idx);
  const named = f === undefined ? undefined : FACTION_RGB[f.key];
  return named ?? FACTION_EXTRA[idx % FACTION_EXTRA.length];
}

function ideologyOf(c: Ctx, holder: number): number {
  return c.game.wwPolitics?.()?.summary(holder)?.ruling ?? 3;
}

function napWith(c: Ctx, holder: number): boolean {
  const naps = c.game.wwPolitics?.()?.global?.naps ?? [];
  return naps.some(
    ([a, b]) => (a === c.me && b === holder) || (b === c.me && a === holder),
  );
}

// ---- The cells ----

/** The region cells of region lens `lens` (the occupation lens is the map mode's own). */
export function lensCells(game: GameView, sel: LensSettings): OccupationCell[] {
  const lens = sel.regionLens;
  if (lens === "none") return [];
  const c = ctxOf(game);
  if (c === null) return [];
  if (lens === "occupation") return occupationCells(game as never, c.me);
  const out: OccupationCell[] = [];
  const land = game.wwLand?.() ?? null;
  const econ = game.wwEconomy?.() ?? null;
  const caps = lens === "vp" ? capitalRegions(c.s) : null;
  const myVp = lens === "vp" ? lostVpSet(c) : null;
  for (const r of c.s.landRegions) {
    const id = r.id;
    switch (lens) {
      case "terrain":
        out.push({
          region: id,
          rgb: hasImjinTerrain(c.s)
            ? IMJIN_TERRAIN_RGB[regionTerrain(c.s, id)]
            : TERRAIN_RGB[c.s.landOf(id)],
          level: 40,
          flags: 0,
        });
        break;
      case "weather":
        out.push({
          region: id,
          rgb: WEATHER_RGB[weatherIn(c, id)],
          level: weatherIn(c, id) === "clear" ? 14 : 40,
          flags: 0,
        });
        break;
      case "vp": {
        const cap = caps!.has(id);
        const lost = myVp!.has(id);
        const st = stepOf(VP_STEPS, r.vp);
        if (st === null && !cap && !lost) break;
        out.push({
          region: id,
          rgb: st?.rgb ?? NEUTRAL,
          level: st?.level ?? 14,
          flags: (cap ? OCC_BLINK : 0) | (lost ? OCC_HATCH : 0),
        });
        break;
      }
      case "supply": {
        if (!mineSide(c, id)) break;
        const rl = land?.regions.get(id);
        if (rl === undefined) break;
        const cls = supplyClass(rl.supplyMilli, rl.useMilli);
        if (cls < 0) break;
        out.push({
          region: id,
          rgb: cls === 2 ? GOOD : cls === 1 ? WARN : BAD,
          level: 34,
          flags: rl.encircled ? OCC_BLINK : 0,
        });
        break;
      }
      case "defence": {
        if (econ === null) break;
        if (!shownExact(c, id)) {
          if (controllerOf(c, id) > 0) out.push(unknownCell(id));
          break;
        }
        const score =
          econ.effectiveBuildings("fort", id) +
          (land?.regions.get(id)?.pos ?? 0);
        const st = stepOf(DEFENCE_STEPS, score);
        if (st !== null) {
          out.push({ region: id, rgb: st.rgb, level: st.level, flags: 0 });
        }
        break;
      }
      case "resources": {
        const dep = depositsOf(c, id);
        let best = -1;
        let bestAmount = 0;
        RESOURCE_IDS.forEach((rid, i) => {
          if (sel.lensResource !== "" && sel.lensResource !== rid) return;
          if (dep[i] > bestAmount) {
            best = i;
            bestAmount = dep[i];
          }
        });
        if (best < 0) break;
        out.push({
          region: id,
          rgb: RES_RGB[RESOURCE_IDS[best] as (typeof LENS_RESOURCES)[number]],
          level: 20 + Math.min(24, bestAmount * 2),
          flags: 0,
        });
        break;
      }
      case "industry": {
        if (econ === null) break;
        const holder = controllerOf(c, id);
        if (holder === 0) break;
        if (!shownExact(c, id)) {
          out.push(unknownCell(id));
          break;
        }
        const civ = econ.civ[id];
        const mil = econ.mil[id];
        const dock = econ.dock[id];
        const free = holder === c.me ? freeSlotsOf(c, id) : 0;
        const total = civ + mil + dock;
        if (total === 0 && free === 0) break;
        const rgb: Rgb =
          mil >= civ && mil >= dock && mil > 0
            ? IND_MIL
            : civ >= dock && civ > 0
              ? IND_CIV
              : dock > 0
                ? IND_DOCK
                : NEUTRAL;
        out.push({
          region: id,
          rgb,
          level: total === 0 ? 14 : 22 + Math.min(20, total * 3),
          flags: free > 0 ? OCC_HATCH : 0,
        });
        break;
      }
      case "diplomacy": {
        const holder = controllerOf(c, id);
        if (holder === 0) break;
        const rgb =
          sel.lensDiplo === "ideology"
            ? IDEOLOGY_RGB[ideologyOf(c, holder)]
            : factionRgbOf(c, holder);
        const war = c.me > 0 && c.sides.isEnemy(c.me, holder);
        out.push({
          region: id,
          rgb,
          level: holder === c.me ? 42 : 30,
          flags:
            (war ? OCC_BLINK : 0) |
            (!war && napWith(c, holder) ? OCC_HATCH : 0),
        });
        break;
      }
    }
  }
  return out;
}

/** Regions whose legal owner is me and someone else holds now. */
function lostVpSet(c: Ctx): ReadonlySet<number> {
  const out = new Set<number>();
  const pol = c.game.wwPolitics?.();
  if (pol === null || pol === undefined || c.me <= 0) return out;
  for (const r of c.s.landRegions) {
    if (r.vp > 0 && pol.legalOwner[r.id] === c.me) {
      if (controllerOf(c, r.id) !== c.me) out.add(r.id);
    }
  }
  return out;
}

// ---- The map source (what GameRenderer hands the renderer) ----

function fnv(h: number, v: number): number {
  return Math.imul(h ^ (v & 0xffff), 16777619) ^ (v >>> 16);
}

/** A hash of the cells: equal cells, equal key (the pass packs only when it moves). */
export function cellsHash(cells: readonly OccupationCell[]): number {
  let h = 2166136261;
  for (const c of cells) {
    h = fnv(h, c.region);
    h = fnv(h, (c.rgb[0] << 16) | (c.rgb[1] << 8) | c.rgb[2]);
    h = fnv(h, (c.level << 4) | c.flags);
  }
  return h >>> 0;
}

/**
 * Keeps the occupation map mode (the band's chip) and the occupation lens
 * one switch: whichever moved last wins.
 */
function syncOccupation(
  game: GameView,
  sel: SeaAirSelection,
  seen: { mode: number; sel: number },
): void {
  const mode = occupationModeOf(game);
  if (mode.version !== seen.mode) {
    seen.mode = mode.version;
    if (mode.on) sel.setRegionLens("occupation");
    else if (sel.regionLens === "occupation") sel.setRegionLens("none");
    seen.sel = sel.version;
    return;
  }
  if (sel.version !== seen.sel) {
    seen.sel = sel.version;
    mode.set(sel.regionLens === "occupation");
    seen.mode = mode.version;
  }
}

/** How often the source rebuilt its cells (tests read it). */
export const lensStats = { builds: 0 };

/**
 * The renderer's source: on while a region lens shows. Its key is the
 * cells' content hash, worked out again only when an input moved (a view's
 * version, the day, the fog's stamp, the lens settings), so a quiet map
 * costs a few number compares per frame and no lens costs one.
 */
export function lensMapSource(
  game: GameView,
  sel: SeaAirSelection,
): OccupationSource {
  const occ = occupationMapSource(game as never);
  const seen = { mode: occupationModeOf(game).version, sel: sel.version };
  let inputs = "";
  let cells: readonly OccupationCell[] = [];
  let key = "";
  const lensOn = () => {
    syncOccupation(game, sel, seen);
    return sel.regionLens !== "none" && sel.layer === "none";
  };
  return {
    on: () => lensOn() || occ.on(),
    key: () => {
      if (!lensOn()) return "occ:" + occ.key();
      if (sel.regionLens === "occupation") return "occ:" + occ.key();
      const pol = game.wwPolitics?.();
      const next = [
        sel.regionLens,
        sel.lensResource,
        sel.lensDiplo,
        game.wwLand?.()?.version ?? 0,
        game.wwEconomy?.()?.version ?? 0,
        pol?.version ?? 0,
        game.myPlayer()?.smallID() ?? 0,
        today(game),
        sel.regionLens === "defence" ||
        sel.regionLens === "industry" ||
        sel.regionLens === "supply"
          ? fogModelOf(game).stamp()
          : 0,
      ].join(":");
      if (next === inputs) return key;
      inputs = next;
      lensStats.builds++;
      cells = lensCells(game, sel);
      key = `lens:${sel.regionLens}:${cellsHash(cells)}`;
      return key;
    },
    cells: () =>
      sel.regionLens === "occupation" || !lensOn() ? occ.cells() : cells,
  };
}

// ---- Legend ----

export interface LegendRow {
  rgb: Rgb | null;
  label: string;
  /** Extra line: a rule or a number. */
  detail?: string;
  /** "rim": the blinking rim; "hatch": stripes. */
  mark?: "rim" | "hatch";
}
export interface LensChip {
  id: string;
  label: string;
  active: boolean;
  rgb?: Rgb;
}
export interface LensLegend {
  title: string;
  rows: LegendRow[];
  notes: string[];
  chips: LensChip[];
  /** What the chips set: "resource" or "diplo". */
  chipKind: "resource" | "diplo" | null;
  /** VP lens: [surrender line %, my lost VP %]. */
  gauge?: [number, number];
}

/** The river edges' water colours (region-river.frag.glsl). */
export const IMJIN_EDGE_RGB: Readonly<Record<Exclude<ImjinEdge, "none">, Rgb>> =
  {
    great_river: [41, 92, 189],
    small_river: [82, 143, 219],
    ford: [158, 214, 245],
  };

function terrainRows(s: ScenarioIndex | null): LegendRow[] {
  if (s !== null && hasImjinTerrain(s)) {
    // ww177 I3b: the classes, then the river edges in their line colours.
    return [
      ...IMJIN_TERRAINS.map((t) => ({
        rgb: IMJIN_TERRAIN_RGB[t],
        label: translateText(IMJIN_TERRAIN_KEYS[t]),
      })),
      ...(["great_river", "small_river", "ford"] as const).map((e) => ({
        rgb: IMJIN_EDGE_RGB[e],
        label: translateText(`ww1936.imjin.legend.${e}`),
      })),
    ];
  }
  return LAND_TERRAINS.map((t) => ({
    rgb: TERRAIN_RGB[t],
    label: translateText(TERRAIN_KEYS[t]),
  }));
}

/** The game calendar's month (1-12) today: the paddies and rivers follow it. */
export function imjinMonth(game: Parameters<typeof today>[0]): number {
  return dateOfDay(today(game), wwEpoch()).month;
}

/** The Imjin map's region class name ("고개"). */
export function imjinTerrainName(s: ScenarioIndex, region: number): string {
  return translateText(IMJIN_TERRAIN_KEYS[regionTerrain(s, region)]);
}

/**
 * ww177 I3b (design §4 "Paddy by state", decision 8B): what the season does
 * to the region now: a paddy flooded or dry, a great river frozen. Null:
 * nothing changes with the month here.
 */
export function imjinSeasonLine(
  s: ScenarioIndex,
  region: number,
  month: number,
): string | null {
  if (regionTerrain(s, region) === "paddy") {
    return translateText(
      paddyWet(month, true)
        ? "ww1936.imjin.now.paddy_wet"
        : "ww1936.imjin.now.paddy_dry",
    );
  }
  if (!riverFrozen(month)) return null;
  for (const e of s.edgesOf(region)) {
    if (edgeBetween(s, region, e.to) === "great_river") {
      return translateText("ww1936.imjin.now.river_frozen");
    }
  }
  return null;
}

/**
 * The Imjin map's hover words for a region: its class and what it does, the
 * season's state when `month` (1-12) is given, then each river edge it has,
 * by neighbour ("임진: 여울: 한 번 건너며 −20%") unless `edges` is false.
 */
export function imjinTerrainLines(
  s: ScenarioIndex,
  region: number,
  month?: number,
  edges = true,
): string[] {
  const t = regionTerrain(s, region);
  const lines = [
    `${translateText(IMJIN_TERRAIN_KEYS[t])}: ${translateText(IMJIN_WORDS_KEYS[t])}`,
  ];
  const now = month === undefined ? null : imjinSeasonLine(s, region, month);
  if (now !== null) lines.push(now);
  if (!edges) return lines;
  for (const e of s.edgesOf(region)) {
    const kind = edgeBetween(s, region, e.to);
    if (kind === "none") continue;
    lines.push(
      translateText("ww1936.imjin.edge_line", {
        name: regionName(s, e.to),
        kind: translateText(IMJIN_EDGE_KEYS[kind]),
      }),
    );
  }
  return lines;
}

/**
 * The Imjin map's named places for WorldTextPass (ww175 design §4): passes
 * in the pass colour, fords and channels in the water's, in the UI's
 * language.
 */
export function imjinPlaceLabels(
  s: ScenarioIndex,
  korean = isKoreanUi(),
): PlaceLabel[] {
  const imjin = s.data.imjin;
  if (imjin === undefined) return [];
  return imjin.labels.map((l) => {
    const rgb: Rgb =
      l.kind === "pass" ? IMJIN_TERRAIN_RGB.pass : [150, 210, 250];
    return {
      x: l.x,
      y: l.y,
      text: korean ? l.nameKo : l.name,
      colorR: rgb[0] / 255,
      colorG: rgb[1] / 255,
      colorB: rgb[2] / 255,
    };
  });
}

function weatherRows(): LegendRow[] {
  return WEATHERS.map((w) => ({
    rgb: WEATHER_RGB[w],
    label: translateText(WEATHER_KEYS[w]),
  }));
}

/** The legend of the lens on (null when none, or sea and air, which have their own). */
export function lensLegend(
  game: GameView,
  sel: LensSettings,
): LensLegend | null {
  const lens = sel.regionLens;
  if (lens === "none") return null;
  const base = {
    title: translateText(LENS_NAME_KEYS[lens]),
    rows: [] as LegendRow[],
    notes: [] as string[],
    chips: [] as LensChip[],
    chipKind: null as LensLegend["chipKind"],
  };
  const c = ctxOf(game);
  switch (lens) {
    case "terrain": {
      const rows = terrainRows(c?.s ?? null);
      if (c === null || !hasImjinTerrain(c.s)) return { ...base, rows };
      // ww177 I3b: what the season does now, and where the words are.
      const notes = [translateText("ww1936.imjin.legend.tap")];
      const month = imjinMonth(game);
      notes.unshift(
        translateText(
          paddyWet(month, true)
            ? "ww1936.imjin.now.paddy_wet"
            : "ww1936.imjin.now.paddy_dry",
        ),
      );
      if (riverFrozen(month)) {
        notes.unshift(translateText("ww1936.imjin.now.river_frozen"));
      }
      return { ...base, rows, notes };
    }
    case "weather":
      return { ...base, rows: weatherRows() };
    case "vp": {
      const rows: LegendRow[] = VP_STEPS.map((st, i) => ({
        rgb: st.rgb,
        label:
          i === VP_STEPS.length - 1
            ? translateText("ww1936.lens.vp_from", { n: st.min })
            : translateText("ww1936.lens.vp_range", {
                a: st.min,
                b: VP_STEPS[i + 1].min - 1,
              }),
      }));
      rows.push({
        rgb: null,
        mark: "rim",
        label: translateText("ww1936.lens.vp_capital"),
      });
      rows.push({
        rgb: null,
        mark: "hatch",
        label: translateText("ww1936.lens.vp_lost"),
      });
      const input = politicsInput(game as never);
      const line = input?.view.summary(input.me)?.surrenderPct ?? null;
      const lost = input === null ? null : lostVpPct(input);
      return {
        ...base,
        rows,
        notes:
          line === null || lost === null
            ? []
            : [translateText("ww1936.lens.vp_gauge", { line, lost })],
        gauge: line === null || lost === null ? undefined : [line, lost],
      };
    }
    case "supply":
      return {
        ...base,
        rows: [
          { rgb: GOOD, label: translateText("ww1936.lens.supply_enough") },
          { rgb: WARN, label: translateText("ww1936.lens.supply_short") },
          { rgb: BAD, label: translateText("ww1936.lens.supply_none") },
          {
            rgb: null,
            mark: "rim",
            label: translateText("ww1936.lens.supply_encircled"),
          },
        ],
        notes: [translateText("ww1936.lens.supply_note")],
      };
    case "defence":
      return {
        ...base,
        rows: [
          ...DEFENCE_STEPS.map((st, i) => ({
            rgb: st.rgb,
            label:
              i === DEFENCE_STEPS.length - 1
                ? translateText("ww1936.lens.def_from", { n: st.min })
                : translateText("ww1936.lens.def_range", {
                    a: st.min,
                    b: DEFENCE_STEPS[i + 1].min - 1,
                  }),
          })),
          { rgb: UNKNOWN, label: translateText("ww1936.lens.unknown") },
        ],
        notes: [translateText("ww1936.lens.defence_note")],
      };
    case "resources":
      return {
        ...base,
        rows: LENS_RESOURCES.filter(
          (r) => sel.lensResource === "" || sel.lensResource === r,
        ).map((r) => ({ rgb: RES_RGB[r], label: translateText(RES_KEYS[r]) })),
        chipKind: "resource",
        chips: [
          {
            id: "",
            label: translateText("ww1936.lens.res_all"),
            active: sel.lensResource === "",
          },
          ...LENS_RESOURCES.map((r) => ({
            id: r,
            label: translateText(RES_KEYS[r]),
            active: sel.lensResource === r,
            rgb: RES_RGB[r],
          })),
        ],
      };
    case "industry":
      return {
        ...base,
        rows: [
          { rgb: IND_MIL, label: translateText("ww1936.lens.ind_mil") },
          { rgb: IND_CIV, label: translateText("ww1936.lens.ind_civ") },
          { rgb: IND_DOCK, label: translateText("ww1936.lens.ind_dock") },
          {
            rgb: null,
            mark: "hatch",
            label: translateText("ww1936.lens.ind_free"),
          },
          { rgb: UNKNOWN, label: translateText("ww1936.lens.unknown") },
        ],
      };
    case "occupation":
      return {
        ...base,
        rows: [
          { rgb: GOOD, label: translateText("ww1936.lens.occ_low") },
          { rgb: WARN, label: translateText("ww1936.lens.occ_mid") },
          { rgb: BAD, label: translateText("ww1936.lens.occ_high") },
          {
            rgb: null,
            mark: "hatch",
            label: translateText("ww1936.lens.occ_short"),
          },
          {
            rgb: null,
            mark: "rim",
            label: translateText("ww1936.lens.occ_uprising"),
          },
        ],
      };
    case "diplomacy": {
      const rows: LegendRow[] = [];
      if (sel.lensDiplo === "ideology") {
        IDEOLOGIES.forEach((_, i) =>
          rows.push({ rgb: IDEOLOGY_RGB[i], label: ideologyName(i) }),
        );
      } else if (c !== null) {
        const pol = game.wwPolitics?.();
        for (const f of pol?.global?.factions ?? []) {
          rows.push({
            rgb:
              FACTION_RGB[f.key] ?? FACTION_EXTRA[f.idx % FACTION_EXTRA.length],
            label: factionName(f.key, game as never),
          });
        }
        rows.push({
          rgb: NEUTRAL,
          label: translateText("ww1936.lens.no_faction"),
        });
      }
      rows.push({
        rgb: null,
        mark: "rim",
        label: translateText("ww1936.lens.dip_war"),
      });
      rows.push({
        rgb: null,
        mark: "hatch",
        label: translateText("ww1936.lens.dip_nap"),
      });
      return {
        ...base,
        rows,
        chipKind: "diplo",
        chips: [
          {
            id: "faction",
            label: translateText("ww1936.lens.dip_by_faction"),
            active: sel.lensDiplo === "faction",
          },
          {
            id: "ideology",
            label: translateText("ww1936.lens.dip_by_ideology"),
            active: sel.lensDiplo === "ideology",
          },
        ],
      };
    }
  }
}

// ---- The tap readout ----

export interface LensReadout {
  title: string;
  lines: string[];
}

function labelOf(c: Ctx, id: number, n: number): string {
  return c.fog.regionView(id).label(n);
}

function supplyWord(cls: number): string {
  return cls === 2
    ? translateText("ww1936.lens.supply_enough")
    : cls === 1
      ? translateText("ww1936.lens.supply_short")
      : translateText("ww1936.lens.supply_none");
}

/** What one region says under lens `sel`; null for a tap on no region. */
export function lensReadout(
  game: GameView,
  sel: LensSettings,
  region: number,
): LensReadout | null {
  const lens = sel.regionLens;
  const c = ctxOf(game);
  if (lens === "none" || c === null || c.s.region(region) === undefined) {
    return null;
  }
  const r = c.s.region(region)!;
  const title = regionName(c.s, region);
  const lines: string[] = [];
  const holder = controllerOf(c, region);
  const land = game.wwLand?.() ?? null;
  const econ = game.wwEconomy?.() ?? null;
  const exact = shownExact(c, region);
  switch (lens) {
    case "terrain": {
      if (hasImjinTerrain(c.s)) {
        lines.push(...imjinTerrainLines(c.s, region, imjinMonth(game)));
        break;
      }
      const t = c.s.landOf(region);
      lines.push(translateText(TERRAIN_KEYS[t]));
      break;
    }
    case "weather": {
      const w = weatherIn(c, region);
      lines.push(translateText(WEATHER_KEYS[w]));
      break;
    }
    case "vp": {
      lines.push(
        r.vp > 0
          ? translateText("ww1936.lens.vp_here", { n: r.vp })
          : translateText("ww1936.lens.vp_none"),
      );
      if (capitalRegions(c.s).has(region)) {
        lines.push(translateText("ww1936.lens.vp_is_capital"));
      }
      const legal = c.game.wwPolitics?.()?.legalOwner[region] ?? 0;
      if (legal > 0 && holder > 0 && legal !== holder) {
        lines.push(
          translateText("ww1936.lens.vp_held", {
            owner: ownerName(c, legal),
            holder: ownerName(c, holder),
          }),
        );
      }
      const input = politicsInput(game as never);
      const line = input?.view.summary(input.me)?.surrenderPct;
      if (input !== null && line !== undefined) {
        lines.push(
          translateText("ww1936.lens.vp_gauge", {
            line,
            lost: lostVpPct(input),
          }),
        );
      }
      break;
    }
    case "supply": {
      const rl = land?.regions.get(region);
      if (mineSide(c, region) && rl !== undefined) {
        const cls = supplyClass(rl.supplyMilli, rl.useMilli);
        if (cls >= 0) {
          lines.push(
            translateText("ww1936.lens.supply_line", {
              state: supplyWord(cls),
              have: Math.round(rl.supplyMilli / 1000),
              use: Math.round(Math.max(0, rl.useMilli) / 1000),
            }),
          );
        }
        if (rl.encircled) {
          lines.push(translateText("ww1936.lens.supply_encircled"));
        }
      } else {
        lines.push(translateText("ww1936.lens.supply_hidden"));
      }
      if (econ !== null) {
        lines.push(
          translateText("ww1936.lens.rail_infra", {
            rail: exact
              ? levelDots(econ.rail[region] ?? 0)
              : labelOf(c, region, econ.rail[region] ?? 0),
            infra: exact
              ? levelDots(econ.infra[region] ?? 0)
              : labelOf(c, region, econ.infra[region] ?? 0),
          }),
        );
      }
      break;
    }
    case "defence": {
      if (econ === null) break;
      if (!exact) {
        lines.push(
          translateText("ww1936.lens.def_line", {
            fort: labelOf(c, region, econ.effectiveBuildings("fort", region)),
            pos: "?",
          }),
        );
        break;
      }
      lines.push(
        translateText("ww1936.lens.def_line", {
          fort: levelBoxes(econ.effectiveBuildings("fort", region)),
          pos: levelBoxes(land?.regions.get(region)?.pos ?? 0, 3),
        }),
      );
      break;
    }
    case "resources": {
      const dep = depositsOf(c, region);
      const parts = RESOURCE_IDS.flatMap((rid, i) =>
        dep[i] > 0
          ? [
              `${translateText(RES_KEYS[rid as (typeof LENS_RESOURCES)[number]])} ${dep[i]}`,
            ]
          : [],
      );
      lines.push(
        parts.length === 0
          ? translateText("ww1936.lens.res_none")
          : parts.join(" · "),
      );
      break;
    }
    case "industry": {
      if (econ === null) break;
      lines.push(
        translateText("ww1936.lens.ind_line", {
          mil: labelOf(c, region, econ.mil[region]),
          civ: labelOf(c, region, econ.civ[region]),
          dock: labelOf(c, region, econ.dock[region]),
        }),
      );
      if (holder === c.me) {
        lines.push(
          translateText("ww1936.lens.ind_free_line", {
            n: freeSlotsOf(c, region),
          }),
        );
      }
      break;
    }
    case "occupation": {
      const line = occRegionLine(game as never, region, c.fog);
      lines.push(line ?? translateText("ww1936.lens.occ_none"));
      break;
    }
    case "diplomacy": {
      if (holder === 0) break;
      lines.push(ownerName(c, holder));
      const pol = c.game.wwPolitics?.();
      const fIdx = pol?.factionIdx(holder) ?? -1;
      const f = pol?.global?.factions.find((x) => x.idx === fIdx);
      lines.push(
        translateText("ww1936.lens.dip_line", {
          faction:
            f === undefined
              ? translateText("ww1936.lens.no_faction")
              : factionName(f.key, game as never),
          ideology: ideologyName(ideologyOf(c, holder)),
        }),
      );
      if (c.me > 0 && c.sides.isEnemy(c.me, holder)) {
        lines.push(translateText("ww1936.lens.dip_war"));
      } else if (napWith(c, holder)) {
        lines.push(translateText("ww1936.lens.dip_nap"));
      }
      break;
    }
  }
  return { title, lines };
}

function ownerName(c: Ctx, smallID: number): string {
  const tag = c.s.tagOfSmallId(smallID);
  return tag === undefined ? "" : countryName(tag);
}

/** The lens list's availability: the occupation lens needs land I administer. */
export function lensAvailable(
  game: GameView,
  lens: RegionLens | "sea" | "air",
): boolean {
  if (lens === "sea")
    return game.wwNavy?.() !== undefined && game.wwNavy?.() !== null;
  if (lens === "air")
    return game.wwAir?.() !== undefined && game.wwAir?.() !== null;
  if (lens === "occupation") return occupationChip(game as never) !== null;
  return true;
}

/** True when `lens` is a region lens (and not sea or air). */
export function isRegionLens(x: string): x is RegionLens {
  return (REGION_LENSES as readonly string[]).includes(x);
}
