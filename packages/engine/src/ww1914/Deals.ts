// Great War 1914 (ww209/ww210, lane S2): bargaining in the lobby (design §3):
// deadlines, counter-offers, a law for a law, earmarks, favours owed both
// ways, threats, peeling a faction's wing, and the seat's ledger (house.deals2)
// that remembers them; word gets round. The lobby list's extras are read here
// and joined in House.lobbyViews. Everything is read off the state, nothing
// rolled; a choice shows its result only after it is made. Trust and heat
// move only through ww208's faction trust and the house's heat. See
// /home/eser/dev/ww209-format.md.
import {
  GW_OFFICES,
  type GwOffice,
  type GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_BLUFF_AUTHORITY,
  GW_BLUFF_VOID,
  GW_COUNTER_KINDS,
  GW_DEAL_TERM_CHAPTERS,
  GW_DEAL_TERMS,
  GW_PEEL_SPAN,
  GW_PEEL_SPLIT,
  GW_THREAT_KINDS,
  GW_WORD_BROKEN,
  GW_WORD_SPAN,
  type GwCounterKind,
  type GwCounterState,
  type GwDeal,
  type GwDealFate,
  type GwDealKind,
  type GwDealTerm,
  type GwDealView,
  type GwThreatKind,
  type GwWingView,
} from "@openfront/engine-api/ww1914/GwDeals";
import type {
  GwDossierView,
  GwFactionState,
} from "@openfront/engine-api/ww1914/GwHouse";
import type {
  GwLobbyView,
  GwPriceKind,
} from "@openfront/engine-api/ww1914/GwLaw";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwIdeals } from "@openfront/engine-api/ww1914/GwSociety";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  houseIds,
  wantKind,
  type GwFactionRow,
  type GwWant,
  type GwWingRow,
} from "@openfront/engine-lib/ww1914/HouseRows";
import type { GwEarmarkRow } from "@openfront/engine-lib/ww1914/MoneyRows";
import { bargainStep } from "./Bargain";
import { hasFile } from "./Dossier";
import type { GreatWar } from "./GreatWar";
import {
  agendaBill,
  agendaBills,
  bringNext,
  ctxOf,
  factionLeader,
  factionOf,
  factionRow,
  factionRows,
  heatBy,
  houseEffect,
  houseFocus,
  houseHolds,
  houseRow,
  opensNow,
  seatsNow,
  splitFaction,
  summoned,
  takeDeal,
  wantsNow,
  withFocus,
  type Moving,
} from "./House";
import { moneyDo } from "./MoneyBills";
import { moveOpinion } from "./Press";
import { holds, runEffects, type SceneCtx } from "./SceneRun";
import { breakPromise } from "./Talk";
import { factionTrust, idealsOf } from "./Utopia";
import { clampTo, reason } from "./World";

export type DealCond = Extract<GwWorldCond, { is: "ledger" }>;
export type DealEffect = Extract<GwWorldEffect, { do: "ledger" }>;

/** A war_end promise's due while the war goes on: the armistice settles it. */
const WAR_END_DUE = 1_000_000_000;
/** A threat whose faction voted against must be carried out within this. */
const THREAT_DUE = 2;
/** A law for a law, or a counter's promise, falls due after this. */
const VOTE_DUE = 6;
/** He refuses a favour called in at this temper, or at this trust. */
const FAVOUR_TEMPER = 3;
const FAVOUR_TRUST = -2;
/** A counter he takes at this score; under it, down to 0, he adds his own. */
const COUNTER_TAKE = 2;
const COUNTER_MORE = 0;
/** A promise price leaves something owed: these kinds, with a `keep`. */
const PROMISE_KINDS: readonly GwPriceKind[] = ["promise", "post", "next"];
/** The price kind a counter answers to (his ask of the same sort). */
const COUNTER_MATCH: Readonly<Record<GwCounterKind, GwPriceKind>> = {
  post: "post",
  region: "money",
  text: "concession",
  next: "next",
  favour: "favour",
  against: "promise",
};
/** Counters that leave the seat owing: shut while word has got round. */
const COUNTER_OWING: readonly GwCounterKind[] = [
  "post",
  "next",
  "favour",
  "against",
];
/** The order a wing's smaller prices are named in: cheapest first. */
const CHEAP: readonly GwPriceKind[] = [
  "money",
  "concession",
  "favour",
  "promise",
  "post",
  "next",
];

// ---- The ledger ----

const ledgerOf = (seat: GwSeatState): GwDeal[] => seat.house?.deals2 ?? [];

function addDeal(
  gw: GreatWar,
  seat: GwSeatState,
  d: Pick<GwDeal, "kind" | "faction" | "person" | "law" | "due"> &
    Partial<Pick<GwDeal, "threat" | "side" | "vote">>,
): GwDeal | null {
  const h = seat.house;
  if (h === undefined) return null;
  const row: GwDeal = {
    uid: h.nextDeal ?? 0,
    ...d,
    chapter: gw.s.chapter,
    fate: "open",
    ended: -1,
  };
  h.nextDeal = row.uid + 1;
  (h.deals2 ??= []).push(row);
  return row;
}

function endDeal(gw: GreatWar, d: GwDeal, fate: GwDealFate): void {
  d.fate = fate;
  d.ended = gw.s.chapter;
}

