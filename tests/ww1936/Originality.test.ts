// World War 1936 P3 (spec §19.1-6): no content text copies a phrase HOI4
// made up. The list holds vanilla focus names that are not historical
// terms (a historical term like "Strength Through Joy" or "Mefo Bills" is
// fine, as are plain words like "Rearmament" and this mode's own law names).
// Only the content keys are compared, not the screens'.
import { contentTexts, en } from "./contentUtil";

const HOI4_PHRASES = [
  "Air Innovations",
  "Air Superiority",
  "Armor Effort",
  "Army Innovations",
  "Aviation Effort",
  "Base Strike",
  "Battlefield Support",
  "Bomber Effort",
  "CAS Effort",
  "Coastal Fortification Effort",
  "Collectivist Rhetoric",
  "Construction Effort",
  "Destroyer Effort",
  "Doctrine Effort",
  "Enhanced Combined Arms",
  "Equipment Effort",
  "Expand the Reichsautobahn",
  "Extra Research Slot",
  "Fighter Focus",
  "Fleet in Being",
  "Flexible Navy",
  "Grand Battleplan",
  "Hardline Communism",
  "Ideological Fanaticism",
  "Industrial Effort",
  "Infrastructure Effort",
  "Internal Affairs",
  "Mass Assault",
  "Mechanization Effort",
  "Mobile Warfare",
  "Motorization Effort",
  "Naval Air Effort",
  "Naval Innovations",
  "Neutrality Focus",
  "Nuclear Effort",
  "Operational Integrity",
  "Oppose Hitler",
  "Paramilitarism",
  "Paratrooper Effort",
  "Political Effort",
  "Production Effort",
  "Rebuild the Fleet",
  "Rocket Effort",
  "Secret Weapons",
  "Special Forces Effort",
  "Strategic Destruction",
  "Superior Firepower",
  "Trade Interdiction",
];

/**
 * P4 review: the doctrine schools, the techs and the advisor traits are
 * compared too (screen keys, but names a player reads as content).
 */
const NAMED_GROUPS = ["school", "tech", "trait"] as const;
function namedTexts(json: unknown): [string, string][] {
  const root =
    (json as { ww1936?: Record<string, Record<string, unknown>> }).ww1936 ?? {};
  const out: [string, string][] = [];
  for (const g of NAMED_GROUPS) {
    for (const [k, v] of Object.entries(root[g] ?? {})) {
      if (typeof v === "string") out.push([`ww1936.${g}.${k}`, v]);
    }
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("content originality", () => {
  it("the list has 48 phrases, sorted", () => {
    // P4 review: the eight doctrine school names added.
    expect(HOI4_PHRASES).toHaveLength(48);
    expect([...HOI4_PHRASES].sort()).toEqual(HOI4_PHRASES);
  });

  it("no content text uses a HOI4 phrase", () => {
    const patterns = HOI4_PHRASES.map(
      (p) => new RegExp(`\\b${escape(p)}\\b`, "i"),
    );
    expect(namedTexts(en).length).toBeGreaterThan(100);
    for (const [key, text] of [...contentTexts(en), ...namedTexts(en)]) {
      for (const [i, re] of patterns.entries()) {
        expect(re.test(text), `${key}: "${HOI4_PHRASES[i]}"`).toBe(false);
      }
    }
  });
});
