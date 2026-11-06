import {
  GW_OFFICES,
  GW_TRUST_MAX,
  GW_TRUST_MIN,
  GwOffice,
  GwPersonState,
  GwSeatState,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./SceneRun";
import { clampTo, defOf, ownPeople, reason, turn } from "./World";

const P_HEALTH_FAIL = idHash("gw_health_fail");
const P_RIVAL = idHash("gw_rival");

/** The chapters a letter stands before the writer goes on their own. */
const LETTER_STANDS = 3;
/** The chapters between the first signs and the end of a career. */
const AILING_FOR = 2;
/** Design §6: a dismissal costs authority 25 + fame x 2. */
const DISMISS_BASE = 25;
const DISMISS_PER_FAME = 2;

export function officeHolder(
  gw: GreatWar,
  seat: GwSeatState,
  o: GwOffice,
): GwPersonState | null {
  return holderOf(gw, seat, o);
}

function trustBy(p: GwPersonState, delta: number): void {
  p.trust = clampTo(p.trust + delta, GW_TRUST_MIN, GW_TRUST_MAX);
}

/** A result in someone's field: the only way the seat learns what they're worth. */
export function recordResult(gw: GreatWar, id: string, won: boolean): void {
  const p = gw.person(id);
  if (p === null) return;
  if (won) p.wins++;
  else p.losses++;
}

/** The authority a dismissal costs. */
export function dismissPrice(id: string): number {
  return DISMISS_BASE + (defOf(id)?.fame ?? 1) * DISMISS_PER_FAME;
}

/** Rivals rise when someone falls, friends sink; the camp remembers. */
function ripple(gw: GreatWar, id: string, rise: boolean): void {
  const def = defOf(id);
  if (def === null) return;
  for (const r of def.rivals) {
    const p = gw.person(r);
    if (p !== null) trustBy(p, rise ? -1 : 1);
  }
  for (const a of def.allies) {
    const p = gw.person(a);
    if (p !== null) trustBy(p, rise ? 1 : -1);
  }
}

/** Someone was put in an office. */
export function onAppointed(gw: GreatWar, id: string): void {
  ripple(gw, id, true);
  const p = gw.person(id);
  if (p !== null) {
    trustBy(p, 1);
    p.letter = null;
    p.memory.push({
      key: "appointed",
      who: null,
      chapter: gw.s.chapter,
      weight: 1,
    });
  }
}

/** Removal by the head of state: the price is paid by the caller's check. */
export function dismissPerson(
  gw: GreatWar,
  seat: GwSeatState,
  p: GwPersonState,
): void {
  const n = gw.nation(seat.tag);
  if (n !== null) {
    n.authority = Math.max(0, n.authority - dismissPrice(p.id));
    if (n.inst.army !== undefined && defOf(p.id)?.camps.includes("military")) {
      n.inst.army = clampTo(n.inst.army - 1, -5, 5);
    }
  }
  const held = p.office;
  p.office = null;
  p.letter = null;
  trustBy(p, -2);
  p.memory.push({
    key: "dismissed",
    who: null,
    chapter: gw.s.chapter,
    weight: -3,
  });
  seat.memory.push({
    key: `dismissed_${held ?? "none"}`,
    who: p.id,
    chapter: gw.s.chapter,
    weight: -3,
  });
  ripple(gw, p.id, false);
}

/** They go on their own: no price, no office. */
export function personLeaves(
  gw: GreatWar,
  seat: GwSeatState,
  p: GwPersonState,
  key: string,
): void {
  p.office = null;
  p.letter = null;
  p.ailing = null;
  p.status = "fallen";
  for (const t of gw.s.theatres) if (t.commander === p.id) t.commander = null;
  seat.memory.push({ key, who: p.id, chapter: gw.s.chapter, weight: 0 });
  reason(gw, seat, key);
}

/** A resignation letter: the warning that always comes first. */
export function openLetter(
  gw: GreatWar,
  seat: GwSeatState,
  p: GwPersonState,
): void {
  if (p.letter !== null || p.office === null) return;
  p.letter = gw.s.chapter;
  seat.subjects.gw_letter = p.id;
  seat.scheduled.push({ scene: "gw_letter", chapter: gw.s.chapter + 1 });
  reason(gw, seat, "letter_came");
}

/** The letter is refused: they stay, once, for a price in trust. */
export function keepPerson(p: GwPersonState): void {
  p.letter = null;
  trustBy(p, 2);
  p.pride = Math.max(0, p.pride - 1);
}

/** Up to two people for an office, of different camps where there are. */
export function candidatesFor(
  gw: GreatWar,
  seat: GwSeatState,
  o: GwOffice,
): string[] {
  const free = ownPeople(gw, seat.tag)
    .filter(
      (p) =>
        p.office === null &&
        p.ailing === null &&
        defOf(p.id)?.fit.includes(o) === true,
    )
    .sort((a, b) => b.trust - a.trust || (a.id < b.id ? -1 : 1));
  const first = free[0];
  if (first === undefined) return [];
  const camps = defOf(first.id)?.camps ?? [];
  const second =
    free.find(
      (p) =>
        p !== first &&
        (defOf(p.id)?.camps ?? []).some((c) => !camps.includes(c)),
    ) ?? free[1];
  return second === undefined ? [first.id] : [first.id, second.id];
}

/** Who leads an army in a theatre: a soldier with no desk, the best known. */
export function armyCommander(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwTheatre,
): string | null {
  if (t === "sea") {
    const admiral = holderOf(gw, seat, "navy");
    if (admiral !== null) return admiral.id;
  }
  const soldiers = ownPeople(gw, seat.tag).filter((p) => {
    const d = defOf(p.id);
    return d?.camps.includes("military") === true && p.office === null;
  });
  const taken = new Set(gw.s.theatres.map((x) => x.commander));
  const pool = soldiers.filter((p) => !taken.has(p.id));
  const side = t === "east" ? "east" : "west";
  const pick = pool.sort(
    (a, b) =>
      Number(defOf(b.id)?.camps.includes(side)) -
        Number(defOf(a.id)?.camps.includes(side)) ||
      (defOf(b.id)?.fame ?? 0) - (defOf(a.id)?.fame ?? 0) ||
      (a.id < b.id ? -1 : 1),
  )[0];
  return pick?.id ?? holderOf(gw, seat, "chief_of_staff")?.id ?? null;
}

function fade(gw: GreatWar, p: GwPersonState): void {
  if (gw.s.chapter % 4 !== 3) return;
  for (const m of p.memory) {
    if (m.weight > 0) m.weight--;
    else if (m.weight < 0) m.weight++;
  }
  p.memory = p.memory.filter(
    (m) => m.weight !== 0 || gw.s.chapter - m.chapter < 12,
  );
}

function health(gw: GreatWar, seat: GwSeatState, p: GwPersonState): void {
  const s = gw.s;
  if (p.ailing !== null) {
    if (s.chapter - p.ailing >= AILING_FOR)
      personLeaves(gw, seat, p, "fell_ill");
    return;
  }
  if (p.health !== 1 || p.office === null || s.warChapter === null) return;
  const i = s.people.indexOf(p);
  const strain = p.office === "chief_of_staff" ? 12 : 4;
  if (wwRoll(s.seed, P_HEALTH_FAIL, s.chapter, i) % 100 < strain) {
    p.ailing = s.chapter;
    seat.subjects.gw_ailing = p.id;
    seat.scheduled.push({ scene: "gw_ailing", chapter: s.chapter + 1 });
    seat.memory.push({
      key: "fell_ailing",
      who: p.id,
      chapter: s.chapter,
      weight: 0,
    });
    reason(gw, seat, "person_ailing");
  }
}

/** The people around someone in favour take it badly, some of the time. */
function rivalry(gw: GreatWar, seat: GwSeatState, p: GwPersonState): void {
  const s = gw.s;
  if (p.trust < 2 || p.office === null) return;
  const i = s.people.indexOf(p);
  for (const r of defOf(p.id)?.rivals ?? []) {
    const q = gw.person(r);
    if (q === null || q.status !== "active" || q.office === null) continue;
    if (wwRoll(s.seed, P_RIVAL, s.chapter, i) % 4 === 0) {
      trustBy(q, -1);
      reason(gw, seat, "rival_resents");
    }
  }
}

/** An empty office is filled at the chapter's close; the seat could have. */
function succeed(gw: GreatWar, seat: GwSeatState): void {
  const wanted = GW_OFFICES.filter((o) =>
    gwContent().people.some((d) => d.tag === seat.tag && d.office === o),
  );
  for (const o of wanted) {
    if (holderOf(gw, seat, o) !== null) continue;
    const next = candidatesFor(gw, seat, o)[0];
    const p = next === undefined ? null : gw.person(next);
    if (p === null) continue;
    p.office = o;
    onAppointed(gw, p.id);
    seat.memory.push({
      key: `succeeded_${o}`,
      who: p.id,
      chapter: gw.s.chapter,
      weight: 0,
    });
    reason(gw, seat, "successor_named");
    if (o === "chief_of_staff") turn(gw, "new_chief_of_staff");
  }
}

/** Chapter step: letters, health, envy, succession. */
export function peopleStep(gw: GreatWar): void {
  const s = gw.s;
  for (const seat of s.seats) {
    const own = ownPeople(gw, seat.tag);
    for (const p of own) {
      fade(gw, p);
      health(gw, seat, p);
      rivalry(gw, seat, p);
      if (p.letter !== null && s.chapter - p.letter >= LETTER_STANDS) {
        personLeaves(gw, seat, p, "resigned");
      }
    }
    // One letter a chapter: the sorest of those proud enough to write it.
    const writer = own
      .filter(
        (p) =>
          p.office !== null &&
          p.letter === null &&
          p.trust <= -2 &&
          p.pride >= 3,
      )
      .sort((a, b) => a.trust - b.trust || (a.id < b.id ? -1 : 1))[0];
    if (writer !== undefined && !own.some((p) => p.letter !== null)) {
      openLetter(gw, seat, writer);
    }
    succeed(gw, seat);
  }
}