const openRows = (seat: GwSeatState, kind: GwDealKind, faction?: string) =>
  ledgerOf(seat).filter(
    (d) =>
      d.kind === kind &&
      d.fate === "open" &&
      (faction === undefined || d.faction === faction),
  );

const leaderOf = (gw: GreatWar, seat: GwSeatState, faction: string) =>
  factionOf(seat, faction)?.leader ?? factionLeader(gw, seat, faction);

const trustOf = (f: GwFactionState): number =>
  f.trust ?? factionRow(f.id)?.trust ?? 0;

const blocOf = (faction: string) => factionRow(faction)?.bloc ?? null;

/** The faction a promise was made to: its own field, else its house key. */
function promiseFaction(
  seat: GwSeatState,
  p: GwSeatState["promises"][number],
): string | null {
  if (p.faction !== undefined) return p.faction;
  if (!p.key.startsWith("house_")) return null;
  let best: string | null = null;
  for (const row of factionRows(seat.tag)) {
    if (!p.key.startsWith(`house_${row.id}_`)) continue;
    if (best === null || row.id.length > best.length) best = row.id;
  }
  return best;
}

/** Ideals that agree minus those that clash (Society's accord). */
function accord(a: GwIdeals, b: GwIdeals): number {
  let n = 0;
  for (const [k, v] of Object.entries(a) as [keyof GwIdeals, number][]) {
    n += (v ?? 0) * (b[k] ?? 0);
  }
  return n;
}

// ---- What the house's lobby asks of the ledger (House.ts) ----

/** A price paid now: no promise left behind it. */
export function paidNow(w: GwWant): boolean {
  const k = wantKind(w);
  return k === "money" || k === "concession";
}

/** A promise price: the deadlines (기한) he takes on it; [] for others. */
export function termsOf(w: GwWant): readonly GwDealTerm[] {
  if (w.keep === undefined || !PROMISE_KINDS.includes(wantKind(w))) return [];
  return w.terms ?? GW_DEAL_TERMS;
}

/**
 * Word gets round (§3): with GW_WORD_BROKEN promises broken to his bloc in
 * GW_WORD_SPAN chapters, its leaders take only prices paid now, until a
 * promise to the bloc is kept after the last broken one.
 */
export function paidOnly(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): boolean {
  const bloc = blocOf(faction);
  if (bloc === null) return false;
  const c = gw.s.chapter;
  let broken = 0;
  let last = -1;
  seat.promises.forEach((p, i) => {
    const f = promiseFaction(seat, p);
    if (f === null || blocOf(f) !== bloc) return;
    if (p.broken && c - Math.min(p.due, c) < GW_WORD_SPAN) {
      broken++;
      last = i;
    }
  });
  for (const d of ledgerOf(seat)) {
    if (d.fate !== "broken" || blocOf(d.faction) !== bloc) continue;
    if (c - d.ended < GW_WORD_SPAN) broken++;
  }
  if (broken < GW_WORD_BROKEN) return false;
  const kept = seat.promises.some((p, i) => {
    const f = promiseFaction(seat, p);
    return i > last && p.kept && f !== null && blocOf(f) === bloc;
  });
  return !kept;
}

/** The deadline picked on the deal with `faction` on `law`; null none. */
export function dealTerm(
  seat: GwSeatState,
  law: string,
  faction: string,
): GwDealTerm | null {
  const key = `house_${faction}_${law}`;
  return seat.promises.find((p) => p.key === key)?.term ?? null;
}

/** The seat owes him a favour (ledger `owed`, open). */
export function owesHim(seat: GwSeatState, faction: string): boolean {
  return openRows(seat, "owed", faction).length > 0;
}

/** His price "a favour later" was taken: the seat owes him one. */
export function owedFavour(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
  law: string | null,
): void {
  addDeal(gw, seat, {
    kind: "owed",
    faction,
    person: leaderOf(gw, seat, faction),
    law,
    due: -1,
  });
}

/**
 * He came to collect (his ask, the visit): `yes` brought his bill, the favour
 * is paid; no, or the ask left lying, breaks it.
 */
export function owedAnswered(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
  yes: boolean,
): void {
  const d = openRows(seat, "owed", faction)[0];
  if (d === undefined) return;
  if (yes) {
    endDeal(gw, d, "kept");
    factionTrust(seat, faction, 1);
    reason(gw, seat, "deal_owed_kept", d.person ?? undefined);
    return;
  }
  endDeal(gw, d, "broken");
  brokenCost(gw, seat, faction);
  reason(gw, seat, "deal_owed_broken", d.person ?? undefined);
}

/** A word broken: trust -2 and heat +2, as a broken promise. */
function brokenCost(gw: GreatWar, seat: GwSeatState, faction: string): void {
  factionTrust(seat, faction, -2);
  heatBy(gw, seat, faction, 2);
}

/** The wing row standing now, if it can be met apart. */
function wingNow(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwFactionRow,
): GwWingRow | null {
  const w = row.wing;
  if (w === undefined || w.peels === false) return null;
  if (w.when !== undefined && !holds(ctxOf(gw, seat), w.when)) return null;
  return w;
}

/** The wing's peel row on this bill: met (side absent) or peeled (side 1). */
const peelRow = (seat: GwSeatState, law: string, faction: string) =>
  openRows(seat, "peel", faction).find((d) => d.law === law) ?? null;

