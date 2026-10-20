// World War 1936 P2 Task 4: land battles (P2 spec §9). Germany and Poland
// are humans (no AI land war); the board is cleared and each test places
// its divisions. Battles start on 1936-06-01, a clear day in Warsaw and
// Krakow (the tests read the weather where it matters). Rounds the tests
// count run stepBattles directly, so no move, supply or order step comes
// between them; the advances run the game.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  idleOrder,
  MOVE_ADVANCE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  ROLE_ATTACK,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  applyBp,
  attackValue,
  roundDamage,
  roundHits,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import type { Game } from "@openfront/engine/game/Game";
import {
  battleMods,
  joinBattle,
  modInputOf,
  refugeOf,
  retreatDivision,
  stepBattles,
} from "@openfront/engine/ww1936/land/Battles";
import { startHopInto } from "@openfront/engine/ww1936/land/Movement";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import {
  byTag,
  clearLand,
  dropPact,
  HUMAN,
  land,
  placeArmy,
  stamped,
  step,
  stepTo,
  takeRegion,
  WwHuman,
  wwRunnerCapture,
} from "./util";

const DEU_POL: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];
const JUNE_1 = dayOfDate("1936-06-01");
const WARSAW = 6;
const KRAKOW = 7;

/** Plenty of every first-generation equipment and men, so placed divisions are full. */
function stockUp(g: Game, tag: "DEU" | "POL" | "FRA"): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/**
 * Spec §9.10's German infantry division, "infantry 7 · artillery 2" (width
 * 20), as a German template: the sense-check numbers (9.2 and 11.7 hits,
 * width 135 = 6.75 of them) are its. The test map's own 1936 German
 * division is bigger (9 · 2 with engineers and recon, width 24).
 */
function specInfantry(l: WwLand, deu: number): number {
  const cl = l.country(deu)!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: {
      name: "7-2",
      battalions: [
        ...new Array<"infantry">(7).fill("infantry"),
        "artillery",
        "artillery",
      ],
      support: [],
    },
  });
  return id;
}

/** Germany at war with Poland from 1936-06-01, the board cleared. */
async function juneWar() {
  const { runner, updates } = await wwRunnerCapture({}, DEU_POL);
  const g = runner.game;
  dropPact(g, "DEU", "POL");
  stepTo(runner, dayStartTick(JUNE_1, WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
  ]);
  clearLand(g);
  stockUp(g, "DEU");
  stockUp(g, "POL");
  const l = land(g);
  expect(l.isEnemy(byTag(g, "DEU").smallID(), byTag(g, "POL").smallID())).toBe(
    true,
  );
  const deu = byTag(g, "DEU").smallID();
  return {
    runner,
    updates,
    g,
    l,
    deu,
    pol: byTag(g, "POL").smallID(),
    inf72: specInfantry(l, deu),
  };
}

const rowOf = (l: WwLand, id: number) => l.divisions.rowOf(id);

/** Every division of `a` attacks `region`. */
function attack(l: WwLand, a: Army, region: number): void {
  for (const id of a.divisions) joinBattle(l, id, region);
}

/**
 * The army runs an attack plan on `region` (what army_attack orders): it
 * advances when it wins. The front is anchored on the army's own region:
 * Fronts.assignFront sends an army whose anchor (0) reaches no border to idle.
 */
function attackPlan(l: WwLand, a: Army, region: number): void {
  a.order = {
    ...idleOrder(),
    kind: "plan",
    anchor: l.armyRegion(a),
    targets: [region],
    stance: "aggressive",
    executing: true,
  };
}

function weatherOf(g: Game, region: number): string {
  const sc = g.worldWar()!.scenario;
  return weatherAt(
    land(g).day(),
    sc.latC(region),
    sc.landOf(region),
    sc.wcell(region),
  );
}

