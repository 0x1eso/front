// World War 1936 air groups (w50, /home/eser/dev/ww50-air-group-design.md): a
// player's mixed formation by template. Inside, a group is ordinary single-type
// wings (Wing.group); the group only forms and refills them to its template,
// picks each member's zone and mission by need, and keeps one base. The wings
// fly by the unchanged sortie code.
import {
  AIR_GROUP_TYPES,
  AIR_MISSIONS,
  AIR_TYPES,
  WING_AUTO_FERRY_DAYS,
  WING_NO_MISSION,
  WING_REFORM_COOLDOWN_DAYS,
  WP_BACK,
  WP_GROUND,
  WP_OUT,
  WP_REARM,
  WP_STATION,
  WW_AIR_TEMPLATE_NAME_MAX,
  WW_GROUP_MAX_ZONES,
  WW_GROUP_STEP,
  WW_MAX_AIR_TEMPLATES,
  WW_MAX_GROUP_PLANES,
  WW_MAX_KEEP_GROUPS,
  WW_MAX_WINGS,
  WW_WING_FORM_MIN,
  WW_WING_REFILL_PCT,
  WW_WING_RESERVE_MIN,
  WW_WING_RESERVE_PCT,
  type AirGroupMember,
  type AirGroupView,
  type AirGroupZone,
  type AirTemplate,
  type GroupOrder,
  type Wing,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  EQUIPMENT_GENS,
  equipKey,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  bombClassIndex,
  wingMaxPlanes,
} from "@openfront/engine-lib/ww1936/WingRules";
import { returnDesignPlanes } from "../depth/Designs";
import { returnPlanes } from "../economy/Buildings";
import { bombPickFor } from "./AiAir";
import { isCarrierWing, stockOf } from "./Deploy";
import {
  armyBattle,
  clearOrder,
  fleetZone,
  isEnemyOfSide,
  setStanding,
  sideWidthIn,
  standDownWing,
  wingStats,
  zoneTarget,
  type StandingOrder,
} from "./Sorties";
import {
  drawInto,
  ferryWing,
  homeBase,
  sideBases,
  wingFullSize,
} from "./Wings";
import { wingPlanes, type WwAir } from "./WwAir";

/** A group's engine state (the owner's wings carry its id in Wing.group). */
export interface AirGroup {
  id: number;
  owner: number;
  /** The template it keeps, 0 none. */
  tpl: number;
  /** Ordered strategic zones, at most WW_GROUP_MAX_ZONES. */
  zones: number[];
  /** One of `zones`, 0 none. */
  priority: number;
  /** The army it follows, 0 none (then `zones` is empty). */
  army: number;
  /** WW_BOMB_CLASSES index. */
  cls: number;
  /** A single bomb target region, 0 none. */
  target: number;
  auto: boolean;
  night: boolean;
  /** Its one base, 0 none. */
  base: number;
}

const M_SUP = AIR_MISSIONS.indexOf("air_superiority");
const M_INT = AIR_MISSIONS.indexOf("interception");
const M_CAS = AIR_MISSIONS.indexOf("cas");
const M_BOMB = AIR_MISSIONS.indexOf("strategic_bombing");
const M_STRIKE = AIR_MISSIONS.indexOf("naval_strike");
const M_PATROL = AIR_MISSIONS.indexOf("naval_patrol");
const M_RECON = AIR_MISSIONS.indexOf("recon");
const M_ESCORT = AIR_MISSIONS.indexOf("escort");
const GROUP_TYPE_INDEX: readonly number[] = AIR_GROUP_TYPES.map((t) =>
  AIR_TYPES.indexOf(t),
);
const T_FIGHTER = AIR_TYPES.indexOf("fighter");
const T_HEAVY = AIR_TYPES.indexOf("heavy_fighter");
const T_CAS = AIR_TYPES.indexOf("cas");
const T_BOMBER = AIR_TYPES.indexOf("bomber");
const T_STRAT = AIR_TYPES.indexOf("strat_bomber");
const T_NAVAL = AIR_TYPES.indexOf("naval_bomber");
const isFighterType = (t: number) => t === T_FIGHTER || t === T_HEAVY;
const isBomberType = (t: number) => t === T_BOMBER || t === T_STRAT;
const FLYING: ReadonlySet<number> = new Set([WP_OUT, WP_STATION, WP_BACK]);