/** Its seats in a chamber: tenths of the faction's. */
const wingSeats = (seats: number, w: GwWingRow) =>
  Math.floor((seats * clampTo(w.share, 0, 10)) / 10);

// ---- The lobby list's extras ----

/** The talk card of a summoned leader, if it is on the desk. */
function talkCard(seat: GwSeatState, faction: string) {
  const topic = houseIds.lobby(faction);
  return seat.desk.find((c) => c.scene === topic) ?? null;
}

function countersOf(seat: GwSeatState): GwCounterState[] {
  return seat.house?.counters ?? [];
}

/** The earmark rows of the seat's country. */
function earmarksOf(tag: string): readonly GwEarmarkRow[] {
  return (gwContent().money?.earmarks ?? []).filter((e) => e.tag === tag);
}

/** The plan running now holds these earmarks. */
function marksNow(gw: GreatWar, seat: GwSeatState): readonly string[] {
  return gw.nation(seat.tag)?.budget.plan.marks ?? [];
}

/** An earmark is his: asked by his faction, or for no faction named. */
const markHis = (e: GwEarmarkRow, faction: string) =>
  e.faction === undefined || e.faction === faction;

/** A counter of this kind (and pick) can be put to him now. */
function counterOpen(
  gw: GreatWar,
  seat: GwSeatState,
  m: Moving,
  faction: string,
  kind: GwCounterKind,
  pick: string | null,
): boolean {
  if (COUNTER_OWING.includes(kind) && paidOnly(gw, seat, faction)) return false;
  const row = factionRow(faction);
  if (row === null) return false;
  const ctx = ctxOf(gw, seat);
  switch (kind) {
    case "post": {
      const leader = leaderOf(gw, seat, faction);
      if (leader === null) return false;
      const now = gw.person(leader)?.office ?? null;
      // The seat names the office (one the cabinet holds); null: his own ask.
      if (pick === null) return true;
      return (GW_OFFICES as readonly string[]).includes(pick) && pick !== now;
    }
    case "region": {
      const had = marksNow(gw, seat);
      const open = earmarksOf(seat.tag).filter(
        (e) =>
          markHis(e, faction) &&
          !had.includes(e.id) &&
          (e.when === undefined || holds(ctx, e.when)),
      );
      return pick === null ? open.length > 0 : open.some((e) => e.id === pick);
    }
    case "text":
      return withFocus(seat, m.st.id, () =>
        houseHolds(ctx, { is: "amendable", id: faction }),
      );
    case "next":
      return (row.bills ?? []).some((b) => opensNow(gw, seat, b));
    case "favour":
      return true;
    case "against": {
      const rivals = agendaBills(gw, seat).filter(
        (x) => x.st.id !== m.st.id && x.st.by !== null && x.st.by !== faction,
      );
      return pick === null
        ? rivals.length > 0
        : rivals.some((x) => x.st.id === pick);
    }
  }
}

/**
 * How he weighs a counter (§3): what he asked for, his ideals against the
 * rival's, his trust in the seat, his temper. Nothing rolled.
 */
function counterScore(
  gw: GreatWar,
  seat: GwSeatState,
  m: Moving,
  f: GwFactionState,
  kind: GwCounterKind,
  pick: string | null,
): number {
  const row = factionRow(f.id)!;
  const want = COUNTER_MATCH[kind];
  const named = withFocus(seat, m.st.id, () => wantsNow(ctxOf(gw, seat), f.id));
  let fit = 0;
  if (named.some((w) => wantKind(w) === want)) fit = 2;
  else if ((row.wants ?? []).some((w) => wantKind(w) === want)) fit = 1;
  let worth = 0;
  if (kind === "against" && pick !== null) {
    const by = agendaBill(gw, seat, pick)?.st.by ?? null;
    worth = by !== null && accord(idealsOf(f.id), idealsOf(by)) < 0 ? 1 : -1;
  }
  if (kind === "region" && pick !== null) {
    const e = earmarksOf(seat.tag).find((x) => x.id === pick);
    worth = e?.faction === f.id ? 1 : 0;
  }
  // A favour later is worth less than a thing now.
  if (kind === "favour") worth = -1;
  return trustOf(f) + fit + worth - f.step;
}

/** His price added to a counter ("그것에 더해 …"): his first not of its sort. */
function moreOf(
  gw: GreatWar,
  seat: GwSeatState,
  m: Moving,
  faction: string,
  kind: GwCounterKind,
): string | null {
  const named = withFocus(seat, m.st.id, () =>
    wantsNow(ctxOf(gw, seat), faction),
  );
  const other = named.find((w) => wantKind(w) !== COUNTER_MATCH[kind]);
  return (other ?? named[0])?.id ?? null;
}

/** A bluff called on his bloc lately: threats there are void. */
function threatsVoid(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): boolean {
  const bloc = blocOf(faction);
  return ledgerOf(seat).some(
    (d) =>
      d.kind === "threat" &&
      d.fate === "bluffed" &&
      blocOf(d.faction) === bloc &&
      gw.s.chapter - d.ended < GW_BLUFF_VOID,
  );
}

/** His bloc saw a threat carried out lately: it fears the next. */
function blocFears(gw: GreatWar, seat: GwSeatState, faction: string): boolean {
  const bloc = blocOf(faction);
  return ledgerOf(seat).some(
    (d) =>
      d.kind === "threat" &&
      d.fate === "carried" &&
      blocOf(d.faction) === bloc &&
      gw.s.chapter - d.ended < GW_BLUFF_VOID,
  );
}

