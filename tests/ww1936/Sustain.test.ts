// World War 1936 P2 Task 5: a country's day for its divisions (P2 spec
// §5.3 reinforcement, upgrades and attrition, §5.4 experience and army
// experience, §10 weather). Germany is human; the country's day is called
// directly, on a summer day unless the test is about winter.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  WW_DAY_SPLIT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  groundSlotOf,
  MOVE_NONE,
  MOVE_WALK,
  traitBit,
  WW_ARMY_XP_MAX_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  climateOf,
  WEATHER,
  weatherAt,
} from "@openfront/engine-lib/ww1936/Weather";
import {
  assignGeneral,
  canServe,
} from "@openfront/engine/ww1936/land/GeneralsRun";
import { atSea, liftDivisions } from "@openfront/engine/ww1936/land/SeaLift";
import {
  dailySustain,
  foughtTest,
} from "@openfront/engine/ww1936/land/Sustain";
import {
  byTag,
  clearLand,
  clearStartSetup,
  HUMAN,
  land,
  placeArmy,
  stepTo,
  wwRunner,
} from "./util";

const SUMMER = dayOfDate("1936-06-15");
const WINTER = dayOfDate("1937-01-20");
const BERLIN = 3;
const WARSAW = 6;
/** A round's tick that day `d`'s step counts (lastFight is a tick, Task 11). */
const fightOn = (d: number) => dayStartTick(d, WW_PREP_TICKS) - 1;
const INF1 = equipKey("infantry_equipment", 1);
const INF2 = equipKey("infantry_equipment", 2);
const ART1 = equipKey("artillery", 1);

/** A human country on a blank board with one full division in `region`. */
async function oneDivision(tag: CountryTag = "DEU", region = BERLIN) {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: tag }]);
  const g = runner.game;
  stepTo(runner, WW_PREP_TICKS + 1);
  const l = land(g);
  const id = byTag(g, tag).smallID();
  const ce = l.econ.country(id)!;
  clearStartSetup(l.econ, ce);
  clearLand(g);
  ce.manpower = 100_000;
  ce.stock[INF1] = 10_000;
  ce.stock[ART1] = 1_000;
  ce.stock[equipKey("support_equipment", 1)] = 1_000;
  const a = placeArmy(g, tag, region, 1);
  const r = l.divisions.rowOf(a.divisions[0]);
  return { g, l, id, ce, cl: l.country(id)!, a, r };
}

const slot = (key: number) => groundSlotOf(key);

