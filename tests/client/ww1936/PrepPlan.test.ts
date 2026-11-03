import { describe, expect, it } from "vitest";
import {
  clearPrepTemplate,
  markPrepSent,
  PREP_KEY,
  prepPlanOf,
  prepSentFor,
  PrepStorage,
  setPrepTemplate,
} from "../../../src/client/components/ww1936/PrepPlan";

function memory(): PrepStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const T = {
  key: "infantry",
  name: "Mine",
  battalions: ["infantry", "infantry", "artillery"],
  support: ["engineer"],
};

describe("the lobby plan store", () => {
  it("keeps the edits per country and drops one back to the 1936 template", () => {
    const s = memory();
    setPrepTemplate("DEU", T, s);
    setPrepTemplate("DEU", { ...T, name: "Other" }, s);
    setPrepTemplate("FRA", T, s);
    expect(prepPlanOf("DEU", s)).toEqual([{ ...T, name: "Other" }]);
    expect(prepPlanOf("FRA", s)).toEqual([T]);
    clearPrepTemplate("DEU", "infantry", s);
    expect(prepPlanOf("DEU", s)).toEqual([]);
    expect(prepPlanOf("FRA", s)).toEqual([T]);
  });

  it("survives blocked, throwing, empty and broken storage", () => {
    const throwing: PrepStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(prepPlanOf("DEU", throwing)).toEqual([]);
    expect(() => setPrepTemplate("DEU", T, throwing)).not.toThrow();
    expect(() => clearPrepTemplate("DEU", "x", throwing)).not.toThrow();
    expect(() => markPrepSent("g", throwing)).not.toThrow();
    expect(prepPlanOf("DEU", null)).toEqual([]);
    for (const raw of ["", "not json", "{}", '{"v":2}', "[]", "null"]) {
      const s = memory();
      s.data.set(PREP_KEY, raw);
      expect(prepPlanOf("DEU", s)).toEqual([]);
      expect(prepSentFor(s)).toBe("");
    }
  });

  it("drops a broken entry and keeps the good ones", () => {
    const s = memory();
    s.data.set(
      PREP_KEY,
      JSON.stringify({
        v: 1,
        byCountry: {
          DEU: [
            T,
            { ...T, key: "b", battalions: ["no_such_battalion"] },
            { ...T, key: "c", battalions: [] },
            "junk",
            { ...T, key: "infantry", name: "duplicate key" },
          ],
        },
      }),
    );
    expect(prepPlanOf("DEU", s)).toEqual([T]);
  });

  it("remembers the game whose orders went out", () => {
    const s = memory();
    setPrepTemplate("DEU", T, s);
    markPrepSent("game-1", s);
    expect(prepSentFor(s)).toBe("game-1");
    expect(prepPlanOf("DEU", s)).toEqual([T]);
  });
});
