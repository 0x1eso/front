// Great War 1914 (design §5.6): the talk engine. A reply's price is shown and
// paid; how the person takes it is not shown, and comes back afterwards as
// reason lines (held on the card until the talk ends).
import {
  GwCard,
  GwPromise,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwCond,
  GwReply,
  GwScene,
  GwWho,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { stanceFit } from "@openfront/engine-lib/ww1914/TalkRules";
import type { GreatWar } from "./GreatWar";
import {
  ctxOf,
  endTalk,
  holds,
  keepPromise,
  optionOpen,
  rememberTalk,
  runEffects,
  SceneCtx,
  sceneOf,
  settleMood,
  speakerRole,
  talkerOf,
} from "./SceneRun";

/** The common scene a person comes back with when no other was named. */
export const GW_PROMISE_SCENE = "gw_promise_broken";

const clamp5 = (v: number) => Math.max(0, Math.min(5, v));

/** One reply: the price, the reaction, the next node. */
export function applyReply(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
  reply: GwReply,
  proxy = false,
): void {
  const ctx = ctxOf(gw, seat, card);
  // A decision in a big scene is the seat's own: nobody takes it well or ill.
  const decided = reply.kind === "decide";
  const p = decided ? null : talkerOf(ctx, scene);
  // Read before the price is paid: they answer the seat as it stood.
  const react = reply.reacts?.find((r) => holds(ctx, r.when));
  const fit = p === null ? 0 : stanceFit(p, reply.stance, reply.kind);
  seat.choices.push({
    scene: scene.id,
    pick: reply.id,
    chapter: gw.s.chapter,
    proxy,
  });
  runEffects(ctx, reply.effects);
  if (fit !== 0) {
    card.mood += fit > 0 ? 1 : -1;
    const key = `talk_${fit > 0 ? "fit" : "clash"}_${reply.stance}`;
    if (!card.notes.includes(key)) card.notes.push(key);
  }
  const lands = fit >= 0;
  if (p !== null && lands) {
    if (reply.stance === "flatter") p.pride = clamp5(p.pride + 1);
    if (reply.stance === "threat") p.pride = clamp5(p.pride - 1);
  }
  let next: string | null;
  if (react !== undefined) {
    runEffects(ctx, react.effects);
    next = react.next;
  } else if (lands) {
    runEffects(ctx, reply.gain ?? []);
    next = reply.next;
  } else {
    next = reply.miss === undefined ? reply.next : reply.miss;
  }
  if (reply.kind === "leave") {
    const sharp = reply.stance === "cold" || reply.stance === "threat";
    rememberTalk(ctx, scene, "talk_left", sharp ? -1 : 0);
  }
  if (next === null) endTalk(gw, seat, card, scene);
  else moveTo(ctx, scene, card, next);
}

/** The next node; a big scene's mood closes with whoever goes out. */
function moveTo(
  ctx: SceneCtx,
  scene: GwScene,
  card: GwCard,
  next: string,
): void {
  if (speakerRole(scene, card.node) !== speakerRole(scene, next)) {
    settleMood(ctx, scene);
  }
  card.node = next;
}

/**
 * A timer closed the chapter on a big scene: it plays out by each node's
 * `fallback`, else the first open reply that doesn't walk out. A loop stops.
 * `picks`: reply ids to take first, in order, where a node offers them.
 */
export function playOutBig(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
  late: boolean,
  picks: readonly string[] = [],
): void {
  const left = [...picks];
  const ctx = ctxOf(gw, seat, card);
  const been = new Set<string>();
  while (seat.desk.includes(card) && card.node !== null) {
    if (been.has(card.node)) break;
    been.add(card.node);
    const node = scene.nodes?.[card.node];
    const open = (node?.replies ?? []).filter((r) => optionOpen(ctx, r));
    const named = left.findIndex((id) => open.some((r) => r.id === id));
    const chosen = named < 0 ? null : left.splice(named, 1)[0];
    const pick =
      open.find((r) => r.id === chosen) ??
      open.find((r) => r.id === node?.fallback) ??
      open.find((r) => r.kind !== "leave") ??
      open[0];
    if (pick === undefined) break;
    applyReply(gw, seat, card, scene, pick, late);
  }
  if (seat.desk.includes(card)) endTalk(gw, seat, card, scene);
  if (late) seat.log.push({ key: "proxy_signed", chapter: gw.s.chapter });
}

/** ww190: the plain broken-promise card comes at most once in this many chapters. */
const GW_PROMISE_EVERY = 4;

/** The plain card came, or is on its way, within GW_PROMISE_EVERY chapters. */
function promiseSoon(gw: GreatWar, seat: GwSeatState): boolean {
  const c = gw.s.chapter;
  const last = seat.seen[GW_PROMISE_SCENE];
  if (last !== undefined && c - last < GW_PROMISE_EVERY) return true;
  return seat.scheduled.some(
    (q) => q.scene === GW_PROMISE_SCENE && q.chapter > c - GW_PROMISE_EVERY,
  );
}

/** A promise past due: they lose trust in the seat, and they come back. */
export function breakPromise(
  gw: GreatWar,
  seat: GwSeatState,
  x: GwPromise,
): void {
  x.broken = true;
  const ctx: SceneCtx = { gw, seat, cast: { who: x.who } };
  const w: GwWho = { role: "who" };
  runEffects(ctx, [
    { kind: "person_trust", who: w, delta: -1 },
    { kind: "remember", key: `broke_${x.key}`, who: w, weight: -2 },
    { kind: "reason", key: "promise_broken", who: w },
  ]);
  const back = x.back ?? GW_PROMISE_SCENE;
  if (back === GW_PROMISE_SCENE && promiseSoon(gw, seat)) return;
  if (sceneOf(back) !== null) {
    seat.scheduled.push({ scene: back, chapter: gw.s.chapter, who: x.who });
  }
}

/** At a chapter's opening: promises kept by the state, promises now broken. */
export function settlePromises(gw: GreatWar, seat: GwSeatState): void {
  for (const x of seat.promises) {
    if (x.kept || x.broken) continue;
    if (x.keep !== null) {
      const c = JSON.parse(x.keep) as GwCond;
      if (holds({ gw, seat, cast: { who: x.who } }, c)) {
        keepPromise(gw, seat, x);
        continue;
      }
    }
    // The calendar jumps to the peace: a date passed that way breaks nothing.
    if (gw.s.armistice !== null) continue;
    if (gw.s.chapter > x.due) breakPromise(gw, seat, x);
  }
}

/** Summonable scenes in the order the people screen lists them. */
export function summonScenes(): readonly GwScene[] {
  return gwContent().scenes.filter((x) => x.summon === true);
}
