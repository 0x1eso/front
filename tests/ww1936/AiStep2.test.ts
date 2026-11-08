// World War 1936 ww162 §4 step 2 (lane L4): the AI's use of the battle
// planner's lines, each piece behind AI_STEP2. On the test map through a
// human's auto armies (the AI's own road): (a) front lines, (c) spearhead
// and broad offensive lines, (d) gap pins. On world1936: (b) the staged
// fallback line. Step 1 (every piece off) is AiWarOrders' and AiPlans'.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { aiGroupLines } from "@openfront/engine/ww1936/depth/AiCommand";
import { makeMarshal } from "@openfront/engine/ww1936/depth/Command";
import {
  AI_GAP_QUIET_DAYS,
  AI_STAGE_RING_PER,
  AI_STEP2,
} from "@openfront/engine/ww1936/land/AiLand";
import { canServe } from "@openfront/engine/ww1936/land/GeneralsRun";
import type { Army } from "@openfront/engine/ww1936/land/WwLand";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  stepTo,
  takeRegion,
  warAfterPrep,
  wideLine,
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

const DEFAULTS = { ...AI_STEP2 };
afterEach(() => Object.assign(AI_STEP2, DEFAULTS));
/** Only the named pieces on (step 1 with them). */
function only(...on: (keyof typeof AI_STEP2)[]) {
  for (const k of Object.keys(AI_STEP2) as (keyof typeof AI_STEP2)[]) {
    AI_STEP2[k] = on.includes(k);
  }
}

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
  wideLine(g);
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
    if (by === "ai" && /^(army|division|group)_/.test(order.kind)) {
      orders.push(order);
    }
    return issue(smallID, order, by);
  };
  const days = (n: number, stop: () => boolean = () => false) => {
    const from = today(g);
    for (let d = from + 1; d <= from + n && !stop(); d++) finishDay(runner, d);
  };
  return { g, l, deu, pol, orders, days };
}
type Ctx = Awaited<ReturnType<typeof atWar>>;

function autoArmy(c: Ctx, region: number, n: number, level: number): Army {
  const a = placeArmy(c.g, "DEU", region, n);
  expect(c.l.issue(c.deu, { kind: "army_auto_level", army: a.id, level })).toBe(
    null,
  );
  return a;
}

