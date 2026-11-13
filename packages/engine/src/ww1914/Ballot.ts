// Great War 1914: one chamber's vote, seat by seat (ww203 §5). Pure: House.ts
// says what each faction does, this casts the seats and keeps the record the
// vote scene plays. Nothing is rolled: waverers split by the chamber's score.
import type {
  GwBallotBeat,
  GwBallotBlock,
  GwBallotChamber,
  GwChamber,
} from "@openfront/engine-api/ww1914/GwHouse";
import { waverTenths } from "@openfront/engine-lib/ww1914/HouseRows";

/** What a faction does in this chamber's vote. */
export interface BallotFaction {
  id: string;
  seats: number;
  /** The bulk's side: -1 against, 0 waver, 1 for. */
  side: -1 | 0 | 1;
  /** Its seats stay out (a held leader, a boycott). */
  away: boolean;
  /** Seats that leave the bulk to waver (temper's rebels). */
  rebels: number;
  /** `swing`: a deal kept; `betray`: a deal broken; else `firm`. */
  beat: "firm" | "swing" | "betray";
  /**
   * ww209: its wing's seats voting apart, after the rest: `defy` openly
   * against the line, or a peeled wing for (`swing`). Out of `seats`.
   */
  apart?: BallotApart;
}

/** ww209: a faction's wing voting apart, its man named in the log. */
export interface BallotApart {
  seats: number;
  cast: "for" | "against";
  beat: "defy" | "swing";
  person: string;
}

export interface BallotChamberIn {
  id: GwChamber;
  /** All its seats; seats no faction holds cast as `rest`. */
  size: number | null;
  rest: "away" | "for";
  /** Against this many it fails; 0 none. */
  block: number;
  /** Chamber mood + lean + support + camps: the waverers' lean. */
  score: number;
  /** A consent chamber whose consenting faction isn't for: it fails. */
  refused: boolean;
  /** ww204: states among the `rest` seats that cast as one block, first. */
  states?: readonly { readonly id: string; readonly seats: number }[];
}

export interface BallotResult {
  chamber: GwBallotChamber;
  for: number;
  against: number;
  /** The margin in tenths of the votes cast, as the old count read. */
  count: number;
}

/** The margin in tenths of the votes cast; 0 when nobody voted. */
export function marginTenths(yes: number, no: number): number {
  const cast = yes + no;
  if (cast === 0) return 0;
  return Math.trunc(((yes - no) * 10) / cast);
}

/** Waverer seats for, of `w`, at `score`. */
export function waverFor(w: number, score: number): number {
  return Math.floor((w * waverTenths(score) + 5) / 10);
}

export function castChamber(
  c: BallotChamberIn,
  factions: readonly BallotFaction[],
): BallotResult {
  const firm: GwBallotBlock[] = [];
  const waver: GwBallotBlock[] = [];
  const late: GwBallotBlock[] = [];
  const block = (
    faction: string | null,
    cast: GwBallotBlock["cast"],
    seats: number,
    beat: GwBallotBeat,
  ): GwBallotBlock => ({ faction, cast, seats, beat });
  let held = 0;
  for (const whole of factions) {
    if (whole.seats <= 0) continue;
    held += whole.seats;
    // ww209: the wing's seats go apart, after the rest.
    const apart =
      whole.apart === undefined || whole.away
        ? 0
        : Math.min(whole.apart.seats, whole.seats);
    if (apart > 0) {
      late.push({
        ...block(whole.id, whole.apart!.cast, apart, whole.apart!.beat),
        person: whole.apart!.person,
        wing: true,
      });
    }
    const f = { ...whole, seats: whole.seats - apart };
    if (f.seats <= 0) continue;
    if (f.away) {
      const b = block(
        f.id,
        "away",
        f.seats,
        f.beat === "betray" ? "betray" : "firm",
      );
      (b.beat === "betray" ? late : firm).push(b);
      continue;
    }
    const rebels = f.side === 0 ? 0 : Math.min(f.rebels, f.seats);
    const bulk = f.side === 0 ? 0 : f.seats - rebels;
    const wavering = f.side === 0 ? f.seats : rebels;
    if (bulk > 0) {
      const b = block(f.id, f.side > 0 ? "for" : "against", bulk, f.beat);
      (f.beat === "firm" ? firm : late).push(b);
    }
    if (wavering > 0) {
      const yes = waverFor(wavering, c.score);
      if (yes > 0) waver.push(block(f.id, "for", yes, "waver"));
      if (wavering - yes > 0) {
        waver.push(block(f.id, "against", wavering - yes, "waver"));
      }
    }
  }
  let rest = c.size === null ? 0 : Math.max(0, c.size - held);
  const restCast = c.rest === "for" ? "for" : "away";
  for (const st of c.states ?? []) {
    const seats = Math.min(st.seats, rest);
    if (seats <= 0) continue;
    rest -= seats;
    firm.push({ ...block(null, restCast, seats, "firm"), state: st.id });
  }
  if (rest > 0) firm.push(block(null, restCast, rest, "firm"));
  // The government's friends first, then those against, then the empty benches.
  const order = { for: 0, against: 1, away: 2 } as const;
  firm.sort((a, b) => order[a.cast] - order[b.cast]);
  const blocks = [...firm, ...waver, ...late];
  const sum = (cast: GwBallotBlock["cast"]) =>
    blocks.filter((b) => b.cast === cast).reduce((n, b) => n + b.seats, 0);
  const yes = sum("for");
  const no = sum("against");
  const blocked = c.block > 0 && no >= c.block;
  const pass = yes > no && !blocked && !c.refused;
  const tenths = marginTenths(yes, no);
  const count = pass
    ? Math.max(0, tenths)
    : Math.min(-1, blocked || c.refused ? Math.min(tenths, -3) : tenths);
  return {
    chamber: {
      chamber: c.id,
      size: c.size ?? held,
      block: c.block,
      blocks,
      pass,
      delay: false,
    },
    for: yes,
    against: no,
    count,
  };
}
