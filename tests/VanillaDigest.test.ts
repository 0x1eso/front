import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  createScriptedRunner,
  scriptedGameStart,
  stepScripted,
} from "./util/ScriptedGame";

// Pins that a vanilla (non-domestic) game stays bit-identical to the upstream
// engine: a digest of the per-tick game hash over a scripted game. The pinned
// values were computed on the vanilla baseline (OpenFrontIO-base) and match
// there. A change here means vanilla simulation changed: only update the pins
// for an intended, upstream-compatible change.
const TICKS = 3000;

async function digest(overrides: object): Promise<string> {
  const runner = await createScriptedRunner(
    "world",
    scriptedGameStart(overrides),
  );
  const h = createHash("sha256");
  while (runner.game.ticks() < TICKS) {
    stepScripted(runner);
    h.update(`${(runner.game as unknown as { hash(): number }).hash()},`);
  }
  return h.digest("hex").slice(0, 16);
}

describe("vanilla stays bit-identical", () => {
  test("FFA with infinite gold", async () => {
    expect(await digest({})).toBe("c330352312204618");
  }, 60_000);

  test("FFA with finite gold", async () => {
    expect(await digest({ infiniteGold: false })).toBe("cc52cbbfd8b1a3bc");
  }, 60_000);

  test("FFA with the warfare option explicitly off", async () => {
    expect(await digest({ warfareExpansion: false })).toBe("c330352312204618");
  }, 60_000);
});
