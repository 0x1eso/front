// World War 1936 P6 lane U4 (plan Task 13): the strike effects ask only for
// drawing calls, never write a tile, and keep their flash on the edges.
import { describe, expect, it } from "vitest";
import {
  edgeWeight,
  FLASH_INNER,
  FLASH_MS,
  FLASH_PEAK,
  flashAlpha,
  FLIGHT_MS,
  pulseBrightness,
  StrikeFxSinks,
  WwStrikeFxPass,
} from "../../../src/client/render/gl/passes/WwStrikeFxPass";
import { WwDepthView } from "../../../src/client/view/WwDepthView";

function harness(me = 2) {
  const calls: string[] = [];
  const flashes: number[] = [];
  const sinks: StrikeFxSinks = {
    regionXY: (r, out) => {
      out.x = r * 10;
      out.y = r * 5;
      return true;
    },
    ownerOf: () => 2,
    flight: () => calls.push("flight"),
    atomSprite: () => calls.push("atomSprite"),
    shockwave: () => calls.push("shockwave"),
    ring: () => calls.push("ring"),
    stream: () => calls.push("stream"),
    miniExplosion: () => calls.push("miniExplosion"),
    pulse: () => calls.push("pulse"),
    light: () => calls.push("light"),
    edgeFlash: (a) => flashes.push(a),
    sound: (name, loud) => calls.push(`sound:${name}:${loud}`),
    cameraSees: () => true,
  };
  const view = new WwDepthView();
  const pass = new WwStrikeFxPass(view, sinks, () => me);
  const push = (kind: "nuke" | "rocket" | "raid" | "dam") =>
    view.apply({
      fx: [{ kind, region: 3, from: 1, owner: 1, tick: 0 }],
      news: [],
    });
  return { calls, flashes, pass, push };
}

describe("WwStrikeFxPass", () => {
  it("a nuke timeline calls exactly the planned sinks, in order, once each", () => {
    const h = harness();
    h.push("nuke");
    h.pass.update(0);
    h.pass.update(FLIGHT_MS - 1);
    expect(h.calls).toEqual(["flight"]);
    h.pass.update(FLIGHT_MS + 10);
    expect(h.calls.filter((c) => c !== "pulse" && c !== "light")).toEqual([
      "flight",
      "atomSprite",
      "shockwave",
      "ring",
      "sound:atom-hit:true",
    ]);
    h.pass.update(FLIGHT_MS + 5_000);
    expect(h.calls.filter((c) => c === "atomSprite")).toHaveLength(1);
  });

  it("a rocket is a stream and a small explosion without sound", () => {
    const h = harness();
    h.push("rocket");
    h.pass.update(0);
    h.pass.update(5_000);
    expect(h.calls).toEqual(["stream", "miniExplosion"]);
  });

  it("the flash stays on the edges and only the victim sees it", () => {
    expect(edgeWeight(0, 0)).toBe(0);
    expect(edgeWeight(FLASH_INNER, 0)).toBe(0);
    expect(edgeWeight(1, 0)).toBe(1);
    let peak = 0;
    for (let t = 0; t < 1_000; t += 10) peak = Math.max(peak, flashAlpha(t));
    expect(peak).toBeCloseTo(FLASH_PEAK, 2);
    expect(flashAlpha(FLASH_MS)).toBe(0);
    const run = (me: number) => {
      const h = harness(me);
      h.push("nuke");
      h.pass.update(0);
      h.pass.update(FLIGHT_MS + 10);
      h.pass.update(FLIGHT_MS + 100);
      return Math.max(0, ...h.flashes);
    };
    expect(run(2)).toBeGreaterThan(0);
    expect(run(5)).toBe(0);
  });

  it("the border pulse blinks at 0.5 Hz up to half brightness for 3 seconds", () => {
    expect(pulseBrightness(1_000)).toBeCloseTo(0.5, 5);
    expect(pulseBrightness(0)).toBe(0);
    expect(pulseBrightness(3_000)).toBe(0);
  });
});

describe("WwStrikeFxPass light", () => {
  it("the 20 s light fades without any tile, then switches off once", async () => {
    const { lightAlpha, LIGHT_MS, LIGHT_PEAK } =
      await import("../../../src/client/render/gl/passes/WwStrikeFxPass");
    expect(lightAlpha(0)).toBeCloseTo(LIGHT_PEAK, 5);
    expect(lightAlpha(LIGHT_MS / 2)).toBeCloseTo(LIGHT_PEAK / 2, 5);
    expect(lightAlpha(LIGHT_MS)).toBe(0);
    const alphas: number[] = [];
    const view = new WwDepthView();
    const pass = new WwStrikeFxPass(
      view,
      {
        regionXY: (r, out) => ((out.x = r), (out.y = r), true),
        ownerOf: () => 0,
        flight: () => {},
        atomSprite: () => {},
        shockwave: () => {},
        ring: () => {},
        stream: () => {},
        miniExplosion: () => {},
        pulse: () => {},
        light: (_x, _y, a) => alphas.push(a),
        edgeFlash: () => {},
        sound: () => {},
        cameraSees: () => false,
      },
      () => 1,
    );
    view.apply({
      fx: [{ kind: "nuke", region: 3, from: 1, owner: 1, tick: 0 }],
      news: [],
    });
    pass.update(0);
    pass.update(FLIGHT_MS + 1);
    pass.update(FLIGHT_MS + 10_000);
    pass.update(FLIGHT_MS + LIGHT_MS + 100);
    pass.update(FLIGHT_MS + LIGHT_MS + 200);
    expect(alphas[0]).toBeGreaterThan(alphas[1]);
    expect(alphas[alphas.length - 1]).toBe(0);
    expect(alphas.filter((a) => a === 0)).toHaveLength(1);
  });
});

describe("StrategicFxPass strike pulse input", () => {
  it("the strike pulse brings its own brightness and ends on count 0", async () => {
    const { StrategicFxPass } =
      await import("../../../src/client/render/gl/passes/StrategicFxPass");
    const gl = new Proxy(
      {},
      { get: () => () => ({}) },
    ) as unknown as WebGL2RenderingContext;
    const pass = new StrategicFxPass(gl);
    pass.setTimeFn(() => 1_000);
    pass.setCongressTargets([7]);
    pass.setStrikePulse(Uint32Array.of(3), 1, 0.37);
    pass.updatePulses();
    expect(pass.pulseCount).toBe(2);
    expect([pass.pulseOwners[0], pass.pulseValues[0]]).toEqual([
      3,
      expect.closeTo(0.37, 5),
    ]);
    expect(pass.pulseOwners[1]).toBe(7);
    expect(pass.pulseValues[1]).not.toBeCloseTo(0.37, 3);
    pass.setStrikePulse(Uint32Array.of(3), 0, 0);
    pass.updatePulses();
    expect(pass.pulseCount).toBe(1);
  });
});
