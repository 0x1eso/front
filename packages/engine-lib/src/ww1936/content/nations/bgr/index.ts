// ww229 (design ww227): BGR's national content, tier A. Empty until its
// lane fills it; how: /home/eser/dev/ww229-format.md. The character is F0's
// first guess from design §8; the lane checks it.
import type { NationDef } from "../types";

export const NATION_BGR: NationDef = {
  tag: "BGR",
  tier: "A",
  sheet: {
    situation: "",
    startSpirits: [],
    dilemmas: [],
    mechanism: "",
    patrons: [],
    rivals: [],
    unions: [],
    claims: [],
    people: [],
    equipment: [],
  },
  character: { lean: "revisionist", patrons: ["DEU"] },
  focuses: [],
  path: [],
  branchPoints: [],
  events: [],
  decisions: [],
  spirits: [],
  persons: [],
  flags: [],
  groups: [],
  claims: [],
  templates: [],
  aliases: {},
  dropped: [],
};
