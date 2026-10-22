// World War 1936 P6 T1b-L: the deferred P5 reads — lane I's resistance
// adjustment in the occupation target (pre-flight A10), lane E's receiveKey
// in P5's capture and lend-lease (spec §5.6, §26), and W3's congress before
// P5's llBlock (spec §13.1). Direct calls on the deep map (plan decision 30).
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey, WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { saveDesign } from "@openfront/engine/ww1936/depth/Designs";
import {
  captureOnBattleEnd,
  captureOnCapitulation,
  captureOnEncircled,
} from "@openfront/engine/ww1936/endgame/Capture";
import {
  contractsOf,
  deliverLendLease,
  llOrderBlock,
  openLendLease,
  requestLendLease,
} from "@openfront/engine/ww1936/endgame/LendLease";
import { occView } from "@openfront/engine/ww1936/endgame/Occupation";
import type { Battle } from "@openfront/engine/ww1936/land/WwLand";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, placeArmy, stepTo, takeRegion, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => {
  usePoliticsContent(null);
  vi.restoreAllMocks();
});

const DEU = DEEP.tag.DEU;
const GBR = DEEP.tag.GBR;
const FRA = DEEP.tag.FRA;
const WARSAW = DEEP.region.warsaw;
const BERLIN = DEEP.region.berlin;
const MED1: DesignDef = {
  kind: "tank",
  base: "medium_1",
  modules: ["gun_cs", "turret_2", "bogie", "welded", "petrol", "", ""],
  armorLevel: 0,
  engineLevel: 0,
  name: "Med I",
};
const TANK1 = equipKey("tank_design", 1);
const TANK2 = equipKey("tank_design", 2);
/** The first design slot of a division (tank_design slot 1). */
const J1 = GROUND_STATIC_SLOTS;

