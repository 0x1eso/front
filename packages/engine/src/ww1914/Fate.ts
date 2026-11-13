// Great War 1914 (ww199, design ww198 + the vassal): a beaten country's fate.
// Each place a table gives up gets a fate (GwFate): annexed, held under
// military government for a term, made into a new state (a real country of
// its own colour and name), given to an ally, given back, or kept as the
// victor's vassal (the beaten country's colour, named as its dependency).
// The seat paints fates (order `fate_paint`, or a `settle` course's plan); the
// table reads them; signing applies them. The years after run from state:
// a state's loyalty drifts and it may turn, a vassal pays and resists and
// follows its overlord into war and peace, annexed land never settles, and a
// beaten country remembers (revanche).
import type {
  GwNationState,
  GwSeatState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_VASSAL_SLOTS,
  type GwTag,
} from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_LOYALTY_MAX,
  GwClient,
  GwClientForm,
  GwFate,
  GwFateMark,
  GwFateRecord,
  GwFateTerm,
  gwLoyaltyWord,
  GwPartnerWord,
  GwRealmView,
  GwRuledView,
  GwSettlePlan,
  GwSignHow,
} from "@openfront/engine-api/ww1914/GwFate";
import type {
  GwOrder,
  GwOrderBlock,
} from "@openfront/engine-api/ww1914/GwOrders";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
  GwPlace,
} from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwTableClaim } from "@openfront/engine-api/ww1914/GwTable";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_AI_FATES,
  GW_ANNEX_RESIST_MONTHS,
  GW_CLIENT_DRIFT_MONTHS,
  GW_CLIENT_LOSING,
  GW_CLIENT_LOYALTY,
  GW_CLIENT_ROWS,
  GW_FATE_OUTRAGE,
  GW_FATE_TERM_DAYS,
  GW_REGENCY,
  GW_REVANCHE_MONTHS,
  GW_RIVAL_CLAIMS,
  GW_VASSAL_TRIBUTE_MONTHS,
  gwClientRow,
  gwCrownPaperIds,
} from "@openfront/engine-lib/ww1914/FateRows";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import {
  GW_TABLE_AIMS,
  GW_TABLE_CAPITALS,
  GW_TABLE_HEART,
  GW_TABLE_PORTS,
} from "@openfront/engine-lib/ww1914/TableRows";
import { claimsOpen } from "./Claims";
import { warScore } from "./Fronts";
import { blankNation, type GreatWar } from "./GreatWar";
import { holderOf, moveLand } from "./Land";
import { hasLandGraph, landGraph, reachesGroup } from "./Occupation";
import { moveBond } from "./PeaceYears";
import { beatSince, ruleMonth, ruleOf } from "./Rule";
import { atWarWith, GW_GREAT, syncAtWar, warOf } from "./Wars";
import {
  clampTo,
  monthsFrom,
  moveGauge,
  news,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

export type GwFateCond = Extract<
  GwWorldCond,
  { is: "fate" | "client_state" | "vassal" | "revanche" | "settle_open" }
>;
export type GwFateEffect = Extract<
  GwWorldEffect,
  { do: "crown" | "treaty_sign" | "settle_plan" | "loyalty" }
>;

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

// ---- Painting ----

/** A table sits with this seat's country in a chair, not signed yet. */
export function atTable(gw: GreatWar, tag: GwTag): boolean {
  const t = gw.s.table;
  return t !== null && !t.closed && t.order.includes(tag);
}

/** Fates can be painted: the war is on, or a table the seat sits at is open. */
export function fatesOpen(gw: GreatWar, seat: GwSeatState): boolean {
  return claimsOpen(gw) || atTable(gw, seat.tag);
}

/** The side the seat stands on for founding: its table side, else its coalition. */
function sideFor(gw: GreatWar, tag: GwTag): GwSide | null {
  return gw.nation(tag)?.side ?? null;
}

/** Whether `mark` can stand on `place` for `seat`. */
function markFits(
  gw: GreatWar,
  seat: GwSeatState,
  place: GwPlace,
  mark: GwFateMark,
): boolean {
  const owner = GW_PLACES[place].owner;
  if (owner === seat.tag) return false;
  switch (mark.fate) {
    case "state": {
      if (mark.client === undefined) return false;
      const row = gwClientRow(mark.client);
      const side = sideFor(gw, seat.tag);
      if (!row.places.includes(place)) return false;
      if (side !== null && !row.sides.includes(side)) return false;
      return mark.for === undefined || mark.for !== seat.tag;
    }
    case "ally": {
      if (mark.for === undefined || mark.for === seat.tag) return false;
      if (mark.for === owner) return false;
      const a = gw.nation(mark.for);
      const me = gw.nation(seat.tag);
      return a !== null && me !== null && a.side !== null && a.side === me.side;
    }
    case "occupy":
    case "annex":
    case "return":
    case "vassal":
      return mark.client === undefined;
  }
}

/** Applies `fate_paint`; null when it took effect. */
export function fatePaint(
  gw: GreatWar,
  seat: GwSeatState,
  o: Extract<GwOrder, { kind: "fate_paint" }>,
): GwOrderBlock | null {
  if (!fatesOpen(gw, seat)) return "no_fate";
  if ((o.place === null) === (o.group === null)) return "no_fate";
  let places: GwPlace[];
  if (o.place !== null) {
    if (!(o.place in GW_PLACES)) return "no_fate";
    places = [o.place as GwPlace];
  } else {
    places = GW_PLACE_KEYS.filter(
      (p) => GW_PLACES[p].group === o.group && GW_PLACES[p].owner !== seat.tag,
    );
    if (places.length === 0) return "no_fate";
  }
  const fates = { ...(seat.fates ?? {}) };
  if (o.fate === null) {
    for (const p of places) delete fates[p];
  } else {
    const mark: GwFateMark = { fate: o.fate };
    if (o.for !== null) mark.for = o.for;
    if (o.client !== null) mark.client = o.client;
    if (o.fate === "occupy") mark.term = o.term ?? "short";
    // A group's state chip paints only the places that state is made of.
    const fit = places.filter((p) => markFits(gw, seat, p, mark));
    if (fit.length === 0) return "no_fate";
    for (const p of fit) fates[p] = mark;
  }
  seat.fates = sortedMarks(fates);
  return null;
}

function sortedMarks(
  m: Partial<Record<GwPlace, GwFateMark>>,
): Partial<Record<GwPlace, GwFateMark>> {
  const out: Partial<Record<GwPlace, GwFateMark>> = {};
  for (const p of (Object.keys(m) as GwPlace[]).sort()) out[p] = m[p]!;
  return out;
}

/** The fate the seat painted on `place`, or null. */
export function markOf(seat: GwSeatState, place: GwPlace): GwFateMark | null {
  return seat.fates?.[place] ?? null;
}

/**
 * A `settle` course's plan (design §1.2-3), painted on the land of `of` the
 * seat's country holds: each place its fate, which the seat can still change
 * place by place before the table.
 */
export function settlePlan(
  gw: GreatWar,
  seat: GwSeatState,
  of: GwTag,
  plan: GwSettlePlan,
): void {
  const me = seat.tag;
  const held = GW_PLACE_KEYS.filter(
    (p) => GW_PLACES[p].owner === of && holderOf(gw, p) === me,
  );
  if (held.length === 0) return;
  const aims = GW_TABLE_AIMS[me] ?? [];
  const side = sideFor(gw, me);
  const cap = GW_CAPITALS[of];
  const near = new Set<string>();
  if (hasLandGraph(gw)) {
    const g = landGraph(gw);
    for (const p of GW_PLACE_KEYS) {
      if (GW_PLACES[p].owner !== me) continue;
      for (const x of g.near.get(GW_PLACES[p].group) ?? []) near.add(x);
    }
  }
  const fates = { ...(seat.fates ?? {}) };
  for (const p of held) {
    const row = GW_CLIENT_ROWS.find(
      (r) =>
        r.of === of &&
        r.places.includes(p) &&
        (side === null || r.sides.includes(side)),
    );
    let mark: GwFateMark;
    switch (plan) {
      case "wide":
        mark =
          row !== undefined
            ? { fate: "state", client: row.id }
            : { fate: "occupy", term: "long" };
        break;
      case "narrow":
        mark = aims.includes(p) ? { fate: "annex" } : { fate: "return" };
        break;
      case "hold":
        mark = { fate: "occupy", term: "short" };
        break;
      case "strip":
        mark =
          aims.includes(p) || near.has(GW_PLACES[p].group)
            ? { fate: "annex" }
            : { fate: "occupy", term: "long" };
        break;
      case "vassal":
        mark = { fate: "vassal" };
        break;
    }
    fates[p] = mark;
  }
  // A vassal of the whole country is set by its capital (Fate.applyVassals).
  if (plan === "vassal" && cap !== undefined && holderOf(gw, cap) === me) {
    fates[cap] = { fate: "vassal" };
  }
  seat.fates = sortedMarks(fates);
}

// ---- The ruler's own acts ----

/** Applies `treaty_sign` (and the effect): how the seat's ruler signs. */
export function treatySign(
  gw: GreatWar,
  seat: GwSeatState,
  how: GwSignHow,
): GwOrderBlock | null {
  const t = gw.s.table;
  if (t === null || t.closed || !t.order.includes(seat.tag)) return "no_sign";
  if (t.sign?.[seat.tag] !== undefined) return "no_sign";
  if (how === "press" && !signWays(gw, seat).includes("press")) {
    return "no_sign";
  }
  t.sign ??= {};
  t.sign[seat.tag] = how;
  return null;
}

/** The ways the seat may sign now; empty when nothing waits for its hand. */
export function signWays(gw: GreatWar, seat: GwSeatState): GwSignHow[] {
  const t = gw.s.table;
  if (t === null || t.closed || !t.order.includes(seat.tag)) return [];
  if (t.sign?.[seat.tag] !== undefined) return [];
  // One more round only at a table of its own month, and only once.
  const press = t.pair !== undefined && (t.extra ?? 0) === 0;
  return press ? ["sign", "press", "reserve"] : ["sign", "reserve"];
}

/** Applies `crown` (and the effect): who sits on a state's throne. */
export function crownPick(
  gw: GreatWar,
  seat: GwSeatState,
  client: GwClient,
  pick: string,
): GwOrderBlock | null {
  const n = gw.s.nations.find(
    (x) => x.client?.id === client && x.client.by === seat.tag,
  );
  if (n === undefined || n.client === undefined) return "no_crown";
  if (n.client.crown !== null) return "no_crown";
  const row = gwClientRow(client);
  if (pick !== GW_REGENCY && !row.crowns.some((c) => c.id === pick)) {
    return "no_crown";
  }
  setCrown(gw, n.tag, pick);
  return null;
}

/**
 * The crown is set. The founder's own house binds the state closer, but
 * costs the founder's partner (the one that wanted the same state, else the
 * side's other great power) and moves a neutral America against the side.
 */
export function setCrown(gw: GreatWar, tag: GwTag, pick: string): void {
  const n = gw.nation(tag);
  const k = n?.client;
  if (n === null || k === undefined) return;
  k.crown = pick;
  const house = gwClientRow(k.id).crowns.find((c) => c.id === pick)?.house;
  if (house !== undefined && house !== null && house === k.by) {
    k.loyalty = clampTo(k.loyalty + 1, 0, GW_LOYALTY_MAX);
    const partner = k.with ?? partnerOf(gw, k.by, k.id);
    if (partner !== null) {
      trustMove(gw, partner, k.by, -1);
      moveBond(gw, k.by, partner, -1);
    }
    outrage(gw, k.by);
    tell(gw, k.by, "fate_own_house");
  }
  gw.touch();
}

// ---- What the scenes read and do ----

/** Places `tag` lost by annexation or to a taker's state or vassal, less those given back. */
export function revancheOf(gw: GreatWar, tag: GwTag, toward?: GwTag): number {
  let n = 0;
  for (const r of gw.s.fates ?? []) {
    if (r.of !== tag || r.by === tag) continue;
    if (toward !== undefined && r.by !== toward) continue;
    if (monthsFrom(gw, r.chapter) >= GW_REVANCHE_MONTHS) continue;
    if (r.fate === "annex" || r.fate === "state" || r.fate === "vassal") n++;
    else if (r.fate === "return") n--;
  }
  return Math.max(0, n);
}

/** `by` founded a state on land cut from `of` that stands. */
export function cutFrom(gw: GreatWar, by: GwTag, of: GwTag): boolean {
  return gw.s.nations.some(
    (n) =>
      n.client !== undefined &&
      (n.client.by === by || n.client.with === by) &&
      gwClientRow(n.client.id).of === of,
  );
}

/** The beaten at the table now sitting; [] with none. */
export function tableBeaten(gw: GreatWar): GwTag[] {
  const t = gw.s.table;
  if (t === null || t.closed) return [];
  const p = t.pair;
  if (p !== undefined) {
    if (p.winner === null) return [];
    return p.winner === p.a ? [p.b] : [p.a];
  }
  const k = gw.s.armistice?.kind;
  const lost: GwSide | null =
    k === "central_lost" ? "central" : k === "entente_lost" ? "entente" : null;
  return t.order.filter((x) => gw.nation(x)?.side === lost);
}

export function fateHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwFateCond,
): boolean {
  const me = seat.tag;
  switch (c.is) {
    case "fate": {
      const as = c.as ?? "by";
      return (gw.s.fates ?? []).some((r) => {
        if (c.fate !== undefined && r.fate !== c.fate) return false;
        if (c.client !== undefined && r.client !== c.client) return false;
        const other =
          as === "by" ? r.of : as === "of" ? r.by : r.by === me ? r.of : r.by;
        const mine = as === "by" ? r.by : as === "of" ? r.of : r.to;
        if (mine !== me) return false;
        if (c.tag !== undefined && other !== c.tag) return false;
        return inRange(monthsFrom(gw, r.chapter), c);
      });
    }
    case "client_state": {
      if (c.self === true) {
        const k = gw.nation(me)?.client;
        if (k === undefined) return false;
        if (c.client !== undefined && k.id !== c.client) return false;
        if (c.by !== undefined && k.by !== c.by && k.with !== c.by)
          return false;
        return inRange(k.loyalty, c);
      }
      const by = c.by ?? me;
      return gw.s.nations.some((n) => {
        const k = n.client;
        if (k === undefined || (k.by !== by && k.with !== by)) return false;
        if (c.client !== undefined && k.id !== c.client) return false;
        return inRange(k.loyalty, c);
      });
    }
    case "vassal": {
      if (c.self === true) {
        const v = gw.nation(me)?.vassal;
        if (v === undefined) return false;
        if (c.by !== undefined && v.by !== c.by) return false;
        if (c.of !== undefined && v.of !== c.of) return false;
        return inRange(v.loyalty, c);
      }
      const by = c.by ?? me;
      return gw.s.nations.some((n) => {
        const v = n.vassal;
        if (v === undefined || v.by !== by) return false;
        if (c.of !== undefined && v.of !== c.of) return false;
        return inRange(v.loyalty, c);
      });
    }
    case "revanche":
      return inRange(revancheOf(gw, me, c.tag), c);
    case "settle_open": {
      if (!atTable(gw, me)) return false;
      const beaten = tableBeaten(gw);
      if (beaten.includes(me)) return false;
      return c.of === undefined ? beaten.length > 0 : beaten.includes(c.of);
    }
  }
}

