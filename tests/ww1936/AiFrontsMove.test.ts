// ww103: what seven full AI games found. Fronts froze: the AI built level 5
// forts along whole lines, stacked 100 divisions on a region (which starved
// there and could not be attacked at any odds), and its attack gate stopped it
// for years. Men died without battles for the same stacks. So: forts by value,
// a line no deeper than its width, the rest behind it where they are fed, no
// training past what it can feed or use, and a stalemate lowers the bars.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  BattalionId,
  SupportId,
} from "@openfront/engine-api/ww1936/LandTypes";
import { MOVE_NONE } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import {
  AI_FEED_OK_PM,
  AI_FORT_LINE_LEVEL,
  AI_FORT_PRESSED_LEVEL,
  AI_LIBERATION_LIFT_ANY_DAYS,
  AI_LIBERATION_LIFT_RATIO_PM,
  AI_STALE_FROM_DAYS,
  AI_STALE_FULL_DAYS,
  AI_STALE_LOW_PM,
  AI_STALE_MID_PM,
  AI_TRAIN_HUNGRY_PCT,
  AI_TRAIN_IDLE_MIN,
  aiFedDemand,
  aiFortCap,
  aiGatePm,
  aiLiberationOver,
  aiRearArmies,
  aiStaleGate,
  aiTrainStops,
} from "@openfront/engine/ww1936/land/AiLand";
import {
  AI_FORT_DECISION_LEVEL,
  bordersFortified,
} from "@openfront/engine/ww1936/politics/AiPolitics";
import { pickRegions } from "@openfront/engine/ww1936/politics/EffectsEcon";
import { addWarGoal } from "@openfront/engine/ww1936/politics/WarGoals";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  clearLand,
  dropPact,
  land,
  placeArmy,
  pol,
  stepTo,
  takeRegion,
  wwGameStart,
  wwRunner,
} from "./util";

/** All-AI test map, no calendar: Germany at war with Poland after the preparation minute. */
async function war() {
  const runner = await wwRunner({ historicalAi: false });
  const g = runner.game;
  dropPact(g, "DEU", "POL");
  const [deu, pl] = [byTag(g, "DEU"), byTag(g, "POL")];
  addWarGoal(pol(g), deu.smallID(), pl.smallID(), "conquer", "", 0);
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = g.worldWar()!;
  expect(declareWar(g, ww, deu, pl, g.ticks())).not.toEqual([]);
  return {
    runner,
    g,
    ww,
    l: land(g),
    deu: deu.smallID(),
    pl: pl.smallID(),
    d0: ww.day(g.ticks()),
  };
}

