// World War 1936 P6 T1b (navy/air half): the proximity fuze and the cavity
// magnetron in P4's war (P6 spec §9.3 table; plan Step 15) on ww1936deep —
// Britain and Italy, both human, at war: anti-air ×1.5 (regions' guns,
// ships' AA, a port's guns), radar stations +100‰ a level, the air radar
// module's naval patrol ×1.3 → ×1.5.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  type AirMission,
  type AirType,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  type DesignDef,
  DS_RADAR,
  SPECIAL_PROJECTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { EQUIPMENT_GENS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { FLEET_STATES } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  dailyAirZone,
  zoneFlights,
} from "@openfront/engine/ww1936/air/AirCombat";
import { airMissionEffects } from "@openfront/engine/ww1936/air/AirEffects";
import { radarPmAt } from "@openfront/engine/ww1936/air/AirSuperiority";
import type { Deployment } from "@openfront/engine/ww1936/air/WwAir";
import { carrierPortStrike } from "@openfront/engine/ww1936/navy/Carriers";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const WEST = DEEP.sr.westLand;
const ROME = DEEP.region.rome;
const FUZE = SPECIAL_PROJECTS.indexOf("sp_proximity_fuze");
const MAGNETRON = SPECIAL_PROJECTS.indexOf("sp_cavity_magnetron");

