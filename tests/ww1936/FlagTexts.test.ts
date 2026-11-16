// ww235: a condition that names a flag reads as a short phrase, never the
// raw id ("세계 표식 있음: danubian_federation_formed").
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { describe, expect, it } from "vitest";
import { allConditions, en, keyIn, ko, walkConds } from "./contentUtil";

/** Every flag a condition of the content names (flag, gflag, days since). */
function conditionFlags(): Set<string> {
  const out = new Set<string>();
  for (const [, c] of allConditions()) {
    walkConds(c, (leaf) => {
      if ("all" in leaf || "any" in leaf || "not" in leaf) return;
      if (
        leaf.kind === "flag" ||
        leaf.kind === "gflag" ||
        leaf.kind === "days_since_flag_ge"
      ) {
        out.add(leaf.flag);
      }
    });
  }
  return out;
}

describe("flag texts (ww235)", () => {
  it("every flag a condition names has a text in en and ko", () => {
    const flags = conditionFlags();
    expect(flags.size).toBeGreaterThan(100);
    const missing: string[] = [];
    for (const id of flags) {
      const e = keyIn(en, `ww1936.flag.${id}`) ?? "";
      const k = keyIn(ko, `ww1936.flag.${id}`) ?? "";
      if (e === "" || k === "") missing.push(id);
      // A phrase, not an id: no snake_case, and Korean in ko.
      else if (e.includes("_") || k.includes("_") || !/[가-힣]/.test(k)) {
        missing.push(`${id} (not a phrase)`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every flag text names a flag the content declares", () => {
    const keys = Object.keys(
      (en as { ww1936: { flag: Record<string, string> } }).ww1936.flag,
    );
    expect(keys.filter((id) => !CONTENT.flagSet.has(id))).toEqual([]);
    expect(
      Object.keys(
        (ko as { ww1936: { flag: Record<string, string> } }).ww1936.flag,
      ).sort(),
    ).toEqual([...keys].sort());
  });
});
