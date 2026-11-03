// World War 1936: army templates (train_army). One order queues a whole
// army as a group of entries; it is refused whole or not at all, deploys
// on one day into one new army, and deploy_now / cancel_train act on the
// group. Same setup as Training.test.ts: Germany is human, its day is
// called directly on a summer day.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { LandOrder } from "@openfront/engine-api/Schemas";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_MAX_ARMIES,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TRAINING,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import type { CountryEconomy } from "@openfront/engine/ww1936/economy/WwEconomy";
import { dailySustain } from "@openfront/engine/ww1936/land/Sustain";
import {
  byTag,
  clearLand,
  clearStartSetup,
  gameHash,
  HUMAN,
  land,
  step,
  stepTo,
  wwRestore,
  wwRunnerCapture,
} from "./util";

const SUMMER = dayOfDate("1936-06-15");
const MUNICH = 4;
const BERLIN = 3;
const INFANTRY = 1; // DEU's templates: infantry, armored, mountain, cavalry
const MOUNTAIN = 3;
const CAVALRY = 4;
const ARMORED = 2;

async function germany() {
  const { runner, updates } = await wwRunnerCapture({}, [
    { clientID: HUMAN, country: "DEU" },
  ]);
  const g = runner.game;
  stepTo(runner, WW_PREP_TICKS + 1);
  const l = land(g);
  const id = byTag(g, "DEU").smallID();
  const cl = l.country(id)!;
  const ce = l.econ.country(id)!;
  clearStartSetup(l.econ, ce);
  clearLand(g);
  let day = SUMMER;
  ce.manpower = 500_000;
  for (const type of [
    "infantry_equipment",
    "artillery",
    "support_equipment",
    "light_tank",
    "medium_tank",
    "motorized",
    "anti_tank",
  ] as const) {
    for (let k = 1; k <= EQUIPMENT_GENS[type]; k++) {
      ce.stock[equipKey(type, k)] = 0;
    }
    ce.stock[equipKey(type, 1)] = 50_000;
  }
  return {
    runner,
    updates,
    g,
    l,
    id,
    cl,
    ce,
    issue: (o: LandOrder) => l.issue(id, o),
    nextDay: (n = 1) => {
      for (let i = 0; i < n; i++) dailySustain(l, id, day++);
    },
  };
}

const army = (
  items: [number, number][],
  region = 0,
): Extract<LandOrder, { kind: "train_army" }> => ({
  kind: "train_army",
  items: items.map(([template, count]) => ({ template, count })),
  region,
});

const setMen = (ce: CountryEconomy, n: number) => (ce.manpower = n);

