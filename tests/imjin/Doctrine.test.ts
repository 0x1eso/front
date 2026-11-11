// ww177 P7b: each country's doctrine (ww177-doctrine.md): the armies by
// state, the walls by their level, the AI's own ways, and the gun clock.
import {
  doctrineAttackOrder,
  doctrineDefenceStance,
  NO_DOCTRINE,
  perksOf,
  rowMixFor,
} from "@openfront/engine-lib/imjin/Doctrine";
import {
  imjinRound,
  type RoundInput,
} from "@openfront/engine-lib/imjin/LandRound";
import { stormMulPct } from "@openfront/engine-lib/imjin/LandRules";
import {
  gunsOnVolley,
  heavyFires,
  inReload,
  prizeGuns,
  shipStats,
} from "@openfront/engine-lib/imjin/SeaRules";
import { describe, expect, it } from "vitest";

const ROLLS = Array.from({ length: 24 }, (_, i) => i * 7 + 1);

describe("doctrine by state", () => {
  it("Joseon's army changes: captured guns, then the 훈련도감's two steps; Japan learns from Ming", () => {
    expect(rowMixFor("JOS", NO_DOCTRINE).arquebus).toBeUndefined();
    expect(rowMixFor("JOS", { ...NO_DOCTRINE, josArqPts: 6 }).arquebus).toBe(5);
    const first = rowMixFor("JOS", { ...NO_DOCTRINE, hullyeonDays: 180 });
    const full = rowMixFor("JOS", { ...NO_DOCTRINE, hullyeonDays: 360 });
    expect(first.arquebus).toBe(25);
    expect(full.arquebus).toBe(30);
    for (const m of [first, full])
      expect(Object.values(m).reduce((a, b) => a + (b ?? 0), 0)).toBe(100);
    expect(
      rowMixFor("JPN", { ...NO_DOCTRINE, jpnLearned: true }).arquebus,
    ).toBe(35);
    expect(
      perksOf("JOS", { ...NO_DOCTRINE, hullyeonDays: 200 }).spearGuard,
    ).toBe(true);
    expect(
      perksOf("MIN", { ...NO_DOCTRINE, mingRelief: true }).halvesShock,
    ).toBe(true);
  });

  it("walls by their level; ladders at 3 to 1; a walled town stormed from many sides", () => {
    expect(stormMulPct(1)).toEqual({ attacker: 80, defender: 125 });
    expect(stormMulPct(2)).toEqual({ attacker: 65, defender: 140 });
    expect(stormMulPct(3)).toEqual({ attacker: 50, defender: 150 });
    const jp = rowMixFor("JPN", NO_DOCTRINE);
    const base: RoundInput = {
      seed: 1,
      region: 5,
      battleStart: 0,
      round: 12,
      terrain: "walled",
      wet: false,
      att: { order: "storm", mix: jp, skill: 0, hwachaUsed: true },
      def: {
        order: "hold",
        mix: rowMixFor("JOS", NO_DOCTRINE),
        skill: 0,
        hwachaUsed: true,
      },
      crossing: null,
      fort: 1,
      ambushed: false,
      broken: false,
    };
    const plain = imjinRound(base);
    const perks = perksOf("JPN", NO_DOCTRINE);
    const ladders = imjinRound({
      ...base,
      att: { ...base.att, perks },
      ratioPct: 300,
    });
    expect(ladders.attDealtPct).toBeGreaterThan(plain.attDealtPct);
    const fortress = imjinRound({
      ...base,
      fort: 3,
      att: { ...base.att, perks },
      ratioPct: 300,
    });
    expect(fortress.attDealtPct).toBeLessThan(ladders.attDealtPct);
    const sides = imjinRound({ ...base, sides: 3 });
    expect(sides.widthNum * plain.widthDen).toBeGreaterThan(
      plain.widthNum * sides.widthDen,
    );
    // By moonlight the defender's bows lose their aim.
    const moon = imjinRound({
      ...base,
      att: { ...base.att, perks },
      lunarDay: 15,
      round: 2,
    });
    const dark = imjinRound({
      ...base,
      att: { ...base.att, perks },
      lunarDay: 1,
      round: 2,
    });
    expect(moon.defDealtPct).toBeLessThan(dark.defDealtPct);
  });

  it("each AI fights its own way", () => {
    const jp = rowMixFor("JPN", NO_DOCTRINE);
    const min = rowMixFor("MIN", NO_DOCTRINE);
    const jos = rowMixFor("JOS", NO_DOCTRINE);
    for (const r of ROLLS) {
      expect(doctrineAttackOrder("JPN", jp, "walled", 1, null, r)).toBe(
        "storm",
      );
      expect(doctrineAttackOrder("JPN", jp, "plain", 0, null, r)).not.toBe(
        "charge",
      );
      expect(
        doctrineAttackOrder("MIN", min, "walled", 2, null, r, { phase: 1 }),
      ).toBe("barrage");
      expect(
        doctrineAttackOrder("MIN", min, "walled", 2, null, r, { phase: 3 }),
      ).toBe("storm");
      expect(
        doctrineDefenceStance("JOS", jos, "storm", r, { fort: 1 }),
      ).not.toBe("counter_charge");
    }
    const opens = ROLLS.map((r) =>
      doctrineAttackOrder("JPN", jp, "plain", 0, null, r),
    );
    expect(opens).toContain("volley_advance");
    expect(opens).toContain("flank");
  });

  it("the gun clock: heavy guns every third volley, rippling down the line", () => {
    const pan = shipStats("panokseon");
    const fired = [1, 2, 3, 4, 5, 6].map((v) => gunsOnVolley(pan, v, 0));
    expect(fired).toEqual([2, 2, 11, 2, 2, 11]);
    expect(heavyFires(1, 2)).toBe(true);
    expect(inReload(pan, 1, 0)).toBe(true);
    expect(inReload(pan, 3, 0)).toBe(false);
    expect(inReload(shipStats("sekibune"), 1, 0)).toBe(false);
    expect(prizeGuns("atakebune", 12)).toBe(2);
    expect(prizeGuns("sekibune", 9)).toBe(0);
    expect(prizeGuns("sekibune", 10)).toBe(1);
  });
});