describe("ww162 §4 step 2: the AI on the battle planner's lines", () => {
  test("(a) each stretch of the border is held as a front line, and no new order while it stands", async () => {
    only("frontLine");
    const c = await atWar();
    const north = autoArmy(c, BERLIN, 6, 1);
    const south = autoArmy(c, ROME, 3, 1);
    c.days(2);
    expect(north.order.kind).toBe("front");
    expect(north.order.enemy).toBe(c.pol);
    expect(north.order.zone).toEqual([]);
    expect(north.order.ends).toEqual([BERLIN, MUNICH]);
    expect(south.order.ends).toEqual([ROME, ROME]);
    expect(c.orders.some((o) => o.kind === "army_zone")).toBe(false);
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

  test("(c) the main effort goes in as a spearhead offensive line, not army_direct; a level 1 army holds", async () => {
    only("frontLine", "goal");
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 11);
    placeArmy(c.g, "POL", KRAKOW, 11);
    const big = autoArmy(c, MUNICH, 24, 2);
    const hold = autoArmy(c, BERLIN, 9, 1);
    c.days(30, () => c.l.battles.size > 0);
    expect(c.l.battles.size).toBe(1);
    const sector = [...c.l.battles.keys()][0];
    expect(big.order.kind).toBe("plan");
    expect(big.order.goal).toEqual([sector]);
    expect(big.order.spear).toBe(true);
    expect(big.order.executing).toBe(true);
    // The line it stood on stays its zone (a plan order drops the ends).
    expect(big.front.length).toBeGreaterThan(0);
    expect(c.orders.some((o) => o.kind === "army_direct")).toBe(false);
    expect(c.orders.some((o) => o.kind === "army_plan")).toBe(false);
    expect(hold.order.kind).toBe("front");
    expect(
      c.orders.some(
        (o) => "army" in o && o.army === hold.id && o.kind === "army_goal",
      ),
    ).toBe(false);
  }, 120_000);

  test("(c) a walk into empty land is a broad offensive line, running at once", async () => {
    only("goal");
    const c = await atWar();
    const a = autoArmy(c, MUNICH, 6, 2);
    const taken = () =>
      c.l.controller[WARSAW] === c.deu || c.l.controller[KRAKOW] === c.deu;
    c.days(30, taken);
    expect(taken()).toBe(true);
    const goals = c.orders.flatMap((o) =>
      o.kind === "army_goal" && o.army === a.id && !o.spear ? [o] : [],
    );
    expect(goals.length).toBeGreaterThan(0);
    expect(goals[0].regions.length).toBeGreaterThan(0);
    for (const r of goals[0].regions) expect([WARSAW, KRAKOW]).toContain(r);
    expect(c.orders.some((o) => o.kind === "army_plan")).toBe(false);
  }, 120_000);

  test("(d) a gap the army's line misses gets a pinned spare division, released after the quiet days", async () => {
    only("gapFill");
    const c = await atWar();
    const a = autoArmy(c, BERLIN, 8, 2);
    // Poland too strong to attack, so the line holds.
    placeArmy(c.g, "POL", KRAKOW, 24);
    c.days(3);
    expect(a.order.kind).toBe("front");
    // Warsaw changes hands overnight: a new border region, nobody on it.
    takeRegion(c.g, WARSAW, "DEU");
    c.orders.length = 0;
    c.days(1);
    const pin = c.orders.find(
      (o) => o.kind === "division_move" && o.army === a.id,
    );
    expect(pin).toBeDefined();
    if (pin?.kind !== "division_move") return;
    expect(pin.region).toBe(WARSAW);
    expect(a.pins.map((p) => p[1])).toContain(WARSAW);
    c.days(AI_GAP_QUIET_DAYS + 6, () => a.pins.length === 0);
    expect(a.pins).toEqual([]);
    expect(
      c.orders.some((o) => o.kind === "division_release" && o.army === a.id),
    ).toBe(true);
  }, 120_000);

  test("(b) on world1936: a front outnumbered over 1.2 × stages its best ring as an auto fallback line, a spare division per 4 regions", async () => {
    only("fallbackStage");
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
    const orders: WwOrder[] = [];
    const issue = l.issue.bind(l);
    l.issue = (smallID, order, by = "player") => {
      if (by === "ai" && smallID === pol) orders.push(order);
      return issue(smallID, order, by);
    };
    const touchesGermany = (r: number) =>
      sc.edgesOf(r).some((e) => l.controller[e.to] === deu);
    const front = sc.landRegions
      .map((r) => r.id)
      .filter((r) => l.controller[r] === pol && touchesGermany(r));
    const across = sc
      .edgesOf(front[0])
      .find((e) => l.controller[e.to] === deu)!.to;
    for (let i = 0; i < 4; i++) placeArmy(g, "DEU", across, 24);
    // Enough for a division a region of the border: no shortening yet.
    const mine: Army[] = [];
    for (let i = 0; i < 2; i++) {
      const a = placeArmy(g, "POL", front[i % front.length], 24);
      expect(l.issue(pol, { kind: "army_auto", army: a.id, on: true })).toBe(
        null,
      );
      mine.push(a);
    }
    const d0 = today(g);
    finishDay(runner, d0 + 1);
    finishDay(runner, d0 + 2);
    const fallbacks = orders.flatMap((o) =>
      o.kind === "army_fallback" ? [o] : [],
    );
    expect(fallbacks.length).toBeGreaterThan(0);
    const ring = fallbacks[fallbacks.length - 1].regions;
    expect(ring.length).toBeGreaterThan(0);
    expect(fallbacks.every((o) => !o.manual)).toBe(true);
    for (const r of ring) expect(l.sameSide(pol, l.controller[r])).toBe(true);
    const lined = mine.filter((a) => a.order.fallback !== undefined);
    expect(lined.length).toBeGreaterThan(0);
    const pins = orders.flatMap((o) => (o.kind === "division_move" ? [o] : []));
    expect(pins.length).toBe(Math.floor(ring.length / AI_STAGE_RING_PER));
    for (const p of pins) expect(ring).toContain(p.region);
  }, 240_000);

  test("(e) a group whose armies' front lines make one stretch gets it as its front line, their broad lines as a split goal; otherwise its lines go", async () => {
    only("groupLines");
    const c = await atWar();
    const ww = c.g.worldWar()!;
    const fm = c.l
      .country(c.deu)!
      .generals.find((x) => x.army === 0 && canServe(c.l, x, c.l.day()))!;
    makeMarshal(ww.depth, c.deu, fm, 0);
    const a = placeArmy(c.g, "DEU", BERLIN, 2);
    const b = placeArmy(c.g, "DEU", ROME, 2);
    expect(
      ww.depth.issue(
        c.deu,
        { kind: "ag_create", fm: fm.id, armies: [a.id, b.id] },
        c.g.ticks(),
      ),
    ).toBeNull();
    const grp = ww.depth.groups.find((x) => x.owner === c.deu)!;
    const line = (x: Army, ends: [number, number]) =>
      expect(
        c.l.issue(c.deu, {
          kind: "army_front_line",
          army: x.id,
          ends,
          enemy: c.pol,
        }),
      ).toBeNull();
    // Apart, [3] and [5] are no one stretch: no group line.
    line(a, [BERLIN, BERLIN]);
    line(b, [ROME, ROME]);
    aiGroupLines(ww.depth, c.deu, grp.id);
    expect(grp.ends).toBeUndefined();
    line(a, [BERLIN, MUNICH]);
    aiGroupLines(ww.depth, c.deu, grp.id);
    expect(grp.ends).toEqual([BERLIN, ROME]);
    expect(grp.enemy).toBe(c.pol);
    const goal = (x: Army, regions: number[]) =>
      expect(
        c.l.issue(c.deu, {
          kind: "army_goal",
          army: x.id,
          regions,
          spear: false,
          stance: "aggressive",
        }),
      ).toBeNull();
    goal(a, [WARSAW]);
    goal(b, [KRAKOW]);
    aiGroupLines(ww.depth, c.deu, grp.id);
    expect(grp.goal).toEqual([WARSAW, KRAKOW].sort((x, y) => x - y));
    expect(grp.split).toBe(true);
    expect(grp.spear).toBeUndefined();
    // An army off its line (the land AI's ring or effort): the group's lines go.
    expect(
      c.l.issue(c.deu, { kind: "army_zone", army: b.id, regions: [ROME] }),
    ).toBeNull();
    aiGroupLines(ww.depth, c.deu, grp.id);
    expect(grp.ends).toBeUndefined();
    expect(grp.goal).toBeUndefined();
  }, 120_000);

  test("the shipped pieces are (b) and (d); all off: no order of the battle planner", async () => {
    expect(DEFAULTS).toEqual({
      frontLine: false,
      fallbackStage: true,
      goal: false,
      gapFill: true,
      groupLines: false,
    });
    only();
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 11);
    placeArmy(c.g, "POL", KRAKOW, 11);
    autoArmy(c, MUNICH, 24, 2);
    autoArmy(c, BERLIN, 9, 2);
    c.days(20);
    const planner = new Set([
      "army_front_line",
      "army_goal",
      "army_fallback",
      "division_move",
      "division_release",
      "group_front_line",
      "group_goal",
    ]);
    expect(c.orders.filter((o) => planner.has(o.kind))).toEqual([]);
  }, 120_000);
});
