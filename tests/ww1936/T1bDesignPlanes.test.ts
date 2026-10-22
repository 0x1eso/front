// World War 1936 P6 T1b (navy/air half): plane designs in P4's air war,
// end to end (lane E's T1b sites 1–4; spec §5.4) on ww1936deep — a human
// Britain at war with a human Italy. A plane design line fills the stock,
// a deployment draws it, it flies with the design's numbers, its losses
// come off the design ledger (with the design's reliability), and a recall
// puts the rest back; a carrier deck carries designs the same way.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  CARRIER_AIR_TYPES,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { PlaneDesignStats } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { detectionPm } from "@openfront/engine-lib/ww1936/AirRules";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  planeType,
  recommendedPlane,
  reliabilityLossBp,
} from "@openfront/engine-lib/ww1936/DesignRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  airDuelMilli,
  dailyAirZone,
  zoneFlights,
} from "@openfront/engine/ww1936/air/AirCombat";
import { radarPmAt } from "@openfront/engine/ww1936/air/AirSuperiority";
import { dailyAirCountry } from "@openfront/engine/ww1936/air/Deploy";
import { deploymentPlanes } from "@openfront/engine/ww1936/air/WwAir";
import {
  designPlaneP4,
  planesLossBp,
} from "@openfront/engine/ww1936/depth/Designs";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import { fillDecks } from "@openfront/engine/ww1936/navy/Carriers";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { clearStartSetup, gameHash, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const WEST = DEEP.sr.westLand;
const FIGHTER = AIR_TYPES.indexOf("fighter");
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
function saveFighter(ww: WorldWar, runner: GameRunner): PlaneDesignStats {
  const d = ww.depth;
  ww.air.country(GBR)!.airXpMilli = 400_000;
  const def = {
    ...recommendedPlane("small_1", new Set(WW_TECH_IDS)),
    name: "Spit",
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
  it("a design line fills the stock, a deployment draws it, it flies and its losses come off the design", async () => {
    const { runner, ww } = await atWar();
    const air = ww.air;
    const ce = ww.economy.country(GBR)!;
    const st = saveFighter(ww, runner);
    // ① The plane design line fills the stock.
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "plane_design", 1, 5)).toBeNull();
    const perDay = dayStartTick(1, 0) - dayStartTick(0, 0);
    step(runner, 60 * perDay);
    const built = ce.stock[KEY];
    expect(built).toBeGreaterThan(0);
    // Topped up for a fuller wing (the test does not wait a year).
    ce.stock[KEY] += 120;
    // ② A deployment draws the design planes (no static fighter left).
    noStaticFighters(ww, GBR);
    for (const d of air.deploymentsOf(GBR)) air.removeDeployment(d.id, true);
    const have = ce.stock[KEY];
    const deployed0 = ce.planesDeployed[KEY];
    expect(
      air.issue(
        GBR,
        {
          kind: "air_deploy",
          sr: WEST,
          type: "fighter",
          mission: "air_superiority",
          count: have,
        },
        runner.game.ticks(),
      ),
    ).toBeNull();
    const recs = air
      .deploymentsIn(WEST)
      .map((id) => air.deployments.get(id)!)
      .filter((d) => d.owner === GBR && d.type === FIGHTER);
    const out = recs.reduce((n, d) => n + d.dcounts[0], 0);
    expect(out).toBe(have);
    expect(recs.every((d) => d.counts.every((c) => c === 0))).toBe(true);
    expect(ce.stock[KEY]).toBe(0);
    expect(ce.planesDeployed[KEY]).toBe(deployed0 + have);
    // The base's room counts them; the screens see them.
    const rec = recs[0];
    expect(air.baseUse(rec.base)).toBeGreaterThanOrEqual(rec.dcounts[0]);
    const view = air.takeData()!;
    expect(view.deployments.find((x) => x.id === rec.id)!.dcounts?.[0]).toBe(
      rec.dcounts[0],
    );
    // ③ It flies with the design's numbers (after the generations).
    const ita = air.addDeployment({
      owner: ITA,
      sr: WEST,
      type: FIGHTER,
      mission: AIR_MISSIONS.indexOf("air_superiority"),
      counts: [150, 0, 0],
      target: 150,
      base: 0,
      lossRest: 0,
      auto: false,
      volunteerFor: 0,
    });
    // Only these two over the zone (the AI's own wings would share the duel).
    for (const id of [...air.deploymentsIn(WEST)]) {
      const x = air.deployments.get(id)!;
      if (x.id !== ita.id && x.owner !== GBR) air.removeDeployment(id, true);
    }
    const h0 = gameHash(runner);
    const start = deploymentPlanes(rec);
    const day = ww.day(runner.game.ticks());
    dailyAirZone(air, WEST, day);
    const f = zoneFlights(air, WEST).find((x) => x.id === rec.id)!;
    const gens = EQUIPMENT_GENS.fighter;
    expect(f.counts.length).toBe(gens + 16);
    expect(f.counts[gens]).toBe(start);
    expect(f.milli.slice(0, gens)).toEqual([0, 0, 0]);
    expect(f.milli[gens]).toBeGreaterThan(0);
    expect(f.stats[gens]).toEqual(designPlaneP4(ww.depth, GBR, 1, "fighter"));
    expect(f.total).toBe(f.milli[gens]);
    // ④ Its losses: Italy's fighters' duel × the design's reliability,
    // whole planes off the design slot and the design ledger.
    const i = zoneFlights(air, WEST).find((x) => x.id === ita.id)!;
    const side = ww.land.sideOf(ITA);
    const s = ww.scenario.sr(WEST)!;
    const own = s.members.some(
      (r) => ww.land.sideOf(ww.land.controller[r] ?? 0) === side,
    );
    const det = detectionPm(
      radarPmAt(air, side, WEST),
      own,
      ww.economy.country(ITA)!.stats.airDetectPct,
      0,
    );
    // Britain's records split the duel by their sorties; this one alone
    // flies here unless the stock found more bases.
    const mine = zoneFlights(air, WEST).filter((x) => x.owner === GBR);
    const defenders = mine.map((x) => ({
      stats: x.stats[gens],
      milli: x.milli[gens],
      weight: 200,
    }));
    const duel = airDuelMilli(
      [{ stats: i.stats[0], milli: i.milli[0], weight: 1 }],
      defenders,
      det,
    );
    expect(duel).toBeGreaterThan(1000);
    const rel = reliabilityLossBp(st.relPm);
    expect(planesLossBp(ww.depth, GBR, [0, 0, 0], rec.dcounts)).toBe(rel);
    let lost = 0;
    for (const x of recs) lost += x.dcounts[0];
    lost = have - lost;
    expect(mine.length).toBe(1);
    // P4's loss cut (the techs given), then the design's reliability.
    const cut = Math.min(100, ce.stats.airLossCutPct);
    const expected = Math.floor(
      (Math.floor((duel * (100 - cut)) / 100) * rel) / 10_000,
    );
    expect(lost * 1000 + rec.lossRest).toBe(expected);
    // Off the ledger, never back into the stock.
    expect(ce.planesDeployed[KEY]).toBe(deployed0 + have - lost);
    expect(ce.stock[KEY]).toBe(0);
    // The design planes are in the game's hash.
    expect(gameHash(runner)).not.toBe(h0);
    // ⑤ The country's day refills the group from the design stock.
    ce.stock[KEY] = lost;
    dailyAirCountry(air, GBR, day);
    expect(recs.reduce((n, x) => n + x.dcounts[0], 0)).toBe(have);
    expect(ce.stock[KEY]).toBe(0);
    expect(ce.planesDeployed[KEY]).toBe(deployed0 + have);
    // ⑥ A recall puts them back into the stock.
    expect(
      air.issue(
        GBR,
        { kind: "air_recall", sr: WEST, type: "fighter" },
        runner.game.ticks(),
      ),
    ).toBeNull();
    expect(ce.stock[KEY]).toBe(have);
    expect(ce.planesDeployed[KEY]).toBe(deployed0);
  }, 120_000);

  it("a carrier's deck takes design planes, launches them and loses them with the ship", async () => {
    const { runner, ww } = await atWar();
    const d = ww.depth;
    const navy = ww.navy;
    const ce = ww.economy.country(GBR)!;
    ww.air.country(GBR)!.airXpMilli = 400_000;
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
