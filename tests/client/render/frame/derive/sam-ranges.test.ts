import { describe, expect, it, vi } from "vitest";
import { samRangeResolver } from "../../../../../src/client/render/frame/derive/SamRanges";

describe("samRangeResolver", () => {
  it("gives a SAM owner's ring the engine's samRangeOf", () => {
    const owner = { isPlayer: () => true };
    const samRangeOf = vi.fn((_owner: unknown, base: number) => base * 1.3);
    const resolve = samRangeResolver({
      playerBySmallID: () => owner,
      config: () => ({ samRangeOf }),
    } as any);
    expect(resolve(4, 100)).toBe(130);
    expect(samRangeOf).toHaveBeenCalledWith(owner, 100);
  });

  it("leaves a SAM without a player owner at its base range", () => {
    const resolve = samRangeResolver({
      playerBySmallID: () => ({ isPlayer: () => false }),
      config: () => ({ samRangeOf: () => 999 }),
    } as any);
    expect(resolve(0, 70)).toBe(70);
  });
});
