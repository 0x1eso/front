// World War 1936 P4 Task 7 (lane A1): the land war under enemy air
// superiority (spec §14.6) on ww1936sea. Germany and Poland are humans at
// war; German fighters alone over the East give Germany all of its sky.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  airGroundPenaltyBp,
  airPenaltyBp,
  zoneAirMoveFactorPm,
  zoneAirPenaltyBp,
} from "@openfront/engine-lib/ww1936/AirRules";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { GRAND_DOCTRINE_STATS } from "@openfront/engine-lib/ww1936/DoctrineRules";
import {
  battleMods,
  joinBattle,
  modInputOf,
} from "@openfront/engine/ww1936/land/Battles";
import { WwAirView } from "../../src/client/view/WwAirView";
import { REGION, SEA, SR, TAG_ID } from "./seaFixture";
import {
  clearLand,
  clearStartSetup,
  grantDoctrineStats,
  HUMAN,
  placeArmy,
  stepTo,
  warAfterPrep,
  withTestPolitics,
  WwHuman,
  wwRunnerCapture,
} from "./util";
import { giveWing } from "./wingUtil";

withTestPolitics();

const DEU_POL: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];
const WARSAW = 6;

/**
 * Germany at war with Poland, German fighters alone over the East for a
 * day; `support`: Germany has battlefield support (supPenaltyPp 5).
 */
async function germanSky(support = false) {
  const { runner, updates } = await wwRunnerCapture({}, DEU_POL, SEA.map);
  const g = runner.game;
  const ww = g.worldWar()!;
  const [deu, pol] = [TAG_ID.DEU, TAG_ID.POL];
  for (const id of [deu, pol]) {
    clearStartSetup(ww.economy, ww.economy.country(id)!);
  }
  warAfterPrep(runner, HUMAN, "POL");
  const day = ww.day(g.ticks()) + 1;
  stepTo(runner, dayStartTick(day, ww.prepEndTick()));
  clearLand(g);
  for (const id of [deu, pol]) {
    const ce = ww.economy.country(id)!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
    ce.manpower += 1_000_000;
    for (let gen = 1; gen <= EQUIPMENT_GENS.fighter; gen++) {
      ce.stock[equipKey("fighter", gen)] = 0;
    }
  }
  ww.economy.country(deu)!.stock[equipKey("fighter", 1)] = 200;
  if (support) {
    // P6 plan decision 25: the doctrine's stat key (battlefield_support_1
    // is retired and adds nothing).
    ww.economy.country(deu)!.addTech("battlefield_support_1");
    expect(ww.economy.country(deu)!.stats.supPenaltyPp).toBe(0);
    grantDoctrineStats(ww, deu, GRAND_DOCTRINE_STATS.gd_battlefield_support[0]);
    expect(ww.economy.country(deu)!.stats.supPenaltyPp).toBe(5);
  }
  // A fighter wing of 200 on station over the East (Berlin's base).
  giveWing(ww.air, {
    owner: deu,
    type: "fighter",
    planes: 200,
    base: REGION.berlin,
    sr: SR.eastLand,
    target: WARSAW,
    mission: "air_superiority",
    flying: true,
    until: g.ticks() + 100_000,
  });
  stepTo(
    runner,
    dayStartTick(day, ww.prepEndTick()) +
      (ww.scenario.srIdxOf(SR.eastLand) % 7) +
      1,
  );
  const side = { deu: ww.land.sideOf(deu), pol: ww.land.sideOf(pol) };
  expect(ww.air.airSup(side.deu, SR.eastLand)).toBe(1000);
  expect(ww.scenario.regionSr(WARSAW)).toBe(SR.eastLand);
  return { runner, updates, g, ww, side };
}

