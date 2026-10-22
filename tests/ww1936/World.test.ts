// World War 1936 P6 lane W1 (plan Task 7 Steps 2, 3, 5–7; spec §16.3,
// §16.4, §16.6, §16.7): dams and floods, scorched earth, floating
// harbours, landmarks and the region status on the deep test map.
import {
  DAMS,
  FLOOD_DAYS,
  HARBOR_DAYS,
  SCORCH_DAYS,
  SCORCH_PP,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  FLOOD,
  harborBlock,
  harborLevelMilli,
  LANDMARK_STATS,
  LOST_LANDMARK_STABILITY_BP,
  SCORCH,
  scorchBlock,
} from "@openfront/engine-lib/ww1936/WorldRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { destroyDam, floodRegions } from "@openfront/engine/ww1936/depth/Dams";
import {
  harborInputOf,
  harborLevelOf,
} from "@openfront/engine/ww1936/depth/Harbors";
import {
  landmarkStands,
  landmarkStatsOf,
} from "@openfront/engine/ww1936/depth/Landmarks";
import { scorchInputOf } from "@openfront/engine/ww1936/depth/Scorch";
import {
  dayCommonWorld,
  regionStatus,
} from "@openfront/engine/ww1936/depth/World";
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

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

async function deep(country: "GBR" | "DEU" | "FRA") {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country }], DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { runner, ww, id: DEEP.tag[country] };
}

/** Runs whole days (to the first tick of the day `n` days on). */
function days(runner: GameRunner, n: number): void {
  const ww = runner.game.worldWar()!;
  const until = ww.day(runner.game.ticks()) + n;
  while (ww.day(runner.game.ticks()) < until) step(runner);
}

