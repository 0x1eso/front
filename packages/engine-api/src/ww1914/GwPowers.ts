// Great War 1914: the ruler's powers (ww169, design ww168 B2-B3). The words,
// the state a seat keeps and what the 통치 tab reads. Rows are
// engine-lib/ww1914/PowerRows, content in content/powers/<tag>.ts, the running
// engine/ww1914/Powers. See /home/eser/dev/ww169-format.md. Lists are APPEND ONLY.
import { z } from "zod";

/** The 통치 tab's groups, in order. Text: gw.power.group.<id>. */
export const GW_POWER_GROUPS = [
  "war", // 전쟁과 평화
  "treaty", // 동맹과 조약
  "army", // 군
  "house", // 의회
  "cabinet", // 내각
  "home", // 국내
  "schedule", // 일정: the schedule tab, linked
  "beyond", // 법 밖의 일: every `beyond` row shows here
] as const;
export type GwPowerGroup = (typeof GW_POWER_GROUPS)[number];

/** Lawful, lawful against custom, beyond the law. */
export const GW_POWER_KINDS = ["lawful", "custom", "beyond"] as const;
export type GwPowerKind = (typeof GW_POWER_KINDS)[number];

/**
 * What a target list holds. person: the seat's own people (cast role
 * `target`); country: tags; front: theatres; house: chambers; option: the
 * row's own words (pack `powers.<id>.opt`).
 */
export const GW_POWER_TARGETS = [
  "person",
  "country",
  "front",
  "house",
  "option",
] as const;
export type GwPowerTargetKind = (typeof GW_POWER_TARGETS)[number];

/** What the world answers to (design B3). A row carries some. */
export const GW_POWER_TAGS = [
  "war_offensive",
  "war_defensive",
  "mobilise",
  "stand_down",
  "ultimatum",
  "peace_white",
  "peace_separate",
  "treaty",
  "alliance_broken",
  "house_closed",
  "house_opened",
  "dissolve",
  "decree",
  "franchise",
  "army_over_civil",
  "command_self",
  "press_gag",
  "arrests",
  "amnesty",
  "harsh_war",
  "harsh_home",
  "cabinet_change",
  "coalition",
] as const;
export type GwPowerTag = (typeof GW_POWER_TAGS)[number];

/**
 * Who answers. factions: rows whose bloc is in `of` (heat); cabinet: people in
 * office whose camp is in `of` (trust); allies: countries on the seat's side
 * (their trust in it); neutrals: countries on no side (trust, readiness);
 * people: the blocs in `of` (opinion). Anything else rides on `does`.
 */
export const GW_REACTOR_ACTORS = [
  "factions",
  "cabinet",
  "allies",
  "neutrals",
  "people",
  "other",
] as const;
export type GwReactorActor = (typeof GW_REACTOR_ACTORS)[number];

/** How a use ended, for the record and the next use. */
export const GW_POWER_ENDS = [
  "done",
  "refused", // the signer wouldn't
  "no_consent", // the consent faction wouldn't
  "council_lost", // the cabinet voted it down
  "house_lost", // the house voted it down
  "without", // done in its beyond form, past the signer
] as const;
export type GwPowerEnd = (typeof GW_POWER_ENDS)[number];

const Id = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(48);

/** A seat's powers (absent until the first use or sounding). */
export const GwPowerStateSchema = z.object({
  /** Every use, in order. `target`: the picked id, null with none. */
  used: z.array(
    z.object({
      id: Id,
      chapter: z.number().int(),
      target: z.string().nullable(),
      end: z.enum(GW_POWER_ENDS),
    }),
  ),
  /** The signer sounded out: what he said, which can be wrong. */
  sounded: z.array(
    z.object({
      id: Id,
      person: Id,
      said: z.boolean(),
      chapter: z.number().int(),
    }),
  ),
});
export type GwPowerState = z.infer<typeof GwPowerStateSchema>;

/** A power row as the 통치 tab sees it: facts only, never a result. */
export interface GwPowerView {
  id: string;
  /** Where it shows: `beyond` for every beyond row. */
  group: GwPowerGroup;
  kind: GwPowerKind;
  /** The procedure, as facts. */
  needs: {
    office?: string;
    /** Who holds that office now; null: nobody. */
    signer?: string | null;
    houses?: readonly string[];
    council?: boolean;
    /** A faction whose consent it needs. */
    consent?: string;
  };
  /** Greyed: the reason key (pack `powers.<id>.why.<key>`, else gw.power.why.<key>). */
  why: string | null;
  /** The target list; null when the row has none. */
  target: { kind: GwPowerTargetKind; ids: readonly string[] } | null;
  /** Further list fields: id and the open option ids. */
  fields: readonly { id: string; options: readonly string[] }[];
  /** Going past the signer is possible (its beyond form). */
  without: boolean;
  /** What the signer said when sounded out lately; null: not asked. */
  sounded: { person: string; said: boolean } | null;
  /** It spends a schedule slot. */
  slot: boolean;
}
