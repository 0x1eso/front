// World War 1936: divisions_convert. Divisions move to another template at
// once and then follow it exactly as an edited template's divisions do
// (Training.refitDivision): surplus men and equipment go back, org is cut,
// the rest comes by reinforcement. Same setup as ArmyTrain.test.ts.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_EQUIP_KEYS } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { dailySustain } from "@openfront/engine/ww1936/land/Sustain";
import {
  byTag,
  clearLand,
  clearStartSetup,
  gameHash,
  HUMAN,
  land,
  placeArmy,
  stepTo,
  wwRestore,
  wwRunnerCapture,
} from "./util";

const SUMMER = dayOfDate("1936-06-15");
const BERLIN = 3;
const INFANTRY = 1; // DEU's templates: infantry, armored, mountain, cavalry
const ARMORED = 2;
const MOUNTAIN = 3;
const CAVALRY = 4;

async function germany() {
  const { runner } = await wwRunnerCapture({}, [
    { clientID: HUMAN, country: "DEU" },
  ]);
  const g = runner.game;
  stepTo(runner, WW_PREP_TICKS + 1);
  const l = land(g);
  const id = byTag(g, "DEU").smallID();
  const cl = l.country(id)!;
  const ce = l.econ.country(id)!;
  clearStartSetup(l.econ, ce);
  clearLand(g);
  let day = SUMMER;
  ce.manpower = 500_000;
  for (const type of [
    "infantry_equipment",
    "artillery",
    "support_equipment",
    "light_tank",
    "medium_tank",
    "motorized",
    "anti_tank",
  ] as const) {
    for (let k = 1; k <= EQUIPMENT_GENS[type]; k++) {
      ce.stock[equipKey(type, k)] = 0;
    }
    ce.stock[equipKey(type, 1)] = 50_000;
  }
  return {
    runner,
    g,
    l,
    id,
    cl,
    ce,
    issue: (o: LandOrder) => l.issue(id, o),
    nextDay: (n = 1) => {
      for (let i = 0; i < n; i++) dailySustain(l, id, day++);
    },
  };
}

const convert = (to: number, from?: number, army?: number) =>
  ({
    kind: "divisions_convert",
    to,
    ...(from === undefined ? {} : { from }),
    ...(army === undefined ? {} : { army }),
  }) as const;

type Germany = Awaited<ReturnType<typeof germany>>;

/** Men (field + pool) and every ground equipment (field + stock). */
function totals(w: Germany): number[] {
  const t = w.l.divisions;
  const rows = w.l.rowsOf(w.id);
  const out = [
    w.ce.manpower + rows.reduce((n, r) => n + t.men[r], 0),
    rows.length,
  ];
  GROUND_EQUIP_KEYS.forEach((k, j) => {
    out.push(w.ce.stock[k] + rows.reduce((n, r) => n + t.equipOf(r)[j], 0));
  });
  return out;
}

const templatesOf = (w: Germany, a: { divisions: number[] }) =>
  a.divisions.map((d) => w.l.divisions.template[w.l.divisions.rowOf(d)]);