export function fateDo(gw: GreatWar, seat: GwSeatState, e: GwFateEffect): void {
  switch (e.do) {
    case "crown":
      crownPick(gw, seat, e.client, e.pick);
      return;
    case "treaty_sign":
      treatySign(gw, seat, e.how);
      return;
    case "settle_plan": {
      const of = e.of ?? tableBeaten(gw)[0];
      if (of !== undefined) settlePlan(gw, seat, of, e.plan);
      return;
    }
    case "loyalty":
      loyaltyDo(gw, seat, e);
      return;
  }
}

/** The `loyalty` effect: the seat's states and vassals, warmer or colder. */
function loyaltyDo(
  gw: GreatWar,
  seat: GwSeatState,
  e: Extract<GwFateEffect, { do: "loyalty" }>,
): void {
  const mine = (by: GwTag, also?: GwTag) =>
    by === seat.tag || also === seat.tag;
  for (const n of gw.s.nations) {
    const k = n.client;
    if (k !== undefined && mine(k.by, k.with) && e.of === undefined) {
      if (e.client !== undefined && k.id !== e.client) continue;
      k.loyalty = clampTo(k.loyalty + e.by, 0, GW_LOYALTY_MAX);
    }
    const v = n.vassal;
    if (v !== undefined && mine(v.by) && e.client === undefined) {
      if (e.of !== undefined && v.of !== e.of && n.tag !== e.of) continue;
      v.loyalty = clampTo(v.loyalty + e.by, 0, GW_LOYALTY_MAX);
      if (e.resist !== undefined) v.resist = clampTo(v.resist + e.resist, 0, 3);
    }
  }
  gw.touch();
}

