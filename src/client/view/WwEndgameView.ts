// World War 1936 P5 (spec §3.5–§3.6, §21.4; plan decision 23): the merged
// endgame updates the screens read — country states and names, who
// controls what, wars, the open conference, occupation, cores, zones,
// subjects, exiles, aid, takeover cards, news.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  CountryState,
  OccupationLaw,
  WwAidView,
  WwConferenceView,
  WwCountryView,
  WwEndgameData,
  WwExileView,
  WwOccView,
  WwPeaceLogEntry,
  WwSubjectView,
  WwTakeoverView,
  WwWarSummary,
  WwZoneView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { GameEvent } from "@openfront/shared/EventBus";
import { translateText } from "../Utils";

/** How many endgame news lines the view keeps. */
const NEWS_KEEP = 30;

/**
 * P5 (plan Task 1 Step 14): the client's controller changed (a takeover,
 * spectating). The open drawers close (lane U3 listens); GameView queues
 * it (takeControllerChanges) for the runner's event bus.
 */
export class WwControllerChangedEvent implements GameEvent {
  constructor(
    /** The country the client now controls; 0: spectating. */
    public readonly smallID: number,
  ) {}
}

export class WwEndgameView {
  countries = new Map<number, WwCountryView>();
  controllers: [string, number][] = [];
  wars: WwWarSummary[] = [];
  conferenceView: WwConferenceView | null = null;
  queued = 0;
  peaceLog: WwPeaceLogEntry[] = [];
  occupation = new Map<number, WwOccView>();
  occLaws: {
    by: number;
    of: number;
    law: OccupationLaw;
    lockUntilDay: number;
  }[] = [];
  cores = new Map<number, number[]>();
  zones: WwZoneView[] = [];
  subjects: WwSubjectView[] = [];
  exiles: WwExileView[] = [];
  aid = new Map<number, WwAidView>();
  takeover: WwTakeoverView[] = [];
  news: { id: string; params: Record<string, string | number> }[] = [];

  /** Merges one update: every present field; occupation, aid and cores by key; news appended. */
  apply(d: WwEndgameData): void {
    for (const c of d.countries ?? []) this.countries.set(c.smallID, c);
    if (d.controllers !== undefined) {
      this.controllers = d.controllers.map(([c, i]) => [c, i]);
    }
    if (d.wars !== undefined) this.wars = d.wars;
    if (d.conference !== undefined) this.conferenceView = d.conference;
    if (d.queuedConferences !== undefined) this.queued = d.queuedConferences;
    if (d.peaceLog !== undefined) this.peaceLog = d.peaceLog;
    for (const o of d.occupation ?? []) this.occupation.set(o.region, o);
    for (const r of d.occupationGone ?? []) this.occupation.delete(r);
    if (d.occLaws !== undefined) this.occLaws = d.occLaws;
    // Kept when empty too: a region whose cores all went is nobody's core,
    // not the scenario's (coreHolders).
    for (const c of d.coreChanges ?? [])
      this.cores.set(c.region, [...c.holders]);
    if (d.zones !== undefined) this.zones = d.zones;
    if (d.subjects !== undefined) this.subjects = d.subjects;
    if (d.exiles !== undefined) this.exiles = d.exiles;
    for (const a of d.aid ?? []) this.aid.set(a.smallID, a);
    if (d.takeover !== undefined) this.takeover = d.takeover;
    if (d.news.length > 0) {
      this.news = [...this.news, ...d.news].slice(-NEWS_KEEP);
    }
  }

  /** Spec §3.5: the map label and every country name on screen. */
  displayName(smallID: number, tagOf: (id: number) => CountryTag): string {
    const c = this.countries.get(smallID);
    if (c?.nameKey) {
      return translateText(
        c.nameKey,
        c.nameArg
          ? { country: translateText(`ww1936.country.${c.nameArg}`) }
          : {},
      );
    }
    return translateText(`ww1936.country.${tagOf(smallID)}`);
  }

  /** The country `client` controls after a takeover (0: spectating); null: its own. */
  controlledBy(client: string): number | null {
    for (const [c, id] of this.controllers) if (c === client) return id;
    return null;
  }

  isExile(id: number): boolean {
    return this.exiles.some((e) => e.smallID === id);
  }

  subjectOf(id: number): WwSubjectView | null {
    return this.subjects.find((s) => s.subject === id) ?? null;
  }

  conference(): WwConferenceView | null {
    return this.conferenceView;
  }

  isDormant(id: number): boolean {
    return this.countries.get(id)?.state === "dormant";
  }

  /** The engine's country state; null before its first update. */
  countryState(id: number): CountryState | null {
    return this.countries.get(id)?.state ?? null;
  }

  /** P5 pre-flight §0-5: the core holders of a region that changed since the start (the scenario's otherwise). */
  coreHolders(region: number): readonly number[] | null {
    return this.cores.get(region) ?? null;
  }

  takeoverFor(client: string): WwTakeoverView | null {
    return this.takeover.find((t) => t.client === client) ?? null;
  }
}
