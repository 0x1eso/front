// World War 1936 P4 (plan Task 4 Step 6): carriers, decks and port
// strikes (spec §9.4, §9.6, §13.4, §14.9) on ww1936sea — a human Britain
// against a human Italy.
import { CARRIER_AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_STATES,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { CountryEconomy } from "@openfront/engine/ww1936/economy/WwEconomy";
import { fillDecks } from "@openfront/engine/ww1936/navy/Carriers";
import {
  startNavalBattle,
  stepNavalBattles,
} from "@openfront/engine/ww1936/navy/NavalBattles";
import {
  dailySeaRegion,
  type Fleet,
  type WwNavy,
} from "@openfront/engine/ww1936/navy/WwNavy";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import { warAfterPrep, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const GBR_H = "HUMAN001";
const HUMANS = [
  { clientID: GBR_H, country: "GBR" as const },
  { clientID: "HUMAN002", country: "ITA" as const },
];
const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;
const PORT: Record<number, number> = {
  [GBR]: REGION.london,
  [ITA]: REGION.rome,
};

async function seaWar(): Promise<{
  runner: GameRunner;
  navy: WwNavy;
  tick: number;
}> {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  warAfterPrep(runner, GBR_H, "ITA");
  return {
    runner,
    navy: runner.game.worldWar()!.navy,
    tick: runner.game.ticks(),
  };
}

function fleet(
  navy: WwNavy,
  owner: number,
  comp: readonly (readonly [ShipClass, number, number])[],
): Fleet {
  return navy.fleets.get(navy.createFleet(owner, PORT[owner], comp))!;
}

function toSea(navy: WwNavy, f: Fleet, zone: number): void {
  f.docked = 0;
  f.state = FLEET_STATES.indexOf("on_station");
  navy.setFleetZone(f, zone);
}

/** Every carrier plane of a country, generation 1..3: [stock, deployed]. */
function cvPlanes(ce: CountryEconomy): [number, number] {
  let stock = 0;
  let out = 0;
  for (const type of CARRIER_AIR_TYPES) {
    for (let g = 1; g <= 3; g++) {
      stock += ce.stock[equipKey(type, g)];
      out += ce.planesDeployed[equipKey(type, g)];
    }
  }
  return [stock, out];
}

const deckSum = (navy: WwNavy, id: number) =>
  [...navy.ships.deckOf(navy.ships.rowOf(id))].reduce((a, b) => a + b, 0);

/** Britain's 1922 carrier in London with full decks of 1936 carrier planes. */
function stockedCarrier(navy: WwNavy): Fleet {
  const ce = navy.econ.country(GBR)!;
  for (const type of CARRIER_AIR_TYPES) ce.stock[equipKey(type, 1)] += 100;
  const f = fleet(navy, GBR, [["cv", 1, 1]]);
  fillDecks(navy, GBR);
  expect(deckSum(navy, f.ships[0])).toBe(40);
  return f;
}

describe("carriers (spec §9.4, §9.6, §13.4)", () => {
  it("decks fill in port from the stock and stay at sea", async () => {
    const { navy } = await seaWar();
    const ce = navy.econ.country(GBR)!;
    const fighter1 = equipKey("cv_fighter", 1);
    const fighter2 = equipKey("cv_fighter", 2);
    ce.stock[fighter1] += 50;
    ce.stock[fighter2] += 10;
    ce.stock[equipKey("cv_cas", 1)] += 50;
    ce.stock[equipKey("cv_naval_bomber", 1)] += 50;
    const total = cvPlanes(ce)[0] + cvPlanes(ce)[1];
    const f = fleet(navy, GBR, [["cv", 1, 1]]);
    const cv = f.ships[0];
    const deck = () => [...navy.ships.deckOf(navy.ships.rowOf(cv))];
    fillDecks(navy, GBR);
    // Deck 40, mix 4:3:3 → 16 fighters (the 10 of 1940 first), 12 and 12.
    expect(deck()).toEqual([6, 10, 0, 12, 0, 0, 12, 0, 0]);
    expect(ce.planesDeployed[fighter2]).toBe(10);
    expect(ce.stock[fighter2]).toBe(0);
    expect(cvPlanes(ce)[0] + cvPlanes(ce)[1]).toBe(total);
    // At sea nothing changes, even with a new mix and planes in the stock.
    toSea(navy, f, ZONE.west);
    expect(
      navy.issue(GBR, { kind: "carrier_mix", fleet: f.id, mix: [10, 0, 0] }, 0),
    ).toBeNull();
    ce.stock[fighter2] += 20;
    fillDecks(navy, GBR);
    expect(deck()).toEqual([6, 10, 0, 12, 0, 0, 12, 0, 0]);
    // Back in port: the CAS and bombers go back, fighters fill to 40.
    f.docked = REGION.london;
    navy.setFleetZone(f, ZONE.west);
    fillDecks(navy, GBR);
    expect(deck()).toEqual([10, 30, 0, 0, 0, 0, 0, 0, 0]);
    expect(cvPlanes(ce)[0] + cvPlanes(ce)[1]).toBe(total + 20);
    // A mix must make 10 tenths.
    expect(
      navy.issue(GBR, { kind: "carrier_mix", fleet: f.id, mix: [5, 3, 3] }, 0),
    ).toBe("bad_index");
  });

  it("the first carrier strike comes in round 3 (base_strike_2: round 2)", async () => {
    const firstStrike = async (cut: boolean): Promise<number[]> => {
      const { navy, tick } = await seaWar();
      if (cut) navy.econ.country(GBR)!.addTech("base_strike_2");
      expect(navy.econ.country(GBR)!.stats.carrierRoundsCut).toBe(cut ? 1 : 0);
      const g = stockedCarrier(navy);
      toSea(navy, g, ZONE.west);
      const i = fleet(navy, ITA, [["bb", 1, 1]]);
      toSea(navy, i, ZONE.west);
      const bb = i.ships[0];
      startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), i.id, tick);
      const lost: number[] = [];
      for (let r = 1; r <= 3; r++) {
        const hp = navy.ships.hp[navy.ships.rowOf(bb)];
        stepNavalBattles(navy, tick);
        lost.push(hp - navy.ships.hp[navy.ships.rowOf(bb)]);
      }
      return lost;
    };
    // The carrier's own guns barely scratch a battleship; its planes do not.
    const [a1, a2, a3] = await firstStrike(false);
    expect(a1).toBe(a2);
    expect(a3).toBeGreaterThan(20 * a1);
    const [b1, b2, b3] = await firstStrike(true);
    expect(b2).toBeGreaterThan(20 * b1);
    expect(b3).toBe(b1);
  });

  it("deck planes are conserved", async () => {
    const { navy, tick } = await seaWar();
    const ce = navy.econ.country(GBR)!;
    const g = stockedCarrier(navy);
    const cv = g.ships[0];
    const [stock0, out0] = cvPlanes(ce);
    toSea(navy, g, ZONE.west);
    // Two Italian carriers with empty decks: their anti-air (2 × 12) takes
    // 1.2 → 1 plane from each strike.
    const i = fleet(navy, ITA, [["cv", 1, 2]]);
    toSea(navy, i, ZONE.west);
    startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), i.id, tick);
    const deck0 = deckSum(navy, cv);
    for (let r = 1; r <= 6; r++) stepNavalBattles(navy, tick);
    const deck1 = deckSum(navy, cv);
    expect(deck0 - deck1).toBe(2);
    const [stock1, out1] = cvPlanes(ce);
    expect(stock1).toBe(stock0);
    expect(out0 - out1).toBe(deck0 - deck1);
    // Docked again, the deck refills from the stock: the total stays.
    navy.battles.clear();
    g.docked = REGION.london;
    fillDecks(navy, GBR);
    expect(deckSum(navy, cv)).toBe(40);
    const [stock2, out2] = cvPlanes(ce);
    expect(stock2 + out2).toBe(stock1 + out1);
  });

  it("a port strike hits docked ships once", async () => {
    const { runner, navy, tick } = await seaWar();
    const g = stockedCarrier(navy);
    const docked = fleet(navy, ITA, [["bb", 1, 2]]);
    expect(docked.docked).toBe(REGION.rome);
    const order = {
      kind: "fleet_port_strike" as const,
      fleet: g.id,
      port: REGION.rome,
    };
    // From the West Sea, Rome's harbor (the Middle Sea) is another region.
    toSea(navy, g, ZONE.west);
    expect(navy.issue(GBR, order, tick)).toBe("out_of_range");
    navy.setFleetZone(g, ZONE.middle);
    expect(navy.issue(GBR, { ...order, port: REGION.london }, tick)).toBe(
      "not_at_war",
    );
    const noCarrier = fleet(navy, GBR, [["dd", 1, 1]]);
    toSea(navy, noCarrier, ZONE.middle);
    expect(navy.issue(GBR, { ...order, fleet: noCarrier.id }, tick)).toBe(
      "bad_ship_class",
    );
    expect(navy.issue(GBR, order, tick)).toBeNull();
    expect(g.portStrike).toBe(REGION.rome);
    const hp = () =>
      docked.ships.map((id) => navy.ships.hp[navy.ships.rowOf(id)]);
    const before = hp();
    const deck0 = deckSum(navy, g.ships[0]);
    const day = navy.day(runner.game.ticks());
    dailySeaRegion(navy, SR.central, day, tick);
    const after = hp();
    expect(g.portStrike).toBe(0);
    expect(after.every((h, k) => h < before[k])).toBe(true);
    // Half focused: the first battleship (the tie's smaller id) took more.
    expect(before[0] - after[0]).toBeGreaterThan(before[1] - after[1]);
    // Rome's anti-air (none) and two battleships' (2 × 8 × 0.5): 8 planes.
    expect(deck0 - deckSum(navy, g.ships[0])).toBe(8);
    // Once: the next day of the region does nothing more.
    dailySeaRegion(navy, SR.central, day + 1, tick);
    expect(hp()).toEqual(after);
  });
});
