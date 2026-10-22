// World War 1936 P6 T1b (navy/air half): broken codes at sea (pre-flight
// A12, spec §8.7) — exploiting the enemy's codes searches its fleets +20%
// (N1 Spotting) and raids its convoys +10% (C ConvoyWar); the naval
// intelligence department adds +5% to our fleets' search (spec §8.2) — on
// ww1936sea, Britain against Italy, every country human.
import { CONVOY_USES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  convoyLossRatePm,
  convoySinkMilli,
  escortPowerCenti,
  raidPowerCenti,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import { upgradeBit } from "@openfront/engine-lib/ww1936/IntelRules";
import { spotGainPm } from "@openfront/engine-lib/ww1936/NavalRules";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import {
  convoyLossPmOf,
  convoyWar,
} from "@openfront/engine/ww1936/navy/ConvoyWar";
import { spotRegion } from "@openfront/engine/ww1936/navy/Spotting";
import type { SeaRoute } from "@openfront/engine/ww1936/navy/WwNavy";
import { fleetAtSea, seaGame, war } from "./convoyUtil";
import { REGION, SR, TAG_ID, ZONE } from "./seaFixture";
import { withTestPolitics } from "./util";

withTestPolitics();

/** `o` exploits `t`'s broken codes for the next 90 days (lane I's state). */
function exploit(d: WwDepth, o: number, t: number): void {
  d.decrypted = [
    {
      o,
      t,
      progressMilli: 1_000_000,
      activeUntil: d.lastCommonDay + 90,
    },
  ];
}

describe("T1b: broken codes at sea (spec §8.7)", () => {
  it("exploiting a country's codes searches its fleets +20%; the navy department +5%", async () => {
    const g = await seaGame();
    const { navy, ww } = g;
    war(g, "GBR", "ITA");
    const side = ww.land.sideOf(TAG_ID.GBR);
    const day = ww.day(g.runner.game.ticks());
    // One British destroyer patrolling (search 25), an Italian fleet at
    // sea (visibility 40) in the Central Waters (area 3).
    fleetAtSea(
      navy,
      TAG_ID.GBR,
      REGION.malta,
      [["dd", 1, 1]],
      40002,
      "patrol",
      SR.central,
    );
    const ita = fleetAtSea(
      navy,
      TAG_ID.ITA,
      REGION.rome,
      [
        ["bb", 1, 2],
        ["dd", 1, 4],
      ],
      40002,
      "hold",
      SR.central,
    );
    spotRegion(navy, SR.central, day);
    expect(navy.spotPm(side, ita.id)).toBe(spotGainPm(25, 40, 3));
    // Exploiting Italy's codes: +20% on Italy's fleets.
    exploit(ww.depth, TAG_ID.GBR, TAG_ID.ITA);
    navy.setSpotPm(SR.central, side, ita.id, 0);
    spotRegion(navy, SR.central, day + 1);
    expect(navy.spotPm(side, ita.id)).toBe(spotGainPm(30, 40, 3));
    // Italy exploiting Britain's codes does nothing for Britain.
    exploit(ww.depth, TAG_ID.ITA, TAG_ID.GBR);
    navy.setSpotPm(SR.central, side, ita.id, 0);
    spotRegion(navy, SR.central, day + 2);
    expect(navy.spotPm(side, ita.id)).toBe(spotGainPm(25, 40, 3));
    // The naval intelligence department: our fleets' search +5%.
    ww.depth.country(TAG_ID.GBR)!.intel.upgrades |= upgradeBit("ag_navy_dept");
    navy.setSpotPm(SR.central, side, ita.id, 0);
    spotRegion(navy, SR.central, day + 3);
    expect(navy.spotPm(side, ita.id)).toBe(
      spotGainPm(Math.floor((25 * 105) / 100), 40, 3),
    );
  });

  it("exploiting a country's codes raids its convoys +10%", async () => {
    const run = async (cracked: boolean) => {
      const g = await seaGame();
      const { navy, ww } = g;
      war(g, "ITA", "GBR");
      g.ce("ITA").fuelMilli = 1_000_000_000;
      fleetAtSea(
        navy,
        TAG_ID.ITA,
        REGION.rome,
        [["ss", 2, 30]],
        ZONE.west,
        "raid",
        SR.approaches,
      );
      // Escorts, so the raid power shows past the 30‰ cap (the escort cut).
      fleetAtSea(
        navy,
        TAG_ID.GBR,
        REGION.london,
        [["dd", 1, 40]],
        ZONE.west,
        "escort",
        SR.approaches,
      );
      if (cracked) exploit(ww.depth, TAG_ID.ITA, TAG_ID.GBR);
      const day = ww.day(g.runner.game.ticks());
      const r: SeaRoute = {
        id: navy.nextRouteId++,
        use: CONVOY_USES.indexOf("trade"),
        owner: TAG_ID.GBR,
        ref: 999,
        zones: [ZONE.west],
        km: 0,
        srs: [SR.approaches],
        need: 30,
        got: 30,
        nextDay: day + 7,
      };
      navy.routes.set(r.id, r);
      convoyWar(navy, SR.approaches, day);
      const ita = g.ce("ITA");
      const dd = navy.statsFor(TAG_ID.GBR, "dd", 1);
      const escort = escortPowerCenti(
        40 * (dd.depth * 2 + dd.light),
        0,
        0,
        0,
        g.ce("GBR").stats,
      );
      const raid = raidPowerCenti(
        30 * 2500,
        0,
        0,
        ita.stats,
        ita.researched,
        ita.fuelRatioPm,
      );
      const idx = ww.scenario.srIdxOf(SR.approaches);
      return {
        loss: navy.srState[idx].lossYesterday.get(TAG_ID.GBR) ?? 0,
        rate: convoyLossPmOf(navy, TAG_ID.GBR, SR.approaches),
        escort,
        raid,
      };
    };
    const plain = await run(false);
    const cracked = await run(true);
    expect(plain.loss).toBe(convoySinkMilli(30, plain.raid, plain.escort, 3));
    const raid = Math.floor((plain.raid * 110) / 100);
    expect(cracked.loss).toBe(convoySinkMilli(30, raid, plain.escort, 3));
    expect(cracked.loss).toBeGreaterThan(plain.loss);
    expect(cracked.rate).toBe(convoyLossRatePm(raid, plain.escort, 3));
  });
});
