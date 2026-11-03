// P6 lane D (plan Task 2): command power, officer corps, general and
// admiral traits, field marshals, medals, reinforcement order (spec §4).
// The judges are engine-lib CommandRules' (the screens call them too).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  FM_PROMOTE_PP,
  FM_TRAITS,
  MEDAL_COOLDOWN_DAYS,
  MEDAL_DAYS,
  MEDALS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GENERAL_TRAITS,
  GeneralTrait,
  TPL_ARMOR_ANY,
  TPL_INFANTRY_DIV,
  TPL_MARINE_ANY,
  TPL_MOUNTAIN_ANY,
  TPL_PARA_ANY,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  ADMIRAL_TRAITS,
  AdmiralTrait,
  admiralTraitBit,
  WW_ADMIRAL_TRAIT_MAX,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  ASSIGNABLE_ADMIRAL_TRAITS,
  AUTO_ADMIRAL_DAYS,
  AUTO_TRAIT_BATTLE_DAYS,
  fmArmyStats,
  fmTraitAllowance,
  MEDAL_AUTO_EVERY_DAYS,
  MEDAL_MAX_ACTIVE,
  MEDAL_STATS,
  NEW_GENERAL_TRAITS,
  promoteFmBlock,
  TERRAIN_TRAIT_DAYS,
  traitAssignBlock,
  traitSlots,
} from "@openfront/engine-lib/ww1936/CommandRules";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { historicalAiActive } from "@openfront/engine-lib/ww1936/Pace";
import { canServe, TERRAIN_TRAITS } from "../land/GeneralsRun";
import type { Army, CountryLand, GeneralState, WwLand } from "../land/WwLand";
import { payPp } from "../politics/PayPp";
import {
  commandVer,
  disbandGroupsOf,
  FM_ARMY,
  generalById,
  touchCommand,
} from "./ArmyGroups";
import { cryptoModsVs } from "./Crypto";
import {
  ArmyDepthMods,
  LandModQuery,
  NEUTRAL_ARMY_MODS,
  WwDepth,
} from "./WwDepth";

/** The P6 terrain traits (spec §4.2): terrainDays 4..6. */
const P6_TERRAIN_FIRST = 4;

const GUERRILLA = traitBit("guerrilla_fighter");
const TRICKSTER = traitBit("trickster");
const SKIRMISHER = traitBit("skirmisher");
/** Spec §4.2 trickster: the enemy's readiness bonus −10%p. */
const TRICKSTER_CUT_BP = -1000;
/** Spec §4.5: a medal's division experience gain, percent. */
const MEDAL_XP_PCT = 10;

type MedalStats = {
  attackBp?: number;
  defenseBp?: number;
  recoveryPct?: number;
};

/** The K5 START_FIELD_MARSHALS rows naming `g` of country `tag` whose window holds `day`. */
export function listedFm(
  d: WwDepth,
  id: number,
  g: GeneralState,
  day: number,
): boolean {
  if (g.roster < 0) return false;
  const tag = d.ww.tagOf(id);
  const key = GENERALS[g.roster]?.id;
  return d.ww.politics.content.startFieldMarshals.some(
    (r) =>
      r.tag === tag &&
      r.general === key &&
      (r.from === undefined || dayOfDate(r.from) <= day) &&
      (r.until === undefined || day < dayOfDate(r.until)),
  );
}

// ---- the country's day ----

/**
 * Spec §4.1–§4.5, the country's depth day (ww9: no command power): field marshals keep no army
 * and stop being one when they can no longer serve (roster dates, purges,
 * advisors) or their K5 row's last day comes; the P6 terrain traits (60
 * battle days in forest or jungle, urban, marsh; P2's day learns them for
 * the generals of armies, this one for the rest) and their notice; the free
 * automatic traits (design §12.2); medals that ran out and the automatic
 * medal (design §12.3).
 */
