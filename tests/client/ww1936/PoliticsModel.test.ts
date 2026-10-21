import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { LAW_VALUES } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { lawBlock } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { shipNameList } from "@openfront/engine-lib/ww1936/ShipNames";
import fs from "fs";
import path from "path";
import { EventsDisplay } from "../../../src/client/hud/layers/EventsDisplay";
import {
  advisorTab,
  annexerOf,
  bandStats,
  decisionTab,
  declareButton,
  effectLines,
  factionTab,
  focusDial,
  governmentTab,
  LAW_GATES,
  lawTab,
  newsText,
  playerActions,
  POLITICS_NOTICES,
  politicsDial,
  politicsInput,
  politicsParams,
} from "../../../src/client/hud/ww1936/PoliticsModel";
import {
  diplomacyModel,
  regionInfo,
} from "../../../src/client/hud/ww1936/WorldWarModel";
import { LandFrontWorld } from "../../../src/client/view/LandFrontWorld";
import { WwPoliticsView } from "../../../src/client/view/WwPoliticsView";
import { detail, ID, scenario, summary, tileOf } from "./EconomyFixture";
import {
  card,
  fakePolGame,
  polDetail,
  polGlobal,
  PolOptions,
  polSummary,
  startFactions,
  statsArray,
} from "./PoliticsFixture";

function input(o: PolOptions) {
  const r = fakePolGame(o);
  return { ...r, i: politicsInput(r.game as never)! };
}