describe("train_army", () => {
  test("refuses the whole order when any part fails, queueing nothing", async () => {
    const { l, cl, issue } = await germany();
    const before = () => [cl.training.length, cl.nextEntryId];
    const start = before();
    // A bad template in the second item.
    expect(
      issue(
        army([
          [INFANTRY, 2],
          [99, 1],
        ]),
      ),
    ).toBe("bad_template");
    // More than 24 divisions in all.
    expect(
      issue(
        army([
          [INFANTRY, 20],
          [CAVALRY, 5],
        ]),
      ),
    ).toBe("army_full");
    // A bad region.
    expect(issue(army([[INFANTRY, 1]], 6))).toBe("bad_region");
    // Special battalions count every item together (6 each, cap 24 here).
    expect(l.templateStatsOf(cl.smallID, MOUNTAIN)!.special).toBe(6);
    expect(
      issue(
        army([
          [MOUNTAIN, 3],
          [MOUNTAIN, 2],
        ]),
      ),
    ).toBe("special_cap");
    expect(
      issue(
        army([
          [MOUNTAIN, 2],
          [MOUNTAIN, 2],
        ]),
      ),
    ).toBeNull();
    cl.training = [];
    // The queue limit counts the items.
    while (cl.training.length < WW_MAX_TRAINING - 1) {
      expect(
        l.issue(cl.smallID, {
          kind: "train",
          template: INFANTRY,
          count: 1,
          army: 0,
          region: 0,
        }),
      ).toBeNull();
    }
    expect(
      issue(
        army([
          [INFANTRY, 1],
          [CAVALRY, 1],
        ]),
      ),
    ).toBe("queue_full");
    expect(cl.training).toHaveLength(WW_MAX_TRAINING - 1);
    cl.training = [];
    // The army limit at order time.
    for (let i = 0; i < WW_MAX_ARMIES; i++) l.newArmy(cl.smallID);
    expect(issue(army([[INFANTRY, 1]]))).toBe("too_many_armies");
    expect(start[0]).toBe(0);
  });

  test("24 divisions are fine, 25 are not", async () => {
    const { cl, issue } = await germany();
    expect(issue(army([[INFANTRY, 24]]))).toBeNull();
    expect(cl.training).toHaveLength(1);
    expect(WW_MAX_ARMY_DIVISIONS).toBe(24);
    expect(
      issue(
        army([
          [INFANTRY, 24],
          [CAVALRY, 1],
        ]),
      ),
    ).toBe("army_full");
  });

  test("the whole group deploys on one day into one new army", async () => {
    const { l, id, cl, issue, nextDay } = await germany();
    expect(
      issue(
        army(
          [
            [INFANTRY, 3],
            [ARMORED, 2],
          ],
          MUNICH,
        ),
      ),
    ).toBeNull();
    expect(cl.training.map((e) => e.group)).toEqual([1, 1]);
    nextDay();
    expect(cl.trainees).toHaveLength(5);
    // Infantry trains faster than armour: it must wait for the slowest.
    const inf = l.templateStatsOf(id, INFANTRY)!.trainDays;
    const arm = l.templateStatsOf(id, ARMORED)!.trainDays;
    expect(inf).toBeLessThan(arm);
    nextDay(inf + 1);
    expect(l.armiesOf(id)).toHaveLength(0);
    expect(cl.trainees).toHaveLength(5);
    nextDay(arm - inf - 2);
    expect(l.armiesOf(id)).toHaveLength(0);
    nextDay();
    const armies = l.armiesOf(id);
    expect(armies).toHaveLength(1);
    expect(armies[0].divisions).toHaveLength(5);
    for (const d of armies[0].divisions) {
      expect(l.divisions.region[l.divisions.rowOf(d)]).toBe(MUNICH);
    }
    expect(cl.training).toHaveLength(0);
    expect(cl.trainees).toHaveLength(0);
    expect(cl.readyToday).toBe(5);
  });

  test("a group short of men waits for the rest", async () => {
    const { l, id, cl, ce, issue, nextDay } = await germany();
    setMen(ce, 11_000); // one infantry division only
    expect(issue(army([[INFANTRY, 2]]))).toBeNull();
    nextDay(1 + l.templateStatsOf(id, INFANTRY)!.trainDays + 5);
    // The first has long trained but waits: the second never started.
    expect(cl.trainees).toHaveLength(1);
    expect(cl.training[0].remaining).toBe(1);
    expect(l.armiesOf(id)).toHaveLength(0);
    expect(l.countryDetail(cl).training[0].waiting).toBe("manpower");
    ce.manpower += 11_000;
    nextDay(); // the second starts
    expect(cl.training[0].remaining).toBe(0);
    nextDay(l.templateStatsOf(id, INFANTRY)!.trainDays);
    expect(l.armiesOf(id)).toHaveLength(1);
    expect(l.armiesOf(id)[0].divisions).toHaveLength(2);
  });

  test("a group waits for equipment of a trained division too", async () => {
    const { l, id, cl, ce, issue, nextDay } = await germany();
    for (let k = 1; k <= EQUIPMENT_GENS.artillery; k++) {
      ce.stock[equipKey("artillery", k)] = 0;
    }
    expect(issue(army([[INFANTRY, 2]]))).toBeNull();
    nextDay(1 + l.templateStatsOf(id, INFANTRY)!.trainDays + 3);
    expect(l.armiesOf(id)).toHaveLength(0);
    ce.stock[equipKey("artillery", 1)] = 500;
    nextDay(2);
    expect(l.armiesOf(id)).toHaveLength(1);
    expect(cl.trainees).toHaveLength(0);
  });

  test("with 40 armies at deploy time the divisions join non-full armies and the player is told", async () => {
    const { runner, updates, l, id, cl, issue, nextDay } = await germany();
    expect(issue(army([[INFANTRY, 2]], BERLIN))).toBeNull();
    nextDay();
    // 39 armies were room enough to queue; now the 40th is taken.
    const hosts = [];
    for (let i = 0; i < WW_MAX_ARMIES; i++) hosts.push(l.newArmy(id)!);
    expect(l.armiesOf(id)).toHaveLength(WW_MAX_ARMIES);
    nextDay(l.templateStatsOf(id, INFANTRY)!.trainDays + 1);
    expect(l.armiesOf(id)).toHaveLength(WW_MAX_ARMIES);
    expect(hosts.flatMap((a) => a.divisions)).toHaveLength(2);
    expect(cl.trainees).toHaveLength(0);
    step(runner);
    const told = updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_army_scattered");
    expect(told).toHaveLength(1);
    expect(told[0].params).toEqual({ count: 2 });
  });

  test("deploy_now deploys the started ones by progress and drops the rest", async () => {
    const { l, id, cl, ce, issue, nextDay } = await germany();
    setMen(ce, 11_000);
    expect(issue(army([[INFANTRY, 2]]))).toBeNull();
    const entry = cl.training[0].id;
    nextDay();
    nextDay(20);
    const before = Array.from(ce.stock);
    expect(cl.training[0].remaining).toBe(1);
    expect(issue({ kind: "deploy_now", entry: 99 })).toBe("bad_index");
    expect(issue({ kind: "deploy_now", entry })).toBeNull();
    expect(cl.training).toHaveLength(0);
    expect(cl.trainees).toHaveLength(0);
    const [a] = l.armiesOf(id);
    expect(a.divisions).toHaveLength(1);
    const r = l.divisions.rowOf(a.divisions[0]);
    const total = l.templateStatsOf(id, INFANTRY)!.trainDays;
    expect(l.divisions.org[r]).toBe(Math.floor((l.orgMaxOf(r) * 20) / total));
    // The unstarted one cost nothing; nothing was returned or taken.
    expect(Array.from(ce.stock)).toEqual(before);
    expect(ce.manpower).toBe(500);
    expect(issue({ kind: "deploy_now", entry })).toBe("bad_index");
  });

  test("cancel_train on a group entry cancels the whole group and returns everything", async () => {
    const { cl, ce, issue, nextDay } = await germany();
    const stock = Array.from(ce.stock);
    const men = ce.manpower;
    expect(
      issue(
        army([
          [INFANTRY, 2],
          [CAVALRY, 1],
        ]),
      ),
    ).toBeNull();
    nextDay(3);
    expect(cl.trainees).toHaveLength(3);
    expect(ce.manpower).toBeLessThan(men);
    // Any entry of the group names it.
    expect(
      issue({ kind: "cancel_train", entry: cl.training[1].id }),
    ).toBeNull();
    expect(cl.training).toHaveLength(0);
    expect(cl.trainees).toHaveLength(0);
    expect(ce.manpower).toBe(men);
    expect(Array.from(ce.stock)).toEqual(stock);
  });

  test("a group in the middle of training survives a snapshot with the same hash", async () => {
    const { runner, cl, issue, nextDay } = await germany();
    expect(
      issue(
        army(
          [
            [INFANTRY, 2],
            [CAVALRY, 1],
          ],
          MUNICH,
        ),
      ),
    ).toBeNull();
    expect(
      issue({
        kind: "train",
        template: INFANTRY,
        count: 1,
        army: 0,
        region: 0,
      }),
    ).toBeNull();
    nextDay(4);
    const before = gameHash(runner);
    const copy = await wwRestore(runner, [{ clientID: HUMAN, country: "DEU" }]);
    const l2 = land(copy.game);
    const cl2 = l2.country(cl.smallID)!;
    expect(cl2.training).toEqual(cl.training);
    expect(cl2.training.map((e) => e.group)).toEqual([1, 1, undefined]);
    expect(gameHash(copy)).toBe(before);
  });

  test("single trains leave the hash input alone: no group, no field", async () => {
    const { cl, issue } = await germany();
    expect(
      issue({
        kind: "train",
        template: INFANTRY,
        count: 1,
        army: 0,
        region: 0,
      }),
    ).toBeNull();
    expect("group" in cl.training[0]).toBe(false);
  });
});
