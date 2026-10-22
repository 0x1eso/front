// World War 1936 P6 (plan Task 1 Step 12, spec §5.5; review E5): P1's
// production asks lane E's hooks — a retool keeps the design's retention
// (lineRetentionBp, else P1's rule), and a converting line (convertFrom)
// rebuilds the stock it takes at conversionCostMilli. Lane E's two
// functions stand in through a module mock.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  EFF_FLOOR_BP,
  effAfterSwitch,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import * as Designs from "@openfront/engine/ww1936/depth/Designs";
import {
  changeLine,
  stepProduction,
} from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, stepTo, wwRunner } from "./util";

vi.mock("@openfront/engine/ww1936/depth/Designs", async (orig) => {
  const m =
    await orig<typeof import("@openfront/engine/ww1936/depth/Designs")>();
  return {
    ...m,
    lineRetentionBp: vi.fn(m.lineRetentionBp),
    conversionCostMilli: vi.fn(m.conversionCostMilli),
  };
});

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => {
  usePoliticsContent(null);
  vi.mocked(Designs.lineRetentionBp).mockReset();
  vi.mocked(Designs.conversionCostMilli).mockReset();
});

async function germany() {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "DEU" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const ce = ww.economy.country(DEEP.tag.DEU)!;
  return { ww, ce };
}

describe("P6: line routing to lane E (retention and conversion)", () => {
  it("a retool keeps the design's retention; -1 keeps P1's rule", async () => {
    const { ww, ce } = await germany();
    const line = ce.lines.find(
      (l) => l.key === equipKey("infantry_equipment", 1),
    )!;
    expect(line).toBeDefined();
    ce.addTech("support_eq_1");
    // P1's rule (the stub's -1).
    vi.mocked(Designs.lineRetentionBp).mockReturnValue(-1);
    line.effBp = 8000;
    expect(
      changeLine(ww.economy, ce, line.id, "support_equipment", 1),
    ).toBeNull();
    expect(Designs.lineRetentionBp).toHaveBeenCalledWith(
      ww.depth,
      ce.smallID,
      equipKey("infantry_equipment", 1),
      equipKey("support_equipment", 1),
    );
    expect(line.effBp).toBe(
      effAfterSwitch(
        8000,
        "infantry_equipment",
        1,
        "support_equipment",
        1,
        ce.stats.retentionBp,
      ),
    );
    // A design's retention: 50% of the efficiency, the floor holds.
    vi.mocked(Designs.lineRetentionBp).mockReturnValue(5000);
    line.effBp = 8000;
    line.convertFrom = 7;
    expect(
      changeLine(ww.economy, ce, line.id, "infantry_equipment", 1),
    ).toBeNull();
    expect(line.effBp).toBe(Math.max(EFF_FLOOR_BP, 4000));
    expect(line.key).toBe(equipKey("infantry_equipment", 1));
    expect(line.progress).toBe(0);
    // A retool ends a conversion.
    expect(line.convertFrom).toBe(-1);
  });

  it("a converting line takes its source stock at the conversion cost", async () => {
    const { ww, ce } = await germany();
    const line = ce.lines.find(
      (l) => l.key === equipKey("infantry_equipment", 1),
    )!;
    const from = equipKey("infantry_equipment", 2);
    const to = line.key;
    ce.stock[from] = 3;
    line.convertFrom = from;
    vi.mocked(Designs.conversionCostMilli).mockReturnValue(1);
    const before = ce.stock[to];
    stepProduction(ww.economy, ce);
    expect(Designs.conversionCostMilli).toHaveBeenCalledWith(
      ww.depth,
      ce.smallID,
      line.id,
      to,
    );
    // The three source units went first (cost 1 each), then full price.
    expect(ce.stock[from]).toBe(0);
    expect(ce.stock[to]).toBeGreaterThanOrEqual(before + 3);
    // Without a conversion (convertFrom -1) the hook is not asked.
    vi.mocked(Designs.conversionCostMilli).mockClear();
    line.convertFrom = -1;
    stepProduction(ww.economy, ce);
    expect(Designs.conversionCostMilli).not.toHaveBeenCalled();
  });
});