export const groupWings = (air: WwAir, g: AirGroup): Wing[] =>
  air.wingsOf(g.owner).filter((w) => w.group === g.id);

/** The owner's groups, ascending. */
export function groupsOf(air: WwAir, owner: number): AirGroup[] {
  const out: AirGroup[] = [];
  for (const g of air.groups.values()) if (g.owner === owner) out.push(g);
  return out;
}

const landWingCount = (air: WwAir, owner: number): number => {
  let n = 0;
  for (const w of air.wingsOf(owner)) if (!isCarrierWing(w)) n++;
  return n;
};

// ---- Templates (rule 1) ----

/** air_template: saves a new template (id 0) or replaces one. */
export function issueTemplate(
  air: WwAir,
  smallID: number,
  o: Extract<GroupOrder, { kind: "air_template" }>,
): WwOrderBlock | null {
  const c = air.country(smallID);
  if (c === null) return "dead";
  const name = o.name.trim();
  if (name.length === 0 || name.length > WW_AIR_TEMPLATE_NAME_MAX) {
    return "bad_template";
  }
  if (o.planes.length !== AIR_TYPES.length) return "bad_template";
  let total = 0;
  for (let ti = 0; ti < AIR_TYPES.length; ti++) {
    const n = o.planes[ti];
    if (n % WW_GROUP_STEP !== 0) return "bad_template";
    if (n > 0 && !GROUP_TYPE_INDEX.includes(ti)) return "bad_template";
    total += n;
  }
  if (total <= 0 || total > WW_MAX_GROUP_PLANES) return "bad_template";
  if (o.keep > WW_MAX_KEEP_GROUPS) return "bad_template";
  if (o.id === 0) {
    if (c.templates.length >= WW_MAX_AIR_TEMPLATES) return "too_many_templates";
    c.templates.push({
      id: c.nextTemplateId++,
      name,
      planes: [...o.planes],
      keep: o.keep,
    });
  } else {
    const t = c.templates.find((x) => x.id === o.id);
    if (t === undefined) return "bad_index";
    t.name = name;
    t.planes = [...o.planes];
    t.keep = o.keep;
  }
  air.markCountry(smallID);
  return null;
}

/** air_template_drop: the template goes; its groups stay as plain groups. */
export function issueTemplateDrop(
  air: WwAir,
  smallID: number,
  id: number,
): WwOrderBlock | null {
  const c = air.country(smallID);
  if (c === null) return "dead";
  const at = c.templates.findIndex((x) => x.id === id);
  if (at < 0) return "bad_index";
  c.templates.splice(at, 1);
  for (const g of groupsOf(air, smallID)) if (g.tpl === id) g.tpl = 0;
  air.markCountry(smallID);
  return null;
}

// ---- Reach ----

/** Range of a type for a group: its wing's with planes, else the best generation in stock. */
function typeRange(
  air: WwAir,
  owner: number,
  ti: number,
  wings: readonly Wing[],
): number {
  for (const w of wings) {
    if (w.type === ti && wingPlanes(w) > 0) return wingStats(air, w).rangeKm;
  }
  const t = AIR_TYPES[ti];
  const ce = air.econ.country(owner);
  if (ce !== null) {
    for (let gen = EQUIPMENT_GENS[t]; gen >= 1; gen--) {
      if (ce.stock[equipKey(t, gen)] > 0) {
        return air.planeStatsOf(owner, t, gen).rangeKm;
      }
    }
  }
  return air.planeStatsOf(owner, t, 1).rangeKm;
}

/** The types the group has or wants (planes in it, else the template's). */
function typesOf(air: WwAir, g: AirGroup, wings: readonly Wing[]): number[] {
  const have = new Set<number>();
  for (const w of wings) if (wingPlanes(w) > 0) have.add(w.type);
  if (have.size === 0) {
    const t = air.country(g.owner)?.templates.find((x) => x.id === g.tpl);
    if (t !== undefined) {
      for (const ti of GROUP_TYPE_INDEX) if (t.planes[ti] > 0) have.add(ti);
    }
  }
  return [...have].sort((a, b) => a - b);
}

