// P6 lane W2 (plan Task 8): aces (spec §15.2). An ace is a callsign on a
// fighter wing ("No. n Fighter Wing ace", n = the wing's id % 100 + 1;
// never a real name, spec §24): its air attack +10% and agility +5%. The
// wing model's aces (ww8, design §6): born when a wing's kills cross a
// multiple of 20 (aceOnFight), lost on a roll in its fights, retired with
// their wing. The rolls are P3's stateless
// wwRoll with the "ace_spawn" / "ace_death" purposes (spec §21.3). The
// notice (lane T's events_display.ww1936_ace {callsign, state}) carries the
// callsign number; the screen names it with ww1936.ace.callsign {n}.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  P_ACE_DEATH,
  P_ACE_SPAWN,
} from "@openfront/engine-lib/ww1936/DepthRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  ACE_DEATH_PM,
  ACE_KILLS,
  aceCallNo,
  WING_ACE_SPAWN_PM,
  WW_MAX_ACES,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import { xpTier } from "@openfront/engine-lib/ww1936/WingRules";
import type { Wing } from "../air/WwAir";
import type { WwDepth } from "./WwDepth";
/** Spec §15.2: the fighters and heavy fighters. */
const ACE_TYPES: ReadonlySet<number> = new Set([
  AIR_TYPES.indexOf("fighter"),
  AIR_TYPES.indexOf("heavy_fighter"),
]);

/** The planes of a record (its generations and its design slots). */
function planesOf(dep: Wing): number {
  let n = 0;
  for (const c of dep.counts) n += c;
  for (const c of dep.dcounts) n += c;
  return n;
}

// ---- ww8: aces on wings (design §6) ----

const aceOf = (d: WwDepth, w: Wing) =>
  w.ace === 0 ? undefined : d.sea.aces.find((a) => a.id === w.ace);

function dropAce(d: WwDepth, id: number): void {
  d.sea.aces = d.sea.aces.filter((x) => x.id !== id);
  d.markGlobal();
}

/**
 * The wing met the enemy this pulse (noteWingFight). An ace is lost on a
 * 0.5% roll, per day; a fighter wing of veteran or better whose kills crossed
 * a multiple of ACE_KILLS since its last roll gets an ace on a 15% roll.
 */
export function aceOnFight(d: WwDepth, w: Wing, day: number): void {
  const seed = d.ww.politics.seed;
  const air = d.ww.air;
  const ace = aceOf(d, w);
  if (ace !== undefined) {
    if (wwRoll(seed, P_ACE_DEATH, ace.id, day) % 1000 < ACE_DEATH_PM) {
      dropAce(d, ace.id);
      w.ace = 0;
      air.markWing(w.id);
      d.message(ace.owner, "ww1936_wing_ace", {
        callsign: ace.callNo,
        state: "lost",
      });
    }
    return;
  }
  if (w.ace !== 0) {
    w.ace = 0; // a stale id: no such ace
    air.markWing(w.id);
  }
  const mult = Math.floor(w.kills / ACE_KILLS);
  if (mult <= w.aceMark) return;
  w.aceMark = mult;
  if (!ACE_TYPES.has(w.type) && AIR_TYPES[w.type] !== "cv_fighter") return;
  if (xpTier(w.xpMilli) < 2) return;
  let have = 0;
  for (const a of d.sea.aces) if (a.owner === w.owner) have++;
  if (have >= WW_MAX_ACES) return;
  if (wwRoll(seed, P_ACE_SPAWN, w.id, mult) % 1000 >= WING_ACE_SPAWN_PM) {
    return;
  }
  const born = {
    id: d.uid(),
    owner: w.owner,
    deployment: w.id,
    sinceDay: day,
    callNo: aceCallNo(w.id),
  };
  d.sea.aces = [...d.sea.aces, born];
  w.ace = born.id;
  air.markWing(w.id);
  d.markGlobal();
  d.message(w.owner, "ww1936_wing_ace", {
    callsign: born.callNo,
    state: "rise",
  });
}

/** A wing that changed hands cannot keep its country's ace (from noteWingRest). */
export function aceRetireIfForeign(d: WwDepth, w: Wing): void {
  const ace = aceOf(d, w);
  if (ace === undefined || ace.owner === w.owner) return;
  dropAce(d, ace.id);
  w.ace = 0;
  d.ww.air.markWing(w.id);
}

/**
 * A wing is going (disband, wiped out): its ace moves to the owner's wing of
 * the same type with the most planes and no ace (ties: the smaller id), or
 * retires when there is none. Called before the wing leaves `air.wings`.
 */
export function aceOnWingGone(d: WwDepth, w: Wing): void {
  const ace = aceOf(d, w);
  if (ace === undefined) {
    w.ace = 0;
    return;
  }
  const air = d.ww.air;
  let best: Wing | null = null;
  let bestN = 0;
  if (ace.owner === w.owner) {
    for (const o of air.wings.values()) {
      if (o.id === w.id || o.owner !== w.owner || o.type !== w.type) continue;
      if (o.ace !== 0) continue;
      const n = planesOf(o);
      if (n > bestN) {
        best = o;
        bestN = n;
      }
    }
  }
  w.ace = 0;
  if (best === null) {
    dropAce(d, ace.id);
    d.message(ace.owner, "ww1936_wing_ace", {
      callsign: ace.callNo,
      state: "retired",
    });
    return;
  }
  d.sea.aces = d.sea.aces.map((a) =>
    a.id === ace.id ? { ...a, deployment: best.id } : a,
  );
  best.ace = ace.id;
  air.markWing(best.id);
  d.markGlobal();
}
