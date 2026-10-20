// World War 1936 P3 (spec §13, §24.2): the decisions' data. Passes on empty
// tables; the content lanes fill them (plan Task 1 Step 15).
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import {
  WwConditionSchema,
  WwEffectSchema,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { GENERIC_DECISIONS } from "@openfront/engine-lib/ww1936/content/decisions/generic";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { CONTENT_TARGETS, emptyOrAtLeast, hasKey } from "./contentUtil";

/** Spec §13.2's twelve generic decisions. */
const SPEC_GENERIC = [
  "gen_rally",
  "gen_suppress_opposition",
  "gen_suspend_elections",
  "gen_war_bonds",
  "gen_industrial_subsidy",
  "gen_emergency_draft",
  "gen_fortify_border",
  "gen_tech_exchange",
  "gen_hire_general",
  "gen_martial_law",
  "gen_party_support",
  "gen_coup",
];
/** K1 splits the targeted ones by ideology (controller ruling R19). */
const baseId = (id: string) => id.replace(/_(dem|com|fas|neu)$/, "");

describe("decision data", () => {
  const { decisions } = CONTENT;

  it("every decision passes the schemas", () => {
    for (const d of decisions) {
      for (const list of [d.effects, d.completeEffects, d.failEffects]) {
        for (const e of list ?? []) WwEffectSchema.parse(e);
      }
      for (const c of [d.visible, d.available, d.target?.among, d.failIf]) {
        if (c) WwConditionSchema.parse(c);
      }
      for (const m of d.ai.mods ?? []) WwConditionSchema.parse(m.if);
    }
  });

  it("there are as many as planned", () => {
    expect(emptyOrAtLeast(decisions.length, CONTENT_TARGETS.decisions)).toBe(
      true,
    );
  });

  it("countries are real tags; a mission completes; costs are 0..150 PP", () => {
    for (const d of decisions) {
      if (d.for !== "any") {
        for (const t of d.for) expect(COUNTRY_TAGS, d.id).toContain(t);
      }
      if (d.days !== undefined) {
        expect(d.completeEffects, d.id).toBeDefined();
      }
      const pp = d.cost?.pp ?? 0;
      expect(pp >= 0 && pp <= 150, d.id).toBe(true);
    }
  });

  it("the generic decisions are spec §13.2's twelve", () => {
    if (GENERIC_DECISIONS.length === 0) return;
    const bases = new Set(GENERIC_DECISIONS.map((d) => baseId(d.id)));
    for (const id of SPEC_GENERIC) expect(bases, id).toContain(id);
  });

  it("every decision has its texts", () => {
    for (const d of decisions) {
      expect(hasKey(`ww1936.decision.${d.id}`), d.id).toBe(true);
      expect(hasKey(`ww1936.decision_desc.${d.id}`), d.id).toBe(true);
    }
  });
});
