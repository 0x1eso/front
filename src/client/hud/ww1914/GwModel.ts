// Great War 1914 screens: the plain logic behind them (no DOM), so it can be
// tested. Everything here reads only what GreatWarData holds.
import type {
  GwGauge,
  GwMemoir,
  GwOffice,
  GwReason,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_GAUGE_MAX,
  GW_INST_MAX,
  GW_INST_MIN,
  GW_LINES,
  GW_OFFICES,
  GW_TRUST_MAX,
  GW_TRUST_MIN,
  gwSecretsFor,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { GW_RULER_SIDES } from "@openfront/engine-api/ww1914/GwRuler";
import type {
  GreatWarData,
  GwCardView,
  GwChoiceView,
  GwGovView,
  GwLetterView,
  GwPersonView,
  GwPromiseView,
  GwReplyView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwReplyKind } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_REPLY_KINDS } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwEndingsOf } from "@openfront/engine-lib/ww1914/EndingRows";
import { GW_RULERS } from "@openfront/engine-lib/ww1914/RulerRows";
import { SHELF_KEY } from "../../GwRecentRuns";

/** The drawer's tabs, in order (design §11). */
export const GW_TABS = [
  "desk",
  "people",
  "schedule",
  "fronts",
  "country",
  "notebook",
  "blocs",
  "memoir",
  "table",
] as const;
export type GwTab = (typeof GW_TABS)[number];

/** Gauge words run 0..max, low to high; "bad" is the low end for all five. */
export function gaugeLevel(gauge: GwGauge, value: number): number {
  return Math.max(0, Math.min(GW_GAUGE_MAX[gauge], Math.round(value)));
}

/** 0 (worst) .. 1 (best), for the colour of a gauge. */
export function gaugeFill(gauge: GwGauge, value: number): number {
  return gaugeLevel(gauge, value) / GW_GAUGE_MAX[gauge];
}

/** The crisis temperature as one of four words. */
export function tempBand(temp: number): 0 | 1 | 2 | 3 {
  if (temp <= 2) return 0;
  if (temp <= 5) return 1;
  if (temp <= 8) return 2;
  return 3;
}

/** The trust band of a person, -3..3, as a word index 0..6. */
export function trustIndex(trust: number): number {
  return Math.max(GW_TRUST_MIN, Math.min(GW_TRUST_MAX, trust)) - GW_TRUST_MIN;
}

/** An institution's standing as five words, 0 hostile .. 4 firm. */
export function instBand(value: number): 0 | 1 | 2 | 3 | 4 {
  const v = Math.max(GW_INST_MIN, Math.min(GW_INST_MAX, value));
  if (v <= -4) return 0;
  if (v <= -2) return 1;
  if (v <= 1) return 2;
  if (v <= 3) return 3;
  return 4;
}

/** Reply kinds in the order they are laid out on the talk screen. */
export const REPLY_ORDER: readonly GwReplyKind[] = GW_REPLY_KINDS;

export function groupReplies(
  replies: readonly GwReplyView[],
): { kind: GwReplyKind; replies: GwReplyView[] }[] {
  return REPLY_ORDER.flatMap((kind) => {
    const rs = replies.filter((r) => r.kind === kind);
    return rs.length === 0 ? [] : [{ kind, replies: rs }];
  });
}

/** Offices nobody holds now. */
export function vacantOffices(seat: GwSeatView): GwOffice[] {
  const held = new Set(seat.people.map((p) => p.office));
  return GW_OFFICES.filter(
    (o) => !held.has(o) && (seat.world.candidates[o]?.length ?? 0) > 0,
  );
}

/** Offices this person can be given now: the world names who is on the list. */
export function appointable(seat: GwSeatView, p: GwPersonView): GwOffice[] {
  if (p.office !== null) return [];
  return vacantOffices(seat).filter(
    (o) => seat.world.candidates[o]?.includes(p.id) === true,
  );
}

/** The office a dismissal has to be paid for, or null if it can't be. */
export function dismissal(
  seat: GwSeatView,
  id: string,
): { price: number; affordable: boolean } | null {
  const w = seat.world.people.find((x) => x.id === id);
  if (w === undefined) return null;
  return {
    price: w.dismissPrice,
    affordable: seat.world.authority >= w.dismissPrice,
  };
}

