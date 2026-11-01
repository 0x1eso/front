// World War 1936 ww7 lane C: army objective orders on the test map — the
// zone of the day, cover first, the spare by threat or toward the axis,
// rotation, the attack's range thresholds, Attack done -> Defend, the gaps
// between armies and for the screen, the odds, and a restore mid-plan.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { MOVE_NONE } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { combatWidth } from "@openfront/engine-lib/ww1936/CombatRules";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { Army } from "@openfront/engine/ww1936/land/WwLand";
import {
  byTag,
  clearLand,
  gameHash,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  takeRegion,
  warAfterPrep,
  wwRestore,
  wwRunner,
} from "./util";

const HUMAN_POL = "HUMAN002";
const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: HUMAN_POL, country: "POL" as const },
];
// The test map: Berlin 3, Munich 4 and Rome 5 (Axis) face Warsaw 6 and
// Krakow 7 (Poland). Border graph: 3 - 4 - 5.
const BERLIN = 3;
const MUNICH = 4;
const ROME = 5;
const WARSAW = 6;
const KRAKOW = 7;

function finishDay(runner: GameRunner, d: number) {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}
const today = (g: Game) => g.worldWar()!.day(g.ticks());

async function atWar() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  const l = land(g);
  const deu = byTag(g, "DEU").smallID();
  const pol = byTag(g, "POL").smallID();
  return { runner, g, l, deu, pol };
}

type Ctx = Awaited<ReturnType<typeof atWar>>;

/** Division count by the region each division is posted to (dest). */
function posts(c: Ctx, a: Army): Map<number, number> {
  const out = new Map<number, number>();
  for (const id of a.divisions) {
    const d = c.l.divisions.dest[c.l.divisions.rowOf(id)];
    out.set(d, (out.get(d) ?? 0) + 1);
  }
  return new Map([...out].sort((x, y) => x[0] - y[0]));
}

function defend(c: Ctx, a: Army, anchor = BERLIN, zone?: number[]) {
  expect(
    c.l.issue(c.deu, {
      kind: "army_front",
      army: a.id,
      anchor,
      enemy: c.pol,
    }),
  ).toBe(null);
  if (zone !== undefined) {
    expect(
      c.l.issue(c.deu, { kind: "army_zone", army: a.id, regions: zone }),
    ).toBe(null);
  }
}

/** Whether a battle on `region` was seen in any of the next `ticks` ticks. */
function battleSeen(c: Ctx, region: number, ticks: number): boolean {
  let seen = false;
  for (let i = 0; i < ticks; i++) {
    step(c.runner);
    if (c.l.battles.has(region)) seen = true;
  }
  return seen;
}

const orgOf = (c: Ctx, id: number) =>
  c.l.divisions.org[c.l.divisions.rowOf(id)];

describe("ww7 lane C: the zone of the day", () => {
  test("a Defend zone is ceil(divisions / 2) regions from the anchor, seen within a tick", async () => {
    for (const [n, want] of [
      [1, [BERLIN]],
      [4, [BERLIN, MUNICH]],
      [5, [BERLIN, MUNICH, ROME]],
    ] as const) {
      const c = await atWar();
      const a = placeArmy(c.g, "DEU", BERLIN, n);
      defend(c, a);
      step(c.runner);
      expect(a.front).toEqual(want);
    }
  }, 120_000);

  test("an explicit zone is the zone (on the border), and automatic again when emptied", async () => {
    const c = await atWar();
    const a = placeArmy(c.g, "DEU", BERLIN, 4);
    defend(c, a, BERLIN, [ROME, BERLIN]);
    step(c.runner);
    expect(a.order.zone).toEqual([ROME, BERLIN]);
    expect(a.front).toEqual([ROME, BERLIN]);
    // Rome falls: the zone is what is left of it on the border.
    takeRegion(c.g, ROME, "POL");
    finishDay(c.runner, today(c.g) + 1);
    expect(a.front).toEqual([BERLIN]);
    expect(
      c.l.issue(c.deu, { kind: "army_zone", army: a.id, regions: [] }),
    ).toBe(null);
    step(c.runner);
    expect(a.front).toEqual([BERLIN, MUNICH]);
    // A zone only for an army that holds a front or plan.
    const idle = placeArmy(c.g, "DEU", BERLIN, 1);
    expect(
      c.l.issue(c.deu, { kind: "army_zone", army: idle.id, regions: [BERLIN] }),
    ).not.toBe(null);
  }, 120_000);
});