/** The zones the group works now: its own, or the one the followed army fights in. */
export function zonesOf(air: WwAir, g: AirGroup): number[] {
  if (g.army === 0) return g.zones;
  const a = air.land.armies.get(g.army);
  if (a === undefined) return [];
  const region = armyBattle(air, g.army) || air.land.armyRegion(a);
  const sr = region === 0 ? 0 : air.ww.scenario.regionSr(region);
  return sr === 0 ? [] : [sr];
}

const reaches = (
  air: WwAir,
  base: number,
  range: number,
  zone: number,
): boolean => {
  const t = zoneTarget(air, zone);
  return t !== 0 && air.ww.scenario.targetKm(base, t) <= range;
};

// ---- The base (rule 7) ----

function bestBase(
  air: WwAir,
  g: AirGroup,
  wings: readonly Wing[],
  zones: readonly number[],
): number {
  const sc = air.ww.scenario;
  const types = typesOf(air, g, wings);
  const ranges = types.map((ti) => typeRange(air, g.owner, ti, wings));
  const all = sideBases(air, air.land.sideOf(g.owner));
  const own = all.filter((r) => air.land.controller[r] === g.owner);
  const bases = own.length > 0 ? own : all;
  const first = zones.length > 0 ? zoneTarget(air, zones[0]) : 0;
  let best = 0;
  let bestScore = -1;
  let bestKm = 0;
  for (const b of bases) {
    let score = 0;
    for (let k = 0; k < ranges.length; k++) {
      for (const z of zones) if (reaches(air, b, ranges[k], z)) score++;
    }
    const km = first === 0 ? 0 : sc.targetKm(b, first);
    if (
      score > bestScore ||
      (score === bestScore && km < bestKm) ||
      (score === bestScore && km === bestKm && b < best)
    ) {
      best = b;
      bestScore = score;
      bestKm = km;
    }
  }
  return best;
}

function baseScore(
  air: WwAir,
  g: AirGroup,
  wings: readonly Wing[],
  zones: readonly number[],
  base: number,
): number {
  let score = 0;
  for (const ti of typesOf(air, g, wings)) {
    const range = typeRange(air, g.owner, ti, wings);
    for (const z of zones) if (reaches(air, base, range, z)) score++;
  }
  return score;
}

/**
 * Chooses the group's base for its zones and ferries the members that stand
 * elsewhere. An order moves it at once; the daily call moves it only for a
 * better reach and only members whose last ferry was WING_AUTO_FERRY_DAYS ago.
 */
function syncBase(
  air: WwAir,
  g: AirGroup,
  wings: readonly Wing[],
  tick: number,
  day: number,
  force: boolean,
): void {
  const zones = zonesOf(air, g);
  const usable = g.base > 0 && air.baseUsable(g.base);
  if (!usable) {
    const b = zones.length > 0 ? bestBase(air, g, wings, zones) : 0;
    g.base = b !== 0 ? b : homeBase(air, g.owner);
    air.markCountry(g.owner);
  } else if (zones.length > 0) {
    const best = bestBase(air, g, wings, zones);
    if (
      best !== 0 &&
      best !== g.base &&
      baseScore(air, g, wings, zones, best) >
        baseScore(air, g, wings, zones, g.base)
    ) {
      g.base = best;
      air.markCountry(g.owner);
    }
  }
  if (g.base <= 0) return;
  for (const w of wings) {
    if (w.base === g.base || isCarrierWing(w)) continue;
    if (w.phase !== WP_GROUND && w.phase !== WP_REARM) continue;
    if (
      !force &&
      w.lastFerryDay >= 0 &&
      day - w.lastFerryDay < WING_AUTO_FERRY_DAYS
    ) {
      continue;
    }
    ferryWing(air, w, g.base, tick);
  }
}

// ---- Forming and refilling (rules 2, 3) ----

const sizesFor = (want: number, max: number): number[] => {
  if (want <= 0) return [];
  const n = Math.ceil(want / max);
  const base = Math.floor(want / n);
  const extra = want - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
};

