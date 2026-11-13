// Great War 1914 (ww207/ww208, lane S2): the faction utopias, after Frostpunk
// 2's Utopia trees. Affinity fills from the axes standing on a faction's
// ideals and from its bills passed; 연다 spends it on the nodes of its tree;
// 실현한다 absorbs society, empties 불온 for good and brings the tree's
// regime; the card asks the player to end there or play on (decision 1B, as
// the new head when the regime removed the person). Also the factions' trust
// in the seat, their rallies and protests, their abilities as power rows
// (Powers.ts asks in here), and their AI: a strong faction brings its node
// law to the house. Rows: engine-lib/ww1914/UtopiaRows. See
// /home/eser/dev/ww207-format.md.
import {
  GW_GAUGE_MAX,
  type GwEnding,
  type GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwFactionState } from "@openfront/engine-api/ww1914/GwHouse";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import {
  axesOf,
  GW_AFFINITY_MAX,
  GW_AXIS_NOTCHES,
  GW_NODE_PRICE,
  GW_NODE_TIERS,
  GW_REALISE_AXIS,
  GW_TRUST_MAX,
  gwSocietyStart,
  type GwAxis,
  type GwIdeals,
  type GwStripFactionView,
  type GwTreeTemplate,
} from "@openfront/engine-api/ww1914/GwSociety";
import type { GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GwLawRow } from "@openfront/engine-lib/ww1914/LawRows";
import {
  GW_ABILITY_COOLDOWN,
  GW_ABILITY_TRUST,
  GW_ABILITY_TURNS,
  type GwPowerRow,
} from "@openfront/engine-lib/ww1914/PowerRows";
import { genericFactionId } from "@openfront/engine-lib/ww1914/SocietyRows";
import {
  GW_AFFINITY_AXIS,
  GW_AFFINITY_BILL,
  type GwNodeRow,
  type GwTreeRow,
} from "@openfront/engine-lib/ww1914/UtopiaRows";
import { makeCard, placeCard } from "./Desk";
import { closeSeat } from "./Endings";
import type { GreatWar } from "./GreatWar";
import { factionOf, factionRow, houseBring, houseRow, seatsNow } from "./House";
import { lawStage } from "./Laws";
import { powerRow, powerWhy } from "./Powers";
import { changeRegime } from "./Regimes";
import { rulerRow } from "./Ruler";
import { holds, runEffects, sceneOf, type SceneCtx } from "./SceneRun";
import { clampTo, moveGauge, news, reason } from "./World";

export type UtopiaCond = Extract<
  GwWorldCond,
  { is: "affinity" | "node" | "utopia" }
>;

export type UtopiaEffect = Extract<GwWorldEffect, { do: "affinity" }>;

/** The ending of a seat that stops at its realised utopia (decision 1B). */
export const GW_UTOPIA_ENDING: GwEnding = "utopia_realised";
/** The seat flag the new head's rows wait for: `gw_head_<ruler row>` (lane P). */
export const headFlag = (head: string): string => `gw_head_${head}`;
/** A faction or a community rallies or protests at most once in so many chapters. */
const STIR_EVERY = 3;
/** Strength at which a faction brings its own node law to the house. */
const STRONG_AT = 3;
/** A strong faction tries its node law every this many chapters. */
const BRING_EVERY = 4;

const ctxOf = (gw: GreatWar, seat: GwSeatState): SceneCtx => ({
  gw,
  seat,
  cast: {},
});

const standing = (f: GwFactionState): boolean =>
  f.status === "in" || f.status === "under";

// ---- Rows ----

/** A generic party's row (S1's births): its ideals and its template. */
function genericOf(id: string) {
  const tag = id.slice(0, 3).toUpperCase() as GwTag;
  return (gwContent().society?.generic ?? []).find((g) => {
    const base = genericFactionId(tag, g.kind);
    return id === base || id.startsWith(`${base}_`);
  });
}

export function idealsOf(id: string): GwIdeals {
  return factionRow(id)?.ideals ?? genericOf(id)?.ideals ?? {};
}

/** The faction's tree: its own row, else one made from its template. */
export function treeOf(id: string): GwTreeRow | null {
  const own = (gwContent().utopia?.trees ?? []).find((t) => t.faction === id);
  if (own !== undefined) return own;
  const template: GwTreeTemplate | undefined =
    factionRow(id)?.template ?? genericOf(id)?.template;
  if (template === undefined) return null;
  return { faction: id, template, utopia: template };
}

