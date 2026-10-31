// World War 1936 P6 lane U4: the rocket and the three raid flows, and the
// no-strike rule in every strike flow (Korea and Taiwan are greyed out by
// the engine-lib judge, never offered).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  EQUIP_KEY_COUNT,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { EventBus } from "@openfront/shared/EventBus";
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { WwStrikeFlowEvent } from "../../../src/client/hud/ww1936/DepthEvents";
import { WwNukeFlow } from "../../../src/client/hud/ww1936/WwNukeFlow";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { REGION } from "../../ww1936/seaFixture";
import { depthGame } from "./DepthU4Fixture";
import { division, landDetail } from "./LandFixture";
import { seaDetail, SID } from "./SeaAirFixture";

/**
 * Final review B, I2: the judge goes by world1936's fixed ids, so the test
 * map's stand-ins are added to it for one scenario index (the real judge
 * for every other index, the real map's included).
 */
const STAND_INS = new WeakMap<object, ReadonlySet<number>>();
vi.mock("@openfront/engine-lib/ww1936/NoStrike", async (importOriginal) => {
  const m =
    await importOriginal<
      typeof import("@openfront/engine-lib/ww1936/NoStrike")
    >();
  const judge = (sc: ScenarioIndex, r: number) =>
    (STAND_INS.get(sc)?.has(r) ?? false) || m.isNoStrike(sc, r);
  return {
    ...m,
    isNoStrike: judge,
    strikeBlock: (sc: ScenarioIndex, r: number) =>
      judge(sc, r) ? "no_strike_region" : null,
  };
});

const SEA_DIR = path.join(__dirname, "../../testdata/maps/ww1936sea");
const seaData = JSON.parse(
  fs.readFileSync(path.join(SEA_DIR, "scenario.json"), "utf8"),
) as ReadonlyScenarioData & { regions: { id: number; name: string }[] };
const bin = new Uint8Array(fs.readFileSync(path.join(SEA_DIR, "regions.bin")));

/** The sea map with some regions standing in for Korea/Taiwan (same ids, names). */
function renamed(names: Record<number, string>): ScenarioIndex {
  const data = structuredClone(seaData);
  for (const r of data.regions) if (names[r.id]) r.name = names[r.id];
  const sc = ScenarioIndex.fromFiles(data, bin);
  STAND_INS.set(sc, new Set(Object.keys(names).map(Number)));
  return sc;
}

type GameLike = { wwLand(): { controller: Uint16Array } | null };

function setup(alt: Record<number, string> | null) {
  const sr = ScenarioIndex.fromFiles(seaData, bin).srOfZoneOrRegion(
    REGION.berlin,
  );
  const stock = new Array<number>(EQUIP_KEY_COUNT).fill(0);
  stock[equipKey("flying_bomb", 1)] = 5;
  const g = depthGame({
    wars: [
      ["GBR", "DEU"],
      ["GBR", "ITA"],
    ],
    summary: { atomicStock: 1 },
    details: [seaDetail("GBR", { stock })],
    landDetails: [
      landDetail("GBR", {
        divisions: [
          division(70, 5, REGION.london),
          division(71, 6, REGION.london),
        ],
      }),
    ],
    deployments: [
      {
        id: 7,
        owner: SID("GBR"),
        sr,
        type: "strat_bomber",
        mission: "strategic_bombing",
        counts: [40, 0, 0],
        target: 0,
        base: REGION.london,
      },
    ],
  });
  const scenario = alt === null ? null : renamed(alt);
  const game =
    scenario === null
      ? g.game
      : ({ ...(g.game as object), worldWarScenario: () => scenario } as never);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  let t = 1_000;
  const flow = new WwNukeFlow(game, bus, () => t);
  flow.init();
  return { flow, bus, sent, sr, advance: (ms: number) => (t += ms) };
}

