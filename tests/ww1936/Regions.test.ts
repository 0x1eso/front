import {
  decodeRegions,
  encodeRegions,
} from "@openfront/engine-lib/ww1936/Regions";

describe("regions.bin", () => {
  test("round-trips runs of region ids", () => {
    const w = 7;
    const h = 3;
    // prettier-ignore
    const ids = Uint16Array.from([
      1, 1, 1, 2, 2, 40001, 40001,
      1, 1, 2, 2, 2, 40001, 0,
      300, 300, 300, 300, 65535, 65535, 65535,
    ]);
    const bin = encodeRegions(ids, w, h);
    expect(Array.from(bin.slice(0, 4))).toEqual([0x52, 0x47, 0x4e, 0x31]);
    expect(decodeRegions(bin, w, h)).toEqual(ids);
  });

  test("a long run takes a multi-byte length", () => {
    const ids = new Uint16Array(4000 * 2036).fill(7);
    const bin = encodeRegions(ids, 4000, 2036);
    expect(bin.length).toBeLessThan(32);
    // Compare bytes: a deep toEqual over 8M elements takes seconds.
    const out = decodeRegions(bin, 4000, 2036);
    expect(out.length).toBe(ids.length);
    expect(Buffer.from(out.buffer).equals(Buffer.from(ids.buffer))).toBe(true);
  });

  test("rejects a wrong size, a bad magic and runs that do not cover the map", () => {
    const bin = encodeRegions(Uint16Array.from([1, 1, 2, 2]), 2, 2);
    expect(() => decodeRegions(bin, 4, 1)).toThrow(/2x2/);
    const bad = bin.slice();
    bad[0] = 0;
    expect(() => decodeRegions(bad, 2, 2)).toThrow(/magic/);
    expect(() => decodeRegions(bin.slice(0, bin.length - 1), 2, 2)).toThrow();
  });
});
