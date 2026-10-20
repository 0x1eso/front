// World War 1936 P2: templates and the training queue (P2 spec §4.4, §5.1).
// Men and equipment move only through economy/Stock.ts (Review Focus 4):
// every unit a division or a trainee holds came out of the pool or the
// stock and goes back to its own generation's key.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import {
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  DivisionStats,
  GROUND_SLOTS,
  groundSlotOf,
  TemplateDef,
  WW_DEPLOY_MIN_FILL_PM,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TEMPLATES,
  WW_MAX_TRAINING,
  WW_REINFORCE_PM,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  equipFill,
  specialCap,
  templateBlock,
  templateXpCost,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import {
  drawManpower,
  drawTemplateEquip,
  returnDivisionEquip,
  returnEquip,
  returnManpower,
} from "../economy/Stock";
import type { CountryEconomy } from "../economy/WwEconomy";
import { capitalRegion } from "./LandStartRun";
import type {
  Army,
  CountryLand,
  Trainee,
  TrainingEntry,
  WwLand,
} from "./WwLand";

/** A division slot (GROUND_SLOTS index) and its stock key. */
export interface SlotKey {
  slot: number;
  key: number;
}

/** Each EQUIPMENT_TYPES index's division slots, oldest generation first (none for aircraft). */
export const TYPE_SLOTS: readonly (readonly SlotKey[])[] = EQUIPMENT_TYPES.map(
  (type) => {
    const out: SlotKey[] = [];
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      const key = equipKey(type, g);
      const slot = groundSlotOf(key);
      if (slot >= 0) out.push({ slot, key });
    }
    return out;
  },
);

/**
 * Spec §5.3: what reinforcement may bring in a day, at most `need` × 10%
 * × supply ‰ (at least one while anything comes at all).
 */
export function reinforceCap(supplyPm: number): (need: number) => number {
  return (need) =>
    Math.ceil((need * WW_REINFORCE_PM * Math.max(0, supplyPm)) / 1_000_000);
}

/** Spec §5.1: the lowest fill of the equipment types a template needs, ‰. */
export function lowestFillPm(
  s: DivisionStats,
  equip: ArrayLike<number>,
): number {
  let low = 1000;
  equipFill(s, equip).forEach((f, i) => {
    if (s.need[i] > 0) low = Math.min(low, f);
  });
  return low;
}

// ---- Templates (spec §4.4) ----

export function saveTemplate(
  land: WwLand,
  cl: CountryLand,
  o: Extract<LandOrder, { kind: "template_save" }>,
): WwOrderBlock | null {
  const ce = land.econ.country(cl.smallID);
  if (ce === null) return "dead";
  const old = o.template === 0 ? null : cl.template(o.template);
  if (o.template !== 0 && old === null) return "bad_template";
  if (old === null && cl.templates.length >= WW_MAX_TEMPLATES) {
    return "too_many_templates";
  }
  // A new template copies `base` (free) and pays for what it changes.
  const base = old ?? (o.base === 0 ? null : cl.template(o.base));
  if (old === null && o.base !== 0 && base === null) return "bad_template";
  const def: TemplateDef = {
    name: o.name,
    battalions: [...o.battalions],
    support: [...o.support],
  };
  const block = templateBlock(def, ce.researched, Infinity);
  if (block !== null) return block;
  const cost = templateXpCost(base?.def ?? null, def);
  if (cost > cl.armyXpMilli) return "no_xp";
  cl.armyXpMilli -= cost;
  if (old === null) {
    cl.templates.push({ id: cl.nextTemplateId++, key: "", def });
  } else {
    // A new def object: the stats caches see the change.
    old.def = def;
    // A player's own name replaces the 1936 default's translated one.
    if (def.name !== "") old.key = "";
    refitTemplate(land, cl, ce, old.id);
  }
  land.markCountry(cl.smallID);
  return null;
}

/**
 * Spec §4.4: the divisions (and trainees) of an edited template follow it
 * at once. Men and equipment above the new need go back to the pool and
 * the stock (oldest generation first); new battalions fill up by
 * reinforcement; org is cut to the new maximum.
 */
function refitTemplate(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  template: number,
): void {
  const t = land.divisions;
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0 || t.owner[r] !== cl.smallID) continue;
    if (t.template[r] !== template) continue;
    land.touchDivision(r);
    const s = land.baseStatsOf(r);
    if (t.men[r] > s.men) {
      returnManpower(ce, t.men[r] - s.men);
      land.setMen(r, s.men);
    }
    const slots = Array.from(t.equipOf(r));
    returnExcess(ce, slots, s.need);
    applySlots(land, r, slots);
    const max = land.orgMaxOf(r);
    if (t.org[r] > max) t.org[r] = max;
  }
  const s = land.templateStatsOf(cl.smallID, template);
  if (s === null) return;
  for (const x of cl.trainees) {
    if (x.template !== template) continue;
    if (x.men > s.men) {
      returnManpower(ce, x.men - s.men);
      x.men = s.men;
    }
    returnExcess(ce, x.equip, s.need);
  }
}

