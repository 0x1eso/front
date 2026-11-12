// Great War 1914 (ww193, ww196): departments at work. Each office the seat's
// own people hold is a department. ww196 (design ww195 §2): the ruler gives a
// department a task of a type, for free, one at a time. It works through the
// stages 착수 → 조사 → 초안 → 보고, may ask one question back, may stall, and
// brings its own answer (답신): findings and courses built from the answer
// rows that hold, filled from state and shaped by its head. Everything it
// produces comes to the desk as a paper (`card.paper`) that waits there from
// chapter to chapter; nothing is briefed, no tray. An answer unheard for two
// chapters is acted on by the department (대행), and so is one of its own
// desk papers (an initiative) left at the chapter's end. Rows: GwDepts.ts;
// rules: engine-lib TaskRows.ts, AnswerSlots.ts. AI countries have none.
import {
  GW_OFFICES,
  GW_TRUST_MAX,
  GW_TRUST_MIN,
  GwCard,
  GwCardDept,
  gwDeptStart,
  GwDeptState,
  GwDeptTask,
  GwOffice,
  GwPaper,
  GwPersonState,
  GwSeatState,
  GwVerdict,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwAnswerRedo,
  GwAnswerRow,
  GwCardDeptView,
  GwCourseRow,
  GwDeptStage,
  GwDeptView,
  GwFindingRow,
  GwLean,
  GwLeverView,
  GwPaperForm,
  GwPaperView,
  GwRoomRowView,
  GwSlots,
  GwStallReason,
  GwTaskOfferView,
  GwTaskPush,
  GwTaskRow,
  GwTaskType,
  GwTimeView,
  GwTodoView,
} from "@openfront/engine-api/ww1914/GwDepts";
import {
  GW_COMMON_TASK_TYPES,
  GW_QUESTION_PICKS,
} from "@openfront/engine-api/ww1914/GwDepts";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import {
  GW_READ_ONLY_KINDS,
  GwOption,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  answerSlots,
  answerTemper,
  bandConfidence,
  GW_COURSES_MAX,
  pickFindings,
  slotsHold,
  surer,
} from "@openfront/engine-lib/ww1914/AnswerSlots";
import { gwMemoryKeys } from "@openfront/engine-lib/ww1914/AskIndex";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  bandStamp,
  campsOpposed,
  courseLeanPick,
  deptBand,
  dislikedCourse,
  GW_ANSWER_WAIT,
  GW_DEPT_DISLOYAL,
  GW_DEPT_LEAN_DEFAULT,
  GW_HURRY_MONEY,
  GW_LEAK_PCT,
  GW_NOT_DEPTS,
  GW_OMIT_PCT,
  GW_PETITIONERS_MAX,
  GW_PRESS_OVERRULED,
  GW_PROUD,
  GW_STALL_CLEAR_PCT,
  GW_STALL_PCT,
  GW_TASK_BASE,
  GW_TASK_COOLDOWN,
  GW_TASK_OFFICES,
  GW_TASK_PICK,
  GW_THEN_AFTER,
  GW_TIME_CARRY,
  GW_TIME_PRICES,
  GW_TRIP_BRIEFERS,
  leanPick,
  leanRow,
  spendsMoney,
  taskChapters,
  taskRow,
} from "@openfront/engine-lib/ww1914/TaskRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  GW_SALIENCE_MUST,
  inStage,
  makeCard,
  placeCard,
  repeatable,
} from "./Desk";
import { ownFronts } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { lawDraftCard, lawDropDraft } from "./Laws";
import { openTopics } from "./Orders";
import { moveRumour } from "./Press";
import {
  castOf,
  ctxOf,
  holderOf,
  holds,
  optionOpen,
  personDef,
  removeCard,
  rivalIds,
  runEffects,
  SceneCtx,
  sceneHolds,
  sceneOf,
  takeOption,
} from "./SceneRun";
import { inOpening } from "./Story";
import { spendTime, timeLeft } from "./Time";
import { moveGauge, ownPeople, reasonOf, seatPerson, stageOf } from "./World";

const P_LEAK = idHash("gw_dept_leak");
const P_OMIT = idHash("gw_dept_omit");
const P_ROOM = idHash("gw_dept_room");
const P_STALL = idHash("gw_dept_stall");
const P_CLEAR = idHash("gw_dept_clear");
const P_WRONG = idHash("gw_dept_wrong");

/** Report sources from abroad: those reports stay the desk's own. */
const ABROAD = /^(embassy_|attache$|agents$|envoy$|codes$|prisoners$)/;
/** Papers that stay the desk's whoever wrote them. */
const DESK_KINDS = ["crisis", "ledger", "letter", "talk", "wire"];

type AnswerPaper = Extract<GwPaper, { form: "answer" }>;
type QuestionPaper = Extract<GwPaper, { form: "question" }>;
type NewsLine = Extract<GwPaper, { form: "news" }>["lines"][number];

// ---- State ----

/** The seat's departments' state, made on first use. */
export function deptState(seat: GwSeatState): GwDeptState {
  seat.depts ??= gwDeptStart();
  return seat.depts;
}

/** The head of `office`; null when empty or held by the ruler himself. */
export function deptHead(
  gw: GreatWar,
  seat: GwSeatState,
  office: GwOffice,
): GwPersonState | null {
  if (GW_NOT_DEPTS.includes(office)) return null;
  const p = holderOf(gw, seat, office);
  return p === null || p.id === seatPerson(seat) ? null : p;
}

/** The seat's departments now, in GW_OFFICES order. */
export function deptOffices(gw: GreatWar, seat: GwSeatState): GwOffice[] {
  return GW_OFFICES.filter((o) => deptHead(gw, seat, o) !== null);
}

const dept = (c: GwCard): GwCardDept => c.dept!;

function busy(d: GwDeptState, office: GwOffice): boolean {
  return d.tasks.some((t) => t.office === office);
}

function clampTrust(v: number): number {
  return Math.max(GW_TRUST_MIN, Math.min(GW_TRUST_MAX, v));
}

interface PastOf {
  office: GwOffice;
  row: string | null;
  topic: string | null;
  scene: string;
  type?: GwTaskType;
  course?: string | null;
}

function writePast(
  gw: GreatWar,
  seat: GwSeatState,
  p: PastOf,
  verdict: GwVerdict,
): void {
  deptState(seat).past.push({
    office: p.office,
    row: p.row,
    topic: p.topic,
    scene: p.scene,
    chapter: gw.s.chapter,
    verdict,
    ...(p.type === undefined ? {} : { type: p.type }),
    ...(p.course === undefined ? {} : { course: p.course }),
  });
  const key = p.row ?? p.type;
  if (key !== undefined && verdict !== "shelve" && verdict !== "pass_on") {
    // Later papers can read that the work was done: `memory task_<row>`.
    seat.memory.push({
      key: `task_${key}`,
      who: null,
      chapter: gw.s.chapter,
      weight: 0,
    });
  }
}

/** The head's lean: his camp's row, the office's, else the default. */
function headLean(
  seat: GwSeatState,
  office: GwOffice,
  head: GwPersonState,
): { lean: GwLean; picks?: Readonly<Record<string, string>> } {
  const camps = personDef(head.id)?.camps ?? [];
  const row = leanRow(gwContent().depts, seat.tag, office, camps);
  return { lean: row?.lean ?? GW_DEPT_LEAN_DEFAULT[office], picks: row?.picks };
}

/** Two heads that pull against each other. */
function opposed(gw: GreatWar, a: GwPersonState, b: GwPersonState): boolean {
  if (rivalIds(gw, a.id).includes(b.id) || rivalIds(gw, b.id).includes(a.id)) {
    return true;
  }
  return campsOpposed(
    personDef(a.id)?.camps ?? [],
    personDef(b.id)?.camps ?? [],
  );
}

// ---- Initiatives: the department's own desk papers (ww193, kept) ----

