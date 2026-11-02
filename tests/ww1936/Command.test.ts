// World War 1936 P6 lane D (plan Task 2, spec §4): XP-paid and automatic traits,
// field marshals, medals and the reinforcement order, on the deep map with
// a human Germany (plan decision 30).
import { MEDAL_DAYS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  WW_DAY_SPLIT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  groundSlotOf,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import { admiralTraitBit } from "@openfront/engine-api/ww1936/NavyTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { divisionMods } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  MEDAL_AUTO_EVERY_DAYS,
  traitSlots,
} from "@openfront/engine-lib/ww1936/CommandRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { FM_ARMY } from "@openfront/engine/ww1936/depth/ArmyGroups";
import {
  dailyCommand,
  makeMarshal,
  reinforceOrder,
  skirmisherContact,
} from "@openfront/engine/ww1936/depth/Command";
import { modInputOf } from "@openfront/engine/ww1936/land/Battles";
import { canServe } from "@openfront/engine/ww1936/land/GeneralsRun";
import { dailySustain } from "@openfront/engine/ww1936/land/Sustain";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  clearLand,
  clearStartSetup,
  placeArmy,
  step,
  stepTo,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const H = "HUMANDEU";
const DEU = DEEP.tag.DEU;
const INF1 = equipKey("infantry_equipment", 1);

async function germany() {
  const runner = await wwRunner(
    {},
    [{ clientID: H, country: "DEU" }],
    DEEP.map,
  );
  const ww = runner.game.worldWar()!;
  const d = ww.depth;
  return { runner, ww, d, c: d.country(DEU)!, land: ww.land };
}

/** The tick after Germany's depth turn of `day`. */
function afterTurn(runner: GameRunner, day: number): number {
  const ww = runner.game.worldWar()!;
  return dayStartTick(day, ww.prepEndTick()) + (DEU % WW_DAY_SPLIT) + 1;
}

