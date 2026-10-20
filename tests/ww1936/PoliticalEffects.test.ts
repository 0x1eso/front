// World War 1936 P3 (spec §7, §10.4 political group; plan decisions 11,
// 21; controller rulings R9, R10): every political effect kind once, the
// law table through P1's set_law order, and the AI's law waiting for its
// PP — on the test map ww1936pol with the test content.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { EFFECT_KINDS } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { aiLawTarget } from "@openfront/engine/ww1936/economy/AiEconomy";
import { lawBlock } from "@openfront/engine/ww1936/economy/LawsRun";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, order, pol, POL, step, stepTo, wwRunner } from "./util";

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({
      spirits: [
        { id: "gen_t_spirit", stats: { ppGainPct: 10 }, icon: "flag" },
        { id: "t_other", stats: { outputPct: 3 }, icon: "flag" },
        { id: "t_cheap_laws", stats: { lawCostPct: -50 }, icon: "flag" },
        {
          id: "t_peace_mood",
          stats: { conscriptionCostPct: 50 },
          icon: "flag",
        },
      ],
      persons: [
        {
          id: "t_gbr_eden",
          nameKey: "ww1936.person.t_gbr_eden",
          country: "GBR",
          roles: ["advisor"],
          advisor: { slot: "political", traits: ["diplomat"] },
          source: "test",
        },
        {
          id: "t_gbr_pm",
          nameKey: "ww1936.person.t_gbr_pm",
          country: "GBR",
          roles: ["leader"],
          leaderTraits: ["war_leader"],
          source: "test",
        },
      ],
      countries: [
        {
          tag: "GBR",
          ruling: "democratic",
          popularity: [75, 3, 4, 18],
          stability: 65,
          warSupport: 20,
          tree: "generic",
          leaders: {},
        },
      ],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

function afterDay(runner: GameRunner, id: number, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + (id % WW_DAY_SPLIT) + 1);
}

async function game() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "GBR" }], POL);
  step(runner);
  const g = runner.game;
  const p = pol(g);
  const gbr = byTag(g, "GBR").smallID();
  const pl = byTag(g, "POL").smallID();
  const run = (effects: Effect[], self = gbr) =>
    applyEffects(makeCtx(p, self, self, 0, g.ticks()), effects);
  return { runner, g, p, gbr, pl, c: p.country(gbr)!, run };
}

