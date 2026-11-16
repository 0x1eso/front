// ww229 (design ww227 §5-§6): South Africa's generals, the Smuts-Hertzog
// balance of power, its own equipment (the Marmon-Herrington armoured cars,
// the Hartbees, the Loch-class frigates of the naval forces) and the arms it
// holds at the start. Figures are real specifications from the cited
// references (from memory where the source says so); hist/MinorClamp.ts holds
// the fight numbers between the generic key and the majors' median.
import type { NationCore } from "../types";

export const CORE_ZAF: NationCore = {
  tag: "ZAF",
  generals: [
    {
      id: "zaf_brink",
      tag: "ZAF",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia George Brink: commanded the 1st South African Division in East Africa and the Western Desert 1940-1941",
    },
    {
      id: "zaf_pienaar",
      tag: "ZAF",
      att: 3,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_officer", "defensive_doctrine"],
      until: "1942-12-19",
      source:
        "en.wikipedia Dan Pienaar: 1st South African Infantry Brigade in Abyssinia, 1st South African Division at El Alamein; killed in an air crash at the end of 1942",
    },
    {
      id: "zaf_de_villiers",
      tag: "ZAF",
      att: 2,
      def: 2,
      plan: 3,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Isaac Pierre de Villiers: commanded the 2nd South African Division at Bardia and Sollum 1941-1942",
    },
    {
      id: "zaf_klopper",
      tag: "ZAF",
      att: 2,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Hendrik Klopper: commanded the 2nd South African Division and the Tobruk garrison, captured in June 1942, escaped in 1943",
    },
    {
      id: "zaf_poole",
      tag: "ZAF",
      att: 3,
      def: 2,
      plan: 3,
      log: 2,
      traits: ["panzer_leader"],
      source:
        "en.wikipedia Evered Poole: commanded the 6th South African Armoured Division in Italy 1943-1945",
    },
  ],
  // Negative: Smuts and the Commonwealth wing; positive: Hertzog, then
  // Malan's nationalists and the republicans. Fusion starts even; no drift
  // (the centenary trek, the war vote and the decisions move it). It ends
  // with the government that started it.
  bop: [
    {
      tag: "ZAF",
      startPm: 0,
      spirits: [
        "zaf_bop_empire_loyal",
        "zaf_bop_smuts_leads",
        "zaf_bop_fusion_holds",
        "zaf_bop_hertzog_leads",
        "zaf_bop_republican_tide",
      ],
      endsOnRulingChange: true,
    },
  ],
  equipment: [
    {
      id: "zaf_mh_mk1",
      country: "ZAF",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1940,
      source:
        "en.wikipedia Marmon-Herrington Armoured Car (Mk I: Ford 4x2 chassis, 12 mm plate, two Vickers MGs, about 5.4 t); mass and speeds from memory; cost an estimate",
      spec: {
        massT: 5.4,
        hullFrontMm: 12,
        hullSlopeDeg: 0,
        turretFrontMm: 12,
        gunMm: 8,
        penMm500: 0,
        heFillerG: 0,
        mgs: 2,
        offroadKmh: 25,
        roadKmh: 70,
        wheeled: true,
        reliability: 3,
        costK: 8,
      },
    },
    {
      id: "zaf_mh_mk2",
      country: "ZAF",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      staticFor: "light_tank:1",
      year: 1940,
      source:
        "en.wikipedia Marmon-Herrington Armoured Car (Mk II: 4x4, 12 mm, Boys anti-tank rifle and Bren/Vickers MGs, about 6 t, 80 km/h); Boys penetration from memory; cost an estimate",
      spec: {
        massT: 6,
        hullFrontMm: 12,
        hullSlopeDeg: 0,
        turretFrontMm: 12,
        gunMm: 14,
        penMm500: 12,
        heFillerG: 0,
        mgs: 2,
        offroadKmh: 30,
        roadKmh: 80,
        wheeled: true,
        reliability: 3,
        costK: 9,
      },
    },
    {
      id: "zaf_mh_mk3",
      country: "ZAF",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1941,
      source:
        "en.wikipedia Marmon-Herrington Armoured Car (Mk III: shorter 4x4 chassis, the most numerous mark; Boys rifle and MGs); figures from memory; cost an estimate",
      spec: {
        massT: 6,
        hullFrontMm: 12,
        hullSlopeDeg: 0,
        turretFrontMm: 12,
        gunMm: 14,
        penMm500: 12,
        heFillerG: 0,
        mgs: 2,
        offroadKmh: 32,
        roadKmh: 80,
        wheeled: true,
        reliability: 4,
        costK: 9,
      },
    },
    {
      id: "zaf_mh_mk4",
      country: "ZAF",
      family: "tank",
      role: "light",
      techs: ["light_tank_2"],
      staticFor: "light_tank:2",
      year: 1943,
      source:
        "en.wikipedia Marmon-Herrington Armoured Car (Mk IV: monocoque hull, rear engine, 2-pounder gun and a .30 MG, about 6.4 t); 2-pounder penetration from memory; cost an estimate",
      spec: {
        massT: 6.4,
        hullFrontMm: 12,
        hullSlopeDeg: 0,
        turretFrontMm: 12,
        gunMm: 40,
        penMm500: 40,
        heFillerG: 0,
        mgs: 1,
        offroadKmh: 32,
        roadKmh: 80,
        wheeled: true,
        reliability: 3,
        costK: 14,
      },
    },
    {
      id: "zaf_hartbees",
      country: "ZAF",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      staticFor: "cas:1",
      year: 1936,
      source:
        "en.wikipedia Hawker Hartbees (Hart for close support, 4 built by Hawker and 65 at Roberts Heights; 283 km/h, one Vickers and one Lewis gun, 236 kg of bombs); weights from memory; cost an estimate",
      spec: {
        maxKmh: 283,
        rangeKm: 750,
        emptyKg: 1200,
        wingLoad: 64,
        guns: [
          {
            mm: 7.7,
            count: 1,
            rpm: 450,
          },
        ],
        defGuns: 1,
        bombKg: 236,
        torpedoKg: 0,
        reliability: 3,
        costK: 14,
      },
    },
    {
      id: "zaf_loch_frigate",
      country: "ZAF",
      family: "ship",
      cls: "dd",
      techs: ["dd_3"],
      year: 1944,
      source:
        "en.wikipedia Loch-class frigate and SAS Natal (Loch class transferred to the South African Naval Forces 1944-1945: 1,435 t, one 4-inch gun, a quadruple 2-pounder, 20 mm guns, Squid, 19.5 kn); light AA count from memory; cost an estimate",
      spec: {
        dispT: 1435,
        main: {
          count: 1,
          mm: 102,
        },
        beltMm: 0,
        speedKn: 19.5,
        rangeNm: 9500,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 3,
        aaLight: [
          {
            count: 4,
            mm: 40,
          },
          {
            count: 6,
            mm: 20,
          },
        ],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1,
      },
    },
  ],
  startArms: [
    {
      entry: "gbr_hurricane_i",
      origin: "received",
      count: 7,
      source:
        "en.wikipedia Hawker Hurricane operators (South African Air Force: a first batch of Hurricane Mk I delivered from late 1938); the count is from memory",
    },
  ],
};
