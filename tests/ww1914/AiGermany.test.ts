import { ladderRung } from "@openfront/engine/ww1914/Home";
import { expect, test } from "vitest";
import { warShape } from "./sim/WarSim";

// aw-RUS-6 and -10 lost Germany in 1915 before the staff waited.
test("a Germany nobody plays doesn't ask in the first thirty months", async () => {
  for (const id of ["aw-RUS-6", "aw-RUS-10"]) {
    const s = await warShape(id, "RUS");
    expect(s.ending.startsWith("deu_")).toBe(false);
    expect(s.endMonth >= "1917-01").toBe(true);
  }
}, 60000);

test("the top rung waits for its month; the rungs below don't", () => {
  expect(ladderRung(8, 11, 30)).toBe(3);
  expect(ladderRung(8, 30, 30)).toBe(4);
  expect(ladderRung(8, 11)).toBe(4);
  expect(ladderRung(4, 11, 30)).toBe(2);
});