/** The memory keys his band opens: band 3 every gated option's, 2 the first's. */
function bandKeys(ctx: SceneCtx, scene: GwScene, band: number): string[] {
  if (band <= 1) return [];
  const out: string[] = [];
  for (const o of scene.options ?? []) {
    if (o.when === undefined || holds(ctx, o.when)) continue;
    const keys = gwMemoryKeys(o.when);
    if (keys.length === 0) continue;
    if (!holds({ ...ctx, assume: new Set(keys) }, o.when)) continue;
    for (const k of keys) if (!out.includes(k)) out.push(k);
    if (band === 2) break;
  }
  return out;
}

function openOptions(ctx: SceneCtx, scene: GwScene): GwOption[] {
  return (scene.options ?? []).filter((o) => optionOpen(ctx, o));
}

/** The option `head`'s department marks on `scene`; null with none open. */
function leanOption(
  seat: GwSeatState,
  office: GwOffice,
  head: GwPersonState,
  scene: GwScene,
  open: readonly GwOption[],
): string | null {
  const { lean, picks } = headLean(seat, office, head);
  return leanPick(open, lean, picks?.[scene.id]);
}

/**
 * The rival department that comes with a paper of `office`, if any: a rival
 * row whose tags, cost and named papers fit. `scene` null: an answer, which
 * only rows with none of those limits fit.
 */
function rivalOf(
  gw: GreatWar,
  seat: GwSeatState,
  office: GwOffice,
  head: GwPersonState,
  scene: GwScene | null,
  open: readonly GwOption[],
): { office: GwOffice; head: GwPersonState; counter: string | null } | null {
  for (const r of gwContent().depts?.rivals ?? []) {
    if (r.office !== office) continue;
    if (r.papers !== undefined && !r.papers.includes(scene?.id ?? "")) continue;
    if (r.tags !== undefined) {
      if (scene === null || !r.tags.some((t) => scene.tags.includes(t))) {
        continue;
      }
    }
    if (r.cost === true && (scene === null || !open.some(spendsMoney))) {
      continue;
    }
    const against = r.against ?? deptOffices(gw, seat);
    for (const o2 of against) {
      if (o2 === office) continue;
      const h2 = deptHead(gw, seat, o2);
      if (h2 === null || h2.id === head.id) continue;
      // A row about named papers needs no feud: the paper is the quarrel.
      if (r.papers !== undefined || opposed(gw, head, h2)) {
        return { office: o2, head: h2, counter: r.counter ?? null };
      }
    }
  }
  return null;
}

/** A dispute scene that sets the two departments against each other. */
function disputeFor(
  gw: GreatWar,
  seat: GwSeatState,
  a: GwOffice,
  b: GwOffice,
  counter: string | null,
): GwScene | null {
  const named = counter === null ? null : sceneOf(counter);
  // A row's own counter-paper answers only its papers.
  const owned = new Set(
    (gwContent().depts?.rivals ?? []).flatMap((r) =>
      r.counter === undefined ? [] : [r.counter],
    ),
  );
  for (const x of named === null ? gwContent().scenes : [named]) {
    if (x.kind !== "dispute" || !x.nation.includes(seat.tag)) continue;
    if (named === null && owned.has(x.id)) continue;
    const offices = Object.values(x.cast).flatMap((r) =>
      ("any_of" in r ? r.any_of : [r]).flatMap((q) =>
        "office" in q && !("tag" in q) ? [q.office] : [],
      ),
    );
    if (!offices.includes(a) || !offices.includes(b)) continue;
    if (seat.desk.some((c) => c.scene === x.id)) continue;
    if (!inStage(gw, x) || !repeatable(gw, seat, x)) continue;
    const cast = castOf(gw, seat, x);
    if (cast !== null && sceneHolds({ gw, seat, cast }, x)) return x;
  }
  return null;
}

/** Marks `card` as `office`'s; returns the rival's counter-paper if he brings one. */
function mark(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  office: GwOffice,
  head: GwPersonState,
): GwCard | null {
  const scene = sceneOf(card.scene)!;
  const band = deptBand(head, office);
  const base: SceneCtx = { gw, seat, cast: card.cast, card };
  const keys = bandKeys(base, scene, band);
  const ctx = { ...base, assume: new Set(keys) };
  const open = openOptions(ctx, scene);
  const option = leanOption(seat, office, head, scene, open);
  let rival = rivalOf(gw, seat, office, head, scene, open);
  // A cunning or arrogant head keeps the other side's option out at times.
  const sly = head.temperament === "cunning" || head.temperament === "arrogant";
  const roll = wwRoll(gw.s.seed, P_OMIT, gw.s.chapter, idHash(card.scene));
  if (rival !== null && sly && roll % 100 < GW_OMIT_PCT) rival = null;
  const theirs =
    rival === null
      ? null
      : leanOption(
          seat,
          rival.office,
          rival.head,
          scene,
          open.filter((o) => o.id !== option),
        );
  card.dept = {
    office,
    by: head.id,
    row: null,
    topic: null,
    ready: gw.s.chapter,
    keys,
    band,
    option,
    rival:
      rival === null
        ? null
        : { office: rival.office, by: rival.head.id, option: theirs },
    counter: false,
    heard: true,
  };
  if (rival === null) return null;
  const x = disputeFor(gw, seat, office, rival.office, rival.counter);
  const c = x === null ? null : makeCard(gw, seat, x, "summon");
  if (x === null || c === null) return null;
  const xctx: SceneCtx = { gw, seat, cast: c.cast, card: c };
  c.dept = {
    office: rival.office,
    by: rival.head.id,
    row: null,
    topic: null,
    ready: gw.s.chapter,
    keys: [],
    band: deptBand(rival.head, rival.office),
    option: leanOption(seat, rival.office, rival.head, x, openOptions(xctx, x)),
    rival: { office, by: head.id, option: null },
    counter: true,
    heard: true,
  };
  return c;
}

/** The department whose own paper this is, or null when it is the desk's. */
function initiativeOf(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
): GwOffice | null {
  const scene = sceneOf(card.scene);
  if (scene === null || DESK_KINDS.includes(scene.kind)) return null;
  if (scene.essential === true || scene.big === true) return null;
  if (scene.salience >= GW_SALIENCE_MUST) return null;
  if (scene.kind === "report" && ABROAD.test(scene.source ?? "")) return null;
  const role = scene.author ?? Object.keys(scene.cast)[0];
  const rule = role === undefined ? undefined : scene.cast[role];
  if (rule === undefined) return null;
  const byOffice = ("any_of" in rule ? rule.any_of : [rule]).some(
    (r) => "office" in r && !("tag" in r),
  );
  if (!byOffice) return null;
  const p = gw.person(card.cast[role] ?? "");
  if (p === null || p.office === null) return null;
  return deptHead(gw, seat, p.office)?.id === p.id ? p.office : null;
}

/**
 * ww196: the department's own papers stay on the desk with its chip: the
 * papers dealt this chapter that a head wrote are marked as his, and a rival
 * head may bring his counter-paper beside. Not in the opening or the crisis.
 */
export function markDesk(gw: GreatWar, seat: GwSeatState): void {
  if (inOpening(gw, seat) || stageOf(gw) === "crisis") return;
  for (const card of [...seat.desk]) {
    if (card.chapter !== gw.s.chapter) continue;
    if (card.dept !== undefined || card.paper !== undefined) continue;
    markInitiative(gw, seat, card);
  }
}

/**
 * Marks one desk card as its department's own if a head wrote it, and lays
 * the rival's counter-paper beside it. False: it is the desk's own.
 */
export function markInitiative(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
): boolean {
  const office = initiativeOf(gw, seat, card);
  if (office === null) return false;
  const counter = mark(gw, seat, card, office, deptHead(gw, seat, office)!);
  if (counter !== null) placeCard(gw, seat, counter);
  return true;
}

/** A disloyal head's office lets it out. */
function leak(gw: GreatWar, seat: GwSeatState, head: GwPersonState): void {
  if (head.trust > GW_DEPT_DISLOYAL) return;
  const roll = wwRoll(gw.s.seed, P_LEAK, gw.s.chapter, idHash(head.id));
  if (roll % 100 >= GW_LEAK_PCT) return;
  moveRumour(seat, 1);
  reasonOf(gw, seat, "dept_leak", head.id);
}

