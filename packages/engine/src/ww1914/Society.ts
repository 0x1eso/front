// Great War 1914 (ww207/ww208, lane S1): the society under the parties. The
// axes, communities, support, by-elections, general elections and their
// rules, births, splits, merges, deaths, the fervour term, the orders
// faction_promote / faction_condemn, the `poll` task's slots and the strip's
// view. Rows: engine-lib/ww1914/SocietyRows, the generic parties'
// engine-lib/ww1914/GenericParties. See /home/eser/dev/ww207-format.md and
// the design /home/eser/dev/ww207-factions.md §2-3.
//
// The rules in short:
// - An axis is notches (GW_AXIS_NOTCHES a step, ±GW_AXIS_MAX steps). A bill's
//   text pushes it (lawAxes); the war pulls it (warDrift): defeat toward the
//   parliament and accommodation, hunger toward labour, Britain's war toward
//   control.
// - A community heats each month the axes stand against its ideal and cools
//   otherwise; every six months it grows when they stand two steps on its
//   side and shrinks two steps against.
// - A faction's support moves one every two months toward its target: its
//   start, plus one per step the axes stand on its ideals (minus against),
//   plus its communities' growth, plus its trust's sign at ±2.
// - Seats move only at elections: a general one when its chamber's term runs
//   out (postponed in war by its `postpone` law), on a dissolution's return
//   or a new regime (effect `election`); a by-election every GW_BY_EVERY
//   chapters. Seats swing by support since the last general election
//   (`polled`), under the chamber's rule: fptp doubles the swing, two rounds
//   share a rising ally's gain, curia weights by the franchise in force.
// - Births: a hot community nobody sitting speaks for, or the axes moved on
//   all three since the last birth; a real birth row first, then a generic
//   party. A real row's opposite follows GW_OPPOSITE_AFTER chapters later.
// - Splits by state: temper 3 under a radical leader, or its communities
//   pulled two steps apart. Merges by state: small (support ≤ 3) factions of
//   the same ideals. Death: support 0 and no seats after an election.
// - Fervour: hot factions and communities wear order down (line
//   `society_fervour`).
import type {
  GwNationState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwSlots } from "@openfront/engine-api/ww1914/GwDepts";
import type {
  GwChamber,
  GwFactionState,
} from "@openfront/engine-api/ww1914/GwHouse";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import {
  axesOf,
  GW_AXIS_MAX,
  GW_AXIS_NOTCHES,
  GW_BY_EVERY,
  GW_BY_SEATS,
  GW_COMMUNITY_SIZE_MAX,
  GW_FACTION_SUPPORT_MAX,
  GW_FRANCHISES,
  GW_TRUST_MAX,
  gwSocietyStart,
  type GwAxis,
  type GwAxisPush,
  type GwCommunityState,
  type GwElection,
  type GwElectionCause,
  type GwFranchise,
  type GwIdeals,
  type GwSocietyState,
  type GwSocietyView,
  type GwStripFactionView,
} from "@openfront/engine-api/ww1914/GwSociety";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { genericFactionRows } from "@openfront/engine-lib/ww1914/GenericParties";
import type {
  GwChamberRow,
  GwFactionRow,
} from "@openfront/engine-lib/ww1914/HouseRows";
import type { GwLawRow } from "@openfront/engine-lib/ww1914/LawRows";
import { GW_SPLIT_PRESSURE } from "@openfront/engine-lib/ww1914/MoneyRows";
import {
  genericFactionId,
  GW_COMMUNITY_STEPS,
  GW_GENERIC_KINDS,
  GW_OPPOSITE_AFTER,
  type GwBirthRow,
  type GwCommunityRow,
  type GwGenericPartyRow,
} from "@openfront/engine-lib/ww1914/SocietyRows";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import type { GreatWar } from "./GreatWar";
import {
  ensureFaction,
  factionLeader,
  factionOf,
  factionRow,
  factionRows,
  heatBy,
  heatForTemper,
  houseRow,
  joinFactions,
  seatsNow,
  splitFaction,
} from "./House";
import { holds, sceneOf, type SceneCtx } from "./SceneRun";
import { abilityView, treeView } from "./Utopia";
import { clampTo, moveGauge, news, reason } from "./World";

export type SocietyCond = Extract<
  GwWorldCond,
  {
    is:
      | "axis"
      | "support"
      | "faction_trust"
      | "community"
      | "community_trust"
      | "election_due";
  }
>;

export type SocietyEffect = Extract<
  GwWorldEffect,
  {
    do:
      | "axis"
      | "support"
      | "faction_trust"
      | "community"
      | "community_trust"
      | "election";
  }
>;

/** Support a newly born party starts with: a voice, no seats. */
export const GW_BORN_SUPPORT = 2;
/** Chapters a faction can't be promoted or condemned again. */
export const GW_JUDGE_COOL = 6;
/** Seats a promotion brings from the most opposed faction. */
export const GW_PROMOTE_SEATS = 2;
/** Merges by state: both at this support or under. */
export const GW_MERGE_SUPPORT = 3;
const AXIS_END = GW_AXIS_MAX * GW_AXIS_NOTCHES;

// ---- Rows ----

function communityRow(id: string): GwCommunityRow | null {
  return gwContent().society?.communities?.find((c) => c.id === id) ?? null;
}

function communityRows(tag: string): GwCommunityRow[] {
  return (gwContent().society?.communities ?? []).filter((c) => c.tag === tag);
}

function birthRows(tag: string): GwBirthRow[] {
  return (gwContent().society?.births ?? []).filter((b) => b.tag === tag);
}

/** The generic row behind a generic faction id; null for a real faction. */
function genericOf(row: GwFactionRow): GwGenericPartyRow | null {
  if (!genericFactionRows(gwContent()).includes(row)) return null;
  for (const kind of GW_GENERIC_KINDS) {
    const base = genericFactionId(row.tag, kind);
    if (row.id === base || row.id.startsWith(`${base}_`)) {
      return gwContent().society?.generic?.find((g) => g.kind === kind) ?? null;
    }
  }
  return null;
}

