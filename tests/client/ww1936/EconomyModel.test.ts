import type { WwDesignSlotData } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_IDS,
  DOCTRINE_SCHOOLS,
  EQUIP_KEY_COUNT,
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
import {
  NEED_GROUP_COUNT,
  NEED_GROUPS,
  NG_HEAVY,
} from "@openfront/engine-api/ww1936/LandTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  allocateResources,
  constructionDaysLeft,
  constructionProgress,
  effAfterSwitch,
  regionSlots,
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
  blockedSellers,
  BRANCH_KEYS,
  buildBlock,
  buildCandidates,
  BUILDING_KEYS,
  constructionRows,
  EFFECT_KEYS,
  effectLines,
  EQUIPMENT_KEYS,
  GEN_KEYS,
  idleMilOf,
  industryDial,
  isCoreNow,
  LAW_KEYS,
  LAW_KIND_KEYS,
  LAW_NEED_KEYS,
  lawClosesDeals,
  lawLadder,
  type LawPolitics,
  lawStepReason,
  lineRows,
  lineShortages,
  liveWarDays,
  maxTradeCivs,
  menText,
  NOT_PARTNER_KEYS,
  openTradeBlock,
  paidCivsOf,
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
  stockRowIdle,
  stockStatus,
  stockTable,
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
  partners,
  region,
  scenario,
  summary,
  tileOf,
} from "./EconomyFixture";

