// Great War 1914 (ww193): departments at work. Each office the seat's own
// people hold is a department. The ruler commissions work (a task row); when
// it is done the department's head brings the first of the row's papers that
// holds, else a common report. Office-authored papers the desk would draw go
// to the head's in-tray as the department's own initiatives. A briefing lays
// all one head brings on the desk for one of the time; unheard for two
// chapters, the department takes its own option (대행). Rows: GwDepts.ts;
// rules: engine-lib TaskRows.ts. AI countries have none of this.
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
  GwPersonState,
  GwSeatState,
  GwVerdict,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwCardDeptView,
  GwDeptView,
  GwLeverRow,
  GwLeverView,
  GwRoomRowView,
  GwTaskOfferView,
  GwTaskRow,
  GwTimeView,
} from "@openfront/engine-api/ww1914/GwDepts";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import {
  GW_READ_ONLY_KINDS,
  GwOption,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { gwMemoryKeys } from "@openfront/engine-lib/ww1914/AskIndex";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  bandStamp,
  campsOpposed,
  deptBand,
  GW_DEPT_DISLOYAL,
  GW_DEPT_LEAN_DEFAULT,
  GW_INITIATIVES_BUSY,
  GW_INITIATIVES_IDLE,
  GW_LEAK_PCT,
  GW_NOT_DEPTS,
  GW_OMIT_PCT,
  GW_PETITIONERS_MAX,
  GW_PROUD,
  GW_TASK_COOLDOWN,
  GW_TIME_CARRY,
  GW_TIME_PRICES,
  GW_TRAY_MAX,
  GW_TRAY_WAIT,
  GW_TRIP_BRIEFERS,
  leanPick,
  leanRow,
  productFitsTopic,
  spendsMoney,
  taskChapters,
  taskRow,
  taskRowsFor,
} from "@openfront/engine-lib/ww1914/TaskRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  bodyId,
  DeskCandidate,
  GW_SALIENCE_MUST,
  inStage,
  makeCard,
  repeatable,
  repeatCap,
  timesDealt,
} from "./Desk";
import type { GreatWar } from "./GreatWar";
import { lawDraftable, lawDraftCard, lawDropDraft } from "./Laws";
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
import { ownPeople, reasonOf, seatPerson, stageOf } from "./World";

const P_LEAK = idHash("gw_dept_leak");
const P_OMIT = idHash("gw_dept_omit");
const P_ROOM = idHash("gw_dept_room");

/** Report sources from abroad: those reports stay on the desk. */
const ABROAD = /^(embassy_|attache$|agents$|envoy$|codes$|prisoners$)/;
/** Papers that stay on the desk whoever wrote them. */
const DESK_KINDS = ["crisis", "ledger", "letter", "talk", "wire"];

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

/** The tray's papers a briefing of `office` brings: his own and counters to them. */
function trayOf(d: GwDeptState, office: GwOffice): GwCard[] {
  return d.tray.filter(
    (c) =>
      dept(c).office === office ||
      (dept(c).counter && dept(c).rival?.office === office),
  );
}

function busy(d: GwDeptState, office: GwOffice): boolean {
  return d.tasks.some((t) => t.office === office);
}

function clampTrust(v: number): number {
  return Math.max(GW_TRUST_MIN, Math.min(GW_TRUST_MAX, v));
}

function writePast(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  verdict: GwVerdict,
): void {
  const m = dept(card);
  deptState(seat).past.push({
    office: m.office,
    row: m.row,
    topic: m.topic,
    scene: card.scene,
    chapter: gw.s.chapter,
    verdict,
  });
  if (m.row !== null && verdict !== "shelve" && verdict !== "pass_on") {
    // Later papers can read that the work was done: `memory task_<row>`.
    seat.memory.push({
      key: `task_${m.row}`,
      who: null,
      chapter: gw.s.chapter,
      weight: 0,
    });
  }
}

