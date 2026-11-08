// ww162 L3 (Design A §2.2, §2.3, §3): the need-driven line planner, the
// loss ring it reads, reinforcement to the fight first, and the army card's
// shortage. The pure parts on plain input; the ring, the draw order and the
// shortage on the mini map with Germany human.
import {
  equipKey,
  EQUIPMENT_TYPES,
  RESOURCE_COUNT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  groundSlotOf,
  NEED_GROUP_COUNT,
  NEED_GROUPS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  lineNeeds,
  PLAN_LOSS_DAYS,
  planFactoryCover,
  planGapCounts,
  planReservePct,
  planSurplusCounts,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import {
  aiLandNeed,
  aiPlan,
  aiReactPlan,
  aiReserveWeightPct,
  type AiInput,
  type AiLandNeed,
  type AiOrder,
} from "@openfront/engine/ww1936/economy/AiEconomy";
import { applyHpLoss } from "@openfront/engine/ww1936/land/Battles";
import {
  armyShort,
  dailySustain,
  fightFirst,
  lossesOf,
  noteEquipLoss,
} from "@openfront/engine/ww1936/land/Sustain";
import { WwLandStateSchema } from "@openfront/engine/ww1936/land/WwLand";
import {
  byTag,
  clearLand,
  clearStartSetup,
  HUMAN,
  land,
  placeArmy,
  stepTo,
  wideLine,
  wwRunner,
} from "./util";

const G = (name: (typeof NEED_GROUPS)[number]) => NEED_GROUPS.indexOf(name);
const INF = G("infantry_equipment");
const SUP = G("support_equipment");
const ART = G("artillery");
const groups = (v: Partial<Record<number, number>> = {}) =>
  Array.from({ length: NEED_GROUP_COUNT }, (_, g) => v[g] ?? 0);

describe("lineNeeds (Design A §2.2)", () => {
  test("need = short + training + 2 × losses + reserve; cover = stock + 60 days", () => {
    const n = lineNeeds({
      short: groups({ [INF]: 100 }),
      training: groups({ [INF]: 50 }),
      lost: groups({ [INF]: 30 }),
      fielded: groups({ [INF]: 1000 }),
      stock: groups({ [INF]: 70 }),
      // 2.5 units a day.
      outMilli: groups({ [INF]: 2500 }),
      reservePct: groups({ [INF]: 10 }),
    });
    expect(n.need[INF]).toBe(100 + 50 + 60 + 100);
    expect(n.cover[INF]).toBe(70 + 150);
    expect(n.gap[INF]).toBe(310 - 220);
    expect(n.gap[ART]).toBe(0);
  });

  test("the dead band, the reserve and a factory's cover", () => {
    expect(planGapCounts(100, 5)).toBe(true);
    expect(planGapCounts(100, 4)).toBe(false);
    expect(planGapCounts(0, 0)).toBe(false);
    expect(planSurplusCounts(100, -5)).toBe(true);
    expect(planSurplusCounts(100, -4)).toBe(false);
    // Nothing needed: any surplus may give.
    expect(planSurplusCounts(0, -1)).toBe(true);
    expect(planReservePct(false, 100)).toBe(10);
    expect(planReservePct(true, 100)).toBe(20);
    expect(planReservePct(true, 150)).toBe(30);
    expect(planFactoryCover(5000, 0)).toBe(1);
    expect(planFactoryCover(10_000, 1)).toBeGreaterThan(
      planFactoryCover(5000, 1),
    );
  });

  test("the tilts scale the reserve, not the shares", () => {
    // Germany: mobile school (+5) and its own lean (+3) on a base of 15.
    expect(aiReserveWeightPct("DEU", true, G("medium_tank"))).toBe(153);
    expect(aiReserveWeightPct("DEU", true, G("light_tank"))).toBe(153);
    expect(aiReserveWeightPct("DEU", true, ART)).toBe(46);
    // A minor leans nowhere; a group with no row is 100.
    expect(aiReserveWeightPct("POL", false, ART)).toBe(100);
    expect(aiReserveWeightPct("DEU", true, G("spa_g"))).toBe(100);
  });
});

// ---- The pure plan ----

const zeros = () => new Array<number>(RESOURCE_COUNT).fill(0);
const RIFLES = equipKey("infantry_equipment", 1);
const GUNS = equipKey("artillery", 1);
const SUPPORT = equipKey("support_equipment", 1);

function input(over: Partial<AiInput> = {}): AiInput {
  return {
    tag: "POL",
    personality: "minor",
    major: false,
    day: 0,
    warDays: -1,
    laws: {
      economy: "civilian",
      trade: "export_focus",
      conscription: "limited",
    },
    lawCooldownUntil: { economy: -1, trade: -1, conscription: -1 },
    wsBp: 5000,
    wtBp: 0,
    ruling: 3,
    ppMilli: 1_000_000,
    manpower: 500_000,
    recruitable: 850_000,
    infStock: 0,
    freeCivMilli: 0,
    mil: 0,
    idleMil: 0,
    effCapBp: 5000,
    lines: [],
    queue: [],
    slots: [],
    slotCount: 0,
    researched: ["inf_eq_1", "support_eq_1", "artillery_1"],
    produced: zeros(),
    exported: zeros(),
    imported: zeros(),
    payableCivs: 0,
    paidCivs: 0,
    buying: [],
    partners: [],
    regions: [],
    ...over,
  };
}

function need(over: Partial<AiLandNeed> = {}): AiLandNeed {
  return {
    short: groups(),
    training: groups(),
    lost: groups(),
    fielded: groups(),
    stock: groups(),
    outMilli: groups(),
    ...over,
  };
}

const line = (id: number, key: number, factories: number, effBp = 5000) => ({
  id,
  key,
  factories,
  active: factories,
  effBp,
  fill: 1000,
});

function lineOrders(orders: AiOrder[]): string[] {
  return orders.flatMap((o) =>
    o.kind === "set_line_factories"
      ? [`line${o.line}=${o.factories}`]
      : o.kind === "add_line"
        ? [`+${o.equipment}x${o.factories}`]
        : [],
  );
}

describe("the need planner (Design A §2.2)", () => {
  test("idle factories go to the biggest gap, not the share table", () => {
    const base = input({
      mil: 12,
      idleMil: 2,
      lines: [line(1, RIFLES, 6), line(2, GUNS, 2), line(3, SUPPORT, 2)],
    });
    // The share table: rifles first (60% of 12), then the guns (20%).
    const react = { research: false, lines: true, construction: false };
    expect(lineOrders(aiReactPlan(base, react))).toEqual([
      "line1=7",
      "line2=3",
    ]);
    // The guns are 5,000 short; the rifles are covered.
    const planned = aiReactPlan(
      { ...base, landNeed: need({ short: groups({ [ART]: 5000 }) }) },
      { research: false, lines: true, construction: false },
    );
    expect(lineOrders(planned)).toEqual(["line2=4"]);
  });

  test("with no gap open the share table still places idle factories", () => {
    const base = input({
      mil: 12,
      idleMil: 2,
      lines: [line(1, RIFLES, 6), line(2, GUNS, 2), line(3, SUPPORT, 2)],
    });
    const react = { research: false, lines: true, construction: false };
    expect(
      lineOrders(aiReactPlan({ ...base, landNeed: need() }, react)),
    ).toEqual(lineOrders(aiReactPlan(base, react)));
  });

  test("a turn moves at most 10% of the factories from a covered line, never emptying it", () => {
    const i = input({
      mil: 40,
      lines: [line(1, RIFLES, 30), line(2, GUNS, 10)],
      landNeed: need({
        fielded: groups({ [INF]: 1000 }),
        // Rifles: 900,000 in stock, far past any need.
        stock: groups({ [INF]: 900_000 }),
        short: groups({ [ART]: 50_000 }),
      }),
    });
    expect(lineOrders(aiPlan(i))).toEqual(["line1=26", "line2=14"]);
    // A reaction between turns moves nothing.
    expect(
      lineOrders(
        aiReactPlan(i, { research: false, lines: true, construction: false }),
      ),
    ).toEqual([]);
    // A one-factory line never gives.
    const thin = input({
      mil: 40,
      lines: [line(1, RIFLES, 1), line(2, GUNS, 39)],
      landNeed: i.landNeed,
    });
    expect(lineOrders(aiPlan(thin))).toEqual([]);
  });

  test("no move for a gap under 5% of the need, nor from a surplus that would turn short", () => {
    const lines = [line(1, RIFLES, 30), line(2, GUNS, 10)];
    // Guns need 10,000, 400 short (4%).
    const small = input({
      mil: 40,
      lines,
      landNeed: need({
        stock: groups({ [INF]: 900_000, [ART]: 9600 }),
        short: groups({ [ART]: 10_000 }),
      }),
    });
    expect(lineOrders(aiPlan(small))).toEqual([]);
    // The rifles' surplus (past the dead band) is under one factory's 60
    // days at the planning efficiency, (10% + 50%) / 2: they keep it.
    const per = planFactoryCover(3000, unitCostMilli("infantry_equipment", 1));
    const rifles = 20 * (per - 1);
    const tight = input({
      mil: 40,
      lines,
      landNeed: need({
        short: groups({ [INF]: rifles, [ART]: 50_000 }),
        stock: groups({ [INF]: rifles + per - 1 }),
      }),
    });
    expect(planSurplusCounts(rifles, -(per - 1))).toBe(true);
    expect(lineOrders(aiPlan(tight))).toEqual([]);
  });

  test("a major's planes keep their share while the ground has a gap", () => {
    const orders = aiReactPlan(
      input({
        tag: "DEU",
        personality: "aggressor",
        major: true,
        mil: 100,
        idleMil: 100,
        researched: [
          "inf_eq_1",
          "support_eq_1",
          "artillery_1",
          "fighter_1",
          "cas_1",
        ],
        landNeed: need({ short: groups({ [ART]: 1_000_000 }) }),
      }),
      { research: false, lines: true, construction: false },
    );
    const added = new Map<string, number>();
    for (const o of orders) {
      if (o.kind === "add_line") added.set(o.equipment, o.factories);
    }
    expect(added.get("artillery")).toBeGreaterThan(50);
    expect(added.get("fighter")).toBeGreaterThan(0);
    expect(added.get("cas")).toBeGreaterThan(0);
    // All 100 placed.
    let n = 0;
    for (const v of added.values()) n += v;
    expect(n).toBe(100);
  });
});

// ---- On the map ----

const SUMMER = dayOfDate("1936-06-15");
const BERLIN = 3;

async function germany() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
  const g = runner.game;
  stepTo(runner, WW_PREP_TICKS + 1);
  const l = land(g);
  const id = byTag(g, "DEU").smallID();
  const ce = l.econ.country(id)!;
  clearStartSetup(l.econ, ce);
  clearLand(g);
  wideLine(g);
  ce.manpower = 100_000;
  ce.stock[RIFLES] = 10_000;
  ce.stock[GUNS] = 1_000;
  ce.stock[SUPPORT] = 1_000;
  return { g, l, id, ce, cl: l.country(id)! };
}

