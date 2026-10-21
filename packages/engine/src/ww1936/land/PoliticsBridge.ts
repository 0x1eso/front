// World War 1936 P3: what politics asks of the land war (P3 spec §16.3,
// §17; plan decisions 18, 19; controller ruling R14). The generals'
// functions are the foundation's.
import {
  MOVE_SEA,
  type TemplateDef,
  WW_MAX_TEMPLATES,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  GeneralDef,
  GENERALS,
  generalServes,
} from "@openfront/engine-lib/ww1936/Generals";
import { returnDivisionEquip } from "../economy/Stock";
import { dmzRegions } from "../politics/Spirits";
import { closeBattle, leaveBattle } from "./Battles";
import { stopDivision } from "./Movement";
import { disbandDivision } from "./Sustain";
import {
  type Army,
  type CountryLand,
  type LandTemplate,
  SPREAD_CAPITULATION,
  type WwLand,
} from "./WwLand";

/**
 * Plan decision 18 (Review Focus 3): control and the victory-point tile
 * move this tick; the other tiles follow by P2's capitulation spread (the
 * 2,000-tile budget), from `to`'s neighbouring regions inward. Controller
 * ruling R14: with no neighbouring region of `to` (an island), every tile
 * goes at once. A player losing its last tile so is conquered by `to`.
 */
export function transferRegionPeaceful(
  land: WwLand,
  region: number,
  to: number,
  tick: number,
): void {
  if (land.controller[region] === to) return;
  const p = land.mg.playerBySmallID(to);
  if (!p.isPlayer()) return;
  const sources = land.scenario
    .edgesOf(region)
    .map((e) => e.to)
    .filter((n) => land.controller[n] === to)
    .sort((a, b) => a - b);
  land.setController(region, to, tick, false);
  closeBattle(land, region);
  land.spreadOrders.delete(region);
  if (sources.length === 0) {
    land.spreads.delete(region);
    const mg = land.mg;
    const map = mg.map();
    for (const t of land.scenario.regionTiles(region)) {
      if (!map.isLand(t) || map.isImpassable(t)) continue;
      const prev = mg.owner(t);
      if (prev.isPlayer() && prev.smallID() === to) continue;
      p.conquer(t);
      if (prev.isPlayer() && !prev.isAlive()) mg.conquerPlayer(p, prev);
    }
    return;
  }
  land.setSpread({
    region,
    by: to,
    kind: SPREAD_CAPITULATION,
    sources,
    done: 0,
    dayBase: 0,
    dayNo: -1,
  });
}

/**
 * The first region (land edges breadth-first, ascending) from `from` whose
 * controller passes `ok`; 0 when none.
 */
function nearest(
  land: WwLand,
  from: number,
  ok: (controller: number) => boolean,
): number {
  const sc = land.scenario;
  const seen = new Set<number>([from]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const r of frontier) {
      for (const e of sc.edgesOf(r)) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        if (ok(land.controller[e.to])) return e.to;
        next.push(e.to);
      }
    }
    frontier = next;
  }
  return 0;
}

/**
 * Where a division of `owner` that has no reachable region of its own (or
 * its side's) goes (HOI4: home to the capital; controller ruling, lane D
 * fix 1): the capital's region when `owner` controls it, else its
 * lowest-numbered region; 0 (disband) when it controls none.
 */
function capitalOf(land: WwLand, owner: number): number {
  const sc = land.scenario;
  // P5: a woken dormant slot's capital is its best region.
  const cap = land.ww.capitalRegion(owner);
  if (sc.region(cap) !== undefined && land.controller[cap] === owner) {
    return cap;
  }
  for (const r of sc.landRegions) {
    if (land.controller[r.id] === owner) return r.id;
  }
  return 0;
}

/** The nearest region passing `ok` from `from`, else the owner's capital (0: none). */
function homeOf(
  land: WwLand,
  owner: number,
  from: number,
  ok: (controller: number) => boolean,
): number {
  const n = nearest(land, from, ok);
  return n !== 0 ? n : capitalOf(land, owner);
}

/** Puts a division down in `to` at once (no path, no battle); to 0: disbanded. */
function teleport(land: WwLand, row: number, to: number): void {
  if (to === 0) {
    disbandDivision(land, row);
    return;
  }
  leaveBattle(land, row);
  stopDivision(land, row);
  land.setDivisionRegion(row, to);
  land.divisions.dest[row] = to;
  land.markArmy(land.divisions.army[row]);
}

/**
 * Spec §17.3: `owner`'s divisions in `region` go to its nearest region of
 * its own, else its capital (disbanded — men and equipment back — when it
 * controls nothing).
 */
export function evictDivisions(
  land: WwLand,
  region: number,
  owner: number,
): void {
  const t = land.divisions;
  for (const r of [...land.rowsIn(region)]) {
    if (t.id[r] === 0 || t.owner[r] !== owner || t.mode[r] === MOVE_SEA) {
      continue;
    }
    teleport(
      land,
      r,
      homeOf(land, owner, region, (c) => c === owner),
    );
  }
}

