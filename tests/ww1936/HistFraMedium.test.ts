// ww122: France has real medium tanks (prototypes and projects included) at
// generations 2 and 3, from the same conversion as the rest.
import { HIST_CATALOGUE } from "@openfront/engine-lib/ww1936/hist/index";

describe("ww122: French medium tanks", () => {
  const med = HIST_CATALOGUE.FRA.filter(
    (e) => e.family === "tank" && e.role === "medium",
  );
  test("generation 2 and 3 have entries, the static keys point at one", () => {
    for (const g of ["medium_tank_2", "medium_tank_3"])
      expect(med.some((e) => e.techs.includes(g as never))).toBe(true);
    const statics = med.map((e) => e.staticFor).filter(Boolean);
    expect(statics).toEqual(["medium_tank:2", "medium_tank:3"]);
  });
  test("ids are unique and in range of the guns of the period", () => {
    const ids = med.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of med) {
      if (e.family !== "tank") continue;
      expect(e.spec.penMm500).toBeLessThanOrEqual(125);
      expect(e.spec.hullFrontMm).toBeLessThanOrEqual(120);
    }
  });
});
