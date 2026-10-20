// World War 1936 P2 Task 5: a country's day for its divisions (P2 spec
// §5.3 reinforcement, upgrades and attrition, §5.4 experience and army
// experience, §10 weather). Germany is human; the country's day is called
// directly, on a summer day unless the test is about winter.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  groundSlotOf,
  traitBit,
  WW_ARMY_XP_MAX_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { WEATHER, weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import { assignGeneral } from "@openfront/engine/ww1936/land/GeneralsRun";
import { dailySustain } from "@openfront/engine/ww1936/land/Sustain";
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

  test("winter attrition", async () => {
    const { l, id, a, r, cl } = await oneDivision();
    const t = l.divisions;
    const sc = l.scenario;
    const w = weatherAt(
      WINTER,
      sc.latC(BERLIN),
      sc.landOf(BERLIN),
      sc.wcell(BERLIN),
    );
    expect(["snow", "frozen"]).toContain(w);
    const ppm = WEATHER[w].attritionPm * 1000;
    expect(ppm).toBeGreaterThan(0);
    dailySustain(l, id, WINTER);
    expect(t.men[r]).toBe(10_500 - Math.floor((10_500 * ppm) / 1_000_000));
    // A winter specialist at the head of the army halves it.
    const g = cl.generals[0];
    g.traits |= traitBit("winter_specialist");
    expect(assignGeneral(l, cl, a.id, g.id)).toBeNull();
    t.lossMen[r] = 0;
    dailySustain(l, id, WINTER + 1);
    const w2 = weatherAt(
      WINTER + 1,
      sc.latC(BERLIN),
      sc.landOf(BERLIN),
      sc.wcell(BERLIN),
    );
    const half = Math.floor((WEATHER[w2].attritionPm * 1000) / 2);
    // (Reinforced back to 10,500 first.)
    expect(t.men[r]).toBe(10_500 - Math.floor((10_500 * half) / 1_000_000));
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
    t.lastFight[r] = SUMMER;
    dailySustain(l, id, SUMMER);
    expect(t.exp[r]).toBe(3);
    // Not today: none.
    dailySustain(l, id, SUMMER + 1);
    expect(t.exp[r]).toBe(3);
    t.exp[r] = 999;
    t.lastFight[r] = SUMMER + 2;
    dailySustain(l, id, SUMMER + 2);
    expect(t.exp[r]).toBe(1000);
  });

  test("army XP grows 0.1 a day (0.2 for a major)", async () => {
    const deu = await oneDivision("DEU");
    deu.cl.armyXpMilli = 0;
    dailySustain(deu.l, deu.id, SUMMER);
    expect(deu.cl.armyXpMilli).toBe(200);
    // A division that fought: +0.05.
    deu.l.divisions.lastFight[deu.r] = SUMMER + 1;
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
