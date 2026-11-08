// World War 1936 P6 T1b (navy/air half): the proximity fuze and the cavity
// magnetron in P4's war (P6 spec §9.3 table; plan Step 15) on ww1936deep —
// Britain and Italy, both human, at war: anti-air ×1.5 (regions' guns,
// ships' AA, a port's guns), radar stations +100‰ a level, the air radar
// module's naval patrol ×1.3 → ×1.5.
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import { FLEET_STATES } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { radarPmAt } from "@openfront/engine/ww1936/air/AirSuperiority";
import { withFuze } from "@openfront/engine/ww1936/air/ProjectEffects";
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
    for (const id of [...ww.air.wingsIn(sr)]) {
      ww.air.removeWing(id, true);
    }
  }
  return { runner, ww, day: ww.day(runner.game.ticks()) };
}

function done(ww: WorldWar, id: number, p: number): void {
  ww.depth.country(id)!.proj.done |= 1 << p;
}

function setAa(ww: WorldWar, region: number, level: number): void {
  ww.economy.buildingArray("anti_air")[region] = level;
  ww.economy.afterBuildingChange(region, "anti_air");
}

describe("T1b: the proximity fuze (anti-air ×1.5)", () => {
  it("anti-air ×1.5 for the fuze's owner only (withFuze, the wing raids' guns)", async () => {
    const { ww } = await atWar();
    expect(withFuze(ww.depth, ITA, 300)).toBe(300);
    done(ww, ITA, FUZE);
    expect(withFuze(ww.depth, ITA, 300)).toBe(450);
    expect(withFuze(ww.depth, GBR, 300)).toBe(300);
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
});
