// Great War 1914 (design §5.2): the desk. Every chapter the scenes whose state
// holds compete for two to four places. Salience and how specific the
// condition is give a score; tags steer the tension curve; picked cards push
// back cards like them, so a desk is mixed; scenes seen lately, in this game
// or in the seat's last two (a lobby field), lose ground; scores in the same
// band are a tie, and a seeded roll settles it. A chapter with nothing worth
// saying folds into one quiet card. A big scene quiets the desk: its chapter
// deals it and what can't wait (고비). A first game of a nation starts small.
import {
  GW_TENSION_MAX,
  GwBack,
  GwCard,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_READ_ONLY_KINDS,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_OPENING_DESK } from "@openfront/engine-lib/ww1914/StoryRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { spentTalk } from "./AskFirst";
import { routeInitiatives } from "./Departments";
import type { GreatWar } from "./GreatWar";
import { lawReplaces } from "./Laws";
import {
  assumesHold,
  castOf,
  holds,
  pickVariant,
  SceneCtx,
  sceneHolds,
  specificity,
} from "./SceneRun";
import { inOpening, newcomers, noteLetterIn } from "./Story";
import { settlePromises } from "./Talk";
import { stageOf } from "./World";

export const GW_DESK_MIN = 2;
export const GW_DESK_MAX = 4;

/** What a scene's score is made of. One salience point is worth ten. */
export const GW_DESK_WEIGHTS = {
  salience: 10,
  /** Per leaf of the scene's condition, up to `specificCap`. */
  specific: 2,
  specificCap: 5,
  /** Scores in the same band are a tie for the seeded roll. */
  tieBand: 5,
  /** The tension curve: `tension_up` and `tension_down` when it is off. */
  tensionHot: 15,
  tensionCalm: 10,
  /** Per card already picked of the same kind, and sharing a subject. */
  sameKind: 6,
  sameSubject: 6,
  /** Dealt before in this game. */
  repeat: 10,
  /** Shown in the seat's last two games, with or without a fresh body. */
  recent: 30,
  recentFreshBody: 10,
} as const;

/** Tension from which the next desk must calm down (design §5.2). */
export const GW_TENSION_HIGH = 2;
/** Salience from which a scene takes a place past the chapter's usual count. */
export const GW_SALIENCE_MUST = 8;
/** Salience at or below which a read-only scene can be folded away. */
export const GW_SALIENCE_SMALL = 1;
/** Crisis temperature from which a chapter's desk grows by one. */
export const GW_TEMP_HOT = 6;
/** Scheduled cards that ride beside the draw instead of taking its places. */
export const GW_DUE_BESIDE = 2;
/** Past the crisis one rides: two stacked seven cards on four months in ten. */
export const GW_DUE_BESIDE_WAR = 1;
/** Must-read papers that ride beside a full desk. */
export const GW_READS_BESIDE = 2;
/** With no cooldown of its own, chapters before a scene can come again. */
export const GW_COOLDOWN_DEFAULT = 2;
/** Chapters between two big scenes the desk draws; a scheduled one doesn't wait. */
export const GW_BIG_EVERY = 3;
/** What can't wait, at most, beside a big scene. */
export const GW_BIG_BESIDE = 2;
/** A first game: salience from which a scene may bring in one new person. */
export const GW_OPENING_MUST = 9;

const P_TIE = idHash("gw_desk_tie");
const SUBJECTS = ["foreign", "home", "war", "people"] as const;

/** "<scene>.<variant>": one body of text, what `shown` and the lobby list. */
export function bodyId(scene: string, variant: string): string {
  return `${scene}.${variant}`;
}

/** ww190 §2: the most times a drawn scene is dealt in a game, by default. */
export const GW_REPEAT_MAX = 5;
/**
 * Papers whose id starts with one of these have no cap: the budget's
 * meetings and lines, the bills, the house's debates and votes.
 */
export const GW_REPEAT_FREE: readonly string[] = [
  "gw_bm_",
  "gw_bc_",
  "gw_bt_",
  "gw_bl_",
  "gw_law_",
  "gw_lv_",
  "gw_lt_",
  "gw_lf_",
  "gw_ld_",
  "gw_lb_",
  "gw_fv_",
  "gw_lr_",
  "gw_ls_",
];

