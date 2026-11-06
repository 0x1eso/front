import {
  GW_SLOW_MAX,
  GW_TELEGRAMS_PER_CHAPTER,
  GwCard,
  GwSeatState,
  GwTelegram,
  GwTreaty,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GreatWarData,
  GwCardView,
  GwDiploView,
  GwFinaleView,
  GwRosterView,
  GwSeatView,
  GwTelegramView,
  GwTreatyView,
} from "@openfront/engine-api/ww1914/GwView";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  civilFromDays,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { idHash } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { openTopics, readyBlock } from "./Orders";
import { ctxOf, optionOpen, pickVariant, sceneOf } from "./SceneRun";
import { isHost } from "./Seats";
import { worldView } from "./WorldView";

function cardView(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwCard,
): GwCardView | null {
  const scene = sceneOf(c.scene);
  if (scene === null) return null;
  const ctx = ctxOf(gw, seat, c);
  const node = c.node === null ? null : (scene.nodes?.[c.node] ?? null);
  return {
    uid: c.uid,
    scene: c.scene,
    kind: scene.kind,
    variant: c.variant,
    cast: c.cast,
    stamp: scene.stamp ?? null,
    options: (scene.options ?? []).map((o) => ({
      id: o.id,
      open: optionOpen(ctx, o),
      tell: o.tell,
    })),
    who: scene.who === undefined ? null : (c.cast[scene.who] ?? null),
    node: c.node,
    says:
      node === null
        ? null
        : pickVariant(ctx, node.says, c.uid ^ idHash(c.node ?? "")),
    replies: (node?.replies ?? []).map((r) => ({
      id: r.id,
      open: optionOpen(ctx, r),
      tell: r.tell,
      stance: r.stance,
      kind: r.kind,
    })),
    voice: c.voice,
    folded: c.folded,
  };
}

/** The date a chapter opened on, for text like "7월 5일에 반려하신 안". */
function dateOf(gw: GreatWar, chapter: number): string {
  const day = gwChapters(gw.s.calendar)[chapter].day + gw.s.dayShift;
  return formatIsoDate(civilFromDays(day));
}

function seatView(gw: GreatWar, seat: GwSeatState): GwSeatView {
  const nation = gw.nation(seat.tag)!;
  const defs = gwContent().people.filter((d) => d.tag === seat.tag);
  return {
    smallID: seat.smallID,
    tag: seat.tag,
    ready: seat.ready,
    audiences: seat.audiences,
    desk: seat.desk.flatMap((c) => cardView(gw, seat, c) ?? []),
    people: defs.flatMap((d) => {
      const p = gw.person(d.id);
      if (p === null || p.status !== "active") return [];
      return [
        {
          id: p.id,
          office: p.office,
          trust: p.trust,
          topics: openTopics(gw, seat, p.id),
          fit: d.fit,
          rivals: d.rivals,
        },
      ];
    }),
    gauges: nation.gauges,
    inst: nation.inst,
    theatres: gw.s.theatres.map((t) => ({
      id: t.id,
      line: t.line,
      progress: t.progress,
      trench: t.trench,
      open: t.open,
      attacker: t.attacker,
      defender: t.defender,
    })),
    alloc: seat.alloc,
    log: seat.log,
    readyBlock: readyBlock(seat),
    promises: seat.promises.map((x) => ({
      key: x.key,
      who: x.who,
      due: dateOf(gw, Math.min(x.due, gwChapters(gw.s.calendar).length - 1)),
      kept: x.kept,
      broken: x.broken,
    })),
    memory: seat.memory.map((m) => ({
      key: m.key,
      who: m.who,
      date: dateOf(gw, m.chapter),
    })),
    choices: seat.choices.map((x) => ({
      scene: x.scene,
      pick: x.pick,
      date: dateOf(gw, x.chapter),
      proxy: x.proxy,
    })),
    shown: seat.shown,
    world: worldView(gw, seat),
    diplo: diploView(gw, seat),
  };
}

