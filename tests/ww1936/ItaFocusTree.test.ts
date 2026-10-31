import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";

describe("ITA focus tree", () => {
  const ita = CONTENT.focuses.filter((f) => f.tree === "ITA");

  it("is about a hundred focuses, each with a group and a unique cell", () => {
    expect(ita.length).toBe(97);
    expect(ita.every((f) => !!f.group)).toBe(true);
    expect(new Set(ita.map((f) => `${f.x},${f.y}`)).size).toBe(ita.length);
  });

  it("has symmetric exclusive forks", () => {
    const by = new Map(ita.map((f) => [f.id, f]));
    for (const id of [
      "ita_malta_assault",
      "ita_badoglio_govt",
      "ita_albania_union",
      "ita_german_coal",
      "ita_axis_staff_talks",
    ]) {
      for (const o of by.get(id)!.exclusive ?? []) {
        expect(by.get(o)!.exclusive, o).toContain(id);
      }
    }
  });
});
