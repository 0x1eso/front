// World War 1936 P2 (plan Task 3 Step 3): the front rules over plain data
// (P2 spec §8.1) — the border regions, the front's BFS and the
// largest-remainder split the engine and the screens share.
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import {
  borderRegionsOf,
  frontOf,
  frontSize,
  splitByWeight,
  type FrontWorld,
} from "@openfront/engine-lib/ww1936/FrontRules";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";

const DIR = path.join(__dirname, "../testdata/maps/ww1936mini");
const scenario = ScenarioIndex.fromFiles(
  ScenarioDataSchema.parse(
    JSON.parse(fs.readFileSync(path.join(DIR, "scenario.json"), "utf8")),
  ),
  new Uint8Array(fs.readFileSync(path.join(DIR, "regions.bin"))),
);
const id = (tag: "DEU" | "ITA" | "GBR" | "FRA" | "SUN" | "POL") =>
  scenario.smallIdOf(tag);

/** The test map at the start; `wars` lists the pairs at war. */
function world(
  wars: [number, number][] = [],
  control: Record<number, number> = {},
): FrontWorld {
  const controller = Array.from(scenario.ownerByRegion());
  for (const [r, c] of Object.entries(control)) controller[Number(r)] = c;
  const faction = (s: number) => {
    const tag = scenario.tagOfSmallId(s);
    return tag === undefined ? null : COUNTRIES[tag].faction;
  };
  return {
    scenario,
    controller,
    sameSide: (a, b) =>
      a > 0 &&
      b > 0 &&
      (a === b || (faction(a) !== null && faction(a) === faction(b))),
    isEnemy: (a, b) =>
      wars.some(([x, y]) => (x === a && y === b) || (x === b && y === a)),
  };
}

describe("World War 1936 P2: front rules (P2 spec §8.1)", () => {
  test("splitByWeight: largest remainder, ties to the smaller index", () => {
    expect(splitByWeight(7, [1, 1, 1])).toEqual([3, 2, 2]);
    expect(splitByWeight(6, [10, 10])).toEqual([3, 3]);
    expect(splitByWeight(5, [2, 3])).toEqual([2, 3]);
    expect(splitByWeight(6, [2, 8])).toEqual([1, 5]);
    expect(splitByWeight(10, [3, 3, 4])).toEqual([3, 3, 4]);
    expect(splitByWeight(4, [0, 0])).toEqual([2, 2]);
    expect(splitByWeight(0, [5, 5])).toEqual([0, 0]);
    expect(splitByWeight(3, [])).toEqual([]);
  });

  test("frontSize: a region for every three divisions", () => {
    expect([1, 3, 4, 6, 7, 24].map(frontSize)).toEqual([1, 1, 2, 2, 3, 8]);
    expect(frontSize(0)).toBe(1);
  });

  test("border regions are our side's, against one country or every enemy", () => {
    const deu = id("DEU");
    const pol = id("POL");
    // Rome is Italy's: our side (spec §7.1), and it touches Krakow and Lyon.
    expect(borderRegionsOf(world(), deu, pol)).toEqual([3, 4, 5]);
    // A named enemy counts at war or not: a front before the war.
    expect(borderRegionsOf(world(), deu, id("FRA"))).toEqual([3, 4, 5]);
    // 0: every country we are at war with (only Poland here).
    expect(borderRegionsOf(world([[deu, pol]]), deu, 0)).toEqual([3, 4, 5]);
    expect(borderRegionsOf(world(), deu, 0)).toEqual([]);
    // Poland has no faction: its own regions only.
    expect(borderRegionsOf(world(), pol, deu)).toEqual([6, 7]);
    // Never a front against our own side.
    expect(borderRegionsOf(world(), deu, id("ITA"))).toEqual([]);
    // A region lost to the enemy is no longer ours.
    expect(borderRegionsOf(world([], { 4: pol }), deu, pol)).toEqual([3, 5]);
  });

  test("the front grows breadth-first from its anchor, neighbours by id", () => {
    const deu = id("DEU");
    const pol = id("POL");
    const w = world();
    expect(frontOf(w, deu, pol, 3, 1)).toEqual([3]);
    expect(frontOf(w, deu, pol, 3, 2)).toEqual([3, 4]);
    expect(frontOf(w, deu, pol, 3, 8)).toEqual([3, 4, 5]);
    expect(frontOf(w, deu, pol, 5, 3)).toEqual([5, 4, 3]);
    // Poland: Warsaw and Krakow are linked by their edge.
    expect(frontOf(w, pol, deu, 7, 3)).toEqual([7, 6]);
    // Not a border region: no front.
    expect(frontOf(w, deu, id("SUN"), 3, 3)).toEqual([]);
    expect(frontOf(w, deu, pol, 3, 0)).toEqual([]);
  });

  test("two border regions facing the same enemy region are linked", () => {
    // France holds Munich: Berlin and Rome share no edge, but both face it.
    const deu = id("DEU");
    const fra = id("FRA");
    const w = world([], { 4: fra });
    expect(borderRegionsOf(w, deu, fra)).toEqual([3, 5]);
    expect(frontOf(w, deu, fra, 3, 2)).toEqual([3, 5]);
    expect(frontOf(w, deu, fra, 5, 2)).toEqual([5, 3]);
  });
});
