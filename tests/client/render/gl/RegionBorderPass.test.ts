import type { Config } from "@openfront/engine-lib/configuration/Config";
import { describe, expect, test, vi } from "vitest";
import { MapRenderer } from "../../../../src/client/render/gl/MapRenderer";
import {
  RegionBorderPass,
  regionEdgeMask,
} from "../../../../src/client/render/gl/passes/RegionBorderPass";
import type { RenderSettings } from "../../../../src/client/render/gl/RenderSettings";
import type { RendererConfig } from "../../../../src/client/render/types";

// MapRenderer's GPU renderer, recording the region ids each one is given.
const stub = vi.hoisted(() => ({ regions: [] as Uint16Array[] }));
vi.mock("../../../../src/client/render/gl/Renderer", () => ({
  GPURenderer: class {
    dispose() {}
    resize() {}
    setRegions(ids: Uint16Array) {
      stub.regions.push(ids);
    }
  },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function countingGL() {
  const counts = { draws: 0, uploads: 0, deletes: 0 };
  const gl = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "drawArrays") return () => counts.draws++;
        if (prop === "texImage2D") return () => counts.uploads++;
        if (prop === "deleteTexture") return () => counts.deletes++;
        if (prop === "getProgramParameter") return () => true;
        if (prop === "getShaderParameter") return () => true;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, counts };
}

describe("RegionBorderPass (spec §8.2)", () => {
  test("marks land-land edges, never the coast or between sea zones (spec §4.6)", () => {
    // 4x3: two land regions over two sea zones.
    const ids = Uint16Array.from([
      1, 1, 2, 2, 1, 1, 2, 2, 40001, 40001, 40002, 40002,
    ]);
    expect([...regionEdgeMask(ids, 4, 3)]).toEqual([
      0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
    ]);
  });

  test("a sea zone next to a land region draws no line either", () => {
    // 2x2: land region 1 | sea zone 40001, over sea zone 40002 | 40001.
    const ids = Uint16Array.from([1, 40001, 40002, 40001]);
    expect([...regionEdgeMask(ids, 2, 2)]).toEqual([0, 0, 0, 0]);
  });

  test("tiles outside every region (id 0) draw no line", () => {
    // 3x2: region 1 | nothing | region 2, over region 1 | 2 | 2.
    const ids = Uint16Array.from([1, 0, 2, 1, 2, 2]);
    expect([...regionEdgeMask(ids, 3, 2)]).toEqual([0, 0, 0, 1, 0, 0]);
  });

  test("hidden when zoomed out, drawn when zoomed in", () => {
    const { gl, counts } = countingGL();
    const pass = new RegionBorderPass(gl, Uint16Array.from([1, 2, 1, 2]), 2, 2);
    expect(counts.uploads).toBe(1);
    pass.draw(new Float32Array(9), 0.5);
    pass.draw(new Float32Array(9), 1);
    expect(counts.draws).toBe(0);
    pass.draw(new Float32Array(9), 4);
    expect(counts.draws).toBe(1);
    pass.dispose();
    expect(counts.deletes).toBe(1);
  });

  test("the map renderer hands the ids on again after a context restore", () => {
    const canvas = document.createElement("canvas");
    const view = new MapRenderer(
      canvas,
      { players: [] } as unknown as RendererConfig,
      () => new Uint8Array(0),
      new Float32Array(0),
      {} as Config,
      {} as RenderSettings,
    );
    const ids = Uint16Array.from([1, 2, 1, 2]);
    view.setRegions(ids);
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(stub.regions).toEqual([ids, ids]);
    view.dispose();
  });
});
