// P5 lane W fills this file (plan Task 2): the peace conference (spec §6).
// The foundation's stub: no conference opens; a submission is refused.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  PeaceDemand,
  WwConferenceView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { WwEndgame } from "./WwEndgame";

/** Spec §6.1: a conference for the ended wars `warIds`; its id (0: none). Stub: 0. */
export function openConference(
  eg: WwEndgame,
  warIds: readonly number[],
  tick: number,
): number {
  void eg;
  void warIds;
  void tick;
  return 0;
}

/** Spec §6.2 (plan decisions 33, 34): round deadlines, AI-only conferences in one tick. Stub: nothing. */
export function stepConferences(eg: WwEndgame, tick: number): void {
  void eg;
  void tick;
}

/** peace_submit / peace_pass (null demands). Stub: "not_participant". */
export function submitDemands(
  eg: WwEndgame,
  smallID: number,
  conf: number,
  demands: readonly PeaceDemand[] | null,
  tick: number,
): WwOrderBlock | null {
  void eg;
  void smallID;
  void conf;
  void demands;
  void tick;
  return "not_participant";
}

/** The conference card's data (spec §21.4). Stub: the conference's numbers as they are. */
export function conferenceView(eg: WwEndgame, conf: number): WwConferenceView {
  const c = eg.conferences.find((x) => x.id === conf);
  return {
    id: conf,
    losers: c === undefined ? [] : [...c.losers],
    status:
      c === undefined || c.status === 2
        ? "done"
        : c.status === 1
          ? "open"
          : "queued",
    round: c?.round ?? 0,
    roundEndTick: c?.roundEndTick ?? 0,
    participants: (c?.parts ?? []).map((p, i) => ({
      id: p.id,
      pts: p.pts,
      sharePm: 0,
      order: i,
      human: p.human,
      final: false,
    })),
    stake: (c?.stake ?? []).map((r, i) => ({
      region: r,
      base: c?.base[i] ?? 0,
      settledBy: 0,
      zone: eg.isZone(r),
    })),
    mine: [],
    lastRound: [],
    releasable: [],
    claims: (c?.claims ?? []).map(([p, r]) => [p, r]),
    conquer: (c?.conquer ?? []).map(([p, l]) => [p, l]),
    topple: (c?.topple ?? []).map(([p, l]) => [p, l]),
    reserved: [],
  };
}
