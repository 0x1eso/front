// ww226 (1936 mode): every country that plays can reach every ideology it
// does not hold through a focus path that ends in a civil war for it. A
// `set_government` on the own country counts too: the engine turns an
// in-country change of the ruling ideology into a civil war (ww226 lane E).
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  FocusDef,
  IDEOLOGIES,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  CONTENT,
  inTree,
  replacedInTree,
} from "@openfront/engine-lib/ww1936/content/registry";
import { walkEffects } from "./contentUtil";

const { focuses, focusIdx } = CONTENT;
const byId = (id: string): FocusDef => focuses[focusIdx.get(id)!];

/** The ideologies a focus hands the country to (its own government). */
function ideologiesOf(f: FocusDef, civilWarOnly: boolean): Set<string> {
  const out = new Set<string>();
  walkEffects(f.effects as Effect[], (e) => {
    if (e.kind === "civil_war") out.add(e.ideology);
    if (e.kind === "set_government" && !civilWarOnly) out.add(e.ideology);
  });
  return out;
}

/** The country can take the focus: in its tree, for it, every prerequisite group reachable. */
function reachable(
  tag: string,
  tree: FocusDef["tree"],
  id: string,
  seen = new Map<string, boolean>(),
): boolean {
  const known = seen.get(id);
  if (known !== undefined) return known;
  seen.set(id, false);
  // A pack's replaced generic focus counts as bypassed.
  if (replacedInTree(CONTENT, tree, id)) {
    seen.set(id, true);
    return true;
  }
  if (!inTree(CONTENT, tree, id)) return false;
  const f = byId(id);
  if (f.countries !== undefined && !f.countries.includes(tag as never)) {
    return false;
  }
  const ok = (f.prereq ?? []).every((g) =>
    g.some((p) => reachable(tag, tree, p, seen)),
  );
  seen.set(id, ok);
  return ok;
}

describe("ww226: the ideology routes", () => {
  it("every playing country reaches each ideology it lacks through a focus path ending in a government change", () => {
    const missing: string[] = [];
    for (const c of CONTENT.countries) {
      for (const ideo of IDEOLOGIES) {
        if (ideo === c.ruling) continue;
        const ends = focuses.filter(
          (f) =>
            ideologiesOf(f, false).has(ideo) && reachable(c.tag, c.tree, f.id),
        );
        if (ends.length === 0) missing.push(`${c.tag} (${c.tree}) → ${ideo}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("the generic tree has a civil war branch for every ideology, under its ideology focus", () => {
    for (const [ideo, root] of [
      ["democratic", "gen_pol_dem"],
      ["communist", "gen_pol_com"],
      ["fascist", "gen_pol_fas"],
      ["neutral", "gen_pol_neu"],
    ] as const) {
      const end = focuses.find(
        (f) => f.tree === "generic" && ideologiesOf(f, true).has(ideo),
      );
      expect(end, ideo).toBeDefined();
      // Walk up to the ideology focus.
      let f = end!;
      while (f.prereq !== undefined && f.id !== root) f = byId(f.prereq[0][0]);
      expect(f.id, ideo).toBe(root);
      // The civil war needs the movement and a different government.
      expect(JSON.stringify(end!.available)).toContain(`"ruling"`);
      expect(JSON.stringify(end!.available)).toContain(`"pop_ge"`);
    }
  });

  it("each great power's own tree reaches every missing ideology", () => {
    for (const tree of ["DEU", "GBR", "SUN", "ITA", "JPN", "FRA", "USA"]) {
      const c = CONTENT.countries.find((x) => x.tree === tree)!;
      for (const ideo of IDEOLOGIES) {
        if (ideo === c.ruling) continue;
        const own = focuses.filter(
          (f) => f.tree === tree && ideologiesOf(f, false).has(ideo),
        );
        expect(own.length, `${tree} → ${ideo}`).toBeGreaterThan(0);
      }
    }
  });
});