/** On world1936: two AI countries at war, the board blank, gear and convoys to spare. */
async function realWar(tagA: CountryTag = "DEU", tagB: CountryTag = "POL") {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const runner = await createGameRunner(
    wwGameStart({ historicalAi: false }, []),
    undefined,
    await loadMapFiles(
      new NodeGameMapLoader(path.join(dir, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  const g = runner.game;
  dropPact(g, tagA, tagB);
  const [a, b] = [byTag(g, tagA), byTag(g, tagB)];
  addWarGoal(pol(g), a.smallID(), b.smallID(), "conquer", "", 0);
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = g.worldWar()!;
  expect(declareWar(g, ww, a, b, g.ticks())).not.toEqual([]);
  clearLand(g);
  const l = land(g);
  for (const id of [a.smallID(), b.smallID()]) {
    const ce = l.econ.country(id)!;
    ce.manpower += 10_000_000;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 1_000_000;
  }
  return { runner, g, l, deu: a.smallID(), pl: b.smallID(), ww };
}

function finishDay(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}

describe("the AI's fronts move (ww103)", () => {
  it("level 5 forts only on the top spots; a line 2, pressed 3", () => {
    expect(aiFortCap(true, false)).toBe(5);
    expect(aiFortCap(false, false)).toBe(AI_FORT_LINE_LEVEL);
    expect(aiFortCap(false, true)).toBe(AI_FORT_PRESSED_LEVEL);
    expect(AI_FORT_PRESSED_LEVEL).toBeLessThanOrEqual(3);
  });

  it("a stalemate lowers the bars to even odds, and no further", () => {
    const g = aiGatePm("democracy");
    expect(aiStaleGate(g, 0)).toEqual(g);
    expect(aiStaleGate(g, AI_STALE_FROM_DAYS)).toEqual(g);
    const half = aiStaleGate(g, (AI_STALE_FROM_DAYS + AI_STALE_FULL_DAYS) / 2);
    expect(half.midPm).toBeLessThan(g.midPm);
    expect(half.midPm).toBeGreaterThan(AI_STALE_MID_PM);
    expect(aiStaleGate(g, 5000)).toEqual({
      midPm: AI_STALE_MID_PM,
      lowPm: AI_STALE_LOW_PM,
    });
    // A bar under the floor stays where it is.
    expect(aiStaleGate({ midPm: 900, lowPm: 600 }, 5000)).toEqual({
      midPm: 900,
      lowPm: 600,
    });
  });

  it("training stops at what it can't feed, and at war at what it can't use", () => {
    const base = { total: 100, hungry: 0, idle: 0, atWar: true };
    expect(aiTrainStops(base)).toBe(false);
    expect(aiTrainStops({ ...base, hungry: AI_TRAIN_HUNGRY_PCT })).toBe(false);
    expect(aiTrainStops({ ...base, hungry: AI_TRAIN_HUNGRY_PCT + 1 })).toBe(
      true,
    );
    expect(aiTrainStops({ ...base, idle: AI_TRAIN_IDLE_MIN })).toBe(true);
    // At peace an idle army is an army at peace; a small one is no mass.
    expect(aiTrainStops({ ...base, idle: 90, atWar: false })).toBe(false);
    expect(aiTrainStops({ ...base, total: 30, idle: 20 })).toBe(false);
  });

  it("an idle army stranded on enemy land fights for the region it stands in", async () => {
    const { runner, g, l, deu, pl, d0 } = await war();
    clearLand(g);
    const WARSAW = 6;
    placeArmy(g, "POL", WARSAW, 3);
    const a = placeArmy(g, "DEU", WARSAW, 3);
    expect(a.order.kind).toBe("idle");
    const t = l.divisions;
    const row = () => t.rowOf(a.divisions[0]);
    expect(t.battle[row()]).toBe(0);
    for (let d = d0; d <= d0 + 6; d++) finishDay(runner, d);
    // In the battle for Warsaw, or it is over and the region was fought for.
    const fought =
      l.battles.has(WARSAW) ||
      l.controller[WARSAW] === deu ||
      !l.armies.has(a.id);
    expect(fought).toBe(true);
    expect(l.controller[WARSAW] === pl && !l.battles.has(WARSAW)).toBe(
      !l.armies.has(a.id),
    );
  }, 120_000);

  it("the same army with nobody left takes the region", async () => {
    const { runner, g, l, deu, d0 } = await war();
    clearLand(g);
    const WARSAW = 6;
    placeArmy(g, "DEU", WARSAW, 2);
    expect(l.controller[WARSAW]).not.toBe(deu);
    for (let d = d0; d <= d0 + 6; d++) finishDay(runner, d);
    expect(l.controller[WARSAW]).toBe(deu);
  }, 120_000);

  it("a line takes what its width uses; the armies over it stand behind", () => {
    const army = (id: number, n: number, over = {}) => ({
      id,
      divisions: n,
      running: false,
      shock: false,
      behind: false,
      fixed: false,
      ...over,
    });
    // Twelve fill it: the largest stay, the smaller go.
    expect([
      ...aiRearArmies([army(1, 6), army(2, 12), army(3, 9)], 12),
    ]).toEqual([3, 1]);
    // Shock armies keep the line, a running attack is left alone.
    expect([
      ...aiRearArmies(
        [
          army(1, 12),
          army(2, 6, { shock: true }),
          army(3, 6, { running: true }),
        ],
        12,
      ),
    ]).toEqual([1]);
    // Who stands behind stays behind while the line is full.
    expect([
      ...aiRearArmies([army(1, 12, { behind: true }), army(2, 12)], 12),
    ]).toEqual([1]);
    // A line short of divisions sends nobody back.
    expect(aiRearArmies([army(1, 6), army(2, 5)], 12).size).toBe(0);
    // A Defend-only army stays where its owner put it.
    expect(
      aiRearArmies([army(1, 12), army(2, 6, { fixed: true })], 12).size,
    ).toBe(0);
  });

  it("a year in, or with its land back and the odds its way, a democracy no longer only liberates", () => {
    const yes = () => true;
    const no = () => false;
    const odds = AI_LIBERATION_LIFT_RATIO_PM;
    expect(AI_LIBERATION_LIFT_ANY_DAYS).toBe(365);
    expect(odds).toBe(1000);
    // Early: only with its land back and above even odds.
    expect(aiLiberationOver(30, odds + 1, yes)).toBe(true);
    expect(aiLiberationOver(30, odds, yes)).toBe(false);
    expect(aiLiberationOver(30, 9000, no)).toBe(false);
    // A year in: whatever the odds.
    expect(aiLiberationOver(AI_LIBERATION_LIFT_ANY_DAYS - 1, 0, no)).toBe(
      false,
    );
    expect(aiLiberationOver(AI_LIBERATION_LIFT_ANY_DAYS, 0, no)).toBe(true);
  });

  it("a democracy's bars sit between the old ones and an aggressor's", () => {
    const d = aiGatePm("democracy");
    const a = aiGatePm("aggressor");
    expect(d).toEqual({ midPm: 1300, lowPm: 900 });
    expect(d.midPm).toBeGreaterThan(a.midPm);
    expect(d.lowPm).toBeGreaterThan(a.lowPm);
    expect(aiStaleGate(d, 5000)).toEqual({
      midPm: AI_STALE_MID_PM,
      lowPm: AI_STALE_LOW_PM,
    });
  });

  it("ww106: a democracy stronger with its land back goes in; with land still lost it takes that back first", async () => {
    const run = async (lost: boolean) => {
      const { runner, g, l, ww, deu, pl: fra } = await realWar("DEU", "FRA");
      const sc = l.scenario;
      const legal = ww.politics.legalOwner;
      const home = sc.landRegions.find(
        (r) =>
          legal[r.id] === fra &&
          sc.edgesOf(r.id).some((e) => legal[e.to] === deu),
      )!.id;
      const across = sc.edgesOf(home).find((e) => legal[e.to] === deu)!.to;
      const far = sc.edgesOf(home).find((e) => legal[e.to] === fra)!.to;
      if (lost) {
        takeRegion(g, far, "DEU");
        placeArmy(g, "DEU", far, 6);
      }
      for (let i = 0; i < 3; i++) placeArmy(g, "FRA", home, 24);
      placeArmy(g, "DEU", across, 2);
      const d0 = ww.day(g.ticks());
      const aims = new Set<number>();
      for (let d = d0; d <= d0 + 40; d++) {
        finishDay(runner, d);
        // Once it has the land back the rule is over: that's the other case.
        if (lost && l.controller[far] !== deu) break;
        for (const a of l.armiesOf(fra)) {
          if (a.order.kind !== "plan") continue;
          for (const r of a.order.targets) aims.add(legal[r]);
        }
      }
      return { aims, deu, fra };
    };
    const back = await run(false);
    expect(back.aims.has(back.deu)).toBe(true);
    const short = await run(true);
    expect(short.aims.has(short.fra)).toBe(true);
    expect(short.aims.has(short.deu)).toBe(false);
  }, 300_000);

  it("the fort decision stops where the AI's border stands at its level", async () => {
    const { g, deu } = await war();
    const p = pol(g);
    const econ = g.worldWar()!.economy;
    p.threatBp[byTag(g, "POL").smallID()] = 9000;
    const picks = pickRegions(p, deu, { borderWith: "threat", n: 3 });
    expect(picks.length).toBeGreaterThan(0);
    for (const r of picks) econ.fort[r] = 0;
    expect(bordersFortified(p, deu)).toBe(false);
    econ.fort[picks[0]] = AI_FORT_DECISION_LEVEL;
    expect(bordersFortified(p, deu)).toBe(true);
  }, 120_000);

  it("ww105: a front asks for no more than its stretch feeds, and one a region", () => {
    expect(aiFedDemand(1200, 8, 1)).toBe(80);
    expect(aiFedDemand(50, 8, 1)).toBe(50);
    expect(aiFedDemand(1200, 2, 5)).toBe(50);
  });

  it("ww105: an army behind the line stands there whole, on regions that feed it", async () => {
    const { runner, g, l, deu, pl, ww } = await realWar();
    const sc = l.scenario;
    const line = sc.landRegions
      .map((r) => r.id)
      .filter(
        (r) =>
          l.controller[r] === deu &&
          sc.edgesOf(r).some((e) => l.controller[e.to] === pl),
      );
    const across = sc
      .edgesOf(line[0])
      .find((e) => l.controller[e.to] === pl)!.to;
    placeArmy(g, "POL", across, 24);
    const armies = [0, 1, 2, 3, 4, 5, 6, 7].map(() =>
      placeArmy(g, "DEU", line[0], 24),
    );
    const d0 = ww.day(g.ticks());
    for (let d = d0; d <= d0 + 45; d++) finishDay(runner, d);
    const t = l.divisions;
    const onLine = new Set(line);
    const rear = armies.filter(
      (a) =>
        l.armies.has(a.id) &&
        a.order.kind === "front" &&
        a.order.zone.length > 0 &&
        a.order.zone.every((r) => !onLine.has(r)),
    );
    expect(rear.length).toBeGreaterThan(0);
    for (const a of rear) {
      // One region takes a quarter of an army: the rest used to stay put.
      expect(a.order.zone.length).toBeGreaterThan(1);
      for (const id of a.divisions) {
        expect(a.order.zone).toContain(t.dest[t.rowOf(id)]);
      }
    }
  }, 300_000);

  it("ww105: an army left on the front of a war that ended walks off to eat", async () => {
    // A war on, with no land front: nothing else gives the army an order.
    const { runner, g, l, deu, ww } = await realWar("DEU", "USA");
    const sc = l.scenario;
    const fra = byTag(g, "FRA").smallID();
    // Germany proper: East Prussia is a stretch of its own.
    const mine = [sc.landRegions.find((r) => r.name === "Berlin")!.id];
    for (let i = 0; i < mine.length; i++) {
      for (const e of sc.edgesOf(mine[i])) {
        if (l.controller[e.to] === deu && !mine.includes(e.to)) {
          mine.push(e.to);
        }
      }
    }
    const d0 = ww.day(g.ticks());
    finishDay(runner, d0);
    const worst = [...mine].sort(
      (x, y) => l.supplyMilli[x] - l.supplyMilli[y] || x - y,
    )[0];
    l.econ.country(deu)!.manpower += 10_000_000;
    const armies = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() =>
      placeArmy(g, "DEU", worst, 24),
    );
    for (const a of armies) {
      a.order = { ...a.order, kind: "front", enemy: fra, zone: [worst] };
    }
    expect(ww.isAtWar(deu, fra)).toBe(false);
    for (let d = d0 + 1; d <= d0 + 14; d++) finishDay(runner, d);
    // Some walked off, and who stayed eats.
    const t = l.divisions;
    const stay = armies
      .flatMap((a) => a.divisions)
      .map((id) => t.rowOf(id))
      .filter((r) => t.region[r] === worst && t.mode[r] === MOVE_NONE);
    expect(stay.length).toBeLessThan(220);
    for (const r of stay) {
      expect(t.supply[r]).toBeGreaterThanOrEqual(AI_FEED_OK_PM);
    }
  }, 300_000);

  it("ww105: an army its stretch can't feed sails to a stretch that can", async () => {
    const { runner, g, l, ww } = await realWar("SUN", "JPN");
    const sc = l.scenario;
    const at = (name: string) =>
      sc.landRegions.find((r) => r.name === name)!.id;
    const sakhalin = at("Sakhalin");
    // Sakhalin cut off: no rear on it, one port, and a Japanese front.
    for (const e of sc.edgesOf(sakhalin)) {
      if (l.controller[e.to] !== l.controller[sakhalin]) continue;
      takeRegion(g, e.to, "JPN");
    }
    // The heavy divisions of 1936: the line of ww107 eats too little here, and
    // Japan's would be run over instead of holding the Soviets on their line.
    const heavy = 99;
    const inf = (n: number) => new Array<BattalionId>(n).fill("infantry");
    const give = (
      tag: CountryTag,
      battalions: BattalionId[],
      support: SupportId[],
    ) =>
      l.country(byTag(g, tag).smallID())!.templates.push({
        id: heavy,
        key: "",
        def: { name: "Heavy", battalions, support },
      });
    l.country(byTag(g, "SUN").smallID())!.templates[0].def = {
      name: "",
      battalions: [...inf(9), "artillery", "artillery"],
      support: [],
    };
    give("JPN", [...inf(12), "artillery", "artillery"], ["engineer"]);
    for (const e of sc.edgesOf(sakhalin)) {
      placeArmy(g, "JPN", e.to, 40, heavy);
    }
    const armies = [0, 1, 2, 3, 4, 5].map(() =>
      placeArmy(g, "SUN", sakhalin, 20),
    );
    const d0 = ww.day(g.ticks());
    let sailed = false;
    for (let d = d0; d <= d0 + 24 && !sailed; d++) {
      // ww107: the pocket's first-day break-out would run on against this
      // line; here the attack has stopped and the armies stand.
      for (const a of armies) {
        if (a.order.kind === "plan") a.order = { ...a.order, executing: false };
      }
      finishDay(runner, d);
      sailed = armies.some((a) => {
        const o = a.order;
        return o.kind === "move" && o.to !== sakhalin;
      });
    }
    expect(sailed).toBe(true);
  }, 300_000);

  it("ww106: an idle army its stretch can't feed sails too", async () => {
    // A war with no land front: nothing but the relief looks at them.
    const { runner, g, l, ww } = await realWar("SUN", "USA");
    const sc = l.scenario;
    const sakhalin = sc.landRegions.find((r) => r.name === "Sakhalin")!.id;
    for (const e of sc.edgesOf(sakhalin)) {
      if (l.controller[e.to] === l.controller[sakhalin]) {
        takeRegion(g, e.to, "JPN");
      }
    }
    const armies = [0, 1, 2, 3].map(() => placeArmy(g, "SUN", sakhalin, 20));
    const d0 = ww.day(g.ticks());
    let sailed = false;
    for (let d = d0; d <= d0 + 24 && !sailed; d++) {
      finishDay(runner, d);
      sailed = armies.some((a) => {
        const o = a.order;
        return o.kind === "move" && o.to !== sakhalin;
      });
    }
    expect(sailed).toBe(true);
  }, 300_000);

  it("ww106: at war, cut off between neutrals with no convoys, armies go home one at a time", async () => {
    const { runner, g, l, ww, d0, deu } = await war();
    const LONDON = 10;
    takeRegion(g, LONDON, "DEU");
    ww.economy.buildingArray("naval_base")[LONDON] = 0;
    const ce = l.econ.country(deu)!;
    ce.manpower += 10_000_000;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 1_000_000;
    for (let i = 0; i < 3; i++) placeArmy(g, "DEU", LONDON, 24);
    // One period of the effort: one army, the war still on.
    for (let d = d0; d <= d0 + 12; d++) finishDay(runner, d);
    expect(ww.enemiesOf(deu).length).toBeGreaterThan(0);
    expect(l.rowsIn(LONDON).length).toBe(48);
  }, 300_000);

  it("ww105: a hungry army walks when no rail line reaches where it's fed", async () => {
    // A war with no land front, so the armies stand idle at the end of the line.
    const { runner, g, l, ww } = await realWar("SUN", "USA");
    const sc = l.scenario;
    const start = sc.landRegions.find(
      (r) => r.name === "Chukchi Autonomous Okrug",
    )!.id;
    // Bombed: the lines are on the map, and no train runs.
    l.econ.railEff.fill(0);
    const armies = [0, 1].map(() => placeArmy(g, "SUN", start, 24));
    const d0 = ww.day(g.ticks());
    const t = l.divisions;
    let walked = false;
    for (let d = d0; d <= d0 + 14 && !walked; d++) {
      finishDay(runner, d);
      walked = armies.some((a) =>
        a.divisions.some((id) => t.mode[t.rowOf(id)] !== MOVE_NONE),
      );
    }
    expect(walked).toBe(true);
  }, 300_000);

  it("at peace an army starving with no way out disbands; men come home", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS + 1);
    const l = land(g);
    const LONDON = 10;
    takeRegion(g, LONDON, "DEU");
    // An enclave: no land road home, and no port either.
    g.worldWar()!.economy.buildingArray("naval_base")[LONDON] = 0;
    const a = placeArmy(g, "DEU", LONDON, 40);
    const d0 = g.worldWar()!.day(g.ticks());
    for (let d = d0; d <= d0 + 25; d++) finishDay(runner, d);
    expect(l.armies.has(a.id)).toBe(false);
  }, 120_000);
});
