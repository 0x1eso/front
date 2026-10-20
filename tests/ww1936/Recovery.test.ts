// World War 1936 P2 Task 4: org recovery, entrenchment and HP losses (P2
// spec §9.8, §5.5). The lane's functions are called directly on a cleared
// board of a test-map game (no tick runs between the calls).
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  groundSlotOf,
  MOVE_ADVANCE,
  MOVE_RETREAT,
  MOVE_WALK,
  SupportId,
  traitBit,
  WW_ROUND_HOUR_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { Game } from "@openfront/engine/game/Game";
import {
  applyHpLoss,
  dailyEntrench,
  stepRecovery,
} from "@openfront/engine/ww1936/land/Battles";
import { startHopInto } from "@openfront/engine/ww1936/land/Movement";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  withTestPolitics,
  wwRunner,
} from "./util";

const BERLIN = 3;
const WARSAW = 6;

/** Germany and Poland human, the board cleared, plenty of men and equipment. */
async function board() {
  const runner = await wwRunner({}, [
    { clientID: HUMAN, country: "DEU" },
    { clientID: "HUMAN002", country: "POL" },
  ]);
  const g = runner.game;
  clearLand(g);
  for (const tag of ["DEU", "POL"] as const) {
    const ce = land(g).econ.country(byTag(g, tag).smallID())!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
    ce.manpower += 1_000_000;
  }
  return {
    g,
    l: land(g),
    deu: byTag(g, "DEU").smallID(),
    pol: byTag(g, "POL").smallID(),
  };
}

/** A template of the country's own (nine infantry and these companies); its id. */
function template(
  g: Game,
  tag: "DEU" | "POL",
  support: SupportId[],
  battalions: BattalionId[] = new Array<BattalionId>(9).fill("infantry"),
): number {
  const cl = land(g).country(byTag(g, tag).smallID())!;
  const id = cl.nextTemplateId++;
  cl.templates.push({ id, key: "", def: { name: "t", battalions, support } });
  return id;
}

const first = (l: WwLand, a: Army) => l.divisions.rowOf(a.divisions[0]);

/** Calls stepRecovery until the division is at full org; the calls it took. */
function ticksToFull(l: WwLand, r: number): number {
  let n = 0;
  while (l.divisions.org[r] < l.orgMaxOf(r)) {
    stepRecovery(l);
    expect(++n).toBeLessThan(1000);
  }
  return n;
}

/** Recovery a tick at full supply: 0.3 an hour of 1.829 hours (spec §9.8), milli. */
const BASE = Math.floor((300 * WW_ROUND_HOUR_MILLI) / 1000);

// P3: the P1/P2 numbers, not the 1936 politics content (plan Task 1).
withTestPolitics();

describe("World War 1936 P2: org recovery and entrenchment (spec §9.8)", () => {
  test("org recovers 0 → 60 in about 15 days", async () => {
    const { g, l } = await board();
    const a = placeArmy(g, "POL", WARSAW, 1);
    const r = first(l, a);
    expect(l.orgMaxOf(r)).toBe(60_000);
    expect(l.divisions.supply[r]).toBe(1000);
    l.divisions.org[r] = 0;
    stepRecovery(l);
    expect(l.divisions.org[r]).toBe(BASE);
    l.divisions.org[r] = 0;
    // 548 a tick: 110 ticks, 14.7 days of 7.5 ticks.
    expect(ticksToFull(l, r)).toBe(Math.ceil(60_000 / BASE));
    expect(Math.ceil(60_000 / BASE)).toBe(110);
    // Never past the maximum.
    stepRecovery(l);
    expect(l.divisions.org[r]).toBe(60_000);
  }, 60_000);

  test("an organizer and a signal company speed it up; supply slows it", async () => {
    const { g, l, deu } = await board();
    const a = placeArmy(g, "DEU", BERLIN, 1, template(g, "DEU", ["signal"]));
    const r = first(l, a);
    const cl = l.country(deu)!;
    const gen = cl.generals[0];
    gen.traits |= traitBit("organizer");
    gen.army = a.id;
    a.general = gen.id;
    l.divisions.org[r] = 0;
    stepRecovery(l);
    // +20% organizer, +10% signal company.
    expect(l.divisions.org[r]).toBe(Math.floor((BASE * 130) / 100));
    l.divisions.org[r] = 0;
    l.divisions.supply[r] = 500;
    stepRecovery(l);
    expect(l.divisions.org[r]).toBe(
      Math.floor((Math.floor((BASE * 130) / 100) * 500) / 1000),
    );
  }, 60_000);

  test("half while walking", async () => {
    const { g, l } = await board();
    const a = placeArmy(g, "POL", WARSAW, 1);
    const r = first(l, a);
    l.divisions.org[r] = 0;
    startHopInto(l, r, 7, MOVE_WALK);
    stepRecovery(l);
    expect(l.divisions.org[r]).toBe(Math.floor(BASE / 2));
  }, 60_000);

  test("none while encircled, in battle, retreating or advancing", async () => {
    const { g, l } = await board();
    const a = placeArmy(g, "POL", WARSAW, 4);
    const t = l.divisions;
    const [enc, battle, retreat, advance] = a.divisions.map((id) =>
      t.rowOf(id),
    );
    for (const r of [enc, battle, retreat, advance]) t.org[r] = 0;
    t.encircled[enc] = 1;
    t.battle[battle] = 7;
    startHopInto(l, retreat, 7, MOVE_RETREAT);
    startHopInto(l, advance, 7, MOVE_ADVANCE);
    for (let i = 0; i < 20; i++) stepRecovery(l);
    expect([enc, battle, retreat, advance].map((r) => t.org[r])).toEqual([
      0, 0, 0, 0,
    ]);
  }, 60_000);

  test("entrenchment grows every three days up to the cap", async () => {
    const { g, l, deu, pol } = await board();
    const t = l.divisions;
    // Poland's infantry: no engineers, a cap of 5.
    const p = first(l, placeArmy(g, "POL", WARSAW, 1));
    const days = (id: number, n: number) => {
      for (let i = 0; i < n; i++) dailyEntrench(l, id);
    };
    days(pol, 2);
    expect([t.stillDays[p], t.entrench[p]]).toEqual([2, 0]);
    days(pol, 1);
    expect(t.entrench[p]).toBe(1);
    days(pol, 12);
    expect(t.entrench[p]).toBe(5);
    days(pol, 15);
    expect(t.entrench[p]).toBe(5);
    // Germany's infantry has engineers: up to 10.
    const d = first(l, placeArmy(g, "DEU", BERLIN, 1));
    days(deu, 30);
    expect(t.entrench[d]).toBe(10);
    days(deu, 30);
    expect(t.entrench[d]).toBe(10);
    // A defensive general: two levels every three days.
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const gen = l.country(deu)!.generals[1];
    gen.traits |= traitBit("defensive_doctrine");
    a.general = gen.id;
    gen.army = a.id;
    days(deu, 3);
    expect(t.entrench[first(l, a)]).toBe(2);
    // On the move: none.
    startHopInto(l, d, 4, MOVE_WALK);
    days(deu, 1);
    expect([t.stillDays[d], t.entrench[d]]).toEqual([0, 0]);
  }, 60_000);
});