/** The tree's nine nodes: the template's, bent, its own in place of theirs. */
export function nodesOf(tree: GwTreeRow): GwNodeRow[] {
  const t = (gwContent().utopia?.templates ?? []).find(
    (x) => x.id === tree.template,
  );
  if (t === undefined) return [];
  return t.nodes.map((n) => {
    const own = (tree.own ?? []).find((o) => o.replaces === n.id);
    if (own !== undefined) {
      const { replaces, ...node } = own;
      void replaces;
      return node;
    }
    const bend = tree.bend?.[n.id];
    return bend === undefined ? n : { ...n, ...bend, id: n.id, tier: n.tier };
  });
}

/** A ruler row some utopia brings as its new head (lane P's rows). */
export function isHead(ruler: string): boolean {
  return (gwContent().utopia?.trees ?? []).some((t) => t.head === ruler);
}

// ---- State ----

/** The seat's faction that still stands (not out, merged or gone). */
function liveFaction(seat: GwSeatState, id: string): GwFactionState | null {
  const f = factionOf(seat, id);
  return f !== null && standing(f) ? f : null;
}

function trustOf(f: GwFactionState): number {
  return f.trust ?? factionRow(f.id)?.trust ?? 0;
}

/** A faction's trust in the seat moves (§7): deals, its bills, nodes, posts. */
export function factionTrust(
  seat: GwSeatState,
  id: string,
  delta: number,
): void {
  const f = factionOf(seat, id);
  if (f === null || delta === 0) return;
  f.trust = clampTo(trustOf(f) + delta, -GW_TRUST_MAX, GW_TRUST_MAX);
}

function stepOf(gw: GreatWar, seat: GwSeatState, axis: GwAxis): number {
  const notches = gw.nation(seat.tag)?.axes?.[axis] ?? 0;
  return Math.trunc(notches / GW_AXIS_NOTCHES);
}

/** How far the axes stand on the ideals: steps summed, the far side not counted. */
function onIdeals(gw: GreatWar, seat: GwSeatState, ideals: GwIdeals): number {
  let sum = 0;
  for (const axis of axesOf(seat.tag)) {
    const side = ideals[axis] ?? 0;
    if (side !== 0) sum += Math.max(0, stepOf(gw, seat, axis) * side);
  }
  return sum;
}

function addAffinity(f: GwFactionState, delta: number): void {
  if (delta === 0) return;
  f.affinity = clampTo((f.affinity ?? 0) + delta, 0, GW_AFFINITY_MAX);
}

/** The seat's realised utopia, if any. */
const utopiaOf = (seat: GwSeatState) => seat.society?.utopia ?? null;

/** The card waits for the player's word: the person's end waits with it. */
export function utopiaWaits(seat: GwSeatState): boolean {
  const u = utopiaOf(seat);
  return u !== null && u.choice === null;
}

// ---- Nodes ----

/** Why 연다 isn't offered: gw.utopia.why.<key> (the order's block ids). */
function nodeWhy(
  gw: GreatWar,
  seat: GwSeatState,
  f: GwFactionState,
  nodes: readonly GwNodeRow[],
  node: GwNodeRow,
): "node_shut" | "no_affinity" | null {
  const open = f.nodes ?? [];
  const tier = GW_NODE_TIERS.indexOf(node.tier);
  if (tier > 0) {
    const before = GW_NODE_TIERS[tier - 1];
    if (!nodes.some((n) => n.tier === before && open.includes(n.id))) {
      return "node_shut";
    }
  }
  if (node.when !== undefined && !holds(ctxOf(gw, seat), node.when)) {
    return "node_shut";
  }
  if ((f.affinity ?? 0) < GW_NODE_PRICE[node.tier]) return "no_affinity";
  return null;
}

/** Order `node_open` (연다). */
export function openNode(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
  node: string,
): GwOrderBlock | null {
  const f = liveFaction(seat, faction);
  if (f === null) return "no_faction";
  const tree = treeOf(faction);
  const nodes = tree === null ? [] : nodesOf(tree);
  const row = nodes.find((n) => n.id === node);
  if (row === undefined || (f.nodes ?? []).includes(node)) return "no_node";
  const why = nodeWhy(gw, seat, f, nodes, row);
  if (why !== null) return why;
  f.affinity = (f.affinity ?? 0) - GW_NODE_PRICE[row.tier];
  f.nodes = [...(f.nodes ?? []), row.id];
  factionTrust(seat, faction, 1);
  const ctx = ctxOf(gw, seat);
  runEffects(ctx, row.effects ?? []);
  runEffects(ctx, axisPushes(row.axes));
  reason(gw, seat, "utopia_node", whoOf(f));
  gw.touch();
  return null;
}

