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
  "game_settings.strategic_weapons",
  "unit_type.conventional_missile",
  "unit_type.satellite",
  "build_menu.desc.conventional_missile",
  "build_menu.desc.satellite",
  "leaderboard.nukes",
  "events_display.nuke_production_started",
  "events_display.nuke_production_done",
  "events_display.nuke_production_lost",
  "events_display.conventional_missile_inbound",
  "events_display.conventional_missile_hit",
  "events_display.satellite_preparing",
  "events_display.satellite_prep_failed",
  "events_display.satellite_in_orbit",
  "events_display.satellite_targeted",
  "events_display.satellite_intercept_hit",
  "events_display.satellite_intercept_miss",
  "events_display.satellite_strike_landed",
  "events_display.satellite_strike_aborted",
  "strategic.stock",
  "strategic.producing",
  "strategic.produce",
  "strategic.no_stock",
  "strategic.needs_factory",
  "strategic.no_free_line",
  "strategic.satellite_busy",
  "strategic.satellite_used",
  "strategic.satellite_ready",
  "strategic.choose_target",
  "strategic.target_title",
  "strategic.no_targets",
  "strategic.band",
  "strategic.seconds_left",
  "strategic.intercept_with",
  "strategic.interceptors_in_flight",
  "strategic.tap_again_to_fire",
  "strategic.tap_again_to_target",
];

describe("strategic weapons translations", () => {
  test.each(["en", "ko"])("%s has every strategic key", (lang) => {
    const json = load(lang);
    for (const key of KEYS) {
      expect(typeof get(json, key), key).toBe("string");
    }
  });

  test("the owner's exact Korean alert", () => {
    expect(get(load("ko"), "events_display.nuke_production_started")).toBe(
      "{name} 핵무기 개발 중",
    );
  });

  test.each(["en", "ko"])("%s keeps the placeholders", (lang) => {
    const json = load(lang);
    expect(get(json, "events_display.satellite_targeted")).toMatch(
      /\{name\}.*\{target\}/,
    );
    expect(get(json, "events_display.satellite_intercept_hit")).toMatch(
      /\{unit\}/,
    );
    expect(get(json, "strategic.band")).toMatch(/\{name\}.*\{target\}/);
    expect(get(json, "strategic.intercept_with")).toMatch(
      /\{unit\}.*\{count\}.*\{pct\}/,
    );
    expect(get(json, "strategic.produce")).toMatch(/\{seconds\}/);
  });
});