// ---- Views ----

/** Countries named by their fate: every screen reads it. */
export function realmViews(gw: GreatWar): GwRealmView[] {
  const out: GwRealmView[] = [];
  for (const n of gw.s.nations) {
    if (n.client !== undefined) {
      const k = n.client;
      out.push({
        tag: n.tag,
        client: {
          id: k.id,
          form: k.form,
          by: k.by,
          ...(k.with !== undefined ? { with: k.with } : {}),
        },
      });
    } else if (n.vassal !== undefined) {
      out.push({ tag: n.tag, vassal: { by: n.vassal.by, of: n.vassal.of } });
    }
  }
  return out;
}

/** The 통치 tab's rows: land the seat rules, states it founded, its vassals. */
export function ruledViews(gw: GreatWar, seat: GwSeatState): GwRuledView[] {
  const me = seat.tag;
  const out: GwRuledView[] = [];
  for (const r of gw.s.rule ?? []) {
    if (r.by !== me) continue;
    out.push({
      kind: "rule",
      tag: r.of,
      policy: r.policy,
      ...(r.term !== undefined ? { term: r.term as GwFateTerm } : {}),
      resist: r.resist,
    });
  }
  for (const n of gw.s.nations) {
    const k = n.client;
    if (k !== undefined && (k.by === me || k.with === me)) {
      out.push({
        kind: "client",
        tag: n.tag,
        loyalty: gwLoyaltyWord(k.loyalty),
        client: k.id,
        form: k.form,
        crown: k.crown,
      });
    }
    const v = n.vassal;
    if (v !== undefined && v.by === me) {
      out.push({
        kind: "vassal",
        tag: n.tag,
        loyalty: gwLoyaltyWord(v.loyalty),
        resist: v.resist,
      });
    }
  }
  return out;
}

