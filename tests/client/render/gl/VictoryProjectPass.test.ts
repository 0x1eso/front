import { describe, expect, it } from "vitest";
import { VictoryProjectPass } from "../../../../src/client/render/gl/passes/VictoryProjectPass";

/** A GL stub that hands out numbered buffers and records deletions. */
function glStub() {
  const created: object[] = [];
  const deleted: object[] = [];
  const gl = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "createBuffer")
          return () => {
            const b = { buffer: created.length };
            created.push(b);
            return b;
          };
        if (prop === "deleteBuffer") return (b: object) => deleted.push(b);
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, created, deleted };
}

describe("VictoryProjectPass", () => {
  it("frees its quad buffer on dispose (M9)", () => {
    const { gl, created, deleted } = glStub();
    const pass = new VictoryProjectPass(gl);
    expect(created).toHaveLength(1);
    pass.dispose();
    expect(deleted).toEqual(created);
  });
});
