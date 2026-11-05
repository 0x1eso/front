// World War 1936 ww7 lane D: the AI commands by the army objective orders. On
// the test map, through a human's auto armies (the AI's own road, with nobody
// else moving): the border cut geographically, the combined gate, the auto
// levels. On world1936: the fallback line of a front with too few divisions.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { armyAutoAll } from "@openfront/engine/ww1936/Automation";
import { aiBestRing } from "@openfront/engine/ww1936/land/AiLand";
import { joinBattle } from "@openfront/engine/ww1936/land/Battles";
import type { Army } from "@openfront/engine/ww1936/land/WwLand";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  stepTo,
  warAfterPrep,
  wwGameStart,
  wwRunner,
} from "./util";

// The test map: Berlin 3, Munich 4 and Rome 5 (Axis) face Warsaw 6 and
// Krakow 7 (Poland). Border chain: 3 - 4 - 5.
const BERLIN = 3;
const MUNICH = 4;
const ROME = 5;
const WARSAW = 6;
const KRAKOW = 7;

function finishDay(runner: GameRunner, d: number) {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}
const today = (g: Game) => g.worldWar()!.day(g.ticks());

/** Germany and Poland are humans, the board blank; the AI moves only auto armies. */
async function atWar() {
  const runner = await wwRunner({ historicalAi: false }, [
    { clientID: HUMAN, country: "DEU" },
    { clientID: "HUMAN002", country: "POL" },
  ]);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  const l = land(g);
  const deu = byTag(g, "DEU").smallID();
  const pol = byTag(g, "POL").smallID();
  for (const id of [deu, pol]) {
    const ce = l.econ.country(id)!;
    ce.manpower += 1_000_000;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 10_000;
  }
  const orders: WwOrder[] = [];
  const issue = l.issue.bind(l);
  l.issue = (smallID, order, by = "player") => {
    if (by === "ai" && order.kind.startsWith("army_")) orders.push(order);
    return issue(smallID, order, by);
  };
  /** Up to `n` more days, until `stop` says so. */
  const days = (n: number, stop: () => boolean = () => false) => {
    const from = today(g);
    for (let d = from + 1; d <= from + n && !stop(); d++) finishDay(runner, d);
  };
  return { g, l, deu, pol, orders, days };
}

type Ctx = Awaited<ReturnType<typeof atWar>>;

/** An army of `n` in `region` on the given auto level. */
function autoArmy(c: Ctx, region: number, n: number, level: number): Army {
  const a = placeArmy(c.g, "DEU", region, n);
  expect(c.l.issue(c.deu, { kind: "army_auto_level", army: a.id, level })).toBe(
    null,
  );
  return a;
}

