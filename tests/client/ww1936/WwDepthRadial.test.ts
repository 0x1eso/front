// World War 1936 P6 (plan Task 14): [Scorch] and [Launch rockets] on a touch
// screen, in the radial menu; greyed by the engine-lib judges.
import { EventBus } from "@openfront/shared/EventBus";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

const noStrike = new Set<number>();
vi.mock("@openfront/engine-lib/ww1936/NoStrike", async (importOriginal) => {
  const m =
    await importOriginal<
      typeof import("@openfront/engine-lib/ww1936/NoStrike")
    >();
  return {
    ...m,
    isNoStrike: (_sc: unknown, r: number) => noStrike.has(r),
    strikeBlock: (_sc: unknown, r: number) =>
      noStrike.has(r) ? "no_strike_region" : null,
  };
});

import {
  MenuElementParams,
  wwDepthRegionElements,
} from "../../../src/client/hud/layers/RadialMenuElements";
import { DepthMiscModel } from "../../../src/client/hud/ww1936/DepthMiscModel";
import { WwDepthView } from "../../../src/client/view/WwDepthView";
import {
  detail,
  fakeEconGame,
  region,
  summary,
  tileOf,
} from "./EconomyFixture";

function menu(withDepth: boolean, site: boolean) {
  const { game } = fakeEconGame({
    summaries: [summary("DEU")],
    details: [detail("DEU")],
    regions: [region(4, { rocketSite: site ? 1 : 0 } as never)],
  });
  const p = {
    tile: tileOf(4),
    game: { ...game, wwDepth: () => (withDepth ? new WwDepthView() : null) },
    eventBus: new EventBus(),
    closeMenu: vi.fn(),
  } as unknown as MenuElementParams;
  return p;
}

describe("the radial menu's depth entries", () => {
  it("shows scorch on my region and rocket launch from my site only", () => {
    expect(wwDepthRegionElements(menu(true, false)).map((e) => e.id)).toEqual([
      "ww_scorch",
    ]);
    expect(wwDepthRegionElements(menu(true, true)).map((e) => e.id)).toEqual([
      "ww_scorch",
      "ww_rocket",
    ]);
    expect(wwDepthRegionElements(menu(false, true))).toEqual([]);
  });

  it("Korea and Taiwan never offer a scorch or a rocket, in the menu or on the card", () => {
    // Region 4 stands for a Korean region, 5 for Taiwan (901 in world1936).
    noStrike.add(4);
    noStrike.add(5);
    const p = menu(true, true);
    expect(wwDepthRegionElements(p)).toEqual([]);
    const act = new DepthMiscModel(p.game as never).regionActions(4);
    expect(act.scorch).toBe(false);
    expect(act.rocket).toBe(false);
    expect(act.scorchBlock).toBe("no_strike_region");
    expect(act.rocketBlock).toBe("no_strike_region");
    noStrike.clear();
  });

  it("final review C (M2): scorch confirms in a one-item ring, so the menu stays open", async () => {
    const p = menu(true, false);
    const { SendWwOrderIntentEvent } =
      await import("../../../src/client/Transport");
    const sent: unknown[] = [];
    p.eventBus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const scorch = wwDepthRegionElements(p)[0];
    // No action on the first tap: it opens the ring (the menu stays open).
    expect(scorch.action).toBeUndefined();
    const ring = scorch.subMenu!(p);
    expect(ring.map((e) => [e.id, e.text])).toEqual([
      ["ww_scorch_confirm", "[ww1936.region_status.scorch_confirm]"],
    ]);
    ring[0].action!(p);
    expect(sent).toEqual([{ kind: "scorch", region: 4 }]);
    expect(p.closeMenu).toHaveBeenCalledTimes(1);
  });

  it("the judges decide: the foundation's stub refuses scorch", () => {
    const p = menu(true, false);
    const scorch = wwDepthRegionElements(p)[0];
    expect(scorch.disabled(p)).toBe(true);
  });
});
