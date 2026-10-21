// World War 1936 P4 (plan Task 1 Step 25, decisions 24, 25): the P3 effects,
// conditions, stats and seats P4 adds.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { ADVISOR_SLOTS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { clampStats, sumStats } from "@openfront/engine-lib/ww1936/Stats";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import { HUMAN, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const HUMANS = [{ clientID: HUMAN, country: "GBR" as const }];
const CONVOY = equipKey("convoy", 1);

async function game() {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  const ww = runner.game.worldWar()!;
  const ctx = makeCtx(ww.politics, TAG_ID.GBR, 0, 0, runner.game.ticks());
  return { runner, ww, ctx };
}

describe("politics P4 wiring", () => {
  it("ships effect commissions in the best naval base", async () => {
    const { ww, ctx } = await game();
    applyEffects(ctx, [{ kind: "ships", cls: "dd", gen: 1, count: 2 }]);
    const fleets = ww.navy.fleetsOf(TAG_ID.GBR);
    expect(fleets).toHaveLength(1);
    expect(fleets[0].docked).toBe(REGION.london);
    expect(fleets[0].ships).toHaveLength(2);
    // A named port that is the actor's working base.
    applyEffects(ctx, [
      { kind: "ships", cls: "cl", gen: 1, count: 1, port: REGION.malta },
    ]);
    expect(ww.navy.fleetsOf(TAG_ID.GBR).map((f) => f.docked)).toEqual([
      REGION.london,
      REGION.malta,
    ]);
  });

  it("convoys effect adds and removes", async () => {
    const { ww, ctx } = await game();
    const ce = ww.economy.country(TAG_ID.GBR)!;
    const start = ce.stock[CONVOY];
    applyEffects(ctx, [{ kind: "convoys", amount: 100 }]);
    expect(ce.stock[CONVOY]).toBe(start + 100);
    applyEffects(ctx, [{ kind: "convoys", amount: -1000 }]);
    expect(ce.stock[CONVOY]).toBe(0);
  });

  it("fuel effect clamps to capacity", async () => {
    const { ww, ctx } = await game();
    const ce = ww.economy.country(TAG_ID.GBR)!;
    applyEffects(ctx, [{ kind: "fuel", amount: 100_000 }]);
    const cap = ce.fuelMilli;
    expect(cap).toBeGreaterThan(0);
    applyEffects(ctx, [{ kind: "fuel", amount: 10 }]);
    expect(ce.fuelMilli).toBe(cap);
    applyEffects(ctx, [{ kind: "fuel", amount: -100_000 }]);
    expect(ce.fuelMilli).toBe(0);
  });

  it("navy_size and fuel_ratio_below", async () => {
    const { ww, ctx } = await game();
    ww.navy.createFleet(TAG_ID.GBR, REGION.london, [
      ["bb", 1, 2],
      ["dd", 1, 3],
    ]);
    expect(evalCondition(ctx, { kind: "navy_size", min: 5 })).toBe(true);
    expect(evalCondition(ctx, { kind: "navy_size", min: 6 })).toBe(false);
    expect(evalCondition(ctx, { kind: "navy_size", min: 2, cls: "bb" })).toBe(
      true,
    );
    expect(evalCondition(ctx, { kind: "navy_size", min: 3, cls: "bb" })).toBe(
      false,
    );
    const ce = ww.economy.country(TAG_ID.GBR)!;
    expect(evalCondition(ctx, { kind: "fuel_ratio_below", pct: 50 })).toBe(
      false,
    );
    ce.fuelRatioPm = 499;
    expect(evalCondition(ctx, { kind: "fuel_ratio_below", pct: 50 })).toBe(
      true,
    );
  });

  it("new stat keys clamp", () => {
    const s = clampStats(
      sumStats([
        {
          invasionCapacity: 25,
          navyXpMilli: 20_000,
          casPct: 400,
          bombDamageTakenPct: -120,
        },
      ]),
    );
    expect(s.invasionCapacity).toBe(20);
    expect(s.navyXpMilli).toBe(10_000);
    expect(s.casPct).toBe(300);
    expect(s.bombDamageTakenPct).toBe(-90);
  });

  it("navy_chief and air_chief slots exist", async () => {
    const { ww } = await game();
    expect(ADVISOR_SLOTS.slice(-2)).toEqual(["navy_chief", "air_chief"]);
    const c = ww.politics.country(TAG_ID.GBR)!;
    expect(c.advisors).toHaveLength(ADVISOR_SLOTS.length);
  });
});
