import type {
  DesignDef,
  DesignKind,
  WwArmyGroupData,
  WwDepthData,
  WwDepthDetail,
  WwDepthFx,
  WwDepthSummary,
  WwDepthWorld,
} from "@openfront/engine-api/ww1936/DepthTypes";

/**
 * World War 1936 P6 (spec §21.5, plan decisions 19, 36): the screens' copy
 * of the depth systems, merged from WwDepth updates. Screens and FogModel
 * read only this.
 */
export class WwDepthView {
  private sums = new Map<number, WwDepthSummary>();
  private details = new Map<number, WwDepthDetail>();
  private rows = new Map<number, Uint8Array>();
  /** `${smallID}:${kind}:${slot}` → the saved design. */
  private designs = new Map<string, DesignDef>();
  private groupsData: WwArmyGroupData[] = [];
  marketData: NonNullable<WwDepthData["market"]> = {
    listings: [],
    deals: [],
    licences: [],
    embargoes: [],
    pendingLicences: [],
  };
  minesData: [number, number, number][] = [];
  acesData: NonNullable<WwDepthData["aces"]> = [];
  worldData: WwDepthWorld = {
    nuked: [],
    flooded: [],
    scorched: [],
    harbors: [],
    damLevel: [],
  };
  congressBp = 3_000;
  bopData: [number, number][] = [];
  treatyData: NonNullable<WwDepthData["treaty"]> = {
    members: [],
    escalated: false,
    endDay: 0,
  };
  factionRulesData: [number, number, boolean][] = [];
  factionGoalsData: [number, number[], number][] = [];
  private fxQueue: WwDepthFx[] = [];
  /** Bumped on every applied update (screens cache on it). */
  version = 0;

  apply(d: WwDepthData): void {
    for (const s of d.countries ?? []) this.sums.set(s.smallID, s);
    for (const x of d.details ?? []) this.details.set(x.smallID, x);
    for (const r of d.intel ?? []) {
      this.rows.set(r.observer, Uint8Array.from(r.row));
    }
    for (const x of d.designsOf ?? []) {
      const k = `${x.smallID}:${x.kind}:${x.slot}`;
      if (x.def === null) this.designs.delete(k);
      else this.designs.set(k, x.def);
    }
    if (d.armyGroups) this.groupsData = d.armyGroups;
    if (d.market) this.marketData = d.market;
    if (d.mines) this.minesData = d.mines;
    if (d.aces) this.acesData = d.aces;
    if (d.world) this.worldData = d.world;
    if (d.congressBp !== undefined) this.congressBp = d.congressBp;
    if (d.bop) this.bopData = d.bop;
    if (d.treaty) this.treatyData = d.treaty;
    if (d.factionRules) this.factionRulesData = d.factionRules;
    if (d.factionGoals) this.factionGoalsData = d.factionGoals;
    this.fxQueue.push(...d.fx);
    this.version++;
  }

  summary(id: number): WwDepthSummary | undefined {
    return this.sums.get(id);
  }

  detail(id: number): WwDepthDetail | undefined {
    return this.details.get(id);
  }

  /** The observer's intel row (cap × 4), or undefined before the first day. */
  intelRow(observer: number): Uint8Array | undefined {
    return this.rows.get(observer);
  }

  intelOf(
    observer: number,
    target: number,
    domain: number,
  ): number | undefined {
    const r = this.rows.get(observer);
    return r === undefined ? undefined : r[target * 4 + domain];
  }

  designOf(id: number, kind: DesignKind, slot: number): DesignDef | undefined {
    return this.designs.get(`${id}:${kind}:${slot}`);
  }

  armyGroups(): readonly WwArmyGroupData[] {
    return this.groupsData;
  }

  takeFx(): WwDepthFx[] {
    const f = this.fxQueue;
    this.fxQueue = [];
    return f;
  }
}