export function dailyCommand(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  const land = d.ww.land;
  const cl = land.country(id);
  if (c === null || cl === null) return;
  const cmd = c.cmd;
  let changed = false;
  for (const g of cl.generals) {
    if (g.fm) changed = keepMarshal(d, id, g, day) || changed;
    changed = terrainTraits(d, id, g) || changed;
    changed = autoGeneralTrait(d, id, g) || changed;
  }
  autoAdmiralTraits(d, id);
  // Medals over (the last day was yesterday) and cooldowns passed.
  for (const a of land.armiesOf(id)) {
    if (a.medal > 0 && a.medalUntil < day) {
      a.medal = 0;
      a.medalUntil = -1;
      land.markArmy(a.id);
      touchCommand(d);
    }
  }
  cmd.medalReady = cmd.medalReady.filter(
    ([army, ready]) => ready > day && land.armies.get(army)?.owner === id,
  );
  autoMedal(d, id, day);
  if (changed) {
    land.markCountry(id);
    touchCommand(d);
  }
}

/**
 * A field marshal's day: no army; gone when he cannot serve, or — for an
 * AI country with the historical AI only (history as flavour; review 8) —
 * when his K5 row's last day comes. True when it changed something.
 */
function keepMarshal(
  d: WwDepth,
  id: number,
  g: GeneralState,
  day: number,
): boolean {
  const land = d.ww.land;
  const key = g.roster >= 0 ? GENERALS[g.roster]?.id : undefined;
  const tag = d.ww.tagOf(id);
  const rowEnds =
    key !== undefined &&
    !d.ww.isHumanControlled(id) &&
    historicalAiActive(d.mg.config(), day) &&
    d.ww.politics.content.startFieldMarshals.some(
      (r) =>
        r.tag === tag &&
        r.general === key &&
        r.until !== undefined &&
        dayOfDate(r.until) === day,
    );
  if (rowEnds || !canServe(land, g, day)) {
    stripMarshal(d, id, g);
    return true;
  }
  if (g.army === FM_ARMY) return false;
  const a = g.army > 0 ? land.armies.get(g.army) : undefined;
  if (a !== undefined && a.general === g.id) {
    a.general = 0;
    land.markArmy(a.id);
  }
  g.army = FM_ARMY;
  return true;
}

/** No longer a field marshal: his traits go, his army groups disband, he is a free general. */
export function stripMarshal(d: WwDepth, id: number, g: GeneralState): void {
  g.fm = false;
  g.fmTraits = 0;
  if (g.army === FM_ARMY) g.army = 0;
  disbandGroupsOf(d, id, g.id);
  d.ww.land.markCountry(id);
  touchCommand(d);
}

/** Spec §4.2 terrain traits 5–7 and their notice (once per trait, cmd.traitsSeen). True when it changed something. */
function terrainTraits(d: WwDepth, id: number, g: GeneralState): boolean {
  let changed = false;
  let count = 0;
  for (let b = 0; b < GENERAL_TRAITS.length; b++) {
    if ((g.traits & (1 << b)) !== 0) count++;
  }
  const bits = terrainBits();
  for (let i = P6_TERRAIN_FIRST; i < TERRAIN_TRAITS.length; i++) {
    const bit = bits[i];
    if (
      (g.traits & bit) === 0 &&
      !g.fm &&
      (g.terrainDays[i] ?? 0) >= TERRAIN_TRAIT_DAYS &&
      count < traitSlots(g.level)
    ) {
      g.traits |= bit;
      count++;
      changed = true;
    }
  }
  const seen = seenBits(d, id, g.id);
  let now = seen;
  for (let i = P6_TERRAIN_FIRST; i < TERRAIN_TRAITS.length; i++) {
    const bit = bits[i];
    if ((g.traits & bit) === 0 || (seen & bit) !== 0) continue;
    now |= bit;
    // WwPolitics.message adds "events_display."; the client names the
    // general from `general` (EventsDisplay), never from `name`.
    d.message(id, "ww1936_trait_unlocked", {
      general: g.id,
      trait: TERRAIN_TRAITS[i],
    });
  }
  if (now !== seen) setSeenBits(d, id, g.id, now);
  return changed;
}

