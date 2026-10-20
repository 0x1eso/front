import {
  WW_NEWS_KEEP,
  WwEventCard,
  WwPolDetail,
  WwPolGlobal,
  WwPoliticsData,
  WwPolSummary,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";

/** World War 1936 P3: the screens' copy of politics, merged from WwPolitics updates. */
export class WwPoliticsView {
  private summaries = new Map<number, WwPolSummary>();
  private details = new Map<number, WwPolDetail>();
  global: WwPolGlobal | null = null;
  readonly legalOwner: Uint16Array;
  /** Newest last, at most WW_NEWS_KEEP. */
  news: {
    id: string;
    params: Record<string, string | number>;
    tick: number;
  }[] = [];
  /** News of the last merge (the ticker shows these once). */
  freshNews: { id: string; params: Record<string, string | number> }[] = [];
  /** Bumped on every merge (screens redraw when it changes). */
  version = 0;

  constructor(readonly scenario: ScenarioIndex) {
    this.legalOwner = new Uint16Array(scenario.maxRegionId() + 1);
    const owners = scenario.ownerByRegion();
    for (const r of scenario.landRegions) this.legalOwner[r.id] = owners[r.id];
  }

  apply(d: WwPoliticsData, tick: number): void {
    for (const s of d.countries) this.summaries.set(s.smallID, s);
    for (const x of d.details) this.details.set(x.smallID, x);
    if (d.global !== null) this.global = d.global;
    for (const r of d.regions) this.legalOwner[r.id] = r.legalOwner;
    this.freshNews = d.news;
    for (const n of d.news) this.news.push({ ...n, tick });
    if (this.news.length > WW_NEWS_KEEP) {
      this.news.splice(0, this.news.length - WW_NEWS_KEEP);
    }
    this.version++;
  }

  summary(smallID: number): WwPolSummary | null {
    return this.summaries.get(smallID) ?? null;
  }

  detail(smallID: number): WwPolDetail | null {
    return this.details.get(smallID) ?? null;
  }

  /** The human's open cards, oldest first (details carry them; `cards` in an update only announce). */
  cards(smallID: number): WwEventCard[] {
    return this.details.get(smallID)?.pending ?? [];
  }

  /** The faction index of a country; -1: none (or no update yet). */
  factionIdx(smallID: number): number {
    return this.summaries.get(smallID)?.faction ?? -1;
  }
}
