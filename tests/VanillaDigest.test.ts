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

// The world congress pin (the last test). It moves with every change to the
// congress simulation. To re-pin after an intended change, set it to
// "0000000000000000", run
//   npx vitest tests/VanillaDigest.test.ts -t "world congress" --run
// and paste the received value here; then run the whole file twice to
// confirm it's stable and that no other pin moved.
const CONGRESS_ON_DIGEST = "f6772eec62ac81ee";

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
      "a7dac00d9005a3ad",
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
    expect(await digest({ strategicWeapons: true })).toBe("091085284bca29e0");
  }, 60_000);

  // World congress (spec §3.2): explicitly off, without domestic mode, or in a
  // domestic game, the option changes nothing. Pins taken from the tests above.
  test("domestic mode with the congress option explicitly off", async () => {
    expect(
      await digest({
        domesticMode: true,
        strategicWeapons: false,
        congress: false,
      }),
    ).toBe("a7dac00d9005a3ad");
  }, 60_000);

  test("the congress option without domestic mode changes nothing", async () => {
    expect(await digest({ congress: true })).toBe("c330352312204618");
  }, 60_000);

  test("domestic mode and expanded warfare with the congress option explicitly off", async () => {
    expect(
      await digest({
        domesticMode: true,
        warfareExpansion: true,
        strategicWeapons: false,
        congress: false,
      }),
    ).toBe("dddf7fe292970133");
  }, 60_000);

  // World congress on (domestic FFA): pins the congress engine. A change here
  // means the congress's simulation changed: update only on purpose.
  test("domestic mode with the world congress", async () => {
    expect(await digest({ domesticMode: true, congress: true })).toBe(
      CONGRESS_ON_DIGEST,
    );
  }, 60_000);

  // World War 1936 (spec §2.3): explicitly off, or historicalAi without the
  // mode, changes nothing. Pins taken from the first test.
  test("the World War 1936 option explicitly off changes nothing", async () => {
    expect(await digest({ worldWar1936: false })).toBe("c330352312204618");
  }, 60_000);

  test("historicalAi without the mode changes nothing", async () => {
    expect(await digest({ historicalAi: true })).toBe("c330352312204618");
  }, 60_000);
});
