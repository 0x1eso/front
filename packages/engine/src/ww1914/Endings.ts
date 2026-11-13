import {
  GW_ENDINGS,
  GwEnding,
  GwMemoir,
  GwSeatState,
  gwSecretsFor,
  GwSource,
  GwTheatre,
  GwUnknown,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag, isGwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
} from "@openfront/engine-api/ww1914/GwPlaces";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_ENDING_CODAS,
  GW_ENDING_ROWS,
  GW_LAND_CODAS,
  GW_STATE_ENDINGS,
} from "@openfront/engine-lib/ww1914/EndingRows";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { playingOn, waitsToPlayOn } from "./Aftermath";
import { aimRecord } from "./Aims";
import { memoirDiary } from "./Diary";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./Land";
import { GW_MANDATES } from "./Mandates";
import { beatenAt, capitalHolder } from "./Occupation";
import { chaptersPlayed } from "./Peace";
import { holds } from "./SceneRun";
import { closeTable, mapRecord } from "./Table";
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
  "regime_deu_parl",
  "regime_deu_soviet",
  "regime_gbr_labour",
  "regime_auh_federal_crown",
  "regime_auh_trial",
  "regime_rus_soviet",
  "regime_fra_crown",
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

/** Places of beaten countries held at the end that make an occupation held. */
const OCCUPIED_HELD = 4;

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
  if (s.seats.length > 1 && s.seats.every((x) => gw.nation(x.tag)?.out)) {
    s.ended = "home_collapse";
  }
}

/** Chapter step: a seat whose country has left the war has no more to do. */
export function endingStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.ended !== null || s.armistice !== null) return;
  for (const seat of s.seats) {
    if (seat.memoir !== null || gw.nation(seat.tag)?.out !== true) continue;
    // ww190: after its own peace a seat may play on (Aftermath.ts).
    if (waitsToPlayOn(gw, seat)) continue;
    closeSeat(gw, seat, outEnding(gw, seat));
  }
  // Peace past hope of war: two years on, the long peace has been had.
  if (s.ended === null && s.warChapter === null && s.day >= LONG_PEACE_DAY) {
    s.ended = "long_peace";
  }
}

/**
 * How a country that left early left: by its own peace (a separate one, or
 * a peace of two that left it nothing to fight), beaten in a war of its own,
 * or beaten with its coalition's war going on.
 */
export function outEnding(gw: GreatWar, seat: GwSeatState): GwEnding {
  const n = gw.nation(seat.tag);
  if (n === null) return "deadline";
  if (seat.flags.includes(SEPARATE_PEACE)) return "separate_peace";
  if (n.side === null) return "pair_war_lost";
  if (beatenAt(gw, seat.tag) === null) return "separate_peace";
  return n.unrest >= 2 ? "home_collapse" : "armistice_conference";
}

/** The seat's wars, the last to end last; live ones count as not ended. */
function warsOf(gw: GreatWar, tag: GwTag) {
  return gw.s.wars
    .filter((w) => w.a === tag || w.b === tag)
    .sort((x, y) => (x.ended ?? 1e9) - (y.ended ?? 1e9));
}

/**
 * A country outside the coalitions that fought wars of its own (ww172): the
 * war goes on, or how the last one ended. Null: none of that.
 */
function ownWarEnding(gw: GreatWar, tag: GwTag): GwEnding | null {
  const n = gw.nation(tag);
  if (n === null || n.side !== null) return null;
  const wars = warsOf(gw, tag);
  const last = wars[wars.length - 1];
  if (last === undefined) return null;
  if (n.out) return "pair_war_lost";
  if (last.ended === null) return "deadline";
  if (last.won === undefined) return "compromise_peace";
  return last.won === tag ? "pair_war_won" : "pair_war_lost";
}

