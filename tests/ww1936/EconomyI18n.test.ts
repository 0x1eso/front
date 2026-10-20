import {
  BUILDING_IDS,
  CONSCRIPTION_LAWS,
  DOCTRINE_SCHOOLS,
  ECONOMY_LAWS,
  EQUIPMENT_TYPES,
  LAW_KINDS,
  REGION_CATEGORIES,
  RESOURCE_IDS,
  TECH_BRANCHES,
  TRADE_LAWS,
  WW_ORDER_BLOCKS,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
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

function params(msg: string): string[] {
  return [
    ...new Set([...msg.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1])),
  ].sort();
}

const ECON = [
  "industry",
  "research",
  "tab_construction",
  "tab_production",
  "tab_trade",
  "tab_laws",
  "free_civs",
  "consumer_goods",
  "trade_civs",
  "new_build",
  "add_to_queue",
  "days_left",
  "no_civs_assigned",
  "build_here",
  "slots",
  "mil_factories",
  "new_line",
  "change_line",
  "efficiency",
  "after_switch",
  "per_day",
  "stockpile",
  "coverage",
  "produced",
  "exported",
  "imported",
  "used",
  "balance",
  "buy",
  "open_trade",
  "close_trade",
  "my_deals",
  "selling",
  "sellers_none",
  "cooldown",
  "recruitable",
  "manpower",
  "troops",
  "draft_today",
  "troop_cap",
  "combat",
  "slot_empty",
  "ahead",
  "cancel_tap",
  "remove_tap",
  "occupied_note",
  "population",
  "state_done",
  "state_running",
  "state_available",
  "state_prereq",
  "state_doctrine",
  "factories",
  "export_room",
  "region_buildings",
  "stock_only",
];
const EFFECTS = [
  "constructionPct",
  "slotPct",
  "effCapBp",
  "outputPct",
  "extractionPct",
  "retentionBp",
  "researchPct",
  "attackPct",
  "defensePct",
  "speedPct",
  "vehicleBonusPct",
  "gunBonusPct",
  "recruitablePct",
  "trainPct",
  "unlock",
];
const LAW_NEED = [
  "partial_mobilization",
  "war_economy",
  "service",
  "total_mobilization",
  "all_adults",
  "scraping",
  "extensive",
];

const KEYS = [
  ...BUILDING_IDS.map((b) => `ww1936.building.${b}`),
  ...RESOURCE_IDS.map((r) => `ww1936.res.${r}`),
  ...EQUIPMENT_TYPES.map((e) => `ww1936.equip.${e}`),
  ...[1, 2, 3].map((g) => `ww1936.gen.${g}`),
  ...REGION_CATEGORIES.map((c) => `ww1936.region_cat.${c}`),
  ...LAW_KINDS.map((k) => `ww1936.law_kind.${k}`),
  ...ECONOMY_LAWS.map((l) => `ww1936.law.economy.${l}`),
  ...TRADE_LAWS.map((l) => `ww1936.law.trade.${l}`),
  ...CONSCRIPTION_LAWS.map((l) => `ww1936.law.conscription.${l}`),
  ...TECH_BRANCHES.map((b) => `ww1936.branch.${b}`),
  ...DOCTRINE_SCHOOLS.map((s) => `ww1936.school.${s}`),
  ...WW_TECH_IDS.map((t) => `ww1936.tech.${t}`),
  ...EFFECTS.map((e) => `ww1936.effect.${e}`),
  ...WW_ORDER_BLOCKS.map((b) => `ww1936.econ.block.${b}`),
  ...LAW_NEED.map((v) => `ww1936.econ.law_need.${v}`),
  ...ECON.map((e) => `ww1936.econ.${e}`),
  ...[
    "ww1936_research_done",
    "ww1936_built",
    "ww1936_trade_closed",
    "ww1936_slot_free",
  ].map((e) => `events_display.${e}`),
];

describe("World War 1936 P1 economy strings", () => {
  const en = lang("en");
  const ko = lang("ko");

  it("has the expected number of block reasons", () => {
    expect(WW_ORDER_BLOCKS.length).toBe(25);
  });

  it.each(KEYS)("%s exists in en and ko with matching placeholders", (key) => {
    const e = get(en, key);
    const k = get(ko, key);
    expect(typeof e).toBe("string");
    expect(typeof k).toBe("string");
    expect(params(k as string)).toEqual(params(e as string));
    if (!key.startsWith("ww1936.gen.")) expect(k).not.toBe(e);
  });
});