function axisPushes(push: GwNodeRow["axes"]): GwEffect[] {
  return Object.entries(push ?? {}).flatMap(([axis, delta]) =>
    delta === undefined || delta === 0
      ? []
      : [
          {
            kind: "world" as const,
            of: { do: "axis" as const, axis: axis as GwAxis, delta },
          },
        ],
  );
}

function whoOf(f: GwFactionState): string | undefined {
  return f.leader ?? factionRow(f.id)?.leaders[0]?.person ?? undefined;
}

/**
 * A faction's exclusive law (GwLawRow `exclusive`): out of the book until
 * that node of its tree is open (Laws.openNow, House.opensNow).
 */
export function exclusiveShut(seat: GwSeatState, row: GwLawRow): boolean {
  const x = row.exclusive;
  if (x === undefined) return false;
  return !(factionOf(seat, x.faction)?.nodes ?? []).includes(x.node);
}

// ---- Realisation ----

/** What still stands between the faction and its utopia; null: ready. */
export function realiseWhy(
  gw: GreatWar,
  seat: GwSeatState,
  f: GwFactionState,
): string | null {
  if (utopiaOf(seat) !== null) return "done";
  const tree = treeOf(f.id);
  if (tree === null) return "no_tree";
  const nodes = nodesOf(tree);
  const open = f.nodes ?? [];
  if (nodes.length === 0 || nodes.some((n) => !open.includes(n.id))) {
    return "nodes";
  }
  const ideals = idealsOf(f.id);
  for (const axis of axesOf(seat.tag)) {
    const side = ideals[axis] ?? 0;
    if (side !== 0 && stepOf(gw, seat, axis) * side < GW_REALISE_AXIS) {
      return "axes";
    }
  }
  const n = gw.nation(seat.tag);
  for (const node of nodes) {
    if (node.law === undefined) continue;
    if (n === null || lawStage(n, node.law)?.stage !== "force") return "laws";
  }
  if (!overHalf(seat, ideals)) return "communities";
  if (tree.when !== undefined && !holds(ctxOf(gw, seat), tree.when)) {
    return "state";
  }
  return null;
}

/** Its communities (each holding one of its ideals) are over half the country. */
function overHalf(seat: GwSeatState, ideals: GwIdeals): boolean {
  const rows = (gwContent().society?.communities ?? []).filter(
    (c) => c.tag === seat.tag,
  );
  let ours = 0;
  let all = 0;
  for (const c of rows) {
    const st = seat.society?.communities.find((x) => x.id === c.id);
    const size = st?.size ?? c.size;
    all += size;
    if ((ideals[c.ideal.axis] ?? 0) === c.ideal.side) ours += size;
  }
  return all === 0 || ours * 2 > all;
}

const opposes = (a: GwIdeals, b: GwIdeals): boolean =>
  Object.entries(a).some(([axis, side]) => {
    const other = b[axis as GwAxis] ?? 0;
    return (side ?? 0) !== 0 && other !== 0 && other !== side;
  });

/** Society takes the faction's values: tempers 0, rival parties gone into it. */
function absorb(gw: GreatWar, seat: GwSeatState, f: GwFactionState): void {
  for (const c of seat.society?.communities ?? []) {
    c.heat = 0;
    c.step = 0;
    c.trust = Math.max(c.trust, 1);
  }
  const ideals = idealsOf(f.id);
  const ownRow = factionRow(f.id);
  const seats: Record<string, number> =
    ownRow === null ? {} : { ...seatsNow(seat, ownRow) };
  for (const g of seat.house?.factions ?? []) {
    if (!standing(g)) continue;
    g.heat = 0;
    g.step = 0;
    if (g.id === f.id || !opposes(idealsOf(g.id), ideals)) continue;
    const row = factionRow(g.id);
    if (row !== null) {
      for (const [c, k] of Object.entries(seatsNow(seat, row))) {
        seats[c] = (seats[c] ?? 0) + (k ?? 0);
      }
    }
    g.status = "gone";
    g.since = gw.s.chapter;
    g.support = 0;
    g.seats = {};
    reason(gw, seat, "utopia_absorbed", whoOf(g));
  }
  if (ownRow !== null) f.seats = seats;
  f.trust = GW_TRUST_MAX;
}

