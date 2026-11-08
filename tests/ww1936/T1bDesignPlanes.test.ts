// World War 1936 P6 T1b (navy/air half): plane designs in P4's air war,
// end to end (lane E's T1b sites 1–4; spec §5.4) on ww1936deep — a human
// Britain at war with a human Italy. A plane design line fills the stock,
// a deployment draws it, it flies with the design's numbers, its losses
// come off the design ledger (with the design's reliability), and a recall
// puts the rest back; a carrier deck carries designs the same way.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  CARRIER_AIR_TYPES,
  WING_UPGRADE_PER_REARM,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  type PlaneDesignStats,
  WW_PLANE_DESIGN_SLOTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  planeType,
  recommendedPlane,
} from "@openfront/engine-lib/ww1936/DesignRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { rearmWing } from "@openfront/engine/ww1936/air/Wings";
import { fillDecks } from "@openfront/engine/ww1936/navy/Carriers";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";
import { giveWing } from "./wingUtil";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const KEY = equipKey("plane_design", 1);
type Def = Extract<DepthOrder, { kind: "design_save" }>["def"];

async function atWar(): Promise<{ runner: GameRunner; ww: WorldWar }> {
  const runner = await wwRunner(
    {},
    [
      { clientID: "HUMANGBR", country: "GBR" },
      { clientID: "HUMANITA", country: "ITA" },
    ],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  ww.setWar(GBR, ITA, runner.game.ticks());
  for (const id of [GBR, ITA]) ww.economy.country(id)!.fuelMilli = 1e12;
  return { runner, ww };
}

/** Britain saves a fighter design in slot 1 by the player's order. */
function saveFighter(
  ww: WorldWar,
  runner: GameRunner,
  weak = false,
): PlaneDesignStats {
  const d = ww.depth;
  const def = {
    ...recommendedPlane("small_1", new Set(WW_TECH_IDS)),
    name: "Spit",
    // (A weak weapon: the design is old against the newest static fighter.)
    ...(weak ? { modules: ["w_mg2", "", "", ""] } : {}),
  } as Def;
  // The techs the fit asks for (the test's, plan decision 30).
  const ce = ww.economy.country(GBR)!;
  for (const t of WW_TECH_IDS) ce.addTech(t);
  expect(planeType(def as never)).toBe("fighter");
  expect(
    d.issue(GBR, { kind: "design_save", def }, runner.game.ticks()),
  ).toBeNull();
  const st = d.designStatsOf(GBR, "plane", 1) as PlaneDesignStats;
  expect(st.type).toBe("fighter");
  return st;
}

/** No static fighters anywhere: the design is all Britain has. */
function noStaticFighters(ww: WorldWar, id: number): void {
  const ce = ww.economy.country(id)!;
  for (let g = 1; g <= EQUIPMENT_GENS.fighter; g++) {
    ce.stock[equipKey("fighter", g)] = 0;
  }
}

describe("T1b: plane designs in P4's air war (lane E's sites)", () => {
  it("ww8: a rearm swaps design planes too, the oldest for a newer one in stock", async () => {
    const { runner, ww } = await atWar();
    const ce = ww.economy.country(GBR)!;
    // (The first save absorbs the static fighters of generation 1: save a weak design.)
    saveFighter(ww, runner, true);
    noStaticFighters(ww, GBR);
    const newest = equipKey("fighter", EQUIPMENT_GENS.fighter);
    const w = giveWing(ww.air, {
      owner: GBR,
      type: "fighter",
      counts: [0, 0, 0],
      dcounts: [150, ...new Array<number>(WW_PLANE_DESIGN_SLOTS - 1).fill(0)],
      base: DEEP.region.london,
    });
    ce.planesDeployed[KEY] = 150;
    ce.stock[KEY] = 0;
    ce.stock[newest] = 20;
    rearmWing(ww.air, w, runner.game.ticks());
    expect(w.dcounts[0]).toBe(150 - WING_UPGRADE_PER_REARM);
    expect(w.counts[EQUIPMENT_GENS.fighter - 1]).toBe(WING_UPGRADE_PER_REARM);
    expect(ce.stock[KEY]).toBe(WING_UPGRADE_PER_REARM);
    expect(ce.planesDeployed[KEY]).toBe(150 - WING_UPGRADE_PER_REARM);
    expect(ce.stock[newest]).toBe(20 - WING_UPGRADE_PER_REARM);
  });

  it("a carrier's deck takes design planes, launches them and loses them with the ship", async () => {
    const { runner, ww } = await atWar();
    const d = ww.depth;
    const navy = ww.navy;
    const ce = ww.economy.country(GBR)!;
    for (const t of WW_TECH_IDS) ce.addTech(t);
    const def = {
      kind: "plane",
      base: "small_1",
      modules: ["w_mg4", "", "", "m_carrier"],
      name: "Sea",
    } as Def;
    expect(
      d.issue(GBR, { kind: "design_save", def }, runner.game.ticks()),
    ).toBeNull();
    const st = d.designStatsOf(GBR, "plane", 1) as PlaneDesignStats;
    expect(st.type).toBe("cv_fighter");
    // Only design carrier fighters in the stock.
    for (const t of CARRIER_AIR_TYPES) {
      for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) ce.stock[equipKey(t, g)] = 0;
    }
    ce.stock[KEY] = 50;
    const id = navy.createFleet(GBR, DEEP.region.london, [["cv", 1, 1]]);
    const f = navy.fleets.get(id)!;
    f.mix = [10, 0, 0];
    const row = navy.ships.rowOf(f.ships[0]);
    fillDecks(navy, GBR);
    const deckD = navy.ships.deckDOf(row);
    expect(deckD[0]).toBeGreaterThan(0);
    const onDeck = deckD[0];
    expect(ce.stock[KEY]).toBe(50 - onDeck);
    expect(ce.planesDeployed[KEY]).toBe(onDeck);
    // A smaller share sends the surplus back.
    f.mix = [5, 0, 5];
    fillDecks(navy, GBR);
    expect(ce.stock[KEY] + navy.ships.deckDOf(row)[0]).toBe(50);
    expect(ce.planesDeployed[KEY]).toBe(navy.ships.deckDOf(row)[0]);
    // Sunk: the deck's design planes go down with it.
    const left = navy.ships.deckDOf(row)[0];
    expect(left).toBeGreaterThan(0);
    navy.removeShip(f.ships[0], true, runner.game.ticks(), ITA);
    expect(ce.planesDeployed[KEY]).toBe(0);
    expect(ce.stock[KEY]).toBe(50 - left);
  }, 120_000);
});