describe("the loss ring (Design A §2.2)", () => {
  test("battle HP loss and attrition feed it; the day 30 days on clears it", async () => {
    const { g, l, id, cl } = await germany();
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const r = l.divisions.rowOf(a.divisions[0]);
    const t = l.divisions;
    const slot = groundSlotOf(RIFLES);
    const before = t.equip[r * GROUND_SLOTS + slot];
    const h0 = l.hash();
    applyHpLoss(l, r, 5000);
    const lost = before - t.equip[r * GROUND_SLOTS + slot];
    expect(lost).toBeGreaterThan(0);
    expect(lossesOf(cl)[INF]).toBe(lost);
    expect(l.hash()).not.toBe(h0);
    // Attrition: no supply, so 1% a day goes.
    t.supply[r] = 0;
    const today = l.day();
    dailySustain(l, id, today);
    expect(lossesOf(cl)[INF]).toBeGreaterThan(lost);
    // A loss on day d is gone once the ring comes round to d again.
    noteEquipLoss(l, id, slot, 7, SUMMER);
    const sum = lossesOf(cl)[INF];
    const at = (SUMMER % PLAN_LOSS_DAYS) * NEED_GROUP_COUNT + INF;
    const thatDay = cl.lossRing[at];
    expect(thatDay).toBeGreaterThanOrEqual(7);
    t.supply[r] = 1000;
    dailySustain(l, id, SUMMER + PLAN_LOSS_DAYS - 1);
    expect(cl.lossRing[at]).toBe(0);
    expect(lossesOf(cl)[INF]).toBe(sum - thatDay);
  });

  test("it round-trips through the snapshot and hashes only when set", async () => {
    const { l, id, cl } = await germany();
    const h0 = l.hash();
    const snap0 = l.snapshot();
    expect(snap0.countries.some((c) => "lossRing" in c)).toBe(false);
    noteEquipLoss(l, id, groundSlotOf(GUNS), 12, SUMMER);
    const h1 = l.hash();
    expect(h1).not.toBe(h0);
    const snap = JSON.parse(JSON.stringify(l.snapshot()));
    cl.lossRing = [];
    expect(l.hash()).toBe(h0);
    l.restoreState(WwLandStateSchema.parse(snap));
    expect(lossesOf(l.country(id)!)[ART]).toBe(12);
    expect(l.hash()).toBe(h1);
    // An old snapshot (no ring) restores empty.
    l.restoreState(WwLandStateSchema.parse(JSON.parse(JSON.stringify(snap0))));
    expect(l.country(id)!.lossRing).toEqual([]);
  });
});

