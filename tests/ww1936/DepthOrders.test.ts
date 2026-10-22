// World War 1936 P6 (spec §21.4, plan decision 4): every depth order goes
// to its lane (the stubs answer with the lane's refusal), over the wire
// and to dead countries.
import type { DepthOrder, WwOrder } from "@openfront/engine-api/Schemas";
import { WwOrderSchema } from "@openfront/engine-api/Schemas";
import { DEPTH_ORDER_KINDS } from "@openfront/engine-api/ww1936/DepthTypes";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture, TEST_TANK } from "./depthFixture";
import { order, step, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

/** One valid example of each of the 57 orders. */
const SAMPLES: Record<(typeof DEPTH_ORDER_KINDS)[number], DepthOrder> = {
  doctrine_pick: { kind: "doctrine_pick", domain: "land", id: "gd_mobile" },
  subdoctrine_pick: {
    kind: "subdoctrine_pick",
    track: "infantry",
    id: "inf_elastic",
  },
  army_spirit_pick: {
    kind: "army_spirit_pick",
    category: "land_recruit",
    id: "as_conscript",
  },
  trait_assign: {
    kind: "trait_assign",
    general: 1,
    trait: "trickster",
    admiral: false,
  },
  promote_fm: { kind: "promote_fm", general: 1, trait: "fm_thorough" },
  ag_create: { kind: "ag_create", fm: 1, armies: [1] },
  ag_add: { kind: "ag_add", group: 1, army: 1 },
  ag_remove: { kind: "ag_remove", group: 1, army: 1 },
  ag_disband: { kind: "ag_disband", group: 1 },
  ag_front: { kind: "ag_front", group: 1, frontRegions: [3], enemy: 4 },
  ag_execute: { kind: "ag_execute", group: 1 },
  ag_auto: { kind: "ag_auto", group: 1, on: true },
  medal_award: { kind: "medal_award", army: 1, medal: "medal_valor" },
  army_priority: { kind: "army_priority", army: 1, value: 2 },
  design_save: { kind: "design_save", def: TEST_TANK },
  design_copy: { kind: "design_copy", from: 1, def: TEST_TANK },
  design_obsolete: { kind: "design_obsolete", design: "tank", slot: 1 },
  design_rename: {
    kind: "design_rename",
    design: "tank",
    slot: 1,
    name: "New",
  },
  ship_refit: { kind: "ship_refit", ship: 1, slot: 1 },
  line_convert: { kind: "line_convert", line: 1, from: 0 },
  mio_pick: {
    kind: "mio_pick",
    family: "mio_armor",
    archetype: "state_arsenal",
  },
  mio_trait: { kind: "mio_trait", family: "mio_armor", trait: "p1" },
  mio_invest: { kind: "mio_invest", family: "mio_armor" },
  licence_request: { kind: "licence_request", from: 2, key: 0 },
  licence_answer: { kind: "licence_answer", request: 1, accept: true },
  licence_cancel: { kind: "licence_cancel", licence: 1 },
  market_list: { kind: "market_list", key: 0, count: 10 },
  market_unlist: { kind: "market_unlist", listing: 1 },
  market_buy: { kind: "market_buy", listing: 1, count: 1 },
  embargo: { kind: "embargo", target: 2 },
  embargo_lift: { kind: "embargo_lift", target: 2 },
  intel_found: { kind: "intel_found" },
  intel_upgrade: { kind: "intel_upgrade", id: "ag_ops_1" },
  operative_recruit: { kind: "operative_recruit" },
  operative_assign: {
    kind: "operative_assign",
    operative: 1,
    target: 2,
    mission: "build_network",
  },
  operative_recall: { kind: "operative_recall", operative: 1 },
  operation_start: {
    kind: "operation_start",
    op: "op_sabotage",
    target: 2,
    operatives: [1],
  },
  operation_cancel: { kind: "operation_cancel", operation: 1 },
  crypto_target: { kind: "crypto_target", target: 2 },
  crypto_activate: { kind: "crypto_activate", target: 2 },
  project_start: { kind: "project_start", project: "sp_atomic", facility: 3 },
  project_cancel: { kind: "project_cancel", project: "sp_atomic" },
  project_scientist: {
    kind: "project_scientist",
    project: "sp_atomic",
    scientist: null,
  },
  nuke_drop: { kind: "nuke_drop", region: 1, rocket: false },
  rocket_strike: {
    kind: "rocket_strike",
    site: 3,
    target: 10,
    rocket: "flying_bomb",
    count: 2,
  },
  raid: {
    kind: "raid",
    raid: "raid_para",
    unit: 1,
    target: 1,
    building: "dam",
  },
  raid_cancel: { kind: "raid_cancel", raid: 1 },
  cfocus_set: { kind: "cfocus_set", id: "cf_industry" },
  cfocus_clear: { kind: "cfocus_clear" },
  faction_rule: { kind: "faction_rule", rule: "fr_ideology_lock", on: true },
  faction_goal: { kind: "faction_goal", slot: 0, goal: "fg_members" },
  treaty_leave: { kind: "treaty_leave" },
  railgun_assign: { kind: "railgun_assign", army: 1, count: 1 },
  railgun_return: { kind: "railgun_return", army: 1 },
  harbor_deploy: { kind: "harbor_deploy", region: 2 },
  scorch: { kind: "scorch", region: 3 },
  air_night: { kind: "air_night", deployment: 1, on: true },
} as Record<(typeof DEPTH_ORDER_KINDS)[number], DepthOrder>;

/**
 * Lane W3 (plan Task 9): Germany's answers on day 0 — continuous focuses
 * closed, its faction's rule and goal taken (it leads the Axis), no treaty
 * to leave.
 */
const W3_ANSWER: readonly (string | null)[] = [
  "cfocus_locked",
  "cfocus_locked",
  null,
  null,
  "bad_index",
];

/** The stub's refusal of each lane (plan Task 1 Step 11). */
const LANE_BLOCK = (k: number): string | null =>
  k <= 1
    ? "doctrine_locked"
    : k <= 4 || k === 12 || k === 13
      ? "no_cp"
      : k <= 11
        ? "group_full"
        : k <= 19
          ? "design_slots_full"
          : k <= 22
            ? "bad_index"
            : k <= 25
              ? "no_partner"
              : k <= 28
                ? "listing_bad"
                : k <= 30
                  ? "no_pp"
                  : k <= 39
                    ? "no_agency"
                    : k <= 46
                      ? "project_locked"
                      : k <= 51
                        ? W3_ANSWER[k - 47]
                        : k <= 55
                          ? "railgun_limit"
                          : "bad_index";

describe("World War 1936 P6: the depth orders", () => {
  it("every kind is valid on the wire and goes to its lane", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const d = runner.game.worldWar()!.depth;
    DEPTH_ORDER_KINDS.forEach((kind, k) => {
      const o = SAMPLES[kind];
      expect(() => WwOrderSchema.parse(o), kind).not.toThrow();
      expect(
        d.issue(DEEP.tag.DEU, o as WwOrder, runner.game.ticks()),
        kind,
      ).toBe(LANE_BLOCK(k));
    });
  });

  it("a dead country's order is dead; an order on the wire is routed", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANDEU", country: "DEU" }],
      DEEP.map,
    );
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    expect(d.issue(0, { kind: "intel_found" }, 0)).toBe("dead");
    const spy = vi.spyOn(d, "issue");
    step(runner, 1, [order("HUMANDEU", { kind: "intel_found" })]);
    expect(spy).toHaveBeenCalledWith(
      DEEP.tag.DEU,
      { kind: "intel_found" },
      expect.any(Number),
    );
    spy.mockRestore();
    ww.addCapitulation(DEEP.tag.POL, DEEP.tag.DEU, runner.game.ticks());
    expect(d.issue(DEEP.tag.POL, { kind: "intel_found" }, 1)).toBe("dead");
  });
});