/** Gives back what `slots` hold above `need` (EQUIPMENT_TYPES order), oldest generation first. */
function returnExcess(
  ce: CountryEconomy,
  slots: number[],
  need: readonly number[],
): void {
  TYPE_SLOTS.forEach((list, i) => {
    let have = 0;
    for (const { slot } of list) have += slots[slot];
    let extra = have - need[i];
    for (const { slot, key } of list) {
      if (extra <= 0) break;
      const n = Math.min(extra, slots[slot]);
      returnEquip(ce, key, n);
      slots[slot] -= n;
      extra -= n;
    }
  });
}

/** Writes a division's new slots through WwLand.addEquip (pre-flight U8). */
export function applySlots(
  land: WwLand,
  row: number,
  slots: ArrayLike<number>,
): void {
  const cur = land.divisions.equipOf(row);
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const d = slots[j] - cur[j];
    if (d !== 0) land.addEquip(row, j, d);
  }
}

export function deleteTemplate(
  land: WwLand,
  cl: CountryLand,
  template: number,
): WwOrderBlock | null {
  if (cl.template(template) === null) return "bad_template";
  const t = land.divisions;
  for (let r = 0; r < t.rows; r++) {
    if (
      t.id[r] !== 0 &&
      t.owner[r] === cl.smallID &&
      t.template[r] === template
    ) {
      return "template_in_use";
    }
  }
  if (
    cl.training.some((e) => e.template === template) ||
    cl.trainees.some((x) => x.template === template)
  ) {
    return "template_in_use";
  }
  cl.templates = cl.templates.filter((tpl) => tpl.id !== template);
  land.markCountry(cl.smallID);
  return null;
}

// ---- The training queue (spec §5.1) ----

/** Battalions of the country's divisions, trainees and queued divisions, and the special ones among them. */
function battalionsInUse(
  land: WwLand,
  cl: CountryLand,
): { total: number; special: number } {
  let total = 0;
  let special = 0;
  const add = (template: number, n: number) => {
    const s = land.templateStatsOf(cl.smallID, template);
    if (s === null) return;
    total += s.battalions * n;
    special += s.special * n;
  };
  const t = land.divisions;
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] !== 0 && t.owner[r] === cl.smallID) add(t.template[r], 1);
  }
  for (const x of cl.trainees) add(x.template, 1);
  for (const e of cl.training) add(e.template, e.remaining);
  return { total, special };
}

export function queueTraining(
  land: WwLand,
  cl: CountryLand,
  o: Extract<LandOrder, { kind: "train" }>,
): WwOrderBlock | null {
  if (cl.training.length >= WW_MAX_TRAINING) return "queue_full";
  const s = land.templateStatsOf(cl.smallID, o.template);
  if (s === null) return "bad_template";
  // Spec §4.1: special battalions up to max(24, 5% of all battalions),
  // counting the field, the training and this order.
  if (s.special > 0) {
    const used = battalionsInUse(land, cl);
    const special = used.special + o.count * s.special;
    if (special > specialCap(used.total + o.count * s.battalions)) {
      return "special_cap";
    }
  }
  if (o.army !== 0) {
    const a = land.armies.get(o.army);
    if (a === undefined || a.owner !== cl.smallID) return "no_army";
  }
  if (
    o.region !== 0 &&
    (land.scenario.region(o.region) === undefined ||
      !land.sameSide(land.controller[o.region], cl.smallID))
  ) {
    return "bad_region";
  }
  cl.training.push({
    id: cl.nextEntryId++,
    template: o.template,
    remaining: o.count,
    army: o.army,
    region: o.region,
  });
  land.markCountry(cl.smallID);
  return null;
}

export function cancelTraining(
  land: WwLand,
  cl: CountryLand,
  entry: number,
): WwOrderBlock | null {
  if (!cl.training.some((e) => e.id === entry)) return "bad_index";
  const ce = land.econ.country(cl.smallID);
  if (ce !== null) {
    for (const x of cl.trainees) {
      if (x.entry === entry) returnDivisionEquip(ce, x.equip, x.men);
    }
  }
  cl.trainees = cl.trainees.filter((x) => x.entry !== entry);
  cl.training = cl.training.filter((e) => e.id !== entry);
  land.markCountry(cl.smallID);
  return null;
}

/**
 * P3 (Task 1 Step 7): the training days with the country's trainPct
 * (staff_training −10%), at least 1.
 */
export function trainDaysOf(
  ce: CountryEconomy | null,
  s: { trainDays: number },
): number {
  const pct = ce === null ? 0 : ce.stats.trainPct;
  return Math.max(1, Math.floor((s.trainDays * (100 + pct)) / 100));
}