function treatyView(
  gw: GreatWar,
  t: GwTreaty,
  seat: GwSeatState | null,
): GwTreatyView {
  return {
    uid: t.uid,
    from: t.from,
    to: t.to,
    clauses: t.clauses,
    state: t.state,
    date: dateOf(gw, t.chapter),
    signed: t.signed === null ? null : dateOf(gw, t.signed),
    leaked: t.leaked,
    brokenBy: t.brokenBy,
    why: t.why,
    mine: seat !== null && (t.from === seat.tag || t.to === seat.tag),
    answer: seat !== null && t.state === "offered" && t.to === seat.tag,
  };
}

/** How this seat holds a telegram; null if it doesn't. */
function boxOf(t: GwTelegram, seat: GwSeatState): GwTelegramView["box"] | null {
  if (t.from === seat.tag) return "sent";
  if (!t.delivered) return null;
  if (t.to === seat.tag) return "in";
  return t.copies.includes(seat.tag) ? "copy" : null;
}

function diploView(gw: GreatWar, seat: GwSeatState): GwDiploView {
  const s = gw.s;
  return {
    telegrams: s.telegrams.flatMap((t) => {
      const box = boxOf(t, seat);
      if (box === null) return [];
      return [
        {
          uid: t.uid,
          from: t.from,
          to: t.to,
          box,
          cipher: t.cipher,
          text: t.text,
          date: dateOf(gw, t.chapter),
          delivered: t.delivered,
        },
      ];
    }),
    treaties: s.treaties
      .filter((t) => t.from === seat.tag || t.to === seat.tag || t.leaked)
      .map((t) => treatyView(gw, t, seat)),
    wiresLeft: Math.max(0, GW_TELEGRAMS_PER_CHAPTER - seat.wired),
  };
}

function rosterView(gw: GreatWar): GwRosterView[] {
  return gw.s.seats.map((seat) => ({
    smallID: seat.smallID,
    tag: seat.tag,
    ready: seat.ready,
    regent: seat.regent,
    away: seat.away,
    host: isHost(gw, seat),
  }));
}

/** Everything comes out at the end: nobody's desk is left to protect. */
function finaleView(gw: GreatWar): GwFinaleView | null {
  const s = gw.s;
  if (s.ended === null || s.seats.length < 2) return null;
  return {
    memoirs: s.seats.flatMap((seat) =>
      seat.memoir === null
        ? []
        : [{ smallID: seat.smallID, tag: seat.tag, memoir: seat.memoir }],
    ),
    treaties: s.treaties
      .filter((t) => t.signed !== null)
      .map((t) => treatyView(gw, t, null)),
    intercepted: s.telegrams
      .filter((t) => t.copies.length > 0)
      .map((t) => ({
        from: t.from,
        to: t.to,
        by: t.copies,
        text: t.text,
        date: dateOf(gw, t.chapter),
      })),
  };
}

/**
 * A copy: the view crosses to the main thread while the state moves on.
 * `viewer`: the smallID whose seat to include; `undefined` includes all of
 * them and is for tests and tools, never a client. A client's worker passes
 * its own seat, or null for a spectator.
 */
export function gwView(gw: GreatWar, viewer?: number | null): GreatWarData {
  const s = gw.s;
  const chapters = gwChapters(s.calendar);
  const data: GreatWarData = {
    calendar: s.calendar,
    chapter: s.chapter,
    chapterCount: chapters.length,
    stage: chapters[s.chapter].stage,
    date: formatIsoDate(civilFromDays(s.day)),
    deadlineTick: s.deadlineTick,
    ended: s.ended,
    opening: s.opening,
    temp: s.temp,
    seats: s.seats
      .filter((seat) => viewer === undefined || seat.smallID === viewer)
      .map((seat) => seatView(gw, seat)),
    roster: rosterView(gw),
    slow: {
      asked: s.slowAsked,
      granted: s.slowGranted,
      max: GW_SLOW_MAX,
    },
    finale: finaleView(gw),
  };
  return JSON.parse(JSON.stringify(data)) as GreatWarData;
}