/** Planes back to the stock, the oldest generations first; returns how many. */
function releasePlanes(air: WwAir, w: Wing, n: number): number {
  const ce = air.econ.country(w.owner);
  if (ce === null || n <= 0) return 0;
  let left = n;
  const gens = new Array<number>(w.counts.length).fill(0);
  const designs = new Array<number>(w.dcounts.length).fill(0);
  for (let i = 0; i < w.counts.length && left > 0; i++) {
    const k = Math.min(left, w.counts[i]);
    gens[i] = k;
    w.counts[i] -= k;
    left -= k;
  }
  for (let s = 0; s < w.dcounts.length && left > 0; s++) {
    const k = Math.min(left, w.dcounts[s]);
    designs[s] = k;
    w.dcounts[s] -= k;
    left -= k;
  }
  returnPlanes(ce, AIR_TYPES[w.type], gens);
  returnDesignPlanes(air.ww.depth, w.owner, designs);
  air.markWing(w.id);
  return n - left;
}

/**
 * Brings the group's wings of every type to its template: unassigned wings of
 * the type join first, then new ones are drawn (above the reserve), a surplus
 * goes back to the stock at the refill pace. Returns whether the group has a wing.
 */
function reshape(
  air: WwAir,
  g: AirGroup,
  t: AirTemplate,
  day: number,
): boolean {
  const owner = g.owner;
  const ce = air.econ.country(owner);
  const c = air.country(owner);
  if (ce === null || c === null) return false;
  let count = landWingCount(air, owner);
  for (const ti of GROUP_TYPE_INDEX) {
    const type = AIR_TYPES[ti];
    const max = wingMaxPlanes(type);
    const want = t.planes[ti];
    const sizes = sizesFor(want, max);
    const members = groupWings(air, g)
      .filter((w) => w.type === ti)
      .sort((a, b) => wingPlanes(b) - wingPlanes(a) || a.id - b.id);
    // Unassigned wings of the type join before new planes are drawn.
    if (members.length < sizes.length) {
      const loose = air
        .wingsOf(owner)
        .filter(
          (w) =>
            w.group === 0 &&
            w.type === ti &&
            w.base > 0 &&
            w.volunteerFor === 0 &&
            !isCarrierWing(w),
        )
        .sort((a, b) => wingPlanes(b) - wingPlanes(a) || a.id - b.id);
      while (members.length < sizes.length && loose.length > 0) {
        const w = loose.shift()!;
        w.group = g.id;
        w.auto = g.auto;
        air.markWing(w.id);
        members.push(w);
      }
      members.sort((a, b) => wingPlanes(b) - wingPlanes(a) || a.id - b.id);
    }
    // New wings for the sizes still without one.
    if (members.length < sizes.length && g.base > 0 && day >= c.reformDay[ti]) {
      const stock = stockOf(air, ce, owner, ti);
      let inWings = 0;
      for (const w of air.wingsOf(owner)) {
        if (w.type === ti && !isCarrierWing(w) && w.volunteerFor === 0) {
          inWings += wingPlanes(w);
        }
      }
      const reserve = Math.max(
        WW_WING_RESERVE_MIN,
        Math.floor(((stock + inWings) * WW_WING_RESERVE_PCT) / 100),
      );
      let free = stock - reserve;
      while (members.length < sizes.length && count < WW_MAX_WINGS) {
        const size = sizes[members.length];
        const take = Math.min(size, free);
        if (take < Math.min(size, WW_WING_FORM_MIN)) break;
        const no = c.nextWingNo[ti];
        const w = air.addWing({
          owner,
          type: ti,
          counts: new Array<number>(EQUIPMENT_GENS[type]).fill(0),
          base: g.base,
          nameNo: no,
          auto: g.auto,
          group: g.id,
        });
        c.nextWingNo[ti] = no + 1;
        const got = drawInto(air, ce, w, take);
        free -= got;
        count++;
        members.push(w);
        if (got === 0) break;
      }
    }
    // Sizes to the members, surplus back to the stock.
    const pace = Math.max(1, Math.ceil((max * WW_WING_REFILL_PCT) / 100));
    for (let i = 0; i < members.length; i++) {
      const w = members[i];
      const size = i < sizes.length ? sizes[i] : 0;
      const fullMax = size === 0 ? 1 : size >= max ? 0 : size;
      if (w.fullMax !== fullMax) {
        w.fullMax = fullMax;
        air.markWing(w.id);
      }
      if (w.phase !== WP_GROUND && w.phase !== WP_REARM) continue;
      const planes = wingPlanes(w);
      const excess = planes - size;
      if (excess > 0) releasePlanes(air, w, Math.min(excess, pace));
      if (size === 0 && wingPlanes(w) === 0) air.removeWing(w.id, true);
    }
    // A type the template no longer holds: its remaining wings go the same way.
  }
  return groupWings(air, g).length > 0;
}

