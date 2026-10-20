// World War 1936 P5 (spec §7.1): cores held on 1936-01-01 beyond the
// scenario's own (a region whose scenario `core` is true is a core of its 1936
// owner). The named dormant countries hold the cores of their groups from the
// start; China keeps a core on the Manchukuo regions (Chinese before 1931).
// No core is given on Korea or Taiwan.
import type { CoreDef } from "../types";

export const CORES_1936: CoreDef[] = [
  { tag: "SVK", groups: ["slovakia"] },
  { tag: "HRV", groups: ["croatia"] },
  { tag: "MEN", groups: ["inner_mongolia"] },
  { tag: "BRM", groups: ["burma"] },
  { tag: "PHL", groups: ["philippines"] },
  { tag: "CHN", groups: ["manchuria"] },
];
