// The World War 1936 P3 screens' tests: the economy fixture's fake game
// with a WwPoliticsView fed fake politics updates.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_STAT_KEYS,
  WwEventCard,
  WwPolDetail,
  WwPolGlobal,
  WwPolSummary,
  WwStatKey,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { fakeEconGame, FakeOptions, ID } from "./EconomyFixture";

export function polSummary(
  tag: CountryTag,
  over: Partial<WwPolSummary> = {},
): WwPolSummary {
  return {
    smallID: ID(tag),
    ruling: 3,
    leader: "",
    pop: [1500, 1000, 2000, 5500],
    stabBp: 5000,
    wsBp: 2000,
    ppMilli: 500_000,
    faction: -1,
    surrenderPct: 80,
    focus: null,
    ...over,
  };
}

/** A stats array (WW_STAT_KEYS order) with these values, 0 elsewhere. */
export function statsArray(s: Partial<Record<WwStatKey, number>>): number[] {
  return WW_STAT_KEYS.map((k) => s[k] ?? 0);
}

export function polDetail(
  tag: CountryTag,
  over: Partial<WwPolDetail> = {},
): WwPolDetail {
  return {
    smallID: ID(tag),
    ppGainMilli: 2_300,
    focus: null,
    queued: null,
    cards: [],
    advisors: [null, null, null, null, null, null, null, null],
    advisorLockUntil: [-1, -1, -1, -1, -1, -1, -1, -1],
    candidates: [],
    spirits: [],
    decisions: [],
    missions: [],
    justification: null,
    warGoals: [],
    researchBonuses: [],
    statParts: [],
    stats: statsArray({}),
    stabBaseBp: 5000,
    wsBaseBp: 2000,
    nextElectionDay: -1,
    crisisDays: [0, 0, 0, 0],
    pending: [],
    stabLines: [],
    wsLines: [],
    ...over,
  };
}

export function polGlobal(over: Partial<WwPolGlobal> = {}): WwPolGlobal {
  return {
    wtBp: 0,
    threat: [],
    factions: [],
    guarantees: [],
    naps: [],
    access: [],
    justifying: [],
    nextBeatDay: -1,
    ...over,
  };
}

/** The 1936 factions on the test map (DEU, ITA / GBR, FRA / SUN). */
export function startFactions(): WwPolGlobal["factions"] {
  return [
    {
      idx: 0,
      key: "axis",
      name: "",
      nameTag: "",
      leader: ID("DEU"),
      members: [ID("DEU"), ID("ITA")],
    },
    {
      idx: 1,
      key: "allies",
      name: "",
      nameTag: "",
      leader: ID("GBR"),
      members: [ID("GBR"), ID("FRA")],
    },
    {
      idx: 2,
      key: "comintern",
      name: "",
      nameTag: "",
      leader: ID("SUN"),
      members: [ID("SUN")],
    },
  ];
}

export function card(over: Partial<WwEventCard> = {}): WwEventCard {
  return {
    uid: 1,
    eventId: "gen_diplo_nap",
    from: ID("FRA"),
    target: 0,
    firedTick: 600,
    deadlineTick: 800,
    aiOption: "a",
    open: ["a", "b"],
    ...over,
  };
}

export interface PolOptions extends FakeOptions {
  polSummaries?: WwPolSummary[];
  polDetails?: WwPolDetail[];
  global?: Partial<WwPolGlobal>;
  news?: { id: string; params: Record<string, string | number> }[];
}

/** The economy fixture's game, its politics view fed `o`'s politics. */
export function fakePolGame(o: PolOptions = {}) {
  const r = fakeEconGame(o);
  r.pol.apply(
    {
      countries: o.polSummaries ?? [],
      details: o.polDetails ?? [],
      global: polGlobal(o.global),
      regions: [],
      news: o.news ?? [],
      cards: [],
    },
    o.ticks ?? 600,
  );
  return r;
}