async function atWar() {
  const runner = await wwRunner(
    {},
    [
      { clientID: "HUMANGBR", country: "GBR" },
      { clientID: "HUMANITA", country: "ITA" },
    ],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = runner.game.worldWar()!;
  ww.setWar(GBR, ITA, runner.game.ticks());
  for (const id of [GBR, ITA]) ww.economy.country(id)!.fuelMilli = 1e12;
  for (const sr of [WEST, DEEP.sr.approaches, DEEP.sr.central]) {
    for (const id of [...ww.air.deploymentsIn(sr)]) {
      ww.air.removeDeployment(id, true);
    }
  }
  return { runner, ww, day: ww.day(runner.game.ticks()) };
}

function done(ww: WorldWar, id: number, p: number): void {
  ww.depth.country(id)!.proj.done |= 1 << p;
}

function deploy(
  ww: WorldWar,
  owner: number,
  type: AirType,
  mission: AirMission,
  planes: number,
  sr: number = WEST,
): Deployment {
  const counts = new Array<number>(EQUIPMENT_GENS[type]).fill(0);
  counts[0] = planes;
  return ww.air.addDeployment({
    owner,
    sr,
    type: AIR_TYPES.indexOf(type),
    mission: AIR_MISSIONS.indexOf(mission),
    counts,
    target: planes,
    base: 0,
    lossRest: 0,
    auto: false,
    volunteerFor: 0,
  });
}

const lossMilli = (d: Deployment, start: number) =>
  (start - d.counts.reduce((a, b) => a + b, 0)) * 1000 + d.lossRest;

function setAa(ww: WorldWar, region: number, level: number): void {
  ww.economy.buildingArray("anti_air")[region] = level;
  ww.economy.afterBuildingChange(region, "anti_air");
}

describe("T1b: the proximity fuze (anti-air ×1.5)", () => {
  it("a region's guns hit raiders half as hard again", async () => {
    const run = async (fuze: boolean) => {
      const { ww, day } = await atWar();
      setAa(ww, ROME, 3);
      if (fuze) done(ww, ITA, FUZE);
      const b = deploy(ww, GBR, "strat_bomber", "strategic_bombing", 40);
      dailyAirZone(ww.air, WEST, day);
      return lossMilli(b, 40);
    };
    const plain = await run(false);
    const fuze = await run(true);
    expect(plain).toBeGreaterThan(0);
    // The ‰ rate × 1.5, then × the sorties (floors on both sides).
    expect(
      Math.abs(fuze - Math.floor((plain * 150) / 100)),
    ).toBeLessThanOrEqual(40);
    expect(fuze).toBeGreaterThan(plain);
  });

  it("ships' anti-air and a port's guns against a port strike", async () => {
    const run = async (fuze: boolean) => {
      const { ww, day } = await atWar();
      setAa(ww, ROME, 1);
      if (fuze) done(ww, ITA, FUZE);
      // Two Italian destroyers docked at Rome; British bombers strike the port.
      ww.navy.createFleet(ITA, ROME, [["dd", 1, 2]]);
      const b = deploy(ww, GBR, "bomber", "port_strike", 200);
      dailyAirZone(ww.air, WEST, day);
      const afterAa = lossMilli(b, 200);
      const before = { counts: [...b.counts], rest: b.lossRest };
      airMissionEffects(ww.air, WEST, day);
      const ships =
        (before.counts.reduce((a, c) => a + c, 0) -
          b.counts.reduce((a, c) => a + c, 0)) *
          1000 +
        b.lossRest -
        before.rest;
      return { afterAa, ships };
    };
    const plain = await run(false);
    const fuze = await run(true);
    expect(plain.ships).toBeGreaterThan(0);
    expect(fuze.ships).toBeGreaterThan(plain.ships);
    expect(
      Math.abs(fuze.ships - Math.floor((plain.ships * 150) / 100)),
    ).toBeLessThanOrEqual(10);
  });

  it("a carrier strike on a port meets the fuze too", async () => {
    const run = async (fuze: boolean) => {
      const { runner, ww } = await atWar();
      const navy = ww.navy;
      setAa(ww, ROME, 2);
      if (fuze) done(ww, ITA, FUZE);
      navy.createFleet(ITA, ROME, [["bb", 1, 3]]);
      const cv = navy.fleets.get(
        navy.createFleet(GBR, DEEP.region.london, [["cv", 1, 1]]),
      )!;
      cv.docked = 0;
      cv.state = FLEET_STATES.indexOf("on_station");
      navy.setFleetZone(cv, ww.scenario.harborOf(ROME));
      const r = navy.ships.rowOf(cv.ships[0]);
      navy.ships.deckOf(r)[6] = 40; // cv_naval_bomber, generation 1
      carrierPortStrike(navy, cv.id, ROME, runner.game.ticks());
      return 40 - navy.ships.deckOf(r)[6];
    };
    const plain = await run(false);
    const fuze = await run(true);
    expect(plain).toBeGreaterThan(0);
    expect(fuze).toBeGreaterThan(plain);
  });
});

describe("T1b: the cavity magnetron", () => {
  it("a radar station detects +100‰ a level", async () => {
    const { ww } = await atWar();
    const side = ww.land.sideOf(GBR);
    ww.economy.buildingArray("radar")[DEEP.region.london] = 2;
    ww.economy.afterBuildingChange(DEEP.region.london, "radar");
    expect(radarPmAt(ww.air, side, WEST)).toBe(300);
    done(ww, GBR, MAGNETRON);
    expect(radarPmAt(ww.air, side, WEST)).toBe(500);
  });

  it("the air radar module's naval patrol: ×1.3, ×1.5 with the magnetron", async () => {
    const run = async (magnetron: boolean) => {
      const { ww, day } = await atWar();
      const d = ww.depth;
      const def: DesignDef = {
        kind: "plane",
        base: "medium_1",
        modules: ["w_mg2", "", "", "", "m_radar"],
        name: "Radar",
      } as DesignDef;
      d.country(GBR)!.des.plane[0] = {
        def: def as never,
        origin: "own",
        from: 0,
        fromSlot: 0,
        obsolete: false,
        savedDay: 0,
      };
      d.markDesign(GBR, "plane", 1);
      if (magnetron) done(ww, GBR, MAGNETRON);
      const st = d.designStatsOf(GBR, "plane", 1)!;
      expect(st.flags & DS_RADAR).toBe(DS_RADAR);
      expect((st as { type: string }).type).toBe("naval_bomber");
      const nb = deploy(
        ww,
        GBR,
        "naval_bomber",
        "naval_patrol",
        0,
        DEEP.sr.approaches,
      );
      nb.dcounts[0] = 20;
      dailyAirZone(ww.air, DEEP.sr.approaches, day);
      const f = zoneFlights(ww.air, DEEP.sr.approaches).find(
        (x) => x.id === nb.id,
      )!;
      const gens = EQUIPMENT_GENS.naval_bomber;
      const z = ww.air.zoneState[ww.scenario.srIdxOf(DEEP.sr.approaches)];
      return {
        search: z.navalSearch.get(GBR),
        m: f.milli[gens],
        total: f.total,
      };
    };
    const plain = await run(false);
    expect(plain.total).toBe(plain.m);
    expect(plain.search).toBe(3 * (plain.m + Math.floor((plain.m * 30) / 100)));
    const mag = await run(true);
    expect(mag.search).toBe(3 * (mag.m + Math.floor((mag.m * 50) / 100)));
  });
});