/** Order `utopia_realise` (실현한다). */
export function realiseUtopia(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwOrderBlock | null {
  const f = liveFaction(seat, faction);
  if (f === null) return "no_faction";
  if (realiseWhy(gw, seat, f) !== null) return "no_utopia";
  const tree = treeOf(faction)!;
  const n = gw.nation(seat.tag);
  const society = (seat.society ??= gwSocietyStart());
  absorb(gw, seat, f);
  const regime =
    tree.regime !== undefined && n !== null && n.regime !== tree.regime
      ? tree.regime
      : null;
  society.utopia = {
    faction,
    chapter: gw.s.chapter,
    regime,
    head: tree.head ?? null,
    choice: null,
  };
  if (regime !== null) changeRegime(gw, seat.tag, regime);
  // 불온 empties and stays empty: the ladder stops (World.utopiaCalm).
  if (n !== null) {
    n.unrest = 0;
    n.lowOrder = 0;
    n.gauges.order = GW_GAUGE_MAX.order;
  }
  runEffects(ctxOf(gw, seat), tree.realised ?? []);
  const scene = tree.scene === undefined ? null : sceneOf(tree.scene);
  const card = scene === null ? null : makeCard(gw, seat, scene, "summon");
  if (card !== null) placeCard(gw, seat, card);
  reason(gw, seat, "utopia_realised", whoOf(f));
  news(gw, "utopia_realised", seat.tag);
  gw.touch();
  return null;
}

/** The regime the utopia brought has no place for the person at the desk. */
export function personRemoved(gw: GreatWar, seat: GwSeatState): boolean {
  const id = seat.ruler.id;
  return id !== null && rulerRow(gw, seat)?.id !== id;
}

/**
 * Order `utopia_choice` (decision 1B): end here with a winning ending, or
 * play on: as the same person where he stays, else as the tree's new head.
 */
export function utopiaChoice(
  gw: GreatWar,
  seat: GwSeatState,
  play: boolean,
): GwOrderBlock | null {
  const u = utopiaOf(seat);
  if (u === null || u.choice !== null || seat.memoir !== null) {
    return "no_utopia";
  }
  if (!play) {
    u.choice = "end";
    if (gw.s.seats.length > 1) closeSeat(gw, seat, GW_UTOPIA_ENDING);
    else gw.s.ended = GW_UTOPIA_ENDING;
    gw.touch();
    return null;
  }
  // The person went with the old regime: only a head can play on.
  if (personRemoved(gw, seat) && u.head === null) return "no_utopia";
  u.choice = "play";
  if (u.head !== null && !seat.flags.includes(headFlag(u.head))) {
    seat.flags.push(headFlag(u.head));
  }
  gw.touch();
  return null;
}

// ---- Abilities (power rows with `ability`; Powers.ts asks here) ----

/** The ability row of a faction: its row's `ability`, else a row naming it. */
function abilityRowOf(seat: GwSeatState, faction: string): GwPowerRow | null {
  const id = factionRow(faction)?.ability;
  if (id !== undefined) return powerRow(id);
  return (
    (gwContent().powers ?? []).find(
      (r) => r.tag === seat.tag && r.ability?.faction === faction,
    ) ?? null
  );
}

/** Greyed: why the faction won't be asked now (gw.power.why.<key>); null when it can. */
export function abilityWhy(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwPowerRow,
): string | null {
  const a = row.ability;
  if (a === undefined) return null;
  const f = liveFaction(seat, a.faction);
  if (f === null) return "ability_gone";
  if (f.step >= GW_ABILITY_TURNS) return "ability_turned";
  if ((f.ableAt ?? -99) > gw.s.chapter) return "used";
  if (trustOf(f) < GW_ABILITY_TRUST) return "ability_trust";
  if (f.step > 1) return "ability_temper";
  return null;
}

/** What the ability does: its strong form once an ability node is open. */
export function abilityEffects(
  seat: GwSeatState,
  row: GwPowerRow,
): readonly GwEffect[] {
  const a = row.ability;
  if (a?.strong === undefined) return row.effects;
  const tree = treeOf(a.faction);
  const open = factionOf(seat, a.faction)?.nodes ?? [];
  const strong =
    tree !== null &&
    nodesOf(tree).some(
      (n) =>
        n.kind === "ability" &&
        open.includes(n.id) &&
        (n.power === undefined || n.power === row.id),
    );
  return strong ? a.strong : row.effects;
}

/** Asked and done: trust -1, and it cools down. */
export function abilityUsed(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwPowerRow,
): void {
  const a = row.ability;
  const f = a === undefined ? null : factionOf(seat, a.faction);
  if (a === undefined || f === null) return;
  factionTrust(seat, a.faction, -1);
  f.ableAt = gw.s.chapter + (row.cooldown ?? GW_ABILITY_COOLDOWN);
}

/** At temper 3+ a faction turns its ability against the seat, unasked. */
function turnedStep(gw: GreatWar, seat: GwSeatState): void {
  for (const row of gwContent().powers ?? []) {
    const a = row.ability;
    if (row.tag !== seat.tag || a?.turned === undefined) continue;
    const f = liveFaction(seat, a.faction);
    if (f === null || f.step < GW_ABILITY_TURNS) continue;
    if ((f.ableAt ?? -99) > gw.s.chapter) continue;
    f.ableAt = gw.s.chapter + (row.cooldown ?? GW_ABILITY_COOLDOWN);
    runEffects(ctxOf(gw, seat), a.turned.effects);
    const scene = a.turned.scene === undefined ? null : sceneOf(a.turned.scene);
    const card = scene === null ? null : makeCard(gw, seat, scene, "summon");
    if (card !== null) placeCard(gw, seat, card);
    else reason(gw, seat, "utopia_turned", whoOf(f));
  }
}

// ---- The chapter ----

/**
 * A bill passed (Laws.enact): its own faction trusts the seat more and
 * comes nearer its utopia; a faction whose ideals the text pushes against
 * trusts it less.
 */
export function utopiaLawPassed(
  ctx: SceneCtx,
  row: GwLawRow,
  text: string | null,
  by: string | null,
): void {
  const { seat } = ctx;
  const push = row.draft.find((d) => d.id === text)?.axes ?? {};
  for (const f of seat.house?.factions ?? []) {
    if (!standing(f)) continue;
    const own = by === f.id || (factionRow(f.id)?.bills ?? []).includes(row.id);
    if (own) {
      factionTrust(seat, f.id, 1);
      if (treeOf(f.id) !== null) addAffinity(f, GW_AFFINITY_BILL);
      continue;
    }
    const ideals = idealsOf(f.id);
    let lean = 0;
    for (const [axis, d] of Object.entries(push)) {
      lean += (ideals[axis as GwAxis] ?? 0) * Math.sign(d ?? 0);
    }
    if (lean < 0) factionTrust(seat, f.id, -1);
  }
}

/** This chapter began a new year of the calendar. */
function yearTurned(gw: GreatWar): boolean {
  const days = gwChapters(gw.s.calendar);
  const c = gw.s.chapter;
  if (c <= 0 || c >= days.length) return false;
  const year = (i: number) => Math.floor(days[i].day / 365);
  return year(c) !== year(c - 1);
}

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** A faction rallies (trust 호의+, temper 2) or protests (불신-, temper 2+). */
function stir(gw: GreatWar, seat: GwSeatState, f: GwFactionState): void {
  if (f.step < 2 || (gw.s.chapter + hash(f.id)) % STIR_EVERY !== 0) return;
  const trust = trustOf(f);
  if (trust >= 1 && f.step === 2) {
    runEffects(ctxOf(gw, seat), [
      { kind: "world", of: { do: "support", id: f.id, delta: 1 } },
    ]);
    f.heat = Math.max(0, f.heat - 1);
    reason(gw, seat, "utopia_rally", whoOf(f));
  } else if (trust <= -1) {
    moveGauge(gw, seat.tag, "order", -1, "utopia_protest");
    reason(gw, seat, "utopia_protest", whoOf(f));
  }
}

/** Communities rally (their parties' support grows) and protest (order falls). */
function stirCommunities(gw: GreatWar, seat: GwSeatState): void {
  const c = gw.s.chapter;
  const rows = gwContent().society?.communities ?? [];
  for (const st of seat.society?.communities ?? []) {
    if (st.step < 2 || c - st.stirred < STIR_EVERY) continue;
    const row = rows.find((r) => r.id === st.id);
    if (row === undefined) continue;
    if (st.trust >= 1 && st.step === 2) {
      st.stirred = c;
      const parties = (seat.house?.factions ?? []).filter(
        (f) => standing(f) && idealsOf(f.id)[row.ideal.axis] === row.ideal.side,
      );
      runEffects(
        ctxOf(gw, seat),
        parties.map((f) => ({
          kind: "world" as const,
          of: { do: "support" as const, id: f.id, delta: 1 },
        })),
      );
      reason(gw, seat, "utopia_c_rally");
    } else if (st.trust <= -1) {
      st.stirred = c;
      moveGauge(gw, seat.tag, "order", -1, "utopia_protest");
      reason(gw, seat, "utopia_c_protest");
    }
  }
}

/** A strong faction brings the law of an open node of its tree to the house. */
function bringNodeLaw(
  gw: GreatWar,
  seat: GwSeatState,
  f: GwFactionState,
): void {
  if (f.strength < STRONG_AT || f.step >= 3) return;
  if ((gw.s.chapter + hash(f.id)) % BRING_EVERY !== 0) return;
  const tree = treeOf(f.id);
  const n = gw.nation(seat.tag);
  if (tree === null || n === null) return;
  const open = f.nodes ?? [];
  for (const node of nodesOf(tree)) {
    if (node.law === undefined || !open.includes(node.id)) continue;
    const st = lawStage(n, node.law);
    if (st !== null && st.stage !== "idle") continue;
    if (houseBring(gw, seat, node.law, "faction", f.id)) return;
  }
}

/** The chapter's utopia step, after the society's (GW_CHAPTER_STEPS). */
export function utopiaStep(gw: GreatWar): void {
  if (gw.s.ended !== null) return;
  const yearly = yearTurned(gw);
  for (const seat of gw.s.seats) {
    if (seat.memoir !== null || seat.house === undefined) continue;
    if (houseRow(seat.tag) === null) continue;
    for (const f of seat.house.factions) {
      if (!standing(f)) continue;
      if (utopiaOf(seat) === null && treeOf(f.id) !== null) {
        addAffinity(f, GW_AFFINITY_AXIS * onIdeals(gw, seat, idealsOf(f.id)));
        bringNodeLaw(gw, seat, f);
      }
      // A year in a post: its leader holds an office.
      if (yearly && f.leader !== null && gw.person(f.leader)?.office) {
        factionTrust(seat, f.id, 1);
      }
      stir(gw, seat, f);
    }
    stirCommunities(gw, seat);
    turnedStep(gw, seat);
  }
}

// ---- World conds and effects ----

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

/** The utopias' world conds. */
export function utopiaHolds(ctx: SceneCtx, c: UtopiaCond): boolean {
  const { seat } = ctx;
  switch (c.is) {
    case "affinity": {
      const f = factionOf(seat, c.id);
      return f !== null && inRange(f.affinity ?? 0, c);
    }
    case "node":
      return (factionOf(seat, c.id)?.nodes ?? []).includes(c.node);
    case "utopia": {
      const u = utopiaOf(seat);
      return u !== null && (c.id === undefined || u.faction === c.id);
    }
  }
}

/** The utopias' world effects. */
export function utopiaDo(ctx: SceneCtx, e: UtopiaEffect): void {
  const f = factionOf(ctx.seat, e.id);
  if (f !== null) addAffinity(f, e.delta);
}

// ---- Views ----

/** The faction card's tree (Society's societyView calls it). */
export function treeView(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwStripFactionView["tree"] {
  const tree = treeOf(faction);
  const f = factionOf(seat, faction);
  if (tree === null || f === null) return null;
  const nodes = nodesOf(tree);
  if (nodes.length === 0) return null;
  const live = standing(f);
  const open = f.nodes ?? [];
  return {
    template: tree.template,
    utopia: tree.utopia,
    nodes: nodes.map((n) => {
      const isOpen = open.includes(n.id);
      const why = isOpen
        ? null
        : live
          ? nodeWhy(gw, seat, f, nodes, n)
          : "node_shut";
      return {
        id: n.id,
        tier: n.tier,
        kind: n.kind,
        open: isOpen,
        can: !isOpen && why === null,
        why,
      };
    }),
    ready: live && realiseWhy(gw, seat, f) === null,
  };
}

/** The chip's ability and its amber dot (Society's societyView calls it). */
export function abilityView(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwStripFactionView["ability"] {
  const row = abilityRowOf(seat, faction);
  const f = liveFaction(seat, faction);
  if (row === null || f === null) return null;
  const why = powerWhy(gw, seat, row.id);
  return {
    power: row.id,
    ready: why === null,
    turned: f.step >= GW_ABILITY_TURNS,
    why,
  };
}
