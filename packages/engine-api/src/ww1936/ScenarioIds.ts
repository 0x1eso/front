/**
 * ww177 (Imjin design §2): the scenario profiles of the 1936 engine. The
 * game config's `ww1936Scenario` names one; absent means "ww1936", so the
 * 1936 game and its digests stay as they are. engine-lib's
 * `ww1936/scenario/Profile.ts` reads it.
 */
export const WW_SCENARIO_IDS = ["ww1936", "imjin1590"] as const;
export type WwScenarioIdKey = (typeof WW_SCENARIO_IDS)[number];

/**
 * Imjin design §10, decision 7B: the lobby's calendar rows. "y1590" (the
 * 1590 embassy, about 45 minutes) is the default; "y1592" starts on the eve
 * of the landing (about 30 minutes); "long" plays the 1590 start at half
 * speed (about 90 minutes); "unlimited" has no timer.
 */
export const IMJIN_CALENDAR_IDS = [
  "y1592",
  "y1590",
  "long",
  "unlimited",
] as const;
export type ImjinCalendarId = (typeof IMJIN_CALENDAR_IDS)[number];
