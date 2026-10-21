// World War 1936 (P2 Task 12, P3 Task 17): the restore oracle's machinery,
// shared by the CI tests and scripts/ww1936/det-sim.ts. One game plays on;
// at chosen moments a copy is restored from its snapshot (or from the last
// copy: a restore of a restore) and runs beside it with the same turns. The
// copies must stay identical: the game hash every tick, the World War state
// every few ticks, the whole snapshot and the live object graph at both ends
// of a copy's window.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type {
  GameStartInfo,
  StampedIntent,
  Turn,
  WwOrder,
} from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  FLEET_STATES,
  INVASION_STATES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import {
  createGameRunner,
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import {
  SPREAD_BATTLE,
  SPREAD_CAPITULATION,
  SPREAD_CAPTURE,
  SPREAD_REVERT,
} from "@openfront/engine/ww1936/land/WwLand";
import { focusCards } from "@openfront/engine/ww1936/politics/Focus";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { bytesEqual, diffGraphs, diffSnapshots } from "../util/Snapshot";

let worldFilesMemo: Promise<MapFiles> | null = null;
/** The real world1936 map's files (loaded once a process; clone before use). */
export function worldFiles(): Promise<MapFiles> {
  return (worldFilesMemo ??= loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  ));
}

/** The game takes its map's bytes over: every game gets its own copy. */
export function cloneFiles(f: MapFiles): MapFiles {
  return {
    ...f,
    mapBin: f.mapBin?.slice(),
    map4xBin: f.map4xBin?.slice(),
    map16xBin: f.map16xBin?.slice(),
    regionsBin: f.regionsBin?.slice(),
  };
}

const fail = (gu: unknown) => {
  if (typeof gu === "object" && gu !== null && "errMsg" in gu) {
    throw new Error(String((gu as { errMsg: string }).errMsg));
  }
};

export async function newRunner(
  start: GameStartInfo,
  files: MapFiles,
): Promise<GameRunner> {
  return createGameRunner(start, undefined, cloneFiles(files), fail);
}

/** A new runner from `from`'s snapshot (the start gives the game id only). */
export async function restoreRunner(
  start: GameStartInfo,
  from: GameRunner,
  files: MapFiles,
): Promise<GameRunner> {
  return createGameRunnerFromSnapshot(
    start,
    from.snapshot(),
    undefined,
    cloneFiles(files),
    fail,
  );
}

export function hashOf(g: Game): number {
  return (g as unknown as { hash(): number }).hash();
}

/** One tick with `turn`; throws when it does not run. */
export function tick(r: GameRunner, turn: Turn): void {
  r.addTurn(turn);
  if (!r.executeNextTick()) {
    throw new Error(`tick ${r.game.ticks()} did not run`);
  }
}

