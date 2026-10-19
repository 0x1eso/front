import { CongressData } from "@openfront/engine-api/congress/CongressTypes";

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