/** Fates as a fate list for the record: the place's latest. */
export function fateOf(gw: GreatWar, place: GwPlace): GwFate | null {
  const rows = gw.s.fates ?? [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].place === place) return rows[i].fate;
  }
  return null;
}

// ---- Helpers of the years after ----

function tell(gw: GreatWar, tag: GwTag, key: string): void {
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, key);
}

function trustMove(gw: GreatWar, tag: GwTag, of: GwTag, d: number): void {
  const n = gw.nation(tag);
  if (n !== null) n.trust[of] = clampTo((n.trust[of] ?? 0) + d, -3, 3);
}

const usNeutral = (gw: GreatWar): boolean => {
  const usa = gw.nation("USA");
  return usa !== null && usa.side === null && !usa.out;
};

/** A neutral America leans further against `by`'s side (the table's WILSON_COST). */
function outrage(gw: GreatWar, by: GwTag): void {
  const usa = gw.nation("USA");
  const side = gw.nation(by)?.side ?? null;
  if (usa === null || side === null || !usNeutral(gw)) return;
  const against = usa.lean >= 0 ? "central" : "entente";
  if (side !== against) return;
  usa.readiness = clampTo(usa.readiness + GW_FATE_OUTRAGE, 0, 100);
}

/** The partner of `by` that wanted the same state, else its side's other great power. */
function partnerOf(gw: GreatWar, by: GwTag, client: GwClient): GwTag | null {
  const rival = GW_RIVAL_CLAIMS[client];
  if (rival !== undefined && rival.includes(by)) {
    return rival[0] === by ? rival[1] : rival[0];
  }
  const side = gw.nation(by)?.side ?? null;
  if (side === null) return null;
  return GW_GREAT.find((t) => t !== by && gw.nation(t)?.side === side) ?? null;
}

/** The player of `tag` exists in this game (an old save has no new states). */
export function hasPlayer(gw: GreatWar, tag: GwTag): boolean {
  const id = gw.world.tags.indexOf(tag) + 1;
  if (id === 0) return false;
  const p = gw.mg.playerBySmallID(id) as
    | { isPlayer?: () => boolean }
    | undefined;
  return p !== undefined && p.isPlayer?.() === true;
}

/** Records a signed fate; a later one on the place replaces it. */
export function record(gw: GreatWar, r: GwFateRecord): void {
  const rows = (gw.s.fates ?? []).filter((x) => x.place !== r.place);
  rows.push(r);
  gw.s.fates = rows;
}

/** The fate an earlier table signed on `place`, or null. */
export function recordOf(gw: GreatWar, place: GwPlace): GwFateRecord | null {
  return (gw.s.fates ?? []).find((r) => r.place === place) ?? null;
}

/** A nation row for a new state or vassal slot, made on first use. */
function newNation(gw: GreatWar, tag: GwTag): GwNationState {
  const have = gw.nation(tag);
  if (have !== null) return have;
  const n = blankNation(tag);
  gw.s.nations.push(n);
  return n;
}

/** The AI a state's form governs by. */
function aiOfForm(form: GwClientForm): GwNationState["ai"] {
  if (form === "republic") return "principled";
  if (form === "hetmanate") return "hardline";
  return "cautious";
}

// ---- Rule rows a fate brings ----

/** Military government of `of`'s land by `by` until `until` (a day). */
function occupyRow(
  gw: GreatWar,
  by: GwTag,
  of: GwTag,
  term: GwFateTerm,
  until: number,
): void {
  const r = ruleOf(gw, by, of);
  if (r !== null) {
    if (r.policy === "annexed") r.policy = "army";
    if ((r.until ?? 0) < until) {
      r.until = until;
      r.term = term;
    }
    return;
  }
  gw.s.rule ??= [];
  gw.s.rule.push({
    by,
    of,
    policy: "army",
    hard: 1,
    relief: false,
    resist: 0,
    client: null,
    since: gw.s.chapter,
    until,
    term,
  });
}

