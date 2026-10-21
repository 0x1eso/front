import {
  BATTALION_IDS,
  GENERAL_TRAITS,
  LAND_TERRAINS,
  STANCES,
  SUPPORT_IDS,
  WEATHERS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { startTemplates } from "@openfront/engine-lib/ww1936/LandStart";
import fs from "fs";
import IntlMessageFormat from "intl-messageformat";
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

function params(msg: string): string[] {
  return [
    ...new Set([...msg.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1])),
  ].sort();
}

const TEMPLATE_KEYS = (() => {
  const keys = new Set<string>();
  for (const tag of ["DEU", "ITA", "JPN", "GBR", "FRA", "USA", "SUN", "POL"]) {
    for (const dev of [1, 2, 3, 4]) {
      for (const t of startTemplates(tag as never, dev)) keys.add(t.key);
    }
  }
  return [...keys];
})();

const EXP_LEVELS = ["recruit", "regular", "veteran", "elite"];
const MODS = [
  "general",
  "trait",
  "doctrine",
  "exp",
  "plan",
  "recon",
  "engineer",
  "mountain",
  "marine",
  "armor_terrain",
  "terrain",
  "river",
  "strait",
  "fort",
  "excess",
  "supply",
  "weather",
  "encircled",
  "entrench",
];
const LAND = [
  "army_name_1",
  "army_name_2",
  "army_name_3",
  "army_name_n",
  "titled_general",
  "dial",
  "band_divisions",
  "band_casualties",
  "tab_armies",
  "tab_training",
  "tab_templates",
  "tab_generals",
  "divisions_of",
  "readiness",
  "supply",
  "state_idle",
  "state_moving",
  "state_battle",
  "state_encircled",
  "state_rail",
  "state_sea",
  "state_retreat",
  "state_executing",
  "state_para",
  "btn_move",
  "btn_attack",
  "btn_front",
  "btn_plan",
  "btn_rail",
  "btn_sea",
  "btn_split",
  "btn_merge",
  "btn_auto",
  "btn_more",
  "btn_disband",
  "btn_general",
  "btn_execute",
  "btn_stop",
  "btn_leave_battle",
  "tap_again",
  "preview_ratio",
  "preview_days",
  "move_days",
  "train_plus",
  "deploy_now",
  "waiting_manpower",
  "waiting_equipment",
  "manpower_pool",
  "equipment_short",
  "designer_xp",
  "designer_save",
  "designer_copy",
  "designer_delete",
  "designer_name",
  "slot_empty",
  "locked_by",
  "factory_days",
  "stat_width",
  "stat_men",
  "stat_soft",
  "stat_hard",
  "stat_defense",
  "stat_breakthrough",
  "stat_org",
  "stat_hp",
  "stat_armor",
  "stat_pierce",
  "stat_hardness",
  "stat_speed",
  "stat_supply",
  "stat_train_days",
  "stat_equipment",
  "general_from",
  "general_until",
  "general_level",
  "general_skills",
  "battle_width",
  "battle_line",
  "battle_reserve",
  "region_terrain",
  "region_weather",
  "region_fort",
  "region_rail",
  "region_supply",
  "region_rivers",
  "region_divisions",
  "region_encircled",
  // "overseas" ("landings come in a later phase") went with P4's landings
  // (lane U: a dead key).
];
const NOTICES = [
  "ww1936_division_ready",
  "ww1936_region_taken",
  "ww1936_region_lost",
  "ww1936_encircled",
  "ww1936_divisions_destroyed",
  "ww1936_general_available",
  "ww1936_general_lost",
  "ww1936_no_tile_attacks",
];

const KEYS = [
  ...BATTALION_IDS.map((b) => `ww1936.battalion.${b}`),
  ...SUPPORT_IDS.map((b) => `ww1936.support.${b}`),
  ...TEMPLATE_KEYS.map((k) => `ww1936.tpl.${k}`),
  ...LAND_TERRAINS.map((k) => `ww1936.terrain.${k}`),
  ...WEATHERS.map((k) => `ww1936.weather.${k}`),
  ...GENERAL_TRAITS.map((k) => `ww1936.trait.${k}`),
  ...GENERAL_TRAITS.map((k) => `ww1936.trait_desc.${k}`),
  ...STANCES.map((k) => `ww1936.stance.${k}`),
  ...EXP_LEVELS.map((k) => `ww1936.exp.${k}`),
  ...MODS.map((k) => `ww1936.mod.${k}`),
  ...LAND.map((k) => `ww1936.land.${k}`),
  "ww1936.econ.block.infra_max",
  ...NOTICES.map((k) => `events_display.${k}`),
];

// Values that are pure numbers or placeholders read the same in both tongues.
const SAME_IN_BOTH = new Set([
  "ww1936.land.train_plus",
  "ww1936.land.divisions_of",
]);

describe("World War 1936 P2 land war strings", () => {
  const en = lang("en");
  const ko = lang("ko");

  it("covers every template key the start builds", () => {
    expect(TEMPLATE_KEYS.length).toBe(17);
  });

  it.each(KEYS)("%s is in en and ko with the same placeholders", (key) => {
    const e = get(en, key);
    const k = get(ko, key);
    expect(typeof e).toBe("string");
    expect(typeof k).toBe("string");
    expect(params(k as string)).toEqual(params(e as string));
    if (!SAME_IN_BOTH.has(key)) expect(k).not.toBe(e);
    // Both must parse as ICU messages.
    new IntlMessageFormat(e as string, "en");
    new IntlMessageFormat(k as string, "ko");
  });

  it("the army names read right in English", () => {
    const say = (n: number) =>
      new IntlMessageFormat(
        get(en, `ww1936.land.army_name_${n === 1 ? "1" : "n"}`) as string,
        "en",
      ).format({ n });
    expect(say(1)).toBe("1st Army");
    expect(say(5)).toBe("5th Army");
  });

  it("the destroyed-divisions notice reads right for one and several", () => {
    const say = (code: string, msg: unknown, count: number) =>
      new IntlMessageFormat(msg as string, code).format({
        count,
        region: "Warsaw",
      });
    const e = get(en, "events_display.ww1936_divisions_destroyed");
    expect(say("en", e, 1)).toBe("1 division destroyed at Warsaw");
    expect(say("en", e, 3)).toBe("3 divisions destroyed at Warsaw");
    expect(
      say("ko", get(ko, "events_display.ww1936_divisions_destroyed"), 2),
    ).toBe("Warsaw에서 사단 2개 섬멸");
  });
});
