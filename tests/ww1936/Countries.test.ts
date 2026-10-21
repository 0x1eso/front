import {
  COUNTRIES,
  COUNTRY_TAGS,
  DORMANT_TAGS,
  FACTION_LEADER,
  isCountryTag,
  isDormantTag,
  MAJOR_TAGS,
  PICK_ORDER,
} from "@openfront/engine-api/ww1936/Countries";
import fs from "fs";
import path from "path";

const FLAGS = path.join(__dirname, "../../resources/flags");
// Spec §5.4: the Rising Sun flag is never a country's flag.
const FORBIDDEN_FLAGS = ["Empire of Japan", "Empire of Japan1"];
// Spec §5.4, §11: no flag bearing a swastika either (1936 Germany flies the
// black-white-red tricolour, "German Empire").
const FORBIDDEN_FLAG_NAME =
  /nazi|third.?reich|swastika|hakenkreuz|kriegsflagge|reichskriegs|rising.?sun/i;

describe("the 1936 country table", () => {
  test("79 unique tags and P5's 14 dormant slots, each with a definition", () => {
    expect(COUNTRY_TAGS).toHaveLength(79 + 14);
    expect(new Set(COUNTRY_TAGS).size).toBe(79 + 14);
    expect(COUNTRY_TAGS.slice(79)).toEqual([...DORMANT_TAGS]);
    expect(Object.keys(COUNTRIES).sort()).toEqual([...COUNTRY_TAGS].sort());
    expect(isCountryTag("DEU")).toBe(true);
    expect(isCountryTag("KOR")).toBe(false);
  });

  test("seven majors and three fixed factions led by Germany, Britain and the Soviet Union", () => {
    expect([...MAJOR_TAGS]).toEqual([
      "DEU",
      "ITA",
      "JPN",
      "GBR",
      "FRA",
      "USA",
      "SUN",
    ]);
    const members = (f: string) =>
      COUNTRY_TAGS.filter((t) => COUNTRIES[t].faction === f);
    expect(members("axis")).toEqual(["DEU", "ITA", "JPN", "MCK"]);
    expect(members("allies")).toEqual([
      "GBR",
      "FRA",
      "RAJ",
      "ZAF",
      "CAN",
      "AUS",
      "NZL",
    ]);
    expect(members("comintern")).toEqual(["SUN", "MNG", "TTU"]);
    expect(FACTION_LEADER).toEqual({
      axis: "DEU",
      allies: "GBR",
      comintern: "SUN",
    });
  });

  test("every flag exists; none is the Rising Sun or bears a swastika", () => {
    for (const tag of COUNTRY_TAGS) {
      const flag = COUNTRIES[tag].flag;
      expect(FORBIDDEN_FLAGS, tag).not.toContain(flag);
      expect(flag, tag).not.toMatch(FORBIDDEN_FLAG_NAME);
      expect(
        fs.existsSync(path.join(FLAGS, `${flag}.svg`)),
        `${tag}: ${flag}`,
      ).toBe(true);
    }
    expect(COUNTRIES.JPN.flag).toBe("jp");
    expect(COUNTRIES.DEU.flag).toBe("German Empire");
  });

  test("the pick order lists every country once, majors first", () => {
    expect(PICK_ORDER.slice(0, 7)).toEqual([
      "DEU",
      "GBR",
      "SUN",
      "USA",
      "FRA",
      "ITA",
      "JPN",
    ]);
    // P5 plan decision 3: never a dormant slot.
    expect([...PICK_ORDER].sort()).toEqual(
      COUNTRY_TAGS.filter((t) => !isDormantTag(t)).sort(),
    );
  });

  test("names are Latin only (the map's label font)", () => {
    for (const tag of COUNTRY_TAGS) {
      // P5: the civil-war slots are numbered ("Breakaway State 1").
      expect(COUNTRIES[tag].name, tag).toMatch(/^[A-Za-z0-9 .-]+$/);
    }
  });
});