describe("the land war under enemy air superiority (spec §14.6)", () => {
  it("enemy superiority above 50% cuts attack and defense up to 20%", async () => {
    const { g, ww, side } = await germanSky();
    const hooks = ww.land.hooks;
    expect(hooks.airPenaltyBp(WARSAW, side.pol, 0)).toBe(-2000);
    // A division with an anti-air battalion (air attack 20) cuts it by 30%.
    expect(hooks.airPenaltyBp(WARSAW, side.pol, 20)).toBe(-1400);
    expect(airPenaltyBp(1000, 20)).toBe(-1400);
    // Germany's own divisions fight under no enemy sky.
    expect(hooks.airPenaltyBp(WARSAW, side.deu, 0)).toBe(0);
    // A battle: the Polish defenders' line shows the air cut.
    const l = ww.land;
    const pl = l.country(TAG_ID.POL)!;
    const aaTpl = pl.nextTemplateId++;
    pl.templates.push({
      id: aaTpl,
      key: "",
      def: {
        name: "6-AA",
        battalions: [...new Array<"infantry">(6).fill("infantry"), "anti_air"],
        support: [],
      },
    });
    const a = placeArmy(g, "DEU", REGION.berlin, 1);
    const plain = placeArmy(g, "POL", WARSAW, 1);
    const withAa = placeArmy(g, "POL", WARSAW, 1, aaTpl);
    for (const id of a.divisions) joinBattle(l, id, WARSAW);
    const b = l.battles.get(WARSAW)!;
    const rowP = l.divisions.rowOf(plain.divisions[0]);
    const rowA = l.divisions.rowOf(withAa.divisions[0]);
    expect(l.baseStatsOf(rowA).airAtk).toBe(20);
    expect(modInputOf(l, rowP, WARSAW, false).airBp).toBe(-2000);
    expect(modInputOf(l, rowA, WARSAW, false).airBp).toBe(-1400);
    const lines = battleMods(l, b, rowP);
    expect(lines.defenseLines).toContainEqual({ id: "air", bp: -2000 });
    expect(lines.attackLines).toContainEqual({ id: "air", bp: -2000 });
    const rowG = l.divisions.rowOf(a.divisions[0]);
    expect(modInputOf(l, rowG, WARSAW, true).airBp).toBe(0);
  }, 60_000);

  it("supply loses up to a quarter under a fully enemy sky (ww84)", async () => {
    const { ww, side } = await germanSky();
    const hooks = ww.land.hooks;
    expect(hooks.airSupplyFactorPm(WARSAW, side.pol)).toBe(750);
    expect(hooks.airSupplyFactorPm(WARSAW, side.deu)).toBe(1000);
    expect(hooks.airSupplyFactorPm(REGION.paris, side.pol)).toBe(1000);
  }, 60_000);

  it("movement slows up to 50%", async () => {
    const { ww, side } = await germanSky();
    const hooks = ww.land.hooks;
    expect(hooks.airMoveFactorPm(WARSAW, side.pol)).toBe(500);
    expect(hooks.airMoveFactorPm(WARSAW, side.deu)).toBe(1000);
    // The West's sky is nobody's.
    expect(hooks.airMoveFactorPm(REGION.paris, side.pol)).toBe(1000);
  }, 60_000);

  it("battlefield support adds 5 points after the anti-air cut, up to 20%", () => {
    expect(airGroundPenaltyBp(1000, 0, 0)).toBe(-2000);
    expect(airGroundPenaltyBp(1000, 5, 0)).toBe(-2000);
    expect(airGroundPenaltyBp(600, 5, 0)).toBe(-1200);
    // Anti-air 20 cuts the superiority part 30% (−1400); the 5 points come
    // on top (A1 review ruling: spec §14.6 lists the bonus as its own row).
    expect(airGroundPenaltyBp(1000, 5, 20)).toBe(-1900);
    expect(airGroundPenaltyBp(1000, 0, 20)).toBe(-1400);
    // The cap holds whatever the bonus.
    expect(airGroundPenaltyBp(1000, 50, 20)).toBe(-2000);
    // No enemy superiority, no bonus.
    expect(airGroundPenaltyBp(500, 5, 0)).toBe(0);
  });

  it("the battle card's cut from the air view is the engine's (battlefield support)", async () => {
    const { updates, ww, side } = await germanSky(true);
    const hooks = ww.land.hooks;
    // The engine fights at the −20% cap (the doctrine's 5 points don't pass
    // it); anti-air 20 cuts it to −14%, the 5 points stay (−19%).
    expect(hooks.airPenaltyBp(WARSAW, side.pol, 0)).toBe(-2000);
    expect(hooks.airPenaltyBp(WARSAW, side.pol, 20)).toBe(-1900);
    // The client merges the same updates and runs the engine-lib rule.
    const view = new WwAirView(ww.scenario, () => TAG_ID.POL);
    for (const u of updates) {
      for (const x of u.updates[GameUpdateType.WwAir] ?? []) view.apply(x.data);
    }
    const zone = view.zones.get(SR.eastLand);
    expect(zone?.enemySky).toContainEqual({
      side: side.pol,
      enemySupPm: 1000,
      bonusPp: 5,
    });
    for (const s of [side.pol, side.deu]) {
      for (const aa of [0, 10, 20, 100]) {
        expect(zoneAirPenaltyBp(zone, s, aa)).toBe(
          hooks.airPenaltyBp(WARSAW, s, aa),
        );
      }
      expect(zoneAirMoveFactorPm(zone, s)).toBe(
        hooks.airMoveFactorPm(WARSAW, s),
      );
    }
    // A zone with nobody overhead.
    const west = view.zones.get(SR.westLand);
    expect(zoneAirPenaltyBp(west, side.pol, 0)).toBe(
      hooks.airPenaltyBp(REGION.paris, side.pol, 0),
    );
  }, 60_000);
});
