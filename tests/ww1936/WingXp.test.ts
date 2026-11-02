// ww8 lane D: a wing's experience and its ace (design §6).
import {
  AIR_TYPES,
  type PlaneStats,
} from "@openfront/engine-api/ww1936/AirTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  P_ACE_DEATH,
  P_ACE_SPAWN,
} from "@openfront/engine-lib/ww1936/DepthRules";
import { PLANE_BASE } from "@openfront/engine-lib/ww1936/PlaneStats";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  ACE_DEATH_PM,
  WING_ACE_SPAWN_PM,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import {
  wingXpLoadPm,
  wingXpLossPm,
  wingXpStats,
  xpAfterRefill,
  xpTier,
} from "@openfront/engine-lib/ww1936/WingRules";
import {
  noteWingCas,
  noteWingDelivery,
  noteWingFight,
  noteWingRest,
  noteWingStation,
} from "@openfront/engine/ww1936/air/WingXp";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import "./oldAirModel";
import { stepTo, wwRunner } from "./util";
import { giveWing, liveWings } from "./wingUtil";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const FIGHTER = AIR_TYPES.indexOf("fighter");

describe("the xp rules", () => {
  it("tiers and their numbers", () => {
    expect([0, 199, 200, 499, 500, 799, 800, 1000].map(xpTier)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ]);
    const base = {
      ...PLANE_BASE.fighter,
      speedKmh: 400,
      rangeKm: 800,
      ground: 0,
      strat: 0,
      naval: 0,
      supWeightMilli: 100,
      fuelPerSortieMilli: 0,
    } as PlaneStats;
    expect(wingXpStats(base, 300, false)).toBe(base);
    expect(wingXpStats(base, 900, false).airAtk).toBe(
      Math.floor((base.airAtk * 120) / 100),
    );
    expect(wingXpStats(base, 100, false).airAtk).toBeLessThan(base.airAtk);
    // The ace adds +10% attack and +5% agility on a regular wing.
    expect(wingXpStats(base, 300, true).airAtk).toBe(
      Math.floor((base.airAtk * 110) / 100),
    );
    expect([100, 300, 600, 900].map(wingXpLoadPm)).toEqual([
      900, 1000, 1100, 1200,
    ]);
    expect([100, 300, 600, 900].map(wingXpLossPm)).toEqual([
      1100, 1000, 950, 900,
    ]);
  });

  it("a refill dilutes: 40% lost and refilled, 600 falls to 400", () => {
    expect(xpAfterRefill(600, 60, 40)).toBe(400);
    expect(xpAfterRefill(600, 100, 0)).toBe(600);
  });
});

describe("the events", () => {
  it("raise xp, cap at 1000, and rest only up to 300", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "H", country: "GBR" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    const air = runner.game.worldWar()!.air;
    liveWings(air);
    const w = giveWing(air, { owner: GBR, type: FIGHTER, planes: 100 });
    noteWingFight(air, w, 10, 1);
    expect(w.xpMilli).toBe(300 + 2 + 30);
    noteWingCas(air, w);
    noteWingStation(air, w);
    noteWingDelivery(air, w);
    expect(w.xpMilli).toBe(332 + 1 + 1 + 6);
    w.xpMilli = 999;
    noteWingFight(air, w, 100, 1);
    expect(w.xpMilli).toBe(1000);
    // Rest: +1 on every fifth day, never past 300, never on a flying wing.
    w.xpMilli = 100;
    const day = [0, 1, 2, 3, 4, 5].find((d) => (d + w.id) % 5 === 0)!;
    noteWingRest(air, w, day);
    expect(w.xpMilli).toBe(101);
    noteWingRest(air, w, day + 1);
    expect(w.xpMilli).toBe(101);
    w.xpMilli = 300;
    noteWingRest(air, w, day);
    expect(w.xpMilli).toBe(300);
  });
});

describe("aces on wings", () => {
  it("rises on crossing 20 kills by roll, dies by roll, moves on when its wing goes", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "H", country: "GBR" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    const ww = runner.game.worldWar()!;
    const air = ww.air;
    const d = ww.depth;
    const seed = ww.politics.seed;
    liveWings(air);
    // Find a wing id whose first roll passes and one whose roll fails.
    const a = giveWing(air, {
      owner: GBR,
      type: FIGHTER,
      planes: 100,
      xpMilli: 600,
    });
    const b = giveWing(air, {
      owner: GBR,
      type: FIGHTER,
      planes: 50,
      xpMilli: 600,
    });
    const passes = (id: number) =>
      wwRoll(seed, P_ACE_SPAWN, id, 1) % 1000 < WING_ACE_SPAWN_PM;
    // Below 20 kills: nothing. Regular xp: nothing.
    a.kills = 19;
    noteWingFight(air, a, 1, 5);
    expect(a.ace).toBe(0);
    a.kills = 20;
    a.xpMilli = 300;
    noteWingFight(air, a, 1, 5);
    expect(a.ace).toBe(0);
    expect(a.aceMark).toBe(1); // the roll is spent
    a.xpMilli = 600;
    a.aceMark = 0;
    noteWingFight(air, a, 1, 5);
    expect(a.ace !== 0).toBe(passes(a.id));
    if (a.ace === 0) {
      // Force the ace so the rest is exercised whatever the rolls say.
      const ace = {
        id: d.uid(),
        owner: GBR,
        deployment: a.id,
        sinceDay: 5,
        callNo: 1,
      };
      d.sea.aces = [ace];
      a.ace = ace.id;
    }
    const aceId = a.ace;
    // Bigger ace stats now.
    expect(d.sea.aces.map((x) => x.deployment)).toEqual([a.id]);
    // It dies on a day whose roll says so, not on one that does not.
    const dies = (day: number) =>
      wwRoll(seed, P_ACE_DEATH, aceId, day) % 1000 < ACE_DEATH_PM;
    let live = 10;
    while (dies(live)) live++;
    noteWingFight(air, a, 0, live);
    expect(a.ace).toBe(aceId);
    // The wing is disbanded: the ace goes to the other fighter wing.
    air.removeWing(a.id, true);
    expect(b.ace).toBe(aceId);
    expect(d.sea.aces.map((x) => x.deployment)).toEqual([b.id]);
    // No wing of the type left: it retires.
    air.removeWing(b.id, true);
    expect(d.sea.aces).toEqual([]);
    // A dying roll.
    const c = giveWing(air, { owner: GBR, type: FIGHTER, planes: 50 });
    const ace2 = {
      id: d.uid(),
      owner: GBR,
      deployment: c.id,
      sinceDay: 1,
      callNo: 2,
    };
    d.sea.aces = [ace2];
    c.ace = ace2.id;
    let dead = 10;
    while (wwRoll(seed, P_ACE_DEATH, ace2.id, dead) % 1000 >= ACE_DEATH_PM)
      dead++;
    noteWingFight(air, c, 0, dead);
    expect(c.ace).toBe(0);
    expect(d.sea.aces).toEqual([]);
  });
});