/** TERRAIN_TRAITS' bits (final perf lane: each general's day read them by name). */
let terrainBitsMemo: number[] | null = null;
function terrainBits(): number[] {
  terrainBitsMemo ??= TERRAIN_TRAITS.map((t) => traitBit(t));
  return terrainBitsMemo;
}

function seenBits(d: WwDepth, id: number, general: number): number {
  return d.country(id)?.cmd.traitsSeen.find((x) => x[0] === general)?.[1] ?? 0;
}

function setSeenBits(
  d: WwDepth,
  id: number,
  general: number,
  bits: number,
): void {
  const list = d.country(id)!.cmd.traitsSeen;
  const e = list.find((x) => x[0] === general);
  if (e !== undefined) e[1] = bits;
  else {
    list.push([general, bits]);
    list.sort((a, b) => a[0] - b[0]);
  }
}

// ---- orders ----

/** promote_fm, army_priority (army_spirit_pick, trait_assign and medal_award are refused). */
export function issueCommand(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  const day = d.ww.day(tick);
  const land = d.ww.land;
  switch (o.kind) {
    // ww15: the officer corps and bought traits are gone; the orders stay
    // in the schema (append-only) and are refused.
    case "army_spirit_pick":
    case "trait_assign":
      return "bad_index";
    case "promote_fm":
      return promoteMarshal(d, id, o.general, FM_TRAITS.indexOf(o.trait), day);
    // ww9: medals are awarded automatically after won battles (autoMedal).
    case "medal_award":
      return "bad_index";
    case "army_priority": {
      const a = land.armies.get(o.army);
      if (a === undefined || a.owner !== id) return "no_army";
      // The same priority changes nothing: refused, as every no-op order.
      if (a.priority === o.value) return "bad_index";
      a.priority = o.value;
      land.markArmy(a.id);
      return null;
    }
    default:
      return "bad_index";
  }
}

function generalTraitIds(mask: number): string[] {
  return GENERAL_TRAITS.filter((t) => (mask & traitBit(t)) !== 0);
}

/**
 * promote_fm (spec §4.3; CommandRules.promoteFmBlock judges): 25 PP only
 * (ww9); the general keeps no army (it is left without one) and
 * takes one field marshal trait (FM_TRAITS index).
 */
export function promoteMarshal(
  d: WwDepth,
  id: number,
  general: number,
  trait: number,
  day: number,
): WwOrderBlock | null {
  const land = d.ww.land;
  const cl = land.country(id);
  const g = cl === null ? null : generalById(cl, general);
  if (g === null || trait < 0) return "general_unavailable";
  const pol = d.ww.politics.country(id);
  const block = promoteFmBlock({
    isFm: g.fm,
    serves: canServe(land, g, day),
    level: g.level,
    skillSum: g.att + g.dfn + g.plan + g.log,
    listed: listedFm(d, id, g, day),
    fieldMarshals: land.fieldMarshalCount(id),
    divisions: land.rowsOf(id).length,
    pp: pol === null ? 0 : Math.floor(pol.ppMilli / 1000),
  });
  if (block !== null) return block;
  if (!payPp(d.ww.politics, id, FM_PROMOTE_PP)) return "no_pp";
  makeMarshal(d, id, g, trait);
  return null;
}

/** A general becomes a field marshal with one trait; his army is left without a general. */
export function makeMarshal(
  d: WwDepth,
  id: number,
  g: GeneralState,
  trait: number,
): void {
  const land = d.ww.land;
  const a = g.army > 0 ? land.armies.get(g.army) : undefined;
  if (a !== undefined && a.general === g.id) {
    a.general = 0;
    land.markArmy(a.id);
  }
  g.army = FM_ARMY;
  g.fm = true;
  if (trait >= 0) g.fmTraits |= 1 << trait;
  touchCommand(d);
  land.markCountry(id);
  d.message(id, "ww1936_fm_promoted", { general: g.id });
}

// ---- ww9: automatic traits and medals (design §12.2, §12.3) ----