/** Annexed land under its own row, unless a military government stands. */
function annexRow(gw: GreatWar, by: GwTag, of: GwTag): void {
  if (ruleOf(gw, by, of) !== null) return;
  gw.s.rule ??= [];
  gw.s.rule.push({
    by,
    of,
    policy: "annexed",
    hard: 0,
    relief: false,
    resist: 0,
    client: null,
    since: gw.s.chapter,
  });
}

// ---- Founding ----

/**
 * Founds (or takes over) the state `client` for `by`, with `joint` as its
 * second founder. Its side is the founder's; its crown waits for a pick.
 * Null where the state's player is missing (an old save).
 */
export function foundClient(
  gw: GreatWar,
  client: GwClient,
  by: GwTag,
  joint?: GwTag,
): GwNationState | null {
  const row = gwClientRow(client);
  if (!hasPlayer(gw, row.tag)) return null;
  const founder = gw.nation(by);
  if (founder === null) return null;
  const n = newNation(gw, row.tag);
  const was = n.client;
  if (was !== undefined && was.by === by) return n;
  n.client = {
    id: client,
    by,
    ...(joint !== undefined ? { with: joint } : {}),
    form: row.forms[0],
    loyalty: GW_CLIENT_LOYALTY,
    since: gw.s.chapter,
    crown: was?.crown ?? null,
  };
  n.vassal = undefined;
  delete n.vassal;
  n.ai = aiOfForm(row.forms[0]);
  // A state cut from a country still at war stands beside its founder; the
  // beaten country itself (Serbia's rump) stays out of this war.
  if (!n.out) n.side = founder.side;
  news(gw, "fate_state_founded", by, row.tag);
  tell(gw, by, "fate_state");
  const rival = GW_RIVAL_CLAIMS[client];
  if (joint === undefined && rival?.includes(by) === true) {
    moveBond(gw, rival[0], rival[1], -1);
  }
  if (joint !== undefined) moveBond(gw, by, joint, 1);
  gw.touch();
  return n;
}

/**
 * A ruler sets up a client state in the land it holds, in the war (Rule.ts,
 * `{ do: "rule", client }`): ww199 puts it on the map. The places of the state
 * it holds go to it; the rest follow if a table gives them.
 */
export function foundOnRule(gw: GreatWar, client: GwClient, by: GwTag): void {
  const row = gwClientRow(client);
  const held = row.places.filter((p) => holderOf(gw, p) === by);
  if (held.length === 0) return;
  const n = foundClient(gw, client, by);
  if (n === null) return;
  for (const place of held) {
    moveLand(gw, place, n.tag, null, "table");
    record(gw, {
      place,
      fate: "state",
      by,
      of: row.of,
      to: n.tag,
      chapter: gw.s.chapter,
      client,
    });
  }
  // The fronts leave it be: only a war on the state itself moves it.
  gw.s.settled = [...new Set([...(gw.s.settled ?? []), ...held])].sort();
  crownFor(gw, n);
}

/**
 * ww199 merge: lays the first written paper of `ids` for next chapter, once:
 * not again while it waits, sits on the desk or in a department's tray.
 * False when none is written.
 */
export function laySettlePaper(
  gw: GreatWar,
  seat: GwSeatState,
  ids: readonly string[],
): boolean {
  const scene = ids.find((id) => gwContent().scenes.some((x) => x.id === id));
  if (scene === undefined) return false;
  const there =
    seat.scheduled.some((q) => q.scene === scene) ||
    seat.desk.some((c) => c.scene === scene) ||
    (seat.depts?.tray ?? []).some((c) => c.scene === scene);
  if (!there) seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
  return true;
}

/** The crown of a state just founded: the seat's paper, else the AI's pick. */
function crownFor(gw: GreatWar, n: GwNationState): void {
  const k = n.client;
  if (k === undefined || k.crown !== null) return;
  const row = gwClientRow(k.id);
  const seat = seatsOf(gw, k.by)[0];
  if (seat !== undefined && ruledBySeat(gw, k.by)) {
    if (laySettlePaper(gw, seat, gwCrownPaperIds(seat.tag, k.id))) return;
    // No paper written: the regency council holds the throne meanwhile.
    setCrown(gw, n.tag, GW_REGENCY);
    return;
  }
  const ai = GW_AI_FATES[gw.nation(k.by)?.ai ?? "cautious"];
  const own = row.crowns.find((c) => c.house === k.by);
  const native = row.crowns.find((c) => c.house === null);
  const pick =
    ai.ownHouse && own !== undefined
      ? own.id
      : native !== undefined
        ? native.id
        : GW_REGENCY;
  setCrown(gw, n.tag, pick);
}

/**
 * `of` becomes `by`'s vassal. With its capital among `places` the whole
 * country is the vassal: its own player, renamed, its places home. Else the
 * places go to its slot (GW_VASSAL_SLOTS), in its colour. Without a slot or
 * a player for it, the places stay under long military government.
 */
function makeVassal(
  gw: GreatWar,
  by: GwTag,
  of: GwTag,
  places: readonly GwPlace[],
): void {
  const s = gw.s;
  const whole = places.includes(GW_CAPITALS[of] as GwPlace);
  const slot = GW_VASSAL_SLOTS[of];
  const tag: GwTag | null = whole
    ? of
    : slot !== undefined && hasPlayer(gw, slot)
      ? slot
      : null;
  if (tag === null) {
    const until = s.day + GW_FATE_TERM_DAYS.long;
    for (const place of places) {
      moveLand(gw, place, by, null, "table");
      record(gw, {
        place,
        fate: "occupy",
        by,
        of,
        to: by,
        chapter: s.chapter,
        until,
      });
    }
    occupyRow(gw, by, of, "long", until);
    return;
  }
  const n = whole ? gw.nation(of) : newNation(gw, tag);
  if (n === null) return;
  n.vassal = {
    by,
    of,
    loyalty: GW_CLIENT_LOYALTY,
    resist: 0,
    since: s.chapter,
  };
  if (!whole) {
    n.ai = gw.nation(of)?.ai ?? "cautious";
    n.side = gw.nation(by)?.side ?? null;
  }
  for (const place of places) {
    moveLand(gw, place, tag, null, "table");
    record(gw, { place, fate: "vassal", by, of, to: tag, chapter: s.chapter });
  }
  news(gw, "fate_vassal_made", by, tag);
  tell(gw, by, "fate_vassal");
  gw.touch();
}

