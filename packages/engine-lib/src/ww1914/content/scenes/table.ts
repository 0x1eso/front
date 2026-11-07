import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * What the painted map costs, told after it was signed: the foreign minister's
 * note on who read it and what they made of it. Text: <TAG>.table.json.
 */
const claimsAtLeast = (min: number): GwCond => ({ kind: "claims", min });

const paper = (tag: GwTag): GwScene => ({
  id: `gw_t_claims_${tag.toLowerCase()}`,
  nation: [tag],
  kind: "wire",
  scheduledOnly: true,
  cast: { fm: { any_of: [{ office: "foreign" }, { favourite: true }] } },
  salience: 7,
  tags: ["foreign"],
  variants: [
    { id: "vast", when: claimsAtLeast(17) },
    { id: "wide", when: claimsAtLeast(7) },
    { id: "modest" },
  ],
});

export const TABLE_SCENES: readonly GwScene[] = (
  ["DEU", "GBR", "AUH", "RUS"] as const
).map(paper);
