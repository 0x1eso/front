// World War 1936 P2 foundation (plan Task 1 Step 21): the land war wired
// into the game — vanilla war turned off, the troop mirror, the 1936 order
// of battle, control and its victory-point tile, capitulation, the level
// buildings, the orders' path, the stats caches and the land hash.
import { PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  WW_DAY_SPLIT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  groundSlotOf,
  MOVE_WALK,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { MAJOR_START } from "@openfront/engine-lib/ww1936/EconomyStart";
import { GENERALS, rosterOf } from "@openfront/engine-lib/ww1936/Generals";
import { AllianceRequestExecution } from "@openfront/engine/execution/alliance/AllianceRequestExecution";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import type { Game } from "@openfront/engine/game/Game";
import { queueBuild } from "@openfront/engine/ww1936/economy/Construction";
import { applyWwOrder } from "@openfront/engine/ww1936/economy/WwOrderExecution";
import { startHopInto } from "@openfront/engine/ww1936/land/Movement";
import { WwLandView } from "../../src/client/view/WwLandView";
import { playerInfo, setup } from "../util/Setup";
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
  warAfterPrep,
  wwRunner,
  wwRunnerCapture,
} from "./util";

const HUMAN_POL = "HUMAN002";
const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: HUMAN_POL, country: "POL" as const },
];

/** Runs until every country has had day `d`'s step. */
function finishDay(runner: Awaited<ReturnType<typeof wwRunner>>, d: number) {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}

const vpTile = (g: Game, id: number) =>
  g.worldWar()!.scenario.vpTile(g.worldWar()!.scenario.region(id)!);