async function game() {
  const runner = await wwRunner(
    {},
    [
      { clientID: HUMAN, country: "DEU" },
      { clientID: "HUMAN002", country: "GBR" },
    ],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  const stock = (id: number, key: number) => ww.economy.country(id)!.stock[key];
  return { runner, g, ww, d: ww.depth, eg: ww.endgame, stock };
}

function techs(ww: WorldWar, id: number, list: WwTechId[]): void {
  const ce = ww.economy.country(id)!;
  for (const t of list) ce.addTech(t);
}

/** Germany's design in slot 1; Britain's own (the same fit) in its slot 1, so a copy lands in slot 2. */
function designs(ww: WorldWar): void {
  const d = ww.depth;
  techs(ww, DEU, ["medium_tank_1"]);
  techs(ww, GBR, ["medium_tank_1"]);
  expect(saveDesign(d, DEU, MED1, 0, "own", 0, 0, 0)).toBe(1);
  expect(saveDesign(d, GBR, MED1, 0, "own", 0, 0, 0)).toBe(1);
  expect(J1).toBe(GROUND_EQUIP_KEYS.indexOf(TANK1));
}

describe("T1b-L: resistance reads lane I (pre-flight A10)", () => {
  it("the occupation target adds resistanceAdjPp: operations and a nuked region", async () => {
    const { g, d, eg } = await game();
    takeRegion(g, WARSAW, "DEU");
    expect(eg.isAdministered(WARSAW)).toBe(true);
    const base = occView(eg, WARSAW).targetBp;
    expect(d.resistanceAdjPp(WARSAW)).toBe(0);
    // Lane I's table (state): +12pp of support in Warsaw.
    d.resistBoost = [[WARSAW, 12]];
    d.reindexSparse();
    expect(d.resistanceAdjPp(WARSAW)).toBe(12);
    expect(occView(eg, WARSAW).targetBp).toBe(Math.min(10_000, base + 1200));
    // Suppression takes it down; the target never goes under 0.
    d.resistBoost = [[WARSAW, -500]];
    d.reindexSparse();
    expect(occView(eg, WARSAW).targetBp).toBe(0);
    // A nuked region (lane S): +10pp while it lasts.
    d.resistBoost = [];
    d.reindexSparse();
    d.markNuked(WARSAW, d.lastCommonDay + 30);
    expect(d.resistanceAdjPp(WARSAW)).toBe(10);
    expect(occView(eg, WARSAW).targetBp).toBe(Math.min(10_000, base + 1000));
  }, 60_000);
});

describe("T1b-L: captured and lend-leased designs go through receiveKey", () => {
  it("a battle's capture lands in the captor's copy of the losing lead's design", async () => {
    const { ww, d, eg, stock } = await game();
    designs(ww);
    const capEq = new Array<number>(GROUND_SLOTS * 2).fill(0);
    // The German defenders lost 400 tanks of their design.
    capEq[GROUND_SLOTS + J1] = 400_000;
    const battle: Battle = {
      region: BERLIN,
      sinceTick: 0,
      round: 3,
      attackers: [],
      defenders: [],
      attLine: [],
      defLine: [],
      startOrgMilli: 0,
      lostOrgMilli: 0,
      attLead: GBR,
      defLead: DEU,
      capEq,
      dmgBy: [[GBR, 100]],
    };
    const before = [stock(GBR, TANK1), stock(GBR, TANK2)];
    captureOnBattleEnd(eg, battle, 0);
    // 5% of 400: Britain's own design (slot 1) untouched, the copy in slot 2.
    expect(stock(GBR, TANK1)).toBe(before[0]);
    expect(stock(GBR, TANK2) - before[1]).toBe(20);
    const s = d.designSlot(GBR, "tank", 2)!;
    expect([s.origin, s.from, s.fromSlot]).toEqual(["captured", DEU, 1]);
  }, 60_000);

  it("an encircled division's design goes to the captor's copy", async () => {
    const { g, ww, d, eg, stock } = await game();
    designs(ww);
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const t = ww.land.divisions;
    const row = t.rowOf(a.divisions[0]);
    t.equip[row * GROUND_SLOTS + J1] = 50;
    const before = stock(GBR, TANK2);
    captureOnEncircled(eg, row, GBR);
    expect(stock(GBR, TANK2) - before).toBe(10);
    expect(d.designSlot(GBR, "tank", 2)!.origin).toBe("captured");
  }, 60_000);

  it("a capitulation's stock and division share land in the victor's copy", async () => {
    const { g, ww, d, eg, stock } = await game();
    designs(ww);
    ww.economy.country(DEU)!.stock[TANK1] = 100;
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const t = ww.land.divisions;
    t.equip[t.rowOf(a.divisions[0]) * GROUND_SLOTS + J1] = 50;
    const before = [stock(GBR, TANK1), stock(GBR, TANK2)];
    captureOnCapitulation(eg, DEU, GBR);
    // 25% of the stock (25) and 50% of the divisions' (25).
    expect(stock(GBR, TANK1)).toBe(before[0]);
    expect(stock(GBR, TANK2) - before[1]).toBe(50);
    expect(d.designSlot(GBR, "tank", 2)!.from).toBe(DEU);
  }, 60_000);

  it("a lend-lease shipment of a design arrives as the receiver's copy", async () => {
    const { ww, d, eg, stock } = await game();
    designs(ww);
    const day = Math.max(0, d.lastCommonDay);
    const before = stock(FRA, TANK1);
    eg.inTransit.push({
      contract: 0,
      from: DEU,
      to: FRA,
      item: "tank_design",
      gen: 1,
      countMilli: 30_000,
      arriveDay: day,
      srs: [],
      sea: false,
      costMilli: 0,
    });
    deliverLendLease(eg, day);
    expect(eg.inTransit).toHaveLength(0);
    // France had no design: its slot 1 is now Germany's, "received".
    expect(stock(FRA, TANK1) - before).toBe(30);
    const s = d.designSlot(FRA, "tank", 1)!;
    expect([s.origin, s.from, s.fromSlot]).toEqual(["received", DEU, 1]);
    // Into Britain (slot 1 its own): the copy's slot 2.
    const b2 = stock(GBR, TANK2);
    eg.inTransit.push({
      contract: 0,
      from: DEU,
      to: GBR,
      item: "tank_design",
      gen: 1,
      countMilli: 7_000,
      arriveDay: day,
      srs: [],
      sea: false,
      costMilli: 0,
    });
    deliverLendLease(eg, day);
    expect(stock(GBR, TANK2) - b2).toBe(7);
  }, 60_000);
});

describe("T1b-L: the US congress before P5's llBlock (spec §13.1)", () => {
  it("the order and the request are refused under 50% without the flag", async () => {
    const { ww, d, eg } = await game();
    // The deep map has no United States: Britain stands in for it.
    const pol = ww.politics;
    const idOfTag = pol.idOfTag.bind(pol);
    vi.spyOn(pol, "idOfTag").mockImplementation((t) =>
      t === "USA" ? GBR : idOfTag(t),
    );
    // llBlock passes: high tension (the democracy's and the receiver's marks).
    pol.wtBp = 10_000;
    const day = Math.max(0, d.lastCommonDay);
    d.mech.congressBp = 3_000;
    expect(llOrderBlock(eg, GBR, FRA, day)).toBe("ll_conditions");
    expect(llOrderBlock(eg, FRA, GBR, day)).toBeNull();
    expect(openLendLease(eg, GBR, FRA, "infantry_equipment", 1, 100, day)).toBe(
      "ll_conditions",
    );
    expect(requestLendLease(eg, FRA, GBR, "infantry_equipment", 100, day)).toBe(
      "ll_conditions",
    );
    expect(contractsOf(eg, GBR)).toHaveLength(0);
    // The lend_lease flag (the 1941 act) lets it through under 50%.
    pol.country(GBR)!.flags.set("lend_lease", [0, -1]);
    expect(llOrderBlock(eg, GBR, FRA, day)).toBeNull();
    pol.country(GBR)!.flags.delete("lend_lease");
    // So does 50% support.
    d.mech.congressBp = 5_000;
    expect(
      openLendLease(eg, GBR, FRA, "infantry_equipment", 1, 100, day),
    ).toBeNull();
    expect(contractsOf(eg, GBR)).toHaveLength(1);
  }, 60_000);
});