/** Every country selling `steel` (RESOURCE_IDS index 4) with `room` units a day. */
function sellers(room: (tag: string) => number) {
  // P5: a dormant slot has no summary until it wakes.
  return scenario
    .scenarioTags()
    .map((tag) => summary(tag, { exportRoom: [0, 0, 0, 0, room(tag), 0] }));
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
    // P1's 14 keys, P2's 20 (plan decision 11), the unlock line, P4's 9
    // and its 15 doctrine keys (P6 pre-flight).
    expect(Object.keys(EFFECT_KEYS)).toHaveLength(59);
    for (const b of WW_ORDER_BLOCKS)
      expect(BLOCK_KEYS[b]).toBe(`ww1936.econ.block.${b}`);
  });

  it("the top band shows factories, manpower and the shortage dot", () => {
    // Manpower in real men (spec §13.1, ruling): 1,195,000 is "1.2M", not
    // the troop bar's tenths ("119K").
    expect(
      topBandEconomy(summary("DEU", { civ: 32, mil: 16, shortage: true })),
    ).toEqual({ civ: 32, mil: 16, manpowerText: "1.2M", shortage: true });
    expect(menText(1_195_000)).toBe("1.2M");
    expect(menText(1_675_000)).toBe("1.7M");
    expect(menText(480_000)).toBe("480K");
    expect(menText(18_611)).toBe("18.6K");
    expect(menText(12_345_678)).toBe("12.3M");
    expect(menText(0)).toBe("0");
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
    // 30% faster building: was 192 days.
    expect(a.daysLeft).toBe(135);
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

  it("the core line reads the endgame's core table once it changed", () => {
    // Warsaw: Poland's core in the scenario.
    expect(isCoreNow(null, scenario, 6, ID("POL"))).toBe(true);
    expect(isCoreNow(null, scenario, 6, ID("DEU"))).toBe(false);
    const endgame = {
      coreHolders: (r: number) => (r === 6 ? [ID("DEU")] : null),
    };
    expect(isCoreNow(endgame as never, scenario, 6, ID("POL"))).toBe(false);
    expect(isCoreNow(endgame as never, scenario, 6, ID("DEU"))).toBe(true);
    // Unchanged regions keep the scenario's.
    expect(isCoreNow(endgame as never, scenario, 3, ID("DEU"))).toBe(
      isCoreNow(null, scenario, 3, ID("DEU")),
    );
  });

  it("an AI's region card counts its controller's slot research", () => {
    // Paris (a metropolis) is French; France is an AI: no detail, so only
    // its summary's slotPct (the engine's techs' bonus) says what it has.
    const card = (o: FakeOptions) =>
      regionCard(fakeEconGame(o).game as never, tileOf(1))!;
    const base = regionSlots("metropolis", 0);
    expect(card({ summaries: [summary("FRA")] }).slots).toBe(base);
    expect(card({ summaries: [summary("FRA", { slotPct: 40 })] }).slots).toBe(
      regionSlots("metropolis", 40),
    );
    expect(regionSlots("metropolis", 40)).toBeGreaterThan(base);
    // Germany's Munich: my summary's bonus, as the build checks use it.
    const munich = regionCard(
      fakeEconGame({
        summaries: [summary("DEU", { slotPct: 20 })],
        details: [detail("DEU", { researched: ["construction_1"] })],
      }).game as never,
      tileOf(4),
    )!;
    expect(munich.slots).toBe(9);
    // Before the first summary, a human's own detail gives it.
    expect(
      regionCard(
        fakeEconGame({
          details: [detail("DEU", { researched: ["construction_1"] })],
        }).game as never,
        tileOf(4),
      )!.slots,
    ).toBe(9);
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
    const alloc = allocateResources(
      resources.map((r) => r.produced),
      d.lines.map((l) => ({
        key: equipKey(l.equipment, l.gen),
        factories: l.active,
      })),
    );
    expect(lineShortages(d).map((s) => s.length > 0)).toEqual(
      alloc.fill.map((f) => f < 1000),
    );
    // The very resources the engine's allocation found short.
    expect(lineShortages(d)).toEqual(
      alloc.short.map((lacks) => lacks.map((r) => RESOURCE_IDS[r])),
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

  it("trade offers are the engine's partners with room to sell", () => {
    const me = ID("DEU");
    const room = (tag: string) => (tag === "GBR" ? 30 : tag === "SUN" ? 9 : 16);
    // The engine judged Italy (faction), France and Poland (land), the
    // Soviet Union (land past Poland) partners; Britain not (no route).
    const mine = partners("ITA", "FRA", "POL", "SUN");
    const model = (
      o: FakeOptions = {},
      extra: Partial<WwCountryDetail> = {},
    ) => {
      const { view } = fakeEconGame({
        summaries: sellers(room),
        details: [detail("DEU", { ...mine, ...extra })],
        ...o,
      });
      const wars = (o.wars ?? []).map(([a, b]) => ({ a: ID(a), b: ID(b) }));
      return {
        offers: tradeOffers(view, scenario, me, wars, "steel").map(
          (x) => x.tag,
        ),
        blocked: (embargoed: (id: number) => boolean = () => false) =>
          blockedSellers(
            view,
            scenario,
            me,
            wars,
            "steel",
            () => true,
            embargoed,
          ).map((x) => [x.tag, x.reason]),
      };
    };
    // Same room: by smallID (ITA 2, FRA 4, POL 6); the Soviet Union has less.
    expect(model().offers).toEqual(["ITA", "FRA", "POL", "SUN"]);
    // Britain has steel to sell but no route to me: shown, and why.
    expect(model().blocked()).toEqual([["GBR", "route"]]);
    // A war declared since my last detail cuts at once (the P0 list is live).
    const war = model({ wars: [["DEU", "POL"]] });
    expect(war.offers).toEqual(["ITA", "FRA", "SUN"]);
    expect(war.blocked()).toEqual([
      ["GBR", "route"],
      ["POL", "war"],
    ]);
    // A seller's embargo on me (the engine leaves it out of my partners).
    const embargo = model({}, partners("ITA", "POL", "SUN"));
    expect(embargo.offers).toEqual(["ITA", "POL", "SUN"]);
    expect(embargo.blocked((id) => id === ID("FRA"))).toEqual([
      ["GBR", "route"],
      ["FRA", "embargo"],
    ]);
    // No detail yet: nobody to buy from (the screens build no graph).
    const { view: bare } = fakeEconGame({ summaries: sellers(room) });
    expect(tradeOffers(bare, scenario, me, [], "steel")).toEqual([]);
    // Nothing left to sell, or out of the war: left out of both. P4 Task
    // 15: less than a factory's 8 still sells (the last factory buys it).
    const { view } = fakeEconGame({
      summaries: sellers((t) => (t === "FRA" ? 0 : t === "POL" ? 3 : 8)),
      details: [detail("DEU", mine)],
    });
    const fighting = (id: number) => id !== ID("ITA");
    expect(
      tradeOffers(view, scenario, me, [], "steel", fighting).map((x) => [
        x.tag,
        x.room,
      ]),
    ).toEqual([
      ["SUN", 8],
      ["POL", 3],
    ]);
    expect(
      blockedSellers(view, scenario, me, [], "steel", fighting).map(
        (x) => x.tag,
      ),
    ).toEqual(["GBR"]);
    expect(NOT_PARTNER_KEYS).toEqual({
      war: "ww1936.econ.not_partner_war",
      embargo: "ww1936.econ.not_partner_embargo",
      route: "ww1936.econ.not_partner_route",
    });
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
    expect(maxTradeCivs(view, me, 16)).toBe(2);
    // P4 Task 15: the last factory buys what is left (17 → three factories).
    const part = fakeEconGame({
      summaries: [
        summary("DEU", { civ: 9 }),
        summary("ITA", { exportRoom: [0, 0, 0, 0, 17, 0] }),
      ],
      details: [detail("DEU", { consumerGoodsMilli: 3_750 })],
    }).view;
    expect(openTradeBlock(part, me, seller, "steel", 3, true)).toBeNull();
    expect(openTradeBlock(part, me, seller, "steel", 4, true)).toBe("no_room");
    expect(maxTradeCivs(part, me, 17)).toBe(3);
    expect(maxTradeCivs(part, me, 3)).toBe(1);
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
            {
              id: 1,
              buyer: me,
              seller: ID("FRA"),
              resource: "oil",
              civs: 4,
              units: 32,
            },
          ],
        }),
      ],
    }).view;
    expect(openTradeBlock(poor, me, seller, "steel", 2, true)).toBe("no_civs");
    // ww115 T13: a paused deal pays nothing, as the engine's openTrade counts.
    const deal = {
      id: 1,
      buyer: me,
      seller: ID("FRA"),
      resource: "oil",
      civs: 4,
      units: 32,
    } as const;
    expect(paidCivsOf(detail("DEU", { buying: [deal] }))).toBe(4);
    expect(
      paidCivsOf(detail("DEU", { buying: [{ ...deal, pausedLeft: 30 }] })),
    ).toBe(0);
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
      // P2 (P2 spec §4.6): special forces (the companies are the support
      // tab's since the research overhaul).
      mountaineers: "available",
      marines: "available",
      paratroopers: "prereq",
      // Research overhaul (changes §2.3): the improvements.
      inf_imp_1: "available",
      support_imp_1: "prereq",
      winter_gear_1: "available",
      motorized_2: "prereq",
      desert_gear_1: "available",
      inf_imp_2: "prereq",
      marines_2: "prereq",
      inf_at_1: "prereq",
      para_2: "prereq",
      motorized_3: "prereq",
      inf_at_2: "prereq",
      inf_imp_3: "prereq",
    });
    expect(Object.keys(states("support"))).toHaveLength(17);
    expect(states("support").engineer_company).toBe("prereq");
    // P6 plan decision 25: the doctrine techs are retired, none is offered
    // (the grand doctrines take their place).
    expect(states("doctrine")).toEqual({});
    expect(states("naval")).not.toHaveProperty("fleet_in_being_1");
    expect(states("air")).not.toHaveProperty("strategic_destruction_1");
    const cards = researchCards(d, "infantry", 0);
    // 1936: 240 days at the knob; 1939 three years early: the first year's
    // +100%, the next two +600% each (1936 is a leap year: one day more).
    expect(cards.find((c) => c.id === "support_eq_1")).toMatchObject({
      days: 84,
      etaDays: 84,
      ahead: 0,
    });
    expect(cards.find((c) => c.id === "inf_eq_2")).toMatchObject({
      ahead: 1301,
      etaDays: Math.ceil((165_000 - 60_000) / 71),
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
    ).toBe(Math.ceil(126_000 / Math.floor((1000 * 105) / (100 + 1901))));
    // The slots: one running, two empty; the dial follows.
    const slots = researchSlots(d, 0);
    expect(slots.map((s) => s.tech)).toEqual(["inf_eq_2", null, null]);
    expect(slots[0]).toMatchObject({ ahead: 1301, daysLeft: 1479 });
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
    // One line per effect; the last line lists what the tech leads to.
    const own = (id: Parameters<typeof effectLines>[0]) =>
      effectLines(id).filter((l) => !l.startsWith("[ww1936.techfx.opens"));
    expect(own("tools_1")).toEqual(["[ww1936.effect.effCapBp] n=10"]);
    expect(own("construction_1")).toEqual([
      "[ww1936.effect.constructionPct] n=10",
      "[ww1936.effect.slotPct] n=20",
    ]);
    expect(own("flexible_line")).toEqual(["[ww1936.effect.retentionBp] n=10"]);
    expect(own("medium_tank_2")).toEqual([
      "[ww1936.effect.unlock] equipment=[ww1936.equip.medium_tank],gen=[ww1936.gen.2]",
      "[ww1936.techfx.tank_chassis] list=[ww1936.base.tank.medium_2]",
    ]);
    expect(effectLines("tools_1")[1]).toContain("[ww1936.techfx.opens]");
  });

  it("the stock status sentence picks its branch from short, stock and output", () => {
    expect(stockStatus(null, 5, 2).kind).toBe("unused");
    expect(stockStatus(0, 0, 0).kind).toBe("enough");
    expect(stockStatus(100, 100, 0).kind).toBe("from_stock");
    expect(stockStatus(100, 400, 0).kind).toBe("from_stock");
    const days = stockStatus(500, 100, 3);
    expect(days).toMatchObject({ kind: "days", days: 134, tone: "warn" });
    const none = stockStatus(500, 100, 0);
    expect(none).toMatchObject({ kind: "no_line", tone: "bad" });
  });

  it("the stock table sums a group's keys, orders the short first and folds the idle", () => {
    const g = (name: string) => NEED_GROUPS.indexOf(name as never);
    const stock = new Array<number>(EQUIP_KEY_COUNT).fill(0);
    stock[equipKey("artillery", 1)] = 60;
    stock[equipKey("artillery", 2)] = 40;
    stock[equipKey("infantry_equipment", 1)] = 1_000;
    stock[equipKey("fighter", 1)] = 7;
    stock[equipKey("tank_design", 1)] = 30;
    const line = (
      equipment: "artillery" | "fighter",
      gen: number,
    ): WwLineData => ({
      id: 1,
      equipment,
      gen,
      factories: 2,
      active: 2,
      effBp: 5_000,
      progressMilli: 0,
      costMilli: 1_000,
      fill: 0,
      outputMilli: 2_000,
    });
    const d = detail("DEU", {
      stock,
      lines: [line("artillery", 1), line("fighter", 1)],
    });
    const short = new Array<number>(NEED_GROUP_COUNT).fill(0);
    short[g("artillery")] = 500;
    short[g("infantry_equipment")] = 100;
    short[NG_HEAVY] = 20;
    const heavy: WwDesignSlotData = {
      kind: "tank",
      slot: 1,
      def: {
        kind: "tank",
        base: "heavy_1",
        modules: [
          "gun_cs",
          "turret_3",
          "bogie",
          "welded",
          "petrol",
          "radio",
          "",
        ],
        armorLevel: 0,
        engineLevel: 0,
        name: "Panzer",
      },
      origin: "own",
      from: 0,
      obsolete: false,
      inUse: 0,
    };
    const rows = stockTable(d, short, [heavy]);
    // Biggest shortage first, then the others in type order.
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual([
      "artillery",
      "infantry_equipment",
      "heavy_tank_g",
    ]);
    const art = rows[0];
    expect(art).toMatchObject({ stock: 100, short: 500, perDay: 2 });
    // (500 - 100) / 2 a day.
    expect(art.status).toMatchObject({ kind: "days", days: 200 });
    // The same number the production row shows.
    expect(art.perDay).toBe(lineRows(d)[0].perDay);
    expect(art.parts.map((p) => p.count)).toEqual([60, 40]);
    expect(rows[1].status.kind).toBe("from_stock");
    // A design key sits in its design's group, named by the design.
    expect(rows[2]).toMatchObject({ stock: 30, short: 20 });
    expect(rows[2].status.kind).toBe("from_stock");
    expect(rows[2].parts).toEqual([{ name: "Panzer", count: 30 }]);
    // Planes: stock and output, no shortage.
    const fighter = rows.find((r) => r.id === "fighter")!;
    expect(fighter).toMatchObject({ stock: 7, short: null, perDay: 2 });
    expect(fighter.status.kind).toBe("unused");
    // No stock, nothing short, no output: folds away.
    expect(rows.some(stockRowIdle)).toBe(true);
    expect(stockRowIdle(rows.find((r) => r.id === "convoy")!)).toBe(true);
    expect(stockRowIdle(fighter)).toBe(false);
    // Without the land war's report nothing is claimed short.
    expect(stockTable(d, null).every((r) => r.short === null)).toBe(true);
    // ww71: with a catalogue the plane stock row is "aircraft", not a designer.
    const pd = (t: ReturnType<typeof stockTable>) =>
      t.find((r) => r.id === "plane_design")!.name;
    expect(pd(stockTable(d, null))).toContain("plane_design");
    expect(pd(stockTable(d, null, [], "DEU"))).toContain("plane_stock");
  });

  it("law ladder locks by condition and cooldown", () => {
    const d = detail("DEU", {
      laws: {
        economy: "civilian",
        trade: "export_focus",
        conscription: "limited",
      },
    });
    // P3 spec §7.2: neutral, 20% war support, 500 PP, at peace.
    const pol: LawPolitics = {
      wsBp: 2000,
      wtBp: 0,
      ruling: 3,
      ppMilli: 500_000,
      lawCostPct: 0,
      conscriptionCostPct: 0,
    };
    const economy = lawLadder(d, "economy", 0, -1, pol);
    expect(
      economy.map((s) => [s.value, s.current, s.allowed, s.block, s.costPp]),
    ).toEqual([
      ["civilian", true, true, "law_same", 50],
      ["early_mobilization", false, true, null, 75],
      ["partial_mobilization", false, false, "law_ws", 100],
      ["war_economy", false, false, "law_ws", 150],
      ["total_mobilization", false, false, "law_condition", 150],
    ]);
    expect(lawStepReason(economy[0])).toBeNull();
    expect(lawStepReason(economy[1])).toBeNull();
    expect(lawStepReason(economy[2])).toBe("[ww1936.econ.block.law_ws]");
    // Too little PP for the step.
    expect(
      lawLadder(d, "economy", 0, -1, { ...pol, ppMilli: 74_999 })[1].block,
    ).toBe("no_pp");
    // Without politics yet: nothing known, nothing that costs is open.
    expect(lawLadder(d, "economy", 0)[1].block).toBe("no_pp");
    // Changed ten days ago: twenty days to wait, whatever the step.
    const waiting = detail("DEU", {
      lawCooldownUntil: { economy: 30, trade: 0, conscription: 0 },
      laws: {
        economy: "civilian",
        trade: "export_focus",
        conscription: "limited",
      },
    });
    const early = lawLadder(waiting, "economy", 10, -1, pol)[1];
    expect(early).toMatchObject({ cooldownDays: 20, block: "law_cooldown" });
    expect(lawStepReason(early)).toBe("[ww1936.econ.cooldown] n=20");
    // At war with 70% war support: all adults serve, not yet the last call-up.
    const war = detail("DEU", { warDays: 400 });
    const conscription = lawLadder(war, "conscription", 400, 400, {
      ...pol,
      wsBp: 7000,
    });
    expect(
      conscription.find((s) => s.value === "all_adults")!.block,
    ).toBeNull();
    expect(conscription.find((s) => s.value === "scraping")!.block).toBe(
      "law_ws",
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
    // P3 spec §7.2: war economy is open at war whatever the war support.
    const pol: LawPolitics = {
      wsBp: 2000,
      wtBp: 0,
      ruling: 3,
      ppMilli: 500_000,
      lawCostPct: 0,
      conscriptionCostPct: 0,
    };
    const war = lawLadder(d, "economy", 40, 40, pol).find(
      (s) => s.value === "war_economy",
    )!;
    expect(war.block).toBeNull();
    expect(
      lawLadder(d, "economy", 40, -1, pol).find(
        (s) => s.value === "war_economy",
      )!.block,
    ).toBe("law_ws");
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
          units: 16,
        },
      ],
      buying: [
        {
          id: 2,
          buyer: ID("DEU"),
          seller: ID("ITA"),
          resource: "oil",
          civs: 5,
          units: 40,
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

  it("numbers below zero get a real minus sign", () => {
    expect(signedText(-3)).toBe("\u22123");
    expect(signedText(2, true)).toBe("+2");
    expect(signedText(0, true)).toBe("0");
    expect(signedText(5)).toBe("5");
  });
});
