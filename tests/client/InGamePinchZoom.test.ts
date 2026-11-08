import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// ww164: html and body allow pinch-zoom (touch-action: manipulation), so a
// pinch on a HUD panel in a game zoomed the page itself. In a game, body
// allows pans only: every panel below it keeps its scroll, the page its scale.
describe("in a game the page never pinch-zooms", () => {
  const css = readFileSync("src/client/styles.css", "utf8");

  it("body.in-game allows pans only", () => {
    const block = /body\.in-game\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(block).toMatch(/touch-action:\s*pan-x pan-y;/);
  });
});
