import {
  CONDITIONS,
  Condition,
  DomesticData,
  DomesticView,
  GOVERNMENT_IDS,
  GovernmentId,
  LAW_IDS,
  LAW_OPTIONS,
  LawId,
  LawOption,
  PolicyFlag,
  ResearchProgress,
  StatKey,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  LAW_COOLDOWN_TICKS,
  MILLI,
  RECRUIT_TARGET_DEFAULT_PCT,
  RECRUIT_TARGET_MAX_PCT,
  RECRUIT_TARGET_MIN_PCT,
} from "@openfront/engine-lib/domestic/Balance";
import { governmentTier } from "@openfront/engine-lib/domestic/Governments";
import { ModifierTotals } from "@openfront/engine-lib/domestic/Modifiers";
import {
  domesticModifiers,
  policyFlags,
} from "@openfront/engine-lib/domestic/Policies";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";

export const DomesticStateSchema = z.object({
  scienceMilli: zInt(),
  politicalMilli: zInt(),
  cumScienceMilli: zInt(),
  cumPoliticalMilli: zInt(),
  lastScienceMilli: zInt(),
  lastPoliticalMilli: zInt(),
  techs: z.array(z.enum(TECH_IDS)),
  research: z
    .object({
      tech: z.enum(TECH_IDS),
      ticksLeft: zInt(),
      totalTicks: zInt(),
    })
    .nullable(),
  recruitTargetPct: zInt(),
  // Laws and government (phase 2). Optional so earlier snapshots still load.
  laws: z
    .array(z.object({ law: z.enum(LAW_IDS), option: z.enum(LAW_OPTIONS) }))
    .optional(),
  lawCooldownUntilTick: zInt().optional(),
  governmentTier: zInt().optional(),
  government: z.enum(GOVERNMENT_IDS).optional(),
  conditions: z.array(z.enum(CONDITIONS)).optional(),
});
export type DomesticState = z.infer<typeof DomesticStateSchema>;

/**
 * A player's domestic-mode state: science and political power (integer
 * milli-points, so accrual stays exact), researched techs, the current
 * research, the recruit target, proclaimed laws, the government and the
 * conditions that conditional modifiers test. Only non-bot players in a
 * domestic-mode game have one.
 */
export class PlayerDomestic implements DomesticView {
  private scienceMilli = 0;
  private politicalMilli = 0;
  private cumScienceMilli = 0;
  private cumPoliticalMilli = 0;
  private lastScienceMilli = 0;
  private lastPoliticalMilli = 0;
  private techs = new Set<TechId>();
  private research: ResearchProgress | null = null;
  private recruitTarget = RECRUIT_TARGET_DEFAULT_PCT;
  /** Proclaimed laws, in proclamation order. */
  private laws = new Map<LawId, LawOption>();
  private lawCooldownUntil = 0;
  private tier = 0;
  private government: GovernmentId = "chiefdom";
  /** Set once per processed second (DomesticEconomy.activeConditions). */
  private conditions: ReadonlySet<Condition> = new Set<Condition>();
  private totals = new ModifierTotals([]);
  private flags: ReadonlySet<PolicyFlag> = new Set<PolicyFlag>();
  /** toData() result until the next change. */
  private domesticDataCache: DomesticData | null = null;

  pct(stat: StatKey): number {
    return this.totals.pct(stat, this.conditions);
  }

  hasTech(tech: TechId): boolean {
    return this.techs.has(tech);
  }

  researchedTechs(): ReadonlySet<TechId> {
    return this.techs;
  }

  hasFlag(flag: PolicyFlag): boolean {
    return this.flags.has(flag);
  }

  recruitTargetPct(): number {
    return this.recruitTarget;
  }

  setRecruitTargetPct(pct: number): void {
    const clamped = Math.min(
      RECRUIT_TARGET_MAX_PCT,
      Math.max(RECRUIT_TARGET_MIN_PCT, Math.round(pct)),
    );
    if (clamped === this.recruitTarget) return;
    this.recruitTarget = clamped;
    this.changed();
  }

  scienceMilliAvailable(): number {
    return this.scienceMilli;
  }

  politicalMilliAvailable(): number {
    return this.politicalMilli;
  }

  cumulativeScienceMilli(): number {
    return this.cumScienceMilli;
  }

  cumulativePoliticalMilli(): number {
    return this.cumPoliticalMilli;
  }

  currentResearch(): ResearchProgress | null {
    return this.research;
  }

  /** Adds one processed second of output. */
  addYield(scienceMilli: number, politicalMilli: number): void {
    this.scienceMilli += scienceMilli;
    this.politicalMilli += politicalMilli;
    this.cumScienceMilli += scienceMilli;
    this.cumPoliticalMilli += politicalMilli;
    this.lastScienceMilli = scienceMilli;
    this.lastPoliticalMilli = politicalMilli;
    this.changed();
  }

  spendScienceMilli(amount: number): void {
    if (amount < 0 || amount > this.scienceMilli) {
      throw new Error(
        `cannot spend ${amount} science milli-points, have ${this.scienceMilli}`,
      );
    }
    this.scienceMilli -= amount;
    this.changed();
  }

  /** Spending never lowers the cumulative total (spec §5.1). */
  spendPoliticalMilli(amount: number): void {
    if (amount < 0 || amount > this.politicalMilli) {
      throw new Error(
        `cannot spend ${amount} political milli-points, have ${this.politicalMilli}`,
      );
    }
    this.politicalMilli -= amount;
    this.changed();
  }

