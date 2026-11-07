// Great War 1914 ("다시 써 오시오"): a decision goes back to whoever wrote it, with
// a direction. It returns next chapter rewritten, or as it was if they dig in.
// A paper goes back once. The rule needs no text; a scene can add lines with
// pack `back` and change the paper itself with the `returned` condition.
import {
  GwBackDirection,
  GwCard,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  backable,
  backDirections,
  digPct,
} from "@openfront/engine-lib/ww1914/SendBackRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import {
  personDef,
  removeCard,
  runEffects,
  SceneCtx,
  sceneOf,
} from "./SceneRun";
import { reasonOf, seatPerson } from "./World";

const P_DIG = idHash("gw_back_dig");

/** How far back a paper of theirs counts against the next. */
const RECENT_CHAPTERS = 4;

/** Who answers for a paper: `author`, or the first of the seat's own people. */
function authorOf(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
): string | null {
  const self = seatPerson(seat);
  const own = (x: string) => x !== self && personDef(x)?.tag === seat.tag;
  const id =
    scene.author !== undefined
      ? card.cast[scene.author]
      : Object.values(card.cast).find(own);
  if (id === undefined || !own(id)) return null;
  return gw.person(id)?.status === "active" ? id : null;
}

/** The directions open on this card now; empty when it can't go back. */
export function backOpen(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
): readonly GwBackDirection[] {
  if (card.back !== null || !backable(scene)) return [];
  if (gw.s.chapter + 1 >= gwChapters(gw.s.calendar).length) return [];
  if (authorOf(gw, seat, card, scene) === null) return [];
  return backDirections(scene);
}

/** Who a paper goes back to, for the screen; null with nobody to answer. */
export const backWho = authorOf;

function digsIn(gw: GreatWar, seat: GwSeatState, who: string, scene: GwScene) {
  const p = gw.person(who)!;
  const recent = seat.returns.filter(
    (x) => x.who === who && gw.s.chapter - x.chapter <= RECENT_CHAPTERS,
  ).length;
  const roll = wwRoll(gw.s.seed, P_DIG, idHash(scene.id), gw.s.chapter) % 100;
  return roll < digPct(p, recent);
}

/** Applies the `send_back` order; null when it took effect. */
export function sendBack(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
  direction: GwBackDirection,
): GwOrderBlock | null {
  const card = seat.desk.find((c) => c.uid === uid);
  const scene = card === undefined ? null : sceneOf(card.scene);
  if (card === undefined || scene === null) return "no_card";
  if (!backOpen(gw, seat, card, scene).includes(direction)) return "no_back";
  const who = authorOf(gw, seat, card, scene)!;
  const changed = !digsIn(gw, seat, who, scene);
  removeCard(seat, card.uid);
  seat.returns.push({
    scene: scene.id,
    direction,
    chapter: gw.s.chapter,
    changed,
    who,
  });
  const called = Object.entries(scene.cast).find(([, r]) => "called" in r);
  seat.scheduled.push({
    scene: scene.id,
    chapter: gw.s.chapter + 1,
    who: called === undefined ? null : (card.cast[called[0]] ?? null),
    act: card.act,
    back: { direction, changed },
  });
  reasonOf(gw, seat, "paper_sent_back", who);
  if (!changed) {
    const ctx: SceneCtx = { gw, seat, cast: { who } };
    runEffects(ctx, [
      { kind: "pride", who: { role: "who" }, delta: 1 },
      { kind: "remember", key: "back_dug", who: { role: "who" }, weight: -1 },
    ]);
  }
  return null;
}
