// World War 1936 P6 (spec §21.4, plan decision 4): every depth order goes
// to its lane (the stubs answer with the lane's refusal), over the wire
// and to dead countries.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WwOrderSchema } from "@openfront/engine-api/Schemas";
import { DEPTH_ORDER_KINDS } from "@openfront/engine-api/ww1936/DepthTypes";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { SAMPLES } from "./depthOrderSamples";
import { gameHash, order, step, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

/**
 * Lane E's refusals of the samples (Germany in 1936): no medium II chassis,
 * empty slot 1 (a copy, the flag, a name, a refit), no design on line 1.
 */
const DESIGN_BLOCK = [
  "bad_base",
  "bad_slot",
  "bad_slot",
  "bad_slot",
  "bad_slot",
  "bad_line",
];

/** The stub's refusal of each lane (plan Task 1 Step 11). */
const LANE_BLOCK = (k: number): string =>
  k <= 1
    ? "doctrine_locked"
    : k <= 4 || k === 12 || k === 13
      ? "no_cp"
      : k <= 11
        ? "group_full"
        : k <= 19
          ? DESIGN_BLOCK[k - 14]
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
                        ? "cfocus_locked"
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

  it("a refusal changes nothing (hash and snapshot)", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    step(runner, 2);
    const ww = runner.game.worldWar()!;
    // A pending stats mark another country made is not flushed by a refusal.
    const pending = (ww.depth as unknown as { depthDirtyStats: Set<number> })
      .depthDirtyStats;
    ww.depth.markStats(DEEP.tag.GBR);
    const before = gameHash(runner);
    const snap = JSON.stringify(ww.depth.snapshot());
    for (const kind of DEPTH_ORDER_KINDS) {
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
