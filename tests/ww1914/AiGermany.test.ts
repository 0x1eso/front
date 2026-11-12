import { ladderRung } from "@openfront/engine/ww1914/Home";
import { expect, test } from "vitest";
import { warShape } from "./sim/WarSim";

// aw-RUS-6 and -10 lost Germany in 1915 before the staff waited. The seat here
// is Russia, and a hands-off Russia may fall on its own before 1917 (aw-RUS-6
// does since Lutsk needs a real break): that ends the game too, with Germany
// still in it, or win at the straits. What may not end it early is Germany:
// out, or asking for peace.
test("a Germany nobody plays doesn't ask in the first thirty months", async () => {
  for (const id of ["aw-RUS-6", "aw-RUS-10"]) {
    const s = await warShape(id, "RUS");
    expect(s.ending.startsWith("deu_")).toBe(false);
    expect(s.out.DEU === undefined || s.out.DEU >= "1917-01").toBe(true);
    if (s.endMonth < "1917-01" && s.armistice === null) {
      expect(s.out.RUS).toBe(s.endMonth);
      // Russia goes by itself: collapsed, or (ww190 tune) beaten in the field.
      expect(["nation_collapsed", "nation_beaten"]).toContain(s.outWhy.RUS);
    } else if (s.endMonth < "1917-01") {
      // Or Russia wins it at the straits (aw-RUS-10 takes Constantinople
      // in 1916, since before ww187): the seat's own win, not Germany asking.
      expect(s.ending).toBe("rus_straits_won");
    }
  }
}, 60000);

test("the top rung waits for its month; the rungs below don't", () => {
  expect(ladderRung(8, 11, 30)).toBe(3);
  expect(ladderRung(8, 30, 30)).toBe(4);
  expect(ladderRung(8, 11)).toBe(4);
  expect(ladderRung(4, 11, 30)).toBe(2);
});
