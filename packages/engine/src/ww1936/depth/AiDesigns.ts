// P6 lane E (plan Task 3): the AI's designs (spec §19.1, §19.3). On the
// AI's design days (every day at war, every 10 days at peace) it keeps a
// tank design of its newest light chassis (until it has medium tanks) and
// medium chassis, a tank destroyer from 1940 and a heavy tank from 1942
// when it is an aggressor major (the Soviet Union stays with medium
// tanks), and a ship design for every hull its naval lines build. A design
// comes from K5's AI_DESIGN_PRESETS (else the recommended fit), the
// modules it has not researched left at the base fitting; once a year a
// newly opened module brings a reworked design. Tank lines move to the
// newest design of their group near their efficiency cap, one a design
// day; naval lines launch the newest design of their hull. An armoured
// template takes a tank-destroyer battalion, or a heavy one, once the
// stock holds their equipment.
//
// Plane designs stay the players' for now: P4's deployments and decks do
// not draw design planes yet (T1b), so the AI keeps its static types.
import type {
  AiDesignPreset,
  DesignDef,
  TankRole,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_TYPES,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  NG_HEAVY,
  NG_TD,
  WW_MAX_BATTALIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  designBlock,
  designNeedGroup,
  designXpCost,
  projectBit,
  recommendedShip,
  recommendedTank,
  SHIP_CLASS_SLOTS,
  SHIP_MODULE_DEFS,
  shipBase,
  TANK_BASE_DEFS,
  TANK_MODULE_DEFS,
  tankRole,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { effCapBp } from "@openfront/engine-lib/ww1936/EconomyRules";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { aiPersonality } from "../economy/AiEconomy";
import { changeLine } from "../economy/Production";
import type { CountryEconomy } from "../economy/WwEconomy";
import {
  DESIGN_DOMAIN,
  navalLineDesignBlock,
  presetName,
  sameDesign,
  saveDesign,
} from "./Designs";
import { treatyEscalated, treatyMember } from "./NavalTreaty";
import type { DesignSlot, WwDepth } from "./WwDepth";

/** Spec §19.3: aggressor majors field a tank destroyer line from this day. */
export const AI_TD_DAY = dayOfDate("1940-01-01");
/** Spec §19.3: … and a heavy tank line from this day. */
export const AI_HEAVY_DAY = dayOfDate("1942-01-01");
/** Spec §19.3: a snorkel on the AI's submarines from this day. */
export const AI_SNORKEL_DAY = dayOfDate("1944-01-01");
/** Spec §19.3: a reworked design (new modules) at most once a year a base. */
export const AI_REDESIGN_DAYS = 365;
/** The AI moves a line within this much of its efficiency cap (P1 R6.7's rule). */
const NEAR_CAP_BP = 500;

const LIGHT_BASES = ["light_2", "light_1"] as const;
const MEDIUM_BASES = ["modern_1", "medium_3", "medium_2", "medium_1"] as const;
const HEAVY_BASES = ["super_heavy_1", "heavy_3", "heavy_2", "heavy_1"] as const;

export function aiDesignsDay(d: WwDepth, id: number, day: number): void {
  // Spec §19.1 / plan decision 39: every day at war, every 10 days at peace.
  const atWar = d.ww.enemiesOf(id).length > 0;
  if (!atWar && day % 10 !== id % 10) return;
  const ce = d.ww.economy.country(id);
  if (ce === null || d.country(id) === null) return;
  aiTankDesigns(d, id, ce, day);
  aiTankLines(d, id, ce);
  aiRoleTemplates(d, id, ce, day);
  aiShipDesigns(d, id, ce, day);
}

/** The newest chassis of a list the country has researched; null without one. */
function newestBase(
  techs: ReadonlySet<WwTechId>,
  bases: readonly string[],
): string | null {
  for (const b of bases) if (techs.has(TANK_BASE_DEFS[b].tech)) return b;
  return null;
}

/** Spec §19.3: an aggressor major (the Soviet Union aside: medium tanks first). */
function roleMajor(d: WwDepth, id: number, ce: CountryEconomy): boolean {
  const tag = d.ww.tagOf(id);
  return (
    ce.major &&
    (tag !== "SUN" || !historical(d)) &&
    aiPersonality(tag) === "aggressor"
  );
}

/**
 * The historical AI (the lobby's historicalAi): the spec's country rules
 * and K5's country presets. Off, the AI goes by its personality alone
 * (review E10; the owner's rule: history is flavour).
 */
function historical(d: WwDepth): boolean {
  // From V-J Day the free AI's designs (Pace).
  return d.ww.historicalAiNow();
}

/** The (base, role) pairs the AI keeps a tank design of. */
function wantedTanks(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  day: number,
): [string, TankRole][] {
  const techs = ce.researched;
  const out: [string, TankRole][] = [];
  const medium = newestBase(techs, MEDIUM_BASES);
  const light = newestBase(techs, LIGHT_BASES);
  if (medium === null && light !== null) out.push([light, "tank"]);
  if (medium !== null) out.push([medium, "tank"]);
  if (roleMajor(d, id, ce)) {
    if (day >= AI_TD_DAY && medium !== null) {
      out.push([medium, "tank_destroyer"]);
    }
    const heavy = newestBase(techs, HEAVY_BASES);
    if (day >= AI_HEAVY_DAY && heavy !== null) out.push([heavy, "tank"]);
  }
  return out;
}

/**
 * K5's preset for the base (and role or hull): one naming the country
 * before a general one, the latest `from` that has come; null without one.
 */
function presetFor(
  d: WwDepth,
  id: number,
  base: string,
  day: number,
  ok: (def: AiDesignPreset["def"]) => boolean,
): AiDesignPreset | null {
  const tag = d.ww.tagOf(id);
  const hist = historical(d);
  let best: AiDesignPreset | null = null;
  let bestScore = -1;
  for (const p of d.ww.politics.content.aiDesignPresets) {
    if (p.def.base !== base || !ok(p.def)) continue;
    // A country's own preset is the historical AI's only.
    if (p.tags !== undefined && (!hist || !p.tags.includes(tag))) continue;
    const from = p.from === undefined ? 0 : dayOfDate(p.from);
    if (from > day) continue;
    const score = (p.tags !== undefined ? 100_000 : 0) + Math.max(0, from);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/** K5's note: a module the country has not researched yet goes back to the base fitting (""). */
function withoutLocked(
  def: DesignDef,
  techs: ReadonlySet<WwTechId>,
  projects: number,
): DesignDef {
  const has = (
    t?: WwTechId,
    p?: (typeof SHIP_MODULE_DEFS)[string]["project"],
  ) =>
    (t === undefined || techs.has(t)) &&
    (p === undefined || (projects & projectBit(p)) !== 0);
  const modules = def.modules.map((m) => {
    if (m === "") return m;
    if (def.kind === "tank") return has(TANK_MODULE_DEFS[m]?.tech) ? m : "";
    const s = SHIP_MODULE_DEFS[m];
    return s !== undefined && has(s.tech, s.project) ? m : "";
  });
  return { ...def, modules };
}

/** The AI's fit of a tank (base, role): the preset or the recommended fit, locked modules at the base fitting. */
function tankFit(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  base: string,
  role: TankRole,
  day: number,
): DesignDef {
  const p = presetFor(
    d,
    id,
    base,
    day,
    (def) => def.kind === "tank" && tankRole({ ...def, name: "" }) === role,
  );
  const raw: DesignDef =
    p !== null
      ? { ...p.def, name: presetName(p.id) }
      : {
          ...recommendedTank(base, ce.researched, role),
          name: presetName(`rec_${roleTag(role)}${base}`),
        };
  return withoutLocked(raw, ce.researched, d.country(id)?.proj.done ?? 0);
}

function roleTag(role: TankRole): string {
  return role === "tank"
    ? ""
    : role === "tank_destroyer"
      ? "td_"
      : role === "sp_artillery"
        ? "spa_"
        : "spaa_";
}

/** The country's own designs of a kind with (slot, def), the usable ones (own or licensed, not obsolete). */
function usable(
  d: WwDepth,
  id: number,
  kind: "tank" | "ship",
): [number, DesignSlot][] {
  const out: [number, DesignSlot][] = [];
  d.country(id)?.des[kind].forEach((s, i) => {
    if (s === null || s.obsolete) return;
    if (s.origin === "own" || s.origin === "licensed") out.push([i + 1, s]);
  });
  return out;
}

/** Saves an AI design when the experience allows; the slot, or 0. */
function aiSave(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  def: DesignDef,
  before: DesignDef | null,
  day: number,
): number {
  const c = d.country(id)!;
  if (
    designBlock(def, {
      techs: ce.researched,
      projects: c.proj.done,
      treatyMember: treatyMember(d, id),
      treatyEscalated: treatyEscalated(d),
    }) !== null
  ) {
    return 0;
  }
  if (c.des[def.kind].indexOf(null) < 0) return 0;
  if (!d.spendXp(id, DESIGN_DOMAIN[def.kind], designXpCost(before, def))) {
    return 0;
  }
  const s = saveDesign(d, id, def, 0, "own", 0, 0, day);
  return typeof s === "number" ? s : 0;
}

/**
 * Spec §19.3: a design of every wanted (base, role) — saved the design
 * day its chassis tech is there (when the experience allows) — and a
 * reworked one once a year when a newly opened module changes the fit.
 * A design no line builds that a newer one of its group replaced goes
 * obsolete (its slot frees once nothing holds it).
 */
function aiTankDesigns(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  day: number,
): void {
  for (const [base, role] of wantedTanks(d, id, ce, day)) {
    const fit = tankFit(d, id, ce, base, role, day);
    // A role module not researched yet: no design of that role today.
    if (fit.kind !== "tank" || tankRole(fit) !== role) continue;
    let latest: DesignSlot | null = null;
    for (const [, s] of usable(d, id, "tank")) {
      if (s.def.base !== base || tankRole(s.def) !== role) continue;
      if (latest === null || s.savedDay >= latest.savedDay) latest = s;
    }
    if (latest === null) {
      aiSave(d, id, ce, fit, null, day);
    } else if (
      day - latest.savedDay >= AI_REDESIGN_DAYS &&
      !sameDesign(latest.def, fit)
    ) {
      aiSave(d, id, ce, fit, latest.def, day);
    }
  }
  const newest = newestOfGroups(d, id);
  const c = d.country(id)!;
  c.des.tank.forEach((s, i) => {
    if (s === null || s.obsolete || s.origin !== "own") return;
    const g = groupKey(s.def);
    if (newest.get(g) === i + 1) return;
    const key = equipKey("tank_design", i + 1);
    if (ce.lines.some((l) => l.key === key)) return;
    s.obsolete = true;
    d.markDesign(id, "tank", i + 1);
  });
}

/** The line group of a tank design: its need group (light, medium, heavy, tank destroyer…). */
function groupKey(def: DesignDef): number {
  return designNeedGroup(def);
}

/** Need group → the newest usable tank design slot (newest chassis year, then the latest saved, then the lower slot). */
function newestOfGroups(d: WwDepth, id: number): Map<number, number> {
  const best = new Map<number, [number, DesignSlot]>();
  for (const [slot, s] of usable(d, id, "tank")) {
    const g = groupKey(s.def);
    const was = best.get(g);
    const year = WW_TECHS[TANK_BASE_DEFS[s.def.base].tech].year;
    if (was !== undefined) {
      const wy = WW_TECHS[TANK_BASE_DEFS[was[1].def.base].tech].year;
      if (wy > year || (wy === year && was[1].savedDay >= s.savedDay)) {
        continue;
      }
    }
    best.set(g, [slot, s]);
  }
  return new Map([...best].map(([g, [slot]]) => [g, slot]));
}

const LIGHT_G = EQUIPMENT_TYPES.indexOf("light_tank");
const MEDIUM_G = EQUIPMENT_TYPES.indexOf("medium_tank");

/**
 * Spec §19.3: one tank line a design day moves to the newest design of
 * its group (a static light or medium tank line to its weight's design)
 * when it is near its efficiency cap (P1 R6.7) or its design went
 * obsolete. An aggressor major also turns its smallest medium tank line
 * into a tank destroyer line (1940) and another into a heavy tank line
 * (1942), keeping one medium line at least.
 */
function aiTankLines(d: WwDepth, id: number, ce: CountryEconomy): void {
  const newest = newestOfGroups(d, id);
  const cap = effCapBp(ce.stats);
  const des = d.country(id)!.des.tank;
  const groupOfLine = (key: number): number => {
    const [t, g] = EQUIP_KEYS[key];
    if (t === "light_tank") return LIGHT_G;
    if (t === "medium_tank") return MEDIUM_G;
    if (t !== "tank_design") return -1;
    const s = des[g - 1];
    return s === null ? -1 : groupKey(s.def);
  };
  for (const g of [NG_TD, NG_HEAVY]) {
    const slot = newest.get(g);
    if (slot === undefined) continue;
    if (ce.lines.some((l) => groupOfLine(l.key) === g)) continue;
    const mediums = ce.lines.filter((l) => groupOfLine(l.key) === MEDIUM_G);
    if (mediums.length < 2) continue;
    const pick = [...mediums].sort(
      (a, b) => a.factories - b.factories || b.id - a.id,
    )[0];
    if (changeLine(d.ww.economy, ce, pick.id, "tank_design", slot) === null) {
      return;
    }
  }
  for (const l of ce.lines) {
    const g = groupOfLine(l.key);
    if (g < 0) continue;
    const slot = newest.get(g);
    if (slot === undefined || equipKey("tank_design", slot) === l.key) continue;
    const [t, s] = EQUIP_KEYS[l.key];
    const obsolete = t === "tank_design" && des[s - 1]?.obsolete === true;
    if (!obsolete && l.effBp < cap - NEAR_CAP_BP) continue;
    if (changeLine(d.ww.economy, ce, l.id, "tank_design", slot) === null) {
      return;
    }
  }
}

/** Units of a need group's design slots in the stock. */
function groupStock(d: WwDepth, id: number, ce: CountryEconomy, g: number) {
  let n = 0;
  d.country(id)!.des.tank.forEach((s, i) => {
    if (s !== null && groupKey(s.def) === g) {
      n += ce.stock[equipKey("tank_design", i + 1)];
    }
  });
  return n;
}

/**
 * Spec §19.3 (내 판단: the lines would only fill the stock otherwise): an
 * aggressor major's armoured template — the first with a medium tank
 * battalion — takes a tank destroyer battalion (one added) and a heavy
 * one (a medium one replaced) once the stock holds a battalion's worth
 * for each of its divisions; P2's template order judges the rest.
 */
function aiRoleTemplates(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  day: number,
): void {
  if (!roleMajor(d, id, ce) || day < AI_TD_DAY) return;
  const land = d.ww.land;
  const cl = land.country(id);
  if (cl === null) return;
  const tpl = cl.templates.find((t) =>
    t.def.battalions.includes("medium_armor"),
  );
  if (tpl === undefined) return;
  let n = 1;
  for (const r of land.rowsOf(id)) {
    if (land.divisions.template[r] === tpl.id) n++;
  }
  const bns = tpl.def.battalions;
  let next: BattalionId[] | null = null;
  if (
    !bns.includes("tank_destroyer") &&
    bns.length < WW_MAX_BATTALIONS &&
    groupStock(d, id, ce, NG_TD) >= 40 * n
  ) {
    next = [...bns, "tank_destroyer"];
  } else if (
    !bns.includes("heavy_armor") &&
    groupStock(d, id, ce, NG_HEAVY) >= 40 * n
  ) {
    const i = bns.indexOf("medium_armor");
    next = bns.map((b, k): BattalionId => (k === i ? "heavy_armor" : b));
  }
  if (next === null) return;
  land.issue(
    id,
    {
      kind: "template_save",
      template: tpl.id,
      base: 0,
      name: "",
      battalions: next,
      support: [...tpl.def.support],
    },
    "ai",
  );
}

/**
 * Spec §19.3: the fit of a hull — K5's preset (Britain's and America's
 * radar and dual-purpose guns from 1940, Japan's heavy torpedoes,
 * Germany's snorkel submarine in 1944), else the recommended standard
 * fit with those rules; unresearched modules at the base fitting.
 */
function shipFit(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  base: string,
  day: number,
): DesignDef {
  const p = presetFor(d, id, base, day, (def) => def.kind === "ship");
  const def: DesignDef =
    p !== null
      ? { ...p.def, name: presetName(p.id) }
      : { ...recommendedShip(base), name: presetName(`rec_${base}`) };
  const cls = shipBase(base)?.cls ?? "dd";
  const slots: string[] = [...def.modules];
  const kinds = SHIP_CLASS_SLOTS[cls];
  const put = (slot: string, m: string) => {
    const i = kinds.indexOf(slot);
    if (i >= 0 && SHIP_MODULE_DEFS[m]?.classes.includes(cls)) slots[i] = m;
  };
  // Spec §19.3 (history as flavour: by personality without the historical AI).
  const tag = d.ww.tagOf(id);
  const hist = historical(d);
  const who = aiPersonality(tag);
  const radar = hist ? tag === "GBR" || tag === "USA" : who === "democracy";
  const torp = hist ? tag === "JPN" : who === "aggressor";
  const snorkel = hist ? tag === "DEU" : who === "aggressor";
  if (radar && day >= AI_TD_DAY) {
    put("secondary", "sec_dp");
    put("fire_control", "radar_surface");
  }
  if (torp) put("torpedo", "torp_heavy");
  if (snorkel && day >= AI_SNORKEL_DAY) put("special", "snorkel");
  return withoutLocked(
    { ...def, modules: slots },
    ce.researched,
    d.country(id)?.proj.done ?? 0,
  );
}

/**
 * Spec §19.3: every hull an AI naval line builds gets the AI's fit — the
 * design saved (navy experience allowing), the line launching it — and a
 * reworked one once a year when the fit changes.
 */
function aiShipDesigns(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  day: number,
): void {
  // Review E2: a design on a line passes the line's own check (the treaty too).
  const fits = (cls: number, gen: number, slot: number) =>
    navalLineDesignBlock(d, id, cls, gen, slot) === null;
  for (const l of ce.navalLines) {
    if (l.cls >= SHIP_CLASSES.length) continue;
    const base = `${SHIP_CLASSES[l.cls]}_${l.gen}`;
    const fit = shipFit(d, id, ce, base, day);
    let slot = 0;
    let latest: DesignSlot | null = null;
    let latestSlot = 0;
    for (const [s, x] of usable(d, id, "ship")) {
      if (x.def.base !== base || !fits(l.cls, l.gen, s)) continue;
      if (sameDesign(x.def, fit)) slot = s;
      if (latest === null || x.savedDay >= latest.savedDay) {
        latest = x;
        latestSlot = s;
      }
    }
    if (
      slot === 0 &&
      (latest === null || day - latest.savedDay >= AI_REDESIGN_DAYS)
    ) {
      slot = aiSave(d, id, ce, fit, latest?.def ?? null, day);
    }
    // (A fit the AI cannot save yet: its latest design of the hull.)
    if (slot === 0 && latestSlot > 0) slot = latestSlot;
    // Between two ships only (a player ends a line and adds another): a
    // line not started, or the day after a launch (its progress is the
    // remainder, below a day's output).
    const between = l.progress === 0 || l.progress < l.lastOutput;
    if (slot > 0 && l.design !== slot && between && fits(l.cls, l.gen, slot)) {
      l.design = slot;
    }
  }
  // Review E11: an own ship design no naval line builds goes obsolete once
  // a newer one of its hull exists (its slot frees when no ship has it).
  const c = d.country(id)!;
  const newest = new Map<string, [number, number]>();
  c.des.ship.forEach((x, i) => {
    if (x === null || x.obsolete || x.origin !== "own") return;
    const was = newest.get(x.def.base);
    if (was === undefined || x.savedDay >= was[1]) {
      newest.set(x.def.base, [i + 1, x.savedDay]);
    }
  });
  c.des.ship.forEach((x, i) => {
    if (x === null || x.obsolete || x.origin !== "own") return;
    if (newest.get(x.def.base)?.[0] === i + 1) return;
    if (ce.navalLines.some((l) => l.design === i + 1)) return;
    x.obsolete = true;
    d.markDesign(id, "ship", i + 1);
  });
}
