// P5 lane A fills this file (plan Task 6): the aid AI (spec §12.5, §13.5).
// The foundation's stub: nothing; P3 answers every event.
import type { LendLeaseItem } from "@openfront/engine-api/ww1936/EndgameTypes";
import type { WwEndgame } from "./WwEndgame";

export function aiAidDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  void eg;
  void id;
  void day;
  void tick;
}

/** How much an AI giver wants to answer `to`'s request for `item`. Stub: 0. */
export function llRequestScore(
  eg: WwEndgame,
  from: number,
  to: number,
  item: LendLeaseItem,
): number {
  void eg;
  void from;
  void to;
  void item;
  return 0;
}

/**
 * P3 aiChooseOption's first question (pre-flight §A A): the option an AI
 * receiver of an aid event takes (gen_diplo_lend_lease by llRequestScore),
 * or null to let P3 choose. Stub: null.
 */
export function aiAidEventChoice(
  eg: WwEndgame,
  eventId: string,
  self: number,
  from: number,
): string | null {
  void eg;
  void eventId;
  void self;
  void from;
  return null;
}