describe("ww7 lane C: cover first, then the spare", () => {
  test("every zone region gets one division before any gets a second", async () => {
    const c = await atWar();
    const a = placeArmy(c.g, "DEU", BERLIN, 3);
    defend(c, a, BERLIN, [BERLIN, MUNICH, ROME]);
    step(c.runner);
    expect([...posts(c, a)]).toEqual([
      [BERLIN, 1],
      [MUNICH, 1],
      [ROME, 1],
    ]);
  }, 120_000);

  test("too few divisions: the zone is covered by threat x (1 + victory points)", async () => {
    const c = await atWar();
    // Eight Polish divisions in Warsaw face Berlin (21 points) and Munich
    // (4), Krakow's none face Rome: Berlin 8 x 22, Munich 8 x 5, Rome 0.
    placeArmy(c.g, "POL", WARSAW, 8);
    const a = placeArmy(c.g, "DEU", BERLIN, 2);
    defend(c, a, BERLIN, [ROME, MUNICH, BERLIN]);
    step(c.runner);
    expect([...posts(c, a).keys()]).toEqual([BERLIN, MUNICH]);
  }, 120_000);

  test("Attack gathers the spare on the axis, never above 1.5 x the combat width, the rest to the next nearest", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 1);
    const a = placeArmy(c.g, "DEU", BERLIN, 14);
    expect(
      c.l.issue(c.deu, {
        kind: "army_plan",
        army: a.id,
        targets: [WARSAW],
        stance: "balanced",
      }),
    ).toBe(null);
    step(c.runner);
    // Warsaw is one edge from Berlin and Munich, two from Rome.
    expect(a.front).toEqual([BERLIN, MUNICH, ROME]);
    const p = posts(c, a);
    const t = c.l.divisions;
    let widths = 0;
    for (const id of a.divisions) {
      widths += c.l.baseStatsOf(t.rowOf(id)).width;
    }
    const mean = Math.floor(widths / a.divisions.length);
    const sc = c.l.scenario;
    // Berlin faces Warsaw only (one direction), Munich two, Rome one.
    const cap = (r: number, dirs: number) =>
      Math.floor((3 * combatWidth(sc.landOf(r), dirs)) / (2 * mean));
    expect(p.get(BERLIN)).toBe(cap(BERLIN, 1));
    expect(p.get(MUNICH)!).toBeLessThanOrEqual(cap(MUNICH, 2));
    expect(p.get(ROME)!).toBeLessThanOrEqual(cap(ROME, 1));
    // The axis holds more than the region behind it; the overflow reached it.
    expect(p.get(BERLIN)!).toBeGreaterThan(p.get(ROME)!);
    expect(p.get(MUNICH)!).toBeGreaterThan(p.get(ROME)!);
    expect(p.get(ROME)!).toBeGreaterThan(1);
    expect([...p.values()].reduce((s, x) => s + x, 0)).toBe(14);
  }, 120_000);
});

describe("ww7 lane C: rotation", () => {
  test("a tired holder swaps with the freshest spare of its army", async () => {
    const c = await atWar();
    const a = placeArmy(c.g, "DEU", BERLIN, 3);
    // Munich gets the spare division (zone order), Berlin the sole holder:
    // Munich's walk into Berlin (plains) is within 3 days, the way back is not.
    defend(c, a, BERLIN, [MUNICH, BERLIN]);
    step(c.runner);
    for (let i = 0; i < 400; i++) {
      step(c.runner);
      const t = c.l.divisions;
      if (a.divisions.every((id) => t.mode[t.rowOf(id)] === MOVE_NONE)) break;
    }
    const where = new Map<number, number[]>();
    for (const id of a.divisions) {
      const r = c.l.divisions.region[c.l.divisions.rowOf(id)];
      where.set(r, [...(where.get(r) ?? []), id]);
    }
    const sole = [...where].find(([, ids]) => ids.length === 1)!;
    const pair = [...where].find(([, ids]) => ids.length === 2)!;
    const tired = sole[1][0];
    const t = c.l.divisions;
    t.org[t.rowOf(tired)] = 1000;
    finishDay(c.runner, today(c.g) + 1);
    // The tired one leaves its post for the pair's; one of the pair takes it.
    expect(t.dest[t.rowOf(tired)]).toBe(pair[0]);
    const taker = pair[1].find((id) => t.dest[t.rowOf(id)] === sole[0]);
    expect(taker).toBeDefined();
    expect(orgOf(c, taker!)).toBeGreaterThan(orgOf(c, tired));
  }, 120_000);
});