export function deployNow(
  land: WwLand,
  cl: CountryLand,
  entry: number,
): WwOrderBlock | null {
  const e = cl.training.find((x) => x.id === entry);
  const i = cl.trainees.findIndex((x) => x.entry === entry);
  if (e === undefined || i < 0) return "bad_index";
  const x = cl.trainees[i];
  const s = land.templateStatsOf(cl.smallID, x.template);
  if (s === null) return "bad_template";
  const region = deployRegion(land, cl.smallID, e.region);
  if (region === 0) return "bad_region";
  const army = deployArmy(land, cl, e, region);
  if (army === null) return "too_many_armies";
  // Spec §5.1 (내 판단): org = maximum × progress.
  const total = trainDaysOf(land.econ.country(cl.smallID), s);
  const days = Math.min(x.days, total);
  spawnTrainee(land, cl, x, region, army, (max) =>
    Math.floor((max * days) / total),
  );
  cl.trainees.splice(i, 1);
  dropFinished(cl);
  land.markCountry(cl.smallID);
  return null;
}

/**
 * Spec §5.1, the country's day: the trainees first (a day more, the
 * missing equipment at the reinforcement rate, or all there is once
 * trained; deployed once trained with every needed type at least half
 * full), then the queue from the front:
 * each entry starts all it can, an entry short of men waits without
 * blocking the next. Returns the divisions deployed.
 */
export function dailyTraining(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
): number {
  let ready = 0;
  const keep: Trainee[] = [];
  for (const x of cl.trainees) {
    const s = land.templateStatsOf(cl.smallID, x.template);
    if (s === null) {
      keep.push(x); // unreachable: a template in use is never deleted
      continue;
    }
    x.days++;
    // In training the missing equipment comes at the reinforcement rate;
    // trained and only waiting for it, all there is (as at the start).
    const trained = x.days >= trainDaysOf(ce, s);
    drawTemplateEquip(
      ce,
      x.equip,
      s.need,
      EQUIPMENT_TYPES,
      trained ? (n) => n : reinforceCap(1000),
    );
    if (trained && lowestFillPm(s, x.equip) >= WW_DEPLOY_MIN_FILL_PM) {
      const e = cl.training.find((en) => en.id === x.entry);
      const region = deployRegion(land, cl.smallID, e?.region ?? 0);
      const army = region === 0 ? null : deployArmy(land, cl, e, region);
      if (army !== null) {
        spawnTrainee(land, cl, x, region, army, (max) => max);
        ready++;
        continue;
      }
    }
    keep.push(x);
  }
  cl.trainees = keep;
  for (const e of cl.training) {
    const s = land.templateStatsOf(cl.smallID, e.template);
    if (s === null) continue;
    while (e.remaining > 0) {
      // Spec §5.1: the men leave the pool at once; the equipment as available.
      if (!drawManpower(ce, s.men)) break;
      const equip = new Array<number>(GROUND_SLOTS).fill(0);
      drawTemplateEquip(ce, equip, s.need, EQUIPMENT_TYPES);
      cl.trainees.push({
        entry: e.id,
        template: e.template,
        men: s.men,
        equip,
        days: 0,
      });
      e.remaining--;
    }
  }
  dropFinished(cl);
  return ready;
}

/** Entries with nothing left to start or train go. */
function dropFinished(cl: CountryLand): void {
  cl.training = cl.training.filter(
    (e) => e.remaining > 0 || cl.trainees.some((x) => x.entry === e.id),
  );
}

/** Spec §5.1: the entry's region while the side holds it, else the capital (or the best region held); 0: none. */
function deployRegion(land: WwLand, smallID: number, region: number): number {
  if (
    region !== 0 &&
    land.scenario.region(region) !== undefined &&
    land.sameSide(land.controller[region], smallID)
  ) {
    return region;
  }
  return capitalRegion(land, smallID);
}

/**
 * Spec §5.1: the entry's army while it is ours and not full, else a new
 * army there (the entry's next divisions join it). With 40 armies already
 * (pre-flight S4): the first non-full army in that region, else any; null
 * when every army is full.
 */
function deployArmy(
  land: WwLand,
  cl: CountryLand,
  e: TrainingEntry | undefined,
  region: number,
): Army | null {
  if (e !== undefined && e.army !== 0) {
    const a = land.armies.get(e.army);
    if (
      a !== undefined &&
      a.owner === cl.smallID &&
      a.divisions.length < WW_MAX_ARMY_DIVISIONS
    ) {
      return a;
    }
  }
  const fresh = land.newArmy(cl.smallID);
  if (fresh !== null) {
    if (e !== undefined) e.army = fresh.id;
    return fresh;
  }
  let any: Army | null = null;
  for (const a of land.armiesOf(cl.smallID)) {
    if (a.divisions.length >= WW_MAX_ARMY_DIVISIONS) continue;
    if (land.armyRegion(a) === region) return a;
    any ??= a;
  }
  return any;
}

/** The trainee becomes a division (experience 0) with org `org(maximum)`. */
function spawnTrainee(
  land: WwLand,
  cl: CountryLand,
  x: Trainee,
  region: number,
  army: Army,
  org: (max: number) => number,
): void {
  const id = land.spawnDivision(
    cl.smallID,
    x.template,
    region,
    army,
    x.men,
    x.equip,
    0,
  );
  const row = land.divisions.rowOf(id);
  land.divisions.org[row] = org(land.orgMaxOf(row));
}
