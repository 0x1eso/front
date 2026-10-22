// World War 1936 P6 (spec §21.4, plan decision 4): every depth order goes
// to its lane (the stubs answer with the lane's refusal), over the wire
// and to dead countries.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WwOrderSchema } from "@openfront/engine-api/Schemas";
import {
  DEPTH_ORDER_KINDS,
  GRAND_DOCTRINES,
  SUBDOCTRINES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { SAMPLES } from "./depthOrderSamples";
import { gameHash, order, step, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

/**
 * Kinds whose lanes check the answers in their own tests (skipped here):
 * lane M (Task 4) kinds 20–30 (Mio, Market, Licences).
 */
const OWN_TESTS = (k: number): boolean => k >= 20 && k <= 30;

/**
 * Lane D's answers to its samples (kinds 0–13; Germany in the preparation
 * minute: no doctrine yet, no experience, no command power, no group).
 */
const D_ANSWER: Readonly<Record<string, string | null>> = {
  doctrine_pick: null,
  subdoctrine_pick: null,
  army_spirit_pick: "no_xp",
  trait_assign: "trait_unavailable",
  promote_fm: "no_cp",
  ag_create: "general_unavailable",
  ag_add: "bad_index",
  ag_remove: "bad_index",
  ag_disband: "bad_index",
  ag_front: "bad_index",
  ag_execute: "bad_index",
  ag_auto: "bad_index",
  medal_award: "no_cp",
  army_priority: null,
};

/**
 * Lane W3 (plan Task 9): Germany's answers on day 0 — continuous focuses
 * closed, its faction's rule refused for want of PP (the case runs at 0 PP
 * for lane I's intel_found), its goal taken (it leads the Axis, free), no
 * treaty to leave.
 */
const W3_ANSWER: readonly (string | null)[] = [
  "cfocus_locked",
  "cfocus_locked",
  "no_pp",
  null,
  "bad_index",
];

/** The stub's refusal of each lane (plan Task 1 Step 11); lane D's own answers. */
const LANE_BLOCK = (k: number): string | null =>
  k <= 13
    ? D_ANSWER[DEPTH_ORDER_KINDS[k]]
    : k <= 19
      ? "design_slots_full"
      : k <= 22
        ? "bad_index"
        : k <= 25
          ? "no_partner"
          : k <= 28
            ? "listing_bad"
            : k <= 31
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
    runner.game.worldWar()!.politics.country(DEEP.tag.DEU)!.ppMilli = 0;
    DEPTH_ORDER_KINDS.forEach((kind, k) => {
      const o = SAMPLES[kind];
      expect(() => WwOrderSchema.parse(o), kind).not.toThrow();
      if (OWN_TESTS(k)) return;
      expect(
        d.issue(DEEP.tag.DEU, o as WwOrder, runner.game.ticks()),
        kind,
      ).toBe(LANE_BLOCK(k));
    });
  });

  it("a refusal changes nothing (hash and snapshot)", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    step(runner, 2);
    const ww = runner.game.worldWar()!;
    // Lane I: no PP, so intel_found is refused too.
    ww.politics.country(DEEP.tag.DEU)!.ppMilli = 0;
    // A pending stats mark another country made is not flushed by a refusal.
    const pending = (ww.depth as unknown as { depthDirtyStats: Set<number> })
      .depthDirtyStats;
    ww.depth.markStats(DEEP.tag.GBR);
    // Lane D: the samples would be taken by a Germany without doctrines
    // (the first picks are free) — it holds them already, and army 1's
    // priority is the sample's.
    const doc = ww.depth.country(DEEP.tag.DEU)!.doc;
    doc.gd[0] = GRAND_DOCTRINES.indexOf("gd_mobile");
    doc.sub[0] = SUBDOCTRINES.indexOf("inf_elastic");
    ww.land.armies.get(1)!.priority = 2;
    const before = gameHash(runner);
    const snap = JSON.stringify(ww.depth.snapshot());
    // The refused ones (W3's faction rule and goal are Germany's to take;
    // the lanes listed in OWN_TESTS check theirs).
    for (const [k, kind] of DEPTH_ORDER_KINDS.entries()) {
      if (OWN_TESTS(k) || LANE_BLOCK(k) === null) continue;
      expect(
        ww.depth.issue(DEEP.tag.DEU, SAMPLES[kind] as WwOrder, 1),
        kind,
      ).not.toBeNull();
    }
    expect(gameHash(runner)).toBe(before);
    expect(JSON.stringify(ww.depth.snapshot())).toBe(snap);
    expect([...pending]).toEqual([DEEP.tag.GBR]);
    ww.depth.endTick();
    expect(pending.size).toBe(0);
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