const popcount = (m: number): number => {
  let n = 0;
  for (let x = m >>> 0; x !== 0; x &= x - 1) n++;
  return n;
};
/** The assigned traits (NEW_GENERAL_TRAITS kind "assign"), in list order. */
const ASSIGN_TRAITS: readonly GeneralTrait[] = GENERAL_TRAITS.filter(
  (t) => NEW_GENERAL_TRAITS[t]?.kind === "assign",
);

/** The share of the army's divisions whose template flags hit `mask`, per mille. */
function flagShare(land: WwLand, a: Army | undefined, mask: number): number {
  if (a === undefined || a.divisions.length === 0) return 0;
  const t = land.divisions;
  let n = 0;
  for (const div of a.divisions) {
    const r = t.rowOf(div);
    if (r >= 0 && (land.flagsOf(r) & mask) !== 0) n++;
  }
  return Math.floor((n * 1000) / a.divisions.length);
}

/** A general's score for each assignable trait (design §12.2 table). */
function traitScore(
  land: WwLand,
  g: GeneralState,
  a: Army | undefined,
  trait: GeneralTrait,
): number {
  switch (trait) {
    case "armor_expert":
      return flagShare(land, a, TPL_ARMOR_ANY);
    case "infantry_expert":
      return flagShare(land, a, TPL_INFANTRY_DIV);
    // The army's artillery is not a template flag: half the infantry share.
    case "artillery_officer":
      return flagShare(land, a, TPL_INFANTRY_DIV) >> 1;
    case "commando":
      return flagShare(
        land,
        a,
        TPL_MOUNTAIN_ANY | TPL_MARINE_ANY | TPL_PARA_ANY,
      );
    case "engineer_officer":
      return g.terrainDays[3] ?? 0;
    case "guerrilla_fighter":
      return g.use[3] ?? 0;
    case "trickster":
    case "skirmisher":
      return g.use[0] ?? 0;
    case "ambusher":
      return g.use[1] ?? 0;
    default:
      return 0;
  }
}

/**
 * Design §12.2: a general with a free slot and battle days (attack +
 * defence) of AUTO_TRAIT_BATTLE_DAYS per assigned trait held plus one takes
 * the allowed trait his service scores highest (list order on a tie); a
 * field marshal with room takes the marshal trait his service points to.
 * Free of XP. True when it changed something.
 */
function autoGeneralTrait(d: WwDepth, id: number, g: GeneralState): boolean {
  const land = d.ww.land;
  const days = (g.use[0] ?? 0) + (g.use[1] ?? 0);
  if (g.fm) {
    if (popcount(g.fmTraits) >= fmTraitAllowance(g.level)) return false;
    // Attack, defence, short of supply, preparing; none: the strategist.
    const order: [number, (typeof FM_TRAITS)[number]][] = [
      [g.use[0] ?? 0, "fm_offensive"],
      [g.use[1] ?? 0, "fm_defensive"],
      [g.use[3] ?? 0, "fm_logistics"],
      [g.use[2] ?? 0, "fm_thorough"],
    ];
    let pick: (typeof FM_TRAITS)[number] = "fm_strategist";
    let best = 0;
    for (const [v, t] of order) {
      if (v > best && (g.fmTraits & (1 << FM_TRAITS.indexOf(t))) === 0) {
        best = v;
        pick = t;
      }
    }
    if ((g.fmTraits & (1 << FM_TRAITS.indexOf(pick))) !== 0) {
      const free = FM_TRAITS.find(
        (t) => (g.fmTraits & (1 << FM_TRAITS.indexOf(t))) === 0,
      );
      if (free === undefined) return false;
      pick = free;
    }
    return grantGeneralTrait(d, id, g, pick);
  }
  if (days <= 0) return false;
  const held = generalTraitIds(g.traits);
  const assigned = held.filter((t) =>
    ASSIGN_TRAITS.includes(t as GeneralTrait),
  ).length;
  if (days < AUTO_TRAIT_BATTLE_DAYS * (assigned + 1)) return false;
  const slots = traitSlots(g.level);
  if (held.length >= slots) return false;
  const a = g.army > 0 ? land.armies.get(g.army) : undefined;
  let pick: GeneralTrait | null = null;
  let best = -1;
  for (const t of ASSIGN_TRAITS) {
    if (
      traitAssignBlock({
        admiral: false,
        level: g.level,
        traits: held,
        slots,
        trait: t,
        isFm: false,
        fmTraits: [],
      }) !== null
    ) {
      continue;
    }
    const sc = traitScore(land, g, a, t);
    if (sc > best) {
      best = sc;
      pick = t;
    }
  }
  return pick === null ? false : grantGeneralTrait(d, id, g, pick);
}