/**
 * Spec §16.3, §17.4: `owner`'s divisions on regions `from` controls go to
 * the nearest region of their side, breadth-first (not P2's path), at once.
 */
export function evictArmies(land: WwLand, owner: number, from: number): void {
  const t = land.divisions;
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0 || t.owner[r] !== owner || t.mode[r] === MOVE_SEA) {
      continue;
    }
    const at = t.region[r];
    if (land.controller[at] !== from) continue;
    teleport(
      land,
      r,
      homeOf(land, owner, at, (c) => land.sameSide(owner, c)),
    );
  }
}

/**
 * Controller ruling R14: the day's sweep. A division standing on someone
 * else's region it may no longer enter (access revoked, a faction left, a
 * peace) goes to its side's nearest region.
 */
export function sweepRefused(land: WwLand): void {
  const t = land.divisions;
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0 || t.mode[r] === MOVE_SEA) continue;
    const owner = t.owner[r];
    const at = t.region[r];
    const c = land.controller[at];
    if (c === 0 || c === owner || land.canEnter(owner, at)) continue;
    // P5 lane A (controller ruling): a volunteer stands where its host's
    // side may (P5 spec §12.2); the volunteers' own day sends it home.
    const army = land.armies.get(t.army[r]);
    if (
      army !== undefined &&
      army.volunteerFor > 0 &&
      land.canArmyEnter(army, at)
    ) {
      continue;
    }
    teleport(
      land,
      r,
      homeOf(land, owner, at, (x) => land.sameSide(owner, x)),
    );
  }
}

/** Spec §17.4: every battle with `a` on one side and `b` on the other ends (P2 closeBattle). */
export function endBattlesBetween(land: WwLand, a: number, b: number): void {
  const t = land.divisions;
  const ownersOf = (ids: readonly number[]) =>
    ids.map((id) => {
      const r = t.rowOf(id);
      return r < 0 ? 0 : t.owner[r];
    });
  for (const [region, bt] of [...land.battles]) {
    const att = [bt.attLead, ...ownersOf(bt.attackers)];
    const def = [bt.defLead, ...ownersOf(bt.defenders)];
    if (
      (att.includes(a) && def.includes(b)) ||
      (att.includes(b) && def.includes(a))
    ) {
      closeBattle(land, region);
    }
  }
}

function sameComposition(x: TemplateDef, y: TemplateDef): boolean {
  const eq = (p: readonly string[], q: readonly string[]) =>
    p.length === q.length && [...p].sort().join() === [...q].sort().join();
  return eq(x.battalions, y.battalions) && eq(x.support, y.support);
}

/** Battalions and support companies one template has and the other lacks. */
function difference(x: TemplateDef, y: TemplateDef): number {
  const diff = (p: readonly string[], q: readonly string[]) => {
    const left = [...q];
    let n = 0;
    for (const v of p) {
      const i = left.indexOf(v);
      if (i < 0) n++;
      else left.splice(i, 1);
    }
    return n + left.length;
  };
  return diff(x.battalions, y.battalions) + diff(x.support, y.support);
}

/**
 * Spec §17.2-2: `to`'s template for a division of `from`'s template: the
 * same name, the same make-up, a copy (while `to` has fewer than
 * WW_MAX_TEMPLATES), else the most alike (ties: smaller id).
 */
function templateFor(cl: CountryLand, src: LandTemplate): number {
  const name = (x: LandTemplate) =>
    x.key !== "" ? `k:${x.key}` : `n:${x.def.name}`;
  const named = cl.templates.find((x) => name(x) === name(src));
  if (named !== undefined) return named.id;
  const same = cl.templates.find((x) => sameComposition(x.def, src.def));
  if (same !== undefined) return same.id;
  if (cl.templates.length < WW_MAX_TEMPLATES) {
    const id = cl.nextTemplateId++;
    cl.templates.push({
      id,
      key: src.key,
      def: {
        name: src.def.name,
        battalions: [...src.def.battalions],
        support: [...src.def.support],
      },
    });
    return id;
  }
  let best = cl.templates[0];
  let bestD = Infinity;
  for (const x of cl.templates) {
    const d = difference(x.def, src.def);
    if (d < bestD || (d === bestD && x.id < best.id)) {
      best = x;
      bestD = d;
    }
  }
  return best.id;
}

/**
 * Spec §17.2-2: `from`'s forces go to `to`. "transfer": each army becomes
 * a new army of `to` (its next army number; the general stays behind),
 * the divisions on `to`'s templates. "disband": men to `to`'s pool,
 * equipment to its stock. Men and equipment in training go back to `to`
 * either way.
 */
