// World War 1936 P6 lane S (plan Task 6 Step 6, spec §9.7): rockets on
// ww1936deep. Germany (human, flying bomb done) holds Lyon with a rocket
// site, 156 km from London; Britain (human) is at war with it. The common
// day's rocket step is called directly.
import {
  ROCKET_POINTS,
  SPECIAL_PROJECTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_IDS,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { bombDamageMilli } from "@openfront/engine-lib/ww1936/AirRules";
import {
  rocketHits,
  rocketTargetBlock,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import { processRockets } from "@openfront/engine/ww1936/depth/Rockets";
import {
  damageOf,
  effectiveLevel,
} from "@openfront/engine/ww1936/economy/Buildings";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, takeRegion, warAfterPrep, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const LYON = DEEP.region.lyon;
const LONDON = DEEP.region.london;
const FLYING = equipKey("flying_bomb", 1);
const BALLISTIC = equipKey("ballistic_rocket", 1);

async function rocketWar() {
  const runner = await wwRunner(
    {},
    [
      { clientID: HUMAN, country: "DEU" },
      { clientID: "HUMAN002", country: "GBR" },
    ],
    DEEP.map,
  );
  warAfterPrep(runner, HUMAN, "GBR");
  const g = runner.game;
  const ww = g.worldWar()!;
  const d = ww.depth;
  const deu = DEEP.tag.DEU;
  const gbr = DEEP.tag.GBR;
  expect(ww.land.isEnemy(deu, gbr)).toBe(true);
  takeRegion(g, LYON, "DEU");
  d.country(deu)!.proj.done |= 1 << SPECIAL_PROJECTS.indexOf("sp_flying_bomb");
  ww.economy.buildingArray("rocket_site")[LYON] = 1;
  const ce = ww.economy.country(deu)!;
  ce.stock[FLYING] = 40;
  ce.stock[BALLISTIC] = 5;
  // No British fighters over London's zone unless a test says so.
  ww.air.zoneState[ww.scenario.srIdxOf(DEEP.sr.westLand)].enemySup = new Map();
  return { runner, g, ww, d, deu, gbr, ce };
}

function londonDamage(ww: { economy: Parameters<typeof damageOf>[0] }): number {
  return BUILDING_IDS.reduce((s, b) => s + damageOf(ww.economy, LONDON, b), 0);
}

describe("World War 1936 P6: rockets (spec §9.7)", () => {
  it("the target judge: no-strike first, then the range", () => {
    expect(rocketTargetBlock({ km: 251, rangeKm: 250, noStrike: true })).toBe(
      "no_strike_region",
    );
    expect(rocketTargetBlock({ km: 251, rangeKm: 250, noStrike: false })).toBe(
      "out_of_rocket_range",
    );
    expect(rocketTargetBlock({ km: 250, rangeKm: 250, noStrike: false })).toBe(
      null,
    );
  });

  it("rocket strike damage and flying bomb interception expected value", async () => {
    const { g, ww, d, deu, gbr, ce } = await rocketWar();
    const sc = ww.scenario;
    expect(sc.kmBetween(sc.centerTile(LYON), sc.centerTile(LONDON))).toBe(156);
    const tick = g.ticks();
    const day = ww.day(tick);
    const strike = (
      count: number,
      rocket: "flying_bomb" | "ballistic_rocket" = "flying_bomb",
    ) =>
      d.issue(
        deu,
        { kind: "rocket_strike", site: LYON, target: LONDON, rocket, count },
        tick,
      );
    // A level-1 site fires 10 a day.
    expect(strike(11)).toBe("raid_conditions");
    expect(strike(10)).toBe(null);
    expect(strike(1)).toBe("raid_conditions");
    // Not from a site we do not hold.
    expect(
      d.issue(
        deu,
        {
          kind: "rocket_strike",
          site: DEEP.region.paris,
          target: LONDON,
          rocket: "flying_bomb",
          count: 1,
        },
        tick,
      ),
    ).toBe("no_facility");
    const aa = effectiveLevel(ww.economy, LONDON, "anti_air");
    expect(aa).toBe(1);
    const taken = ww.economy.country(gbr)!.stats.bombDamageTakenPct;
    const msg = vi.spyOn(ww.air.raidNotes, "note");
    const damage0 = londonDamage(ww);
    // 10 flying bombs, 4% stopped by London's guns: 9.6 → 9 hits, 600 carried.
    processRockets(d, day + 1, tick);
    const first = rocketHits(0, 10, 0, aa, 0);
    expect(first).toEqual({ hits: 9, restMilli: 600 });
    expect(ce.stock[FLYING]).toBe(30);
    expect(d.country(deu)!.proj.rocketRest).toBe(600);
    expect(londonDamage(ww) - damage0).toBe(
      bombDamageMilli(9 * ROCKET_POINTS[0], 0, taken),
    );
    const ring = ww.air.country(gbr)!.bombTaken;
    expect(ring[(day + 1) % 30]).toBe(9 * ROCKET_POINTS[0]);
    expect(msg).toHaveBeenCalledWith(
      ww.air,
      gbr,
      deu,
      LONDON,
      expect.any(Number),
      0,
      expect.any(Number),
    );
    expect(d.rocketQueue).toEqual([]);
    expect(d.dayNotes.filter((x) => x[1] === 0)).toEqual([]);
    // The next 10: 9.6 + 0.6 → 10 hits, 200 carried — 19 of 20 in all,
    // the expected value 19.2.
    expect(strike(10)).toBe(null);
    processRockets(d, day + 2, tick);
    expect(rocketHits(0, 10, 0, aa, 600)).toEqual({ hits: 10, restMilli: 200 });
    expect(d.country(deu)!.proj.rocketRest).toBe(200);
    expect(ring[(day + 2) % 30]).toBe(10 * ROCKET_POINTS[0]);
    // Superiority over the target's zone stops more of them (at most 60%).
    expect(rocketHits(0, 10, 1000, 5, 0)).toEqual({ hits: 4, restMilli: 0 });
    // Ballistic rockets are never stopped.
    const damage2 = londonDamage(ww);
    expect(strike(5, "ballistic_rocket")).toBe(null);
    processRockets(d, day + 3, tick);
    expect(ce.stock[BALLISTIC]).toBe(0);
    expect(londonDamage(ww) - damage2).toBe(
      bombDamageMilli(5 * ROCKET_POINTS[1], 0, taken),
    );
    expect(d.country(deu)!.proj.rocketRest).toBe(200);
    // The stock promised to a queued volley cannot be promised twice.
    ce.stock[FLYING] = 5;
    expect(strike(5)).toBe(null);
    expect(strike(1)).toBe("raid_conditions");
  }, 60_000);
});
