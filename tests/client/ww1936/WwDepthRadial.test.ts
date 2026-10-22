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

  it("a no-strike region greys the rocket entry", () => {
    noStrike.add(4);
    const p = menu(true, true);
    const rocket = wwDepthRegionElements(p).find((e) => e.id === "ww_rocket")!;
    expect(rocket.disabled(p)).toBe(true);
    noStrike.clear();
  });

  it("the judges decide: the foundation's stub refuses scorch", () => {
    const p = menu(true, false);
    const scorch = wwDepthRegionElements(p)[0];
    expect(scorch.disabled(p)).toBe(true);
  });
});
