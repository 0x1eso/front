import {
  GW_FRONT_START,
  GW_SLOW_MAX,
  GW_TELEGRAMS_PER_CHAPTER,
  GwCard,
  GwPersonState,
  GwSeatState,
  GwTelegram,
  GwTheatre,
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
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_LADDER_LAST,
  GW_LADDER_NOTE,
  GW_LADDER_REFUSED,
} from "@openfront/engine-lib/ww1914/content/ladder";
import {
  GW_BIG_SCENE_PLACES,
  sceneNear,
} from "@openfront/engine-lib/ww1914/PlaceRules";
import { reworkTell } from "@openfront/engine-lib/ww1914/SendBackRules";
import {
  civilFromDays,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { idHash } from "@openfront/engine-lib/ww1936/Roll";
import { actViews } from "./Acts";
import { aimsView } from "./Aims";
import { askOffers, summonPrice } from "./AskFirst";
import { claimsView } from "./Claims";
import {
  cardDeptView,
  deptViews,
  leverViews,
  paperView,
  personTodo,
  roomView,
  timeView,
  todoCount,
} from "./Departments";
import { diaryViews } from "./Diary";
import { govView, pollView } from "./Government";
import type { GreatWar } from "./GreatWar";
import { openTopics, readyBlock } from "./Orders";
import {
  bearerRow,
  deskHead,
  grainLocked,
  grainView,
  isPrivatePaper,
  misledOf,
} from "./Persona";
import { powerViews } from "./Powers";
import { prologueView } from "./Prologue";
import { rulerView } from "./Ruler";
import {
  ctxOf,
  optionOpen,
  personDef,
  pickVariant,
  sceneOf,
  speakerRole,
} from "./SceneRun";
import { isHost } from "./Seats";
import { backOpen, backWho } from "./SendBack";
import { decryptFor } from "./Spies";
import { inOpening, newcomers } from "./Story";
import { tableView } from "./Table";
import { GW_HIDE_UNMET } from "./Tables";
import { termsView } from "./Terms";
import { seatPerson, stageOf } from "./World";
import { worldView } from "./WorldView";

/** Named by hand, or by rule: the screen reads the brief in between. */
function cardPlace(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
): Pick<GwCardView, "place" | "near"> {
  const place = scene.place ?? GW_BIG_SCENE_PLACES[scene.id];
  if (place !== undefined) return { place };
  const lineOf = (t: GwTheatre) =>
    gw.s.theatres.find((x) => x.id === t)?.line ?? GW_FRONT_START[t];
  const main = seat.alloc.main;
  return { near: sceneNear(scene, { tag: seat.tag, main, lineOf }) };
}

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
    ...cardPlace(gw, seat, scene),
    variant: c.variant,
    cast: c.cast,
    stamp: scene.stamp ?? null,
    options: (scene.options ?? []).map((o) => {
      const grain = grainView(gw, seat, c, scene, o);
      return {
        id: o.id,
        open: optionOpen(ctx, o) && !grainLocked(gw, seat, c, scene, o),
        tell: c.back?.changed ? reworkTell(o, c.back.direction) : o.tell,
        ...(o.screen === undefined ? {} : { screen: o.screen }),
        ...(grain === undefined ? {} : { grain }),
      };
    }),
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
    ...(scene.prologue === undefined ? {} : { past: scene.prologue }),
    ...(letterFrom === undefined ? {} : { letterFrom }),
    ...asksOf(gw, seat, c),
    ...decryptOf(gw, seat, c.scene),
    ...(c.dept === undefined ? {} : { dept: cardDeptView(gw, c) }),
    ...(c.paper === undefined ? {} : { paper: paperView(gw, seat, c) }),
    ...bearerOf(gw, seat, c, scene),
  };
}

/** ww196: who hands the paper in, and whether it is a private one. */
function bearerOf(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwCard,
  scene: GwScene,
): Pick<GwCardView, "bearer" | "private"> {
  const b = bearerRow(gw, seat, c);
  return {
    ...(b === null ? {} : { bearer: b.id }),
    ...(isPrivatePaper(scene) ? { private: true } : {}),
  };
}

/** ww178: a note's card carries what the code-breakers read of the other side. */
function decryptOf(
  gw: GreatWar,
  seat: GwSeatState,
  scene: string,
): Pick<GwCardView, "decrypt"> {
  if (![GW_LADDER_NOTE, GW_LADDER_REFUSED, GW_LADDER_LAST].includes(scene)) {
    return {};
  }
  const d = decryptFor(gw, seat);
  return d === null ? {} : { decrypt: d };
}

/** What can be asked from a decision first, and where an asked talk goes back to. */
function asksOf(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwCard,
): Pick<GwCardView, "asks" | "askFrom"> {
  if (c.ask !== undefined) return { askFrom: c.ask.from };
  const offers = askOffers(gw, seat, c);
  if (offers.length === 0) return {};
  return {
    asks: offers.map((x) => {
      const block = summonPrice(seat, sceneOf(x.topic), x.topic);
      return {
        topic: x.topic,
        who: x.who,
        options: x.options,
        open: block === null,
        ...(block === null ? {} : { block }),
      };
    }),
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
    powers: powerViews(gw, seat),
    depts: deptViews(gw, seat, (ch) => dateOf(gw, ch)),
    room: roomView(gw, seat),
    time: timeView(gw, seat),
    levers: leverViews(),
    todo: todoCount(gw, seat),
    aims: aimsView(gw, seat),
    claims: claimsView(gw, seat),
    table: tableView(gw, seat),
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
      const todo = personTodo(gw, seat, p.id);
      const misled = misledOf(gw, seat, p.id);
      return [
        {
          id: p.id,
          office: p.office,
          trust: p.trust,
          topics,
          privateTopics,
          fit: d.fit,
          rivals: d.rivals,
          ...(todo.length === 0 ? {} : { todo }),
          ...(misled > 0 || p.office !== null ? { misled } : {}),
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
    head: deskHead(gw, seat),
    diary: diaryViews(gw, seat),
    prologue: prologueView(gw, seat),
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
    stage: stageOf(gw),
    date: formatIsoDate(civilFromDays(s.day)),
    deadlineTick: s.deadlineTick,
    ended: s.ended,
    held: s.held,
    landMoves: s.landMoves,
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
