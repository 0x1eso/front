// World War 1936 P2: templates and the training queue (P2 spec §4.4, §5.1).
// Men and equipment move only through economy/Stock.ts (Review Focus 4):
// every unit a division or a trainee holds came out of the pool or the
// stock and goes back to its own generation's key.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { KeyStatsTable } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  DivisionStats,
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  groundSlotOf,
  TemplateDef,
  WW_DEPLOY_MIN_FILL_PM,
  WW_MAX_ARMIES,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TEMPLATES,
  WW_MAX_TRAINING,
  WW_REINFORCE_PM,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  equipFill,
  specialCap,
  STATIC_KEY_STATS,
  templateBlock,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import {
  drawManpower,
  drawOrderOf,
  drawTemplateEquip,
  returnDivisionEquip,
  returnEquip,
  returnManpower,
} from "../economy/Stock";
import type { CountryEconomy } from "../economy/WwEconomy";
import { capitalRegion } from "./LandStartRun";
import { noteStartBudget, reformStartDivisions } from "./StartReform";
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
  ks: KeyStatsTable = STATIC_KEY_STATS,
): number {
  let low = 1000;
  equipFill(s, equip, ks).forEach((f, i) => {
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
  // A new template copies `base`; every change is free.
  const base = old ?? (o.base === 0 ? null : cl.template(o.base));
  if (old === null && o.base !== 0 && base === null) return "bad_template";
  const def: TemplateDef = {
    name: o.name,
    battalions: [...o.battalions],
    support: [...o.support],
  };
  const block = templateBlock(def, ce.researched, Infinity);
  if (block !== null) return block;
  // The preparation minute: a human's start template re-forms its divisions.
  const reform = old !== null && noteStartBudget(land, cl, ce, old);
  if (old === null) {
    cl.templates.push({ id: cl.nextTemplateId++, key: "", def });
  } else {
    // A new def object: the stats caches see the change.
    old.def = def;
    // A player's own name replaces the 1936 default's translated one.
    if (def.name !== "") old.key = "";
    if (reform) reformStartDivisions(land, cl, ce, old);
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
    refitDivision(land, cl, ce, r);
  }
  for (const x of cl.trainees) {
    if (x.template === template) refitTrainee(land, cl, ce, x);
  }
}

/** One division (already holding its new template) follows it: surplus men and equipment go back, org is cut. */
function refitDivision(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  r: number,
): void {
  const t = land.divisions;
  land.touchDivision(r);
  const s = land.baseStatsOf(r);
  if (t.men[r] > s.men) {
    returnManpower(ce, t.men[r] - s.men);
    land.setMen(r, s.men);
  }
  const slots = Array.from(t.equipOf(r));
  returnExcess(ce, slots, s.need, land.keyStatsOf(cl.smallID));
  applySlots(land, r, slots);
  const max = land.orgMaxOf(r);
  if (t.org[r] > max) t.org[r] = max;
}

/** The same for a trainee (already holding its new template). */
function refitTrainee(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  x: Trainee,
): void {
  const s = land.templateStatsOf(cl.smallID, x.template);
  if (s === null) return;
  if (x.men > s.men) {
    returnManpower(ce, x.men - s.men);
    x.men = s.men;
  }
  returnExcess(ce, x.equip, s.need, land.keyStatsOf(cl.smallID));
}

/**
 * Moves divisions to another template at once: every division of template
 * `from`, or of army `army` (whatever its template), then each follows the
 * new template exactly as an edited template's divisions do (refitDivision).
 * With `from`, its trainees and queued entries move too. Refused as a
 * whole, changing nothing, when any check fails.
 */
export function convertDivisions(
  land: WwLand,
  cl: CountryLand,
  o: Extract<LandOrder, { kind: "divisions_convert" }>,
): WwOrderBlock | null {
  const ce = land.econ.country(cl.smallID);
  if (ce === null) return "dead";
  const disarmed = land.ww.endgame.disarmBlock(cl.smallID, "train");
  if (disarmed !== null) return disarmed;
  if ((o.from === undefined) === (o.army === undefined)) return "bad_index";
  const to = cl.template(o.to);
  if (to === null) return "bad_template";
  if (o.from === o.to) return "bad_template";
  if (o.from !== undefined && cl.template(o.from) === null) {
    return "bad_template";
  }
  // The parts the target needs: the same rule saving a template uses.
  const block = templateBlock(to.def, ce.researched, Infinity);
  if (block !== null) return block;
  const target = land.templateStatsOf(cl.smallID, o.to);
  if (target === null) return "bad_template";
  const t = land.divisions;
  const rows: number[] = [];
  if (o.army !== undefined) {
    const a = land.armies.get(o.army);
    if (a === undefined || a.owner !== cl.smallID) return "no_army";
    for (const id of a.divisions) {
      const r = t.rowOf(id);
      if (r >= 0 && t.template[r] !== o.to) rows.push(r);
    }
  } else {
    for (const r of land.rowsOf(cl.smallID)) {
      if (t.template[r] === o.from) rows.push(r);
    }
  }
  const trainees =
    o.from === undefined
      ? []
      : cl.trainees.filter((x) => x.template === o.from);
  const entries =
    o.from === undefined
      ? []
      : cl.training.filter((e) => e.template === o.from);
  if (rows.length + trainees.length + entries.length === 0) return "bad_index";
  // The special cap, counting every converted division, trainee and entry.
  if (target.special > 0) {
    const used = battalionsInUse(land, cl);
    let total = used.total;
    let special = used.special;
    const swap = (template: number, n: number) => {
      const s = land.templateStatsOf(cl.smallID, template);
      if (s === null) return;
      total += n * (target.battalions - s.battalions);
      special += n * (target.special - s.special);
    };
    for (const r of rows) swap(t.template[r], 1);
    for (const x of trainees) swap(x.template, 1);
    for (const e of entries) swap(e.template, e.remaining);
    if (special > specialCap(total)) return "special_cap";
  }
  for (const r of rows) {
    land.setTemplate(r, o.to);
    refitDivision(land, cl, ce, r);
  }
  for (const x of trainees) {
    x.template = o.to;
    refitTrainee(land, cl, ce, x);
  }
  for (const e of entries) e.template = o.to;
  land.markCountry(cl.smallID);
  const p = land.mg.playerBySmallID(cl.smallID);
  if (p.isPlayer()) p.setTroops(land.fieldMen(cl.smallID));
  return null;
}

/**
 * Gives back what `slots` hold above `need` (P6: NEED_GROUPS order), the
 * oldest first (the draw order backwards: P2's oldest generation first).
 */
function returnExcess(
  ce: CountryEconomy,
  slots: number[],
  need: readonly number[],
  ks: KeyStatsTable,
): void {
  for (let g = 0; g < need.length; g++) {
    // (The cached draw order, reversed: no sort per group.)
    const list = [...drawOrderOf(ks)[g]].reverse();
    let have = 0;
    for (const j of list) have += slots[j];
    let extra = have - need[g];
    for (const j of list) {
      if (extra <= 0) break;
      const n = Math.min(extra, slots[j]);
      returnEquip(ce, GROUND_EQUIP_KEYS[j], n);
      slots[j] -= n;
      extra -= n;
    }
  }
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
  // P5 hook (W, spec §6.4): a disarmed country trains no more divisions.
  const disarmed = land.ww.endgame.disarmBlock(cl.smallID, "train");
  if (disarmed !== null) return disarmed;
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
  // The chosen army must be mine now; whether it can take the division is
  // checked when the division is ready (it may be full or gone by then).
  if (o.target !== undefined) {
    const a = land.armies.get(o.target);
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
    ...(o.target === undefined ? {} : { target: o.target }),
  });
  land.markCountry(cl.smallID);
  return null;
}

/**
 * An army template: every item becomes one entry of one group; the whole
 * order is refused when any part fails, so nothing is half queued.
 */
export function queueArmyTraining(
  land: WwLand,
  cl: CountryLand,
  o: Extract<LandOrder, { kind: "train_army" }>,
): WwOrderBlock | null {
  const disarmed = land.ww.endgame.disarmBlock(cl.smallID, "train");
  if (disarmed !== null) return disarmed;
  let divisions = 0;
  for (const it of o.items) divisions += it.count;
  if (divisions > WW_MAX_ARMY_DIVISIONS) return "army_full";
  if (cl.training.length + o.items.length > WW_MAX_TRAINING) {
    return "queue_full";
  }
  if (land.armiesOf(cl.smallID).length >= WW_MAX_ARMIES) {
    return "too_many_armies";
  }
  let battalions = 0;
  let special = 0;
  for (const it of o.items) {
    const s = land.templateStatsOf(cl.smallID, it.template);
    if (s === null) return "bad_template";
    battalions += it.count * s.battalions;
    special += it.count * s.special;
  }
  // The special cap counts every item of the order together.
  if (special > 0) {
    const used = battalionsInUse(land, cl);
    if (used.special + special > specialCap(used.total + battalions)) {
      return "special_cap";
    }
  }
  if (
    o.region !== 0 &&
    (land.scenario.region(o.region) === undefined ||
      !land.sameSide(land.controller[o.region], cl.smallID))
  ) {
    return "bad_region";
  }
  const group = cl.nextEntryId;
  for (const it of o.items) {
    cl.training.push({
      id: cl.nextEntryId++,
      template: it.template,
      remaining: it.count,
      army: 0,
      region: o.region,
      group,
    });
  }
  land.markCountry(cl.smallID);
  return null;
}

export function cancelTraining(
  land: WwLand,
  cl: CountryLand,
  entry: number,
): WwOrderBlock | null {
  const first = cl.training.find((e) => e.id === entry);
  if (first === undefined) return "bad_index";
  // A group entry cancels the whole group.
  const ids = new Set(
    first.group === undefined
      ? [entry]
      : cl.training.filter((e) => e.group === first.group).map((e) => e.id),
  );
  const ce = land.econ.country(cl.smallID);
  if (ce !== null) {
    for (const x of cl.trainees) {
      if (ids.has(x.entry)) returnDivisionEquip(ce, x.equip, x.men);
    }
  }
  cl.trainees = cl.trainees.filter((x) => !ids.has(x.entry));
  cl.training = cl.training.filter((e) => !ids.has(e.id));
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
  if (e !== undefined && e.group !== undefined) {
    return deployGroupNow(land, cl, e);
  }
  const i = cl.trainees.findIndex((x) => x.entry === entry);
  if (e === undefined || i < 0) return "bad_index";
  const x = cl.trainees[i];
  const s = land.templateStatsOf(cl.smallID, x.template);
  if (s === null) return "bad_template";
  const spot = deploySpot(land, cl, e);
  if (spot.region === 0) return "bad_region";
  const region = spot.region;
  const army = spot.army;
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
    const grouped =
      cl.training.find((en) => en.id === x.entry)?.group !== undefined;
    // In training the missing equipment comes at the reinforcement rate;
    // trained and only waiting for it, all there is (as at the start).
    const trained = x.days >= trainDaysOf(ce, s);
    drawTemplateEquip(
      ce,
      x.equip,
      s.need,
      land.keyStatsOf(cl.smallID),
      trained ? (n) => n : reinforceCap(1000),
    );
    if (
      trained &&
      lowestFillPm(s, x.equip, land.keyStatsOf(cl.smallID)) >=
        WW_DEPLOY_MIN_FILL_PM
    ) {
      // A group's trainees wait for the rest of the group (below).
      if (grouped) {
        keep.push(x);
        continue;
      }
      const e = cl.training.find((en) => en.id === x.entry);
      const { region, army } = deploySpot(land, cl, e);
      if (army !== null) {
        spawnTrainee(land, cl, x, region, army, (max) => max);
        ready++;
        continue;
      }
    }
    keep.push(x);
  }
  cl.trainees = keep;
  ready += deployReadyGroups(land, cl);
  for (const e of cl.training) {
    const s = land.templateStatsOf(cl.smallID, e.template);
    if (s === null) continue;
    while (e.remaining > 0) {
      // Spec §5.1: the men leave the pool at once; the equipment as available.
      if (!drawManpower(ce, s.men)) break;
      const equip = new Array<number>(GROUND_SLOTS).fill(0);
      drawTemplateEquip(ce, equip, s.need, land.keyStatsOf(cl.smallID));
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
 * Where a single division deploys. With a chosen army (`target`) that still
 * exists, is ours and has room: into that army, in the region the army is in
 * when that region is one we hold, else in the region the entry would have
 * used (the army is still joined, wherever it is). A target that is gone or
 * full is dropped with one notice, and the division deploys as before.
 */
function deploySpot(
  land: WwLand,
  cl: CountryLand,
  e: TrainingEntry | undefined,
): { region: number; army: Army | null } {
  if (e !== undefined && e.target !== undefined) {
    const a = land.armies.get(e.target);
    if (
      a !== undefined &&
      a.owner === cl.smallID &&
      a.divisions.length < WW_MAX_ARMY_DIVISIONS
    ) {
      const at = land.armyRegion(a);
      const held =
        at !== 0 &&
        land.scenario.region(at) !== undefined &&
        land.sameSide(land.controller[at], cl.smallID);
      const region = held ? at : deployRegion(land, cl.smallID, e.region);
      return { region, army: region === 0 ? null : a };
    }
    delete e.target;
    land.message(cl.smallID, "events_display.ww1936_train_target_lost", {});
  }
  const region = deployRegion(land, cl.smallID, e?.region ?? 0);
  return {
    region,
    army: region === 0 ? null : deployArmy(land, cl, e, region),
  };
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

// ---- Army templates: a group deploys as one ----

/** True once the trainee has trained and every needed type is filled enough. */
function isReady(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  x: Trainee,
) {
  const s = land.templateStatsOf(cl.smallID, x.template);
  return (
    s !== null &&
    x.days >= trainDaysOf(ce, s) &&
    lowestFillPm(s, x.equip, land.keyStatsOf(cl.smallID)) >=
      WW_DEPLOY_MIN_FILL_PM
  );
}

/**
 * The groups whose every division has trained and passes the fill rule
 * (an item not started for lack of men counts as not ready) deploy now.
 */
function deployReadyGroups(land: WwLand, cl: CountryLand): number {
  const ce = land.econ.country(cl.smallID);
  if (ce === null) return 0;
  let deployed = 0;
  const done = new Set<number>();
  for (const e of [...cl.training]) {
    if (e.group === undefined || done.has(e.group)) continue;
    done.add(e.group);
    const members = cl.training.filter((en) => en.group === e.group);
    if (members.some((en) => en.remaining > 0)) continue;
    const ids = new Set(members.map((en) => en.id));
    const xs = cl.trainees.filter((x) => ids.has(x.entry));
    if (xs.length === 0 || !xs.every((x) => isReady(land, cl, ce, x))) continue;
    if (deployGroup(land, cl, members, xs, () => (max) => max)) {
      deployed += xs.length;
    }
  }
  return deployed;
}

/**
 * deploy_now on a group entry: every trainee of the group deploys now with
 * org = maximum x days done / days needed (as a single one does); the
 * entries not started are cancelled (nothing was drawn for them).
 */
function deployGroupNow(
  land: WwLand,
  cl: CountryLand,
  e: TrainingEntry,
): WwOrderBlock | null {
  const members = cl.training.filter((en) => en.group === e.group);
  const ids = new Set(members.map((en) => en.id));
  const xs = cl.trainees.filter((x) => ids.has(x.entry));
  if (xs.length === 0) return "bad_index";
  const ce = land.econ.country(cl.smallID);
  const orgOf = (x: Trainee) => {
    const s = land.templateStatsOf(cl.smallID, x.template);
    if (s === null) return (max: number) => max;
    const total = trainDaysOf(ce, s);
    const days = Math.min(x.days, total);
    return (max: number) => Math.floor((max * days) / total);
  };
  if (
    members.some((en) => land.templateStatsOf(cl.smallID, en.template) === null)
  ) {
    return "bad_template";
  }
  if (!deployGroup(land, cl, members, xs, orgOf)) return "too_many_armies";
  return null;
}

/**
 * Places the trainees (in order) in one new army in the group's region; with
 * 40 armies already, in non-full armies as deployArmy does, and the player
 * is told. False (nothing changed) when there is no room at all.
 */
function deployGroup(
  land: WwLand,
  cl: CountryLand,
  members: TrainingEntry[],
  xs: Trainee[],
  orgOf: (x: Trainee) => (max: number) => number,
): boolean {
  const region = deployRegion(land, cl.smallID, members[0].region);
  if (region === 0) return false;
  const targets: Army[] = [];
  let scattered = false;
  const fresh = land.newArmy(cl.smallID);
  if (fresh !== null) {
    for (let i = 0; i < xs.length; i++) targets.push(fresh);
  } else {
    scattered = true;
    // Armies in the region first, then the others, each up to its limit.
    const open = land
      .armiesOf(cl.smallID)
      .filter((a) => a.divisions.length < WW_MAX_ARMY_DIVISIONS);
    const near = open.filter((a) => land.armyRegion(a) === region);
    for (const a of [...near, ...open.filter((a) => !near.includes(a))]) {
      for (
        let room = WW_MAX_ARMY_DIVISIONS - a.divisions.length;
        room > 0 && targets.length < xs.length;
        room--
      ) {
        targets.push(a);
      }
    }
    if (targets.length < xs.length) return false;
  }
  xs.forEach((x, i) => {
    spawnTrainee(land, cl, x, region, targets[i], orgOf(x));
  });
  const ids = new Set(members.map((en) => en.id));
  cl.trainees = cl.trainees.filter((x) => !xs.includes(x));
  cl.training = cl.training.filter((en) => !ids.has(en.id));
  if (scattered) {
    land.message(cl.smallID, "events_display.ww1936_army_scattered", {
      count: xs.length,
    });
  }
  land.markCountry(cl.smallID);
  return true;
}
