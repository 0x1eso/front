// ww229 (design ww227): LTU's national content, tier B. Empty until its
// lane fills it; how: /home/eser/dev/ww229-format.md. The character is F0's
// first guess from design §8; the lane checks it.
import type { NationDef } from "../types";

export const NATION_LTU: NationDef = {
  tag: "LTU",
  tier: "B",
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
  character: { lean: "revisionist", patrons: [] },
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
