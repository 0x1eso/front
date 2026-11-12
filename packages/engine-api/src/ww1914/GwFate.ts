// Great War 1914 (ww199, design ww198 + the owner's vassal): what becomes of
// a beaten country's land. Each place given up at a table gets a fate: annexed,
// held under military government, made into a new state, given to an ally,
// given back, or kept as the victor's vassal. A new state is a real country
// with its own colour and name; a vassal keeps the beaten country's colour and
// is named as the victor's dependency ("독일령 프랑스"). Rules live in
// engine/ww1914/Fate; rows in engine-lib/ww1914/FateRows. Every list here is
// APPEND ONLY: state, orders and content name these ids.
import { z } from "zod";
import { GW_TAGS, GwTag } from "./GwCountries";
import { GwPlaceSchema } from "./GwPlaces";

/** Client states a ruler can set up (was GreatWarTypes'; ww199 appends five). */
export const GW_CLIENTS = [
  "poland",
  "lithuania",
  "ukraine",
  "flanders",
  "albania",
  "serbia",
  // ww199
  "baltic_duchy",
  "georgia",
  "hejaz",
  "bohemia",
  "rhineland",
] as const;
export type GwClient = (typeof GW_CLIENTS)[number];

/**
 * A place's fate (design §2.2). Text: `gw.fate.<id>` (the chip) and the
 * pack's `settle` words. APPEND ONLY (wire).
 */
export const GW_FATES = [
  "annex", // 합병한다: the taker's for good
  "occupy", // 군정으로 둔다: held for a term, then home
  "state", // 나라를 세운다: a new country of its own colour and name
  "ally", // 동맹에게 준다
  "return", // 돌려준다
  "vassal", // 속국으로 둔다: the beaten country's colour, the victor's dependency
] as const;
export type GwFate = (typeof GW_FATES)[number];

/** How long military government lasts: short 2 years, long 5 (GW_FATE_TERM_DAYS). */
export const GW_FATE_TERMS = ["short", "long"] as const;
export type GwFateTerm = (typeof GW_FATE_TERMS)[number];

/**
 * A new state's form: it names the state on the map (`gw.client.<id>.<form>`).
 * APPEND ONLY.
 */
export const GW_CLIENT_FORMS = [
  "kingdom",
  "duchy",
  "principality",
  "hetmanate",
  "republic",
  "regency",
  "protectorate",
] as const;
export type GwClientForm = (typeof GW_CLIENT_FORMS)[number];

/** How the ruler signs a treaty (order `treaty_sign`, effect `treaty_sign`). */
export const GW_SIGN_HOWS = [
  "sign", // 서명한다
  "press", // 한 번 더 밀어붙인다: one more round, once; costs the partners' trust
  "reserve", // 유보를 달고 서명한다: hard clauses run softer; press and staff grumble
] as const;
export type GwSignHow = (typeof GW_SIGN_HOWS)[number];

/**
 * The `settle` answer's plans (a course's `settle`): each paints a fate per
 * place of the beaten country (Fate.settlePlan). APPEND ONLY.
 */
export const GW_SETTLE_PLANS = [
  "wide", // 넓게 묶는다: states where open, the rest held long
  "narrow", // 좁게 끝낸다: a border strip annexed, the rest given back
  "hold", // 전쟁이 끝날 때까지 군정으로 둔다
  "strip", // 국경 띠를 떼어 합병한다 (the general staff's course)
  "vassal", // 속국으로 둔다: the whole country as a vassal where the capital is held
] as const;
export type GwSettlePlan = (typeof GW_SETTLE_PLANS)[number];

/** A partner's word when two of a side want one place (table words). */
export const GW_PARTNER_WORDS = ["yield", "joint", "hold"] as const;
export type GwPartnerWord = (typeof GW_PARTNER_WORDS)[number];

/** Loyalty of a new state or a vassal to its founder: 0..3, words only. */
export const GW_LOYALTY_MAX = 3;
/** Loyalty in words (`gw.fate.loyalty_<word>`): 믿을 만함 / 흔들림 / 등을 돌리려 함. */
export const GW_LOYALTY_WORDS = ["turning", "wavering", "loyal"] as const;
export type GwLoyaltyWord = (typeof GW_LOYALTY_WORDS)[number];
/** 0 등을 돌리려 함, 1 흔들림, 2-3 믿을 만함. */
export function gwLoyaltyWord(loyalty: number): GwLoyaltyWord {
  return loyalty <= 0 ? "turning" : loyalty === 1 ? "wavering" : "loyal";
}

