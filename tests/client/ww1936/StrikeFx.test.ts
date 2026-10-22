// World War 1936 P6 lane U4 (plan Task 13): the strike effects ask only for
// drawing calls, never write a tile, and keep their flash on the edges.
import { describe, expect, it } from "vitest";
import {
  edgeWeight,
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
  it("a nuke effect never writes a tile", () => {
    const h = harness();
    h.push("nuke");
    h.pass.update(0);
    h.pass.update(FLIGHT_MS + 10);
    // Three planes first, then ONE sprite, ONE shockwave, ONE ring, the sound.
    expect(h.calls.filter((c) => c === "flight")).toHaveLength(1);
    expect(h.calls.filter((c) => c === "atomSprite")).toHaveLength(1);
    expect(h.calls.filter((c) => c === "shockwave")).toHaveLength(1);
    expect(h.calls.filter((c) => c === "ring")).toHaveLength(1);
    expect(h.calls).toContain("sound:atom-hit:true");
    // Only drawing calls: nothing here can touch the map's tiles.
    const allowed = new Set([
      "flight",
      "atomSprite",
      "shockwave",
      "ring",
      "stream",
      "miniExplosion",
      "pulse",
      "light",
      "sound:atom-hit:true",
    ]);
    for (const c of h.calls) expect(allowed.has(c), c).toBe(true);
  });

  it("a rocket is a stream and a small explosion without sound", () => {
    const h = harness();
    h.push("rocket");
    h.pass.update(0);
    h.pass.update(5_000);
    expect(h.calls).toEqual(["stream", "miniExplosion"]);
  });

  it("the flash stays on the edges", () => {
    // Nothing in the middle of the screen, the peak only at the border.
    expect(edgeWeight(0, 0)).toBe(0);
    expect(edgeWeight(0.5, -0.5)).toBe(0);
    expect(edgeWeight(1, 0)).toBe(1);
    let peak = 0;
    for (let t = 0; t < 1_000; t += 10) peak = Math.max(peak, flashAlpha(t));
    expect(peak).toBeLessThanOrEqual(FLASH_PEAK);
    expect(flashAlpha(2_000)).toBe(0);
    // Only the victim sees it, once.
    const mine = harness(2);
    mine.push("nuke");
    mine.pass.update(0);
    mine.pass.update(FLIGHT_MS + 10);
    mine.pass.update(FLIGHT_MS + 100);
    expect(Math.max(...mine.flashes)).toBeGreaterThan(0);
    const other = harness(5);
    other.push("nuke");
    other.pass.update(0);
    other.pass.update(FLIGHT_MS + 10);
    other.pass.update(FLIGHT_MS + 100);
    expect(Math.max(0, ...other.flashes)).toBe(0);
  });

  it("the border pulse blinks at 0.5 Hz up to half brightness for 3 seconds", () => {
    expect(pulseBrightness(1_000)).toBeCloseTo(0.5, 5);
    expect(pulseBrightness(0)).toBe(0);
    expect(pulseBrightness(3_000)).toBe(0);
  });
});