describe("command (spec §4)", () => {
  it("assigning a trait spends XP and respects slots", async () => {
    const { runner, ww, land, d } = await germany();
    const tick = runner.game.ticks();
    const g = land.country(DEU)!.generals.find((x) => x.army === 0)!;
    const assign = (trait: string, general = g.id, admiral = false) =>
      d.issue(
        DEU,
        { kind: "trait_assign", general, trait, admiral } as never,
        tick,
      );
    const cl = land.country(DEU)!;
    cl.armyXpMilli = 10_000;
    expect(assign("artillery_officer")).toBe("no_xp");
    cl.armyXpMilli = 100_000;
    expect(assign("artillery_officer")).toBeNull();
    expect(cl.armyXpMilli).toBe(100_000 - 30_000);
    expect(g.traits & traitBit("artillery_officer")).not.toBe(0);
    // Level 1: a level-2 trait, a terrain trait, one held: refused.
    expect(assign("engineer_officer")).toBe("trait_unavailable");
    expect(assign("forest_expert")).toBe("trait_unavailable");
    expect(assign("artillery_officer")).toBe("trait_unavailable");
    // Three slots at level 1, every trait held counts.
    g.level = 2;
    let held = 0;
    for (let b = 0; b < 23; b++) if ((g.traits & (1 << b)) !== 0) held++;
    expect(traitSlots(2)).toBe(4);
    for (const t of ["engineer_officer", "commando", "skirmisher"]) {
      if (held >= traitSlots(2)) break;
      cl.armyXpMilli = 100_000;
      expect(assign(t), t).toBeNull();
      held++;
    }
    cl.armyXpMilli = 100_000;
    expect(assign("guerrilla_fighter")).toBe("trait_unavailable");
    // A field marshal's traits: one more at levels 3 and 5, 40 army XP each.
    makeMarshal(d, DEU, g, 0);
    g.level = 2;
    expect(assign("fm_logistics")).toBe("trait_unavailable");
    g.level = 3;
    cl.armyXpMilli = 100_000;
    expect(assign("fm_logistics")).toBeNull();
    expect(cl.armyXpMilli).toBe(60_000);
    expect(assign("fm_thorough")).toBe("trait_unavailable");
    // An admiral: level 2, 30 navy XP, at most three traits.
    const navy = ww.navy;
    navy.admirals.set(99_001, {
      id: 99_001,
      owner: DEU,
      xpMilli: 0,
      level: 2,
      skills: [1, 1, 1, 1],
      traits: admiralTraitBit("sea_wolf"),
      fleet: 0,
      usage: [0, 0, 0, 0],
    });
    const cn = ww.navy.country(DEU)!;
    cn.navyXpMilli = 10_000;
    expect(assign("convoy_master", 99_001, true)).toBe("no_xp");
    cn.navyXpMilli = 100_000;
    expect(assign("convoy_master", 99_001, true)).toBeNull();
    expect(cn.navyXpMilli).toBe(70_000);
    expect(assign("night_fighter", 99_001, true)).toBeNull();
    expect(assign("fleet_tactician", 99_001, true)).toBe("trait_unavailable");
    expect(assign("convoy_master", 99_001 + 1, true)).toBe(
      "admiral_unavailable",
    );
  });

  it("a terrain trait arrives after 60 forest battle days", async () => {
    const { runner, land, d } = await germany();
    const g = land.country(DEU)!.generals.find((x) => x.army === 0)!;
    // The key the screen gets (WwPolitics.message adds "events_display.").
    const spy = vi.spyOn(runner.game, "displayMessage");
    void d;
    g.terrainDays[4] = 59;
    stepTo(runner, afterTurn(runner, 0));
    expect(g.traits & traitBit("forest_expert")).toBe(0);
    g.terrainDays[4] = 60;
    stepTo(runner, afterTurn(runner, 1));
    expect(g.traits & traitBit("forest_expert")).not.toBe(0);
    const told = () =>
      spy.mock.calls.filter(
        (x) => x[0] === "events_display.ww1936_trait_unlocked",
      );
    expect(told().length).toBe(1);
    expect(told()[0][4]).toEqual({ general: g.id, trait: "forest_expert" });
    expect(
      spy.mock.calls.some((x) => x[0].startsWith("events_display.events_")),
    ).toBe(false);
    // Told once.
    stepTo(runner, afterTurn(runner, 3));
    expect(told().length).toBe(1);
    spy.mockRestore();
  });

  it("promoting a field marshal costs 25 PP only and frees his army", async () => {
    const { runner, ww, land, d } = await germany();
    const cl = land.country(DEU)!;
    const g = cl.generals.find(
      (x) => x.army > 0 && x.att + x.dfn + x.plan + x.log >= 12,
    )!;
    const army = land.armies.get(g.army)!;
    const pol = ww.politics.country(DEU)!;
    pol.ppMilli = 100_000;
    const tick = runner.game.ticks();
    const promote = (general: number) =>
      d.issue(DEU, { kind: "promote_fm", general, trait: "fm_thorough" }, tick);
    const shown = vi.spyOn(runner.game, "displayMessage");
    expect(promote(g.id)).toBeNull();
    expect(
      shown.mock.calls.find(
        (x) => x[0] === "events_display.ww1936_fm_promoted",
      )?.[4],
    ).toEqual({ general: g.id });
    shown.mockRestore();
    // P2's army_general refuses a field marshal (spec §4.3; review 2).
    expect(
      land.issue(DEU, { kind: "army_general", army: army.id, general: g.id }),
    ).toBe("general_unavailable");
    expect(pol.ppMilli).toBe(75_000);
    expect(g.fm).toBe(true);
    expect(g.fmTraits).toBe(1 << 3);
    expect(army.general).toBe(0);
    expect(g.army).toBe(FM_ARMY);
    // One marshal up to 71 divisions (spec §4.3).
    const day = ww.day(tick);
    const other = cl.generals.find(
      (x) =>
        !x.fm && x.att + x.dfn + x.plan + x.log >= 12 && canServe(land, x, day),
    )!;
    expect(promote(other.id)).toBe("fm_limit");
    // A level-1 general with skills under 12 may not be one.
    makeMarshal(d, DEU, g, 0);
    g.fm = false;
    g.army = 0;
    const weak = cl.generals.find(
      (x) =>
        !x.fm &&
        x.level < 3 &&
        x.att + x.dfn + x.plan + x.log < 12 &&
        canServe(land, x, day),
    )!;
    expect(promote(weak.id)).toBe("trait_unavailable");
    // A field marshal never leads an army: P2's AI and screens see him busy.
    g.fm = true;
    g.army = army.id;
    army.general = g.id;
    dailyCommand(d, DEU, day);
    expect(army.general).toBe(0);
    expect(g.army).toBe(FM_ARMY);
  });

  it("a field marshal adds half his attack skill to every division of the group", async () => {
    const { runner, ww, land, d } = await germany();
    const cl = land.country(DEU)!;
    const [a, b] = land.armiesOf(DEU);
    const fm = cl.generals.find((x) => x.army === 0 && canServe(land, x, 0))!;
    fm.att = 4;
    fm.dfn = 2;
    makeMarshal(d, DEU, fm, 0); // fm_offensive: attack +5%
    expect(
      d.issue(
        DEU,
        { kind: "ag_create", fm: fm.id, armies: [a.id] },
        runner.game.ticks(),
      ),
    ).toBeNull();
    const row = land.divisions.rowOf(a.divisions[0]);
    const mi = modInputOf(land, row, DEEP.region.warsaw, true);
    expect(mi.fmAtt).toBe(4);
    expect(mi.fmDef).toBe(2);
    const lines = divisionMods(mi).attackLines;
    expect(lines.find((l) => l.id === "field_marshal")?.bp).toBe(4 * 250);
    expect(lines.find((l) => l.id === "fm_trait")?.bp).toBe(500);
    // fm_offensive's readiness speed reaches P2 through armyMods.
    expect(d.armyMods(DEU, a.id).planSpeedPct).toBe(10);
    // An army outside the group: nothing.
    const rowB = land.divisions.rowOf(b.divisions[0]);
    const other = modInputOf(land, rowB, DEEP.region.warsaw, true);
    expect(other.fmAtt).toBe(0);
    expect(
      divisionMods(other).attackLines.some((l) => l.id === "field_marshal"),
    ).toBe(false);
    // One frozen value per army and tick (the query object is reused, the
    // result is no scratch); a change within the tick is read at once.
    const m1 = d.armyMods(DEU, a.id);
    expect(Object.isFrozen(m1)).toBe(true);
    expect(d.armyMods(DEU, a.id)).toBe(m1);
    expect(
      d.issue(
        DEU,
        { kind: "ag_remove", group: a.group, army: a.id },
        runner.game.ticks(),
      ),
    ).toBeNull();
    expect(d.armyMods(DEU, a.id).fmAtt).toBe(0);
    void ww;
  });

  it("a won battle names a medal candidate and the medal comes automatically, 30 days apart", async () => {
    const { runner, ww, c, land, d } = await germany();
    const [a, b] = land.armiesOf(DEU);
    const day = ww.day(runner.game.ticks());
    const tickOf = (x: number) => dayStartTick(x, ww.prepEndTick());
    // The order is refused since ww9.
    expect(
      d.issue(
        DEU,
        { kind: "medal_award", army: a.id, medal: "medal_valor" } as never,
        tickOf(day),
      ),
    ).toBe("bad_index");
    const div = (x: typeof a) => x.divisions.slice(0, 1);
    // An attack won: valour; a defence won: defence; a lost field: service.
    d.onBattleEnd(0, div(a), [], false);
    expect(c.cmd.medalWin).toEqual([a.id, 0, 1]);
    // A bigger win replaces it; a defeat never does.
    d.onBattleEnd(1, [], b.divisions, false);
    expect(c.cmd.medalWin).toEqual([b.id, 1, b.divisions.length]);
    d.onBattleEnd(0, [], [], false);
    d.onBattleEnd(1, div(a), div(a), true);
    expect(c.cmd.medalWin![1]).toBe(1);
    dailyCommand(d, DEU, day);
    expect(land.armies.get(b.id)!.medal).toBe(2);
    expect(c.cmd.medalWin).toBeUndefined();
    expect(d.armyMods(DEU, b.id).cmdDefBp).toBe(300);
    expect(d.medalXpPct(b.id)).toBe(10);
    // The next one waits MEDAL_AUTO_EVERY_DAYS.
    d.onBattleEnd(0, div(a), [], false);
    dailyCommand(d, DEU, day + MEDAL_AUTO_EVERY_DAYS - 1);
    expect(land.armies.get(a.id)!.medal).toBe(0);
    dailyCommand(d, DEU, day + MEDAL_AUTO_EVERY_DAYS);
    expect(land.armies.get(a.id)!.medal).toBe(1);
    expect(d.armyMods(DEU, a.id).cmdAttBp).toBe(300);
    // 180 days of effect.
    dailyCommand(d, DEU, day + MEDAL_DAYS);
    expect(land.armies.get(b.id)!.medal).toBe(0);
  });

  it("a general with 60 battle days takes a free trait by his service", async () => {
    const { runner, land, d } = await germany();
    const g = land.country(DEU)!.generals.find((x) => x.army === 0 && !x.fm)!;
    g.level = 3;
    g.use = [50, 0, 0, 0];
    dailyCommand(d, DEU, 1);
    expect(g.traits & traitBit("trickster")).toBe(0);
    g.use = [60, 0, 0, 0];
    dailyCommand(d, DEU, 2);
    // Attack days point to the trickster (list order puts the others at 0).
    expect(g.traits & traitBit("trickster")).not.toBe(0);
    // The second needs 120 days.
    g.use = [100, 0, 0, 0];
    const before = g.traits;
    dailyCommand(d, DEU, 3);
    expect(g.traits).toBe(before);
    void runner;
  });

  it("reinforcement follows army priority", async () => {
    const { runner, ww, land, d } = await germany();
    stepTo(runner, ww.prepEndTick() + 1);
    const g = runner.game;
    const ce = ww.economy.country(DEU)!;
    clearStartSetup(ww.economy, ce);
    clearLand(g);
    ce.manpower = 100_000;
    ce.stock[INF1] = 10_000;
    ce.stock[equipKey("artillery", 1)] = 1_000;
    ce.stock[equipKey("support_equipment", 1)] = 1_000;
    const low = placeArmy(g, "DEU", DEEP.region.berlin, 1);
    const mid = placeArmy(g, "DEU", DEEP.region.berlin, 1);
    const high = placeArmy(g, "DEU", DEEP.region.berlin, 1);
    const tick = runner.game.ticks();
    const prio = (army: number, value: number) =>
      d.issue(DEU, { kind: "army_priority", army, value }, tick);
    // All normal: P2's order (division id).
    const ids = [low, mid, high].map((a) => a.divisions[0]);
    expect(reinforceOrder(d, DEU)).toEqual(ids);
    expect(prio(low.id, 0)).toBeNull();
    expect(prio(high.id, 2)).toBeNull();
    expect(prio(high.id, 2)).toBe("bad_index");
    expect(reinforceOrder(d, DEU)).toEqual([ids[2], ids[1], ids[0]]);
    // Short stock: the high-priority army fills first.
    const t = land.divisions;
    const slot = groundSlotOf(INF1);
    const rows = ids.map((id) => t.rowOf(id));
    for (const r of rows) land.addEquip(r, slot, -300);
    ce.stock[INF1] = 90;
    dailySustain(land, DEU, ww.day(tick));
    const fill = rows.map((r) => t.equip[r * GROUND_SLOTS + slot]);
    expect(fill[2]).toBeGreaterThan(fill[0]);
  });

  it("a trickster cuts the enemy's readiness; a skirmisher sees the armies next to his", async () => {
    const { runner, ww, land, d } = await germany();
    const g = runner.game;
    for (const tag of ["DEU", "POL"] as const) {
      const ce = ww.economy.country(DEEP.tag[tag])!;
      ce.manpower = 1_000_000;
      for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 100_000;
    }
    const deu = placeArmy(g, "DEU", DEEP.region.berlin, 1);
    const pol = placeArmy(g, "POL", DEEP.region.warsaw, 1);
    const cl = land.country(DEU)!;
    const gen = cl.generals.find((x) => x.army === 0)!;
    deu.general = gen.id;
    gen.army = deu.id;
    const POL = DEEP.tag.POL;
    land.addBattle({
      region: DEEP.region.warsaw,
      sinceTick: g.ticks(),
      round: 0,
      attackers: [...deu.divisions],
      defenders: [...pol.divisions],
      attLine: [],
      defLine: [],
      startOrgMilli: 0,
      lostOrgMilli: 0,
      attLead: DEU,
      defLead: POL,
      band: 0,
      tacticAtt: 0,
      tacticDef: 0,
      phaseRound: 0,
    });
    expect(d.planCutBp(POL, DEEP.region.warsaw)).toBe(0);
    gen.traits |= traitBit("trickster");
    step(runner, 1);
    expect(d.planCutBp(POL, DEEP.region.warsaw)).toBe(-1000);
    // Germany's own divisions are not cut by its trickster.
    expect(d.planCutBp(DEU, DEEP.region.warsaw)).toBe(0);
    land.endBattle(DEEP.region.warsaw);
    // Skirmisher (spec §8.8): Berlin touches Warsaw.
    expect(skirmisherContact(d, DEU, POL)).toBe(false);
    gen.traits |= traitBit("skirmisher");
    expect(skirmisherContact(d, DEU, POL)).toBe(true);
    // Rome is no neighbour of Berlin.
    expect(skirmisherContact(d, DEU, DEEP.tag.ITA)).toBe(
      land
        .rowsOf(DEEP.tag.ITA)
        .some((r) =>
          [
            DEEP.region.berlin,
            ...ww.scenario.regionNeighbours(DEEP.region.berlin),
          ].includes(land.divisions.region[r]),
        ),
    );
  });

  it("an officer corps pick costs 25 experience, a switch 50, then 90 days locked", async () => {
    const { runner, ww, c, land, d } = await germany();
    const ce = ww.economy.country(DEU)!;
    land.country(DEU)!.armyXpMilli = 100_000;
    const tick = runner.game.ticks();
    const day = ww.day(tick);
    const pick = (id: string, at = tick) =>
      d.issue(
        DEU,
        { kind: "army_spirit_pick", category: "land_recruit", id } as never,
        at,
      );
    const before = ce.stats.reinforcePct;
    expect(pick("as_mission_command")).toBe("bad_index");
    expect(pick("as_reserve")).toBeNull();
    expect(d.xpOf(DEU, 0)).toBe(75);
    expect(ce.stats.reinforcePct).toBe(before + 25);
    expect(pick("as_conscript")).toBe("doctrine_locked");
    const later = dayStartTick(day + 90, ww.prepEndTick());
    expect(pick("as_conscript", later)).toBeNull();
    expect(d.xpOf(DEU, 0)).toBe(25);
    expect(ce.stats.reinforcePct).toBe(before);
    expect(c.cmd.spirits[0]).toBe(0);
  });

  it("every lane-D field moves the hashes", async () => {
    const { ww, c, land, d } = await germany();
    const [a] = land.armiesOf(DEU);
    const g = land.country(DEU)!.generals[0];
    const hashes = () => [d.hash(), land.hash(), ww.hash()];
    const moves = (label: string, f: () => void) => {
      const before = hashes();
      f();
      const after = hashes();
      expect(after[2], label).not.toBe(before[2]);
    };
    const doc = c.doc;
    const cmd = c.cmd;
    moves("gd", () => (doc.gd[2] = 7));
    moves("gdLock", () => (doc.gdLock[0] = 33));
    moves("sub", () => (doc.sub[5] = 13));
    moves("subLock", () => (doc.subLock[3] = 44));
    moves("announced", () => (doc.announced[4] = 2));
    moves("gain", () => (doc.gain[7] = 345));
    moves("spirits", () => (cmd.spirits[6] = 19));
    moves("spiritLock", () => (cmd.spiritLock[1] = 55));
    moves("medalReady", () => cmd.medalReady.push([a.id, 66]));
    moves("medalReady day", () => (cmd.medalReady[0][1] = 67));
    moves("traitsSeen", () => cmd.traitsSeen.push([g.id, 2]));
    moves("traitsSeen bits", () => (cmd.traitsSeen[0][1] = 4));
    moves("group", () =>
      d.groups.push({
        id: 999,
        owner: DEU,
        fm: g.id,
        armies: [a.id],
        auto: false,
      }),
    );
    moves("group fm", () => (d.groups[d.groups.length - 1].fm = g.id + 1));
    moves("group armies", () =>
      d.groups[d.groups.length - 1].armies.push(9_999),
    );
    moves("group auto", () => (d.groups[d.groups.length - 1].auto = true));
    moves("fm", () => (g.fm = !g.fm));
    moves("fmTraits", () => (g.fmTraits ^= 2));
    moves("army group", () => (a.group = 999));
    moves("priority", () => (a.priority = a.priority === 2 ? 0 : 2));
    moves("medal", () => (a.medal = 1));
    moves("medalUntil", () => (a.medalUntil = 77));
  });
});