describe("political effects", () => {
  it("the political group is the first 20 kinds", () => {
    expect(EFFECT_KINDS.slice(0, 20)).toEqual([
      "pp",
      "stability",
      "war_support",
      "add_spirit",
      "remove_spirit",
      "swap_spirit",
      "popularity",
      "set_government",
      "set_leader",
      "civil_war",
      "set_law",
      "law_step",
      "add_advisor_candidate",
      "remove_advisor",
      "person_trait",
      "set_flag",
      "clear_flag",
      "set_gflag",
      "clear_gflag",
      "elections",
    ]);
  });

  it("pp: up to the cap, below 0 by an effect", async () => {
    const { c, run } = await game();
    run([{ kind: "pp", amount: 25 }]);
    expect(c.ppMilli).toBe(75_000);
    run([{ kind: "pp", amount: -100 }]);
    expect(c.ppMilli).toBe(-25_000);
    c.ppMilli = 1_490_000;
    run([{ kind: "pp", amount: 50 }]);
    expect(c.ppMilli).toBe(1_500_000);
  });

  it("stability and war_support move the bases within 0..100%", async () => {
    const { c, run } = await game();
    run([
      { kind: "stability", pct: 10 },
      { kind: "war_support", pct: -5 },
    ]);
    expect([c.stabBaseBp, c.wsBaseBp]).toEqual([7500, 1500]);
    run([
      { kind: "stability", pct: 50 },
      { kind: "war_support", pct: -50 },
    ]);
    expect([c.stabBaseBp, c.wsBaseBp]).toEqual([10_000, 0]);
  });

  it("add_spirit, remove_spirit, swap_spirit", async () => {
    const { p, c, run } = await game();
    // Britain's 65% stability already gives +4% PP and +3% output (§6.2).
    const [pp, out] = [c.stats.ppGainPct, c.stats.outputPct];
    run([{ kind: "add_spirit", id: "gen_t_spirit", days: 30 }]);
    expect(c.spirits).toEqual([
      { id: "gen_t_spirit", untilDay: p.day() + 30, addedDay: p.day() },
    ]);
    expect(c.stats.ppGainPct).toBe(pp + 10);
    run([{ kind: "swap_spirit", from: "gen_t_spirit", to: "t_other" }]);
    expect(c.spirits.map((s) => s.id)).toEqual(["t_other"]);
    expect(c.stats.ppGainPct).toBe(pp);
    expect(c.stats.outputPct).toBe(out + 3);
    run([{ kind: "remove_spirit", id: "t_other" }]);
    expect(c.spirits).toEqual([]);
    expect(c.stats.outputPct).toBe(out);
  });

  it("popularity: by ideology, ruling or largest_other; who picks the country", async () => {
    const { p, pl, c, run } = await game();
    expect(c.pop).toEqual([7500, 300, 400, 1800]);
    run([{ kind: "popularity", ideology: "fascist", pp: 10 }]);
    expect(c.pop[IDEO_FAS]).toBe(1400);
    expect(c.pop.reduce((a, b) => a + b)).toBe(10_000);
    const dem = c.pop[IDEO_DEM];
    run([{ kind: "popularity", ideology: "ruling", pp: -5 }]);
    expect(c.pop[IDEO_DEM]).toBe(dem - 500);
    run([{ kind: "popularity", ideology: "largest_other", pp: 5 }]);
    expect(c.pop[IDEO_FAS]).toBeGreaterThan(1400);
    // Spec §10.4 `who`: Britain's effect on Poland.
    run([
      {
        kind: "popularity",
        who: { tag: "POL" },
        ideology: "communist",
        pp: 20,
      },
    ]);
    expect(p.country(pl)!.pop[IDEO_COM]).toBe(1000 + 2000);
  });

  it("set_government, set_leader, civil_war", async () => {
    const { g, p, gbr, c, run } = await game();
    const msg = vi.spyOn(g, "displayMessage");
    run([{ kind: "set_government", ideology: "largest_other" }]);
    expect(c.ruling).toBe(3);
    expect(c.leader).toBe("title:leader_neutral");
    run([{ kind: "set_leader", person: "t_gbr_pm" }]);
    expect(c.leader).toBe("t_gbr_pm");
    expect(msg).toHaveBeenCalledWith(
      "events_display.ww1936_leader_changed",
      expect.anything(),
      null,
      undefined,
      { countryTag: "GBR", person: "t_gbr_pm" },
    );
    // A war leader's trait counts only at war.
    expect(c.stats.warSupportBp).toBe(0);
    g.worldWar()!.setWar(gbr, byTag(g, "POL").smallID(), g.ticks());
    p.recomputeStats(gbr);
    expect(c.stats.warSupportBp).toBeGreaterThan(0);
    const base = c.stabBaseBp;
    run([{ kind: "civil_war", ideology: "communist" }]);
    expect(c.ruling).toBe(IDEO_COM);
    expect(c.stabBaseBp).toBe(Math.max(0, base - 2500));
    expect(c.hasSpirit("gen_civil_strife")).toBe(true);
  });

  it("set_law: free skips everything; otherwise P1's order path; law_step", async () => {
    const { g, gbr, c, run } = await game();
    const ce = g.worldWar()!.economy.country(gbr)!;
    // Free: no cost, no condition (spec §7.2 "평시 징병"), no cooldown.
    run([
      { kind: "set_law", law: "conscription", value: "service", free: true },
    ]);
    expect(ce.laws.conscription).toBe("service");
    expect(c.ppMilli).toBe(50_000);
    expect(ce.lawCooldownUntil.conscription).toBe(-1);
    // Not free: refused (21% war support) → skipped.
    run([{ kind: "set_law", law: "economy", value: "war_economy" }]);
    expect(ce.laws.economy).toBe("civilian");
    // Paid: early mobilization, 75 PP.
    c.ppMilli = 100_000;
    run([{ kind: "set_law", law: "economy", value: "early_mobilization" }]);
    expect(ce.laws.economy).toBe("early_mobilization");
    expect(c.ppMilli).toBe(25_000);
    // law_step: rungs, stopping at the ladder's ends; free.
    run([{ kind: "law_step", law: "conscription", steps: -2 }]);
    expect(ce.laws.conscription).toBe("limited");
    run([{ kind: "law_step", law: "conscription", steps: -6 }]);
    expect(ce.laws.conscription).toBe("disarmed");
    run([{ kind: "law_step", law: "trade", steps: 6 }]);
    expect(ce.laws.trade).toBe("closed_economy");
    expect(c.ppMilli).toBe(25_000);
  });

  it("add_advisor_candidate, remove_advisor, person_trait", async () => {
    const { gbr, c, run } = await game();
    c.ruling = IDEO_DEM;
    c.ppMilli = 500_000;
    run([{ kind: "add_advisor_candidate", person: "t_gbr_eden" }]);
    expect(c.candidates).toEqual(["t_gbr_eden"]);
    c.advisors[0] = "t_gbr_eden";
    run([
      { kind: "person_trait", person: "t_gbr_eden", trait: "orator" },
      { kind: "person_trait", person: "t_gbr_eden", trait: "orator" },
    ]);
    expect(c.personTraits).toEqual([["t_gbr_eden", "orator"]]);
    // Diplomat (−50% diplomacy costs) and orator (ruling drift +5).
    expect(c.stats.diploCostPct).toBe(-50);
    expect(c.stats.driftDemBp).toBe(5);
    // Eden resigns: out of the seat, never offered again …
    run([{ kind: "remove_advisor", person: "t_gbr_eden" }]);
    expect(c.advisors[0]).toBeNull();
    expect(c.dismissed).toEqual(["t_gbr_eden"]);
    expect(c.stats.diploCostPct).toBe(0);
    // … until an effect brings him back.
    run([{ kind: "add_advisor_candidate", person: "t_gbr_eden" }]);
    expect(c.dismissed).toEqual([]);
    expect(c.candidates).toEqual(["t_gbr_eden"]);
    void gbr;
  });

  it("set_flag, clear_flag, set_gflag, clear_gflag", async () => {
    const { runner, p, gbr, c, run } = await game();
    const day = p.day();
    run([
      { kind: "set_flag", flag: "t_flag", days: 3 },
      { kind: "set_flag", flag: "t_forever" },
      { kind: "set_gflag", flag: "t_world" },
    ]);
    expect(c.flags.get("t_flag")).toEqual([day, day + 3]);
    expect(c.flags.get("t_forever")).toEqual([day, -1]);
    expect(p.gflags.get("t_world")).toBe(day);
    // A timed flag goes on its day, on the country's step.
    afterDay(runner, gbr, day + 3);
    expect(c.flags.has("t_flag")).toBe(false);
    expect(c.flags.has("t_forever")).toBe(true);
    run([
      { kind: "clear_flag", flag: "t_forever" },
      { kind: "clear_gflag", flag: "t_world" },
    ]);
    expect(c.flags.size).toBe(0);
    expect(p.gflags.size).toBe(0);
  });

  it("elections: suspend, and postpone", async () => {
    const { p, c, run } = await game();
    run([{ kind: "elections", suspend: true }]);
    expect(c.electionsSuspended).toBe(true);
    run([{ kind: "elections", suspend: false, postponeDays: 365 }]);
    expect(c.electionsSuspended).toBe(false);
    expect(c.nextElectionDay).toBe(p.day() + 365);
  });

  it("law costs and war-support gates follow the table", async () => {
    const { runner, g, p, gbr, c } = await game();
    const ww = g.worldWar()!;
    const ce = ww.economy.country(gbr)!;
    const setLaw = (law: "economy" | "trade" | "conscription", value: string) =>
      step(runner, 2, [order(HUMAN, { kind: "set_law", law, value } as never)]);
    stepTo(runner, WW_PREP_TICKS + 1);
    afterDay(runner, gbr, 0);
    c.ppMilli = 1_000_000;
    // Britain: 20% war support (+1% tension line), a democracy at 4% tension.
    expect(c.wsBp).toBe(2120);
    const block = (law: "economy" | "conscription" | "trade", v: string) =>
      lawBlock(ww.economy, ce, law, v as never, p.day());
    expect(block("conscription", "extensive")).toBe("law_ws");
    setLaw("conscription", "extensive");
    expect(ce.laws.conscription).toBe("volunteer");
    // 30% war support: now the tension line of a democracy (25%).
    c.wsBaseBp = 3000;
    afterDay(runner, gbr, p.day() + 1);
    expect(block("conscription", "extensive")).toBe("law_tension");
    p.wtBp = 2500;
    expect(block("conscription", "extensive")).toBeNull();
    let before = c.ppMilli;
    setLaw("conscription", "extensive");
    expect(ce.laws.conscription).toBe("extensive");
    expect(before - c.ppMilli).toBe(100_000);
    // 30 days before that kind changes again.
    expect(block("conscription", "service")).toBe("law_cooldown");
    // Economy: partial mobilization at 30%, war economy needs 50%.
    expect(block("economy", "war_economy")).toBe("law_ws");
    const pp = c.ppMilli;
    setLaw("economy", "partial_mobilization");
    expect(ce.laws.economy).toBe("partial_mobilization");
    expect(pp - c.ppMilli).toBe(100_000);
    // Trade: closed economy needs an authoritarian government or a war.
    expect(block("trade", "closed_economy")).toBe("law_ideology");
    // lawCostPct, and conscriptionCostPct on conscription laws only.
    c.spirits.push({ id: "t_cheap_laws", untilDay: -1, addedDay: 0 });
    c.spirits.push({ id: "t_peace_mood", untilDay: -1, addedDay: 0 });
    p.recomputeStats(gbr);
    before = c.ppMilli;
    setLaw("trade", "export_focus");
    expect(ce.laws.trade).toBe("export_focus");
    expect(before - c.ppMilli).toBe(37_000);
    // At war: total mobilization needs 70% war support.
    ww.setWar(gbr, byTag(g, "POL").smallID(), g.ticks());
    stepTo(runner, dayStartTick(p.day() + 31, WW_PREP_TICKS));
    afterDay(runner, gbr, p.day());
    expect(block("economy", "total_mobilization")).toBe("law_ws");
    c.wsBaseBp = 7000;
    afterDay(runner, gbr, p.day() + 1);
    expect(block("economy", "total_mobilization")).toBeNull();
    // Conscription with both modifiers: 125 × (100 − 50 + 50)%.
    before = c.ppMilli;
    setLaw("conscription", "service");
    expect(ce.laws.conscription).toBe("service");
    expect(before - c.ppMilli).toBe(125_000);
  }, 60_000);
});

