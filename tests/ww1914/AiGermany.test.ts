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
