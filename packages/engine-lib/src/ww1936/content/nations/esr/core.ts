// ww229 (design ww227 §5-§6): Republican Spain's generals, balance of power,
// own equipment and start arms, read before the content. The equipment
// catalogue is equipment.ts.
import type { NationCore } from "../types";
import { ESR_EQUIPMENT, ESR_START_ARMS } from "./equipment";

export const CORE_ESR: NationCore = {
  tag: "ESR",
  // Commanders of the Popular Army (Miaja and Pozas are in Generals.ts
  // already). None needs a `from`: each led troops from the rising on,
  // whatever his rank that summer.
  generals: [
    {
      id: "esr_rojo",
      tag: "ESR",
      att: 2,
      def: 4,
      plan: 4,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Vicente Rojo Lluch: chief of staff of the defence of Madrid 1936, chief of the general staff of the Republican army 1937-39 (planned Brunete, Teruel and the Ebro)",
    },
    {
      id: "esr_modesto",
      tag: "ESR",
      att: 4,
      def: 2,
      plan: 3,
      log: 2,
      traits: ["river_crosser"],
      source:
        "en.wikipedia Juan Modesto: commanded the V Army Corps 1937 and the Army of the Ebro in the crossing of 1938",
    },
    {
      id: "esr_lister",
      tag: "ESR",
      att: 4,
      def: 2,
      plan: 2,
      log: 1,
      traits: ["infantry_expert"],
      source:
        "en.wikipedia Enrique Líster: commanded the 11th Division (Brunete, Teruel) and the V Army Corps on the Ebro",
    },
    {
      id: "esr_hernandez_saravia",
      tag: "ESR",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["artillery_officer"],
      source:
        "en.wikipedia Juan Hernández Saravia: artillery officer, minister of war 1936, commanded the Army of the Levante at Teruel and the Eastern Region Army Group 1938-39",
    },
    {
      id: "esr_mera",
      tag: "ESR",
      att: 3,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["ambusher"],
      source:
        "en.wikipedia Cipriano Mera: CNT militia leader, commanded the 14th Division at Guadalajara and the IV Army Corps 1937-39",
    },
    {
      id: "esr_casado_gen",
      tag: "ESR",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["cavalry_officer"],
      source:
        "en.wikipedia Segismundo Casado: cavalry officer, commanded the Army of the Centre 1938-39 and led the National Defence Council's coup of 1939",
    },
  ],
  // Design ww227 §5: the Communists (PCE, PSUC; −) against the anarchists
  // (CNT-FAI, with the POUM; +), with the socialists and republicans in the
  // middle. The revolution of summer 1936 starts it on the anarchist side.
  // It ends when another ideology rules.
  bop: [
    {
      tag: "ESR",
      startPm: 300,
      spirits: [
        "esr_bop_pce_hegemony",
        "esr_bop_pce_lead",
        "esr_bop_popular_front",
        "esr_bop_cnt_lead",
        "esr_bop_revolution",
      ],
      endsOnRulingChange: true,
    },
  ],
  equipment: ESR_EQUIPMENT,
  startArms: ESR_START_ARMS,
};