/** Disbands a group: its planes go back to the stock, and the types rest for the cooldown. */
export function disbandGroup(
  air: WwAir,
  g: AirGroup,
  day: number,
  cooldown: boolean,
): void {
  const c = air.country(g.owner);
  for (const w of groupWings(air, g)) {
    if (c !== null && cooldown) {
      c.reformDay[w.type] = Math.max(
        c.reformDay[w.type],
        day + WING_REFORM_COOLDOWN_DAYS,
      );
    }
    air.removeWing(w.id, true);
  }
  air.removeGroup(g.id);
  air.markCountry(g.owner);
}

// ---- The orders (rule 4) ----

export function issueGroupOrder(
  air: WwAir,
  smallID: number,
  o: Extract<GroupOrder, { kind: "air_group_order" }>,
  tick: number,
): WwOrderBlock | null {
  const g = air.groups.get(o.group);
  if (g === undefined || g.owner !== smallID) return "bad_index";
  const sc = air.ww.scenario;
  const land = air.land;
  if (o.zones.length > WW_GROUP_MAX_ZONES) return "bad_zone";
  if (new Set(o.zones).size !== o.zones.length) return "bad_zone";
  for (const z of o.zones) if (sc.sr(z) === undefined) return "bad_zone";
  if (o.priority !== 0 && !o.zones.includes(o.priority)) return "bad_zone";
  if (o.army !== undefined) {
    if (o.zones.length > 0) return "bad_index";
    if (land.armies.get(o.army)?.owner !== smallID) return "bad_index";
  }
  if (o.target !== undefined) {
    if (sc.region(o.target) === undefined) return "bad_region";
    if (!o.zones.includes(sc.regionSr(o.target))) return "bad_zone";
  }
  const wings = groupWings(air, g);
  // A zone no type of the group can reach from a base of its side is refused.
  const types = typesOf(air, g, wings);
  if (types.length > 0) {
    const bases = sideBases(air, land.sideOf(smallID));
    const ranges = types.map((ti) => typeRange(air, smallID, ti, wings));
    for (const z of o.zones) {
      const ok = bases.some((b) => ranges.some((r) => reaches(air, b, r, z)));
      if (!ok) return "out_of_range";
    }
  }
  g.zones = [...o.zones];
  g.priority = o.priority;
  g.army = o.army ?? 0;
  g.cls = o.cls === undefined ? 0 : bombClassIndex(o.cls);
  g.target = o.target ?? 0;
  if (o.night !== undefined) g.night = o.night;
  if (o.auto !== undefined) g.auto = o.auto;
  air.markCountry(smallID);
  const day = air.ww.day(tick);
  for (const w of wings) {
    if (w.auto !== g.auto) {
      w.auto = g.auto;
      air.markWing(w.id);
    }
  }
  if (g.auto) return null;
  const zones = zonesOf(air, g);
  if (zones.length === 0) {
    // [중지]: every member stands down (a recon order stays).
    for (const w of wings) {
      if (w.mission !== WING_NO_MISSION && w.mission !== M_RECON) {
        standDownWing(air, w, tick);
      }
    }
    return null;
  }
  syncBase(air, g, wings, tick, day, true);
  assignGroup(air, g, tick);
  return null;
}

export function issueGroupDisband(
  air: WwAir,
  smallID: number,
  group: number,
  tick: number,
): WwOrderBlock | null {
  const g = air.groups.get(group);
  if (g === undefined || g.owner !== smallID) return "bad_index";
  disbandGroup(air, g, air.ww.day(tick), true);
  return null;
}

