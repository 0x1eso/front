import type { GameMap } from "@openfront/engine-api/game/GameMap";
import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GwSaveHeader } from "@openfront/engine-api/game/SnapshotHeader";
import type { ClientID } from "@openfront/engine-api/Schemas";
import {
  GreatWarState,
  GreatWarStateSchema,
  GW_PACE_PCT,
  GW_THEATRES,
  GW_TOPICS,
  GwNationState,
  GwPersonState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwPressStart } from "@openfront/engine-api/ww1914/GwPress";
import { blankRuler } from "@openfront/engine-api/ww1914/GwRuler";
import { gwStoryStart } from "@openfront/engine-api/ww1914/GwStory";
import type { GreatWarData } from "@openfront/engine-api/ww1914/GwView";
import { snapshotType } from "@openfront/engine-lib/snapshot/SnapshotType";
import { budgetStart } from "@openfront/engine-lib/ww1914/BudgetRules";
import {
  gwCalendarOf,
  gwChapters,
} from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  fillGreatWarOwners,
  GwWorld,
  gwWorldOf,
} from "@openfront/engine-lib/ww1914/World1914";
import {
  civilFromDays,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { idHash } from "@openfront/engine-lib/ww1936/Roll";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import type { Game } from "../game/Game";
import { advanceChapter, allReady } from "./Chapters";
import { closeGame } from "./Endings";
import { prologueStep } from "./Prologue";
import { firstRegime, institutionsOf } from "./Regimes";
import { watchSeats } from "./Seats";
import { tableTick } from "./Table";
import { GW_ACTORS } from "./Tables";
import { gwView } from "./View";

/**
 * The record a snapshot stores. A change of GreatWarState's layout bumps
 * `version` and adds a migration.
 */
export const GreatWarSnapshot = snapshotType({
  name: "GreatWar",
  version: 2,
  schema: GreatWarStateSchema,
  migrations: {
    // ww158: a bill's house fields. Saves from before have bills with none.
    1: (d: { nations?: { laws?: Record<string, unknown>[] }[] }) => {
      for (const n of d.nations ?? []) {
        for (const l of n.laws ?? []) {
          l.origin ??= "seat";
          l.by ??= null;
          l.sponsor ??= null;
          l.deals ??= [];
          l.whip ??= -1;
          l.delayTo ??= -1;
          l.warm ??= [];
        }
      }
      return d;
    },
  },
});

/** Every value of the state, whatever its shape; key order doesn't count. */
function fold(h: number, v: unknown): number {
  if (typeof v === "number") return (Math.imul(h, 31) + v) | 0;
  if (typeof v === "string") return (Math.imul(h, 31) + idHash(v)) | 0;
  if (typeof v === "boolean") return (Math.imul(h, 31) + (v ? 1 : 2)) | 0;
  if (v === null || v === undefined) return (Math.imul(h, 31) + 3) | 0;
  if (Array.isArray(v)) {
    let out = (Math.imul(h, 31) + v.length) | 0;
    for (const x of v) out = fold(out, x);
    return out;
  }
  const o = v as Record<string, unknown>;
  let out = h;
  for (const k of Object.keys(o).sort()) {
    out = fold((Math.imul(out, 31) + idHash(k)) | 0, o[k]);
  }
  return out;
}

/**
 * Great War 1914: the chapters, the seats and everything the scenes read.
 * All state is the plain object `s`: snapshot, restore and hash cover a new
 * field with no further code. The systems (Chapters, Desk, SceneRun, Orders)
 * are functions over this object.
 */
export class GreatWar {
  s: GreatWarState;
  /** Derived from the map files, never stored. */
  readonly world: GwWorld;
  /** Not state: whether the screens need an update. */
  private dirty = true;
  /**
   * Not state: whose client this worker serves. Every client runs the whole
   * game, but what leaves the worker for the page is this seat's and no other's.
   */
  private viewer: ClientID | null = null;

  constructor(
    readonly mg: Game,
    readonly scenario: ScenarioIndex,
  ) {
    this.world = gwWorldOf(scenario);
    this.s = this.blank();
  }

  private blank(): GreatWarState {
    const calendar = gwCalendarOf(this.mg.config().gameConfig());
    const pressure = Object.fromEntries(
      GW_TOPICS.map((t) => [t, 0]),
    ) as GreatWarState["pressure"];
    return {
      seed: 0,
      rolled: false,
      calendar,
      chapter: 0,
      dayShift: 0,
      day: gwChapters(calendar)[0].day,
      deadlineTick: null,
      ended: null,
      opening: "sarajevo",
      temp: 0,
      crisis: null,
      pressure,
      secrets: [],
      sources: [],
      nations: [
        ...this.world.tags,
        ...GW_ACTORS.filter((t) => !this.world.tags.includes(t)),
      ].map(blankNation),
      people: gwContent().people.map((p) => ({
        id: p.id,
        office: p.office,
        status: p.arrives === undefined ? "active" : "waiting",
        temperament: p.temperaments[0],
        competence: [2, 2, 2],
        trust: 0,
        pride: 2,
        health: 3,
        memory: [],
        wins: 0,
        losses: 0,
        letter: null,
        ailing: null,
      })),
      theatres: GW_THEATRES.map((id) => ({
        id,
        line: 0,
        progress: 0,
        trench: 0,
        open: false,
        attacker: null,
        defender: null,
        commander: null,
        since: null,
      })),
      seats: [],
      nextCard: 1,
      chain: null,
      chains: [],
      spark: null,
      threads: [],
      plan: null,
      aside: false,
      uboat: 0,
      warChapter: null,
      blockade: 0,
      shipping: 0,
      armistice: null,
      closingDay: null,
      conferenceLeft: 0,
      talks: -9,
      reports: [],
      nextReport: 1,
      battles: [],
      news: [],
      held: {},
      landMoves: [],
      table: null,
      slowAsked: [],
      slowGranted: 0,
      telegrams: [],
      nextTelegram: 1,
      treaties: [],
      nextTreaty: 1,
    };
  }

  /** Gives the map its owners; the players must exist. */
  fillOwners(map: GameMap): void {
    fillGreatWarOwners(map, this.scenario, this.world);
  }

  /** The seats: every human's player. */
  start(): void {
    for (const p of this.mg.players()) {
      if (p.clientID() === null) continue;
      this.s.seats.push({
        smallID: p.smallID(),
        tag: this.tagOf(p.smallID()),
        ready: false,
        audiences: 0,
        privates: 0,
        desk: [],
        flags: [],
        memory: [],
        promises: [],
        seen: {},
        scheduled: [],
        alloc: {
          main: "west",
          posture: "hold",
          scale: "limited",
          allyShare: 0,
          research: "artillery",
        },
        log: [],
        tension: 0,
        shown: [],
        choices: [],
        mandates: [],
        known: [],
        subjects: {},
        big: -9,
        votes: [],
        signed: -1,
        lines: [],
        gov: [],
        memoir: null,
        ruler: blankRuler(),
        press: gwPressStart(),
        acts: 0,
        acted: [],
        aim: null,
        aimsDropped: [],
        claims: [],
        claimsSigned: -1,
        claimsChanged: 0,
        returns: [],
        terms: [],
        story: gwStoryStart(),
        ordered: false,
        idle: 0,
        regent: false,
        wired: 0,
        away: false,
      });
    }
    this.s.seats.sort((a, b) => a.smallID - b.smallID);
  }

  tagOf(smallID: number): GwTag {
    return this.world.tags[smallID - 1];
  }

  seatOf(smallID: number): GwSeatState | null {
    return this.s.seats.find((x) => x.smallID === smallID) ?? null;
  }

  nation(tag: GwTag): GwNationState | null {
    return this.s.nations.find((n) => n.tag === tag) ?? null;
  }

  person(id: string): GwPersonState | null {
    return this.s.people.find((p) => p.id === id) ?? null;
  }

  /** Any change the screens should see. */
  touch(): void {
    this.dirty = true;
  }

  /** The tick the chapter opened now closes at; null with no timer. */
  deadlineFrom(tick: number): number | null {
    const solo =
      this.mg.config().gameConfig().gameType === GameType.Singleplayer;
    if (solo) return null;
    const ch = gwChapters(this.s.calendar)[this.s.chapter];
    const pace = this.mg.config().gameConfig().greatWar1914Pace ?? "normal";
    return tick + Math.floor((ch.timerSec * GW_PACE_PCT[pace]) / 10);
  }

  /** The chapter clock: every seat ready, or the deadline, closes a chapter. */
  tick(ticks: number): void {
    const s = this.s;
    watchSeats(this);
    if (s.ended !== null) {
      // A scene can end the game between chapters.
      if (s.seats.some((x) => x.memoir === null)) closeGame(this);
      return;
    }
    if (this.mg.isPaused()) {
      // Time left stays as it was.
      if (s.deadlineTick !== null) s.deadlineTick++;
      return;
    }
    if (prologueStep(this, ticks)) return;
    tableTick(this, ticks);
    const late = s.deadlineTick !== null && ticks >= s.deadlineTick;
    if (late || allReady(this)) advanceChapter(this, ticks, late);
  }

  hash(): number {
    return fold(1914, this.s) >>> 0;
  }

  snapshot(): GreatWarState {
    return this.s;
  }

  restoreState(s: GreatWarState): void {
    this.s = s;
    this.dirty = true;
  }

  /** Whose client this is; null a spectator or a replay. */
  setViewer(clientID: ClientID | null): void {
    this.viewer = clientID;
  }

  /** The seat this worker may show, by smallID; null shows none. */
  private viewerSeat(): number | null {
    if (this.viewer === null) return null;
    return this.mg.playerByClientID(this.viewer)?.smallID() ?? null;
  }

  /** The view when something changed, else null. */
  takeData(): GreatWarData | null {
    if (!this.dirty) return null;
    this.dirty = false;
    return gwView(this, this.viewerSeat());
  }
}

/** What a resume lobby shows of a save. */
export function gwSaveHeader(s: GreatWarState): GwSaveHeader {
  return {
    seats: s.seats.map((x) => x.tag),
    chapter: s.chapter,
    date: formatIsoDate(civilFromDays(s.day)),
  };
}

function blankNation(tag: GwTag): GwNationState {
  return {
    tag,
    gauges: { shells: 2, bread: 2, money: 2, morale: 3, order: 3 },
    inst: institutionsOf(firstRegime(tag)),
    strength: {},
    trust: {},
    atWar: [],
    ai: "cautious",
    side: null,
    lean: 0,
    readiness: 0,
    offers: {},
    mob: 0,
    mobFrom: null,
    mobFull: null,
    alloc: null,
    manpower: 0,
    casualties: 0,
    lostNow: 0,
    authority: 60,
    unrest: 0,
    lowOrder: 0,
    base: {},
    wear: {},
    tech: {},
    out: false,
    regime: firstRegime(tag),
    command: false,
    techs: [],
    spent: -9,
    entered: null,
    budget: budgetStart(tag, 2),
    laws: [],
  };
}