/** He refused a favour called in, and no threat on him since: it is free. */
function threatFree(seat: GwSeatState, faction: string): boolean {
  const rows = ledgerOf(seat).filter((d) => d.faction === faction);
  const refused = rows.filter((d) => d.kind === "owe" && d.fate === "refused");
  if (refused.length === 0) return false;
  const at = refused[refused.length - 1].uid;
  return !rows.some((d) => d.kind === "threat" && d.uid > at);
}

/** The threats the seat can make on him now. */
function threatsOf(
  gw: GreatWar,
  seat: GwSeatState,
  m: Moving,
  faction: string,
): GwThreatKind[] {
  const f = factionOf(seat, faction);
  if (f === null || m.st.deals.includes(faction)) return [];
  if (threatsVoid(gw, seat, faction)) return [];
  if (openRows(seat, "threat", faction).some((d) => d.law === m.st.id)) {
    return [];
  }
  const leader = f.leader;
  const had = marksNow(gw, seat);
  const out: GwThreatKind[] = [];
  for (const k of GW_THREAT_KINDS) {
    let ok = false;
    switch (k) {
      case "file":
        ok = leader !== null && hasFile(seat, leader);
        break;
      case "dissolve":
        ok = (houseRow(seat.tag)?.chambers ?? []).some(
          (c) => c.elect !== undefined,
        );
        break;
      case "condemn":
        ok = f.status === "in";
        break;
      case "post":
        ok = leader !== null && (gw.person(leader)?.office ?? null) !== null;
        break;
      case "region":
        ok = earmarksOf(seat.tag).some(
          (e) => e.faction === faction && had.includes(e.id),
        );
        break;
    }
    if (ok) out.push(k);
  }
  return out;
}

/** The wing's smaller prices: its own rows, else the faction's cheapest. */
function wingWants(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwFactionRow,
  w: GwWingRow,
  law: string,
): GwWant[] {
  const ctx = { ...ctxOf(gw, seat), cast: {} };
  const ok = (x: GwWant) => x.when === undefined || holds(ctx, x.when);
  return withFocus(seat, law, () => {
    if (w.wants !== undefined) return w.wants.filter(ok).slice(0, 2);
    const rank = (x: GwWant) => CHEAP.indexOf(wantKind(x));
    return (row.wants ?? [])
      .filter((x) => ok(x) && wantKind(x) !== "concession")
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 2);
  });
}

/** A house call, else an audience, for the wing's man. */
function canCall(seat: GwSeatState): boolean {
  return (seat.house?.calls ?? 0) > 0 || seat.audiences > 0;
}

function spendCall(seat: GwSeatState): boolean {
  const h = seat.house;
  if (h !== undefined && h.calls > 0) {
    h.calls--;
    return true;
  }
  if (seat.audiences > 0) {
    seat.audiences--;
    return true;
  }
  return false;
}

function wingView(
  gw: GreatWar,
  seat: GwSeatState,
  m: Moving,
  row: GwFactionRow,
  open: boolean,
): GwWingView | null {
  const w = wingNow(gw, seat, row);
  if (w === null) return null;
  const now = seatsNow(seat, row);
  const first = (houseRow(seat.tag)?.chambers ?? []).find(
    (c) => (now[c.id] ?? 0) > 0,
  );
  const seats = first === undefined ? 0 : wingSeats(now[first.id] ?? 0, w);
  const d = peelRow(seat, m.st.id, row.id);
  const met = d !== null && d.side === undefined;
  return {
    person: w.person,
    seats,
    prices: met
      ? wingWants(gw, seat, row, w, m.st.id).map((x) => ({
          id: x.id,
          kind: wantKind(x),
        }))
      : null,
    peeled: d?.side === 1,
    call: open && d === null && !m.st.deals.includes(row.id) && canCall(seat),
  };
}

/** The lobby row's ww210 extras for one faction (House.lobbyViews). */
export function lobbyExtras(
  gw: GreatWar,
  seat: GwSeatState,
  m: Moving,
  row: GwFactionRow,
  open: boolean,
): Pick<
  GwLobbyView,
  "counters" | "counter" | "threats" | "favour" | "paidOnly" | "wing"
> {
  const id = row.id;
  const dealt = m.st.deals.includes(id);
  const on = summoned(seat, m.st.id, id);
  const card = on ? talkCard(seat, id) : null;
  const made = countersOf(seat).filter(
    (c) => c.law === m.st.id && c.faction === id,
  );
  const last = made[made.length - 1] ?? null;
  const fresh =
    card !== null && !made.some((c) => c.card === card.uid) && !dealt;
  const prices = on
    ? withFocus(seat, m.st.id, () => wantsNow(ctxOf(gw, seat), id))
    : [];
  return {
    counters: fresh
      ? GW_COUNTER_KINDS.filter((k) => counterOpen(gw, seat, m, id, k, null))
      : [],
    counter:
      last === null
        ? null
        : {
            kind: last.kind,
            pick: last.pick,
            answer: last.answer,
            more: last.more,
          },
    threats: open ? threatsOf(gw, seat, m, id) : [],
    favour: {
      can: on && !dealt && prices.length > 0,
      owes: open && !dealt && openRows(seat, "owe", id).length > 0,
    },
    paidOnly: paidOnly(gw, seat, id),
    wing: wingView(gw, seat, m, row, open),
  };
}

