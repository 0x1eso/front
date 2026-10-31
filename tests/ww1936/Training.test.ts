// World War 1936 P2 Task 5: templates and the training queue (P2 spec
// §4.4, §5.1), and Review Focus 4: equipment never changes generation or
// appears from nowhere on its way between the stock and the divisions.
// Germany is human (no AI land war or economy), its lines and research are
// taken back, and the country's day is called directly on a summer day
// (no weather attrition), so only the training moves the numbers.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { LandOrder } from "@openfront/engine-api/Schemas";
import {
  equipKey,
  EQUIPMENT_GENS,
  EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  groundSlotOf,
  SupportId,
  WW_MAX_TEMPLATES,
  WW_MAX_TRAINING,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import type { CountryEconomy } from "@openfront/engine/ww1936/economy/WwEconomy";
import {
  dailySustain,
  disbandDivision,
} from "@openfront/engine/ww1936/land/Sustain";
import {
  byTag,
  clearLand,
  clearStartSetup,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  wwRunnerCapture,
} from "./util";

/** A summer day: no snow, frost or heat in the test map's climates. */
const SUMMER = dayOfDate("1936-06-15");
const BERLIN = 3;
const MUNICH = 4;
const INFANTRY = 1; // DEU's templates: infantry, armored, mountain, cavalry
const MOUNTAIN = 3;
const CAVALRY = 4;

async function germany(clear = true) {
  const { runner, updates } = await wwRunnerCapture({}, [
    { clientID: HUMAN, country: "DEU" },
  ]);
  const g = runner.game;
  stepTo(runner, WW_PREP_TICKS + 1);
  const l = land(g);
  const id = byTag(g, "DEU").smallID();
  const cl = l.country(id)!;
  const ce = l.econ.country(id)!;
  clearStartSetup(l.econ, ce);
  if (clear) clearLand(g);
  let day = SUMMER;
  return {
    runner,
    updates,
    g,
    l,
    id,
    cl,
    ce,
    issue: (o: LandOrder) => l.issue(id, o),
    /** The country's next day (direct call, summer). */
    nextDay: (n = 1) => {
      for (let i = 0; i < n; i++) dailySustain(l, id, day++);
    },
  };
}

const keysOf = (type: EquipmentType) =>
  Array.from({ length: EQUIPMENT_GENS[type] }, (_, i) => equipKey(type, i + 1));
const typeTotal = (xs: ArrayLike<number>, type: EquipmentType, slots = false) =>
  keysOf(type).reduce((n, k) => n + (slots ? xs[groundSlotOf(k)] : xs[k]), 0);
/** Sets a type's stock: `n` of generation 1, none of the others. */
function setStock(ce: CountryEconomy, type: EquipmentType, n: number): void {
  for (const k of keysOf(type)) ce.stock[k] = 0;
  ce.stock[equipKey(type, 1)] = n;
}

const train = (template: number, count = 1, army = 0, region = 0) =>
  ({ kind: "train", template, count, army, region }) as const;

const save = (
  template: number,
  battalions: [BattalionId, number][],
  support: SupportId[],
  name = "Mine",
  base = 0,
) =>
  ({
    kind: "template_save",
    template,
    base,
    name,
    battalions: battalions.flatMap(([b, n]) =>
      new Array<BattalionId>(n).fill(b),
    ),
    support,
  }) as const;

describe("training (P2 spec §5.1)", () => {
  test("manpower leaves at once and equipment as available", async () => {
    const { cl, ce, issue, nextDay } = await germany();
    ce.manpower = 100_000;
    setStock(ce, "infantry_equipment", 5_000);
    setStock(ce, "artillery", 10);
    setStock(ce, "support_equipment", 100);
    expect(issue(train(INFANTRY))).toBeNull();
    // The order alone takes nothing.
    expect(ce.manpower).toBe(100_000);
    expect(cl.training).toHaveLength(1);
    nextDay();
    // German infantry: 9 infantry, 2 artillery, engineers and recon.
    expect(ce.manpower).toBe(100_000 - 10_500);
    expect(typeTotal(ce.stock, "infantry_equipment")).toBe(5_000 - 900);
    expect(typeTotal(ce.stock, "artillery")).toBe(0);
    expect(typeTotal(ce.stock, "support_equipment")).toBe(100 - 35);
    expect(cl.trainees).toHaveLength(1);
    const x = cl.trainees[0];
    expect(x).toMatchObject({ men: 10_500, days: 0, template: INFANTRY });
    expect(typeTotal(x.equip, "artillery", true)).toBe(10);
    expect(cl.training[0].remaining).toBe(0);
    // A day on: the missing guns come at 10% of the need a day.
    setStock(ce, "artillery", 100);
    nextDay();
    expect(cl.trainees[0].days).toBe(1);
    expect(typeTotal(cl.trainees[0].equip, "artillery", true)).toBe(10 + 3);
  });

  test("a short entry waits and does not block the next", async () => {
    const { l, id, cl, ce, issue, nextDay } = await germany();
    ce.manpower = 5_000;
    expect(issue(train(INFANTRY))).toBeNull();
    expect(issue(train(CAVALRY))).toBeNull();
    const [big, small] = cl.training.map((e) => e.id);
    nextDay();
    // 10,500 men do not fit, 4,000 do: the cavalry starts first.
    expect(l.templateStatsOf(id, CAVALRY)!.men).toBe(4_000);
    expect(cl.trainees.map((x) => x.entry)).toEqual([small]);
    expect(cl.training.find((e) => e.id === big)!.remaining).toBe(1);
    expect(ce.manpower).toBe(1_000);
    ce.manpower += 10_000;
    nextDay();
    expect(cl.trainees.map((x) => x.entry)).toEqual([small, big]);
    expect(ce.manpower).toBe(500);
  });

  test("below 50% equipment it waits; at 90 days it deploys", async () => {
    const { runner, updates, l, id, cl, ce, issue, nextDay } = await germany();
    ce.manpower = 50_000;
    setStock(ce, "infantry_equipment", 5_000);
    setStock(ce, "support_equipment", 100);
    // No guns at all.
    setStock(ce, "artillery", 0);
    expect(issue(train(INFANTRY))).toBeNull();
    const s = l.templateStatsOf(id, INFANTRY)!;
    expect(s.trainDays).toBe(90);
    nextDay(); // starts
    nextDay(s.trainDays); // 90 days of training
    expect(cl.trainees).toHaveLength(1);
    expect(cl.trainees[0].days).toBe(90);
    expect(l.armiesOf(id)).toHaveLength(0);
    expect(l.countryDetail(cl).training[0].trainees[0]).toMatchObject({
      days: 90,
      need: 90,
    });
    // The screen says why: the guns, the lowest fill the engine deploys on,
    // though the cost-weighted bar is above half.
    const shown = l.countryDetail(cl).training[0];
    expect(shown.trainees[0].fillPm).toBeGreaterThanOrEqual(500);
    expect(shown.waiting).toBe("equipment");
    // The guns arrive: deployed the next day, at full org, experience 0.
    setStock(ce, "artillery", 24);
    nextDay();
    expect(cl.trainees).toHaveLength(0);
    expect(cl.training).toHaveLength(0);
    const [a] = l.armiesOf(id);
    expect(a.divisions).toHaveLength(1);
    const r = l.divisions.rowOf(a.divisions[0]);
    expect(l.divisions.region[r]).toBe(BERLIN);
    expect(l.divisions.men[r]).toBe(10_500);
    expect(l.divisions.org[r]).toBe(l.orgMaxOf(r));
    expect(l.divisions.exp[r]).toBe(0);
    expect(typeTotal(l.divisions.equipOf(r), "artillery", true)).toBe(24);
    expect(cl.readyToday).toBe(1);
    step(runner);
    const ready = updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_division_ready");
    expect(ready).toHaveLength(1);
    expect(ready[0].params).toEqual({ count: 1 });
  });

  test("an entry deploys into its army and region; a full army makes a new one", async () => {
    const { g, l, id, cl, ce, issue, nextDay } = await germany();
    ce.manpower = 500_000;
    // Munich, three divisions, into an army of 23 in Berlin.
    const host = placeArmy(g, "DEU", BERLIN, 23);
    setStock(ce, "infantry_equipment", 20_000);
    setStock(ce, "support_equipment", 1_000);
    setStock(ce, "artillery", 1_000);
    expect(issue(train(INFANTRY, 3, host.id, MUNICH))).toBeNull();
    nextDay(91);
    const armies = l.armiesOf(id);
    // The first fills the host to 24; the next two make one new army.
    expect(armies).toHaveLength(2);
    expect(host.divisions).toHaveLength(24);
    expect(armies[1].divisions).toHaveLength(2);
    const newest = [host.divisions[23], ...armies[1].divisions];
    for (const d of newest) {
      expect(l.divisions.region[l.divisions.rowOf(d)]).toBe(MUNICH);
    }
    // A region lost before deploying: the capital instead.
    expect(issue(train(CAVALRY, 1, 0, MUNICH))).toBeNull();
    nextDay();
    g.worldWar()!.land.setController(MUNICH, byTag(g, "FRA").smallID(), 0);
    nextDay(90);
    expect(cl.trainees).toHaveLength(0);
    const cav = l
      .armiesOf(id)
      .flatMap((a) => a.divisions)
      .map((d) => l.divisions.rowOf(d))
      .find((r) => l.divisions.template[r] === CAVALRY)!;
    expect(l.divisions.region[cav]).toBe(BERLIN);
  });

  test("deploy now gives org by progress", async () => {
    const { l, id, cl, ce, issue, nextDay } = await germany();
    ce.manpower = 50_000;
    setStock(ce, "infantry_equipment", 5_000);
    setStock(ce, "support_equipment", 100);
    setStock(ce, "artillery", 100);
    expect(issue(train(INFANTRY))).toBeNull();
    const entry = cl.training[0].id;
    nextDay(); // starts
    nextDay(45);
    expect(cl.trainees[0].days).toBe(45);
    expect(issue({ kind: "deploy_now", entry: 999 })).toBe("bad_index");
    expect(issue({ kind: "deploy_now", entry })).toBeNull();
    expect(cl.trainees).toHaveLength(0);
    expect(cl.training).toHaveLength(0);
    const [a] = l.armiesOf(id);
    const r = l.divisions.rowOf(a.divisions[0]);
    expect(l.divisions.org[r]).toBe(Math.floor((l.orgMaxOf(r) * 45) / 90));
    expect(issue({ kind: "deploy_now", entry })).toBe("bad_index");
  });

  test("cancel returns everything", async () => {
    const { cl, ce, issue, nextDay } = await germany();
    ce.manpower = 50_000;
    setStock(ce, "infantry_equipment", 5_000);
    setStock(ce, "support_equipment", 100);
    setStock(ce, "artillery", 30);
    const stock = [...ce.stock];
    expect(issue(train(INFANTRY, 3))).toBeNull();
    nextDay(5);
    expect(cl.trainees).toHaveLength(3);
    expect(ce.manpower).toBe(50_000 - 3 * 10_500);
    expect(issue({ kind: "cancel_train", entry: 99 })).toBe("bad_index");
    expect(
      issue({ kind: "cancel_train", entry: cl.training[0].id }),
    ).toBeNull();
    expect(cl.training).toHaveLength(0);
    expect(cl.trainees).toHaveLength(0);
    expect(ce.manpower).toBe(50_000);
    expect(ce.stock).toEqual(stock);
  });

  test("equipment is conserved across draw, return, upgrade and disband", async () => {
    // Review Focus 4: production stopped; Germany's 45 divisions stay.
    const { l, id, cl, ce, issue, nextDay } = await germany(false);
    ce.manpower = 100_000;
    ce.stock[equipKey("infantry_equipment", 1)] += 3_000;
    ce.stock[equipKey("artillery", 1)] += 100;
    ce.stock[equipKey("support_equipment", 1)] += 200;
    // Newer rifles: the divisions swap old ones for them.
    ce.stock[equipKey("infantry_equipment", 2)] += 2_000;
    // A division short of men and rifles: reinforcement draws both.
    const t = l.divisions;
    const first = l.armiesOf(id)[0].divisions[0];
    l.setMen(t.rowOf(first), 5_000);
    l.addEquip(
      t.rowOf(first),
      groundSlotOf(equipKey("infantry_equipment", 1)),
      -400,
    );
    const totals = () => {
      const out = [...ce.stock];
      for (let r = 0; r < t.rows; r++) {
        if (!t.alive(r) || t.owner[r] !== id) continue;
        for (let j = 0; j < GROUND_SLOTS; j++) {
          out[GROUND_EQUIP_KEYS[j]] += t.equip[r * GROUND_SLOTS + j];
        }
      }
      for (const x of cl.trainees) {
        for (let j = 0; j < GROUND_SLOTS; j++) {
          out[GROUND_EQUIP_KEYS[j]] += x.equip[j];
        }
      }
      return out;
    };
    const men = () => ce.manpower + l.fieldMen(id) + l.trainingMen(id);
    const before = totals();
    const menBefore = men();
    expect(issue(train(INFANTRY, 3))).toBeNull();
    expect(issue(train(CAVALRY, 2))).toBeNull();
    nextDay(); // draw
    expect(totals()).toEqual(before);
    nextDay(90); // top-ups, deploy, reinforcement, upgrades
    expect(l.armiesOf(id).length).toBeGreaterThan(2);
    const gen2 = groundSlotOf(equipKey("infantry_equipment", 2));
    let upgraded = 0;
    for (let r = 0; r < t.rows; r++) {
      if (t.alive(r) && t.owner[r] === id)
        upgraded += t.equip[r * GROUND_SLOTS + gen2];
    }
    expect(upgraded).toBeGreaterThan(0);
    expect(totals()).toEqual(before);
    // Disband three divisions; queue more and cancel them half-trained.
    for (const d of l.armiesOf(id)[0].divisions.slice(0, 3)) {
      disbandDivision(l, t.rowOf(d));
    }
    expect(issue(train(INFANTRY, 2))).toBeNull();
    nextDay(10);
    expect(
      issue({ kind: "cancel_train", entry: cl.training[0].id }),
    ).toBeNull();
    // Key by key: no generation moved into another's.
    expect(totals()).toEqual(before);
    expect(men()).toBe(menBefore);
  });
});

describe("templates (P2 spec §4.4)", () => {
  test("editing a template refits its divisions and refunds the removed battalions", async () => {
    const { l, id, cl, ce, issue, nextDay } = await germany(false);
    cl.armyXpMilli = 40_000;
    const t = l.divisions;
    const rows = () => {
      const out: number[] = [];
      for (let r = 0; r < t.rows; r++) {
        if (t.alive(r) && t.owner[r] === id && t.template[r] === INFANTRY) {
          out.push(r);
        }
      }
      return out;
    };
    expect(rows()).toHaveLength(45);
    const artSlots = keysOf("artillery").map(groundSlotOf);
    const guns = rows().reduce(
      (n, r) =>
        n + artSlots.reduce((m, j) => m + t.equip[r * GROUND_SLOTS + j], 0),
      0,
    );
    expect(guns).toBeGreaterThan(0);
    const stockGuns = typeTotal(ce.stock, "artillery");
    const manpower = ce.manpower;
    const men = rows().reduce((n, r) => n + t.men[r], 0);
    // Without the two artillery battalions: 2 × 5 army experience.
    expect(
      issue(
        save(INFANTRY, [["infantry", 9]], ["engineer", "recon"], "Infanterie"),
      ),
    ).toBeNull();
    expect(cl.armyXpMilli).toBe(30_000);
    const tpl = cl.template(INFANTRY)!;
    expect(tpl.def.name).toBe("Infanterie");
    expect(tpl.key).toBe("");
    for (const r of rows()) {
      expect(t.men[r]).toBeLessThanOrEqual(9_500);
      for (const j of artSlots) expect(t.equip[r * GROUND_SLOTS + j]).toBe(0);
    }
    expect(typeTotal(ce.stock, "artillery")).toBe(stockGuns + guns);
    const menAfter = rows().reduce((n, r) => n + t.men[r], 0);
    expect(ce.manpower).toBe(manpower + men - menAfter);
    expect(menAfter).toBe(45 * 9_500);
    // Four artillery battalions in: org is cut to the lower maximum and the
    // guns come by reinforcement.
    for (const r of rows()) t.org[r] = l.orgMaxOf(r);
    expect(
      issue(
        save(
          INFANTRY,
          [
            ["infantry", 9],
            ["artillery", 4],
          ],
          ["engineer", "recon"],
          "Infanterie",
        ),
      ),
    ).toBeNull();
    expect(cl.armyXpMilli).toBe(10_000);
    const r0 = rows()[0];
    expect(l.baseStatsOf(r0).orgMilli).toBe(Math.floor((9 * 60_000) / 13));
    for (const r of rows()) expect(t.org[r]).toBe(l.orgMaxOf(r));
    ce.manpower = 1_000_000;
    setStock(ce, "artillery", 10_000);
    nextDay();
    expect(typeTotal(t.equipOf(r0), "artillery", true)).toBe(
      Math.ceil((48 * 100) / 1000),
    );
    expect(t.men[r0]).toBe(9_500 + Math.ceil((11_500 * 100) / 1000));
    // A new name alone costs nothing.
    expect(
      issue(
        save(
          INFANTRY,
          [
            ["infantry", 9],
            ["artillery", 4],
          ],
          ["engineer", "recon"],
          "Renamed",
        ),
      ),
    ).toBeNull();
    expect(cl.armyXpMilli).toBe(10_000 + 200);
  });

  test("not enough army XP refuses the edit", async () => {
    const { cl, issue } = await germany(false);
    cl.armyXpMilli = 4_999;
    const def = cl.template(INFANTRY)!.def;
    expect(
      issue(
        save(
          INFANTRY,
          [
            ["infantry", 9],
            ["artillery", 1],
          ],
          ["engineer", "recon"],
        ),
      ),
    ).toBe("no_xp");
    expect(cl.template(INFANTRY)!.def).toBe(def);
    expect(cl.armyXpMilli).toBe(4_999);
    // A copy is free; what it changes is not.
    expect(
      issue(
        save(
          0,
          [
            ["infantry", 9],
            ["artillery", 2],
          ],
          ["engineer", "recon"],
          "Copy",
          INFANTRY,
        ),
      ),
    ).toBeNull();
    expect(cl.templates).toHaveLength(7);
    expect(
      issue(
        save(
          0,
          [
            ["infantry", 10],
            ["artillery", 2],
          ],
          ["engineer", "recon"],
          "More",
          INFANTRY,
        ),
      ),
    ).toBe("no_xp");
    // From nothing every battalion is a change.
    cl.armyXpMilli = 10_000;
    expect(issue(save(0, [["infantry", 2]], [], "Two"))).toBeNull();
    expect(cl.armyXpMilli).toBe(0);
  });

  test("template and training orders refuse what the rules refuse", async () => {
    const { l, id, g, cl, issue } = await germany(false);
    cl.armyXpMilli = 500_000;
    // The rules (templateBlock): width, techs.
    expect(issue(save(0, [["artillery", 14]], [], "Wide", INFANTRY))).toBe(
      "bad_template",
    );
    expect(issue(save(0, [["paratrooper", 2]], [], "Para"))).toBe("no_tech");
    expect(issue(save(77, [["infantry", 2]], [], "None"))).toBe("bad_template");
    expect(issue(save(0, [["infantry", 2]], [], "None", 77))).toBe(
      "bad_template",
    );
    // Twelve templates at most.
    while (cl.templates.length < WW_MAX_TEMPLATES) {
      expect(issue(save(0, [["infantry", 1]], [], "One"))).toBeNull();
    }
    expect(issue(save(0, [["infantry", 1]], [], "One"))).toBe(
      "too_many_templates",
    );
    // Delete: only one nobody uses.
    expect(issue({ kind: "template_delete", template: INFANTRY })).toBe(
      "template_in_use",
    );
    const last = cl.templates[cl.templates.length - 1].id;
    expect(issue(train(last))).toBeNull();
    expect(issue({ kind: "template_delete", template: last })).toBe(
      "template_in_use",
    );
    expect(
      issue({ kind: "cancel_train", entry: cl.training[0].id }),
    ).toBeNull();
    expect(issue({ kind: "template_delete", template: last })).toBeNull();
    expect(issue({ kind: "template_delete", template: last })).toBe(
      "bad_template",
    );
    // Training: a template, an army of ours, a region of our side.
    expect(issue(train(99))).toBe("bad_template");
    const polArmy = l.armiesOf(byTag(g, "POL").smallID())[0];
    expect(issue(train(INFANTRY, 1, polArmy.id))).toBe("no_army");
    expect(issue(train(INFANTRY, 1, 0, 6))).toBe("bad_region");
    expect(issue(train(INFANTRY, 1, 0, 3))).toBeNull();
    // Special battalions: max(24, 5% of all) counting this order.
    expect(l.templateStatsOf(id, MOUNTAIN)!.special).toBe(6);
    expect(issue(train(MOUNTAIN, 5))).toBe("special_cap");
    expect(issue(train(MOUNTAIN, 4))).toBeNull();
    expect(issue(train(MOUNTAIN, 1))).toBe("special_cap");
    // Twenty entries at most.
    while (cl.training.length < WW_MAX_TRAINING) {
      expect(issue(train(INFANTRY))).toBeNull();
    }
    expect(issue(train(INFANTRY))).toBe("queue_full");
  });
});
