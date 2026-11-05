import { CONTENT_PARTS } from "@openfront/engine-lib/ww1936/content/registry";
import { histStaticKeyTable } from "@openfront/engine-lib/ww1936/hist/StaticKeys";
import { STATIC_KEY_STATS } from "@openfront/engine-lib/ww1936/TemplateStats";
import fs from "fs";
import { expect, test } from "vitest";

// ww92: tradeCostPct is the trade units per factory, so plus is more goods.
test("the trade spirits agree with their text: plus is better, minus is worse", () => {
  const trade = (id: string) =>
    CONTENT_PARTS.spirits.find((s) => s.id === id)?.stats.tradeCostPct;
  for (const id of [
    "nat_gbr_commonwealth",
    "usa_neutral_trade_spirit",
    "sun_market_plan",
    "jpn_washington_credit",
    "lat_rubber_trade",
    "lat_export_trade",
    "swe_ore_exports",
    "dnk_farm_exports",
    "bal_arms_contracts",
    "new_trade_terms",
    "chw_frontier_trade",
  ]) {
    expect(trade(id), id).toBeGreaterThan(0);
  }
  expect(trade("nat_jpn_scarce")).toBe(-10);
  expect(trade("ita_sanctions")).toBeLessThan(0);
  // ww100: a boycott is no bonus, and a plus is no cost on the screen.
  expect(trade("mex_oil_boycott")).toBeLessThan(0);
  for (const lang of ["en", "ko"]) {
    const text = fs.readFileSync(`resources/lang/${lang}.json`, "utf8");
    expect(text).toMatch(/"tradeCostPct": "[^"]*(goods|물량)/);
  }
});

test("the client's key table for a minor is weaker than the generic one; a major's is its catalogue", () => {
  const sum = (t: { stats: Int32Array }) => t.stats.reduce((a, b) => a + b, 0);
  expect(sum(histStaticKeyTable("POL"))).toBeLessThan(sum(STATIC_KEY_STATS));
  expect(sum(histStaticKeyTable("DEU"))).not.toBe(sum(STATIC_KEY_STATS));
});
