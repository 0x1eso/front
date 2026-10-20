import {
  BUILDING_IDS,
  DOCTRINE_SCHOOLS,
  equipKey,
  EQUIPMENT_TYPES,
  LAW_KINDS,
  LAW_LADDERS,
  REGION_CATEGORIES,
  RESOURCE_IDS,
  TECH_BRANCHES,
  WW_ORDER_BLOCKS,
  WW_TECH_IDS,
  WwCountryDetail,
  WwLineData,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  allocateResources,
  constructionDaysLeft,
  constructionProgress,
  effAfterSwitch,
} from "@openfront/engine-lib/ww1936/EconomyRules";
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

import {
  armyMenOf,
  BLOCK_KEYS,
  BRANCH_KEYS,
  buildBlock,
  buildCandidates,
  BUILDING_KEYS,
  constructionRows,
  controlFingerprint,
  EFFECT_KEYS,
  effectLines,
  EQUIPMENT_KEYS,
  GEN_KEYS,
  idleMilOf,
  industryDial,
  LAW_KEYS,
  LAW_KIND_KEYS,
  LAW_NEED_KEYS,
  lawClosesDeals,
  lawLadder,
  lawStepReason,
  lineRows,
  lineShortages,
  liveWarDays,
  openTradeBlock,
  REGION_CAT_KEYS,
  regionCard,
  researchCards,
  researchDial,
  researchSlots,
  RESOURCE_KEYS,
  resourceRows,
  SCHOOL_KEYS,
  signedText,
  slotPctOf,
  stockRows,
  switchPreview,
  TECH_KEYS,
  topBandEconomy,
  tradeOffers,
} from "../../../src/client/hud/ww1936/EconomyModel";
import {
  detail,
  fakeEconGame,
  FakeOptions,
  ID,
  region,
  scenario,
  summary,
  tileOf,
} from "./EconomyFixture";

/** Every country selling `steel` (RESOURCE_IDS index 4) with `room` units a day. */
function sellers(room: (tag: string) => number) {
  return scenario.countries.map((tag) =>
    summary(tag, { exportRoom: [0, 0, 0, 0, room(tag), 0] }),
  );
}

