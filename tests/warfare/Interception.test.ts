import { bomberEvades } from "@openfront/engine/warfare/Interception";

describe("bomber evasion", () => {
  test("about half the interceptions, the same on every client", () => {
    let evaded = 0;
    for (let tick = 0; tick < 1000; tick++) {
      if (bomberEvades(tick, 42)) evaded++;
    }
    expect(evaded).toBeGreaterThan(400);
    expect(evaded).toBeLessThan(600);
    for (let tick = 0; tick < 50; tick++) {
      expect(bomberEvades(tick, 7)).toBe(bomberEvades(tick, 7));
    }
  });
});