/** Times `scene` was dealt to the seat this game: one body in `shown` a deal. */
export function timesDealt(seat: GwSeatState, scene: string): number {
  if (seat.seen[scene] === undefined) return 0;
  const head = `${scene}.`;
  let n = 0;
  for (const b of seat.shown) if (b.startsWith(head)) n++;
  return n;
}

/**
 * The most times the desk draws `scene` in a game: its own `max`, else
 * GW_REPEAT_MAX, else none for the accounts, the quiet card, the schedule's
 * acts and the house's papers. ww190 tune: a called card is held to it too
 * (takeDue), except the crisis's, must-reads, acts and papers sent back.
 */
export function repeatCap(scene: GwScene): number {
  if (scene.max !== undefined) return scene.max;
  if (scene.kind === "ledger" || scene.quiet === true) return Infinity;
  if (scene.byAct === true) return Infinity;
  if (GW_REPEAT_FREE.some((p) => scene.id.startsWith(p))) return Infinity;
  return GW_REPEAT_MAX;
}

interface Recent {
  bodies: ReadonlySet<string>;
  scenes: ReadonlySet<string>;
}
const NO_RECENT: Recent = { bodies: new Set(), scenes: new Set() };
const recents = new WeakMap<readonly string[], Recent>();

/** The lobby's list, indexed; derived from the config, so never state. */
function recentOf(gw: GreatWar): Recent {
  const list = gw.mg.config().gameConfig().greatWar1914Recent;
  if (list === undefined) return NO_RECENT;
  let r = recents.get(list);
  if (r === undefined) {
    r = {
      bodies: new Set(list),
      scenes: new Set(list.map((b) => b.split(".")[0])),
    };
    recents.set(list, r);
  }
  return r;
}

/** How worn a body is: 0 fresh, 1 last games, 2 this game. */
function wornness(gw: GreatWar, seat: GwSeatState, scene: GwScene) {
  const recent = recentOf(gw);
  return (id: string): number => {
    const body = bodyId(scene.id, id);
    if (seat.shown.includes(body)) return 2;
    return recent.bodies.has(body) ? 1 : 0;
  };
}

/** How worn a scene is for the people screen: 0 fresh, 1 last games, 2 here. */
export function sceneWear(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
): number {
  if (seat.seen[scene.id] !== undefined) return 2;
  return recentOf(gw).scenes.has(scene.id) ? 1 : 0;
}

/** A card for `scene`, or null when a cast role has nobody. */
export function makeCard(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
  origin: GwCard["origin"],
  called: string | null = null,
  act: number | null = null,
  back: GwBack | null = null,
  topic: string | null = null,
): GwCard | null {
  const cast = castOf(gw, seat, scene, called, act);
  if (cast === null) return null;
  const ctx: SceneCtx = { gw, seat, cast, act, back, topic };
  const uid = gw.s.nextCard++;
  const salt = idHash(scene.id);
  const voice: Record<string, string> = {};
  for (const [role, list] of Object.entries(scene.voices ?? {})) {
    voice[role] = pickVariant(ctx, list, salt ^ idHash(role));
  }
  const variant = pickVariant(
    ctx,
    scene.variants,
    salt,
    wornness(gw, seat, scene),
  );
  return {
    uid,
    scene: scene.id,
    variant,
    cast,
    origin,
    node:
      scene.kind === "talk"
        ? (scene.starts?.[variant] ?? scene.start ?? null)
        : null,
    chapter: gw.s.chapter,
    voice,
    mood: 0,
    notes: [],
    folded: [],
    act,
    back,
  };
}

/** Puts a card on the desk and writes down that it was seen. */
export function placeCard(gw: GreatWar, seat: GwSeatState, card: GwCard): void {
  seat.desk.push(card);
  seat.seen[card.scene] = gw.s.chapter;
  seat.shown.push(bodyId(card.scene, card.variant));
  noteLetterIn(gw, seat, card);
  if (inOpening(gw, seat)) {
    seat.story.met.push(...newcomers(gw, seat, Object.values(card.cast)));
  }
}

/** Not `once` and spent, not in its cooldown. */
export function repeatable(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
): boolean {
  const last = seat.seen[scene.id];
  if (last === undefined) return true;
  if (scene.once === true) return false;
  const wait = scene.cooldown ?? GW_COOLDOWN_DEFAULT;
  return gw.s.chapter - last > wait;
}