// ---- What a paper becomes in a department's hands ----

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
  gw: GreatWar,
  seat: GwSeatState,
  office: GwOffice,
  head: GwPersonState,
  scene: GwScene,
  open: readonly GwOption[],
): string | null {
  const camps = personDef(head.id)?.camps ?? [];
  const row = leanRow(gwContent().depts, seat.tag, office, camps);
  const lean = row?.lean ?? GW_DEPT_LEAN_DEFAULT[office];
  return leanPick(open, lean, row?.picks?.[scene.id]);
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

/** The rival department that comes with this paper, if any. */
function rivalOf(
  gw: GreatWar,
  seat: GwSeatState,
  office: GwOffice,
  head: GwPersonState,
  scene: GwScene,
  open: readonly GwOption[],
): { office: GwOffice; head: GwPersonState; counter: string | null } | null {
  for (const r of gwContent().depts?.rivals ?? []) {
    if (r.office !== office) continue;
    if (r.papers !== undefined && !r.papers.includes(scene.id)) continue;
    if (r.tags !== undefined && !r.tags.some((t) => scene.tags.includes(t))) {
      continue;
    }
    if (r.cost === true && !open.some(spendsMoney)) continue;
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

function inTray(seat: GwSeatState, scene: string): boolean {
  return (seat.depts?.tray ?? []).some((c) => c.scene === scene);
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
    if (inTray(seat, x.id) || seat.desk.some((c) => c.scene === x.id)) continue;
    if (!inStage(gw, x) || !repeatable(gw, seat, x)) continue;
    const cast = castOf(gw, seat, x);
    if (cast !== null && sceneHolds({ gw, seat, cast }, x)) return x;
  }
  return null;
}

/** Marks `card` as `office`'s, and brings the rival's counter-paper if any. */
function mark(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  office: GwOffice,
  head: GwPersonState,
  row: string | null,
  topic: string | null,
): GwCard[] {
  const scene = sceneOf(card.scene)!;
  const band = deptBand(head, office);
  const base: SceneCtx = { gw, seat, cast: card.cast, card };
  const keys = bandKeys(base, scene, band);
  const ctx = { ...base, assume: new Set(keys) };
  const open = openOptions(ctx, scene);
  const option = leanOption(gw, seat, office, head, scene, open);
  let rival = rivalOf(gw, seat, office, head, scene, open);
  // A cunning or arrogant head keeps the other side's option out at times.
  const sly = head.temperament === "cunning" || head.temperament === "arrogant";
  const roll = wwRoll(gw.s.seed, P_OMIT, gw.s.chapter, idHash(card.scene));
  if (rival !== null && sly && roll % 100 < GW_OMIT_PCT) rival = null;
  const theirs =
    rival === null
      ? null
      : leanOption(
          gw,
          seat,
          rival.office,
          rival.head,
          scene,
          open.filter((o) => o.id !== option),
        );
  card.dept = {
    office,
    by: head.id,
    row,
    topic,
    ready: gw.s.chapter,
    keys,
    band,
    option,
    rival:
      rival === null
        ? null
        : { office: rival.office, by: rival.head.id, option: theirs },
    counter: false,
    heard: false,
  };
  const out = [card];
  if (rival === null) return out;
  const x = disputeFor(gw, seat, office, rival.office, rival.counter);
  const c = x === null ? null : makeCard(gw, seat, x, "summon");
  if (x === null || c === null) return out;
  const xctx: SceneCtx = { gw, seat, cast: c.cast, card: c };
  c.dept = {
    office: rival.office,
    by: rival.head.id,
    row: null,
    topic,
    ready: gw.s.chapter,
    keys: [],
    band: deptBand(rival.head, rival.office),
    option: leanOption(
      gw,
      seat,
      rival.office,
      rival.head,
      x,
      openOptions(xctx, x),
    ),
    rival: { office, by: head.id, option: null },
    counter: true,
    heard: false,
  };
  out.push(c);
  return out;
}

/** Into the tray: dealt, as far as the desk's memory goes. */
function file(gw: GreatWar, seat: GwSeatState, cards: readonly GwCard[]): void {
  const d = deptState(seat);
  for (const c of cards) {
    d.tray.push(c);
    seat.seen[c.scene] = gw.s.chapter;
    seat.shown.push(bodyId(c.scene, c.variant));
  }
}

// ---- Commissioned work ----

const GW_CALLED_ONLY = "gw_world_called_only";

/** A paper only its own system calls (`gw_world_called_only`). */
function calledOnly(x: GwScene): boolean {
  return (
    x.when !== undefined &&
    x.when.kind === "flag" &&
    x.when.flag === GW_CALLED_ONLY
  );
}

/**
 * ww193 merge: a called-only product comes only when its system has called
 * it: the department brings it early, off the schedule. Never the crisis's,
 * a must-read or an act's.
 */
function fromSchedule(
  gw: GreatWar,
  seat: GwSeatState,
  x: GwScene,
  head: GwPersonState,
): GwCard | null {
  if (x.essential === true || x.kind === "crisis") return null;
  if (x.salience >= GW_SALIENCE_MUST) return null;
  const i = seat.scheduled.findIndex(
    (q) => q.scene === x.id && (q.act ?? null) === null,
  );
  if (i < 0) return null;
  const q = seat.scheduled[i];
  const card = makeCard(gw, seat, x, "summon", q.who ?? head.id, null, q.back);
  if (card !== null) seat.scheduled.splice(i, 1);
  return card;
}

/**
 * ww193 merge: whether `id` could come as the task's paper now: what
 * product() checks, without making it. A row is offered only while one of
 * its own papers could come, so a commission seldom ends in the fallback.
 */
function productNow(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  head: GwPersonState,
  topic: string | null,
): boolean {
  const x = sceneOf(id);
  if (x === null || x.kind === "talk" || !x.nation.includes(seat.tag)) {
    return false;
  }
  if (!inStage(gw, x) || !repeatable(gw, seat, x)) return false;
  if (timesDealt(seat, id) >= repeatCap(x)) return false;
  if (inTray(seat, id) || seat.desk.some((c) => c.scene === id)) return false;
  if (id.startsWith("gw_law_")) {
    return lawDraftable(gw, seat, id.slice("gw_law_".length));
  }
  if (calledOnly(x)) return seat.scheduled.some((q) => q.scene === id);
  const cast = castOf(gw, seat, x, head.id);
  return cast !== null && sceneHolds({ gw, seat, cast, topic }, x);
}

/**
 * The first of the task's papers that holds now; else its fallback. A law's
 * draft (`gw_law_<id>`) is laid as the country tab's order would (ww193
 * merge), a picked topic narrows the list, and the desk's repeat cap holds.
 */
function product(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwDeptTask,
  head: GwPersonState,
): GwCard | null {
  const row = t.row === null ? null : taskRow(gwContent().depts, t.row);
  const fixed = t.scene !== null;
  const topics = row === null ? [] : topicsOf(gw, seat, row);
  const list =
    t.scene !== null
      ? [t.scene]
      : [
          ...(row?.products ?? []).filter((id) =>
            productFitsTopic(id, t.topic, topics),
          ),
          row?.fallback ?? `gw_dept_${row?.kind}`,
        ];
  for (const [i, id] of list.entries()) {
    const x = sceneOf(id);
    if (x === null || x.kind === "talk" || !x.nation.includes(seat.tag)) {
      continue;
    }
    // The fallback and a paper passed on or sent back come whatever holds.
    const sure = fixed || i === list.length - 1;
    if (!sure && (!inStage(gw, x) || !repeatable(gw, seat, x))) continue;
    if (!sure && timesDealt(seat, id) >= repeatCap(x)) continue;
    if (inTray(seat, id) || seat.desk.some((c) => c.scene === id)) continue;
    if (!sure && id.startsWith("gw_law_")) {
      const draft = lawDraftCard(gw, seat, id.slice("gw_law_".length), head.id);
      if (draft !== null) return draft;
      continue;
    }
    if (!sure && calledOnly(x)) {
      const called = fromSchedule(gw, seat, x, head);
      if (called !== null) return called;
      continue;
    }
    const cast = castOf(gw, seat, x, head.id);
    if (cast === null) continue;
    if (!sure && !sceneHolds({ gw, seat, cast, topic: t.topic }, x)) continue;
    const card = makeCard(
      gw,
      seat,
      x,
      "summon",
      head.id,
      null,
      t.back ?? null,
      t.topic,
    );
    if (card !== null) return card;
  }
  return null;
}

/** Work done this chapter reaches the trays. */
function finishTasks(gw: GreatWar, seat: GwSeatState): void {
  const d = deptState(seat);
  const done = d.tasks.filter((t) => t.due <= gw.s.chapter);
  d.tasks = d.tasks.filter((t) => t.due > gw.s.chapter);
  for (const t of done) {
    const head = deptHead(gw, seat, t.office);
    if (head === null) continue;
    const card = product(gw, seat, t, head);
    if (card === null) continue;
    file(gw, seat, mark(gw, seat, card, t.office, head, t.row, t.topic));
    leak(gw, seat, head);
  }
}

/** A disloyal head's office lets it out. */
function leak(gw: GreatWar, seat: GwSeatState, head: GwPersonState): void {
  if (head.trust > GW_DEPT_DISLOYAL) return;
  const roll = wwRoll(gw.s.seed, P_LEAK, gw.s.chapter, idHash(head.id));
  if (roll % 100 >= GW_LEAK_PCT) return;
  moveRumour(seat, 1);
  reasonOf(gw, seat, "dept_leak", head.id);
}

/** The department acts on a paper nobody heard: its own option, as a proxy. */
function actOnOwn(gw: GreatWar, seat: GwSeatState, card: GwCard): void {
  const scene = sceneOf(card.scene);
  if (scene === null) return;
  writePast(gw, seat, card, "acted");
  if (GW_READ_ONLY_KINDS.includes(scene.kind)) return;
  const ctx = ctxOf(gw, seat, card);
  const open = openOptions(ctx, scene);
  const pick =
    open.find((o) => o.id === dept(card).option) ??
    open.find((o) => o.id === scene.fallback) ??
    open[0];
  if (pick === undefined) return;
  takeOption(ctx, scene, pick, true);
  reasonOf(gw, seat, "dept_acted", dept(card).by);
}

/** Papers unheard for GW_TRAY_WAIT chapters are acted on by the department. */
function lapse(gw: GreatWar, seat: GwSeatState): void {
  const d = deptState(seat);
  const due = d.tray.filter(
    (c) => gw.s.chapter - dept(c).ready >= GW_TRAY_WAIT,
  );
  d.tray = d.tray.filter((c) => !due.includes(c));
  for (const c of due) actOnOwn(gw, seat, c);
}

// ---- The audience room ----

/** People waiting with something to ask: up to GW_PETITIONERS_MAX, seeded. */
function petitioners(gw: GreatWar, seat: GwSeatState): string[] {
  const heads = new Set(
    deptOffices(gw, seat).map((o) => deptHead(gw, seat, o)!.id),
  );
  const roll = (id: string) =>
    wwRoll(gw.s.seed, P_ROOM, gw.s.chapter, idHash(id));
  return ownPeople(gw, seat.tag)
    .filter((p) => !heads.has(p.id))
    .filter((p) => openTopics(gw, seat, p.id).length > 0)
    .map((p) => p.id)
    .sort((a, b) => roll(a) - roll(b) || (a < b ? -1 : 1))
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

// ---- The chapter ----

/** Time carried into a chapter now opening. */
export function carriedTime(seat: GwSeatState): number {
  return seat.depts?.carry ?? 0;
}

/** Opens the chapter for the departments: work done, lapses, the room. */
export function openDepts(gw: GreatWar, seat: GwSeatState): void {
  const d = deptState(seat);
  d.heard = [];
  d.gifts = [];
  finishTasks(gw, seat);
  lapse(gw, seat);
  d.waiting = petitioners(gw, seat);
}

/**
 * Closes the chapter for the departments, before the open cards take their
 * fallback: a briefing the timer cut off leaves its decisions waiting in the
 * tray, petitioners left unseen go, and up to GW_TIME_CARRY time carries.
 */
export function closeDepts(gw: GreatWar, seat: GwSeatState): void {
  const d = seat.depts;
  if (d === undefined) return;
  for (const c of [...seat.desk]) {
    const scene = sceneOf(c.scene);
    if (c.dept === undefined || scene === null) continue;
    if (GW_READ_ONLY_KINDS.includes(scene.kind)) continue;
    removeCard(seat, c.uid);
    c.dept.heard = false;
    d.tray.push(c);
  }
  for (const id of d.waiting) unheard(gw, seat, id);
  d.waiting = [];
  d.carry = Math.min(GW_TIME_CARRY, timeLeft(seat));
}

// ---- Initiatives (the desk's draw) ----

/** The department whose own paper this is, or null when it stays on the desk. */
function initiativeOf(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
  cast: Readonly<Record<string, string>>,
): GwOffice | null {
  if (DESK_KINDS.includes(scene.kind)) return null;
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
  const p = gw.person(cast[role] ?? "");
  if (p === null || p.office === null) return null;
  return deptHead(gw, seat, p.office)?.id === p.id ? p.office : null;
}

/**
 * Takes the department papers out of the desk's candidates into the heads'
 * trays, the best first, a few a head; returns what the desk still draws.
 * Not in the opening or the crisis: those desks are the story's.
 */
export function routeInitiatives(
  gw: GreatWar,
  seat: GwSeatState,
  cands: readonly DeskCandidate[],
): DeskCandidate[] {
  if (inOpening(gw, seat) || stageOf(gw) === "crisis") return [...cands];
  const d = deptState(seat);
  const taken = new Map<GwOffice, number>();
  const routed = new Set<DeskCandidate>();
  const order = [...cands].sort((a, b) => b.score - a.score);
  for (const c of order) {
    const cast = castOf(gw, seat, c.scene);
    if (cast === null) continue;
    const office = initiativeOf(gw, seat, c.scene, cast);
    if (office === null) continue;
    const n = taken.get(office) ?? 0;
    const cap = busy(d, office) ? GW_INITIATIVES_BUSY : GW_INITIATIVES_IDLE;
    if (n >= cap || trayOf(d, office).length >= GW_TRAY_MAX) continue;
    const head = deptHead(gw, seat, office)!;
    const card = makeCard(gw, seat, c.scene, "desk");
    if (card === null) continue;
    file(gw, seat, mark(gw, seat, card, office, head, null, null));
    taken.set(office, n + 1);
    routed.add(c);
  }
  return cands.filter((c) => !routed.has(c));
}

// ---- Orders ----

function lastGiven(d: GwDeptState, row: string): number | null {
  const at = [
    ...d.tasks.filter((t) => t.row === row).map((t) => t.from),
    ...d.tray.filter((c) => dept(c).row === row).map((c) => dept(c).ready),
    ...d.past.filter((p) => p.row === row).map((p) => p.chapter),
  ];
  return at.length === 0 ? null : Math.max(...at);
}

function topicsOf(gw: GreatWar, seat: GwSeatState, t: GwTaskRow): string[] {
  if (t.pick === "country") {
    const all: readonly string[] =
      t.from ?? GW_TAGS.filter((x) => x !== seat.tag);
    return all.filter((x) => gw.s.nations.some((n) => n.tag === x));
  }
  if (t.pick === "front") {
    const open: string[] = gw.s.theatres.filter((x) => x.open).map((x) => x.id);
    return t.from === undefined ? open : t.from.filter((x) => open.includes(x));
  }
  return [];
}

function rowOpen(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwTaskRow,
  head: GwPersonState,
): boolean {
  if (t.stage !== undefined && !t.stage.includes(stageOf(gw))) return false;
  const last = lastGiven(deptState(seat), t.id);
  if (last !== null) {
    if (t.once === true) return false;
    if (gw.s.chapter - last <= (t.cooldown ?? GW_TASK_COOLDOWN)) return false;
  }
  if (t.when !== undefined) {
    if (!holds({ gw, seat, cast: { head: head.id } }, t.when)) return false;
  }
  if (t.pick !== undefined && topicsOf(gw, seat, t).length === 0) return false;
  // ww193 merge: only while one of its own papers could come (a row that
  // names none, as C's fallback-only rows, is always open).
  if (t.products.length === 0) return true;
  const topics = topicsOf(gw, seat, t);
  const any = topics.length === 0 ? [t.topic ?? null] : topics;
  return any.some((topic) =>
    t.products
      .filter((id) => productFitsTopic(id, topic, topics))
      .some((id) => productNow(gw, seat, id, head, topic)),
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
  return taskRowsFor(gwContent().depts, seat.tag, office)
    .filter((t) => rowOpen(gw, seat, t, head))
    .map((t) => ({
      row: t.id,
      kind: t.kind,
      topics: topicsOf(gw, seat, t),
      topic: t.topic ?? null,
    }));
}

function taskPrice(seat: GwSeatState, office: GwOffice): number {
  return deptState(seat).heard.includes(office) ? 0 : GW_TIME_PRICES.task;
}

/** The `task` order. */
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
  if (!spendTime(seat, taskPrice(seat, office), "audiences")) {
    return "no_audience";
  }
  const t = taskRow(gwContent().depts, row)!;
  d.tasks.push({
    office,
    row,
    topic: picks ? topic : offer.topic,
    scene: null,
    from: gw.s.chapter,
    due: gw.s.chapter + taskChapters(t.chapters, head, office),
    by: head.id,
  });
  return null;
}

/** A tray paper on the desk, heard. */
function lay(seat: GwSeatState, c: GwCard): void {
  dept(c).heard = true;
  c.origin = "summon";
  seat.desk.push(c);
}

/** The `brief` order: the head comes in with everything he brings. */
export function briefDept(
  gw: GreatWar,
  seat: GwSeatState,
  office: GwOffice,
): GwOrderBlock | null {
  const head = deptHead(gw, seat, office);
  if (head === null) return "no_dept";
  const away = roomShut(gw, seat);
  const free = away && GW_TRIP_BRIEFERS.includes(office);
  if (away && !free) return "room_shut";
  const d = deptState(seat);
  const cards = trayOf(d, office);
  if (cards.length === 0) return "nothing_ready";
  if (!spendTime(seat, free ? 0 : GW_TIME_PRICES.brief, "audiences")) {
    return "no_audience";
  }
  d.tray = d.tray.filter((c) => !cards.includes(c));
  for (const c of cards) lay(seat, c);
  if (!d.heard.includes(office)) d.heard.push(office);
  return null;
}

/** A trip: the room shuts this chapter and the trays come by wire. */
export function goAway(gw: GreatWar, seat: GwSeatState): void {
  const d = deptState(seat);
  d.away = gw.s.chapter;
  const all = d.tray;
  d.tray = [];
  for (const c of all) lay(seat, c);
}

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
  writePast(gw, seat, card, verdict);
  if (verdict !== "overrule" || card.dept.counter) return;
  const head = gw.person(card.dept.by);
  if (head === null || head.pride < GW_PROUD) return;
  head.trust = clampTrust(head.trust - 1);
  reasonOf(gw, seat, "dept_overruled", head.id);
}

/** A department report read. */
export function deptRead(gw: GreatWar, seat: GwSeatState, card: GwCard): void {
  if (card.dept !== undefined) writePast(gw, seat, card, "accept");
}

/**
 * A department paper sent back (다시 써 오시오): the head takes it back as a
 * task and brings the rewrite to his next briefing. `sendBack` has queued it
 * for the desk; that entry becomes the task.
 */
export function deptSentBack(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
): void {
  if (card.dept === undefined) return;
  const at = seat.scheduled.findIndex(
    (q) => q.scene === card.scene && q.chapter === gw.s.chapter + 1,
  );
  if (at < 0) return;
  const q = seat.scheduled.splice(at, 1)[0];
  writePast(gw, seat, card, "send_back");
  deptState(seat).tasks.push({
    office: card.dept.office,
    row: card.dept.row,
    topic: card.dept.topic,
    scene: card.scene,
    from: gw.s.chapter,
    due: q.chapter,
    by: card.dept.by,
    back: q.back ?? null,
  });
}

function deskDept(seat: GwSeatState, uid: number): GwCard | null {
  const c = seat.desk.find((x) => x.uid === uid);
  return c?.dept === undefined ? null : c;
}

/** The `pass_on` order: 다른 부서에 맡긴다. */
export function passOn(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
  office: GwOffice,
): GwOrderBlock | null {
  const card = deskDept(seat, uid);
  if (card === null) return "no_card";
  const m = dept(card);
  if (m.office === office) return "no_dept";
  const head = deptHead(gw, seat, office);
  if (head === null) return "no_dept";
  const d = deptState(seat);
  if (busy(d, office)) return "dept_busy";
  removeCard(seat, uid);
  writePast(gw, seat, card, "pass_on");
  const first = gw.person(m.by);
  if (first !== null) {
    first.pride = Math.max(0, first.pride - 1);
    reasonOf(gw, seat, "dept_passed", first.id);
  }
  const row = m.row === null ? null : taskRow(gwContent().depts, m.row);
  d.tasks.push({
    office,
    row: m.row,
    topic: m.topic,
    scene: card.scene,
    from: gw.s.chapter,
    due: gw.s.chapter + taskChapters(row?.chapters ?? 1, head, office),
    by: head.id,
  });
  return null;
}

/** The `shelve` order: 묵혀 둔다. Nothing is taken; the paper is set aside. */
export function shelvePaper(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
): GwOrderBlock | null {
  const card = deskDept(seat, uid);
  if (card === null) return "no_card";
  removeCard(seat, uid);
  // ww193 merge: a bill's draft set aside leaves the bill idle again.
  lawDropDraft(gw, seat, card.scene);
  writePast(gw, seat, card, "shelve");
  reasonOf(gw, seat, "dept_shelved", dept(card).by);
  return null;
}

/** People the ruler has met this chapter: heads heard, talks held. */
function metNow(gw: GreatWar, seat: GwSeatState): string[] {
  const out = new Set<string>();
  for (const o of seat.depts?.heard ?? []) {
    const h = deptHead(gw, seat, o);
    if (h !== null) out.add(h.id);
  }
  for (const c of seat.desk) {
    const s = sceneOf(c.scene);
    if (s?.kind === "talk" && s.who !== undefined && c.cast[s.who]) {
      out.add(c.cast[s.who]);
    }
  }
  for (const x of seat.choices) {
    if (x.chapter !== gw.s.chapter || sceneOf(x.scene)?.kind !== "talk") {
      continue;
    }
    for (const id of Object.values(x.cast ?? {})) out.add(id);
  }
  const self = seatPerson(seat);
  return [...out].filter(
    (id) => id !== self && personDef(id)?.tag === seat.tag,
  );
}

function leverRows(seat: GwSeatState): GwLeverRow[] {
  return (gwContent().depts?.levers ?? []).filter((r) =>
    r.nation.includes(seat.tag),
  );
}

function leverFits(
  gw: GreatWar,
  seat: GwSeatState,
  r: GwLeverRow,
  id: string,
): boolean {
  const p = gw.person(id);
  if (p === null || p.status !== "active") return false;
  if (r.people === "cabinet" && p.office === null) return false;
  if (r.once === true && seat.memory.some((m) => m.key === `gift_${r.id}`)) {
    return false;
  }
  return r.when === undefined || holds({ gw, seat, cast: { who: id } }, r.when);
}

/** The `gift` order: a lever to someone met this chapter, one each. */
export function giveGift(
  gw: GreatWar,
  seat: GwSeatState,
  rowId: string,
  person: string,
): GwOrderBlock | null {
  const r = leverRows(seat).find((x) => x.id === rowId);
  if (r === undefined) return "no_gift";
  const d = deptState(seat);
  if (d.gifts.includes(person)) return "gift_given";
  if (!metNow(gw, seat).includes(person) || !leverFits(gw, seat, r, person)) {
    return "no_gift";
  }
  const p = gw.person(person)!;
  d.gifts.push(person);
  seat.memory.push({
    key: `gift_${r.id}`,
    who: person,
    chapter: gw.s.chapter,
    weight: 1,
  });
  p.trust = clampTrust(p.trust + 1);
  runEffects({ gw, seat, cast: { who: person } }, r.effects);
  const rivals = rivalIds(gw, person)
    .map((id) => gw.person(id))
    .filter(
      (x): x is GwPersonState =>
        x !== null &&
        x.status === "active" &&
        personDef(x.id)?.tag === seat.tag,
    );
  for (const x of rivals) x.trust = clampTrust(x.trust - 1);
  if (rivals.length > 0) reasonOf(gw, seat, "gift_rivals", person);
  const x = r.scene === undefined ? null : sceneOf(r.scene);
  const card = x === null ? null : makeCard(gw, seat, x, "summon", person);
  if (card !== null) {
    seat.desk.push(card);
    seat.seen[card.scene] = gw.s.chapter;
    seat.shown.push(bodyId(card.scene, card.variant));
  }
  return null;
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
  // A head sent away keeps his papers: they wait, and the clock runs.
  const head = deptOffices(gw, seat).some(
    (o) => deptHead(gw, seat, o)?.id === person,
  );
  return head ? null : "no_person";
}

// ---- The view ----

function wantOf(
  gw: GreatWar,
  seat: GwSeatState,
  head: GwPersonState | null,
  fits: (w: { office?: GwOffice; person?: string }) => boolean,
): string | null {
  for (const w of gwContent().depts?.wants ?? []) {
    if (!w.nation.includes(seat.tag) || !fits(w)) continue;
    const cast: Record<string, string> = head === null ? {} : { head: head.id };
    if (w.when !== undefined && !holds({ gw, seat, cast }, w.when)) continue;
    const filed =
      head !== null && (seat.house?.files ?? []).some((f) => f.who === head.id);
    const hides = head?.temperament === "cunning" && !filed;
    return hides && w.cover !== undefined ? w.cover : w.id;
  }
  return null;
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
    const tray = d.tray.filter((c) => dept(c).office === office);
    return {
      office,
      head: head.id,
      voice: [head.id, office, head.temperament],
      task:
        t === null
          ? null
          : { row: t.row, topic: t.topic, soon: t.due <= gw.s.chapter + 1 },
      ready: tray.filter((c) => dept(c).row !== null).length,
      initiatives: tray.filter((c) => dept(c).row === null).length,
      want: wantOf(gw, seat, head, (w) => w.office === office),
      offers: seat.depts === undefined ? [] : taskOffers(gw, seat, office),
      price: seat.depts === undefined ? 1 : taskPrice(seat, office),
      past: d.past
        .filter((p) => p.office === office)
        .slice(-5)
        .map((p) => ({
          row: p.row,
          topic: p.topic,
          scene: p.scene,
          verdict: p.verdict,
          date: dateOf(p.chapter),
        })),
    };
  });
}

