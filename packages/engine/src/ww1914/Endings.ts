import {
  GW_ENDINGS,
  GwEnding,
  GwMemoir,
  GwSeatState,
  GwSource,
  GwTheatre,
  GwUnknown,
  gwSecretsFor,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag, isGwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_ENDING_CODAS,
  GW_ENDING_ROWS,
} from "@openfront/engine-lib/ww1914/EndingRows";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { aimRecord } from "./Aims";
import { GW_MANDATES } from "./Mandates";
import { chaptersPlayed } from "./Peace";
import { holds } from "./SceneRun";
import { leaveWar } from "./Wars";
import { defOf, fights, seatPerson } from "./World";

const P_UNKNOWN = idHash("gw_unknown");

const GW_TURNS: readonly string[] = [
  "war_began",
  "belgium_invaded",
  "new_chief_of_staff",
  "mob_first",
  "mob_first_central",
  "mob_waited_out",
  "crisis_war",
  "crisis_compromise",
  "crisis_humiliation",
  "crisis_fizzled",
  "spark_balkan",
  "spark_straits",
  "spark_colonial",
  "era_trenches",
  "era_material",
  "era_depth",
  "era_storm",
  "uboat_unrestricted",
  "armistice_central_lost",
  "armistice_entente_lost",
  "armistice_compromise",
  "regime_republic",
  "regime_coalition",
  "regime_war_cabinet",
  "regime_national",
  "regime_karl",
  "regime_federation",
  "regime_provisional",
  "regime_crown",
  "regime_regency",
  "regime_rep",
  "regime_ff_throne",
  "regime_austria_republic",
  "regime_crown_remnant",
  "ruler_death",
  "ruler_removed",
];

const LAST_TURNS = 24;
const UNKNOWN_SHOWN = 3;

/** The seat's side is ahead by this in a closing score. */
const AHEAD_AT = 15;

/** A date past which a game that stopped was a whole war. */
const FIRST_WINTER_CHAPTERS = 12;
/** Peace held this long is the long peace: nothing more will light it. */
const LONG_PEACE_DAY = daysFromCivil(1916, 7, 1);

/** The seat's own flag: it signed for itself, it wasn't beaten. */
export const SEPARATE_PEACE = "f_separate_peace";

/** A seat's game closes alone: its country is out, or it chose the memoir. */
export function closeSeat(
  gw: GreatWar,
  seat: GwSeatState,
  ending: GwEnding,
): void {
  const s = gw.s;
  if (seat.memoir !== null) return;
  seat.memoir = memoirOf(gw, seat, ending);
  seat.desk = [];
  seat.scheduled = [];
  const n = gw.nation(seat.tag);
  if (ending === "home_collapse" && n !== null) {
    leaveWar(gw, seat.tag, "nation_collapsed");
  }
  if (s.ended === null && s.seats.every((x) => x.memoir !== null)) {
    s.ended = ending;
  }
}

/** Chapter step: a seat whose country has left the war has no more to do. */
export function endingStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.ended !== null || s.armistice !== null) return;
  for (const seat of s.seats) {
    if (seat.memoir !== null || gw.nation(seat.tag)?.out !== true) continue;
    closeSeat(
      gw,
      seat,
      gw.nation(seat.tag)?.side === null ? "deadline" : outEnding(gw, seat),
    );
  }
  // Peace past hope of war: two years on, the long peace has been had.
  if (s.ended === null && s.warChapter === null && s.day >= LONG_PEACE_DAY) {
    s.ended = "long_peace";
  }
}

/** How a country that left early left: beaten or by its own peace. */
function outEnding(gw: GreatWar, seat: GwSeatState): GwEnding {
  const n = gw.nation(seat.tag);
  if (n === null) return "deadline";
  if (seat.flags.includes(SEPARATE_PEACE)) return "compromise_peace";
  return n.unrest >= 2 ? "home_collapse" : "armistice_conference";
}

/** How the war stood for this seat when the game ran out. */
export function generalEnding(
  gw: GreatWar,
  seat: GwSeatState | null,
): GwEnding {
  const s = gw.s;
  if (s.warChapter === null) return "long_peace";
  const side = (seat === null ? null : gw.nation(seat.tag)?.side) ?? "central";
  if (s.armistice !== null) {
    if (s.armistice.kind === "compromise") return "compromise_peace";
    const lost = (s.armistice.kind === "central_lost") === (side === "central");
    return lost ? "armistice_conference" : "victory_peace";
  }
  const score = warScore(gw, side);
  if (gwChapters(s.calendar).length <= FIRST_WINTER_CHAPTERS) {
    if (score >= AHEAD_AT) return "first_winter_ahead";
    if (score <= -AHEAD_AT) return "first_winter_behind";
    return "first_winter_level";
  }
  if (score >= AHEAD_AT * 2) return "victory_peace";
  return score <= -AHEAD_AT * 2 ? "armistice_conference" : "deadline";
}

