// Great War 1914 (ww169, phase 0): what a schedule pick does by itself, so a
// tone, a speech's subject or a council's agenda is never only words. One rule
// each, read by the engine (engine/ww1914/Acts.ts) after the act's own effects;
// a pick whose option already has effects of its own is left to them.
import type {
  GwAiKind,
  GwOffice,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type { GwStance } from "@openfront/engine-api/ww1914/SceneDsl";

/** How a foreign ruler takes a letter's tone: his trust, a neutral's readiness. */
export interface GwToneEffect {
  trust?: number;
  /** Readiness points (0..100) toward coming in; only while neutral. */
  readiness?: number;
}

/**
 * A letter to a foreign ruler, by its tone and his country's hidden character.
 * A letter to one's own subject goes by his temperament instead (TalkRules
 * `stanceFit`, the pairing `tone_fits` reads).
 */
export const GW_TONE_EFFECTS: Readonly<
  Record<GwStance, Readonly<Record<GwAiKind, GwToneEffect>>>
> = {
  warm: {
    cautious: { trust: 1 },
    hardline: {},
    opportunist: { readiness: 5 },
    principled: { trust: 1 },
  },
  frank: {
    cautious: {},
    hardline: { trust: 1 },
    opportunist: {},
    principled: { trust: 1 },
  },
  cold: {
    cautious: { trust: -1 },
    hardline: {},
    opportunist: { readiness: -5 },
    principled: {},
  },
  threat: {
    cautious: { trust: -1, readiness: -5 },
    hardline: { trust: -1, readiness: 5 },
    opportunist: { readiness: 5 },
    principled: { trust: -1 },
  },
  flatter: {
    cautious: {},
    hardline: { trust: -1 },
    opportunist: { trust: 1 },
    principled: { trust: -1 },
  },
};

/** A speech's `on`: the bloc whose word the subject moves, by option id. */
export const GW_SUBJECT_BLOCS: Readonly<Record<string, GwBloc>> = {
  after: "workers",
  allies: "press",
  army: "army",
  army_law: "army",
  belgium: "press",
  bread: "workers",
  crown: "court",
  dead: "press",
  deal: "parliament",
  dilution: "business",
  draft: "army",
  duty: "army",
  endure: "workers",
  ireland: "parliament",
  language: "parliament",
  law: "parliament",
  lists: "army",
  lorraine: "army",
  loyalty: "court",
  men: "army",
  money: "business",
  nations: "parliament",
  peace: "workers",
  rents: "workers",
  republic: "parliament",
  return: "press",
  right: "press",
  schools: "press",
  small_nations: "press",
  thanks: "army",
  tongues: "army",
  trust: "parliament",
  union: "parliament",
  unity: "parliament",
  war: "army",
  youth: "press",
};

/** Everyone the council's people fields named, rather than one office. */
export const GW_AGENDA_ALL = "attend";

/**
 * A council's or dinner's `agenda`: whose matter it is, by option id. His
 * trust takes a step; `attend` warms everyone picked to sit at the table.
 */
export const GW_AGENDA_LEADS: Readonly<
  Record<string, GwOffice | typeof GW_AGENDA_ALL>
> = {
  aims: "foreign",
  army_law: "war",
  belgium: "foreign",
  bread: "interior",
  britain: "navy",
  caucasus: "chief_of_staff",
  duma: "chancellor",
  east: "foreign",
  end: "foreign",
  family: GW_AGENDA_ALL,
  food: "interior",
  franchise: "chancellor",
  friend: GW_AGENDA_ALL,
  front: "chief_of_staff",
  germans: "foreign",
  grain: "hun_pm",
  invasion: "navy",
  ireland: "ireland",
  language: "interior",
  law: "chancellor",
  minister: "chancellor",
  money: "finance",
  mood: GW_AGENDA_ALL,
  next_premier: GW_AGENDA_ALL,
  north: "chief_of_staff",
  nothing: GW_AGENDA_ALL,
  prisoners: "foreign",
  quota: "finance",
  russia: "foreign",
  schools: "interior",
  sea: "navy",
  secret_sitting: GW_AGENDA_ALL,
  shells: "war",
  south: "chief_of_staff",
  union: GW_AGENDA_ALL,
  war: "war",
  war_book: "war",
  week: "chancellor",
  west: "war",
};