/** Gives the trait for free and tells the owner. */
function grantGeneralTrait(
  d: WwDepth,
  id: number,
  g: GeneralState,
  trait: string,
): boolean {
  const land = d.ww.land;
  const fmBit = FM_TRAITS.indexOf(trait as (typeof FM_TRAITS)[number]);
  if (fmBit >= 0) g.fmTraits |= 1 << fmBit;
  else g.traits |= traitBit(trait as GeneralTrait);
  if (g.army > 0) land.markArmy(g.army);
  d.message(id, "ww1936_trait_unlocked", { general: g.id, trait });
  return true;
}

/** Design §12.2 admirals: level 2 and usage days of AUTO_ADMIRAL_DAYS per assigned trait held plus one. */
function autoAdmiralTraits(d: WwDepth, id: number): void {
  const navy = d.ww.navy;
  for (const a of navy.admirals.values()) {
    if (a.owner !== id) continue;
    const total = a.usage[0] + a.usage[1] + a.usage[2] + a.usage[3];
    const held = ADMIRAL_TRAITS.filter(
      (t) => (a.traits & admiralTraitBit(t)) !== 0,
    );
    const assigned = held.filter((t) =>
      ASSIGNABLE_ADMIRAL_TRAITS.includes(t),
    ).length;
    if (total < AUTO_ADMIRAL_DAYS * (assigned + 1)) continue;
    // Escort and carriers, battle, mission, battle damage.
    const plan: [number, AdmiralTrait][] = [
      [a.usage[3], "convoy_master"],
      [a.usage[0], "fleet_tactician"],
      [a.usage[2], "night_fighter"],
      [a.usage[1], "blockade_runner"],
    ];
    let pick: AdmiralTrait | null = null;
    let best = -1;
    for (const [v, t] of plan) {
      if (
        v > best &&
        traitAssignBlock({
          admiral: true,
          level: a.level,
          traits: held,
          slots: WW_ADMIRAL_TRAIT_MAX,
          trait: t,
          isFm: false,
          fmTraits: [],
        }) === null
      ) {
        best = v;
        pick = t;
      }
    }
    if (pick === null) continue;
    a.traits |= admiralTraitBit(pick);
    navy.markCountry(id);
    d.message(id, "ww1936_trait_unlocked", { general: a.id, trait: pick });
  }
}

/**
 * Design §12.3: a battle ended. Per country with armies on the winning
 * side, its biggest army there is the medal candidate (valour for an
 * attack, defence for a defence; the loser's biggest army, when the field
 * was lost, is a low-ranked service medal). A bigger candidate replaces
 * the held one; any win outranks any defeat.
 */
export function onBattleEnd(
  d: WwDepth,
  winnerSide: 0 | 1,
  attackers: readonly number[],
  defenders: readonly number[],
  defeat: boolean,
): void {
  const win = winnerSide === 0 ? attackers : defenders;
  noteCandidates(d, win, winnerSide === 0 ? 0 : 1, 0);
  if (defeat)
    noteCandidates(d, winnerSide === 0 ? defenders : attackers, 2, -1000);
}