// ---- Who does what where (rules 5, 6) ----

interface ZoneFacts {
  z: number;
  idx: number;
  sea: boolean;
  /** Some region of the zone is the enemy's, or a battle runs there. */
  enemyLand: boolean;
  /** Some region is held by an enemy of the side. */
  enemyHeld: boolean;
  fights: number;
  need: number;
}

function zoneFacts(air: WwAir, side: number, z: number): ZoneFacts | null {
  const sc = air.ww.scenario;
  const land = air.land;
  const s = sc.sr(z);
  if (s === undefined) return null;
  const sea = s.kind === "sea";
  let enemyHeld = false;
  let contested = false;
  let fights = 0;
  if (!sea) {
    for (const r of s.members) {
      if (isEnemyOfSide(air, side, land.controller[r] ?? 0)) enemyHeld = true;
      if (land.battles.has(r)) {
        contested = true;
        if (sideWidthIn(air, r, side) > 0) fights++;
      }
    }
  }
  const zs = air.zoneState[s.idx];
  const ours = zs.sup.get(side) ?? 0;
  const theirs = zs.enemySup.get(side) ?? 0;
  const lost = Math.max(0, theirs - ours);
  let enemyAir = false;
  for (const [k, row] of zs.sorties) {
    if (k === side) continue;
    for (const n of row) {
      if (n > 0) enemyAir = true;
    }
  }
  const need =
    Math.min(fights, 3) * 100 + Math.floor(lost / 10) + (enemyAir ? 50 : 0);
  return {
    z,
    idx: s.idx,
    sea,
    enemyLand: enemyHeld || contested,
    enemyHeld,
    fights,
    need,
  };
}

interface Option {
  order: StandingOrder;
  need: number;
}

const standing = (
  mission: number,
  sr: number,
  extra: Partial<StandingOrder> = {},
): StandingOrder => ({
  mission,
  sr,
  target: 0,
  follow: 0,
  escortOf: 0,
  cls: 0,
  ...extra,
});

/** What a wing of type `ti` does in a zone, null when it waits. */
function optionIn(
  air: WwAir,
  g: AirGroup,
  w: Wing,
  zf: ZoneFacts,
  side: number,
): Option | null {
  const ti = w.type;
  const sc = air.ww.scenario;
  if (g.army !== 0) {
    const a = air.land.armies.get(g.army);
    if (a === undefined) return null;
    if (isFighterType(ti))
      return { order: standing(M_SUP, zf.z), need: zf.need };
    if (ti === T_CAS) {
      const sr = sc.regionSr(air.land.armyRegion(a));
      return {
        order: standing(M_CAS, sr === 0 ? zf.z : sr, { follow: g.army }),
        need: zf.need,
      };
    }
    return null;
  }
  if (isFighterType(ti)) {
    if (zf.sea || zf.enemyLand) {
      return { order: standing(M_SUP, zf.z), need: zf.need };
    }
    return { order: standing(M_INT, zf.z), need: zf.need > 0 ? zf.need : 5 };
  }
  if (ti === T_CAS) {
    if (zf.sea) return null;
    return {
      order: standing(M_CAS, zf.z),
      need: zf.fights > 0 ? zf.need : 5,
    };
  }
  if (isBomberType(ti)) {
    if (zf.sea || !zf.enemyHeld) return null;
    let target = 0;
    let cls = g.cls;
    let need = 10;
    if (g.target !== 0 && sc.regionSr(g.target) === zf.z) {
      target = g.target;
    } else if (g.cls === 0) {
      const pick = bombPickFor(air, g.owner, zf.idx);
      if (pick !== null) {
        target = pick.region;
        cls = bombClassIndex(pick.cls);
        need = 30;
      }
    }
    return { order: standing(M_BOMB, zf.z, { target, cls }), need };
  }
  if (ti === T_NAVAL) {
    if (!zf.sea) return null;
    const s = sc.sr(zf.z)!;
    return fleetZone(air, s, side, 0) !== 0
      ? { order: standing(M_STRIKE, zf.z), need: 100 + zf.need }
      : { order: standing(M_PATROL, zf.z), need: 5 };
  }
  return null;
}

