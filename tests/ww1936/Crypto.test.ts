// World War 1936 P6 lane I (plan Task 5, spec §8.7): cryptology — the
// day's progress (decryptPerDayMilli of the two countries' numbers),
// exploitation for 90 days, the reset to 300‰ and the target learning of
// it only then. Plan decision 30: a human country, lane functions direct.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { decryptPerDayMilli } from "@openfront/engine-lib/ww1936/IntelRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  activateCrypto,
  addDecryptMilli,
  cipherOf,
  cryptoModsVs,
  dailyCrypto,
  decryptOf,
  decryptRow,
  exploiting,
} from "@openfront/engine/ww1936/depth/Crypto";
import { sharedIntel } from "@openfront/engine/ww1936/depth/FactionRules";
import { intelDetailOf } from "@openfront/engine/ww1936/depth/IntelLevels";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { dissolveFaction } from "@openfront/engine/ww1936/politics/Factions";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

vi.mock("@openfront/engine/ww1936/depth/FactionRules", async (orig) => {
  const m =
    await orig<typeof import("@openfront/engine/ww1936/depth/FactionRules")>();
  return { ...m, sharedIntel: vi.fn(m.sharedIntel) };
});

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => {
  usePoliticsContent(null);
  vi.mocked(sharedIntel).mockReset();
});

const { DEU, GBR, FRA } = DEEP.tag;
const HUMANS = [
  { clientID: "HUMANGBR", country: "GBR" as const },
  { clientID: "HUMANDEU", country: "DEU" as const },
];

async function game(): Promise<GameRunner> {
  const r = await wwRunner({}, HUMANS, DEEP.map);
  stepTo(r, WW_PREP_TICKS + 1);
  return r;
}

/** Britain breaks Germany's codes; returns the day it did. */
function breakCodes(r: GameRunner): number {
  const d = r.game.worldWar()!.depth;
  const tick = r.game.ticks();
  expect(d.issue(GBR, { kind: "crypto_target", target: DEU }, tick)).toBe(
    "no_agency",
  );
  expect(d.issue(GBR, { kind: "intel_found" }, tick)).toBeNull();
  // The code-breaking departments (spec §8.2): D = 10 + 20 + 30 + techs.
  d.country(GBR)!.intel.upgrades |= (1 << 3) | (1 << 4);
  expect(d.issue(GBR, { kind: "crypto_target", target: GBR }, tick)).toBe(
    "bad_target",
  );
  expect(d.issue(GBR, { kind: "crypto_target", target: DEU }, tick)).toBeNull();
  const per = decryptPerDayMilli(decryptOf(d, GBR), cipherOf(d, DEU));
  expect(per).toBeGreaterThan(0);
  d.lastCommonDay = 100;
  dailyCrypto(d, GBR, 100);
  expect(decryptRow(d, GBR, DEU)?.progressMilli).toBe(per);
  expect(d.issue(GBR, { kind: "crypto_activate", target: DEU }, tick)).toBe(
    "not_decrypted",
  );
  let day = 100;
  while ((decryptRow(d, GBR, DEU)?.progressMilli ?? 0) < 1_000_000) {
    day++;
    d.lastCommonDay = day;
    dailyCrypto(d, GBR, day);
    expect(day).toBeLessThan(100 + Math.ceil(1_000_000 / per) + 1);
  }
  return day;
}

