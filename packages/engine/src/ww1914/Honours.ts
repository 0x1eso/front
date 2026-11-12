// Great War 1914 (ww196 §4): honours at their occasions, out of the audience.
// A seat's honours rows (GwHonourRow) bring a free desk paper, the 서훈 명단,
// on their occasion: a date (the New Year, the sovereign's birthday), the
// chapter after a front won, a deed. The 서훈식 (1 of the time, open that
// chapter and the next) gives who gets what: each one honoured gains trust,
// his rivals lose it, the bloc he stands for warms, a proud one left out
// remembers. Unheld, the proposers' list is given as 대행, with nothing for
// the ruler's name. A department may petition between lists (서훈 상신).
// Rows: content/depts/<seat>.ts `honours`, `orders`.
import {
  GW_TRUST_MAX,
  GW_TRUST_MIN,
  GwCard,
  GwOffice,
  GwPaper,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwHonourOrder,
  GwHonourPool,
  GwHonourRow,
  GwPetitionAnswer,
} from "@openfront/engine-api/ww1914/GwDepts";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_PROUD,
  GW_TIME_PRICES,
} from "@openfront/engine-lib/ww1914/TaskRows";
import {
  civilFromDays,
  daysFromCivil,
} from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  deptHead,
  deptState,
  layPaper,
  paperCard,
  paperOf,
} from "./Departments";
import { ownFronts } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { holds, personDef, removeCard, rivalIds, runEffects } from "./SceneRun";
import { spendTime } from "./Time";
import { reasonOf, seatPerson } from "./World";

const P_DEED = idHash("gw_honour_deed");
/** Percent a won front's chapter brings a deed worth a cross. */
const DEED_PCT = 30;
/** Names on a list, at most. */
const LIST_MAX = 5;
/** Chapters a victory's list or petition waits before the next of its row. */
const VICTORY_GAP = 2;
/** Chapters a ceremony stays open after the list comes: the next one too. */
const CEREMONY_OPEN = 1;

/** The bloc that warms when one of a pool is honoured. */
const POOL_BLOC: Readonly<Record<GwHonourPool, GwBloc>> = {
  generals: "army",
  soldier: "army",
  heads: "court",
  officials: "court",
  industry: "business",
};

/** Offices whose holders a pool draws from. */
const POOL_OFFICES: Readonly<Partial<Record<GwHonourPool, GwOffice[]>>> = {
  generals: ["chief_of_staff", "supreme_commander", "war", "navy", "sea_lord"],
  industry: ["munitions", "finance"],
  officials: ["chancellor", "interior", "foreign", "court", "agriculture"],
};

type ListPaper = Extract<GwPaper, { form: "honours" }>;
type PetitionPaper = Extract<GwPaper, { form: "petition" }>;

