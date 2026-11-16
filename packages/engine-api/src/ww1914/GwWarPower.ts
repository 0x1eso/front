// Great War 1914 (ww218 §2, lane W): a country's war power in four strands,
// each a reading of the state 0..3 (never a resource: nothing is spent from
// it). The engine (engine/ww1914/WarPower.ts) derives them each chapter; only
// the rail and the drill are kept, with their growth towards the next step,
// and the garrisons its hard-held land ties down.
import { z } from "zod";

const int = z.number().int();

/** The strands: firepower, reserves, mobility, staying power. */
export const GW_POWER_STRANDS = [
  "fire",
  "reserves",
  "mobility",
  "staying",
] as const;
export type GwPowerStrand = (typeof GW_POWER_STRANDS)[number];

/** Top of every strand, of the rail and of the drill. */
export const GW_POWER_MAX = 3;

export const GwWarPowerStateSchema = z.object({
  /** 0..3: rail and administration behind the army. */
  rail: int,
  /** 0..3: how trained the men sent to the front are. */
  drill: int,
  /** Progress towards the next rail step. */
  railGrow: int,
  /** Progress towards the next drill step (below 0: towards losing one). */
  drillGrow: int,
  /** Bands tied down holding occupied land hard (anti-snowball, §2). */
  garrison: int,
  /** The chapter its form of government last changed; absent never. */
  regimeAt: int.optional(),
});
export type GwWarPowerState = z.infer<typeof GwWarPowerStateSchema>;

/**
 * The 작전 tab's reading of the seat's own war power, in words: each strand
 * 0..3 (text `gw.ui.power.<strand>.<level>`), and why it stands there
 * (`gw.ui.power.why.<key>`), at most two reasons a strand.
 */
export interface GwWarPowerView {
  readonly levels: Readonly<Record<GwPowerStrand, number>>;
  readonly why: Readonly<Record<GwPowerStrand, readonly string[]>>;
  /** Bands holding occupied land instead of standing at the front. */
  readonly garrison: number;
}
