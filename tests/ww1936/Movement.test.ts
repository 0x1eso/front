// World War 1936 P2 (plan Task 3 Step 5): movement over the region graph
// (P2 spec §7.1–§7.7) on the test map: walking at the pure functions' pace,
// rail, sea, taking an empty enemy region, never walking into a defended
// one, neutral land closed, a faction partner's land open, the
// preparation minute.
import {
  MOVE_NONE,
  MOVE_SEA,
  MOVE_WALK,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_CONVOY_SPEED_KN } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  moveNeed,
  moveStep,
  railStep,
} from "@openfront/engine-lib/ww1936/MoveRules";
import { tickMilliKm } from "@openfront/engine-lib/ww1936/NavalRules";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import type { Game } from "@openfront/engine/game/Game";
import { startHopInto } from "@openfront/engine/ww1936/land/Movement";
import type { Army } from "@openfront/engine/ww1936/land/WwLand";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  warAfterPrep,
  wwRunner,
} from "./util";

const HUMAN_POL = "HUMAN002";
const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: HUMAN_POL, country: "POL" as const },
];

const rowOf = (g: Game, a: Army, i = 0) =>
  land(g).divisions.rowOf(a.divisions[i]);
const vpTile = (g: Game, id: number) =>
  g.worldWar()!.scenario.vpTile(g.worldWar()!.scenario.region(id)!);

