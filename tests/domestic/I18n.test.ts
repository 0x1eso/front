import { TECH_IDS } from "@openfront/engine-api/domestic/DomesticTypes";
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
  });
});