export function inStage(gw: GreatWar, scene: GwScene): boolean {
  const stage = stageOf(gw);
  return scene.stage === undefined || scene.stage.includes(stage);
}

/** The guns have stopped: war papers with no stage, feelers and prices are over. */
function overWithTheWar(gw: GreatWar, scene: GwScene): boolean {
  if (gw.s.armistice === null) return false;
  const war = scene.stage === undefined && scene.tags.includes("war");
  return war || /^(gw_peace_feeler$|gw_price_)/.test(scene.id);
}

/** Whether the desk may draw `scene` now: everything but its `when`. */
function drawable(gw: GreatWar, seat: GwSeatState, scene: GwScene): boolean {
  if (scene.summon === true || scene.scheduledOnly === true) return false;
  if (scene.quiet === true || !scene.nation.includes(seat.tag)) return false;
  if (lawReplaces(gw, seat, scene.id)) return false;
  if (overWithTheWar(gw, scene)) return false;
  if (scene.big === true && gw.s.chapter - seat.story.bigAt < GW_BIG_EVERY) {
    return false;
  }
  if (!inStage(gw, scene) || !repeatable(gw, seat, scene)) return false;
  if (timesDealt(seat, scene.id) >= repeatCap(scene)) return false;
  return !spentTalk(gw, seat, scene);
}

function subjects(x: GwScene) {
  return SUBJECTS.filter((t) => x.tags.includes(t));
}

/** A scene that holds now, and how it stands before the mix. */
export interface DeskCandidate {
  scene: GwScene;
  score: number;
}

function scoreOf(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
  cast: Readonly<Record<string, string>>,
): number {
  const w = GW_DESK_WEIGHTS;
  let v = scene.salience * w.salience;
  v += Math.min(specificity(scene.when), w.specificCap) * w.specific;
  const up = scene.tags.includes("tension_up");
  const down = scene.tags.includes("tension_down");
  if (seat.tension >= GW_TENSION_HIGH) {
    if (up) v -= w.tensionHot;
    if (down) v += w.tensionHot;
  } else if (seat.tension === 0) {
    if (up) v += w.tensionCalm;
    if (down) v -= w.tensionCalm;
  }
  if (seat.seen[scene.id] !== undefined) v -= w.repeat;
  const recent = recentOf(gw);
  if (recent.scenes.has(scene.id)) {
    const ctx: SceneCtx = { gw, seat, cast };
    const fresh = scene.variants.some(
      (x) =>
        !recent.bodies.has(bodyId(scene.id, x.id)) &&
        (x.when === undefined || holds(ctx, x.when)) &&
        assumesHold(ctx, x),
    );
    v -= fresh ? w.recentFreshBody : w.recent;
  }
  return v;
}

/** Everything that could be drawn this chapter, scored before the mix. */
export function deskCandidates(
  gw: GreatWar,
  seat: GwSeatState,
): DeskCandidate[] {
  const out: DeskCandidate[] = [];
  for (const scene of gwContent().scenes) {
    if (!drawable(gw, seat, scene)) continue;
    const cast = castOf(gw, seat, scene);
    if (cast === null) continue;
    if (!sceneHolds({ gw, seat, cast }, scene)) continue;
    out.push({ scene, score: scoreOf(gw, seat, scene, cast) });
  }
  return out;
}

/** How many cards this chapter usually has. */
function deskTarget(gw: GreatWar): number {
  const stage = stageOf(gw);
  const busy = stage === "closing" ? 0 : 1;
  const hot = gw.s.temp >= GW_TEMP_HOT ? 1 : 0;
  return Math.min(GW_DESK_MAX, GW_DESK_MIN + busy + hot);
}

/** The score once the cards already picked have had their say. */
function mixed(c: DeskCandidate, picked: readonly GwScene[]): number {
  const w = GW_DESK_WEIGHTS;
  const mine = subjects(c.scene);
  let v = c.score;
  for (const p of picked) {
    if (p.kind === c.scene.kind) v -= w.sameKind;
    if (subjects(p).some((t) => mine.includes(t))) v -= w.sameSubject;
  }
  return v;
}

/** A desk all of one subject is refused while anything else can come. */
function wouldFillOneSubject(
  c: DeskCandidate,
  picked: readonly GwScene[],
  target: number,
): boolean {
  if (picked.length + 1 < target) return false;
  const shared = subjects(c.scene).filter((t) =>
    picked.every((p) => p.tags.includes(t)),
  );
  return shared.length > 0;
}

