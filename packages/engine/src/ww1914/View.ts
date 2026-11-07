import {
  GwCard,
  GwPersonState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GreatWarData,
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { reworkTell } from "@openfront/engine-lib/ww1914/SendBackRules";
import {
  civilFromDays,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { idHash } from "@openfront/engine-lib/ww1936/Roll";
import { actViews } from "./Acts";
import { aimsView } from "./Aims";
import { govView, pollView } from "./Government";
import type { GreatWar } from "./GreatWar";
import { openTopics, readyBlock } from "./Orders";
import { rulerView } from "./Ruler";
import {
  ctxOf,
  optionOpen,
  personDef,
  pickVariant,
  sceneOf,
  speakerRole,
} from "./SceneRun";
import { backOpen, backWho } from "./SendBack";
import { inOpening, newcomers } from "./Story";
import { GW_HIDE_UNMET } from "./Tables";
import { termsView } from "./Terms";
import { seatPerson, stageOf } from "./World";
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
  const speaker = speakerRole(scene, c.node);
  const letterFrom =
    scene.kind === "letter" && scene.who !== undefined
      ? personDef(c.cast[scene.who])?.tag
      : undefined;
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
      tell: c.back?.changed ? reworkTell(o, c.back.direction) : o.tell,
      ...(o.screen === undefined ? {} : { screen: o.screen }),
    })),
    who: speaker === null ? null : (c.cast[speaker] ?? null),
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
    backTo: backOpen(gw, seat, c, scene),
    back: c.back,
    backWho: backWho(gw, seat, c, scene),
    ...(scene.big === true ? { big: true } : {}),
    ...(scene.silent === true ? { silent: true } : {}),
    ...(letterFrom === undefined ? {} : { letterFrom }),
  };
}

/** The date a chapter opened on, for text like "7월 5일에 반려하신 안". */
function dateOf(gw: GreatWar, chapter: number): string {
  const day = gwChapters(gw.s.calendar)[chapter].day + gw.s.dayShift;
  return formatIsoDate(civilFromDays(day));
}

/** Someone far off stays off the tab until they hold a desk or have come up. */
function metYet(
  seat: GwSeatState,
  p: GwPersonState,
  topics: readonly string[],
): boolean {
  return (
    p.office !== null ||
    topics.length > 0 ||
    seat.memory.some((m) => m.who === p.id) ||
    seat.desk.some((c) => Object.values(c.cast).includes(p.id))
  );
}

/** Scene weight from which a decision is one the notebook keeps. */
const KEY_SALIENCE = 7;

function isKeyDecision(id: string): boolean {
  const scene = sceneOf(id);
  if (scene === null || scene.kind === "talk") return false;
  return scene.salience >= KEY_SALIENCE || scene.kind === "crisis";
}

function seatView(gw: GreatWar, seat: GwSeatState): GwSeatView {
  const nation = gw.nation(seat.tag)!;
  const self = seatPerson(seat);
  const opening = inOpening(gw, seat);
  const defs = gwContent().people.filter(
    (d) => d.tag === seat.tag && d.id !== self,
  );
  return {
    smallID: seat.smallID,
    tag: seat.tag,
    ready: seat.ready,
    audiences: seat.audiences,
    privates: seat.privates,
    actsLeft: seat.acts,
    acts: actViews(gw, seat),
    aims: aimsView(gw, seat),
    terms: termsView(gw, seat),
    desk: seat.desk.flatMap((c) => cardView(gw, seat, c) ?? []),
    people: defs.flatMap((d) => {
      const p = gw.person(d.id);
      if (p === null || p.status !== "active") return [];
      const topics = openTopics(gw, seat, p.id);
      const privateTopics = openTopics(gw, seat, p.id, true);
      const heard = [...topics, ...privateTopics];
      const hidden = GW_HIDE_UNMET.includes(seat.tag) || d.unlisted === true;
      if (hidden && !metYet(seat, p, heard)) return [];
      if (opening && newcomers(gw, seat, [p.id]).length > 0) return [];
      return [
        {
          id: p.id,
          office: p.office,
          trust: p.trust,
          topics,
          privateTopics,
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
      key: isKeyDecision(x.scene),
      ...(x.cast === undefined ? {} : { cast: x.cast }),
    })),
    shown: seat.shown,
    letters: seat.story.letters.map((x) => ({
      with: x.with,
      out: x.out,
      scene: x.scene,
      variant: x.variant,
      tone: x.tone,
      date: dateOf(gw, x.chapter),
    })),
    gov: govView(gw, seat),
    poll: pollView(gw, seat),
    world: worldView(gw, seat),
    ruler: rulerView(gw, seat),
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
    stage: stageOf(gw),
    date: formatIsoDate(civilFromDays(s.day)),
    deadlineTick: s.deadlineTick,
    ended: s.ended,
    opening: s.opening,
    temp: s.temp,
    seats: s.seats.map((seat) => seatView(gw, seat)),
  };
  return JSON.parse(JSON.stringify(data)) as GreatWarData;
}