describe("the AI's laws wait for their PP (spec §7.3, R10)", () => {
  it("a law the PP cannot pay is deferred, and no other law that day", async () => {
    const runner = await wwRunner({}, [], POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const p = pol(g);
    const pl = byTag(g, "POL").smallID();
    const ce = ww.economy.country(pl)!;
    const c = p.country(pl)!;
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(pl, byTag(g, "SUN").smallID(), g.ticks());
    expect(ce.laws).toMatchObject({
      economy: "civilian",
      conscription: "limited",
    });
    // A minor at war: partial mobilization first (100 PP).
    expect(aiLawTarget(ww.economy, ce, p.day())).toEqual({
      kind: "economy",
      value: "partial_mobilization",
    });
    c.ppMilli = 60_000;
    // Poland's AI turns: (day + smallID) % 10 === 0.
    const turn = (from: number) => {
      let d = from;
      while ((d + pl) % 10 !== 0) d++;
      return d;
    };
    const first = turn(p.day() + 1);
    stepTo(runner, dayStartTick(first + 1, WW_PREP_TICKS));
    // Neither the 100-PP economy law nor the conscription law after it.
    expect(ce.laws).toMatchObject({
      economy: "civilian",
      conscription: "limited",
    });
    c.ppMilli = 300_000;
    stepTo(runner, dayStartTick(turn(first + 1) + 1, WW_PREP_TICKS));
    expect(ce.laws.economy).toBe("partial_mobilization");
    expect(ce.laws.conscription).toBe("extensive");
    expect(c.ppMilli).toBeLessThan(300_000 - 150_000);
    // Nothing more to raise for now.
    expect(aiLawTarget(ww.economy, ce, p.day())).toBeNull();
  }, 60_000);
});
