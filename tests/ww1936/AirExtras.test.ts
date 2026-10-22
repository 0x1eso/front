// World War 1936 P6 (plan Task 8, lane W2): night bombing and air recon
// (spec §15.3, §15.4) on ww1936deep — Britain and Italy, both human, at
// war over the western land zone (London, Rome); the AI's night bombing
// and recon (spec §19.7) with Britain left to the AI.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  AirMission,
  AirType,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  DesignDef,
  DS_RADAR,
  DS_RECON,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { EQUIPMENT_GENS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  NIGHT_LOSS_BP,
  nightLossBp,
  RECON_CAMERA_X,
  RECON_PLAN_CUT_BP,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { zoneFlights } from "@openfront/engine/ww1936/air/AirCombat";
import type { Deployment } from "@openfront/engine/ww1936/air/WwAir";
import {
  aiSeaAirDay,
  isDepthDeployment,
} from "@openfront/engine/ww1936/depth/AiSeaAir";
import {
  airZoneDay,
  nightMods,
  reconCovers,
  reconPlanCutBp,
  reconToday,
} from "@openfront/engine/ww1936/depth/AirExtras";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { grantDoctrineStats, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const WEST = DEEP.sr.westLand;
const BOTH = [
  { clientID: "HUMANGBR", country: "GBR" as const },
  { clientID: "HUMANITA", country: "ITA" as const },
];

async function atWar(
  humans: { clientID: string; country: "GBR" | "ITA" }[] = BOTH,
): Promise<GameRunner> {
  const runner = await wwRunner({}, humans, DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 1);
  runner.game.worldWar()!.setWar(GBR, ITA, runner.game.ticks());
  return runner;
}

/** A deployment record of `planes` generation-1 planes (and design planes) waiting on base 0 over `sr`. */
function deploy(
  runner: GameRunner,
  owner: number,
  type: AirType,
  mission: AirMission,
  planes: number,
  dcounts: [number, number][] = [],
  sr: number = WEST,
): Deployment {
  const air = runner.game.worldWar()!.air;
  const counts = new Array<number>(EQUIPMENT_GENS[type]).fill(0);
  counts[0] = planes;
  const dep = air.addDeployment({
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
  for (const [slot, n] of dcounts) dep.dcounts[slot - 1] = n;
  return dep;
}

/** Plane design slot 1 of `id`: a small airframe with `module` in its special slot. */
function planeDesign(d: WwDepth, id: number, module: string): void {
  const def: DesignDef = {
    kind: "plane",
    base: "small_1",
    modules: ["w_mg2", "", "", module],
    name: "Test Plane",
  };
  d.country(id)!.des.plane[0] = {
    def: def as never,
    origin: "own",
    from: 0,
    fromSlot: 0,
    obsolete: false,
    savedDay: 0,
  };
  d.markDesign(id, "plane", 1);
}

function night(runner: GameRunner, who: number, dep: number, on: boolean) {
  const ww = runner.game.worldWar()!;
  return ww.depth.issue(
    who,
    { kind: "air_night", deployment: dep, on },
    runner.game.ticks(),
  );
}

describe("World War 1936 P6: night bombing (spec §15.3)", () => {
  it("night bombing halves losses and scores 60 percent", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const air = ww.air;
    const bombers = deploy(
      runner,
      GBR,
      "strat_bomber",
      "strategic_bombing",
      20,
    );
    // By day: P4's numbers.
    expect(nightMods(d, bombers.id)).toEqual({
      lossBp: 10_000,
      bombBp: 10_000,
    });
    expect(night(runner, GBR, bombers.id, true)).toBeNull();
    expect(bombers.night).toBe(true);
    expect(nightMods(d, bombers.id)).toEqual({ lossBp: 5_000, bombBp: 6_000 });
    // air_strategic_campaign's night bombing stat (×0.75 in all).
    grantDoctrineStats(ww, GBR, { nightBombBp: 1_500 });
    expect(nightMods(d, bombers.id).bombBp).toBe(7_500);
    // A record P4 adds to the group (another base) flies with it, and
    // takes the flag on the zone's day.
    const more = deploy(runner, GBR, "strat_bomber", "strategic_bombing", 5);
    expect(more.night).toBe(false);
    expect(nightMods(d, more.id).lossBp).toBe(NIGHT_LOSS_BP);
    airZoneDay(d, WEST, ww.day(runner.game.ticks()), runner.game.ticks());
    expect(more.night).toBe(true);
    // Refusals: not ours, not strategic bombing, no such deployment.
    const fighters = deploy(runner, GBR, "fighter", "air_superiority", 10);
    expect(night(runner, ITA, bombers.id, false)).toBe("not_controlled");
    expect(night(runner, GBR, fighters.id, true)).toBe("bad_air_mission");
    expect(night(runner, GBR, 99_999, true)).toBe("bad_index");
    expect(nightMods(d, fighters.id)).toEqual({
      lossBp: 10_000,
      bombBp: 10_000,
    });
    // Back by day: the whole group.
    expect(night(runner, GBR, more.id, false)).toBeNull();
    expect([bombers.night, more.night]).toEqual([false, false]);
    expect(nightMods(d, bombers.id).lossBp).toBe(10_000);
    // The flag is the deployment's snapshot field.
    expect(night(runner, GBR, bombers.id, true)).toBeNull();
    const snap = ww.snapshot();
    expect(snap.air!.deployments.find((x) => x.id === bombers.id)!.night).toBe(
      true,
    );
    expect(air.deployments.get(more.id)!.night).toBe(true);
    // The screens' deployment summary carries the flag (lane U4's toggle);
    // a day record keeps P4's shape.
    const view = air.takeData()!.deployments;
    expect(view.find((x) => x.id === bombers.id)!.night).toBe(true);
    expect("night" in view.find((x) => x.id === fighters.id)!).toBe(false);
  });

  it("a radar night fighter ignores the night halving", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    planeDesign(d, ITA, "m_radar");
    expect(d.designStatsOf(ITA, "plane", 1)!.flags & DS_RADAR).toBe(DS_RADAR);
    const bombers = deploy(
      runner,
      GBR,
      "strat_bomber",
      "strategic_bombing",
      20,
    );
    expect(night(runner, GBR, bombers.id, true)).toBeNull();
    const plain = deploy(runner, ITA, "fighter", "interception", 20);
    const mixed = deploy(runner, ITA, "fighter", "interception", 10, [[1, 10]]);
    const radar = deploy(runner, ITA, "fighter", "interception", 0, [[1, 12]]);
    // No shooter named: the halving.
    expect(nightMods(d, bombers.id).lossBp).toBe(5_000);
    expect(nightMods(d, bombers.id, [plain.id]).lossBp).toBe(5_000);
    // Half of the shooters are radar night fighters: their half is whole.
    expect(nightMods(d, bombers.id, [mixed.id]).lossBp).toBe(7_500);
    expect(nightMods(d, bombers.id, [radar.id]).lossBp).toBe(10_000);
    expect(nightMods(d, bombers.id, [plain.id, radar.id]).lossBp).toBe(
      nightLossBp(12, 32),
    );
    expect(nightLossBp(12, 32)).toBe(
      Math.floor((5_000 * 20 + 10_000 * 12) / 32),
    );
    // The bomb points stay at 60%.
    expect(nightMods(d, bombers.id, [radar.id]).bombBp).toBe(6_000);
    // A day bomber takes P4's losses from anyone.
    const day = deploy(runner, GBR, "bomber", "strategic_bombing", 10);
    expect(nightMods(d, day.id, [radar.id]).lossBp).toBe(10_000);
  });
});

describe("World War 1936 P6: air recon (spec §15.4)", () => {
  it("recon raises army intel and cuts enemy planning", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const air = ww.air;
    const land = ww.land;
    const tick = runner.game.ticks();
    const day = ww.day(tick);
    // Our sky: the recon sorties fly at their full rate.
    air.setAirSup(WEST, new Map([[land.sideOf(GBR), 1_000]]));
    const recon = deploy(runner, GBR, "fighter", "recon", 100);
    airZoneDay(d, WEST, day, tick);
    const flight = zoneFlights(air, WEST).find((f) => f.id === recon.id)!;
    const sorties = Math.floor(flight.total / 1000);
    expect(sorties).toBeGreaterThanOrEqual(20);
    expect(reconToday(d, GBR, WEST)).toBe(sorties);
    expect(reconToday(d, land.sideOf(GBR), WEST)).toBe(sorties);
    expect(reconToday(d, ITA, WEST)).toBe(0);
    expect(d.sea.reconBySide).toEqual([[land.sideOf(GBR), WEST, sorties]]);
    // Spec §8.8: army intel on the countries holding ground in the zone
    // (lane I's level reads reconCovers; its body is a stub here).
    expect(reconCovers(d, GBR, ITA)).toBe(true);
    expect(reconCovers(d, ITA, GBR)).toBe(false);
    expect(reconCovers(d, GBR, DEEP.tag.SUN)).toBe(false);
    // The enemy's readiness bonus in the zone's battles, −5 pp (both ways
    // through the land hook: Italy's cut, Britain's none).
    expect(reconPlanCutBp(d, ITA, DEEP.region.rome)).toBe(RECON_PLAN_CUT_BP);
    expect(d.planCutBp(ITA, DEEP.region.rome)).toBe(-500);
    expect(reconPlanCutBp(d, GBR, DEEP.region.london)).toBe(0);
    expect(reconPlanCutBp(d, ITA, DEEP.region.kiev)).toBe(0);
    // State (pre-flight §0-8): in the depth snapshot.
    expect(ww.snapshot().depth!.sea.reconBySide).toEqual([
      [land.sideOf(GBR), WEST, sorties],
    ]);
    // A recon camera design flies twice over; reconPct adds on top.
    planeDesign(d, GBR, "m_recon_camera");
    expect(d.designStatsOf(GBR, "plane", 1)!.flags & DS_RECON).toBe(DS_RECON);
    recon.dcounts[0] = 10;
    grantDoctrineStats(ww, GBR, { reconPct: 50 });
    airZoneDay(d, WEST, day + 1, tick);
    const eff = Math.floor(flight.total / 100);
    const milli = flight.total + 10 * eff * RECON_CAMERA_X;
    expect(reconToday(d, GBR, WEST)).toBe(
      Math.floor(Math.floor((milli * 150) / 100) / 1000),
    );
    // Too few sorties: no cover, no cut.
    recon.counts[0] = 10;
    recon.dcounts[0] = 0;
    airZoneDay(d, WEST, day + 2, tick);
    expect(reconToday(d, GBR, WEST)).toBeLessThan(20);
    expect(reconCovers(d, GBR, ITA)).toBe(false);
    expect(reconPlanCutBp(d, ITA, DEEP.region.rome)).toBe(0);
    // Gone: the zone's entry goes.
    recon.counts[0] = 0;
    airZoneDay(d, WEST, day + 3, tick);
    expect(d.sea.reconBySide).toEqual([]);
  });
});

describe("World War 1936 P6: the AI's night bombing and recon (spec §19.7)", () => {
  it("Britain bombs by night from September 1940 or under an enemy sky; recon lands at peace", async () => {
    const runner = await atWar([{ clientID: "HUMANITA", country: "ITA" }]);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const air = ww.air;
    const start = ww.day(runner.game.ticks());
    const bombers = deploy(
      runner,
      GBR,
      "strat_bomber",
      "strategic_bombing",
      20,
    );
    // Day 1 of the war, a free sky: by day. (Days not ≡ −GBR mod 5: no recon step.)
    const quiet = (x: number) => ((x + GBR) % 5 === 0 ? x + 1 : x);
    aiSeaAirDay(d, GBR, quiet(start));
    expect(bombers.night).toBe(false);
    // An enemy sky over the zone: by night; a clear one: by day again.
    const idx = ww.scenario.srIdxOf(WEST);
    air.zoneState[idx].enemySup = new Map([[ww.land.sideOf(GBR), 600]]);
    aiSeaAirDay(d, GBR, quiet(start + 1));
    expect(bombers.night).toBe(true);
    air.zoneState[idx].enemySup = new Map([[ww.land.sideOf(GBR), 400]]);
    aiSeaAirDay(d, GBR, quiet(start + 2));
    expect(bombers.night).toBe(true);
    air.zoneState[idx].enemySup = new Map();
    aiSeaAirDay(d, GBR, quiet(start + 3));
    expect(bombers.night).toBe(false);
    // From September 1940 Britain bombs by night whatever the sky.
    aiSeaAirDay(d, GBR, quiet(dayOfDate("1940-09-01")));
    expect(bombers.night).toBe(true);
    // Recon: a group the AI flies lands when the war is over.
    const recon = deploy(runner, GBR, "fighter", "recon", 24);
    expect(isDepthDeployment(recon)).toBe(true);
    expect(isDepthDeployment(bombers)).toBe(false);
    expect(ww.endWar(GBR, ITA)).toBe(true);
    expect(ww.hasWar(GBR)).toBe(false);
    let day = start + 10;
    while (day % 10 !== GBR % 10) day++;
    aiSeaAirDay(d, GBR, day);
    expect(
      air.deploymentsOf(GBR).some((x) => x.mission === recon.mission),
    ).toBe(false);
  });
});
