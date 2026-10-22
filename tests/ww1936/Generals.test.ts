// World War 1936 P2 Task 5: generals (P2 spec §6.2): heads of armies,
// titled generals, the roster's dates, experience, levels and traits.
// Germany is human (its two seed generals lead its two 1936 armies); the
// country's day is called directly.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  ROLE_ATTACK,
  ROLE_DEFEND,
  traitBit,
  WW_TITLED_GENERAL_XP_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { traitSlots } from "@openfront/engine-lib/ww1936/CommandRules";
import {
  GeneralDef,
  GENERALS,
  generalServes,
  isTitledGeneral,
  titledGeneralId,
  titleNoOfGeneral,
} from "@openfront/engine-lib/ww1936/Generals";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import {
  applyGeneralDates,
  assignGeneral,
  GENERAL_XP_CENTI,
} from "@openfront/engine/ww1936/land/GeneralsRun";
import { dailySustain } from "@openfront/engine/ww1936/land/Sustain";
import { byTag, HUMAN, land, step, stepTo, wwRunnerCapture } from "./util";

const SUMMER = dayOfDate("1936-06-15");
const WINTER = dayOfDate("1937-01-20");
const WARSAW = 6;
const MOSCOW = 8;
/** A round's tick that day `d`'s step counts (lastFight is a tick, Task 11). */
const fightOn = (d: number) => dayStartTick(d, WW_PREP_TICKS) - 1;
/** Whole experience points in GeneralState.xp (hundredths, Task 11). */
const XP = GENERAL_XP_CENTI;

async function germany() {
  const { runner, updates } = await wwRunnerCapture({}, [
    { clientID: HUMAN, country: "DEU" },
  ]);
  const g = runner.game;
  stepTo(runner, WW_PREP_TICKS + 1);
  const l = land(g);
  const id = byTag(g, "DEU").smallID();
  const cl = l.country(id)!;
  const [first, second] = l.armiesOf(id);
  const messages = (key: string) => {
    step(runner);
    return updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === key);
  };
  return { runner, g, l, id, cl, first, second, messages };
}

const testGeneral = (dates: Partial<GeneralDef>): GeneralDef => ({
  id: "test",
  tag: "DEU",
  att: 1,
  def: 1,
  plan: 1,
  log: 1,
  traits: [],
  source: "test",
  ...dates,
});