const ctxOf = (gw: GreatWar, seat: GwSeatState): SceneCtx => ({
  gw,
  seat,
  cast: {},
});

// ---- Axes ----

const stepOf = (notches: number): number =>
  Math.trunc(notches / GW_AXIS_NOTCHES);

/** The country's step on an axis, -3..3. */
export function axisStep(n: GwNationState | null, axis: GwAxis): number {
  return stepOf(n?.axes?.[axis] ?? 0);
}

/** Moves the country's axis by notches. */
export function moveAxis(
  n: GwNationState | null,
  axis: GwAxis,
  delta: number,
): void {
  if (n === null || delta === 0) return;
  n.axes ??= {};
  n.axes[axis] = clampTo((n.axes[axis] ?? 0) + delta, -AXIS_END, AXIS_END);
}

/** A push on the country's axes: a bill's text, a node, a power. */
export function pushAxes(n: GwNationState | null, push: GwAxisPush): void {
  for (const [axis, d] of Object.entries(push) as [GwAxis, number][]) {
    moveAxis(n, axis, d);
  }
}

/** How far the axes stand on a faction's ideals: steps, + for, - against. */
function leanOf(n: GwNationState | null, ideals: GwIdeals): number {
  let lean = 0;
  for (const [axis, side] of Object.entries(ideals) as [GwAxis, number][]) {
    lean += (side ?? 0) * axisStep(n, axis);
  }
  return lean;
}

const hasIdeals = (i: GwIdeals | undefined): boolean =>
  Object.values(i ?? {}).some((v) => v !== 0);

const sameIdeals = (a: GwIdeals, b: GwIdeals): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<GwAxis>;
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
};

/** Ideals that agree minus those that clash. */
const accord = (a: GwIdeals, b: GwIdeals): number => {
  let n = 0;
  for (const [k, v] of Object.entries(a) as [GwAxis, number][]) {
    n += (v ?? 0) * (b[k] ?? 0);
  }
  return n;
};

/** The war's pull, a notch a month (see the head of the file). */
function warDrift(gw: GreatWar, seat: GwSeatState, months: number): void {
  const n = gw.nation(seat.tag);
  if (n === null || months === 0 || n.atWar.length === 0) return;
  const axes = axesOf(seat.tag);
  if (seat.tag === "GBR") {
    if (beats(gw, 3) > 0) moveAxis(n, "rule", -1);
  } else if (n.gauges.morale <= 1) {
    moveAxis(n, "rule", months);
    if (axes.includes("force")) moveAxis(n, "force", months);
  }
  if (n.gauges.bread === 0) moveAxis(n, "class", months);
}

// ---- Time ----

/** How many `k`-month marks since the game began fall in this chapter. */
function beats(gw: GreatWar, k: number): number {
  const days = gwChapters(gw.s.calendar);
  const ch = days[gw.s.chapter];
  const start = ch.day - days[0].day;
  const end = start + ch.spanDays;
  const at = (d: number) => Math.floor(d / (30 * k));
  return at(end) - at(start);
}

/** The first chapter on or after a day; null past the calendar. */
function chapterAt(gw: GreatWar, day: number): number | null {
  const ch = gwChapters(gw.s.calendar).find((c) => c.day >= day);
  return ch === undefined ? null : ch.index;
}

function dayOfMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return daysFromCivil(y, m, 1);
}

// ---- State ----

function ensureSociety(gw: GreatWar, seat: GwSeatState): GwSocietyState {
  if (seat.society === undefined) {
    seat.society = gwSocietyStart();
    seat.society.bornAt = { ...(gw.nation(seat.tag)?.axes ?? {}) };
  }
  const soc = seat.society;
  for (const row of communityRows(seat.tag)) {
    if (soc.communities.some((c) => c.id === row.id)) continue;
    soc.communities.push({
      id: row.id,
      size: clampTo(row.size, 1, GW_COMMUNITY_SIZE_MAX),
      trust: clampTo(row.trust ?? 0, -GW_TRUST_MAX, GW_TRUST_MAX),
      heat: 0,
      step: 0,
      stirred: -9,
    });
  }
  return soc;
}

/** The first chamber with seats the row names, and its share there. */
function startSupport(row: GwFactionRow): number {
  if (row.support !== undefined) {
    return clampTo(row.support, 0, GW_FACTION_SUPPORT_MAX);
  }
  const house = houseRow(row.tag);
  for (const c of house?.chambers ?? []) {
    const k = row.seats[c.id] ?? 0;
    if (k <= 0) continue;
    const size = c.size ?? 0;
    if (size <= 0) return 1;
    return clampTo(Math.round((k * 20) / size), 1, GW_FACTION_SUPPORT_MAX);
  }
  return 1;
}

/** A faction's support now. */
export function supportOf(st: GwFactionState): number {
  const row = factionRow(st.id);
  return st.support ?? (row === null ? 0 : startSupport(row));
}

/** A faction's trust in the seat now. */
export function factionTrust(st: GwFactionState): number {
  return st.trust ?? factionRow(st.id)?.trust ?? 0;
}

/** Its support at the last general election; its start before any. */
function polledOf(st: GwFactionState): number {
  if (st.polled !== undefined) return st.polled;
  const row = factionRow(st.id);
  return row === null ? 0 : startSupport(row);
}

const sitting = (st: GwFactionState): boolean =>
  st.status === "in" || st.status === "under";

function idealsOf(id: string): GwIdeals {
  return factionRow(id)?.ideals ?? {};
}

/** Communities that share one of the faction's ideals. */
function communitiesOf(
  seat: GwSeatState,
  ideals: GwIdeals,
): GwCommunityState[] {
  return (seat.society?.communities ?? []).filter((c) => {
    const row = communityRow(c.id);
    return row !== null && ideals[row.ideal.axis] === row.ideal.side;
  });
}

