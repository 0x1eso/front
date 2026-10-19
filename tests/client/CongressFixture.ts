import {
  BallotData,
  CongressData,
} from "@openfront/engine-api/congress/CongressTypes";
import type { GameView } from "../../src/client/view";

/** A congress with seats 1-3 and nothing going on; the next session at tick 1800. */
export const EMPTY: CongressData = {
  nextSessionTick: 1800,
  session: null,
  seats: [1, 2, 3],
  active: [],
  emergency: null,
  available: [],
  cooldownUntilTick: 0,
  emergenciesLeft: 3,
  history: [],
  discountedTechs: [],
  aggressors: [],
  victims: [],
  verdicts: [],
};

export interface FakeCongress {
  now: number;
  data: CongressData;
  ballots: BallotData[];
  influence: number;
  /** My smallID (default 1). */
  me?: number;
  /** I am a member of the emergency (PlayerCongressData.emergencyMember). */
  emergencyMember?: boolean;
  /** Whether I am alive (default true). */
  alive?: boolean;
}

export const NAMES = ["", "me", "jiho", "seoyeon"];

/** Just the GameView the congress HUD reads; mutate `state` between ticks. */
export function fakeCongressGame(state: FakeCongress): GameView {
  const me = {
    smallID: () => state.me ?? 1,
    isAlive: () => state.alive ?? true,
    congressData: () => ({
      influence: state.influence,
      influencePerSec: 0.4,
      status: "peaceful",
      ballots: state.ballots,
      ...(state.emergencyMember ? { emergencyMember: true } : {}),
    }),
    isFriendly: () => false,
  };
  return {
    myPlayer: () => me,
    ticks: () => state.now,
    congressData: () => state.data,
    playerBySmallID: (id: number) => ({
      isPlayer: () => true,
      id: () => `p${id}`,
      displayName: () => NAMES[id] ?? "?",
    }),
    config: () => ({ congress: () => true }),
  } as unknown as GameView;
}
