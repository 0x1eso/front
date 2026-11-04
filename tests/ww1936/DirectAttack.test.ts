// ww42: a human's direct attack (army_direct): a press means go. Odds, org,
// the favourable-odds toggle, the whole army, the border choice, refusals,
// the daily check, the last target and [계속 진격], and a restore mid-attack.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  DIRECT_ADVANCE,
  DIRECT_ALL_IN,
  DIRECT_FAVORABLE,
  ROLE_RECOVER,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  byTag,
  clearLand,
  gameHash,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  warAfterPrep,
  wwRestore,
  wwRunner,
} from "./util";

const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: "HUMAN002", country: "POL" as const },
];
// Berlin 3, Munich 4, Rome 5 (Axis) face Warsaw 6 and Krakow 7 (Poland).
const BERLIN = 3;
const MUNICH = 4;
const WARSAW = 6;
const KRAKOW = 7;

const today = (g: Game) => g.worldWar()!.day(g.ticks());
function finishDay(runner: GameRunner, d: number) {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}

async function atWar() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  const l = land(g);
  return {
    runner,
    g,
    l,
    deu: byTag(g, "DEU").smallID(),
    pol: byTag(g, "POL").smallID(),
  };
}
type Ctx = Awaited<ReturnType<typeof atWar>>;

function battleSeen(c: Ctx, region: number, ticks: number): boolean {
  let seen = false;
  for (let i = 0; i < ticks; i++) {
    step(c.runner);
    if (c.l.battles.has(region)) seen = true;
  }
  return seen;
}
const go = (c: Ctx, army: number, o: object) =>
  c.l.issue(c.deu, { kind: "army_direct", army, ...o } as never, "player");
const orgSet = (c: Ctx, id: number, pct: number) => {
  const r = c.l.divisions.rowOf(id);
  c.l.divisions.org[r] = Math.floor((c.l.orgMaxOf(r) * pct) / 100);
};

