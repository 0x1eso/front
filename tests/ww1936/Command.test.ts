// World War 1936 P6 lane D (plan Task 2, spec §4): command power, traits,
// field marshals, medals and the reinforcement order, on the deep map with
// a human Germany (plan decision 30).
import {
  CP_DAY_MILLI,
  CP_FM_UPKEEP_MILLI,
  MEDAL_COOLDOWN_DAYS,
  MEDAL_DAYS,
} from "@openfront/engine-api/ww1936/DepthTypes";
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
import { traitSlots } from "@openfront/engine-lib/ww1936/CommandRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { FM_ARMY } from "@openfront/engine/ww1936/depth/ArmyGroups";
import {
  dailyCommand,
  makeMarshal,
  reinforceOrder,
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
  it("command power grows 0.4 a day and pays marshal upkeep", async () => {
    const { runner, c, land, d } = await germany();
    stepTo(runner, afterTurn(runner, 0));
    expect(c.cmd.cpMilli).toBe(CP_DAY_MILLI);
    stepTo(runner, afterTurn(runner, 9));
    expect(c.cmd.cpMilli).toBe(10 * CP_DAY_MILLI);
    // A field marshal costs 0.05 a day.
    const g = land
      .country(DEU)!
      .generals.find((x) => x.army === 0 && canServe(land, x, 9))!;
    makeMarshal(d, DEU, g, 0);
    expect(land.fieldMarshalCount(DEU)).toBe(1);
    stepTo(runner, afterTurn(runner, 10));
    expect(c.cmd.cpMilli).toBe(
      10 * CP_DAY_MILLI + CP_DAY_MILLI - CP_FM_UPKEEP_MILLI,
    );
    // Never past 100.
    c.cmd.cpMilli = 99_900;
    stepTo(runner, afterTurn(runner, 11));
    expect(c.cmd.cpMilli).toBe(100_000);
  });

  it("assigning a trait spends command power and respects slots", async () => {
    const { runner, ww, c, land, d } = await germany();
    const tick = runner.game.ticks();
    const g = land.country(DEU)!.generals.find((x) => x.army === 0)!;
    const assign = (trait: string, general = g.id, admiral = false) =>
      d.issue(
        DEU,
        { kind: "trait_assign", general, trait, admiral } as never,
        tick,
      );
    c.cmd.cpMilli = 10_000;
    expect(assign("artillery_officer")).toBe("no_cp");
    c.cmd.cpMilli = 50_000;
    expect(assign("artillery_officer")).toBeNull();
    expect(c.cmd.cpMilli).toBe(35_000);
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
      c.cmd.cpMilli = 50_000;
      expect(assign(t), t).toBeNull();
      held++;
    }
    c.cmd.cpMilli = 50_000;
    expect(assign("guerrilla_fighter")).toBe("trait_unavailable");
    // A field marshal's traits: one more at levels 3 and 5, 20 each.
    makeMarshal(d, DEU, g, 0);
    g.level = 2;
    expect(assign("fm_logistics")).toBe("trait_unavailable");
    g.level = 3;
    expect(assign("fm_logistics")).toBeNull();
    expect(c.cmd.cpMilli).toBe(30_000);
    expect(assign("fm_thorough")).toBe("trait_unavailable");
    // An admiral: level 2, 15, at most three traits.
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
    c.cmd.cpMilli = 50_000;
    expect(assign("convoy_master", 99_001, true)).toBeNull();
    expect(c.cmd.cpMilli).toBe(35_000);
    expect(assign("night_fighter", 99_001, true)).toBeNull();
    expect(assign("fleet_tactician", 99_001, true)).toBe("trait_unavailable");
    expect(assign("convoy_master", 99_001 + 1, true)).toBe(
      "admiral_unavailable",
    );
  });

  it("a terrain trait arrives after 60 forest battle days", async () => {
    const { runner, land, d } = await germany();
    const g = land.country(DEU)!.generals.find((x) => x.army === 0)!;
    const spy = vi.spyOn(d, "message");
    g.terrainDays[4] = 59;
    stepTo(runner, afterTurn(runner, 0));
    expect(g.traits & traitBit("forest_expert")).toBe(0);
    g.terrainDays[4] = 60;
    stepTo(runner, afterTurn(runner, 1));
    expect(g.traits & traitBit("forest_expert")).not.toBe(0);
    const told = () =>
      spy.mock.calls.filter(
        (x) => x[1] === "events_display.ww1936_trait_unlocked",
      );
    expect(told()).toEqual([
      [
        DEU,
        "events_display.ww1936_trait_unlocked",
        { name: g.id, general: g.id, trait: "forest_expert" },
      ],
    ]);
    // Told once.
    stepTo(runner, afterTurn(runner, 3));
    expect(told().length).toBe(1);
    spy.mockRestore();
  });

  it("promoting a field marshal costs 30 CP and 25 PP and frees his army", async () => {
    const { runner, ww, c, land, d } = await germany();
    const cl = land.country(DEU)!;
    const g = cl.generals.find(
      (x) => x.army > 0 && x.att + x.dfn + x.plan + x.log >= 12,
    )!;
    const army = land.armies.get(g.army)!;
    const pol = ww.politics.country(DEU)!;
    pol.ppMilli = 100_000;
    c.cmd.cpMilli = 40_000;
    const tick = runner.game.ticks();
    const promote = (general: number) =>
      d.issue(DEU, { kind: "promote_fm", general, trait: "fm_thorough" }, tick);
    expect(promote(g.id)).toBeNull();
    expect(c.cmd.cpMilli).toBe(10_000);
    expect(pol.ppMilli).toBe(75_000);
    expect(g.fm).toBe(true);
    expect(g.fmTraits).toBe(1 << 3);
    expect(army.general).toBe(0);
    expect(g.army).toBe(FM_ARMY);
    // One marshal up to 71 divisions (spec §4.3).
    c.cmd.cpMilli = 40_000;
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
    // A fresh object each read (the query object is reused).
    expect(d.armyMods(DEU, a.id)).not.toBe(d.armyMods(DEU, a.id));
    void ww;
  });

  it("medal gives +3% attack for 180 days and blocks the army for 120", async () => {
    const { runner, ww, c, land, d } = await germany();
    const [a] = land.armiesOf(DEU);
    const day = ww.day(runner.game.ticks());
    const tickOf = (x: number) => dayStartTick(x, ww.prepEndTick());
    const award = (x: number, medal = "medal_valor") =>
      d.issue(
        DEU,
        { kind: "medal_award", army: a.id, medal } as never,
        tickOf(x),
      );
    expect(award(day)).toBe("no_cp");
    c.cmd.cpMilli = 30_000;
    expect(award(day)).toBeNull();
    expect(c.cmd.cpMilli).toBe(20_000);
    expect(d.armyMods(DEU, a.id).cmdAttBp).toBe(300);
    expect(d.armyMods(DEU, a.id).cmdDefBp).toBe(0);
    expect(d.medalXpPct(a.id)).toBe(10);
    expect(award(day + MEDAL_COOLDOWN_DAYS - 1)).toBe("doctrine_locked");
    // 180 days of effect.
    dailyCommand(d, DEU, day + MEDAL_DAYS - 1);
    expect(d.armyMods(DEU, a.id).cmdAttBp).toBe(300);
    dailyCommand(d, DEU, day + MEDAL_DAYS);
    expect(d.armyMods(DEU, a.id).cmdAttBp).toBe(0);
    expect(d.medalXpPct(a.id)).toBe(0);
    // After 120 days the army may get another.
    expect(award(day + MEDAL_DAYS, "medal_defense")).toBeNull();
    expect(d.armyMods(DEU, a.id).cmdDefBp).toBe(300);
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
});