/** The highest band, and a seeded roll inside it. */
function best(
  gw: GreatWar,
  from: readonly DeskCandidate[],
  picked: readonly GwScene[],
): DeskCandidate | null {
  if (from.length === 0) return null;
  const band = (c: DeskCandidate) =>
    Math.floor(mixed(c, picked) / GW_DESK_WEIGHTS.tieBand);
  const top = Math.max(...from.map(band));
  const tied = from.filter((c) => band(c) === top);
  const roll = (c: DeskCandidate) =>
    wwRoll(gw.s.seed, P_TIE, gw.s.chapter, idHash(c.scene.id));
  return tied.reduce((a, b) => (roll(b) > roll(a) ? b : a));
}

const isRead = (x: GwScene) => GW_READ_ONLY_KINDS.includes(x.kind);

/**
 * Fills the room left by what was scheduled. Decisions take the places first;
 * papers to read then ride along: they take a minute, and no decision's place.
 * With no decisions to make, they fill the desk themselves.
 */
function draw(
  gw: GreatWar,
  seat: GwSeatState,
  cands: readonly DeskCandidate[],
  due: readonly GwScene[],
  limit: number | null = null,
): GwScene[] {
  const picked: GwScene[] = [...due];
  let left = [...cands];
  const take = (c: DeskCandidate) => {
    picked.push(c.scene);
    left = left.filter((x) => x !== c);
  };
  const calmed = due.some((x) => x.tags.includes("tension_down"));
  if (seat.tension >= GW_TENSION_HIGH && !calmed) {
    const down = left.filter((c) => c.scene.tags.includes("tension_down"));
    const c = best(gw, down, picked);
    if (c !== null && picked.length < GW_DESK_MAX) take(c);
  }
  const crisis = gwChapters(gw.s.calendar)[gw.s.chapter].stage === "crisis";
  const beside = Math.min(
    due.length,
    crisis ? GW_DUE_BESIDE : GW_DUE_BESIDE_WAR,
  );
  const target = limit ?? deskTarget(gw) + beside;
  const max = limit ?? GW_DESK_MAX + beside;
  const placed = () => picked.filter((x) => !isRead(x)).length;
  // A first game hears the news before it is asked anything: a place stays
  // for the paper that says what happened.
  const isNews = (c: DeskCandidate) =>
    isRead(c.scene) && c.scene.salience >= GW_SALIENCE_MUST;
  const news = limit !== null && left.some(isNews);
  const places = news ? max - 1 : max;
  while (placed() < places) {
    const open = left.filter(
      (c) =>
        !isRead(c.scene) &&
        !(c.scene.kind === "talk" && picked.some((p) => p.kind === "talk")),
    );
    const varied = open.filter((c) => !wouldFillOneSubject(c, picked, target));
    const c = best(gw, varied.length > 0 ? varied : open, picked);
    if (c === null) break;
    if (placed() >= target && c.scene.salience < GW_SALIENCE_MUST) break;
    take(c);
  }
  for (let reads = 0; limit === null || reads < 1; reads++) {
    const open = left.filter((x) => (news ? isNews(x) : isRead(x.scene)));
    const varied = open.filter((c) => !wouldFillOneSubject(c, picked, target));
    const c = best(gw, varied.length > 0 ? varied : open, picked);
    if (c === null) break;
    const room = picked.length < target;
    const must =
      c.scene.salience >= GW_SALIENCE_MUST &&
      (picked.length < max || (limit === null && reads < GW_READS_BESIDE));
    const small = c.scene.salience <= GW_SALIENCE_SMALL;
    const riding =
      limit === null && reads < (crisis ? GW_READS_BESIDE : 1) && !small;
    if (!room && !must && !riding) break;
    take(c);
  }
  return picked.slice(due.length);
}

/** The quiet card for this chapter; null when the content has none. */
function quietCard(gw: GreatWar, seat: GwSeatState): GwCard | null {
  const fit = gwContent().scenes.filter((x) => {
    if (x.quiet !== true || !x.nation.includes(seat.tag)) return false;
    if (!inStage(gw, x)) return false;
    const cast = castOf(gw, seat, x);
    if (cast === null) return false;
    return sceneHolds({ gw, seat, cast }, x);
  });
  if (fit.length === 0) return null;
  const scene = fit[wwRoll(gw.s.seed, P_TIE, gw.s.chapter) % fit.length];
  return makeCard(gw, seat, scene, "desk");
}