// ---- The orders ----

/** The bill on the agenda, open for talks, and the faction sitting on it. */
function talks(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
): { m: Moving; f: GwFactionState; row: GwFactionRow } | GwOrderBlock {
  const m = agendaBill(gw, seat, law);
  if (m === null || (m.st.stage !== "persuade" && m.st.stage !== "vote")) {
    return "no_law";
  }
  const f = factionOf(seat, faction);
  const row = factionRow(faction);
  if (f === null || row === null || f.status !== "in") return "no_topic";
  return { m, f, row };
}

/** His talk ends (as 들어준다 / 그냥 돌려보낸다 end it). */
function endTalk(seat: GwSeatState, faction: string): void {
  const topic = houseIds.lobby(faction);
  seat.desk = seat.desk.filter((c) => c.scene !== topic);
}

/** Order `bill_term`: his promise price taken, due by the term picked. */
export function billTerm(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
  want: string,
  term: GwDealTerm,
): GwOrderBlock | null {
  const t = talks(gw, seat, law, faction);
  if (typeof t === "string") return t;
  if (!summoned(seat, law, faction)) return "no_topic";
  if (paidOnly(gw, seat, faction)) return "paid_only";
  const ctx = ctxOf(gw, seat);
  houseFocus(seat, law);
  const w = wantsNow(ctx, faction).find((x) => x.id === want);
  if (w === undefined) return "no_topic";
  if (!termsOf(w).includes(term)) return "no_term";
  takeDeal(ctx, faction, want);
  const key = `house_${faction}_${law}`;
  const p = seat.promises.find((x) => x.key === key && !x.kept && !x.broken);
  if (p !== undefined) {
    p.term = term;
    p.faction = faction;
    const n = GW_DEAL_TERM_CHAPTERS[term];
    p.due = n < 0 ? WAR_END_DUE : gw.s.chapter + n;
  }
  counterSealed(gw, seat, law, faction, want);
  endTalk(seat, faction);
  return null;
}

/** Order `bill_counter`: one counter-offer a call; his answer shows after. */
export function billCounter(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
  counter: GwCounterKind,
  pick: string | null,
): GwOrderBlock | null {
  const t = talks(gw, seat, law, faction);
  if (typeof t === "string") return t;
  const { m, f } = t;
  const card = summoned(seat, law, faction) ? talkCard(seat, faction) : null;
  if (card === null) return "no_topic";
  if (m.st.deals.includes(faction)) return "no_counter";
  const made = countersOf(seat).some(
    (c) => c.card === card.uid && c.faction === faction,
  );
  if (made) return "no_counter";
  const needs =
    counter === "region" ||
    counter === "against" ||
    (counter === "post" && officeWanted(faction) === null);
  if (needs && pick === null) return "no_counter";
  if (!counterOpen(gw, seat, m, faction, counter, pick)) return "no_counter";
  houseFocus(seat, law);
  const score = counterScore(gw, seat, m, f, counter, pick);
  const more =
    score >= COUNTER_TAKE ? null : moreOf(gw, seat, m, faction, counter);
  const answer =
    score >= COUNTER_TAKE
      ? "take"
      : score >= COUNTER_MORE && more !== null
        ? "more"
        : "refuse";
  const row: GwCounterState = {
    law,
    faction,
    card: card.uid,
    kind: counter,
    pick,
    answer,
    more: answer === "more" ? more : null,
  };
  (seat.house!.counters ??= []).push(row);
  const who = f.leader ?? undefined;
  if (answer === "take") {
    applyCounter(gw, seat, m, faction, counter, pick);
    row.sealed = true;
    endTalk(seat, faction);
    reason(gw, seat, "deal_counter_take", who);
  } else if (answer === "refuse") {
    // A refusal costs only the call.
    endTalk(seat, faction);
    reason(gw, seat, "deal_counter_refuse", who);
  } else {
    reason(gw, seat, "deal_counter_more", who);
  }
  return null;
}

/**
 * His added price was taken (bill_price or bill_term with that want): the
 * counter he asked more for comes with it.
 */
export function counterSealed(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
  want: string,
): void {
  const c = countersOf(seat).find(
    (x) =>
      x.law === law &&
      x.faction === faction &&
      x.answer === "more" &&
      x.sealed !== true &&
      x.more === want,
  );
  const m = agendaBill(gw, seat, law);
  if (c === undefined || m === null) return;
  c.sealed = true;
  applyCounter(gw, seat, m, faction, c.kind, c.pick, false);
}

/** The office his post price names, if any (a counter's post with no pick). */
function officeWanted(faction: string): string | null {
  for (const w of factionRow(faction)?.wants ?? []) {
    if (wantKind(w) !== "post" || w.keep === undefined) continue;
    const k = w.keep as { kind?: string; office?: string };
    if (k.kind === "holder" && k.office !== undefined) return k.office;
  }
  return null;
}

