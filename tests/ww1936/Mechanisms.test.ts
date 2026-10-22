// World War 1936 P6 lane W3 (plan Task 9 Step 8): continuous focuses
// (spec §12) and the balance of power (spec §13.2) in a game on the deep
// test map, with France a human country (no AI moves its values).
import {
  CONTINUOUS_FOCUSES,
  FACTION_GOALS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import type {
  DecisionDef,
  SpiritDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { BOP_DEFS } from "@openfront/engine-lib/ww1936/MechRules";
import { aiMechDay } from "@openfront/engine/ww1936/depth/AiMech";
import {
  addBop,
  BOP_WARLORD_ANNEX_PM,
  bopBandOf,
  bopValue,
  warlordsAnnexedFor,
} from "@openfront/engine/ww1936/depth/BalanceOfPower";
import { mechStatsOf } from "@openfront/engine/ww1936/depth/ContinuousFocus";
import {
  FR_SHARED_INTEL,
  FR_SHARED_RESEARCH,
  goalProgressPm,
  ruleOn,
} from "@openfront/engine/ww1936/depth/FactionRules";
import { dailyMechanisms } from "@openfront/engine/ww1936/depth/Mechanisms";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { politicsFixture } from "./politicsFixture";
import { gameHash, pol, step, stepToDate, wwRestore, wwRunner } from "./util";

const FRA_SPIRITS: SpiritDef[] = BOP_DEFS.find((b) => b.tag === "FRA")!
  .spirits.filter((s): s is string => s !== null)
  .map((id) => ({ id, stats: { stabilityBp: 100 }, icon: "flag" }));

beforeEach(() =>
  usePoliticsContent(
    depthFixture({ spirits: [...politicsFixture().spirits, ...FRA_SPIRITS] }),
  ),
);
afterEach(() => usePoliticsContent(null));

const HUMAN_FRA = [{ clientID: "HUMANFRA", country: "FRA" as const }];

async function franceGame(date: string) {
  const runner = await wwRunner({}, HUMAN_FRA, DEEP.map);
  stepToDate(runner, date);
  const ww = runner.game.worldWar()!;
  return { runner, ww, d: ww.depth, fra: DEEP.tag.FRA };
}

describe("World War 1936 P6: continuous focuses", () => {
  it("continuous focus opens after ten focuses and locks for 30 days after a switch", async () => {
    const { runner, ww, d, fra } = await franceGame("1936-02-01");
    const c = pol(runner.game).country(fra)!;
    const set = (id: "cf_industry" | "cf_research") =>
      d.issue(fra, { kind: "cfocus_set", id }, runner.game.ticks());
    // Nine focuses (done or bypassed) in 1936: still closed.
    c.focusState = new Uint8Array(12);
    c.focusState.fill(1, 0, 8);
    c.focusState[8] = 2;
    expect(ww.politics.doneFocusCount(fra)).toBe(9);
    expect(set("cf_industry")).toBe("cfocus_locked");
    // The tenth opens them; the pick works at once.
    c.focusState[9] = 1;
    const before = ww.politics.stats(fra).outputPct;
    expect(set("cf_industry")).toBeNull();
    expect(d.country(fra)!.mech.cfocus).toBe(0);
    expect(mechStatsOf(d, fra)).toEqual({ outputPct: 5 });
    expect(ww.politics.stats(fra).outputPct).toBe(before + 5);
    // The same one again is no pick; another within 30 days is locked.
    const pickDay = ww.day(runner.game.ticks());
    expect(pickDay).toBe(dayOfDate("1936-02-01"));
    expect(set("cf_industry")).toBe("bad_index");
    step(runner, 1);
    expect(set("cf_research")).toBe("cfocus_locked");
    stepToDate(runner, "1936-03-01");
    expect(ww.day(runner.game.ticks())).toBe(pickDay + 29);
    expect(set("cf_research")).toBe("cfocus_locked");
    stepToDate(runner, "1936-03-02");
    expect(ww.day(runner.game.ticks())).toBe(pickDay + 30);
    expect(set("cf_research")).toBeNull();
    expect(ww.politics.stats(fra).outputPct).toBe(before);
    expect(mechStatsOf(d, fra)).toEqual({ researchPct: 5 });
    // A clear locks the next pick for 30 days too.
    expect(
      d.issue(fra, { kind: "cfocus_clear" }, runner.game.ticks()),
    ).toBeNull();
    expect(mechStatsOf(d, fra)).toEqual({});
    expect(set("cf_industry")).toBe("cfocus_locked");
  });

  it("1939 opens them without focuses", async () => {
    const { runner, d, fra } = await franceGame("1936-01-05");
    pol(runner.game).country(fra)!.focusState.fill(0);
    expect(
      d.issue(fra, { kind: "cfocus_set", id: "cf_army" }, runner.game.ticks()),
    ).toBe("cfocus_locked");
    expect(d.country(fra)!.mech.cfocusOpen).toBe(false);
    // The country's day on 1939-01-01 sets the flag the screens read.
    dailyMechanisms(d, fra, dayOfDate("1939-01-01"));
    expect(d.country(fra)!.mech.cfocusOpen).toBe(true);
    expect(
      d.issue(fra, { kind: "cfocus_set", id: "cf_army" }, runner.game.ticks()),
    ).toBeNull();
  });
});

describe("World War 1936 P6: the balance of power", () => {
  it("balance of power swaps the band spirit when it crosses 200", async () => {
    const { runner, d, fra } = await franceGame("1936-01-03");
    const day = d.ww.day(runner.game.ticks());
    const c = pol(runner.game).country(fra)!;
    const [left, right] = FRA_SPIRITS.map((s) => s.id);
    const v0 = bopValue(d, "FRA");
    expect(v0).toBeGreaterThanOrEqual(-300);
    expect(bopBandOf(d, "FRA")).toBe(1);
    expect(c.hasSpirit(left) || c.hasSpirit(right)).toBe(false);
    // Up across 200 (band 3, no spirit) and 600 (band 4, national union).
    addBop(d, fra, 190 - v0, day);
    expect(bopBandOf(d, "FRA")).toBe(2);
    addBop(d, fra, 20, day);
    expect(bopValue(d, "FRA")).toBe(210);
    expect(bopBandOf(d, "FRA")).toBe(3);
    expect(c.hasSpirit(right)).toBe(false);
    addBop(d, fra, 400, day);
    expect(bopBandOf(d, "FRA")).toBe(4);
    expect(c.hasSpirit(right)).toBe(true);
    // Back below 200: the spirit goes; to the far left: the popular front.
    addBop(d, fra, -420, day);
    expect(bopValue(d, "FRA")).toBe(190);
    expect(c.hasSpirit(right)).toBe(false);
    addBop(d, fra, -900, day);
    expect(bopValue(d, "FRA")).toBe(-710);
    expect(c.hasSpirit(left)).toBe(true);
    // Never past the ends.
    addBop(d, fra, -5000, day);
    expect(bopValue(d, "FRA")).toBe(-1000);
  });

  it("France drifts right every second day before 1938, and stops with a new government", async () => {
    const { runner, ww, d, fra } = await franceGame("1936-01-03");
    const v = bopValue(d, "FRA");
    stepToDate(runner, "1936-01-13");
    expect(bopValue(d, "FRA")).toBe(v + 5);
    // Another government (or capitulation) ends the mechanism and its spirits.
    addBop(d, fra, -900, ww.day(runner.game.ticks()));
    const c = pol(runner.game).country(fra)!;
    expect(c.hasSpirit(FRA_SPIRITS[0].id)).toBe(true);
    c.ruling = (c.ruling + 1) % 4;
    stepToDate(runner, "1936-01-15");
    expect(bopBandOf(d, "FRA")).toBe(-1);
    expect(bopValue(d, "FRA")).toBe(0);
    expect(c.hasSpirit(FRA_SPIRITS[0].id)).toBe(false);
    expect(d.mech.bop.map((b) => BOP_DEFS[b[0]].tag)).not.toContain("FRA");
  });
});

describe("World War 1936 P6: the mechanisms' AI", () => {
  it("picks continuous focuses and faction goals by the situation", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    stepToDate(runner, "1936-01-03");
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const { POL, GBR } = DEEP.tag;
    // Peace: construction (on the country's tenth day).
    d.country(POL)!.mech.cfocusOpen = true;
    aiMechDay(d, POL, 7);
    expect(d.country(POL)!.mech.cfocus).toBe(-1);
    aiMechDay(d, POL, 6);
    const cf = (id: string) => CONTINUOUS_FOCUSES.indexOf(id as never);
    expect(d.country(POL)!.mech.cfocus).toBe(cf("cf_construction"));
    // The Allies' leader watches the three goals it is closest to.
    const f = ww.politics.factionIdx(GBR);
    const closest = () =>
      FACTION_GOALS.map((goal, k) => ({
        goal,
        k,
        p: goalProgressPm(d, f, goal),
      }))
        .sort((a, b) => b.p - a.p || a.k - b.k)
        .slice(0, 3)
        .map((x) => x.goal)
        .sort();
    const slotted = () =>
      d.mech.factionGoals
        .find((x) => x.faction === f)!
        .slots.map((s) => FACTION_GOALS[s])
        .sort();
    aiMechDay(d, GBR, 3);
    expect(slotted()).toEqual(closest());
    // One that falls behind gives its slot to one that came close: 390
    // military factories put industry first.
    expect(slotted()).not.toContain("fg_industry");
    ww.economy.country(GBR)!.totals.mil = 390;
    aiMechDay(d, GBR, 13);
    expect(slotted()).toContain("fg_industry");
    expect(slotted()).toEqual(closest());
    // Shared research from 1939 (at peace), paid from its PP.
    ww.politics.country(GBR)!.ppMilli = 200_000;
    aiMechDay(d, GBR, 23);
    expect(ruleOn(d, f, FR_SHARED_RESEARCH)).toBe(false);
    const day1939 = dayOfDate("1939-01-01");
    aiMechDay(d, GBR, day1939 + ((13 - (day1939 % 10)) % 10));
    expect(ruleOn(d, f, FR_SHARED_RESEARCH)).toBe(true);
    expect(ww.politics.country(GBR)!.ppMilli).toBe(150_000);
    // A treaty member stays in (the escalator decides), at peace no intel sharing.
    expect(d.mech.treaty.leaving).toEqual([]);
    expect(ruleOn(d, f, FR_SHARED_INTEL)).toBe(false);
  });

  it("takes an unweighted balance decision itself, leaves a weighted one to P3", async () => {
    const rearm = (base: number): DecisionDef => ({
      id: "fra_rearmament_act",
      category: "political",
      for: ["FRA"],
      cost: { pp: 50 },
      cooldownDays: 180,
      effects: [{ kind: "bop", amount: 150 }],
      ai: { base },
    });
    for (const base of [0, 10]) {
      usePoliticsContent(
        depthFixture({
          spirits: [...politicsFixture().spirits, ...FRA_SPIRITS],
          decisions: [...politicsFixture().decisions, rearm(base)],
        }),
      );
      const runner = await wwRunner({}, [], DEEP.map);
      stepToDate(runner, "1936-01-03");
      const ww = runner.game.worldWar()!;
      const d = ww.depth;
      const fra = DEEP.tag.FRA;
      ww.politics.country(fra)!.ppMilli = 100_000;
      const v = bopValue(d, "FRA");
      // 1936 at low tension and peace: no rearmament yet.
      aiMechDay(d, fra, 4);
      expect(bopValue(d, "FRA")).toBe(v);
      // From 1938 France moves right.
      const day1938 = dayOfDate("1938-01-01");
      aiMechDay(d, fra, day1938 + ((14 - (day1938 % 10)) % 10));
      expect(bopValue(d, "FRA")).toBe(base === 0 ? v + 150 : v);
    }
  });
});

describe("World War 1936 P6: the mechanisms' state", () => {
  it("France's balance and its band spirit end when France capitulates", async () => {
    const { runner, ww, d, fra } = await franceGame("1936-01-03");
    addBop(d, fra, -900, ww.day(runner.game.ticks()));
    const c = pol(runner.game).country(fra)!;
    expect(c.hasSpirit(FRA_SPIRITS[0].id)).toBe(true);
    ww.addCapitulation(fra, DEEP.tag.DEU, runner.game.ticks());
    expect(ww.isActor(fra)).toBe(false); // no turn of its own from now on
    stepToDate(runner, "1936-01-05");
    expect(bopBandOf(d, "FRA")).toBe(-1);
    expect(c.hasSpirit(FRA_SPIRITS[0].id)).toBe(false);
    expect(d.mech.bop.map((b) => BOP_DEFS[b[0]].tag)).not.toContain("FRA");
  });

  it("every field of the mechanisms moves the depth hash", async () => {
    const { runner, d, fra } = await franceGame("1936-01-03");
    void runner;
    const base = d.hash();
    const saved = JSON.stringify([d.mech, d.country(fra)!.mech]);
    const cases: [string, () => void][] = [
      ["congressBp", () => (d.mech.congressBp += 1)],
      ["congressFull", () => (d.mech.congressFull = 900)],
      ["attackedUntil", () => (d.mech.attackedUntil = 900)],
      ["isolationCleared", () => (d.mech.isolationCleared = true)],
      ["bop value", () => (d.mech.bop[2][1] += 1)],
      ["bop band", () => (d.mech.bop[2][2] = 4)],
      ["bop entry", () => d.mech.bop.pop()],
      ["treaty escalated", () => (d.mech.treaty.escalated = true)],
      ["treaty ended", () => (d.mech.treaty.ended = true)],
      ["treaty members", () => d.mech.treaty.members.pop()],
      ["treaty leaving", () => d.mech.treaty.leaving.push([fra, 40])],
      ["faction rule", () => d.mech.factionRules.push([9, 0, true, 200])],
      ["faction goal", () => d.mech.factionGoals.push(goalRow())],
      ["cfocus", () => (d.country(fra)!.mech.cfocus = 2)],
      ["cfocusLock", () => (d.country(fra)!.mech.cfocusLock = 77)],
      ["cfocusOpen", () => (d.country(fra)!.mech.cfocusOpen = true)],
    ];
    function goalRow() {
      return { faction: 9, slots: [0, -1, -1], achieved: 0 };
    }
    const restore = () => {
      const [m, cm] = JSON.parse(saved);
      d.mech = m;
      d.country(fra)!.mech = cm;
    };
    for (const [name, change] of cases) {
      change();
      expect(d.hash(), name).not.toBe(base);
      restore();
      expect(d.hash(), name).toBe(base);
    }
    // Inside a rule and a goal row too.
    d.mech.factionRules.push([9, 0, true, 200]);
    d.mech.factionGoals.push(goalRow());
    const withRows = d.hash();
    // (The AI leaders may hold rows of their own: change the ones pushed here.)
    const rule = () => d.mech.factionRules[d.mech.factionRules.length - 1];
    const goal = () => d.mech.factionGoals[d.mech.factionGoals.length - 1];
    for (const [name, change] of [
      ["rule on", () => (rule()[2] = false)],
      ["rule lock", () => (rule()[3] = 201)],
      ["goal slot", () => (goal().slots[1] = 3)],
      ["goal achieved", () => (goal().achieved = 2)],
    ] as const) {
      const keep = JSON.stringify(d.mech);
      change();
      expect(d.hash(), name).not.toBe(withRows);
      d.mech = JSON.parse(keep);
    }
  });

  it("a refused mechanism order changes nothing", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANGBR", country: "GBR" }],
      DEEP.map,
    );
    stepToDate(runner, "1936-01-03");
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const p = ww.politics;
    const { GBR, FRA, ITA } = DEEP.tag;
    const tick = runner.game.ticks();
    const allies = p.factionIdx(GBR);
    // A rule changed today (locked 180 days) and a goal in slot 0.
    p.country(GBR)!.ppMilli = 60_000;
    const on = { kind: "faction_rule", rule: "fr_shared_research", on: true };
    expect(d.issue(GBR, on as never, tick)).toBeNull();
    expect(
      d.issue(GBR, { kind: "faction_goal", slot: 0, goal: "fg_members" }, tick),
    ).toBeNull();
    expect(d.mech.factionRules[0][0]).toBe(allies);
    const state = () =>
      JSON.stringify({
        mech: d.mech,
        cm: [GBR, FRA, ITA].map((id) => d.country(id)!.mech),
        pp: [GBR, FRA, ITA].map((id) => p.country(id)!.ppMilli),
        wt: p.wtBp,
        threat: [...p.threatBp],
        hash: d.hash(),
      });
    const before = state();
    const refused: [unknown, number, string][] = [
      [{ kind: "cfocus_set", id: "cf_industry" }, GBR, "cfocus_locked"],
      [{ kind: "cfocus_clear" }, GBR, "cfocus_locked"],
      [{ ...on, on: false }, GBR, "faction_rule"], // locked
      [{ ...on, rule: "fr_shared_intel" }, GBR, "no_pp"], // 10 PP left
      [on, FRA, "faction_leader_only"],
      [{ kind: "faction_goal", slot: 1, goal: "fg_members" }, GBR, "bad_index"],
      // Italy is in the Axis but does not lead it.
      [
        { kind: "faction_goal", slot: 0, goal: "fg_industry" },
        ITA,
        "faction_leader_only",
      ],
      [{ kind: "treaty_leave" }, ITA, "bad_index"],
      [{ kind: "treaty_leave" }, GBR, "no_pp"],
    ];
    for (const [o, id, why] of refused) {
      expect(d.issue(id, o as never, tick)).toBe(why);
      expect(state()).toBe(before);
    }
  });

  it("the mechanisms' state survives a snapshot mid-flight", async () => {
    const humans = [{ clientID: "HUMANGBR", country: "GBR" as const }];
    const a = await wwRunner({}, humans, DEEP.map);
    stepToDate(a, "1936-01-03");
    const ww = a.game.worldWar()!;
    const d = ww.depth;
    const { GBR, FRA } = DEEP.tag;
    const tick = a.game.ticks();
    ww.politics.country(GBR)!.ppMilli = 300_000;
    expect(d.issue(GBR, { kind: "treaty_leave" }, tick)).toBeNull();
    expect(
      d.issue(
        GBR,
        { kind: "faction_rule", rule: "fr_shared_intel", on: true },
        tick,
      ),
    ).toBeNull();
    expect(
      d.issue(
        GBR,
        { kind: "faction_goal", slot: 2, goal: "fg_research" },
        tick,
      ),
    ).toBeNull();
    d.country(FRA)!.mech.cfocusOpen = true;
    expect(
      d.issue(FRA, { kind: "cfocus_set", id: "cf_navy_air" }, tick),
    ).toBeNull();
    d.mech.congressBp = 4_321;
    d.mech.attackedUntil = 400;
    addBop(d, FRA, 333, ww.day(tick));
    step(a, 5);
    const b = await wwRestore(a, humans, DEEP.map);
    const db = b.game.worldWar()!.depth;
    expect(db.mech).toEqual(d.mech);
    expect(db.country(FRA)!.mech).toEqual(d.country(FRA)!.mech);
    expect(db.hash()).toBe(d.hash());
    expect(mechStatsOf(db, FRA)).toEqual(mechStatsOf(d, FRA));
    for (let i = 0; i < 60; i++) {
      step(a);
      step(b);
      expect(gameHash(b), `tick ${i + 1}`).toBe(gameHash(a));
    }
    expect(db.mech).toEqual(d.mech);
  });

  it("counts a warlord China annexes once (the -150 path)", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    stepToDate(runner, "1936-01-03");
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    // Poland stands in for China, Turkey for a warlord.
    const { POL, TUR } = DEEP.tag;
    const day = ww.day(runner.game.ticks());
    expect(warlordsAnnexedFor(d, POL, [TUR], day)).toBe(0); // alive
    ww.endgame.setCountryState(TUR, CS_GONE);
    expect(warlordsAnnexedFor(d, POL, [TUR], day)).toBe(0); // not Poland's
    ww.politics.legalOwner[ww.capitalRegion(TUR)] = POL;
    expect(warlordsAnnexedFor(d, POL, [TUR], day)).toBe(1);
    expect(ww.politics.country(POL)!.hasFlag("bop_annexed_TUR", day)).toBe(
      true,
    );
    expect(warlordsAnnexedFor(d, POL, [TUR], day + 1)).toBe(0); // once
    expect(BOP_WARLORD_ANNEX_PM).toBe(-150);
  });
});
