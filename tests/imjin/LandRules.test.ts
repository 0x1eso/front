import {
  aiAttackOrder,
  aiDefenceStance,
  imjinRound,
  rowMixOf,
  type RoundInput,
} from "@openfront/engine-lib/imjin/LandRound";
import {
  ambushFx,
  ambushHidden,
  battleStep,
  breachDaysFor,
  chargeResult,
  crossingOf,
  feintFlips,
  gapLands,
  inCrossing,
  isRoundTick,
  orderFx,
  paddyWet,
  phaseRoundsLeft,
  routCascade,
  rowDealtMulPct,
  siegeDay,
  stepOrders,
  terrainRow,
  volleyBeat,
  volleyModeOf,
  type RowHitCtx,
} from "@openfront/engine-lib/imjin/LandRules";

const ctx = (c: Partial<RowHitCtx>): RowHitCtx => ({
  row: "arquebus",
  defending: true,
  step: "clash",
  terrain: terrainRow("plain"),
  fx: orderFx("advance", "hold", false),
  beat: "none",
  enemySpearPct: 0,
  crossing: null,
  targetRouted: false,
  hwachaUsed: false,
  ...c,
});

describe("Imjin land rules", () => {
  test("cadence: a round every 5 ticks, orders switch at the phase", () => {
    expect(isRoundTick(105, 100)).toBe(true);
    expect(isRoundTick(103, 100)).toBe(false);
    expect(phaseRoundsLeft(1)).toBe(9);
    expect(battleStep(5, false)).toBe("opening");
    expect(battleStep(6, false)).toBe("clash");
    const slot = { current: "hold", pending: "ambush" };
    expect(stepOrders(slot, 5, 0)).toBe(slot);
    expect(stepOrders(slot, 11, 1)).toBe(slot);
    expect(stepOrders(slot, 11, 0)).toEqual({
      current: "ambush",
      pending: null,
    });
  });

  test("terrain: wet paddy by state, walls only for the defender", () => {
    expect(paddyWet(6, true)).toBe(true);
    expect(paddyWet(6, false)).toBe(false);
    expect(terrainRow("paddy", true).charge).toBe(false);
    expect(terrainRow("paddy", false).charge).toBe(true);
    const walled = terrainRow("walled");
    expect(rowDealtMulPct(ctx({ terrain: walled }))).toBe(120);
    expect(rowDealtMulPct(ctx({ terrain: walled, defending: false }))).toBe(
      100,
    );
    // Cannon lose 60 % in a pass; archers there gain 40 %.
    const pass = terrainRow("pass");
    expect(rowDealtMulPct(ctx({ row: "cannon", terrain: pass }))).toBe(40);
    expect(rowDealtMulPct(ctx({ row: "archer", terrain: pass }))).toBe(140);
  });

  test("the volley clock: massed fires every third round", () => {
    expect(volleyModeOf("massed_volley", 40)).toBe("massed");
    expect(volleyModeOf("massed_volley", 20)).toBe("rolling");
    expect(volleyModeOf("hold", 0)).toBe("none");
    const beats = [1, 2, 3, 4].map((r) => volleyBeat("massed", r));
    expect(beats).toEqual(["fire", "reload", "reload", "fire"]);
    expect(rowDealtMulPct(ctx({ beat: "fire" }))).toBe(300); // plain +20, ×2.5
    expect(rowDealtMulPct(ctx({ beat: "reload" }))).toBe(0);
    // Arquebus fire only arrives in the opening's ranged rows; samurai wait.
    expect(rowDealtMulPct(ctx({ row: "samurai", step: "opening" }))).toBe(0);
    expect(rowDealtMulPct(ctx({ row: "samurai", step: "clash" }))).toBe(130);
  });

  test("a charge into the loaded volley, or into the gap", () => {
    expect(chargeResult("massed", false, 0)).toMatchObject({
      takenMulPct: 300,
      chargerMorale: 200,
    });
    expect(chargeResult("massed", true, 0)).toMatchObject({
      dealtMulPct: 200,
      defenderMorale: 150,
    });
    // A spear line halves the charge's bonus.
    expect(chargeResult("massed", true, 30)).toMatchObject({
      dealtMulPct: 150,
      defenderMorale: 75,
    });
    // Skill 5 always finds the gap; the roll is stateless.
    expect(gapLands(7, 3, 100, 11, 5)).toBe(true);
    const hits = Array.from({ length: 200 }, (_, i) =>
      gapLands(7, 3, 100, i, 0),
    );
    expect(hits.filter(Boolean).length).toBeGreaterThan(70);
    expect(hits.filter(Boolean).length).toBeLessThan(130);
    expect(gapLands(9, 4, 50, 21, 1)).toBe(gapLands(9, 4, 50, 21, 1));
  });

  test("ambush in a pass, halved by a careful march", () => {
    expect(ambushHidden("pass", "ambush", 2)).toBe(true);
    expect(ambushHidden("pass", "ambush", 1)).toBe(false);
    expect(ambushHidden("plain", "ambush", 5)).toBe(false);
    expect(ambushFx("pass", false)).toEqual({
      lockPhases: 2,
      widthNum: 1,
      widthDen: 3,
      takenMulPct: 200,
      morale: 150,
    });
    expect(ambushFx("forest", true)).toMatchObject({
      lockPhases: 1,
      takenMulPct: 125,
      morale: 75,
    });
  });

  test("crossings, the frozen river and the feigned retreat", () => {
    const big = crossingOf("great_river", false, false, false);
    expect(big.allowed).toBe(false);
    expect(crossingOf("great_river", false, false, true).allowed).toBe(true);
    expect(crossingOf("great_river", true, false, false)).toMatchObject({
      phases: 1,
      attackerPct: -20,
      allowed: true,
    });
    expect(inCrossing(big, 20)).toBe(true);
    expect(inCrossing(big, 21)).toBe(false);
    const strike = orderFx("advance", "strike_crossing", true);
    expect(strike.defPct).toBe(50);
    expect(orderFx("advance", "strike_crossing", false).defPct).toBe(-20);
    const small = crossingOf("small_river", false, false, false);
    expect(
      rowDealtMulPct(ctx({ row: "spear", defending: false, crossing: small })),
    ).toBe(70);
    expect(feintFlips("feigned_retreat", "counter_charge")).toBe(true);
    expect(feintFlips("feigned_retreat", "hold")).toBe(false);
    // A counter zeroes the order's own effect.
    expect(orderFx("flank", "withdraw", false).defMoraleHit).toBe(0);
    expect(orderFx("flank", "hold", false).defMoraleHit).toBe(100);
  });

  test("routs cascade through the line, slowed by commanders", () => {
    const r = routCascade([100, 200, 205, 400], [false, false, false, false]);
    expect(r.routed).toEqual([true, true, true, false]);
    expect(r.morale[3]).toBe(340);
    const held = routCascade([100, 200, 205, 400], [false, true, false, false]);
    expect(held.routed).toEqual([true, false, false, false]);
    expect(held.morale[1]).toBe(170);
  });

  test("sieges: breach by cannon, then starve", () => {
    const walled = terrainRow("walled");
    const fortress = terrainRow("fortress");
    expect(breachDaysFor(2, walled, false)).toBe(6);
    expect(breachDaysFor(3, fortress, false)).toBe(18);
    expect(breachDaysFor(3, fortress, true)).toBe(12);
    let s = { grainDays: 1, fort: 1, breachDays: 0, morale: 500 };
    for (let d = 0; d < 3; d++) s = siegeDay(s, "breach", true, false, walled);
    expect(s).toEqual({ grainDays: 0, fort: 0, breachDays: 0, morale: 400 });
  });
});