describe("reinforcement to the fight first (Design A §2.3)", () => {
  test("in battle, plan zone holders, zone holders, the rest; priority still first", async () => {
    const { g, l } = await germany();
    const t = l.divisions;
    const rest = placeArmy(g, "DEU", BERLIN, 1);
    const zone = placeArmy(g, "DEU", BERLIN, 1);
    const plan = placeArmy(g, "DEU", BERLIN, 1);
    const fight = placeArmy(g, "DEU", BERLIN, 1);
    zone.order.kind = "front";
    zone.front = [BERLIN];
    plan.order.kind = "plan";
    plan.front = [BERLIN];
    t.battle[t.rowOf(fight.divisions[0])] = BERLIN;
    const ids = [rest, zone, plan, fight].map((a) => a.divisions[0]);
    expect(fightFirst(l, ids)).toEqual([ids[3], ids[2], ids[1], ids[0]]);
    // The player's priority still wins.
    rest.priority = 2;
    expect(fightFirst(l, ids)).toEqual([ids[0], ids[3], ids[2], ids[1]]);
    t.battle[t.rowOf(fight.divisions[0])] = 0;
  });

  test("short stock goes to the division in battle", async () => {
    const { g, l, id, ce } = await germany();
    const t = l.divisions;
    const first = placeArmy(g, "DEU", BERLIN, 1);
    const fight = placeArmy(g, "DEU", BERLIN, 1);
    const slot = groundSlotOf(RIFLES);
    const rows = [first, fight].map((a) => t.rowOf(a.divisions[0]));
    for (const r of rows) l.addEquip(r, slot, -300);
    ce.stock[RIFLES] = 90; // one division's day
    t.battle[rows[1]] = BERLIN;
    dailySustain(l, id, SUMMER);
    t.battle[rows[1]] = 0;
    const fill = rows.map((r) => t.equip[r * GROUND_SLOTS + slot]);
    expect(fill[1]).toBeGreaterThan(fill[0]);
  });
});

