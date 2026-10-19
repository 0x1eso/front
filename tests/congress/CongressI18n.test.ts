import {
  AGENDA_REASONS,
  EMERGENCY_KINDS,
  INFLUENCE_STATUSES,
  RESOLUTION_IDS,
} from "@openfront/engine-api/congress/CongressTypes";
import fs from "fs";
import path from "path";

function load(lang: string): Record<string, unknown> {
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

function leaves(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix === "" ? k : `${prefix}.${k}`),
  );
}

const KEYS = [
  "game_settings.congress",
  "domestic.screen.congress",
  "leaderboard.congress",
  "events_display.congress_adopted",
  "events_display.congress_adopted_target",
  "events_display.congress_adopted_pair",
  "events_display.congress_tied",
  "events_display.congress_tied_target",
  "events_display.congress_tied_pair",
  "events_display.congress_emergency_available",
  "events_display.congress_emergency_convened",
  "events_display.congress_emergency_rejected",
  "events_display.congress_emergency_started",
  "events_display.congress_emergency_success",
  "events_display.congress_emergency_success_nohero",
  "events_display.congress_emergency_failed",
  "events_display.congress_patent",
  "events_display.world_gov_awaiting",
  "congress.dial.influence",
  "congress.toast.adopted",
  "congress.toast.tied",
  "congress.chip.until_project",
  "congress.banned",
  "congress.banned_reason",
  "congress.discounted",
  "congress.goal.land",
  "congress.goal.silos",
  "congress.param.tradeShip",
  "congress.param.train",
  ...[
    "adopted",
    "b_only",
    "bad",
    "collapsed",
    "extra",
    "good",
    "no_seat",
    "tied",
    "turnout",
    "your_vote",
  ].map((k) => `congress.card.${k}`),
  ...[
    "active",
    "available",
    "available_target",
    "convene",
    "member",
    "target",
    "voting",
  ].map((k) => `congress.band.${k}`),
  ...[
    "unavailable",
    "window",
    "target",
    "seat",
    "friendly",
    "sanctioned",
    "influence",
  ].map((k) => `congress.block.${k}`),
  ...[
    "active",
    "aggressors",
    "available",
    "cooldown",
    "emergencies_left",
    "emergency",
    "history",
    "influence",
    "next_session",
    "not_ratified",
    "none",
    "rate",
    "victims",
    "voting_now",
    "world_gov",
    "world_gov_ratified",
  ].map((k) => `congress.screen.${k}`),
  ...RESOLUTION_IDS.flatMap((id) =>
    ["name", "a", "b", "a_effect", "b_effect"].map(
      (k) => `congress.resolution.${id}.${k}`,
    ),
  ),
  ...EMERGENCY_KINDS.map((k) => `congress.emergency.${k}`),
  ...AGENDA_REASONS.map((r) => `congress.reason.${r}`),
  ...INFLUENCE_STATUSES.map((s) => `congress.status.${s}`),
];

describe("world congress strings", () => {
  test.each(["en", "ko"])("%s has every key", (lang) => {
    const strings = load(lang);
    const missing = KEYS.filter((k) => typeof get(strings, k) !== "string");
    expect(missing).toEqual([]);
  });

  test("ko has exactly en's congress keys", () => {
    expect(leaves(get(load("ko"), "congress")).sort()).toEqual(
      leaves(get(load("en"), "congress")).sort(),
    );
  });

  test("the Korean names are the spec's", () => {
    const ko = load("ko");
    expect(get(ko, "game_settings.congress")).toBe("세계 의회");
    expect(get(ko, "congress.resolution.sanction.name")).toBe("경제 제재");
    expect(get(ko, "congress.resolution.world_government.a")).toBe("승인");
    expect(get(ko, "congress.emergency.nuclear")).toBe("핵 비상");
  });
});