function noteCandidates(
  d: WwDepth,
  divs: readonly number[],
  medal: number,
  offset: number,
): void {
  const land = d.ww.land;
  const t = land.divisions;
  const per = new Map<number, number>();
  for (const div of divs) {
    const r = t.rowOf(div);
    if (r < 0) continue;
    const army = t.army[r];
    if (army > 0) per.set(army, (per.get(army) ?? 0) + 1);
  }
  const best = new Map<number, [number, number]>();
  for (const [army, n] of per) {
    const a = land.armies.get(army);
    if (a === undefined) continue;
    const cur = best.get(a.owner);
    if (cur === undefined || n > cur[1] || (n === cur[1] && army < cur[0])) {
      best.set(a.owner, [army, n]);
    }
  }
  for (const [owner, [army, n]] of best) {
    const c = d.country(owner);
    if (c === null) continue;
    const score = n + offset;
    const w = c.cmd.medalWin;
    if (w === undefined || score > w[2]) c.cmd.medalWin = [army, medal, score];
  }
}

/** Design §12.3: every MEDAL_AUTO_EVERY_DAYS the candidate gets its medal, if the cooldown is over and fewer than MEDAL_MAX_ACTIVE are held. */
function autoMedal(d: WwDepth, id: number, day: number): void {
  const c = d.country(id)!;
  const land = d.ww.land;
  const w = c.cmd.medalWin;
  if (w === undefined) return;
  const a = land.armies.get(w[0]);
  if (a === undefined || a.owner !== id || a.medal > 0) {
    c.cmd.medalWin = undefined;
    return;
  }
  if (
    c.cmd.medalDay !== undefined &&
    day - c.cmd.medalDay < MEDAL_AUTO_EVERY_DAYS
  ) {
    return;
  }
  const ready = c.cmd.medalReady.find((x) => x[0] === a.id);
  if (ready !== undefined && ready[1] > day) return;
  let active = 0;
  for (const x of land.armiesOf(id)) if (x.medal > 0) active++;
  if (active >= MEDAL_MAX_ACTIVE) return;
  a.medal = w[1] + 1;
  a.medalUntil = day + MEDAL_DAYS - 1;
  if (ready !== undefined) ready[1] = day + MEDAL_COOLDOWN_DAYS;
  else {
    c.cmd.medalReady.push([a.id, day + MEDAL_COOLDOWN_DAYS]);
    c.cmd.medalReady.sort((x, y) => x[0] - y[0]);
  }
  c.cmd.medalDay = day;
  c.cmd.medalWin = undefined;
  land.markArmy(a.id);
  touchCommand(d);
  d.message(id, "ww1936_medal_auto", { army: a.nameNo });
}

// ---- what the land war reads ----

/** commandLandMods' per-tick memo entry: what it was built from, and the frozen result. */
interface ModsMemoEntry {
  ver: number;
  general: number;
  enemy: number;
  group: number;
  medal: number;
  mods: ArmyDepthMods;
}
const modsMemo = new WeakMap<
  WwDepth,
  { tick: number; byArmy: Map<number, ModsMemoEntry> }
>();

/**
 * Spec §18.2 (pre-flight §0-2, review L4): the army's command values for
 * P2 — its army group's field marshal (skills, traits and the traits'
 * readiness, entrenchment, supply, recovery and org), its medal, its
 * decryption bonus against the enemy of its front or plan (lane I's
 * cryptoModsVs) and its general's guerrilla_fighter. The general traits'
 * combat lines are CombatRules.divisionMods'.
 *
 * Built once per army and tick (review 5): the memo is keyed by the tick,
 * lane D's command version (ArmyGroups.touchCommand) and the army's
 * general, front enemy, group and medal, so a change made earlier in the
 * tick is seen, and a restored game (which starts on a tick boundary)
 * builds the same values. The result is a frozen object of its own, never
 * a shared scratch (T1a re-review): WwDepth.armyMods reuses its query
 * object `q`, and nothing here keeps it. NEUTRAL_ARMY_MODS is a constant
 * nobody writes.
 */
