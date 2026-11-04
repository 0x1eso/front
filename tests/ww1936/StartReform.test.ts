// World War 1936: a human's start-template save in the preparation minute
// re-forms the template's divisions from its men budget; the rule's count is
// engine-lib's startReformCount. Germany is human (the test map has no
// historical order of battle, so it takes genericDivisions of template 1).
import type { LandOrder } from "@openfront/engine-api/Schemas";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  idleOrder,
  NEED_GROUPS,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  apportion,
  groupStockOf,
  previewReforms,
  startHoldings,
  startReformCount,
} from "@openfront/engine-lib/ww1936/StartReform";
import type { WwLand } from "@openfront/engine/ww1936/land/WwLand";
import {
  byTag,
  gameHash,
  HUMAN,
  land,
  step,
  stepTo,
  wwRestore,
  wwRunnerCapture,
} from "./util";

const INFANTRY = 1;

async function prepGame(tag: "DEU" | "FRA" = "DEU") {
  const { runner } = await wwRunnerCapture({}, [
    { clientID: HUMAN, country: "DEU" },
  ]);
  step(runner, 2);
  return grab(runner, tag);
}

function grab(
  runner: Awaited<ReturnType<typeof wwRunnerCapture>>["runner"],
  tag: "DEU" | "FRA" = "DEU",
) {
  const g = runner.game;
  const l = land(g);
  const id = byTag(g, tag).smallID();
  const cl = l.country(id)!;
  const ce = l.econ.country(id)!;
  return { runner, g, l, id, cl, ce };
}

/** Template `t`'s battalions after `edit`. */
const saveOf = (
  l: WwLand,
  id: number,
  template: number,
  edit: (b: BattalionId[]) => BattalionId[],
): LandOrder => {
  const tpl = l.country(id)!.template(template)!;
  return {
    kind: "template_save",
    template,
    base: 0,
    name: "Mine",
    battalions: edit([...tpl.def.battalions]),
    support: [...tpl.def.support],
  };
};

const divisionsOf = (l: WwLand, id: number, template: number) =>
  l.rowsOf(id).filter((r) => l.divisions.template[r] === template);

/** Men and equipment in total: pool, stock and every division. */
function totals(l: WwLand, id: number) {
  const ce = l.econ.country(id)!;
  const t = l.divisions;
  let men = ce.manpower;
  const eq = new Array<number>(GROUND_SLOTS).fill(0);
  for (const r of l.rowsOf(id)) {
    men += t.men[r];
    const e = t.equipOf(r);
    for (let j = 0; j < GROUND_SLOTS; j++) eq[j] += e[j];
  }
  for (let j = 0; j < GROUND_SLOTS; j++)
    eq[j] += ce.stock[GROUND_EQUIP_KEYS[j]];
  return { men, eq };
}

describe("startReformCount (pure rule)", () => {
  test("floor of the budget, cut to the stock, capped at 2x, at least one", () => {
    expect(startReformCount(1000, 10, 100, Infinity)).toBe(10);
    expect(startReformCount(1000, 10, 150, Infinity)).toBe(6);
    expect(startReformCount(1000, 10, 10, Infinity)).toBe(20);
    expect(startReformCount(1000, 10, 100, 7)).toBe(7);
    expect(startReformCount(100, 10, 400, Infinity)).toBe(1);
    expect(startReformCount(1000, 10, 100, 0)).toBe(0);
  });
  test("apportion is exact and deterministic", () => {
    expect(apportion(7, [3, 3, 3])).toEqual([3, 2, 2]);
    expect(apportion(5, [24, 21])).toEqual([3, 2]);
    expect(apportion(4, [0, 1])).toEqual([0, 4]);
  });
});