export function roomView(gw: GreatWar, seat: GwSeatState): GwRoomRowView[] {
  const d = seat.depts;
  if (d === undefined || roomShut(gw, seat)) return [];
  const asked = (o: GwOffice) =>
    d.tray.some((c) => dept(c).office === o && dept(c).row !== null);
  const heads: GwRoomRowView[] = deptOffices(gw, seat)
    .filter((o) => trayOf(d, o).length > 0)
    // Commissioned work first.
    .sort((a, b) => Number(asked(b)) - Number(asked(a)))
    .map((office) => ({
      person: deptHead(gw, seat, office)!.id,
      office,
      brings: trayOf(d, office).length,
      petition: false,
    }));
  const asking: GwRoomRowView[] = d.waiting.flatMap((id) => {
    const topic = openTopics(gw, seat, id)[0];
    if (topic === undefined) return [];
    const p = gw.person(id);
    return [
      {
        person: id,
        office: p?.office ?? null,
        brings: 0,
        petition: true,
        topic,
        want: wantOf(gw, seat, p, (w) => w.person === id),
      },
    ];
  });
  return [...heads, ...asking];
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

export function timeView(gw: GreatWar, seat: GwSeatState): GwTimeView {
  return {
    left: timeLeft(seat),
    away: roomShut(gw, seat),
    carry: seat.depts?.carry ?? 0,
  };
}

export function leverViews(gw: GreatWar, seat: GwSeatState): GwLeverView[] {
  if (seat.depts === undefined) return [];
  const given = seat.depts.gifts;
  const met = metNow(gw, seat).filter((id) => !given.includes(id));
  return leverRows(seat).flatMap((r) => {
    const people = met.filter((id) => leverFits(gw, seat, r, id));
    return people.length === 0 ? [] : [{ row: r.id, lever: r.lever, people }];
  });
}
