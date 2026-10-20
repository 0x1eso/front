// World War 1936 P2: generals (P2 spec §6.2): putting them at the head of
// armies, titled generals for army experience (ids: Generals.titledGeneralId),
// and their days (experience, levels, terrain traits, the roster's dates).
// generalOf is the foundation's.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GENERAL_TRAITS,
  GeneralTrait,
  ROLE_ATTACK,
  ROLE_DEFEND,
  traitBit,
  WW_TITLED_GENERAL_XP_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import { planMaxBp } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  GeneralDef,
  GENERALS,
  generalServes,
} from "@openfront/engine-lib/ww1936/Generals";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import type { CountryEconomy } from "../economy/WwEconomy";
import { newTitledGeneralState } from "./LandStartRun";
import type { Army, CountryLand, GeneralState, WwLand } from "./WwLand";

/** Skills a general can reach (spec §6.2). */
export const GENERAL_SKILL_MAX = 5;
export const GENERAL_LEVEL_MAX = 5;
/** Battle days on one kind of ground that teach its trait (spec §6.2). */
export const TERRAIN_TRAIT_DAYS = 60;
export const GENERAL_TRAITS_MAX = 3;
/**
 * Task 11: a general's experience is kept in hundredths (GeneralState.xp),
 * so generalXpPct counts below +100% too (+1.00 a battle day, × (100 +
 * generalXpPct)%); the screens get whole points (WwLand.takeData).
 */
export const GENERAL_XP_CENTI = 100;
/** GeneralState.terrainDays order: snow or frost, desert, hills or mountains, attacks across a river. */
export const TERRAIN_TRAITS: readonly GeneralTrait[] = [
  "winter_specialist",
  "desert_fox",
  "mountaineer",
  "river_crosser",
];

/** The roster entry of a named general; undefined for a titled one. */
export function rosterDefOf(g: GeneralState): GeneralDef | undefined {
  return g.roster >= 0 ? GENERALS[g.roster] : undefined;
}

/** Spec §6.2: whether the general can command on `day` (a titled one always can). */
export function canServe(g: GeneralState, day: number): boolean {
  const def = rosterDefOf(g);
  return def === undefined || generalServes(def, day);
}

/**
 * Spec §6.2: puts `general` at the head of `army` (0: takes it away). A
 * general leading another army leaves it; the army's old general is free.
 * It leaves the army's `auto` alone: WwLand.issue turns it off for a
 * player's orders only (pre-flight U2), never for the AI's.
 */
export function assignGeneral(
  land: WwLand,
  cl: CountryLand,
  army: number,
  general: number,
): WwOrderBlock | null {
  const a = land.armies.get(army);
  if (a === undefined || a.owner !== cl.smallID) return "no_army";
  let g: GeneralState | undefined;
  if (general !== 0) {
    g = cl.generals.find((x) => x.id === general);
    if (g === undefined || !canServe(g, land.day())) {
      return "general_unavailable";
    }
  }
  if (a.general === general) return null;
  freeGeneral(land, cl, a);
  if (g !== undefined) {
    const other = land.armies.get(g.army);
    if (other !== undefined && other.general === g.id) {
      other.general = 0;
      land.markArmy(other.id);
    }
    g.army = a.id;
    a.general = g.id;
  }
  land.markArmy(a.id);
  land.markCountry(cl.smallID);
  return null;
}

/** The army's general (if any) back to the free list. */
function freeGeneral(land: WwLand, cl: CountryLand, a: Army): void {
  if (a.general === 0) return;
  const old = cl.generals.find((x) => x.id === a.general);
  if (old !== undefined && old.army === a.id) old.army = 0;
  a.general = 0;
  land.markArmy(a.id);
}

/**
 * Spec §6.2: a titled general ("Commander No. n", every skill 1) for 10
 * army experience. Numbered from the country's `nextTitleNo`, the counter
 * LandStartRun's 1936 titled generals (Japan's) take theirs from, so ids
 * never collide.
 */
export function appointGeneral(
  land: WwLand,
  cl: CountryLand,
): WwOrderBlock | null {
  if (cl.armyXpMilli < WW_TITLED_GENERAL_XP_MILLI) return "no_xp";
  cl.armyXpMilli -= WW_TITLED_GENERAL_XP_MILLI;
  cl.generals.push(newTitledGeneralState(cl.smallID, cl.nextTitleNo++));
  land.markCountry(cl.smallID);
  return null;
}

/** Spec §6.2: the general of an army, null when none. */
export function generalOf(land: WwLand, army: Army): GeneralState | null {
  if (army.general === 0) return null;
  return (
    land.country(army.owner)?.generals.find((g) => g.id === army.general) ??
    null
  );
}

/**
 * Spec §6.2, the roster's dates on the country's day: a general whose
 * last day passed leaves its army (ww1936_general_lost), one whose first
 * day came is told (ww1936_general_available). `defOf` gives a general's
 * dates (tests pass their own; the game reads GENERALS).
 */
