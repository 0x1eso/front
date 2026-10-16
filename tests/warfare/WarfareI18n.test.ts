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
  "game_settings.warfare_expansion",
  "unit_type.coastal_battery",
  "unit_type.airport",
  "unit_type.coastal_barrage",
  "unit_type.bomber",
  "unit_type.transport_plane",
  "unit_type.cargo_plane",
  "build_menu.desc.coastal_battery",
  "build_menu.desc.airport",
  "build_menu.desc.coastal_barrage",
  "build_menu.desc.bomber",
  "events_display.barrage_inbound",
  "events_display.paradrop_inbound",
  "events_display.bomber_inbound",
  "events_display.bombing_detonated",
  "events_display.bomber_evaded",
  "events_display.plane_shot_down",
  "events_display.no_airport_available",
  "radial_menu.paradrop_title",
  "radial_menu.paradrop_description",
  "touch_ui.needs_airport",
];

describe("expanded warfare translations", () => {
  test.each(["en", "ko"])("%s has every warfare key", (lang) => {
    const json = load(lang);
    for (const key of KEYS) {
      expect(typeof get(json, key), key).toBe("string");
    }
  });

  test.each(["en", "ko"])("%s keeps the event placeholders", (lang) => {
    const json = load(lang);
    expect(get(json, "events_display.paradrop_inbound")).toMatch(/\{name\}/);
    expect(get(json, "events_display.paradrop_inbound")).toMatch(/\{troops\}/);
    expect(get(json, "events_display.bombing_detonated")).toMatch(/\{name\}/);
    expect(get(json, "events_display.plane_shot_down")).toMatch(/\{unit\}/);
  });

  test("the unlocking techs mention their warfare units", () => {
    const en = load("en");
    expect(get(en, "domestic.tech.rocketry.desc")).toMatch(/barrage/i);
    expect(get(en, "domestic.tech.fortification.desc")).toMatch(/battery/i);
    expect(get(en, "domestic.tech.industrialization.desc")).toMatch(/airport/i);
  });
});
