// World War 1936: easy naval invasions for human countries (owner brief
// 2026-10-30) on the test map ww1936sea — a human Britain against a human
// Italy at war. One order (the army marches to the nearest port with a
// route, split to the invasion limit), 20/10/5 days of preparation, a
// launch by itself with no supremacy gate, capped losses at sea, a −40%
// landing. The AI keeps spec §11's rules (Invasions.test.ts pins them).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type BattalionId,
  GROUND_EQUIPMENT,
  MOVE_RAIL,
  MOVE_WALK,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  INVASION_STATES,
  WW_EASY_INVASION_LOSS_CAP_PM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  crossingDays,
  easyCrossingLossPm,
  easyInterceptLossPm,
  easyInvasionPrepDays,
  invasionPrepDays,
  landingBp,
} from "@openfront/engine-lib/ww1936/InvasionRules";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import type { Game } from "@openfront/engine/game/Game";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import {
  amphibiousModsFor,
  dailyInvasions,
  invasionLaunchBlock,
  landInvasion,
} from "@openfront/engine/ww1936/navy/Invasions";
import { dailyVoyages } from "@openfront/engine/ww1936/navy/SeaTransfer";
import type { WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { diffSnapshots } from "../util/Snapshot";
import { REGION, SEA, SR, TAG_ID } from "./seaFixture";
import {
  byTag,
  clearLand,
  gameHash,
  HUMAN,
  land,
  placeArmy,
  step,
  takeRegion,
  warAfterPrep,
  withTestPolitics,
  wwRestore,
  wwRunner,
} from "./util";

withTestPolitics();

const GBR_ITA = [
  { clientID: HUMAN, country: "GBR" as const },
  { clientID: "HUMAN002", country: "ITA" as const },
];
const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;
const st = (s: (typeof INVASION_STATES)[number]) => INVASION_STATES.indexOf(s);

function stockUp(g: Game, tag: CountryTag): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of GROUND_EQUIPMENT) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

function template(g: Game, tag: CountryTag, battalions: BattalionId[]): number {
  const cl = land(g).country(byTag(g, tag).smallID())!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: { name: "t", battalions, support: [] },
  });
  return id;
}

async function atWar(extra: CountryTag[] = []) {
  const runner = await wwRunner({}, GBR_ITA, SEA.map);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "ITA");
  for (const tag of extra) {
    const ww = g.worldWar()!;
    ww.setWar(GBR, byTag(g, tag).smallID(), g.ticks(), { kind: "declare" });
  }
  clearLand(g);
  stockUp(g, "GBR");
  stockUp(g, "ITA");
  const ww = g.worldWar()!;
  return { runner, g, ww, navy: ww.navy, l: ww.land };
}

function invade(navy: WwNavy, owner: number, army: number, target: number) {
  return navy.issue(
    owner,
    { kind: "army_invade", army, target },
    navy.mg.ticks(),
  );
}

/** The owner's days of invasions, called directly (the clock calls the same). */
function days(navy: WwNavy, owner: number, n: number): void {
  const day = navy.day(navy.mg.ticks());
  for (let i = 0; i < n; i++) dailyInvasions(navy, owner, day, navy.mg.ticks());
}

/** Nobody but Italy holds the sea between London and Rome. */
function italianSea(navy: WwNavy): void {
  const it = navy.sideOf(ITA);
  for (const sr of [SR.approaches, SR.central]) {
    navy.setSupremacy(sr, new Map([[it, 1000]]));
  }
}