describe("sustaining divisions (P2 spec §5.3, §5.4)", () => {
  test("reinforcement refills 10% a day at full supply", async () => {
    const { l, id, ce, r } = await oneDivision();
    const t = l.divisions;
    expect(t.supply[r]).toBe(1000);
    l.setMen(r, 5_000);
    l.addEquip(r, slot(INF1), -300);
    l.addEquip(r, slot(ART1), -24);
    const manpower = ce.manpower;
    const rifles = ce.stock[INF1];
    dailySustain(l, id, SUMMER);
    // 10% of 10,500 men, of 900 rifles, of 24 guns (rounded up).
    expect(t.men[r]).toBe(5_000 + 1_050);
    expect(t.equip[r * GROUND_SLOTS + slot(INF1)]).toBe(600 + 90);
    expect(t.equip[r * GROUND_SLOTS + slot(ART1)]).toBe(3);
    expect(ce.manpower).toBe(manpower - 1_050);
    expect(ce.stock[INF1]).toBe(rifles - 90);
    // Half the supply, half the rate; no supply, nothing.
    t.supply[r] = 500;
    dailySustain(l, id, SUMMER + 1);
    expect(t.men[r]).toBe(6_050 + 525);
    t.supply[r] = 0;
    dailySustain(l, id, SUMMER + 2);
    expect(t.men[r]).toBe(6_575 - Math.floor((6_575 * 10) / 1000));
  });

  test("a division on a convoy gets no reinforcement or upgrade until it lands (P4)", async () => {
    const { l, id, ce, r, a } = await oneDivision();
    const t = l.divisions;
    l.setMen(r, 5_000);
    l.addEquip(r, slot(INF1), -300);
    ce.stock[INF2] = 1_000;
    liftDivisions(l, [a.divisions[0]]);
    expect(atSea(l, r)).toBe(true);
    const manpower = ce.manpower;
    const rifles = [ce.stock[INF1], ce.stock[INF2]];
    dailySustain(l, id, SUMMER);
    expect(t.men[r]).toBeLessThanOrEqual(5_000);
    expect(ce.manpower).toBe(manpower);
    expect([ce.stock[INF1], ce.stock[INF2]]).toEqual(rifles);
    expect(t.equip[r * GROUND_SLOTS + slot(INF2)]).toBe(0);
  });

  test("experience dilutes on reinforcement (half with a field hospital)", async () => {
    const { g, l, id, ce, cl, r } = await oneDivision();
    const t = l.divisions;
    t.exp[r] = 600;
    l.setMen(r, 5_000);
    dailySustain(l, id, SUMMER);
    expect(t.exp[r]).toBe(Math.floor((600 * 5_000) / 6_050));
    expect(t.exp[r]).toBe(495);
    // The same division with a field hospital: half the cut.
    ce.addTech("field_hospital");
    cl.armyXpMilli = 100_000;
    expect(
      l.issue(id, {
        kind: "template_save",
        template: 0,
        base: 1,
        name: "With hospital",
        battalions: [...cl.template(1)!.def.battalions],
        support: ["engineer", "recon", "field_hospital"],
      }),
    ).toBeNull();
    const hospital = cl.templates[cl.templates.length - 1].id;
    const a = placeArmy(g, "DEU", BERLIN, 1, hospital);
    const h = l.divisions.rowOf(a.divisions[0]);
    expect(l.baseStatsOf(h).men).toBe(10_800);
    t.exp[h] = 600;
    l.setMen(h, 5_000);
    dailySustain(l, id, SUMMER + 1);
    const diluted = Math.floor((600 * 5_000) / 6_080);
    expect(t.men[h]).toBe(6_080);
    expect(t.exp[h]).toBe(600 - Math.floor((600 - diluted) / 2));
  });

  test("attrition below 50% supply and when encircled", async () => {
    const { l, id, ce, r } = await oneDivision();
    const t = l.divisions;
    const base = r * GROUND_SLOTS;
    // Supply 250: (500 − 250) / 500 × 1% = 0.5% a day.
    t.supply[r] = 250;
    const casualties = ce.casualties;
    dailySustain(l, id, SUMMER);
    expect(t.men[r]).toBe(10_500 - 52);
    expect(t.lossMen[r]).toBe(500);
    expect(t.equip[base + slot(INF1)]).toBe(900 - 4);
    expect(t.lossEq[base + slot(INF1)]).toBe(500);
    // The men lost are dead; the equipment does not come back either.
    expect(ce.casualties).toBe(casualties + 52);
    // The next day reinforcement brings the 52 back (2.5% at most), then
    // the remainders add up: 52.5 + 0.5 men are lost.
    dailySustain(l, id, SUMMER + 1);
    expect(t.men[r]).toBe(10_500 - 53);
    expect(t.lossMen[r]).toBe(0);
    // Encircled: no reinforcement, 1% a day.
    t.supply[r] = 0;
    t.encircled[r] = 1;
    t.lossMen[r] = 0;
    const before = t.men[r];
    const manpower = ce.manpower;
    dailySustain(l, id, SUMMER + 2);
    expect(t.men[r]).toBe(before - Math.floor(before / 100));
    expect(ce.manpower).toBe(manpower);
  });

  test("winter attrition: full on the move, in a battle or short of supply, a quarter at rest", async () => {
    // Warsaw: a continental winter (Berlin's is temperate since Task 11).
    const { l, id, a, r, cl } = await oneDivision("DEU", WARSAW);
    const t = l.divisions;
    const sc = l.scenario;
    const weather = (d: number) =>
      weatherAt(d, sc.latC(WARSAW), sc.landOf(WARSAW), sc.wcell(WARSAW));
    const w = weather(WINTER);
    expect(["snow", "frozen"]).toContain(w);
    const ppm = WEATHER[w].attritionPm * 1000;
    expect(ppm).toBeGreaterThan(0);
    const after = (p: number) => 10_500 - Math.floor((10_500 * p) / 1_000_000);
    // At rest in full supply: a quarter (Task 11, controller ruling 1).
    t.supply[r] = 1000;
    dailySustain(l, id, WINTER);
    expect(t.men[r]).toBe(after(Math.floor((ppm * 25) / 100)));
    // Short of supply: all of it (reinforced back to 10,500 first).
    t.lossMen[r] = 0;
    t.supply[r] = 999;
    dailySustain(l, id, WINTER + 1);
    const w1 = weather(WINTER + 1);
    expect(t.men[r]).toBe(after(WEATHER[w1].attritionPm * 1000));
    // On the move: all of it (round 2: the mode branch).
    t.lossMen[r] = 0;
    t.supply[r] = 1000;
    t.mode[r] = MOVE_WALK;
    dailySustain(l, id, WINTER + 3);
    t.mode[r] = MOVE_NONE;
    const w3 = weather(WINTER + 3);
    expect(t.men[r]).toBe(after(WEATHER[w3].attritionPm * 1000));
    // In a battle: all of it, halved by a winter specialist at the head.
    // One who serves and is no field marshal (K5's start rows; P6 lane D:
    // a marshal leads no army).
    const g = cl.generals.find((x) => !x.fm && canServe(l, x, l.day()))!;
    g.traits |= traitBit("winter_specialist");
    expect(assignGeneral(l, cl, a.id, g.id)).toBeNull();
    t.lossMen[r] = 0;
    t.supply[r] = 1000;
    t.battle[r] = WARSAW;
    dailySustain(l, id, WINTER + 2);
    t.battle[r] = 0;
    const w2 = weather(WINTER + 2);
    expect(t.men[r]).toBe(
      after(Math.floor((WEATHER[w2].attritionPm * 1000) / 2)),
    );
  });

  test("Paris, London and Berlin winters are temperate; Warsaw's continental (Task 11)", async () => {
    const { l } = await oneDivision();
    const sc = l.scenario;
    for (const [region, band] of [
      [1, "temperate"],
      [3, "temperate"],
      [4, "temperate"],
      [10, "temperate"],
      [6, "continental"],
      [8, "continental"],
    ] as const) {
      expect(
        climateOf(sc.latC(region), sc.landOf(region), sc.wcell(region)),
      ).toBe(band);
    }
  });

  test("upgrades swap 5% a day for a newer generation", async () => {
    const { l, id, ce, r } = await oneDivision();
    const t = l.divisions;
    const base = r * GROUND_SLOTS;
    ce.stock[INF2] = 1_000;
    const old = ce.stock[INF1];
    dailySustain(l, id, SUMMER);
    // 5% of 900 = 45 new rifles in, 45 old ones back to their key.
    expect(t.equip[base + slot(INF2)]).toBe(45);
    expect(t.equip[base + slot(INF1)]).toBe(900 - 45);
    expect(ce.stock[INF2]).toBe(1_000 - 45);
    expect(ce.stock[INF1]).toBe(old + 45);
    // Encircled: none.
    t.encircled[r] = 1;
    t.supply[r] = 0;
    dailySustain(l, id, SUMMER + 1);
    expect(t.equip[base + slot(INF2)]).toBe(45);
  });

  test("experience grows 3 a day in battle", async () => {
    const { l, id, r } = await oneDivision();
    const t = l.divisions;
    t.lastFight[r] = fightOn(SUMMER);
    dailySustain(l, id, SUMMER);
    expect(t.exp[r]).toBe(3);
    // Not today: none.
    dailySustain(l, id, SUMMER + 1);
    expect(t.exp[r]).toBe(3);
    t.exp[r] = 999;
    t.lastFight[r] = fightOn(SUMMER + 2);
    dailySustain(l, id, SUMMER + 2);
    expect(t.exp[r]).toBe(1000);
  });

  test("foughtTest counts every round once, whatever tick of the day (Task 11)", () => {
    const P = WW_PREP_TICKS;
    // smallID 7, 1 and 6: a country's day on tick 0, 1 and 6 of each day.
    for (const smallID of [7, 1, 6]) {
      const k = smallID % WW_DAY_SPLIT;
      const seen = new Map<number, number>();
      for (let day = 1; day <= 20; day++) {
        const fought = foughtTest(smallID, day, P);
        for (let tick = P; tick < dayStartTick(22, P); tick++) {
          if (fought(tick)) seen.set(tick, (seen.get(tick) ?? 0) + 1);
        }
      }
      // Each tick from day 0's step to day 20's (not included) counts once:
      // the window runs from the previous step's tick up to this one's.
      for (let tick = P + k; tick < dayStartTick(20, P) + k; tick++) {
        expect(seen.get(tick)).toBe(1);
      }
      expect(seen.size).toBe(dayStartTick(20, P) - P);
      // A round late on day 5, after the step: counted on day 6 (it used
      // to be lost for a country whose step is not on the day's first tick).
      const late = dayStartTick(5, P) + 6;
      expect(foughtTest(smallID, 5, P)(late)).toBe(false);
      expect(foughtTest(smallID, 6, P)(late)).toBe(true);
    }
    // Never fought.
    expect(foughtTest(1, 3, P)(-1)).toBe(false);
  });

  test("army XP grows 0.1 a day (0.2 for a major)", async () => {
    const deu = await oneDivision("DEU");
    deu.cl.armyXpMilli = 0;
    dailySustain(deu.l, deu.id, SUMMER);
    expect(deu.cl.armyXpMilli).toBe(200);
    // A division that fought: +0.05.
    deu.l.divisions.lastFight[deu.r] = fightOn(SUMMER + 1);
    dailySustain(deu.l, deu.id, SUMMER + 1);
    expect(deu.cl.armyXpMilli).toBe(200 + 200 + 50);
    deu.cl.armyXpMilli = WW_ARMY_XP_MAX_MILLI - 10;
    dailySustain(deu.l, deu.id, SUMMER + 2);
    expect(deu.cl.armyXpMilli).toBe(WW_ARMY_XP_MAX_MILLI);
    const pol = await oneDivision("POL", 6);
    pol.cl.armyXpMilli = 0;
    dailySustain(pol.l, pol.id, SUMMER);
    expect(pol.cl.armyXpMilli).toBe(100);
  });
});