/** The department takes its own option on a paper left undecided (대행). */
function actOnOwn(gw: GreatWar, seat: GwSeatState, card: GwCard): void {
  const scene = sceneOf(card.scene);
  if (scene === null) return;
  const m = dept(card);
  writePast(gw, seat, { ...m, scene: card.scene }, "acted");
  if (GW_READ_ONLY_KINDS.includes(scene.kind)) return;
  const ctx = ctxOf(gw, seat, card);
  const open = openOptions(ctx, scene);
  const pick =
    open.find((o) => o.id === m.option) ??
    open.find((o) => o.id === scene.fallback) ??
    open[0];
  if (pick === undefined) return;
  takeOption(ctx, scene, pick, true);
  reasonOf(gw, seat, "dept_acted", m.by);
}

// ---- Desk papers ----

/** A desk paper: the stub scene `gw_paper_<form>` carries it. */
export function paperCard(
  gw: GreatWar,
  paper: GwPaper,
  who: string | null,
): GwCard {
  return {
    uid: gw.s.nextCard++,
    scene: `gw_paper_${paper.form}`,
    variant: "base",
    cast: who === null ? {} : { head: who },
    origin: "summon",
    node: null,
    chapter: gw.s.chapter,
    voice: {},
    mood: 0,
    notes: [],
    folded: [],
    act: null,
    back: null,
    paper,
  };
}

/**
 * Lays a paper on the desk. Not `placeCard`: a paper is no dealt body, so the
 * desk's memory (seen, shown) leaves it out.
 */
export function layPaper(seat: GwSeatState, card: GwCard): void {
  seat.desk.push(card);
}

/** The desk paper `uid` of `form`, or null. */
export function paperOf<F extends GwPaperForm>(
  seat: GwSeatState,
  uid: number,
  form: F,
): (GwCard & { paper: Extract<GwPaper, { form: F }> }) | null {
  const c = seat.desk.find((x) => x.uid === uid);
  return c?.paper?.form === form
    ? (c as GwCard & { paper: Extract<GwPaper, { form: F }> })
    : null;
}

/** Whether `read` may set this card aside: news, a moot stall, no paper. */
export function paperReadable(card: GwCard): boolean {
  const p = card.paper;
  if (p === undefined) return true;
  return p.form === "news" || (p.form === "stall" && p.reason === "moot");
}

/** The office's papers of these forms leave the desk and the holding. */
function dropPapers(
  seat: GwSeatState,
  office: GwOffice,
  forms: readonly GwPaperForm[],
): void {
  const keep = (c: GwCard) =>
    c.paper === undefined ||
    !forms.includes(c.paper.form) ||
    !("office" in c.paper) ||
    c.paper.office !== office;
  seat.desk = seat.desk.filter(keep);
  if (seat.depts !== undefined) seat.depts.tray = seat.depts.tray.filter(keep);
}

// ---- Tasks: offers ----

function rowsOf(seat: GwSeatState): readonly GwTaskRow[] {
  return (gwContent().depts?.tasks ?? []).filter(
    (t) => t.type !== undefined && t.nation.includes(seat.tag),
  );
}

/** The office a common type goes to now: the first in the list with a head. */
function typeOffice(
  gw: GreatWar,
  seat: GwSeatState,
  type: GwTaskType,
): GwOffice | null {
  const list = GW_TASK_OFFICES[seat.tag]?.[type] ?? [];
  return list.find((o) => deptHead(gw, seat, o) !== null) ?? null;
}

/** The answer rows of a seat and type, the seat's own first. */
function answerRowsFor(seat: GwSeatState, type: GwTaskType): GwAnswerRow[] {
  const rows = (gwContent().depts?.answers ?? []).filter(
    (r) => r.type === type && r.nation.includes(seat.tag),
  );
  return [
    ...rows.filter((r) => r.nation.length === 1),
    ...rows.filter((r) => r.nation.length !== 1),
  ];
}

/** The answer rows that hold for this task now. */
function holdingRows(
  gw: GreatWar,
  seat: GwSeatState,
  type: GwTaskType,
  office: GwOffice,
  topic: string | null,
  head: GwPersonState,
): GwAnswerRow[] {
  const ctx: SceneCtx = { gw, seat, cast: { head: head.id }, topic };
  return answerRowsFor(seat, type).filter(
    (r) =>
      (r.office === undefined || r.office === office) &&
      (r.topic === undefined || (topic !== null && r.topic.includes(topic))) &&
      (r.stage === undefined || r.stage.includes(stageOf(gw))) &&
      (r.when === undefined || holds(ctx, r.when)),
  );
}

interface Offer {
  key: string;
  row: GwTaskRow | null;
  type: GwTaskType;
}

/** What `office` may be given, before the checks of the moment. */
function offersFor(gw: GreatWar, seat: GwSeatState, office: GwOffice): Offer[] {
  const rows = rowsOf(seat).filter((r) => r.office === office);
  const out: Offer[] = [];
  for (const type of GW_COMMON_TASK_TYPES) {
    const row = rows.find((r) => r.type === type);
    if (row !== undefined) out.push({ key: row.id, row, type });
    else if (typeOffice(gw, seat, type) === office) {
      out.push({ key: type, row: null, type });
    }
  }
  for (const row of rows) {
    if (!GW_COMMON_TASK_TYPES.includes(row.type!)) {
      out.push({ key: row.id, row, type: row.type! });
    }
  }
  return out;
}

function lastGiven(d: GwDeptState, key: string): number | null {
  const at = [
    ...d.tasks.filter((t) => (t.row ?? t.type) === key).map((t) => t.from),
    ...d.past.filter((p) => (p.row ?? p.type) === key).map((p) => p.chapter),
  ];
  return at.length === 0 ? null : Math.max(...at);
}

const SEATS: readonly string[] = ["DEU", "GBR", "FRA", "RUS", "AUH"];

function pickOf(o: Offer) {
  return o.row === null ? GW_TASK_PICK[o.type] : o.row.pick;
}

function topicsOf(gw: GreatWar, seat: GwSeatState, o: Offer): string[] {
  const pick = pickOf(o);
  const from = o.row?.from;
  if (pick === "country") {
    const us = gw.nation(seat.tag);
    const all = gw.s.nations
      .filter((n) => n.tag !== seat.tag && !n.out)
      .filter(
        (n) =>
          from !== undefined ||
          SEATS.includes(n.tag) ||
          n.side === null ||
          (us !== null && (us.atWar.includes(n.tag) || n.side === us.side)),
      )
      .map((n) => n.tag as string);
    return from === undefined ? all : from.filter((x) => all.includes(x));
  }
  if (pick === "front") {
    const open: string[] = ownFronts(gw, seat).map((t) => t.id);
    return from === undefined ? open : from.filter((x) => open.includes(x));
  }
  return [];
}

function offerOpen(
  gw: GreatWar,
  seat: GwSeatState,
  o: Offer,
  head: GwPersonState,
  office: GwOffice,
): boolean {
  const t = o.row;
  if (t?.stage !== undefined && !t.stage.includes(stageOf(gw))) return false;
  const last = lastGiven(deptState(seat), o.key);
  if (last !== null) {
    if (t?.once === true) return false;
    if (gw.s.chapter - last <= (t?.cooldown ?? GW_TASK_COOLDOWN)) return false;
  }
  if (t?.when !== undefined) {
    if (!holds({ gw, seat, cast: { head: head.id } }, t.when)) return false;
  }
  const topics = topicsOf(gw, seat, o);
  // A front task in peace checks the war plans: no front to pick.
  if (pickOf(o) === "country" && topics.length === 0) return false;
  // Only while some answer row of the type could hold.
  const any = topics.length === 0 ? [t?.topic ?? null] : topics;
  return any.some(
    (topic) => holdingRows(gw, seat, o.type, office, topic, head).length > 0,
  );
}

