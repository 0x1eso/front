import {
  DomesticData,
  DomesticView,
  StatKey,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  ModifierTotals,
  techModifiers,
} from "@openfront/engine-lib/domestic/Modifiers";

/** Client-side DomesticView over the last DomesticData the worker sent. */
export class DomesticClientView implements DomesticView {
  private readonly techSet: ReadonlySet<TechId>;
  private readonly totals: ModifierTotals;

  constructor(public readonly data: DomesticData) {
    this.techSet = new Set(data.techs);
    this.totals = new ModifierTotals(techModifiers(data.techs));
  }

  pct(stat: StatKey): number {
    return this.totals.pct(stat);
  }

  hasTech(tech: TechId): boolean {
    return this.techSet.has(tech);
  }

  recruitTargetPct(): number {
    return this.data.recruitTargetPct;
  }
}