/** Whether an ally takes a place given to it: a seat does; an AI if it wants it. */
function allyTakes(gw: GreatWar, ally: GwTag, place: GwPlace): boolean {
  if (ruledBySeat(gw, ally)) return true;
  if ((GW_TABLE_AIMS[ally] ?? []).includes(place)) return true;
  if (!hasLandGraph(gw)) return false;
  return reachesGroup(gw, ally, GW_PLACES[place].group);
}

/**
 * A claim agreed or imposed: the place goes as its fate says, at once. A
 * vassal waits for the signing (applyVassals), when it is known whether the
 * capital is among its places.
 */
export function applyClaim(gw: GreatWar, c: GwTableClaim): void {
  const s = gw.s;
  const place = c.place;
  const owner = GW_PLACES[place].owner;
  const by = c.by;
  // One's own land back is no fate.
  if (owner === by) {
    moveLand(gw, place, by, null, "table");
    return;
  }
  const base = { place, by, of: owner, chapter: s.chapter };
  switch (c.fate ?? "annex") {
    case "annex": {
      moveLand(gw, place, by, null, "table");
      record(gw, { ...base, fate: "annex", to: by });
      annexRow(gw, by, owner);
      const heart = GW_TABLE_HEART[owner]?.includes(GW_PLACES[place].group);
      if (heart === true || GW_TABLE_CAPITALS.includes(place)) outrage(gw, by);
      tell(gw, by, "fate_annex");
      return;
    }
    case "occupy": {
      const term = c.term ?? "short";
      const until = s.day + GW_FATE_TERM_DAYS[term];
      moveLand(gw, place, by, null, "table");
      record(gw, { ...base, fate: "occupy", to: by, until });
      occupyRow(gw, by, owner, term, until);
      return;
    }
    case "state": {
      const n =
        c.client === undefined ? null : foundClient(gw, c.client, by, c.for);
      if (n === null) {
        c.fate = "occupy";
        c.term = "long";
        applyClaim(gw, c);
        return;
      }
      moveLand(gw, place, n.tag, null, "table");
      record(gw, { ...base, fate: "state", to: n.tag, client: c.client });
      return;
    }
    case "ally": {
      const ally = c.for;
      if (ally === undefined || !allyTakes(gw, ally, place)) {
        // Refused: it costs nothing, and stays under the giver's government.
        c.fate = "occupy";
        c.term = "short";
        applyClaim(gw, c);
        return;
      }
      moveLand(gw, place, ally, null, "table");
      record(gw, { ...base, fate: "ally", to: ally });
      trustMove(gw, ally, by, 1);
      moveBond(gw, by, ally, 1);
      tell(gw, by, "fate_ally_given");
      tell(gw, ally, "fate_ally_got");
      return;
    }
    case "return": {
      moveLand(gw, place, owner, null, "table");
      record(gw, { ...base, fate: "return", to: owner });
      trustMove(gw, "USA", by, 1);
      for (const n of s.nations) {
        if (n.tag === by || n.side === null || n.side !== gw.nation(by)?.side) {
          continue;
        }
        if ((GW_TABLE_AIMS[n.tag] ?? []).includes(place)) {
          trustMove(gw, n.tag, by, -1);
        }
      }
      tell(gw, by, "fate_return");
      return;
    }
    case "vassal":
      // Applied at the signing, with the rest of that country's places.
      return;
  }
}

/** The signing: each victor's vassal places of a country, as one vassal. */
export function applyVassals(gw: GreatWar, claims: readonly GwTableClaim[]) {
  const groups = new Map<string, { by: GwTag; of: GwTag; places: GwPlace[] }>();
  for (const c of claims) {
    if (c.fate !== "vassal") continue;
    if (c.state !== "agreed" && c.state !== "imposed") continue;
    const of = GW_PLACES[c.place].owner;
    if (of === c.by) continue;
    const key = `${c.by}_${of}`;
    const g = groups.get(key) ?? { by: c.by, of, places: [] };
    g.places.push(c.place);
    groups.set(key, g);
  }
  for (const key of [...groups.keys()].sort()) {
    const g = groups.get(key)!;
    makeVassal(gw, g.by, g.of, g.places);
  }
}

/** States founded at this table get their crowns once the treaty is signed. */
export function crownsAfter(gw: GreatWar): void {
  for (const n of gw.s.nations) {
    if (n.client !== undefined && n.client.crown === null) crownFor(gw, n);
  }
}

/**
 * At the general peace a side that lost loses what it took by earlier
 * treaties (owner D4): its states go free, its vassals too. Its annexed and
 * occupied land goes home with the rest (Table.returnLand).
 */
export function undoForLosers(gw: GreatWar, lost: GwSide): void {
  for (const n of gw.s.nations) {
    const k = n.client;
    if (k !== undefined && gw.nation(k.by)?.side === lost) freeState(gw, n);
    const v = n.vassal;
    if (v !== undefined && gw.nation(v.by)?.side === lost) freeVassal(gw, n);
  }
}

// ---- The AI's fates ----

