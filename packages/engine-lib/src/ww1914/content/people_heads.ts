import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * Two heads of state who were only ever the seat: another country's letters
 * need them as people (StoryRows GW_HEADS). Off their own country's people
 * screen (GW_SEAT_PERSON). Text is in resources/ww1914/ko/common.people.json.
 * Append: order matters to the seed rolls.
 */
export const GW_PEOPLE_HEADS: readonly GwPersonDef[] = [
  {
    id: "deu_wilhelm",
    tag: "DEU",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["arrogant", "anxious"],
    rivals: [],
    allies: [],
    fame: 5,
    unlisted: true,
    source: "b. 27 Jan 1859; German Emperor from 15 Jun 1888 (memory)",
  },
  {
    id: "auh_franz_joseph",
    tag: "AUH",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["stubborn", "weary"],
    rivals: [],
    allies: [],
    fame: 5,
    unlisted: true,
    source: "b. 18 Aug 1830; Emperor from 2 Dec 1848; d. 21 Nov 1916 (memory)",
  },
];
