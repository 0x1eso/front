// ww91 lane N0: the shared machinery of national character. The keys, the
// battalion lines, the national-unit rows, the three combat reads.
import type { BattalionId } from "@openfront/engine-api/ww1936/LandTypes";
import {
  WW_STAT_KEYS,
  type WwStatKey,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  addToSide,
  casualtyReturnShare,
  emptySide,
  FOOT_DEFENCE_ORG_PCT,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { describeStats } from "@openfront/engine-lib/ww1936/Describe";
import { NATIONAL_UNITS } from "@openfront/engine-lib/ww1936/NationalUnits";
import { clampStats, emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  initiativeOf,
  newTacticSide,
} from "@openfront/engine-lib/ww1936/TacticRules";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { describe, expect, test } from "vitest";

const ZERO = techTotals(new Set());
const one = (
  b: readonly BattalionId[],
  s: Partial<Record<WwStatKey, number>> = {},
) =>
  templateStats(
    { name: "", battalions: [...b], support: [] },
    { ...ZERO, ...s },
    GEN1,
  );

describe("national character machinery", () => {
  test("the 14 keys are appended in order and clamp by themselves", () => {
    const tail = WW_STAT_KEYS.slice(-14);
    expect(tail[0]).toBe("infBrkPct");
    expect(tail[13]).toBe("harborRaidPm");
    const s = emptyStats();
    s.tacticInitiative = 40;
    s.natUnit = 20;
    s.wingXpCapMilli = 500;
    s.footDefOrgPp = -90;
    s.infBrkPct = 900;
    clampStats(s);
    expect([s.tacticInitiative, s.natUnit, s.wingXpCapMilli]).toEqual([
      10, 7, 0,
    ]);
    expect([s.footDefOrgPp, s.infBrkPct]).toEqual([-50, 300]);
  });

  test("describeStats skips natUnit", () => {
    const keys = describeStats({ natUnit: 3, infBrkPct: 5 }).map((l) => l.key);
    expect(keys).toEqual(["ww1936.stat.infBrkPct"]);
  });

  test("infBrkPct moves foot breakthrough, not motorized", () => {
    const base = one(["infantry"]).brk;
    expect(one(["infantry"], { infBrkPct: 20 }).brk).toBeGreaterThan(base);
    expect(one(["motorized"], { infBrkPct: 20 }).brk).toBe(
      one(["motorized"]).brk,
    );
  });

  test("supply keys, and the hp / train / supply lines of a national unit", () => {
    const inf = one(["infantry"]).supplyMilli;
    expect(one(["infantry"], { infSupplyPct: -20 }).supplyMilli).toBeLessThan(
      inf,
    );
    const gun = one(["artillery"]).supplyMilli;
    expect(
      one(["artillery"], { artSupplyPct: 20 }).supplyMilli,
    ).toBeGreaterThan(gun);
    expect(one(["artillery"], { infSupplyPct: 20 }).supplyMilli).toBe(gun);
    // Italy's Alpini (natUnit 7): a mountain battalion, hp -10, supply +10.
    const m = one(["mountain"]);
    const alp = one(["mountain"], { natUnit: 7 });
    expect(alp.hpMilli).toBeLessThan(m.hpMilli);
    expect(alp.supplyMilli).toBeGreaterThan(m.supplyMilli);
    expect(alp.brk).toBeGreaterThan(m.brk);
    // Only its own battalion, only with the spirit.
    expect(one(["infantry"], { natUnit: 7 })).toEqual(one(["infantry"]));
    expect(one(["mountain"], { natUnit: 4 })).toEqual(m);
    expect(NATIONAL_UNITS).toHaveLength(7);
    // Commandos train slower (+25 %).
    const mar = one(["marine"]);
    expect(one(["marine"], { natUnit: 4 }).trainDays).toBeGreaterThan(
      mar.trainDays,
    );
  });

  test("footDefOrgPp reaches the division and the side sum", () => {
    const rifle = one(["infantry"]);
    expect(rifle.defOrgPct).toBe(FOOT_DEFENCE_ORG_PCT);
    const stubborn = one(["infantry"], { footDefOrgPp: -5 });
    expect(stubborn.defOrgPct).toBe(FOOT_DEFENCE_ORG_PCT - 5);
    const sum = emptySide();
    addToSide(sum, stubborn, stubborn.orgMilli);
    expect(sum.defOrgPct).toBe(FOOT_DEFENCE_ORG_PCT - 5);
    // Not a foot division: untouched.
    expect(one(["artillery"], { footDefOrgPp: -5 }).defOrgPct).toBe(100);
  });

  test("prepFirePct scales the barrage and its cap", () => {
    const guns = ["artillery", "artillery", "artillery", "infantry"] as const;
    const base = one(guns).prepFireBp;
    expect(base).toBeGreaterThan(0);
    expect(one(guns, { prepFirePct: 25 }).prepFireBp).toBe(
      Math.floor((base * 125) / 100),
    );
    // All guns: the cap, scaled too.
    const all = one(["artillery", "artillery"]).prepFireBp;
    expect(
      one(["artillery", "artillery"], { prepFirePct: 25 }).prepFireBp,
    ).toBe(Math.floor((all * 125) / 100));
  });

  test("tacticInitiative adds points, within 10", () => {
    const s = newTacticSide();
    const v = initiativeOf(s, false);
    s.tacticInitiative = 5;
    expect(initiativeOf(s, false)).toBe(v + 5);
    s.tacticInitiative = -10;
    expect(initiativeOf(s, true)).toBe(Math.max(0, v - 10));
  });

  test("a negative casualtyReturnPp cuts the return share, never below 0", () => {
    expect(casualtyReturnShare(false, 0)).toBe(20);
    expect(casualtyReturnShare(false, -10)).toBe(10);
    expect(casualtyReturnShare(true, -10)).toBe(40);
    expect(casualtyReturnShare(false, -50)).toBe(0);
    expect(casualtyReturnShare(true, 80)).toBe(100);
  });
});