/** A counter taken: what the seat offered is given, his faction for the bill. */
function applyCounter(
  gw: GreatWar,
  seat: GwSeatState,
  m: Moving,
  faction: string,
  kind: GwCounterKind,
  pick: string | null,
  deal = true,
): void {
  const f = factionOf(seat, faction)!;
  const law = m.st.id;
  const ctx = ctxOf(gw, seat);
  const leader = leaderOf(gw, seat, faction);
  if (deal && !m.st.deals.includes(faction)) {
    m.st.deals.push(faction);
    f.heat = Math.max(0, f.heat - 1);
  }
  switch (kind) {
    case "post": {
      const office = (pick ?? officeWanted(faction)) as GwOffice | null;
      const key = `house_${faction}_${law}`;
      if (office === null || leader === null) return;
      if (seat.promises.some((p) => p.key === key)) return;
      const keep: GwCond = { kind: "holder", office, person: leader };
      seat.promises.push({
        key,
        who: leader,
        due: gw.s.chapter + VOTE_DUE,
        kept: false,
        broken: false,
        keep: JSON.stringify(keep),
        back: null,
        faction,
      });
      f.deals.push(key);
      return;
    }
    case "region":
      if (pick !== null) moneyDo(ctx, { do: "earmark", id: pick, on: true });
      return;
    case "text":
      withFocus(seat, law, () =>
        houseEffect(ctx, { do: "amend", id: faction }),
      );
      return;
    case "next": {
      const row = factionRow(faction)!;
      const his = (row.bills ?? []).find((b) => opensNow(gw, seat, b));
      if (his === undefined) return;
      bringNext(gw, seat, faction, { id: "counter_next", kind: "next" });
      addDeal(gw, seat, {
        kind: "vote",
        faction,
        person: leader,
        law,
        vote: his,
        side: 1,
        due: gw.s.chapter + VOTE_DUE,
      });
      return;
    }
    case "favour":
      owedFavour(gw, seat, faction, law);
      return;
    case "against":
      if (pick === null) return;
      addDeal(gw, seat, {
        kind: "vote",
        faction,
        person: leader,
        law,
        vote: pick,
        side: -1,
        due: gw.s.chapter + VOTE_DUE,
      });
      return;
  }
}

/**
 * Order `bill_favour`. `call` false: 빚으로 남긴다, his price paid now with no
 * vote asked; he owes the seat. `call` true: 빚을 받는다 on this bill.
 */
export function billFavour(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
  want: string | null,
  call: boolean,
): GwOrderBlock | null {
  const t = talks(gw, seat, law, faction);
  if (typeof t === "string") return t;
  const { m, f } = t;
  if (m.st.deals.includes(faction)) return "no_favour";
  const who = f.leader ?? undefined;
  if (!call) {
    if (want === null || !summoned(seat, law, faction)) return "no_favour";
    const ctx = ctxOf(gw, seat);
    houseFocus(seat, law);
    if (!wantsNow(ctx, faction).some((w) => w.id === want)) return "no_topic";
    takeDeal(ctx, faction, want, false);
    addDeal(gw, seat, {
      kind: "owe",
      faction,
      person: leaderOf(gw, seat, faction),
      law,
      due: -1,
    });
    endTalk(seat, faction);
    reason(gw, seat, "deal_favour_owe", who);
    return null;
  }
  if (want !== null) return "no_favour";
  const d = openRows(seat, "owe", faction)[0];
  if (d === undefined) return "no_favour";
  houseFocus(seat, law);
  if (f.step >= FAVOUR_TEMPER || trustOf(f) <= FAVOUR_TRUST) {
    endDeal(gw, d, "refused");
    reason(gw, seat, "deal_favour_refused", who);
    return null;
  }
  endDeal(gw, d, "called");
  d.law = law;
  m.st.deals.push(faction);
  reason(gw, seat, "deal_favour_called", who);
  return null;
}

/** Order `bill_threat`: what the seat will do if his faction votes against. */
export function billThreat(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
  threat: GwThreatKind,
): GwOrderBlock | null {
  const t = talks(gw, seat, law, faction);
  if (typeof t === "string") return t;
  const { m, f } = t;
  if (!threatsOf(gw, seat, m, faction).includes(threat)) return "no_threat";
  houseFocus(seat, law);
  const free = threatFree(seat, faction);
  const fears = blocFears(gw, seat, faction);
  addDeal(gw, seat, {
    kind: "threat",
    faction,
    person: f.leader,
    law,
    threat,
    due: -1,
  });
  if (!free) {
    factionTrust(seat, faction, -1);
    heatBy(gw, seat, faction, 1);
  }
  // His waverers come in; a bloc that saw the last threat carried comes over.
  if (!m.st.warm.includes(faction)) m.st.warm.push(faction);
  if (fears && !m.st.deals.includes(faction)) m.st.deals.push(faction);
  reason(gw, seat, `deal_threat_${threat}`, f.leader ?? undefined);
  return null;
}

/**
 * Order `bill_peel`: `want` null summons his wing's man on this bill (a call);
 * a `want` of the wing's then takes his smaller price: the wing votes apart.
 */