describe("ww42: direct attack", () => {
  test("goes at once at low odds, no waiting", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 12);
    const a = placeArmy(c.g, "DEU", BERLIN, 1);
    expect(go(c, a.id, { targets: [WARSAW] })).toBe(null);
    expect(a.order).toMatchObject({
      kind: "plan",
      executing: true,
      direct: true,
    });
    step(c.runner, 2);
    expect(c.l.armySummary(a).mine!.direct!.atk.length).toBeGreaterThan(0);
    expect(battleSeen(c, WARSAW, 20)).toBe(true);
  }, 120_000);

  test("ww46: an empty target is walked into by every free division the same day", async () => {
    const c = await atWar();
    const a = placeArmy(c.g, "DEU", BERLIN, 4);
    orgSet(c, a.divisions[3], 10);
    expect(go(c, a.id, { targets: [WARSAW] })).toBe(null);
    step(c.runner, 2);
    const t = c.l.divisions;
    const toward = a.divisions.filter((id) => {
      const r = t.rowOf(id);
      return t.dest[r] === WARSAW || t.region[r] === WARSAW;
    });
    // Both divisions the layout put in Berlin (next to Warsaw) go together on
    // the first day, not one after the other; Munich keeps its cover and the
    // one under 30 % org stays to recover.
    expect(toward.length).toBe(2);
    expect(toward).not.toContain(a.divisions[3]);
  }, 120_000);

  test("org: 30 % joins, below recovers first and joins by itself", async () => {
    const low = await atWar();
    placeArmy(low.g, "POL", WARSAW, 1);
    const a = placeArmy(low.g, "DEU", BERLIN, 1);
    orgSet(low, a.divisions[0], 20);
    expect(go(low, a.id, { targets: [WARSAW] })).toBe(null);
    expect(battleSeen(low, WARSAW, 3)).toBe(false);
    expect(low.l.armySummary(a).mine!.direct!.rec).toBe(1);
    expect(low.l.armySummary(a).mine!.direct!.why).toBe(2);
    // Recovered past 30 %: the next day it goes in.
    orgSet(low, a.divisions[0], 35);
    finishDay(low.runner, today(low.g) + 1);
    expect(battleSeen(low, WARSAW, 12)).toBe(true);
  }, 120_000);

  test("a division that left a battle rejoins only at 60 % org (회복 중), a fresh one at 30 %", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 1);
    const a = placeArmy(c.g, "DEU", BERLIN, 1);
    orgSet(c, a.divisions[0], 40);
    c.l.divisions.role[c.l.divisions.rowOf(a.divisions[0])] = ROLE_RECOVER;
    expect(go(c, a.id, { targets: [WARSAW] })).toBe(null);
    expect(battleSeen(c, WARSAW, 3)).toBe(false);
    expect(c.l.armySummary(a).mine!.direct!.rec).toBe(1);
    orgSet(c, a.divisions[0], 65);
    finishDay(c.runner, today(c.g) + 1);
    expect(battleSeen(c, WARSAW, 12)).toBe(true);
    // The same 40 % without the mark is a fresh division and goes in.
    const f = await atWar();
    placeArmy(f.g, "POL", WARSAW, 1);
    const b = placeArmy(f.g, "DEU", BERLIN, 1);
    orgSet(f, b.divisions[0], 40);
    expect(go(f, b.id, { targets: [WARSAW] })).toBe(null);
    expect(battleSeen(f, WARSAW, 6)).toBe(true);
  }, 120_000);

  test("[유리할 때만 공격] waits with the true ratio and goes once it is off", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 12);
    const a = placeArmy(c.g, "DEU", BERLIN, 1);
    expect(go(c, a.id, { targets: [WARSAW], favorable: true })).toBe(null);
    expect(battleSeen(c, WARSAW, 40)).toBe(false);
    const v = c.l.armySummary(a).mine!.direct!;
    expect(v.flags & DIRECT_FAVORABLE).toBe(DIRECT_FAVORABLE);
    expect(v.why).toBe(1);
    expect(v.ratioPm).toBeGreaterThanOrEqual(0);
    expect(v.ratioPm).toBeLessThan(1000);
    // Settings alone: no new order, the attack stays, and it goes now.
    expect(go(c, a.id, { favorable: false })).toBe(null);
    expect(a.order.direct).toBe(true);
    expect(battleSeen(c, WARSAW, 40)).toBe(true);
  }, 120_000);

  test("남김 keeps every zone region covered, 전부 공격 sends all to the axis", async () => {
    const keep = await atWar();
    // Krakow: Munich is the axis (one edge), Berlin the cover (two).
    placeArmy(keep.g, "POL", KRAKOW, 1);
    const k = placeArmy(keep.g, "DEU", BERLIN, 6);
    expect(go(keep, k.id, { targets: [KRAKOW] })).toBe(null);
    step(keep.runner);
    const at = (c: Ctx, id: number) =>
      new Set(
        id === 0
          ? []
          : c.l.armies
              .get(id)!
              .divisions.map((d) => c.l.divisions.dest[c.l.divisions.rowOf(d)]),
      );
    expect(k.front).toEqual([MUNICH, BERLIN]);
    for (const f of k.front) expect(at(keep, k.id).has(f)).toBe(true);
    const all = await atWar();
    placeArmy(all.g, "POL", KRAKOW, 1);
    const b = placeArmy(all.g, "DEU", BERLIN, 6);
    expect(go(all, b.id, { targets: [KRAKOW], allIn: true })).toBe(null);
    step(all.runner);
    expect(b.front).toEqual(k.front);
    expect([...at(all, b.id)]).toEqual([MUNICH]);
    expect(b.dflags & DIRECT_ALL_IN).toBe(DIRECT_ALL_IN);
  }, 120_000);

  test("an impossible order is refused and changes nothing", async () => {
    const c = await atWar();
    const a = placeArmy(c.g, "DEU", BERLIN, 2);
    const before = JSON.stringify(a.order);
    expect(go(c, a.id, { targets: [BERLIN] })).toBe("not_at_war");
    expect(go(c, a.id, { targets: [9999] })).toBe("bad_region");
    expect(JSON.stringify(a.order)).toBe(before);
    expect(a.dflags).toBe(0);
  }, 120_000);

  test("a running attack that becomes impossible stops", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 3);
    const a = placeArmy(c.g, "DEU", BERLIN, 1);
    expect(go(c, a.id, { targets: [WARSAW] })).toBe(null);
    // The target passes to a country we are not at war with.
    const third = (["SUN", "FRA", "GBR", "ITA", "JPN", "USA"] as const)
      .map((t) => c.g.worldWar()!.playerOfTag(t))
      .find(
        (p) =>
          p !== null &&
          !c.l.isEnemy(c.deu, p.smallID()) &&
          !c.l.sameSide(c.deu, p.smallID()),
      );
    expect(third).toBeDefined();
    c.l.controller[WARSAW] = third!.smallID();
    finishDay(c.runner, today(c.g) + 1);
    expect(a.order.kind).toBe("front");
    expect(a.order.direct).toBeUndefined();
  }, 120_000);

  test("the last target taken: defend; [계속 진격] takes the next region", async () => {
    const stop = await atWar();
    const a = placeArmy(stop.g, "DEU", BERLIN, 2);
    expect(go(stop, a.id, { targets: [WARSAW] })).toBe(null);
    stop.l.controller[WARSAW] = stop.deu;
    finishDay(stop.runner, today(stop.g) + 1);
    expect(a.order.kind).toBe("front");
    const adv = await atWar();
    const b = placeArmy(adv.g, "DEU", BERLIN, 2);
    expect(go(adv, b.id, { targets: [WARSAW], advance: true })).toBe(null);
    expect(b.dflags & DIRECT_ADVANCE).toBe(DIRECT_ADVANCE);
    adv.l.controller[WARSAW] = adv.deu;
    finishDay(adv.runner, today(adv.g) + 1);
    expect(b.order).toMatchObject({ kind: "plan", direct: true });
    expect(b.order.targets).toEqual([KRAKOW]);
  }, 120_000);

  test("targets are taken in order; empty stops; auto only goes off for a target order", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 1);
    placeArmy(c.g, "POL", KRAKOW, 1);
    const a = placeArmy(c.g, "DEU", BERLIN, 3);
    expect(
      c.l.issue(c.deu, { kind: "army_auto", army: a.id, on: true }, "player"),
    ).toBe(null);
    expect(go(c, a.id, { allIn: true })).toBe(null);
    expect(a.auto).toBe(true);
    expect(go(c, a.id, { targets: [KRAKOW, WARSAW] })).toBe(null);
    expect(a.auto).toBe(false);
    expect(a.order.targets).toEqual([KRAKOW, WARSAW]);
    expect(go(c, a.id, { targets: [] })).toBe(null);
    expect(a.order.kind).toBe("idle");
    expect(a.dflags & DIRECT_ALL_IN).toBe(DIRECT_ALL_IN);
  }, 120_000);

  test("snapshot and restore mid-attack", async () => {
    const c = await atWar();
    placeArmy(c.g, "POL", WARSAW, 3);
    const a = placeArmy(c.g, "DEU", BERLIN, 4);
    expect(
      go(c, a.id, { targets: [WARSAW], favorable: true, advance: true }),
    ).toBe(null);
    finishDay(c.runner, today(c.g) + 1);
    step(c.runner, 5);
    const copy = await wwRestore(c.runner, DEU_POL);
    expect(gameHash(copy)).toBe(gameHash(c.runner));
    for (let i = 0; i < 40; i++) {
      step(c.runner);
      step(copy);
    }
    expect(gameHash(copy)).toBe(gameHash(c.runner));
    const la = land(copy.game).armies.get(a.id)!;
    expect(la.order).toEqual(a.order);
    expect(la.dflags).toBe(a.dflags);
  }, 120_000);
});