function communityTemper(row: GwCommunityRow, heat: number): number {
  if (heat <= 0) return 0;
  const steps = row.steps ?? GW_COMMUNITY_STEPS;
  return 1 + steps.filter((s) => heat >= s).length;
}

function heatCommunity(c: GwCommunityState, delta: number): void {
  const row = communityRow(c.id);
  if (row === null) return;
  const steps = row.steps ?? GW_COMMUNITY_STEPS;
  const cap = steps[steps.length - 1] ?? 10;
  c.heat = clampTo(c.heat + delta, 0, cap);
  c.step = communityTemper(row, c.heat);
}

// ---- The chapter step ----

/** The chapter's society step, after the house's (GW_CHAPTER_STEPS). */
export function societyStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.memoir !== null || seat.house === undefined) continue;
    const soc = ensureSociety(gw, seat);
    const n = gw.nation(seat.tag);
    soc.was = { ...(n?.axes ?? {}) };
    const months = beats(gw, 1);
    warDrift(gw, seat, months);
    communitiesStep(gw, seat, soc, months);
    supportStep(gw, seat);
    birthStep(gw, seat, soc);
    splitsAndMerges(gw, seat);
    electionsDue(gw, seat);
    byElection(gw, seat, soc);
    fervour(gw, seat, soc);
  }
}

function communitiesStep(
  gw: GreatWar,
  seat: GwSeatState,
  soc: GwSocietyState,
  months: number,
): void {
  const n = gw.nation(seat.tag);
  const grow = beats(gw, 6);
  for (const c of soc.communities) {
    const row = communityRow(c.id);
    if (row === null) continue;
    const lean = row.ideal.side * axisStep(n, row.ideal.axis);
    if (months > 0) heatCommunity(c, lean < 0 ? -lean * months : -months);
    if (grow > 0 && lean >= 2) {
      c.size = Math.min(GW_COMMUNITY_SIZE_MAX, c.size + 1);
    }
    if (grow > 0 && lean <= -2) c.size = Math.max(1, c.size - 1);
  }
}

function targetOf(gw: GreatWar, seat: GwSeatState, st: GwFactionState) {
  const row = factionRow(st.id);
  if (row === null) return 0;
  const ideals = row.ideals ?? {};
  let t = startSupport(row) + leanOf(gw.nation(seat.tag), ideals);
  for (const c of communitiesOf(seat, ideals)) {
    t += c.size - (communityRow(c.id)?.size ?? c.size);
  }
  const trust = factionTrust(st);
  if (trust >= 2) t++;
  if (trust <= -2) t--;
  return clampTo(t, 0, GW_FACTION_SUPPORT_MAX);
}

function supportStep(gw: GreatWar, seat: GwSeatState): void {
  const moves = beats(gw, 2);
  if (moves === 0) return;
  for (const st of seat.house?.factions ?? []) {
    if (!sitting(st)) continue;
    const now = supportOf(st);
    const target = targetOf(gw, seat, st);
    if (now === target) continue;
    const by = Math.min(moves, Math.abs(target - now));
    st.support = now + (target > now ? by : -by);
  }
}

// ---- Births ----

function bear(
  gw: GreatWar,
  seat: GwSeatState,
  soc: GwSocietyState,
  id: string,
  birth: GwBirthRow | null,
): void {
  const st = ensureFaction(gw, seat, id);
  if (st === null) return;
  st.status = "in";
  st.since = gw.s.chapter;
  st.born = gw.s.chapter;
  st.support = GW_BORN_SUPPORT;
  st.polled = 0;
  st.strength = Math.max(1, st.strength);
  st.leader = factionLeader(gw, seat, id);
  soc.births.push({ id, chapter: gw.s.chapter });
  soc.bornAt = { ...(gw.nation(seat.tag)?.axes ?? {}) };
  if (birth?.scene !== undefined && sceneOf(birth.scene) !== null) {
    seat.scheduled.push({ scene: birth.scene, chapter: gw.s.chapter + 1 });
  }
  saidOf(gw, seat, "society_born", st.leader);
  news(gw, "society_born", seat.tag);
}

/** Waiting to be born: `out` and never born before. */
function unborn(seat: GwSeatState, soc: GwSocietyState, id: string): boolean {
  const st = factionOf(seat, id);
  const waiting =
    st === null
      ? factionRow(id)?.tag === seat.tag &&
        genericFactionRows(gwContent()).includes(factionRow(id)!)
      : st.status === "out";
  return waiting && !soc.births.some((b) => b.id === id);
}

function birthHolds(gw: GreatWar, seat: GwSeatState, b: GwBirthRow): boolean {
  return b.when === undefined || holds(ctxOf(gw, seat), b.when);
}

function genericHolds(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwFactionRow,
): boolean {
  const g = genericOf(row);
  return g !== null && (g.when === undefined || holds(ctxOf(gw, seat), g.when));
}

function birthStep(gw: GreatWar, seat: GwSeatState, soc: GwSocietyState) {
  const c = gw.s.chapter;
  // A real birth's opposite, its time come.
  for (const b of soc.births) {
    const row = birthRows(seat.tag).find((r) => r.faction === b.id);
    const opp = row?.opposite;
    if (opp === undefined || c < b.chapter + GW_OPPOSITE_AFTER) continue;
    if (!unborn(seat, soc, opp)) continue;
    const own = birthRows(seat.tag).find((r) => r.faction === opp) ?? null;
    bear(gw, seat, soc, opp, own);
    return;
  }
  const last = soc.births[soc.births.length - 1];
  if (last !== undefined && c - last.chapter < GW_OPPOSITE_AFTER) return;
  if (hotBirth(gw, seat, soc)) return;
  zeitgeistBirth(gw, seat, soc);
}