export function billPeel(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
  want: string | null,
): GwOrderBlock | null {
  const t = talks(gw, seat, law, faction);
  if (typeof t === "string") return t;
  const { m, f, row } = t;
  const w = wingNow(gw, seat, row);
  if (w === null || m.st.deals.includes(faction)) return "no_wing";
  const d = peelRow(seat, law, faction);
  if (want === null) {
    if (d !== null || !spendCall(seat)) return "no_wing";
    houseFocus(seat, law);
    addDeal(gw, seat, {
      kind: "peel",
      faction,
      person: w.person,
      law,
      due: -1,
    });
    reason(gw, seat, "deal_peel_met", w.person);
    return null;
  }
  if (d === null || d.side !== undefined) return "no_wing";
  const x = wingWants(gw, seat, row, w, law).find((y) => y.id === want);
  if (x === undefined) return "no_topic";
  houseFocus(seat, law);
  if (x.keep !== undefined) {
    seat.promises.push({
      key: `house_${faction}_${law}_wing`,
      who: w.person,
      due: gw.s.chapter + (x.chapters ?? 6),
      kept: false,
      broken: false,
      keep: JSON.stringify(x.keep),
      back: x.back ?? null,
      faction,
    });
  }
  if (wantKind(x) === "favour") owedFavour(gw, seat, faction, law);
  runEffects({ gw, seat, cast: {} }, x.effects ?? []);
  d.side = 1;
  // The leader's price: trust, heat, and the split it presses.
  factionTrust(seat, faction, -1);
  heatBy(gw, seat, faction, 1);
  f.split = (f.split ?? 0) + 1;
  const c = gw.s.chapter;
  f.peels = [...(f.peels ?? []).filter((at) => c - at < GW_PEEL_SPAN), c];
  reason(gw, seat, "deal_peel", w.person);
  if (f.peels.length >= GW_PEEL_SPLIT) wingSplits(gw, seat, row, w);
  return null;
}

/** The sitting faction nearest these ideals, not the wing's own. */
function nearest(
  seat: GwSeatState,
  row: GwFactionRow,
  ideals: GwIdeals,
): string | null {
  let best: string | null = null;
  let score = -99;
  for (const r of factionRows(seat.tag)) {
    if (r.id === row.id || factionOf(seat, r.id)?.status !== "in") continue;
    const a = accord(ideals, r.ideals ?? {});
    if (a > score) {
      score = a;
      best = r.id;
    }
  }
  return best;
}

/**
 * Met apart twice within GW_PEEL_SPAN: the wing leaves, as its own party
 * (the row's split into `into`) or into the nearest faction by ideals.
 */
function wingSplits(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwFactionRow,
  w: GwWingRow,
): void {
  const st = factionOf(seat, row.id)!;
  st.peels = [];
  const own = w.into === undefined || w.into === row.splits?.into;
  if (row.splits !== undefined && own && splitFaction(gw, seat, row)) {
    reason(gw, seat, "deal_wing_split", w.person);
    return;
  }
  const into = w.into ?? nearest(seat, row, w.ideals);
  const to = into === null ? null : factionOf(seat, into);
  const toRow = into === null ? null : factionRow(into);
  if (to === null || toRow === null) return;
  if (to.status === "merged" || to.status === "gone") return;
  const from = seatsNow(seat, row);
  const left = { ...from };
  const got = to.status === "in" ? { ...seatsNow(seat, toRow) } : {};
  for (const [c, k] of Object.entries(from) as [keyof typeof from, number][]) {
    const move = wingSeats(k ?? 0, w);
    left[c] = (k ?? 0) - move;
    got[c] = (got[c] ?? 0) + move;
  }
  st.seats = left;
  to.seats = got;
  if (to.status !== "in") {
    to.status = "in";
    to.since = gw.s.chapter;
    to.leader = factionLeader(gw, seat, to.id);
  }
  reason(gw, seat, "deal_wing_split", w.person);
}

// ---- Each chapter ----

/** Each chapter, after the house: deadlines due, threats, the armistice. */
export function dealStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.house === undefined) continue;
    settleThreats(gw, seat);
    settleVotes(gw, seat);
    settlePeels(gw, seat);
    settleWarEnd(gw, seat);
    pruneCounters(gw, seat);
  }
  bargainStep(gw);
}

/** The house's last vote, if it was on `law` at or after `since`. */
function votedOn(seat: GwSeatState, law: string, since: number) {
  const last = seat.house?.last ?? null;
  return last !== null && last.law === law && last.chapter >= since
    ? last
    : null;
}

const onAgenda = (gw: GreatWar, seat: GwSeatState, law: string) =>
  agendaBill(gw, seat, law) !== null;

function settleThreats(gw: GreatWar, seat: GwSeatState): void {
  const c = gw.s.chapter;
  for (const d of openRows(seat, "threat")) {
    if (d.law === null) continue;
    if (d.due === -1) {
      const last = votedOn(seat, d.law, d.chapter);
      if (last === null) {
        if (!onAgenda(gw, seat, d.law)) endDeal(gw, d, "lapsed");
        continue;
      }
      const blocks = (last.ballot?.chambers ?? []).flatMap((ch) => ch.blocks);
      const against = blocks.some(
        (b) =>
          b.faction === d.faction && b.cast === "against" && b.wing !== true,
      );
      if (!against) {
        endDeal(gw, d, "kept");
        continue;
      }
      d.due = c + THREAT_DUE;
      reason(gw, seat, "deal_threat_due", d.person ?? undefined);
      continue;
    }
    if (carriedOut(gw, seat, d)) {
      endDeal(gw, d, "carried");
      heatBy(gw, seat, d.faction, 2);
      factionTrust(seat, d.faction, -1);
      reason(gw, seat, "deal_threat_carried", d.person ?? undefined);
      continue;
    }
    if (c <= d.due) continue;
    endDeal(gw, d, "bluffed");
    const n = gw.nation(seat.tag);
    if (n !== null) n.authority = Math.max(0, n.authority - GW_BLUFF_AUTHORITY);
    reason(gw, seat, "deal_threat_bluffed", d.person ?? undefined);
  }
}

