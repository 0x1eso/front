// World War 1936 P5 lane A (plan Task 6 Step 7; spec §12): volunteers on
// the end map. Italy (50 divisions; army 5 is two of them in Rome) sends
// to Poland (8 divisions, at war with the Soviet Union) over Rome–Krakow;
// Italy, Poland and the Soviet Union are human (no AI moves them).
import { MOVE_NONE } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { volunteerCap } from "@openfront/engine-lib/ww1936/EndgameRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { volunteerRoom } from "@openfront/engine/ww1936/endgame/Volunteers";
import { armyRows } from "@openfront/engine/ww1936/land/Plans";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { messages } from "./convoyUtil";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  END_MAP,
  order,
  placeArmy,
  step,
  stepTo,
  wwRunnerCapture,
} from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const C_ITA = "HUMANITA";
const C_POL = "HUMANPOL";
const C_SUN = "HUMANSUN";
const ROME = 5;
const KRAKOW = 7;
const WARSAW = 6;
const KIEV = 9;
/** Italy's two-division army in Rome at the start. */
const SMALL_ARMY = 5;

async function game() {
  const { runner, updates } = await wwRunnerCapture(
    {},
    [
      { clientID: C_ITA, country: "ITA" },
      { clientID: C_POL, country: "POL" },
      { clientID: C_SUN, country: "SUN" },
    ],
    END_MAP,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const ww = g.worldWar()!;
  const [ita, pl, sun] = [endId("ITA"), endId("POL"), endId("SUN")];
  ww.setWar(pl, sun, g.ticks(), { kind: "declare" });
  const l = ww.land;
  const a = l.armies.get(SMALL_ARMY)!;
  expect([a.owner, a.divisions.length, l.armyRegion(a)]).toEqual([
    ita,
    2,
    ROME,
  ]);
  const dayTick = (d: number) => dayStartTick(d, ww.prepEndTick());
  return {
    runner,
    updates,
    g,
    ww,
    l,
    eg: ww.endgame,
    ita,
    pl,
    sun,
    a,
    dayTick,
  };
}

function until(runner: GameRunner, done: () => boolean, max = 3000): void {
  for (let i = 0; i < max && !done(); i++) step(runner);
  if (!done()) throw new Error("condition not reached");
}

/** Sends army 5 to Poland and waits until it stands in Krakow, its walk done. */
function sendAndArrive(x: Awaited<ReturnType<typeof game>>): void {
  const { runner, l, a, pl } = x;
  step(runner, 2, [
    order(C_ITA, { kind: "volunteers_send", army: a.id, to: pl }),
  ]);
  expect(a.volunteerFor).toBe(pl);
  until(
    runner,
    () =>
      l.armyRegion(a) === KRAKOW &&
      armyRows(l, a).every((r) => l.divisions.mode[r] === MOVE_NONE),
  );
}

describe("World War 1936 P5: volunteers", () => {
  it("volunteers fight the target's enemies without a war with them", async () => {
    const x = await game();
    const { runner, updates, ww, l, eg, ita, pl, sun, a } = x;
    // A Soviet division holds Kiev.
    const ce = ww.economy.country(sun)!;
    ce.manpower += 100_000;
    const def = placeArmy(x.g, "SUN", KIEV, 1);
    step(runner, 2, [
      order(C_ITA, { kind: "volunteers_send", army: a.id, to: pl }),
    ]);
    expect(a.volunteerFor).toBe(pl);
    expect(eg.volunteers.map((v) => [v.army, v.from, v.to])).toEqual([
      [a.id, ita, pl],
    ]);
    expect(
      messages(updates, "events_display.ww1936_volunteers_arrived").map(
        (m) => m.params,
      ),
    ).toEqual([{ fromTag: "ITA" }]);
    // The sender commands it; it attacks its host's enemy.
    expect(
      l.issue(ita, { kind: "army_attack", army: a.id, region: KIEV }, "player"),
    ).toBeNull();
    const ids = [...a.divisions];
    until(runner, () => {
      const b = l.battles.get(KIEV);
      return b !== undefined && ids.some((id) => b.attackers.includes(id));
    });
    const b = l.battles.get(KIEV)!;
    expect(def.divisions.some((id) => b.defenders.includes(id))).toBe(true);
    // No war between Italy and the Soviet Union came of it.
    expect(ww.isAtWar(ita, sun)).toBe(false);
    expect(eg.warOfPair(ita, sun)).toBe(0);
    for (const id of ids) {
      const r = l.divisions.rowOf(id);
      expect(l.divisions.owner[r]).toBe(ita);
      expect(l.fightOwner(r)).toBe(pl);
    }
  });

  it("volunteer captures go to the target", async () => {
    const x = await game();
    const { runner, l, ww, ita, pl, sun, a } = x;
    expect(l.controller[KIEV]).toBe(sun);
    expect(l.rowsIn(KIEV)).toEqual([]);
    sendAndArrive(x);
    expect(
      l.issue(ita, { kind: "army_attack", army: a.id, region: KIEV }, "player"),
    ).toBeNull();
    until(runner, () => l.controller[KIEV] !== sun);
    expect(l.controller[KIEV]).toBe(pl);
    expect(ww.isAtWar(ita, sun)).toBe(false);
  });

  it("volunteers return when the target makes peace", async () => {
    const x = await game();
    const { runner, updates, g, ww, l, eg, ita, pl, sun, a, dayTick } = x;
    sendAndArrive(x);
    const d = ww.day(g.ticks());
    // Krakow the day after it arrived: still there (the host's land).
    stepTo(runner, dayTick(d + 2));
    expect(l.armyRegion(a)).toBe(KRAKOW);
    ww.endWar(pl, sun);
    stepTo(runner, dayTick(d + 3) + 1);
    expect(a.volunteerFor).toBe(0);
    expect(eg.volunteers).toEqual([]);
    // Home to Italy's nearest region with organisation 0 (it recovers
    // from there: the land day ran after the common day).
    expect(l.armyRegion(a)).toBe(ROME);
    for (const r of armyRows(l, a)) {
      expect(l.divisions.org[r]).toBeLessThan(l.orgMaxOf(r) / 4);
    }
    expect(
      messages(updates, "events_display.ww1936_volunteers_recalled").map(
        (m) => [m.params, m.to],
      ),
    ).toEqual([[{ fromTag: "ITA" }, pl]]);
    expect(l.armiesOf(ita).some((b) => b.volunteerFor > 0)).toBe(false);
  });

  it("the cap is min(10%, a third, 12)", async () => {
    // ⌈10% of the sender's⌉, max(2, a third of the target's), 12.
    expect(volunteerCap(50, 8)).toBe(2);
    expect(volunteerCap(50, 30)).toBe(5);
    expect(volunteerCap(25, 90)).toBe(3);
    expect(volunteerCap(100, 9)).toBe(3);
    expect(volunteerCap(300, 300)).toBe(12);
    const x = await game();
    const { g, eg, l, ita, pl, a } = x;
    expect(volunteerRoom(eg, ita, pl)).toBe(2);
    // A whole army goes: 24 divisions are over the cap.
    const big = l.armiesOf(ita).find((b) => b.divisions.length === 24)!;
    const send = (army: number) =>
      eg.issue(ita, { kind: "volunteers_send", army, to: pl }, g.ticks());
    expect(send(big.id)).toBe("volunteer_limit");
    expect(send(a.id)).toBeNull();
    expect(volunteerRoom(eg, ita, pl)).toBe(0);
    // Poland grows to 9 divisions: a third of it is 3, one more fits.
    x.ww.economy.country(pl)!.manpower += 100_000;
    placeArmy(g, "POL", WARSAW, 1);
    expect(volunteerRoom(eg, ita, pl)).toBe(1);
    // Fewer than 10 divisions send none (Poland to Italy's war).
    x.ww.setWar(ita, endId("FRA"), g.ticks(), { kind: "declare" });
    const pa = l.armiesOf(pl)[0];
    expect(
      eg.issue(pl, { kind: "volunteers_send", army: pa.id, to: ita }, 0),
    ).toBe("volunteer_conditions");
  });

  it("a volunteer stays in its host's land; a non-volunteer there is sent home", async () => {
    const x = await game();
    const { runner, g, ww, l, ita, a, dayTick } = x;
    sendAndArrive(x);
    ww.economy.country(ita)!.manpower += 100_000;
    const n = placeArmy(g, "ITA", KRAKOW, 1);
    const d = ww.day(g.ticks());
    stepTo(runner, dayTick(d + 2));
    expect(l.armyRegion(a)).toBe(KRAKOW);
    const at = l.armyRegion(n);
    expect(at).not.toBe(KRAKOW);
    expect(l.sameSide(ita, l.controller[at])).toBe(true);
  });

  it("a volunteer army moves, takes a front and executes a plan in its host's war; a non-volunteer does not", async () => {
    const x = await game();
    const { runner, g, ww, l, ita, pl, sun, a, dayTick } = x;
    sendAndArrive(x);
    ww.economy.country(ita)!.manpower += 100_000;
    const n = placeArmy(g, "ITA", KRAKOW, 1);
    const issue = (o: Parameters<typeof l.issue>[1]) =>
      l.issue(ita, o, "player");
    // Moves inside the host's land.
    expect(issue({ kind: "army_move", army: a.id, region: WARSAW })).toBeNull();
    expect(
      issue({ kind: "army_move", army: n.id, region: WARSAW }),
    ).not.toBeNull();
    // The host's front against the host's enemies (enemy 0: all of them).
    const front = { kind: "army_front", anchor: KRAKOW, enemy: 0 } as const;
    expect(issue({ ...front, army: a.id })).toBeNull();
    expect(issue({ ...front, army: n.id })).not.toBeNull();
    expect(a.order.kind).toBe("front");
    const d = ww.day(g.ticks());
    stepTo(runner, dayTick(d + 1) + 7);
    expect(a.front.length).toBeGreaterThan(0);
    expect(a.front.every((r) => l.sameSide(pl, l.controller[r]))).toBe(true);
    // A plan on the host's enemy, executed: Kiev (empty) is taken for Poland.
    const plan = (army: number) =>
      issue({ kind: "army_plan", army, targets: [KIEV], stance: "aggressive" });
    expect(plan(n.id)).not.toBeNull();
    expect(plan(a.id)).toBeNull();
    expect(issue({ kind: "army_execute", army: a.id, on: true })).toBeNull();
    until(runner, () => l.controller[KIEV] !== sun);
    expect(l.controller[KIEV]).toBe(pl);
  });
});
