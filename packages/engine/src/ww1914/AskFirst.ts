// Great War 1914 (ww172): "먼저 묻는다". A decision's option that only a talk's
// memory opens can be asked for from the decision itself: the talk comes at
// once, past its own window, at a summons' price, and the decision waits for
// it with the chapter's clock held. Also: a talk whose keys nobody will read
// again, and that leaves nothing else, no longer comes (spentTalk).
import { GwCard, GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwAskIndex, gwMemoryKeys } from "@openfront/engine-lib/ww1914/AskIndex";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { makeCard, placeCard } from "./Desk";
import type { GreatWar } from "./GreatWar";
import { spendHouseCall } from "./House";
import { castOf, ctxOf, holds, needsDecision, sceneOf } from "./SceneRun";
import { inOpening, newcomers } from "./Story";

/** How long an asked talk holds the chapter's clock, at most: seconds. */
export const GW_ASK_HOLD_SEC = 180;
const GW_ASK_HOLD_TICKS = GW_ASK_HOLD_SEC * 10;

/** A talk that can be asked from a decision, and the options it may open. */
export interface GwAskOffer {
  topic: string;
  /** The person it is held with. */
  who: string;
  options: string[];
}

/** Called with a private meeting, not a summons. */
export function isPrivateTalk(scene: GwScene): boolean {
  return scene.tags.includes("private");
}

/** Why the seat can't pay for a summons on `topic` now; null when it can. */
export function summonPrice(
  seat: GwSeatState,
  scene: GwScene | null,
  topic: string,
): GwOrderBlock | null {
  const own = scene !== null && isPrivateTalk(scene);
  const extra = (seat.house?.calls ?? 0) > 0 && topic.startsWith("gw_lb_");
  if (own && seat.privates <= 0) return "no_private";
  if (!own && !extra && seat.audiences <= 0) return "no_audience";
  return null;
}

/** Pays for a summons: a private meeting, a house call, or an audience. */
export function paySummon(
  seat: GwSeatState,
  scene: GwScene,
  topic: string,
): void {
  if (isPrivateTalk(scene)) seat.privates--;
  // A lobby talk spends the house's extra calls first (owner's call 2).
  else if (!spendHouseCall(seat, topic)) seat.audiences--;
}

/**
 * The person a talk would be held with if asked now; null when it can't be.
 * Its own `when` and stage are passed over; the person must be about, as for
 * a summons, and the talk not yet held.
 */
function askPerson(
  gw: GreatWar,
  seat: GwSeatState,
  talk: GwScene,
): string | null {
  if (talk.kind !== "talk" || talk.who === undefined) return null;
  if (talk.big === true || talk.prologue !== undefined) return null;
  if (talk.scheduledOnly === true || !talk.nation.includes(seat.tag)) {
    return null;
  }
  if (seat.seen[talk.id] !== undefined) return null;
  if (seat.desk.some((c) => c.scene === talk.id)) return null;
  const who = castOf(gw, seat, talk)?.[talk.who];
  if (who === undefined || gw.person(who)?.status !== "active") return null;
  if (inOpening(gw, seat) && newcomers(gw, seat, [who]).length > 0) {
    return null;
  }
  return who;
}

/** The talks that could open a closed option of `card`, one row each. */
export function askOffers(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
): GwAskOffer[] {
  const scene = sceneOf(card.scene);
  if (scene === null || scene.kind === "talk" || !needsDecision(card)) {
    return [];
  }
  const ix = gwAskIndex(gwContent());
  const ctx = ctxOf(gw, seat, card);
  const out: GwAskOffer[] = [];
  const people = new Map<string, string | null>();
  for (const o of scene.options ?? []) {
    if (o.when === undefined || holds(ctx, o.when)) continue;
    for (const key of gwMemoryKeys(o.when)) {
      for (const id of ix.writers.get(key) ?? []) {
        const had = out.find((x) => x.topic === id);
        if (had?.options.includes(o.id) === true) continue;
        let who = people.get(id);
        if (who === undefined) {
          const talk = sceneOf(id);
          who = talk === null ? null : askPerson(gw, seat, talk);
          people.set(id, who);
        }
        if (who === null) continue;
        // Only memory stands in the way: with what this talk remembers, it opens.
        const assume = new Set(ix.talks.get(id)?.keys ?? []);
        if (!holds({ ...ctx, assume }, o.when)) continue;
        if (had !== undefined) had.options.push(o.id);
        else out.push({ topic: id, who, options: [o.id] });
      }
    }
  }
  return out;
}

/** The order: the talk comes now, the decision stays and waits for it. */
export function askFirst(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
  topic: string,
): GwOrderBlock | null {
  const card = seat.desk.find((c) => c.uid === uid);
  if (card === undefined) return "no_card";
  const talk = sceneOf(topic);
  if (talk === null || !askOffers(gw, seat, card).some((x) => x.topic === topic)) {
    return "no_topic";
  }
  const price = summonPrice(seat, talk, topic);
  if (price !== null) return price;
  const made = makeCard(gw, seat, talk, "summon");
  if (made === null) return "no_topic";
  paySummon(seat, talk, topic);
  made.ask = { from: card.uid, at: gw.mg.ticks() };
  placeCard(gw, seat, made);
  return null;
}

/** A talk asked from a decision still on the desk is running: the clock waits. */
export function askHolds(gw: GreatWar, ticks: number): boolean {
  return gw.s.seats.some((seat) =>
    seat.desk.some(
      (c) =>
        c.ask !== undefined &&
        ticks - c.ask.at < GW_ASK_HOLD_TICKS &&
        seat.desk.some((d) => d.uid === c.ask!.from),
    ),
  );
}

/**
 * A talk with nothing left to do: every key it remembers that a scene of this
 * country reads is read only by `once` scenes already done with, and it leaves
 * nothing else (AskIndex `lasting`). A talk read by nobody is not spent.
 */
export function spentTalk(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
): boolean {
  if (scene.kind !== "talk") return false;
  const ix = gwAskIndex(gwContent());
  const w = ix.talks.get(scene.id);
  if (w === undefined || w.lasting) return false;
  let read = false;
  for (const k of w.keys) {
    const r = ix.readers.get(k);
    if (r === undefined) continue;
    if (r.elsewhere) return false;
    for (const id of r.scenes) {
      const x = id === scene.id ? null : sceneOf(id);
      if (x === null || !x.nation.includes(seat.tag)) continue;
      read = true;
      if (x.once !== true || seat.seen[id] === undefined) return false;
      if (seat.desk.some((c) => c.scene === id)) return false;
      if (seat.scheduled.some((q) => q.scene === id)) return false;
    }
  }
  return read;
}
