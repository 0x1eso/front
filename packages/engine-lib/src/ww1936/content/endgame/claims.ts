// World War 1936 P5 (spec §16.4): claims added to the P3 table (the registry
// joins the groups of the same tag). They make the peace conference cheaper
// for the claimant (spec §6.3) and allow claim war goals. China's claim on
// Taiwan follows the 1945-10-25 return; it is used by the conference only.
import type { ClaimDef } from "../types";

export const CLAIMS_P5: ClaimDef[] = [
  { tag: "CHN", groups: ["taiwan", "kwantung", "manchuria"] },
  { tag: "GRC", groups: ["dodecanese"] },
  { tag: "YUG", groups: ["istria"] },
  { tag: "FRA", groups: ["alsace_lorraine"] },
  { tag: "POL", groups: ["vilnius"] },
  { tag: "ROU", groups: ["north_transylvania", "bessarabia"] },
  { tag: "FIN", groups: ["karelian_isthmus", "ladoga_karelia"] },
];
