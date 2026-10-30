// Easy naval invasions (owner brief 2026-10-30): the landing card the army
// card shows on a coast's first tap — the start port, the route's sea
// regions in traffic-light colours, the expected losses, the preparation,
// the days to the landing, the split — and every refusal's reason.
import { ARMY_RAIL } from "@openfront/engine-api/ww1936/LandTypes";
import { landingForce } from "@openfront/engine-lib/ww1936/InvasionRules";
import { describe, expect, it } from "vitest";
import {
  invadeButtonBlock,
  invasionPreview,
  invasionTargets,
  navyCtx,
  supLight,
} from "../../../src/client/hud/ww1936/NavyModel";
import { REGION, SR } from "../../ww1936/seaFixture";
import { army, division, landDetail, mine } from "./LandFixture";
import { seaGame, SID } from "./SeaAirFixture";

const GBR = SID("GBR");
const ITA = SID("ITA");

function britain(
  n: number,
  region: number = REGION.london,
  over: { state?: number; divisions?: ReturnType<typeof division>[] } = {},
) {
  return seaGame({
    wars: [["GBR", "ITA"]],
    armies: [
      army(1, "GBR", region, {
        divisions: n,
        mine: mine(),
        state: over.state ?? 0,
      }),
    ],
    landDetails: [
      landDetail("GBR", {
        divisions:
          over.divisions ??
          Array.from({ length: n }, (_, i) => division(i + 1, 1, region)),
      }),
    ],
    // Italy holds the central waters; the approaches are contested.
    seaRegions: [
      {
        sr: SR.approaches,
        sup: [
          [GBR, 450],
          [ITA, 550],
        ],
        spotted: [],
        convoyLoss: [],
      },
      { sr: SR.central, sup: [[ITA, 1000]], spotted: [], convoyLoss: [] },
    ],
  });
}

describe("the easy landing card", () => {
  it("lights: green at 50% or with no enemy, amber from 40%, red below", () => {
    expect(supLight(500, 500)).toBe("green");
    expect(supLight(0, 0)).toBe("green");
    expect(supLight(450, 550)).toBe("amber");
    expect(supLight(400, 600)).toBe("amber");
    expect(supLight(399, 601)).toBe("red");
  });

  it("start port, route lights, losses, preparation, ETA and the split", () => {
    const g = britain(12);
    const ctx = navyCtx(g.game as never)!;
    expect(invadeButtonBlock(ctx, 1)).toBeNull();
    expect(invasionTargets(ctx, 1)).toContain(REGION.rome);
    const p = invasionPreview(ctx, 1, REGION.rome)!;
    expect(p.block).toBeNull();
    expect(p.from).toBe(REGION.london);
    expect(p.route.map((r) => [r.sr, r.supPm, r.light, r.lossPm])).toEqual([
      [SR.approaches, 450, "amber", 10],
      [SR.central, 0, "red", 100],
    ]);
    // 300 km in a day: the approaches' 10‰ on the way, the rest of the day
    // off Rome at 100‰.
    expect(p.lossPm).toBeGreaterThan(10);
    expect(p.lossPm).toBeLessThan(100);
    // A short crossing (300 km): 5 days, a day at sea, already in port.
    expect([p.prepDays, p.marchDays, p.seaDays, p.etaDays]).toEqual([
      5, 0, 1, 6,
    ]);
    // Twelve divisions, a limit of ten: ten land, two stay.
    expect([p.going, p.stay]).toEqual([10, 2]);
  });

  it("the start port and ETA are the landing force's (the split's best-organised), as the engine picks them", () => {
    // Six fresh divisions in London, six in Paris of which four are worn:
    // the whole army stands "in Paris" (a tie, the smaller id) with no
    // port of ours by land; the ten that land stand mostly in London.
    const divs = [
      ...Array.from({ length: 6 }, (_, i) =>
        division(i + 1, 1, REGION.paris, { orgPm: i < 4 ? 100 : 1000 }),
      ),
      ...Array.from({ length: 6 }, (_, i) => division(i + 7, 1, REGION.london)),
    ];
    const g = britain(12, REGION.london, { divisions: divs });
    const ctx = navyCtx(g.game as never)!;
    const p = invasionPreview(ctx, 1, REGION.rome)!;
    expect(p.block).toBeNull();
    expect([p.from, p.marchDays, p.going, p.stay]).toEqual([
      REGION.london,
      0,
      10,
      2,
    ]);
    // The rule both sides call: of the worn, the larger ids stay.
    expect(
      landingForce(
        divs.map((d) => ({ ...d, speedCenti: 400 })),
        10,
      )
        .map((d) => d.id)
        .sort((x, y) => x - y),
    ).toEqual([1, 2, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("an army riding a train may be ordered (the march replaces the ride)", () => {
    const g = britain(2, REGION.london, { state: ARMY_RAIL });
    const ctx = navyCtx(g.game as never)!;
    expect(invadeButtonBlock(ctx, 1)).toBeNull();
    expect(invasionPreview(ctx, 1, REGION.rome)!.block).toBeNull();
  });

  it("refusals say why", () => {
    const g = britain(1);
    const ctx = navyCtx(g.game as never)!;
    expect(invasionPreview(ctx, 1, REGION.berlin)!.block).toBe("not_coastal");
    expect(invasionPreview(ctx, 1, REGION.lyon)!.block).toBe("not_at_war");
    // No region of Britain's side next to Moscow: no port reached by land.
    const far = britain(1, REGION.moscow);
    const fctx = navyCtx(far.game as never)!;
    expect(invadeButtonBlock(fctx, 1)).toBe("no_invasion_port");
    expect(invasionPreview(fctx, 1, REGION.rome)!.block).toBe(
      "no_invasion_port",
    );
    expect(invasionTargets(fctx, 1)).toEqual([]);
  });
});
