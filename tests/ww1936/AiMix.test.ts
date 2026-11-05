// ww81 lane P: the AI's line mix moves factories by real stock.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { aiLineMix } from "@openfront/engine/ww1936/depth/AiMix";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, stepTo, wwRunner } from "./util";

afterEach(() => usePoliticsContent(null));

describe("ww81 the AI's line mix", () => {
  test("factories leave a line the stock covers three times over", async () => {
    usePoliticsContent(depthFixture({}));
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const DEU = DEEP.tag.DEU;
    const ce = ww.economy.country(DEU)!;
    ce.lines.length = 0;
    addLine(ww.economy, ce, "infantry_equipment", 1, 6);
    addLine(ww.economy, ce, "artillery", 1, 2);
    ce.stock[equipKey("infantry_equipment", 1)] = 50_000_000;
    ce.stock[equipKey("artillery", 1)] = 0;
    const rows = ww.land.rowsOf(DEU).length;
    const before = ce.lines.map((l) => l.factories);
    aiLineMix(d, DEU, ce);
    const after = ce.lines.map((l) => l.factories);
    if (rows === 0) {
      expect(after).toEqual(before);
    } else {
      expect(after[0]).toBeLessThan(before[0]);
      // The factory goes to the shortest group (a line or a new one).
      const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
      expect(sum(ce.lines.map((l) => l.factories))).toBe(sum(before));
    }
  });
});
