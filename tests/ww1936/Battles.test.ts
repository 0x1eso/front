// World War 1936 P2 Task 4: land battles (P2 spec §9). Germany and Poland
// are humans (no AI land war); the board is cleared and each test places
// its divisions. Battles start on 1936-06-01, a clear day in Warsaw and
// Krakow (the tests read the weather where it matters). Rounds the tests
// count run stepBattles directly, so no move, supply or order step comes
// between them; the advances run the game. ww7 lane A: a battle's rounds now
// carry tactics, daily luck and reserve rolls (all seeded); a test that
// counts a round's hits sets `phaseRound` to 1 first (no new tactic pair) and
// reads the luck through TacticRules.luckBp.
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
  armorProtectPm,
  roundDamage,
  roundHits,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  AT_ASSAULT,
  AT_ATTACK,
  AT_BARRAGE,
  AT_BLITZ,
  AT_ENVELOP,
  AT_SHOCK,
  DT_AMBUSH,
  DT_COUNTER,
  DT_DEFEND,
  DT_DEPTH,
  DT_ELASTIC,
  DT_HOLD,
  DT_WITHDRAW,
  luckBp,
  newTacticFx,
  tacticFx,
} from "@openfront/engine-lib/ww1936/TacticRules";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import type { Game } from "@openfront/engine/game/Game";
import {
  battleMods,
  joinBattle,
  modInputOf,
  modsOf,
  refugeOf,
  retreatDivision,
  stepBattles,
} from "@openfront/engine/ww1936/land/Battles";
import { startHopInto } from "@openfront/engine/ww1936/land/Movement";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { lastBand } from "./bandUtil";
import {
  byTag,
  clearLand,
  dropPact,
  gameHash,
  HUMAN,
  land,
  MINI,
  placeArmy,
  stamped,
  step,
  stepTo,
  takeRegion,
  WwHuman,
  wwRestore,
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

/** Germany at war with Poland from 1936-06-01, the board cleared (`gameID` seeds the rolls). */
async function juneWar(gameID?: string) {
  const { runner, updates } = await wwRunnerCapture({}, DEU_POL, MINI, gameID);
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

/** ww9: the exact numbers below are the base stats'; no start slider position. */
function noStartThoughts(): void {
  usePoliticsContent({ ...CONTENT, startThoughts: [] });
}

afterEach(() => usePoliticsContent(null));

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
    noStartThoughts();
    const { g, l, pol, inf72 } = await juneWar();
    expect(weatherOf(g, WARSAW)).toBe("clear");
    const a = placeArmy(g, "DEU", 3, 1, inf72);
    const d = placeArmy(g, "POL", WARSAW, 1);
    attack(l, a, WARSAW);
    const att0 = l.divisions.org[rowOf(l, a.divisions[0])];
    const def0 = l.divisions.org[rowOf(l, d.divisions[0])];
    // Plains, clear, no modifiers: Germany's 92 against Poland's defence
    // 198 is 9.2 hits an hour; Poland's 54 against the breakthrough 33 is
    // 11.7. A round is 1.829 hours, 0.052 org a hit (ww7 lane F). (No tactic
    // pair yet, only the luck on each side's attack.)
    const b = l.battles.get(WARSAW)!;
    b.phaseRound = 1;
    const luck = (side: number) =>
      10_000 +
      luckBp(
        l.ww.politics.seed,
        WARSAW,
        b.sinceTick,
        l.ww.day(g.ticks()),
        side,
      );
    stepBattles(l, g.ticks());
    expect(def0 - l.divisions.org[rowOf(l, d.divisions[0])]).toBe(
      roundDamage(
        roundHits(
          applyBp(9200, luck(0)),
          19_800,
          modsOf(l, rowOf(l, d.divisions[0]), WARSAW, false).prepBp ?? 0,
        ),
      ).orgMilli,
    );
    expect(att0 - l.divisions.org[rowOf(l, a.divisions[0])]).toBe(
      roundDamage(roundHits(applyBp(5400, luck(1)), 3300)).orgMilli,
    );
    // Without the luck they are the spec's 920 and 1170 hits.
    expect(roundHits(9200, 19_800)).toBe(920);
    expect(roundHits(5400, 3300)).toBe(1170);
    let rounds = 1;
    while (l.battles.has(WARSAW)) {
      stepBattles(l, g.ticks());
      expect(++rounds).toBeLessThan(150);
    }
    expect(l.controller[WARSAW]).toBe(pol);
    const att = rowOf(l, a.divisions[0]);
    const def = rowOf(l, d.divisions[0]);
    expect(l.divisions.org[att]).toBe(0);
    expect(l.divisions.org[def]).toBeGreaterThan(0);
    // Spec §9.10: 31 hours against the defender's 50 (rounds of 1.829 h);
    // ww7 lane F: ÷ 0.4 for the pace, within the band's luck.
    expect(rounds).toBeGreaterThanOrEqual(25);
    expect(rounds).toBeLessThanOrEqual(75);
    expect(l.divisions.org[def]).toBeLessThan(l.orgMaxOf(def));
    // Both stay where they are, out of the battle.
    expect(l.divisions.region[att]).toBe(3);
    expect(l.divisions.region[def]).toBe(WARSAW);
    expect([l.divisions.battle[att], l.divisions.battle[def]]).toEqual([0, 0]);
  }, 60_000);

  test("two directions break the defence", async () => {
    const { runner, g, l, deu, pol, inf72 } = await juneWar();
    // The last of Warsaw's bands (bands: Bands.test.ts).
    lastBand(l, WARSAW, deu);
    // ww7 lane F: against three, sure of it; the spec's five (ρ 1.15) fall seven times in ten.
    const north = placeArmy(g, "DEU", 3, 4, inf72);
    const south = placeArmy(g, "DEU", 4, 3, inf72);
    const d = placeArmy(g, "POL", WARSAW, 3);
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
    // Poland's three fell back to Krakow or were destroyed.
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

  test("ww7 lane F: a defender broken before the battle does not keep the attackers out", async () => {
    const { runner, g, l, deu, inf72 } = await juneWar();
    lastBand(l, WARSAW, deu);
    const a = placeArmy(g, "DEU", 3, 2, inf72);
    const d = placeArmy(g, "POL", WARSAW, 1);
    const t = l.divisions;
    // No org, and (in a pocket, within the day) none coming back.
    const row = () => rowOf(l, d.divisions[0]);
    const broken = () => {
      if (row() >= 0) t.org[row()] = 0;
    };
    broken();
    attackPlan(l, a, WARSAW);
    attack(l, a, WARSAW);
    for (let i = 0; i < 3; i++) {
      broken();
      step(runner);
    }
    // It goes at once. Before, it stood: the battle opened and closed every tick.
    expect(row() < 0 || t.mode[row()] === MOVE_RETREAT).toBe(true);
    const until = g.ticks() + 75;
    while (l.controller[WARSAW] !== deu) {
      expect(g.ticks()).toBeLessThan(until);
      step(runner);
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
    // Twenty days: the plan walks into empty Warsaw, and Poland (21 of its
    // 24 points lost) capitulates after 23 days (ww7: 2 a day towards 45),
    // which would hand Krakow over.
    for (let i = 0; i < 150; i++) {
      step(runner);
      if (ended < 0 && !l.battles.has(KRAKOW)) ended = i;
      expect(l.controller[KRAKOW]).toBe(pol);
    }
    // The attack broke well within the month.
    expect(ended).toBeGreaterThan(0);
    expect(ended).toBeLessThan(150);
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
    const { g, l, deu } = await juneWar();
    lastBand(l, WARSAW, deu);
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

  test("casualtyReturnPp returns more of the lost men to the manpower pool", async () => {
    const pool = async (pp: number) => {
      const { g, l, pol } = await juneWar();
      const a = placeArmy(g, "DEU", 3, 1);
      placeArmy(g, "POL", WARSAW, 1);
      const ce = l.econ.country(pol)!;
      ce.stats.casualtyReturnPp = pp;
      const before = ce.manpower;
      attack(l, a, WARSAW);
      stepBattles(l, g.ticks());
      return {
        back: ce.manpower - before,
        lost: l.country(pol)!.casualtiesToday,
      };
    };
    const base = await pool(0);
    const more = await pool(30);
    expect(more.lost).toBe(base.lost);
    expect(base.back).toBeGreaterThan(0);
    expect(more.back).toBeGreaterThan(base.back);
  }, 60_000);

  test("no friendly neighbour means destruction", async () => {
    const { runner, updates, g, l, deu, pol } = await juneWar();
    lastBand(l, WARSAW, deu);
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

  test("a retreat picks a neighbour over land, without a battle, then the nearest, then the most supply (Task 11)", async () => {
    const { g, l } = await juneWar();
    // A German division in Warsaw, German Berlin (3, 163 km) and Munich
    // (4, 193 km) next door.
    takeRegion(g, WARSAW, "DEU");
    const [id] = placeArmy(g, "DEU", WARSAW, 1).divisions;
    const r = rowOf(l, id);
    l.supplyMilli[3] = 500;
    l.supplyMilli[4] = 500;
    expect(refugeOf(l, r)).toBe(3);
    // The nearest first, supply second (controller ruling 5: HOI4 falls
    // back into the adjacent friendly province).
    l.supplyMilli[4] = 800;
    expect(refugeOf(l, r)).toBe(3);
    // A Polish attack on Berlin: Munich, the neighbour without a battle.
    const [pole] = placeArmy(g, "POL", KRAKOW, 1).divisions;
    l.setDivisionRegion(rowOf(l, pole), WARSAW);
    joinBattle(l, pole, 3);
    expect(l.battles.has(3)).toBe(true);
    expect(refugeOf(l, r)).toBe(4);
    // Encircled with Berlin in the pocket: only Berlin.
    l.divisions.encircled[r] = 1;
    l.encircled[3] = 1;
    l.encircled[4] = 0;
    expect(refugeOf(l, r)).toBe(3);
    l.divisions.encircled[r] = 0;
    retreatDivision(l, r);
    expect([l.divisions.mode[r], l.divisions.next[r]]).toEqual([
      MOVE_RETREAT,
      4,
    ]);
    // Over land before a strait: a French division in Lyon falls back to
    // Paris (200 km), not over the strait to British London (156 km);
    // with Paris lost, London.
    stockUp(g, "FRA");
    const LYON = 2;
    const PARIS = 1;
    const LONDON = 10;
    const [fr] = placeArmy(g, "FRA", LYON, 1).divisions;
    const f = rowOf(l, fr);
    expect(l.sameSide(byTag(g, "FRA").smallID(), l.controller[LONDON])).toBe(
      true,
    );
    expect(refugeOf(l, f)).toBe(PARIS);
    takeRegion(g, PARIS, "DEU");
    expect(refugeOf(l, f)).toBe(LONDON);
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
    // Lyon falls: the ship sails on and the train rolls on (not overrun:
    // Task 11, a rail mover leaves like a walker), the one standing falls
    // back to Paris, over land before the strait to London (Task 11).
    const refuge = refugeOf(l, rowOf(l, stander));
    expect(refuge).toBe(1);
    takeRegion(g, LYON, "DEU");
    expect(rowOf(l, sailor)).toBe(s);
    expect([t.mode[s], t.next[s], t.prog[s]]).toEqual([
      MOVE_SEA,
      LONDON,
      9_000,
    ]);
    expect(rowOf(l, railer)).toBe(rr);
    expect([t.mode[rr], t.next[rr]]).toEqual([MOVE_RAIL, 1]);
    const st = rowOf(l, stander);
    expect([t.mode[st], t.next[st]]).toEqual([MOVE_RETREAT, refuge]);
  }, 60_000);

  test("encircled divisions at zero org are destroyed", async () => {
    const { g, l, deu } = await juneWar();
    lastBand(l, WARSAW, deu);
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
    // (No new tactic pair; the defender's luck of the day is its attack.)
    b.phaseRound = 1;
    const luck =
      10_000 +
      luckBp(l.ww.politics.seed, WARSAW, b.sinceTick, l.ww.day(g.ticks()), 1);
    stepBattles(l, g.ticks());
    const lost = before - l.divisions.org[tr];
    // The same hits, with and without the armour.
    const hits = roundHits(
      applyBp(
        applyBp(attackValue(ps.soft, ps.hard, ts.hardnessPm), polMods.attackBp),
        luck,
      ),
      applyBp(ts.brk, tankMods.defenseBp),
    );
    expect(hits).toBeGreaterThan(0);
    expect(lost).toBe(roundDamage(hits, 500).orgMilli);
    const unarmoured = roundDamage(hits).orgMilli;
    expect(Math.abs(lost * 2 - unarmoured)).toBeLessThanOrEqual(1);
  }, 60_000);

  test("the line holds its width and reserves wait a round", async () => {
    noStartThoughts();
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
    // One of the line goes: a reserve is let in by its own roll, per division
    // (ww7: 25 % + initiative ÷ 4 …, at most 70 % a round, not for sure as
    // before), so either may be first. Only one fits, some round soon, and it
    // strikes (and is struck) only from the round after.
    l.killDivision(rowOf(l, b.attLine[0]), false);
    const unhurt = () =>
      expect(fresh.map((id) => l.divisions.org[rowOf(l, id)])).toEqual(full);
    let entered = -1;
    for (let i = 0; i < 40 && entered < 0; i++) {
      stepBattles(l, g.ticks());
      entered = fresh.findIndex((id) => b.attLine.includes(id));
      unhurt();
    }
    expect(entered).toBeGreaterThanOrEqual(0);
    expect(b.attLine).not.toContain(fresh[1 - entered]);
    stepBattles(l, g.ticks());
    expect(l.divisions.org[rowOf(l, fresh[entered])]).toBeLessThan(
      full[entered],
    );
  }, 60_000);

  test("a paradropped attacker fights inside the region", async () => {
    const { g, l, deu } = await juneWar();
    lastBand(l, WARSAW, deu);
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

describe("World War 1936 ww7 lane A: tactics, luck and reserves in a battle (design ww6 §2)", () => {
  test("each tactic pair does what the table says to a round's hits and damage", async () => {
    const { g, l, inf72 } = await juneWar();
    const a = placeArmy(g, "DEU", 3, 1, inf72);
    const d = placeArmy(g, "POL", WARSAW, 1);
    attack(l, a, WARSAW);
    const b = l.battles.get(WARSAW)!;
    const ar = rowOf(l, a.divisions[0]);
    const dr = rowOf(l, d.divisions[0]);
    const t = l.divisions;
    const seed = l.ww.politics.seed;
    const pairs: [number, number][] = [
      [AT_ATTACK, DT_DEFEND],
      [AT_ASSAULT, DT_DEFEND],
      [AT_ASSAULT, DT_AMBUSH],
      [AT_SHOCK, DT_ELASTIC],
      [AT_BARRAGE, DT_HOLD],
      [AT_ATTACK, DT_COUNTER],
      [AT_BLITZ, DT_DEPTH],
      [AT_ENVELOP, DT_WITHDRAW],
    ];
    const f = newTacticFx();
    for (const [ta, td] of pairs) {
      // The same two divisions again at full org, the pair forced for the
      // round (phaseRound 1: no new pick).
      t.org[ar] = l.orgMaxOf(ar);
      t.org[dr] = l.orgMaxOf(dr);
      b.tacticAtt = ta;
      b.tacticDef = td;
      b.phaseRound = 1;
      const fx = tacticFx(ta, td, f);
      const day = l.ww.day(g.ticks());
      const mulA = Math.floor(
        ((10_000 + fx.attAtkBp) *
          (10_000 + luckBp(seed, WARSAW, b.sinceTick, day, 0))) /
          10_000,
      );
      const mulD = Math.floor(
        ((10_000 + fx.defAtkBp) *
          (10_000 + luckBp(seed, WARSAW, b.sinceTick, day, 1))) /
          10_000,
      );
      const as = l.statsOf(ar);
      const ds = l.statsOf(dr);
      const am = battleMods(l, b, ar).mods;
      const dm = battleMods(l, b, dr).mods;
      const hitsOnDef = roundHits(
        applyBp(
          applyBp(
            attackValue(
              applyBp(as.soft, 10_000 + fx.attSoftBp),
              as.hard,
              ds.hardnessPm,
            ),
            am.attackBp,
          ),
          mulA,
        ),
        applyBp(applyBp(ds.def, dm.defenseBp), 10_000 + fx.defBlockBp),
        (dm.prepBp ?? 0) + fx.defBlockBp,
      );
      const hitsOnAtt = roundHits(
        applyBp(
          applyBp(attackValue(ds.soft, ds.hard, as.hardnessPm), dm.attackBp),
          mulD,
        ),
        applyBp(as.brk, am.defenseBp),
      );
      const wantDef = applyBp(
        roundDamage(
          hitsOnDef,
          armorProtectPm(ds.armor, ds.hardnessPm, as.pierce),
        ).orgMilli,
        10_000 + fx.defOrgBp,
      );
      const wantAtt = applyBp(
        roundDamage(
          hitsOnAtt,
          armorProtectPm(as.armor, as.hardnessPm, ds.pierce),
        ).orgMilli,
        10_000 + fx.attOrgBp,
      );
      const [ao, dorg] = [t.org[ar], t.org[dr]];
      stepBattles(l, g.ticks());
      const label = `${ta}:${td}`;
      expect(dorg - t.org[dr], label).toBe(wantDef);
      expect(ao - t.org[ar], label).toBe(wantAtt);
      // The pair stays on the battle for the rest of the phase.
      expect([b.tacticAtt, b.tacticDef], label).toEqual([ta, td]);
      expect(b.phaseRound, label).toBe(2);
    }
  }, 120_000);

  test("a landed blitz halves the defender's entrenchment line, depth stops it", async () => {
    const { g, l, inf72 } = await juneWar();
    const a = placeArmy(g, "DEU", 3, 1, inf72);
    const d = placeArmy(g, "POL", WARSAW, 1);
    attack(l, a, WARSAW);
    const b = l.battles.get(WARSAW)!;
    const dr = rowOf(l, d.divisions[0]);
    l.divisions.entrench[dr] = 4; // ww7 B2: +5% a level
    const entrench = () =>
      battleMods(l, b, dr).defenseLines.find((x) => x.id === "entrench")?.bp;
    b.tacticAtt = AT_ATTACK;
    b.tacticDef = DT_DEFEND;
    expect(entrench()).toBe(2000);
    b.tacticAtt = AT_BLITZ;
    expect(entrench()).toBe(1000);
    b.tacticDef = DT_DEPTH;
    expect(entrench()).toBe(2000);
    // The attacker's own lines never carry it.
    b.tacticDef = DT_DEFEND;
    const ar = rowOf(l, a.divisions[0]);
    expect(
      battleMods(l, b, ar).defenseLines.find((x) => x.id === "entrench"),
    ).toBeUndefined();
  }, 60_000);

  test("the same seed fights the same battle, another seed another one", async () => {
    /** Seven against five from two directions, to the end; what it leaves. */
    async function duel(gameID: string) {
      const { g, l, inf72 } = await juneWar(gameID);
      const north = placeArmy(g, "DEU", 3, 4, inf72);
      const south = placeArmy(g, "DEU", 4, 3, inf72);
      const d = placeArmy(g, "POL", WARSAW, 5);
      attack(l, north, WARSAW);
      attack(l, south, WARSAW);
      const b = l.battles.get(WARSAW)!;
      const picks: number[] = [];
      let rounds = 0;
      while (l.battles.has(WARSAW) && rounds < 200) {
        stepBattles(l, g.ticks());
        rounds++;
        if (b.phaseRound === 1) picks.push(b.tacticAtt * 10 + b.tacticDef);
      }
      const orgOf = (ids: readonly number[]) =>
        ids.map((id) => {
          const r = rowOf(l, id);
          return r < 0 ? -1 : l.divisions.org[r];
        });
      return {
        rounds,
        picks,
        att: orgOf([...north.divisions, ...south.divisions]),
        def: orgOf(d.divisions),
      };
    }
    const first = await duel("LUCKSEED01");
    const again = await duel("LUCKSEED01");
    expect(again).toEqual(first);
    expect(first.rounds).toBeGreaterThan(8);
    expect(first.picks.length).toBeGreaterThan(1);
    const others = [await duel("LUCKSEED02"), await duel("LUCKSEED03")];
    const key = (r: typeof first) => JSON.stringify([r.rounds, r.att, r.def]);
    // Luck makes the same fight different from seed to seed.
    expect(new Set([first, ...others].map(key)).size).toBeGreaterThanOrEqual(2);
  }, 240_000);

  test("a snapshot in the middle of a tactic phase continues tick for tick", async () => {
    const { runner, g, l, inf72 } = await juneWar("PHASEGAME1");
    const a = placeArmy(g, "DEU", 3, 5, inf72);
    placeArmy(g, "POL", WARSAW, 5);
    attack(l, a, WARSAW);
    const b = l.battles.get(WARSAW)!;
    step(runner, 6);
    // Mid-phase: a pair is in play and the phase has rounds to go.
    expect(l.battles.has(WARSAW)).toBe(true);
    expect(b.round).toBeGreaterThanOrEqual(5);
    expect(b.phaseRound).toBeGreaterThan(0);
    expect(b.phaseRound).toBeLessThan(4);
    const copy = await wwRestore(runner, DEU_POL);
    const l2 = land(copy.game);
    const b2 = l2.battles.get(WARSAW)!;
    expect([b2.round, b2.phaseRound, b2.tacticAtt, b2.tacticDef]).toEqual([
      b.round,
      b.phaseRound,
      b.tacticAtt,
      b.tacticDef,
    ]);
    expect(gameHash(copy)).toBe(gameHash(runner));
    for (let i = 0; i < 14; i++) {
      step(runner);
      step(copy);
      expect(gameHash(copy), `tick +${i + 1}`).toBe(gameHash(runner));
    }
    const live = l.battles.get(WARSAW);
    const back = l2.battles.get(WARSAW);
    expect(back === undefined).toBe(live === undefined);
    if (live !== undefined && back !== undefined) {
      expect(l2.battleSummary(back)).toEqual(l.battleSummary(live));
      expect(back.phaseRound).toBe(live.phaseRound);
    }
  }, 120_000);

  test("the battle card gets the odds, the range, the tactics and the initiative", async () => {
    const { g, l, inf72 } = await juneWar();
    const a = placeArmy(g, "DEU", 3, 6, inf72);
    placeArmy(g, "POL", WARSAW, 4);
    attack(l, a, WARSAW);
    const b = l.battles.get(WARSAW)!;
    for (let i = 0; i < 6; i++) stepBattles(l, g.ticks());
    const s = l.battleSummary(b);
    expect(s.lowPm!).toBeLessThanOrEqual(s.midPm!);
    expect(s.midPm!).toBeLessThanOrEqual(s.highPm!);
    expect(s.winPct!).toBeGreaterThanOrEqual(0);
    expect(s.winPct!).toBeLessThanOrEqual(100);
    for (const v of [s.initAtt!, s.initDef!]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    // No general, no companies: 20 + the experience and research of the line.
    expect(s.initAtt!).toBeGreaterThanOrEqual(20);
    expect(s.reinfPct!).toBeGreaterThanOrEqual(25 + Math.floor(s.initAtt! / 4));
    expect(s.tacticAtt ?? 0).toBe(b.tacticAtt);
    expect(s.tacticDef ?? 0).toBe(b.tacticDef);
    // A battle with a side missing says nothing of the odds.
    const empty = l.battleSummary({ ...b, attackers: [], attLine: [] });
    expect(empty.winPct).toBeUndefined();
  }, 60_000);
});