describe("ww7 lane C: the attack", () => {
  test("a stance attacks only when the range clears 1000 permille", async () => {
    // A balanced plan waits for its odds: 1 against 12 holds.
    const hold = await atWar();
    placeArmy(hold.g, "POL", WARSAW, 12);
    const weak = placeArmy(hold.g, "DEU", BERLIN, 1);
    expect(
      hold.l.issue(hold.deu, {
        kind: "army_plan",
        army: weak.id,
        targets: [WARSAW],
        stance: "balanced",
      }),
    ).toBe(null);
    expect(
      hold.l.issue(hold.deu, { kind: "army_execute", army: weak.id, on: true }),
    ).toBe(null);
    expect(battleSeen(hold, WARSAW, 40)).toBe(false);
    // The player's own attack (aggressive) goes in at any odds.
    const order = await atWar();
    placeArmy(order.g, "POL", WARSAW, 12);
    const brave = placeArmy(order.g, "DEU", BERLIN, 1);
    expect(
      order.l.issue(order.deu, {
        kind: "army_attack",
        army: brave.id,
        region: WARSAW,
      }),
    ).toBe(null);
    expect(battleSeen(order, WARSAW, 40)).toBe(true);
    // 12 against 1 clears every stance's bar.
    const go = await atWar();
    placeArmy(go.g, "POL", WARSAW, 1);
    const strong = placeArmy(go.g, "DEU", BERLIN, 12);
    expect(
      go.l.issue(go.deu, {
        kind: "army_plan",
        army: strong.id,
        targets: [WARSAW],
        stance: "careful",
      }),
    ).toBe(null);
    expect(
      go.l.issue(go.deu, { kind: "army_execute", army: strong.id, on: true }),
    ).toBe(null);
    expect(battleSeen(go, WARSAW, 40)).toBe(true);
  }, 120_000);
});

describe("ww7 lane C: gaps between armies and for the screen", () => {
  test("a border region no army covers goes to the nearest army with a division to spare", async () => {
    const c = await atWar();
    const a = placeArmy(c.g, "DEU", BERLIN, 2);
    const b = placeArmy(c.g, "DEU", ROME, 2);
    defend(c, a, BERLIN, [BERLIN]);
    defend(c, b, ROME, [ROME]);
    finishDay(c.runner, today(c.g) + 1);
    // Munich is between them, one edge from each: the smaller army id takes it.
    expect(a.id).toBeLessThan(b.id);
    expect(a.front).toEqual([BERLIN, MUNICH]);
    expect(b.front).toEqual([ROME]);
    expect(posts(c, a).get(MUNICH)).toBe(1);
  }, 120_000);

  test("with no division to spare it stays a gap, and the screen is told", async () => {
    const c = await atWar();
    const a = placeArmy(c.g, "DEU", BERLIN, 1);
    const b = placeArmy(c.g, "DEU", ROME, 1);
    defend(c, a, BERLIN, [BERLIN]);
    defend(c, b, ROME, [ROME]);
    finishDay(c.runner, today(c.g) + 1);
    expect(a.front).toEqual([BERLIN]);
    expect(b.front).toEqual([ROME]);
    const cl = c.l.country(c.deu)!;
    expect(c.l.countryDetail(cl).gaps).toEqual([MUNICH]);
    // A division on its way there closes it.
    const other = placeArmy(c.g, "DEU", BERLIN, 1);
    expect(
      c.l.issue(c.deu, { kind: "army_move", army: other.id, region: MUNICH }),
    ).toBe(null);
    step(c.runner);
    expect(c.l.countryDetail(cl).gaps).toBeUndefined();
  }, 120_000);
});

describe("ww7 lane C: the odds for the screen", () => {
  test("a human plan army has [from, to, winPct] per zone region", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 2);
    placeArmy(c.g, "POL", KRAKOW, 2);
    const a = placeArmy(c.g, "DEU", BERLIN, 6);
    expect(
      c.l.issue(c.deu, {
        kind: "army_plan",
        army: a.id,
        targets: [WARSAW],
        stance: "balanced",
      }),
    ).toBe(null);
    step(c.runner);
    const odds = c.l.armySummary(a).mine!.odds!;
    expect(odds.length).toBeGreaterThan(0);
    for (const [from, to, pct] of odds) {
      expect(a.front).toContain(from);
      expect([WARSAW, KRAKOW]).toContain(to);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
    // A Defend army has none.
    const d = placeArmy(c.g, "DEU", BERLIN, 2);
    defend(c, d);
    step(c.runner);
    expect(c.l.armySummary(d).mine!.odds).toBeUndefined();
  }, 120_000);
});

describe("ww7 lane C: a restore mid-plan", () => {
  test("the copy runs on exactly like the game", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 2);
    placeArmy(c.g, "POL", KRAKOW, 2);
    const a = placeArmy(c.g, "DEU", BERLIN, 9);
    const b = placeArmy(c.g, "DEU", ROME, 3);
    defend(c, b, ROME, [ROME]);
    expect(
      c.l.issue(c.deu, {
        kind: "army_plan",
        army: a.id,
        targets: [WARSAW],
        stance: "aggressive",
      }),
    ).toBe(null);
    expect(
      c.l.issue(c.deu, { kind: "army_execute", army: a.id, on: true }),
    ).toBe(null);
    finishDay(c.runner, today(c.g) + 1);
    step(c.runner, 5);
    const copy = await wwRestore(c.runner, DEU_POL);
    expect(gameHash(copy)).toBe(gameHash(c.runner));
    for (let i = 0; i < 60; i++) {
      step(c.runner);
      step(copy);
      expect(gameHash(copy)).toBe(gameHash(c.runner));
    }
    const la = land(copy.game).armies.get(a.id)!;
    expect(la.front).toEqual(a.front);
    expect(la.order).toEqual(a.order);
  }, 120_000);
});
