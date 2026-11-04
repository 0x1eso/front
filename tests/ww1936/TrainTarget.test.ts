// World War 1936: the "deploy to" choice of a queued division (train's
// `target`). The division joins that army where the army is; an army that
// is gone or full is dropped with one notice and the division deploys as
// before. Same setup as ArmyTrain.test.ts.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { LandOrder } from "@openfront/engine-api/Schemas";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_MAX_ARMY_DIVISIONS } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { dailySustain } from "@openfront/engine/ww1936/land/Sustain";
import {
  byTag,
  clearLand,
  clearStartSetup,
  gameHash,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  wwRestore,
  wwRunnerCapture,
} from "./util";

const SUMMER = dayOfDate("1936-06-15");
const MUNICH = 4;
const BERLIN = 3;
const INFANTRY = 1;

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
  const trainDays = l.templateStatsOf(id, INFANTRY)!.trainDays;
  return {
    runner,
    updates,
    g,
    l,
    id,
    cl,
    ce,
    trainDays,
    issue: (o: LandOrder) => l.issue(id, o),
    nextDay: (n = 1) => {
      for (let i = 0; i < n; i++) dailySustain(l, id, day++);
    },
  };
}

const train = (
  target?: number,
  count = 1,
  region = 0,
): Extract<LandOrder, { kind: "train" }> => ({
  kind: "train",
  template: INFANTRY,
  count,
  army: 0,
  region,
  ...(target === undefined ? {} : { target }),
});

const notices = (updates: ReturnType<typeof Array.prototype.concat>) =>
  updates
    .flatMap((u: any) => u.updates[GameUpdateType.DisplayEvent])
    .filter(
      (m: any) => m.message === "events_display.ww1936_train_target_lost",
    );

describe("train target", () => {
  test("the division joins the chosen army, where that army is", async () => {
    const { g, l, id, issue, nextDay, trainDays } = await germany();
    const a = placeArmy(g, "DEU", MUNICH, 1);
    // The entry's own region (BERLIN) is not where it appears.
    expect(issue(train(a.id, 1, BERLIN))).toBeNull();
    nextDay(trainDays + 2);
    expect(l.armiesOf(id)).toHaveLength(1);
    expect(a.divisions).toHaveLength(2);
    const row = l.divisions.rowOf(a.divisions[1]);
    expect(l.divisions.region[row]).toBe(MUNICH);
  });

  test("an army with no divisions is still joined, in the entry's region", async () => {
    const { l, id, issue, nextDay, trainDays } = await germany();
    const a = l.newArmy(id)!;
    expect(issue(train(a.id, 1, BERLIN))).toBeNull();
    nextDay(trainDays + 2);
    expect(a.divisions).toHaveLength(1);
    expect(l.armiesOf(id)).toHaveLength(1);
    expect(l.divisions.region[l.divisions.rowOf(a.divisions[0])]).toBe(BERLIN);
  });

  test("a vanished target falls back to a new army with one notice", async () => {
    const { runner, updates, g, l, id, cl, issue, nextDay, trainDays } =
      await germany();
    const a = placeArmy(g, "DEU", MUNICH, 1);
    expect(issue(train(a.id, 2, BERLIN))).toBeNull();
    l.removeArmy(a.id);
    nextDay(trainDays + 2);
    expect(cl.trainees).toHaveLength(0);
    const fresh = l.armiesOf(id);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].divisions).toHaveLength(2);
    expect(l.divisions.region[l.divisions.rowOf(fresh[0].divisions[0])]).toBe(
      BERLIN,
    );
    step(runner);
    expect(notices(updates)).toHaveLength(1);
  });

  test("a full target falls back with one notice", async () => {
    const { runner, updates, g, l, id, issue, nextDay, trainDays } =
      await germany();
    const a = placeArmy(g, "DEU", MUNICH, WW_MAX_ARMY_DIVISIONS);
    expect(issue(train(a.id, 2))).toBeNull();
    nextDay(trainDays + 2);
    expect(a.divisions).toHaveLength(WW_MAX_ARMY_DIVISIONS);
    const others = l.armiesOf(id).filter((x) => x.id !== a.id);
    expect(others).toHaveLength(1);
    expect(others[0].divisions).toHaveLength(2);
    step(runner);
    expect(notices(updates)).toHaveLength(1);
  });

  test("deploy_now honours the target", async () => {
    const { g, l, id, cl, issue, nextDay } = await germany();
    const a = placeArmy(g, "DEU", MUNICH, 1);
    expect(issue(train(a.id, 1, BERLIN))).toBeNull();
    nextDay(3);
    expect(issue({ kind: "deploy_now", entry: cl.training[0].id })).toBeNull();
    expect(a.divisions).toHaveLength(2);
    expect(l.armiesOf(id)).toHaveLength(1);
    expect(l.divisions.region[l.divisions.rowOf(a.divisions[1])]).toBe(MUNICH);
  });

  test("a bad army id is refused at order time; several entries may name one army", async () => {
    const { g, l, cl, issue } = await germany();
    expect(issue(train(9999))).toBe("no_army");
    const foreign = l.newArmy(byTag(g, "FRA").smallID())!;
    expect(issue(train(foreign.id))).toBe("no_army");
    expect(cl.training).toHaveLength(0);
    const a = l.newArmy(cl.smallID)!;
    expect(issue(train(a.id))).toBeNull();
    expect(issue(train(a.id))).toBeNull();
    expect(cl.training.map((e) => e.target)).toEqual([a.id, a.id]);
  });

  test("snapshot and restore mid-training keep the target and the hash", async () => {
    const { runner, g, cl, issue, nextDay } = await germany();
    const a = placeArmy(g, "DEU", MUNICH, 1);
    expect(issue(train(a.id, 2, BERLIN))).toBeNull();
    expect(issue(train())).toBeNull();
    nextDay(4);
    const before = gameHash(runner);
    const copy = await wwRestore(runner, [{ clientID: HUMAN, country: "DEU" }]);
    const cl2 = land(copy.game).country(cl.smallID)!;
    expect(cl2.training).toEqual(cl.training);
    expect(cl2.training.map((e) => e.target)).toEqual([a.id, undefined]);
    expect(gameHash(copy)).toBe(before);
  });

  test("no target, no field: the entry and its hash input stay as they were", async () => {
    const { cl, issue } = await germany();
    expect(issue(train())).toBeNull();
    expect("target" in cl.training[0]).toBe(false);
  });
});
