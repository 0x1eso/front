// ww208, decision 1B: the heads a utopia brings, as persons: where each sits,
// who hands him a paper, his diary. Lane P. Every row names its `ruler`: a
// seat's own rows (no `ruler`) stay its first person's (Persona.ts). Text in
// resources/ww1914/ko/<TAG>.head.json. Facts checked on en.wikipedia (Ebert,
// Henderson, Lvov, Kerensky, Renner, the Duke of Orléans) and the cast's
// source for Lammasch; the rooms are named by office, not by unchecked fact.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwBearer,
  GwDiaryRow,
  GwPersonaContent,
  GwRulerPlace,
} from "@openfront/engine-api/ww1914/GwPersona";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const war = world({ is: "war" });

interface Head {
  readonly tag: GwTag;
  readonly id: string;
  /** Place ids, the last that holds wins: the office, then the room. */
  readonly places: readonly string[];
}

const HEADS: readonly Head[] = [
  { tag: "DEU", id: "ebert", places: ["chancellery"] },
  { tag: "GBR", id: "henderson", places: ["downing"] },
  { tag: "AUH", id: "lammasch", places: ["ministry"] },
  { tag: "AUH", id: "renner", places: ["chancery"] },
  { tag: "RUS", id: "lvov", places: ["mariinsky"] },
  { tag: "RUS", id: "kerensky", places: ["winter"] },
  { tag: "FRA", id: "orleans", places: ["palais_royal"] },
];

const pre = (h: Head) => h.tag.toLowerCase();

const places = (h: Head): GwRulerPlace[] =>
  h.places.map((p) => ({
    id: `${pre(h)}_pl_${h.id}_${p}`,
    nation: [h.tag],
    ruler: h.id,
  }));

/** His own people bring the private papers, his office the rest. */
const bearers = (h: Head): GwBearer[] => [
  {
    id: `${pre(h)}_br_${h.id}_home`,
    nation: [h.tag],
    ruler: h.id,
    private: true,
  },
  { id: `${pre(h)}_br_${h.id}_office`, nation: [h.tag], ruler: h.id },
];

const diary = (h: Head): GwDiaryRow[] => {
  const d = (
    x: string,
    moment: GwDiaryRow["moment"],
    more: Partial<GwDiaryRow> = {},
  ): GwDiaryRow => ({
    id: `${pre(h)}_di_${h.id}_${x}`,
    nation: [h.tag],
    ruler: h.id,
    moment,
    ...more,
  });
  return [
    d("dec_1", "decision"),
    d("dec_2", "decision"),
    d("death", "death"),
    d("front", "front", { when: war }),
    d("aud", "audience"),
    d("fam", "family"),
    d("health", "health"),
    d("fill_1", "filler"),
    d("fill_2", "filler"),
  ];
};

export const HEADS_PERSONA: GwPersonaContent = {
  places: HEADS.flatMap(places),
  bearers: HEADS.flatMap(bearers),
  diary: HEADS.flatMap(diary),
};