/** Talk cards on the desk, then the rest, each in dealt order. */
export function talkCards(seat: GwSeatView): GwCardView[] {
  return seat.desk.filter((c) => c.kind === "talk");
}

export function paperCards(seat: GwSeatView): GwCardView[] {
  return seat.desk.filter((c) => c.kind !== "talk");
}

export function isReadOnly(c: GwCardView): boolean {
  return c.options.length === 0 && c.node === null;
}

/** The letters before this one with the same ruler, oldest first. */
export function letterThread(
  seat: GwSeatView,
  card: GwCardView,
): GwLetterView[] {
  const thread = (seat.letters ?? []).filter((x) => x.with === card.letterFrom);
  const here = (x: GwLetterView) =>
    !x.out && x.scene === card.scene && x.variant === card.variant;
  const self = thread.map(here).lastIndexOf(true);
  return self < 0 ? thread : thread.slice(0, self);
}

/** Tab badges: what waits on each tab. */
export function tabBadge(seat: GwSeatView, tab: GwTab): number {
  switch (tab) {
    case "desk":
      return seat.desk.length;
    case "people":
      return seat.audiences;
    case "schedule":
      return (seat.acts ?? []).length === 0 ? 0 : (seat.actsLeft ?? 0);
    case "blocs":
      return (
        seat.world.press?.blocs.filter((b) => b.turning === "leaving").length ??
        0
      );
    case "country":
      return dangers(seat).length;
    case "table":
      return (seat.table?.due ?? null) === null ? 0 : 1;
    default:
      return 0;
  }
}

/** What can end the game from here, the warning the desk and the tab carry. */
export type GwDanger =
  | { kind: "health" | "reputation" }
  | { kind: "gov"; id: string; word: 0 | 1 | 2 | 3 };

/**
 * A side of the person's card at its last word, where that side can end the
 * game, and a threat that can end it past its first scene. The papers come
 * later: this is for the player who hasn't opened the country tab.
 */
export function dangers(seat: GwSeatView): GwDanger[] {
  const out: GwDanger[] = [];
  const r = seat.ruler ?? null;
  const row =
    r === null ? undefined : GW_RULERS[seat.tag]?.find((x) => x.id === r.id);
  if (r !== null && row !== undefined) {
    if (row.mortal && r.levels[GW_RULER_SIDES.indexOf("health")] === 0) {
      out.push({ kind: "health" });
    }
    const fame = r.levels[GW_RULER_SIDES.indexOf("reputation")];
    if (row.removable && fame === 0) out.push({ kind: "reputation" });
  }
  for (const g of seat.gov ?? []) {
    if (g.fatal && g.step >= 2) {
      out.push({ kind: "gov", id: g.id, word: govWord(g) });
    }
  }
  return out;
}

/** Open promises first, the nearest date on top; then the rest, as they came. */
export function promisesInOrder(
  list: readonly GwPromiseView[],
): GwPromiseView[] {
  const open = list.filter((p) => !p.kept && !p.broken);
  const done = list.filter((p) => p.kept || p.broken);
  return [
    ...open.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0)),
    ...done.reverse(),
  ];
}

/** The big decisions, the latest first; a paper that recurs is listed once. */
export function keyDecisions(list: readonly GwChoiceView[]): GwChoiceView[] {
  const seen = new Set<string>();
  return list
    .filter((x) => x.key === true)
    .reverse()
    .filter((x) => !seen.has(x.scene) && seen.add(x.scene) !== null);
}

/** How close a threat stands, as a word: 0 talk .. 3 at the door. */
export function govWord(g: GwGovView): 0 | 1 | 2 | 3 {
  if (g.step >= g.steps) return 3;
  if (g.step === 0) return 0;
  return g.step === g.steps - 1 ? 2 : 1;
}

/** Seconds left in the chapter with a timer, else null. */
export function secondsLeft(
  data: GreatWarData,
  tick: number,
  ticksPerSecond = 10,
): number | null {
  if (data.deadlineTick === null) return null;
  return Math.max(0, Math.ceil((data.deadlineTick - tick) / ticksPerSecond));
}