/** What `office` can be given now; empty while it is busy. */
export function taskOffers(
  gw: GreatWar,
  seat: GwSeatState,
  office: GwOffice,
): GwTaskOfferView[] {
  const head = deptHead(gw, seat, office);
  if (head === null || busy(deptState(seat), office)) return [];
  return offersFor(gw, seat, office)
    .filter((o) => offerOpen(gw, seat, o, head, office))
    .map((o) => ({
      row: o.key,
      type: o.type,
      kind: "plan",
      topics: topicsOf(gw, seat, o),
      topic: o.row?.topic ?? null,
    }));
}

/** A fresh task of `type` for `office`. */
function newTask(
  gw: GreatWar,
  office: GwOffice,
  head: GwPersonState,
  type: GwTaskType,
  row: GwTaskRow | null,
  topic: string | null,
): GwDeptTask {
  return {
    office,
    row: row?.id ?? null,
    topic,
    scene: null,
    from: gw.s.chapter,
    due:
      gw.s.chapter + taskChapters(row?.chapters ?? GW_TASK_BASE, head, office),
    by: head.id,
    type,
    stage: "start",
    stall: null,
    staff: null,
    hurried: false,
    question: null,
    redo: null,
    skip: [],
  };
}

/** The `task` order: free, one at a time. */
export function giveTask(
  gw: GreatWar,
  seat: GwSeatState,
  office: GwOffice,
  row: string,
  topic: string | null,
): GwOrderBlock | null {
  const head = deptHead(gw, seat, office);
  if (head === null) return "no_dept";
  const d = deptState(seat);
  if (busy(d, office)) return "dept_busy";
  const offer = taskOffers(gw, seat, office).find((x) => x.row === row);
  if (offer === undefined) return "no_task";
  const picks = offer.topics.length > 0;
  if (picks ? !offer.topics.includes(topic ?? "") : topic !== null) {
    return "no_task";
  }
  const t = taskRow(gwContent().depts, row);
  d.tasks.push(
    newTask(gw, office, head, offer.type, t, picks ? topic : offer.topic),
  );
  return null;
}

// ---- Tasks: the chapter's work ----

/** The topic no longer makes sense: the country is out, the front shut. */
function moot(gw: GreatWar, seat: GwSeatState, t: GwDeptTask): boolean {
  if (t.topic === null) return false;
  const n = gw.s.nations.find((x) => x.tag === t.topic);
  if (n !== undefined) return n.out;
  const th = gw.s.theatres.find((x) => x.id === t.topic);
  if (th !== undefined) return !ownFronts(gw, seat).includes(th);
  return false;
}

/** Why the task stalls this chapter, if it does. */
function stallOf(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwDeptTask,
  head: GwPersonState,
): GwStallReason | null {
  if (moot(gw, seat, t)) return "moot";
  const roll = (r: GwStallReason) =>
    wwRoll(gw.s.seed, P_STALL, gw.s.chapter, idHash(`${t.office}_${r}`)) % 100 <
    GW_STALL_PCT[r];
  if (head.trust <= GW_DEPT_DISLOYAL && roll("disloyal")) return "disloyal";
  const money = gw.nation(seat.tag)?.gauges.money ?? 1;
  const costly = ["money", "arms", "men", "fleet"].includes(t.type ?? "");
  if (costly && money <= 0 && roll("money")) return "money";
  if (rivalOf(gw, seat, t.office, head, null, []) !== null && roll("rival")) {
    return "rival";
  }
  return null;
}

function stageNow(gw: GreatWar, t: GwDeptTask): GwDeptStage {
  const c = gw.s.chapter;
  if (c >= t.due) return "report";
  if (c === t.from) return "start";
  return t.due - c === 1 && c - t.from >= 2 ? "draft" : "inquiry";
}

/** The person beside the head, if still about. */
function staffOf(gw: GreatWar, t: GwDeptTask): GwPersonState | null {
  const id = t.staff ?? null;
  const p = id === null ? null : gw.person(id);
  return p !== null && p.status === "active" ? p : null;
}

/** The band the answer is written at (§2.2, §2.3). */
function workBand(gw: GreatWar, t: GwDeptTask, head: GwPersonState): number {
  const staff = staffOf(gw, t);
  let band = Math.max(
    deptBand(head, t.office),
    staff === null ? 1 : deptBand(staff, t.office),
  );
  if (t.question?.q === "money" && t.question.pick === "ample") band++;
  if (t.redo === "more") band++;
  if (t.hurried === true) band--;
  return Math.max(1, Math.min(3, band));
}

/** People the ruler could send: his own, active, not the head. */
function sendable(gw: GreatWar, seat: GwSeatState, head: string): string[] {
  return ownPeople(gw, seat.tag)
    .filter((p) => p.id !== head && p.status === "active")
    .sort((a, b) => b.trust - a.trust || (a.id < b.id ? -1 : 1))
    .slice(0, 4)
    .map((p) => p.id);
}

/** The head's own pick on his question (also its 대행). */
function questionLean(
  gw: GreatWar,
  seat: GwSeatState,
  p: QuestionPaper,
): string | null {
  const head = gw.person(p.by);
  if (head === null || p.picks.length === 0) return null;
  if (p.q === "person") return p.picks[0];
  const { lean } = headLean(seat, p.office, head);
  const far = lean === "bold" || lean === "firm";
  return far ? p.picks[p.picks.length - 1] : p.picks[0];
}

function askQuestion(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwDeptTask,
  head: GwPersonState,
): void {
  const rows = holdingRows(gw, seat, t.type!, t.office, t.topic, head);
  const q = rows.find((r) => r.question !== undefined)?.question;
  if (q === undefined) return;
  const picks =
    q === "person" ? sendable(gw, seat, head.id) : [...GW_QUESTION_PICKS[q]];
  if (picks.length === 0) return;
  t.question = { q, pick: null };
  const paper: QuestionPaper = {
    form: "question",
    office: t.office,
    by: head.id,
    type: t.type!,
    topic: t.topic,
    q,
    picks,
    lean: null,
  };
  paper.lean = questionLean(gw, seat, paper);
  layPaper(seat, paperCard(gw, paper, head.id));
}

/** A ww193 task in a save: its type from its row or its office. */
function oldType(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwDeptTask,
): GwTaskType | undefined {
  const row = t.row === null ? null : taskRow(gwContent().depts, t.row);
  if (row?.type !== undefined) return row.type;
  return GW_COMMON_TASK_TYPES.find((x) => typeOffice(gw, seat, x) === t.office);
}

/** One task's chapter: a stall, a stage, a question, the answer. */
function workTask(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwDeptTask,
  head: GwPersonState,
): boolean {
  const d = deptState(seat);
  const c = gw.s.chapter;
  if ((t.stall ?? null) !== null) {
    const clear =
      wwRoll(gw.s.seed, P_CLEAR, c, idHash(t.office)) % 100 <
      GW_STALL_CLEAR_PCT;
    if (!clear) {
      t.due++;
      return false;
    }
    t.stall = null;
    dropPapers(seat, t.office, ["stall"]);
  } else if (c < t.due && c > t.from) {
    const why = stallOf(gw, seat, t, head);
    if (why !== null) {
      layPaper(
        seat,
        paperCard(
          gw,
          {
            form: "stall",
            office: t.office,
            by: head.id,
            type: t.type!,
            topic: t.topic,
            reason: why,
          },
          head.id,
        ),
      );
      if (why === "moot") {
        d.tasks = d.tasks.filter((x) => x !== t);
        writePast(gw, seat, { ...t, scene: "gw_paper_stall" }, "withdraw");
        return false;
      }
      t.stall = why;
      t.due++;
      return false;
    }
  }
  const stage = stageNow(gw, t);
  const first = t.stage !== stage;
  t.stage = stage;
  if (stage === "report") {
    d.tasks = d.tasks.filter((x) => x !== t);
    dropPapers(seat, t.office, ["question"]);
    const card = answerCard(gw, seat, t, head);
    if (card !== null) layPaper(seat, card);
    leak(gw, seat, head);
  } else if (stage === "inquiry" && first && (t.question ?? null) === null) {
    askQuestion(gw, seat, t, head);
  }
  return true;
}

