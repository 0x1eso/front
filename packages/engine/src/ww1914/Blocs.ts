import {
  GwOffice,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_BLOC_AGAINST,
  GW_BLOCS,
  GW_SUPPORT_MAX,
  GwBloc,
  GwBlocView,
  gwSupportWord,
  GwTieView,
} from "@openfront/engine-api/ww1914/GwPress";
import { GW_BLOC_ROWS, GwBlocRow, GwBlocTerm } from "./BlocTable";
import { greedTerm } from "./Claims";
import type { GreatWar } from "./GreatWar";
import { GW_PRESS_ROWS } from "./PressTable";
import { holds, personDef } from "./SceneRun";
import { clampTo, ownPeople } from "./World";

/** Points make a step of support: a term can count for half. */
const POINTS = 2;
/** Reasons shown for a bloc. */
const WHY_SHOWN = 3;
/** Ministers shown for a bloc. */
const PEOPLE_SHOWN = 3;

interface Scored {
  support: number;
  terms: { key: string; points: number }[];
}

/** The people of a camp in office, the seat left out. */
function ministersOf(gw: GreatWar, seat: GwSeatState, camp: string) {
  return ownPeople(gw, seat.tag).filter(
    (p) =>
      p.office !== null &&
      !isAbroad(p.office) &&
      personDef(p.id)?.camps.some((c) => c === camp) === true,
  );
}

const isAbroad = (o: GwOffice) => o.startsWith("ambassador");

function pointsOf(gw: GreatWar, seat: GwSeatState, t: GwBlocTerm): number {
  const n = gw.nation(seat.tag)!;
  switch (t.t) {
    case "base":
      return t.points;
    case "inst": {
      const v = n.inst[t.inst];
      return v === undefined ? 0 : v * t.per;
    }
    case "if":
      return holds({ gw, seat, cast: {} }, t.when) ? t.points : 0;
    case "camp": {
      const list = ministersOf(gw, seat, t.camp);
      if (list.length === 0) return t.none ?? 0;
      const sum = list.reduce((a, p) => a + p.trust, 0);
      return Math.trunc((sum * t.per) / list.length);
    }
  }
}

function score(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwBlocRow,
  bloc: GwBloc,
): Scored {
  const terms = row.blocs[bloc].terms.map((t) => ({
    key: t.key,
    points: pointsOf(gw, seat, t),
  }));
  const opinion = seat.press.opinion[bloc] * POINTS;
  if (opinion !== 0) {
    terms.push({
      key: opinion > 0 ? "papers_kind" : "papers_hard",
      points: opinion,
    });
  }
  if (bloc === "press" && seat.press.censor > 0) {
    const points = -seat.press.censor * POINTS;
    terms.push({ key: "censor_cuts", points });
  }
  const greed = greedTerm(seat, bloc);
  if (greed !== null) terms.push(greed);
  const sum = terms.reduce((a, x) => a + x.points, 0);
  return {
    support: clampTo(Math.trunc(sum / POINTS), -GW_SUPPORT_MAX, GW_SUPPORT_MAX),
    terms: terms.filter((x) => x.points !== 0),
  };
}

/** A bloc's support as things stand; 0 for a country with no row. */
export function blocNow(gw: GreatWar, seat: GwSeatState, bloc: GwBloc): number {
  const row = GW_BLOC_ROWS[seat.tag];
  return row === undefined ? 0 : score(gw, seat, row, bloc).support;
}

/** Each bloc's support as things stand. */
export function blocsNow(
  gw: GreatWar,
  seat: GwSeatState,
): Record<GwBloc, number> | null {
  const row = GW_BLOC_ROWS[seat.tag];
  if (row === undefined) return null;
  return Object.fromEntries(
    GW_BLOCS.map((b) => [b, score(gw, seat, row, b).support]),
  ) as Record<GwBloc, number>;
}

/**
 * Leaving: a step from turned, or falling fast enough to get there by the next
 * close. Back: turned, and rising as fast.
 */
export function turningOf(
  support: number,
  delta: number,
): GwBlocView["turning"] {
  if (support > GW_BLOC_AGAINST) {
    const near = support === GW_BLOC_AGAINST + 1 && delta <= 0;
    return near || (delta < 0 && support + delta <= GW_BLOC_AGAINST)
      ? "leaving"
      : null;
  }
  return delta > 0 && support + delta > GW_BLOC_AGAINST ? "back" : null;
}

function peopleOf(gw: GreatWar, seat: GwSeatState, row: GwBlocRow, b: GwBloc) {
  const seen = new Set<string>();
  for (const t of row.blocs[b].terms) {
    if (t.t !== "camp") continue;
    for (const p of ministersOf(gw, seat, t.camp)) seen.add(p.id);
  }
  return [...seen].slice(0, PEOPLE_SHOWN);
}

export function blocViews(gw: GreatWar, seat: GwSeatState): GwBlocView[] {
  const row = GW_BLOC_ROWS[seat.tag];
  if (row === undefined) return [];
  const papers = GW_PRESS_ROWS[seat.tag]?.papers ?? [];
  const fresh = seat.press.edition === null;
  return GW_BLOCS.map((id) => {
    const { support, terms } = score(gw, seat, row, id);
    const delta = fresh ? 0 : support - seat.press.was[id];
    const strongest = [...terms].sort(
      (a, b) => Math.abs(b.points) - Math.abs(a.points),
    );
    // The reasons that run its way first: they are the answer to "why".
    const lead = support < 0 ? -1 : 1;
    const ordered = [
      ...strongest.filter((x) => Math.sign(x.points) === lead),
      ...strongest.filter((x) => Math.sign(x.points) !== lead),
    ];
    return {
      id,
      support,
      word: gwSupportWord(support),
      delta,
      turning: turningOf(support, delta),
      why: ordered
        .slice(0, WHY_SHOWN)
        .map((x) => ({ key: x.key, up: x.points > 0 })),
      people: peopleOf(gw, seat, row, id),
      papers: papers.filter((p) => p.blocs.includes(id)).map((p) => p.id),
    };
  });
}

export function tieViews(gw: GreatWar, seat: GwSeatState): GwTieView[] {
  const row = GW_BLOC_ROWS[seat.tag];
  if (row === undefined) return [];
  return row.ties.map((t) => ({
    a: t.a,
    b: t.b,
    key: t.key,
    on: t.when === undefined || holds({ gw, seat, cast: {} }, t.when),
  }));
}
