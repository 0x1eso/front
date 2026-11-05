// ww91 lanes N3 and N4: the navy, air and production keys of the seven
// majors. Rules as pure functions, then the three hooks that need a game
// (carrier repair, a new wing's experience, frogmen).
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  NAT_SEA_AIR_START,
  SPIRITS_NAT_SEA_AIR,
} from "@openfront/engine-lib/ww1936/content/spirits/natSeaAir";
import { raidPowerCenti } from "@openfront/engine-lib/ww1936/ConvoyRules";
import { efficiencyGrowth } from "@openfront/engine-lib/ww1936/EconomyRules";
import { raidSuccessPm } from "@openfront/engine-lib/ww1936/ProjectRules";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  newWingXp,
  rookieXpOf,
  wingXpCapOf,
  xpAfterRefill,
} from "@openfront/engine-lib/ww1936/WingRules";
import { sinkHarborShip } from "@openfront/engine/ww1936/depth/Raids";
import { dailyRepair } from "@openfront/engine/ww1936/navy/Repair";
import { NAVAL_BASE, REGION, SEA, TAG_ID } from "./seaFixture";
import { warAfterPrep, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

describe("pure rules", () => {
  it("a pack needs six boats", () => {
    const s = emptyStats();
    s.wolfPackPct = 15;
    const at = (n: number) =>
      raidPowerCenti(10_000, 0, 0, s, new Set(), 1000, n);
    expect(at(5)).toBe(10_000);
    expect(at(6)).toBe(11_500);
    expect(at(12)).toBe(11_500);
  });

  it("pilot keys: rookie, new wing, refill curve, ceiling", () => {
    const us = emptyStats();
    us.wingRookieXpMilli = 100;
    us.wingXpCapMilli = -201;
    expect(rookieXpOf(us)).toBe(200);
    expect(newWingXp(us, false)).toBe(400);
    expect(wingXpCapOf(us)).toBe(799);
    let x = 300;
    for (let i = 0; i < 2; i++) x = xpAfterRefill(x, 70, 30, rookieXpOf(us));
    expect(x).toBe(249);
    const jp = emptyStats();
    jp.wingStartXpMilli = 250;
    jp.wingRookieXpMilli = -60;
    expect(newWingXp(jp, true)).toBe(550);
    expect(newWingXp(jp, false)).toBe(240);
    expect(xpAfterRefill(550, 70, 30, rookieXpOf(jp))).toBe(397);
    expect(wingXpCapOf(emptyStats())).toBe(1000);
  });

  it("effGrowthPct scales the day's gain and keeps the default", () => {
    expect(efficiencyGrowth(1000, 5000, 0)).toBe(efficiencyGrowth(1000, 5000));
    const base = efficiencyGrowth(1000, 5000) - 1000;
    expect(efficiencyGrowth(1000, 5000, 25) - 1000).toBe(
      Math.floor((base * 125) / 100),
    );
    expect(efficiencyGrowth(1000, 5000, -25) - 1000).toBe(
      Math.floor((base * 75) / 100),
    );
  });

  it("harborPm only moves a commando raid", () => {
    const i = {
      expLevel: 0,
      aa: 0,
      supPm: 0,
      enemyDivision: false,
      coastalFort: 0,
      bombers: 0,
    };
    expect(raidSuccessPm(1, { ...i, harborPm: 150 })).toBe(800);
    expect(raidSuccessPm(1, i)).toBe(650);
    expect(raidSuccessPm(0, { ...i, harborPm: 150 })).toBe(600);
  });
});

describe("content", () => {
  it("every sea and air spirit is registered and starts with its country", () => {
    const ids = new Set(CONTENT.spirits.map((s) => s.id));
    for (const s of SPIRITS_NAT_SEA_AIR) expect(ids.has(s.id)).toBe(true);
    for (const tag of ["DEU", "SUN", "USA", "GBR", "FRA", "JPN", "ITA"]) {
      const c = CONTENT.countries.find((x) => x.tag === tag)!;
      for (const id of NAT_SEA_AIR_START[tag]) {
        expect(c.spirits).toContain(id);
      }
    }
  });

  it("the Mark 14 goes with the submarine campaign, frogmen come with the human torpedo", () => {
    const eff = (id: string) =>
      JSON.stringify(CONTENT.focuses.find((f) => f.id === id)!.effects);
    expect(eff("usa_submarine_campaign")).toContain(
      '"remove_spirit","id":"nat_usa_mk14"',
    );
    expect(eff("ita_human_torpedo")).toContain('"id":"nat_ita_decima"');
    expect(eff("ita_human_torpedo")).not.toContain("ita_fiat626");
  });
});

describe("hooks in a game", () => {
  const GBR = TAG_ID.GBR;
  async function wwOf() {
    const r = await wwRunner(
      {},
      [
        { clientID: "HUMAN001", country: "GBR" as const },
        { clientID: "HUMAN002", country: "FRA" as const },
      ],
      SEA.map,
    );
    return r.game.worldWar()!;
  }

  it("carrierRepairPct mends carriers only", async () => {
    const ww = await wwOf();
    const navy = ww.navy;
    expect(NAVAL_BASE[REGION.london]).toBeGreaterThan(0);
    const mk = () => {
      const f = navy.fleets.get(
        navy.createFleet(GBR, REGION.london, [
          ["cv", 1, 1],
          ["bb", 1, 1],
        ]),
      )!;
      return f.ships.map((id) => navy.ships.rowOf(id));
    };
    const hurt = (rows: number[]) => {
      for (const r of rows) navy.ships.hp[r] = 50_000;
    };
    const [cv, bb] = mk();
    const ce = navy.econ.country(GBR)!;
    const run = (pct: number) => {
      ce.stats.carrierRepairPct = pct;
      ce.docksLent = 0;
      hurt([cv, bb]);
      dailyRepair(navy, GBR, 0);
      return [navy.ships.hp[cv] - 50_000, navy.ships.hp[bb] - 50_000];
    };
    const [c0, b0] = run(0);
    const [c1, b1] = run(30);
    expect(c1).toBeGreaterThan(c0);
    expect(b1).toBe(b0);
  });

  it("a new wing's experience follows the pilot keys", async () => {
    const ww = await wwOf();
    const ce = ww.economy.country(GBR)!;
    const make = () =>
      ww.air.addWing({
        owner: GBR,
        type: AIR_TYPES.indexOf("fighter"),
        counts: [0],
        base: 0,
      }).xpMilli;
    ce.stats.wingRookieXpMilli = 0;
    ce.stats.wingStartXpMilli = 0;
    const plain = make();
    ce.stats.wingRookieXpMilli = 100;
    ce.stats.wingStartXpMilli = 100;
    const after = make();
    // Day 0 uses the start key, later days the rookie key; both +100 here.
    expect(after).toBe(plain + 100);
  });

  it("frogmen cost the largest docked enemy ship 30 % of its HP", async () => {
    const runner = await wwRunner(
      {},
      [
        { clientID: "HUMAN001", country: "GBR" as const },
        { clientID: "HUMAN002", country: "ITA" as const },
      ],
      SEA.map,
    );
    warAfterPrep(runner, "HUMAN001", "ITA");
    const ww = runner.game.worldWar()!;
    const navy = ww.navy;
    const f = navy.fleets.get(
      navy.createFleet(TAG_ID.ITA, REGION.rome, [
        ["dd", 1, 1],
        ["bb", 1, 1],
      ]),
    )!;
    const [dd, bb] = f.ships.map((id) => navy.ships.rowOf(id));
    const max = navy.shipStatsOf(bb).hpMilli;
    const ddHp = navy.ships.hp[dd];
    sinkHarborShip(ww.depth, GBR, REGION.rome);
    expect(navy.ships.hp[bb]).toBe(max - Math.floor((max * 30) / 100));
    expect(navy.ships.hp[dd]).toBe(ddHp);
  });
});