function iso(days: number): string {
  const c = civilFromDays(days);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${c.year}-${two(c.month)}-${two(c.day)}`;
}

function clampTrust(v: number): number {
  return Math.max(GW_TRUST_MIN, Math.min(GW_TRUST_MAX, v));
}

function rowsOf(seat: GwSeatState): GwHonourRow[] {
  return (gwContent().depts?.honours ?? []).filter((r) =>
    r.nation.includes(seat.tag),
  );
}

function orderOf(id: string): GwHonourOrder | null {
  return (gwContent().depts?.orders ?? []).find((o) => o.id === id) ?? null;
}

/** The chapter's days: from its opening to the next one's. */
function chapterDays(gw: GreatWar): [number, number] {
  const next = gwChapters(gw.s.calendar)[gw.s.chapter + 1];
  const start = gw.s.day;
  return [start, next === undefined ? start + 31 : next.day + gw.s.dayShift];
}

/** The day of a `date` row in this chapter, if it falls in it. */
function dateIn(gw: GreatWar, r: GwHonourRow): number | null {
  if (r.day === undefined) return null;
  const [start, end] = chapterDays(gw);
  const [m, d] = r.day.split("-").map(Number);
  const years = new Set([civilFromDays(start).year, civilFromDays(end).year]);
  for (const y of years) {
    const day = daysFromCivil(y, m, d);
    if (day >= start && day < end) return day;
  }
  return null;
}

/** The fronts the seat won last chapter. */
function wonFronts(gw: GreatWar, seat: GwSeatState): string[] {
  const c = gw.s.chapter - 1;
  return seat.log.flatMap((l) => {
    if (l.chapter !== c) return [];
    const m = /^front_([a-z_]+)_won$/.exec(l.key);
    return m === null ? [] : [m[1]];
  });
}

function lastHeld(seat: GwSeatState, row: string): number | null {
  const at = (seat.depts?.honours ?? [])
    .filter((h) => h.row === row)
    .map((h) => h.chapter);
  return at.length === 0 ? null : Math.max(...at);
}

/** Whether the row's occasion is now; for a front, the front won. */
function occasionNow(gw: GreatWar, seat: GwSeatState, r: GwHonourRow): boolean {
  const day = r.occasion === "date" ? dateIn(gw, r) : gw.s.day;
  if (day === null) return false;
  if (r.since !== undefined && iso(day) < r.since) return false;
  if (r.until !== undefined && iso(day) > r.until) return false;
  if (r.when !== undefined && !holds({ gw, seat, cast: {} }, r.when)) {
    return false;
  }
  const last = lastHeld(seat, r.id);
  if (r.occasion === "date") return last !== gw.s.chapter;
  if (last !== null && gw.s.chapter - last <= VICTORY_GAP) return false;
  const won = wonFronts(gw, seat).filter(
    (t) => r.theatre === undefined || (r.theatre as string[]).includes(t),
  );
  if (won.length === 0) return false;
  if (r.occasion === "deed") {
    const roll = wwRoll(gw.s.seed, P_DEED, gw.s.chapter, idHash(r.id));
    return roll % 100 < DEED_PCT;
  }
  return true;
}

/** Orders of the row valid on the chapter's day, best (rank 1) first. */
function ordersNow(gw: GreatWar, r: GwHonourRow): GwHonourOrder[] {
  const today = iso(gw.s.day);
  return r.orders
    .flatMap((id) => {
      const o = orderOf(id);
      return o === null ? [] : [o];
    })
    .filter(
      (o) =>
        (o.from === undefined || o.from <= today) &&
        (o.until === undefined || o.until >= today),
    )
    .sort((a, b) => a.rank - b.rank);
}

function ownActive(gw: GreatWar, seat: GwSeatState, id: string | null) {
  if (id === null || id === seatPerson(seat)) return false;
  return gw.person(id)?.status === "active" && personDef(id)?.tag === seat.tag;
}

/** The people of a pool now, the likeliest first. */
function poolPeople(
  gw: GreatWar,
  seat: GwSeatState,
  pool: GwHonourPool,
): (string | null)[] {
  if (pool === "soldier") return [null];
  const out: string[] = [];
  if (pool === "generals") {
    const won = wonFronts(gw, seat);
    const fronts = [...ownFronts(gw, seat)].sort(
      (a, b) => Number(won.includes(b.id)) - Number(won.includes(a.id)),
    );
    for (const t of fronts) if (t.commander !== null) out.push(t.commander);
  }
  if (pool === "heads") {
    const c = gw.s.chapter;
    const taken = (seat.depts?.past ?? []).filter(
      (p) =>
        c - p.chapter <= 6 &&
        (p.course ?? null) !== null &&
        (p.verdict === "accept" || p.verdict === "overrule"),
    );
    for (const p of [...taken].reverse()) {
      const h = deptHead(gw, seat, p.office);
      if (h !== null) out.push(h.id);
    }
  }
  for (const o of POOL_OFFICES[pool] ?? []) {
    const h = deptHead(gw, seat, o);
    if (h !== null) out.push(h.id);
  }
  return [...new Set(out)].filter((id) => ownActive(gw, seat, id));
}

/** The proposers' list: who, from which pool, with the honour proposed. */
function listOf(gw: GreatWar, seat: GwSeatState, r: GwHonourRow): ListPaper {
  const orders = ordersNow(gw, r);
  const entries: ListPaper["entries"] = [];
  const seen = new Set<string>();
  const from = (pool: GwHonourPool): GwOffice =>
    POOL_OFFICES[pool]?.find((o) => r.from.includes(o)) ?? r.from[0];
  for (const pool of r.pools) {
    const fit = orders.filter((o) => o.pools.includes(pool));
    if (fit.length === 0) continue;
    let i = 0;
    for (const person of poolPeople(gw, seat, pool)) {
      if (entries.length >= LIST_MAX || i >= 2) break;
      if (person !== null && seen.has(person)) continue;
      if (person !== null) seen.add(person);
      entries.push({
        person,
        pool,
        honour: fit[Math.min(i, fit.length - 1)].id,
        from: from(pool),
      });
      i++;
    }
  }
  return {
    form: "honours",
    row: r.id,
    until: gw.s.chapter + CEREMONY_OPEN,
    entries,
    orders: orders.map((o) => o.id),
  };
}

/** A department's 서훈 상신 after a victory in its field. */
function petitionOf(
  gw: GreatWar,
  seat: GwSeatState,
  r: GwHonourRow,
): PetitionPaper | null {
  const office = r.from.find((o) => deptHead(gw, seat, o) !== null);
  if (office === undefined) return null;
  const head = deptHead(gw, seat, office)!;
  const orders = ordersNow(gw, r);
  for (const pool of r.pools) {
    const fit = orders.filter((o) => o.pools.includes(pool));
    const person =
      poolPeople(gw, seat, pool).find((x) => x !== null && x !== head.id) ??
      null;
    if (fit.length === 0 || person === null) continue;
    return {
      form: "petition",
      office,
      by: head.id,
      person,
      honour: fit[0].id,
      row: r.id,
    };
  }
  return null;
}

/** Opens the chapter's honours: lists on their occasions, petitions. */
export function openHonours(gw: GreatWar, seat: GwSeatState): void {
  const rows = rowsOf(seat);
  if (rows.length === 0) return;
  const d = deptState(seat);
  const listed = () => seat.desk.some((c) => c.paper?.form === "honours");
  for (const r of rows) {
    if (listed() || !occasionNow(gw, seat, r)) continue;
    if (r.occasion === "petition") {
      const p = petitionOf(gw, seat, r);
      if (p === null) continue;
      d.honours = [...(d.honours ?? []), { row: r.id, chapter: gw.s.chapter }];
      layPaper(seat, paperCard(gw, p, p.by));
      continue;
    }
    const list = listOf(gw, seat, r);
    // Names a petition was put off for go on this list.
    for (const n of d.nextList ?? []) {
      if (!ownActive(gw, seat, n.person)) continue;
      if (list.entries.some((e) => e.person === n.person)) continue;
      list.entries.push({
        person: n.person,
        pool: "officials",
        honour: n.honour,
        from: r.from[0],
      });
      if (!list.orders.includes(n.honour)) list.orders.push(n.honour);
    }
    d.nextList = [];
    if (list.entries.length === 0) continue;
    d.honours = [...(d.honours ?? []), { row: r.id, chapter: gw.s.chapter }];
    layPaper(seat, paperCard(gw, list, null));
  }
}

/** One honoured: trust up, his rivals' down, his bloc warms (once a list). */
function honour(
  gw: GreatWar,
  seat: GwSeatState,
  person: string | null,
  order: string,
  pool: GwHonourPool,
  warmed: Set<GwBloc>,
): void {
  const bloc = POOL_BLOC[pool];
  if (!warmed.has(bloc)) {
    warmed.add(bloc);
    runEffects({ gw, seat, cast: {} }, [{ kind: "opinion", bloc, delta: 1 }]);
  }
  if (person === null) return;
  const p = gw.person(person);
  if (p === null) return;
  p.trust = clampTrust(p.trust + 1);
  seat.memory.push({
    key: `honour_${order}`,
    who: person,
    chapter: gw.s.chapter,
    weight: 1,
  });
  for (const id of rivalIds(gw, person)) {
    if (!ownActive(gw, seat, id)) continue;
    const x = gw.person(id)!;
    x.trust = clampTrust(x.trust - 1);
  }
  reasonOf(gw, seat, "honour_given", person);
}

/** A proud one left off what was given remembers it. */
function passedOver(gw: GreatWar, seat: GwSeatState, person: string): void {
  const p = gw.person(person);
  if (p === null || p.pride < GW_PROUD) return;
  p.memory.push({
    key: "honour_passed",
    who: null,
    chapter: gw.s.chapter,
    weight: -1,
  });
  reasonOf(gw, seat, "honour_passed", person);
}

/** The `honours` order: the 서훈식. */
export function holdHonours(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
  give: readonly { at: number; honour: string }[],
): GwOrderBlock | null {
  const card = paperOf(seat, uid, "honours");
  if (card === null) return "no_card";
  const p = card.paper;
  const ats = new Set<number>();
  for (const g of give) {
    if (g.at >= p.entries.length || ats.has(g.at)) return "no_honour";
    if (!p.orders.includes(g.honour)) return "no_honour";
    ats.add(g.at);
  }
  if (!spendTime(seat, GW_TIME_PRICES.honours, "acts")) return "no_slot";
  removeCard(seat, uid);
  const warmed = new Set<GwBloc>();
  for (const g of give) {
    const e = p.entries[g.at];
    honour(gw, seat, e.person, g.honour, e.pool, warmed);
  }
  p.entries.forEach((e, i) => {
    if (!ats.has(i) && e.person !== null) passedOver(gw, seat, e.person);
  });
  // The ruler seen giving them: his name, not the proposers'.
  runEffects({ gw, seat, cast: {} }, [
    { kind: "ruler", side: "reputation", delta: 1, key: "honours_held" },
  ]);
  return null;
}

/** The `petition_answer` order: 받아들인다 / 다음 명단으로 / 거절. */
export function answerPetition(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
  answer: GwPetitionAnswer,
): GwOrderBlock | null {
  const card = paperOf(seat, uid, "petition");
  if (card === null) return "no_card";
  const p = card.paper;
  removeCard(seat, uid);
  if (answer === "accept") {
    honour(gw, seat, p.person, p.honour, "generals", new Set(["army"]));
  } else if (answer === "next") {
    putOff(seat, p);
  } else {
    passedOver(gw, seat, p.person);
    const head = gw.person(p.by);
    if (head !== null && head.pride >= GW_PROUD) {
      head.trust = clampTrust(head.trust - 1);
      reasonOf(gw, seat, "petition_refused", head.id);
    }
  }
  return null;
}

function putOff(seat: GwSeatState, p: PetitionPaper): void {
  const d = deptState(seat);
  d.nextList = [...(d.nextList ?? []), { person: p.person, honour: p.honour }];
}

function proxyList(gw: GreatWar, seat: GwSeatState, c: GwCard): void {
  const p = c.paper as ListPaper;
  const warmed = new Set<GwBloc>();
  for (const e of p.entries) {
    honour(gw, seat, e.person, e.honour, e.pool, warmed);
  }
  const self = seatPerson(seat);
  if (self !== null) reasonOf(gw, seat, "honours_acted", self);
}

/**
 * Closes the chapter's honours, before the departments: a list whose
 * ceremony time is up is given as the proposers had it (대행), with nothing
 * for the ruler's name; an unanswered petition goes to the next list.
 */
export function closeHonours(gw: GreatWar, seat: GwSeatState): void {
  for (const c of [...seat.desk]) {
    const p = c.paper;
    if (p?.form === "honours" && gw.s.chapter >= p.until) {
      removeCard(seat, c.uid);
      proxyList(gw, seat, c);
    } else if (p?.form === "petition") {
      removeCard(seat, c.uid);
      putOff(seat, p);
    }
  }
}