const PASS_ORDER = (t: number) =>
  isBomberType(t) ? 0 : isFighterType(t) ? 2 : 1;

/**
 * Gives the group's grounded members their zone and mission: by need, the
 * priority zone double, spread by the planes already sent there. A wing in
 * flight finishes its sortie; one with no work in range waits.
 */
export function assignGroup(air: WwAir, g: AirGroup, tick: number): void {
  if (g.auto) return;
  const sc = air.ww.scenario;
  const zones = zonesOf(air, g);
  const wings = groupWings(air, g).sort((a, b) => a.id - b.id);
  if (wings.length === 0) return;
  const side = air.land.sideOf(g.owner);
  const facts = new Map<number, ZoneFacts>();
  for (const z of zones) {
    const f = zoneFacts(air, side, z);
    if (f !== null) facts.set(z, f);
  }
  const load = new Map<number, number>();
  const bombers = new Map<number, Wing[]>();
  for (const w of wings) {
    const n = wingPlanes(w);
    if (FLYING.has(w.phase) && facts.has(w.flySr)) {
      load.set(w.flySr, (load.get(w.flySr) ?? 0) + n);
    }
    if (w.mission === M_BOMB && facts.has(w.sr)) {
      const l = bombers.get(w.sr) ?? [];
      l.push(w);
      bombers.set(w.sr, l);
    }
  }
  const fighterIdx = new Map<number, number>();
  const order = [...wings].sort(
    (a, b) => PASS_ORDER(a.type) - PASS_ORDER(b.type) || a.id - b.id,
  );
  for (const w of order) {
    if (w.base <= 0 || isCarrierWing(w)) continue;
    if (FLYING.has(w.phase) || w.auto || w.mission === M_RECON) continue;
    if (zones.length === 0) continue;
    const range = wingStats(air, w).rangeKm;
    let best: Option | null = null;
    let bestScore = -1;
    for (const z of zones) {
      const zf = facts.get(z);
      if (zf === undefined || !reaches(air, w.base, range, z)) continue;
      const opt = optionIn(air, g, w, zf, side);
      if (opt === null) continue;
      const weight = g.priority === z ? 2 : 1;
      const score = Math.floor(
        ((opt.need + 10) * weight * 1000) / (1000 + 8 * (load.get(z) ?? 0)),
      );
      if (score > bestScore) {
        best = opt;
        bestScore = score;
      }
    }
    if (best === null) {
      if (w.mission !== WING_NO_MISSION) clearOrder(air, w);
      continue;
    }
    const o = best.order;
    // About half of the fighters over a zone with the group's bombers escort them.
    if (isFighterType(w.type) && o.mission === M_SUP) {
      const list = bombers.get(o.sr);
      const k = fighterIdx.get(o.sr) ?? 0;
      fighterIdx.set(o.sr, k + 1);
      if (list !== undefined && list.length > 0 && k % 2 === 1) {
        const b = list[Math.floor(k / 2) % list.length];
        const at = b.target !== 0 ? b.target : zoneTarget(air, o.sr);
        if (at !== 0 && sc.targetKm(w.base, at) <= range) {
          o.mission = M_ESCORT;
          o.escortOf = b.id;
        }
      }
    }
    setStanding(air, w, o, tick);
    if (o.mission === M_BOMB && w.night !== g.night) {
      w.night = g.night;
      air.markWing(w.id);
    }
    if (o.mission === M_BOMB) {
      const l = bombers.get(o.sr) ?? [];
      if (!l.includes(w)) l.push(w);
      bombers.set(o.sr, l);
    }
    load.set(o.sr, (load.get(o.sr) ?? 0) + wingPlanes(w));
  }
}

// ---- The day ----

/**
 * A country's group day (WwAir calls it before the wings' refills): the
 * keep-N counts, forming and shaping to the templates, then each group's base
 * and members' zones.
 */
