// Great War 1914 (ww207 §9, U1): the bottom strip's plan. Pure: which chips
// stand in what order, what each shows (the standing bar, the fervour marks,
// the ability's dot, the affinity ring, the fallback shield), and the
// election card's hemicycle (seats before and after). GwStrip and GwSocietyTab draw it. Words, not numbers.
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import {
  GW_AFFINITY_MAX,
  GW_TRUST_MAX,
  type GwElection,
  type GwSocietyView,
  type GwStripFactionView,
} from "@openfront/engine-api/ww1914/GwSociety";
import { BLOC_COLOR, BLOC_SEATING, NO_BLOC_COLOR } from "./GwStyle";
import { arcSeats } from "./GwVoteModel";
import { markOf } from "./marks/GwMarks";

/** The strip's chips: sitting factions by seats, most first; born ones with none, then the gone. */
export function stripFactions(
  view: GwSocietyView | undefined,
): readonly GwStripFactionView[] {
  const list = view?.factions ?? [];
  const rank = (f: GwStripFactionView) =>
    f.status === "gone" ? 2 : f.seats > 0 ? 0 : 1;
  return list
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || b.f.seats - a.f.seats || a.i - b.i)
    .map((x) => x.f);
}

/** A faction's main colour: its mark's, else its bloc's. */
export function factionColour(f: { id: string; bloc: string }): string {
  return markOf(f.id)?.colours[0] ?? BLOC_COLOR[f.bloc] ?? NO_BLOC_COLOR;
}

/**
 * The fallback shield's letters: the pack's `short`, else the name's first
 * two letters (a pack without the line must not leave the shield empty).
 */
export function shieldLetters(pack: GwPack | null, id: string): string {
  const row = pack?.factions?.[id];
  const short = row?.short?.trim();
  if (short !== undefined && short.length > 0) return short;
  const name = (row?.name ?? id).replace(/[\s·.]/g, "");
  return Array.from(name).slice(0, 2).join("");
}

/** The standing bar's segments: trust -3..3 fills 0..6 of 6. */
export const STANDING_SEGMENTS = 2 * GW_TRUST_MAX;
export function standingFilled(trust: number): number {
  return Math.max(
    0,
    Math.min(STANDING_SEGMENTS, Math.round(trust) + GW_TRUST_MAX),
  );
}

/** Red fervour marks: none to temper 1, then one at 2, two at 3, three at 4. */
export function fervourMarks(temper: number): number {
  return Math.max(0, Math.min(3, Math.round(temper) - 1));
}

/** The ring round the mark: 0..1 of the tree's fill. */
export function ringFill(affinity: number): number {
  return Math.max(0, Math.min(1, affinity / GW_AFFINITY_MAX));
}

/** An axis step -3..3 as a place on its line, 0 (the first word) .. 1. */
export function axisPlace(step: number): number {
  return Math.max(0, Math.min(1, (step + 3) / 6));
}

// ---- The election card ----

export interface GwElectDot {
  x: number;
  y: number;
  before: string;
  after: string;
}

export interface GwElectRow {
  faction: string;
  before: number;
  after: number;
  colour: string;
}

export interface GwElectPlan {
  dots: GwElectDot[];
  r: number;
  /** In the hemicycle's order: left to right by bloc. */
  rows: GwElectRow[];
}

const EMPTY = "#334155";

/**
 * The hemicycle before and after: blocs seated left to right as the vote
 * scene seats them, each dot taking its new party's colour as it turns.
 */
export function electPlan(
  e: GwElection,
  blocOf: (faction: string) => string | null,
): GwElectPlan {
  const seatOf = (f: string) => {
    const b = blocOf(f);
    const i = b === null ? -1 : BLOC_SEATING.indexOf(b);
    return i < 0 ? BLOC_SEATING.length : i;
  };
  const rows: GwElectRow[] = e.seats
    .map((s, i) => ({ s, i }))
    .sort((a, b) => seatOf(a.s.faction) - seatOf(b.s.faction) || a.i - b.i)
    .map(({ s }) => {
      const bloc = blocOf(s.faction);
      return {
        faction: s.faction,
        before: Math.max(0, s.before),
        after: Math.max(0, s.after),
        colour: factionColour({ id: s.faction, bloc: bloc ?? "" }),
      };
    });
  const colours = (pick: (r: GwElectRow) => number) =>
    rows.flatMap((r) => Array.from({ length: pick(r) }, () => r.colour));
  const before = colours((r) => r.before);
  const after = colours((r) => r.after);
  const n = Math.max(before.length, after.length);
  const layout = arcSeats(n);
  return {
    dots: layout.pts.map((p, i) => ({
      x: p.x,
      y: p.y,
      before: before[i] ?? EMPTY,
      after: after[i] ?? EMPTY,
    })),
    r: layout.r,
    rows,
  };
}

/** The election card's clock: each uid plays once; the one at load is only remembered. */
export class GwElect {
  election: GwElection | null = null;
  private seen: number | null = null;

  get active(): boolean {
    return this.election !== null;
  }

  offer(e: GwElection | null): boolean {
    const first = this.seen === null;
    if (e === null) {
      this.seen ??= -1;
      return false;
    }
    if (e.uid === this.seen) return false;
    this.seen = e.uid;
    if (first) return false;
    this.election = e;
    return true;
  }

  close(): void {
    this.election = null;
  }
}
