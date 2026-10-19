import {
  Condition,
  DomesticData,
  DomesticView,
  LawId,
  LawOption,
  StatKey,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { lawMapOf } from "@openfront/engine-lib/domestic/Laws";
import { ModifierTotals } from "@openfront/engine-lib/domestic/Modifiers";
import { domesticModifiers } from "@openfront/engine-lib/domestic/Policies";

/** Client-side DomesticView over the last DomesticData the worker sent. */
export class DomesticClientView implements DomesticView {
  private readonly techSet: ReadonlySet<TechId>;
  private readonly lawMap: ReadonlyMap<LawId, LawOption>;
  private readonly conditionSet: ReadonlySet<Condition>;
  private readonly totals: ModifierTotals;

  constructor(public readonly data: DomesticData) {
    this.techSet = new Set(data.techs);
    this.lawMap = lawMapOf(data.laws);
    this.conditionSet = new Set(data.conditions);
    // Same totals as the engine's PlayerDomestic (Decision 22), congress
    // resolutions included.
    this.totals = domesticModifiers(
      data.techs,
      this.lawMap,
      data.government,
      data.congressModifiers ?? [],
    );
  }

  pct(stat: StatKey): number {
    return this.totals.pct(stat, this.conditionSet);
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