const Tag = z.enum(GW_TAGS);

/**
 * A new state's row on its nation (`GwNationState.client`). `by` founded it;
 * `with` founded it jointly (both must agree). `crown`: the candidate id on
 * the throne, "regency" for a regency council, null until picked.
 */
export const GwClientStateSchema = z.object({
  id: z.enum(GW_CLIENTS),
  by: Tag,
  with: Tag.optional(),
  form: z.enum(GW_CLIENT_FORMS),
  loyalty: z.number().int(),
  since: z.number().int(),
  crown: z.string().nullable(),
});
export type GwClientState = z.infer<typeof GwClientStateSchema>;

/**
 * A vassal's row on its nation (`GwNationState.vassal`): `by` is the overlord,
 * `of` the beaten country whose colour it keeps (itself for a whole-country
 * vassal, else a slot tag of GW_VASSAL_SLOTS carved out of `of`).
 * `resist` 0..3 as in Rule.ts.
 */
export const GwVassalStateSchema = z.object({
  by: Tag,
  of: Tag,
  loyalty: z.number().int(),
  resist: z.number().int(),
  since: z.number().int(),
});
export type GwVassalState = z.infer<typeof GwVassalStateSchema>;

/** A fate the seat painted on a place: the claims pane and the table read it. */
export const GwFateMarkSchema = z.object({
  fate: z.enum(GW_FATES),
  /** `ally`: the ally it goes to. `state`: a joint founder. */
  for: Tag.optional(),
  /** `state`: which state. */
  client: z.enum(GW_CLIENTS).optional(),
  /** `occupy`: how long. */
  term: z.enum(GW_FATE_TERMS).optional(),
});
export type GwFateMark = z.infer<typeof GwFateMarkSchema>;

/**
 * A fate a table signed, kept on `s.fates` by place: what revanche, undoing,
 * the 통치 tab and the memoir read. `by` decided it; `of` lost it; `to` holds
 * it now (the client's or vassal's tag, the ally, `by`, or `of` for return).
 * `until`: the day a term occupation ends.
 */
export const GwFateRecordSchema = z.object({
  place: GwPlaceSchema,
  fate: z.enum(GW_FATES),
  by: Tag,
  of: Tag,
  to: Tag,
  chapter: z.number().int(),
  until: z.number().int().optional(),
  client: z.enum(GW_CLIENTS).optional(),
});
export type GwFateRecord = z.infer<typeof GwFateRecordSchema>;

/**
 * A country named by its fate, for every screen (`GreatWarData.realms`): the
 * map and the panels name it with `gwRealmName`. Absent for a country that is
 * only itself.
 */
export interface GwRealmView {
  tag: GwTag;
  /** A new state: its id, form and founder. */
  client?: { id: GwClient; form: GwClientForm; by: GwTag; with?: GwTag };
  /** A vassal: its overlord and the country it was cut from. */
  vassal?: { by: GwTag; of: GwTag };
}

/**
 * The text key a realm is named by, and its params. A new state:
 * `gw.client.<id>.<form>`. A vassal: `gw.vassal.<BY>_<OF>` (written per
 * pair), else `gw.vassal.any` with {by} and {of} as country names.
 */
export function gwRealmName(
  r: GwRealmView,
): { key: string; fallback?: string; by?: GwTag; of?: GwTag } | null {
  if (r.client !== undefined) {
    return {
      key: `gw.client.${r.client.id}.${r.client.form}`,
      fallback: `gw.country.${r.tag}`,
    };
  }
  if (r.vassal !== undefined) {
    return {
      key: `gw.vassal.${r.vassal.by}_${r.vassal.of}`,
      fallback: "gw.vassal.any",
      by: r.vassal.by,
      of: r.vassal.of,
    };
  }
  return null;
}

/** A ruled land or a state of the seat's, for the 통치 tab (words only). */
export interface GwRuledView {
  /** `rule`: land held under rule; `client`: a state it founded; `vassal`. */
  kind: "rule" | "client" | "vassal";
  tag: GwTag;
  /** The rule row's policy ("army", "civil", "client", "annexed"). */
  policy?: string;
  /** `occupy` rows: "short" or "long"; absent with no term. */
  term?: GwFateTerm;
  /** `GW_LOYALTY_WORDS` (clients and vassals) or resistance 0..3 as a word. */
  loyalty?: GwLoyaltyWord;
  resist?: number;
  client?: GwClient;
  form?: GwClientForm;
  crown?: string | null;
}