export function transferCountryUnits(
  land: WwLand,
  from: number,
  to: number,
  mode: "transfer" | "disband",
): void {
  const src = land.country(from);
  const dst = land.country(to);
  const toCe = land.econ.country(to);
  if (src === null || dst === null || toCe === null || from === to) return;
  const t = land.divisions;
  if (mode === "disband") {
    for (let r = 0; r < t.rows; r++) {
      if (t.id[r] === 0 || t.owner[r] !== from) continue;
      returnDivisionEquip(toCe, t.equipOf(r), t.men[r]);
      land.killDivision(r, false);
    }
  } else {
    const tplMap = new Map<number, number>();
    const armies = land.armiesOf(from).sort((a, b) => a.id - b.id);
    for (const a of armies) transferArmyTo(land, a, to, tplMap);
  }
  for (const x of src.trainees) returnDivisionEquip(toCe, x.equip, x.men);
  src.training = [];
  src.trainees = [];
  for (const g of src.generals) g.army = 0;
  for (const a of land.armiesOf(from)) land.removeArmy(a.id);
  land.markCountry(from);
  land.markCountry(to);
}

/** P3 spec §9.2 {dmz}: `smallID`'s armies may not enter its demilitarised regions. */
export function dmzBlocks(
  land: WwLand,
  smallID: number,
  region: number,
): boolean {
  return dmzRegions(land.ww.politics, smallID).includes(region);
}

/** Spec §1.4 (purges): the general leaves its army and serves nowhere until restored. */
export function removeGeneral(land: WwLand, id: string): void {
  land.ww.politics.removedGenerals.add(id);
  const n = GENERALS.findIndex((g) => g.id === id) + 1;
  if (n === 0) return;
  for (const cl of land.countries()) {
    const g = cl.generals.find((x) => x.id === n);
    if (g === undefined || g.army === 0) continue;
    const a = land.armies.get(g.army);
    if (a !== undefined) {
      a.general = 0;
      land.markArmy(a.id);
    }
    g.army = 0;
    land.markCountry(cl.smallID);
  }
}

export function restoreGeneral(land: WwLand, id: string): void {
  land.ww.politics.removedGenerals.delete(id);
}

/** Plan decision 19: P2 dates, not purged, not an advisor right now. */
export function generalAvailable(
  land: WwLand,
  def: GeneralDef,
  day: number,
): boolean {
  const pol = land.ww.politics;
  return (
    generalServes(def, day) &&
    !pol.generalRemoved(def.id) &&
    !pol.advisorHolds(def.id)
  );
}

/**
 * P5 (pre-flight §A X × C): army `a` becomes a new army of `to` (its next
 * army number; at the army limit, `to`'s first army; none: disbanded into
 * `to`'s pool and stock), its divisions on `to`'s templates of the same
 * name or a copy. `tplMap` caches the template choice across armies of
 * one transfer (transferCountryUnits). The emptied army goes.
 */
export function transferArmyTo(
  land: WwLand,
  a: Army,
  to: number,
  tplMap = new Map<number, number>(),
): Army | null {
  const dest: Army | null =
    land.newArmy(to) ??
    land.armiesOf(to).sort((x, y) => x.id - y.id)[0] ??
    null;
  moveDivisions(land, a.owner, [...a.divisions], to, dest, tplMap);
  return dest;
}

/**
 * P5: divisions `ids` (of one owner) go to `to` as one new army (its next
 * army number, or `armyNameNo` when given and free); the civil war's and
 * the exile's split. The new army, or null when `to` is at its army limit
 * (the divisions then join its first army, or are disbanded).
 */
export function transferDivisionsTo(
  land: WwLand,
  ids: readonly number[],
  to: number,
  armyNameNo?: number,
): Army | null {
  const t = land.divisions;
  const rows = ids.map((id) => t.rowOf(id)).filter((r) => r >= 0);
  if (rows.length === 0) return null;
  const from = t.owner[rows[0]];
  const made = land.newArmy(to);
  if (made !== null && armyNameNo !== undefined) {
    const taken = land.armiesOf(to).some((x) => x.nameNo === armyNameNo);
    if (!taken) made.nameNo = armyNameNo;
  }
  const dest = made ?? land.armiesOf(to).sort((x, y) => x.id - y.id)[0] ?? null;
  moveDivisions(land, from, ids, to, dest, new Map());
  return made;
}

function moveDivisions(
  land: WwLand,
  from: number,
  ids: readonly number[],
  to: number,
  dest: Army | null,
  tplMap: Map<number, number>,
): void {
  const src = land.country(from);
  const dst = land.country(to);
  const toCe = land.econ.country(to);
  if (src === null || dst === null || toCe === null) return;
  const t = land.divisions;
  for (const id of [...ids].sort((x, y) => x - y)) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    if (dest === null) {
      returnDivisionEquip(toCe, t.equipOf(r), t.men[r]);
      land.killDivision(r, false);
      continue;
    }
    let tpl = tplMap.get(t.template[r]);
    if (tpl === undefined) {
      const st = src.template(t.template[r]);
      tpl = st === null ? (dst.templates[0]?.id ?? 0) : templateFor(dst, st);
      tplMap.set(t.template[r], tpl);
    }
    leaveBattle(land, r);
    stopDivision(land, r);
    land.moveToArmy(id, dest);
    land.setOwner(r, to);
    t.front[r] = 0;
    land.setTemplate(r, tpl);
  }
}