describe("the Imjin round in the 1936 loop (LandRound)", () => {
  const base: RoundInput = {
    seed: 7,
    region: 3,
    battleStart: 0,
    round: 6,
    terrain: "plain",
    wet: false,
    att: {
      order: "advance",
      mix: rowMixOf("JPN"),
      skill: 0,
      hwachaUsed: false,
    },
    def: { order: "hold", mix: rowMixOf("JOS"), skill: 0, hwachaUsed: true },
    crossing: null,
    fort: 0,
    ambushed: false,
    broken: false,
  };
  it("the opening is the bows' and guns', a fortress doubles the defence", () => {
    const open = imjinRound({ ...base, round: 1 });
    const clash = imjinRound(base);
    expect(open.step).toBe("opening");
    expect(open.attDealtPct).toBeLessThan(clash.attDealtPct);
    const walls = imjinRound({ ...base, terrain: "fortress", fort: 3 });
    expect(walls.attDealtPct * 2).toBeLessThanOrEqual(clash.attDealtPct);
    expect(walls.defDealtPct).toBeGreaterThan(clash.defDealtPct);
  });
  it("massed fire beats on the clock; an ambush narrows and hurts", () => {
    const vol = { ...base.att, order: "volley_advance" as const };
    const fire = imjinRound({ ...base, round: 7, att: vol });
    const reload = imjinRound({ ...base, round: 8, att: vol });
    expect(fire.attBeat).toBe("fire");
    expect(reload.attBeat).toBe("reload");
    expect(fire.attDealtPct).toBeGreaterThan(reload.attDealtPct);
    const amb = imjinRound({
      ...base,
      round: 1,
      terrain: "pass",
      ambushed: true,
    });
    expect(amb.widthNum * 3).toBeLessThanOrEqual(amb.widthDen);
    expect(amb.attMorale).toBeGreaterThan(0);
  });
  it("the AI storms a fort and counters the order it met", () => {
    // At walls only the wall orders (I5a: an arquebus-heavy army may also
    // volley up to them), never a field order.
    for (let roll = 0; roll < 6; roll++) {
      expect(["storm", "barrage", "volley_advance"]).toContain(
        aiAttackOrder(rowMixOf("JPN"), "walled", 2, null, roll),
      );
    }
    expect(aiDefenceStance(rowMixOf("JOS"), "charge", 1)).toBe("hold");
  });
});
