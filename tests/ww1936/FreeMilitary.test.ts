// World War 1936 ww15: the national army, navy and air experience is gone.
// Designs and templates are free, a focus's experience reward is a permanent
// bonus. (The trait and officer corps refusals live in Command.test, the
// free commander in Generals.test, the 20 battle day trait in Command.test.)
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { scaleFocusEffects } from "@openfront/engine-lib/ww1936/FocusScale";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { pol, step, stepTo, wwRestore, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

type Def = Extract<DepthOrder, { kind: "design_save" }>["def"];
const GBR = DEEP.tag.GBR;
const HUMANS = [{ clientID: "HUMAN001", country: "GBR" as const }];

async function game() {
  const runner = await wwRunner({}, HUMANS, DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 2);
  return { runner, ww: runner.game.worldWar()! };
}

describe("ww15: free designs and a permanent experience reward", () => {
  it("tank designs and copies are saved with nothing to pay", async () => {
    const { runner, ww } = await game();
    const ce = ww.economy.country(GBR)!;
    for (const t of WW_TECH_IDS) ce.addTech(t);
    const d = ww.depth;
    const def: Def = {
      kind: "tank",
      base: "medium_1",
      modules: ["gun_cs", "turret_2", "bogie", "welded", "petrol", "", ""],
      armorLevel: 2,
      engineLevel: 2,
      name: "Med I",
    };
    const tick = runner.game.ticks();
    expect(d.issue(GBR, { kind: "design_save", def }, tick)).toBeNull();
    expect(
      d.issue(
        GBR,
        { kind: "design_copy", from: 1, def: { ...def, armorLevel: 0 } },
        tick,
      ),
    ).toBeNull();
    // The cell rule: a copy into the same cell overwrites it in place.
    expect(d.country(GBR)!.des.tank.filter((x) => x !== null)).toHaveLength(1);
    expect(
      (d.designSlot(GBR, "tank", 1)!.def as { armorLevel: number }).armorLevel,
    ).toBe(0);
  });

  it("a focus's army_xp stacks as a permanent bonus that survives days and a restore", async () => {
    const { runner, ww } = await game();
    const p = pol(runner.game);
    const focus = (amount: number) =>
      scaleFocusEffects([{ kind: "army_xp", amount }]);
    const run = (fx: ReturnType<typeof focus>) =>
      applyEffects(makeCtx(p, GBR, GBR, 0, runner.game.ticks()), fx);
    const stat = () => ww.economy.country(GBR)!.stats.divXpGainPct;
    const base = stat();
    // 10 x 3 = 30 experience = 2% (halves up: 1.5), then 20 x 3 = 3%.
    run(focus(10));
    step(runner, 2);
    expect(stat()).toBe(base + 2);
    run(focus(20));
    step(runner, 2);
    expect(stat()).toBe(base + 5);
    // No timer: 400 days later it is still there.
    step(runner, 15 * 400);
    expect(stat()).toBe(base + 5);
    const b = await wwRestore(runner, HUMANS, DEEP.map);
    expect(b.game.worldWar()!.economy.country(GBR)!.stats.divXpGainPct).toBe(
      base + 5,
    );
  }, 60_000);
});