describe("World War 1936 P6: the world devices (spec §16)", () => {
  it("raid destroys a dam and floods downstream regions", async () => {
    const { runner, ww, id } = await deep("GBR");
    const d = ww.depth;
    const econ = ww.economy;
    const dam = DEEP.dam.dam_mohne;
    const flooded = [dam.region, ...dam.downstream].sort((a, b) => a - b);
    expect(flooded).toEqual([DEEP.region.berlin, DEEP.region.munich]);
    const infra = flooded.map((r) => econ.infra[r]);
    const tick = runner.game.ticks();
    const day = ww.day(tick);
    expect(d.world.damLevel[dam.index]).toBe(1);
    destroyDam(d, dam.index, id, tick);
    expect(d.world.damLevel[dam.index]).toBe(0);
    // Pre-flight §C5: the world flag K3 reads.
    expect(ww.politics.gflags.get(`${DAMS[dam.index]}_destroyed`)).toBe(day);
    expect(d.world.floodUntil).toEqual(
      flooded.map((r) => [r, day + FLOOD_DAYS]),
    );
    flooded.forEach((r, i) => {
      const want = Math.max(FLOOD.infraFloor, infra[i] - FLOOD.infraCut);
      expect(econ.infra[r]).toBe(Math.min(infra[i], want));
      expect(econ.infraEff[r]).toBe(econ.infra[r]);
      const s = regionStatus(d, r);
      expect(s.supplyPm).toBe(500);
      expect(s.moveCutPct).toBe(FLOOD.moveCutPct);
      // The P2 hooks read it.
      expect(d.supplyPm(r)).toBe(500);
      expect(d.moveCutPct(r)).toBe(30);
    });
    expect(regionStatus(d, DEEP.region.paris).supplyPm).toBe(1000);
    // The world hears of it; the map shows it.
    const data = d.takeData()!;
    expect(data.news).toEqual([
      { id: "news_dam_destroyed", params: { region: dam.region } },
    ]);
    expect(data.fx).toEqual([
      {
        kind: "dam",
        region: dam.region,
        from: id,
        owner: DEEP.tag.DEU,
        tick,
      },
    ]);
    expect(data.world?.damLevel[dam.index]).toBe(0);
    // Once: a second blow and a second flood cut nothing more.
    const after = flooded.map((r) => econ.infra[r]);
    destroyDam(d, dam.index, id, tick);
    floodRegions(d, flooded, day);
    expect(flooded.map((r) => econ.infra[r])).toEqual(after);
    // 60 days on, the water is gone (the infrastructure is to rebuild).
    dayCommonWorld(d, day + FLOOD_DAYS + 1, tick);
    expect(d.world.floodUntil).toEqual([]);
    expect(regionStatus(d, dam.region).supplyPm).toBe(1000);
    expect(econ.infra[dam.region]).toBe(after[1]);
  }, 60_000);

  it("scorching destroys half the factories after three days and is cancelled if the region falls", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      DEEP.map,
    );
    warAfterPrep(runner, HUMAN, "POL");
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const econ = ww.economy;
    const deu = DEEP.tag.DEU;
    const berlin = DEEP.region.berlin;
    const munich = DEEP.region.munich;
    expect(ww.land.isEnemy(deu, DEEP.tag.POL)).toBe(true);
    // Not on a quiet front: Rome is not even ours.
    expect(scorchBlock(scorchInputOf(d, deu, DEEP.region.rome))).toBe(
      "scorch_conditions",
    );
    const c = ww.politics.country(deu)!;
    c.ppMilli = 100_000;
    const stab = c.stabBaseBp;
    const before = {
      civ: econ.civ[berlin],
      mil: econ.mil[berlin],
      dock: econ.dock[berlin],
      infra: econ.infra[berlin],
      rail: econ.rail[berlin],
    };
    const tick = runner.game.ticks();
    const day = ww.day(tick);
    expect(d.issue(deu, { kind: "scorch", region: berlin }, tick)).toBeNull();
    expect(c.ppMilli).toBe(100_000 - SCORCH_PP * 1000);
    expect(c.stabBaseBp).toBe(stab + SCORCH.stabilityBp);
    expect(d.world.scorchQueue).toEqual([[berlin, deu, day + SCORCH_DAYS]]);
    // Once is enough.
    expect(d.issue(deu, { kind: "scorch", region: berlin }, tick)).toBe(
      "scorch_conditions",
    );
    days(runner, SCORCH_DAYS - 1);
    expect(econ.civ[berlin]).toBe(before.civ);
    days(runner, 1);
    step(runner);
    const half = (n: number) => n - Math.floor((n * SCORCH.destroyPct) / 100);
    expect(econ.civ[berlin]).toBe(half(before.civ));
    expect(econ.mil[berlin]).toBe(half(before.mil));
    expect(econ.dock[berlin]).toBe(half(before.dock));
    expect(econ.infra[berlin]).toBe(
      Math.max(0, before.infra - SCORCH.infraCut),
    );
    expect(econ.rail[berlin]).toBe(Math.max(0, before.rail - SCORCH.railCut));
    expect(econ.hub[berlin]).toBe(0);
    expect(d.world.scorchQueue).toEqual([]);
    const burnt = day + SCORCH_DAYS;
    expect(d.world.exhaustedUntil).toEqual([
      [berlin, burnt + SCORCH.resourceDays],
    ]);
    expect(regionStatus(d, berlin).resourcePct).toBe(SCORCH.resourcePct);
    // Munich falls before its day: nothing burns, the dam stands.
    const factories = econ.civ[munich] + econ.mil[munich];
    const t2 = runner.game.ticks();
    expect(d.issue(deu, { kind: "scorch", region: munich }, t2)).toBeNull();
    takeRegion(runner.game, munich, "POL");
    days(runner, SCORCH_DAYS + 1);
    expect(d.world.scorchQueue).toEqual([]);
    expect(econ.civ[munich] + econ.mil[munich]).toBe(factories);
    expect(d.world.damLevel[DEEP.dam.dam_mohne.index]).toBe(1);
  }, 60_000);

  it("a floating harbour is a level-5 hub that fades from day 61", async () => {
    const { runner, ww, id } = await deep("GBR");
    const d = ww.depth;
    const ce = ww.economy.country(id)!;
    const malta = DEEP.region.malta;
    const side = ww.navy.sideOf(id);
    const key = equipKey("floating_harbor", 1);
    ce.addTech("floating_harbor_1");
    ce.stock[key] = 1;
    // Spec §16.6: our side's supremacy of 50% in the harbour zone's sea region.
    ww.navy.setSupremacy(DEEP.sr.central, new Map([[side, 400]]));
    expect(harborInputOf(d, id, malta).supremacyPm).toBe(400);
    const tick = runner.game.ticks();
    const order = { kind: "harbor_deploy", region: malta } as const;
    expect(d.issue(id, order, tick)).toBe("harbor_conditions");
    ww.navy.setSupremacy(DEEP.sr.central, new Map([[side, 600]]));
    // Rome's naval base is 3: too big a port to need one.
    expect(harborBlock(harborInputOf(d, id, DEEP.region.rome))).toBe(
      "harbor_conditions",
    );
    expect(d.issue(id, order, tick)).toBeNull();
    expect(ce.stock[key]).toBe(0);
    const day = d.lastCommonDay;
    expect(d.world.harbors).toEqual([[malta, id, day]]);
    // A level-5 sea hub: (4 + 2 × 5) supply, through the P4 hook.
    expect(harborLevelOf(d, malta)).toBe(5_000);
    expect(ww.land.hooks.beachheadCapacity(malta, side)).toBe(14_000);
    expect(harborInputOf(d, id, malta).deployed).toBe(true);
    const at = (age: number) => {
      d.world.harbors[0][2] = d.lastCommonDay - age;
      return harborLevelOf(d, malta);
    };
    expect(at(60)).toBe(5_000);
    expect(at(61)).toBeLessThan(5_000);
    expect(at(61)).toBe(harborLevelMilli(61));
    expect(at(90)).toBe(2_500);
    expect(at(HARBOR_DAYS)).toBe(0);
    // Day 120: gone.
    d.world.harbors[0][2] = day;
    dayCommonWorld(d, day + HARBOR_DAYS - 1, tick);
    expect(d.world.harbors.length).toBe(1);
    dayCommonWorld(d, day + HARBOR_DAYS, tick);
    expect(d.world.harbors).toEqual([]);
    expect(harborLevelOf(d, malta)).toBe(0);
  }, 60_000);

  it("the no-strike list: no scorched earth, no dam blown, no flood (sensitivity)", async () => {
    // Berlin and Munich stand in for Korea and Taiwan (P5's region groups).
    const base = depthFixture();
    const { berlin, munich } = DEEP.region;
    usePoliticsContent(
      depthFixture({
        groups: [
          ...base.groups,
          { id: "taiwan", regions: [berlin, munich], owner1936: "DEU" },
        ],
      }),
    );
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      DEEP.map,
    );
    warAfterPrep(runner, HUMAN, "POL");
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const deu = DEEP.tag.DEU;
    ww.politics.country(deu)!.ppMilli = 100_000;
    expect(d.noStrike(berlin)).toBe(true);
    const tick = runner.game.ticks();
    expect(d.issue(deu, { kind: "scorch", region: berlin }, tick)).toBe(
      "no_strike_region",
    );
    const infra = ww.economy.infra[munich];
    destroyDam(d, DEEP.dam.dam_mohne.index, DEEP.tag.POL, tick);
    expect(d.world.damLevel[DEEP.dam.dam_mohne.index]).toBe(1);
    floodRegions(d, [berlin, munich], ww.day(tick));
    expect(d.world.floodUntil).toEqual([]);
    expect(ww.economy.infra[munich]).toBe(infra);
    expect(ww.politics.gflags.has("dam_mohne_destroyed")).toBe(false);
  }, 60_000);

  it("landmarks give their stats to the controller and cost the legal owner", async () => {
    const { runner, ww } = await deep("FRA");
    const d = ww.depth;
    const fra = DEEP.tag.FRA;
    const deu = DEEP.tag.DEU;
    expect(landmarkStatsOf(d, fra)).toEqual(LANDMARK_STATS.lm_eiffel);
    expect(landmarkStatsOf(d, deu)).toEqual(LANDMARK_STATS.lm_brandenburg);
    const pp = ww.economy.country(deu)!.stats.ppMilli;
    const stab = ww.economy.country(fra)!.stats.stabilityBp;
    takeRegion(runner.game, DEEP.region.paris, "DEU");
    step(runner);
    expect(landmarkStatsOf(d, deu)).toEqual({
      ...LANDMARK_STATS.lm_brandenburg,
      ...LANDMARK_STATS.lm_eiffel,
    });
    expect(landmarkStatsOf(d, fra)).toEqual({
      stabilityBp: LOST_LANDMARK_STABILITY_BP,
    });
    // The depth stats part reached P3's stats (plan decision 24).
    expect(ww.economy.country(deu)!.stats.ppMilli - pp).toBe(
      LANDMARK_STATS.lm_eiffel.ppMilli,
    );
    expect(ww.economy.country(fra)!.stats.stabilityBp - stab).toBe(
      LOST_LANDMARK_STABILITY_BP,
    );
    // The Golden Gate stands from 1937-05-27.
    const gate = dayOfDate("1937-05-27");
    expect(landmarkStands("lm_golden_gate", gate - 1)).toBe(false);
    expect(landmarkStands("lm_golden_gate", gate)).toBe(true);
    expect(landmarkStands("lm_eiffel", 0)).toBe(true);
  }, 60_000);
});