describe("World War 1936 P2: movement (P2 spec §7)", () => {
  test("a division walks Berlin to Munich at the pure functions' pace", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const ww = g.worldWar()!;
    stepTo(runner, WW_PREP_TICKS + 1);
    clearLand(g);
    const deu = byTag(g, "DEU").smallID();
    const a = placeArmy(g, "DEU", 3, 1);
    const r = rowOf(g, a);
    const sc = l.scenario;
    // Munich: forest (+25%) over 140 km; infrastructure 5 (+20%).
    const need = moveNeed(sc.edge(sc.edgeBetween(3, 4)), sc.landOf(4));
    expect(need).toBe(175_000);
    expect(l.econ.infra[4]).toBe(5);
    const speed = l.baseStatsOf(r).speedCenti;
    const bonus = l.econ.country(deu)!.tech.speedPct * 100;
    // The order applies and the first step is taken on the next tick.
    const t0 = g.ticks();
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 4 })).toBe(
      null,
    );
    let sum = 0;
    let arrival = t0 - 1;
    while (sum < need) {
      arrival++;
      const w = weatherAt(ww.day(arrival), sc.latC(4), "forest", sc.wcell(4));
      sum += moveStep(speed, 5, w, 1000, bonus);
    }
    // January in Berlin (temperate since Task 11): never faster than on
    // clear days.
    const clear = moveStep(speed, 5, "clear", 1000, bonus);
    expect(arrival - t0 + 1).toBeGreaterThanOrEqual(Math.ceil(need / clear));
    while (g.ticks() <= arrival - 1) {
      step(runner);
      expect(l.divisions.region[rowOf(g, a)]).toBe(3);
    }
    step(runner);
    const r1 = rowOf(g, a);
    expect(l.divisions.region[r1]).toBe(4);
    expect(l.divisions.mode[r1]).toBe(MOVE_NONE);
    // Arrived: the move order is done at the country's next day.
    step(runner, 16);
    expect(a.order.kind).toBe("idle");
  });

  test("a continental January walk is slower than a clear one: Warsaw to Krakow (Task 11)", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const ww = g.worldWar()!;
    stepTo(runner, WW_PREP_TICKS + 1);
    clearLand(g);
    const pol = byTag(g, "POL").smallID();
    const a = placeArmy(g, "POL", 6, 1);
    const sc = l.scenario;
    const need = moveNeed(sc.edge(sc.edgeBetween(6, 7)), sc.landOf(7));
    const r = rowOf(g, a);
    const speed = l.baseStatsOf(r).speedCenti;
    const bonus = l.econ.country(pol)!.stats.speedPct * 100;
    const infra = l.econ.infra[7];
    const t0 = g.ticks();
    expect(l.issue(pol, { kind: "army_move", army: a.id, region: 7 })).toBe(
      null,
    );
    let sum = 0;
    let arrival = t0 - 1;
    while (sum < need) {
      arrival++;
      const w = weatherAt(
        ww.day(arrival),
        sc.latC(7),
        sc.landOf(7),
        sc.wcell(7),
      );
      expect(["snow", "frozen"]).toContain(w);
      sum += moveStep(speed, infra, w, 1000, bonus);
    }
    const clear = moveStep(speed, infra, "clear", 1000, bonus);
    expect(arrival - t0 + 1).toBeGreaterThan(Math.ceil(need / clear));
    while (g.ticks() <= arrival) step(runner);
    expect(l.divisions.region[rowOf(g, a)]).toBe(7);
  });

  test("an empty enemy region is taken on arrival", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    warAfterPrep(runner, HUMAN, "POL");
    clearLand(g);
    const deu = byTag(g, "DEU").smallID();
    const a = placeArmy(g, "DEU", 3, 1);
    expect(l.issue(deu, { kind: "army_attack", army: a.id, region: 6 })).toBe(
      null,
    );
    step(runner);
    expect(l.divisions.mode[rowOf(g, a)]).toBe(MOVE_WALK);
    expect(l.divisions.next[rowOf(g, a)]).toBe(6);
    for (let i = 0; i < 200 && l.divisions.region[rowOf(g, a)] !== 6; i++) {
      expect(l.controller[6]).toBe(byTag(g, "POL").smallID());
      step(runner);
    }
    // The tick it arrives: control and the victory-point tile.
    expect(l.divisions.region[rowOf(g, a)]).toBe(6);
    expect(l.controller[6]).toBe(deu);
    expect(g.ownerID(vpTile(g, 6))).toBe(deu);
  });

  test("a region with enemy divisions is never entered", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    warAfterPrep(runner, HUMAN, "POL");
    clearLand(g);
    const deu = byTag(g, "DEU").smallID();
    const pol = byTag(g, "POL").smallID();
    const a = placeArmy(g, "DEU", 3, 1);
    placeArmy(g, "POL", 6, 1);
    expect(l.issue(deu, { kind: "army_attack", army: a.id, region: 6 })).toBe(
      null,
    );
    for (let i = 0; i < 120; i++) {
      step(runner);
      expect(l.divisions.region[rowOf(g, a)]).toBe(3);
      expect(l.divisions.mode[rowOf(g, a)]).toBe(MOVE_NONE);
    }
    expect(l.controller[6]).toBe(pol);
    // A walk already on the way stops the tick an enemy division moves in.
    const b = placeArmy(g, "DEU", 4, 1);
    clearPolish(g, 6);
    startHopInto(l, rowOf(g, b), 6, MOVE_WALK);
    step(runner, 3);
    expect(l.divisions.mode[rowOf(g, b)]).toBe(MOVE_WALK);
    placeArmy(g, "POL", 6, 1);
    step(runner);
    const rb = rowOf(g, b);
    expect(l.divisions.mode[rb]).toBe(MOVE_NONE);
    expect(l.divisions.region[rb]).toBe(4);
    expect(l.divisions.prog[rb]).toBe(0);
    expect(l.controller[6]).toBe(pol);
  });

  test("rail moves Berlin to Munich in two ticks with org 0", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    stepTo(runner, WW_PREP_TICKS + 1);
    clearLand(g);
    const deu = byTag(g, "DEU").smallID();
    const a = placeArmy(g, "DEU", 3, 1);
    const step0 = railStep(l.econ.country(deu)!.tech.railSpeedPct);
    expect(step0).toBe(91_450);
    // 140 km: ceil(140_000 / 91_450) = 2 ticks.
    expect(Math.ceil(140_000 / step0)).toBe(2);
    expect(l.issue(deu, { kind: "army_rail", army: a.id, region: 4 })).toBe(
      null,
    );
    step(runner);
    const r = rowOf(g, a);
    expect(l.divisions.region[r]).toBe(3);
    expect(l.divisions.org[r]).toBe(0);
    expect(l.divisions.prog[r]).toBe(91_450);
    step(runner);
    expect(l.divisions.region[rowOf(g, a)]).toBe(4);
    expect(l.divisions.mode[rowOf(g, a)]).toBe(MOVE_NONE);
  });

  test("no rail into Krakow", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    warAfterPrep(runner, HUMAN, "POL");
    clearLand(g);
    const deu = byTag(g, "DEU").smallID();
    const a = placeArmy(g, "DEU", 3, 1);
    expect(l.issue(deu, { kind: "army_rail", army: a.id, region: 7 })).toBe(
      "no_rail",
    );
    // Even ours, Krakow has no railway.
    l.setController(7, deu, g.ticks());
    expect(l.issue(deu, { kind: "army_rail", army: a.id, region: 7 })).toBe(
      "no_rail",
    );
    expect(l.issue(deu, { kind: "army_rail", army: a.id, region: 6 })).toBe(
      "no_rail",
    );
  });

  test("sea move between our ports", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "FRA" }]);
    const g = runner.game;
    const l = land(g);
    stepTo(runner, WW_PREP_TICKS + 1);
    clearLand(g);
    const fra = byTag(g, "FRA").smallID();
    const a = placeArmy(g, "FRA", 2, 1);
    const paris = placeArmy(g, "FRA", 1, 1);
    // Paris has no port.
    expect(l.issue(fra, { kind: "army_sea", army: paris.id, region: 10 })).toBe(
      "no_port",
    );
    // Lyon to London: both ports of our side (Britain is an ally).
    expect(l.issue(fra, { kind: "army_sea", army: a.id, region: 10 })).toBe(
      null,
    );
    // P4 (plan decision 34, lane C): a convoy voyage between the harbors
    // at 12 knots, a day at least — no longer P2's seaTicks. Issued
    // between ticks it sails from the next one (its departure tick) and
    // lands on departTick + 7 at the earliest.
    const navy = g.worldWar()!.navy;
    const [v] = [...navy.voyages.values()];
    expect(v.departTick).toBe(g.ticks());
    const km = navy.routes.get(v.route)!.km;
    const ticks = Math.max(
      8,
      Math.ceil((km * 1000) / tickMilliKm(WW_CONVOY_SPEED_KN * 100)),
    );
    expect(l.divisions.mode[rowOf(g, a)]).toBe(MOVE_SEA);
    step(runner, ticks - 1);
    expect(l.divisions.region[rowOf(g, a)]).toBe(2);
    expect(l.divisions.org[rowOf(g, a)]).toBe(0);
    step(runner);
    expect(l.divisions.region[rowOf(g, a)]).toBe(10);
    expect(l.controller[10]).toBe(byTag(g, "GBR").smallID());
  });

  test("a neutral country's land is closed", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    stepTo(runner, WW_PREP_TICKS + 1);
    const deu = byTag(g, "DEU").smallID();
    const a = l.armiesOf(deu)[0];
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 8 })).toBe(
      "no_path",
    );
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 6 })).toBe(
      "no_path",
    );
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 1 })).toBe(
      "no_path",
    );
  });

  test("a faction partner's land is open", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    stepTo(runner, WW_PREP_TICKS + 1);
    clearLand(g);
    const ita = byTag(g, "ITA").smallID();
    const a = placeArmy(g, "ITA", 5, 1);
    expect(l.issue(ita, { kind: "army_move", army: a.id, region: 3 })).toBe(
      null,
    );
    step(runner);
    expect(a.path).toEqual([5, 4, 3]);
    expect(l.divisions.next[rowOf(g, a)]).toBe(4);
    const seen = new Set<number>();
    for (let i = 0; i < 400 && l.divisions.region[rowOf(g, a)] !== 3; i++) {
      seen.add(l.divisions.region[rowOf(g, a)]);
      step(runner);
    }
    expect([...seen]).toEqual([5, 4]);
    expect(l.divisions.region[rowOf(g, a)]).toBe(3);
    // Italy's ally's land stays Germany's.
    expect(l.controller[4]).toBe(byTag(g, "DEU").smallID());
  });

  test("a move order during the preparation minute walks inside our land only", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    step(runner, 5);
    clearLand(g);
    const deu = byTag(g, "DEU").smallID();
    const a = placeArmy(g, "DEU", 3, 1);
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 4 })).toBe(
      null,
    );
    // Poland is not an enemy yet: no attack, no way in.
    expect(l.issue(deu, { kind: "army_attack", army: a.id, region: 6 })).toBe(
      "not_at_war",
    );
    for (let i = 0; i < 200 && l.divisions.region[rowOf(g, a)] !== 4; i++) {
      step(runner);
    }
    expect(l.divisions.region[rowOf(g, a)]).toBe(4);
    expect(g.ticks()).toBeLessThan(WW_PREP_TICKS);
    // A hop into foreign land stops at once.
    const b = placeArmy(g, "DEU", 3, 1);
    startHopInto(l, rowOf(g, b), 6, MOVE_WALK);
    step(runner);
    expect(l.divisions.mode[rowOf(g, b)]).toBe(MOVE_NONE);
    expect(l.divisions.region[rowOf(g, b)]).toBe(3);
  });
});

/** Removes Poland's divisions from a region (a test's blank board). */
function clearPolish(g: Game, region: number): void {
  const l = land(g);
  const pol = byTag(g, "POL").smallID();
  for (const r of [...l.rowsIn(region)]) {
    if (l.divisions.owner[r] === pol) l.killDivision(r, false);
  }
}