describe("rocket and raid flows", () => {
  it("a rocket: pick a target, set kind and count, launch", () => {
    const m = setup(null);
    expect(m.flow.start("rocket", REGION.paris)).toBe(true);
    expect(m.flow.targets()).toContain(REGION.berlin);
    m.flow.tapRegion(REGION.berlin);
    expect(m.flow.state.step).toBe("setup");
    m.flow.setCount(3);
    expect(m.flow.fire()).toBe(true);
    expect(m.sent).toEqual([
      {
        kind: "rocket_strike",
        site: REGION.paris,
        target: REGION.berlin,
        rocket: "flying_bomb",
        count: 3,
      },
    ]);
  });

  it("a paratrooper raid: the event starts it, a building is chosen, two taps send it", () => {
    const m = setup(null);
    // U5's picker names the building wanted (merge glue).
    m.bus.emit(new WwStrikeFlowEvent("raid_para", 5, "air_base"));
    expect(m.flow.state.kind).toBe("raid_para");
    expect(m.flow.targets()).toContain(REGION.berlin);
    m.flow.tapRegion(REGION.berlin);
    expect(m.flow.state.step).toBe("setup");
    // Judged on Berlin's controller (DepthMiscModel.raidTargets): the
    // paratroopers' list, standing there.
    expect(m.flow.raidBuildings()).toEqual(["air_base"]);
    expect(m.flow.state.building).toBe("air_base");
    // A building outside the judged list is never taken or sent.
    m.flow.setBuilding("civ");
    expect(m.flow.state.building).toBe("air_base");
    expect(m.flow.confirmRaid()).toBe(false);
    m.advance(500);
    expect(m.flow.confirmRaid()).toBe(true);
    expect(m.sent).toEqual([
      {
        kind: "raid",
        raid: "raid_para",
        unit: 70,
        target: REGION.berlin,
        building: "air_base",
      },
    ]);
  });

  it("a raid's wanted building falls back to one allowed there; no controller, no buildings", () => {
    const m = setup(null);
    m.bus.emit(new WwStrikeFlowEvent("raid_para", 5, "facility_nuclear"));
    m.flow.tapRegion(REGION.berlin);
    expect(m.flow.state.building).toBe("air_base");
    const land = (m.flow as unknown as { game: GameLike }).game.wwLand()!;
    const was = land.controller[REGION.berlin];
    land.controller[REGION.berlin] = 0;
    expect(m.flow.raidBuildings()).toEqual([]);
    expect(m.flow.confirmRaid()).toBe(false);
    land.controller[REGION.berlin] = was;
  });

  it("a commando raid offers coastal enemy regions", () => {
    const m = setup(null);
    expect(m.flow.start("raid_commando", 6)).toBe(true);
    // Rome is coastal and Italian; Berlin is not coastal.
    expect(m.flow.targets()).toContain(REGION.rome);
    expect(m.flow.targets()).not.toContain(REGION.berlin);
    m.flow.tapRegion(REGION.rome);
    m.flow.state.building = "dock";
    m.flow.confirmRaid();
    m.advance(500);
    m.flow.confirmRaid();
    expect(m.sent).toEqual([
      {
        kind: "raid",
        raid: "raid_commando",
        unit: 71,
        target: REGION.rome,
        building: "dock",
      },
    ]);
  });

  it("a raid does not start without a division", () => {
    const m = setup(null);
    expect(m.flow.start("raid_para", 999)).toBe(false);
  });
});

describe("the no-strike rule in every strike flow", () => {
  it("bomb, rocket, bomber raid, paratrooper and commando flows never offer or take them", () => {
    // Berlin and Rome stand in for Korea and Taiwan: the judge refuses them.
    const names = { [REGION.berlin]: "Taiwan", [REGION.rome]: "Ryanggang" };
    // Control: without the names every flow offers its region.
    const ctl = setup(null);
    expect(ctl.flow.start("nuke", ctl.sr)).toBe(true);
    expect(ctl.flow.targets()).toContain(REGION.berlin);
    ctl.flow.cancel();
    expect(ctl.flow.start("rocket", REGION.paris)).toBe(true);
    expect(ctl.flow.targets()).toContain(REGION.berlin);
    ctl.flow.cancel();
    expect(ctl.flow.start("raid_para", 5)).toBe(true);
    expect(ctl.flow.targets()).toContain(REGION.berlin);
    ctl.flow.cancel();
    expect(ctl.flow.start("raid_commando", 6)).toBe(true);
    expect(ctl.flow.targets()).toContain(REGION.rome);
    ctl.flow.cancel();
    const m = setup(names);
    // The bomb: Berlin is the zone's only enemy region offered by the control run.
    expect(m.flow.targets()).toEqual([]);
    m.flow.start("nuke", m.sr);
    expect(m.flow.targets()).not.toContain(REGION.berlin);
    m.flow.tapRegion(REGION.berlin);
    expect(m.flow.state.region).toBe(0);
    m.flow.cancel();
    m.flow.start("rocket", REGION.paris);
    expect(m.flow.targets()).not.toContain(REGION.berlin);
    expect(m.flow.tapRegion(REGION.berlin)).toBe(false);
    m.flow.cancel();
    m.flow.start("raid_bomb", 7);
    expect(m.flow.targets()).not.toContain(REGION.berlin);
    m.flow.cancel();
    m.flow.start("raid_para", 5);
    expect(m.flow.targets()).not.toContain(REGION.berlin);
    expect(m.flow.tapRegion(REGION.berlin)).toBe(false);
    m.flow.cancel();
    m.flow.start("raid_commando", 6);
    expect(m.flow.targets()).not.toContain(REGION.rome);
    expect(m.flow.tapRegion(REGION.rome)).toBe(false);
    expect(m.sent).toEqual([]);
  });
});
