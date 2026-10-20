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
  "Hardline Communism",
  "Ideological Fanaticism",
  "Industrial Effort",
  "Infrastructure Effort",
  "Internal Affairs",
  "Mechanization Effort",
  "Motorization Effort",
  "Naval Air Effort",
  "Naval Innovations",
  "Neutrality Focus",
  "Nuclear Effort",
  "Oppose Hitler",
  "Paramilitarism",
  "Paratrooper Effort",
  "Political Effort",
  "Production Effort",
  "Rebuild the Fleet",
  "Rocket Effort",
  "Secret Weapons",
  "Special Forces Effort",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("content originality", () => {
  it("the list has 40 phrases, sorted", () => {
    expect(HOI4_PHRASES).toHaveLength(40);
    expect([...HOI4_PHRASES].sort()).toEqual(HOI4_PHRASES);
  });

  it("no content text uses a HOI4 phrase", () => {
    const patterns = HOI4_PHRASES.map(
      (p) => new RegExp(`\\b${escape(p)}\\b`, "i"),
    );
    for (const [key, text] of contentTexts(en)) {
      for (const [i, re] of patterns.entries()) {
        expect(re.test(text), `${key}: "${HOI4_PHRASES[i]}"`).toBe(false);
      }
    }
  });
});