function isSmall(x: GwScene): boolean {
  return isRead(x) && x.salience <= GW_SALIENCE_SMALL;
}

/** What the desk did, for the simulation report. Not state. */
export interface DeskTrace {
  chapter: number;
  eligible: readonly string[];
  dealt: readonly string[];
  quiet: boolean;
}
let watcher: ((t: DeskTrace) => void) | null = null;

/** The N-run report's probe: tests and the sim script only. */
export function watchDesk(fn: ((t: DeskTrace) => void) | null): void {
  watcher = fn;
}

interface Due {
  scene: GwScene;
  who: string | null;
  act: number | null;
  back: GwBack | null;
}

/** Scheduled scenes that have come, up to a full desk; the rest wait. */
function takeDue(gw: GreatWar, seat: GwSeatState): Due[] {
  const out: Due[] = [];
  const scenes = gwContent().scenes;
  seat.scheduled = seat.scheduled.filter((q) => {
    if (q.chapter > gw.s.chapter || out.length >= GW_DESK_MAX) return true;
    const scene = scenes.find((x) => x.id === q.scene);
    const who = q.who ?? null;
    const act = q.act ?? null;
    // Two causes can call the same paper for the same day: it comes once.
    const twice = out.some(
      (x) => x.scene === scene && x.who === who && x.act === act,
    );
    // ww187: a paper whose text the state now gives the lie to doesn't come.
    const fits =
      scene === undefined ||
      assumesHold({ gw, seat, cast: {}, act, back: q.back ?? null }, scene);
    // ww190 tune: a called paper that came as often as the draw allows
    // (repeatCap) comes no more, unless the schedule or a sent-back paper
    // brings it, or it is the crisis's or a must-read.
    const spent =
      scene !== undefined &&
      act === null &&
      (q.back ?? null) === null &&
      scene.essential !== true &&
      scene.kind !== "crisis" &&
      timesDealt(seat, scene.id) >= repeatCap(scene);
    if (
      scene !== undefined &&
      !twice &&
      !spent &&
      !overWithTheWar(gw, scene) &&
      fits
    ) {
      out.push({ scene, who, act, back: q.back ?? null });
    }
    return false;
  });
  return out;
}

/** Tension falls by itself; what was dealt moves it. */
function moveTension(seat: GwSeatState, dealt: readonly GwScene[]): void {
  let t = Math.max(0, seat.tension - 1);
  for (const x of dealt) {
    if (x.tags.includes("tension_up")) t++;
    if (x.tags.includes("tension_down")) t--;
  }
  seat.tension = Math.max(0, Math.min(GW_TENSION_MAX, t));
}

/** What a chapter's quiet doesn't hold back: the crisis, the accounts. */
function cantWait(x: GwScene): boolean {
  return x.essential === true || x.kind === "crisis" || x.kind === "ledger";
}

/** The big scene due this chapter: a scheduled one, else the best drawn. */
function bigDue(
  due: readonly Due[],
  cands: readonly DeskCandidate[],
): Due | null {
  const called = due.find((q) => q.scene.big === true);
  if (called !== undefined) return called;
  const drawn = cands
    .filter((c) => c.scene.big === true)
    .reduce<DeskCandidate | null>(
      (a, b) => (a === null || b.score > a.score ? b : a),
      null,
    );
  return drawn === null
    ? null
    : { scene: drawn.scene, who: null, act: null, back: null };
}

/**
 * 고비: the chapter is the big scene and what can't wait. Whatever else was due
 * waits for the next chapter. False when the scene has lost its cast.
 */
