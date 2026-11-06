import {
  GwInstitution,
  GwIssue,
  GwNationState,
  GwSeatState,
  GW_INST_MAX,
  GW_INST_MIN,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_AUTHORITY,
  GW_ISSUE_TABLE,
  GwAuthorityRow,
  GwInstRule,
} from "./AuthorityTable";
import type { GreatWar } from "./GreatWar";
import { openLetter } from "./People";
import { holds } from "./SceneRun";
import {
  clampTo,
  defOf,
  everyMonths,
  moveGauge,
  ownPeople,
  reason,
  seatsOf,
} from "./World";

/** Authority back each chapter. */
const AUTHORITY_BACK = 4;

export function authorityRow(n: GwNationState): GwAuthorityRow {
  return GW_AUTHORITY[n.regime] ?? GW_AUTHORITY[""];
}

function shift(
  gw: GreatWar,
  n: GwNationState,
  inst: GwInstitution,
  delta: number,
  key: string,
): void {
  const v = n.inst[inst];
  if (v === undefined) return;
  n.inst[inst] = clampTo(v + delta, GW_INST_MIN, GW_INST_MAX);
  for (const seat of seatsOf(gw, n.tag)) reason(gw, seat, key);
}

const known = (scene: string) => gwContent().scenes.some((x) => x.id === scene);

function waiting(seat: GwSeatState, scene: string): boolean {
  return seat.scheduled.some((q) => q.scene === scene);
}

function runCall(
  gw: GreatWar,
  n: GwNationState,
  r: Extract<GwInstRule, { rule: "call" }>,
): void {
  const s = gw.s;
  if (!known(r.scene)) return;
  const first =
    r.first === true &&
    s.warChapter !== null &&
    s.chapter - s.warChapter === 1;
  const due =
    r.every === undefined ? true : everyMonths(gw, r.every, r.offset ?? 0);
  if (!first && !due) return;
  for (const seat of seatsOf(gw, n.tag)) {
    if (r.once === true && seat.seen[r.scene] !== undefined) continue;
    if (waiting(seat, r.scene)) continue;
    if (r.when !== undefined && !holds({ gw, seat, cast: {} }, r.when)) continue;
    seat.scheduled.push({ scene: r.scene, chapter: s.chapter + 1 });
  }
}

function lostFront(gw: GreatWar, n: GwNationState): boolean {
  const s = gw.s;
  return s.battles.some((b) => {
    if (b.chapter !== s.chapter || b.by === null || n.side === null) return false;
    const won = b.result === "advance" || b.result === "break";
    const t = s.theatres.find((x) => x.id === b.theatre)!;
    const mine = t.attacker === n.tag || t.defender === n.tag;
    return mine && won && b.by !== n.side;
  });
}

function runRule(gw: GreatWar, n: GwNationState, r: GwInstRule): void {
  switch (r.rule) {
    case "drift": {
      const flags = seatsOf(gw, n.tag)[0]?.flags ?? [];
      if (r.flag !== undefined && !flags.includes(r.flag)) return;
      if (r.unless !== undefined && flags.includes(r.unless)) return;
      if (everyMonths(gw, r.every, r.offset ?? 0)) {
        shift(gw, n, r.inst, r.delta, r.key);
      }
      return;
    }
    case "tracks":
      for (const seat of seatsOf(gw, n.tag)) tracks(gw, n, seat, r);
      return;
    case "low_order":
      if (n.gauges.order <= r.at) shift(gw, n, r.inst, r.delta, r.key);
      return;
    case "lost_front":
      if (lostFront(gw, n)) shift(gw, n, r.inst, r.delta, r.key);
      return;
    case "wear":
      if (
        (n.inst[r.inst] ?? 0) <= r.max &&
        n.gauges.morale <= r.morale &&
        !gw.s.secrets.includes(r.unless) &&
        everyMonths(gw, 2)
      ) {
        n.wear[r.theatre] = (n.wear[r.theatre] ?? 0) + 1;
        for (const seat of seatsOf(gw, n.tag)) reason(gw, seat, r.key);
      }
      return;
    case "levy":
      if ((n.inst[r.inst] ?? 0) <= r.max && everyMonths(gw, r.every)) {
        moveGauge(gw, n.tag, r.gauge, r.delta, r.key);
      }
      return;
    case "call":
      runCall(gw, n, r);
      return;
  }
}

function tracks(
  gw: GreatWar,
  n: GwNationState,
  seat: GwSeatState,
  r: Extract<GwInstRule, { rule: "tracks" }>,
): void {
  const p = gw.s.people.find(
    (x) =>
      x.office === r.office &&
      x.status === "active" &&
      defOf(x.id)?.tag === seat.tag,
  );
  const v = n.inst[r.inst];
  if (p === undefined || v === undefined) return;
  if (v !== p.trust) n.inst[r.inst] = v + (v < p.trust ? 1 : -1);
  // A chancellor who won't sign any more says so in writing.
  if ((n.inst[r.inst] ?? 0) <= r.letterAt && p.letter === null) {
    reason(gw, seat, r.key);
    openLetter(gw, seat, p);
  }
}

