// World War 1936 P6 lane S (plan Task 6 Steps 5–6, spec §19.6): the
// projects AI on ww1936deep, by direct calls on the dates that matter
// (the AI's day rhythm: day % 10 === smallID % 10). The deep map has no
// United States: Britain, a historical major, stands in and holds the
// United States' beat flag (K5's beats set it on their actor, and the AI
// acts on whoever holds it).
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { aiProjectsDay } from "@openfront/engine/ww1936/depth/AiProjects";
import { drawPlanes } from "@openfront/engine/ww1936/economy/Buildings";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  HUMAN,
  step,
  stepTo,
  takeRegion,
  warAfterPrep,
  wwRunner,
} from "./util";

afterEach(() => usePoliticsContent(null));

/**
 * Pre-flight §0-11: the test content with `regions` in P5's group
 * korea_north (the engine's no-strike set), and `extra` content.
 */
function noStrikeContent(
  regions: number[],
  extra: Parameters<typeof depthFixture>[0] = {},
) {
  const base = depthFixture();
  return depthFixture({
    ...extra,
    groups: [...base.groups, { id: "korea_north", regions, owner1936: "DEU" }],
  });
}

const ATOMIC = SPECIAL_PROJECTS.indexOf("sp_atomic");
const LONDON = DEEP.region.london;
const BERLIN = DEEP.region.berlin;
const MUNICH = DEEP.region.munich;
const GBR = DEEP.tag.GBR;

/** The first day on or after `date` that is `id`'s AI day. */
function aiDayFrom(date: string, id: number): number {
  let day = dayOfDate(date);
  while (day % 10 !== id % 10) day++;
  return day;
}

/** Britain (AI) at war with a human Germany, a bomb in stock and 10 strategic bombers over the zone West. */
async function britishBomb(bombers = 10): Promise<GameRunner> {
  const runner = await wwRunner(
    { historicalAi: true },
    [{ clientID: HUMAN, country: "DEU" }],
    DEEP.map,
  );
  warAfterPrep(runner, HUMAN, "GBR");
  const ww = runner.game.worldWar()!;
  const ce = ww.economy.country(GBR)!;
  ce.stock[equipKey("atomic_bomb", 1)] = 1;
  ce.stock[equipKey("strat_bomber", 1)] = bombers;
  ww.air.addDeployment({
    owner: GBR,
    sr: DEEP.sr.westLand,
    type: AIR_TYPES.indexOf("strat_bomber"),
    mission: AIR_MISSIONS.indexOf("strategic_bombing"),
    counts: drawPlanes(ce, "strat_bomber", bombers),
    target: bombers,
    base: LONDON,
    lossRest: 0,
    auto: false,
    volunteerFor: 0,
  });
  return runner;
}

describe("World War 1936 P6: the projects AI (spec §19.6)", () => {
  it("the US AI starts its atomic project on the historical date when it has the tech", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner({ historicalAi: true }, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const c = d.country(GBR)!;
    // The research institutes stand (the 1942-06 beat's work).
    ww.economy.buildingArray("facility_nuclear")[LONDON] = 1;
    d.onFacilityBuilt(LONDON);
    const day = aiDayFrom("1942-08-13", GBR);
    const atomic = () => c.proj.running.find((r) => r.project === ATOMIC);
    // No beat yet: no project.
    aiProjectsDay(d, GBR, day);
    expect(atomic()).toBeUndefined();
    // The beat's flag, but no nuclear physics: still nothing.
    ww.politics.country(GBR)!.flags.set("hist_usa_atomic_start", [day, -1]);
    aiProjectsDay(d, GBR, day);
    expect(atomic()).toBeUndefined();
    // With the tech it starts in the institute, with its nuclear scientist.
    ww.economy.country(GBR)!.addTech("nuclear_physics");
    aiProjectsDay(d, GBR, day + 1);
    expect(atomic()).toBeUndefined();
    aiProjectsDay(d, GBR, day);
    expect(atomic()).toMatchObject({ facility: LONDON, scientist: 0 });
    expect(c.proj.scientists[0]).toMatchObject({ spec: 0, project: ATOMIC });
  }, 60_000);

  it("Germany's atomic beat starts the project without a scientist", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner({ historicalAi: true }, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const deu = DEEP.tag.DEU;
    ww.economy.country(deu)!.addTech("nuclear_physics");
    ww.economy.buildingArray("facility_nuclear")[BERLIN] = 1;
    d.onFacilityBuilt(BERLIN);
    const day = aiDayFrom("1939-09-01", deu);
    ww.politics.country(deu)!.flags.set("hist_deu_atomic", [day, -1]);
    aiProjectsDay(d, deu, day);
    expect(d.country(deu)!.proj.running).toEqual([
      { project: ATOMIC, facility: BERLIN, progressMilli: 0, scientist: -1 },
    ]);
  }, 60_000);

  it("an AI drops its bomb from 1944 on the enemy region with the most factories, never the capital", async () => {
    usePoliticsContent(depthFixture());
    const runner = await britishBomb();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    expect(ww.capitalRegion(DEEP.tag.DEU)).toBe(BERLIN);
    aiProjectsDay(d, GBR, dayOfDate("1943-12-31"));
    expect(d.nukeQueue).toEqual([]);
    aiProjectsDay(d, GBR, dayOfDate("1944-01-01"));
    expect(d.nukeQueue.map((e) => [e.owner, e.region])).toEqual([
      [GBR, MUNICH],
    ]);
    // One bomb, one drop.
    aiProjectsDay(d, GBR, dayOfDate("1944-01-02"));
    expect(d.nukeQueue).toHaveLength(1);
  }, 60_000);

  it("with the historical AI, the content's targets go first, and not before their date", async () => {
    usePoliticsContent(
      depthFixture({
        nukeTargets: [
          {
            attacker: "GBR",
            target: "DEU",
            regions: [BERLIN],
            notBefore: "1945-08-01",
          },
        ],
      }),
    );
    const runner = await britishBomb();
    const d = runner.game.worldWar()!.depth;
    aiProjectsDay(d, GBR, dayOfDate("1945-07-31"));
    expect(d.nukeQueue).toEqual([]);
    aiProjectsDay(d, GBR, dayOfDate("1945-08-01"));
    expect(d.nukeQueue.map((e) => e.region)).toEqual([BERLIN]);
  }, 60_000);

  it("without the historical AI a country with 80 factories builds a science facility", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner({ historicalAi: false }, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const ita = DEEP.tag.ITA;
    const ce = ww.economy.country(ita)!;
    ce.addTech("radar_1");
    ce.addTech("electronics_1");
    const day = aiDayFrom("1938-01-01", ita);
    const science = () =>
      ce.queue.filter((q) => q.building === "facility_science");
    ce.totals.civ = 50;
    ce.totals.mil = 29;
    aiProjectsDay(d, ita, day);
    expect(science()).toEqual([]);
    ce.totals.mil = 30;
    // A facility takes a shared slot: Rome has none free…
    aiProjectsDay(d, ita, day);
    expect(science()).toEqual([]);
    // …until a factory makes room.
    ww.economy.addBuilding(DEEP.region.rome, "civ", -1);
    aiProjectsDay(d, ita, day);
    expect(science().map((q) => q.region)).toEqual([DEEP.region.rome]);
    // One is enough.
    aiProjectsDay(d, ita, day);
    expect(science()).toHaveLength(1);
    // Built: the microwave radar starts there first.
    ce.queue = ce.queue.filter((q) => q.building !== "facility_science");
    ww.economy.buildingArray("facility_science")[DEEP.region.rome] = 1;
    d.onFacilityBuilt(DEEP.region.rome);
    aiProjectsDay(d, ita, day);
    expect(d.country(ita)!.proj.running).toMatchObject([
      {
        project: SPECIAL_PROJECTS.indexOf("sp_cavity_magnetron"),
        facility: DEEP.region.rome,
      },
    ]);
  }, 60_000);
});