/** A hot community nobody sitting speaks for gives birth to its party. */
function hotBirth(
  gw: GreatWar,
  seat: GwSeatState,
  soc: GwSocietyState,
): boolean {
  const hot = soc.communities
    .filter((k) => k.step >= 2)
    .sort((a, b) => b.step - a.step || b.heat - a.heat);
  for (const k of hot) {
    const row = communityRow(k.id);
    if (row === null) continue;
    const { axis, side } = row.ideal;
    const voiced = (seat.house?.factions ?? []).some(
      (f) => f.status === "in" && idealsOf(f.id)[axis] === side,
    );
    if (voiced) continue;
    const real = birthRows(seat.tag).find(
      (b) =>
        b.from === k.id &&
        unborn(seat, soc, b.faction) &&
        birthHolds(gw, seat, b),
    );
    if (real !== undefined) {
      bear(gw, seat, soc, real.faction, real);
      return true;
    }
    const generic = genericRowsFor(seat.tag, k.id).find(
      (g) =>
        g.ideals?.[axis] === side &&
        unborn(seat, soc, g.id) &&
        genericHolds(gw, seat, g),
    );
    if (generic !== undefined) {
      bear(gw, seat, soc, generic.id, null);
      return true;
    }
  }
  return false;
}

/** The seat's generic rows: the community's nationalist one first. */
function genericRowsFor(tag: string, community?: string): GwFactionRow[] {
  const all = genericFactionRows(gwContent()).filter((r) => r.tag === tag);
  const nat =
    community === undefined
      ? []
      : all.filter(
          (r) => r.id === genericFactionId(r.tag, "nationalist", community),
        );
  const plain = all.filter((r) => !r.id.includes("_g_nationalist"));
  return [...nat, ...plain];
}

/** The axes moved on all three since the last birth: the party then ahead. */
function zeitgeistBirth(
  gw: GreatWar,
  seat: GwSeatState,
  soc: GwSocietyState,
): boolean {
  const n = gw.nation(seat.tag);
  const dirs: Partial<Record<GwAxis, -1 | 1>> = {};
  for (const axis of axesOf(seat.tag)) {
    const moved = (n?.axes?.[axis] ?? 0) - (soc.bornAt[axis] ?? 0);
    if (Math.abs(moved) < GW_AXIS_NOTCHES) return false;
    dirs[axis] = moved > 0 ? 1 : -1;
  }
  let best: { id: string; birth: GwBirthRow | null; score: number } | null =
    null;
  for (const b of birthRows(seat.tag)) {
    if (!unborn(seat, soc, b.faction) || !birthHolds(gw, seat, b)) continue;
    const score = accord(idealsOf(b.faction), dirs);
    if (score >= 2 && (best === null || score > best.score)) {
      best = { id: b.faction, birth: b, score };
    }
  }
  for (const g of genericRowsFor(seat.tag)) {
    if (!unborn(seat, soc, g.id) || !genericHolds(gw, seat, g)) continue;
    const score = accord(g.ideals ?? {}, dirs);
    if (score >= 2 && (best === null || score > best.score)) {
      best = { id: g.id, birth: null, score };
    }
  }
  // Nobody fits: the moment passes, and the next birth counts from here.
  if (best === null) {
    soc.bornAt = { ...(n?.axes ?? {}) };
    return false;
  }
  bear(gw, seat, soc, best.id, best.birth);
  return true;
}

// ---- Splits and merges by state ----

function splitsAndMerges(gw: GreatWar, seat: GwSeatState): void {
  const n = gw.nation(seat.tag);
  for (const row of factionRows(seat.tag)) {
    const st = factionOf(seat, row.id);
    if (st?.status !== "in") continue;
    if (row.splits !== undefined) {
      const radical =
        st.step >= 3 && row.radical !== undefined && st.leader === row.radical;
      const leans = communitiesOf(seat, row.ideals ?? {}).map((c) => {
        const r = communityRow(c.id)!;
        return r.ideal.side * axisStep(n, r.ideal.axis);
      });
      const torn = leans.some((l) => l >= 2) && leans.some((l) => l <= -2);
      // ww209: its wing defied the line, or was peeled, often enough.
      const pressed = (st.split ?? 0) >= GW_SPLIT_PRESSURE;
      if ((radical || torn || pressed) && splitFaction(gw, seat, row)) {
        st.split = 0;
        continue;
      }
    }
    if (row.joins !== undefined && smallAlike(seat, row)) {
      joinFactions(gw, seat, row);
    }
  }
  mergeAlike(gw, seat);
}

/** A join row's sitting members: two or more, small, of the same ideals. */
function smallAlike(seat: GwSeatState, row: GwFactionRow): boolean {
  const ids = [row.id, ...(row.joins?.with ?? [])];
  const members = ids
    .map((id) => factionOf(seat, id))
    .filter((m): m is GwFactionState => m?.status === "in");
  if (members.length < 2) return false;
  const first = idealsOf(members[0].id);
  if (!hasIdeals(first)) return false;
  return members.every(
    (m) =>
      supportOf(m) <= GW_MERGE_SUPPORT && sameIdeals(idealsOf(m.id), first),
  );
}

/** Two small factions of the same ideals and no join row: the smaller goes in. */
function mergeAlike(gw: GreatWar, seat: GwSeatState): void {
  const list = (seat.house?.factions ?? []).filter((f) => {
    const row = factionRow(f.id);
    return (
      f.status === "in" &&
      row !== null &&
      row.joins === undefined &&
      hasIdeals(row.ideals) &&
      supportOf(f) <= GW_MERGE_SUPPORT
    );
  });
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!sameIdeals(idealsOf(a.id), idealsOf(b.id))) continue;
      const bFirst =
        supportOf(b) > supportOf(a) ||
        (supportOf(b) === supportOf(a) && seatSum(seat, b) > seatSum(seat, a));
      const [big, small] = bFirst ? [b, a] : [a, b];
      const pooled: Partial<Record<GwChamber, number>> = {
        ...seatsOf(seat, big),
      };
      for (const [c, k] of Object.entries(seatsOf(seat, small)) as [
        GwChamber,
        number,
      ][]) {
        pooled[c] = (pooled[c] ?? 0) + (k ?? 0);
      }
      big.seats = pooled;
      big.support = Math.min(
        GW_FACTION_SUPPORT_MAX,
        supportOf(big) + supportOf(small),
      );
      small.status = "merged";
      small.since = gw.s.chapter;
      saidOf(gw, seat, "society_merged", big.leader);
      news(gw, "society_merged", seat.tag);
      return;
    }
  }
}

