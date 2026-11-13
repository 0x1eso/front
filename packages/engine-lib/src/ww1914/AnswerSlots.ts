// Great War 1914 (ww196 §2.1): an answer's slots, filled from state, and the
// pure rules that shape an answer by its head (§2.2). The engine
// (engine/ww1914/Departments.ts) picks the rows that hold and calls these.
// Text: pack `depts.answers.<row>`, `depts.words.<word>` for word slots.
import type {
  GreatWarState,
  GwSeatState,
  GwSide,
  GwTemperament,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_GAUGE_MAX,
  GW_LINES,
  GW_SEA_MAX,
  GW_SIDES,
  GW_THEATRES,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwAnswerSlot,
  GwConfidence,
  GwFindingRow,
  GwSlots,
  GwTaskType,
} from "@openfront/engine-api/ww1914/GwDepts";
import {
  GW_ECON_GAUGES,
  gwTrendOf,
  gwTrendWord,
} from "@openfront/engine-api/ww1914/GwEcon";
import { gwContent } from "./content/Content";
import { GW_RULERS } from "./RulerRows";

/** Our envoy to a country: the seat's office posted there. */
const ENVOY_OFFICE: Readonly<Partial<Record<GwTag, string>>> = {
  GBR: "ambassador_london",
  FRA: "ambassador_paris",
  RUS: "ambassador_petersburg",
  AUH: "ambassador_vienna",
  USA: "ambassador_washington",
};

/** Percent of the time a band-1 head brings the row's wrong finding. */
export const GW_WRONG_PCT = 30;
/** Findings a band-1 head brings. */
export const GW_WEAK_FINDINGS = 2;
/** Courses on an answer at most (the rival's counter-course adds one). */
export const GW_COURSES_MAX = 3;

const word = (value: string) => ({ kind: "word" as const, value });

/** Three steps of a gauge in words. */
function level(v: number, max: number): string {
  if (v <= 0) return "low";
  return v * 3 >= max * 2 ? "high" : "middling";
}

function sideOf(s: GreatWarState, tag: string): GwSide | null {
  return s.nations.find((n) => n.tag === tag)?.side ?? null;
}

/** What `seat` reads of `tag`: ally, enemy, a neutral leaning us or them. */
function stanceOf(s: GreatWarState, seat: GwSeatState, tag: string): string {
  const us = s.nations.find((n) => n.tag === seat.tag);
  const them = s.nations.find((n) => n.tag === tag);
  if (us === undefined || them === undefined) return "neutral";
  if (us.atWar.includes(them.tag as never)) return "enemy";
  if (them.side !== null && them.side === us.side) return "ally";
  if (them.side !== null) return "foe_side";
  const ours = us.side ?? (seat.tag === "GBR" ? "entente" : null);
  if (ours === null || them.lean === 0) return "neutral";
  const leansUs = them.lean > 0 === (ours === "entente");
  return leansUs ? "leans_us" : "leans_them";
}

function countrySlots(
  s: GreatWarState,
  seat: GwSeatState,
  tag: string,
): GwSlots {
  const out: GwSlots = { country: { kind: "tag", value: tag } };
  const them = s.nations.find((n) => n.tag === tag);
  // A head (ww208 1B) is the ruler only where a seat plays him.
  const playing = s.seats.find((x) => x.tag === tag)?.ruler.id ?? null;
  const rows = GW_RULERS[tag as GwTag] ?? [];
  const head = rows.find((r) => r.head === true && r.id === playing);
  const ruler = (
    head === undefined ? rows.filter((r) => r.head !== true) : [head]
  )
    .map((r) => r.person)
    .find(
      (id) =>
        id !== undefined &&
        s.people.some(
          (p) =>
            p.id === id && (p.status === "active" || p.status === "crowned"),
        ),
    );
  if (ruler !== undefined) out.ruler = { kind: "person", value: ruler };
  const office = ENVOY_OFFICE[tag as GwTag];
  const envoy =
    office === undefined
      ? undefined
      : s.people.find(
          (p) =>
            p.office === office &&
            p.status === "active" &&
            gwContent().people.find((d) => d.id === p.id)?.tag === seat.tag,
        );
  if (envoy !== undefined) out.envoy = { kind: "person", value: envoy.id };
  out.stance = word(stanceOf(s, seat, tag));
  if (them !== undefined && them.side === null) {
    out.readiness = word(
      them.readiness >= 67 ? "close" : them.readiness >= 34 ? "near" : "far",
    );
    const ours = sideOf(s, seat.tag);
    if (ours !== null) {
      const mine = them.offers[ours] ?? 0;
      const other = GW_SIDES.find((x) => x !== ours)!;
      const theirs = them.offers[other] ?? 0;
      out.asks = word(mine >= theirs && mine > 0 ? "matched" : "more");
      out.bidders = word(theirs > 0 ? "bidding" : "none");
    }
  }
  return out;
}

function frontSlots(
  s: GreatWarState,
  seat: GwSeatState,
  id: GwTheatre,
): GwSlots {
  const out: GwSlots = { front: { kind: "theatre", value: id } };
  const t = s.theatres.find((x) => x.id === id);
  if (t === undefined) return out;
  if (t.commander !== null) {
    out.commander = { kind: "person", value: t.commander };
  }
  const line = GW_LINES[id][t.line];
  if (line !== undefined) out.line = { kind: "place", value: line };
  const foe =
    t.attacker === seat.tag
      ? t.defender
      : t.defender === seat.tag
        ? t.attacker
        : null;
  if (foe !== null) out.enemy = { kind: "tag", value: foe };
  return out;
}

