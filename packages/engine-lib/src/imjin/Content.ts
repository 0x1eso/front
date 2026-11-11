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

export const IMJIN_CONTENT_PARTS: ContentParts = {
  ...CONTENT_PARTS,
  events: [
    ...CONTENT_PARTS.events.filter((e) => e.trigger === undefined),
    // ww177 P4 (lane I4a): the court, the flight, the righteous armies.
    ...IMJIN_COURT_EVENTS,
  ],
  decisions: [
    ...CONTENT_PARTS.decisions.filter((d) => d.for === "any"),
    ...IMJIN_COURT_DECISIONS,
  ],
  persons: [],
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
