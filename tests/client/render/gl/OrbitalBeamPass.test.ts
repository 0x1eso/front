import { OrbitalBeamPass } from "../../../../src/client/render/gl/passes/OrbitalBeamPass";

function countingGL() {
  const counts = { draws: 0 };
  const gl = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "drawArrays") return () => counts.draws++;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, counts };
}

describe("orbital beams", () => {
  test("one thin beam per impact, gone after 1.2 s", () => {
    const { gl, counts } = countingGL();
    const pass = new OrbitalBeamPass(gl);
    let now = 0;
    pass.setTimeFn(() => now);
    pass.spawn([
      { x: 1, y: 1 },
      { x: 5, y: 9 },
    ]);
    pass.draw(new Float32Array(9));
    expect(counts.draws).toBe(2);
    now = 1300;
    counts.draws = 0;
    pass.draw(new Float32Array(9));
    expect(counts.draws).toBe(0);
  });
});

describe("orbital beam wiring", () => {
  test("an idle frame filters nothing, and expired beams are pruned", () => {
    const { gl } = countingGL();
    const pass = new OrbitalBeamPass(gl);
    let now = 0;
    pass.setTimeFn(() => now);
    pass.spawn([{ x: 1, y: 1 }]);
    now = 5000;
    pass.draw(new Float32Array(9));
    expect((pass as any).beams).toHaveLength(0);
  });

  test("the renderer draws the pass in its overlay path", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/client/render/gl/Renderer.ts", "utf8");
    const overlays = src.slice(src.indexOf("private renderOverlays("));
    expect(overlays.slice(0, overlays.indexOf("\n  }\n"))).toContain(
      "this.orbitalBeamPass.draw(cam)",
    );
  });
});