describe("the army's shortage and the planner's view (Design A §3)", () => {
  test("the two shortest groups, most missing first, on the human's summary", async () => {
    const { g, l, id, ce } = await germany();
    const a = placeArmy(g, "DEU", BERLIN, 2);
    const t = l.divisions;
    expect(armyShort(l, a)).toEqual([]);
    expect(l.armySummary(a).mine!.short).toBeUndefined();
    for (const d of a.divisions) {
      const r = t.rowOf(d);
      l.addEquip(r, groundSlotOf(RIFLES), -100);
      l.addEquip(
        r,
        groundSlotOf(GUNS),
        -t.equip[r * GROUND_SLOTS + groundSlotOf(GUNS)],
      );
      l.addEquip(r, groundSlotOf(SUPPORT), -1);
    }
    const short = armyShort(l, a);
    expect(short).toHaveLength(2);
    expect(short[0]).toEqual([INF, 200]);
    expect(short[1][0]).toBe(ART);
    expect(l.armySummary(a).mine!.short).toEqual(short);
    // The planner sees the same shortage, the full need and the losses.
    noteEquipLoss(l, id, groundSlotOf(SUPPORT), 5, SUMMER);
    const view = aiLandNeed(l.econ, ce)!;
    expect(view.short[INF]).toBe(200);
    expect(view.short[SUP]).toBe(2);
    expect(view.fielded[INF]).toBeGreaterThan(0);
    expect(view.lost[SUP]).toBe(5);
    expect(view.stock[INF]).toBe(ce.stock[RIFLES]);
    expect(EQUIPMENT_TYPES[INF]).toBe("infantry_equipment");
  });
});