/** Chapter step, with the home front: every body has its turn. */
export function authorityStep(gw: GreatWar, n: GwNationState): void {
  n.authority = clampTo(n.authority + AUTHORITY_BACK, 0, 100);
  for (const r of authorityRow(n).rules) runRule(gw, n, r);
}

/** Why a body shuts this paper, or null. Text: gw.plan_why.<why>. */
export function paperClosed(
  gw: GreatWar,
  n: GwNationState,
  kind: "attack" | "other" | "hold" | "ally",
  scale: "limited" | "major",
): string | null {
  for (const bar of authorityRow(n).papers) {
    if (bar.unlessCommand === true && n.command) continue;
    const v = n.inst[bar.inst];
    if (v === undefined) continue;
    if (bar.min !== undefined && v < bar.min) continue;
    if (bar.max !== undefined && v > bar.max) continue;
    const hit = bar.closes.some(
      (c) => c === kind || (c === "major" && scale === "major"),
    );
    if (hit) return bar.why;
  }
  return null;
}

/** What a dismissal does to the bodies of this form of government. */
export function dismissalFallout(
  n: GwNationState,
  camps: readonly string[],
): void {
  for (const d of authorityRow(n).dismiss) {
    if (d.camp !== "any" && !camps.includes(d.camp)) continue;
    const v = n.inst[d.inst];
    if (v === undefined) continue;
    n.inst[d.inst] = clampTo(v + d.delta, GW_INST_MIN, GW_INST_MAX);
  }
}

/** Those who sit at the table: anyone with an office at home. */
function cabinetOf(gw: GreatWar, seat: GwSeatState) {
  return ownPeople(gw, seat.tag).filter(
    (p) => p.office !== null && !p.office.startsWith("ambassador"),
  );
}

/** One person's voice on an issue: camp first, then what they owe the seat. */
function voice(
  gw: GreatWar,
  issue: GwIssue,
  id: string,
  seat: GwSeatState,
): number {
  const table = GW_ISSUE_TABLE[issue];
  const p = gw.person(id)!;
  let out = 0;
  for (const c of defOf(id)?.camps ?? []) out += table[c] ?? 0;
  out += p.trust;
  // What was said to them about it: a scene's `v_<issue>` memory.
  for (const m of p.memory) if (m.key === `v_${issue}`) out += m.weight;
  for (const m of seat.memory) {
    if (m.key === `v_${issue}` && m.who === id) out += m.weight === 0 ? 1 : m.weight;
  }
  if (p.temperament === "stubborn" && out !== 0) out += out > 0 ? 1 : -1;
  return out;
}

/** Ayes less noes if the cabinet voted now; a tie goes to the seat. */
export function voteCount(
  gw: GreatWar,
  seat: GwSeatState,
  issue: GwIssue,
): number {
  let out = 0;
  for (const p of cabinetOf(gw, seat)) {
    out += voice(gw, issue, p.id, seat) >= 0 ? 1 : -1;
  }
  return out;
}

/**
 * The cabinet votes. Carried or not goes on the record as a flag; those voted
 * down remember, and the sorest and proudest of them may write.
 */
export function holdVote(gw: GreatWar, seat: GwSeatState, issue: GwIssue): void {
  const margin = voteCount(gw, seat, issue);
  const table = cabinetOf(gw, seat).length;
  const carried = margin >= 0;
  seat.votes.push({
    issue,
    ayes: (table + margin) >> 1,
    noes: (table - margin) >> 1,
    chapter: gw.s.chapter,
  });
  const yes = `carried_${issue}`;
  seat.flags = seat.flags.filter((f) => f !== yes);
  if (carried) seat.flags.push(yes);
  const n = gw.nation(seat.tag);
  if (n?.inst.cabinet !== undefined) {
    n.inst.cabinet = clampTo(
      n.inst.cabinet + (carried ? 1 : -1),
      GW_INST_MIN,
      GW_INST_MAX,
    );
  }
  reason(gw, seat, carried ? "vote_carried" : "vote_lost");
  for (const p of cabinetOf(gw, seat)) {
    const against = voice(gw, issue, p.id, seat) < 0;
    if (against === carried) {
      p.memory.push({
        key: `vote_${issue}`,
        who: null,
        chapter: gw.s.chapter,
        weight: -1,
      });
      if (carried) p.trust = Math.max(-3, p.trust - 1);
    }
  }
}
