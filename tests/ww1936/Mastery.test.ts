// World War 1936 P6 lane D (plan Task 2, spec §3): doctrine mastery, grand
// doctrines and sub-doctrines, on the deep map with a human Germany (no P6
// AI of its own, plan decision 30).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  GRAND_DOCTRINES,
  SUBDOCTRINES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  GRAND_DOCTRINE_STATS,
  SUBDOCTRINE_REWARDS,
} from "@openfront/engine-lib/ww1936/DoctrineRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { applyMasteryEffect } from "@openfront/engine/ww1936/depth/Doctrine";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  byTag,
  dropPact,
  grantDoctrineStats,
  order,
  stamped,
  step,
  stepTo,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const H = "HUMANDEU";
const DEU = DEEP.tag.DEU;
const LAND = [0, 1, 2];

async function germany() {
  const runner = await wwRunner(
    {},
    [{ clientID: H, country: "DEU" }],
    DEEP.map,
  );
  const ww = runner.game.worldWar()!;
  return { runner, ww, d: ww.depth, doc: ww.depth.country(DEU)!.doc };
}

/** The tick after Germany's depth turn of `day`. */
function afterTurn(runner: GameRunner, day: number): number {
  const ww = runner.game.worldWar()!;
  return dayStartTick(day, ww.prepEndTick()) + (DEU % WW_DAY_SPLIT) + 1;
}

const stat = (s: object, k: string) =>
  (s as Partial<Record<WwStatKey, number>>)[k as WwStatKey] ?? 0;