describe("World War 1936 P2: the land war's wiring", () => {
  test("vanilla attacks and boats are refused in World War 1936", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    const g = runner.game;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    warAfterPrep(runner, HUMAN, "POL");
    expect(g.worldWar()!.isAtWar(deu.smallID(), pol.smallID())).toBe(true);
    const polTiles = pol.numTilesOwned();
    const troops = deu.troops();
    const attack = stamped(HUMAN, {
      type: "attack",
      targetID: pol.id(),
      troops: 100_000,
    });
    const boat = stamped(HUMAN, {
      type: "boat",
      troops: 100_000,
      dst: g.ref(105, 99),
    });
    step(runner, 1, [attack, boat, attack, boat]);
    step(runner, 50);
    expect(pol.numTilesOwned()).toBe(polTiles);
    expect(deu.outgoingAttacks()).toHaveLength(0);
    expect(g.units(UnitType.TransportShip)).toHaveLength(0);
    expect(deu.troops()).toBe(troops);
    const notes = updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_no_tile_attacks");
    expect(notes).toHaveLength(1);
    expect(notes[0].playerID).toBe(deu.smallID());
  });

  test("vanilla rules untouched when the mode is off", async () => {
    const game = await setup(
      "plains",
      { donateTroops: true, infiniteTroops: false },
      [
        playerInfo("player1", PlayerType.Human),
        playerInfo("player2", PlayerType.Human),
      ],
    );
    expect(game.worldWar()).toBeNull();
    const [p1, p2] = [game.player("player1"), game.player("player2")];
    p1.conquer(game.ref(50, 50));
    p2.conquer(game.ref(50, 51));
    p1.addTroops(10_000);
    expect(p1.wwTroopCap()).toBeNull();
    game.addExecution(new AttackExecution(5_000, p1, p2.id()));
    for (let i = 0; i < 20; i++) game.executeNextTick();
    expect(p1.numTilesOwned()).toBeGreaterThan(1);
    // Troop donations follow the vanilla rules: between allies.
    const q1 = game.player("player1");
    const q2 = game.player("player2");
    if (q2.isAlive()) {
      game.addExecution(new AllianceRequestExecution(q1, q2.id()));
      game.executeNextTick();
      game.addExecution(new AllianceRequestExecution(q2, q1.id()));
      game.executeNextTick();
      expect(q1.canDonateTroops(q2)).toBe(q1.isAlliedWith(q2));
    }
  });

  test("the troop number mirrors the field divisions", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const deu = byTag(g, "DEU");
    finishDay(runner, 0);
    expect(deu.troops()).toBe(land(g).fieldMen(deu.smallID()));
    // The start's men less the day's winter attrition (P2 Task 5).
    expect(deu.troops()).toBe(
      472_500 - land(g).country(deu.smallID())!.casualtiesToday,
    );
    expect(g.config().maxTroops(deu)).toBe(deu.troops());
    expect(deu.wwTroopCap()).toBe(deu.troops());
    expect(g.config().troopIncreaseRate(deu)).toBe(0);
  });

  test("troop donations are refused, gold still flows", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS + 1);
    const [deu, ita] = [byTag(g, "DEU"), byTag(g, "ITA")];
    expect(deu.isFriendly(ita)).toBe(true);
    expect(deu.canDonateTroops(ita)).toBe(false);
    expect(deu.canDonateGold(ita)).toBe(true);
  });

  test("trade ships and defence posts never appear", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    step(runner, 2000);
    expect(g.units(UnitType.TradeShip)).toHaveLength(0);
    expect(g.units(UnitType.TransportShip)).toHaveLength(0);
    expect(g.config().isUnitDisabled(UnitType.DefensePost)).toBe(true);
  });

  test("the 1936 order of battle is fielded at the start", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const l = land(g);
    const id = (tag: "DEU" | "POL" | "ITA" | "FRA" | "SUN" | "GBR") =>
      byTag(g, tag).smallID();
    const divisions = (tag: Parameters<typeof id>[0]) =>
      l.countrySummary(l.country(id(tag))!).divisions;
    expect(divisions("DEU")).toBe(45);
    expect(divisions("POL")).toBe(8);
    expect(divisions("ITA")).toBe(50);
    expect(divisions("FRA")).toBe(50);
    expect(divisions("SUN")).toBe(50);
    expect(divisions("GBR")).toBe(22);
    // Germany: 1st Army (24, Berlin, Rundstedt), 2nd Army (21, Munich —
    // next to Italy, the smaller id of the two 50-division neighbours, Bock).
    const deu = l.armiesOf(id("DEU"));
    expect(
      deu.map((a) => [
        a.nameNo,
        a.divisions.length,
        l.armyRegion(a),
        a.general,
      ]),
    ).toEqual([
      [1, 24, 3, 1],
      [2, 21, 4, 2],
    ]);
    // France: Paris, Lyon (next to Italy), Paris again.
    expect(l.armiesOf(id("FRA")).map((a) => l.armyRegion(a))).toEqual([
      1, 2, 1,
    ]);
    // Poland: one army in Warsaw under its best general serving in 1936
    // (Task 10's roster: Sosnkowski).
    const pol = l.armiesOf(id("POL"));
    expect(
      pol.map((a) => [a.divisions.length, l.armyRegion(a), a.general]),
    ).toEqual([[8, 6, GENERALS.findIndex((x) => x.id === "sosnkowski") + 1]]);
    // Germany's men and rifles came from its pool and stock.
    const ce = l.econ.country(id("DEU"))!;
    expect(ce.manpower).toBe(1_675_000 - 45 * 10_500);
    expect(ce.stock[equipKey("infantry_equipment", 1)]).toBe(
      MAJOR_START.DEU!.infReserve + 48_000 - 45 * 900,
    );
    // Every division at full men and org; the equipment as far as the
    // stock went (Germany's 1,000 support equipment fill the first 28).
    const t = l.divisions;
    const strength: number[] = [];
    for (let r = 0; r < t.rows; r++) {
      if (!t.alive(r) || t.owner[r] !== id("DEU")) continue;
      expect(t.men[r]).toBe(10_500);
      expect(t.org[r]).toBe(l.orgMaxOf(r));
      strength.push(l.strengthOf(r));
    }
    expect(strength.slice(0, 28).every((s) => s === 1000)).toBe(true);
    expect(strength[44]).toBeLessThan(1000);
    expect(ce.stock[equipKey("support_equipment", 1)]).toBeLessThan(35);
    // The land techs (spec §4.6).
    expect(ce.researched.has("engineer_company")).toBe(true);
    expect(ce.researched.has("mountaineers")).toBe(true);
    expect(l.econ.country(id("FRA"))!.researched.has("fortification_1")).toBe(
      true,
    );
    expect(l.econ.country(id("POL"))!.researched.has("engineer_company")).toBe(
      false,
    );
  });

  test("a capture moves the victory-point tile in the same tick", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const deu = byTag(g, "DEU");
    warAfterPrep(runner, HUMAN, "POL");
    takeRegion(g, 6, "DEU");
    expect(land(g).controller[6]).toBe(deu.smallID());
    expect(g.ownerID(vpTile(g, 6))).toBe(deu.smallID());
    expect(land(g).controlChanges).toBe(1);
    // P1's economy copies it at its next day (plan decision 9).
    const day = g.worldWar()!.day(g.ticks());
    stepTo(runner, dayStartTick(day + 1, WW_PREP_TICKS) + 1);
    expect(g.worldWar()!.economy.controller[6]).toBe(deu.smallID());
  });

  test("capitulation hands every region over the same tick", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    warAfterPrep(runner, HUMAN, "POL");
    takeRegion(g, 6, "DEU");
    expect(land(g).fieldMen(pol.smallID())).toBeGreaterThan(0);
    while (!ww.isCapitulated(pol.smallID())) {
      expect(g.ticks()).toBeLessThan(2000);
      step(runner);
    }
    // The tick it capitulated.
    expect(land(g).controller[7]).toBe(deu.smallID());
    expect(g.ownerID(vpTile(g, 7))).toBe(deu.smallID());
    expect(land(g).fieldMen(pol.smallID())).toBe(0);
    expect(land(g).armiesOf(pol.smallID())).toEqual([]);
  });

  test("forts, rail and hubs are level buildings", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const ce = econ.country(byTag(g, "DEU").smallID())!;
    expect([econ.fort[1], econ.rail[3], econ.rail[7], econ.hub[3]]).toEqual([
      2, 3, 0, 0,
    ]);
    expect(queueBuild(econ, ce, 3, "fort", 2)).toBeNull();
    expect(queueBuild(econ, ce, 3, "fort", 4)).toBe("infra_max");
    expect(queueBuild(econ, ce, 3, "supply_hub", 2)).toBe("infra_max");
    expect(queueBuild(econ, ce, 3, "supply_hub", 1)).toBeNull();
    // Occupied Warsaw: a railway, but no factory.
    warAfterPrep(runner, HUMAN, "POL");
    takeRegion(g, 6, "DEU");
    finishDay(runner, 1);
    expect(econ.isOccupied(6)).toBe(true);
    expect(queueBuild(econ, ce, 6, "rail", 1)).toBeNull();
    expect(queueBuild(econ, ce, 6, "mil", 1)).toBe("occupied");
    // fortification_1: forts go up a third faster.
    const fort = () => ce.queue.find((q) => q.building === "fort")!;
    finishDay(runner, 2);
    const before = fort().lastSpeedPct;
    ce.addTech("fortification_1");
    finishDay(runner, 3);
    expect(fort().lastSpeedPct).toBe(before + 33);
  });

  test("a level building completes into its own array", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const ce = econ.country(byTag(g, "DEU").smallID())!;
    expect(queueBuild(econ, ce, 3, "supply_hub", 1)).toBeNull();
    ce.queue[ce.queue.length - 1].progress = 6_000_000 - 1;
    // Its turn to build comes first: nothing else ahead of it.
    ce.queue = [ce.queue[ce.queue.length - 1]];
    finishDay(runner, 0);
    expect(econ.hub[3]).toBe(1);
    expect(queueBuild(econ, ce, 3, "supply_hub", 1)).toBe("infra_max");
  });

  test("the P1 bridge is gone", async () => {
    const runner = await wwRunner();
    finishDay(runner, 0);
    const snap = runner.game.worldWar()!.economy.snapshot();
    // Exactly these fields (plan decision 12: the field infantry, the
    // pending losses, the troop and training caps, the draft and the combat
    // percentages are gone; Review Focus 8 greps for their names).
    expect(Object.keys(snap.countries[0]).sort()).toEqual(
      [
        "smallID",
        "laws",
        "lawCooldownUntil",
        "manpower",
        "casualties",
        "stock",
        "lines",
        "nextLineId",
        "queue",
        "slots",
        "researched",
        "totals",
        // P4: naval lines, planes out, fuel.
        "navalLines",
        "nextNavalLineId",
        "docksLent",
        "planesDeployed",
        "fuelMilli",
        "fuelGainMilli",
        "fuelUseMilli",
        "fuelLedgerMilli",
        "fuelLedgerKinds",
        "fuelRatioPm",
        "fuelShortDay",
      ].sort(),
    );
    expect(Object.keys(snap.countries[0].totals).sort()).toEqual(
      [
        "civ",
        "mil",
        "dock",
        "idleMil",
        "recruitable",
        "produced",
        "exported",
        "imported",
        "used",
        "cgMilli",
        "paidCivs",
        "receivedCivs",
        "freeCivMilli",
        "slotCount",
        "warDays",
      ].sort(),
    );
  });
});

