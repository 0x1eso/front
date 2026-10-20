// World War 1936 P3 (spec §23 end): scripts/ww1936/lang-union.ts, the merge
// of two language files.
import { Json, sortDeep, union } from "../../scripts/ww1936/lang-union";

const sortedEverywhere = (j: Json): boolean => {
  const keys = Object.keys(j);
  for (let i = 1; i < keys.length; i++) if (keys[i - 1] > keys[i]) return false;
  return Object.values(j).every(
    (v) => typeof v === "string" || sortedEverywhere(v),
  );
};

describe("lang-union", () => {
  it("joins two files with no shared key", () => {
    const clashes: string[] = [];
    const out = union(
      { b: "B", x: { z: "Z" } },
      { a: "A", x: { y: "Y" } },
      "",
      clashes,
    );
    expect(out).toEqual({ a: "A", b: "B", x: { y: "Y", z: "Z" } });
    expect(clashes).toEqual([]);
  });

  it("keeps one copy of a key both have with the same text", () => {
    const clashes: string[] = [];
    expect(
      union({ a: { b: "same" } }, { a: { b: "same" } }, "", clashes),
    ).toEqual({
      a: { b: "same" },
    });
    expect(clashes).toEqual([]);
  });

  it("reports a key with two different texts by its path", () => {
    const clashes: string[] = [];
    union(
      { ww1936: { title: { jpn_prime_minister: "Prime Minister" } } },
      { ww1936: { title: { jpn_prime_minister: "Prime Minister of Japan" } } },
      "",
      clashes,
    );
    expect(clashes).toEqual(["ww1936.title.jpn_prime_minister"]);
  });

  it("with the base, a key only one side changed takes that side's text", () => {
    const clashes: string[] = [];
    const base = { a: "old", b: "same", c: { d: "old" } };
    const ours = { a: "new on ours", b: "same", c: { d: "old" }, e: "ours" };
    const theirs = { a: "old", b: "same", c: { d: "new on theirs" }, f: "x" };
    expect(union(ours, theirs, "", clashes, base)).toEqual({
      a: "new on ours",
      b: "same",
      c: { d: "new on theirs" },
      e: "ours",
      f: "x",
    });
    expect(clashes).toEqual([]);
    // Both changed it: still a clash.
    union({ a: "one" }, { a: "two" }, "", clashes, { a: "zero" });
    expect(clashes).toEqual(["a"]);
  });

  it("sorts every level", () => {
    const out = sortDeep({
      z: { b: "1", a: "2" },
      a: "x",
      m: { d: { c: "3", b: "4" } },
    });
    expect(sortedEverywhere(out)).toBe(true);
    expect(JSON.stringify(out)).toBe(
      '{"a":"x","m":{"d":{"b":"4","c":"3"}},"z":{"a":"2","b":"1"}}',
    );
  });
});
