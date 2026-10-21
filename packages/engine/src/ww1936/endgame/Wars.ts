// P5 lane W fills this file (plan Task 2): wars ending, war score,
// reparations and disarmament. The foundation's stub: addWarScore and
// warSummary have their bodies; the rest is neutral.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  WwWar,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { EconAdjust, WwEndgame } from "./WwEndgame";

/** Spec §4.4: a war ends when one side has no active member; opens conferences. Stub: nothing. */
export function checkWarEnds(eg: WwEndgame, day: number, tick: number): void {
  void eg;
  void day;
  void tick;
}

/** Adds `milli` war score to `smallID`'s membership of war `warId`. */
export function addWarScore(
  eg: WwEndgame,
  warId: number,
  smallID: number,
  milli: number,
): void {
  const w = eg.war(warId);
  const m = w === null ? null : eg.member(w, smallID);
  if (m === null) return;
  m.wsMilli += milli;
  eg.dirtyWars = true;
}

/** P2 battle casualties: `by` killed `men` of `against` (spec §4.5). Stub: nothing. */
export function noteDamage(
  eg: WwEndgame,
  by: number,
  against: number,
  men: number,
): void {
  void eg;
  void by;
  void against;
  void men;
}

/** P4 kills: ships (by weight), convoys, planes (spec §4.5). Stub: nothing. */
export function noteKills(
  eg: WwEndgame,
  by: number,
  against: number,
  kind: "ship" | "convoy" | "plane",
  amount: number,
): void {
  void eg;
  void by;
  void against;
  void kind;
  void amount;
}

/** Spec §4.5: the day's occupation points. Stub: nothing. */
export function dailyWarScore(eg: WwEndgame, day: number): void {
  void eg;
  void day;
}

/** Spec §6.4 reparations: the civilian factories paid / received today. Stub: nothing. */
export function reparationsEconomy(
  eg: WwEndgame,
  id: number,
  out: EconAdjust,
): void {
  void eg;
  void id;
  void out;
}

/** Spec §6.4 disarm: why `id` may not train / build ships / build docks. Stub: never. */
export function disarmBlockOf(
  eg: WwEndgame,
  id: number,
  what: "train" | "naval" | "dock",
): WwOrderBlock | null {
  void eg;
  void id;
  void what;
  return null;
}

/** `smallID`'s share (‰) of its side's war score in its war against `ofSmallID`. Stub: 0. */
export function warScoreShare(
  eg: WwEndgame,
  smallID: number,
  ofSmallID: number,
): number {
  void eg;
  void smallID;
  void ofSmallID;
  return 0;
}

/** The screens' line of a war: its sides, each member's ‰ of its side's war score. */
export function warSummary(eg: WwEndgame, w: WwWar): WwWarSummary {
  void eg;
  return {
    id: w.id,
    kind: w.kind,
    startDay: w.startDay,
    sides: w.sides.map((s) => {
      let sum = 0;
      for (const m of s.members) sum += Math.max(0, m.wsMilli);
      const n = s.members.length;
      return {
        leader: s.leader,
        members: s.members.map((m) => ({
          id: m.id,
          state: m.state,
          sharePm:
            sum === 0
              ? Math.floor(1000 / Math.max(1, n))
              : Math.floor((Math.max(0, m.wsMilli) * 1000) / sum),
        })),
      };
    }),
    ended: w.ended !== null,
  };
}
