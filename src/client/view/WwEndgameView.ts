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
  WwPeaceOfferView,
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
  /** White peace: pending offers, refusal cooldowns [from, to, untilDay], truces [a, b, untilDay]. */
  peaceOffers: WwPeaceOfferView[] = [];
  peaceCooldowns: [number, number, number][] = [];
  truces: [number, number, number][] = [];
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
    if (d.peaceOffers !== undefined) this.peaceOffers = d.peaceOffers;
    if (d.peaceCooldowns !== undefined) this.peaceCooldowns = d.peaceCooldowns;
    if (d.truces !== undefined) this.truces = d.truces;
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

  /**
   * The country `client` controls after a takeover (0: spectating); null: its own.
   * (Final review M6: plain loops here and in isExile and takeoverFor —
   * the fog asks them on every question, wwOutOfGame.)
   */
  controlledBy(client: string): number | null {
    const cs = this.controllers;
    for (let i = 0; i < cs.length; i++)
      if (cs[i][0] === client) return cs[i][1];
    return null;
  }

  isExile(id: number): boolean {
    const es = this.exiles;
    for (let i = 0; i < es.length; i++) if (es[i].smallID === id) return true;
    return false;
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
    const ts = this.takeover;
    for (let i = 0; i < ts.length; i++)
      if (ts[i].client === client) return ts[i];
    return null;
  }

  /** White peace offers made to `smallID`, oldest first. */
  offersTo(smallID: number): WwPeaceOfferView[] {
    return this.peaceOffers.filter((o) => o.to === smallID);
  }

  /** My pending offer in war `war`; null when none. */
  offerFrom(smallID: number, war: number): WwPeaceOfferView | null {
    return (
      this.peaceOffers.find((o) => o.from === smallID && o.war === war) ?? null
    );
  }

  /** The day `from` may offer `to` again after a refusal (0: now). */
  cooldownUntil(from: number, to: number): number {
    return (
      this.peaceCooldowns.find((c) => c[0] === from && c[1] === to)?.[2] ?? 0
    );
  }

  /** The day the truce between `a` and `b` ends (0: none). */
  truceUntil(a: number, b: number): number {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return this.truces.find((t) => t[0] === lo && t[1] === hi)?.[2] ?? 0;
  }
}
