// World War 1936 P6 lane S (plan Task 6 Step 6, spec §9.1–§9.4): special
// projects on ww1936deep with a human France (no AI moves it). Lyon (2)
// holds France's uranium (2 a day); the tests write its facility into
// P1's building array, as a finished construction would.
import {
  ATOMIC_BOMB_DAYS,
  SPECIAL_PROJECTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  RESOURCE_COUNT,
  RESOURCE_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  inputPm,
  PROJECT_DEFS,
  projectBaseDays,
  projectDayMilli,
  projectStartBlock,
  scientistPct,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  dailyProjects,
  projectEta,
  uraniumDemand,
} from "@openfront/engine/ww1936/depth/Projects";
import { queueBuild } from "@openfront/engine/ww1936/economy/Construction";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP, setInfra } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, step, stepTo, takeRegion, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const LYON = DEEP.region.lyon;
const PARIS = DEEP.region.paris;
const FRA = DEEP.tag.FRA;
const ATOMIC = SPECIAL_PROJECTS.indexOf("sp_atomic");
const ATOMIC_KEY = equipKey("atomic_bomb", 1);
const URANIUM = RESOURCE_IDS.indexOf("uranium");

/** P1's priority hand-out of `n` uranium (RESOURCE_IDS order). */
function uranium(n: number): number[] {
  const got = new Array<number>(RESOURCE_COUNT).fill(0);
  got[URANIUM] = n;
  return got;
}