describe("World War 1936 P2: HP losses (spec §5.5)", () => {
  test("HP loss takes men and equipment by the same share; 20% of the men come back", async () => {
    const { g, l, pol } = await board();
    const r = first(l, placeArmy(g, "POL", WARSAW, 1));
    const t = l.divisions;
    const ce = l.econ.country(pol)!;
    const cl = l.country(pol)!;
    const rifles = groundSlotOf(equipKey("infantry_equipment", 1));
    expect([t.men[r], t.equipOf(r)[rifles]]).toEqual([9000, 900]);
    const hp = l.statsOf(r).hpMilli;
    expect(hp).toBe(225_000);
    const [manpower, casualties, today] = [
      ce.manpower,
      ce.casualties,
      cl.casualtiesToday,
    ];
    // A tenth of its HP.
    applyHpLoss(l, r, hp / 10);
    expect([t.men[r], t.equipOf(r)[rifles]]).toEqual([8100, 810]);
    expect(ce.manpower - manpower).toBe(180);
    expect(cl.casualtiesToday - today).toBe(900);
    // The dead leave the recruitable pool for good (P1 casualties).
    expect(ce.casualties - casualties).toBe(720);
    expect(l.statsOf(r).hpMilli).toBe(Math.floor((hp * 9) / 10));
    // The loss is linear in the damage: ten hundredths make another tenth.
    for (let i = 0; i < 10; i++) applyHpLoss(l, r, hp / 100);
    expect([t.men[r], t.equipOf(r)[rifles]]).toEqual([7200, 720]);
    // Fractions carry (milli-men, milli-units).
    applyHpLoss(l, r, 13);
    expect(t.men[r]).toBe(7200);
    expect(t.lossMen[r]).toBeGreaterThan(0);
  }, 60_000);

  test("a field hospital brings half of them back", async () => {
    const { g, l, pol } = await board();
    const tpl = template(g, "POL", ["field_hospital"]);
    const r = first(l, placeArmy(g, "POL", WARSAW, 1, tpl));
    const ce = l.econ.country(pol)!;
    const [manpower, casualties] = [ce.manpower, ce.casualties];
    const lost = l.divisions.men[r] / 10;
    applyHpLoss(l, r, l.statsOf(r).hpMilli / 10);
    expect(ce.manpower - manpower).toBe(lost / 2);
    expect(ce.casualties - casualties).toBe(lost / 2);
  }, 60_000);

  test("a handful of men left is wiped out by any hit", async () => {
    const { g, l, pol } = await board();
    const a = placeArmy(g, "POL", WARSAW, 1);
    const [id] = a.divisions;
    const r = l.divisions.rowOf(id);
    // 5 of 9,000 men: under a thousandth, no HP to count in.
    l.setMen(r, 5);
    expect(l.statsOf(r).hpMilli).toBe(0);
    const today = l.country(pol)!.casualtiesToday;
    applyHpLoss(l, r, 1);
    expect(l.divisions.rowOf(id)).toBe(-1);
    expect(l.country(pol)!.casualtiesToday - today).toBe(5);
    // No damage, no loss.
    const [other] = placeArmy(g, "POL", WARSAW, 1).divisions;
    const o = l.divisions.rowOf(other);
    l.setMen(o, 5);
    applyHpLoss(l, o, 0);
    expect(l.divisions.men[o]).toBe(5);
  }, 60_000);

  test("a division that loses all its men is destroyed", async () => {
    const { g, l, pol } = await board();
    const a = placeArmy(g, "POL", WARSAW, 1);
    const [id] = a.divisions;
    const r = l.divisions.rowOf(id);
    const today = l.country(pol)!.casualtiesToday;
    applyHpLoss(l, r, l.statsOf(r).hpMilli);
    expect(l.divisions.rowOf(id)).toBe(-1);
    expect(l.armies.has(a.id)).toBe(false);
    expect(l.country(pol)!.casualtiesToday - today).toBe(9000);
  }, 60_000);
});
