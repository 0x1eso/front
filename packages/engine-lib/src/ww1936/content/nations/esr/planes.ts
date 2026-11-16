// ww229 (design ww227 §6): the aircraft the Republic built or had built
// under licence. Real figures from memory of the Wikipedia articles. Data
// only.
import type { HistEntry } from "../../../hist/Types";

export const ESR_PLANES: readonly HistEntry[] = [
  {
    id: "esr_nid52",
    country: "ESR",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1"],
    year: 1929,
    // Nieuport-Delage NiD 52, built by Hispano-Suiza at Guadalajara (about
    // 90), the air force's fighter in 1936: about 255 km/h, 400 km, empty
    // 1,370 kg, 30.6 m2 wing at 1,840 kg, two Vickers 7.7 mm.
    source:
      "en.wikipedia Nieuport-Delage NiD 52 (Hispano-Suiza licence production), from memory; cost scaled from ita_cr32 by weight",
    spec: {
      maxKmh: 255,
      rangeKm: 400,
      emptyKg: 1370,
      wingLoad: 60,
      guns: [{ mm: 7.7, count: 2, rpm: 600 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 11,
    },
  },
  {
    id: "esr_i15_chato",
    country: "ESR",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1"],
    year: 1937,
    // Polikarpov I-15 "Chato" built in Republican Spain by SAF-3 (Reus) and
    // SAF-15 (Sabadell) from Soviet drawings; about 230-290 built, sources
    // differ. About 350 km/h, 500 km, empty 1,010 kg, 21.9 m2 wing at
    // 1,415 kg, four PV-1 7.62 mm, 40 kg of bombs.
    source:
      "en.wikipedia Polikarpov I-15 (licence production in Republican Spain), from memory; numbers built differ; cost scaled from sun_i16",
    spec: {
      maxKmh: 350,
      rangeKm: 500,
      emptyKg: 1010,
      wingLoad: 65,
      guns: [{ mm: 7.62, count: 4, rpm: 750 }],
      defGuns: 0,
      bombKg: 40,
      torpedoKg: 0,
      reliability: 3,
      costK: 10,
    },
  },
  {
    id: "esr_breguet_19",
    country: "ESR",
    family: "plane",
    type: "bomber",
    techs: ["bomber_1"],
    year: 1926,
    // Breguet 19 built under licence by CASA at Getafe, the air force's
    // light bomber and scout in 1936: about 215 km/h, 800 km, empty 1,390
    // kg, 50 m2 wing at 2,500 kg, one fixed Vickers and two Lewis in the
    // rear cockpit, up to 400 kg of bombs.
    source:
      "en.wikipedia Breguet 19 (CASA licence production), from memory; bomb load given 400-440 kg, lower value; cost scaled from the Italian light bombers",
    spec: {
      maxKmh: 215,
      rangeKm: 800,
      emptyKg: 1390,
      wingLoad: 50,
      guns: [{ mm: 7.7, count: 1, rpm: 600 }],
      defGuns: 2,
      bombKg: 400,
      torpedoKg: 0,
      reliability: 3,
      costK: 16,
    },
  },
  {
    id: "esr_vildebeest",
    country: "ESR",
    family: "plane",
    type: "naval_bomber",
    techs: ["naval_bomber_1"],
    year: 1932,
    // Vickers Vildebeest built by CASA for the naval air arm (about 25,
    // Hispano-Suiza engine): about 230 km/h, 1,600 km, empty 1,920 kg, 67.9
    // m2 wing at 3,670 kg, one fixed Vickers and one Lewis, an 18-inch
    // torpedo (about 730 kg).
    source:
      "en.wikipedia Vickers Vildebeest (CASA licence production for Spain), from memory; speed of the Hispano-engined version a middle value; cost scaled from British naval bombers",
    spec: {
      maxKmh: 230,
      rangeKm: 1600,
      emptyKg: 1920,
      wingLoad: 54,
      guns: [{ mm: 7.7, count: 1, rpm: 600 }],
      defGuns: 1,
      bombKg: 500,
      torpedoKg: 730,
      reliability: 3,
      costK: 22,
    },
  },
];
