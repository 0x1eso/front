// World War 1936 P3 (spec §22.2, plan decisions 16, 26): the stateless roll.
import {
  aiWeight,
  idHash,
  P_BEAT,
  P_EVT,
  pickWeighted,
  wwRoll,
} from "@openfront/engine-lib/ww1936/Roll";

describe("the politics roll", () => {
  it("the same inputs give the same value; any input changes it", () => {
    expect(wwRoll(42, P_EVT, 7, 3, 1)).toBe(wwRoll(42, P_EVT, 7, 3, 1));
    const v = wwRoll(42, P_EVT, 7, 3, 1);
    expect(wwRoll(43, P_EVT, 7, 3, 1)).not.toBe(v);
    expect(wwRoll(42, P_BEAT, 7, 3, 1)).not.toBe(v);
    expect(wwRoll(42, P_EVT, 8, 3, 1)).not.toBe(v);
    expect(wwRoll(42, P_EVT, 7, 4, 1)).not.toBe(v);
    expect(wwRoll(42, P_EVT, 7, 3, 2)).not.toBe(v);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(0x1_0000_0000);
    expect(Number.isInteger(v)).toBe(true);
  });

  it("idHash is FNV-1a", () => {
    expect(idHash("")).toBe(0x811c9dc5);
    expect(idHash("a")).toBe(0xe40c292c);
    expect(idHash("beat")).toBe(P_BEAT);
  });

  it("a 10% threshold hits 9–11% over 10,000 rolls", () => {
    let hits = 0;
    for (let i = 0; i < 10_000; i++)
      if (wwRoll(1937, P_EVT, i) % 100 < 10) hits++;
    expect(hits).toBeGreaterThanOrEqual(900);
    expect(hits).toBeLessThanOrEqual(1100);
  });

  it("beats keep P0's skip and delay distribution (plan decision 16)", () => {
    let skipped = 0;
    let delaySum = 0;
    const counts = new Array<number>(21).fill(0);
    for (let i = 0; i < 10_000; i++) {
      const h = idHash(`b_fake_${i}`);
      if (wwRoll(99, P_BEAT, h, 1) % 10 === 0) skipped++;
      const d = wwRoll(99, P_BEAT, h, 2) % 21;
      delaySum += d;
      counts[d]++;
    }
    expect(skipped).toBeGreaterThanOrEqual(900);
    expect(skipped).toBeLessThanOrEqual(1100);
    expect(delaySum / 10_000).toBeGreaterThanOrEqual(9.5);
    expect(delaySum / 10_000).toBeLessThanOrEqual(10.5);
    // Every day 0..20 comes up, none more than twice as often as another.
    expect(Math.min(...counts)).toBeGreaterThan(0);
    expect(Math.max(...counts)).toBeLessThan(2 * Math.min(...counts));
  });

  it("pickWeighted follows the weights", () => {
    expect(pickWeighted([0, 0], 5)).toBe(-1);
    expect(pickWeighted([], 5)).toBe(-1);
    expect(pickWeighted([0, 3, 0], 7)).toBe(1);
    expect(pickWeighted([1, 1], 0)).toBe(0);
    expect(pickWeighted([1, 1], 1)).toBe(1);
    const n = [0, 0, 0];
    for (let i = 0; i < 10_000; i++)
      n[pickWeighted([1, 0, 3], wwRoll(5, P_EVT, i))]++;
    expect(n[1]).toBe(0);
    expect(n[2] / n[0]).toBeGreaterThan(2.7);
    expect(n[2] / n[0]).toBeLessThan(3.3);
  });

  it("aiWeight multiplies the mods that hold, flooring each step", () => {
    const w = {
      base: 10,
      mods: [
        { if: { kind: "at_war" as const }, factor: 150 },
        { if: { kind: "is_major" as const }, factor: 33 },
      ],
    };
    expect(aiWeight(w, () => false)).toBe(10);
    expect(aiWeight(w, (i) => i === 0)).toBe(15);
    expect(aiWeight(w, () => true)).toBe(4); // floor(15 × 33 / 100)
    expect(aiWeight(undefined, () => true)).toBe(10);
    expect(aiWeight(undefined, () => true, 3)).toBe(3);
    expect(
      aiWeight(
        { base: 5, mods: [{ if: { kind: "at_war" }, factor: -10 }] },
        () => true,
      ),
    ).toBe(0);
  });
});
