// World War 1936 P5 (spec §6.5, §7.1; plan decision 30): the historical
// peace rows and the 1936 cores. Passes on empty tables; K5 fills them.
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { WwConditionSchema } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { CONTENT_TARGETS, emptyOrAtLeast } from "./contentUtil";

const TAGS = new Set<string>(COUNTRY_TAGS);
const DEMANDS = new Set([
  "take_group",
  "occupation_zone",
  "demilitarise",
  "take_for",
  "annex_rest",
  "puppet",
  "change_government",
  "dismantle",
  "disarm",
  "release",
  "liberate",
  "reparations",
  "take_navy",
]);

describe("World War 1936 P5: peace data", () => {
  const { peace, groupIdx, cores } = CONTENT;

  it("there are as many rows as planned", () => {
    expect(emptyOrAtLeast(peace.length, CONTENT_TARGETS.peace)).toBe(true);
  });

  it("every row names real countries, groups and demand kinds", () => {
    const coreTags = new Set(cores.map((c) => c.tag));
    const scenario = new Set<string>(
      COUNTRY_TAGS.filter((t) => !t.startsWith("CW")),
    );
    for (const r of peace) {
      expect(TAGS.has(r.loser), r.loser).toBe(true);
      if (r.when) WwConditionSchema.parse(r.when);
      for (const l of r.lines) {
        if (l.when) WwConditionSchema.parse(l.when);
        if (typeof l.by === "object" && "tag" in l.by) {
          expect(TAGS.has(l.by.tag), `${r.loser} by ${l.by.tag}`).toBe(true);
        }
        for (const d of l.demands) {
          expect(DEMANDS.has(d.kind), `${r.loser} ${d.kind}`).toBe(true);
          if ("group" in d) {
            expect(groupIdx.has(d.group), `${r.loser} ${d.group}`).toBe(true);
          }
          if ("beneficiary" in d) {
            expect(TAGS.has(d.beneficiary), d.beneficiary).toBe(true);
          }
          if ("target" in d && d.target !== undefined) {
            expect(TAGS.has(d.target), d.target).toBe(true);
          }
          if (d.kind === "release" || d.kind === "liberate") {
            expect(
              coreTags.has(d.tag) || scenario.has(d.tag),
              `${r.loser} frees ${d.tag}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("every 1936 core names a real country and real groups", () => {
    for (const c of cores) {
      expect(TAGS.has(c.tag), c.tag).toBe(true);
      for (const g of c.groups) {
        expect(groupIdx.has(g), `${c.tag} ${g}`).toBe(true);
      }
    }
    expect(new Set(cores.map((c) => c.tag)).size).toBe(cores.length);
  });

  it("the registry indexes the rows by loser and the cores by tag", () => {
    for (const r of peace) {
      expect(CONTENT.peaceByLoser.get(r.loser)).toContain(r);
    }
    for (const c of cores) {
      expect(CONTENT.coresByTag.get(c.tag)).toEqual(c.groups);
    }
  });
});
