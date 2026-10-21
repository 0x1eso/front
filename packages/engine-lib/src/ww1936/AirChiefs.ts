// World War 1936 P4 — the navy-chief and air-chief advisors (spec §16.3).
// Plan Task 1 Step 15 names the table P4_PERSONS; the rows live in
// content/persons/p4.ts (P3 plan decision 31: one file per lane) and the
// P3 registry appends them after the P3 persons.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { PERSONS_P4 } from "./content/persons/p4";

export const P4_PERSONS: readonly PersonDef[] = PERSONS_P4;
