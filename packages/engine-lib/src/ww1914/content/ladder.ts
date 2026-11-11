// Great War 1914 (ww170 S3, design ww168 B4): the crisis ladder from the 통치
// tab. Each seat sends a note to a country across from it (eng/ww1914/Ladder
// says who can be sent one); the other side answers, then the sender mobilises
// or climbs down, then war or a last climb-down. Text in
// resources/ww1914/ko/common.ladder.json. Germany's phase-1 row
// `deu_pw_ultimatum` stays the July crisis's lever; its ladder row here is
// `deu_pw_note`. Every ladder row opens once the July chain is behind.
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

/** The cards the ladder's steps lay themselves (eng/ww1914/Ladder). */
export const GW_LADDER_NOTE = "gw_ladder_note";
export const GW_LADDER_REFUSED = "gw_ladder_refused";
export const GW_LADDER_LAST = "gw_ladder_last";
/** War between any pair (ww171): a seat's declaration, a peace offer. */
export const GW_WAR_NOTE = "gw_war_note";
export const GW_PAIR_OFFER = "gw_pair_offer";
export const GW_LADDER_CALLED: readonly string[] = [
  GW_LADDER_NOTE,
  GW_LADDER_REFUSED,
  GW_LADDER_LAST,
  GW_WAR_NOTE,
  GW_PAIR_OFFER,
];

