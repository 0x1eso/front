import {
  campScores,
  CountryScoreInput,
  lastCampStanding,
  rankMembers,
  scoreBp,
} from "@openfront/engine-lib/ww1936/Score";

const c = (
  smallID: number,
  faction: CountryScoreInput["faction"],
  vp: number,
  tiles: number,
  major = false,
  alive = true,
): CountryScoreInput => ({ smallID, faction, vp, tiles, major, alive });

describe("the 1936 score (spec §7.6)", () => {
  test("70% victory points and 30% land, in whole basis points", () => {
    expect(scoreBp(46, 5000, 142, 20300)).toBe(2267 + 738);
    expect(scoreBp(0, 0, 0, 0)).toBe(0);
  });

  test("factions add up their members; unaligned countries stand alone", () => {
    const camps = campScores(
      [
        c(1, "axis", 25, 3500, true),
        c(2, "axis", 21, 1500, true),
        c(3, "allies", 21, 300, true),
        c(4, "allies", 24, 4000, true),
        c(5, "comintern", 27, 8000, true),
        c(6, null, 24, 3000),
      ],
      142,
      20300,
    );
    expect(camps.map((x) => x.camp)).toEqual([
      "axis",
      "allies",
      "comintern",
      6,
    ]);
    expect(camps[0]).toMatchObject({
      members: [1, 2],
      vp: 46,
      tiles: 5000,
      scoreBp: 3005,
      livingMajors: 2,
    });
  });

  test("ties go to more victory points, then the fixed camp order; dead camps drop out", () => {
    const camps = campScores(
      [
        c(1, "axis", 10, 100),
        c(2, null, 10, 100),
        c(3, "allies", 10, 100, false, false),
      ],
      100,
      1000,
    );
    expect(camps.map((x) => x.camp)).toEqual(["axis", 2]);
  });

  test("the last camp with a living major", () => {
    const camps = campScores(
      [
        c(1, "axis", 10, 100, true),
        c(2, "allies", 10, 100, true, false),
        c(3, null, 5, 50),
      ],
      100,
      1000,
    );
    expect(lastCampStanding(camps)?.camp).toBe("axis");
    expect(
      lastCampStanding(
        campScores([c(1, "axis", 1, 1, true), c(2, null, 1, 1, true)], 2, 2),
      ),
    ).toBeNull();
  });

  test("MVP order inside a camp", () => {
    const inputs = [
      c(1, "axis", 5, 100),
      c(2, "axis", 20, 100),
      c(3, "allies", 50, 100),
    ];
    expect(
      rankMembers(inputs, [1, 2], 100, 1000).map((r) => r.smallID),
    ).toEqual([2, 1]);
  });
});