/** France human on the deep map, past the preparation minute, nuclear physics researched. */
async function france(config: { ww1936Nukes?: boolean } = {}) {
  const runner = await wwRunner(
    config,
    [{ clientID: HUMAN, country: "FRA" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const ce = ww.economy.country(FRA)!;
  ce.addTech("nuclear_physics");
  // P1's extraction gives Lyon's whole deposit (2 uranium) at infrastructure 5.
  setInfra(ww, LYON, 5);
  return { runner, ww, d: ww.depth, ce };
}

/** A nuclear facility in `region`, as finished construction leaves it. */
function nuclearLab(ww: WorldWar, region: number): void {
  ww.economy.buildingArray("facility_nuclear")[region] = 1;
  ww.depth.onFacilityBuilt(region);
}

function dayOf(runner: GameRunner): number {
  return runner.game.worldWar()!.day(runner.game.ticks());
}

/** Runs to the first tick of the next day. */
function nextDay(runner: GameRunner): void {
  const ww = runner.game.worldWar()!;
  stepTo(runner, dayStartTick(dayOf(runner) + 1, ww.prepEndTick()));
}

describe("World War 1936 P6: special projects (spec §9)", () => {
  it("the start judge: the facility, the tech, the predecessor, one place", () => {
    const base = {
      project: "sp_atomic" as const,
      facilityKind: "facility_nuclear" as const,
      facilityBusy: false,
      techs: new Set(["nuclear_physics" as const]),
      done: 0,
      running: false,
      nukesOn: true,
    };
    expect(projectStartBlock(base)).toBe(null);
    expect(projectStartBlock({ ...base, nukesOn: false })).toBe(
      "project_locked",
    );
    expect(projectStartBlock({ ...base, techs: new Set() })).toBe(
      "project_locked",
    );
    expect(projectStartBlock({ ...base, done: 1 << ATOMIC })).toBe(
      "project_locked",
    );
    expect(projectStartBlock({ ...base, running: true })).toBe("in_progress");
    expect(
      projectStartBlock({ ...base, facilityKind: "facility_rocket" }),
    ).toBe("no_facility");
    expect(projectStartBlock({ ...base, facilityBusy: true })).toBe(
      "in_progress",
    );
    // The ballistic rocket follows the flying bomb.
    expect(
      projectStartBlock({
        ...base,
        project: "sp_ballistic",
        facilityKind: "facility_rocket",
        techs: new Set(),
      }),
    ).toBe("project_locked");
    expect(
      projectStartBlock({
        ...base,
        project: "sp_ballistic",
        facilityKind: "facility_rocket",
        techs: new Set(),
        done: 1 << SPECIAL_PROJECTS.indexOf("sp_flying_bomb"),
      }),
    ).toBe(null);
  });

  it("atomic project completes with scientist and uranium, bombs are produced every 120 days", async () => {
    const { runner, ww, d, ce } = await france();
    nuclearLab(ww, LYON);
    const c = d.country(FRA)!;
    // No facility in Paris; the lab in Lyon.
    expect(
      d.issue(
        FRA,
        { kind: "project_start", project: "sp_atomic", facility: PARIS },
        1,
      ),
    ).toBe("no_facility");
    expect(
      d.issue(
        FRA,
        { kind: "project_start", project: "sp_atomic", facility: LYON },
        1,
      ),
    ).toBe(null);
    expect(
      d.issue(
        FRA,
        { kind: "project_start", project: "sp_atomic", facility: LYON },
        1,
      ),
    ).toBe("in_progress");
    // France's first scientist is its nuclear one (skill 1).
    expect(c.proj.scientists[0]).toMatchObject({ spec: 0, skill: 1 });
    expect(
      d.issue(
        FRA,
        { kind: "project_scientist", project: "sp_atomic", scientist: 0 },
        runner.game.ticks(),
      ),
    ).toBe(null);
    expect(c.proj.scientists[0].project).toBe(ATOMIC);
    const run = c.proj.running[0];
    expect(run).toMatchObject({
      project: ATOMIC,
      facility: LYON,
      scientist: 0,
    });
    run.progressMilli = 990_000;
    // Uranium comes from the next economy turn: P1 hands it out first.
    nextDay(runner);
    nextDay(runner);
    expect(uraniumDemand(d, FRA)).toBe(2);
    expect(d.lastPriorityGot.get(FRA)?.[URANIUM]).toBe(2);
    const day = projectDayMilli(
      PROJECT_DEFS.sp_atomic.days,
      scientistPct(1, true),
      1000,
      true,
    );
    expect(projectEta(d, FRA, run)).toEqual({
      daysLeft: Math.ceil((1_000_000 - run.progressMilli) / day),
      inputPm: 1000,
    });
    let guard = 0;
    while ((c.proj.done & (1 << ATOMIC)) === 0 && guard++ < 40) nextDay(runner);
    expect(c.proj.done & (1 << ATOMIC)).not.toBe(0);
    expect(c.proj.running).toEqual([]);
    expect(c.proj.scientists[0].project).toBe(-1);
    // Bombs: one a lab every 120 days at full uranium.
    const first = (() => {
      let n = 0;
      while (ce.stock[ATOMIC_KEY] < 1 && n++ < ATOMIC_BOMB_DAYS + 5) {
        nextDay(runner);
      }
      return dayOf(runner);
    })();
    expect(ce.stock[ATOMIC_KEY]).toBe(1);
    let n = 0;
    while (ce.stock[ATOMIC_KEY] < 2 && n++ < ATOMIC_BOMB_DAYS + 5) {
      nextDay(runner);
    }
    expect(ce.stock[ATOMIC_KEY]).toBe(2);
    expect(
      Math.abs(dayOf(runner) - first - ATOMIC_BOMB_DAYS),
    ).toBeLessThanOrEqual(1);
    // The screens' stage: done.
    expect(uraniumDemand(d, FRA)).toBe(2);
  }, 120_000);

  it("projects run at half speed without a scientist", async () => {
    const { runner, ww, d } = await france();
    nuclearLab(ww, LYON);
    const c = d.country(FRA)!;
    expect(
      d.issue(
        FRA,
        { kind: "project_start", project: "sp_atomic", facility: LYON },
        1,
      ),
    ).toBe(null);
    const run = c.proj.running[0];
    // Full uranium from P1 (the economy turn hands out the demand).
    d.lastPriorityGot.set(FRA, uranium(2));
    const day = dayOf(runner);
    dailyProjects(d, FRA, day);
    const without = run.progressMilli;
    const full = projectDayMilli(PROJECT_DEFS.sp_atomic.days, 0, 1000, true);
    expect(without).toBe(Math.floor(full / 2));
    d.issue(
      FRA,
      { kind: "project_scientist", project: "sp_atomic", scientist: 0 },
      runner.game.ticks(),
    );
    dailyProjects(d, FRA, day + 1);
    expect(run.progressMilli - without).toBe(
      projectDayMilli(
        PROJECT_DEFS.sp_atomic.days,
        scientistPct(1, true),
        1000,
        true,
      ),
    );
    // Half the uranium: half the input.
    d.lastPriorityGot.set(FRA, uranium(1));
    const before = run.progressMilli;
    dailyProjects(d, FRA, day + 2);
    expect(run.progressMilli - before).toBe(
      projectDayMilli(
        PROJECT_DEFS.sp_atomic.days,
        scientistPct(1, true),
        inputPm(1, 2),
        true,
      ),
    );
    // Cancelled: the progress stays, the facility and the scientist go free.
    expect(
      d.issue(FRA, { kind: "project_cancel", project: "sp_atomic" }, 1),
    ).toBe(null);
    expect(run).toMatchObject({ facility: 0, scientist: -1 });
    const kept = run.progressMilli;
    dailyProjects(d, FRA, day + 3);
    expect(run.progressMilli).toBe(kept);
    expect(projectEta(d, FRA, run).daysLeft).toBe(-1);
    // Started again where it stopped.
    expect(
      d.issue(
        FRA,
        { kind: "project_start", project: "sp_atomic", facility: LYON },
        1,
      ),
    ).toBe(null);
    expect(c.proj.running).toHaveLength(1);
    expect(run.progressMilli).toBe(kept);
    void runner;
  });

  it("losing a facility halves progress and gives the captor a blueprint", async () => {
    const { runner, ww, d } = await france();
    nuclearLab(ww, LYON);
    const c = d.country(FRA)!;
    d.issue(
      FRA,
      { kind: "project_start", project: "sp_atomic", facility: LYON },
      1,
    );
    const run = c.proj.running[0];
    run.progressMilli = 500_000;
    const deu = DEEP.tag.DEU;
    takeRegion(runner.game, LYON, "DEU");
    expect(run).toMatchObject({ facility: 0, progressMilli: 250_000 });
    expect(c.proj.halved & (1 << ATOMIC)).not.toBe(0);
    const g = d.country(deu)!;
    expect(g.proj.blueprints & (1 << ATOMIC)).not.toBe(0);
    // The blueprint: the captor's base days −20%.
    expect(projectBaseDays(PROJECT_DEFS.sp_atomic.days, true)).toBe(1_520);
    // Retaken: the paused project takes its facility again, halved once only.
    takeRegion(runner.game, LYON, "FRA");
    expect(run).toMatchObject({ facility: LYON, progressMilli: 250_000 });
    takeRegion(runner.game, LYON, "DEU");
    expect(run.progressMilli).toBe(250_000);
    void step;
  });

  it("nukes off leaves no atomic state", async () => {
    const { runner, ww, d, ce } = await france({ ww1936Nukes: false });
    expect(d.nukesOn()).toBe(false);
    setInfra(ww, LYON, 3);
    // No nuclear facility to build, no atomic project to start.
    expect(queueBuild(ww.economy, ce, LYON, "facility_nuclear", 1)).toBe(
      "not_buildable",
    );
    nuclearLab(ww, LYON);
    expect(
      d.issue(
        FRA,
        { kind: "project_start", project: "sp_atomic", facility: LYON },
        1,
      ),
    ).toBe("project_locked");
    stepTo(runner, runner.game.ticks() + 1_500);
    for (let id = 1; id < d.cap; id++) {
      const c = d.country(id);
      if (c === null) continue;
      expect(
        c.proj.running.filter((r) => r.project === ATOMIC),
        `${id}`,
      ).toEqual([]);
      expect(c.proj.atomic).toEqual([]);
      expect(ww.economy.country(id)?.stock[ATOMIC_KEY] ?? 0).toBe(0);
      expect(uraniumDemand(d, id)).toBe(0);
    }
    expect(d.nukeQueue).toEqual([]);
  }, 120_000);
});