describe("start division re-forming (preparation)", () => {
  test("smaller template: more divisions, full strength, men conserved", async () => {
    const { l, id, ce } = await prepGame();
    const before = divisionsOf(l, id, INFANTRY).length;
    const men0 = l.templateStatsOf(id, INFANTRY)!.men;
    const tot = totals(l, id);
    ce.stock.fill(ce.stock.length > 0 ? 1e6 : 0); // plenty of equipment
    const tot2 = totals(l, id);
    expect(tot2.men).toBe(tot.men);
    expect(
      l.issue(
        id,
        saveOf(l, id, INFANTRY, (b) => b.slice(0, b.length - 3)),
      ),
    ).toBeNull();
    const men1 = l.templateStatsOf(id, INFANTRY)!.men;
    expect(men1).toBeLessThan(men0);
    const rows = divisionsOf(l, id, INFANTRY);
    expect(rows.length).toBe(
      Math.min(Math.floor((before * men0) / men1), 2 * before),
    );
    expect(rows.length).toBeGreaterThan(before);
    for (const r of rows) expect(l.divisions.men[r]).toBe(men1);
    expect(totals(l, id).men).toBe(tot2.men);
    expect(totals(l, id).eq).toEqual(tot2.eq);
  });

  test("larger template: fewer divisions, the rest of the men back in the pool", async () => {
    const { l, id, ce } = await prepGame();
    const before = divisionsOf(l, id, INFANTRY).length;
    const men0 = l.templateStatsOf(id, INFANTRY)!.men;
    const pool = ce.manpower;
    ce.stock.fill(1e6);
    const tot = totals(l, id);
    expect(
      l.issue(
        id,
        saveOf(l, id, INFANTRY, (b) => [...b, ...b.slice(0, 4)]),
      ),
    ).toBeNull();
    const men1 = l.templateStatsOf(id, INFANTRY)!.men;
    const rows = divisionsOf(l, id, INFANTRY);
    expect(rows.length).toBe(Math.floor((before * men0) / men1));
    expect(rows.length).toBeLessThan(before);
    expect(ce.manpower).toBe(pool + before * men0 - rows.length * men1);
    expect(totals(l, id).men).toBe(tot.men);
    expect(totals(l, id).eq).toEqual(tot.eq);
  });

  test("2x cap, and armies over the cap get a sibling in the same region", async () => {
    const { l, id, ce, cl } = await prepGame();
    const before = divisionsOf(l, id, INFANTRY).length;
    const armies0 = l.armiesOf(id).map((a) => a.id);
    const regionOf = new Map(
      armies0.map((a) => [
        a,
        l.divisions.region[
          l.rowsOf(id).find((r) => l.divisions.army[r] === a)!
        ],
      ]),
    );
    // A plan on the first army must stay.
    const first = l.armies.get(armies0[0])!;
    first.order = { ...idleOrder(), kind: "plan", targets: [3], enemy: 1 };
    ce.stock.fill(1e6);
    ce.manpower = 50_000_000;
    expect(
      l.issue(
        id,
        saveOf(l, id, INFANTRY, (b) => b.slice(0, 3)),
      ),
    ).toBeNull();
    const rows = divisionsOf(l, id, INFANTRY);
    expect(rows.length).toBe(2 * before);
    const armies = l.armiesOf(id);
    for (const a of armies) {
      expect(a.divisions.length).toBeLessThanOrEqual(WW_MAX_ARMY_DIVISIONS);
    }
    expect(armies.length).toBeGreaterThan(armies0.length);
    expect(l.armies.get(armies0[0])!.order.kind).toBe("plan");
    const siblings = armies.filter((a) => !armies0.includes(a.id));
    expect(siblings.some((a) => a.order.kind === "plan")).toBe(true);
    for (const a of armies) {
      const r = l.rowsOf(id).find((x) => l.divisions.army[x] === a.id)!;
      expect(a.general).not.toBe(0);
      if (armies0.includes(a.id)) {
        expect(l.divisions.region[r]).toBe(regionOf.get(a.id));
      }
    }
    expect(cl.startReform).toHaveLength(1);
  });

  test("the stock caps the count at what it can fill to full strength", async () => {
    const { l, id, ce } = await prepGame();
    const before = divisionsOf(l, id, INFANTRY).length;
    ce.stock.fill(0);
    // Give back exactly what the old divisions hold: nothing more in stock.
    const tot = totals(l, id);
    expect(
      l.issue(
        id,
        saveOf(l, id, INFANTRY, (b) => b.slice(0, b.length - 3)),
      ),
    ).toBeNull();
    const rows = divisionsOf(l, id, INFANTRY);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(2 * before);
    // Every division is full in equipment: no more than the stock allowed.
    const s = l.templateStatsOf(id, INFANTRY)!;
    for (const r of rows) {
      expect(l.baseStatsOf(r).men).toBe(s.men);
      expect(l.divisions.men[r]).toBe(s.men);
    }
    expect(totals(l, id).men).toBe(tot.men);
    expect(totals(l, id).eq).toEqual(tot.eq);
  });

  test("a second save does not lose men to rounding", async () => {
    const a = await prepGame();
    const b = await prepGame();
    a.ce.stock.fill(1e6);
    b.ce.stock.fill(1e6);
    const orig = [...a.cl.template(INFANTRY)!.def.battalions];
    const odd = () => orig.slice(0, orig.length - 3);
    expect(a.l.issue(a.id, saveOf(a.l, a.id, INFANTRY, odd))).toBeNull();
    // b goes through another size first, then the same edit.
    expect(
      b.l.issue(
        b.id,
        saveOf(b.l, b.id, INFANTRY, (x) => [...x, ...x.slice(0, 2)]),
      ),
    ).toBeNull();
    expect(b.l.issue(b.id, saveOf(b.l, b.id, INFANTRY, odd))).toBeNull();
    expect(divisionsOf(b.l, b.id, INFANTRY).length).toBe(
      divisionsOf(a.l, a.id, INFANTRY).length,
    );
  });

  test("a snapshot mid-preparation keeps the budget; the restore agrees", async () => {
    const a = await prepGame();
    a.ce.stock.fill(1e6);
    expect(
      a.l.issue(
        a.id,
        saveOf(a.l, a.id, INFANTRY, (b) => b.slice(0, b.length - 3)),
      ),
    ).toBeNull();
    const snap = a.l.snapshot();
    expect(
      snap.countries.find((c) => c.smallID === a.id)!.startReform,
    ).toHaveLength(1);
    const r2 = await wwRestore(a.runner, [{ clientID: HUMAN, country: "DEU" }]);
    const b = grab(r2);
    expect(gameHash(r2)).toBe(gameHash(a.runner));
    expect(b.cl.startReform).toEqual(a.cl.startReform);
    // The same next save gives the same result on both.
    const next = (x: BattalionId[]) => [...x, ...x.slice(0, 2)];
    expect(a.l.issue(a.id, saveOf(a.l, a.id, INFANTRY, next))).toBeNull();
    expect(b.l.issue(b.id, saveOf(b.l, b.id, INFANTRY, next))).toBeNull();
    expect(gameHash(r2)).toBe(gameHash(a.runner));
  });

  test("a country that did not re-form leaves the snapshot field out", async () => {
    const a = await prepGame();
    for (const c of a.l.snapshot().countries) {
      expect(c.startReform).toBeUndefined();
    }
  });

  test("an AI country never re-forms", async () => {
    const a = await prepGame("FRA");
    const before = divisionsOf(a.l, a.id, INFANTRY).length;
    a.l.issue(
      a.id,
      saveOf(a.l, a.id, INFANTRY, (b) => b.slice(0, b.length - 3)),
    );
    // (The human check fails: the old refit rule only.)
    expect(a.cl.startReform).toHaveLength(0);
    expect(divisionsOf(a.l, a.id, INFANTRY).length).toBe(before);
  });

  test("a new template and a template no division uses are not re-formed", async () => {
    const a = await prepGame();
    const n0 = a.l.armiesOf(a.id).length;
    // Template 4 (cavalry): no division uses it in the generic start.
    expect(divisionsOf(a.l, a.id, 4)).toHaveLength(0);
    expect(
      a.l.issue(
        a.id,
        saveOf(a.l, a.id, 4, (b) => b.slice(0, 2)),
      ),
    ).toBeNull();
    expect(a.cl.startReform).toHaveLength(0);
    const fresh = saveOf(a.l, a.id, INFANTRY, (b) => b);
    expect(
      a.l.issue(a.id, { ...(fresh as object), template: 0 } as LandOrder),
    ).toBeNull();
    expect(a.cl.startReform).toHaveLength(0);
    expect(a.l.armiesOf(a.id)).toHaveLength(n0);
  });

  test("after preparation the budget is gone and the old refit rule applies", async () => {
    const a = await prepGame();
    a.ce.stock.fill(1e6);
    expect(
      a.l.issue(
        a.id,
        saveOf(a.l, a.id, INFANTRY, (b) => b.slice(0, b.length - 3)),
      ),
    ).toBeNull();
    stepTo(a.runner, WW_PREP_TICKS + 2);
    expect(a.cl.startReform).toHaveLength(0);
    const count = divisionsOf(a.l, a.id, INFANTRY).length;
    const pool = a.ce.manpower;
    expect(
      a.l.issue(
        a.id,
        saveOf(a.l, a.id, INFANTRY, (b) => b.slice(0, 3)),
      ),
    ).toBeNull();
    // The same divisions, men above the new need back in the pool.
    expect(divisionsOf(a.l, a.id, INFANTRY)).toHaveLength(count);
    expect(a.ce.manpower).toBeGreaterThan(pool);
  });
});

