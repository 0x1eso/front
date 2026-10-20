// P4 Task 13 (lane G): the naval and air history beats (spec §17.6).
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { NAVAL_BEATS } from "@openfront/engine-lib/ww1936/NavalBeats";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const scenario = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, "resources/maps/world1936/scenario.json"),
    "utf8",
  ),
);
const DATE = /^19[34]\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const KINDS = ["invade", "port_strike", "air_campaign", "paradrop"];

describe("naval beats (spec §17.6)", () => {
  it("has the 22 beats with unique ids, known countries and kinds", () => {
    expect(NAVAL_BEATS).toHaveLength(22);
    const ids = new Set(NAVAL_BEATS.map((b) => b.id));
    expect(ids.size).toBe(NAVAL_BEATS.length);
    for (const b of NAVAL_BEATS) {
      expect(COUNTRY_TAGS).toContain(b.tag);
      for (const v of b.vs ?? []) expect(COUNTRY_TAGS).toContain(v);
      expect(KINDS).toContain(b.kind);
      expect(b.targets.length, b.id).toBeGreaterThan(0);
    }
  });

  it("dates are ISO, in order, and a window ends after it starts", () => {
    let prev = "";
    for (const b of NAVAL_BEATS) {
      expect(b.from, b.id).toMatch(DATE);
      expect(b.from >= prev, b.id).toBe(true);
      prev = b.from;
      if (b.to !== undefined) {
        expect(b.to, b.id).toMatch(DATE);
        expect(b.to > b.from, b.id).toBe(true);
      }
    }
  });

  it("every target name is one world1936 region, coastal for a landing", () => {
    const bad: string[] = [];
    for (const b of NAVAL_BEATS) {
      for (const name of b.targets) {
        const hits = scenario.regions.filter(
          (r: { name: string }) => r.name === name,
        );
        if (hits.length !== 1)
          bad.push(`${b.id}: ${hits.length} regions named "${name}"`);
        else if (b.kind === "invade" && !hits[0].coastal)
          bad.push(`${b.id}: "${name}" is not coastal`);
      }
    }
    expect(bad).toEqual([]);
  });
});