describe("ww7 lane D: the AI's army objective orders", () => {
  test("the border is cut in chain order by divisions, all of it covered, and no new order while the split stands", async () => {
    const c = await atWar();
    const north = autoArmy(c, BERLIN, 6, 1);
    const south = autoArmy(c, ROME, 3, 1);
    c.days(2);
    expect(north.order.enemy).toBe(c.pol);
    expect(north.order.zone).toEqual([BERLIN, MUNICH]);
    expect(south.order.zone).toEqual([ROME]);
    const bp = north.planBp;
    c.orders.length = 0;
    c.days(20);
    expect(c.orders).toEqual([]);
    expect(north.planBp).toBeGreaterThan(bp);
    const t = c.l.divisions;
    const standing = new Set<number>();
    for (const id of [...north.divisions, ...south.divisions]) {
      const r = t.rowOf(id);
      if (t.mode[r] === 0) standing.add(t.region[r]);
    }
    for (const r of [BERLIN, MUNICH, ROME]) expect(standing.has(r)).toBe(true);
  }, 120_000);

  test("ww7 lane F: an outnumbered front's battle under way is not called off", async () => {
    const c = await atWar();
    const a = autoArmy(c, BERLIN, 3, 2);
    placeArmy(c.g, "POL", WARSAW, 2);
    // Far more than Germany's within two edges: the front is outnumbered.
    placeArmy(c.g, "POL", KRAKOW, 30);
    a.order = {
      ...a.order,
      kind: "plan",
      anchor: BERLIN,
      enemy: c.pol,
      targets: [WARSAW],
      stance: "aggressive",
      executing: true,
    };
    for (const id of a.divisions) joinBattle(c.l, id, WARSAW);
    expect(c.l.battles.get(WARSAW)!.attackers).toHaveLength(3);
    c.days(1);
    // The ratio is under the pursuit bar, and the stop rules are not met.
    expect(a.order.kind).toBe("plan");
    expect(a.order.executing).toBe(true);
    expect(c.l.battles.get(WARSAW)?.attackers.length ?? 0).toBeGreaterThan(0);
  }, 120_000);

  test("ww7 lane F: a front with nobody on it takes the smallest army, even from an outnumbered front", async () => {
    const c = await atWar();
    const big = autoArmy(c, BERLIN, 10, 1);
    const small = autoArmy(c, MUNICH, 2, 1);
    // Poland far stronger; France at war too, with nobody standing.
    placeArmy(c.g, "POL", WARSAW, 30);
    const fra = byTag(c.g, "FRA").smallID();
    c.g.worldWar()!.setWar(c.deu, fra, c.g.ticks());
    c.days(2);
    expect(big.order.enemy).toBe(c.pol);
    expect(small.order.kind).toBe("front");
    expect(small.order.enemy).toBe(fra);
  }, 120_000);

  test("too few divisions under a stronger enemy: a shorter ring behind the border", async () => {
    // The score: the shortest ring, unless it gives up victory points; a
    // river or a mountain counts half a region; hardly shorter is no reason.
    const border = { regions: 12, terrain: 0 };
    const ring = (regions: number, vpLost = 0, terrain = 0) => ({
      regions,
      terrain,
      vpLost,
    });
    expect(aiBestRing(border, [ring(9), ring(5), ring(7)])).toBe(1);
    expect(aiBestRing(border, [ring(9, 1), ring(3, 21)])).toBe(0);
    expect(aiBestRing(border, [ring(6, 0, 6), ring(5)])).toBe(0);
    expect(aiBestRing(border, [ring(10)])).toBe(-1);
    // On world1936: Poland with two divisions, Germany massed next to it.
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const runner = await createGameRunner(
      wwGameStart({ historicalAi: false }, [
        { clientID: HUMAN, country: "POL" },
      ]),
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
    const l = land(g);
    const sc = l.scenario;
    const pol = byTag(g, "POL").smallID();
    const deu = byTag(g, "DEU").smallID();
    warAfterPrep(runner, HUMAN, "DEU");
    clearLand(g);
    for (const id of [pol, deu]) {
      const ce = l.econ.country(id)!;
      ce.manpower += 10_000_000;
      for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 100_000;
    }
    const touchesGermany = (r: number) =>
      sc.edgesOf(r).some((e) => l.controller[e.to] === deu);
    const front = sc.landRegions
      .map((r) => r.id)
      .filter((r) => l.controller[r] === pol && touchesGermany(r));
    expect(front.length).toBeGreaterThanOrEqual(4);
    placeArmy(
      g,
      "DEU",
      sc.edgesOf(front[0]).find((e) => l.controller[e.to] === deu)!.to,
      24,
    );
    const a = placeArmy(g, "POL", front[0], 2);
    expect(
      l.issue(pol, { kind: "army_auto_level", army: a.id, level: 1 }),
    ).toBe(null);
    const d0 = today(g);
    finishDay(runner, d0 + 1);
    finishDay(runner, d0 + 2);
    expect(a.order.kind).toBe("front");
    const zone = [...a.order.zone];
    expect(zone.length).toBeGreaterThan(0);
    expect(zone.length).toBeLessThan(front.length);
    for (const r of zone) {
      expect(l.controller[r]).toBe(pol);
      expect(touchesGermany(r)).toBe(false);
    }
    // The same line stands the next day.
    finishDay(runner, d0 + 3);
    expect(a.order.zone).toEqual(zone);
  }, 300_000);

  test("the gate reads all that would go in: one army alone holds where two converging attack, and they go together for one region", async () => {
    // Twenty in Warsaw, twenty-four in Krakow: eighteen would not do, and the
    // front stands outnumbered; with nine more the main effort takes both
    // armies to one region: the holder of the rest sends its spare too.
    const run = async (armies: [number, number][]) => {
      const c = await atWar();
      placeArmy(c.g, "POL", WARSAW, 20);
      placeArmy(c.g, "POL", KRAKOW, 24);
      const mine = armies.map(([r, n]) => autoArmy(c, r, n, 2));
      c.days(30, () => c.l.battles.size > 0);
      return { c, mine, fought: c.l.battles.size > 0 };
    };
    const alone = await run([[MUNICH, 18]]);
    expect(alone.fought).toBe(false);
    expect(alone.mine[0].order.kind).toBe("front");
    const both = await run([
      [BERLIN, 9],
      [MUNICH, 18],
    ]);
    expect(both.fought).toBe(true);
    expect(both.c.l.battles.size).toBe(1);
    const sector = [...both.c.l.battles.keys()][0];
    const plans = both.c.orders.flatMap((o) =>
      o.kind === "army_plan" ? [o] : [],
    );
    const direct = both.c.orders.flatMap((o) =>
      o.kind === "army_direct" ? [o] : [],
    );
    expect(new Set(plans.map((o) => o.army)).size).toBe(2);
    expect(new Set(direct.map((o) => o.army)).size).toBe(2);
    for (const o of plans) {
      expect(o.targets[0]).toBe(sector);
      expect(o.stance).toBe("aggressive");
    }
    for (const o of direct) {
      expect(o.targets).toEqual([sector]);
      expect(o.advance).toBe(false);
      expect(o.allIn).toBe(false);
      expect(o.favorable).toBe(false);
    }
  }, 240_000);

  test("C1: only the main sector is attacked, in force, and a level 1 army holds", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 24);
    placeArmy(c.g, "POL", KRAKOW, 24);
    const big = autoArmy(c, MUNICH, 24, 2);
    const hold = autoArmy(c, BERLIN, 9, 1);
    c.days(30, () => c.l.battles.size > 0);
    expect(c.l.battles.size).toBe(1);
    expect(big.order.direct).toBe(true);
    expect(big.order.targets).toEqual([...c.l.battles.keys()]);
    expect(hold.order.kind).toBe("front");
    expect(
      c.orders.some((o) => o.kind === "army_direct" && o.army === hold.id),
    ).toBe(false);
  }, 120_000);

  test("C6: a sector that feeds under half of the army starts no effort", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 24);
    placeArmy(c.g, "POL", KRAKOW, 24);
    const big = autoArmy(c, MUNICH, 24, 2);
    const other = autoArmy(c, BERLIN, 9, 2);
    // Divisions too hungry for any region to feed.
    c.l.supplyBaseOf = () => 1_000_000_000;
    c.days(12);
    expect(big.order.kind).toBe("front");
    expect(other.order.kind).toBe("front");
    expect(c.orders.some((o) => o.kind === "army_plan")).toBe(false);
  }, 120_000);

  test("level 1 holds and never attacks (a plan turns to Defend), level 2 attacks; army_auto and the all-armies switch mean level 2", async () => {
    const hold = await atWar();
    placeArmy(hold.g, "POL", WARSAW, 1);
    const a = placeArmy(hold.g, "DEU", BERLIN, 20);
    expect(
      hold.l.issue(hold.deu, {
        kind: "army_plan",
        army: a.id,
        targets: [WARSAW],
        stance: "balanced",
      }),
    ).toBe(null);
    expect(
      hold.l.issue(hold.deu, { kind: "army_auto_level", army: a.id, level: 1 }),
    ).toBe(null);
    hold.days(30);
    expect(hold.l.battles.size).toBe(0);
    expect(a.order.kind).toBe("front");
    expect(a.order.zone.length).toBeGreaterThan(0);
    expect(hold.orders.some((o) => o.kind === "army_plan")).toBe(false);
    expect(armyAutoAll(hold.g.worldWar()!, hold.deu, true)).toBe(null);
    expect(a.autoLevel).toBe(2);
    const go = await atWar();
    placeArmy(go.g, "POL", WARSAW, 1);
    const b = placeArmy(go.g, "DEU", BERLIN, 20);
    expect(
      go.l.issue(go.deu, { kind: "army_auto", army: b.id, on: true }),
    ).toBe(null);
    expect(b.autoLevel).toBe(2);
    const taken = () =>
      go.l.battles.has(WARSAW) || go.l.controller[WARSAW] === go.deu;
    go.days(30, taken);
    expect(taken()).toBe(true);
  }, 120_000);
});