/** Opens the chapter's work: stages move, questions, stalls, answers, news. */
function workTasks(gw: GreatWar, seat: GwSeatState): void {
  const d = deptState(seat);
  const news: NewsLine[] = [];
  for (const t of [...d.tasks]) {
    const head = deptHead(gw, seat, t.office);
    if (head === null) {
      d.tasks = d.tasks.filter((x) => x !== t);
      continue;
    }
    if (t.type === undefined) {
      // A ww193 save: the task resumes at 조사 as its office's type.
      const type = oldType(gw, seat, t);
      d.tasks = d.tasks.filter((x) => x !== t);
      if (type === undefined) continue;
      const fresh = newTask(gw, t.office, head, type, null, t.topic);
      fresh.from = gw.s.chapter - 1;
      fresh.due = Math.max(t.due, gw.s.chapter + 1);
      fresh.stage = "inquiry";
      fresh.question = { q: "money", pick: null };
      d.tasks.push(fresh);
      continue;
    }
    if (!workTask(gw, seat, t, head)) continue;
    const rows = holdingRows(gw, seat, t.type, t.office, t.topic, head);
    news.push({
      office: t.office,
      by: head.id,
      type: t.type,
      topic: t.topic,
      stage: t.stage ?? "inquiry",
      row: rows[0]?.id ?? null,
      slots: answerSlots(gw.s, seat, t.type, t.topic),
    });
  }
  if (news.length > 0) {
    layPaper(seat, paperCard(gw, { form: "news", lines: news }, null));
  }
}

// ---- The answer (§2.1, §2.2) ----

/** Every finding or course of the rows that hold, the first of an id kept. */
function gather<T extends GwFindingRow | GwCourseRow>(
  ctx: SceneCtx,
  rows: readonly GwAnswerRow[],
  slots: GwSlots,
  part: (r: GwAnswerRow) => readonly T[],
): { row: string; item: T }[] {
  const out: { row: string; item: T }[] = [];
  for (const r of rows) {
    for (const item of part(r)) {
      if (out.some((x) => x.item.id === item.id)) continue;
      if (item.when !== undefined && !holds(ctx, item.when)) continue;
      if (!slotsHold(item.slots, slots)) continue;
      out.push({ row: r.id, item });
    }
  }
  return out;
}

/** The slots of a task with its question's answer. */
function taskSlots(gw: GreatWar, seat: GwSeatState, t: GwDeptTask): GwSlots {
  const slots = answerSlots(gw.s, seat, t.type!, t.topic);
  const q = t.question ?? null;
  const pick = q?.pick ?? null;
  if (q !== null && pick !== null) {
    if (q.q === "money") slots.spend = { kind: "word", value: pick };
    if (q.q === "reach") slots.reach = { kind: "word", value: pick };
    if (q.q === "person") slots.sent = { kind: "person", value: pick };
  }
  return slots;
}

/** Builds the answer card of a task done; null when no row holds. */
function answerCard(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwDeptTask,
  head: GwPersonState,
): GwCard | null {
  const type = t.type!;
  const rows = holdingRows(gw, seat, type, t.office, t.topic, head);
  if (rows.length === 0) return null;
  const slots = taskSlots(gw, seat, t);
  const ctx: SceneCtx = { gw, seat, cast: { head: head.id }, topic: t.topic };
  const band = workBand(gw, t, head);
  const roll = wwRoll(gw.s.seed, P_WRONG, gw.s.chapter, idHash(t.office));
  const found = gather(ctx, rows, slots, (r) => r.findings);
  const rowOf = new Map(found.map((x) => [x.item, x.row]));
  const findings = pickFindings(
    found.map((x) => x.item),
    band,
    roll,
  ).map(({ row, left }) => ({
    row: rowOf.get(row)!,
    id: row.id,
    conf: bandConfidence(band),
    wrong: row.wrong === true,
    left,
    late: false,
  }));
  const all = gather(ctx, rows, slots, (r) => r.courses).filter(
    (x) => !(t.skip ?? []).includes(x.item.id),
  );
  const { lean, picks } = headLean(seat, t.office, head);
  const temper = answerTemper(head.temperament);
  const plain = all.filter((x) => x.item.wait !== true);
  const ownId = courseLeanPick(
    plain.map((x) => x.item),
    lean,
    picks?.[rows[0].id],
  );
  const own = plain.find((x) => x.item.id === ownId) ?? null;
  const chosen = [
    ...(own === null ? [] : [own]),
    ...plain.filter((x) => x !== own),
  ].slice(0, temper.two ? 2 : GW_COURSES_MAX);
  const wait = all.find((x) => x.item.wait === true);
  if (temper.wait && wait !== undefined) chosen.push(wait);
  const disliked = temper.slant
    ? dislikedCourse(
        chosen.filter((x) => x !== own).map((x) => x.item),
        lean,
      )
    : null;
  const courses = chosen.map((x) => ({
    row: x.row,
    id: x.item.id,
    by: t.office,
    who: head.id,
    for: x.item.id !== disliked,
    against: !(temper.slant && x === own),
  }));
  // An opposed rival head adds his own course ("참모본부 안").
  const rival = rivalOf(gw, seat, t.office, head, null, []);
  const sly = head.temperament === "cunning" || head.temperament === "arrogant";
  const omit =
    sly &&
    wwRoll(gw.s.seed, P_OMIT, gw.s.chapter, idHash(t.office)) % 100 <
      GW_OMIT_PCT;
  if (rival !== null && !omit) {
    const rest = plain.filter((x) => !chosen.includes(x));
    const id = courseLeanPick(
      rest.map((x) => x.item),
      headLean(seat, rival.office, rival.head).lean,
    );
    const x = rest.find((y) => y.item.id === id);
    if (x !== undefined) {
      courses.push({
        row: x.row,
        id: x.item.id,
        by: rival.office,
        who: rival.head.id,
        for: true,
        against: true,
      });
    }
  }
  return paperCard(
    gw,
    {
      form: "answer",
      office: t.office,
      by: head.id,
      type,
      topic: t.topic,
      rows: rows.map((r) => r.id),
      slots,
      findings,
      courses,
      own: own?.item.id ?? null,
      band,
      called: false,
      ready: gw.s.chapter,
      row: t.row,
    },
    head.id,
  );
}

/** The course row an answer's course came from. */
function courseRow(row: string, id: string): GwCourseRow | null {
  const r = (gwContent().depts?.answers ?? []).find((x) => x.id === row);
  return r?.courses.find((x) => x.id === id) ?? null;
}

/** A course is taken: its effects, its later papers, its bill. */
function takeCourse(
  gw: GreatWar,
  seat: GwSeatState,
  p: AnswerPaper,
  id: string,
): void {
  const c = p.courses.find((x) => x.id === id);
  const row = c === undefined ? null : courseRow(c.row, c.id);
  if (c === undefined || row === null) return;
  const ctx: SceneCtx = { gw, seat, cast: { head: c.who }, topic: p.topic };
  runEffects(ctx, row.effects);
  seat.memory.push({
    key: `course_${row.id}`,
    who: c.who,
    chapter: gw.s.chapter,
    weight: 0,
  });
  (row.then ?? []).forEach((scene, i) => {
    seat.scheduled.push({
      scene,
      chapter: gw.s.chapter + (row.thenAfter ?? GW_THEN_AFTER) + i,
      who: c.who,
    });
  });
  for (const need of row.needs ?? []) {
    if (need.kind !== "bill" || need.law === undefined) continue;
    const draft = lawDraftCard(gw, seat, need.law, c.who);
    if (draft !== null) placeCard(gw, seat, draft);
  }
}

/** A rival whose course lost remembers it: he presses to be seen. */
function noteLost(
  gw: GreatWar,
  seat: GwSeatState,
  p: AnswerPaper,
  taken: string,
): void {
  for (const c of p.courses) {
    if (c.id === taken || c.by === p.office) continue;
    seat.memory.push({
      key: "course_lost",
      who: c.who,
      chapter: gw.s.chapter,
      weight: -1,
    });
  }
}