describe("the preview's stock model against the engine", () => {
  const edits: [string, (b: BattalionId[]) => BattalionId[]][] = [
    ["smaller", (b) => b.slice(0, b.length - 3)],
    ["bigger", (b) => [...b, "infantry", "infantry"]],
    [
      "gunnery",
      (b) => [...b.slice(0, 6), ...new Array<BattalionId>(6).fill("artillery")],
    ],
    [
      "heavy on guns",
      (b) => [...b.slice(0, 9), ...new Array<BattalionId>(6).fill("artillery")],
    ],
  ];

  test.each(edits)(
    "%s: the same count, and the stock left agrees",
    async (_n, edit) => {
      const { l, id, ce, cl } = await prepGame();
      const rows = divisionsOf(l, id, INFANTRY);
      const count = rows.length;
      // The stock the start had: what is left plus what the divisions hold.
      const init = Array.from(ce.stock);
      for (const r of l.rowsOf(id)) {
        const e = l.divisions.equipOf(r);
        for (let j = 0; j < GROUND_SLOTS; j++)
          init[GROUND_EQUIP_KEYS[j]] += e[j];
      }
      const old = l.templateStatsOf(id, INFANTRY)!;
      const field = rows.map(() => ({ key: "i", need: old.need }));
      // The start's own draw: what is left agrees with the model.
      expect(
        startHoldings(groupStockOf(init), field).left.map((x) => x),
      ).toEqual(groupStockOf(ce.stock));
      const order = saveOf(l, id, INFANTRY, edit);
      expect(l.issue(id, order)).toBeNull();
      const now = l.templateStatsOf(id, INFANTRY)!;
      const [p] = previewReforms(groupStockOf(init), field, [
        {
          key: "i",
          need: now.need,
          men: now.men,
          originalCount: count,
          budget: count * old.men,
        },
      ]);
      const actual = divisionsOf(l, id, INFANTRY).length;
      expect(p.count).toBe(actual);
      void cl;
    },
  );

  test("a thin stock cuts the count, and the model names the equipment", async () => {
    const { l, id, ce } = await prepGame();
    const rows = divisionsOf(l, id, INFANTRY);
    const art = equipKey("artillery", 1);
    ce.stock[art] = 2; // the divisions keep what they hold; the pool is thin
    const init = Array.from(ce.stock);
    for (const r of l.rowsOf(id)) {
      const e = l.divisions.equipOf(r);
      for (let j = 0; j < GROUND_SLOTS; j++) init[GROUND_EQUIP_KEYS[j]] += e[j];
    }
    const old = l.templateStatsOf(id, INFANTRY)!;
    const order = saveOf(l, id, INFANTRY, (b) => [
      ...b.slice(0, 9),
      ...new Array<BattalionId>(6).fill("artillery"),
    ]);
    expect(l.issue(id, order)).toBeNull();
    const now = l.templateStatsOf(id, INFANTRY)!;
    const [p] = previewReforms(
      groupStockOf(init),
      rows.map(() => ({ key: "i", need: old.need })),
      [
        {
          key: "i",
          need: now.need,
          men: now.men,
          originalCount: rows.length,
          budget: rows.length * old.men,
        },
      ],
    );
    expect(divisionsOf(l, id, INFANTRY).length).toBe(p.count);
    expect(NEED_GROUPS[p.limitedBy]).toBe("artillery");
  });

  test("a shortage names the group that cut the count", () => {
    const need = new Array<number>(groupStockOf([]).length).fill(0);
    need[0] = 10;
    need[2] = 10;
    const [r] = previewReforms(
      [
        1000, 0, 55, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ].slice(0, need.length),
      [],
      [{ key: "a", need, men: 1, originalCount: 100, budget: 100 }],
    );
    expect(r.count).toBe(5);
    expect(r.limitedBy).toBe(2);
  });
});
