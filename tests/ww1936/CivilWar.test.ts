// World War 1936 P5 lane C (plan Task 7, spec §15): civil wars split a
// country into a dormant slot and end by annexation.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { CIVIL_WAR_SLOTS } from "@openfront/engine-api/ww1936/Countries";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { CS_ACTIVE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEO_DEM, IDEO_FAS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { EventDef } from "@openfront/engine-lib/ww1936/content/types";
import {
  civilWarColor,
  packRgb,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { addPopularity } from "@openfront/engine-lib/ww1936/PoliticsRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { drawPlanes } from "@openfront/engine/ww1936/economy/Buildings";
import {
  endCivilWar,
  startCivilWar,
} from "@openfront/engine/ww1936/endgame/CivilWar";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { civilWar } from "@openfront/engine/ww1936/politics/Ideology";
import { setLawFree } from "@openfront/engine/ww1936/politics/Laws";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, gameHash, step, stepTo, wwRestore, wwRunner } from "./util";

/** The test content's civil war (the Soviet Union rules communist in 1936). */
const CW_EVENT: EventDef = {
  id: "test_civil_war_fascist",
  kind: "country",
  options: [
    {
      id: "a",
      ai: { base: 1 },
      effects: [{ kind: "civil_war", ideology: "fascist" }],
    },
  ],
};

beforeEach(() =>
  usePoliticsContent(
    endgameFixture({ events: [...endgameFixture().events, CW_EVENT] }),
  ),
);
afterEach(() => usePoliticsContent(null));

const MOSCOW = END.region["moscow"];
const KIEV = END.region["kiev"];
const PARIS = END.region["paris"];
const LYON = END.region["lyon"];
const HUMANS = [{ clientID: "HUMANSUN", country: "SUN" as const }];

async function started(humans: typeof HUMANS = []) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  return { runner, g, ww, eg: ww.endgame };
}

type Started = Awaited<ReturnType<typeof started>>;

/** The Soviet Union's fascists rise (the event's civil_war effect). */
function sovietSplit({ g, ww }: Started): void {
  const sun = endId("SUN");
  ww.politics.queueEvent(CW_EVENT.id, sun, sun, 0, 0);
  ww.politics.flushEvents(g.ticks());
}

function lockstep(a: GameRunner, b: GameRunner, ticks: number): void {
  expect(diffGraphs(a.game, b.game)).toEqual([]);
  for (let i = 0; i < ticks; i++) {
    step(a);
    step(b);
    if (gameHash(a) !== gameHash(b)) {
      throw new Error(`hash diverged ${i + 1} tick(s) after restore`);
    }
  }
  expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual([]);
  expect(diffGraphs(a.game, b.game)).toEqual([]);
}