/** The harm threatened has been done since the threat. */
function carriedOut(gw: GreatWar, seat: GwSeatState, d: GwDeal): boolean {
  const f = factionOf(seat, d.faction);
  switch (d.threat) {
    case "file":
      return seat.memory.some(
        (m) =>
          m.key === "file_held" && m.who === d.person && m.chapter >= d.chapter,
      );
    case "dissolve":
      return (seat.society?.elections ?? []).some(
        (e) => e.cause === "dissolved" && e.chapter >= d.chapter,
      );
    case "condemn":
      return f !== null && (f.judgedAt ?? -1) >= d.chapter;
    case "post":
      return (
        d.person !== null && (gw.person(d.person)?.office ?? null) === null
      );
    case "region": {
      const had = marksNow(gw, seat);
      return !earmarksOf(seat.tag).some(
        (e) => e.faction === d.faction && had.includes(e.id),
      );
    }
    default:
      return false;
  }
}

/** A law for a law: given when his bill is voted, broken past its day. */
function settleVotes(gw: GreatWar, seat: GwSeatState): void {
  const n = gw.nation(seat.tag);
  if (n === null) return;
  for (const d of openRows(seat, "vote")) {
    if (d.vote === undefined) continue;
    const st = n.laws.find((x) => x.id === d.vote);
    const passed = st?.stage === "force" && st.since >= d.chapter;
    const voted = votedOn(seat, d.vote, d.chapter) !== null;
    const moving = onAgenda(gw, seat, d.vote);
    let fate: GwDealFate | null = null;
    if (d.side === 1) {
      if (passed || voted) fate = "kept";
      else if (gw.s.chapter > d.due && !moving) fate = "broken";
    } else if (passed) {
      fate = "broken";
    } else if (!moving || gw.s.chapter > d.due) {
      fate = "kept";
    }
    if (fate === null) continue;
    endDeal(gw, d, fate);
    if (fate === "kept") factionTrust(seat, d.faction, 1);
    else brokenCost(gw, seat, d.faction);
    reason(gw, seat, `deal_vote_${fate}`, d.person ?? undefined);
  }
}

/** A wing met apart: its bill voted (kept), or gone without it (lapsed). */
function settlePeels(gw: GreatWar, seat: GwSeatState): void {
  for (const d of openRows(seat, "peel")) {
    if (d.law === null) continue;
    if (d.side === 1 && votedOn(seat, d.law, d.chapter) !== null) {
      endDeal(gw, d, "kept");
    } else if (!onAgenda(gw, seat, d.law)) {
      endDeal(gw, d, "lapsed");
    }
  }
}

/**
 * The armistice: promises made "after the war" fall due in one go; one not
 * kept breaks, and its bloc steps down a notch too.
 */
function settleWarEnd(gw: GreatWar, seat: GwSeatState): void {
  if (gw.s.armistice === null) return;
  for (const p of seat.promises) {
    if (p.term !== "war_end" || p.kept || p.broken) continue;
    p.due = gw.s.chapter;
    breakPromise(gw, seat, p);
    const f = promiseFaction(seat, p);
    const bloc = f === null ? null : blocOf(f);
    if (bloc !== null) moveOpinion(seat, bloc, -1);
    reason(gw, seat, "deal_war_end_broken", p.who);
  }
}

/** Counters on bills no longer on the agenda go. */
function pruneCounters(gw: GreatWar, seat: GwSeatState): void {
  const h = seat.house!;
  if (h.counters === undefined) return;
  const kept = h.counters.filter((c) => onAgenda(gw, seat, c.law));
  if (kept.length === 0) delete h.counters;
  else h.counters = kept;
}

// ---- The world's conditions and effects ----

export function dealHolds(ctx: SceneCtx, c: DealCond): boolean {
  const fate = c.fate ?? "open";
  return ledgerOf(ctx.seat).some(
    (d) =>
      d.kind === c.kind &&
      d.fate === fate &&
      (c.id === undefined || d.faction === c.id),
  );
}

export function dealDo(ctx: SceneCtx, e: DealEffect): void {
  const { gw, seat } = ctx;
  if (factionOf(seat, e.id) === null) return;
  addDeal(gw, seat, {
    kind: e.kind,
    faction: e.id,
    person: leaderOf(gw, seat, e.id),
    law: null,
    due: -1,
  });
}

// ---- What the screen reads ----

/** The notebook's 약속과 빚 box (`dossier.deals`): newest first. */
export function dealsDossierView(
  _gw: GreatWar,
  seat: GwSeatState,
  v: GwDossierView | undefined,
): GwDossierView | undefined {
  const rows = ledgerOf(seat);
  if (v === undefined || rows.length === 0) return v;
  const deals: GwDealView[] = [...rows].reverse().map((d) => ({
    uid: d.uid,
    kind: d.kind,
    faction: d.faction,
    person: d.person,
    law: d.law,
    threat: d.threat ?? null,
    chapter: d.chapter,
    due: d.due,
    fate: d.fate,
  }));
  return { ...v, deals };
}