describe("World War 1936 P2: the land war's state", () => {
  test("a land order goes through ww_order to land.issue", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const deu = byTag(g, "DEU");
    const a = ww.land.armiesOf(deu.smallID())[0];
    expect(
      applyWwOrder(g, ww.economy, deu, { kind: "army_halt", army: 999 }, 0),
    ).toBe("no_army");
    // Another country's army is not ours.
    const polArmy = ww.land.armiesOf(byTag(g, "POL").smallID())[0];
    expect(
      applyWwOrder(
        g,
        ww.economy,
        deu,
        { kind: "army_halt", army: polArmy.id },
        0,
      ),
    ).toBe("no_army");
    expect(
      applyWwOrder(g, ww.economy, deu, { kind: "army_halt", army: a.id }, 0),
    ).toBeNull();
    // Through the intent too.
    const sent: string[] = [];
    const issue = ww.land.issue.bind(ww.land);
    ww.land.issue = (id, order, by) => {
      sent.push(`${id}:${order.kind}:${by}`);
      return issue(id, order, by);
    };
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "army_auto", army: a.id, on: true },
      }),
    ]);
    expect(sent).toEqual([`${deu.smallID()}:army_auto:player`]);
    // A capitulated country orders nothing.
    ww.addCapitulation(deu.smallID(), 0, g.ticks());
    expect(ww.land.issue(deu.smallID(), { kind: "appoint_general" })).toBe(
      "dead",
    );
  });

  test("divisions by region follow spawns, moves and kills", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const rebuilt = () => {
      const out = new Map<number, number[]>();
      const t = l.divisions;
      for (let r = 0; r < t.rows; r++) {
        if (!t.alive(r)) continue;
        const list = out.get(t.region[r]) ?? [];
        list.push(r);
        out.set(t.region[r], list);
      }
      return out;
    };
    const check = () => {
      const want = rebuilt();
      for (const reg of g.worldWar()!.scenario.landRegions) {
        expect([...l.rowsIn(reg.id)], `region ${reg.id}`).toEqual(
          want.get(reg.id) ?? [],
        );
      }
    };
    check();
    const a = placeArmy(g, "DEU", 4, 3);
    check();
    const rows = a.divisions.map((d) => l.divisions.rowOf(d));
    l.setDivisionRegion(rows[1], 3);
    l.setDivisionRegion(l.rowsIn(3)[0], 4);
    check();
    l.killDivision(rows[0], false);
    l.killDivision(l.rowsIn(6)[2], false);
    check();
    // The daily compaction moves rows: the lists follow.
    finishDay(runner, 1);
    check();
    expect(l.divisions.rows).toBe(l.divisions.count());
  });

  test("the stats caches follow men, equipment, template and techs", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    clearLand(g);
    const a = placeArmy(g, "DEU", 3, 1);
    const r = l.divisions.rowOf(a.divisions[0]);
    const full = l.statsOf(r);
    expect(full.soft).toBeGreaterThan(0);
    // A write without touchDivision is still seen (pre-flight U8).
    l.divisions.men[r] = 5_250;
    expect(l.statsOf(r).hpMilli).toBe(Math.floor(full.hpMilli / 2));
    const art = groundSlotOf(equipKey("artillery", 1));
    l.divisions.equip[r * GROUND_SLOTS + art] = 0;
    expect(l.statsOf(r).soft).toBeLessThan(full.soft);
    // Through the helpers.
    l.setMen(r, 10_500);
    l.addEquip(r, art, 24);
    expect(l.statsOf(r)).toEqual(full);
    // A stats change the same day (P6 plan decision 25: firepower_1 is
    // retired; the proximity fuze's artillery soft attack, the depth part).
    const deuId = byTag(g, "DEU").smallID();
    const ww = g.worldWar()!;
    ww.depth.country(deuId)!.proj.done |=
      1 << SPECIAL_PROJECTS.indexOf("sp_proximity_fuze");
    ww.politics.recomputeStats(deuId);
    expect(l.statsOf(r).soft).toBeGreaterThan(full.soft);
    const tpl = l.templateStatsOf(byTag(g, "DEU").smallID(), 1)!;
    expect(tpl.soft).toBe(l.statsOf(r).soft);
    // A template replaced: its numbers again.
    const cl = l.country(byTag(g, "DEU").smallID())!;
    cl.templates[0].def = { name: "", battalions: ["infantry"], support: [] };
    expect(l.baseStatsOf(r).width).toBe(2);
    expect(l.templateStatsOf(byTag(g, "DEU").smallID(), 1)!.width).toBe(2);
  });

  test("the land hash sees divisions, control, armies and battles", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const a = placeArmy(g, "DEU", 3, 1);
    const base = l.hash();
    const r = l.divisions.rowOf(a.divisions[0]);
    const changes: [string, () => void, () => void][] = [
      ["men", () => (l.divisions.men[r] += 1), () => (l.divisions.men[r] -= 1)],
      ["org", () => (l.divisions.org[r] += 1), () => (l.divisions.org[r] -= 1)],
      ["control", () => (l.controlChanges += 1), () => (l.controlChanges -= 1)],
      [
        "army region",
        () => l.setDivisionRegion(r, 6),
        () => l.setDivisionRegion(r, 3),
      ],
    ];
    for (const [what, change, undo] of changes) {
      change();
      expect(l.hash(), what).not.toBe(base);
      undo();
      expect(l.hash(), what).toBe(base);
    }
    l.addBattle({
      region: 6,
      sinceTick: 0,
      round: 0,
      attackers: [],
      defenders: [],
      attLine: [],
      defLine: [],
      startOrgMilli: 0,
      lostOrgMilli: 5,
      attLead: 1,
      defLead: 6,
    });
    expect(l.hash()).not.toBe(base);
    l.endBattle(6);
    expect(l.hash()).toBe(base);
  });

  test("the screens get every army, region and country first, then the changes", async () => {
    const { runner, updates } = await wwRunnerCapture({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const view = new WwLandView(g.worldWar()!.scenario);
    step(runner, 3);
    const first = updates.flatMap((u) => u.updates[GameUpdateType.WwLand]);
    expect(first).toHaveLength(1);
    view.apply(first[0].data, 0);
    expect(view.armies.size).toBe(l.armies.size);
    expect(view.regions.size).toBe(g.worldWar()!.scenario.landRegions.length);
    // P5 plan decision 3: the 6 countries and the 14 dormant slots.
    expect(view.countries.size).toBe(20);
    // Human countries get their details.
    expect([...view.details.keys()].sort()).toEqual(
      [byTag(g, "DEU").smallID(), byTag(g, "POL").smallID()].sort(),
    );
    const deuArmy = l.armiesOf(byTag(g, "DEU").smallID())[0];
    const summary = view.armies.get(deuArmy.id)!;
    expect(summary).toMatchObject({
      owner: byTag(g, "DEU").smallID(),
      divisions: 24,
      strengthPm: 1000,
      orgPm: 1000,
      region: 3,
      move: null,
      // Germany's infantry division: infantry battalions most.
      symbol: 0,
    });
    expect(summary.mine).not.toBeNull();
    expect(summary.sum.divisions).toBe(24);
    // An AI's army carries no orders.
    const itaArmy = l.armiesOf(byTag(g, "ITA").smallID())[0];
    expect(view.armies.get(itaArmy.id)!.mine).toBeNull();
    const detail = view.details.get(byTag(g, "DEU").smallID())!;
    expect(detail.templates.map((t) => [t.key, t.inUse])).toEqual([
      ["infantry", 45],
      ["armored", 0],
      ["mountain", 0],
      ["cavalry", 0],
      ["pre_mot_infantry", 0],
      ["pre_anti_tank_infantry", 0],
    ]);
    // Germany's whole roster (Task 10), best first; the two seed rows lead
    // the ones serving in 1936.
    expect(detail.generals.map((x) => x.key)).toEqual(
      rosterOf("DEU").map((id) => GENERALS[id - 1].id),
    );
    expect(
      detail.generals.filter((x) => x.from === -1).map((x) => x.key),
    ).toEqual([
      "rundstedt",
      "bock",
      "kluge",
      "heinrici",
      "geyr",
      "witzleben",
      "wietersheim",
    ]);
    expect(detail.divisions).toHaveLength(45);
    // Quiet ticks send nothing.
    const n = updates.length;
    step(runner, 3);
    expect(
      updates.slice(n).flatMap((u) => u.updates[GameUpdateType.WwLand]),
    ).toEqual([]);
    // A capture reaches the screens.
    dropPact(g, "DEU", "POL");
    stepTo(runner, WW_PREP_TICKS + 1);
    step(runner, 1, [
      stamped(HUMAN, {
        type: "declare_war",
        target: byTag(g, "POL").id(),
      }),
    ]);
    takeRegion(g, 7, "DEU");
    step(runner);
    for (const u of updates.slice(n)) {
      for (const e of u.updates[GameUpdateType.WwLand])
        view.apply(e.data, u.tick);
    }
    expect(view.controller[7]).toBe(byTag(g, "DEU").smallID());
  });

  test("a division walks into an empty enemy region and takes it on arrival", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const deu = byTag(g, "DEU");
    warAfterPrep(runner, HUMAN, "POL");
    clearLand(g);
    const a = placeArmy(g, "DEU", 3, 1);
    const r = l.divisions.rowOf(a.divisions[0]);
    startHopInto(l, r, 6, MOVE_WALK);
    // Berlin → Warsaw: 163 km of plains at the infantry's pace.
    const need = l.divisions.need[r];
    expect(need).toBe(163_000);
    let ticks = 0;
    while (l.controller[6] !== deu.smallID()) {
      expect(ticks++).toBeLessThan(100);
      step(runner);
    }
    const row = l.divisions.rowOf(a.divisions[0]);
    expect(l.divisions.region[row]).toBe(6);
    expect(g.ownerID(vpTile(g, 6))).toBe(deu.smallID());
    // An enemy region with enemy divisions in it is never entered.
    const b = placeArmy(g, "POL", 7, 1);
    void b;
    startHopInto(l, row, 7, MOVE_WALK);
    step(runner, 60);
    expect(l.divisions.region[l.divisions.rowOf(a.divisions[0])]).toBe(6);
    expect(l.controller[7]).toBe(byTag(g, "POL").smallID());
  });

  test("controlBox is the box of the regions a country controls", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const deu = byTag(g, "DEU").smallID();
    expect(l.controlBox(deu)).toMatchObject({
      min: { x: 40, y: 0 },
      max: { x: 89, y: 69 },
    });
    takeRegion(g, 7, "DEU");
    expect(l.controlBox(deu)).toMatchObject({
      min: { x: 40, y: 0 },
      max: { x: 119, y: 99 },
    });
    expect(l.controlBox(0)).toBeNull();
  });
});

describe("World War 1936 P2: a player's general order", () => {
  test("army_general by the player turns auto off; by the AI it does not", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const deu = byTag(g, "DEU");
    const a = l.armiesOf(deu.smallID())[0];
    a.auto = true;
    expect(
      l.issue(
        deu.smallID(),
        { kind: "army_general", army: a.id, general: 0 },
        "ai",
      ),
    ).toBeNull();
    expect(a.auto).toBe(true);
    expect(
      l.issue(deu.smallID(), { kind: "army_general", army: a.id, general: 0 }),
    ).toBeNull();
    expect(a.auto).toBe(false);
  });
});
