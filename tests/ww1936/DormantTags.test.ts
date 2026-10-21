// World War 1936 P5 (spec §3.2, §18.1; plan decision 37): the dormant slots.
import {
  CIVIL_WAR_SLOTS,
  COUNTRIES,
  COUNTRY_TAGS,
  DORMANT_TAGS,
  NAMED_DORMANT_TAGS,
} from "@openfront/engine-api/ww1936/Countries";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import fs from "fs";
import path from "path";
import { hasKey } from "./contentUtil";
import { END_CORES } from "./endgameFixture";

const FLAGS = path.join(__dirname, "../../resources/flags");
const FORBIDDEN_FLAG_NAME = [
  /empire of japan/i,
  /nazi/i,
  /ustas/i,
  /rising/i,
  /swastika/i,
  /hakenkreuz/i,
  /fasces/i,
];
/** The named slots with a land of their own from the start (spec §7.1). */
const WITH_CORES = ["SVK", "HRV", "MEN", "BRM", "PHL"] as const;

describe("World War 1936 P5: the dormant slots", () => {
  it("14 slots in order: the eight named, then the six civil-war slots", () => {
    expect([...NAMED_DORMANT_TAGS]).toEqual([
      "SVK",
      "HRV",
      "VIC",
      "RSI",
      "RNG",
      "MEN",
      "BRM",
      "PHL",
    ]);
    expect([...CIVIL_WAR_SLOTS]).toEqual([
      "CW1",
      "CW2",
      "CW3",
      "CW4",
      "CW5",
      "CW6",
    ]);
    expect([...DORMANT_TAGS]).toEqual([
      ...NAMED_DORMANT_TAGS,
      ...CIVIL_WAR_SLOTS,
    ]);
    expect(COUNTRY_TAGS.slice(-14)).toEqual([...DORMANT_TAGS]);
  });

  it("the named slots with land hold its cores from 1936", () => {
    // Until K5's CORES_1936 merges, the test content holds Slovakia's.
    const cores = CONTENT.cores.length > 0 ? CONTENT.cores : END_CORES;
    const tags = CONTENT.cores.length > 0 ? WITH_CORES : (["SVK"] as const);
    for (const t of tags) {
      const row = cores.find((c) => c.tag === t);
      expect(row, t).toBeDefined();
      expect(row!.groups.length, t).toBeGreaterThan(0);
    }
  });

  it("every flag exists and is a simple shape, never a banned emblem", () => {
    for (const t of DORMANT_TAGS) {
      const flag = COUNTRIES[t].flag;
      expect(
        fs.existsSync(path.join(FLAGS, `${flag}.svg`)),
        `${t} ${flag}`,
      ).toBe(true);
      for (const bad of FORBIDDEN_FLAG_NAME) expect(flag, t).not.toMatch(bad);
    }
    for (const ideo of ["democratic", "communist", "fascist", "neutral"]) {
      const f = path.join(FLAGS, `ww_cw_${ideo}.svg`);
      expect(fs.existsSync(f), ideo).toBe(true);
      const svg = fs.readFileSync(f, "utf8");
      expect(
        svg.startsWith(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">',
        ),
      ).toBe(true);
      expect(svg).not.toMatch(/<image|<text|<use/);
    }
  });

  it("no Korean or Taiwanese country", () => {
    for (const t of COUNTRY_TAGS) {
      expect(/^(KOR|TWN|CHO|FOR)/.test(t), t).toBe(false);
    }
  });

  it("every dormant slot has its name and leader in English and Korean", () => {
    for (const t of DORMANT_TAGS) {
      expect(hasKey(`ww1936.country.${t}`), t).toBe(true);
      expect(hasKey(`ww1936.leader.${t}`), t).toBe(true);
    }
    for (const ideo of ["democratic", "communist", "fascist", "neutral"]) {
      expect(hasKey(`ww1936.cw_name.${ideo}`), ideo).toBe(true);
    }
  });
});