// ---- Seats and elections ----

function seatsOf(
  seat: GwSeatState,
  st: GwFactionState,
): Partial<Record<GwChamber, number>> {
  const row = factionRow(st.id);
  return row === null
    ? ((st.seats ?? {}) as Partial<Record<GwChamber, number>>)
    : seatsNow(seat, row);
}

function seatSum(seat: GwSeatState, st: GwFactionState): number {
  return Object.values(seatsOf(seat, st)).reduce<number>(
    (a, k) => a + (k ?? 0),
    0,
  );
}

function setSeats(
  seat: GwSeatState,
  st: GwFactionState,
  chamber: GwChamber,
  k: number,
): void {
  st.seats = { ...seatsOf(seat, st), [chamber]: k };
}

/** The house's chambers that are elected. */
function electedChambers(tag: string): GwChamberRow[] {
  return (houseRow(tag)?.chambers ?? []).filter((c) => c.elect !== undefined);
}

/** Who stands in an election of this chamber. */
function standing(seat: GwSeatState, chamber: GwChamberRow): GwFactionState[] {
  const first = electedChambers(seat.tag)[0]?.id;
  return (seat.house?.factions ?? []).filter((st) => {
    if (st.status !== "in") return false;
    const row = factionRow(st.id);
    if (row === null) return false;
    if ((seatsOf(seat, st)[chamber.id] ?? 0) > 0) return true;
    if ((row.seats[chamber.id] ?? 0) > 0) return true;
    const sitsNowhere = Object.values(row.seats).every((k) => (k ?? 0) <= 0);
    return st.born !== undefined && sitsNowhere && chamber.id === first;
  });
}

/** A class ideal's weight in tenths under a franchise: narrow favours property. */
function franchiseWeight(classIdeal: number, f: GwFranchise): number {
  const narrow = GW_FRANCHISES.length - 1 - GW_FRANCHISES.indexOf(f);
  return Math.max(2, 10 - classIdeal * narrow * 3);
}

/** The franchise in force for a chamber: a bill's, else its row's. */
export function franchiseOf(
  seat: GwSeatState,
  chamber: GwChamberRow,
): GwFranchise {
  return (
    seat.society?.franchise[chamber.id] ?? chamber.elect?.franchise ?? "equal"
  );
}

/**
 * The seats each faction standing would take now, in the chamber's seats
 * among them (seats of nobody's stay where they are). Largest remainder.
 */
