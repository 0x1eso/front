// World War 1936 P2 Task 7: the region flags RegionBorderPass uploads (spec
// §15.2) — the chosen army's front, the enemy regions across it, the
// encircled regions of the viewer's side and the border regions front mode
// lets you pick — on the test map ww1936mini (smallIDs and edges: plan
// "test map v3"), plus the pass's texture handling and the context restore.
import {
  ArmySummary,
  idleOrder,
  RegionLandData,
  WwLandData,
} from "@openfront/engine-api/ww1936/LandTypes";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import type { Config } from "@openfront/engine-lib/configuration/Config";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { describe, expect, test, vi } from "vitest";
import { WwLandSelection } from "../../../src/client/hud/ww1936/LandSelection";
import { LandAtlas } from "../../../src/client/render/gl/LandAtlas";
import { MapRenderer } from "../../../src/client/render/gl/MapRenderer";
import {
  FLAG_ENCIRCLED,
  FLAG_ENEMY,
  FLAG_FRONT,
  FLAG_PICKABLE,
  FLAG_TEX_SIZE,
  flagIndex,
  RegionBorderPass,
  regionEdgeMask,
  regionFlagBytes,
  regionTileCodes,
  sameLandSide,
  TILE_EDGE_BIT,
} from "../../../src/client/render/gl/passes/RegionBorderPass";
import type { RenderSettings } from "../../../src/client/render/gl/RenderSettings";
import type { RendererConfig } from "../../../src/client/render/types";
import { WwLandView } from "../../../src/client/view/WwLandView";

