// World War 1936 final review B, I1 and I3: nothing is built in Korea or
// Taiwan (the no-strike regions) — no order, no AI picker, no content
// effect — whoever holds them. On world1936 by the engine-lib fixed ids;
// on the deep test map a content no-strike group stands in for them (as
// WwDepth.noStrike reads both).
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDABLE,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { buildBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { NO_STRIKE_REGION_IDS } from "@openfront/engine-lib/ww1936/NoStrike";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { aiProjectsDay } from "@openfront/engine/ww1936/depth/AiProjects";
import { aiBuildPlant } from "@openfront/engine/ww1936/depth/AiWorld";
import {
  buildBlock,
  queueBuild,
} from "@openfront/engine/ww1936/economy/Construction";
import type {
  CountryEconomy,
  WwEconomy,
} from "@openfront/engine/ww1936/economy/WwEconomy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffect,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import fs from "fs";
import path from "path";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, step, stepTo, warAfterPrep, wwRunner } from "./util";

const dir = path.join(__dirname, "../../resources/maps/world1936");
const world = ScenarioIndex.fromFiles(
  JSON.parse(
    fs.readFileSync(path.join(dir, "scenario.json"), "utf8"),
  ) as ReadonlyScenarioData,
  new Uint8Array(fs.readFileSync(path.join(dir, "regions.bin"))),
);

/** The deep map's content with `regions` in a no-strike group. */
function noStrikeContent(regions: number[]) {
  const base = depthFixture();
  return depthFixture({
    groups: [...base.groups, { id: "korea_north", regions, owner1936: "DEU" }],
  });
}

afterEach(() => usePoliticsContent(null));

describe("World War 1936: nothing is built in Korea or Taiwan", () => {
  it("buildBlock refuses every building there, for any country (world1936)", () => {
    // The check comes first: nothing else of the economy is read.
    const econ = { scenario: world, ww: {} } as unknown as WwEconomy;
    for (const smallID of [1, 40, 77]) {
      const ce = { smallID } as unknown as CountryEconomy;
      for (const region of NO_STRIKE_REGION_IDS) {
        for (const b of BUILDABLE) {
          expect(buildBlock(econ, ce, region, b, 1), `${region} ${b}`).toBe(
            "no_strike_region",
          );
        }
      }
    }
  });

  it("the shared judge refuses it too, before any other check", () => {
    const check = {
      building: "naval_base" as const,
      count: 1,
      controlled: true,
      occupied: false,
      queueLength: 0,
      levelWithQueue: 0,
      usedSlots: 0,
      slots: 10,
      coastal: true,
      harbor: true,
      researched: new Set(WW_TECH_IDS),
    };
    expect(buildBlockOf(check)).toBeNull();
    expect(buildBlockOf({ ...check, noStrike: true })).toBe("no_strike_region");
    expect(buildBlockOf({ ...check, noStrike: false })).toBeNull();
    expect(buildBlockOf({ ...check, controlled: false, noStrike: true })).toBe(
      "no_strike_region",
    );
  });

  it("an order, the AI power plant and a content effect skip a no-strike region", async () => {
    const ROME = DEEP.region.rome;
    const ITA = DEEP.tag.ITA;
    const run = async (noStrike: number[]) => {
      usePoliticsContent(noStrikeContent(noStrike));
      const runner = await wwRunner(
        {},
        [{ clientID: HUMAN, country: "GBR" }],
        DEEP.map,
      );
      stepTo(runner, WW_PREP_TICKS + 2);
      const ww = runner.game.worldWar()!;
      const econ = ww.economy;
      const ce = econ.country(ITA)!;
      // Rome's slots are full: one civilian factory less makes room.
      econ.addBuilding(ROME, "civ", -1);
      ce.queue = [];
      const order = queueBuild(econ, ce, ROME, "infra", 1);
      ce.queue = [];
      aiBuildPlant(ww.depth, ce);
      const plant = ce.queue.filter((q) => q.building === "power_plant");
      ce.queue = [];
      const before = econ.buildingArray("air_base")[ROME];
      applyEffect(makeCtx(ww.politics, ITA, ITA, 0, runner.game.ticks()), {
        kind: "build",
        where: "capital",
        building: "air_base",
        count: 1,
      });
      const effect = econ.buildingArray("air_base")[ROME] - before;
      return { order, plant: plant.map((q) => q.region), effect };
    };
    // The control: Rome takes all three.
    expect(await run([])).toEqual({ order: null, plant: [ROME], effect: 1 });
    expect(await run([ROME])).toEqual({
      order: "no_strike_region",
      plant: [],
      effect: 0,
    });
  }, 60_000);

  it("the AI's rocket site goes to the nearest region that is not one", async () => {
    const deu = DEEP.tag.DEU;
    const site = async (noStrike: number[]) => {
      usePoliticsContent(noStrikeContent(noStrike));
      const runner = await wwRunner(
        { historicalAi: true },
        [{ clientID: HUMAN, country: "GBR" }],
        DEEP.map,
      );
      warAfterPrep(runner, HUMAN, "DEU");
      step(runner, 8);
      const ww = runner.game.worldWar()!;
      const d = ww.depth;
      d.country(deu)!.proj.done |=
        1 << SPECIAL_PROJECTS.indexOf("sp_flying_bomb");
      const ce = ww.economy.country(deu)!;
      ce.queue = [];
      // Its 10-day turn (day % 10 === id % 10): the arsenal runs.
      aiProjectsDay(d, deu, 10 * 40 + (deu % 10));
      return ce.queue
        .filter((q) => q.building === "rocket_site")
        .map((q) => q.region);
    };
    const control = await site([]);
    expect(control).toHaveLength(1);
    const other =
      control[0] === DEEP.region.berlin
        ? DEEP.region.munich
        : DEEP.region.berlin;
    expect(await site([control[0]])).toEqual([other]);
  }, 60_000);
});
