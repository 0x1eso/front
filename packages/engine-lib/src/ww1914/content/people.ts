import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/** Placeholder cast for the two sample scenes; the people lane replaces it. */
export const GW_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "deu_bethmann",
    tag: "DEU",
    office: "chancellor",
    fit: ["chancellor"],
    camps: ["civil", "moderate"],
    temperaments: ["weary", "anxious"],
    rivals: ["deu_moltke"],
    allies: ["deu_jagow"],
    fame: 3,
    source: "Reich chancellor 1909-1917",
  },
  {
    id: "deu_moltke",
    tag: "DEU",
    office: "chief_of_staff",
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["anxious", "weary"],
    rivals: ["deu_bethmann"],
    allies: [],
    fame: 4,
    source: "Chief of the General Staff 1906-1914",
  },
  {
    id: "deu_jagow",
    tag: "DEU",
    office: "foreign",
    fit: ["foreign"],
    camps: ["civil", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: [],
    allies: ["deu_bethmann"],
    fame: 2,
    source: "State secretary for foreign affairs 1913-1916",
  },
];