export const GW_LADDER_SCENES: readonly GwScene[] = [
  {
    // To the seat that was sent a note: give way or refuse.
    id: GW_LADDER_NOTE,
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
    id: GW_LADDER_REFUSED,
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
    id: GW_LADDER_LAST,
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
    // To a seat another seat declared war on: it came as the chapter closed.
    id: GW_WAR_NOTE,
    nation: [...SEATS],
    kind: "wire",
    scheduledOnly: true,
    cast: {},
    salience: 9,
    tags: ["foreign", "war"],
    variants: [{ id: "base" }],
  },
  {
    // To a seat offered a peace of the two alone: take it, or fight on.
    id: GW_PAIR_OFFER,
    nation: [...SEATS],
    kind: "crisis",
    scheduledOnly: true,
    noBack: true,
    cast: {},
    salience: 9,
    tags: ["foreign", "war"],
    variants: [{ id: "base" }],
    fallback: "fight_on",
    options: [
      {
        id: "make_peace",
        tell: [],
        effects: [doWorld({ do: "pair_peace_answer", yes: true })],
      },
      {
        id: "fight_on",
        tell: [],
        effects: [doWorld({ do: "pair_peace_answer", yes: false })],
      },
    ],
  },
  {
    // The war and peace rows' result cards (ww171).
    id: "gw_war_sent",
    nation: [...SEATS],
    kind: "wire",
    silent: true,
    scheduledOnly: true,
    cast: {},
    salience: 0,
    tags: ["foreign", "war"],
    variants: [{ id: "base" }],
  },
  {
    id: "gw_peace_sent",
    nation: [...SEATS],
    kind: "wire",
    silent: true,
    scheduledOnly: true,
    cast: {},
    salience: 0,
    tags: ["foreign", "war"],
    variants: [{ id: "base" }],
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
  // The Chancellor countersigns the Emperor's acts (Reich constitution Art. 17).
  DEU: { office: "chancellor" },
  GBR: { office: "foreign" },
  FRA: { office: "foreign" },
  RUS: { office: "foreign" },
  // The joint foreign minister signs; Budapest's government must not stand
  // against a step toward war (the 1867 settlement's joint affairs).
  AUH: { office: "foreign", consent: "auh_work" },
};

/** The July chain is closed: in a war since, or in a peace after it. */
const afterJuly: GwCond = {
  kind: "all",
  of: [
    { kind: "not", of: world({ is: "chain" }) },
    {
      kind: "any",
      of: [
        world({ is: "war_months", min: 0 }),
        world({ is: "peace_months", min: 0 }),
      ],
    },
  ],
};

const row = (tag: GwTag): GwPowerRow => ({
  id: `${tag.toLowerCase()}_pw_${tag === "DEU" ? "note" : "ultimatum"}`,
  tag,
  group: "war",
  kind: "lawful",
  opens: [
    { when: afterJuly, why: "ladder_july" },
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

/**
 * What a declaration needs, by each seat's law, as its July row has it: the
 * Bundesrat's consent beside the Chancellor's signature (Reich constitution
 * Art. 11 and 17); the cabinet in London; Budapest's consent in Vienna; the
 * Emperor alone in Petersburg (Fundamental Laws Art. 13); both chambers in
 * Paris (constitutional law of 16 July 1875, Art. 9).
 */
const WAR_NEEDS: Readonly<
  Partial<Record<GwTag, NonNullable<GwPowerRow["needs"]>>>
> = {
  DEU: {
    office: "chancellor",
    house: { houses: ["bundesrat"], stance: { deu_south: 1 }, lean: 1 },
  },
  GBR: { council: "entry" },
  AUH: { office: "foreign", consent: "auh_work" },
  FRA: {
    office: "foreign",
    house: {
      houses: ["chambre", "senat"],
      stance: {
        fra_radicals: 1,
        fra_caillaux: 0,
        fra_repsoc: 1,
        fra_sfio: 0,
        fra_minority: -1,
        fra_left_rep: 1,
        fra_fed_rep: 1,
        fra_catholics: 1,
        fra_tiger: 1,
      },
    },
  },
};

/** The chain's step once its ultimatum link has run (Crises GW_LINKS). */
const GW_JULY_ULTIMATUM_DONE = 4;

/**
 * Petersburg in July (ww179): the Tsar alone may answer Vienna with war once
 * its note has gone to Belgrade, or once it is at war with Serbia. The
 * declaration is July's own: it closes the chain into the general war.
 */
const rusJuly: GwCond = {
  kind: "all",
  of: [
    world({ is: "chain", short: false }),
    {
      kind: "any",
      of: [
        world({ is: "chain", min: GW_JULY_ULTIMATUM_DONE }),
        world({ is: "pair_war", tag: "AUH", with: "SRB" }),
      ],
    },
  ],
};

/** Whether a seat has a declaration of its own in July, and on whom. */
const JULY_WAR: Readonly<Partial<Record<GwTag, { on: GwTag; when: GwCond }>>> =
  { RUS: { on: "AUH", when: rusJuly } };

/**
 * War on any country the seat could fight (ww171 phase 4): once an ultimatum
 * between the two was refused, or at once on one at war with the seat's
 * coalition or treaty partners. Its procedure is the seat's own (WAR_NEEDS).
 * A seat with a July declaration (JULY_WAR) may also use it in July, on that
 * country only.
 */
const warRow = (tag: GwTag): GwPowerRow => {
  const july = JULY_WAR[tag];
  const declareOn = (t: GwTag): GwEffect =>
    doWorld({ do: "declare_war", tag: t });
  return {
    id: `${tag.toLowerCase()}_pw_war_on`,
    tag,
    group: "war",
    kind: "lawful",
    opens: [
      {
        when:
          july === undefined
            ? afterJuly
            : { kind: "any", of: [afterJuly, july.when] },
        why: "ladder_july",
      },
    ],
    needs: WAR_NEEDS[tag],
    authority: 15,
    cooldown: 2,
    fields: [
      {
        id: "on",
        options: GW_LADDER_REACH.filter((t) => t !== tag).map((t) => {
          const target = world({ is: "war_target", tag: t });
          if (july === undefined) {
            return {
              id: t.toLowerCase(),
              when: target,
              effects: [declareOn(t)],
            };
          }
          if (july.on !== t) {
            return {
              id: t.toLowerCase(),
              when: { kind: "all", of: [afterJuly, target] },
              effects: [declareOn(t)],
            };
          }
          // In July the declaration closes the chain into the general war.
          return {
            id: t.toLowerCase(),
            when: { kind: "any", of: [target, july.when] },
            effects: [
              {
                kind: "maybe",
                when: { kind: "not", of: world({ is: "chain" }) },
                then: [declareOn(t)],
              },
              {
                kind: "maybe",
                when: world({ is: "chain" }),
                then: [doWorld({ do: "declare", tag: t })],
              },
            ],
          };
        }),
      },
    ],
    tags: ["war_offensive"],
    effects: [],
    scene: "gw_war_sent",
  };
};

/** A peace of the two alone with any country the seat is at war with. */
const peaceRow = (tag: GwTag): GwPowerRow => ({
  id: `${tag.toLowerCase()}_pw_peace_with`,
  tag,
  group: "war",
  kind: "lawful",
  opens: [{ when: world({ is: "war" }), why: "peace" }],
  needs: SIGNER[tag],
  authority: 5,
  cooldown: 2,
  fields: [
    {
      id: "with",
      options: GW_LADDER_REACH.filter((t) => t !== tag).map((t) => ({
        id: t.toLowerCase(),
        when: world({ is: "peace_target", tag: t }),
        effects: [doWorld({ do: "pair_peace", tag: t })],
      })),
    },
  ],
  tags: [],
  effects: [],
  scene: "gw_peace_sent",
});

/**
 * One note row a seat (Germany's is `deu_pw_note` beside its phase-1 row),
 * then the war and peace rows of any pair (ww171).
 */
export const GW_LADDER_POWERS: readonly GwPowerRow[] = [
  ...SEATS.map(row),
  ...SEATS.map(warRow),
  ...SEATS.map(peaceRow),
];
