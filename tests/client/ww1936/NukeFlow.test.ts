// World War 1936 P6 lane U4 (plan Task 13): the bomb flow — four taps and
// a confirmation — and its preview.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { EventBus } from "@openfront/shared/EventBus";
import { describe, expect, it } from "vitest";
import { DepthIndustryModel } from "../../../src/client/hud/ww1936/DepthIndustryModel";
import { WwNukeFlow } from "../../../src/client/hud/ww1936/WwNukeFlow";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { REGION } from "../../ww1936/seaFixture";
import { depthGame } from "./DepthU4Fixture";
import { sea, SID } from "./SeaAirFixture";

function setup(atomic = 1) {
  const sr = sea.srOfZoneOrRegion(REGION.berlin);
  const g = depthGame({
    summary: { atomicStock: atomic },
    deployments: [
      {
        id: 7,
        owner: SID("GBR"),
        sr,
        type: "strat_bomber",
        mission: "strategic_bombing",
        counts: [40, 0, 0],
        target: 0,
        base: REGION.london,
      },
    ],
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  let t = 1_000;
  const flow = new WwNukeFlow(g.game, bus, () => t);
  return { ...g, flow, sent, sr, advance: (ms: number) => (t += ms) };
}

describe("the bomb flow (spec §20.9)", () => {
  it("dropping a bomb takes four taps and a confirmation", () => {
    const m = setup();
    // 1. [Drop the bomb]
    expect(m.flow.start("nuke", m.sr)).toBe(true);
    expect(m.flow.targets()).toContain(REGION.berlin);
    // 2. the region: its preview
    expect(m.flow.tapRegion(REGION.berlin)).toBe(true);
    expect(m.flow.state.step).toBe("preview");
    // 3. the same region again
    m.advance(500);
    m.flow.tapRegion(REGION.berlin);
    expect(m.flow.state.step).toBe("ready");
    // 4. [Confirm drop] arms ...
    expect(m.flow.confirmDrop()).toBe(false);
    expect(m.flow.state.taps).toBe(4);
    expect(m.sent).toHaveLength(0);
    // ... and the confirmation sends the one order.
    m.advance(500);
    expect(m.flow.confirmDrop()).toBe(true);
    expect(m.sent).toEqual([
      { kind: "nuke_drop", region: REGION.berlin, rocket: false },
    ]);
    expect(m.flow.state.step).toBe("idle");
  });

  it("does not start without a bomb in stock", () => {
    const m = setup(0);
    expect(m.flow.start("nuke", m.sr)).toBe(false);
  });

  it("the preview shows destroyed and stopped factories and the interception risk", () => {
    const m = setup();
    const p = new DepthIndustryModel(m.game).nukePreview(REGION.berlin)!;
    // civ 6 + mil 3 = 9 factories; a quarter of each is destroyed: 1 + 0.
    expect(p.factories).toBe(9);
    expect(p.destroyed).toBe(1);
    expect(p.stopped).toBe(8);
    expect(p.interceptPm).toBeGreaterThanOrEqual(0);
    expect(p.interceptPm).toBeLessThanOrEqual(350);
  });

  it("a rocket target that is not an enemy in reach is not taken", () => {
    const m = setup();
    expect(m.flow.start("rocket", REGION.paris)).toBe(true);
    // Out of the site's reach or not an enemy: nothing is taken.
    expect(m.flow.tapRegion(REGION.london)).toBe(false);
    expect(m.sent).toHaveLength(0);
  });
});