export function applyGeneralDates(
  land: WwLand,
  cl: CountryLand,
  day: number,
  defOf: (g: GeneralState) => GeneralDef | undefined = rosterDefOf,
): void {
  for (const g of cl.generals) {
    const def = defOf(g);
    if (def === undefined) continue;
    const now = generalServes(def, day);
    // Day 0's commands were given by the start (LandStartRun).
    const before = day > 0 ? generalServes(def, day - 1) : now;
    if (!now && g.army !== 0) {
      const a = land.armies.get(g.army);
      if (a !== undefined && a.general === g.id) {
        a.general = 0;
        land.markArmy(a.id);
      }
      g.army = 0;
      land.markCountry(cl.smallID);
    }
    if (before && !now) {
      land.message(cl.smallID, "events_display.ww1936_general_lost", {
        general: g.id,
      });
      land.markCountry(cl.smallID);
    } else if (!before && now) {
      land.message(cl.smallID, "events_display.ww1936_general_available", {
        general: g.id,
      });
      land.markCountry(cl.smallID);
    }
  }
}

/**
 * Spec §6.2, the country's day: the dates, then every army's general. A
 * day its divisions fought (`fought` reads a division's lastFight) gives
 * experience (+1, × generalXpPct, in hundredths) and counts its ground;
 * the uses count the days it attacked, defended, prepared (a front or a
 * plan not executing, its readiness under the cap) and was short of
 * supply (most of its divisions). At 100 × level a level comes with
 * +1 to the most used skill (ties: attack, defence, planning, logistics;
 * never past 5); 60 battle days on one ground teach its trait (3 at most).
 */
export function dailyGenerals(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  day: number,
  fought: (lastFight: number) => boolean,
): void {
  applyGeneralDates(land, cl, day);
  const t = land.divisions;
  const sc = land.scenario;
  for (const a of land.armiesOf(cl.smallID)) {
    const g = generalOf(land, a);
    if (g === null) continue;
    let fight = false;
    let att = false;
    let dfn = false;
    const ground = [false, false, false, false];
    let rows = 0;
    let shortRows = 0;
    for (const id of a.divisions) {
      const r = t.rowOf(id);
      if (r < 0) continue;
      rows++;
      if (t.supply[r] < 1000) shortRows++;
      if (!fought(t.lastFight[r])) continue;
      fight = true;
      const role = t.role[r];
      if (role === ROLE_ATTACK) att = true;
      if (role === ROLE_DEFEND) dfn = true;
      const b = t.battle[r];
      if (b === 0 || sc.region(b) === undefined) continue;
      const w = weatherAt(day, sc.latC(b), sc.landOf(b), sc.wcell(b));
      if (w === "snow" || w === "frozen") ground[0] = true;
      const terrain = sc.landOf(b);
      if (terrain === "desert") ground[1] = true;
      if (terrain === "hills" || terrain === "mountain") ground[2] = true;
      if (role === ROLE_ATTACK) {
        const e = sc.edgeBetween(t.region[r], b);
        if (e >= 0 && sc.edge(e).river > 0) ground[3] = true;
      }
    }
    // Task 11: the skill uses balance the fights against the rest. A day
    // preparing counts while the readiness still grows (not for every
    // day an army sits at its cap), a day short of supply when most of
    // the army is short (not one straggler's day).
    const short = shortRows * 2 > rows;
    const preparing =
      (a.order.kind === "front" || a.order.kind === "plan") &&
      !a.order.executing &&
      a.planBp < planMaxBp(ce.tech);
    if (att) g.use[0]++;
    if (dfn) g.use[1]++;
    if (preparing) g.use[2]++;
    if (short) g.use[3]++;
    if (fight) {
      g.xp += Math.max(1, 100 + ce.tech.generalXpPct);
      ground.forEach((on, i) => {
        if (on) g.terrainDays[i]++;
      });
    }
    levelUp(g);
    learnTraits(g);
  }
  // (The country's day marks it for the screens: WwLand.dailyCountry.)
}

/** Spec §6.2: a level at 100 × level experience, +1 to the most used skill below 5. */
function levelUp(g: GeneralState): void {
  if (g.level >= GENERAL_LEVEL_MAX || g.xp < 100 * GENERAL_XP_CENTI * g.level) {
    return;
  }
  g.level++;
  const skills = [g.att, g.dfn, g.plan, g.log];
  let best = -1;
  for (let i = 0; i < skills.length; i++) {
    if (skills[i] >= GENERAL_SKILL_MAX) continue;
    if (best < 0 || g.use[i] > g.use[best]) best = i;
  }
  if (best === 0) g.att++;
  else if (best === 1) g.dfn++;
  else if (best === 2) g.plan++;
  else if (best === 3) g.log++;
}

/** Spec §6.2: 60 battle days on a ground teach its trait, three traits at most. */
function learnTraits(g: GeneralState): void {
  TERRAIN_TRAITS.forEach((trait, i) => {
    const bit = traitBit(trait);
    if (
      g.terrainDays[i] >= TERRAIN_TRAIT_DAYS &&
      (g.traits & bit) === 0 &&
      traitCount(g.traits) < GENERAL_TRAITS_MAX
    ) {
      g.traits |= bit;
    }
  });
}

function traitCount(mask: number): number {
  let n = 0;
  for (let i = 0; i < GENERAL_TRAITS.length; i++) {
    if ((mask & (1 << i)) !== 0) n++;
  }
  return n;
}
