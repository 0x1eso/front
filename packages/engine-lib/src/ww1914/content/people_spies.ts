import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * ww173: the heads of the secret services, for the `intelligence` office
 * (engine/ww1914/Spies: the holder's war or politics competence adds to the
 * service's rolls). One holds it in June 1914 per seat; the others are fit
 * for it. Hall (Room 40) is in GBR_PEOPLE and fit for it too. Names, lean and
 * bio are in common.people.json. Unchecked facts are in
 * /home/eser/dev/ww166-facts-open.md. Order matters to the seed rolls: append.
 */
export const SPY_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "deu_nicolai",
    tag: "DEU",
    office: "intelligence",
    fit: ["intelligence"],
    camps: ["military", "east", "hard"],
    temperaments: ["cold", "cunning"],
    rivals: [],
    allies: ["deu_ludendorff"],
    fame: 1,
    source:
      "In Abteilung IIIb from 1906, its Königsberg station; head from early 1913 to 1918 (some say 1919); IIIb a full department June 1915; propaganda and the press under the OHL (en.wikipedia Walter Nicolai; 1914-1918-online Abteilung IIIb)",
  },
  {
    id: "gbr_kell",
    tag: "GBR",
    office: "intelligence",
    fit: ["intelligence"],
    camps: ["military", "moderate"],
    temperaments: ["cold", "anxious"],
    rivals: [],
    allies: ["gbr_cumming"],
    fame: 1,
    source:
      "South Staffordshire Regiment; with Cumming set up the Secret Service Bureau, 1 Oct 1909; the two parted to head the home branch (MI5) and the foreign one (en.wikipedia Vernon Kell; MI5)",
  },
  {
    id: "gbr_cumming",
    tag: "GBR",
    office: null,
    fit: ["intelligence"],
    camps: ["moderate"],
    temperaments: ["cunning", "arrogant"],
    rivals: [],
    allies: ["gbr_kell"],
    fame: 1,
    source:
      "Royal Navy captain; with Kell set up the Secret Service Bureau, 1 Oct 1909; head of its foreign branch, later SIS (en.wikipedia Vernon Kell; MI5)",
  },
  {
    id: "auh_urbanski",
    tag: "AUH",
    office: "intelligence",
    fit: ["intelligence"],
    camps: ["military", "moderate", "dynasty"],
    temperaments: ["cold", "weary"],
    rivals: [],
    allies: [],
    fame: 1,
    source:
      "Head of the Evidenzbureau 1909-1914 (checked, design ww173 §9); the Redl affair of 1913 under him (memory)",
  },
  {
    id: "auh_hranilovic",
    tag: "AUH",
    office: null,
    fit: ["intelligence"],
    camps: ["military", "hard", "dynasty"],
    temperaments: ["cold", "stubborn"],
    rivals: [],
    allies: [],
    fame: 1,
    source: "Head of the Evidenzbureau 1914-1917 (checked, design ww173 §9)",
  },
  {
    id: "auh_ronge",
    tag: "AUH",
    office: null,
    fit: ["intelligence"],
    camps: ["military", "hard", "dynasty"],
    temperaments: ["cunning", "cold"],
    rivals: [],
    allies: [],
    fame: 1,
    source:
      "Head of the Evidenzbureau 1917-1918 (checked, design ww173 §9); its counter-espionage before (memory)",
  },
  {
    id: "fra_dupont",
    tag: "FRA",
    office: "intelligence",
    fit: ["intelligence"],
    camps: ["military", "centre", "moderate"],
    temperaments: ["cold", "cunning"],
    rivals: [],
    allies: ["fra_joffre"],
    fame: 1,
    source:
      "Charles-Joseph Dupont: head of the Deuxième Bureau from March 1913 to 1917 or 1918 (sources differ); worked with Hennion's counter-espionage brigades (defense.gouv.fr DRM series ep. 14; en.wikipedia Deuxième Bureau)",
  },
  {
    id: "fra_ladoux",
    tag: "FRA",
    office: null,
    fit: ["intelligence"],
    camps: ["military", "right", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: [],
    allies: [],
    fame: 1,
    source:
      "Georges Ladoux: counter-espionage of the War Ministry from August 1914 to 9 Feb 1917, then the Deuxième Bureau; recruited Mata Hari (en.wikipedia Georges Ladoux; data.bnf.fr)",
  },
  {
    id: "rus_batyushin",
    tag: "RUS",
    office: "intelligence",
    fit: ["intelligence"],
    camps: ["military", "court", "hard"],
    temperaments: ["stubborn", "cunning"],
    rivals: [],
    allies: [],
    fame: 1,
    source:
      "(memory) Nikolai Batyushin: army intelligence in the Warsaw district before the war; front counter-intelligence from 1915; the Petrograd commission on speculators 1916",
  },
];