export function commandLandMods(d: WwDepth, q: LandModQuery): ArmyDepthMods {
  const a = d.ww.land.armies.get(q.armyId);
  if (a === undefined) return NEUTRAL_ARMY_MODS;
  const tick = d.mg.ticks();
  let memo = modsMemo.get(d);
  if (memo === undefined || memo.tick !== tick) {
    memo = { tick, byArmy: new Map() };
    modsMemo.set(d, memo);
  }
  const ver = commandVer(d);
  const o = a.order;
  const enemy = o.kind === "front" || o.kind === "plan" ? o.enemy : 0;
  const e = memo.byArmy.get(a.id);
  if (
    e !== undefined &&
    e.ver === ver &&
    e.general === a.general &&
    e.enemy === enemy &&
    e.group === a.group &&
    e.medal === a.medal
  ) {
    return e.mods;
  }
  const mods = buildMods(d, a, enemy);
  memo.byArmy.set(a.id, {
    ver,
    general: a.general,
    enemy,
    group: a.group,
    medal: a.medal,
    mods,
  });
  return mods;
}

function buildMods(d: WwDepth, a: Army, enemy: number): ArmyDepthMods {
  const land = d.ww.land;
  let attBp = 0;
  let defBp = 0;
  let recoveryPct = 0;
  if (a.medal > 0 && a.medal <= MEDALS.length) {
    const m = MEDAL_STATS[MEDALS[a.medal - 1]] as MedalStats;
    attBp += m.attackBp ?? 0;
    defBp += m.defenseBp ?? 0;
    recoveryPct += m.recoveryPct ?? 0;
  }
  if (enemy > 0) {
    const bp = cryptoModsVs(d, a.owner, enemy);
    attBp += bp;
    defBp += bp;
  }
  const cl = land.country(a.owner);
  const gen =
    cl !== null && a.general !== 0 ? generalById(cl, a.general) : null;
  const halfSupply = gen !== null && (gen.traits & GUERRILLA) !== 0;
  const fm = cl !== null && a.group !== 0 ? groupMarshal(d, cl, a.group) : null;
  if (
    fm === null &&
    attBp === 0 &&
    defBp === 0 &&
    recoveryPct === 0 &&
    !halfSupply
  ) {
    return NEUTRAL_ARMY_MODS;
  }
  const fs = fm === null ? null : fmArmyStats(fm.fmTraits);
  return Object.freeze({
    fmAtt: fm?.att ?? 0,
    fmDef: fm?.dfn ?? 0,
    fmTraits: fm?.fmTraits ?? 0,
    cmdAttBp: attBp,
    cmdDefBp: defBp,
    halfSupply,
    orgAdd: fs?.org ?? 0,
    recoveryPct: recoveryPct + (fs?.recoveryPct ?? 0),
    planSpeedPct: fs?.planSpeedPct ?? 0,
    planMaxBp: fs?.planMaxBp ?? 0,
    entrenchSpeedPct: fs?.entrenchSpeedPct ?? 0,
    supplyUsePct: fs?.supplyUsePct ?? 0,
    fmPlan: fm?.plan ?? 0,
    fmLog: fm?.log ?? 0,
  });
}

/** The field marshal leading army group `group` of the country, null when none. */
function groupMarshal(
  d: WwDepth,
  cl: CountryLand,
  group: number,
): GeneralState | null {
  for (const g of d.groups) {
    if (g.id !== group) continue;
    if (g.owner !== cl.smallID) return null;
    const fm = generalById(cl, g.fm);
    return fm !== null && fm.fm ? fm : null;
  }
  return null;
}

/** Per-tick memo of tricksterCutBp: region → victim's side → [the battle's size when read, cut]. */
const tricksterMemo = new WeakMap<
  WwDepth,
  { tick: number; cut: Map<number, Map<number, [number, number]>> }
>();

/**
 * Spec §4.2 trickster: −10%p readiness for `victim`'s divisions in the
 * battle at `region` when an enemy army there is led by a trickster
 * (bp ≤ 0). Memoised per tick, (region, victim's side) and the battle's
 * size (a division joining reads again): a pure function of the tick's
 * state, so a restored game reads the same.
 */