/** Beaten countries' places `tag` holds, by owner, most first. */
function occupiedBy(gw: GreatWar, tag: GwTag): [GwTag, number][] {
  const count = new Map<GwTag, number>();
  for (const p of GW_PLACE_KEYS) {
    const owner = GW_PLACES[p].owner;
    if (holderOf(gw, p) !== tag || owner === tag) continue;
    if (beatenAt(gw, owner) === null && GW_CAPITALS[owner] !== p) continue;
    count.set(owner, (count.get(owner) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

/** The war goes on with land held: its own capital lost, or another's land held. */
function occupationEnding(gw: GreatWar, tag: GwTag): GwEnding | null {
  if (capitalHolder(gw, tag) !== null) return "under_occupation";
  const held = occupiedBy(gw, tag);
  const capital = held.some(([owner]) => {
    const cap = GW_CAPITALS[owner];
    return cap !== undefined && holderOf(gw, cap) === tag;
  });
  if (capital || (held[0]?.[1] ?? 0) >= OCCUPIED_HELD) return "occupation_held";
  return null;
}

/** How the war stood for this seat when the game ran out. */
export function generalEnding(
  gw: GreatWar,
  seat: GwSeatState | null,
): GwEnding {
  const s = gw.s;
  const own = seat === null ? null : ownWarEnding(gw, seat.tag);
  if (s.warChapter === null) return own ?? "long_peace";
  const side = (seat === null ? null : gw.nation(seat.tag)?.side) ?? "central";
  if (s.armistice !== null) {
    if (s.armistice.kind === "compromise") return "compromise_peace";
    const lost = (s.armistice.kind === "central_lost") === (side === "central");
    return lost ? "armistice_conference" : "victory_peace";
  }
  if (own !== null) return own;
  if (seat !== null && gw.nation(seat.tag)?.out === true) {
    return outEnding(gw, seat);
  }
  const score = warScore(gw, side);
  if (gwChapters(s.calendar).length <= FIRST_WINTER_CHAPTERS) {
    if (score >= AHEAD_AT) return "first_winter_ahead";
    if (score <= -AHEAD_AT) return "first_winter_behind";
    return "first_winter_level";
  }
  if (score >= AHEAD_AT * 2) return "victory_peace";
  if (score <= -AHEAD_AT * 2) return "armistice_conference";
  const held = seat === null ? null : occupationEnding(gw, seat.tag);
  return held ?? "deadline";
}

/**
 * Why the general ending came, for the memoir's line under its title
 * (gw.ending_why.<key>, {country}); null for an ending a scene chose.
 */
function whyOf(
  gw: GreatWar,
  seat: GwSeatState,
  general: GwEnding,
): { key: string; tag: GwTag | null } | null {
  // The world's endings, not a scene's or a country's own.
  const known = [...GW_ENDINGS.slice(1, 10), ...GW_STATE_ENDINGS];
  if (!known.includes(general)) return null;
  const last = warsOf(gw, seat.tag)
    .filter((w) => w.ended !== null)
    .pop();
  const foe = last === undefined ? null : last.a === seat.tag ? last.b : last.a;
  switch (general) {
    case "separate_peace":
    case "pair_war_won":
    case "pair_war_lost":
      return { key: general, tag: foe };
    case "under_occupation":
      return { key: general, tag: capitalHolder(gw, seat.tag) };
    case "occupation_held":
      return { key: general, tag: occupiedBy(gw, seat.tag)[0]?.[0] ?? null };
    default:
      return { key: general, tag: null };
  }
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
  const m =
    /^(entered|out|pair_war_began|pair_peace_made|pair_table_signed)_([a-z]+)$/.exec(
      key,
    );
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
  const why = general ?? generalOf(gw, seat);
  const ending = ownEnding(gw, seat, why);
  const ctx = { gw, seat, cast: {} };
  const coda =
    (GW_ENDING_CODAS[seat.tag] ?? []).find((c) => holds(ctx, c.when)) ??
    GW_LAND_CODAS.find((c) => holds(ctx, c.when));
  const rival = seat.story.rival;
  return {
    ending,
    coda: coda?.id ?? null,
    why: whyOf(gw, seat, why),
    rival:
      rival.who === null
        ? null
        : {
            who: rival.who,
            stage: rival.stage,
            act: rival.act,
            end: rival.end,
          },
    chapter: chaptersPlayed(gw) - 1,
    day: s.day,
    mandates,
    aim: aimRecord(gw, seat),
    map: mapRecord(gw, seat),
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
    diary: memoirDiary(gw, seat),
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
  closeTable(gw);
  for (const seat of gw.s.seats) {
    // ww190: a seat that played on after its own peace keeps that ending.
    seat.memoir ??= memoirOf(
      gw,
      seat,
      playingOn(seat) ? "separate_peace" : undefined,
    );
  }
  gw.s.deadlineTick = null;
}
