// World War 1936: start_oob. A major's player plans the whole start army in
// the lobby: templates, how many of each, which army holds them. The pure
// fill is engine-lib's planStartOob (the lobby previews with the same
// function). Men and equipment move only through economy/Stock.ts: the
// start divisions give everything back first, the plan draws it again.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  TemplateDef,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TEMPLATES,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  START_OOB,
  startTemplates,
} from "@openfront/engine-lib/ww1936/LandStart";
import {
  oobArmyRequired,
  oobFillOrder,
  OobTemplateCost,
  planStartOob,
  startOobBudget,
} from "@openfront/engine-lib/ww1936/StartOob";
import { groupStockOf } from "@openfront/engine-lib/ww1936/StartReform";
import {
  genMixOf,
  templateBlock,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { drawEquip, drawManpower, returnDivisionEquip } from "../economy/Stock";
import { capitalRegion, fieldDivision } from "./LandStartRun";
import type { Army, CountryLand, LandTemplate, WwLand } from "./WwLand";

type StartOobOrder = Extract<LandOrder, { kind: "start_oob" }>;

const ZERO_MIX = () => genMixOf(new Array<number>(GROUND_SLOTS).fill(0));

export function startOob(
  land: WwLand,
  cl: CountryLand,
  o: StartOobOrder,
): WwOrderBlock | null {
  const ce = land.econ.country(cl.smallID);
  if (ce === null) return "dead";
  const sc = land.scenario;
  const oob = START_OOB[cl.tag];
  // Preparation only, a human-controlled major with a historical start, once.
  if (!land.ww.inPrep(land.mg.ticks())) return "bad_index";
  if (!land.ww.isHumanControlled(cl.smallID)) return "bad_index";
  if (oob === undefined || sc.data.historicalOob !== true) return "bad_index";
  if (sc.isDormantSlot(cl.smallID) || cl.startOob) return "bad_index";
  if (o.armies.length !== oob.length) return "bad_index";

  // ---- the templates: validated before anything changes ----
  const keys = new Set<string>();
  const defs: TemplateDef[] = [];
  const targets: (LandTemplate | null)[] = [];
  let fresh = 0;
  for (const t of o.templates) {
    const def: TemplateDef = {
      name: t.name,
      battalions: [...t.battalions],
      support: [...t.support],
    };
    let target: LandTemplate | null = null;
    if (t.key !== undefined) {
      if (keys.has(t.key)) return "bad_template";
      keys.add(t.key);
      target = cl.templates.find((x) => x.key === t.key) ?? null;
      if (target === null) return "bad_template";
    } else if (def.name === "") {
      return "bad_template";
    }
    // A template the plan leaves as the country has it is not judged: a
    // start template may hold a battalion the country has not researched
    // (the Soviet mountain rifles), and the plan must not fail over it.
    const same =
      target !== null &&
      target.def.battalions.join() === def.battalions.join() &&
      target.def.support.join() === def.support.join();
    if (!same) {
      const block = templateBlock(def, ce.researched, Infinity);
      if (block !== null) return block;
    }
    if (target === null) fresh++;
    defs.push(def);
    targets.push(target);
  }
  if (cl.templates.length + fresh > WW_MAX_TEMPLATES) {
    return "too_many_templates";
  }
  const costs: OobTemplateCost[] = defs.map((d) => {
    const s = templateStats(d, ce.stats, ZERO_MIX());
    return { men: s.men, need: s.need };
  });

  // ---- the plan ----
  const asks = o.armies.map((items, i) => {
    let sum = 0;
    for (const it of items) {
      if (it.template >= defs.length) return null;
      sum += it.count;
    }
    return sum > WW_MAX_ARMY_DIVISIONS
      ? null
      : { required: oobArmyRequired(oob[i]), items };
  });
  if (asks.some((a) => a === null)) return "army_full";
  const plan = asks as { required: boolean; items: (typeof o.armies)[0] }[];
  // An operation army must be staffed whatever the client sends.
  if (plan.some((a) => a.required && a.items.every((x) => x.count === 0))) {
    return "no_army";
  }

  // ---- the start armies, as the start made them (army number = start index) ----
  const t = land.divisions;
  const armyOf: (Army | null)[] = oob.map((_, i) => {
    for (const a of land.armiesOf(cl.smallID)) if (a.nameNo === i + 1) return a;
    return null;
  });
  const rows: number[] = [];
  const regionOf: number[] = [];
  oob.forEach((a, i) => {
    const army = armyOf[i];
    let region = 0;
    for (const id of army?.divisions ?? []) {
      const r = t.rowOf(id);
      if (r < 0) continue;
      rows.push(r);
      if (region === 0) region = t.region[r];
    }
    if (region === 0) {
      region =
        a.regions.find((x) => land.controller[x] === cl.smallID) ??
        capitalRegion(land, cl.smallID);
    }
    regionOf.push(region);
  });

  // Everything the start divisions hold goes back first.
  let givenMen = 0;
  const givenEquip = new Array<number>(GROUND_SLOTS).fill(0);
  for (const r of rows) {
    givenMen += t.men[r];
    returnDivisionEquip(ce, t.equipOf(r), t.men[r]);
    const e = t.equipOf(r);
    for (let j = 0; j < GROUND_SLOTS; j++) givenEquip[j] += e[j];
  }
  const undo = (): void => {
    drawManpower(ce, givenMen);
    for (let j = 0; j < GROUND_SLOTS; j++) {
      drawEquip(ce, GROUND_EQUIP_KEYS[j], givenEquip[j]);
    }
  };

  // The budget: the men of the original start divisions.
  let civ = 0;
  for (const id of land.econ.regionsOf(cl.smallID)) civ += land.econ.civ[id];
  const originals = startTemplates(cl.tag, sc.devOf(cl.tag, civ));
  const menOf = new Map(
    originals.map((x) => [
      x.key,
      templateStats(x.def, ce.stats, ZERO_MIX()).men,
    ]),
  );
  const budget = startOobBudget(
    oob,
    (key) => menOf.get(key) ?? menOf.get(originals[0].key) ?? 0,
  );
  const res = planStartOob(
    budget,
    ce.manpower,
    groupStockOf(ce.stock),
    costs,
    plan,
  );
  if (res.emptyRequired.length > 0) {
    undo();
    return "no_army";
  }

  // ---- apply: the templates ----
  const tpls: LandTemplate[] = defs.map((def, i) => {
    const target = targets[i];
    if (target === null) {
      const x: LandTemplate = { id: cl.nextTemplateId++, key: "", def };
      cl.templates.push(x);
      return x;
    }
    // ww107: a plan that changes a template is a player's edit of it.
    if (
      target.def.battalions.join() !== def.battalions.join() ||
      target.def.support.join() !== def.support.join()
    ) {
      delete target.auto;
    }
    // A new def object: the stats caches see the change; a name replaces the default's.
    target.def = def;
    if (def.name !== "") target.key = "";
    return target;
  });

  // ---- field, in the order the pure rule drew ----
  for (const ai of oobFillOrder(plan)) {
    let army = armyOf[ai];
    const wants = res.armies[ai].total > 0;
    if (army === null) {
      if (!wants) continue;
      army = land.newArmy(cl.smallID);
      if (army === null) continue;
    }
    plan[ai].items.forEach((it, ii) => {
      for (let k = 0; k < res.armies[ai].items[ii].fielded; k++) {
        if (
          !fieldDivision(land, cl, ce, tpls[it.template], regionOf[ai], army)
        ) {
          return;
        }
      }
    });
  }
  // The start divisions go; an army left with nothing goes with them.
  for (const r of rows) land.killDivision(r, false);
  cl.startOob = true;
  land.markCountry(cl.smallID);
  const p = land.mg.playerBySmallID(cl.smallID);
  if (p.isPlayer()) p.setTroops(land.fieldMen(cl.smallID));
  return null;
}