/** The game's depth hooks with some answers replaced (lane values a test stands in for). */
function withHooks<T extends object>(hooks: T, over: Partial<T>): T {
  return Object.assign(Object.create(hooks) as T, over);
}

describe("P6 hooks in the country's day (spec §21.2, §4.5, §4.6)", () => {
  test("reinforcePct speeds reinforcement; neutral is P2's", async () => {
    const { l, id, ce, r } = await oneDivision();
    const t = l.divisions;
    l.setMen(r, 5_000);
    ce.stats.reinforcePct = 100;
    dailySustain(l, id, SUMMER);
    // 20% of 10,500 men at full supply (P2: 10%).
    expect(t.men[r]).toBe(5_000 + 2_100);
  });

  test("divXpGainPct and the army's medal raise battle experience", async () => {
    const { l, id, ce, r } = await oneDivision();
    const t = l.divisions;
    ce.stats.divXpGainPct = 100;
    t.lastFight[r] = fightOn(SUMMER);
    dailySustain(l, id, SUMMER);
    expect(t.exp[r]).toBe(6);
    ce.stats.divXpGainPct = 0;
    const hooks = l.depthHooks;
    l.depthHooks = withHooks(hooks, { medalXpPct: () => 50 });
    t.lastFight[r] = fightOn(SUMMER + 1);
    dailySustain(l, id, SUMMER + 1);
    // 3 × 150% = 4 (floor).
    expect(t.exp[r]).toBe(6 + 4);
    l.depthHooks = hooks;
  });

  test("the reinforcement order (lane D's priority) decides who gets short stock", async () => {
    const run = async (reverse: boolean) => {
      const { g, l, id, ce } = await oneDivision();
      const b = placeArmy(g, "DEU", BERLIN, 1);
      const t = l.divisions;
      const rows = l.rowsOf(id);
      for (const r of rows) l.addEquip(r, slot(INF1), -300);
      ce.stock[INF1] = 90; // one division's day (10% of 900)
      const hooks = l.depthHooks;
      if (reverse) {
        l.depthHooks = withHooks(hooks, {
          reinforceOrder: () => [...rows].reverse().map((r) => t.id[r]),
        });
      }
      dailySustain(l, id, SUMMER);
      l.depthHooks = hooks;
      void b;
      return rows.map((r) => t.equip[r * GROUND_SLOTS + slot(INF1)]);
    };
    const p2 = await run(false);
    const rev = await run(true);
    expect(p2[0]).toBeGreaterThan(p2[1]);
    expect(rev[1]).toBeGreaterThan(rev[0]);
  });
});
