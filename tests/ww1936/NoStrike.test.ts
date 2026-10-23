// World War 1936 sensitivity rule (P6 pre-flight): Korea's eleven regions
// and Taiwan are never struck — bombing, port strikes, later strikes.
import type { CarrierOrder } from "@openfront/engine-api/ww1936/NavyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import {
  airDeployBlock,
  STRIKE_AIR_MISSIONS,
} from "@openfront/engine-lib/ww1936/AirRules";
import {
  isNoStrike,
  NO_STRIKE_REGION_IDS,
  noStrikeRegions,
  strikeBlock,
} from "@openfront/engine-lib/ww1936/NoStrike";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { bombableRegions } from "@openfront/engine/ww1936/air/Bombing";
import { allNoStrikeZone } from "@openfront/engine/ww1936/air/Deploy";
import type { WwAir } from "@openfront/engine/ww1936/air/WwAir";
import { issueCarrierOrder } from "@openfront/engine/ww1936/navy/Carriers";
import { shoreBombardAt } from "@openfront/engine/ww1936/navy/Invasions";
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
  it("the fixed id list is Korea's eleven and Taiwan, all on world1936", () => {
    // Final review B, I2: ids, not names (a rename never drops one).
    expect([...NO_STRIKE_REGION_IDS]).toEqual(KOREA_TAIWAN);
    expect([...noStrikeRegions(world)].sort((a, b) => a - b)).toEqual(
      KOREA_TAIWAN,
    );
    const name = (id: number) =>
      world.landRegions.find((r) => r.id === id)?.name;
    expect(KOREA_TAIWAN.map((id) => world.region(id)?.owner)).toEqual(
      KOREA_TAIWAN.map(() => "JPN"),
    );
    // Seoul under its own name (not the colonial Keijō / 경성), Taiwan's.
    expect(name(679)).toBe("Seoul");
    expect(world.landRegions.find((r) => r.id === 679)?.nameKo).toBe("서울");
    expect(name(901)).toBe("Taiwan");
    expect(strikeBlock(world, 901)).toBe("no_strike_region");
    expect(strikeBlock(world, 679)).toBe("no_strike_region");
    // Japan's home islands and its other holdings are not exempt.
    const tokyo = world.landRegions.find((r) => r.name === "Tokyo")!;
    expect(strikeBlock(world, tokyo.id)).toBeNull();
    expect(isNoStrike(world, 666)).toBe(false); // Kwantung
  });

  it("a test map without those ids has none", () => {
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

  it("Seoul (679) is refused by the other strike judges too (final review B, M3)", () => {
    // Shore bombardment: no cut, before any battle is looked at.
    const navy = { scenario: world } as unknown as WwNavy;
    expect(shoreBombardAt(navy, 679, 1)).toBe(0);
    // A carrier port strike.
    const carrierNavy = {
      scenario: world,
      fleets: new Map([[7, { owner: 3, ships: [] }]]),
    } as unknown as WwNavy;
    expect(
      issueCarrierOrder(
        carrierNavy,
        3,
        { kind: "fleet_port_strike", fleet: 7, port: 679 },
        0,
      ),
    ).toBe("no_strike_region");
    // Strategic bombing never picks it.
    const air = { ww: { scenario: world } } as unknown as WwAir;
    expect(bombableRegions(air, world.regionSr(679))).not.toContain(679);
  });

  it("a strike mission over the Korean Peninsula or Taiwan zone is refused (final review B, M2)", () => {
    const air = {
      ww: {
        scenario: world,
        depth: { noStrike: (r: number) => isNoStrike(world, r) },
      },
    } as unknown as WwAir;
    const korea = world.regionSr(679);
    const taiwan = world.regionSr(901);
    expect(allNoStrikeZone(air, korea)).toBe(true);
    expect(allNoStrikeZone(air, taiwan)).toBe(true);
    expect(allNoStrikeZone(air, world.regionSr(758))).toBe(false); // Tokyo's
    const ask = {
      sr: korea,
      srKind: "land" as const,
      type: "cas" as const,
      mission: "cas" as const,
      count: 10,
      have: 50,
      deploymentsUsed: 0,
      anyBaseInRange: true,
    };
    expect(STRIKE_AIR_MISSIONS).toEqual([
      "cas",
      "strategic_bombing",
      "port_strike",
    ]);
    expect(airDeployBlock(ask)).toBeNull();
    expect(airDeployBlock({ ...ask, allNoStrike: true })).toBe(
      "no_strike_region",
    );
    expect(
      airDeployBlock({
        ...ask,
        type: "strat_bomber",
        mission: "strategic_bombing",
        allNoStrike: true,
      }),
    ).toBe("no_strike_region");
    // Fighters may still defend it, and a recall (count 0) is never refused.
    expect(
      airDeployBlock({
        ...ask,
        type: "fighter",
        mission: "air_superiority",
        allNoStrike: true,
      }),
    ).toBeNull();
    expect(airDeployBlock({ ...ask, count: 0, allNoStrike: true })).toBeNull();
  });
});
