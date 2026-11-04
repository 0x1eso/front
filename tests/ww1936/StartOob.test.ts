// World War 1936: start_oob, a major's whole start army planned in the
// lobby. The real world1936 map (the test maps have no historical order of
// battle), Germany or Italy as the human.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  BattalionId,
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  WW_MAX_TEMPLATES,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { START_OOB } from "@openfront/engine-lib/ww1936/LandStart";
import { planStartOob } from "@openfront/engine-lib/ww1936/StartOob";
import { groupStockOf } from "@openfront/engine-lib/ww1936/StartReform";
import {
  createGameRunner,
  createGameRunnerFromSnapshot,
  type GameRunner,
} from "@openfront/engine/GameRunner";
import type { WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  gameHash,
  HUMAN,
  land,
  step,
  stepTo,
  wwGameStart,
} from "./util";

const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../resources/maps",
  ),
);
const files = () =>
  loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal);

async function game(tag: CountryTag = "DEU") {
  const runner = await createGameRunner(
    wwGameStart({}, [{ clientID: HUMAN, country: tag }]),
    undefined,
    await files(),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  step(runner, 2);
  const l = land(runner.game);
  const id = byTag(runner.game, tag).smallID();
  return { runner, l, id, cl: l.country(id)!, ce: l.econ.country(id)!, tag };
}
type G = Awaited<ReturnType<typeof game>>;
type Oob = Extract<LandOrder, { kind: "start_oob" }>;
type Extra = {
  name: string;
  battalions: BattalionId[];
  support: never[];
};

/** Every start template as it is, plus `extra` new ones; armies as [template key or "new<n>", count]. */
function planOf(
  g: G,
  armies: readonly (readonly [string, number][])[],
  extra: Extra[] = [],
  edits: Record<string, BattalionId[]> = {},
): Oob {
  const base = g.cl.templates.map((t) => ({
    key: t.key,
    name: edits[t.key] === undefined ? "" : "Mine",
    battalions: edits[t.key] ?? [...t.def.battalions],
    support: [...t.def.support],
  }));
  const templates = [...base, ...extra];
  const index = (k: string) =>
    k.startsWith("new")
      ? base.length + Number(k.slice(3))
      : base.findIndex((t) => t.key === k);
  return {
    kind: "start_oob",
    templates,
    armies: armies.map((a) =>
      a.map(([k, count]) => ({ template: index(k), count })),
    ),
  } as Oob;
}

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

/** The divisions standing in the army the start numbered `n` (1-based), by template key. */
function armyCounts(g: G, n: number): Map<string, number> | null {
  const a = g.l.armiesOf(g.id).find((x) => x.nameNo === n);
  if (a === undefined) return null;
  const out = new Map<string, number>();
  for (const d of a.divisions) {
    const r = g.l.divisions.rowOf(d);
    const key = g.cl.template(g.l.divisions.template[r])!.key || "(own)";
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}
const startMen = (g: G) =>
  g.l.rowsOf(g.id).reduce((n, r) => n + g.l.divisions.men[r], 0);
const inf = (g: G) => g.cl.templates[0].def;

describe("start_oob (Germany, real map)", () => {
  test("counts and armies as planned; an army left empty goes; the rest stays", async () => {
    const g = await game();
    g.ce.stock.fill(1e6);
    const armies0 = g.l.armiesOf(g.id).map((a) => ({
      no: a.nameNo,
      general: a.general,
      region: g.l.divisions.region[g.l.divisions.rowOf(a.divisions[0])],
    }));
    expect(armies0).toHaveLength(START_OOB.DEU!.length);
    const tot = totals(g.l, g.id);
    const extra: Extra = {
      name: "Mine",
      battalions: [...inf(g).battalions.slice(0, 6)],
      support: [],
    };
    const o = planOf(
      g,
      [
        [
          ["infantry", 3],
          ["new0", 2],
        ],
        [],
        [["infantry", 5]],
      ],
      [extra],
    );
    expect(g.l.issue(g.id, o)).toBeNull();
    expect(armyCounts(g, 1)).toEqual(
      new Map([
        ["infantry", 3],
        ["(own)", 2],
      ]),
    );
    expect(armyCounts(g, 2)).toBeNull();
    expect(armyCounts(g, 3)).toEqual(new Map([["infantry", 5]]));
    // Regions and commanders stay.
    for (const a of armies0.filter((x) => x.no !== 2)) {
      const now = g.l.armiesOf(g.id).find((x) => x.nameNo === a.no)!;
      expect(now.general).toBe(a.general);
      expect(g.l.divisions.region[g.l.divisions.rowOf(now.divisions[0])]).toBe(
        a.region,
      );
    }
    // Men and equipment are conserved.
    expect(totals(g.l, g.id)).toEqual(tot);
    expect(g.cl.startOob).toBe(true);
    // Once only.
    expect(g.l.issue(g.id, o)).not.toBeNull();
  }, 120_000);

  test("the men budget cuts the count, with no 2x cap; the 24 limit holds", async () => {
    const g = await game();
    g.ce.stock.fill(1e6);
    const budget = startMen(g);
    const small = ["infantry" as BattalionId, "infantry" as BattalionId];
    const extra: Extra = { name: "Tiny", battalions: small, support: [] };
    const o = planOf(
      g,
      [[["new0", 24]], [["new0", 24]], [["new0", 24]]],
      [extra],
    );
    expect(g.l.issue(g.id, o)).toBeNull();
    const rows = g.l.rowsOf(g.id);
    expect(rows.length).toBe(72);
    for (const a of g.l.armiesOf(g.id)) expect(a.divisions.length).toBe(24);
    expect(startMen(g)).toBeLessThanOrEqual(budget);
    // A budget cut: big divisions, so the men run out before the asked count.
    const h = await game();
    h.ce.stock.fill(1e6);
    const big = [
      ...inf(h).battalions,
      ...new Array<BattalionId>(4).fill("infantry"),
    ];
    const o2 = planOf(
      h,
      [[["new0", 24]], [["new0", 24]], [["new0", 24]]],
      [{ name: "Big", battalions: big, support: [] }],
    );
    const budgetH = startMen(h);
    expect(h.l.issue(h.id, o2)).toBeNull();
    const men = h.l.templateStatsOf(
      h.id,
      h.cl.templates[h.cl.templates.length - 1].id,
    )!.men;
    const n = h.l.rowsOf(h.id).length;
    expect(n).toBe(Math.min(72, Math.floor(budgetH / men)));
    expect(n * men).toBeLessThanOrEqual(budgetH);
    expect(h.ce.manpower).toBeGreaterThan(0);
  }, 120_000);

  test("equipment cuts the count: full-strength divisions only, the rest back in stock", async () => {
    const g = await game();
    g.ce.stock.fill(0);
    const heavy = [
      ...inf(g).battalions,
      ...new Array<BattalionId>(3).fill("artillery"),
    ];
    const before = groupStockOf(g.ce.stock);
    const tot = totals(g.l, g.id);
    const o = planOf(
      g,
      [[["new0", 24]], [["new0", 24]], [["new0", 24]]],
      [{ name: "Heavy", battalions: heavy, support: [] }],
    );
    expect(g.l.issue(g.id, o)).toBeNull();
    const tpl = g.cl.templates[g.cl.templates.length - 1];
    const s = g.l.templateStatsOf(g.id, tpl.id)!;
    const rows = g.l
      .rowsOf(g.id)
      .filter((r) => g.l.divisions.template[r] === tpl.id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(72);
    // Every division is full: it holds its template's whole need.
    for (const r of rows) {
      expect(g.l.divisions.men[r]).toBe(s.men);
      expect(g.l.strengthOf(r)).toBeGreaterThanOrEqual(1000);
    }
    // The stock, with what the start held, decided: nothing more fits.
    const after = groupStockOf(g.ce.stock);
    expect(after.some((x, k) => s.need[k] > 0 && x < s.need[k])).toBe(true);
    expect(before.length).toBe(after.length);
    expect(totals(g.l, g.id)).toEqual(tot);
  }, 120_000);

  test("refused whole, changing nothing: too many per army, template limit, bad index, no such key", async () => {
    const g = await game();
    g.ce.stock.fill(1e6);
    const h0 = gameHash(g.runner);
    const tot = totals(g.l, g.id);
    const rows0 = g.l.rowsOf(g.id).length;
    const two = planOf(g, [
      [
        ["infantry", 20],
        ["infantry", 10],
      ],
      [],
      [],
    ]);
    expect(g.l.issue(g.id, two)).not.toBeNull();
    const b = inf(g).battalions.slice(0, 3);
    const many = planOf(
      g,
      [[["infantry", 1]], [], []],
      Array.from({ length: WW_MAX_TEMPLATES }, (_, i) => ({
        name: `N${i}`,
        battalions: [...b],
        support: [] as never[],
      })),
    );
    expect(g.l.issue(g.id, many)).not.toBeNull();
    const bad = planOf(g, [[["infantry", 1]], [], []]);
    bad.armies[0][0].template = 99;
    expect(g.l.issue(g.id, bad)).not.toBeNull();
    const wrongCount = planOf(g, [[["infantry", 1]], []]);
    expect(g.l.issue(g.id, wrongCount)).not.toBeNull();
    const ghost = planOf(g, [[["infantry", 1]], [], []]);
    ghost.templates[0] = { ...ghost.templates[0], key: "no_such_key" };
    expect(g.l.issue(g.id, ghost)).not.toBeNull();
    expect(gameHash(g.runner)).toBe(h0);
    expect(totals(g.l, g.id)).toEqual(tot);
    expect(g.l.rowsOf(g.id).length).toBe(rows0);
    expect(g.cl.startOob).toBe(false);
  }, 120_000);

  test("an AI country, a minor, and after preparation are refused; so is a second order", async () => {
    const g = await game();
    const fra = byTag(g.runner.game, "FRA").smallID();
    const fl = g.l.country(fra)!;
    const fo = {
      kind: "start_oob",
      templates: [],
      armies: START_OOB.FRA!.map(() => []),
    } as unknown as Oob;
    expect(g.l.issue(fra, fo)).not.toBeNull();
    expect(fl.startOob).toBe(false);
    const ok = planOf(g, [[["infantry", 2]], [], []]);
    stepTo(g.runner, WW_PREP_TICKS + 2);
    const rows = g.l.rowsOf(g.id).length;
    expect(g.l.issue(g.id, ok)).not.toBeNull();
    expect(g.l.rowsOf(g.id).length).toBe(rows);
    const m = await game("POL");
    expect(m.l.issue(m.id, { ...ok, armies: [] })).not.toBeNull();
    expect(m.cl.startOob).toBe(false);
  }, 180_000);

  test("snapshot and restore keep the flag; the hash agrees; unused, the field is absent", async () => {
    const g = await game();
    g.ce.stock.fill(1e6);
    for (const c of g.l.snapshot().countries) {
      expect(c.startOob).toBeUndefined();
    }
    const o = planOf(g, [[["infantry", 4]], [["infantry", 4]], []]);
    expect(g.l.issue(g.id, o)).toBeNull();
    expect(
      g.l.snapshot().countries.find((c) => c.smallID === g.id)!.startOob,
    ).toBe(true);
    const r2: GameRunner = await createGameRunnerFromSnapshot(
      wwGameStart({}, [{ clientID: HUMAN, country: "DEU" }]),
      g.runner.snapshot(),
      undefined,
      await files(),
      () => {},
    );
    expect(gameHash(r2)).toBe(gameHash(g.runner));
    const l2 = land(r2.game);
    expect(l2.country(g.id)!.startOob).toBe(true);
    expect(l2.issue(g.id, o)).not.toBeNull();
  }, 180_000);
});

describe("start_oob (Italy: the Ethiopian armies must be staffed)", () => {
  const ITA_ARMIES = 5;
  const empty = () => Array.from({ length: ITA_ARMIES }, () => []);

  test("an empty operation army is refused; they fill first when the stock is short; the war goes on", async () => {
    const g = await game("ITA");
    g.ce.stock.fill(1e6);
    const needsOne = (n: number) =>
      planOf(
        g,
        empty().map((_, i) =>
          i === n ? ([["binary", 3]] as [string, number][]) : [],
        ),
      );
    // Operation armies are army 1 and 2: both must hold a division.
    const tot = totals(g.l, g.id);
    expect(g.l.issue(g.id, needsOne(0))).not.toBeNull();
    expect(g.l.issue(g.id, needsOne(3))).not.toBeNull();
    expect(totals(g.l, g.id)).toEqual(tot);
    expect(g.cl.startOob).toBe(false);

    // Short stock: the units asked for in the later armies cannot all be made.
    const heavy = [
      ...inf(g).battalions,
      ...new Array<BattalionId>(6).fill("artillery"),
    ];
    const o = planOf(
      g,
      [[["new0", 1]], [["new0", 1]], [], [["new0", 24]], [["new0", 24]]],
      [{ name: "Heavy", battalions: heavy, support: [] }],
    );
    // Only a handful can be made from the stock.
    g.ce.stock.fill(0);
    const rowsBefore = g.l.rowsOf(g.id).length;
    expect(rowsBefore).toBeGreaterThan(0);
    expect(g.l.issue(g.id, o)).toBeNull();
    const a1 = g.l.armiesOf(g.id).find((a) => a.nameNo === 1)!;
    const a2 = g.l.armiesOf(g.id).find((a) => a.nameNo === 2)!;
    expect(a1.divisions.length).toBe(1);
    expect(a2.divisions.length).toBe(1);
    // They keep their region and their operation.
    expect(a1.order.kind).toBe("plan");
    expect(a2.order.kind).toBe("plan");
    const rest = g.l
      .armiesOf(g.id)
      .filter((a) => a.nameNo > 2)
      .reduce((n, a) => n + a.divisions.length, 0);
    expect(rest + 2).toBeLessThan(49);
  }, 180_000);
});

describe("planStartOob (the pure rule)", () => {
  const tpl = [{ men: 100, need: [10, 0] }];
  it("fills operation armies first, then the rest in order; equipment cuts to full strength", () => {
    const r = planStartOob(1e9, Infinity, [35, 0], tpl, [
      { required: false, items: [{ template: 0, count: 3 }] },
      { required: true, items: [{ template: 0, count: 2 }] },
    ]);
    // 3 divisions' worth of equipment: the operation army has 2, the other gets 1.
    expect(r.armies.map((a) => a.total)).toEqual([1, 2]);
    expect(r.armies[0].items[0]).toMatchObject({ cut: "equip", group: 0 });
    expect(r.limitedGroup).toBe(0);
    expect(r.equipUsed[0]).toBe(30);
    expect(r.menUsed).toBe(300);
  });
  it("cuts by men and by the 24 per army; an empty operation army is reported", () => {
    const m = planStartOob(250, Infinity, [1e6, 0], tpl, [
      { required: false, items: [{ template: 0, count: 24 }] },
    ]);
    expect(m.total).toBe(2);
    expect(m.armies[0].items[0].cut).toBe("men");
    const c = planStartOob(1e9, Infinity, [1e6, 0], tpl, [
      {
        required: true,
        items: [
          { template: 0, count: 24 },
          { template: 0, count: 24 },
        ],
      },
      { required: true, items: [] },
    ]);
    expect(c.armies[0].total).toBe(24);
    expect(c.armies[0].items[1].cut).toBe("cap");
    expect(c.emptyRequired).toEqual([1]);
  });
});

describe("start_oob keeps the country's own start templates (Soviet Union)", () => {
  test("untouched mountain rifles are not refused for the missing mountaineers; a new one still is", async () => {
    const g = await game("SUN");
    g.ce.stock.fill(1e6);
    const mr = g.cl.templates.find((t) => t.key === "mountain_rifle")!;
    expect(mr.def.battalions).toContain("mountain");
    expect(g.ce.researched.has("mountaineers")).toBe(false);
    const n = START_OOB.SUN!.length;
    const armies = Array.from(
      { length: n },
      (_, i) =>
        (i === 0 ? [["mountain_rifle", 2]] : [["rifle", 2]]) as [
          string,
          number,
        ][],
    );
    // A new template with the same parts is a real no_tech.
    const bad = planOf(g, armies, [
      { name: "Own", battalions: [...mr.def.battalions], support: [] },
    ]);
    const asNew = {
      ...bad,
      armies: [
        [{ template: bad.templates.length - 1, count: 1 }],
        ...bad.armies.slice(1),
      ],
    } as Oob;
    expect(g.l.issue(g.id, asNew)).toBe("no_tech");
    expect(g.cl.startOob).toBe(false);
    // The untouched default, every template as the country has it.
    expect(g.l.issue(g.id, planOf(g, armies))).toBeNull();
    expect(g.cl.startOob).toBe(true);
    expect(armyCounts(g, 1)?.get("mountain_rifle")).toBe(2);
  }, 120_000);

  test("every major's own start templates pass the plan check as they are", async () => {
    for (const tag of Object.keys(START_OOB) as CountryTag[]) {
      const g = await game(tag);
      g.ce.stock.fill(1e6);
      const armies = START_OOB[tag]!.map(
        () => [[g.cl.templates[0].key, 1]] as [string, number][],
      );
      expect(g.l.issue(g.id, planOf(g, armies)), tag).toBeNull();
    }
  }, 300_000);
});
