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

  // The two expanded-warfare pins were re-pinned for the warfare overhaul
  // (spec §14c: no encirclement capture, carpet bombing, unlimited barrage
  // range); the option-off pins above are unchanged.
  // Domestic mode and expanded warfare, pinned on 758c9f5ff (before strategic
  // weapons): turning the strategic option off must leave both unchanged.
  test("domestic mode with the strategic option explicitly off", async () => {
    expect(await digest({ domesticMode: true, strategicWeapons: false })).toBe(
      "7d34e4d5cdaa07ab",
    );
  }, 60_000);

  test("expanded warfare with the strategic option explicitly off", async () => {
    expect(
      await digest({ warfareExpansion: true, strategicWeapons: false }),
    ).toBe("7ab01036826a4a06");
  }, 60_000);

  test("domestic mode and expanded warfare with the strategic option explicitly off", async () => {
    expect(
      await digest({
        domesticMode: true,
        warfareExpansion: true,
        strategicWeapons: false,
      }),
    ).toBe("dddf7fe292970133");
  }, 60_000);

  // Fork options on: the hash also covers gold and the fork state.
  test("strategic weapons on", async () => {
    expect(await digest({ strategicWeapons: true })).toBe("fd640debf2600bff");
  }, 60_000);
});