describe("World War 1936 P6: the AI never picks a no-strike region (pre-flight §0-11)", () => {
  it("the bomb picker, with and without the content's targets", async () => {
    // Berlin is the capital: Munich is the only region the picker may take.
    for (const extra of [
      {},
      {
        nukeTargets: [
          {
            attacker: "GBR" as const,
            target: "DEU" as const,
            regions: [MUNICH],
            notBefore: "1944-01-01",
          },
        ],
      },
    ]) {
      usePoliticsContent(noStrikeContent([MUNICH], extra));
      const runner = await britishBomb();
      const ww = runner.game.worldWar()!;
      const d = ww.depth;
      expect(d.noStrike(MUNICH)).toBe(true);
      aiProjectsDay(d, GBR, dayOfDate("1944-01-01"));
      aiProjectsDay(d, GBR, dayOfDate("1945-09-01"));
      expect(d.nukeQueue).toEqual([]);
      expect(ww.economy.country(GBR)!.stock[equipKey("atomic_bomb", 1)]).toBe(
        1,
      );
    }
  }, 60_000);

  it("the rocket picker", async () => {
    const LYON = DEEP.region.lyon;
    const PARIS = DEEP.region.paris;
    const deu = DEEP.tag.DEU;
    const fire = async (noStrike: number[]) => {
      usePoliticsContent(noStrikeContent(noStrike));
      const runner = await wwRunner(
        { historicalAi: true },
        [{ clientID: HUMAN, country: "GBR" }],
        DEEP.map,
      );
      warAfterPrep(runner, HUMAN, "DEU");
      const g = runner.game;
      const ww = g.worldWar()!;
      const d = ww.depth;
      takeRegion(g, LYON, "DEU");
      // P1 takes the new control on its next turn (its region lists).
      step(runner, 8);
      expect(ww.economy.regionsOf(deu)).toContain(LYON);
      d.country(deu)!.proj.done |=
        1 << SPECIAL_PROJECTS.indexOf("sp_flying_bomb");
      ww.economy.buildingArray("rocket_site")[LYON] = 1;
      ww.economy.country(deu)!.stock[equipKey("flying_bomb", 1)] = 20;
      // Off its 10-day turn: only the war-time pickers run.
      const day = aiDayFrom("1941-01-01", deu) + 1;
      aiProjectsDay(d, deu, day);
      return d.rocketQueue.map((e) => e.target);
    };
    // The control: London (or Paris, when France has joined) in range.
    expect([[LONDON], [PARIS]]).toContainEqual(await fire([]));
    // Every enemy region in the site's range on the no-strike list: nothing.
    expect(await fire([LONDON, PARIS])).toEqual([]);
  }, 60_000);

  it("the raid picker", async () => {
    // Britain's raid turn: day % 10 and floor(day / 10) % 18 on its id.
    const day = (GBR % 10) + 10 * (GBR % 18);
    const raids = async (noStrike: number[]) => {
      usePoliticsContent(noStrikeContent(noStrike));
      const runner = await britishBomb(50);
      const d = runner.game.worldWar()!.depth;
      aiProjectsDay(d, GBR, day);
      return d.raids.map((r) => [r.kind, r.target]);
    };
    // The control: the Möhne dam in Munich by precision bombing.
    expect(await raids([])).toEqual([[2, MUNICH]]);
    expect(await raids([MUNICH])).toEqual([]);
  }, 60_000);
});
