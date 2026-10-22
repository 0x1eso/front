// World War 1936 P6 lane S (plan Task 6 Step 6, spec §10): raids on
// ww1936deep. Germany (human) raids France (human, its atomic project in
// Lyon) with paratroopers from Berlin's air base; Britain (human) bombs
// the Möhne dam in Munich. The raid's uid is picked so the seeded roll
// (wwRoll(seed, P_RAID, uid)) succeeds or fails whatever the odds (they
// are clamped to 50–950‰); the common day's step is called directly.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  DAMS,
  SPECIAL_PROJECTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_IDS,
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { P_RAID } from "@openfront/engine-lib/ww1936/DepthRules";
import {
  raidBlock,
  raidPrepDays,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import type { Game } from "@openfront/engine/game/Game";
import { processRaids } from "@openfront/engine/ww1936/depth/Raids";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import { drawPlanes } from "@openfront/engine/ww1936/economy/Buildings";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP, findRoll } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  byTag,
  clearLand,
  HUMAN,
  placeArmy,
  warAfterPrep,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

/** Pre-flight §0-11: `regions` in P5's group korea_north (the engine's no-strike set). */
function withNoStrike(regions: number[]): void {
  const base = depthFixture();
  usePoliticsContent(
    depthFixture({
      groups: [
        ...base.groups,
        { id: "korea_north", regions, owner1936: "FRA" },
      ],
    }),
  );
}

const BERLIN = DEEP.region.berlin;
const LYON = DEEP.region.lyon;
const MUNICH = DEEP.region.munich;
const ATOMIC = SPECIAL_PROJECTS.indexOf("sp_atomic");