/** The fate a government nobody plays gives a place it asks for. */
export function aiFate(gw: GreatWar, by: GwTag, place: GwPlace): GwFateMark {
  const n = gw.nation(by);
  const owner = GW_PLACES[place].owner;
  if (n === null || owner === by) return { fate: "annex" };
  const ai = GW_AI_FATES[n.ai];
  const aims = GW_TABLE_AIMS[by] ?? [];
  const capital = GW_CAPITALS[owner] === place;
  // The whole country as a vassal: a small one whose capital it holds.
  if (
    ai.vassal &&
    capital &&
    !GW_GREAT.includes(owner) &&
    holderOf(gw, place) === by &&
    GW_VASSAL_SLOTS[owner] !== undefined
  ) {
    return { fate: "vassal" };
  }
  const row = GW_CLIENT_ROWS.find(
    (r) =>
      r.of === owner &&
      r.places.includes(place) &&
      n.side !== null &&
      r.sides.includes(n.side),
  );
  if (row !== undefined) {
    const found =
      ai.states === "all" ||
      (ai.states === "asked" && row.asked) ||
      (ai.states === "aim" && row.places.some((p) => aims.includes(p)));
    if (found) return { fate: "state", client: row.id };
  }
  const annexed = (gw.s.table?.claims ?? []).filter(
    (c) => c.by === by && (c.fate ?? "annex") === "annex",
  ).length;
  const room = ai.annexMost < 0 || annexed < ai.annexMost;
  const cap = GW_TABLE_CAPITALS.includes(place);
  if (room && (ai.annexCapitals || !cap)) {
    if (ai.annexAims && aims.includes(place)) return { fate: "annex" };
    if (ai.annexPorts && GW_TABLE_PORTS.includes(place)) {
      return { fate: "annex" };
    }
  }
  if (ai.rest === "occupy") return { fate: "occupy", term: ai.term };
  return { fate: "return" };
}

/** The partner's word on a place another of its side asks for. */
export function aiPartnerWord(
  gw: GreatWar,
  partner: GwTag,
  c: GwTableClaim,
): GwPartnerWord {
  const n = gw.nation(partner);
  const wants =
    holderOf(gw, c.place) === partner ||
    (GW_TABLE_AIMS[partner] ?? []).includes(c.place);
  if (n === null || !wants) return "yield";
  if (c.fate === "state" && n.ai !== "hardline") return "joint";
  return n.ai === "hardline" || n.ai === "opportunist" ? "hold" : "yield";
}

// ---- The years after (chapter step) ----

/** `x` joins its overlord's wars begun since it was bound, and leaves those it ended. */
function follow(gw: GreatWar, x: GwNationState, by: GwTag, since: number) {
  const s = gw.s;
  let changed = false;
  for (const w of s.wars) {
    if (w.ended !== null || w.since < since) continue;
    if (w.a !== by && w.b !== by) continue;
    const foe = w.a === by ? w.b : w.a;
    if (foe === x.tag || warOf(gw, x.tag, foe) !== null) continue;
    s.wars.push({
      a: by === w.a ? x.tag : foe,
      b: by === w.a ? foe : x.tag,
      since: s.chapter,
      cause: "follow",
      ended: null,
    });
    changed = true;
  }
  for (const w of s.wars) {
    if (w.ended !== null || (w.a !== x.tag && w.b !== x.tag)) continue;
    const foe = w.a === x.tag ? w.b : w.a;
    if (foe === by || warOf(gw, by, foe) !== null) continue;
    w.ended = s.chapter;
    w.how = "mutual";
    changed = true;
  }
  if (changed) syncAtWar(gw);
}

/** A state goes its own way: neutral, its wars ended, its name its own. */
function freeState(gw: GreatWar, n: GwNationState): void {
  const by = n.client?.by ?? null;
  delete n.client;
  n.side = null;
  for (const w of gw.s.wars) {
    if (w.ended === null && (w.a === n.tag || w.b === n.tag)) {
      w.ended = gw.s.chapter;
      w.how = "mutual";
    }
  }
  syncAtWar(gw);
  news(gw, "fate_state_free", n.tag, by);
  if (by !== null) tell(gw, by, "fate_state_lost");
  gw.touch();
}

/** A vassal breaks away: a whole one is itself again, a slot goes home. */
function freeVassal(gw: GreatWar, n: GwNationState): void {
  const v = n.vassal;
  if (v === undefined) return;
  delete n.vassal;
  if (n.tag !== v.of) {
    for (const place of GW_PLACE_KEYS) {
      if (holderOf(gw, place) !== n.tag) continue;
      moveLand(gw, place, GW_PLACES[place].owner, null, "table");
      record(gw, {
        place,
        fate: "return",
        by: v.by,
        of: v.of,
        to: v.of,
        chapter: gw.s.chapter,
      });
    }
    n.side = null;
  }
  for (const w of gw.s.wars) {
    if (
      w.ended === null &&
      w.cause === "follow" &&
      (w.a === n.tag || w.b === n.tag)
    ) {
      w.ended = gw.s.chapter;
      w.how = "mutual";
    }
  }
  syncAtWar(gw);
  news(gw, "fate_vassal_free", n.tag, v.by);
  tell(gw, v.by, "fate_vassal_lost");
  gw.touch();
}

/** The founder's side is losing badly, or the founder is out. */
function losing(gw: GreatWar, by: GwTag): boolean {
  const f = gw.nation(by);
  if (f === null || f.out) return true;
  return f.side !== null && warScore(gw, f.side) <= GW_CLIENT_LOSING;
}