export function tricksterCutBp(
  d: WwDepth,
  victim: number,
  region: number,
): number {
  const land = d.ww.land;
  const b = land.battles.get(region);
  if (b === undefined) return 0;
  const tick = d.mg.ticks();
  let memo = tricksterMemo.get(d);
  if (memo === undefined || memo.tick !== tick) {
    memo = { tick, cut: new Map() };
    tricksterMemo.set(d, memo);
  }
  const side = land.sideOf(victim);
  const size = b.attackers.length * 65_536 + b.defenders.length;
  let byRegion = memo.cut.get(region);
  const known = byRegion?.get(side);
  if (known !== undefined && known[0] === size) return known[1];
  let cut = 0;
  const t = land.divisions;
  let lastArmy = -1;
  for (const list of [b.attackers, b.defenders]) {
    for (const div of list) {
      const r = t.rowOf(div);
      if (r < 0) continue;
      const army = t.army[r];
      if (army === 0 || army === lastArmy) continue;
      lastArmy = army;
      if (land.sameSide(land.fightOwner(r), victim)) continue;
      const a = land.armies.get(army);
      const cl = a === undefined ? null : land.country(a.owner);
      const g =
        cl === null || a === undefined || a.general === 0
          ? null
          : generalById(cl, a.general);
      if (g !== null && (g.traits & TRICKSTER) !== 0) {
        cut = TRICKSTER_CUT_BP;
        break;
      }
    }
    if (cut !== 0) break;
  }
  if (byRegion === undefined) {
    byRegion = new Map();
    memo.cut.set(region, byRegion);
  }
  byRegion.set(side, [size, cut]);
  return cut;
}

/**
 * Spec §4.6: the order P2 reinforces the country's divisions in — the
 * armies' priority high, normal, low; division id order within one (the
 * rows are in id order). Without a non-normal priority, P2's order.
 */
export function reinforceOrder(d: WwDepth, id: number): number[] {
  const land = d.ww.land;
  const t = land.divisions;
  const rows = land.rowsOf(id);
  let mixed = false;
  for (const a of land.armiesOf(id)) {
    if (a.priority !== 1) {
      mixed = true;
      break;
    }
  }
  if (!mixed) return rows.map((r) => t.id[r]);
  const byPrio: number[][] = [[], [], []];
  for (const r of rows) {
    const p = t.army[r] === 0 ? 1 : (land.armies.get(t.army[r])?.priority ?? 1);
    byPrio[2 - Math.max(0, Math.min(2, p))].push(t.id[r]);
  }
  return [...byPrio[0], ...byPrio[1], ...byPrio[2]];
}

/**
 * Spec §4.2 / §8.8: a skirmisher general's army of `observer` stands in or
 * next to a region holding a division of `target`.
 */
export function skirmisherContact(
  d: WwDepth,
  observer: number,
  target: number,
): boolean {
  const land = d.ww.land;
  const cl = land.country(observer);
  if (cl === null || observer === target) return false;
  const t = land.divisions;
  let theirs: Set<number> | null = null;
  const sc = d.ww.scenario;
  for (const a of land.armiesOf(observer)) {
    if (!isSkirmisherArmy(cl, a)) continue;
    if (theirs === null) {
      theirs = new Set<number>();
      for (const r of land.rowsOf(target)) theirs.add(t.region[r]);
      if (theirs.size === 0) return false;
    }
    for (const div of a.divisions) {
      const r = t.rowOf(div);
      if (r < 0) continue;
      const at = t.region[r];
      if (theirs.has(at)) return true;
      for (const n of sc.regionNeighbours(at)) if (theirs.has(n)) return true;
    }
  }
  return false;
}

/** The army is led by a general with the skirmisher trait (spec §4.2). */
export function isSkirmisherArmy(cl: CountryLand, a: Army): boolean {
  if (a.general === 0) return false;
  const g = generalById(cl, a.general);
  return g !== null && (g.traits & SKIRMISHER) !== 0;
}

/** Spec §4.5: a medal's division experience gain, percent, for the army. */
export function medalXpPct(d: WwDepth, armyId: number): number {
  if (armyId <= 0) return 0;
  const a = d.ww.land.armies.get(armyId);
  return a !== undefined && a.medal > 0 ? MEDAL_XP_PCT : 0;
}