/** A head overruled is remembered; a proud one loses trust. */
function overruled(gw: GreatWar, seat: GwSeatState, by: string): void {
  const head = gw.person(by);
  if (head === null) return;
  seat.memory.push({
    key: "dept_overruled",
    who: by,
    chapter: gw.s.chapter,
    weight: -1,
  });
  if (head.pride < GW_PROUD) return;
  head.trust = clampTrust(head.trust - 1);
  reasonOf(gw, seat, "dept_overruled", head.id);
}

/** The `answer` order: a course, or 더 알아봐라 / 다른 안을 가져와라. */
export function answerPaper(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
  course: string | null,
  redo: GwAnswerRedo | null,
): GwOrderBlock | null {
  const card = paperOf(seat, uid, "answer");
  if (card === null) return "no_card";
  const p = card.paper;
  if ((course === null) === (redo === null)) return "no_option";
  if (course !== null) {
    if (!p.courses.some((c) => c.id === course)) return "no_option";
    removeCard(seat, uid);
    takeCourse(gw, seat, p, course);
    const verdict: GwVerdict =
      p.own === null || p.own === course ? "accept" : "overrule";
    writePast(gw, seat, { ...p, scene: card.scene, course }, verdict);
    noteLost(gw, seat, p, course);
    if (verdict === "overrule") overruled(gw, seat, p.by);
    return null;
  }
  const head = deptHead(gw, seat, p.office);
  if (head === null) return "no_dept";
  if (busy(deptState(seat), p.office)) return "dept_busy";
  removeCard(seat, uid);
  writePast(gw, seat, { ...p, scene: card.scene }, "redo");
  const row = p.row === null ? null : taskRow(gwContent().depts, p.row);
  const t = newTask(gw, p.office, head, p.type, row, p.topic);
  t.from = gw.s.chapter - 1;
  t.due = gw.s.chapter + 1;
  t.stage = "inquiry";
  t.question = { q: "money", pick: null };
  t.redo = redo;
  t.skip = redo === "other" ? p.courses.map((c) => c.id) : [];
  deptState(seat).tasks.push(t);
  return null;
}

/** The `dept_reply` order: the question back answered. */
export function replyQuestion(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
  pick: string,
): GwOrderBlock | null {
  const card = paperOf(seat, uid, "question");
  if (card === null) return "no_card";
  if (!card.paper.picks.includes(pick)) return "no_option";
  removeCard(seat, uid);
  const t = deptState(seat).tasks.find((x) => x.office === card.paper.office);
  const asked = t?.question ?? null;
  if (asked !== null) asked.pick = pick;
  if (t !== undefined && card.paper.q === "person") t.staff = pick;
  return null;
}

/** The `call` order: 불러서 묻는다, the head of an answer comes in. */
export function callHead(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
): GwOrderBlock | null {
  const card = paperOf(seat, uid, "answer");
  if (card === null) return "no_card";
  const p = card.paper;
  if (p.called) return "called";
  const away = roomShut(gw, seat);
  const free = away && GW_TRIP_BRIEFERS.includes(p.office);
  if (away && !free) return "room_shut";
  if (!spendTime(seat, free ? 0 : GW_TIME_PRICES.call, "audiences")) {
    return "no_audience";
  }
  p.called = true;
  // What he left out comes now; a wrong finding he never knew was wrong.
  for (const f of p.findings) {
    if (!f.left || f.wrong) continue;
    f.left = false;
    f.late = true;
  }
  // One confidence word up: the least sure first.
  const order = ["heard", "mostly", "sure"];
  const low = p.findings
    .filter((f) => !f.left && f.conf !== "sure")
    .sort((a, b) => order.indexOf(a.conf) - order.indexOf(b.conf))[0];
  if (low !== undefined) low.conf = surer(low.conf);
  return null;
}

/** The `task_push` order: 서두르게 한다, 사람을 붙인다, 거둔다, 기다린다. */
export function pushTask(
  gw: GreatWar,
  seat: GwSeatState,
  office: GwOffice,
  how: GwTaskPush,
  person: string | null,
): GwOrderBlock | null {
  const d = deptState(seat);
  const t = d.tasks.find((x) => x.office === office);
  if (t === undefined || t.type === undefined) return "no_task";
  const head = deptHead(gw, seat, office);
  if (head === null) return "no_dept";
  switch (how) {
    case "hurry":
    case "money": {
      if (how === "money" && (t.stall ?? null) === null) return "no_push";
      if ((gw.nation(seat.tag)?.gauges.money ?? 0) <= 0) return "no_push";
      moveGauge(gw, seat.tag, "money", -GW_HURRY_MONEY, "dept_hurried");
      t.hurried = true;
      t.stall = null;
      t.due = Math.max(gw.s.chapter + 1, t.due - 1);
      dropPapers(seat, office, ["stall"]);
      return null;
    }
    case "staff": {
      const p = person === null ? null : gw.person(person);
      if (p === null || p.status !== "active" || p.id === head.id) {
        return "no_person";
      }
      if (personDef(p.id)?.tag !== seat.tag || p.id === seatPerson(seat)) {
        return "no_person";
      }
      t.staff = p.id;
      t.stall = null;
      if (head.pride >= GW_PROUD) {
        head.pride = Math.max(0, head.pride - 1);
        reasonOf(gw, seat, "dept_staffed", head.id);
      }
      dropPapers(seat, office, ["stall"]);
      return null;
    }
    case "withdraw":
      d.tasks = d.tasks.filter((x) => x !== t);
      dropPapers(seat, office, ["stall", "question"]);
      writePast(gw, seat, { ...t, scene: "gw_paper_stall" }, "withdraw");
      return null;
    case "wait":
      if ((t.stall ?? null) === null) return "no_push";
      dropPapers(seat, office, ["stall"]);
      return null;
  }
}

// ---- Verdicts on the department's own papers ----

/** A department card on the desk, decided by `choose`: accepted or overruled. */
export function deptChosen(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  option: string,
): void {
  if (card.dept === undefined) return;
  const own = card.dept.option;
  const verdict: GwVerdict =
    own === null || own === option ? "accept" : "overrule";
  writePast(gw, seat, { ...card.dept, scene: card.scene }, verdict);
  if (verdict !== "overrule" || card.dept.counter) return;
  overruled(gw, seat, card.dept.by);
}

/** A department report read. */
export function deptRead(gw: GreatWar, seat: GwSeatState, card: GwCard): void {
  if (card.dept !== undefined) {
    writePast(gw, seat, { ...card.dept, scene: card.scene }, "accept");
  }
}

/**
 * A department paper sent back (today's 다시 써 오시오): `sendBack` has
 * queued it for the desk; the verdict goes on the department's record.
 */
export function deptSentBack(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
): void {
  if (card.dept === undefined) return;
  writePast(gw, seat, { ...card.dept, scene: card.scene }, "send_back");
}

interface DeskWork {
  office: GwOffice;
  by: string;
  row: string | null;
  topic: string | null;
  type?: GwTaskType;
}

function deskWork(seat: GwSeatState, uid: number): DeskWork | null {
  const c = seat.desk.find((x) => x.uid === uid);
  if (c === undefined) return null;
  if (c.paper?.form === "answer") return c.paper;
  return c.dept ?? null;
}

/** The `pass_on` order: 다른 부서에 맡긴다. The work starts again there. */
export function passOn(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
  office: GwOffice,
): GwOrderBlock | null {
  const m = deskWork(seat, uid);
  if (m === null) return "no_card";
  if (m.office === office) return "no_dept";
  const head = deptHead(gw, seat, office);
  if (head === null) return "no_dept";
  const d = deptState(seat);
  if (busy(d, office)) return "dept_busy";
  const card = seat.desk.find((x) => x.uid === uid)!;
  const type =
    m.type ??
    GW_COMMON_TASK_TYPES.find((x) => typeOffice(gw, seat, x) === office);
  removeCard(seat, uid);
  writePast(gw, seat, { ...m, scene: card.scene }, "pass_on");
  const first = gw.person(m.by);
  if (first !== null) {
    first.pride = Math.max(0, first.pride - 1);
    reasonOf(gw, seat, "dept_passed", first.id);
  }
  if (type === undefined) return null;
  const row = m.row === null ? null : taskRow(gwContent().depts, m.row);
  d.tasks.push(newTask(gw, office, head, type, row, m.topic));
  return null;
}

