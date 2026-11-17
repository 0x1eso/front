// ww236: the tier-A minors' fair 1936 start (MINOR_START): factories added
// to the map's on the world map's historical order of battle, and their
// start divisions. The data against the real scenario, the pure rule, and
// one real-map start.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { CATEGORY_SLOTS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import {
  MAJOR_START,
  MINOR_START,
  MINOR_START_MEN_PER_DIVISION,
  minorStartDivisions,
  startArmy,
} from "@openfront/engine-lib/ww1936/EconomyStart";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { byTag, land, step, wwGameStart } from "./util";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const scenario = ScenarioDataSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "resources/maps/world1936/scenario.json"),
      "utf8",
    ),
  ),
);
const land1936 = scenario.regions;

const TIER_A: readonly CountryTag[] = [
  "POL", "HUN", "ROU", "CSK", "YUG", "FIN", "SWE", "ESN", "ESR", "GRC",
  "BGR", "NOR", "NLD", "BEL", "PRT", "TUR", "BRA", "ARG", "MEX", "CHN",
  "CCP", "MCK", "CAN", "AUS", "ZAF",
]; // prettier-ignore

/** The map's civilian, military factories and dockyards of a country. */
function mapTotals(tag: CountryTag): [number, number, number] {
  const t: [number, number, number] = [0, 0, 0];
  for (const r of land1936) {
    if (r.owner !== tag) continue;
    t[0] += r.civ;
    t[1] += r.mil;
    t[2] += r.dock;
  }
  return t;
}

function startTotals(tag: CountryTag): [number, number, number] {
  const t = mapTotals(tag);
  for (const [, c, m, d] of MINOR_START[tag]?.factories ?? []) {
    t[0] += c;
    t[1] += m;
    t[2] += d;
  }
  return t;
}

describe("MINOR_START data (the real world1936 scenario)", () => {
  test("every row names the country's own region, fits its slots, docks only at a port", () => {
    for (const [tag, m] of Object.entries(MINOR_START)) {
      expect(MAJOR_START[tag as CountryTag]).toBeUndefined();
      for (const [name, civ, mil, dock] of m!.factories) {
        const r = land1936.find((x) => x.name === name && x.owner === tag);
        expect(r, `${tag} ${name}`).toBeDefined();
        expect(civ + mil + dock).toBeGreaterThan(0);
        expect(
          r!.civ + r!.mil + r!.dock + civ + mil + dock,
          `${tag} ${name} slots`,
        ).toBeLessThanOrEqual(CATEGORY_SLOTS[r!.cat]);
        if (dock > 0)
          expect(r!.port ?? r!.coastal, `${tag} ${name}`).toBe(true);
      }
    }
  });

  test("no tier-A minor but Spain's two starts with a single factory; none rivals a major", () => {
    // The smallest major's industry (Italy's 14 civilian, 7 military).
    const majors = Object.keys(MAJOR_START).map((t) => {
      const [c, m] = mapTotals(t as CountryTag);
      return c + m;
    });
    const smallest = Math.min(...majors);
    for (const tag of TIER_A) {
      const [civ, mil] = startTotals(tag);
      // The owner: leave Spain as it is.
      if (tag === "ESN" || tag === "ESR") {
        expect(MINOR_START[tag]).toBeUndefined();
        continue;
      }
      expect(civ + mil, tag).toBeGreaterThanOrEqual(2);
      expect(civ + mil, tag).toBeLessThan(smallest);
    }
    expect(startTotals("POL")).toEqual([9, 4, 1]);
    expect(startTotals("CCP")).toEqual([1, 1, 0]);
  });
});

describe("startArmy with MINOR_START divisions", () => {
  test("historical order of battle only; never below the generic army; majors keep theirs", () => {
    expect(minorStartDivisions("POL", true)).toBe(20);
    expect(minorStartDivisions("POL", false)).toBeUndefined();
    expect(minorStartDivisions("CHN", true)).toBeUndefined();
    // The test maps (no historical order of battle) keep the formula.
    expect(startArmy("POL", 200_000)).toBe(60_000);
    expect(startArmy("POL", 200_000, null, true)).toBe(
      20 * MINOR_START_MEN_PER_DIVISION,
    );
    // 30% of 1,000,000 recruits is more than 20 divisions' men.
    expect(startArmy("POL", 1_000_000, null, true)).toBe(300_000);
    expect(startArmy("DEU", 0, null, true)).toBe(480_000);
  });
});

describe("a real-map start (world1936)", () => {
  test("the minors' factories and divisions; Spain as the map has it", async () => {
    const files = await loadMapFiles(
      new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      files,
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    step(runner, 2);
    const l = land(runner.game);
    const divisions = (tag: CountryTag) => {
      const id = byTag(runner.game, tag).smallID();
      let n = 0;
      for (const a of l.armies.values()) {
        if (a.owner === id) n += a.divisions.length;
      }
      return n;
    };
    const totals = (tag: CountryTag) => {
      const t = l.econ.country(byTag(runner.game, tag).smallID())!.totals;
      return [t.civ, t.mil, t.dock];
    };
    for (const tag of TIER_A)
      expect(totals(tag), tag).toEqual(startTotals(tag));
    expect(totals("DEU")).toEqual(mapTotals("DEU"));
    for (const [tag, m] of Object.entries(MINOR_START)) {
      if (m!.divisions !== undefined) {
        expect(divisions(tag as CountryTag), tag).toBe(m!.divisions);
      }
    }
  }, 120_000);
});
