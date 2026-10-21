// World War 1936 P4 (plan Task 3, lane N1): naval supremacy (spec §8.5)
// on ww1936sea: Britain against Italy, both human, in the Central Waters.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { supremacyPm } from "@openfront/engine-lib/ww1936/NavalRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { supremacyRegion } from "@openfront/engine/ww1936/navy/Supremacy";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import { HUMAN, step, stepTo, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const HUMANS = [
  { clientID: HUMAN, country: "GBR" as const },
  { clientID: "HUMAN002", country: "ITA" as const },
];
const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;

async function atWar(): Promise<GameRunner> {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  stepTo(runner, WW_PREP_TICKS + 1);
  runner.game.worldWar()!.setWar(GBR, ITA, runner.game.ticks());
  return runner;
}

const navyOf = (r: GameRunner) => r.game.worldWar()!.navy;

function issue(runner: GameRunner, who: number, o: WwOrder) {
  return navyOf(runner).issue(who, o, runner.game.ticks());
}

function mission(
  runner: GameRunner,
  owner: number,
  port: number,
  comp: Parameters<ReturnType<typeof navyOf>["createFleet"]>[2],
  m: "patrol" | "strike" | "raid" | "hold",
): number {
  const id = navyOf(runner).createFleet(owner, port, comp);
  expect(
    issue(runner, owner, {
      kind: "fleet_mission",
      fleet: id,
      mission: m,
      sr: SR.central,
    }),
  ).toBeNull();
  return id;
}

describe("naval supremacy (spec §8.5)", () => {
  it("supremacy splits by weight × HP × mission", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const gbr = navy.sideOf(GBR);
    const ita = navy.sideOf(ITA);
    // Britain: 4 destroyers (weight 2 each), Italy: 2 battleships (10 each), both on patrol.
    const dd = mission(runner, GBR, REGION.malta, [["dd", 1, 4]], "patrol");
    mission(runner, ITA, REGION.rome, [["bb", 1, 2]], "patrol");
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(gbr, SR.central)).toBe(285); // 8000 × 1000 / 28000
    expect(navy.supremacy(ita, SR.central)).toBe(714);
    expect(supremacyPm(8000, 20000)).toBe(285);
    // A destroyer at half HP weighs half: 7000 against 20000.
    const t = navy.ships;
    const r = t.rowOf(navy.fleets.get(dd)!.ships[0]);
    t.hp[r] = Math.floor(navy.shipStatsOf(r).hpMilli / 2);
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(gbr, SR.central)).toBe(supremacyPm(7000, 20000));
    // The region's day stores it in side order.
    const st = navy.srState[navy.scenario.srIdxOf(SR.central)];
    expect([...st.sup.keys()]).toEqual([gbr, ita].sort((a, b) => a - b));
  });

  it("a raid counts 250‰, a fleet on its way 250‰", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    mission(runner, GBR, REGION.malta, [["dd", 1, 4]], "raid");
    mission(runner, ITA, REGION.rome, [["bb", 1, 2]], "patrol");
    supremacyRegion(navy, SR.central);
    // 8000 × 250‰ = 2000 against 20000.
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBe(
      supremacyPm(2000, 20000),
    );
    // Italy's battleships sail out of the region: moving through it they count 250‰.
    const itaFleet = navy.fleetsOf(ITA)[0];
    expect(
      issue(runner, ITA, {
        kind: "fleet_move",
        fleet: itaFleet.id,
        zone: ZONE.east,
      }),
    ).toBeNull();
    step(runner);
    expect(navy.scenario.zoneSr(itaFleet.zone)).toBe(SR.central);
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(navy.sideOf(ITA), SR.central)).toBe(
      supremacyPm(5000, 2000),
    );
  });

  it("a docked strike force counts at 500‰", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    // Malta's harbor zone is in the Central Waters.
    const sf = mission(runner, GBR, REGION.malta, [["dd", 1, 4]], "strike");
    expect(navy.fleets.get(sf)!.docked).toBe(REGION.malta);
    mission(runner, ITA, REGION.rome, [["bb", 1, 2]], "patrol");
    supremacyRegion(navy, SR.central);
    // 8000 × 500‰ = 4000 against 20000.
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBe(166);
    // A fleet holding in port counts nothing.
    mission(runner, GBR, REGION.malta, [["bb", 1, 4]], "hold");
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBe(166);
  });

  it("no power → 0", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBe(0);
    expect(navy.srState[navy.scenario.srIdxOf(SR.central)].sup.size).toBe(0);
    // Alone at sea (no enemy power): all of it.
    mission(runner, GBR, REGION.malta, [["dd", 1, 1]], "patrol");
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBe(1000);
    expect(navy.supremacy(navy.sideOf(ITA), SR.central)).toBe(0);
  });

  it("only enemies count against a side", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    stepTo(runner, WW_PREP_TICKS + 1);
    const navy = navyOf(runner);
    mission(runner, GBR, REGION.malta, [["dd", 1, 4]], "patrol");
    mission(runner, ITA, REGION.rome, [["bb", 1, 2]], "patrol");
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBe(1000);
    expect(navy.supremacy(navy.sideOf(ITA), SR.central)).toBe(1000);
  });

  it("planes add 0.1 per naval strike plane", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const ww = runner.game.worldWar()!;
    mission(runner, ITA, REGION.rome, [["bb", 1, 2]], "patrol");
    const z = ww.air.zoneState[navy.scenario.srIdxOf(SR.central)];
    // A1's milli-sorties of yesterday: 10 naval strike planes = 1 weight.
    z.navalStrike.set(GBR, 10_000);
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBe(
      supremacyPm(1000, 20000),
    );
    // + 10 on naval patrol (0.1 each) + 20 superiority fighters (0.05 each).
    z.navalAsw.set(GBR, 10_000);
    z.fightersSup.set(GBR, 20_000);
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBe(
      supremacyPm(3000, 20000),
    );
  });

  it("the fuel ratio cuts a fleet's weight (spec §15.4)", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    mission(runner, GBR, REGION.malta, [["dd", 1, 4]], "patrol");
    mission(runner, ITA, REGION.rome, [["bb", 1, 2]], "patrol");
    runner.game.worldWar()!.economy.country(ITA)!.fuelRatioPm = 400;
    supremacyRegion(navy, SR.central);
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBe(
      supremacyPm(8000, 8000),
    );
  });
});
