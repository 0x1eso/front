import {
  DomesticData,
  DomesticView,
  LawId,
  LawOption,
  StatKey,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { lawMapOf } from "@openfront/engine-lib/domestic/Laws";
import { ModifierTotals } from "@openfront/engine-lib/domestic/Modifiers";
import { domesticModifierTotals } from "@openfront/engine-lib/domestic/Policies";

/** Client-side DomesticView over the last DomesticData the worker sent. */
export class DomesticClientView implements DomesticView {
  private readonly techSet: ReadonlySet<TechId>;
  private readonly lawMap: ReadonlyMap<LawId, LawOption>;
  /** Built like the engine's (domesticModifierTotals), conditions included. */
  private readonly totals: ModifierTotals;

  constructor(public readonly data: DomesticData) {
    this.techSet = new Set(data.techs);
    this.lawMap = lawMapOf(data.laws);
    this.totals = domesticModifierTotals({
      techs: data.techs,
      laws: this.lawMap,
      government: data.government,
      conditions: new Set(data.conditions),
    });
  }

  pct(stat: StatKey): number {
    return this.totals.pct(stat);
  }

  hasTech(tech: TechId): boolean {
    return this.techSet.has(tech);
  }

  researchedTechs(): ReadonlySet<TechId> {
    return this.techSet;
  }

  laws(): ReadonlyMap<LawId, LawOption> {
    return this.lawMap;
  }

  recruitTargetPct(): number {
    return this.data.recruitTargetPct;
  }
}