export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** A theatre's place in its named lines: the line reached and a 0..1 fill. */
export function theatreSpot(
  id: GwTheatre,
  line: number,
  progress: number,
): { names: readonly string[]; line: number; at: number } {
  const names = GW_LINES[id];
  const l = Math.max(0, Math.min(names.length - 1, line));
  return { names, line: l, at: (l + Math.min(3, progress) / 4) / names.length };
}

/** One entry of the why-log, newest chapter first. */
export function logByChapter(
  log: readonly GwReason[],
): { chapter: number; reasons: GwReason[] }[] {
  const out: { chapter: number; reasons: GwReason[] }[] = [];
  for (const r of log) {
    const last = out[out.length - 1];
    if (last !== undefined && last.chapter === r.chapter) last.reasons.push(r);
    else out.push({ chapter: r.chapter, reasons: [r] });
  }
  return out.reverse();
}

/** The chapter's own scene text: its pack topic line on the people screen. */
export function topicLabel(pack: GwPack | null, scene: string): string {
  return pack?.scenes[scene]?.topic ?? pack?.scenes[scene]?.title ?? scene;
}

// ---- The shelf (design §2.8): what this browser has seen across games ----

export interface Shelf {
  /** "DEU:ending_id" */
  endings: string[];
  people: string[];
  /** Hidden papers found: the world's secrets. */
  secrets: string[];
  /** Mandates carried out. */
  mandates: string[];
  /** Games that reached their end (one entry per game). */
  runs: { tag: string; ending: string; date: string }[];
  /** Nations played past the opening, ended or not: no slow start again. */
  played: string[];
}

export { SHELF_KEY };

/** The shelf's empty boxes, for a seat whose cast has `people` names. */
export function shelfTotals(
  people: number,
  tag: GwTag = "DEU",
): {
  endings: number;
  people: number;
  secrets: number;
} {
  return {
    endings: gwEndingsOf(tag).length,
    people,
    secrets: gwSecretsFor(tag).length,
  };
}

export function emptyShelf(): Shelf {
  return {
    endings: [],
    people: [],
    secrets: [],
    mandates: [],
    runs: [],
    played: [],
  };
}

export function loadShelf(
  store: Pick<Storage, "getItem"> | null = safeStorage(),
): Shelf {
  try {
    const raw = store?.getItem(SHELF_KEY);
    if (raw === null || raw === undefined) return emptyShelf();
    const v = JSON.parse(raw) as Partial<Shelf>;
    const list = (x: unknown): string[] =>
      Array.isArray(x)
        ? x.filter((s): s is string => typeof s === "string")
        : [];
    return {
      endings: list(v.endings),
      people: list(v.people),
      secrets: list(v.secrets),
      mandates: list(v.mandates),
      runs: Array.isArray(v.runs) ? v.runs.slice(-50) : [],
      played: list(v.played),
    };
  } catch {
    return emptyShelf();
  }
}

export function saveShelf(
  shelf: Shelf,
  store: Pick<Storage, "setItem"> | null = safeStorage(),
): void {
  try {
    store?.setItem(SHELF_KEY, JSON.stringify(shelf));
  } catch {
    // Private window or blocked storage: the shelf is a convenience.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** A new shelf with the ids added (the same shelf when all are known). */
export function shelve(
  shelf: Shelf,
  what: "people" | "secrets" | "mandates" | "played",
  ids: readonly string[],
): Shelf {
  const fresh = ids.filter((id) => !shelf[what].includes(id));
  return fresh.length === 0
    ? shelf
    : { ...shelf, [what]: [...shelf[what], ...fresh] };
}

/** What a finished game adds, from the memoir the engine wrote. */
export function shelveMemoir(
  shelf: Shelf,
  tag: string,
  memoir: GwMemoir,
  date: string,
): Shelf {
  const key = `${tag}:${memoir.shelf.ending}`;
  const ended = {
    ...shelf,
    endings: shelf.endings.includes(key)
      ? shelf.endings
      : [...shelf.endings, key],
    runs: [...shelf.runs, { tag, ending: memoir.shelf.ending, date }].slice(
      -50,
    ),
  };
  const met = shelve(ended, "people", memoir.shelf.people);
  return shelve(
    shelve(met, "secrets", memoir.shelf.secrets),
    "mandates",
    memoir.shelf.mandates,
  );
}

export function endingsOf(shelf: Shelf, tag: string): number {
  return shelf.endings.filter((e) => e.startsWith(`${tag}:`)).length;
}