/** The `shelve` order: 묵혀 둔다. Nothing is taken; the paper is set aside. */
export function shelvePaper(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
): GwOrderBlock | null {
  const m = deskWork(seat, uid);
  if (m === null) return "no_card";
  const card = seat.desk.find((x) => x.uid === uid)!;
  removeCard(seat, uid);
  // ww193 merge: a bill's draft set aside leaves the bill idle again.
  lawDropDraft(gw, seat, card.scene);
  writePast(gw, seat, { ...m, scene: card.scene }, "shelve");
  reasonOf(gw, seat, "dept_shelved", m.by);
  return null;
}

/** ww196 §5: briefings are gone; everything comes to the desk. */
export function briefDept(): GwOrderBlock | null {
  return "gone";
}

/** ww196 §5: gifts are gone from the audience; honours have their occasions. */
export function giveGift(): GwOrderBlock | null {
  return "gone";
}

// ---- The audience room (§2.7) ----

/**
 * Who presses to be seen: a proud head overruled GW_PRESS_OVERRULED times in
 * the last four chapters, a rival whose course lost last chapter.
 */
function pressing(gw: GreatWar, seat: GwSeatState): string[] {
  const c = gw.s.chapter;
  const out = new Set<string>();
  const count = new Map<string, number>();
  for (const m of seat.memory) {
    if (m.who === null || c - m.chapter > 4) continue;
    if (m.key === "dept_overruled") {
      count.set(m.who, (count.get(m.who) ?? 0) + 1);
    }
    if (m.key === "course_lost" && c - m.chapter <= 1) out.add(m.who);
  }
  for (const [who, n] of count) {
    const p = gw.person(who);
    if (p !== null && p.pride >= GW_PROUD && n >= GW_PRESS_OVERRULED) {
      out.add(who);
    }
  }
  return [...out].filter((id) => gw.person(id)?.status === "active");
}

/** People waiting with something to ask: up to GW_PETITIONERS_MAX, seeded. */
function petitioners(gw: GreatWar, seat: GwSeatState): string[] {
  const heads = new Set(
    deptOffices(gw, seat).map((o) => deptHead(gw, seat, o)!.id),
  );
  const roll = (id: string) =>
    wwRoll(gw.s.seed, P_ROOM, gw.s.chapter, idHash(id));
  const press = pressing(gw, seat);
  return ownPeople(gw, seat.tag)
    .filter((p) => press.includes(p.id) || !heads.has(p.id))
    .filter((p) => openTopics(gw, seat, p.id).length > 0)
    .map((p) => p.id)
    .sort(
      (a, b) =>
        Number(press.includes(b)) - Number(press.includes(a)) ||
        roll(a) - roll(b) ||
        (a < b ? -1 : 1),
    )
    .slice(0, GW_PETITIONERS_MAX);
}

/** A petitioner leaves unheard: only the proud remember it. */
function unheard(gw: GreatWar, seat: GwSeatState, id: string): void {
  const p = gw.person(id);
  if (p === null || p.pride < GW_PROUD) return;
  p.memory.push({
    key: "petition_unheard",
    who: null,
    chapter: gw.s.chapter,
    weight: -1,
  });
  reasonOf(gw, seat, "petition_unheard", id);
}

/** Whether `id` waits in the room this chapter as a petitioner. */
export function isPetitioner(seat: GwSeatState, id: string): boolean {
  return (seat.depts?.waiting ?? []).includes(id);
}

/** A petitioner was seen (a summons): he is off the waiting list. */
export function petitionerSeen(seat: GwSeatState, id: string): void {
  const d = seat.depts;
  if (d !== undefined) d.waiting = d.waiting.filter((x) => x !== id);
}

/** The room is shut: the ruler is away on a trip this chapter. */
export function roomShut(gw: GreatWar, seat: GwSeatState): boolean {
  return seat.depts?.away === gw.s.chapter;
}

/** The `turn_away` order: 돌려보낸다. */
export function turnAway(
  gw: GreatWar,
  seat: GwSeatState,
  person: string,
): GwOrderBlock | null {
  const d = deptState(seat);
  if (d.waiting.includes(person)) {
    d.waiting = d.waiting.filter((x) => x !== person);
    unheard(gw, seat, person);
    return null;
  }
  const head = deptOffices(gw, seat).some(
    (o) => deptHead(gw, seat, o)?.id === person,
  );
  return head ? null : "no_person";
}

/** A trip: the room shuts this chapter. Papers come to the desk as ever. */
export function goAway(gw: GreatWar, seat: GwSeatState): void {
  deptState(seat).away = gw.s.chapter;
}

// ---- The chapter ----

/** Time carried into a chapter now opening. */
export function carriedTime(seat: GwSeatState): number {
  return seat.depts?.carry ?? 0;
}

/**
 * Opens the chapter for the departments: the papers held over come back to
 * the desk (a ww193 save's tray too), the work moves, the room fills.
 */
export function openDepts(gw: GreatWar, seat: GwSeatState): void {
  const d = deptState(seat);
  d.heard = [];
  d.gifts = [];
  const held = d.tray;
  d.tray = [];
  for (const c of held) {
    if (c.dept !== undefined) c.dept.heard = true;
    seat.desk.push(c);
  }
  workTasks(gw, seat);
  d.waiting = petitioners(gw, seat);
}

/** A question left unanswered: the head picks by his lean. */
function questionLapses(gw: GreatWar, seat: GwSeatState, p: QuestionPaper) {
  const t = deptState(seat).tasks.find((x) => x.office === p.office);
  const pick = p.lean ?? questionLean(gw, seat, p);
  const asked = t?.question ?? null;
  if (t === undefined || asked === null || pick === null) return;
  asked.pick = pick;
  if (p.q === "person") t.staff = pick;
}

/** An answer unheard GW_ANSWER_WAIT chapters: the department's course (대행). */
function answerLapses(gw: GreatWar, seat: GwSeatState, c: GwCard): boolean {
  const p = c.paper as AnswerPaper;
  if (gw.s.chapter - p.ready < GW_ANSWER_WAIT - 1) return false;
  const own = p.own ?? p.courses[0]?.id ?? null;
  if (own !== null) takeCourse(gw, seat, p, own);
  writePast(gw, seat, { ...p, scene: c.scene, course: own }, "acted");
  reasonOf(gw, seat, "dept_acted", p.by);
  return true;
}

/**
 * Closes the chapter for the departments, before the open cards take their
 * fallback: questions get the head's pick, answers wait or are acted on,
 * the department's own papers take its option (대행), live stall papers and
 * the honours wait, news goes; petitioners left unseen go; up to
 * GW_TIME_CARRY time carries.
 */
export function closeDepts(gw: GreatWar, seat: GwSeatState): void {
  const d = deptState(seat);
  for (const c of [...seat.desk]) {
    const p = c.paper;
    if (p === undefined) {
      if (c.dept === undefined) continue;
      removeCard(seat, c.uid);
      actOnOwn(gw, seat, c);
      continue;
    }
    removeCard(seat, c.uid);
    switch (p.form) {
      case "question":
        questionLapses(gw, seat, p);
        break;
      case "answer":
        if (!answerLapses(gw, seat, c)) d.tray.push(c);
        break;
      case "stall":
        if (p.reason !== "moot" && busy(d, p.office)) d.tray.push(c);
        break;
      case "honours":
      case "petition":
        d.tray.push(c);
        break;
      case "news":
        break;
    }
  }
  for (const id of d.waiting) unheard(gw, seat, id);
  d.waiting = [];
  d.carry = Math.min(GW_TIME_CARRY, timeLeft(seat));
}

// ---- The view ----

