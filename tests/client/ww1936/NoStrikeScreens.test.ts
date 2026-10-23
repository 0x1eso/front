// World War 1936, final review B I1 and M2 (fix lane E's judges): the build
// menu, the region card (both through EconomyModel.buildCheck) and the air
// zone card (AirModel.deployBlock) hand engine-lib's judges the no-strike
// inputs, so a Korean or Taiwanese region greys out with the engine's
// reason instead of being refused silently.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

/**
 * The judge goes by world1936's fixed ids (lane E), so the test maps' stand-in
 * regions are added to it, as in lane E's StrikeFlows test.
 */
const STAND_INS = vi.hoisted(() => new Set<number>());
vi.mock("@openfront/engine-lib/ww1936/NoStrike", async (importOriginal) => {
  const m =
    await importOriginal<
      typeof import("@openfront/engine-lib/ww1936/NoStrike")
    >();
  const judge = (sc: never, r: number) =>
    STAND_INS.has(r) || m.isNoStrike(sc, r);
  return {
    ...m,
    isNoStrike: judge,
    strikeBlock: (sc: never, r: number) =>
      judge(sc, r) ? "no_strike_region" : null,
  };
});

/** Every ask the zone card puts to airDeployBlock (the real judge answers). */
const ASKS = vi.hoisted(() => [] as { allNoStrike?: boolean }[]);
vi.mock("@openfront/engine-lib/ww1936/AirRules", async (importOriginal) => {
  const m =
    await importOriginal<
      typeof import("@openfront/engine-lib/ww1936/AirRules")
    >();
  return {
    ...m,
    airDeployBlock: (a: Parameters<typeof m.airDeployBlock>[0]) => {
      ASKS.push(a as { allNoStrike?: boolean });
      return m.airDeployBlock(a);
    },
  };
});

import { airDeployBlock } from "@openfront/engine-lib/ww1936/AirRules";
import { buildBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  allNoStrikeZone,
  deployBlock,
} from "../../../src/client/hud/ww1936/AirModel";
import {
  buildBlock,
  buildCandidates,
  buildCheck,
} from "../../../src/client/hud/ww1936/EconomyModel";
import { navyCtx, NavyGame } from "../../../src/client/hud/ww1936/NavyModel";
import { REGION, SR } from "../../ww1936/seaFixture";
import { detail, fakeEconGame, ID, scenario } from "./EconomyFixture";
import { airDetail, sea, seaGame } from "./SeaAirFixture";

/**
 * Whether engine-lib's judges carry lane E's no-strike rules (they do once
 * the two fix lanes are merged; this lane's branch has the inputs only).
 */
const JUDGES_HAVE_NO_STRIKE =
  buildBlockOf({ building: "civ", noStrike: true } as never) ===
    "no_strike_region" &&
  airDeployBlock({
    sr: SR.eastLand,
    srKind: "land",
    type: "bomber",
    mission: "strategic_bombing",
    count: 1,
    have: 10,
    deploymentsUsed: 0,
    anyBaseInRange: true,
    allNoStrike: true,
  } as never) === "no_strike_region";

const fighting = () => false;

function berlinAsKorea() {
  STAND_INS.clear();
  // Berlin (3) stands for a Korean region; Munich (4) stays an open one.
  STAND_INS.add(3);
  return fakeEconGame({ details: [detail("DEU")] }).view;
}

function eastAsKorea() {
  STAND_INS.clear();
  // Every member of the East land zone stands for the Korean Peninsula.
  for (const r of sea.sr(SR.eastLand)!.members) STAND_INS.add(r);
  const g = seaGame({
    air: airDetail("GBR", {
      stock: [340, 300, 0, 0, 0, 0, 0, 0, 0, 0],
      bases: [{ region: REGION.london, used: 0, cap: 400, damagePm: 0 }],
    }),
  });
  ASKS.length = 0;
  return navyCtx(g.game as unknown as NavyGame)!;
}

describe("the no-strike inputs on the screens (fix lanes C and E)", () => {
  it("the build menu and the region card pass noStrike to buildBlockOf", () => {
    const view = berlinAsKorea();
    const me = ID("DEU");
    expect(buildCheck(view, scenario, me, 3, "civ", 1, 0, fighting)).toEqual(
      expect.objectContaining({ noStrike: true, controlled: true }),
    );
    expect(buildCheck(view, scenario, me, 4, "civ", 1, 0, fighting)).toEqual(
      expect.objectContaining({ noStrike: false }),
    );
  });

  it("the air zone card passes allNoStrike to airDeployBlock", () => {
    const ctx = eastAsKorea();
    expect(allNoStrikeZone(sea, SR.eastLand)).toBe(true);
    expect(allNoStrikeZone(sea, SR.westLand)).toBe(false);
    // A sea zone is never one.
    expect(allNoStrikeZone(sea, SR.central)).toBe(false);
    deployBlock(ctx, SR.eastLand, "bomber", "strategic_bombing", 10);
    deployBlock(ctx, SR.westLand, "bomber", "strategic_bombing", 10);
    expect(ASKS.map((a) => a.allNoStrike)).toEqual([true, false]);
  });

  // Runs once the judges know the rule (both fix lanes merged).
  it.runIf(JUDGES_HAVE_NO_STRIKE)(
    "a no-strike region greys out with the engine's reason",
    () => {
      const view = berlinAsKorea();
      const me = ID("DEU");
      // The region card's "Build here" and the build menu's own pick.
      expect(buildBlock(view, scenario, me, 3, "civ", 1, 0, fighting)).toBe(
        "no_strike_region",
      );
      expect(buildBlock(view, scenario, me, 4, "civ", 1, 0, fighting)).toBe(
        null,
      );
      // The build menu never offers it.
      const offered = buildCandidates(view, scenario, me, "civ", 0, fighting);
      expect(offered.map((c) => c.id)).not.toContain(3);
      expect(offered.map((c) => c.id)).toContain(4);
      // The zone card: a strike mission over the zone, not an air one.
      const ctx = eastAsKorea();
      expect(
        deployBlock(ctx, SR.eastLand, "bomber", "strategic_bombing", 10),
      ).toBe("no_strike_region");
      expect(
        deployBlock(ctx, SR.eastLand, "fighter", "air_superiority", 10),
      ).not.toBe("no_strike_region");
    },
  );
});
