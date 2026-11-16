// ww229 (design ww227): RAJ's national content, tier B. Empty until its
// lane fills it; how: /home/eser/dev/ww229-format.md. The character is F0's
// first guess from design §8; the lane checks it.
import type { NationDef } from "../types";

export const NATION_RAJ: NationDef = {
  tag: "RAJ",
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
  character: { lean: "client", patrons: ["GBR"] },
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