function wantsOf(
  gw: GreatWar,
  seat: GwSeatState,
  head: GwPersonState | null,
  fits: (w: { office?: GwOffice; person?: string }) => boolean,
): string[] {
  const out: string[] = [];
  for (const w of gwContent().depts?.wants ?? []) {
    if (!w.nation.includes(seat.tag) || !fits(w)) continue;
    const cast: Record<string, string> = head === null ? {} : { head: head.id };
    if (w.when !== undefined && !holds({ gw, seat, cast }, w.when)) continue;
    const filed =
      head !== null && (seat.house?.files ?? []).some((f) => f.who === head.id);
    const hides = head?.temperament === "cunning" && !filed;
    out.push(hides && w.cover !== undefined ? w.cover : w.id);
    if (out.length >= 3) break;
  }
  return out;
}

/** The 할 일 markers of a department (§2.8). */
function todoOf(
  gw: GreatWar,
  seat: GwSeatState,
  office: GwOffice,
  head: string,
): GwTodoView[] {
  const out: GwTodoView[] = [];
  for (const c of seat.desk) {
    const p = c.paper;
    if (p === undefined || !("office" in p) || p.office !== office) continue;
    if (p.form === "question") out.push({ kind: "question", card: c.uid });
    if (p.form === "stall" && p.reason !== "moot") {
      out.push({ kind: "stall", reason: p.reason, card: c.uid });
    }
    if (p.form === "answer") {
      out.push({ kind: "answer", card: c.uid });
      if (!p.called) out.push({ kind: "callable", card: c.uid });
    }
  }
  const t = seat.depts?.tasks.find((x) => x.office === office);
  const stall = t?.stall ?? null;
  if (stall !== null && !out.some((x) => x.kind === "stall")) {
    out.push({ kind: "stall", reason: stall });
  }
  if ((seat.depts?.waiting ?? []).includes(head)) out.push({ kind: "asks" });
  if (t === undefined && taskOffers(gw, seat, office).length > 0) {
    out.push({ kind: "idle" });
  }
  return out;
}

/** The 사람 tab badge: markers not idle, departments' and petitioners'. */
export function todoCount(gw: GreatWar, seat: GwSeatState): number {
  if (seat.depts === undefined) return 0;
  const offices = deptOffices(gw, seat);
  const heads = offices.map((o) => deptHead(gw, seat, o)!.id);
  const marks = offices.flatMap((o, i) =>
    todoOf(gw, seat, o, heads[i]).filter((x) => x.kind !== "idle"),
  );
  const asking = seat.depts.waiting.filter((id) => !heads.includes(id));
  return marks.length + asking.length;
}

/** A person row's markers: a head's department's, a petitioner's. */
export function personTodo(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
): GwTodoView[] {
  if (seat.depts === undefined) return [];
  const office = deptOffices(gw, seat).find(
    (o) => deptHead(gw, seat, o)?.id === id,
  );
  if (office !== undefined) return todoOf(gw, seat, office, id);
  return seat.depts.waiting.includes(id) ? [{ kind: "asks" }] : [];
}

export function deptViews(
  gw: GreatWar,
  seat: GwSeatState,
  dateOf: (chapter: number) => string,
): GwDeptView[] {
  const d = seat.depts ?? gwDeptStart();
  return deptOffices(gw, seat).map((office) => {
    const head = deptHead(gw, seat, office)!;
    const t = d.tasks.find((x) => x.office === office) ?? null;
    return {
      office,
      head: head.id,
      voice: [head.id, office, head.temperament],
      task:
        t === null
          ? null
          : {
              row: t.row,
              type: t.type ?? null,
              topic: t.topic,
              stage: t.stage ?? "inquiry",
              soon: t.due <= gw.s.chapter + 1,
              stall: t.stall ?? null,
              staff: t.staff ?? null,
              hurried: t.hurried === true,
              pushes: ["hurry", "staff", "withdraw"],
            },
      ready: 0,
      initiatives: 0,
      want: wantsOf(gw, seat, head, (w) => w.office === office)[0] ?? null,
      offers: seat.depts === undefined ? [] : taskOffers(gw, seat, office),
      price: 0,
      past: d.past
        .filter((p) => p.office === office)
        .slice(-5)
        .map((p) => ({
          row: p.row,
          topic: p.topic,
          scene: p.scene,
          verdict: p.verdict,
          date: dateOf(p.chapter),
          ...(p.type === undefined ? {} : { type: p.type }),
          ...(p.course === undefined ? {} : { course: p.course }),
        })),
      todo: seat.depts === undefined ? [] : todoOf(gw, seat, office, head.id),
    };
  });
}

export function roomView(gw: GreatWar, seat: GwSeatState): GwRoomRowView[] {
  const d = seat.depts;
  if (d === undefined) return [];
  const away = roomShut(gw, seat);
  const calls: GwRoomRowView[] = seat.desk.flatMap((c) => {
    const p = c.paper;
    if (p?.form !== "answer" || p.called) return [];
    const free = away && GW_TRIP_BRIEFERS.includes(p.office);
    if (away && !free) return [];
    return [
      {
        person: p.by,
        office: p.office,
        brings: 0,
        petition: false,
        call: c.uid,
        ...(free ? { free: true } : {}),
      },
    ];
  });
  if (away) return calls;
  const press = pressing(gw, seat);
  const asking: GwRoomRowView[] = d.waiting.flatMap((id) => {
    const topic = openTopics(gw, seat, id)[0];
    if (topic === undefined) return [];
    const p = gw.person(id);
    const wants = wantsOf(gw, seat, p, (w) => w.person === id);
    return [
      {
        person: id,
        office: p?.office ?? null,
        brings: 0,
        petition: true,
        topic,
        want: wants[0] ?? null,
        wants,
        ...(press.includes(id) ? { press: true } : {}),
      },
    ];
  });
  return [...calls, ...asking];
}

export function cardDeptView(
  gw: GreatWar,
  c: GwCard,
): GwCardDeptView | undefined {
  const m = c.dept;
  if (m === undefined) return undefined;
  const scene = sceneOf(c.scene);
  return {
    office: m.office,
    by: m.by,
    option: m.option,
    confidence: m.band,
    rival: m.rival,
    counter: m.counter,
    initiative: m.row === null,
    row: m.row,
    topic: m.topic,
    stamp: scene?.kind === "report" ? bandStamp(m.band) : null,
    waited: gw.s.chapter - m.ready,
  };
}

/** A desk paper as the seat sees it: what the head left out stays hidden. */
export function paperView(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwCard,
): GwPaperView | undefined {
  const p = c.paper;
  if (p === undefined) return undefined;
  switch (p.form) {
    case "answer":
      return {
        form: "answer",
        office: p.office,
        by: p.by,
        type: p.type,
        topic: p.topic,
        rows: p.rows,
        slots: p.slots,
        findings: p.findings
          .filter((f) => !f.left)
          .map((f) => ({
            row: f.row,
            id: f.id,
            conf: f.conf,
            ...(f.late ? { late: true } : {}),
          })),
        courses: p.courses.map((x) => ({
          row: x.row,
          id: x.id,
          by: x.by,
          own: x.id === p.own,
          for: x.for,
          against: x.against,
          needs: courseRow(x.row, x.id)?.needs ?? [],
        })),
        called: p.called,
        waited: gw.s.chapter - p.ready,
        redo: busy(deptState(seat), p.office) ? [] : ["more", "other"],
      };
    case "question":
      return { ...p };
    case "stall":
      return {
        ...p,
        pushes:
          p.reason === "moot" ? [] : ["money", "staff", "wait", "withdraw"],
      };
    case "news":
      return { form: "news", lines: p.lines };
    case "honours":
      return {
        form: "honours",
        row: p.row,
        until: p.until,
        entries: p.entries,
        orders: p.orders,
      };
    case "petition":
      return {
        form: "petition",
        office: p.office,
        by: p.by,
        person: p.person,
        honour: p.honour,
        answers: ["accept", "next", "refuse"],
      };
  }
}

export function timeView(gw: GreatWar, seat: GwSeatState): GwTimeView {
  return {
    left: timeLeft(seat),
    away: roomShut(gw, seat),
    carry: seat.depts?.carry ?? 0,
  };
}

/** ww196 §5: gifts are gone. */
export function leverViews(): GwLeverView[] {
  return [];
}
