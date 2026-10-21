// World War 1936 sensitivity rule (P6 pre-flight): Korea's eleven regions
// and Taiwan are never struck — bombing, port strikes, later strikes.
import type { CarrierOrder } from "@openfront/engine-api/ww1936/NavyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import {
  isNoStrike,
  NO_STRIKE_REGION_NAMES,
  noStrikeRegions,
  strikeBlock,
} from "@openfront/engine-lib/ww1936/NoStrike";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { bombableRegions } from "@openfront/engine/ww1936/air/Bombing";
import type { WwAir } from "@openfront/engine/ww1936/air/WwAir";
import { issueCarrierOrder } from "@openfront/engine/ww1936/navy/Carriers";
import type { WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import fs from "fs";
import path from "path";
import { SEA } from "./seaFixture";

function scenarioOf(dir: string): ScenarioIndex {
  return ScenarioIndex.fromFiles(
    JSON.parse(
      fs.readFileSync(path.join(dir, "scenario.json"), "utf8"),
    ) as ReadonlyScenarioData,
    new Uint8Array(fs.readFileSync(path.join(dir, "regions.bin"))),
  );
}

const world = scenarioOf(
  path.join(__dirname, "../../resources/maps/world1936"),
);
const KOREA_TAIWAN = [
  563, 598, 604, 622, 639, 679, 686, 701, 732, 734, 761, 901,
];

describe("no-strike regions", () => {
  it("every name resolves on world1936: Korea's eleven and Taiwan", () => {
    expect(NO_STRIKE_REGION_NAMES).toHaveLength(12);
    expect([...noStrikeRegions(world)].sort((a, b) => a - b)).toEqual(
      KOREA_TAIWAN,
    );
    expect(strikeBlock(world, 901)).toBe("no_strike_region");
    expect(strikeBlock(world, 679)).toBe("no_strike_region");
    // Japan's home islands and its other holdings are not exempt.
    const tokyo = world.landRegions.find((r) => r.name === "Tokyo")!;
    expect(strikeBlock(world, tokyo.id)).toBeNull();
    expect(isNoStrike(world, 666)).toBe(false); // Kwantung
  });

  it("a test map without those names has none", () => {
    const sea = scenarioOf(path.join(__dirname, `../testdata/maps/${SEA.map}`));
    expect(noStrikeRegions(sea).size).toBe(0);
  });

  it("a port strike on one is refused", () => {
    const navy = {
      scenario: world,
      fleets: new Map([[7, { owner: 3, ships: [] }]]),
    } as unknown as WwNavy;
    const strike = (port: number): CarrierOrder => ({
      kind: "fleet_port_strike",
      fleet: 7,
      port,
    });
    expect(issueCarrierOrder(navy, 3, strike(901), 0)).toBe("no_strike_region");
    // Tokyo passes the no-strike check; lane N2's carrier checks come next
    // (this fake fleet has no carrier).
    expect(issueCarrierOrder(navy, 3, strike(758), 0)).toBe("bad_ship_class");
    expect(issueCarrierOrder(navy, 4, strike(758), 0)).toBe("no_fleet");
  });

  it("strategic bombing never picks one", () => {
    const air = { ww: { scenario: world } } as unknown as WwAir;
    for (const r of KOREA_TAIWAN) {
      const sr = world.regionSr(r);
      expect(sr, `region ${r}`).toBeGreaterThan(0);
      const picks = bombableRegions(air, sr);
      for (const x of KOREA_TAIWAN) expect(picks).not.toContain(x);
    }
    const tokyoSr = world.regionSr(758);
    expect(bombableRegions(air, tokyoSr)).toContain(758);
  });
});
