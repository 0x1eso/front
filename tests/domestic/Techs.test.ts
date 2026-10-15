import { TECH_IDS } from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";

describe("tech tree data", () => {
  test("every tech id has a definition with a matching id", () => {
    expect(Object.keys(TECHS).sort()).toEqual([...TECH_IDS].sort());
    for (const id of TECH_IDS) {
      expect(TECHS[id].id).toBe(id);
    }
  });

  test("eras hold 5 / 6 / 6 / 4 techs", () => {
    const counts = [1, 2, 3, 4].map(
      (era) => TECH_IDS.filter((id) => TECHS[id].era === era).length,
    );
    expect(counts).toEqual([5, 6, 6, 4]);
  });

  test("prerequisites point to the same or an earlier era", () => {
    for (const id of TECH_IDS) {
      for (const p of TECHS[id].prereqs) {
        expect(TECHS[p].era).toBeLessThanOrEqual(TECHS[id].era);
      }
    }
  });

  test("costs and times follow the era table; space program costs 4000", () => {
    expect(TECHS.currency.cost).toBe(100);
    expect(TECHS.currency.seconds).toBe(20);
    expect(TECHS.railroad.cost).toBe(250);
    expect(TECHS.radar.cost).toBe(500);
    expect(TECHS.mirv.cost).toBe(1000);
    expect(TECHS.mirv.seconds).toBe(60);
    expect(TECHS.space_program.cost).toBe(4000);
  });

  test("each locked unit is unlocked by exactly one tech", () => {
    const unlocked = TECH_IDS.flatMap((id) => [...TECHS[id].unlocks]).sort();
    expect(unlocked).toEqual(
      [
        UnitType.AtomBomb,
        UnitType.Factory,
        UnitType.HydrogenBomb,
        UnitType.MIRV,
        UnitType.MissileSilo,
        UnitType.SAMLauncher,
        UnitType.Warship,
      ].sort(),
    );
  });
});
