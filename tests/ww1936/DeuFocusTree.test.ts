// The expanded German focus tree: size, groups, forks and their symmetry.
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";

describe("DEU focus tree", () => {
  const deu = CONTENT.focuses.filter((f) => f.tree === "DEU");
  const ids = new Set(deu.map((f) => f.id));

  it("has about 100 focuses with unique cells", () => {
    expect(deu.length).toBe(100);
    expect(new Set(deu.map((f) => `${f.x},${f.y}`)).size).toBe(100);
  });

  it("groups every new focus and keeps its forks exclusive", () => {
    expect(deu.filter((f) => f.group !== undefined).length).toBe(50);
    for (const [a, b] of [
      ["deu_fall_gelb", "deu_barbarossa_first"],
      ["deu_fall_gelb", "deu_med_strategy"],
      ["deu_collab_states", "deu_reichskomm"],
      ["deu_speer_ministry", "deu_goering_empire"],
      ["deu_valkyrie", "deu_loyalty_oath"],
    ]) {
      expect(ids.has(a) && ids.has(b)).toBe(true);
      const fa = deu.find((f) => f.id === a)!;
      const fb = deu.find((f) => f.id === b)!;
      expect(fa.exclusive).toContain(b);
      expect(fb.exclusive).toContain(a);
    }
  });
});