describe("World War 1936 P2: land battles (spec §9)", () => {
  test("one division attacking alone breaks first (spec §9.10)", async () => {
    const { g, l, pol, inf72 } = await juneWar();
    expect(weatherOf(g, WARSAW)).toBe("clear");
    const a = placeArmy(g, "DEU", 3, 1, inf72);
    const d = placeArmy(g, "POL", WARSAW, 1);
    attack(l, a, WARSAW);
    const att0 = l.divisions.org[rowOf(l, a.divisions[0])];
    const def0 = l.divisions.org[rowOf(l, d.divisions[0])];
    // Plains, clear, no modifiers: Germany's 92 against Poland's defence
    // 198 is 9.2 hits an hour; Poland's 54 against the breakthrough 33 is
    // 11.7. A round is 1.829 hours, 0.13 org a hit.
    stepBattles(l, g.ticks());
    expect(def0 - l.divisions.org[rowOf(l, d.divisions[0])]).toBe(
      roundDamage(920, false).orgMilli,
    );
    expect(att0 - l.divisions.org[rowOf(l, a.divisions[0])]).toBe(
      roundDamage(1170, false).orgMilli,
    );
    let rounds = 1;
    while (l.battles.has(WARSAW)) {
      stepBattles(l, g.ticks());
      expect(++rounds).toBeLessThan(60);
    }
    expect(l.controller[WARSAW]).toBe(pol);
    const att = rowOf(l, a.divisions[0]);
    const def = rowOf(l, d.divisions[0]);
    expect(l.divisions.org[att]).toBe(0);
    expect(l.divisions.org[def]).toBeGreaterThan(0);
    // Spec §9.10: 31 hours against the defender's 50 (rounds of 1.829 h).
    expect(rounds).toBeGreaterThanOrEqual(17);
    expect(rounds).toBeLessThanOrEqual(20);
    expect(l.divisions.org[def]).toBeLessThan(l.orgMaxOf(def) / 2);
    // Both stay where they are, out of the battle.
    expect(l.divisions.region[att]).toBe(3);
    expect(l.divisions.region[def]).toBe(WARSAW);
    expect([l.divisions.battle[att], l.divisions.battle[def]]).toEqual([0, 0]);
  }, 60_000);

  test("two directions break the defence", async () => {
    const { runner, g, l, deu, pol, inf72 } = await juneWar();
    const north = placeArmy(g, "DEU", 3, 4, inf72);
    const south = placeArmy(g, "DEU", 4, 3, inf72);
    const d = placeArmy(g, "POL", WARSAW, 5);
    attackPlan(l, north, WARSAW);
    attackPlan(l, south, WARSAW);
    attack(l, north, WARSAW);
    attack(l, south, WARSAW);
    const b = l.battles.get(WARSAW)!;
    expect(b.attackers).toHaveLength(7);
    // Spec §9.10: width 135 for seven of width 20 (140: 0.74% over).
    const s = l.battleSummary(b);
    expect([s.directions, s.width]).toEqual([2, 135]);
    // 30 days at most (225 ticks).
    const until = g.ticks() + 225;
    while (l.controller[WARSAW] !== deu) {
      expect(g.ticks()).toBeLessThan(until);
      step(runner);
    }
    const sc = g.worldWar()!.scenario;
    expect(g.ownerID(sc.vpTile(sc.region(WARSAW)!))).toBe(deu);
    // Poland's five fell back to Krakow or were destroyed.
    for (const id of d.divisions) {
      const r = rowOf(l, id);
      if (r < 0) continue;
      const t = l.divisions;
      expect(t.owner[r]).toBe(pol);
      expect(
        t.region[r] === KRAKOW ||
          (t.mode[r] === MOVE_RETREAT && t.next[r] === KRAKOW),
      ).toBe(true);
    }
  }, 60_000);

  test("hills and one direction hold", async () => {
    const { runner, g, l, deu, pol, inf72 } = await juneWar();
    expect(g.worldWar()!.scenario.landOf(KRAKOW)).toBe("hills");
    const a = placeArmy(g, "DEU", 4, 7, inf72);
    placeArmy(g, "POL", KRAKOW, 5);
    attackPlan(l, a, KRAKOW);
    attack(l, a, KRAKOW);
    expect(l.battleSummary(l.battles.get(KRAKOW)!).directions).toBe(1);
    let ended = -1;
    for (let i = 0; i < 225; i++) {
      step(runner);
      if (ended < 0 && !l.battles.has(KRAKOW)) ended = i;
      expect(l.controller[KRAKOW]).toBe(pol);
    }
    // The attack broke well within the month.
    expect(ended).toBeGreaterThan(0);
    expect(ended).toBeLessThan(60);
    // Nobody advanced into Krakow: every attacker stands on our side's
    // ground. The plan army's front (Fronts.assignFront) spreads them along
    // the border once they are out of the battle, and the plan walks into
    // empty Warsaw (spec §7.7), so not all of them stay in Munich.
    for (const id of a.divisions) {
      const r = rowOf(l, id);
      expect(l.divisions.mode[r]).not.toBe(MOVE_ADVANCE);
      expect(l.divisions.region[r]).not.toBe(KRAKOW);
      expect(l.sameSide(deu, l.controller[l.divisions.region[r]])).toBe(true);
    }
  }, 60_000);

  test("a defender at zero org retreats to the best neighbour", async () => {
    const { g, l } = await juneWar();
    const a = placeArmy(g, "DEU", 3, 1);
    const d = placeArmy(g, "POL", WARSAW, 1);
    const r = rowOf(l, d.divisions[0]);
    l.divisions.org[r] = 1;
    attack(l, a, WARSAW);
    stepBattles(l, g.ticks());
    const t = l.divisions;
    expect(t.org[r]).toBe(0);
    expect(t.mode[r]).toBe(MOVE_RETREAT);
    // Warsaw's only Polish neighbour.
    expect(t.next[r]).toBe(KRAKOW);
    expect(t.region[r]).toBe(WARSAW);
    expect(t.battle[r]).toBe(0);
    // Nobody left to defend: the battle is over, nobody advances (no plan).
    expect(l.battles.has(WARSAW)).toBe(false);
    expect(t.mode[rowOf(l, a.divisions[0])]).not.toBe(MOVE_ADVANCE);
  }, 60_000);

  test("no friendly neighbour means destruction", async () => {
    const { runner, updates, g, l, deu, pol } = await juneWar();
    takeRegion(g, KRAKOW, "DEU");
    const a = placeArmy(g, "DEU", 3, 1);
    const d = placeArmy(g, "POL", WARSAW, 1);
    const id = d.divisions[0];
    l.divisions.org[rowOf(l, id)] = 1;
    const men = l.divisions.men[rowOf(l, id)];
    const casualties = l.country(pol)!.casualtiesToday;
    attack(l, a, WARSAW);
    const n = updates.length;
    // The tick's round (messages go out with the tick's updates).
    step(runner);
    expect(rowOf(l, id)).toBe(-1);
    expect(l.armies.has(d.id)).toBe(false);
    // Its men are dead (spec §5.5).
    expect(l.country(pol)!.casualtiesToday).toBe(casualties + men);
    const told = updates
      .slice(n)
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_divisions_destroyed");
    expect(told.map((m) => [m.playerID, m.params])).toEqual([
      [pol, { count: 1, region: WARSAW }],
      [deu, { count: 1, region: WARSAW }],
    ]);
  }, 60_000);

  test("overrun catches a slow retreat", async () => {
    const { runner, updates, g, l, deu, pol } = await juneWar();
    const [id] = placeArmy(g, "POL", WARSAW, 1).divisions;
    const tank = placeArmy(g, "DEU", 3, 1, 2);
    const t = l.divisions;
    const inf = rowOf(l, id);
    // The infantry starts back to Krakow as the armour sets off from Berlin.
    retreatDivision(l, inf);
    expect([t.mode[inf], t.next[inf]]).toEqual([MOVE_RETREAT, KRAKOW]);
    startHopInto(l, rowOf(l, tank.divisions[0]), WARSAW, MOVE_ADVANCE);
    const n = updates.length;
    let lastProg = 0;
    let lastNeed = 0;
    while (l.controller[WARSAW] !== deu) {
      expect(g.ticks()).toBeLessThan(dayStartTick(JUNE_1 + 10, WW_PREP_TICKS));
      const r = rowOf(l, id);
      expect(r).toBeGreaterThanOrEqual(0);
      lastProg = t.prog[r];
      lastNeed = t.need[r];
      step(runner);
    }
    // The armour arrived first, the infantry not halfway: destroyed.
    expect(lastProg * 2).toBeLessThan(lastNeed);
    expect(rowOf(l, id)).toBe(-1);
    expect(t.region[rowOf(l, tank.divisions[0])]).toBe(WARSAW);
    step(runner);
    const told = updates
      .slice(n)
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_divisions_destroyed");
    expect(told.map((m) => m.playerID).sort()).toEqual([deu, pol].sort());
  }, 60_000);

  test("a retreat picks the neighbour without a battle, then the most supply, then the smaller id", async () => {
    const { g, l } = await juneWar();
    // A German division in Warsaw, German Berlin (3) and Munich (4) next door.
    takeRegion(g, WARSAW, "DEU");
    const [id] = placeArmy(g, "DEU", WARSAW, 1).divisions;
    const r = rowOf(l, id);
    l.supplyMilli[3] = 500;
    l.supplyMilli[4] = 500;
    expect(refugeOf(l, r)).toBe(3);
    l.supplyMilli[4] = 800;
    expect(refugeOf(l, r)).toBe(4);
    // A Polish attack on Munich: Berlin, though it has less supply.
    const [pole] = placeArmy(g, "POL", KRAKOW, 1).divisions;
    joinBattle(l, pole, 4);
    expect(l.battles.has(4)).toBe(true);
    expect(refugeOf(l, r)).toBe(3);
    // Encircled with Munich in the pocket: only Munich.
    l.divisions.encircled[r] = 1;
    l.encircled[3] = 0;
    l.encircled[4] = 1;
    expect(refugeOf(l, r)).toBe(4);
    l.divisions.encircled[r] = 0;
    retreatDivision(l, r);
    expect([l.divisions.mode[r], l.divisions.next[r]]).toEqual([
      MOVE_RETREAT,
      3,
    ]);
  }, 60_000);

  test("a division leaving by sea or rail is not in its port's battle, and sails on when the port falls", async () => {
    const { g, l, deu } = await juneWar();
    const ww = g.worldWar()!;
    const fra = byTag(g, "FRA").smallID();
    ww.setWar(deu, fra, g.ticks());
    stockUp(g, "FRA");
    const LYON = 2;
    const LONDON = 10;
    const [sailor, railer, stander] = placeArmy(g, "FRA", LYON, 3).divisions;
    const t = l.divisions;
    const s = rowOf(l, sailor);
    // Under way from Lyon: to London by sea, to Paris by rail.
    t.mode[s] = MOVE_SEA;
    t.next[s] = LONDON;
    t.dest[s] = LONDON;
    t.edge[s] = ww.scenario.edgeBetween(LYON, LONDON);
    t.need[s] = 45_000;
    t.prog[s] = 9_000;
    const rr = rowOf(l, railer);
    t.mode[rr] = MOVE_RAIL;
    t.next[rr] = 1;
    t.dest[rr] = 1;
    t.edge[rr] = ww.scenario.edgeBetween(LYON, 1);
    t.need[rr] = 200_000;
    const orgs = [s, rr].map((r) => t.org[r]);
    const a = placeArmy(g, "DEU", 4, 1);
    attack(l, a, LYON);
    stepBattles(l, g.ticks());
    const b = l.battles.get(LYON)!;
    expect(b.defenders).toEqual([stander]);
    expect([t.battle[s], t.battle[rr]]).toEqual([0, 0]);
    expect([s, rr].map((r) => t.org[r])).toEqual(orgs);
    // Lyon falls: the ship sails on (not overrun), the one standing falls back.
    // The standing one's refuge: Paris or London over the strait, whichever
    // has more supply (spec §9.5; the daily supply sets it).
    const refuge = refugeOf(l, rowOf(l, stander));
    expect([1, LONDON]).toContain(refuge);
    takeRegion(g, LYON, "DEU");
    expect(rowOf(l, sailor)).toBe(s);
    expect([t.mode[s], t.next[s], t.prog[s]]).toEqual([
      MOVE_SEA,
      LONDON,
      9_000,
    ]);
    const st = rowOf(l, stander);
    expect([t.mode[st], t.next[st]]).toEqual([MOVE_RETREAT, refuge]);
  }, 60_000);

  test("encircled divisions at zero org are destroyed", async () => {
    const { g, l } = await juneWar();
    // Two attackers: each strikes one of the two defenders this round.
    const a = placeArmy(g, "DEU", 3, 2);
    const [pocket, free] = placeArmy(g, "POL", WARSAW, 2).divisions;
    const [r1, r2] = [rowOf(l, pocket), rowOf(l, free)];
    // Warsaw is a pocket; Krakow is not part of it.
    l.encircled[WARSAW] = 1;
    l.encircled[KRAKOW] = 0;
    l.divisions.encircled[r1] = 1;
    l.divisions.org[r1] = 1;
    // Not encircled: the same blow sends it back to Krakow.
    l.divisions.org[r2] = 1;
    attack(l, a, WARSAW);
    stepBattles(l, g.ticks());
    expect(rowOf(l, pocket)).toBe(-1);
    const r = rowOf(l, free);
    expect([l.divisions.mode[r], l.divisions.next[r]]).toEqual([
      MOVE_RETREAT,
      KRAKOW,
    ]);
  }, 60_000);

  test("armour halves the damage it takes", async () => {
    const { g, l } = await juneWar();
    const tank = placeArmy(g, "DEU", 3, 1, 2);
    const d = placeArmy(g, "POL", WARSAW, 1);
    const tr = rowOf(l, tank.divisions[0]);
    const pr = rowOf(l, d.divisions[0]);
    const ts = l.statsOf(tr);
    const ps = l.statsOf(pr);
    // Armour 7 against Poland's pierce 4.
    expect(ts.armor).toBe(700);
    expect(ps.pierce).toBe(400);
    attack(l, tank, WARSAW);
    const b = l.battles.get(WARSAW)!;
    const tankMods = battleMods(l, b, tr).mods;
    const polMods = battleMods(l, b, pr).mods;
    const before = l.divisions.org[tr];
    stepBattles(l, g.ticks());
    const lost = before - l.divisions.org[tr];
    // The same hits, with and without the armour.
    const hits = roundHits(
      applyBp(attackValue(ps.soft, ps.hard, ts.hardnessPm), polMods.attackBp),
      applyBp(ts.brk, tankMods.defenseBp),
    );
    expect(hits).toBeGreaterThan(0);
    expect(lost).toBe(roundDamage(hits, true).orgMilli);
    const unarmoured = roundDamage(hits, false).orgMilli;
    expect(Math.abs(lost * 2 - unarmoured)).toBeLessThanOrEqual(1);
  }, 60_000);

  test("the line holds its width and reserves wait a round", async () => {
    const { g, l } = await juneWar();
    const a = placeArmy(g, "DEU", 3, 6);
    placeArmy(g, "POL", WARSAW, 5);
    attack(l, a, WARSAW);
    const b = l.battles.get(WARSAW)!;
    stepBattles(l, g.ticks());
    // Plains, one direction: width 90. Three divisions of 24 fill 72; the
    // fourth stands (18 left ≥ 8 = a third of 24); the fifth waits.
    const s = l.battleSummary(b);
    expect(s.width).toBe(90);
    expect([s.attLine, s.attReserve, s.attWidth]).toEqual([4, 2, 96]);
    expect([s.defLine, s.defReserve, s.defWidth]).toEqual([5, 0, 90]);
    const fresh = a.divisions.filter((id) => !b.attLine.includes(id));
    expect(fresh).toHaveLength(2);
    const full = fresh.map((id) => l.divisions.org[rowOf(l, id)]);
    expect(full).toEqual(fresh.map((id) => l.orgMaxOf(rowOf(l, id))));
    // The reserve keeps waiting while the line holds.
    stepBattles(l, g.ticks());
    expect(fresh.some((id) => b.attLine.includes(id))).toBe(false);
    // One of the line goes: the first reserve steps in the next round,
    // but strikes (and is struck) only from the round after.
    l.killDivision(rowOf(l, b.attLine[0]), false);
    stepBattles(l, g.ticks());
    expect(b.attLine).toContain(fresh[0]);
    expect(b.attLine).not.toContain(fresh[1]);
    expect(l.divisions.org[rowOf(l, fresh[0])]).toBe(full[0]);
    stepBattles(l, g.ticks());
    expect(l.divisions.org[rowOf(l, fresh[0])]).toBeLessThan(full[0]);
  }, 60_000);

  test("a paradropped attacker fights inside the region", async () => {
    const { g, l, deu } = await juneWar();
    const a = placeArmy(g, "DEU", 3, 1);
    const d = placeArmy(g, "POL", WARSAW, 1);
    const r = rowOf(l, a.divisions[0]);
    // As a paradrop lands (plan decision 19): in Warsaw, 40% org.
    l.setDivisionRegion(r, WARSAW);
    l.divisions.org[r] = Math.floor((l.orgMaxOf(r) * 40) / 100);
    attack(l, a, WARSAW);
    const b = l.battles.get(WARSAW)!;
    expect(b.attackers).toEqual(a.divisions);
    expect(l.divisions.role[r]).toBe(ROLE_ATTACK);
    // No edge crossed: no river, no strait; one direction.
    const input = modInputOf(l, r, WARSAW, true);
    expect([input.river, input.strait]).toEqual([0, false]);
    expect(l.battleSummary(b).directions).toBe(1);
    const pr = rowOf(l, d.divisions[0]);
    const before = l.divisions.org[pr];
    stepBattles(l, g.ticks());
    // It fought from inside: Poland's division is the only defender.
    expect(b.defenders).toEqual(d.divisions);
    expect(l.divisions.org[pr]).toBeLessThan(before);
    // The defence breaks: the paratroopers take Warsaw on the spot.
    l.divisions.org[pr] = 1;
    stepBattles(l, g.ticks());
    expect(l.controller[WARSAW]).toBe(deu);
    const sc = g.worldWar()!.scenario;
    expect(g.ownerID(sc.vpTile(sc.region(WARSAW)!))).toBe(deu);
    expect(l.battles.has(WARSAW)).toBe(false);
  }, 60_000);
});
