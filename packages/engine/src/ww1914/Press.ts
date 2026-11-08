import { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import {
  GW_BLOC_AGAINST,
  GW_BLOCS,
  GW_CENSOR_MAX,
  GW_OPINION_MAX,
  GW_RUMOUR_MAX,
  GwBloc,
  GwEdition,
  GwHeadline,
  GwPressView,
} from "@openfront/engine-api/ww1914/GwPress";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { blocsNow, blocViews, tieViews } from "./Blocs";
import type { GreatWar } from "./GreatWar";
import { factionOf, factionRow } from "./House";
import { GW_PRESS_ROWS, GwPressRow, GwStory } from "./PressTable";
import { holds, sceneOf } from "./SceneRun";
import { clampTo, everyMonths, moveGauge, reason } from "./World";

const P_STORY = idHash("gw_press_story");
const P_PAPER = idHash("gw_press_paper");
const P_RUMOUR = idHash("gw_press_rumour");

/** Papers on a page. */
const HEADS = 3;
/** A story waits this many chapters before it runs again. */
const STORY_REST = 4;
/** From here a rumour has a line in the paper's margin. */
const RUMOUR_HEARD = 2;
/** From here it costs the country's nerve. */
const RUMOUR_BITES = 4;
/** Chapters an invited paper holds back, the one it came in counted. */
const FRIEND_FOR = 2;

export function moveOpinion(
  seat: GwSeatState,
  bloc: GwBloc,
  delta: number,
): void {
  const o = seat.press.opinion;
  o[bloc] = clampTo(o[bloc] + delta, -GW_OPINION_MAX, GW_OPINION_MAX);
}

export function moveRumour(seat: GwSeatState, delta: number): void {
  seat.press.rumour = clampTo(seat.press.rumour + delta, 0, GW_RUMOUR_MAX);
}

/** How far the censor can go now: peace, war, a government that swore it off. */
export function censorCap(gw: GreatWar, seat: GwSeatState): number {
  const row = GW_PRESS_ROWS[seat.tag];
  const n = gw.nation(seat.tag);
  if (row === undefined || n === null) return 0;
  if (row.free.includes(n.regime)) return 0;
  return n.atWar.length > 0 ? GW_CENSOR_MAX : row.peaceCap;
}

export function moveCensor(
  gw: GreatWar,
  seat: GwSeatState,
  delta: number,
): void {
  seat.press.censor = clampTo(
    seat.press.censor + delta,
    0,
    censorCap(gw, seat),
  );
}

/** The body that won't have a tighter censor, or null. */
function censorBar(gw: GreatWar, seat: GwSeatState): string | null {
  const bar = GW_PRESS_ROWS[seat.tag]?.bar;
  const v = bar === undefined ? undefined : gw.nation(seat.tag)?.inst[bar.inst];
  if (bar === undefined || v === undefined) return null;
  return v < bar.min ? bar.why : null;
}

function acted(gw: GreatWar, seat: GwSeatState, event: string): void {
  seat.press.acted = gw.s.chapter;
  seat.press.event = event;
}

export function pressCensor(
  gw: GreatWar,
  seat: GwSeatState,
  up: boolean,
): GwOrderBlock | null {
  const row = GW_PRESS_ROWS[seat.tag];
  const p = seat.press;
  const n = gw.nation(seat.tag);
  if (row === undefined || n === null) return "press_closed";
  if (p.acted === gw.s.chapter) return "press_done";
  if (!up) {
    if (p.censor === 0) return "press_closed";
    p.censor--;
    moveOpinion(seat, "press", 1);
    acted(gw, seat, "lift");
    reason(gw, seat, "press_lifted");
    return null;
  }
  if (p.censor >= censorCap(gw, seat) || censorBar(gw, seat) !== null) {
    return "press_closed";
  }
  if (n.authority < row.price) return "no_authority";
  n.authority -= row.price;
  p.censor++;
  moveOpinion(seat, "press", -1);
  acted(gw, seat, "censor");
  reason(gw, seat, "press_tightened");
  return null;
}

export function pressInvite(
  gw: GreatWar,
  seat: GwSeatState,
  paper: string,
): GwOrderBlock | null {
  const p = seat.press;
  const row = GW_PRESS_ROWS[seat.tag]?.papers.find((x) => x.id === paper);
  if (row === undefined || row.noInvite === true) return "no_paper";
  if (p.acted === gw.s.chapter) return "press_done";
  if (seat.audiences <= 0) return "no_audience";
  seat.audiences--;
  p.friend = paper;
  p.friendTo = gw.s.chapter + FRIEND_FOR - 1;
  p.acted = gw.s.chapter;
  for (const b of row.blocs) moveOpinion(seat, b, 1);
  if (row.foe !== undefined) moveOpinion(seat, row.foe, -1);
  reason(gw, seat, "press_invited");
  return null;
}

export function pressLeak(
  gw: GreatWar,
  seat: GwSeatState,
  person: string,
): GwOrderBlock | null {
  const p = gw.person(person);
  if (GW_PRESS_ROWS[seat.tag] === undefined) return "press_closed";
  if (p === null || p.office === null || p.status !== "active") {
    return "no_person";
  }
  if (seat.press.acted === gw.s.chapter) return "press_done";
  p.trust = clampTo(p.trust - 1, -3, 3);
  p.memory.push({
    key: "leaked_on",
    who: null,
    chapter: gw.s.chapter,
    weight: -1,
  });
  seat.press.leaked = person;
  acted(gw, seat, "leak");
  moveOpinion(seat, "press", 1);
  moveRumour(seat, 1);
  reason(gw, seat, "press_leaked");
  return null;
}

/** The decisions of this chapter, talks and what stays behind doors left out. */
function decisions(gw: GreatWar, seat: GwSeatState) {
  const closed = GW_PRESS_ROWS[seat.tag]?.closed ?? [];
  return seat.choices.filter(
    (x) =>
      x.chapter === gw.s.chapter &&
      sceneOf(x.scene)?.kind !== "talk" &&
      sceneOf(x.scene)?.tags.includes("private") !== true &&
      !closed.includes(x.scene),
  );
}

interface Called {
  readonly story: GwStory;
  readonly scene: string | null;
}

/** The scene whose option moved `what` this way, if a decision did. */
function movedBy(
  gw: GreatWar,
  seat: GwSeatState,
  what: string,
  sign: number,
): string | null {
  for (const c of [...decisions(gw, seat)].reverse()) {
    const opt = sceneOf(c.scene)?.options?.find((o) => o.id === c.pick);
    const hit = opt?.effects.some(
      (e) =>
        ((e.kind === "inst" && e.inst === what) ||
          (e.kind === "gauge" && e.gauge === what) ||
          (e.kind === "temp" && what === "temp")) &&
        Math.sign(e.delta) === sign,
    );
    if (hit === true) return c.scene;
  }
  return null;
}

/** Whose news it is, as this seat's country stands. */
function sideOf(
  gw: GreatWar,
  seat: GwSeatState,
  tag: GwTag | null,
): "ours" | "theirs" | null {
  const mine = gw.nation(seat.tag)?.side ?? null;
  const other = tag === null ? null : (gw.nation(tag)?.side ?? null);
  if (mine === null || other === null) return null;
  return mine === other ? "ours" : "theirs";
}

/** Whether a story is called this chapter, and over which scene. */
function calledBy(gw: GreatWar, seat: GwSeatState, st: GwStory): Called | null {
  const s = gw.s;
  const on = st.on;
  if ("event" in on) {
    return seat.press.event === on.event ? { story: st, scene: null } : null;
  }
  if ("chose" in on) {
    const hit = decisions(gw, seat).find(
      (c) =>
        on.chose.some((x) =>
          on.prefix === true ? c.scene.startsWith(x) : c.scene === x,
        ) &&
        (on.picks === undefined || on.picks.includes(c.pick)),
    );
    return hit === undefined ? null : { story: st, scene: hit.scene };
  }
  if ("news" in on) {
    const hit = s.news.some(
      (x) =>
        x.chapter === s.chapter &&
        on.news.some((k) => x.key.startsWith(k)) &&
        (on.own !== true || x.a === seat.tag) &&
        (on.side === undefined || sideOf(gw, seat, x.a) === on.side),
    );
    return hit ? { story: st, scene: null } : null;
  }
  if ("moved" in on) {
    const scene = movedBy(gw, seat, on.moved, on.sign);
    return scene === null ? null : { story: st, scene };
  }
  return "when" in on &&
    on.when !== undefined &&
    !holds({ gw, seat, cast: {} }, on.when)
    ? null
    : { story: st, scene: null };
}

function rested(gw: GreatWar, seat: GwSeatState, st: GwStory): boolean {
  const last = seat.press.ran[st.id];
  return last === undefined || gw.s.chapter - last >= (st.rest ?? STORY_REST);
}

/**
 * A split or a join in the house this chapter (ww158): a story made from the
 * faction's row. Papers its bloc reads take it well; the text is the pack's
 * `heads`, by story and faction.
 */
export function houseStories(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwPressRow,
): GwStory[] {
  const st = seat.house?.story ?? null;
  if (st === null || st.chapter !== gw.s.chapter) return [];
  const bloc = factionRow(st.faction)?.bloc ?? null;
  const tones = Object.fromEntries(
    row.papers.map((p) => [
      p.id,
      bloc !== null && p.blocs.includes(bloc) ? 1 : 0,
    ]),
  );
  return [{ id: `house_${st.kind}`, weight: 10, on: {}, tones, rest: 0 }];
}

/** The heaviest story of the chapter; among equals, the seed's. */
function pickStory(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwPressRow,
): Called | null {
  const all = [...row.stories, ...houseStories(gw, seat, row)].flatMap(
    (st) => calledBy(gw, seat, st) ?? [],
  );
  const fresh = all.filter((c) => rested(gw, seat, c.story));
  // Nothing fresh: whichever ran longest ago.
  const pool = fresh.length > 0 ? fresh : all;
  if (fresh.length === 0) {
    return (
      [...pool].sort(
        (a, b) =>
          (seat.press.ran[a.story.id] ?? -1) -
          (seat.press.ran[b.story.id] ?? -1),
      )[0] ?? null
    );
  }
  const top = Math.max(...pool.map((c) => c.story.weight));
  const best = pool.filter((c) => c.story.weight === top);
  const roll = wwRoll(gw.s.seed, P_STORY, gw.s.chapter, seat.smallID);
  return best[roll % best.length];
}

/** Up to three papers: the invited one first, then the seed's, in table order. */
function pickPapers(
  gw: GreatWar,
  seat: GwSeatState,
  story: GwStory,
): { paper: string; tone: number }[] {
  const list = Object.entries(story.tones).map(([paper, tone]) => ({
    paper,
    tone,
  }));
  const keyed = list
    .map((x) => ({
      x,
      k:
        x.paper === friendOf(gw, seat)
          ? -1
          : wwRoll(gw.s.seed, P_PAPER, gw.s.chapter, idHash(x.paper)) % 1000,
    }))
    .sort((a, b) => a.k - b.k);
  const kept = keyed.slice(0, HEADS).map((y) => y.x);
  // Different leanings on a page: the bluntest take gets in over a like one.
  const tones = new Set(kept.map((x) => x.tone));
  if (tones.size === 1) {
    const other = list.find((x) => !tones.has(x.tone));
    if (other !== undefined) kept[kept.length - 1] = other;
  }
  return kept;
}

function friendOf(gw: GreatWar, seat: GwSeatState): string | null {
  const p = seat.press;
  return p.friend !== null && gw.s.chapter <= p.friendTo ? p.friend : null;
}

/** The censor's pencil: the harshest at wartime rules, all that bite if strict. */
function cut(heads: GwHeadline[], level: number): number {
  if (level === 0) return 0;
  const hard = heads.filter((h) => h.tone < 0);
  const taken = level >= GW_CENSOR_MAX ? hard : hard.slice(0, 1);
  for (const h of taken) {
    h.blank = true;
    h.tone = 0;
  }
  return taken.length;
}

function rumourLine(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwPressRow,
): string | null {
  if (seat.press.rumour < RUMOUR_HEARD) return null;
  const open = row.rumours.filter(
    (r) => r.when === undefined || holds({ gw, seat, cast: {} }, r.when),
  );
  if (open.length === 0) return null;
  const last = seat.press.edition?.rumour ?? null;
  const pool = open.length > 1 ? open.filter((r) => r.id !== last) : open;
  const roll = wwRoll(gw.s.seed, P_RUMOUR, gw.s.chapter, seat.smallID);
  return pool[roll % pool.length].id;
}

/** Sets the page: which story, whose take, what the censor and a friend do. */
function print(gw: GreatWar, seat: GwSeatState, row: GwPressRow): number {
  const p = seat.press;
  const called = pickStory(gw, seat, row);
  if (called === null) return 0;
  const { story, scene } = called;
  const friend = friendOf(gw, seat);
  const heads: GwHeadline[] = pickPapers(gw, seat, story).map((x) => {
    const soft = x.paper === friend && x.tone < 0;
    return {
      paper: x.paper,
      tone: soft ? 0 : x.tone,
      blank: false,
      soft,
    };
  });
  const cuts = story.free === true ? 0 : cut(heads, p.censor);
  const house = story.id.startsWith("house_")
    ? (seat.house?.story ?? null)
    : null;
  p.ran[story.id] = gw.s.chapter;
  // An act waits for a page with room for it.
  if ("event" in story.on) p.event = null;
  const edition: GwEdition = {
    chapter: gw.s.chapter,
    story: story.id,
    scene,
    who:
      "event" in story.on && story.on.event === "leak"
        ? p.leaked
        : house === null
          ? null
          : (factionOf(seat, house.faction)?.leader ?? null),
    ...(house === null ? {} : { faction: house.faction }),
    heads,
    rumour: null,
  };
  p.edition = edition;
  return cuts;
}

/** The papers before the first decision: the country as it stands. */
export function firstEdition(gw: GreatWar, seat: GwSeatState): void {
  const row = GW_PRESS_ROWS[seat.tag];
  if (row === undefined || seat.press.edition !== null) return;
  seat.press.censor = row.start;
  print(gw, seat, row);
  const now = blocsNow(gw, seat);
  if (now !== null) {
    seat.press.support = now;
    seat.press.was = { ...now };
  }
}

/** A bloc the page did not touch comes back towards level, slowly. */
function fade(gw: GreatWar, seat: GwSeatState, touched: Set<GwBloc>): void {
  if (gw.s.chapter % 2 !== 0) return;
  for (const b of GW_BLOCS) {
    const v = seat.press.opinion[b];
    if (!touched.has(b) && v !== 0) moveOpinion(seat, b, v > 0 ? -1 : 1);
  }
}

function readers(gw: GreatWar, seat: GwSeatState, row: GwPressRow): void {
  const touched = new Set<GwBloc>();
  for (const h of seat.press.edition?.heads ?? []) {
    const paper = row.papers.find((x) => x.id === h.paper);
    if (paper === undefined || h.tone === 0) continue;
    for (const b of paper.blocs) {
      moveOpinion(seat, b, h.tone);
      touched.add(b);
    }
  }
  fade(gw, seat, touched);
}

/**
 * What is cut goes round by mouth. Wartime rules feed it slowly, a strict censor
 * by every gap; a page with no gap lets it die down.
 */
function rumourStep(gw: GreatWar, seat: GwSeatState, cuts: number): void {
  const strict = seat.press.censor >= GW_CENSOR_MAX;
  if (cuts === 0) moveRumour(seat, -1);
  else if (strict) moveRumour(seat, cuts);
  else if (gw.s.chapter % 2 === 0) moveRumour(seat, 1);
  if (cuts > 0 && strict) moveOpinion(seat, "press", -1);
  if (seat.press.rumour >= RUMOUR_BITES && everyMonths(gw, 2)) {
    moveGauge(gw, seat.tag, "morale", -1, "morale_rumour");
  }
}

/** War brings the censor by itself; a government that swore it off ends it. */
function lawOfTheDay(gw: GreatWar, seat: GwSeatState, row: GwPressRow): void {
  const p = seat.press;
  const cap = censorCap(gw, seat);
  if (p.censor > cap) {
    p.censor = cap;
    reason(gw, seat, "press_freed");
  }
  const atWar = (gw.nation(seat.tag)?.atWar.length ?? 0) > 0;
  if (atWar && p.censor < row.warLevel && cap > 0 && !p.warBegun) {
    p.censor = Math.min(cap, row.warLevel);
    p.event ??= "war_censor";
    reason(gw, seat, "press_war_censor");
  }
  if (atWar) p.warBegun = true;
}

/** Says so on the log when a bloc crosses over. */
function crossings(
  gw: GreatWar,
  seat: GwSeatState,
  now: Record<GwBloc, number>,
): void {
  for (const b of GW_BLOCS) {
    const before = seat.press.support[b];
    if (before > GW_BLOC_AGAINST && now[b] <= GW_BLOC_AGAINST) {
      reason(gw, seat, `bloc_${seat.tag.toLowerCase()}_${b}`);
    }
  }
}

function seatStep(gw: GreatWar, seat: GwSeatState, row: GwPressRow): void {
  lawOfTheDay(gw, seat, row);
  const cuts = print(gw, seat, row);
  readers(gw, seat, row);
  rumourStep(gw, seat, cuts);
  if (seat.press.edition !== null) {
    seat.press.edition.rumour = rumourLine(gw, seat, row);
  }
  const now = blocsNow(gw, seat);
  if (now !== null) {
    crossings(gw, seat, now);
    seat.press.was = seat.press.support;
    seat.press.support = now;
  }
}

/** Chapter step: the morning's papers, and what they do to the blocs. */
export function pressStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    const row = GW_PRESS_ROWS[seat.tag];
    if (row !== undefined) seatStep(gw, seat, row);
  }
}

export function pressView(gw: GreatWar, seat: GwSeatState): GwPressView | null {
  const row = GW_PRESS_ROWS[seat.tag];
  if (row === undefined) return null;
  const p = seat.press;
  const friend = friendOf(gw, seat);
  return {
    blocs: blocViews(gw, seat),
    ties: tieViews(gw, seat),
    papers: row.papers.map((x) => ({
      id: x.id,
      blocs: x.blocs,
      foe: x.foe ?? null,
      invitable: x.noInvite !== true,
      friend: x.id === friend,
    })),
    edition: p.edition,
    censor: p.censor,
    censorCap: censorCap(gw, seat),
    censorPrice: row.price,
    censorBar: censorBar(gw, seat),
    rumour: p.rumour,
    acted: p.acted === gw.s.chapter,
  };
}