// MapRenderer's GPU renderer, recording what the land war hands it.
const stub = vi.hoisted(() => ({ land: [] as unknown[][] }));
vi.mock("../../../src/client/render/gl/Renderer", () => ({
  GPURenderer: class {
    dispose() {}
    resize() {}
    setRegions() {}
    setWwLand(...args: unknown[]) {
      stub.land.push(args);
    }
  },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const MINI = path.join(__dirname, "../../testdata/maps/ww1936mini");
const scenario = ScenarioIndex.fromFiles(
  ScenarioDataSchema.parse(
    JSON.parse(fs.readFileSync(path.join(MINI, "scenario.json"), "utf8")),
  ),
  new Uint8Array(fs.readFileSync(path.join(MINI, "regions.bin"))),
);
const DEU = scenario.smallIdOf("DEU");
const ITA = scenario.smallIdOf("ITA");
const FRA = scenario.smallIdOf("FRA");
const POL = scenario.smallIdOf("POL");
// Regions (plan table): 1 Paris, 2 Lyon (FRA), 3 Berlin, 4 Munich (DEU),
// 5 Rome (ITA), 6 Warsaw, 7 Krakow (POL), 8 Moscow, 9 Kiev (SUN), 10 London.
// Germany is at war with Poland only.
const atWarWithPoland = (id: number) => id === POL;

function army(over: Partial<ArmySummary> = {}): ArmySummary {
  return {
    id: 1,
    owner: DEU,
    nameNo: 1,
    general: 0,
    divisions: 6,
    strengthPm: 1000,
    orgPm: 1000,
    state: 0,
    region: 3,
    move: null,
    sum: {
      divisions: 6,
      width: 0,
      soft: 0,
      hard: 0,
      def: 0,
      brk: 0,
      armor: 0,
      pierce: 0,
      hardnessPm: 0,
      orgMilli: 0,
      hpMilli: 0,
    },
    symbol: 0,
    mine: null,
    ...over,
  };
}

function mineWith(front: number[], over = {}) {
  return {
    order: { ...idleOrder(), kind: "front" as const, anchor: front[0] ?? 0 },
    front,
    planBp: 0,
    auto: false,
    path: [],
    supplyPm: 1000,
    etaTicks: -1,
    paraLastDay: -1,
    ...over,
  };
}

function region(id: number, over: Partial<RegionLandData> = {}) {
  return {
    id,
    controller: scenario.ownerByRegion()[id],
    supplyMilli: 0,
    useMilli: 0,
    encircled: false,
    counts: [],
    ...over,
  };
}

function viewWith(over: Partial<WwLandData>): WwLandView {
  const v = new WwLandView(scenario);
  v.apply(
    {
      armies: [],
      removedArmies: [],
      battles: [],
      endedBattles: [],
      regions: [],
      countries: [],
      details: [],
      ...over,
    },
    0,
  );
  return v;
}

function chosen(armyId: number | null, mode?: WwLandSelection["mode"]) {
  const s = new WwLandSelection();
  s.select(armyId);
  if (mode !== undefined) s.setMode(mode);
  return s;
}

/** Regions 1..10 whose flag has `bit`. */
function withBit(flags: Uint8Array, bit: number): number[] {
  const out: number[] = [];
  for (let r = 1; r <= 10; r++)
    if ((flags[flagIndex(r)] & bit) !== 0) out.push(r);
  return out;
}

describe("regionFlagBytes (spec §15.2)", () => {
  test("the chosen army's front regions, and the enemy regions across them", () => {
    const v = viewWith({ armies: [army({ mine: mineWith([3, 4]) })] });
    const flags = regionFlagBytes(v, chosen(1), DEU, [], atWarWithPoland);
    expect(flags.length).toBe(FLAG_TEX_SIZE * FLAG_TEX_SIZE);
    expect(withBit(flags, FLAG_FRONT)).toEqual([3, 4]);
    // Berlin–Warsaw, Munich–Warsaw, Munich–Krakow; not Paris (France is
    // not at war), not Rome (an ally).
    expect(withBit(flags, FLAG_ENEMY)).toEqual([6, 7]);
    expect(withBit(flags, FLAG_PICKABLE)).toEqual([]);
  });

  test("a front against one enemy marks only that enemy's regions", () => {
    const front = mineWith([4]);
    front.order.enemy = POL;
    const atWarWithBoth = (id: number) => id === POL || id === FRA;
    const v = viewWith({ armies: [army({ mine: front })] });
    const flags = regionFlagBytes(v, chosen(1), DEU, [], atWarWithBoth);
    expect(withBit(flags, FLAG_ENEMY)).toEqual([6, 7]);
    front.order.enemy = 0;
    const all = regionFlagBytes(v, chosen(1), DEU, [], atWarWithBoth);
    expect(withBit(all, FLAG_ENEMY)).toEqual([1, 2, 6, 7]);
  });

  test("the front preview replaces the army's front while front mode previews one", () => {
    const v = viewWith({ armies: [army({ mine: mineWith([3, 4]) })] });
    const flags = regionFlagBytes(
      v,
      chosen(1, "front"),
      DEU,
      [3],
      atWarWithPoland,
    );
    expect(withBit(flags, FLAG_FRONT)).toEqual([3]);
    expect(withBit(flags, FLAG_ENEMY)).toEqual([6]);
  });

  test("encircled regions of the viewer's side, its faction included", () => {
    const v = viewWith({
      regions: [
        region(4, { encircled: true }), // Germany's own
        region(5, { encircled: true }), // Italy: the Axis, our side
        region(6, { encircled: true }), // Poland's: not ours
      ],
    });
    const flags = regionFlagBytes(v, chosen(null), DEU, [], atWarWithPoland);
    expect(withBit(flags, FLAG_ENCIRCLED)).toEqual([4, 5]);
    expect(sameLandSide(scenario, DEU, ITA)).toBe(true);
    expect(sameLandSide(scenario, DEU, POL)).toBe(false);
  });

  test("front mode lights the border regions a front can be given to", () => {
    const v = viewWith({ armies: [army({ mine: mineWith([]) })] });
    const flags = regionFlagBytes(
      v,
      chosen(1, "front"),
      DEU,
      [],
      atWarWithPoland,
    );
    // Our side's regions touching Poland: Berlin, Munich, and Italy's Rome
    // (Rome–Krakow).
    expect(withBit(flags, FLAG_PICKABLE)).toEqual([3, 4, 5]);
    const none = regionFlagBytes(
      v,
      chosen(1, "plan"),
      DEU,
      [],
      atWarWithPoland,
    );
    expect(withBit(none, FLAG_PICKABLE)).toEqual([]);
  });

  test("another country's chosen army flags nothing but the encirclements", () => {
    const v = viewWith({
      armies: [army({ owner: POL, region: 6, mine: mineWith([6]) })],
      regions: [region(3, { encircled: true })],
    });
    const flags = regionFlagBytes(
      v,
      chosen(1, "front"),
      DEU,
      [],
      atWarWithPoland,
    );
    expect(withBit(flags, FLAG_FRONT | FLAG_ENEMY | FLAG_PICKABLE)).toEqual([]);
    expect(withBit(flags, FLAG_ENCIRCLED)).toEqual([3]);
  });

  test("region id -> texel (id % 200, floor(id / 200)), the out array reused", () => {
    expect(flagIndex(1087)).toBe(5 * FLAG_TEX_SIZE + 87);
    const v = viewWith({ armies: [army({ mine: mineWith([3]) })] });
    const out = new Uint8Array(FLAG_TEX_SIZE * FLAG_TEX_SIZE).fill(255);
    expect(regionFlagBytes(v, chosen(1), DEU, [], atWarWithPoland, out)).toBe(
      out,
    );
    expect(withBit(out, FLAG_FRONT)).toEqual([3]);
    expect(out[flagIndex(9)]).toBe(0);
  });
});

function countingGL() {
  const counts = { draws: 0, texImage: 0, texSub: 0, deletes: 0, programs: 0 };
  const gl = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "drawArrays") return () => counts.draws++;
        if (prop === "texImage2D") return () => counts.texImage++;
        if (prop === "texSubImage2D") return () => counts.texSub++;
        if (prop === "deleteTexture") return () => counts.deletes++;
        if (prop === "createProgram") {
          return () => {
            counts.programs++;
            return {};
          };
        }
        if (prop === "getProgramParameter") return () => true;
        if (prop === "getShaderParameter") return () => true;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, counts };
}

describe("RegionBorderPass flags", () => {
  test("tile codes: the edge bit over the land region id; sea zones are 0", () => {
    // 4x3: two land regions over two sea zones.
    const ids = Uint16Array.from([
      1, 1, 2, 2, 1, 1, 2, 2, 40001, 40001, 40002, 40002,
    ]);
    const codes = regionTileCodes(ids, 4, 3);
    const edges = regionEdgeMask(ids, 4, 3);
    expect([...codes].map((c) => (c & TILE_EDGE_BIT ? 1 : 0))).toEqual([
      ...edges,
    ]);
    expect([...codes].map((c) => c & 0x7fff)).toEqual([
      1, 1, 2, 2, 1, 1, 2, 2, 0, 0, 0, 0,
    ]);
  });

  test("no texture and no program until a flag is set; then one draw a frame", () => {
    const { gl, counts } = countingGL();
    const pass = new RegionBorderPass(gl, Uint16Array.from([1, 2, 1, 2]), 2, 2);
    expect(counts.texImage).toBe(1); // the tile codes
    const programs = counts.programs;
    const flags = new Uint8Array(FLAG_TEX_SIZE * FLAG_TEX_SIZE);
    pass.setRegionFlags(flags); // all zero: nothing to make
    pass.drawFlags(new Float32Array(9), 0.25, 0, {} as WebGLTexture, 1);
    expect(counts.texImage).toBe(1);
    expect(counts.draws).toBe(0);
    flags[flagIndex(2)] = FLAG_FRONT;
    pass.setRegionFlags(flags);
    expect(counts.texImage).toBe(2);
    expect(pass.hasFlags).toBe(true);
    pass.drawFlags(new Float32Array(9), 0.25, 0, {} as WebGLTexture, 1);
    expect(counts.programs).toBe(programs + 1);
    expect(counts.draws).toBe(1);
    flags.fill(0);
    pass.setRegionFlags(flags); // cleared: a sub-upload, no more drawing
    expect(counts.texSub).toBe(1);
    pass.drawFlags(new Float32Array(9), 0.25, 0, {} as WebGLTexture, 1);
    expect(counts.draws).toBe(1);
    pass.dispose();
    expect(counts.deletes).toBe(2);
  });

  test("the atlas falls back to one clear texel without a 2D canvas", () => {
    const { gl, counts } = countingGL();
    const atlas = new LandAtlas(gl, () => null);
    expect(counts.texImage).toBe(1);
    atlas.dispose();
    expect(counts.deletes).toBe(1);
  });

  test("the map renderer hands the land war on again after a context restore", () => {
    const canvas = document.createElement("canvas");
    const view = new MapRenderer(
      canvas,
      { players: [] } as unknown as RendererConfig,
      () => new Uint8Array(0),
      new Float32Array(0),
      {} as Config,
      {} as RenderSettings,
    );
    const land = viewWith({});
    const sel = new WwLandSelection();
    const me = () => DEU;
    view.setWwLand(land, sel, me, atWarWithPoland);
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(stub.land).toEqual([
      [land, sel, me, atWarWithPoland],
      [land, sel, me, atWarWithPoland],
    ]);
    view.dispose();
  });
});
