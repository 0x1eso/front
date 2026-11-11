// ww177 (Imjin design §2, §7): the Imjin War's politics content. P6 writes
// its own scenes, preparations and people; until then it is the 1936 rules'
// machinery with nothing of 1936's history in it: every country plays the
// generic tree, no dated or triggered event, no country's own decision, no
// history beat, no 1936 people, pacts, claims, cores or peace tables.
import {
  buildRegistry,
  CONTENT_PARTS,
  ContentParts,
  ContentRegistry,
} from "../ww1936/content/registry";
import { IMJIN_COURT_DECISIONS, IMJIN_COURT_EVENTS } from "./CourtScenes";
import {
  IMJIN_JAPAN_DECISIONS,
  IMJIN_JAPAN_EVENTS,
  IMJIN_JAPAN_FLAGS,
  IMJIN_JAPAN_SPIRITS,
} from "./JapanContent";
import {
  IMJIN_JPW_DECISION_FLAGS,
  IMJIN_JPW_DECISIONS,
  IMJIN_JPW_EVENTS,
  IMJIN_JPW_FLAGS,
  IMJIN_JPW_GROUPS,
  IMJIN_JPW_PERSONS,
  IMJIN_JPW_SPIRITS,
} from "./JapanWriting";
import {
  JOS_DECISIONS,
  JOS_EVENTS,
  JOS_FLAGS,
  JOS_GROUPS,
  JOS_PERSONS,
  JOS_SPIRITS,
} from "./JoseonContent";
import { withImjinDates } from "./PersonDates";

export const IMJIN_CONTENT_PARTS: ContentParts = {
  ...CONTENT_PARTS,
  events: [
    ...CONTENT_PARTS.events.filter((e) => e.trigger === undefined),
    // ww177 P4 (lane I4a): the court, the flight, the righteous armies.
    ...IMJIN_COURT_EVENTS,
    // ww177 I4b: Japan's politics and the truce (JapanContent.ts).
    ...IMJIN_JAPAN_EVENTS,
    // ww177 P6 (lane I6a): Joseon's run-up and war scenes.
    ...JOS_EVENTS,
    // ww177 I6b: Japan's run-up and war scenes (JapanWriting.ts).
    ...IMJIN_JPW_EVENTS,
  ],
  decisions: [
    ...CONTENT_PARTS.decisions.filter((d) => d.for === "any"),
    ...IMJIN_COURT_DECISIONS,
    ...IMJIN_JAPAN_DECISIONS,
    ...JOS_DECISIONS,
    ...IMJIN_JPW_DECISIONS,
  ],
  spirits: [
    ...CONTENT_PARTS.spirits,
    ...IMJIN_JAPAN_SPIRITS,
    ...JOS_SPIRITS,
    ...IMJIN_JPW_SPIRITS,
  ],
  flags: [
    ...CONTENT_PARTS.flags,
    ...IMJIN_JAPAN_FLAGS,
    ...JOS_FLAGS,
    ...IMJIN_JPW_FLAGS,
    ...IMJIN_JPW_DECISION_FLAGS,
  ],
  groups: [...CONTENT_PARTS.groups, ...JOS_GROUPS, ...IMJIN_JPW_GROUPS],
  // ww177 merge 3: with their real dates, on the game's calendar.
  persons: withImjinDates([...JOS_PERSONS, ...IMJIN_JPW_PERSONS]),
  beats: [],
  countries: [],
  claims: [],
  startNaps: [],
  peace: [],
  cores: [],
  seeds: [],
  occupationDefaults: [],
  startDoctrines: [],
  startThoughts: [],
  startFieldMarshals: [],
  scientists: [],
  nukeTargets: [],
  agencyStarts: [],
};

let built: ContentRegistry | null = null;

/** Built on first use (the 1936 game never pays for it). */
export function imjinContent(): ContentRegistry {
  built ??= buildRegistry(IMJIN_CONTENT_PARTS);
  return built;
}
