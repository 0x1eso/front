// World War 1936 P6 (plan Task 1 Step 12, spec §5.5; review E5): P1's
// production asks lane E's hooks — a retool keeps the design's retention
// (lineRetentionBp, else P1's rule), and a converting line (convertFrom)
// rebuilds the stock it takes at conversionCostMilli. Batch P6-4: lane E's
// real functions answer (the module mock that stood in for its stubs no
// longer reaches Production once Designs imports Refit and Licences, which
// lead back to the economy).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  EFF_FLOOR_BP,
  effAfterSwitch,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  conversionCostMilli,
  equipCostMilli,
  lineRetentionBp,
} from "@openfront/engine/ww1936/depth/Designs";
import {
  changeLine,
  stepProduction,
} from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const DEU = DEEP.tag.DEU;
const MED1 = equipKey("medium_tank", 1);
const DESIGN1 = equipKey("tank_design", 1);

/** Germany past the preparation minute, with a medium I tank design in slot 1. */
async function germany() {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "DEU" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const ce = ww.economy.country(DEU)!;
  ce.addTech("medium_tank_1");
  ww.land.country(DEU)!.armyXpMilli = 900_000;
  const save = {
    kind: "design_save",
    def: {
      kind: "tank",
      base: "medium_1",
      modules: ["gun_cs", "turret_2", "bogie", "welded", "petrol", "", ""],
      armorLevel: 0,
      engineLevel: 0,
      name: "Med I",
    },
  } as DepthOrder;
  expect(ww.depth.issue(DEU, save, runner.game.ticks())).toBeNull();
  const line = ce.lines.find(
    (l) => l.key === equipKey("infantry_equipment", 1),
  )!;
  expect(line).toBeDefined();
  return { ww, ce, line };
}

describe("P6: line routing to lane E (retention and conversion)", () => {
  it("a retool keeps the design's retention; -1 keeps P1's rule", async () => {
    const { ww, ce, line } = await germany();
    const d = ww.depth;
    ce.addTech("support_eq_1");
    // Two static keys: lane E answers -1, P1's rule.
    const support = equipKey("support_equipment", 1);
    expect(lineRetentionBp(d, DEU, line.key, support)).toBe(-1);
    line.effBp = 8000;
    expect(
      changeLine(ww.economy, ce, line.id, "support_equipment", 1),
    ).toBeNull();
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
    // A static medium tank to a medium-chassis tank design: lane E's 60%
    // (plus P1's retention techs), not P1's rule.
    expect(changeLine(ww.economy, ce, line.id, "medium_tank", 1)).toBeNull();
    const bp = lineRetentionBp(d, DEU, MED1, DESIGN1);
    expect(bp).toBeGreaterThanOrEqual(6_000);
    line.effBp = 8000;
    line.convertFrom = 7;
    expect(changeLine(ww.economy, ce, line.id, "tank_design", 1)).toBeNull();
    expect(line.effBp).toBe(
      Math.max(EFF_FLOOR_BP, Math.floor((8000 * bp) / 10_000)),
    );
    expect(line.key).toBe(DESIGN1);
    expect(line.progress).toBe(0);
    // A retool ends a conversion.
    expect(line.convertFrom).toBe(-1);
  });

  it("a converting line takes its source stock at the conversion cost", async () => {
    const { ww, ce, line } = await germany();
    const d = ww.depth;
    expect(changeLine(ww.economy, ce, line.id, "tank_design", 1)).toBeNull();
    line.convertFrom = MED1;
    ce.stock[MED1] = 3;
    const conv = conversionCostMilli(d, DEU, line.id, DESIGN1)!;
    const full = equipCostMilli(d, DEU, DESIGN1);
    expect(conv).toBeGreaterThan(0);
    expect(conv).toBeLessThan(full);
    // Three conversions' worth of progress; only a conversion takes the
    // source stock.
    line.progress = 3 * conv;
    const before = ce.stock[DESIGN1];
    stepProduction(ww.economy, ce);
    expect(ce.stock[MED1]).toBe(0);
    expect(ce.stock[DESIGN1]).toBeGreaterThanOrEqual(before + 3);
    // Without a conversion (convertFrom -1) the stock is not taken.
    expect(conversionCostMilli(d, DEU, line.id, DESIGN1)).toBeNull();
    line.convertFrom = -1;
    ce.stock[MED1] = 3;
    line.progress = 3 * conv;
    stepProduction(ww.economy, ce);
    expect(ce.stock[MED1]).toBe(3);
  });
});