describe("PoliticsModel (P3 spec §21)", () => {
  it("band numbers and colours", () => {
    const { i } = input({
      polSummaries: [
        polSummary("DEU", { ppMilli: 132_400, stabBp: 6_200, wsBp: 4_500 }),
      ],
      polDetails: [polDetail("DEU", { ppGainMilli: 2_300 })],
      global: { wtBp: 3_400 },
    });
    expect(bandStats(i)).toEqual({
      pp: "132",
      gain: "+2.3",
      stabPct: 62,
      wsPct: 45,
      wtPct: 34,
      stabTone: "ok",
      wsTone: "warn",
      ppLabel: "[ww1936.pol.band.pp] pp=132,gain=+2.3",
      stabLabel: "[ww1936.pol.band.stability] pct=62",
      wsLabel: "[ww1936.pol.band.war_support] pct=45",
      wtLabel: "[ww1936.pol.band.tension] pct=34",
    });
    // Under 30% red, under 50% orange (spec §21.1); a loss has a real minus.
    const low = input({
      polSummaries: [
        polSummary("DEU", { ppMilli: -4_000, stabBp: 2_999, wsBp: 5_000 }),
      ],
      polDetails: [polDetail("DEU", { ppGainMilli: -400 })],
    }).i;
    expect(bandStats(low)).toMatchObject({
      pp: "−4",
      gain: "−0.4",
      stabTone: "bad",
      wsTone: "ok",
    });
    // A spectator and a capitulated country have none.
    expect(politicsInput(fakePolGame({ me: null }).game as never)).toBeNull();
    const gone = input({
      capitulated: ["DEU"],
      polSummaries: [polSummary("DEU")],
    }).i;
    expect(bandStats(gone)).toBeNull();
  });

  it("law cards show cost and the missing threshold", () => {
    const { i } = input({
      summaries: [summary("DEU")],
      details: [
        detail("DEU", {
          laws: {
            economy: "civilian",
            trade: "export_focus",
            conscription: "volunteer",
          },
          lawCooldownUntil: { economy: 0, trade: 12, conscription: 0 },
        }),
      ],
      politics: { ruling: 0, wsBp: 2_400, wtBp: 1_000, ppMilli: 500_000 },
    });
    const ladders = lawTab(i)!;
    const economy = ladders.find((l) => l.kind === "economy")!;
    const partial = economy.steps.find(
      (s) => s.value === "partial_mobilization",
    )!;
    expect(partial).toMatchObject({
      state: "locked",
      cost: "[ww1936.pol.law.cost] pp=100",
      lines: [
        {
          ok: false,
          text: "[ww1936.pol.law.need_ws] need=30,now=24",
        },
        {
          ok: false,
          text: "[ww1936.pol.law.need_tension] need=25,ideology=[ww1936.ideology.democratic]",
        },
      ],
      reason: null,
    });
    expect(economy.steps[0]).toMatchObject({ state: "current", lines: [] });
    expect(
      economy.steps.find((s) => s.value === "early_mobilization"),
    ).toMatchObject({ state: "open", lines: [] });
    // The trade law waits 12 days.
    expect(ladders.find((l) => l.kind === "trade")!.wait).toBe(
      "[ww1936.pol.law.wait] days=12",
    );
    // A war-only law says so at peace.
    const total = economy.steps.find((s) => s.value === "total_mobilization")!;
    expect(total.lines[0]).toEqual({
      ok: false,
      text: "[ww1936.pol.law.need_war]",
    });
  });

  it("the law lines read lawBlock's own gates", () => {
    for (const value of LAW_VALUES) {
      const g = LAW_GATES[value];
      if (g === undefined) continue;
      const ctx = {
        wtBp: 10_000,
        ruling: 2,
        atWar: g.needWar,
        ppMilli: 0,
        costMilli: 0,
      };
      expect(lawBlock(value, { ...ctx, wsBp: g.ws - 1 }), value).toBe("law_ws");
      expect(lawBlock(value, { ...ctx, wsBp: g.ws }), value).toBeNull();
      if (g.wt > 0) {
        const dem = { ...ctx, ruling: 0, atWar: false, wsBp: g.ws };
        expect(lawBlock(value, { ...dem, wtBp: g.wt - 1 }), value).toBe(
          "law_tension",
        );
        expect(lawBlock(value, { ...dem, wtBp: g.wt }), value).toBeNull();
      }
    }
  });

  it("the declare button text follows goal and government", () => {
    const pol = ID("POL");
    const fra = ID("FRA");
    const fascist = input({
      polSummaries: [polSummary("DEU", { ruling: 2 })],
      polDetails: [polDetail("DEU")],
    }).i;
    // No goal: allowed with the penalty (spec §14.5): 2 × 2 + 4, a major 2 × 5 + 4.
    expect(declareButton(fascist, pol)).toMatchObject({
      label: "[ww1936.diplo.act.declare_no_goal] tension=8",
      block: null,
    });
    expect(declareButton(fascist, fra).label).toBe(
      "[ww1936.diplo.act.declare_no_goal] tension=14",
    );
    const withGoal = input({
      polSummaries: [polSummary("DEU", { ruling: 0 })],
      polDetails: [
        polDetail("DEU", {
          warGoals: [{ on: pol, type: "conquer", untilDay: 300 }],
        }),
      ],
    }).i;
    expect(declareButton(withGoal, pol)).toMatchObject({
      label: "[ww1936.diplo.act.declare_goal] type=[ww1936.wargoal.conquer]",
      block: null,
    });
    // A democracy without a goal may not.
    expect(declareButton(withGoal, fra)).toMatchObject({
      label: "[ww1936.declare.button]",
      block: "[ww1936.declare.block.democracy_no_goal]",
    });
    // A pact blocks it; the engine's answer wins over the view.
    const pact = input({
      polSummaries: [polSummary("DEU", { ruling: 2 })],
      polDetails: [polDetail("DEU")],
      global: { naps: [[ID("DEU"), pol, 0, true]] },
    }).i;
    expect(declareButton(pact, pol).block).toBe("[ww1936.declare.block.nap]");
    expect(declareButton(pact, pol, true).block).toBeNull();
    expect(declareButton(fascist, pol, false).block).toBe(
      "[ww1936.declare.block.isolation]",
    );
    // Before my first politics update: P0's button.
    const { game } = fakePolGame({});
    const fresh = new WwPoliticsView(scenario);
    const p0 = politicsInput({ ...game, wwPolitics: () => fresh } as never)!;
    expect(declareButton(p0, pol)).toMatchObject({
      label: "[ww1936.declare.button]",
      block: null,
    });
  });

  it("blocked diplomacy actions show one reason", () => {
    const pol = ID("POL");
    const { i } = input({
      polSummaries: [
        polSummary("DEU", { ruling: 0, ppMilli: 10_000 }),
        polSummary("POL"),
      ],
      polDetails: [polDetail("DEU")],
      global: { wtBp: 1_000 },
    });
    const m = playerActions(i, pol);
    const act = (id: string) => m.actions.find((a) => a.id === id)!;
    // A democracy at 10% tension may neither justify nor guarantee (spec §14.3, §14.4).
    expect(act("justify").block).toBe("[ww1936.econ.block.tension_gate]");
    expect(act("guarantee").block).toBe("[ww1936.econ.block.tension_gate]");
    // 10 PP: a pact costs 25.
    expect(act("nap_offer")).toMatchObject({
      cost: "[ww1936.pol.pp_amount] pp=25",
      block: "[ww1936.econ.block.no_pp]",
    });
    // Improve relations costs 10: open.
    expect(act("improve").block).toBeNull();
    for (const a of m.actions) {
      expect(typeof a.block === "string" || a.block === null).toBe(true);
    }
    // The other country's line.
    expect(m.info).toBe(
      "[ww1936.diplo.info] ideology=[ww1936.ideology.neutral],leader=[ww1936.pol.none],stab=50,ws=20",
    );
    // A pact signed 40 days ago can't be broken yet (180 days).
    const young = input({
      ticks: dayStartTick(40, 600),
      polSummaries: [polSummary("DEU", { ruling: 2 })],
      polDetails: [polDetail("DEU")],
      global: { naps: [[ID("DEU"), pol, 0, false]] },
    }).i;
    // The pact is what blocks the war: breaking it (50 PP) sits beside the
    // declare button's reason (HOI4: break, then declare with a goal).
    const declare = playerActions(young, pol).actions.find(
      (a) => a.id === "declare",
    )!;
    expect(declare.block).toBe("[ww1936.declare.block.nap]");
    expect(declare.fix).toMatchObject({
      id: "nap_break",
      twoTap: true,
      cost: "[ww1936.pol.pp_amount] pp=50",
      block: "[ww1936.econ.block.nap_young]",
      order: { kind: "nap_break", target: pol },
    });
    expect(
      playerActions(young, pol).actions.filter((a) => a.id === "nap_break"),
    ).toHaveLength(0);
    // My own justification on them: the guarantee is not for a target.
    const justifying = input({
      polSummaries: [polSummary("DEU", { ruling: 2 })],
      polDetails: [
        polDetail("DEU", {
          justification: {
            on: pol,
            type: "conquer",
            progressDays: 1,
            totalDays: 100,
            blocked: false,
          },
        }),
      ],
    }).i;
    expect(
      playerActions(justifying, pol).actions.find((a) => a.id === "guarantee")!
        .block,
    ).toBe("[ww1936.econ.block.bad_target]");
  });

  it("advisor candidates with cost", () => {
    const { i } = input({
      polSummaries: [polSummary("DEU", { ppMilli: 100_000 })],
      polDetails: [
        polDetail("DEU", {
          candidates: [
            "deu_schacht",
            "title:administrator",
            "title:chief_offense",
          ],
          stats: statsArray({ advisorCostPct: -10 }),
          advisors: [
            "title:fiscal_hawk",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
          advisorLockUntil: [20, -1, -1, -1, -1, -1, -1, -1],
        }),
      ],
    });
    const seats = advisorTab(i);
    // P3's eight seats and P4's navy and air chiefs.
    expect(seats).toHaveLength(10);
    expect(seats[0]).toMatchObject({
      slotName: "[ww1936.advisor_slot.political]",
      holder: { name: "[ww1936.title.fiscal_hawk]" },
      lockDays: 20,
      locked: "[ww1936.pol.adv.locked] days=20",
    });
    // A political seat: 150 × 90% = 135 PP, more than my 100.
    const political = seats[1].candidates;
    expect(political.map((c) => c.id)).toEqual([
      "deu_schacht",
      "title:administrator",
    ]);
    expect(political[1]).toMatchObject({
      name: "[ww1936.title.administrator]",
      traits: ["[ww1936.trait.adv_administrator]"],
      effects: ["[ww1936.stat.ppGainPct] value=10"],
      costPp: 135,
      cost: "[ww1936.pol.adv.cost] pp=135",
      block: "[ww1936.econ.block.no_pp]",
    });
    expect(political[0].until).toBe(
      "[ww1936.pol.adv.until] date=[ww1936.date] year=1939,month=[ww1936.month.m01],day=20",
    );
    // The army chief: 90 PP, affordable.
    expect(seats[3].candidates).toMatchObject([
      { id: "title:chief_offense", costPp: 90, block: null },
    ]);
  });

  it("the government tab: leader, pie, election, sources, lines and effects", () => {
    const { i } = input({
      polSummaries: [
        polSummary("DEU", {
          ruling: 0,
          leader: "title:leader_democratic",
          pop: [6000, 1000, 1000, 2000],
          stabBp: 3_000,
          wsBp: 6_000,
          ppMilli: 50_000,
        }),
      ],
      polDetails: [
        polDetail("DEU", {
          nextElectionDay: 30,
          stats: statsArray({ driftDemBp: 5, driftFasBp: -3 }),
          statParts: [
            statsArray({}),
            statsArray({}),
            statsArray({ ppGainPct: 10 }),
          ],
          stabBaseBp: 4_000,
          stabLines: [{ key: "ww1936.pol.line.stab_party", bp: 200 }],
          wsLines: [{ key: "ww1936.pol.line.ws_tension", bp: -50 }],
        }),
      ],
    });
    const g = governmentTab(i)!;
    expect(g.leader).toBe("[ww1936.title.leader_democratic]");
    // Germany has its own name for a democratic government (K6's govNames).
    expect(g.government).toBe("[ww1936.gov.DEU.democratic]");
    expect(g.pie[0]).toMatchObject({
      pct: 60,
      drift: "[ww1936.pol.gov.drift_up] bp=0.05",
    });
    expect(g.pie[2].drift).toBe("[ww1936.pol.gov.drift_down] bp=0.03");
    expect(g.election).toBe("[ww1936.pol.gov.next_election] days=30");
    expect(g.ppSources[1]).toEqual({
      label: "[ww1936.pol.source.spirits]",
      values: ["[ww1936.stat.ppGainPct] value=10"],
    });
    expect(g.stability.lines).toEqual([
      {
        label: "[ww1936.pol.line.stab_party]",
        value: "+2%",
        negative: false,
      },
    ]);
    expect(g.warSupport.lines[0].value).toBe("−0.5%");
    // 30% stability: output −8%, construction −8%, PP gain −10%, the surrender line −2%p.
    expect(g.stability.effects).toEqual([
      "[ww1936.stat.constructionPct] value=-8",
      "[ww1936.stat.outputPct] value=-8",
      "[ww1936.stat.ppGainPct] value=-10",
      "[ww1936.stat.surrenderPp] value=-2",
    ]);
  });

  it("the dials: focus progress, PP towards an advisor, decisions to take", () => {
    const { i } = input({
      polSummaries: [polSummary("DEU", { ppMilli: 75_000 })],
      polDetails: [
        polDetail("DEU", {
          focus: {
            id: "gen_army_effort",
            progressMilli: 35_000,
            daysMilli: 70_000,
          },
          decisions: [
            {
              id: "gen_rally",
              target: 0,
              state: 0,
              costPp: 50,
              cooldownUntil: 0,
              failing: [],
            },
            {
              id: "gen_war_bonds",
              target: 0,
              state: 1,
              costPp: 50,
              cooldownUntil: 0,
              failing: [],
            },
          ],
        }),
      ],
    });
    expect(focusDial(i)).toMatchObject({ progress: 0.5, glow: false });
    expect(focusDial(i)!.label).toContain("days=35");
    expect(politicsDial(i)).toMatchObject({ progress: 0.5, badge: 1 });
    const idle = input({
      polSummaries: [polSummary("DEU")],
      polDetails: [polDetail("DEU")],
    }).i;
    expect(focusDial(idle)).toMatchObject({
      glow: true,
      label: "[ww1936.pol.dial.focus_idle]",
    });
  });

  it("notices and news name the content ids (controller ruling R3)", () => {
    const { game } = fakePolGame({ global: { factions: startFactions() } });
    expect(
      politicsParams(
        {
          countryTag: "DEU",
          aTag: "GBR",
          bTag: "FRA",
          focus: "gen_army_effort",
          event: "gen_diplo_nap",
          option: "a",
          decision: "gen_rally",
          person: "deu_schacht",
          faction: 0,
          ideology: "fascist",
          kind: "nap",
        },
        game as never,
      ),
    ).toMatchObject({
      country: "[ww1936.country.DEU]",
      a: "[ww1936.country.GBR]",
      b: "[ww1936.country.FRA]",
      focus: "[ww1936.focus.gen_army_effort]",
      event: "[ww1936.event_title.gen_diplo_nap]",
      option: "[ww1936.event_opt.gen_diplo_nap.a]",
      decision: "[ww1936.decision.gen_rally]",
      person: "[ww1936.person.deu_schacht]",
      faction: "[ww1936.faction.axis]",
      ideology: "[ww1936.ideology.fascist]",
      kind: "[ww1936.diplo.treaty.nap]",
    });
    const events = new EventsDisplay();
    const resolved = (
      events as unknown as {
        resolveParams(e: unknown): Record<string, string | number>;
      }
    ).resolveParams({
      message: "events_display.ww1936_government_changed",
      params: { countryTag: "ITA", ideology: 2 },
    });
    expect(resolved).toMatchObject({
      country: "[ww1936.country.ITA]",
      ideology: "[ww1936.ideology.fascist]",
    });
  });

  it("explain lines name selectors, picks and ids (the key table's conventions)", () => {
    const lines = effectLines([
      { kind: "tension", who: "from", pct: 6 },
      {
        kind: "build",
        where: { group: "sudetenland" },
        building: "civ",
        count: 2,
      },
      { kind: "fort", where: { borderWith: "threat", n: 3 }, amount: 1 },
      { kind: "add_spirit", id: "usa_isolation" },
      { kind: "set_flag", flag: "bookkeeping" },
      { kind: "popularity", ideology: "ruling", pp: 5 },
      { kind: "annex", who: { tag: "DEU" }, target: "self" },
    ]).map((l) => l.text);
    expect(lines).toEqual([
      expect.stringMatching(
        /^\[ww1936\.pol\.who_prefix\] who=\[ww1936\.pol\.sel\.from\]\[ww1936\.fx\.tension\] .*pct=6/,
      ),
      expect.stringContaining(
        "where=[ww1936.pol.pick.group] group=[ww1936.pol.group.sudetenland]",
      ),
      expect.stringContaining("where=[ww1936.pol.pick.border_threat] n=3"),
      expect.stringContaining("id=[ww1936.spirit.usa_isolation]"),
      // set_flag is bookkeeping: left out.
      expect.stringContaining("ideology=[ww1936.pol.ideo_ruling]"),
      expect.stringContaining("target=[ww1936.pol.sel.self]"),
    ]);
    expect(lines[5]).toContain(
      "[ww1936.pol.who_prefix] who=[ww1936.country.DEU]",
    );
  });

  it("an annexation warning finds a nested annex, and names the annexer", () => {
    const { i } = input({
      me: "POL",
      polSummaries: [polSummary("POL")],
      polDetails: [polDetail("POL")],
    });
    const c = card({ from: ID("DEU") });
    expect(
      annexerOf(i, c, [
        {
          kind: "if",
          cond: { kind: "at_war" },
          then: [{ kind: "pp", amount: 5 }],
          else: [
            {
              kind: "random_list",
              options: [
                { weight: 1, effects: [] },
                {
                  weight: 1,
                  effects: [{ kind: "annex", who: "from", target: "self" }],
                },
              ],
            },
          ],
        },
      ]),
    ).toBe(ID("DEU"));
    // Someone else annexed by the sender: no warning for me.
    expect(
      annexerOf(i, c, [{ kind: "annex", who: "from", target: { tag: "FRA" } }]),
    ).toBeNull();
  });

  it("a coup costs its equipment too, and takes two taps", () => {
    const { i } = input({
      polSummaries: [polSummary("DEU", { ruling: 0 }), polSummary("POL")],
      polDetails: [
        polDetail("DEU", {
          decisions: [
            {
              id: "gen_coup_dem",
              target: ID("POL"),
              state: 0,
              costPp: 150,
              cooldownUntil: 0,
              failing: [],
            },
          ],
        }),
      ],
    });
    const coup = playerActions(i, ID("POL")).actions.find(
      (a) => a.id === "coup",
    )!;
    expect(coup.twoTap).toBe(true);
    expect(coup.cost).toBe(
      "[ww1936.pol.decision.cost] pp=150 · [ww1936.equip.infantry_equipment] 1,000",
    );
    expect(decisionTab(i).groups[0].decisions[0]).toMatchObject({
      id: "gen_coup_dem",
      twoTap: true,
    });
  });

  it("factions: a minor founds none; the ideology rule blocks an invite", () => {
    // Poland (a minor) outside any faction: no "found a faction".
    const minor = input({
      me: "POL",
      polSummaries: [polSummary("POL")],
      polDetails: [polDetail("POL")],
      global: { factions: startFactions(), wtBp: 5_000 },
    }).i;
    expect(factionTab(minor).create).toBeNull();
    // Italy (a major) outside one may; Britain's democratic Allies don't
    // take a fascist (spec §15.3), Germany's Axis would.
    const factions = startFactions();
    factions[0].members = [ID("DEU")];
    const major = input({
      me: "ITA",
      polSummaries: [
        polSummary("ITA", { ruling: 2 }),
        polSummary("GBR", { ruling: 0, faction: 1 }),
        polSummary("DEU", { ruling: 2, faction: 0 }),
      ],
      polDetails: [polDetail("ITA")],
      global: { factions },
    }).i;
    const t = factionTab(major);
    expect(t.create).not.toBeNull();
    const request = (key: string) =>
      t.others.find((f) => f.key === key)!.request!.block;
    expect(request("allies")).toBe("[ww1936.econ.block.faction_rule]");
    expect(request("axis")).toBeNull();
  });

  it("the 19 P3 notices (plan decision 5) exist in en and ko", () => {
    expect(POLITICS_NOTICES.size).toBe(19);
    for (const lang of ["en", "ko"]) {
      const json = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, `../../../resources/lang/${lang}.json`),
          "utf8",
        ),
      );
      for (const key of POLITICS_NOTICES) {
        expect(
          json.events_display[key.slice("events_display.".length)],
          `${lang} ${key}`,
        ).toBeTypeOf("string");
      }
    }
  });

  it("every spirit an effect or condition names has a name in en and ko", () => {
    const ids = new Set<string>();
    const walkC = (c: Condition | undefined): void => {
      if (c === undefined) return;
      if ("all" in c) c.all.forEach(walkC);
      else if ("any" in c) c.any.forEach(walkC);
      else if ("not" in c) walkC(c.not);
      else if (c.kind === "has_spirit") ids.add(c.id);
    };
    const walk = (effects: readonly Effect[] | undefined): void => {
      for (const e of effects ?? []) {
        if (e.kind === "add_spirit" || e.kind === "remove_spirit")
          ids.add(e.id);
        if (e.kind === "swap_spirit") [e.from, e.to].forEach((x) => ids.add(x));
        if (e.kind === "if") {
          walkC(e.cond);
          walk(e.then);
          walk(e.else);
        }
        if (e.kind === "random_list") e.options.forEach((o) => walk(o.effects));
      }
    };
    for (const f of CONTENT.focuses) walk(f.effects);
    for (const ev of CONTENT.events) {
      walkC(ev.trigger);
      for (const o of ev.options) walk(o.effects);
    }
    for (const d of CONTENT.decisions) {
      walkC(d.available);
      walk(d.effects);
      walk(d.completeEffects);
      walk(d.failEffects);
    }
    for (const lang of ["en", "ko"]) {
      const json = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, `../../../resources/lang/${lang}.json`),
          "utf8",
        ),
      );
      const missing = [...ids].filter((id) => !(id in json.ww1936.spirit));
      expect(missing, lang).toEqual([]);
    }
  });

  it("a sunk named ship's news names the ship, its class and the sea (P4 lane N2)", () => {
    const { game } = fakePolGame({});
    const g = game as never;
    // Bismarck is Germany's first battleship name (START_NAVY lines first).
    const bb = shipNameList("DEU", "bb");
    const i = bb.indexOf("deu_bismarck") + 1;
    expect(i).toBeGreaterThan(0);
    const named = newsText(g, "ww1936_ship_sunk_named", {
      countryTag: "DEU",
      byTag: "GBR",
      cls: "bb",
      nameIdx: i,
      nameTag: "DEU",
      sr: 0,
    });
    expect(named.startsWith("[ww1936.news.ww1936_ship_sunk_named]")).toBe(true);
    for (const part of [
      "country=[ww1936.country.DEU]",
      "cls=[ww1936.ship_class.bb]",
      "ship=[ww1936.ship.deu_bismarck]",
      "sr=,",
    ]) {
      expect(named).toContain(part);
    }
    // A numbered ship: "No. n".
    expect(
      newsText(g, "ww1936_ship_sunk_named", {
        countryTag: "DEU",
        byTag: "none",
        cls: "dd",
        nameIdx: -7,
        nameTag: "DEU",
        sr: 0,
      }),
    ).toContain("ship=[ww1936.navy.ship_numbered] n=7");
  });

  it("news of two updates merged in one frame all reach the ticker", () => {
    const view = new WwPoliticsView(scenario);
    const data = (id: string) => ({
      countries: [],
      details: [],
      global: null,
      regions: [],
      news: [{ id, params: {} }],
      cards: [],
    });
    view.apply(data("news_anschluss"), 700);
    view.apply(data("news_munich"), 701);
    expect(view.takeFreshNews().map((n) => n.id)).toEqual([
      "news_anschluss",
      "news_munich",
    ]);
    expect(view.takeFreshNews()).toEqual([]);
    expect(view.news).toHaveLength(2);
  });

  it("the map's sides, the drawer's factions and its next date follow politics", () => {
    const { game, land, pol } = fakePolGame({ me: "DEU" });
    const world = new LandFrontWorld(land, {
      war: () => game.worldWarData(),
      ticks: () => game.ticks(),
      factions: () => pol.global?.factions ?? null,
    });
    expect(world.sameSide(ID("DEU"), ID("POL"))).toBe(false);
    const factions = startFactions();
    factions[0].members.push(ID("POL"));
    pol.apply(
      {
        countries: [polSummary("DEU", { faction: 0 })],
        details: [],
        global: polGlobal({ factions, nextBeatDay: 1339 }),
        regions: [],
        news: [],
        cards: [],
      },
      600,
    );
    expect(world.sameSide(ID("DEU"), ID("POL"))).toBe(true);
    const m = diplomacyModel(game as never);
    expect(m.factions[0].members.map((x) => x.tag)).toEqual([
      "DEU",
      "ITA",
      "POL",
    ]);
    expect(m.nextHistory).toBe(
      "[ww1936.date] year=1939,month=[ww1936.month.m09],day=1",
    );
  });

  it("the region line names the legal owner when someone else holds it", () => {
    const { game, pol } = fakePolGame({});
    const krakow = scenario.landRegions.find((r) => r.name === "Krakow")!;
    const tile = tileOf(krakow.id);
    expect(regionInfo(game as never, tile, false)!.legalOwner).toBeNull();
    // Kraków passed to Germany by treaty while Poland still holds it.
    pol.apply(
      {
        countries: [],
        details: [],
        global: null,
        regions: [{ id: krakow.id, legalOwner: ID("DEU") }],
        news: [],
        cards: [],
      },
      600,
    );
    expect(regionInfo(game as never, tile, false)!.legalOwner).toBe("DEU");
  });
});
