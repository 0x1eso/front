// World War 1936 P6 T1b (navy/air half): P4's naval and air AI leave the
// depth AI's mine fleets and recon groups alone (lane W2's sites 7 and 8;
// spec §19.7) on ww1936deep — Britain left to the AI, at war with Italy.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_MISSIONS,
  SHIP_CLASSES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { aiAir, aiAirInput } from "@openfront/engine/ww1936/air/AiAir";
import { deploymentPlanes } from "@openfront/engine/ww1936/air/WwAir";
import {
  aiSeaAirDay,
  homeSeaRegions,
  isDepthDeployment,
  isDepthFleet,
} from "@openfront/engine/ww1936/depth/AiSeaAir";
import { aiNavy } from "@openfront/engine/ww1936/navy/AiNavy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const LAY = FLEET_MISSIONS.indexOf("lay_mines");

async function aiBritainAtWar() {
  const runner = await wwRunner(
    {},
    [{ clientID: "HUMANITA", country: "ITA" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = runner.game.worldWar()!;
  ww.setWar(GBR, ITA, runner.game.ticks());
  return { runner, ww, day: ww.day(runner.game.ticks()) };
}

describe("T1b: P4's AI leaves the depth AI's fleets and groups alone", () => {
  it("the naval AI gives no order to a mine fleet", async () => {
    const { ww, day } = await aiBritainAtWar();
    const d = ww.depth;
    const navy = ww.navy;
    const def: DesignDef = {
      kind: "ship",
      base: "dd_1",
      modules: ["", "", "", "mine_layer"],
      name: "Test DD",
    };
    d.country(GBR)!.des.ship[0] = {
      def: def as never,
      origin: "own",
      from: 0,
      fromSlot: 0,
      obsolete: false,
      savedDay: 0,
    };
    d.markDesign(GBR, "ship", 1);
    const id = navy.createFleet(GBR, DEEP.region.london, [["dd", 1, 3]]);
    for (const sid of navy.fleets.get(id)!.ships) {
      const r = navy.ships.rowOf(sid);
      if (SHIP_CLASSES[navy.ships.cls[r]] === "dd") navy.ships.design[r] = 1;
    }
    // The depth AI sends the mine layers out.
    aiSeaAirDay(d, GBR, day);
    const mines = navy.fleetsOf(GBR).filter((f) => f.mission === LAY);
    expect(mines.length).toBe(1);
    const f = mines[0];
    expect(isDepthFleet(f)).toBe(true);
    const home = homeSeaRegions(d, GBR)[0];
    expect(f.missionSr).toBe(home);
    const ships = [...f.ships];
    // P4's naval AI runs its day: the mine fleet keeps its mission.
    aiNavy(navy, GBR, day);
    aiNavy(navy, GBR, day + 1);
    const after = navy.fleets.get(f.id)!;
    expect(after.mission).toBe(LAY);
    expect(after.missionSr).toBe(home);
    expect(after.ships).toEqual(ships);
  });

  it("the air AI neither counts nor recalls a recon group", async () => {
    const { ww, day } = await aiBritainAtWar();
    const air = ww.air;
    const fighter = AIR_TYPES.indexOf("fighter");
    const counts = new Array<number>(EQUIPMENT_GENS.fighter).fill(0);
    counts[0] = 24;
    const recon = air.addDeployment({
      owner: GBR,
      sr: DEEP.sr.westLand,
      type: fighter,
      mission: AIR_MISSIONS.indexOf("recon"),
      counts,
      target: 24,
      base: DEEP.region.london,
      lossRest: 0,
      auto: false,
      volunteerFor: 0,
    });
    expect(isDepthDeployment(recon)).toBe(true);
    const input = aiAirInput(air, GBR, day, true, false);
    expect(input.current.some((c) => c.mission === "recon")).toBe(false);
    // Its 24 planes are not in P4's pool (the stock and P4's own groups).
    const ce = ww.economy.country(GBR)!;
    let pool = 0;
    for (let g = 1; g <= EQUIPMENT_GENS.fighter; g++) {
      pool += ce.stock[equipKey("fighter", g)] ?? 0;
    }
    for (const x of air.deploymentsOf(GBR)) {
      if (x.type === fighter && x.base >= 0 && x.id !== recon.id) {
        pool += deploymentPlanes(x);
      }
    }
    expect(input.planes[fighter]).toBe(pool);
    // P4's AI plans its day: the group flies on, whole.
    aiAir(air, GBR, day);
    aiAir(air, GBR, day + 1);
    const x = air.deployments.get(recon.id);
    expect(x?.mission).toBe(AIR_MISSIONS.indexOf("recon"));
    expect(x?.counts[0]).toBe(24);
  });
});