function allocate(
  seat: GwSeatState,
  chamber: GwChamberRow,
  list: readonly GwFactionState[],
): Map<string, number> {
  const rule = chamber.elect?.rule ?? "two_round";
  const size = chamber.size ?? 0;
  const now = list.map((st) => seatsOf(seat, st)[chamber.id] ?? 0);
  const total = now.reduce((a, k) => a + k, 0) || size;
  // Votes in hundredths of a seat: last time's seats swung by support since.
  const votes = list.map((st, i) => {
    const s = supportOf(st);
    const p = polledOf(st);
    if (s <= 0) return 0;
    if (now[i] > 0 && p > 0) return Math.trunc((now[i] * s * 100) / p);
    return Math.trunc((Math.max(size, total) * s * 100) / 40);
  });
  const swing = votes.map((v, i) => v - now[i] * 100);
  const weights = list.map((st, i) => {
    const v = votes[i];
    if (v === 0) return 0;
    if (rule === "fptp") return Math.max(0, now[i] * 100 + 2 * swing[i]);
    if (rule === "curia") {
      const cls = idealsOf(st.id).class ?? 0;
      const start = chamber.elect?.franchise ?? "equal";
      const f = franchiseOf(seat, chamber);
      return Math.trunc(
        (v * franchiseWeight(cls, f)) / franchiseWeight(cls, start),
      );
    }
    // Two rounds: a rising ally's gain is shared in the second round.
    let w = v;
    list.forEach((other, j) => {
      if (j === i || swing[j] <= 0) return;
      if (accord(idealsOf(st.id), idealsOf(other.id)) >= 2) {
        w += Math.trunc(swing[j] / 2);
      }
    });
    return Math.max(0, w);
  });
  const sum = weights.reduce((a, w) => a + w, 0);
  const out = new Map<string, number>();
  if (sum === 0) {
    list.forEach((st, i) => out.set(st.id, now[i]));
    return out;
  }
  const exact = weights.map((w) => w * total);
  const base = exact.map((e) => Math.floor(e / sum));
  let left = total - base.reduce((a, k) => a + k, 0);
  const order = exact
    .map((e, i) => ({ i, r: e % sum }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (weights[i] === 0) continue;
    base[i]++;
    left--;
  }
  list.forEach((st, i) => out.set(st.id, base[i]));
  return out;
}

function record(
  gw: GreatWar,
  seat: GwSeatState,
  chamber: GwChamber,
  cause: GwElectionCause,
  seats: GwElection["seats"],
): GwElection {
  const soc = ensureSociety(gw, seat);
  const last = soc.elections[soc.elections.length - 1];
  const e: GwElection = {
    uid: (last?.uid ?? 0) + 1,
    chamber,
    cause,
    chapter: gw.s.chapter,
    seats,
  };
  soc.elections.push(e);
  return e;
}

/**
 * A general election of the chamber now: the seats go out by support under
 * its rule, the parties with no support and no seats are gone.
 */
export function generalElection(
  gw: GreatWar,
  seat: GwSeatState,
  chamber: GwChamber,
  cause: Exclude<GwElectionCause, "by">,
): GwElection | null {
  const row = electedChambers(seat.tag).find((c) => c.id === chamber);
  if (row === undefined || seat.house === undefined) return null;
  ensureSociety(gw, seat);
  const list = standing(seat, row);
  const after = allocate(seat, row, list);
  const seats = list.map((st) => ({
    faction: st.id,
    before: seatsOf(seat, st)[chamber] ?? 0,
    after: after.get(st.id) ?? 0,
  }));
  for (const st of list) setSeats(seat, st, chamber, after.get(st.id) ?? 0);
  for (const st of list) st.polled = supportOf(st);
  seats.sort((a, b) => b.after - a.after);
  const e = record(gw, seat, chamber, cause, seats);
  reason(gw, seat, `society_election_${cause}`);
  news(gw, "society_election", seat.tag);
  deaths(gw, seat);
  return e;
}

/** No support and no seats after an election: the party is gone. */
function deaths(gw: GreatWar, seat: GwSeatState): void {
  for (const st of seat.house?.factions ?? []) {
    if (st.status !== "in" || supportOf(st) > 0 || seatSum(seat, st) > 0) {
      continue;
    }
    st.status = "gone";
    st.since = gw.s.chapter;
    saidOf(gw, seat, "society_gone", st.leader);
    news(gw, "society_gone", seat.tag);
  }
}

/** The chapter a chamber's next general election is due; null none in the game. */
export function electionDue(
  gw: GreatWar,
  seat: GwSeatState,
  chamber: GwChamberRow,
): number | null {
  const elect = chamber.elect;
  if (elect === undefined) return null;
  const general = (seat.society?.elections ?? []).filter(
    (e) => e.chamber === chamber.id && e.cause !== "by",
  );
  const last = general[general.length - 1];
  if (last === undefined) return chapterAt(gw, dayOfMonth(elect.due));
  const at = gwChapters(gw.s.calendar)[last.chapter].day;
  return chapterAt(gw, at + elect.term * 365);
}

function postponed(gw: GreatWar, seat: GwSeatState, c: GwChamberRow): boolean {
  const n = gw.nation(seat.tag);
  const law = c.elect?.postpone;
  if (n === null || law === undefined || n.atWar.length === 0) return false;
  return n.laws.some((x) => x.id === law && x.stage === "force");
}

function chamberOpen(gw: GreatWar, seat: GwSeatState, c: GwChamberRow) {
  return c.sits === undefined || holds(ctxOf(gw, seat), c.sits);
}

function electionsDue(gw: GreatWar, seat: GwSeatState): void {
  for (const c of electedChambers(seat.tag)) {
    const due = electionDue(gw, seat, c);
    if (due === null || gw.s.chapter < due) continue;
    if (!chamberOpen(gw, seat, c) || postponed(gw, seat, c)) continue;
    generalElection(gw, seat, c.id, "due");
  }
}

/** Every GW_BY_EVERY chapters 1..3 seats go from the most fallen to the most risen. */
function byElection(gw: GreatWar, seat: GwSeatState, soc: GwSocietyState) {
  if (gw.s.chapter - soc.byAt < GW_BY_EVERY) return;
  soc.byAt = gw.s.chapter;
  const chamber = electedChambers(seat.tag).find((c) =>
    chamberOpen(gw, seat, c),
  );
  if (chamber === undefined) return;
  if (soc.elections.some((e) => e.chapter === gw.s.chapter)) return;
  const list = standing(seat, chamber);
  const gap = (st: GwFactionState) => supportOf(st) - polledOf(st);
  let up: GwFactionState | null = null;
  let down: GwFactionState | null = null;
  for (const st of list) {
    if (gap(st) > 0 && (up === null || gap(st) > gap(up))) up = st;
    const has = (seatsOf(seat, st)[chamber.id] ?? 0) > 0;
    if (has && gap(st) < 0 && (down === null || gap(st) < gap(down))) {
      down = st;
    }
  }
  if (up === null || down === null) return;
  const had = seatsOf(seat, down)[chamber.id] ?? 0;
  const k = Math.min(GW_BY_SEATS, gap(up), -gap(down), had);
  if (k <= 0) return;
  const upHad = seatsOf(seat, up)[chamber.id] ?? 0;
  setSeats(seat, down, chamber.id, had - k);
  setSeats(seat, up, chamber.id, upHad + k);
  record(gw, seat, chamber.id, "by", [
    { faction: up.id, before: upHad, after: upHad + k },
    { faction: down.id, before: had, after: had - k },
  ]);
  saidOf(gw, seat, "society_by", up.leader);
  news(gw, "society_by", seat.tag);
}

// ---- Fervour ----

/** Hot factions and communities wear order down (a line, key society_fervour). */
function fervour(gw: GreatWar, seat: GwSeatState, soc: GwSocietyState): void {
  let f = 0;
  for (const st of seat.house?.factions ?? []) {
    if (sitting(st) && st.step >= 2) f += st.step - 1;
  }
  for (const c of soc.communities) if (c.step >= 2) f += c.step - 1;
  const every = f >= 8 ? 3 : f >= 4 ? 6 : 0;
  if (every === 0) return;
  const k = beats(gw, every);
  if (k > 0) moveGauge(gw, seat.tag, "order", -k, "society_fervour");
}

// ---- Laws ----

/**
 * A law passed (Laws.enact, Laws.lawAiStep): its text's axis push. For a
 * seat, the factions whose bill it is gain support. AI countries keep no
 * society: only their axes move.
 */
export function lawAxes(
  gw: GreatWar,
  seat: GwSeatState | null,
  row: GwLawRow,
  text: string | null,
): void {
  const n = gw.nation(row.tag);
  const draft = row.draft.find((d) => d.id === text) ?? row.draft[0];
  if (draft?.axes !== undefined) pushAxes(n, draft.axes);
  if (draft?.franchise !== undefined && seat !== null) {
    ensureSociety(gw, seat).franchise[draft.franchise.chamber] =
      draft.franchise.to;
  }
  if (seat === null || seat.house === undefined) return;
  for (const st of seat.house.factions) {
    if (!sitting(st)) continue;
    if (!(factionRow(st.id)?.bills ?? []).includes(row.id)) continue;
    st.support = Math.min(GW_FACTION_SUPPORT_MAX, supportOf(st) + 1);
  }
}

/** A reason line naming the leader, or its plain form for a leaderless party. */
function saidOf(
  gw: GreatWar,
  seat: GwSeatState,
  key: string,
  who: string | null,
): void {
  if (who === null) reason(gw, seat, `${key}_plain`);
  else reason(gw, seat, key, who);
}

// ---- World conds and effects ----

const inRange = (v: number, r: { min?: number; max?: number }) =>
  (r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max);

function communityOf(seat: GwSeatState, id: string): GwCommunityState | null {
  return seat.society?.communities.find((c) => c.id === id) ?? null;
}

/** A community as it starts, for a cond read before the first step. */
function communityStart(id: string): GwCommunityState | null {
  const row = communityRow(id);
  if (row === null) return null;
  return {
    id,
    size: row.size,
    trust: row.trust ?? 0,
    heat: 0,
    step: 0,
    stirred: -9,
  };
}

export function societyHolds(ctx: SceneCtx, c: SocietyCond): boolean {
  const { gw, seat } = ctx;
  switch (c.is) {
    case "axis":
      return inRange(axisStep(gw.nation(seat.tag), c.axis), c);
    case "support": {
      const st = factionOf(seat, c.id);
      return st !== null && inRange(supportOf(st), c);
    }
    case "faction_trust": {
      const st = factionOf(seat, c.id);
      return st !== null && inRange(factionTrust(st), c);
    }
    case "community": {
      const k = communityOf(seat, c.id) ?? communityStart(c.id);
      return k !== null && inRange(k.step, c);
    }
    case "community_trust": {
      const k = communityOf(seat, c.id) ?? communityStart(c.id);
      return k !== null && inRange(k.trust, c);
    }
    case "election_due": {
      const row = electedChambers(seat.tag).find((x) => x.id === c.chamber);
      const due = row === undefined ? null : electionDue(gw, seat, row);
      return due !== null && inRange(Math.max(0, due - gw.s.chapter), c);
    }
  }
}

export function societyDo(ctx: SceneCtx, e: SocietyEffect): void {
  const { gw, seat } = ctx;
  switch (e.do) {
    case "axis":
      moveAxis(gw.nation(seat.tag), e.axis, e.delta);
      return;
    case "support": {
      const st = factionOf(seat, e.id);
      if (st === null) return;
      st.support = clampTo(supportOf(st) + e.delta, 0, GW_FACTION_SUPPORT_MAX);
      return;
    }
    case "faction_trust": {
      const st = factionOf(seat, e.id);
      if (st === null) return;
      st.trust = clampTo(
        factionTrust(st) + e.delta,
        -GW_TRUST_MAX,
        GW_TRUST_MAX,
      );
      return;
    }
    case "community":
    case "community_trust": {
      if (seat.house === undefined) return;
      ensureSociety(gw, seat);
      const k = communityOf(seat, e.id);
      if (k === null) return;
      if (e.do === "community") heatCommunity(k, e.delta);
      else k.trust = clampTo(k.trust + e.delta, -GW_TRUST_MAX, GW_TRUST_MAX);
      return;
    }
    case "election":
      generalElection(gw, seat, e.chamber, e.cause);
      return;
  }
}

/**
 * A dissolved house is back (Assumes.electionStep): its first elected
 * chamber goes to the polls.
 */
export function dissolutionElection(gw: GreatWar, seat: GwSeatState): void {
  const c = electedChambers(seat.tag)[0];
  if (c !== undefined) generalElection(gw, seat, c.id, "dissolved");
}

// ---- Orders ----

function judgeBlock(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwOrderBlock | null {
  const st = factionOf(seat, faction);
  if (st === null || !sitting(st) || factionRow(faction) === null) {
    return "no_faction";
  }
  const at = st.judgedAt;
  if (at !== undefined && gw.s.chapter - at < GW_JUDGE_COOL) {
    return "faction_cool";
  }
  return null;
}

/**
 * Order `faction_promote` (지지한다): support +1, trust +1, and two seats from
 * the faction most opposed to it; the opposed lose trust.
 */
export function promoteFaction(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwOrderBlock | null {
  const block = judgeBlock(gw, seat, faction);
  if (block !== null) return block;
  ensureSociety(gw, seat);
  const st = factionOf(seat, faction)!;
  st.judgedAt = gw.s.chapter;
  st.support = Math.min(GW_FACTION_SUPPORT_MAX, supportOf(st) + 1);
  st.trust = Math.min(GW_TRUST_MAX, factionTrust(st) + 1);
  const mine = idealsOf(faction);
  const chamber = electedChambers(seat.tag)[0];
  let foe: GwFactionState | null = null;
  for (const o of seat.house?.factions ?? []) {
    if (o.id === faction || o.status !== "in") continue;
    const a = accord(mine, idealsOf(o.id));
    if (a < 0) o.trust = Math.max(-GW_TRUST_MAX, factionTrust(o) - 1);
    if (chamber === undefined || a >= 0) continue;
    if ((seatsOf(seat, o)[chamber.id] ?? 0) <= 0) continue;
    if (foe === null || a < accord(mine, idealsOf(foe.id))) foe = o;
  }
  if (foe !== null && chamber !== undefined) {
    const had = seatsOf(seat, foe)[chamber.id] ?? 0;
    const k = Math.min(GW_PROMOTE_SEATS, had);
    setSeats(seat, foe, chamber.id, had - k);
    setSeats(seat, st, chamber.id, (seatsOf(seat, st)[chamber.id] ?? 0) + k);
  }
  saidOf(gw, seat, "society_promoted", st.leader);
  return null;
}

/**
 * Order `faction_condemn` (규탄한다): a ban or arrests. Support -2, temper +2,
 * trust -1, and its communities heat.
 */
export function condemnFaction(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwOrderBlock | null {
  const block = judgeBlock(gw, seat, faction);
  if (block !== null) return block;
  ensureSociety(gw, seat);
  const st = factionOf(seat, faction)!;
  const row = factionRow(faction)!;
  st.judgedAt = gw.s.chapter;
  st.support = Math.max(0, supportOf(st) - 2);
  st.trust = Math.max(-GW_TRUST_MAX, factionTrust(st) - 1);
  const want = heatForTemper(row, st.step + 2);
  if (want > st.heat) heatBy(gw, seat, faction, want - st.heat);
  for (const c of communitiesOf(seat, row.ideals ?? {})) heatCommunity(c, 2);
  saidOf(gw, seat, "society_condemned", st.leader);
  return null;
}

// ---- The `poll` task ----

/**
 * The interior's reading (task `poll`): who would win an election now, who
 * rises and falls since the last, the hot communities, the next election's
 * chamber. The department's band makes it wrong, not these slots.
 */
export function pollSlots(gw: GreatWar, seat: GwSeatState): GwSlots {
  const out: GwSlots = {};
  if (seat.house === undefined) return out;
  const chamber = electedChambers(seat.tag)[0];
  if (chamber !== undefined) {
    const list = standing(seat, chamber);
    const seats = allocate(seat, chamber, list);
    let win: string | null = null;
    for (const st of list) {
      if (win === null || (seats.get(st.id) ?? 0) > (seats.get(win) ?? 0)) {
        win = st.id;
      }
    }
    if (win !== null) out.winner = { kind: "word", value: win };
  }
  const live = seat.house.factions.filter((st) => st.status === "in");
  const rising = live.filter((st) => supportOf(st) > polledOf(st));
  const falling = live.filter((st) => supportOf(st) < polledOf(st));
  if (rising.length > 0) {
    out.rising = { kind: "word", value: rising.map((s) => s.id).join(",") };
  }
  if (falling.length > 0) {
    out.falling = { kind: "word", value: falling.map((s) => s.id).join(",") };
  }
  const hot = (seat.society?.communities ?? []).filter((c) => c.step >= 2);
  if (hot.length > 0) {
    out.hot = { kind: "word", value: hot.map((c) => c.id).join(",") };
  }
  let next: { id: string; at: number } | null = null;
  for (const c of electedChambers(seat.tag)) {
    const at = electionDue(gw, seat, c);
    if (at !== null && (next === null || at < next.at)) next = { id: c.id, at };
  }
  if (next !== null) out.due = { kind: "word", value: next.id };
  return out;
}

// ---- The view ----

/**
 * The strip, the 정국 tab's axes and communities, the election card (S2's
 * treeView and abilityView fill the trees and abilities).
 */
export function societyView(
  gw: GreatWar,
  seat: GwSeatState,
): GwSocietyView | undefined {
  const house = houseRow(seat.tag);
  const h = seat.house;
  if (house === null || h === undefined) return undefined;
  const first = house.chambers[0]?.id;
  const n = gw.nation(seat.tag);
  const axes = n?.axes ?? {};
  const was = seat.society?.was ?? axes;
  const c = gw.s.chapter;
  const factions: GwStripFactionView[] = [];
  for (const f of h.factions) {
    if (f.status === "out" || f.status === "merged") continue;
    // A gone party greys out, then leaves the strip a chapter later.
    if (f.status === "gone" && c - f.since > 1) continue;
    const row = factionRow(f.id);
    if (row === null) continue;
    const open = sitting(f) && judgeBlock(gw, seat, f.id) === null;
    factions.push({
      id: f.id,
      bloc: row.bloc,
      status: f.status,
      seats: first === undefined ? 0 : (seatsNow(seat, row)[first] ?? 0),
      support: supportOf(f),
      trust: factionTrust(f),
      temper: f.step,
      ideals: row.ideals ?? {},
      leader: f.leader,
      affinity: f.affinity ?? 0,
      born: f.born !== undefined && c - f.born <= 1,
      ability: abilityView(gw, seat, f.id),
      tree: treeView(gw, seat, f.id),
      promote: open,
      condemn: open,
    });
  }
  factions.sort((a, b) => b.seats - a.seats || b.support - a.support);
  const due: Partial<Record<GwChamber, number>> = {};
  for (const ch of electedChambers(seat.tag)) {
    const at = electionDue(gw, seat, ch);
    if (at !== null) due[ch.id] = at;
  }
  return {
    axes: axesOf(seat.tag).map((axis) => ({
      axis,
      step: stepOf(axes[axis] ?? 0),
      trend: Math.sign((axes[axis] ?? 0) - (was[axis] ?? 0)),
    })),
    communities: (seat.society?.communities ?? []).flatMap((k) => {
      const row = communityRow(k.id);
      if (row === null) return [];
      const draw = h.factions
        .filter(
          (f) =>
            sitting(f) && idealsOf(f.id)[row.ideal.axis] === row.ideal.side,
        )
        .sort((a, b) => supportOf(b) - supportOf(a))
        .map((f) => f.id);
      return [
        {
          id: k.id,
          ideal: row.ideal,
          size: k.size,
          trust: k.trust,
          temper: k.step,
          factions: draw,
        },
      ];
    }),
    factions,
    election: { last: lastElection(seat), due },
    utopia: seat.society?.utopia ?? null,
  };
}

function lastElection(seat: GwSeatState): GwElection | null {
  const list = seat.society?.elections ?? [];
  return list.length === 0 ? null : list[list.length - 1];
}
