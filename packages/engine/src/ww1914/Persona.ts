// Great War 1914 (ww196 §0): you are that person. Where the ruler sits on the
// chapter's date, who hands him each paper, the voice his ministers take with
// him, what goes against his grain (it costs nerve, and at the bottom it is
// locked), and what his people told him that proved wrong ("알고 보니").
// The diary is Diary.ts. Rows: content persona/<seat>.ts (GwPersona.ts).
import type {
  GwCard,
  GwOffice,
  GwPersonaState,
  GwPersonState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwPersonaStart } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwBearer,
  GwDeskHeadView,
  GwGrain,
  GwPersonaContent,
  GwRelationVoice,
  GwRulerPlace,
} from "@openfront/engine-api/ww1914/GwPersona";
import { GW_RULER_MAX } from "@openfront/engine-api/ww1914/GwRuler";
import type {
  GwCond,
  GwOption,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_PROUD, leanScore } from "@openfront/engine-lib/ww1914/TaskRows";
import {
  civilFromDays,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { GW_NERVE_WORN, moveRuler } from "./Ruler";
import { ctxOf, holds, personDef, sceneOf } from "./SceneRun";
import { seatPerson } from "./World";

const P_HINDSIGHT = idHash("gw_hindsight");

/** Chapters after an answer that a finding proves right or wrong: 2..4. */
export const GW_HINDSIGHT_MIN = 2;
export const GW_HINDSIGHT_SPREAD = 3;
/** How far an option must read above the others to be against his grain. */
export const GW_GRAIN_MARGIN = 2;
/** Chapters without a thing against his grain before a nerve comes back. */
export const GW_NERVE_REST = 2;
/** Proved wrong this often: "often" on the person row. */
const MISLED_OFTEN = 3;

const EMPTY: GwPersonaContent = {};
const persona = (): GwPersonaContent => gwContent().persona ?? EMPTY;

/** The seat's persona state, made on first use. */
export function personaState(seat: GwSeatState): GwPersonaState {
  seat.persona ??= gwPersonaStart();
  return seat.persona;
}

export function todayIso(gw: GreatWar): string {
  return formatIsoDate(civilFromDays(gw.s.day));
}

interface Dated {
  nation: readonly string[];
  ruler?: string;
  from?: string;
  until?: string;
  when?: GwCond;
}

/** A persona row's seat, person, dates and condition. */
export function personaRowHolds(
  gw: GreatWar,
  seat: GwSeatState,
  r: Dated,
  cast: Readonly<Record<string, string>> = {},
): boolean {
  if (!r.nation.includes(seat.tag)) return false;
  if (r.ruler !== undefined && seat.ruler.id !== r.ruler) return false;
  const day = todayIso(gw);
  if (r.from !== undefined && day < r.from) return false;
  if (r.until !== undefined && day >= r.until) return false;
  return r.when === undefined || holds({ gw, seat, cast }, r.when);
}

// ---- Day and place (§0.1) ----

/** On a trip of this act this chapter. */
function onTrip(gw: GreatWar, seat: GwSeatState, act: string): boolean {
  return seat.acted.some((x) => x.act === act && x.chapter === gw.s.chapter);
}

/** Where he sits now: the last row that holds; null none. */
export function placeRow(gw: GreatWar, seat: GwSeatState): GwRulerPlace | null {
  let out: GwRulerPlace | null = null;
  for (const r of persona().places ?? []) {
    if (!personaRowHolds(gw, seat, r)) continue;
    if (r.act !== undefined && !onTrip(gw, seat, r.act)) continue;
    out = r;
  }
  return out;
}

// ---- Who hands him the paper (§0.2) ----

export function isPrivatePaper(scene: GwScene): boolean {
  return scene.tags.includes("private");
}

function paperOffice(card: GwCard): GwOffice | undefined {
  const p = card.paper;
  if (p !== undefined && "office" in p) return p.office;
  return card.dept?.office;
}

/** The first bearer row that holds and fits the paper; null none. */
export function bearerRow(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
): GwBearer | null {
  const scene = sceneOf(card.scene);
  if (scene === null) return null;
  const own = isPrivatePaper(scene);
  const office = paperOffice(card);
  const form = card.paper?.form;
  for (const r of persona().bearers ?? []) {
    if ((r.private === true) !== own) continue;
    if (!personaRowHolds(gw, seat, r, card.cast)) continue;
    const p = r.person === undefined ? null : gw.person(r.person);
    if (p !== null && p.status !== "active") continue;
    if (r.tags !== undefined && !r.tags.some((t) => scene.tags.includes(t))) {
      continue;
    }
    if (r.kinds !== undefined && !r.kinds.includes(scene.kind)) continue;
    if (r.offices !== undefined) {
      if (office === undefined || !r.offices.includes(office)) continue;
    }
    if (r.forms !== undefined) {
      if (form === undefined || !r.forms.includes(form)) continue;
    }
    return r;
  }
  return null;
}

/** The desk heading: the place, and who brings the first paper in. */
export function deskHead(gw: GreatWar, seat: GwSeatState): GwDeskHeadView {
  const work = seat.desk.filter((c) => {
    const s = sceneOf(c.scene);
    return s !== null && !isPrivatePaper(s);
  });
  const first = work[0] ?? seat.desk[0];
  return {
    place: placeRow(gw, seat)?.id ?? null,
    bearer:
      first === undefined ? null : (bearerRow(gw, seat, first)?.id ?? null),
  };
}

// ---- The ministers' voice (§0.3) ----

/** How a head stands with the ruler: tried before his temperament. */
export function relationVoice(p: GwPersonState): GwRelationVoice | null {
  if (p.temperament === "anxious" || p.trust <= -1) return "fear";
  if (p.temperament === "cunning") return "flattery";
  if (p.temperament === "arrogant" || p.pride >= GW_PROUD) return "bluntness";
  return null;
}

/** Pack voice keys to try, in order: person, office, relation, temperament. */
export function voiceKeys(p: GwPersonState, office: GwOffice): string[] {
  const rel = relationVoice(p);
  return [p.id, office, ...(rel === null ? [] : [rel]), p.temperament];
}

// ---- His grain and his nerve (§0.4) ----

/** Whether `o` reads as `lean` among the scene's options, clearly. */
export function readsAs(
  options: readonly GwOption[],
  o: GwOption,
  lean: GwGrain["lean"],
): boolean {
  const others = options.filter((x) => x.id !== o.id);
  if (others.length === 0) return false;
  const mine = leanScore(o, lean);
  if (mine <= 0) return false;
  return others.every((x) => leanScore(x, lean) + GW_GRAIN_MARGIN <= mine);
}

/** His own family: no office, no camp, nothing to be given (the private cast). */
function isKin(id: string, seat: GwSeatState): boolean {
  const d = personDef(id);
  return (
    d !== null &&
    d.tag === seat.tag &&
    d.office === null &&
    d.fit.length === 0 &&
    d.camps.length === 0
  );
}

/** Whether the row's people, camps or kin are on this paper. */
function towards(
  r: GwGrain,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
): boolean {
  if (r.people === undefined && r.camps === undefined && r.kin !== true) {
    return true;
  }
  const self = seatPerson(seat);
  const who = [
    ...Object.values(card.cast),
    ...(card.dept === undefined ? [] : [card.dept.by]),
  ].filter((x) => x !== self);
  if (r.people?.some((x) => who.includes(x)) === true) return true;
  const camps = r.camps;
  if (
    camps !== undefined &&
    who.some((x) => personDef(x)?.camps.some((c) => camps.includes(c)))
  ) {
    return true;
  }
  return (
    r.kin === true && (isPrivatePaper(scene) || who.some((x) => isKin(x, seat)))
  );
}

/** The grain an option goes against, and whether taking it costs a nerve. */
export function grainOf(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
  o: GwOption,
): { row: GwGrain; costs: boolean } | null {
  const id = seat.ruler.id;
  if (id === null) return null;
  const options = scene.options ?? [];
  for (const r of persona().grain ?? []) {
    if (r.ruler !== id || !r.nation.includes(seat.tag)) continue;
    if (!readsAs(options, o, r.lean)) continue;
    if (!towards(r, seat, card, scene)) continue;
    if (r.when !== undefined && !holds(ctxOf(gw, seat, card), r.when)) continue;
    const before = seat.persona?.grain[r.id] ?? 0;
    return { row: r, costs: r.second !== true || before >= 1 };
  }
  return null;
}

/** The grain row id to show on the option, when taking it costs a nerve. */
export function grainView(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
  o: GwOption,
): string | undefined {
  const g = grainOf(gw, seat, card, scene, o);
  return g?.costs === true ? g.row.id : undefined;
}

/** Listed but not his to take today: no nerve left for it. */
export function grainLocked(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
  o: GwOption,
): boolean {
  if (seat.ruler.nerve > GW_NERVE_WORN) return false;
  return grainOf(gw, seat, card, scene, o)?.costs === true;
}

/** He took it himself: counted, and it costs what it costs. */
export function grainTaken(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
  o: GwOption,
): void {
  const g = grainOf(gw, seat, card, scene, o);
  if (g === null) return;
  const st = personaState(seat);
  st.grain[g.row.id] = (st.grain[g.row.id] ?? 0) + 1;
  if (g.costs) moveRuler(gw, seat, "nerve", -1, `${seat.ruler.id}_grain`);
}

/** A quiet stretch gives a nerve back: no move of it for GW_NERVE_REST. */
export function restNerve(gw: GreatWar, seat: GwSeatState): void {
  const r = seat.ruler;
  if (r.id === null || r.nerve >= GW_RULER_MAX) return;
  const last = r.lines.filter((l) => l.side === "nerve").slice(-1)[0];
  if (last !== undefined && gw.s.chapter - last.chapter < GW_NERVE_REST) return;
  moveRuler(gw, seat, "nerve", 1, `${r.id}_calm`);
}

// ---- What his people told him (§0.5) ----

function findingRow(row: string, id: string) {
  const a = (gwContent().depts?.answers ?? []).find((x) => x.id === row);
  return a?.findings.find((f) => f.id === id) ?? null;
}

/**
 * Answers on the desk: each finding shown that is wrong, or that has a
 * `truth` to be tested, waits 2-4 chapters for its day.
 */
export function noteFindings(gw: GreatWar, seat: GwSeatState): void {
  for (const c of seat.desk) {
    const p = c.paper;
    if (p?.form !== "answer") continue;
    for (const f of p.findings) {
      if (f.left) continue;
      const def = findingRow(f.row, f.id);
      if (!f.wrong && def?.truth === undefined) continue;
      const st = personaState(seat);
      const noted = st.hindsight.some(
        (h) =>
          h.row === f.row &&
          h.id === f.id &&
          h.by === p.by &&
          h.chapter > p.ready,
      );
      if (noted) continue;
      const roll = wwRoll(gw.s.seed, P_HINDSIGHT, c.uid, idHash(f.id));
      const due =
        Math.max(p.ready, gw.s.chapter) +
        GW_HINDSIGHT_MIN +
        (roll % GW_HINDSIGHT_SPREAD);
      st.hindsight.push({
        chapter: due,
        row: f.row,
        id: f.id,
        by: p.by,
        topic: p.topic,
      });
    }
  }
}

export interface Told {
  row: string;
  id: string;
  by: string;
}

/**
 * The findings whose day is this chapter: told when wrong (its `truth` false,
 * or marked wrong with none); the ones that proved right are let go.
 */
export function tellFindings(gw: GreatWar, seat: GwSeatState): Told[] {
  const st = seat.persona;
  if (st === undefined) return [];
  const now = gw.s.chapter;
  const told: Told[] = [];
  st.hindsight = st.hindsight.filter((h) => {
    if (h.chapter !== now) return true;
    const def = findingRow(h.row, h.id);
    const truth = def?.truth;
    const wrong =
      truth === undefined
        ? def?.wrong === true
        : !holds({ gw, seat, cast: {}, topic: h.topic ?? null }, truth);
    if (wrong) told.push({ row: h.row, id: h.id, by: h.by });
    return wrong;
  });
  return told;
}

/** How often his reports proved wrong: 0 never, 1 now and then, 2 often. */
export function misledOf(gw: GreatWar, seat: GwSeatState, by: string): number {
  const n = (seat.persona?.hindsight ?? []).filter(
    (h) => h.by === by && h.chapter < gw.s.chapter,
  ).length;
  return n === 0 ? 0 : n < MISLED_OFTEN ? 1 : 2;
}
