import { describe, expect, test } from "vitest";
import { StrategicFxPass } from "../../../../src/client/render/gl/passes/StrategicFxPass";

function countingGL() {
  const counts = { draws: 0, programs: 0, deletedPrograms: 0, uploads: 0 };
  const gl = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "drawArrays") return () => counts.draws++;
        if (prop === "createProgram") {
          return () => {
            counts.programs++;
            return {};
          };
        }
        if (prop === "deleteProgram") return () => counts.deletedPrograms++;
        if (prop === "getProgramParameter") return () => true;
        if (prop === "getShaderParameter") return () => true;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, counts };
}

const cam = new Float32Array(9);

function setup() {
  const { gl, counts } = countingGL();
  const pass = new StrategicFxPass(gl);
  let now = 0;
  pass.setTimeFn(() => now);
  return {
    pass,
    counts,
    advance: (ms: number) => (now += ms),
  };
}

describe("StrategicFxPass", () => {
  test("draws nothing when there is nothing to show", () => {
    const { pass, counts } = setup();
    expect(pass.isIdle()).toBe(true);
    pass.draw(cam, 4);
    pass.updatePulses();
    pass.updateLabels(4);
    expect(counts.draws).toBe(0);
    expect(pass.pulseCount).toBe(0);
    expect(pass.labels).toHaveLength(0);
  });

  test("a preparing silo gets a ring and a badge", () => {
    const { pass, counts } = setup();
    pass.setPreparing([{ x: 5, y: 6, secondsLeft: 61 }]);
    pass.draw(cam, 4);
    expect(counts.draws).toBe(2);
  });

  test("the time-left label sits under the silo and follows the clock", () => {
    const { pass } = setup();
    const items = [{ x: 5, y: 6, secondsLeft: 61 }];
    pass.setPreparing(items);
    pass.updateLabels(4);
    expect(pass.labels).toHaveLength(1);
    expect(pass.labels[0].text).toBe("1:01");
    expect(pass.labels[0].y).toBeGreaterThan(6);
    const first = pass.labels[0];
    items[0].secondsLeft = 60;
    pass.updateLabels(4);
    expect(pass.labels[0]).toBe(first); // pooled, not reallocated
    expect(pass.labels[0].text).toBe("1:00");
    pass.setPreparing([]);
    pass.updateLabels(4);
    expect(pass.labels).toHaveLength(0);
  });

  test("the label offset keeps its screen size when zoomed out", () => {
    const { pass } = setup();
    pass.setPreparing([{ x: 0, y: 0, secondsLeft: 5 }]);
    pass.updateLabels(8);
    const near = pass.labels[0].y;
    pass.updateLabels(0.5);
    expect(pass.labels[0].y).toBeGreaterThan(near);
  });

  test("streaks fade out: launch 1.4 s, interception 1 s", () => {
    const { pass, counts, advance } = setup();
    pass.spawnLaunch([{ x: 1, y: 1 }]);
    pass.spawnIntercept([{ x: 2, y: 2 }]);
    pass.draw(cam, 4);
    expect(counts.draws).toBe(2);
    advance(1100);
    counts.draws = 0;
    pass.draw(cam, 4);
    expect(counts.draws).toBe(1);
    advance(400);
    counts.draws = 0;
    pass.draw(cam, 4);
    expect(counts.draws).toBe(0);
    expect(pass.isIdle()).toBe(true);
  });

  test("a ripple lasts 1.8 s and one is drawn per impact", () => {
    const { pass, counts, advance } = setup();
    pass.spawnRipples([
      { x: 1, y: 1 },
      { x: 9, y: 9 },
    ]);
    pass.draw(cam, 4);
    expect(counts.draws).toBe(2);
    advance(1900);
    counts.draws = 0;
    pass.draw(cam, 4);
    expect(counts.draws).toBe(0);
  });

  test("a countdown only pulses the target's border (no reticle)", () => {
    const { pass, counts, advance } = setup();
    pass.setCountdowns([
      { ownerID: 4, x: 20, y: 20, maxRadius: 50, leftTicks: 150 },
    ]);
    pass.draw(cam, 4);
    expect(counts.draws).toBe(0);
    pass.updatePulses();
    expect(pass.pulseCount).toBe(1);
    expect(pass.pulseOwners[0]).toBe(4);
    const v0 = pass.pulseValues[0];
    advance(1000);
    pass.updatePulses();
    expect(pass.pulseValues[0]).not.toBe(v0);
    pass.setCountdowns([]);
    pass.updatePulses();
    expect(pass.pulseCount).toBe(0);
  });

  test("caps the pulses it hands the border shader", () => {
    const { pass } = setup();
    pass.setCountdowns(
      Array.from({ length: 7 }, (_, i) => ({
        ownerID: i + 1,
        x: 0,
        y: 0,
        maxRadius: 20,
        leftTicks: 300,
      })),
    );
    pass.updatePulses();
    expect(pass.pulseCount).toBe(4);
  });

  test("dispose frees both programs", () => {
    const { pass, counts } = setup();
    pass.dispose();
    expect(counts.deletedPrograms).toBe(2);
  });

  test("an emergency target's border pulses slowly, at 0.5 Hz", () => {
    const { pass, advance } = setup();
    pass.setCongressTargets([7]);
    expect(pass.isIdle()).toBe(false);
    pass.updatePulses();
    expect(pass.pulseCount).toBe(1);
    expect(pass.pulseOwners[0]).toBe(7);
    expect(pass.pulseValues[0]).toBeCloseTo(0);
    advance(1000);
    pass.updatePulses();
    expect(pass.pulseValues[0]).toBeCloseTo(1);
    advance(1000);
    pass.updatePulses();
    expect(pass.pulseValues[0]).toBeCloseTo(0);
    pass.setCongressTargets([]);
    pass.updatePulses();
    expect(pass.pulseCount).toBe(0);
    expect(pass.isIdle()).toBe(true);
  });

  test("an emergency target already counting down to a strike pulses once, and draws nothing", () => {
    const { pass, counts } = setup();
    pass.setCountdowns([
      { ownerID: 7, x: 0, y: 0, maxRadius: 20, leftTicks: 150 },
    ]);
    pass.setCongressTargets([7]);
    pass.updatePulses();
    expect(pass.pulseCount).toBe(1);
    expect(pass.pulseOwners[0]).toBe(7);
    pass.setCountdowns([]);
    pass.draw(cam, 4);
    expect(counts.draws).toBe(0);
  });
});

