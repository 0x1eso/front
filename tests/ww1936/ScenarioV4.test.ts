// World War 1936 P4 (plan Task 1 Step 25, decision 6): scenario version 4
// and the ScenarioIndex readers — the v4 fields of ww1936sea, and the
// fallbacks of the v3 test map ww1936mini.
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import {
  AIR_BASE,
  AIR_KM,
  HARBOR,
  NAVAL_BASE,
  REGION,
  SR,
  ZONE,
} from "./seaFixture";

function load(map: string): ScenarioIndex {
  const dir = path.join(__dirname, `../testdata/maps/${map}`);
  const data = JSON.parse(
    fs.readFileSync(path.join(dir, "scenario.json"), "utf8"),
  ) as ReadonlyScenarioData;
  return ScenarioIndex.fromFiles(
    data,
    new Uint8Array(fs.readFileSync(path.join(dir, "regions.bin"))),
  );
}

const at = <T extends Record<number, number>>(t: T, k: number) =>
  (t as Record<number, number>)[k] ?? 0;

describe("scenario version 4 (P4 spec §3.6)", () => {
  const sc = load("ww1936sea");

  it("strategic regions in srIdx order", () => {
    expect(sc.data.version).toBe(4);
    expect(sc.strategicList().map((s) => s.id)).toEqual([
      SR.westLand,
      SR.eastLand,
      SR.approaches,
      SR.central,
      SR.eastern,
    ]);
    expect(sc.srIdxOf(SR.approaches)).toBe(2);
    expect(sc.srIdxOf(999)).toBe(-1);
    expect(sc.sr(SR.central)!.area).toBe(3);
    expect(sc.seaSrCount()).toBe(3);
    expect(sc.zoneSr(ZONE.narrows)).toBe(SR.central);
    expect(sc.regionSr(REGION.malta)).toBe(SR.eastLand);
    expect(sc.srOfZoneOrRegion(ZONE.west)).toBe(SR.approaches);
    expect(sc.srOfZoneOrRegion(REGION.paris)).toBe(SR.westLand);
  });

  it("harbors and start bases", () => {
    for (const r of sc.landRegions) {
      expect(sc.harborOf(r.id), r.name).toBe(at(HARBOR, r.id));
      expect(sc.startNavalBase(r.id), r.name).toBe(at(NAVAL_BASE, r.id));
      expect(sc.startAirBase(r.id), r.name).toBe(at(AIR_BASE, r.id));
    }
    expect(sc.startAa(REGION.london)).toBe(1);
    expect(sc.startCoastalFort(REGION.london)).toBe(1);
    expect(sc.startAa(REGION.paris)).toBe(0);
  });

  it("km between centers (plan decision 9, flat × 4 with the date-line wrap)", () => {
    const c = (sr: number) => sc.sr(sr)!.center;
    expect(sc.kmBetween(sc.centerTile(REGION.london), c(SR.central))).toBe(
      AIR_KM.londonToCentral,
    );
    expect(sc.kmBetween(sc.centerTile(REGION.berlin), c(SR.central))).toBe(
      AIR_KM.berlinToCentral,
    );
    expect(sc.kmBetween(sc.centerTile(REGION.berlin), c(SR.eastern))).toBe(
      AIR_KM.berlinToEastern,
    );
    expect(sc.kmBetween(sc.centerTile(REGION.rome), c(SR.approaches))).toBe(
      AIR_KM.romeToApproaches,
    );
    expect(sc.kmBetween(sc.centerTile(REGION.moscow), c(SR.approaches))).toBe(
      AIR_KM.moscowToApproaches,
    );
    expect(sc.srKm(REGION.london, SR.central)).toBe(AIR_KM.londonToCentral);
  });

  it("the sea edges, the strait and the canal", () => {
    expect(sc.navalZones()).toEqual([
      ZONE.west,
      ZONE.middle,
      ZONE.east,
      ZONE.narrows,
    ]);
    expect(sc.seaEdgesOf(ZONE.narrows)).toEqual([
      { to: ZONE.middle, edge: 2 },
      { to: ZONE.east, edge: 3 },
    ]);
    expect(sc.seaEdgeCount()).toBe(4);
    expect(sc.seaEdge(1).kind).toBe(3);
    expect(sc.straitOf(2)!.id).toBe("narrows");
    expect(sc.straitOf(3)!.kind).toBe("canal");
    expect(sc.straitOf(0)).toBeNull();
    expect(sc.zoneCenter(ZONE.middle)).toBe(110 * 200 + 85);
    expect(sc.zoneLatC(ZONE.east)).toBe(4500);
    expect(sc.zoneWcell(ZONE.narrows)).toBe(380);
  });
});

describe("the v3 fallbacks (plan decision 6)", () => {
  const sc = load("ww1936mini");

  it("strategic regions: (1936 owner, landmass without straits), each sea zone", () => {
    expect(sc.data.version).toBe(3);
    expect(sc.strategicList().map((s) => [s.id, [...s.members]])).toEqual([
      [1, [1, 2]],
      [2, [3, 4]],
      [3, [5]],
      [4, [6, 7]],
      [5, [8, 9]],
      [6, [10]],
      [1001, [40001]],
      [1002, [40002]],
    ]);
    expect(sc.regionSr(9)).toBe(5);
    expect(sc.zoneSr(40002)).toBe(1002);
  });

  it("harbors from the tiles", () => {
    expect(sc.harborOf(2)).toBe(40001);
    expect(sc.harborOf(5)).toBe(40001);
    expect(sc.harborOf(7)).toBe(40002);
    expect(sc.harborOf(9)).toBe(40002);
    expect(sc.harborOf(10)).toBe(40001);
    expect(sc.harborOf(1)).toBe(0);
  });

  it("start bases from the formulas", () => {
    expect(sc.startNavalBase(2)).toBe(2);
    expect(sc.startNavalBase(10)).toBe(3);
    expect(sc.startNavalBase(5)).toBe(0);
    // France's capital, Germany's capital, the Soviet Union's 6-point Kiev,
    // Poland's (dev 1) capital, Krakow.
    expect(sc.startAirBase(1)).toBe(5);
    expect(sc.startAirBase(3)).toBe(5);
    expect(sc.startAirBase(9)).toBe(1);
    expect(sc.startAirBase(6)).toBe(1);
    expect(sc.startAirBase(7)).toBe(0);
    expect(sc.startAa(1)).toBe(3);
    expect(sc.startCoastalFort(10)).toBe(0);
  });

  it("zone centers and the edge from scenario.json", () => {
    expect(sc.navalZones()).toEqual([40001, 40002]);
    expect(sc.seaEdgesOf(40001)).toEqual([{ to: 40002, edge: 0 }]);
    expect(sc.zoneCenter(40001) % 200).toBeLessThan(100);
  });
});
