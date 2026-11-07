// Great War 1914 (ww154): the ruler's earlier life. The world is rolled, then a
// seat's prologue scenes come one at a time before chapter 0 opens; the clock
// stands still. What they leave is ordinary state, set by their effects. A
// skipped prologue plays the same scenes unseen from the lobby's picks, by the
// same code, so a choice counts the same either way; no picks leave nothing.
import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import {
  gwPrologueStart,
  GwPrologueView,
  temperOf,
} from "@openfront/engine-api/ww1914/GwPrologue";
import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { openChapter } from "./Chapters";
import { makeCard, placeCard } from "./Desk";
import type { GreatWar } from "./GreatWar";
import { castOf, holds, SceneCtx, whoIn } from "./SceneRun";
import { rollRival } from "./Story";
import { playOutBig } from "./Talk";

/** What a seat can send while the years go by: its answers. */
const OPEN_ORDERS: readonly GwOrder["kind"][] = ["read", "reply"];

/** The nation's scenes in their order; empty where none is written. */
export function prologueRow(tag: GwTag): GwScene[] {
  return gwContent()
    .scenes.filter((x) => x.prologue !== undefined && x.nation.includes(tag))
    .sort((a, b) => a.prologue! - b.prologue!);
}

const running = (seat: GwSeatState) => (seat.prologue?.next ?? -1) >= 0;

/** Chapter 0 hasn't opened: someone is still living their years. */
export function inPrologue(gw: GreatWar): boolean {
  return gw.s.seats.some(running);
}

export function prologueRefuses(gw: GreatWar, kind: GwOrder["kind"]): boolean {
  return inPrologue(gw) && !OPEN_ORDERS.includes(kind);
}

/** The row's next scene on the desk; false when none is left to come. */
function dealNext(gw: GreatWar, seat: GwSeatState): boolean {
  const row = prologueRow(seat.tag);
  const p = seat.prologue!;
  while (p.next < row.length) {
    const scene = row[p.next++];
    if (!comes(gw, seat, scene)) continue;
    const card = makeCard(gw, seat, scene, "scheduled");
    if (card === null) continue;
    placeCard(gw, seat, card);
    gw.touch();
    return true;
  }
  return false;
}

/** A scene can wait on an earlier one's choice. */
function comes(gw: GreatWar, seat: GwSeatState, scene: GwScene): boolean {
  const cast = castOf(gw, seat, scene);
  if (cast === null) return false;
  return scene.when === undefined || holds({ gw, seat, cast }, scene.when);
}

/** The years are over: the rival is who they have made of him. */
function closePrologue(gw: GreatWar, seat: GwSeatState): void {
  const p = seat.prologue!;
  p.next = -1;
  if (Object.keys(p.lean).length > 0) rollRival(gw, seat);
  gw.touch();
}

/** The scenes unseen: each that `picks` names, by the same code as on screen. */
function replay(
  gw: GreatWar,
  seat: GwSeatState,
  picks: readonly string[],
): void {
  for (const scene of prologueRow(seat.tag)) {
    const lead = `${scene.id}.`;
    const mine = picks
      .filter((x) => x.startsWith(lead))
      .map((x) => x.slice(lead.length));
    if (mine.length === 0 || !comes(gw, seat, scene)) continue;
    const card = makeCard(gw, seat, scene, "scheduled");
    if (card === null) continue;
    placeCard(gw, seat, card);
    playOutBig(gw, seat, card, scene, false, mine);
    seat.desk = [];
  }
}

/**
 * Before chapter 0, in a solo game the lobby asked: true when a seat is to live
 * its years, and the first scene is on the desk.
 */
export function startPrologue(gw: GreatWar): boolean {
  const config = gw.mg.config().gameConfig();
  const field = config.greatWar1914Prologue;
  if (field === undefined || config.gameType !== GameType.Singleplayer) {
    return false;
  }
  for (const seat of gw.s.seats) {
    if (prologueRow(seat.tag).length === 0) continue;
    seat.prologue = gwPrologueStart();
    if (field.play) {
      if (!dealNext(gw, seat)) closePrologue(gw, seat);
      continue;
    }
    replay(gw, seat, field.picks);
    closePrologue(gw, seat);
  }
  return inPrologue(gw);
}

/**
 * The clock while the years go by: an empty desk brings the next scene, the
 * last one ends the prologue, and then the world opens. True until it has.
 */
export function prologueStep(gw: GreatWar, ticks: number): boolean {
  if (!inPrologue(gw)) return false;
  for (const seat of gw.s.seats.filter(running)) {
    if (seat.desk.length > 0 || dealNext(gw, seat)) continue;
    closePrologue(gw, seat);
  }
  if (!inPrologue(gw)) openChapter(gw, ticks);
  return true;
}

type PrologueCond = Extract<GwCond, { kind: "ruler_temper" }>;

export function prologueHolds(seat: GwSeatState, c: PrologueCond): boolean {
  const t = seat.prologue?.temper ?? null;
  return t !== null && c.of.includes(t);
}

type PrologueEffect = Extract<GwEffect, { kind: "temper" | "rival_lean" }>;

export function prologueEffect(ctx: SceneCtx, e: PrologueEffect): void {
  const p = ctx.seat.prologue;
  if (p === undefined) return;
  if (e.kind === "temper") {
    p.marks.push(e.of);
    p.temper = temperOf(p.marks);
    return;
  }
  const who = whoIn(ctx, e.who);
  if (who !== null) p.lean[who.id] = (p.lean[who.id] ?? 0) + e.delta;
}

export function prologueView(
  gw: GreatWar,
  seat: GwSeatState,
): GwPrologueView | null {
  const p = seat.prologue;
  if (p === undefined) return null;
  const row = prologueRow(seat.tag);
  const ids = new Set(row.map((x) => x.id));
  return {
    step: p.next < 0 ? row.length : p.next,
    total: row.length,
    done: p.next < 0,
    picks: seat.choices
      .filter((x) => ids.has(x.scene))
      .map((x) => `${x.scene}.${x.pick}`),
  };
}