describe("easy naval invasions (human countries)", () => {
  it("the rules: 20 / 10 / 5 days, losses below 50% capped at half, −40% / −20%", () => {
    const s = emptyStats();
    const none = new Set<never>();
    expect(easyInvasionPrepDays(s, none, false, false, 301)).toBe(20);
    expect(easyInvasionPrepDays(s, none, true, false, 301)).toBe(10);
    expect(easyInvasionPrepDays(s, none, true, false, 300)).toBe(5);
    expect(easyInvasionPrepDays(s, none, false, false, 120)).toBe(5);
    // The AI's modifiers apply on top: −20% for landing craft, the stat.
    const lc = new Set(["landing_craft_1" as const]);
    expect(easyInvasionPrepDays(s, lc, false, false, 900)).toBe(16);
    expect(
      easyInvasionPrepDays(
        { ...s, invasionPrepPct: -50 },
        none,
        false,
        false,
        900,
      ),
    ).toBe(10);
    expect(invasionPrepDays(s, none, false, false)).toBe(60);
    // Spec §10.4's formula, below 40% too; nothing at 50% or with no enemy.
    expect(easyInterceptLossPm(500, 1000, 0)).toBe(0);
    expect(easyInterceptLossPm(450, 550, 0)).toBe(10);
    expect(easyInterceptLossPm(300, 700, 0)).toBe(40);
    expect(easyInterceptLossPm(0, 1000, 0)).toBe(100);
    expect(easyInterceptLossPm(0, 0, 0)).toBe(0);
    expect(easyInterceptLossPm(0, 1000, 450)).toBe(50);
    expect(easyInterceptLossPm(0, 1000, WW_EASY_INVASION_LOSS_CAP_PM)).toBe(0);
    // A day at 12 knots is 533 km: 2,000 km at 0% loses 100‰ × 3.75 days.
    expect(crossingDays(2000, 0)).toBe(4);
    expect(easyCrossingLossPm([{ km: 2000, lossPm: 100 }], 0)).toBe(374);
    expect(easyCrossingLossPm([{ km: 9000, lossPm: 100 }], 0)).toBe(500);
    // A crossing shorter than a day waits the day out at the coast.
    expect(easyCrossingLossPm([{ km: 100, lossPm: 40 }], 0)).toBe(40);
    expect(landingBp(false, none, true)).toBe(4000);
    expect(landingBp(true, none, true)).toBe(2000);
    expect(landingBp(false, none, false)).toBe(7000);
  });

  it("one order: the march to the nearest port, preparation, the launch by itself, the landing", async () => {
    const { runner, g, navy, l } = await atWar();
    // Britain holds Paris and Lyon (a port, naval base 1, 300 km to Rome).
    takeRegion(g, REGION.paris, "GBR");
    takeRegion(g, REGION.lyon, "GBR");
    const a = placeArmy(g, "GBR", REGION.paris, 2);
    italianSea(navy);
    expect(invade(navy, GBR, a.id, REGION.rome)).toBeNull();
    const inv = navy.invasions.get(a.id)!;
    expect([inv.easy, inv.state, inv.from, inv.prepDays]).toEqual([
      true,
      st("moving"),
      REGION.lyon,
      5,
    ]);
    expect(a.order.kind).toBe("move");
    expect(a.order.to).toBe(REGION.lyon);
    expect([MOVE_WALK, MOVE_RAIL]).toContain(a.order.mode);
    let sawPrep = false;
    let sailed = false;
    for (let n = 0; n < 3000 && l.controller[REGION.rome] !== GBR; n++) {
      step(runner);
      const x = navy.invasions.get(a.id);
      if (x?.state === st("preparing")) sawPrep = true;
      if (x?.state === st("sailing")) sailed = true;
    }
    expect(sawPrep).toBe(true);
    // It sailed with Italy holding the whole route (no gate), by itself.
    expect(sailed).toBe(true);
    expect(navy.supremacy(navy.sideOf(GBR), SR.central)).toBeLessThan(500);
    expect(l.controller[REGION.rome]).toBe(GBR);
  }, 120_000);

  it("too many divisions: the best-organised limit's worth go, the rest stay", async () => {
    const { g, navy, l } = await atWar();
    const spy = vi.spyOn(g, "displayMessage");
    const a = placeArmy(g, "GBR", REGION.london, 12);
    const t = l.divisions;
    // The two lowest-id divisions are worn: they stay.
    for (const id of a.divisions.slice(0, 2)) t.org[t.rowOf(id)] = 1;
    const tired = a.divisions.slice(0, 2);
    const next = l.nextArmyId;
    expect(invade(navy, GBR, a.id, REGION.rome)).toBeNull();
    const b = l.armies.get(next)!;
    expect(b.divisions).toHaveLength(10);
    expect(l.armies.get(a.id)!.divisions).toEqual(tired);
    expect(navy.invasions.has(a.id)).toBe(false);
    const inv = navy.invasions.get(b.id)!;
    expect([inv.splitFrom, inv.state, b.order.kind]).toEqual([
      a.id,
      st("preparing"),
      "invade",
    ]);
    expect(
      spy.mock.calls
        .filter((c) => c[0] === "events_display.ww1936_invasion_split")
        .map((c) => c[4]),
    ).toEqual([{ region: REGION.rome, n: 10, rest: 2 }]);
  });

  it("20 days over a long route, 10 with marines; refusals say why", async () => {
    const { g, navy } = await atWar(["SUN", "POL"]);
    // Poland holds the narrows: Malta → Kiev goes round by the west, 540 km.
    const a = placeArmy(g, "GBR", REGION.malta, 1);
    expect(invade(navy, GBR, a.id, REGION.kiev)).toBeNull();
    expect(navy.invasions.get(a.id)!.prepDays).toBe(20);
    const marines = template(g, "GBR", new Array(6).fill("marine"));
    const m = placeArmy(g, "GBR", REGION.malta, 1, marines);
    expect(invade(navy, GBR, m.id, REGION.kiev)).toBeNull();
    expect(navy.invasions.get(m.id)!.prepDays).toBe(10);
    // Not a coast, not an enemy's; no port of ours reached over land.
    const p = placeArmy(g, "GBR", REGION.london, 1);
    expect(invade(navy, GBR, p.id, REGION.berlin)).toBe("not_coastal");
    expect(invade(navy, GBR, p.id, REGION.lyon)).toBe("not_at_war");
    // Moscow: no region of our side next to it.
    const lost = placeArmy(g, "GBR", REGION.moscow, 1);
    expect(invade(navy, GBR, lost.id, REGION.rome)).toBe("no_invasion_port");
  });

  it("low supremacy: no refusal, losses at sea capped at half, no turning back; the landing at −40%", async () => {
    const { g, navy, l } = await atWar();
    placeArmy(g, "ITA", REGION.rome, 2);
    const a = placeArmy(g, "GBR", REGION.london, 1);
    italianSea(navy);
    expect(invade(navy, GBR, a.id, REGION.rome)).toBeNull();
    const inv = navy.invasions.get(a.id)!;
    expect(invasionLaunchBlock(navy, a.id)).toBe("invasion_not_ready");
    days(navy, GBR, inv.prepDays);
    expect(inv.state).toBe(st("sailing"));
    const v = navy.voyages.get(inv.voyage)!;
    const t = l.divisions;
    const row = () => t.rowOf(a.divisions[0]);
    // At 0% each day takes 10%, until half is gone.
    const day = navy.day(g.ticks());
    for (let i = 0; i < 8; i++) dailyVoyages(navy, GBR, day + i);
    expect(inv.lossPm).toBe(WW_EASY_INVASION_LOSS_CAP_PM);
    const after = l.strengthOf(row());
    expect(after).toBeGreaterThanOrEqual(500);
    expect(after).toBeLessThan(1000);
    dailyVoyages(navy, GBR, day + 9);
    expect(l.strengthOf(row())).toBe(after);
    days(navy, GBR, 1);
    expect([inv.state, v.aborting]).toEqual([st("sailing"), false]);
    landInvasion(navy, v.id, g.ticks());
    expect(inv.state).toBe(st("landing"));
    expect(amphibiousModsFor(navy, REGION.rome, row())?.attackBp).toBe(-4000);
  });

  it("an AI country keeps spec §11: the port and supremacy gates, 60 days, −70%", async () => {
    const { g, ww, navy, l } = await atWar();
    placeArmy(g, "ITA", REGION.rome, 2);
    // The human steps out: the AI runs Britain now.
    ww.endgame.setControl(HUMAN, 0);
    expect(navy.easyInvasion(GBR)).toBe(false);
    takeRegion(g, REGION.paris, "GBR");
    const out = placeArmy(g, "GBR", REGION.paris, 1);
    expect(invade(navy, GBR, out.id, REGION.rome)).toBe("not_in_port");
    const a = placeArmy(g, "GBR", REGION.london, 1);
    italianSea(navy);
    expect(invade(navy, GBR, a.id, REGION.rome)).toBeNull();
    const inv = navy.invasions.get(a.id)!;
    const ce = navy.econ.country(GBR)!;
    expect(inv.easy).toBe(false);
    expect(inv.prepDays).toBe(
      invasionPrepDays(ce.stats, ce.researched, false, false),
    );
    expect(inv.prepDays).toBeGreaterThanOrEqual(30);
    days(navy, GBR, inv.prepDays);
    expect(inv.state).toBe(st("ready"));
    expect(invasionLaunchBlock(navy, a.id)).toBe("naval_supremacy_low");
    const gb = navy.sideOf(GBR);
    navy.setSupremacy(SR.approaches, new Map([[gb, 1000]]));
    navy.setSupremacy(SR.central, new Map([[gb, 1000]]));
    days(navy, GBR, 1);
    expect(inv.state).toBe(st("sailing"));
    landInvasion(navy, inv.voyage, g.ticks());
    const r = l.divisions.rowOf(a.divisions[0]);
    expect(amphibiousModsFor(navy, REGION.rome, r)?.attackBp).toBe(-7000);
  });

  it("control at the order decides: a takeover flips the rules for new orders", async () => {
    const { g, ww, navy } = await atWar();
    const a = placeArmy(g, "GBR", REGION.london, 1);
    expect(invade(navy, GBR, a.id, REGION.rome)).toBeNull();
    expect(navy.invasions.get(a.id)!.easy).toBe(true);
    // The human takes over France: Britain is the AI's now, France theirs.
    const fra = byTag(g, "FRA").smallID();
    ww.endgame.setControl(HUMAN, fra);
    expect([navy.easyInvasion(GBR), navy.easyInvasion(fra)]).toEqual([
      false,
      true,
    ]);
    // The standing order keeps its rules; a new one takes the AI's.
    expect(navy.invasions.get(a.id)!.easy).toBe(true);
    const b = placeArmy(g, "GBR", REGION.london, 1);
    expect(invade(navy, GBR, b.id, REGION.rome)).toBeNull();
    expect(navy.invasions.get(b.id)!.easy).toBe(false);
  });

  it("a game restored mid-sailing goes on the same", async () => {
    const { runner, g, navy } = await atWar();
    const a = placeArmy(g, "GBR", REGION.london, 2);
    italianSea(navy);
    expect(invade(navy, GBR, a.id, REGION.rome)).toBeNull();
    const inv = navy.invasions.get(a.id)!;
    const ww = g.worldWar()!;
    const until = dayStartTick(ww.day(g.ticks()) + 30, ww.prepEndTick());
    while (inv.state !== st("sailing") && g.ticks() < until) step(runner);
    expect(inv.state).toBe(st("sailing"));
    const b = await wwRestore(runner, GBR_ITA, SEA.map);
    const nb = b.game.worldWar()!.navy;
    expect(nb.invasions.get(a.id)).toEqual(inv);
    for (let i = 0; i < 40; i++) {
      step(runner);
      step(b);
      expect(gameHash(b)).toBe(gameHash(runner));
    }
    expect(
      diffSnapshots(snapshotGame(runner.game), snapshotGame(b.game)),
    ).toEqual([]);
    // The hash sees the easy fields.
    const h0 = navy.hash();
    const x = navy.invasions.get(a.id) ?? inv;
    navy.invasions.set(a.id, { ...x, lossPm: x.lossPm + 1 });
    expect(navy.hash()).not.toBe(h0);
  }, 120_000);
});