/** A state's half-year: loyalty drifts; at nothing it turns or goes free. */
function stateStep(gw: GreatWar, n: GwNationState): void {
  const k = n.client!;
  const row = gwClientRow(k.id);
  const at = (m: number) => beatSince(gw, k.since, m);
  const places = row.places.filter((p) => holderOf(gw, p) === n.tag);
  if (places.length === 0 && gw.world.places.size > 0) {
    // Nothing of it is left on the map: the state is gone.
    freeState(gw, n);
    return;
  }
  if (at(GW_CLIENT_DRIFT_MONTHS)) {
    let d = 0;
    const r = ruleOf(gw, k.by, row.of);
    if (r !== null && r.hard >= 2) d--;
    if (losing(gw, k.by)) d--;
    const side = gw.nation(k.by)?.side ?? null;
    const partnerHolds = row.places.some((p) => {
      const h = holderOf(gw, p);
      return (
        h !== n.tag &&
        h !== k.by &&
        side !== null &&
        gw.nation(h)?.side === side
      );
    });
    if (partnerHolds) d--;
    if (r !== null && r.relief) d++;
    k.loyalty = clampTo(k.loyalty + d, 0, GW_LOYALTY_MAX);
    // Its legions (existing rule): men for the founder.
    const f = gw.nation(k.by);
    if (f !== null) f.manpower = clampTo(f.manpower + 1, 0, 100);
  }
  // ww201: its grain reaches the founder as tribute (Economy.ts).
  if (row.grain === true && at(12)) {
    k.loyalty = clampTo(k.loyalty - 1, 0, GW_LOYALTY_MAX);
  }
  if (k.loyalty > 0 || !losing(gw, k.by)) return;
  // The enemy on its soil: it goes over to the enemy (the Hetmanate, 1918).
  const enemy = row.places
    .map((p) => holderOf(gw, p))
    .find((h) => h !== n.tag && atWarWith(gw, h, k.by));
  const e = enemy === undefined ? null : gw.nation(enemy);
  if (e !== null && e.side !== null) {
    news(gw, "fate_state_turned", n.tag, e.tag);
    tell(gw, k.by, "fate_state_lost");
    k.by = e.tag;
    delete k.with;
    k.loyalty = 1;
    k.since = gw.s.chapter;
    n.side = e.side;
    return;
  }
  freeState(gw, n);
}

/** A vassal's half-year: tribute, resistance, loyalty; it breaks away at nothing. */
function vassalStep(gw: GreatWar, n: GwNationState): void {
  const v = n.vassal!;
  const at = (m: number) => beatSince(gw, v.since, m);
  // ww201: the tribute itself is the production step's (Economy.ts).
  if (at(GW_VASSAL_TRIBUTE_MONTHS)) {
    if (v.loyalty <= 1) v.resist = clampTo(v.resist + 1, 0, 3);
    if (losing(gw, v.by)) v.loyalty = clampTo(v.loyalty - 1, 0, GW_LOYALTY_MAX);
    if (v.resist >= 3) {
      news(gw, "occupied_rising", n.tag, v.by);
      v.loyalty = clampTo(v.loyalty - 1, 0, GW_LOYALTY_MAX);
      v.resist = 1;
    }
  }
  const lord = gw.nation(v.by);
  if (v.loyalty === 0 || lord === null || (lord.out && losing(gw, v.by))) {
    freeVassal(gw, n);
  }
}

/** Military government past its term goes home; annexed land never settles. */
function rowsAfter(gw: GreatWar): void {
  const s = gw.s;
  for (const r of [...(s.rule ?? [])]) {
    if (r.until !== undefined && s.day >= r.until) {
      const occupied = (s.fates ?? []).filter(
        (x) => x.fate === "occupy" && x.by === r.by && x.of === r.of,
      );
      for (const x of occupied) {
        if (holderOf(gw, x.place) !== r.by) continue;
        moveLand(gw, x.place, r.of, null, "table");
        record(gw, {
          ...x,
          fate: "return",
          to: r.of,
          chapter: s.chapter,
          until: undefined,
        });
      }
      news(gw, "fate_term_over", r.by, r.of);
      tell(gw, r.by, "fate_term_over");
      delete r.until;
      delete r.term;
      const annexed = (s.fates ?? []).some(
        (x) => x.fate === "annex" && x.by === r.by && x.of === r.of,
      );
      if (annexed) {
        r.policy = "annexed";
        r.hard = 0;
      } else {
        s.rule = (s.rule ?? []).filter((x) => x !== r);
      }
      continue;
    }
    if (r.policy === "annexed") {
      if (r.resist < 3 && beatSince(gw, r.since, GW_ANNEX_RESIST_MONTHS)) {
        r.resist++;
      }
      if (r.resist >= 2 && beatSince(gw, r.since, 6)) {
        moveGauge(gw, r.by, "order", -1, "rule_resistance");
      }
      // ww201: annexed land's taxes are the production step's (Economy.ts).
    } else if (r.until !== undefined && r.since !== s.chapter) {
      // A term's government runs here, through the armistice (design §2.2).
      ruleMonth(gw, r);
    }
  }
}

/** A beaten country's grudge holds its trust down for ten years. */
function grudges(gw: GreatWar): void {
  for (const r of gw.s.fates ?? []) {
    if (r.fate !== "annex" && r.fate !== "state" && r.fate !== "vassal") {
      continue;
    }
    if (monthsFrom(gw, r.chapter) >= GW_REVANCHE_MONTHS) continue;
    const n = gw.nation(r.of);
    if (n === null || r.of === r.by) continue;
    if ((n.trust[r.by] ?? 0) > -2) n.trust[r.by] = -2;
  }
}

/** Chapter step, after the rule step: the years after. */
export function fateStep(gw: GreatWar): void {
  const s = gw.s;
  if (
    s.fates === undefined &&
    !s.nations.some((n) => n.client !== undefined || n.vassal !== undefined)
  ) {
    return;
  }
  rowsAfter(gw);
  for (const n of [...s.nations]) {
    if (n.client !== undefined) {
      stateStep(gw, n);
      if (n.client !== undefined) follow(gw, n, n.client.by, n.client.since);
    }
    if (n.vassal !== undefined) {
      vassalStep(gw, n);
      if (n.vassal !== undefined) follow(gw, n, n.vassal.by, n.vassal.since);
    }
  }
  grudges(gw);
}
