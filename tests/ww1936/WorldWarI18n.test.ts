import {
  COUNTRY_GROUPS,
  COUNTRY_TAGS,
  FACTION_IDS,
} from "@openfront/engine-api/ww1936/Countries";
import fs from "fs";
import path from "path";

const lang = (code: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../resources/lang/${code}.json`),
      "utf8",
    ),
  ) as Record<string, unknown>;

function get(obj: Record<string, unknown>, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o !== null && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      obj,
    );
}

/** {name}s in an ICU message, the plural arguments included. */
function params(msg: string): string[] {
  return [
    ...new Set([...msg.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1])),
  ].sort();
}

const KEYS = [
  ...COUNTRY_TAGS.flatMap((t) => [`ww1936.country.${t}`, `ww1936.leader.${t}`]),
  ...FACTION_IDS.map((f) => `ww1936.faction.${f}`),
  ...COUNTRY_GROUPS.map((g) => `ww1936.group.${g}`),
  ...Array.from(
    { length: 12 },
    (_, i) => `ww1936.month.m${String(i + 1).padStart(2, "0")}`,
  ),
  "ww1936.date",
  "ww1936.band.prep",
  "ww1936.band.wars",
  "ww1936.panel.title",
  "ww1936.panel.my_wars",
  "ww1936.panel.at_peace",
  "ww1936.panel.scores",
  "ww1936.panel.next_history",
  "ww1936.declare.button",
  "ww1936.declare.confirm",
  "ww1936.region.vp",
  "ww1936.region.original_owner",
  "ww1936.win.your_faction",
  "ww1936.win.faction_won",
  "ww1936.win.country_won",
  "ww1936.win.mvp",
  "ww1936.lobby.pick_country",
  "ww1936.lobby.pick_hint",
  "ww1936.lobby.taken_by",
  "events_display.ww1936_prep_over",
  "events_display.ww1936_war_declared",
  "events_display.ww1936_war_joined",
  "events_display.ww1936_capitulated",
  "events_display.ww1936_capitulated_no_victor",
  "domestic.win_reason.ww_score",
  "domestic.win_reason.ww_last_camp",
  "game_settings.world_war_1936",
  "game_settings.historical_ai",
  "map.world1936",
];

describe("World War 1936 texts (CLAUDE.md: en + ko)", () => {
  const en = lang("en");
  const ko = lang("ko");

  test.each(KEYS)(
    "%s is in English and Korean with the same parameters",
    (key) => {
      const e = get(en, key);
      const k = get(ko, key);
      expect(typeof e, `en ${key}`).toBe("string");
      expect(typeof k, `ko ${key}`).toBe("string");
      expect(params(k as string)).toEqual(params(e as string));
    },
  );

  test("no other language file mentions the mode", () => {
    const dir = path.join(__dirname, "../../resources/lang");
    for (const f of fs.readdirSync(dir)) {
      if (f === "en.json" || f === "ko.json" || !f.endsWith(".json")) continue;
      expect(fs.readFileSync(path.join(dir, f), "utf8"), f).not.toContain(
        "ww1936",
      );
    }
  });
});