describe("World War 1936 P6: cryptology (lane I)", () => {
  it("decryption progresses and activation boosts combat by 5 percent for 90 days, then resets to 300", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const msg = vi.spyOn(d, "message");
    const broke = breakCodes(r);
    expect(msg).toHaveBeenCalledWith(GBR, "ww1936_decrypted", {
      countryTag: "DEU",
    });
    // Broken, not exploited: no combat bonus yet.
    expect(cryptoModsVs(d, GBR, DEU)).toBe(0);
    const start = broke + 3;
    d.lastCommonDay = start;
    expect(activateCrypto(d, GBR, DEU, start)).toBeNull();
    const row = decryptRow(d, GBR, DEU)!;
    expect(row.activeUntil).toBe(start + 90);
    expect(activateCrypto(d, GBR, DEU, start + 1)).toBe("in_progress");
    for (let day = start; day < start + 90; day++) {
      d.lastCommonDay = day;
      dailyCrypto(d, GBR, day);
      expect(exploiting(d, GBR, DEU)).toBe(true);
      expect(cryptoModsVs(d, GBR, DEU)).toBe(500);
      expect(cryptoModsVs(d, DEU, GBR)).toBe(0);
    }
    d.lastCommonDay = start + 90;
    expect(cryptoModsVs(d, GBR, DEU)).toBe(0);
    dailyCrypto(d, GBR, start + 90);
    // The target changed its codes: back to 300‰ (then the work goes on).
    const per = decryptPerDayMilli(decryptOf(d, GBR), cipherOf(d, DEU));
    expect(row.progressMilli).toBe(300_000 + per);
    expect(exploiting(d, GBR, DEU)).toBe(false);
  });

  it("the target learns its codes were broken only after the exploitation ends", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const broke = breakCodes(r);
    const msg = vi.spyOn(d, "message");
    const told = () =>
      msg.mock.calls.filter((c) => c[1] === "ww1936_codes_broken");
    const start = broke + 1;
    d.lastCommonDay = start;
    expect(activateCrypto(d, GBR, DEU, start)).toBeNull();
    for (let day = start; day < start + 90; day++) {
      d.lastCommonDay = day;
      dailyCrypto(d, GBR, day);
      expect(told()).toEqual([]);
      expect(intelDetailOf(d, DEU).decryptLog).toEqual([]);
      expect(intelDetailOf(d, GBR).decrypted).toEqual([
        { target: DEU, activeUntil: start + 90 },
      ]);
    }
    d.lastCommonDay = start + 90;
    dailyCrypto(d, GBR, start + 90);
    expect(told().map((c) => c[0])).toEqual([DEU]);
    expect(intelDetailOf(d, DEU).decryptLog).toEqual([
      { target: GBR, day: start + 90 },
    ]);
    // Not broken any more (300‰): not in the list until it is again.
    expect(intelDetailOf(d, GBR).decrypted).toEqual([]);
    // Once: the next days say nothing.
    dailyCrypto(d, GBR, start + 91);
    expect(told().length).toBe(1);
  });

  it("a sharer's exploitation ends the day the faction dissolves", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    // fr_shared_intel on (lane W3's rule) while they share a faction.
    vi.mocked(sharedIntel).mockImplementation((_d, a, b) =>
      ww.sameFaction(a, b),
    );
    expect(ww.sameFaction(GBR, FRA)).toBe(true);
    d.country(GBR)!.intel.agency = true;
    addDecryptMilli(d, FRA, DEU, 1_000_000);
    d.lastCommonDay = 200;
    expect(activateCrypto(d, GBR, DEU, 200)).toBeNull();
    dailyCrypto(d, GBR, 201);
    d.lastCommonDay = 201;
    expect(cryptoModsVs(d, GBR, DEU)).toBe(500);
    const msg = vi.spyOn(d, "message");
    dissolveFaction(ww.politics, ww.politics.factionIdx(GBR), r.game.ticks());
    expect(ww.sameFaction(GBR, FRA)).toBe(false);
    d.lastCommonDay = 202;
    dailyCrypto(d, GBR, 202);
    expect(cryptoModsVs(d, GBR, DEU)).toBe(0);
    expect(decryptRow(d, GBR, DEU)!.activeUntil).toBe(-2 - 202);
    expect(msg).toHaveBeenCalledWith(DEU, "ww1936_codes_broken");
    // France's own break stands.
    expect(decryptRow(d, FRA, DEU)!.progressMilli).toBe(1_000_000);
  });
});
