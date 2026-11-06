import {
  GW_SECRETS,
  GwEnding,
  GwMemoir,
  GwSeatState,
  GwTheatre,
  GwUnknown,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { GW_MANDATES } from "./Mandates";
import { holds } from "./SceneRun";
import { defOf, fights } from "./World";

const P_UNKNOWN = idHash("gw_unknown");

const LAST_TURNS = 24;
const UNKNOWN_SHOWN = 3;

/** The seat's side is ahead by this in a closing score. */
const AHEAD_AT = 15;

/** A date past which a game that stopped was a whole war. */
const FIRST_WINTER_CHAPTERS = 12;

function enemiesBeaten(gw: GreatWar, seat: GwSeatState): boolean {
  const n = gw.nation(seat.tag);
  if (n === null || n.side === null) return false;
  const majors: GwTag[] =
    n.side === "central" ? ["FRA", "RUS"] : ["DEU", "AUH"];
  return majors.every((t) => gw.nation(t)?.out === true);
}

/** Chapter step: a country falls, or the other side has. */
export function endingStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.ended !== null) return;
  for (const seat of s.seats) {
    const n = gw.nation(seat.tag);
    if (n !== null && n.unrest >= 4) {
      s.ended = "home_collapse";
      return;
    }
    if (enemiesBeaten(gw, seat)) {
      s.ended = "victory_peace";
      return;
    }
  }
}

/** Past the last chapter, whatever stands. */
export function finalEnding(gw: GreatWar): GwEnding {
  const s = gw.s;
  if (s.warChapter === null) return "long_peace";
  const seat = s.seats[0];
  const side = seat === undefined ? "central" : gw.nation(seat.tag)?.side;
  const score = warScore(gw, side ?? "central");
  if (gwChapters(s.calendar).length <= FIRST_WINTER_CHAPTERS) {
    if (score >= AHEAD_AT) return "first_winter_ahead";
    if (score <= -AHEAD_AT) return "first_winter_behind";
    return "first_winter_level";
  }
  return Math.abs(score) >= AHEAD_AT * 2 ? "armistice_conference" : "deadline";
}

function mandateMet(gw: GreatWar, seat: GwSeatState, id: string): boolean {
  const m = (GW_MANDATES[seat.tag] ?? []).find((x) => x.id === id);
  return m !== undefined && holds({ gw, seat, cast: {} }, m.met);
}

/** Everything the seat could have learned and didn't, the likeliest first. */
function unknownsOf(gw: GreatWar, seat: GwSeatState): GwUnknown[] {
  const s = gw.s;
  const out: GwUnknown[] = [];
  const add = (
    kind: GwUnknown["kind"],
    id: string,
    value: number,
    word: string | null = null,
    theatre: GwTheatre | null = null,
  ) => out.push({ kind, id, theatre, value, word });
  for (const id of GW_SECRETS) {
    if (s.secrets.includes(id) && !seat.known.includes(id)) add("secret", id, 1);
  }
  const told = (fact: string, tag: GwTag) =>
    s.reports.some(
      (r) =>
        r.smallID === seat.smallID &&
        r.fact === fact &&
        r.tag === tag &&
        r.stamp === "confirmed",
    );
  for (const tag of ["GBR", "ITA", "OTT"] as const) {
    const n = gw.nation(tag);
    if (n !== null && !told("lean", tag)) add("lean", tag, n.lean + 1);
  }
  for (const r of s.reports) {
    if (r.smallID !== seat.smallID || r.claim === r.truth) continue;
    if (r.checkDay !== null) {
      add("wrong_report", r.tag, r.truth, r.fact, r.theatre);
    }
  }
  for (const src of s.sources) {
    if (src.right + src.wrong < 3) add("source", src.id, src.band);
  }
  for (const p of s.people) {
    const d = defOf(p.id);
    if (d === null || d.tag !== seat.tag) continue;
    if (p.wins + p.losses >= 3) continue;
    const best = Math.max(...p.competence);
    const worst = Math.min(...p.competence);
    if (best === 3 || worst === 1) {
      add("person", p.id, best === 3 ? best : worst);
    }
  }
  for (const tag of ["GBR", "RUS", "ITA", "FRA", "AUH"] as const) {
    const n = gw.nation(tag);
    if (n !== null && tag !== seat.tag) add("ai", tag, 0, n.ai);
  }
  const side = gw.nation(seat.tag)?.side ?? null;
  for (const t of s.theatres) {
    const foe = t.attacker === seat.tag ? t.defender : t.attacker;
    const n = foe === null ? null : gw.nation(foe);
    if (n === null || side === null || !fights(n)) continue;
    const band = n.strength[t.id] ?? 1;
    if (band >= 4) add("force", n.tag, band, null, t.id);
  }
  return out;
}

const RANK: Readonly<Record<GwUnknown["kind"], number>> = {
  wrong_report: 0,
  secret: 1,
  lean: 2,
  person: 3,
  source: 4,
  force: 5,
  ai: 6,
};

/** The closing page: one of each of the best kinds, the seed picks among them. */
function pickUnknowns(gw: GreatWar, seat: GwSeatState): GwUnknown[] {
  const all = unknownsOf(gw, seat);
  const out: GwUnknown[] = [];
  const kinds = [...new Set(all.map((x) => x.kind))].sort(
    (a, b) => RANK[a] - RANK[b],
  );
  for (const k of kinds) {
    if (out.length >= UNKNOWN_SHOWN) break;
    const of = all.filter((x) => x.kind === k);
    out.push(of[wwRoll(gw.s.seed, P_UNKNOWN, RANK[k]) % of.length]);
  }
  return out;
}

export function memoirOf(gw: GreatWar, seat: GwSeatState): GwMemoir {
  const s = gw.s;
  const ownDefs = gwContent().people.filter((d) => d.tag === seat.tag);
  const people = ownDefs.flatMap((d) => {
    const p = gw.person(d.id);
    if (p === null) return [];
    return [
      {
        id: p.id,
        office: p.office,
        status: p.status,
        trust: p.trust,
        wins: p.wins,
        losses: p.losses,
      },
    ];
  });
  const mandates = seat.mandates.map((id) => ({
    id,
    met: mandateMet(gw, seat, id),
  }));
  const ending = s.ended ?? "closing";
  return {
    ending,
    chapter: s.chapter,
    day: s.day,
    mandates,
    casualties: gw.nation(seat.tag)?.casualties ?? 0,
    fronts: s.theatres
      .filter((t) => t.since !== null)
      .map((t) => ({ theatre: t.id, line: t.line })),
    turns: seat.memory
      .filter((m) => m.who === null)
      .slice(-LAST_TURNS)
      .map((m) => ({ key: m.key, chapter: m.chapter })),
    people,
    unknown: pickUnknowns(gw, seat),
    shelf: {
      ending,
      people: people.filter((p) => p.office !== null).map((p) => p.id),
      secrets: seat.known,
      mandates: mandates.filter((m) => m.met).map((m) => m.id),
    },
  };
}

/** Runs once when `s.ended` is set, whoever set it. */
export function closeGame(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.memoir === null) seat.memoir = memoirOf(gw, seat);
  }
  gw.s.deadlineTick = null;
}