/** Past the last chapter, whatever stands. */
export function finalEnding(gw: GreatWar): GwEnding {
  return generalEnding(gw, gw.s.seats[0] ?? null);
}

/** What the general ending was for this country (engine-lib EndingRows). */
export function ownEnding(
  gw: GreatWar,
  seat: GwSeatState,
  general: GwEnding,
): string {
  for (const row of GW_ENDING_ROWS[seat.tag] ?? []) {
    if (!row.of.includes(general)) continue;
    if (row.when === undefined || holds({ gw, seat, cast: {} }, row.when)) {
      return row.id;
    }
  }
  return general;
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
  for (const id of gwSecretsFor(seat.tag)) {
    // The Mexico wire is a thing of the war: no war, no wire.
    if (id === "deu_zimmermann_wire" && s.warChapter === null) continue;
    if (s.secrets.includes(id) && !seat.known.includes(id))
      add("secret", id, 1);
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
    if (src.id === OWN_EMBASSY[seat.tag]) continue;
    const mine = s.reports.some(
      (r) => r.smallID === seat.smallID && r.source === src.id,
    );
    if (mine && src.right + src.wrong < 3) add("source", src.id, src.band);
  }
  for (const p of s.people) {
    const d = defOf(p.id);
    if (d === null || d.tag !== seat.tag || d.fit.length === 0) continue;
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

/** Nobody keeps an embassy in their own capital. */
const OWN_EMBASSY: Partial<Record<GwTag, GwSource>> = {
  AUH: "embassy_vienna",
  DEU: "embassy_berlin",
  FRA: "embassy_paris",
  GBR: "embassy_london",
  ITA: "embassy_rome",
  RUS: "embassy_petersburg",
};

/** World turns have text (gw.turn.<key>); a scene's own memories don't. */
function turnOf(key: string): { key: string; tag: GwTag | null } | null {
  const m = /^(entered|out)_([a-z]+)$/.exec(key);
  if (m !== null) {
    const tag = m[2].toUpperCase();
    return isGwTag(tag) ? { key: m[1], tag } : null;
  }
  if (key.startsWith("gov_held_")) return { key, tag: null };
  // A form of government is someone's: the memoir says whose.
  const [base, whose] = key.split("@");
  if (!GW_TURNS.includes(base)) return null;
  return {
    key: base,
    tag: whose !== undefined && isGwTag(whose) ? whose : null,
  };
}

export function memoirOf(
  gw: GreatWar,
  seat: GwSeatState,
  general?: GwEnding,
): GwMemoir {
  const s = gw.s;
  const self = seatPerson(seat);
  const ownDefs = gwContent().people.filter(
    (d) => d.tag === seat.tag && d.id !== self,
  );
  const people = ownDefs.flatMap((d) => {
    const p = gw.person(d.id);
    if (p === null || p.status === "waiting") return [];
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
  const ending = ownEnding(gw, seat, general ?? generalOf(gw, seat));
  const coda = (GW_ENDING_CODAS[seat.tag] ?? []).find((c) =>
    holds({ gw, seat, cast: {} }, c.when),
  );
  return {
    ending,
    coda: coda?.id ?? null,
    chapter: chaptersPlayed(gw) - 1,
    day: s.day,
    mandates,
    aim: aimRecord(gw, seat),
    casualties: gw.nation(seat.tag)?.casualties ?? 0,
    fronts: s.theatres
      .filter((t) => t.since !== null)
      .map((t) => ({ theatre: t.id, line: t.line })),
    turns: seat.memory
      .flatMap((m) => {
        const t = m.who === null ? turnOf(m.key) : null;
        return t === null ? [] : [{ ...t, chapter: m.chapter }];
      })
      .slice(-LAST_TURNS),
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

/** The world's word for this seat, unless a scene ended the game its own way. */
function generalOf(gw: GreatWar, seat: GwSeatState): GwEnding {
  const ended = gw.s.ended;
  if (ended === null) return "closing";
  const known = (GW_ENDINGS as readonly string[]).includes(ended);
  if (!known) return ended as GwEnding;
  return gw.s.seats.length > 1 ? generalEnding(gw, seat) : (ended as GwEnding);
}

/** Runs once when `s.ended` is set, whoever set it. */
export function closeGame(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    seat.memoir ??= memoirOf(gw, seat);
  }
  gw.s.deadlineTick = null;
}
