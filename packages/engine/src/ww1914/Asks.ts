// Great War 1914: allies' asks and conferences (brief ww158, S2). An ask
// (`<TAG>_ASKS`) comes once its `when` holds, as its scene: a letter from the
// ally's head (`letter`, cast `{ ruler_of }`), the ambassador's paper, or, for
// a `conference` row, a big scene a chapter after the envoy's word on what the
// ally will do (an `ally` report that may be wrong). Its options answer with
// the `ask` effect. Yes is a promise to that head in the notebook, kept by
// itself the chapter the row's `keep` holds; the `law` kind brings the bill into
// the house with `ally` origin and heats the factions against it. Kept: trust
// up and the row's `kept` (the aid); broken: trust down, `broken`, and the
// ally's cold wire. No: trust down at once. Only while a head can write: no ask
// comes from a country another seat holds or whose ruler is gone.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TRUST_MAX, GW_TRUST_MIN } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GwAskRow } from "@openfront/engine-lib/ww1914/HouseRows";
import type { GreatWar } from "./GreatWar";
import { billRow, houseBring, houseEffect } from "./House";
import { sendHouseReport } from "./Intel";
import { holds, runEffects, SceneCtx, sceneOf } from "./SceneRun";
import { headOf } from "./Story";
import { reason } from "./World";

/** The ally's cold shoulder after a broken word (scenes/gw_dip). */
const COLD = "gw_d_ally_cold";
/** Chapters between the envoy's word and the conference. */
const ENVOY_AHEAD = 1;

type AskCond = Extract<GwWorldCond, { is: "ask" }>;
type AskEffect = Extract<GwWorldEffect, { do: "ask" }>;

function askRows(tag: GwTag): GwAskRow[] {
  return (gwContent().asks ?? []).filter((a) => a.tag === tag);
}

function askRow(id: string): GwAskRow | null {
  return (gwContent().asks ?? []).find((a) => a.id === id) ?? null;
}

const promiseKey = (id: string) => `ask_${id}`;

function moveTrust(gw: GreatWar, seat: GwSeatState, tag: GwTag, by: number) {
  const n = gw.nation(seat.tag);
  if (n === null) return;
  const v = (n.trust[tag] ?? 0) + by;
  n.trust[tag] = Math.max(GW_TRUST_MIN, Math.min(GW_TRUST_MAX, v));
}

/** How the ally stands with us, as the envoy would put it: 0 cold .. 2 warm. */
export function allyBand(gw: GreatWar, seat: GwSeatState, tag: GwTag): number {
  const t = gw.nation(seat.tag)?.trust[tag] ?? 0;
  return t <= -1 ? 0 : t >= 2 ? 2 : 1;
}

/** A new ask comes: at most one a chapter, its scene on the way. */
function arrive(gw: GreatWar, seat: GwSeatState): void {
  const h = seat.house!;
  const ctx: SceneCtx = { gw, seat, cast: {} };
  for (const row of askRows(seat.tag)) {
    if (h.asks.some((a) => a.id === row.id)) continue;
    if (sceneOf(row.scene) === null || headOf(gw, seat, row.from) === null) {
      continue;
    }
    if (!holds(ctx, row.when)) continue;
    h.asks.push({ id: row.id, stage: "asked", chapter: gw.s.chapter });
    let wait = 1;
    if (row.conference === true) {
      const band = allyBand(gw, seat, row.from);
      sendHouseReport(gw, seat, "ally", band, "envoy", row.id);
      wait += ENVOY_AHEAD;
    }
    seat.scheduled.push({ scene: row.scene, chapter: gw.s.chapter + wait });
    return;
  }
}

/** A yes falls due: the promise kept by the state, or broken by the calendar. */
function settle(gw: GreatWar, seat: GwSeatState): void {
  const ctx: SceneCtx = { gw, seat, cast: {} };
  for (const a of seat.house!.asks) {
    if (a.stage !== "yes") continue;
    const row = askRow(a.id);
    const p = seat.promises.find((x) => x.key === promiseKey(a.id));
    if (row === null || p === undefined) continue;
    if (p.kept) {
      a.stage = "kept";
      a.chapter = gw.s.chapter;
      moveTrust(gw, seat, row.from, 1);
      runEffects(ctx, row.kept ?? []);
      reason(gw, seat, "ask_kept", p.who);
    } else if (p.broken) {
      a.stage = "broken";
      a.chapter = gw.s.chapter;
      moveTrust(gw, seat, row.from, -1);
      runEffects(ctx, row.broken ?? []);
      reason(gw, seat, "ask_broken", p.who);
    }
  }
}

/** Chapter step: promises to allies settle, then a new ask may come. */
export function alliesStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.house === undefined || seat.memoir !== null) continue;
    settle(gw, seat);
    arrive(gw, seat);
  }
}

export function askHolds(ctx: SceneCtx, c: AskCond): boolean {
  const a = ctx.seat.house?.asks.find((x) => x.id === c.id) ?? null;
  return a !== null && c.of.includes(a.stage);
}

/** The answer, once: yes is a promise to that head, no costs his trust. */
export function askEffect(ctx: SceneCtx, e: AskEffect): void {
  const { gw, seat } = ctx;
  const row = askRow(e.id);
  const h = seat.house;
  if (row === null || h === undefined || row.tag !== seat.tag) return;
  let a = h.asks.find((x) => x.id === e.id);
  if (a === undefined) {
    // Answered from a scene before the row came by itself: it counts as asked.
    a = { id: e.id, stage: "asked", chapter: gw.s.chapter };
    h.asks.push(a);
  }
  if (a.stage !== "asked") return;
  a.chapter = gw.s.chapter;
  const head = headOf(gw, seat, row.from);
  if (e.answer === "no") {
    a.stage = "no";
    moveTrust(gw, seat, row.from, -1);
    reason(gw, seat, "ask_refused", head?.id);
    return;
  }
  a.stage = "yes";
  if (head !== null) {
    seat.promises.push({
      key: promiseKey(row.id),
      who: head.id,
      due: gw.s.chapter + row.chapters,
      kept: false,
      broken: false,
      keep: JSON.stringify(row.keep),
      back: sceneOf(COLD) === null ? null : COLD,
    });
  }
  reason(gw, seat, "ask_taken", head?.id);
  if (row.kind !== "law" || row.law === undefined) return;
  houseBring(gw, seat, row.law, "ally", null);
  // The factions against the bill take it ill that a foreigner asked for it.
  const bill = billRow(seat, row.law);
  for (const [id, side] of Object.entries(bill?.stance ?? {})) {
    if (side < 0) houseEffect(ctx, { do: "faction", id, delta: 1 });
  }
}