describe("the World War 1936 economy screens' model (spec §13)", () => {
  it("every key table names its own id", () => {
    for (const b of BUILDING_IDS)
      expect(BUILDING_KEYS[b]).toBe(`ww1936.building.${b}`);
    for (const r of RESOURCE_IDS)
      expect(RESOURCE_KEYS[r]).toBe(`ww1936.res.${r}`);
    for (const e of EQUIPMENT_TYPES)
      expect(EQUIPMENT_KEYS[e]).toBe(`ww1936.equip.${e}`);
    expect(GEN_KEYS).toEqual(["ww1936.gen.1", "ww1936.gen.2", "ww1936.gen.3"]);
    for (const c of REGION_CATEGORIES)
      expect(REGION_CAT_KEYS[c]).toBe(`ww1936.region_cat.${c}`);
    for (const k of LAW_KINDS) {
      expect(LAW_KIND_KEYS[k]).toBe(`ww1936.law_kind.${k}`);
      for (const v of LAW_LADDERS[k])
        expect(LAW_KEYS[v]).toBe(`ww1936.law.${k}.${v}`);
    }
    for (const [v, key] of Object.entries(LAW_NEED_KEYS))
      expect(key).toBe(`ww1936.econ.law_need.${v}`);
    expect(Object.keys(LAW_NEED_KEYS).sort()).toEqual(
      [
        "partial_mobilization",
        "war_economy",
        "total_mobilization",
        "extensive",
        "service",
        "all_adults",
        "scraping",
      ].sort(),
    );
    for (const b of TECH_BRANCHES)
      expect(BRANCH_KEYS[b]).toBe(`ww1936.branch.${b}`);
    for (const s of DOCTRINE_SCHOOLS)
      expect(SCHOOL_KEYS[s]).toBe(`ww1936.school.${s}`);
    for (const t of WW_TECH_IDS) expect(TECH_KEYS[t]).toBe(`ww1936.tech.${t}`);
    for (const [k, key] of Object.entries(EFFECT_KEYS))
      expect(key).toBe(`ww1936.effect.${k}`);
    expect(Object.keys(EFFECT_KEYS)).toHaveLength(15);
    for (const b of WW_ORDER_BLOCKS)
      expect(BLOCK_KEYS[b]).toBe(`ww1936.econ.block.${b}`);
  });

  it("the top band shows factories, manpower and the shortage dot", () => {
    expect(
      topBandEconomy(summary("DEU", { civ: 32, mil: 16, shortage: true })),
    ).toEqual({ civ: 32, mil: 16, manpowerText: "119K", shortage: true });
  });

  it("construction rows estimate days with the engine formula", () => {
    const d = detail("DEU", {
      queue: [
        {
          region: 3,
          building: "civ",
          count: 2,
          progressMilli: 4_000,
          costMilli: 10_800_000,
          assignedMilli: 15_000,
          speedPct: 50,
        },
        {
          region: 4,
          building: "infra",
          count: 1,
          progressMilli: 0,
          costMilli: 4_500_000,
          assignedMilli: 0,
          speedPct: 60,
        },
      ],
    });
    const [a, b] = constructionRows(d, scenario);
    const perDay = constructionProgress(15_000, 50);
    expect(a).toMatchObject({
      index: 0,
      regionName: "Berlin",
      building: "civ",
      count: 2,
      perDay,
      civs: 15,
      daysLeft: constructionDaysLeft(10_800_000, 4_000, 2, perDay),
    });
    expect(a.daysLeft).toBe(192);
    expect(a.progress).toBeCloseTo(4_000 / 10_800_000);
    // No factories yet: no estimate.
    expect(b.daysLeft).toBe(-1);
    expect(constructionRows(d, scenario, true)[0].regionName).toBe("베를린");
    expect(industryDial(d, summary("DEU", { mil: 2, idleMil: 0 }))).toEqual({
      progress: a.progress,
      idle: 2,
      queued: 2,
    });
  });

  it("candidates sort by free slots, then infra, then id", () => {
    // Germany has annexed Poland (capitulated): Warsaw and Krakow take
    // factories at full share.
    const regions = [
      region(6, { controller: ID("DEU") }),
      region(7, { controller: ID("DEU") }),
    ];
    const fighting = (id: number) => id !== ID("POL");
    const make = (queue: WwCountryDetail["queue"] = []) =>
      fakeEconGame({
        regions,
        details: [detail("DEU", { queue })],
        capitulated: ["POL"],
      }).view;
    // Free: Berlin 10 − 8 = 2 (infra 5), Warsaw 6 − 4 = 2 (infra 3),
    // Krakow 4 − 2 = 2 (infra 3), Munich 8 − 7 = 1.
    const ids = (v: ReturnType<typeof make>) =>
      buildCandidates(v, scenario, ID("DEU"), "civ", 0, fighting).map((c) => [
        c.id,
        c.free,
      ]);
    expect(ids(make())).toEqual([
      [3, 2],
      [6, 2],
      [7, 2],
      [4, 1],
    ]);
    // The queue reserves Berlin's two free slots.
    const queued = make([
      {
        region: 3,
        building: "mil",
        count: 2,
        progressMilli: 0,
        costMilli: 7_200_000,
        assignedMilli: 0,
        speedPct: 0,
      },
    ]);
    expect(ids(queued)).toEqual([
      [6, 2],
      [7, 2],
      [4, 1],
    ]);
    expect(
      buildBlock(queued, scenario, ID("DEU"), 3, "civ", 1, 0, fighting),
    ).toBe("no_slots");
    // construction_1: +20% slots (Munich 9, two free; the report's numbers).
    const tech = detail("DEU", { researched: ["construction_1"] });
    expect(slotPctOf(tech)).toBe(20);
    const munich = buildCandidates(
      make(),
      scenario,
      ID("DEU"),
      "civ",
      slotPctOf(tech),
      fighting,
    ).find((c) => c.id === 4)!;
    expect(munich).toMatchObject({ free: 2, slots: 9 });
    expect(
      buildBlock(make(), scenario, ID("DEU"), 4, "civ", 3, 20, fighting),
    ).toBe("no_slots");
    // Somebody else's region and a full queue.
    expect(
      buildBlock(make(), scenario, ID("DEU"), 1, "civ", 1, 0, fighting),
    ).toBe("not_controlled");
    const full = make(
      Array.from({ length: 30 }, () => ({
        region: 4,
        building: "infra" as const,
        count: 1,
        progressMilli: 0,
        costMilli: 4_500_000,
        assignedMilli: 0,
        speedPct: 0,
      })),
    );
    expect(
      buildBlock(full, scenario, ID("DEU"), 6, "civ", 1, 0, fighting),
    ).toBe("queue_full");
  });

  it("occupied regions offer no factories", () => {
    // Germany holds Warsaw; Poland still fights.
    const { view, game } = fakeEconGame({
      regions: [region(6, { controller: ID("DEU") })],
      details: [detail("DEU")],
    });
    const fighting = () => true;
    const civ = buildCandidates(view, scenario, ID("DEU"), "civ", 0, fighting);
    expect(civ.map((c) => c.id)).not.toContain(6);
    expect(
      buildBlock(view, scenario, ID("DEU"), 6, "civ", 1, 0, fighting),
    ).toBe("occupied");
    // Infrastructure can go there (3 of 5, Berlin and Munich are full).
    const infra = buildCandidates(
      view,
      scenario,
      ID("DEU"),
      "infra",
      0,
      fighting,
    );
    expect(infra.map((c) => [c.id, c.free])).toEqual([[6, 2]]);
    expect(
      buildBlock(view, scenario, ID("DEU"), 3, "infra", 1, 0, fighting),
    ).toBe("infra_max");
    // The region card says so, and offers "build here".
    const card = regionCard(game as never, tileOf(6))!;
    expect(card).toMatchObject({
      cat: "city",
      civ: 3,
      mil: 1,
      dock: 0,
      slots: 6,
      infra: 3,
      pop: 20_000_000,
      occupied: true,
      mine: true,
    });
    expect(regionCard(game as never, tileOf(4))!.res).toEqual([
      { id: "oil", amount: 1 },
      { id: "steel", amount: 40 },
    ]);
    expect(regionCard(game as never, tileOf(1))!.mine).toBe(false);
  });

  it("idle military factories follow the lines asked for, before day 0 too", () => {
    const mk = (factories: number[]): WwLineData[] =>
      factories.map((f, i) => ({
        id: i + 1,
        equipment: "infantry_equipment",
        gen: 1,
        factories: f,
        active: 0,
        effBp: 1_000,
        progressMilli: 0,
        costMilli: 500,
        fill: 1000,
        outputMilli: 0,
      }));
    // The preparation minute: the engine's idleMil is still 0.
    const prep = summary("DEU", { mil: 16, idleMil: 0 });
    expect(idleMilOf(prep, detail("DEU"))).toBe(16);
    expect(idleMilOf(prep, detail("DEU", { lines: mk([10, 4]) }))).toBe(2);
    // More asked for than there are: none idle (the bottom line waits).
    expect(idleMilOf(prep, detail("DEU", { lines: mk([10, 9]) }))).toBe(0);
    // The engine's trim (Production.stepProduction) gives the same count.
    for (const asked of [[], [3], [10, 4], [10, 9], [0, 0, 20]]) {
      let avail = 16;
      for (const f of asked) avail -= Math.min(f, avail);
      expect(idleMilOf(prep, detail("DEU", { lines: mk(asked) }))).toBe(avail);
    }
  });

  it("the efficiency bar shows the cap", () => {
    const line = (
      id: number,
      equipment: WwLineData["equipment"],
      active: number,
    ): WwLineData => ({
      id,
      equipment,
      gen: 1,
      factories: active,
      active,
      effBp: 3_000,
      progressMilli: 0,
      costMilli: 3_500,
      fill: 1000,
      outputMilli: 7_000,
    });
    const resources = RESOURCE_IDS.map((r) => ({
      produced: r === "steel" ? 3 : r === "tungsten" ? 1 : 0,
      exported: 0,
      imported: 0,
      used: 0,
    }));
    const d = detail("DEU", {
      effCapBp: 6_000,
      lines: [line(1, "artillery", 1), line(2, "artillery", 1)],
      resources,
    });
    const rows = lineRows(d);
    expect(rows[0]).toMatchObject({ eff: 0.3, cap: 0.6, perDay: 2 });
    // Lines in order take what they need (EconomyRules.allocateResources):
    // the first gets 2 steel and the tungsten, the second 1 steel.
    expect(rows.map((r) => r.shortage)).toEqual([[], ["tungsten", "steel"]]);
    const fill = allocateResources(
      resources.map((r) => r.produced),
      d.lines.map((l) => ({
        key: equipKey(l.equipment, l.gen),
        factories: l.active,
      })),
    ).fill;
    expect(lineShortages(d).map((s) => s.length > 0)).toEqual(
      fill.map((f) => f < 1000),
    );
    // "Used" is what the working lines need, so the shortage is red:
    // 2 + 2 steel and 1 + 1 tungsten asked for.
    expect(resourceRows(d).find((r) => r.id === "steel")).toMatchObject({
      produced: 3,
      used: 4,
      balance: -1,
    });
    expect(resourceRows(d).find((r) => r.id === "tungsten")).toMatchObject({
      produced: 1,
      used: 2,
      balance: -1,
    });
    expect(resourceRows(d).find((r) => r.id === "oil")).toMatchObject({
      used: 0,
      balance: 0,
    });
  });

  it("switching preview matches the engine", () => {
    const line: WwLineData = {
      id: 1,
      equipment: "infantry_equipment",
      gen: 1,
      factories: 4,
      active: 4,
      effBp: 5_000,
      progressMilli: 0,
      costMilli: 500,
      fill: 1000,
      outputMilli: 0,
    };
    const cases: [WwLineData["equipment"], number, number, number][] = [
      ["infantry_equipment", 2, 4_000, 4_500],
      ["support_equipment", 1, 2_500, 3_000],
      ["artillery", 1, 1_500, 2_000],
    ];
    for (const [to, gen, plain, flexible] of cases) {
      expect(switchPreview(line, to, gen, 0)).toBe(plain);
      expect(switchPreview(line, to, gen, 1_000)).toBe(flexible);
      expect(switchPreview(line, to, gen, 0)).toBe(
        effAfterSwitch(5_000, "infantry_equipment", 1, to, gen, 0),
      );
    }
    expect(switchPreview(line, "infantry_equipment", 1, 0)).toBe(5_000);
  });

  it("trade offers follow the route rule", () => {
    const me = ID("DEU");
    const room = (tag: string) => (tag === "GBR" ? 30 : tag === "SUN" ? 9 : 16);
    const offers = (o: FakeOptions, buyer = me) => {
      const { view } = fakeEconGame({ summaries: sellers(room), ...o });
      const wars = (o.wars ?? []).map(([a, b]) => ({ a: ID(a), b: ID(b) }));
      return tradeOffers(view, scenario, buyer, wars, "steel").map(
        (x) => x.tag,
      );
    };
    // 1. Faction (Italy), land neighbours (France, Poland) and land through
    // a neighbour at peace (the Soviet Union, past Poland). Britain: no
    // shared sea (Germany has no coast) and no land route. Same room:
    // by smallID (ITA 2, FRA 4, POL 6); the Soviet Union has less.
    expect(offers({})).toEqual(["ITA", "FRA", "POL", "SUN"]);
    // 2. A war cuts the way through Poland too.
    expect(offers({ wars: [["DEU", "POL"]] })).toEqual(["ITA", "FRA"]);
    // 3. Sea: Britain shares the North Sea with France, Italy and Poland,
    // not the Black Sea with the Soviet Union.
    expect(offers({}, ID("GBR"))).toEqual(["ITA", "FRA", "POL"]);
    // 4. Too little to sell (under 8 a day), or out of the war.
    const { view } = fakeEconGame({
      summaries: sellers((t) => (t === "FRA" ? 7 : 8)),
    });
    expect(
      tradeOffers(
        view,
        scenario,
        me,
        [],
        "steel",
        (id) => id !== ID("ITA"),
      ).map((x) => [x.tag, x.room]),
    ).toEqual([
      ["SUN", 8],
      ["POL", 8],
    ]);
    // Most room first.
    expect(offers({}, ID("FRA"))[0]).toBe("GBR");
  });

  it("opening a deal blocks as the engine does", () => {
    const me = ID("DEU");
    const seller = ID("ITA");
    const { view } = fakeEconGame({
      summaries: [
        summary("DEU", { civ: 9 }),
        summary("ITA", { exportRoom: [0, 0, 0, 0, 16, 0] }),
      ],
      details: [detail("DEU", { consumerGoodsMilli: 3_750 })],
    });
    // Two factories' worth of room; 9 − 3.75 → 5 factories to pay with.
    expect(openTradeBlock(view, me, seller, "steel", 2, true)).toBeNull();
    expect(openTradeBlock(view, me, seller, "steel", 3, true)).toBe("no_room");
    expect(openTradeBlock(view, me, seller, "steel", 1, false)).toBe(
      "no_partner",
    );
    const poor = fakeEconGame({
      summaries: [
        summary("DEU", { civ: 9 }),
        summary("ITA", { exportRoom: [0, 0, 0, 0, 80, 0] }),
      ],
      // The live deals count (Trade.openTrade sums them), not the day's total.
      details: [
        detail("DEU", {
          consumerGoodsMilli: 3_750,
          paidCivs: 0,
          buying: [
            { id: 1, buyer: me, seller: ID("FRA"), resource: "oil", civs: 4 },
          ],
        }),
      ],
    }).view;
    expect(openTradeBlock(poor, me, seller, "steel", 2, true)).toBe("no_civs");
  });

  it("research cards mark done/running/available/prereq/doctrine", () => {
    const d = detail("DEU", {
      researched: ["inf_eq_1", "mobile_1"],
      slots: [
        { tech: "inf_eq_2", progressMilli: 60_000, totalMilli: 165_000 },
        null,
        null,
      ],
    });
    const states = (branch: Parameters<typeof researchCards>[1]) =>
      Object.fromEntries(
        researchCards(d, branch, 0).map((c) => [c.id, c.state]),
      );
    expect(states("infantry")).toEqual({
      inf_eq_1: "done",
      inf_eq_2: "running",
      inf_eq_3: "prereq",
      support_eq_1: "available",
      support_eq_2: "prereq",
      motorized_1: "available",
    });
    expect(states("doctrine")).toMatchObject({
      mobile_1: "done",
      mobile_2: "available",
      firepower_1: "doctrine",
      battleplan_1: "doctrine",
      mass_1: "doctrine",
      firepower_2: "prereq",
    });
    const cards = researchCards(d, "infantry", 0);
    // 1936: 120 days; 1939 three years early: +300%, a quarter of the speed.
    expect(cards.find((c) => c.id === "support_eq_1")).toMatchObject({
      days: 120,
      etaDays: 120,
      ahead: 0,
    });
    expect(cards.find((c) => c.id === "inf_eq_2")).toMatchObject({
      ahead: 300,
      etaDays: (165_000 - 60_000) / 250,
    });
    // Free trade: research +5%.
    const free = detail("DEU", {
      laws: {
        economy: "civilian",
        trade: "free_trade",
        conscription: "limited",
      },
    });
    expect(
      researchCards(free, "infantry", 0).find((c) => c.id === "support_eq_2")!
        .etaDays,
    ).toBe(Math.ceil(180_000 / Math.floor((1000 * 105) / (100 + 400))));
    // The slots: one running, two empty; the dial follows.
    const slots = researchSlots(d, 0);
    expect(slots.map((s) => s.tech)).toEqual(["inf_eq_2", null, null]);
    expect(slots[0]).toMatchObject({ ahead: 300, daysLeft: 420 });
    expect(researchDial(d)).toMatchObject({ free: 2, running: 1 });
    // Every slot busy: an available card says there is no slot.
    const busy = detail("DEU", {
      slotCount: 1,
      slots: [{ tech: "inf_eq_2", progressMilli: 0, totalMilli: 165_000 }],
    });
    const card = researchCards(busy, "infantry", 0).find(
      (c) => c.id === "support_eq_2",
    )!;
    expect(card).toMatchObject({ state: "available", block: "no_slot" });
  });

  it("effect lines name each bonus and what a tech opens", () => {
    expect(effectLines("tools_1")).toEqual(["[ww1936.effect.effCapBp] n=10"]);
    expect(effectLines("construction_1")).toEqual([
      "[ww1936.effect.constructionPct] n=10",
      "[ww1936.effect.slotPct] n=20",
    ]);
    expect(effectLines("flexible_line")).toEqual([
      "[ww1936.effect.retentionBp] n=10",
    ]);
    expect(effectLines("medium_tank_2")).toEqual([
      "[ww1936.effect.unlock] equipment=[ww1936.equip.medium_tank],gen=[ww1936.gen.2]",
    ]);
  });

  it("the stockpile counts each generation and the coverage", () => {
    const stock = new Array<number>(23).fill(0);
    stock[equipKey("artillery", 1)] = 1_000;
    stock[equipKey("artillery", 2)] = 920;
    const rows = stockRows(detail("DEU", { stock }), 480_000);
    const art = rows.find((r) => r.equipment === "artillery")!;
    expect(art.gens).toEqual([1_000, 920, 0]);
    // 1,920 guns for 480,000 men at 400 per 100,000: full.
    expect(art.coverage).toBe(1);
    expect(rows.find((r) => r.equipment === "fighter")!.coverage).toBeNull();
  });

  it("law ladder locks by condition and cooldown", () => {
    const d = detail("DEU", {
      laws: {
        economy: "civilian",
        trade: "export_focus",
        conscription: "limited",
      },
    });
    const economy = lawLadder(d, "economy", 0);
    expect(
      economy.map((s) => [s.value, s.current, s.allowed, s.block]),
    ).toEqual([
      ["civilian", true, true, "law_same"],
      ["early_mobilization", false, true, null],
      ["partial_mobilization", false, false, "law_condition"],
      ["war_economy", false, false, "law_condition"],
      ["total_mobilization", false, false, "law_condition"],
    ]);
    expect(lawStepReason(economy[0])).toBeNull();
    expect(lawStepReason(economy[1])).toBeNull();
    expect(lawStepReason(economy[2])).toBe(
      "[ww1936.econ.law_need.partial_mobilization]",
    );
    // Changed ten days ago: twenty days to wait, whatever the step.
    const waiting = detail("DEU", {
      lawCooldownUntil: { economy: 30, trade: 0, conscription: 0 },
      laws: {
        economy: "civilian",
        trade: "export_focus",
        conscription: "limited",
      },
    });
    const early = lawLadder(waiting, "economy", 10)[1];
    expect(early).toMatchObject({ cooldownDays: 20, block: "law_cooldown" });
    expect(lawStepReason(early)).toBe("[ww1936.econ.cooldown] n=20");
    // A year of war: all adults serve, not yet the last call-up.
    const war = detail("DEU", { warDays: 400 });
    const conscription = lawLadder(war, "conscription", 400);
    expect(
      conscription.find((s) => s.value === "all_adults")!.block,
    ).toBeNull();
    expect(conscription.find((s) => s.value === "scraping")!.block).toBe(
      "law_condition",
    );
  });
  it("the army counts attacks and boats, as the engine's armyMen", () => {
    expect(
      armyMenOf({
        troops: () => 1_000.7,
        outgoingAttacks: () => [{ troops: 200.5 }, { troops: 99.9 }],
        units: () => [{ troops: () => 50.9 }],
      }),
    ).toBe(1_000 + 200 + 99 + 50);
  });

  it("war days are counted live from the war list", () => {
    const at = (day: number, wars: FakeOptions["wars"]) =>
      liveWarDays(
        fakeEconGame({ ticks: dayStartTick(day, 600), wars }).game as never,
        ID("DEU"),
      );
    expect(at(40, [])).toBe(-1);
    expect(at(40, [["DEU", "POL"]])).toBe(40);
    // The detail still says peace (yesterday's): the live count opens the step.
    const d = detail("DEU", {
      warDays: -1,
      laws: {
        economy: "partial_mobilization",
        trade: "export_focus",
        conscription: "limited",
      },
    });
    const war = lawLadder(d, "economy", 40, 40).find(
      (s) => s.value === "war_economy",
    )!;
    expect(war.block).toBeNull();
    expect(
      lawLadder(d, "economy", 40).find((s) => s.value === "war_economy")!.block,
    ).toBe("law_condition");
  });

  it("knows which law changes close deals", () => {
    const steel = RESOURCE_IDS.map((r) => ({
      produced: r === "steel" ? 40 : 0,
      exported: 0,
      imported: 0,
      used: 0,
    }));
    const d = detail("DEU", {
      laws: {
        economy: "war_economy",
        trade: "export_focus",
        conscription: "limited",
      },
      resources: steel,
      // Selling 16 steel a day (cap 50% of 40 = 20); paying 5 factories.
      selling: [
        {
          id: 1,
          buyer: ID("ITA"),
          seller: ID("DEU"),
          resource: "steel",
          civs: 2,
        },
      ],
      buying: [
        {
          id: 2,
          buyer: ID("DEU"),
          seller: ID("ITA"),
          resource: "oil",
          civs: 5,
        },
      ],
    });
    const s = summary("DEU", { civ: 9, mil: 6 });
    // Limited exports: 25% of 40 = 10 < 16. Closed economy: 0.
    expect(lawClosesDeals(d, s, "trade", "limited_exports")).toBe(true);
    expect(lawClosesDeals(d, s, "trade", "closed_economy")).toBe(true);
    expect(lawClosesDeals(d, s, "trade", "free_trade")).toBe(false);
    // Civilian economy: 35% of 15 factories → 3 left to pay with, under 5.
    expect(lawClosesDeals(d, s, "economy", "civilian")).toBe(true);
    expect(lawClosesDeals(d, s, "economy", "total_mobilization")).toBe(false);
    expect(lawClosesDeals(d, s, "conscription", "service")).toBe(false);
  });

  it("the trade graph's fingerprint moves only with region control", () => {
    const { view } = fakeEconGame();
    const before = controlFingerprint(view.controller);
    view.apply({
      countries: [summary("DEU")],
      details: [],
      regions: [region(3, { civ: 9 })],
    });
    expect(controlFingerprint(view.controller)).toBe(before);
    view.apply({
      countries: [],
      details: [],
      regions: [region(6, { controller: ID("DEU") })],
    });
    expect(controlFingerprint(view.controller)).not.toBe(before);
  });

  it("numbers below zero get a real minus sign", () => {
    expect(signedText(-3)).toBe("\u22123");
    expect(signedText(2, true)).toBe("+2");
    expect(signedText(0, true)).toBe("0");
    expect(signedText(5)).toBe("5");
  });
});
