// World War 1936 P3 (spec §17.8): the region groups against the real map.
// Passes on an empty table; lane K5 fills it.
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import fs from "fs";
import path from "path";

const scenario = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/maps/world1936/scenario.json"),
    "utf8",
  ),
) as { regions: { id: number; owner: string }[] };
const ownerOf = new Map(scenario.regions.map((r) => [r.id, r.owner]));

/** Spec §17.8's 27 groups. */
const SPEC_GROUPS = [
  "rhineland",
  "sudetenland",
  "bohemia_moravia",
  "slovakia",
  "south_slovakia",
  "carpathian_ruthenia",
  "zaolzie",
  "memel",
  "danzig",
  "polish_corridor",
  "vilnius",
  "karelian_isthmus",
  "ladoga_karelia",
  "salla",
  "bessarabia",
  "north_bukovina",
  "north_transylvania",
  "south_dobruja",
  "hatay",
  "french_border_de",
  "stalin_line",
  "ural_industry",
  "soviet_west_industry",
  "far_east_soviet",
  "addis_ababa",
  "singapore",
  "malta_gibraltar",
];
/** Groups one chain uses together: never overlapping. */
const CHAINS = [
  [
    "bohemia_moravia",
    "slovakia",
    "carpathian_ruthenia",
    "south_slovakia",
    "sudetenland",
  ],
  ["karelian_isthmus", "ladoga_karelia", "salla"],
  ["bessarabia", "north_bukovina"],
  ["north_transylvania", "south_dobruja"],
];

describe("region groups", () => {
  const { groups, groupIdx } = CONTENT;

  it("ids are unique; every group has regions of its 1936 owner", () => {
    expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length);
    for (const g of groups) {
      expect(g.regions.length, g.id).toBeGreaterThan(0);
      for (const r of g.regions) {
        expect(ownerOf.get(r), `${g.id} ${r}`).toBe(g.owner1936);
      }
    }
  });

  it("the groups of one chain do not overlap", () => {
    for (const chain of CHAINS) {
      const seen = new Map<number, string>();
      for (const id of chain) {
        for (const r of groupIdx.get(id)?.regions ?? []) {
          expect(seen.get(r), `${id} ${r}`).toBeUndefined();
          seen.set(r, id);
        }
      }
    }
  });

  it("spec §17.8's groups are all there (once lane K5 has filled the table)", () => {
    if (groups.length === 0) return;
    for (const id of SPEC_GROUPS) expect(groupIdx.has(id), id).toBe(true);
  });
});