function dealBig(
  gw: GreatWar,
  seat: GwSeatState,
  big: Due,
  due: readonly Due[],
  cands: readonly DeskCandidate[],
): boolean {
  const origin = due.includes(big) ? "scheduled" : "desk";
  const card = makeCard(
    gw,
    seat,
    big.scene,
    origin,
    big.who,
    big.act,
    big.back,
  );
  if (card === null) return false;
  placeCard(gw, seat, card);
  seat.story.bigAt = gw.s.chapter;
  const beside: Due[] = [];
  for (const q of due) {
    if (q === big) continue;
    if (cantWait(q.scene) && beside.length < GW_BIG_BESIDE) {
      beside.push(q);
    } else {
      seat.scheduled.push({
        scene: q.scene.id,
        chapter: gw.s.chapter,
        who: q.who,
        act: q.act,
        back: q.back,
      });
    }
  }
  const drawn = cands
    .filter((c) => cantWait(c.scene) && c.scene !== big.scene)
    .sort((a, b) => b.score - a.score)
    .slice(0, GW_BIG_BESIDE - beside.length);
  for (const q of beside) {
    const c = makeCard(gw, seat, q.scene, "scheduled", q.who, q.act, q.back);
    if (c !== null) placeCard(gw, seat, c);
  }
  for (const { scene } of drawn) {
    const c = makeCard(gw, seat, scene, "desk");
    if (c !== null) placeCard(gw, seat, c);
  }
  moveTension(seat, [big.scene, ...beside.map((q) => q.scene)]);
  watcher?.({
    chapter: gw.s.chapter,
    eligible: cands.map((c) => c.scene.id),
    dealt: seat.desk.map((c) => c.scene),
    quiet: false,
  });
  return true;
}

/**
 * A first game's desk: no private life or staff reports yet, and nobody new
 * unless the state needs them, one at a time. A crisis brings whoever it names.
 */
function openingCands(
  gw: GreatWar,
  seat: GwSeatState,
  cands: readonly DeskCandidate[],
): DeskCandidate[] {
  return cands.filter(({ scene }) => {
    if (scene.tags.includes("private") || scene.kind === "report") return false;
    if (cantWait(scene)) return true;
    const fresh = newcomers(gw, seat, castIds(gw, seat, scene)).length;
    return fresh === 0 || (fresh === 1 && scene.salience >= GW_OPENING_MUST);
  });
}

function castIds(gw: GreatWar, seat: GwSeatState, scene: GwScene): string[] {
  return Object.values(castOf(gw, seat, scene) ?? {});
}

/** Deals the chapter's desk (design §5.2). */
export function dealDesk(gw: GreatWar, seat: GwSeatState): void {
  settlePromises(gw, seat);
  const due = takeDue(gw, seat);
  // ww193: the departments' own papers go to their heads' trays.
  const all = routeInitiatives(
    gw,
    seat,
    deskCandidates(gw, seat).filter(
      (c) => !due.some((q) => q.scene === c.scene),
    ),
  );
  const big = bigDue(due, all);
  if (big !== null && dealBig(gw, seat, big, due, all)) return;
  const dueCards: GwCard[] = [];
  const dueScenes: GwScene[] = [];
  for (const q of due) {
    const card = makeCard(gw, seat, q.scene, "scheduled", q.who, q.act, q.back);
    if (card === null) continue;
    dueCards.push(card);
    dueScenes.push(q.scene);
  }
  // A big scene is never one card among others.
  const open = all.filter((c) => c.scene.big !== true);
  const opening = inOpening(gw, seat);
  const cands = opening ? openingCands(gw, seat, open) : open;
  const drawn = draw(
    gw,
    seat,
    cands,
    dueScenes,
    opening ? GW_OPENING_DESK : null,
  );
  const quiet =
    dueCards.length === 0 && drawn.every(isSmall) ? quietCard(gw, seat) : null;
  let dealt = [...dueScenes, ...drawn];
  if (quiet !== null) {
    quiet.folded = drawn.map((x) => x.id);
    placeCard(gw, seat, quiet);
    for (const x of drawn) seat.seen[x.id] = gw.s.chapter;
    dealt = [];
  } else {
    for (const card of dueCards) placeCard(gw, seat, card);
    // News before what it asks for: the ultimatum above Belgrade's answer.
    const byRead = [
      ...drawn.filter(isRead),
      ...drawn.filter((x) => !isRead(x)),
    ];
    for (const scene of byRead) {
      const card = makeCard(gw, seat, scene, "desk");
      if (card !== null) placeCard(gw, seat, card);
    }
  }
  moveTension(seat, dealt);
  watcher?.({
    chapter: gw.s.chapter,
    eligible: cands.map((c) => c.scene.id),
    dealt: seat.desk.map((c) => c.scene),
    quiet: quiet !== null,
  });
}