describe("strategic fx wiring", () => {
  test("the renderer draws the pass, pulses borders and labels before text", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/client/render/gl/Renderer.ts", "utf8");
    const overlays = src.slice(src.indexOf("private renderOverlays("));
    const body = overlays.slice(0, overlays.indexOf("\n  }\n"));
    expect(body).toContain("this.strategicFxPass.draw(cam, zoom)");
    expect(body).toContain("this.borderStampPass.setPulses(");
    expect(body.indexOf("updateLabels")).toBeLessThan(
      body.indexOf("this.worldTextPass.tick"),
    );
    expect(src).toContain("this.strategicFxPass.dispose()");
  });

  test("the frame builder hands the renderer the emergency target, only when it changes", async () => {
    const { WebGLFrameBuilder } =
      await import("../../../../src/client/WebGLFrameBuilder");
    const pushed: number[][] = [];
    const builder = new WebGLFrameBuilder({
      setCongressPulse: (ids: readonly number[]) => pushed.push([...ids]),
    } as never) as unknown as {
      syncCongress(gameView: unknown): void;
      clearCaches(): void;
    };
    let target: number | null = 5;
    const game = (congress: boolean) => ({
      config: () => ({ congress: () => congress }),
      congressData: () => ({
        emergency: target === null ? null : { target },
      }),
    });
    builder.syncCongress(game(false));
    expect(pushed).toEqual([]);
    builder.syncCongress(game(true));
    builder.syncCongress(game(true));
    expect(pushed).toEqual([[5]]);
    target = null;
    builder.syncCongress(game(true));
    expect(pushed).toEqual([[5], []]);
    // A restored context gets the running emergency again.
    target = 6;
    builder.syncCongress(game(true));
    builder.clearCaches();
    builder.syncCongress(game(true));
    expect(pushed).toEqual([[5], [], [6], [6]]);
  });
});