describe("World War 1936 P5: civil wars (spec §15)", () => {
  it("civil_war splits regions, divisions and stock by the ideology share", async () => {
    const s = await started();
    const { ww, eg } = s;
    const land = ww.land;
    const [sun, cw] = [endId("SUN"), endId("CW1")];
    const pc = ww.politics.country(sun)!;
    // 40% fascist: the rebels' share.
    addPopularity(pc.pop, IDEO_FAS, 4000 - pc.pop[IDEO_FAS]);
    const share = 4000;
    // The smallest army (its general at its head) stands in Kiev.
    const small = land
      .armiesOf(sun)
      .sort(
        (a, b) => a.divisions.length - b.divisions.length || a.id - b.id,
      )[0];
    const general = small.general;
    expect(general).not.toBe(0);
    for (const id of small.divisions) {
      land.setDivisionRegion(land.divisions.rowOf(id), KIEV);
    }
    // Planes at Kiev's air base.
    const ce = ww.economy.country(sun)!;
    const k = equipKey("fighter", 1);
    ce.stock[k] += 40;
    const counts = drawPlanes(ce, "fighter", 12);
    const deployed0 = ce.planesDeployed[k];
    const d = ww.air.addDeployment({
      owner: sun,
      sr: ww.scenario.regionSr(KIEV),
      type: AIR_TYPES.indexOf("fighter"),
      mission: 0,
      counts,
      target: 12,
      base: KIEV,
      lossRest: 0,
      auto: true,
      volunteerFor: 0,
    });
    const n = land.rowsOf(sun).length;
    const stock0 = [...ce.stock];
    const men0 = ce.manpower;
    const stab0 = pc.stabBaseBp;
    sovietSplit(s);

    // Regions: the capital stays, Kiev is the rebels'.
    expect(eg.countryState(cw)).toBe("active");
    expect(ww.politics.legalOwner[KIEV]).toBe(cw);
    expect(land.controller[KIEV]).toBe(cw);
    expect(ww.politics.legalOwner[MOSCOW]).toBe(sun);
    expect(land.controller[MOSCOW]).toBe(sun);
    // Divisions: round(n × s) ± 1, each on its own side's land.
    const want = Math.floor((n * share + 5000) / 10000);
    const rebels = land.rowsOf(cw).length;
    expect(Math.abs(rebels - want)).toBeLessThanOrEqual(1);
    expect(rebels + land.rowsOf(sun).length).toBe(n);
    for (const r of land.rowsOf(cw)) {
      expect(land.controller[land.divisions.region[r]]).toBe(cw);
    }
    for (const r of land.rowsOf(sun)) {
      expect(land.controller[land.divisions.region[r]]).toBe(sun);
    }
    // The whole army went with its general.
    expect(land.country(cw)!.generals.map((x) => x.id)).toContain(general);
    expect(land.country(sun)!.generals.some((x) => x.id === general)).toBe(
      false,
    );
    expect(land.armiesOf(cw).some((a) => a.general === general)).toBe(true);
    // Stock and manpower: ⌊× s⌋ each.
    const re = ww.economy.country(cw)!;
    for (let i = 0; i < stock0.length; i++) {
      const m = Math.floor((stock0[i] * share) / 10000);
      expect(re.stock[i]).toBe(m);
      expect(ce.stock[i]).toBe(stock0[i] - m);
    }
    expect(re.manpower).toBe(Math.floor((men0 * share) / 10000));
    expect(ce.manpower).toBe(men0 - re.manpower);
    // The planes based in Kiev are the rebels'.
    expect(d.owner).toBe(cw);
    expect(re.planesDeployed[k]).toBe(12);
    expect(ce.planesDeployed[k]).toBe(deployed0 - 12);
    // The war: rebels attack, a civil war.
    expect(ww.isAtWar(cw, sun)).toBe(true);
    const w = eg.war(eg.warOfPair(cw, sun))!;
    expect(w.kind).toBe("civil");
    expect(w.sides[0].leader).toBe(cw);
    expect(w.sides[1].leader).toBe(sun);
    // Politics (spec §15.4).
    const rc = ww.politics.country(cw)!;
    expect(rc.ruling).toBe(IDEO_FAS);
    expect(rc.pop[IDEO_FAS]).toBe(7000);
    expect(rc.pop.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(rc.stabBaseBp).toBe(5000);
    expect(rc.wsBaseBp).toBe(7000);
    expect(rc.hasSpirit("gen_civil_strife")).toBe(true);
    expect(ww.politics.factionIdx(cw)).toBe(-1);
    expect(pc.pop[IDEO_FAS]).toBe(0);
    expect(pc.pop.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(pc.stabBaseBp).toBe(Math.max(0, stab0 - 1000));
    expect(pc.hasSpirit("gen_civil_strife")).toBe(true);
    // Name, colour, flag, news.
    expect(eg.nameKey[cw]).toBe("ww1936.cw_name.fascist");
    expect(eg.nameArg[cw]).toBe("SUN");
    expect(eg.color[cw]).toBe(packRgb(civilWarColor([150, 30, 30], "fascist")));
    expect(eg.flagOf(cw)).toBe("ww_cw_fascist");
    expect(eg.endgameNews).toContainEqual({
      id: "news_civil_war",
      params: { tag: "SUN", ideology: "fascist" },
    });
  }, 60_000);

  it("every rebel region's victory-point tile is the rebel's on the split tick", async () => {
    const s = await started();
    const { g, ww, eg } = s;
    const [fra, sun] = [endId("FRA"), endId("SUN")];
    sovietSplit(s);
    expect(startCivilWar(eg, fra, "communist", g.ticks())).toBe(true);
    // The first free slots, in order.
    const [cw1, cw2] = [endId("CW1"), endId("CW2")];
    expect(eg.countryState(endId("CW3"))).toBe("dormant");
    for (const [rebel, from, cap] of [
      [cw1, sun, MOSCOW],
      [cw2, fra, PARIS],
    ] as const) {
      const regions = ww.scenario.landRegions.filter(
        (r) => ww.politics.legalOwner[r.id] === rebel,
      );
      expect(regions.length).toBeGreaterThan(0);
      for (const r of regions) {
        expect(g.ownerID(ww.scenario.vpTile(r))).toBe(rebel);
      }
      expect(g.ownerID(ww.scenario.vpTile(ww.scenario.region(cap)!))).toBe(
        from,
      );
    }
    expect(ww.politics.legalOwner[LYON]).toBe(cw2);
  }, 60_000);

  it("ships in the rebels' ports go with them; laws are the old country's", async () => {
    const { g, ww, eg } = await started();
    const fra = endId("FRA");
    const cw = endId("CW1");
    const navy = ww.navy;
    // A destroyer docked at Lyon; a squadron out in Lyon's waters.
    const docked = navy.fleets.get(
      navy.createFleet(fra, LYON, [["dd", 1, 1]]),
    )!;
    const out = navy.fleets.get(
      navy.createFleet(fra, LYON, [
        ["bb", 1, 1],
        ["ca", 1, 1],
        ["ss", 1, 1],
        ["dd", 1, 1],
      ]),
    )!;
    out.docked = 0;
    const [dd1] = docked.ships;
    const [bb, ca, ss, dd2] = out.ships;
    const pol = ww.politics;
    setLawFree(pol, fra, "trade", "free_trade");
    setLawFree(pol, fra, "conscription", "extensive");
    const fe = ww.economy.country(fra)!;
    const n = ww.land.rowsOf(fra).length;
    // France's communists: 10% → the 30% floor; Lyon (24 divisions there).
    expect(startCivilWar(eg, fra, "communist", g.ticks())).toBe(true);
    expect(pol.legalOwner[LYON]).toBe(cw);
    const t = navy.ships;
    const owner = (id: number) => t.owner[t.rowOf(id)];
    // The port's destroyer, then the lightest ship until the rebels hold
    // half their share of the weight (2 + 1 of 20 ≥ 15%).
    expect(owner(dd1)).toBe(cw);
    expect(owner(ss)).toBe(cw);
    for (const id of [bb, ca, dd2]) expect(owner(id)).toBe(fra);
    const fleets = navy.fleetsOf(cw);
    expect(fleets.length).toBeGreaterThan(0);
    for (const f of fleets) expect(f.docked).toBe(LYON);
    // Too many divisions in Lyon: the rebels keep round(n × 30%).
    const want = Math.floor((n * 3000 + 5000) / 10000);
    expect(Math.abs(ww.land.rowsOf(cw).length - want)).toBeLessThanOrEqual(1);
    for (const r of ww.land.rowsOf(fra)) {
      expect(ww.land.divisions.region[r]).not.toBe(LYON);
    }
    // Laws: France's, but no free trade under communists.
    const re = ww.economy.country(cw)!;
    expect(re.laws.conscription).toBe("extensive");
    expect(re.laws.economy).toBe(fe.laws.economy);
    expect(re.laws.trade).toBe("export_focus");
  }, 60_000);

  it("a civil war ends by annexation without a conference", async () => {
    const s = await started();
    const { runner, g, ww, eg } = s;
    const [sun, cw] = [endId("SUN"), endId("CW1")];
    sovietSplit(s);
    const warId = eg.warOfPair(cw, sun);
    step(runner, 30);
    endCivilWar(eg, warId, 1, g.ticks());
    // The government won: Kiev is its again, at once for the point tile.
    expect(ww.politics.legalOwner[KIEV]).toBe(sun);
    expect(ww.land.controller[KIEV]).toBe(sun);
    expect(g.ownerID(ww.scenario.vpTile(ww.scenario.region(KIEV)!))).toBe(sun);
    expect(eg.countryState(cw)).toBe("gone");
    expect(eg.isActor(cw)).toBe(false);
    expect(ww.land.rowsOf(cw)).toEqual([]);
    expect(ww.isAtWar(cw, sun)).toBe(false);
    expect(eg.war(warId)!.ended?.winner).toBe(1);
    // The slot is never used again; nothing goes to a conference.
    step(runner, 60);
    expect(eg.conferences).toEqual([]);
    expect(eg.countryState(cw)).toBe("gone");
    expect(ww.land.controller[KIEV]).toBe(sun);
    expect(ww.politics.legalOwner[KIEV]).toBe(sun);
  }, 60_000);

  it("the winning rebel takes the old country's name", async () => {
    const s = await started();
    const { g, ww, eg } = s;
    const [sun, cw] = [endId("SUN"), endId("CW1")];
    sovietSplit(s);
    eg.takeData();
    endCivilWar(eg, eg.warOfPair(cw, sun), 0, g.ticks());
    expect(eg.nameKey[cw]).toBe("ww1936.country.SUN");
    expect(eg.nameArg[cw]).toBeNull();
    expect(eg.flagOf(cw)).toBe("ww_cw_fascist");
    for (const r of [MOSCOW, KIEV]) {
      expect(ww.politics.legalOwner[r]).toBe(cw);
      expect(ww.land.controller[r]).toBe(cw);
      // The Soviet cores are the winner's too (no occupation of its own land).
      expect(eg.hasCore(cw, r)).toBe(true);
      expect(eg.isAdministered(r)).toBe(false);
    }
    expect(eg.countryState(sun)).toBe("gone");
    expect(ww.isCapitulated(sun)).toBe(true);
    expect(ww.land.rowsOf(sun)).toEqual([]);
    expect(eg.exiles).toEqual([]);
    const d = eg.takeData()!;
    expect(d.countries).toContainEqual(
      expect.objectContaining({ smallID: cw, nameKey: "ww1936.country.SUN" }),
    );
  }, 60_000);

  it("with all slots used civil_war falls back to the P3 government change", async () => {
    const s = await started();
    const { ww, eg } = s;
    const sun = endId("SUN");
    for (const t of CIVIL_WAR_SLOTS) eg.setCountryState(endId(t), CS_ACTIVE);
    const pc = ww.politics.country(sun)!;
    const stab0 = pc.stabBaseBp;
    sovietSplit(s);
    expect(pc.ruling).toBe(IDEO_FAS);
    expect(pc.hasSpirit("gen_civil_strife")).toBe(true);
    expect(pc.stabBaseBp).toBe(Math.max(0, stab0 - 2500));
    expect(ww.politics.legalOwner[KIEV]).toBe(sun);
    expect(ww.hasWar(sun)).toBe(false);
    expect(eg.wars).toEqual([]);
  }, 60_000);

  it("a country in a civil war does not split again", async () => {
    const s = await started();
    const { g, ww, eg } = s;
    const sun = endId("SUN");
    sovietSplit(s);
    civilWar(ww.politics, sun, IDEO_DEM, g.ticks());
    // The government changes instead; the next slot stays asleep.
    expect(ww.politics.country(sun)!.ruling).toBe(IDEO_DEM);
    expect(eg.countryState(endId("CW2"))).toBe("dormant");
    expect(eg.wars.filter((w) => w.kind === "civil")).toHaveLength(1);
  }, 60_000);

  it("restoring right after the split continues exactly", async () => {
    const s = await started(HUMANS);
    const { runner: a, g, eg } = s;
    const [sun, cw] = [endId("SUN"), endId("CW1")];
    expect(startCivilWar(eg, sun, "fascist", g.ticks())).toBe(true);
    // Spec §15.7: the human keeps the capital's side; the rebels are AI.
    expect(eg.humanClientOf(sun)).toBe("HUMANSUN");
    expect(eg.isHumanControlled(cw)).toBe(false);
    step(a, 2);
    const b = await wwRestore(a, HUMANS, END_MAP);
    expect(b.game.worldWar()!.endgame.countryState(cw)).toBe("active");
    lockstep(a, b, 60);
  }, 60_000);
});
