// World War 1936 P3 (spec §8.4, §19.9, §23): the persons. Passes on empty
// tables; the content lanes fill them (plan Task 1 Step 15).
import { SLOT_BRANCHES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { CONTENT_TARGETS, emptyOrAtLeast, en, keyIn, ko } from "./contentUtil";

describe("person data", () => {
  const { persons, traitIdx } = CONTENT;

  it("ids are unique", () => {
    const ids = persons.map((p) => p.id);
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([]);
  });

  it("there are as many as planned", () => {
    expect(emptyOrAtLeast(persons.length, CONTENT_TARGETS.persons)).toBe(true);
  });

  it("dates run forward; every person has a source", () => {
    for (const p of persons) {
      if (p.from !== undefined && p.until !== undefined) {
        expect(dayOfDate(p.from), p.id).toBeLessThan(dayOfDate(p.until));
      }
      expect(p.source.trim().length, p.id).toBeGreaterThan(0);
    }
  });

  it("an advisor has a seat whose branches take its traits; leader traits are leaders'", () => {
    for (const p of persons) {
      if (p.roles.includes("advisor")) {
        expect(p.advisor, p.id).toBeDefined();
        const branches = SLOT_BRANCHES[p.advisor!.slot];
        for (const t of p.advisor!.traits) {
          expect(branches, `${p.id} ${t}`).toContain(traitIdx.get(t)?.branch);
        }
      }
      for (const t of p.leaderTraits ?? []) {
        expect(traitIdx.get(t)?.branch, `${p.id} ${t}`).toBe("leader");
      }
    }
  });

  it("a person who is also a general has the general's id and the same name", () => {
    const ids = new Set(GENERALS.map((g) => g.id));
    for (const p of persons) {
      if (p.alsoGeneral === undefined) continue;
      expect(ids.has(p.alsoGeneral), `${p.id} ${p.alsoGeneral}`).toBe(true);
      for (const json of [en, ko]) {
        expect(keyIn(json, p.nameKey), p.id).toBe(
          keyIn(json, `ww1936.general.${p.alsoGeneral}`),
        );
      }
    }
  });

  it("every person has its name", () => {
    for (const p of persons) {
      expect((keyIn(en, p.nameKey) ?? "").length, p.id).toBeGreaterThan(0);
      expect((keyIn(ko, p.nameKey) ?? "").length, p.id).toBeGreaterThan(0);
    }
  });
});
