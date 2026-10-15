import {
  GOVERNMENT_IDS,
  LAW_IDS,
  LAW_OPTIONS,
  TECH_IDS,
} from "@openfront/engine-api/domestic/DomesticTypes";
import fs from "fs";
import path from "path";

function load(lang: string): unknown {
  return JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "..", "resources", "lang", `${lang}.json`),
      "utf8",
    ),
  );
}

function get(obj: unknown, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o !== null && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      obj,
    );
}

const KEYS = [
  "unit_type.research_institute",
  "unit_type.admin_office",
  "build_menu.desc.research_institute",
  "build_menu.desc.admin_office",
  "game_settings.domestic_mode",
  "events_display.research_complete",
  "domestic.panel_title",
  "domestic.recruit_target",
  "domestic.locked_requires",
  "domestic.tab_laws",
  "domestic.tab_government",
  "domestic.law_next_cost",
  "domestic.law_cooldown",
  "domestic.proclaim",
  "domestic.proclaim_with_gold",
  "domestic.proclaimed",
  "domestic.rejected",
  "domestic.gov_current",
  "domestic.gov_tier",
  "domestic.gov_progress",
  "domestic.gov_max_tier",
  "domestic.gov_adopt",
  "domestic.gov_active",
  "domestic.gov_locked",
  "domestic.gov_needs_tier",
  "domestic.gov_passed",
  "domestic.gov_requires_law",
  "events_display.government_tier_reached",
];

describe("domestic translations", () => {
  test.each(["en", "ko"])("%s has every domestic key", (lang) => {
    const json = load(lang);
    for (const key of KEYS) {
      expect(typeof get(json, key), key).toBe("string");
    }
    for (const id of TECH_IDS) {
      expect(typeof get(json, `domestic.tech.${id}.name`), id).toBe("string");
      expect(typeof get(json, `domestic.tech.${id}.desc`), id).toBe("string");
    }
    for (const id of LAW_IDS) {
      expect(typeof get(json, `domestic.law.${id}.name`), id).toBe("string");
      for (const option of LAW_OPTIONS) {
        const key = `domestic.law.${id}.${option}`;
        expect(typeof get(json, `${key}.name`), key).toBe("string");
        expect(typeof get(json, `${key}.desc`), key).toBe("string");
      }
    }
    for (const id of GOVERNMENT_IDS) {
      expect(typeof get(json, `domestic.gov.${id}.name`), id).toBe("string");
      expect(typeof get(json, `domestic.gov.${id}.desc`), id).toBe("string");
    }
  });
});