export function dailyGroups(air: WwAir, owner: number, day: number): void {
  const c = air.country(owner);
  if (c === null) return;
  const tick = air.mg.ticks();
  let mine = groupsOf(air, owner);
  if (c.templates.length === 0 && mine.length === 0) return;
  for (const g of mine) {
    if (g.tpl !== 0 && !c.templates.some((t) => t.id === g.tpl)) g.tpl = 0;
    if (g.tpl === 0 && groupWings(air, g).length === 0) air.removeGroup(g.id);
  }
  mine = groupsOf(air, owner);
  for (const t of c.templates) {
    const gs = mine.filter((g) => g.tpl === t.id);
    if (gs.length > t.keep) {
      // Surplus groups go back to the stock, one a day.
      let drop = gs[gs.length - 1];
      let least = Number.MAX_SAFE_INTEGER;
      for (const g of gs) {
        let n = 0;
        for (const w of groupWings(air, g)) n += wingPlanes(w);
        if (n <= least) {
          least = n;
          drop = g;
        }
      }
      disbandGroup(air, drop, day, false);
      continue;
    }
    for (let k = gs.length; k < t.keep; k++) {
      const base = homeBase(air, owner);
      if (base === 0) break;
      const g: AirGroup = {
        id: air.nextGroupId,
        owner,
        tpl: t.id,
        zones: [],
        priority: 0,
        army: 0,
        cls: 0,
        target: 0,
        auto: false,
        night: false,
        base,
      };
      air.groups.set(g.id, g);
      if (reshape(air, g, t, day)) {
        air.nextGroupId++;
        air.markCountry(owner);
      } else {
        air.groups.delete(g.id);
        break;
      }
    }
  }
  for (const g of groupsOf(air, owner)) {
    const t = c.templates.find((x) => x.id === g.tpl);
    if (t !== undefined) reshape(air, g, t, day);
    const wings = groupWings(air, g);
    if (wings.length === 0) continue;
    syncBase(air, g, wings, tick, day, false);
    assignGroup(air, g, tick);
  }
}

// ---- What the owner's screens read ----

/** The owner's groups in full (CountryAirDetail.groups). */
export function groupViews(air: WwAir, owner: number): AirGroupView[] {
  const c = air.country(owner);
  const out: AirGroupView[] = [];
  if (c === null) return out;
  const sc = air.ww.scenario;
  const side = air.land.sideOf(owner);
  const ty = AIR_TYPES.length;
  for (const g of groupsOf(air, owner)) {
    const t = c.templates.find((x) => x.id === g.tpl);
    const wings = groupWings(air, g);
    const planes = new Array<number>(ty).fill(0);
    const rangeKm = new Array<number>(ty).fill(0);
    const members: AirGroupMember[] = wings.map((w) => {
      const n = wingPlanes(w);
      planes[w.type] += n;
      if (n > 0 && rangeKm[w.type] === 0) {
        rangeKm[w.type] = wingStats(air, w).rangeKm;
      }
      return {
        wing: w.id,
        type: w.type,
        planes: n,
        full: wingFullSize(w),
        phase: w.phase,
        until: w.until,
        flySr: w.flySr,
        flyMission: w.flyMission,
        sr: w.sr,
        mission: w.mission,
        kills: w.prevKills,
        lost: w.prevLost,
        auto: w.auto,
      };
    });
    const zoneInfo: AirGroupZone[] = [];
    for (const z of zonesOf(air, g)) {
      const i = sc.srIdxOf(z);
      if (i < 0) continue;
      let zp = 0;
      let reachMask = 0;
      for (const w of wings) {
        const n = wingPlanes(w);
        if (FLYING.has(w.phase) ? w.flySr === z : w.sr === z) zp += n;
        if (n > 0 && g.base > 0 && reaches(air, g.base, rangeKm[w.type], z)) {
          reachMask |= 1 << w.type;
        }
      }
      zoneInfo.push({
        sr: z,
        planes: zp,
        supPm: air.zoneState[i].sup.get(side) ?? 0,
        enemySupPm: air.zoneState[i].enemySup.get(side) ?? 0,
        reachMask,
      });
    }
    out.push({
      id: g.id,
      tpl: g.tpl,
      name: t?.name ?? "",
      zones: [...g.zones],
      priority: g.priority,
      army: g.army,
      cls: g.cls,
      target: g.target,
      auto: g.auto,
      night: g.night,
      base: g.base,
      planes,
      want: t === undefined ? [] : [...t.planes],
      rangeKm,
      members,
      zoneInfo,
    });
  }
  return out;
}