function stockUp(g: Game, tag: "DEU" | "GBR"): void {
  const ce = g.worldWar()!.economy.country(byTag(g, tag).smallID())!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** The next raid's uid made to succeed (true) or fail (false) whatever its odds. */
function rigNextRaid(d: WwDepth, succeed: boolean): void {
  const from = d.nextUid;
  d.nextUid = findRoll(
    d.ww.politics.seed,
    P_RAID,
    (n, roll) =>
      n >= from &&
      (succeed ? roll % 1_000_000 < 50_000 : roll % 1_000_000 >= 950_000),
  );
}

/** Germany at war with France; France's atomic project in Lyon at 50%; two German paratrooper divisions in Berlin. */
async function paraRaid() {
  const runner = await wwRunner(
    {},
    [
      { clientID: HUMAN, country: "DEU" },
      { clientID: "HUMAN002", country: "FRA" },
    ],
    DEEP.map,
  );
  warAfterPrep(runner, HUMAN, "FRA");
  const g = runner.game;
  const ww = g.worldWar()!;
  const d = ww.depth;
  const deu = DEEP.tag.DEU;
  const fra = DEEP.tag.FRA;
  expect(ww.land.isEnemy(deu, fra)).toBe(true);
  ww.economy.country(fra)!.addTech("nuclear_physics");
  ww.economy.buildingArray("facility_nuclear")[LYON] = 1;
  d.onFacilityBuilt(LYON);
  expect(
    d.issue(
      fra,
      { kind: "project_start", project: "sp_atomic", facility: LYON },
      1,
    ),
  ).toBe(null);
  const run = d.country(fra)!.proj.running[0];
  run.progressMilli = 500_000;
  clearLand(g);
  stockUp(g, "DEU");
  const ce = ww.economy.country(deu)!;
  ce.addTech("paratroopers");
  const cl = ww.land.country(deu)!;
  const tpl = cl.nextTemplateId++;
  cl.templates.push({
    id: tpl,
    key: "",
    def: {
      name: "Fallschirmjäger",
      battalions: Array(6).fill("paratrooper"),
      support: [],
    },
  });
  const army = placeArmy(g, "DEU", BERLIN, 2, tpl);
  return { runner, g, ww, d, deu, fra, run, army, div: army.divisions[0] };
}

describe("World War 1936 P6: raids (spec §10)", () => {
  it("the raid judge: no-strike first, two at once, a facility needs close intelligence", () => {
    const ok = {
      kind: "raid_para" as const,
      unitOk: true,
      targetOk: true,
      reachOk: true,
      running: 0,
      intelClose: true,
      facilityTarget: true,
      noStrike: false,
    };
    expect(raidBlock(ok)).toBe(null);
    expect(raidBlock({ ...ok, noStrike: true, unitOk: false })).toBe(
      "no_strike_region",
    );
    expect(raidBlock({ ...ok, running: 2 })).toBe("raid_conditions");
    expect(raidBlock({ ...ok, intelClose: false })).toBe("raid_conditions");
    expect(raidBlock({ ...ok, intelClose: false, facilityTarget: false })).toBe(
      null,
    );
    expect(raidBlock({ ...ok, reachOk: false })).toBe("raid_conditions");
    expect(raidPrepDays("raid_para", false)).toBe(20);
    expect(raidPrepDays("raid_para", true)).toBe(15);
    expect(raidPrepDays("raid_commando", false)).toBe(15);
    expect(raidPrepDays("raid_bomb", false)).toBe(7);
  });

  it("a paradrop raid on a facility cuts its project by 15 percent", async () => {
    const { g, ww, d, deu, fra, run, army, div } = await paraRaid();
    const sc = ww.scenario;
    // Berlin's air base, the transports' range to Lyon.
    expect(sc.kmBetween(sc.centerTile(BERLIN), sc.centerTile(LYON))).toBe(294);
    expect(
      ww.air.planeStatsOf(deu, "transport_plane", 1).rangeKm,
    ).toBeGreaterThanOrEqual(294);
    const raid = {
      kind: "raid" as const,
      raid: "raid_para" as const,
      unit: div,
      target: LYON,
      building: "facility_nuclear" as const,
    };
    // Where the facility is, Germany's civil intelligence must see.
    const at = (deu * d.cap + fra) * 4;
    d.intelLevels[at] = 49;
    expect(d.issue(deu, raid, g.ticks())).toBe("raid_conditions");
    d.intelLevels[at] = 50;
    // Not a building the paratroopers may hit; not a building Lyon has.
    expect(d.issue(deu, { ...raid, building: "mil" }, g.ticks())).toBe(
      "raid_conditions",
    );
    expect(d.issue(deu, { ...raid, building: "radar" }, g.ticks())).toBe(
      "raid_conditions",
    );
    rigNextRaid(d, true);
    const uid = d.nextUid;
    const day = ww.day(g.ticks());
    expect(d.issue(deu, raid, g.ticks())).toBe(null);
    expect(d.raids).toEqual([
      {
        uid,
        owner: deu,
        kind: 0,
        unit: div,
        target: LYON,
        building: expect.any(Number),
        readyDay: day + 20,
      },
    ]);
    // It left its army for an idle one of its own.
    const t = ww.land.divisions;
    const own = ww.land.armies.get(t.army[t.rowOf(div)])!;
    expect(own.id).not.toBe(army.id);
    expect(own.divisions).toEqual([div]);
    expect(own.order.kind).toBe("idle");
    expect(army.divisions).toHaveLength(1);
    // The same division cannot go twice.
    expect(d.issue(deu, raid, g.ticks())).toBe("raid_conditions");
    const men = t.men[t.rowOf(div)];
    const msg = vi.spyOn(d, "message");
    processRaids(d, day + 19, g.ticks());
    expect(d.raids).toHaveLength(1);
    processRaids(d, day + 20, g.ticks());
    expect(d.raids).toEqual([]);
    // France's project loses 15%; the raiders 20% of their strength.
    expect(run.progressMilli).toBe(350_000);
    expect(run.project).toBe(ATOMIC);
    expect(
      Math.abs(t.men[t.rowOf(div)] - Math.round(men * 0.8)),
    ).toBeLessThanOrEqual(1);
    // Back in the army it left.
    expect(army.divisions).toContain(div);
    expect(msg.mock.calls).toEqual([
      [deu, "ww1936_raid_result", { n: 1, region: LYON }],
      [fra, "ww1936_raid_result", { n: 1, region: LYON }],
    ]);
  }, 60_000);

  it("raid success destroys the dam (W1 floods it)", async () => {
    const runner = await wwRunner(
      {},
      [
        { clientID: HUMAN, country: "GBR" },
        { clientID: "HUMAN002", country: "DEU" },
      ],
      DEEP.map,
    );
    warAfterPrep(runner, HUMAN, "DEU");
    const g = runner.game;
    const ww = g.worldWar()!;
    const d = ww.depth;
    const gbr = DEEP.tag.GBR;
    const dam = DAMS.indexOf("dam_mohne");
    expect(ww.scenario.damOf(MUNICH)).toBe(dam);
    expect(d.world.damLevel[dam]).toBe(1);
    stockUp(g, "GBR");
    const ce = ww.economy.country(gbr)!;
    const deploy = (n: number) =>
      ww.air.addDeployment({
        owner: gbr,
        sr: DEEP.sr.westLand,
        type: AIR_TYPES.indexOf("strat_bomber"),
        mission: AIR_MISSIONS.indexOf("strategic_bombing"),
        counts: drawPlanes(ce, "strat_bomber", n),
        target: n,
        base: DEEP.region.london,
        lossRest: 0,
        auto: false,
        volunteerFor: 0,
      });
    const dep = deploy(40);
    const raid = {
      kind: "raid" as const,
      raid: "raid_bomb" as const,
      unit: dep.id,
      target: MUNICH,
      building: "dam" as const,
    };
    // Fifty bombers over the zone.
    expect(d.issue(gbr, raid, g.ticks())).toBe("raid_conditions");
    deploy(10);
    rigNextRaid(d, true);
    const day = ww.day(g.ticks());
    expect(d.issue(gbr, raid, g.ticks())).toBe(null);
    expect(d.raids[0].readyDay).toBe(day + 7);
    processRaids(d, day + 7, g.ticks());
    expect(d.world.damLevel[dam]).toBe(0);
    expect(d.raids).toEqual([]);
    // A dam destroyed is no target any more.
    expect(d.issue(gbr, raid, g.ticks())).toBe("raid_conditions");
  }, 60_000);

  it("a failed raid costs half the division", async () => {
    const { g, ww, d, deu, run, army, div } = await paraRaid();
    rigNextRaid(d, false);
    const day = ww.day(g.ticks());
    expect(
      d.issue(
        deu,
        {
          kind: "raid",
          raid: "raid_para",
          unit: div,
          target: LYON,
          building: "facility_nuclear",
        },
        g.ticks(),
      ),
    ).toBe(null);
    const t = ww.land.divisions;
    const men = t.men[t.rowOf(div)];
    processRaids(d, day + 20, g.ticks());
    expect(run.progressMilli).toBe(500_000);
    expect(
      Math.abs(t.men[t.rowOf(div)] - Math.round(men / 2)),
    ).toBeLessThanOrEqual(1);
    expect(army.divisions).toContain(div);
  }, 60_000);

  it("no raid goes in on a no-strike region (pre-flight §0-11)", async () => {
    withNoStrike([LYON]);
    const { g, ww, d, deu, run, army, div } = await paraRaid();
    expect(d.noStrike(LYON)).toBe(true);
    const t = ww.land.divisions;
    const men = t.men[t.rowOf(div)];
    for (const raid of ["raid_para", "raid_commando"] as const) {
      expect(
        d.issue(
          deu,
          {
            kind: "raid",
            raid,
            unit: div,
            target: LYON,
            building: "facility_nuclear",
          },
          g.ticks(),
        ),
      ).toBe("no_strike_region");
    }
    expect(d.raids).toEqual([]);
    expect(army.divisions).toEqual(expect.arrayContaining([div]));
    expect(army.divisions).toHaveLength(2);
    // A raid already prepared (say, before the list held it) is called off:
    // nothing is hit, the division comes back whole, nobody is told.
    rigNextRaid(d, true);
    const day = ww.day(g.ticks());
    d.raids.push({
      uid: d.uid(),
      owner: deu,
      kind: 0,
      unit: div,
      target: LYON,
      building: BUILDING_IDS.indexOf("facility_nuclear"),
      readyDay: day,
    });
    const msg = vi.spyOn(d, "message");
    const fx = vi.spyOn(d, "addFx");
    processRaids(d, day, g.ticks());
    expect(d.raids).toEqual([]);
    expect(run.progressMilli).toBe(500_000);
    expect(t.men[t.rowOf(div)]).toBe(men);
    expect(msg).not.toHaveBeenCalled();
    expect(fx).not.toHaveBeenCalled();
  }, 60_000);
});