/** The first differences between two plain values, as paths. */
export function valueDiffs(x: unknown, y: unknown, limit = 10): string[] {
  const out: string[] = [];
  const walk = (a: unknown, b: unknown, p: string): void => {
    if (out.length >= limit) return;
    if (typeof a !== "object" || a === null) {
      if (!Object.is(a, b)) out.push(`${p}: ${String(a)} !== ${String(b)}`);
      return;
    }
    if (typeof b !== "object" || b === null) {
      out.push(`${p}: object vs ${String(b)}`);
      return;
    }
    if (Array.isArray(a) || ArrayBuffer.isView(a)) {
      const xa = a as unknown as ArrayLike<unknown>;
      const ya = b as unknown as ArrayLike<unknown>;
      if (xa.length !== ya.length) {
        out.push(`${p}: length ${xa.length} !== ${ya.length}`);
      }
      for (let i = 0; i < Math.min(xa.length, ya.length); i++) {
        walk(xa[i], ya[i], `${p}[${i}]`);
      }
      return;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b as object)]);
    for (const k of keys) {
      walk(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${p}.${k}`,
      );
    }
  };
  walk(x, y, "ww");
  return out;
}

/** The World War state (P0–P3) as plain data. */
function wwState(g: Game): unknown {
  return g.worldWar()!.snapshot();
}

/** A moment to restore at: the first tick (game.ticks()) `when` is true. */
export interface Moment {
  name: string;
  when(g: Game): boolean;
}

export interface LockstepPlan {
  start: GameStartInfo;
  files: MapFiles;
  /** The main game runs until game.ticks() reaches it. */
  until: number;
  /** Ticks each restored copy runs beside the main game. */
  window: number;
  /** Compare the World War state every n ticks of a copy (0: never). */
  wwEvery: number;
  /** Compare the whole game snapshot every n ticks of a copy (0: at its end only). */
  fullEvery?: number;
  /** diffGraphs (the live object graphs) at a copy's restore and end. */
  graphs?: boolean;
  /** Also restore every n ticks, from the newest copy still running (a restore of a restore). */
  periodic?: number;
  moments: Moment[];
  /** Human input for the tick, read from the main game (the same turn goes to every copy). */
  intents?: (g: Game) => StampedIntent[];
  /**
   * A test's hand after every tick, on the main game and every copy alike
   * (it must read only the game it gets, so equal games stay equal).
   */
  hand?: (g: Game) => void;
  /** Checks on a copy right after its restore. */
  onRestore?: (name: string, main: Game, copy: Game) => void;
  /** Checks on a copy after each of its ticks (`age` ticks since its restore). */
  afterTick?: (name: string, age: number, main: Game, copy: Game) => void;
  log?: (line: string) => void;
}

export interface LockstepReport {
  /** Where the copies were restored: moment name, tick, source. */
  restores: { name: string; tick: number; from: string }[];
  /** Moments that never came. */
  missed: string[];
  /** Every turn the main game played, from its first tick. */
  turns: Turn[];
  /** The game hash after every tick of the main game. */
  hashes: number[];
}

interface Copy {
  name: string;
  r: GameRunner;
  age: number;
}

/**
 * Plays `plan.start` to `plan.until` with restored copies running beside
 * it; throws at the first difference (which copy, how many ticks after its
 * restore, the first differing paths of the World War state).
 */
export async function runLockstep(plan: LockstepPlan): Promise<LockstepReport> {
  const log = plan.log ?? (() => {});
  const a = await newRunner(plan.start, plan.files);
  const copies: Copy[] = [];
  const taken = new Set<string>();
  const report: LockstepReport = {
    restores: [],
    missed: [],
    turns: [],
    hashes: [],
  };

  const close = (c: Copy) => {
    const sa = snapshotGame(a.game);
    const sb = snapshotGame(c.r.game);
    if (!bytesEqual(sa, sb)) {
      throw new Error(
        `${c.name}: snapshots differ ${c.age} tick(s) after restore:\n` +
          diffSnapshots(sa, sb).join("\n"),
      );
    }
    if (plan.graphs) {
      const d = diffGraphs(a.game, c.r.game);
      if (d.length > 0) {
        throw new Error(
          `${c.name}: object graphs differ ${c.age} tick(s) after restore:\n` +
            d.join("\n"),
        );
      }
    }
    log(`  ${c.name}: ${c.age} ticks equal`);
  };

  const restoreAt = async (name: string, chain: boolean) => {
    const src = chain && copies.length > 0 ? copies[copies.length - 1] : null;
    const r = await restoreRunner(plan.start, src?.r ?? a, plan.files);
    if (plan.graphs) {
      const d = diffGraphs(a.game, r.game);
      if (d.length > 0) {
        throw new Error(`${name}: the restore differs:\n${d.join("\n")}`);
      }
    }
    plan.onRestore?.(name, a.game, r.game);
    copies.push({ name, r, age: 0 });
    const from = src === null ? "game" : src.name;
    report.restores.push({ name, tick: a.game.ticks(), from });
    log(`restore "${name}" at tick ${a.game.ticks()} from ${from}`);
  };

  while (a.game.ticks() < plan.until) {
    const t = a.game.ticks();
    for (const m of plan.moments) {
      if (taken.has(m.name) || !m.when(a.game)) continue;
      taken.add(m.name);
      await restoreAt(m.name, false);
    }
    if (plan.periodic !== undefined && t > 0 && t % plan.periodic === 0) {
      await restoreAt(`periodic@${t}`, true);
    }
    const turn: Turn = { turnNumber: t, intents: plan.intents?.(a.game) ?? [] };
    report.turns.push(turn);
    tick(a, turn);
    plan.hand?.(a.game);
    const h = hashOf(a.game);
    report.hashes.push(h);
    for (const c of copies) {
      tick(c.r, turn);
      plan.hand?.(c.r.game);
      c.age++;
      if (hashOf(c.r.game) !== h) {
        const d = valueDiffs(wwState(a.game), wwState(c.r.game));
        throw new Error(
          `${c.name}: hash diverged ${c.age} tick(s) after restore ` +
            `(tick ${a.game.ticks()}):\n${d.join("\n")}`,
        );
      }
      const ww = plan.wwEvery > 0 && c.age % plan.wwEvery === 0;
      const full =
        plan.fullEvery !== undefined &&
        plan.fullEvery > 0 &&
        c.age % plan.fullEvery === 0;
      if (ww && !full) {
        const x = JSON.stringify(wwState(a.game));
        const y = JSON.stringify(wwState(c.r.game));
        if (x !== y) {
          throw new Error(
            `${c.name}: the World War state diverged ${c.age} tick(s) after restore:\n` +
              valueDiffs(JSON.parse(x), JSON.parse(y)).join("\n"),
          );
        }
      }
      plan.afterTick?.(c.name, c.age, a.game, c.r.game);
      if (full) {
        const sa = snapshotGame(a.game);
        const sb = snapshotGame(c.r.game);
        if (!bytesEqual(sa, sb)) {
          throw new Error(
            `${c.name}: snapshots differ ${c.age} tick(s) after restore:\n` +
              diffSnapshots(sa, sb).join("\n"),
          );
        }
      }
    }
    for (let i = copies.length - 1; i >= 0; i--) {
      if (copies[i].age < plan.window) continue;
      close(copies[i]);
      copies.splice(i, 1);
    }
  }
  for (const c of copies) close(c);
  report.missed = plan.moments.map((m) => m.name).filter((n) => !taken.has(n));
  return report;
}

/** Plays `turns` from turn 0 on a new runner; the game hash after every tick. */
export async function replay(
  start: GameStartInfo,
  files: MapFiles,
  turns: readonly Turn[],
  hand?: (g: Game) => void,
): Promise<number[]> {
  const r = await newRunner(start, files);
  const out: number[] = [];
  for (const turn of turns) {
    tick(r, turn);
    hand?.(r.game);
    out.push(hashOf(r.game));
  }
  return out;
}

// ---- The moments of a World War game (P2 spec §16.5, P3 spec §22.5) ----

/** True from the tick `value` first differs from its value at the first call. */
function changes(value: (g: Game) => string | number): (g: Game) => boolean {
  let first: string | number | null = null;
  return (g) => {
    const v = value(g);
    first ??= v;
    return v !== first;
  };
}

/** True on the ticks `value` grew since the tick before. */
function grows(value: (g: Game) => number): (g: Game) => boolean {
  let last: number | null = null;
  return (g) => {
    const v = value(g);
    const up = last !== null && v > last;
    last = v;
    return up;
  };
}

const landOf = (g: Game) => g.worldWar()!.land;
const polOf = (g: Game) => g.worldWar()!.politics;

function anyRow(g: Game, test: (row: number) => boolean): boolean {
  const t = landOf(g).divisions;
  for (let r = 0; r < t.rows; r++) if (t.id[r] !== 0 && test(r)) return true;
  return false;
}

function anySpread(g: Game, kind: number): boolean {
  for (const s of landOf(g).spreads.values()) {
    if (s.kind === kind && s.done > 0) return true;
  }
  return false;
}

/** Regions whose legal owner is no longer their 1936 owner. */
function movedRegions(g: Game): number {
  const ww = g.worldWar()!;
  const owners = ww.scenario.ownerByRegion();
  let n = 0;
  for (const r of ww.scenario.landRegions) {
    if (ww.politics.legalOwner[r.id] !== owners[r.id]) n++;
  }
  return n;
}

/**
 * The moments a restore must survive, each taken the first time it comes
 * (new closures every call: call once per game).
 */
export function worldMoments(): Moment[] {
  const pending = (g: Game, kind: "fire" | "choose") =>
    polOf(g).delayed.some((d) => d.kind === kind);
  return [
    {
      name: "the third tick of day 40",
      when: (g) => {
        const ww = g.worldWar()!;
        return (
          ww.day(g.ticks()) >= 40 &&
          g.ticks() - dayStartTick(ww.day(g.ticks()), ww.prepEndTick()) === 3
        );
      },
    },
    {
      name: "divisions in training",
      when: (g) =>
        g.worldWar()!.day(g.ticks()) >= 60 &&
        landOf(g)
          .countries()
          .some((c) => c.trainees.length > 0),
    },
    {
      name: "an event on the delay list",
      when: (g) => pending(g, "fire"),
    },
    {
      name: "an AI choice on the delay list",
      when: (g) => pending(g, "choose"),
    },
    {
      name: "a justification under way",
      when: (g) =>
        polOf(g)
          .list()
          .some(
            (c) => c.justification !== null && c.justification.progressDays > 0,
          ),
    },
    {
      name: "a decision mission running",
      when: (g) =>
        polOf(g)
          .list()
          .some((c) => c.missions.length > 0),
    },
    {
      name: "a war declared",
      when: grows((g) => g.worldWar()!.data().wars.length),
    },
    {
      name: "the factions changed",
      when: changes((g) =>
        polOf(g)
          .factions.map((f) => `${f.idx}:${f.members.join(".")}`)
          .join("|"),
      ),
    },
    {
      name: "a guarantee or access given",
      when: changes(
        (g) => polOf(g).guarantees.length * 1000 + polOf(g).access.length,
      ),
    },
    {
      name: "a peaceful transfer or annexation",
      when: grows(movedRegions),
    },
    {
      name: "a battle in its tenth round",
      when: (g) => {
        for (const b of landOf(g).battles.values())
          if (b.round >= 10) return true;
        return false;
      },
    },
    {
      name: "a retreat",
      when: (g) =>
        anyRow(g, (r) => landOf(g).divisions.mode[r] === MOVE_RETREAT),
    },
    {
      name: "divisions on rail",
      when: (g) => anyRow(g, (r) => landOf(g).divisions.mode[r] === MOVE_RAIL),
    },
    {
      name: "divisions at sea",
      when: (g) => anyRow(g, (r) => landOf(g).divisions.mode[r] === MOVE_SEA),
    },
    {
      name: "a paradrop in preparation",
      when: (g) =>
        [...landOf(g).armies.values()].some((a) => a.order.kind === "paradrop"),
    },
    {
      name: "a battle's spread part-way",
      when: (g) => anySpread(g, SPREAD_BATTLE) || anySpread(g, SPREAD_CAPTURE),
    },
    {
      name: "a reverting spread part-way",
      when: (g) => anySpread(g, SPREAD_REVERT),
    },
    // (P0's transfer queue is no longer filled, P2 plan decision 8: a
    // capitulation's land goes by the spread below.)
    {
      name: "a capitulation's spread part-way",
      when: (g) =>
        g.worldWar()!.data().capitulated.length > 0 &&
        anySpread(g, SPREAD_CAPITULATION),
    },
    {
      name: "the tick after a capitulation",
      when: grows((g) => g.worldWar()!.data().capitulated.length),
    },
    ...seaAirMoments(),
  ];
}

const navyOf = (g: Game) => g.worldWar()!.navy;
const airOf = (g: Game) => g.worldWar()!.air;
const INV = (s: (typeof INVASION_STATES)[number]) => INVASION_STATES.indexOf(s);
const MOVING = FLEET_STATES.indexOf("moving");

/**
 * P4 Task 16 (spec §23.2's last line): the moments of the navy and the air
 * war a restore must survive, each taken the first time it comes (new
 * closures every call).
 */
export function seaAirMoments(): Moment[] {
  return [
    {
      name: "a naval battle in its fifth round",
      when: (g) => {
        for (const b of navyOf(g).battles.values())
          if (b.round >= 5) return true;
        return false;
      },
    },
    {
      name: "a fleet under way",
      when: (g) => {
        for (const f of navyOf(g).fleets.values()) {
          if (f.state === MOVING && f.path.length > 0 && f.prog > 0)
            return true;
        }
        return false;
      },
    },
    {
      name: "an invasion in preparation",
      when: (g) => {
        for (const x of navyOf(g).invasions.values()) {
          if (x.state === INV("preparing") && x.prepDone > 0) return true;
        }
        return false;
      },
    },
    {
      name: "an invasion at sea",
      when: (g) => {
        const n = navyOf(g);
        for (const x of n.invasions.values()) {
          if (x.state !== INV("sailing")) continue;
          const v = n.voyages.get(x.voyage);
          if (v !== undefined && v.prog > 0) return true;
        }
        return false;
      },
    },
    {
      name: "a landing battle",
      when: (g) => {
        for (const x of navyOf(g).invasions.values()) {
          if (x.state === INV("landing")) return true;
        }
        return false;
      },
    },
    {
      name: "convoys raided",
      when: (g) => navyOf(g).srState.some((s) => s.lossYesterday.size > 0),
    },
    {
      name: "a sea route found again tomorrow",
      when: (g) => {
        const n = navyOf(g);
        const day = n.day(g.ticks());
        for (const r of n.routes.values()) {
          if (r.nextDay === day + 1 && r.got > 0) return true;
        }
        return false;
      },
    },
    {
      name: "an air campaign",
      when: (g) => {
        const a = airOf(g);
        let flying = 0;
        for (const d of a.deployments.values()) {
          if (d.counts.some((c) => c > 0)) flying++;
        }
        return flying >= 2 && a.planesLostTotal > 0;
      },
    },
    {
      name: "a bombed building under repair",
      when: (g) => {
        const e = g.worldWar()!.economy;
        for (let i = 0; i < e.damage.length; i++) {
          if (e.damage[i] > 0 && e.repair[i] > 0) return true;
        }
        return false;
      },
    },
    {
      name: "a fuel shortage",
      when: (g) =>
        g
          .worldWar()!
          .economy.countries()
          .some((c) => c.fuelRatioPm < 1000),
    },
  ];
}

// ---- A scripted human (det-sim --human) ----

/**
 * A human country's turns on any map, read from the game alone: a focus
 * whenever none runs (the first open one of its tree), each event card
 * answered "a" a day after it came, and on 1939-08-25 the pact with Poland
 * broken and on 1939-09-01 war declared on it (beats never move a human).
 * Refused orders are fine: they are part of the replayed turns too.
 */
export function scriptedHuman(
  tag: CountryTag,
  clientID: string,
): (g: Game) => StampedIntent[] {
  const ord = (o: WwOrder): StampedIntent =>
    ({ type: "ww_order", order: o, clientID }) as StampedIntent;
  return (g) => {
    const ww = g.worldWar()!;
    const me = ww.playerOfTag(tag);
    if (me === null || !me.isAlive() || ww.inPrep(g.ticks())) return [];
    const p = ww.politics;
    const c = p.country(me.smallID())!;
    const day = ww.day(g.ticks());
    const k = g.ticks() - dayStartTick(day, ww.prepEndTick());
    const out: StampedIntent[] = [];
    for (const card of c.pending) {
      if (g.ticks() === card.firedTick + 8) {
        out.push(ord({ kind: "event_choose", uid: card.uid, option: "a" }));
      }
    }
    if (k !== 2) return out;
    if (c.focus === null) {
      const open = focusCards(p, me.smallID()).find((x) => x.state === 0);
      if (open !== undefined) {
        const fi = p.content.treeFocuses[c.tree][open.idx];
        out.push(ord({ kind: "focus_start", focus: p.content.focuses[fi].id }));
      }
    }
    const pol = ww.playerOfTag("POL");
    if (pol !== null && tag !== "POL") {
      if (day === dayOfDate("1939-08-25")) {
        out.push(ord({ kind: "nap_break", target: pol.smallID() }));
      }
      if (day === dayOfDate("1939-09-01")) {
        out.push({
          type: "declare_war",
          target: pol.id(),
          clientID,
        } as StampedIntent);
      }
    }
    return out;
  };
}