describe("divisions_convert", () => {
  test("from: changes all divisions of that template and only those, conserving men and equipment", async () => {
    const w = await germany();
    const { l, g, issue } = w;
    const a = placeArmy(g, "DEU", BERLIN, 3, INFANTRY);
    const b = placeArmy(g, "DEU", BERLIN, 2, INFANTRY);
    const c = placeArmy(g, "DEU", BERLIN, 2, CAVALRY);
    const before = totals(w);
    expect(issue(convert(ARMORED, INFANTRY))).toBeNull();
    expect(templatesOf(w, a)).toEqual([ARMORED, ARMORED, ARMORED]);
    expect(templatesOf(w, b)).toEqual([ARMORED, ARMORED]);
    expect(templatesOf(w, c)).toEqual([CAVALRY, CAVALRY]);
    // Nothing lost or added; whatever left a division went back to the pool.
    expect(totals(w)).toEqual(before);
    for (const r of l.rowsOf(w.id)) {
      expect(l.divisions.org[r]).toBeLessThanOrEqual(l.orgMaxOf(r));
    }
    // A second time: nothing of that template is left.
    expect(issue(convert(ARMORED, INFANTRY))).toBe("bad_index");
  });

  test("army: converts every template of that army and no other", async () => {
    const w = await germany();
    const { l, g, issue } = w;
    const a = placeArmy(g, "DEU", BERLIN, 2, INFANTRY);
    const b = placeArmy(g, "DEU", BERLIN, 2, INFANTRY);
    const r = l.divisions.rowOf(b.divisions[1]);
    l.setTemplate(r, CAVALRY);
    expect(templatesOf(w, b)).toEqual([INFANTRY, CAVALRY]);
    expect(issue(convert(ARMORED, undefined, b.id))).toBeNull();
    expect(templatesOf(w, b)).toEqual([ARMORED, ARMORED]);
    expect(templatesOf(w, a)).toEqual([INFANTRY, INFANTRY]);
    // Already on the target: nothing to convert.
    expect(issue(convert(ARMORED, undefined, b.id))).toBe("bad_index");
  });

  test("org is cut like a refit's, equipment comes by reinforcement, plans stay", async () => {
    const w = await germany();
    const { l, g, issue, nextDay } = w;
    const a = placeArmy(g, "DEU", BERLIN, 2, INFANTRY);
    const rows = a.divisions.map((d) => l.divisions.rowOf(d));
    for (const r of rows) l.divisions.org[r] = l.orgMaxOf(r);
    const region = rows.map((r) => l.divisions.region[r]);
    const id = a.id;
    expect(issue(convert(ARMORED, INFANTRY))).toBeNull();
    for (const r of rows) {
      const max = l.orgMaxOf(r);
      expect(l.divisions.org[r]).toBeLessThanOrEqual(max);
    }
    // The tank slots start empty and fill by the reinforcement pace.
    const tanks = (r: number) =>
      [...l.divisions.equipOf(r)].reduce((n, x) => n + x, 0);
    const held = rows.map(tanks);
    nextDay(3);
    expect(rows.map(tanks).some((n, i) => n > held[i])).toBe(true);
    expect(l.armies.get(id)!.divisions).toEqual(a.divisions);
    expect(rows.map((r) => l.divisions.region[r])).toEqual(region);
  });

  test("refused orders change nothing", async () => {
    const w = await germany();
    const { g, cl, issue, runner } = w;
    const a = placeArmy(g, "DEU", BERLIN, 2, INFANTRY);
    const polArmy = placeArmy(g, "POL", BERLIN, 1, 1);
    const h = gameHash(runner);
    const tot = totals(w);
    expect(issue(convert(INFANTRY, INFANTRY))).toBe("bad_template");
    expect(issue(convert(99, INFANTRY))).toBe("bad_template");
    expect(issue(convert(ARMORED, 99))).toBe("bad_template");
    // Both or neither of from and army.
    expect(issue(convert(ARMORED))).toBe("bad_index");
    expect(issue(convert(ARMORED, INFANTRY, a.id))).toBe("bad_index");
    expect(issue(convert(ARMORED, undefined, polArmy.id))).toBe("no_army");
    expect(issue(convert(ARMORED, undefined, 9_999))).toBe("no_army");
    // A target needing a part the country lacks.
    cl.templates.push({
      id: cl.nextTemplateId++,
      key: "",
      def: { name: "X", battalions: ["paratrooper"], support: [] },
    } as never);
    const bad = cl.nextTemplateId - 1;
    expect(issue(convert(bad, INFANTRY))).toBe("no_tech");
    cl.templates.pop();
    cl.nextTemplateId--;
    expect(templatesOf(w, a)).toEqual([INFANTRY, INFANTRY]);
    expect(totals(w)).toEqual(tot);
    expect(gameHash(runner)).toBe(h);
  });

  test("the special battalion cap counts every converted division", async () => {
    const w = await germany();
    const { l, g, id, issue } = w;
    placeArmy(g, "DEU", BERLIN, 5, INFANTRY);
    // Mountain divisions hold 6 special battalions each; the cap is 24.
    expect(l.templateStatsOf(id, MOUNTAIN)!.special).toBe(6);
    expect(issue(convert(MOUNTAIN, INFANTRY))).toBe("special_cap");
    expect(templatesOf(w, l.armiesOf(id)[0])).toEqual(Array(5).fill(INFANTRY));
    const d = placeArmy(g, "DEU", BERLIN, 4, INFANTRY);
    expect(issue(convert(MOUNTAIN, undefined, d.id))).toBeNull();
  });

  test("from also moves queued entries and trainees; the old template can then be deleted", async () => {
    const w = await germany();
    const { g, cl, issue, nextDay } = w;
    placeArmy(g, "DEU", BERLIN, 1, INFANTRY);
    expect(
      issue({ kind: "train", template: CAVALRY, count: 3, army: 0, region: 0 }),
    ).toBeNull();
    nextDay();
    expect(cl.trainees.length).toBeGreaterThan(0);
    expect(issue(convert(ARMORED, CAVALRY))).toBeNull();
    expect(cl.training.every((e) => e.template === ARMORED)).toBe(true);
    expect(cl.trainees.every((x) => x.template === ARMORED)).toBe(true);
    // The infantry division is untouched; the old template is unused now.
    expect(issue({ kind: "template_delete", template: CAVALRY })).toBeNull();
    expect(issue({ kind: "template_delete", template: INFANTRY })).toBe(
      "template_in_use",
    );
  });

  test("snapshot and restore after a conversion keep the digest", async () => {
    const w = await germany();
    placeArmy(w.g, "DEU", BERLIN, 3, INFANTRY);
    expect(w.issue(convert(ARMORED, INFANTRY))).toBeNull();
    w.nextDay(2);
    const before = gameHash(w.runner);
    const copy = await wwRestore(w.runner, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    expect(gameHash(copy)).toBe(before);
  });
});