describe("doctrine mastery (spec §3.4)", () => {
  it("doctrine pick and mastery grow with combat", async () => {
    const { runner, ww, doc } = await germany();
    step(runner, 1, [
      order(H, { kind: "doctrine_pick", domain: "land", id: "gd_mobile" }),
      order(H, {
        kind: "subdoctrine_pick",
        track: "armor",
        id: "arm_breakthrough",
      }),
    ]);
    expect(doc.gd[0]).toBe(GRAND_DOCTRINES.indexOf("gd_mobile"));
    expect(doc.sub[1]).toBe(SUBDOCTRINES.indexOf("arm_breakthrough"));
    expect(stat(ww.economy.country(DEU)!.stats, "rsDoctrinePct")).toBe(0);
    // Ten days of peace: 0.3 a day on the armour track.
    stepTo(runner, afterTurn(runner, 9));
    expect(doc.masteryMilli[1]).toBe(3_000);
    expect(doc.gain[1]).toBe(300);
    // War with Poland, Germany's armies attack Warsaw.
    dropPact(runner.game, "DEU", "POL");
    step(runner, 2, [
      stamped(H, {
        type: "declare_war",
        target: byTag(runner.game, "POL").id(),
      }),
    ]);
    expect(ww.isAtWar(DEU, DEEP.tag.POL)).toBe(true);
    const armies = ww.land.armiesOf(DEU).map((a) => a.id);
    expect(armies.length).toBeGreaterThan(0);
    step(
      runner,
      1,
      armies.map((army) =>
        order(H, { kind: "army_attack", army, region: DEEP.region.warsaw }),
      ),
    );
    const day0 = ww.day(runner.game.ticks()) + 1;
    let fought = 0;
    for (let day = day0; day < day0 + 15; day++) {
      stepTo(runner, afterTurn(runner, day));
      const land = LAND.map((t) => doc.gain[t]);
      for (const g of land) {
        expect(g).toBeGreaterThanOrEqual(300);
        expect(g).toBeLessThanOrEqual(1_200);
      }
      if (Math.max(...land) > 300) fought++;
    }
    expect(fought).toBeGreaterThan(0);
  });

  it("grand doctrine completion applies at level sum 6", async () => {
    const { runner, ww, d, doc } = await germany();
    const ce = ww.economy.country(DEU)!;
    const tick = runner.game.ticks();
    expect(
      d.issue(
        DEU,
        { kind: "doctrine_pick", domain: "land", id: "gd_mobile" },
        tick,
      ),
    ).toBeNull();
    const base = { ...ce.stats };
    const [, complete] = GRAND_DOCTRINE_STATS.gd_mobile;
    expect(Object.keys(complete).length).toBeGreaterThan(0);
    // Levels 2/2/2: the completion effect joins the base one.
    for (const t of LAND) doc.masteryMilli[t] = 300_000;
    d.markStats(DEU);
    d.endTick();
    for (const [k, v] of Object.entries(complete)) {
      expect(stat(ce.stats, k), k).toBe(stat(base, k) + v);
    }
    // 2/2/1 (sum 5): not yet.
    doc.masteryMilli[2] = 100_000;
    d.markStats(DEU);
    d.endTick();
    for (const k of Object.keys(complete)) {
      expect(stat(ce.stats, k), k).toBe(stat(base, k));
    }
  });

  it("switching a grand doctrine halves mastery and costs xp", async () => {
    const { runner, ww, d, doc } = await germany();
    const cl = ww.land.country(DEU)!;
    cl.armyXpMilli = 150_000;
    const tick = runner.game.ticks();
    const pick = (id: string, at = tick) =>
      d.issue(
        DEU,
        { kind: "doctrine_pick", domain: "land", id } as WwOrder,
        at,
      );
    // The first pick is free.
    expect(pick("gd_mobile")).toBeNull();
    expect(d.xpOf(DEU, 0)).toBe(150);
    doc.masteryMilli[0] = 200_000;
    doc.masteryMilli[1] = 100_001;
    doc.masteryMilli[2] = 7;
    doc.masteryMilli[3] = 90_000;
    expect(pick("gd_mass")).toBeNull();
    expect(d.xpOf(DEU, 0)).toBe(50);
    expect(doc.masteryMilli.slice(0, 4)).toEqual([100_000, 50_000, 3, 90_000]);
    const day = ww.day(tick);
    expect(doc.gdLock[0]).toBe(day + 180);
    // Locked for 180 days; after them, 50 experience is short of 100.
    expect(pick("gd_firepower")).toBe("doctrine_locked");
    const later = dayStartTick(day + 180, ww.prepEndTick());
    expect(pick("gd_firepower", later)).toBe("no_xp");
    expect(doc.gd[0]).toBe(GRAND_DOCTRINES.indexOf("gd_mass"));
    // The same doctrine again is no order.
    expect(pick("gd_mass", later)).toBe("bad_index");
  });

  it("a sub-doctrine reward needs the grand doctrine", async () => {
    const { runner, ww, d, doc } = await germany();
    const ce = ww.economy.country(DEU)!;
    const tick = runner.game.ticks();
    expect(
      d.issue(
        DEU,
        { kind: "subdoctrine_pick", track: "infantry", id: "inf_elastic" },
        tick,
      ),
    ).toBeNull();
    doc.masteryMilli[0] = 100_000; // level 1
    d.markStats(DEU);
    d.endTick();
    const before = stat(ce.stats, "infDefensePct");
    expect(
      d.issue(
        DEU,
        { kind: "doctrine_pick", domain: "land", id: "gd_battleplan" },
        tick,
      ),
    ).toBeNull();
    expect(stat(ce.stats, "infDefensePct")).toBe(
      before + SUBDOCTRINE_REWARDS.inf_elastic[0].infDefensePct!,
    );
    // A switch of the sub-doctrine costs 25 experience (none here).
    expect(
      d.issue(
        DEU,
        { kind: "subdoctrine_pick", track: "infantry", id: "inf_assault" },
        tick,
      ),
    ).toBe("no_xp");
  });

  it("mastery effect splits over three tracks", async () => {
    const { runner, ww, doc } = await germany();
    const ctx = makeCtx(ww.politics, DEU, DEU, DEU, runner.game.ticks());
    applyMasteryEffect(
      ctx,
      { kind: "doctrine_mastery", domain: "land", amount: 120 },
      DEU,
    );
    expect(doc.masteryMilli.slice(0, 3)).toEqual([40_000, 40_000, 40_000]);
    applyMasteryEffect(
      ctx,
      { kind: "doctrine_mastery", domain: "land", amount: 100 },
      DEU,
    );
    // floor(/3) each, the remainder to the first track.
    expect(doc.masteryMilli.slice(0, 3)).toEqual([73_334, 73_333, 73_333]);
    applyMasteryEffect(
      ctx,
      { kind: "doctrine_mastery", domain: "air", track: "bomber", amount: 60 },
      DEU,
    );
    expect(doc.masteryMilli.slice(6, 9)).toEqual([0, 60_000, 0]);
  });

  it("mastery speed follows rsDoctrinePct", async () => {
    const { runner, ww, doc } = await germany();
    // A theorist advisor (spec §3.4): rsDoctrinePct +15.
    grantDoctrineStats(ww, DEU, { rsDoctrinePct: 15 });
    stepTo(runner, afterTurn(runner, 2));
    const m = doc.masteryMilli[4];
    stepTo(runner, afterTurn(runner, 3));
    expect(doc.masteryMilli[4] - m).toBe(345);
    expect(doc.gain[4]).toBe(345);
  });
});