  beginResearch(tech: TechId, ticks: number): void {
    this.research = { tech, ticksLeft: ticks, totalTicks: ticks };
    this.changed();
  }

  /** Moves research forward by `ticks`; returns the tech it finished, if any. */
  advanceResearch(ticks: number): TechId | null {
    const r = this.research;
    if (r === null) return null;
    const left = r.ticksLeft - ticks;
    if (left > 0) {
      this.research = { ...r, ticksLeft: left };
      this.changed();
      return null;
    }
    this.research = null;
    this.techs.add(r.tech);
    this.rebuild();
    this.changed();
    return r.tech;
  }

  activeConditions(): ReadonlySet<Condition> {
    return this.conditions;
  }

  /** Conditional modifiers follow `conditions` until the next call. */
  setConditions(conditions: ReadonlySet<Condition>): void {
    if (
      conditions.size === this.conditions.size &&
      [...conditions].every((c) => this.conditions.has(c))
    ) {
      return;
    }
    this.conditions = new Set(conditions);
    this.changed();
  }

  proclaimedLaws(): ReadonlyMap<LawId, LawOption> {
    return this.laws;
  }

  lawCooldownUntilTick(): number {
    return this.lawCooldownUntil;
  }

  /** Records a law forever and starts the cooldown. Callers validate first. */
  proclaimLaw(law: LawId, option: LawOption, nowTick: number): void {
    this.laws.set(law, option);
    this.lawCooldownUntil = nowTick + LAW_COOLDOWN_TICKS;
    this.rebuild();
    this.changed();
  }

  governmentTier(): number {
    return this.tier;
  }

  currentGovernment(): GovernmentId {
    return this.government;
  }

  /** Raises the tier to what cumulative political power reached; the new tier if it rose. */
  refreshGovernmentTier(): number | null {
    const tier = governmentTier(this.cumPoliticalMilli);
    if (tier <= this.tier) return null;
    this.tier = tier;
    this.changed();
    return tier;
  }

  /**
   * Replaces the government (its effects swap at once, spec §6.1) and
   * restarts the law cooldown. Callers validate first.
   */
  chooseGovernment(government: GovernmentId, nowTick: number): void {
    this.government = government;
    this.lawCooldownUntil = nowTick + LAW_COOLDOWN_TICKS;
    this.rebuild();
    this.changed();
  }

  toData(): DomesticData {
    this.domesticDataCache ??= {
      science: Math.floor(this.scienceMilli / MILLI),
      political: Math.floor(this.politicalMilli / MILLI),
      cumulativeScience: Math.floor(this.cumScienceMilli / MILLI),
      cumulativePolitical: Math.floor(this.cumPoliticalMilli / MILLI),
      sciencePerSec: this.lastScienceMilli / MILLI,
      politicalPerSec: this.lastPoliticalMilli / MILLI,
      techs: [...this.techs],
      research: this.research === null ? null : { ...this.research },
      recruitTargetPct: this.recruitTarget,
      laws: Object.fromEntries(this.laws) as Partial<Record<LawId, LawOption>>,
      lawCooldownUntilTick: this.lawCooldownUntil,
      governmentTier: this.tier,
      government: this.government,
      conditions: [...this.conditions],
    };
    return this.domesticDataCache;
  }

  snapshot(): DomesticState {
    return {
      scienceMilli: this.scienceMilli,
      politicalMilli: this.politicalMilli,
      cumScienceMilli: this.cumScienceMilli,
      cumPoliticalMilli: this.cumPoliticalMilli,
      lastScienceMilli: this.lastScienceMilli,
      lastPoliticalMilli: this.lastPoliticalMilli,
      techs: [...this.techs],
      research: this.research === null ? null : { ...this.research },
      recruitTargetPct: this.recruitTarget,
      laws: [...this.laws].map(([law, option]) => ({ law, option })),
      lawCooldownUntilTick: this.lawCooldownUntil,
      governmentTier: this.tier,
      government: this.government,
      conditions: [...this.conditions],
    };
  }

  static restore(s: DomesticState): PlayerDomestic {
    const d = new PlayerDomestic();
    d.scienceMilli = s.scienceMilli;
    d.politicalMilli = s.politicalMilli;
    d.cumScienceMilli = s.cumScienceMilli;
    d.cumPoliticalMilli = s.cumPoliticalMilli;
    d.lastScienceMilli = s.lastScienceMilli;
    d.lastPoliticalMilli = s.lastPoliticalMilli;
    d.techs = new Set(s.techs);
    d.research = s.research === null ? null : { ...s.research };
    d.recruitTarget = s.recruitTargetPct;
    d.laws = new Map((s.laws ?? []).map((l) => [l.law, l.option] as const));
    d.lawCooldownUntil = s.lawCooldownUntilTick ?? 0;
    d.tier = s.governmentTier ?? 0;
    d.government = s.government ?? "chiefdom";
    d.conditions = new Set(s.conditions ?? []);
    d.rebuild();
    return d;
  }

  /** Recomputes the modifier totals and flags from techs, laws and government. */
  private rebuild(): void {
    this.totals = domesticModifiers(this.techs, this.laws, this.government);
    this.flags = policyFlags(this.laws, this.government);
  }

  private changed(): void {
    this.domesticDataCache = null;
  }
}
