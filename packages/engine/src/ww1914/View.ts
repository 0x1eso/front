import {
  GwCard,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GreatWarData,
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  civilFromDays,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import type { GreatWar } from "./GreatWar";
import { readyBlock, summonable } from "./Orders";
import { ctxOf, optionOpen, pickVariant, sceneOf } from "./SceneRun";

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
    says: node === null ? null : pickVariant(ctx, node.says),
    replies: (node?.replies ?? []).map((r) => ({
      id: r.id,
      open: optionOpen(ctx, r),
      tell: r.tell,
      stance: r.stance,
      kind: r.kind,
    })),
  };
}

function seatView(gw: GreatWar, seat: GwSeatState): GwSeatView {
  const nation = gw.nation(seat.tag)!;
  const topics = gwContent().scenes.filter((x) => x.summon === true);
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
          topics: topics
            .filter((x) => summonable(gw, seat, p.id, x.id))
            .map((x) => x.id),
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
    })),
    alloc: seat.alloc,
    log: seat.log,
    readyBlock: readyBlock(seat),
  };
}

/** A copy: the view crosses to the main thread while the state moves on. */
export function gwView(gw: GreatWar): GreatWarData {
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
    seats: s.seats.map((seat) => seatView(gw, seat)),
  };
  return JSON.parse(JSON.stringify(data)) as GreatWarData;
}
