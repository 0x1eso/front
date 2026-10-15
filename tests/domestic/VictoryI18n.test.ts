import {
  VICTORY_PROJECT_KINDS,
  WIN_REASONS,
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
  "domestic.tab_victory",
  "domestic.victory.active",
  "domestic.victory.conquest",
  "domestic.victory.cost_political",
  "domestic.victory.cost_science",
  "domestic.victory.host_level",
  "domestic.victory.no_hosts",
  "domestic.victory.none_active",
  "domestic.victory.paused",
  "domestic.victory.progress",
  "domestic.victory.requirement_political",
  "domestic.victory.requirement_science",
  "domestic.victory.score",
  "domestic.victory.start",
  "domestic.victory.time_left",
  "events_display.victory_project_complete",
  "events_display.victory_project_failed",
  "events_display.victory_project_started",
  "game_settings.conquest_percent",
  "leaderboard.score",
];
const BLOCKS = ["busy", "requirement", "host", "gold", "political"];

describe("domestic victory translations", () => {
  test.each(["en", "ko"])("%s has every victory key", (lang) => {
    const json = load(lang);
    for (const key of KEYS) {
      expect(typeof get(json, key), key).toBe("string");
    }
    for (const kind of VICTORY_PROJECT_KINDS) {
      expect(typeof get(json, `domestic.project.${kind}.name`), kind).toBe(
        "string",
      );
      expect(typeof get(json, `domestic.project.${kind}.desc`), kind).toBe(
        "string",
      );
    }
    for (const reason of WIN_REASONS) {
      expect(typeof get(json, `domestic.win_reason.${reason}`), reason).toBe(
        "string",
      );
    }
    for (const block of BLOCKS) {
      expect(typeof get(json, `domestic.victory.blocked.${block}`), block).toBe(
        "string",
      );
    }
  });
});
