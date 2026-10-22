// World War 1936 P3 (spec §19.1-6): no content text copies a phrase HOI4
// made up. The list holds vanilla focus names that are not historical
// terms (a historical term like "Strength Through Joy" or "Mefo Bills" is
// fine, as are plain words like "Rearmament" and this mode's own law names).
// Only the content keys are compared, not the screens'.
import { contentTexts, en } from "./contentUtil";

const HOI4_PHRASES = [
  "Adaptable Turret Ring",
  "Air Innovations",
  "Air Superiority",
  "Airspace Dominance",
  "Armor Effort",
  "Armored Infantry Support",
  "Armored Spearhead",
  "Army Innovations",
  "Aviation Effort",
  "Base Strike",
  "Battlefield Support",
  "Bomber Effort",
  "Breakthrough Tank Specifications",
  "CAS Effort",
  "Calculated Restraint",
  "Capital Hunters",
  "Carrier Battlegroups",
  "Coastal Fortification Effort",
  "Collectivist Rhetoric",
  "Construction Effort",
  "Defensive Postures",
  "Destroyer Effort",
  "Doctrine Effort",
  "Enhanced Combined Arms",
  "Equipment Effort",
  "Expand the Reichsautobahn",
  "Extra Research Slot",
  "Fighter Focus",
  "Fleet in Being",
  "Flexible Navy",
  "Fuselage Ordinance Rack",
  "Grand Battleplan",
  "Great War Infantry",
  "Hardline Communism",
  "Hunter Killer Groups",
  "Ideological Fanaticism",
  "Industrial Effort",
  "Infrastructure Effort",
  "Instilled Aggression",
  "Internal Affairs",
  "Knights of the Air",
  "Large Unit Tactics",
  "Mass Assault",
  "Massed Carrier Fleet",
  "Mechanization Effort",
  "Mission-Type Tactics",
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
  "Rapid Domination",
  "Rebuild the Fleet",
  "Rocket Effort",
  "Screen Support Focus",
  "Sea-To-Shore Air Power",
  "Secret Weapons",
  "Special Forces Effort",
  "Strategic Destruction",
  "Streamlined Deployment",
  "Superior Firepower",
  "Torpedo Primacy",
  "Torpedo Swarm Tactics",
  "Trade Interdiction",
  "Underway Replenishment Equipment",
];

/**
 * P4 review: the doctrine schools, the techs and the advisor traits are
 * compared too (screen keys, but names a player reads as content).
 */
const NAMED_GROUPS = [
  "school",
  "tech",
  "trait",
  // P6 (K5b): the grand doctrines, sub-doctrines, tracks, army spirits,
  // modules and arsenal traits, whose names are HOI4's most coined.
  "gd",
  "subdoc",
  "track",
  "army_spirit",
  "module",
  "mio_trait",
] as const;
function namedTexts(json: unknown): [string, string][] {
  const root = (json as { ww1936?: Record<string, unknown> }).ww1936 ?? {};
  const out: [string, string][] = [];
  const walk = (o: unknown, at: string) => {
    if (typeof o === "string") out.push([at, o]);
    else if (typeof o === "object" && o !== null) {
      for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
    }
  };
  for (const g of NAMED_GROUPS) walk(root[g], `ww1936.${g}`);
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("content originality", () => {
  it("the list has 72 phrases, sorted", () => {
    // P4 review: the eight doctrine school names added. P6 (K5b): 24 more,
    // the HOI4-coined land, naval and air doctrine, officer corps and
    // arsenal-trait names.
    expect(HOI4_PHRASES).toHaveLength(72);
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
