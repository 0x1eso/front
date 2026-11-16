// ww218 §2 (lane W): running the country well wins wars. The four strands of
// war power are readings of the state; the pool binds, drill sets the refill,
// the rail is there first, staying power and garrisons weigh on the fronts.
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { econCrisis, econForget } from "@openfront/engine/ww1914/Economy";
import { refill } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { refusalsOf, refusalsStep } from "@openfront/engine/ww1914/Refusals";
import { setEndStrain } from "@openfront/engine/ww1914/Strain";
import {
  bloodWeary,
  drillOf,
  fieldStrength,
  fireLevel,
  firePct,
  powerStep,
  RAW_WEAR,
  REFILL_MEN,
  refillEvery,
  stayingLevel,
} from "@openfront/engine/ww1914/WarPower";
import { memberEnd, openGeneral } from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";

async function world(id: string): Promise<GreatWar> {
  const start = { ...startOf(id, "full", []), players: [] };
  const runner = await createGameRunner(start, undefined, realMap(), () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
  return gw;
}

/** Puts the game at chapter `i`, on its date. */
function at(gw: GreatWar, i: number): void {
  gw.s.chapter = i;
  gw.s.day = gwChapters(gw.s.calendar)[i].day + gw.s.dayShift;
  econForget();
}

/** The first long (month) chapter from `from` on that `ok` takes. */
function longChapter(
  gw: GreatWar,
  from: number,
  ok: (i: number) => boolean,
): number {
  const days = gwChapters(gw.s.calendar);
  for (let i = from; i < days.length; i++) {
    if (days[i].spanDays >= 28 && ok(i)) return i;
  }
  throw new Error("no long chapter");
}

/** Germany at war on the west, one band below its base. */
async function germanyShort(id: string): Promise<GreatWar> {
  const gw = await world(id);
  openGeneral(gw, "DEU", "FRA", "test");
  const deu = gw.nation("DEU")!;
  deu.base.west = 4;
  deu.strength.west = 3;
  for (const t of Object.keys(deu.strength)) {
    if (t !== "west") deu.base[t as "east"] = deu.strength[t as "east"];
  }
  powerStep(gw);
  return gw;
}

describe("ww218 war power: the pool and the drill", () => {
  test("a binding pool stops refill; with men left a refill costs real men", async () => {
    const gw = await germanyShort("WP_POOL");
    const deu = gw.nation("DEU")!;
    deu.warPower!.drill = 3;
    expect(refillEvery(gw, deu)).toBe(1);
    // No desertion this chapter; the pool is below MEN_LOW: nothing comes.
    at(
      gw,
      longChapter(gw, gw.s.warChapter! + 3, (i) => i % 4 !== 0),
    );
    deu.manpower = 5;
    refill(gw);
    expect(deu.strength.west).toBe(3);
    // Men again: one band back, for REFILL_MEN points (the class adds a little).
    deu.manpower = 60;
    refill(gw);
    expect(deu.strength.west).toBe(4);
    expect(deu.manpower).toBeLessThanOrEqual(60 + 1 - REFILL_MEN);
  });

  test("with the pool gone the bands melt", async () => {
    const gw = await germanyShort("WP_DESERT");
    const deu = gw.nation("DEU")!;
    deu.base.west = 3;
    const top = Math.max(...Object.values(deu.strength).map((v) => v ?? 0));
    at(
      gw,
      longChapter(gw, gw.s.warChapter! + 3, (i) => i % 4 === 0),
    );
    deu.manpower = 0;
    refill(gw);
    const after = Math.max(...Object.values(deu.strength).map((v) => v ?? 0));
    expect(after).toBe(top - 1);
  });

  test("drill speeds refill, and men sent untrained come back worn", async () => {
    const gw = await germanyShort("WP_DRILL");
    const deu = gw.nation("DEU")!;
    deu.warPower!.drill = 0;
    expect(drillOf(gw, deu)).toBe(0);
    expect(refillEvery(gw, deu)).toBe(3);
    deu.warPower!.drill = 3;
    expect(refillEvery(gw, deu)).toBe(1);
    // A thin pool halves it.
    deu.manpower = 20;
    expect(refillEvery(gw, deu)).toBe(2);
    // Untrained: every third chapter, half a band worn.
    deu.warPower!.drill = 0;
    deu.manpower = 60;
    deu.wear.west = 0;
    at(
      gw,
      longChapter(gw, gw.s.warChapter! + 3, (i) => i % 3 === 1),
    );
    refill(gw);
    expect(deu.strength.west).toBe(3);
    at(
      gw,
      longChapter(gw, gw.s.warChapter! + 3, (i) => i % 3 === 0),
    );
    refill(gw);
    expect(deu.strength.west).toBe(4);
    expect(deu.wear.west).toBe(RAW_WEAR);
  });
});

describe("ww218 war power: the rail, the strands, the anti-snowball", () => {
  test("rail 3 against 0 gains a step at the outbreak; even rails gain none", async () => {
    const a = await world("WP_RAIL");
    a.nation("DEU")!.warPower = undefined;
    openGeneral(a, "DEU", "RUS", "test");
    const eastA = a.s.theatres.find((t) => t.id === "east")!;
    expect(eastA.open).toBe(true);
    const b = await world("WP_RAIL");
    // Russia with Germany's railways: nobody is there first.
    b.nation("RUS")!.warPower = {
      rail: 3,
      drill: 0,
      railGrow: 0,
      drillGrow: 0,
      garrison: 0,
    };
    openGeneral(b, "DEU", "RUS", "test");
    const eastB = b.s.theatres.find((t) => t.id === "east")!;
    expect(eastA.line * 10 + eastA.progress).toBe(
      eastB.line * 10 + eastB.progress + 1,
    );
  });

  test("staying power and firepower are readings of the state", async () => {
    const gw = await world("WP_READ");
    const rus = gw.nation("RUS")!;
    rus.gauges.morale = 5;
    rus.gauges.order = 4;
    rus.unrest = 0;
    expect(stayingLevel(gw, rus)).toBe(3);
    rus.gauges.morale = 1;
    rus.unrest = 3;
    expect(stayingLevel(gw, rus)).toBe(1);
    const deu = gw.nation("DEU")!;
    deu.gauges.shells = 0;
    deu.econ = {
      rate: { shells: -300, bread: 0, money: 0 },
      why: { shells: "", bread: "", money: "" },
      moved: [],
      dry: null,
      mobilised: null,
    };
    const low = fireLevel(deu);
    deu.econ.mobilised = gw.s.chapter;
    deu.techs.push("barrage");
    expect(fireLevel(deu)).toBe(Math.min(3, low + 2));
    expect(firePct(deu)).toBeGreaterThan(100);
  });

  test("a munitions ministry mobilises the works at once", async () => {
    const gw = await world("WP_MUNITIONS");
    openGeneral(gw, "DEU", "FRA", "test");
    at(
      gw,
      longChapter(gw, gw.s.warChapter! + 1, () => true),
    );
    const deu = gw.nation("DEU")!;
    deu.gauges.shells = 3;
    econCrisis(gw, deu);
    expect(deu.econ?.mobilised ?? null).toBeNull();
    deu.laws.push({
      id: "deu_aux",
      stage: "force",
      since: gw.s.chapter,
      support: 0,
      how: "voted",
      text: null,
      lost: 0,
      after: true,
      origin: "seat",
      by: null,
      sponsor: null,
      deals: [],
      whip: -1,
      delayTo: -1,
      warm: [],
    } as never);
    econCrisis(gw, deu);
    expect(deu.econ?.mobilised).toBe(gw.s.chapter);
  });

  test("hard-held land ties down garrisons, off the strongest front", async () => {
    const gw = await germanyShort("WP_GARRISON");
    const deu = gw.nation("DEU")!;
    deu.strength.west = 4;
    const places = (Object.keys(GW_PLACES) as GwPlace[])
      .filter((p) => GW_PLACES[p].owner === "FRA")
      .slice(0, 8);
    expect(places.length).toBe(8);
    for (const p of places) gw.s.held[p] = "DEU";
    gw.s.rule = [
      {
        by: "DEU",
        of: "FRA",
        policy: "army",
        hard: 2,
        relief: false,
        resist: 0,
        client: null,
        since: gw.s.chapter,
      },
    ];
    powerStep(gw);
    expect(deu.warPower!.garrison).toBe(2);
    // Two bands off the field, the strongest fronts first, none below one.
    const fronts = Object.keys(deu.strength) as "west"[];
    const off = fronts.reduce(
      (sum, t) => sum + (deu.strength[t] ?? 1) - fieldStrength(deu, t),
      0,
    );
    expect(off).toBe(2);
    expect(fieldStrength(deu, "west")).toBeLessThanOrEqual(3);
    // Light rule holds the land with half the men (ww219: a place counts half).
    gw.s.rule[0].hard = 1;
    powerStep(gw);
    expect(deu.warPower!.garrison).toBe(1);
    // The land given back, the men come back to the front.
    gw.s.held = {};
    powerStep(gw);
    expect(deu.warPower!.garrison).toBe(0);
    expect(fieldStrength(deu, "west")).toBe(4);
  });

  test("ww219: with no staying power left, Germany's men refuse too", async () => {
    const gw = await germanyShort("WP_REFUSE");
    const deu = gw.nation("DEU")!;
    at(
      gw,
      longChapter(gw, gw.s.warChapter! + 2, () => true),
    );
    const west = gw.s.theatres.find((t) => t.id === "west")!;
    setEndStrain(west, memberEnd(gw, "west", "DEU")!, 90);
    deu.gauges.morale = 1;
    deu.gauges.order = 4;
    deu.unrest = 0;
    // Order and calm still give staying power: they hold.
    expect(stayingLevel(gw, deu)).toBeGreaterThan(0);
    refusalsStep(gw);
    expect(refusalsOf(gw, "DEU")).toBeNull();
    deu.gauges.order = 1;
    deu.unrest = 3;
    expect(stayingLevel(gw, deu)).toBe(0);
    refusalsStep(gw);
    expect(refusalsOf(gw, "DEU")?.stage).toBe(1);
  });

  test("weariness comes with blood", async () => {
    const gw = await world("WP_BLOOD");
    const fra = gw.nation("FRA")!;
    fra.casualties = 100;
    expect(bloodWeary(fra)).toBe(false);
    fra.casualties = 1200;
    expect(bloodWeary(fra)).toBe(true);
  });
});
