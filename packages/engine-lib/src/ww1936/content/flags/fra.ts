// World War 1936 P5 — French and Vichy flags (the base lists already hold
// heavy_water, can_create_faction and the other spec-named flags).
export const FLAGS_FRA: string[] = [
  // fra_no_munich sets it; the Munich conference's AI reads it (spec §18.4:
  // France keeps Czechoslovakia ×300%).
  "fra_resolute",
  // World flag: the Allies have landed in French North Africa (vic_torch,
  // either option); deu_case_anton waits for it when it is not a beat.
  "vic_torch_done",
];
