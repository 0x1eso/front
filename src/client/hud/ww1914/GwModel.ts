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
  GW_ENDINGS,
  GW_GAUGE_MAX,
  GW_INST_MAX,
  GW_INST_MIN,
  GW_LINES,
  GW_OFFICES,
  GW_SECRETS,
  GW_TRUST_MAX,
  GW_TRUST_MIN,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwCardView,
  GwPersonView,
  GwReplyView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwReplyKind } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_REPLY_KINDS } from "@openfront/engine-api/ww1914/SceneDsl";

/** The drawer's tabs, in order (design §11). */
export const GW_TABS = [
  "desk",
  "people",
  "fronts",
  "country",
  "memoir",
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
    (o) => !held.has(o) && seat.people.some((p) => p.fit.includes(o)),
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

/** Tab badges: what waits on each tab. */
export function tabBadge(seat: GwSeatView, tab: GwTab): number {
  switch (tab) {
    case "desk":
      return seat.desk.length;
    case "people":
      return seat.audiences;
    default:
      return 0;
  }
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
}

export const SHELF_KEY = "gw1914.shelf";

/** The shelf's empty boxes, for a seat whose cast has `people` names. */
export function shelfTotals(people: number): {
  endings: number;
  people: number;
  secrets: number;
} {
  // "closing" is a game with no ending of its own.
  return {
    endings: GW_ENDINGS.length - 1,
    people,
    secrets: GW_SECRETS.length,
  };
}

export function emptyShelf(): Shelf {
  return { endings: [], people: [], secrets: [], mandates: [], runs: [] };
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
  what: "people" | "secrets" | "mandates",
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
