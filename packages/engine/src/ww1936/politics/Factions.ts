// World War 1936 P3: factions as state (spec §15). Any change ends with
// pol.factionsChanged() (the faction index, the land war's sides, the
// screens). Members are kept in ascending smallID; factions in index order,
// and an index is never used twice (plan decision 8).
import type { PolOrder } from "@openfront/engine-api/Schemas";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  factionKeyOf,
  IDEO_FAS,
  IDEO_NEU,
  WW_BEAT_WINDOW_DEFAULT_DAYS,
  WW_COST,
  WW_MAX_FACTIONS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  costWith,
  factionGate,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { idHash, P_EVT, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { payPp } from "./PayPp";
import { hasRule, ruleValue } from "./Spirits";
import { declareWarRules } from "./WarGoals";
import type { FactionState, WwPolitics } from "./WwPolitics";

export function isMajor(pol: WwPolitics, id: number): boolean {
  if (id <= 0 || id >= pol.countries.length) return false;
  return COUNTRIES[pol.tagOf(id)].major;
}

/**
 * Spec §15.3 ideology rule (controller ruling R8, the one P's government
 * change uses too): the faction's ideology, or a neutral government in a
 * neutral or fascist faction.
 */
export function fitsFactionIdeology(
  ruling: number,
  factionIdeo: number,
): boolean {
  return (
    ruling === factionIdeo ||
    (ruling === IDEO_NEU &&
      (factionIdeo === IDEO_NEU || factionIdeo === IDEO_FAS))
  );
}

/** Everyone a member of faction `idx` is at war with, outside it; ascending. */
export function factionEnemies(pol: WwPolitics, idx: number): number[] {
  const members = pol.factionMembers(idx);
  const out = new Set<number>();
  for (const m of members) {
    for (const e of pol.ww.enemiesOf(m)) {
      if (!members.includes(e)) out.add(e);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** Spec §15.3 "공동의 적": `id` fights someone a member of `idx` fights. */
function commonEnemy(pol: WwPolitics, id: number, idx: number): boolean {
  const enemies = factionEnemies(pol, idx);
  return pol.ww.enemiesOf(id).some((e) => enemies.includes(e));
}

function gateOk(pol: WwPolitics, id: number): boolean {
  const c = pol.country(id);
  if (c === null) return false;
  return factionGate(
    c.ruling,
    pol.wtBp,
    ruleValue(pol, id, "factionGateMinusPp") ?? 0,
  );
}

/**
 * Spec §15.3 table: may `joiner` (in no faction) come into faction `idx`
 * (an invitation from its leader, or a request to it)? Both governments'
 * tension gates (§14.4) apply.
 */
export function joinBlock(
  pol: WwPolitics,
  joiner: number,
  idx: number,
): WwOrderBlock | null {
  const f = pol.faction(idx);
  if (f === null || !pol.living(joiner)) return "bad_target";
  if (pol.factionIdx(joiner) >= 0) return "faction_rule";
  if (f.members.some((m) => pol.ww.isAtWar(m, joiner))) return "faction_war";
  // The joiner's wars must be the faction's own: no war it would bring along.
  const enemies = factionEnemies(pol, idx);
  if (pol.ww.enemiesOf(joiner).some((e) => !enemies.includes(e))) {
    return "faction_war";
  }
  const ruling = pol.country(joiner)!.ruling;
  // P5 pre-flight §A S: a faction named "any ideology" (the Pan-American pact).
  const anyIdeology =
    pol.content.factionNames.find((n) => n.id === f.name)?.anyIdeology === true;
  if (
    !anyIdeology &&
    !fitsFactionIdeology(ruling, pol.factionIdeology(idx)) &&
    !commonEnemy(pol, joiner, idx)
  ) {
    return "faction_rule";
  }
  if (hasRule(pol, joiner, "no_faction")) return "faction_rule";
  if (!gateOk(pol, joiner) || !gateOk(pol, f.leader)) return "tension_gate";
  return null;
}

function diploCost(pol: WwPolitics, id: number, base: number): number {
  return costWith(base, pol.stats(id).diploCostPct);
}

/** Spec §15.3: create, invite, request, kick, leave, dissolve. */
export function factionOrder(
  pol: WwPolitics,
  id: number,
  o: PolOrder,
  tick: number,
): WwOrderBlock | null {
  const day = pol.ww.day(tick);
  const mine = pol.factionIdx(id);
  const f = mine < 0 ? null : pol.faction(mine);
  switch (o.kind) {
    case "faction_create": {
      if (f !== null) return "faction_rule";
      const c = pol.country(id)!;
      if (!isMajor(pol, id) && !c.hasFlag("can_create_faction", day)) {
        return "faction_rule";
      }
      if (hasRule(pol, id, "no_faction")) return "faction_rule";
      if (pol.factions.length >= WW_MAX_FACTIONS) return "faction_rule";
      if (!gateOk(pol, id)) return "tension_gate";
      if (!payPp(pol, id, diploCost(pol, id, WW_COST.factionCreate))) {
        return "no_pp";
      }
      createFaction(pol, id, undefined, day);
      return null;
    }
    case "faction_invite": {
      if (f === null || f.leader !== id) return "faction_rule";
      if (o.target === id) return "bad_target";
      const block = joinBlock(pol, o.target, mine);
      if (block !== null) return block;
      if (!payPp(pol, id, diploCost(pol, id, WW_COST.factionInvite))) {
        return "no_pp";
      }
      pol.queueEvent("gen_diplo_faction_invite", o.target, id, 0, 0);
      return null;
    }
    case "faction_request": {
      const idx = pol.factionIdx(o.target);
      if (idx < 0 || o.target === id) return "bad_target";
      const block = joinBlock(pol, id, idx);
      if (block !== null) return block;
      if (!payPp(pol, id, diploCost(pol, id, WW_COST.factionRequest))) {
        return "no_pp";
      }
      pol.queueEvent(
        "gen_diplo_faction_request",
        pol.faction(idx)!.leader,
        id,
        0,
        0,
      );
      return null;
    }
    case "faction_kick": {
      if (f === null || f.leader !== id) return "faction_rule";
      if (o.target === id || !f.members.includes(o.target)) return "bad_target";
      if (pol.ww.hasWar(o.target)) return "faction_war";
      leaveFaction(pol, o.target, tick);
      return null;
    }
    case "faction_leave": {
      if (f === null) return "faction_rule";
      if (pol.ww.hasWar(id)) return "faction_war";
      // Controller ruling R8: the order pays the −5%, not leaveFaction.
      const c = pol.country(id)!;
      c.stabBaseBp = Math.max(0, c.stabBaseBp - 500);
      leaveFaction(pol, id, tick);
      return null;
    }
    case "faction_dissolve": {
      if (f === null || f.leader !== id) return "faction_rule";
      if (pol.ww.hasWar(id)) return "faction_war";
      dissolveFaction(pol, mine, tick);
      return null;
    }
    default:
      return "bad_index";
  }
}

/**
 * The day's common step: members that are gone (dead without having
 * capitulated: annexed, eliminated) leave; a capitulated member stays
 * (controller ruling, lane D fix 1: HOI4's exiles, P0 decision 11's team
 * win) but a leader that is no longer living is succeeded (spec §15.3); an
 * empty faction goes.
 */
export function dailyFactions(
  pol: WwPolitics,
  day: number,
  tick: number,
): void {
  for (const f of [...pol.factions]) {
    for (const m of [...f.members]) {
      const p = pol.player(m);
      const gone = (p === null || !p.isAlive()) && !pol.ww.isCapitulated(m);
      if (gone) leaveFaction(pol, m, tick);
    }
    if (pol.faction(f.idx) !== null) passLeadership(pol, f.leader, tick);
  }
  void day;
}

/**
 * Spec §15.3: when `id` leads its faction and is no longer living
 * (capitulated, gone), the living member with the most factories leads;
 * nothing while no member lives.
 */
export function passLeadership(
  pol: WwPolitics,
  id: number,
  tick: number,
): void {
  const idx = pol.factionIdx(id);
  const f = idx < 0 ? null : pol.faction(idx);
  if (f === null || f.leader !== id || pol.living(id)) return;
  const next = successor(
    pol,
    f.members.filter((m) => m !== id),
  );
  if (next === 0) return;
  f.leader = next;
  pol.factionsChanged();
  newLeader(pol, f, tick);
}

/** The new leader is announced; members at peace that no longer fit leave (R8). */
function newLeader(pol: WwPolitics, f: FactionState, tick: number): void {
  const key = factionKeyOf(f.idx);
  pol.messageAll("ww1936_faction_leader", {
    countryTag: pol.tagOf(f.leader),
    faction: key,
  });
  // Controller ruling R8: with a new leader the faction's ideology may
  // change; living members at peace that no longer fit leave (no penalty).
  const ideo = pol.factionIdeology(f.idx);
  for (const m of [...f.members]) {
    if (m === f.leader || !pol.living(m) || pol.ww.hasWar(m)) continue;
    const r = pol.country(m)?.ruling ?? IDEO_NEU;
    if (!fitsFactionIdeology(r, ideo)) leaveFaction(pol, m, tick);
  }
}

/**
 * Spec §15.3: `id` becomes a member of faction `idx` at once; when the
 * faction is at war, the new member is at war with all its enemies (P0
 * setWar, no chain). P5 pre-flight §0-6: the endgame links each new pair
 * to the war the faction fights it in (onFactionJoined).
 */
export function joinFaction(
  pol: WwPolitics,
  id: number,
  idx: number,
  tick: number,
): void {
  const f = pol.faction(idx);
  if (f === null || f.members.includes(id) || !pol.living(id)) return;
  if (pol.factionIdx(id) >= 0) return;
  const enemies = factionEnemies(pol, idx);
  f.members = [...f.members, id].sort((a, b) => a - b);
  pol.factionsChanged();
  // P5 hook (foundation): into the faction's wars, pair by pair.
  pol.ww.endgame.onFactionJoined(id, tick);
  if (enemies.length > 0) {
    pol.recomputeStats(id);
    for (const e of enemies) pol.recomputeStats(e);
  }
  pol.messageAll("ww1936_faction_joined", {
    countryTag: pol.tagOf(id),
    faction: factionKeyOf(idx),
  });
}

/**
 * `id` leaves its faction (leave, kick, capitulation, annexation). A
 * leader is succeeded by the member with the most factories (civilian +
 * military; ties: smaller smallID); an empty faction is gone and its index
 * is never used again. The −5% stability of a free leave is the caller's.
 */
export function leaveFaction(pol: WwPolitics, id: number, tick: number): void {
  const idx = pol.factionIdx(id);
  const f = idx < 0 ? null : pol.faction(idx);
  if (f === null) return;
  f.members = f.members.filter((m) => m !== id);
  const key = factionKeyOf(idx);
  pol.messageAll("ww1936_faction_left", {
    countryTag: pol.tagOf(id),
    faction: key,
  });
  if (f.members.length === 0) {
    pol.factions = pol.factions.filter((x) => x !== f);
    pol.factionsChanged();
    return;
  }
  const succeeded = f.leader === id;
  if (succeeded) {
    f.leader = successor(pol, f.members);
    if (f.leader === 0) f.leader = f.members[0];
  }
  pol.factionsChanged();
  if (succeeded) newLeader(pol, f, tick);
}

/** Spec §15.3: the living member with the most civilian + military factories (ties: the smaller smallID); 0 when none lives. */
function successor(pol: WwPolitics, members: readonly number[]): number {
  let best = 0;
  let bestN = -1;
  for (const m of [...members].sort((a, b) => a - b)) {
    if (!pol.living(m)) continue;
    const t = pol.econ.country(m)?.totals;
    const n = t === undefined ? 0 : t.civ + t.mil;
    if (n > bestN) {
      best = m;
      bestN = n;
    }
  }
  return best;
}

/** Every member out; the faction is gone. */
export function dissolveFaction(
  pol: WwPolitics,
  idx: number,
  tick: number,
): void {
  const f = pol.faction(idx);
  if (f === null) return;
  pol.factions = pol.factions.filter((x) => x !== f);
  pol.factionsChanged();
  for (const m of f.members) {
    pol.messageAll("ww1936_faction_left", {
      countryTag: pol.tagOf(m),
      faction: factionKeyOf(idx),
    });
  }
  void tick;
}

/**
 * Spec §15.2: a new faction led by `id` (in none). Its name: `name` (an
 * effect's), else the first FACTION_NAMES row listing the founder, else
 * "auto" (named after it). The new index, -1 when none was made.
 */
export function createFaction(
  pol: WwPolitics,
  id: number,
  name: string | undefined,
  day: number,
): number {
  if (pol.factionIdx(id) >= 0 || !pol.living(id)) return -1;
  if (pol.factions.length >= WW_MAX_FACTIONS) return -1;
  const tag = pol.tagOf(id);
  const row = pol.content.factionNames.find((n) => n.creators.includes(tag));
  const chosen = name ?? row?.id ?? "auto";
  const idx = pol.nextFactionIdx++;
  pol.factions.push({
    idx,
    name: chosen,
    nameTag: chosen === "auto" ? tag : "",
    leader: id,
    members: [id],
    createdDay: day,
  });
  pol.factionsChanged();
  pol.messageAll("ww1936_faction_joined", {
    countryTag: tag,
    faction: factionKeyOf(idx),
  });
  return idx;
}

/**
 * Spec §15.5: member `a` declared on (or joined against) `b`: a leader
 * calls every other member, a member its leader. Controller ruling R21:
 * nobody already at war with `b`, allied to it, or held back by a pact or
 * a guarantee of it.
 */
export function callToArms(
  pol: WwPolitics,
  a: number,
  b: number,
  tick: number,
): void {
  const idx = pol.factionIdx(a);
  const f = idx < 0 ? null : pol.faction(idx);
  if (f === null) return;
  const to = f.leader === a ? f.members.filter((m) => m !== a) : [f.leader];
  const historical = pol.mg.config().historicalAi();
  const day = pol.day();
  for (const m of to) {
    if (m === b || !pol.living(m) || pol.ww.isAtWar(m, b)) continue;
    if (pol.sameFaction(m, b)) continue;
    if (declareWarRules(pol, m, b, true).block !== null) continue;
    // Controller ruling (lane D fix 1): with historical AI an AI member is
    // called only when history has it join (no event, no refusal penalty).
    if (historical && !pol.isHuman(m) && !warBeatDue(pol, m, b, day)) continue;
    pol.queueEvent("gen_call_to_arms", m, a, b, 0);
  }
  void tick;
}

/**
 * A declare / join history beat of `actor` on `target` still to come
 * (not skipped, not done) and due within 30 days (controller ruling R1,
 * final: lane E marks a beat done after it acts).
 */
export function warBeatDue(
  pol: WwPolitics,
  actor: number,
  target: number,
  day: number,
): boolean {
  if (actor <= 0 || target <= 0) return false;
  const a = pol.tagOf(actor);
  const t = pol.tagOf(target);
  return pol.content.beats.some((b, i) => {
    const s = pol.beats[i];
    if (s === undefined || s.skipped || s.done || b.actor !== a) return false;
    if (b.act.kind !== "declare" && b.act.kind !== "join") return false;
    return b.act.target === t && s.fireDay <= day + WW_BEAT_WINDOW_DEFAULT_DAYS;
  });
}

/**
 * Spec §15.5: the AI's answer to a call to arms (option a joins, b
 * refuses). Historical AI: a declare/join beat of `to` on `target` still
 * to come within 30 days (warBeatDue) joins, else it refuses. Otherwise by
 * weight: a leader's call 80 / 20, a member calling its leader 40 / 60
 * (20 / 80 against a major).
 */
export function callToArmsChoice(
  pol: WwPolitics,
  to: number,
  from: number,
  target: number,
): string {
  const day = pol.day();
  if (pol.mg.config().historicalAi()) {
    return warBeatDue(pol, to, target, day) ? "a" : "b";
  }
  const leader = pol.faction(pol.factionIdx(to))?.leader ?? 0;
  // A leader's call (from = leader) or anyone else's: 80; to the leader: 40 / 20.
  const joinPct =
    to === leader && from !== leader ? (isMajor(pol, target) ? 20 : 40) : 80;
  const roll =
    (wwRoll(pol.seed, P_EVT, idHash("gen_call_to_arms"), to, day) >>> 8) % 100;
  return roll < joinPct ? "a" : "b";
}