/** Home: the gauges and the ladder in words. */
function homeSlots(s: GreatWarState, seat: GwSeatState): GwSlots {
  const n = s.nations.find((x) => x.tag === seat.tag);
  if (n === undefined) return {};
  const g = (k: keyof typeof GW_GAUGE_MAX) =>
    word(level(n.gauges[k] ?? 0, GW_GAUGE_MAX[k]));
  const out: GwSlots = {
    shells: g("shells"),
    treasury: g("money"),
    bread: g("bread"),
    order: g("order"),
    prices: word(
      n.budget.prices >= 1500
        ? "high"
        : n.budget.prices >= 1150
          ? "middling"
          : "low",
    ),
    strikes: word(n.unrest >= 2 ? "high" : n.unrest >= 1 ? "middling" : "low"),
  };
  // ww201: where the production step takes each gauge, once it has run.
  if (n.econ !== undefined) {
    for (const k of GW_ECON_GAUGES) {
      const trend = gwTrendOf(n.econ.rate[k] ?? 0);
      out[`${k}_trend`] = word(
        gwTrendWord(trend, n.gauges[k] ?? 0, GW_GAUGE_MAX[k]),
      );
    }
  }
  const agitators = gwContent()
    .people.filter(
      (d) =>
        d.tag === seat.tag &&
        d.office === null &&
        d.camps.some((c) => c === "socialist" || c === "labour"),
    )
    .filter((d) => s.people.some((p) => p.id === d.id && p.status === "active"))
    .map((d) => d.id)
    .slice(0, 2);
  if (agitators.length > 0) {
    out.agitators = { kind: "person", value: agitators.join(",") };
  }
  return out;
}

function seaSlots(s: GreatWarState, seat: GwSeatState): GwSlots {
  const n = s.nations.find((x) => x.tag === seat.tag);
  const band = n?.strength.sea ?? 0;
  return {
    fleet: word(band >= 4 ? "high" : band >= 2 ? "middling" : "low"),
    blockade: word(
      s.blockade * 3 >= GW_SEA_MAX * 2
        ? "high"
        : s.blockade > 0
          ? "middling"
          : "low",
    ),
  };
}

/**
 * The slots of a task's answer: the topic's (a country, a front), the home
 * gauges and the sea, all in words or ids. Absent where state has none.
 */
export function answerSlots(
  s: GreatWarState,
  seat: GwSeatState,
  type: GwTaskType,
  topic: string | null,
): GwSlots {
  const out: GwSlots = { ...homeSlots(s, seat), ...seaSlots(s, seat) };
  if (topic !== null && (GW_THEATRES as readonly string[]).includes(topic)) {
    Object.assign(out, frontSlots(s, seat, topic as GwTheatre));
  } else if (topic !== null && s.nations.some((n) => n.tag === topic)) {
    Object.assign(out, countrySlots(s, seat, topic));
  }
  if (type === "fleet") Object.assign(out, seaSlots(s, seat));
  return out;
}

/**
 * Whether a row part's slot test holds: each named slot has one of the listed
 * values; "*" asks only that the slot is there.
 */
export function slotsHold(
  test: Partial<Record<GwAnswerSlot, readonly string[]>> | undefined,
  slots: GwSlots,
): boolean {
  if (test === undefined) return true;
  return Object.entries(test).every(([k, vs]) => {
    const v = slots[k as GwAnswerSlot];
    if (v === undefined) return false;
    return (vs ?? []).includes("*") || (vs ?? []).includes(v.value);
  });
}

/** A head's band as a confidence word. */
export function bandConfidence(band: number): GwConfidence {
  return band >= 3 ? "sure" : band === 2 ? "mostly" : "heard";
}

/** One confidence step up (불러서 묻는다). */
export function surer(c: GwConfidence): GwConfidence {
  return c === "heard" ? "mostly" : "sure";
}

/**
 * The findings a head of `band` brings (§2.2), in weight order: band 3 all;
 * band 2 drops weight 1; band 1 the top 2, and when `roll` < GW_WRONG_PCT the
 * row's wrong finding instead of the second. The rest are `left` out; a
 * wrong finding is never brought by a band 2 or 3 head.
 */
export function pickFindings(
  rows: readonly GwFindingRow[],
  band: number,
  roll: number,
): { row: GwFindingRow; left: boolean }[] {
  const right = rows.filter((f) => f.wrong !== true);
  const wrong = rows.find((f) => f.wrong === true);
  const sorted = [...right].sort((a, b) => b.weight - a.weight);
  if (band >= 3) return sorted.map((row) => ({ row, left: false }));
  if (band === 2) {
    // The slight ones are left out, unless they are all there is.
    const more = sorted.some((row) => row.weight > 1);
    return sorted.map((row) => ({ row, left: more && row.weight <= 1 }));
  }
  const kept = sorted.slice(0, GW_WEAK_FINDINGS);
  const out = sorted.map((row) => ({ row, left: !kept.includes(row) }));
  if (wrong !== undefined && kept.length > 0 && roll % 100 < GW_WRONG_PCT) {
    const i = out.findIndex((x) => x.row === kept[kept.length - 1]);
    out[i] = { row: out[i].row, left: true };
    out.splice(i, 0, { row: wrong, left: false });
  }
  return out;
}

/** How a head's temper shapes his answer (§2.2). */
export interface GwAnswerTemper {
  /** Cunning: no `against` on his course, no `for` on the one he dislikes. */
  slant: boolean;
  /** Arrogant: two courses, his first. */
  two: boolean;
  /** Anxious: adds 기다린다. */
  wait: boolean;
}

export function answerTemper(t: GwTemperament): GwAnswerTemper {
  return {
    slant: t === "cunning",
    two: t === "arrogant",
    wait: t === "anxious",
  };
}
