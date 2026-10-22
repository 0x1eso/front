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
import {
  scorchInputOf,
  scorchNow,
} from "@openfront/engine/ww1936/depth/Scorch";
import {
  dayCommonWorld,
  regionStatus,
} from "@openfront/engine/ww1936/depth/World";
import { seaHubCapacityMilli } from "@openfront/engine/ww1936/navy/SeaSupply";
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
      // 60 days: the row holds the last flooded day.
      flooded.map((r) => [r, day + FLOOD_DAYS - 1]),
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
    // Day 60 is the last wet one; then the water is gone (the
    // infrastructure is to rebuild).
    dayCommonWorld(d, day + FLOOD_DAYS - 1, tick);
    expect(d.world.floodUntil.length).toBe(2);
    dayCommonWorld(d, day + FLOOD_DAYS, tick);
    expect(d.world.floodUntil).toEqual([]);
    expect(regionStatus(d, dam.region).supplyPm).toBe(1000);
    expect(econ.infra[dam.region]).toBe(after[1]);
  }, 60_000);

  it("a repaired dam dries its own region and the land downstream at once (review 4)", async () => {
    const { runner, ww, id } = await deep("GBR");
    const d = ww.depth;
    const dam = DEEP.dam.dam_mohne;
    destroyDam(d, dam.index, id, runner.game.ticks());
    expect(regionStatus(d, dam.region).supplyPm).toBe(500);
    d.onDamRepaired(dam.region);
    expect(d.world.damLevel[dam.index]).toBe(1);
    expect(d.world.floodUntil).toEqual([]);
    expect(regionStatus(d, dam.region).supplyPm).toBe(1000);
    expect(regionStatus(d, dam.downstream[0]).moveCutPct).toBe(0);
  }, 60_000);

  it("a bomb halves supply and building in its region (S's constants, pinned)", async () => {
    const { runner, ww } = await deep("GBR");
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    d.markNuked(DEEP.region.paris, day + 10);
    dayCommonWorld(d, day, runner.game.ticks());
    expect(regionStatus(d, DEEP.region.paris)).toEqual({
      supplyPm: 500,
      buildPct: -50,
      moveCutPct: 0,
      resourcePct: 0,
    });
    // A flood on top: a quarter.
    floodRegions(d, [DEEP.region.paris], day);
    dayCommonWorld(d, day, runner.game.ticks());
    expect(regionStatus(d, DEEP.region.paris).supplyPm).toBe(250);
    dayCommonWorld(d, day + 11, runner.game.ticks());
    expect(d.nuked.has(DEEP.region.paris)).toBe(false);
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
      [berlin, burnt + SCORCH.resourceDays - 1],
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
    // Burning a dam's region blows the dam (spec §16.4 / §16.7).
    takeRegion(runner.game, munich, "DEU");
    scorchNow(d, munich, deu, runner.game.ticks());
    expect(d.world.damLevel[DEEP.dam.dam_mohne.index]).toBe(0);
    expect(ww.politics.gflags.has("dam_mohne_destroyed")).toBe(true);
    expect(d.world.floodUntil.map((x) => x[0])).toEqual(
      [munich, ...DEEP.dam.dam_mohne.downstream].sort((x, y) => x - y),
    );
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
    // P6 glue (W1): a working port's sea hub takes the larger of the two.
    expect(seaHubCapacityMilli(ww.navy, malta, side)).toBeLessThan(14_000);
    expect(ww.land.hooks.seaHubCapacity(malta, side)).toBe(14_000);
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
    expect(ww.land.hooks.seaHubCapacity(malta, side)).toBe(
      seaHubCapacityMilli(ww.navy, malta, side),
    );
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
    // Nor a floating harbour (review 6): Berlin given a coast for the test.
    const ce = ww.economy.country(deu)!;
    ce.addTech("floating_harbor_1");
    ce.stock[equipKey("floating_harbor", 1)] = 1;
    const input = { ...harborInputOf(d, deu, berlin) };
    expect(input.noStrike).toBe(true);
    expect(
      harborBlock({
        ...input,
        coastal: true,
        supremacyPm: 1000,
      }),
    ).toBe("harbor_conditions");
    expect(
      harborBlock({
        ...input,
        coastal: true,
        supremacyPm: 1000,
        noStrike: false,
      }),
    ).toBeNull();
  }, 60_000);

  it("a blown dam's flood never reaches a no-strike region downstream (lane S)", async () => {
    // Berlin, below the Möhne, stands in for Korea or Taiwan.
    const base = depthFixture();
    const { berlin, munich } = DEEP.region;
    usePoliticsContent(
      depthFixture({
        groups: [
          ...base.groups,
          { id: "korea_north", regions: [berlin], owner1936: "DEU" },
        ],
      }),
    );
    const { runner, ww, id } = await deep("GBR");
    const d = ww.depth;
    const dam = DEEP.dam.dam_mohne;
    expect(dam.region).toBe(munich);
    expect(dam.downstream).toContain(berlin);
    expect([d.noStrike(munich), d.noStrike(berlin)]).toEqual([false, true]);
    const infra = ww.economy.infra[berlin];
    const tick = runner.game.ticks();
    destroyDam(d, dam.index, id, tick);
    expect(d.world.damLevel[dam.index]).toBe(0);
    expect(d.world.floodUntil.map((x) => x[0])).toEqual([munich]);
    expect(ww.economy.infra[berlin]).toBe(infra);
    expect(regionStatus(d, berlin).supplyPm).toBe(1000);
    expect(regionStatus(d, munich).supplyPm).toBe(500);
  }, 60_000);

  it("every world list reaches the hash, row by row (review 2)", async () => {
    const { ww } = await deep("GBR");
    const d = ww.depth;
    const w = d.world;
    const base = d.hash();
    const lists: [string, number[][], number[]][] = [
      ["floodUntil", w.floodUntil, [DEEP.region.paris, 70]],
      ["harbors", w.harbors, [DEEP.region.malta, DEEP.tag.GBR, 3]],
      ["railGuns", w.railGuns, [9, DEEP.tag.GBR, 2, DEEP.region.london]],
      ["scorchQueue", w.scorchQueue, [DEEP.region.paris, DEEP.tag.FRA, 5]],
      ["scorchedUntil", w.scorchedUntil, [DEEP.region.paris, 200]],
      ["exhaustedUntil", w.exhaustedUntil, [DEEP.region.paris, 200]],
    ];
    const seen = new Set<number>([base]);
    for (const [name, list, row] of lists) {
      list.push([...row]);
      const h = d.hash();
      expect(seen.has(h), name).toBe(false);
      seen.add(h);
      // Every field counts, not a sum of them.
      for (let i = 0; i < row.length; i++) {
        list[0][i] += 1;
        const hi = d.hash();
        expect(hi === h, `${name}[${i}]`).toBe(false);
        list[0][i] -= 1;
      }
      // Two rows swapped in a list hash the same (sorted order).
      list.push([row[0] + 1, ...row.slice(1)]);
      const ab = d.hash();
      list.reverse();
      expect(d.hash(), name).toBe(ab);
      list.length = 0;
      expect(d.hash(), name).toBe(base);
    }
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
