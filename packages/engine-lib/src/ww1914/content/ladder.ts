// Great War 1914 (ww170 S3, design ww168 B4): the crisis ladder from the 통치
// tab. Each seat sends a note to a country across from it (eng/ww1914/Ladder
// says who can be sent one); the other side answers, then the sender mobilises
// or climbs down, then war or a last climb-down. Text in
// resources/ww1914/ko/common.ladder.json. Germany's phase-1 row
// `deu_pw_ultimatum` is its own; this file gives the other four seats theirs.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwCond,
  GwEffect,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwPowerRow } from "../PowerRows";

const SEATS: readonly GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];

/** Who a note can go to: the powers and the countries they could reach. */
export const GW_LADDER_REACH: readonly GwTag[] = [
  "DEU",
  "AUH",
  "RUS",
  "FRA",
  "GBR",
  "ITA",
  "OTT",
  "SRB",
  "MNE",
  "BEL",
  "NLD",
  "ROU",
  "BGR",
  "GRC",
  "PRT",
  "DNK",
  "NOR",
  "SWE",
  "ESP",
];

const answer = (yes: boolean): GwEffect =>
  doWorld({ do: "ladder_answer", yes });
const press = (on: boolean): GwEffect => doWorld({ do: "ladder_press", on });
const from = (tag: GwTag): GwCond => world({ is: "ladder", role: "to", tag });

/** The card names who sent the note: one body per seat that could send it. */
const bySender: GwVariant[] = [
  ...SEATS.map((t) => ({ id: `from_${t.toLowerCase()}`, when: from(t) })),
  { id: "base" },
];

export const GW_LADDER_SCENES: readonly GwScene[] = [
  {
    // To the seat that was sent a note: give way or refuse.
    id: "gw_ladder_note",
    nation: [...SEATS],
    kind: "crisis",
    scheduledOnly: true,
    noBack: true,
    cast: {},
    salience: 9,
    tags: ["foreign", "tension_up"],
    variants: bySender,
    fallback: "refuse",
    options: [
      { id: "give_way", tell: [], effects: [answer(true)] },
      { id: "refuse", tell: [], effects: [answer(false)] },
    ],
  },
  {
    // To the sender, refused: mobilise, or let it go.
    id: "gw_ladder_refused",
    nation: [...SEATS],
    kind: "crisis",
    scheduledOnly: true,
    noBack: true,
    cast: {},
    salience: 9,
    tags: ["foreign", "war", "tension_up"],
    variants: [{ id: "base" }],
    fallback: "climb_down",
    options: [
      { id: "mobilise", tell: [], effects: [press(true)] },
      { id: "climb_down", tell: [], effects: [press(false)] },
    ],
  },
  {
    // To the seat sent the note, once the sender has mobilised.
    id: "gw_ladder_last",
    nation: [...SEATS],
    kind: "crisis",
    scheduledOnly: true,
    noBack: true,
    cast: {},
    salience: 9,
    tags: ["foreign", "war", "tension_up"],
    variants: bySender,
    fallback: "stand",
    options: [
      { id: "give_way", tell: [], effects: [answer(true)] },
      { id: "stand", tell: [], effects: [answer(false)] },
    ],
  },
  {
    // The row's result card: the note is out.
    id: "gw_ladder_sent",
    nation: [...SEATS],
    kind: "wire",
    silent: true,
    scheduledOnly: true,
    cast: {},
    salience: 0,
    tags: ["foreign"],
    variants: [{ id: "base" }],
  },
];

/** The office that signs a note, and a consent where the law asked one. */
const SIGNER: Readonly<
  Partial<Record<GwTag, NonNullable<GwPowerRow["needs"]>>>
> = {
  GBR: { office: "foreign" },
  FRA: { office: "foreign" },
  RUS: { office: "foreign" },
  // The joint foreign minister signs; Budapest's government must not stand
  // against a step toward war (the 1867 settlement's joint affairs).
  AUH: { office: "foreign", consent: "auh_work" },
};

const row = (tag: GwTag): GwPowerRow => ({
  id: `${tag.toLowerCase()}_pw_ultimatum`,
  tag,
  group: "war",
  kind: "lawful",
  opens: [
    {
      when: { kind: "not", of: world({ is: "ladder", role: "from" }) },
      why: "ladder_open",
    },
  ],
  needs: SIGNER[tag],
  authority: 10,
  cooldown: 4,
  fields: [
    {
      id: "to",
      options: GW_LADDER_REACH.filter((t) => t !== tag).map((t) => ({
        id: t.toLowerCase(),
        when: world({ is: "ladder_target", tag: t }),
        effects: [doWorld({ do: "ultimatum", tag: t })],
      })),
    },
  ],
  tags: ["ultimatum"],
  effects: [],
  scene: "gw_ladder_sent",
});

/** Germany has its own row from phase 1 (content/powers/deu.ts). */
export const GW_LADDER_POWERS: readonly GwPowerRow[] = (
  ["GBR", "AUH", "RUS", "FRA"] as const
).map(row);
