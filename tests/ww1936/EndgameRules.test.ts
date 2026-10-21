// World War 1936 P5 (plan Task 1 Step 5): the endgame's pure rules, which
// the engine and the screens share (spec §6, §8, §9, §12, §13, §15, §3.5).
import type { TemplateDef } from "@openfront/engine-api/ww1936/LandTypes";
import {
  autonomyDelta,
  AutonomyIn,
  civilWarColor,
  civilWarShareBp,
  complianceCap,
  complianceStep,
  CostMods,
  demandCost,
  divisionSuppression,
  garrisonNeed,
  hslToRgb,
  lendLeaseConvoys,
  llBlock,
  LlIn,
  llLimitBlock,
  occupationShare,
  participantPoints,
  regionBaseValue,
  resistanceStep,
  resistanceTarget,
  ResTargetIn,
  rgbToHsl,
  turnOrder,
  volunteerBlock,
  volunteerCap,
  VolunteerIn,
} from "@openfront/engine-lib/ww1936/EndgameRules";

const NO_MODS: CostMods = {
  controls: false,
  core: false,
  claim: false,
  conquerGoal: false,
  otherControls: false,
};
/** +0 for −0 (a step of nothing). */
const z = (n: number) => n + 0;

describe("World War 1936 P5: the endgame's pure rules", () => {
  it("base value follows spec §6.3", () => {
    // Warsaw: 35 points, 6 factories, 3,200 tiles.
    expect(regionBaseValue(35, 6, 3200)).toBe(87);
    expect(demandCost(87, { ...NO_MODS, controls: true })).toBe(43);
    expect(demandCost(87, { ...NO_MODS, controls: true, core: true })).toBe(21);
    expect(demandCost(87, NO_MODS)).toBe(87);
    expect(demandCost(1, { ...NO_MODS, controls: true, core: true })).toBe(1);
    expect(demandCost(10, { ...NO_MODS, otherControls: true })).toBe(20);
  });

  it("points never exceed the pool and follow shares", () => {
    const pts = participantPoints(100, [700, 290, 10]);
    expect(pts).toEqual([91, 37, 1]);
    expect(pts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(130);
    expect(participantPoints(100, [0, 0])).toEqual([65, 65]);
    expect(participantPoints(100, [])).toEqual([]);
  });

  it("snake order", () => {
    expect(turnOrder([5, 9, 9], [3, 2, 7], 1)).toEqual([2, 7, 3]);
    expect(turnOrder([5, 9, 9], [3, 2, 7], 2)).toEqual([3, 7, 2]);
    expect(turnOrder([5, 9, 9], [3, 2, 7], 3)).toEqual([2, 7, 3]);
  });

  it("resistance target", () => {
    const base: ResTargetIn = {
      coreHolderFighting: true,
      law: "occ_military",
      compBp: 0,
      coveragePct: 100,
      exileLegitBp: 0,
      statPct: 0,
    };
    expect(resistanceTarget(base)).toBe(3500);
    expect(resistanceTarget({ ...base, coveragePct: 0 })).toBe(7000);
    expect(resistanceTarget({ ...base, law: "occ_martial" })).toBe(4900);
    expect(resistanceTarget({ ...base, compBp: 10000 })).toBe(1750);
    expect(resistanceTarget({ ...base, exileLegitBp: 5000 })).toBe(4000);
    expect(resistanceTarget({ ...base, coreHolderFighting: false })).toBe(2000);
    expect(resistanceTarget({ ...base, statPct: 200 })).toBe(10000);
    expect(resistanceTarget({ ...base, statPct: -90 })).toBe(0);
  });

  it("resistance step", () => {
    expect(resistanceStep(0, 6000, 0)).toBe(15);
    expect(resistanceStep(5900, 6000, 0)).toBe(4);
    // No garrison: it never goes down.
    expect(z(resistanceStep(6000, 0, 0))).toBe(0);
    expect(resistanceStep(6000, 0, 100)).toBe(-30);
    expect(resistanceStep(6000, 0, 50)).toBe(-15);
    expect(resistanceStep(100, 99, 100)).toBe(-1);
    expect(resistanceStep(500, 500, 100)).toBe(0);
  });

  it("compliance step and cap", () => {
    const at = (law: "occ_civil" | "occ_military" | "occ_martial") =>
      complianceStep({ compBp: 0, resBp: 0, law, statPct: 0, capBp: 10000 });
    expect(at("occ_military")).toBe(8);
    expect(at("occ_civil")).toBe(12);
    expect(at("occ_martial")).toBe(2);
    expect(
      complianceStep({
        compBp: 100,
        resBp: 5000,
        law: "occ_military",
        statPct: 0,
        capBp: 10000,
      }),
    ).toBe(-1);
    // Never past the cap, never below 0.
    expect(
      complianceStep({
        compBp: 7995,
        resBp: 0,
        law: "occ_military",
        statPct: 0,
        capBp: complianceCap(true),
      }),
    ).toBe(5);
    expect(
      z(
        complianceStep({
          compBp: 0,
          resBp: 9000,
          law: "occ_military",
          statPct: 0,
          capBp: 10000,
        }),
      ),
    ).toBe(0);
    expect(complianceCap(true)).toBe(8000);
    expect(complianceCap(false)).toBe(10000);
  });

  it("shares at the edges", () => {
    expect(occupationShare("occupied", 0, "occ_military")).toEqual({
      factoryPct: 20,
      manpowerPct: 0,
    });
    expect(occupationShare("occupied", 10000, "occ_military")).toEqual({
      factoryPct: 80,
      manpowerPct: 5,
    });
    expect(occupationShare("occupied", 10000, "occ_martial")).toEqual({
      factoryPct: 90,
      manpowerPct: 0,
    });
    expect(occupationShare("occupied", 0, "occ_civil")).toEqual({
      factoryPct: 10,
      manpowerPct: 5,
    });
    expect(occupationShare("annexed", 0, "occ_military")).toEqual({
      factoryPct: 50,
      manpowerPct: 0,
    });
    expect(occupationShare("annexed", 10000, "occ_military")).toEqual({
      factoryPct: 100,
      manpowerPct: 10,
    });
  });

  it("garrison need", () => {
    // Spec §8.5's example: 3,000 tiles, resistance 40%.
    expect(garrisonNeed(3000, 4000, "occ_military", 0)).toBe(32);
    expect(garrisonNeed(3000, 4000, "occ_civil", 0)).toBe(19);
    expect(garrisonNeed(3000, 4000, "occ_military", -15)).toBe(27);
  });

  it("suppression", () => {
    const tpl = (
      battalions: TemplateDef["battalions"],
      support: TemplateDef["support"] = [],
    ): TemplateDef => ({ name: "t", battalions, support });
    const infantry9 = tpl(new Array(9).fill("infantry"));
    expect(divisionSuppression(infantry9, 1000)).toBe(90);
    const cav = tpl(new Array(4).fill("cavalry"), ["military_police"]);
    expect(divisionSuppression(cav, 1000)).toBe(110);
    expect(divisionSuppression(cav, 500)).toBe(55);
    expect(divisionSuppression(tpl(["infantry"]), 499)).toBe(4);
    expect(divisionSuppression(tpl(["artillery"]), 1000)).toBe(0);
  });

  it("autonomy", () => {
    // Canada: 18 factories under Britain's 90.
    const ca: AutonomyIn = {
      subjFactories: 18,
      overlordFactories: 90,
      ideologyDiffers: false,
      fightingDivs: 0,
      overlordDivsInSubject: 0,
      llFromOverlord: 0,
      tightening: false,
      statPct: 0,
    };
    expect(autonomyDelta(ca)).toBe(4);
    expect(autonomyDelta({ ...ca, ideologyDiffers: true })).toBe(6);
    expect(autonomyDelta({ ...ca, fightingDivs: 12 })).toBe(6);
    expect(autonomyDelta({ ...ca, overlordDivsInSubject: 5 })).toBe(2);
    expect(autonomyDelta({ ...ca, llFromOverlord: 250 })).toBe(2);
    expect(autonomyDelta({ ...ca, tightening: true })).toBe(-6);
    // ×150%, truncated toward 0: −7 → −10.5 → −10.
    expect(
      autonomyDelta({
        ...ca,
        tightening: true,
        llFromOverlord: 100,
        statPct: 50,
      }),
    ).toBe(-10);
    expect(autonomyDelta({ ...ca, statPct: 50 })).toBe(6);
  });

  it("volunteer cap and block", () => {
    expect(volunteerCap(50, 30)).toBe(5);
    expect(volunteerCap(200, 60)).toBe(12);
    expect(volunteerCap(12, 3)).toBe(2);
    const ok: VolunteerIn = {
      self: false,
      targetAtWar: true,
      atWarWithTargetEnemy: false,
      atWarWithTarget: false,
      senderDemocracy: false,
      tensionPct: 0,
      senderDivs: 50,
      targetDivs: 30,
      alreadySent: 0,
      armyDivs: 4,
      ruleBlocks: false,
    };
    expect(volunteerBlock(ok)).toBeNull();
    expect(
      volunteerBlock({ ...ok, senderDemocracy: true, tensionPct: 20 }),
    ).toBe("volunteer_conditions");
    expect(
      volunteerBlock({ ...ok, senderDemocracy: true, tensionPct: 25 }),
    ).toBe(null);
    expect(volunteerBlock({ ...ok, targetAtWar: false })).toBe(
      "volunteer_conditions",
    );
    expect(volunteerBlock({ ...ok, ruleBlocks: true })).toBe(
      "volunteer_conditions",
    );
    expect(volunteerBlock({ ...ok, senderDivs: 9 })).toBe(
      "volunteer_conditions",
    );
    expect(volunteerBlock({ ...ok, alreadySent: 4, armyDivs: 2 })).toBe(
      "volunteer_limit",
    );
  });

  it("lend-lease conditions", () => {
    const ok: LlIn = {
      self: false,
      atWarWithEachOther: false,
      bothActors: true,
      receiverAtWar: true,
      tensionPct: 0,
      senderDemocracy: false,
      senderLendLeaseFlag: false,
      senderNoLendLeaseRule: false,
    };
    expect(llBlock(ok)).toBeNull();
    expect(llBlock({ ...ok, self: true })).toBe("ll_conditions");
    expect(llBlock({ ...ok, atWarWithEachOther: true })).toBe("ll_conditions");
    expect(llBlock({ ...ok, bothActors: false })).toBe("ll_conditions");
    // The receiver at peace: only with world tension at 50%.
    expect(llBlock({ ...ok, receiverAtWar: false, tensionPct: 49 })).toBe(
      "ll_conditions",
    );
    expect(llBlock({ ...ok, receiverAtWar: false, tensionPct: 50 })).toBeNull();
    expect(llBlock({ ...ok, senderNoLendLeaseRule: true })).toBe(
      "ll_conditions",
    );
    // A democracy: the lend_lease flag or tension 40%.
    expect(llBlock({ ...ok, senderDemocracy: true, tensionPct: 39 })).toBe(
      "ll_conditions",
    );
    expect(
      llBlock({ ...ok, senderDemocracy: true, senderLendLeaseFlag: true }),
    ).toBeNull();
    expect(
      llBlock({ ...ok, senderDemocracy: true, tensionPct: 40 }),
    ).toBeNull();
    expect(llLimitBlock(9)).toBeNull();
    expect(llLimitBlock(10)).toBe("ll_limit");
    // Spec §13.3's example.
    expect(lendLeaseConvoys(40, 7500)).toBe(6);
  });

  it("civil war share is clamped", () => {
    expect(civilWarShareBp(2000)).toBe(3000);
    expect(civilWarShareBp(8000)).toBe(7000);
    expect(civilWarShareBp(5000)).toBe(5000);
  });

  it("civil war colours are integer and stable", () => {
    const a = civilWarColor([200, 60, 70], "communist");
    expect(civilWarColor([200, 60, 70], "communist")).toEqual(a);
    for (const v of a) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
    expect(civilWarColor([128, 128, 128], "neutral")).toEqual(
      civilWarColor([128, 128, 128], "neutral"),
    );
    // A fixed pseudo-random walk over 1,000 colours.
    let seed = 12345;
    const next = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed >>> 24;
    };
    for (let i = 0; i < 1000; i++) {
      const c: [number, number, number] = [next(), next(), next()];
      const back = hslToRgb(...rgbToHsl(c));
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(back[k] - c[k]), `${c} → ${back}`).toBeLessThanOrEqual(
          2,
        );
      }
    }
  });
});
