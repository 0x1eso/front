// World War 1936 P4 (plan Task 12 Step 6): the air screens' model — the
// bases in range and their use, the zone card, the ✈ dial.
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import {
  airDial,
  basesInRange,
  zoneCard,
} from "../../../src/client/hud/ww1936/AirModel";
import { navyCtx, NavyGame } from "../../../src/client/hud/ww1936/NavyModel";
import { sideKeyOf } from "../../../src/client/view/WwNavyView";
import { AIR_KM, REGION, SR } from "../../ww1936/seaFixture";
import { airDetail, seaGame, SID } from "./SeaAirFixture";

function game(o: Parameters<typeof seaGame>[0] = {}) {
  const g = seaGame({
    air: airDetail("GBR", {
      stock: [340, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      deployed: [120, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      bases: [{ region: REGION.london, used: 120, cap: 400, damagePm: 0 }],
    }),
    deployments: [
      {
        id: 1,
        owner: SID("GBR"),
        sr: SR.central,
        type: "fighter",
        mission: "air_superiority",
        counts: [100, 20, 0],
        target: 0,
        base: REGION.london,
      },
    ],
    ...o,
  });
  return { ...g, ctx: navyCtx(g.game as unknown as NavyGame)! };
}

describe("AirModel (spec §13, §18.6, §18.7)", () => {
  it("the bases in a type's range and their use (base center → zone center)", () => {
    const { ctx } = game();
    const range = planeStats("fighter", 1, emptyStats(), new Set()).rangeKm;
    const bases = basesInRange(ctx, SR.central, "fighter");
    expect(range).toBeGreaterThanOrEqual(AIR_KM.londonToCentral);
    expect(bases.map((b) => [b.region, b.km, b.used, b.cap])).toEqual([
      [REGION.london, AIR_KM.londonToCentral, 120, 400],
    ]);
  });

  it("the zone card: our control against the enemy's, the bases in reach", () => {
    const side = (t: "GBR" | "ITA") => sideKeyOf(SID(t), -1);
    const { ctx } = game({
      wars: [["GBR", "ITA"]],
      zones: [
        {
          sr: SR.central,
          sides: [
            {
              side: side("GBR"),
              supPm: 620,
              sorties: [90, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
            {
              side: side("ITA"),
              supPm: 380,
              sorties: [40, 12, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          ],
          result: [
            [
              side("GBR"),
              {
                shotDown: 7,
                lost: 3,
                casHitsCenti: 0,
                bombPoints: 0,
                navalDamageMilli: 0,
              },
            ],
          ],
        },
      ],
    });
    const c = zoneCard(ctx, SR.central)!;
    expect(c.ours).toBe(620);
    expect(c.theirs).toBe(380);
    expect(c.enemySeen).toEqual([
      ["fighter", 40],
      ["bomber", 12],
    ]);
    expect(c.bases.count).toBe(1);
    expect(c.result?.shotDown).toBe(7);
  });

  it("the ✈ dial: my capital's zone, and my front zones under 50%", () => {
    const side = sideKeyOf(SID("GBR"), -1);
    const { ctx } = game({
      zones: [
        {
          sr: SR.westLand,
          sides: [{ side, supPm: 300, sorties: [] }],
          result: [],
        },
      ],
    });
    const d = airDial(ctx);
    // London lies in the West land zone; no war, no front.
    expect(d.supPm).toBe(300);
    expect(d.progress).toBe(0.3);
    expect(d.low).toBe(0);
  });
});
