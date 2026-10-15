import {
  DomesticData,
  DomesticView,
  ResearchProgress,
  StatKey,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  MILLI,
  RECRUIT_TARGET_DEFAULT_PCT,
  RECRUIT_TARGET_MAX_PCT,
  RECRUIT_TARGET_MIN_PCT,
} from "@openfront/engine-lib/domestic/Balance";
import {
  ModifierTotals,
  techModifiers,
} from "@openfront/engine-lib/domestic/Modifiers";
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
});
export type DomesticState = z.infer<typeof DomesticStateSchema>;

/**
 * A player's domestic-mode state: science and political power (integer
 * milli-points, so accrual stays exact), researched techs, the current
 * research and the recruit target. Only non-bot players in a domestic-mode
 * game have one.
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
  private totals = new ModifierTotals([]);
  /** toData() result until the next change. */
  private domesticDataCache: DomesticData | null = null;

  pct(stat: StatKey): number {
    return this.totals.pct(stat);
  }

  hasTech(tech: TechId): boolean {
    return this.techs.has(tech);
  }

  researchedTechs(): ReadonlySet<TechId> {
    return this.techs;
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
    this.totals = new ModifierTotals(techModifiers(this.techs));
    this.changed();
    return r.tech;
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
    d.totals = new ModifierTotals(techModifiers(d.techs));
    return d;
  }

  private changed(): void {
    this.domesticDataCache = null;
  }
}