describe("generals (P2 spec §6.2)", () => {
  test("assign and swap generals", async () => {
    const { g, l, id, cl, first, second } = await germany();
    // The whole roster is Germany's (Task 10): look the two up by name.
    const named = (key: string) =>
      cl.generals.find((x) => x.roster >= 0 && GENERALS[x.roster].id === key)!;
    const rundstedt = named("rundstedt");
    const bock = named("bock");
    expect(first.general).toBe(rundstedt.id);
    expect(second.general).toBe(bock.id);
    // Bock to the first army: Rundstedt is free, the second has none.
    // assignGeneral leaves auto alone (WwLand.issue turns it off for a
    // player's order only, so the AI's assignments keep its armies auto).
    first.auto = true;
    expect(assignGeneral(l, cl, first.id, bock.id)).toBeNull();
    expect(first.general).toBe(bock.id);
    expect(bock.army).toBe(first.id);
    expect(rundstedt.army).toBe(0);
    expect(second.general).toBe(0);
    expect(first.auto).toBe(true);
    first.auto = false;
    // Rundstedt to the second.
    expect(
      l.issue(id, {
        kind: "army_general",
        army: second.id,
        general: rundstedt.id,
      }),
    ).toBeNull();
    expect(second.general).toBe(rundstedt.id);
    expect(rundstedt.army).toBe(second.id);
    // 0 takes him away.
    expect(
      l.issue(id, { kind: "army_general", army: second.id, general: 0 }),
    ).toBeNull();
    expect(second.general).toBe(0);
    expect(rundstedt.army).toBe(0);
    // Not our army; not our general.
    const pol = l.armiesOf(byTag(g, "POL").smallID())[0];
    expect(
      l.issue(id, { kind: "army_general", army: pol.id, general: bock.id }),
    ).toBe("no_army");
    expect(
      l.issue(id, { kind: "army_general", army: second.id, general: 999 }),
    ).toBe("general_unavailable");
    // The screens see it.
    const detail = l.countryDetail(cl);
    expect(detail.generals.find((x) => x.id === bock.id)!.army).toBe(first.id);
  });

  test("a general past its until date leaves its army", async () => {
    // The roster's dates (Task 10 fills real ones): from, until, gaps.
    const day = (iso: string) => dayOfDate(iso);
    const later = testGeneral({ from: "1939-09-01" });
    expect(generalServes(later, day("1939-08-31"))).toBe(false);
    expect(generalServes(later, day("1939-09-01"))).toBe(true);
    const purged = testGeneral({ until: "1937-05-22" });
    expect(generalServes(purged, day("1937-05-21"))).toBe(true);
    expect(generalServes(purged, day("1937-05-22"))).toBe(false);
    const jailed = testGeneral({ gaps: [["1937-08-17", "1940-03-22"]] });
    expect(generalServes(jailed, day("1937-08-16"))).toBe(true);
    expect(generalServes(jailed, day("1937-08-17"))).toBe(false);
    expect(generalServes(jailed, day("1940-03-21"))).toBe(false);
    expect(generalServes(jailed, day("1940-03-22"))).toBe(true);
    // In a game: Rundstedt with those dates (no test general in GENERALS).
    const { l, cl, first, messages } = await germany();
    const rundstedt = cl.generals[0];
    expect(first.general).toBe(rundstedt.id);
    const dates = (def: GeneralDef) => (gs: typeof rundstedt) =>
      gs.id === rundstedt.id ? def : undefined;
    applyGeneralDates(l, cl, day("1937-05-21"), dates(purged));
    expect(first.general).toBe(rundstedt.id);
    applyGeneralDates(l, cl, day("1937-05-22"), dates(purged));
    expect(first.general).toBe(0);
    expect(rundstedt.army).toBe(0);
    const lost = messages("events_display.ww1936_general_lost");
    expect(lost).toHaveLength(1);
    expect(lost[0].params).toEqual({ general: rundstedt.id });
    // Out of service he cannot be given an army.
    applyGeneralDates(l, cl, day("1939-09-01"), dates(later));
    const back = messages("events_display.ww1936_general_available");
    expect(back).toHaveLength(1);
    expect(back[0].params).toEqual({ general: rundstedt.id });
  });

  test("titled generals cost 10 army XP", async () => {
    const { l, id, cl, second } = await germany();
    cl.armyXpMilli = WW_TITLED_GENERAL_XP_MILLI + 5_000;
    const n = cl.generals.length;
    expect(l.issue(id, { kind: "appoint_general" })).toBeNull();
    expect(cl.armyXpMilli).toBe(5_000);
    expect(cl.generals).toHaveLength(n + 1);
    const t = cl.generals[n];
    expect(t).toMatchObject({
      id: titledGeneralId(id, 1),
      roster: -1,
      titleNo: 1,
      att: 1,
      dfn: 1,
      plan: 1,
      log: 1,
      traits: 0,
      level: 1,
      army: 0,
    });
    expect(t.id).toBe(100_000 + 1 * 1000 + id);
    expect(isTitledGeneral(t.id)).toBe(true);
    expect(titleNoOfGeneral(t.id)).toBe(1);
    expect(l.issue(id, { kind: "appoint_general" })).toBe("no_xp");
    expect(cl.generals).toHaveLength(n + 1);
    // A titled general can lead an army.
    expect(
      l.issue(id, { kind: "army_general", army: second.id, general: t.id }),
    ).toBeNull();
    expect(second.general).toBe(t.id);
    cl.armyXpMilli = WW_TITLED_GENERAL_XP_MILLI;
    expect(l.issue(id, { kind: "appoint_general" })).toBeNull();
    expect(cl.generals[n + 1].id).toBe(titledGeneralId(id, 2));
  });

  test("levels raise the most used skill", async () => {
    const { l, id, cl, first } = await germany();
    const t = l.divisions;
    const g = cl.generals.find((x) => x.id === first.general)!;
    const r = t.rowOf(first.divisions[0]);
    // Days defending: defence grows at the level.
    g.use = [0, 3, 0, 0];
    g.xp = 99 * XP;
    const dfn = g.dfn;
    t.lastFight[r] = fightOn(SUMMER);
    t.role[r] = ROLE_DEFEND;
    dailySustain(l, id, SUMMER);
    expect(g.xp).toBe(100 * XP);
    expect(g.level).toBe(2);
    expect(g.use[1]).toBe(4);
    expect(g.dfn).toBe(dfn + 1);
    // Ties: attack, defence, planning, logistics; a skill at 5 is passed.
    g.use = [5, 5, 5, 5];
    g.att = 5;
    g.dfn = 2;
    g.plan = 2;
    g.log = 2;
    g.xp = 199 * XP;
    t.lastFight[r] = fightOn(SUMMER + 1);
    t.role[r] = 0;
    dailySustain(l, id, SUMMER + 1);
    expect(g.level).toBe(3);
    expect([g.att, g.dfn, g.plan, g.log]).toEqual([5, 3, 2, 2]);
    // No battle, no experience; preparing a front (readiness under its
    // cap) and short supply (most of the army) count.
    first.order = { ...first.order, kind: "front", executing: false };
    first.planBp = 0;
    for (const d of first.divisions) t.supply[t.rowOf(d)] = 900;
    const use = [...g.use];
    const xp = g.xp;
    dailySustain(l, id, SUMMER + 2);
    expect(g.xp).toBe(xp);
    expect(g.use).toEqual([use[0], use[1], use[2] + 1, use[3] + 1]);
    // Task 11: at the readiness cap preparing counts no more, and one
    // division short of supply is not the army short.
    first.planBp = 3000;
    for (const d of first.divisions) t.supply[t.rowOf(d)] = 1000;
    t.supply[r] = 900;
    dailySustain(l, id, SUMMER + 3);
    expect(g.use).toEqual([use[0], use[1], use[2] + 1, use[3] + 1]);
    // Level 5 at most.
    g.level = 5;
    g.xp = 10_000 * XP;
    t.lastFight[r] = fightOn(SUMMER + 4);
    dailySustain(l, id, SUMMER + 4);
    expect(g.level).toBe(5);
  });

  test("generalXpPct under +100% counts: experience is kept in hundredths (Task 11)", async () => {
    const { l, id, first } = await germany();
    const t = l.divisions;
    const cl = l.country(id)!;
    const ce = l.econ.country(id)!;
    const g = cl.generals.find((x) => x.id === first.general)!;
    const r = t.rowOf(first.divisions[0]);
    g.xp = 0;
    ce.stats.generalXpPct = 50;
    t.lastFight[r] = fightOn(SUMMER);
    dailySustain(l, id, SUMMER);
    // +1.50 points for the battle day (the old rounding gave 1.00).
    expect(g.xp).toBe(150);
    t.lastFight[r] = fightOn(SUMMER + 1);
    dailySustain(l, id, SUMMER + 1);
    expect(g.xp).toBe(300);
    // The screens get whole points.
    const detail = l.countryDetail(cl);
    expect(detail.generals.find((x) => x.id === g.id)!.xp).toBe(3);
  });

  test("60 winter battle days give winter_specialist", async () => {
    const { l, id, cl, first, second } = await germany();
    const t = l.divisions;
    const sc = l.scenario;
    // Warsaw: a continental winter (Berlin's is temperate since Task 11).
    const w = weatherAt(
      WINTER,
      sc.latC(WARSAW),
      sc.landOf(WARSAW),
      sc.wcell(WARSAW),
    );
    expect(["snow", "frozen"]).toContain(w);
    const g = cl.generals.find((x) => x.id === first.general)!;
    const r = t.rowOf(first.divisions[0]);
    g.terrainDays = [59, 0, 0, 0];
    t.lastFight[r] = fightOn(WINTER);
    t.role[r] = ROLE_DEFEND;
    t.battle[r] = WARSAW;
    dailySustain(l, id, WINTER);
    expect(g.terrainDays[0]).toBe(60);
    expect(g.traits & traitBit("winter_specialist")).not.toBe(0);
    // Attacking across a river (Warsaw–Moscow) counts for river_crosser.
    const b = cl.generals.find((x) => x.id === second.general)!;
    const s = t.rowOf(second.divisions[0]);
    l.setDivisionRegion(s, WARSAW);
    t.lastFight[s] = fightOn(WINTER + 1);
    t.role[s] = ROLE_ATTACK;
    t.battle[s] = MOSCOW;
    b.terrainDays = [0, 0, 0, 59];
    dailySustain(l, id, WINTER + 1);
    expect(b.terrainDays[3]).toBe(60);
    expect(b.traits & traitBit("river_crosser")).not.toBe(0);
    // Three traits at most.
    g.traits =
      traitBit("winter_specialist") |
      traitBit("organizer") |
      traitBit("defensive_doctrine");
    g.terrainDays = [60, 0, 59, 0];
    t.battle[r] = 5; // Rome: mountains
    t.lastFight[r] = fightOn(WINTER + 2);
    dailySustain(l, id, WINTER + 2);
    expect(g.terrainDays[2]).toBe(60);
    expect(g.traits & traitBit("mountaineer")).toBe(0);
  });

  test("P6: forest days give forest_expert; a level's trait slots (traitSlots)", async () => {
    const { l, id, cl, first } = await germany();
    const t = l.divisions;
    const g = cl.generals.find((x) => x.id === first.general)!;
    const r = t.rowOf(first.divisions[0]);
    // Munich is forest: the fifth ground (spec §4.2).
    g.traits = 0;
    g.level = 1;
    g.terrainDays = [0, 0, 0, 0, 59, 0, 0];
    t.lastFight[r] = fightOn(SUMMER);
    t.role[r] = ROLE_DEFEND;
    t.battle[r] = 4;
    dailySustain(l, id, SUMMER);
    expect(g.terrainDays[4]).toBe(60);
    expect(g.traits & traitBit("forest_expert")).not.toBe(0);
    // Level 2 has four slots (P2's cap was three).
    g.level = 2;
    g.traits =
      traitBit("winter_specialist") |
      traitBit("organizer") |
      traitBit("defensive_doctrine");
    g.terrainDays = [0, 0, 0, 0, 60, 0, 0];
    t.lastFight[r] = fightOn(SUMMER + 1);
    dailySustain(l, id, SUMMER + 1);
    expect(g.traits & traitBit("forest_expert")).not.toBe(0);
  });

  test("P6: trait slots above level one follow traitSlots (3/4/4/5/5)", async () => {
    const { l, id, cl, first } = await germany();
    const t = l.divisions;
    const g = cl.generals.find((x) => x.id === first.general)!;
    const r = t.rowOf(first.divisions[0]);
    t.role[r] = ROLE_DEFEND;
    t.battle[r] = 4; // Munich: forest
    const four =
      traitBit("winter_specialist") |
      traitBit("organizer") |
      traitBit("defensive_doctrine") |
      traitBit("desert_fox");
    const learn = (level: number, traits: number, day: number) => {
      g.level = level;
      g.traits = traits;
      g.terrainDays = [0, 0, 0, 0, 60, 0, 0];
      t.lastFight[r] = fightOn(day);
      dailySustain(l, id, day);
      return (g.traits & traitBit("forest_expert")) !== 0;
    };
    expect([1, 2, 3, 4, 5].map(traitSlots)).toEqual([3, 4, 4, 5, 5]);
    // Four traits: level 3 (four slots) learns none, level 4 (five) a fifth.
    expect(learn(3, four, SUMMER + 2)).toBe(false);
    expect(learn(4, four, SUMMER + 3)).toBe(true);
    // Five traits at level 5: full.
    expect(learn(5, four | traitBit("river_crosser"), SUMMER + 4)).toBe(false);
  });
});
