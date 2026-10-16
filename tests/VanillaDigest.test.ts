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

  test("FFA with the strategic option explicitly off", async () => {
    expect(await digest({ strategicWeapons: false })).toBe("c330352312204618");
  }, 60_000);

  // Domestic mode and expanded warfare, pinned on 758c9f5ff (before strategic
  // weapons): turning the strategic option off must leave both unchanged.
  test("domestic mode with the strategic option explicitly off", async () => {
    expect(await digest({ domesticMode: true, strategicWeapons: false })).toBe(
      "11efe429c80c6e2f",
    );
  }, 60_000);

  test("expanded warfare with the strategic option explicitly off", async () => {
    expect(
      await digest({ warfareExpansion: true, strategicWeapons: false }),
    ).toBe("312bd4a7c2d2b669");
  }, 60_000);

  test("domestic mode and expanded warfare with the strategic option explicitly off", async () => {
    expect(
      await digest({
        domesticMode: true,
        warfareExpansion: true,
        strategicWeapons: false,
      }),
    ).toBe("795891cc9da8b91f");
  }, 60_000);
});
