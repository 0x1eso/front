// Great War 1914 (ww199, design ww198 + the vassal): a beaten country's fate.
// Each place a table gives up gets a fate (GwFate): annexed, held under
// military government for a term, made into a new state (a real country of
// its own colour and name), given to an ally, given back, or kept as the
// victor's vassal (the beaten country's colour, named as its dependency).
// The seat paints fates (order `fate_paint`, or a `settle` course's plan); the
// table reads them; signing applies them. The years after run from state:
// a state's loyalty drifts and it may turn, a vassal pays and resists and
// follows its overlord into war, annexed land never settles, and a beaten
// country remembers (revanche).
import type {
  GwSeatState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GwClient,
  GwFate,
  GwFateMark,
  GwFateTerm,
  gwLoyaltyWord,
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
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GW_CLIENT_ROWS,
  GW_REGENCY,
  GW_REVANCHE_MONTHS,
  gwClientRow,
} from "@openfront/engine-lib/ww1914/FateRows";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import { GW_TABLE_AIMS } from "@openfront/engine-lib/ww1914/TableRows";
import { claimsOpen } from "./Claims";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./Land";
import { hasLandGraph, landGraph } from "./Occupation";
import { monthsFrom } from "./World";

export type GwFateCond = Extract<
  GwWorldCond,
  { is: "fate" | "client_state" | "vassal" | "revanche" | "settle_open" }
>;
export type GwFateEffect = Extract<
  GwWorldEffect,
  { do: "crown" | "treaty_sign" | "settle_plan" }
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
  if (how === "press" && (t.extra ?? 0) > 0) return "no_sign";
  t.sign ??= {};
  t.sign[seat.tag] = how;
  return null;
}

/** The ways the seat may sign now; empty when nothing waits for its hand. */
export function signWays(gw: GreatWar, seat: GwSeatState): GwSignHow[] {
  const t = gw.s.table;
  if (t === null || t.closed || !t.order.includes(seat.tag)) return [];
  if (t.sign?.[seat.tag] !== undefined) return [];
  return (t.extra ?? 0) > 0
    ? ["sign", "reserve"]
    : ["sign", "press", "reserve"];
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

/** The crown is set: an own house costs the partners and the neutrals (S1). */
export function setCrown(gw: GreatWar, tag: GwTag, pick: string): void {
  const n = gw.nation(tag);
  if (n?.client === undefined) return;
  n.client.crown = pick;
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
  }
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

/** Chapter step (S1): the years after. */
export function fateStep(_gw: GreatWar): void {}
